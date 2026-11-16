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
  WING_SUPPORT: 'WING_SUPPORT',
  MIDFIELD_BALANCE: 'MIDFIELD_BALANCE',
  COVER: 'COVER',
  GK_COVER: 'GK_COVER'
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
  if (!actor || actor.webSnareTimer > 0) return;
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
    const personalBubble = actor.radius + mate.radius + (teammates.length >= 4 ? 76 : teammates.length === 3 ? 66 : 54);
    if (sepDist < personalBubble && sepDist > 0.001) {
      const push = (personalBubble - sepDist) * 0.9;
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

  const pace = typeof getModePaceScale === 'function' ? getModePaceScale().player : 1;
  const staggerScale = actor.tackleStaggerTimer > 0 ? 0.35 : 1.0;
  const arriveScale = precisionStop && dist < 24 ? Math.max(0.25, dist / 24) : 1.0;
  const egoBoost = actor.powerEffect === 'ego' ? 1.16 : 1.0;
  const accel = CONFIG.physics.playerAcceleration * pace * speedScale * staggerScale * arriveScale * egoBoost;

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
 * Escalável para 1v1, 2v2, 3v3, 4v4 e 5v5 (com Goleiro-linha/Fixo, Alas/Meias e Pivô).
 */
function assignTeamRoles(teamKey, teamActors, opponents, attackDir, predicted) {
  const memory = teamTacticalMemory[teamKey];
  memory.roles.clear();
  if (!teamActors.length) return memory.roles;

  // Reserva um defensor fixo / goleiro-linha quando há 3+ jogadores no time (nunca player1)
  let anchorDef = null;
  let fieldActors = teamActors;
  if (teamActors.length >= 3) {
    const candidates = teamActors.filter(a => !a.isHuman);
    candidates.sort((a, b) => (a.aiRoleSlot || 0) - (b.aiRoleSlot || 0));
    anchorDef = candidates[candidates.length - 1] || null;
    if (anchorDef) {
      // Caso o goleiro-linha seja claramente o mais próximo da bola na pequena área, vira CARRIER se controlar
      if (isBallControlledBy(anchorDef)) {
        memory.roles.set(anchorDef, AI_ROLES.CARRIER);
      } else {
        memory.roles.set(anchorDef, AI_ROLES.GK_COVER);
      }
      fieldActors = teamActors.filter(a => a !== anchorDef);
    }
  }

  const carrier = findControlledActor(fieldActors);
  if (carrier) {
    memory.presser = carrier;
    memory.holdTimer = 0.25;
    memory.roles.set(carrier, AI_ROLES.CARRIER);

    const others = fieldActors
      .filter(a => a !== carrier)
      .sort((a, b) => (b.x - a.x) * attackDir);

    others.forEach((mate, idx) => {
      if (idx === 0) memory.roles.set(mate, AI_ROLES.STRIKER_SUPPORT);
      else if (idx === 1 && others.length >= 2) memory.roles.set(mate, AI_ROLES.WING_SUPPORT);
      else if (idx === others.length - 1 && others.length >= 3) memory.roles.set(mate, AI_ROLES.COVER);
      else memory.roles.set(mate, AI_ROLES.MIDFIELD_BALANCE);
    });
    return memory.roles;
  }

  // Sem posse: escolhe 1 PRESS com histerese e distribui STRIKER_SUPPORT / WING_SUPPORT / MIDFIELD_BALANCE / COVER
  let presser = null;
  let bestPressScore = Infinity;

  for (const actor of fieldActors) {
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
  if (presser) memory.roles.set(presser, AI_ROLES.PRESS);

  const rest = fieldActors
    .filter(a => a !== presser)
    .sort((a, b) => (a.x - b.x) * attackDir);

  rest.forEach((mate, idx) => {
    if (idx === 0 && rest.length >= 2) memory.roles.set(mate, AI_ROLES.COVER);
    else if (idx === rest.length - 1) memory.roles.set(mate, AI_ROLES.STRIKER_SUPPORT);
    else if (idx === 1) memory.roles.set(mate, AI_ROLES.WING_SUPPORT);
    else memory.roles.set(mate, AI_ROLES.MIDFIELD_BALANCE);
  });

  return memory.roles;
}

function executeTeamCarrierBehavior(actor, teammates, opponents, attackDir) {
  if (actor.webSnareTimer > 0) return;
  const p = CONFIG.pitch;
  const targetGoalX = attackDir > 0 ? p.right : p.left;
  const shotTarget = chooseBestShotTarget(targetGoalX, opponents);
  const dx = shotTarget.x - ball.x;
  const dy = shotTarget.y - ball.y;
  const goalDist = Math.hypot(dx, dy) || 1;
  const shootRange = Math.max(320, p.width * 0.36);

  const shotBlockedClose = opponents.some(o =>
    (o.x - ball.x) * attackDir > 0 &&
    Math.hypot(o.x - ball.x, o.y - ball.y) < 120 &&
    pointSegmentDistance(o.x, o.y, ball.x, ball.y, shotTarget.x, shotTarget.y) < o.radius + ball.radius + 10
  );

  // 1. Finalização objetiva se ângulo limpo dentro da zona ofensiva
  if (goalDist < shootRange && !shotBlockedClose && actor.kickCooldownTimer <= 0) {
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
      ? Math.max(p.top + 44, actor.y - 95)
      : Math.min(p.bottom - 44, actor.y + 95);
  }
  const driveGoalX = attackDir > 0 ? p.right - 68 : p.left + 68;
  const carrierPace = teammates.length >= 4 ? 0.96 : 1.04;
  driveBotTo(actor, driveGoalX, steerY, carrierPace, false, teammates);
}

function executeBotRoleBehavior(actor, role, teammates, opponents, attackDir, predicted) {
  if (!actor || actor.webSnareTimer > 0) return;
  const p = CONFIG.pitch;
  const g = CONFIG.goals;
  const targetGoalX = attackDir > 0 ? p.right : p.left;
  const ownGoalX = attackDir > 0 ? p.left : p.right;
  const teamCarrier = findControlledActor(teammates);
  const oppCarrier = findControlledActor(opponents);
  const bigTeam = teammates.length >= 4;
  const minZoneGap = bigTeam ? 158 : 138;

  if (role === AI_ROLES.CARRIER) {
    executeTeamCarrierBehavior(actor, teammates, opponents, attackDir);
    return;
  }

  if (role === AI_ROLES.GK_COVER) {
    // Goleiro-linha avançado com reação humana: joga à frente da pequena área, dando combate e deixando espaço atrás/nos cantos
    if (typeof actor.gkAimY !== 'number') actor.gkAimY = p.centerY;
    if (actor.gkReactCooldown > 0) {
      actor.gkReactCooldown = Math.max(0, actor.gkReactCooldown - CONFIG.physics.fixedDelta);
    }
    const vyShift = Math.abs(ball.vy - (actor.gkLastBallVy || 0));
    if (vyShift > 1.75) {
      actor.gkReactCooldown = 0.16;
    }
    actor.gkLastBallVy = ball.vy;

    const immediateX = ball.x + ball.vx * 1.5;
    const immediateY = ball.y + ball.vy * 1.5;
    const threatDist = Math.abs(immediateX - ownGoalX);

    // Atuação avançada entre a linha da grande área e o setor defensivo intermediário
    const sweeperMin = Math.max(p.goalAreaWidth * 1.45, p.penaltyWidth * 0.68);
    const sweeperMax = Math.max(sweeperMin + 60, p.width * 0.28);
    const guardOffset = Math.max(sweeperMin, Math.min(sweeperMax, threatDist * 0.34));
    const gkX = ownGoalX + attackDir * guardOffset;
    const targetGoalY = Math.max(g.topY + 22, Math.min(g.bottomY - 22, p.centerY + (immediateY - p.centerY) * 0.54));
    const smoothRate = actor.gkReactCooldown > 0 ? 0.036 : 0.088;
    actor.gkAimY += (targetGoalY - actor.gkAimY) * smoothRate;

    const oppCarrierNearBox = oppCarrier && Math.abs(oppCarrier.x - ownGoalX) < p.penaltyWidth * 1.45;
    const looseBallNearBox = !oppCarrier && threatDist < p.penaltyWidth * 1.25 && Math.hypot(ball.vx, ball.vy) < 4.2;

    if (oppCarrierNearBox || looseBallNearBox) {
      // Sai da boca do gol para dar combate ao portador/bola, abrindo espaço atrás e nos cantos para dribles/tabelas
      const challengeTarget = oppCarrierNearBox ? oppCarrier : { x: immediateX, y: immediateY };
      const wrongSide = attackDir < 0
        ? actor.x < challengeTarget.x - 8
        : actor.x > challengeTarget.x + 8;
      const rushTarget = wrongSide
        ? getAttackApproachPoint(actor, targetGoalX, p.centerY, challengeTarget)
        : { x: challengeTarget.x - attackDir * 12, y: challengeTarget.y };
      const rushSpeed = actor.gkReactCooldown > 0 ? 0.58 : 0.78;
      driveBotTo(actor, rushTarget.x, rushTarget.y, rushSpeed, false, teammates);
    } else {
      const gkSpeed = actor.gkReactCooldown > 0 ? 0.56 : 0.75;
      driveBotTo(actor, gkX, actor.gkAimY, gkSpeed, true, teammates);
    }

    const ballDist = Math.hypot(ball.x - actor.x, ball.y - actor.y);
    const onGoalSide = attackDir < 0 ? actor.x > ball.x - 4 : actor.x < ball.x + 4;
    if (ballDist <= actor.radius + ball.radius + CONFIG.physics.kickReachMargin && onGoalSide && actor.kickCooldownTimer <= 0) {
      const passTarget = findBestPassTarget(actor, teammates, opponents, attackDir);
      if (passTarget) {
        actor.tryKick(ball, 0, 0, true, passTarget);
      } else {
        actor.tryKick(ball, attackDir, (p.centerY - ball.y) / 280);
      }
    }
    return;
  }

  if (role === AI_ROLES.STRIKER_SUPPORT) {
    const anchor = teamCarrier || predicted;
    const spot = chooseSmartSupportSpot(anchor, actor, opponents, attackDir, teammates);
    const spaced = enforceTeammateSpacing(actor, spot.x, spot.y, teammates, minZoneGap);
    driveBotTo(actor, spaced.x, spaced.y, bigTeam ? 0.84 : 0.94, false, teammates);
    return;
  }

  if (role === AI_ROLES.WING_SUPPORT) {
    const anchor = teamCarrier || predicted;
    const wingSign = (actor.aiRoleSlot % 2 === 0 ? -1 : 1) * (anchor.y > p.centerY ? -1 : 1);
    const wingY = Math.max(p.top + 48, Math.min(p.bottom - 48, p.centerY + wingSign * (p.height * 0.37)));
    const targetWingX = Math.max(p.left + 96, Math.min(p.right - 96, anchor.x * 0.55 + p.centerX * 0.45 + attackDir * (p.width * 0.14)));
    const spaced = enforceTeammateSpacing(actor, targetWingX, wingY, teammates, minZoneGap);
    driveBotTo(actor, spaced.x, spaced.y, bigTeam ? 0.82 : 0.92, true, teammates);
    return;
  }

  if (role === AI_ROLES.MIDFIELD_BALANCE) {
    const midX = Math.max(p.left + 110, Math.min(p.right - 110, predicted.x * 0.42 + p.centerX * 0.38 + ownGoalX * 0.20));
    const slotSign = (actor.aiRoleSlot % 2 === 0 ? 1 : -1);
    const laneOffset = predicted.y > p.centerY ? -p.height * 0.22 : p.height * 0.22;
    const balanced = enforceTeammateSpacing(actor, midX, p.centerY + laneOffset * 0.72 + slotSign * 34, teammates, minZoneGap);
    driveBotTo(actor, balanced.x, balanced.y, bigTeam ? 0.80 : 0.90, true, teammates);
    return;
  }

  if (role === AI_ROLES.PRESS) {
    const shotHint = chooseBestShotTarget(targetGoalX, opponents);
    const approach = getAttackApproachPoint(actor, targetGoalX, shotHint.y, predicted);
    const pressX = oppCarrier ? oppCarrier.x + oppCarrier.vx * 3 - attackDir * 12 : approach.x;
    const pressY = oppCarrier ? oppCarrier.y + oppCarrier.vy * 3 : approach.y;
    const rawTarget = approach.wrongSide ? approach : { x: pressX, y: pressY };
    driveBotTo(actor, rawTarget.x, rawTarget.y, bigTeam ? 0.98 : 1.08, false, teammates);

    const ballDist = Math.hypot(ball.x - actor.x, ball.y - actor.y);
    const onGoalSide = attackDir < 0 ? actor.x > ball.x - 2 : actor.x < ball.x + 2;
    if (ballDist <= actor.radius + ball.radius + CONFIG.physics.kickReachMargin && onGoalSide && actor.kickCooldownTimer <= 0) {
      const passTarget = findBestPassTarget(actor, teammates, opponents, attackDir);
      if (passTarget && (ball.x - ownGoalX) * attackDir < p.width * 0.56) {
        actor.tryKick(ball, 0, 0, true, passTarget);
      } else {
        const goalShot = chooseBestShotTarget(targetGoalX, opponents);
        actor.tryKick(ball, attackDir, (goalShot.y - ball.y) / 215);
      }
    }
    return;
  }

  // AI_ROLES.COVER: proteção coordenada da zona defensiva + disciplina de cobertura
  const inDangerZone = attackDir < 0
    ? predicted.x > p.centerX + 70
    : predicted.x < p.centerX - 70;
  let coverX;
  let coverY;

  if (inDangerZone) {
    coverX = ownGoalX - attackDir * Math.max(72, Math.min(p.width * 0.32, Math.abs(predicted.x - ownGoalX) * 0.48));
    coverY = p.centerY + (predicted.y - p.centerY) * 0.52;
    coverY = Math.max(CONFIG.goals.topY - 46, Math.min(CONFIG.goals.bottomY + 46, coverY));
  } else {
    coverX = ownGoalX + attackDir * (p.width * 0.28);
    coverY = p.centerY + (predicted.y - p.centerY) * 0.34;
  }

  const spaced = enforceTeammateSpacing(actor, coverX, coverY, teammates, minZoneGap);
  driveBotTo(actor, spaced.x, spaced.y, bigTeam ? 0.80 : 0.90, true, teammates);

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

function updateTeamBots(dt) {
  const p = CONFIG.pitch;
  if (teamTacticalMemory.home.holdTimer > 0) {
    teamTacticalMemory.home.holdTimer = Math.max(0, teamTacticalMemory.home.holdTimer - dt);
  }
  if (teamTacticalMemory.away.holdTimer > 0) {
    teamTacticalMemory.away.holdTimer = Math.max(0, teamTacticalMemory.away.holdTimer - dt);
  }

  const homeTeam = typeof getActiveHomePlayers === 'function' ? getActiveHomePlayers() : [player1];
  const awayTeam = typeof getActiveAwayPlayers === 'function' ? getActiveAwayPlayers() : [player2];
  const predicted = predictBallPosition(9);

  // 1. Time Adversário (Away Team)
  if (gameMode === 'match') {
    updateAI(dt);
  } else if (gameMode !== 'training' && awayTeam.length) {
    const awayRoles = assignTeamRoles('away', awayTeam, homeTeam, -1, predicted);
    for (const bot of awayTeam) {
      if (!bot) continue;
      updatePowerBot(dt, bot);
      executeBotRoleBehavior(bot, awayRoles.get(bot) || AI_ROLES.PRESS, awayTeam, homeTeam, -1, predicted);
    }
  }

  // 2. Aliados da Casa (Home Team Bots em 2v2, 3v3, 4v4, 5v5 e Treino)
  if (gameMode === 'training') {
    updateHomeMateAI(dt);
    return;
  }

  const homeBots = homeTeam.filter(a => a && !a.isHuman);
  if (!homeBots.length) return;

  const twoOneTarget = (typeof twoOnePlay !== 'undefined' && twoOnePlay && twoOnePlay.mode === 'teammate')
    ? twoOnePlay.target
    : null;
  const homeRoles = assignTeamRoles('home', homeTeam, awayTeam, 1, predicted);
  const blueCarrier = findControlledActor(homeTeam);

  for (const bot of homeBots) {
    updatePowerBot(dt, bot);
    if (bot.webSnareTimer > 0) continue;

    if (bot.visionRunTimer > 0 && isBallControlledBy(bot)) {
      bot.facingX = bot.visionRunDirectionX;
      bot.facingY = bot.visionRunDirectionY;
      bot.vx += bot.facingX * CONFIG.physics.playerAcceleration * 1.45;
      bot.vy += bot.facingY * CONFIG.physics.playerAcceleration * 1.45;
      continue;
    }

    if (twoOneTarget === bot && typeof updateTwoOneTeammateBehavior === 'function' && updateTwoOneTeammateBehavior(dt)) {
      continue;
    }

    if (isBallControlledBy(bot)) {
      executeTeamCarrierBehavior(bot, homeTeam, awayTeam, 1);
      continue;
    }

    if (blueCarrier === player1 && homeBots.length === 1) {
      const spot = chooseSmartSupportSpot(player1, bot, awayTeam, 1, homeTeam);
      driveBotTo(bot, spot.x, spot.y, 1.06, false, homeTeam);
      continue;
    }

    // Respeita a regra estrita de no máximo 1 pressionador: se player1 já está próximo/disputando a bola, libera para outra zona
    let role = homeRoles.get(bot) || AI_ROLES.COVER;
    if (role === AI_ROLES.PRESS) {
      const distBot = Math.hypot(predicted.x - bot.x, predicted.y - bot.y);
      const distP1 = Math.hypot(predicted.x - player1.x, predicted.y - player1.y);
      const p1Engaged = distP1 < 120 || distP1 <= distBot + 24;
      if (p1Engaged) {
        role = homeTeam.length >= 4 ? AI_ROLES.MIDFIELD_BALANCE : AI_ROLES.COVER;
      }
    }
    executeBotRoleBehavior(bot, role, homeTeam, awayTeam, 1, predicted);
  }
}

function updateAI(dt) {
  const p = CONFIG.pitch;
  if (teamTacticalMemory.away.holdTimer > 0) {
    teamTacticalMemory.away.holdTimer = Math.max(0, teamTacticalMemory.away.holdTimer - dt);
  }
  if (gameMode !== 'training') updatePowerBot(dt, player2);
  if (player2.webSnareTimer > 0) return;

  if (gameMode !== 'match') {
    const awayTeam = typeof getActiveAwayPlayers === 'function' ? getActiveAwayPlayers() : [player2, awayMate];
    const homeTeam = typeof getActiveHomePlayers === 'function' ? getActiveHomePlayers() : [player1, homeMate];
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

  driveBotTo(player2, aiState.targetX, aiState.targetY, 1.06);

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
  if (gameMode === 'training' || gameMode === 'match') return;
  updatePowerBot(dt, awayMate);

  const awayTeam = typeof getActiveAwayPlayers === 'function' ? getActiveAwayPlayers() : [player2, awayMate];
  const homeTeam = typeof getActiveHomePlayers === 'function' ? getActiveHomePlayers() : [player1, homeMate];
  const predicted = predictBallPosition(9);
  const roles = assignTeamRoles('away', awayTeam, homeTeam, -1, predicted);
  executeBotRoleBehavior(awayMate, roles.get(awayMate) || AI_ROLES.COVER, awayTeam, homeTeam, -1, predicted);
}

function updateHomeMateAI(dt) {
  const p = CONFIG.pitch;
  if (teamTacticalMemory.home.holdTimer > 0) {
    teamTacticalMemory.home.holdTimer = Math.max(0, teamTacticalMemory.home.holdTimer - dt);
  }

  // Comportamento especial Toque e Passa (rework em js/skills/twoOne.js)
  if (typeof updateTwoOneTeammateBehavior === 'function' && updateTwoOneTeammateBehavior(dt)) {
    return;
  }

  if (gameMode !== 'training') return;

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
