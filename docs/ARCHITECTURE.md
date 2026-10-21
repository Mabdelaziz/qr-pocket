# QR Pocket — Architecture

Status: DRAFT (Phase 0) · Date: 2026-10-21 · Registry metadata was read 2026-10-21 (see ADR-002/011); nothing is installed, so behaviour/size remain **UNVERIFIED** until the first cloud run.

## 1. Shape: static, client-only PWA
```
Browser (Android Chrome / desktop)
 ├─ index.html + hashed JS/CSS  (served by GitHub Pages, /qr-pocket/)
 ├─ Service worker (Workbox via vite-plugin-pwa) — precache app shell only
 └─ App (vanilla TypeScript, no framework)
     ├─ ui/       DOM views + dialogs + router (hash: #/generate, #/saved)
     ├─ qr/       encode(text,ecc) → ModuleMatrix | CapacityError   (pure, no DOM)
     ├─ render/   matrix → canvas/PNG Blob (preview, thumbnail, 1024 export)
     ├─ store/    IndexedDB repository (CRUD), typed errors
     ├─ share/    canShare/share/download helpers, object-URL cleanup
     └─ pwa/      SW registration, install prompt, online/offline + update status
```
Dependency direction: `ui → {qr, render, store, share, pwa}`; `render → qr` types only; `qr` and `store` never import `ui`. This keeps the codec and persistence unit-testable under Vitest without a browser.

## 2. Data flow
1. User types → debounced `encode(text, 'M')` → matrix or error → ui shows preview (canvas) or message.
2. Save → `store.add({title,payload,ecc})` → list refresh.
3. Saved list → for each record lazily `encode` + render a ~96 px thumbnail (IntersectionObserver or simple sequential render; ≤ few hundred items assumed).
4. Export → `render.toPng(matrix, 1024)` → `Blob` → `share.download` or `share.shareFile`; object URLs revoked after use.
No payload ever leaves the device; the only network traffic is loading/updating the static app shell.

## 3. Storage schema (IndexedDB)
DB `qr-pocket`, version 1, store `codes` (keyPath `id`), index `createdAt`. Listing order is newest first by `createdAt` (ADR-016).
```ts
interface SavedCode {
  id: string;            // crypto.randomUUID()
  title: string;         // 1–80 code points
  payload: string;       // original text, exact
  ecc: 'L' | 'M';        // level actually used
  source: 'typed' | 'scanned'; // 'scanned' reserved for V1.1 camera scanning; 1.0 writes 'typed' only
  createdAt: number;     // epoch ms
  updatedAt: number;
  v: 1;                  // record schema version
}
```
Migrations: `onupgradeneeded` switch on `oldVersion` (v1 creates the store). Hand-written promise wrapper in `src/store/indexedDb.ts` (ADR-004) — no dependency; every operation resolves on transaction **complete** and rejects on abort/error. `add` uses `IDBObjectStore.add` only, so an existing record is never overwritten. Errors map to `StoreError` kinds `unavailable | quota | not-found | invalid | unknown` and are surfaced in the UI; generation and export never depend on storage. `navigator.storage.persist()` is NOT requested in 1.0 (not claimed anywhere).

## 4. QR encoding and rendering
- Byte mode, UTF-8 (`TextEncoder`), explicit ECC chosen by the user (default M, never auto-downgraded); thin wrapper around `qrcode-generator` so the library is swappable (ADR-002).
- Rendering is ours: draw dark modules with `fillRect` at an **integer** scale, `imageSmoothingEnabled=false`, quiet zone 4 modules. For the 1024 export (`src/export/png.ts`): largest EVEN integer scale with scale × (n+8) ≤ 1024, symbol centred on a white 1024×1024 image so the padding is exactly symmetric (largest symbol: 4 px/module); pixels are produced by a pure function (`renderExportRgba`) that tests decode directly, then encoded by the canvas.
- `canvas.toBlob('image/png')`; fallback path if `OffscreenCanvas` missing — use plain `HTMLCanvasElement`.

## 5. PWA and service-worker scope
- Vite `base: '/qr-pocket/'`; manifest `start_url: '/qr-pocket/'`, `scope: '/qr-pocket/'`, `id: '/qr-pocket/'`, `display: standalone`, icons 192/512 + maskable 512 (generated from an SVG source committed to the repo; PNGs produced in CI or authored as static files).
- SW registered at `/qr-pocket/sw.js`; scope cannot exceed its directory, so it cannot affect other project sites on the same `github.io` origin — **but IndexedDB/Cache storage is shared per origin (`<user>.github.io`)**, so DB and cache names are prefixed `qr-pocket`.
- Precache: build output only (`**/*.{js,css,html,svg,png,webmanifest}`), `navigateFallback: index.html`. No runtime caching of anything else; no payload ever in Cache API.
- Updates: `registerType: 'prompt'` — user sees "Update available — Reload"; no forced reload mid-edit. `cleanupOutdatedCaches: true`.

## 6. Trust boundaries and security
- Only untrusted input: user text. It is rendered via `textContent` (never `innerHTML`); titles likewise.
- Strict CSP via `<meta http-equiv>` (GitHub Pages cannot set headers): `default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'`. (`frame-ancestors` not possible in meta — documented limitation.)
- No third-party scripts, fonts or CDNs. Dependencies: few, pinned by lockfile, `npm audit` + license check in CI, Dependabot proposed (needs owner approval).
- Workflows: least-privilege `permissions`, official actions pinned to major (SHA pinning proposed), no secrets needed.

## 7. Error handling
Typed results at module boundaries (`Result`-style or thrown typed errors), mapped to a small set of user messages in `ui/messages.ts`. Every async user action has busy/success/error states. Unhandled promise rejections are logged to console only (no telemetry).

## 8. Testing architecture
| Layer | Tool (runs in GitHub Actions only) |
|---|---|
| Codec, render, filename, store | Vitest (+ `fake-indexeddb`, canvas via Playwright instead of jsdom for PNG tests) |
| Independent decode | jsQR + second decoder (e.g. `zxing-wasm`) in dev only, decoding PNG pixels, compare bytes |
| Browser flows, a11y, offline, subpath | Playwright (Chromium) against `vite preview --base /qr-pocket/` with axe-core |
| Static checks | `tsc --noEmit` strict, ESLint, `npm audit`, bundle-size gate |
See `TEST_PLAN.md`.

## 9. ADR index
Full text in `DECISIONS.md`: ADR-001 vanilla TS+Vite; ADR-002 QR encoder (revised: qrcode-generator, Nayuki is not on npm); ADR-003 own canvas renderer; ADR-004 hand-written IndexedDB wrapper; ADR-005 vite-plugin-pwa; ADR-006 hash routing; ADR-007 ECC policy (revised: explicit L option); ADR-008 CI/release gating.
