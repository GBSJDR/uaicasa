/**
 * PIX "copia e cola" (BR Code / EMV-MPM) com valor e identificador da reserva,
 * pagável a uma chave PIX comum (pessoa física), sem gateway e sem taxa.
 * Padrão: Manual de Padrões para Iniciação do Pix (BCB).
 */

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** Remove acentos e caracteres fora do padrão do BR Code */
const clean = (s: string, max: number) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .\-]/g, '').trim().slice(0, max);

export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface StaticPixInput {
  key: string; // CPF, e-mail, telefone (+55...) ou chave aleatória
  name: string; // nome do recebedor
  city: string;
  amountCents?: number;
  txid?: string; // até 25 caracteres alfanuméricos (ex.: código da reserva)
  description?: string;
}

export function buildPixPayload(i: StaticPixInput): string {
  const account =
    field('00', 'br.gov.bcb.pix') + field('01', i.key.trim()) + (i.description ? field('02', clean(i.description, 40)) : '');
  const txid = (i.txid ?? '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const body =
    field('00', '01') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986') +
    (i.amountCents ? field('54', (i.amountCents / 100).toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', clean(i.name, 25)) +
    field('60', clean(i.city, 15)) +
    field('62', field('05', txid)) +
    '6304';
  return body + crc16(body);
}

export function staticPixConfig() {
  const key = process.env.PIX_KEY;
  if (!key) return null;
  return { key, name: process.env.PIX_RECEIVER_NAME ?? 'UaiCasa', city: process.env.PIX_RECEIVER_CITY ?? 'Sao Joao del Rei' };
}
