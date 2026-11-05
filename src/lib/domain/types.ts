import type { HHMM, ISODate } from './dates';

export type BookingMode = 'stay' | 'event';
export type OverrideScope = BookingMode | 'both';

export interface PropertyConfig {
  id: string;
  slug: string;
  name: string;
  maxGuestsStay: number;
  maxGuestsEvent: number;
  checkinTime: HHMM;
  checkoutTime: HHMM;
  defaultMinNights: number;
  eventStartTime: HHMM;
  eventEndTime: HHMM; // se <= início, termina no dia seguinte
  loudMusicUntil: HHMM;
  eventMinLeadDays: number;
  bufferAfterStayMin: number;
  bufferBeforeEventMin: number;
  bufferAfterEventMin: number;
  maxAdvanceDays: number;
}

export interface PricingRule {
  mode: BookingMode;
  basePriceCents: number;
  weekendPriceCents?: number | null;
  cleaningFeeCents: number;
  securityDepositCents: number;
  includedGuests: number;
  extraGuestFeeCents: number;
  extraHourFeeCents: number;
  depositPercentDueNow: number; // sinal cobrado no checkout (1–100)
}

/** Sobrescrita por data. `from` inclusivo, `to` exclusivo (igual ao daterange '[)'). */
export interface DateOverride {
  label: string;
  scope: OverrideScope;
  from: ISODate;
  to: ISODate;
  priceCents?: number | null;
  priceMultiplier?: number | null;
  minNights?: number | null;
  closedToArrival?: boolean;
  eventsAllowed?: boolean;
  priority?: number;
}

/** Período já ocupado (inclui buffers), espelho da tabela `occupancy`. */
export interface Hold {
  start: number; // epoch ms
  end: number; // epoch ms (exclusivo)
  kind: 'booking' | 'manual_block' | 'maintenance' | 'ical_import';
  label?: string;
}

export interface PricingContext {
  property: PropertyConfig;
  rules: Record<BookingMode, PricingRule>;
  overrides: DateOverride[];
  holds: Hold[];
  today: ISODate;
}

export interface StayRequest {
  mode: 'stay';
  checkIn: ISODate;
  checkOut: ISODate;
  guests: number;
}

export interface EventRequest {
  mode: 'event';
  date: ISODate;
  guests: number;
  extraHours?: number;
}

export type BookingRequest = StayRequest | EventRequest;

export interface QuoteLine {
  date: ISODate;
  label: string; // "Diária sex 12/12", "Carnaval SJDR"
  amountCents: number;
  overrideLabel?: string;
}

export type QuoteErrorCode =
  | 'INVALID_DATES'
  | 'PAST_DATE'
  | 'TOO_FAR'
  | 'MIN_NIGHTS'
  | 'CLOSED_TO_ARRIVAL'
  | 'MAX_GUESTS'
  | 'LEAD_TIME'
  | 'EVENTS_NOT_ALLOWED'
  | 'UNAVAILABLE';

export interface QuoteError {
  code: QuoteErrorCode;
  message: string;
}

export interface Quote {
  ok: boolean;
  errors: QuoteError[];
  mode: BookingMode;
  startDate: ISODate;
  endDate: ISODate;
  nights: number;
  startsAt: number;
  endsAt: number;
  guests: number;
  lines: QuoteLine[];
  subtotalCents: number;
  extraGuestsCents: number;
  cleaningFeeCents: number;
  discountCents: number;
  totalCents: number; // locação (sem caução)
  securityDepositCents: number; // caução reembolsável
  amountDueNowCents: number; // sinal PIX agora
  minNights: number;
}
