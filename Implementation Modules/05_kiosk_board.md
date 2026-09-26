# Module 5 — TV Kiosk Board

**Route:** `/kiosk/[sessionId]`
**Depends on:** Module 1 (read-only access via join PIN, no host auth needed), Module 3 (renders resulting state, does not trigger transitions).
**Consumed by:** none (leaf UI module, display-only).

This is a read-only, glanceable display for a 1080p/4K TV mounted courtside. It has no interactive controls beyond an onboarding QR code — all state changes originate from Module 4.

---

## 1. Layout

- **Aspect ratio:** 16:9 widescreen.
- **Upper section:** Courts 1–6 grid.
- **Lower section:** "Up next" on-deck preview, followed by the general queue.
- **Top-right:** QR code linking to `/live/[sessionId]` for instant onboarding.

## 2. Court Card States

| State | Border color | Icon | Content |
| :--- | :--- | :--- | :--- |
| Active (in match) | Olive `#8A9A5B` | `ti-player-play` | Format badge, player names, star rating/Elo, active stopwatch (MM:SS) |
| Summoning | Terracotta `#C36F42` | `ti-clock` | Synchronized countdown timer, alert banner |
| Needs attention (grace timeout, unflagged — see Module 3, Step 2a) | Alert red `#F09595` | `ti-alert-triangle` | "Waiting on 1 player" / player name / prompt to check in |
| Inactive / maintenance | Muted low-opacity cream, dark card | `ti-square-off` | "-- CLOSED / MAINTENANCE --" |

**Rule:** color is never the sole status signal. Every state pairs a border color with a distinct icon, for colorblind accessibility. Do not add a new status without also assigning it a distinct icon.

## 3. On-Deck Visibility

Up to `on_deck_cap` on-deck matchups are shown publicly, labeled **"Up next,"** with a persistent disclaimer:

> "Matchups subject to change until called."

This is a deliberate tradeoff: a displayed matchup can still be rerolled or edited by the host (Module 4) before being called to a court, but the alternative — players having zero advance warning before a grace countdown starts — was judged the larger usability problem. On-deck cards on the kiosk are a **read-only mirror** of Module 4's Zone 2; they do not accept input.

## 4. Color System (Dark, High-Contrast)

- **Base:** near-black `#0D0D0C` — explicitly *not* umber-tinted. An umber-derived dark background was tested and rejected for reading as a muddy/brown tone rather than a neutral dark surface under venue lighting.
- **Card panels:** `#161614`. Nested elements (e.g., queue chips): `#0D0D0C` with a low-opacity cream border.
- **Text:** cream `#F5F0E8` at full opacity for primary content, reduced opacity for secondary content.
- **Status colors:** olive and terracotta keep their hue but are used as **borders and icon colors against the dark base**, not as fills, to preserve contrast at TV viewing distance.
- **Alert state:** a dedicated red (`#F09595`) sits outside the shared 4-color base palette — intentional, since this is the one state that must be unambiguous at a glance, and the base palette's warm hues sit too close together in luminance to safely encode "urgent problem."

### ⚠️ Known open concern — do not treat these hex values as final

Terracotta (`#C36F42`) against the near-black base (`#0D0D0C`) measures roughly **4.3:1 contrast** — workable on a calibrated screen but a real risk under bright, high-bay commercial venue lighting, where mid-saturation warm colors can read as muddy. The *direction* (raise the luminance of kiosk-specific status colors relative to the admin/mobile palette) is adopted. Specific replacement values are **not** locked in this module and must be selected during an on-hardware pilot under real venue lighting — see Section 6.

## 5. Accessibility Rule

Every status distinction (active / summoning / alert / closed) pairs a color with a distinct icon (`ti-player-play`, `ti-clock`, `ti-alert-triangle`, `ti-square-off` respectively). This is a hard requirement, not a nice-to-have — verify via a grayscale render test that every state remains distinguishable with color entirely removed.

## 6. Pilot Validation (pre-launch requirement)

Before finalizing kiosk hex values, run an on-site test with the actual TV hardware under actual venue lighting (fluorescent/high-bay LED). Confirm:
- Active vs. summoning states are distinguishable at a glance from normal viewing distance (10+ feet).
- Terracotta does not read as brown/muddy under the venue's specific lighting.
- WCAG AA contrast minimums are met against the near-black base for all status colors.

## 7. Acceptance Criteria

- Kiosk status colors meet WCAG AA contrast minimums against the near-black base.
- Every status remains distinguishable with color removed (icon/shape only) — verified via grayscale render test.
- On-deck cards are read-only; no interactive element on this route can trigger a state change (reroll, call to court, edit) — all mutations happen only in Module 4.
- Court stopwatches and grace countdowns stay within ±250ms of the host tablet and mobile views (shared timestamp source, per Module 3).
