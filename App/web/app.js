/* app.js — Chord Atlas UI (single-page, hash-routed, offline) */
(function () {
  'use strict';
  var E = window.ChordEngine, G = window.ProgGen, CT = window.CONTENT, Snd = window.Sound, Q = E.Q, mod = E.mod;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ================= storage & native bridge ================= */
  var IS_ANDROID = !!window.AndroidBridge;
  // Native bridge: iOS (WKWebView message handler) or Android (addJavascriptInterface)
  function native(type, payload) {
    var msg = Object.assign({ type: type }, payload || {});
    try { if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.native) { window.webkit.messageHandlers.native.postMessage(msg); return true; } } catch (e) {}
    try { if (IS_ANDROID) { window.AndroidBridge.postMessage(JSON.stringify(msg)); return true; } } catch (e) {}
    return false;
  }
  var Store = (function () {
    var data = {};
    try {
      if (IS_ANDROID && window.AndroidBridge.getStore) data = JSON.parse(window.AndroidBridge.getStore() || '{}') || {};
      else if (window.__NATIVE_STORE__ && typeof window.__NATIVE_STORE__ === 'object') data = window.__NATIVE_STORE__;
      else data = JSON.parse(localStorage.getItem('chordatlas') || '{}') || {};
      if (typeof data !== 'object' || Array.isArray(data)) data = {};
    } catch (e) { data = {}; }
    var t = null;
    function save() {
      clearTimeout(t);
      t = setTimeout(function () { var s = JSON.stringify(data); try { localStorage.setItem('chordatlas', s); } catch (e) {} native('store', { value: s }); }, 120);
    }
    return { get: function (k, d) { return data[k] !== undefined ? data[k] : d; }, set: function (k, v) { data[k] = v; save(); }, reset: function () { data = {}; save(); } };
  })();
  var DEF = { instrument: 'guitar', pattern: 'strum', bpm: 90, beats: 4, volume: 0.8, level: 'auto', tiers: { 1: true, 2: true, 3: true, 4: false },
    autoplay: true, haptics: true, lefty: false, theme: 'system', useSuggestedTempo: true, loop: true };
  function setting(k) { var s = Store.get('settings', {}); return s[k] !== undefined ? s[k] : DEF[k]; }
  function setSetting(k, v) { var s = Store.get('settings', {}); s[k] = v; Store.set('settings', s); applySettings(); }
  function applySettings() {
    Snd.set('instrument', setting('instrument')); Snd.set('pattern', setting('pattern')); Snd.set('volume', setting('volume'));
    var th = setting('theme'); document.documentElement.setAttribute('data-theme', th === 'system' ? '' : th);
    if (th === 'system') document.documentElement.removeAttribute('data-theme');
    sendTheme();
  }
  // Tell the native shell whether the page is dark, so it can colour the status-bar icons
  function sendTheme() {
    var th = setting('theme');
    var dark = th === 'dark' || (th === 'system' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    native('theme', { dark: dark });
  }
  function setInsets(top, bottom) {
    var s = document.documentElement.style;
    s.setProperty('--sat', Math.max(0, +top || 0) + 'px'); s.setProperty('--sab', Math.max(0, +bottom || 0) + 'px');
  }
  function haptic(style) { if (setting('haptics')) native('haptic', { style: style || 'light' }); }

  /* ================= chord helpers ================= */
  function mk(pc, q, name) { var c = E.ch(pc, q, name); return { pc: c.pc, q: c.q, name: c.name, sym: c.sym }; }
  function enc(c) { return c.pc + '|' + c.q + '|' + c.name; }
  function dec(s) { var p = String(s).split('|'); return mk(+p[0], p[1], p[2]); }
  function fromSym(sym) { var p = E.parseChord(sym); return p ? mk(p.pc, p.q, p.name) : null; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function pRoot(n) { return n[0] + n.slice(1).replace(/b/g, '♭').replace(/#/g, '♯'); }
  function pQual(s) { return s.replace(/b(?=\d)/g, '♭').replace(/#/g, '♯'); }
  function pRoman(s) { return String(s).replace(/b(?=[IViv])/g, '♭').replace(/#(?=[IViv])/g, '♯'); }
  function pText(s) {
    return esc(s).replace(/\b([A-G])b(?=[\s\d)\/,;:.m(a+°ø–→-]|maj|dim|aug|sus|add|$)/g, '$1♭').replace(/\b([A-G])#/g, '$1♯')
      .replace(/(^|[\s(–→\/-])b(?=[IViv])/g, '$1♭').replace(/(^|[\s(–→\/-])#(?=[IViv])/g, '$1♯').replace(/(\d)b(?=\d)/g, '$1♭').replace(/7#(?=\d)/g, '7♯');
  }
  function symHTML(c) { return '<span class="r">' + esc(pRoot(c.name)) + '</span><span class="q">' + esc(pQual(Q[c.q].sym)) + '</span>'; }
  function symText(c) { return pRoot(c.name) + pQual(Q[c.q].sym); }
  function chip(c, o) {
    o = o || {};
    var cls = 'chip' + (o.tier ? ' t' + Math.min(4, o.tier) : '') + (o.cls ? ' ' + o.cls : '');
    return '<button class="' + cls + '" data-act="sheet" data-c="' + esc(enc(c)) + '"' + (o.i !== undefined ? ' data-i="' + o.i + '"' : '') +
      (o.ctx ? ' data-ctx="' + esc(o.ctx) + '"' : '') + '>' + (o.pre || '') + symHTML(c) + (o.roman ? '<small>' + esc(pRoman(o.roman)) + '</small>' : '') + '</button>';
  }
  var TIER_NAME = { 1: 'Core', 2: 'Common', 3: 'Colour', 4: 'Exotic' };
  function tierBadge(t) { t = Math.min(4, t); return '<span class="badge t' + t + '">' + TIER_NAME[t] + '</span>'; }
  function tierOk(t) { var s = setting('tiers'); return !!s[Math.min(4, t)]; }
  function levelOpt() { var l = setting('level'); return l === 'auto' ? 'auto' : +l; }

  function pushRecent(c) {
    var r = Store.get('recent', []).filter(function (x) { return x !== enc(c); }); r.unshift(enc(c)); Store.set('recent', r.slice(0, 16));
  }
  function isFav(c) { return Store.get('favs', []).indexOf(enc(c)) >= 0; }
  function toggleFav(c) {
    var f = Store.get('favs', []), k = enc(c), i = f.indexOf(k);
    if (i >= 0) f.splice(i, 1); else f.unshift(k); Store.set('favs', f); haptic('medium'); return i < 0;
  }
  function builder() { return Store.get('builder', []).map(dec); }
  function setBuilder(list) { Store.set('builder', list.map(enc)); Store.set('results', null); }
  function addToBuilder(c) { var b = builder(); if (b.length >= 8) { toast('Create holds up to 8 chords'); return false; } b.push(c); setBuilder(b); toast(symText(c) + ' added to Create'); haptic('light'); return true; }

  /* ================= chord diagram (SVG) ================= */
  function diagram(v, root, small) {
    var f = v.frets.slice(), lefty = setting('lefty');
    if (lefty) f.reverse();
    var fr = f.filter(function (x) { return x !== null && x > 0; });
    var max = fr.length ? Math.max.apply(null, fr) : 0, min = fr.length ? Math.min.apply(null, fr) : 0;
    var base = max <= 4 ? 1 : min, rows = Math.max(4, max - base + 1);
    var W = 112, H = 30 + rows * 22 + 8, x0 = 22, gx = 14, y0 = 26, gy = 22;
    var s = '<svg class="dia' + (small ? ' sm' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Chord diagram ' + esc(v.tab) + '">';
    for (var i = 0; i <= rows; i++) s += '<line x1="' + x0 + '" x2="' + (x0 + 5 * gx) + '" y1="' + (y0 + i * gy) + '" y2="' + (y0 + i * gy) + '" class="fl' + (i === 0 && base === 1 ? ' nut' : '') + '"/>';
    for (var k = 0; k < 6; k++) s += '<line y1="' + y0 + '" y2="' + (y0 + rows * gy) + '" x1="' + (x0 + k * gx) + '" x2="' + (x0 + k * gx) + '" class="sl"/>';
    if (base > 1) s += '<text x="' + (x0 - 6) + '" y="' + (y0 + gy * 0.68) + '" class="bf" text-anchor="end">' + base + '</text>';
    var lowest = fr.length ? min : 0, atLow = [];
    f.forEach(function (x, k) { if (x === lowest && x > 0) atLow.push(k); });
    if (atLow.length >= 3 && base > 1 || atLow.length >= 4) {
      var a = atLow[0], b = atLow[atLow.length - 1], yy = y0 + (lowest - base + 0.5) * gy;
      s += '<rect x="' + (x0 + a * gx - 6) + '" y="' + (yy - 6) + '" width="' + ((b - a) * gx + 12) + '" height="12" rx="6" class="barre"/>';
    }
    var strOrder = lefty ? [5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5];
    f.forEach(function (x, k) {
      var cx = x0 + k * gx, sIdx = strOrder[k];
      if (x === null) s += '<text x="' + cx + '" y="' + (y0 - 8) + '" class="mk" text-anchor="middle">×</text>';
      else {
        var isRoot = mod(E.OPEN_STR[sIdx] + x) === mod(root);
        if (x === 0) s += '<circle cx="' + cx + '" cy="' + (y0 - 12) + '" r="4.2" class="open' + (isRoot ? ' root' : '') + '"/>';
        else s += '<circle cx="' + cx + '" cy="' + (y0 + (x - base + 0.5) * gy) + '" r="5.6" class="dot' + (isRoot ? ' root' : '') + '"/>';
      }
    });
    return s + '</svg>';
  }

  /* ================= toast & sheet ================= */
  var toastT = null;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  var sheetChord = null, sheetCtx = null;
  function openSheet(c, ctx) {
    sheetChord = c; sheetCtx = ctx || null;
    var info = E.chordInfo(c.pc, c.q, c.name), vs = E.voicings(c.pc, c.q);
    var bi = ctx && ctx.indexOf('b:') === 0 ? +ctx.slice(2) : -1;
    var h = '<div class="grab"></div><div class="sh-top"><div><div class="big">' + symHTML(c) + '</div><div class="sub">' + esc(cap(Q[c.q].name)) + '</div></div>' +
      '<button class="icon star' + (isFav(c) ? ' on' : '') + '" data-act="fav" aria-label="Favourite">★</button></div>' +
      '<p class="desc">' + esc(CT.QUALITY_INFO[c.q] || '') + '</p>' +
      '<div class="notes">' + info.notes.map(function (n, i) { return '<span><b>' + esc(pRoot(n)) + '</b><i>' + esc(pQual(info.formula.split(' ')[i])) + '</i></span>'; }).join('') + '</div>' +
      '<div class="sh-dias">' + vs.slice(0, 3).map(function (v, i) { return '<button class="dia-btn" data-act="voicing" data-c="' + esc(enc(c)) + '" data-v="' + i + '">' + diagram(v, c.pc, true) + '<span>' + esc(v.label) + '</span></button>'; }).join('') + '</div>' +
      '<div class="row gap">' +
      '<button class="btn primary" data-act="play" data-c="' + esc(enc(c)) + '">▶ Play</button>' +
      '<button class="btn" data-act="open" data-c="' + esc(enc(c)) + '">Open chord</button>' +
      (bi >= 0 ? '' : '<button class="btn" data-act="add" data-c="' + esc(enc(c)) + '">+ Create</button>') + '</div>';
    if (bi >= 0) {
      h += '<div class="row gap mt"><button class="btn sm" data-act="b-move" data-d="-1">← Move</button><button class="btn sm" data-act="b-move" data-d="1">Move →</button>' +
        '<button class="btn sm danger" data-act="b-remove">Remove</button></div>';
    }
    $('#sheet-body').innerHTML = h;
    document.body.classList.add('sheet-open');
    if (setting('autoplay')) Snd.playChord(c);
    haptic('light');
  }
  function closeSheet() { document.body.classList.remove('sheet-open'); sheetChord = null; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ================= playback with highlighting ================= */
  var playingId = null;
  function playList(id, chords, o) {
    o = o || {};
    if (playingId === id) { Snd.stop(); return; }
    Snd.stop();
    playingId = id; markPlaying();
    Snd.playSeq(chords, {
      bpm: o.bpm || setting('bpm'), beats: o.beats || setting('beats'), loop: !!o.loop,
      onStep: function (i) { $$('[data-seq="' + id + '"] .chip').forEach(function (el) { el.classList.toggle('on', +el.dataset.i === i); }); },
      onEnd: function () { if (playingId === id) { playingId = null; markPlaying(); } $$('[data-seq="' + id + '"] .chip.on').forEach(function (el) { el.classList.remove('on'); }); }
    });
    var mp = $('#miniplayer'); mp.querySelector('.mp-t').innerHTML = chords.slice(0, 8).map(symHTML).join(' <i>–</i> ') + (chords.length > 8 ? ' …' : '');
    haptic('light');
  }
  function markPlaying() {
    $$('[data-play]').forEach(function (b) { var on = b.dataset.play === playingId; b.classList.toggle('playing', on); b.innerHTML = on ? '■ Stop' : (b.dataset.label || '▶ Play'); });
    document.body.classList.toggle('mp-on', !!playingId);
  }
  function playBtn(id, label, cls) { return '<button class="btn ' + (cls || 'primary') + '" data-act="playlist" data-play="' + id + '" data-label="' + esc(label || '▶ Play') + '">' + (playingId === id ? '■ Stop' : (label || '▶ Play')) + '</button>'; }
  var lists = {}; // id -> {chords, opts}
  function regList(id, chords, o) { lists[id] = { chords: chords, o: o || {} }; return id; }

  /* ================= router ================= */
  var TABS = [['home', 'Home', 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z'], ['chords', 'Chords', 'M6 3h12v18H6zM6 8h12M6 13h12M10 3v18M14 3v18'],
    ['create', 'Create', 'M12 4v16M4 12h16'], ['progs', 'Progressions', 'M4 6h16M4 12h10M4 18h13'], ['saved', 'Saved', 'M6 3h12v18l-6-4-6 4z']];
  var routeHist = [];
  function route() { var h = location.hash.replace(/^#\/?/, ''); var parts = h.split('/').map(function (p) { try { return decodeURIComponent(p); } catch (e) { return p; } }); return { name: parts[0] || 'home', arg: parts[1] || '', full: h }; }
  function go(path) { location.hash = '#/' + path; }
  var PAGES = {};
  var scrollMem = {};
  function render(dir) {
    var r = route(), page = PAGES[r.name] || PAGES.home;
    var app = $('#pages'), all = app.querySelectorAll('.page'), old = all[all.length - 1] || null;
    if (old) scrollMem[old.dataset.route] = old.scrollTop;
    var el = document.createElement('section'); el.className = 'page'; el.dataset.route = r.full;
    var res = page(r.arg, r);
    var tabName = res.tab || r.name;
    el.innerHTML = '<header class="nav"><div class="nav-l">' + (res.back ? '<button class="back" data-act="back" aria-label="Back"><svg viewBox="0 0 24 24"><path d="M15 4 7 12l8 8"/></svg>' + esc(res.backLabel || 'Back') + '</button>' : '') + '</div>' +
      '<div class="nav-t">' + (res.navTitle || res.title || '') + '</div><div class="nav-r">' + (res.navRight || '') + '</div></header>' +
      '<div class="content">' + (res.title ? '<h1 class="lt">' + res.title + '</h1>' : '') + res.html + '</div>';
    if (dir === 'push') el.classList.add('in-push'); else if (dir === 'pop') el.classList.add('in-pop');
    app.appendChild(el);
    el.addEventListener('animationend', function () { el.classList.remove('in-push', 'in-pop'); });
    $$('.page', app).forEach(function (pg) { if (pg !== el && pg !== old && pg.parentNode) pg.parentNode.removeChild(pg); });
    if (old) {
      old.className = 'page';
      if (dir === 'push') old.classList.add('out-push'); else if (dir === 'pop') old.classList.add('out-pop'); else old.remove();
      setTimeout(function () { if (old.parentNode) old.remove(); }, 380);
    }
    if (dir === 'pop' && scrollMem[r.full]) el.scrollTop = scrollMem[r.full];
    el.addEventListener('scroll', function () { el.classList.toggle('scrolled', el.scrollTop > 40); }, { passive: true });
    $$('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tabName); });
    if (res.mount) res.mount(el);
    markPlaying();
  }
  window.addEventListener('hashchange', function () {
    var cur = route().full, i = routeHist.lastIndexOf(cur), dir;
    var tabSwitch = TABS.some(function (t) { return t[0] === cur; }) && !/\//.test(cur);
    if (i >= 0 && i === routeHist.length - 2) { routeHist.pop(); dir = 'pop'; }
    else { routeHist.push(cur); dir = tabSwitch ? 'fade' : 'push'; }
    if (tabSwitch) routeHist = [cur];
    closeSheet(); render(dir);
  });
  function back() { if (routeHist.length > 1) history.back(); else go('home'); }

  /* ================= pages ================= */
  // ---------- HOME
  PAGES.home = function () {
    var b = builder(), rec = Store.get('recent', []).map(dec);
    var tiles = [
      ['chords', 'Chord explorer', 'Any chord, what goes next, shapes', 'c1', '♪'],
      ['create', 'Create progression', 'Pick or roll chords, get options', 'c2', '✦'],
      ['progs', 'Famous progressions', '34 classics in every key', 'c3', '≋'],
      ['keys', 'Keys & scales', 'Every chord in a key or mode', 'c4', '◎'],
      ['types', 'Chord types', 'All 35 qualities explained', 'c5', '◆'],
      ['learn', 'Learn theory', 'Tiers, concepts, how-to', 'c6', '✎'],
      ['saved', 'Saved', 'Favourites & your progressions', 'c7', '★'],
      ['settings', 'Settings', 'Sound, tempo, display', 'c8', '⚙']
    ];
    var h = '<form class="search" data-form="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>' +
      '<input name="q" placeholder="Type a chord, e.g. F#m7b5" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"></form><div class="hint" id="search-msg"></div>';
    if (b.length) h += '<button class="card continue" data-act="nav" data-to="create"><div class="cap">Your progression</div><div class="chips">' + b.map(function (c) { return '<span class="chip">' + symHTML(c) + '</span>'; }).join('') + '</div><div class="more">Continue in Create ›</div></button>';
    h += '<div class="tiles">' + tiles.map(function (t) { return '<button class="tile ' + t[3] + '" data-act="nav" data-to="' + t[0] + '"><span class="ti">' + t[4] + '</span><b>' + t[1] + '</b><span>' + t[2] + '</span></button>'; }).join('') + '</div>';
    h += '<button class="btn wide mt" data-act="surprise">🎲 Surprise me with a chord</button>';
    if (rec.length) h += '<h2 class="sec">Recent chords</h2><div class="chips wrap">' + rec.map(function (c) { return chip(c); }).join('') + '</div>';
    return { title: 'Chord Atlas', html: h, navTitle: 'Chord Atlas', navRight: '<button class="icon" data-act="nav" data-to="settings" aria-label="Settings">⚙</button>' };
  };

  // ---------- CHORD PICKER
  var pick = { pc: 0, q: 'maj' };
  PAGES.chords = function (arg) {
    var picking = arg === 'pick';
    var roots = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    var h = '<form class="search" data-form="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>' +
      '<input name="q" placeholder="Type a chord name" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"></form><div class="hint" id="search-msg"></div>';
    h += '<h2 class="sec">Root</h2><div class="roots">' + roots.map(function (p) {
      var a = E.NAME_MAJ[p], b = E.NAME_MIN[p];
      return '<button class="root' + (p === pick.pc ? ' on' : '') + '" data-act="pick-root" data-pc="' + p + '">' + esc(pRoot(a)) + (a !== b ? '<small>' + esc(pRoot(b)) + '</small>' : '') + '</button>';
    }).join('') + '</div>';
    CT.QUALITY_GROUPS.forEach(function (g) {
      h += '<h2 class="sec">' + g.title + '</h2><div class="quals">' + g.ids.map(function (id) {
        return '<button class="qual' + (id === pick.q ? ' on' : '') + '" data-act="pick-q" data-q="' + id + '">' + (Q[id].sym ? esc(pQual(Q[id].sym)) : 'maj') + '</button>';
      }).join('') + '</div>';
    });
    h += '<div class="pick-spacer"></div><div class="pick-bar" id="pick-bar"></div>';
    return { title: picking ? 'Add a chord' : 'Chords', html: h, back: picking, backLabel: 'Create', tab: picking ? 'create' : 'chords',
      mount: function () { renderPickBar(picking); } };
  };
  function pickChord() { var nm = E.rootName(pick.pc, pick.q); return mk(pick.pc, pick.q, nm); }
  function renderPickBar(picking) {
    var c = pickChord(), info = E.chordInfo(c.pc, c.q, c.name), v = E.voicings(c.pc, c.q)[0];
    var bar = $('#pick-bar'); if (!bar) return;
    bar.innerHTML = '<div class="pb-l">' + (v ? diagram(v, c.pc, true) : '') + '</div><div class="pb-m"><div class="big">' + symHTML(c) + '</div><div class="sub">' + esc(cap(Q[c.q].name)) + '</div><div class="nt">' + info.notes.map(pRoot).join(' · ') + '</div></div>' +
      '<div class="pb-r"><button class="btn sm" data-act="play" data-c="' + esc(enc(c)) + '">▶</button>' +
      (picking ? '<button class="btn sm primary" data-act="pick-add" data-c="' + esc(enc(c)) + '">Add</button>' : '<button class="btn sm primary" data-act="open" data-c="' + esc(enc(c)) + '">Open</button>') + '</div>';
  }

  // ---------- CHORD DETAIL
  var chordTab = 'next', showAllNext = false;
  PAGES.chord = function (arg) {
    var c = arg ? dec(arg) : null;
    if (!c || !Q[c.q]) return PAGES.home();
    pushRecent(c);
    var a = E.analyze(c.pc, c.q, { level: levelOpt(), name: c.name }), info = a.chord;
    var h = '<div class="hero"><div class="hero-top"><div><div class="huge">' + symHTML(c) + '</div><div class="sub">' + esc(cap(Q[c.q].name)) + '</div></div>' +
      '<button class="icon star' + (isFav(c) ? ' on' : '') + '" data-act="fav-page" data-c="' + esc(enc(c)) + '" aria-label="Favourite">★</button></div>' +
      '<p class="desc">' + esc(CT.QUALITY_INFO[c.q] || '') + '</p>' +
      '<div class="notes">' + info.notes.map(function (n, i) { return '<span><b>' + esc(pRoot(n)) + '</b><i>' + esc(pQual(info.formula.split(' ')[i])) + '</i></span>'; }).join('') + '</div>' +
      '<div class="row gap"><button class="btn primary" data-act="play" data-c="' + esc(enc(c)) + '">▶ Play</button><button class="btn" data-act="add" data-c="' + esc(enc(c)) + '">+ Add to Create</button></div></div>';
    h += '<h2 class="sec">Guitar shapes <span class="aside">tap to hear</span></h2><div class="dias">' + a.voicings.map(function (v, i) {
      return '<button class="dia-btn" data-act="voicing" data-c="' + esc(enc(c)) + '" data-v="' + i + '">' + diagram(v, c.pc) + '<span>' + esc(v.label) + '</span><code>' + esc(v.tab) + '</code></button>';
    }).join('') + '</div>';
    var tabs = [['next', 'Next'], ['keys', 'Keys'], ['moves', 'Moves'], ['lead', 'Lead-ins'], ['progs', 'Progressions']];
    h += '<div class="seg sticky" role="tablist">' + tabs.map(function (t) { return '<button class="' + (chordTab === t[0] ? 'on' : '') + '" data-act="ctab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    h += '<div class="filters"><div class="seg small">' + [['auto', 'Auto'], ['0', 'Triads'], ['1', '7ths'], ['2', 'Ext.']].map(function (l) {
      return '<button class="' + (String(setting('level')) === l[0] ? 'on' : '') + '" data-act="level" data-l="' + l[0] + '">' + l[1] + '</button>'; }).join('') + '</div>' +
      '<div class="tiers">' + [1, 2, 3, 4].map(function (t) { return '<button class="tierf t' + t + (tierOk(t) ? ' on' : '') + '" data-act="tierf" data-t="' + t + '">' + TIER_NAME[t] + '</button>'; }).join('') +
      '<button class="icon q" data-act="nav" data-to="learn/tiers" aria-label="What are tiers?">?</button></div></div>';
    h += '<div id="ctab-body">' + chordTabBody(c, a) + '</div>';
    return { title: '', navTitle: symHTML(c), html: h, back: true, tab: 'chords' };
  };
  function chordTabBody(c, a) {
    var h = '', cur = c;
    if (chordTab === 'next') {
      var list = a.ranked.filter(function (r) { return tierOk(r.tier); });
      h += '<p class="explain">Chords that sound good <b>after</b> ' + symHTML(c) + ', best first. Tap ▶ to hear the change, tap a chord for details.</p>';
      if (!list.length) h += '<p class="empty">No suggestions with the current tier filter. Turn on more tiers above.</p>';
      var lim = showAllNext ? list.length : 30;
      h += '<div class="list">' + list.slice(0, lim).map(function (r, i) {
        var t = mk(r.pc, r.q, r.name), id = regList('nx' + i, [cur, t], { bpm: 110, beats: 2 });
        return '<div class="li"><div class="li-m">' + chip(t, { tier: r.tier }) + '<div class="why">' + r.reasons.slice(0, 2).map(function (x) { return '<div>' + pText(x) + '</div>'; }).join('') +
          (r.reasons.length > 2 ? '<details><summary>+' + (r.reasons.length - 2) + ' more reasons</summary>' + r.reasons.slice(2).map(function (x) { return '<div>' + pText(x) + '</div>'; }).join('') + '</details>' : '') + '</div></div>' +
          '<div class="li-r">' + tierBadge(r.tier) + '<button class="pbtn" data-act="playlist" data-play="' + id + '" data-label="▶" aria-label="Play the change">▶</button></div></div>';
      }).join('') + '</div>';
      if (list.length > lim) h += '<button class="btn wide" data-act="more-next">Show all ' + list.length + '</button>';
    } else if (chordTab === 'keys') {
      h += '<p class="explain">Every key, mode and scale where ' + symHTML(c) + ' is a native chord, its Roman numeral there, and the usual next chords inside that key.' +
        (a.keys.core ? ' Placed through its core chord <b>' + esc(symText(fromSym(a.keys.core) || c)) + '</b>, because its colour tones sit outside every 7-note scale.' : '') + '</p>';
      var groups = { key: 'Major & minor keys', mode: 'Modes', exotic: 'Exotic scales' };
      Object.keys(groups).forEach(function (g) {
        var cs = a.keys.contexts.filter(function (k) { return k.group === g; }); if (!cs.length) return;
        h += '<h3 class="sub-h">' + groups[g] + '</h3>';
        cs.forEach(function (k, i) {
          var nx = k.next.filter(function (n) { return tierOk(n.tier); });
          h += '<div class="card kc"><div class="kc-h"><span class="roman">' + esc(pRoman(k.role)) + '</span> in <b>' + pText(k.key) + '</b>' + (k.variant && k.variant !== 'natural' ? ' <span class="aside">(' + k.variant + ' minor)</span>' : '') +
            (k.as ? ' <span class="aside">spelled as ' + pText(k.as) + '</span>' : '') + '</div>' +
            '<div class="chips wrap">' + nx.map(function (n) { return chip(mk(n.pc, n.q, n.to.slice(0, n.to.length - Q[n.q].sym.length)), { tier: n.tier, roman: n.roman }); }).join('') + (nx.length ? '' : '<span class="aside">No moves at this tier filter.</span>') + '</div></div>';
        });
      });
      if (!a.keys.contexts.length) h += '<p class="empty">This chord does not live in any of the scales checked. It is used chromatically — see Moves.</p>';
    } else if (chordTab === 'moves') {
      h += '<p class="explain">Key-free moves: substitutions, borrowed chords, passing chords, third relations and more, each starting from ' + symHTML(c) + '.</p>';
      a.moves.forEach(function (g, gi) {
        var ms = g.moves.filter(function (m) { return tierOk(m.tier); }); if (!ms.length) return;
        h += '<h3 class="sub-h">' + esc(g.title) + '</h3>';
        ms.forEach(function (m, i) {
          var steps = [cur].concat(m.steps.map(function (s) { return mk(s.pc, s.q, s.name); })), id = regList('mv' + gi + '_' + i, steps, { bpm: 104, beats: 2 });
          h += moveCard(id, m.label, m.why, steps, m.tier);
        });
      });
    } else if (chordTab === 'lead') {
      h += '<p class="explain">Ways to arrive <b>into</b> ' + symHTML(c) + '.</p>';
      a.approach.filter(function (m) { return tierOk(m.tier); }).forEach(function (m, i) {
        var steps = m.steps.map(function (s) { return mk(s.pc, s.q, s.name); }), id = regList('ap' + i, steps, { bpm: 104, beats: 2 });
        h += moveCard(id, m.label, m.why, steps, m.tier);
      });
    } else if (chordTab === 'progs') {
      h += '<p class="explain">Famous progressions that contain ' + symHTML(c) + ', written out in the matching key.</p>';
      a.progressions.filter(function (p) { return tierOk(p.tier); }).forEach(function (p, i) {
        var steps = p.steps.map(function (s) { return mk(s.pc, s.q, s.name); }), id = regList('pg' + i, steps, { loop: true });
        var mood = CT.PROG_MOODS[p.name];
        h += '<div class="card"><div class="card-h"><b>' + pText(p.name) + '</b>' + tierBadge(p.tier) + '</div><div class="aside">' + pText(p.key) + ' · ' + pText(p.roman) + '</div>' +
          '<div class="chips wrap" data-seq="' + id + '">' + steps.map(function (s, k) { return chip(s, { i: k, cls: p.highlight.indexOf(k) >= 0 ? 'hl' : '' }); }).join('') + '</div>' +
          (mood ? '<div class="tags">' + mood.tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
          '<div class="row gap">' + playBtn(id) + '<button class="btn" data-act="to-create" data-list="' + id + '">Open in Create</button></div></div>';
      });
    }
    return h;
  }
  function moveCard(id, label, why, steps, tier) {
    return '<div class="card mv"><div class="card-h"><b>' + pText(label) + '</b>' + tierBadge(tier) + '</div><div class="why">' + pText(why) + '</div>' +
      '<div class="chips wrap chain" data-seq="' + id + '">' + steps.map(function (s, k) { return chip(s, { i: k }); }).join('<span class="arr">→</span>') + '</div>' +
      '<div class="row gap">' + playBtn(id, '▶ Play', 'sm') + '<button class="btn sm" data-act="to-create" data-list="' + id + '">Open in Create</button></div></div>';
  }

  // ---------- CREATE
  var createFilter = 'all';
  PAGES.create = function () {
    var b = builder(), dice = Store.get('dice', { n: 4, mode: 'simple', sameKey: false });
    var h = '<p class="explain">Pick any chords — they don\'t need to fit together. Then tap <b>Create progression</b> to get several ways to play them, each with its feeling explained.</p>';
    h += '<div class="card builder"><div class="card-h"><b>Your chords</b><span class="aside">' + b.length + '/8</span></div>' +
      '<div class="chips wrap big" data-seq="bld">' + (b.length ? b.map(function (c, i) { return chip(c, { i: i, ctx: 'b:' + i }); }).join('') : '<span class="empty">No chords yet — add some or roll the dice.</span>') + '</div>' +
      '<div class="row gap"><button class="btn" data-act="nav" data-to="chords/pick">+ Add chord</button><button class="btn" data-act="dice">🎲 Random</button>' +
      (b.length ? '<button class="btn ghost" data-act="b-clear">Clear</button>' : '') + '</div>' +
      '<details class="dice-opts"' + (Store.get('diceOpen', false) ? ' open' : '') + '><summary>Random options</summary>' +
      '<div class="opt"><span>How many chords</span><div class="stepper"><button data-act="dice-n" data-d="-1">−</button><b>' + dice.n + '</b><button data-act="dice-n" data-d="1">+</button></div></div>' +
      '<div class="opt col"><span>Chord types</span><div class="seg small">' + [['simple', 'Simple'], ['sevenths', 'With 7ths'], ['any', 'Anything']].map(function (m) { return '<button class="' + (dice.mode === m[0] ? 'on' : '') + '" data-act="dice-mode" data-m="' + m[0] + '">' + m[1] + '</button>'; }).join('') + '</div></div>' +
      '<label class="opt"><span>Keep them in one key</span><input type="checkbox" class="sw" data-act="dice-key"' + (dice.sameKey ? ' checked' : '') + '></label></details></div>';
    if (b.length) h += '<div class="row gap">' + playBtn(regList('bld', b, { loop: setting('loop') }), '▶ Play as is', '') + '</div>';
    h += modalPickHTML();
    h += '<button class="btn primary wide xl" data-act="create"' + (b.length < 2 ? ' disabled' : '') + '>✦ Create progression</button>';
    if (b.length < 2) h += '<p class="hint c">Add at least 2 chords.</p>';
    var res = Store.get('results', null);
    if (res && res.options) h += resultsHTML(res);
    return { title: 'Create', html: h };
  };
  var MODAL_CHOICES = [['off', 'Off'], ['auto', 'Auto']].concat(G.MODE_ORDER.map(function (m) { return [m, G.MODES[m].name.replace(/ \(.*\)$/, '')]; }));
  function modalPickHTML() {
    var cur = Store.get('modal', 'off');
    var hint = cur === 'off' ? 'Borrow chords from a parallel mode on the same home note for extra colour.' :
      cur === 'auto' ? 'Tries every mode and shows the three that fit your chords best.' : G.MODES[cur].short;
    return '<div class="card modal-pick"><div class="card-h"><b>Modal colour</b>' + (cur !== 'off' ? '<span class="aside"><i class="mc"></i> on</span>' : '') + '</div>' +
      '<div class="hscroll">' + MODAL_CHOICES.map(function (m) { return '<button class="root sm' + (cur === m[0] ? ' on' : '') + '" data-act="modal-set" data-m="' + m[0] + '">' + esc(m[1]) + '</button>'; }).join('') + '</div>' +
      '<p class="hint">' + pText(hint) + '</p></div>';
  }
  function resultsHTML(res) {
    var k = res.key;
    var h = '<div class="keybox"><div><div class="cap">Best-fitting key</div><b>' + pText(k.name) + '</b></div><div class="aside">' + k.fit + ' of ' + k.total + ' chords belong to it' + (k.fit < k.total ? '; the others are borrowed or chromatic colours' : '') + '</div></div>';
    if (res.modalNote) h += '<p class="hint modal-note"><i class="mc"></i> ' + pText(res.modalNote) + '</p>';
    var filters = [['all', 'All'], ['mine', 'Only my chords'], ['added', 'With connectors']];
    if (res.options.some(function (o) { return o.kind === 'modal'; })) filters = [['all', 'All'], ['mine', 'Only mine'], ['added', 'Connectors'], ['modal', 'Modal']];
    else if (createFilter === 'modal') createFilter = 'all';
    h += '<div class="seg small">' + filters.map(function (f) { return '<button class="' + (createFilter === f[0] ? 'on' : '') + '" data-act="cfilter" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>';
    h += '<div class="opt-play"><label class="opt"><span>Loop playback</span><input type="checkbox" class="sw" data-act="set-bool" data-k="loop"' + (setting('loop') ? ' checked' : '') + '></label>' +
      '<label class="opt"><span>Use suggested tempo</span><input type="checkbox" class="sw" data-act="set-bool" data-k="useSuggestedTempo"' + (setting('useSuggestedTempo') ? ' checked' : '') + '></label></div>';
    res.options.forEach(function (o, oi) {
      if (createFilter !== 'all' && o.kind !== createFilter) return;
      var chords = o.chords.map(function (c) { return mk(c.pc, c.q, c.name); });
      var id = regList('opt' + oi, chords, { loop: setting('loop'), bpm: setting('useSuggestedTempo') ? o.bpm : setting('bpm') });
      h += '<div class="card opt-card"><div class="card-h"><b>' + esc(o.title) + '</b><span class="stars" aria-label="Flow ' + o.stars + ' of 5">' + '★★★★★'.slice(0, o.stars) + '<i>' + '★★★★★'.slice(o.stars) + '</i></span></div>' +
        '<div class="kind ' + o.kind + '">' + (o.kind === 'mine' ? 'Only your chords' : o.kind === 'modal' ? '<i class="mc"></i> ' + o.modal + ' chord' + (o.modal > 1 ? 's' : '') + ' borrowed from ' + esc(o.modeName) : '+' + o.added + ' connecting chord' + (o.added > 1 ? 's' : '')) + ' · ' + o.bpm + ' bpm suggested</div>' +
        '<div class="chips wrap" data-seq="' + id + '">' + o.chords.map(function (c, k) { return chip(mk(c.pc, c.q, c.name), { i: k, roman: c.roman, cls: c.added ? 'added' : c.modal ? 'modal' : '', pre: c.added ? '<em>+</em>' : c.modal ? '<i class="mc"></i>' : '' }); }).join('') + '</div>' +
        '<div class="tags">' + o.mood.tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<p class="mood">' + pText(o.blurb) + ' ' + pText(o.mood.text) + '</p>' +
        (o.mood.genres.length ? '<p class="aside">Good for: ' + esc(o.mood.genres.join(', ')) + '</p>' : '') +
        '<details class="why-d"><summary>Why it works — step by step</summary>' + o.transitions.map(function (t) {
          return '<div class="tr"><span class="tr-c">' + pText(t.from) + ' → ' + pText(t.to) + (t.loopBack ? ' <i>(loop)</i>' : '') + '</span>' + (t.tier <= 4 ? tierBadge(t.tier) : '<span class="badge t5">Unusual</span>') +
            '<div class="why">' + pText(t.why) + '</div>' + (t.connector ? '<div class="why add">Added: ' + pText(t.connector) + '</div>' : '') + (t.borrowed ? '<div class="why borrow"><i class="mc"></i> ' + pText(t.borrowed.charAt(0).toUpperCase() + t.borrowed.slice(1)) + '</div>' : '') + '</div>';
        }).join('') + '</details>' +
        '<div class="row gap">' + playBtn(id) + '<button class="btn" data-act="save-opt" data-o="' + oi + '">☆ Save</button><button class="btn" data-act="use-opt" data-o="' + oi + '">Edit</button></div></div>';
    });
    return h;
  }

  // ---------- PROGRESSIONS LIBRARY
  var lib = { t: 0, f: 'all', level: 0 };
  function realize(p, t, level) {
    var sys = p[1], tq = (sys === 'minor' || sys === 'dorian' || sys === 'phrygian') ? 'm' : 'maj';
    var tonicNm = E.rootName(t, tq);
    return p[2].map(function (s) {
      var q = E.slotQuality(sys, s[0], s[1], level);
      return mk(t + s[0], q, E.relName(tonicNm, s[0], s[2], q));
    });
  }
  function progCat(p) { if (p[3] >= 3) return 'adv'; if (p[1] === 'major') return 'major'; if (p[1] === 'minor') return 'minor'; return 'modal'; }
  PAGES.progs = function () {
    var h = '<p class="explain">Classic progressions with the feeling they create. Choose a key and chord size, then listen.</p>';
    h += '<div class="hscroll keys">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (p) { return '<button class="root sm' + (lib.t === p ? ' on' : '') + '" data-act="lib-key" data-pc="' + p + '">' + esc(pRoot(E.NAME_MAJ[p])) + '</button>'; }).join('') + '</div>';
    h += '<div class="seg small">' + [['all', 'All'], ['major', 'Major'], ['minor', 'Minor'], ['modal', 'Modal'], ['adv', 'Advanced']].map(function (f) { return '<button class="' + (lib.f === f[0] ? 'on' : '') + '" data-act="lib-f" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>';
    h += '<div class="seg small">' + [[0, 'Triads'], [1, 'Sevenths'], [2, 'Extended']].map(function (l) { return '<button class="' + (lib.level === l[0] ? 'on' : '') + '" data-act="lib-l" data-l="' + l[0] + '">' + l[1] + '</button>'; }).join('') + '</div>';
    E.PROGS.forEach(function (p, i) {
      if (lib.f !== 'all' && progCat(p) !== lib.f) return;
      var chords = realize(p, lib.t, lib.level), id = regList('lib' + i, chords, { loop: true, bpm: 96 }), m = CT.PROG_MOODS[p[0]] || { tags: [], text: '' };
      var tq = (p[1] === 'minor' || p[1] === 'dorian' || p[1] === 'phrygian') ? 'm' : 'maj';
      h += '<div class="card"><div class="card-h"><b>' + pText(p[0]) + '</b>' + tierBadge(p[3]) + '</div><div class="aside">' + pText(E.rootName(lib.t, tq) + ' ' + E.SYS_LABEL[p[1]]) + ' · ' + pText(p[4]) + '</div>' +
        '<div class="chips wrap" data-seq="' + id + '">' + chords.map(function (c, k) { return chip(c, { i: k }); }).join('') + '</div>' +
        '<div class="tags">' + m.tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div><p class="mood">' + pText(m.text) + '</p>' +
        (m.songs ? '<p class="aside">Heard in: ' + esc(m.songs) + '</p>' : '') +
        '<div class="row gap">' + playBtn(id) + '<button class="btn" data-act="to-create" data-list="' + id + '">Open in Create</button><button class="btn" data-act="save-list" data-list="' + id + '" data-name="' + esc(p[0]) + '">☆</button></div></div>';
    });
    return { title: 'Progressions', html: h };
  };

  // ---------- KEYS & SCALES
  var keySel = { t: 0, s: 'major', level: 0 };
  PAGES.keys = function () {
    var sc = CT.SCALES.filter(function (x) { return x.id === keySel.s; })[0] || CT.SCALES[0];
    var tonicNm = E.rootName(keySel.t, sc.tq === 'dim' ? 'm' : sc.tq);
    var h = '<div class="hscroll keys">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (p) { return '<button class="root sm' + (keySel.t === p ? ' on' : '') + '" data-act="key-t" data-pc="' + p + '">' + esc(pRoot(E.rootName(p, sc.tq === 'dim' ? 'm' : sc.tq))) + '</button>'; }).join('') + '</div>';
    h += '<div class="hscroll">' + CT.SCALES.map(function (s) { return '<button class="pill' + (s.id === keySel.s ? ' on' : '') + '" data-act="key-s" data-s="' + s.id + '">' + esc(s.name) + '</button>'; }).join('') + '</div>';
    h += '<div class="seg small">' + [[0, 'Triads'], [1, 'Sevenths'], [2, 'Extended']].map(function (l) { return '<button class="' + (keySel.level === l[0] ? 'on' : '') + '" data-act="key-l" data-l="' + l[0] + '">' + l[1] + '</button>'; }).join('') + '</div>';
    var notes = sc.scale.map(function (iv, i) { return E.relName(tonicNm, iv, i + 1, 'maj'); });
    h += '<div class="card"><div class="card-h"><b>' + esc(pRoot(tonicNm)) + ' ' + esc(sc.name) + '</b><button class="btn sm" data-act="scale-play">▶ Scale</button></div><p class="mood">' + esc(sc.mood) + '</p>' +
      '<div class="notes">' + notes.map(function (n, i) { return '<span><b>' + esc(pRoot(n)) + '</b><i>' + (i + 1) + '</i></span>'; }).join('') + '</div></div>';
    var FN = sc.sys === 'major' ? ['Tonic', 'Predominant', 'Tonic (weak)', 'Predominant', 'Dominant', 'Tonic (relative)', 'Dominant'] :
      sc.sys === 'minor' ? ['Tonic', 'Predominant', 'Tonic (relative)', 'Predominant', 'Dominant', 'Predominant', sc.id === 'natural' ? 'Subtonic' : 'Dominant'] : null;
    var chords = sc.scale.map(function (iv, i) {
      var q = E.stackQuality(sc.scale, iv, keySel.level) || E.stackQuality(sc.scale, iv, 0);
      return q ? { c: mk(keySel.t + iv, q, E.relName(tonicNm, iv, i + 1, q)), roman: E.romanFor(iv, q), fn: FN ? FN[i] : '' } : null;
    });
    var all = chords.filter(Boolean).map(function (x) { return x.c; }), id = regList('keyall', all, { bpm: 100, beats: 2 });
    h += '<div class="card"><div class="card-h"><b>Chords in this key</b>' + playBtn(id, '▶ All', 'sm') + '</div><div class="list" data-seq="' + id + '">' + chords.map(function (x, i) {
      if (!x) return '<div class="li"><span class="aside">Degree ' + (i + 1) + ': no standard chord</span></div>';
      return '<div class="li"><div class="li-m"><span class="roman w">' + esc(pRoman(x.roman)) + '</span>' + chip(x.c, { i: all.indexOf(x.c) }) + '<span class="aside">' + esc(x.fn) + '</span></div></div>';
    }).join('') + '</div></div>';
    // matching library progressions
    var sysMap = { major: 'major', natural: 'minor', harmonic: 'minor', melodic: 'minor', dorian: 'dorian', phrygian: 'phrygian', mixolydian: 'mixolydian', phrygdom: 'phrygdom', lydian: 'major' };
    var want = sysMap[sc.id];
    var ps = E.PROGS.filter(function (p) { return p[1] === want && (sc.id !== 'lydian' || p[0] === 'Lydian shuttle'); });
    if (ps.length) {
      h += '<h2 class="sec">Progressions to try in ' + esc(pRoot(tonicNm)) + ' ' + esc(sc.name.split(' (')[0]) + '</h2>';
      ps.forEach(function (p, i) {
        var cs = realize(p, keySel.t, keySel.level), pid = regList('kp' + i, cs, { loop: true, bpm: 96 });
        h += '<div class="card"><div class="card-h"><b>' + pText(p[0]) + '</b>' + tierBadge(p[3]) + '</div><div class="aside">' + pText(p[4]) + '</div><div class="chips wrap" data-seq="' + pid + '">' + cs.map(function (c, k) { return chip(c, { i: k }); }).join('') + '</div>' +
          '<div class="row gap">' + playBtn(pid, '▶ Play', 'sm') + '<button class="btn sm" data-act="to-create" data-list="' + pid + '">Open in Create</button></div></div>';
      });
    }
    return { title: 'Keys & scales', html: h, back: true, tab: 'home' };
  };

  // ---------- CHORD TYPES
  PAGES.types = function () {
    var root = Store.get('typesRoot', 0);
    var h = '<p class="explain">All 35 chord qualities with their formula and sound. Shown on <b>' + esc(pRoot(E.NAME_MAJ[root])) + '</b> — change the root:</p>';
    h += '<div class="hscroll keys">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (p) { return '<button class="root sm' + (root === p ? ' on' : '') + '" data-act="types-root" data-pc="' + p + '">' + esc(pRoot(E.NAME_MAJ[p])) + '</button>'; }).join('') + '</div>';
    CT.QUALITY_GROUPS.forEach(function (g) {
      h += '<h2 class="sec">' + g.title + '</h2><div class="list">' + g.ids.map(function (id) {
        var c = mk(root, id, E.rootName(root, id)), info = E.chordInfo(c.pc, c.q, c.name);
        return '<div class="li tall"><div class="li-m">' + chip(c) + '<div class="why"><b>' + esc(cap(Q[id].name)) + '</b><div>' + esc(CT.QUALITY_INFO[id]) + '</div><div class="aside">' + esc(pQual(info.formula)) + ' · ' + info.notes.map(pRoot).join(' ') + '</div></div></div>' +
          '<div class="li-r"><button class="pbtn" data-act="play" data-c="' + esc(enc(c)) + '" aria-label="Play">▶</button></div></div>';
      }).join('') + '</div>';
    });
    return { title: 'Chord types', html: h, back: true, tab: 'home' };
  };

  // ---------- LEARN
  PAGES.learn = function (arg) {
    var h = '';
    h += '<div class="toc">' + [['howto', 'How to use'], ['tiers', 'Tiers'], ['concepts', 'Concepts'], ['diagrams', 'Diagrams'], ['scales', 'Scales'], ['data', 'About the data']].map(function (s) {
      return '<button class="pill" data-act="jump" data-id="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>';
    h += '<h2 class="sec" id="howto">How to use the app</h2><div class="card">' + CT.HOWTO.map(function (x) { return '<div class="step"><b>' + esc(x[0]) + '</b><p>' + esc(x[1]) + '</p></div>'; }).join('') + '</div>';
    h += '<h2 class="sec" id="tiers">Tiers: how common is a move?</h2><div class="card">' + CT.TIERS.map(function (t) { return '<div class="step">' + tierBadge(t.n) + '<p>' + esc(t.text) + '</p></div>'; }).join('') +
      '<p class="aside">Tiers are an editorial ranking informed by Hooktheory\'s song statistics and textbook functional harmony. In the merged "Next" list, suggestions that only work in a minor-key role, a mode or an exotic scale are pushed down a tier, because those contexts are rarer.</p></div>';
    h += '<h2 class="sec" id="concepts">Concepts</h2>';
    CT.CONCEPTS.forEach(function (c, i) {
      var cs = c.ex.map(fromSym), id = regList('cc' + i, cs, { bpm: 96, beats: 2 });
      h += '<details class="card acc"><summary>' + esc(c.t) + '</summary><p>' + pText(c.x) + '</p><div class="chips wrap" data-seq="' + id + '">' + cs.map(function (x, k) { return chip(x, { i: k }); }).join('') + '</div>' + playBtn(id, '▶ Hear example', 'sm') + '</details>';
    });
    h += '<h2 class="sec" id="diagrams">Reading chord diagrams</h2><div class="card"><div class="row gap center">' + diagram(E.voicings(0, 'maj')[0], 0) + diagram(E.voicings(5, 'maj').filter(function (v) { return v.frets[0] !== null; })[0] || E.voicings(5, 'maj')[0], 5) + '</div>' +
      '<p>Vertical lines are strings, thick low E on the left' + (setting('lefty') ? ' (mirrored: left-handed mode is on)' : '') + '. Horizontal lines are frets. Dots show where to press; <b class="acc-t">orange dots</b> are the root note. ○ above a string = play it open; × = don\'t play it. A number at the left is the starting fret, and a long bar is a barre (one finger across several strings).</p>' +
      '<p class="aside">Every shape is machine-checked: only chord tones, root in the bass, and the 3rd, 7th and defining tension present (the 5th may be omitted). Shapes listed: an open chord when one exists, a movable shape with the root on the 6th string and on the 5th, and where needed a searched voicing within a 4-fret span.</p></div>';
    h += '<h2 class="sec" id="scales">Scales & modes and their moods</h2><div class="card">' + CT.SCALES.map(function (s) { return '<div class="step"><b>' + esc(s.name) + '</b><p>' + esc(s.mood) + '</p></div>'; }).join('') +
      '<button class="btn" data-act="nav" data-to="keys">Open Keys & scales ›</button></div>';
    h += '<h2 class="sec" id="data">About the data</h2><div class="card"><p>Every suggestion is computed on your phone by the chord engine (no internet needed). It covers 420 chords (12 roots × 35 qualities).</p>' +
      '<p><b>Keys:</b> a chord "lives in" a scale when all its notes are in the scale and its triad and 7th match what stacking thirds on that degree gives — this avoids enharmonic false matches. Scales: major; natural/harmonic/melodic minor; Dorian, Mixolydian, Lydian, Phrygian; Phrygian dominant, double harmonic major and Hungarian minor.</p>' +
      '<p><b>Verified:</b> all chords analysed at all sizes without errors; voicings re-checked note by note; diatonic tables cross-checked against guitarscale.org; theory spot-checks (neo-Riemannian P/L/R/S/N/H, chromatic mediants, augmented resolutions, Coltrane, Royal Road, Pachelbel) against Open Music Theory and Wikipedia.</p>' +
      '<h3 class="sub-h">Known limits</h3><ul>' + CT.LIMITS.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' +
      '<h3 class="sub-h">Sources</h3><ul class="links">' + CT.SOURCES.map(function (s) { return '<li><a href="' + esc(s[1]) + '" data-act="ext">' + esc(s[0]) + '</a></li>'; }).join('') + '</ul></div>';
    return { title: 'Learn', html: h, back: true, tab: 'home', mount: function (el) { if (arg) setTimeout(function () { var t = el.querySelector('#' + arg); if (t) el.scrollTop = t.offsetTop - 70; }, 40); } };
  };

  // ---------- SAVED
  var delArm = null;
  PAGES.saved = function () {
    var saved = Store.get('saved', []), favs = Store.get('favs', []).map(dec), rec = Store.get('recent', []).map(dec);
    var h = '<h2 class="sec">Saved progressions</h2>';
    if (!saved.length) h += '<p class="empty">Nothing saved yet. Tap ☆ Save on any progression.</p>';
    saved.forEach(function (s, i) {
      var cs = s.chords.map(dec), id = regList('sv' + i, cs, { loop: setting('loop'), bpm: s.bpm || setting('bpm') });
      h += '<div class="card"><div class="card-h"><b>' + pText(s.name) + '</b><span class="aside">' + new Date(s.at).toLocaleDateString() + '</span></div>' +
        (s.key ? '<div class="aside">' + pText(s.key) + '</div>' : '') +
        '<div class="chips wrap" data-seq="' + id + '">' + cs.map(function (c, k) { return chip(c, { i: k }); }).join('') + '</div>' +
        (s.tags && s.tags.length ? '<div class="tags">' + s.tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
        '<div class="row gap">' + playBtn(id) + '<button class="btn" data-act="to-create" data-list="' + id + '">Edit</button><button class="btn' + (delArm === i ? ' danger' : ' ghost') + '" data-act="del-saved" data-i="' + i + '">' + (delArm === i ? 'Tap to delete' : 'Delete') + '</button></div></div>';
    });
    h += '<h2 class="sec">Favourite chords</h2>' + (favs.length ? '<div class="chips wrap">' + favs.map(function (c) { return chip(c); }).join('') + '</div>' : '<p class="empty">Tap ★ on a chord to keep it here.</p>');
    if (rec.length) h += '<h2 class="sec">Recently viewed</h2><div class="chips wrap">' + rec.map(function (c) { return chip(c); }).join('') + '</div>';
    return { title: 'Saved', html: h };
  };

  // ---------- SETTINGS
  var resetArm = false;
  PAGES.settings = function () {
    function seg(k, opts) { return '<div class="seg small">' + opts.map(function (o) { return '<button class="' + (String(setting(k)) === String(o[0]) ? 'on' : '') + '" data-act="set" data-k="' + k + '" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>'; }
    function sw(k, label, sub) { return '<label class="opt"><span>' + label + (sub ? '<small>' + sub + '</small>' : '') + '</span><input type="checkbox" class="sw" data-act="set-bool" data-k="' + k + '"' + (setting(k) ? ' checked' : '') + '></label>'; }
    var h = '<h2 class="sec">Sound</h2><div class="card form">' +
      '<div class="opt col"><span>Instrument</span>' + seg('instrument', [['guitar', 'Guitar'], ['piano', 'Piano'], ['pad', 'Pad']]) + '</div>' +
      '<div class="opt col"><span>Playing style</span>' + seg('pattern', [['strum', 'Strum'], ['arp', 'Arpeggio'], ['block', 'Block']]) + '</div>' +
      '<div class="opt col"><span>Default tempo <b id="bpm-v">' + setting('bpm') + ' bpm</b></span><input type="range" min="50" max="180" step="2" value="' + setting('bpm') + '" data-act="range" data-k="bpm"></div>' +
      '<div class="opt col"><span>Beats per chord</span>' + seg('beats', [[2, '2'], [4, '4'], [8, '8']]) + '</div>' +
      '<div class="opt col"><span>Volume</span><input type="range" min="0.1" max="1" step="0.05" value="' + setting('volume') + '" data-act="range" data-k="volume"></div>' +
      sw('autoplay', 'Play chord when tapped') + sw('loop', 'Loop progressions') + sw('useSuggestedTempo', 'Use suggested tempo in Create') +
      '<button class="btn" data-act="play" data-c="0|maj7|C">▶ Test sound</button></div>';
    h += '<h2 class="sec">Suggestions</h2><div class="card form"><div class="opt col"><span>Chord size for suggestions</span>' + seg('level', [['auto', 'Auto'], [0, 'Triads'], [1, '7ths'], [2, 'Extended']]) +
      '<small class="aside">Auto uses the size of the chord you are looking at.</small></div>' +
      '<div class="opt col"><span>Show tiers</span><div class="tiers">' + [1, 2, 3, 4].map(function (t) { return '<button class="tierf t' + t + (tierOk(t) ? ' on' : '') + '" data-act="tierf" data-t="' + t + '">' + TIER_NAME[t] + '</button>'; }).join('') + '</div></div></div>';
    h += '<h2 class="sec">Display</h2><div class="card form"><div class="opt col"><span>Appearance</span>' + seg('theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]) + '</div>' +
      sw('lefty', 'Left-handed diagrams', 'Mirror chord shapes') + sw('haptics', 'Haptic feedback') + '</div>';
    h += '<h2 class="sec">Data</h2><div class="card form"><button class="btn ' + (resetArm ? 'danger' : 'ghost') + '" data-act="reset">' + (resetArm ? 'Tap again to erase everything' : 'Reset all saved data') + '</button>' +
      '<p class="aside">Chord Atlas 1.0 · works fully offline · 420 chords, 34 progressions, 12 scales.</p></div>';
    return { title: 'Settings', html: h, back: true, tab: 'home' };
  };

  /* ================= actions ================= */
  function rerender() { var el = $('.page'); var st = el ? el.scrollTop : 0; render('none'); var n = $('.page'); if (n) n.scrollTop = st; }
  function rerenderChordTab() {
    var r = route(); if (r.name !== 'chord') return rerender();
    var c = dec(r.arg), a = E.analyze(c.pc, c.q, { level: levelOpt(), name: c.name });
    $('#ctab-body').innerHTML = chordTabBody(c, a);
    $$('[data-act="ctab"]').forEach(function (b) { b.classList.toggle('on', b.dataset.t === chordTab); });
    markPlaying();
  }
  var ACT = {
    nav: function (el) { go(el.dataset.to); },
    back: back,
    sheet: function (el) { openSheet(dec(el.dataset.c), el.dataset.ctx); },
    play: function (el) { Snd.playChord(dec(el.dataset.c)); haptic('light'); },
    voicing: function (el) {
      var c = dec(el.dataset.c), v = E.voicings(c.pc, c.q)[+el.dataset.v];
      if (v) { Snd.playMidis(v.midi.filter(function (m) { return m !== null; }), 'guitar'); haptic('light'); }
    },
    open: function (el) { closeSheet(); go('chord/' + encodeURIComponent(el.dataset.c)); },
    add: function (el) { addToBuilder(dec(el.dataset.c)); },
    fav: function (el) { if (!sheetChord) return; var on = toggleFav(sheetChord); el.classList.toggle('on', on); toast(on ? 'Added to favourites' : 'Removed from favourites'); },
    'fav-page': function (el) { var on = toggleFav(dec(el.dataset.c)); el.classList.toggle('on', on); toast(on ? 'Added to favourites' : 'Removed from favourites'); },
    playlist: function (el) { var L = lists[el.dataset.play]; if (L) playList(el.dataset.play, L.chords, L.o); },
    surprise: function () { var qs = ['maj', 'm', '7', 'maj7', 'm7', 'sus4', 'add9', 'm9', '9', 'dim7', 'm7b5', '6', 'm6']; var q = qs[Math.floor(Math.random() * qs.length)], pc = Math.floor(Math.random() * 12); go('chord/' + encodeURIComponent(enc(mk(pc, q, E.rootName(pc, q))))); },
    'pick-root': function (el) { pick.pc = +el.dataset.pc; $$('.roots .root').forEach(function (b) { b.classList.toggle('on', b === el); }); renderPickBar(route().arg === 'pick'); Snd.playChord(pickChord()); haptic('selection'); },
    'pick-q': function (el) { pick.q = el.dataset.q; $$('.qual').forEach(function (b) { b.classList.toggle('on', b === el); }); renderPickBar(route().arg === 'pick'); Snd.playChord(pickChord()); haptic('selection'); },
    'pick-add': function (el) { if (addToBuilder(dec(el.dataset.c))) back(); },
    ctab: function (el) { chordTab = el.dataset.t; showAllNext = false; Snd.stop(); rerenderChordTab(); haptic('selection'); },
    'more-next': function () { showAllNext = true; rerenderChordTab(); },
    level: function (el) { setSetting('level', el.dataset.l === 'auto' ? 'auto' : +el.dataset.l); $$('[data-act="level"]').forEach(function (b) { b.classList.toggle('on', b === el); }); rerenderChordTab(); },
    tierf: function (el) { var s = Object.assign({}, setting('tiers')); var t = el.dataset.t; s[t] = !s[t]; setSetting('tiers', s); $$('[data-act="tierf"][data-t="' + t + '"]').forEach(function (b) { b.classList.toggle('on', s[t]); }); if (route().name === 'chord') rerenderChordTab(); haptic('selection'); },
    'to-create': function (el) { var L = lists[el.dataset.list]; if (!L) return; setBuilder(L.chords.slice(0, 8)); toast('Loaded into Create'); go('create'); },
    'save-list': function (el) { var L = lists[el.dataset.list]; if (!L) return; saveProg(el.dataset.name || 'Progression', L.chords, null, [], L.o.bpm); },
    dice: function () {
      var d = Store.get('dice', { n: 4, mode: 'simple', sameKey: false }); setBuilder(G.random(d.n, d.mode, d.sameKey)); haptic('medium'); rerender();
      var b = builder(); if (b.length) playList('bld', b, { bpm: 100, beats: 2 });
    },
    'dice-n': function (el) { var d = Store.get('dice', { n: 4, mode: 'simple', sameKey: false }); d.n = Math.max(2, Math.min(8, d.n + +el.dataset.d)); Store.set('dice', d); Store.set('diceOpen', true); rerender(); },
    'dice-mode': function (el) { var d = Store.get('dice', { n: 4, mode: 'simple', sameKey: false }); d.mode = el.dataset.m; Store.set('dice', d); Store.set('diceOpen', true); rerender(); },
    'b-clear': function () { setBuilder([]); Snd.stop(); rerender(); },
    'b-move': function (el) {
      var i = +sheetCtx.slice(2), b = builder(), j = i + +el.dataset.d; if (j < 0 || j >= b.length) return;
      var t = b[i]; b[i] = b[j]; b[j] = t; setBuilder(b); sheetCtx = 'b:' + j; closeSheet(); rerender();
    },
    'b-remove': function () { var i = +sheetCtx.slice(2), b = builder(); b.splice(i, 1); setBuilder(b); closeSheet(); rerender(); },
    create: function () {
      var b = builder(); if (b.length < 2) return;
      var btn = $('[data-act="create"]'); if (btn) { btn.textContent = 'Creating…'; btn.disabled = true; }
      setTimeout(function () {
        var r = G.create(b, { modal: Store.get('modal', 'off') }); createFilter = 'all';
        Store.set('results', { key: r.key, options: r.options, modalNote: r.modalNote }); haptic('success'); rerender();
        var first = $('.keybox'); if (first) { var pg = $('.page'); pg.scrollTo({ top: first.offsetTop - 60, behavior: 'smooth' }); }
      }, 30);
    },
    cfilter: function (el) { createFilter = el.dataset.f; rerender(); },
    'modal-set': function (el) {
      var m = el.dataset.m; Store.set('modal', m); haptic('selection');
      var b = builder(), res = Store.get('results', null);
      if (res && b.length >= 2) { // refresh existing results with the new colour
        var r = G.create(b, { modal: m });
        Store.set('results', { key: r.key, options: r.options, modalNote: r.modalNote });
        createFilter = m !== 'off' && r.options.some(function (o) { return o.kind === 'modal'; }) ? 'modal' : 'all';
      }
      rerender();
    },
    'save-opt': function (el) {
      var res = Store.get('results', null); if (!res) return; var o = res.options[+el.dataset.o];
      saveProg(o.title + ' · ' + o.key, o.chords.map(function (c) { return mk(c.pc, c.q, c.name); }), o.key, o.mood.tags, o.bpm);
      el.textContent = '★ Saved';
    },
    'use-opt': function (el) { var res = Store.get('results', null); if (!res) return; var o = res.options[+el.dataset.o]; setBuilder(o.chords.slice(0, 8).map(function (c) { return mk(c.pc, c.q, c.name); })); if (o.chords.length > 8) toast('Only the first 8 chords fit in Create'); Snd.stop(); rerender(); $('.page').scrollTop = 0; },
    'lib-key': function (el) { lib.t = +el.dataset.pc; Snd.stop(); rerender(); },
    'lib-f': function (el) { lib.f = el.dataset.f; rerender(); },
    'lib-l': function (el) { lib.level = +el.dataset.l; Snd.stop(); rerender(); },
    'key-t': function (el) { keySel.t = +el.dataset.pc; Snd.stop(); rerender(); },
    'key-s': function (el) { keySel.s = el.dataset.s; Snd.stop(); rerender(); },
    'key-l': function (el) { keySel.level = +el.dataset.l; rerender(); },
    'scale-play': function () { var sc = CT.SCALES.filter(function (x) { return x.id === keySel.s; })[0]; Snd.playScale(52 + mod(keySel.t - 4), sc.scale); },
    'types-root': function (el) { Store.set('typesRoot', +el.dataset.pc); rerender(); },
    jump: function (el) { var t = document.getElementById(el.dataset.id), pg = $('.page'); if (t && pg) pg.scrollTo({ top: t.offsetTop - 64, behavior: 'smooth' }); },
    ext: function (el, ev) { ev.preventDefault(); if (!native('open', { url: el.getAttribute('href') })) window.open(el.getAttribute('href'), '_blank'); },
    'del-saved': function (el) {
      var i = +el.dataset.i; if (delArm !== i) { delArm = i; rerender(); return; }
      var s = Store.get('saved', []); s.splice(i, 1); Store.set('saved', s); delArm = null; Snd.stop(); rerender();
    },
    set: function (el) { var k = el.dataset.k, v = el.dataset.v; setSetting(k, /^\d+$/.test(v) && k !== 'theme' ? +v : v); rerender(); haptic('selection'); },
    reset: function () { if (!resetArm) { resetArm = true; rerender(); return; } Store.reset(); resetArm = false; applySettings(); toast('All data erased'); rerender(); }
  };
  function saveProg(name, chords, key, tags, bpm) {
    var s = Store.get('saved', []);
    s.unshift({ name: name, chords: chords.map(enc), key: key || null, tags: tags || [], bpm: bpm || null, at: Date.now() });
    Store.set('saved', s.slice(0, 200)); toast('Saved'); haptic('success');
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    if (el.closest('#sheet-backdrop') && el.id !== 'sheet-backdrop') { /* inside sheet */ }
    var fn = ACT[el.dataset.act]; if (fn) { ev.preventDefault(); fn(el, ev); }
  });
  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (el.dataset.act === 'set-bool') { setSetting(el.dataset.k, el.checked); haptic('selection'); if (route().name === 'create' && Store.get('results', null)) rerender(); }
    if (el.dataset.act === 'dice-key') { var d = Store.get('dice', { n: 4, mode: 'simple', sameKey: false }); d.sameKey = el.checked; Store.set('dice', d); Store.set('diceOpen', true); }
  });
  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el.dataset.act === 'range') { var v = +el.value; setSetting(el.dataset.k, v); if (el.dataset.k === 'bpm') $('#bpm-v').textContent = v + ' bpm'; }
    if (el.name === 'q') { var c = fromSym(el.value), m = $('#search-msg'); if (m) m.innerHTML = !el.value ? '' : c ? 'Press Go to open <b>' + symHTML(c) + '</b>' : 'Keep typing… e.g. Am7, F#m7b5, Bbmaj9, G7#9'; }
  });
  document.addEventListener('toggle', function (ev) { if (ev.target.classList && ev.target.classList.contains('dice-opts')) Store.set('diceOpen', ev.target.open); }, true);
  document.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = ev.target; if (f.dataset.form !== 'search') return;
    var c = fromSym(f.q.value);
    if (!c) { $('#search-msg').textContent = 'Unknown chord. Try names like C, Am7, F#m7b5, Bbmaj9, G7#9, Dsus4, E5.'; return; }
    f.q.blur();
    if (route().name === 'chords' && route().arg === 'pick') { if (addToBuilder(c)) back(); return; }
    go('chord/' + encodeURIComponent(enc(c)));
  });

  /* ================= gestures: edge swipe back, sheet swipe down ================= */
  (function () {
    var sx = 0, sy = 0, edge = false, sheetDrag = false, sheetY = 0;
    document.addEventListener('touchstart', function (e) {
      var t = e.touches[0]; sx = t.clientX; sy = t.clientY;
      edge = !IS_ANDROID && sx < 22 && !document.body.classList.contains('sheet-open') && !!$('.page .back'); // Android has its own back gesture
      sheetDrag = !!e.target.closest('#sheet .grab, #sheet .sh-top');
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      var t = e.touches[0];
      if (edge) { var dx = Math.max(0, t.clientX - sx); var p = $('.page'); if (p) p.style.transform = 'translateX(' + dx + 'px)'; }
      if (sheetDrag) { sheetY = Math.max(0, t.clientY - sy); $('#sheet').style.transform = 'translateY(' + sheetY + 'px)'; }
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      var t = e.changedTouches[0];
      if (edge) { var p = $('.page'); if (t.clientX - sx > 90) { if (p) p.style.transform = ''; back(); } else if (p) { p.style.transition = 'transform .2s'; p.style.transform = ''; setTimeout(function () { p.style.transition = ''; }, 220); } }
      if (sheetDrag) { $('#sheet').style.transform = ''; if (sheetY > 90) closeSheet(); sheetY = 0; }
      edge = false; sheetDrag = false;
    });
    document.addEventListener('touchcancel', function () {
      var p = $('.page'); if (p) p.style.transform = '';
      $('#sheet').style.transform = ''; edge = false; sheetDrag = false; sheetY = 0;
    });
  })();

  // Android back button / gesture: close the sheet, go back a page, then go Home; false lets Android leave the app
  function androidBack() {
    if (document.body.classList.contains('sheet-open')) { closeSheet(); return true; }
    if (routeHist.length > 1) { history.back(); return true; }
    if (route().name !== 'home') { go('home'); return true; }
    return false;
  }

  /* ================= boot ================= */
  function boot() {
    applySettings();
    $('#tabbar').innerHTML = TABS.map(function (t) { return '<button data-act="nav" data-to="' + t[0] + '" data-tab="' + t[0] + '"><svg viewBox="0 0 24 24"><path d="' + t[2] + '"/></svg><span>' + t[1] + '</span></button>'; }).join('');
    $('#sheet-backdrop').addEventListener('click', closeSheet);
    $('#mp-stop').addEventListener('click', function () { Snd.stop(); });
    var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (mq && mq.addEventListener) mq.addEventListener('change', sendTheme);
    if (IS_ANDROID && window.AndroidBridge.getInsets) { try { var ins = JSON.parse(window.AndroidBridge.getInsets()); setInsets(ins.top, ins.bottom); } catch (e) {} }
    routeHist = [route().full];
    render('none');
    document.addEventListener('touchstart', function unlock() { Snd.unlock(); document.removeEventListener('touchstart', unlock); }, { passive: true });
  }
  window.ChordAtlasApp = { go: go, Store: Store, androidBack: androidBack, setInsets: setInsets };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
