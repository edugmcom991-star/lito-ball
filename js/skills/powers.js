/**
 * ==========================================================================
 * LITO BALL - SISTEMA DE HABILIDADES E PODERES (js/skills/powers.js)
 * ==========================================================================
 */
'use strict';

let visionPassRoute = null;
let powerReadyLast = true;
function phantomLevelFor(actor) {
  return actor.isHuman ? Math.max(1, Math.min(3, Number(profile.powerLevels.phantom) || 1)) : 1;
}

function phantomStats(actor) {
  const level = phantomLevelFor(actor);
  return {
    level,
    duration: [0, 0.55, 0.60, 0.65][level],
    dodgeChance: [0, 0.38, 0.44, 0.50][level],
    cutForce: [0, 4.0, 4.3, 4.6][level],
    cooldown: [0, 12, 11.25, 10.5][level]
  };
}

function choosePhantomCut(actor) {
  const sideX = -actor.facingY;
  const sideY = actor.facingX;
  const bot = actor.isHuman ? player2 : player1;
  const score = sign => {
    const x = actor.x + sideX * sign * 64;
    const y = actor.y + sideY * sign * 64;
    const s = CONFIG.stadium;
    const clearance = Math.min(x - s.minX, s.maxX - x, y - s.minY, s.maxY - y);
    return Math.hypot(x - bot.x, y - bot.y) + Math.min(clearance, 64) * 0.35;
  };
  const sign = score(1) >= score(-1) ? 1 : -1;
  return { x: sideX * sign, y: sideY * sign };
}

function phantomEvadesBote(holder, defender) {
  if (holder.powerEffect !== 'phantom' || holder.powerEffectTimer <= 0) return false;
  // Se estiver executando o Chapeuzinho da Abelha, ignora contato do defensor
  if (ball.sombreroTimer > 0 && ball.elevation > 8 && defender === ball.sombreroDribbledDefender) {
    return true;
  }
  const inRange = Math.hypot(defender.x - ball.x, defender.y - ball.y) <= defender.radius + ball.radius + 8;
  if (inRange && !holder.ghostDodgeUsed) {
    holder.ghostDodgeUsed = true;
    holder.ghostDodgeSuccess = Math.random() < phantomStats(holder).dodgeChance;
    if (holder.ghostDodgeSuccess && holder.isHuman) {
      showPowerFeedback('O Monstro driblou o marcador!', true);
    }
  }
  return holder.ghostDodgeSuccess;
}

function shouldBallContact(collidingPlayer, ghostHolders) {
  // Ignora colisão se a bola estiver voando no Sombrero Flick por cima do defensor
  if (ball.sombreroTimer > 0 && ball.elevation > 8 && collidingPlayer === ball.sombreroDribbledDefender) {
    return false;
  }
  return !ghostHolders.some(holder => phantomEvadesBote(holder, collidingPlayer));
}

function updatePhantomBallCarry(actor) {
  if (actor.powerEffect !== 'phantom' || actor.phantomDribbleTimer <= 0 || (ball.dribbleLockTimer > 0 && ball.dribbleLockOwner === actor) || input.kickRequested) return;
  // Durante o chapéu da abelha, a bola segue trajetória aérea suave
  if (ball.sombreroTimer > 0) return;

  const inputX = actor.isHuman ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0;
  const inputY = actor.isHuman ? (input.down ? 1 : 0) - (input.up ? 1 : 0) : 0;
  if (inputX || inputY) {
    const len = Math.hypot(inputX, inputY);
    actor.phantomDirectionX = inputX / len;
    actor.phantomDirectionY = inputY / len;
  } else if (Math.hypot(actor.vx, actor.vy) > 0.8) {
    const len = Math.hypot(actor.vx, actor.vy);
    actor.phantomDirectionX = actor.vx / len;
    actor.phantomDirectionY = actor.vy / len;
  }
  const targetX = actor.x + actor.phantomDirectionX * (actor.radius + ball.radius + 4);
  const targetY = actor.y + actor.phantomDirectionY * (actor.radius + ball.radius + 4);
  const errorX = targetX - ball.x;
  const errorY = targetY - ball.y;
  const correction = value => Math.max(-2.1, Math.min(2.1, value * 0.12));
  ball.vx += (actor.vx - ball.vx) * 0.08 + correction(errorX);
  ball.vy += (actor.vy - ball.vy) * 0.08 + correction(errorY);
}

function updatePlayerDribbleControl(actor) {
  if (
    actor.tackleStaggerTimer > 0 ||
    actor.powerEffect === 'phantom' ||
    (typeof twoOnePlay !== 'undefined' && twoOnePlay && (actor === twoOnePlay.owner || actor === twoOnePlay.target)) ||
    ball.curveTimer > 0 ||
    ball.powerShotTimer > 0 ||
    (ball.dribbleLockTimer > 0 && ball.dribbleLockOwner === actor) ||
    (actor.isHuman && input.kickRequested)
  ) return;

  const dx = ball.x - actor.x;
  const dy = ball.y - actor.y;
  const dist = Math.hypot(dx, dy);
  const contactRange = actor.radius + ball.radius + 18;
  if (dist > contactRange || Math.hypot(ball.vx - actor.vx, ball.vy - actor.vy) > 8.5) return;

  let faceX = actor.facingX;
  let faceY = actor.facingY;
  if (actor.isHuman) {
    const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const moveY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (!moveX && !moveY && Math.hypot(actor.vx, actor.vy) < 0.35) return;
    if (moveX || moveY) {
      const length = Math.hypot(moveX, moveY);
      faceX = moveX / length;
      faceY = moveY / length;
    }
  } else if (Math.hypot(actor.vx, actor.vy) < 0.35) {
    return;
  }

  const targetDistance = actor.radius + ball.radius + 4;
  const targetX = actor.x + faceX * targetDistance;
  const targetY = actor.y + faceY * targetDistance;
  const correction = value => Math.max(-2.2, Math.min(2.2, value * 0.14));
  ball.vx += (actor.vx - ball.vx) * 0.38 + correction(targetX - ball.x);
  ball.vy += (actor.vy - ball.vy) * 0.38 + correction(targetY - ball.y);
}

function nearestPassTeammate(actor) {
  const candidates = [homeMate].filter(teammate => teammate !== actor);
  return candidates.sort((a, b) => Math.hypot(a.x - actor.x, a.y - actor.y) - Math.hypot(b.x - actor.x, b.y - actor.y))[0] || null;
}

function visionPassTargets(actor) {
  if (gameMode !== '2v2' && gameMode !== 'training') return [];
  return actor === player1 || actor === homeMate ? [actor === player1 ? homeMate : player1] : [];
}

function getVisionPassTarget(actor) {
  const targets = visionPassTargets(actor);
  if (!targets.length) return null;
  if (targets.length === 1 || !curveMouseAim?.active) return targets[0];
  return targets.reduce((closest, target) =>
    Math.hypot(target.x - curveMouseAim.x, target.y - curveMouseAim.y) <
      Math.hypot(closest.x - curveMouseAim.x, closest.y - curveMouseAim.y) ? target : closest
  );
}

function getVisionPassControlPoint(from, to, actor) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const bend = Math.min(128, Math.max(42, length * 0.17));
  const midX = (from.x + to.x) * 0.5;
  const midY = (from.y + to.y) * 0.5;
  const normalX = -dy / length;
  const normalY = dx / length;
  const opponents = actor === player1 || actor === homeMate
    ? [player2, ...(gameMode === '2v2' ? [awayMate] : [])]
    : [player1, ...(gameMode === '2v2' ? [homeMate] : [])];
  const scoreSide = side => {
    const pitch = CONFIG.pitch;
    const cx = Math.max(pitch.left + 32, Math.min(pitch.right - 32, midX + normalX * bend * side));
    const cy = Math.max(pitch.top + 32, Math.min(pitch.bottom - 32, midY + normalY * bend * side));
    let clearance = Infinity;
    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      const u = 1 - t;
      const x = u * u * from.x + 2 * u * t * cx + t * t * to.x;
      const y = u * u * from.y + 2 * u * t * cy + t * t * to.y;
      for (const opponent of opponents) {
        clearance = Math.min(clearance, Math.hypot(x - opponent.x, y - opponent.y) - opponent.radius);
      }
      for (const post of posts) {
        clearance = Math.min(clearance, Math.hypot(x - post.x, y - post.y) - post.radius - 8);
      }
    }
    return clearance;
  };
  const side = scoreSide(1) >= scoreSide(-1) ? 1 : -1;
  const pitch = CONFIG.pitch;
  return {
    x: Math.max(pitch.left + 32, Math.min(pitch.right - 32, midX + normalX * bend * side)),
    y: Math.max(pitch.top + 32, Math.min(pitch.bottom - 32, midY + normalY * bend * side))
  };
}

function getVisionPassPath(from, to, control) {
  const points = [];
  let length = 0;
  let previous = from;
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const u = 1 - t;
    const point = {
      x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
      y: u * u * from.y + 2 * u * t * control.y + t * t * to.y
    };
    if (i) length += Math.hypot(point.x - previous.x, point.y - previous.y);
    points.push(point);
    previous = point;
  }
  return { points, length };
}

function launchVisionLongPass(actor, target) {
  if (!target || !actor.tryKick(ball, 0, 0, true, target)) return false;
  // Checa limite de passes teleguiados por ativação
  if (typeof actor.visionPassesLeft === 'number') {
    if (actor.visionPassesLeft <= 0) {
      if (actor.isHuman) showPowerFeedback('Passes teleguiados esgotados nesta ativação!', true);
      return false;
    }
    actor.visionPassesLeft--;
    if (actor.isHuman && actor.visionPassesLeft === 1) showPowerFeedback('1 passe teleguiado restante', true, false);
    if (actor.isHuman && actor.visionPassesLeft === 0) showPowerFeedback('Passes teleguiados esgotados!', true, false);
  }
  const start = { x: ball.x, y: ball.y };
  const end = { x: target.x, y: target.y };
  const control = getVisionPassControlPoint(start, end, actor);
  const path = getVisionPassPath(start, end, control);
  const duration = Math.max(0.45, Math.min(3.0, path.length / (7.2 * 60)));
  ball.visionPassTrail.length = 0;
  ball.visionPassFlight = { start, control, elapsed: 0, duration, completed: false };
  ball.passExpiry = duration + 0.8;
  ball.visionPassAssistTimer = 0;
  ball.visionPassAssistEnabled = false;
  return true;
}

function updateVisionLongPassFlight(dt) {
  const flight = ball.visionPassFlight;
  const target = ball.passTarget;
  if (!flight || flight.completed || !target) return;
  const nextElapsed = Math.min(flight.duration, flight.elapsed + dt);
  const t = nextElapsed / flight.duration;
  const u = 1 - t;
  const nextX = u * u * flight.start.x + 2 * u * t * flight.control.x + t * t * target.x;
  const nextY = u * u * flight.start.y + 2 * u * t * flight.control.y + t * t * target.y;
  const damping = CONFIG.physics.dampingBall || 1;
  const settle = Math.max(0, Math.min(1, (t - 0.86) / 0.14));
  const pathVx = nextX - ball.x;
  const pathVy = nextY - ball.y;
  ball.vx = (pathVx * (1 - settle) + target.vx * settle) / damping;
  ball.vy = (pathVy * (1 - settle) + target.vy * settle) / damping;
  flight.elapsed = nextElapsed;
  if (flight.elapsed >= flight.duration) flight.completed = true;
}

function stopVisionPassFlightOnInterception() {
  if (!ball.visionPassFlight || ball.visionPassFlight.completed) return;
  const opponents = [player2, ...(gameMode === '2v2' ? [awayMate] : [])];
  if (opponents.some(opponent => Math.hypot(ball.x - opponent.x, ball.y - opponent.y) <= opponent.radius + ball.radius + 1)) {
    ball.visionPassFlight.completed = true;
  }
}

function drawVisionLongPassPreview(renderCtx) {
  if ((gameMode !== '2v2' && gameMode !== 'training') || player1.powerEffect !== 'vision' || player1.powerEffectTimer <= 0 || !isBallControlledBy(player1)) return;
  const target = getVisionPassTarget(player1);
  if (!target) return;
  const from = { x: ball.x, y: ball.y };
  const to = { x: target.x, y: target.y };
  const control = getVisionPassControlPoint(from, to, player1);

  renderCtx.save();
  renderCtx.beginPath();
  renderCtx.rect(CONFIG.pitch.left, CONFIG.pitch.top, CONFIG.pitch.width, CONFIG.pitch.height);
  renderCtx.clip();
  renderCtx.lineCap = 'round';
  renderCtx.lineJoin = 'round';
  renderCtx.globalAlpha = 0.48;
  renderCtx.strokeStyle = '#f472b6';
  renderCtx.lineWidth = 9;
  renderCtx.beginPath();
  renderCtx.moveTo(from.x, from.y);
  renderCtx.quadraticCurveTo(control.x, control.y, to.x, to.y);
  renderCtx.stroke();
  renderCtx.globalAlpha = 0.86;
  renderCtx.strokeStyle = '#fbcfe8';
  renderCtx.lineWidth = 2.2;
  renderCtx.setLineDash([4, 7]);
  renderCtx.beginPath();
  renderCtx.moveTo(from.x, from.y);
  renderCtx.quadraticCurveTo(control.x, control.y, to.x, to.y);
  renderCtx.stroke();
  renderCtx.setLineDash([]);
  renderCtx.globalAlpha = 0.9;
  renderCtx.strokeStyle = '#f9a8d4';
  renderCtx.lineWidth = 2.5;
  renderCtx.beginPath();
  renderCtx.arc(target.x, target.y, target.radius + 13, 0, Math.PI * 2);
  renderCtx.stroke();
  renderCtx.fillStyle = '#fce7f3';
  renderCtx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  renderCtx.textAlign = 'center';
  renderCtx.textBaseline = 'bottom';
  renderCtx.fillText('ALVO DO PASSE', target.x, target.y - target.radius - 17);
  renderCtx.restore();
}

function updateVisionPassAssist(dt) {
  if (ball.visionPassAssistTimer <= 0) return;
  ball.visionPassAssistTimer = Math.max(0, ball.visionPassAssistTimer - dt);
  const passer = ball.passSource;
  const target = ball.passTarget;
  if (!ball.visionPassAssistEnabled || !passer || !target || passer.powerEffect !== 'vision' || passer.powerEffectTimer <= 0) return;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed < 3) return;
  const ux = ball.vx / speed;
  const uy = ball.vy / speed;
  const lookAhead = Math.min(250, speed * 24);
  const endX = ball.x + ux * lookAhead;
  const endY = ball.y + uy * lookAhead;
  const along = (target.x - ball.x) * ux + (target.y - ball.y) * uy;
  if (along < 18 || along > lookAhead || pointSegmentDistance(target.x, target.y, ball.x, ball.y, endX, endY) > 46) return;
  const bluePass = passer === player1 || passer === homeMate;
  const blockers = bluePass ? [player2, ...(gameMode === '2v2' ? [awayMate] : [])] : [player1, ...(gameMode === '2v2' ? [homeMate] : [])];
  const blockRadius = ball.radius + 4;
  if (blockers.some(opponent => pointSegmentDistance(opponent.x, opponent.y, ball.x, ball.y, target.x, target.y) < opponent.radius + blockRadius)) return;
  for (const post of posts) {
    if (pointSegmentDistance(post.x, post.y, ball.x, ball.y, target.x, target.y) < post.radius + ball.radius + 3) return;
  }
  const toX = target.x - ball.x;
  const toY = target.y - ball.y;
  const angle = Math.atan2(ux * toY - uy * toX, ux * toX + uy * toY);
  if (Math.abs(angle) > 0.5) return;
  const turn = Math.max(-0.0035, Math.min(0.0035, angle));
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  ball.vx = (ux * cos - uy * sin) * speed;
  ball.vy = (ux * sin + uy * cos) * speed;
}

function chooseVisionRunDirection(mate) {
  const p = CONFIG.pitch;
  const candidates = [{ x: 1, y: -0.45 }, { x: 1, y: 0.45 }, { x: 0.8, y: -0.75 }, { x: 0.8, y: 0.75 }];
  return candidates.map(dir => {
    const len = Math.hypot(dir.x, dir.y);
    const nx = dir.x / len;
    const ny = dir.y / len;
    const tx = mate.x + nx * 96;
    const ty = mate.y + ny * 96;
    if (tx < p.left + mate.radius || tx > p.right - mate.radius || ty < p.top + mate.radius || ty > p.bottom - mate.radius) {
      return { dir, score: -Infinity };
    }
    const space = Math.min(Math.hypot(tx - player2.x, ty - player2.y), Math.hypot(tx - awayMate.x, ty - awayMate.y));
    const playerClear = Math.hypot(tx - player1.x, ty - player1.y);
    if (playerClear < player1.radius + mate.radius + 18) return { dir, score: -Infinity };
    return { dir, score: space + Math.min(playerClear, 120) * 0.08 + nx * 16 };
  }).sort((a, b) => b.score - a.score)[0]?.dir || { x: 1, y: 0 };
}

function updateTwoVtwoPassProgress(dt) {
  if (visionPassRoute) {
    visionPassRoute.timer = Math.max(0, visionPassRoute.timer - dt);
    if (!visionPassRoute.timer) visionPassRoute = null;
  }
  if (ball.passExpiry > 0) ball.passExpiry = Math.max(0, ball.passExpiry - dt);
  if (gameMode !== '2v2' || !twoVtwoStats) {
    if (ball.visionPassFlight) {
      const target = ball.passTarget;
      const opponents = [player2, ...(gameMode === '2v2' ? [awayMate] : [])];
      if (target && isBallReceivedBy(target)) {
        ball.visionPassFlight = null;
        ball.passTarget = null;
        ball.passSource = null;
        ball.passExpiry = 0;
      } else if (opponents.some(isBallControlledBy) || ball.passExpiry <= 0) {
        ball.visionPassFlight = null;
        ball.passTarget = null;
        ball.passSource = null;
        ball.passExpiry = 0;
      }
    }
    return;
  }
  if (!ball.passTarget) {
    if (isBallControlledBy(player2) || isBallControlledBy(awayMate)) {
      twoVtwoStats.passStreak = 0;
      twoVtwoStats.goalAssistPending = false;
    }
    return;
  }
  const target = ball.passTarget;
  const source = ball.passSource;
  if (isBallReceivedBy(target)) {
    ball.visionPassFlight = null;
    const teammatePass = (source === player1 && target === homeMate) || (source === homeMate && target === player1);
    if (teammatePass) {
      twoVtwoStats.passStreak++;
      if (twoVtwoStats.passStreak >= 4) twoVtwoStats.completed.passes = true;
      if (source === homeMate && target === player1) twoVtwoStats.goalAssistPending = true;
    }
    if (ball.passWasVision && source === player1 && target === homeMate) {
      const run = chooseVisionRunDirection(homeMate);
      homeMate.visionRunDirectionX = run.x;
      homeMate.visionRunDirectionY = run.y;
      homeMate.visionRunTimer = 0.46;
      const from = { x: player1.x, y: player1.y };
      const to = { x: homeMate.x, y: homeMate.y };
      visionPassRoute = { from, to, control: getVisionPassControlPoint(from, to, player1), timer: 1.35, maxTimer: 1.35 };
      showPowerFeedback('Passe encaixado · parceiro ataca o espaço', true, false);
    }
    ball.passTarget = null;
    ball.passSource = null;
    ball.passExpiry = 0;
    ball.passWasVision = false;
    return;
  }
  const intercepted = isBallControlledBy(player2) || isBallControlledBy(awayMate);
  const possessionChanged = (isBallControlledBy(player1) || isBallControlledBy(homeMate)) && source !== ball.dribbleLockOwner;
  if (intercepted || ball.passExpiry <= 0 || possessionChanged) {
    ball.visionPassFlight = null;
    twoVtwoStats.passStreak = 0;
    if (intercepted) twoVtwoStats.goalAssistPending = false;
    ball.passTarget = null;
    ball.passSource = null;
    ball.passExpiry = 0;
    ball.passWasVision = false;
  }
}

function applyPower(id, actor) {
  if (
    !id ||
    actor.powerCooldown > 0 ||
    gameState.pausedForGoal ||
    gameState.isGameOver ||
    actor.powerEffectTimer > 0 ||
    actor.powerEffect ||
    actor.nextKickPower !== 1 ||
    actor.nextKickReach !== 1 ||
    (typeof twoOnePlay !== 'undefined' && twoOnePlay) ||
    snakeTackles.some(tackle => tackle.owner === actor)
  ) return false;

  if (id === 'snakeTackle') {
    return startSnakeTackle(actor);
  }

  const nearBall = Math.hypot(ball.x - actor.x, ball.y - actor.y) <= actor.radius + ball.radius + CONFIG.physics.kickReachMargin + 15;
  const nearBallControl = Math.hypot(ball.x - actor.x, ball.y - actor.y) <= actor.radius + ball.radius + 62;

  if (id === 'twoOne') {
    return typeof startTwoOne === 'function' ? startTwoOne(actor) : false;
  }

  const nearBallCurve = Math.hypot(ball.x - actor.x, ball.y - actor.y) <= actor.radius + ball.radius + 54;
  if (id === 'curve' && !isBallControlledBy(actor) && !nearBallCurve) {
    if (actor.isHuman) showPowerFeedback('Chegue perto ou domine a bola para mirar a Curva Impossível', true);
    return false;
  }
  if (id === 'control' && !nearBallControl) {
    if (actor.isHuman) showPowerFeedback('Aproxime-se da bola para amortecer e dominar', true, false);
    return false;
  }
  if (id === 'phantom' && !isBallControlledBy(actor)) {
    if (actor.isHuman) showPowerFeedback('Domine a bola para acionar o Drible da Abelha', true);
    return false;
  }

  if (id === 'cannon') {
    actor.nextKickPower = 1.65;
  }
  else if (id === 'curve') {
    actor.powerEffect = 'curve';
    actor.powerEffectTimer = 6.0;
    // Amortece suavemente a bola para permitir mirar a curva com precisão
    ball.vx *= 0.25;
    ball.vy *= 0.25;
    ball.dribbleLockTimer = 0;
    ball.dribbleLockOwner = null;
    if (typeof trainingDummyHasBall !== 'undefined' && gameMode === 'training' && actor === player1) {
      trainingDummyHasBall = false;
    }
    if (typeof addCurveVortexParticles === 'function') {
      addCurveVortexParticles(ball.x, ball.y, 12, true, 0, 0);
    }
  } else if (id === 'control') {
    const dirX = Math.abs(actor.vx) > 0.25 || Math.abs(actor.vy) > 0.25 ? actor.vx : (ball.x - actor.x || actor.facingX || 1);
    const dirY = Math.abs(actor.vx) > 0.25 || Math.abs(actor.vy) > 0.25 ? actor.vy : (ball.y - actor.y || actor.facingY || 0);
    const dLen = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / dLen;
    const ny = dirY / dLen;
    const snapDist = actor.radius + ball.radius + 2.2;
    ball.x = Math.max(CONFIG.pitch.left + ball.radius + 2, Math.min(CONFIG.pitch.right - ball.radius - 2, actor.x + nx * snapDist));
    ball.y = Math.max(CONFIG.pitch.top + ball.radius + 2, Math.min(CONFIG.pitch.bottom - ball.radius - 2, actor.y + ny * snapDist));
    ball.vx = actor.vx * 0.45;
    ball.vy = actor.vy * 0.45;
    ball.curveTimer = 0;
    ball.curveTrail = [];
    ball.powerShotTimer = 0;
    ball.sniperShotTimer = 0;
    ball.dribbleLockTimer = 0;
    ball.dribbleLockOwner = null;
    actor.ignoreBallCollisionFrames = 0;
    if (typeof trainingDummyHasBall !== 'undefined' && gameMode === 'training' && actor === player1) {
      trainingDummyHasBall = false;
    }
    actor.controlPulseTimer = 0.45;
    addImpactSpark(ball.x, ball.y, '#34d399', 12, 0.9);
  } else if (id === 'eagle') {
    actor.nextKickReach = 2.6;
    actor.powerEffect = 'eagle';
    actor.powerEffectTimer = 6;
    addImpactSpark(actor.x, actor.y, '#38bdf8', 10, 1.0);
  } else if (id === 'phantom') {
    // DRIBLE DA ABELHA (MEGURU BACHIRA) — Sombrero Flick Acrobático
    const stats = phantomStats(actor);
    const opponents = (actor.isHuman || actor.isTeammate)
      ? [player2, ...(gameMode === '2v2' ? [awayMate] : [])]
      : [player1, ...(gameMode === '2v2' ? [homeMate] : [])];
    const defender = opponents.slice().sort((a, b) =>
      Math.hypot(a.x - actor.x, a.y - actor.y) - Math.hypot(b.x - actor.x, b.y - actor.y)
    )[0];
    const distToDefender = defender ? Math.hypot(defender.x - actor.x, defender.y - actor.y) : Infinity;

    actor.powerEffect = 'phantom';
    actor.powerEffectTimer = stats.duration;
    actor.phantomDribbleTimer = stats.duration;
    actor.ghostDodgeUsed = false;
    actor.ghostDodgeSuccess = true;
    ball.beeAuraTimer = 1.35;

    // Se estiver perto do adversário, engatilha o chapéu (Sombrero Flick) por cima dele
    if (defender && distToDefender < 135) {
      const ddx = defender.x - actor.x;
      const ddy = defender.y - actor.y;
      const dlen = Math.hypot(ddx, ddy) || 1;
      const dnx = ddx / dlen, dny = ddy / dlen;

      // Ponto de aterrissagem da bola atrás do oponente
      const p = CONFIG.pitch;
      const landDistance = defender.radius + ball.radius + 22;
      const landX = Math.max(p.left + 22, Math.min(p.right - 22, defender.x + dnx * landDistance));
      const landY = Math.max(p.top + 22, Math.min(p.bottom - 22, defender.y + dny * landDistance));

      // Elevação da bola e desativação temporária da colisão física com o marcador
      ball.elevation = 0;
      ball.sombreroTimer = 0.72;
      ball.sombreroDuration = 0.72;
      ball.sombreroDribbledDefender = defender;
      ball.dribbleLockTimer = 0.72;
      ball.dribbleLockOwner = actor;

      // Impulso parabólico horizontal da bola
      ball.vx = (landX - ball.x) / (0.72 * 60) * 1.06;
      ball.vy = (landY - ball.y) / (0.72 * 60) * 1.06;

      // O jogador contorna com agilidade veloz pelo flanco
      const sideX = -dny, sideY = dnx;
      const sideSign = (actor.y < defender.y) ? -1 : 1;
      actor.vx = dnx * 6.2 + sideX * sideSign * 4.6;
      actor.vy = dny * 6.2 + sideY * sideSign * 4.6;

      addImpactSpark(ball.x, ball.y, '#facc15', 18, 1.25);
      if (actor.isHuman) {
        showPowerFeedback('Drible da Abelha · Chapeuzinho acrobático!', false, false);
      }
    } else {
      // Corte rápido acrobático com mel
      const cut = choosePhantomCut(actor);
      actor.phantomDirectionX = cut.x;
      actor.phantomDirectionY = cut.y;
      actor.vx += cut.x * stats.cutForce * 1.15;
      actor.vy += cut.y * stats.cutForce * 1.15;
      ball.vx += cut.x * stats.cutForce * 0.85;
      ball.vy += cut.y * stats.cutForce * 0.85;
      addImpactSpark(ball.x, ball.y, '#fde047', 12, 1.0);
      if (actor.isHuman) {
        showPowerFeedback('Drible da Abelha · Dança do Monstro!', false, false);
      }
    }
  } else if (id === 'sprint') {
    // A PANTERA DO CHIGIRI (HYOMA CHIGIRI) — Arranque Feral Rubi
    let dx = actor.facingX;
    let dy = actor.facingY;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    actor.vx = dx * 9.6;
    actor.vy = dy * 9.6;
    actor.dashTimer = 0.82;
    addImpactSpark(actor.x, actor.y, '#f43f5e', 16, 1.35);
    if (actor.isHuman) {
      showPowerFeedback('A Pantera do Chigiri · Arranque feral!', false, false);
    }
  } else if (id === 'ego') {
    actor.powerEffect = 'ego';
    actor.powerEffectTimer = 5;
    addImpactSpark(actor.x, actor.y, '#f59e0b', 16, 1.25);
  } else if (id === 'vision') {
    actor.powerEffect = 'vision';
    actor.powerEffectTimer = 20;
    actor.visionPassesLeft = 2; // máximo de 2 passes teleguiados por ativação
    addImpactSpark(actor.x, actor.y, '#f9a8d4', 10, 0.9);
  } else if (id === 'shadow') {
    actor.powerEffect = 'shadow';
    actor.powerEffectTimer = 4;
    addImpactSpark(actor.x, actor.y, '#818cf8', 12, 1.05);
  } else if (id === 'sniper') {
    actor.powerEffect = 'sniper';
    actor.powerEffectTimer = 6;
    addImpactSpark(actor.x, actor.y, '#fb7185', 10, 1.0);
  }

  actor.powerCooldown = (id === 'vision' || id === 'curve' || id === 'eagle' || id === 'sniper')
    ? 0
    : (id === 'phantom' ? phantomStats(actor).cooldown : (POWER_COOLDOWNS[id] || 12));

  if (actor.isHuman) {
    if (typeof MISSIONS !== 'undefined') MISSIONS.recordPowerUsed();
    const customFeed =
      id === 'cannon' ? 'Chute de Pistola armado · finalize!' :
      id === 'curve' ? 'Curva Impossível! Mire e aperte Chute (ou Clique)' :
      id === 'control' ? 'Domínio Perfeito! Bola dominada no pé' :
      id === 'eagle' ? 'Salto de Águia armado (6s)' :
      id === 'sniper' ? 'Instinto de Artilheiro armado (6s)' :
      id === 'shadow' ? 'Sombra do Marcador ativa (4s)' :
      id === 'ego' ? 'Despertar do Ego ativo (5s)' :
      `${POWER_LABELS[id]} ativado`;
    showPowerFeedback(customFeed, false, !['cannon', 'sprint', 'phantom', 'curve'].includes(id));
  } else {
    showPowerFeedback(`${POWER_LABELS[id]}: bot`, true);
  }

  if (id === 'sprint') Sound.playLightning();
  if (id === 'phantom') Sound.playPhantom();
  if (id === 'control') Sound.playKick();
  return true;
}

function updatePowerBot(dt, actor = player2) {
  actor.aiPowerThink -= dt;
  if (actor.aiPowerThink > 0 || actor.powerCooldown > 0 || actor.powerEffectTimer > 0 || actor.powerEffect) return;
  actor.aiPowerThink = 6.5 + Math.random() * 3;
  if (Math.random() > 0.40 || Math.hypot(ball.x - actor.x, ball.y - actor.y) > 220) return;

  const botPowers = ITEMS.powers.filter(power => power.id !== 'twoOne');
  actor.aiPowerId = botPowers[Math.floor(Math.random() * botPowers.length)].id;
  const id = actor.aiPowerId;
  const nearBall = Math.hypot(ball.x - actor.x, ball.y - actor.y) <= actor.radius + ball.radius + 36;
  if (['cannon', 'curve', 'control', 'phantom'].includes(id) && !nearBall) return;
  if (id === 'sniper' && !(actor.x < 480 && nearBall)) return;
  if (['curve', 'phantom'].includes(id) && !isBallControlledBy(actor)) return;
  if (id === 'sprint' && Math.hypot(ball.x - actor.x, ball.y - actor.y) < 40) return;
  if (id === 'shadow' && Math.hypot(ball.x - actor.x, ball.y - actor.y) > 175) return;
  applyPower(id, actor);
  actor.aiPowerId = null;
}

function drawVisionPuzzleOverlay(renderCtx) {
  if (player1.powerEffect !== 'vision' || player1.powerEffectTimer <= 0) return;
  const p = CONFIG.pitch;
  const size = 54;
  const knob = size * 0.12;
  renderCtx.save();
  renderCtx.beginPath();
  renderCtx.rect(p.left, p.top, p.width, p.height);
  renderCtx.clip();
  renderCtx.strokeStyle = '#f9a8d4';
  renderCtx.lineWidth = 1.25;
  renderCtx.globalAlpha = 0.105;
  for (let row = 0, y = p.top; y < p.bottom; y += size, row++) {
    for (let col = 0, x = p.left; x < p.right; x += size, col++) {
      const right = Math.min(x + size, p.right);
      const bottom = Math.min(y + size, p.bottom);
      const w = right - x;
      const h = bottom - y;
      const edge = (row + col) % 4;
      renderCtx.beginPath();
      renderCtx.moveTo(x, y);
      if (edge === 0 && w > size * 0.8) {
        renderCtx.lineTo(x + w * 0.36, y);
        renderCtx.bezierCurveTo(x + w * 0.38, y - knob, x + w * 0.62, y - knob, x + w * 0.64, y);
      }
      renderCtx.lineTo(right, y);
      if (edge === 1 && h > size * 0.8) {
        renderCtx.lineTo(right, y + h * 0.36);
        renderCtx.bezierCurveTo(right + knob, y + h * 0.38, right + knob, y + h * 0.62, right, y + h * 0.64);
      }
      renderCtx.lineTo(right, bottom);
      if (edge === 2 && w > size * 0.8) {
        renderCtx.lineTo(x + w * 0.64, bottom);
        renderCtx.bezierCurveTo(x + w * 0.62, bottom + knob, x + w * 0.38, bottom + knob, x + w * 0.36, bottom);
      }
      renderCtx.lineTo(x, bottom);
      if (edge === 3 && h > size * 0.8) {
        renderCtx.lineTo(x, y + h * 0.64);
        renderCtx.bezierCurveTo(x - knob, y + h * 0.62, x - knob, y + h * 0.38, x, y + h * 0.36);
      }
      renderCtx.closePath();
      renderCtx.stroke();
    }
  }
  renderCtx.globalAlpha = 0.15;
  renderCtx.beginPath();
  renderCtx.arc(ball.x, ball.y, ball.radius + 12, 0, Math.PI * 2);
  renderCtx.stroke();
  renderCtx.restore();
}

function drawTwoVtwoVisionGuidance(renderCtx) {
  if (gameMode !== '2v2' || player1.powerEffect !== 'vision' || player1.powerEffectTimer <= 0) return;
  renderCtx.save();
  renderCtx.lineCap = 'round';
  renderCtx.setLineDash([5, 5]);
  const pulse = 0.62 + Math.sin(performance.now() / 130) * 0.16;
  renderCtx.globalAlpha = pulse;
  renderCtx.strokeStyle = '#f9a8d4';
  renderCtx.lineWidth = 2;
  renderCtx.beginPath();
  renderCtx.arc(homeMate.x, homeMate.y, homeMate.radius + 11, 0, Math.PI * 2);
  renderCtx.stroke();

  renderCtx.setLineDash([]);

  if (visionPassRoute) {
    const alpha = Math.min(1, visionPassRoute.timer / visionPassRoute.maxTimer);
    renderCtx.globalAlpha = alpha * 0.68;
    renderCtx.strokeStyle = '#f472b6';
    renderCtx.lineWidth = 3;
    renderCtx.beginPath();
    renderCtx.moveTo(visionPassRoute.from.x, visionPassRoute.from.y);
    renderCtx.quadraticCurveTo(visionPassRoute.control.x, visionPassRoute.control.y, visionPassRoute.to.x, visionPassRoute.to.y);
    renderCtx.stroke();
    const count = 5;
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const u = 1 - t;
      const x = u * u * visionPassRoute.from.x + 2 * u * t * visionPassRoute.control.x + t * t * visionPassRoute.to.x;
      const y = u * u * visionPassRoute.from.y + 2 * u * t * visionPassRoute.control.y + t * t * visionPassRoute.to.y;
      renderCtx.beginPath();
      renderCtx.arc(x, y, 4.5, 0, Math.PI * 2);
      renderCtx.fillStyle = '#fce7f3';
      renderCtx.fill();
      renderCtx.beginPath();
      renderCtx.arc(x, y, 7.5, 0, Math.PI * 2);
      renderCtx.strokeStyle = '#f9a8d4';
      renderCtx.lineWidth = 1;
      renderCtx.stroke();
    }
  }
  renderCtx.restore();
}

/**
 * Desenha auras e indicadores táticos de habilidades ativas no campo
 * (Domínio Perfeito, Salto de Águia, Instinto de Artilheiro, Sombra do Marcador e Despertar do Ego).
 */
function drawSkillAuras(renderCtx) {
  const actors = [player1, player2];
  if (gameMode === '2v2') actors.push(homeMate, awayMate);

  const now = performance.now();
  renderCtx.save();

  for (const actor of actors) {
    if (!actor) continue;

    // 0. Chute de Pistola armado: aura âmbar/laranja pulsante indicando disparo carregado
    if ((actor.nextKickPower || 1) > 1.5) {
      const pulse = 0.6 + Math.sin(now / 90) * 0.25;
      renderCtx.save();
      renderCtx.globalAlpha = pulse;
      renderCtx.strokeStyle = '#fb923c';
      renderCtx.shadowColor = '#f97316';
      renderCtx.shadowBlur = 14;
      renderCtx.lineWidth = 2.6;
      renderCtx.setLineDash([6, 4]);
      renderCtx.beginPath();
      renderCtx.arc(actor.x, actor.y, actor.radius + 7, 0, Math.PI * 2);
      renderCtx.stroke();
      renderCtx.setLineDash([]);
      renderCtx.restore();
    }

    // 1. Domínio Perfeito: onda de amortecimento esmeralda
    if (actor.controlPulseTimer > 0) {
      const progress = 1 - actor.controlPulseTimer / 0.45;
      renderCtx.save();
      renderCtx.globalAlpha = Math.max(0, 1 - progress) * 0.85;
      renderCtx.strokeStyle = '#34d399';
      renderCtx.shadowColor = '#10b981';
      renderCtx.shadowBlur = 14;
      renderCtx.lineWidth = 3;
      renderCtx.beginPath();
      renderCtx.arc(actor.x, actor.y, actor.radius + 10 + progress * 34, 0, Math.PI * 2);
      renderCtx.stroke();
      renderCtx.restore();
    }

    // 2. Salto de Águia: anel de alcance estendido de chute
    if (actor.powerEffect === 'eagle' || (actor.nextKickReach || 1) > 1.05) {
      const reachRadius = actor.radius + ball.radius + 36;
      const pulse = 0.55 + Math.sin(now / 120) * 0.18;
      renderCtx.save();
      renderCtx.globalAlpha = pulse;
      renderCtx.strokeStyle = '#38bdf8';
      renderCtx.setLineDash([7, 6]);
      renderCtx.lineWidth = 2;
      renderCtx.beginPath();
      renderCtx.arc(actor.x, actor.y, reachRadius, 0, Math.PI * 2);
      renderCtx.stroke();
      renderCtx.setLineDash([]);
      renderCtx.restore();
    }

    // 3. Instinto de Artilheiro: mira vermelha-dourada ao redor do atacante
    if (actor.powerEffect === 'sniper') {
      const rot = now / 520;
      const r = actor.radius + 13;
      renderCtx.save();
      renderCtx.translate(actor.x, actor.y);
      renderCtx.rotate(rot);
      renderCtx.strokeStyle = '#fb7185';
      renderCtx.shadowColor = '#f43f5e';
      renderCtx.shadowBlur = 10;
      renderCtx.lineWidth = 2.2;
      renderCtx.beginPath();
      renderCtx.arc(0, 0, r, 0, Math.PI * 2);
      renderCtx.stroke();
      for (let k = 0; k < 4; k++) {
        const a = (Math.PI / 2) * k;
        renderCtx.beginPath();
        renderCtx.moveTo(Math.cos(a) * (r - 5), Math.sin(a) * (r - 5));
        renderCtx.lineTo(Math.cos(a) * (r + 5), Math.sin(a) * (r + 5));
        renderCtx.stroke();
      }
      renderCtx.restore();
    }

    // 4. Sombra do Marcador: anel índigo + linha de marcação ao adversário mais próximo da bola
    if (actor.powerEffect === 'shadow' && actor.powerEffectTimer > 0) {
      renderCtx.save();
      renderCtx.strokeStyle = '#818cf8';
      renderCtx.shadowColor = '#6366f1';
      renderCtx.shadowBlur = 12;
      renderCtx.lineWidth = 2.4;
      renderCtx.setLineDash([5, 4]);
      renderCtx.beginPath();
      renderCtx.arc(actor.x, actor.y, actor.radius + 9 + Math.sin(now / 95) * 2, 0, Math.PI * 2);
      renderCtx.stroke();

      const opps = (actor.isHuman || actor.isTeammate)
        ? (gameMode === '2v2' ? [player2, awayMate] : [player2])
        : (gameMode === '2v2' ? [player1, homeMate] : [player1]);
      const target = opps.slice().sort((a, b) => Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y))[0];
      if (target) {
        renderCtx.globalAlpha = 0.5;
        renderCtx.lineWidth = 2;
        renderCtx.beginPath();
        renderCtx.moveTo(actor.x, actor.y);
        renderCtx.lineTo(target.x, target.y);
        renderCtx.stroke();
      }
      renderCtx.setLineDash([]);
      renderCtx.restore();
    }

    // 5. Despertar do Ego: aura intensa dourada/carmesim contínua
    if (actor.powerEffect === 'ego' && actor.powerEffectTimer > 0) {
      const pulse = Math.sin(now / 85) * 2.8;
      renderCtx.save();
      renderCtx.strokeStyle = '#fbbf24';
      renderCtx.shadowColor = '#f97316';
      renderCtx.shadowBlur = 18;
      renderCtx.lineWidth = 3;
      renderCtx.beginPath();
      renderCtx.arc(actor.x, actor.y, actor.radius + 8 + pulse, 0, Math.PI * 2);
      renderCtx.stroke();

      renderCtx.globalAlpha = 0.24;
      renderCtx.fillStyle = '#f59e0b';
      renderCtx.beginPath();
      renderCtx.arc(actor.x, actor.y, actor.radius + 13 + pulse, 0, Math.PI * 2);
      renderCtx.fill();
      renderCtx.restore();
    }
  }

  renderCtx.restore();
}

/* ==========================================================================
   PROJEÇÃO DE TRAJETÓRIA DA BOLA — VISÃO DE CAMPO
   Renderiza linha pontilhada luminosa mostrando onde a bola vai parar,
   incluindo até 1 rebote em paredes laterais ou postes de trave.
   Ativada somente enquanto 'vision' estiver ativa para player1.
   ========================================================================== */
function drawBallTrajectoryPrediction(renderCtx) {
  if (player1.powerEffect !== 'vision' || player1.powerEffectTimer <= 0) return;

  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed < 0.8) return; // bola praticamente parada — sem projeção útil

  const p = CONFIG.pitch;
  const g = CONFIG.goals;
  const damp = CONFIG.physics.dampingBall;
  const ballR = ball.radius;
  const postR = CONFIG.goals.postRadius + ballR;

  // Simulação passo a passo (máx 240 frames = ~4 s a 60fps)
  let sx = ball.x, sy = ball.y;
  let svx = ball.vx, svy = ball.vy;
  const pathPoints = [{ x: sx, y: sy }];
  let bounces = 0;
  const maxBounces = 2;
  const maxSteps = 240;
  let stopped = false;

  for (let step = 0; step < maxSteps; step++) {
    svx *= damp;
    svy *= damp;
    sx += svx;
    sy += svy;

    // Rebote nas paredes verticais (superior/inferior) — apenas dentro do campo
    if (bounces < maxBounces) {
      if (sy - ballR < p.top) {
        sy = p.top + ballR;
        svy = -svy * CONFIG.physics.restitutionWall;
        bounces++;
        pathPoints.push({ x: sx, y: sy, isBounce: true });
      } else if (sy + ballR > p.bottom) {
        sy = p.bottom - ballR;
        svy = -svy * CONFIG.physics.restitutionWall;
        bounces++;
        pathPoints.push({ x: sx, y: sy, isBounce: true });
      }
    }

    // Rebote nos postes
    if (bounces < maxBounces) {
      for (const post of posts) {
        const pdx = sx - post.x, pdy = sy - post.y;
        const pdist = Math.hypot(pdx, pdy);
        if (pdist < postR) {
          const pnx = pdx / pdist, pny = pdy / pdist;
          sx = post.x + pnx * postR;
          sy = post.y + pny * postR;
          const dot = svx * pnx + svy * pny;
          svx -= 2 * dot * pnx * CONFIG.physics.restitutionWall;
          svy -= 2 * dot * pny * CONFIG.physics.restitutionWall;
          bounces++;
          pathPoints.push({ x: sx, y: sy, isBounce: true });
          break;
        }
      }
    }

    pathPoints.push({ x: sx, y: sy });

    if (Math.hypot(svx, svy) < 0.35) { stopped = true; break; }
  }

  // Renderização da trilha pontilhada
  renderCtx.save();
  renderCtx.beginPath();
  renderCtx.rect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  renderCtx.clip();

  const pulseFade = 0.55 + Math.sin(performance.now() / 180) * 0.22;

  // Linha de fundo (glow rosa)
  renderCtx.beginPath();
  renderCtx.moveTo(pathPoints[0].x, pathPoints[0].y);
  for (let i = 1; i < pathPoints.length; i++) {
    if (!pathPoints[i].isBounce) renderCtx.lineTo(pathPoints[i].x, pathPoints[i].y);
    else { renderCtx.moveTo(pathPoints[i].x, pathPoints[i].y); }
  }
  renderCtx.strokeStyle = 'rgba(249,168,212,0.28)';
  renderCtx.lineWidth = 7;
  renderCtx.setLineDash([]);
  renderCtx.stroke();

  // Linha pontilhada luminosa principal
  renderCtx.beginPath();
  renderCtx.moveTo(pathPoints[0].x, pathPoints[0].y);
  for (let i = 1; i < pathPoints.length; i++) {
    if (!pathPoints[i].isBounce) renderCtx.lineTo(pathPoints[i].x, pathPoints[i].y);
    else { renderCtx.moveTo(pathPoints[i].x, pathPoints[i].y); }
  }
  renderCtx.strokeStyle = `rgba(252,231,243,${pulseFade * 0.9})`;
  renderCtx.lineWidth = 2;
  renderCtx.setLineDash([5, 6]);
  renderCtx.stroke();
  renderCtx.setLineDash([]);

  // Marcadores de rebote
  for (const pt of pathPoints) {
    if (!pt.isBounce) continue;
    renderCtx.beginPath();
    renderCtx.arc(pt.x, pt.y, 5.5, 0, Math.PI * 2);
    renderCtx.fillStyle = 'rgba(251,207,232,0.78)';
    renderCtx.fill();
    renderCtx.strokeStyle = '#f9a8d4';
    renderCtx.lineWidth = 1.5;
    renderCtx.stroke();
  }

  // Indicador do ponto final
  const last = pathPoints[pathPoints.length - 1];
  const endAlpha = stopped ? pulseFade * 0.85 : 0.5;

  // Anel externo
  renderCtx.beginPath();
  renderCtx.arc(last.x, last.y, 10, 0, Math.PI * 2);
  renderCtx.strokeStyle = `rgba(249,168,212,${endAlpha})`;
  renderCtx.lineWidth = 2;
  renderCtx.stroke();

  // Ponto central
  renderCtx.beginPath();
  renderCtx.arc(last.x, last.y, 4, 0, Math.PI * 2);
  renderCtx.fillStyle = `rgba(252,231,243,${endAlpha})`;
  renderCtx.fill();

  renderCtx.restore();
}
