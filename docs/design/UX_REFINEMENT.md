# QR Pocket — Phase 1 visual refinement (v2)

Status: DRAFT for Gate G1b · 2026-10-21 · Functionality, specs, frame IDs and flows are unchanged from v1 (except where noted under "Deliberate differences").
Files: `mockups/index.html` (v2), `mockups/compare.html` (before/after), `mockups/v1/` (previous), `mockups/mock.css` (tokens + components). Nothing here has been tested on a device; screenshots were rendered in the already-installed Edge (headless) for visual inspection only.

## What changed and why
| Area | Before (v1) | After (v2) | Why |
|---|---|---|---|
| Header | Text only, 1px dividing line | 28px QR-inspired logo + name, 48px high | Branding without extra height |
| Generate input | Bare form field, 3 explanatory texts | White card: label, bordered textarea (3.2:1) with blue focus + glow, `34 / 2,331 bytes · Medium`, Clear, one-line hint | Less repetition, clearer limits, cleaner focus |
| QR preview | Square box with border | Centred square white card, shadow, 12px padding + 4-module quiet zone; compact dashed empty state | Prominent, crisp, small when empty |
| Actions | Three equal outlined buttons | Save = solid primary (52px); Download PNG / Share = calm tonal; "Saved" becomes a green done state | Visual priority on Save |
| Disabled actions | Dashed buttons + "Enter text to enable…" | Muted buttons, no message; empty preview and error panels explain | Removes misleading text |
| Errors | Red box + button | Icon + bold title + explanation + recovery button; warning style for too-long-at-Medium | Softer, clearer next step, not colour-only |
| Saved cards | 5 outlined buttons wrapping onto 3 rows (~230px per card) | Open (primary) in header; one row of icon-over-label actions: Rename · Download · Share · Delete; ~140px per card | Less clutter, no wrapping to 320px |
| Titles | One-line ellipsis | Two-line clamp; start-aligned (Arabic OK) | Content not lost at large text |
| Navigation | Text tabs, top bar | Icon + label, filled pill + bold + heavier icon for active, safe-area padding | Clear active state without colour alone |
| Notifications | Floating toast over nav | Inline bars under the header or in-flow panels | Never covers nav or Save |
| Dialogs | Outlined buttons | 20px radius, danger icon, Cancel tonal with focus ring, solid red Delete | Distinct destructive action |

## Deliberate differences from approved v1 (flag for your approval)
1. `--muted-text` (#55637A) added because the requested muted #64748B is 4.44:1 on #F5F7FB (fails AA); #64748B kept for icons/placeholder/white backgrounds.
2. Empty-state Save/Download/Share are shown muted without a message (as you asked) rather than the earlier explanatory line.
3. "Saved" confirmation moved from a top bar to inline next to Save and merged with the device-only notice (one message instead of three); button turns into a non-repeatable done state (avoids duplicate saves).
4. Offline banner (N1) is added next to the header chip; chip text is just "Offline".
5. Share-unsupported text shortened to "Sharing files isn't supported in this browser." (Download remains).

## Not changed on purpose (decision for you)
The independent reviewer suggested an always-visible Error-correction selector (Medium/Low). I did **not** add it: ADR-007/CLAUDE.md approved "no silent downgrade, explicit L option on overflow, no general picker in MVP". If you want a voluntary selector, it is a spec change (SPEC-001, ADR-007) — say so and I will draft it. The reviewer also noted the button wording "Use lower error correction (L)" is jargon; alternative: "Switch to Low (fits up to 2,953 bytes, less damage-tolerant)". Current wording kept.

## Accessibility and responsive review checklist
Reviewer = an independent subagent that read the CSS/HTML and screenshots (no device, no assistive technology). "Computed" means arithmetic on CSS values. Nothing below is a pass from a real screen-reader, phone or axe run — those are Phase 2+ CI/UAT items (T-A11Y, T-RESP, U14).
| # | Check | Result (mockup, 2026-10-21) | Evidence |
|---|---|---|---|
| 1 | Text contrast ≥ 4.5:1 | PASS (computed) | tokens table; `--muted` restricted to white |
| 2 | UI boundary / focus ≥ 3:1 | PASS (computed) | field 3.20, ring 5.4 |
| 3 | Tonal buttons identifiable | PASS with note | text label identifies; faint boundary (forced-colors border rule added) |
| 4 | Touch targets ≥ 24px (AA) / 48px (goal) | PASS after fix | `.link` and `.btn-sm` raised 44→48; `.act` 52px; tabs 52px |
| 5 | Status not by colour alone | PASS | distinct icon shapes + text + hidden prefix |
| 6 | Notifications don't cover nav/primary actions | PASS | inline placement |
| 7 | Error border visible while focused | FIXED | invalid + focus keeps red border/glow |
| 8 | Accessible names for repeated card buttons | FIXED in mockup | `aria-label="Rename <title>"` etc. |
| 9 | Native dialog behaviour | SPEC ONLY | mockup is static; `showModal()`, focus return, `aria-describedby` specified in SCREEN_SPECS notes → test in Phase 3 |
| 10 | Live regions / describedby for input | SPEC ONLY | notes in SCREEN_SPECS → Phase 2 |
| 11 | Arabic titles | PASS visually | RTL, start-aligned, `<bdi>` in delete dialog |
| 12 | Safe-area insets | PASS in mockup | bottom (R7) and left/right via `env()` |
| 13 | No horizontal overflow 320/360/390/430/560 | PASS visually | R1–R7, D1 screenshots; long URL wraps (R6) |
| 14 | Large text (150%) | PASS after fix | R5, R8: titles 2 lines, Download/Share stack, actions reflow (3+1) |
| 15 | QR preview square and fully visible | PASS visually | `aspect-ratio:1` at all widths |
| 16 | Reduced motion / forced colors | PASS in CSS | only pulse/120ms transition; forced-colors borders |
| 17 | Small text size | KNOWN TRADE-OFF | `.act` labels 12px, hints 13px (scale with em; 200% text resize OK) |
| 18 | Real a11y/phone verification | NOT RUN | axe + Playwright (CI), TalkBack (U14) |

Open minor items (S3, not blocking): Open and Delete are right-aligned in the same column (mitigated by confirm dialog + divider before Delete); tonal button boundaries are faint; keyboard may cover centred dialogs on very short screens (dialog is top-biased in v2).
