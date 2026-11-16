/**
 * ==========================================================================
 * LITO BALL - FÍSICA, COLISÕES E GEOMETRIA DO CAMPO (js/physics.js)
 * ==========================================================================
 */
'use strict';

function resolveCircleCollision(c1, c2, restitution) {
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const dist = Math.hypot(dx, dy);
  const minDist = c1.radius + c2.radius;

  if (dist < minDist && dist > 0.0001) {
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;

    const invMass1 = 1 / c1.mass;
    const invMass2 = 1 / c2.mass;
    const totalInvMass = invMass1 + invMass2;

    c1.x -= nx * overlap * (invMass1 / totalInvMass);
    c1.y -= ny * overlap * (invMass1 / totalInvMass);
    c2.x += nx * overlap * (invMass2 / totalInvMass);
    c2.y += ny * overlap * (invMass2 / totalInvMass);

    const rvx = c2.vx - c1.vx;
    const rvy = c2.vy - c1.vy;
    const velAlongNormal = rvx * nx + rvy * ny;

    if (velAlongNormal < 0) {
      const impulse = -(1 + restitution) * velAlongNormal / totalInvMass;
      c1.vx -= nx * impulse * invMass1;
      c1.vy -= ny * impulse * invMass1;
      c2.vx += nx * impulse * invMass2;
      c2.vy += ny * impulse * invMass2;
    }
  }
}

function resolveCirclePostCollision(circle, post, restitution = CONFIG.physics.restitutionWall) {
  const dx = circle.x - post.x;
  const dy = circle.y - post.y;
  const dist = Math.hypot(dx, dy);
  const minDist = circle.radius + post.radius;

  if (dist < minDist && dist > 0.0001) {
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;

    circle.x += nx * overlap;
    circle.y += ny * overlap;

    const dot = circle.vx * nx + circle.vy * ny;
    if (dot < 0) {
      circle.vx -= (1 + restitution) * dot * nx;
      circle.vy -= (1 + restitution) * dot * ny;
      if (circle.mass <= 1.5) {
        addImpactSpark(post.x + nx * post.radius, post.y + ny * post.radius);
        if (circle.curveTimer > 0) {
          circle.curveTimer = 0;
          if (typeof triggerCurveImpact === 'function') triggerCurveImpact(circle.x, circle.y);
        }
        Sound.playPost();
      }
    }
  }
}

function resolveCircleSegment(circle, x1, y1, x2, y2, restitution) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return;

  const t = Math.max(0, Math.min(1, ((circle.x - x1) * dx + (circle.y - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  const diffX = circle.x - projX;
  const diffY = circle.y - projY;
  const dist = Math.hypot(diffX, diffY);

  if (dist < circle.radius && dist > 0.00001) {
    const nx = diffX / dist;
    const ny = diffY / dist;
    const overlap = circle.radius - dist;

    circle.x += nx * overlap;
    circle.y += ny * overlap;

    const dot = circle.vx * nx + circle.vy * ny;
    if (dot < 0) {
      circle.vx -= (1 + restitution) * dot * nx;
      circle.vy -= (1 + restitution) * dot * ny;
    }
  }
}

const wallSegments = [];
const netSegmentsForPlayers = [];

function rebuildPitchCollisionGeometry() {
  const p = CONFIG.pitch;
  const g = CONFIG.goals;
  const r = CONFIG.physics.restitutionWall;

  wallSegments.splice(
    0,
    wallSegments.length,
    { x1: p.left, y1: p.top, x2: p.right, y2: p.top, rest: r },
    { x1: p.left, y1: p.bottom, x2: p.right, y2: p.bottom, rest: r },
    { x1: p.left, y1: p.top, x2: p.left, y2: g.topY, rest: r },
    { x1: p.left, y1: g.bottomY, x2: p.left, y2: p.bottom, rest: r },
    { x1: p.right, y1: p.top, x2: p.right, y2: g.topY, rest: r },
    { x1: p.right, y1: g.bottomY, x2: p.right, y2: p.bottom, rest: r },
    { x1: p.left - g.depth, y1: g.topY, x2: p.left, y2: g.topY, rest: 0.35 },
    { x1: p.left - g.depth, y1: g.topY, x2: p.left - g.depth, y2: g.bottomY, rest: 0.35 },
    { x1: p.left - g.depth, y1: g.bottomY, x2: p.left, y2: g.bottomY, rest: 0.35 },
    { x1: p.right, y1: g.topY, x2: p.right + g.depth, y2: g.topY, rest: 0.35 },
    { x1: p.right + g.depth, y1: g.topY, x2: p.right + g.depth, y2: g.bottomY, rest: 0.35 },
    { x1: p.right, y1: g.bottomY, x2: p.right + g.depth, y2: g.bottomY, rest: 0.35 }
  );

  netSegmentsForPlayers.splice(
    0,
    netSegmentsForPlayers.length,
    { x1: p.left - g.depth, y1: g.topY, x2: p.left, y2: g.topY },
    { x1: p.left - g.depth, y1: g.topY, x2: p.left - g.depth, y2: g.bottomY },
    { x1: p.left - g.depth, y1: g.bottomY, x2: p.left, y2: g.bottomY },
    { x1: p.right, y1: g.topY, x2: p.right + g.depth, y2: g.topY },
    { x1: p.right + g.depth, y1: g.topY, x2: p.right + g.depth, y2: g.bottomY },
    { x1: p.right, y1: g.bottomY, x2: p.right + g.depth, y2: g.bottomY }
  );
}

function resolveBallBoundaries(b) {
  for (let i = 0; i < wallSegments.length; i++) {
    const seg = wallSegments[i];
    resolveCircleSegment(b, seg.x1, seg.y1, seg.x2, seg.y2, seg.rest);
  }
}

function pointSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function isPassPathBlocked(from, to, attacker) {
  const opponents = typeof getOpponentsOf === 'function'
    ? getOpponentsOf(attacker)
    : (attacker === player1 || attacker === homeMate || attacker?.isHuman || attacker?.isTeammate)
      ? [player2, ...(gameMode === '2v2' ? [awayMate] : [])]
      : [player1, ...(gameMode === '2v2' ? [homeMate] : [])];
  if (opponents.some(opponent => pointSegmentDistance(opponent.x, opponent.y, from.x, from.y, to.x, to.y) < opponent.radius + ball.radius + 8)) {
    return true;
  }
  return posts.some(post => pointSegmentDistance(post.x, post.y, from.x, from.y, to.x, to.y) < post.radius + ball.radius + 4);
}

function isVisionPassLaneBlocked(targetMate = homeMate) {
  const blockers = typeof getActiveAwayPlayers === 'function'
    ? getActiveAwayPlayers()
    : [player2, ...(gameMode === '2v2' ? [awayMate] : [])];
  if (!targetMate) return false;
  if (gameMode !== 'training' && blockers.some(opponent => pointSegmentDistance(opponent.x, opponent.y, ball.x, ball.y, targetMate.x, targetMate.y) < opponent.radius + ball.radius + 12)) {
    return true;
  }
  return posts.some(post => pointSegmentDistance(post.x, post.y, ball.x, ball.y, targetMate.x, targetMate.y) < post.radius + ball.radius + 5);
}

function isBallControlledBy(actor) {
  if (actor.tackleStaggerTimer > 0) return false;
  const closeEnough = Math.hypot(ball.x - actor.x, ball.y - actor.y) <= actor.radius + ball.radius + 9;
  const relativeSpeed = Math.hypot(ball.vx - actor.vx, ball.vy - actor.vy);
  return closeEnough && relativeSpeed <= 7.5;
}

function isBallReceivedBy(actor) {
  const distance = Math.hypot(ball.x - actor.x, ball.y - actor.y);
  const relativeSpeed = Math.hypot(ball.vx - actor.vx, ball.vy - actor.vy);
  return distance <= actor.radius + ball.radius + 9 && relativeSpeed <= 8.5;
}

function findControlledActor(actors) {
  return actors.find(isBallControlledBy) || null;
}

function closestActorTo(target, actors) {
  return actors.reduce((closest, actor) =>
    Math.hypot(actor.x - target.x, actor.y - target.y) < Math.hypot(closest.x - target.x, closest.y - target.y)
      ? actor
      : closest,
    actors[0]
  );
}
