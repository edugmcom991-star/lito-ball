/**
 * ==========================================================================
 * LITO BALL - ENTIDADES E EFEITOS VISUAIS (js/entities.js)
 * ==========================================================================
 */
'use strict';

class Player {
  constructor(x, y, radius, color, number, isHuman = false) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
    this.color = color;
    this.number = number;
    this.isHuman = isHuman;
    this.mass = 2.5;
    this.powerCooldown = 0;
    this.powerEffectTimer = 0;
    this.powerEffect = null;
    this.nextKickPower = 1;
    this.nextKickReach = 1;
    this.facingX = isHuman ? 1 : -1;
    this.facingY = 0;
    this.dashTimer = 0;
    this.snakeLungeTimer = 0;
    this.twoOneRunTimer = 0;
    this.ghostCutTimer = 0;
    this.ghostTrailTimer = 0;
    this.ghostDodgeUsed = false;
    this.ghostDodgeSuccess = false;
    this.phantomDribbleTimer = 0;
    this.phantomDirectionX = this.facingX;
    this.phantomDirectionY = this.facingY;
    this.visionRunTimer = 0;
    this.visionRunDirectionX = 0;
    this.visionRunDirectionY = 0;
    this.tackleStaggerTimer = 0;
    this.controlPulseTimer = 0;
    this.aiPowerThink = 6 + Math.random() * 3;
    this.aiPowerId = null;

    // Controle de Chute
    this.kickCooldownTimer = 0;
    this.kickRingTimer = 0;
    this.ignoreBallCollisionFrames = 0;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.kickCooldownTimer = 0;
    this.kickRingTimer = 0;
    this.ignoreBallCollisionFrames = 0;
    this.dashTimer = 0;
    this.snakeLungeTimer = 0;
    this.twoOneRunTimer = 0;
    this.powerEffect = null;
    this.powerEffectTimer = 0;
    this.ghostCutTimer = 0;
    this.ghostTrailTimer = 0;
    this.ghostDodgeUsed = false;
    this.ghostDodgeSuccess = false;
    this.phantomDribbleTimer = 0;
    this.visionRunTimer = 0;
    this.tackleStaggerTimer = 0;
    this.controlPulseTimer = 0;
    this.nextKickPower = 1;
    this.nextKickReach = 1;
  }

  update(dt) {
    if (this.powerCooldown > 0) this.powerCooldown = Math.max(0, this.powerCooldown - dt);
    if (this.powerEffectTimer > 0) {
      this.powerEffectTimer = Math.max(0, this.powerEffectTimer - dt);
      if (this.powerEffectTimer === 0) {
        if (this.powerEffect === 'vision') this.powerCooldown = POWER_COOLDOWNS.vision;
        else if (this.powerEffect === 'eagle') {
          this.nextKickReach = 1;
          this.powerCooldown = POWER_COOLDOWNS.eagle;
        } else if (this.powerEffect === 'sniper') {
          this.powerCooldown = POWER_COOLDOWNS.sniper;
        } else if (this.powerEffect === 'curve') {
          this.powerCooldown = Math.round(POWER_COOLDOWNS.curve * 0.45);
        }
        this.powerEffect = null;
      }
    }
    if (this.controlPulseTimer > 0) this.controlPulseTimer = Math.max(0, this.controlPulseTimer - dt);
    if (this.dashTimer > 0) this.dashTimer = Math.max(0, this.dashTimer - dt);
    if (this.snakeLungeTimer > 0) this.snakeLungeTimer = Math.max(0, this.snakeLungeTimer - dt);
    if (this.twoOneRunTimer > 0) this.twoOneRunTimer = Math.max(0, this.twoOneRunTimer - dt);
    if (this.visionRunTimer > 0) this.visionRunTimer = Math.max(0, this.visionRunTimer - dt);
    if (this.tackleStaggerTimer > 0) this.tackleStaggerTimer = Math.max(0, this.tackleStaggerTimer - dt);
    if (this.ghostCutTimer > 0) this.ghostCutTimer = Math.max(0, this.ghostCutTimer - dt);
    if (this.phantomDribbleTimer > 0) this.phantomDribbleTimer = Math.max(0, this.phantomDribbleTimer - dt);
    if (this.ghostTrailTimer > 0) this.ghostTrailTimer -= dt;
    if (this.kickCooldownTimer > 0) this.kickCooldownTimer -= dt;
    if (this.kickRingTimer > 0) this.kickRingTimer -= dt;
    if (this.ignoreBallCollisionFrames > 0) this.ignoreBallCollisionFrames--;

    // Fricção inercial
    this.vx *= CONFIG.physics.dampingPlayer;
    this.vy *= CONFIG.physics.dampingPlayer;

    // Limite de velocidade máxima do botão
    const currentSpeed = Math.hypot(this.vx, this.vy);
    const maxSpeed =
      this.snakeLungeTimer > 0 ? 9.6 :
      this.dashTimer > 0 ? 8.8 :
      this.twoOneRunTimer > 0 ? 7.15 :
      this.ghostCutTimer > 0 ? 5.3 :
      CONFIG.physics.playerMaxSpeed * (
        this.powerEffect === 'sprint' ? 1.32 :
        this.powerEffect === 'ego' ? 1.28 :
        this.powerEffect === 'shadow' ? 1.14 :
        this.powerEffect === 'vision' ? 1.08 : 1
      );

    if (currentSpeed > maxSpeed) {
      this.vx = (this.vx / currentSpeed) * maxSpeed;
      this.vy = (this.vy / currentSpeed) * maxSpeed;
    }

    this.x += this.vx;
    this.y += this.vy;

    this.resolveStadiumBounds();
  }

  /**
   * Chute com vetor limpo e direcional
   */
  tryKick(ball, inputDirX = 0, inputDirY = 0, isPass = false, guidedTarget = null) {
    if (this.kickCooldownTimer > 0) return false;
    const curvedKick = this.powerEffect === 'curve';

    const dx = ball.x - this.x;
    const dy = ball.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (curvedKick && dist <= this.radius + ball.radius + 56 && typeof launchCurveShot === 'function') {
      return launchCurveShot(this, isPass, guidedTarget);
    }
    const hasEagleReach = this.powerEffect === 'eagle' || (this.nextKickReach || 1) > 1.05;
    const kickReach = hasEagleReach
      ? this.radius + ball.radius + 36
      : this.radius + ball.radius + CONFIG.physics.kickReachMargin;

    if (dist <= kickReach) {
      ball.visionPassFlight = null;
      this.kickRingTimer = 0.15;
      this.kickCooldownTimer = CONFIG.physics.kickCooldown;
      if (isPass) {
        ball.passTarget = guidedTarget;
        ball.passSource = this;
        ball.passExpiry = 2.8;
        ball.passWasVision = this === player1 && gameMode === '2v2' && this.powerEffect === 'vision';
        if (this.powerEffect === 'vision') {
          ball.visionPassAssistTimer = 1.5;
          ball.visionPassAssistEnabled = Math.random() < 0.78;
        }
      } else {
        ball.passTarget = null;
        ball.passSource = null;
        ball.passExpiry = 0;
        ball.passWasVision = false;
        if (gameMode === '2v2' && twoVtwoStats) twoVtwoStats.passStreak = 0;
      }
      this.ignoreBallCollisionFrames = 4;
      ball.dribbleLockTimer = 0.42;
      ball.dribbleLockOwner = this;

      let nx = dist > 0.0001 ? dx / dist : (this.isHuman ? 1 : -1);
      let ny = dist > 0.0001 ? dy / dist : 0;

      if (guidedTarget) {
        const tx = guidedTarget.x - ball.x;
        const ty = guidedTarget.y - ball.y;
        const targetLen = Math.hypot(tx, ty) || 1;
        nx = nx * 0.12 + (tx / targetLen) * 0.88;
        ny = ny * 0.12 + (ty / targetLen) * 0.88;
        const len = Math.hypot(nx, ny) || 1;
        nx /= len;
        ny /= len;
      } else {
        const hasInput = Math.hypot(inputDirX, inputDirY) > 0.1;
        if (hasInput) {
          const inputLen = Math.hypot(inputDirX, inputDirY);
          const inX = inputDirX / inputLen;
          const inY = inputDirY / inputLen;
          const contactWeight = curvedKick ? 0.30 : 0.70;
          nx = nx * contactWeight + inX * (1 - contactWeight);
          ny = ny * contactWeight + inY * (1 - contactWeight);
          const combinedLen = Math.hypot(nx, ny) || 1;
          nx /= combinedLen;
          ny /= combinedLen;
        }
      }

      // 1. Separação imediata
      const targetDist = this.radius + ball.radius + 2.5;
      ball.x = this.x + nx * targetDist;
      ball.y = this.y + ny * targetDist;

      // 2. Velocidade resultante limpa
      const isHomeTeam = this.isHuman || this.isTeammate;
      const inOffensiveZone = isHomeTeam ? this.x > CONFIG.pitch.centerX - 30 : this.x < CONFIG.pitch.centerX + 30;
      const inDangerZone = isHomeTeam ? this.x > 685 : this.x < 315;
      const isSniperShot = this.powerEffect === 'sniper' && !isPass && inOffensiveZone;
      const kickMultiplier = this.nextKickPower || 1;
      let power = CONFIG.physics.kickPower * kickMultiplier * (isPass ? 0.9 : 1);

      if (this.powerEffect === 'ego') {
        power *= 1.36;
        ball.powerShotTimer = Math.max(ball.powerShotTimer, 0.45);
      }

      if (isSniperShot) {
        const goalX = isHomeTeam ? CONFIG.pitch.right + 12 : CONFIG.pitch.left - 12;
        const cornerOffset = ball.y >= CONFIG.pitch.centerY ? -42 : 42;
        const aimX = goalX - ball.x;
        const aimY = (CONFIG.pitch.centerY + cornerOffset) - ball.y;
        const aimLen = Math.hypot(aimX, aimY) || 1;
        const gNx = aimX / aimLen;
        const gNy = aimY / aimLen;
        // Assistência de precisão se não estiver chutando para o lado oposto
        if (nx * gNx + ny * gNy > -0.15) {
          nx = nx * 0.45 + gNx * 0.55;
          ny = ny * 0.45 + gNy * 0.55;
          const nLen = Math.hypot(nx, ny) || 1;
          nx /= nLen;
          ny /= nLen;
        }
        power *= inDangerZone ? 1.52 : 1.28;
        ball.powerShotTimer = Math.max(ball.powerShotTimer, 0.85);
        ball.sniperShotTimer = 0.85;
      }

      ball.vx = nx * power;
      ball.vy = ny * power;
      if (kickMultiplier > 1.5 && !isSniperShot && !isPass && typeof playPistolAnimation === 'function') {
        playPistolAnimation(this, nx, ny);
      }
      if (kickMultiplier > 1.5 || isSniperShot) {
        ball.powerShotTimer = Math.max(ball.powerShotTimer, 0.9);
        Sound.playCannon();
      }
      if (curvedKick) {
        const requestedSide = this.isHuman
          ? (input.up ? -1 : input.down ? 1 : (this.y < CONFIG.pitch.centerY ? 1 : -1))
          : (this.y < CONFIG.pitch.centerY ? 1 : -1);
        ball.curveTimer = 1.05;
        ball.curveSide = requestedSide;
        ball.curveRate = 0.82;
        ball.curveTrail = [];
        this.powerEffect = null;
        this.powerEffectTimer = 0;
        this.powerCooldown = POWER_COOLDOWNS.curve;
      }
      if (hasEagleReach && this.powerEffect === 'eagle') {
        if (dist > this.radius + ball.radius + 6) {
          this.vx += nx * 2.4;
          this.vy += ny * 2.4;
        }
        addImpactSpark(ball.x, ball.y, '#38bdf8', 11, 1.15);
        this.powerEffect = null;
        this.powerEffectTimer = 0;
        this.powerCooldown = POWER_COOLDOWNS.eagle;
      }
      if (this.powerEffect === 'sniper') {
        if (isSniperShot) {
          addImpactSpark(ball.x, ball.y, '#fb7185', 14, 1.35);
          this.powerEffect = null;
          this.powerEffectTimer = 0;
          this.powerCooldown = POWER_COOLDOWNS.sniper;
        }
      }
      this.nextKickPower = 1;
      this.nextKickReach = 1;

      this.vx -= nx * 0.5;
      this.vy -= ny * 0.5;

      addImpactSpark(ball.x, ball.y);
      if (curvedKick) Sound.playCurvedKick();
      else if (kickMultiplier <= 1.5 && !isSniperShot) Sound.playKick();
      return true;
    }
    return false;
  }

  resolveStadiumBounds() {
    const s = CONFIG.stadium;
    if (this.x - this.radius < s.minX) {
      this.x = s.minX + this.radius;
      this.vx = -this.vx * 0.4;
    }
    if (this.x + this.radius > s.maxX) {
      this.x = s.maxX - this.radius;
      this.vx = -this.vx * 0.4;
    }
    if (this.y - this.radius < s.minY) {
      this.y = s.minY + this.radius;
      this.vy = -this.vy * 0.4;
    }
    if (this.y + this.radius > s.maxY) {
      this.y = s.maxY - this.radius;
      this.vy = -this.vy * 0.4;
    }
  }

  draw(renderCtx) {
    const spriteKey = this.isHuman || this.isTeammate ? 'player1' : 'player2';
    if (assets.hasSprite(spriteKey)) {
      const img = assets.sprites[spriteKey];
      renderCtx.drawImage(
        img,
        this.x - this.radius,
        this.y - this.radius,
        this.radius * 2,
        this.radius * 2
      );
      return;
    }

    renderCtx.save();

    // Sombra projetada
    renderCtx.beginPath();
    renderCtx.arc(this.x, this.y + 3, this.radius + 1, 0, Math.PI * 2);
    renderCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    renderCtx.fill();

    // Feedback visual de atordoamento pós-bote
    if (this.tackleStaggerTimer > 0) {
      renderCtx.beginPath();
      renderCtx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
      renderCtx.lineWidth = 2.5;
      renderCtx.setLineDash([4, 4]);
      renderCtx.strokeStyle = '#c084fc';
      renderCtx.stroke();
      renderCtx.setLineDash([]);
    }

    // Anel de Chute
    if (this.kickRingTimer > 0) {
      renderCtx.beginPath();
      renderCtx.arc(this.x, this.y, this.radius + 4.5, 0, Math.PI * 2);
      renderCtx.lineWidth = 3.5;
      renderCtx.strokeStyle = '#ffffff';
      renderCtx.shadowColor = '#ffffff';
      renderCtx.shadowBlur = 12;
      renderCtx.stroke();
      renderCtx.shadowBlur = 0;
    } else {
      renderCtx.beginPath();
      renderCtx.arc(this.x, this.y, this.radius + 1.5, 0, Math.PI * 2);
      renderCtx.lineWidth = 1.5;
      renderCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      renderCtx.stroke();
    }

    // Disco do Botão
    renderCtx.beginPath();
    renderCtx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    renderCtx.fillStyle = this.color;
    renderCtx.fill();

    // Relevo 3D com gradiente
    const grad = renderCtx.createRadialGradient(
      this.x - this.radius * 0.3,
      this.y - this.radius * 0.3,
      this.radius * 0.1,
      this.x,
      this.y,
      this.radius
    );
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    grad.addColorStop(0.7, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    renderCtx.fillStyle = grad;
    renderCtx.fill();

    if ((this.isHuman || this.isTeammate) && typeof profile !== 'undefined' && profile.equippedShirt && profile.equippedShirt !== 'classic') {
      const shirt = ITEMS.shirts.find(item => item.id === profile.equippedShirt);
      if (shirt) {
        renderCtx.save();
        renderCtx.beginPath();
        renderCtx.arc(this.x, this.y, this.radius - 2, 0, Math.PI * 2);
        renderCtx.clip();
        renderCtx.fillStyle = shirt.colors[0];
        renderCtx.fillRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        renderCtx.fillStyle = shirt.colors[1];
        if (shirt.id === 'vasco') {
          renderCtx.beginPath();
          renderCtx.moveTo(this.x - this.radius, this.y - this.radius * 0.55);
          renderCtx.lineTo(this.x + this.radius, this.y + this.radius * 0.55);
          renderCtx.lineTo(this.x + this.radius, this.y + this.radius * 0.82);
          renderCtx.lineTo(this.x - this.radius, this.y - this.radius * 0.28);
          renderCtx.fill();
        } else {
          for (let sx = this.x - this.radius; sx < this.x + this.radius; sx += shirt.id === 'santos' ? 9 : 12) {
            renderCtx.fillRect(sx, this.y - this.radius, shirt.id === 'santos' ? 4 : 5, this.radius * 2);
          }
        }
        renderCtx.fillStyle = '#fff';
        renderCtx.font = `bold ${Math.floor(this.radius * 0.42)}px Arial`;
        renderCtx.textAlign = 'center';
        renderCtx.textBaseline = 'middle';
        renderCtx.fillText(shirt.badge, this.x, this.y - this.radius * 0.47);
        renderCtx.restore();
      }
    }

    // Borda escura
    renderCtx.lineWidth = 3.2;
    renderCtx.strokeStyle = '#181b20';
    renderCtx.stroke();

    // Número da camisa
    renderCtx.font = `bold ${Math.floor(this.radius * 0.95)}px "Segoe UI", Arial, sans-serif`;
    renderCtx.textAlign = 'center';
    renderCtx.textBaseline = 'middle';
    renderCtx.lineWidth = 2.4;
    renderCtx.strokeStyle = 'rgba(15, 20, 25, 0.85)';
    renderCtx.strokeText(this.number, this.x, this.y);
    renderCtx.fillStyle = '#ffffff';
    renderCtx.fillText(this.number, this.x, this.y);

    if (this.powerEffect === 'vision') {
      renderCtx.beginPath();
      renderCtx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
      renderCtx.strokeStyle = 'rgba(244, 114, 182, 0.92)';
      renderCtx.lineWidth = 2;
      renderCtx.setLineDash([4, 3]);
      renderCtx.stroke();
      renderCtx.setLineDash([]);
    }

    renderCtx.restore();
  }
}

class Ball {
  constructor(x, y, radius = 9.5) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
    this.mass = 1.0;
    this.trail = [];
    this.powerShotTimer = 0;
    this.sniperShotTimer = 0;
    this.visionPassAssistTimer = 0;
    this.visionPassAssistEnabled = false;
    this.curveTimer = 0;
    this.curveSide = 1;
    this.curveRate = 0;
    this.curveTrail = [];
    this.dribbleLockTimer = 0;
    this.dribbleLockOwner = null;
    this.passTarget = null;
    this.passSource = null;
    this.passExpiry = 0;
    this.passWasVision = false;
    this.visionPassFlight = null;
    this.visionPassTrail = [];
    this.pistolTrailTimer = 0;
    this.pistolShotTrail = [];
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.trail = [];
    this.powerShotTimer = 0;
    this.sniperShotTimer = 0;
    this.visionPassAssistTimer = 0;
    this.visionPassAssistEnabled = false;
    this.curveTimer = 0;
    this.curveTrail = [];
    this.dribbleLockTimer = 0;
    this.dribbleLockOwner = null;
    this.passTarget = null;
    this.passSource = null;
    this.passExpiry = 0;
    this.passWasVision = false;
    this.visionPassFlight = null;
    this.visionPassTrail = [];
    this.pistolTrailTimer = 0;
    this.pistolShotTrail = [];
  }

  update() {
    if (this.dribbleLockTimer > 0) {
      this.dribbleLockTimer = Math.max(0, this.dribbleLockTimer - 1 / 60);
      if (this.dribbleLockTimer === 0) this.dribbleLockOwner = null;
    }
    if (this.curveTimer > 0) {
      this.curveTimer = Math.max(0, this.curveTimer - 1 / 60);
      const angle = this.curveSide * this.curveRate / 60;
      const speed = Math.hypot(this.vx, this.vy);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const oldVx = this.vx;
      const oldVy = this.vy;
      this.vx = oldVx * cos - oldVy * sin;
      this.vy = oldVx * sin + oldVy * cos;
      if (speed > 0.1) {
        this.curveTrail.push({ x: this.x, y: this.y });
        if (this.curveTrail.length > 15) this.curveTrail.shift();
      }
    } else if (this.curveTrail.length) {
      this.curveTrail.shift();
    }
    if (this.powerShotTimer > 0) this.powerShotTimer = Math.max(0, this.powerShotTimer - 1 / 60);
    if (this.sniperShotTimer > 0) this.sniperShotTimer = Math.max(0, this.sniperShotTimer - 1 / 60);
    this.vx *= CONFIG.physics.dampingBall;
    this.vy *= CONFIG.physics.dampingBall;

    const speed = Math.hypot(this.vx, this.vy);
    const maxSpeed = this.curveTimer > 0
      ? CONFIG.physics.ballMaxSpeed * 1.48
      : this.powerShotTimer > 0
        ? CONFIG.physics.ballMaxSpeed * 1.4
        : CONFIG.physics.ballMaxSpeed;
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }

    if (speed > 4.0) {
      this.trail.push({ x: this.x, y: this.y, speed });
      if (this.trail.length > 5) this.trail.shift();
    } else if (this.trail.length > 0) {
      this.trail.shift();
    }

    if (speed < 0.02) {
      this.vx = 0;
      this.vy = 0;
    }

    this.x += this.vx;
    this.y += this.vy;

    this.enforceHardBounds();
    if (this.visionPassFlight && !this.visionPassFlight.completed) {
      this.visionPassTrail.push({ x: this.x, y: this.y });
      if (this.visionPassTrail.length > 22) this.visionPassTrail.shift();
    } else if (this.visionPassTrail.length) {
      this.visionPassTrail.shift();
    }
    if (this.pistolTrailTimer > 0) {
      this.pistolTrailTimer = Math.max(0, this.pistolTrailTimer - 1 / 60);
      this.pistolShotTrail.push({ x: this.x, y: this.y });
      if (this.pistolShotTrail.length > 22) this.pistolShotTrail.shift();
      if (Math.hypot(this.vx, this.vy) > 4.2 && Math.random() < 0.72) {
        addImpactSpark(this.x, this.y, Math.random() < 0.4 ? '#fde047' : '#f97316', 1, 0.85);
      }
    } else if (this.pistolShotTrail.length) {
      this.pistolShotTrail.shift();
    }
  }

  enforceHardBounds() {
    const p = CONFIG.pitch;
    const g = CONFIG.goals;
    const s = CONFIG.stadium;

    if (this.y - this.radius < p.top) {
      this.y = p.top + this.radius;
      this.vy = Math.abs(this.vy) * CONFIG.physics.restitutionWall;
      if (this.curveTimer > 0) {
        this.curveTimer = 0;
        if (typeof triggerCurveImpact === 'function') triggerCurveImpact(this.x, this.y);
      }
    }
    if (this.y + this.radius > p.bottom) {
      this.y = p.bottom - this.radius;
      this.vy = -Math.abs(this.vy) * CONFIG.physics.restitutionWall;
      if (this.curveTimer > 0) {
        this.curveTimer = 0;
        if (typeof triggerCurveImpact === 'function') triggerCurveImpact(this.x, this.y);
      }
    }

    const isInsideGoalY = this.y >= g.topY && this.y <= g.bottomY;
    if (!isInsideGoalY) {
      if (this.x - this.radius < p.left) {
        this.x = p.left + this.radius;
        this.vx = Math.abs(this.vx) * CONFIG.physics.restitutionWall;
        if (this.curveTimer > 0) {
          this.curveTimer = 0;
          if (typeof triggerCurveImpact === 'function') triggerCurveImpact(this.x, this.y);
        }
      }
      if (this.x + this.radius > p.right) {
        this.x = p.right - this.radius;
        this.vx = -Math.abs(this.vx) * CONFIG.physics.restitutionWall;
        if (this.curveTimer > 0) {
          this.curveTimer = 0;
          if (typeof triggerCurveImpact === 'function') triggerCurveImpact(this.x, this.y);
        }
      }
    } else {
      const leftNetX = p.left - g.depth;
      const rightNetX = p.right + g.depth;
      if (this.x - this.radius < leftNetX) {
        this.x = leftNetX + this.radius;
        this.vx = Math.abs(this.vx) * 0.4;
      }
      if (this.x + this.radius > rightNetX) {
        this.x = rightNetX - this.radius;
        this.vx = -Math.abs(this.vx) * 0.4;
      }
    }

    if (this.y < s.minY) this.y = s.minY + this.radius;
    if (this.y > s.maxY) this.y = s.maxY - this.radius;
  }

  draw(renderCtx) {
    if (this.pistolShotTrail && this.pistolShotTrail.length > 1) {
      renderCtx.save();
      renderCtx.lineCap = 'round';
      renderCtx.lineJoin = 'round';
      for (let i = 1; i < this.pistolShotTrail.length; i++) {
        const a = this.pistolShotTrail[i - 1];
        const b = this.pistolShotTrail[i];
        const t = i / this.pistolShotTrail.length;
        // Rastro externo flamejante de projétil
        renderCtx.beginPath();
        renderCtx.moveTo(a.x, a.y);
        renderCtx.lineTo(b.x, b.y);
        renderCtx.strokeStyle = `rgba(249, 115, 22, ${t * 0.85})`;
        renderCtx.lineWidth = 3 + t * 8;
        renderCtx.shadowColor = '#f97316';
        renderCtx.shadowBlur = 10 + t * 14;
        renderCtx.stroke();

        // Núcleo incandescente branco-dourado
        renderCtx.beginPath();
        renderCtx.moveTo(a.x, a.y);
        renderCtx.lineTo(b.x, b.y);
        renderCtx.strokeStyle = `rgba(254, 240, 138, ${t * 0.92})`;
        renderCtx.lineWidth = 1.2 + t * 3.2;
        renderCtx.shadowBlur = 0;
        renderCtx.stroke();
      }

      // Cone supersônico balístico à frente da bola em alta velocidade
      const bSpeed = Math.hypot(this.vx, this.vy);
      if (this.pistolTrailTimer > 0.22 && bSpeed > 4.2) {
        const bAngle = Math.atan2(this.vy, this.vx);
        renderCtx.save();
        renderCtx.translate(this.x, this.y);
        renderCtx.rotate(bAngle);
        renderCtx.globalAlpha = Math.min(0.85, this.pistolTrailTimer * 1.1);
        renderCtx.strokeStyle = '#fef08a';
        renderCtx.shadowColor = '#f97316';
        renderCtx.shadowBlur = 12;
        renderCtx.lineWidth = 2.4;
        renderCtx.beginPath();
        renderCtx.moveTo(-this.radius * 0.65, -this.radius * 1.65);
        renderCtx.lineTo(this.radius * 1.38, 0);
        renderCtx.lineTo(-this.radius * 0.65, this.radius * 1.65);
        renderCtx.stroke();
        renderCtx.restore();
      }
      renderCtx.restore();
    }

    if (this.visionPassTrail && this.visionPassTrail.length > 1) {
      renderCtx.save();
      renderCtx.lineCap = 'round';
      renderCtx.lineJoin = 'round';
      for (let i = 1; i < this.visionPassTrail.length; i++) {
        const a = this.visionPassTrail[i - 1];
        const b = this.visionPassTrail[i];
        const t = i / this.visionPassTrail.length;
        renderCtx.beginPath();
        renderCtx.moveTo(a.x, a.y);
        renderCtx.lineTo(b.x, b.y);
        renderCtx.strokeStyle = `rgba(244, 114, 182, ${t * 0.82})`;
        renderCtx.lineWidth = 2 + t * 4;
        renderCtx.shadowColor = '#f472b6';
        renderCtx.shadowBlur = 5 + t * 9;
        renderCtx.stroke();
      }
      renderCtx.restore();
    }

    if (this.curveTrail && this.curveTrail.length) {
      renderCtx.save();
      renderCtx.lineCap = 'round';
      renderCtx.lineJoin = 'round';
      for (let i = 1; i < this.curveTrail.length; i++) {
        const a = this.curveTrail[i - 1];
        const b = this.curveTrail[i];
        const t = i / this.curveTrail.length;
        renderCtx.beginPath();
        renderCtx.moveTo(a.x, a.y);
        renderCtx.lineTo(b.x, b.y);
        renderCtx.strokeStyle = `rgba(55, 170, 255, ${t * 0.48})`;
        renderCtx.lineWidth = 2 + t * 4;
        renderCtx.shadowColor = '#32aaff';
        renderCtx.shadowBlur = 5 + t * 8;
        renderCtx.stroke();
      }
      renderCtx.restore();
    }

    if (assets.hasSprite('ball')) {
      const img = assets.sprites.ball;
      renderCtx.drawImage(
        img,
        this.x - this.radius,
        this.y - this.radius,
        this.radius * 2,
        this.radius * 2
      );
      return;
    }

    renderCtx.save();

    for (let i = 0; i < this.trail.length; i++) {
      const pt = this.trail[i];
      const progress = (i + 1) / this.trail.length;
      renderCtx.beginPath();
      renderCtx.arc(pt.x, pt.y, this.radius * (0.3 + 0.6 * progress), 0, Math.PI * 2);
      renderCtx.fillStyle = this.sniperShotTimer > 0
        ? `rgba(251, 113, 133, ${0.38 * progress})`
        : this.powerShotTimer > 0
          ? `rgba(249, 115, 22, ${0.3 * progress})`
          : `rgba(255, 255, 255, ${0.14 * progress})`;
      renderCtx.fill();
    }

    renderCtx.beginPath();
    renderCtx.arc(this.x + 2, this.y + 3, this.radius, 0, Math.PI * 2);
    renderCtx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    renderCtx.fill();

    renderCtx.beginPath();
    renderCtx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    renderCtx.fillStyle = '#f8fafc';
    renderCtx.fill();

    const grad = renderCtx.createRadialGradient(
      this.x - this.radius * 0.35,
      this.y - this.radius * 0.35,
      1,
      this.x,
      this.y,
      this.radius
    );
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.6, '#e2e8f0');
    grad.addColorStop(1, '#94a3b8');
    renderCtx.fillStyle = grad;
    renderCtx.fill();

    renderCtx.lineWidth = 1.8;
    renderCtx.strokeStyle = '#334155';
    renderCtx.stroke();

    renderCtx.fillStyle = '#1e293b';
    renderCtx.beginPath();
    renderCtx.arc(this.x, this.y, this.radius * 0.32, 0, Math.PI * 2);
    renderCtx.fill();

    renderCtx.restore();
  }
}

class GoalPost {
  constructor(x, y, radius = CONFIG.goals.postRadius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
  }

  draw(renderCtx) {
    const pitchTheme = typeof profile !== 'undefined' && profile.pitchTheme ? profile.pitchTheme : 'classic';
    const isCyberPitch = pitchTheme === 'cyber';
    const isJurassicPitch = pitchTheme === 'jurassic';
    renderCtx.save();
    renderCtx.beginPath();
    renderCtx.arc(this.x, this.y + 2, this.radius, 0, Math.PI * 2);
    renderCtx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    renderCtx.fill();

    renderCtx.beginPath();
    renderCtx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    if (isCyberPitch) {
      renderCtx.shadowColor = '#38bdf8';
      renderCtx.shadowBlur = 14;
      renderCtx.fillStyle = '#e0f2fe';
    } else if (isJurassicPitch) {
      renderCtx.shadowColor = '#f59e0b';
      renderCtx.shadowBlur = 13;
      renderCtx.fillStyle = '#fef3c7';
    } else {
      renderCtx.fillStyle = '#f8fafc';
    }
    renderCtx.fill();

    renderCtx.lineWidth = 2.2;
    renderCtx.strokeStyle = isCyberPitch ? '#38bdf8' : isJurassicPitch ? '#d97706' : '#0f172a';
    renderCtx.stroke();
    renderCtx.restore();
  }
}

// Partículas e trilhas visuais
const particles = [];
const lightningTrails = [];
const phantomShadows = [];

function addPhantomShadow(player) {
  phantomShadows.push({
    x: player.x,
    y: player.y,
    radius: player.radius,
    color: player.color,
    number: player.number,
    life: 0.28,
    maxLife: 0.28
  });
}

function updateAndDrawPhantomShadows(renderCtx) {
  for (let i = phantomShadows.length - 1; i >= 0; i--) {
    const shadow = phantomShadows[i];
    shadow.life -= 1 / 60;
    if (shadow.life <= 0) {
      phantomShadows.splice(i, 1);
      continue;
    }
    renderCtx.save();
    renderCtx.globalAlpha = (shadow.life / shadow.maxLife) * 0.4;
    renderCtx.beginPath();
    renderCtx.arc(shadow.x, shadow.y, shadow.radius + 2, 0, Math.PI * 2);
    renderCtx.fillStyle = shadow.color;
    renderCtx.shadowColor = '#b8f2ff';
    renderCtx.shadowBlur = 14;
    renderCtx.fill();
    renderCtx.lineWidth = 2;
    renderCtx.strokeStyle = '#d9f8ff';
    renderCtx.stroke();
    renderCtx.fillStyle = '#fff';
    renderCtx.font = `bold ${Math.floor(shadow.radius * 0.8)}px Arial`;
    renderCtx.textAlign = 'center';
    renderCtx.textBaseline = 'middle';
    renderCtx.fillText(shadow.number, shadow.x, shadow.y);
    renderCtx.restore();
  }
}

function addLightningTrail(player) {
  const backX = -player.facingX;
  const backY = -player.facingY;
  const sideX = -backY;
  const sideY = backX;
  const points = [];
  for (let i = 0; i < 6; i++) {
    const along = i * 9;
    const zigzag = i === 0 || i === 5 ? 0 : (Math.random() - 0.5) * 15;
    points.push({
      x: player.x + backX * (player.radius + along) + sideX * zigzag,
      y: player.y + backY * (player.radius + along) + sideY * zigzag
    });
  }
  lightningTrails.push({ points, life: 0.2, maxLife: 0.2 });
}

function updateAndDrawLightningTrails(renderCtx) {
  for (let i = lightningTrails.length - 1; i >= 0; i--) {
    const trail = lightningTrails[i];
    trail.life -= 1 / 60;
    if (trail.life <= 0) {
      lightningTrails.splice(i, 1);
      continue;
    }
    const alpha = trail.life / trail.maxLife;
    renderCtx.save();
    renderCtx.globalAlpha = alpha;
    renderCtx.lineCap = 'round';
    renderCtx.lineJoin = 'round';
    renderCtx.beginPath();
    renderCtx.moveTo(trail.points[0].x, trail.points[0].y);
    for (let p = 1; p < trail.points.length; p++) {
      renderCtx.lineTo(trail.points[p].x, trail.points[p].y);
    }
    renderCtx.strokeStyle = '#38bdf8';
    renderCtx.lineWidth = 6;
    renderCtx.shadowColor = '#38bdf8';
    renderCtx.shadowBlur = 18;
    renderCtx.stroke();
    renderCtx.strokeStyle = '#e0f2fe';
    renderCtx.lineWidth = 2.2;
    renderCtx.shadowBlur = 7;
    renderCtx.stroke();
    renderCtx.restore();
  }
}

function addImpactSpark(x, y, color = '#ffffff', count = 7, speedScale = 1) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (1.2 + Math.random() * 2.8) * speedScale;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: 0.05 + Math.random() * 0.05,
      color,
      size: 2.0
    });
  }
}

function updateAndDrawParticles(renderCtx) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;

    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }

    renderCtx.save();
    renderCtx.globalAlpha = Math.max(0, p.life);
    renderCtx.fillStyle = p.color;
    renderCtx.beginPath();
    renderCtx.arc(p.x, p.y, p.size || 2.0, 0, Math.PI * 2);
    renderCtx.fill();
    renderCtx.restore();
  }
}
