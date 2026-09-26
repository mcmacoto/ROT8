# Module 4 — Host Admin Console

**Route:** `/admin/[sessionId]`
**Depends on:** Module 1 (auth, schema), Module 2 (matchmaking actions), Module 3 (state transitions).
**Consumed by:** none (leaf UI module) — but its actions are what drives Modules 5 and 6's displayed state.

This is the host-facing control surface: tablet or desktop, primary operating screen for running a session. It triggers Module 2/3 logic but does not implement matchmaking or state-transition rules itself.

---

## 1. Layout — Three Zones

Replaces the old "two-tap court cards + roster management" model with three distinct, vertically stacked zones.

### Zone 1 — Courts

- Each active/in-match court renders players as **individually selectable cards in a 2x2 team-vs-team grid** (Team A column vs Team B column, "vs" divider) — not a single-line pair string.
- Tapping a player card on an **active, in-match court** opens an action sheet with: **Edit name**, **Edit rating**, **Retire / forfeit**. Full replacement is **not** offered here — enforced both client-side (don't render the option) and server-side (Module 1, Section 6 / Module 3, Step 7b).
- Locked-pair players show a `ti-link` badge in place of the edit-menu icon. Tapping it and choosing to edit/retire triggers the two-sided dissolution confirmation (Module 3, Section 4).
- Available courts show a "Call match" action that is visually de-emphasized when on-deck slots exist, steering the host toward Zone 2 rather than legacy direct dispatch.
- Retained action triggers: `Start Match`, `No-Show / Re-Draft`, `Complete Match`. Score modal appears only when `sessions.scoring_required = TRUE`.
- **Responsive:** below 768px, Zone 1 renders as a compact horizontal split-card — team stacked left vs right within one card, players still individually tappable inline — instead of a full vertical stack of 4 separate cards per court. This avoids a 30+ card scroll wall on a multi-court session viewed from a phone.

```
+------------------------------------------+
| COURT 1 (Doubles)               12:45    |
| Team A: J. Doe (3.5) / M. Smith (3.5)    |
|   vs.                                    |
| Team B: A. Vance (3.0) / C. Green (4.0)  |
+------------------------------------------+
```

### Zone 2 — On-Deck Matchups

- Displays up to `on_deck_cap` slots. Header shows "`N` of `on_deck_cap` slots used" and the cap formula (`max(1, active_courts − 1)`, or the session override).
- Each slot is a fully composed matchup rendered in the same 2x2 individually selectable player-card grid as Zone 1, with a dashed terracotta border to visually distinguish "not yet on a physical court."
- Tapping a player card on an **on-deck slot** opens the full action sheet including **Replace player** (pulls from queue) — permitted here since no score exists yet.
- Each slot has:
  - A reroll action (recomposes that slot only via Module 2's `rerollSlot`).
  - A primary **"Call to court"** action that prompts the host to pick a destination court, invoking Module 2's `callToCourt` → Module 3's Step 1 transition.
- A slot with insufficient eligible players renders in a `stalled` visual state with two one-tap recovery actions: **Relax skill bounds** and **Shift to Social mode** (Module 2, Section 4).

### Zone 3 — Queue

- Full list of all off-court, checked-in players not currently claimed by an on-deck slot, each row showing wait time and rating.
- Distinct from Zone 2 — a player only leaves this list when Module 2's composer claims them into a slot.

---

## 2. Roster Management

- Add player with a star rating picker (1.0–5.0 in 0.5 steps).
- Pair-locking builder: combines 2 checked-in players into an atomic `locked_pairs` row.
- Status overrides: manually set any player to `Resting`, `Queued`, or `Checked Out`.

## 3. Session Settings Drawer

- On-the-fly toggling of matchmaking mode and scoring requirement.
- On-deck cap override (defaults to computed `max(1, active_courts − 1)`; host may set explicitly via `sessions.on_deck_cap_override`).
- (If adopted — see Module 00_INDEX Global Open Items) Auto-dispatch toggle exposing `sessions.auto_dispatch_enabled`.

---

## 4. Visual Design Reference

Light, warm palette — see the shared design system for full detail (colors reused across Modules 5 and 6, but applied at opposite contrast extremes there).

| Color | Hex | Role |
| :--- | :--- | :--- |
| Cream | `#F5F0E8` | Dominant surface (60%) |
| Olive | `#8A9A5B` | Secondary surface / active-state (30%) |
| Terracotta | `#C36F42` | Accent / primary action (10%) |
| Umber | `#3E2F23` | Text color |

- 60% cream background, 30% olive for active/secondary panels, 10% terracotta reserved for the single primary action per view (e.g., "Call match", "Call to court").
- Umber text at full opacity for primary labels, ~60–65% opacity for secondary/meta text (timestamps, helper copy).
- On-deck slots use the dashed terracotta border treatment described above.

---

## 5. Acceptance Criteria

- Every player within an active court or on-deck slot is independently tappable and opens the correct action sheet for its context (active court: edit + forfeit only; on-deck: edit + replace).
- "Replace player" is genuinely unavailable — not just visually hidden — for any active-court player; a direct API bypass attempt is rejected by Module 1/3's server-side check.
- Below 768px, Zones 1 and 2 render as compact horizontal split-cards, not a full vertical stack; verify a 6-court, full-on-deck session does not require excessive scrolling on a phone-sized viewport.
- Toggling scoring requirement to "Off" cleanly removes score entry modals and transitions courts immediately on "Complete Match."
- Dissolving a locked pair always surfaces the two-sided confirmation copy, never a generic single-player prompt.
- On-deck cap and its formula are visibly displayed, and update immediately when `active_courts` changes.
