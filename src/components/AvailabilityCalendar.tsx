'use client';

import { useMemo, useState } from 'react';
import type { BookingMode } from '@/lib/domain/types';

export interface CalendarDay {
  date: string;
  past: boolean;
  nightFree: boolean;
  canCheckOut: boolean;
  eventFree: boolean;
  stayPriceCents: number;
  eventPriceCents: number;
  label: string | null;
}

interface Props {
  mode: BookingMode;
  days: CalendarDay[];
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
  months?: number;
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const compact = (c: number) =>
  c >= 100_000 ? `${(c / 100_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : `${Math.round(c / 100)}`;

function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const daysIn = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(first.getUTCDay()).fill(null);
  for (let d = 1; d <= daysIn; d++)
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  return cells;
}

export default function AvailabilityCalendar({ mode, days, start, end, onChange, months = 2 }: Props) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const firstDate = days[0]?.date ?? new Date().toISOString().slice(0, 10);
  const [offset, setOffset] = useState(0);
  const [hover, setHover] = useState<string | null>(null);

  const baseY = +firstDate.slice(0, 4);
  const baseM = +firstDate.slice(5, 7) - 1 + offset;
  const shown = Array.from({ length: months }, (_, i) => {
    const m = baseM + i;
    return { year: baseY + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
  });
  const lastDate = days[days.length - 1]?.date ?? firstDate;
  const canNext = (() => {
    const s = shown[shown.length - 1];
    return `${s.year}-${String(s.month + 1).padStart(2, '0')}-31` < lastDate;
  })();

  /** Check-out válido: todas as noites entre start e d livres */
  const validCheckout = (d: string) => {
    if (!start || d <= start) return false;
    for (const day of days) {
      if (day.date < start) continue;
      if (day.date >= d) break;
      if (!day.nightFree) return false;
    }
    return byDate.get(d)?.canCheckOut ?? false;
  };

  const selectingCheckout = mode === 'stay' && start && !end;

  const isEnabled = (d: string) => {
    const info = byDate.get(d);
    if (!info || info.past) return false;
    if (mode === 'event') return info.eventFree;
    if (selectingCheckout) return validCheckout(d) || (info.nightFree && d < start!);
    return info.nightFree;
  };

  const click = (d: string) => {
    if (!isEnabled(d)) return;
    if (mode === 'event') return onChange(d, d);
    if (selectingCheckout && d > start!) return onChange(start, d);
    onChange(d, null);
  };

  const rangeEnd = end ?? (selectingCheckout && hover && validCheckout(hover) ? hover : null);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
          disabled={offset === 0}
          className="focus-ring rounded-full p-2 text-serra hover:bg-areia disabled:opacity-30"
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <p className="text-sm text-musgo">
          {mode === 'stay'
            ? selectingCheckout
              ? 'Agora escolha o check-out'
              : 'Escolha o check-in'
            : 'Escolha o dia da festa'}
        </p>
        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          disabled={!canNext}
          className="focus-ring rounded-full p-2 text-serra hover:bg-areia disabled:opacity-30"
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>

      <div className={`grid gap-6 ${months > 1 ? 'md:grid-cols-2' : ''}`}>
        {shown.map(({ year, month }, idx) => (
          <div key={`${year}-${month}`} className={idx > 0 ? 'hidden md:block' : ''}>
            <p className="mb-2 text-center font-display text-lg text-serra-escuro">
              {MONTHS[month]} {year}
            </p>
            <div className="grid grid-cols-7 text-center text-[11px] font-medium text-musgo">
              {WD.map((w, i) => (
                <span key={i} className="py-1">{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1" onMouseLeave={() => setHover(null)}>
              {monthGrid(year, month).map((d, i) => {
                if (!d) return <span key={i} />;
                const info = byDate.get(d);
                const enabled = isEnabled(d);
                const isStart = d === start;
                const isEnd = d === (end ?? (mode === 'event' ? start : null));
                const inRange = start && rangeEnd && d > start && d < rangeEnd;
                const special = info?.label;
                const price = info ? (mode === 'stay' ? info.stayPriceCents : info.eventPriceCents) : 0;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => click(d)}
                    onMouseEnter={() => setHover(d)}
                    disabled={!enabled}
                    title={special ?? undefined}
                    aria-label={`${d}${enabled ? '' : ' indisponível'}`}
                    aria-pressed={isStart || isEnd}
                    className={[
                      'focus-ring relative flex h-12 flex-col items-center justify-center text-sm transition',
                      inRange ? 'bg-serra/10' : '',
                      isStart || isEnd
                        ? 'z-10 rounded-xl bg-serra font-semibold text-white'
                        : enabled
                          ? 'rounded-xl hover:bg-areia'
                          : 'cursor-not-allowed text-tinta/25 line-through decoration-tinta/20',
                    ].join(' ')}
                  >
                    <span>{+d.slice(8)}</span>
                    {enabled && info && (
                      <span className={`text-[9px] leading-none ${isStart || isEnd ? 'text-white/80' : special ? 'text-terra' : 'text-musgo'}`}>
                        {compact(price)}
                      </span>
                    )}
                    {special && enabled && !isStart && !isEnd && (
                      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-terra" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-musgo">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-terra" /> data especial</span>
        <span className="line-through">12</span><span>indisponível (reservado, limpeza ou preparo)</span>
      </div>
    </div>
  );
}
