/*!
 * chord-engine.js — Guitar chord relationship engine
 * ---------------------------------------------------
 * For any chord (12 roots x 35 qualities) it answers:
 *   - what notes / formula it has and how to finger it on guitar
 *   - every key, mode and exotic scale it lives in, and its Roman numeral there
 *   - which chords can follow it (diatonic, borrowed, secondary dominants,
 *     tritone subs, backdoor, passing diminished, line clichés,
 *     chromatic mediants, neo-Riemannian P/L/R/S/N/H, Coltrane, planing ...)
 *   - which chords lead INTO it, and famous progressions it belongs to
 *
 * Works in the browser (window.ChordEngine) and in Node (require / CLI):
 *   node chord-engine.js "Cmaj7"            -> human-readable report
 *   node chord-engine.js "Am7" --json       -> JSON for one chord
 *   node chord-engine.js --all > chords.json -> full dataset
 *
 * Theory sources are listed in CHORD-RULES.md. Tiers: 1 core, 2 common, 3 colour, 4 exotic.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.ChordEngine = api;
})(this, function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Pitch helpers                                                      */
  /* ------------------------------------------------------------------ */
  var mod = function (n) { return ((n % 12) + 12) % 12; };
  var NAME_MAJ = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  var NAME_MIN = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
  var NAME_DIM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  var LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  var LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  var ROMAN = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
  var TIER_NAMES = { 1: 'core', 2: 'common', 3: 'colour', 4: 'exotic' };

  /* ------------------------------------------------------------------ */
  /*  Chord qualities                                                    */
  /*  [id, symbol, name, intervals, family, level, needed-in-voicing]    */
  /*  level: 0 triad-ish, 1 seventh-ish, 2 extended                      */
  /* ------------------------------------------------------------------ */
  var QDEF = [
    ['maj', '', 'major', [0, 4, 7], 'major', 0, [0, 4, 7]],
    ['m', 'm', 'minor', [0, 3, 7], 'minor', 0, [0, 3, 7]],
    ['dim', 'dim', 'diminished', [0, 3, 6], 'dim', 0, [0, 3, 6]],
    ['aug', 'aug', 'augmented', [0, 4, 8], 'aug', 0, [0, 4, 8]],
    ['sus2', 'sus2', 'suspended 2nd', [0, 2, 7], 'sus', 0, [0, 2, 7]],
    ['sus4', 'sus4', 'suspended 4th', [0, 5, 7], 'sus', 0, [0, 5, 7]],
    ['5', '5', 'power chord', [0, 7], 'power', 0, [0, 7]],
    ['b5', '(b5)', 'major flat-five', [0, 4, 6], 'other', 0, [0, 4, 6]],
    ['add9', 'add9', 'added 9th', [0, 4, 7, 14], 'major', 0, [0, 4, 2]],
    ['madd9', 'm(add9)', 'minor added 9th', [0, 3, 7, 14], 'minor', 0, [0, 3, 2]],
    ['6', '6', 'major 6th', [0, 4, 7, 9], 'major', 1, [0, 4, 9]],
    ['m6', 'm6', 'minor 6th', [0, 3, 7, 9], 'minor', 1, [0, 3, 9]],
    ['69', '6/9', 'six-nine', [0, 4, 7, 9, 14], 'major', 2, [0, 4, 9, 2]],
    ['maj7', 'maj7', 'major 7th', [0, 4, 7, 11], 'major', 1, [0, 4, 11]],
    ['7', '7', 'dominant 7th', [0, 4, 7, 10], 'dominant', 1, [0, 4, 10]],
    ['m7', 'm7', 'minor 7th', [0, 3, 7, 10], 'minor', 1, [0, 3, 10]],
    ['mMaj7', 'm(maj7)', 'minor-major 7th', [0, 3, 7, 11], 'minor', 1, [0, 3, 11]],
    ['m7b5', 'm7b5', 'half-diminished (m7b5, ø7)', [0, 3, 6, 10], 'hdim', 1, [0, 3, 6, 10]],
    ['dim7', 'dim7', 'diminished 7th (°7)', [0, 3, 6, 9], 'dim7', 1, [0, 3, 6, 9]],
    ['7sus4', '7sus4', 'dominant 7 sus4', [0, 5, 7, 10], 'dominant', 1, [0, 5, 10]],
    ['aug7', '7#5', 'augmented 7th (7#5)', [0, 4, 8, 10], 'dominant', 1, [0, 4, 8, 10]],
    ['maj7#5', 'maj7#5', 'augmented major 7th', [0, 4, 8, 11], 'aug', 1, [0, 4, 8, 11]],
    ['7b5', '7b5', 'dominant 7 flat-five', [0, 4, 6, 10], 'dominant', 1, [0, 4, 6, 10]],
    ['maj9', 'maj9', 'major 9th', [0, 4, 7, 11, 14], 'major', 2, [0, 4, 11, 2]],
    ['9', '9', 'dominant 9th', [0, 4, 7, 10, 14], 'dominant', 2, [0, 4, 10, 2]],
    ['m9', 'm9', 'minor 9th', [0, 3, 7, 10, 14], 'minor', 2, [0, 3, 10, 2]],
    ['11', '11', 'dominant 11th (9sus4)', [0, 7, 10, 14, 17], 'dominant', 2, [0, 10, 5]],
    ['m11', 'm11', 'minor 11th', [0, 3, 7, 10, 14, 17], 'minor', 2, [0, 3, 10, 5]],
    ['13', '13', 'dominant 13th', [0, 4, 7, 10, 14, 21], 'dominant', 2, [0, 4, 10, 9]],
    ['maj13', 'maj13', 'major 13th', [0, 4, 7, 11, 14, 21], 'major', 2, [0, 4, 11, 9]],
    ['maj7#11', 'maj7#11', 'major 7 sharp-11 (Lydian)', [0, 4, 7, 11, 18], 'major', 2, [0, 4, 11, 6]],
    ['7b9', '7b9', 'dominant 7 flat-9', [0, 4, 7, 10, 13], 'dominant', 2, [0, 4, 10, 1]],
    ['7#9', '7#9', 'dominant 7 sharp-9 ("Hendrix chord")', [0, 4, 7, 10, 15], 'dominant', 2, [0, 4, 10, 3]],
    ['7#11', '7#11', 'dominant 7 sharp-11 (Lydian dominant)', [0, 4, 7, 10, 18], 'dominant', 2, [0, 4, 10, 6]],
    ['7alt', '7alt', 'altered dominant (b9, #9, b13)', [0, 4, 10, 13, 15, 20], 'dominant', 2, [0, 4, 10, 8]]
  ];
  var Q = {}; var QLIST = [];
  QDEF.forEach(function (d) {
    var q = { id: d[0], sym: d[1], name: d[2], iv: d[3], fam: d[4], lvl: d[5], need: d[6] };
    q.pcs = q.iv.map(mod).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
    Q[q.id] = q; QLIST.push(q);
  });

  var IV_LABEL = { 0: '1', 1: 'b2', 2: '2', 3: 'b3', 4: '3', 5: '4', 6: 'b5', 7: '5', 8: '#5', 9: '6', 10: 'b7', 11: '7',
    13: 'b9', 14: '9', 15: '#9', 17: '11', 18: '#11', 20: 'b13', 21: '13' };
  function intervalLabel(q, iv) {
    if (q.id === 'dim7' && iv === 9) return 'bb7';
    return IV_LABEL[iv];
  }
  var DEG_OF = { '1': 1, 'b2': 2, '2': 2, 'b3': 3, '3': 3, '4': 4, 'b5': 5, '5': 5, '#5': 5, '6': 6, 'bb7': 7, 'b7': 7, '7': 7,
    'b9': 2, '9': 2, '#9': 2, '11': 4, '#11': 4, 'b13': 6, '13': 6 };

  function rootName(pc, qid) {
    var q = Q[qid] || Q.maj;
    if (q.fam === 'dim' || q.fam === 'hdim' || q.fam === 'dim7') return NAME_DIM[mod(pc)];
    if (q.fam === 'minor') return NAME_MIN[mod(pc)];
    return NAME_MAJ[mod(pc)];
  }
  function pcOfName(nm) {
    if (!nm || LETTER_PC[nm[0]] === undefined) return null;
    var p = LETTER_PC[nm[0]];
    for (var i = 1; i < nm.length; i++) p += nm[i] === '#' ? 1 : nm[i] === 'b' ? -1 : 0;
    return mod(p);
  }
  // Spell a pitch with a given letter; null if it would need a double accidental
  function nameFromLetter(li, pc) {
    var letter = LETTERS[((li % 7) + 7) % 7];
    var diff = mod(pc - LETTER_PC[letter]); if (diff > 6) diff -= 12;
    if (diff === 0) return letter; if (diff === 1) return letter + '#'; if (diff === -1) return letter + 'b';
    return null;
  }
  var DEG_FOR_SEMI = [1, 2, 2, 3, 3, 4, 4, 5, 6, 6, 7, 7];
  var AWKWARD = { 'B#': 1, 'E#': 1, 'Cb': 1, 'Fb': 1 };
  // Name the note `semis` above `baseName`, using scale-degree letter logic (A + major 3rd = C#, not Db)
  function relName(baseName, semis, deg, fallbackQ) {
    var bp = pcOfName(baseName); var target = mod(bp + semis);
    if (bp === null) return rootName(target, fallbackQ);
    var li = LETTERS.indexOf(baseName[0]);
    var d = deg || DEG_FOR_SEMI[mod(semis)];
    var n = nameFromLetter(li + d - 1, target);
    if (!n || AWKWARD[n]) {
      var alt = mod(semis) === 6 ? (d === 4 ? 5 : 4) : null;
      var n2 = alt ? nameFromLetter(li + alt - 1, target) : null;
      n = (n2 && !AWKWARD[n2]) ? n2 : rootName(target, fallbackQ);
    }
    return n;
  }
  function symbol(pc, qid, nm) { return (nm && pcOfName(nm) === mod(pc) ? nm : rootName(pc, qid)) + Q[qid].sym; }

  // Letter-correct spelling of chord tones (double accidentals simplified)
  function spell(rootNm, iv, q) {
    var label = intervalLabel(q, iv);
    var deg = DEG_OF[label];
    var li = LETTERS.indexOf(rootNm[0]);
    var letter = LETTERS[(li + deg - 1) % 7];
    var rootPc = mod(LETTER_PC[rootNm[0]] + (rootNm.length > 1 ? (rootNm[1] === '#' ? 1 : -1) : 0));
    var target = mod(rootPc + iv);
    var diff = mod(target - LETTER_PC[letter]); if (diff > 6) diff -= 12;
    if (diff === 0) return letter;
    if (diff === 1) return letter + '#';
    if (diff === -1) return letter + 'b';
    return (diff > 0 ? SHARP : FLAT)[target];
  }

  function chordInfo(pc, qid, nm) {
    var q = Q[qid]; var rn = nm && pcOfName(nm) === mod(pc) ? nm : rootName(pc, qid);
    var uniq = []; q.iv.forEach(function (iv) { if (uniq.indexOf(iv) < 0) uniq.push(iv); });
    return {
      symbol: rn + q.sym, root: rn, rootPc: mod(pc), quality: q.id, qualityName: q.name, family: q.fam, level: q.lvl,
      formula: uniq.map(function (iv) { return intervalLabel(q, iv); }).join(' '),
      notes: uniq.map(function (iv) { return spell(rn, iv, q); }),
      pcs: q.pcs.map(function (i) { return mod(pc + i); })
    };
  }

  function parseChord(str) {
    if (!str) return null;
    var s = String(str).trim().replace(/♭/g, 'b').replace(/♯/g, '#').replace(/°7/g, 'dim7').replace(/°/g, 'dim')
      .replace(/ø7?/g, 'm7b5').replace(/Δ7?/g, 'maj7').replace(/M7/g, 'maj7').replace(/-7b5/g, 'm7b5').replace(/maj7\+5/gi, 'maj7#5').replace(/7\+5/g, '7#5').replace(/\+7/g, '7#5').replace(/\+/g, 'aug')
      .replace(/Maj/g, 'maj');
    var m = s.match(/^([A-Ga-g])([#b]?)(.*)$/);
    if (!m) return null;
    var pc = mod(LETTER_PC[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0));
    var rest = m[3].replace(/\s+/g, '');
    var alias = { '': 'maj', 'maj': 'maj', 'M': 'maj', 'min': 'm', 'mi': 'm', '-': 'm', 'm7-5': 'm7b5', 'min7': 'm7', '-7': 'm7',
      'mmaj7': 'mMaj7', 'm(maj7)': 'mMaj7', 'mM7': 'mMaj7', 'minmaj7': 'mMaj7', 'madd9': 'madd9', 'm(add9)': 'madd9', 'm9': 'm9',
      '6/9': '69', '69': '69', '7#5': 'aug7', 'aug7': 'aug7', '7+5': 'aug7', 'maj7#5': 'maj7#5', 'maj7+5': 'maj7#5', 'augmaj7': 'maj7#5',
      '(b5)': 'b5', 'b5': 'b5', '-5': 'b5', '7-5': '7b5', 'dom7': '7', '9sus4': '11', 'sus': 'sus4', 'alt': '7alt', '7alt': '7alt',
      'dim': 'dim', 'aug': 'aug', 'm7b5': 'm7b5', 'dim7': 'dim7', 'maj9': 'maj9', 'maj13': 'maj13', 'maj7#11': 'maj7#11' };
    var qid = alias[rest] || (Q[rest] ? rest : null);
    if (!qid) { var hit = QLIST.filter(function (q) { return q.sym === rest; })[0]; qid = hit ? hit.id : null; }
    return qid ? { pc: pc, q: qid, name: m[1].toUpperCase() + m[2] } : null;
  }

  /* ------------------------------------------------------------------ */
  /*  Classify an interval set -> quality (used when stacking scales)     */
  /* ------------------------------------------------------------------ */
  var STACK_CLASS = {
    '0,4,7': 'maj', '0,3,7': 'm', '0,3,6': 'dim', '0,4,8': 'aug', '0,4,6': 'b5',
    '0,4,7,11': 'maj7', '0,4,7,10': '7', '0,3,7,10': 'm7', '0,3,7,11': 'mMaj7', '0,3,6,10': 'm7b5', '0,3,6,9': 'dim7',
    '0,4,8,10': 'aug7', '0,4,8,11': 'maj7#5', '0,4,6,10': '7b5', '0,3,7,9': 'm6', '0,4,7,9': '6',
    '0,4,7,11,14': 'maj9', '0,4,7,10,14': '9', '0,3,7,10,14': 'm9', '0,4,7,10,13': '7b9', '0,4,7,10,15': '7#9'
  };

  /* ------------------------------------------------------------------ */
  /*  Scales / systems                                                   */
  /* ------------------------------------------------------------------ */
  var SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    natural: [0, 2, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
    melodic: [0, 2, 3, 5, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    phrygdom: [0, 1, 4, 5, 7, 8, 10],
    dblharm: [0, 1, 4, 5, 7, 8, 11],
    hungmin: [0, 2, 3, 6, 7, 8, 11]
  };
  var SYS_LABEL = {
    major: 'major', minor: 'minor', dorian: 'Dorian', mixolydian: 'Mixolydian', lydian: 'Lydian', phrygian: 'Phrygian',
    phrygdom: 'Phrygian dominant (Spanish / flamenco)', dblharm: 'double harmonic major (Byzantine, "Gypsy major")',
    hungmin: 'Hungarian minor ("Gypsy minor")'
  };
  var SYS_GROUP = { major: 'key', minor: 'key', dorian: 'mode', mixolydian: 'mode', lydian: 'mode', phrygian: 'mode',
    phrygdom: 'exotic', dblharm: 'exotic', hungmin: 'exotic' };

  // Stack thirds on scale degree `offset` of `scale` -> quality id at a given level
  function stackQuality(scale, offset, level) {
    var k = scale.indexOf(mod(offset)); if (k < 0) return null;
    var tones = [];
    for (var j = 0; j < 5; j++) {
      var idx = k + 2 * j; var oct = Math.floor(idx / 7);
      tones.push(scale[idx % 7] + 12 * oct - scale[k]);
    }
    var tri = tones.slice(0, 3), sev = tones.slice(0, 4), nin = tones.slice(0, 5);
    if (level >= 2 && STACK_CLASS[nin.join(',')]) {
      var qq = STACK_CLASS[nin.join(',')];
      if (qq !== '7#9') return qq; // a #9 from stacking means an odd scale; keep it at the 7th
    }
    if (level >= 1 && STACK_CLASS[sev.join(',')]) return STACK_CLASS[sev.join(',')];
    return STACK_CLASS[tri.join(',')] || null;
  }

  function fitsScale(pcs, scale, tonic) {
    for (var i = 0; i < pcs.length; i++) if (scale.indexOf(mod(pcs[i] - tonic)) < 0) return false;
    return true;
  }

  // Quality "shape" flag used to pick rules: M major 3rd, m minor 3rd, A augmented, d diminished, b major-flat5, S sus/power
  function flagOf(qid) {
    var p = Q[qid].pcs; var has = function (x) { return p.indexOf(x) >= 0; };
    if (has(4) && has(6) && !has(7) && (qid === 'b5' || qid === '7b5')) return 'b';
    if (has(4) && has(8) && !has(7) && Q[qid].fam !== 'dominant') return 'A';
    if (has(4)) return 'M';
    if (has(3) && has(6) && !has(7)) return 'd';
    if (has(3)) return 'm';
    return 'S';
  }

  function romanFor(offset, qid) {
    var q = Q[qid]; var base = ROMAN[mod(offset)];
    var lower = (q.fam === 'minor' || q.fam === 'dim' || q.fam === 'hdim' || q.fam === 'dim7');
    var num = base.replace(/[IV]+/, function (s) { return lower ? s.toLowerCase() : s; });
    var suf;
    switch (q.id) {
      case 'maj': suf = ''; break; case 'm': suf = ''; break; case 'dim': suf = '°'; break; case 'aug': suf = '+'; break;
      case 'm7b5': suf = 'ø7'; break; case 'dim7': suf = '°7'; break; case 'maj7#5': suf = '+maj7'; break;
      case 'mMaj7': suf = '(maj7)'; break; case 'madd9': suf = '(add9)'; break;
      default: suf = q.fam === 'minor' ? q.sym.replace(/^m/, '') : q.sym;
    }
    return num + suf;
  }

  /* ------------------------------------------------------------------ */
  /*  Level helpers                                                      */
  /* ------------------------------------------------------------------ */
  var FAMQ = {
    maj: ['maj', 'maj7', 'maj9'], min: ['m', 'm7', 'm9'], dom: ['maj', '7', '9'], dom7: ['7', '7', '9'],
    hdim: ['dim', 'm7b5', 'm7b5'], dim7: ['dim7', 'dim7', 'dim7'], aug: ['aug', 'aug', 'aug'], sus4: ['sus4', '7sus4', '11'],
    pow: ['5', '5', '5'], maj7: ['maj7', 'maj7', 'maj9'], m7: ['m7', 'm7', 'm9'], min7only: ['m7', 'm7', 'm7']
  };
  function famQ(fam, level, selfQ) {
    if (fam === 'self') return selfQ;
    if (FAMQ[fam]) return FAMQ[fam][Math.max(0, Math.min(2, level))]; // family → level-dependent quality
    return fam; // explicit quality id
  }

  // The triad / seventh skeleton a chord must match when stacked from a scale (guards against enharmonic fits)
  var SEV_CORE = { maj7: 'maj7', '7': '7', m7: 'm7', mMaj7: 'mMaj7', m7b5: 'm7b5', dim7: 'dim7', aug7: 'aug7', 'maj7#5': 'maj7#5', '7b5': '7b5',
    maj9: 'maj7', '9': '7', m9: 'm7', '13': '7', maj13: 'maj7', m11: 'm7', 'maj7#11': 'maj7', '7b9': '7', '7#9': '7', '7#11': '7' };
  var TRI_CORE = { maj: 'maj', m: 'm', dim: 'dim', aug: 'aug', b5: 'b5', '6': 'maj', m6: 'm', add9: 'maj', madd9: 'm', '69': 'maj',
    maj7: 'maj', '7': 'maj', m7: 'm', mMaj7: 'm', m7b5: 'dim', dim7: 'dim', aug7: 'aug', 'maj7#5': 'aug', '7b5': 'b5', maj9: 'maj', '9': 'maj',
    m9: 'm', m11: 'm', '13': 'maj', maj13: 'maj', 'maj7#11': 'maj', '7b9': 'maj', '7#9': 'maj', '7#11': 'maj' };
  function stackedMatches(scale, off, qid) {
    var t = TRI_CORE[qid], s = SEV_CORE[qid];
    if (t && stackQuality(scale, off, 0) !== t) return false;
    if (s && stackQuality(scale, off, 1) !== s) return false;
    return true;
  }
  function ch(pc, qid, nm) { var n = nm && pcOfName(nm) === mod(pc) ? nm : rootName(pc, qid); return { pc: mod(pc), q: qid, name: n, sym: n + Q[qid].sym }; }

  /* ------------------------------------------------------------------ */
  /*  KEY RULES: what follows a degree inside a key / mode               */
  /*  rule: [toOffset, tier, why, scaleVariant?]                         */
  /* ------------------------------------------------------------------ */
  var R = {};
  R.major = {
    0: [[5, 1, 'I→IV: the most common way to leave home; IV and V are the two pillars of the key.'],
      [7, 1, 'I→V: in Hooktheory\'s song data V is one of the two most frequent chords after I.'],
      [9, 1, 'I→vi: the relative minor; starts the "50s" I–vi–IV–V and pairs with the I–V–vi–IV pop loop.'],
      [2, 2, 'I→ii: begins the jazz turnaround route (I–ii–V or I–vi–ii–V).'],
      [4, 3, 'I→iii: shares two notes with I; usually continues to vi or IV.']],
    2: [[7, 1, 'ii→V: the predominant→dominant move; the heart of ii–V–I.'],
      [5, 2, 'ii→IV: lateral move between the two predominant chords (common in pop).'],
      [0, 3, 'ii→I: pop shortcut that skips the dominant.'],
      [11, 3, 'ii→vii°: predominant to the other dominant-function chord.'],
      [9, 3, 'ii→vi: loop-friendly retrogression used in pop/neo-soul.']],
    4: [[9, 1, 'iii→vi: by far the usual continuation (Hooktheory: iii almost always goes to vi or IV).'],
      [5, 1, 'iii→IV: the other standard continuation; also the Royal Road ending reversed.'],
      [2, 3, 'iii→ii: stepwise descent (iii–ii–I).'],
      [0, 3, 'iii→I: possible but rare in the data; weak because they share two notes.']],
    5: [[0, 1, 'IV→I: plagal ("Amen") move; in Hooktheory data the most frequent chord after IV.'],
      [7, 1, 'IV→V: predominant→dominant; the second most frequent chord after IV.'],
      [2, 2, 'IV→ii: lateral move inside the predominant group, then on to V.'],
      [9, 2, 'IV→vi: pop loop move (e.g. IV–vi–V).'],
      [4, 3, 'IV→iii: descending bass, Royal Road-style (IV–V–iii–vi).']],
    7: [[0, 1, 'V→I: authentic cadence, the strongest resolution.'],
      [9, 1, 'V→vi: deceptive cadence — vi shares the tonic\'s root and third.'],
      [5, 1, 'V→IV: "retrogression" that is very common in pop/rock (Hooktheory: V splits between I, vi and IV).'],
      [4, 2, 'V→iii: the Royal Road move (IV–V–iii–vi), staple of J-pop.'],
      [2, 3, 'V→ii: unusual backwards step, used in loops.']],
    9: [[5, 1, 'vi→IV: the Axis move (vi–IV–I–V).'],
      [2, 1, 'vi→ii: circle-of-fifths motion (vi–ii–V–I).'],
      [7, 2, 'vi→V: stepwise descent, very common in rock.'],
      [0, 2, 'vi→I: relative swap, shares two notes.'],
      [4, 3, 'vi→iii: Pachelbel-style descent (I–V–vi–iii–IV).']],
    11: [[0, 1, 'vii°→I: leading-tone chord resolving like a dominant.'],
      [4, 3, 'vii°→iii: next link in the diatonic circle of fifths (IV–vii°–iii–vi).'],
      [9, 3, 'vii°→vi: deceptive-style resolution.']]
  };
  R.minor = {
    '0m': [[5, 1, 'i→iv: the basic minor subdominant move (i–iv–V–i).'],
      [8, 1, 'i→bVI: uplifting move, opens the minor "axis" i–bVI–bIII–bVII.'],
      [10, 1, 'i→bVII: subtonic move, start of the Andalusian i–bVII–bVI–V.'],
      [7, 1, 'i→V: dominant from harmonic minor; the raised 7th pulls back to i.', 'harmonic'],
      [3, 2, 'i→bIII: relative major, shares two notes.'],
      [7, 2, 'i→v: natural-minor dominant, softer and modal.'],
      [2, 3, 'i→ii°: predominant colour before V.']],
    '0d': [[5, 2, 'i°→iv: rare tonic diminished; resolve to iv or V.'], [7, 2, '→V', 'harmonic']],
    '2d': [[7, 1, 'iiø→V: the minor ii–V (iiø7–V7–i).', 'harmonic'], [0, 3, 'ii°→i: plagal-ish shortcut.'], [3, 3, 'ii°→bIII: relative-major turn.']],
    '2m': [[7, 2, 'ii (melodic minor)→V7: brighter minor ii–V.', 'harmonic'], [0, 3, 'ii→i.']],
    '3M': [[10, 1, 'bIII→bVII: very common in minor-key songs (e.g. i–bIII–bVII).'],
      [8, 2, 'bIII→bVI: descending fifth inside the minor axis.'],
      [5, 2, 'bIII→iv: stepwise rise toward the predominant.'],
      [0, 2, 'bIII→i: relative major back to its minor.']],
    '3A': [[8, 2, 'III+→bVI: augmented chord resolving like V+ of bVI.'], [0, 2, 'III+→i: leading tone rises to the tonic.', 'natural'], [5, 3, 'III+→iv.']],
    '5m': [[7, 1, 'iv→V: minor plagal set-up for the cadence.', 'harmonic'],
      [0, 1, 'iv→i: minor plagal cadence.'],
      [10, 2, 'iv→bVII: the minor-key "backdoor" route (iv–bVII–i).'],
      [7, 2, 'iv→v: softer natural-minor motion.'],
      [8, 3, 'iv→bVI.']],
    '5M': [[0, 2, 'IV (Dorian/melodic) →i: the Dorian shuttle colour inside minor.'], [7, 2, 'IV→V.', 'harmonic'], [10, 2, 'IV→bVII.']],
    '7m': [[0, 1, 'v→i: natural-minor dominant.'], [5, 2, 'v→iv: e.g. v–iv–i in "Ain\'t No Sunshine".'], [8, 2, 'v→bVI.'], [10, 2, 'v→bVII.']],
    '7M': [[0, 1, 'V→i: perfect cadence in minor.'], [8, 1, 'V→bVI: deceptive cadence in minor.'], [5, 3, 'V→iv: bluesy reversal.']],
    '8M': [[10, 1, 'bVI→bVII: Aeolian cadence (bVI–bVII–i).'],
      [7, 1, 'bVI→V: the Andalusian / Phrygian half-cadence semitone (bVI–V).', 'harmonic'],
      [3, 1, 'bVI→bIII: e.g. "The Sound of Silence" (bVI–bIII).'],
      [5, 2, 'bVI→iv.'], [0, 2, 'bVI→i: shares two notes with i.']],
    '10M': [[0, 1, 'bVII→i: subtonic shuttle (i–bVII–i).'], [3, 1, 'bVII→bIII.'], [8, 1, 'bVII→bVI: Andalusian descent (i–bVII–bVI–V).'], [5, 3, 'bVII→iv.']],
    '11d': [[0, 1, 'vii°7→i: leading-tone diminished resolving to the tonic.']],
    '9d': [[7, 2, 'viø (melodic minor)→V.', 'harmonic']]
  };
  R.dorian = {
    '0m': [[5, 1, 'i→IV: the Dorian shuttle — the major IV is THE Dorian sound.'], [10, 1, 'i→bVII.'], [2, 2, 'i→ii.'], [7, 2, 'i→v.'], [3, 2, 'i→bIII.']],
    '5M': [[0, 1, 'IV→i: back to the Dorian tonic.'], [10, 2, 'IV→bVII.'], [7, 3, 'IV→v.']],
    '10M': [[0, 1, 'bVII→i.'], [5, 2, 'bVII→IV.']],
    '2m': [[0, 2, 'ii→i: Dorian neighbour.'], [5, 2, 'ii→IV.']],
    '7m': [[0, 2, 'v→i.'], [5, 2, 'v→IV.']]
  };
  R.mixolydian = {
    '0M': [[10, 1, 'I→bVII: the Mixolydian signature (rock, folk, Celtic).'], [5, 1, 'I→IV.'], [7, 2, 'I→v (minor v).'], [2, 3, 'I→ii.']],
    '10M': [[0, 1, 'bVII→I: Mixolydian cadence.'], [5, 1, 'bVII→IV: "double plagal" bVII–IV–I.']],
    '5M': [[0, 1, 'IV→I.'], [10, 2, 'IV→bVII.']],
    '7m': [[0, 2, 'v→I.'], [5, 2, 'v→IV.']]
  };
  R.lydian = {
    '0M': [[2, 1, 'I→II: the Lydian shuttle — the major II (with #4) is THE Lydian sound.'], [11, 2, 'I→vii.'], [7, 2, 'I→V.'], [4, 3, 'I→iii.']],
    '2M': [[0, 1, 'II→I.'], [5, 2, 'II→IV→I: "Lydian cadence" (borrows the plain IV).', null, 'maj'], [7, 3, 'II→V.']],
    '11m': [[0, 2, 'vii→I.'], [2, 2, 'vii→II.']],
    '7M': [[0, 2, 'V→I.'], [2, 2, 'V→II.']]
  };
  R.phrygian = {
    '0m': [[1, 1, 'i→bII: the Phrygian half-step — its defining sound (flamenco, metal).'], [10, 2, 'i→bvii.'], [10, 2, 'i→bVII (major, common substitution).', null, 'maj'], [5, 2, 'i→iv.'], [3, 3, 'i→bIII.']],
    '1M': [[0, 1, 'bII→i: the semitone slide home.'], [3, 2, 'bII→bIII.'], [10, 2, 'bII→bvii.']],
    '10m': [[0, 2, 'bvii→i.'], [1, 2, 'bvii→bII.']],
    '5m': [[1, 2, 'iv→bII.'], [0, 2, 'iv→i.']]
  };
  R.phrygdom = {
    '0M': [[1, 1, 'I→bII: the flamenco/Spanish semitone over a major tonic.'], [5, 1, 'I→iv.'], [10, 3, 'I→bvii.']],
    '1M': [[0, 1, 'bII→I: the flamenco cadence (end of iv–bIII–bII–I).']], '5m': [[0, 2, 'iv→I.'], [1, 2, 'iv→bII.']],
    '10m': [[1, 3, 'bvii→bII.'], [0, 3, 'bvii→I.']]
  };
  R.dblharm = {
    '0M': [[1, 1, 'I→bII: the "snake-charmer" semitone over a major tonic.'], [5, 2, 'I→iv.'], [4, 3, 'I→iii.'], [8, 3, 'I→bVI+.']],
    '1M': [[0, 1, 'bII→I.'], [5, 2, 'bII→iv.']], '5m': [[0, 2, 'iv→I.'], [1, 2, 'iv→bII.']], '4m': [[5, 3, 'iii→iv.'], [0, 3, 'iii→I.']],
    '8A': [[0, 3, 'bVI+→I.']]
  };
  R.hungmin = {
    '0m': [[7, 1, 'i→V.'], [8, 2, 'i→bVI.'], [11, 3, 'i→vii.'], [3, 3, 'i→bIII+.']],
    '7M': [[0, 1, 'V→i.'], [8, 2, 'V→bVI.']], '8M': [[7, 1, 'bVI→V: the semitone drop.'], [0, 2, 'bVI→i.']],
    '11m': [[0, 3, 'vii→i.']], '3A': [[7, 3, 'bIII+→V.'], [0, 3, 'bIII+→i.']], '2b': [[7, 3, 'II(b5)→V: French-sixth-like pull to V.']]
  };

  var KEY_ROLE_ORDER = { 0: 0, 5: 1, 7: 2, 9: 3, 2: 4, 4: 5, 11: 6, 3: 3, 8: 2, 10: 3, 1: 7, 6: 8 };

  function coreQualityChain(qid) {
    var q = Q[qid]; var chain = [qid];
    if (q.fam === 'dominant') chain.push(qid === '7sus4' || qid === '11' ? '7sus4' : '7');
    if (q.fam === 'major') chain.push(q.lvl >= 1 || qid === '69' ? 'maj7' : 'maj', 'maj');
    if (q.fam === 'minor') chain.push('m7', 'm');
    if (qid === 'maj7#5') chain.push('aug');
    if (qid === '7b5' || qid === 'aug7') chain.push('7');
    return chain.filter(function (v, i, a) { return a.indexOf(v) === i; });
  }

  function tonicNameFor(chordNm, off, tonicQ, t) {
    var li = LETTERS.indexOf(chordNm[0]);
    var d = DEG_FOR_SEMI[mod(off)];
    var n = nameFromLetter(li - (d - 1), t);
    var dflt = (tonicQ === 'm' ? NAME_MIN : NAME_MAJ)[t];
    if (!n || AWKWARD[n] || /(#.*#|b.*b)/.test(n)) return dflt;
    // avoid theoretical keys (e.g. D# major, Gb minor) when a simpler spelling exists
    var theo = tonicQ === 'maj' ? { 'D#': 1, 'G#': 1, 'A#': 1, 'Gb': 0 } : { 'Db': 1, 'Gb': 1, 'Cb': 1 };
    return theo[n] ? dflt : n;
  }
  function buildTarget(sys, tonic, rule, level, variantDefault, tonicNm) {
    var to = rule[0], explicitFam = rule[4];
    var scaleName = rule[3] || variantDefault;
    var qid;
    if (explicitFam) qid = famQ(explicitFam, level);
    else qid = stackQuality(SCALES[scaleName], to, level);
    if (!qid) return null;
    var nm = relName(tonicNm, to, DEG_FOR_SEMI[mod(to)], qid);
    return { pc: mod(tonic + to), q: qid, name: nm, sym: nm + Q[qid].sym, roman: romanFor(to, qid) };
  }

  function keyContexts(pc, qid, level, rootNm) {
    rootNm = rootNm && pcOfName(rootNm) === mod(pc) ? rootNm : rootName(pc, qid);
    var out = [];
    var chain = coreQualityChain(qid);
    var usedCore = null;
    for (var ci = 0; ci < chain.length; ci++) {
      var cq = chain[ci];
      var flag = flagOf(cq);
      var found = [];
      // symmetric chords are the same notes from several roots: dim7 every m3, augmented every M3
      var spellRoots = cq === 'dim7' ? [0, 3, 6, 9] : cq === 'aug' ? [0, 4, 8] : [0];
      spellRoots.forEach(function (k) {
        var rr = mod(pc + k);
        var pcs = Q[cq].pcs.map(function (i) { return mod(rr + i); });
        var rrName = k ? relName(rootNm, k, k === 6 ? 5 : DEG_FOR_SEMI[k] === 4 ? 3 : DEG_FOR_SEMI[k], cq) : rootNm;
        var as = k ? rrName + Q[cq].sym : null;
        for (var t = 0; t < 12; t++) {
          var off = mod(rr - t);
          var ok = function (sc) { return fitsScale(pcs, SCALES[sc], t) && stackedMatches(SCALES[sc], off, cq); };
          if (ok('major')) found.push(mk('major', t, off, cq, flag, 'major', R.major[off], as, rrName));
          var variants = ['natural', 'harmonic', 'melodic'];
          for (var v = 0; v < 3; v++) {
            if (ok(variants[v])) {
              found.push(mk('minor', t, off, cq, flag, variants[v], R.minor[off + flag] || R.minor[off + 'M'], as, rrName));
              break;
            }
          }
          ['dorian', 'mixolydian', 'lydian', 'phrygian', 'phrygdom', 'dblharm', 'hungmin'].forEach(function (s) {
            var rules = R[s][off + flag] || (flag === 'S' ? (R[s][off + 'M'] || R[s][off + 'm']) : null);
            if (rules && ok(s)) found.push(mk(s, t, off, cq, flag, s, rules, as, rrName));
          });
        }
      });
      if (found.length) { out = found; usedCore = cq; break; }
    }
    function mk(sys, t, off, cq, flag, variant, rules, as, chordNm) {
      var tonicQ = sys === 'major' || sys === 'mixolydian' || sys === 'lydian' || sys === 'phrygdom' || sys === 'dblharm' ? 'maj' : 'm';
      // tonic spelled by letter from the chord's own root (C#m as vi → E major)
      var tonicNm = tonicNameFor(chordNm, off, tonicQ, t);
      var keyName = tonicNm + ' ' + SYS_LABEL[sys];
      var next = (rules || []).map(function (r) {
        var tgt = buildTarget(sys, t, r, level, sys === 'minor' ? 'natural' : variant, tonicNm);
        if (!tgt) return null;
        return { to: tgt.sym, pc: tgt.pc, q: tgt.q, roman: tgt.roman, tier: r[1], why: r[2] };
      }).filter(Boolean);
      return { system: sys, group: SYS_GROUP[sys], tonicPc: t, tonic: tonicNm, key: keyName, variant: sys === 'minor' ? variant : null,
        role: romanFor(off, cq), offset: off, as: as || null, next: next };
    }
    out.sort(function (a, b) {
      var ga = { key: 0, mode: 1, exotic: 2 }[a.group] - { key: 0, mode: 1, exotic: 2 }[b.group];
      if (ga) return ga;
      if (a.system !== b.system) return a.system === 'major' ? -1 : b.system === 'major' ? 1 : a.system < b.system ? -1 : 1;
      return (KEY_ROLE_ORDER[a.offset] || 9) - (KEY_ROLE_ORDER[b.offset] || 9);
    });
    return { core: usedCore, coreSymbol: usedCore ? rootNm + Q[usedCore].sym : null, contexts: out };
  }

  /* ------------------------------------------------------------------ */
  /*  CHROMATIC / KEY-INDEPENDENT MOVES                                  */
  /*  each move: {cat, tier, label, why, steps:[{pc,q,sym}]}             */
  /* ------------------------------------------------------------------ */
  var CATS = {
    dominant: 'Dominant motion & substitutions',
    borrowed: 'Borrowed chords (modal interchange)',
    passing: 'Passing chords & voice-leading tricks',
    mediant: 'Chromatic mediants (third relations)',
    neo: 'Neo-Riemannian moves (common-tone triads)',
    cycles: 'Symmetric cycles, planing & jazz devices',
    sus: 'Suspensions & resolutions'
  };

  function chromaticMoves(pc, qid, level, rootNm) {
    var q = Q[qid]; var f = q.fam; var M = [];
    var r = pc; var L = level;
    rootNm = rootNm && pcOfName(rootNm) === mod(pc) ? rootNm : rootName(pc, qid);
    function add(cat, tier, label, why, steps) {
      M.push({ cat: cat, tier: tier, label: label, why: why, steps: steps.map(function (s) { return ch(s[0], s[1], s[3] || relName(rootNm, s[0] - r, s[2], s[1])); }) });
    }
    var DOM = famQ('dom7', L), MAJ = famQ('maj', L), MIN = famQ('min', L), MAJ7 = famQ('maj7', L), MIN7 = famQ('m7', L);

    if (f === 'major' || f === 'power' || f === 'sus' || qid === 'maj') {
      var isMaj = f === 'major';
      if (isMaj) {
        // ---- dominant motion (treating the chord as I)
        add('dominant', 1, 'I → I7 → IV', 'Add the b7 and the tonic becomes V7 of IV (secondary dominant).', [[r, DOM], [r + 5, MAJ]]);
        add('dominant', 1, 'I → VI7 → ii (V7/ii)', 'Secondary dominant of ii; E.g. C–A7–Dm.', [[r + 9, DOM], [r + 2, MIN]]);
        add('dominant', 1, 'I → III7 → vi (V7/vi)', 'Secondary dominant of the relative minor; very common in pop (C–E7–Am).', [[r + 4, DOM], [r + 9, MIN]]);
        add('dominant', 2, 'I → II7 → V (V7/V)', 'The "V of V" — a major II that pushes to the dominant.', [[r + 2, DOM], [r + 7, famQ('dom7', L)]]);
        add('dominant', 3, 'I → VII7 → iii (V7/iii)', 'Secondary dominant of iii.', [[r + 11, DOM], [r + 4, MIN]]);
        add('dominant', 3, 'I → bIII7 → ii (subV7/ii)', 'Tritone substitute of VI7: resolves down a half step to ii.', [[r + 3, DOM], [r + 2, MIN7]]);
        add('dominant', 3, 'I → bVI7 → V7 (subV7/V)', 'Tritone substitute of II7: chromatic bass into V.', [[r + 8, DOM], [r + 7, '7']]);
        // ---- borrowed
        add('borrowed', 1, 'I → iv (minor four)', 'Borrowed from the parallel minor; the classic bittersweet darkening (IV→iv→I).', [[r + 5, MIN]]);
        add('borrowed', 1, 'I → bVI', 'Borrowed from parallel minor; dramatic/cinematic lift (often bVI–bVII–I).', [[r + 8, MAJ]]);
        add('borrowed', 1, 'I → bVII', 'Borrowed from Mixolydian/minor; the rock sound (I–bVII–IV–I).', [[r + 10, MAJ]]);
        add('borrowed', 2, 'I → bIII', 'Borrowed from the parallel minor.', [[r + 3, MAJ]]);
        add('borrowed', 2, 'I → i (parallel minor)', 'Switch mode on the same root (Picardy in reverse).', [[r, MIN]]);
        add('borrowed', 2, 'I → iiø7', 'Minor-key ii borrowed into major; leads to V.', [[r + 2, 'm7b5'], [r + 7, '7']]);
        add('borrowed', 2, 'I → v (minor five)', 'Mixolydian/Dorian colour, avoids the leading tone.', [[r + 7, MIN]]);
        add('borrowed', 2, 'I → II (Lydian major two)', 'Borrowed from Lydian: dreamy, floating.', [[r + 2, MAJ]]);
        add('borrowed', 3, 'I → bII (Neapolitan)', 'Phrygian/Neapolitan colour; normally continues to V.', [[r + 1, MAJ], [r + 7, '7']]);
        add('borrowed', 2, 'I → iv7 → bVII7 → I (backdoor)', 'Backdoor ii–V: iv7 then bVII7 resolves up a whole step to I.', [[r + 5, 'm7'], [r + 10, '7'], [r, MAJ7]]);
        // ---- passing
        add('passing', 2, 'I → #i°7 → ii', 'Chromatic passing diminished between I and ii (acts as rootless VI7b9).', [[r + 1, 'dim7', 1], [r + 2, MIN]]);
        add('passing', 3, 'I → #ii°7 → I', 'Common-tone diminished that embellishes the same chord.', [[r + 3, 'dim7', 2], [r, MAJ]]);
        add('passing', 2, 'IV → #iv°7 → I (if this chord is IV)', 'Blues/gospel climb: the chord, a dim7 a half step up, then the I a 4th lower.', [[r + 1, 'dim7', 1], [r + 7, 'maj']]);
        add('passing', 2, 'I → I+ → I6 → I7 (rising line cliché)', 'The 5th climbs 5–#5–6–b7 against a held chord.', [[r, 'aug'], [r, '6'], [r, '7']]);
        add('passing', 2, 'I → Imaj7 → I7 → IV (falling line cliché)', 'The root descends 1–7–b7 and lands on IV.', [[r, 'maj7'], [r, '7'], [r + 5, MAJ]]);
        add('passing', 3, 'I → I+ → IV', 'Augmented passing chord: the #5 becomes the 3rd of IV.', [[r, 'aug'], [r + 5, MAJ]]);
        add('passing', 3, 'I → I+ → vi', 'The #5 rises to the root of vi.', [[r, 'aug'], [r + 9, MIN]]);
      }
      if (f === 'major' || qid === 'maj' || f === 'power') {
        // ---- chromatic mediants
        var M_TRI = isMaj ? MAJ : (f === 'power' ? '5' : 'maj');
        add('mediant', 3, 'Up a major 3rd, same quality', 'Chromatic mediant (one common tone) — instant cinematic shift.', [[r + 4, M_TRI]]);
        add('mediant', 3, 'Down a minor 3rd, same quality', 'Chromatic mediant (e.g. C → A).', [[r + 9, M_TRI]]);
        add('mediant', 3, 'Up a minor 3rd, same quality', 'Chromatic mediant (e.g. C → Eb).', [[r + 3, M_TRI]]);
        add('mediant', 3, 'Down a major 3rd, same quality', 'Chromatic mediant (e.g. C → Ab).', [[r + 8, M_TRI]]);
        if (f !== 'power') {
          add('mediant', 4, 'Doubly-chromatic mediant (up m3, minor)', 'No common tones — the most remote third relation (e.g. C → Ebm).', [[r + 3, MIN]]);
          add('mediant', 4, 'Doubly-chromatic mediant (down M3, minor)', 'No common tones (e.g. C → Abm); also the "hexatonic pole".', [[r + 8, MIN]]);
          // ---- neo-Riemannian (major triad)
          add('neo', 2, 'P — Parallel', 'Keep the 5th, move the 3rd down a semitone (C → Cm).', [[r, 'm']]);
          add('neo', 2, 'R — Relative', 'Keep the major 3rd, move the 5th up a tone (C → Am).', [[r + 9, 'm']]);
          add('neo', 2, 'L — Leading-tone exchange', 'Keep the minor 3rd, root down a semitone (C → Em).', [[r + 4, 'm']]);
          add('neo', 4, 'S — Slide', 'Keep the 3rd, root and 5th up a semitone (C → C#m).', [[r + 1, 'm', 1]]);
          add('neo', 3, 'N — Nebenverwandt', 'Root stays, 3rd and 5th move a semitone (C → Fm).', [[r + 5, 'm']]);
          add('neo', 4, 'H — Hexatonic pole', 'Every note moves a semitone, no common tones (C → Abm).', [[r + 8, 'm']]);
        }
      }
      if (isMaj) {
        // ---- cycles & jazz
        add('cycles', 4, 'Coltrane cycle', 'Giant-Steps-style: V7 of the key a major 3rd down, then onward (C–Eb7–Ab–B7–E–G7–C).',
          [[r + 3, '7'], [r + 8, MAJ7], [r + 11, '7'], [r + 4, MAJ7], [r + 7, '7'], [r, MAJ7]]);
        add('cycles', 3, 'Planing up a whole step', 'Same chord shape slid up a tone (Lydian I–II feel).', [[r + 2, qid]]);
        add('cycles', 3, 'Planing down a whole step', 'Same shape down a tone (Mixolydian I–bVII feel).', [[r + 10, qid]]);
        add('cycles', 4, 'Planing up a half step', 'Constant-structure slide (Neapolitan/Phrygian flavour).', [[r + 1, qid]]);
        add('cycles', 4, 'Hexatonic PL cycle', 'Alternate P and L: C–Cm–Ab–Abm–E–Em–C (one note moves each time).',
          [[r, 'm'], [r + 8, 'maj'], [r + 8, 'm'], [r + 4, 'maj'], [r + 4, 'm'], [r, 'maj']]);
        add('cycles', 4, 'Octatonic PR cycle', 'Alternate P and R: C–Cm–Eb–Ebm–F#–F#m–A–Am–C.',
          [[r, 'm'], [r + 3, 'maj'], [r + 3, 'm'], [r + 6, 'maj'], [r + 6, 'm'], [r + 9, 'maj'], [r + 9, 'm'], [r, 'maj']]);
        add('cycles', 4, 'Tritone jump', 'Root moves a tritone, same quality — maximal contrast (film/horror).', [[r + 6, qid]]);
      }
    }

    if (f === 'power') {
      add('cycles', 1, 'I5 → bVII5', 'Rock riff move (borrowed bVII).', [[r + 10, '5']]);
      add('cycles', 1, 'I5 → IV5', 'Rock/blues power-chord staple.', [[r + 5, '5']]);
      add('cycles', 1, 'I5 → bIII5 → IV5', 'Blues-rock riff built on the minor pentatonic.', [[r + 3, '5'], [r + 5, '5']]);
      add('cycles', 1, 'i5 → bVI5 → bVII5', 'Metal/rock minor riff (bVI–bVII–i).', [[r + 8, '5'], [r + 10, '5']]);
      add('cycles', 2, 'I5 → V5', 'Root-fifth move.', [[r + 7, '5']]);
      add('cycles', 3, 'i5 → bII5', 'Phrygian semitone — staple of metal.', [[r + 1, '5']]);
      add('cycles', 4, 'i5 → bV5', 'Tritone root motion — the darkest metal move.', [[r + 6, '5']]);
    }

    if (f === 'sus') {
      if (qid === 'sus4') {
        add('sus', 1, 'sus4 → major', 'Resolve the 4th down to the 3rd.', [[r, 'maj']]);
        add('sus', 2, 'sus4 → minor', 'Resolve the 4th down two semitones to a minor 3rd.', [[r, 'm']]);
        add('sus', 2, 'Vsus4 → I', 'Treat it as a suspended dominant and resolve a 5th down.', [[r + 5, MAJ]]);
        add('sus', 2, 'sus4 ↔ sus2', 'Rock "chime" alternation over the same bass.', [[r, 'sus2']]);
      } else {
        add('sus', 1, 'sus2 → major', 'Resolve the 2nd up to the 3rd.', [[r, 'maj']]);
        add('sus', 1, 'sus2 → minor', 'Resolve the 2nd up a semitone to the minor 3rd.', [[r, 'm']]);
        add('sus', 2, 'sus2 ↔ sus4', 'Alternate over the same root.', [[r, 'sus4']]);
      }
      add('cycles', 3, 'Planing sus chords up a tone', 'Open quartal sounds can slide freely (no 3rd to clash).', [[r + 2, qid]]);
      add('cycles', 3, 'Planing sus chords down a tone', 'Same shape down a whole step.', [[r + 10, qid]]);
      add('cycles', 3, 'Planing sus chords up a 4th', 'Quartal planing.', [[r + 5, qid]]);
    }

    if (f === 'minor') {
      add('dominant', 1, 'ii → V7 → I (as ii)', 'Treat the minor chord as ii: up a 4th to V7, then home.', [[r + 5, DOM], [r + 10, MAJ7]]);
      add('dominant', 2, 'ii → bII7 → I (tritone ii–V)', 'Tritone-substitute dominant a half step below: chromatic bass.', [[r + 11, DOM], [r + 10, MAJ7]]);
      add('dominant', 2, 'iii → VI7 → ii (as iii)', 'Treat it as iii: up a 4th to V7/ii, landing on a minor chord.', [[r + 5, DOM], [r + 10, MIN]]);
      add('dominant', 2, 'i → I7 → iv', 'Turn the minor tonic major-with-b7: it becomes V7 of iv.', [[r, DOM], [r + 5, MIN]]);
      add('dominant', 2, 'vi → V7/V → V (as vi)', 'From the relative minor jump to the V of V (Am → D7 → G).', [[r + 5, DOM], [r + 10, MAJ]]);
      add('borrowed', 2, 'iv → bVII7 → I (backdoor, as iv)', 'Treat it as iv7: the backdoor ii–V lands a whole step above the bVII7.', [[r + 5, '7'], [r + 7, MAJ7]]);
      add('borrowed', 1, 'i → IV (Dorian major four)', 'Raise the 6th: Dorian brightness (Am → D).', [[r + 5, MAJ]]);
      add('borrowed', 2, 'i → I (Picardy / parallel major)', 'Switch to the parallel major.', [[r, MAJ]]);
      add('borrowed', 2, 'i → bII (Phrygian)', 'Semitone up to a major chord — Phrygian/flamenco colour.', [[r + 1, MAJ]]);
      add('borrowed', 3, 'i → bII → V7 → i (Neapolitan)', 'Neapolitan predominant to the dominant.', [[r + 1, MAJ], [r + 7, '7'], [r, MIN]]);
      add('borrowed', 3, 'i → bVI7 → V (German augmented-6th sound)', 'A dominant-7 shape on b6 (sounds like Ger+6) drops a half step to V.', [[r + 8, '7'], [r + 7, 'maj']]);
      add('passing', 1, 'i → i(maj7) → i7 → i6 (falling line cliché)', 'Root falls chromatically 1–7–b7–6 against the minor chord ("Michelle", "Stairway" style).', [[r, 'mMaj7'], [r, 'm7'], [r, 'm6']]);
      add('passing', 2, 'i → i/maj7 → i7 → viø7 → bVImaj7 (lament)', 'The same falling line continued into the bass, ending on bVImaj7.', [[r, 'mMaj7'], [r, 'm7'], [r + 9, 'm7b5'], [r + 8, 'maj7']]);
      add('passing', 2, 'i → bVI/i → i6 → i7 (rising cliché, "Bond" line)', 'The 5th climbs 5–#5–6–b7 (written m(#5) = bVI over the root).', [[r + 8, 'maj'], [r, 'm6'], [r, 'm7']]);
      add('passing', 2, 'iii → biii°7 → ii', 'Descending passing diminished (bossa nova staple): Em → Eb°7 → Dm.', [[r + 11, 'dim7'], [r + 10, MIN]]);
      add('passing', 2, 'ii → #ii°7 → iii', 'Ascending passing diminished between two minor chords a tone apart.', [[r + 1, 'dim7', 1], [r + 2, MIN]]);
      if (qid === 'm' || qid === 'm7' || qid === 'madd9' || qid === 'm9' || qid === 'm6' || qid === 'm11' || qid === 'mMaj7') {
        var MT = qid === 'm' || qid === 'madd9' ? 'm' : MIN;
        add('mediant', 3, 'Minor up a minor 3rd', 'Chromatic mediant between minor chords (film/game scoring).', [[r + 3, MT]]);
        add('mediant', 3, 'Minor down a minor 3rd', 'Chromatic mediant (e.g. Am → F#m).', [[r + 9, MT]]);
        add('mediant', 3, 'Minor up a major 3rd', 'Chromatic mediant (e.g. Am → C#m).', [[r + 4, MT]]);
        add('mediant', 3, 'Minor down a major 3rd', 'Chromatic mediant (e.g. Am → Fm).', [[r + 8, MT]]);
        add('mediant', 4, 'Doubly-chromatic: up a major 3rd, major', 'No common tones (Am → C#).', [[r + 4, 'maj']]);
        add('mediant', 4, 'Doubly-chromatic: down a minor 3rd, major', 'No common tones (Am → F#).', [[r + 9, 'maj']]);
        add('mediant', 4, 'Minor tritone jump', 'Minor to minor a tritone away (Am → Ebm) — eerie scoring move.', [[r + 6, MT]]);
        add('neo', 2, 'P — Parallel', 'Raise the 3rd: minor → major on the same root (Am → A).', [[r, 'maj']]);
        add('neo', 2, 'R — Relative', 'Root down a tone → relative major (Am → C).', [[r + 3, 'maj']]);
        add('neo', 2, 'L — Leading-tone exchange', '5th up a semitone → major chord a major 3rd below (Am → F).', [[r + 8, 'maj']]);
        add('neo', 4, 'S — Slide', 'Keep the 3rd, slide root and 5th down a semitone (Am → G#).', [[r + 11, 'maj']]);
        add('neo', 3, 'N — Nebenverwandt', 'Keep the 5th, 3rd and root move a semitone → major a 5th up (Am → E).', [[r + 7, 'maj']]);
        add('neo', 4, 'H — Hexatonic pole', 'Every note moves a semitone (Am → C#).', [[r + 4, 'maj']]);
        add('cycles', 3, 'Parallel minor 7ths up a tone', 'Dorian-style planing (i7–ii7).', [[r + 2, 'm7']]);
      }
    }

    if (f === 'dominant') {
      var sus = qid === '7sus4' || qid === '11';
      if (sus) add('sus', 1, 'V7sus4 → V7', 'Let the 4th fall to the 3rd before resolving.', [[r, '7'], [r + 5, MAJ]]);
      var altish = ['7b9', '7#9', '7alt', 'aug7'].indexOf(qid) >= 0;
      add('dominant', 1, 'V7 → I (down a 5th, major)', 'Authentic resolution: 3rd→root, b7→3rd of the target.', [[r + 5, MAJ7]]);
      add('dominant', altish ? 1 : 2, 'V7 → i (down a 5th, minor)', altish ? 'Altered tensions (b9/#9/b13) are scale tones of the minor target — the natural pull is to minor.' : 'Same resolution into a minor tonic.', [[r + 5, MIN]]);
      add('dominant', 1, 'V7 → vi (deceptive)', 'Dominant swerves up a step to the relative minor of its target.', [[r + 2, MIN]]);
      add('dominant', 2, 'V7 → bVI (deceptive, minor style)', 'Up a half step to a major chord.', [[r + 1, MAJ7]]);
      add('dominant', 2, 'V7 → IV (blues/pop retrogression)', 'Dominant falls a tone to IV.', [[r + 10, MAJ]]);
      add('dominant', qid === '7#11' || qid === '7b5' ? 1 : 2, 'subV7 → I (resolve down a half step)', 'Read the chord as the tritone substitute of the dominant a tritone away: it slides down a semitone.', [[r + 11, MAJ7]]);
      add('dominant', qid === '7#11' ? 1 : 2, 'bVII7 → I (backdoor, up a whole step)', 'Backdoor dominant: resolves up a tone (Bb7 → C); Lydian-dominant colour fits.', [[r + 2, MAJ7]]);
      add('dominant', 1, 'Dominant chain (V7/V → V7)', 'Secondary-dominant chain round the circle of 5ths (D7 → G7 → C).', [[r + 5, '7']]);
      add('dominant', 3, 'Chromatic dominant chain', 'Dominants descending by semitones (Bb7–A7–Ab7–G7–C).', [[r + 11, '7']]);
      add('dominant', 1, 'Blues I7 → IV7', 'In a blues every chord is a dominant 7: I7 → IV7.', [[r + 5, '7']]);
      add('dominant', 2, 'Blues IV7 → #iv°7 → I7', 'Gospel/blues climb from IV7 via a passing dim7 to I7 (a 4th below).', [[r + 1, 'dim7', 1], [r + 7, '7']]);
      add('dominant', 2, 'Blues V7 → IV7 → I7', 'The blues turnaround descent.', [[r + 10, '7'], [r + 5, '7']]);
      add('cycles', 4, 'Diminished-scale substitution', 'Dominants a minor 3rd apart share the half-whole diminished scale: interchangeable as V7(b9/13).', [[r + 3, '7b9']]);
      add('cycles', 4, 'Tritone sub swap', 'Swap for the dominant a tritone away (same 3rd and b7).', [[r + 6, '7']]);
      if (qid === 'aug7' || qid === '7b5' || qid === '9' || qid === '7#11') add('cycles', 4, 'Whole-tone planing', 'Whole-tone dominants slide by whole steps without leaving the whole-tone scale.', [[r + 2, qid]]);
      if (qid === 'aug7') add('passing', 2, 'V7#5 → I', 'The #5 rises to the 3rd of the target.', [[r + 5, MAJ]]);
    }

    if (f === 'hdim') {
      add('dominant', 1, 'iiø7 → V7 → i (minor ii–V–i)', 'Up a 4th to the dominant, then to the minor tonic.', [[r + 5, '7b9'], [r + 10, MIN]]);
      add('dominant', 1, 'viiø7 → I', 'Leading-tone seventh resolving up a semitone.', [[r + 1, MAJ]]);
      add('dominant', 2, '#ivø7 → VII7 → iii', 'Berg\'s "backdoor to iii": the same ii–V–i aimed at iii.', [[r + 5, '7'], [r + 10, 'm']]);
      add('passing', 2, '#ivø7 → IVmaj7 (lament bass)', 'Bass falls a semitone: e.g. Am/G → F#ø7 → Fmaj7.', [[r + 11, 'maj7']]);
      add('borrowed', 2, 'iiø7 → I (major key, borrowed)', 'The minor-key ii as a dark predominant straight to I.', [[r + 10, MAJ7]]);
      add('passing', 3, 'm7b5 = m6 inversion', 'Bø7 has the same notes as Dm6 — treat as iv6 of A minor → E7 → Am.', [[r + 5, '7'], [r + 10, 'm']]);
    }

    if (f === 'dim') {
      add('dominant', 1, 'vii° → I', 'Leading-tone triad resolving up a semitone.', [[r + 1, MAJ]]);
      add('dominant', 1, 'vii° → i', 'Same, into minor.', [[r + 1, MIN]]);
      add('dominant', 1, 'ii° → V → i', 'Minor-key predominant.', [[r + 5, '7'], [r + 10, 'm']]);
    }

    if (f === 'dim7') {
      var LABEL = { 0: '', 3: ' (respelled up a m3)', 6: ' (respelled up a tritone)', 9: ' (respelled down a m3)' };
      [0, 3, 6, 9].forEach(function (k) {
        var rk = k ? relName(rootNm, k, { 3: 3, 6: 5, 9: 6 }[k], 'dim7') : rootNm; // respelled root
        var tMaj = relName(rk, 1, 2, MAJ), tMin = relName(rk, 1, 2, MIN);
        var as = k ? ' — as ' + rk + 'dim7' : '';
        add('dominant', k === 0 ? 1 : 2, 'Leading-tone: up a semitone to major' + LABEL[k], 'Any note of a dim7 can act as leading tone (it is a rootless V7b9)' + as + '.', [[r + k + 1, MAJ, null, tMaj]]);
        add('dominant', k === 0 ? 1 : 2, 'Leading-tone: up a semitone to minor' + LABEL[k], 'Classical vii°7 → i resolution' + as + '.', [[r + k + 1, MIN, null, tMin]]);
      });
      add('passing', 2, '#ii°7 → I (common-tone)', 'Common-tone diminished: shares the target\'s root.', [[r + 9, MAJ, 7]]);
      add('passing', 2, '#iv°7 → I/5 (common-tone)', 'Gospel/blues: the dim7 a tritone above the tonic, into I in second inversion.', [[r + 6, 'maj', 5]]);
      add('passing', 3, 'I°7 → I (same root)', 'Common-tone embellishment over a pedal.', [[r, MAJ]]);
      add('passing', 2, 'Descending passing: down a semitone to minor', 'biii°7 → ii (Eb°7 → Dm).', [[r + 11, MIN]]);
      add('cycles', 3, 'Minor-3rd shift (same chord)', 'dim7 repeats every 3 frets — slide it for tension.', [[r + 3, 'dim7']]);
    }

    if (f === 'aug') {
      add('dominant', 1, 'V+ → I (down a 5th)', 'Augmented dominant: #5 rises to the target\'s 3rd.', [[r + 5, MAJ]]);
      add('dominant', 2, 'V+ → I (respelled ×2)', 'Symmetric: the same notes are also V+ of two other keys.', [[r + 9, MAJ]]);
      add('dominant', 2, 'V+ → I (respelled ×3)', 'Third possible resolution.', [[r + 1, MAJ]]);
      add('passing', 2, 'aug → major (lower the #5)', 'One voice moves a semitone (Weitzmann region).', [[r, 'maj']]);
      add('passing', 2, 'aug → relative minor (#5 → 6)', 'The #5 rises a semitone (C+ → Am).', [[r + 9, 'm']]);
      add('passing', 2, 'aug → minor a 4th up', 'The 3rd rises a semitone; the #5 becomes the minor 3rd (C+ → Fm).', [[r + 5, 'm']]);
      add('passing', 3, 'aug → minor a semitone up', 'Root rises a semitone (C+ → C#m).', [[r + 1, 'm', 1]]);
      add('passing', 3, 'aug → major a M3 up / down', 'Symmetric respellings (C+ → E, C+ → Ab).', [[r + 4, 'maj']]);
      add('passing', 2, 'I+ → I6 (line cliché)', 'The #5 continues up to the 6th.', [[r, '6']]);
      add('cycles', 3, 'Augmented planing (whole tones)', 'Augmented triads slide by whole steps without changing scale.', [[r + 2, 'aug']]);
    }

    if (qid === 'b5') {
      add('dominant', 2, 'II(b5) → V7', 'Sounds like a French augmented sixth: resolves down a 5th.', [[r + 5, '7']]);
      add('dominant', 2, 'V(b5) → I', 'Dominant with flat 5th → resolve a 5th down.', [[r + 5, MAJ]]);
      add('dominant', 3, 'subV(b5) → I', 'Down a semitone.', [[r + 11, MAJ]]);
    }
    return M;
  }

  /* ------------------------------------------------------------------ */
  /*  APPROACH: chords that lead INTO the chosen chord                   */
  /* ------------------------------------------------------------------ */
  function approachMoves(pc, qid, level, rootNm) {
    var q = Q[qid], f = q.fam, r = pc, out = [], L = level;
    rootNm = rootNm && pcOfName(rootNm) === mod(pc) ? rootNm : rootName(pc, qid);
    function add(tier, label, why, steps) {
      out.push({ tier: tier, label: label, why: why, steps: steps.map(function (s) { return s[1] === 'self' ? ch(s[0], qid, rootNm) : ch(s[0], s[1], relName(rootNm, s[0] - r, s[2], s[1])); }) });
    }
    var isMinor = f === 'minor' || qid === 'm';
    var isMajor = f === 'major' || f === 'power' || f === 'sus';
    var isDom = f === 'dominant';
    if (isMajor || isMinor || isDom) {
      add(1, 'V7 → it (perfect cadence)', 'Its own dominant, a 5th above.', [[r + 7, isMinor ? '7b9' : '7'], [r, 'self']]);
      add(1, (isMinor ? 'iiø7 – V7' : 'ii7 – V7') + ' → it', 'Full two-five into it.', [[r + 2, isMinor ? 'm7b5' : 'm7'], [r + 7, isMinor ? '7b9' : '7'], [r, 'self']]);
      add(2, 'subV7 → it (tritone sub)', 'Dominant a half step above, resolving down.', [[r + 1, '7'], [r, 'self']]);
      add(2, 'vii°7 → it', 'Leading-tone diminished a half step below.', [[r + 11, 'dim7'], [r, 'self']]);
      add(isMajor ? 1 : 2, (isMajor ? 'IV' : 'iv') + ' → it (plagal)', 'Plagal approach from a 4th above.', [[r + 5, isMajor ? 'maj' : 'm'], [r, 'self']]);
      add(2, 'V7sus4 → V7 → it', 'Suspended dominant first.', [[r + 7, '7sus4'], [r + 7, '7'], [r, 'self']]);
    }
    if (isMajor) {
      add(1, 'iv → it (minor plagal)', 'Borrowed minor four into the major chord.', [[r + 5, 'm'], [r, 'self']]);
      add(2, 'iv7 – bVII7 → it (backdoor)', 'Backdoor two-five.', [[r + 5, 'm7'], [r + 10, '7'], [r, 'self']]);
      add(2, 'bVI – bVII → it ("Mario" / Aeolian cadence)', 'Two borrowed majors climbing to it.', [[r + 8, 'maj'], [r + 10, 'maj'], [r, 'self']]);
      add(2, 'bVII → it (Mixolydian cadence)', 'Whole-step rise.', [[r + 10, 'maj'], [r, 'self']]);
      add(3, '#ii°7 → it (common-tone dim)', 'Embellishing diminished.', [[r + 3, 'dim7', 2], [r, 'self']]);
      add(3, 'II → it (Lydian)', 'Lydian shuttle back.', [[r + 2, 'maj'], [r, 'self']]);
      add(3, 'bII → it (Phrygian-dominant cadence)', 'Flamenco semitone fall.', [[r + 1, 'maj'], [r, 'self']]);
      add(4, 'bIII7 – bVI – VII7 – III – V7 → it (Coltrane)', 'Arrive through the major-3rd cycle.', [[r + 3, '7'], [r + 8, 'maj7'], [r + 11, '7'], [r + 4, 'maj7'], [r + 7, '7'], [r, 'self']]);
    }
    if (isMinor) {
      add(1, 'bVI – bVII → it (Aeolian cadence)', 'Rock/metal climb into minor.', [[r + 8, 'maj'], [r + 10, 'maj'], [r, 'self']]);
      add(1, 'bVII – bVI – V → it (Andalusian)', 'Descending flamenco tetrachord.', [[r + 10, 'maj'], [r + 8, 'maj'], [r + 7, 'maj'], [r, 'self']]);
      add(2, 'bII → it (Phrygian)', 'Semitone fall from a major chord above.', [[r + 1, 'maj'], [r, 'self']]);
      add(2, 'bII – V7 → it (Neapolitan)', 'Neapolitan predominant.', [[r + 1, 'maj'], [r + 7, '7'], [r, 'self']]);
      add(3, 'bVI7 (Ger+6) – V → it', 'Augmented-sixth sound into the dominant.', [[r + 8, '7'], [r + 7, 'maj'], [r, 'self']]);
      add(2, 'IV → it (Dorian)', 'Dorian shuttle back.', [[r + 5, 'maj'], [r, 'self']]);
    }
    if (f === 'dominant') {
      add(1, 'ii7 → it', 'Minor seventh a 5th above sets up the dominant.', [[r + 7, 'm7'], [r, 'self']]);
    }
    if (f === 'hdim' || f === 'dim' || f === 'dim7') {
      add(2, 'Half step below → it (rising passing)', 'The bass climbs a semitone into the diminished chord, which then rises again (e.g. C → C#°7 → Dm).', [[r + 11, 'maj', 1], [r, 'self']]);
      add(2, 'Half step above → it (falling passing)', 'The bass falls a semitone through the diminished chord (e.g. Em → Eb°7 → Dm).', [[r + 1, 'm', 2], [r, 'self']]);
      if (f === 'dim') add(2, 'IV → vii° (diatonic)', 'Inside a major key the subdominant moves naturally to the leading-tone triad (F → B°).', [[r + 6, 'maj', 5], [r, 'self']]);
      if (f === 'hdim') add(1, 'i → iiø7 (minor key)', 'The minor tonic steps up to its ii chord, which then heads to V (Am → Bø7 → E7).', [[r + 10, 'm', 7], [r, 'self']]);
    }
    if (f === 'aug') add(2, 'I → I+', 'Augmented chords usually grow out of the major triad on the same root.', [[r, 'maj'], [r, 'self']]);
    return out;
  }

  /* ------------------------------------------------------------------ */
  /*  PROGRESSION LIBRARY                                                */
  /*  slots: [offsetFromTonic, fam]; sys picks the scale for stacking    */
  /* ------------------------------------------------------------------ */
  // slot codes: MAJ / MIN / DOM (diatonic quality at the chosen level), MAJ7 / MIN7 / DOM7 (always a 7th-type),
  // HDIM, DIM7, TMAJ / TMIN (always plain triads), q:<id> (exact quality). Optional 3rd item = scale-degree hint for spelling.
  var PROGS = [
    ['Axis / "4-chord" pop', 'major', [[0, 'MAJ'], [7, 'DOM'], [9, 'MIN'], [5, 'MAJ']], 1, 'I–V–vi–IV: the most common 4-chord progression in Hooktheory\'s song data.'],
    ['50s / doo-wop', 'major', [[0, 'MAJ'], [9, 'MIN'], [5, 'MAJ'], [7, 'DOM']], 1, 'I–vi–IV–V.'],
    ['Axis, minor start', 'major', [[9, 'MIN'], [5, 'MAJ'], [0, 'MAJ'], [7, 'DOM']], 1, 'vi–IV–I–V.'],
    ['ii–V–I', 'major', [[2, 'MIN'], [7, 'DOM'], [0, 'MAJ']], 1, 'The jazz cadence.'],
    ['Turnaround (rhythm changes)', 'major', [[0, 'MAJ'], [9, 'MIN'], [2, 'MIN'], [7, 'DOM']], 1, 'I–vi–ii–V.'],
    ['I–IV–V–I', 'major', [[0, 'MAJ'], [5, 'MAJ'], [7, 'DOM'], [0, 'MAJ']], 1, 'Classic three-chord song.'],
    ['Royal Road (J-pop)', 'major', [[5, 'MAJ'], [7, 'DOM'], [4, 'MIN'], [9, 'MIN']], 2, 'IVmaj7–V7–iii7–vi.'],
    ['Pachelbel\'s Canon', 'major', [[0, 'MAJ'], [7, 'DOM'], [9, 'MIN'], [4, 'MIN'], [5, 'MAJ'], [0, 'MAJ'], [5, 'MAJ'], [7, 'DOM']], 2, 'I–V–vi–iii–IV–I–IV–V.'],
    ['Circle of fifths', 'major', [[4, 'MIN'], [9, 'MIN'], [2, 'MIN'], [7, 'DOM'], [0, 'MAJ']], 2, 'iii–vi–ii–V–I.'],
    ['Full diatonic circle', 'major', [[0, 'MAJ'], [5, 'MAJ'], [11, 'HDIM'], [4, 'MIN'], [9, 'MIN'], [2, 'MIN'], [7, 'DOM'], [0, 'MAJ']], 2, 'I–IV–vii–iii–vi–ii–V–I.'],
    ['Passing-diminished turnaround', 'major', [[0, 'MAJ'], [1, 'DIM7', 1], [2, 'MIN'], [7, 'DOM']], 2, 'I–#i°7–ii–V.'],
    ['Rock / Mixolydian', 'major', [[0, 'MAJ'], [10, 'MAJ'], [5, 'MAJ'], [0, 'MAJ']], 1, 'I–bVII–IV–I.'],
    ['"Mario" / Aeolian cadence', 'major', [[8, 'MAJ'], [10, 'MAJ'], [0, 'MAJ']], 2, 'bVI–bVII–I.'],
    ['Minor plagal', 'major', [[5, 'MAJ'], [5, 'MIN'], [0, 'MAJ']], 2, 'IV–iv–I.'],
    ['"Creep" progression', 'major', [[0, 'TMAJ'], [4, 'TMAJ'], [5, 'TMAJ'], [5, 'TMIN']], 3, 'I–III–IV–iv.'],
    ['Backdoor', 'major', [[5, 'MIN7'], [10, 'DOM7'], [0, 'MAJ']], 3, 'iv7–bVII7–I.'],
    ['Tritone ii–V', 'major', [[2, 'MIN'], [1, 'DOM7'], [0, 'MAJ']], 3, 'ii–bII7–I.'],
    ['12-bar blues (core moves)', 'major', [[0, 'DOM7'], [5, 'DOM7'], [0, 'DOM7'], [7, 'DOM7'], [5, 'DOM7'], [0, 'DOM7']], 1, 'I7–IV7–I7–V7–IV7–I7.'],
    ['Lydian shuttle', 'major', [[0, 'MAJ'], [2, 'MAJ']], 3, 'I–II.'],
    ['Coltrane changes', 'major', [[0, 'MAJ7'], [3, 'DOM7'], [8, 'MAJ7'], [11, 'DOM7'], [4, 'MAJ7'], [7, 'DOM7'], [0, 'MAJ7']], 4, 'I–bIII7–bVI–VII7–III–V7–I.'],
    ['Hexatonic (PL) cycle', 'major', [[0, 'TMAJ'], [0, 'TMIN'], [8, 'TMAJ'], [8, 'TMIN'], [4, 'TMAJ'], [4, 'TMIN']], 4, 'Alternating P and L: one note moves each step.'],
    ['Octatonic (PR) cycle', 'major', [[0, 'TMAJ'], [0, 'TMIN'], [3, 'TMAJ'], [3, 'TMIN'], [6, 'TMAJ'], [6, 'TMIN'], [9, 'TMAJ'], [9, 'TMIN']], 4, 'Alternating P and R.'],
    ['Major-3rd (augmented) cycle', 'major', [[0, 'TMAJ'], [4, 'TMAJ'], [8, 'TMAJ'], [0, 'TMAJ']], 4, 'I–III–bVI–I, the tonal axis of Giant Steps.'],
    ['Minor axis', 'minor', [[0, 'MIN'], [8, 'MAJ'], [3, 'MAJ'], [10, 'MAJ']], 1, 'i–bVI–bIII–bVII.'],
    ['Andalusian cadence', 'minor', [[0, 'MIN'], [10, 'MAJ'], [8, 'MAJ'], [7, 'DOM']], 1, 'i–bVII–bVI–V.'],
    ['Minor cadence', 'minor', [[0, 'MIN'], [5, 'MIN'], [7, 'DOM'], [0, 'MIN']], 1, 'i–iv–V–i.'],
    ['Minor ii–V–i', 'minor', [[2, 'HDIM'], [7, 'DOM7'], [0, 'MIN']], 1, 'iiø7–V7–i.'],
    ['Aeolian shuttle', 'minor', [[0, 'MIN'], [10, 'MAJ'], [8, 'MAJ'], [10, 'MAJ']], 2, 'i–bVII–bVI–bVII.'],
    ['Minor line cliché', 'minor', [[0, 'q:m'], [0, 'q:mMaj7'], [0, 'q:m7'], [0, 'q:m6']], 2, 'i–i(maj7)–i7–i6.'],
    ['i–bIII–bVII', 'minor', [[0, 'MIN'], [3, 'MAJ'], [10, 'MAJ'], [0, 'MIN']], 2, 'e.g. "Jolene" (i–bIII–bVII–i).'],
    ['Dorian shuttle', 'dorian', [[0, 'MIN'], [5, 'MAJ']], 2, 'i–IV.'],
    ['Phrygian vamp', 'phrygian', [[0, 'MIN'], [1, 'MAJ'], [0, 'MIN']], 3, 'i–bII–i.'],
    ['Flamenco cadence', 'phrygdom', [[5, 'MIN'], [1, 'MAJ'], [0, 'MAJ']], 3, 'iv–bII–I over a major tonic.'],
    ['Mixolydian double plagal', 'mixolydian', [[10, 'MAJ'], [5, 'MAJ'], [0, 'MAJ']], 2, 'bVII–IV–I.']
  ];
  var SLOT_FAM = { MAJ: 'major', MIN: 'minor', DOM: 'dominant', DOM7: 'dominant', HDIM: 'hdim', DIM7: 'dim7', MAJ7: 'major', MIN7: 'minor' };
  var SLOT_LEVELFAM = { MAJ: 'maj', MIN: 'min', DOM: 'dom', DOM7: 'dom7', HDIM: 'hdim', DIM7: 'dim7', MAJ7: 'maj7', MIN7: 'm7' };

  function slotQuality(sys, off, code, level) {
    if (code.indexOf('q:') === 0) return code.slice(2);
    if (code === 'TMAJ') return 'maj';
    if (code === 'TMIN') return 'm';
    if (code === 'MAJ' || code === 'MIN' || code === 'DOM') {
      var scale = SCALES[sys === 'minor' ? (code === 'DOM' ? 'harmonic' : 'natural') : sys];
      var st = scale.indexOf(off) >= 0 ? stackQuality(scale, off, level) : null;
      if (st && Q[st].fam === SLOT_FAM[code]) return st;
      if (st && code === 'DOM' && st === 'maj') return st;
    }
    return famQ(SLOT_LEVELFAM[code], level);
  }

  function slotMatches(qid, code) {
    var q = Q[qid], qf = q.fam;
    if (code.indexOf('q:') === 0) return code.slice(2) === qid;
    if (code === 'TMAJ') return qid === 'maj' || qf === 'power';
    if (code === 'TMIN') return qid === 'm' || qf === 'power';
    if (qf === SLOT_FAM[code]) return true;
    if (qid === 'maj' && code === 'DOM') return true;
    if ((qf === 'sus' || qf === 'power') && (code === 'MAJ' || code === 'DOM')) return true;
    if (qf === 'power' && code === 'MIN') return true;
    if (qf === 'dim' && (code === 'HDIM' || code === 'DIM7')) return true;
    return false;
  }

  function progressionsFor(pc, qid, level, rootNm) {
    rootNm = rootNm && pcOfName(rootNm) === mod(pc) ? rootNm : rootName(pc, qid);
    var out = [];
    PROGS.forEach(function (p) {
      var name = p[0], sys = p[1], slots = p[2];
      var tonics = {};
      slots.forEach(function (s, i) {
        if (slotMatches(qid, s[1])) { var t = mod(pc - s[0]); (tonics[t] = tonics[t] || []).push(i); }
      });
      Object.keys(tonics).forEach(function (tk) {
        var t = +tk;
        var tonicQ = sys === 'minor' || sys === 'dorian' || sys === 'phrygian' ? 'm' : 'maj';
        var firstSlot = slots[tonics[t][0]];
        var tonicNm = tonicNameFor(rootNm, firstSlot[0], tonicQ, t);
        var chords = slots.map(function (s, i) {
          if (tonics[t].indexOf(i) >= 0) return ch(pc, qid, rootNm);
          var qq = slotQuality(sys, s[0], s[1], level);
          return ch(t + s[0], qq, relName(tonicNm, s[0], s[2], qq));
        });
        out.push({ name: name, tier: p[3], key: tonicNm + ' ' + SYS_LABEL[sys], roman: p[4],
          chords: chords.map(function (c) { return c.sym; }), steps: chords, highlight: tonics[t] });
      });
    });
    out.sort(function (a, b) { return a.tier - b.tier; });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /*  GUITAR VOICINGS                                                    */
  /* ------------------------------------------------------------------ */
  var OPEN_STR = [4, 9, 2, 7, 11, 4]; // E A D G B E (low → high)
  var OPEN_MIDI = [40, 45, 50, 55, 59, 64];
  var X = null;
  var SHAPE_E = {
    maj: [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0], maj7: [0, X, 1, 1, 0, X],
    m7b5: [0, X, 0, 0, -1, X], dim7: [0, X, -1, 0, -1, X], '6': [0, X, -1, 1, 0, X], m6: [0, X, -1, 0, 0, X], '9': [0, X, 0, 1, 0, 2],
    '13': [0, X, 0, 1, 2, X], sus4: [0, 2, 2, 2, 0, 0], '7sus4': [0, 2, 0, 2, 0, 0], aug: [0, X, 2, 1, 1, 0], dim: [0, 1, 2, 0, X, X],
    '5': [0, 2, 2, X, X, X], maj9: [0, X, 1, 1, 0, 2], m9: [0, X, 0, 0, 0, 2], add9: [0, X, 2, 1, 0, 2], madd9: [0, X, 2, 0, 0, 2],
    mMaj7: [0, X, 1, 0, 0, X], '7b9': [0, X, 0, 1, 0, 1], '7b5': [0, X, 0, 1, -1, X], '7#11': [0, X, 0, 1, -1, X],
    'maj7#11': [0, X, 1, 1, -1, X], aug7: [0, X, 0, 1, 1, X], 'maj7#5': [0, X, 1, 1, 1, X], '11': [0, X, 0, 2, 0, 2],
    maj13: [0, X, 1, 1, 2, 2], '7alt': [0, X, 0, 1, 1, 3], '7#9': [0, X, 0, 1, X, 3]
  };
  var SHAPE_A = {
    maj: [X, 0, 2, 2, 2, 0], m: [X, 0, 2, 2, 1, 0], '7': [X, 0, 2, 0, 2, 0], m7: [X, 0, 2, 0, 1, 0], maj7: [X, 0, 2, 1, 2, 0],
    m7b5: [X, 0, 1, 0, 1, X], dim7: [X, 0, 1, -1, 1, X], '6': [X, 0, 2, 2, 2, 2], m6: [X, 0, 2, -1, 1, X], '9': [X, 0, -1, 0, 0, 0],
    m9: [X, 0, -2, 0, 0, 0], maj9: [X, 0, -1, 1, 0, X], '13': [X, 0, -1, 0, 2, 2], '7#9': [X, 0, -1, 0, 1, X], '7b9': [X, 0, -1, 0, -1, X],
    '7alt': [X, 0, -1, 0, 1, 1], '11': [X, 0, 0, 0, 0, 0], m11: [X, 0, 0, 0, 1, 0], sus2: [X, 0, 2, 2, 0, 0], sus4: [X, 0, 2, 2, 3, 0],
    '7sus4': [X, 0, 2, 0, 3, 0], '69': [X, 0, -1, -1, 0, 0], mMaj7: [X, 0, 2, 1, 1, 0], aug: [X, 0, -1, -2, -2, X], dim: [X, 0, 1, 2, 1, X],
    '5': [X, 0, 2, 2, X, X], 'maj7#11': [X, 0, 1, 1, 2, X], '7#11': [X, 0, 1, 0, 2, X], '7b5': [X, 0, 1, 0, 2, X], aug7: [X, 0, X, 0, 2, 1],
    'maj7#5': [X, 0, -1, 1, 2, 1], maj13: [X, 0, -1, 1, 2, 2]
  };
  var OPEN = {
    'C:maj': 'x32010', 'C:maj7': 'x32000', 'C:7': 'x32310', 'C:add9': 'x32030', 'C:6': 'x32210', 'C:sus4': 'x33011', 'C:sus2': 'x30013', 'C:aug': 'x32110',
    'D:maj': 'xx0232', 'D:m': 'xx0231', 'D:7': 'xx0212', 'D:m7': 'xx0211', 'D:maj7': 'xx0222', 'D:sus2': 'xx0230', 'D:sus4': 'xx0233', 'D:6': 'xx0202',
    'D:m6': 'xx0201', 'D:7sus4': 'xx0213', 'D:5': 'xx023x',
    'E:maj': '022100', 'E:m': '022000', 'E:7': '020100', 'E:m7': '022030', 'E:maj7': '021100', 'E:sus4': '022200', 'E:7sus4': '020200',
    'E:m9': '022032', 'E:add9': '024100', 'E:5': '022xxx', 'E:6': '022120', 'E:m6': '022020', 'E:7#9': '076780',
    'F:maj7': 'xx3210', 'F:maj': 'xx3211',
    'G:maj': '320003', 'G:7': '320001', 'G:maj7': '320002', 'G:6': '320000', 'G:sus4': '330013',
    'A:maj': 'x02220', 'A:m': 'x02210', 'A:7': 'x02020', 'A:m7': 'x02010', 'A:maj7': 'x02120', 'A:sus2': 'x02200', 'A:sus4': 'x02230',
    'A:6': 'x02222', 'A:m6': 'x02212', 'A:7sus4': 'x02030', 'A:5': 'x022xx',
    'B:7': 'x21202', 'B:m7': 'x20202', 'B:dim7': 'xx0101'
  };
  function parseFrets(s) { return s.split('').map(function (c) { return c === 'x' || c === 'X' ? null : parseInt(c, 10); }); }
  function fretsToString(f) {
    var big = f.some(function (v) { return v !== null && v > 9; });
    return f.map(function (v) { return v === null ? 'x' : String(v); }).join(big ? '-' : '');
  }

  function checkVoicing(frets, pc, qid) {
    var q = Q[qid]; var chordPcs = q.pcs.map(function (i) { return mod(pc + i); });
    var sounding = [];
    for (var s = 0; s < 6; s++) if (frets[s] !== null && frets[s] !== undefined) sounding.push(mod(OPEN_STR[s] + frets[s]));
    if (!sounding.length) return false;
    if (sounding[0] !== mod(pc)) return false;
    for (var i = 0; i < sounding.length; i++) if (chordPcs.indexOf(sounding[i]) < 0) return false;
    var need = q.need.map(function (i) { return mod(pc + i); });
    for (var j = 0; j < need.length; j++) if (sounding.indexOf(need[j]) < 0) return false;
    if (qid === '7alt' && sounding.indexOf(mod(pc + 1)) < 0 && sounding.indexOf(mod(pc + 3)) < 0) return false;
    return true;
  }

  function fromShape(shape, pc, stringIdx) {
    var base = mod(pc - OPEN_STR[stringIdx]);
    var minOff = Math.min.apply(null, shape.filter(function (v) { return v !== null; }));
    if (base + minOff < 0) base += 12;
    if (base + minOff === 0 && base !== 0 && shape.filter(function (v) { return v === minOff; }).length > 0) { /* open strings ok */ }
    var f = shape.map(function (o) { return o === null ? null : base + o; });
    var max = Math.max.apply(null, f.filter(function (v) { return v !== null; }));
    if (max > 15) return null;
    return f;
  }

  function fingersNeeded(f) {
    var fretted = f.filter(function (v) { return v !== null && v > 0; });
    if (!fretted.length) return 0;
    var min = Math.min.apply(null, fretted);
    var atMin = fretted.filter(function (v) { return v === min; }).length;
    var above = fretted.length - atMin;
    return above + (atMin > 0 ? 1 : 0) + (atMin > 1 ? 0 : 0);
  }

  function searchVoicing(pc, qid, bass) {
    var q = Q[qid]; var chordPcs = q.pcs.map(function (i) { return mod(pc + i); });
    var bf = mod(pc - OPEN_STR[bass]);
    var best = null, bestScore = -1e9;
    var candidatesBass = [bf, bf + 12].filter(function (v) { return v <= 14; });
    candidatesBass.forEach(function (b) {
      for (var lo = Math.max(1, b - 3); lo <= Math.max(1, b); lo++) {
        if (b !== 0 && (b < lo || b > lo + 3)) continue;
        var opts = [];
        for (var s = 0; s < 6; s++) {
          if (s < bass) { opts.push([null]); continue; }
          if (s === bass) { opts.push([b]); continue; }
          var o = [null];
          if (chordPcs.indexOf(OPEN_STR[s]) >= 0 && lo <= 5) o.push(0);
          for (var fr = lo; fr <= lo + 3; fr++) if (chordPcs.indexOf(mod(OPEN_STR[s] + fr)) >= 0) o.push(fr);
          opts.push(o);
        }
        (function rec(s, cur) {
          if (s === 6) {
            if (!checkVoicing(cur, pc, qid)) return;
            var sound = cur.filter(function (v) { return v !== null; }).length;
            var minStrings = q.pcs.length <= 2 ? 2 : Math.min(4, q.pcs.length);
            if (sound < minStrings) return;
            var first = cur.findIndex(function (v) { return v !== null; });
            var last = 5 - cur.slice().reverse().findIndex(function (v) { return v !== null; });
            var gaps = 0; for (var k = first; k <= last; k++) if (cur[k] === null) gaps++;
            if (gaps > 1) return;
            var fing = fingersNeeded(cur); if (fing > 4) return;
            var fr2 = cur.filter(function (v) { return v !== null && v > 0; });
            var span = fr2.length ? Math.max.apply(null, fr2) - Math.min.apply(null, fr2) : 0; if (span > 3) return;
            var distinct = {}; cur.forEach(function (v, i) { if (v !== null) distinct[mod(OPEN_STR[i] + v)] = 1; });
            var score = sound * 2 - gaps * 3 - lo * 0.12 + Object.keys(distinct).length * 1.2 - span * 0.3 - fing * 0.2;
            if (q.pcs.indexOf(7) >= 0 && distinct[mod(pc + 7)]) score += 0.4;
            if (score > bestScore) { bestScore = score; best = cur.slice(); }
            return;
          }
          for (var i = 0; i < opts[s].length; i++) { cur[s] = opts[s][i]; rec(s + 1, cur); }
          cur[s] = null;
        })(0, [null, null, null, null, null, null]);
      }
    });
    return best;
  }

  var voicingCache = {};
  function voicings(pc, qid) {
    var key = mod(pc) + ':' + qid; if (voicingCache[key]) return voicingCache[key];
    var res = [], seen = {};
    function push(f, label, src) {
      if (!f) return; var k = fretsToString(f); if (seen[k]) return;
      if (!checkVoicing(f, pc, qid)) return;
      var fr = f.filter(function (v) { return v !== null && v > 0; });
      if (fr.length && (Math.max.apply(null, fr) - Math.min.apply(null, fr)) > 4) return;
      if (fingersNeeded(f) > 4 && src !== 'open') return;
      seen[k] = 1; res.push({ frets: f, tab: k, label: label, source: src });
    }
    var o = OPEN[NAME_MAJ[mod(pc)] + ':' + qid] || OPEN[NAME_MIN[mod(pc)] + ':' + qid];
    if (o) push(parseFrets(o), 'Open position', 'open');
    function pushShape(shape, s, label, src) {
      var f = fromShape(shape, pc, s); if (!f) return;
      if (seen[fretsToString(f)]) { // same as the open chord → offer the same shape an octave up instead
        var g = f.map(function (v) { return v === null ? null : v + 12; });
        if (Math.max.apply(null, g.filter(function (v) { return v !== null; })) > 17) return;
        f = g;
      }
      push(f, label, src);
    }
    if (SHAPE_E[qid]) pushShape(SHAPE_E[qid], 0, 'Root on 6th string', 'shape-E');
    if (SHAPE_A[qid]) pushShape(SHAPE_A[qid], 1, 'Root on 5th string', 'shape-A');
    var hasE = res.some(function (v) { return v.frets[0] !== null; });
    var hasA = res.some(function (v) { return v.frets[0] === null && v.frets[1] !== null; });
    if (!hasE) push(searchVoicing(pc, qid, 0), 'Root on 6th string', 'search');
    if (!hasA) push(searchVoicing(pc, qid, 1), 'Root on 5th string', 'search');
    if (res.length < 3) push(searchVoicing(pc, qid, 2), 'Root on 4th string', 'search');
    res.forEach(function (v) {
      v.midi = v.frets.map(function (fr, s) { return fr === null ? null : OPEN_MIDI[s] + fr; });
      v.notes = v.frets.map(function (fr, s) { return fr === null ? null : FLAT[mod(OPEN_STR[s] + fr)]; });
    });
    voicingCache[key] = res;
    return res;
  }

  /* ------------------------------------------------------------------ */
  /*  MAIN ANALYSIS                                                      */
  /* ------------------------------------------------------------------ */
  function analyze(pc, qid, opts) {
    opts = opts || {};
    var q = Q[qid];
    var level = opts.level === undefined || opts.level === 'auto' ? q.lvl : opts.level;
    var info = chordInfo(pc, qid, opts.name);
    var kc = keyContexts(pc, qid, level, info.root);
    var moves = chromaticMoves(pc, qid, level, info.root).filter(function (m) { return m.steps.length && !(m.steps[0].pc === info.rootPc && m.steps[0].q === qid); });
    var approach = approachMoves(pc, qid, level, info.root);
    var progs = progressionsFor(pc, qid, level, info.root);

    // merged ranking of immediate next chords
    var rank = {};
    function note(sym, pcv, qq, tier, reason) {
      if (pcv === info.rootPc && qq === qid) return;
      var key = pcv + ':' + qq;
      var e = rank[key] || (rank[key] = { to: sym, pc: pcv, q: qq, tier: 9, reasons: [], names: {} });
      e.names[sym] = (e.names[sym] || 0) + 1;
      e.tier = Math.min(e.tier, tier);
      if (e.reasons.indexOf(reason) < 0) e.reasons.push(reason);
    }
    kc.contexts.forEach(function (c) {
      // context prior: plain major-key use is the most frequent; minor-key roles other than i, and
      // harmonic/melodic-only fits, modes and exotic scales are progressively rarer.
      var bonus = c.group === 'key' ? 0 : c.group === 'mode' ? 1 : 2;
      if (c.system === 'major' && (c.offset === 4 || c.offset === 11)) bonus += 1;
      if (c.system === 'minor' && c.offset !== 0) bonus += 1;
      if (c.system === 'minor' && c.variant !== 'natural') bonus += 1;
      c.next.forEach(function (n) { note(n.to, n.pc, n.q, Math.min(4, n.tier + bonus), c.role + '→' + n.roman + ' in ' + c.key); });
    });
    moves.forEach(function (m) { var s = m.steps[0]; note(s.sym, s.pc, s.q, m.tier, m.label); });
    var ranked = Object.keys(rank).map(function (k) { return rank[k]; });
    ranked.forEach(function (e) {
      var best = null; Object.keys(e.names).forEach(function (n) { if (!best || e.names[n] > e.names[best]) best = n; });
      e.to = best; e.name = best.slice(0, best.length - Q[e.q].sym.length); delete e.names;
      e.score = (5 - e.tier) * 10 + Math.min(e.reasons.length, 8);
    });
    ranked.sort(function (a, b) { return b.score - a.score || (a.to < b.to ? -1 : 1); });

    var groups = {}; moves.forEach(function (m) { (groups[m.cat] = groups[m.cat] || []).push(m); });
    return {
      chord: info, level: level, levelName: ['triads', 'sevenths', 'extended'][level],
      voicings: voicings(pc, qid).map(function (v) { return { tab: v.tab, frets: v.frets, label: v.label, source: v.source, midi: v.midi, notes: v.notes }; }),
      keys: { core: kc.core !== qid ? kc.coreSymbol : null, contexts: kc.contexts },
      ranked: ranked,
      moves: Object.keys(CATS).filter(function (c) { return groups[c]; }).map(function (c) { return { category: c, title: CATS[c], moves: groups[c] }; }),
      approach: approach,
      progressions: progs
    };
  }

  function analyzeSymbol(str, opts) { var p = parseChord(str); return p ? analyze(p.pc, p.q, opts) : null; }

  function textReport(a) {
    var L = [];
    var c = a.chord;
    L.push(c.symbol + ' — ' + c.qualityName + '   notes: ' + c.notes.join(' ') + '   formula: ' + c.formula);
    a.voicings.forEach(function (v) { L.push('  guitar: ' + v.tab + '  (' + v.label + ')'); });
    L.push('', 'BEST NEXT CHORDS (' + a.levelName + '):');
    a.ranked.slice(0, 20).forEach(function (r) { L.push('  ' + r.to + '  [' + TIER_NAMES[Math.min(r.tier, 4)] + ']  ' + r.reasons.slice(0, 3).join('; ')); });
    L.push('', 'KEYS / MODES IT LIVES IN' + (a.keys.core ? ' (via its core ' + a.keys.core + ')' : '') + ':');
    a.keys.contexts.forEach(function (k) {
      L.push('  ' + k.role + (k.as ? ' [as ' + k.as + ']' : '') + ' in ' + k.key + (k.variant && k.variant !== 'natural' ? ' (' + k.variant + ')' : '') + '  →  ' +
        k.next.map(function (n) { return n.to + ' (' + n.roman + ')'; }).join(', '));
    });
    a.moves.forEach(function (g) {
      L.push('', g.title.toUpperCase() + ':');
      g.moves.forEach(function (m) { L.push('  ' + m.steps.map(function (s) { return s.sym; }).join(' → ') + '   [' + TIER_NAMES[m.tier] + '] ' + m.label); });
    });
    L.push('', 'APPROACH (what leads into ' + c.symbol + '):');
    a.approach.forEach(function (m) { L.push('  ' + m.steps.map(function (s) { return s.sym; }).join(' → ') + '   ' + m.label); });
    L.push('', 'PROGRESSIONS CONTAINING IT:');
    a.progressions.forEach(function (p) { L.push('  ' + p.name + ' in ' + p.key + ': ' + p.chords.join(' – ')); });
    return L.join('\n');
  }

  function buildAll(opts) {
    var out = { meta: { generator: 'chord-engine.js', tiers: TIER_NAMES, qualities: QLIST.map(function (q) { return { id: q.id, symbol: q.sym, name: q.name, family: q.fam, formula: q.iv.map(function (iv) { return intervalLabel(q, iv); }).join(' ') }; }) }, chords: {} };
    for (var p = 0; p < 12; p++) QLIST.forEach(function (q) {
      var a = analyze(p, q.id, opts);
      out.chords[a.chord.symbol] = {
        quality: q.id, root: a.chord.root, notes: a.chord.notes, formula: a.chord.formula,
        guitar: a.voicings.map(function (v) { return v.tab; }),
        keys: a.keys.contexts.map(function (k) { return { key: k.key + (k.variant && k.variant !== 'natural' ? ' (' + k.variant + ')' : ''), role: k.role + (k.as ? ' (as ' + k.as + ')' : ''), next: k.next.map(function (n) { return [n.to, n.roman, n.tier]; }) }; }),
        next: a.ranked.map(function (r) { return [r.to, r.tier, r.reasons.slice(0, 4)]; }),
        moves: a.moves.reduce(function (acc, g) { return acc.concat(g.moves.map(function (m) { return [g.category, m.tier, m.label, m.steps.map(function (s) { return s.sym; })]; })); }, []),
        approach: a.approach.map(function (m) { return [m.tier, m.label, m.steps.map(function (s) { return s.sym; })]; }),
        progressions: a.progressions.map(function (pr) { return [pr.name, pr.key, pr.chords]; })
      };
    });
    return out;
  }

  var api = {
    QUALITIES: QLIST, Q: Q, SCALES: SCALES, NAME_MAJ: NAME_MAJ, NAME_MIN: NAME_MIN, TIER_NAMES: TIER_NAMES, CATS: CATS,
    OPEN_STR: OPEN_STR, OPEN_MIDI: OPEN_MIDI,
    mod: mod, symbol: symbol, rootName: rootName, chordInfo: chordInfo, parseChord: parseChord, stackQuality: stackQuality,
    romanFor: romanFor, keyContexts: keyContexts, chromaticMoves: chromaticMoves, approachMoves: approachMoves,
    progressionsFor: progressionsFor, voicings: voicings, checkVoicing: checkVoicing, parseFrets: parseFrets,
    analyze: analyze, analyzeSymbol: analyzeSymbol, textReport: textReport, buildAll: buildAll,
    PROGS: PROGS, SYS_LABEL: SYS_LABEL, slotQuality: slotQuality, relName: relName, tonicNameFor: tonicNameFor,
    pcOfName: pcOfName, ch: ch, fitsScale: fitsScale, intervalLabel: intervalLabel
  };

  // Node CLI
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    var args = process.argv.slice(2);
    if (args[0] === '--all') { // one chord per line → easy to grep: grep '^"Cmaj7"' chords.json
      var all = buildAll({});
      var lines = Object.keys(all.chords).map(function (k) { return JSON.stringify(k) + ':' + JSON.stringify(all.chords[k]); });
      process.stdout.write('{"meta":' + JSON.stringify(all.meta) + ',\n"chords":{\n' + lines.join(',\n') + '\n}}\n');
    }
    else if (args.length) {
      var lvlArg = args.indexOf('--level'); var lv = lvlArg >= 0 ? +args[lvlArg + 1] : undefined;
      var a = analyzeSymbol(args[0], { level: lv });
      if (!a) { console.error('Unknown chord: ' + args[0]); process.exit(1); }
      console.log(args.indexOf('--json') >= 0 ? JSON.stringify(a, null, 2) : textReport(a));
    } else console.log('usage: node chord-engine.js <chord> [--json] [--level 0|1|2] | --all');
  }
  return api;
});
