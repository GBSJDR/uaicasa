import 'server-only';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '../data/repository';
import { supabaseServer } from '../supabase/server';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

/** Exige usuário logado E cadastrado em admin_users. Senão, manda para /login. */
export async function requireAdmin(): Promise<AdminUser> {
  const sb = await supabaseServer();
  const db = supabaseAdmin();
  if (!sb || !db) redirect('/login?erro=config');
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect('/login');
  const { data: row } = await db.from('admin_users').select('full_name').eq('user_id', data.user.id).maybeSingle();
  if (!row) redirect('/login?erro=sem-acesso');
  return { id: data.user.id, email: data.user.email ?? '', name: row.full_name };
}
