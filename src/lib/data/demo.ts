/**
 * Dados de demonstração — usados quando o Supabase não está configurado.
 * Espelham o SEED do SQL para o protótipo funcionar sem banco.
 */
import { addDays, todayInSaoPaulo, type ISODate } from '../domain/dates';
import { holdFor } from '../domain/availability';
import type { DateOverride, Hold, PricingRule, PropertyConfig, BookingMode } from '../domain/types';

export const PROPERTY: PropertyConfig = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'uaicasa',
  name: 'UaiCasa',
  maxGuestsStay: 12,
  maxGuestsEvent: 80,
  checkinTime: '14:00',
  checkoutTime: '11:00',
  defaultMinNights: 2,
  eventStartTime: '10:00',
  eventEndTime: '22:00',
  loudMusicUntil: '22:00',
  eventMinLeadDays: 7,
  bufferAfterStayMin: 180,
  bufferBeforeEventMin: 180,
  bufferAfterEventMin: 720,
  maxAdvanceDays: 540,
};

export const RULES: Record<BookingMode, PricingRule> = {
  stay: {
    mode: 'stay',
    basePriceCents: 90_000,
    weekendPriceCents: 120_000,
    cleaningFeeCents: 25_000,
    securityDepositCents: 50_000,
    includedGuests: 8,
    extraGuestFeeCents: 5_000,
    extraHourFeeCents: 0,
    depositPercentDueNow: 50,
  },
  event: {
    mode: 'event',
    basePriceCents: 150_000,
    weekendPriceCents: 220_000,
    cleaningFeeCents: 35_000,
    securityDepositCents: 100_000,
    includedGuests: 50,
    extraGuestFeeCents: 2_500,
    extraHourFeeCents: 15_000,
    depositPercentDueNow: 50,
  },
};

/** Datas especiais de São João del-Rei e feriados nacionais */
export const OVERRIDES: DateOverride[] = [
  { label: 'Natal', scope: 'stay', from: '2026-12-23', to: '2026-12-27', priceCents: 160_000, minNights: 3, priority: 10 },
  { label: 'Natal', scope: 'event', from: '2026-12-24', to: '2026-12-26', eventsAllowed: false, priority: 10 },
  { label: 'Réveillon', scope: 'stay', from: '2026-12-29', to: '2027-01-03', priceCents: 220_000, minNights: 4, priority: 20 },
  { label: 'Réveillon', scope: 'event', from: '2026-12-31', to: '2027-01-02', eventsAllowed: false, priority: 20 },
  { label: 'Férias de janeiro', scope: 'stay', from: '2027-01-03', to: '2027-02-01', priceMultiplier: 1.15, priority: 1 },
  { label: 'Carnaval SJDR', scope: 'stay', from: '2027-02-05', to: '2027-02-11', priceCents: 250_000, minNights: 4, priority: 20 },
  { label: 'Carnaval SJDR', scope: 'event', from: '2027-02-06', to: '2027-02-10', eventsAllowed: false, priority: 20 },
  { label: 'Semana Santa SJDR', scope: 'stay', from: '2027-03-24', to: '2027-03-29', priceCents: 180_000, minNights: 3, priority: 15 },
  { label: 'Tiradentes', scope: 'both', from: '2027-04-20', to: '2027-04-22', priceMultiplier: 1.3, priority: 10 },
  { label: 'Festival de Inverno', scope: 'stay', from: '2027-07-09', to: '2027-07-26', priceMultiplier: 1.2, priority: 5 },
];

export interface DemoBooking {
  code: string;
  mode: BookingMode;
  status: 'pending_payment' | 'confirmed' | 'completed' | 'cancelled';
  guest: string;
  phone: string;
  start: ISODate;
  end: ISODate;
  guests: number;
  totalCents: number;
  paidCents: number;
  source: 'website' | 'whatsapp' | 'presencial' | 'airbnb';
}

/** Reservas fictícias relativas a hoje, para o calendário ter vida */
export function demoBookings(today = todayInSaoPaulo()): DemoBooking[] {
  const d = (n: number) => addDays(today, n);
  return [
    { code: 'K7Q2M9XA', mode: 'stay', status: 'completed', guest: 'Mariana Souza', phone: '+5532988110022', start: d(-12), end: d(-9), guests: 6, totalCents: 295_000, paidCents: 295_000, source: 'website' },
    { code: 'P3L8D2RT', mode: 'event', status: 'completed', guest: 'Carlos Henrique', phone: '+5532999340011', start: d(-5), end: d(-5), guests: 60, totalCents: 280_000, paidCents: 280_000, source: 'whatsapp' },
    { code: 'B9X4N1QE', mode: 'stay', status: 'confirmed', guest: 'Família Andrade', phone: '+5531987654321', start: d(4), end: d(7), guests: 10, totalCents: 362_000, paidCents: 181_000, source: 'website' },
    { code: 'F2T6H8WS', mode: 'event', status: 'confirmed', guest: 'Juliana Reis (15 anos)', phone: '+5532991112233', start: d(10), end: d(10), guests: 70, totalCents: 305_000, paidCents: 152_500, source: 'presencial' },
    { code: 'M5R1J7ZC', mode: 'stay', status: 'pending_payment', guest: 'Roberto Lima', phone: '+5511976543210', start: d(15), end: d(17), guests: 4, totalCents: 265_000, paidCents: 0, source: 'website' },
    { code: 'W8E3V6PK', mode: 'stay', status: 'confirmed', guest: 'Airbnb • Fernanda', phone: '+5521998877665', start: d(22), end: d(26), guests: 8, totalCents: 445_000, paidCents: 445_000, source: 'airbnb' },
  ];
}

export function demoHolds(today = todayInSaoPaulo()): Hold[] {
  const holds: Hold[] = demoBookings(today)
    .filter((b) => b.status !== 'cancelled')
    .map((b) =>
      holdFor(
        b.mode === 'stay'
          ? { mode: 'stay', checkIn: b.start, checkOut: b.end, guests: b.guests }
          : { mode: 'event', date: b.start, guests: b.guests },
        PROPERTY,
        b.code,
      ),
    );
  // bloqueio manual (manutenção da piscina)
  holds.push({
    ...holdFor({ mode: 'stay', checkIn: addDays(today, 30), checkOut: addDays(today, 32), guests: 1 }, PROPERTY),
    kind: 'maintenance',
    label: 'Manutenção da piscina',
  });
  return holds;
}

export interface DemoExpense {
  date: ISODate;
  category: string;
  description: string;
  amountCents: number;
}

export function demoExpenses(today = todayInSaoPaulo()): DemoExpense[] {
  const d = (n: number) => addDays(today, n);
  return [
    { date: d(-20), category: 'energia', description: 'Cemig (com crédito solar)', amountCents: 18_400 },
    { date: d(-18), category: 'agua', description: 'Copasa', amountCents: 21_300 },
    { date: d(-15), category: 'piscina', description: 'Cloro, clarificante e algicida', amountCents: 32_000 },
    { date: d(-9), category: 'limpeza', description: 'Faxina pós-hospedagem K7Q2M9XA', amountCents: 25_000 },
    { date: d(-4), category: 'limpeza', description: 'Faxina pós-evento P3L8D2RT', amountCents: 35_000 },
    { date: d(-3), category: 'manutencao', description: 'Troca de rede da cama elástica', amountCents: 27_000 },
    { date: d(-2), category: 'taxa_gateway', description: 'Asaas — tarifas PIX do mês', amountCents: 795 },
    { date: d(-1), category: 'internet', description: 'Fibra 500MB', amountCents: 11_990 },
  ];
}
