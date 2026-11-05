# UaiCasa — Plataforma de reserva direta

`uaicasa.com.br` • Rua João Paulo II, nº 2 — Colônia do Marçal — São João del-Rei/MG

Reserva direta de **hospedagem por temporada** e **locação do espaço para festas (day use)**, com
calendário unificado, preços dinâmicos, contrato com aceite eletrônico, PIX com baixa automática,
financeiro/DRE e painel administrativo.

```bash
cd uaicasa
npm install
npm run dev        # http://localhost:3000  (sem .env → modo demonstração)
npm test           # 15 testes do motor de preços e de conflitos
npm run build
```

Páginas: `/` (site + reserva), `/reservar` (checkout + PIX), `/admin` (painel).

---

## 1. Arquitetura geral

```
                ┌──────────────────────── Vercel ────────────────────────┐
 Hóspede ──────▶│  Next.js 16 (App Router, React 19, TypeScript, Tailwind 4)│
 (celular)      │                                                          │
                │  Server Components ── páginas (SEO, fotos otimizadas)    │
                │  Route Handlers  /api/quote · /api/availability          │
                │                  /api/bookings · /api/webhooks/payments  │
                │        │                                                 │
                │        ▼                                                 │
                │  src/lib/domain  ← regras de negócio PURAS (sem I/O)     │
                │   pricing.ts  availability.ts  (testadas com Vitest)     │
                └────────┬───────────────────────┬────────────────────────┘
                         │ supabase-js (service)  │ HTTPS
                         ▼                        ▼
         ┌──────────── Supabase ───────────┐   ┌──────── Asaas ────────┐
         │ PostgreSQL                      │   │ Cliente + Cobrança PIX │
         │  • EXCLUDE constraint (gist) =  │   │ QR Code dinâmico       │
         │    zero overbooking             │◀──│ Webhook PAYMENT_*      │
         │  • triggers → livro razão       │   └────────────────────────┘
         │  • views DRE / ocupação         │
         │ Auth (admin) + RLS              │   Resend (e-mail) · PDF do contrato
         │ Storage (fotos, PDFs)           │   pg_cron (expira PIX não pagos)
         └─────────────────────────────────┘
```

**Por que essa stack** (custo quase zero no início): Vercel Hobby/Pro + Supabase Free/Pro, sem servidor
para manter. O PIX via Asaas cobra tarifa fixa por cobrança recebida. A mesma base serve vários imóveis
depois (`property_id` em todas as tabelas).

**Decisão central:** a regra de conflito existe **em dois lugares com a mesma matemática**:

1. Em TypeScript (`availability.ts`), para o calendário e a cotação instantânea.
2. No Postgres (`occupancy` + `EXCLUDE USING gist`), como garantia final. Se duas pessoas pagarem o mesmo
   dia ao mesmo tempo, o banco recusa a segunda (`DATES_UNAVAILABLE`).

## 2. Organização de pastas

```
uaicasa/
├── supabase/migrations/0001_init.sql   # schema completo + RLS + seed (testado em Postgres 16)
├── public/fotos/                       # fotos do imóvel
└── src/
    ├── app/
    │   ├── page.tsx                    # landing: hero, seletor Hospedar × Eventos, galeria, mapa
    │   ├── reservar/                   # checkout: dados, contrato, aceite, PIX
    │   ├── admin/                      # painel: KPIs, reservas, calendário, DRE, preços, WhatsApp
    │   └── api/
    │       ├── quote/                  # POST cotação (preço oficial do servidor)
    │       ├── availability/           # GET status + preço dia a dia
    │       ├── bookings/               # POST cria reserva + contrato + cobrança PIX
    │       └── webhooks/payments/      # POST do gateway (idempotente)
    ├── components/                     # BookingWidget, AvailabilityCalendar, Gallery, QuoteSummary…
    └── lib/
        ├── domain/                     # ★ núcleo: dates, types, pricing, availability, validation (+ testes)
        ├── data/                       # repository (Supabase ou demo), demo.ts, photos.ts
        ├── payments/gateway.ts         # interface + Asaas + Mock
        ├── contracts/contract.ts       # cláusulas por modalidade + texto canônico p/ hash
        └── messages/whatsapp.ts        # templates + link wa.me
```

## 3. Banco de dados (resumo)

| Tabela | Papel |
|---|---|
| `properties` | imóvel + horários, capacidades, buffers de limpeza, antecedência mínima |
| `pricing_rules` | tarifa base/fim de semana, limpeza, caução, inclusos, excedente, hora extra, % de sinal, por modalidade |
| `calendar_pricing` | datas especiais: preço fixo **ou** multiplicador, mínimo de diárias, sem check-in, eventos proibidos, prioridade |
| `guests` | locatário (CPF/CNPJ único) |
| `bookings` | reserva com **snapshot financeiro** congelado + `price_breakdown` noite a noite |
| `occupancy` | **fonte da verdade do calendário**: reservas ativas, bloqueios manuais, manutenção, iCal, já com buffers. `EXCLUDE` impede sobreposição |
| `payments` / `webhook_events` | cobranças no gateway + idempotência de webhooks |
| `contract_templates` / `contracts` | modelos versionados, texto final congelado, SHA-256, IP, user-agent, data/hora do aceite |
| `financial_transactions` | livro razão (receitas automáticas por trigger, despesas manuais) |
| `v_dre_monthly`, `v_occupancy_monthly` | relatórios |
| `message_templates`, `ical_feeds` | WhatsApp e sincronização Airbnb/Booking |

Valores sempre em **centavos (int)**. Ciclo de status: `pending_payment` (segura a data por 30 min) →
`confirmed` (webhook) → `checked_in` → `completed`, ou `expired` / `cancelled`, que liberam a data.

## 4. Regra híbrida Hospedagem × Evento

Cada reserva vira um intervalo real de tempo, somado aos buffers:

| | Início | Fim |
|---|---|---|
| Hospedagem | check-in (14h) | check-out (11h) **+ 3h de limpeza** |
| Evento | início (10h) **− 3h de preparo** | fim (22h) **+ 12h de limpeza** |

Consequências com a configuração padrão:
- Festa **no dia do check-out** de um hóspede: ✗ (casa ocupada até 14h, preparo começa às 7h).
- Festa **no dia do check-in**: ✗.
- Hospedagem **no dia de uma festa**: ✗. **No dia seguinte**: ✓ (limpeza até 10h, check-in às 14h).
- Troca de hóspedes no mesmo dia (sai 11h, entra 14h): ✓.
- Festa que vai até 2h: a limpeza é empurrada automaticamente.

Todos os valores são configuráveis em `properties`. Os casos estão cobertos em `engine.test.ts`.

## 5. Motor de preços

Para cada noite (ou dia de evento): **sobrescrita de maior prioridade** (empate → a de intervalo menor),
depois **tarifa de fim de semana** (sex/sáb para hospedagem, sáb/dom para eventos), depois **base**.
Depois somam-se: excedente de pessoas (por noite na hospedagem, por evento na festa), horas extras,
taxa de limpeza. A caução fica à parte. O sinal é `ceil(total × %)`. O mínimo de diárias é o maior entre
o padrão e o de qualquer data especial dentro da estadia.

Datas pré-cadastradas na demonstração: Natal, Réveillon (mín. 4), férias de janeiro (×1,15),
**Carnaval de SJDR** (R$ 2.500/noite, mín. 4, sem festas), **Semana Santa de SJDR**, Tiradentes (×1,3),
Festival de Inverno (×1,2). Os valores são exemplos para você ajustar.

## 6. Fluxos de integração

**Checkout / PIX**
1. `POST /api/bookings` → valida CPF/CNPJ, e-mail e telefone, **recalcula a cotação no servidor**.
2. Gera o contrato e o SHA-256 do texto aceito.
3. RPC `create_booking` (transação): cria/atualiza o hóspede, cria a reserva `pending_payment`, e o trigger
   insere em `occupancy` (o `EXCLUDE` barra conflito).
4. Asaas: busca/cria cliente → `POST /payments` (`billingType: PIX`, `externalReference = booking.id`) →
   `GET /payments/{id}/pixQrCode`.
5. Hóspede paga → Asaas chama `/api/webhooks/payments` (header `asaas-access-token`) → idempotência em
   `webhook_events` → `payments.received` → `bookings.confirmed` → triggers lançam a receita e a taxa do
   gateway no livro razão.
6. `pg_cron` a cada 5 min: `expire_pending_bookings()` libera datas não pagas.

**Contrato / PDF / e-mail (próximo passo)**: ao confirmar, gerar o PDF a partir de `contracts.rendered_html`
(`@react-pdf/renderer` numa rota Node, ou Edge Function), salvar no bucket `contracts`, enviar por
e-mail (Resend) e WhatsApp. O aceite atual é *clickwrap* (MP 2.200-2/2001) com hash, IP e data/hora. Para
assinatura com certificado, a coluna `signature_provider` já prevê ZapSign ou Clicksign.

**iCal**: exportar `/api/ical/{export_token}.ics` a partir de `occupancy`. Importar os feeds do
Airbnb/Booking a cada 30 min para `occupancy(kind='ical_import')`.

## 7. Para colocar em produção

1. Criar o projeto no Supabase e rodar `supabase/migrations/0001_init.sql`.
2. Criar seu usuário no Auth e inserir em `admin_users`. Proteger `/admin` com middleware.
3. Cadastrar `contract_templates` (um por modalidade).
4. Conta Asaas (sandbox primeiro) → chave de API + webhook apontando para `https://uaicasa.com.br/api/webhooks/payments`.
5. Copiar `.env.example` → `.env.local` / variáveis da Vercel.
6. No Registro.br, apontar o DNS de `uaicasa.com.br` para a Vercel.
7. Trocar `WHATSAPP` em `src/components/SiteHeader.tsx` pelo número oficial.
8. Painel: hoje usa dados de demonstração. Ligar às tabelas e views reais.
