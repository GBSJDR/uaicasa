/** Conversão dos tipos range do Postgres (como chegam pela API do Supabase). */

/** '2027-01-10 17:00:00+00' → epoch ms. O Postgres omite os minutos do fuso ("+00", "-03"). */
export function parsePgTimestamp(s: string): number {
  const iso = s.trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`Timestamp inválido: ${s}`);
  return t;
}

/** '["2027-01-10 17:00:00+00","2027-01-12 17:00:00+00")' → { start, end } */
export function parseTstzRange(r: string): { start: number; end: number } {
  const [a, b] = r.slice(1, -1).split(',').map((s) => s.replaceAll('"', ''));
  return { start: parsePgTimestamp(a), end: parsePgTimestamp(b) };
}

/** '[2026-12-23,2026-12-27)' → { from, to } (to exclusivo, forma canônica do daterange) */
export function parseDateRange(r: string): { from: string; to: string } {
  const [from, to] = r.slice(1, -1).split(',').map((s) => s.trim());
  return { from, to };
}
