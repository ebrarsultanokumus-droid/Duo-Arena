/* Air-Hockey – live 1 gegen 1, jeder sieht seine Seite unten */
'use strict';
DA.games.airhockey = {
  start(G) {
    const LW = 450, LH = 800, PR = 20, MR = 40, GOAL = 160, WIN = 7;
    const ctx = G.ctx, P = G.players, flip = !G.isHost;
    let st = fresh(), view = JSON.parse(JSON.stringify(st)), events = [], evBuf = [], frame = 0, lastHud = '', sparks = [];
    const target = [{ x: LW / 2, y: LH - 110 }, { x: LW / 2, y: 110 }];
    let myTarget = { x: LW / 2, y: LH - 110 }, sendT = 0, trail = [];

    function fresh() { return { m: [{ x: LW / 2, y: LH - 110, vx: 0, vy: 0 }, { x: LW / 2, y: 110, vx: 0, vy: 0 }], p: { x: LW / 2, y: LH / 2, vx: 0, vy: 0 }, sc: [0, 0], ph: 'count', pt: 2.5, last: -1 }; }

    /* ---------- Eingabe ---------- */
    function pointer(e) {
      const l = G.toLogical(e.clientX, e.clientY);
      // eigene Hälfte ist immer unten auf dem eigenen Bildschirm
      myTarget = { x: l.x - 15, y: l.y - 15 - (e.pointerType === 'mouse' ? 0 : 40) };
    }
    G.on(G.canvas, 'pointerdown', e => { G.canvas.setPointerCapture(e.pointerId); pointer(e); });
    G.on(G.canvas, 'pointermove', e => { if (e.buttons || e.pointerType === 'touch') pointer(e); });
    function worldTarget() {
      const k = G.keys, sp = 9;
      if (k.arrowleft || k.a) myTarget.x -= sp; if (k.arrowright || k.d) myTarget.x += sp;
      if (k.arrowup || k.w) myTarget.y -= sp; if (k.arrowdown || k.s) myTarget.y += sp;
      myTarget.x = DA.clamp(myTarget.x, MR, LW - MR); myTarget.y = DA.clamp(myTarget.y, LH / 2 + MR, LH - MR);
      return flip ? { x: LW - myTarget.x, y: LH - myTarget.y } : { x: myTarget.x, y: myTarget.y };
    }

    G.rt.on(d => {
      if (G.isHost) { if (d.k === 'i') { target[1] = { x: d.x, y: d.y }; } if (d.k === 'rematch') restart(); }
      else if (d.k === 's') apply(d);
    });
    function restart() { st = fresh(); G.panel(null); if (G.online) G.rt.send({ k: 'restart' }); }
    function apply(d) {
      const wasEnd = st.ph === 'end';
      st.m = d.m.map(a => ({ x: a[0], y: a[1] })); st.p = { x: d.p[0], y: d.p[1], vx: d.p[2], vy: d.p[3] };
      st.sc = d.sc; st.ph = d.ph; st.pt = d.pt; st.last = d.last;
      (d.ev || []).forEach(playEv);
      if (st.ph === 'end' && !wasEnd) showEnd();
      if (st.ph !== 'end' && wasEnd) G.panel(null);
    }

    /* ---------- Physik ---------- */
    function step(dt) {
      const s = st;
      if (s.ph === 'count') { s.pt -= dt; if (s.pt <= 0) { s.ph = 'play'; events.push('go'); } }
      if (s.ph === 'goal') { s.pt -= dt; if (s.pt <= 0) { s.ph = 'count'; s.pt = 1.2; s.p = { x: LW / 2, y: s.last === 0 ? LH / 2 - 120 : LH / 2 + 120, vx: 0, vy: 0 }; } }
      s.m.forEach((m, i) => {
        const t = target[i], lo = i === 0 ? LH / 2 + MR : MR, hi = i === 0 ? LH - MR : LH / 2 - MR;
        const tx = DA.clamp(t.x, MR, LW - MR), ty = DA.clamp(t.y, lo, hi);
        let dx = tx - m.x, dy = ty - m.y; const d = Math.hypot(dx, dy), max = 2600 * dt;
        if (d > max) { dx *= max / d; dy *= max / d; }
        m.vx = dx / dt; m.vy = dy / dt; m.x += dx; m.y += dy;
      });
      if (s.ph === 'end') return;
      const p = s.p, sub = 4;
      for (let k = 0; k < sub; k++) {
        const h = dt / sub;
        p.x += p.vx * h; p.y += p.vy * h;
        if (p.x < PR) { p.x = PR; p.vx = Math.abs(p.vx) * 0.9; events.push('wall'); }
        if (p.x > LW - PR) { p.x = LW - PR; p.vx = -Math.abs(p.vx) * 0.9; events.push('wall'); }
        const inGoal = Math.abs(p.x - LW / 2) < GOAL / 2 - PR * 0.3;
        if (!inGoal || s.ph !== 'play') {
          if (p.y < PR) { p.y = PR; p.vy = Math.abs(p.vy) * 0.9; events.push('wall'); }
          if (p.y > LH - PR) { p.y = LH - PR; p.vy = -Math.abs(p.vy) * 0.9; events.push('wall'); }
        }
        s.m.forEach(m => {
          const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy), min = PR + MR;
          if (d < min && d > 0) {
            const nx = dx / d, ny = dy / d; p.x = m.x + nx * min; p.y = m.y + ny * min;
            const rv = (p.vx - m.vx) * nx + (p.vy - m.vy) * ny;
            if (rv < 0) { p.vx -= 1.9 * rv * nx; p.vy -= 1.9 * rv * ny; events.push('hit'); }
          }
        });
        const sp = Math.hypot(p.vx, p.vy); if (sp > 1700) { p.vx *= 1700 / sp; p.vy *= 1700 / sp; }
      }
      p.vx *= Math.pow(0.82, dt); p.vy *= Math.pow(0.82, dt);
      if (s.ph === 'play') {
        let sc = -1;
        if (p.y < -PR) sc = 0; if (p.y > LH + PR) sc = 1;
        if (sc >= 0) {
          s.sc[sc]++; s.last = sc; events.push('goal' + sc);
          if (s.sc[sc] >= WIN) { s.ph = 'end'; G.rt.result(sc, s.sc[0] + ':' + s.sc[1]); showEnd(); }
          else { s.ph = 'goal'; s.pt = 1.4; }
          p.vx = p.vy = 0; p.y = sc === 0 ? -200 : LH + 200;
        }
      }
    }
    function cpu() {
      const m = st.m[1], p = st.p;
      if (p.y > LH / 2 || p.vy > 300) return { x: LW / 2 + (p.x - LW / 2) * 0.5, y: 80 };
      if (p.y < m.y) return { x: p.x + (p.x < LW / 2 ? 30 : -30), y: p.y - 60 };
      return { x: p.x + (Math.random() - .5) * 20, y: p.y - 25 };
    }

    function playEv(e) {
      if (e === 'hit') { DA.sfx.play('puck'); DA.vibrate(10); }
      else if (e === 'wall') DA.sfx.play('bounce');
      else if (e === 'go') DA.sfx.play('go');
      else if (e.startsWith('goal')) {
        const w = +e[4]; DA.sfx.play(w === G.you ? 'goal' : 'lose'); DA.vibrate([60, 40, 60]);
        const gy = w === 0 ? 0 : LH;
        for (let i = 0; i < 70; i++) sparks.push({ x: LW / 2 + DA.rand(-60, 60), y: gy, vx: DA.rand(-300, 300), vy: (w === 0 ? 1 : -1) * DA.rand(100, 600), l: 1.2, c: ['#ff4fa3', '#ffc21a', '#3de7ff', '#fff'][i % 4] });
      }
    }
    function showEnd() {
      const w = st.sc[0] >= WIN ? 0 : 1, me = G.you;
      DA.sfx.play(w === me ? 'win' : 'lose');
      G.panel({
        title: w === me ? 'Du gewinnst! 🏆' : P[w].name + ' gewinnt!', html: `<div class="big-num">${st.sc[me]} : ${st.sc[1 - me]}</div><p>${G.online ? (w === me ? '+40 🪙' : '+12 🪙') : 'Training gegen den Computer'}</p>`,
        buttons: [{ label: '🔁 Revanche', cls: 'primary', onClick: () => { if (G.isHost) restart(); else { G.rt.send({ k: 'rematch' }); G.panel({ title: 'Revanche angefragt…', html: '<div class="spinner"></div>' }); } } },
          { label: 'Zurück zur Arena', onClick: () => G.exit() }],
      });
    }

    /* ---------- Zeichnen ---------- */
    function render(t) {
      const v = G.fit(LW + 30, LH + 30, 'contain'); ctx.translate(15, 15);
      ctx.fillStyle = '#05030d'; ctx.save(); G.resetTransform(); ctx.fillRect(0, 0, G.W, G.H); ctx.restore();
      if (flip) { ctx.translate(LW, LH); ctx.rotate(Math.PI); }
      // Tisch
      ctx.fillStyle = '#e8edff'; DA.rr(ctx, -12, -12, LW + 24, LH + 24, 34); ctx.fill();
      const g = ctx.createLinearGradient(0, 0, 0, LH); g.addColorStop(0, '#0ad4ff'); g.addColorStop(0.5, '#4f8bff'); g.addColorStop(1, '#0ad4ff');
      ctx.fillStyle = g; DA.rr(ctx, 0, 0, LW, LH, 26); ctx.fill();
      ctx.save(); DA.rr(ctx, 0, 0, LW, LH, 26); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,.12)'; for (let y = 20; y < LH; y += 26) for (let x = 20 + (y / 26 % 2) * 13; x < LW; x += 26) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill(); }
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(0, LH / 2); ctx.lineTo(LW, LH / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(LW / 2, LH / 2, 70, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,79,163,.85)';
      ctx.beginPath(); ctx.arc(LW / 2, 0, 110, 0, Math.PI); ctx.stroke();
      ctx.strokeStyle = 'rgba(124,92,255,.85)';
      ctx.beginPath(); ctx.arc(LW / 2, LH, 110, Math.PI, 0); ctx.stroke();
      if (DA.img.logo) { ctx.globalAlpha = .25; ctx.drawImage(DA.img.logo, LW / 2 - 45, LH / 2 - 45, 90, 90); ctx.globalAlpha = 1; }
      ctx.restore();
      // Tore
      [[0, '#ff4fa3'], [LH, '#7c5cff']].forEach(([y, c]) => { ctx.fillStyle = '#120a24'; ctx.fillRect(LW / 2 - GOAL / 2, y - 12, GOAL, 24); ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 20; ctx.fillRect(LW / 2 - GOAL / 2, y + (y ? -14 : 10), GOAL, 4); ctx.shadowBlur = 0; });
      const s = G.isHost ? st : view;
      // Puck-Spur
      trail.push({ x: s.p.x, y: s.p.y }); if (trail.length > 10) trail.shift();
      trail.forEach((q, i) => { ctx.fillStyle = `rgba(255,255,255,${i / 30})`; ctx.beginPath(); ctx.arc(q.x, q.y, PR * (i / 10), 0, 7); ctx.fill(); });
      // Puck
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(s.p.x + 4, s.p.y + 5, PR, 0, 7); ctx.fill();
      ctx.fillStyle = '#16102a'; ctx.beginPath(); ctx.arc(s.p.x, s.p.y, PR, 0, 7); ctx.fill();
      ctx.strokeStyle = '#ff4fa3'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(s.p.x, s.p.y, PR - 5, 0, 7); ctx.stroke();
      // Schläger mit Köpfen
      s.m.forEach((m, i) => {
        const pl = P[i], col = i === 0 ? '#7c5cff' : '#ff4fa3';
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(m.x + 5, m.y + 7, MR, 0, 7); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(m.x, m.y, MR, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(m.x, m.y, MR - 6, 0, 7); ctx.fill();
        ctx.save(); ctx.translate(m.x, m.y); if (flip) ctx.rotate(Math.PI);
        ctx.beginPath(); ctx.arc(0, 0, MR - 7, 0, 7); ctx.clip();
        DA.drawHead(ctx, pl.char, 0, 4, MR * 1.02, pl.outfit, { shadow: false, t });
        ctx.restore();
      });
      sparks.forEach(q => { q.x += q.vx / 60; q.y += q.vy / 60; q.vx *= .96; q.vy *= .96; q.l -= 1 / 60; ctx.globalAlpha = Math.max(0, q.l); ctx.fillStyle = q.c; ctx.fillRect(q.x - 3, q.y - 3, 6, 6); });
      ctx.globalAlpha = 1; sparks = sparks.filter(q => q.l > 0);
      // Text (immer aufrecht)
      ctx.setTransform(v.s * G.dpr, 0, 0, v.s * G.dpr, v.ox * G.dpr, v.oy * G.dpr); ctx.translate(15, 15);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (st.ph === 'count') big(st.pt > 1.2 ? 'BEREIT?' : 'LOS!', '#fff');
      if (st.ph === 'goal') big(st.last === G.you ? 'TOR! 🎉' : 'Autsch!', st.last === G.you ? '#ffc21a' : '#ff8fa8');
    }
    function big(txt, col) { ctx.font = '64px "Lilita One", sans-serif'; ctx.lineWidth = 10; ctx.strokeStyle = '#1a1030'; ctx.strokeText(txt, LW / 2, LH / 2 - 120); ctx.fillStyle = col; ctx.fillText(txt, LW / 2, LH / 2 - 120); }
    function hud() {
      const me = G.you, key = st.sc.join();
      if (key === lastHud) return; lastHud = key;
      G.hud(`<div class="hud-score"><canvas width="60" height="60" data-av="${me}"></canvas><span class="num">${st.sc[me]}</span><span class="sep">:</span><span class="num">${st.sc[1 - me]}</span><canvas width="60" height="60" data-av="${1 - me}"></canvas></div>`);
      DA.paintHudAvatars(G);
    }
    G.emoteX = who => 0.5; G.emoteY = who => (who === G.you ? 0.72 : 0.22);

    let acc = 0;
    G.loop(dt => {
      const wt = worldTarget();
      if (G.isHost) {
        target[0] = wt;
        if (!G.online) target[1] = cpu();
        acc += dt; while (acc >= 1 / 90) { step(1 / 90); acc -= 1 / 90; }
        frame++;
        events.splice(0).forEach(e => { if (e !== 'wall' || frame % 3 === 0) playEv(e); if (G.online) evBuf.push(e); });
        if (G.online && frame % 2 === 0) G.rt.send({ k: 's', m: st.m.map(m => [Math.round(m.x), Math.round(m.y)]), p: [Math.round(st.p.x), Math.round(st.p.y), Math.round(st.p.vx), Math.round(st.p.vy)], sc: st.sc, ph: st.ph, pt: +st.pt.toFixed(2), last: st.last, ev: evBuf.splice(0).filter((e, i, a) => a.indexOf(e) === i) });
      } else {
        sendT -= dt; if (sendT <= 0) { G.rt.send({ k: 'i', x: Math.round(wt.x), y: Math.round(wt.y) }); sendT = 1 / 30; }
        const k = Math.min(1, dt * 20);
        // Puck mit Vorhersage glätten
        st.p.x += (st.p.vx || 0) * dt; st.p.y += (st.p.vy || 0) * dt;
        view.p.x = DA.lerp(view.p.x, st.p.x, k); view.p.y = DA.lerp(view.p.y, st.p.y, k);
        view.m[0].x = DA.lerp(view.m[0].x, st.m[0].x, k); view.m[0].y = DA.lerp(view.m[0].y, st.m[0].y, k);
        view.m[1].x = DA.lerp(view.m[1].x, wt.x, 0.5); view.m[1].y = DA.lerp(view.m[1].y, wt.y, 0.5);
      }
      render(G.t); hud();
    });
  },
};
