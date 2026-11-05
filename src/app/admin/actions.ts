'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { loadPricingContext, supabaseAdmin } from '@/lib/data/repository';
import { bookingInterval } from '@/lib/domain/availability';
import { isValidCNPJ, isValidCPF, onlyDigits } from '@/lib/domain/validation';

type Result = { ok: true } | { ok: false; error: string };

async function db() {
  const user = await requireAdmin();
  return { user, db: supabaseAdmin()! };
}

/** "Dar baixa": registra pagamento manual (PIX direto, dinheiro) e confirma a reserva. */
export async function registerPayment(bookingId: string, amountCents: number): Promise<Result> {
  const { db: sb } = await db();
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { ok: false, error: 'Valor inválido.' };
  const { error: e1 } = await sb.from('payments').insert({
    booking_id: bookingId, purpose: 'booking', method: 'pix', gateway: 'manual',
    status: 'received', amount_cents: amountCents, paid_at: new Date().toISOString(),
  });
  if (e1) return { ok: false, error: 'Erro ao registrar o pagamento.' };
  const { error: e2 } = await sb.from('bookings').update({ status: 'confirmed', expires_at: null })
    .eq('id', bookingId).in('status', ['pending_payment', 'expired', 'confirmed']);
  if (e2) return { ok: false, error: e2.message.includes('occupancy_no_overlap') ? 'As datas já foram ocupadas por outra reserva.' : 'Erro ao confirmar.' };
  revalidatePath('/admin');
  return { ok: true };
}

export async function cancelBooking(bookingId: string, reason = 'Cancelada pelo anfitrião'): Promise<Result> {
  const { db: sb } = await db();
  const { error } = await sb.from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: reason })
    .eq('id', bookingId);
  if (error) return { ok: false, error: 'Erro ao cancelar.' };
  revalidatePath('/admin');
  return { ok: true };
}

export async function addExpense(input: { date: string; category: string; description: string; amountCents: number }): Promise<Result> {
  const { user, db: sb } = await db();
  const ctx = await loadPricingContext();
  const { error } = await sb.from('financial_transactions').insert({
    property_id: ctx.property.id, type: 'expense', category: input.category, description: input.description,
    amount_cents: input.amountCents, occurred_on: input.date, paid_on: input.date, created_by: user.id,
  });
  if (error) return { ok: false, error: 'Erro ao lançar a despesa.' };
  revalidatePath('/admin');
  return { ok: true };
}

/** Reserva vendida pelo WhatsApp/presencial. O banco recusa se houver conflito de datas. */
export async function addManualBooking(input: {
  mode: 'stay' | 'event'; guest: string; phone: string; document: string;
  start: string; end: string; guests: number; totalCents: number; paidCents: number;
}): Promise<Result> {
  const { db: sb } = await db();
  const ctx = await loadPricingContext();
  const doc = onlyDigits(input.document);
  if (!(doc.length === 14 ? isValidCNPJ(doc) : isValidCPF(doc))) return { ok: false, error: 'CPF/CNPJ inválido.' };
  if (input.mode === 'stay' && !(input.end > input.start)) return { ok: false, error: 'A saída deve ser depois da entrada.' };
  const req = input.mode === 'stay'
    ? { mode: 'stay' as const, checkIn: input.start, checkOut: input.end, guests: input.guests }
    : { mode: 'event' as const, date: input.start, guests: input.guests };
  const iv = bookingInterval(req, ctx.property);
  const total = Math.max(0, Math.round(input.totalCents));
  const quote = {
    subtotalCents: total, cleaningFeeCents: 0, extraGuestsCents: 0, discountCents: 0, totalCents: total,
    securityDepositCents: 0, amountDueNowCents: Math.max(1, Math.min(total, input.paidCents || total)), lines: [],
  };
  const { data, error } = await sb.rpc('create_booking', {
    p_property_id: ctx.property.id,
    p_guest: { full_name: input.guest.trim(), document_type: doc.length === 14 ? 'cnpj' : 'cpf', document_number: doc,
               email: 'sem-email@uaicasa.com.br', phone: '+55' + onlyDigits(input.phone).replace(/^55/, '') },
    p_mode: input.mode, p_start_date: input.start, p_end_date: input.mode === 'stay' ? input.end : input.start,
    p_starts_at: new Date(iv.start).toISOString(), p_ends_at: new Date(iv.end).toISOString(),
    p_guests_count: input.guests, p_event_type: null, p_quote: quote, p_source: 'whatsapp',
  });
  if (error) return { ok: false, error: error.message.includes('DATES_UNAVAILABLE') ? 'Datas indisponíveis.' : 'Erro ao criar a reserva.' };
  if (input.paidCents > 0) return registerPayment(data.id, Math.round(input.paidCents));
  await sb.from('bookings').update({ expires_at: new Date(Date.now() + 72 * 3_600_000).toISOString() }).eq('id', data.id);
  revalidatePath('/admin');
  return { ok: true };
}
