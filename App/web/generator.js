/*!
 * generator.js — turns any set of chords into playable progression options.
 * Uses chord-engine.js for every musical judgement (next-chord tiers, keys, spelling).
 * Works in the browser (window.ProgGen) and in Node (require) for testing.
 */
(function (root, factory) {
  var E = typeof module === 'object' && module.exports ? require('./chord-engine.js') : root.ChordEngine;
  var api = factory(E);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.ProgGen = api;
})(this, function (E) {
  'use strict';
  var mod = E.mod, Q = E.Q;

  /* ---------------- basic chord helpers ---------------- */
  function mk(pc, q, name) {
    var c = E.ch(pc, q, name);
    return { pc: c.pc, q: c.q, name: c.name, sym: c.sym };
  }
  function same(a, b) { return a.pc === b.pc && a.q === b.q; }
  // coarse class: M major, D dominant, m minor, d diminished, A augmented, S sus, P power
  function cls(q) {
    var f = Q[q].fam;
    return { major: 'M', dominant: 'D', minor: 'm', dim: 'd', hdim: 'd', dim7: 'd', aug: 'A', sus: 'S', power: 'P', other: 'D' }[f] || 'M';
  }
  function compatible(qa, qb) {
    var a = cls(qa), b = cls(qb);
    if (a === b) return true;
    var pair = a + b;
    return /^(MD|DM|PM|MP|Pm|mP|PD|DP|SM|MS|SD|DS)$/.test(pair);
  }
  function corePcs(c) { // triad + 6th/7th, no upper extensions
    return Q[c.q].iv.filter(function (i) { return i < 12; }).map(function (i) { return mod(c.pc + i); });
  }
  function allPcs(c) { return Q[c.q].pcs.map(function (i) { return mod(c.pc + i); }); }

  /* ---------------- analysis cache ---------------- */
  var cache = {};
  function an(c) {
    var k = c.pc + ':' + c.q;
    return cache[k] || (cache[k] = E.analyze(c.pc, c.q, { level: 'auto', name: c.name }));
  }
  var TIER_PTS = { 1: 10, 2: 7, 3: 4.5, 4: 2.5 };

  // How natural is the move a → b?  {score 0-12, tier, why}
  var tcache = {};
  function trans(a, b) {
    var key = a.pc + ':' + a.q + '>' + b.pc + ':' + b.q;
    if (tcache[key]) return tcache[key];
    var res;
    if (same(a, b)) res = { score: 3, tier: 2, why: 'Same chord repeated: lets the harmony breathe.' };
    else {
      var best = null, bestPts = 0;
      an(a).ranked.forEach(function (r) {
        if (r.pc !== b.pc) return;
        var pts = 0;
        if (r.q === b.q) pts = TIER_PTS[Math.min(4, r.tier)];
        else if (compatible(r.q, b.q)) pts = TIER_PTS[Math.min(4, r.tier)] - 1.5;
        if (pts > bestPts) { bestPts = pts; best = r; }
      });
      // common tones help a little either way
      var pa = allPcs(a), pb = allPcs(b), common = pb.filter(function (x) { return pa.indexOf(x) >= 0; }).length;
      var rootMove = mod(b.pc - a.pc);
      var bonus = common * 0.35 + (rootMove === 5 ? 0.8 : 0);
      if (best) res = { score: bestPts + bonus, tier: best.tier, why: describeReason(best.reasons[0]) };
      else res = { score: Math.min(2.4, bonus), tier: 5, why: roughWhy(a, b, common) };
      // textbook floors the ranking can understate
      var ka = cls(a.q), kb = cls(b.q);
      if ((ka === 'D' || ka === 'S' && Q[a.q].fam === 'dominant') && rootMove === 5 && /[MmD]/.test(kb) && res.score < 9.5)
        res = { score: 9.5, tier: 1, why: 'Dominant falling a 5th (V7 → ' + (kb === 'm' ? 'i' : 'I') + '): the strongest resolution in tonal music.' };
      else if (ka === 'd' && rootMove === 1 && /[Mm]/.test(kb) && res.score < 8.5)
        res = { score: 8.5, tier: 1, why: 'Diminished chord resolving up a semitone, like a leading tone to its home.' };
      else if (rootMove === 5 && res.score < 6)
        res = { score: 6, tier: 2, why: res.why.indexOf('Unusual') === 0 ? 'Root falls a 5th (circle-of-fifths motion): natural and directional, even with the colour change.' : res.why };
    }
    tcache[key] = res; return res;
  }
  function describeReason(r) { return r ? r.replace(/\s+/g, ' ') : ''; }
  function roughWhy(a, b, common) {
    var iv = mod(b.pc - a.pc);
    var names = { 0: 'same root, new colour', 1: 'root slides up a semitone', 2: 'root steps up a tone', 3: 'root jumps up a minor 3rd', 4: 'root jumps up a major 3rd',
      5: 'root moves up a 4th', 6: 'root jumps a tritone', 7: 'root moves up a 5th', 8: 'root drops a major 3rd', 9: 'root drops a minor 3rd', 10: 'root drops a tone', 11: 'root slides down a semitone' };
    return 'Unusual move (' + names[iv] + (common ? ', ' + common + ' shared note' + (common > 1 ? 's' : '') : ', no shared notes') + ') — it surprises the ear.';
  }

  /* ---------------- key detection ---------------- */
  var KEYSYS = [
    { sys: 'major', scales: ['major'], tq: 'maj' },
    { sys: 'minor', scales: ['natural', 'harmonic'], tq: 'm' }
  ];
  function fitsKey(c, t, ks) {
    var p = corePcs(c);
    return ks.scales.some(function (s) { return E.fitsScale(p, E.SCALES[s], t); });
  }
  function detectKey(chords) {
    var best = null;
    for (var t = 0; t < 12; t++) KEYSYS.forEach(function (ks) {
      var fit = 0, tonicHere = false;
      chords.forEach(function (c) {
        if (fitsKey(c, t, ks)) fit++;
        if (c.pc === t && (cls(c.q) === (ks.tq === 'm' ? 'm' : 'M') || (ks.tq === 'maj' && cls(c.q) === 'D' && false))) tonicHere = true;
      });
      var hasV = chords.some(function (c) { return c.pc === mod(t + 7) && /[MD]/.test(cls(c.q)); });
      var hasIV = chords.some(function (c) { return c.pc === mod(t + 5); });
      var score = fit * 3 + (tonicHere ? 2.5 : 0) + (hasV ? 1 : 0) + (hasIV ? 0.5 : 0) + (ks.sys === 'major' ? 0.2 : 0) +
        (chords[0] && chords[0].pc === t ? 0.6 : 0);
      if (!best || score > best.score) best = { score: score, tonic: t, sys: ks.sys, tq: ks.tq, fit: fit, ks: ks };
    });
    var tonicChord = chords.filter(function (c) { return c.pc === best.tonic && cls(c.q) === (best.tq === 'm' ? 'm' : 'M'); })[0];
    var tonicName = tonicChord ? tonicChord.name : E.rootName(best.tonic, best.tq);
    return { tonic: best.tonic, sys: best.sys, name: tonicName + ' ' + best.sys, tonicName: tonicName, fit: best.fit, total: chords.length,
      tonicChord: tonicChord || null, ks: best.ks };
  }
  function roleIn(c, key) {
    var off = mod(c.pc - key.tonic);
    var r = E.romanFor(off, c.q);
    // nicer accidentals for degrees that are diatonic in this key
    var dia = key.sys === 'major' ? { 2: 'II', 4: 'III', 9: 'VI', 11: 'VII' } : { 3: 'bIII', 8: 'bVI', 10: 'bVII', 2: 'II', 7: 'V' };
    void dia;
    return { roman: r, diatonic: fitsKey(c, key.tonic, key.ks), off: off };
  }

  /* ---------------- ordering ---------------- */
  function permutations(n) {
    var out = [], a = [], used = [];
    (function rec() {
      if (a.length === n) { out.push(a.slice()); return; }
      for (var i = 0; i < n; i++) if (!used[i]) { used[i] = 1; a.push(i); rec(); a.pop(); used[i] = 0; }
    })();
    return out;
  }
  function flow(seq, loop) {
    var s = 0;
    for (var i = 0; i < seq.length - 1; i++) s += trans(seq[i], seq[i + 1]).score;
    if (loop && seq.length > 2) s += trans(seq[seq.length - 1], seq[0]).score * 0.7;
    return s;
  }
  function voiceDist(a, b) { // smallest total semitone movement, each note of b from its nearest note of a
    var pa = corePcs(a), pb = corePcs(b), d = 0;
    pb.forEach(function (x) { var m = 12; pa.forEach(function (y) { var k = Math.abs(x - y); k = Math.min(k, 12 - k); if (k < m) m = k; }); d += m; });
    return d / pb.length;
  }
  function vlCost(seq, loop) {
    var s = 0; for (var i = 0; i < seq.length - 1; i++) s += voiceDist(seq[i], seq[i + 1]);
    if (loop) s += voiceDist(seq[seq.length - 1], seq[0]);
    return s;
  }
  function isTonic(c, key) { return c.pc === key.tonic && cls(c.q) === (key.sys === 'minor' ? 'm' : 'M'); }
  function isDominantOf(c, key) { return (c.pc === mod(key.tonic + 7) && /[MDSP]/.test(cls(c.q))) || (c.pc === mod(key.tonic + 11) && cls(c.q) === 'd'); }
  function cadence(seq, key) {
    var s = 0, n = seq.length;
    if (isTonic(seq[0], key)) s += 4;
    if (isTonic(seq[n - 1], key)) s += 8;
    if (n > 1 && isDominantOf(seq[n - 2], key) && isTonic(seq[n - 1], key)) s += 6;
    else if (n > 1 && seq[n - 2].pc === mod(key.tonic + 5) && isTonic(seq[n - 1], key)) s += 3;
    return s;
  }
  function tension(c, key) {
    var t = 0;
    if (!fitsKey(c, key.tonic, key.ks)) t += 2;
    var k = cls(c.q); if (k === 'D') t += 1.2; if (k === 'd' || k === 'A') t += 1.6; if (k === 'S') t += 0.6;
    var off = mod(c.pc - key.tonic), fifths = Math.min(mod(off * 7), 12 - mod(off * 7));
    t += fifths * 0.35;
    if (isTonic(c, key)) t -= 2;
    return t;
  }
  function rotateToTonic(seq, key) {
    for (var i = 0; i < seq.length; i++) if (isTonic(seq[i], key)) return seq.slice(i).concat(seq.slice(0, i));
    return seq;
  }

  /* ---------------- connectors ---------------- */
  function connectorCandidates(a, b, level) {
    var out = [], k = cls(b.q), resolvable = /[MmDP]/.test(k);
    var dom = level >= 1 ? '7' : '7';
    function c(pc, q, deg, label) { out.push({ c: mk(pc, q, E.relName(b.name, mod(pc - b.pc), deg, q)), label: label }); }
    if (resolvable) {
      c(b.pc + 7, dom, 5, 'V7 of ' + b.sym + ' (secondary dominant): pulls straight into it');
      c(b.pc + 11, 'dim7', 7, 'passing diminished a half step below ' + b.sym + ': the bass climbs into it');
      c(b.pc + 1, '7', 2, 'tritone-sub dominant: slides down a half step into ' + b.sym);
      c(b.pc + 5, k === 'm' ? 'm' : 'maj', 4, 'plagal approach (a 4th above ' + b.sym + ')');
      c(b.pc + 7, '7sus4', 5, 'suspended dominant of ' + b.sym + ': soft, open pull');
    }
    // pivot chords: things a goes to naturally that also lead to b
    an(a).ranked.slice(0, 30).forEach(function (r) { if (r.tier <= 2) out.push({ c: mk(r.pc, r.q, r.name), label: 'pivot chord: a natural step from ' + a.sym + ' that also leads to ' + b.sym }); });
    return out;
  }
  function bestConnector(a, b, level) {
    var best = null;
    connectorCandidates(a, b, level).forEach(function (cand) {
      var x = cand.c; if (same(x, a) || same(x, b)) return;
      var s1 = trans(a, x).score, s2 = trans(x, b).score;
      var s = Math.min(s1, s2) * 1.4 + s1 + s2;
      if (!best || s > best.s) best = { s: s, chord: x, label: cand.label, s1: s1, s2: s2 };
    });
    return best;
  }
  function twoFive(b) {
    var minor = cls(b.q) === 'm';
    var ii = mk(b.pc + 2, minor ? 'm7b5' : 'm7', E.relName(b.name, 2, 2, minor ? 'm7b5' : 'm7'));
    var v = mk(b.pc + 7, minor ? '7b9' : '7', E.relName(b.name, 7, 5, '7'));
    return [ii, v];
  }

  /* ---------------- mood ---------------- */
  function moodOf(seq, key, loop) {
    var tags = [], notes = [], genres = [];
    var n = seq.length, counts = { M: 0, m: 0, D: 0, d: 0, A: 0, S: 0, P: 0 }, ext = 0;
    seq.forEach(function (c) { counts[cls(c.q)]++; if (Q[c.q].lvl >= 1 && c.q !== '6' && c.q !== 'm6') ext++; });
    var minorKey = key.sys === 'minor';
    var brightShare = (counts.M + counts.D * 0.8 + counts.S * 0.6 + counts.P * 0.5) / n, darkShare = (counts.m + counts.d) / n;
    var avg = 0; for (var i = 0; i < n - 1; i++) avg += trans(seq[i], seq[i + 1]).score; avg = n > 1 ? avg / (n - 1) : 10;
    var resolves = isTonic(seq[n - 1], key) && n > 1;
    var strongCad = n > 1 && isDominantOf(seq[n - 2], key) && resolves;
    // root motion profile
    var down = 0, up = 0, steps = 0, mediant = 0, tritone = 0, semis = 0;
    for (var j = 0; j < n - 1; j++) {
      var iv = mod(seq[j + 1].pc - seq[j].pc);
      if (iv === 1 || iv === 2) { up++; steps++; } if (iv === 10 || iv === 11) { down++; steps++; }
      if (iv === 1 || iv === 11) semis++;
      if ((iv === 3 || iv === 4 || iv === 8 || iv === 9) && cls(seq[j].q) === cls(seq[j + 1].q) && !fitsKey(seq[j + 1], key.tonic, key.ks)) mediant++;
      if (iv === 6) tritone++;
    }
    var borrowed = seq.filter(function (c) { return !fitsKey(c, key.tonic, key.ks); });
    var off = function (c) { return mod(c.pc - key.tonic); };
    var hasBVI = !minorKey && seq.some(function (c) { return off(c) === 8 && cls(c.q) === 'M'; });
    var hasBVII = !minorKey && seq.some(function (c) { return off(c) === 10 && /[MP]/.test(cls(c.q)); });
    var hasIvMinor = !minorKey && seq.some(function (c) { return off(c) === 5 && cls(c.q) === 'm'; });
    var hasBII = seq.some(function (c) { return off(c) === 1 && cls(c.q) === 'M'; });

    if (minorKey) { tags.push(darkShare > 0.5 ? 'melancholic' : 'moody'); notes.push('Centred on ' + key.name + ', so the overall colour is darker and more introspective.'); genres.push('ballad', 'indie'); }
    else if (brightShare >= 0.55) { tags.push('bright', 'warm'); notes.push('Built around ' + key.name + ' with mostly major colours, so it sounds open and positive.'); genres.push('pop', 'folk'); }
    else { tags.push('bittersweet'); notes.push('Mixes major and minor colours around ' + key.name + ', so it sits between happy and wistful.'); genres.push('pop', 'singer-songwriter'); }
    if (hasIvMinor) { tags.push('nostalgic'); notes.push('The minor iv borrowed from the parallel minor adds a tender, "something lost" sigh.'); }
    if (hasBVI && hasBVII) { tags.push('epic'); notes.push('bVI and bVII together give the heroic, cinematic lift heard in film and game themes.'); genres.push('film score', 'rock anthem'); }
    else if (hasBVII) { tags.push('rocky'); notes.push('The flat-seven chord gives a confident classic-rock / Mixolydian swagger.'); genres.push('rock'); }
    if (hasBII) { tags.push('exotic'); notes.push('A major chord a semitone above the tonic brings a Spanish / Phrygian drama.'); genres.push('flamenco', 'metal'); }
    if (mediant) { tags.push('cinematic'); notes.push('Chromatic third-jumps between same-type chords create that sudden "magic" shift used in film scores.'); genres.push('film score'); }
    if (tritone) { tags.push('unsettling'); notes.push('A root jump of a tritone is the most distant move possible: tense and eerie.'); }
    if (counts.d + counts.A) { tags.push('tense'); notes.push('Diminished/augmented chords add suspense — they want to move on.'); }
    if (counts.S) { tags.push('airy'); notes.push('Suspended chords leave the 3rd out, so they float without committing to happy or sad.'); }
    if (counts.P >= n / 2) { tags.push('driving', 'heavy'); notes.push('Power chords keep it raw and loud-friendly.'); genres.push('punk', 'metal'); }
    if (ext / n >= 0.5) { tags.push('smooth', 'jazzy'); notes.push('Seventh and extended chords soften every change and add sophistication.'); genres.push('jazz', 'neo-soul', 'lo-fi'); }
    if (counts.D >= 2 && ext / n >= 0.5) genres.push('blues');
    if (down >= 2 && down > up) { tags.push('wistful'); notes.push('The bass mostly steps downward, which sounds reflective, like a sigh.'); }
    if (up >= 2 && up > down) { tags.push('uplifting'); notes.push('The bass climbs step by step, building hope and momentum.'); }
    if (strongCad) { tags.push('resolved'); notes.push('It ends with a dominant falling into the tonic — a clear, satisfying "full stop".'); }
    else if (resolves) { tags.push('settled'); notes.push('It finishes on the home chord, so it feels complete.'); }
    else if (loop) { tags.push('looping'); notes.push('It never fully lands, so it loops naturally — great for verses, grooves and vamps.'); }
    if (avg >= 8.5) { tags.push('familiar'); notes.push('Every step is a common, well-worn move: instantly singable.'); }
    else if (avg < 4.5) { tags.push('adventurous'); notes.push('Several steps are unusual, so it sounds surprising and unpredictable.'); genres.push('experimental'); }
    var uniq = function (a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); };
    tags = uniq(tags).slice(0, 5); genres = uniq(genres).slice(0, 4);
    var bpm = tags.indexOf('driving') >= 0 || tags.indexOf('rocky') >= 0 ? 120 : tags.indexOf('melancholic') >= 0 || tags.indexOf('wistful') >= 0 ? 72 :
      tags.indexOf('jazzy') >= 0 ? 88 : tags.indexOf('bright') >= 0 ? 104 : 90;
    return { tags: tags, text: notes.slice(0, 4).join(' '), genres: genres, bpm: bpm, smooth: avg };
  }

  /* ---------------- public: build options ---------------- */
  function seqKey(seq) { return seq.map(function (c) { return c.sym; }).join(' '); }
  function stars(seq, loop) {
    var n = seq.length; if (n < 2) return 3;
    var avg = flow(seq, false) / (n - 1);
    return Math.max(1, Math.min(5, Math.round((avg / 10) * 5 + 0.4)));
  }
  function describeTransitions(seq, loop) {
    var t = [];
    for (var i = 0; i < seq.length - 1; i++) t.push(tr(seq[i], seq[i + 1]));
    if (loop && seq.length > 2) { var x = tr(seq[seq.length - 1], seq[0]); x.loopBack = true; t.push(x); }
    return t;
    function tr(a, b) { var r = trans(a, b); return { from: a.sym, to: b.sym, score: r.score, tier: r.tier, why: r.why, added: !!(a.added || b.added), connector: b.added ? b.addedWhy : null, borrowed: b.modal ? b.modalWhy : null }; }
  }
  function option(id, title, blurb, seq, key, loop, kind) {
    var m = moodOf(seq, key, loop);
    var added = seq.filter(function (c) { return c.added; }).length;
    return {
      id: id, title: title, blurb: blurb, kind: kind, added: added, loop: loop, key: key.name,
      chords: seq.map(function (c) {
        var r = roleIn(c, key);
        return { pc: c.pc, q: c.q, name: c.name, sym: c.sym, added: !!c.added, addedWhy: c.addedWhy || null, modal: !!c.modal, modalWhy: c.modalWhy || null, roman: r.roman, diatonic: r.diatonic };
      }),
      transitions: describeTransitions(seq, loop), mood: m, stars: stars(seq, loop), bpm: m.bpm
    };
  }

  function create(input, opts) {
    opts = opts || {};
    var chords = input.map(function (c) { return mk(c.pc, c.q, c.name); });
    if (!chords.length) return { key: null, options: [] };
    var key = detectKey(chords);
    var level = chords.some(function (c) { return Q[c.q].lvl >= 1; }) ? 1 : 0;
    var options = [], seen = {};
    function push(o) { var k = seqKey(o.chords); if (seen[k]) return; seen[k] = 1; options.push(o); }

    // locks: a chord of yours that must start / end the progression
    var cfg = fullCfg(chords, opts), lockS = cfg.start, lockE = cfg.end;
    function lockOk(seq) { return (!lockS || same(seq[0], lockS)) && (!lockE || same(seq[seq.length - 1], lockE)); }
    function home(seq) { return lockS || lockE ? seq : rotateToTonic(seq, key); }

    // full-length progressions first: they answer the Length setting directly
    fullOptions(chords, key, level, cfg).forEach(push);

    var n = chords.length;
    var perms = n <= 8 ? permutations(n) : [chords.map(function (_, i) { return i; })];
    var bestLoop = null, bestCad = null, bestVL = null, bestArc = null;
    perms.forEach(function (p) {
      var seq = p.map(function (i) { return chords[i]; });
      if (!lockOk(seq)) return;
      var f = flow(seq, true), fo = flow(seq, false), c = cadence(seq, key), v = vlCost(seq, true);
      var sLoop = f + (isTonic(seq[0], key) ? 1.5 : 0);
      if (!bestLoop || sLoop > bestLoop.s) bestLoop = { s: sLoop, seq: seq };
      var sCad = fo + c * 1.2;
      if (!bestCad || sCad > bestCad.s) bestCad = { s: sCad, seq: seq };
      var sVL = -v * 3 + f * 0.25;
      if (!bestVL || sVL > bestVL.s) bestVL = { s: sVL, seq: seq };
      // arc: tension should rise then fall back at the end
      var arc = 0; for (var i = 0; i < seq.length - 1; i++) arc += (i < seq.length - 2 ? 1 : -1) * (tension(seq[i + 1], key) - tension(seq[i], key));
      var sArc = arc * 2 + fo * 0.4 + (isTonic(seq[0], key) ? 3 : 0);
      if (!bestArc || sArc > bestArc.s) bestArc = { s: sArc, seq: seq };
    });

    // 1. as picked
    push(option('asis', 'Your order', 'Exactly as you picked them, with notes on how each change sounds.', chords, key, true, 'mine'));
    // 2. smoothest loop
    push(option('loop', 'Smoothest loop', 'Your chords reordered so every change is as natural as possible, and the last chord flows back to the first.',
      home(bestLoop.seq), key, true, 'mine'));
    // 3. strong ending
    push(option('cadence', 'Strong ending', 'Ordered to start and finish on the home chord with the strongest possible approach to the final chord.', bestCad.seq, key, false, 'mine'));
    // 4. voice leading
    push(option('voice', 'Smoothest voice leading', 'Ordered so the fewest notes have to move between chords — great for fingerpicking and singing over.',
      home(bestVL.seq), key, true, 'mine'));
    // 5. arc
    if (n >= 3) push(option('arc', 'Tension & release', 'Starts calm, builds towards the most tense chord, then releases at the end.', bestArc.seq, key, false, 'mine'));
    // 6. tonic return: only-mine but ending back on the tonic by repeating it
    var tc = key.tonicChord;
    if (tc && n >= 2) {
      var base = bestCad.seq.slice(); if (!isTonic(base[base.length - 1], key)) base = base.concat([tc]);
      if (!isTonic(base[0], key)) base = [tc].concat(base);
      push(option('home', 'There and back again', 'Begins and ends on ' + tc.sym + ' (the home chord), visiting your other chords in between.', base, key, false, 'mine'));
    }

    // ---- with connecting chords ----
    function smoothWith(seqIn, loop, maxAdd) {
      var out = [seqIn[0]], added = 0;
      var len = seqIn.length + (loop ? 1 : 0);
      for (var i = 1; i < len; i++) {
        var a = seqIn[i - 1], b = seqIn[i % seqIn.length];
        var direct = trans(a, b).score;
        if (direct < 6.5 && added < maxAdd) {
          var bc = bestConnector(a, b, level);
          if (bc && Math.min(bc.s1, bc.s2) > direct + 1.5) {
            var x = Object.assign({}, bc.chord, { added: true, addedWhy: bc.label });
            out.push(x); added++;
          }
        }
        if (i < seqIn.length) out.push(b);
      }
      return { seq: out, added: added };
    }
    var sm = smoothWith(bestLoop.seq.length ? home(bestLoop.seq) : chords, true, Math.max(2, Math.ceil(n / 2) + 1));
    if (sm.added) push(option('bridged', 'Smoothed with connecting chords', 'Your best loop, with a connecting chord added only where a jump sounded rough. Added chords are marked.', sm.seq, key, true, 'added'));
    var sm2 = smoothWith(chords, false, Math.max(2, Math.ceil(n / 2) + 1));
    if (sm2.added) push(option('bridged-asis', 'Your order, bridged', 'Keeps your order and slips a connecting chord into each rough change.', sm2.seq, key, false, 'added'));

    // jazz: ii–V into each weak arrival
    var jz = [bestCad.seq[0]], jzAdded = 0;
    for (var i = 1; i < bestCad.seq.length; i++) {
      var a = bestCad.seq[i - 1], b = bestCad.seq[i];
      if (trans(a, b).score < 7 && /[Mm]/.test(cls(b.q)) && jzAdded < 6) {
        twoFive(b).forEach(function (x, k) { jz.push(Object.assign({}, x, { added: true, addedWhy: (k === 0 ? 'ii' : 'V') + ' of ' + b.sym + ' (jazz two-five set-up)' })); jzAdded++; });
      }
      jz.push(b);
    }
    if (jzAdded) push(option('jazz', 'Jazz two-fives', 'Every awkward arrival is prepared with its own ii–V, the classic jazz way to reach any chord.', jz, key, false, 'added'));

    // full cadence home
    var homeChord = tc || mk(key.tonic, key.sys === 'minor' ? 'm' : 'maj', key.tonicName);
    var endSeq = bestLoop.seq.slice();
    var last = endSeq[endSeq.length - 1];
    var cadAdd = [];
    if (!isTonic(last, key)) {
      if (!isDominantOf(last, key)) {
        var V = mk(key.tonic + 7, key.sys === 'minor' ? '7b9' : '7', E.relName(homeChord.name, 7, 5, '7'));
        cadAdd.push(Object.assign({}, V, { added: true, addedWhy: 'V7 of the key: sets up the final resolution' }));
      }
      cadAdd.push(tc ? homeChord : Object.assign({}, homeChord, { added: true, addedWhy: 'the home chord (tonic) of ' + key.name }));
      push(option('resolve', 'Resolves home', 'Your smoothest loop, finished with a cadence that lands on ' + homeChord.sym + '.', endSeq.concat(cadAdd), key, false, 'added'));
    }

    // ---- modal colour: borrow chords from parallel modes on the same tonic ----
    // opts.modal: 'off' | 'auto' | a mode id | an array of mode ids (one option per mode, plus one mixing them all)
    var modalNote = null;
    var isAuto = opts.modal === 'auto', picked = modeList(opts.modal);
    if (picked.length) {
      var homeMode = key.sys === 'minor' ? 'aeolian' : 'ionian';
      var modalBase = bestLoop.seq.length ? home(bestLoop.seq) : chords;
      var usableModes = picked.filter(function (m) { return m !== homeMode; });
      var modalOpts = [];
      usableModes.forEach(function (m) {
        var cands = modalColour(modalBase, key, m);
        if (cands.length) modalOpts.push(cands);
      });
      // pick one recolouring per mode, skipping any that repeat another option (several modes can share a borrowed chord)
      var taken = {}; options.forEach(function (o) { taken[seqKey(o.chords)] = 1; });
      modalOpts = modalOpts.map(function (cands) {
        var pickC = cands.filter(function (c) { return !taken[seqKey(c.seq)]; })[0];
        if (pickC) taken[seqKey(pickC.seq)] = 1;
        return pickC;
      }).filter(Boolean);
      if (isAuto) modalOpts = modalOpts.sort(function (a, b) { return b.s - a.s; }).slice(0, 3);
      modalOpts.forEach(function (mo) {
        var info = MODES[mo.mode], keyNm = key.tonicName + ' ' + info.name;
        push(modalOption('modal-' + mo.mode, 'Modal colour: ' + info.name,
          (mo.swaps ? 'Your best loop with ' + (mo.count > 1 ? mo.count + ' chords' : 'one chord') + ' swapped for ' + (mo.count > 1 ? 'their' : 'its') + ' ' + keyNm + ' version' + (mo.count > 1 ? 's' : '') + '.' :
            'Your best loop with a chord borrowed from ' + keyNm + ' slipped in.'), mo.seq, [mo.mode]));
      });

      // several modes picked: one progression that borrows a chord from each of them
      if (!isAuto && usableModes.length >= 2) {
        var mixSeq = modalBase.slice(), mixModes = [];
        usableModes.forEach(function (m) {
          var c1 = modalColour(mixSeq, key, m, 1)[0];
          if (c1) { mixSeq = c1.seq; mixModes.push(m); }
        });
        if (mixModes.length >= 2) push(modalOption('modal-mix', 'Mixed modal colours',
          'Your best loop borrowing one chord from each of ' + listNames(mixModes.map(function (m) { return MODES[m].name.replace(/ \(.*\)$/, ''); })) + '.', mixSeq, mixModes));
      }

      var skipped = picked.indexOf(homeMode) >= 0 && !isAuto;
      if (skipped && !usableModes.length) modalNote = 'Your chords already sit in ' + key.name + ' (' + MODES[homeMode].name + '), so there is nothing to borrow from it. Try another mode or Auto.';
      else if (!modalOpts.length) modalNote = 'No ' + (isAuto ? 'modal' : listNames(usableModes.map(function (m) { return MODES[m].name; }))) + ' colour fits these chords naturally.';
      else if (skipped) modalNote = MODES[homeMode].name + ' was skipped: it is the home key itself (' + key.name + ').';
    }
    function modalOption(id, title, blurb, seq, modes) {
      var o = option(id, title, blurb + ' Borrowed chords are outlined in purple.', seq, key, true, 'modal');
      o.modal = seq.filter(function (c) { return c.modal; }).length;
      o.modeName = modes.length === 1 ? key.tonicName + ' ' + MODES[modes[0]].name :
        key.tonicName + ' ' + modes.map(function (m) { return MODES[m].name.replace(/ \(.*\)$/, ''); }).join(' + ');
      var texts = modes.map(function (m) { var info = MODES[m]; return (key.sys === 'minor' ? info.textMinor : info.textMajor) || info.text; });
      var tags = modes.map(function (m) { return MODES[m].tag; });
      o.mood.tags = tags.concat(o.mood.tags.filter(function (t) { return tags.indexOf(t) < 0; })).slice(0, Math.max(5, tags.length));
      o.mood.text = (texts.length > 2 ? 'Layers several modal colours at once, so the harmony keeps shifting shade. ' : texts.join(' ') + ' ') + o.mood.text;
      var genres = [];
      modes.forEach(function (m) { MODES[m].genres.forEach(function (g) { if (genres.indexOf(g) < 0) genres.push(g); }); });
      o.mood.genres = genres.concat(o.mood.genres.filter(function (g) { return genres.indexOf(g) < 0; })).slice(0, 4);
      return o;
    }

    // honour locks (your own order is always shown as is)
    if (lockS || lockE) options = options.filter(function (o) { return o.id === 'asis' || lockOk(o.chords); });
    var lengthNote = cfg.length && cfg.length <= n ? 'You already have ' + n + ' chords, so the ' + cfg.length + '-chord length adds nothing. Pick a longer length or remove chords.' : null;
    options.forEach(function (o, i) { o.rank = i; });
    return { key: key, level: level, options: options, modalNote: modalNote, lengthNote: lengthNote };
  }

  /* ---------------- modal colour ---------------- */
  // Parallel modes to borrow from (same tonic as the detected key). Ionian = major, Aeolian = natural minor.
  var MODES = {
    ionian: { short: 'Minor keys: major IV, ii and vi. Hopeful.', name: 'Ionian (major)', scale: 'major', tag: 'hopeful', genres: ['gospel', 'classical'],
      text: 'Borrowing from the parallel major lets light into a minor key — a major IV or a minor ii sounds like the sun breaking through.' },
    dorian: { short: 'Minor keys: major IV. Major keys: bIII. Soulful.', name: 'Dorian', scale: 'dorian', tag: 'soulful', genres: ['funk', 'soul'],
      textMajor: 'Dorian\'s flat 3rd and flat 7th darken a major key while keeping its groove — the bIII and bVII sound soulful and funky.',
      text: 'Dorian\'s raised 6th gives minor harmony a hopeful, soulful lift — the major IV under a minor tonic heard in funk, Santana and Pink Floyd.' },
    phrygian: { short: 'bII, the chord a semitone above home. Dark, Spanish.', name: 'Phrygian', scale: 'phrygian', tag: 'dark', genres: ['flamenco', 'metal'],
      text: 'Phrygian\'s flat 2nd, a semitone above home, adds a dark, Spanish edge that leans on the tonic like a sigh.' },
    lydian: { short: 'Major II (raised 4th). Dreamy, floating.', name: 'Lydian', scale: 'lydian', tag: 'dreamy', genres: ['film score', 'dream pop'],
      text: 'Lydian\'s raised 4th makes things float, with that wide-eyed, magical film-score shimmer.' },
    mixolydian: { short: 'Major keys: bVII and minor v. Minor keys: major IV. Laid-back rock.', name: 'Mixolydian', scale: 'mixolydian', tag: 'laid-back', genres: ['rock', 'folk'],
      textMinor: 'Mixolydian\'s major 3rd and 6th lift a minor key — the major IV and minor vi give it a relaxed folk-rock brightness.',
      text: 'Mixolydian\'s flat 7th loosens the pull home — the bVII and minor v give a relaxed, classic-rock and folk swagger.' },
    aeolian: { short: 'Major keys: iv, bVI, bVII. Nostalgic.', name: 'Aeolian (natural minor)', scale: 'natural', tag: 'nostalgic', genres: ['ballad', 'rock'],
      text: 'Borrowing from the parallel natural minor casts shadows over a major key — iv, bVI, bVII and bIII sound nostalgic and bittersweet.' }
  };
  var MODE_ORDER = ['aeolian', 'dorian', 'mixolydian', 'lydian', 'phrygian', 'ionian'];

  function homeScale(key) { return E.SCALES[key.sys === 'minor' ? 'natural' : 'major']; }
  // notes the mode has that the home scale does not: its "colour"
  function colourNotes(key, m) {
    var ms = E.SCALES[MODES[m].scale], hs = homeScale(key);
    return ms.filter(function (o) { return hs.indexOf(o) < 0; }).map(function (o) { return mod(key.tonic + o); });
  }
  // the chord built on scale step k of mode m, at the given size, or null
  function modeChord(key, m, k, lvl) {
    var ms = E.SCALES[MODES[m].scale], off = ms[k];
    var q = E.stackQuality(ms, off, lvl);
    if (!q || !Q[q]) return null;
    return mk(key.tonic + off, q, E.relName(key.tonicName, off, k + 1, q));
  }
  function hasColour(c, colours) { return allPcs(c).some(function (p) { return colours.indexOf(p) >= 0; }); }

  // the one note that best defines each mode against the home key: [in a major key, in a minor key]
  var SIGNATURE = { ionian: [null, 4], dorian: [3, 9], phrygian: [1, 1], lydian: [6, 6], mixolydian: [10, 9], aeolian: [8, null] };
  var DEG_NAME = { 1: ['b2', 2], 2: ['2', 2], 3: ['b3', 3], 4: ['3', 3], 6: ['#4', 4], 8: ['b6', 6], 9: ['6', 6], 10: ['b7', 7], 11: ['7', 7] };

  // Candidate recolourings of `base` using mode m, best first: swaps (same root, the mode's own quality), then an inserted chord.
  function listNames(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  // maxSwaps: optional cap (the mixed option uses 1 per mode)
  function modalColour(base, key, m, maxSwapsCap) {
    var ms = E.SCALES[MODES[m].scale], colours = colourNotes(key, m), info = MODES[m];
    if (!colours.length || base.length < 2) return [];
    var sigOff = SIGNATURE[m][key.sys === 'minor' ? 1 : 0], sig = sigOff === null ? null : mod(key.tonic + sigOff);
    var keyNm = key.tonicName + ' ' + info.name, out = [];
    function hasSig(c) { return sig !== null && allPcs(c).indexOf(sig) >= 0; }
    function usable(x) { return x && cls(x.q) !== 'd' && cls(x.q) !== 'A' && hasColour(x, colours) && !fitsKey(x, key.tonic, key.ks); }
    function mark(c, from) {
      var why = 'borrowed from ' + keyNm + (from ? ' in place of ' + from.sym : '') + ' — its ' + colourLabel(c, key, colours, sig) + ' is the mode\'s colour note';
      return Object.assign({}, c, { modal: true, modalWhy: why });
    }
    var loopFlow = function (s) { return flow(s, true); };

    // 1. swaps; the first must carry the signature note if any swap can
    var seq = base.slice(), count = 0, maxSwaps = maxSwapsCap || (base.length >= 4 ? 2 : 1);
    while (count < maxSwaps) {
      var cands = [];
      seq.forEach(function (c, i) {
        if (c.modal || c.pc === key.tonic || /[PS]/.test(cls(c.q))) return;
        var k = ms.indexOf(mod(c.pc - key.tonic)); if (k < 0) return;
        var x = modeChord(key, m, k, Math.min(1, Q[c.q].lvl || 0));
        if (!usable(x) || same(x, c) || seq.some(function (o) { return same(o, x); })) return;
        var trial = seq.slice(); trial[i] = mark(x, c);
        cands.push({ s: loopFlow(trial), seq: trial, sig: hasSig(x) });
      });
      if (count === 0 && cands.some(function (c) { return c.sig; })) cands = cands.filter(function (c) { return c.sig; });
      var best = cands.sort(function (a, b) { return b.s - a.s; })[0];
      if (!best || (count > 0 && best.s < loopFlow(seq) - 2)) break; // a second swap only if it doesn't hurt the flow much
      seq = best.seq; count++;
    }
    if (count) out.push({ mode: m, seq: seq, count: count, swaps: true, sig: seq.some(function (c) { return c.modal && hasSig(c); }), s: loopFlow(seq) / seq.length + 0.5 });

    // 2. slip in a borrowed chord (signature-note chords first) where it connects best
    var lvl = base.some(function (c) { return Q[c.q].lvl >= 1; }) ? 1 : 0, ins = [];
    for (var k = 1; k < 7; k++) {
      var x = modeChord(key, m, k, lvl);
      if (usable(x) && !base.some(function (o) { return same(o, x); })) ins.push(x);
    }
    if (ins.some(hasSig)) ins = ins.filter(hasSig);
    var bestIns = null;
    ins.forEach(function (x) {
      for (var i = 1; i <= base.length; i++) {
        var a = base[i - 1], b = base[i % base.length];
        var s1 = trans(a, x).score, s2 = trans(x, b).score, s = Math.min(s1, s2) * 1.4 + s1 + s2;
        if (!bestIns || s > bestIns.s) bestIns = { s: s, x: x, i: i };
      }
    });
    if (bestIns) {
      var withIns = base.slice(0, bestIns.i).concat([mark(bestIns.x)], base.slice(bestIns.i));
      var insOpt = { mode: m, seq: withIns, count: 1, swaps: false, sig: hasSig(bestIns.x), s: loopFlow(withIns) / withIns.length };
      // a swap that misses the mode's signature note is less telling than an inserted chord that has it
      if (out.length && !out[0].sig && insOpt.sig) out.unshift(insOpt); else out.push(insOpt);
    }
    return out;
  }
  function colourLabel(c, key, colours, sig) {
    var pcs = allPcs(c), p = sig !== null && pcs.indexOf(sig) >= 0 ? sig : pcs.filter(function (x) { return colours.indexOf(x) >= 0; })[0];
    var off = mod(p - key.tonic), d = DEG_NAME[off] || ['', 1];
    return d[0] + ' (' + E.relName(key.tonicName, off, d[1], 'maj') + ')';
  }

  /* ---------------- full-length progressions (Length setting) ---------------- */
  function modeList(modal) {
    if (modal === 'auto') return MODE_ORDER.slice();
    return (Array.isArray(modal) ? modal : modal && modal !== 'off' ? [modal] : []).filter(function (m, i, a) { return MODES[m] && a.indexOf(m) === i; });
  }
  function lockChord(chords, x) { return x ? chords.filter(function (c) { return same(c, x); })[0] || null : null; }
  // opts: { length: 0|4|6|8, keepOrder, modal, start, end }  (start/end: {pc, q} of one of your chords)
  function fullCfg(chords, opts) {
    var start = lockChord(chords, opts.start), end = lockChord(chords, opts.end);
    if (start && end && start === end) end = null;
    return { length: +opts.length || 0, keepOrder: !!opts.keepOrder, modes: modeList(opts.modal), start: start, end: end };
  }
  function seeded(seed) {
    return function () { seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function hashStr(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h; }

  // Chords a progression in `key` may use: the key's own chords plus each selected mode's borrowed chords.
  function palette(key, level, modes) {
    var hs = homeScale(key), out = [], lvl = Math.min(1, level), homeMode = key.sys === 'minor' ? 'aeolian' : 'ionian';
    function add(c, extra) { if (!out.some(function (p) { return same(p.c, c); })) out.push(Object.assign({ c: c }, extra)); }
    for (var k = 0; k < 7; k++) {
      var off = hs[k], q = E.stackQuality(hs, off, lvl);
      if (q && Q[q] && cls(q) !== 'd') add(mk(key.tonic + off, q, E.relName(key.tonicName, off, k + 1, q)), { mode: null });
    }
    if (key.sys === 'minor') { var vq = lvl ? '7' : 'maj'; add(mk(key.tonic + 7, vq, E.relName(key.tonicName, 7, 5, vq)), { mode: null }); } // harmonic-minor V
    (modes || []).forEach(function (m) {
      if (!MODES[m] || m === homeMode) return;
      var colours = colourNotes(key, m), sigOff = SIGNATURE[m][key.sys === 'minor' ? 1 : 0], sig = sigOff === null ? null : mod(key.tonic + sigOff);
      for (var j = 1; j < 7; j++) {
        var x = modeChord(key, m, j, lvl);
        if (!x || cls(x.q) === 'd' || cls(x.q) === 'A' || !hasColour(x, colours) || fitsKey(x, key.tonic, key.ks)) continue;
        add(x, { mode: m, sig: sig !== null && allPcs(x).indexOf(sig) >= 0,
          why: 'borrowed from ' + key.tonicName + ' ' + MODES[m].name + ' — its ' + colourLabel(x, key, colours, sig) + ' is the mode\'s colour note' });
      }
    });
    return out;
  }

  var FULL_VARIANTS = {
    home: { title: 'Full progression: lands home', blurb: 'Built around your chords in two halves: the first ends open, the second comes home to the tonic.' },
    loop: { title: 'Full progression: loop', blurb: 'Built around your chords so the last chord flows straight back into the first, made to repeat.' },
    modal: { title: 'Full progression: modal colour', blurb: 'Built around your chords, leaning on chords borrowed from your modal colours.' },
    key: { title: 'Full progression: in key', blurb: 'Built around your chords with only chords from the key, to compare with the modal versions.' }
  };

  function fullScore(seq, key, cfg, variant) {
    var L = seq.length, s = flow(seq, false) / (L - 1) * 4;
    if (variant === 'loop') { s += trans(seq[L - 1], seq[0]).score * 0.5; if (isTonic(seq[L - 1], key)) s -= 4; }
    else s += cadence(seq, key) * 0.6;
    if (isTonic(seq[0], key)) s += 1.5;
    if (L >= 6) { // halfway point: an open, "question" chord
      var mc = seq[Math.floor(L / 2) - 1];
      if (isDominantOf(mc, key)) s += 2; else if (mod(mc.pc - key.tonic) === 5) s += 1; else if (isTonic(mc, key)) s -= 1.5;
    }
    var uses = {}, adj = 0;
    seq.forEach(function (c, i) { uses[c.sym] = (uses[c.sym] || 0) + 1; if (i && same(c, seq[i - 1])) adj++; });
    Object.keys(uses).forEach(function (k) { if (uses[k] > 2) s -= 3 * (uses[k] - 2); });
    s += Object.keys(uses).length * 0.4 - adj * 5;
    var modalC = seq.filter(function (c) { return c.modal; }), used = {};
    modalC.forEach(function (c) { used[c.modalMode] = 1; });
    var mu = Object.keys(used).length, mc2 = modalC.length;
    if (variant === 'modal') s += mu * 3 + mc2 - Math.max(0, mc2 - Math.ceil(L / 2)) * 3;
    else if (cfg.modes.length) s += mu * 1.5 - Math.max(0, mc2 - Math.ceil(L / 3)) * 2;
    return s;
  }

  // Random-but-guided fills: your chords are placed (locks first), then each free slot is drawn from the palette,
  // weighted by how naturally it follows the previous chord and leads into the next fixed one. Best scores first.
  function fullCandidates(user, key, level, cfg, variant, rng, tries) {
    var L = cfg.length, pal = palette(key, level, cfg.modes);
    if (variant === 'key') pal = pal.filter(function (p) { return !p.mode; });
    var found = {}, out = [];
    function fillerOf(p) {
      return p.mode ? Object.assign({}, p.c, { modal: true, modalWhy: p.why, modalMode: p.mode }) :
        Object.assign({}, p.c, { added: true, addedWhy: 'from ' + key.name + ' (' + E.romanFor(mod(p.c.pc - key.tonic), p.c.q) + '), filling out the progression' });
    }
    for (var t = 0; t < tries; t++) {
      var seq = new Array(L), fixed = new Array(L), free = [], rest = user.slice(), i;
      for (i = 0; i < L; i++) free.push(i);
      var put = function (c, pos) { seq[pos] = c; fixed[pos] = true; free.splice(free.indexOf(pos), 1); rest.splice(rest.indexOf(c), 1); };
      if (cfg.start) put(cfg.start, 0);
      if (cfg.end) put(cfg.end, L - 1);
      var slots = free.slice();
      for (i = slots.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), tmp = slots[i]; slots[i] = slots[j]; slots[j] = tmp; }
      slots = slots.slice(0, rest.length);
      if (cfg.keepOrder) slots.sort(function (a, b) { return a - b; });
      else for (i = rest.length - 1; i > 0; i--) { var k = Math.floor(rng() * (i + 1)), tc = rest[i]; rest[i] = rest[k]; rest[k] = tc; }
      rest.slice().forEach(function (c, idx) { put(c, slots[idx]); });
      for (i = 0; i < L; i++) {
        if (fixed[i]) continue;
        var prev = seq[i - 1], next = fixed[i + 1] ? seq[i + 1] : null, tot = 0;
        var ws = pal.map(function (p) {
          var w = 1, c = p.c;
          if (prev) { w *= Math.exp(trans(prev, c).score / 2.2); if (same(prev, c)) w *= 0.02; }
          if (next) { w *= Math.exp(trans(c, next).score / 2.2); if (same(next, c)) w *= 0.02; }
          var u = 0; for (var q = 0; q < L; q++) if (seq[q] && same(seq[q], c)) u++;
          w *= Math.pow(0.35, u);
          if (p.mode) w *= variant === 'modal' ? 2.5 : 0.9;
          if (i === 0 && isTonic(c, key)) w *= 8;
          if (i === L - 1) {
            if (variant === 'loop') { w *= isTonic(c, key) ? 0.2 : 1; if (seq[0]) w *= Math.exp(trans(c, seq[0]).score / 3); }
            else if (isTonic(c, key)) w *= 10;
          }
          tot += w; return w;
        });
        var r = rng() * tot, pick = pal[pal.length - 1];
        for (var x = 0; x < pal.length; x++) { r -= ws[x]; if (r <= 0) { pick = pal[x]; break; } }
        seq[i] = fillerOf(pick);
      }
      var sk = seqKey(seq);
      if (found[sk]) continue;
      found[sk] = 1;
      out.push({ seq: seq, s: fullScore(seq, key, cfg, variant) });
    }
    return out.sort(function (a, b) { return b.s - a.s; });
  }
  function fullVariants(key, level, cfg) {
    var v = ['home', 'loop'];
    if (cfg.modes.length && palette(key, level, cfg.modes).some(function (p) { return p.mode; })) v.push('modal', 'key');
    return v;
  }
  function fullOption(seq, key, variant, cfg) {
    var info = FULL_VARIANTS[variant], title = info.title, blurb = info.blurb;
    if (variant !== 'loop' && cfg.end && !isTonic(cfg.end, key)) { // a locked last chord overrides "landing home"
      title = variant === 'home' ? 'Full progression: two halves' : title;
      blurb = blurb.replace(/,? the second comes home to the tonic\./, ', the second heads for ' + cfg.end.sym + ', your locked last chord.');
    }
    var o = option('full-' + variant, title, blurb + ' Chords marked + come from the key; purple ones are borrowed from your modal colours.', seq, key, variant === 'loop', 'full');
    var modes = [];
    seq.forEach(function (c) { if (c.modal && modes.indexOf(c.modalMode) < 0) modes.push(c.modalMode); });
    o.regen = variant; o.length = seq.length;
    o.modal = seq.filter(function (c) { return c.modal; }).length;
    o.filled = o.added + o.modal;
    o.modeName = modes.length ? key.tonicName + ' ' + modes.map(function (m) { return MODES[m].name.replace(/ \(.*\)$/, ''); }).join(' + ') : null;
    if (modes.length) {
      var tags = modes.map(function (m) { return MODES[m].tag; });
      o.mood.tags = tags.concat(o.mood.tags.filter(function (t) { return tags.indexOf(t) < 0; })).slice(0, 5);
      if (modes.length <= 2) o.mood.text = modes.map(function (m) { var i2 = MODES[m]; return (key.sys === 'minor' ? i2.textMinor : i2.textMajor) || i2.text; }).join(' ') + ' ' + o.mood.text;
    }
    return o;
  }
  function fullOptions(chords, key, level, cfg) {
    if (!cfg.length || cfg.length <= chords.length) return [];
    var taken = {}, out = [], base = hashStr(chords.map(function (c) { return c.sym; }).join(' ') + '|' + cfg.length + '|' + cfg.modes.join(',') + '|' + cfg.keepOrder);
    fullVariants(key, level, cfg).forEach(function (variant) {
      var best = fullCandidates(chords, key, level, cfg, variant, seeded(base + hashStr(variant)), 700)
        .filter(function (c) { return !taken[seqKey(c.seq)]; })[0];
      if (!best) return;
      taken[seqKey(best.seq)] = 1;
      out.push(fullOption(best.seq, key, variant, cfg));
    });
    return out;
  }
  // "Another one like this": a fresh fill for the same variant, different from the current one.
  function reroll(input, opts, variant, currentSyms) {
    var chords = input.map(function (c) { return mk(c.pc, c.q, c.name); });
    var key = detectKey(chords), level = chords.some(function (c) { return Q[c.q].lvl >= 1; }) ? 1 : 0, cfg = fullCfg(chords, opts || {});
    if (!FULL_VARIANTS[variant] || !cfg.length || cfg.length <= chords.length) return null;
    var cands = fullCandidates(chords, key, level, cfg, variant, Math.random, 700).filter(function (c) { return seqKey(c.seq) !== currentSyms; }).slice(0, 6);
    if (!cands.length) return null;
    var w = cands.map(function (c, i) { return 6 - i; }), tot = w.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * tot, pick = cands[0];
    for (var i = 0; i < cands.length; i++) { r -= w[i]; if (r <= 0) { pick = cands[i]; break; } }
    return fullOption(pick.seq, key, variant, cfg);
  }
  // Every chord each selected mode lends to the key of `input` (for the "borrowable chords" list).
  function borrowable(input, modal) {
    var chords = input.map(function (c) { return mk(c.pc, c.q, c.name); });
    var modes = modeList(modal);
    if (!chords.length || !modes.length) return null;
    var key = detectKey(chords), level = chords.some(function (c) { return Q[c.q].lvl >= 1; }) ? 1 : 0, homeMode = key.sys === 'minor' ? 'aeolian' : 'ionian';
    return {
      key: key.name, home: homeMode,
      modes: modes.filter(function (m) { return m !== homeMode; }).map(function (m) {
        return { mode: m, name: MODES[m].name, chords: palette(key, level, [m]).filter(function (p) { return p.mode; }).map(function (p) {
          return { pc: p.c.pc, q: p.c.q, name: p.c.name, sym: p.c.sym, sig: p.sig, roman: E.romanFor(mod(p.c.pc - key.tonic), p.c.q) };
        }) };
      }).filter(function (x) { return x.chords.length; })
    };
  }

  // Random chords (not necessarily related). mode: 'simple' | 'sevenths' | 'any'
  var POOLS = {
    simple: ['maj', 'maj', 'm', 'm', 'maj', 'm', 'sus4', 'sus2'],
    sevenths: ['maj', 'm', 'maj7', 'm7', '7', 'm7', 'maj7', '6', 'm7b5', 'sus4', 'add9'],
    any: E.QUALITIES.map(function (q) { return q.id; })
  };
  function random(count, mode, sameKey, rng) {
    rng = rng || Math.random;
    var pool = POOLS[mode] || POOLS.simple, out = [];
    var tonic = Math.floor(rng() * 12), scale = E.SCALES.major;
    var guard = 0;
    while (out.length < count && guard++ < 500) {
      var pc, q;
      if (sameKey) {
        var deg = Math.floor(rng() * 7); pc = mod(tonic + scale[deg]);
        q = E.stackQuality(scale, scale[deg], mode === 'simple' ? 0 : (rng() < 0.6 ? 1 : 0));
        if (deg === 6 && mode === 'simple') q = 'dim';
      } else { pc = Math.floor(rng() * 12); q = pool[Math.floor(rng() * pool.length)]; }
      if (!q) continue;
      var c = mk(pc, q);
      if (out.some(function (o) { return o.pc === c.pc && cls(o.q) === cls(c.q); })) continue;
      out.push(c);
    }
    return out;
  }

  return { create: create, random: random, reroll: reroll, borrowable: borrowable, seqKey: seqKey, MODES: MODES, MODE_ORDER: MODE_ORDER, transition: trans, detectKey: detectKey, mood: moodOf, cls: cls, mk: mk, analysis: an };
});
