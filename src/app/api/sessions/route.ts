import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateHostToken, getHostCookieConfig } from '@/lib/auth/host-token';
import { MatchMode } from '@/types/database';
import { sanitizeSessionName } from '@/lib/utils/sanitize';
import crypto from 'crypto';

function generateJoinPin(): string {
  // 6-character uppercase alphanumeric excluding ambiguous chars like 0, O, 1, I
  const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let pin = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    pin += charset[bytes[i] % charset.length];
  }
  return pin;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, courtCount, matchMode = 'balanced', scoringRequired = true } = body;
    const cleanName = sanitizeSessionName(name);

    if (!cleanName || !courtCount || courtCount < 1 || courtCount > 6) {
      return NextResponse.json(
        { error: 'Valid session name (non-empty) and court count (1-6) are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const joinPin = generateJoinPin();
    const { rawToken, tokenHash } = generateHostToken();

    // 1. Insert session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        name: cleanName,
        join_pin: joinPin,
        host_token_hash: tokenHash,
        match_mode: matchMode as MatchMode,
        scoring_required: scoringRequired,
        grace_period_seconds: 90,
        is_active: true,
      })
      .select()
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: sessionError?.message || 'Failed to create session' }, { status: 500 });
    }

    // 2. Insert initial courts (1 to courtCount)
    const courtsToInsert = [];
    for (let i = 1; i <= courtCount; i++) {
      courtsToInsert.push({
        session_id: session.id,
        court_number: i,
        name: `Court ${i}`,
        status: 'available',
        assigned_match_type: 'doubles',
      });
    }

    const { error: courtsError } = await supabase.from('courts').insert(courtsToInsert);
    if (courtsError) {
      return NextResponse.json({ error: courtsError.message }, { status: 500 });
    }

    // 3. Set HttpOnly Host Cookie
    const response = NextResponse.json({
      sessionId: session.id,
      joinPin: session.join_pin,
      name: session.name,
    });

    const cookieConfig = getHostCookieConfig();
    response.cookies.set(`host_token_${session.id}`, rawToken, cookieConfig);
    response.cookies.set('rot8_host_token', rawToken, cookieConfig);

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
