/* DUO ARENA – Oberfläche: Intro, Profile, Menü, Chat, Einladungen, Highscores, Outfits */
'use strict';
(function () {
  const S = DA.state, $ = DA.$, $$ = DA.$$;
  let introDone = false, welcomed = false, unread = 0, currentView = 'home', shopTab = 'hat';
  const COLORS = ['#ff4fa3', '#7c5cff', '#3de7ff', '#b6ff3b', '#ffc21a', '#ff7a45', '#ff4d5e', '#41dcae'];

  /* ---------- Avatare als Bild (gecacht) ---------- */
  const avCache = {};
  DA.avatarURL = function (p, size = 96) {
    if (!p) return '';
    const key = [p.char, JSON.stringify(p.outfit || {}), p.color, size].join('|');
    if (!avCache[key]) {
      const c = document.createElement('canvas'); c.width = c.height = size;
      DA.drawAvatar(c, p.char, p.outfit, p.color); avCache[key] = c.toDataURL();
    }
    return avCache[key];
  };
  const avImg = (p, cls = '') => `<img class="${cls}" src="${DA.avatarURL(p)}" alt="">`;

  /* ================= BOOT ================= */
  DA.boot = function () {
    DA.settings = Object.assign(DA.settings, DA.store.get('settings', {}));
    DA.loadImages().then(() => { if (welcomed && introDone) route(); });
    bindNet();
    DA.net.connect();
    startIntro();
    bindStatic();
  };

  /* ================= INTRO ================= */
  function startIntro() {
    const intro = $('#intro'), cv = $('#introFx'), ctx = cv.getContext('2d');
    let parts = [], t0 = performance.now(), alive = true;
    function size() { cv.width = innerWidth * 2; cv.height = innerHeight * 2; }
    size(); addEventListener('resize', size);
    for (let i = 0; i < 70; i++) parts.push(newPart(true));
    function newPart(any) {
      return { x: Math.random() * cv.width, y: any ? Math.random() * cv.height : cv.height + 20, vy: DA.rand(-60, -160), vx: DA.rand(-20, 20), s: DA.rand(6, 18), k: Math.random() < .4 ? 'h' : (Math.random() < .5 ? 's' : 'd'), c: ['#ff4fa3', '#7c5cff', '#3de7ff', '#ffc21a', '#ffffff'][Math.floor(Math.random() * 5)], r: Math.random() * 6 };
    }
    let burst = false;
    function draw(now) {
      if (!alive) return;
      const t = (now - t0) / 1000, dt = 1 / 60;
      ctx.clearRect(0, 0, cv.width, cv.height);
      // Lichtstrahlen
      ctx.save(); ctx.translate(cv.width / 2, cv.height * 0.42); ctx.rotate(t * 0.15);
      for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.fillStyle = i % 2 ? 'rgba(255,79,163,.05)' : 'rgba(124,92,255,.06)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-120, -2000); ctx.lineTo(120, -2000); ctx.fill(); }
      ctx.restore();
      if (t > 0.45 && !burst) { burst = true; for (let i = 0; i < 80; i++) { const a = Math.random() * 7, v = DA.rand(300, 1200); parts.push({ x: cv.width / 2, y: cv.height * 0.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: DA.rand(5, 14), k: 's', c: ['#ffc21a', '#fff', '#ff4fa3'][i % 3], r: 0, boom: 1 }); } }
      for (const p of parts) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt;
        if (p.boom) { p.vx *= 0.95; p.vy = p.vy * 0.95 + 8; p.boom -= dt * 0.7; }
        ctx.globalAlpha = p.boom != null ? Math.max(0, p.boom) : 0.7;
        ctx.fillStyle = p.c;
        if (p.k === 'h') { DA.shapes.heart(ctx, p.x, p.y, p.s); ctx.fill(); }
        else if (p.k === 's') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); DA.shapes.star(ctx, 0, 0, p.s, 4, 0.4); ctx.fill(); ctx.restore(); }
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.s / 3, 0, 7); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      parts = parts.filter(p => p.y > -40 && (p.boom == null || p.boom > 0));
      while (parts.length < 70) parts.push(newPart(false));
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
    requestAnimationFrame(() => intro.classList.add('play'));
    const go = () => {
      if (introDone) return; introDone = true;
      DA.sfx.unlock(); DA.sfx.play('win');
      intro.classList.add('leave');
      setTimeout(() => { alive = false; intro.classList.remove('active'); route(); }, 560);
    };
    $('#introGo').onclick = go;
    intro.addEventListener('click', e => { if (performance.now() - t0 > 2200) go(); });
    setTimeout(() => { if (!introDone && DA.store.get('pid')) {/* kurz warten, man soll das Intro sehen */ } }, 0);
  }

  function route() {
    if (!introDone) return;
    if (DA.activeGame) return;
    if (S.me) showMain(); else showOnboard();
  }

  /* ================= NETZ ================= */
  function bindNet() {
    const net = DA.net;
    net.on('welcome', m => {
      welcomed = true;
      Object.assign(S, { me: m.me, profiles: m.profiles, chat: m.chat, scores: m.scores, duels: m.duels, history: m.history, online: m.online, shop: m.shop, invites: m.invites || [] });
      if (!m.me && DA.store.get('pid')) DA.store.set('pid', null);
      if (m.me) DA.store.set('pid', m.me.id);
      $('#obConn').textContent = '';
      renderChat();
      if (introDone && !DA.activeGame) {
        if ($('#onboard').classList.contains('active') && m.me) showMain();
        else if (!$('#main').classList.contains('active')) route();
        else refreshMain();
      }
      (S.invites || []).forEach(showInvite);
    });
    net.on('_close', () => { $('#obConn').textContent = 'Verbindung unterbrochen – verbinde neu…'; });
    net.on('profile_created', m => { S.me = m.me; DA.store.set('pid', m.me.id); DA.sfx.play('win'); showMain(); DA.toast('Willkommen in der Arena, ' + m.me.name + '! 🎉 100 Münzen Startbonus', 'ok'); });
    net.on('profiles', m => {
      S.profiles = m.profiles;
      if (S.me) { const u = S.profiles.find(p => p.id === S.me.id); if (u) S.me = u; }
      if ($('#onboard').classList.contains('active')) renderOnboard();
      refreshMain();
    });
    net.on('online', m => { S.online = m.pids; refreshMain(); renderChatHead(); });
    net.on('chat', m => onChat(m.msg));
    net.on('typing', m => { const el = $('#chatTyping'); const p = DA.profileById(m.pid); el.textContent = (p ? p.name : 'Jemand') + ' tippt…'; el.classList.remove('hidden'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.add('hidden'), 3000); });
    net.on('scores', m => { S.scores = m.scores; S.duels = m.duels; S.history = m.history; if (currentView === 'scores') renderScores(); renderDuoCard(); });
    net.on('toast', m => DA.toast(m.msg, m.kind || ''));
    net.on('error', m => DA.toast(m.msg, 'warn'));
    net.on('invite', m => showInvite(m.invite));
    net.on('invite_gone', m => { const md = $('#modal'); if (md.dataset.invite === m.id) closeModal(); });
    net.on('invite_sent', m => showWaiting(m.invite, m.reach));
    net.on('invite_declined', m => { closeModal(); DA.toast(m.by + ' kann gerade nicht 🙈', 'warn'); });
    net.on('room_start', m => {
      closeModal();
      DA.sfx.play('go'); DA.vibrate([30, 40, 30]);
      if (DA.activeGame) DA.activeGame.exit();
      DA.openGame(m.room.game, { room: m.room });
    });
  }

  /* ================= ONBOARDING ================= */
  let obChar = null, obColor = COLORS[0];
  function showOnboard() {
    $$('.screen').forEach(s => s.classList.remove('active'));
    $('#onboard').classList.add('active');
    renderOnboard();
  }
  function renderOnboard() {
    const list = $('#obProfiles');
    list.innerHTML = '';
    if (!welcomed) { $('#obConn').textContent = 'Verbinde mit der Arena…'; }
    $('#obTitle').textContent = S.profiles.length ? 'Wer spielt hier?' : 'Erstelle dein Profil';
    S.profiles.forEach(p => {
      const b = document.createElement('button'); b.className = 'ob-prof';
      b.innerHTML = `${avImg(p)}<div><b>${DA.esc(p.name)}</b><small>${DA.isOnline(p.id) ? '<i class="dot on"></i>gerade online' : 'Tippen, um dieses Profil zu nutzen'}</small></div>`;
      b.querySelector('img').style.cssText = 'width:58px;height:58px;border-radius:50%';
      b.onclick = () => { DA.sfx.play('click'); DA.store.set('pid', p.id); DA.net.send({ t: 'hello', pid: p.id }); };
      list.appendChild(b);
    });
    const form = $('#obForm');
    if (!S.profiles.length) { form.classList.remove('hidden'); $('#obNewBtn').classList.add('hidden'); }
    else { $('#obNewBtn').classList.remove('hidden'); }
    const taken = S.profiles.map(p => p.char);
    $$('.char-opt').forEach(o => o.classList.toggle('taken', taken.includes(o.dataset.char)));
    if (!obChar) { obChar = ['a', 'b'].find(c => !taken.includes(c)) || 'a'; }
    $$('.char-opt').forEach(o => o.classList.toggle('sel', o.dataset.char === obChar));
    const cp = $('#obColors'); cp.innerHTML = '';
    COLORS.forEach(c => { const b = document.createElement('button'); b.type = 'button'; b.style.background = c; b.className = c === obColor ? 'sel' : ''; b.onclick = () => { obColor = c; renderOnboard(); }; cp.appendChild(b); });
  }

  /* ================= STATISCHE EVENTS ================= */
  function bindStatic() {
    $('#obNewBtn').onclick = () => { $('#obForm').classList.remove('hidden'); $('#obNewBtn').classList.add('hidden'); $('#obName').focus(); };
    $$('.char-opt').forEach(o => o.onclick = () => { obChar = o.dataset.char; DA.sfx.play('pop'); renderOnboard(); });
    $('#obForm').onsubmit = e => {
      e.preventDefault();
      const name = $('#obName').value.trim();
      if (!name) return DA.toast('Bitte gib einen Namen ein', 'warn');
      DA.net.send({ t: 'create_profile', name, char: obChar, color: obColor });
    };
    $$('.bottomnav button').forEach(b => b.onclick = () => { DA.sfx.play('click'); if (b.dataset.view === 'chat') return DA.openChat(); setView(b.dataset.view); });
    $('#meBtn').onclick = () => setView('profile');
    $('#coinBox').onclick = () => setView('shop');
    $('#chatClose').onclick = DA.closeChat = closeChat;
    $('#drawerShade').onclick = closeChat;
    $('#chatForm').onsubmit = e => {
      e.preventDefault();
      const v = $('#chatInput').value.trim(); if (!v) return;
      DA.net.send({ t: 'chat', text: v, game: DA.activeGame ? DA.activeGame.id : undefined }); $('#chatInput').value = '';
    };
    let lastTyping = 0;
    $('#chatInput').addEventListener('input', () => { const n = Date.now(); if (n - lastTyping > 2000) { lastTyping = n; DA.net.send({ t: 'typing' }); } });
    const q = $('#chatQuick');
    ['💗', '😂', '😘', '🥺', '🔥', '😤', 'GG!', 'Revanche?', 'Noch eine Runde? 🎮'].forEach(e => {
      const b = document.createElement('button'); b.textContent = e; b.onclick = () => { DA.net.send({ t: 'chat', text: e }); DA.sfx.play('pop'); }; q.appendChild(b);
    });
  }

  /* ================= HAUPTANSICHT ================= */
  function showMain() {
    $$('.screen').forEach(s => s.classList.remove('active'));
    $('#main').classList.add('active');
    buildGrids();
    refreshMain();
  }
  DA.refreshMain = refreshMain;
  function refreshMain() {
    if (!S.me) return;
    $('#coinCount').textContent = S.me.coins || 0;
    $('#shopCoins').textContent = S.me.coins || 0;
    DA.drawAvatar($('#meAvatar'), S.me.char, S.me.outfit, S.me.color);
    renderDuoCard();
    if (currentView === 'shop') renderShop();
    if (currentView === 'profile') renderProfile();
    if (currentView === 'scores') renderScores();
    renderChatHead();
  }
  function setView(v) {
    currentView = v;
    $$('.view').forEach(x => x.classList.toggle('active', x.id === 'view-' + v));
    $$('.bottomnav button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    if (v === 'scores') renderScores();
    if (v === 'shop') renderShop();
    if (v === 'profile') renderProfile();
    if (v === 'home') buildGrids();
  }

  function winsOf(pid, vsCpu) {
    let w = 0; Object.values(S.duels || {}).forEach(g => { const r = g[pid]; if (r) w += vsCpu ? (r.cpu_w || 0) : (r.w || 0); }); return w;
  }
  function renderDuoCard() {
    const me = S.me; if (!me) return; const pa = DA.partner();
    const box = $('#duoCard');
    box.innerHTML = `<div class="duo-row">
      <div class="duo-p">${avImg(me)}<b>${DA.esc(me.name)}</b><small><i class="dot on"></i>Du</small></div>
      <div class="duo-mid"><span class="big">${winsOf(me.id)} : ${pa.id !== 'ghost' ? winsOf(pa.id) : 0}</span>Siege gesamt</div>
      <div class="duo-p">${avImg(pa)}<b>${DA.esc(pa.name)}</b><small>${pa.id === 'ghost' ? 'noch kein Profil' : (DA.isOnline(pa.id) ? '<i class="dot on"></i>online' : '<i class="dot"></i>offline')}</small></div></div>`;
    $$('img', box).forEach(i => i.style.cssText = 'width:84px;height:84px;border-radius:50%;border:3px solid rgba(255,255,255,.85);background:rgba(0,0,0,.18)');
  }

  function buildGrids() {
    const duel = ['soccer', 'dropzone', 'airhockey', 'maumau', 'connect4'], solo = ['pacman', 'runner'];
    const mk = (id, wide) => {
      const m = DA.gameMeta[id], b = document.createElement('button');
      b.className = 'gcard' + (wide ? ' wide' : '');
      b.innerHTML = `<canvas></canvas><div class="gc-shade"></div><span class="gc-tag">${m.tag}</span><b>${m.title}</b><small>${m.sub}</small>`;
      b.onclick = () => { DA.sfx.play('click'); openGameSheet(id); };
      return b;
    };
    const gd = $('#gridDuel'), gs = $('#gridSolo'); gd.innerHTML = ''; gs.innerHTML = '';
    duel.forEach((id, i) => gd.appendChild(mk(id, i === 0)));
    solo.forEach(id => gs.appendChild(mk(id)));
    requestAnimationFrame(() => $$('.gcard').forEach((c, i) => drawCardArt(c.querySelector('canvas'), [...duel, ...solo][i])));
  }

  /* ---------- Titelbilder der Spiele ---------- */
  function drawCardArt(cv, id) {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.max(10, r.width * dpr); cv.height = Math.max(10, r.height * dpr);
    const ctx = cv.getContext('2d'), w = cv.width, h = cv.height, me = S.me, pa = DA.partner();
    const R = Math.min(w, h);
    if (id === 'soccer') {
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b1a4a'); g.addColorStop(.55, '#1d3f8a'); g.addColorStop(.56, '#2fa84f'); g.addColorStop(1, '#1d7a38'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.05)' : 'transparent'; ctx.fillRect(i * w / 8, h * .56, w / 8, h); }
      for (let i = 0; i < 40; i++) { ctx.fillStyle = `hsla(${i * 37 % 360},70%,70%,.5)`; ctx.beginPath(); ctx.arc((i * 53) % w, h * 0.2 + (i * 29 % 30) / 30 * h * 0.25, R * 0.02, 0, 7); ctx.fill(); }
      DA.drawChar(ctx, me.char, me.outfit, w * 0.28, h * 0.92, R * 0.75, { facing: 1, kick: 0.6, t: 0 });
      DA.drawChar(ctx, pa.char, pa.outfit, w * 0.72, h * 0.92, R * 0.75, { facing: -1, run: 1, t: 0 });
      drawBall(ctx, w * 0.5, h * 0.42, R * 0.07);
    } else if (id === 'dropzone') {
      ctx.fillStyle = '#3c6b35'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 30; i++) { ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.beginPath(); ctx.arc((i * 71) % w, (i * 43) % h, R * 0.06, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#6b5a4a'; ctx.fillRect(w * 0.05, h * 0.1, w * 0.18, h * 0.35); ctx.fillStyle = '#8a7462'; ctx.fillRect(w * 0.06, h * 0.12, w * 0.16, h * 0.31);
      ctx.strokeStyle = 'rgba(255,60,90,.8)'; ctx.lineWidth = R * 0.03; ctx.beginPath(); ctx.arc(w * 0.6, h * 0.5, R * 0.9, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = R * 0.015; ctx.beginPath(); ctx.moveTo(w * 0.36, h * 0.48); ctx.lineTo(w * 0.62, h * 0.45); ctx.stroke();
      DA.drawHead(ctx, me.char, w * 0.3, h * 0.5, R * 0.22, me.outfit, { t: 0 });
      DA.drawHead(ctx, pa.char, w * 0.72, h * 0.42, R * 0.22, pa.outfit, { t: 0, angry: true });
      ctx.font = `${R * 0.2}px serif`; ctx.fillText('💥', w * 0.6, h * 0.3);
    } else if (id === 'airhockey') {
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0ad4ff'); g.addColorStop(1, '#0a6cff'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = R * 0.02; ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke(); ctx.beginPath(); ctx.arc(w / 2, h / 2, R * 0.25, 0, 7); ctx.stroke();
      DA.drawHead(ctx, me.char, w * 0.25, h * 0.55, R * 0.25, me.outfit, { t: 0 });
      DA.drawHead(ctx, pa.char, w * 0.75, h * 0.45, R * 0.25, pa.outfit, { t: 0 });
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(w * 0.52, h * 0.6, R * 0.07, 0, 7); ctx.fill();
    } else if (id === 'maumau') {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w); g.addColorStop(0, '#1f8a55'); g.addColorStop(1, '#0d4a2c'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      [[-0.3, 'H', 'Q', pa], [0, 'S', 'K', me], [0.3, 'D', 'A', null]].forEach(([a, s, rk, p], i) => {
        ctx.save(); ctx.translate(w / 2 + (i - 1) * R * 0.32, h * 0.62); ctx.rotate(a);
        DA.drawCardFace(ctx, s + rk, -R * 0.2, -R * 0.3, R * 0.4, R * 0.6); ctx.restore();
      });
    } else if (id === 'connect4') {
      ctx.fillStyle = '#2a1a70'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#3557ff'; const cw = w * 0.8, ch = h * 0.75, x0 = (w - cw) / 2, y0 = h * 0.22; ctx.fillRect(x0, y0, cw, ch);
      const cs = cw / 7;
      for (let c = 0; c < 7; c++) for (let rr = 0; rr < 4; rr++) {
        const x = x0 + cs * (c + .5), y = y0 + cs * (rr + .5) * 0.95 + 4, v = [[0, 1, 0, 1, -1, -1, -1], [1, 0, 1, 0, 0, -1, 1], [0, 1, 0, 0, 1, 0, 1], [1, 0, 1, 1, 0, 1, 0]][rr][c];
        ctx.fillStyle = '#140b2e'; ctx.beginPath(); ctx.arc(x, y, cs * 0.4, 0, 7); ctx.fill();
        if (v >= 0) chip(ctx, x, y, cs * 0.38, v === 0 ? me : pa, v === 0 ? '#ff4fa3' : '#ffc21a');
      }
    } else if (id === 'pacman') {
      ctx.fillStyle = '#05051a'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#3557ff'; ctx.lineWidth = R * 0.03; ctx.strokeRect(w * 0.05, h * 0.12, w * 0.9, h * 0.76);
      ctx.fillStyle = '#ffd9b0'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(w * 0.12 + i * w * 0.1, h * 0.5, R * 0.02, 0, 7); ctx.fill(); }
      pacFace(ctx, me, w * 0.22, h * 0.5, R * 0.2, 0.6);
      DA.drawGhost(ctx, w * 0.62, h * 0.48, R * 0.16, '#ff3b5c', pa.char, pa.outfit, 'normal', 0);
      DA.drawGhost(ctx, w * 0.85, h * 0.48, R * 0.16, '#3de7ff', pa.char, pa.outfit, 'normal', 1);
    } else if (id === 'runner') {
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ff9a5a'); g.addColorStop(.5, '#ff4fa3'); g.addColorStop(.51, '#5b4a6e'); g.addColorStop(1, '#3a2c4a'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#c9b8d8'; ctx.lineWidth = R * 0.015;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * w * 0.05, h * 0.5); ctx.lineTo(w / 2 + i * w * 0.45, h); ctx.stroke(); }
      ctx.fillStyle = '#ffd23f'; [0.62, 0.72, 0.84].forEach((y, i) => { ctx.beginPath(); ctx.ellipse(w * (0.6 + i * 0.03), h * y, R * 0.03 * (1 + i * .3), R * 0.04 * (1 + i * .3), 0, 0, 7); ctx.fill(); });
      DA.drawChar(ctx, me.char, me.outfit, w * 0.4, h * 0.9, R * 0.55, { run: 1.2, facing: 1, t: 0 });
      DA.drawHead(ctx, pa.char, w * 0.82, h * 0.92, R * 0.28, pa.outfit, { t: 0, angry: true });
      ctx.font = `${R * 0.14}px serif`; ctx.fillText('🚨', w * 0.74, h * 0.62);
    }
  }
  DA.drawCardArt = drawCardArt;
  function drawBall(ctx, x, y, r) {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111'; DA.shapes.star(ctx, x, y, r * 0.42, 5, 0.8); ctx.fill();
  }
  DA.drawBall = drawBall;
  function chip(ctx, x, y, r, p, col) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, 7); ctx.clip(); DA.drawHead(ctx, p.char, x, y + r * 0.1, r * 0.95, p.outfit, { shadow: false, t: 0 }); ctx.restore();
  }
  DA.drawChip = chip;
  function pacFace(ctx, p, x, y, r, mouth, dir = 0) {
    ctx.save(); ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, dir + mouth / 2, dir + Math.PI * 2 - mouth / 2); ctx.closePath();
    ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.clip();
    DA.drawHead(ctx, p.char, x, y + r * 0.08, r * 1.12, p.outfit, { shadow: false });
    ctx.restore();
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = Math.max(1.5, r * 0.12); ctx.beginPath(); ctx.arc(x, y, r, dir + mouth / 2, dir + Math.PI * 2 - mouth / 2); ctx.stroke();
  }
  DA.drawPac = pacFace;

  /* ---------- Spielkarten zeichnen (für Mau-Mau & Titelbild) ---------- */
  DA.drawCardFace = function (ctx, card, x, y, w, h, opts) {
    opts = opts || {};
    const suit = card[0], rank = card.slice(1), red = suit === 'H' || suit === 'D';
    const sym = { C: '♣', S: '♠', H: '♥', D: '♦' }[suit], col = red ? '#e3243b' : '#1a1030';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = w * 0.08; ctx.shadowOffsetY = w * 0.03;
    ctx.fillStyle = opts.dim ? '#cfc8dc' : '#fffdf8'; rr(ctx, x, y, w, h, w * 0.1); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = opts.glow ? '#ff4fa3' : 'rgba(0,0,0,.25)'; ctx.lineWidth = opts.glow ? w * 0.05 : w * 0.015; ctx.stroke();
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = { J: 'B', Q: 'D', K: 'K', A: 'A' }[rank] || rank;
    ctx.font = `900 ${w * 0.22}px Nunito, sans-serif`; ctx.fillText(label, x + w * 0.16, y + h * 0.1);
    ctx.font = `${w * 0.18}px serif`; ctx.fillText(sym, x + w * 0.16, y + h * 0.22);
    ctx.save(); ctx.translate(x + w * 0.84, y + h * 0.9); ctx.rotate(Math.PI);
    ctx.font = `900 ${w * 0.22}px Nunito, sans-serif`; ctx.fillText(label, 0, 0); ctx.font = `${w * 0.18}px serif`; ctx.fillText(sym, 0, h * 0.12); ctx.restore();
    const me = S.me || { char: 'a' }, pa = DA.partner() || { char: 'b' };
    if (rank === 'Q' || rank === 'K' || rank === 'J') {
      // Bildkarten zeigen euch zwei
      const who = rank === 'K' ? { char: 'a' } : rank === 'Q' ? { char: 'b' } : null;
      ctx.save(); rr(ctx, x + w * 0.2, y + h * 0.18, w * 0.6, h * 0.64, w * 0.06); ctx.clip();
      const gg = ctx.createLinearGradient(0, y, 0, y + h); gg.addColorStop(0, red ? '#ffd3dc' : '#dcd3ff'); gg.addColorStop(1, red ? '#ff9fb4' : '#a99bff'); ctx.fillStyle = gg; ctx.fillRect(x, y, w, h);
      if (who) {
        DA.drawHead(ctx, who.char, x + w / 2, y + h * 0.45, w * 0.34, { hat: rank === 'K' ? 'crown' : 'flowers' }, { shadow: false, t: 0 });
      } else {
        DA.drawHead(ctx, 'a', x + w * 0.36, y + h * 0.47, w * 0.22, { hat: 'cap' }, { shadow: false, t: 0 });
        DA.drawHead(ctx, 'b', x + w * 0.64, y + h * 0.47, w * 0.22, { hat: 'cap' }, { shadow: false, t: 0 });
      }
      ctx.font = `${w * 0.2}px serif`; ctx.fillStyle = col; ctx.fillText(sym, x + w / 2, y + h * 0.73);
      ctx.restore();
      ctx.strokeStyle = col; ctx.lineWidth = w * 0.015; rr(ctx, x + w * 0.2, y + h * 0.18, w * 0.6, h * 0.64, w * 0.06); ctx.stroke();
    } else {
      ctx.font = `${w * 0.5}px serif`; ctx.fillText(sym, x + w / 2, y + h * 0.52);
      if (rank === 'A') { ctx.font = `${w * 0.16}px serif`; ctx.fillText('💗', x + w / 2, y + h * 0.78); }
    }
    ctx.restore();
  };
  DA.drawCardBack = function (ctx, x, y, w, h) {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = w * 0.08;
    const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#ff4fa3'); g.addColorStop(1, '#5a3dff');
    ctx.fillStyle = g; rr(ctx, x, y, w, h, w * 0.1); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#fff'; ctx.lineWidth = w * 0.04; rr(ctx, x + w * 0.07, y + w * 0.07, w * 0.86, h - w * 0.14, w * 0.07); ctx.stroke();
    if (DA.img.logo) ctx.drawImage(DA.img.logo, x + w * 0.2, y + h / 2 - w * 0.3, w * 0.6, w * 0.6);
    ctx.restore();
  };
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  DA.rr = rr;

  /* ================= SPIEL-STARTBLATT ================= */
  const HOW = {
    soccer: 'Steuerung: ◀ ▶ laufen, ⤒ springen, ⚽ schießen. Köpfen geht auch! 90 Sekunden – wer mehr Tore hat, gewinnt.',
    airhockey: 'Zieh deinen Schläger mit dem Finger über deine Hälfte. Wer zuerst 7 Tore hat, gewinnt.',
    dropzone: 'Linker Stick: laufen. Rechter Stick: zielen & schießen. Sammle Waffen, Medkits und Westen. Bleib in der sicheren Zone! Best of 3.',
    maumau: 'Lege Karten mit gleicher Farbe oder gleichem Wert. 7 = zwei ziehen, 8 = aussetzen, Bube = Wunschfarbe. Wer zuerst keine Karten mehr hat: Mau-Mau!',
    connect4: 'Abwechselnd Chips einwerfen. Vier in einer Reihe – waagerecht, senkrecht oder diagonal – gewinnt.',
    pacman: 'Wische, um die Richtung zu ändern. Friss alle Punkte, die Power-Pillen machen die Geister essbar!',
    runner: 'Wische links/rechts zum Spurwechsel, hoch zum Springen, runter zum Rutschen. Sammle Münzen und lass dich nicht fangen!',
  };
  function openGameSheet(id) {
    const m = DA.gameMeta[id], pa = DA.partner(), paOn = pa.id !== 'ghost' && DA.isOnline(pa.id);
    let best = '';
    if (m.kind === 'solo') {
      const mine = (S.scores[id] || []).filter(e => e.pid === S.me.id);
      best = `<p>Dein Rekord: <b style="color:#ffc21a">${mine.length ? mine[0].score : '—'}</b></p>`;
    }
    const btns = [];
    if (m.kind === 'solo') btns.push({ label: '▶ Spielen', cls: 'primary', fn: () => DA.openGame(id) });
    else {
      btns.push({ label: `🔴 Live gegen ${DA.esc(pa.name)} ${paOn ? '' : '(offline)'}`, cls: 'primary', fn: () => DA.net.send({ t: 'invite', game: id }) });
      if (m.kind === 'turn') btns.push({ label: '🤖 Gegen Computer', cls: 'ghost', fn: () => DA.net.send({ t: 'start_cpu', game: id }) });
      else btns.push({ label: '🤖 Gegen Computer üben', cls: 'ghost', fn: () => DA.openGame(id, { vsCpu: true }) });
    }
    btns.push({ label: 'Abbrechen', cls: 'ghost', fn: closeModal });
    modal(`<div class="hero"><canvas></canvas></div><h3>${m.title}</h3>${best}<div class="how">${HOW[id]}</div><div class="btns"></div>`, btns);
    requestAnimationFrame(() => drawCardArt($('#modal .hero canvas'), id));
  }

  /* ================= MODAL ================= */
  function modal(html, btns, data) {
    const md = $('#modal');
    md.innerHTML = `<div class="sheet">${html}</div>`;
    md.dataset.invite = (data && data.invite) || '';
    const bb = md.querySelector('.btns');
    (btns || []).forEach(b => {
      const x = document.createElement('button'); x.className = 'btn wide ' + (b.cls || 'ghost'); x.innerHTML = b.label;
      x.onclick = () => { DA.sfx.play('click'); if (b.close !== false) closeModal(); b.fn && b.fn(); };
      bb.appendChild(x);
    });
    md.classList.remove('hidden');
    md.onclick = e => { if (e.target === md && !(data && data.sticky)) closeModal(); };
  }
  function closeModal() { const md = $('#modal'); md.classList.add('hidden'); md.innerHTML = ''; md.dataset.invite = ''; }
  DA.modal = modal; DA.closeModal = closeModal;

  function showInvite(inv) {
    if (!S.me || inv.from === S.me.id) return;
    const p = DA.profileById(inv.from) || { name: 'Jemand', char: 'b' };
    const m = DA.gameMeta[inv.game];
    DA.sfx.play('alarm'); DA.vibrate([60, 60, 60]);
    modal(`<div class="invite-pop">${avImg(p)}<div><h3>${DA.esc(p.name)}</h3><p style="margin:0">fordert dich heraus!</p></div></div>
      <div class="how" style="font-size:16px">🎮 <b>${m.title}</b> – ${m.sub}</div><div class="btns"></div>`,
      [{ label: '✅ Annehmen & los!', cls: 'primary', close: false, fn: () => DA.net.send({ t: 'invite_reply', id: inv.id, accept: true }) },
       { label: 'Jetzt nicht', cls: 'ghost', fn: () => DA.net.send({ t: 'invite_reply', id: inv.id, accept: false }) }],
      { invite: inv.id, sticky: true });
    $('#modal .invite-pop img').style.cssText = 'width:64px;height:64px;border-radius:50%;border:3px solid #ff4fa3;animation:wiggle 1s ease-in-out infinite';
  }
  function showWaiting(inv, reach) {
    const pa = DA.partner(), m = DA.gameMeta[inv.game];
    modal(`<h3>${m.title}</h3><div class="spinner"></div><p style="text-align:center">${reach ? `Warte auf ${DA.esc(pa.name)}…` : `${DA.esc(pa.name)} ist gerade offline. Die Einladung bleibt 2 Minuten offen – schreib ihr doch im Chat! 💬`}</p><div class="btns"></div>`,
      [{ label: '💬 Chat öffnen', cls: 'ghost', close: false, fn: () => DA.openChat() },
       { label: 'Einladung zurückziehen', cls: 'ghost', fn: () => DA.net.send({ t: 'invite_cancel' }) }], { sticky: true });
  }

  /* ================= CHAT ================= */
  DA.openChat = function () {
    unread = 0; updateBadges();
    $('#chat').classList.add('open'); $('#drawerShade').classList.add('on');
    renderChat(); renderChatHead();
    setTimeout(() => { const l = $('#chatList'); l.scrollTop = l.scrollHeight; }, 50);
  };
  function closeChat() { $('#chat').classList.remove('open'); $('#drawerShade').classList.remove('on'); $('#chatInput').blur(); }
  function chatOpen() { return $('#chat').classList.contains('open'); }
  function updateBadges() {
    [['#chatBadge'], ['#gChatBadge']].forEach(([s]) => { const b = $(s); b.textContent = unread; b.classList.toggle('hidden', !unread); });
  }
  function renderChatHead() {
    const pa = DA.partner(); if (!pa) return;
    $('#chatWho').innerHTML = `${avImg(pa)}<div>${DA.esc(pa.name)}<small>${DA.isOnline(pa.id) ? '🟢 online' : 'offline – liest es später'}</small></div>`;
    $('#chatWho img').style.cssText = 'width:38px;height:38px;border-radius:50%';
  }
  function msgEl(m) {
    const p = DA.profileById(m.pid) || { char: m.char, outfit: {} }, mine = S.me && m.pid === S.me.id;
    const onlyEmoji = /^(\p{Extended_Pictographic}|️|‍|\s){1,6}$/u.test(m.text);
    const d = document.createElement('div'); d.className = 'msg' + (mine ? ' me' : '') + (onlyEmoji ? ' emoji' : '');
    const tm = new Date(m.ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    d.innerHTML = `<img src="${DA.avatarURL(p, 64)}" style="width:28px;height:28px;border-radius:50%;flex:none" alt=""><div><div class="bubble"></div><div class="meta">${tm}${m.game ? ' · 🎮 ' + (DA.gameMeta[m.game] ? DA.gameMeta[m.game].title : '') : ''}</div></div>`;
    d.querySelector('.bubble').textContent = m.text;
    return d;
  }
  function renderChat() {
    const l = $('#chatList'); l.innerHTML = '';
    let lastDay = '';
    if (!S.chat.length) l.innerHTML = '<div class="day-sep">Noch keine Nachrichten – sag Hallo! 👋</div>';
    S.chat.forEach(m => {
      const day = new Date(m.ts).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
      if (day !== lastDay) { lastDay = day; const s = document.createElement('div'); s.className = 'day-sep'; s.textContent = day; l.appendChild(s); }
      l.appendChild(msgEl(m));
    });
    l.scrollTop = l.scrollHeight;
  }
  function onChat(m) {
    S.chat.push(m); if (S.chat.length > 300) S.chat.shift();
    const l = $('#chatList');
    if (l.querySelector('.day-sep') && S.chat.length === 1) l.innerHTML = '';
    l.appendChild(msgEl(m)); l.scrollTop = l.scrollHeight;
    $('#chatTyping').classList.add('hidden');
    if (S.me && m.pid !== S.me.id) {
      DA.sfx.play('msg'); DA.vibrate(30);
      if (!chatOpen()) {
        unread++; updateBadges();
        const p = DA.profileById(m.pid) || { char: m.char };
        DA.toast(m.name + ': ' + m.text, '', { char: p.char, outfit: p.outfit, onClick: DA.openChat, ms: 4200 });
      }
    }
  }

  /* ================= HIGHSCORES ================= */
  function renderScores() {
    const me = S.me, pa = DA.partner(), box = $('#scoreBoard'); if (!me) return;
    const mw = winsOf(me.id), pw = pa.id !== 'ghost' ? winsOf(pa.id) : 0, tot = Math.max(1, mw + pw);
    let h = `<div class="score-block"><h4>⚔️ Duell-Bilanz</h4>
      <div class="vs-row"><div class="vs-side">${avImg(me)}<div>${DA.esc(me.name)}</div></div><div class="vs-num">${mw} : ${pw}</div><div class="vs-side r">${avImg(pa)}<div>${DA.esc(pa.name)}</div></div></div>
      <div class="vs-bar"><i style="width:${(mw / tot) * 100}%"></i></div>`;
    ['soccer', 'dropzone', 'airhockey', 'maumau', 'connect4'].forEach(g => {
      const d = S.duels[g] || {}, a = (d[me.id] || {}).w || 0, b = ((d[pa.id] || {}).w) || 0;
      h += `<div class="duel-line"><span>${DA.gameMeta[g].title}</span><span><b class="n">${a}</b> : <b class="n">${b}</b></span></div>`;
    });
    h += `</div>`;
    ['runner', 'pacman'].forEach(g => {
      const list = S.scores[g] || [], seen = {}, top = [];
      list.forEach(e => { if (!seen[e.pid]) { seen[e.pid] = 1; top.push(e); } });
      const all = list.slice(0, 8);
      h += `<div class="score-block"><h4>${g === 'runner' ? '🏃' : '👻'} ${DA.gameMeta[g].title}</h4>`;
      if (!all.length) h += `<div class="empty">Noch keine Punkte – sei die Erste! 🥇</div>`;
      all.forEach((e, i) => {
        const p = DA.profileById(e.pid) || { name: '?', char: 'b' };
        h += `<div class="rank-row"><span class="pos">${['🥇', '🥈', '🥉'][i] || i + 1}</span>${avImg(p)}<div>${DA.esc(p.name)}<small>${new Date(e.ts * 1000).toLocaleDateString('de-DE')}</small></div><span class="sc">${e.score.toLocaleString('de-DE')}</span></div>`;
      });
      h += `</div>`;
    });
    h += `<div class="score-block"><h4>🕑 Letzte Matches</h4>`;
    if (!S.history.length) h += `<div class="empty">Noch keine Duelle gespielt.</div>`;
    S.history.slice(0, 15).forEach(e => {
      const n = e.players.map(id => id === 'cpu' ? '🤖' : ((DA.profileById(id) || {}).name || '?'));
      const w = e.winner === -1 ? 'Unentschieden' : (n[e.winner] + ' gewinnt');
      h += `<div class="hist-row"><span>${DA.gameMeta[e.game] ? DA.gameMeta[e.game].tag.split(' ')[0] : '🎮'}</span><span><b>${DA.esc(w)}</b> ${e.score ? '· ' + DA.esc(e.score) : ''}<br><small style="color:#8a7cb8">${DA.esc(n.join(' vs '))}</small></span><span class="when">${ago(e.ts)}</span></div>`;
    });
    h += `</div>`;
    box.innerHTML = h;
    $$('img', box).forEach(i => i.style.cssText = i.closest('.vs-side') ? 'width:42px;height:42px;border-radius:50%' : 'width:34px;height:34px;border-radius:50%');
  }
  function ago(ts) {
    const s = Date.now() / 1000 - ts;
    if (s < 60) return 'gerade'; if (s < 3600) return Math.floor(s / 60) + ' Min.'; if (s < 86400) return Math.floor(s / 3600) + ' Std.'; return Math.floor(s / 86400) + ' Tg.';
  }

  /* ================= OUTFITS ================= */
  let previewOutfit = null, shopRaf = 0;
  function renderShop() {
    const me = S.me; if (!me || !S.shop) return;
    $('#shopCoins').textContent = me.coins;
    const tabs = { hat: '🎩 Kopf', glasses: '🕶️ Brillen', shirt: '👕 Shirts', trail: '✨ Spuren' };
    $('#shopTabs').innerHTML = Object.entries(tabs).map(([k, v]) => `<button data-t="${k}" class="${k === shopTab ? 'active' : ''}">${v}</button>`).join('');
    $$('#shopTabs button').forEach(b => b.onclick = () => { shopTab = b.dataset.t; DA.sfx.play('click'); renderShop(); });
    const box = $('#shopItems'); box.innerHTML = '';
    S.shop[shopTab].forEach(it => {
      const key = shopTab + ':' + it.id, owned = me.owned.includes(key), on = (me.outfit[shopTab] || 'none') === it.id || (shopTab === 'shirt' && !me.outfit.shirt && it.id === 'default');
      const d = document.createElement('button'); d.className = 'sitem' + (owned ? ' owned' : ' locked') + (on ? ' on' : '');
      d.innerHTML = `<canvas width="144" height="144"></canvas><span>${it.name}</span><span class="price">${owned ? (on ? 'Angezogen' : 'Besitzt du') : '🪙 ' + it.price}</span>`;
      DA.drawItemIcon(d.querySelector('canvas'), shopTab, it.id, me.char);
      d.onclick = () => {
        DA.sfx.play('pop');
        if (owned) { DA.net.send({ t: 'update_profile', outfit: { [shopTab]: it.id } }); previewOutfit = null; }
        else {
          previewOutfit = Object.assign({}, me.outfit, { [shopTab]: it.id });
          modal(`<h3>${it.name}</h3><p>Für <b style="color:#ffc21a">🪙 ${it.price}</b> kaufen? Du hast ${me.coins} Münzen.</p><div class="btns"></div>`,
            [{ label: me.coins >= it.price ? 'Kaufen & anziehen' : 'Zu wenig Münzen 😢', cls: me.coins >= it.price ? 'gold' : 'ghost', fn: () => { if (me.coins >= it.price) { DA.net.send({ t: 'buy', slot: shopTab, item: it.id }); DA.sfx.play('coin'); } previewOutfit = null; } },
             { label: 'Nur anschauen', cls: 'ghost', fn: () => setTimeout(() => { previewOutfit = null; }, 2500) }]);
        }
      };
      box.appendChild(d);
    });
    if (!shopRaf) shopLoop();
  }
  function shopLoop() {
    const cv = $('#shopCanvas'), ctx = cv.getContext('2d');
    const tr = new DA.Trail('none');
    function f(now) {
      if (currentView !== 'shop' || !$('#main').classList.contains('active')) { shopRaf = 0; return; }
      const me = S.me, t = now / 1000, o = previewOutfit || me.outfit;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(260, 480, 110, 18, 0, 0, 7); ctx.fill();
      tr.kind = o.trail || 'none';
      if (Math.random() < 0.7) tr.emit(160 + Math.sin(t * 2) * 20, 420 - Math.random() * 120, 2);
      tr.update(1 / 60, -60, 0); tr.draw(ctx);
      DA.drawChar(ctx, me.char, o, 260, 478, 470, { run: t * 3, bob: Math.sin(t * 6) * 4, facing: 1, t, armUp: 0.2 });
      shopRaf = requestAnimationFrame(f);
    }
    shopRaf = requestAnimationFrame(f);
  }

  /* ================= PROFIL ================= */
  function renderProfile() {
    const me = S.me; if (!me) return;
    const records = ['runner', 'pacman'].map(g => Math.max(0, ...(S.scores[g] || []).filter(e => e.pid === me.id).map(e => e.score)));
    $('#profileBox').innerHTML = `
      <div class="prof-hero">${avImg(me)}<h3>${DA.esc(me.name)}</h3>
        <div class="prof-stats"><div><b>${me.coins}</b>Münzen</div><div><b>${winsOf(me.id)}</b>Siege</div><div><b>${(me.owned || []).length - 4}</b>Outfits</div></div>
        <div class="prof-stats"><div><b>${records[0]}</b>Sprint-Rekord</div><div><b>${records[1]}</b>Geister-Rekord</div><div><b>${winsOf(me.id, true)}</b>vs 🤖</div></div>
      </div>
      <div class="prof-form">
        <label class="lbl">Benutzername</label>
        <div class="row"><input id="pfName" maxlength="18" value="${DA.esc(me.name)}"><button class="btn primary small" id="pfSave" style="flex:none">Speichern</button></div>
        <label class="lbl">Charakter</label>
        <div class="char-pick" id="pfChars">
          <button type="button" class="char-opt ${me.char === 'a' ? 'sel' : ''}" data-char="a"><img src="/img/full_a.png" alt=""><span>Charakter 1</span></button>
          <button type="button" class="char-opt ${me.char === 'b' ? 'sel' : ''}" data-char="b"><img src="/img/full_b.png" alt=""><span>Charakter 2</span></button>
        </div>
        <label class="lbl">Farbe</label><div class="color-pick" id="pfColors"></div>
        <label class="lbl">Einstellungen</label>
        <div class="toggle-row">🔊 Sound<span class="switch ${DA.settings.sound ? 'on' : ''}" data-s="sound"></span></div>
        <div class="toggle-row">📳 Vibration<span class="switch ${DA.settings.vibrate ? 'on' : ''}" data-s="vibrate"></span></div>
        <div class="how" style="margin-top:6px">📲 <b>Tipp:</b> Im Browser „Teilen → Zum Home-Bildschirm“ (iPhone) bzw. „App installieren“ (Android) – dann startet DUO ARENA wie eine echte App im Vollbild.</div>
        <button class="btn ghost wide" id="pfSwitch">Profil auf diesem Gerät wechseln</button>
      </div>`;
    const hi = $('#profileBox .prof-hero img'); hi.style.cssText = 'width:130px;height:130px;border-radius:50%;border:4px solid ' + (me.color || '#ff4fa3');
    $('#pfSave').onclick = () => { const v = $('#pfName').value.trim(); if (v) { DA.net.send({ t: 'update_profile', name: v }); DA.toast('Gespeichert ✓', 'ok'); } };
    $$('#pfChars .char-opt').forEach(o => o.onclick = () => { DA.net.send({ t: 'update_profile', char: o.dataset.char }); DA.sfx.play('pop'); });
    const cp = $('#pfColors');
    COLORS.forEach(c => { const b = document.createElement('button'); b.type = 'button'; b.style.background = c; b.className = c === me.color ? 'sel' : ''; b.onclick = () => DA.net.send({ t: 'update_profile', color: c }); cp.appendChild(b); });
    $$('#profileBox .switch').forEach(s => s.onclick = () => { const k = s.dataset.s; DA.settings[k] = !DA.settings[k]; DA.store.set('settings', DA.settings); s.classList.toggle('on', DA.settings[k]); DA.sfx.play('click'); });
    $('#pfSwitch').onclick = () => { DA.store.set('pid', null); S.me = null; location.reload(); };
  }
})();
