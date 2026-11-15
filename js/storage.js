/**
 * ==========================================================================
 * LITO BALL - PERSISTÊNCIA, ECONOMIA, PERFIL E CONTROLES (js/storage.js)
 * ==========================================================================
 */
'use strict';

const ECONOMY = {
  LS_KEY_COINS: 'litoBall_coins',
  LS_KEY_STATS: 'litoBall_stats',
  LS_KEY_PROFILE: 'litoBall_profile',
  LS_KEY_CONTROLS: 'litoBall_controls',
  WELCOME_BONUS: 500000,

  REWARDS: {
    win: 100,
    draw: 40,
    loss: 20,
    perGoal: 10
  },

  /** Carrega saldo salvo ou inicializa com bônus de boas-vindas (apenas 1ª vez) */
  load() {
    if (localStorage.getItem(this.LS_KEY_COINS) === null) {
      localStorage.setItem(this.LS_KEY_COINS, this.WELCOME_BONUS);
      const stats = { totalEarned: this.WELCOME_BONUS, matchesPlayed: 0 };
      localStorage.setItem(this.LS_KEY_STATS, JSON.stringify(stats));
    }
    if (localStorage.getItem('litoBall_testCreditApplied') !== 'yes') {
      const balance = this.getCoins();
      if (balance < this.WELCOME_BONUS) {
        const credit = this.WELCOME_BONUS - balance;
        localStorage.setItem(this.LS_KEY_COINS, this.WELCOME_BONUS);
        try {
          const stats = JSON.parse(localStorage.getItem(this.LS_KEY_STATS) || '{}');
          stats.totalEarned = (stats.totalEarned || 0) + credit;
          localStorage.setItem(this.LS_KEY_STATS, JSON.stringify(stats));
        } catch (e) {}
      }
      localStorage.setItem('litoBall_testCreditApplied', 'yes');
    }
  },

  /** Retorna saldo atual como número inteiro */
  getCoins() {
    return parseInt(localStorage.getItem(this.LS_KEY_COINS) || '0', 10);
  },

  profile() {
    const fallback = {
      ownedShirts: ['classic'],
      ownedPowers: [],
      powerLevels: {},
      equippedShirt: 'classic',
      equippedPower: null,
      volume: 70,
      muted: false,
      color: '#2b70f6',
      number: 10,
      controls: { ...DEFAULT_CONTROLS }
    };
    try {
      const raw = localStorage.getItem(this.LS_KEY_PROFILE);
      if (!raw) return fallback;
      return { ...fallback, ...JSON.parse(raw) };
    } catch (e) {
      return fallback;
    }
  },

  saveProfile(nextProfile) {
    localStorage.setItem(this.LS_KEY_PROFILE, JSON.stringify(nextProfile));
  },

  /** Adiciona moedas, persiste e retorna novo saldo */
  addCoins(amount) {
    if (amount <= 0) return this.getCoins();
    const newBal = this.getCoins() + amount;
    localStorage.setItem(this.LS_KEY_COINS, newBal);
    try {
      const stats = JSON.parse(localStorage.getItem(this.LS_KEY_STATS) || '{}');
      stats.totalEarned = (stats.totalEarned || 0) + amount;
      localStorage.setItem(this.LS_KEY_STATS, JSON.stringify(stats));
    } catch (e) {}
    return newBal;
  },

  /** Gasta moedas — retorna false se saldo insuficiente */
  spendCoins(amount) {
    const bal = this.getCoins();
    if (bal < amount) return false;
    localStorage.setItem(this.LS_KEY_COINS, bal - amount);
    return true;
  },

  /** Incrementa partidas jogadas no histórico */
  recordMatch() {
    try {
      const stats = JSON.parse(localStorage.getItem(this.LS_KEY_STATS) || '{}');
      stats.matchesPlayed = (stats.matchesPlayed || 0) + 1;
      localStorage.setItem(this.LS_KEY_STATS, JSON.stringify(stats));
    } catch (e) {}
  }
};

// Inicializa a economia ao carregar
ECONOMY.load();

let profile = ECONOMY.profile();
profile.ownedShirts = profile.ownedShirts || ['classic'];
profile.ownedPowers = profile.ownedPowers || [];
profile.powerLevels = profile.powerLevels || {};

let playerConfig = {
  color: profile.color || '#2b70f6',
  number: profile.number || 10
};

function isValidRemapCode(code, otherCode) {
  if (!code || typeof code !== 'string') return false;
  if (RESERVED_KEYS.includes(code)) return false;
  if (otherCode && code === otherCode) return false;
  return true;
}

function loadControls() {
  let saved = null;
  try {
    const raw = localStorage.getItem(ECONOMY.LS_KEY_CONTROLS);
    if (raw) saved = JSON.parse(raw);
  } catch (e) {}
  if (!saved && profile.controls) saved = profile.controls;

  let kickKey = saved?.kickKey || DEFAULT_CONTROLS.kickKey;
  let powerKey = saved?.powerKey || DEFAULT_CONTROLS.powerKey;

  if (!isValidRemapCode(kickKey, null)) kickKey = DEFAULT_CONTROLS.kickKey;
  if (!isValidRemapCode(powerKey, kickKey)) {
    powerKey = kickKey === DEFAULT_CONTROLS.powerKey ? 'KeyE' : DEFAULT_CONTROLS.powerKey;
  }

  return { kickKey, powerKey };
}

let controlsConfig = loadControls();

function saveControls(nextControls) {
  controlsConfig = {
    kickKey: nextControls.kickKey || DEFAULT_CONTROLS.kickKey,
    powerKey: nextControls.powerKey || DEFAULT_CONTROLS.powerKey
  };
  localStorage.setItem(ECONOMY.LS_KEY_CONTROLS, JSON.stringify(controlsConfig));
  profile.controls = { ...controlsConfig };
  ECONOMY.saveProfile(profile);
}

function resetControls() {
  saveControls({ ...DEFAULT_CONTROLS });
}

/** Atualiza todos os displays de moedas na tela (HUD + Menu) */
function updateCoinUI() {
  const bal = ECONOMY.getCoins();
  const formatted = bal.toLocaleString('pt-BR');
  const hudEl = document.getElementById('hud-coin-count');
  const menuEl = document.getElementById('menu-coin-count');
  if (hudEl) hudEl.textContent = formatted;
  if (menuEl) menuEl.textContent = formatted;
  const pageBalance = document.getElementById('page-coin-count');
  if (pageBalance) pageBalance.textContent = formatted;
}

function persistProfile() {
  profile.color = playerConfig.color;
  profile.number = playerConfig.number;
  profile.controls = { ...controlsConfig };
  ECONOMY.saveProfile(profile);
  updateCoinUI();
  if (typeof updatePowerHud === 'function') updatePowerHud();
}
