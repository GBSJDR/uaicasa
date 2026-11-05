import { describe, expect, it } from 'vitest';
import { quote, priceForDate } from './pricing';
import { dailyAvailability, holdFor, isAvailable } from './availability';
import { OVERRIDES, PROPERTY, RULES } from '../data/demo';
import type { Hold, PricingContext } from './types';

const ctx = (holds: Hold[] = [], today = '2026-11-05'): PricingContext => ({
  property: PROPERTY, rules: RULES, overrides: OVERRIDES, holds, today,
});

describe('Pricing Engine', () => {
  it('cobra tarifa base em dia útil e tarifa de fim de semana em sex/sáb', () => {
    // 2026-11-16 seg → 2026-11-18 qua (2 noites úteis)
    const q = quote({ mode: 'stay', checkIn: '2026-11-16', checkOut: '2026-11-18', guests: 4 }, ctx());
    expect(q.ok).toBe(true);
    expect(q.subtotalCents).toBe(180_000);
    expect(q.cleaningFeeCents).toBe(25_000);
    expect(q.totalCents).toBe(205_000);
    expect(q.securityDepositCents).toBe(50_000);
    expect(q.amountDueNowCents).toBe(102_500);

    // sex 20/11 + sáb 21/11 = 2 × 1.200
    const w = quote({ mode: 'stay', checkIn: '2026-11-20', checkOut: '2026-11-22', guests: 4 }, ctx());
    expect(w.subtotalCents).toBe(240_000);
  });

  it('cobra hóspede excedente por noite', () => {
    const q = quote({ mode: 'stay', checkIn: '2026-11-16', checkOut: '2026-11-18', guests: 10 }, ctx());
    expect(q.extraGuestsCents).toBe(2 * 5_000 * 2);
  });

  it('aplica sobrescrita de Carnaval com pacote mínimo de 4 noites', () => {
    const q = quote({ mode: 'stay', checkIn: '2027-02-05', checkOut: '2027-02-07', guests: 6 }, ctx());
    expect(q.ok).toBe(false);
    expect(q.errors.map((e) => e.code)).toContain('MIN_NIGHTS');
    expect(q.minNights).toBe(4);
    const ok = quote({ mode: 'stay', checkIn: '2027-02-05', checkOut: '2027-02-09', guests: 6 }, ctx());
    expect(ok.ok).toBe(true);
    expect(ok.subtotalCents).toBe(4 * 250_000);
    expect(ok.lines[0].overrideLabel).toBe('Carnaval SJDR');
  });

  it('multiplicador respeita fim de semana (Tiradentes cai numa quarta)', () => {
    expect(priceForDate('2027-04-21', 'stay', ctx()).amountCents).toBe(Math.round(90_000 * 1.3));
    expect(priceForDate('2027-04-21', 'event', ctx()).amountCents).toBe(Math.round(150_000 * 1.3));
  });

  it('maior prioridade vence (Réveillon > Férias)', () => {
    expect(priceForDate('2027-01-02', 'stay', ctx()).override?.label).toBe('Réveillon');
    expect(priceForDate('2027-01-04', 'stay', ctx()).override?.label).toBe('Férias de janeiro');
  });

  it('evento: antecedência mínima, capacidade, excedentes e hora extra', () => {
    const tooSoon = quote({ mode: 'event', date: '2026-11-08', guests: 30 }, ctx());
    expect(tooSoon.errors.map((e) => e.code)).toContain('LEAD_TIME');

    const big = quote({ mode: 'event', date: '2026-11-21', guests: 90 }, ctx());
    expect(big.errors.map((e) => e.code)).toContain('MAX_GUESTS');

    const q = quote({ mode: 'event', date: '2026-11-21', guests: 60, extraHours: 2 }, ctx()); // sábado
    expect(q.ok).toBe(true);
    expect(q.subtotalCents).toBe(220_000 + 2 * 15_000);
    expect(q.extraGuestsCents).toBe(10 * 2_500);
    expect(q.totalCents).toBe(220_000 + 30_000 + 25_000 + 35_000);
  });

  it('bloqueia eventos no Réveillon', () => {
    const q = quote({ mode: 'event', date: '2026-12-31', guests: 30 }, ctx());
    expect(q.errors.map((e) => e.code)).toContain('EVENTS_NOT_ALLOWED');
  });

  it('rejeita data passada e check-out antes do check-in', () => {
    expect(quote({ mode: 'stay', checkIn: '2026-11-01', checkOut: '2026-11-03', guests: 2 }, ctx()).errors[0].code).toBe('PAST_DATE');
    expect(quote({ mode: 'stay', checkIn: '2026-11-20', checkOut: '2026-11-20', guests: 2 }, ctx()).errors[0].code).toBe('INVALID_DATES');
  });
});

describe('Calendar Engine — regra híbrida hospedagem × evento', () => {
  const stay = holdFor({ mode: 'stay', checkIn: '2026-12-10', checkOut: '2026-12-12', guests: 4 }, PROPERTY);

  it('não permite festa no dia do check-out (limpeza até 14h, preparo desde 7h)', () => {
    expect(isAvailable({ mode: 'event', date: '2026-12-12', guests: 30 }, PROPERTY, [stay])).toBe(false);
    expect(isAvailable({ mode: 'event', date: '2026-12-13', guests: 30 }, PROPERTY, [stay])).toBe(true);
  });

  it('não permite festa no dia do check-in (hóspede chega 14h, festa vai até 22h)', () => {
    expect(isAvailable({ mode: 'event', date: '2026-12-10', guests: 30 }, PROPERTY, [stay])).toBe(false);
  });

  it('check-in no mesmo dia do check-out de outro hóspede é permitido (11h + 3h = 14h)', () => {
    expect(isAvailable({ mode: 'stay', checkIn: '2026-12-12', checkOut: '2026-12-14', guests: 2 }, PROPERTY, [stay])).toBe(true);
  });

  it('após festa, hospedagem só no dia seguinte (12h de limpeza)', () => {
    const party = holdFor({ mode: 'event', date: '2026-12-19', guests: 50 }, PROPERTY);
    expect(isAvailable({ mode: 'stay', checkIn: '2026-12-19', checkOut: '2026-12-21', guests: 2 }, PROPERTY, [party])).toBe(false);
    expect(isAvailable({ mode: 'stay', checkIn: '2026-12-20', checkOut: '2026-12-22', guests: 2 }, PROPERTY, [party])).toBe(true);
    // hospedagem que termina no dia da festa: sai 11h, limpeza até 14h, preparo da festa desde 7h → conflito
    expect(isAvailable({ mode: 'stay', checkIn: '2026-12-17', checkOut: '2026-12-19', guests: 2 }, PROPERTY, [party])).toBe(false);
  });

  it('festa que vira a madrugada empurra a limpeza para o dia seguinte', () => {
    const late = { ...PROPERTY, eventEndTime: '02:00' };
    const party = holdFor({ mode: 'event', date: '2026-12-19', guests: 50 }, late);
    // termina 02h do dia 20 + 12h = 14h do dia 20 → check-in dia 20 às 14h OK (intervalo semiaberto)
    expect(isAvailable({ mode: 'stay', checkIn: '2026-12-20', checkOut: '2026-12-21', guests: 2 }, late, [party])).toBe(true);
    expect(isAvailable({ mode: 'event', date: '2026-12-20', guests: 50 }, late, [party])).toBe(false);
  });

  it('calendário diário marca corretamente', () => {
    const days = dailyAvailability('2026-12-09', '2026-12-14', PROPERTY, [stay]);
    const m = Object.fromEntries(days.map((d) => [d.date, d]));
    expect(m['2026-12-09'].nightFree).toBe(true);
    expect(m['2026-12-10'].nightFree).toBe(false);
    expect(m['2026-12-11'].nightFree).toBe(false);
    expect(m['2026-12-12'].nightFree).toBe(true);
    expect(m['2026-12-12'].eventFree).toBe(false);
    expect(m['2026-12-10'].canCheckOut).toBe(true); // quem chega dia 9 pode sair dia 10
    expect(m['2026-12-11'].canCheckOut).toBe(false);
  });

  it('cotação acusa indisponibilidade', () => {
    const q = quote({ mode: 'stay', checkIn: '2026-12-11', checkOut: '2026-12-14', guests: 2 }, ctx([stay]));
    expect(q.errors.map((e) => e.code)).toEqual(['UNAVAILABLE']);
  });
});
