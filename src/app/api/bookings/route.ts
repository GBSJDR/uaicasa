/**
 * POST /api/bookings — Checkout.
 * 1. Revalida a cotação NO SERVIDOR (o preço do cliente nunca é confiável)
 * 2. Gera o contrato e o hash SHA-256 do texto aceito
 * 3. Cria a reserva via RPC atômica (EXCLUDE constraint impede overbooking)
 * 4. Gera a cobrança PIX (Asaas) com vencimento = validade do bloqueio
 */
import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isDemoMode, loadPricingContext, supabaseAdmin } from '@/lib/data/repository';
import { quote } from '@/lib/domain/pricing';
import { isValidCNPJ, isValidCPF, onlyDigits, parseBookingRequest } from '@/lib/domain/validation';
import { buildContract, contractToText } from '@/lib/contracts/contract';
import { hasRealGateway, paymentGateway } from '@/lib/payments/gateway';

const HOLD_MINUTES = 30;
/** Sem gateway, o PIX é enviado manualmente pelo WhatsApp: segura a data por mais tempo. */
const MANUAL_HOLD_HOURS = 24;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const request = parseBookingRequest(body?.request);
  const g = body?.guest ?? {};
  if (!request) return NextResponse.json({ error: 'Reserva inválida' }, { status: 400 });

  // --- dados do locatário ---
  const doc = onlyDigits(g.document);
  const docType = doc.length === 14 ? 'cnpj' : 'cpf';
  const errors: string[] = [];
  if (!g.fullName || String(g.fullName).trim().split(/\s+/).length < 2) errors.push('Informe nome e sobrenome.');
  if (!(docType === 'cpf' ? isValidCPF(doc) : isValidCNPJ(doc))) errors.push('CPF/CNPJ inválido.');
  if (!/^\S+@\S+\.\S+$/.test(g.email ?? '')) errors.push('E-mail inválido.');
  if (onlyDigits(g.phone).length < 10) errors.push('Telefone inválido.');
  if (!body?.acceptedContract) errors.push('É preciso aceitar o contrato.');
  if (errors.length) return NextResponse.json({ error: errors.join(' ') }, { status: 422 });

  // --- 1. cotação no servidor ---
  const ctx = await loadPricingContext();
  const q = quote(request, ctx);
  if (!q.ok) return NextResponse.json({ error: q.errors.map((e) => e.message).join(' '), quote: q }, { status: 409 });

  // --- 2. contrato ---
  const tenant = {
    name: String(g.fullName).trim(),
    document: doc,
    email: String(g.email).trim().toLowerCase(),
    phone: '+55' + onlyDigits(g.phone).replace(/^55/, ''),
    address: [g.street, g.number, g.district, g.city, g.state, g.zip].filter(Boolean).join(', '),
  };
  const contract = buildContract(q, ctx.property, tenant);
  const contractText = contractToText(contract);
  const contractHash = createHash('sha256').update(contractText).digest('hex');
  const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000);

  // --- 3. reserva ---
  let bookingId: string = randomUUID();
  let bookingCode = bookingId.slice(0, 8).toUpperCase();
  const db = supabaseAdmin();
  if (db) {
    const { data, error } = await db.rpc('create_booking', {
      p_property_id: ctx.property.id,
      p_guest: {
        full_name: tenant.name, document_type: docType, document_number: doc, email: tenant.email,
        phone: tenant.phone, address_street: g.street, address_number: g.number,
        address_district: g.district, address_city: g.city, address_state: g.state, address_zip: g.zip,
      },
      p_mode: q.mode,
      p_start_date: q.startDate,
      p_end_date: q.endDate,
      p_starts_at: new Date(q.startsAt).toISOString(),
      p_ends_at: new Date(q.endsAt).toISOString(),
      p_guests_count: q.guests,
      p_event_type: body?.eventType ?? null,
      p_quote: q,
    });
    if (error) {
      const taken = error.message.includes('DATES_UNAVAILABLE');
      return NextResponse.json(
        { error: taken ? 'Alguém acabou de reservar estas datas. Escolha outro período.' : 'Erro ao criar a reserva.' },
        { status: taken ? 409 : 500 },
      );
    }
    bookingId = data.id;
    bookingCode = data.code;

    const { data: tpl } = await db
      .from('contract_templates').select('id')
      .eq('property_id', ctx.property.id).eq('mode', q.mode).eq('is_active', true)
      .order('version', { ascending: false }).limit(1).maybeSingle();
    if (tpl)
      await db.from('contracts').insert({
        booking_id: bookingId, template_id: tpl.id, status: 'accepted',
        rendered_html: contractText, content_sha256: contractHash,
        accepted_at: new Date().toISOString(), accepted_name: tenant.name,
        accepted_ip: req.headers.get('x-forwarded-for')?.split(',')[0] ?? null,
        accepted_user_agent: req.headers.get('user-agent'), signature_provider: 'clickwrap',
      });
  }

  // --- 4. PIX ---
  // Banco real sem Asaas configurado → pagamento manual (anfitrião envia o PIX pelo WhatsApp).
  if (db && !hasRealGateway()) {
    const manualExpires = new Date(Date.now() + MANUAL_HOLD_HOURS * 3_600_000);
    await db.from('bookings').update({ expires_at: manualExpires.toISOString() }).eq('id', bookingId);
    return NextResponse.json({
      demo: false,
      manualPayment: true,
      booking: { id: bookingId, code: bookingCode, expiresAt: manualExpires.toISOString() },
      contract: { version: contract.version, sha256: contractHash },
      pix: null,
      quote: q,
    });
  }

  const pix = await paymentGateway().createPixCharge({
    bookingId, bookingCode, amountCents: q.amountDueNowCents, expiresAt,
    description: `UaiCasa • Reserva ${bookingCode} • sinal`,
    customer: { name: tenant.name, document: doc, email: tenant.email, phone: tenant.phone },
  });
  if (db)
    await db.from('payments').insert({
      booking_id: bookingId, purpose: 'booking', method: 'pix', gateway: pix.gateway,
      gateway_payment_id: pix.gatewayPaymentId, amount_cents: q.amountDueNowCents,
      pix_qr_code_base64: pix.qrCodeBase64, pix_copy_paste: pix.copyPaste, due_at: pix.expiresAt,
    });

  return NextResponse.json({
    demo: isDemoMode(),
    manualPayment: false,
    booking: { id: bookingId, code: bookingCode, expiresAt: expiresAt.toISOString() },
    contract: { version: contract.version, sha256: contractHash },
    pix,
    quote: q,
  });
}
