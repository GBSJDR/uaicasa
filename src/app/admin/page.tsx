import type { Metadata } from 'next';
import AdminDashboard from './AdminDashboard';
import { OVERRIDES, PROPERTY, demoBookings, demoExpenses, demoHolds } from '@/lib/data/demo';
import { isDemoMode } from '@/lib/data/repository';
import { requireAdmin } from '@/lib/admin/auth';
import { loadAdminData } from '@/lib/admin/data';
import { loadPricingAdmin } from '@/lib/admin/pricing';
import { todayInSaoPaulo } from '@/lib/domain/dates';

export const metadata: Metadata = { title: 'Painel — UaiCasa', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (isDemoMode()) {
    const today = todayInSaoPaulo();
    return (
      <AdminDashboard live={false} userName="Demonstração" today={today} property={PROPERTY}
        bookings={demoBookings(today)} expenses={demoExpenses(today)} holds={demoHolds(today)} overrides={OVERRIDES} />
    );
  }
  const user = await requireAdmin();
  const [data, pricing] = await Promise.all([loadAdminData(), loadPricingAdmin()]);
  return <AdminDashboard live userName={user.name} pricing={pricing} {...data} />;
}
