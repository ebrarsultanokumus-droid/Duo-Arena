/* DUO ARENA – Zeichnen der Charaktere, Outfits und Effekte */
'use strict';
(function () {
  const ANCH = {
    a: { fx: 0.24, ey: 0.0, span: 0.5, top: -0.68, hx: 0.12, earL: -0.78, earR: 0.84, skin: '#f6c7a5', shirt: '#55663a', pants: '#4b5b30', shoes: '#a5aa94', hair: '#111' },
    b: { fx: -0.14, ey: 0.11, span: 0.46, top: -0.78, hx: -0.02, earL: -0.92, earR: 0.92, skin: '#d99a74', shirt: '#f4f2f7', pants: '#4f74a8', shoes: '#ff8fc0', hair: '#3a2a20' },
    cpu: { fx: 0, ey: -0.05, span: 0.6, top: -0.9, hx: 0, earL: -0.95, earR: 0.95, skin: '#b8c4ff', shirt: '#5b6cff', pants: '#2c3470', shoes: '#cfd6ff' },
  };
  DA.anchor = c => ANCH[c] || ANCH.b;
  const SHIRTS = { pink: '#ff5fae', red: '#e8344a', blue: '#3557ff', mint: '#41dcae', black: '#24212e' };

  DA.shirtFill = function (ctx, char, outfit, x, y, w, h) {
    const s = (outfit && outfit.shirt) || 'default';
    if (s === 'gold') { const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#fff3a0'); g.addColorStop(.5, '#ffc21a'); g.addColorStop(1, '#b87400'); return g; }
    if (s === 'galaxy') { const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#2a0f6b'); g.addColorStop(.5, '#7c3cff'); g.addColorStop(1, '#ff4fa3'); return g; }
    return SHIRTS[s] || DA.anchor(char).shirt;
  };
  DA.shirtColor = function (char, outfit) {
    const s = (outfit && outfit.shirt) || 'default';
    if (s === 'gold') return '#ffc21a'; if (s === 'galaxy') return '#7c3cff';
    return SHIRTS[s] || DA.anchor(char).shirt;
  };

  /* ---------- Hüte ---------- */
  function star(ctx, x, y, r, n = 5, inner = 0.45) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r * inner : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath();
  }
  function heart(ctx, x, y, s) {
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.45, y - s * 1.05, x, y - s * 0.4);
    ctx.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35); ctx.closePath();
  }
  DA.shapes = { star, heart };

  function drawHat(ctx, id, x, y, r, A, t) {
    const cx = x + A.hx * r, ty = y + A.top * r, w = r * 1.35;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.5, r * 0.05); ctx.strokeStyle = '#1a1030';
    if (id === 'cap') {
      ctx.fillStyle = '#ff3b5c';
      ctx.beginPath(); ctx.ellipse(cx, ty + w * 0.16, w * 0.46, w * 0.36, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d61f45'; ctx.beginPath(); ctx.ellipse(cx + w * 0.38, ty + w * 0.15, w * 0.36, w * 0.08, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, ty - w * 0.2, w * 0.05, 0, 7); ctx.fill();
      ctx.font = `900 ${w * 0.2}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('DA', cx - w * 0.04, ty + w * 0.06);
    } else if (id === 'party') {
      ctx.save(); ctx.translate(cx, ty + w * 0.12); ctx.rotate(-0.15);
      ctx.beginPath(); ctx.moveTo(-w * 0.27, 0); ctx.lineTo(w * 0.27, 0); ctx.lineTo(0, -w * 0.7); ctx.closePath();
      const g = ctx.createLinearGradient(-w * .3, 0, w * .3, -w * .7); g.addColorStop(0, '#3de7ff'); g.addColorStop(1, '#7c5cff'); ctx.fillStyle = g; ctx.fill(); ctx.stroke();
      ctx.save(); ctx.clip(); ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = w * 0.07;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-w, -w * 0.12 - i * w * 0.17); ctx.lineTo(w, -w * 0.02 - i * w * 0.17 - w * .1); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = '#ff4fa3'; ctx.beginPath(); ctx.arc(0, -w * 0.72, w * 0.09, 0, 7); ctx.fill(); ctx.stroke();
      ctx.restore();
    } else if (id === 'headphones') {
      ctx.strokeStyle = '#1a1030'; ctx.lineWidth = r * 0.16;
      ctx.beginPath(); ctx.ellipse(x + A.hx * r, y + r * 0.05, (A.earR - A.earL) * r * 0.5, r * 0.98, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      ctx.strokeStyle = '#ff4fa3'; ctx.lineWidth = r * 0.09; ctx.stroke();
      [A.earL, A.earR].forEach(ex => {
        ctx.fillStyle = '#ff4fa3'; ctx.strokeStyle = '#1a1030'; ctx.lineWidth = r * 0.05;
        ctx.beginPath(); ctx.ellipse(x + ex * r * 0.98, y + r * 0.08, r * 0.17, r * 0.27, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x + ex * r * 0.98, y + r * 0.08, r * 0.07, r * 0.13, 0, 0, 7); ctx.fill();
      });
    } else if (id === 'flowers') {
      const cols = ['#ff7eb6', '#ffd23f', '#ffffff', '#b28bff', '#ff7eb6', '#7cf0c8', '#ffd23f'];
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (1.12 + i * 0.127), fx = cx + Math.cos(a) * w * 0.52, fy = ty + w * 0.38 + Math.sin(a) * w * 0.4, s = w * 0.085;
        ctx.fillStyle = '#3ba55c'; ctx.beginPath(); ctx.ellipse(fx + s, fy, s * 0.9, s * 0.45, 0.5, 0, 7); ctx.fill();
        ctx.fillStyle = cols[i];
        for (let k = 0; k < 5; k++) { const b = k / 5 * Math.PI * 2 + t; ctx.beginPath(); ctx.arc(fx + Math.cos(b) * s * 0.7, fy + Math.sin(b) * s * 0.7, s * 0.55, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#ffb000'; ctx.beginPath(); ctx.arc(fx, fy, s * 0.45, 0, 7); ctx.fill();
      }
    } else if (id === 'crown') {
      const by = ty + w * 0.14, h = w * 0.42, bw = w * 0.36;
      const g = ctx.createLinearGradient(0, by - h, 0, by); g.addColorStop(0, '#fff3a0'); g.addColorStop(1, '#f0a400');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(cx - bw, by); ctx.lineTo(cx - bw, by - h * 0.6); ctx.lineTo(cx - bw * 0.5, by - h * 0.25); ctx.lineTo(cx, by - h);
      ctx.lineTo(cx + bw * 0.5, by - h * 0.25); ctx.lineTo(cx + bw, by - h * 0.6); ctx.lineTo(cx + bw, by); ctx.closePath(); ctx.fill(); ctx.stroke();
      [[-bw, -h * 0.62, '#ff3b5c'], [0, -h * 1.02, '#3de7ff'], [bw, -h * 0.62, '#ff3b5c']].forEach(([dx, dy, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx + dx, by + dy, w * 0.055, 0, 7); ctx.fill(); ctx.stroke(); });
      ctx.fillStyle = '#7c5cff'; ctx.beginPath(); ctx.arc(cx, by - h * 0.22, w * 0.06, 0, 7); ctx.fill();
    } else if (id === 'halo') {
      ctx.shadowColor = '#fff38a'; ctx.shadowBlur = r * 0.4;
      ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = r * 0.1;
      ctx.beginPath(); ctx.ellipse(cx, ty - w * 0.14 + Math.sin(t * 3) * r * 0.04, w * 0.34, w * 0.1, 0, 0, 7); ctx.stroke();
    } else if (id === 'horns') {
      [-1, 1].forEach(s => {
        ctx.fillStyle = '#e8234a';
        ctx.beginPath(); ctx.moveTo(cx + s * w * 0.18, ty + w * 0.16); ctx.quadraticCurveTo(cx + s * w * 0.2, ty - w * 0.15, cx + s * w * 0.42, ty - w * 0.3);
        ctx.quadraticCurveTo(cx + s * w * 0.36, ty - w * 0.02, cx + s * w * 0.36, ty + w * 0.14); ctx.closePath(); ctx.fill(); ctx.stroke();
      });
    }
    ctx.restore();
  }

  function drawGlasses(ctx, id, x, y, r, A) {
    const gx = x + A.fx * r, gy = y + A.ey * r, sp = A.span * r, lw = sp * 0.42;
    ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = '#120a24'; ctx.lineWidth = Math.max(1.5, r * 0.045);
    if (id === 'shades') {
      ctx.fillStyle = '#120a24';
      [-1, 1].forEach(s => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(gx + s * sp / 2 - lw, gy - lw * 0.62, lw * 2, lw * 1.25, lw * 0.4) : ctx.rect(gx + s * sp / 2 - lw, gy - lw * 0.62, lw * 2, lw * 1.25); ctx.fill(); });
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      [-1, 1].forEach(s => { ctx.beginPath(); ctx.ellipse(gx + s * sp / 2 - lw * 0.4, gy - lw * 0.2, lw * 0.35, lw * 0.15, -0.4, 0, 7); ctx.fill(); });
      ctx.beginPath(); ctx.moveTo(gx - sp / 2 + lw * .8, gy - lw * .35); ctx.lineTo(gx + sp / 2 - lw * .8, gy - lw * .35); ctx.stroke();
    } else if (id === 'hearts') {
      [-1, 1].forEach(s => { heart(ctx, gx + s * sp / 2, gy + lw * 0.15, lw * 1.05); ctx.fillStyle = 'rgba(255,60,140,.85)'; ctx.fill(); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(gx - sp / 2 + lw * .9, gy - lw * .3); ctx.lineTo(gx + sp / 2 - lw * .9, gy - lw * .3); ctx.stroke();
    } else if (id === 'stars') {
      [-1, 1].forEach(s => { star(ctx, gx + s * sp / 2, gy, lw * 1.15); ctx.fillStyle = 'rgba(255,210,40,.9)'; ctx.fill(); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(gx - sp / 2 + lw * .9, gy - lw * .1); ctx.lineTo(gx + sp / 2 - lw * .9, gy - lw * .1); ctx.stroke();
    } else if (id === 'nerd') {
      ctx.lineWidth = Math.max(2, r * 0.07); ctx.fillStyle = 'rgba(200,230,255,.2)';
      [-1, 1].forEach(s => { ctx.beginPath(); ctx.arc(gx + s * sp / 2, gy, lw * 0.9, 0, 7); ctx.fill(); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(gx - sp / 2 + lw * .9, gy); ctx.quadraticCurveTo(gx, gy - lw * .4, gx + sp / 2 - lw * .9, gy); ctx.stroke();
    }
    ctx.restore();
  }

  function drawRobot(ctx, x, y, r, t) {
    ctx.save();
    const g = ctx.createRadialGradient(x - r * .3, y - r * .4, r * .1, x, y, r); g.addColorStop(0, '#e9ecff'); g.addColorStop(1, '#7a86c9');
    ctx.fillStyle = g; ctx.strokeStyle = '#1a1030'; ctx.lineWidth = r * 0.07;
    ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1a1030'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - r * .6, y - r * .3, r * 1.2, r * .5, r * .25) : ctx.rect(x - r * .6, y - r * .3, r * 1.2, r * .5); ctx.fill();
    ctx.fillStyle = '#3de7ff'; ctx.shadowColor = '#3de7ff'; ctx.shadowBlur = r * .3;
    const blink = (Math.sin(t * 2.3) > 0.97) ? 0.15 : 1;
    [-1, 1].forEach(s => { ctx.beginPath(); ctx.ellipse(x + s * r * .27, y - r * .05, r * .11, r * .11 * blink, 0, 0, 7); ctx.fill(); });
    ctx.shadowBlur = 0; ctx.strokeStyle = '#1a1030'; ctx.lineWidth = r * .06;
    ctx.beginPath(); ctx.moveTo(x, y - r * .85); ctx.lineTo(x, y - r * 1.1); ctx.stroke();
    ctx.fillStyle = '#ff4fa3'; ctx.beginPath(); ctx.arc(x, y - r * 1.15, r * .1, 0, 7); ctx.fill();
    ctx.restore();
  }

  /** Kopf eines Charakters samt Outfit zeichnen. */
  DA.drawHead = function (ctx, char, x, y, r, outfit, o) {
    outfit = outfit || {}; o = o || {};
    const A = DA.anchor(char), t = o.t != null ? o.t : performance.now() / 1000;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (o.rot) { ctx.translate(x, y); ctx.rotate(o.rot); ctx.translate(-x, -y); }
    if (o.flip) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
    if (o.shadow !== false && r > 8) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.92, r * 0.55, r * 0.12, 0, 0, 7); ctx.fill(); }
    if (char === 'cpu') drawRobot(ctx, x, y, r, t);
    else {
      const im = DA.img[char];
      if (outfit.hat === 'halo') drawHat(ctx, 'halo', x, y, r, A, t);
      if (im) ctx.drawImage(im, x - r, y - r, r * 2, r * 2);
      else { ctx.fillStyle = A.skin; ctx.beginPath(); ctx.arc(x, y, r * .8, 0, 7); ctx.fill(); }
    }
    if (o.tint) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = o.tint; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (outfit.glasses && outfit.glasses !== 'none') drawGlasses(ctx, outfit.glasses, x, y, r, A);
    if (outfit.hat && outfit.hat !== 'none' && outfit.hat !== 'halo') drawHat(ctx, outfit.hat, x, y, r, A, t);
    if (o.angry) {
      ctx.strokeStyle = '#1a0a10'; ctx.lineWidth = r * 0.09; ctx.lineCap = 'round';
      const gx = x + A.fx * r, gy = y + A.ey * r - A.span * r * 0.55, s = A.span * r * 0.5;
      ctx.beginPath(); ctx.moveTo(gx - s - s * .5, gy - s * .25); ctx.lineTo(gx - s * .35, gy + s * .15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(gx + s + s * .5, gy - s * .25); ctx.lineTo(gx + s * .35, gy + s * .15); ctx.stroke();
    }
    ctx.restore();
  };

  /** Runder Avatar in ein Canvas-Element. */
  DA.drawAvatar = function (canvas, char, outfit, color) {
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save(); ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2, 0, 7); ctx.clip();
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, color || (char === 'a' ? '#ff79b9' : '#8f73ff')); g.addColorStop(1, '#2a175e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    DA.drawHead(ctx, char, w / 2, h * 0.56, w * 0.5, outfit, { shadow: false, t: 0 });
    ctx.restore();
  };

  /** Seitlicher Körper (Füße bei y). h = Gesamthöhe des Körpers ohne Kopf. */
  DA.drawBody = function (ctx, char, outfit, x, y, h, pose) {
    pose = pose || {}; const A = DA.anchor(char), f = pose.facing || 1, ph = pose.run || 0, kick = pose.kick || 0;
    const legL = h * 0.45, hip = y - legL, sh = y - h, tw = h * 0.42;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const leg = (ang, front) => {
      const kx = x + Math.sin(ang) * legL * 0.5 * f, ky = hip + Math.cos(ang) * legL * 0.5;
      const fx = kx + Math.sin(ang * 0.6) * legL * 0.5 * f, fy = Math.min(y, ky + legL * 0.5);
      ctx.strokeStyle = '#1a1030'; ctx.lineWidth = h * 0.17; ctx.beginPath(); ctx.moveTo(x, hip); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.strokeStyle = front ? A.pants : shade(A.pants, -20); ctx.lineWidth = h * 0.12; ctx.stroke();
      ctx.fillStyle = A.shoes; ctx.strokeStyle = '#1a1030'; ctx.lineWidth = h * 0.03;
      ctx.beginPath(); ctx.ellipse(fx + f * h * 0.05, fy, h * 0.11, h * 0.065, 0, 0, 7); ctx.fill(); ctx.stroke();
    };
    const sw = Math.sin(ph) * 0.8;
    leg(-sw * 0.9, false);
    leg(kick > 0 ? -kick * 1.6 : sw * 0.9, true);
    // Oberkörper
    ctx.fillStyle = DA.shirtFill(ctx, char, outfit, x - tw / 2, sh, tw, h * 0.6);
    ctx.strokeStyle = '#1a1030'; ctx.lineWidth = h * 0.03;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - tw / 2, sh, tw, h * 0.58, tw * 0.3) : ctx.rect(x - tw / 2, sh, tw, h * 0.58); ctx.fill(); ctx.stroke();
    if (outfit && outfit.shirt === 'galaxy') { ctx.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x - tw * .3 + (i * 37 % 10) / 10 * tw * .6, sh + h * (0.1 + (i * 53 % 10) / 10 * 0.4), h * 0.012, 0, 7); ctx.fill(); } }
    // Arme
    const arm = (ang, back) => {
      ctx.strokeStyle = '#1a1030'; ctx.lineWidth = h * 0.12; const ax = x, ay = sh + h * 0.1;
      const ex = ax + Math.sin(ang) * h * 0.35 * f, ey = ay + Math.cos(ang) * h * 0.35;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = back ? shade(DA.shirtColor(char, outfit), -25) : DA.shirtColor(char, outfit); ctx.lineWidth = h * 0.08; ctx.stroke();
      ctx.fillStyle = A.skin; ctx.beginPath(); ctx.arc(ex, ey, h * 0.05, 0, 7); ctx.fill();
    };
    arm(sw + (pose.armUp || 0), true); arm(-sw - (pose.armUp || 0), false);
    ctx.restore();
  };
  function shade(hex, amt) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    const n = parseInt(hex.slice(1), 16), c = v => DA.clamp(v + amt, 0, 255);
    return '#' + ((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, '0');
  }
  DA.shade = shade;

  /** Ganzer Charakter: Körper + großer Kopf (für Shop & Spiele). */
  DA.drawChar = function (ctx, char, outfit, x, y, size, pose) {
    pose = pose || {};
    const bodyH = size * 0.55, headR = size * 0.36;
    DA.drawBody(ctx, char, outfit, x, y, bodyH, pose);
    DA.drawHead(ctx, char, x + (pose.headDx || 0), y - bodyH - headR * 0.75 + (pose.bob || 0), headR, outfit, { shadow: false, t: pose.t, angry: pose.angry });
  };

  /* ---------- Spuren (Trails) ---------- */
  DA.Trail = function (kind) {
    this.kind = kind || 'none'; this.p = [];
  };
  DA.Trail.prototype.emit = function (x, y, scale) {
    if (this.kind === 'none') return;
    const s = scale || 1, k = this.kind;
    const n = k === 'rainbow' ? 1 : 2;
    for (let i = 0; i < n; i++) this.p.push({ x: x + DA.rand(-6, 6) * s, y: y + DA.rand(-6, 6) * s, vx: DA.rand(-20, 20) * s, vy: DA.rand(-40, 10) * s, life: 1, s, hue: (performance.now() / 6) % 360 });
    if (this.p.length > 160) this.p.splice(0, this.p.length - 160);
  };
  DA.Trail.prototype.update = function (dt, dx, dy) {
    for (const q of this.p) { q.x += (q.vx + (dx || 0)) * dt; q.y += (q.vy + (dy || 0)) * dt; q.life -= dt * 1.6; }
    this.p = this.p.filter(q => q.life > 0);
  };
  DA.Trail.prototype.draw = function (ctx) {
    const k = this.kind;
    ctx.save();
    for (const q of this.p) {
      ctx.globalAlpha = Math.max(0, q.life);
      if (k === 'sparkle') { ctx.fillStyle = q.life > .6 ? '#fff' : '#ffe680'; star(ctx, q.x, q.y, 6 * q.s * q.life + 1, 4, 0.35); ctx.fill(); }
      else if (k === 'hearts') { ctx.fillStyle = '#ff4fa3'; heart(ctx, q.x, q.y, 6 * q.s); ctx.fill(); }
      else if (k === 'fire') { const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 10 * q.s); g.addColorStop(0, '#fff6a0'); g.addColorStop(.4, '#ff9a1a'); g.addColorStop(1, 'rgba(255,40,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, 10 * q.s, 0, 7); ctx.fill(); }
      else if (k === 'rainbow') { ctx.fillStyle = `hsl(${q.hue},100%,60%)`; ctx.beginPath(); ctx.arc(q.x, q.y, 7 * q.s * q.life + 1, 0, 7); ctx.fill(); }
    }
    ctx.restore();
  };

  /* ---------- Geist mit Gesicht ---------- */
  DA.drawGhost = function (ctx, x, y, r, color, char, outfit, mode, t) {
    // mode: normal | fright | flash | eyes
    ctx.save();
    if (mode !== 'eyes') {
      const body = mode === 'fright' ? '#2448ff' : mode === 'flash' ? '#f4f4ff' : color;
      ctx.fillStyle = body; ctx.strokeStyle = '#0a0620'; ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath(); ctx.arc(x, y - r * 0.1, r, Math.PI, 0);
      const by = y + r * 0.95, n = 4;
      ctx.lineTo(x + r, by);
      for (let i = 0; i < n; i++) {
        const x1 = x + r - (i + 0.5) * (2 * r / n), x2 = x + r - (i + 1) * (2 * r / n);
        ctx.quadraticCurveTo(x1, by - r * 0.35 + Math.sin(t * 12 + i) * r * 0.12, x2, by);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // Gesicht
      ctx.save(); ctx.beginPath(); ctx.arc(x, y - r * 0.12, r * 0.82, 0, 7); ctx.clip();
      DA.drawHead(ctx, char, x, y - r * 0.02, r * 1.0, outfit, { shadow: false, t, tint: mode === 'fright' ? 'rgba(40,70,255,.55)' : mode === 'flash' ? 'rgba(255,255,255,.55)' : null, angry: mode === 'normal' });
      ctx.restore();
      ctx.strokeStyle = body; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.arc(x, y - r * 0.12, r * 0.84, 0, 7); ctx.stroke();
      if (mode === 'fright' || mode === 'flash') {
        ctx.strokeStyle = mode === 'fright' ? '#fff' : '#ff3355'; ctx.lineWidth = r * 0.1;
        ctx.beginPath(); for (let i = 0; i <= 6; i++) ctx.lineTo(x - r * 0.45 + i * r * 0.15, y + r * 0.45 + (i % 2 ? -1 : 1) * r * 0.08); ctx.stroke();
      }
    } else {
      [-1, 1].forEach(s => {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x + s * r * 0.35, y - r * 0.1, r * 0.28, r * 0.36, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#2448ff'; ctx.beginPath(); ctx.arc(x + s * r * 0.35, y - r * 0.05, r * 0.15, 0, 7); ctx.fill();
      });
    }
    ctx.restore();
  };

  /* ---------- Shop-Icons ---------- */
  DA.drawItemIcon = function (canvas, slot, id, char) {
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height; ctx.clearRect(0, 0, w, h);
    const A = DA.anchor(char);
    if (slot === 'hat') {
      if (id === 'none') return noneIcon(ctx, w, h);
      // Kopf leicht angedeutet
      ctx.globalAlpha = .35; DA.drawHead(ctx, char, w / 2, h * 0.78, w * 0.42, {}, { shadow: false, t: 0 }); ctx.globalAlpha = 1;
      if (id === 'halo') drawHat(ctx, 'halo', w / 2, h * 0.78, w * 0.42, A, 0); else drawHat(ctx, id, w / 2, h * 0.78, w * 0.42, A, 0);
    } else if (slot === 'glasses') {
      if (id === 'none') return noneIcon(ctx, w, h);
      drawGlasses(ctx, id, w / 2 - A.fx * w * 0.8, h / 2 - A.ey * w * 0.8, w * 0.8, A);
    } else if (slot === 'shirt') {
      ctx.fillStyle = DA.shirtFill(ctx, char, { shirt: id }, w * .2, h * .2, w * .6, h * .6); ctx.strokeStyle = '#1a1030'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(w * .35, h * .2); ctx.lineTo(w * .15, h * .32); ctx.lineTo(w * .22, h * .48); ctx.lineTo(w * .3, h * .44); ctx.lineTo(w * .3, h * .82); ctx.lineTo(w * .7, h * .82);
      ctx.lineTo(w * .7, h * .44); ctx.lineTo(w * .78, h * .48); ctx.lineTo(w * .85, h * .32); ctx.lineTo(w * .65, h * .2); ctx.quadraticCurveTo(w * .5, h * .32, w * .35, h * .2); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (slot === 'trail') {
      if (id === 'none') return noneIcon(ctx, w, h);
      const tr = new DA.Trail(id);
      for (let i = 0; i < 26; i++) { tr.p.push({ x: w * 0.12 + i * w * 0.03, y: h / 2 + Math.sin(i * 0.6) * h * 0.15, vx: 0, vy: 0, life: 0.3 + i / 30, s: w / 70, hue: i * 14 }); }
      tr.draw(ctx);
    }
  };
  function noneIcon(ctx, w, h) {
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.28, 0, 7); ctx.moveTo(w * .3, h * .7); ctx.lineTo(w * .7, h * .3); ctx.stroke();
  }
})();
