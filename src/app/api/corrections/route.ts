import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { validateCorrectionPayload, validateJsonRequest } from '@/lib/api/intake-validation';

const MAX_CORRECTION_BODY_BYTES = 16_384;

export async function POST(request: Request) {
  const requestCheck = validateJsonRequest(request, MAX_CORRECTION_BODY_BYTES);
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

  const payload = validateCorrectionPayload(body);
  if (!payload.ok) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }

  if (payload.spam) {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Correction intake is not configured' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { error } = await supabase.from('correction_reports').insert({
    issue_type: payload.data.issue_type,
    reporter_email: payload.data.reporter_email,
    message: payload.data.message,
    source_path: payload.data.source_path,
    coffee_id: payload.data.coffee_id,
    roaster_id: payload.data.roaster_id,
  });

  if (error) {
    console.error('Failed to insert correction report', {
      issue_type: payload.data.issue_type,
      source_path: payload.data.source_path,
      coffee_id: payload.data.coffee_id,
      roaster_id: payload.data.roaster_id,
      code: error.code,
      message: error.message,
    });

    return NextResponse.json({ error: 'Failed to submit correction' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
