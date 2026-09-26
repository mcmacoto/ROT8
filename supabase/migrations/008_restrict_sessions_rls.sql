-- Migration 008: Restrict sessions RLS to protect host_token_hash
-- Creates sessions_public view and restricts column-level access to host_token_hash

-- 1. Create secure view for public session data
CREATE OR REPLACE VIEW sessions_public AS
SELECT 
    id,
    join_pin,
    name,
    scoring_required,
    grace_period_seconds,
    match_mode,
    auto_dispatch_enabled,
    on_deck_cap_override,
    is_active,
    created_at,
    ended_at
FROM sessions;

-- 2. Grant SELECT on sessions_public to anon and authenticated
GRANT SELECT ON sessions_public TO anon, authenticated;

-- 3. Column-level permissions: prevent anon and authenticated from reading host_token_hash directly
REVOKE SELECT ON sessions FROM anon, authenticated;
GRANT SELECT (
    id,
    join_pin,
    name,
    scoring_required,
    grace_period_seconds,
    match_mode,
    auto_dispatch_enabled,
    on_deck_cap_override,
    is_active,
    created_at,
    ended_at
) ON sessions TO anon, authenticated;
