# Issues & Bugs Resolution Status

### ✅ #1. Completing Matches doesn't ask for which team won
- **Status:** Resolved
- **Fix:**
  - Redesigned `ScoreModal.tsx` to prominently ask "Complete Match — Who Won?" with 1-click selectable cards for Team A and Team B, showing a clear `[✓ WINNER]` badge.
  - Supports both scored sessions (auto-syncs winner to higher score) and unscored sessions (1-click winner selection without requiring point entry).
  - Matches API (`api/admin/[sessionId]/matches/route.ts`) now accepts `winningTeam: 'A' | 'B'` and records `total_wins` and `total_losses` for all completed and forfeited matches even when scoring is disabled.
  - Admin console no longer bypasses the modal for unscored sessions.

---

### ✅ #2. Players on deck should not be removed from the queue list so that hosts and players viewing can see the waiting time of all players off the court
- **Status:** Resolved
- **Fix:**
  - Updated `queuedPlayers` in `admin/[sessionId]/page.tsx` and `kiosk/[sessionId]/page.tsx` to `players.filter((p) => p.status === 'queued' || p.status === 'staged')`.
  - Added an `[⚡ On-Deck]` badge in `QueueZone.tsx` and `KioskQueue.tsx` for staged players while keeping continuous wait-time tracking based on `wait_started_at`.
  - Updated mobile `PlayerStatusCard.tsx` to include elapsed off-court wait time when in on-deck status.

---

### ✅ #3. Empty active courts should prompt host to send On-Deck matchups to that empty court
- **Status:** Resolved
- **Fix:**
  - In `CourtZone.tsx`, when an active court is available/idle and there is at least one waiting On-Deck match, it renders a dedicated prompt card.
  - Displays: `🟢 Court {N} is Ready`, previews the next waiting On-Deck matchup (Slot #1: Team A vs Team B), and provides a prominent 1-click action: **"📢 Call On-Deck to Court {N}"**.
  - Calls `handleCallOnDeckToCourt(courtId, matchId)` which transitions the match from `on_deck` to `summoning` on that court.
  - Also preserves the alternative option to "Direct dispatch fresh match".

---

### ✅ #4. Players who completed their match should immediately be sent back to the queue
- **Status:** Resolved
- **Fix:**
  - Fixed root cause where `staged_match_id` was previously not cleared to `null` during `complete_match` in `route.ts` and `forfeit.ts`.
  - Both `route.ts` and `forfeit.ts` now explicitly update players with: `status: 'queued'`, `staged_match_id: null`, and `wait_started_at: now`.
  - Players immediately appear in the off-court queue and are eligible to be drafted for subsequent rotations.

---

### ✅ #5. Vercel deployment fails during `npm install` with `npm error ERESOLVE could not resolve`
- **Status:** Resolved
- **Root Cause:**
  - `package.json` defined `"@types/node": "^20"`.
  - `vitest@5.0.1` specifies a peer dependency `peerOptional @types/node@"^22.0.0 || >=24.0.0"`.
  - npm 7+ strictly validates peer dependencies during `npm install`, causing Vercel's build machine to exit with code 1 (`ERESOLVE`).
- **Fix:**
  - Upgraded `@types/node` in `package.json` from `"^20"` to `"^22"` (satisfies both `vite@^8.3.0` and `vitest@^5.0.1`).
  - Ran `npm install` to update `package-lock.json` with resolved dependencies.
  - Verified `vitest run` (70 tests pass) and `next build` (clean Turbopack compilation).
  - Push commit with updated `package.json` and `package-lock.json` to GitHub to trigger successful Vercel build.

---

### ✅ #6. Matchmaking Bug: Locked Pairs Can Be Split Across Opposing Teams
- **Status:** Resolved
- **Fix:**
  - Updated `getValidTeamPermutations` in `src/lib/engine/matchmaking/balanced.ts` and `findSocialMatch` in `src/lib/engine/matchmaking/social.ts` to validate pair integrity across all members of Team A (`split.teamA.every(...)`), verifying that if any player has an active locked partner, that partner must also be on Team A.
  - Added unit test in `__tests__/unit/matchmaking.test.ts` verifying that locked pairs are never split even when other solo players precede them in the permutation group.

---

### ✅ #7. Ghost Matches & Stale Rosters on Available Courts in Admin & Kiosk Views
- **Status:** Resolved
- **Fix:**
  - In `CourtZone.tsx` and `kiosk/[sessionId]/page.tsx`, changed match indexing to map by primary key `match.id` (`new Map(matches.map(m => [m.id, m]))`).
  - Active court matches are now resolved exclusively via `court.current_match_id ? matchesById.get(court.current_match_id) : null`.
  - Stale and completed matches retaining historical `court_id` references no longer collide with or overwrite active matches, and available courts (`current_match_id === null`) consistently render as empty/ready.

---

### ✅ #8. Stalled On-Deck Slot Recovery Actions Are Dead Code
- **Status:** Resolved
- **Fix:**
  - Updated `relaxSlotBounds` and `shiftSlotToSocial` in `src/lib/engine/on-deck.ts` to accept `slotNumber: number` and update session-level slot relaxation states or target staged slots directly without requiring a pre-existing match ID.
  - Updated `api/admin/[sessionId]/on-deck/route.ts` to handle `relax_slot` and `shift_slot_social` actions keyed by `slotNumber`.
  - In `OnDeckZone.tsx`, decoupled recovery buttons ("Relax Bounds (+0.5)" and "Shift to Social") from `{match && ...}`, rendering them whenever `stalled.isStalled` is true.

---

### ✅ #9. Database Unique Constraint Prevents Re-Pairing After Dissolution
- **Status:** Resolved
- **Fix:**
  - Created database migration `supabase/migrations/004_fix_locked_pairs_partial_unique.sql` dropping unconditional unique constraints `locked_pairs_session_id_player_1_id_key` and `locked_pairs_session_id_player_2_id_key` and replacing them with partial unique indexes filtered on `WHERE is_active = TRUE`.
  - Added active pair check in `api/admin/[sessionId]/pair-lock/route.ts` filtering explicitly by `eq('is_active', true)`.
  - Dissolving a locked pair sets `is_active = FALSE` without blocking players from forming new pairs later in the session.

---

### ✅ #10. Imbalanced Locked Pairs (|R1 - R2| >= 1.5) Permanently Excluded in Balanced Mode
- **Status:** Resolved
- **Fix:**
  - In `src/lib/engine/matchmaking/balanced.ts`, integrated `canPairPlayBalancedMode` from `locked-pairs.ts`.
  - When candidate groups contain locked pairs, the matchmaking algorithm checks whether two locked pairs counterbalance each other (composite difference within ±1.0) rather than rejecting them based solely on individual player rating spreads.
  - Added unit test in `__tests__/unit/matchmaking.test.ts` verifying that imbalanced locked pairs are drafted when matched against an opposing locked pair with comparable composite rating.

---

### ✅ #11. Cross-Tier Locked Pairs Permanently Stalled in Skill-Separated Mode
- **Status:** Resolved
- **Fix:**
  - In `src/lib/engine/matchmaking/skill-separated.ts`, updated tier partitioning to group locked pairs together into the tier corresponding to their `compositeStaticRating` (`(r1 + r2) / 2`).
  - Solo players continue to be partitioned by their individual ratings.
  - Added unit test in `__tests__/unit/matchmaking.test.ts` verifying that cross-tier locked pairs (e.g. 2.5 + 3.5) are placed into Tier 2 (3.0 composite) and drafted together without getting stuck.

---

### ✅ #12. Resting-to-Queued Does Not Reset Wait Time & Skips On-Deck Replenishment
- **Status:** Resolved
- **Fix:**
  - In `src/app/api/player/route.ts` (`toggle_rest` action), set `wait_started_at: new Date().toISOString()` when returning to `queued`, and asynchronously invoked `fillAvailableOnDeckSlots(sessionId)` to replenish open on-deck slots.
  - In `src/app/api/admin/[sessionId]/players/route.ts` (admin status toggle), set `wait_started_at: new Date().toISOString()` when transitioning to `queued`, and triggered `fillAvailableOnDeckSlots(sessionId)`.
  - Prevents resting players from cutting to the front of the queue and ensures immediate on-deck drafting.

---

### ✅ #13. Auto-Dispatch Promotes Court Without Replenishing On-Deck Pipeline
- **Status:** Resolved
- **Fix:**
  - In `src/lib/engine/auto-dispatch.ts`, added `await fillAvailableOnDeckSlots(sessionId)` immediately after promoting On-Deck Slot #1 to an available court.
  - Keeps the on-deck pipeline replenished automatically without requiring manual host autofill or waiting for match completion.

---

### ✅ #14. No-Show Redraft Ignores Locked Pairs and Separates Partners
- **Status:** Resolved
- **Fix:**
  - In `src/lib/engine/state-machine/no-show.ts`, if the no-show player belongs to an active locked pair, dissolved the pair and freed their partner.
  - When drafting a replacement player from the queue, filtered out players currently in active locked pairs (`activePartnerIds`), ensuring only solo players are drafted as single-player substitutes and preventing pair split bugs.

---

### ✅ #15. Raw UUID Exported as "Court Number" in Match History CSV
- **Status:** Resolved
- **Fix:**
  - In `src/lib/export/csv.ts`, updated `generateMatchesCSV` to accept `courtsMap?: Map<string, Court>` or `courts?: Court[]`.
  - Mapped court IDs to human-readable labels (`Court ${court.court_number}` or `N/A`) instead of raw database UUIDs.
  - In `src/app/history/[sessionId]/page.tsx`, passed session courts to the CSV exporter.
  - Added unit test in `__tests__/unit/csv-export.test.ts` validating CSV export court numbering.

---

### ✅ #16. Silent Frontend Error Swallowing Across Admin & Live Player Views
- **Status:** Resolved
- **Fix:**
  - In `src/app/admin/[sessionId]/page.tsx`, `QueueZone.tsx`, and `live/[sessionId]/page.tsx`, audited all fetch mutation handlers (`handleLockPair`, `handleDissolvePair`, `handleSaveEdits`, `handleToggleResting`, `handleRequestPair`).
  - Added strict `if (!res.ok)` response verification, extracting `error` message from the response payload and presenting feedback via alerts or error banners, preventing silent failures.

---

### ✅ #17. Missing Input Validation and Sanitization on Player Edit (PATCH API)
- **Status:** Resolved
- **Fix:**
  - In `src/app/api/admin/[sessionId]/players/route.ts` (`PATCH` handler), added `sanitizePlayerName` and length validation (1–30 chars), rejecting invalid or empty names with HTTP 400.
  - Also validated that `rating` falls within the valid range `[1.0, 5.0]`.

---

### ✅ #18. Stale Composite Elo for Locked Pairs After Match Completions
- **Status:** Resolved
- **Fix:**
  - In `src/lib/engine/locked-pair-dissolution.ts`, added `syncLockedPairsElo(supabase, sessionId, playerIds)`.
  - In `src/app/api/admin/[sessionId]/matches/route.ts` (match completion) and `src/lib/engine/state-machine/forfeit.ts` (forfeits), invoked `syncLockedPairsElo` after Elo ratings are updated.
  - Automatically recalculates and updates `composite_elo` for any active locked pairs involving participating players.


