/**
 * Datas civis como string ISO 'YYYY-MM-DD' (sem fuso) e instantes como epoch ms.
 * São João del-Rei usa America/Sao_Paulo, que não tem horário de verão desde 2019,
 * então o offset fixo -03:00 é seguro e evita dependência de libs de timezone.
 */
export type ISODate = string; // 'YYYY-MM-DD'
export type HHMM = string; // '14:00'

export const SP_OFFSET = '-03:00';
const DAY_MS = 86_400_000;

export function parseDate(d: ISODate): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`Data inválida: ${d}`);
  const t = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  if (Number.isNaN(t) || formatDate(t) !== d) throw new Error(`Data inválida: ${d}`);
  return t;
}

export function formatDate(utcMs: number): ISODate {
  return new Date(utcMs).toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  return formatDate(parseDate(d) + n * DAY_MS);
}

export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((parseDate(to) - parseDate(from)) / DAY_MS);
}

/** 0 = domingo … 6 = sábado */
export function weekday(d: ISODate): number {
  return new Date(parseDate(d)).getUTCDay();
}

/** Lista de datas [from, to) */
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Instante (epoch ms) de uma data + hora local de São João del-Rei */
export function localInstant(d: ISODate, time: HHMM): number {
  return Date.parse(`${d}T${time}:00${SP_OFFSET}`);
}

/** "Hoje" no fuso de São Paulo */
export function todayInSaoPaulo(now = new Date()): ISODate {
  return formatDate(now.getTime() - 3 * 3_600_000);
}

export function formatBR(d: ISODate): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}
