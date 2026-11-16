/**
 * ==========================================================================
 * LITO BALL - REWORK: CURVA IMPOSSÍVEL (js/skills/curveShot.js)
 * ==========================================================================
 * Habilidade refeita do zero:
 *  - Mira intuitiva em tempo real (mouse ou WASD com assistência inteligente ao canto do gol)
 *  - Prévia visual exata da trajetória em arco (simulação preditiva / curva luminosa)
 *  - Física Magnus real ("vai e volta" para contornar zagueiros e buscar o ângulo do gol)
 *  - Animação multi-fase em alta fidelidade (vórtice de carga, fita luminosa e partículas)
 */
'use strict';

const curveShots = [];

const curveMouseAim = {
  x: CONFIG.pitch.right,
  y: CONFIG.pitch.centerY,
  active: false,
  lastMovedAt: 0
};

function updateCurveMouseAim(clientX, clientY) {
  const c = typeof canvas !== 'undefined' ? canvas : document.getElementById('gameCanvas');
  if (!c) return;
  const rect = c.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  curveMouseAim.x = (clientX - rect.left) * (c.width / rect.width);
  curveMouseAim.y = (clientY - rect.top) * (c.height / rect.height);
  curveMouseAim.active = true;
  curveMouseAim.lastMovedAt = performance.now();
}

function getCurveTeams(actor) {
  const isHome = !!(actor.isHuman || actor.isTeammate);
  const opponents = typeof getOpponentsOf === 'function'
    ? getOpponentsOf(actor)
    : (isHome
        ? (gameMode === '2v2' ? [player2, awayMate] : [player2])
        : (gameMode === '2v2' ? [player1, homeMate] : [player1]));
  const teammates = typeof getTeammatesOf === 'function'
    ? getTeammatesOf(actor)
    : (isHome
        ? (gameMode === '2v2' ? [player1, homeMate] : [player1])
        : (gameMode === '2v2' ? [player2, awayMate] : [player2]));
  return { isHome, opponents, teammates };
}

function addCurveVortexParticles(x, y, count = 6, burst = false, vxHint = 0, vyHint = 0) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (burst ? 1.6 : 0.65) + Math.random() * (burst ? 3.2 : 1.7);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed - vxHint * 0.14,
      vy: Math.sin(angle) * speed - vyHint * 0.14,
      life: 0.55 + Math.random() * 0.25,
      decay: burst ? 0.042 + Math.random() * 0.03 : 0.065 + Math.random() * 0.035,
      color: i % 3 === 0 ? '#e0f2fe' : i % 2 === 0 ? '#38bdf8' : '#a855f7',
      size: burst ? 3.0 : 2.2
    });
  }
}

/**
 * Simula os próximos passos exatos da física da bola com efeito Magnus
 * para garantir que a prévia visual e o chute real sigam o mesmo arco.
 */
function simulateCurveArcPoints(startX, startY, launchAngle, launchSpeed, spinRatePerSec, steps = 34) {
  const p = CONFIG.pitch;
  const points = [{ x: startX, y: startY }];
  let x = startX;
  let y = startY;
  let vx = Math.cos(launchAngle) * launchSpeed;
  let vy = Math.sin(launchAngle) * launchSpeed;
  const damping = CONFIG.physics.dampingBall;
  const maxSpeed = CONFIG.physics.ballMaxSpeed * 1.48;
  const dTheta = spinRatePerSec / 60;
  const cos = Math.cos(dTheta);
  const sin = Math.sin(dTheta);

  for (let i = 0; i < steps; i++) {
    const nvx = vx * cos - vy * sin;
    const nvy = vx * sin + vy * cos;
    vx = nvx * damping;
    vy = nvy * damping;
    const spd = Math.hypot(vx, vy);
    if (spd > maxSpeed) {
      vx = (vx / spd) * maxSpeed;
      vy = (vy / spd) * maxSpeed;
    }
    x += vx;
    y += vy;
    points.push({ x, y });

    if (x < p.left - 24 || x > p.right + 24) break;
    if (y < p.top + ball.radius || y > p.bottom - ball.radius) break;
  }
  return points;
}

function evaluateArcScore(points, targetX, targetY, opponents, postsList) {
  const p = CONFIG.pitch;
  let minOppDist = Infinity;
  let minPostDist = Infinity;
  let wallPenalty = 0;
  let minDistToTarget = Infinity;
  const last = points[points.length - 1];

  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    if (pt.y < p.top + 16 || pt.y > p.bottom - 16) wallPenalty += 120;
    for (const opp of opponents) {
      const d = Math.hypot(pt.x - opp.x, pt.y - opp.y) - opp.radius - ball.radius;
      if (d < minOppDist) minOppDist = d;
    }
    for (const post of postsList) {
      const d = Math.hypot(pt.x - post.x, pt.y - post.y) - post.radius - ball.radius;
      if (d < minPostDist) minPostDist = d;
    }
    const dt = Math.hypot(pt.x - targetX, pt.y - targetY);
    if (dt < minDistToTarget) minDistToTarget = dt;
  }

  const clearBonus = Math.min(Math.max(minOppDist, -40), 95) * 1.6;
  const postClearBonus = Math.min(Math.max(minPostDist, -20), 40) * 1.2;
  const hitAccuracy = -minDistToTarget * 1.15 - Math.hypot(last.x - targetX, last.y - targetY) * 0.25;
  return clearBonus + postClearBonus + hitAccuracy - wallPenalty;
}

/**
 * Calcula alvo, lado ideal da curva e parâmetros físicos precisos para `actor`.
 */
function computeCurveSolution(actor, isPass = false, passTarget = null) {
  const p = CONFIG.pitch;
  const g = CONFIG.goals;
  const { isHome, opponents } = getCurveTeams(actor);
  const startX = ball.x;
  const startY = ball.y;

  let targetX;
  let targetY;

  if (isPass && passTarget) {
    targetX = passTarget.x + passTarget.vx * 12;
    targetY = passTarget.y + passTarget.vy * 12;
  } else if (actor.isHuman) {
    const goalX = p.right + 14;
    const upperCorner = { x: goalX, y: g.topY + 26 };
    const lowerCorner = { x: goalX, y: g.bottomY - 26 };
    const recentMouse = curveMouseAim.active && (performance.now() - curveMouseAim.lastMovedAt < 6500);
    const hasKeyboardDir = input.up || input.down || input.left || input.right;

    if (recentMouse && !hasKeyboardDir) {
      const mx = curveMouseAim.x;
      const my = curveMouseAim.y;
      if (mx > startX + 35) {
        // Se mirar no setor ofensivo perto do corredor do gol, estende até o fundo da rede com precisão
        const clampedGoalY = Math.max(g.topY + 18, Math.min(g.bottomY - 18, my));
        const dxM = mx - startX;
        const dyM = my - startY;
        const projectedY = startY + (dxM > 20 ? (dyM / dxM) * (goalX - startX) : 0);
        if (mx > p.centerX + 40 && projectedY >= g.topY - 55 && projectedY <= g.bottomY + 55) {
          targetX = goalX;
          targetY = Math.max(g.topY + 18, Math.min(g.bottomY - 18, projectedY * 0.65 + clampedGoalY * 0.35));
        } else {
          targetX = Math.max(p.left + 20, Math.min(goalX, mx));
          targetY = Math.max(p.top + 24, Math.min(p.bottom - 24, my));
        }
      } else {
        targetX = Math.max(p.left + 20, Math.min(p.right + 14, mx));
        targetY = Math.max(p.top + 24, Math.min(p.bottom - 24, my));
      }
    } else if (hasKeyboardDir) {
      const kx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const ky = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (kx >= 0) {
        targetX = goalX;
        targetY = ky < 0 ? upperCorner.y : ky > 0 ? lowerCorner.y : (startY < p.centerY ? lowerCorner.y : upperCorner.y);
      } else {
        const len = Math.hypot(kx, ky) || 1;
        targetX = Math.max(p.left + 28, startX + (kx / len) * 280);
        targetY = Math.max(p.top + 28, Math.min(p.bottom - 28, startY + (ky / len) * 280));
      }
    } else {
      // Sem input ativo: mira automaticamente no ângulo mais aberto do gol
      const upperSpace = Math.min(...opponents.map(o => pointSegmentDistance(o.x, o.y, startX, startY, upperCorner.x, upperCorner.y)), 180);
      const lowerSpace = Math.min(...opponents.map(o => pointSegmentDistance(o.x, o.y, startX, startY, lowerCorner.x, lowerCorner.y)), 180);
      targetX = goalX;
      targetY = upperSpace >= lowerSpace ? upperCorner.y : lowerCorner.y;
    }
  } else {
    // Bot adversário / aliado busca o melhor canto do gol adversário
    const goalX = isHome ? p.right + 14 : p.left - 14;
    const upper = { x: goalX, y: g.topY + 26 };
    const lower = { x: goalX, y: g.bottomY - 26 };
    const upperSpace = Math.min(...opponents.map(o => pointSegmentDistance(o.x, o.y, startX, startY, upper.x, upper.y)), 180);
    const lowerSpace = Math.min(...opponents.map(o => pointSegmentDistance(o.x, o.y, startX, startY, lower.x, lower.y)), 180);
    targetX = goalX;
    targetY = upperSpace >= lowerSpace ? upper.y : lower.y;
  }

  const dx = targetX - startX;
  const dy = targetY - startY;
  const dist = Math.hypot(dx, dy) || 1;
  const baseAngle = Math.atan2(dy, dx);

  // Velocidade forte calibrada pela distância, para que a curva chegue firme ao gol
  const launchSpeed = isPass
    ? CONFIG.physics.kickPower * 1.18
    : CONFIG.physics.kickPower * (dist > 380 ? 1.46 : 1.36);

  // Duração real estimada da trajetória em segundos (~0.45s a ~0.92s)
  const flightDuration = Math.max(0.42, Math.min(0.95, dist / (launchSpeed * 42)));
  const frames = Math.round(flightDuration * 60);
  const alpha0 = Math.max(0.24, Math.min(0.46, dist / 740));

  // Avalia os dois sentidos de curva (-1 e +1) e escolhe o arco mais limpo dentro do campo
  let best = null;
  for (const side of [-1, 1]) {
    // Para curvar por fora no sentido `-side` e voltar fechando no gol em `+side`:
    const launchAngle = baseAngle - side * alpha0;
    const spinRate = side * ((2.08 * alpha0) / flightDuration);
    const points = simulateCurveArcPoints(startX, startY, launchAngle, launchSpeed, spinRate, frames);
    const score = evaluateArcScore(points, targetX, targetY, opponents, posts);
    if (!best || score > best.score) {
      best = { side, launchAngle, spinRate, points, score };
    }
  }

  return {
    targetX,
    targetY,
    dist,
    baseAngle,
    launchAngle: best.launchAngle,
    launchSpeed,
    spinRate: best.spinRate,
    bendSide: best.side,
    flightDuration,
    previewPoints: best.points
  };
}

function launchCurveShot(actor, isPass = false, passTarget = null) {
  const plan = computeCurveSolution(actor, isPass, passTarget);
  const dirX = Math.cos(plan.launchAngle);
  const dirY = Math.sin(plan.launchAngle);

  actor.facingX = dirX;
  actor.facingY = dirY;
  actor.kickRingTimer = 0.18;
  actor.kickCooldownTimer = CONFIG.physics.kickCooldown;
  actor.ignoreBallCollisionFrames = 5;

  if (isPass && passTarget) {
    ball.passTarget = passTarget;
    ball.passSource = actor;
    ball.passExpiry = 2.8;
    ball.passWasVision = false;
  } else {
    ball.passTarget = null;
    ball.passSource = null;
    ball.passExpiry = 0;
    ball.passWasVision = false;
    if (gameMode === '2v2' && twoVtwoStats) twoVtwoStats.passStreak = 0;
  }

  // Separa a bola do pé com segurança e aplica velocidade + spin Magnus preciso
  const placeDist = actor.radius + ball.radius + 3;
  ball.x = Math.max(CONFIG.pitch.left + ball.radius + 2, Math.min(CONFIG.pitch.right - ball.radius - 2, actor.x + dirX * placeDist));
  ball.y = Math.max(CONFIG.pitch.top + ball.radius + 2, Math.min(CONFIG.pitch.bottom - ball.radius - 2, actor.y + dirY * placeDist));
  ball.vx = dirX * plan.launchSpeed;
  ball.vy = dirY * plan.launchSpeed;

  ball.dribbleLockTimer = 0.48;
  ball.dribbleLockOwner = actor;
  ball.powerShotTimer = Math.max(ball.powerShotTimer, plan.flightDuration + 0.12);
  ball.curveTimer = plan.flightDuration + 0.12;
  ball.curveSide = plan.bendSide;
  ball.curveRate = Math.abs(plan.spinRate);
  ball.curveTrail = [{ x: ball.x, y: ball.y }];

  // Consome efeito armado e aplica recarga calibrada (12s)
  actor.powerEffect = null;
  actor.powerEffectTimer = 0;
  actor.powerCooldown = POWER_COOLDOWNS.curve;
  actor.nextKickPower = 1;
  actor.nextKickReach = 1;
  actor.vx -= dirX * 0.6;
  actor.vy -= dirY * 0.6;

  if (gameMode === 'training' && actor === player1) {
    trainingDummyHasBall = false;
  }

  curveShots.push({
    owner: actor,
    phase: 'flight',
    timer: plan.flightDuration + 0.14,
    phaseDuration: plan.flightDuration + 0.14,
    impactX: ball.x,
    impactY: ball.y,
    bendSide: plan.bendSide,
    trail: [{ x: ball.x, y: ball.y }]
  });

  addCurveVortexParticles(ball.x, ball.y, 18, true, ball.vx, ball.vy);
  addImpactSpark(ball.x, ball.y, '#38bdf8', 14, 1.35);
  Sound.playCurvedKick();

  if (actor.isHuman && typeof showPowerFeedback === 'function') {
    showPowerFeedback('🌀 Curva Impossível disparada!', false, false);
  }
  return true;
}

function triggerCurveImpact(x, y) {
  let triggered = false;
  for (const shot of curveShots) {
    if (shot.phase === 'flight') {
      shot.phase = 'fade';
      shot.timer = 0.28;
      shot.phaseDuration = 0.28;
      shot.impactX = x;
      shot.impactY = y;
      triggered = true;
    }
  }
  if (triggered) {
    addCurveVortexParticles(x, y, 16, true, 0, 0);
    addImpactSpark(x, y, '#a855f7', 12, 1.25);
  }
}

function updateCurveEffects(dt) {
  // Atualiza efeitos de voo e dissipação
  for (let i = curveShots.length - 1; i >= 0; i--) {
    const shot = curveShots[i];
    shot.timer = Math.max(0, shot.timer - dt);

    if (shot.phase === 'flight') {
      shot.trail.push({ x: ball.x, y: ball.y });
      if (shot.trail.length > 24) shot.trail.shift();

      if (Math.random() < 0.85) {
        addCurveVortexParticles(ball.x, ball.y, 1, false, ball.vx, ball.vy);
      }

      if (shot.timer <= 0 || ball.curveTimer <= 0) {
        shot.phase = 'fade';
        shot.timer = 0.28;
        shot.phaseDuration = 0.28;
        shot.impactX = ball.x;
        shot.impactY = ball.y;
      }
    } else if (shot.phase === 'fade') {
      if (shot.timer <= 0) {
        curveShots.splice(i, 1);
      }
    }
  }
}

function drawCurveChargeAndPreview(renderCtx, actor) {
  const now = performance.now();
  const plan = computeCurveSolution(actor, false, null);
  const pts = plan.previewPoints;

  renderCtx.save();
  renderCtx.lineCap = 'round';
  renderCtx.lineJoin = 'round';

  // 1. Espiral de energia ao redor do jogador e da bola
  const spinAngle = now / 180;
  for (let k = 0; k < 2; k++) {
    const a0 = spinAngle + k * Math.PI;
    renderCtx.beginPath();
    renderCtx.arc(ball.x, ball.y, ball.radius + 9, a0, a0 + Math.PI * 0.72);
    renderCtx.strokeStyle = k === 0 ? '#38bdf8' : '#c084fc';
    renderCtx.shadowColor = k === 0 ? '#38bdf8' : '#a855f7';
    renderCtx.shadowBlur = 12;
    renderCtx.lineWidth = 2.6;
    renderCtx.stroke();
  }

  renderCtx.beginPath();
  renderCtx.arc(actor.x, actor.y, actor.radius + 7, -spinAngle, -spinAngle + Math.PI * 1.15);
  renderCtx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
  renderCtx.lineWidth = 2.2;
  renderCtx.stroke();

  // 2. Prévia luminosa da curva (apenas para o jogador humano)
  if (actor.isHuman && pts.length > 1) {
    renderCtx.beginPath();
    renderCtx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      renderCtx.lineTo(pts[i].x, pts[i].y);
    }
    const grad = renderCtx.createLinearGradient(pts[0].x, pts[0].y, plan.targetX, plan.targetY);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.92)');
    grad.addColorStop(0.55, 'rgba(168, 85, 247, 0.85)');
    grad.addColorStop(1, 'rgba(250, 204, 21, 0.92)');

    renderCtx.strokeStyle = grad;
    renderCtx.shadowColor = '#38bdf8';
    renderCtx.shadowBlur = 12;
    renderCtx.lineWidth = 3.2;
    renderCtx.setLineDash([8, 7]);
    renderCtx.lineDashOffset = -(now / 26) % 30;
    renderCtx.stroke();
    renderCtx.setLineDash([]);

    // Pontos animados percorrendo a curva
    const phaseShift = (now / 420) % 1;
    for (let j = 0; j < 3; j++) {
      const idxF = ((j / 3 + phaseShift) % 1) * (pts.length - 1);
      const idx = Math.floor(idxF);
      const pt = pts[idx];
      if (!pt) continue;
      renderCtx.beginPath();
      renderCtx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      renderCtx.fillStyle = '#e0f2fe';
      renderCtx.fill();
    }

    // Alvo de mira pulsante no ponto final
    const pulse = 10 + Math.sin(now / 110) * 2.5;
    renderCtx.beginPath();
    renderCtx.arc(plan.targetX, plan.targetY, pulse, 0, Math.PI * 2);
    renderCtx.strokeStyle = '#fde047';
    renderCtx.shadowColor = '#f59e0b';
    renderCtx.shadowBlur = 14;
    renderCtx.lineWidth = 2.2;
    renderCtx.stroke();

    renderCtx.beginPath();
    renderCtx.arc(plan.targetX, plan.targetY, 3.2, 0, Math.PI * 2);
    renderCtx.fillStyle = '#fef08a';
    renderCtx.fill();
  }

  renderCtx.restore();
}

function drawCurveEffects(renderCtx) {
  const now = performance.now();

  // Desenha prévia de carga para quem estiver com 'curve' armado
  const actors = [player1, player2];
  if (gameMode === '2v2') actors.push(homeMate, awayMate);
  for (const actor of actors) {
    if (actor && actor.powerEffect === 'curve') {
      drawCurveChargeAndPreview(renderCtx, actor);
    }
  }

  // Desenha rastro em fita/vórtice e onda de impacto dos disparos ativos
  for (const shot of curveShots) {
    const progress = 1 - shot.timer / Math.max(0.01, shot.phaseDuration);
    renderCtx.save();
    renderCtx.lineCap = 'round';
    renderCtx.lineJoin = 'round';

    if (shot.trail.length > 1) {
      const fadeAlpha = shot.phase === 'fade' ? Math.max(0, 1 - progress) : 1;
      for (let i = 1; i < shot.trail.length; i++) {
        const a = shot.trail[i - 1];
        const b = shot.trail[i];
        const t = i / shot.trail.length;

        // Camada externa violeta-ciano brilhante
        renderCtx.beginPath();
        renderCtx.moveTo(a.x, a.y);
        renderCtx.lineTo(b.x, b.y);
        renderCtx.strokeStyle = i % 2 === 0
          ? `rgba(56, 189, 248, ${t * 0.72 * fadeAlpha})`
          : `rgba(168, 85, 247, ${t * 0.68 * fadeAlpha})`;
        renderCtx.lineWidth = 4 + t * 14;
        renderCtx.shadowColor = '#38bdf8';
        renderCtx.shadowBlur = 16;
        renderCtx.stroke();

        // Núcleo branco incandescente
        renderCtx.beginPath();
        renderCtx.moveTo(a.x, a.y);
        renderCtx.lineTo(b.x, b.y);
        renderCtx.strokeStyle = `rgba(240, 249, 255, ${t * 0.62 * fadeAlpha})`;
        renderCtx.lineWidth = 1.5 + t * 4.5;
        renderCtx.shadowBlur = 0;
        renderCtx.stroke();
      }
    }

    if (shot.phase === 'flight') {
      // Anéis de vórtice girando ao redor da bola em voo
      const rot = (now / 95) * shot.bendSide;
      renderCtx.shadowColor = '#a855f7';
      renderCtx.shadowBlur = 14;
      renderCtx.strokeStyle = '#7dd3fc';
      renderCtx.lineWidth = 2.6;
      renderCtx.beginPath();
      renderCtx.arc(ball.x, ball.y, ball.radius + 7, rot, rot + Math.PI * 0.85);
      renderCtx.stroke();

      renderCtx.strokeStyle = '#c084fc';
      renderCtx.beginPath();
      renderCtx.arc(ball.x, ball.y, ball.radius + 11, rot + Math.PI, rot + Math.PI * 1.85);
      renderCtx.stroke();
    } else if (shot.phase === 'fade') {
      // Onda de impacto no final do voo ou colisão
      const alpha = Math.max(0, 1 - progress);
      renderCtx.globalAlpha = alpha * 0.85;
      renderCtx.strokeStyle = '#7dd3fc';
      renderCtx.shadowColor = '#a855f7';
      renderCtx.shadowBlur = 18;
      renderCtx.lineWidth = 3.2;
      renderCtx.beginPath();
      renderCtx.arc(shot.impactX, shot.impactY, 12 + progress * 44, 0, Math.PI * 2);
      renderCtx.stroke();
    }

    renderCtx.restore();
  }
}
