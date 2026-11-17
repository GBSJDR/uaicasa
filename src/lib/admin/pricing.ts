import 'server-only';
import { supabaseAdmin } from '../data/repository';
import { parseDateRange } from '../data/pgRange';
import { addDays } from '../domain/dates';

export interface RuleRow {
  id: string;
  mode: 'stay' | 'event';
  base: number; weekend: number | null; cleaning: number; deposit: number;
  included: number; extraGuest: number; extraHour: number; percentNow: number;
}
export interface OverrideRow {
  id: string; label: string; scope: 'stay' | 'event' | 'both';
  from: string; until: string; // until = último dia (inclusivo)
  price: number | null; multiplier: number | null; minNights: number | null;
  closedToArrival: boolean; eventsAllowed: boolean; priority: number;
}
export interface SettingsRow {
  id: string;
  maxGuestsStay: number; maxGuestsEvent: number; defaultMinNights: number; eventMinLeadDays: number;
  checkinTime: string; checkoutTime: string; eventStartTime: string; eventEndTime: string; loudMusicUntil: string;
}
export interface PricingAdmin { settings: SettingsRow; rules: RuleRow[]; overrides: OverrideRow[] }

/** Valores em REAIS para o formulário (o banco guarda centavos). */
export async function loadPricingAdmin(): Promise<PricingAdmin> {
  const db = supabaseAdmin()!;
  const { data: p } = await db.from('properties').select('*').eq('slug', 'uaicasa').single();
  const [{ data: rules }, { data: ovs }] = await Promise.all([
    db.from('pricing_rules').select('*').eq('property_id', p.id).order('valid_from', { ascending: false }),
    db.from('calendar_pricing').select('*').eq('property_id', p.id),
  ]);
  const r = (c: number | null) => (c == null ? null : c / 100);
  const hhmm = (t: string) => t.slice(0, 5);
  const latest = (mode: string) => (rules ?? []).find((x) => x.mode === mode)!;
  return {
    settings: {
      id: p.id, maxGuestsStay: p.max_guests_stay, maxGuestsEvent: p.max_guests_event,
      defaultMinNights: p.default_min_nights, eventMinLeadDays: p.event_min_lead_days,
      checkinTime: hhmm(p.checkin_time), checkoutTime: hhmm(p.checkout_time),
      eventStartTime: hhmm(p.event_start_time), eventEndTime: hhmm(p.event_end_time), loudMusicUntil: hhmm(p.loud_music_until),
    },
    rules: (['stay', 'event'] as const).map((m) => {
      const x = latest(m);
      return {
        id: x.id, mode: m, base: x.base_price_cents / 100, weekend: r(x.weekend_price_cents),
        cleaning: x.cleaning_fee_cents / 100, deposit: x.security_deposit_cents / 100, included: x.included_guests,
        extraGuest: x.extra_guest_fee_cents / 100, extraHour: x.extra_hour_fee_cents / 100, percentNow: x.deposit_percent_due_now,
      };
    }),
    overrides: (ovs ?? [])
      .map((o) => {
        const { from, to } = parseDateRange(o.dates);
        return {
          id: o.id, label: o.label, scope: o.scope, from, until: addDays(to, -1),
          price: r(o.price_cents), multiplier: o.price_multiplier == null ? null : Number(o.price_multiplier),
          minNights: o.min_nights, closedToArrival: o.closed_to_arrival, eventsAllowed: o.events_allowed, priority: o.priority,
        };
      })
      .sort((a, b) => a.from.localeCompare(b.from)),
  };
}
