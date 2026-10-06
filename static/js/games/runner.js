/* Gleis-Sprint – Endless-Runner: eine rennt, die andere ist die Wächterin, die verfolgt */
'use strict';
DA.games.runner = {
  start(G) {
    const LW = 400, LH = 820, HOR = 280, F = 330, CAMH = 3.3, CAMZ = -3, LANE = 1.1;
    const ctx = G.ctx, me = G.me, pa = G.partner || { char: DA.otherChar(me.char), outfit: {}, name: 'Sie' };
    const chars = [{ char: me.char, outfit: me.outfit, name: me.name }, { char: pa.char === me.char ? DA.otherChar(me.char) : pa.char, outfit: pa.outfit || {}, name: pa.name }];
    let runnerIdx = 0, runner, guard, objs, nextZ, pl, speed, dist, coins, score, phase = 'pick', stumbleT, chaseIntro, mult, multT, magT, travelled, deathT, trail, sparks, popups;
    const city = []; for (let i = 0; i < 26; i++) city.push({ x: i * 20 - 40 + Math.random() * 10, w: 16 + Math.random() * 26, h: 40 + Math.random() * 110, c: Math.random() });

    function reset() {
      runner = chars[runnerIdx]; guard = chars[1 - runnerIdx];
      objs = []; nextZ = 38; pl = { lane: 0, x: 0, y: 0, vy: 0, slide: 0, prevLane: 0, run: 0 };
      speed = 10; dist = 0; coins = 0; score = 0; stumbleT = 0; chaseIntro = 2.6; mult = 1; multT = 0; magT = 0; travelled = 0; deathT = 0;
      trail = new DA.Trail((me.outfit && me.outfit.trail) || 'none'); sparks = []; popups = [];
      if (runner.char !== me.char) trail.kind = 'none';
      while (nextZ < 110) spawnRow();
    }

    /* ---------- Hindernisse erzeugen ---------- */
    function spawnRow() {
      const z = nextZ, lanes = [-1, 0, 1], difficulty = Math.min(1, dist / 2500);
      const kinds = lanes.map(() => { const r = Math.random(); return r < 0.3 + difficulty * 0.15 ? 'train' : r < 0.5 + difficulty * 0.1 ? 'barrier' : r < 0.62 + difficulty * 0.1 ? 'high' : r < 0.85 ? 'coins' : 'empty'; });
      if (kinds.every(k => k === 'train')) kinds[Math.floor(Math.random() * 3)] = 'coins';
      if (kinds.filter(k => k === 'train').length === 2 && Math.random() < 0.5) kinds[kinds.indexOf('train')] = 'barrier';
      let maxLen = 1;
      kinds.forEach((k, i) => {
        const x = lanes[i] * LANE;
        if (k === 'train') { const len = 7 + Math.random() * 9; objs.push({ t: 'train', x, lane: lanes[i], z0: z, z1: z + len, col: ['#ff4fa3', '#3de7ff', '#ffc21a', '#7c5cff', '#41dcae'][Math.floor(Math.random() * 5)], mv: difficulty > 0.3 && Math.random() < 0.25 ? 4 : 0 }); maxLen = Math.max(maxLen, len); }
        else if (k === 'barrier') { objs.push({ t: 'barrier', x, lane: lanes[i], z0: z, z1: z + 0.3 }); for (let j = -2; j <= 2; j++) objs.push({ t: 'coin', x, lane: lanes[i], z0: z + j * 1.3, y: 0.6 + (2 - Math.abs(j)) * 0.45 }); }
        else if (k === 'high') objs.push({ t: 'high', x, lane: lanes[i], z0: z, z1: z + 0.3 });
        else if (k === 'coins') { const n = 5 + Math.floor(Math.random() * 4); for (let j = 0; j < n; j++) objs.push({ t: 'coin', x, lane: lanes[i], z0: z + j * 1.4, y: 0.55 }); }
      });
      if (Math.random() < 0.06) objs.push({ t: Math.random() < 0.5 ? 'magnet' : 'star', x: lanes[Math.floor(Math.random() * 3)] * LANE, lane: 0, z0: z + 4, y: 0.8 });
      nextZ += Math.max(12, maxLen * 0.6 + 9 + Math.random() * 6 - difficulty * 3);
    }

    /* ---------- Eingabe ---------- */
    function act(a) {
      if (phase !== 'run') return;
      if (a === 'left' && pl.lane > -1) { pl.prevLane = pl.lane; pl.lane--; DA.sfx.play('slide'); }
      if (a === 'right' && pl.lane < 1) { pl.prevLane = pl.lane; pl.lane++; DA.sfx.play('slide'); }
      if (a === 'up' && pl.y <= 0.001) { pl.vy = 9.2; pl.slide = 0; DA.sfx.play('jump'); }
      if (a === 'down') { pl.slide = 0.75; if (pl.y > 0) pl.vy = -14; DA.sfx.play('slide'); }
    }
    let sx = 0, sy = 0, sw = false;
    G.on(G.canvas, 'pointerdown', e => { sx = e.clientX; sy = e.clientY; sw = true; });
    G.on(G.canvas, 'pointermove', e => {
      if (!sw) return; const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.hypot(dx, dy) > 26) { act(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); sw = false; }
    });
    G.on(G.canvas, 'pointerup', () => { sw = false; });
    G.onKey = (k, d) => { if (!d) return; const m = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', ' ': 'up', arrowdown: 'down', s: 'down' }[k]; if (m) act(m); };

    /* ---------- Projektion ---------- */
    function proj(x, y, z) { const d = Math.max(0.35, z - CAMZ), s = F / d; return { x: LW / 2 + x * s, y: HOR + (CAMH - y) * s, s }; }

    /* ---------- Update ---------- */
    function crash(kind) {
      if (phase !== 'run') return;
      phase = 'caught'; deathT = 0; DA.sfx.play('hit'); DA.vibrate([120, 60, 200]);
      setTimeout(() => DA.sfx.play('lose'), 500);
    }
    function stumble() {
      DA.sfx.play('hit'); DA.vibrate(80);
      if (stumbleT > 0) { crash('stumble'); return; }
      stumbleT = 7;
    }
    function update(dt) {
      if (phase === 'run') {
        speed = Math.min(27, speed + dt * 0.16);
        const dz = speed * dt; dist += dz; travelled += dz;
        score += dz * mult;
        if (chaseIntro > 0) chaseIntro -= dt;
        if (stumbleT > 0) stumbleT -= dt;
        if (multT > 0) { multT -= dt; if (multT <= 0) mult = 1; }
        if (magT > 0) magT -= dt;
        // Spieler
        const tx = pl.lane * LANE, oldX = pl.x;
        pl.x = DA.lerp(pl.x, tx, Math.min(1, dt * 14));
        pl.vy -= 30 * dt; pl.y = Math.max(0, pl.y + pl.vy * dt); if (pl.y === 0) pl.vy = 0;
        if (pl.slide > 0) pl.slide -= dt;
        pl.run += dt * (6 + speed * 0.4);
        // Objekte
        for (const o of objs) {
          const m = dz + (o.mv || 0) * dt; o.z0 -= m; if (o.z1 != null) o.z1 -= m;
          if (o.t === 'coin' || o.t === 'magnet' || o.t === 'star') {
            if (o.got) continue;
            if (magT > 0 && o.t === 'coin' && o.z0 < 14 && o.z0 > -1) { o.x = DA.lerp(o.x, pl.x, dt * 8); o.y = DA.lerp(o.y, pl.y + 0.6, dt * 8); o.z0 -= o.z0 * dt * 6; }
            if (Math.abs(o.z0) < 0.6 && Math.abs(o.x - pl.x) < 0.6 && Math.abs((o.y || 0.5) - (pl.y + 0.6)) < 0.9) {
              o.got = true;
              if (o.t === 'coin') { coins++; score += 10 * mult; DA.sfx.play('coin'); }
              else if (o.t === 'magnet') { magT = 10; DA.sfx.play('power'); popups.push({ text: '🧲 Magnet!', t: 1.5 }); }
              else { mult = 2; multT = 12; DA.sfx.play('power'); popups.push({ text: '⭐ Doppelte Punkte!', t: 1.5 }); }
            }
            continue;
          }
          const z1 = o.z1 != null ? o.z1 : o.z0 + 0.3;
          const overlapZ = o.z0 < 0.35 && z1 > -0.35;
          if (!overlapZ) continue;
          const dx = Math.abs(o.x - pl.x);
          if (o.t === 'train') {
            if (o.side) continue;
            if (dx < 0.55) {
              if (o.z0 > -0.2 && pl.y < 1.7) crash('train');
              else if (pl.y < 1.7) { pl.lane = pl.prevLane; o.side = true; stumble(); }
            } else if (dx < 0.95 && Math.abs(tx - o.x) < 0.1 && Math.abs(oldX - pl.x) > 0.001) { pl.lane = pl.prevLane; o.side = true; stumble(); }
          } else if (o.t === 'barrier' && dx < 0.55 && pl.y < 0.55 && !o.hit) { o.hit = true; crash('barrier'); }
          else if (o.t === 'high' && dx < 0.55 && pl.slide <= 0 && !o.hit) { o.hit = true; crash('high'); }
        }
        objs = objs.filter(o => (o.z1 != null ? o.z1 : o.z0) > -4 && !(o.got && o.z0 < -1));
        nextZ -= dz; while (nextZ < 110) spawnRow();
        // Spur
        const p = proj(pl.x, pl.y + 0.2, 0);
        if (Math.random() < 0.8) trail.emit(p.x + DA.rand(-10, 10), p.y - 10, 1.2);
      } else if (phase === 'caught') {
        deathT += dt;
        if (deathT > 2.2 && phase === 'caught') { phase = 'over'; gameOver(); }
      }
      trail.update(dt, 0, 220);
    }

    function gameOver() {
      const sc = Math.floor(score);
      if (runner.char === me.char || true) G.submitScore(sc, coins);
      G.panel({
        top: '<div style="font-size:52px">🚨</div>',
        title: DA.esc(guard.name || 'Sie') + ' hat dich erwischt!',
        html: `<div class="big-num">${sc.toLocaleString('de-DE')}</div><p>${Math.floor(dist)} m · ${coins} Münzen</p><p id="rnRec">speichere…</p>`,
        buttons: [{ label: '🔁 Nochmal', cls: 'primary', onClick: () => { G.panel(null); reset(); phase = 'run'; } },
          { label: '🔄 Rollen tauschen', onClick: pick }, { label: 'Zurück zur Arena', onClick: () => G.exit() }],
      });
    }
    G.onNet('score_saved', m => {
      if (m.game !== 'runner') return; const el = document.getElementById('rnRec');
      if (el) el.innerHTML = (m.record ? '🏆 <b style="color:#ffc21a">NEUER REKORD!</b>' : 'Rekord: ' + m.best.toLocaleString('de-DE')) + ` · +${m.coins} 🪙`;
      if (m.record) DA.sfx.play('win');
    });

    /* ---------- Zeichnen ---------- */
    function drawWorld(t) {
      const sky = ctx.createLinearGradient(0, 0, 0, HOR + 20); sky.addColorStop(0, '#2a1a6e'); sky.addColorStop(0.55, '#ff4fa3'); sky.addColorStop(1, '#ffb36b');
      ctx.fillStyle = sky; ctx.fillRect(-400, -400, LW + 800, HOR + 420);
      ctx.fillStyle = 'rgba(255,240,200,.85)'; ctx.beginPath(); ctx.arc(LW / 2 + 90, HOR - 40, 34, 0, 7); ctx.fill();
      // Skyline
      const off = (travelled * 0.6) % 520;
      city.forEach(b => {
        let x = ((b.x * 1 - off) % 520 + 520) % 520 - 50;
        ctx.fillStyle = b.c > 0.5 ? '#3b1f6e' : '#2c1757'; ctx.fillRect(x, HOR - b.h, b.w, b.h + 2);
        ctx.fillStyle = 'rgba(255,220,120,.6)';
        for (let wy = HOR - b.h + 8; wy < HOR - 6; wy += 12) for (let wx = x + 4; wx < x + b.w - 4; wx += 8) if ((wx * 7 + wy * 3) % 5 < 2) ctx.fillRect(wx, wy, 3, 5);
      });
      // Boden
      const g = ctx.createLinearGradient(0, HOR, 0, LH); g.addColorStop(0, '#5a4670'); g.addColorStop(1, '#2e2340');
      ctx.fillStyle = g; ctx.fillRect(-400, HOR, LW + 800, LH);
      // Gleisbett
      const fz = 120, a = proj(-1.75 * LANE, 0, 0), b = proj(1.75 * LANE, 0, 0), c = proj(1.75 * LANE, 0, fz), d = proj(-1.75 * LANE, 0, fz);
      const a2 = proj(-1.75 * LANE, 0, -2.6), b2 = proj(1.75 * LANE, 0, -2.6);
      ctx.fillStyle = '#6f5a7e'; ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
      // Schwellen
      const step = 1.4, o0 = travelled % step;
      for (let z = -2.5 - o0 + step; z < 70; z += step) {
        [-1, 0, 1].forEach(l => {
          const p1 = proj(l * LANE - 0.5, 0, z), p2 = proj(l * LANE + 0.5, 0, z), p3 = proj(l * LANE + 0.5, 0, z + 0.35), p4 = proj(l * LANE - 0.5, 0, z + 0.35);
          ctx.fillStyle = '#4a3a3a'; ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.fill();
        });
      }
      // Schienen
      ctx.strokeStyle = '#d9cfe6'; ctx.lineWidth = 2;
      [-1, 0, 1].forEach(l => [-0.32, 0.32].forEach(r => { const p1 = proj(l * LANE + r, 0, -2.6), p2 = proj(l * LANE + r, 0, fz); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }));
      // Nebel am Horizont
      const fog = ctx.createLinearGradient(0, HOR, 0, HOR + 60); fog.addColorStop(0, 'rgba(255,170,140,.9)'); fog.addColorStop(1, 'rgba(255,170,140,0)');
      ctx.fillStyle = fog; ctx.fillRect(-400, HOR, LW + 800, 60);
    }
    function poly(pts, fill, stroke) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); } }
    function drawObj(o, t) {
      if (o.got) return;
      const z0 = Math.max(o.z0, CAMZ + 0.5);
      if (o.t === 'train') {
        const z1 = o.z1; if (z1 < CAMZ + 0.6) return;
        const w = 0.48, h = 1.75, x = o.x;
        const f = [proj(x - w, 0, z0), proj(x + w, 0, z0), proj(x + w, h, z0), proj(x - w, h, z0)];
        const bk = [proj(x - w, 0, z1), proj(x + w, 0, z1), proj(x + w, h, z1), proj(x - w, h, z1)];
        // Seite
        if (x > 0.01) poly([f[0], bk[0], bk[3], f[3]], DA.shade(o.col, -60), '#1a1030');
        if (x < -0.01) poly([f[1], bk[1], bk[2], f[2]], DA.shade(o.col, -60), '#1a1030');
        poly([f[3], f[2], bk[2], bk[3]], DA.shade(o.col, 30), '#1a1030');
        poly(f, o.col, '#1a1030');
        // Front-Details
        const fw = f[1].x - f[0].x, fh = f[0].y - f[3].y;
        ctx.fillStyle = '#1b2440'; DA.rr(ctx, f[0].x + fw * 0.12, f[3].y + fh * 0.12, fw * 0.76, fh * 0.32, fw * 0.08); ctx.fill();
        ctx.fillStyle = '#fff6b0'; [0.22, 0.78].forEach(k => { ctx.beginPath(); ctx.arc(f[0].x + fw * k, f[3].y + fh * 0.72, fw * 0.07, 0, 7); ctx.fill(); });
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `900 ${Math.max(6, fw * 0.13)}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('DUO', f[0].x + fw / 2, f[3].y + fh * 0.58);
      } else if (o.t === 'barrier') {
        const x = o.x, w = 0.5;
        [-0.42, 0.42].forEach(k => { const p1 = proj(x + k, 0, z0), p2 = proj(x + k, 0.6, z0); ctx.strokeStyle = '#ddd'; ctx.lineWidth = Math.max(1, p1.s * 0.06); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); });
        const a = proj(x - w, 0.6, z0), b = proj(x + w, 0.3, z0);
        stripes(a.x, a.y, b.x - a.x, b.y - a.y, '#ff3b5c');
      } else if (o.t === 'high') {
        const x = o.x, w = 0.52;
        [-0.48, 0.48].forEach(k => { const p1 = proj(x + k, 0, z0), p2 = proj(x + k, 1.6, z0); ctx.strokeStyle = '#ffc21a'; ctx.lineWidth = Math.max(1, p1.s * 0.07); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); });
        const a = proj(x - w, 1.6, z0), b = proj(x + w, 1.05, z0);
        stripes(a.x, a.y, b.x - a.x, b.y - a.y, '#7c5cff');
        if (a.s > 40) { ctx.font = `${a.s * 0.25}px serif`; ctx.textAlign = 'center'; ctx.fillText('⬇', (a.x + b.x) / 2, b.y + a.s * 0.3); }
      } else {
        const p = proj(o.x, o.y || 0.5, z0), r = p.s * 0.2;
        if (r < 0.8) return;
        if (o.t === 'coin') {
          const sq = Math.abs(Math.cos(t * 5 + o.z0));
          ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#b07a00'; ctx.lineWidth = Math.max(1, r * 0.2);
          ctx.beginPath(); ctx.ellipse(p.x, p.y, r * Math.max(0.2, sq), r, 0, 0, 7); ctx.fill(); ctx.stroke();
        } else { ctx.font = `${r * 2.4}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.t === 'magnet' ? '🧲' : '⭐', p.x, p.y); }
      }
    }
    function stripes(x, y, w, h, col) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h); ctx.fillStyle = col;
      const st = Math.max(4, w / 6);
      for (let i = -2; i < 10; i++) { ctx.beginPath(); ctx.moveTo(x + i * st * 2, y + h); ctx.lineTo(x + i * st * 2 + st, y + h); ctx.lineTo(x + i * st * 2 + st * 2, y); ctx.lineTo(x + i * st * 2 + st, y); ctx.fill(); }
      ctx.restore(); ctx.strokeStyle = '#1a1030'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
    }
    function drawRunner(t) {
      const p = proj(pl.x, pl.y, 0), size = p.s * 1.2, sliding = pl.slide > 0;
      ctx.fillStyle = 'rgba(0,0,0,.3)'; const sh = proj(pl.x, 0, 0); ctx.beginPath(); ctx.ellipse(sh.x, sh.y, size * 0.25, size * 0.06, 0, 0, 7); ctx.fill();
      if (phase === 'caught' && deathT > 0.4) return;
      ctx.save();
      if (sliding) { ctx.translate(p.x, p.y); ctx.scale(1.15, 0.6); ctx.translate(-p.x, -p.y); }
      DA.drawChar(ctx, runner.char, runner.outfit, p.x, p.y, size, { run: pl.y > 0 ? 0.6 : pl.run, facing: 1, t, bob: pl.y > 0 ? 0 : Math.abs(Math.sin(pl.run)) * -4, armUp: pl.y > 0 ? 0.8 : 0 });
      ctx.restore();
    }
    function drawGuard(t) {
      let z = null;
      if (phase === 'caught') z = DA.lerp(-2.2, -0.6, Math.min(1, deathT * 2));
      else if (chaseIntro > 0) z = -1.4 - (1 - chaseIntro / 2.6) * 2;
      else if (stumbleT > 0) z = -1.5 - (1 - stumbleT / 7) * 1.4;
      if (z == null || z < CAMZ + 0.6) return;
      const p = proj(phase === 'caught' ? pl.x : pl.x * 0.7, 0, z), size = p.s * 1.2;
      DA.drawChar(ctx, guard.char, guard.outfit, p.x - (phase === 'caught' ? size * 0.2 : 0), p.y, size, { run: G.t * 14, facing: 1, t, angry: true, armUp: 1.2 });
      ctx.font = `${size * 0.22}px serif`; ctx.textAlign = 'center'; ctx.fillText(Math.floor(t * 4) % 2 ? '🚨' : '📣', p.x + size * 0.28, p.y - size * 1.0);
    }
    function render(t) {
      G.fit(LW, LH, 'cover');
      drawWorld(t);
      const sorted = objs.slice().sort((a, b) => b.z0 - a.z0);
      sorted.filter(o => o.z0 > 0.05 || (o.z1 != null && o.z1 > 0.05 && o.z0 > -0.4)).forEach(o => drawObj(o, t));
      trail.draw(ctx);
      drawRunner(t);
      sorted.filter(o => !(o.z0 > 0.05 || (o.z1 != null && o.z1 > 0.05 && o.z0 > -0.4))).forEach(o => drawObj(o, t));
      drawGuard(t);
      // HUD im Canvas
      const v = G.view, topY = (-v.oy) / v.s + 70;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.font = '30px "Lilita One", sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#1a1030';
      const sc = Math.floor(score).toLocaleString('de-DE');
      const rx = LW + (v.ox / v.s) - 18 - (G.W > 0 ? 0 : 0);
      const right = Math.min(LW, (G.W - v.ox) / v.s) - 16;
      ctx.strokeText(sc, right, topY); ctx.fillStyle = '#fff'; ctx.fillText(sc, right, topY);
      ctx.font = '20px "Lilita One", sans-serif'; const cs = '🪙 ' + coins; ctx.strokeText(cs, right, topY + 32); ctx.fillStyle = '#ffd23f'; ctx.fillText(cs, right, topY + 32);
      if (mult > 1) { ctx.fillStyle = '#3de7ff'; ctx.strokeText('x2 ⭐', right, topY + 60); ctx.fillText('x2 ⭐', right, topY + 60); }
      if (magT > 0) { ctx.fillStyle = '#ff8fd0'; ctx.strokeText('🧲 ' + Math.ceil(magT), right, topY + 86); ctx.fillText('🧲 ' + Math.ceil(magT), right, topY + 86); }
      ctx.textAlign = 'center';
      popups.forEach(p => { p.t -= 1 / 60; ctx.globalAlpha = Math.min(1, p.t); ctx.font = '28px "Lilita One", sans-serif'; ctx.strokeText(p.text, LW / 2, 330 - (1.5 - p.t) * 30); ctx.fillStyle = '#fff'; ctx.fillText(p.text, LW / 2, 330 - (1.5 - p.t) * 30); });
      ctx.globalAlpha = 1; popups = popups.filter(p => p.t > 0);
      if (stumbleT > 4.5 && phase === 'run') { ctx.font = '26px "Lilita One", sans-serif'; ctx.fillStyle = '#ff8fa8'; ctx.strokeText('Vorsicht! Sie ist dicht hinter dir!', LW / 2, 380); ctx.fillText('Vorsicht! Sie ist dicht hinter dir!', LW / 2, 380); }
      if (phase === 'caught') { ctx.font = '54px "Lilita One", sans-serif'; ctx.lineWidth = 10; ctx.strokeText('ERWISCHT!', LW / 2, 330); ctx.fillStyle = '#ffc21a'; ctx.fillText('ERWISCHT!', LW / 2, 330); }
      if (phase === 'run' && dist < 40) { ctx.font = '900 16px Nunito, sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeText('Wischen: ← → Spur · ↑ Sprung · ↓ Rutschen', LW / 2, 200); ctx.fillText('Wischen: ← → Spur · ↑ Sprung · ↓ Rutschen', LW / 2, 200); }
    }

    /* ---------- Charakterwahl ---------- */
    function pick() {
      phase = 'pick';
      G.panel({
        title: 'Wer rennt?', text: 'Die andere wird zur Wächterin und jagt dich über die Gleise!',
        html: `<div class="pick">${chars.map((c, i) => `<button data-i="${i}" class="${i === runnerIdx ? 'sel' : ''}"><canvas width="172" height="172"></canvas>${DA.esc(c.name || 'Sie')}<div style="font-size:11px;color:#b9acdf">${i === runnerIdx ? 'rennt 🏃' : 'jagt 🚨'}</div></button>`).join('')}</div>`,
        buttons: [{ label: '▶ Los rennen!', cls: 'primary', onClick: () => { G.panel(null); reset(); phase = 'run'; DA.sfx.play('go'); } }],
        onMount: el => {
          el.querySelectorAll('.pick button').forEach(b => {
            const i = +b.dataset.i; DA.drawAvatar(b.querySelector('canvas'), chars[i].char, chars[i].outfit);
            b.onclick = () => { runnerIdx = i; DA.sfx.play('pop'); pick(); };
          });
        },
      });
    }
    reset(); pick();
    G.hud('');
    G.loop(dt => { update(dt); render(G.t); });
  },
};
