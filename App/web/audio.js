/* audio.js — offline synth: plucked guitar (Karplus–Strong), piano-ish and pad; chord strums and a looping sequencer */
window.Sound = (function () {
  var E = window.ChordEngine;
  var AC = null, master = null, wet = null, live = [], bufs = {};
  var opts = { instrument: 'guitar', pattern: 'strum', volume: 0.8 };

  function ctx() {
    if (!AC) {
      var C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
      AC = new C();
      master = AC.createGain(); master.gain.value = opts.volume;
      var comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
      master.connect(comp); comp.connect(AC.destination);
      // small room reverb
      var conv = AC.createConvolver(), len = Math.floor(AC.sampleRate * 1.6), ir = AC.createBuffer(2, len, AC.sampleRate);
      for (var ch = 0; ch < 2; ch++) { var d = ir.getChannelData(ch); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      conv.buffer = ir; wet = AC.createGain(); wet.gain.value = 0.18; wet.connect(conv); conv.connect(comp);
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function out(node) { node.connect(master); node.connect(wet); }

  function guitarBuf(midi) {
    var k = 'g' + midi; if (bufs[k]) return bufs[k];
    var sr = AC.sampleRate, f = 440 * Math.pow(2, (midi - 69) / 12), N = Math.max(2, Math.round(sr / f)), len = Math.floor(sr * 2.6);
    var b = AC.createBuffer(1, len, sr), d = b.getChannelData(0), ring = new Float32Array(N), i, p = 0;
    for (i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    for (i = 1; i < N; i++) ring[i] = 0.5 * (ring[i] + ring[i - 1]);
    var damp = midi > 64 ? 0.9935 : 0.996;
    for (i = 0; i < len; i++) { var a = ring[p], c = ring[(p + 1) % N]; d[i] = a; ring[p] = damp * 0.5 * (a + c); p = (p + 1) % N; }
    return (bufs[k] = b);
  }
  function pianoBuf(midi) {
    var k = 'p' + midi; if (bufs[k]) return bufs[k];
    var sr = AC.sampleRate, f = 440 * Math.pow(2, (midi - 69) / 12), len = Math.floor(sr * 3), b = AC.createBuffer(1, len, sr), d = b.getChannelData(0);
    var parts = [[1, 1, 1.6], [2, 0.5, 2.6], [3, 0.28, 3.6], [4, 0.14, 5], [5, 0.08, 6.5], [6, 0.05, 8]];
    for (var i = 0; i < len; i++) {
      var t = i / sr, v = 0;
      for (var j = 0; j < parts.length; j++) { var pf = f * parts[j][0] * (1 + 0.0004 * parts[j][0] * parts[j][0]); if (pf > sr / 2) continue; v += parts[j][1] * Math.sin(2 * Math.PI * pf * t) * Math.exp(-t * parts[j][2] * (0.6 + f / 900)); }
      d[i] = v * 0.42 * Math.min(1, t * 250);
    }
    return (bufs[k] = b);
  }
  function note(midi, t, dur, vel) {
    var ac = AC, g = ac.createGain();
    vel = vel || 1;
    if (opts.instrument === 'pad') {
      var f = 440 * Math.pow(2, (midi - 69) / 12), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.3;
      [-6, 5].forEach(function (det) { var o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.9); live.push({ s: o, g: g }); });
      lp.connect(g);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.055 * vel, t + 0.18); g.gain.setValueAtTime(0.055 * vel, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.8);
      out(g); return;
    }
    var src = ac.createBufferSource();
    src.buffer = opts.instrument === 'piano' ? pianoBuf(midi) : guitarBuf(midi);
    var peak = (opts.instrument === 'piano' ? 0.34 : 0.3) * vel;
    g.gain.setValueAtTime(peak, t); g.gain.setValueAtTime(peak, t + Math.max(0.05, dur - 0.08)); g.gain.exponentialRampToValueAtTime(0.0005, t + dur + 0.25);
    src.connect(g); out(g); src.start(t); src.stop(t + dur + 0.3); live.push({ s: src, g: g });
  }

  // notes to play for a chord
  function voicingFor(c) {
    if (opts.instrument === 'guitar') {
      var v = E.voicings(c.pc, c.q)[0];
      if (v) return v.midi.filter(function (m) { return m !== null; });
    }
    // keyboard-style: root in the bass + close voicing above middle C area
    var q = E.Q[c.q], root = 36 + ((c.pc + 12 - 4) % 12) + 4; // E2..D#3
    var ivs = q.iv.slice().sort(function (a, b) { return a - b; });
    var top = [], base = 52 + ((c.pc - 4 + 12) % 12); if (base > 59) base -= 12;
    ivs.forEach(function (iv) { if (iv === 0 && ivs.length > 3) return; var m = base + (iv % 12); if (iv >= 12) m += 12; while (m < 52) m += 12; top.push(m); });
    top = top.filter(function (m, i, a) { return a.indexOf(m) === i; }).sort(function (a, b) { return a - b; });
    return [root].concat(top);
  }

  function chordAt(c, t, dur, style, up) {
    var m = voicingFor(c); if (!m.length) return;
    style = style || opts.pattern;
    if (opts.instrument === 'pad' || style === 'block') { m.forEach(function (x) { note(x, t, dur, 0.9); }); return; }
    if (style === 'arp') {
      var seq = m.concat(m.slice(1, -1).reverse()), step = dur / Math.max(4, Math.min(8, seq.length));
      for (var i = 0, tt = t; tt < t + dur - 0.01; i++, tt += step) note(seq[i % seq.length], tt, Math.min(dur - (tt - t), step * 3), i === 0 ? 1 : 0.8);
      return;
    }
    var gap = opts.instrument === 'piano' ? 0.012 : 0.026, list = up ? m.slice().reverse() : m;
    list.forEach(function (x, i) { note(x, t + i * gap, dur, up ? 0.75 : 1); });
  }

  function hush() {
    stopSeq(true);
    if (!AC) return; var t = AC.currentTime;
    live.forEach(function (v) { try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0.0001, t, 0.03); v.s.stop(t + 0.15); } catch (e) {} });
    live = [];
  }
  function playChord(c) {
    var ac = ctx(); if (!ac) return; hush();
    chordAt(c, ac.currentTime + 0.03, 2.2, opts.pattern === 'arp' ? 'arp' : 'strum');
  }

  // Sequencer: chords [{pc,q}], {bpm, beats, loop, onStep(i), onEnd()}
  var seqState = null;
  function playSeq(chords, o) {
    var ac = ctx(); if (!ac || !chords.length) return; hush();
    o = o || {};
    var bpm = o.bpm || 90, beats = o.beats || 4, beat = 60 / bpm, bar = beat * beats;
    var st = { chords: chords, o: o, i: 0, next: ac.currentTime + 0.06, timers: [], timer: null, stopped: false };
    seqState = st;
    function schedule() {
      if (st.stopped) return;
      while (st.next < ac.currentTime + 0.35) {
        if (st.i >= chords.length) {
          if (!o.loop) { var endAt = (st.next - ac.currentTime) * 1000; st.timers.push(setTimeout(function () { if (seqState === st) { seqState = null; o.onEnd && o.onEnd(); } }, endAt)); clearInterval(st.timer); return; }
          st.i = 0;
        }
        var c = chords[st.i], t = st.next, idx = st.i;
        if (opts.pattern === 'strum' && opts.instrument !== 'pad' && beats >= 2) {
          // down on 1, down-up on the middle beat(s)
          chordAt(c, t, beat * 2, 'strum');
          for (var b = 2; b < beats; b += 2) { chordAt(c, t + b * beat, beat, 'strum'); chordAt(c, t + (b + 0.5) * beat, beat * (beats - b - 0.5), 'strum', true); }
        } else chordAt(c, t, bar, opts.pattern);
        (function (idx, t) { st.timers.push(setTimeout(function () { if (!st.stopped) o.onStep && o.onStep(idx); }, Math.max(0, (t - ac.currentTime) * 1000))); })(idx, t);
        st.next += bar; st.i++;
      }
    }
    st.timer = setInterval(schedule, 60); schedule();
    return st;
  }
  function stopSeq(silent) {
    if (!seqState) return; var st = seqState; seqState = null;
    st.stopped = true; clearInterval(st.timer); st.timers.forEach(clearTimeout);
    if (!silent || true) st.o.onEnd && st.o.onEnd();
  }
  function playing() { return !!seqState; }

  function playScale(tonicMidi, scale) {
    var ac = ctx(); if (!ac) return; hush();
    var t = ac.currentTime + 0.05, list = scale.concat([12]);
    list.forEach(function (iv, i) { note(tonicMidi + iv, t + i * 0.28, 0.5, 0.9); });
  }

  function playMidis(midis, inst) {
    var ac = ctx(); if (!ac) return; hush();
    var prev = opts.instrument; if (inst) opts.instrument = inst;
    var t = ac.currentTime + 0.03;
    midis.forEach(function (m, i) { note(m, t + i * 0.026, 2.2, 1); });
    opts.instrument = prev;
  }

  return {
    playMidis: playMidis,
    set: function (k, v) { opts[k] = v; if (k === 'volume' && master) master.gain.value = v; },
    get: function (k) { return opts[k]; },
    unlock: function () { ctx(); },
    playChord: playChord, playSeq: playSeq, stop: hush, playing: playing, playScale: playScale
  };
})();
