import type { Metadata } from 'next';
import { Logo } from '@/components/SiteHeader';
import { requireAdmin } from '@/lib/admin/auth';
import PasswordForm from './PasswordForm';

export const metadata: Metadata = { title: 'Definir senha — UaiCasa', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function SenhaPage() {
  const user = await requireAdmin();
  return (
    <main className="grid min-h-screen place-items-center bg-pedra-textura px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl ring-1 ring-areia">
        <Logo />
        <h1 className="mt-6 font-display text-2xl text-serra-escuro">Defina sua senha</h1>
        <p className="mt-1 text-sm text-musgo">{user.email}</p>
        <PasswordForm />
      </div>
    </main>
  );
}
