# Module 2 — Matchmaking Engine

**Depends on:** Module 1 (schema, concurrency contract).
**Consumed by:** Module 3 (state machine calls into this engine), Module 4 (admin console triggers reroll/dispatch actions defined here).

This module owns all matchmaking math and the on-deck composition service. It has no UI surface of its own — it's a backend engine invoked by state transitions (Module 3) and host actions (Module 4).

---

## 1. Scope

- The four matchmaking modes: Balanced, Skill-Separated, Social, Elo-Rated.
- Locked-pair composite rating math and imbalance handling.
- On-deck slot composition, cap calculation, reroll, and stalled-slot recovery.
- The Elo substitution constraint (why full replacement is banned on active courts).

Out of scope: the state transitions that call this engine (Module 3), and any rendering of its output (Modules 4, 5).

---

## 2. Trigger Model

The engine has two trigger paths:

1. **On-deck pre-composition** (primary path): runs whenever the queue changes (check-in, rest-toggle, checkout) or an on-deck slot is vacated (called to court or manually cleared), attempting to fill available on-deck slots up to the cap.
2. **Direct dispatch** (legacy path, retained for sessions/hosts that skip on-deck): triggers when a court transitions to `available`, only for the case where no on-deck matchup exists yet, or a host explicitly bypasses staging.

Only players with `status = 'queued'` (i.e., not already `staged` into another on-deck slot) are eligible for either trigger. Both paths must acquire row locks per Module 1, Section 5 before claiming any player.

```
                           [Eligible Queued Pool]
                          (status = 'queued', staged_match_id IS NULL)
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
 ┌───────────────┐           ┌───────────────┐           ┌───────────────┐
 │ Balanced Mode │           │Skill-Separated│           │  Social Mode  │
 ├───────────────┤           ├───────────────┤           ├───────────────┤
 │Min team ΔR    │           │Hard Banding:  │           │Minimize repeat│
 │under ΔR ≤ 1.0 │           │1.0-2.5,       │           │partners; sort │
 │rating spread  │           │3.0-3.5, 4.0+  │           │by wait time   │
 └───────┬───────┘           └───────┬───────┘           └───────┬───────┘
         │                           │                           │
         └───────────────────────────┼───────────────────────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │   Elo-Rated Mode    │
                          ├─────────────────────┤
                          │Dynamic Elo ladder;  │
                          │Logistic curve updates│
                          └──────────┬──────────┘
                                     │
                                     ▼
                        [Evaluate Locked Pairs]
                         (Atomic unit assignment)
                                     │
                                     ▼
                    ┌────────────────┴────────────────┐
                    ▼                                  ▼
        [Compose On-Deck Slot]                [Direct Court Dispatch]
        (matches.stage = 'on_deck',            (legacy path — only when
         court_id = NULL, awaits              on-deck is disabled or
         host "Call to court")                empty for that court)
```

---

## 3. Matchmaking Modes

### 3.1 Balanced Mode
- **Rating Envelope:** the individual static star spread among all 4 chosen players must not exceed 1.0:
  $$\max(R_i) - \min(R_i) \le 1.0 \quad \text{for } i \in \{1, 2, 3, 4\}$$
- **Objective Function:** minimize side disparity:
  $$\min \left| (R_{A1} + R_{A2}) - (R_{B1} + R_{B2}) \right|$$
  Target condition: $|R_{\text{Team A}} - R_{\text{Team B}}| \le 0.5$.

### 3.2 Skill-Separated Mode (Tiered Play)
- **Partitions:**
  - Tier 1 (Recreational): Static Star 1.0–2.5
  - Tier 2 (Intermediate): Static Star 3.0–3.5
  - Tier 3 (Advanced): Static Star 4.0–5.0
- **Court Selection Rule:** players never cross tier boundaries. If multiple tiers have sufficient queued players, courts are assigned to the tier with the highest aggregate bench wait time.

### 3.3 Social Mode (Club Mixer)
- **Objective Function:** maximize wait-time priority while penalizing repeat partner pairings:
  $$\text{Cost}(i, j) = (w_{\text{wait}} \times T_{\text{wait}}) - (w_{\text{repeat}} \times H_{ij}^2)$$
  Where $H_{ij}$ is the count of previous matches where Player $i$ and Player $j$ were on the same team during the active session.

### 3.4 Dynamic Elo-Rated Mode
- **Initial Seed from Static Stars:**
  $$R_{\text{initial}} = 600 + (\text{StaticStar} - 1.0) \times 350$$
  (Yields: 1.0 → 600, 3.0 → 1300, 3.5 → 1475, 5.0 → 2000)
- **Team Composite Elo:**
  $$R_{\text{Team A}} = \frac{R_{A1} + R_{A2}}{2}, \quad R_{\text{Team B}} = \frac{R_{B1} + R_{B2}}{2}$$
- **Expected Outcome Formula:**
  $$E_A = \frac{1}{1 + 10^{(R_{\text{Team B}} - R_{\text{Team A}}) / 400}}, \quad E_B = 1 - E_A$$
- **Rating Delta Formula:**
  $$\Delta R_A = \text{round}\left( K \times (S_A - E_A) \right)$$
  Where $S_A = 1$ for a win and $0$ for a loss.
  - $K = 32$ for players with < 5 session matches (accelerated convergence).
  - $K = 20$ for established players (≥ 5 session matches).
- Both players on Team A receive $+\Delta R_A$; both players on Team B receive $-\Delta R_A$ (or the inverse if Team B wins).
- **Substitution constraint:** $\Delta R$ is computed from `matches.team_a_ids`/`team_b_ids` at completion time. If a player is fully replaced on an active, in-progress court, the incoming player would absorb or receive a rating delta for a match they did not fully play. **To prevent this, full player replacement is disallowed on active courts in all modes when scoring is required** (not just `elo_rated`, for consistency). See Module 1, Section 6 and Module 3's Retire/Forfeit transition for the resulting procedure.

### 3.5 Locked-Pair Calculus
- A locked pair forms an atomic unit occupying two roster slots in doubles.
- Combined metrics:
  $$R_{\text{pair}} = \frac{R_1 + R_2}{2}, \quad \text{Elo}_{\text{pair}} = \frac{\text{Elo}_1 + \text{Elo}_2}{2}$$
- **Imbalance Clamp:** if $|R_1 - R_2| \ge 1.5$, the pair is barred from Balanced mode unless matched against an opposing locked pair with an equivalent composite rating ($\pm 0.5$); otherwise, the pair is routed to Social or Elo-Rated mode.

---

## 4. On-Deck Slot Composition

- **Slot Cap:** `on_deck_cap = session.on_deck_cap_override ?? max(1, active_courts - 1)`, recomputed whenever `active_courts` changes.
  - Example: 3 active courts → 2 on-deck slots.
  - **Boundary case (critical — do not regress):** a 1-court venue must yield `on_deck_cap = 1`, never `0`. An earlier `active_courts - 1` formula without the floor silently disabled on-deck staging entirely for single-court venues. Write a regression test specifically for `active_courts = 1`.
- **Trigger conditions:** the composer attempts to fill any empty slot (up to the cap) whenever:
  - A player checks in, un-rests, or is newly eligible.
  - An on-deck slot is vacated (called to a court, or manually cleared by the host).
  - The host changes the active matchmaking mode.
- **Composition process:** identical mode logic to Section 3, applied against the eligible pool, producing a full `matches` row with `stage = 'on_deck'`, `court_id = NULL`, and both `team_a_ids`/`team_b_ids` populated. Claimed players are marked `status = 'staged'` and `staged_match_id` is set (via the Module 1 locking utility), removing them from the pool for the next slot's composition and from the legacy direct-dispatch pool.
- **Slot independence:** slots are composed sequentially (Slot 1 before Slot 2) so Slot 2's composition never contends with Slot 1 for the same players.
- **Manual reroll:** the host may reroll a single on-deck slot. This releases that slot's 2 or 4 players back to `status = 'queued'` and re-runs composition for that slot only, respecting other slots' existing claims. Because rerolls are scoped to one slot and slots compose sequentially, no two slots ever contend for the same candidate mid-composition — this closes the reroll-contention question by construction, not by additional locking logic.
- **Calling to court (host-initiated only, default behavior):** the host selects an available court and one on-deck slot; on confirmation, the match row transitions `stage: 'on_deck' → 'summoning'`, `court_id` is set, `summoned_at = NOW()`, players transition `staged → summoned`, and the grace countdown begins (Module 3). **By default, on-deck matchups are never auto-promoted to a court**, unless `sessions.auto_dispatch_enabled = TRUE` (see Module 00_INDEX, Global Open Items — not adopted by default).
- **Stalled slot handling:** if fewer than the required number of eligible players remain to fill a slot (e.g., remaining queued players are locked pairs that cannot form a valid opposing side under the active mode), the slot enters a `stalled` state with two host-facing recovery actions:
  - **Relax skill bounds** — widens that slot's rating-spread constraint by 0.5 (e.g., Balanced's $\Delta R \le 1.0$ becomes $\le 1.5$) and re-attempts composition for that slot only.
  - **Shift to Social mode** — recomposes that slot only using Social mode's wait-time-priority logic, regardless of the session's global mode.
  - Neither action changes the session's global matchmaking mode — both are scoped to the one stalled slot.

### Function surface (suggested)

```ts
composeOnDeckSlot(sessionId: string, slotNumber: number, mode: MatchMode): Promise<Match | StalledSlot>
rerollSlot(sessionId: string, matchId: string): Promise<Match | StalledSlot>
callToCourt(sessionId: string, matchId: string, courtId: string): Promise<Match> // Module 3 owns the resulting state transition
relaxSlotBounds(sessionId: string, matchId: string): Promise<Match | StalledSlot>
shiftSlotToSocial(sessionId: string, matchId: string): Promise<Match | StalledSlot>
computeOnDeckCap(sessionId: string): Promise<number>
```

---

## 5. Acceptance Criteria

- On-deck cap never exceeds `max(1, active_courts − 1)` (or the host override), and recomputes immediately when active court count changes. Explicitly test the 1-court boundary.
- No player is ever claimed by two on-deck slots or a slot-plus-direct-dispatch simultaneously (shared responsibility with Module 1's concurrency test).
- Pair-lock integrity: players locked as a pair are never separated onto opposing teams or different courts.
- Elo precision: rating updates reflect the logistic expectation curve with integer rounding and no floating-point drift.
- Full player replacement is rejected for any match at `stage = 'in_match'` or later, even via direct API call.
- A stalled slot never silently persists at partial capacity — it must render/report as `stalled` and expose the two recovery actions.
