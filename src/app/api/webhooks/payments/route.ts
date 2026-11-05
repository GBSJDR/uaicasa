/**
 * Webhook do gateway (Asaas → Configurações → Integrações → Webhooks).
 * Idempotente: o mesmo evento pode chegar várias vezes.
 * PAYMENT_RECEIVED/CONFIRMED → payments.received → bookings.confirmed
 * (o trigger no banco lança a receita e a taxa do gateway no livro razão).
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/data/repository';
import { paymentGateway } from '@/lib/payments/gateway';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  let evt;
  try {
    evt = paymentGateway().parseWebhook(req.headers, body);
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!evt) return NextResponse.json({ ignored: true });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ demo: true, evt });

  const { error: dup } = await db.from('webhook_events').insert({
    id: evt.eventId, gateway: 'asaas', event_type: evt.status, payload: body,
  });
  if (dup?.code === '23505') return NextResponse.json({ duplicate: true });

  if (evt.status === 'received' || evt.status === 'confirmed') {
    await db.from('payments')
      .update({ status: evt.status, paid_at: new Date().toISOString(), net_amount_cents: evt.netAmountCents, raw_last_event: body })
      .eq('gateway_payment_id', evt.gatewayPaymentId);
    if (evt.bookingId)
      await db.from('bookings').update({ status: 'confirmed' })
        .eq('id', evt.bookingId).in('status', ['pending_payment', 'expired']);
    // TODO: enfileirar e-mail com PDF do contrato + mensagem de confirmação
  }
  await db.from('webhook_events').update({ processed_at: new Date().toISOString() }).eq('id', evt.eventId);
  return NextResponse.json({ ok: true });
}
