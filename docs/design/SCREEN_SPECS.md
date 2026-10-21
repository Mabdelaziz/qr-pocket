# QR Pocket — Screen Specifications (initial wireframes)

Status: APPROVED at Gate G1b by the owner on 2026-10-21 with the refinements in "Final G1b refinements" below (Phase 1, visual refinement v2; before/after in `mockups/compare.html`, v1 kept in `mockups/v1/`). **Visual wireframes: `mockups/index.html`** (static HTML/CSS, open in any browser; frames G1–G12, S1–S7, N1–N5, R1–R8, D1). ASCII sketches below are superseded by the mockups where they differ. Primary viewport 360–430 px; verify 320 px and desktop.

## Design tokens (v2 — Soft Modern / Minimal Utility, proposed at G1b)
Authoritative values are the CSS custom properties at the top of `mockups/mock.css`; they seed the app stylesheet. Vanilla CSS only; no frameworks, icon libraries or web fonts; icons are small inline SVGs we own.
| Token | Value | Notes / measured contrast |
|---|---|---|
| `--bg` | #F5F7FB | App background |
| `--surface` | #FFFFFF | Cards, header, nav, dialogs |
| `--primary` | #155EEF | White on primary 5.41:1; primary on white 5.41:1 |
| `--text` | #172033 | 16.3:1 on white |
| `--muted` | #64748B | **Only on white** (4.76:1) and for icons/placeholder. On #F5F7FB it is 4.44:1 (fails AA) |
| `--muted-text` | #55637A | Small secondary text anywhere (6.1:1 white, 5.7:1 on bg). Owner asked for #64748B; this darker twin is needed for AA on the page background |
| `--line` | #E5EAF2 | Decorative card/divider borders only |
| `--field` | #8391A6 | Input border, 3.20:1 on white (WCAG 1.4.11) |
| `--tonal` / `--tonal-text` | #EEF3FE / #1243B0 | Calm secondary buttons, 7.69:1 |
| Error | bg #FEF3F2, border #FDA29B, text #B42318 | Title 6.05:1, body #7A271A 9.06:1; solid danger button white on #B42318 6.57:1 |
| Warning | bg #FFFAEB, border #FEC84B, text #7A2E0E | 9.05:1 |
| Success | bg #ECFDF3, border #75E0A7, text #05603A | 7.26:1 |
| Info | bg #EFF4FF, border #B2CCFF, text #1B3F8F | 8.85:1 |
| Radius | cards 16px, controls 12px, dialogs 20px | |
| Spacing | 4 / 8 / 12 / 16 / 24 / 32 px (`--s1…--s6`) | |
| Shadow | `0 1px 2px rgba(23,32,51,.06), 0 4px 12px rgba(23,32,51,.06)` | Subtle; cards and QR container only |
| Focus | 3px white + 3px #155EEF ring (`--focus`); inputs: blue border + 4px glow | Ring 5.4:1 on white |
| Type | `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Arabic", "Noto Naskh Arabic", sans-serif`; base 16px; sizes in `em` so text scaling works | |
| Motion | skeleton pulse 1.4s and 120ms background transition only; disabled under `prefers-reduced-motion` | |
Contrast figures were computed by the independent reviewer from the CSS values (2026-10-21); they are calculations, not device tests.

## Final G1b refinements (owner-approved 2026-10-21) — binding for implementation
1. `--muted-text` #55637A approved for small text on the page background.
2. Disabled actions carry no explanatory message (the empty preview / error panel explains).
3. The "Saved" confirmation sits next to the Save action (merged with the device-only notice).
4. **Save state:** after a successful save the Save button becomes a non-repeatable "Saved" state. It **resets to Save whenever the text or any relevant QR setting (error-correction level) changes**, so a legitimate new record can always be saved; saving unchanged content twice is prevented, but saving the same text again after any edit (or after switching Medium/Low) is allowed and creates a new record. Specified in SPEC-002 (AC11).
5. No always-visible error-correction selector in Version 1.0: Medium by default; Low only through the explicit "Use lower error correction (L)" action when the text does not fit Medium.
6. Action labels, helper text, counters and nav labels are **about 14px (0.875rem)** where practical; body text 16px.
7. Action rows **wrap gracefully** at narrow widths or large text instead of shrinking fonts (Saved-card actions may become 3 + 1 at 320px; Download PNG / Share stack at large text).
8. Implementation must cover: live-region announcements for success and errors (status region updated only on state changes; alerts not rebuilt while typing); native `<dialog>` focus management and restoration; correct Arabic direction (`dir="auto"`) and exact Unicode handling (no normalisation); 150% and 200% text scaling; no horizontal overflow at 320px; bottom navigation and essential actions reachable with the on-screen keyboard (`interactive-widget=resizes-content`, in-flow layout that scrolls); consistent minimum 48px touch targets; sharp scanner-readable QR on a white surface with a 4-module quiet zone (integer scale, `image-rendering: pixelated`).
Version 1.1 roadmap (NOT in 1.0): camera scanning.

### Status components (never colour alone)
Each of info / warning / success / error has its own icon shape (circle-i, triangle-!, circle-check, circle-!) plus text, and a visually hidden prefix ("Note:", "Warning:", "Success:", "Error:"). Errors use `role="alert"`; others `role="status"`. Notices are inline bars below the header or panels in the flow — never floating over the navigation or the primary actions.

### Implementation notes from the independent a11y review (apply in Phase 2/3)
- Link the textarea to its counter, hint and error via `aria-describedby`; update the byte counter in a debounced polite live region; do not re-announce `role="alert"` on every keystroke.
- Per-card buttons keep visible text and add accessible names that include the item title (e.g. `aria-label="Rename Wi-Fi poster"`).
- Dialogs: `showModal()` (top layer, focus trap, Esc, inert background); focus returns to the opener or the nearest surviving item; delete dialog has `aria-describedby`; wrap titles in quotes with `<bdi>`; position dialogs near the top and allow `max-height` so the on-screen keyboard does not cover them.
- After Save, the button becomes a "Saved" state (prevents accidental repeat saves) that resets when text or QR settings change (see Final G1b refinements #4); a polite status confirms it next to the button; use an aria-hidden icon, not a ✓ glyph.
- `aria-disabled` buttons ignore activation; the reason is the visible empty-preview text or the error panel (no separate "why disabled" message).
- Use `viewport-fit=cover`; safe-area padding on all sides; forced-colors styles keep button borders.
- Render QR with integer module scale (or `shape-rendering: crispEdges`) to avoid shimmer; give the preview a short label, not the payload.
- IDs in the mockups repeat across frames by design; the app must keep one `<main>`, one `<h1>` and unique ids per document.

## Global rules
- Light theme, system font stack (see tokens) — no web fonts, no icon library.
- Layout: header (app name) · main · bottom tab bar (Generate | Saved). Desktop: content max-width 560 px centred; tabs stay at the bottom or move to top (decide at Phase 1).
- Touch targets ≥ 48×48 px; body text ≥ 16 px (prevents iOS/Android input zoom); contrast ≥ 4.5:1.
- Tabs are `<nav>` with links and `aria-current="page"`. Route change moves focus to the screen `<h1>`.
- Status/errors in an `aria-live="polite"` region (errors `role="alert"`).
- RTL: only user content uses `dir="auto"`; chrome stays LTR English.

## Screen map
```
 [Generate] ⇄ [Saved] ── open item ──> [Generate view of saved item (read/edit)]
      │            ├── Rename dialog
      │            └── Delete confirm dialog
      └── banners: Offline · Update available · Install hint · Storage notice
```

## 1. Generate (`#/generate`)
```
┌──────────────────────────────┐
│ QR Pocket        ● Offline   │  header + status chip
├──────────────────────────────┤
│ Text or link                 │  <label>
│ ┌──────────────────────────┐ │
│ │ https://example.com      │ │  <textarea dir=auto rows=4>
│ └──────────────────────────┘ │
│ 23 bytes · max 2,953   [Clear]│  counter (aria-live off), Clear btn
│ The QR contains exactly what │
│ you type. Links aren't       │
│ shortened or checked.        │  helper text
│ ┌──────────────────────────┐ │
│ │      ▓▓ QR PREVIEW ▓▓    │ │  canvas, role=img, aria-label
│ └──────────────────────────┘ │
│ [ Save ]                     │  primary, 48px
│ [ Download PNG ] [ Share ]   │  secondary
├──────────────────────────────┤
│  ▣ Generate   |   ☰ Saved    │
└──────────────────────────────┘
```
Live generation (debounced 150 ms); no separate "Generate" button, Clear resets and focuses the input.
| State | Presentation |
|---|---|
| Empty | Compact preview placeholder "Type something to see your QR code"; Save/Download/Share shown muted (`aria-disabled`) with no separate explanatory message. |
| Invalid (blank spaces) | Inline message "Enter some text or a link." after first interaction; no QR. |
| Too long for Medium, fits Low (G5) | `role=alert`: "Too long for Medium error correction: N bytes, maximum 2,331." + one-line Low explanation + button **Use lower error correction (L)**. No QR, actions disabled. Nothing changes until pressed. |
| Low selected (G6) | QR drawn; persistent line "Error correction: Low · Back to Medium". |
| Too long even for Low (G7) | `role=alert`: "Too long: N bytes. The most a QR code can hold is 2,953 bytes." No option. |
| Busy | Preview shows "Generating…" only if > 200 ms. |
| Success | QR shown at Medium (default). |
| Saved ok | Toast/status "Saved to this device"; Save becomes "Saved ✓" until text changes. |
| Error | Storage/PNG/share errors inline with Retry where meaningful. |
| Share unsupported (G11) | Share button hidden; line "Sharing files isn't supported in this browser — use Download." Download remains. |
Storage notice (first save and in Saved footer): "Saved codes stay on this device in this browser. Clearing site data or uninstalling may erase them."

Acceptance checks (A-GEN):
1. 360 px: input, preview ≥ 240 px, and all three actions visible after scrolling, no horizontal scroll; same at 320 and 430.
2. Arabic text typed → preview renders; input text aligned RTL.
3. Tab order: input → Clear → Save → Download → Share → tabs; focus ring visible.
4. Each state in the table is reachable and has a Playwright assertion.
5. Screen reader announces errors and "Saved".

## 2. Saved (`#/saved`)
```
┌──────────────────────────────┐
│ Saved codes                  │  h1
├──────────────────────────────┤
│ ┌────┐ Wi-Fi poster          │
│ │QR  │ 21 Oct 2026           │  card = <li>
│ └────┘ [Open] [⋯ Actions]    │  Open=primary; actions: Rename, Download, Share, Delete
│ ┌────┐ مرحبا بالعالم         │
│ │QR  │ 20 Oct 2026           │
│ └────┘ [Open] [⋯ Actions]    │
│ Saved codes stay on this     │
│ device… (storage notice)     │
├──────────────────────────────┤
│  ▣ Generate   |   ☰ Saved    │
└──────────────────────────────┘
```
To avoid hidden menus, MVP uses visible buttons: **Open, Rename, Download, Share, Delete** wrapped in a 2-row action group (decide icon vs text at Phase 1; text labels preferred). Search is **out** unless > 20 items proves painful (not MVP).
| State | Presentation |
|---|---|
| Loading | "Loading saved codes…" |
| Empty | "Nothing saved yet." + button "Create a QR code" → Generate. |
| Error | `role=alert` "Couldn't open saved codes on this device." + Retry; Generate still works. |
| Populated | Newest-updated first; title uses `dir=auto`, truncated with ellipsis, full on Open. |
Thumbnails render lazily from payload (≈ 96 px, integer scale); alt text empty (title adjacent).
Acceptance checks (A-SAV): persistence after reload; ordering; delete removes card and focuses next item or the empty-state button; 320 px cards wrap without overflow; keyboard reaches every action; thumbnails absent when payload fails to encode (placeholder box, no crash).

## 3. Dialogs (native `<dialog>` + `showModal()`)
**Rename**
```
┌ Rename code ───────────────┐
│ Title [__________________] │  input, maxlength 80, prefilled, selected
│ (inline error if too long) │
│        [Cancel]  [Save]    │
└────────────────────────────┘
```
**Delete confirmation**
```
┌ Delete this code? ─────────┐
│ "Wi-Fi poster" will be     │
│ removed from this device.  │
│ This can't be undone.      │
│        [Cancel] [Delete]   │  Cancel is default focus; Delete is danger style
└────────────────────────────┘
```
Rules: focus moves into dialog (input for Rename, Cancel for Delete); Esc cancels; focus returns to the invoking button (or nearest survivor after delete); background inert; Enter submits Rename; blank title → default title; failures keep the dialog open with an inline alert.
Acceptance checks (A-DLG): Esc closes without change; focus return verified; Delete cannot be triggered by Enter on open; dialog fits 320×480 viewport with soft keyboard.

## 4. Install / offline / update notices
- **Offline chip** in header: appears on `offline` event, text "Offline — everything still works". Hidden online. Not blocking.
- **Update banner** (top, below header): "A new version is ready. [Reload]  [Later]". Appears only when the SW reports a waiting worker; never auto-reloads.
- **Install hint**: if `beforeinstallprompt` fires, show a dismissible line on Generate, "Install QR Pocket for quick access. [Install] [Not now]"; dismissal remembered in `localStorage` (`qr-pocket.installDismissed`). If unsupported, show nothing (no iOS-instruction clutter in MVP).
- **Offline-ready toast** once: "Ready to work offline" when precache completes (first install only).
Acceptance checks (A-PWA): offline chip toggles with network emulation; update banner appears when a new SW is waiting (simulated in test) and Reload activates it; install hint is dismissible and stays dismissed; banners don't cover primary actions at 320 px and are announced politely.

## Phase 4 notices as built (2026-10-21, SPEC-004)
- Header chip **Offline** (icon + text; hidden online) and, while offline, a bar "You're offline. Creating, saving and exporting still work." Announced once per transition through the polite status region ("Back online." on return).
- **Update bar** "A new version is ready." with **Reload** (primary) and **Later**; when the text field holds text the message adds "Reloading will clear the text you are typing." and follows the field. Never reloads on its own.
- **Ready bar** "Ready to work offline." once per browser profile, with **Dismiss**.
- **Install bar** titled "Keep QR Pocket on your phone" — "Install QR Pocket for quick access and offline QR creation. No account needed." — **Install app** / **Not now**; shown only after the browser offered installation and a QR has been shown; not announced.
- All bars are inline under the header, labelled groups (accessible name follows the visible title/text), wrap at 320px and at 150%/200% text, targets ≥ 48px, and return focus to the screen heading when the focused bar closes.
