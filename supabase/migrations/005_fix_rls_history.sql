-- Module 7 & General: Allow public read access to active AND completed sessions
-- This allows the History Archive and Session Audit pages to view ended sessions.

-- Drop previous restrictive active-only read policies
DROP POLICY IF EXISTS "Public read active sessions" ON sessions;
DROP POLICY IF EXISTS "Public read courts for active sessions" ON courts;
DROP POLICY IF EXISTS "Public read matches for active sessions" ON matches;
DROP POLICY IF EXISTS "Public read players for active sessions" ON players;
DROP POLICY IF EXISTS "Public read locked_pairs for active sessions" ON locked_pairs;

-- Allow public read access to all sessions (active or completed)
CREATE POLICY "Public read all sessions" ON sessions
    FOR SELECT USING (TRUE);

-- Courts read access for all sessions
CREATE POLICY "Public read courts" ON courts
    FOR SELECT USING (TRUE);

-- Matches read access for all sessions
CREATE POLICY "Public read matches" ON matches
    FOR SELECT USING (TRUE);

-- Players read access for all sessions
CREATE POLICY "Public read players" ON players
    FOR SELECT USING (TRUE);

-- Locked pairs read access for active sessions
CREATE POLICY "Public read locked_pairs for active sessions" ON locked_pairs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.id = locked_pairs.session_id AND s.is_active = TRUE
        )
    );
