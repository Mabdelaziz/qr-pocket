# QR Pocket — Android phone testing (install, offline, update)

Status: instructions only. **Nothing here has been run on a physical phone**; results must be recorded by the owner (Phase 6 UAT). The app is not deployed (GitHub Pages is disabled), so these steps become possible only after a deployment you authorise. Until then the same flows are checked by automated tests in cloud CI (Chromium, Firefox, WebKit).

## Before you start
- Android phone with **Chrome** (note the version: Chrome menu → Settings → About Chrome).
- The deployed HTTPS address of the app (will be provided after a release is authorised).
- A second QR scanner app or another phone to scan the codes. Record phone model and Android version.

## 1. Install (UAT U2)
1. Open the address in Chrome and wait for the page to finish loading.
2. Create any QR code (type some text). After the first QR appears, Chrome may offer the app: a card **"Keep QR Pocket on your phone"** with **Install app** / **Not now**. It is only shown if Chrome allows installation; it does not appear on every visit (see policy: not before a QR exists, quiet for 30 days after "Not now", for 7 days if ignored).
3. If no card appears: Chrome menu (⋮) → **Install app** or **Add to Home screen**. Either path is fine; record which one worked.
4. Open QR Pocket from the new home-screen icon. Expected: opens without the browser address bar (standalone), blue rounded icon with the white QR mark, no install card.
- ✔/✘ Icon looks right (including in the app drawer; the maskable icon should not be clipped oddly).

## 2. Offline (UAT U8)
1. With the installed app (or the browser tab) already opened once online, wait ~5 seconds. A note **"Ready to work offline."** may appear once.
2. Turn on **airplane mode**. Close the app completely and open it again from the icon.
3. Expected: the app opens; header shows **Offline**; a bar says "You're offline. Creating, saving and exporting still work."
4. Create a code with Arabic text (for example مرحبا بالعالم) and a URL; press **Save**; open **Saved**; **Open** an item; **Download PNG**.
5. Turn airplane mode off. Expected: the Offline chip and bar disappear.
- ✔/✘ each step. Note where the PNG landed (Downloads folder / Files app). It may or may not appear in Photos; that is expected.

## 3. Saved codes survive (UAT U7)
Close the app, reopen it (online and offline). Expected: the Saved list still contains your items, newest first.

## 4. Scan checks (UAT U3–U5)
Scan the on-screen QR and the downloaded PNG with the stock camera **and** a second scanner. Check the URL, the Arabic text and an emoji + multi-line text are read exactly. Report any scanner that garbles Arabic.

## 5. Update (UAT U13) — after a second version has been deployed
1. Open the installed app while online.
2. Expected: a bar **"A new version is ready."** with **Reload** and **Later**. If you had typed text, the bar warns that reloading clears it. The page must **not** reload by itself.
3. Press **Later**: the bar disappears; nothing reloads. Close and reopen the app: the offer returns.
4. Press **Reload**: the app reloads once into the new version; your saved codes are still there.
- ✔/✘ and the version you saw before and after.

## 6. Accessibility and layout quick pass (UAT U14)
- Turn on TalkBack: swipe through the header, notices, Generate and Saved; confirm the "Offline", update and install notices are read sensibly and not twice.
- Settings → Display → **Font size** to the largest and **Display size** to the largest: confirm nothing is cut off and no sideways scrolling.
- Rotate to landscape and back.

## What to send back
For each numbered step: ✔ or ✘, phone model, Android and Chrome versions, a screenshot for any ✘, and the exact text of any message that looked wrong. Use the format in `docs/TEST_PLAN.md` §6: `Uxx · device · Chrome version · expected · actual`.

## If something goes wrong
- App stuck on an old version or blank: `docs/SW_RECOVERY.md`. Do **not** clear site data before exporting codes you need as PNG files (clearing removes saved codes).
