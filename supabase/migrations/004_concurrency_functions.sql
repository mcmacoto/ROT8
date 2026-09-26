-- Module 1 Section 5: Atomic Row-Locking Concurrency Utility

CREATE OR REPLACE FUNCTION claim_players_for_match(
    p_session_id UUID,
    p_player_ids UUID[],
    p_match_id UUID,
    p_target_status player_status DEFAULT 'staged'
)
RETURNS TABLE (
    claimed_id UUID,
    success BOOLEAN
) 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Acquire exclusive row lock skipping any already locked rows
    -- Only lock players that are currently 'queued' and have staged_match_id IS NULL
    PERFORM id
    FROM players
    WHERE session_id = p_session_id
      AND id = ANY(p_player_ids)
      AND status = 'queued'
      AND staged_match_id IS NULL
    FOR UPDATE SKIP LOCKED;

    -- Update only rows that were successfully locked and match criteria
    RETURN QUERY
    WITH updated AS (
        UPDATE players
        SET status = p_target_status,
            staged_match_id = p_match_id
        WHERE session_id = p_session_id
          AND id = ANY(p_player_ids)
          AND status = 'queued'
          AND staged_match_id IS NULL
        RETURNING id
    )
    SELECT 
        unnest_id AS claimed_id,
        (updated.id IS NOT NULL) AS success
    FROM unnest(p_player_ids) AS unnest_id
    LEFT JOIN updated ON updated.id = unnest_id;
END;
$$;

-- Function to release staged players back to queued (for reroll / clear)
CREATE OR REPLACE FUNCTION release_staged_players(
    p_session_id UUID,
    p_match_id UUID
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    released_count INT;
BEGIN
    UPDATE players
    SET status = 'queued',
        staged_match_id = NULL
    WHERE session_id = p_session_id
      AND staged_match_id = p_match_id
      AND status = 'staged';
      
    GET DIAGNOSTICS released_count = ROW_COUNT;
    RETURN released_count;
END;
$$;
