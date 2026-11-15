/**
 * ==========================================================================
 * LITO BALL - LOOP PRINCIPAL, ESTADO DA PARTIDA E MODO TREINO (js/main.js)
 * ==========================================================================
 */
'use strict';

// Elementos do DOM
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const previewCanvas = document.getElementById('player-preview-canvas');
const previewCtx = previewCanvas ? previewCanvas.getContext('2d') : null;

const menuOverlay = document.getElementById('menu-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const gameOverTitle = document.getElementById('game-over-title');
const gameOverReason = document.getElementById('game-over-reason');
const finalScoreP1El = document.getElementById('final-score-p1');
const finalScoreP2El = document.getElementById('final-score-p2');
const finalBadgeP1 = document.getElementById('final-badge-p1');

const startBtn = document.getElementById('start-btn');
const twoVtwoStartBtn = document.getElementById('start-2v2-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const btnMenu = document.getElementById('btn-menu');
const btnPass = document.getElementById('btn-pass');
const btnRestart = document.getElementById('btn-restart');

const scoreP1El = document.getElementById('score-p1');
const scoreP2El = document.getElementById('score-p2');
const timerEl = document.getElementById('hud-timer');
const goalBanner = document.getElementById('goal-banner');
const badgeP1 = document.getElementById('badge-p1');

// Instanciação das Entidades
const player1 = new Player(260, 300, 22, playerConfig.color, playerConfig.number, true);
const player2 = new Player(740, 300, 22, '#e53935', 10, false);
const homeMate = new Player(390, 220, 20, playerConfig.color, 7, false);
homeMate.isTeammate = true;
const awayMate = new Player(810, 380, 20, '#f15b5b', 9, false);
awayMate.isAwayMate = true;
const ball = new Ball(CONFIG.pitch.centerX, CONFIG.pitch.centerY, 9.5);

// 4 postes (esquerdo topo, esquerdo base, direito topo, direito base)
const posts = [
  new GoalPost(CONFIG.pitch.left, CONFIG.goals.topY),
  new GoalPost(CONFIG.pitch.left, CONFIG.goals.bottomY),
  new GoalPost(CONFIG.pitch.right, CONFIG.goals.topY),
  new GoalPost(CONFIG.pitch.right, CONFIG.goals.bottomY)
];

function setPitchLayout(mode = 'match') {
  const layout = PITCH_LAYOUTS[mode === '2v2' ? '2v2' : 'match'];
  const p = CONFIG.pitch;
  const g = CONFIG.goals;

  homeMate.radius = mode === '2v2' ? 22 : 20;
  awayMate.radius = mode === '2v2' ? 22 : 20;

  p.left = layout.left;
  p.right = layout.right;
  p.top = layout.top;
  p.bottom = layout.bottom;

  const center = (p.top + p.bottom) / 2;
  g.topY = center - layout.goalHeight / 2;
  g.bottomY = center + layout.goalHeight / 2;

  // Correção explícita das 4 traves nos dois gols
  posts[0].x = p.left;
  posts[0].y = g.topY;
  posts[1].x = p.left;
  posts[1].y = g.bottomY;
  posts[2].x = p.right;
  posts[2].y = g.topY;
  posts[3].x = p.right;
  posts[3].y = g.bottomY;

  rebuildPitchCollisionGeometry();
  aiState.ownGoalCenter = { x: p.right, y: p.centerY };
  aiState.enemyGoalCenter = { x: p.left, y: p.centerY };
}

// Estado global do jogo
let gameState = {
  running: false,
  isGameOver: false,
  pausedForGoal: false,
  goalPauseTimer: 0,
  timeRemaining: CONFIG.rules.matchDurationSeconds,
  scoreP1: 0,
  scoreP2: 0,
  isOvertime: false,
  overtimeTimeRemaining: 60,
  countdownTimer: 0,
  goBannerTimer: 0,
  lastCountdownBeep: 0,
  pendingGoalCountdown: false,
  lastTimestamp: 0,
  physicsAccumulator: 0
};

let gameMode = 'match';
let trainingMatchSnapshot = null;
let trainingReturnMode = 'match';
let hasNormalMatchInProgress = false;
let trainingDummyHasBall = false;
let twoVtwoStats = null;
let endGameTimerId = null;

function newTwoVtwoStats() {
  return {
    passStreak: 0,
    completed: { passes: false, twoOne: false, goalAfterMatePass: false },
    goalAssistPending: false
  };
}

// Controles do Jogador
const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  kickRequested: false,
  passRequested: false
};

function clearGoalBanner() {
  if (goalBanner) {
    goalBanner.classList.remove('show');
  }
}

function triggerCountdown(seconds = 3.0) {
  gameState.countdownTimer = seconds;
  gameState.goBannerTimer = 0;
  gameState.lastCountdownBeep = Math.ceil(seconds) + 1;
  input.kickRequested = false;
  input.passRequested = false;
  updateCountdownOverlay();
}

function updateCountdownOverlay() {
  const overlay = document.getElementById('countdown-overlay');
  const valEl = document.getElementById('countdown-value');
  const subEl = document.getElementById('countdown-sub');
  if (!overlay || !valEl || !subEl) return;

  if (gameMode === 'training' || (!gameState.countdownTimer && !gameState.goBannerTimer)) {
    overlay.classList.add('hidden');
    valEl.classList.remove('is-go');
    return;
  }

  overlay.classList.remove('hidden');
  if (gameState.countdownTimer > 0) {
    const num = Math.max(1, Math.ceil(gameState.countdownTimer));
    if (valEl.textContent !== String(num)) {
      valEl.textContent = String(num);
      valEl.classList.remove('is-go');
      // Reinicia micro-animação do pop numérico
      valEl.style.animation = 'none';
      void valEl.offsetWidth;
      valEl.style.animation = '';
    }
    subEl.textContent = gameMode === '2v2' ? 'Partida 2v2 · Prepare-se!' : 'Partida 1v1 · Prepare-se!';
  } else {
    valEl.textContent = 'JÁ!';
    valEl.classList.add('is-go');
    subEl.textContent = 'Valendo!';
  }
}

function isGameplayActiveForInput() {
  if (isRemappingKey()) return false;
  if (!menuOverlay.classList.contains('hidden')) return false;
  if (!gameOverOverlay.classList.contains('hidden')) return false;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
  return true;
}

window.addEventListener('keydown', e => {
  Sound.init();
  if (!isGameplayActiveForInput()) return;

  const code = e.code;
  if (!twoOnePlay && (code === 'KeyW' || code === 'ArrowUp')) input.up = true;
  if (!twoOnePlay && (code === 'KeyS' || code === 'ArrowDown')) input.down = true;
  if (!twoOnePlay && (code === 'KeyA' || code === 'ArrowLeft')) input.left = true;
  if (!twoOnePlay && (code === 'KeyD' || code === 'ArrowRight')) input.right = true;

  if (code === controlsConfig.kickKey) {
    if (!twoOnePlay) input.kickRequested = true;
    e.preventDefault();
  }

  if (code === 'KeyF' && !twoOnePlay && !e.repeat && gameState.running && !gameState.isGameOver && !gameState.pausedForGoal && gameState.countdownTimer <= 0) {
    input.passRequested = true;
    e.preventDefault();
  }

  if (code === 'Escape' && twoOneSelection) {
    twoOneSelection = null;
    input.passRequested = false;
    showPowerFeedback('Seleção cancelada', true);
  }

  if (code === controlsConfig.powerKey && !e.repeat && gameState.running && !gameState.isGameOver && gameState.countdownTimer <= 0) {
    if (!twoOnePlay) applyPower(profile.equippedPower, player1);
    e.preventDefault();
  }
});

window.addEventListener('keyup', e => {
  const code = e.code;
  if (code === 'KeyW' || code === 'ArrowUp') input.up = false;
  if (code === 'KeyS' || code === 'ArrowDown') input.down = false;
  if (code === 'KeyA' || code === 'ArrowLeft') input.left = false;
  if (code === 'KeyD' || code === 'ArrowRight') input.right = false;
  if (code === controlsConfig.kickKey) input.kickRequested = false;
  if (code === 'KeyF') input.passRequested = false;
});

window.addEventListener('mousedown', e => {
  Sound.init();
  if (!isGameplayActiveForInput() || twoOneSelection || twoOnePlay) return;
  if (e.button === 0 && gameState.running && !gameState.isGameOver && !e.target.closest('button')) {
    input.kickRequested = true;
  }
});

canvas.addEventListener('mousemove', e => {
  if (typeof updateCurveMouseAim === 'function') {
    updateCurveMouseAim(e.clientX, e.clientY);
  }
});

canvas.addEventListener('click', e => {
  if (!twoOneSelection) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * canvas.width / rect.width;
  const y = (e.clientY - rect.top) * canvas.height / rect.height;
  if (Math.hypot(x - twoOneSelection.target.x, y - twoOneSelection.target.y) <= twoOneSelection.target.radius + 22) {
    confirmTwoOneSelection();
  }
});

window.addEventListener('mouseup', e => {
  if (e.button === 0) input.kickRequested = false;
});

btnPass.addEventListener('click', () => {
  if (gameState.running && !gameState.isGameOver && !gameState.pausedForGoal && !twoOnePlay) {
    input.passRequested = true;
  }
});

/* ==========================================================================
   DETECÇÃO DE GOLS E FIM DE PARTIDA
   ========================================================================== */

function checkGoal() {
  if (gameMode === 'training') {
    clearGoalBanner();
    return;
  }
  if (gameState.pausedForGoal || gameState.isGameOver) return;

  const p = CONFIG.pitch;
  const g = CONFIG.goals;
  const isInsideGoalY = ball.y >= g.topY && ball.y <= g.bottomY;

  if (ball.x + ball.radius < p.left - 4 && isInsideGoalY) {
    handleGoal('p2');
  } else if (ball.x - ball.radius > p.right + 4 && isInsideGoalY) {
    handleGoal('p1');
  }
}

function handleGoal(scoringTeam) {
  if (gameMode === 'training') {
    clearGoalBanner();
    return;
  }

  gameState.pausedForGoal = true;
  gameState.goalPauseTimer = 2.0;
  gameState.pendingGoalCountdown = true;

  if (scoringTeam === 'p1') {
    gameState.scoreP1++;
    scoreP1El.textContent = gameState.scoreP1;
    goalBanner.style.color = '#38bdf8';
    goalBanner.textContent = 'GOOOOL!';
  } else {
    gameState.scoreP2++;
    scoreP2El.textContent = gameState.scoreP2;
    goalBanner.style.color = '#f87171';
    goalBanner.textContent = gameMode === '2v2' ? 'GOL ADVERSÁRIO!' : 'GOL DO BOT!';
  }

  if (gameMode === '2v2' && scoringTeam === 'p1' && twoVtwoStats?.goalAssistPending) {
    twoVtwoStats.completed.goalAfterMatePass = true;
  }
  if (gameMode === '2v2' && twoVtwoStats) {
    twoVtwoStats.goalAssistPending = false;
  }

  goalBanner.classList.add('show');
  Sound.playGoal();

  for (let i = 0; i < 35; i++) {
    addImpactSpark(ball.x, ball.y);
  }

  if (endGameTimerId) clearTimeout(endGameTimerId);
  if (gameMode === '2v2' && gameState.isOvertime) {
    endGameTimerId = setTimeout(() => endGame(scoringTeam === 'p1' ? 'p1_golden_goal' : 'p2_golden_goal'), 1200);
  } else if (gameMode !== '2v2' && (gameState.scoreP1 >= CONFIG.rules.goalsToWin || gameState.scoreP2 >= CONFIG.rules.goalsToWin)) {
    endGameTimerId = setTimeout(() => endGame(gameState.scoreP1 >= CONFIG.rules.goalsToWin ? 'p1_win_5_goals' : 'p2_win_5_goals'), 1500);
  }
}

function beginGoldenGoal() {
  gameState.isOvertime = true;
  gameState.overtimeTimeRemaining = 60;
  gameState.timeRemaining = 0;
  resetPositions();
  gameState.pausedForGoal = true;
  gameState.goalPauseTimer = 1.2;
  goalBanner.style.color = '#fbbf24';
  goalBanner.textContent = 'GOL DE OURO';
  goalBanner.classList.add('show');
  updateTimerDisplay();
  showPowerFeedback('Empate · prorrogação de gol de ouro', true, false);
}

function endGame(reason) {
  if (gameMode === 'training') return;

  gameState.isGameOver = true;
  gameState.running = false;
  gameState.pendingGoalCountdown = false;
  gameState.countdownTimer = 0;
  gameState.goBannerTimer = 0;
  clearGoalBanner();
  updateCountdownOverlay();
  Sound.playWhistle();
  ECONOMY.recordMatch();

  finalScoreP1El.textContent = gameState.scoreP1;
  finalScoreP2El.textContent = gameState.scoreP2;
  finalBadgeP1.style.backgroundColor = playerConfig.color;
  const finalTeamNames = document.querySelectorAll('.final-team-name');
  finalTeamNames[0].textContent = gameMode === '2v2' ? 'Você + Parceiro' : 'Você';
  finalTeamNames[1].textContent = gameMode === '2v2' ? 'Dupla adversária' : 'Bot';

  let outcome;
  if (reason === 'p1_win_5_goals' || reason === 'p1_golden_goal') {
    outcome = 'win';
    gameOverTitle.textContent = 'VITÓRIA ÉPICA!';
    gameOverTitle.style.color = '#4ade80';
    gameOverReason.textContent = reason === 'p1_golden_goal'
      ? 'Sua dupla marcou o gol de ouro e venceu!'
      : `Você atingiu ${CONFIG.rules.goalsToWin} gols primeiro e conquistou a partida!`;
  } else if (reason === 'p2_win_5_goals' || reason === 'p2_golden_goal') {
    outcome = 'loss';
    gameOverTitle.textContent = 'DERROTA!';
    gameOverTitle.style.color = '#f87171';
    gameOverReason.textContent = reason === 'p2_golden_goal'
      ? 'A dupla adversária marcou o gol de ouro.'
      : `O Bot Vermelho atingiu ${CONFIG.rules.goalsToWin} gols primeiro.`;
  } else {
    if (gameState.scoreP1 > gameState.scoreP2) {
      outcome = 'win';
      gameOverTitle.textContent = 'VITÓRIA!';
      gameOverTitle.style.color = '#4ade80';
      gameOverReason.textContent = gameMode === '2v2'
        ? 'Sua dupla venceu a partida!'
        : 'O tempo regulamentar acabou e você venceu no placar!';
    } else if (gameState.scoreP2 > gameState.scoreP1) {
      outcome = 'loss';
      gameOverTitle.textContent = 'DERROTA!';
      gameOverTitle.style.color = '#f87171';
      gameOverReason.textContent = gameMode === '2v2'
        ? 'A dupla adversária venceu a partida.'
        : 'O tempo acabou e o Bot Vermelho marcou mais gols.';
    } else {
      outcome = 'draw';
      gameOverTitle.textContent = 'EMPATE!';
      gameOverTitle.style.color = '#fbbf24';
      gameOverReason.textContent = gameMode === '2v2'
        ? 'O gol de ouro não saiu. A partida terminou empatada.'
        : 'Partida muito disputada! Terminou em empate.';
    }
  }

  const baseReward = ECONOMY.REWARDS[outcome === 'win' ? 'win' : outcome === 'draw' ? 'draw' : 'loss'];
  const participationReward = gameMode === '2v2' ? 50 : 0;
  const winBonus = gameMode === '2v2' && outcome === 'win' ? 50 : 0;
  const goalsReward = gameState.scoreP1 * ECONOMY.REWARDS.perGoal;
  const challengeReward = gameMode === '2v2' && twoVtwoStats
    ? Object.values(twoVtwoStats.completed).reduce((sum, complete) => sum + (complete ? 25 : 0), 0)
    : 0;
  const totalReward = baseReward + participationReward + winBonus + goalsReward + challengeReward;
  const newBalance = ECONOMY.addCoins(totalReward);

  const resultLabel = outcome === 'win' ? 'Vitória' : outcome === 'draw' ? 'Empate' : 'Derrota';
  document.getElementById('reward-result-label').textContent = `${resultLabel}:`;
  document.getElementById('reward-result-val').textContent = `+${baseReward} 🪙`;
  document.getElementById('reward-goals-label').textContent = `${gameMode === '2v2' ? 'Gols da dupla' : 'Gols marcados'} (${gameState.scoreP1}×10):`;
  document.getElementById('reward-goals-val').textContent = `+${goalsReward} 🪙`;
  document.getElementById('reward-participation-row').hidden = gameMode !== '2v2';
  document.getElementById('reward-participation-val').textContent = `+${participationReward} 🪙`;
  document.getElementById('reward-win-row').hidden = winBonus === 0;
  document.getElementById('reward-win-val').textContent = `+${winBonus} 🪙`;
  document.getElementById('reward-challenges-row').hidden = gameMode !== '2v2';
  document.getElementById('reward-challenges-val').textContent = `+${challengeReward} 🪙`;

  const challengeNames = {
    passes: 'Completar 4 passes seguidos',
    twoOne: 'Completar uma tabela Toque e Passa',
    goalAfterMatePass: 'Marcar após receber do parceiro'
  };
  document.getElementById('two-v-two-challenges-summary').textContent = gameMode === '2v2' && twoVtwoStats
    ? `Desafios (25 litocoins cada):\n${Object.entries(challengeNames).map(([key, name]) => `${twoVtwoStats.completed[key] ? '✓' : '○'} ${name}`).join('\n')}`
    : '';
  document.getElementById('two-v-two-challenges-summary').hidden = gameMode !== '2v2';
  document.getElementById('reward-new-balance').textContent = `🪙 ${newBalance.toLocaleString('pt-BR')}`;

  const totalEl = document.getElementById('reward-total-val');
  totalEl.textContent = '+0 🪙';
  let counted = 0;
  const step = Math.max(1, Math.floor(totalReward / 30));
  const timer = setInterval(() => {
    counted = Math.min(counted + step, totalReward);
    totalEl.textContent = `+${counted} 🪙`;
    if (counted >= totalReward) clearInterval(timer);
  }, 40);

  updateCoinUI();
  gameOverOverlay.classList.remove('hidden');
  syncModalInertState();
}

function resetPositions() {
  snakeTackles.length = 0;
  if (typeof curveShots !== 'undefined') curveShots.length = 0;
  twoOneSelection = null;
  twoOnePlay = null;
  twoOneImpactTimer = 0;
  const p = CONFIG.pitch;

  if (gameMode === '2v2') {
    player1.reset(p.left + p.width * 0.30, p.centerY);
    homeMate.reset(p.left + p.width * 0.43, p.centerY + 82);
    player2.reset(p.right - p.width * 0.30, p.centerY + 5);
    awayMate.reset(p.right - p.width * 0.43, p.centerY - 82);
  } else if (gameMode === 'training') {
    trainingDummyHasBall = true;
    player1.reset(p.centerX - 200, p.centerY);
    player1.facingX = 1;
    player1.facingY = 0;
    homeMate.reset(p.centerX - 285, p.centerY + 105);
    player2.reset(p.centerX - 70, p.centerY);
    pinTrainingDummy();
    awayMate.reset(CONFIG.canvasWidth + 130, CONFIG.canvasHeight + 100);
  } else {
    player1.reset(260, 300);
    player2.reset(740, 300);
    homeMate.reset(CONFIG.canvasWidth + 100, CONFIG.canvasHeight + 100);
    awayMate.reset(CONFIG.canvasWidth + 130, CONFIG.canvasHeight + 100);
  }

  ball.reset(p.centerX, p.centerY);
  visionPassRoute = null;
  clearGoalBanner();
}

/* ==========================================================================
   MODO TREINO LIVRE
   ========================================================================== */

function copyEntityState(entity) {
  return JSON.parse(JSON.stringify(entity));
}

function restoreEntityReference(entity) {
  if (!entity) return null;
  return entity.isHuman ? player1 : entity.isAwayMate ? awayMate : entity.isTeammate ? homeMate : player2;
}

function pinTrainingDummy() {
  const p = CONFIG.pitch;
  player2.x = p.centerX - 70;
  player2.y = p.centerY;
  player2.vx = 0;
  player2.vy = 0;
  player2.facingX = -1;
  player2.facingY = 0;
}

function updateTrainingDummyBall() {
  if (gameMode !== 'training') return;
  const distance = Math.hypot(ball.x - player2.x, ball.y - player2.y);
  const speed = Math.hypot(ball.vx, ball.vy);
  const holdDistance = player2.radius + ball.radius + 4;
  if (ball.dribbleLockOwner === player1 || speed > 4.5 || distance > holdDistance + 65) {
    trainingDummyHasBall = false;
  } else if (!trainingDummyHasBall && !ball.dribbleLockOwner && speed < 0.8 && distance < 100 && player2.tackleStaggerTimer <= 0) {
    trainingDummyHasBall = true;
  }
  if (!trainingDummyHasBall) return;
  ball.x = player2.x - player2.radius - ball.radius - 4;
  ball.y = player2.y;
  ball.vx = 0;
  ball.vy = 0;
  ball.dribbleLockTimer = 1 / 60;
  ball.dribbleLockOwner = player2;
}

function beginTraining() {
  if (endGameTimerId) {
    clearTimeout(endGameTimerId);
    endGameTimerId = null;
  }
  trainingReturnMode = gameMode === '2v2' ? '2v2' : 'match';
  trainingMatchSnapshot = hasNormalMatchInProgress
    ? {
        game: {
          timeRemaining: gameState.timeRemaining,
          scoreP1: gameState.scoreP1,
          scoreP2: gameState.scoreP2,
          isGameOver: gameState.isGameOver,
          pausedForGoal: gameState.pausedForGoal,
          goalPauseTimer: gameState.goalPauseTimer,
          isOvertime: gameState.isOvertime,
          overtimeTimeRemaining: gameState.overtimeTimeRemaining
        },
        player1: copyEntityState(player1),
        player2: copyEntityState(player2),
        homeMate: copyEntityState(homeMate),
        awayMate: copyEntityState(awayMate),
        ball: copyEntityState(ball),
        twoOneSelection: twoOneSelection ? { timer: twoOneSelection.timer } : null,
        twoOnePlay: twoOnePlay ? { ...twoOnePlay, runDirection: { ...twoOnePlay.runDirection }, trail: twoOnePlay.trail.map(point => ({ ...point })) } : null,
        twoOneImpactTimer,
        twoVtwoStats: twoVtwoStats ? copyEntityState(twoVtwoStats) : null,
        snakeTackles: snakeTackles.map(serializeSnakeTackle)
      }
    : null;

  snakeTackles.length = 0;
  if (typeof curveShots !== 'undefined') curveShots.length = 0;
  setPitchLayout('match');
  gameMode = 'training';
  gameState.running = true;
  gameState.isGameOver = false;
  gameState.pausedForGoal = false;
  gameState.goalPauseTimer = 0;
  gameState.countdownTimer = 0;
  gameState.goBannerTimer = 0;
  gameState.physicsAccumulator = 0;
  clearGoalBanner();
  updateCountdownOverlay();

  refreshModeHud();
  twoOneSelection = null;
  twoOnePlay = null;
  twoOneImpactTimer = 0;
  trainingDummyHasBall = true;

  player1.reset(CONFIG.pitch.centerX - 200, CONFIG.pitch.centerY);
  player1.facingX = 1;
  player1.facingY = 0;
  player1.powerCooldown = 0;
  player1.powerEffect = null;
  player1.powerEffectTimer = 0;
  player1.nextKickPower = 1;
  player1.nextKickReach = 1;

  homeMate.reset(CONFIG.pitch.centerX - 285, CONFIG.pitch.centerY + 105);
  player2.reset(CONFIG.pitch.centerX - 70, CONFIG.pitch.centerY);
  pinTrainingDummy();
  player2.powerCooldown = 0;
  player2.aiPowerId = null;
  awayMate.reset(CONFIG.canvasWidth + 130, CONFIG.canvasHeight + 100);
  ball.reset(CONFIG.pitch.centerX, CONFIG.pitch.centerY);

  input.passRequested = false;
  input.kickRequested = false;

  document.getElementById('hud-score').hidden = true;
  timerEl.hidden = true;
  document.getElementById('hud-training-label').hidden = false;
  document.getElementById('name-p2').hidden = false;
  document.querySelectorAll('#hud .team-badge')[1].hidden = false;
  btnMenu.textContent = 'Voltar ao menu';
  btnRestart.textContent = 'Reiniciar treino';

  document.getElementById('power-hud').classList.toggle('hidden', !profile.equippedPower);
  menuOverlay.classList.add('hidden');
  gameOverOverlay.classList.add('hidden');
  menuWasRunning = false;
  syncModalInertState();

  gameState.lastTimestamp = performance.now();
  requestAnimationFrame(gameLoop);
}

function leaveTraining() {
  gameState.running = false;
  gameState.pausedForGoal = false;
  gameState.goalPauseTimer = 0;
  gameState.countdownTimer = 0;
  gameState.goBannerTimer = 0;
  clearGoalBanner();
  updateCountdownOverlay();
  trainingDummyHasBall = false;
  gameMode = trainingReturnMode;
  setPitchLayout(gameMode);

  const hadMatchSnapshot = !!trainingMatchSnapshot;
  document.getElementById('hud-score').hidden = false;
  timerEl.hidden = false;
  document.getElementById('hud-training-label').hidden = true;
  document.getElementById('name-p2').hidden = false;
  document.querySelectorAll('#hud .team-badge')[1].hidden = false;
  refreshModeHud();
  btnMenu.textContent = 'Menu';
  btnRestart.textContent = 'Reset';

  if (trainingMatchSnapshot) {
    const snapshot = trainingMatchSnapshot;
    Object.assign(player1, snapshot.player1);
    Object.assign(player2, snapshot.player2);
    Object.assign(homeMate, snapshot.homeMate);
    Object.assign(awayMate, snapshot.awayMate);
    Object.assign(ball, snapshot.ball);
    if (ball.dribbleLockOwner && !(ball.dribbleLockOwner instanceof Player)) {
      ball.dribbleLockOwner = ball.dribbleLockOwner.isTeammate
        ? homeMate
        : ball.dribbleLockOwner.isHuman
          ? player1
          : ball.dribbleLockOwner.isAwayMate
            ? awayMate
            : player2;
    }
    Object.assign(gameState, snapshot.game);
    twoOneSelection = snapshot.twoOneSelection ? { ...snapshot.twoOneSelection, target: homeMate } : null;
    twoOnePlay = snapshot.twoOnePlay ? { ...snapshot.twoOnePlay, target: homeMate } : null;
    twoOneImpactTimer = snapshot.twoOneImpactTimer || 0;
    twoVtwoStats = snapshot.twoVtwoStats;
    snakeTackles.splice(0, snakeTackles.length, ...(snapshot.snakeTackles || []).map(restoreSnakeTackle));
    trainingMatchSnapshot = null;
    ball.passTarget = restoreEntityReference(ball.passTarget);
    ball.passSource = restoreEntityReference(ball.passSource);
    scoreP1El.textContent = gameState.scoreP1;
    scoreP2El.textContent = gameState.scoreP2;
    updateTimerDisplay();
  }

  document.getElementById('power-hud').classList.add('hidden');
  menuWasRunning = hadMatchSnapshot && !gameState.isGameOver;
}

function resetTraining() {
  snakeTackles.length = 0;
  if (typeof curveShots !== 'undefined') curveShots.length = 0;
  twoOneSelection = null;
  twoOnePlay = null;
  twoOneImpactTimer = 0;
  gameState.pausedForGoal = false;
  gameState.goalPauseTimer = 0;
  gameState.countdownTimer = 0;
  gameState.goBannerTimer = 0;
  clearGoalBanner();
  updateCountdownOverlay();
  trainingDummyHasBall = true;

  player1.reset(CONFIG.pitch.centerX - 200, CONFIG.pitch.centerY);
  player1.facingX = 1;
  player1.facingY = 0;
  player1.powerCooldown = 0;
  player1.powerEffect = null;
  player1.powerEffectTimer = 0;
  player1.nextKickPower = 1;
  player1.nextKickReach = 1;

  homeMate.reset(CONFIG.pitch.centerX - 285, CONFIG.pitch.centerY + 105);
  player2.reset(CONFIG.pitch.centerX - 70, CONFIG.pitch.centerY);
  pinTrainingDummy();
  player2.powerCooldown = 0;
  player2.aiPowerId = null;
  player2.nextKickPower = 1;
  player2.nextKickReach = 1;
  awayMate.reset(CONFIG.canvasWidth + 130, CONFIG.canvasHeight + 100);
  ball.reset(CONFIG.pitch.centerX, CONFIG.pitch.centerY);
}

function refreshModeHud() {
  document.getElementById('name-p1').textContent = gameMode === '2v2' ? 'Você + Parceiro' : 'Você';
  document.getElementById('name-p2').textContent = gameMode === 'training'
    ? 'Adversário de Treino'
    : gameMode === '2v2'
      ? 'Dupla Vermelha'
      : 'Bot Vermelho';
  badgeP1.style.backgroundColor = playerConfig.color;
  document.querySelectorAll('#hud .team-badge')[1].style.backgroundColor = '#e53935';
  document.getElementById('hud-training-label').textContent = 'Treino livre · adversário parado';
}

function startFreshMatch(mode = 'match') {
  if (endGameTimerId) {
    clearTimeout(endGameTimerId);
    endGameTimerId = null;
  }
  gameMode = mode === '2v2' ? '2v2' : 'match';
  setPitchLayout(gameMode);
  trainingMatchSnapshot = null;
  hasNormalMatchInProgress = true;
  clearGoalBanner();

  input.passRequested = false;
  input.kickRequested = false;
  input.up = false;
  input.down = false;
  input.left = false;
  input.right = false;

  gameState.scoreP1 = 0;
  gameState.scoreP2 = 0;
  gameState.timeRemaining = CONFIG.rules.matchDurationSeconds;
  gameState.isGameOver = false;
  gameState.pausedForGoal = false;
  gameState.goalPauseTimer = 0;
  gameState.isOvertime = false;
  gameState.overtimeTimeRemaining = 60;
  gameState.pendingGoalCountdown = false;
  triggerCountdown(3.0);
  twoVtwoStats = gameMode === '2v2' ? newTwoVtwoStats() : null;

  player1.powerCooldown = 0;
  player1.powerEffect = null;
  player1.powerEffectTimer = 0;
  player1.nextKickPower = 1;
  player1.nextKickReach = 1;
  for (const bot of [homeMate, awayMate, player2]) {
    bot.powerCooldown = 0;
    bot.powerEffect = null;
    bot.powerEffectTimer = 0;
    bot.aiPowerThink = 6 + Math.random() * 3;
    bot.aiPowerId = null;
    bot.nextKickPower = 1;
    bot.nextKickReach = 1;
  }

  scoreP1El.textContent = '0';
  scoreP2El.textContent = '0';
  updateTimerDisplay();
  gameOverOverlay.classList.add('hidden');
  document.getElementById('hud-score').hidden = false;
  timerEl.hidden = false;
  document.getElementById('hud-training-label').hidden = true;
  document.getElementById('name-p2').hidden = false;
  document.querySelectorAll('#hud .team-badge')[1].hidden = false;
  btnMenu.textContent = 'Menu';
  btnRestart.textContent = 'Reset';
  refreshModeHud();
  resetPositions();
  updateCoinUI();
  updatePowerHud();
  updateCountdownOverlay();
  syncModalInertState();
}

/* ==========================================================================
   RENDERIZAÇÃO DO CAMPO E REDES
   ========================================================================== */

function drawGoalNets(renderCtx) {
  const p = CONFIG.pitch;
  const g = CONFIG.goals;
  const step = 8;

  renderCtx.save();
  renderCtx.lineWidth = 1.2;
  renderCtx.strokeStyle = CONFIG.goals.netColor;

  // Rede Esquerda
  const leftNetX = p.left - g.depth;
  renderCtx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  renderCtx.fillRect(leftNetX, g.topY, g.depth, g.bottomY - g.topY);

  for (let y = g.topY; y <= g.bottomY; y += step) {
    renderCtx.beginPath();
    renderCtx.moveTo(p.left, y);
    renderCtx.lineTo(leftNetX, y);
    renderCtx.stroke();
  }
  for (let x = leftNetX; x <= p.left; x += step) {
    renderCtx.beginPath();
    renderCtx.moveTo(x, g.topY);
    renderCtx.lineTo(x, g.bottomY);
    renderCtx.stroke();
  }
  renderCtx.strokeStyle = '#ffffff';
  renderCtx.lineWidth = 2.5;
  renderCtx.strokeRect(leftNetX, g.topY, g.depth, g.bottomY - g.topY);

  // Rede Direita
  const rightNetX = p.right;
  renderCtx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  renderCtx.fillRect(rightNetX, g.topY, g.depth, g.bottomY - g.topY);

  renderCtx.strokeStyle = CONFIG.goals.netColor;
  renderCtx.lineWidth = 1.2;
  for (let y = g.topY; y <= g.bottomY; y += step) {
    renderCtx.beginPath();
    renderCtx.moveTo(p.right, y);
    renderCtx.lineTo(p.right + g.depth, y);
    renderCtx.stroke();
  }
  for (let x = p.right; x <= p.right + g.depth; x += step) {
    renderCtx.beginPath();
    renderCtx.moveTo(x, g.topY);
    renderCtx.lineTo(x, g.bottomY);
    renderCtx.stroke();
  }
  renderCtx.strokeStyle = '#ffffff';
  renderCtx.lineWidth = 2.5;
  renderCtx.strokeRect(rightNetX, g.topY, g.depth, g.bottomY - g.topY);

  renderCtx.restore();
}

function drawPitch(renderCtx) {
  const p = CONFIG.pitch;

  if (assets.hasSprite('pitchTexture')) {
    renderCtx.drawImage(assets.sprites.pitchTexture, 0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
    return;
  }

  renderCtx.fillStyle = '#1c241c';
  renderCtx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

  renderCtx.fillStyle = '#2f7d3d';
  renderCtx.fillRect(p.left, p.top, p.width, p.height);

  const stripeWidth = 55;
  const numStripes = Math.ceil(p.width / stripeWidth);
  for (let i = 0; i < numStripes; i++) {
    if (i % 2 === 1) {
      renderCtx.fillStyle = '#2b7438';
      const sx = p.left + i * stripeWidth;
      const sw = Math.min(stripeWidth, p.right - sx);
      renderCtx.fillRect(sx, p.top, sw, p.height);
    }
  }

  renderCtx.strokeStyle = '#ffffff';
  renderCtx.lineWidth = p.lineWidth;
  renderCtx.lineCap = 'round';
  renderCtx.lineJoin = 'round';

  renderCtx.strokeRect(p.left, p.top, p.width, p.height);

  renderCtx.beginPath();
  renderCtx.moveTo(p.centerX, p.top);
  renderCtx.lineTo(p.centerX, p.bottom);
  renderCtx.stroke();

  renderCtx.beginPath();
  renderCtx.arc(p.centerX, p.centerY, p.centerRadius, 0, Math.PI * 2);
  renderCtx.stroke();

  renderCtx.beginPath();
  renderCtx.arc(p.centerX, p.centerY, 4.5, 0, Math.PI * 2);
  renderCtx.fillStyle = '#ffffff';
  renderCtx.fill();

  const paTop = p.centerY - p.penaltyHeight / 2;
  renderCtx.strokeRect(p.left, paTop, p.penaltyWidth, p.penaltyHeight);
  renderCtx.strokeRect(p.right - p.penaltyWidth, paTop, p.penaltyWidth, p.penaltyHeight);

  const gaTop = p.centerY - p.goalAreaHeight / 2;
  renderCtx.strokeRect(p.left, gaTop, p.goalAreaWidth, p.goalAreaHeight);
  renderCtx.strokeRect(p.right - p.goalAreaWidth, gaTop, p.goalAreaWidth, p.goalAreaHeight);

  renderCtx.beginPath();
  renderCtx.arc(p.left + 85, p.centerY, 3.5, 0, Math.PI * 2);
  renderCtx.arc(p.right - 85, p.centerY, 3.5, 0, Math.PI * 2);
  renderCtx.fillStyle = '#ffffff';
  renderCtx.fill();

  drawGoalNets(renderCtx);
}

/* ==========================================================================
   LOOP PRINCIPAL COM FIXED TIMESTEP (60 FPS DETERMINÍSTICO)
   ========================================================================== */

function physicsStep(dt) {
  if (gameState.isGameOver) return;

  if (gameMode === 'training') {
    clearGoalBanner();
  } else if (gameState.countdownTimer > 0) {
    const ceilSec = Math.ceil(gameState.countdownTimer);
    if (ceilSec >= 1 && ceilSec < gameState.lastCountdownBeep) {
      gameState.lastCountdownBeep = ceilSec;
      Sound.playCountdownTick(false);
    }
    gameState.countdownTimer = Math.max(0, gameState.countdownTimer - dt);
    if (gameState.countdownTimer === 0) {
      gameState.goBannerTimer = 0.72;
      Sound.playCountdownTick(true);
    }
    input.kickRequested = false;
    input.passRequested = false;
    updateCountdownOverlay();
    return;
  } else {
    if (gameState.goBannerTimer > 0) {
      gameState.goBannerTimer = Math.max(0, gameState.goBannerTimer - dt);
      updateCountdownOverlay();
    }
    if (!gameState.pausedForGoal) {
      if (gameMode === '2v2' && gameState.isOvertime) {
        gameState.overtimeTimeRemaining -= dt;
        if (gameState.overtimeTimeRemaining <= 0) {
          gameState.overtimeTimeRemaining = 0;
          updateTimerDisplay();
          endGame('time_out');
          return;
        }
      } else {
        gameState.timeRemaining -= dt;
        if (gameState.timeRemaining <= 0) {
          gameState.timeRemaining = 0;
          updateTimerDisplay();
          if (gameMode === '2v2' && gameState.scoreP1 === gameState.scoreP2) {
            beginGoldenGoal();
            return;
          }
          endGame('time_out');
          return;
        }
      }
      updateTimerDisplay();
    } else {
      gameState.goalPauseTimer -= dt;
      if (gameState.goalPauseTimer <= 0) {
        gameState.pausedForGoal = false;
        resetPositions();
        if (gameState.pendingGoalCountdown && !gameState.isGameOver && gameMode !== 'training') {
          gameState.pendingGoalCountdown = false;
          triggerCountdown(3.0);
          return;
        }
      }
    }
  }

  let moveX = 0;
  let moveY = 0;
  if (!twoOnePlay && input.left) moveX -= 1;
  if (!twoOnePlay && input.right) moveX += 1;
  if (!twoOnePlay && input.up) moveY -= 1;
  if (!twoOnePlay && input.down) moveY += 1;

  if (moveX !== 0 && moveY !== 0) {
    const inv = 1 / Math.SQRT2;
    moveX *= inv;
    moveY *= inv;
  }

  const moveLength = Math.hypot(moveX, moveY);
  if (moveLength > 0.1) {
    player1.facingX = moveX / moveLength;
    player1.facingY = moveY / moveLength;
  }

  if (!gameState.pausedForGoal) {
    updateSnakeTackles(dt);
    if (typeof updateCurveEffects === 'function') updateCurveEffects(dt);
  }

  if (player1.powerEffect === 'shadow') {
    const opponents = gameMode === '2v2' ? [player2, awayMate] : [player2];
    const marker = opponents.slice().sort((a, b) =>
      Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y)
    )[0];
    if (marker) {
      // Mira posição de marcação entre o adversário e o próprio gol esquerdo
      const guardX = Math.max(CONFIG.pitch.left + player1.radius, marker.x - 24);
      const guardY = marker.y + (CONFIG.pitch.centerY - marker.y) * 0.08;
      const dx = guardX - player1.x;
      const dy = guardY - player1.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 6) {
        moveX += (dx / d) * 0.62;
        moveY += (dy / d) * 0.62;
      }
    }
  }

  if (!gameState.pausedForGoal) {
    const accelMult = player1.powerEffect === 'ego' ? 1.26 : player1.powerEffect === 'shadow' ? 1.10 : 1.0;
    player1.vx += moveX * CONFIG.physics.playerAcceleration * accelMult;
    player1.vy += moveY * CONFIG.physics.playerAcceleration * accelMult;

    if (input.passRequested) {
      input.passRequested = false;
      if (twoOnePlay) {
        // aguarda conclusão da tabela
      } else if (twoOneSelection) {
        confirmTwoOneSelection();
      } else {
        const teammate = nearestPassTeammate(player1);
        const teammateDistance = teammate ? Math.hypot(teammate.x - player1.x, teammate.y - player1.y) : Infinity;
        if (!teammate || teammateDistance > 320) {
          showPowerFeedback('Nenhum aliado próximo para receber o passe', true);
        } else if (isVisionPassLaneBlocked()) {
          showPowerFeedback('Linha de passe bloqueada', true);
        } else {
          const passed = player1.tryKick(ball, moveX, moveY, true, teammate);
          if (!passed) {
            showPowerFeedback(player1.kickCooldownTimer > 0 ? 'Aguarde para passar' : 'Chegue perto da bola para passar', true);
          }
        }
      }
    } else if (input.kickRequested && !twoOnePlay) {
      player1.tryKick(ball, moveX, moveY);
    }

    if (gameMode === '2v2') {
      updatePowerBot(dt, homeMate);
      updateHomeMateAI(dt);
      updateAI(dt);
      updateAwayMateAI(dt);
    } else if (gameMode === 'match') {
      updateAI(dt);
    } else if (twoOnePlay?.target === homeMate) {
      updateHomeMateAI(dt);
    }
  }

  if (twoOnePlay && twoOnePlay.runTimer > 0) {
    const d = twoOnePlay.runDirection;
    player1.vx += d.x * CONFIG.physics.playerAcceleration * 1.8;
    player1.vy += d.y * CONFIG.physics.playerAcceleration * 1.8;
    player1.twoOneRunTimer = twoOnePlay.runTimer;
    twoOnePlay.runTimer = Math.max(0, twoOnePlay.runTimer - dt);
  }

  player1.update(dt);
  if (gameMode === 'training' || gameMode === '2v2') homeMate.update(dt);
  player2.update(dt);
  if (gameMode === 'training') pinTrainingDummy();
  if (gameMode === '2v2') awayMate.update(dt);

  updatePlayerDribbleControl(player1);
  if (gameMode === 'training' || gameMode === '2v2') updatePlayerDribbleControl(homeMate);
  if (gameMode !== 'training') updatePlayerDribbleControl(player2);
  if (gameMode === '2v2') updatePlayerDribbleControl(awayMate);

  updatePhantomBallCarry(player1);
  if (gameMode !== 'training') updatePhantomBallCarry(player2);
  if (gameMode === '2v2') {
    updatePhantomBallCarry(homeMate);
    updatePhantomBallCarry(awayMate);
  }

  updateVisionPassAssist(dt);
  updateTwoOneReturnAssist(dt);

  if (player1.dashTimer > 0) addLightningTrail(player1);
  if (gameMode === '2v2') {
    if (homeMate.dashTimer > 0) addLightningTrail(homeMate);
    if (player2.dashTimer > 0) addLightningTrail(player2);
    if (awayMate.dashTimer > 0) addLightningTrail(awayMate);
  }
  if (player1.powerEffect === 'phantom' && player1.powerEffectTimer > 0 && player1.ghostTrailTimer <= 0) {
    addPhantomShadow(player1);
    player1.ghostTrailTimer = 0.055;
  }

  ball.update();

  resolveCircleCollision(player1, player2, CONFIG.physics.restitutionPlayer);
  if (gameMode === 'training' || gameMode === '2v2') resolveCircleCollision(player1, homeMate, CONFIG.physics.restitutionPlayer);
  if (gameMode === '2v2') {
    resolveCircleCollision(player1, awayMate, CONFIG.physics.restitutionPlayer);
    resolveCircleCollision(player2, homeMate, CONFIG.physics.restitutionPlayer);
    resolveCircleCollision(player2, awayMate, CONFIG.physics.restitutionPlayer);
    resolveCircleCollision(homeMate, awayMate, CONFIG.physics.restitutionPlayer);
  }

  if (gameMode === 'training') {
    pinTrainingDummy();
    updateTrainingDummyBall();
  }

  if (player1.ignoreBallCollisionFrames <= 0) {
    if (shouldBallContact(player1, [player2, ...(gameMode === '2v2' ? [awayMate] : [])])) {
      resolveCircleCollision(player1, ball, CONFIG.physics.restitutionBall);
    }
  }
  if (player2.ignoreBallCollisionFrames <= 0) {
    if (shouldBallContact(player2, [player1, ...(gameMode === '2v2' ? [homeMate] : [])])) {
      resolveCircleCollision(player2, ball, CONFIG.physics.restitutionBall);
    }
  }
  if ((gameMode === 'training' || gameMode === '2v2') && homeMate.ignoreBallCollisionFrames <= 0 && shouldBallContact(homeMate, [player2, ...(gameMode === '2v2' ? [awayMate] : [])])) {
    resolveCircleCollision(homeMate, ball, CONFIG.physics.restitutionBall);
  }
  if (gameMode === '2v2' && awayMate.ignoreBallCollisionFrames <= 0 && shouldBallContact(awayMate, [player1, homeMate])) {
    resolveCircleCollision(awayMate, ball, CONFIG.physics.restitutionBall);
  }

  for (let i = 0; i < posts.length; i++) {
    resolveCirclePostCollision(ball, posts[i], CONFIG.physics.restitutionWall);
    resolveCirclePostCollision(player1, posts[i], 0.35);
    if (gameMode === 'training' || gameMode === '2v2') resolveCirclePostCollision(homeMate, posts[i], 0.35);
    resolveCirclePostCollision(player2, posts[i], 0.35);
    if (gameMode === '2v2') resolveCirclePostCollision(awayMate, posts[i], 0.35);
  }

  for (let i = 0; i < netSegmentsForPlayers.length; i++) {
    const seg = netSegmentsForPlayers[i];
    resolveCircleSegment(player1, seg.x1, seg.y1, seg.x2, seg.y2, 0.2);
    if (gameMode === 'training' || gameMode === '2v2') resolveCircleSegment(homeMate, seg.x1, seg.y1, seg.x2, seg.y2, 0.2);
    resolveCircleSegment(player2, seg.x1, seg.y1, seg.x2, seg.y2, 0.2);
    if (gameMode === '2v2') resolveCircleSegment(awayMate, seg.x1, seg.y1, seg.x2, seg.y2, 0.2);
  }

  resolveBallBoundaries(ball);
  updateTwoOneState(dt);
  updateTwoVtwoPassProgress(dt);

  if (gameMode === 'training') {
    const p = CONFIG.pitch;
    const speed = Math.hypot(ball.vx, ball.vy);
    const tooFar =
      Math.hypot(ball.x - player1.x, ball.y - player1.y) > 360 &&
      Math.hypot(ball.x - homeMate.x, ball.y - homeMate.y) > 300 &&
      Math.hypot(ball.x - player2.x, ball.y - player2.y) > 300;
    if (ball.x < p.left || ball.x > p.right || ball.y < p.top || ball.y > p.bottom || (speed < 0.18 && tooFar)) {
      ball.reset(p.centerX, p.centerY);
    }
  } else {
    checkGoal();
  }
}

function gameLoop(timestamp) {
  if (!gameState.running) return;

  if (!gameState.lastTimestamp) gameState.lastTimestamp = timestamp;
  let elapsed = (timestamp - gameState.lastTimestamp) / 1000;
  if (elapsed > 0.1) elapsed = 0.1;
  gameState.lastTimestamp = timestamp;

  const fixedDelta = CONFIG.physics.fixedDelta;
  gameState.physicsAccumulator += elapsed;

  while (gameState.physicsAccumulator >= fixedDelta) {
    physicsStep(fixedDelta);
    gameState.physicsAccumulator -= fixedDelta;
  }

  ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  drawPitch(ctx);
  drawVisionPuzzleOverlay(ctx);
  drawTwoVtwoVisionGuidance(ctx);

  for (let i = 0; i < posts.length; i++) posts[i].draw(ctx);
  updateAndDrawParticles(ctx);
  updateAndDrawPhantomShadows(ctx);
  updateAndDrawLightningTrails(ctx);
  drawSnakeTackles(ctx);
  if (typeof drawCurveEffects === 'function') drawCurveEffects(ctx);
  drawTwoOneVisuals(ctx);
  drawSkillAuras(ctx);
  ball.draw(ctx);
  player1.draw(ctx);
  if (gameMode === 'training' || gameMode === '2v2') homeMate.draw(ctx);
  player2.draw(ctx);
  if (gameMode === '2v2') awayMate.draw(ctx);
  updatePowerHud();

  requestAnimationFrame(gameLoop);
}

/* ==========================================================================
   EVENTOS DOS BOTÕES DE PARTIDA E INICIALIZAÇÃO
   ========================================================================== */

startBtn.addEventListener('click', () => {
  Sound.init();
  menuWasRunning = false;
  refreshResumeSlot();
  menuOverlay.classList.add('hidden');
  startFreshMatch('match');
  document.getElementById('power-hud').classList.toggle('hidden', !profile.equippedPower);
  syncModalInertState();
  if (!gameState.running) {
    gameState.running = true;
    gameState.lastTimestamp = performance.now();
    requestAnimationFrame(gameLoop);
  }
});

twoVtwoStartBtn.addEventListener('click', () => {
  Sound.init();
  menuWasRunning = false;
  refreshResumeSlot();
  menuOverlay.classList.add('hidden');
  startFreshMatch('2v2');
  document.getElementById('power-hud').classList.toggle('hidden', !profile.equippedPower);
  syncModalInertState();
  gameState.running = true;
  gameState.lastTimestamp = performance.now();
  requestAnimationFrame(gameLoop);
});

playAgainBtn.addEventListener('click', () => {
  Sound.init();
  startFreshMatch(gameMode === '2v2' ? '2v2' : 'match');
  document.getElementById('power-hud').classList.toggle('hidden', !profile.equippedPower);
  syncModalInertState();
  if (!gameState.running) {
    gameState.running = true;
    gameState.lastTimestamp = performance.now();
    requestAnimationFrame(gameLoop);
  }
});

btnMenu.addEventListener('click', () => {
  if (gameMode === 'training') {
    leaveTraining();
  } else if (gameState.running) {
    menuWasRunning = true;
    gameState.running = false;
    document.getElementById('power-hud').classList.add('hidden');
    document.getElementById('countdown-overlay')?.classList.add('hidden');
  }
  closeFeaturePage();
  menuOverlay.classList.remove('hidden');
  refreshResumeSlot();
  updateCoinUI();
  syncModalInertState();
});

btnRestart.addEventListener('click', () => {
  if (gameMode === 'training') resetTraining();
  else startFreshMatch(gameMode === '2v2' ? '2v2' : 'match');
});

const gameOverMenuBtn = document.getElementById('game-over-menu-btn');
if (gameOverMenuBtn) {
  gameOverMenuBtn.addEventListener('click', () => {
    menuWasRunning = false;
    hasNormalMatchInProgress = false;
    refreshResumeSlot();
    gameOverOverlay.classList.add('hidden');
    closeFeaturePage();
    menuOverlay.classList.remove('hidden');
    updateCoinUI();
    syncModalInertState();
  });
}

// Inicialização Geral
setPitchLayout('match');
initUI();
drawPitch(ctx);
for (let i = 0; i < posts.length; i++) posts[i].draw(ctx);
ball.draw(ctx);
player1.draw(ctx);
player2.draw(ctx);
