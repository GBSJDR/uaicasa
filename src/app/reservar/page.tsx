import SiteHeader from '@/components/SiteHeader';
import CheckoutFlow from './CheckoutFlow';
import { loadPricingContext } from '@/lib/data/repository';

export const metadata = { title: 'Finalizar reserva — UaiCasa' };

export default async function ReservarPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { property } = await loadPricingContext();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <CheckoutFlow params={sp} property={property} />
      </main>
    </>
  );
}
