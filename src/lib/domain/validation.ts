import type { BookingRequest } from './types';

/** Valida e normaliza o corpo vindo do cliente (sem dependência externa). */
export function parseBookingRequest(b: any): BookingRequest | null {
  const guests = Number(b?.guests);
  const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!Number.isInteger(guests) || guests < 1 || guests > 500) return null;
  if (b?.mode === 'stay' && isDate(b.checkIn) && isDate(b.checkOut))
    return { mode: 'stay', checkIn: b.checkIn, checkOut: b.checkOut, guests };
  if (b?.mode === 'event' && isDate(b.date)) {
    const extraHours = Math.min(6, Math.max(0, Math.floor(Number(b.extraHours) || 0)));
    return { mode: 'event', date: b.date, guests, extraHours };
  }
  return null;
}

export const onlyDigits = (s: string) => (s ?? '').replace(/\D/g, '');

/** Validação de CPF (dígitos verificadores) */
export function isValidCPF(cpf: string): boolean {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    let s = 0;
    for (let i = 0; i < len; i++) s += +d[i] * (len + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === +d[9] && calc(10) === +d[10];
}

export function isValidCNPJ(cnpj: string): boolean {
  const d = onlyDigits(cnpj);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = w.reduce((acc, wi, i) => acc + wi * +d[i], 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === +d[12] && calc(13) === +d[13];
}
