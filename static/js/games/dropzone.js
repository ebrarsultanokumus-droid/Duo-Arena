/* Drop Zone – Battle Royale 1 gegen 1 (Top-Down-Shooter), live */
'use strict';
DA.games.dropzone = {
  start(G) {
    const WS = 2000, PR = 24, ctx = G.ctx, P = G.players;
    const WEAP = {
      pistol: { n: 'Pistole', dmg: 16, rate: 0.32, spd: 1150, spread: 0.05, range: 700, pel: 1, ic: '🔫', sfx: 'shoot' },
      smg: { n: 'MP', dmg: 10, rate: 0.09, spd: 1200, spread: 0.13, range: 650, pel: 1, ic: '⚡', sfx: 'shoot' },
      rifle: { n: 'Sturmgewehr', dmg: 19, rate: 0.16, spd: 1450, spread: 0.045, range: 1000, pel: 1, ic: '🎯', sfx: 'shoot' },
      shotgun: { n: 'Schrotflinte', dmg: 11, rate: 0.85, spd: 1050, spread: 0.32, range: 400, pel: 7, ic: '💥', sfx: 'shotgun' },
      sniper: { n: 'Scharfschütze', dmg: 72, rate: 1.4, spd: 2600, spread: 0, range: 1700, pel: 1, ic: '🔭', sfx: 'sniper' },
    };
    const LOOT_IC = { smg: '⚡', rifle: '🎯', shotgun: '💥', sniper: '🔭', med: '💊', armor: '🦺' };
    const seed = (G.room && G.room.seed) || Math.floor(Math.random() * 1e9);
    const map = genMap(seed);
    let st = null, events = [], evBuf = [], frame = 0, lastHud = '', fx = [], dmgTxt = [], bulletsView = [], lastShotSfx = 0;
    const inputs = [{}, {}];
    let mouse = { x: 0, y: 0, down: false, used: false }, pred = null, sendT = 0, bot = { t: 0, strafe: 1, goal: null };

    /* ---------- Karte (aus gemeinsamem Seed) ---------- */
    function genMap(sd) {
      const r = DA.seeded(sd), rects = [], trees = [], crates = [];
      const spawns = [[260, 1000], [1740, 1000]];
      const free = (x, y, rad) => spawns.every(([sx, sy]) => Math.hypot(sx - x, sy - y) > 220 + rad) && x > rad + 30 && y > rad + 30 && x < WS - rad - 30 && y < WS - rad - 30;
      const hitsRect = (x, y, w, h, pad) => rects.some(q => x < q.x + q.w + pad && x + w + pad > q.x && y < q.y + q.h + pad && y + h + pad > q.y);
      let tries = 0;
      while (rects.length < 15 && tries++ < 400) {
        const w = 120 + r() * 200, h = 120 + r() * 200, x = 80 + r() * (WS - 160 - w), y = 80 + r() * (WS - 160 - h);
        if (!free(x + w / 2, y + h / 2, Math.max(w, h) / 2) || hitsRect(x, y, w, h, 120)) continue;
        rects.push({ x, y, w, h, roof: ['#8a6f5c', '#6f7c8a', '#9a5d5d', '#5d7a63', '#7d6a9a'][Math.floor(r() * 5)] });
      }
      tries = 0;
      while (trees.length < 46 && tries++ < 800) {
        const x = 60 + r() * (WS - 120), y = 60 + r() * (WS - 120), rad = 24 + r() * 18;
        if (!free(x, y, rad) || hitsRect(x - rad, y - rad, rad * 2, rad * 2, 30) || trees.some(t => Math.hypot(t.x - x, t.y - y) < t.r + rad + 40)) continue;
        trees.push({ x, y, r: rad });
      }
      tries = 0;
      while (crates.length < 16 && tries++ < 600) {
        const x = 60 + r() * (WS - 120), y = 60 + r() * (WS - 120);
        if (!free(x, y, 40) || hitsRect(x - 30, y - 30, 60, 60, 40) || trees.some(t => Math.hypot(t.x - x, t.y - y) < t.r + 60)) continue;
        crates.push({ x: x - 26, y: y - 26, w: 52, h: 52, crate: true });
      }
      const roadY = 500 + r() * 1000, roadX = 500 + r() * 1000;
      return { rects, trees, crates, solids: rects.concat(crates), spawns, roadX, roadY, rnd: r };
    }
    function genLoot(round) {
      const r = DA.seeded(seed + round * 7919), list = [], kinds = ['smg', 'smg', 'rifle', 'rifle', 'shotgun', 'shotgun', 'sniper', 'med', 'med', 'med', 'armor', 'armor'];
      let id = 0, tries = 0;
      while (list.length < 34 && tries++ < 1000) {
        const x = 80 + r() * (WS - 160), y = 80 + r() * (WS - 160);
        if (blocked(x, y, 30)) continue;
        list.push({ id: id++, t: kinds[Math.floor(r() * kinds.length)], x, y });
      }
      // in der Nähe beider Startpunkte je eine Waffe – fair für beide
      map.spawns.forEach(([sx, sy], i) => list.push({ id: id++, t: i ? 'smg' : 'smg', x: sx + (i ? -120 : 120), y: sy }));
      return list;
    }
    function zoneFor(round) { const r = DA.seeded(seed + round * 104729); return { cx: 700 + r() * 600, cy: 700 + r() * 600 }; }

    /* ---------- Kollision ---------- */
    function blocked(x, y, rad) {
      if (map.solids.some(q => x + rad > q.x && x - rad < q.x + q.w && y + rad > q.y && y - rad < q.y + q.h)) return true;
      return map.trees.some(t => Math.hypot(t.x - x, t.y - y) < t.r + rad);
    }
    function pushOut(p) {
      for (const q of map.solids) {
        const cx = DA.clamp(p.x, q.x, q.x + q.w), cy = DA.clamp(p.y, q.y, q.y + q.h), dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
        if (d < PR) {
          if (d > 0.001) { p.x = cx + dx / d * PR; p.y = cy + dy / d * PR; }
          else { const l = p.x - q.x, rr = q.x + q.w - p.x, t = p.y - q.y, b = q.y + q.h - p.y, m = Math.min(l, rr, t, b); if (m === l) p.x = q.x - PR; else if (m === rr) p.x = q.x + q.w + PR; else if (m === t) p.y = q.y - PR; else p.y = q.y + q.h + PR; }
        }
      }
      for (const t of map.trees) { const dx = p.x - t.x, dy = p.y - t.y, d = Math.hypot(dx, dy); if (d < t.r + PR && d > 0) { p.x = t.x + dx / d * (t.r + PR); p.y = t.y + dy / d * (t.r + PR); } }
      p.x = DA.clamp(p.x, PR, WS - PR); p.y = DA.clamp(p.y, PR, WS - PR);
    }
    function segHits(x0, y0, x1, y1) {
      // trifft die Strecke ein Hindernis? (für Kugeln und Sichtlinie)
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 14);
      for (let i = 1; i <= steps; i++) { const k = i / steps, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k; if (blocked(x, y, 2)) return true; }
      return false;
    }
    function movePlayer(p, inp, dt) {
      let mx = inp.mx || 0, my = inp.my || 0; const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
      const sp = p.w === 'sniper' ? 225 : 260;
      p.x += mx * sp * dt; p.y += my * sp * dt; pushOut(p);
      if (inp.ax || inp.ay) p.a = Math.atan2(inp.ay, inp.ax); else if (m > 0.2) p.a = Math.atan2(my, mx);
    }

    /* ---------- Zustand ---------- */
    function newRound(prev) {
      const rd = prev ? prev.rd + 1 : 1, z = zoneFor(rd);
      return {
        rd, wins: prev ? prev.wins : [0, 0], ph: 'drop', pt: 2.8, time: 0,
        p: map.spawns.map(([x, y], i) => ({ x, y, a: i ? Math.PI : 0, hp: 100, ar: 0, w: 'pistol', cd: 0, alive: true })),
        b: [], loot: genLoot(rd), zone: { cx: z.cx, cy: z.cy, r: 1500, nr: 1500 }, lastWin: -1,
      };
    }
    const ZONE = [[18, 1500, 760, 4], [16, 760, 380, 7], [14, 380, 150, 11], [12, 150, 0, 16]]; // [Wartezeit+Schrumpfzeit, von, bis, Schaden/s]
    function zoneAt(t) {
      let acc = 0;
      for (const [dur, from, to, dmg] of ZONE) {
        const wait = dur * 0.45, shrink = dur * 0.55;
        if (t < acc + wait) return { r: from, nr: to, dmg };
        if (t < acc + dur) return { r: DA.lerp(from, to, (t - acc - wait) / shrink), nr: to, dmg };
        acc += dur;
      }
      return { r: 0, nr: 0, dmg: 20 };
    }

    /* ---------- Host-Simulation ---------- */
    function step(dt) {
      const s = st;
      if (s.ph === 'drop') { s.pt -= dt; if (s.pt <= 0) { s.ph = 'fight'; events.push('go'); } return; }
      if (s.ph === 'roundEnd') {
        s.pt -= dt;
        if (s.pt <= 0) {
          if (Math.max(...s.wins) >= 2) { s.ph = 'end'; const w = s.wins[0] > s.wins[1] ? 0 : 1; G.rt.result(w, s.wins[0] + ':' + s.wins[1]); showEnd(); }
          else st = newRound(s);
        }
        return;
      }
      if (s.ph !== 'fight') return;
      s.time += dt;
      const z = zoneAt(s.time); s.zone.r = z.r; s.zone.nr = z.nr;
      s.p.forEach((p, i) => {
        if (!p.alive) return;
        const inp = inputs[i];
        movePlayer(p, inp, dt);
        p.cd -= dt;
        if (inp.fire && p.cd <= 0) {
          const w = WEAP[p.w]; p.cd = w.rate;
          for (let k = 0; k < w.pel; k++) {
            const a = p.a + (Math.random() - 0.5) * w.spread * 2;
            s.b.push({ x: p.x + Math.cos(p.a) * 34, y: p.y + Math.sin(p.a) * 34, vx: Math.cos(a) * w.spd, vy: Math.sin(a) * w.spd, d: w.dmg, o: i, life: w.range / w.spd });
          }
          events.push('s' + i + p.w);
        }
        // Zone
        if (Math.hypot(p.x - s.zone.cx, p.y - s.zone.cy) > s.zone.r) { hurt(p, i, z.dmg * dt, true); }
        // Beute
        for (let k = s.loot.length - 1; k >= 0; k--) {
          const L = s.loot[k];
          if (Math.hypot(L.x - p.x, L.y - p.y) < PR + 22) {
            if (L.t === 'med') { if (p.hp >= 100) continue; p.hp = Math.min(100, p.hp + 45); }
            else if (L.t === 'armor') { if (p.ar >= 100) continue; p.ar = Math.min(100, p.ar + 60); }
            else { if (p.w === L.t) continue; p.w = L.t; p.cd = 0.2; }
            s.loot.splice(k, 1); events.push('p' + i + L.t);
          }
        }
      });
      // Kugeln
      for (let k = s.b.length - 1; k >= 0; k--) {
        const b = s.b[k], sub = 3; let dead = false;
        for (let j = 0; j < sub && !dead; j++) {
          b.x += b.vx * dt / sub; b.y += b.vy * dt / sub;
          if (blocked(b.x, b.y, 2) || b.x < 0 || b.y < 0 || b.x > WS || b.y > WS) { dead = true; fx.push({ x: b.x, y: b.y, t: 0.25, k: 'spark' }); break; }
          s.p.forEach((p, i) => {
            if (dead || i === b.o || !p.alive) return;
            if (Math.hypot(p.x - b.x, p.y - b.y) < PR + 4) { dead = true; hurt(p, i, b.d, false); events.push('h' + i + '_' + Math.round(b.d)); }
          });
        }
        b.life -= dt;
        if (dead || b.life <= 0) s.b.splice(k, 1);
      }
    }
    function hurt(p, i, dmg, zone) {
      if (!zone && p.ar > 0) { const ab = Math.min(p.ar, dmg * 0.5); p.ar -= ab; dmg -= ab; }
      p.hp -= dmg;
      if (p.hp <= 0 && p.alive) {
        p.hp = 0; p.alive = false; const w = 1 - i; st.wins[w]++; st.lastWin = w; st.ph = 'roundEnd'; st.pt = 3.2; events.push('k' + i);
      }
    }

    /* ---------- Computer-Gegner ---------- */
    function botInput(dt) {
      const me = st.p[1], en = st.p[0], o = {};
      if (!me.alive || st.ph !== 'fight') return o;
      bot.t -= dt; if (bot.t <= 0) { bot.t = 0.8 + Math.random(); bot.strafe = Math.random() < 0.5 ? -1 : 1; }
      const dx = en.x - me.x, dy = en.y - me.y, d = Math.hypot(dx, dy), los = !segHits(me.x, me.y, en.x, en.y), w = WEAP[me.w];
      let tx = en.x, ty = en.y;
      const zd = Math.hypot(me.x - st.zone.cx, me.y - st.zone.cy);
      if (zd > st.zone.nr * 0.9 && zd > 120) { tx = st.zone.cx; ty = st.zone.cy; }
      else if (st.time < 25 || me.w === 'pistol' || (me.hp < 60)) {
        let best = null, bd = 520;
        st.loot.forEach(L => { const ld = Math.hypot(L.x - me.x, L.y - me.y); const want = (L.t === 'med' && me.hp < 80) || (L.t === 'armor' && me.ar < 50) || (!['med', 'armor'].includes(L.t) && me.w === 'pistol'); if (want && ld < bd) { bd = ld; best = L; } });
        if (best) { tx = best.x; ty = best.y; }
      }
      let mx = tx - me.x, my = ty - me.y; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
      if (tx === en.x && ty === en.y && los && d < w.range * 0.7) { const sx = -dy / d, sy = dx / d; mx = sx * bot.strafe + (d < 250 ? -dx / d : 0); my = sy * bot.strafe + (d < 250 ? -dy / d : 0); }
      // Hindernis vor der Nase? seitlich ausweichen
      if (blocked(me.x + mx * 40, me.y + my * 40, PR)) { const t = mx; mx = -my * bot.strafe; my = t * bot.strafe; }
      o.mx = mx; o.my = my;
      if (los && d < w.range) { const err = (Math.random() - 0.5) * 0.25; o.ax = Math.cos(Math.atan2(dy, dx) + err); o.ay = Math.sin(Math.atan2(dy, dx) + err); o.fire = Math.random() < 0.75; }
      return o;
    }

    /* ---------- Steuerung ---------- */
    const touch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window, C = G.controls;
    if (touch) {
      C.joystick('move', { left: 'calc(26px + env(safe-area-inset-left))', bottom: 'calc(30px + env(safe-area-inset-bottom))', width: '130px', height: '130px' }, 'LAUFEN');
      C.joystick('aim', { right: 'calc(26px + env(safe-area-inset-right))', bottom: 'calc(30px + env(safe-area-inset-bottom))', width: '130px', height: '130px' }, 'ZIELEN & FEUER');
    }
    G.on(G.canvas, 'mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.used = true; });
    G.on(G.canvas, 'mousedown', e => { mouse.down = true; mouse.used = true; });
    G.on(window, 'mouseup', () => { mouse.down = false; });
    function readLocal() {
      const k = G.keys, o = { mx: 0, my: 0, ax: 0, ay: 0, fire: false };
      const mv = C.keys.move, am = C.keys.aim;
      if (mv && mv.active) { o.mx = mv.x; o.my = mv.y; }
      o.mx += (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0);
      o.my += (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0);
      if (am && am.active && am.mag > 0.25) { o.ax = am.x; o.ay = am.y; o.fire = am.mag > 0.55; }
      else if (mouse.used && !touch) {
        const me = myPlayerView(); if (me) { const sx = G.W / 2, sy = G.H / 2; o.ax = mouse.x - sx; o.ay = mouse.y - sy; const l = Math.hypot(o.ax, o.ay) || 1; o.ax /= l; o.ay /= l; }
        o.fire = mouse.down || !!k[' '];
      }
      return o;
    }
    function myPlayerView() { if (!st) return null; return G.isHost ? st.p[G.you] : (pred || st.p[G.you]); }

    /* ---------- Netz ---------- */
    G.rt.on(d => {
      if (G.isHost) { if (d.k === 'i') inputs[1] = d; if (d.k === 'rematch') restart(); }
      else if (d.k === 's') applySnap(d);
    });
    function restart() { st = newRound(null); G.panel(null); if (G.online) G.rt.send({ k: 'restart' }); }
    function applySnap(d) {
      const wasEnd = st && st.ph === 'end', newR = !st || st.rd !== d.rd;
      if (newR) { st = newRound(d.rd > 1 ? { rd: d.rd - 1, wins: d.wins } : null); pred = null; }
      st.ph = d.ph; st.pt = d.pt; st.wins = d.wins; st.lastWin = d.lw; st.time = d.tm;
      st.zone = { cx: d.z[0], cy: d.z[1], r: d.z[2], nr: d.z[3] };
      st.p = d.p.map(a => ({ x: a[0], y: a[1], a: a[2], hp: a[3], ar: a[4], w: a[5], alive: !!a[6] }));
      const keep = new Set(d.lt); st.loot = st.loot.filter(L => keep.has(L.id));
      bulletsView = d.b.map(a => ({ x: a[0], y: a[1], vx: a[2], vy: a[3] }));
      // eigene Vorhersage sanft korrigieren
      const srv = st.p[G.you];
      if (!pred || !srv.alive || Math.hypot(pred.x - srv.x, pred.y - srv.y) > 90) pred = { x: srv.x, y: srv.y, a: srv.a };
      else { pred.x = DA.lerp(pred.x, srv.x, 0.18); pred.y = DA.lerp(pred.y, srv.y, 0.18); }
      (d.ev || []).forEach(playEv);
      if (st.ph === 'end' && !wasEnd) showEnd();
      if (st.ph !== 'end' && wasEnd) G.panel(null);
    }

    /* ---------- Effekte ---------- */
    function playEv(e) {
      const c = e[0], i = +e[1];
      const p = st.p[i];
      if (c === 's') {
        const w = e.slice(2); const now = performance.now();
        if (now - lastShotSfx > 50) { DA.sfx.play(WEAP[w] ? WEAP[w].sfx : 'shoot'); lastShotSfx = now; }
        if (p) fx.push({ x: p.x + Math.cos(p.a) * 40, y: p.y + Math.sin(p.a) * 40, t: 0.06, k: 'flash' });
      } else if (c === 'h') {
        const dmg = e.split('_')[1]; if (p) dmgTxt.push({ x: p.x + DA.rand(-12, 12), y: p.y - 40, t: 0.9, v: dmg, me: i === G.you });
        if (i === G.you) { DA.vibrate(25); hitFlash = 0.25; } DA.sfx.play('hit');
      } else if (c === 'p') {
        if (i === G.you) { DA.sfx.play('pickup'); const t = e.slice(2); dmgTxt.push({ x: p.x, y: p.y - 50, t: 1.2, v: t === 'med' ? '+HP' : t === 'armor' ? '+Weste' : WEAP[t].n, me: false, pick: true }); }
      } else if (c === 'k') {
        DA.sfx.play(i === G.you ? 'lose' : 'win'); DA.vibrate([100, 50, 100]);
        if (p) for (let k = 0; k < 40; k++) fx.push({ x: p.x, y: p.y, vx: DA.rand(-300, 300), vy: DA.rand(-300, 300), t: 0.8, k: 'boom', c: ['#ffc21a', '#ff4fa3', '#fff'][k % 3] });
      } else if (e === 'go') DA.sfx.play('go');
    }
    let hitFlash = 0;
    function showEnd() {
      const w = st.wins[0] > st.wins[1] ? 0 : 1, me = G.you;
      G.panel({
        top: '<div style="font-size:56px">' + (w === me ? '🏆' : '💀') + '</div>',
        title: w === me ? 'Winner Winner, Chicken Dinner!' : P[w].name + ' ist die Letzte im Ring!', html: `<div class="big-num">${st.wins[me]} : ${st.wins[1 - me]}</div><p>${G.online ? (w === me ? '+40 🪙' : '+12 🪙') : 'Training gegen den Bot'}</p>`,
        buttons: [{ label: '🔁 Revanche', cls: 'primary', onClick: () => { if (G.isHost) restart(); else { G.rt.send({ k: 'rematch' }); G.panel({ title: 'Revanche angefragt…', html: '<div class="spinner"></div>' }); } } },
          { label: 'Zurück zur Arena', onClick: () => G.exit() }],
      });
    }

    /* ---------- Zeichnen ---------- */
    let grass = null;
    function grassPattern() {
      const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const r = DA.seeded(5);
      g.fillStyle = '#4c8a3f'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 260; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.05)'; g.beginPath(); g.arc(r() * 256, r() * 256, 2 + r() * 10, 0, 7); g.fill(); }
      for (let i = 0; i < 120; i++) { g.strokeStyle = 'rgba(30,70,25,.35)'; g.lineWidth = 1.5; const x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + r() * 4 - 2, y - 6); g.stroke(); }
      return ctx.createPattern(c, 'repeat');
    }
    function render(t, dt) {
      G.resetTransform();
      ctx.fillStyle = '#20361c'; ctx.fillRect(0, 0, G.W, G.H);
      if (!st) return;
      const me = myPlayerView(), sc = Math.max(G.W, G.H) / 1050;
      const cam = { x: me.x, y: me.y };
      let shake = hitFlash > 0 ? hitFlash * 12 : 0; hitFlash = Math.max(0, hitFlash - dt);
      const drop = st.ph === 'drop' ? st.pt / 2.8 : 0, zoom = sc * (1 - drop * 0.45);
      ctx.setTransform(zoom * G.dpr, 0, 0, zoom * G.dpr, (G.W / 2 - cam.x * zoom + DA.rand(-shake, shake)) * G.dpr, (G.H / 2 - cam.y * zoom + DA.rand(-shake, shake)) * G.dpr);
      G.view = { s: zoom, ox: G.W / 2 - cam.x * zoom, oy: G.H / 2 - cam.y * zoom };
      // Boden
      if (!grass) grass = grassPattern();
      ctx.fillStyle = grass; ctx.fillRect(0, 0, WS, WS);
      ctx.fillStyle = '#5b5a63'; ctx.fillRect(0, map.roadY - 50, WS, 100); ctx.fillRect(map.roadX - 50, 0, 100, WS);
      ctx.strokeStyle = '#e8e2c0'; ctx.lineWidth = 5; ctx.setLineDash([40, 40]);
      ctx.beginPath(); ctx.moveTo(0, map.roadY); ctx.lineTo(WS, map.roadY); ctx.moveTo(map.roadX, 0); ctx.lineTo(map.roadX, WS); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#1a2b16'; ctx.lineWidth = 16; ctx.strokeRect(-8, -8, WS + 16, WS + 16);
      // Beute
      st.loot.forEach(L => {
        const pulse = 1 + Math.sin(t * 4 + L.id) * 0.08, col = L.t === 'med' ? '#ff4d6a' : L.t === 'armor' ? '#3de7ff' : '#ffc21a';
        ctx.fillStyle = col + '55'; ctx.beginPath(); ctx.arc(L.x, L.y, 26 * pulse, 0, 7); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
        ctx.font = '26px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(LOOT_IC[L.t], L.x, L.y + 1);
      });
      // Schatten der Gebäude
      ctx.fillStyle = 'rgba(0,0,0,.28)'; map.rects.forEach(q => ctx.fillRect(q.x + 16, q.y + 18, q.w, q.h));
      // Spieler
      st.p.forEach((p, i) => {
        if (!p.alive) return;
        const pp = (i === G.you && !G.isHost && pred) ? Object.assign({}, p, { x: pred.x, y: pred.y, a: pred.a }) : p, pl = P[i];
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(pp.x + 6, pp.y + 10, PR + 2, PR * 0.8, 0, 0, 7); ctx.fill();
        // Waffe
        ctx.save(); ctx.translate(pp.x, pp.y); ctx.rotate(pp.a);
        const len = { pistol: 34, smg: 42, rifle: 52, shotgun: 48, sniper: 66 }[p.w] || 36;
        ctx.fillStyle = '#1a1030'; ctx.fillRect(10, -6, len, 12); ctx.fillStyle = '#4a4560'; ctx.fillRect(12, -4, len - 4, 8);
        ctx.fillStyle = DA.anchor(pl.char).skin; ctx.beginPath(); ctx.arc(18, 8, 7, 0, 7); ctx.fill();
        ctx.restore();
        ctx.fillStyle = DA.shirtFill(ctx, pl.char, pl.outfit, pp.x - PR, pp.y - PR, PR * 2, PR * 2); ctx.strokeStyle = '#1a1030'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(pp.x, pp.y + 6, PR, 0, 7); ctx.fill(); ctx.stroke();
        if (p.ar > 0) { ctx.strokeStyle = '#3de7ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(pp.x, pp.y + 6, PR + 3, 0, 7 * p.ar / 100 * 0.9); ctx.stroke(); }
        DA.drawHead(ctx, pl.char, pp.x, pp.y - 12, 30, pl.outfit, { shadow: false, t, angry: i !== G.you });
        // Lebensbalken
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(pp.x - 30, pp.y - 58, 60, 8);
        ctx.fillStyle = p.hp > 50 ? '#7dff6b' : p.hp > 25 ? '#ffc21a' : '#ff4d5e'; ctx.fillRect(pp.x - 29, pp.y - 57, 58 * p.hp / 100, 6);
        ctx.font = '900 13px Nunito, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(i === G.you ? 'Du' : pl.name, pp.x, pp.y - 68);
      });
      // Kugeln
      const bl = G.isHost ? st.b : bulletsView;
      if (!G.isHost) bulletsView.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; });
      ctx.lineCap = 'round';
      bl.forEach(b => { const l = Math.hypot(b.vx, b.vy) || 1; ctx.strokeStyle = '#fff6a0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx / l * 22, b.y - b.vy / l * 22); ctx.stroke(); });
      // Bäume & Gebäude (über Spielern = Deckung)
      map.trees.forEach(tr => {
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(tr.x + 10, tr.y + 12, tr.r, 0, 7); ctx.fill();
        ctx.fillStyle = '#2e6b2a'; ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r, 0, 7); ctx.fill();
        ctx.fillStyle = '#3f8a36'; ctx.beginPath(); ctx.arc(tr.x - tr.r * 0.2, tr.y - tr.r * 0.25, tr.r * 0.7, 0, 7); ctx.fill();
        ctx.fillStyle = '#56a84a'; ctx.beginPath(); ctx.arc(tr.x - tr.r * 0.35, tr.y - tr.r * 0.4, tr.r * 0.32, 0, 7); ctx.fill();
      });
      map.crates.forEach(q => {
        ctx.fillStyle = '#b07a3e'; ctx.fillRect(q.x, q.y, q.w, q.h); ctx.strokeStyle = '#6b4520'; ctx.lineWidth = 4; ctx.strokeRect(q.x + 2, q.y + 2, q.w - 4, q.h - 4);
        ctx.beginPath(); ctx.moveTo(q.x + 4, q.y + 4); ctx.lineTo(q.x + q.w - 4, q.y + q.h - 4); ctx.moveTo(q.x + q.w - 4, q.y + 4); ctx.lineTo(q.x + 4, q.y + q.h - 4); ctx.stroke();
      });
      map.rects.forEach(q => {
        ctx.fillStyle = q.roof; ctx.fillRect(q.x, q.y, q.w, q.h);
        ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(q.x, q.y, q.w, q.h / 2);
        ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 4; ctx.strokeRect(q.x + 2, q.y + 2, q.w - 4, q.h - 4);
        ctx.beginPath(); ctx.moveTo(q.x, q.y + q.h / 2); ctx.lineTo(q.x + q.w, q.y + q.h / 2); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(q.x + q.w * 0.15, q.y + q.h * 0.15, 22, 22);
      });
      // Effekte
      fx.forEach(f => {
        f.t -= dt;
        if (f.k === 'flash') { ctx.fillStyle = '#fff6a0'; ctx.beginPath(); ctx.arc(f.x, f.y, 12, 0, 7); ctx.fill(); }
        else if (f.k === 'spark') { ctx.fillStyle = 'rgba(255,240,180,.8)'; ctx.beginPath(); ctx.arc(f.x, f.y, 5, 0, 7); ctx.fill(); }
        else { f.x += f.vx * dt; f.y += f.vy * dt; ctx.globalAlpha = Math.max(0, f.t); ctx.fillStyle = f.c; ctx.fillRect(f.x - 4, f.y - 4, 8, 8); ctx.globalAlpha = 1; }
      });
      fx = fx.filter(f => f.t > 0);
      dmgTxt.forEach(d => { d.t -= dt; d.y -= 40 * dt; ctx.globalAlpha = Math.min(1, d.t * 2); ctx.font = (d.pick ? '900 18px' : '900 20px') + ' Nunito, sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = '#1a1030'; ctx.strokeText(d.v, d.x, d.y); ctx.fillStyle = d.pick ? '#7dff6b' : d.me ? '#ff4d5e' : '#fff'; ctx.fillText(d.v, d.x, d.y); });
      ctx.globalAlpha = 1; dmgTxt = dmgTxt.filter(d => d.t > 0);
      // Zone
      const z = st.zone;
      ctx.save(); ctx.beginPath(); ctx.rect(-3000, -3000, WS + 6000, WS + 6000); ctx.arc(z.cx, z.cy, Math.max(1, z.r), 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(200,30,80,.28)'; ctx.fill('evenodd'); ctx.restore();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(z.cx, z.cy, Math.max(1, z.r), 0, 7); ctx.stroke();
      if (z.nr < z.r - 5) { ctx.setLineDash([24, 18]); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(z.cx, z.cy, Math.max(1, z.nr), 0, 7); ctx.stroke(); ctx.setLineDash([]); }
      // ---- Bildschirm-Overlays
      G.resetTransform();
      if (hitFlash > 0) { const g = ctx.createRadialGradient(G.W / 2, G.H / 2, Math.min(G.W, G.H) * 0.3, G.W / 2, G.H / 2, Math.max(G.W, G.H) * 0.7); g.addColorStop(0, 'rgba(255,0,40,0)'); g.addColorStop(1, `rgba(255,0,40,${hitFlash * 1.6})`); ctx.fillStyle = g; ctx.fillRect(0, 0, G.W, G.H); }
      // Pfeil zur Gegnerin
      const en = st.p[1 - G.you];
      if (en.alive) {
        const sx = (en.x - cam.x) * zoom + G.W / 2, sy = (en.y - cam.y) * zoom + G.H / 2;
        if (sx < 0 || sy < 0 || sx > G.W || sy > G.H) {
          const a = Math.atan2(en.y - cam.y, en.x - cam.x), R = Math.min(G.W, G.H) / 2 - 50;
          const ax = G.W / 2 + Math.cos(a) * R, ay = G.H / 2 + Math.sin(a) * R;
          ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.fillStyle = '#ff4fa3'; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.fill(); ctx.restore();
          ctx.font = '900 12px Nunito, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(Math.round(Math.hypot(en.x - cam.x, en.y - cam.y) / 10) + ' m', ax - Math.cos(a) * 28, ay - Math.sin(a) * 28);
        }
      }
      // Minikarte
      const ms = Math.min(120, Math.min(G.W, G.H) * 0.28), mx0 = 12, my0 = 64, k = ms / WS;
      ctx.fillStyle = 'rgba(10,20,10,.7)'; ctx.fillRect(mx0, my0, ms, ms); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(mx0, my0, ms, ms);
      ctx.save(); ctx.beginPath(); ctx.rect(mx0, my0, ms, ms); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,.25)'; map.rects.forEach(q => ctx.fillRect(mx0 + q.x * k, my0 + q.y * k, q.w * k, q.h * k));
      ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(mx0 + z.cx * k, my0 + z.cy * k, Math.max(0.5, z.r * k), 0, 7); ctx.stroke();
      st.p.forEach((p, i) => { if (!p.alive) return; const pp = i === G.you ? me : p; ctx.fillStyle = i === G.you ? '#7dff6b' : '#ff4fa3'; ctx.beginPath(); ctx.arc(mx0 + pp.x * k, my0 + pp.y * k, 4, 0, 7); ctx.fill(); });
      ctx.restore();
      // eigene Werte unten Mitte
      const mine = st.p[G.you], bw = Math.min(260, G.W * 0.4), bx = G.W / 2 - bw / 2, by = G.H - 46 - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; DA.rr(ctx, bx - 8, by - 30, bw + 16, 50, 12); ctx.fill();
      ctx.fillStyle = '#333'; ctx.fillRect(bx, by, bw, 10); ctx.fillStyle = mine.hp > 50 ? '#7dff6b' : mine.hp > 25 ? '#ffc21a' : '#ff4d5e'; ctx.fillRect(bx, by, bw * mine.hp / 100, 10);
      ctx.fillStyle = '#3de7ff'; ctx.fillRect(bx, by + 12, bw * mine.ar / 100, 4);
      ctx.font = '900 14px Nunito, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(WEAP[mine.w].ic + ' ' + WEAP[mine.w].n, bx, by - 13);
      ctx.textAlign = 'right'; ctx.fillText(Math.ceil(mine.hp) + ' HP', bx + bw, by - 13);
      // Zentrale Texte
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const out = mine.alive && Math.hypot(me.x - z.cx, me.y - z.cy) > z.r;
      if (out && st.ph === 'fight') big('⚠ AUSSERHALB DER ZONE', '#ff8fa8', 22, G.H * 0.25);
      if (st.ph === 'drop') big('🪂 ABSPRUNG! Runde ' + st.rd, '#fff', 30, G.H * 0.3);
      if (st.ph === 'roundEnd') big(st.lastWin === G.you ? 'Runde gewonnen! 🎉' : P[st.lastWin].name + ' holt die Runde', st.lastWin === G.you ? '#ffc21a' : '#ff8fa8', 30, G.H * 0.3);
    }
    function big(txt, col, size, y) { ctx.font = `${size}px "Lilita One", sans-serif`; ctx.lineWidth = 7; ctx.strokeStyle = '#1a1030'; ctx.strokeText(txt, G.W / 2, y); ctx.fillStyle = col; ctx.fillText(txt, G.W / 2, y); }
    function hud() {
      if (!st) return; const key = st.wins.join() + st.rd; if (key === lastHud) return; lastHud = key;
      G.hud(`<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div class="hud-score"><canvas width="60" height="60" data-av="${G.you}"></canvas><span class="num">${st.wins[G.you]}</span><span class="sep">:</span><span class="num">${st.wins[1 - G.you]}</span><canvas width="60" height="60" data-av="${1 - G.you}"></canvas></div><div class="hud-pill" style="padding:2px 10px;font-size:12px">Runde ${st.rd} · Best of 3</div></div>`);
      DA.paintHudAvatars(G);
    }
    G.emoteX = who => { const p = st && st.p[who]; if (!p || !G.view) return 0.5; return DA.clamp((G.view.ox + p.x * G.view.s) / G.W, 0.05, 0.9); };
    G.emoteY = who => { const p = st && st.p[who]; if (!p || !G.view) return 0.4; return DA.clamp((G.view.oy + (p.y - 120) * G.view.s) / G.H, 0.1, 0.8); };

    /* ---------- Hauptschleife ---------- */
    if (G.isHost) st = newRound(null);
    let acc = 0;
    G.loop(dt => {
      const local = readLocal();
      if (G.isHost) {
        inputs[0] = local;
        if (!G.online) inputs[1] = botInput(dt);
        acc += dt; while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60; }
        frame++;
        events.splice(0).forEach(e => { playEv(e); if (G.online) evBuf.push(e); });
        if (G.online && frame % 2 === 0) {
          G.rt.send({
            k: 's', rd: st.rd, ph: st.ph, pt: +st.pt.toFixed(2), wins: st.wins, lw: st.lastWin, tm: +st.time.toFixed(1),
            z: [Math.round(st.zone.cx), Math.round(st.zone.cy), Math.round(st.zone.r), Math.round(st.zone.nr)],
            p: st.p.map(p => [Math.round(p.x), Math.round(p.y), +p.a.toFixed(2), Math.ceil(p.hp), Math.ceil(p.ar), p.w, p.alive ? 1 : 0]),
            b: st.b.map(b => [Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy)]),
            lt: st.loot.map(L => L.id), ev: evBuf.splice(0),
          });
        }
      } else if (st) {
        sendT -= dt;
        if (sendT <= 0) { G.rt.send(Object.assign({ k: 'i' }, roundIn(local))); sendT = 1 / 30; }
        if (pred && st.p[G.you].alive && (st.ph === 'fight')) { const pp = { x: pred.x, y: pred.y, a: pred.a, w: st.p[G.you].w }; movePlayer(pp, local, dt); pred.x = pp.x; pred.y = pp.y; pred.a = pp.a; }
      }
      if (st) { render(G.t, dt); hud(); }
      else { G.resetTransform(); ctx.fillStyle = '#20361c'; ctx.fillRect(0, 0, G.W, G.H); }
    });
    function roundIn(o) { return { mx: +o.mx.toFixed(2), my: +o.my.toFixed(2), ax: +o.ax.toFixed(2), ay: +o.ay.toFixed(2), fire: o.fire }; }
  },
};
