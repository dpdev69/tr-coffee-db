import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { coffee_id } = await request.json();
    if (!coffee_id) {
      return NextResponse.json({ error: 'Missing coffee_id' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    await supabase.rpc('increment_click', { coffee_id });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to track click' }, { status: 500 });
  }
}
