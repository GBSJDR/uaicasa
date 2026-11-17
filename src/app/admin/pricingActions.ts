'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { supabaseAdmin } from '@/lib/data/repository';
import { addDays } from '@/lib/domain/dates';
import type { OverrideRow, RuleRow, SettingsRow } from '@/lib/admin/pricing';

type Result = { ok: true } | { ok: false; error: string };
const cents = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? null : Math.round(v * 100));
const okMoney = (v: number | null | undefined) => v == null || (Number.isFinite(v) && v >= 0 && v < 1_000_000);
const isTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

function refresh() {
  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath('/reservar');
}

export async function saveRule(r: RuleRow): Promise<Result> {
  await requireAdmin();
  if (![r.base, r.weekend, r.cleaning, r.deposit, r.extraGuest, r.extraHour].every(okMoney)) return { ok: false, error: 'Confira os valores em reais.' };
  if (!(r.base > 0)) return { ok: false, error: 'A tarifa base precisa ser maior que zero.' };
  if (!(Number.isInteger(r.included) && r.included >= 1)) return { ok: false, error: 'Pessoas inclusas: número inteiro a partir de 1.' };
  if (!(Number.isInteger(r.percentNow) && r.percentNow >= 1 && r.percentNow <= 100)) return { ok: false, error: 'Sinal: de 1% a 100%.' };
  const { error } = await supabaseAdmin()!.from('pricing_rules').update({
    base_price_cents: cents(r.base), weekend_price_cents: cents(r.weekend), cleaning_fee_cents: cents(r.cleaning),
    security_deposit_cents: cents(r.deposit), included_guests: r.included, extra_guest_fee_cents: cents(r.extraGuest),
    extra_hour_fee_cents: cents(r.extraHour), deposit_percent_due_now: r.percentNow,
  }).eq('id', r.id);
  if (error) return { ok: false, error: 'Erro ao salvar as tarifas.' };
  refresh();
  return { ok: true };
}

export async function saveSettings(s: SettingsRow): Promise<Result> {
  await requireAdmin();
  const ints = [s.maxGuestsStay, s.maxGuestsEvent, s.defaultMinNights];
  if (!ints.every((n) => Number.isInteger(n) && n >= 1) || !(Number.isInteger(s.eventMinLeadDays) && s.eventMinLeadDays >= 0))
    return { ok: false, error: 'Confira os números (capacidades, mínimo de diárias, antecedência).' };
  if (![s.checkinTime, s.checkoutTime, s.eventStartTime, s.eventEndTime, s.loudMusicUntil].every(isTime))
    return { ok: false, error: 'Horários no formato 14:00.' };
  const { error } = await supabaseAdmin()!.from('properties').update({
    max_guests_stay: s.maxGuestsStay, max_guests_event: s.maxGuestsEvent, default_min_nights: s.defaultMinNights,
    event_min_lead_days: s.eventMinLeadDays, checkin_time: s.checkinTime, checkout_time: s.checkoutTime,
    event_start_time: s.eventStartTime, event_end_time: s.eventEndTime, loud_music_until: s.loudMusicUntil,
    updated_at: new Date().toISOString(),
  }).eq('id', s.id);
  if (error) return { ok: false, error: 'Erro ao salvar as regras da casa.' };
  refresh();
  return { ok: true };
}

export async function addOverride(propertyId: string, o: Omit<OverrideRow, 'id'>): Promise<Result> {
  await requireAdmin();
  if (!o.label.trim()) return { ok: false, error: 'Dê um nome à data especial.' };
  if (!isDate(o.from) || !isDate(o.until) || o.until < o.from) return { ok: false, error: 'Confira o período (o fim não pode ser antes do início).' };
  if (!okMoney(o.price)) return { ok: false, error: 'Preço inválido.' };
  if (o.multiplier != null && !(o.multiplier > 0 && o.multiplier <= 10)) return { ok: false, error: 'Percentual inválido.' };
  if (o.minNights != null && !(Number.isInteger(o.minNights) && o.minNights >= 1)) return { ok: false, error: 'Mínimo de diárias inválido.' };
  if (o.price == null && o.multiplier == null && o.minNights == null && !o.closedToArrival && o.eventsAllowed)
    return { ok: false, error: 'Defina pelo menos um preço, um mínimo de diárias ou um bloqueio.' };
  const { error } = await supabaseAdmin()!.from('calendar_pricing').insert({
    property_id: propertyId, label: o.label.trim(), scope: o.scope,
    dates: `[${o.from},${addDays(o.until, 1)})`,
    price_cents: cents(o.price), price_multiplier: o.multiplier, min_nights: o.minNights,
    closed_to_arrival: o.closedToArrival, events_allowed: o.eventsAllowed, priority: o.priority,
  });
  if (error) return { ok: false, error: 'Erro ao salvar a data especial.' };
  refresh();
  return { ok: true };
}

export async function deleteOverride(id: string): Promise<Result> {
  await requireAdmin();
  const { error } = await supabaseAdmin()!.from('calendar_pricing').delete().eq('id', id);
  if (error) return { ok: false, error: 'Erro ao excluir.' };
  refresh();
  return { ok: true };
}
