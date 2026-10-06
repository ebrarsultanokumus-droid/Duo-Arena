/* Kopfball-Duell – Big-Head-Fußball, live 1 gegen 1 */
'use strict';
DA.games.soccer = {
  start(G) {
    const CAM_Y = 130, LW = 960, LH = 540, GROUND = 478, GOAL_W = 78, GOAL_H = 178, BAR_Y = GROUND - GOAL_H, BR = 18, HEAD_R = 50, MATCH = 90;
    const ctx = G.ctx, P = G.players;
    let st = fresh(), view = JSON.parse(JSON.stringify(st)), events = [], frame = 0, lastHud = '', confetti = [];
    const inputs = [{}, {}], prevKick = [false, false];
    let guestInputSent = '', guestInputT = 0, ai = { t: 0 };
    const crowd = []; for (let i = 0; i < 260; i++) crowd.push({ x: Math.random() * LW, y: 210 + Math.random() * 150, c: `hsl(${Math.random() * 360},70%,${50 + Math.random() * 25}%)`, p: Math.random() * 6 });

    function fresh() {
      return { p: [mkP(230, 1), mkP(730, -1)], b: { x: LW / 2, y: 180, vx: 0, vy: 0, rot: 0 }, sc: [0, 0], tm: MATCH, ph: 'count', pt: 3.2, last: -1 };
    }
    function mkP(x, f) { return { x, y: GROUND, vx: 0, vy: 0, f, kt: 0, kd: false }; }
    function kickoff(s) {
      s.p[0] = mkP(230, 1); s.p[1] = mkP(730, -1);
      s.b = { x: LW / 2, y: 160, vx: (Math.random() - .5) * 60, vy: 0, rot: 0 };
    }

    /* ---------- Steuerung ---------- */
    const c = G.controls, isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
    if (isTouch) {
      c.button('l', '◀', { left: '18px', bottom: 'calc(22px + env(safe-area-inset-bottom))', width: '76px', height: '76px' });
      c.button('r', '▶', { left: '108px', bottom: 'calc(22px + env(safe-area-inset-bottom))', width: '76px', height: '76px' });
      c.button('k', '⚽', { right: '18px', bottom: 'calc(22px + env(safe-area-inset-bottom))', width: '84px', height: '84px', fontSize: '34px' });
      c.button('j', '⤒', { right: '116px', bottom: 'calc(30px + env(safe-area-inset-bottom))', width: '72px', height: '72px' });
    }
    function readLocal() {
      const k = G.keys, b = c.keys;
      return { l: !!(b.l || k.arrowleft || k.a), r: !!(b.r || k.arrowright || k.d), j: !!(b.j || k.arrowup || k.w || k[' ']), k: !!(b.k || k.s || k.arrowdown || k.x) };
    }

    /* ---------- Netz ---------- */
    G.rt.on(d => {
      if (G.isHost) {
        if (d.k === 'i') inputs[1] = d;
        if (d.k === 'rematch') restart();
      } else {
        if (d.k === 's') applySnap(d);
      }
    });
    function restart() {
      st = fresh(); G.panel(null); events.push('whistle');
      if (G.online) G.rt.send({ k: 'restart' });
    }
    function applySnap(d) {
      st.p = d.p.map(a => ({ x: a[0], y: a[1], f: a[2], kt: a[3], vx: a[4] }));
      st.b = { x: d.b[0], y: d.b[1], rot: d.b[2], vx: d.b[3] };
      const wasEnd = st.ph === 'end';
      st.sc = d.sc; st.tm = d.tm; st.ph = d.ph; st.pt = d.pt; st.last = d.last;
      (d.ev || []).forEach(playEv);
      if (st.ph === 'end' && !wasEnd) showEnd();
      if (st.ph !== 'end' && wasEnd) G.panel(null);
    }

    /* ---------- Physik (nur Host) ---------- */
    function collideCircle(b, cx, cy, cr, pvx, pvy, e) {
      const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy), min = cr + BR;
      if (d >= min || d === 0) return false;
      const nx = dx / d, ny = dy / d;
      b.x = cx + nx * min; b.y = cy + ny * min;
      const rvx = b.vx - pvx, rvy = b.vy - pvy, vn = rvx * nx + rvy * ny;
      if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
      return vn < -120;
    }
    function step(dt) {
      const s = st;
      if (s.ph === 'count') { s.pt -= dt; if (s.pt <= 0) { s.ph = 'play'; events.push('whistle'); } }
      else if (s.ph === 'goal') { s.pt -= dt; if (s.pt <= 0) { kickoff(s); s.ph = 'count'; s.pt = 1.6; } }
      else if (s.ph === 'play') {
        s.tm -= dt;
        if (s.tm <= 0) {
          s.tm = 0; s.ph = 'end'; events.push('whistle');
          const w = s.sc[0] > s.sc[1] ? 0 : s.sc[1] > s.sc[0] ? 1 : -1;
          G.rt.result(w, s.sc[0] + ':' + s.sc[1]);
          showEnd();
        }
      }
      const frozen = s.ph === 'count' || s.ph === 'end';
      // Spieler
      s.p.forEach((p, i) => {
        const inp = frozen ? {} : inputs[i];
        const target = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
        p.vx = DA.lerp(p.vx, target * 360, Math.min(1, dt * 14));
        if (inp.j && p.y >= GROUND - 0.5) { p.vy = -780; if (i === G.you || !G.online) events.push('jump'); }
        p.vy += 2100 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y > GROUND) { p.y = GROUND; p.vy = 0; }
        p.x = DA.clamp(p.x, 34, LW - 34);
        if (inp.k && !prevKick[i] && p.kt <= 0) { p.kt = 0.28; p.kd = false; }
        prevKick[i] = !!inp.k;
        if (p.kt > 0) p.kt -= dt;
      });
      // Spieler blocken sich
      const a = s.p[0], b2 = s.p[1];
      if (Math.abs(a.x - b2.x) < 70 && Math.abs(a.y - b2.y) < 120) {
        const push = (70 - Math.abs(a.x - b2.x)) / 2, sgn = a.x < b2.x ? -1 : 1;
        a.x += sgn * push; b2.x -= sgn * push;
        if (a.y < b2.y - 60 && a.vy > 0) { a.y = b2.y - 120; a.vy = -300; }
        if (b2.y < a.y - 60 && b2.vy > 0) { b2.y = a.y - 120; b2.vy = -300; }
      }
      if (frozen && s.ph !== 'count') return;
      // Ball
      const ball = s.b, sub = 3;
      for (let k = 0; k < sub; k++) {
        const h = dt / sub;
        if (s.ph !== 'count') { ball.vy += 1350 * h; ball.vx *= Math.pow(0.6, h); }
        ball.x += ball.vx * h; ball.y += ball.vy * h;
        if (ball.y > GROUND - BR) { ball.y = GROUND - BR; if (ball.vy > 160) events.push('bounce'); ball.vy *= -0.62; ball.vx *= 0.97; if (Math.abs(ball.vy) < 40) ball.vy = 0; }
        if (ball.y < BR) { ball.y = BR; ball.vy = Math.abs(ball.vy) * 0.6; }
        if (ball.x < BR) { ball.x = BR; ball.vx = Math.abs(ball.vx) * 0.6; }
        if (ball.x > LW - BR) { ball.x = LW - BR; ball.vx = -Math.abs(ball.vx) * 0.6; }
        // Latten
        [[0, GOAL_W], [LW - GOAL_W, LW]].forEach(([x0, x1]) => {
          const cx = DA.clamp(ball.x, x0, x1), cy = DA.clamp(ball.y, BAR_Y - 10, BAR_Y);
          const dx = ball.x - cx, dy = ball.y - cy, d = Math.hypot(dx, dy);
          if (d < BR && d > 0) { const nx = dx / d, ny = dy / d; ball.x = cx + nx * BR; ball.y = cy + ny * BR; const vn = ball.vx * nx + ball.vy * ny; if (vn < 0) { ball.vx -= 1.7 * vn * nx; ball.vy -= 1.7 * vn * ny; events.push('bounce'); } }
        });
        s.p.forEach((p, i) => {
          if (collideCircle(ball, p.x, p.y - 102, HEAD_R, p.vx, p.vy, 0.75)) events.push('bounce');
          collideCircle(ball, p.x, p.y - 34, 26, p.vx, p.vy, 0.4);
          if (p.kt > 0.08 && !p.kd) {
            const fx = p.x + p.f * 34, fy = p.y - 16;
            if (Math.hypot(ball.x - fx, ball.y - fy) < BR + 30) {
              p.kd = true;
              const high = ball.y < p.y - 60;
              ball.vx = p.f * (high ? 780 : 920) + p.vx * 0.3; ball.vy = high ? -200 : -560;
              ball.x = fx + p.f * (BR + 12);
              events.push('kick');
            }
          }
        });
        ball.vx = DA.clamp(ball.vx, -1500, 1500); ball.vy = DA.clamp(ball.vy, -1500, 1500);
      }
      ball.rot += ball.vx * dt / BR;
      // Tor?
      if (s.ph === 'play') {
        let scorer = -1;
        if (ball.x + BR * 0.4 < GOAL_W && ball.y > BAR_Y) scorer = 1;
        if (ball.x - BR * 0.4 > LW - GOAL_W && ball.y > BAR_Y) scorer = 0;
        if (scorer >= 0) { s.sc[scorer]++; s.ph = 'goal'; s.pt = 2.4; s.last = scorer; events.push('goal' + scorer); }
      }
    }

    /* ---------- Computer-Gegner ---------- */
    function cpuInput(dt) {
      const p = st.p[1], b = st.b, o = {};
      ai.t -= dt;
      const want = b.x + 34 + (b.vx > 0 ? b.vx * 0.15 : 0);
      if (b.x > p.x - 10) { o.r = true; if (Math.abs(b.x - p.x) < 60 && b.y > p.y - 120) o.j = true; }
      else if (Math.abs(want - p.x) > 14) { if (want > p.x) o.r = true; else o.l = true; }
      if (Math.abs(b.x - p.x) < 140 && b.y < p.y - 110 && b.vy > -100 && Math.random() < 0.5) o.j = true;
      if (b.x < p.x && Math.hypot(b.x - (p.x - 34), b.y - (p.y - 16)) < 70 && ai.t <= 0) { o.k = true; ai.t = 0.3; }
      if (st.p[1].x < 160 && b.x > 300) o.r = true;
      return o;
    }

    /* ---------- Ereignisse / Sound ---------- */
    function playEv(e) {
      if (e === 'kick') { DA.sfx.play('kick'); DA.vibrate(15); }
      else if (e === 'bounce') DA.sfx.play('bounce');
      else if (e === 'whistle') DA.sfx.play('whistle');
      else if (e === 'jump') DA.sfx.play('jump');
      else if (e.startsWith('goal')) {
        const who = +e[4]; DA.sfx.play(who === G.you ? 'goal' : 'lose'); DA.vibrate([80, 50, 80]);
        for (let i = 0; i < 120; i++) confetti.push({ x: who === 0 ? LW - 60 : 60, y: GROUND - 100, vx: DA.rand(-420, 420), vy: DA.rand(-700, -200), c: ['#ff4fa3', '#ffc21a', '#3de7ff', '#fff', '#b6ff3b'][i % 5], l: 2.2, r: Math.random() * 6 });
      }
    }

    function showEnd() {
      const s = st, me = G.you, w = s.sc[0] > s.sc[1] ? 0 : s.sc[1] > s.sc[0] ? 1 : -1;
      DA.sfx.play(w === me ? 'win' : w === -1 ? 'whistle' : 'lose');
      const title = w === -1 ? 'Unentschieden!' : (w === me ? 'Du gewinnst! 🏆' : P[w].name + ' gewinnt!');
      G.panel({
        top: `<canvas id="endAv" width="200" height="200" style="width:100px;height:100px"></canvas>`,
        title, html: `<div class="big-num">${s.sc[0]} : ${s.sc[1]}</div><p>${G.online ? (w === me ? '+40 🪙' : w === -1 ? '+20 🪙' : '+12 🪙') : 'Training gegen den Computer'}</p>`,
        buttons: [{ label: '🔁 Revanche', cls: 'primary', onClick: () => { if (G.isHost) restart(); else { G.rt.send({ k: 'rematch' }); G.panel({ title: 'Revanche angefragt…', html: '<div class="spinner"></div>' }); } } },
          { label: 'Zurück zur Arena', onClick: () => G.exit() }],
        onMount: () => { const cv = document.getElementById('endAv'); const wp = P[w === -1 ? me : w]; DA.drawAvatar(cv, wp.char, wp.outfit, wp.color); },
      });
    }

    /* ---------- Zeichnen ---------- */
    function drawStadium(t) {
      const g = ctx.createLinearGradient(0, 0, 0, LH); g.addColorStop(0, '#060b2a'); g.addColorStop(0.45, '#1b2a6b'); g.addColorStop(0.62, '#28397f'); g.addColorStop(1, '#0d1a3a');
      ctx.fillStyle = g; ctx.fillRect(-400, -200, LW + 800, LH + 400);
      // Flutlicht
      [[120, 40], [840, 40]].forEach(([x, y]) => {
        const lg = ctx.createRadialGradient(x, y, 0, x, y, 260); lg.addColorStop(0, 'rgba(255,255,230,.55)'); lg.addColorStop(1, 'rgba(255,255,230,0)');
        ctx.fillStyle = lg; ctx.fillRect(x - 260, y - 260, 520, 520);
        ctx.fillStyle = '#fffbe0'; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.arc(x - 24 + i * 16, y - 6 + j * 14, 5, 0, 7); ctx.fill(); }
      });
      // Tribüne
      ctx.fillStyle = '#121a45'; ctx.fillRect(-400, 200, LW + 800, 175);
      const excite = st.ph === 'goal' ? 1 : 0.15;
      crowd.forEach(p => { ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y + Math.sin(t * 8 + p.p) * 3 * excite * 3, 5, 0, 7); ctx.fill(); });
      // Bande
      ctx.fillStyle = '#ff4fa3'; ctx.fillRect(-400, 372, LW + 800, 34);
      ctx.fillStyle = '#fff'; ctx.font = '24px "Lilita One", sans-serif'; ctx.textBaseline = 'middle';
      const off = (t * 60) % 330;
      for (let x = -400 - off; x < LW + 400; x += 330) ctx.fillText('DUO ARENA  💗  ', x, 390);
      // Rasen
      const gg = ctx.createLinearGradient(0, 406, 0, LH); gg.addColorStop(0, '#2c9d4c'); gg.addColorStop(1, '#1b6b33');
      ctx.fillStyle = gg; ctx.fillRect(-400, 406, LW + 800, LH);
      for (let i = -4; i < 16; i++) { if (i % 2) { ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(i * 80, 406, 80, LH); } }
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(LW / 2, 406); ctx.lineTo(LW / 2, LH); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(LW / 2, GROUND + 10, 110, 26, 0, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-400, GROUND + 6); ctx.lineTo(LW + 400, GROUND + 6); ctx.stroke();
    }
    function drawGoal(left, front) {
      const x0 = left ? 0 : LW - GOAL_W, x1 = x0 + GOAL_W, back = left ? x0 : x1;
      if (!front) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5;
        for (let x = x0; x <= x1; x += 13) { ctx.beginPath(); ctx.moveTo(x, BAR_Y); ctx.lineTo(x, GROUND); ctx.stroke(); }
        for (let y = BAR_Y; y <= GROUND; y += 13) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x0, BAR_Y, GOAL_W, GOAL_H);
        ctx.restore();
      } else {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1a1030'; ctx.lineWidth = 2;
        ctx.fillRect(x0, BAR_Y - 10, GOAL_W, 10); ctx.strokeRect(x0, BAR_Y - 10, GOAL_W, 10);
        const px = left ? x1 - 7 : x0; ctx.fillRect(px, BAR_Y - 10, 7, GOAL_H + 10); ctx.strokeRect(px, BAR_Y - 10, 7, GOAL_H + 10);
        ctx.fillRect(back - (left ? 0 : 5), BAR_Y - 10, 5, GOAL_H + 10);
      }
    }
    function drawPlayer(p, i, t) {
      const pl = P[i], kick = p.kt > 0 ? Math.sin((1 - p.kt / 0.28) * Math.PI) : 0;
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(p.x, GROUND + 4, 34 * (1 - (GROUND - p.y) / 500), 7, 0, 0, 7); ctx.fill();
      DA.drawBody(ctx, pl.char, pl.outfit, p.x, p.y, 68, { facing: p.f, run: Math.abs(p.vx) > 30 ? p.x * 0.06 : 0, kick });
      DA.drawHead(ctx, pl.char, p.x, p.y - 102, HEAD_R + 6, pl.outfit, { shadow: false, t });
      if (i === G.you && G.online) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(p.x - 9, p.y - 172); ctx.lineTo(p.x + 9, p.y - 172); ctx.lineTo(p.x, p.y - 160); ctx.fill(); }
      ctx.font = '900 15px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.fillText(pl.name, p.x, p.y - 182);
    }
    function render(t) {
      G.fit(LW, LH - CAM_Y, 'contain'); ctx.translate(0, -CAM_Y);
      drawStadium(t);
      drawGoal(true, false); drawGoal(false, false);
      const vs = G.isHost ? st : view;
      vs.p.forEach((p, i) => drawPlayer(p, i, t));
      const b = vs.b;
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(b.x, GROUND + 4, 16, 4, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot || 0); DA.drawBall(ctx, 0, 0, BR); ctx.restore();
      drawGoal(true, true); drawGoal(false, true);
      // Konfetti
      confetti.forEach(q => { q.vy += 900 / 60; q.x += q.vx / 60; q.y += q.vy / 60; q.l -= 1 / 60; q.r += .2; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.fillStyle = q.c; ctx.fillRect(-5, -3, 10, 6); ctx.restore(); });
      confetti = confetti.filter(q => q.l > 0);
      // Texte
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (st.ph === 'count') {
        const n = Math.ceil(st.pt); bigText(n > 0 && st.pt < 3.05 ? String(n) : (st.pt >= 3.05 ? 'BEREIT?' : ''), '#fff');
      } else if (st.ph === 'goal') {
        const sc = P[st.last]; bigText('TOOOR!', '#ffc21a', 1 + Math.sin(t * 12) * 0.05);
        ctx.font = '900 26px Nunito, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(sc ? sc.name + ' trifft!' : '', LW / 2, 330);
      }
    }
    function bigText(s, col, sc = 1) {
      ctx.save(); ctx.translate(LW / 2, 260); ctx.scale(sc, sc);
      ctx.font = '96px "Lilita One", sans-serif'; ctx.lineWidth = 10; ctx.strokeStyle = '#1a1030'; ctx.strokeText(s, 0, 0); ctx.fillStyle = col; ctx.fillText(s, 0, 0); ctx.restore();
    }
    function hud() {
      const s = st, key = s.sc.join() + Math.ceil(s.tm);
      if (key === lastHud) return; lastHud = key;
      const m = Math.floor(Math.ceil(s.tm) / 60), sec = String(Math.ceil(s.tm) % 60).padStart(2, '0');
      G.hud(`<div style="display:flex;flex-direction:column;align-items:center;gap:4px">${DA.hudScore(G, s.sc[0], s.sc[1])}<div class="hud-pill" style="padding:2px 10px;font-size:13px">⏱ ${m}:${sec}</div></div>`);
      DA.paintHudAvatars(G);
    }
    G.emoteX = who => { const v = G.view, p = (G.isHost ? st : view).p[who]; return v ? (v.ox + p.x * v.s) / G.W : 0.5; };
    G.emoteY = who => { const v = G.view, p = (G.isHost ? st : view).p[who]; return v ? (v.oy + (p.y - 230 - CAM_Y) * v.s) / G.H : 0.3; };

    /* ---------- Hauptschleife ---------- */
    let acc = 0;
    G.loop(dt => {
      const local = readLocal();
      if (G.isHost) {
        inputs[0] = local;
        if (!G.online) inputs[1] = cpuInput(dt);
        acc += dt;
        while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60; }
        frame++;
        events.splice(0).forEach(e => { playEv(e); if (G.online) evBuf.push(e); });
        if (G.online && frame % 2 === 0) {
          G.rt.send({ k: 's', p: st.p.map(p => [r1(p.x), r1(p.y), p.f, +p.kt.toFixed(2), r1(p.vx)]), b: [r1(st.b.x), r1(st.b.y), +st.b.rot.toFixed(2), r1(st.b.vx)], sc: st.sc, tm: +st.tm.toFixed(1), ph: st.ph, pt: +st.pt.toFixed(2), last: st.last, ev: evBuf.splice(0) });
        }
      } else {
        const js = JSON.stringify(local); guestInputT -= dt;
        if (js !== guestInputSent || guestInputT <= 0) { G.rt.send(Object.assign({ k: 'i' }, local)); guestInputSent = js; guestInputT = 0.15; }
        // sanft zum Server-Zustand gleiten
        const k = Math.min(1, dt * 18);
        view.p.forEach((p, i) => { const s = st.p[i]; p.x = DA.lerp(p.x, s.x, k); p.y = DA.lerp(p.y, s.y, k); p.f = s.f; p.kt = s.kt; p.vx = s.vx; });
        view.b.x = DA.lerp(view.b.x, st.b.x, k); view.b.y = DA.lerp(view.b.y, st.b.y, k); view.b.rot = st.b.rot;
      }
      render(G.t);
      hud();
    });
    const evBuf = [];
    function r1(v) { return Math.round(v * 10) / 10; }
    G.onExit = () => { };
  },
};
