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

