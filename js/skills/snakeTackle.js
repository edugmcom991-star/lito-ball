/**
 * ==========================================================================
 * LITO BALL - REWORK: BOTE DA SERPENTE (js/skills/snakeTackle.js)
 * ==========================================================================
 * Habilidade refeita do zero:
 *  - Recorte limpo da sprite `img/cobra do aiku.png` com fallback vetorial
 *  - Verificação justa de alcance (nem colado demais, nem longe demais)
 *  - Bote instantâneo na direção do alvo com desarme determinístico (sem RNG)
 *  - Cooldown calibrado (20s) com feedback claro no HUD
 */
'use strict';

const snakeTackles = [];

const SNAKE_MIN_RANGE = 28;
const SNAKE_MAX_RANGE = 235;

const snakeHeroFrame = { x: 215, y: 100, w: 1060, h: 358 };
const snakeAtlasFrames = [
  { x: 68, y: 636, w: 192, h: 204 },
  { x: 374, y: 632, w: 300, h: 206 },
  { x: 728, y: 620, w: 392, h: 240 },
  { x: 1140, y: 620, w: 325, h: 242 }
];

let snakeSpriteCanvas = null;

// Carrega `img/cobra do aiku.png` e remove fundo de gramado e linhas do campo
assets.loadSprite('snakeAiku', 'img/cobra do aiku.png').then(image => {
  try {
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = image.naturalWidth;
    spriteCanvas.height = image.naturalHeight;
    const spriteCtx = spriteCanvas.getContext('2d', { willReadFrequently: true });
    spriteCtx.drawImage(image, 0, 0);

    const pixels = spriteCtx.getImageData(0, 0, spriteCanvas.width, spriteCanvas.height);
    const data = pixels.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);

      // Mantém pixels escuros do corpo da cobra e destaques roxos/lavanda
      const isLavenderAura = b > g + 5 && b >= r - 6;
      const isDarkBody = max < 92 && g <= r + 5 && g <= b + 4;
      if (isLavenderAura || isDarkBody) continue;

      // Remove gramado verde e linhas brancas/cinzas do campo
      const isGrass = g > r + 6 && g >= b;
      const isFieldLine = (max - min) < 22 && g > 74 && b <= g + 4;
      if (isGrass || isFieldLine) {
        data[i + 3] = 0;
      } else if (g > r && g > b) {
        // Suaviza bordas esverdeadas residuais
        data[i + 3] = Math.round(data[i + 3] * 0.35);
      }
    }

    spriteCtx.putImageData(pixels, 0, 0);
    snakeSpriteCanvas = spriteCanvas;
  } catch (e) {
    // Em file:// restrito, getImageData pode falhar por SecurityError; usa fallback vetorial elegante
    snakeSpriteCanvas = null;
  }
}).catch(() => {});

function getSnakeOpponents(actor) {
  if (typeof getOpponentsOf === 'function') return getOpponentsOf(actor);
  if (actor === player1 || actor?.isHuman || actor?.isTeammate) {
    return gameMode === '2v2' ? [player2, awayMate] : [player2];
  }
  return gameMode === '2v2' ? [player1, homeMate] : [player1];
}

function findSnakeTackleTarget(actor) {
  const opponents = getSnakeOpponents(actor);
  const controlledCarrier = findControlledActor(opponents);

  // No modo treino, considera também o adversário de treino segurando a bola
  let carrier = controlledCarrier;
  if (!carrier && gameMode === 'training' && actor === player1) {
    const dummyNearBall = Math.hypot(ball.x - player2.x, ball.y - player2.y) <= player2.radius + ball.radius + 32;
    if (trainingDummyHasBall || dummyNearBall) {
      carrier = player2;
    }
  }

  // Se nenhum rival está com posse exata, verifica rival disputando bola próxima
  if (!carrier) {
    const nearestOpp = opponents.reduce((best, opp) => {
      const d = Math.hypot(opp.x - ball.x, opp.y - ball.y);
      return (!best || d < best.dist) ? { opp, dist: d } : best;
    }, null);
    if (nearestOpp && nearestOpp.dist <= nearestOpp.opp.radius + ball.radius + 42) {
      carrier = nearestOpp.opp;
    }
  }

  // Ponto de mira: prioriza a bola quando o portador está com ela ou a bola disputada
  const targetX = carrier ? (ball.x * 0.65 + carrier.x * 0.35) : ball.x;
  const targetY = carrier ? (ball.y * 0.65 + carrier.y * 0.35) : ball.y;
  const distToTarget = Math.hypot(targetX - actor.x, targetY - actor.y);
  const distToBall = Math.hypot(ball.x - actor.x, ball.y - actor.y);
  const distToCarrier = carrier ? Math.hypot(carrier.x - actor.x, carrier.y - actor.y) : Infinity;

  return {
    carrier,
    targetX,
    targetY,
    dist: Math.min(distToTarget, distToBall, distToCarrier)
  };
}

function canUseSnakeTackle(actor) {
  if (!['match', '2v2', '3v3', '4v4', '5v5', 'training'].includes(gameMode)) {
    return { ok: false, reason: 'Modo inválido para o Bote da Serpente' };
  }

  // Evita ativar se o próprio jogador já está conduzindo a bola isolado sem rival disputando
  const opponents = getSnakeOpponents(actor);
  const anyOppNearBall = opponents.some(opp => Math.hypot(opp.x - ball.x, opp.y - ball.y) <= opp.radius + ball.radius + 54) ||
    (gameMode === 'training' && trainingDummyHasBall);

  const info = findSnakeTackleTarget(actor);
  if (!info.carrier && !anyOppNearBall && info.dist > 140) {
    return { ok: false, reason: 'Aproxime-se do adversário com a bola para dar o bote' };
  }

  if (info.dist < SNAKE_MIN_RANGE) {
    return { ok: false, reason: 'Perto demais! Dê um passo atrás para encaixar o bote' };
  }

  if (info.dist > SNAKE_MAX_RANGE) {
    return { ok: false, reason: 'Fora de alcance! Aproxime-se do rival ou da bola' };
  }

  return { ok: true, info };
}

function addSnakeParticles(x, y, count = 10, burst = false) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (burst ? 1.8 : 0.7) + Math.random() * (burst ? 3.4 : 1.8);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.7 + Math.random() * 0.25,
      decay: burst ? 0.04 + Math.random() * 0.03 : 0.055 + Math.random() * 0.035,
      color: i % 3 === 0 ? '#f3e8ff' : i % 2 === 0 ? '#a855f7' : '#6d28d9',
      size: burst ? 2.8 : 2.1
    });
  }
}

function clampSnakePoint(x, y, radius) {
  const p = CONFIG.pitch;
  return {
    x: Math.max(p.left + radius + 4, Math.min(p.right - radius - 4, x)),
    y: Math.max(p.top + radius + 4, Math.min(p.bottom - radius - 4, y))
  };
}

function startSnakeTackle(actor) {
  const check = canUseSnakeTackle(actor);
  if (!check.ok) {
    if (actor.isHuman && typeof showPowerFeedback === 'function') {
      showPowerFeedback(check.reason, true, false);
    }
    return false;
  }

  const { info } = check;
  const dx = info.targetX - actor.x;
  const dy = info.targetY - actor.y;
  const rawDist = Math.hypot(dx, dy) || 1;
  const dirX = dx / rawDist;
  const dirY = dy / rawDist;

  // Define direção do jogador rumo ao alvo
  actor.facingX = dirX;
  actor.facingY = dirY;

  // Destino do bote (alcança imediatamente o ponto de contato sem atravessar as paredes)
  const strikeTravel = Math.min(Math.max(rawDist - 10, 28), 165);
  const clampedEnd = clampSnakePoint(actor.x + dirX * strikeTravel, actor.y + dirY * strikeTravel, actor.radius);

  // Cooldown calibrado aplicado imediatamente na ativação
  actor.powerCooldown = POWER_COOLDOWNS.snakeTackle;
  actor.snakeLungeTimer = 0.19;

  // Impulso inicial instantâneo e agressivo
  actor.vx = dirX * 9.5;
  actor.vy = dirY * 9.5;

  const tackle = {
    owner: actor,
    targetCarrier: info.carrier,
    phase: 'lunge',
    timer: 0.16,
    phaseDuration: 0.16,
    startX: actor.x,
    startY: actor.y,
    endX: clampedEnd.x,
    endY: clampedEnd.y,
    dirX,
    dirY,
    range: Math.max(76, Math.min(220, rawDist + 26)),
    disarmed: false,
    trail: [{ x: actor.x, y: actor.y }]
  };

  snakeTackles.push(tackle);
  addSnakeParticles(actor.x, actor.y, 12, true);
  Sound.playSnakeStrike();

  return true;
}

function resolveSnakeDisarm(tackle) {
  if (tackle.disarmed) return;
  tackle.disarmed = true;

  const actor = tackle.owner;
  const opponents = getSnakeOpponents(actor);
  const targetCarrier = tackle.targetCarrier && opponents.includes(tackle.targetCarrier)
    ? tackle.targetCarrier
    : findControlledActor(opponents) || opponents.find(opp => Math.hypot(opp.x - ball.x, opp.y - ball.y) < 70);

  // Recalcula direção final da bola para frente do jogador após o bote
  const dxBall = ball.x - actor.x;
  const dyBall = ball.y - actor.y;
  const ballDist = Math.hypot(dxBall, dyBall);
  const dirX = tackle.dirX;
  const dirY = tackle.dirY;

  // Verifica se o alvo ou a bola estão na zona do bote (alcance generoso no momento do contato)
  const withinStrike = ballDist <= actor.radius + ball.radius + 95 ||
    (targetCarrier && Math.hypot(targetCarrier.x - actor.x, targetCarrier.y - actor.y) <= actor.radius + targetCarrier.radius + 88);

  if (!withinStrike) {
    if (actor.isHuman && typeof showPowerFeedback === 'function') {
      showPowerFeedback('O rival escapou para fora da área do bote', true, false);
    }
    return;
  }

  // Atordoa e afasta levemente o portador rival para garantir desarme limpo e sem RNG
  if (targetCarrier) {
    targetCarrier.tackleStaggerTimer = 0.72;
    targetCarrier.vx = -dirX * 1.9 + (targetCarrier.x > actor.x ? 0.9 : -0.9);
    targetCarrier.vy = -dirY * 1.9 + (Math.random() - 0.5) * 0.6;
    if (actor === player1) {
      if (typeof CAREER !== 'undefined') CAREER.recordTackle();
      if (typeof MatchRating !== 'undefined') MatchRating.recordTackle(player1);
    }
  }

  if (gameMode === 'training') {
    trainingDummyHasBall = false;
  }

  // Limpa qualquer posse/passe/curva anterior e entrega domínio limpo para quem deu o bote
  ball.passTarget = null;
  ball.passSource = null;
  ball.passExpiry = 0;
  ball.passWasVision = false;
  ball.curveTimer = 0;
  ball.curveTrail = [];
  ball.powerShotTimer = 0;
  ball.dribbleLockOwner = actor;
  ball.dribbleLockTimer = 0.45;

  const placeDist = actor.radius + ball.radius + 5;
  const clampedBall = clampSnakePoint(actor.x + dirX * placeDist, actor.y + dirY * placeDist, ball.radius);
  ball.x = clampedBall.x;
  ball.y = clampedBall.y;
  ball.vx = dirX * 4.4;
  ball.vy = dirY * 4.4;

  actor.ignoreBallCollisionFrames = 3;
  actor.vx = dirX * 3.8;
  actor.vy = dirY * 3.8;

  addImpactSpark(ball.x, ball.y, '#e9d5ff', 14, 1.35);
  addSnakeParticles(ball.x, ball.y, 18, true);

  if (actor.isHuman && typeof showPowerFeedback === 'function') {
    showPowerFeedback('🐍 Bote da Serpente! Bola desarmada!', false, false);
  }
}

function updateSnakeTackles(dt) {
  for (let i = snakeTackles.length - 1; i >= 0; i--) {
    const tackle = snakeTackles[i];
    const actor = tackle.owner;
    tackle.timer = Math.max(0, tackle.timer - dt);

    if (tackle.phase === 'lunge') {
      const progress = 1 - tackle.timer / tackle.phaseDuration;
      // Mantém propulsão controlada até o ponto de contato
      if (tackle.timer > 0) {
        actor.vx = tackle.dirX * (9.4 - progress * 3.8);
        actor.vy = tackle.dirY * (9.4 - progress * 3.8);
      }
      tackle.trail.push({ x: actor.x, y: actor.y });
      if (tackle.trail.length > 10) tackle.trail.shift();

      if (Math.random() < 0.7) {
        addSnakeParticles(actor.x - tackle.dirX * 12, actor.y - tackle.dirY * 12, 2, false);
      }

      // Dispara o desarme assim que o bote entra em contato ou chega na metade final do avanço
      const nearBallNow = Math.hypot(ball.x - actor.x, ball.y - actor.y) <= actor.radius + ball.radius + 36;
      if (!tackle.disarmed && (nearBallNow || progress >= 0.55)) {
        resolveSnakeDisarm(tackle);
      }

      if (tackle.timer <= 0) {
        if (!tackle.disarmed) resolveSnakeDisarm(tackle);
        tackle.phase = 'strike';
        tackle.timer = 0.16;
        tackle.phaseDuration = 0.16;
        addSnakeParticles(actor.x + tackle.dirX * 48, actor.y + tackle.dirY * 48, 10, true);
      }
    } else if (tackle.phase === 'strike') {
      if (tackle.timer <= 0) {
        tackle.phase = 'fade';
        tackle.timer = 0.24;
        tackle.phaseDuration = 0.24;
      }
    } else if (tackle.phase === 'fade') {
      if (tackle.timer <= 0) {
        snakeTackles.splice(i, 1);
      }
    }
  }
}

function drawProceduralSerpent(renderCtx, length, height, alpha) {
  renderCtx.save();
  renderCtx.globalAlpha = alpha;
  renderCtx.lineCap = 'round';
  renderCtx.lineJoin = 'round';

  // Corpo sinuoso em S
  renderCtx.beginPath();
  renderCtx.moveTo(0, 0);
  renderCtx.bezierCurveTo(length * 0.28, -height * 0.42, length * 0.58, height * 0.42, length * 0.88, -height * 0.06);

  renderCtx.strokeStyle = '#c4b5fd';
  renderCtx.lineWidth = height * 0.34;
  renderCtx.shadowColor = '#a855f7';
  renderCtx.shadowBlur = 16;
  renderCtx.stroke();

  renderCtx.strokeStyle = '#1f162b';
  renderCtx.lineWidth = height * 0.24;
  renderCtx.shadowBlur = 0;
  renderCtx.stroke();

  // Cabeça e presas da serpente
  const hx = length * 0.90;
  const hy = -height * 0.06;
  renderCtx.fillStyle = '#2e1065';
  renderCtx.strokeStyle = '#e9d5ff';
  renderCtx.lineWidth = 2.5;
  renderCtx.beginPath();
  renderCtx.moveTo(hx - 10, hy - height * 0.14);
  renderCtx.lineTo(hx + 22, hy);
  renderCtx.lineTo(hx - 8, hy + height * 0.16);
  renderCtx.closePath();
  renderCtx.fill();
  renderCtx.stroke();

  // Olho brilhante
  renderCtx.fillStyle = '#f5d0fe';
  renderCtx.beginPath();
  renderCtx.arc(hx + 6, hy - 3, 3.2, 0, Math.PI * 2);
  renderCtx.fill();

  renderCtx.restore();
}

function drawSnakeTackles(renderCtx) {
  for (const tackle of snakeTackles) {
    const actor = tackle.owner;
    const angle = Math.atan2(tackle.dirY, tackle.dirX);
    const progress = 1 - tackle.timer / tackle.phaseDuration;

    renderCtx.save();
    renderCtx.lineCap = 'round';
    renderCtx.lineJoin = 'round';

    // Trilha luminosa do bote no gramado
    if (tackle.trail.length > 1) {
      for (let j = 1; j < tackle.trail.length; j++) {
        const a = tackle.trail[j - 1];
        const b = tackle.trail[j];
        const t = j / tackle.trail.length;
        renderCtx.beginPath();
        renderCtx.moveTo(a.x, a.y);
        renderCtx.lineTo(b.x, b.y);
        renderCtx.strokeStyle = `rgba(168, 85, 247, ${t * 0.65})`;
        renderCtx.lineWidth = 6 + t * 14;
        renderCtx.shadowColor = '#a855f7';
        renderCtx.shadowBlur = 14;
        renderCtx.stroke();
      }
      renderCtx.shadowBlur = 0;
    }

    // Ondas de impacto no momento da mordida
    if (tackle.phase === 'strike' || tackle.phase === 'fade') {
      const waveProgress = tackle.phase === 'strike' ? progress * 0.6 : 0.6 + progress * 0.4;
      const ringX = actor.x + tackle.dirX * (actor.radius + 18);
      const ringY = actor.y + tackle.dirY * (actor.radius + 18);
      renderCtx.beginPath();
      renderCtx.arc(ringX, ringY, 18 + waveProgress * 44, 0, Math.PI * 2);
      renderCtx.strokeStyle = `rgba(216, 180, 254, ${Math.max(0, 1 - waveProgress) * 0.85})`;
      renderCtx.lineWidth = 3.5;
      renderCtx.shadowColor = '#9333ea';
      renderCtx.shadowBlur = 16;
      renderCtx.stroke();
      renderCtx.shadowBlur = 0;
    }

    // Renderização do sprite da cobra (`img/cobra do aiku.png`)
    const originX = tackle.phase === 'lunge'
      ? tackle.startX - tackle.dirX * 10
      : actor.x - tackle.dirX * 26;
    const originY = tackle.phase === 'lunge'
      ? tackle.startY - tackle.dirY * 10
      : actor.y - tackle.dirY * 26;

    renderCtx.translate(originX, originY);
    renderCtx.rotate(angle);

    let length = tackle.range;
    let height = 74;
    let alpha = 0.94;
    let frame = snakeHeroFrame;

    if (tackle.phase === 'lunge') {
      const frameIdx = progress < 0.35 ? 0 : progress < 0.72 ? 1 : 2;
      frame = snakeAtlasFrames[frameIdx];
      length = 72 + progress * (tackle.range - 30);
      height = 50 + progress * 34;
      alpha = 0.96;
    } else if (tackle.phase === 'strike') {
      frame = snakeHeroFrame;
      length = tackle.range + 22;
      height = 84;
      alpha = 0.98;
    } else {
      frame = snakeAtlasFrames[3];
      length = tackle.range * 0.92;
      height = 86;
      alpha = Math.max(0, (1 - progress) * 0.82);
    }

    if (snakeSpriteCanvas) {
      renderCtx.globalAlpha = alpha;
      renderCtx.shadowColor = '#a855f7';
      renderCtx.shadowBlur = tackle.phase === 'strike' ? 20 : 12;
      renderCtx.drawImage(
        snakeSpriteCanvas,
        frame.x,
        frame.y,
        frame.w,
        frame.h,
        0,
        -height / 2,
        length,
        height
      );
    } else {
      drawProceduralSerpent(renderCtx, length, height, alpha);
    }

    renderCtx.restore();
  }
}

function serializeSnakeTackle(tackle) {
  const ownerKey = tackle.owner === player1
    ? 'player1'
    : tackle.owner === homeMate
      ? 'homeMate'
      : tackle.owner === awayMate
        ? 'awayMate'
        : 'player2';
  const carrierKey = tackle.targetCarrier === player1
    ? 'player1'
    : tackle.targetCarrier === homeMate
      ? 'homeMate'
      : tackle.targetCarrier === awayMate
        ? 'awayMate'
        : tackle.targetCarrier === player2
          ? 'player2'
          : null;
  const { owner, targetCarrier, ...state } = tackle;
  return { ...state, ownerKey, carrierKey };
}

function restoreSnakeTackle(state) {
  const map = { player1, player2, homeMate, awayMate };
  const { ownerKey, carrierKey, ...tackle } = state;
  return {
    ...tackle,
    owner: map[ownerKey] || player1,
    targetCarrier: carrierKey ? (map[carrierKey] || null) : null
  };
}
