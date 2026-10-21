# QR Pocket — Android phone acceptance checklist

For the owner, on the **physical Android phone**, after the first test deployment is authorised. Nothing in this list has been run yet. Detailed background and "what to send back": `docs/ANDROID_TESTING.md`. Plain-language app help: `docs/USER_GUIDE.md`.

Address: https://mabdelaziz.github.io/qr-pocket/ (only after you authorise the first deployment).

Fill in once: Phone model ______ · Android version ______ · Chrome version ______ · Date ______ · Second scanner app ______

Mark each line ✔ or ✘. For every ✘ write what you saw (and take a screenshot).

## A. Install and launch (U2)
- [ ] A1 Open the address in **Chrome** (not inside another app). The page loads and shows "Create a QR code".
- [ ] A2 Type any text. After the QR appears, either the card "Keep QR Pocket on your phone" shows, or you use Chrome menu ⋮ → **Install app** / **Add to Home screen**. Which one worked? ______
- [ ] A3 A blue rounded icon with a white QR mark is on the home screen (and in the app list, not oddly clipped).
- [ ] A4 Open it **from the home-screen icon**: no browser address bar, the app name is QR Pocket, no install card.

## B. English and Arabic codes, scanned by other apps (U3–U5)
- [ ] B1 Enter `https://example.com/hello`. Scan the **screen** with the phone camera app: it offers exactly this link.
- [ ] B2 Scan the same screen with the **second scanner app**: same link.
- [ ] B3 Enter Arabic text, for example `مرحبا بالعالم`. Scan with the camera app: the Arabic text reads correctly.
- [ ] B4 Scan the Arabic code with the second scanner: same text. (If one scanner garbles it, write down which — that is a finding, not a failure of the other.)
- [ ] B5 A multi-line text with an emoji reads back completely.

## C. Save, reopen, rename, delete
- [ ] C1 **Save** the URL code and the Arabic code; the button changes to "Saved".
- [ ] C2 Open **Saved**: both appear, newest first, with small pictures.
- [ ] C3 **Open** one: the text appears on the Generate screen with its QR code.
- [ ] C4 **Rename** one: new title shows; Cancel and Esc/back leave it unchanged.
- [ ] C5 **Delete** one: a question appears first; Cancel keeps it; Delete removes it.

## D. Download and share
- [ ] D1 **Download PNG**. Find the file: Files app → Downloads (or Chrome ⋮ → Downloads). It may not show in Photos; that is expected. Location found: ______
- [ ] D2 Open the PNG: large, black on white, with a white border. Scan it from another screen or print: it reads correctly.
- [ ] D3 **Share**: the Android share sheet opens. Send it to a real app (messages, e-mail, drive). The receiver gets a PNG image.
- [ ] D4 Cancel the share sheet: the app shows no error and stays usable.

## E. Offline (U8)
- [ ] E1 With the app already opened once online, turn on **Airplane mode**.
- [ ] E2 Close the app completely (recent apps → swipe away). Open it from the icon: it opens, shows **Offline**, and the saved codes are listed.
- [ ] E3 While offline: create a code, **Save**, **Open** a saved one, **Download PNG**.
- [ ] E4 Turn Airplane mode off: the Offline notice disappears.
- [ ] E5 Close and reopen the app once more (online): everything saved is still there.

## F. Comfort and accessibility (U14)
- [ ] F1 Settings → Display → **Font size** largest and **Display size** largest: nothing is cut off; no sideways scrolling.
- [ ] F2 **TalkBack** on: you can reach the text field, Generate/Clear, Save, Download, Share, the Saved list and each card's buttons, and each button has a sensible spoken name. Notices (offline, update) are read once.
- [ ] F3 With a Bluetooth/USB **keyboard**: Tab moves through the page in a sensible order, Enter activates buttons, Esc closes dialogs and focus returns to where you were.
- [ ] F4 Rotate to landscape and back: layout is still usable.

## G. Updates do not lose data (U13, needs a second deployment)
- [ ] G1 With saved codes and the app installed, a new version is deployed. Open the app online: "A new version is ready." with **Reload** / **Later**; nothing reloads by itself.
- [ ] G2 Press **Later**: the bar goes away. Close and reopen: the offer returns.
- [ ] G3 Press **Reload**: the app reloads once; **all saved codes are still there**.
- [ ] G4 Build shown before ______ / after ______ (open `/qr-pocket/version.json` in Chrome to see the commit).

## H. Recovery (only if something is stuck)
- [ ] H1 If the app shows an old or blank page: follow `docs/SW_RECOVERY.md`. Export what you need as PNG first; clearing site data removes saved codes.

## Result
Overall: ☐ accepted ☐ accepted with notes ☐ not accepted. Notes: ______________________

Send back the filled list, with phone details and screenshots of any ✘. Failures are recorded as defects in `docs/PROGRESS.md` and fixed through the normal pull request flow; nothing is marked as physically tested until you report it.
