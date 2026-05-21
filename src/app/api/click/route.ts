import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { validateClickPayload, validateJsonRequest } from '@/lib/api/intake-validation';

const MAX_CLICK_BODY_BYTES = 16_384;

export async function POST(request: Request) {
  const requestCheck = validateJsonRequest(request, MAX_CLICK_BODY_BYTES);
  if (!requestCheck.ok) {
    return NextResponse.json(
      { error: requestCheck.error },
      { status: requestCheck.status }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const payload = validateClickPayload(body);
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

  const { data: coffee, error: coffeeError } = await supabase
    .from('coffees')
    .select('id, roaster_id')
    .eq('id', payload.data.coffee_id)
    .eq('is_available', true)
    .maybeSingle();

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
