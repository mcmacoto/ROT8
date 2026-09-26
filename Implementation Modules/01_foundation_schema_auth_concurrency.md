# Module 1 — Foundation: Schema, Auth & Concurrency

**Depends on:** none — this is the base module every other module builds against.
**Consumed by:** Modules 2, 3, 4, 5, 6, 7 (all of them).

This module owns the database schema, host authentication, and the row-locking contract. Nothing in this module is UI-facing. Treat every type, table, and function signature here as the shared interface — other modules must not redefine or fork these locally.

---

## 1. Scope

- PostgreSQL schema (enumerations, tables, indexes) for the full system.
- Host authentication (token issuance, storage, validation).
- The concurrency/row-locking contract that all player-claiming operations must use.
- The non-logging policy for player edits (stated here as a data-layer contract; UI-facing behavior described in Module 4).

Out of scope: matchmaking logic (Module 2), state transition logic (Module 3), and all route/UI work (Modules 4–7).

---

## 2. Database Schema

```sql
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
    host_token_hash VARCHAR(64) UNIQUE NOT NULL, -- HMAC-SHA256 digest; raw token lives only in the HttpOnly cookie, see Section 4
    scoring_required BOOLEAN DEFAULT TRUE,
    grace_period_seconds INT DEFAULT 90,
    match_mode match_mode DEFAULT 'balanced',
    auto_dispatch_enabled BOOLEAN DEFAULT FALSE, -- global open item; see Module 00_INDEX. Opt-in only, default OFF preserves manual "Call to court"
    on_deck_cap_override INT DEFAULT NULL, -- NULL = use computed default: max(1, active_courts - 1), see Module 2
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

-- PLAYERS
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    static_rating NUMERIC(2, 1) CHECK (static_rating IN (1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0)),
    current_elo INT DEFAULT 1200,
    status player_status DEFAULT 'queued',
    staged_match_id UUID DEFAULT NULL REFERENCES matches(id) ON DELETE SET NULL, -- non-null while claimed by an on-deck slot; all writes to status/staged_match_id must acquire a row lock first, see Section 5
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

-- MATCHES
-- A match row represents a matchup through its full lifecycle, including the
-- pre-court "on_deck" stage. court_id is NULL while stage = 'on_deck'.
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    court_id UUID REFERENCES courts(id) DEFAULT NULL, -- NULL while on_deck
    stage match_stage NOT NULL DEFAULT 'on_deck',
    on_deck_slot_number INT DEFAULT NULL CHECK (on_deck_slot_number BETWEEN 1 AND 5), -- position among on-deck slots
    match_mode_used match_mode NOT NULL,
    match_type match_type NOT NULL,
    team_a_ids UUID[] NOT NULL,
    team_b_ids UUID[] NOT NULL,
    score_a INT DEFAULT NULL,
    score_b INT DEFAULT NULL,
    forfeited_by VARCHAR(1) DEFAULT NULL CHECK (forfeited_by IN ('A', 'B')), -- set when an active-court departure is resolved via forfeit rather than substitution
    elo_delta_team_a INT DEFAULT NULL,
    elo_delta_team_b INT DEFAULT NULL,
    staged_at TIMESTAMPTZ DEFAULT NOW(), -- when the on-deck matchup was composed
    summoned_at TIMESTAMPTZ DEFAULT NULL, -- set when host calls it to a court
    started_at TIMESTAMPTZ DEFAULT NULL,
    completed_at TIMESTAMPTZ DEFAULT NULL,
    match_duration_seconds INT DEFAULT 0
);

-- INDEXES
CREATE INDEX idx_players_queue ON players(session_id, status, wait_started_at);
CREATE INDEX idx_matches_session_completed ON matches(session_id, completed_at);
CREATE INDEX idx_matches_on_deck ON matches(session_id, stage) WHERE stage = 'on_deck';
```

### Schema notes for implementers

- **No substitution/edit log table exists, by design.** Do not add one. Player name/rating edits and in-place replacements are direct `UPDATE` statements against `players` and `matches.team_a_ids`/`team_b_ids`. See Section 6 below.
- `players.staged_match_id` prevents a player from being claimed by two on-deck slots simultaneously, and prevents the matchmaking engine (Module 2) from drafting an already-staged player into a different matchup.
- `matches.stage` is the authoritative state — do not infer stage from `court_id` nullability or timestamp presence elsewhere in the codebase.
- `forfeited_by` is set only via the Retire/Forfeit transition defined in Module 3. It is never set by a normal match completion.

---

## 3. Row-Level Security (RLS)

- **Admin writes** (`INSERT`/`UPDATE`/`DELETE` on `courts`, `matches`, `players`, `locked_pairs`) require a valid host token for that `session_id` — see Section 4.
- **Read access** to all tables scoped to `session_id` should be open to any client holding a valid `join_pin` for that session (kiosk and mobile-player routes are read-heavy and do not require host auth).
- Implement RLS policies keyed on `session_id` at the Postgres level in addition to API-layer middleware checks — do not rely on API middleware alone, since Supabase Realtime subscriptions bypass Next.js route handlers.

---

## 4. Host Authentication

- **Token generation:** on session creation, the server generates a cryptographically random secret, computes its HMAC-SHA256 digest, and stores only the digest as `sessions.host_token_hash`. The raw secret is never persisted server-side outside the cookie.
- **Storage:** the raw secret is set as an `HttpOnly`, `SameSite=Lax`, `Secure` cookie scoped to `/admin/[sessionId]`. `HttpOnly` prevents access via client-side JavaScript (XSS mitigation); `SameSite=Lax` prevents cross-site request forgery from a malicious third-party page.
- **Validation:** every admin-scoped API route (`PATCH`/`POST` against `courts`, `matches`, or `players` for a given `session_id`) runs middleware that recomputes the HMAC digest of the presented cookie value and compares it against `sessions.host_token_hash` before allowing the write. Read-only kiosk and mobile-player routes do not require this token.
- **Scope separation:** the public 6-character `join_pin` only ever grants access to `/live/[sessionId]` (player self-service: check-in, rest toggle, pair-lock request) and `/kiosk/[sessionId]` (read-only display). It cannot be used to authenticate any admin write, regardless of how it's presented. This is a materially important control given that player edits are unlogged (Section 6) — a leaked PIN or venue-Wi-Fi-visible URL must not be able to silently alter the queue.
- **Rotation:** out of scope for this session-lifetime tool. A session's host token is valid for the lifetime of that session (`is_active = TRUE`) and is invalidated when the session ends (`ended_at` set).

### Acceptance criteria

- Every admin-write endpoint rejects requests lacking a valid `host_token` cookie matching the session's stored hash.
- The public join PIN alone cannot authorize any write against `courts`, `matches`, or `players`, verified with a direct API test that presents a valid PIN but no host cookie.

---

## 5. Concurrency Control

Because on-deck pre-composition, manual rerolls, legacy direct dispatch, and player replacement (Module 2) can all attempt to claim the same queued player at effectively the same moment, **every operation that transitions a player into `staged` or `summoned` must acquire an explicit row lock before reading the eligible pool**:

```sql
SELECT id FROM players
WHERE session_id = $1 AND status = 'queued'
FOR UPDATE SKIP LOCKED;
```

- `FOR UPDATE` prevents two concurrent composition runs from both claiming the same player row before either commits.
- `SKIP LOCKED` ensures a composition run in progress for Slot 1 does not block or wait on a concurrent run for Slot 2 — it simply excludes already-locked rows from its candidate pool, preserving queue read throughput under load.
- This lock must be acquired **inside the same transaction** that performs the `UPDATE ... SET status = 'staged', staged_match_id = ...`, not as a separate preceding step, or the race condition re-opens between the lock release and the update.
- Applies uniformly to: on-deck composition (Module 2), manual reroll (Module 2), legacy direct dispatch (Module 2), and no-show re-draft (Module 3).

**Build this as a single shared utility function/module** (e.g. `claimPlayersForMatch(sessionId, playerIds, matchId)`) that every other module calls, rather than letting each caller write its own locking query. This is the highest-priority correctness requirement in the whole system — implement and unit-test it before any dependent module's happy-path logic.

### Acceptance criteria

- Under simulated concurrent load (multiple simultaneous composition/reroll/dispatch operations against the same queue), no player is ever claimed by two matches simultaneously.
- Verify via a stress test that deliberately races these operations against a shared queued-player pool, not just isolated unit tests.

---

## 6. Player Editing & Non-Logging Policy (data-layer contract)

This is a deliberate product decision. Do not add logging "for safety" — it was reviewed and intentionally rejected in favor of host speed during live sessions.

- **Edits (name/rating):** allowed on any player, on active courts or on-deck slots, via direct `UPDATE` to `players`. No audit row is created anywhere in the system as a result.
- **Full replacement:** allowed **only** on on-deck slots (`matches.stage = 'on_deck'`). Must be rejected server-side — not just hidden in the UI — for any match with `stage IN ('summoning', 'in_match', 'result_pending', 'completed')`. This is an Elo-integrity guarantee (see Module 2's substitution constraint): a full swap on a scored, in-progress match would let a substitute absorb or receive a rating delta for a match they didn't fully play.
- **Active-court departures** are handled via the Retire/Forfeit transition (Module 3), which *does* produce a normal match-completion record — that's existing match-completion infrastructure, not new logging, and is not a contradiction of the no-logging policy.

### Acceptance criteria

- No `INSERT` occurs against any audit/log table as a side effect of a player edit or on-deck replacement.
- The "Replace player" operation is rejected server-side (not merely hidden client-side) for any match at `stage = 'in_match'` or later — verify with a direct API call that bypasses the UI.
