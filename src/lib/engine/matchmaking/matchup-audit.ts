import { Match, Player } from '@/types/database';

export interface MatchupWarning {
  type: 'duplicate_player' | 'cross_match_duplicate' | 'rematch' | 'repeat_partner';
  message: string;
  severity: 'warning' | 'error';
}

function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

/**
 * Audits an on-deck or active court matchup for:
 * 1. Duplicate players within the same matchup
 * 2. Duplicate players across multiple concurrent matches
 * 3. Recent rematches: (A vs B) or (B vs A)
 * 4. Recent partner pairings (especially important for social play mode)
 */
export function auditMatchup(
  match: Match,
  completedMatches: Match[],
  otherConcurrentMatches: Match[],
  playersMap: Map<string, Player>
): MatchupWarning[] {
  const warnings: MatchupWarning[] = [];
  const teamA = match.team_a_ids || [];
  const teamB = match.team_b_ids || [];
  const allMatchPlayerIds = [...teamA, ...teamB];

  // 1. Check duplicate within the same match
  const seenIds = new Set<string>();
  for (const id of allMatchPlayerIds) {
    if (seenIds.has(id)) {
      const name = playersMap.get(id)?.name || 'Player';
      warnings.push({
        type: 'duplicate_player',
        severity: 'error',
        message: `Duplicate Player: "${name}" is repeated in this matchup.`,
      });
    }
    seenIds.add(id);
  }

  // 2. Check cross-match duplicate across other concurrent on-deck / active matches
  for (const other of otherConcurrentMatches) {
    if (other.id === match.id) continue;
    const otherPlayers = [...(other.team_a_ids || []), ...(other.team_b_ids || [])];
    for (const id of allMatchPlayerIds) {
      if (otherPlayers.includes(id)) {
        const name = playersMap.get(id)?.name || 'Player';
        const location = other.stage === 'on_deck'
          ? `On-Deck Slot #${other.on_deck_slot_number || 1}`
          : 'an active court';
        warnings.push({
          type: 'cross_match_duplicate',
          severity: 'error',
          message: `Double Assignment: "${name}" is also assigned in ${location}.`,
        });
      }
    }
  }

  // 3. Check for recent rematches (A vs B or B vs A) in recent completed matches (last 15 matches)
  const recentCompleted = [...completedMatches]
    .sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime())
    .slice(0, 15);

  let rematchFound = false;
  for (let idx = 0; idx < recentCompleted.length; idx++) {
    const past = recentCompleted[idx];
    const pastA = past.team_a_ids || [];
    const pastB = past.team_b_ids || [];

    // Exact or reversed match (A vs B or B vs A)
    const isExact = setsEqual(teamA, pastA) && setsEqual(teamB, pastB);
    const isReversed = setsEqual(teamA, pastB) && setsEqual(teamB, pastA);

    if (isExact || isReversed) {
      rematchFound = true;
      warnings.push({
        type: 'rematch',
        severity: 'warning',
        message: `Recent Rematch: This exact matchup was played recently (${idx === 0 ? 'last match' : `${idx + 1} matches ago`}).`,
      });
      break;
    }
  }

  // 4. Check for repeat partner pairings (Team A or Team B) in recent matches
  if (!rematchFound) {
    if (teamA.length === 2) {
      for (let idx = 0; idx < recentCompleted.length; idx++) {
        const past = recentCompleted[idx];
        if (setsEqual(teamA, past.team_a_ids || []) || setsEqual(teamA, past.team_b_ids || [])) {
          const names = [
            playersMap.get(teamA[0])?.name || 'P1',
            playersMap.get(teamA[1])?.name || 'P2',
          ].sort().join(' & ');
          warnings.push({
            type: 'repeat_partner',
            severity: 'warning',
            message: `Repeat Partnership: ${names} recently partnered together.`,
          });
          break;
        }
      }
    }

    if (teamB.length === 2) {
      for (let idx = 0; idx < recentCompleted.length; idx++) {
        const past = recentCompleted[idx];
        if (setsEqual(teamB, past.team_a_ids || []) || setsEqual(teamB, past.team_b_ids || [])) {
          const names = [
            playersMap.get(teamB[0])?.name || 'P1',
            playersMap.get(teamB[1])?.name || 'P2',
          ].sort().join(' & ');
          warnings.push({
            type: 'repeat_partner',
            severity: 'warning',
            message: `Repeat Partnership: ${names} recently partnered together.`,
          });
          break;
        }
      }
    }
  }

  return warnings;
}
