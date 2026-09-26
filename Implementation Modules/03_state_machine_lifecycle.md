# Module 3 — State Machine & Turnaround Lifecycle

**Depends on:** Module 1 (schema, concurrency), Module 2 (matchmaking engine — this module calls into it for composition/reroll/dispatch).
**Consumed by:** Module 4 (admin console triggers these transitions), Module 5 (kiosk renders resulting state), Module 6 (mobile hub renders player-facing state).

This module owns every valid state transition for courts, matches, and players, including timing (grace countdown, stopwatch) and the no-show/forfeit/retire procedures. Treat this as the single source of truth for "what state can become what state, and under what trigger" — UI modules should not invent their own transition logic.

---

## 1. Scope

- Match stage, court status, and player status state machines.
- The grace-period countdown and its `needs_attention` timeout behavior.
- No-show handling and re-draft.
- Retire/Forfeit procedure for active-court departures.
- Player edit and on-deck replacement transitions (state-neutral, but documented here for completeness).

Out of scope: the matchmaking math itself (Module 2), and any rendering (Modules 4–6).

---

## 2. State Machines

```
[MATCH STAGE STATE MACHINE]
On-Deck ──(host: Call to court)──► Summoning (Grace Timer) ──► In Match (Stopwatch) ──► Result Pending ──► Completed
   │ (host: reroll)                     │ (timeout, unflagged)
   ▼                                     ▼
Re-composed                        Needs Attention ──(host confirms present)──► In Match
                                         │ (host flags no-show)
                                         ▼
                                    Re-Drafting

[COURT STATE MACHINE]
Available ──► Summoning (Grace Timer) ──► In Match (Stopwatch) ──► Result Pending ──► Available
                    │ (timeout, unflagged)
                    ▼
               Needs Attention ──► (see above)

[PLAYER STATE MACHINE]
Checked In ──► Queued ──► Staged (on-deck) ──► Summoned ──► On Court ──► Result Pending ──► Queued
                 │ ▲            │ (reroll)         │ (No-Show)
                 ▼ │            ▼                  ▼
              Resting      Queued              Resting (bumped)
```

**Critical rule:** a grace-period timeout at `00:00` **never auto-starts a match short-handed**. This was an ambiguity in earlier drafts and is now explicit: the court/match enters `needs_attention` (a third, distinct outcome) rather than silently proceeding. See Section 3, Step 2a.

---

## 3. Turnaround Lifecycle Details

| Step | State | Trigger | System Actions |
| :--- | :--- | :--- | :--- |
| **0. On-Deck Composition** | `match.stage = on_deck`<br>`player.status = staged` | Queue change or slot vacancy triggers the Module 2 composer. | Engine builds a full Team A vs Team B matchup; claims players via `staged_match_id`; slot becomes visible to Module 4/5. |
| **1. Match Summon** | `court.status = summoning`<br>`match.stage = summoning`<br>`player.status = summoned` | Host explicitly selects an on-deck slot and an available court, and confirms "Call to court" (Module 2's `callToCourt`). | Starts grace countdown (`sessions.grace_period_seconds`, default 90s); emits kiosk audio alert; displays "Proceed to Court X" banner on mobile devices (Module 6). Never happens automatically unless `auto_dispatch_enabled = TRUE` (see Module 00_INDEX). |
| **2. Match Start (manual)** | `court.status = in_match`<br>`player.status = on_court` | Host clicks "Start" before the timer expires. | Halts countdown; begins active match stopwatch (`started_at = NOW()`); UI switches to active status. |
| **2a. Grace Timeout (unflagged)** | `court.status = needs_attention` (new) | Grace timer reaches `00:00` with no host action taken. | Countdown stops at zero; court/match enters `needs_attention`; kiosk shows a visually distinct alert state (e.g., blinking border, per Module 5); host tablet plays an alert sound. **The match does not start automatically.** Host must either tap "Confirm all present" (→ Step 2, match starts) or flag the absent player as a no-show (→ Step 3). |
| **3. No-Show Flag** | `player.status = resting`<br>`court.status = summoning` (or `needs_attention`) | Host flags an absent player, either during the grace countdown or after it has entered `needs_attention`. | Offending player moved to `resting`; Module 2's engine drafts the next eligible player in <500ms without dropping the remaining players; grace countdown restarts for the newly completed matchup. |
| **4. Completion (Scores ON)** | `court.status = result_pending` | Match ends; host opens score prompt. | Match stopwatch stops; host inputs scores (e.g., 11–9); Elo and differentials update per Module 2; court set to `available`, which may trigger Module 2's direct-dispatch or on-deck-cap recompute. |
| **5. Completion (Scores OFF)** | `court.status = available` | Match ends; host clicks "Finish Match". | Match stopwatch stops; match count increments; player records update; court immediately set to `available`. |
| **6. Rest Toggle** | `player.status = resting` | Player or host toggles "Take a Break". | Player excluded from queue and on-deck composition (Module 2); original check-in timestamp and match stats remain intact. |
| **7. Player Edit (in place)** | No state change | Host taps a player card on an active court or on-deck slot and edits name/rating (Module 4 UI). | Direct update to `players` row per Module 1, Section 6. No audit record. |
| **7b. Player Replace (on-deck only)** | No state change | Host taps a player card on an on-deck slot and selects "Replace player". | Direct update to `matches.team_a_ids`/`team_b_ids` and both players' `status`, per Module 1, Section 6. **Rejected server-side if attempted on any match at `stage != 'on_deck'`.** No audit record. |
| **7c. Retire / Forfeit (active court only)** | `match.stage = result_pending`<br>`match.forfeited_by = <team>` | Host taps a player card on an active, in-progress court and selects "Retire / forfeit" because the player can no longer continue. | Match immediately moves to `result_pending` with `forfeited_by` set; host enters or confirms the forfeit score (see Module 00_INDEX, Global Open Items — exact scoring convention not yet finalized); remaining players' Elo/records update normally per Module 2; **no substitute is ever inserted into the completed match.** This produces a normal match-completion record — not new logging infrastructure. |

---

## 4. Locked-Pair Dissolution

Editing or retiring/replacing one half of a locked pair requires an explicit confirmation before the `locked_pairs` row is deactivated:

> "This player is part of a locked pair. This will dissolve the lock for this session. Continue?"

The host is making this call on behalf of both players, not just the one whose card was tapped — confirmation copy in Module 4's implementation should make that plain rather than reading as a routine single-player prompt.

---

## 5. Mid-Session On-Deck Cap Reduction

If a host reduces `active_courts` such that existing on-deck slots exceed the new cap, **already-populated slots are grandfathered** (left intact, remain callable) rather than evicted. The lower cap only prevents Module 2's composer from filling *new* slots going forward.

---

## 6. Acceptance Criteria

- A grace countdown reaching `00:00` never auto-starts a match; the court must enter `needs_attention` and require explicit host confirmation or a no-show flag.
- Court stopwatches and grace countdowns maintain temporal synchronization within ±250ms across host tablets, TV kiosks, and mobile phones, using server timestamps (`started_at`, `summoned_at`) — not client-side timers alone.
- Retiring a player from an active court never results in a different player receiving that match's Elo delta.
- The forfeit action produces a normal match-completion record (verify `completed_at` and scores are populated exactly as any other completed match).
- Dissolving a locked pair always requires the explicit two-sided confirmation prompt — verify it cannot be bypassed via a direct API call to the single-player edit endpoint.
- A cap reduction never evicts an already-populated on-deck slot; verify by reducing `active_courts` mid-session with slots full and confirming those slots remain callable.
