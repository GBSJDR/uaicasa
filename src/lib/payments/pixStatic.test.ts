import { describe, expect, it } from 'vitest';
import { buildPixPayload, crc16 } from './pixStatic';

describe('PIX copia e cola', () => {
  it('confere com o exemplo oficial do Banco Central', () => {
    const ex = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
    expect(crc16(ex)).toBe('1D3D');
    expect(buildPixPayload({ key: '123e4567-e12b-12d1-a456-426655440000', name: 'Fulano de Tal', city: 'BRASILIA' })).toBe(ex + '1D3D');
  });
  it('inclui valor, txid e remove acentos', () => {
    const p = buildPixPayload({ key: 'a@b.com', name: 'João Ávila', city: 'São João del-Rei', amountCents: 102500, txid: 'AB12-CD34' });
    expect(p).toContain('54071025.00');
    expect(p).toContain('5910Joao Avila');
    expect(p).toContain('6015Sao Joao del-Re');
    expect(p).toContain('62120508AB12CD34');
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });
});
