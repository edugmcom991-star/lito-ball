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
      pitchTheme: 'classic',
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

/* ==========================================================================
   SISTEMA DE MISSÕES (DIÁRIAS, SEMANAIS E DE VIDA)
   ========================================================================== */

const MISSIONS = {
  LS_KEY: 'litoBall_missions',

  getLocalDateKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  getLocalWeekKey() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    // Âncora na segunda-feira da semana local
    const dayOffset = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dayOffset);
    const y = d.getFullYear();
    const jan1 = new Date(y, 0, 1);
    const diffDays = Math.floor((d - jan1) / 86400000);
    const weekNum = Math.floor(diffDays / 7) + 1;
    return `${y}-W${String(weekNum).padStart(2, '0')}`;
  },

  _freshBucket() {
    return { progress: {}, claimed: {} };
  },

  load() {
    const todayKey = this.getLocalDateKey();
    const weekKey = this.getLocalWeekKey();
    let data = null;
    try {
      const raw = localStorage.getItem(this.LS_KEY);
      if (raw) data = JSON.parse(raw);
    } catch (e) {}

    if (!data || typeof data !== 'object') {
      data = {
        dailyKey: todayKey,
        weeklyKey: weekKey,
        daily: this._freshBucket(),
        weekly: this._freshBucket(),
        lifetime: this._freshBucket()
      };
    }

    let changed = false;
    if (data.dailyKey !== todayKey || !data.daily) {
      data.dailyKey = todayKey;
      data.daily = this._freshBucket();
      changed = true;
    }
    if (data.weeklyKey !== weekKey || !data.weekly) {
      data.weeklyKey = weekKey;
      data.weekly = this._freshBucket();
      changed = true;
    }
    if (!data.lifetime) {
      data.lifetime = this._freshBucket();
      changed = true;
    }

    for (const tab of ['daily', 'weekly', 'lifetime']) {
      data[tab].progress = data[tab].progress || {};
      data[tab].claimed = data[tab].claimed || {};
    }

    // Sincroniza desbloqueios da loja na missão de carreira
    const ownedCount =
      (Array.isArray(profile.ownedShirts) ? profile.ownedShirts.filter(s => s !== 'classic').length : 0) +
      (Array.isArray(profile.ownedPowers) ? profile.ownedPowers.length : 0);
    if ((data.lifetime.progress.l_unlock_3 || 0) < ownedCount) {
      data.lifetime.progress.l_unlock_3 = ownedCount;
      changed = true;
    }

    if (changed) {
      localStorage.setItem(this.LS_KEY, JSON.stringify(data));
    }
    return data;
  },

  save(data) {
    localStorage.setItem(this.LS_KEY, JSON.stringify(data));
    updateMissionsBadgeUI();
  },

  increment(tab, id, amount = 1) {
    if (amount <= 0) return;
    const data = this.load();
    const bucket = data[tab];
    if (!bucket) return;
    bucket.progress[id] = (bucket.progress[id] || 0) + amount;
    this.save(data);
  },

  syncUnlockCount() {
    this.load();
    updateMissionsBadgeUI();
  },

  recordGoal(mode) {
    if (mode !== 'match' && mode !== '2v2') return;
    this.increment('daily', 'd_goals_5', 1);
    this.increment('weekly', 'w_goals_25', 1);
    this.increment('lifetime', 'l_first_goal', 1);
    this.increment('lifetime', 'l_goals_50', 1);
  },

  recordPowerUsed() {
    this.increment('daily', 'd_powers_4', 1);
  },

  recordMatchEnd(mode, outcome) {
    if (mode !== 'match' && mode !== '2v2') return;
    this.increment('daily', 'd_play_2', 1);
    this.increment('weekly', 'w_play_10', 1);
    this.increment('lifetime', 'l_matches_25', 1);

    if (outcome === 'win') {
      this.increment('daily', 'd_win_1', 1);
      this.increment('weekly', 'w_wins_5', 1);
      if (mode === 'match') {
        this.increment('lifetime', 'l_win_1v1_5', 1);
      } else if (mode === '2v2') {
        this.increment('weekly', 'w_win_2v2_3', 1);
        this.increment('lifetime', 'l_win_2v2_5', 1);
      }
    }
  },

  claim(tab, id) {
    const list = MISSIONS_CATALOG[tab] || [];
    const mission = list.find(m => m.id === id);
    if (!mission) return null;

    const data = this.load();
    const bucket = data[tab];
    const current = bucket.progress[id] || 0;
    if (current < mission.target || bucket.claimed[id]) return null;

    bucket.claimed[id] = true;
    this.save(data);
    ECONOMY.addCoins(mission.reward);
    updateCoinUI();
    updateMissionsBadgeUI();
    return mission;
  },

  getTabReadyCount(tab) {
    const data = this.load();
    const bucket = data[tab];
    const list = MISSIONS_CATALOG[tab] || [];
    return list.filter(m => (bucket.progress[m.id] || 0) >= m.target && !bucket.claimed[m.id]).length;
  },

  getReadyCount() {
    return this.getTabReadyCount('daily') + this.getTabReadyCount('weekly') + this.getTabReadyCount('lifetime');
  }
};

function updateMissionsBadgeUI() {
  const badge = document.getElementById('missions-ready-badge');
  if (!badge || typeof MISSIONS === 'undefined') return;
  const count = MISSIONS.getReadyCount();
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.hidden = count <= 0;
}

// Garante inicialização/reset de missões ao carregar
MISSIONS.load();
