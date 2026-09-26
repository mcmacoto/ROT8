-- Module 6 & 4: Pair Lock Requests (Host-Only Approval)

CREATE TABLE pair_lock_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    requester_id UUID REFERENCES players(id) ON DELETE CASCADE,
    target_id UUID REFERENCES players(id) ON DELETE CASCADE,
    status VARCHAR(10) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ DEFAULT NULL,
    CONSTRAINT distinct_request_players CHECK (requester_id <> target_id),
    UNIQUE(session_id, requester_id, target_id)
);

ALTER TABLE pair_lock_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read pair lock requests" ON pair_lock_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.id = pair_lock_requests.session_id AND s.is_active = TRUE
        )
    );

CREATE POLICY "Player insert pair lock request" ON pair_lock_requests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.id = pair_lock_requests.session_id AND s.is_active = TRUE
        )
    );
