// Module 1: Database Types and Enumerations

export type CourtStatus = 'available' | 'summoning' | 'in_match' | 'maintenance' | 'needs_attention';
export type MatchType = 'doubles' | 'singles' | 'flexible';
export type MatchMode = 'balanced' | 'skill_separated' | 'social' | 'elo_rated';
export type PlayerStatus = 'checked_in' | 'queued' | 'staged' | 'summoned' | 'on_court' | 'resting' | 'checked_out';
export type MatchStage = 'on_deck' | 'summoning' | 'in_match' | 'result_pending' | 'completed';
export type StaticRating = 0 | 1 | 2 | 3 | 4 | 5;

export interface Session {
  id: string;
  join_pin: string;
  name: string;
  host_token_hash?: string;
  scoring_required: boolean;
  grace_period_seconds: number;
  match_mode: MatchMode;
  auto_dispatch_enabled: boolean;
  on_deck_cap_override: number | null;
  is_active: boolean;
  created_at: string;
  ended_at: string | null;
}

export interface Court {
  id: string;
  session_id: string;
  court_number: number;
  name: string;
  status: CourtStatus;
  assigned_match_type: MatchType;
  current_match_id: string | null;
}

export interface Player {
  id: string;
  session_id: string;
  name: string;
  static_rating: StaticRating | null;
  current_elo: number;
  status: PlayerStatus;
  staged_match_id: string | null;
  wait_started_at: string;
  total_matches_played: number;
  total_wins: number;
  total_losses: number;
  point_differential: number;
  created_at: string;
}

export interface LockedPair {
  id: string;
  session_id: string;
  player_1_id: string;
  player_2_id: string;
  composite_static_rating: number;
  composite_elo: number;
  is_active: boolean;
}

export interface Match {
  id: string;
  session_id: string;
  court_id: string | null;
  stage: MatchStage;
  on_deck_slot_number: number | null;
  match_mode_used: MatchMode;
  match_type: MatchType;
  team_a_ids: string[];
  team_b_ids: string[];
  score_a: number | null;
  score_b: number | null;
  forfeited_by: 'A' | 'B' | null;
  elo_delta_team_a: number | null;
  elo_delta_team_b: number | null;
  staged_at: string;
  summoned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  match_duration_seconds: number;
}

export interface PairLockRequest {
  id: string;
  session_id: string;
  requester_id: string;
  target_id: string;
  status: 'pending' | 'approved' | 'dismissed';
  created_at: string;
  resolved_at: string | null;
}
