/**
 * Camada de acesso a dados. Se SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY estiverem
 * definidos, lê do banco; senão usa os dados de demonstração (protótipo offline).
 * Só é importado no servidor (rotas de API / server components).
 */
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { todayInSaoPaulo } from '../domain/dates';
import type { DateOverride, Hold, PricingContext, PricingRule } from '../domain/types';
import { OVERRIDES, PROPERTY, RULES, demoHolds } from './demo';
import { parseDateRange, parseTstzRange } from './pgRange';

let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export const isDemoMode = () => supabaseAdmin() === null;

export async function loadPricingContext(slug = 'uaicasa'): Promise<PricingContext> {
  const db = supabaseAdmin();
  const today = todayInSaoPaulo();
  if (!db) return { property: PROPERTY, rules: RULES, overrides: OVERRIDES, holds: demoHolds(today), today };

  const { data: p, error } = await db.from('properties').select('*').eq('slug', slug).single();
  if (error || !p) throw new Error(`Imóvel ${slug} não encontrado`);

  const [rules, overrides, occupancy] = await Promise.all([
    db.from('pricing_rules').select('*').eq('property_id', p.id).lte('valid_from', today),
    db.from('calendar_pricing').select('*').eq('property_id', p.id),
    db.from('occupancy').select('period, kind, reason').eq('property_id', p.id).eq('active', true),
  ]);

  const toRule = (r: Record<string, any>): PricingRule => ({
    mode: r.mode,
    basePriceCents: r.base_price_cents,
    weekendPriceCents: r.weekend_price_cents,
    cleaningFeeCents: r.cleaning_fee_cents,
    securityDepositCents: r.security_deposit_cents,
    includedGuests: r.included_guests,
    extraGuestFeeCents: r.extra_guest_fee_cents,
    extraHourFeeCents: r.extra_hour_fee_cents,
    depositPercentDueNow: r.deposit_percent_due_now,
  });
  const latest = (mode: string) =>
    (rules.data ?? []).filter((r) => r.mode === mode).sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1))[0];

  const hhmm = (t: string) => t.slice(0, 5);
  return {
    today,
    property: {
      id: p.id, slug: p.slug, name: p.name,
      maxGuestsStay: p.max_guests_stay, maxGuestsEvent: p.max_guests_event,
      checkinTime: hhmm(p.checkin_time), checkoutTime: hhmm(p.checkout_time),
      defaultMinNights: p.default_min_nights,
      eventStartTime: hhmm(p.event_start_time), eventEndTime: hhmm(p.event_end_time),
      loudMusicUntil: hhmm(p.loud_music_until), eventMinLeadDays: p.event_min_lead_days,
      bufferAfterStayMin: p.buffer_after_stay_min, bufferBeforeEventMin: p.buffer_before_event_min,
      bufferAfterEventMin: p.buffer_after_event_min, maxAdvanceDays: p.max_advance_days,
    },
    rules: { stay: toRule(latest('stay')), event: toRule(latest('event')) },
    overrides: (overrides.data ?? []).map((o): DateOverride => {
      const { from, to } = parseDateRange(o.dates);
      return {
        label: o.label, scope: o.scope, from, to,
        priceCents: o.price_cents, priceMultiplier: o.price_multiplier && Number(o.price_multiplier),
        minNights: o.min_nights, closedToArrival: o.closed_to_arrival,
        eventsAllowed: o.events_allowed, priority: o.priority,
      };
    }),
    holds: (occupancy.data ?? []).map((o): Hold => ({ ...parseTstzRange(o.period), kind: o.kind, label: o.reason ?? undefined })),
  };
}
