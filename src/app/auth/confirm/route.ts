import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/** Link de uso único (token_hash) → cria a sessão e segue para `next` (ex.: definir senha). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token_hash = url.searchParams.get('token_hash');
  const type = (url.searchParams.get('type') ?? 'recovery') as EmailOtpType;
  const next = url.searchParams.get('next') ?? '/admin/senha';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/admin/senha';
  const sb = await supabaseServer();
  if (token_hash && sb) {
    const { error } = await sb.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL('/login?erro=link', url.origin));
}
