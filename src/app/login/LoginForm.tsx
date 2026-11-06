'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState('');

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('busy');
    setError('');
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      setState('idle');
      setError(/invalid/i.test(error.message) ? 'E-mail ou senha incorretos. Primeiro acesso? Use “Criar ou trocar senha”.' : 'Não foi possível entrar agora.');
      return;
    }
    router.replace('/admin');
    router.refresh();
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('busy');
    setError('');
    const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${location.origin}/auth/callback?next=/admin/senha`,
    });
    if (error) {
      setState('idle');
      setError(/rate|seconds/i.test(error.message) ? 'Aguarde um minuto antes de pedir outro e-mail.' : 'Não foi possível enviar agora.');
    } else setState('sent');
  };

  const input = 'focus-ring w-full rounded-xl border border-pedra/60 px-4 py-3';

  if (mode === 'reset')
    return state === 'sent' ? (
      <div className="mt-6 space-y-4">
        <p className="rounded-xl bg-serra/10 p-4 text-sm text-serra-escuro">
          📩 Se <strong>{email}</strong> tiver acesso ao painel, você vai receber um e-mail para criar a senha. Abra o link
          e defina sua senha — depois é só entrar com e-mail e senha. Confira também o spam.
        </p>
        <button onClick={() => { setMode('login'); setState('idle'); }} className="text-sm text-serra underline">Voltar para o login</button>
      </div>
    ) : (
      <form onSubmit={reset} className="mt-6 space-y-3">
        <p className="text-sm text-musgo">Primeiro acesso ou esqueceu a senha? Enviaremos um e-mail para você criar uma nova.</p>
        <input type="email" required autoComplete="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        {error && <p className="text-sm text-terra-escuro">{error}</p>}
        <button disabled={state === 'busy'} className="focus-ring w-full rounded-xl bg-serra px-4 py-3 font-semibold text-white disabled:opacity-50">
          {state === 'busy' ? 'Enviando…' : 'Enviar e-mail para criar senha'}
        </button>
        <button type="button" onClick={() => setMode('login')} className="w-full text-sm text-musgo underline">Voltar</button>
      </form>
    );

  return (
    <form onSubmit={login} className="mt-6 space-y-3">
      <input type="email" required autoComplete="username" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      <input type="password" required autoComplete="current-password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
      {error && <p className="text-sm text-terra-escuro">{error}</p>}
      <button disabled={state === 'busy'} className="focus-ring w-full rounded-xl bg-serra px-4 py-3 font-semibold text-white hover:bg-serra-escuro disabled:opacity-50">
        {state === 'busy' ? 'Entrando…' : 'Entrar'}
      </button>
      <button type="button" onClick={() => { setMode('reset'); setError(''); }} className="w-full text-sm text-musgo underline">
        Primeiro acesso / Criar ou trocar senha
      </button>
    </form>
  );
}
