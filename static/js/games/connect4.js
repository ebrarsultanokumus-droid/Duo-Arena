/* Vier gewinnt – Logik läuft auf dem Python-Server */
'use strict';
DA.games.connect4 = {
  start(G) {
    const LW = 420, LH = 760, COLS = 7, ROWS = 6, CS = 56, BX = (LW - CS * COLS) / 2, BY = 230;
    const ctx = G.ctx, P = G.players, COL = ['#ff4fa3', '#ffc21a'];
    let s = null, anim = null, hover = -1, lastKey = '', ended = false, conf = [], placed = [];

    G.onState = ns => {
      const prev = s; s = ns;
      if (s.last && (!prev || !prev.last || prev.last[0] !== s.last[0] || prev.last[1] !== s.last[1] || prev.board[s.last[0]][s.last[1]] === -1)) {
        const [c, r] = s.last; anim = { c, r, y: BY - CS, vy: 0, who: s.board[c][r] }; DA.sfx.play('drop');
      }
      if (s.winner == null) { ended = false; if (!prev || prev.winner != null) { G.panel(null); conf = []; } }
      hud();
    };
    function cellXY(c, r) { return { x: BX + CS * (c + 0.5), y: BY + CS * (ROWS - 1 - r + 0.5) }; }

    function colAt(e) { const l = G.toLogical(e.clientX, e.clientY); const c = Math.floor((l.x - BX) / CS); return c >= 0 && c < COLS && l.y > BY - 120 && l.y < BY + CS * ROWS + 20 ? c : -1; }
    G.on(G.canvas, 'pointermove', e => { hover = colAt(e); });
    G.on(G.canvas, 'pointerdown', e => { hover = colAt(e); });
    G.on(G.canvas, 'pointerup', e => {
      const c = colAt(e); if (c < 0 || !s || s.winner != null) return;
      if (s.turn !== G.you) { DA.toast(P[1 - G.you].name + ' ist dran ⏳', 'warn', { ms: 1200 }); return; }
      if (s.board[c][ROWS - 1] !== -1) return;
      DA.sfx.play('click'); G.move({ col: c });
    });
    G.onKey = (k, down) => {
      if (!down || !s) return;
      if (k === 'arrowleft') hover = Math.max(0, (hover < 0 ? 3 : hover) - 1);
      if (k === 'arrowright') hover = Math.min(6, (hover < 0 ? 3 : hover) + 1);
      if ((k === 'enter' || k === ' ' || k === 'arrowdown') && hover >= 0 && s.turn === G.you) G.move({ col: hover });
    };

    function hud() {
      if (!s) return;
      const key = s.tally.join() + s.turn + s.winner; if (key === lastKey) return; lastKey = key;
      G.hud(`<div class="hud-score"><canvas width="60" height="60" data-av="${G.you}"></canvas><span class="num">${s.tally[G.you]}</span><span class="sep">:</span><span class="num">${s.tally[1 - G.you]}</span><canvas width="60" height="60" data-av="${1 - G.you}"></canvas></div>`);
      DA.paintHudAvatars(G);
      if (s.winner != null && !ended) {
        ended = true;
        const w = s.winner, me = G.you;
        setTimeout(() => {
          DA.sfx.play(w === me ? 'win' : w === -1 ? 'pop' : 'lose');
          if (w === me) for (let i = 0; i < 100; i++) conf.push({ x: LW / 2, y: 300, vx: DA.rand(-300, 300), vy: DA.rand(-600, -100), c: ['#ff4fa3', '#ffc21a', '#3de7ff', '#fff'][i % 4], l: 2.5, r: 0 });
          G.panel({
            title: w === -1 ? 'Unentschieden!' : w === me ? 'Vier in einer Reihe! 🏆' : P[w].name + ' gewinnt!',
            html: `<div class="big-num">${s.tally[me]} : ${s.tally[1 - me]}</div><p>${w === me ? 'Stark gespielt!' : w === -1 ? 'Das Brett ist voll.' : 'Nächste Runde holst du dir!'}</p>`,
            buttons: [{ label: '🔁 Nächste Runde', cls: 'primary', onClick: () => G.move({ action: 'again' }) }, { label: 'Zurück zur Arena', onClick: () => G.exit() }],
          });
        }, 900);
      }
    }

    function chip(x, y, who, glow) {
      const p = P[who];
      if (glow) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 24; }
      DA.drawChip(ctx, x, y, CS * 0.42, p, COL[who]);
      ctx.shadowBlur = 0;
    }
    function render(t) {
      G.fit(LW, LH, 'contain');
      const bg = ctx.createLinearGradient(0, 0, 0, LH); bg.addColorStop(0, '#24135a'); bg.addColorStop(1, '#0f0828');
      ctx.fillStyle = bg; ctx.fillRect(-500, -500, LW + 1000, LH + 1000);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (!s) { ctx.fillStyle = '#fff'; ctx.font = '900 20px Nunito, sans-serif'; ctx.fillText('Lade…', LW / 2, LH / 2); return; }
      // Wer ist dran
      const myTurn = s.turn === G.you && s.winner == null;
      ctx.font = '30px "Lilita One", sans-serif'; ctx.fillStyle = myTurn ? '#ffc21a' : '#cbbcff';
      ctx.fillText(s.winner != null ? '' : myTurn ? 'Du bist dran!' : P[s.turn].name + ' überlegt…', LW / 2, 110);
      if (s.winner == null) {
        const who = s.turn, x = hover >= 0 && myTurn ? BX + CS * (hover + 0.5) : LW / 2 + Math.sin(t * 2) * 60;
        chip(x, BY - 52 + Math.sin(t * 5) * 4, who);
      }
      // Brett
      ctx.fillStyle = '#1b0f3d'; DA.rr(ctx, BX - 14, BY - 8, CS * COLS + 28, CS * ROWS + 30, 22); ctx.fill();
      // Chips hinter dem Brett
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
        const v = s.board[c][r]; if (v < 0) continue;
        if (anim && anim.c === c && anim.r === r) continue;
        const { x, y } = cellXY(c, r); const inLine = s.line && s.line.some(([a, b]) => a === c && b === r);
        chip(x, y, v, inLine && Math.sin(t * 10) > 0);
      }
      if (anim) {
        const { x, y } = cellXY(anim.c, anim.r);
        anim.vy += 2600 / 60; anim.y += anim.vy / 60;
        if (anim.y >= y) { anim.y = y; if (Math.abs(anim.vy) > 300) { anim.vy *= -0.3; } else anim = null; }
        if (anim) chip(x, anim.y, anim.who);
      }
      // Brett-Vorderseite mit Löchern
      ctx.save();
      ctx.beginPath(); DA.rr(ctx, BX - 10, BY - 4, CS * COLS + 20, CS * ROWS + 20, 18);
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) { const { x, y } = cellXY(c, r); ctx.moveTo(x + CS * 0.43, y); ctx.arc(x, y, CS * 0.43, 0, Math.PI * 2, true); }
      const bg2 = ctx.createLinearGradient(0, BY, 0, BY + CS * ROWS); bg2.addColorStop(0, '#4d6bff'); bg2.addColorStop(1, '#2b3fd0');
      ctx.fillStyle = bg2; ctx.fill('evenodd');
      ctx.restore();
      if (hover >= 0 && myTurn) { ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(BX + hover * CS, BY - 4, CS, CS * ROWS + 20); }
      // Füße
      ctx.fillStyle = '#2b3fd0'; ctx.fillRect(BX - 24, BY + CS * ROWS + 16, 26, 60); ctx.fillRect(BX + CS * COLS - 2, BY + CS * ROWS + 16, 26, 60);
      // Spieler unten
      [G.you, 1 - G.you].forEach((i, k) => {
        const x = k === 0 ? 100 : LW - 100, y = 680, p = P[i], active = s.turn === i && s.winner == null;
        if (active) { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(x, y - 6, 48 + Math.sin(t * 6) * 3, 0, 7); ctx.fill(); }
        DA.drawHead(ctx, p.char, x, y - 8, 40, p.outfit, { t, shadow: false });
        ctx.fillStyle = COL[i]; ctx.beginPath(); ctx.arc(x + 32, y + 22, 10, 0, 7); ctx.fill();
        ctx.font = '900 16px Nunito, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(k === 0 ? 'Du' : p.name, x, y + 46);
      });
      ctx.font = '40px "Lilita One", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillText('VS', LW / 2, 680);
      conf.forEach(q => { q.vy += 15; q.x += q.vx / 60; q.y += q.vy / 60; q.l -= 1 / 60; q.r += .2; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.fillStyle = q.c; ctx.fillRect(-5, -3, 10, 6); ctx.restore(); });
      conf = conf.filter(q => q.l > 0);
    }
    G.emoteX = who => (who === G.you ? 0.25 : 0.75); G.emoteY = () => 0.8;
    G.loop(() => render(G.t));
  },
};
