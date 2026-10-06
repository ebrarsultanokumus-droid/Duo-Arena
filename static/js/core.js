/* DUO ARENA – Kern: Netzwerk, Sound, Bilder, Spiel-Rahmen, Steuerung */
'use strict';
const DA = window.DA = {
  games: {},
  state: { me: null, profiles: [], online: [], chat: [], scores: {}, duels: {}, history: [], shop: null, invites: [] },
  img: {},
  settings: { sound: true, vibrate: true },
};

/* ---------------- Hilfen ---------------- */
DA.$ = (s, r = document) => r.querySelector(s);
DA.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
DA.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
DA.lerp = (a, b, t) => a + (b - a) * t;
DA.rand = (a, b) => a + Math.random() * (b - a);
DA.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
DA.store = {
  get(k, d) { try { const v = localStorage.getItem('duoarena.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('duoarena.' + k, JSON.stringify(v)); } catch (e) { } },
};
DA.vibrate = ms => { if (DA.settings.vibrate && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { } };
DA.seeded = function (seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };

DA.gameMeta = {
  soccer:    { title: 'Kopfball-Duell', sub: 'Big-Head-Fußball', kind: 'rt', tag: '⚽ 1 vs 1', landscape: true },
  airhockey: { title: 'Air-Hockey', sub: 'Schnell, schneller, Tor', kind: 'rt', tag: '🏒 1 vs 1' },
  dropzone:  { title: 'Drop Zone', sub: 'Battle Royale 1 vs 1', kind: 'rt', tag: '🎯 SHOOTER', landscape: true },
  maumau:    { title: 'Mau-Mau', sub: 'Das Kartenspiel', kind: 'turn', tag: '🃏 KARTEN' },
  connect4:  { title: 'Vier gewinnt', sub: 'Vier in einer Reihe', kind: 'turn', tag: '🔴 TAKTIK' },
  pacman:    { title: 'Geister-Jagd', sub: 'Friss die Punkte – flieh vor ihr', kind: 'solo', tag: '👻 ARCADE' },
  runner:    { title: 'Gleis-Sprint', sub: 'Renn, bevor sie dich fängt', kind: 'solo', tag: '🏃 ENDLESS' },
};

/* ---------------- Bilder ---------------- */
DA.loadImages = function () {
  const list = { a: '/img/head_a.png', b: '/img/head_b.png', fa: '/img/full_a.png', fb: '/img/full_b.png', logo: '/img/logo.svg' };
  return Promise.all(Object.entries(list).map(([k, src]) => new Promise(res => {
    const im = new Image(); im.onload = () => { DA.img[k] = im; res(); }; im.onerror = () => res(); im.src = src;
  })));
};

/* ---------------- Profile / Partner ---------------- */
DA.profileById = id => DA.state.profiles.find(p => p.id === id) || (DA.state.me && DA.state.me.id === id ? DA.state.me : null);
DA.otherChar = c => (c === 'a' ? 'b' : 'a');
DA.isOnline = id => DA.state.online.includes(id);
DA.partner = function () {
  const me = DA.state.me; if (!me) return null;
  const others = DA.state.profiles.filter(p => p.id !== me.id);
  if (others.length) {
    others.sort((x, y) => (DA.isOnline(y.id) - DA.isOnline(x.id)) || ((x.char !== me.char ? 0 : 1) - (y.char !== me.char ? 0 : 1)) || (y.created || 0) - (x.created || 0));
    return others[0];
  }
  return { id: 'ghost', name: 'Dein Schatz', char: DA.otherChar(me.char), outfit: {}, color: '#7c5cff' };
};

/* ---------------- Sound (synthetisch, kein Download nötig) ---------------- */
DA.sfx = (function () {
  let ac = null, master = null;
  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ac = new AC(); master = ac.createGain(); master.gain.value = 0.35; master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(f, d, type = 'square', vol = 0.3, slide = 0, delay = 0) {
    const a = ctx(); if (!a || !DA.settings.sound) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
  }
  function noise(d, vol = 0.3, hp = 800, delay = 0) {
    const a = ctx(); if (!a || !DA.settings.sound) return;
    const t = a.currentTime + delay, len = Math.floor(a.sampleRate * d), buf = a.createBuffer(1, len, a.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  const lib = {
    click: () => tone(660, 0.06, 'triangle', 0.2),
    pop: () => tone(520, 0.08, 'sine', 0.3, 400),
    coin: () => { tone(988, 0.07, 'square', 0.15); tone(1319, 0.18, 'square', 0.15, 0, 0.07); },
    kick: () => { tone(160, 0.12, 'sine', 0.6, -100); noise(0.05, 0.2, 2000); },
    bounce: () => tone(220, 0.07, 'sine', 0.3, -60),
    goal: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'square', 0.18, 0, i * 0.1)); noise(0.8, 0.12, 1500, 0.1); },
    whistle: () => { tone(2200, 0.18, 'sine', 0.25, 80); tone(2300, 0.35, 'sine', 0.25, -60, 0.2); },
    chomp: () => tone(300, 0.07, 'triangle', 0.25, 200),
    power: () => { tone(200, 0.4, 'sawtooth', 0.15, 600); },
    eat: () => { tone(800, 0.25, 'square', 0.15, 900); },
    die: () => { tone(700, 0.9, 'sawtooth', 0.2, -650); },
    hit: () => { noise(0.12, 0.35, 400); tone(120, 0.15, 'square', 0.2, -60); },
    shoot: () => { noise(0.08, 0.25, 1200); tone(400, 0.06, 'square', 0.12, -250); },
    shotgun: () => { noise(0.2, 0.45, 300); },
    sniper: () => { noise(0.25, 0.4, 600); tone(900, 0.2, 'sawtooth', 0.15, -800); },
    jump: () => tone(300, 0.18, 'square', 0.15, 500),
    slide: () => noise(0.25, 0.15, 3000),
    card: () => noise(0.06, 0.25, 3000),
    drop: () => { tone(500, 0.12, 'sine', 0.3, -300); tone(140, 0.1, 'sine', 0.35, 0, 0.1); },
    win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.2, 'square', 0.16, 0, i * 0.11)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.25, 0, i * 0.16)),
    msg: () => { tone(880, 0.08, 'sine', 0.25); tone(1320, 0.12, 'sine', 0.25, 0, 0.08); },
    pickup: () => { tone(600, 0.08, 'square', 0.15); tone(900, 0.1, 'square', 0.15, 0, 0.06); },
    puck: () => tone(900, 0.04, 'square', 0.25, -300),
    count: () => tone(440, 0.15, 'square', 0.2),
    go: () => tone(880, 0.35, 'square', 0.2),
    alarm: () => { tone(700, 0.15, 'square', 0.18, 300); tone(700, 0.15, 'square', 0.18, 300, 0.2); },
  };
  return { play: n => { try { lib[n] && lib[n](); } catch (e) { } }, unlock: () => ctx() };
})();

/* ---------------- Netzwerk (WebSocket mit Auto-Reconnect) ---------------- */
DA.net = (function () {
  let ws = null, retry = 0, handlers = {}, queue = [], pingT = null, connected = false;
  function url() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'; }
  function emit(t, m) { (handlers[t] || []).slice().forEach(fn => { try { fn(m); } catch (e) { console.error(e); } }); }
  function connect() {
    try { ws = new WebSocket(url()); } catch (e) { return later(); }
    ws.onopen = () => {
      connected = true; retry = 0;
      ws.send(JSON.stringify({ t: 'hello', pid: DA.store.get('pid', null), room: DA.currentRoomId || null }));
      queue.splice(0).forEach(m => ws.send(m));
      clearInterval(pingT); pingT = setInterval(() => send({ t: 'ping', ts: Date.now() }), 15000);
      emit('_open');
    };
    ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } emit(m.t, m); };
    ws.onclose = () => { const was = connected; connected = false; clearInterval(pingT); if (was) emit('_close'); later(); };
    ws.onerror = () => { try { ws.close(); } catch (e) { } };
  }
  function later() { retry++; setTimeout(connect, Math.min(5000, 300 * retry)); }
  function send(m) {
    const s = JSON.stringify(m);
    if (ws && ws.readyState === 1) ws.send(s); else if (m.t !== 'relay' && m.t !== 'ping') queue.push(s);
  }
  function on(t, fn) { (handlers[t] = handlers[t] || []).push(fn); return () => off(t, fn); }
  function off(t, fn) { handlers[t] = (handlers[t] || []).filter(f => f !== fn); }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (!ws || ws.readyState > 1)) { retry = 0; connect(); }
  });
  return { connect, send, on, off, get connected() { return connected; } };
})();

/* ---------------- Toasts ---------------- */
DA.toast = function (msg, kind = '', opts = {}) {
  const box = DA.$('#toasts'), el = document.createElement('div');
  el.className = 'toast ' + kind;
  if (opts.char) { const c = document.createElement('canvas'); c.width = c.height = 60; DA.drawAvatar(c, opts.char, opts.outfit); el.appendChild(c); }
  const s = document.createElement('div'); s.textContent = msg; el.appendChild(s);
  if (opts.onClick) { el.style.cursor = 'pointer'; el.onclick = () => { opts.onClick(); el.remove(); }; }
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, opts.ms || 3200);
};

/* ---------------- Steuerung: Buttons & Joysticks ---------------- */
DA.Controls = function (root) {
  const keys = {}, els = [];
  this.keys = keys;
  this.button = function (id, label, style) {
    const b = document.createElement('div'); b.className = 'cbtn'; b.innerHTML = label; Object.assign(b.style, style);
    const down = e => { e.preventDefault(); keys[id] = true; b.classList.add('down'); DA.vibrate(8); };
    const up = e => { e.preventDefault(); keys[id] = false; b.classList.remove('down'); };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    root.appendChild(b); els.push(b); return b;
  };
  this.joystick = function (id, style, label) {
    const j = document.createElement('div'); j.className = 'joy'; Object.assign(j.style, style);
    j.innerHTML = '<i></i>' + (label ? '<span>' + label + '</span>' : '');
    const knob = j.firstChild; let pid = null;
    const st = keys[id] = { x: 0, y: 0, active: false, mag: 0 };
    function move(e) {
      const r = j.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      st.x = dx / R; st.y = dy / R; st.mag = Math.min(1, d / R);
      knob.style.transform = `translate(${dx}px,${dy}px)`;
    }
    j.addEventListener('pointerdown', e => { e.preventDefault(); pid = e.pointerId; j.setPointerCapture(pid); st.active = true; move(e); });
    j.addEventListener('pointermove', e => { if (e.pointerId === pid) move(e); });
    const end = e => { if (e.pointerId !== pid) return; pid = null; st.active = false; st.x = st.y = st.mag = 0; knob.style.transform = ''; };
    j.addEventListener('pointerup', end); j.addEventListener('pointercancel', end);
    root.appendChild(j); els.push(j); return j;
  };
  this.clear = () => { els.forEach(e => e.remove()); els.length = 0; };
};

/* ---------------- Spiel-Rahmen ---------------- */
DA.openGame = function (id, opts = {}) {
  const meta = DA.gameMeta[id], def = DA.games[id];
  if (!def) return;
  DA.closeChat && DA.closeChat();
  const el = DA.$('#game'), canvas = DA.$('#gameCanvas'), ctx = canvas.getContext('2d');
  const ctrlRoot = DA.$('#gControls'); ctrlRoot.innerHTML = '';
  const panel = DA.$('#gPanel'), hudMid = DA.$('#gHudMid'), banner = DA.$('#gBanner');
  const cleanups = [], rtHandlers = [];
  let raf = 0, running = true, last = performance.now(), loopFn = null;
  const room = opts.room || null;
  DA.currentRoomId = room ? room.id : null;

  const me = DA.state.me;
  let players;
  if (room) players = room.players.map(p => p || { name: '?', char: 'b', outfit: {} });
  else players = [me, opts.vsCpu ? { id: 'cpu', name: 'Computer', char: DA.partner() ? DA.partner().char : DA.otherChar(me.char), outfit: DA.partner() ? DA.partner().outfit : {}, color: '#7c5cff', isCpu: true } : DA.partner()];
  const you = room ? room.you : 0;

  const G = {
    id, meta, canvas, ctx, el, room, players, you, me, opts,
    partner: players[1 - you],
    isHost: !room || room.you === 0,
    online: !!room && !room.cpu,
    W: 0, H: 0, dpr: 1, controls: new DA.Controls(ctrlRoot), t: 0,
    on(target, type, fn, o) { target.addEventListener(type, fn, o); cleanups.push(() => target.removeEventListener(type, fn, o)); },
    onNet(type, fn) { cleanups.push(DA.net.on(type, fn)); },
    loop(fn) { loopFn = fn; },
    hud(html) { hudMid.innerHTML = html; },
    banner(text) { if (!text) banner.classList.add('hidden'); else { banner.textContent = text; banner.classList.remove('hidden'); } },
    panel(o) {
      if (!o) { panel.classList.add('hidden'); panel.innerHTML = ''; G._lastPanel = null; return; }
      if (!o.temp) G._lastPanel = o;
      panel.innerHTML = `<div class="card">${o.top || ''}${o.title ? `<h2>${o.title}</h2>` : ''}${o.text ? `<p>${o.text}</p>` : ''}${o.html || ''}<div class="btns"></div></div>`;
      const bb = panel.querySelector('.btns');
      (o.buttons || []).forEach(b => {
        const x = document.createElement('button'); x.className = 'btn ' + (b.cls || 'ghost') + ' wide'; x.innerHTML = b.label;
        x.onclick = () => { DA.sfx.play('click'); b.onClick && b.onClick(); }; bb.appendChild(x);
      });
      panel.classList.remove('hidden');
      o.onMount && o.onMount(panel);
    },
    fit(lw, lh, mode = 'contain') {
      const s = mode === 'cover' ? Math.max(G.W / lw, G.H / lh) : Math.min(G.W / lw, G.H / lh);
      const ox = (G.W - lw * s) / 2, oy = (G.H - lh * s) / 2;
      ctx.setTransform(s * G.dpr, 0, 0, s * G.dpr, ox * G.dpr, oy * G.dpr);
      G.view = { s, ox, oy, lw, lh };
      return G.view;
    },
    toLogical(cx, cy) { const r = canvas.getBoundingClientRect(), v = G.view; return { x: (cx - r.left - v.ox) / v.s, y: (cy - r.top - v.oy) / v.s }; },
    resetTransform() { ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0); },
    rt: {
      send(d) { if (G.online) DA.net.send({ t: 'relay', d }); },
      on(fn) { rtHandlers.push(fn); },
      result(winner, score) { if (G.online && G.isHost) DA.net.send({ t: 'rt_result', winner, score }); },
    },
    move(d) { DA.net.send({ t: 'move', d }); },
    submitScore(score, bonus) { DA.net.send({ t: 'score', game: id, score: Math.floor(score), bonus: bonus || 0 }); },
    emote(e, who) { flyEmote(e, who == null ? G.you : who); },
    exit() { close(true); },
    keys: {},
  };

  function resize() {
    G.dpr = Math.min(2, window.devicePixelRatio || 1);
    G.W = el.clientWidth; G.H = el.clientHeight;
    canvas.width = Math.round(G.W * G.dpr); canvas.height = Math.round(G.H * G.dpr);
    G.onResize && G.onResize();
    const hint = DA.$('#rotateHint');
    if (meta.landscape && G.H > G.W * 1.1 && !DA._rotateOk) hint.classList.remove('hidden'); else hint.classList.add('hidden');
  }
  DA.$('#rotateOk').onclick = () => { DA._rotateOk = true; DA.$('#rotateHint').classList.add('hidden'); };

  // Tastatur
  G.on(window, 'keydown', e => { G.keys[e.key.toLowerCase()] = true; if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault(); G.onKey && G.onKey(e.key.toLowerCase(), true); });
  G.on(window, 'keyup', e => { G.keys[e.key.toLowerCase()] = false; G.onKey && G.onKey(e.key.toLowerCase(), false); });
  G.on(window, 'resize', () => setTimeout(resize, 50));

  // Live-Verbindung
  if (G.online) {
    G.onNet('relay', m => {
      const d = m.d; if (!d) return;
      if (d.k === 'emote') { flyEmote(d.e, 1 - G.you); return; }
      rtHandlers.forEach(fn => fn(d));
    });
    G.onNet('partner_lost', () => G.banner('⚠️ ' + G.partner.name + ' hat Verbindungsprobleme…'));
    G.onNet('partner_back', () => { G.banner(null); DA.toast(G.partner.name + ' ist zurück 💪', 'ok'); });
  }
  if (room) {
    G.onNet('room_end', m => {
      if (m.room !== room.id) return;
      DA.currentRoomId = null; G.ended = true;
      G.panel({ title: 'Spiel beendet', text: DA.esc(m.reason || ''), buttons: [{ label: 'Zurück zur Arena', cls: 'primary', onClick: () => close(false) }] });
    });
    G.onNet('state', m => { if (m.room === room.id && G.onState) G.onState(m.s); });
  }

  // Emotes
  const ebar = DA.$('#emoteBar'); ebar.innerHTML = '';
  if (G.online) {
    ebar.classList.remove('hidden');
    ['😂', '😘', '😤', '🔥', '🫶'].forEach(e => {
      const b = document.createElement('button'); b.textContent = e;
      b.onclick = () => { DA.net.send({ t: 'relay', d: { k: 'emote', e } }); flyEmote(e, G.you); };
      ebar.appendChild(b);
    });
  } else ebar.classList.add('hidden');
  function flyEmote(e, who) {
    const f = document.createElement('div'); f.className = 'emote-fly'; f.textContent = e;
    const left = (G.emoteX ? G.emoteX(who) : (who === 0 ? 0.25 : 0.75));
    f.style.left = (left * 100) + '%'; f.style.top = (G.emoteY ? G.emoteY(who) * 100 : 40) + '%';
    el.appendChild(f); setTimeout(() => f.remove(), 1900); DA.sfx.play('pop');
  }

  // Schließen
  function close(leave) {
    if (!running) return; running = false;
    cancelAnimationFrame(raf);
    try { G.onExit && G.onExit(); } catch (e) { console.error(e); }
    cleanups.forEach(f => f());
    G.controls.clear(); G.panel(null); G.banner(null); hudMid.innerHTML = '';
    if (room && leave && !G.ended) DA.net.send({ t: 'leave_room' });
    DA.currentRoomId = null;
    if (document.fullscreenElement && document.exitFullscreen) { try { screen.orientation.unlock && screen.orientation.unlock(); } catch (e) { } document.exitFullscreen().catch(() => { }); }
    el.classList.remove('active');
    DA.$('#main').classList.add('active');
    DA.activeGame = null;
    DA.refreshMain && DA.refreshMain();
  }
  DA.$('#gExit').onclick = () => {
    DA.sfx.play('click');
    if (G.online && !G.ended) {
      const keep = G._lastPanel;
      G.panel({ temp: true, title: 'Spiel verlassen?', text: 'Das Duell wird für euch beide beendet.', buttons: [
        { label: 'Ja, verlassen', cls: 'primary', onClick: () => close(true) },
        { label: 'Weiterspielen', onClick: () => G.panel(keep || null) }] });
    } else close(true);
  };
  DA.$('#gChat').onclick = () => { DA.sfx.play('click'); DA.openChat(); };

  DA.$('#main').classList.remove('active'); DA.$('#onboard').classList.remove('active');
  el.classList.add('active');
  DA.activeGame = G;
  // Android: Vollbild + Querformat für Quer-Spiele (iPhone ignoriert das einfach)
  if (meta.landscape && document.documentElement.requestFullscreen && !document.fullscreenElement && matchMedia('(pointer:coarse)').matches) {
    document.documentElement.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => { });
  }
  resize();
  def.start(G);
  resize();

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; G.t += dt;
    if (loopFn) { try { loopFn(dt); } catch (e) { console.error(e); } }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return G;
};

/* Kleine HUD-Bausteine */
DA.hudScore = function (G, a, b) {
  const p = G.players;
  return `<div class="hud-score"><canvas width="60" height="60" data-av="0"></canvas><span class="num">${a}</span><span class="sep">:</span><span class="num">${b}</span><canvas width="60" height="60" data-av="1"></canvas></div>`;
};
DA.paintHudAvatars = function (G) {
  DA.$$('#gHudMid canvas[data-av]').forEach(c => { const p = G.players[+c.dataset.av]; DA.drawAvatar(c, p.char, p.outfit); });
};
