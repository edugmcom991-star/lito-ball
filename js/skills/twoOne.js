/**
 * ==========================================================================
 * LITO BALL - REWORK: TOQUE E PASSA (js/skills/twoOne.js)
 * ==========================================================================
 * Tabela instantânea, fluida e responsiva sem travar o jogador:
 *  - No 2v2 / Treino: toca rápido no companheiro (que aguarda em pivô sem
 *    correr para cima de player1), libera arrancada com controle livre (WASD)
 *    e devolve instantaneamente de primeira na corrida com domínio no pé.
 *  - No 1v1 (ou quando o aliado está bloqueado/distante): Tabela na Parede Real
 *    do campo (exige proximidade com uma parede lateral/fundo válida).
 */
'use strict';

let twoOnePlay = null;
const twoOneEffects = [];
const twoOneAfterimages = [];
let twoOneAfterimageCooldown = 0;

function clearTwoOneState() {
  twoOnePlay = null;
  twoOneEffects.length = 0;
  twoOneAfterimages.length = 0;
  twoOneAfterimageCooldown = 0;
  if (typeof player1 !== 'undefined' && player1) {
    player1.twoOneRunTimer = 0;
    if (player1.powerEffect === 'twoOne') {
      player1.powerEffect = null;
      player1.powerEffectTimer = 0;
    }
  }
}

function getTwoOneMoveVector(actor) {
  let dx = 0;
  let dy = 0;
  if (actor === player1 && typeof input !== 'undefined') {
    dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  }
  if (!dx && !dy) {
    const speed = Math.hypot(actor.vx, actor.vy);
    if (speed > 0.45) {
      dx = actor.vx / speed;
      dy = actor.vy / speed;
    } else if (Math.abs(actor.facingX) > 0.05 || Math.abs(actor.facingY) > 0.05) {
      dx = actor.facingX;
      dy = actor.facingY;
    } else {
      dx = 1;
      dy = 0;
    }
  }
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function chooseTwoOneWallAnchor(actor) {
  const p = CONFIG.pitch;
  const g = CONFIG.goals;
  const attackDir = actor.isHuman || actor.isTeammate ? 1 : -1;
  const moveVec = getTwoOneMoveVector(actor);
  const margin = ball.radius + 1.5;
  const maxWallDist = 170;
  const forwardOffset = Math.max(76, Math.min(130, 82 + Math.abs(moveVec.x) * 44));
  const candidates = [];

  const bankX = Math.max(p.left + 44, Math.min(p.right - 44, actor.x + attackDir * forwardOffset));
  candidates.push({
    wallSide: 'top',
    x: bankX,
    y: p.top + margin,
    wallDist: Math.max(0, actor.y - p.top)
  });
  candidates.push({
    wallSide: 'bottom',
    x: bankX,
    y: p.bottom - margin,
    wallDist: Math.max(0, p.bottom - actor.y)
  });

  // Segmentos sólidos das linhas de fundo fora da boca do gol (para tabelas perto dos cantos)
  const topEndMaxY = g.topY - ball.radius - 12;
  const bottomEndMinY = g.bottomY + ball.radius + 12;
  const sideShiftY = Math.abs(moveVec.y) > 0.2 ? Math.sign(moveVec.y) * 58 : 0;

  if (topEndMaxY > p.top + 32) {
    const endTopY = Math.max(p.top + 30, Math.min(topEndMaxY, actor.y + sideShiftY));
    const rightTopWallDist = actor.y <= topEndMaxY
      ? Math.max(0, p.right - actor.x)
      : Math.hypot(p.right - actor.x, endTopY - actor.y);
    candidates.push({
      wallSide: 'right',
      x: p.right - margin,
      y: endTopY,
      wallDist: rightTopWallDist
    });

    const leftTopWallDist = actor.y <= topEndMaxY
      ? Math.max(0, actor.x - p.left)
      : Math.hypot(actor.x - p.left, endTopY - actor.y);
    candidates.push({
      wallSide: 'left',
      x: p.left + margin,
      y: endTopY,
      wallDist: leftTopWallDist
    });
  }

  if (bottomEndMinY < p.bottom - 32) {
    const endBottomY = Math.min(p.bottom - 30, Math.max(bottomEndMinY, actor.y + sideShiftY));
    const rightBottomWallDist = actor.y >= bottomEndMinY
      ? Math.max(0, p.right - actor.x)
      : Math.hypot(p.right - actor.x, endBottomY - actor.y);
    candidates.push({
      wallSide: 'right',
      x: p.right - margin,
      y: endBottomY,
      wallDist: rightBottomWallDist
    });

    const leftBottomWallDist = actor.y >= bottomEndMinY
      ? Math.max(0, actor.x - p.left)
      : Math.hypot(actor.x - p.left, endBottomY - actor.y);
    candidates.push({
      wallSide: 'left',
      x: p.left + margin,
      y: endBottomY,
      wallDist: leftBottomWallDist
    });
  }

  let best = null;
  let bestScore = Infinity;

  for (const cand of candidates) {
    if (cand.wallDist > maxWallDist) continue;
    const travelDist = Math.hypot(cand.x - actor.x, cand.y - actor.y);
    if (travelDist < actor.radius + ball.radius + 26 || travelDist > maxWallDist + 135) continue;
    if (typeof isPassPathBlocked === 'function' && isPassPathBlocked(actor, cand, actor)) continue;

    const dirX = (cand.x - actor.x) / travelDist;
    const dirY = (cand.y - actor.y) / travelDist;
    const moveAlign = dirX * moveVec.x + dirY * moveVec.y;
    const forwardBonus = (cand.x - actor.x) * attackDir * 0.25;
    const score = cand.wallDist - moveAlign * 45 - forwardBonus;

    if (score < bestScore) {
      bestScore = score;
      best = cand;
    }
  }

  return best;
}

function projectTwoOneLeadPoint(actor, passSpeed) {
  const p = CONFIG.pitch;
  const moveVec = getTwoOneMoveVector(actor);
  const actorSpeed = Math.max(4.6, Math.hypot(actor.vx, actor.vy), CONFIG.physics.playerMaxSpeed * 1.18);
  const dist = Math.hypot(actor.x - ball.x, actor.y - ball.y);
  const estFrames = Math.max(4, Math.min(24, dist / Math.max(4.8, passSpeed)));
  const leadDist = Math.min(142, actorSpeed * estFrames * 0.64 + 20);

  return {
    x: Math.max(p.left + actor.radius + 14, Math.min(p.right - actor.radius - 14, actor.x + moveVec.x * leadDist)),
    y: Math.max(p.top + actor.radius + 14, Math.min(p.bottom - actor.radius - 14, actor.y + moveVec.y * leadDist))
  };
}

function playTwoOnePassSound() {
  if (typeof Sound === 'undefined' || !Sound) return;
  if (typeof Sound.playPass === 'function') {
    Sound.playPass();
  } else if (typeof Sound.playKick === 'function') {
    Sound.playKick();
  }
}

function addTwoOneShockwave(x, y, maxRadius = 46, color = '#22d3ee', maxLife = 0.36) {
  twoOneEffects.push({
    x,
    y,
    radius: 10,
    maxRadius,
    color,
    life: maxLife,
    maxLife
  });
}

function findBestTwoOneTeammate(actor) {
  const inTeamOrTraining = gameMode === 'training' || ['2v2', '3v3', '4v4', '5v5'].includes(gameMode);
  if (!inTeamOrTraining) return null;
  const mates = typeof getTeammatesOf === 'function'
    ? getTeammatesOf(actor).filter(m => m && m !== actor)
    : (typeof homeMate !== 'undefined' && homeMate && homeMate !== actor ? [homeMate] : []);
  if (!mates.length) return null;

  let best = null;
  let bestScore = Infinity;
  for (const mate of mates) {
    const dist = Math.hypot(mate.x - actor.x, mate.y - actor.y);
    if (dist < 52 || dist > 420) continue;
    if (typeof isPassPathBlocked === 'function' && isPassPathBlocked(actor, mate, actor)) continue;
    const forwardBias = (mate.x - actor.x) * ((actor.isHuman || actor.isTeammate) ? 1 : -1) > 0 ? -25 : 0;
    const score = dist + forwardBias;
    if (score < bestScore) {
      bestScore = score;
      best = mate;
    }
  }
  return best;
}

function isTwoOneTeammateEligible(actor) {
  return !!findBestTwoOneTeammate(actor);
}

function shouldSkipNormalBallCollisionForTwoOne(actor) {
  if (!twoOnePlay) return false;
  if (twoOnePlay.phase === 'outbound' && twoOnePlay.mode === 'teammate' && actor === twoOnePlay.target) {
    return true;
  }
  if (twoOnePlay.phase === 'return' && actor === twoOnePlay.owner) {
    const d = Math.hypot(ball.x - actor.x, ball.y - actor.y);
    return d <= actor.radius + ball.radius + 18;
  }
  return false;
}

function startTwoOne(actor) {
  if (actor !== player1) return false;

  const hasBallControl = typeof isBallControlledBy === 'function'
    ? isBallControlledBy(actor)
    : (actor.tackleStaggerTimer <= 0 &&
      Math.hypot(ball.x - actor.x, ball.y - actor.y) <= actor.radius + ball.radius + 9 &&
      Math.hypot(ball.vx - actor.vx, ball.vy - actor.vy) <= 7.5);
  if (!hasBallControl) {
    if (actor.isHuman) showPowerFeedback('Domine a bola no pé para usar Toque e Passa', true);
    return false;
  }

  const moveVec = getTwoOneMoveVector(actor);
  const eligibleMate = findBestTwoOneTeammate(actor);
  const useTeammate = !!eligibleMate;
  let mode = 'wall';
  let wallSide = null;
  let targetActor = null;
  let relayX = actor.x;
  let relayY = actor.y;

  if (useTeammate) {
    mode = 'teammate';
    targetActor = eligibleMate;
    relayX = eligibleMate.x;
    relayY = eligibleMate.y;
  } else {
    const anchor = chooseTwoOneWallAnchor(actor);
    if (!anchor) {
      if (actor.isHuman) showPowerFeedback('Aproxime-se da parede (ou de um aliado) para tabelar', true);
      return false;
    }
    wallSide = anchor.wallSide;
    relayX = anchor.x;
    relayY = anchor.y;
  }

  // Zera qualquer trava ou velocidade residual anterior da bola para saída limpa
  ball.vx = 0;
  ball.vy = 0;
  ball.curveTimer = 0;
  ball.curveTrail = [];
  ball.powerShotTimer = 0;
  ball.sniperShotTimer = 0;
  ball.dribbleLockTimer = 0;
  ball.dribbleLockOwner = null;
  if (typeof trainingDummyHasBall !== 'undefined' && gameMode === 'training') {
    trainingDummyHasBall = false;
  }

  // Posiciona o ponto de toque imediatamente à frente em direção ao alvo (evita desvios por bola atrasada)
  const p = CONFIG.pitch;
  const distToBall = Math.hypot(ball.x - actor.x, ball.y - actor.y);
  const aimDx = relayX - actor.x;
  const aimDy = relayY - actor.y;
  const aimDist = Math.hypot(aimDx, aimDy) || 1;
  const aimUx = aimDx / aimDist;
  const aimUy = aimDy / aimDist;

  if (distToBall > actor.radius + ball.radius + 4) {
    const launchOffset = actor.radius + ball.radius + 2.5;
    ball.x = Math.max(p.left + ball.radius + 2, Math.min(p.right - ball.radius - 2, actor.x + aimUx * launchOffset));
    ball.y = Math.max(p.top + ball.radius + 2, Math.min(p.bottom - ball.radius - 2, actor.y + aimUy * launchOffset));
  }

  const dx = relayX - ball.x;
  const dy = relayY - ball.y;
  const passDist = Math.hypot(dx, dy) || 1;
  const ux = dx / passDist;
  const uy = dy / passDist;
  const passSpeed = mode === 'teammate'
    ? Math.max(10.2, Math.min(12.6, 8.8 + passDist * 0.014))
    : Math.max(10.8, Math.min(12.8, 9.6 + passDist * 0.014));

  ball.vx = ux * passSpeed;
  ball.vy = uy * passSpeed;
  ball.passSource = actor;
  ball.passTarget = targetActor;
  ball.passExpiry = 2.0;

  // Aplica arrancada imediata mantendo WASD 100% livre para controlar!
  actor.facingX = moveVec.x;
  actor.facingY = moveVec.y;
  actor.vx = actor.vx * 0.3 + moveVec.x * 5.8;
  actor.vy = actor.vy * 0.3 + moveVec.y * 5.8;
  actor.ignoreBallCollisionFrames = 10;
  actor.kickCooldownTimer = 0.14;
  actor.powerCooldown = POWER_COOLDOWNS.twoOne;
  actor.powerEffect = 'twoOne';
  actor.powerEffectTimer = 0.95;
  actor.twoOneRunTimer = 0.95;

  twoOnePlay = {
    mode,
    wallSide,
    phase: 'outbound',
    owner: actor,
    target: targetActor,
    relayX,
    relayY,
    pivotX: relayX,
    pivotY: relayY,
    startX: ball.x,
    startY: ball.y,
    timer: 2.35,
    outboundTimer: 0,
    returnAssistTimer: 0,
    trail: [{ x: ball.x, y: ball.y }],
    orbitPhase: 0
  };

  twoOneAfterimageCooldown = 0;
  playTwoOnePassSound();
  addImpactSpark(ball.x, ball.y, '#38bdf8', 12, 1.0);
  addTwoOneShockwave(ball.x, ball.y, 44, '#38bdf8', 0.32);

  showPowerFeedback(
    mode === 'teammate' ? 'Toque e Passa! Corra para receber de primeira!' : 'Tabela na Parede! Corra para receber!',
    false
  );
  return true;
}

function finishTwoOne(success, message) {
  if (!twoOnePlay) return;
  if (success && gameMode === '2v2' && typeof twoVtwoStats !== 'undefined' && twoVtwoStats) {
    twoVtwoStats.completed.twoOne = true;
  }
  const actor = twoOnePlay.owner || player1;
  twoOnePlay = null;
  if (actor) {
    if (actor.powerEffect === 'twoOne') {
      actor.powerEffect = null;
      actor.powerEffectTimer = 0;
    }
    if (!success) actor.twoOneRunTimer = Math.min(actor.twoOneRunTimer || 0, 0.2);
  }
  if (message) showPowerFeedback(message, !success, false);
}

function triggerTwoOneReturnPass(play) {
  const actor = play.owner || player1;
  const originX = play.mode === 'teammate' && play.target ? play.target.x : play.relayX;
  const originY = play.mode === 'teammate' && play.target ? play.target.y : play.relayY;

  const p = CONFIG.pitch;
  const returnSpeed = 10.8;
  const targetPoint = projectTwoOneLeadPoint(actor, returnSpeed);
  const dx = targetPoint.x - originX;
  const dy = targetPoint.y - originY;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;

  if (play.mode === 'wall') {
    ball.x = Math.max(p.left + ball.radius + 2, Math.min(p.right - ball.radius - 2, originX));
    ball.y = Math.max(p.top + ball.radius + 2, Math.min(p.bottom - ball.radius - 2, originY));
  } else if (play.target) {
    const launchOffset = play.target.radius + ball.radius + 2;
    ball.x = Math.max(p.left + ball.radius + 2, Math.min(p.right - ball.radius - 2, originX + ux * launchOffset));
    ball.y = Math.max(p.top + ball.radius + 2, Math.min(p.bottom - ball.radius - 2, originY + uy * launchOffset));
  }

  ball.vx = ux * returnSpeed;
  ball.vy = uy * returnSpeed;
  ball.passSource = play.target || actor;
  ball.passTarget = actor;
  ball.passExpiry = 1.6;
  ball.dribbleLockTimer = 0;
  ball.dribbleLockOwner = null;

  if (play.target) {
    play.target.facingX = ux;
    play.target.facingY = uy;
    play.target.ignoreBallCollisionFrames = 10;
    play.target.kickRingTimer = 0.16;
  }

  play.phase = 'return';
  play.relayX = originX;
  play.relayY = originY;
  play.returnAssistTimer = 1.25;
  play.timer = Math.max(play.timer, 1.45);

  playTwoOnePassSound();
  addImpactSpark(originX, originY, '#67e8f9', 14, 1.15);
  addTwoOneShockwave(originX, originY, 54, '#67e8f9', 0.38);
}

function updateTwoOneTeammateBehavior(dt) {
  if (!twoOnePlay || twoOnePlay.mode !== 'teammate' || twoOnePlay.target !== homeMate) return false;

  if (twoOnePlay.phase === 'outbound') {
    // O aliado mantém base em pivô sem ser puxado para cima de player1; só ajusta o corpo de frente para a bola
    const dxToPivot = twoOnePlay.pivotX - homeMate.x;
    const dyToPivot = twoOnePlay.pivotY - homeMate.y;
    const pivotDist = Math.hypot(dxToPivot, dyToPivot);
    if (pivotDist > 6) {
      homeMate.vx = homeMate.vx * 0.72 + (dxToPivot / pivotDist) * 0.55;
      homeMate.vy = homeMate.vy * 0.72 + (dyToPivot / pivotDist) * 0.55;
    } else {
      homeMate.vx *= 0.65;
      homeMate.vy *= 0.65;
    }

    const faceDx = ball.x - homeMate.x;
    const faceDy = ball.y - homeMate.y;
    const fLen = Math.hypot(faceDx, faceDy) || 1;
    homeMate.facingX = faceDx / fLen;
    homeMate.facingY = faceDy / fLen;
    return true;
  }

  if (twoOnePlay.phase === 'return') {
    // Após devolver de primeira, desacelera sem perseguir a própria devolução e bloqueia a IA padrão até concluir
    homeMate.vx *= 0.85;
    homeMate.vy *= 0.85;
    return true;
  }

  return false;
}

function updateTwoOneState(dt) {
  for (let i = twoOneEffects.length - 1; i >= 0; i--) {
    const fx = twoOneEffects[i];
    fx.life -= dt;
    if (fx.life <= 0) {
      twoOneEffects.splice(i, 1);
    } else {
      const t = 1 - fx.life / fx.maxLife;
      fx.radius = 10 + (fx.maxRadius - 10) * (1 - Math.pow(1 - t, 2));
    }
  }

  for (let i = twoOneAfterimages.length - 1; i >= 0; i--) {
    twoOneAfterimages[i].life -= dt;
    if (twoOneAfterimages[i].life <= 0) twoOneAfterimages.splice(i, 1);
  }

  if (!twoOnePlay) return;

  const play = twoOnePlay;
  const actor = play.owner || player1;
  play.timer -= dt;
  play.orbitPhase += dt * 7.5;

  // Afterimages de velocidade no jogador durante a arrancada
  if (actor && actor.twoOneRunTimer > 0) {
    twoOneAfterimageCooldown -= dt;
    if (twoOneAfterimageCooldown <= 0 && Math.hypot(actor.vx, actor.vy) > 2.2) {
      twoOneAfterimages.push({
        x: actor.x,
        y: actor.y,
        radius: actor.radius,
        life: 0.24,
        maxLife: 0.24
      });
      twoOneAfterimageCooldown = 0.045;
    }
  }

  // Trilha energética da bola
  if (Math.hypot(ball.vx, ball.vy) > 1.2) {
    play.trail.push({ x: ball.x, y: ball.y });
    if (play.trail.length > 14) play.trail.shift();
  } else if (play.trail.length > 0) {
    play.trail.shift();
  }

  // Checa se um adversário interceptou claramente a bola
  if (gameMode !== 'training') {
    const opps = gameMode === '2v2' ? [player2, awayMate] : [player2];
    const stolen = opps.some(opp =>
      opp &&
      Math.hypot(ball.x - opp.x, ball.y - opp.y) <= opp.radius + ball.radius + 4 &&
      actor.ignoreBallCollisionFrames <= 0
    );
    if (stolen) {
      finishTwoOne(false, 'Adversário interceptou a tabela!');
      return;
    }
  }

  if (play.phase === 'outbound') {
    play.outboundTimer += dt;

    if (play.mode === 'teammate' && play.target) {
      play.relayX = play.target.x;
      play.relayY = play.target.y;
      const dx = play.target.x - ball.x;
      const dy = play.target.y - ball.y;
      const distToMate = Math.hypot(dx, dy);

      if (distToMate <= play.target.radius + ball.radius + 16) {
        triggerTwoOneReturnPass(play);
        return;
      }

      // Leve assistência de trajetória na ida para a bola sempre achar o pé do aliado
      if (distToMate > 1) {
        const speed = Math.max(9.0, Math.hypot(ball.vx, ball.vy));
        const desiredVx = (dx / distToMate) * speed;
        const desiredVy = (dy / distToMate) * speed;
        ball.vx = ball.vx * 0.85 + desiredVx * 0.15;
        ball.vy = ball.vy * 0.85 + desiredVy * 0.15;
      }
    } else if (play.mode === 'wall') {
      const dx = play.relayX - ball.x;
      const dy = play.relayY - ball.y;
      const distToAnchor = Math.hypot(dx, dy);
      const p = CONFIG.pitch;
      const wallMargin = ball.radius + 3.5;
      const touchedTargetWall =
        (play.wallSide === 'top' && ball.y <= p.top + wallMargin) ||
        (play.wallSide === 'bottom' && ball.y >= p.bottom - wallMargin) ||
        (play.wallSide === 'right' && ball.x >= p.right - wallMargin) ||
        (play.wallSide === 'left' && ball.x <= p.left + wallMargin);

      if (distToAnchor <= 20 || (play.outboundTimer > 0.04 && touchedTargetWall)) {
        triggerTwoOneReturnPass(play);
        return;
      }
      if (play.outboundTimer >= 1.05) {
        finishTwoOne(false);
        return;
      }
      if (distToAnchor > 1) {
        const speed = Math.max(9.8, Math.hypot(ball.vx, ball.vy));
        ball.vx = (dx / distToAnchor) * speed;
        ball.vy = (dy / distToAnchor) * speed;
      }
    }
  } else if (play.phase === 'return') {
    // Assistência direcional suave rumo à corrida livre do jogador
    if (play.returnAssistTimer > 0 && actor) {
      play.returnAssistTimer = Math.max(0, play.returnAssistTimer - dt);
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed > 2.0) {
        const target = projectTwoOneLeadPoint(actor, speed);
        const dx = target.x - ball.x;
        const dy = target.y - ball.y;
        const angle = Math.atan2(ball.vx * dy - ball.vy * dx, ball.vx * dx + ball.vy * dy);
        const turn = Math.sign(angle) * Math.min(Math.abs(angle), 0.065);
        const cos = Math.cos(turn);
        const sin = Math.sin(turn);
        const vx = ball.vx;
        const vy = ball.vy;
        ball.vx = vx * cos - vy * sin;
        ball.vy = vx * sin + vy * cos;
      }
    }

    // Domínio automático limpo no pé na direção em que o jogador está correndo
    const distToOwner = Math.hypot(ball.x - actor.x, ball.y - actor.y);
    if (actor && distToOwner <= actor.radius + ball.radius + 14 && actor.ignoreBallCollisionFrames <= 0) {
      const moveVec = getTwoOneMoveVector(actor);
      const p = CONFIG.pitch;
      const settleDist = actor.radius + ball.radius + 3.5;
      ball.x = Math.max(p.left + ball.radius + 2, Math.min(p.right - ball.radius - 2, actor.x + moveVec.x * settleDist));
      ball.y = Math.max(p.top + ball.radius + 2, Math.min(p.bottom - ball.radius - 2, actor.y + moveVec.y * settleDist));
      ball.vx = actor.vx * 0.78 + moveVec.x * 1.35;
      ball.vy = actor.vy * 0.78 + moveVec.y * 1.35;
      ball.dribbleLockTimer = 0.24;
      ball.dribbleLockOwner = actor;
      actor.twoOneRunTimer = Math.max(actor.twoOneRunTimer, 0.26);

      addImpactSpark(ball.x, ball.y, '#22d3ee', 15, 1.1);
      addTwoOneShockwave(ball.x, ball.y, 48, '#22d3ee', 0.34);
      finishTwoOne(true, 'Tabela concluída no pé!');
      return;
    }
  }

  if (play.timer <= 0) {
    finishTwoOne(false);
  }
}

function drawTwoOneVisuals(renderCtx) {
  if (!twoOnePlay && !twoOneEffects.length && !twoOneAfterimages.length) return;

  renderCtx.save();
  renderCtx.lineCap = 'round';
  renderCtx.lineJoin = 'round';

  // 1. Afterimages de velocidade no jogador
  for (let i = 0; i < twoOneAfterimages.length; i++) {
    const img = twoOneAfterimages[i];
    const alpha = Math.max(0, img.life / img.maxLife) * 0.42;
    renderCtx.save();
    renderCtx.globalAlpha = alpha;
    renderCtx.fillStyle = '#06b6d4';
    renderCtx.shadowColor = '#22d3ee';
    renderCtx.shadowBlur = 14;
    renderCtx.beginPath();
    renderCtx.arc(img.x, img.y, img.radius + 1, 0, Math.PI * 2);
    renderCtx.fill();
    renderCtx.strokeStyle = '#cffafe';
    renderCtx.lineWidth = 1.6;
    renderCtx.stroke();
    renderCtx.restore();
  }

  // 2. Linhas orbitais luminosas e nó holográfico
  if (twoOnePlay) {
    const play = twoOnePlay;
    const actor = play.owner || player1;
    const anchorX = play.mode === 'teammate' && play.target ? play.target.x : play.relayX;
    const anchorY = play.mode === 'teammate' && play.target ? play.target.y : play.relayY;

    const pts = play.trail;
    for (let i = 1; i < pts.length; i++) {
      const t = i / pts.length;
      renderCtx.beginPath();
      renderCtx.moveTo(pts[i - 1].x, pts[i - 1].y);
      renderCtx.lineTo(pts[i].x, pts[i].y);
      renderCtx.strokeStyle = `rgba(34, 211, 238, ${t * 0.65})`;
      renderCtx.lineWidth = 2 + t * 5.5;
      renderCtx.shadowColor = '#22d3ee';
      renderCtx.shadowBlur = 10;
      renderCtx.stroke();

      renderCtx.beginPath();
      renderCtx.moveTo(pts[i - 1].x, pts[i - 1].y);
      renderCtx.lineTo(pts[i].x, pts[i].y);
      renderCtx.strokeStyle = `rgba(224, 242, 254, ${t * 0.8})`;
      renderCtx.lineWidth = 0.8 + t * 1.8;
      renderCtx.shadowBlur = 0;
      renderCtx.stroke();
    }

    renderCtx.save();
    renderCtx.globalAlpha = 0.78;
    renderCtx.strokeStyle = '#38bdf8';
    renderCtx.shadowColor = '#0ea5e9';
    renderCtx.shadowBlur = 12;
    renderCtx.lineWidth = 2.4;
    renderCtx.setLineDash([8, 6]);
    renderCtx.beginPath();
    renderCtx.moveTo(actor.x, actor.y);
    renderCtx.lineTo(anchorX, anchorY);
    renderCtx.stroke();
    renderCtx.setLineDash([]);

    const ringRadius = play.mode === 'wall' ? 18 : (play.target ? play.target.radius + 9 : 22);
    renderCtx.translate(anchorX, anchorY);
    renderCtx.rotate(play.orbitPhase);
    renderCtx.strokeStyle = '#67e8f9';
    renderCtx.lineWidth = 2.4;
    renderCtx.beginPath();
    renderCtx.arc(0, 0, ringRadius, 0, Math.PI * 1.35);
    renderCtx.stroke();
    renderCtx.beginPath();
    renderCtx.arc(0, 0, ringRadius, Math.PI * 1.5, Math.PI * 1.9);
    renderCtx.stroke();

    if (play.mode === 'wall') {
      renderCtx.fillStyle = 'rgba(34, 211, 238, 0.25)';
      renderCtx.beginPath();
      renderCtx.arc(0, 0, 10, 0, Math.PI * 2);
      renderCtx.fill();
      renderCtx.fillStyle = '#e0f2fe';
      renderCtx.beginPath();
      renderCtx.arc(ringRadius, 0, 3.2, 0, Math.PI * 2);
      renderCtx.fill();
    }
    renderCtx.restore();

    if (actor && actor.twoOneRunTimer > 0) {
      renderCtx.save();
      renderCtx.strokeStyle = 'rgba(103, 232, 249, 0.75)';
      renderCtx.shadowColor = '#22d3ee';
      renderCtx.shadowBlur = 10;
      renderCtx.lineWidth = 2.2;
      renderCtx.setLineDash([5, 5]);
      renderCtx.beginPath();
      renderCtx.arc(actor.x, actor.y, actor.radius + 7, 0, Math.PI * 2);
      renderCtx.stroke();
      renderCtx.setLineDash([]);
      renderCtx.restore();
    }
  }

  // 3. Ondas de choque (no passe, no ricochete e no domínio de primeira)
  for (let i = 0; i < twoOneEffects.length; i++) {
    const fx = twoOneEffects[i];
    const alpha = Math.max(0, fx.life / fx.maxLife);
    renderCtx.save();
    renderCtx.globalAlpha = alpha * 0.9;
    renderCtx.strokeStyle = fx.color;
    renderCtx.shadowColor = fx.color;
    renderCtx.shadowBlur = 14;
    renderCtx.lineWidth = 3 * alpha + 1;
    renderCtx.beginPath();
    renderCtx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
    renderCtx.stroke();

    renderCtx.globalAlpha = alpha * 0.5;
    renderCtx.strokeStyle = '#ffffff';
    renderCtx.lineWidth = 1.4;
    renderCtx.beginPath();
    renderCtx.arc(fx.x, fx.y, fx.radius * 0.68, 0, Math.PI * 2);
    renderCtx.stroke();
    renderCtx.restore();
  }

  renderCtx.restore();
}
