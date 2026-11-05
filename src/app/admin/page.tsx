import type { Metadata } from 'next';
import AdminDashboard from './AdminDashboard';
import { OVERRIDES, PROPERTY, demoBookings, demoExpenses, demoHolds } from '@/lib/data/demo';
import { todayInSaoPaulo } from '@/lib/domain/dates';

export const metadata: Metadata = { title: 'Painel — UaiCasa', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Protótipo com dados de demonstração.
 * Em produção: proteger com Supabase Auth (middleware) + RLS `is_admin()`,
 * e trocar as fontes por `bookings`, `financial_transactions`, `v_dre_monthly`, `v_occupancy_monthly`.
 */
export default function AdminPage() {
  const today = todayInSaoPaulo();
  return (
    <AdminDashboard
      today={today}
      property={PROPERTY}
      bookings={demoBookings(today)}
      expenses={demoExpenses(today)}
      holds={demoHolds(today)}
      overrides={OVERRIDES}
    />
  );
}
