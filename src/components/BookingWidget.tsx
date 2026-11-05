'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AvailabilityCalendar, { type CalendarDay } from './AvailabilityCalendar';
import QuoteSummary from './QuoteSummary';
import { formatBR } from '@/lib/domain/dates';
import type { BookingMode, Quote } from '@/lib/domain/types';

interface AvailabilityResponse {
  today: string;
  days: CalendarDay[];
  property: { maxGuestsStay: number; maxGuestsEvent: number; eventMinLeadDays: number; eventStartTime: string; eventEndTime: string };
  rules: Record<BookingMode, { includedGuests: number }>;
}

export default function BookingWidget({ initialMode = 'stay' }: { initialMode?: BookingMode }) {
  const router = useRouter();
  const [mode, setMode] = useState<BookingMode>(initialMode);
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [guests, setGuests] = useState(4);
  const [extraHours, setExtraHours] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 8) + '01';
    const to = new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10);
    fetch(`/api/availability?from=${today}&to=${to}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  // troca de modalidade limpa seleção
  const switchMode = (m: BookingMode) => {
    setMode(m);
    setStart(null);
    setEnd(null);
    setQuote(null);
    setGuests(m === 'stay' ? 4 : 30);
  };

  const ready = mode === 'stay' ? !!(start && end) : !!start;
  const request = useMemo(
    () =>
      !ready
        ? null
        : mode === 'stay'
          ? { mode, checkIn: start, checkOut: end, guests }
          : { mode, date: start, guests, extraHours },
    [ready, mode, start, end, guests, extraHours],
  );

  useEffect(() => {
    if (!request) return setQuote(null);
    const ctrl = new AbortController();
    setLoadingQuote(true);
    fetch('/api/quote', { method: 'POST', body: JSON.stringify(request), signal: ctrl.signal })
      .then((r) => r.json())
      .then((q) => setQuote(q))
      .catch(() => {})
      .finally(() => setLoadingQuote(false));
    return () => ctrl.abort();
  }, [request]);

  const max = mode === 'stay' ? (data?.property.maxGuestsStay ?? 12) : (data?.property.maxGuestsEvent ?? 80);
  const included = data?.rules[mode].includedGuests;

  const goCheckout = () => {
    if (!request || !quote?.ok) return;
    const qs = new URLSearchParams(Object.entries(request).map(([k, v]) => [k, String(v)]));
    router.push(`/reservar?${qs}`);
  };

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-2xl shadow-serra-escuro/20 ring-1 ring-black/5">
      {/* Seletor de modalidade */}
      <div role="tablist" className="grid grid-cols-2 bg-areia p-1.5">
        {(
          [
            ['stay', 'Quero me Hospedar', 'Diárias para família e amigos'],
            ['event', 'Quero Alugar para Eventos/Festas', 'Day use para celebrações'],
          ] as const
        ).map(([m, title, sub]) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`focus-ring rounded-2xl px-3 py-3 text-left transition sm:px-4 ${
              mode === m ? 'bg-white shadow-sm' : 'text-musgo hover:text-tinta'
            }`}
          >
            <span className={`block text-sm font-semibold sm:text-base ${mode === m ? (m === 'stay' ? 'text-serra' : 'text-terra') : ''}`}>
              {m === 'stay' ? '🛏️ ' : '🎉 '}
              {title}
            </span>
            <span className="hidden text-xs text-musgo sm:block">{sub}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          {data ? (
            <AvailabilityCalendar
              mode={mode}
              days={data.days}
              start={start}
              end={end}
              onChange={(s, e) => {
                setStart(s);
                setEnd(e);
              }}
            />
          ) : (
            <div className="grid h-72 place-items-center text-sm text-musgo">Carregando disponibilidade…</div>
          )}
        </div>

        <div className="flex flex-col gap-4 lg:border-l lg:border-areia lg:pl-6">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-pedra/60 px-3 py-2">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-musgo">
                {mode === 'stay' ? 'Check-in' : 'Data'}
              </span>
              {start ? formatBR(start) : '—'}
            </div>
            <div className="rounded-xl border border-pedra/60 px-3 py-2">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-musgo">
                {mode === 'stay' ? 'Check-out' : 'Horário'}
              </span>
              {mode === 'stay' ? (end ? formatBR(end) : '—') : `${data?.property.eventStartTime ?? '10:00'}–${data?.property.eventEndTime ?? '22:00'}`}
            </div>
          </div>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-musgo">
              {mode === 'stay' ? 'Hóspedes' : 'Convidados'}
            </span>
            <div className="mt-1 flex items-center gap-3">
              <button type="button" className="focus-ring h-9 w-9 rounded-full border border-pedra text-lg" onClick={() => setGuests((g) => Math.max(1, g - (mode === 'event' ? 5 : 1)))} aria-label="Menos">−</button>
              <input
                type="number"
                min={1}
                max={max}
                value={guests}
                onChange={(e) => setGuests(Math.max(1, Math.min(max, +e.target.value || 1)))}
                className="focus-ring w-16 rounded-lg border border-pedra/60 py-1 text-center"
              />
              <button type="button" className="focus-ring h-9 w-9 rounded-full border border-pedra text-lg" onClick={() => setGuests((g) => Math.min(max, g + (mode === 'event' ? 5 : 1)))} aria-label="Mais">+</button>
              <span className="text-xs text-musgo">máx. {max}{included ? ` • ${included} inclusos` : ''}</span>
            </div>
          </label>

          {mode === 'event' && (
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-musgo">Horas extras</span>
              <select value={extraHours} onChange={(e) => setExtraHours(+e.target.value)} className="focus-ring mt-1 w-full rounded-lg border border-pedra/60 px-3 py-2 text-sm">
                {[0, 1, 2, 3].map((h) => (
                  <option key={h} value={h}>{h === 0 ? 'Sem hora extra' : `+${h}h (até ${22 + h}h)`}</option>
                ))}
              </select>
            </label>
          )}

          <div className="min-h-32">
            {quote ? (
              quote.ok ? (
                <QuoteSummary q={quote} />
              ) : (
                <ul className="space-y-1 rounded-xl bg-terra/10 p-3 text-sm text-terra-escuro">
                  {quote.errors.map((e) => <li key={e.code}>• {e.message}</li>)}
                </ul>
              )
            ) : (
              <p className="text-sm text-musgo">
                {loadingQuote
                  ? 'Calculando…'
                  : mode === 'stay'
                    ? 'Selecione as datas para ver o valor total, sem surpresas.'
                    : `Festas com no mínimo ${data?.property.eventMinLeadDays ?? 7} dias de antecedência. Selecione o dia.`}
              </p>
            )}
          </div>

          <div className="mt-auto flex gap-2">
            {start && (
              <button type="button" onClick={() => { setStart(null); setEnd(null); }} className="focus-ring rounded-xl px-4 py-3 text-sm text-musgo hover:bg-areia">
                Limpar
              </button>
            )}
            <button
              type="button"
              disabled={!quote?.ok || loadingQuote}
              onClick={goCheckout}
              className={`focus-ring flex-1 rounded-xl px-5 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
                mode === 'stay' ? 'bg-serra hover:bg-serra-escuro' : 'bg-terra hover:bg-terra-escuro'
              }`}
            >
              {mode === 'stay' ? 'Reservar hospedagem' : 'Reservar o espaço'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
