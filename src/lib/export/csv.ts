import { Match, Player } from '@/types/database';

/**
 * Module 7: Data Export to CSV
 * Columns: Match ID, Court Number, Mode, Team A, Team B, Scores, Elo Changes, Duration, Forfeited By
 * Includes visible disclaimer about final-roster reporting and forfeit indication.
 */
export function generateMatchesCSV(
  matches: Match[],
  playersMap: Map<string, Player>
): string {
  const headers = [
    'Match ID',
    'Court Number',
    'Mode',
    'Team A Players',
    'Team B Players',
    'Team A Score',
    'Team B Score',
    'Team A Elo Delta',
    'Team B Elo Delta',
    'Duration (Seconds)',
    'Forfeited By',
  ];

  const rows = matches.map((m) => {
    const teamANames = m.team_a_ids
      .map((id) => playersMap.get(id)?.name || id)
      .join(' & ');
    const teamBNames = m.team_b_ids
      .map((id) => playersMap.get(id)?.name || id)
      .join(' & ');

    return [
      `"${m.id}"`,
      m.court_id || 'N/A',
      m.match_mode_used,
      `"${teamANames}"`,
      `"${teamBNames}"`,
      m.score_a !== null ? m.score_a : '',
      m.score_b !== null ? m.score_b : '',
      m.elo_delta_team_a !== null ? m.elo_delta_team_a : '',
      m.elo_delta_team_b !== null ? m.elo_delta_team_b : '',
      m.match_duration_seconds,
      m.forfeited_by ? `Team ${m.forfeited_by}` : 'None',
    ].join(',');
  });

  const disclaimer =
    '# DISCLAIMER: Team rosters reflect final player composition at match completion due to host live-edit policy. Forfeited matches reflect real score at departure.';

  return [headers.join(','), ...rows, '', disclaimer].join('\n');
}
