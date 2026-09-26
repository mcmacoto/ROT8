import { CourtStatus, MatchStage, PlayerStatus } from '@/types/database';

export interface StateTransitionResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates match stage transitions according to Module 3 State Machine.
 */
export function validateMatchStageTransition(
  currentStage: MatchStage,
  nextStage: MatchStage
): StateTransitionResult {
  const allowedTransitions: Record<MatchStage, MatchStage[]> = {
    on_deck: ['summoning'],
    summoning: ['in_match', 'result_pending'], // result_pending if abandoned / immediate forfeit
    in_match: ['result_pending', 'completed'],
    result_pending: ['completed'],
    completed: [],
  };

  if (!allowedTransitions[currentStage]?.includes(nextStage)) {
    return {
      valid: false,
      error: `Invalid match stage transition from '${currentStage}' to '${nextStage}'.`,
    };
  }

  return { valid: true };
}

/**
 * Validates court status transitions.
 * Available -> Summoning -> In Match -> Result Pending -> Available
 * Summoning -> Needs Attention (on grace timeout) -> In Match
 */
export function validateCourtStatusTransition(
  currentStatus: CourtStatus,
  nextStatus: CourtStatus
): StateTransitionResult {
  const allowedTransitions: Record<CourtStatus, CourtStatus[]> = {
    available: ['summoning', 'maintenance'],
    summoning: ['in_match', 'needs_attention', 'available'],
    needs_attention: ['in_match', 'summoning', 'available'],
    in_match: ['available', 'maintenance'],
    maintenance: ['available'],
  };

  if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
    return {
      valid: false,
      error: `Invalid court status transition from '${currentStatus}' to '${nextStatus}'.`,
    };
  }

  return { valid: true };
}

/**
 * Validates player status transitions.
 */
export function validatePlayerStatusTransition(
  currentStatus: PlayerStatus,
  nextStatus: PlayerStatus
): StateTransitionResult {
  const allowedTransitions: Record<PlayerStatus, PlayerStatus[]> = {
    checked_in: ['queued', 'resting', 'checked_out'],
    queued: ['staged', 'summoned', 'resting', 'checked_out'],
    staged: ['queued', 'summoned', 'resting'],
    summoned: ['on_court', 'resting'], // resting if no-show
    on_court: ['queued', 'resting'], // resting if retired/forfeited
    resting: ['queued', 'checked_out'],
    checked_out: ['checked_in', 'queued'],
  };

  if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
    return {
      valid: false,
      error: `Invalid player status transition from '${currentStatus}' to '${nextStatus}'.`,
    };
  }

  return { valid: true };
}
