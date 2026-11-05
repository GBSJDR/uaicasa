import { brl } from '@/lib/domain/pricing';
import type { Quote } from '@/lib/domain/types';

export default function QuoteSummary({ q, compact = false }: { q: Quote; compact?: boolean }) {
  // agrupa noites de mesmo valor: "R$ 900 × 3 diárias"
  const groups = new Map<string, { night: boolean; label: string; special?: string; count: number; amount: number }>();
  for (const l of q.lines) {
    const night = l.label.startsWith('Diária');
    const key = night ? `n|${l.amountCents}|${l.overrideLabel ?? ''}` : `o|${l.label}`;
    const g = groups.get(key);
    if (g) g.count++;
    else groups.set(key, { night, label: l.label, special: l.overrideLabel, count: 1, amount: l.amountCents });
  }

  return (
    <div className="space-y-2 text-sm">
      {[...groups.values()].map((g, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span className="text-musgo">
            {g.night ? `${brl(g.amount)} × ${g.count} ${g.count > 1 ? 'diárias' : 'diária'}` : g.label}
            {g.special && <em className="ml-1 not-italic text-terra">• {g.special}</em>}
          </span>
          <span className="whitespace-nowrap">{brl(g.amount * g.count)}</span>
        </div>
      ))}
      {q.extraGuestsCents > 0 && (
        <div className="flex justify-between">
          <span className="text-musgo">{q.mode === 'stay' ? 'Hóspedes extras' : 'Convidados extras'}</span>
          <span>{brl(q.extraGuestsCents)}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-musgo">Taxa de limpeza</span>
        <span>{brl(q.cleaningFeeCents)}</span>
      </div>
      <div className="flex justify-between border-t border-pedra/50 pt-2 text-base font-semibold">
        <span>Total</span>
        <span>{brl(q.totalCents)}</span>
      </div>
      {!compact && (
        <>
          <div className="flex justify-between rounded-lg bg-serra/10 px-3 py-2 font-medium text-serra-escuro">
            <span>Sinal via PIX agora</span>
            <span>{brl(q.amountDueNowCents)}</span>
          </div>
          <p className="text-xs leading-relaxed text-musgo">
            Saldo de {brl(q.totalCents - q.amountDueNowCents)} até a entrada. Caução reembolsável de{' '}
            {brl(q.securityDepositCents)} (devolvida após a vistoria).
          </p>
        </>
      )}
    </div>
  );
}
