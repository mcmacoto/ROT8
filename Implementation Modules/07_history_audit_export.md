# Module 7 — History, Audit & Export

**Routes:** `/history`, `/history/[sessionId]`
**Depends on:** Module 1 (schema), Module 2 (Elo/rating data), Module 3 (match completion records, including forfeits).
**Consumed by:** none (leaf UI module) — but Module 6's live leaderboard must match this module's tie-breaking logic exactly.

This module owns post-session reporting: leaderboards, tie-breaking, court utilization, and CSV export. It is read-only against completed and in-progress session data.

---

## 1. Session Archive (`/history`)

- Filterable list of completed sessions by date, court count, and match mode.

## 2. Audit Detail (`/history/[sessionId]`)

- **Final Leaderboard:** frozen table of final standings with all tie-breaker criteria (Section 3).
- **Court Utilization Audit:** total active match duration vs. idle turnover time per court.
- **Data Export:** instant CSV export containing full match logs: `Match ID`, `Court Number`, `Mode`, `Team A`, `Team B`, `Scores`, `Elo Changes`, `Duration`, and `Forfeited By` (new column, reflecting Module 3's Retire/Forfeit transition).

---

## 3. Leaderboard Tie-Breaking

Never sort alphabetically or by database insertion order when records tie.

| Mode Setting | Strict Hierarchical Tie-Breakers |
| :--- | :--- |
| Dynamic Elo Mode | 1. Current numerical Elo rating<br>2. Total net point differential<br>3. Total match volume<br>4. FIFO check-in timestamp |
| Standard Mode (Scoring: Required) | 1. Win percentage: W / (W + L)<br>2. Point differential (net ±Δ)<br>3. Total matches played<br>4. Strength of Schedule (SOS)<br>5. FIFO check-in timestamp |
| Standard Mode (Scoring: Disabled) | 1. Total completed matches<br>2. Total active court minutes<br>3. FIFO check-in timestamp |

- **Strength of Schedule (SOS):** the average static star or Elo rating of all opponents faced during the session.
- **Locked-Pair Attribution:** locked pairs appear as a unified entity during active partnership. Personal player records retain match volume, points, and individual Elo updates independently.

---

## 4. Interaction with the No-Logging Policy

This module must account for two upstream data-integrity tradeoffs made deliberately in Module 1:

- **Silent edits:** if a player's name or rating was edited mid-session (Module 1, Section 6), historical leaderboard rows reflect the *current* player record, not a point-in-time snapshot. There is no mechanism to reconstruct "rating at time of match" separately from "rating now," since no edit log exists. **Do not attempt to build one here** — this is expected behavior, not a defect to patch around.
- **On-deck replacements:** exported `Team A`/`Team B` values reflect the final roster at match completion time, not necessarily who started the match, due to the same no-logging policy. The CSV export or audit UI should carry a brief, visible note to this effect (e.g., a footnote on the export or a tooltip on the Team columns) so hosts reviewing historical data understand the limitation rather than assuming the export is a full audit trail.
- **Forfeits are the one exception that *is* fully attributable** — since `forfeited_by` is a normal column on the match record (not a log), export and leaderboard logic can and should surface forfeited matches distinctly (e.g., a "Forfeit" badge in the audit UI) rather than treating them identically to a normally completed match.

---

## 5. Acceptance Criteria

- Players with identical records sort strictly by the hierarchy in Section 3, never alphabetically or by insertion order — verify with a seeded tie scenario per mode.
- CSV export includes the `Forfeited By` column and a visible disclaimer about final-roster-only reporting for edited/replaced players.
- The live leaderboard rendered in Module 6 and the historical leaderboard rendered here produce identical ordering for the same underlying data — implement the tie-breaking logic once and share it between modules rather than duplicating it.
- Court utilization figures (active vs. idle time) reconcile against the sum of `match_duration_seconds` for that court across the session.
