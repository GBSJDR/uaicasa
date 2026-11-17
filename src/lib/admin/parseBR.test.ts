import { describe, expect, it } from 'vitest';
import { parseBR } from './parseBR';

describe('valores em reais digitados', () => {
  it('aceita formatos brasileiros e com ponto', () => {
    expect(parseBR('1.200,50')).toBe(1200.5);
    expect(parseBR('1200,5')).toBe(1200.5);
    expect(parseBR('1200.50')).toBe(1200.5);
    expect(parseBR('1.200')).toBe(1200);
    expect(parseBR('R$ 900')).toBe(900);
    expect(parseBR('')).toBeNull();
    expect(Number.isNaN(parseBR('abc') as number)).toBe(true);
  });
});
