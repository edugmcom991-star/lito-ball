/**
 * ==========================================================================
 * LITO BALL - SISTEMA DE HABILIDADES E PODERES (js/skills/powers.js)
 * ==========================================================================
 */
'use strict';

let twoOneSelection = null;
let twoOnePlay = null;
let twoOneImpactTimer = 0;
let visionPassRoute = null;
let powerReadyLast = true;
const pistolAnimations = [];
const pistolSpriteFrames = [];
const PISTOL_FRAME_WIDTH = 320;
const PISTOL_FRAME_HEIGHT = 240;
const PISTOL_PIVOT_X = 100;
const PISTOL_PIVOT_Y = 112;
// Preparação, alinhamento, clarão, recuo e fumaça final.
const PISTOL_FRAME_DURATIONS = [0.03, 0.02, 0.07, 0.13, 0.22];
// Recortes medidos na imagem original; os pivôs mantêm o tambor alinhado entre quadros.
const PISTOL_FRAME_SPECS = [
  { x: 32, y: 237, width: 175, height: 118, pivotX: 108, pivotY: 266 },
  { x: 228, y: 237, width: 180, height: 118, pivotX: 307, pivotY: 267 },
  { x: 420, y: 178, width: 225, height: 177, pivotX: 474, pivotY: 261 },
  { x: 650, y: 145, width: 149, height: 210, pivotX: 700, pivotY: 258 },
  { x: 818, y: 145, width: 188, height: 210, pivotX: 921, pivotY: 265 }
];
const PISTOL_FRAME_NUMBER_RECTS = [
  { left: 18, top: 197, right: 40, bottom: 222 },
  { left: 215, top: 197, right: 238, bottom: 222 },
  { left: 416, top: 197, right: 440, bottom: 222 },
  { left: 615, top: 197, right: 639, bottom: 222 },
  { left: 814, top: 197, right: 840, bottom: 222 }
];

assets.loadSprite('pistolSheet', 'img/pistola.png').then(preparePistolFrames).catch(() => {});

function preparePistolFrames(sheet) {
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = sheet.naturalWidth;
  sourceCanvas.height = sheet.naturalHeight;
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  sourceCtx.drawImage(sheet, 0, 0);
  const source = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const background = { r: 62, g: 65, b: 73 };

  for (let frameIndex = 0; frameIndex < PISTOL_FRAME_SPECS.length; frameIndex++) {
    const spec = PISTOL_FRAME_SPECS[frameIndex];
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = PISTOL_FRAME_WIDTH;
    frameCanvas.height = PISTOL_FRAME_HEIGHT;
    const frameCtx = frameCanvas.getContext('2d');
    const frame = frameCtx.createImageData(PISTOL_FRAME_WIDTH, PISTOL_FRAME_HEIGHT);
    const offsetX = PISTOL_PIVOT_X - (spec.pivotX - spec.x);
    const offsetY = PISTOL_PIVOT_Y - (spec.pivotY - spec.y);

    for (let sourceY = spec.y; sourceY < spec.y + spec.height; sourceY++) {
      for (let sourceX = spec.x; sourceX < spec.x + spec.width; sourceX++) {
        const x = offsetX + sourceX - spec.x;
        const y = offsetY + sourceY - spec.y;
        if (x < 0 || x >= PISTOL_FRAME_WIDTH || y < 0 || y >= PISTOL_FRAME_HEIGHT) continue;

        const sourceIndex = (sourceY * source.width + sourceX) * 4;
        const frameIndexOffset = (y * PISTOL_FRAME_WIDTH + x) * 4;
        const r = source.data[sourceIndex];
        const g = source.data[sourceIndex + 1];
        const b = source.data[sourceIndex + 2];
        const deltaR = r - background.r;
        const deltaG = g - background.g;
        const deltaB = b - background.b;
        const backgroundDistance = Math.hypot(deltaR, deltaG, deltaB);
        const numberRect = PISTOL_FRAME_NUMBER_RECTS[frameIndex];
        const isNumberLabel = sourceX >= numberRect.left && sourceX <= numberRect.right && sourceY >= numberRect.top && sourceY <= numberRect.bottom;
        const isPanelRule = ((sourceY >= 196 && sourceY <= 198) ||
          (sourceX >= 206 && sourceX <= 208) ||
          (sourceX >= 606 && sourceX <= 610) ||
          (sourceX >= 796 && sourceX <= 802) ||
          (sourceX >= 1004 && sourceX <= 1008)) && Math.hypot(r - 35, g - 39, b - 44) < 15;

        let alpha = source.data[sourceIndex + 3];
        if (isNumberLabel || isPanelRule || backgroundDistance <= 14) {
          alpha = 0;
        } else if (backgroundDistance < 27) {
          alpha = Math.round(alpha * (backgroundDistance - 14) / 13);
        }

        frame.data[frameIndexOffset] = r;
        frame.data[frameIndexOffset + 1] = g;
        frame.data[frameIndexOffset + 2] = b;
        frame.data[frameIndexOffset + 3] = alpha;
      }
    }
    frameCtx.putImageData(frame, 0, 0);
    pistolSpriteFrames.push(frameCanvas);
  }
}

function playPistolAnimation(actor, dirX, dirY) {
  const angle = Math.atan2(dirY, dirX);
  const side = -actor.radius * 1.9;
  const forward = actor.radius * 0.42;
  const perpendicularX = -Math.sin(angle);
  const perpendicularY = Math.cos(angle);
  pistolAnimations.push({
    x: actor.x + Math.cos(angle) * forward + perpendicularX * side,
    y: actor.y + Math.sin(angle) * forward + perpendicularY * side,
    angle,
    elapsed: 0,
    frame: 0
  });
  ball.pistolTrailTimer = 0.62;
  ball.pistolShotTrail.length = 0;
}

function updatePistolAnimations(dt) {
  if (!pistolSpriteFrames.length) return;
  for (let i = pistolAnimations.length - 1; i >= 0; i--) {
    const animation = pistolAnimations[i];
    animation.elapsed += dt;
    while (animation.frame < PISTOL_FRAME_DURATIONS.length && animation.elapsed >= PISTOL_FRAME_DURATIONS[animation.frame]) {
      animation.elapsed -= PISTOL_FRAME_DURATIONS[animation.frame];
      animation.frame++;
    }
    if (animation.frame >= PISTOL_FRAME_DURATIONS.length) pistolAnimations.splice(i, 1);
  }
}

function clearPistolAnimations() {
  pistolAnimations.length = 0;
}

function drawPistolAnimations(renderCtx) {
  if (!pistolSpriteFrames.length) return;
  renderCtx.save();
  renderCtx.imageSmoothingEnabled = false;
  for (const animation of pistolAnimations) {
    const frame = pistolSpriteFrames[animation.frame];
    if (!frame) continue;
    renderCtx.save();
    renderCtx.translate(animation.x, animation.y);
    renderCtx.rotate(animation.angle);
    if (animation.frame === pistolSpriteFrames.length - 1) {
      const duration = PISTOL_FRAME_DURATIONS[animation.frame];
      renderCtx.globalAlpha = Math.max(0, 1 - animation.elapsed / duration);
    }
    const scale = 0.46;
    renderCtx.drawImage(
      frame,
      -PISTOL_PIVOT_X * scale,
      -PISTOL_PIVOT_Y * scale,
      PISTOL_FRAME_WIDTH * scale,
      PISTOL_FRAME_HEIGHT * scale
    );
    renderCtx.restore();
  }
  renderCtx.restore();
}
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
  const inRange = Math.hypot(defender.x - ball.x, defender.y - ball.y) <= defender.radius + ball.radius + 8;
  if (inRange && !holder.ghostDodgeUsed) {
    holder.ghostDodgeUsed = true;
    holder.ghostDodgeSuccess = Math.random() < phantomStats(holder).dodgeChance;
    if (holder.ghostDodgeSuccess && holder.isHuman) {
      showPowerFeedback('O bote passou pela sombra', true);
    }
  }
  return holder.ghostDodgeSuccess;
}

function shouldBallContact(collidingPlayer, ghostHolders) {
  return !ghostHolders.some(holder => phantomEvadesBote(holder, collidingPlayer));
}

function updatePhantomBallCarry(actor) {
  if (actor.powerEffect !== 'phantom' || actor.phantomDribbleTimer <= 0 || (ball.dribbleLockTimer > 0 && ball.dribbleLockOwner === actor) || input.kickRequested) return;
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

function getTwoOneEligibleTargets(actor) {
  if (gameMode === 'match') return [];
  const target = homeMate;
  const distance = Math.hypot(target.x - actor.x, target.y - actor.y);
  const pitch = CONFIG.pitch;
  const opponents = [player2, ...(gameMode === '2v2' ? [awayMate] : [])];
  if (distance > 230 || opponents.some(opponent => Math.hypot(target.x - opponent.x, target.y - opponent.y) < opponent.radius + target.radius + 24)) return [];
  if (target.x - target.radius < pitch.left + 8 || target.x + target.radius > pitch.right - 8 || target.y - target.radius < pitch.top + 8 || target.y + target.radius > pitch.bottom - 8) return [];
  if (isPassPathBlocked(ball, target, actor)) return [];
  return [target];
}

function projectTwoOneReceiver(ballSpeed) {
  let dirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dirY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const hasMoveInput = !!(dirX || dirY);
  if (hasMoveInput) {
    const length = Math.hypot(dirX, dirY);
    dirX /= length;
    dirY /= length;
  } else if (twoOnePlay) {
    dirX = twoOnePlay.runDirection.x;
    dirY = twoOnePlay.runDirection.y;
  } else {
    const speed = Math.hypot(player1.vx, player1.vy);
    if (speed > 0.55) {
      dirX = player1.vx / speed;
      dirY = player1.vy / speed;
    } else {
      dirX = player1.facingX;
      dirY = player1.facingY;
    }
  }
  const velocityAlongRun = player1.vx * dirX + player1.vy * dirY;
  const projectedSpeed = hasMoveInput && !twoOnePlay ? Math.max(CONFIG.physics.playerMaxSpeed, velocityAlongRun) : Math.max(0, velocityAlongRun);
  const gap = Math.hypot(player1.x - ball.x, player1.y - ball.y);
  const frames = Math.max(4, Math.min(120, gap / Math.max(1.8, ballSpeed - projectedSpeed)));
  const p = CONFIG.pitch;
  const lead = projectedSpeed * frames + (twoOnePlay ? 22 : 10);
  return {
    x: Math.max(p.left + player1.radius, Math.min(p.right - player1.radius, player1.x + dirX * lead)),
    y: Math.max(p.top + player1.radius, Math.min(p.bottom - player1.radius, player1.y + dirY * lead))
  };
}

function chooseTwoOneRunDirection(actor) {
  const base = Math.atan2(actor.facingY, actor.facingX);
  const directions = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3].map(offset => ({
    x: Math.cos(base + offset),
    y: Math.sin(base + offset),
    turn: Math.abs(offset)
  }));
  const pitch = CONFIG.pitch;
  const clear = d => {
    const tx = actor.x + d.x * 100;
    const ty = actor.y + d.y * 100;
    if (tx < pitch.left + actor.radius || tx > pitch.right - actor.radius || ty < pitch.top + actor.radius || ty > pitch.bottom - actor.radius) return false;
    if ([player2, ...(gameMode === '2v2' ? [awayMate] : [])].some(opponent => pointSegmentDistance(opponent.x, opponent.y, actor.x, actor.y, tx, ty) < actor.radius + opponent.radius + 8)) return false;
    if (pointSegmentDistance(homeMate.x, homeMate.y, actor.x, actor.y, tx, ty) < actor.radius + homeMate.radius + 6) return false;
    return posts.every(post => pointSegmentDistance(post.x, post.y, actor.x, actor.y, tx, ty) > actor.radius + post.radius + 5);
  };
  const valid = directions.filter(clear);
  if (!valid.length) return { x: actor.facingX, y: actor.facingY };
  return valid.sort((a, b) => {
    const score = d =>
      Math.hypot(actor.x + d.x * 100 - player2.x, actor.y + d.y * 100 - player2.y) * 0.18 +
      Math.hypot(actor.x + d.x * 100 - homeMate.x, actor.y + d.y * 100 - homeMate.y) * 0.08 -
      d.turn * 100;
    return score(b) - score(a);
  })[0];
}

function confirmTwoOneSelection() {
  if (!twoOneSelection) return false;
  const target = twoOneSelection.target;
  const eligible = getTwoOneEligibleTargets(player1);
  if (!isBallControlledBy(player1) || !eligible.includes(target)) {
    twoOneSelection = null;
    showPowerFeedback('O alvo ficou indisponível; Toque e Passa cancelado', true);
    return false;
  }
  if (isPassPathBlocked(ball, target, player1)) {
    twoOneSelection = null;
    showPowerFeedback('Linha bloqueada; Toque e Passa cancelado', true);
    return false;
  }
  if (!player1.tryKick(ball, 0, 0, true, target)) {
    twoOneSelection = null;
    showPowerFeedback('Aguarde para dominar a bola antes da tabela', true);
    return false;
  }
  ball.vx *= 0.50;
  ball.vy *= 0.50;
  player1.powerCooldown = POWER_COOLDOWNS.twoOne;
  player1.powerEffect = 'twoOne';
  player1.powerEffectTimer = 0;
  const run = chooseTwoOneRunDirection(player1);
  twoOnePlay = { phase: 'outbound', target, timer: 2.5, runDirection: { x: run.x, y: run.y }, runTimer: 0.58, trail: [] };
  input.up = false;
  input.down = false;
  input.left = false;
  input.right = false;
  input.kickRequested = false;
  input.passRequested = false;
  player1.vx = 0;
  player1.vy = 0;
  twoOneSelection = null;
  showPowerFeedback('Toque e Passa! Arranque para receber', false);
  return true;
}

function finishTwoOne(success, message) {
  if (!twoOnePlay) return;
  if (success && gameMode === '2v2' && twoVtwoStats) twoVtwoStats.completed.twoOne = true;
  twoOnePlay = null;
  player1.powerEffect = null;
  player1.powerEffectTimer = 0;
  twoOneImpactTimer = success ? 0.32 : 0;
  if (message) showPowerFeedback(message, !success);
}

function updateTwoOneState(dt) {
  if (twoOneSelection) {
    twoOneSelection.timer -= dt;
    if (twoOneSelection.timer <= 0) {
      twoOneSelection = null;
      showPowerFeedback('Seleção de alvo cancelada', true);
    }
  }
  if (twoOneImpactTimer > 0) twoOneImpactTimer = Math.max(0, twoOneImpactTimer - dt);
  if (!twoOnePlay) return;
  const play = twoOnePlay;
  play.timer -= dt;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > 1) {
    play.trail.push({ x: ball.x, y: ball.y });
    if (play.trail.length > 11) play.trail.shift();
  } else if (play.trail.length) {
    play.trail.shift();
  }

  if (play.phase === 'return') {
    if (isBallReceivedBy(player1)) {
      finishTwoOne(true, 'Tabela concluída!');
      return;
    }
    const distanceToReceiver = Math.hypot(ball.x - player1.x, ball.y - player1.y);
    const receiveRadius = player1.radius + ball.radius + 24;
    if (distanceToReceiver <= receiveRadius) {
      play.returnApproachStarted = true;
      play.returnNearTimer = (play.returnNearTimer || 0) + dt;
      if (play.returnNearTimer > 0.18) {
        finishTwoOne(false, 'A devolução não chegou controlada; siga a jogada');
        return;
      }
    } else if (play.returnApproachStarted) {
      finishTwoOne(false, 'A devolução passou; siga a jogada');
      return;
    }
  }

  if (play.phase === 'receiveWait') {
    if (isBallReceivedBy(play.target)) {
      play.receiveLostTimer = 0;
      play.waitTimer = Math.max(0, play.waitTimer - dt);
    } else {
      play.receiveLostTimer = (play.receiveLostTimer || 0) + dt;
      const distance = Math.hypot(ball.x - play.target.x, ball.y - play.target.y);
      if (distance > play.target.radius + ball.radius + 24 || play.receiveLostTimer > 0.18) {
        finishTwoOne(false, 'O companheiro perdeu a bola; jogada encerrada');
        return;
      }
    }
  }

  if (gameMode !== 'training' && (isBallControlledBy(player2) || (gameMode === '2v2' && isBallControlledBy(awayMate)))) {
    finishTwoOne(false, 'Passe interceptado; jogada encerrada');
    return;
  }
  if (play.timer <= 0 || (ball.curveTimer > 0 && play.phase === 'return')) {
    finishTwoOne(false, 'A tabela não encaixou; siga a jogada');
  }
}

function updateTwoOneReturnAssist(dt) {
  if (!twoOnePlay || twoOnePlay.phase !== 'return' || twoOnePlay.returnAssistTimer <= 0) return;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed < 2) return;
  twoOnePlay.returnAssistTimer = Math.max(0, twoOnePlay.returnAssistTimer - dt);
  const target = projectTwoOneReceiver(speed);
  if (isPassPathBlocked(ball, target, homeMate)) {
    finishTwoOne(false, 'Passe de retorno bloqueado; a bola segue');
    return;
  }
  if (twoOnePlay.returnTurnBudget <= 0) return;
  const dx = target.x - ball.x;
  const dy = target.y - ball.y;
  const angle = Math.atan2(ball.vx * dy - ball.vy * dx, ball.vx * dx + ball.vy * dy);
  const turn = Math.sign(angle) * Math.min(Math.abs(angle), 0.035, twoOnePlay.returnTurnBudget);
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const vx = ball.vx;
  const vy = ball.vy;
  ball.vx = vx * cos - vy * sin;
  ball.vy = vx * sin + vy * cos;
  twoOnePlay.returnTurnBudget -= Math.abs(turn);
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
    twoOneSelection ||
    twoOnePlay ||
    snakeTackles.some(tackle => tackle.owner === actor)
  ) return false;

  if (id === 'snakeTackle') {
    return startSnakeTackle(actor);
  }

  const nearBall = Math.hypot(ball.x - actor.x, ball.y - actor.y) <= actor.radius + ball.radius + CONFIG.physics.kickReachMargin + 15;
  const nearBallControl = Math.hypot(ball.x - actor.x, ball.y - actor.y) <= actor.radius + ball.radius + 62;

  if (id === 'twoOne') {
    if (actor !== player1 || !isBallControlledBy(actor)) {
      if (actor.isHuman) showPowerFeedback('Domine a bola para iniciar Toque e Passa', true);
      return false;
    }
    const targets = getTwoOneEligibleTargets(actor);
    if (!targets.length) {
      showPowerFeedback('Nenhum companheiro próximo e livre para Toque e Passa', true);
      return false;
    }
    twoOneSelection = { target: targets[0], timer: 3 };
    showPowerFeedback('Alvo: companheiro · pressione F ou clique nele', true);
    return true;
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
    if (actor.isHuman) showPowerFeedback('Domine a bola para usar o Drible Fantasma', true);
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
    const stats = phantomStats(actor);
    const cut = choosePhantomCut(actor);
    actor.powerEffect = 'phantom';
    actor.powerEffectTimer = stats.duration;
    actor.phantomDribbleTimer = stats.duration;
    actor.phantomDirectionX = cut.x;
    actor.phantomDirectionY = cut.y;
    actor.ghostCutTimer = 0.22;
    actor.ghostDodgeUsed = false;
    actor.ghostDodgeSuccess = false;
    actor.ghostTrailTimer = 0;
    actor.vx += cut.x * stats.cutForce;
    actor.vy += cut.y * stats.cutForce;
    ball.vx += cut.x * stats.cutForce * 0.72;
    ball.vy += cut.y * stats.cutForce * 0.72;
  } else if (id === 'sprint') {
    let dx = actor.facingX;
    let dy = actor.facingY;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    actor.vx = dx * 8.8;
    actor.vy = dy * 8.8;
    actor.dashTimer = 0.72;
  } else if (id === 'ego') {
    actor.powerEffect = 'ego';
    actor.powerEffectTimer = 5;
    addImpactSpark(actor.x, actor.y, '#f59e0b', 16, 1.25);
  } else if (id === 'vision') {
    actor.powerEffect = 'vision';
    actor.powerEffectTimer = 20;
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
    const customFeed =
      id === 'curve' ? '🌀 Curva Impossível! Mire e aperte Chute (ou Clique)' :
      id === 'control' ? '🧲 Domínio Perfeito! Bola dominada no pé' :
      id === 'eagle' ? '🦅 Salto de Águia armado (6s)' :
      id === 'sniper' ? '🎯 Instinto de Artilheiro armado (6s)' :
      id === 'shadow' ? '👥 Sombra do Marcador ativa (4s)' :
      id === 'ego' ? '🔥 Despertar do Ego ativo (5s)' :
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

function drawTwoOneVisuals(renderCtx) {
  if (!twoOneSelection && !twoOnePlay && twoOneImpactTimer <= 0) return;
  renderCtx.save();
  renderCtx.lineCap = 'round';
  renderCtx.lineJoin = 'round';

  if (twoOneSelection) {
    const target = twoOneSelection.target;
    const alpha = 0.55 + Math.sin(performance.now() / 90) * 0.18;
    renderCtx.globalAlpha = alpha;
    renderCtx.strokeStyle = '#67e8f9';
    renderCtx.fillStyle = '#a5f3fc';
    renderCtx.lineWidth = 3;
    renderCtx.setLineDash([9, 7]);
    renderCtx.beginPath();
    renderCtx.moveTo(player1.x, player1.y);
    renderCtx.lineTo(target.x, target.y);
    renderCtx.stroke();
    renderCtx.setLineDash([]);
    renderCtx.beginPath();
    renderCtx.arc(target.x, target.y, target.radius + 13, 0, Math.PI * 2);
    renderCtx.stroke();
    const angle = Math.atan2(target.y - player1.y, target.x - player1.x);
    renderCtx.beginPath();
    renderCtx.moveTo(target.x, target.y);
    renderCtx.lineTo(target.x - Math.cos(angle - 0.48) * 14, target.y - Math.sin(angle - 0.48) * 14);
    renderCtx.lineTo(target.x - Math.cos(angle + 0.48) * 14, target.y - Math.sin(angle + 0.48) * 14);
    renderCtx.closePath();
    renderCtx.fill();
  }

  if (twoOnePlay) {
    const points = twoOnePlay.trail;
    for (let i = 1; i < points.length; i++) {
      const t = i / points.length;
      renderCtx.beginPath();
      renderCtx.moveTo(points[i - 1].x, points[i - 1].y);
      renderCtx.lineTo(points[i].x, points[i].y);
      renderCtx.strokeStyle = `rgba(103, 232, 249, ${t * 0.32})`;
      renderCtx.lineWidth = 1 + t * 2;
      renderCtx.stroke();
    }
    if (twoOnePlay.runTimer > 0) {
      renderCtx.strokeStyle = 'rgba(103, 232, 249, 0.45)';
      renderCtx.lineWidth = 2;
      renderCtx.setLineDash([4, 5]);
      renderCtx.beginPath();
      renderCtx.arc(player1.x, player1.y, player1.radius + 7, 0, Math.PI * 2);
      renderCtx.stroke();
      renderCtx.setLineDash([]);
    }
  }

  if (twoOneImpactTimer > 0) {
    const progress = 1 - twoOneImpactTimer / 0.32;
    renderCtx.globalAlpha = 1 - progress;
    renderCtx.strokeStyle = '#a5f3fc';
    renderCtx.shadowColor = '#22d3ee';
    renderCtx.shadowBlur = 14;
    renderCtx.lineWidth = 3;
    renderCtx.beginPath();
    renderCtx.arc(ball.x, ball.y, ball.radius + 4 + progress * 14, 0, Math.PI * 2);
    renderCtx.stroke();
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
