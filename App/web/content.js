/* content.js — all explanatory text shown in the app */
window.CONTENT = (function () {
  // Mood + description for each progression in the engine's library (keyed by name)
  var PROG_MOODS = {
    'Axis / "4-chord" pop': { tags: ['uplifting', 'anthemic', 'familiar'], text: 'The sound of modern pop. Starts home, rises to V, dips into the relative minor for a touch of emotion, then lifts through IV. Loops forever without getting tired.', songs: 'Let It Be, With or Without You, Don\'t Stop Believin\'' },
    '50s / doo-wop': { tags: ['nostalgic', 'sweet', 'innocent'], text: 'Gentle and romantic: the vi gives a soft sigh before IV–V push back home. Instantly evokes 1950s ballads.', songs: 'Stand By Me, Every Breath You Take' },
    'Axis, minor start': { tags: ['emotional', 'yearning', 'modern'], text: 'Same four chords as the Axis, but starting on the minor vi makes it feel more serious and heartfelt.', songs: 'Zombie, Someone Like You (chorus feel)' },
    'ii–V–I': { tags: ['smooth', 'resolved', 'jazzy'], text: 'The backbone of jazz. Each chord falls a 5th into the next, so it glides inevitably to the home chord.', songs: 'Autumn Leaves, Fly Me to the Moon' },
    'Turnaround (rhythm changes)': { tags: ['swinging', 'cyclic', 'classic'], text: 'A circular jazz loop that keeps the music moving back to the top of the form.', songs: 'I Got Rhythm, Blue Moon' },
    'I–IV–V–I': { tags: ['simple', 'strong', 'folk'], text: 'Three-chord honesty: the two pillars of the key and a clean return home. Rock\'n\'roll, folk and country all live here.', songs: 'La Bamba, Twist and Shout' },
    'Royal Road (J-pop)': { tags: ['bittersweet', 'dramatic', 'emotional'], text: 'Lush and longing: starts on IV, climbs to V, then falls into the minor chords iii–vi. The signature of J-pop and anime openings.', songs: 'Many anime/J-pop hits' },
    'Pachelbel\'s Canon': { tags: ['graceful', 'majestic', 'nostalgic'], text: 'A stately descending bass under eight chords. Feels timeless and ceremonial; endlessly reused in pop.', songs: 'Canon in D, Basket Case, Graduation' },
    'Circle of fifths': { tags: ['flowing', 'inevitable', 'classic'], text: 'Every root falls a 5th, so each chord pulls into the next like dominoes until you land home.', songs: 'Fly Me to the Moon, I Will Survive' },
    'Full diatonic circle': { tags: ['grand', 'flowing', 'baroque'], text: 'Visits every chord of the key by falling 5ths: a complete harmonic journey.', songs: 'Autumn Leaves (chord cycle)' },
    'Passing-diminished turnaround': { tags: ['vintage', 'elegant', 'chromatic'], text: 'A diminished chord slips between I and ii so the bass climbs by semitones: old-time, Broadway charm.', songs: 'Classic standards & gospel' },
    'Rock / Mixolydian': { tags: ['confident', 'rocky', 'open'], text: 'The flat-seven chord replaces the expected V, giving a laid-back, classic-rock swagger.', songs: 'Sweet Child O\' Mine, Hey Jude (coda)' },
    '"Mario" / Aeolian cadence': { tags: ['heroic', 'triumphant', 'epic'], text: 'Two borrowed major chords climb in whole steps to the tonic: the victory fanfare sound of games and films.', songs: 'Video-game victory themes' },
    'Minor plagal': { tags: ['tender', 'nostalgic', 'bittersweet'], text: 'IV turns minor for a moment before returning home: a tear in the eye, then a smile.', songs: 'Creep (bridge), In My Life' },
    '"Creep" progression': { tags: ['dreamy', 'melancholic', 'grungy'], text: 'A major III and a minor iv borrowed into a major key: hopeful and heartbroken at once.', songs: 'Creep, Get Free' },
    'Backdoor': { tags: ['soulful', 'warm', 'surprising'], text: 'Arrives home from a whole step below instead of from V — a soft, gospel-tinged resolution.', songs: 'Lady Madonna (feel), many standards' },
    'Tritone ii–V': { tags: ['slinky', 'chromatic', 'jazzy'], text: 'The dominant is replaced by the chord a tritone away, so the bass slides down by semitones into home.', songs: 'Girl from Ipanema (feel)' },
    '12-bar blues (core moves)': { tags: ['gritty', 'groovy', 'bluesy'], text: 'All dominant 7ths: tension everywhere, which is exactly the blues sound.', songs: 'Johnny B. Goode, Hound Dog' },
    'Lydian shuttle': { tags: ['dreamy', 'floating', 'magical'], text: 'Alternating I and a major II creates a weightless, wondrous feel — film and space themes love it.', songs: 'The Simpsons theme feel, E.T.-style cues' },
    'Coltrane changes': { tags: ['virtuosic', 'kaleidoscopic', 'advanced'], text: 'Key centres a major third apart, each approached by its own dominant. Dazzling and challenging.', songs: 'Giant Steps, Countdown' },
    'Hexatonic (PL) cycle': { tags: ['mysterious', 'cinematic', 'otherworldly'], text: 'One note moves at a time, yet the chords drift far from home. Sounds like magic or the uncanny.', songs: 'Film scores (fantasy/sci-fi)' },
    'Octatonic (PR) cycle': { tags: ['eerie', 'cinematic', 'restless'], text: 'Major and minor chords alternate around the circle in minor thirds: unstable and dramatic.', songs: 'Film scores, Stravinsky' },
    'Major-3rd (augmented) cycle': { tags: ['bold', 'heroic', 'shifting'], text: 'Major chords a major third apart: each change is a bright cinematic jump.', songs: 'Film trailers, Giant Steps axis' },
    'Minor axis': { tags: ['emotional', 'anthemic', 'dark'], text: 'The minor-start version of the pop loop with all-major colours after the tonic: powerful and brooding.', songs: 'Numb, Grenade' },
    'Andalusian cadence': { tags: ['dramatic', 'Spanish', 'fateful'], text: 'A descending bass from i to V, ending on a major V that wants to restart. Flamenco, surf rock and noir.', songs: 'Hit the Road Jack, Walk Don\'t Run' },
    'Minor cadence': { tags: ['serious', 'resolved', 'classical'], text: 'The essential minor-key statement: home, predominant, dominant, home.', songs: 'Classical minor themes' },
    'Minor ii–V–i': { tags: ['noir', 'smoky', 'jazzy'], text: 'The minor-key jazz cadence: shadowy and sophisticated.', songs: 'Autumn Leaves (minor part), Blue Bossa' },
    'Aeolian shuttle': { tags: ['brooding', 'epic', 'rocky'], text: 'Rocks back and forth between minor home and its major neighbours — hypnotic and heavy.', songs: 'All Along the Watchtower, Stairway (outro)' },
    'Minor line cliché': { tags: ['suspenseful', 'cinematic', 'melancholic'], text: 'The chord stays, but one inner voice descends by semitones: classic spy-movie and ballad drama.', songs: 'My Funny Valentine, Stairway to Heaven (intro)' },
    'i–bIII–bVII': { tags: ['folk', 'driving', 'dark'], text: 'Minor tonic with two major chords: earthy and urgent.', songs: 'Jolene' },
    'Dorian shuttle': { tags: ['funky', 'cool', 'soulful'], text: 'Minor i with a bright major IV: minor but not sad. Funk, soul and Santana.', songs: 'Oye Como Va, Moondance' },
    'Phrygian vamp': { tags: ['dark', 'menacing', 'exotic'], text: 'A major chord a semitone above the minor tonic: metal, flamenco and suspense.', songs: 'Metal riffs, White Rabbit (feel)' },
    'Flamenco cadence': { tags: ['passionate', 'Spanish', 'fiery'], text: 'iv – bII – I over a major tonic: the bold, stamping end of a flamenco phrase.', songs: 'Malagueña, flamenco' },
    'Mixolydian double plagal': { tags: ['triumphant', 'rocky', 'anthemic'], text: 'bVII to IV to I: two plagal steps make a huge, stadium-sized arrival.', songs: 'Hey Jude (coda), Gloria' }
  };

  // Sound description for every chord quality
  var QUALITY_INFO = {
    maj: 'Stable, bright, happy — the default "home" sound.',
    m: 'Darker and more introspective; sad or serious.',
    dim: 'Tense and unstable; wants to resolve up a semitone.',
    aug: 'Dreamy and suspenseful, like a question mark.',
    sus2: 'Open and airy, neither happy nor sad.',
    sus4: 'Suspended tension that wants to fall to the major chord.',
    '5': 'Root and fifth only: neutral, powerful, built for distortion.',
    b5: 'Major with a lowered 5th: strange, whole-tone flavour.',
    add9: 'Major with sparkle — shimmering, modern pop/folk.',
    madd9: 'Minor with a haunting extra colour.',
    '6': 'Sweet, vintage major sound (swing, old pop).',
    m6: 'Minor with a bittersweet, mysterious twist (spy films, bossa).',
    '69': 'Rich, resolved and jazzy — a lush final chord.',
    maj7: 'Soft, dreamy and romantic; the sound of neo-soul and bossa.',
    '7': 'Bluesy tension that wants to move — the dominant sound.',
    m7: 'Mellow, smooth minor: R&B, funk and jazz.',
    mMaj7: 'Dark and mysterious, very cinematic (Bond themes).',
    m7b5: 'Half-diminished: melancholic tension, the minor-key ii chord.',
    dim7: 'Maximum symmetrical tension; horror, silent movies, passing chords.',
    '7sus4': 'Open dominant tension without the 3rd; gospel and fusion.',
    aug7: 'Dominant with a raised 5th: pushy, whole-tone tension.',
    'maj7#5': 'Floating, ethereal, unresolved.',
    '7b5': 'Dominant with a lowered 5th: angular jazz tension.',
    maj9: 'Lush, warm and sophisticated major.',
    '9': 'Funky, fat dominant (funk, blues, soul).',
    m9: 'Silky minor — neo-soul and lo-fi favourite.',
    '11': '9sus4: open, modern dominant (gospel, fusion).',
    m11: 'Spacious modal minor, very open voicing.',
    '13': 'Full, jazzy, big-band dominant.',
    maj13: 'Very lush, sparkling major.',
    'maj7#11': 'The Lydian sound: bright, floating, magical.',
    '7b9': 'Dark dominant that pulls strongly to a minor chord.',
    '7#9': 'The "Hendrix chord": gritty, rock-blues swagger.',
    '7#11': 'Lydian dominant: bright, bluesy, modern.',
    '7alt': 'Maximum dominant tension, every colour altered — jazz.'
  };

  var QUALITY_GROUPS = [
    { title: 'Triads', ids: ['maj', 'm', 'dim', 'aug', 'sus2', 'sus4', '5', 'b5'] },
    { title: 'Sixths & adds', ids: ['add9', 'madd9', '6', 'm6', '69'] },
    { title: 'Sevenths', ids: ['maj7', '7', 'm7', 'mMaj7', 'm7b5', 'dim7', '7sus4', 'aug7', 'maj7#5', '7b5'] },
    { title: 'Extended', ids: ['maj9', '9', 'm9', '11', 'm11', '13', 'maj13', 'maj7#11'] },
    { title: 'Altered', ids: ['7b9', '7#9', '7#11', '7alt'] }
  ];

  var SCALES = [
    { id: 'major', name: 'Major (Ionian)', tq: 'maj', sys: 'major', mood: 'Bright, happy and stable — the default for pop, folk and most songs.', scale: [0, 2, 4, 5, 7, 9, 11] },
    { id: 'natural', name: 'Natural minor (Aeolian)', tq: 'm', sys: 'minor', mood: 'Sad, serious or epic; rock and ballads.', scale: [0, 2, 3, 5, 7, 8, 10] },
    { id: 'harmonic', name: 'Harmonic minor', tq: 'm', sys: 'minor', mood: 'Minor with a raised 7th: dramatic, classical, Middle-Eastern tinge; gives a strong major V.', scale: [0, 2, 3, 5, 7, 8, 11] },
    { id: 'melodic', name: 'Melodic minor', tq: 'm', sys: 'minor', mood: 'Minor with raised 6th and 7th: smooth, jazzy, sophisticated.', scale: [0, 2, 3, 5, 7, 9, 11] },
    { id: 'dorian', name: 'Dorian', tq: 'm', sys: 'dorian', mood: 'Minor but hopeful, thanks to the major IV: funk, soul, Celtic, Santana.', scale: [0, 2, 3, 5, 7, 9, 10] },
    { id: 'phrygian', name: 'Phrygian', tq: 'm', sys: 'phrygian', mood: 'Dark and Spanish; the flat 2nd is menacing (metal, flamenco).', scale: [0, 1, 3, 5, 7, 8, 10] },
    { id: 'lydian', name: 'Lydian', tq: 'maj', sys: 'lydian', mood: 'Dreamy, floating and magical: the raised 4th (film scores, Satriani).', scale: [0, 2, 4, 6, 7, 9, 11] },
    { id: 'mixolydian', name: 'Mixolydian', tq: 'maj', sys: 'mixolydian', mood: 'Major but bluesy-rock, with a flat 7th (classic rock, Celtic, jam bands).', scale: [0, 2, 4, 5, 7, 9, 10] },
    { id: 'locrian', name: 'Locrian', tq: 'dim', sys: 'locrian', mood: 'Unstable and dark: its own tonic chord is diminished. Rare, used for colour in metal.', scale: [0, 1, 3, 5, 6, 8, 10] },
    { id: 'phrygdom', name: 'Phrygian dominant', tq: 'maj', sys: 'phrygdom', mood: 'Spanish / flamenco / Middle-Eastern: major tonic with a flat 2nd.', scale: [0, 1, 4, 5, 7, 8, 10] },
    { id: 'dblharm', name: 'Double harmonic major', tq: 'maj', sys: 'dblharm', mood: '"Gypsy major" / Byzantine: exotic, snake-charmer sound with two augmented 2nds.', scale: [0, 1, 4, 5, 7, 8, 11] },
    { id: 'hungmin', name: 'Hungarian minor', tq: 'm', sys: 'hungmin', mood: '"Gypsy minor": dark, dramatic and Eastern-European.', scale: [0, 2, 3, 6, 7, 8, 11] }
  ];

  var TIERS = [
    { n: 1, name: 'Core', text: 'Moves heard in most songs: diatonic motion that dominates song databases, V→I, ii→V, the main borrowed chords. Safe and natural.' },
    { n: 2, name: 'Common', text: 'Standard but flavoured: secondary dominants, backdoor, line clichés, minor-key alternatives, modal staples.' },
    { n: 3, name: 'Colour', text: 'Deliberate surprise: chromatic mediants, Neapolitan, tritone-sub chains, planing.' },
    { n: 4, name: 'Exotic', text: 'Jazz, film-score and symmetric moves: Coltrane, hexatonic/octatonic cycles, neo-Riemannian slides, tritone jumps, exotic scales.' }
  ];

  // Concepts glossary; example = chord symbols to play (in C unless noted)
  var CONCEPTS = [
    { t: 'Keys & Roman numerals', ex: ['C', 'F', 'G', 'C'], x: 'A key is a family of 7 chords built from one scale. Roman numerals name each chord by its position: I, ii, iii, IV, V, vi, vii°. Upper-case = major, lower-case = minor, ° = diminished. Numerals let you play the same progression in any key.' },
    { t: 'Tonic, subdominant, dominant', ex: ['C', 'F', 'G7', 'C'], x: 'Chords have jobs. Tonic (I, vi, iii) feels at home. Subdominant/predominant (IV, ii) moves away. Dominant (V, vii°) creates tension that wants to return home. Most progressions cycle home → away → tension → home.' },
    { t: 'Cadences', ex: ['Dm', 'G7', 'C'], x: 'Musical punctuation. Perfect/authentic: V→I (full stop). Plagal: IV→I ("Amen"). Half: ends on V (comma). Deceptive: V→vi (surprise!).' },
    { t: 'Secondary dominants', ex: ['C', 'A7', 'Dm', 'G7', 'C'], x: 'Make any chord feel like a temporary home by playing its own V7 first. A7 is "V of ii" in C: it pulls strongly into Dm.' },
    { t: 'Tritone substitution', ex: ['Dm7', 'Db7', 'Cmaj7'], x: 'A dominant 7th can be replaced by the dominant a tritone away (G7 → Db7). They share the same 3rd and 7th, and the bass now slides down by semitones.' },
    { t: 'Borrowed chords (modal interchange)', ex: ['C', 'Ab', 'Bb', 'C'], x: 'Borrow chords from the parallel minor (or a mode) on the same root. In C major: Fm (iv), Ab (bVI), Bb (bVII), Eb (bIII). Instantly adds emotion or drama.' },
    { t: 'Backdoor progression', ex: ['Fm7', 'Bb7', 'Cmaj7'], x: 'Approach home from a whole step below (bVII7) instead of from V7. Softer, soulful resolution.' },
    { t: 'Passing diminished chords', ex: ['C', 'C#dim7', 'Dm', 'G7'], x: 'A diminished 7th between two chords a whole step apart creates a smooth chromatic bass line.' },
    { t: 'Line clichés', ex: ['Am', 'Am(maj7)', 'Am7', 'Am6'], x: 'Hold a chord while one voice moves by semitones. Instant drama, heard in countless ballads and film themes.' },
    { t: 'Chromatic mediants', ex: ['C', 'E', 'C', 'Ab'], x: 'Jump to a chord of the same type a 3rd away that is outside the key (C → E, C → Ab). Only one shared note: a sudden, cinematic colour change.' },
    { t: 'Neo-Riemannian moves (P, R, L…)', ex: ['C', 'Cm', 'Ab', 'Abm'], x: 'Change one or two notes by a semitone to get a new chord. P (parallel) C→Cm, R (relative) C→Am, L (leading-tone) C→Em, plus S, N and H. Great for film-like harmony.' },
    { t: 'Neapolitan chord', ex: ['Am', 'Bb', 'E7', 'Am'], x: 'A major chord on the flat 2nd (bII), usually leading to V. Dramatic, classical and dark.' },
    { t: 'Augmented sixth sound', ex: ['Am', 'F7', 'E', 'Am'], x: 'A dominant-7-shaped chord on b6 that drops by a semitone to V. Romantic-era drama.' },
    { t: 'Suspensions', ex: ['Csus4', 'C', 'Csus2', 'C'], x: 'Replace the 3rd with a 4th or 2nd for tension; resolve it to the 3rd for release.' },
    { t: 'Planing', ex: ['Cmaj7', 'Dmaj7', 'Cmaj7', 'Bbmaj7'], x: 'Slide the same chord shape up or down. Ignores the key but sounds modern and smooth.' },
    { t: 'Coltrane changes', ex: ['Cmaj7', 'Eb7', 'Abmaj7', 'B7', 'Emaj7', 'G7', 'Cmaj7'], x: 'Three keys a major third apart, each reached through its own V7. John Coltrane\'s "Giant Steps".' },
    { t: 'Power chords', ex: ['E5', 'G5', 'A5', 'C5', 'D5'], x: 'Just root and fifth: no major/minor colour. Sound huge with distortion; the basis of rock and metal riffs.' },
    { t: 'Modes', ex: ['Dm', 'G', 'Dm', 'G'], x: 'Start the major scale on a different note and you get a mode with its own mood. Dorian (minor + major IV) above. See Keys & Scales for all of them.' }
  ];

  var HOWTO = [
    ['Find a chord', 'Open Chords, pick a root and a type (or type a name like F#m7b5). Tap Play to hear it, Open for everything about it.'],
    ['See what goes well', 'On a chord page, "Next" ranks the chords that sound good after it. Colours show how common each move is: green core, blue common, purple colour, pink exotic. Tap ▶ on a row to hear the change.'],
    ['Build from random chords', 'Open Create, add chords (or roll the dice), then tap Create progression. You get several orderings of your chords plus versions with connecting chords (marked with +), each with its feeling explained. Turn on Modal colour to also get versions that borrow chords from a parallel mode (Dorian, Lydian, Mixolydian…), outlined in purple.'],
    ['Famous progressions', 'Progressions lists 34 classic progressions in any key, with their mood. Tap ▶ to listen or Open in Create to experiment.'],
    ['Keys & scales', 'Pick a key and scale to see all its chords, their functions and typical progressions.'],
    ['Save things', 'Star chords and save progressions; find them under Saved.'],
    ['Change the sound', 'Settings lets you pick guitar, piano or pad, strum pattern, tempo and more.']
  ];

  var LIMITS = [
    'No slash chords or inversions as separate entries (inversions appear only inside some voicings and line clichés).',
    '"Exotic scale" next chords are in-scale moves with no established statistics behind them; treat them as colour.',
    'Tier labels are editorial judgement calls informed by Hooktheory statistics and functional harmony, not measured probabilities.',
    'Mood descriptions in Create are generated from the harmony (key, chord types, borrowed chords, bass motion, cadences); they are a guide, not a rule.'
  ];

  var SOURCES = [
    ['Hooktheory: 1,300-song analysis', 'https://www.hooktheory.com/blog/i-analyzed-the-chords-of-1300-popular-songs-for-patterns-this-is-what-i-found/'],
    ['Iowa State: Diatonic harmony', 'https://iastate.pressbooks.pub/comprehensivemusicianship/chapter/6-1-diatonic-harmony-tutorial/'],
    ['Open Music Theory: Neo-Riemannian', 'https://pressbooks.nebraska.edu/openmusictheory/chapter/neo-riemannian-triadic-progressions'],
    ['Open Music Theory: Mediants', 'https://viva.pressbooks.pub/openmusictheory/chapter/mediants/'],
    ['Open Music Theory: Modal schemas', 'https://viva.pressbooks.pub/openmusictheory/chapter/modal-schemas/'],
    ['Integrated Music Theory: Mode mixture', 'https://intmus.github.io/inttheory/16-mode-mixture/a1-ex-intromodemix.html'],
    ['Wikipedia: Tritone substitution', 'https://en.wikipedia.org/wiki/Tritone_substitution'],
    ['Wikipedia: Backdoor progression', 'https://en.wikipedia.org/wiki/Backdoor_progression'],
    ['Wikipedia: Coltrane changes', 'https://en.wikipedia.org/wiki/Coltrane_changes'],
    ['The Jazz Piano Site: Line clichés', 'https://www.thejazzpianosite.com/jazz-piano-lessons/jazz-chord-progressions/line-cliches/'],
    ['guitarscale.org (scales & fingerings)', 'https://www.guitarscale.org/']
  ];

  return { PROG_MOODS: PROG_MOODS, QUALITY_INFO: QUALITY_INFO, QUALITY_GROUPS: QUALITY_GROUPS, SCALES: SCALES, TIERS: TIERS,
    CONCEPTS: CONCEPTS, HOWTO: HOWTO, LIMITS: LIMITS, SOURCES: SOURCES };
})();
