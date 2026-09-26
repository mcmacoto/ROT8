-- Module 1 Foundation: Row-Level Security (RLS) Policies

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE locked_pairs ENABLE ROW LEVEL SECURITY;

-- Allow public read access to sessions with valid join_pin or active session
CREATE POLICY "Public read active sessions" ON sessions
    FOR SELECT USING (is_active = TRUE);

-- Courts read access
CREATE POLICY "Public read courts for active sessions" ON courts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.id = courts.session_id AND s.is_active = TRUE
        )
    );

-- Matches read access
CREATE POLICY "Public read matches for active sessions" ON matches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.id = matches.session_id AND s.is_active = TRUE
        )
    );

-- Players read access
CREATE POLICY "Public read players for active sessions" ON players
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.id = players.session_id AND s.is_active = TRUE
        )
    );

-- Locked pairs read access
CREATE POLICY "Public read locked_pairs for active sessions" ON locked_pairs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.id = locked_pairs.session_id AND s.is_active = TRUE
        )
    );

-- Allow anonymous player check-in (INSERT into players)
CREATE POLICY "Public player check-in" ON players
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.id = players.session_id AND s.is_active = TRUE
        )
    );

-- Allow player self-service update (resting toggle on own record)
CREATE POLICY "Player self update status" ON players
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.id = players.session_id AND s.is_active = TRUE
        )
    );

-- Full admin access via service_role bypasses RLS automatically in Supabase
-- For API routes with host token verification, mutations run with server/service credentials
