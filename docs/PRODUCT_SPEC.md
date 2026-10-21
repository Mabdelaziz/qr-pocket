# QR Pocket — Product Specification

Status: DRAFT (Phase 0, awaiting approval) · Date: 2026-10-21 · Tagline: *Create. Save. Share.*

## 1. Scope
A small, installable, offline-first PWA for Android Chrome and modern desktop browsers. The user enters text or a URL (Arabic, English, emoji, multiline), sees a QR code generated locally, saves it on the device, downloads it as PNG, and shares it. No accounts, backend, tracking, ads, or runtime network dependencies.

### Version roadmap
- **1.0 (this scope):** generate, save, export/share, offline PWA.
- **1.1 (roadmap, not approved for build):** camera scanning (needs its own spec, permission and privacy review).

### Out of scope (MVP)
Camera scanner, QR styling/colours/logos, cloud sync, accounts, PDF/SVG export, analytics, monetisation, APK packaging, notifications, import/export of the library, UI translation (UI stays English; content may be RTL), vCard/WiFi templates.

## 2. Personas and journeys
**Sara (phone, on the go)** needs a QR for a URL or Arabic text quickly, then wants it again later.
- J1 Generate: open app → type → see QR → Download PNG or Share.
- J2 Save and reuse: Generate → Save → later open Saved → open item → Download/Share.
- J3 Manage: Saved → rename or delete (with confirmation).
- J4 Offline: install once → airplane mode → J1–J3 still work.
- J5 Update: new version deployed → app shows "Update available" → user reloads when ready.

## 3. User stories (ID → spec)
| ID | Story | Spec |
|---|---|---|
| US-01 | As a user I enter text/URL and see a scannable QR immediately. | SPEC-001 |
| US-02 | As a user I enter Arabic/emoji/multiline text and it scans back exactly. | SPEC-001 |
| US-03 | As a user I am told clearly when input is blank or too long (never truncated). | SPEC-001 |
| US-04 | As a user I save a QR with a title and see it in a list with a thumbnail. | SPEC-002 |
| US-05 | As a user I reopen, rename and delete saved QRs (delete confirmed). | SPEC-002 |
| US-06 | As a user my saved QRs survive restarts; I am warned data can be erased with browser data. | SPEC-002 |
| US-07 | As a user I download a 1024×1024 PNG with a sensible filename. | SPEC-003 |
| US-08 | As a user I share the PNG via the system share sheet, with download fallback. | SPEC-003 |
| US-09 | As a user I install the app and use Generate/Saved/Export offline. | SPEC-004 |
| US-10 | As a user I am told when an update is available or the app is offline. | SPEC-004 |
| US-11 | As the owner I get automated, cloud-run verification and a gated deploy. | SPEC-005 |

## 4. Functional requirements (measurable)
- FR-1 Blank/whitespace-only input is rejected with inline message; no QR rendered.
- FR-2 Encoding is UTF-8 byte mode; byte count shown; payload round-trips byte-exact through an independent decoder (jsQR + second decoder in CI).
- FR-3 Capacity: default ECC level M, never downgraded automatically. If content exceeds M capacity, show an understandable error (bytes vs limit) and an explicit "Use lower error correction (L)" action when it fits at L; if it exceeds L (2953 bytes at v40-L) show the limit and render nothing.
- FR-4 Preview: black on white, quiet zone ≥ 4 modules, integer module scale (no blur), min 240 CSS px on a 360 px screen.
- FR-5 PNG: exactly 1024×1024 px, including quiet zone; white background; filename `qr-<slug>-<yyyymmdd>.png`, slug sanitised (fallback `qr-code`).
- FR-6 Saved record = {id, title, payload, ecc, createdAt, updatedAt}; no image blobs stored. Default title = first 40 chars of first line, else "QR code <date>".
- FR-7 Rename cannot be blank (falls back to default title). Delete requires confirmation. Storage errors shown visibly, never swallowed.
- FR-8 Share uses `navigator.canShare({files})`; if unsupported, Share is hidden or falls back to download. User cancel (AbortError) is silent; other errors show a message.
- FR-9 Notice: "Saved codes live only in this browser on this device. Clearing site data or uninstalling may erase them." No backup is claimed.
- FR-10 Offline: after first successful load and SW activation, app shell loads and Generate/Saved/Export work with network disabled.
- FR-11 URL field copy: "The QR contains exactly the text you enter. Links are not shortened or checked."

## 5. Non-functional requirements
- Size: first-load transfer ≤ 150 KB gzip (budget; verified in CI build report).
- Performance: generation ≤ 100 ms for 500 bytes on mid-range Android (manual UAT); live generation debounced 150 ms.
- Privacy: zero network requests during core flows (Playwright request log assertion); no storage of payloads in Cache API.
- Accessibility: WCAG 2.2 AA target; touch targets ≥ 48×48 CSS px; keyboard operable; visible focus; labelled controls; dialogs trap focus and restore it; status messages via `aria-live`; RTL text via `dir="auto"` on input/title/preview text only.
- Responsive: 320, 360, 430 px and desktop; no horizontal scroll.
- Browsers: Android Chrome (current−2), desktop Chrome/Edge/Firefox/Safari current.
- Light theme only (MVP); honour `prefers-reduced-motion`.
- Typography: body 16px; helper text, counters, action and navigation labels ≈ 14px (rem-based so 150%/200% text scaling works); action rows wrap instead of shrinking fonts.
- On-screen keyboard: essential actions and navigation stay reachable (viewport `interactive-widget=resizes-content`; in-flow, scrollable layout).

## 6. Constraints and assumptions
No local build tools (see CLAUDE.md). GitHub Pages project site at `/qr-pocket/`. Android Gallery writes are not promised; PNG goes to Downloads via the browser. Share-file support varies by browser.

## 7. Release success criteria
All automated CI gates green on the release commit AND physical-phone UAT matrix (TEST_PLAN §5) completed by the owner with recorded results.
