/**
 * Calendar Engine — verificação de conflitos entre Hospedagem e Eventos.
 *
 * Modelo: cada reserva vira um INTERVALO REAL DE TEMPO [início, fim) acrescido
 * dos buffers de limpeza/preparação. Duas reservas conflitam se os intervalos
 * se sobrepõem. É exatamente a mesma regra da EXCLUDE constraint no Postgres
 * (tabela `occupancy`), então front, API e banco concordam sempre.
 *
 * Exemplo com a configuração padrão (check-in 14h, check-out 11h, festa 10h–22h,
 * 3h de preparo antes da festa, 12h de limpeza depois, 3h de limpeza após hospedagem):
 *   - Hospedagem sai dia 12 às 11h → ocupado até 14h  → festa dia 12 (preparo desde 7h) ✗
 *   - Festa dia 13 termina 22h     → ocupado até 10h do dia 14 → check-in dia 13 ✗, dia 14 ✓
 */
import { addDays, eachDay, localInstant, type ISODate } from './dates';
import type { BookingMode, BookingRequest, Hold, PropertyConfig } from './types';

const MIN = 60_000;

export interface Interval {
  start: number;
  end: number;
}

/** Horário real da reserva (sem buffers) */
export function bookingInterval(req: BookingRequest, p: PropertyConfig): Interval {
  if (req.mode === 'stay') {
    return {
      start: localInstant(req.checkIn, p.checkinTime),
      end: localInstant(req.checkOut, p.checkoutTime),
    };
  }
  const start = localInstant(req.date, p.eventStartTime);
  let end = localInstant(req.date, p.eventEndTime);
  if (end <= start) end = localInstant(addDays(req.date, 1), p.eventEndTime); // festa que vira a noite
  end += (req.extraHours ?? 0) * 60 * MIN;
  return { start, end };
}

/** Intervalo bloqueado no calendário (com buffers) — o que vai para `occupancy.period` */
export function occupiedPeriod(mode: BookingMode, iv: Interval, p: PropertyConfig): Interval {
  if (mode === 'stay') return { start: iv.start, end: iv.end + p.bufferAfterStayMin * MIN };
  return {
    start: iv.start - p.bufferBeforeEventMin * MIN,
    end: iv.end + p.bufferAfterEventMin * MIN,
  };
}

/** Sobreposição de intervalos semiabertos [a, b) */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function findConflicts(period: Interval, holds: Hold[]): Hold[] {
  return holds.filter((h) => overlaps(period, h));
}

export function isAvailable(req: BookingRequest, p: PropertyConfig, holds: Hold[]): boolean {
  const period = occupiedPeriod(req.mode, bookingInterval(req, p), p);
  return findConflicts(period, holds).length === 0;
}

export interface DayAvailability {
  date: ISODate;
  /** A noite que começa nesta data está livre (para hospedagem) */
  nightFree: boolean;
  /** É possível fazer check-in neste dia (noite livre e chegada permitida) */
  canCheckIn: boolean;
  /** É possível fazer check-out neste dia (a manhã está livre p/ quem chega na véspera) */
  canCheckOut: boolean;
  /** É possível fazer uma festa neste dia */
  eventFree: boolean;
}

/**
 * Disponibilidade dia a dia para o calendário público.
 * Avalia cada dia isoladamente com a mesma função de conflito.
 */
export function dailyAvailability(
  from: ISODate,
  to: ISODate,
  p: PropertyConfig,
  holds: Hold[],
): DayAvailability[] {
  return eachDay(from, to).map((date) => {
    const night = { mode: 'stay', checkIn: date, checkOut: addDays(date, 1), guests: 1 } as const;
    const nightFree = isAvailable(night, p, holds);
    // check-out em `date` é possível se a noite anterior estiver livre
    const prevNight = { ...night, checkIn: addDays(date, -1), checkOut: date };
    return {
      date,
      nightFree,
      canCheckIn: nightFree,
      canCheckOut: isAvailable(prevNight, p, holds),
      eventFree: isAvailable({ mode: 'event', date, guests: 1 }, p, holds),
    };
  });
}

/** Converte uma reserva em Hold (útil para simulações e seeds) */
export function holdFor(req: BookingRequest, p: PropertyConfig, label?: string): Hold {
  const per = occupiedPeriod(req.mode, bookingInterval(req, p), p);
  return { ...per, kind: 'booking', label };
}
