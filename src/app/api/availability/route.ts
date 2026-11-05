import { NextResponse } from 'next/server';
import { loadPricingContext } from '@/lib/data/repository';
import { dailyAvailability } from '@/lib/domain/availability';
import { addDays, diffDays } from '@/lib/domain/dates';
import { priceForDate } from '@/lib/domain/pricing';

/** GET /api/availability?from=2026-12-01&to=2027-02-01 → status e preço de cada dia */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ctx = await loadPricingContext();
  const from = url.searchParams.get('from') ?? ctx.today;
  let to = url.searchParams.get('to') ?? addDays(from, 62);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    return NextResponse.json({ error: 'Datas inválidas' }, { status: 400 });
  if (diffDays(from, to) > 400) to = addDays(from, 400);

  const days = dailyAvailability(from, to, ctx.property, ctx.holds).map((d) => {
    const past = d.date < ctx.today;
    const stay = priceForDate(d.date, 'stay', ctx);
    const event = priceForDate(d.date, 'event', ctx);
    const eventClosed = ctx.overrides.some(
      (o) => o.eventsAllowed === false && (o.scope !== 'stay') && d.date >= o.from && d.date < o.to,
    );
    const tooSoonForEvent = diffDays(ctx.today, d.date) < ctx.property.eventMinLeadDays;
    return {
      date: d.date,
      past,
      nightFree: d.nightFree && !past,
      canCheckOut: d.canCheckOut,
      eventFree: d.eventFree && !past && !eventClosed && !tooSoonForEvent,
      stayPriceCents: stay.amountCents,
      eventPriceCents: event.amountCents,
      label: stay.override?.label ?? event.override?.label ?? null,
    };
  });

  return NextResponse.json(
    { today: ctx.today, rules: ctx.rules, property: ctx.property, days },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
  );
}
