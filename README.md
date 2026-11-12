# Chord Atlas — iPhone & Android app

A guitar chord companion that works fully offline: pick any chord and see what goes well with it, get progressions from any set of chords (even random ones) with playable options and their feeling explained, and browse famous progressions, keys and theory.

**Download:** the latest `ChordAtlas.apk` (Android) and `ChordAtlas.ipa` (iPhone) are under [Releases](https://github.com/lapinsauvage/chord-atlas/releases). Installation steps: [GITHUB-SETUP.md](GITHUB-SETUP.md).

## What's inside the app

| Tab / page | What it does |
|---|---|
| **Home** | Search any chord by name, shortcuts to every section, recent chords, "Surprise me". |
| **Chords** | Pick a root and one of 35 chord types (or type a name). Preview, play, open, or add to Create. |
| Chord page | Notes and formula, guitar shapes (tap to hear), and five tabs: **Next** (ranked chords that go well after it, with reasons and ▶ to hear the change), **Keys** (every key/mode/scale it lives in), **Moves** (substitutions, borrowed chords, passing chords, mediants, neo-Riemannian, cycles), **Lead-ins** (ways to arrive at it), **Progressions** (famous ones containing it). Filter by tier and chord size. |
| **Create** | Add up to 8 chords or roll random ones (simple / with 7ths / anything, optionally in one key). **Create progression** gives several options: orderings that use only your chords, and versions with connecting chords (marked +). Each option has a flow rating, Roman numerals, mood tags, an explanation of the feeling, suitable styles, a suggested tempo, a step-by-step "why it works", and can be played, looped, saved or edited. |
| **Progressions** | 34 classic progressions in any key and chord size, with mood, description and example songs. |
| Keys & scales | 12 scales/modes in every key: notes, scale playback, chords with functions, and progressions to try. |
| Chord types | All 35 qualities with formula, notes and sound description, on any root. |
| Learn | How to use the app, tiers, 18 theory concepts with playable examples, reading diagrams, scale moods, data sources and known limits. |
| **Saved** | Saved progressions, favourite chords, recently viewed. |
| Settings | Instrument (guitar / piano / pad), strum / arpeggio / block, tempo, beats per chord, volume, suggestion size and tiers, light/dark, left-handed diagrams, haptics, reset. |

## Project layout

```text
App/web/            the app itself (HTML/CSS/JS, runs offline inside both native shells)
  chord-engine.js   music-theory engine (fixed version of the uploaded engine)
  generator.js      progression creator + mood analysis
  content.js        all explanatory text
  audio.js          synthesiser and sequencer
  app.js            screens and navigation
App/Sources/        iOS shell in Swift (WKWebView + native storage, haptics, audio session)
App/Assets.xcassets iOS app icon and launch colour
project.yml         XcodeGen spec (the GitHub workflow generates the Xcode project from it)
android/            Android shell in Kotlin (WebView + storage, haptics, back button, edge-to-edge),
                    Gradle build; App/web is copied into the APK at build time
.github/workflows/  build.yml: builds ChordAtlas.ipa (macOS) and ChordAtlas.apk (Linux), publishes a release
docs/               CHORD-RULES.md (rules + list of engine fixes) and the regenerated chords.json
```

You can also open `App/web/index.html` in a desktop browser to try the app.

The same web files run on both platforms; only the thin native shells differ. The JavaScript bridge (`native()` in `app.js`) talks to `window.webkit.messageHandlers.native` on iOS and `window.AndroidBridge` on Android.
