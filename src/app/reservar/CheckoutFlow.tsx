'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import QuoteSummary from '@/components/QuoteSummary';
import { waHref } from '@/components/SiteHeader';
import { buildContract } from '@/lib/contracts/contract';
import { PROPERTY } from '@/lib/data/demo';
import { formatBR } from '@/lib/domain/dates';
import { brl } from '@/lib/domain/pricing';
import type { Quote } from '@/lib/domain/types';

interface BookingResult {
  demo: boolean;
  manualPayment: boolean;
  booking: { id: string; code: string; expiresAt: string };
  contract: { version: string; sha256: string };
  pix: { qrCodeBase64: string | null; copyPaste: string; expiresAt: string } | null;
  quote: Quote;
}

const maskDoc = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
};
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.length > 10 ? d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3') : d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
};

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; span?: string }) {
  const { label, span = '', ...rest } = props;
  return (
    <label className={`block ${span}`}>
      <span className="text-xs font-medium text-musgo">{label}</span>
      <input {...rest} className="focus-ring mt-1 w-full rounded-xl border border-pedra/60 bg-white px-3 py-2.5 text-sm" />
    </label>
  );
}

export default function CheckoutFlow({ params }: { params: Record<string, string> }) {
  const request = useMemo(
    () =>
      params.mode === 'event'
        ? { mode: 'event' as const, date: params.date, guests: +params.guests || 1, extraHours: +params.extraHours || 0 }
        : { mode: 'stay' as const, checkIn: params.checkIn, checkOut: params.checkOut, guests: +params.guests || 1 },
    [params],
  );
  const [quote, setQuote] = useState<Quote | null>(null);
  const [form, setForm] = useState({
    fullName: '', document: '', email: '', phone: '', zip: '', street: '', number: '', district: '', city: '', state: 'MG', eventType: '',
  });
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    fetch('/api/quote', { method: 'POST', body: JSON.stringify(request) })
      .then((r) => r.json())
      .then(setQuote)
      .catch(() => setError('Não foi possível calcular a reserva.'));
  }, [request]);

  // Busca endereço pelo CEP (ViaCEP)
  useEffect(() => {
    const cep = form.zip.replace(/\D/g, '');
    if (cep.length !== 8) return;
    fetch(`https://viacep.com.br/ws/${cep}/json/`)
      .then((r) => r.json())
      .then((a) => {
        if (a.erro) return;
        setForm((f) => ({ ...f, street: a.logradouro || f.street, district: a.bairro || f.district, city: a.localidade || f.city, state: a.uf || f.state }));
      })
      .catch(() => {});
  }, [form.zip]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value;
    if (k === 'document') v = maskDoc(v);
    if (k === 'phone') v = maskPhone(v);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const contract = quote?.ok
    ? buildContract(quote, PROPERTY, {
        name: form.fullName || '[nome]',
        document: form.document || '[CPF/CNPJ]',
        email: form.email || '[e-mail]',
        phone: form.phone || '[telefone]',
        address: [form.street, form.number, form.district, form.city, form.state].filter(Boolean).join(', '),
      })
    : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({ request, guest: form, eventType: form.eventType, acceptedContract: accepted }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) return setError(json.error ?? 'Erro ao reservar.');
    setResult(json);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!quote) return <p className="py-20 text-center text-musgo">{error ?? 'Carregando sua reserva…'}</p>;

  if (!quote.ok)
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-display text-3xl text-serra-escuro">Ops, essas datas não estão disponíveis</h1>
        <ul className="mt-4 text-terra-escuro">{quote.errors.map((e) => <li key={e.code}>{e.message}</li>)}</ul>
        <Link href="/#reservar" className="mt-6 inline-block rounded-xl bg-serra px-5 py-3 font-medium text-white">Escolher outras datas</Link>
      </div>
    );

  const when =
    quote.mode === 'stay'
      ? `${formatBR(quote.startDate)} → ${formatBR(quote.endDate)} • ${quote.nights} diárias`
      : `${formatBR(quote.startDate)} • ${PROPERTY.eventStartTime}–${PROPERTY.eventEndTime}`;

  const summaryCard = (
    <aside className="h-fit rounded-3xl bg-white p-6 shadow-lg ring-1 ring-areia lg:sticky lg:top-6">
      <div className="flex gap-4">
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl">
          <Image src={quote.mode === 'stay' ? '/fotos/fachada-piscina.jpg' : '/fotos/espaco-gourmet.jpg'} alt="" fill sizes="112px" className="object-cover" />
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${quote.mode === 'stay' ? 'text-serra' : 'text-terra'}`}>
            {quote.mode === 'stay' ? 'Hospedagem' : 'Evento / Day use'}
          </p>
          <p className="font-display text-lg">UaiCasa</p>
          <p className="text-sm text-musgo">{when}</p>
          <p className="text-sm text-musgo">{quote.guests} {quote.mode === 'stay' ? 'hóspedes' : 'convidados'}</p>
        </div>
      </div>
      <div className="mt-5 border-t border-areia pt-5">
        <QuoteSummary q={quote} />
      </div>
    </aside>
  );

  // ---------------- PIX ----------------
  if (result) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-3xl bg-white p-6 ring-1 ring-areia sm:p-8">
          {result.manualPayment ? (
            <div>
              <h1 className="font-display text-2xl text-serra-escuro sm:text-3xl">Reserva pré-agendada! 🏡</h1>
              <p className="mt-1 text-sm text-musgo">
                Código <strong>{result.booking.code}</strong> • suas datas ficam seguradas por 24 horas.
              </p>
              {result.pix ? (
                <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`data:image/png;base64,${result.pix.qrCodeBase64}`} alt="QR Code PIX" className="h-52 w-52 rounded-xl ring-1 ring-areia" />
                  <div className="w-full">
                    <p className="text-sm text-musgo">Sinal via PIX</p>
                    <p className="font-display text-3xl">{brl(result.quote.amountDueNowCents)}</p>
                    <div className="mt-3 break-all rounded-xl bg-creme p-3 font-mono text-[11px] text-musgo">{result.pix.copyPaste}</div>
                    <button onClick={() => navigator.clipboard.writeText(result.pix?.copyPaste ?? '')} className="focus-ring mt-3 w-full rounded-xl bg-serra px-4 py-3 font-semibold text-white hover:bg-serra-escuro">
                      Copiar código PIX
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-musgo">O anfitrião vai te enviar o PIX do sinal de <strong>{brl(result.quote.amountDueNowCents)}</strong> pelo WhatsApp.</p>
              )}
              <a
                href={waHref(
                  result.pix
                    ? `Olá! Paguei o sinal de ${brl(result.quote.amountDueNowCents)} da reserva ${result.booking.code} na UaiCasa (${when}). Segue o comprovante:`
                    : `Olá! Fiz a pré-reserva ${result.booking.code} na UaiCasa (${when}, ${quote.guests} pessoas). Pode me enviar o PIX do sinal de ${brl(result.quote.amountDueNowCents)}?`,
                )}
                target="_blank" rel="noopener"
                className="mt-6 block rounded-xl bg-emerald-600 px-6 py-3 text-center font-semibold text-white"
              >
                {result.pix ? 'Já paguei — enviar comprovante no WhatsApp' : 'Pedir o PIX no WhatsApp'}
              </a>
              <p className="mt-3 text-xs text-musgo">A reserva é confirmada assim que o anfitrião receber o comprovante.</p>
              <p className="mt-4 text-[11px] text-musgo">Contrato {result.contract.version} aceito • SHA-256 {result.contract.sha256.slice(0, 16)}…</p>
            </div>
          ) : !result.pix ? null : paid ? (
            <div className="text-center">
              <p className="text-5xl">🎉</p>
              <h1 className="mt-3 font-display text-3xl text-serra-escuro">Reserva confirmada!</h1>
              <p className="mt-2 text-musgo">Código <strong>{result.booking.code}</strong>. Enviamos o contrato assinado para {form.email}.</p>
              <a href={waHref(`Olá! Acabei de confirmar a reserva ${result.booking.code} na UaiCasa.`)} target="_blank" rel="noopener" className="mt-6 inline-block rounded-xl bg-serra px-6 py-3 font-semibold text-white">
                Falar com o anfitrião no WhatsApp
              </a>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl text-serra-escuro sm:text-3xl">Pague o sinal com PIX</h1>
              <p className="mt-1 text-sm text-musgo">
                Reserva <strong>{result.booking.code}</strong> • datas seguradas até{' '}
                {new Date(result.booking.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                {result.pix?.qrCodeBase64 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`data:image/png;base64,${result.pix?.qrCodeBase64}`} alt="QR Code PIX" className="h-52 w-52 rounded-xl ring-1 ring-areia" />
                ) : (
                  <div className="grid h-52 w-52 shrink-0 place-items-center rounded-xl bg-areia p-4 text-center text-xs text-musgo">
                    QR Code de demonstração<br />(configure ASAAS_API_KEY)
                  </div>
                )}
                <div className="w-full">
                  <p className="font-display text-3xl">{brl(result.quote.amountDueNowCents)}</p>
                  <p className="mt-3 text-xs font-medium text-musgo">PIX copia e cola</p>
                  <div className="mt-1 break-all rounded-xl bg-creme p-3 font-mono text-[11px] text-musgo">{result.pix?.copyPaste}</div>
                  <button onClick={() => navigator.clipboard.writeText(result.pix?.copyPaste ?? "")} className="focus-ring mt-3 w-full rounded-xl bg-serra px-4 py-3 font-semibold text-white hover:bg-serra-escuro">
                    Copiar código PIX
                  </button>
                  <p className="mt-3 text-xs text-musgo">A confirmação é automática assim que o banco avisar o pagamento — você recebe o contrato por e-mail e WhatsApp.</p>
                  {result.demo && (
                    <button onClick={() => setPaid(true)} className="mt-4 w-full rounded-xl border border-dashed border-terra px-4 py-2 text-sm text-terra">
                      Simular pagamento (modo demonstração)
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-6 text-[11px] text-musgo">Contrato {result.contract.version} aceito • SHA-256 {result.contract.sha256.slice(0, 16)}…</p>
            </>
          )}
        </section>
        {summaryCard}
      </div>
    );
  }

  // ---------------- FORMULÁRIO ----------------
  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <form onSubmit={submit} className="space-y-8">
        <div>
          <Link href="/#reservar" className="text-sm text-musgo hover:underline">← Alterar datas</Link>
          <h1 className="mt-2 font-display text-3xl text-serra-escuro">Finalizar reserva</h1>
        </div>

        <fieldset className="grid gap-4 rounded-3xl bg-white p-6 ring-1 ring-areia sm:grid-cols-2">
          <legend className="px-1 font-display text-lg">Dados do responsável</legend>
          <Field label="Nome completo" required value={form.fullName} onChange={set('fullName')} span="sm:col-span-2" autoComplete="name" />
          <Field label="CPF ou CNPJ" required value={form.document} onChange={set('document')} inputMode="numeric" />
          <Field label="WhatsApp" required value={form.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" />
          <Field label="E-mail" type="email" required value={form.email} onChange={set('email')} span="sm:col-span-2" autoComplete="email" />
          {quote.mode === 'event' && (
            <Field label="Tipo de evento (ex.: aniversário de 15 anos)" value={form.eventType} onChange={set('eventType')} span="sm:col-span-2" />
          )}
        </fieldset>

        <fieldset className="grid gap-4 rounded-3xl bg-white p-6 ring-1 ring-areia sm:grid-cols-6">
          <legend className="px-1 font-display text-lg">Endereço (para o contrato)</legend>
          <Field label="CEP" value={form.zip} onChange={set('zip')} inputMode="numeric" span="sm:col-span-2" autoComplete="postal-code" />
          <Field label="Rua" value={form.street} onChange={set('street')} span="sm:col-span-4" />
          <Field label="Número" value={form.number} onChange={set('number')} span="sm:col-span-2" />
          <Field label="Bairro" value={form.district} onChange={set('district')} span="sm:col-span-4" />
          <Field label="Cidade" value={form.city} onChange={set('city')} span="sm:col-span-4" />
          <Field label="UF" value={form.state} onChange={set('state')} maxLength={2} span="sm:col-span-2" />
        </fieldset>

        {contract && (
          <section className="rounded-3xl bg-white p-6 ring-1 ring-areia">
            <h2 className="font-display text-lg">{contract.title}</h2>
            <div className="mt-3 max-h-72 space-y-3 overflow-y-auto rounded-xl bg-creme p-4 text-xs leading-relaxed text-musgo">
              {contract.clauses.map((c, i) => (
                <p key={c.title}><strong className="text-tinta">Cláusula {i + 1}ª — {c.title}.</strong> {c.text}</p>
              ))}
            </div>
            <label className="mt-4 flex items-start gap-3 text-sm">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-serra" required />
              <span>Li e aceito o {contract.title}. Entendo que este aceite eletrônico tem validade jurídica (MP 2.200-2/2001, art. 10, §2º) e será registrado com data, hora e IP.</span>
            </label>
          </section>
        )}

        {error && <p className="rounded-xl bg-terra/10 p-3 text-sm text-terra-escuro">{error}</p>}

        <button
          disabled={submitting || !accepted}
          className={`focus-ring w-full rounded-xl px-6 py-4 text-lg font-semibold text-white disabled:opacity-40 ${quote.mode === 'stay' ? 'bg-serra hover:bg-serra-escuro' : 'bg-terra hover:bg-terra-escuro'}`}
        >
          {submitting ? 'Gerando PIX…' : `Gerar PIX de ${brl(quote.amountDueNowCents)}`}
        </button>
      </form>
      {summaryCard}
    </div>
  );
}
