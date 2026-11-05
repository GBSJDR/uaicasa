/**
 * Gateway de pagamento — interface única com adaptador Asaas (recomendado)
 * e um adaptador "mock" para o protótipo rodar sem credenciais.
 *
 * Por que Asaas: PIX com tarifa fixa baixa, QR Code dinâmico com vencimento,
 * webhook com token, cadastro de cliente com CPF/CNPJ (exigido p/ contrato)
 * e split/repasse para o futuro multi-imóvel. Mercado Pago entra com o mesmo
 * contrato de interface (createPixCharge / parseWebhook).
 */
import 'server-only';

export interface PixChargeInput {
  bookingId: string;
  bookingCode: string;
  amountCents: number;
  description: string;
  expiresAt: Date;
  customer: { name: string; document: string; email: string; phone: string };
}

export interface PixCharge {
  gateway: 'asaas' | 'mock';
  gatewayPaymentId: string;
  qrCodeBase64: string | null; // PNG base64
  copyPaste: string;
  expiresAt: string;
}

export interface PaymentWebhook {
  eventId: string;
  gatewayPaymentId: string;
  bookingId: string | null; // externalReference
  status: 'received' | 'confirmed' | 'overdue' | 'refunded' | 'other';
  amountCents: number;
  netAmountCents: number | null;
}

export interface PaymentGateway {
  createPixCharge(input: PixChargeInput): Promise<PixCharge>;
  /** Valida a autenticidade e normaliza o evento. Lança erro se inválido. */
  parseWebhook(headers: Headers, body: unknown): PaymentWebhook | null;
}

// ---------------------------------------------------------------------------
class AsaasGateway implements PaymentGateway {
  constructor(
    private apiKey: string,
    private baseUrl: string,
    private webhookToken: string,
  ) {}

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', access_token: this.apiKey, 'User-Agent': 'uaicasa' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Asaas ${path} → ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  async createPixCharge(i: PixChargeInput): Promise<PixCharge> {
    const cpfCnpj = i.customer.document.replace(/\D/g, '');
    const found = await this.call<{ data: { id: string }[] }>(`/customers?cpfCnpj=${cpfCnpj}`);
    const customerId =
      found.data[0]?.id ??
      (
        await this.call<{ id: string }>('/customers', {
          method: 'POST',
          body: JSON.stringify({
            name: i.customer.name,
            cpfCnpj,
            email: i.customer.email,
            mobilePhone: i.customer.phone.replace(/\D/g, '').replace(/^55/, ''),
            notificationDisabled: true,
          }),
        })
      ).id;

    const payment = await this.call<{ id: string }>('/payments', {
      method: 'POST',
      body: JSON.stringify({
        customer: customerId,
        billingType: 'PIX',
        value: i.amountCents / 100,
        dueDate: i.expiresAt.toISOString().slice(0, 10),
        description: i.description,
        externalReference: i.bookingId,
      }),
    });
    const qr = await this.call<{ encodedImage: string; payload: string; expirationDate: string }>(
      `/payments/${payment.id}/pixQrCode`,
    );
    return {
      gateway: 'asaas',
      gatewayPaymentId: payment.id,
      qrCodeBase64: qr.encodedImage,
      copyPaste: qr.payload,
      expiresAt: i.expiresAt.toISOString(),
    };
  }

  parseWebhook(headers: Headers, body: any): PaymentWebhook | null {
    if (headers.get('asaas-access-token') !== this.webhookToken) throw new Error('Webhook não autorizado');
    const p = body?.payment;
    if (!p) return null;
    const map: Record<string, PaymentWebhook['status']> = {
      PAYMENT_RECEIVED: 'received',
      PAYMENT_CONFIRMED: 'confirmed',
      PAYMENT_OVERDUE: 'overdue',
      PAYMENT_REFUNDED: 'refunded',
    };
    return {
      eventId: body.id ?? `${body.event}:${p.id}`,
      gatewayPaymentId: p.id,
      bookingId: p.externalReference ?? null,
      status: map[body.event] ?? 'other',
      amountCents: Math.round(p.value * 100),
      netAmountCents: p.netValue != null ? Math.round(p.netValue * 100) : null,
    };
  }
}

// ---------------------------------------------------------------------------
class MockGateway implements PaymentGateway {
  async createPixCharge(i: PixChargeInput): Promise<PixCharge> {
    const amount = (i.amountCents / 100).toFixed(2);
    return {
      gateway: 'mock',
      gatewayPaymentId: `mock_${i.bookingCode}`,
      qrCodeBase64: null,
      // payload ilustrativo (não é um BR Code válido)
      copyPaste: `00020126580014BR.GOV.BCB.PIX0136uaicasa-demo-${i.bookingCode}520400005303986540${amount.length}${amount}5802BR5907UAICASA6015SAO JOAO DEL RE62120508${i.bookingCode}6304DEMO`,
      expiresAt: i.expiresAt.toISOString(),
    };
  }
  parseWebhook(_h: Headers, body: any): PaymentWebhook | null {
    return body?.bookingId
      ? { eventId: `mock:${Date.now()}`, gatewayPaymentId: 'mock', bookingId: body.bookingId, status: 'received', amountCents: body.amountCents ?? 0, netAmountCents: null }
      : null;
  }
}

export function paymentGateway(): PaymentGateway {
  const key = process.env.ASAAS_API_KEY;
  if (!key) return new MockGateway();
  return new AsaasGateway(
    key,
    process.env.ASAAS_BASE_URL ?? 'https://api-sandbox.asaas.com/v3',
    process.env.ASAAS_WEBHOOK_TOKEN ?? '',
  );
}
