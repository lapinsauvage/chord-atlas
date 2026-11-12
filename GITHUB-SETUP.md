# From this repository to the app on your phone

GitHub builds both apps for free with "GitHub Actions" (`.github/workflows/build.yml`):

- **iPhone:** `ChordAtlas.ipa`, built on a Mac that GitHub lends out. Installed with a free sideloading tool.
- **Android:** `ChordAtlas.apk`, built on a Linux machine. Installed by tapping it on the phone.

Every change pushed to `main` builds both and publishes them together under **Releases**.

---

## Part 1 — The repository (already done for `lapinsauvage/chord-atlas`)

1. On **github.com**: top right **+** → **New repository**, name it `chord-atlas`, leave "Add a README" unticked, and click **Create repository**.
   **Public** gives unlimited free build minutes. **Private** is free too, but limited to roughly 25 iPhone builds a month.
2. Upload the project. Either let Claude push it, or use **Add file → Upload files** in the browser.
   The hidden `.github` folder is often skipped by drag-and-drop. If so, create `.github/workflows/build.yml` with **Add file → Create new file** and paste the file's contents.

## Part 2 — Add the Android signing key (once, ~2 minutes)

Android only installs a new version over an old one when both are signed with the same key. Your key is in the file **`ANDROID-SIGNING-SECRETS.txt`**, which Claude gave you separately. It is never stored in the repository.

1. Open **https://github.com/lapinsauvage/chord-atlas/settings/secrets/actions** (Settings → Secrets and variables → Actions).
2. Click **New repository secret**. Name: `ANDROID_KEYSTORE_PASSWORD`. Secret: the password from the file. Click **Add secret**.
3. Click **New repository secret** again. Name: `ANDROID_KEYSTORE_BASE64`. Secret: the long single line from the file, all of it. Click **Add secret**.
4. Keep `ANDROID-SIGNING-SECRETS.txt` somewhere safe, for example in a password manager. If it is lost, a future version needs an uninstall first, which erases saved progressions.

Without these secrets the Android build still works, but it is signed with a temporary key. GitHub then shows a yellow warning on the run.

## Part 3 — Let GitHub build (automatic)

1. Open the **Actions** tab. If GitHub asks, click **I understand my workflows, go ahead and enable them**.
2. The run **Build apps (iOS + Android)** starts after every change. To start one by hand: click it on the left → **Run workflow** → **Run workflow**.
   - Android takes about 3–5 minutes.
   - iPhone takes about 5–10 minutes, plus any wait for a free Mac.
3. When it is done, the repository's main page shows **Releases** on the right → **Chord Atlas 1.0 (build N)**, with `ChordAtlas.apk` and `ChordAtlas.ipa`.
   These links always download the newest version:
   - Android: https://github.com/lapinsauvage/chord-atlas/releases/latest/download/ChordAtlas.apk
   - iPhone: https://github.com/lapinsauvage/chord-atlas/releases/latest/download/ChordAtlas.ipa
   If one of the two builds fails, the other is still published. The error is shown at the top of the failed run.

---

## Part 4a — Install on Android

1. On the phone, open https://github.com/lapinsauvage/chord-atlas/releases/latest/download/ChordAtlas.apk in Chrome. It downloads the newest APK.
2. Open it, from the download notification or from **Files → Downloads**.
3. The first time, Android asks to allow installs from this source (Chrome or Files): tap **Settings → Allow from this source**, then go back.
4. Tap **Install**. If Google Play Protect warns that it doesn't recognise the app (normal for apps not from the Play Store), tap **More details → Install anyway**.
5. Open **Chord Atlas**.

**Updating:** install the newer APK the same way. It replaces the old version and keeps your saved data, as long as both were signed with your key from Part 2.
There is no time limit on Android.

## Part 4b — Install on iPhone

iPhones only install signed apps. The IPA from GitHub is unsigned on purpose; a sideloading tool signs it with your own Apple ID.

### Option 1: Sideloadly (Windows or Mac), recommended
1. Install **Sideloadly** from **sideloadly.io**. On Windows also install **iTunes** and **iCloud** from apple.com (the non-Microsoft-Store versions, as Sideloadly's site explains).
2. Connect your iPhone with a cable, unlock it and tap **Trust** if asked.
3. Open Sideloadly, drag **ChordAtlas.ipa** into it, enter your Apple ID e-mail and click **Start**. Enter your Apple ID password (and 2-factor code) when asked.
   Sideloadly states it sends these only to Apple. If you prefer, use a separate Apple ID made just for sideloading.
4. On the iPhone:
   - **Settings → General → VPN & Device Management** → tap your Apple ID under "Developer App" → **Trust**.
   - iOS 16 or newer: **Settings → Privacy & Security → Developer Mode → On**, restart, and confirm.
5. Open **Chord Atlas** from your home screen.

### Option 2: AltStore or SideStore
These install IPAs from the Files app and can refresh them over Wi-Fi. Follow the setup at altstore.io or sidestore.io. Then open `ChordAtlas.ipa` from Files and choose AltStore/SideStore.

### The 7-day limit (iPhone only)
With a **free** Apple ID, Apple stops sideloaded apps opening after **7 days**. Your saved data stays: re-install the same IPA with Sideloadly, or let AltStore/SideStore refresh it automatically. With a paid Apple Developer account ($99/year) the signature lasts a year.

---

## Updating the apps later
Change files in the repository, or ask Claude to. Each push builds a new release, **Chord Atlas 1.0 (build N+1)**, with both apps. The "latest" links above always point to it. Install them the same way; favourites and saved progressions are kept.

## Building on your own computer (optional)
**iPhone (Mac only):**
```bash
brew install xcodegen
```
```bash
xcodegen generate && open ChordAtlas.xcodeproj
```
Select your iPhone as the target, set your team under Signing & Capabilities, and press Run.

**Android:** open the `android` folder in Android Studio and press Run. The web files in `App/web` are copied into the app automatically.
