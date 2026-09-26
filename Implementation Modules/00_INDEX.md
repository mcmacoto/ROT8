# Pickleball Court & Queue Management Engine — Module Index

**Spec version:** 2.1.0
**Source document:** `pickleball_queue_management_engine_technical_specification_v2.md`

This is the full v2.1 specification divided into independent development modules. Each module is scoped so a single developer or agent can implement it with minimal cross-reading, but all modules share one source of truth for schema, auth, and concurrency (Module 1) — do not fork or redefine those contracts locally within another module.

## Suggested build order

```
Module 1 (Foundation)  ─────────────┐
                                     ▼
Module 2 (Matchmaking Engine) ──► Module 3 (State Machine)
                                     │
                    ┌────────────────┼────────────────┬─────────────────┐
                    ▼                ▼                ▼                 ▼
              Module 4          Module 5          Module 6         Module 7
           (Admin Console)   (Kiosk Board)   (Mobile Player Hub) (History/Export)
```

Module 1 must be complete (or at minimum, schema-frozen) before any other module starts. Modules 2 and 3 are backend/engine work and should land before Modules 4–7, since every UI surface renders engine/state-machine output. Modules 4, 5, 6, and 7 can be built in parallel by separate developers once 1–3 are stable, as they only consume the shared contracts — they do not modify schema or engine logic themselves.

## Module list

| # | Module | Covers | Depends on |
| :--- | :--- | :--- | :--- |
| 1 | [Foundation: Schema, Auth & Concurrency](01_foundation_schema_auth_concurrency.md) | Database schema, enumerations, host authentication, row-locking strategy | — |
| 2 | [Matchmaking Engine](02_matchmaking_engine.md) | Balanced/Skill-Separated/Social/Elo-Rated modes, locked-pair math, on-deck composition, stalled-slot recovery | Module 1 |
| 3 | [State Machine & Turnaround Lifecycle](03_state_machine_lifecycle.md) | Court/match/player state transitions, grace timer, no-show/forfeit handling | Modules 1, 2 |
| 4 | [Host Admin Console](04_admin_console.md) | `/admin/[sessionId]` — three-zone layout, player editing, roster/session settings | Modules 1, 2, 3 |
| 5 | [TV Kiosk Board](05_kiosk_board.md) | `/kiosk/[sessionId]` — display-only board, color system, on-deck visibility | Modules 1, 3 |
| 6 | [Mobile Player Hub](06_mobile_player_hub.md) | `/live/[sessionId]`, `/`, `/how-to-use` — player self-service, onboarding | Modules 1, 3 |
| 7 | [History, Audit & Export](07_history_audit_export.md) | `/history`, `/history/[sessionId]` — leaderboard tie-breaking, CSV export | Modules 1, 2, 3 |

## Global open items (apply across modules)

These are unresolved product decisions from the v2.1 review, listed once here to avoid duplication. Each affected module links back to this list rather than repeating it:

- **Auto-dispatch toggle** (`sessions.auto_dispatch_enabled`) — schema exists, defaults `FALSE`, not yet adopted as an exposed host setting. Affects Modules 2, 3, 4.
- **Forfeit scoring convention** — whether a forfeited match uses a session-configured default score or the host enters the live score at departure. Affects Modules 2, 3, 4, 7.
- **Kiosk status-color hex values** — provisional pending on-hardware pilot validation. Affects Module 5.

## Cross-module rules (non-negotiable, repeated in each module for visibility)

1. **No audit/edit logging.** Player edits and on-deck replacements are intentionally unlogged. Do not add a log table "for safety" in any module — this was a reviewed, deliberate decision (see Module 1, Section on Player Editing Policy).
2. **On-deck is host-called only, by default.** No module should auto-promote an on-deck matchup to a court unless `auto_dispatch_enabled = TRUE` for that session.
3. **Full player replacement is on-deck only.** Active, in-progress courts only support Edit (name/rating) and Retire/Forfeit — never a full swap. This is an Elo-integrity guarantee, not a UI preference, and must be enforced server-side, not just hidden in the UI.
4. **Every player-claiming write acquires a row lock** (`FOR UPDATE SKIP LOCKED`) per Module 1's concurrency contract. Any new code path that transitions a player to `staged` or `summoned` must use the shared locking utility, not a bespoke query.
