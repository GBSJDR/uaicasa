'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setState('error');
      setMsg(/signups not allowed|not found/i.test(error.message) ? 'Este e-mail não tem acesso ao painel.' : 'Não foi possível enviar agora. Tente de novo em alguns minutos.');
    } else setState('sent');
  };

  if (state === 'sent')
    return (
      <div className="mt-6 rounded-xl bg-serra/10 p-4 text-sm text-serra-escuro">
        📩 Enviamos um link para <strong>{email}</strong>. Abra o e-mail <strong>neste mesmo aparelho</strong> e toque em
        “Entrar”. Confira também a caixa de spam.
      </div>
    );

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="seu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="focus-ring w-full rounded-xl border border-pedra/60 px-4 py-3"
      />
      {state === 'error' && <p className="text-sm text-terra-escuro">{msg}</p>}
      <button disabled={state === 'sending'} className="focus-ring w-full rounded-xl bg-serra px-4 py-3 font-semibold text-white hover:bg-serra-escuro disabled:opacity-50">
        {state === 'sending' ? 'Enviando…' : 'Receber link de acesso'}
      </button>
    </form>
  );
}
