/**
 * ==========================================================================
 * LITO BALL - INTELIGÊNCIA ARTIFICIAL TÁTICA (js/ai.js)
 * ==========================================================================
 * Sistema baseado em formação, papéis dinâmicos e espaçamento tático,
 * projetado para 1v1 e 2v2 sem aglomeração e estruturado para escalar para 3v3 / 4v4.
 */
'use strict';

const AI_ROLES = {
  CARRIER: 'CARRIER',
  PRESS: 'PRESS',
  STRIKER_SUPPORT: 'STRIKER_SUPPORT',
  MIDFIELD_BALANCE: 'MIDFIELD_BALANCE',
  COVER: 'COVER'
};

const aiState = {
  mode: 'DEFEND',
  targetX: 740,
  targetY: 300,
  ownGoalCenter: { x: CONFIG.pitch.right, y: CONFIG.pitch.centerY },
  enemyGoalCenter: { x: CONFIG.pitch.left, y: CONFIG.pitch.centerY }
};

// Memória de papéis por time para histerese (evita troca frenética e disputa da mesma bola)
const teamTacticalMemory = {
  home: { presser: null, holdTimer: 0, roles: new Map() },
  away: { presser: null, holdTimer: 0, roles: new Map() }
};

function shadowAdjustedTarget(actor, targetX, targetY, opponents) {
  if (actor.powerEffect !== 'shadow' || !opponents.length) {
    return { x: targetX, y: targetY };
  }
  const ballCarrier = findControlledActor(opponents);
  const mark = ballCarrier || opponents.reduce((nearest, opponent) =>
    Math.hypot(opponent.x - ball.x, opponent.y - ball.y) < Math.hypot(nearest.x - ball.x, nearest.y - ball.y)
      ? opponent
      : nearest,
    opponents[0]
  );
  // Puxa o marcador para cima da linha entre o alvo e o próprio gol
  const pullWeight = ballCarrier === mark ? 0.55 : 0.34;
  return {
    x: targetX * (1 - pullWeight) + (mark.x + mark.vx * 4) * pullWeight,
    y: targetY * (1 - pullWeight) + (mark.y + mark.vy * 4) * pullWeight
  };
}

function predictBallPosition(frames = 12) {
  const p = CONFIG.pitch;
  const g = CONFIG.goals;
  let px = ball.x;
  let py = ball.y;
  let vx = ball.vx;
  let vy = ball.vy;

  for (let i = 0; i < frames; i++) {
    vx *= CONFIG.physics.dampingBall;
    vy *= CONFIG.physics.dampingBall;
    px += vx;
    py += vy;

    if (py - ball.radius < p.top) {
      py = p.top + ball.radius;
      vy = Math.abs(vy) * CONFIG.physics.restitutionWall;
    } else if (py + ball.radius > p.bottom) {
      py = p.bottom - ball.radius;
      vy = -Math.abs(vy) * CONFIG.physics.restitutionWall;
    }

    const insideGoalY = py >= g.topY && py <= g.bottomY;
    if (!insideGoalY) {
      if (px - ball.radius < p.left) {
        px = p.left + ball.radius;
        vx = Math.abs(vx) * CONFIG.physics.restitutionWall;
      } else if (px + ball.radius > p.right) {
        px = p.right - ball.radius;
        vx = -Math.abs(vx) * CONFIG.physics.restitutionWall;
      }
    }
  }
  return { x: px, y: py };
}

function unstickFromPostOrWall(actor, dirX, dirY) {
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const dx = actor.x - post.x;
    const dy = actor.y - post.y;
    const dist = Math.hypot(dx, dy);
    const avoidDist = actor.radius + post.radius + 11;
    if (dist < avoidDist && dist > 0.001) {
      const nx = dx / dist;
      const ny = dy / dist;
      const cross = nx * dirY - ny * dirX;
      const tangentSign = cross >= 0 ? 1 : -1;
      return {
        x: dirX * 0.55 + (nx * 0.45 - ny * tangentSign * 0.65),
        y: dirY * 0.55 + (ny * 0.45 + nx * tangentSign * 0.65)
      };
    }
  }
  return { x: dirX, y: dirY };
}

function driveBotTo(actor, targetX, targetY, speedScale = 1.0, precisionStop = false, teammates = []) {
  const p = CONFIG.pitch;
  let goalX = targetX;
  let goalY = targetY;

  // Repulsão suave em tempo real se dois companheiros ficarem colados demais
  for (let i = 0; i < teammates.length; i++) {
    const mate = teammates[i];
    if (!mate || mate === actor) continue;
    const sepX = actor.x - mate.x;
    const sepY = actor.y - mate.y;
    const sepDist = Math.hypot(sepX, sepY);
    const personalBubble = actor.radius + mate.radius + 54;
    if (sepDist < personalBubble && sepDist > 0.001) {
      const push = (personalBubble - sepDist) * 0.85;
      goalX += (sepX / sepDist) * push * 0.45;
      goalY += (sepY / sepDist) * push;
    }
  }

  const clampedX = Math.max(p.left + actor.radius + 2, Math.min(p.right - actor.radius - 2, goalX));
  const clampedY = Math.max(p.top + actor.radius + 2, Math.min(p.bottom - actor.radius - 2, goalY));

  const dx = clampedX - actor.x;
  const dy = clampedY - actor.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return;

  let dirX = dx / dist;
  let dirY = dy / dist;
  const adjusted = unstickFromPostOrWall(actor, dirX, dirY);
  const adjLen = Math.hypot(adjusted.x, adjusted.y) || 1;
  dirX = adjusted.x / adjLen;
  dirY = adjusted.y / adjLen;

  actor.facingX = dirX;
  actor.facingY = dirY;

  const staggerScale = actor.tackleStaggerTimer > 0 ? 0.35 : 1.0;
  const arriveScale = precisionStop && dist < 24 ? Math.max(0.25, dist / 24) : 1.0;
  const egoBoost = actor.powerEffect === 'ego' ? 1.16 : 1.0;
  const accel = CONFIG.physics.playerAcceleration * speedScale * staggerScale * arriveScale * egoBoost;

  actor.vx += dirX * accel;
  actor.vy += dirY * accel;
}

function chooseBestShotTarget(goalX, defenders) {
  const g = CONFIG.goals;
  const candidates = [g.topY + 20, (g.topY + g.bottomY) / 2, g.bottomY - 20];
  let bestY = (g.topY + g.bottomY) / 2;
  let bestScore = -Infinity;

  for (const cy of candidates) {
    const minDefDist = defenders.length
      ? Math.min(...defenders.map(d => pointSegmentDistance(d.x, d.y, ball.x, ball.y, goalX, cy)))
      : 160;
    const edgeBonus = cy === (g.topY + g.bottomY) / 2 ? 0 : 14;
    const score = minDefDist + edgeBonus;
    if (score > bestScore) {
      bestScore = score;
      bestY = cy;
    }
  }
  return { x: goalX, y: bestY };
}

function enforceTeammateSpacing(actor, targetX, targetY, teammates, minSpacing = 128) {
  const p = CONFIG.pitch;
  let x = targetX;
  let y = targetY;

  for (const mate of teammates) {
    if (!mate || mate === actor) continue;
    const dx = x - mate.x;
    const dy = y - mate.y;
    const dist = Math.hypot(dx, dy);
    if (dist < minSpacing) {
      // Desloca preferencialmente no eixo vertical (abrindo corredor oposto), preservando estrutura horizontal
      const pushDirY = Math.abs(dy) > 8
        ? Math.sign(dy)
        : (mate.y < p.centerY ? 1 : -1);
      const neededY = minSpacing - dist;
      y += pushDirY * Math.max(48, neededY * 0.95);
      if (y < p.top + 38 || y > p.bottom - 38) {
        y = Math.max(p.top + 38, Math.min(p.bottom - 38, mate.y + (mate.y < p.centerY ? minSpacing : -minSpacing)));
      }
      if (Math.hypot(x - mate.x, y - mate.y) < minSpacing * 0.8) {
        const pushDirX = dx !== 0 ? Math.sign(dx) : -1;
        x += pushDirX * (minSpacing * 0.45);
      }
    }
  }

  return {
    x: Math.max(p.left + actor.radius + 14, Math.min(p.right - actor.radius - 14, x)),
    y: Math.max(p.top + actor.radius + 14, Math.min(p.bottom - actor.radius - 14, y))
  };
}

function chooseSmartSupportSpot(anchor, runner, defenders, attackDirection, teammates = []) {
  const p = CONFIG.pitch;
  const advances = [95, 165, 235];
  // Prioriza o corredor vertical oposto ao portador da bola para gerar triângulos limpos
  const oppositeSideSign = anchor.y < p.centerY ? 1 : -1;
  const lanes = [
    oppositeSideSign * 135,
    oppositeSideSign * 190,
    -oppositeSideSign * 120,
    oppositeSideSign * 80
  ];

  let best = null;
  let bestScore = -Infinity;

  for (const advance of advances) {
    for (const lane of lanes) {
      const candidateX = Math.max(p.left + runner.radius + 20, Math.min(p.right - runner.radius - 20, anchor.x + attackDirection * advance));
      const candidateY = Math.max(p.top + runner.radius + 20, Math.min(p.bottom - runner.radius - 20, anchor.y + lane));

      const anchorGap = Math.hypot(candidateX - anchor.x, candidateY - anchor.y);
      if (anchorGap < 122) continue;

      // Garante espaçamento de outros companheiros (escala para 3v3 / 4v4)
      const otherMateMinGap = teammates.length > 2
        ? Math.min(...teammates.filter(m => m !== runner && m !== anchor).map(m => Math.hypot(candidateX - m.x, candidateY - m.y)), 999)
        : 999;
      if (otherMateMinGap < 110) continue;

      const target = { x: candidateX, y: candidateY };
      const defenderGap = defenders.length
        ? Math.min(...defenders.map(def => Math.hypot(target.x - def.x, target.y - def.y)))
        : 200;
      const passBlocked = isPassPathBlocked(ball, target, anchor);
      const runnerBlocked = defenders.some(def =>
        pointSegmentDistance(def.x, def.y, runner.x, runner.y, target.x, target.y) < def.radius + runner.radius + 10
      );

      const forwardGain = Math.max(0, (target.x - anchor.x) * attackDirection);
      const laneWidthBonus = Math.abs(target.y - anchor.y) * 0.28;
      const oppositeBonus = (target.y - p.centerY) * (anchor.y - p.centerY) < 0 ? 34 : 0;

      const score =
        Math.min(defenderGap, 220) * 0.54 -
        Math.abs(anchorGap - 185) * 0.24 +
        Math.min(forwardGain, 240) * 0.25 +
        laneWidthBonus +
        oppositeBonus -
        (passBlocked ? 105 : 0) -
        (runnerBlocked ? 38 : 0) -
        Math.hypot(target.x - runner.x, target.y - runner.y) * 0.04;

      if (score > bestScore) {
        bestScore = score;
        best = target;
      }
    }
  }

  const fallback = best || {
    x: Math.max(p.left + 44, Math.min(p.right - 44, anchor.x + attackDirection * 145)),
    y: anchor.y < p.centerY ? Math.min(p.bottom - 52, anchor.y + 135) : Math.max(p.top + 52, anchor.y - 135)
  };
  return enforceTeammateSpacing(runner, fallback.x, fallback.y, teammates, 130);
}

function getAttackApproachPoint(actor, targetGoalX, targetGoalY, predictedBall) {
  const p = CONFIG.pitch;
  const attackDx = targetGoalX - predictedBall.x;
  const attackDy = targetGoalY - predictedBall.y;
  const attackDist = Math.hypot(attackDx, attackDy) || 1;
  const attackDirX = attackDx / attackDist;
  const attackDirY = attackDy / attackDist;

  const behindOffset = actor.radius + ball.radius + 10;
  const behindX = predictedBall.x - attackDirX * behindOffset;
  const behindY = predictedBall.y - attackDirY * behindOffset;

  const attackingLeft = targetGoalX < p.centerX;
  const wrongSide = attackingLeft
    ? actor.x < predictedBall.x - 8
    : actor.x > predictedBall.x + 8;

  if (wrongSide) {
    const steerSign = actor.y <= predictedBall.y ? -1 : 1;
    const safeY = Math.max(p.top + actor.radius + 16, Math.min(p.bottom - actor.radius - 16, predictedBall.y + steerSign * 64));
    const wrapX = attackingLeft
      ? Math.min(p.right - actor.radius - 14, predictedBall.x + 54)
      : Math.max(p.left + actor.radius + 14, predictedBall.x - 54);
    return { x: wrapX, y: safeY, wrongSide: true };
  }

  const distToBehind = Math.hypot(behindX - actor.x, behindY - actor.y);
  if (distToBehind < 24) {
    return { x: predictedBall.x, y: predictedBall.y, wrongSide: false };
  }
  return { x: behindX, y: behindY, wrongSide: false };
}

/**
 * Avalia qual companheiro oferece a melhor linha de passe (2v2, 3v3, 4v4).
 */
function findBestPassTarget(actor, teammates, opponents, attackDir) {
  let bestTarget = null;
  let bestScore = -Infinity;
  const nearestOppDist = opponents.length
    ? Math.min(...opponents.map(o => Math.hypot(o.x - actor.x, o.y - actor.y)))
    : 300;

  for (const mate of teammates) {
    if (!mate || mate === actor) continue;
    const dist = Math.hypot(mate.x - ball.x, mate.y - ball.y);
    if (dist < 78 || dist > 360) continue;
    if (isPassPathBlocked(ball, mate, actor)) continue;

    const advance = (mate.x - actor.x) * attackDir;
    const mateSpace = opponents.length
      ? Math.min(...opponents.map(o => Math.hypot(o.x - mate.x, o.y - mate.y)))
      : 220;
    const laneSwitch = Math.abs(mate.y - actor.y) > 95 ? 28 : 0;

    // Passa em profundidade/inversão quando companheiro está avançado e livre, ou sob pressão
    const wantsPass = advance > 28 || (nearestOppDist < 82 && advance > -35) || (mateSpace > 125 && advance > 0);
    if (!wantsPass) continue;

    const score = advance * 0.7 + Math.min(mateSpace, 200) * 0.55 + laneSwitch - Math.abs(dist - 190) * 0.15;
    if (score > bestScore) {
      bestScore = score;
      bestTarget = mate;
    }
  }
  return bestTarget;
}

/**
 * Atribui papéis táticos distintos por time sem que bots disputem a mesma função.
 * Escalável para 2v2, 3v3 e 4v4.
 */
function assignTeamRoles(teamKey, teamActors, opponents, attackDir, predicted) {
  const memory = teamTacticalMemory[teamKey];
  memory.roles.clear();

  const carrier = findControlledActor(teamActors);
  if (carrier) {
    memory.presser = carrier;
    memory.holdTimer = 0.25;
    memory.roles.set(carrier, AI_ROLES.CARRIER);

    const others = teamActors
      .filter(a => a !== carrier)
      .sort((a, b) => (b.x - a.x) * attackDir);

    if (others.length === 1) {
      // Em 2v2: se estamos pressionados atrás, o parceiro oferece saída; mais à frente, ataca o espaço livre
      memory.roles.set(others[0], AI_ROLES.STRIKER_SUPPORT);
    } else if (others.length >= 2) {
      others.forEach((mate, idx) => {
        if (idx === 0) memory.roles.set(mate, AI_ROLES.STRIKER_SUPPORT);
        else if (idx === others.length - 1) memory.roles.set(mate, AI_ROLES.COVER);
        else memory.roles.set(mate, AI_ROLES.MIDFIELD_BALANCE);
      });
    }
    return memory.roles;
  }

  // Sem posse: escolhe 1 PRESS com histerese e distribui COVER / MIDFIELD_BALANCE pelos demais
  let presser = null;
  let bestPressScore = Infinity;

  for (const actor of teamActors) {
    const wrongSide = attackDir < 0
      ? (actor.x < predicted.x - 10 ? 78 : 0)
      : (actor.x > predicted.x + 10 ? 78 : 0);
    const hysteresis = memory.presser === actor && memory.holdTimer > 0 ? -42 : 0;
    const score = Math.hypot(predicted.x - actor.x, predicted.y - actor.y) + wrongSide + hysteresis;
    if (score < bestPressScore) {
      bestPressScore = score;
      presser = actor;
    }
  }

  if (memory.presser !== presser) {
    memory.presser = presser;
    memory.holdTimer = 0.28;
  }
  memory.roles.set(presser, AI_ROLES.PRESS);

  // Demais companheiros ordenados do mais defensivo ao mais adiantado
  const rest = teamActors
    .filter(a => a !== presser)
    .sort((a, b) => (a.x - b.x) * attackDir);

  rest.forEach((mate, idx) => {
    if (idx === 0) memory.roles.set(mate, AI_ROLES.COVER);
    else if (idx === rest.length - 1 && rest.length >= 2) memory.roles.set(mate, AI_ROLES.STRIKER_SUPPORT);
    else memory.roles.set(mate, AI_ROLES.MIDFIELD_BALANCE);
  });

  return memory.roles;
}

function executeTeamCarrierBehavior(actor, teammates, opponents, attackDir) {
  const p = CONFIG.pitch;
  const targetGoalX = attackDir > 0 ? p.right : p.left;
  const shotTarget = chooseBestShotTarget(targetGoalX, opponents);
  const dx = shotTarget.x - ball.x;
  const dy = shotTarget.y - ball.y;
  const goalDist = Math.hypot(dx, dy) || 1;

  const shotBlockedClose = opponents.some(o =>
    (o.x - ball.x) * attackDir > 0 &&
    Math.hypot(o.x - ball.x, o.y - ball.y) < 115 &&
    pointSegmentDistance(o.x, o.y, ball.x, ball.y, shotTarget.x, shotTarget.y) < o.radius + ball.radius + 10
  );

  // 1. Finalização objetiva se ângulo limpo dentro da zona ofensiva
  if (goalDist < 335 && !shotBlockedClose && actor.kickCooldownTimer <= 0) {
    actor.tryKick(ball, dx / goalDist, dy / goalDist);
    return;
  }

  // 2. Passe tático em profundidade ou inversão para companheiro desmarcado
  if (teammates.length > 1 && actor.kickCooldownTimer <= 0) {
    const passTarget = findBestPassTarget(actor, teammates, opponents, attackDir);
    if (passTarget && actor.tryKick(ball, 0, 0, true, passTarget)) return;
  }

  // 3. Condução desviando do marcador frontal mantendo ângulo de chute
  let steerY = shotTarget.y;
  const nearestDef = opponents.reduce((best, d) =>
    Math.hypot(d.x - actor.x, d.y - actor.y) < Math.hypot(best.x - actor.x, best.y - actor.y) ? d : best,
    opponents[0]
  );
  if (nearestDef && (nearestDef.x - actor.x) * attackDir > 0 && Math.hypot(nearestDef.x - actor.x, nearestDef.y - actor.y) < 122) {
    steerY = nearestDef.y > actor.y
      ? Math.max(p.top + 44, actor.y - 90)
      : Math.min(p.bottom - 44, actor.y + 90);
  }
  const driveGoalX = attackDir > 0 ? p.right - 68 : p.left + 68;
  driveBotTo(actor, driveGoalX, steerY, 1.06, false, teammates);
}

function executeBotRoleBehavior(actor, role, teammates, opponents, attackDir, predicted) {
  const p = CONFIG.pitch;
  const targetGoalX = attackDir > 0 ? p.right : p.left;
  const ownGoalX = attackDir > 0 ? p.left : p.right;
  const teamCarrier = findControlledActor(teammates);
  const oppCarrier = findControlledActor(opponents);

  if (role === AI_ROLES.CARRIER) {
    executeTeamCarrierBehavior(actor, teammates, opponents, attackDir);
    return;
  }

  if (role === AI_ROLES.STRIKER_SUPPORT) {
    const anchor = teamCarrier || predicted;
    const spot = chooseSmartSupportSpot(anchor, actor, opponents, attackDir, teammates);
    const target = shadowAdjustedTarget(actor, spot.x, spot.y, opponents);
    driveBotTo(actor, target.x, target.y, 1.05, false, teammates);
    return;
  }

  if (role === AI_ROLES.MIDFIELD_BALANCE) {
    // Zona intermediária de equilíbrio para futuros 3v3 / 4v4
    const midX = (predicted.x + ownGoalX) * 0.52;
    const laneOffset = predicted.y > p.centerY ? -115 : 115;
    const balanced = enforceTeammateSpacing(actor, midX, p.centerY + laneOffset, teammates, 130);
    driveBotTo(actor, balanced.x, balanced.y, 1.02, true, teammates);
    return;
  }

  if (role === AI_ROLES.PRESS) {
    const shotHint = chooseBestShotTarget(targetGoalX, opponents);
    const approach = getAttackApproachPoint(actor, targetGoalX, shotHint.y, predicted);
    const pressX = oppCarrier ? oppCarrier.x + oppCarrier.vx * 3 - attackDir * 12 : approach.x;
    const pressY = oppCarrier ? oppCarrier.y + oppCarrier.vy * 3 : approach.y;
    const rawTarget = approach.wrongSide ? approach : { x: pressX, y: pressY };
    const adjusted = shadowAdjustedTarget(actor, rawTarget.x, rawTarget.y, opponents);
    driveBotTo(actor, adjusted.x, adjusted.y, 1.12, false, teammates);

    const ballDist = Math.hypot(ball.x - actor.x, ball.y - actor.y);
    const onGoalSide = attackDir < 0 ? actor.x > ball.x - 2 : actor.x < ball.x + 2;
    if (ballDist <= actor.radius + ball.radius + CONFIG.physics.kickReachMargin && onGoalSide && actor.kickCooldownTimer <= 0) {
      const passTarget = findBestPassTarget(actor, teammates, opponents, attackDir);
      if (passTarget && (ball.x - ownGoalX) * attackDir < 420) {
        actor.tryKick(ball, 0, 0, true, passTarget);
      } else {
        const goalShot = chooseBestShotTarget(targetGoalX, opponents);
        actor.tryKick(ball, attackDir, (goalShot.y - ball.y) / 215);
      }
    }
    return;
  }

  // AI_ROLES.COVER: proteção coordenada da zona defensiva + marcação de linha de passe
  const inDangerZone = attackDir < 0
    ? predicted.x > p.centerX + 70
    : predicted.x < p.centerX - 70;
  let coverX;
  let coverY;

  if (inDangerZone) {
    // Entre a bola e o gol próprio, deslocado levemente do lado oposto ao pressionador
    coverX = ownGoalX - attackDir * Math.max(58, Math.min(260, Math.abs(predicted.x - ownGoalX) * 0.52));
    coverY = p.centerY + (predicted.y - p.centerY) * 0.55;
    coverY = Math.max(CONFIG.goals.topY - 30, Math.min(CONFIG.goals.bottomY + 30, coverY));
  } else {
    // Marca atacante adversário sem bola e fecha corredor central
    const nonCarrierOpps = opponents.filter(o => o !== oppCarrier);
    const mark = nonCarrierOpps[0] || opponents[0];
    coverX = Math.max(p.left + 74, Math.min(p.right - 74, mark.x - attackDir * 72));
    coverY = mark.y * 0.68 + p.centerY * 0.32;
  }

  const spaced = enforceTeammateSpacing(actor, coverX, coverY, teammates, 132);
  const target = shadowAdjustedTarget(actor, spaced.x, spaced.y, opponents);
  driveBotTo(actor, target.x, target.y, 1.04, true, teammates);

  // Se a bola cruzar sua área de cobertura, afasta ou liga contra-ataque limpo
  const ballDist = Math.hypot(ball.x - actor.x, ball.y - actor.y);
  const onGoalSide = attackDir < 0 ? actor.x > ball.x - 2 : actor.x < ball.x + 2;
  if (ballDist <= actor.radius + ball.radius + CONFIG.physics.kickReachMargin && onGoalSide && actor.kickCooldownTimer <= 0) {
    const passTarget = findBestPassTarget(actor, teammates, opponents, attackDir);
    if (passTarget) {
      actor.tryKick(ball, 0, 0, true, passTarget);
    } else {
      actor.tryKick(ball, attackDir, (p.centerY - ball.y) / 240);
    }
  }
}

function updateAI(dt) {
  const p = CONFIG.pitch;
  if (teamTacticalMemory.away.holdTimer > 0) {
    teamTacticalMemory.away.holdTimer = Math.max(0, teamTacticalMemory.away.holdTimer - dt);
  }
  if (gameMode !== 'training') updatePowerBot(dt, player2);

  if (gameMode === '2v2') {
    const awayTeam = [player2, awayMate];
    const homeTeam = [player1, homeMate];
    const predicted = predictBallPosition(9);
    const roles = assignTeamRoles('away', awayTeam, homeTeam, -1, predicted);
    executeBotRoleBehavior(player2, roles.get(player2) || AI_ROLES.PRESS, awayTeam, homeTeam, -1, predicted);
    return;
  }

  // --- MODO 1v1 (match) ---
  const defenders = [player1];
  const predicted = predictBallPosition(10);
  const shotTarget = chooseBestShotTarget(p.left, defenders);

  if (isBallControlledBy(player2)) {
    const dx = shotTarget.x - ball.x;
    const dy = shotTarget.y - ball.y;
    const goalDistance = Math.hypot(dx, dy) || 1;
    if (goalDistance < 320 && player2.kickCooldownTimer <= 0) {
      player2.tryKick(ball, dx / goalDistance, dy / goalDistance);
      return;
    }
    driveBotTo(player2, shotTarget.x, shotTarget.y, 1.04);
    return;
  }

  const distToBall = Math.hypot(ball.x - player2.x, ball.y - player2.y);
  const ownGoal = aiState.ownGoalCenter;
  const ballDistToOwnGoal = Math.hypot(predicted.x - ownGoal.x, predicted.y - ownGoal.y);
  const isAheadOfBall = player2.x < predicted.x + 8;

  if (predicted.x > p.centerX + 40 && isAheadOfBall && ballDistToOwnGoal < 260) {
    aiState.mode = 'DEFEND';
    const t = 0.52;
    aiState.targetX = Math.min(p.right - 34, ownGoal.x + (predicted.x - ownGoal.x) * t);
    aiState.targetY = ownGoal.y + (predicted.y - ownGoal.y) * t;
  } else {
    const approach = getAttackApproachPoint(player2, p.left, shotTarget.y, predicted);
    aiState.mode = approach.wrongSide ? 'REPOSITION' : 'ATTACK';
    aiState.targetX = approach.x;
    aiState.targetY = approach.y;
  }

  const shadowTarget = shadowAdjustedTarget(player2, aiState.targetX, aiState.targetY, defenders);
  driveBotTo(player2, shadowTarget.x, shadowTarget.y, 1.06);

  if (
    distToBall <= player2.radius + ball.radius + CONFIG.physics.kickReachMargin &&
    ball.x - p.left < 320 &&
    player2.x > ball.x - 2 &&
    player2.kickCooldownTimer <= 0
  ) {
    player2.tryKick(ball, -1, (shotTarget.y - ball.y) / 210);
  }
}

function updateAwayMateAI(dt) {
  if (gameMode !== '2v2') return;
  updatePowerBot(dt, awayMate);

  const awayTeam = [player2, awayMate];
  const homeTeam = [player1, homeMate];
  const predicted = predictBallPosition(9);
  const roles = assignTeamRoles('away', awayTeam, homeTeam, -1, predicted);
  executeBotRoleBehavior(awayMate, roles.get(awayMate) || AI_ROLES.COVER, awayTeam, homeTeam, -1, predicted);
}

function updateHomeMateAI(dt) {
  const p = CONFIG.pitch;
  if (teamTacticalMemory.home.holdTimer > 0) {
    teamTacticalMemory.home.holdTimer = Math.max(0, teamTacticalMemory.home.holdTimer - dt);
  }

  // Comportamento especial da Visão de Campo
  if (gameMode === '2v2' && homeMate.visionRunTimer > 0 && isBallControlledBy(homeMate)) {
    homeMate.facingX = homeMate.visionRunDirectionX;
    homeMate.facingY = homeMate.visionRunDirectionY;
    homeMate.vx += homeMate.facingX * CONFIG.physics.playerAcceleration * 1.45;
    homeMate.vy += homeMate.facingY * CONFIG.physics.playerAcceleration * 1.45;
    return;
  }

  // Comportamento especial Toque e Passa
  if (twoOnePlay && twoOnePlay.target === homeMate && twoOnePlay.phase === 'receiveWait') {
    if (!isBallReceivedBy(homeMate)) return;
    const faceX = player1.x - homeMate.x;
    const faceY = player1.y - homeMate.y;
    const length = Math.hypot(faceX, faceY) || 1;
    homeMate.facingX = faceX / length;
    homeMate.facingY = faceY / length;
    if (twoOnePlay.waitTimer <= 0) {
      const targetPoint = projectTwoOneReceiver(CONFIG.physics.kickPower * 0.9 * 0.92);
      if (homeMate.kickCooldownTimer > 0 || isPassPathBlocked(ball, targetPoint, homeMate)) {
        finishTwoOne(false, 'O retorno foi bloqueado; jogada encerrada');
        return;
      }
      if (homeMate.tryKick(ball, 0, 0, true, targetPoint)) {
        ball.vx *= 0.92;
        ball.vy *= 0.92;
        ball.dribbleLockTimer = 0.16;
        ball.dribbleLockOwner = homeMate;
        twoOnePlay.phase = 'return';
        twoOnePlay.timer = 2.1;
        twoOnePlay.returnAssistTimer = 1.8;
        twoOnePlay.returnTurnBudget = 0.68;
      } else {
        finishTwoOne(false, 'O companheiro não conseguiu devolver a bola');
      }
    }
    return;
  }

  if (twoOnePlay && twoOnePlay.target === homeMate && twoOnePlay.phase === 'outbound') {
    if (isBallReceivedBy(homeMate)) {
      twoOnePlay.phase = 'receiveWait';
      twoOnePlay.waitTimer = 0.8;
      twoOnePlay.timer = 2.6;
      twoOnePlay.receiveLostTimer = 0;
      return;
    }
    driveBotTo(homeMate, ball.x + ball.vx * 3, ball.y + ball.vy * 3, 1.12);
    return;
  }

  if (twoOnePlay && twoOnePlay.target === homeMate && twoOnePlay.phase === 'return') return;

  // Modo 2v2: usa o mesmo motor tático escalável respeitando o usuário humano (player1)
  if (gameMode === '2v2') {
    const homeTeam = [player1, homeMate];
    const awayTeam = [player2, awayMate];
    const predicted = predictBallPosition(9);

    if (isBallControlledBy(homeMate)) {
      executeTeamCarrierBehavior(homeMate, homeTeam, awayTeam, 1);
      return;
    }

    const blueCarrier = findControlledActor(homeTeam);
    if (blueCarrier === player1) {
      const spot = chooseSmartSupportSpot(player1, homeMate, awayTeam, 1, homeTeam);
      const target = shadowAdjustedTarget(homeMate, spot.x, spot.y, awayTeam);
      driveBotTo(homeMate, target.x, target.y, 1.06, false, homeTeam);
      return;
    }

    // Sem posse azul: só pressiona se estiver claramente mais perto que player1 ou se player1 passou da linha da bola
    const distMate = Math.hypot(predicted.x - homeMate.x, predicted.y - homeMate.y);
    const distP1 = Math.hypot(predicted.x - player1.x, predicted.y - player1.y);
    const p1OutOfPlay = player1.x > predicted.x + 36;
    const shouldPress = (distMate < distP1 - 12 || p1OutOfPlay);

    const role = shouldPress ? AI_ROLES.PRESS : AI_ROLES.COVER;
    executeBotRoleBehavior(homeMate, role, homeTeam, awayTeam, 1, predicted);
    return;
  }

  // Modo Treino livre: acompanha suavemente em apoio espaçado
  let targetX = Math.max(p.left + 30, Math.min(p.right - 40, ball.x - 125));
  const upperY = Math.max(p.top + 46, Math.min(p.bottom - 46, ball.y - 110));
  const lowerY = Math.max(p.top + 46, Math.min(p.bottom - 46, ball.y + 110));
  let targetY = Math.hypot(targetX - player1.x, upperY - player1.y) >= Math.hypot(targetX - player1.x, lowerY - player1.y)
    ? upperY
    : lowerY;
  if (Math.hypot(targetX - player1.x, targetY - player1.y) < 95) {
    targetY = targetY === upperY ? lowerY : upperY;
  }
  driveBotTo(homeMate, targetX, targetY, 0.85, true, [player1, homeMate]);
}
