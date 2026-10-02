-- Migration 004: Replace hard UNIQUE constraints with partial unique indexes on active locked pairs
-- This allows players who dissolved a pair to re-pair later in the session without duplicate key violations.

ALTER TABLE locked_pairs DROP CONSTRAINT IF EXISTS locked_pairs_session_id_player_1_id_key;
ALTER TABLE locked_pairs DROP CONSTRAINT IF EXISTS locked_pairs_session_id_player_2_id_key;

-- Create partial unique indexes enforcing that a player can only be in one ACTIVE locked pair per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_locked_pairs_player1 ON locked_pairs(session_id, player_1_id) WHERE is_active = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_locked_pairs_player2 ON locked_pairs(session_id, player_2_id) WHERE is_active = TRUE;
