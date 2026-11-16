/**
 * ==========================================================================
 * LITO BALL - REWORK PROCEDURAL: CHUTE DE PISTOLA (js/skills/pistolShot.js)
 * ==========================================================================
 * Animação 100% procedural em Canvas 2D (sem dependência de sprites externos):
 *  - Engatilhamento rápido com brilho no cão/tambor
 *  - Revólver vetorial estilizado com recuo realista (kickback + torque)
 *  - Muzzle flash em camadas (núcleo branco, estrela dourada e aura laranja)
 *  - Onda de choque direcional, cápsula ejetada girando e fumaça sutil
 *  - Cone supersônico e faíscas balísticas acompanhando a bola
 */
'use strict';

const pistolAnimations = [];
const PISTOL_ANIM_DURATION = 0.56;

function drawRoundedRectPath(renderCtx, x, y, w, h, r) {
  if (typeof renderCtx.roundRect === 'function') {
    renderCtx.roundRect(x, y, w, h, r);
    return;
  }
  const radius = Math.min(r, w * 0.5, h * 0.5);
  renderCtx.moveTo(x + radius, y);
  renderCtx.lineTo(x + w - radius, y);
  renderCtx.quadraticCurveTo(x + w, y, x + w, y + radius);
  renderCtx.lineTo(x + w, y + h - radius);
  renderCtx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  renderCtx.lineTo(x + radius, y + h);
  renderCtx.quadraticCurveTo(x, y + h, x, y + h - radius);
  renderCtx.lineTo(x, y + radius);
  renderCtx.quadraticCurveTo(x, y, x + radius, y);
}

function playPistolAnimation(actor, dirX, dirY) {
  if (!actor || !Number.isFinite(actor.x) || !Number.isFinite(actor.y)) return;
  const len = Math.hypot(dirX, dirY) || 1;
  const nx = dirX / len;
  const ny = dirY / len;
  const angle = Math.atan2(ny, nx);
  const flipY = Math.cos(angle) < 0 ? -1 : 1;
  const side = -actor.radius * 1.32 * flipY;
  const forward = actor.radius * 0.55;
  const perpX = -Math.sin(angle);
  const perpY = Math.cos(angle);

  const anchorX = actor.x + nx * forward + perpX * side;
  const anchorY = actor.y + ny * forward + perpY * side;
  const muzzleX = anchorX + nx * 36;
  const muzzleY = anchorY + ny * 36;

  // Faíscas incandescentes lançadas em cone pela boca do cano
  const muzzleSparks = [];
  for (let i = 0; i < 18; i++) {
    const spread = (Math.random() - 0.5) * 0.92;
    const sparkAngle = angle + spread;
    const speed = 150 + Math.random() * 270;
    muzzleSparks.push({
      x: muzzleX,
      y: muzzleY,
      vx: Math.cos(sparkAngle) * speed,
      vy: Math.sin(sparkAngle) * speed,
      life: 1,
      decay: 2.3 + Math.random() * 2.1,
      size: 1.7 + Math.random() * 2.4,
      color: i % 3 === 0 ? '#ffffff' : i % 2 === 0 ? '#fde047' : '#f97316'
    });
  }

  // Cápsula/estojo dourado ejetado do tambor para trás e para cima
  const ejectSign = -flipY;
  const shellAngle = angle - Math.PI * 0.62 * ejectSign + (Math.random() - 0.5) * 0.25;
  const shellSpeed = 78 + Math.random() * 44;
  const shell = {
    x: anchorX + nx * 4 + perpX * (side * 0.15),
    y: anchorY + ny * 4 + perpY * (side * 0.15),
    vx: Math.cos(shellAngle) * shellSpeed,
    vy: Math.sin(shellAngle) * shellSpeed - 55,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() > 0.5 ? 1 : -1) * (13 + Math.random() * 8),
    life: 1
  };

  // Baforadas sutis de fumaça pós-disparo
  const smokePuffs = [];
  for (let i = 0; i < 5; i++) {
    const driftAngle = angle + (Math.random() - 0.5) * 0.7;
    const driftSpeed = 24 + Math.random() * 38;
    smokePuffs.push({
      x: muzzleX + nx * (i * 3),
      y: muzzleY + ny * (i * 3),
      vx: Math.cos(driftAngle) * driftSpeed,
      vy: Math.sin(driftAngle) * driftSpeed - 16 - Math.random() * 14,
      radius: 4 + Math.random() * 4,
      grow: 18 + Math.random() * 12,
      delay: 0.06 + i * 0.025,
      alpha: 0.42
    });
  }

  for (let i = 0; i < 12; i++) {
    addImpactSpark(muzzleX, muzzleY, i % 2 === 0 ? '#fde047' : '#fb923c', 1, 1.2);
  }

  pistolAnimations.push({
    x: anchorX,
    y: anchorY,
    muzzleX,
    muzzleY,
    dirX: nx,
    dirY: ny,
    angle,
    flipY,
    totalElapsed: 0,
    muzzleSparks,
    shell,
    smokePuffs
  });

  ball.pistolTrailTimer = 0.85;
  ball.pistolShotTrail.length = 0;
}

function updatePistolAnimations(dt) {
  for (let i = pistolAnimations.length - 1; i >= 0; i--) {
    const anim = pistolAnimations[i];
    anim.totalElapsed += dt;

    for (let s = anim.muzzleSparks.length - 1; s >= 0; s--) {
      const spark = anim.muzzleSparks[s];
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vx *= 0.91;
      spark.vy *= 0.91;
      spark.life -= spark.decay * dt;
      if (spark.life <= 0) anim.muzzleSparks.splice(s, 1);
    }

    if (anim.shell) {
      anim.shell.x += anim.shell.vx * dt;
      anim.shell.y += anim.shell.vy * dt;
      anim.shell.vy += 290 * dt;
      anim.shell.vx *= 0.985;
      anim.shell.rot += anim.shell.vrot * dt;
      anim.shell.life = Math.max(0, 1 - anim.totalElapsed / PISTOL_ANIM_DURATION);
    }

    for (const puff of anim.smokePuffs) {
      if (anim.totalElapsed < puff.delay) continue;
      puff.x += puff.vx * dt;
      puff.y += puff.vy * dt;
      puff.vx *= 0.95;
      puff.vy *= 0.95;
      puff.radius += puff.grow * dt;
      puff.alpha = Math.max(0, puff.alpha - dt * 0.92);
    }

    if (anim.totalElapsed >= PISTOL_ANIM_DURATION) {
      pistolAnimations.splice(i, 1);
    }
  }
}

function clearPistolAnimations() {
  pistolAnimations.length = 0;
}

function drawProceduralRevolver(renderCtx, cockRatio, muzzleHeat) {
  // Pivot (0, 0) no centro da armação/tambor, cano apontando para +X
  renderCtx.save();
  renderCtx.lineJoin = 'round';
  renderCtx.lineCap = 'round';

  // 1. Cão (hammer) atrás do tambor
  renderCtx.save();
  renderCtx.translate(-8, -5);
  renderCtx.rotate(-0.18 - cockRatio * 0.55);
  renderCtx.fillStyle = '#94a3b8';
  renderCtx.strokeStyle = '#0f172a';
  renderCtx.lineWidth = 1.6;
  renderCtx.beginPath();
  renderCtx.moveTo(0, 0);
  renderCtx.lineTo(-7, -7);
  renderCtx.lineTo(-4, -9);
  renderCtx.lineTo(3, -3);
  renderCtx.closePath();
  renderCtx.fill();
  renderCtx.stroke();
  renderCtx.restore();

  // 2. Cabo anatômico (madeira escura / âmbar com base metálica)
  const gripGrad = renderCtx.createLinearGradient(-18, 2, -8, 22);
  gripGrad.addColorStop(0, '#92400e');
  gripGrad.addColorStop(0.55, '#78350f');
  gripGrad.addColorStop(1, '#451a03');
  renderCtx.fillStyle = gripGrad;
  renderCtx.strokeStyle = '#0f172a';
  renderCtx.lineWidth = 1.9;
  renderCtx.beginPath();
  renderCtx.moveTo(-7, 1);
  renderCtx.lineTo(-16, 4);
  renderCtx.quadraticCurveTo(-21, 14, -22, 22);
  renderCtx.lineTo(-12, 24);
  renderCtx.quadraticCurveTo(-9, 13, -4, 6);
  renderCtx.closePath();
  renderCtx.fill();
  renderCtx.stroke();

  // Placa metálica no cabo
  renderCtx.fillStyle = '#cbd5e1';
  renderCtx.fillRect(-21, 21, 9, 2.5);

  // 3. Guarda-mato e gatilho
  renderCtx.strokeStyle = '#475569';
  renderCtx.lineWidth = 2.2;
  renderCtx.beginPath();
  renderCtx.moveTo(-3, 5);
  renderCtx.quadraticCurveTo(2, 14, 9, 5);
  renderCtx.stroke();

  renderCtx.strokeStyle = '#e2e8f0';
  renderCtx.lineWidth = 1.6;
  renderCtx.beginPath();
  renderCtx.moveTo(2, 4);
  renderCtx.quadraticCurveTo(1, 8, 3, 10);
  renderCtx.stroke();

  // 4. Armação principal e tambor metálico
  const bodyGrad = renderCtx.createLinearGradient(0, -10, 0, 8);
  bodyGrad.addColorStop(0, '#e2e8f0');
  bodyGrad.addColorStop(0.45, '#64748b');
  bodyGrad.addColorStop(1, '#1e293b');
  renderCtx.fillStyle = bodyGrad;
  renderCtx.strokeStyle = '#0f172a';
  renderCtx.lineWidth = 1.9;

  renderCtx.beginPath();
  renderCtx.moveTo(-10, -5);
  renderCtx.lineTo(13, -7);
  renderCtx.lineTo(14, 5);
  renderCtx.lineTo(-7, 5);
  renderCtx.closePath();
  renderCtx.fill();
  renderCtx.stroke();

  // Tambor giratório com ranhuras
  renderCtx.fillStyle = '#475569';
  renderCtx.beginPath();
  drawRoundedRectPath(renderCtx, -2, -6.5, 13, 11.5, 2.4);
  renderCtx.fill();
  renderCtx.stroke();

  renderCtx.fillStyle = '#1e293b';
  renderCtx.fillRect(0.5, -4.5, 8.5, 2);
  renderCtx.fillRect(0.5, -1, 8.5, 2);
  renderCtx.fillRect(0.5, 2.3, 8.5, 1.6);

  // 5. Cano reforçado + trilho superior ventilado + massa de mira
  const barrelGrad = renderCtx.createLinearGradient(13, -7, 37, 2);
  barrelGrad.addColorStop(0, '#cbd5e1');
  barrelGrad.addColorStop(0.5, '#64748b');
  barrelGrad.addColorStop(1, muzzleHeat > 0 ? '#fb923c' : '#94a3b8');
  renderCtx.fillStyle = barrelGrad;
  renderCtx.strokeStyle = '#0f172a';
  renderCtx.lineWidth = 1.9;

  renderCtx.beginPath();
  renderCtx.moveTo(13, -6.8);
  renderCtx.lineTo(36, -6.2);
  renderCtx.lineTo(36, 0.5);
  renderCtx.lineTo(13, 1.5);
  renderCtx.closePath();
  renderCtx.fill();
  renderCtx.stroke();

  // Massa de mira na ponta do cano
  renderCtx.fillStyle = '#f97316';
  renderCtx.beginPath();
  renderCtx.moveTo(31, -6.2);
  renderCtx.lineTo(34.5, -9.8);
  renderCtx.lineTo(35.8, -6.2);
  renderCtx.closePath();
  renderCtx.fill();

  // Brilho especular superior do cano
  renderCtx.strokeStyle = 'rgba(248, 250, 252, 0.72)';
  renderCtx.lineWidth = 1.1;
  renderCtx.beginPath();
  renderCtx.moveTo(14.5, -4.8);
  renderCtx.lineTo(34, -4.5);
  renderCtx.stroke();

  renderCtx.restore();
}

function drawPistolAnimations(renderCtx) {
  if (!pistolAnimations.length) return;

  renderCtx.save();
  for (const anim of pistolAnimations) {
    const t = anim.totalElapsed;
    const lifeRatio = Math.min(1, t / PISTOL_ANIM_DURATION);

    // Fases: 0..0.045 engatilhar | 0.045..0.17 disparo + recuo | 0.17..0.56 retorno e fumaça
    const cockRatio = t < 0.045 ? t / 0.045 : t < 0.07 ? 1 - (t - 0.045) / 0.025 : 0;
    const recoilProgress =
      t < 0.045 ? 0 :
      t < 0.14 ? Math.sin(((t - 0.045) / 0.095) * (Math.PI * 0.5)) :
      Math.max(0, 1 - (t - 0.14) / 0.24);

    const kickbackDist = recoilProgress * 13;
    const kickAngle = -0.25 * anim.flipY * recoilProgress;
    const drawX = anim.x - anim.dirX * kickbackDist;
    const drawY = anim.y - anim.dirY * kickbackDist;
    const muzzleHeat = t >= 0.04 && t <= 0.22 ? Math.max(0, 1 - (t - 0.04) / 0.18) : 0;
    const fadeOut = lifeRatio > 0.72 ? Math.max(0, 1 - (lifeRatio - 0.72) / 0.28) : 1;

    // 1. Onda de choque expandindo na boca do cano
    if (t >= 0.04 && t <= 0.28) {
      const waveT = (t - 0.04) / 0.24;
      renderCtx.save();
      renderCtx.translate(anim.muzzleX, anim.muzzleY);
      renderCtx.rotate(anim.angle);
      renderCtx.globalAlpha = (1 - waveT) * 0.88;
      renderCtx.strokeStyle = waveT < 0.4 ? '#fef08a' : '#f97316';
      renderCtx.shadowColor = '#f97316';
      renderCtx.shadowBlur = 14;
      renderCtx.lineWidth = Math.max(1.2, 3.8 * (1 - waveT));
      renderCtx.beginPath();
      renderCtx.ellipse(waveT * 26, 0, 5 + waveT * 11, 11 + waveT * 28, 0, 0, Math.PI * 2);
      renderCtx.stroke();
      renderCtx.restore();
    }

    // 2. Baforadas de fumaça pós-tiro
    for (const puff of anim.smokePuffs) {
      if (t < puff.delay || puff.alpha <= 0.01) continue;
      renderCtx.save();
      renderCtx.globalAlpha = puff.alpha * fadeOut;
      const smokeGrad = renderCtx.createRadialGradient(puff.x, puff.y, 1, puff.x, puff.y, puff.radius);
      smokeGrad.addColorStop(0, 'rgba(226, 232, 240, 0.7)');
      smokeGrad.addColorStop(1, 'rgba(148, 163, 184, 0)');
      renderCtx.fillStyle = smokeGrad;
      renderCtx.beginPath();
      renderCtx.arc(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
      renderCtx.fill();
      renderCtx.restore();
    }

    // 3. Cápsula dourada ejetada girando
    if (anim.shell && anim.shell.life > 0.05 && t >= 0.05) {
      const s = anim.shell;
      renderCtx.save();
      renderCtx.globalAlpha = Math.min(1, s.life * 1.4);
      renderCtx.translate(s.x, s.y);
      renderCtx.rotate(s.rot);
      renderCtx.fillStyle = '#fbbf24';
      renderCtx.strokeStyle = '#78350f';
      renderCtx.lineWidth = 1;
      renderCtx.fillRect(-4, -1.8, 8, 3.6);
      renderCtx.strokeRect(-4, -1.8, 8, 3.6);
      renderCtx.fillStyle = '#fef9c3';
      renderCtx.fillRect(-2, -1, 4, 1.2);
      renderCtx.restore();
    }

    // 4. Revólver procedural com sombra suave
    renderCtx.save();
    renderCtx.globalAlpha = fadeOut;
    renderCtx.translate(drawX, drawY);
    renderCtx.rotate(anim.angle + kickAngle);
    renderCtx.scale(1.12, 1.12 * anim.flipY);
    renderCtx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    renderCtx.shadowBlur = 8;
    renderCtx.shadowOffsetY = 3;
    drawProceduralRevolver(renderCtx, cockRatio, muzzleHeat);
    renderCtx.restore();

    // 5. Brilho inicial de engatilhamento no tambor
    if (t < 0.05) {
      const glint = Math.sin((t / 0.05) * Math.PI);
      renderCtx.save();
      renderCtx.globalCompositeOperation = 'lighter';
      renderCtx.globalAlpha = glint * 0.8;
      renderCtx.fillStyle = '#fde047';
      renderCtx.beginPath();
      renderCtx.arc(drawX + anim.dirX * 10, drawY + anim.dirY * 10, 7 * glint, 0, Math.PI * 2);
      renderCtx.fill();
      renderCtx.restore();
    }

    // 6. Muzzle Flash em camadas (branco / dourado / laranja)
    if (t >= 0.04 && t <= 0.19) {
      const flashRatio = 1 - Math.abs((t - 0.09) / 0.10);
      const intensity = Math.max(0, Math.min(1, flashRatio));
      renderCtx.save();
      renderCtx.translate(anim.muzzleX - anim.dirX * (kickbackDist * 0.5), anim.muzzleY - anim.dirY * (kickbackDist * 0.5));
      renderCtx.rotate(anim.angle);
      renderCtx.globalCompositeOperation = 'lighter';
      renderCtx.globalAlpha = intensity * 0.96;

      // Halo laranja-dourado
      const glow = renderCtx.createRadialGradient(8, 0, 2, 12, 0, 48);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.28, '#fef08a');
      glow.addColorStop(0.65, 'rgba(249, 115, 22, 0.78)');
      glow.addColorStop(1, 'rgba(249, 115, 22, 0)');
      renderCtx.fillStyle = glow;
      renderCtx.beginPath();
      renderCtx.arc(10, 0, 48, 0, Math.PI * 2);
      renderCtx.fill();

      // Estrela externa laranja
      renderCtx.fillStyle = '#fb923c';
      renderCtx.beginPath();
      renderCtx.moveTo(-2, 0);
      renderCtx.lineTo(10, -15 * intensity);
      renderCtx.lineTo(18, -6 * intensity);
      renderCtx.lineTo(56 * intensity, 0);
      renderCtx.lineTo(18, 6 * intensity);
      renderCtx.lineTo(10, 15 * intensity);
      renderCtx.closePath();
      renderCtx.fill();

      // Núcleo branco-dourado agudo
      renderCtx.fillStyle = '#fffbeb';
      renderCtx.beginPath();
      renderCtx.moveTo(0, 0);
      renderCtx.lineTo(12, -6.5 * intensity);
      renderCtx.lineTo(38 * intensity, 0);
      renderCtx.lineTo(12, 6.5 * intensity);
      renderCtx.closePath();
      renderCtx.fill();
      renderCtx.restore();
    }

    // 7. Faíscas incandescentes do disparo
    for (const spark of anim.muzzleSparks) {
      renderCtx.save();
      renderCtx.globalAlpha = Math.max(0, spark.life);
      renderCtx.strokeStyle = spark.color;
      renderCtx.fillStyle = spark.color;
      renderCtx.shadowColor = '#f97316';
      renderCtx.shadowBlur = 8;
      renderCtx.lineWidth = spark.size * 0.75;
      renderCtx.beginPath();
      renderCtx.moveTo(spark.x, spark.y);
      renderCtx.lineTo(spark.x - spark.vx * 0.028, spark.y - spark.vy * 0.028);
      renderCtx.stroke();
      renderCtx.beginPath();
      renderCtx.arc(spark.x, spark.y, spark.size * 0.55, 0, Math.PI * 2);
      renderCtx.fill();
      renderCtx.restore();
    }
  }
  renderCtx.restore();
}
