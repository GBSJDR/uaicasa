import { NextResponse } from 'next/server';
import { loadPricingContext } from '@/lib/data/repository';
import { quote } from '@/lib/domain/pricing';
import { parseBookingRequest } from '@/lib/domain/validation';

export async function POST(req: Request) {
  const body = parseBookingRequest(await req.json().catch(() => null));
  if (!body) return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 });
  const ctx = await loadPricingContext();
  return NextResponse.json(quote(body, ctx));
}
