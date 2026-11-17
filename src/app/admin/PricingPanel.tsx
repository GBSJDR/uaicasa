'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { OverrideRow, PricingAdmin, RuleRow, SettingsRow } from '@/lib/admin/pricing';
import { addOverride, deleteOverride, saveRule, saveSettings } from './pricingActions';
import { parseBR } from '@/lib/admin/parseBR';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const box = 'rounded-2xl bg-white p-5 ring-1 ring-areia';
const inp = 'focus-ring mt-1 w-full rounded-lg border border-pedra/60 px-3 py-2 text-sm';

const showBR = (v: number | null, money: boolean) =>
  v == null ? '' : money ? v.toLocaleString('pt-BR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) : String(v);

function Num({ label, value, onChange, step = '0.01', prefix, hint, optional }: {
  label: string; value: number | null; onChange: (v: number | null) => void; step?: string; prefix?: string; hint?: string; optional?: boolean;
}) {
  const money = step !== '1';
  const [txt, setTxt] = useState(showBR(value, money));
  const parsed = parseBR(txt);
  const invalid = Number.isNaN(parsed) || (!money && parsed != null && !Number.isInteger(parsed));
  return (
    <label className="block text-xs font-medium text-musgo">
      {label}
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-sm text-musgo">{prefix}</span>}
        <input
          type="text" inputMode={money ? 'decimal' : 'numeric'}
          value={txt} placeholder={optional ? '—' : undefined}
          onChange={(e) => {
            setTxt(e.target.value);
            const n = parseBR(e.target.value);
            onChange(n == null ? null : n);
          }}
          className={`${inp} ${prefix ? 'pl-9' : ''} ${invalid ? 'border-red-400 bg-red-50' : ''}`}
        />
      </div>
      {invalid ? <span className="mt-0.5 block text-[11px] font-normal text-red-700">Valor inválido</span> : hint && <span className="mt-0.5 block text-[11px] font-normal">{hint}</span>}
    </label>
  );
}

function RuleCard({ rule, onSave, pending }: { rule: RuleRow; onSave: (r: RuleRow) => void; pending: boolean }) {
  const [r, setR] = useState(rule);
  const set = (k: keyof RuleRow) => (v: number | null) => setR((x) => ({ ...x, [k]: v }));
  const stay = r.mode === 'stay';
  return (
    <section className={box}>
      <h3 className={`font-display text-lg ${stay ? 'text-serra-escuro' : 'text-terra'}`}>{stay ? '🛏️ Hospedagem' : '🎉 Eventos / Day use'}</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Num label={stay ? 'Diária (seg a qui)' : 'Evento (seg a sex)'} prefix="R$" value={r.base} onChange={set('base')} />
        <Num label={stay ? 'Diária sex e sáb' : 'Evento sáb e dom'} prefix="R$" value={r.weekend} onChange={set('weekend')} optional hint="Vazio = mesmo valor" />
        <Num label="Taxa de limpeza" prefix="R$" value={r.cleaning} onChange={set('cleaning')} />
        <Num label="Caução (reembolsável)" prefix="R$" value={r.deposit} onChange={set('deposit')} />
        <Num label={stay ? 'Hóspedes inclusos' : 'Convidados inclusos'} step="1" value={r.included} onChange={(v) => set('included')(v ?? 1)} />
        <Num label={stay ? 'Hóspede extra (por noite)' : 'Convidado extra'} prefix="R$" value={r.extraGuest} onChange={set('extraGuest')} />
        {!stay && <Num label="Hora extra" prefix="R$" value={r.extraHour} onChange={set('extraHour')} />}
        <Num label="Sinal no PIX (%)" step="1" value={r.percentNow} onChange={(v) => set('percentNow')(v ?? 50)} hint="Cobrado na reserva; o resto até a entrada" />
      </div>
      <button disabled={pending} onClick={() => onSave(r)} className={`mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${stay ? 'bg-serra' : 'bg-terra'}`}>
        {pending ? 'Salvando…' : `Salvar ${stay ? 'hospedagem' : 'eventos'}`}
      </button>
    </section>
  );
}

function SettingsCard({ settings, onSave, pending }: { settings: SettingsRow; onSave: (s: SettingsRow) => void; pending: boolean }) {
  const [s, setS] = useState(settings);
  const n = (k: keyof SettingsRow) => (v: number | null) => setS((x) => ({ ...x, [k]: v ?? 0 }));
  const t = (k: keyof SettingsRow, label: string) => (
    <label className="block text-xs font-medium text-musgo">
      {label}
      <input type="time" value={s[k] as string} onChange={(e) => setS((x) => ({ ...x, [k]: e.target.value }))} className={inp} />
    </label>
  );
  return (
    <section className={box}>
      <h3 className="font-display text-lg">🏡 Regras da casa</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Num label="Máx. hóspedes" step="1" value={s.maxGuestsStay} onChange={n('maxGuestsStay')} />
        <Num label="Máx. convidados (festa)" step="1" value={s.maxGuestsEvent} onChange={n('maxGuestsEvent')} />
        <Num label="Mínimo de diárias" step="1" value={s.defaultMinNights} onChange={n('defaultMinNights')} />
        <Num label="Antecedência p/ festa (dias)" step="1" value={s.eventMinLeadDays} onChange={n('eventMinLeadDays')} />
        {t('checkinTime', 'Check-in')}
        {t('checkoutTime', 'Check-out')}
        {t('eventStartTime', 'Festa começa')}
        {t('eventEndTime', 'Festa termina')}
        {t('loudMusicUntil', 'Som alto até')}
      </div>
      <button disabled={pending} onClick={() => onSave(s)} className="mt-4 w-full rounded-xl bg-tinta px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? 'Salvando…' : 'Salvar regras'}</button>
    </section>
  );
}

const EMPTY = { label: '', scope: 'stay' as 'stay' | 'event' | 'both', from: '', until: '', priceMode: 'fixed' as 'fixed' | 'percent' | 'none', price: null as number | null, percent: null as number | null, minNights: null as number | null, closedToArrival: false, eventsAllowed: true, priority: 10 };

export default function PricingPanel({ data, run, pending }: { data: PricingAdmin; run: (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, onOk?: () => void) => void; pending: boolean }) {
  const [f, setF] = useState<typeof EMPTY>(EMPTY);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const o: Omit<OverrideRow, 'id'> = {
      label: f.label, scope: f.scope, from: f.from, until: f.until || f.from,
      price: f.priceMode === 'fixed' ? f.price : null,
      multiplier: f.priceMode === 'percent' && f.percent != null ? Math.round((1 + f.percent / 100) * 100) / 100 : null,
      minNights: f.scope === 'event' ? null : f.minNights, closedToArrival: f.closedToArrival, eventsAllowed: f.eventsAllowed, priority: f.priority,
    };
    run(() => addOverride(data.settings.id, o), '✓ Data especial salva.', () => setF(EMPTY));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {data.rules.map((r) => <RuleCard key={r.id} rule={r} pending={pending} onSave={(x) => run(() => saveRule(x), '✓ Tarifas salvas — o site já usa os novos valores.')} />)}
        <SettingsCard settings={data.settings} pending={pending} onSave={(s) => run(() => saveSettings(s), '✓ Regras da casa salvas.')} />
      </div>

      <section className={box}>
        <h3 className="font-display text-lg">📅 Datas especiais</h3>
        <p className="text-xs text-musgo">Feriados, Carnaval, Semana Santa, festivais… Sobrescrevem a tarifa normal nesses dias.</p>

        <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl bg-creme p-4 sm:grid-cols-6">
          <label className="block text-xs font-medium text-musgo sm:col-span-2">Nome
            <input required value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Ex.: Carnaval 2027" className={inp} />
          </label>
          <label className="block text-xs font-medium text-musgo">De
            <input type="date" required value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={inp} />
          </label>
          <label className="block text-xs font-medium text-musgo">Até (inclusive)
            <input type="date" required value={f.until} min={f.from} onChange={(e) => setF({ ...f, until: e.target.value })} className={inp} />
          </label>
          <label className="block text-xs font-medium text-musgo sm:col-span-2">Vale para
            <select value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value as 'stay' | 'event' | 'both' })} className={inp}>
              <option value="stay">Hospedagem</option><option value="event">Eventos</option><option value="both">Hospedagem e eventos</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-musgo sm:col-span-2">Preço nesses dias
            <select value={f.priceMode} onChange={(e) => setF({ ...f, priceMode: e.target.value as 'fixed' | 'percent' | 'none' })} className={inp}>
              <option value="fixed">Valor fixo por diária/evento</option>
              <option value="percent">Acréscimo/desconto em %</option>
              <option value="none">Manter a tarifa normal</option>
            </select>
          </label>
          {f.priceMode === 'fixed' && <Num label="Valor" prefix="R$" value={f.price} onChange={(v) => setF({ ...f, price: v })} />}
          {f.priceMode === 'percent' && (
            <label className="block text-xs font-medium text-musgo">Ajuste (%)
              <input type="number" step="1" value={f.percent ?? ''} onChange={(e) => setF({ ...f, percent: e.target.value === '' ? null : Number(e.target.value) })} placeholder="30 ou -10" className={inp} />
            </label>
          )}
          {f.scope !== 'event' && <Num label="Mínimo de diárias" step="1" value={f.minNights} onChange={(v) => setF({ ...f, minNights: v })} optional />}
          <div className="flex flex-col justify-end gap-1 text-xs text-musgo sm:col-span-2">
            {f.scope !== 'event' && (
              <label className="flex items-center gap-2"><input type="checkbox" checked={f.closedToArrival} onChange={(e) => setF({ ...f, closedToArrival: e.target.checked })} /> Não permitir check-in nesses dias</label>
            )}
            {f.scope !== 'stay' && (
              <label className="flex items-center gap-2"><input type="checkbox" checked={!f.eventsAllowed} onChange={(e) => setF({ ...f, eventsAllowed: !e.target.checked })} /> Não alugar para festas nesses dias</label>
            )}
          </div>
          <button disabled={pending} className="rounded-xl bg-serra px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-6">{pending ? 'Salvando…' : '+ Adicionar data especial'}</button>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-musgo">
              <tr>{['Período', 'Nome', 'Vale para', 'Preço', 'Mín.', 'Regras', ''].map((h) => <th key={h} className="py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-areia">
              {data.overrides.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-musgo">Nenhuma data especial cadastrada.</td></tr>}
              {data.overrides.map((o) => (
                <tr key={o.id}>
                  <td className="whitespace-nowrap py-2">{fmt(o.from)}{o.until !== o.from && ` → ${fmt(o.until)}`}</td>
                  <td className="py-2">{o.label}</td>
                  <td className="py-2">{o.scope === 'stay' ? 'Hospedagem' : o.scope === 'event' ? 'Eventos' : 'Ambos'}</td>
                  <td className="py-2">{o.price != null ? brl(o.price) : o.multiplier != null ? `${o.multiplier >= 1 ? '+' : ''}${Math.round((o.multiplier - 1) * 100)}%` : '—'}</td>
                  <td className="py-2">{o.minNights ?? '—'}</td>
                  <td className="py-2 text-xs">{[o.closedToArrival && 'sem check-in', !o.eventsAllowed && 'sem festas'].filter(Boolean).join(', ') || '—'}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => confirm(`Excluir "${o.label}"?`) && run(() => deleteOverride(o.id), 'Data especial excluída.')} className="rounded-lg px-2 py-1 text-xs text-red-700 ring-1 ring-red-200">Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
