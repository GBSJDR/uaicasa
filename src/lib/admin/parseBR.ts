/** Aceita 1.200,50 / 1200,5 / 1200.50 / 900 */
export function parseBR(txt: string): number | null {
  const t = txt.trim().replace(/[R$\s]/g, '');
  if (!t) return null;
  let norm = t;
  if (t.includes(',')) norm = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) norm = t.replace(/\./g, '');
  const n = Number(norm);
  return Number.isFinite(n) ? n : NaN;
}
