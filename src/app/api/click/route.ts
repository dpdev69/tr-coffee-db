import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const { coffee_id } = await request.json();
    if (typeof coffee_id !== 'string' || !UUID_PATTERN.test(coffee_id)) {
      return NextResponse.json({ error: 'Invalid coffee_id' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Click tracking is not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: coffee, error: coffeeError } = await supabase
      .from('coffees')
      .select('id')
      .eq('id', coffee_id)
      .eq('is_available', true)
      .maybeSingle();

    if (coffeeError) {
      return NextResponse.json({ error: 'Failed to validate coffee' }, { status: 500 });
    }

    if (!coffee) {
      return NextResponse.json({ error: 'Coffee not found' }, { status: 404 });
    }

    const { error: rpcError } = await supabase.rpc('increment_click', { coffee_id });
    if (rpcError) {
      return NextResponse.json({ error: 'Failed to track click' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to track click' }, { status: 500 });
  }
}
