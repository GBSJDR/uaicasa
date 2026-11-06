import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/** Retorno dos e-mails do Supabase (criar/trocar senha). `next` só aceita caminhos internos. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/admin';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/admin';
  const sb = await supabaseServer();
  if (code && sb) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL('/login?erro=link', url.origin));
}
