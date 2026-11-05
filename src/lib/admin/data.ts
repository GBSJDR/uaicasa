import 'server-only';
import { addDays, todayInSaoPaulo } from '../domain/dates';
import type { DemoBooking, DemoExpense } from '../data/demo';
import { loadPricingContext, supabaseAdmin } from '../data/repository';

export type AdminBooking = Omit<DemoBooking, 'status' | 'source'> & {
  id?: string;
  status: DemoBooking['status'] | 'expired' | 'checked_in' | 'no_show';
  source: string;
};

/** Carrega reservas, despesas e calendário reais do banco para o painel. */
export async function loadAdminData() {
  const db = supabaseAdmin()!;
  const today = todayInSaoPaulo();
  const ctx = await loadPricingContext();

  const { data: rows } = await db
    .from('bookings')
    .select('id, code, mode, status, source, start_date, end_date, guests_count, total_cents, guests(full_name, phone), payments(amount_cents, status)')
    .gte('end_date', addDays(today, -120))
    .order('start_date', { ascending: false })
    .limit(300);

  const bookings: AdminBooking[] = (rows ?? []).map((b: any) => ({
    id: b.id,
    code: b.code,
    mode: b.mode,
    status: b.status,
    source: b.source,
    guest: b.guests?.full_name ?? '—',
    phone: b.guests?.phone ?? '',
    start: b.start_date,
    end: b.end_date,
    guests: b.guests_count,
    totalCents: b.total_cents,
    paidCents: (b.payments ?? [])
      .filter((p: any) => p.status === 'received' || p.status === 'confirmed')
      .reduce((s: number, p: any) => s + p.amount_cents, 0),
  }));

  const { data: tx } = await db
    .from('financial_transactions')
    .select('occurred_on, category, description, amount_cents, type')
    .eq('type', 'expense')
    .gte('occurred_on', addDays(today, -90))
    .order('occurred_on', { ascending: false });

  const expenses: DemoExpense[] = (tx ?? []).map((t: any) => ({
    date: t.occurred_on, category: t.category, description: t.description, amountCents: t.amount_cents,
  }));

  return { today, property: ctx.property, bookings, expenses, holds: ctx.holds, overrides: ctx.overrides };
}
