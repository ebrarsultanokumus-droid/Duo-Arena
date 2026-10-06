/* Geister-Jagd – Pac-Man mit euren Gesichtern: du bist der Fresser, sie sind die Geister */
'use strict';
DA.games.pacman = {
  start(G) {
    const MAP = [
      '############################',
      '#............##............#',
      '#.####.#####.##.#####.####.#',
      '#o####.#####.##.#####.####o#',
      '#.####.#####.##.#####.####.#',
      '#..........................#',
      '#.####.##.########.##.####.#',
      '#.####.##.########.##.####.#',
      '#......##....##....##......#',
      '######.##### ## #####.######',
      '     #.##### ## #####.#     ',
      '     #.##          ##.#     ',
      '     #.## ###--### ##.#     ',
      '######.## #      # ##.######',
      '      .   #      #   .      ',
      '######.## #      # ##.######',
      '     #.## ######## ##.#     ',
      '     #.##          ##.#     ',
      '     #.## ######## ##.#     ',
      '######.## ######## ##.######',
      '#............##............#',
      '#.####.#####.##.#####.####.#',
      '#.####.#####.##.#####.####.#',
      '#o..##.......  .......##..o#',
      '###.##.##.########.##.##.###',
      '###.##.##.########.##.##.###',
      '#......##....##....##......#',
      '#.##########.##.##########.#',
      '#.##########.##.##########.#',
      '#..........................#',
      '############################',
    ].map(r => r.padEnd(28, ' '));
    const COLS = 28, ROWS = 31, T = 16, MX = 0, MY = 56, LW = COLS * T, LH = MY + ROWS * T + 190;
    const ctx = G.ctx, me = G.me, pa = G.partner && G.partner.char !== me.char ? G.partner : { char: DA.otherChar(me.char), outfit: (G.partner || {}).outfit || {} };
    const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const GH = [
      { name: 'Blinky', color: '#ff3b5c', corner: [25, -3], release: 0 },
      { name: 'Pinky', color: '#ff8fd0', corner: [2, -3], release: 1.5 },
      { name: 'Inky', color: '#3de7ff', corner: [27, 31], release: 5 },
      { name: 'Clyde', color: '#ffae3d', corner: [0, 31], release: 9 },
    ];
    let dots, dotCount, score = 0, lives = 3, level = 1, pac, ghosts, mode, modeIdx, modeT, fright, combo, phase = 'intro', phaseT = 0;
    let eaten = 0, bonus = null, popups = [], best = 0, want = null;

    function resetDots() {
      dots = MAP.map(r => r.split('').map(ch => (ch === '.' ? 1 : ch === 'o' ? 2 : 0)));
      dotCount = dots.flat().filter(Boolean).length; eaten = 0;
    }
    function resetActors() {
      pac = { x: 13.5, y: 23, dir: 'left', mouth: 0, alive: true };
      want = 'left';
      ghosts = GH.map((g, i) => ({
        ...g, x: i === 0 ? 13.5 : [11.5, 13.5, 15.5][i - 1], y: i === 0 ? 11 : 14, dir: i === 0 ? 'left' : 'up',
        state: i === 0 ? 'active' : 'house', timer: g.release + (level > 1 ? -0.5 * level : 0), fr: false,
      }));
      mode = 'scatter'; modeIdx = 0; modeT = 7; fright = 0; combo = 0;
    }
    const SCHED = [7, 20, 7, 20, 5, 20, 5, 1e9];
    resetDots(); resetActors();

    /* ---------- Raster ---------- */
    function tile(tx, ty) {
      if (ty === 14 && (tx < 0 || tx >= COLS)) return ' ';
      if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return '#';
      return MAP[ty][tx];
    }
    function open(tx, ty) { const c = tile(tx, ty); return c !== '#' && c !== '-'; }
    const atCenter = e => Math.abs(e.x - Math.round(e.x)) < 1e-4 && Math.abs(e.y - Math.round(e.y)) < 1e-4;
    function canGo(e, d) { const [dx, dy] = DIRS[d]; return open(Math.round(e.x) + dx, Math.round(e.y) + dy); }
    const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
    function moveEnt(e, dist, choose) {
      let guard = 0;
      while (dist > 1e-6 && guard++ < 12) {
        if (atCenter(e)) {
          e.x = Math.round(e.x); e.y = Math.round(e.y);
          choose(e);
          if (!e.dir || !canGo(e, e.dir)) { e.dir = e.dir && canGo(e, e.dir) ? e.dir : null; if (!e.dir) return; }
        }
        if (!e.dir) return;
        const [dx, dy] = DIRS[e.dir];
        const cur = dx ? e.x : e.y, s = dx || dy;
        const tgt = s > 0 ? Math.floor(cur + 1e-6) + 1 : Math.ceil(cur - 1e-6) - 1;
        const d = Math.abs(tgt - cur);
        const m = Math.min(d, dist);
        if (dx) e.x += dx * m; else e.y += dy * m;
        dist -= m;
        if (Math.abs(e.x - Math.round(e.x)) < 1e-4) e.x = Math.round(e.x);
        if (Math.abs(e.y - Math.round(e.y)) < 1e-4) e.y = Math.round(e.y);
        if (e.x < -1) e.x += COLS + 1; if (e.x > COLS) e.x -= COLS + 1;
      }
    }

    /* ---------- Eingabe ---------- */
    function setWant(d) {
      want = d;
      if (pac && pac.dir && OPP[pac.dir] === d) pac.dir = d;
      if (phase === 'intro' || phase === 'ready') { }
    }
    let sx = 0, sy = 0, swiping = false;
    G.on(G.canvas, 'pointerdown', e => { sx = e.clientX; sy = e.clientY; swiping = true; });
    G.on(G.canvas, 'pointermove', e => {
      if (!swiping) return; const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.hypot(dx, dy) > 22) { setWant(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); sx = e.clientX; sy = e.clientY; }
    });
    G.on(G.canvas, 'pointerup', () => { swiping = false; });
    G.onKey = (k, down) => {
      if (!down) return;
      const m = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' }[k];
      if (m) setWant(m);
    };
    const c = G.controls, base = 'calc(18px + env(safe-area-inset-bottom))';
    [['up', '▲', { left: 'calc(50% - 32px)', bottom: 'calc(118px + env(safe-area-inset-bottom))' }], ['left', '◀', { left: 'calc(50% - 110px)', bottom: 'calc(64px + env(safe-area-inset-bottom))' }],
     ['right', '▶', { left: 'calc(50% + 46px)', bottom: 'calc(64px + env(safe-area-inset-bottom))' }], ['down', '▼', { left: 'calc(50% - 32px)', bottom: base }]].forEach(([id, lab, st]) => {
      const b = c.button(id, lab, Object.assign({ width: '64px', height: '64px', borderRadius: '18px' }, st));
      b.addEventListener('pointerdown', () => setWant(id));
    });

    /* ---------- Spiel-Logik ---------- */
    function ghostTarget(g) {
      const px = Math.round(pac.x), py = Math.round(pac.y), [dx, dy] = DIRS[pac.dir || 'left'];
      if (mode === 'scatter') return g.corner;
      if (g.name === 'Blinky') return [px, py];
      if (g.name === 'Pinky') return [px + dx * 4, py + dy * 4];
      if (g.name === 'Inky') { const b = ghosts[0]; return [2 * (px + dx * 2) - b.x, 2 * (py + dy * 2) - b.y]; }
      return Math.hypot(g.x - px, g.y - py) > 8 ? [px, py] : g.corner;
    }
    function chooseGhost(g) {
      const tx = Math.round(g.x), ty = Math.round(g.y);
      const opts = ['up', 'left', 'down', 'right'].filter(d => d !== OPP[g.dir] && canGo(g, d));
      if (!opts.length) { g.dir = OPP[g.dir]; return; }
      if (g.fr && g.state === 'active') { g.dir = opts[Math.floor(Math.random() * opts.length)]; return; }
      const [gx, gy] = g.state === 'eyes' ? [13.5, 11] : ghostTarget(g);
      let best = null, bd = 1e9;
      opts.forEach(d => { const [dx, dy] = DIRS[d], dd = (tx + dx - gx) ** 2 + (ty + dy - gy) ** 2; if (dd < bd) { bd = dd; best = d; } });
      g.dir = best;
    }
    function linear(g, tx, ty, sp, dt) {
      const dx = tx - g.x, dy = ty - g.y, d = Math.hypot(dx, dy), m = sp * dt;
      if (d <= m) { g.x = tx; g.y = ty; return true; }
      g.x += dx / d * m; g.y += dy / d * m; return false;
    }
    function step(dt) {
      const spd = 1 + (level - 1) * 0.06;
      // Modus-Wechsel
      if (fright > 0) { fright -= dt; if (fright <= 0) ghosts.forEach(g => g.fr = false); }
      else {
        modeT -= dt;
        if (modeT <= 0) { modeIdx++; mode = modeIdx % 2 ? 'chase' : 'scatter'; modeT = SCHED[Math.min(modeIdx, SCHED.length - 1)]; ghosts.forEach(g => { if (g.state === 'active') g.dir = OPP[g.dir]; }); }
      }
      // Pac
      const pacSp = 7.4 * spd * (fright > 0 ? 1.08 : 1);
      const moving = !!pac.dir;
      moveEnt(pac, pacSp * dt, e => { if (want && canGo(e, want)) e.dir = want; else if (e.dir && !canGo(e, e.dir)) e.dir = null; eat(); });
      if (moving) pac.mouth += dt * 16;
      eat();
      // Geister
      ghosts.forEach(g => {
        if (g.state === 'house') {
          g.timer -= dt; g.y = 14 + Math.sin(G.t * 6 + g.x) * 0.25;
          if (g.timer <= 0) g.state = 'leaving';
        } else if (g.state === 'leaving') {
          if (Math.abs(g.x - 13.5) > 0.01) linear(g, 13.5, 14, 4, dt);
          else if (linear(g, 13.5, 11, 4, dt)) { g.state = 'active'; g.dir = 'left'; }
        } else if (g.state === 'entering') {
          if (linear(g, 13.5, 14, 8, dt)) { g.state = 'leaving'; g.fr = false; }
        } else {
          const tunnel = Math.round(g.y) === 14 && (g.x < 5 || g.x > 22);
          let sp = g.state === 'eyes' ? 15 : g.fr ? 4.4 : tunnel ? 4 : 6.9 * spd;
          moveEnt(g, sp * dt, chooseGhost);
          if (g.state === 'eyes' && Math.abs(g.y - 11) < 0.05 && (Math.abs(g.x - 13) < 0.05 || Math.abs(g.x - 14) < 0.05)) {
            g.state = 'entering'; g.x = 13.5;
          }
        }
        // Kollision
        if ((g.state === 'active') && Math.hypot(g.x - pac.x, g.y - pac.y) < 0.65) {
          if (g.fr) {
            g.fr = false; g.state = 'eyes'; combo++; const pts = 200 * Math.pow(2, combo - 1); score += pts;
            popups.push({ x: g.x, y: g.y, t: 1, text: pts }); DA.sfx.play('eat'); DA.vibrate(30);
          } else if (phase === 'play') die();
        }
      });
      // Bonus
      if (bonus) { bonus.t -= dt; if (bonus.t <= 0) bonus = null; else if (Math.hypot(pac.x - 13.5, pac.y - 17) < 0.8) { score += 300 * level; popups.push({ x: 13.5, y: 17, t: 1.2, text: 300 * level }); DA.sfx.play('coin'); bonus = null; } }
    }
    function eat() {
      const tx = Math.round(pac.x), ty = Math.round(pac.y);
      if (Math.abs(pac.x - tx) > 0.3 || Math.abs(pac.y - ty) > 0.3) return;
      const v = dots[ty] && dots[ty][tx];
      if (!v) return;
      dots[ty][tx] = 0; eaten++;
      if (v === 1) { score += 10; if (eaten % 2) DA.sfx.play('chomp'); }
      else {
        score += 50; DA.sfx.play('power'); DA.vibrate(20);
        fright = Math.max(2, 7.5 - level * 0.8); combo = 0;
        ghosts.forEach(g => { if (g.state === 'active') { g.fr = true; g.dir = OPP[g.dir] || g.dir; } else if (g.state === 'house' || g.state === 'leaving') g.fr = true; });
      }
      if (eaten === 70 || eaten === 170) bonus = { t: 9 };
      if (eaten >= dotCount) { phase = 'clear'; phaseT = 2.2; DA.sfx.play('win'); }
    }
    function die() {
      phase = 'dying'; phaseT = 1.8; DA.sfx.play('die'); DA.vibrate([100, 50, 100]);
    }
    function gameOver() {
      phase = 'over';
      G.submitScore(score, level * 50);
      G.panel({
        top: '<div style="font-size:54px">👻</div>', title: 'Erwischt!',
        html: `<p>${DA.esc(pa.char === 'cpu' ? 'Die Geister' : (G.partner ? G.partner.name : 'Sie'))} hat dich geschnappt.</p><div class="big-num">${score.toLocaleString('de-DE')}</div><p id="pmRec">Level ${level} · speichere…</p>`,
        buttons: [{ label: '🔁 Nochmal', cls: 'primary', onClick: restart }, { label: 'Zurück zur Arena', onClick: () => G.exit() }],
      });
    }
    G.onNet('score_saved', m => {
      if (m.game !== 'pacman') return; const el = document.getElementById('pmRec');
      if (el) el.innerHTML = (m.record ? '🏆 <b style="color:#ffc21a">NEUER REKORD!</b>' : 'Rekord: ' + m.best) + ` · +${m.coins} 🪙`;
      if (m.record) DA.sfx.play('win');
    });
    function restart() { score = 0; lives = 3; level = 1; resetDots(); resetActors(); phase = 'ready'; phaseT = 2; G.panel(null); }

    /* ---------- Zeichnen ---------- */
    const px = x => MX + (x + 0.5) * T, py = y => MY + (y + 0.5) * T;
    let wallCanvas = null;
    function buildWalls() {
      const s = G.view.s * G.dpr, cv = document.createElement('canvas');
      cv.width = Math.ceil(LW * s); cv.height = Math.ceil(ROWS * T * s);
      const w = cv.getContext('2d'); w.scale(s, s);
      const isW = (x, y) => tile(x, y) === '#';
      w.lineCap = 'round'; w.lineJoin = 'round';
      // weiche Füllung
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (isW(x, y)) { w.fillStyle = '#140f4a'; w.fillRect(x * T, y * T, T, T); }
      // Neon-Kanten
      w.shadowColor = '#7c5cff'; w.shadowBlur = 8; w.strokeStyle = '#8a6bff'; w.lineWidth = 2.4;
      w.beginPath();
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (!isW(x, y)) continue; const X = x * T, Y = y * T;
        if (!isW(x, y - 1) && y > 0) { w.moveTo(X, Y + 2); w.lineTo(X + T, Y + 2); }
        if (!isW(x, y + 1) && y < ROWS - 1) { w.moveTo(X, Y + T - 2); w.lineTo(X + T, Y + T - 2); }
        if (!isW(x - 1, y) && x > 0) { w.moveTo(X + 2, Y); w.lineTo(X + 2, Y + T); }
        if (!isW(x + 1, y) && x < COLS - 1) { w.moveTo(X + T - 2, Y); w.lineTo(X + T - 2, Y + T); }
      }
      w.stroke();
      w.shadowBlur = 0; w.strokeStyle = '#ff4fa3'; w.lineWidth = 3; w.beginPath(); w.moveTo(13 * T, 12 * T + T / 2); w.lineTo(15 * T, 12 * T + T / 2); w.stroke();
      wallCanvas = cv;
    }
    G.onResize = () => { wallCanvas = null; };

    function render(t) {
      const v = G.fit(LW, LH, 'contain');
      ctx.fillStyle = '#05041a'; ctx.fillRect(-500, -500, LW + 1000, LH + 1000);
      if (!wallCanvas) buildWalls();
      const flash = phase === 'clear' && Math.floor(t * 6) % 2;
      ctx.save(); if (flash) ctx.filter = 'brightness(2.2)';
      ctx.drawImage(wallCanvas, MX, MY, LW, ROWS * T); ctx.restore();
      // Punkte
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const d = dots[y][x]; if (!d) continue;
        if (d === 1) { ctx.fillStyle = '#ffd9b0'; ctx.fillRect(px(x) - 2, py(y) - 2, 4, 4); }
        else if (Math.floor(t * 4) % 2 || phase !== 'play') { ctx.fillStyle = '#ffb3d9'; ctx.beginPath(); ctx.arc(px(x), py(y), 6, 0, 7); ctx.fill(); }
      }
      if (bonus) { ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💗', px(13.5), py(17) + Math.sin(t * 5) * 2); }
      // Geister
      if (phase !== 'dying' || phaseT > 1.4) ghosts.forEach(g => {
        const md = g.state === 'eyes' || g.state === 'entering' ? 'eyes' : g.fr ? (fright < 2 && Math.floor(t * 8) % 2 ? 'flash' : 'fright') : 'normal';
        DA.drawGhost(ctx, px(g.x), py(g.y), T * 0.92, g.color, pa.char, pa.outfit, md, t);
      });
      // Pac
      if (phase === 'dying') {
        const k = DA.clamp(1 - (phaseT - 0.2) / 1.6, 0, 1);
        if (k < 1) DA.drawPac(ctx, me, px(pac.x), py(pac.y), T * 0.95, 0.2 + k * 5.9, -Math.PI / 2);
      } else {
        const ang = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[pac.dir || want || 'left'];
        const mouth = 0.15 + Math.abs(Math.sin(pac.mouth)) * 0.9;
        DA.drawPac(ctx, me, px(pac.x), py(pac.y), T * 0.95, mouth, ang);
      }
      popups.forEach(p => { p.t -= 1 / 60; ctx.globalAlpha = Math.max(0, p.t); ctx.fillStyle = '#3de7ff'; ctx.font = '900 14px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.text, px(p.x), py(p.y) - (1 - p.t) * 20); });
      ctx.globalAlpha = 1; popups = popups.filter(p => p.t > 0);
      // Kopfzeile im Canvas
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.font = '22px "Lilita One", sans-serif';
      ctx.fillText(score.toLocaleString('de-DE'), 60, 30);
      ctx.textAlign = 'right'; ctx.font = '900 12px Nunito, sans-serif'; ctx.fillStyle = '#cbbcff'; ctx.fillText('LEVEL ' + level, LW - 64, 22);
      for (let i = 0; i < lives; i++) DA.drawPac(ctx, me, LW - 76 - i * 24, 40, 9, 0.6, 0);
      // Mitte
      ctx.textAlign = 'center';
      if (phase === 'ready' || phase === 'intro') { ctx.font = '26px "Lilita One", sans-serif'; ctx.fillStyle = '#ffd23f'; ctx.fillText('READY!', px(13.5), py(17)); }
      if (phase === 'clear') { ctx.font = '24px "Lilita One", sans-serif'; ctx.fillStyle = '#3de7ff'; ctx.fillText('LEVEL GESCHAFFT!', px(13.5), py(17)); }
      // Unten: Wer jagt wen
      ctx.font = '900 13px Nunito, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.fillText('Wischen oder Pfeile – friss alles!', LW / 2, MY + ROWS * T + 18);
    }

    function hud() { G.hud(''); }
    hud();
    G.panel({
      top: `<canvas id="pmIntro" width="320" height="140" style="width:240px;height:105px"></canvas>`,
      title: 'Geister-Jagd', text: `Du bist der Fresser – ${DA.esc(G.partner ? G.partner.name : 'sie')} ist überall als Geist hinter dir her! 👻`,
      buttons: [{ label: '▶ Los geht\'s', cls: 'primary', onClick: () => { G.panel(null); phase = 'ready'; phaseT = 2.2; DA.sfx.play('go'); } }],
      onMount: () => {
        const cv = document.getElementById('pmIntro'), x = cv.getContext('2d');
        DA.drawPac(x, me, 60, 70, 46, 0.7, 0);
        ['#ff3b5c', '#ff8fd0', '#3de7ff'].forEach((c, i) => DA.drawGhost(x, 150 + i * 62, 72, 28, c, pa.char, pa.outfit, 'normal', i));
      },
    });

    G.loop(dt => {
      if (phase === 'ready') { phaseT -= dt; if (phaseT <= 0) phase = 'play'; }
      else if (phase === 'play') step(dt);
      else if (phase === 'dying') {
        phaseT -= dt;
        if (phaseT <= 0) { lives--; if (lives <= 0) gameOver(); else { resetActors(); phase = 'ready'; phaseT = 1.6; } }
      } else if (phase === 'clear') {
        phaseT -= dt; if (phaseT <= 0) { level++; resetDots(); resetActors(); phase = 'ready'; phaseT = 1.8; }
      }
      render(G.t);
    });
  },
};
