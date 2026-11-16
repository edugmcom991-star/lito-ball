/**
 * ==========================================================================
 * LITO BALL - SPEEDSTER (js/skills/speedster.js)
 * ==========================================================================
 * Animação procedural 100% em Canvas 2D para a habilidade `sprint` (Speedster):
 *  - Onda de choque sônica carmesim/dourada e cone de ruptura ao disparar
 *  - Silhueta estilizada da Pantera Escarlate envolvendo e projetando-se à frente
 *    do jogador com cabeça feroz, orelhas aerodinâmicas e olhos brilhantes
 *  - Marcas de garras luminosas rasgando o gramado atrás das passadas
 *  - Fitas de energia rubi/dourada, faíscas e afterimages fluidas
 */
'use strict';

const speedsterBursts = [];
const speedsterClaws = [];
const speedsterSparks = [];
const speedsterRibbons = [];
const speedsterAfterimages = [];
let speedsterAfterimageCooldown = 0;

function clearSpeedsterEffects() {
  speedsterBursts.length = 0;
  speedsterClaws.length = 0;
  speedsterSparks.length = 0;
  speedsterRibbons.length = 0;
  speedsterAfterimages.length = 0;
  speedsterAfterimageCooldown = 0;
  if (typeof lightningTrails !== 'undefined') lightningTrails.length = 0;
  if (typeof pantherPaws !== 'undefined') pantherPaws.length = 0;
  if (typeof pantherSparks !== 'undefined') pantherSparks.length = 0;
}

function getSpeedsterDirection(actor) {
  const vx = actor.vx || 0;
  const vy = actor.vy || 0;
  const spd = Math.hypot(vx, vy);
  if (spd > 0.65) {
    return { x: vx / spd, y: vy / spd };
  }
  const fx = actor.facingX || 1;
  const fy = actor.facingY || 0;
  const fLen = Math.hypot(fx, fy) || 1;
  return { x: fx / fLen, y: fy / fLen };
}

function triggerSpeedsterBurst(actor) {
  if (!actor) return;
  const dir = getSpeedsterDirection(actor);
  const angle = Math.atan2(dir.y, dir.x);

  speedsterBursts.push({
    x: actor.x,
    y: actor.y,
    angle,
    life: 0.42,
    maxLife: 0.42,
    baseRadius: actor.radius
  });

  // Marca inicial de três garras na arrancada explosiva
  speedsterClaws.push({
    x: actor.x - dir.x * (actor.radius * 0.4),
    y: actor.y - dir.y * (actor.radius * 0.4),
    angle,
    scale: 1.38,
    life: 0.62,
    maxLife: 0.62
  });

  // Centelhas sônicas rubi e douradas na saída
  for (let i = 0; i < 20; i++) {
    const spread = angle + Math.PI + (Math.random() - 0.5) * 1.45;
    const speed = 2.2 + Math.random() * 4.4;
    speedsterSparks.push({
      x: actor.x - dir.x * (actor.radius * 0.6) + (Math.random() - 0.5) * 12,
      y: actor.y - dir.y * (actor.radius * 0.6) + (Math.random() - 0.5) * 12,
      vx: Math.cos(spread) * speed,
      vy: Math.sin(spread) * speed,
      life: 0.34 + Math.random() * 0.24,
      maxLife: 0.58,
      color: i % 5 === 0 ? '#fde047' : i % 2 === 0 ? '#fb7185' : '#e11d48',
      size: 1.8 + Math.random() * 2.5
    });
  }
}

function recordSpeedsterTrail(actor) {
  if (!actor || actor.dashTimer <= 0) return;

  const dir = getSpeedsterDirection(actor);
  const backX = -dir.x;
  const backY = -dir.y;
  const sideX = -backY;
  const sideY = backX;
  const angle = Math.atan2(dir.y, dir.x);

  // 1. Afterimage translúcida em cadência regular (~28fps)
  if (speedsterAfterimageCooldown <= 0) {
    speedsterAfterimages.push({
      x: actor.x,
      y: actor.y,
      radius: actor.radius,
      angle,
      life: 0.28,
      maxLife: 0.28
    });
    speedsterAfterimageCooldown = 0.036;
  }

  // 2. Feixe duplo sinuoso de energia rubi/rosa-choque atrás dos flancos
  if (Math.random() < 0.82) {
    const flank = Math.random() < 0.5 ? -1 : 1;
    const offsetSide = flank * (actor.radius * 0.68);
    const points = [];
    for (let i = 0; i < 7; i++) {
      const along = i * 11;
      const wave = i === 0 || i === 6 ? 0 : Math.sin(i * 1.25 + performance.now() * 0.025) * 7 + (Math.random() - 0.5) * 6;
      points.push({
        x: actor.x + backX * (actor.radius * 0.7 + along) + sideX * (offsetSide + wave),
        y: actor.y + backY * (actor.radius * 0.7 + along) + sideY * (offsetSide + wave)
      });
    }
    speedsterRibbons.push({
      points,
      isGold: Math.random() < 0.22,
      life: 0.24,
      maxLife: 0.24
    });
  }

  // 3. Marcas de garras alternadas rasgando o gramado
  if (Math.random() < 0.34) {
    const pawSide = (Math.random() < 0.5 ? -1 : 1) * (actor.radius * 0.55);
    speedsterClaws.push({
      x: actor.x + backX * (actor.radius + 10) + sideX * pawSide,
      y: actor.y + backY * (actor.radius + 10) + sideY * pawSide,
      angle: angle + (Math.random() - 0.5) * 0.14,
      scale: 0.95 + Math.random() * 0.25,
      life: 0.52,
      maxLife: 0.52
    });
  }

  // 4. Faíscas cinéticas
  for (let k = 0; k < 2; k++) {
    speedsterSparks.push({
      x: actor.x + backX * (actor.radius * 0.9) + (Math.random() - 0.5) * 18,
      y: actor.y + backY * (actor.radius * 0.9) + (Math.random() - 0.5) * 18,
      vx: (Math.random() - 0.5) * 2.4 + backX * 2.6,
      vy: (Math.random() - 0.5) * 2.4 + backY * 2.6,
      life: 0.28 + Math.random() * 0.18,
      maxLife: 0.46,
      color: Math.random() < 0.18 ? '#fef08a' : Math.random() < 0.55 ? '#f43f5e' : '#fda4af',
      size: 1.5 + Math.random() * 2.2
    });
  }
}

function updateAndDrawSpeedsterEffects(renderCtx, dt = 1 / 60) {
  const stepDt = Math.min(0.05, Math.max(0.008, dt || 1 / 60));
  if (speedsterAfterimageCooldown > 0) {
    speedsterAfterimageCooldown = Math.max(0, speedsterAfterimageCooldown - stepDt);
  }

  // 1. Marcas de garras luminosas no piso
  for (let i = speedsterClaws.length - 1; i >= 0; i--) {
    const claw = speedsterClaws[i];
    claw.life -= stepDt;
    if (claw.life <= 0) {
      speedsterClaws.splice(i, 1);
      continue;
    }
    const alpha = claw.life / claw.maxLife;
    renderCtx.save();
    renderCtx.translate(claw.x, claw.y);
    renderCtx.rotate(claw.angle);
    renderCtx.scale(claw.scale, claw.scale);
    renderCtx.lineCap = 'round';
    renderCtx.globalAlpha = alpha * 0.9;
    renderCtx.shadowColor = '#e11d48';
    renderCtx.shadowBlur = 12;

    for (let c = -1; c <= 1; c++) {
      const yOff = c * 6.5;
      const reach = c === 0 ? 15 : 12;
      renderCtx.strokeStyle = '#be123c';
      renderCtx.lineWidth = 3.2;
      renderCtx.beginPath();
      renderCtx.moveTo(-reach, yOff - c * 1.2);
      renderCtx.quadraticCurveTo(0, yOff + c * 1.4, reach, yOff);
      renderCtx.stroke();

      renderCtx.strokeStyle = c === 0 ? '#fef08a' : '#fecdd3';
      renderCtx.lineWidth = 1.4;
      renderCtx.stroke();
    }
    renderCtx.restore();
  }

  // 2. Onda de choque sônica inicial
  for (let i = speedsterBursts.length - 1; i >= 0; i--) {
    const burst = speedsterBursts[i];
    burst.life -= stepDt;
    if (burst.life <= 0) {
      speedsterBursts.splice(i, 1);
      continue;
    }
    const p = 1 - burst.life / burst.maxLife;
    const alpha = Math.pow(1 - p, 1.3);
    const ringR = burst.baseRadius + p * 56;

    renderCtx.save();
    renderCtx.translate(burst.x, burst.y);
    renderCtx.rotate(burst.angle);

    // Anel sônico expandindo
    renderCtx.globalAlpha = alpha * 0.85;
    renderCtx.strokeStyle = '#fb7185';
    renderCtx.shadowColor = '#f43f5e';
    renderCtx.shadowBlur = 18;
    renderCtx.lineWidth = 4 * (1 - p) + 1.2;
    renderCtx.beginPath();
    renderCtx.ellipse(-p * 12, 0, ringR * 0.72, ringR * 1.05, 0, 0, Math.PI * 2);
    renderCtx.stroke();

    // Cone de ruptura Mach atrás da saída
    renderCtx.globalAlpha = alpha * 0.68;
    renderCtx.strokeStyle = '#fef08a';
    renderCtx.lineWidth = 2.4;
    renderCtx.beginPath();
    renderCtx.moveTo(burst.baseRadius * 0.6 - p * 18, -ringR * 0.85);
    renderCtx.quadraticCurveTo(burst.baseRadius * 1.35, 0, burst.baseRadius * 0.6 - p * 18, ringR * 0.85);
    renderCtx.stroke();

    renderCtx.restore();
  }

  // 3. Afterimages estilizadas do Speedster
  for (let i = speedsterAfterimages.length - 1; i >= 0; i--) {
    const img = speedsterAfterimages[i];
    img.life -= stepDt;
    if (img.life <= 0) {
      speedsterAfterimages.splice(i, 1);
      continue;
    }
    const alpha = (img.life / img.maxLife) * 0.42;
    renderCtx.save();
    renderCtx.translate(img.x, img.y);
    renderCtx.rotate(img.angle);
    renderCtx.globalAlpha = alpha;
    renderCtx.fillStyle = '#e11d48';
    renderCtx.shadowColor = '#f43f5e';
    renderCtx.shadowBlur = 14;
    renderCtx.beginPath();
    renderCtx.arc(0, 0, img.radius + 1, 0, Math.PI * 2);
    renderCtx.fill();

    renderCtx.strokeStyle = '#fda4af';
    renderCtx.lineWidth = 1.8;
    renderCtx.stroke();

    // Cauda/aura pontuda atrás da afterimage
    renderCtx.beginPath();
    renderCtx.moveTo(-img.radius * 0.5, -img.radius * 0.78);
    renderCtx.lineTo(-img.radius * 1.75, 0);
    renderCtx.lineTo(-img.radius * 0.5, img.radius * 0.78);
    renderCtx.closePath();
    renderCtx.fillStyle = 'rgba(251, 113, 133, 0.5)';
    renderCtx.fill();
    renderCtx.restore();
  }

  // 4. Fitas de energia rubi e dourada
  for (let i = speedsterRibbons.length - 1; i >= 0; i--) {
    const ribbon = speedsterRibbons[i];
    ribbon.life -= stepDt;
    if (ribbon.life <= 0) {
      speedsterRibbons.splice(i, 1);
      continue;
    }
    const alpha = ribbon.life / ribbon.maxLife;
    renderCtx.save();
    renderCtx.globalAlpha = alpha * 0.88;
    renderCtx.lineCap = 'round';
    renderCtx.lineJoin = 'round';
    renderCtx.beginPath();
    renderCtx.moveTo(ribbon.points[0].x, ribbon.points[0].y);
    for (let k = 1; k < ribbon.points.length; k++) {
      renderCtx.lineTo(ribbon.points[k].x, ribbon.points[k].y);
    }
    renderCtx.strokeStyle = ribbon.isGold ? '#f59e0b' : '#f43f5e';
    renderCtx.shadowColor = ribbon.isGold ? '#fde047' : '#e11d48';
    renderCtx.shadowBlur = 14;
    renderCtx.lineWidth = 5.5;
    renderCtx.stroke();

    renderCtx.strokeStyle = ribbon.isGold ? '#fef9c3' : '#ffe4e6';
    renderCtx.shadowBlur = 4;
    renderCtx.lineWidth = 1.9;
    renderCtx.stroke();
    renderCtx.restore();
  }

  // 5. Faíscas incandescente rubi/ouro
  for (let i = speedsterSparks.length - 1; i >= 0; i--) {
    const sp = speedsterSparks[i];
    sp.x += sp.vx * (stepDt * 60);
    sp.y += sp.vy * (stepDt * 60);
    sp.vx *= 0.94;
    sp.vy *= 0.94;
    sp.life -= stepDt;
    if (sp.life <= 0) {
      speedsterSparks.splice(i, 1);
      continue;
    }
    const alpha = sp.life / sp.maxLife;
    renderCtx.save();
    renderCtx.globalAlpha = alpha;
    renderCtx.fillStyle = sp.color;
    renderCtx.shadowColor = '#f43f5e';
    renderCtx.shadowBlur = 8;
    renderCtx.beginPath();
    renderCtx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
    renderCtx.fill();
    renderCtx.restore();
  }
}

/**
 * Desenha a Pantera Escarlate estilizada envolvendo o jogador em velocidade máxima.
 */
function drawSpeedsterPantherEntity(renderCtx, actor) {
  if (!actor || actor.dashTimer <= 0) return;

  const dir = getSpeedsterDirection(actor);
  const angle = Math.atan2(dir.y, dir.x);
  const lifeRatio = Math.min(1, actor.dashTimer / 0.82);
  const r = actor.radius;
  const pulse = 1 + Math.sin(performance.now() * 0.028) * 0.06;

  renderCtx.save();
  renderCtx.translate(actor.x, actor.y);
  renderCtx.rotate(angle);
  renderCtx.scale(pulse, pulse);

  // Aura radial rubi intensa sob a cabeça da Pantera
  const auraGrad = renderCtx.createRadialGradient(4, 0, r * 0.35, 0, 0, r * 2.2);
  auraGrad.addColorStop(0, `rgba(251, 113, 133, ${0.42 * lifeRatio})`);
  auraGrad.addColorStop(0.55, `rgba(225, 29, 72, ${0.28 * lifeRatio})`);
  auraGrad.addColorStop(1, 'rgba(136, 19, 55, 0)');
  renderCtx.fillStyle = auraGrad;
  renderCtx.beginPath();
  renderCtx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
  renderCtx.fill();

  // Cone aerodinâmico de velocidade envolvendo o corpo do botão
  const bodyGrad = renderCtx.createLinearGradient(r * 1.9, 0, -r * 2.1, 0);
  bodyGrad.addColorStop(0, `rgba(255, 228, 230, ${0.88 * lifeRatio})`);
  bodyGrad.addColorStop(0.35, `rgba(244, 63, 94, ${0.72 * lifeRatio})`);
  bodyGrad.addColorStop(0.75, `rgba(190, 18, 60, ${0.45 * lifeRatio})`);
  bodyGrad.addColorStop(1, 'rgba(136, 19, 55, 0)');

  renderCtx.save();
  renderCtx.shadowColor = '#f43f5e';
  renderCtx.shadowBlur = 18;
  renderCtx.fillStyle = bodyGrad;
  renderCtx.beginPath();
  renderCtx.moveTo(r * 1.85, 0);
  renderCtx.quadraticCurveTo(r * 0.85, -r * 1.48, -r * 1.75, -r * 0.82);
  renderCtx.quadraticCurveTo(-r * 1.05, 0, -r * 1.75, r * 0.82);
  renderCtx.quadraticCurveTo(r * 0.85, r * 1.48, r * 1.85, 0);
  renderCtx.closePath();
  renderCtx.fill();

  // Silhueta esculpida da cabeça da Pantera à frente (focinho + orelhas pontudas + crina veloz)
  renderCtx.fillStyle = `rgba(136, 19, 55, ${0.65 * lifeRatio})`;
  renderCtx.strokeStyle = `rgba(253, 164, 175, ${0.95 * lifeRatio})`;
  renderCtx.lineWidth = 2.1;
  renderCtx.beginPath();
  // Ponta do focinho
  renderCtx.moveTo(r * 2.02, 0);
  // Topo do focinho -> testa -> orelha esquerda varrida para trás
  renderCtx.lineTo(r * 1.32, -r * 0.36);
  renderCtx.lineTo(r * 0.65, -r * 0.72);
  renderCtx.lineTo(-r * 0.38, -r * 1.32); // Orelha pontuda superior
  renderCtx.lineTo(r * 0.04, -r * 0.56);
  // Tufos/crina de velocidade nas costas
  renderCtx.lineTo(-r * 1.25, -r * 0.62);
  renderCtx.lineTo(-r * 0.65, -r * 0.18);
  renderCtx.lineTo(-r * 1.52, 0);
  renderCtx.lineTo(-r * 0.65, r * 0.18);
  renderCtx.lineTo(-r * 1.25, r * 0.62);
  // Orelha pontuda inferior -> bochecha -> mandíbula inferior
  renderCtx.lineTo(r * 0.04, r * 0.56);
  renderCtx.lineTo(-r * 0.38, r * 1.32); // Orelha pontuda inferior
  renderCtx.lineTo(r * 0.65, r * 0.72);
  renderCtx.lineTo(r * 1.32, r * 0.36);
  renderCtx.closePath();
  renderCtx.fill();
  renderCtx.stroke();

  // Olhos ferozes felinos brilhantes em ouro incandescente
  for (const eyeSign of [-1, 1]) {
    renderCtx.save();
    renderCtx.translate(r * 0.92, eyeSign * r * 0.34);
    renderCtx.rotate(eyeSign * -0.35);
    renderCtx.fillStyle = '#fef08a';
    renderCtx.shadowColor = '#f59e0b';
    renderCtx.shadowBlur = 12;
    renderCtx.beginPath();
    renderCtx.moveTo(-4.8, 0);
    renderCtx.quadraticCurveTo(0, -2.8, 5.2, 0);
    renderCtx.quadraticCurveTo(0, 2.5, -4.8, 0);
    renderCtx.closePath();
    renderCtx.fill();
    renderCtx.restore();
  }

  // Presas / brilho cortante na linha do focinho e garras frontais
  renderCtx.strokeStyle = `rgba(254, 240, 138, ${0.85 * lifeRatio})`;
  renderCtx.lineWidth = 1.6;
  renderCtx.beginPath();
  renderCtx.moveTo(r * 1.48, -r * 0.58);
  renderCtx.quadraticCurveTo(r * 2.15, -r * 0.28, r * 2.38, 0);
  renderCtx.quadraticCurveTo(r * 2.15, r * 0.28, r * 1.48, r * 0.58);
  renderCtx.stroke();

  renderCtx.restore();
  renderCtx.restore();
}

// Aliases de compatibilidade caso chamadas legadas sejam executadas
function addLightningTrail(player) {
  recordSpeedsterTrail(player);
}

function updateAndDrawLightningTrails(renderCtx) {
  updateAndDrawSpeedsterEffects(renderCtx, 1 / 60);
}
