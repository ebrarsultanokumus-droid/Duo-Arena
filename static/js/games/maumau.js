/* Mau-Mau – Kartenspiel, Regeln & Computer-Gegner laufen auf dem Python-Server */
'use strict';
DA.games.maumau = {
  start(G) {
    const LW = 420, LH = 780, CW = 74, CH = 110;
    const ctx = G.ctx, P = G.players, SUITN = { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo' }, SUITS = { C: '♣', S: '♠', H: '♥', D: '♦' };
    let s = null, fly = [], lastKey = '', ended = false, hand = [], pressed = null, conf = [], shout = null;
    const DECK = { x: 110, y: 330 }, PILE = { x: 250, y: 330 };

    G.onState = ns => {
      const prev = s; s = ns;
      const ev = s.event;
      if (ev && prev) {
        if (ev.type === 'play' || ev.type === 'mau' || ev.type === 'win') {
          if (prev.top !== s.top) {
            const from = ev.who === G.you ? { x: LW / 2, y: 650 } : { x: LW / 2, y: 90 };
            fly.push({ card: s.top, x: from.x, y: from.y, tx: PILE.x, ty: PILE.y, t: 0, rot: DA.rand(-.3, .3) }); DA.sfx.play('card');
          }
          if (ev.type === 'mau') shout = { text: 'Mau!', who: ev.who, t: 1.4 };
          if (ev.type === 'win') shout = { text: 'MAU-MAU!', who: ev.who, t: 2.5 };
          const rk = s.top.slice(1);
          if (rk === '7' && ev.who !== G.you) { DA.sfx.play('alarm'); DA.vibrate(60); }
        }
        if (ev.type === 'draw') {
          for (let i = 0; i < Math.min(ev.n, 4); i++) fly.push({ back: true, x: DECK.x, y: DECK.y, tx: LW / 2, ty: ev.who === G.you ? 650 : 90, t: -i * 0.08, rot: 0 });
          DA.sfx.play('card');
        }
      }
      if (prev && prev.turn !== G.you && s.turn === G.you && s.winner == null) { DA.sfx.play('pop'); DA.vibrate(20); }
      if (s.winner == null) { if (ended) { ended = false; G.panel(null); conf = []; } }
      layoutHand(); hud();
    };

    function layoutHand() {
      if (!s) return;
      const n = s.hand.length, maxW = LW - 40, step = Math.min(CW * 0.8, (maxW - CW) / Math.max(1, n - 1));
      const total = step * (n - 1) + CW, x0 = (LW - total) / 2;
      hand = s.hand.map((c, i) => {
        const a = (i - (n - 1) / 2) * 0.05, ok = s.playable.includes(c);
        return { card: c, x: x0 + i * step, y: 610 + Math.abs(i - (n - 1) / 2) * 3 - (ok ? 20 : 0), a, ok };
      });
    }
    function cardAt(l) {
      for (let i = hand.length - 1; i >= 0; i--) { const h = hand[i]; if (l.x >= h.x && l.x <= h.x + CW && l.y >= h.y && l.y <= h.y + CH) return h; }
      return null;
    }
    G.on(G.canvas, 'pointerdown', e => { const l = G.toLogical(e.clientX, e.clientY); pressed = cardAt(l); });
    G.on(G.canvas, 'pointerup', e => {
      if (!s || s.winner != null) return;
      const l = G.toLogical(e.clientX, e.clientY);
      const myTurn = s.turn === G.you;
      // Stapel antippen = ziehen
      if (Math.abs(l.x - DECK.x) < CW * 0.7 && Math.abs(l.y - DECK.y) < CH * 0.7) {
        if (!myTurn) return DA.toast('Warte, bis du dran bist ⏳', 'warn', { ms: 1200 });
        if (s.phase === 'drawn') return G.move({ action: 'pass' });
        DA.sfx.play('card'); return G.move({ action: 'draw' });
      }
      // Weiter-Knopf
      if (myTurn && s.phase === 'drawn' && l.y > 505 && l.y < 555 && Math.abs(l.x - LW / 2) < 80) { DA.sfx.play('click'); return G.move({ action: 'pass' }); }
      const h = cardAt(l); if (!h || h !== pressed) return;
      if (!myTurn) return DA.toast('Warte, bis du dran bist ⏳', 'warn', { ms: 1200 });
      if (!h.ok) { DA.sfx.play('bounce'); h.shake = 0.3; return; }
      if (h.card.slice(1) === 'J') return askWish(h.card);
      G.move({ action: 'play', card: h.card });
    });
    function askWish(card) {
      G.panel({
        title: 'Wunschfarbe', text: 'Welche Farbe wünschst du dir?',
        html: `<div class="pick" style="grid-template-columns:repeat(2,1fr)">${['H', 'D', 'C', 'S'].map(su => `<button data-s="${su}" style="font-size:40px;color:${'HD'.includes(su) ? '#ff4d6a' : '#fff'}">${SUITS[su]}<div style="font-size:14px;color:#fff">${SUITN[su]}</div></button>`).join('')}</div>`,
        buttons: [{ label: 'Abbrechen', onClick: () => G.panel(null) }],
        onMount: el => el.querySelectorAll('.pick button').forEach(b => b.onclick = () => { G.panel(null); G.move({ action: 'play', card, wish: b.dataset.s }); }),
      });
    }

    function hud() {
      if (!s) return;
      const key = s.tally.join() + s.winner; if (key === lastKey) return; lastKey = key;
      G.hud(`<div class="hud-score"><canvas width="60" height="60" data-av="${G.you}"></canvas><span class="num">${s.tally[G.you]}</span><span class="sep">:</span><span class="num">${s.tally[1 - G.you]}</span><canvas width="60" height="60" data-av="${1 - G.you}"></canvas></div>`);
      DA.paintHudAvatars(G);
      if (s.winner != null && !ended) {
        ended = true; const w = s.winner, me = G.you;
        setTimeout(() => {
          DA.sfx.play(w === me ? 'win' : 'lose');
          if (w === me) for (let i = 0; i < 100; i++) conf.push({ x: LW / 2, y: 330, vx: DA.rand(-320, 320), vy: DA.rand(-650, -100), c: ['#ff4fa3', '#ffc21a', '#3de7ff', '#fff'][i % 4], l: 2.5, r: 0 });
          G.panel({
            title: w === me ? 'Mau-Mau! Du gewinnst 🏆' : P[w].name + ' gewinnt!',
            html: `<div class="big-num">${s.tally[me]} : ${s.tally[1 - me]}</div><p>${w === me ? 'Alle Karten los – stark!' : (w === me ? P[1 - me].name + ' hatte noch ' + (s.oppHand ? s.oppHand.length : s.opp) : 'Du hattest noch ' + s.hand.length) + ' Karte(n).'}</p>`,
            buttons: [{ label: '🔁 Nächste Runde', cls: 'primary', onClick: () => G.move({ action: 'again' }) }, { label: 'Zurück zur Arena', onClick: () => G.exit() }],
          });
        }, 1500);
      }
    }

    function render(t, dt) {
      G.fit(LW, LH, 'contain');
      const g = ctx.createRadialGradient(LW / 2, LH / 2, 50, LW / 2, LH / 2, 600); g.addColorStop(0, '#1f8a55'); g.addColorStop(1, '#0a3a22');
      ctx.fillStyle = g; ctx.fillRect(-600, -600, LW + 1200, LH + 1200);
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(LW / 2, LH / 2 - 40, 200, 170, 0, 0, 7); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (!s) { ctx.fillStyle = '#fff'; ctx.font = '900 20px Nunito, sans-serif'; ctx.fillText('Karten werden gemischt…', LW / 2, LH / 2); return; }
      const opp = P[1 - G.you], myTurn = s.turn === G.you && s.winner == null;
      // Gegner
      const on = s.opp, ostep = Math.min(26, 260 / Math.max(1, on));
      for (let i = 0; i < on; i++) {
        const x = LW / 2 - ((on - 1) * ostep) / 2 + i * ostep;
        ctx.save(); ctx.translate(x, 92); ctx.rotate((i - (on - 1) / 2) * -0.06 + Math.PI);
        if (s.oppHand && s.winner != null) DA.drawCardFace(ctx, s.oppHand[i] || 'H7', -CW * 0.35, -CH * 0.35, CW * 0.7, CH * 0.7);
        else DA.drawCardBack(ctx, -CW * 0.35, -CH * 0.35, CW * 0.7, CH * 0.7);
        ctx.restore();
      }
      DA.drawHead(ctx, opp.char, 52, 168, 30, opp.outfit, { t, shadow: false, angry: s.pending7 > 0 && s.turn === G.you });
      ctx.font = '900 14px Nunito, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(opp.name + ' · ' + on + ' 🂠', 88, 168); ctx.textAlign = 'center';
      if (!myTurn && s.winner == null) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '900 13px Nunito, sans-serif'; ctx.fillText('ist dran' + '.'.repeat(1 + Math.floor(t * 2) % 3), 52, 210); }
      // Ziehstapel
      for (let i = Math.min(4, Math.ceil(s.deck / 6)); i >= 0; i--) DA.drawCardBack(ctx, DECK.x - CW / 2 - i * 1.5, DECK.y - CH / 2 - i * 1.5, CW, CH);
      ctx.fillStyle = 'rgba(0,0,0,.45)'; DA.rr(ctx, DECK.x - 22, DECK.y + CH / 2 + 8, 44, 22, 11); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '900 13px Nunito, sans-serif'; ctx.fillText(s.deck, DECK.x, DECK.y + CH / 2 + 19);
      if (myTurn && (s.playable.length === 0 || s.pending7) && s.phase !== 'drawn') {
        ctx.strokeStyle = `rgba(255,194,26,${0.5 + Math.sin(t * 6) * 0.5})`; ctx.lineWidth = 4; DA.rr(ctx, DECK.x - CW / 2 - 6, DECK.y - CH / 2 - 6, CW + 12, CH + 12, 12); ctx.stroke();
        ctx.fillStyle = '#ffc21a'; ctx.font = '900 14px Nunito, sans-serif'; ctx.fillText(s.pending7 ? s.pending7 + ' ziehen' : 'ziehen', DECK.x, DECK.y - CH / 2 - 18);
      }
      // Ablage
      (s.under || []).forEach((c, i) => { ctx.save(); ctx.translate(PILE.x, PILE.y); ctx.rotate((i - 1) * 0.18); DA.drawCardFace(ctx, c, -CW / 2, -CH / 2, CW, CH, { dim: true }); ctx.restore(); });
      const flyingTop = fly.some(f => f.card === s.top);
      if (!flyingTop) DA.drawCardFace(ctx, s.top, PILE.x - CW / 2, PILE.y - CH / 2, CW, CH);
      // Wunsch / 7er
      if (s.wish) {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(PILE.x + CW / 2 + 34, PILE.y - 20, 26, 0, 7); ctx.fill();
        ctx.fillStyle = 'HD'.includes(s.wish) ? '#e3243b' : '#1a1030'; ctx.font = '34px serif'; ctx.fillText(SUITS[s.wish], PILE.x + CW / 2 + 34, PILE.y - 18);
        ctx.fillStyle = '#fff'; ctx.font = '900 11px Nunito, sans-serif'; ctx.fillText('Wunsch', PILE.x + CW / 2 + 34, PILE.y + 16);
      }
      if (s.pending7) {
        ctx.fillStyle = '#ff3b5c'; ctx.beginPath(); ctx.arc(PILE.x + CW / 2 + 34, PILE.y + 46, 22, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '900 16px Nunito, sans-serif'; ctx.fillText('+' + s.pending7, PILE.x + CW / 2 + 34, PILE.y + 47);
      }
      // Log
      ctx.font = '700 13px Nunito, sans-serif';
      (s.log || []).slice(-2).forEach((l, i, a) => { ctx.fillStyle = `rgba(255,255,255,${i === a.length - 1 ? .95 : .5})`; ctx.fillText(l, LW / 2, 440 + i * 20); });
      // Status
      ctx.font = '26px "Lilita One", sans-serif'; ctx.fillStyle = myTurn ? '#ffc21a' : 'rgba(255,255,255,.6)';
      if (s.winner == null) ctx.fillText(myTurn ? (s.phase === 'drawn' ? 'Legen oder weiter' : 'Du bist dran!') : '', LW / 2, 492);
      if (myTurn && s.phase === 'drawn') {
        ctx.fillStyle = 'rgba(255,255,255,.15)'; DA.rr(ctx, LW / 2 - 70, 508, 140, 42, 21); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = '900 16px Nunito, sans-serif'; ctx.fillText('Weiter ➜', LW / 2, 530);
      }
      // Meine Hand
      hand.forEach(h => {
        if (h.shake) h.shake = Math.max(0, h.shake - dt);
        const sx = h.shake ? Math.sin(h.shake * 60) * 6 : 0;
        ctx.save(); ctx.translate(h.x + CW / 2 + sx, h.y + CH / 2); ctx.rotate(h.a);
        DA.drawCardFace(ctx, h.card, -CW / 2, -CH / 2, CW, CH, { glow: h.ok && myTurn, dim: myTurn && !h.ok });
        ctx.restore();
      });
      const me = P[G.you];
      DA.drawHead(ctx, me.char, LW - 46, 748, 26, me.outfit, { t, shadow: false });
      // fliegende Karten
      fly.forEach(f => {
        f.t += dt * 3.2; const k = DA.clamp(f.t, 0, 1), e = 1 - Math.pow(1 - k, 3);
        const x = DA.lerp(f.x, f.tx, e), y = DA.lerp(f.y, f.ty, e) - Math.sin(k * Math.PI) * 60;
        if (f.t < 0) return;
        ctx.save(); ctx.translate(x, y); ctx.rotate(f.rot * (1 - e) + k * 0.1);
        if (f.back) DA.drawCardBack(ctx, -CW / 2, -CH / 2, CW, CH); else DA.drawCardFace(ctx, f.card, -CW / 2, -CH / 2, CW, CH);
        ctx.restore();
      });
      fly = fly.filter(f => f.t < 1);
      if (shout) {
        shout.t -= dt; const sc = 1 + Math.max(0, shout.t - 1) * 0.5;
        ctx.save(); ctx.translate(LW / 2, shout.who === G.you ? 560 : 230); ctx.scale(sc, sc); ctx.rotate(-0.08);
        ctx.font = '58px "Lilita One", sans-serif'; ctx.lineWidth = 10; ctx.strokeStyle = '#1a1030'; ctx.strokeText(shout.text, 0, 0); ctx.fillStyle = '#ffc21a'; ctx.fillText(shout.text, 0, 0);
        ctx.restore(); if (shout.t <= 0) shout = null;
      }
      conf.forEach(q => { q.vy += 15; q.x += q.vx / 60; q.y += q.vy / 60; q.l -= 1 / 60; q.r += .2; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.fillStyle = q.c; ctx.fillRect(-5, -3, 10, 6); ctx.restore(); });
      conf = conf.filter(q => q.l > 0);
    }
    G.emoteX = who => (who === G.you ? 0.5 : 0.15); G.emoteY = who => (who === G.you ? 0.7 : 0.2);
    G.loop(dt => render(G.t, dt));
  },
};
