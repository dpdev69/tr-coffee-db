import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  parseLimitedJsonBody,
  validateCorrectionReportPayload,
  validateJsonRequest,
} from '@/lib/api/intake-validation';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { applyPublicCoffeeVisibility } from '@/lib/public-coffee-visibility';

const MAX_CORRECTION_BODY_BYTES = 16_384;
const CORRECTION_RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const CORRECTION_RATE_LIMIT_MAX = 10;

export async function POST(request: Request) {
  const requestCheck = validateJsonRequest(request, MAX_CORRECTION_BODY_BYTES);
  if (!requestCheck.ok) {
    return NextResponse.json(
      { error: requestCheck.error },
      { status: requestCheck.status }
    );
  }

  const rateLimit = checkRateLimit({
    key: getRequestRateLimitKey(request),
    limit: CORRECTION_RATE_LIMIT_MAX,
    namespace: 'correction-report',
    windowMs: CORRECTION_RATE_LIMIT_WINDOW_MS,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: 'Too many correction reports' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  const body = await parseLimitedJsonBody(request, MAX_CORRECTION_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json(
      { error: body.error },
      { status: body.status }
    );
  }

  const payload = validateCorrectionReportPayload(body.data);
  if (!payload.ok) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Correction reporting is not configured' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  let coffeeQuery = supabase
    .from('coffees')
    .select('id, roaster_id')
    .eq('id', payload.data.coffee_id)
    .eq('roaster_id', payload.data.roaster_id);
  coffeeQuery = applyPublicCoffeeVisibility(coffeeQuery);

  const { data: coffee, error: coffeeError } = await coffeeQuery.maybeSingle();
  if (coffeeError) {
    console.error('Failed to validate coffee before correction report', {
      coffee_id: payload.data.coffee_id,
      code: coffeeError.code,
      message: coffeeError.message,
    });
    return NextResponse.json({ error: 'Failed to validate coffee' }, { status: 500 });
  }

  if (!coffee) {
    return NextResponse.json({ error: 'Coffee not found' }, { status: 404 });
  }

  const { error } = await supabase.from('correction_reports').insert({
    coffee_id: payload.data.coffee_id,
    roaster_id: payload.data.roaster_id,
    issue_type: payload.data.issue_type,
    reporter_email: payload.data.reporter_email,
    message: payload.data.message,
    source_path: payload.data.source_path,
  });

  if (error) {
    console.error('Failed to insert correction report', {
      coffee_id: payload.data.coffee_id,
      roaster_id: payload.data.roaster_id,
      code: error.code,
      message: error.message,
    });
    return NextResponse.json({ error: 'Failed to submit correction report' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function getRequestRateLimitKey(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  const origin = request.headers.get('origin') ?? 'unknown-origin';

  return `${forwardedFor || realIp || 'unknown-ip'}:${origin}`;
}
