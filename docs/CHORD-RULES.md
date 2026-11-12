# Guitar Chord Atlas — rules, data and engine

Reference for working with these files in Claude Code. Three files belong together:

| File | What it is |
|---|---|
| `chord-engine.js` | The rules engine (no dependencies). Source of truth. Runs in Node and in the browser. |
| `chords.json` | Everything the engine says about all 420 chords (12 roots × 35 qualities), precomputed. One chord per line, so it greps well. |
| `CHORD-RULES.md` | This file: how the suggestions are made, the data format, sources and known limits. |

The published Guitar Chord Atlas page inlines the same `chord-engine.js`.

## Quick use

```bash
node chord-engine.js Cmaj7                # readable report
node chord-engine.js "F#m7b5" --json      # full analysis as JSON
node chord-engine.js Am --level 1         # force suggestions as 7th chords (0 triads, 1 sevenths, 2 extended)
node chord-engine.js --all > chords.json  # regenerate the dataset (compact; see "Data format")
grep '^"Ebmaj9"' chords.json              # one chord from the dataset
```

```js
const E = require('./chord-engine.js');
const a = E.analyzeSymbol('G7', { level: 'auto' });   // or E.analyze(pc, qualityId, {level, name})
a.ranked        // merged list of next chords: {to, pc, q, tier, reasons[]}
a.keys.contexts // every key/mode/scale it lives in: {key, role, variant, as, next[]}
a.moves         // chromatic, key-free moves grouped by category
a.approach      // chords that lead INTO it
a.progressions  // famous progressions it fits, written out in the matching key
a.voicings      // guitar shapes: {tab: "x32010", frets:[null,3,2,0,1,0], midi:[…], label}
E.parseChord('Bbmaj9')  // {pc: 10, q: 'maj9', name: 'Bb'}
```

Pitch classes: C=0 … B=11. Frets are listed low E → high E; `null`/`x` = muted.

## Chord qualities (35)

Triads `maj m dim aug sus2 sus4 5 (b5)` · sixths/adds `6 m6 add9 m(add9) 6/9` · sevenths `maj7 7 m7 m(maj7) m7b5 dim7 7sus4 7#5 maj7#5 7b5` · extended `maj9 9 m9 11 m11 13 maj13 maj7#11` · altered `7b9 7#9 7#11 7alt`.

Families drive the chromatic rules: major, minor, dominant, dim, hdim (m7b5), dim7, aug, sus, power, other.

## Tiers

| Tier | Name | Meaning |
|---|---|---|
| 1 | core | Moves heard in most songs: diatonic motion that dominates song databases, V→I, ii→V, the main borrowed chords. |
| 2 | common | Standard but flavoured: secondary dominants of V, backdoor, line clichés, minor-key alternatives, modal staples. |
| 3 | colour | Deliberate surprise: chromatic mediants, Neapolitan, tritone-sub chains, planing. |
| 4 | exotic | Jazz, film-score and symmetric moves: Coltrane, hexatonic/octatonic cycles, S and H transformations, tritone jumps, exotic scales. |

Tiers are an editorial ranking informed by Hooktheory's song statistics and by textbook functional harmony, not a measured probability for every move. In the merged ranking, a key-based suggestion's tier is adjusted by how common the context is: plain major-key use counts as-is; non-tonic minor-key roles, harmonic/melodic-only fits, modes and exotic scales each push it down a tier.

## How suggestions are generated

### 1. Keys, modes and scales the chord lives in

A chord "lives in" a scale when (a) all its notes are in the scale **and** (b) its triad and seventh match what you get by stacking thirds on that scale degree. Rule (b) rejects enharmonic false positives (Am is *not* a chord of C♯ harmonic minor even though A, C=B♯ and E are all in it).

Scales checked, for all 12 tonics: major; minor (natural first, then harmonic, then melodic); Dorian, Mixolydian, Lydian, Phrygian (only where the chord plays a characteristic role); Phrygian dominant, double harmonic major ("Gypsy major"), Hungarian minor ("Gypsy minor").

Symmetric chords are also tried from their other spellings (dim7 every minor 3rd, augmented every major 3rd), shown as "spelled as …".

Extended/altered chords whose colour tones fall outside every 7-note scale (e.g. 7#9, 7alt) are placed through their core chord (7 → triad).

Next chords inside a key come from per-degree rules. Major key (from functional harmony and Hooktheory's data):

| From | Usual next (tier 1) | Also |
|---|---|---|
| I | IV, V, vi | ii (2), iii (3) |
| ii | V | IV (2), I, vii°, vi (3) |
| iii | vi, IV | ii, I (3) |
| IV | I, V | ii, vi (2), iii (3) |
| V | I, vi, IV | iii (2, Royal Road), ii (3) |
| vi | IV, ii | V, I (2), iii (3) |
| vii° | I | iii, vi (3) |

Minor key (natural minor; V and vii°7 taken from harmonic minor): i → iv, ♭VI, ♭VII, V · iiø → V · ♭III → ♭VII · iv → V, i · v → i · V → i, ♭VI · ♭VI → ♭VII, V, ♭III · ♭VII → i, ♭III, ♭VI · vii°7 → i. Modal rules: Dorian i↔IV, Mixolydian I↔♭VII and ♭VII–IV–I, Lydian I↔II and II–IV–I, Phrygian i↔♭II, Phrygian dominant I↔♭II and iv–♭II–I.

Target chords are built by stacking thirds on the target degree at the chosen size (triads / sevenths / extended), so a V at "extended" in harmonic minor becomes 7b9, and iii in major stays m7 (its 9th would be ♭9).

### 2. Key-free (chromatic) moves, by chord family

- **Major**: I→I7→IV; secondary dominants VI7→ii, III7→vi, II7→V, VII7→iii; tritone subs ♭III7→ii, ♭VI7→V; borrowed iv, ♭VI, ♭VII, ♭III, i, iiø7, v, II (Lydian), ♭II (Neapolitan); backdoor iv7–♭VII7–I; passing #i°7→ii, #ii°7→I, IV–#iv°7–I; line clichés I–I+–I6–I7 and I–Imaj7–I7–IV; augmented passing I+→IV / vi; chromatic mediants (±M3, ±m3 same quality; doubly-chromatic minor); neo-Riemannian P, R, L, S, N, H; Coltrane cycle; planing; hexatonic (PL) and octatonic (PR) cycles; tritone jump.
- **Minor**: as ii (ii–V7–I and tritone ii–♭II7–I), as iii (iii–VI7–ii), i→I7→iv, as vi (vi–II7–V), as iv (backdoor), Dorian IV, parallel major, Phrygian ♭II, Neapolitan, German-sixth sound; line clichés (i–i(maj7)–i7–i6, lament into ♭VImaj7, rising "Bond" cliché); passing dims (iii–♭iii°7–ii, ii–#ii°7–iii); minor chromatic mediants, doubly-chromatic majors, tritone jump; neo-Riemannian inverses.
- **Dominant**: V7→I / i, deceptive →vi / ♭VI, →IV, subV7 (resolve down a semitone), ♭VII7 backdoor (up a tone), dominant chains (circle of fifths and chromatic), blues I7–IV7, IV7–#iv°7–I7, V7–IV7–I7, diminished-scale substitution (a minor 3rd), tritone swap, whole-tone planing for 7#5/7b5/9/7#11, sus resolution.
- **m7b5**: iiø7–V7(b9)–i, viiø7→I, #ivø7–VII7–iii, lament #ivø7→IVmaj7, borrowed iiø7→I, m6-inversion reading.
- **dim / dim7**: leading-tone resolution up a semitone from any of the four notes (major and minor targets), common-tone #ii°7→I and #iv°7→I/5, descending passing, minor-3rd shift.
- **aug**: V+→I (and its two respellings), one-semitone voice-leading to C, E, A♭ majors and Am, C♯m, Fm minors (for C+), I+→I6, whole-tone planing.
- **sus / power**: resolutions to major/minor, sus2↔sus4, Vsus4→I, quartal planing; rock/metal power-chord moves (♭VII, IV, ♭III–IV, ♭VI–♭VII, V, ♭II, ♭V).

### 3. Lead-ins (approach)

V7, ii–V (iiø–V7b9 for minor), subV7, vii°7, IV / iv plagal, V7sus4–V7, minor plagal, backdoor, ♭VI–♭VII ("Mario"), ♭VII, common-tone dim, Lydian II, Phrygian ♭II, Coltrane; for minor targets also Aeolian ♭VI–♭VII, Andalusian ♭VII–♭VI–V, Phrygian ♭II, Neapolitan, augmented-sixth sound, Dorian IV.

### 4. Progression library

Axis I–V–vi–IV, 50s I–vi–IV–V, vi–IV–I–V, ii–V–I, I–vi–ii–V, I–IV–V–I, Royal Road IVmaj7–V7–iii7–vi, Pachelbel I–V–vi–iii–IV–I–IV–V, iii–vi–ii–V–I, full diatonic circle, I–#i°7–ii–V, I–♭VII–IV–I, ♭VI–♭VII–I, IV–iv–I, I–III–IV–iv, backdoor, tritone ii–V, 12-bar blues moves, Lydian I–II, Coltrane, hexatonic and octatonic cycles, major-3rd cycle; minor axis i–♭VI–♭III–♭VII, Andalusian, i–iv–V–i, iiø–V–i, Aeolian shuttle, minor line cliché, i–♭III–♭VII; Dorian i–IV, Phrygian i–♭II–i, flamenco iv–♭II–I, Mixolydian ♭VII–IV–I.

## Spelling

Roots inside keys and moves are spelled by scale-degree letter (A major's III is C♯, E minor's ♭VI is C, G♯ minor's V is D♯). Double accidentals and B♯/E♯/C♭/F♭ fall back to the common name. Standalone default names: majors and dominants use D♭, E♭, F♯, A♭, B♭; minors use C♯, E♭, F♯, G♯, B♭; diminished chords use sharps.

## Guitar voicings

Each chord gets up to four shapes: a standard open chord when one exists, a movable shape with the root on the 6th string (E-shape family) and on the 5th (A-shape family), and, where no hand-written template exists, a searched voicing (4-fret span, ≤ 4 fingers counting a barre, root in the bass, all essential tones present). Every voicing is machine-checked: only chord tones, root in the bass, and the 3rd, 7th and defining tension present (the 5th may be omitted).

## Data format of chords.json

```text
{"meta": {...},
"chords": {
"Cmaj7": {"quality":"maj7","root":"C","notes":[...],"formula":"1 3 5 7","guitar":["x32000",...],
          "keys":[{"key":"G major","role":"IVmaj7","next":[["Gmaj7","Imaj7",1],...]}, ...],
          "next":[["Fmaj7",1,["Imaj7→IVmaj7 in C major", ...]], ...],        // merged ranking: [chord, tier, reasons]
          "moves":[["dominant",1,"I → I7 → IV",["C7","Fmaj7"]], ...],        // [category, tier, label, chain]
          "approach":[[1,"V7 → it (perfect cadence)",["G7","Cmaj7"]], ...],
          "progressions":[["ii–V–I","C major",["Dm7","G7","Cmaj7"]], ...]},
...
}}
```

The dataset is generated at each chord's own size ("auto" level). For another size, call the engine with `--level`.

## Verification done

- All 420 chords analysed at all three sizes without errors; every voicing re-checked note by note.
- Diatonic chord tables match guitarscale.org's "related chords" for C major, natural minor, harmonic minor, melodic minor, Dorian, Lydian, Mixolydian and Phrygian, and its double harmonic and Hungarian minor triads.
- Open and barre fingerings listed on guitarscale.org decode to the chords they name.
- Theory spot checks: P/L/R/S/N/H from C give Cm, Em, Am, C♯m, Fm, A♭m (Open Music Theory); chromatic mediants of C are E, A, E♭, A♭ plus E♭m, A♭m (Wikipedia); C+ resolves by one semitone to C, E, A♭, Am, C♯m, Fm (Open Music Theory); Coltrane from C is C–E♭7–A♭–B7–E–G7–C (Wikipedia); Royal Road in C is Fmaj7–G7–Em7–Am; Pachelbel in C is C–G–Am–Em–F–C–F–G.

Four entries on guitarscale.org's exotic-scale pages contain notes outside their own scale, so the engine deliberately differs there:

| Page | Listed | Decoded notes | Problem | Engine uses |
|---|---|---|---|---|
| C Gypsy minor | Cm7 `x35343` | C G B♭ E♭ G | B♭ is not in the scale (it has B) | Cm(maj7) |
| C Gypsy minor | D7-5 `x56567` | D A♭ C F B | F is not in the scale (it has F♯) | D7♭5 = D F♯ A♭ C |
| C Gypsy minor | F♯sus2 `xx4122` | F♯ G♯ C♯ | C♯ is not in the scale | no standard name (F♯ G♯ C) |
| C Gypsy major | A♭aug7 `4x455x` | A♭ G♭ C E | G♭ is not in the scale (it has G) | A♭maj7♯5 |

## Known limits

- No slash chords or inversions as separate entries (inversions appear only inside some voicings and line clichés).
- "Exotic scale" next chords are in-scale moves with no established statistics behind them; treat them as colour.
- Tier labels are judgement calls; Hooktheory figures quoted in the reasons are dataset snapshots and differ between their publications.

## Sources

- Hooktheory: [1,300-song analysis](https://www.hooktheory.com/blog/i-analyzed-the-chords-of-1300-popular-songs-for-patterns-this-is-what-i-found/), [part 2](https://www.hooktheory.com/blog/music-theory-analysis-1300-songs-for-songwriting-part2/), [Trends API docs](https://hooktheory.com/api/trends/docs), [inversions study](https://www.hooktheory.com/blog/statistical-study-inversions-slash-chords-popular-music/)
- Functional harmony: [Iowa State Comprehensive Musicianship 6.1](https://iastate.pressbooks.pub/comprehensivemusicianship/chapter/6-1-diatonic-harmony-tutorial/), [LibreTexts overview](https://human.libretexts.org/Courses/Sierra_College/Equipping_the_Musical_Ear/16%3A_Functional_Harmony_and_Syncopation/16.05%3A_Overview_of_Functional_Harmony)
- Modal interchange: [fachords](https://fachords.com/modal-interchanges), [Integrated Music Theory 16a](https://intmus.github.io/inttheory/16-mode-mixture/a1-ex-intromodemix.html)
- Neo-Riemannian & mediants: [Open Music Theory (Nebraska)](https://pressbooks.nebraska.edu/openmusictheory/chapter/neo-riemannian-triadic-progressions), [Open Music Theory: mediants](https://viva.pressbooks.pub/openmusictheory/chapter/mediants/), [Wikipedia: chromatic mediant](https://wikipedia.com/wiki/Chromatic_mediant)
- Modal schemas: [Open Music Theory](https://viva.pressbooks.pub/openmusictheory/chapter/modal-schemas/), [fretjam](https://fretjam.com/modal-chord-progressions.html)
- Substitutions: [Wikipedia: tritone substitution](https://en.wikipedia.org/wiki/Tritone_substitution), [backdoor progression](https://en.wikipedia.org/wiki/Backdoor_progression), [Coltrane changes](https://en.wikipedia.org/wiki/Coltrane_changes), [Yamaha: chord substitutions](https://hub.yamaha.com/guitars/g-how-to/a-guitaristss-guide-to-chord-substitutions-part-2-beyond-diatonic/)
- Neapolitan & augmented sixth: [Integrated Music Theory](https://intmus.github.io/inttheory/17-mode-mixture/b2-2t-neapolitan.html), [UMN Music Composition](https://open.lib.umn.edu/musiccomposition/chapter/augmented-sixth-chords/)
- Diminished: [Ethan Hein](https://ethanhein.com/wp/2021/the-three-diminished-chords-blues-jazz-and-classical/), [Active Melody](https://www.activemelody.com/?p=320171)
- Line clichés: [The Jazz Piano Site](https://www.thejazzpianosite.com/jazz-piano-lessons/jazz-chord-progressions/line-cliches/)
- Minor-key progressions: [Jeffrey Pepper Rodgers](https://jeffreypepperrodgers.com/blog/songwriting-lesson-chord-progressions-in-minor-keys), [Soundtrap](https://blog.soundtrap.com/minor-chord-progressions/)
- Named progressions: [Wikipedia: Royal Road](https://en.wikipedia.org/wiki/Royal_road_progression), [Pachelbel canon](https://www.supersimplepiano.com/learn/chord-progressions/pachelbel-canon)
- Scales & fingerings cross-check: [guitarscale.org](https://www.guitarscale.org/) (C major, minor, harmonic minor, melodic minor, Dorian, Lydian, Mixolydian, Phrygian, Gypsy major/minor pages)

## Changes in the Chord Atlas app version (engine fixes)

The app ships `App/web/chord-engine.js`; `docs/chords.json` was regenerated from it. Fixes compared with the original upload:

| # | Problem | Fix |
|---|---|---|
| 1 | `parseChord` returned nothing for `C7+5`, `Cmaj7+5` and `CMaj7` (the `+` was turned into `aug` before the `7+5` aliases were checked; `Maj` was not recognised). | `maj7+5`, `7+5` and `Maj` are normalised first. |
| 2 | Lead-ins for diminished chords: "chord a whole step below → it" actually used a chord a half step below and duplicated "I → it"; roots were spelled awkwardly (`A# → Bdim`). | Replaced by "Half step below → it (rising passing)" (`Bb → Bdim`), "Half step above → it (falling passing)" (`Cm → Bdim`), plus "IV → vii°" for dim triads and "i → iiø7" for half-diminished chords. |
| 3 | The Coltrane lead-in label was hard-coded to C (`Eb7 – Ab – B7 – E – G7 → it`) for every target chord. | Label now uses Roman numerals: `bIII7 – bVI – VII7 – III – V7 → it`. |
| 4 | Dominant chords listed the tritone-sub lead-in twice ("subV7 → it" and "subV of it → it"). | Duplicate removed. |
| 5 | Common-tone diminished targets were spelled with sharps where flats are normal (`C#dim7 → A#maj7`). | Degree hints added: `C#dim7 → Bbmaj7`, `#iv°7 → I/5` spelled from the 5th letter. |
| 6 | "I → iiø7" produced a plain diminished triad at triad size, contradicting its label. | Always a m7b5. |

After the fixes all 420 chords × 4 size settings were re-analysed: no crashes, every chord name round-trips through the parser to the same notes, every in-key suggestion stays inside its scale, every voicing passes the note check.

The engine now also exports `PROGS`, `SYS_LABEL`, `slotQuality`, `relName`, `tonicNameFor`, `pcOfName`, `ch`, `fitsScale` and `intervalLabel` for the app.

### Progression generator (`App/web/generator.js`)

Used by the Create page. For any 2–8 chords it:
1. Finds the best-fitting major or minor key (chords whose triad/seventh lie in natural or harmonic minor / major count as fitting).
2. Scores every move A → B from the engine's ranked next-chords (core 10, common 7, colour 4.5, exotic 2.5 points; same root with a compatible quality −1.5), plus small bonuses for shared notes and roots falling a 5th, with textbook floors (V7 → I/i, diminished → up a semitone).
3. Tries every ordering and keeps: your order, smoothest loop, strong ending (cadence), smoothest voice leading, tension & release, there and back again.
4. Adds versions with connecting chords (marked +): a single connector only where a jump scores poorly (secondary dominant, passing dim7, tritone sub, plagal, sus dominant or a pivot chord), jazz ii–V set-ups, and a cadence that resolves home.
5. Describes the feeling from the harmony: key mode, major/minor balance, borrowed iv / bVI / bVII / bII, chromatic mediants, tritone jumps, dim/aug/sus/power chords, 7th colours, bass direction, cadence vs loop, and how common the moves are. It suggests a tempo and fitting styles.
