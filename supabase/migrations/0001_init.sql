-- =====================================================================
-- UaiCasa — Schema inicial (PostgreSQL 15+ / Supabase)
-- Rua João Paulo II, nº 2 — Colônia do Marçal — São João del-Rei/MG
--
-- Princípios:
--   * Valores monetários sempre em CENTAVOS (integer/bigint) — nunca float.
--   * Datas civis em `date`; instantes em `timestamptz` (fuso America/Sao_Paulo).
--   * Conflito de calendário garantido NO BANCO via EXCLUDE constraint
--     (btree_gist), não só na aplicação → à prova de corrida (2 PIX ao mesmo tempo).
--   * Multi-propriedade desde o dia 1 (property_id em tudo), embora hoje exista 1 imóvel.
-- =====================================================================

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type booking_mode as enum ('stay', 'event');           -- hospedagem | festa/day use

create type booking_status as enum (
  'quote',            -- cotação salva (não segura data)
  'pending_payment',  -- PIX gerado: segura a data até expires_at
  'confirmed',        -- pago
  'checked_in',
  'completed',
  'cancelled',
  'expired',          -- PIX não pago no prazo
  'no_show'
);

create type booking_source as enum ('website', 'whatsapp', 'presencial', 'airbnb', 'booking', 'outro');

create type override_scope as enum ('stay', 'event', 'both');

create type occupancy_kind as enum ('booking', 'manual_block', 'maintenance', 'ical_import');

create type payment_status as enum ('pending', 'received', 'confirmed', 'overdue', 'refunded', 'cancelled', 'failed');
create type payment_method as enum ('pix', 'credit_card', 'boleto', 'cash', 'transfer');
create type payment_purpose as enum ('booking', 'deposit', 'balance', 'extra');

create type contract_status as enum ('draft', 'sent', 'accepted', 'void');

create type tx_type as enum ('income', 'expense', 'refund', 'deposit_in', 'deposit_out');
create type tx_category as enum (
  -- receitas
  'diarias', 'locacao_evento', 'taxa_limpeza', 'convidado_extra', 'outras_receitas',
  -- despesas
  'limpeza', 'manutencao', 'piscina', 'energia', 'agua', 'internet', 'iptu',
  'taxa_gateway', 'comissao_canal', 'enxoval', 'jardinagem', 'marketing', 'impostos', 'outras_despesas'
);

create type deposit_status as enum ('not_required', 'pending', 'held', 'released', 'partially_retained', 'retained');

-- ---------------------------------------------------------------------
-- USUÁRIOS ADMIN (vincula ao auth.users do Supabase)
-- ---------------------------------------------------------------------
create table admin_users (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        text not null default 'owner' check (role in ('owner', 'manager', 'cleaning')),
  created_at  timestamptz not null default now()
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- PROPERTIES — imóvel + regras operacionais
-- ---------------------------------------------------------------------
create table properties (
  id                        uuid primary key default gen_random_uuid(),
  slug                      text unique not null,
  name                      text not null,
  description               text,
  address_line              text not null,
  neighborhood              text,
  city                      text not null,
  state                     char(2) not null,
  zip                       text,
  latitude                  numeric(9,6),
  longitude                 numeric(9,6),
  timezone                  text not null default 'America/Sao_Paulo',

  -- Hospedagem
  max_guests_stay           int  not null check (max_guests_stay > 0),
  bedrooms                  int  not null default 0,
  bathrooms                 int  not null default 0,
  checkin_time              time not null default '14:00',
  checkout_time             time not null default '11:00',
  default_min_nights        int  not null default 2 check (default_min_nights >= 1),

  -- Eventos
  max_guests_event          int  not null check (max_guests_event > 0),
  event_start_time          time not null default '10:00',
  event_end_time            time not null default '22:00',   -- se < start, termina no dia seguinte
  loud_music_until          time not null default '22:00',
  event_min_lead_days       int  not null default 7,         -- antecedência mínima para festa

  -- Buffers de limpeza / preparação (em minutos)
  buffer_after_stay_min     int  not null default 180,
  buffer_before_event_min   int  not null default 180,
  buffer_after_event_min    int  not null default 720,       -- 12h de limpeza pós-festa

  -- Reserva
  hold_minutes              int  not null default 30,        -- validade do PIX / bloqueio provisório
  max_advance_days          int  not null default 540,
  is_active                 boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table property_photos (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references properties(id) on delete cascade,
  category     text not null check (category in ('visao_geral', 'piscina', 'festas', 'suites', 'cozinha', 'lazer')),
  storage_path text not null,
  caption      text,
  sort_order   int not null default 0,
  is_cover     boolean not null default false
);
create index on property_photos (property_id, category, sort_order);

create table amenities (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references properties(id) on delete cascade,
  label        text not null,
  icon         text,
  scope        override_scope not null default 'both'
);

-- ---------------------------------------------------------------------
-- PRICING — tarifa base por modalidade + taxas
-- ---------------------------------------------------------------------
create table pricing_rules (
  id                            uuid primary key default gen_random_uuid(),
  property_id                   uuid not null references properties(id) on delete cascade,
  mode                          booking_mode not null,
  base_price_cents              int not null check (base_price_cents >= 0),  -- diária (stay) ou dia de evento
  weekend_price_cents           int check (weekend_price_cents >= 0),        -- noites de sex/sáb (stay) ou sáb/dom (event)
  cleaning_fee_cents            int not null default 0,
  security_deposit_cents        int not null default 0,                      -- caução (reembolsável)
  included_guests               int not null,                                -- hóspedes/convidados inclusos
  extra_guest_fee_cents         int not null default 0,                      -- por pessoa (por noite em stay; por evento em event)
  extra_hour_fee_cents          int not null default 0,                      -- eventos: hora extra
  deposit_percent_due_now       int not null default 100 check (deposit_percent_due_now between 1 and 100), -- % de sinal no checkout
  valid_from                    date not null default current_date,
  valid_to                      date,
  unique (property_id, mode, valid_from)
);

-- Sobrescrita por data (Carnaval, Tiradentes, Semana Santa, Natal, Réveillon...)
create table calendar_pricing (
  id                 uuid primary key default gen_random_uuid(),
  property_id        uuid not null references properties(id) on delete cascade,
  label              text not null,                         -- ex.: "Carnaval SJDR 2027"
  scope              override_scope not null default 'both',
  dates              daterange not null,                    -- [início, fim) — inclusivo/exclusivo
  price_cents        int check (price_cents >= 0),          -- preço absoluto da noite/dia
  price_multiplier   numeric(5,2) check (price_multiplier > 0), -- OU multiplicador sobre a base
  min_nights         int check (min_nights >= 1),           -- pacote mínimo (ex.: 4 noites no Carnaval)
  closed_to_arrival  boolean not null default false,        -- não permite check-in nesse dia
  events_allowed     boolean not null default true,         -- permite festa nesses dias?
  priority           int not null default 0,                -- maior vence em sobreposição
  created_at         timestamptz not null default now(),
  check (price_cents is not null or price_multiplier is not null or min_nights is not null
         or closed_to_arrival or not events_allowed)
);
create index calendar_pricing_dates_gist on calendar_pricing using gist (property_id, dates);

-- ---------------------------------------------------------------------
-- GUESTS — locatário (dados do contrato)
-- ---------------------------------------------------------------------
create table guests (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  document_type   text not null check (document_type in ('cpf', 'cnpj', 'passaporte')),
  document_number text not null,                  -- só dígitos
  email           text not null,
  phone           text not null,                  -- E.164: +5532999999999
  birth_date      date,
  address_street  text,
  address_number  text,
  address_complement text,
  address_district text,
  address_city    text,
  address_state   char(2),
  address_zip     text,
  gateway_customer_id text,                       -- id do cliente no Asaas/Mercado Pago
  notes           text,
  created_at      timestamptz not null default now(),
  unique (document_type, document_number)
);
create index on guests (lower(email));
create index on guests (phone);

-- ---------------------------------------------------------------------
-- BOOKINGS
-- ---------------------------------------------------------------------
create table bookings (
  id                 uuid primary key default gen_random_uuid(),
  code               text unique not null default upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8)), -- código curto p/ WhatsApp
  property_id        uuid not null references properties(id),
  guest_id           uuid not null references guests(id),
  mode               booking_mode not null,
  status             booking_status not null default 'pending_payment',
  source             booking_source not null default 'website',

  -- Datas civis (para relatórios) …
  start_date         date not null,               -- check-in (stay) ou dia do evento
  end_date           date not null,               -- check-out (stay) ou = start_date (event)
  nights             int generated always as (greatest(end_date - start_date, 0)) stored,
  -- … e instantes reais (para o motor de conflito)
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,

  guests_count       int not null check (guests_count > 0),
  event_type         text,                        -- aniversário, casamento, confraternização…

  -- Snapshot financeiro (congelado no momento da reserva)
  subtotal_cents         int not null,
  cleaning_fee_cents     int not null default 0,
  extra_guests_cents     int not null default 0,
  discount_cents         int not null default 0,
  total_cents            int not null,              -- valor da locação (sem caução)
  security_deposit_cents int not null default 0,
  amount_due_now_cents   int not null,
  deposit_status         deposit_status not null default 'not_required',
  price_breakdown        jsonb not null default '[]'::jsonb,  -- linhas noite-a-noite

  expires_at         timestamptz,                 -- validade do bloqueio pending_payment
  confirmed_at       timestamptz,
  cancelled_at       timestamptz,
  cancel_reason      text,
  internal_notes     text,
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  check (end_date >= start_date),
  check (ends_at > starts_at),
  check (mode = 'event' or end_date > start_date),
  check (total_cents = subtotal_cents + cleaning_fee_cents + extra_guests_cents - discount_cents)
);
create index on bookings (property_id, start_date);
create index on bookings (status);
create index on bookings (guest_id);

-- ---------------------------------------------------------------------
-- OCCUPANCY — fonte única da verdade do calendário.
-- Toda reserva ativa e todo bloqueio manual viram uma linha aqui com
-- o período JÁ ACRESCIDO dos buffers de limpeza/preparação.
-- A EXCLUDE constraint impede qualquer sobreposição.
-- ---------------------------------------------------------------------
create table occupancy (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references properties(id) on delete cascade,
  kind         occupancy_kind not null,
  booking_id   uuid unique references bookings(id) on delete cascade,
  period       tstzrange not null,                -- [início - buffer_antes, fim + buffer_depois)
  active       boolean not null default true,
  reason       text,                              -- bloqueios manuais / iCal
  external_uid text,                              -- UID do evento iCal importado
  created_at   timestamptz not null default now(),
  check ((kind = 'booking') = (booking_id is not null)),
  constraint occupancy_no_overlap
    exclude using gist (property_id with =, period with &&) where (active)
);
create index on occupancy using gist (property_id, period) where active;

-- Calcula o período ocupado (com buffers) de uma reserva
create or replace function booking_occupied_period(b bookings) returns tstzrange
language sql stable as $$
  select case b.mode
    when 'stay' then tstzrange(b.starts_at,
                               b.ends_at + make_interval(mins => p.buffer_after_stay_min), '[)')
    else            tstzrange(b.starts_at - make_interval(mins => p.buffer_before_event_min),
                              b.ends_at + make_interval(mins => p.buffer_after_event_min), '[)')
  end
  from properties p where p.id = b.property_id;
$$;

-- Mantém occupancy sincronizada com o status da reserva.
-- AFTER: a linha da reserva precisa existir para a FK de occupancy.
-- Se o período colidir, a EXCLUDE constraint aborta a transação inteira.
create or replace function sync_booking_occupancy_after() returns trigger
language plpgsql as $$
begin
  if new.status in ('pending_payment', 'confirmed', 'checked_in') then
    insert into occupancy (property_id, kind, booking_id, period, active)
    values (new.property_id, 'booking', new.id, booking_occupied_period(new), true)
    on conflict (booking_id) do update
      set period = excluded.period, active = true;
  elsif new.status in ('completed') then
    null; -- mantém histórico ativo (passado não conflita com futuro)
  else
    update occupancy set active = false where booking_id = new.id;
  end if;
  return null;
end $$;
create trigger trg_booking_occupancy
after insert or update of status, starts_at, ends_at on bookings
for each row execute function sync_booking_occupancy_after();

-- Expira PIX não pagos (agendar via pg_cron a cada 5 min)
create or replace function expire_pending_bookings() returns int
language plpgsql as $$
declare n int;
begin
  update bookings set status = 'expired'
   where status = 'pending_payment' and expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;
-- select cron.schedule('expire-holds', '*/5 * * * *', $$select expire_pending_bookings()$$);

-- ---------------------------------------------------------------------
-- PAYMENTS — cobranças no gateway (Asaas / Mercado Pago)
-- ---------------------------------------------------------------------
create table payments (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null references bookings(id) on delete cascade,
  purpose            payment_purpose not null default 'booking',
  method             payment_method not null default 'pix',
  status             payment_status not null default 'pending',
  gateway            text not null default 'asaas' check (gateway in ('asaas', 'mercadopago', 'manual')),
  gateway_payment_id text unique,
  amount_cents       int not null check (amount_cents > 0),
  net_amount_cents   int,                          -- líquido após taxa do gateway
  pix_qr_code_base64 text,
  pix_copy_paste     text,
  due_at             timestamptz,
  paid_at            timestamptz,
  raw_last_event     jsonb,
  created_at         timestamptz not null default now()
);
create index on payments (booking_id);

-- Idempotência de webhooks (o gateway pode reenviar o mesmo evento)
create table webhook_events (
  id           text primary key,                   -- id do evento no gateway
  gateway      text not null,
  event_type   text not null,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz
);

-- ---------------------------------------------------------------------
-- CONTRACTS — contrato de temporada / termo de uso para eventos
-- ---------------------------------------------------------------------
create table contract_templates (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references properties(id) on delete cascade,
  mode         booking_mode not null,
  version      int not null,
  title        text not null,
  body_md      text not null,                      -- Markdown com {{placeholders}}
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (property_id, mode, version)
);

create table contracts (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null unique references bookings(id) on delete cascade,
  template_id         uuid not null references contract_templates(id),
  status              contract_status not null default 'draft',
  rendered_html       text not null,               -- texto final congelado
  content_sha256      text not null,               -- hash do texto aceito (prova de integridade)
  pdf_storage_path    text,                        -- bucket "contracts" no Supabase Storage
  accepted_at         timestamptz,
  accepted_ip         inet,
  accepted_user_agent text,
  accepted_name       text,                        -- nome digitado no aceite
  signature_provider  text,                        -- 'clickwrap' | 'clicksign' | 'zapsign'
  signature_envelope_id text,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- FINANCEIRO — livro razão (ledger)
-- ---------------------------------------------------------------------
create table financial_transactions (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references properties(id),
  booking_id    uuid references bookings(id) on delete set null,
  payment_id    uuid references payments(id) on delete set null,
  type          tx_type not null,
  category      tx_category not null,
  description   text not null,
  amount_cents  int not null check (amount_cents > 0),  -- sempre positivo; o sinal vem de `type`
  occurred_on   date not null,                           -- competência
  paid_on       date,                                    -- caixa
  is_recurring  boolean not null default false,
  attachment_path text,                                  -- comprovante/nota no Storage
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);
create index on financial_transactions (property_id, occurred_on);
create index on financial_transactions (booking_id);

-- Lança receita automaticamente quando a reserva é confirmada
create or replace function ledger_on_booking_confirmed() returns trigger
language plpgsql as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    insert into financial_transactions (property_id, booking_id, type, category, description, amount_cents, occurred_on, paid_on)
    select new.property_id, new.id, 'income',
           case new.mode when 'stay' then 'diarias'::tx_category else 'locacao_evento'::tx_category end,
           'Reserva ' || new.code, new.subtotal_cents + new.extra_guests_cents - new.discount_cents,
           new.start_date, current_date
    where new.subtotal_cents + new.extra_guests_cents - new.discount_cents > 0;

    insert into financial_transactions (property_id, booking_id, type, category, description, amount_cents, occurred_on, paid_on)
    select new.property_id, new.id, 'income', 'taxa_limpeza', 'Taxa de limpeza ' || new.code,
           new.cleaning_fee_cents, new.start_date, current_date
    where new.cleaning_fee_cents > 0;

    new.confirmed_at := coalesce(new.confirmed_at, now());
  end if;
  return new;
end $$;

create trigger trg_ledger_booking_confirmed
before update of status on bookings
for each row execute function ledger_on_booking_confirmed();

-- Taxa do gateway vira despesa automaticamente quando o pagamento é recebido
create or replace function ledger_on_payment_received() returns trigger
language plpgsql as $$
begin
  if new.status in ('received', 'confirmed') and old.status not in ('received', 'confirmed')
     and new.net_amount_cents is not null and new.amount_cents > new.net_amount_cents then
    insert into financial_transactions (property_id, booking_id, payment_id, type, category, description, amount_cents, occurred_on, paid_on)
    select b.property_id, b.id, new.id, 'expense', 'taxa_gateway', 'Taxa ' || new.gateway || ' ' || b.code,
           new.amount_cents - new.net_amount_cents, current_date, current_date
    from bookings b where b.id = new.booking_id;
  end if;
  return new;
end $$;

create trigger trg_ledger_payment
after update of status on payments
for each row execute function ledger_on_payment_received();

-- DRE mensal simplificado
create or replace view v_dre_monthly as
select
  property_id,
  date_trunc('month', occurred_on)::date as month,
  sum(amount_cents) filter (where type = 'income')                       as receita_bruta_cents,
  sum(amount_cents) filter (where type = 'refund')                       as estornos_cents,
  sum(amount_cents) filter (where type = 'expense' and category in ('taxa_gateway','comissao_canal','impostos')) as deducoes_cents,
  sum(amount_cents) filter (where type = 'expense' and category not in ('taxa_gateway','comissao_canal','impostos')) as despesas_operacionais_cents,
  coalesce(sum(amount_cents) filter (where type = 'income'), 0)
  - coalesce(sum(amount_cents) filter (where type in ('expense', 'refund')), 0) as lucro_liquido_cents
from financial_transactions
group by 1, 2;

-- Ocupação mensal (noites vendidas / noites do mês; eventos contam como 1 dia)
create or replace view v_occupancy_monthly as
with months as (
  select p.id as property_id, gs::date as month
  from properties p,
       generate_series(date_trunc('month', now()) - interval '12 months',
                       date_trunc('month', now()) + interval '12 months', interval '1 month') gs
),
days as (
  select b.property_id, d::date as day, b.mode
  from bookings b,
       generate_series(b.start_date, greatest(b.end_date - 1, b.start_date), interval '1 day') d
  where b.status in ('confirmed', 'checked_in', 'completed')
)
select m.property_id, m.month,
       (date_trunc('month', m.month) + interval '1 month')::date - m.month as days_in_month,
       count(distinct d.day) filter (where d.mode = 'stay')  as nights_sold,
       count(distinct d.day) filter (where d.mode = 'event') as event_days,
       round(100.0 * count(distinct d.day)
             / ((date_trunc('month', m.month) + interval '1 month')::date - m.month), 1) as occupancy_pct
from months m
left join days d on d.property_id = m.property_id
                and d.day >= m.month and d.day < (m.month + interval '1 month')
group by 1, 2;

-- ---------------------------------------------------------------------
-- MENSAGENS / iCal
-- ---------------------------------------------------------------------
create table message_templates (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references properties(id) on delete cascade,
  key          text not null,                      -- confirmacao, comprovante, checkin, localizacao, guia
  mode         override_scope not null default 'both',
  channel      text not null default 'whatsapp',
  body         text not null,                      -- com {{placeholders}}
  unique (property_id, key, mode, channel)
);

create table ical_feeds (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references properties(id) on delete cascade,
  channel        booking_source not null,
  import_url     text,                             -- iCal do Airbnb/Booking → occupancy(kind='ical_import')
  export_token   text unique not null default encode(gen_random_bytes(16), 'hex'), -- /api/ical/{token}.ics
  last_synced_at timestamptz,
  last_error     text
);

-- ---------------------------------------------------------------------
-- RPC: cria reserva de forma atômica.
-- O preço é calculado no servidor (Next.js) e passado aqui; a EXCLUDE
-- constraint garante que ninguém pegue a mesma data em paralelo.
-- ---------------------------------------------------------------------
create or replace function create_booking(
  p_property_id uuid, p_guest jsonb, p_mode booking_mode,
  p_start_date date, p_end_date date, p_starts_at timestamptz, p_ends_at timestamptz,
  p_guests_count int, p_event_type text, p_quote jsonb, p_source booking_source default 'website'
) returns bookings
language plpgsql security definer set search_path = public as $$
declare
  v_guest_id uuid;
  v_booking  bookings;
  v_hold     int;
begin
  insert into guests (full_name, document_type, document_number, email, phone,
                      address_street, address_number, address_district, address_city, address_state, address_zip)
  values (p_guest->>'full_name', p_guest->>'document_type', p_guest->>'document_number',
          p_guest->>'email', p_guest->>'phone', p_guest->>'address_street', p_guest->>'address_number',
          p_guest->>'address_district', p_guest->>'address_city', p_guest->>'address_state', p_guest->>'address_zip')
  on conflict (document_type, document_number) do update
    set full_name = excluded.full_name, email = excluded.email, phone = excluded.phone
  returning id into v_guest_id;

  select hold_minutes into v_hold from properties where id = p_property_id;

  insert into bookings (property_id, guest_id, mode, status, source, start_date, end_date,
                        starts_at, ends_at, guests_count, event_type,
                        subtotal_cents, cleaning_fee_cents, extra_guests_cents, discount_cents,
                        total_cents, security_deposit_cents, amount_due_now_cents,
                        deposit_status, price_breakdown, expires_at)
  values (p_property_id, v_guest_id, p_mode, 'pending_payment', p_source, p_start_date, p_end_date,
          p_starts_at, p_ends_at, p_guests_count, p_event_type,
          (p_quote->>'subtotalCents')::int, (p_quote->>'cleaningFeeCents')::int,
          (p_quote->>'extraGuestsCents')::int, coalesce((p_quote->>'discountCents')::int, 0),
          (p_quote->>'totalCents')::int, (p_quote->>'securityDepositCents')::int,
          (p_quote->>'amountDueNowCents')::int,
          case when (p_quote->>'securityDepositCents')::int > 0 then 'pending' else 'not_required' end::deposit_status,
          coalesce(p_quote->'lines', '[]'::jsonb), now() + make_interval(mins => v_hold))
  returning * into v_booking;

  return v_booking;
exception
  when exclusion_violation then
    raise exception 'DATES_UNAVAILABLE' using errcode = 'P0001';
end $$;

-- ---------------------------------------------------------------------
-- RLS — público só lê o necessário; admin faz tudo; escrita pública via RPC/API
-- ---------------------------------------------------------------------
alter table properties             enable row level security;
alter table property_photos        enable row level security;
alter table amenities              enable row level security;
alter table pricing_rules          enable row level security;
alter table calendar_pricing       enable row level security;
alter table guests                 enable row level security;
alter table bookings               enable row level security;
alter table occupancy              enable row level security;
alter table payments               enable row level security;
alter table webhook_events         enable row level security;
alter table contract_templates     enable row level security;
alter table contracts              enable row level security;
alter table financial_transactions enable row level security;
alter table message_templates      enable row level security;
alter table ical_feeds             enable row level security;
alter table admin_users            enable row level security;

-- Leitura pública (vitrine + calendário sem dados pessoais)
create policy pub_read on properties       for select using (is_active);
create policy pub_read on property_photos  for select using (true);
create policy pub_read on amenities        for select using (true);
create policy pub_read on pricing_rules    for select using (true);
create policy pub_read on calendar_pricing for select using (true);
create policy pub_read on occupancy        for select using (active);

-- Admin: acesso total
do $$
declare t text;
begin
  foreach t in array array['properties','property_photos','amenities','pricing_rules','calendar_pricing',
    'guests','bookings','occupancy','payments','webhook_events','contract_templates','contracts',
    'financial_transactions','message_templates','ical_feeds','admin_users']
  loop
    execute format('create policy admin_all on %I for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- SEED — o imóvel UaiCasa
-- ---------------------------------------------------------------------
with p as (
  insert into properties (slug, name, description, address_line, neighborhood, city, state,
                          max_guests_stay, bedrooms, bathrooms, max_guests_event, event_min_lead_days)
  values ('uaicasa', 'UaiCasa',
          'Casa com piscina, espaço gourmet, campo de futebol e vista para as montanhas.',
          'Rua João Paulo II, nº 2', 'Colônia do Marçal', 'São João del-Rei', 'MG',
          12, 4, 4, 80, 7)
  returning id
)
insert into pricing_rules (property_id, mode, base_price_cents, weekend_price_cents, cleaning_fee_cents,
                           security_deposit_cents, included_guests, extra_guest_fee_cents, extra_hour_fee_cents,
                           deposit_percent_due_now)
select id, 'stay'::booking_mode,  90000, 120000, 25000, 50000, 8, 5000, 0, 50 from p
union all
select id, 'event'::booking_mode, 150000, 220000, 35000, 100000, 50, 2500, 15000, 50 from p;
