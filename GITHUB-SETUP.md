# From this folder to the app on your iPhone

Building an iPhone app needs Apple's Mac tools. GitHub lends you a Mac in the cloud for free ("GitHub Actions"). The workflow in `.github/workflows/build-ipa.yml` builds **ChordAtlas.ipa** there automatically. Then you install it on your phone with a free tool.

You need: a free GitHub account, a free Apple ID, a computer (Windows or Mac), and a USB cable for the first install.

---

## Part 1 — Put the project on GitHub (once, ~5 minutes)

1. Go to **github.com** and sign up or log in.
2. Top right **+** → **New repository**.
   - Name: `chord-atlas`
   - Choose **Public** (unlimited free Mac build minutes) or **Private** (free, but limited to roughly 25 builds a month).
   - Leave "Add a README" **unticked**. Click **Create repository**.
3. Upload the files. Pick **one** way:

   **A. Let Claude push it (easiest).** Tell Claude the repository name (for example `yourname/chord-atlas`). Claude connects to it and uploads everything.

   **B. Upload in the browser.**
   1. Unzip `ChordAtlas.zip` on your computer.
   2. On the empty repository page click **uploading an existing file**.
   3. Open the unzipped `ChordAtlas` folder and drag **everything inside it** (`App`, `docs`, `project.yml`, the `.md` files) onto the page. Click **Commit changes**.
   4. The hidden folder `.github` is usually skipped by drag-and-drop, so create the workflow by hand: **Add file → Create new file**, type the name `.github/workflows/build-ipa.yml` (the slashes create the folders), paste the full contents of that file from the zip (open it in any text editor), and click **Commit changes**.
      - Can't see `.github`? On a Mac press **Cmd + Shift + .** in Finder. On Windows: File Explorer → View → Show → Hidden items.

## Part 2 — Let GitHub build the IPA (~5–8 minutes, automatic)

1. In your repository click the **Actions** tab. If GitHub asks, click **I understand my workflows, go ahead and enable them**.
2. A run called **Build iOS app (IPA)** starts by itself after each upload or change. To start one manually: click the workflow name on the left → **Run workflow** → **Run workflow**.
3. Wait for the green ✓. (A red ✗ means the build failed: open the run, download the **xcodebuild-log** artifact at the bottom, and send it to Claude.)
4. Download the app: on the repository's main page, look right for **Releases** → **Chord Atlas build N** → click **ChordAtlas.ipa**.
   (It is also under the run's **Artifacts** as a zip containing the same file.)

## Part 3 — Install on your iPhone

iPhones only install apps that are signed. The IPA from GitHub is unsigned on purpose; a sideloading tool signs it with your own Apple ID.

### Option 1: Sideloadly (Windows or Mac) — recommended
1. Install **Sideloadly** from **sideloadly.io**. On Windows also install **iTunes** and **iCloud** from apple.com (the non-Microsoft-Store versions, as Sideloadly's site explains).
2. Connect your iPhone with a cable, unlock it and tap **Trust** if asked.
3. Open Sideloadly, drag **ChordAtlas.ipa** into it, enter your Apple ID e-mail, click **Start**, and enter your Apple ID password (and 2-factor code) when asked (Sideloadly states it sends these only to Apple; if you prefer, use a separate Apple ID made just for sideloading).
4. On the iPhone:
   - **Settings → General → VPN & Device Management** → tap your Apple ID under "Developer App" → **Trust**.
   - iOS 16 or newer: **Settings → Privacy & Security → Developer Mode → On**, restart, and confirm.
5. Open **Chord Atlas** from your home screen.

### Option 2: AltStore or SideStore
These install IPAs from the Files app and can refresh them over Wi-Fi. Follow the setup at altstore.io or sidestore.io, then open `ChordAtlas.ipa` from Files and choose AltStore/SideStore.

### The 7-day limit
With a **free** Apple ID, Apple makes sideloaded apps stop opening after **7 days**. Your saved data stays; just re-install the same IPA with Sideloadly (or let AltStore/SideStore refresh it automatically). With a paid Apple Developer account ($99/year) the signature lasts a year.

---

## Updating the app later
Change files in the repository (or ask Claude to). Each push builds a new release, **Chord Atlas build N+1**. Install it the same way; your favourites and saved progressions are kept.

## Building on a Mac instead (optional)
```bash
brew install xcodegen
```
```bash
xcodegen generate && open ChordAtlas.xcodeproj
```
Select your iPhone as the target, set your team under Signing & Capabilities, and press Run.
