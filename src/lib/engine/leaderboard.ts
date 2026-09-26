import { MatchMode, Player, Match } from '@/types/database';
import { getEffectiveRating } from './matchmaking/elo-rated';

export interface LeaderboardEntry {
  player: Player;
  rank: number;
  winRate: number;
  strengthOfSchedule: number;
}

/**
 * Calculates Strength of Schedule (SOS):
 * The average static rating of all opponents faced during the session.
 */
export function calculateStrengthOfSchedule(
  playerId: string,
  matches: Match[],
  playersMap: Map<string, Player>
): number {
  const opponentRatings: number[] = [];

  for (const m of matches) {
    if (m.stage !== 'completed') continue;

    const inTeamA = m.team_a_ids.includes(playerId);
    const inTeamB = m.team_b_ids.includes(playerId);

    if (inTeamA) {
      for (const opId of m.team_b_ids) {
        const op = playersMap.get(opId);
        if (op) opponentRatings.push(getEffectiveRating(op));
      }
    } else if (inTeamB) {
      for (const opId of m.team_a_ids) {
        const op = playersMap.get(opId);
        if (op) opponentRatings.push(getEffectiveRating(op));
      }
    }
  }

  if (opponentRatings.length === 0) return 0;
  const sum = opponentRatings.reduce((a, b) => a + b, 0);
  return Number((sum / opponentRatings.length).toFixed(2));
}

/**
 * Shared Hierarchical Tie-Breaking Engine (Module 7 §3 & Module 6 Live Leaderboard)
 * Guarantees identical ranking order across both mobile and historical audit views.
 */
export function computeLeaderboard(
  players: Player[],
  matches: Match[],
  mode: MatchMode,
  scoringRequired: boolean
): LeaderboardEntry[] {
  const playersMap = new Map<string, Player>(players.map((p) => [p.id, p]));

  const entries: LeaderboardEntry[] = players.map((player) => {
    const totalDecided = player.total_wins + player.total_losses;
    const winRate = totalDecided > 0 ? player.total_wins / totalDecided : 0;
    const sos = calculateStrengthOfSchedule(player.id, matches, playersMap);

    return {
      player,
      rank: 0,
      winRate: Number(winRate.toFixed(3)),
      strengthOfSchedule: sos,
    };
  });

  // Strict Hierarchical Sort
  entries.sort((a, b) => {
    if (mode === 'elo_rated') {
      // 1. Current numerical Elo
      if (b.player.current_elo !== a.player.current_elo) {
        return b.player.current_elo - a.player.current_elo;
      }
      // 2. Net point differential
      if (b.player.point_differential !== a.player.point_differential) {
        return b.player.point_differential - a.player.point_differential;
      }
      // 3. Total match volume
      if (b.player.total_matches_played !== a.player.total_matches_played) {
        return b.player.total_matches_played - a.player.total_matches_played;
      }
      // 4. FIFO check-in timestamp
      return new Date(a.player.created_at).getTime() - new Date(b.player.created_at).getTime();
    }

    if (scoringRequired) {
      // Standard Mode (Scoring: Required)
      // 1. Win percentage
      if (b.winRate !== a.winRate) {
        return b.winRate - a.winRate;
      }
      // 2. Point differential
      if (b.player.point_differential !== a.player.point_differential) {
        return b.player.point_differential - a.player.point_differential;
      }
      // 3. Total matches played
      if (b.player.total_matches_played !== a.player.total_matches_played) {
        return b.player.total_matches_played - a.player.total_matches_played;
      }
      // 4. Strength of Schedule (SOS)
      if (b.strengthOfSchedule !== a.strengthOfSchedule) {
        return b.strengthOfSchedule - a.strengthOfSchedule;
      }
      // 5. FIFO check-in timestamp
      return new Date(a.player.created_at).getTime() - new Date(b.player.created_at).getTime();
    }

    // Standard Mode (Scoring: Disabled)
    // 1. Win percentage
    if (b.winRate !== a.winRate) {
      return b.winRate - a.winRate;
    }
    // 2. Point differential
    if (b.player.point_differential !== a.player.point_differential) {
      return b.player.point_differential - a.player.point_differential;
    }
    // 3. Total completed matches
    if (b.player.total_matches_played !== a.player.total_matches_played) {
      return b.player.total_matches_played - a.player.total_matches_played;
    }
    // 4. Strength of Schedule (SOS)
    if (b.strengthOfSchedule !== a.strengthOfSchedule) {
      return b.strengthOfSchedule - a.strengthOfSchedule;
    }
    // 5. FIFO check-in timestamp
    return new Date(a.player.created_at).getTime() - new Date(b.player.created_at).getTime();
  });

  // Assign ranks
  entries.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  return entries;
}
