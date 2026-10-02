import { NextRequest, NextResponse } from 'next/server';
import { verifyHostAuthorization } from '@/lib/auth/require-host-auth';
import { rerollSlot, relaxSlotBounds, shiftSlotToSocial, fillAvailableOnDeckSlots } from '@/lib/engine/on-deck';
import { replaceOnDeckPlayer } from '@/lib/db/player-edit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const isAuthed = await verifyHostAuthorization(sessionId);
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized host' }, { status: 401 });
  }

  const body = await request.json();
  const { action, matchId, slotNumber, outgoingPlayerId, incomingPlayerId } = body;
  const targetIdOrSlot = matchId || slotNumber;

  try {
    if (action === 'fill_slots') {
      const createdCount = await fillAvailableOnDeckSlots(sessionId);
      return NextResponse.json({ success: true, createdCount });
    }

    if (action === 'reroll') {
      const result = await rerollSlot(sessionId, matchId);
      return NextResponse.json(result);
    }

    if (action === 'relax_bounds') {
      const result = await relaxSlotBounds(sessionId, targetIdOrSlot);
      return NextResponse.json(result);
    }

    if (action === 'shift_to_social') {
      const result = await shiftSlotToSocial(sessionId, targetIdOrSlot);
      return NextResponse.json(result);
    }

    if (action === 'replace_player') {
      // SERVER-SIDE CONSTRAINT: strictly rejected if stage != 'on_deck'
      const result = await replaceOnDeckPlayer(sessionId, matchId, outgoingPlayerId, incomingPlayerId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'On-deck action failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
