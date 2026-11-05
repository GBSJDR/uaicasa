import { describe, expect, it } from 'vitest';
import { parseDateRange, parsePgTimestamp, parseTstzRange } from './pgRange';

describe('ranges do Postgres', () => {
  it('entende fuso sem minutos (+00 / -03) e com frações', () => {
    expect(parsePgTimestamp('2027-01-10 17:00:00+00')).toBe(Date.parse('2027-01-10T17:00:00Z'));
    expect(parsePgTimestamp('2027-01-10 14:00:00-03')).toBe(Date.parse('2027-01-10T17:00:00Z'));
    expect(parsePgTimestamp('2027-01-10 17:00:00.123+00')).toBe(Date.parse('2027-01-10T17:00:00.123Z'));
    expect(parsePgTimestamp('2027-01-10 17:00:00+05:30')).toBe(Date.parse('2027-01-10T11:30:00Z'));
  });
  it('lê tstzrange e daterange', () => {
    expect(parseTstzRange('["2027-01-10 17:00:00+00","2027-01-12 17:00:00+00")')).toEqual({
      start: Date.parse('2027-01-10T17:00:00Z'),
      end: Date.parse('2027-01-12T17:00:00Z'),
    });
    expect(parseDateRange('[2026-12-23,2026-12-27)')).toEqual({ from: '2026-12-23', to: '2026-12-27' });
  });
});
