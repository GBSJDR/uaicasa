import type { Metadata } from 'next';
import LoginForm from './LoginForm';
import { Logo } from '@/components/SiteHeader';

export const metadata: Metadata = { title: 'Entrar — UaiCasa', robots: { index: false } };

const ERRORS: Record<string, string> = {
  'sem-acesso': 'Este e-mail não tem acesso ao painel.',
  config: 'Login ainda não configurado no servidor.',
  link: 'O link expirou ou já foi usado. Peça um novo.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-pedra-textura px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl ring-1 ring-areia">
        <Logo />
        <h1 className="mt-6 font-display text-2xl text-serra-escuro">Painel do anfitrião</h1>
        <p className="mt-1 text-sm text-musgo">Digite seu e-mail e enviaremos um link de acesso. Sem senha.</p>
        {erro && <p className="mt-4 rounded-xl bg-terra/10 p-3 text-sm text-terra-escuro">{ERRORS[erro] ?? 'Não foi possível entrar.'}</p>}
        <LoginForm />
      </div>
    </main>
  );
}
