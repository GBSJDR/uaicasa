import SiteHeader from '@/components/SiteHeader';
import CheckoutFlow from './CheckoutFlow';

export const metadata = { title: 'Finalizar reserva — UaiCasa' };

export default async function ReservarPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <CheckoutFlow params={sp} />
      </main>
    </>
  );
}
