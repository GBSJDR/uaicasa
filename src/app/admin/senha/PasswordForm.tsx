'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function PasswordForm() {
  const router = useRouter();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (p1.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
    if (p1 !== p2) return setError('As senhas não conferem.');
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) return setError(/same|different/i.test(error.message) ? 'Escolha uma senha diferente da anterior.' : 'Não foi possível salvar. Tente de novo.');
    router.replace('/admin');
    router.refresh();
  };

  const input = 'focus-ring w-full rounded-xl border border-pedra/60 px-4 py-3';
  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <input type="password" required autoComplete="new-password" placeholder="Nova senha (mín. 8 caracteres)" value={p1} onChange={(e) => setP1(e.target.value)} className={input} />
      <input type="password" required autoComplete="new-password" placeholder="Repita a senha" value={p2} onChange={(e) => setP2(e.target.value)} className={input} />
      {error && <p className="text-sm text-terra-escuro">{error}</p>}
      <button disabled={busy} className="focus-ring w-full rounded-xl bg-serra px-4 py-3 font-semibold text-white disabled:opacity-50">
        {busy ? 'Salvando…' : 'Salvar senha e entrar'}
      </button>
    </form>
  );
}
