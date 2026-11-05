/**
 * Dynamic Pricing Engine.
 *
 * Ordem de resolução do preço de cada noite (hospedagem) ou dia (evento):
 *   1. Sobrescrita por data (DateOverride) com maior `priority`; empate → a de
 *      menor intervalo (mais específica). Pode ter preço absoluto ou multiplicador.
 *   2. Tarifa de fim de semana (noites de sex/sáb para hospedagem; sáb/dom para eventos).
 *   3. Tarifa base da modalidade.
 *
 * Tudo em centavos (inteiros). Arredondamento só no multiplicador e no sinal.
 */
import { diffDays, eachDay, formatBR, parseDate, weekday, type ISODate } from './dates';
import { bookingInterval, findConflicts, occupiedPeriod } from './availability';
import type {
  BookingMode,
  BookingRequest,
  DateOverride,
  PricingContext,
  Quote,
  QuoteError,
  QuoteLine,
} from './types';

const WEEKDAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function overridesFor(date: ISODate, mode: BookingMode, list: DateOverride[]): DateOverride[] {
  return list
    .filter((o) => (o.scope === 'both' || o.scope === mode) && date >= o.from && date < o.to)
    .sort(
      (a, b) =>
        (b.priority ?? 0) - (a.priority ?? 0) ||
        diffDays(a.from, a.to) - diffDays(b.from, b.to),
    );
}

export function isWeekendRate(date: ISODate, mode: BookingMode): boolean {
  const wd = weekday(date);
  return mode === 'stay' ? wd === 5 || wd === 6 : wd === 6 || wd === 0;
}

/** Preço de uma noite/dia, já considerando sobrescritas */
export function priceForDate(
  date: ISODate,
  mode: BookingMode,
  ctx: Pick<PricingContext, 'rules' | 'overrides'>,
): { amountCents: number; override?: DateOverride } {
  const rule = ctx.rules[mode];
  const base =
    isWeekendRate(date, mode) && rule.weekendPriceCents != null
      ? rule.weekendPriceCents
      : rule.basePriceCents;
  const ov = overridesFor(date, mode, ctx.overrides).find(
    (o) => o.priceCents != null || o.priceMultiplier != null,
  );
  if (!ov) return { amountCents: base };
  if (ov.priceCents != null) return { amountCents: ov.priceCents, override: ov };
  return { amountCents: Math.round(base * (ov.priceMultiplier as number)), override: ov };
}

/** Mínimo de noites exigido: o maior entre o padrão e as sobrescritas que tocam a estadia */
export function requiredMinNights(nights: ISODate[], ctx: PricingContext): number {
  let min = ctx.property.defaultMinNights;
  for (const d of nights)
    for (const o of overridesFor(d, 'stay', ctx.overrides))
      if (o.minNights != null) min = Math.max(min, o.minNights);
  return min;
}

export function quote(req: BookingRequest, ctx: PricingContext): Quote {
  const { property: p } = ctx;
  const rule = ctx.rules[req.mode];
  const errors: QuoteError[] = [];
  const lines: QuoteLine[] = [];

  const startDate = req.mode === 'stay' ? req.checkIn : req.date;
  const endDate = req.mode === 'stay' ? req.checkOut : req.date;

  const empty = (e: QuoteError): Quote => ({
    ok: false, errors: [e], mode: req.mode, startDate, endDate, nights: 0, startsAt: 0, endsAt: 0,
    guests: req.guests, lines: [], subtotalCents: 0, extraGuestsCents: 0, cleaningFeeCents: 0,
    discountCents: 0, totalCents: 0, securityDepositCents: 0, amountDueNowCents: 0,
    minNights: p.defaultMinNights,
  });

  try {
    parseDate(startDate);
    parseDate(endDate);
  } catch {
    return empty({ code: 'INVALID_DATES', message: 'Datas inválidas.' });
  }
  if (req.mode === 'stay' && req.checkOut <= req.checkIn)
    return empty({ code: 'INVALID_DATES', message: 'O check-out deve ser depois do check-in.' });
  if (!Number.isInteger(req.guests) || req.guests < 1)
    return empty({ code: 'MAX_GUESTS', message: 'Informe ao menos 1 pessoa.' });

  // --- Regras de janela ------------------------------------------------
  const lead = diffDays(ctx.today, startDate);
  if (lead < 0) errors.push({ code: 'PAST_DATE', message: 'A data escolhida já passou.' });
  if (lead > p.maxAdvanceDays)
    errors.push({ code: 'TOO_FAR', message: `Reservas abertas até ${p.maxAdvanceDays} dias à frente.` });

  let minNights = 1;
  let nightsCount = 0;
  let extraGuestsCents = 0;

  if (req.mode === 'stay') {
    // --- Hospedagem ------------------------------------------------------
    const nights = eachDay(req.checkIn, req.checkOut);
    nightsCount = nights.length;
    minNights = requiredMinNights(nights, ctx);
    if (nightsCount < minNights)
      errors.push({
        code: 'MIN_NIGHTS',
        message: `Este período exige no mínimo ${minNights} diárias.`,
      });
    const blockedArrival = overridesFor(req.checkIn, 'stay', ctx.overrides).find((o) => o.closedToArrival);
    if (blockedArrival)
      errors.push({
        code: 'CLOSED_TO_ARRIVAL',
        message: `Não há check-in em ${formatBR(req.checkIn)} (${blockedArrival.label}).`,
      });
    if (req.guests > p.maxGuestsStay)
      errors.push({ code: 'MAX_GUESTS', message: `Máximo de ${p.maxGuestsStay} hóspedes.` });

    for (const d of nights) {
      const { amountCents, override } = priceForDate(d, 'stay', ctx);
      lines.push({
        date: d,
        label: `Diária ${WEEKDAY[weekday(d)]} ${formatBR(d).slice(0, 5)}`,
        amountCents,
        overrideLabel: override?.label,
      });
    }
    const extra = Math.max(0, req.guests - rule.includedGuests);
    extraGuestsCents = extra * rule.extraGuestFeeCents * nightsCount;
  } else {
    // --- Evento / Day use -----------------------------------------------
    nightsCount = 0;
    if (lead >= 0 && lead < p.eventMinLeadDays)
      errors.push({
        code: 'LEAD_TIME',
        message: `Festas precisam ser reservadas com ${p.eventMinLeadDays} dias de antecedência.`,
      });
    const closed = overridesFor(req.date, 'event', ctx.overrides).find((o) => o.eventsAllowed === false);
    if (closed)
      errors.push({ code: 'EVENTS_NOT_ALLOWED', message: `Não alugamos para eventos em ${closed.label}.` });
    if (req.guests > p.maxGuestsEvent)
      errors.push({ code: 'MAX_GUESTS', message: `Máximo de ${p.maxGuestsEvent} convidados.` });

    const { amountCents, override } = priceForDate(req.date, 'event', ctx);
    lines.push({
      date: req.date,
      label: `Locação do espaço ${WEEKDAY[weekday(req.date)]} ${formatBR(req.date).slice(0, 5)} (${p.eventStartTime}–${p.eventEndTime})`,
      amountCents,
      overrideLabel: override?.label,
    });
    const hours = Math.max(0, Math.floor(req.extraHours ?? 0));
    if (hours > 0)
      lines.push({ date: req.date, label: `${hours}h extra`, amountCents: hours * rule.extraHourFeeCents });
    extraGuestsCents = Math.max(0, req.guests - rule.includedGuests) * rule.extraGuestFeeCents;
  }

  // --- Conflito de calendário -------------------------------------------
  const iv = bookingInterval(req, p);
  const conflicts = findConflicts(occupiedPeriod(req.mode, iv, p), ctx.holds);
  if (conflicts.length)
    errors.push({
      code: 'UNAVAILABLE',
      message:
        req.mode === 'stay'
          ? 'Datas indisponíveis (já reservadas ou reservadas para limpeza/evento).'
          : 'Dia indisponível para eventos (hospedagem ou outro evento no período, incluindo preparo e limpeza).',
    });

  // --- Totais -----------------------------------------------------------
  const subtotalCents = lines.reduce((s, l) => s + l.amountCents, 0);
  const cleaningFeeCents = rule.cleaningFeeCents;
  const discountCents = 0;
  const totalCents = subtotalCents + cleaningFeeCents + extraGuestsCents - discountCents;
  const amountDueNowCents = Math.ceil((totalCents * rule.depositPercentDueNow) / 100);

  return {
    ok: errors.length === 0,
    errors,
    mode: req.mode,
    startDate,
    endDate,
    nights: nightsCount,
    startsAt: iv.start,
    endsAt: iv.end,
    guests: req.guests,
    lines,
    subtotalCents,
    extraGuestsCents,
    cleaningFeeCents,
    discountCents,
    totalCents,
    securityDepositCents: rule.securityDepositCents,
    amountDueNowCents,
    minNights,
  };
}

export const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
