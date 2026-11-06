'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addExpense, addManualBooking, cancelBooking, registerPayment } from './actions';
import type { AdminBooking } from '@/lib/admin/data';
import { Logo } from '@/components/SiteHeader';
import type { DemoExpense } from '@/lib/data/demo';
import { dailyAvailability } from '@/lib/domain/availability';
import { addDays, formatBR, type ISODate } from '@/lib/domain/dates';
import { brl } from '@/lib/domain/pricing';
import type { DateOverride, Hold, PropertyConfig } from '@/lib/domain/types';
import { TEMPLATE_LABELS, renderTemplate, waLink, type TemplateKey } from '@/lib/messages/whatsapp';

interface Props {
  live: boolean;
  userName: string;
  today: ISODate;
  property: PropertyConfig;
  bookings: AdminBooking[];
  expenses: DemoExpense[];
  holds: Hold[];
  overrides: DateOverride[];
}

const TABS = ['Visão geral', 'Reservas', 'Calendário', 'Financeiro', 'Preços'] as const;

const STATUS: Record<AdminBooking['status'], [string, string]> = {
  expired: ['Expirada', 'bg-slate-100 text-slate-500'],
  checked_in: ['Hospedado', 'bg-sky-100 text-sky-800'],
  no_show: ['Não compareceu', 'bg-red-100 text-red-700'],
  pending_payment: ['Aguardando PIX', 'bg-amber-100 text-amber-800'],
  confirmed: ['Confirmada', 'bg-emerald-100 text-emerald-800'],
  completed: ['Concluída', 'bg-slate-100 text-slate-700'],
  cancelled: ['Cancelada', 'bg-red-100 text-red-700'],
};

const CATEGORY_LABEL: Record<string, string> = {
  energia: 'Energia', agua: 'Água', piscina: 'Piscina', limpeza: 'Limpeza', manutencao: 'Manutenção',
  taxa_gateway: 'Taxa gateway', internet: 'Internet', outras_despesas: 'Outras',
};

function Kpi({ label, value, hint, tone = 'serra' }: { label: string; value: string; hint?: string; tone?: 'serra' | 'terra' }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-areia">
      <p className="text-xs font-medium uppercase tracking-wide text-musgo">{label}</p>
      <p className={`mt-1 font-display text-2xl ${tone === 'serra' ? 'text-serra-escuro' : 'text-terra'}`}>{value}</p>
      {hint && <p className="text-xs text-musgo">{hint}</p>}
    </div>
  );
}

export default function AdminDashboard({ live, userName, today, property, bookings: initial, expenses: initialExp, holds, overrides }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  /** Executa uma ação no servidor (modo real) e recarrega os dados. */
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    startTransition(async () => {
      const r = await fn();
      setFlash(r.ok ? okMsg : (r as { error: string }).error);
      if (r.ok) router.refresh();
    });
  const [tab, setTab] = useState<(typeof TABS)[number]>('Visão geral');
  const [localBookings, setBookings] = useState(initial);
  const bookings = live ? initial : localBookings;
  const [localExpenses, setExpenses] = useState(initialExp);
  const expenses = live ? initialExp : localExpenses;
  const [msgFor, setMsgFor] = useState<AdminBooking | null>(null);
  const [tpl, setTpl] = useState<TemplateKey>('confirmacao');
  const [showNew, setShowNew] = useState(false);

  // ---- métricas ----
  const active = bookings.filter((b) => b.status === 'confirmed' || b.status === 'completed');
  const revenue = active.reduce((s, b) => s + b.paidCents, 0);
  const booked = active.reduce((s, b) => s + b.totalCents, 0);
  const costs = expenses.reduce((s, e) => s + e.amountCents, 0);
  const days30 = dailyAvailability(addDays(today, -15), addDays(today, 15), property, holds);
  const occupancy = Math.round((100 * days30.filter((d) => !d.nightFree).length) / days30.length);
  const receivable = bookings.filter((b) => b.status === 'confirmed').reduce((s, b) => s + b.totalCents - b.paidCents, 0);

  const msgVars = (b: AdminBooking) => ({
    nome: b.guest.split(' ')[0],
    codigo: b.code,
    modalidade: b.mode,
    entrada: formatBR(b.start),
    saida: formatBR(b.end),
    pessoas: b.guests,
    total: brl(b.totalCents),
    pago: brl(b.paidCents),
    saldo: brl(b.totalCents - b.paidCents),
  });

  // ---- calendário (próximos 35 dias) ----
  const calendar = useMemo(() => {
    const days = dailyAvailability(addDays(today, -3), addDays(today, 39), property, holds);
    return days.map((d) => {
      const b = bookings.find((x) => x.status !== 'cancelled' && (x.mode === 'event' ? x.start === d.date : d.date >= x.start && d.date < x.end));
      return { ...d, booking: b };
    });
  }, [today, property, holds, bookings]);

  return (
    <div className="min-h-screen bg-creme">
      <header className="border-b border-areia bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full bg-areia px-2 py-0.5 text-xs text-musgo">Painel</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-musgo">
            <span className="hidden sm:block">{live ? `Olá, ${userName.split(' ')[0]}` : 'Protótipo • dados de demonstração'}</span>
            {live && (
              <>
              <a href="/admin/senha" className="rounded-lg px-2 py-1 ring-1 ring-areia hover:bg-areia">Trocar senha</a>
              <form action="/auth/sair" method="post">
                <button className="rounded-lg px-2 py-1 ring-1 ring-areia hover:bg-areia">Sair</button>
              </form>
              </>
            )}
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === t ? 'border-serra font-semibold text-serra' : 'border-transparent text-musgo hover:text-tinta'}`}>
              {t}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {flash && (
          <div className="flex items-center justify-between rounded-xl bg-serra/10 px-4 py-2 text-sm text-serra-escuro">
            <span>{pending ? 'Salvando…' : flash}</span>
            <button onClick={() => setFlash(null)} aria-label="Fechar">×</button>
          </div>
        )}
        {tab === 'Visão geral' && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <Kpi label="Faturamento (recebido)" value={brl(revenue)} />
              <Kpi label="Vendido (contratos)" value={brl(booked)} />
              <Kpi label="A receber" value={brl(receivable)} hint="saldos de reservas confirmadas" tone="terra" />
              <Kpi label="Despesas (30d)" value={brl(costs)} tone="terra" />
              <Kpi label="Ocupação ±15 dias" value={`${occupancy}%`} hint="noites bloqueadas / total" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl bg-white p-5 ring-1 ring-areia">
                <h2 className="font-display text-lg">Próximas chegadas</h2>
                <ul className="mt-3 divide-y divide-areia">
                  {bookings.filter((b) => b.start >= today && b.status !== 'cancelled').sort((a, b) => a.start.localeCompare(b.start)).map((b) => (
                    <li key={b.code} className="flex items-center justify-between py-3 text-sm">
                      <span>
                        <span className="mr-2">{b.mode === 'stay' ? '🛏️' : '🎉'}</span>
                        <strong>{b.guest}</strong> <span className="text-musgo">• {formatBR(b.start)}</span>
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS[b.status][1]}`}>{STATUS[b.status][0]}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-2xl bg-white p-5 ring-1 ring-areia">
                <h2 className="font-display text-lg">Lucro do período</h2>
                <div className="mt-4 space-y-3">
                  {[['Receita recebida', revenue, 'bg-serra'], ['Despesas', costs, 'bg-terra']].map(([l, v, c]) => (
                    <div key={l as string}>
                      <div className="flex justify-between text-sm"><span>{l}</span><span>{brl(v as number)}</span></div>
                      <div className="mt-1 h-3 rounded-full bg-areia">
                        <div className={`h-3 rounded-full ${c}`} style={{ width: `${Math.min(100, ((v as number) / Math.max(revenue, costs, 1)) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                  <p className="border-t border-areia pt-3 font-display text-2xl text-serra-escuro">Lucro líquido: {brl(revenue - costs)}</p>
                </div>
              </section>
            </div>
          </>
        )}

        {tab === 'Reservas' && (
          <section className="rounded-2xl bg-white ring-1 ring-areia">
            <div className="flex items-center justify-between p-5">
              <h2 className="font-display text-lg">Reservas</h2>
              <button onClick={() => setShowNew((s) => !s)} className="rounded-xl bg-serra px-4 py-2 text-sm font-medium text-white">+ Reserva manual</button>
            </div>
            {showNew && (
              <form
                className="grid gap-3 border-t border-areia bg-creme p-5 sm:grid-cols-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const g = (k: string) => String(f.get(k) ?? '');
                  const mode = g('mode') as 'stay' | 'event';
                  const input = {
                    mode, guest: g('guest'), phone: g('phone'), document: g('document'), start: g('start'),
                    end: mode === 'event' ? g('start') : g('end'), guests: +g('guests'),
                    totalCents: Math.round(+g('total') * 100), paidCents: Math.round(+g('paid') * 100),
                  };
                  if (live) run(() => addManualBooking(input), 'Reserva criada.');
                  else
                    setBookings((bs) => [...bs, { ...input, code: Math.random().toString(36).slice(2, 10).toUpperCase(), status: 'confirmed', source: 'whatsapp' }]);
                  setShowNew(false);
                }}
              >
                <select name="mode" className="rounded-lg border border-pedra/60 px-2 py-2 text-sm"><option value="stay">Hospedagem</option><option value="event">Evento</option></select>
                <input name="guest" required placeholder="Nome" className="rounded-lg border border-pedra/60 px-2 py-2 text-sm sm:col-span-2" />
                <input name="phone" required placeholder="WhatsApp (32) 9…" className="rounded-lg border border-pedra/60 px-2 py-2 text-sm" />
                <input name="document" required={live} placeholder="CPF" className="rounded-lg border border-pedra/60 px-2 py-2 text-sm" />
                <input name="guests" type="number" min={1} required placeholder="Pessoas" className="rounded-lg border border-pedra/60 px-2 py-2 text-sm" />
                <input name="start" type="date" required className="rounded-lg border border-pedra/60 px-2 py-2 text-sm" />
                <input name="end" type="date" className="rounded-lg border border-pedra/60 px-2 py-2 text-sm" />
                <input name="total" type="number" step="0.01" required placeholder="Total R$" className="rounded-lg border border-pedra/60 px-2 py-2 text-sm" />
                <input name="paid" type="number" step="0.01" required placeholder="Pago R$" className="rounded-lg border border-pedra/60 px-2 py-2 text-sm" />
                <button className="rounded-lg bg-serra px-3 py-2 text-sm text-white sm:col-span-2">Salvar (venda via WhatsApp/presencial)</button>
                <p className="text-xs text-musgo sm:col-span-6">Em produção a reserva manual passa pela mesma RPC <code>create_booking</code> — o banco recusa se houver conflito.</p>
              </form>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-creme text-left text-xs uppercase tracking-wide text-musgo">
                  <tr>{['Código', 'Tipo', 'Locatário', 'Período', 'Pessoas', 'Total', 'Pago', 'Status', 'Origem', ''].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-areia">
                  {[...bookings].sort((a, b) => b.start.localeCompare(a.start)).map((b) => (
                    <tr key={b.code}>
                      <td className="px-4 py-3 font-mono text-xs">{b.code}</td>
                      <td className="px-4 py-3">{b.mode === 'stay' ? '🛏️ Hosp.' : '🎉 Evento'}</td>
                      <td className="px-4 py-3">{b.guest}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatBR(b.start)}{b.mode === 'stay' && ` → ${formatBR(b.end)}`}</td>
                      <td className="px-4 py-3">{b.guests}</td>
                      <td className="px-4 py-3">{brl(b.totalCents)}</td>
                      <td className="px-4 py-3">{brl(b.paidCents)}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS[b.status][1]}`}>{STATUS[b.status][0]}</span></td>
                      <td className="px-4 py-3 text-musgo">{b.source}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button onClick={() => setMsgFor(b)} className="mr-2 rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white">WhatsApp</button>
                        {(b.status === 'pending_payment' || (b.status === 'confirmed' && b.paidCents < b.totalCents)) && (
                          <button
                            onClick={() => {
                              const v = prompt(`Valor recebido de ${b.guest} (R$):`, ((b.totalCents - b.paidCents) / 200).toFixed(2));
                              const cents = Math.round(Number((v ?? '').replace(',', '.')) * 100);
                              if (!cents) return;
                              if (live && b.id) run(() => registerPayment(b.id!, cents), 'Pagamento registrado e reserva confirmada.');
                              else setBookings((bs) => bs.map((x) => (x.code === b.code ? { ...x, status: 'confirmed', paidCents: x.paidCents + cents } : x)));
                            }}
                            className="mr-2 rounded-lg bg-serra px-2 py-1 text-xs text-white"
                          >
                            Dar baixa
                          </button>
                        )}
                        {(b.status === 'pending_payment' || b.status === 'confirmed') && (
                          <button onClick={() => {
                              if (!confirm(`Cancelar ${b.code}?`)) return;
                              if (live && b.id) run(() => cancelBooking(b.id!), 'Reserva cancelada.');
                              else setBookings((bs) => bs.map((x) => (x.code === b.code ? { ...x, status: 'cancelled' } : x)));
                            }} className="rounded-lg px-2 py-1 text-xs text-red-700 ring-1 ring-red-200">Cancelar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'Calendário' && (
          <section className="rounded-2xl bg-white p-5 ring-1 ring-areia">
            <h2 className="font-display text-lg">Calendário unificado</h2>
            <p className="mb-4 text-xs text-musgo">Verde = livre p/ hospedagem • 🎉 livre p/ evento • cinza = bloqueio de limpeza/preparo ou manutenção</p>
            <div className="grid grid-cols-7 gap-1 text-xs">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => <div key={d} className="py-1 text-center font-medium text-musgo">{d}</div>)}
              {Array.from({ length: new Date(calendar[0].date + 'T12:00:00Z').getUTCDay() }).map((_, i) => <div key={`e${i}`} />)}
              {calendar.map((d) => (
                <div
                  key={d.date}
                  className={`min-h-20 rounded-lg p-1.5 ring-1 ${d.date < today ? 'opacity-40' : ''} ${d.date === today ? 'ring-2 ring-terra' : 'ring-areia'} ${
                    d.booking ? (d.booking.mode === 'stay' ? 'bg-serra/15' : 'bg-terra/15') : !d.nightFree ? 'bg-slate-100' : 'bg-emerald-50'
                  }`}
                >
                  <div className="flex justify-between"><span className="font-semibold">{+d.date.slice(8)}</span>{d.eventFree && d.date >= today && <span title="Livre para evento">🎉</span>}</div>
                  {d.booking && <p className="mt-1 truncate text-[10px] leading-tight">{d.booking.mode === 'stay' ? '🛏️' : '🎉'} {d.booking.guest}</p>}
                  {!d.booking && !d.nightFree && <p className="mt-1 text-[10px] text-musgo">bloqueado</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'Financeiro' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
            <section className="rounded-2xl bg-white p-5 ring-1 ring-areia">
              <h2 className="font-display text-lg">DRE simplificado (período)</h2>
              <table className="mt-3 w-full text-sm">
                <tbody className="divide-y divide-areia">
                  <tr><td className="py-2">Receita bruta (recebida)</td><td className="py-2 text-right">{brl(revenue)}</td></tr>
                  <tr><td className="py-2 pl-4 text-musgo">(−) Taxas de gateway</td><td className="py-2 text-right text-terra">{brl(expenses.filter((e) => e.category === 'taxa_gateway').reduce((s, e) => s + e.amountCents, 0))}</td></tr>
                  {Object.entries(expenses.filter((e) => e.category !== 'taxa_gateway').reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.category]: (acc[e.category] ?? 0) + e.amountCents }), {})).map(([c, v]) => (
                    <tr key={c}><td className="py-2 pl-4 text-musgo">(−) {CATEGORY_LABEL[c] ?? c}</td><td className="py-2 text-right text-terra">{brl(v)}</td></tr>
                  ))}
                  <tr className="font-semibold"><td className="py-3">Lucro líquido</td><td className="py-3 text-right text-serra-escuro">{brl(revenue - costs)}</td></tr>
                  <tr><td className="py-2 text-musgo">Margem</td><td className="py-2 text-right">{revenue ? Math.round(((revenue - costs) / revenue) * 100) : 0}%</td></tr>
                </tbody>
              </table>
            </section>
            <section className="rounded-2xl bg-white p-5 ring-1 ring-areia">
              <h2 className="font-display text-lg">Despesas</h2>
              <form
                className="mt-3 grid gap-2 sm:grid-cols-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const exp = { date: String(f.get('date')), category: String(f.get('category')), description: String(f.get('description')), amountCents: Math.round(+String(f.get('amount')) * 100) };
                  if (live) run(() => addExpense(exp), 'Despesa lançada.');
                  else setExpenses((x) => [exp, ...x]);
                  e.currentTarget.reset();
                }}
              >
                <input name="date" type="date" defaultValue={today} required className="rounded-lg border border-pedra/60 px-2 py-2 text-sm" />
                <select name="category" className="rounded-lg border border-pedra/60 px-2 py-2 text-sm">
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input name="description" required placeholder="Descrição" className="rounded-lg border border-pedra/60 px-2 py-2 text-sm" />
                <div className="flex gap-2">
                  <input name="amount" type="number" step="0.01" required placeholder="R$" className="w-full rounded-lg border border-pedra/60 px-2 py-2 text-sm" />
                  <button className="rounded-lg bg-terra px-3 text-sm text-white">+</button>
                </div>
              </form>
              <ul className="mt-4 divide-y divide-areia text-sm">
                {expenses.map((e, i) => (
                  <li key={i} className="flex justify-between py-2">
                    <span><span className="text-musgo">{formatBR(e.date)}</span> • {e.description} <span className="rounded bg-areia px-1.5 text-[10px]">{CATEGORY_LABEL[e.category] ?? e.category}</span></span>
                    <span className="text-terra">{brl(e.amountCents)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {tab === 'Preços' && (
          <section className="rounded-2xl bg-white p-5 ring-1 ring-areia">
            <h2 className="font-display text-lg">Datas especiais (sobrescritas)</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-musgo"><tr>{['Período', 'Nome', 'Aplica a', 'Preço', 'Mín. diárias', 'Eventos', 'Prioridade'].map((h) => <th key={h} className="py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-areia">
                  {overrides.map((o, i) => (
                    <tr key={i}>
                      <td className="py-2 whitespace-nowrap">{formatBR(o.from)} → {formatBR(addDays(o.to, -1))}</td>
                      <td className="py-2">{o.label}</td>
                      <td className="py-2">{o.scope === 'stay' ? 'Hospedagem' : o.scope === 'event' ? 'Eventos' : 'Ambos'}</td>
                      <td className="py-2">{o.priceCents != null ? brl(o.priceCents) : o.priceMultiplier ? `× ${o.priceMultiplier}` : '—'}</td>
                      <td className="py-2">{o.minNights ?? '—'}</td>
                      <td className="py-2">{o.eventsAllowed === false ? '🚫 bloqueado' : '✓'}</td>
                      <td className="py-2">{o.priority ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {msgFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setMsgFor(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg">Mensagem para {msgFor.guest}</h3>
            <select value={tpl} onChange={(e) => setTpl(e.target.value as TemplateKey)} className="mt-3 w-full rounded-lg border border-pedra/60 px-3 py-2 text-sm">
              {Object.entries(TEMPLATE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-creme p-3 font-sans text-sm">{renderTemplate(tpl, msgVars(msgFor))}</pre>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => navigator.clipboard.writeText(renderTemplate(tpl, msgVars(msgFor)))} className="rounded-lg px-3 py-2 text-sm ring-1 ring-areia">Copiar</button>
              <a href={waLink(msgFor.phone, renderTemplate(tpl, msgVars(msgFor)))} target="_blank" rel="noopener" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white">Abrir no WhatsApp</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
