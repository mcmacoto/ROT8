-- Module 1 Foundation: PostgreSQL Schema

-- ENUMERATIONS
CREATE TYPE court_status AS ENUM ('available', 'summoning', 'in_match', 'maintenance');
CREATE TYPE match_type AS ENUM ('doubles', 'singles', 'flexible');
CREATE TYPE match_mode AS ENUM ('balanced', 'skill_separated', 'social', 'elo_rated');
CREATE TYPE player_status AS ENUM ('checked_in', 'queued', 'staged', 'summoned', 'on_court', 'resting', 'checked_out');
CREATE TYPE match_stage AS ENUM ('on_deck', 'summoning', 'in_match', 'result_pending', 'completed');

-- SESSIONS
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    join_pin VARCHAR(6) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    host_token_hash VARCHAR(64) UNIQUE NOT NULL, -- HMAC-SHA256 digest
    scoring_required BOOLEAN DEFAULT TRUE,
    grace_period_seconds INT DEFAULT 90,
    match_mode match_mode DEFAULT 'balanced',
    auto_dispatch_enabled BOOLEAN DEFAULT FALSE, -- Default OFF preserves manual "Call to court"
    on_deck_cap_override INT DEFAULT NULL, -- NULL = computed default: max(1, active_courts - 1)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ DEFAULT NULL
);

-- COURTS (Constrained to a maximum of 6 courts per session)
CREATE TABLE courts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    court_number INT CHECK (court_number BETWEEN 1 AND 6),
    name VARCHAR(50) NOT NULL,
    status court_status DEFAULT 'available',
    assigned_match_type match_type DEFAULT 'doubles',
    current_match_id UUID,
    UNIQUE(session_id, court_number)
);

-- MATCHES (Created before players table references for staged_match_id FK or forward referenced)
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    court_id UUID REFERENCES courts(id) DEFAULT NULL, -- NULL while on_deck
    stage match_stage NOT NULL DEFAULT 'on_deck',
    on_deck_slot_number INT DEFAULT NULL CHECK (on_deck_slot_number BETWEEN 1 AND 5),
    match_mode_used match_mode NOT NULL,
    match_type match_type NOT NULL,
    team_a_ids UUID[] NOT NULL,
    team_b_ids UUID[] NOT NULL,
    score_a INT DEFAULT NULL,
    score_b INT DEFAULT NULL,
    forfeited_by VARCHAR(1) DEFAULT NULL CHECK (forfeited_by IN ('A', 'B')),
    elo_delta_team_a INT DEFAULT NULL,
    elo_delta_team_b INT DEFAULT NULL,
    staged_at TIMESTAMPTZ DEFAULT NOW(),
    summoned_at TIMESTAMPTZ DEFAULT NULL,
    started_at TIMESTAMPTZ DEFAULT NULL,
    completed_at TIMESTAMPTZ DEFAULT NULL,
    match_duration_seconds INT DEFAULT 0
);

-- PLAYERS
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    static_rating NUMERIC(2, 1) CHECK (static_rating IN (1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0)),
    current_elo INT DEFAULT 1200,
    status player_status DEFAULT 'queued',
    staged_match_id UUID DEFAULT NULL REFERENCES matches(id) ON DELETE SET NULL,
    wait_started_at TIMESTAMPTZ DEFAULT NOW(),
    total_matches_played INT DEFAULT 0,
    total_wins INT DEFAULT 0,
    total_losses INT DEFAULT 0,
    point_differential INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LOCKED PAIRS
CREATE TABLE locked_pairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    player_1_id UUID REFERENCES players(id) ON DELETE CASCADE,
    player_2_id UUID REFERENCES players(id) ON DELETE CASCADE,
    composite_static_rating NUMERIC(2, 1) NOT NULL,
    composite_elo INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT distinct_pair_players CHECK (player_1_id <> player_2_id),
    UNIQUE(session_id, player_1_id),
    UNIQUE(session_id, player_2_id)
);

-- INDEXES
CREATE INDEX idx_players_queue ON players(session_id, status, wait_started_at);
CREATE INDEX idx_matches_session_completed ON matches(session_id, completed_at);
CREATE INDEX idx_matches_on_deck ON matches(session_id, stage) WHERE stage = 'on_deck';
