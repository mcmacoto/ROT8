# Module 6 — Mobile Player Hub & Onboarding

**Routes:** `/` (Home), `/live/[sessionId]` (Mobile Player Hub), `/how-to-use`
**Depends on:** Module 1 (join-PIN-scoped read/write for self-service actions), Module 3 (renders player state, triggers only rest-toggle and pair-lock-request transitions).
**Consumed by:** none (leaf UI module).

This module covers everything a player interacts with directly: onboarding, self-service status, and reference material. No host/admin actions live here.

---

## 1. Home Page (`/`)

- **Host Setup Modal:** captures Session Name, Court Count (1–6), Mode, Scoring Toggle. On submit, calls the session-creation endpoint (Module 1) which yields `session_id`, a unique 6-character `join_pin`, and issues the host token cookie.
- **Player Access:** alphanumeric PIN input or mobile QR scanner, routing to `/live/[sessionId]`.
- **Auto-Resume Detection:** reads `localStorage` for active session IDs; renders direct chips: `[Resume Host Console]` or `[Open Player Queue]`.

## 2. Mobile Player Hub (`/live/[sessionId]`)

- **Status Card:** real-time indicator reflecting the player's current status (Module 3's player state machine): `Queued`, `Staged` (on-deck), `Summoned to Court X`, `On Court`, or `Resting`.
- **Self-Service Controls:**
  - Single-tap "Take a Break / Resume Play" toggle (Module 3, Step 6).
  - "Request Pair Lock" selector, picking from other checked-in players — creates a pending pair-lock request; confirmation/creation of the `locked_pairs` row may require the other player's acceptance or host approval, depending on session settings (implementation detail left to this module, not specified upstream).
- **Metrics & Standings:**
  - Personal off-court wait timer.
  - Read-only live session leaderboard (data from Module 7's tie-breaking logic, rendered read-only here).
- **Realtime sync:** subscribe to Supabase Realtime for the player's own row and the session's on-deck/court state, so the status card updates without polling.

## 3. How to Use Page (`/how-to-use`)

- **Player Guide:** check-in steps, QR scanning, grace periods, Rest mode etiquette, locked pairs.
- **Host Manual:** operating multiple courts, using on-deck staging, handling no-shows, odd player rotations, configuring match modes. (This section documents Module 4's behavior for a host audience — keep it in sync with Module 4 if that spec changes.)
- **Star & Elo Rating Scale Reference:**

| Stars | Elo Range | Skill Benchmarks |
| :--- | :--- | :--- |
| 1.0 – 2.0 | 600 – 950 | Learning non-volley zone (kitchen) rules, scoring, and paddle control; frequent unforced errors. |
| 2.5 | 950 – 1125 | Can sustain short dink rallies; consistent serve direction; developing third-shot drop mechanics. |
| 3.0 | 1125 – 1300 | Consistent medium-pace dinking; understands kitchen positioning; struggles against high-speed attacks. |
| 3.5 | 1300 – 1475 | Directional control; aggressive dinking; consistent third-shot drops and resets under moderate pressure. |
| 4.0 | 1475 – 1650 | High-pace hand speed; anticipates court openings; low unforced error rate; advanced spin and resets. |
| 4.5+ | 1650 – 2000 | Elite positioning; exceptional soft touch; mastery of pace modulation, reset angles, and attack defense. |

---

## 4. Visual Design Reference

Same warm palette as Module 4, light mode:

- 60% cream (`#F5F0E8`) surfaces / 30% olive (`#8A9A5B`) secondary surfaces / 10% terracotta (`#C36F42`) accent for primary actions (e.g., the Rest/Resume toggle).
- Umber (`#3E2F23`) text throughout.

---

## 5. Access Control Notes

- The join PIN grants access to this module's routes and to Module 5's kiosk route only. It must never authorize any write against `courts`, `matches`, or the `players` rows of *other* players — a player hub session should only be able to mutate its own player row (rest toggle, pair-lock request) plus read session-wide state.
- Do not implement any admin-equivalent action (editing another player, calling a match, forcing a court state) in this module, even for convenience — those are exclusively Module 4 actions gated by host auth.

---

## 6. Acceptance Criteria

- Unauthenticated players scanning the court QR code load their personal queue status in under 3 seconds on a standard 4G connection.
- A player's self-service actions (rest toggle, pair-lock request) never require or expose the host token.
- The status card accurately reflects all player states from Module 3's state machine, including the new `Staged` (on-deck) state.
- The live leaderboard shown here matches Module 7's tie-breaking output exactly — this view must not implement its own separate sorting logic.
