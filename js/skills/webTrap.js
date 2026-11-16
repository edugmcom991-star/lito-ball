/**
 * ==========================================================================
 * LITO BALL - REWORK DEFENSIVO: WEB (ARMADILHA DE TEIA) (js/skills/webTrap.js)
 * ==========================================================================
 * Substitui "Sombra do Marcador" por uma armadilha tática de controle de área:
 *  - Conjura uma teia no gramado por 4.5s na posição/trajetória do usuário
 *  - Adversário que entrar na área é aprisionado por 1.75s:
 *      * Zera imediatamente a velocidade e trava a movimentação
 *      * Interrompe arrancadas e habilidades ativas (Speedster, Drible da Abelha,
 *        Toque e Passa, Bote da Serpente, Curva Impossível, Ego, Artilheiro, Águia)
 *  - Cooldown balanceado (15s) para uso tanto do jogador quanto de bots
 */
'use strict';

const WEB_TRAP_DURATION = 4.5;
const WEB_TRAP_RADIUS = 54;
const WEB_SNARE_DURATION = 1.28;

const webTraps = [];

function clearWebTraps() {
  webTraps.length = 0;
  const players = typeof getAllActivePlayers === 'function'
    ? getAllActivePlayers()
    : [
        typeof player1 !== 'undefined' ? player1 : null,
        typeof homeMate !== 'undefined' ? homeMate : null,
        typeof player2 !== 'undefined' ? player2 : null,
        typeof awayMate !== 'undefined' ? awayMate : null
      ];
  for (const p of players) {
    if (p) p.webSnareTimer = 0;
  }
}

function getWebOpponents(actor) {
  if (typeof getOpponentsOf === 'function') return getOpponentsOf(actor);
  const isHome = actor === player1 || actor?.isHuman || actor?.isTeammate;
  if (isHome) {
    return typeof gameMode !== 'undefined' && gameMode === '2v2' ? [player2, awayMate] : [player2];
  }
  return typeof gameMode !== 'undefined' && gameMode === '2v2' ? [player1, homeMate] : [player1];
}

function interruptActorSkillsForWeb(target) {
  if (!target) return false;
  let interrupted = false;

  if (target.dashTimer > 0) {
    target.dashTimer = 0;
    interrupted = true;
  }
  if (target.snakeLungeTimer > 0) {
    target.snakeLungeTimer = 0;
    interrupted = true;
  }
  if (target.twoOneRunTimer > 0) {
    target.twoOneRunTimer = 0;
    interrupted = true;
  }
  if (target.ghostCutTimer > 0) {
    target.ghostCutTimer = 0;
    interrupted = true;
  }
  if (target.phantomDribbleTimer > 0) {
    target.phantomDribbleTimer = 0;
    interrupted = true;
  }
  if (target.visionRunTimer > 0) {
    target.visionRunTimer = 0;
    interrupted = true;
  }

  if (target.nextKickPower > 1 || target.nextKickReach > 1) {
    target.nextKickPower = 1;
    target.nextKickReach = 1;
    interrupted = true;
  }

  if (target.powerEffect) {
    const cancelledId = target.powerEffect;
    if (cancelledId === 'curve' || cancelledId === 'eagle' || cancelledId === 'sniper' || cancelledId === 'vision') {
      const cd = typeof POWER_COOLDOWNS !== 'undefined' ? (POWER_COOLDOWNS[cancelledId] || 12) : 12;
      target.powerCooldown = Math.max(target.powerCooldown || 0, cd);
    }
    target.powerEffect = null;
    target.powerEffectTimer = 0;
    interrupted = true;
  }

  if (typeof snakeTackles !== 'undefined' && Array.isArray(snakeTackles)) {
    for (let i = snakeTackles.length - 1; i >= 0; i--) {
      if (snakeTackles[i]?.owner === target) {
        snakeTackles.splice(i, 1);
        interrupted = true;
      }
    }
  }

  if (typeof twoOnePlay !== 'undefined' && twoOnePlay && twoOnePlay.owner === target) {
    if (typeof clearTwoOneState === 'function') clearTwoOneState();
    interrupted = true;
  }

  if (typeof ball !== 'undefined' && ball && ball.dribbleLockOwner === target) {
    ball.dribbleLockTimer = 0;
    ball.dribbleLockOwner = null;
  }

  target.vx = 0;
  target.vy = 0;
  return interrupted;
}

function spawnWebTrap(actor) {
  if (!actor) return null;
  const p = CONFIG.pitch;
  const isHomeTeam = !!(actor.isHuman || actor.isTeammate);
  const len = Math.hypot(actor.facingX, actor.facingY) || 1;
  const fx = actor.facingX / len;
  const fy = actor.facingY / len;

  // Armadilha puramente defensiva: abre na posição do defensor (leve projeção à frente), sem puxão automático
  let trapX = actor.x + fx * 18;
  let trapY = actor.y + fy * 18;

  const margin = WEB_TRAP_RADIUS * 0.65;
  const halfBoundOffset = Math.max(12, margin * 0.55);
  const minTrapX = isHomeTeam ? p.left + margin : p.centerX + halfBoundOffset;
  const maxTrapX = isHomeTeam ? p.centerX - halfBoundOffset : p.right - margin;
  trapX = Math.max(minTrapX, Math.min(maxTrapX, trapX));
  trapY = Math.max(p.top + margin, Math.min(p.bottom - margin, trapY));

  // Mantém no máximo 1 armadilha ativa por usuário para clareza visual
  for (let i = webTraps.length - 1; i >= 0; i--) {
    if (webTraps[i].owner === actor && !webTraps[i].triggered) {
      webTraps.splice(i, 1);
    }
  }

  const trap = {
    owner: actor,
    isHomeTeam,
    x: trapX,
    y: trapY,
    radius: WEB_TRAP_RADIUS,
    timer: WEB_TRAP_DURATION,
    maxTimer: WEB_TRAP_DURATION,
    openElapsed: 0,
    triggered: false,
    snareTarget: null,
    snareTimer: 0,
    snareMaxTimer: WEB_SNARE_DURATION,
    rotation: Math.atan2(fy, fx)
  };
  webTraps.push(trap);

  for (let i = 0; i < 14; i++) {
    addImpactSpark(trapX, trapY, i % 2 === 0 ? '#e0f2fe' : '#a855f7', 1, 0.95);
  }
  if (typeof Sound !== 'undefined' && typeof Sound.playWebSnap === 'function') {
    Sound.playWebSnap();
  }
  return trap;
}

function updateWebTraps(dt) {
  for (let i = webTraps.length - 1; i >= 0; i--) {
    const trap = webTraps[i];
    trap.openElapsed += dt;

    if (!trap.triggered) {
      trap.timer -= dt;
      if (trap.timer <= 0) {
        webTraps.splice(i, 1);
        continue;
      }

      if (trap.openElapsed >= 0.06) {
        const opponents = getWebOpponents(trap.owner);
        for (const opp of opponents) {
          if (!opp) continue;
          const dist = Math.hypot(opp.x - trap.x, opp.y - trap.y);
          if (dist <= trap.radius + opp.radius * 0.42) {
            trap.triggered = true;
            trap.snareTarget = opp;
            trap.snareTimer = WEB_SNARE_DURATION;
            opp.webSnareTimer = WEB_SNARE_DURATION;
            const interrupted = interruptActorSkillsForWeb(opp);
            opp.x = trap.x * 0.25 + opp.x * 0.75;
            opp.y = trap.y * 0.25 + opp.y * 0.75;

            for (let k = 0; k < 20; k++) {
              addImpactSpark(opp.x, opp.y, k % 3 === 0 ? '#ffffff' : k % 2 === 0 ? '#38bdf8' : '#c084fc', 1, 1.15);
            }
            if (typeof Sound !== 'undefined' && typeof Sound.playWebSnap === 'function') {
              Sound.playWebSnap();
            }
            if (typeof showPowerFeedback === 'function') {
              const msg = interrupted
                ? 'WEB! Habilidade adversária interrompida!'
                : 'WEB! Adversário preso na teia!';
              showPowerFeedback(msg, !trap.isHomeTeam, false);
            }
            break;
          }
        }
      }
    } else {
      trap.snareTimer -= dt;
      if (trap.snareTarget) {
        trap.snareTarget.vx *= 0.2;
        trap.snareTarget.vy *= 0.2;
        trap.x = trap.snareTarget.x;
        trap.y = trap.snareTarget.y;
      }
      if (trap.snareTimer <= 0) {
        webTraps.splice(i, 1);
      }
    }
  }
}

function drawSpiderWebGeometry(renderCtx, cx, cy, radius, rotation, spokesCount, ringCount, alpha, isTriggered) {
  const coreColor = isTriggered ? '#f5d0fe' : '#e0f2fe';
  const ringColor = isTriggered ? '#c084fc' : '#818cf8';
  const glowColor = isTriggered ? '#d946ef' : '#38bdf8';

  renderCtx.save();
  renderCtx.translate(cx, cy);
  renderCtx.rotate(rotation);
  renderCtx.globalAlpha = alpha;
  renderCtx.lineCap = 'round';
  renderCtx.lineJoin = 'round';

  // Halo translúcido da área da armadilha
  const halo = renderCtx.createRadialGradient(0, 0, radius * 0.08, 0, 0, radius);
  halo.addColorStop(0, isTriggered ? 'rgba(192, 132, 252, 0.34)' : 'rgba(99, 102, 241, 0.24)');
  halo.addColorStop(0.65, 'rgba(56, 189, 248, 0.14)');
  halo.addColorStop(1, 'rgba(15, 23, 42, 0)');
  renderCtx.fillStyle = halo;
  renderCtx.beginPath();
  renderCtx.arc(0, 0, radius, 0, Math.PI * 2);
  renderCtx.fill();

  // Fios radiais principais com pequenos nós na borda
  renderCtx.shadowColor = glowColor;
  renderCtx.shadowBlur = isTriggered ? 14 : 9;
  renderCtx.strokeStyle = coreColor;
  renderCtx.lineWidth = isTriggered ? 2.1 : 1.65;
  for (let i = 0; i < spokesCount; i++) {
    const a = (i / spokesCount) * Math.PI * 2;
    const ex = Math.cos(a) * radius;
    const ey = Math.sin(a) * radius;
    renderCtx.beginPath();
    renderCtx.moveTo(0, 0);
    renderCtx.lineTo(ex, ey);
    renderCtx.stroke();

    renderCtx.fillStyle = coreColor;
    renderCtx.beginPath();
    renderCtx.arc(ex, ey, 2.1, 0, Math.PI * 2);
    renderCtx.fill();
  }

  // Anéis concêntricos com leve curvatura (tensão de seda)
  renderCtx.strokeStyle = ringColor;
  renderCtx.lineWidth = isTriggered ? 1.8 : 1.35;
  for (let rIdx = 1; rIdx <= ringCount; rIdx++) {
    const ringR = (rIdx / ringCount) * radius * 0.94;
    const sag = ringR * 0.12;
    renderCtx.beginPath();
    for (let i = 0; i < spokesCount; i++) {
      const a0 = (i / spokesCount) * Math.PI * 2;
      const a1 = ((i + 1) / spokesCount) * Math.PI * 2;
      const aMid = (a0 + a1) * 0.5;
      const x0 = Math.cos(a0) * ringR;
      const y0 = Math.sin(a0) * ringR;
      const x1 = Math.cos(a1) * ringR;
      const y1 = Math.sin(a1) * ringR;
      const cxMid = Math.cos(aMid) * (ringR - sag);
      const cyMid = Math.sin(aMid) * (ringR - sag);
      if (i === 0) renderCtx.moveTo(x0, y0);
      renderCtx.quadraticCurveTo(cxMid, cyMid, x1, y1);
    }
    renderCtx.closePath();
    renderCtx.stroke();
  }

  // Nó central brilhante
  renderCtx.fillStyle = '#ffffff';
  renderCtx.beginPath();
  renderCtx.arc(0, 0, isTriggered ? 4.2 : 3.2, 0, Math.PI * 2);
  renderCtx.fill();

  renderCtx.restore();
}

function drawWebTraps(renderCtx) {
  if (!webTraps.length) return;
  const now = performance.now();

  for (const trap of webTraps) {
    if (!trap.triggered) {
      const openRatio = Math.min(1, trap.openElapsed / 0.22);
      const easeOut = 1 - Math.pow(1 - openRatio, 3);
      const fadeRatio = trap.timer < 0.7 ? Math.max(0.15, trap.timer / 0.7) : 1;
      const pulse = 1 + Math.sin(now * 0.008) * 0.035;
      const currentRadius = trap.radius * easeOut * pulse;

      renderCtx.save();
      // Anel de alcance tático no chão
      renderCtx.globalAlpha = 0.34 * fadeRatio;
      renderCtx.strokeStyle = trap.isHomeTeam ? '#38bdf8' : '#f472b6';
      renderCtx.lineWidth = 1.6;
      renderCtx.setLineDash([7, 6]);
      renderCtx.beginPath();
      renderCtx.arc(trap.x, trap.y, currentRadius, 0, Math.PI * 2);
      renderCtx.stroke();
      renderCtx.restore();

      drawSpiderWebGeometry(
        renderCtx,
        trap.x,
        trap.y,
        currentRadius,
        trap.rotation + openRatio * 0.35,
        10,
        4,
        0.88 * fadeRatio,
        false
      );
    } else {
      const snareRatio = Math.max(0, trap.snareTimer / trap.snareMaxTimer);
      const targetR = trap.snareTarget ? trap.snareTarget.radius : 22;
      drawSpiderWebGeometry(
        renderCtx,
        trap.x,
        trap.y,
        targetR * 1.95,
        trap.rotation + now * 0.001,
        8,
        3,
        Math.min(1, snareRatio * 1.25) * 0.92,
        true
      );
    }
  }
}

function drawPlayerWebSnareOverlay(renderCtx, actor) {
  if (!actor || !(actor.webSnareTimer > 0)) return;
  const ratio = Math.min(1, actor.webSnareTimer / WEB_SNARE_DURATION);
  const r = actor.radius + 5;

  renderCtx.save();
  renderCtx.translate(actor.x, actor.y);
  renderCtx.globalAlpha = Math.min(1, ratio * 1.3);
  renderCtx.strokeStyle = '#f5d0fe';
  renderCtx.shadowColor = '#c084fc';
  renderCtx.shadowBlur = 10;
  renderCtx.lineWidth = 2;

  // Fios cruzados aprisionando o botão
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI + 0.35;
    renderCtx.beginPath();
    renderCtx.moveTo(-Math.cos(a) * r, -Math.sin(a) * r);
    renderCtx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    renderCtx.stroke();
  }

  renderCtx.beginPath();
  renderCtx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  renderCtx.strokeStyle = '#38bdf8';
  renderCtx.lineWidth = 1.6;
  renderCtx.setLineDash([4, 4]);
  renderCtx.stroke();
  renderCtx.restore();
}
