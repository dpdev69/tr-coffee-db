import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  parseLimitedJsonBody,
  validateClickPayload,
  validateJsonRequest,
} from '@/lib/api/intake-validation';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { applyPublicCoffeeVisibility } from '@/lib/public-coffee-visibility';

const MAX_CLICK_BODY_BYTES = 16_384;
const CLICK_RATE_LIMIT_WINDOW_MS = 60_000;
const CLICK_RATE_LIMIT_MAX = 60;

export async function POST(request: Request) {
  const requestCheck = validateJsonRequest(request, MAX_CLICK_BODY_BYTES);
  if (!requestCheck.ok) {
    return NextResponse.json(
      { error: requestCheck.error },
      { status: requestCheck.status }
    );
  }

  const rateLimit = checkRateLimit({
    key: getRequestRateLimitKey(request),
    limit: CLICK_RATE_LIMIT_MAX,
    namespace: 'click',
    windowMs: CLICK_RATE_LIMIT_WINDOW_MS,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: 'Too many click events' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  const body = await parseLimitedJsonBody(request, MAX_CLICK_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json(
      { error: body.error },
      { status: body.status }
    );
  }

  const payload = validateClickPayload(body.data);
  if (!payload.ok) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Click tracking is not configured' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  let coffeeQuery = supabase
    .from('coffees')
    .select('id, roaster_id')
    .eq('id', payload.data.coffee_id);
  coffeeQuery = applyPublicCoffeeVisibility(coffeeQuery);

  const { data: coffee, error: coffeeError } = await coffeeQuery.maybeSingle();
  // applyPublicCoffeeVisibility above ensures hidden coffees 404 before analytics writes.

  if (coffeeError) {
    console.error('Failed to validate coffee before click tracking', {
      coffee_id: payload.data.coffee_id,
      code: coffeeError.code,
      message: coffeeError.message,
    });
    return NextResponse.json({ error: 'Failed to validate coffee' }, { status: 500 });
  }

  if (!coffee) {
    return NextResponse.json({ error: 'Coffee not found' }, { status: 404 });
  }

  const [eventResult, clickResult] = await Promise.all([
    supabase.from('redirect_events').insert({
      coffee_id: coffee.id,
      roaster_id: coffee.roaster_id,
      source: payload.data.source,
      filter_context: payload.data.filter_context,
      quiz_context: payload.data.quiz_context,
      page_path: payload.data.page_path,
    }),
    supabase.rpc('increment_click', { coffee_id: coffee.id }),
  ]);

  if (eventResult.error) {
    console.error('Failed to insert redirect event', {
      coffee_id: coffee.id,
      roaster_id: coffee.roaster_id,
      source: payload.data.source,
      code: eventResult.error.code,
      message: eventResult.error.message,
    });
  }

  if (clickResult.error) {
    console.error('Failed to increment click count', {
      coffee_id: coffee.id,
      code: clickResult.error.code,
      message: clickResult.error.message,
    });
  }

  return NextResponse.json({ ok: true });
}

function getRequestRateLimitKey(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  const origin = request.headers.get('origin') ?? 'unknown-origin';

  return `${forwardedFor || realIp || 'unknown-ip'}:${origin}`;
}
