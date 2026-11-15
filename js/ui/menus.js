/**
 * ==========================================================================
 * LITO BALL - INTERFACES, LOJA, OPÇÕES, INVENTÁRIO E CRÉDITOS (js/ui/menus.js)
 * ==========================================================================
 */
'use strict';

let menuWasRunning = false;
let activePage = 'shop';
let activeCategory = 'shirts';
let activeMissionTab = 'daily';
let activeRemapAction = null;
let remapTimeoutHandler = null;

const PAGE_META = {
  shop: {
    title: 'Loja Oficial Lito Coins',
    subtitle: 'Desbloqueie camisas exclusivas e poderes especiais para dominar a arena'
  },
  inventory: {
    title: 'Seu Inventário',
    subtitle: 'Gerencie e equipe seus itens adquiridos antes ou durante a partida'
  },
  missions: {
    title: 'Central de Missões',
    subtitle: 'Cumpra objetivos diários, semanais e de carreira para ganhar Lito Coins'
  },
  options: {
    title: 'Opções & Controles',
    subtitle: 'Personalize seu botão, ajuste o áudio e remapeie suas teclas'
  },
  credits: {
    title: 'Créditos do Projeto',
    subtitle: 'Conheça quem construiu e evoluiu o Litoball'
  }
};

function isRemappingKey() {
  return activeRemapAction !== null;
}

function cancelKeyRemap() {
  activeRemapAction = null;
  if (remapTimeoutHandler) {
    window.removeEventListener('keydown', remapTimeoutHandler, true);
    remapTimeoutHandler = null;
  }
}

function showPowerFeedback(message, quiet = false, sound = true) {
  const toast = document.getElementById('power-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showPowerFeedback._timer);
  showPowerFeedback._timer = setTimeout(() => toast.classList.remove('show'), quiet ? 1050 : 1500);
  if (!quiet && sound) Sound.playKick();
}

function syncModalInertState() {
  const menuOpen = !document.getElementById('menu-overlay').classList.contains('hidden');
  const gameOverOpen = !document.getElementById('game-over-overlay').classList.contains('hidden');
  const shouldInert = menuOpen || gameOverOpen;
  ['hud', 'gameCanvas', 'power-hud'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.inert = shouldInert;
  });
}

function updateControlHintsUI() {
  const kickLabel = formatKeyLabel(controlsConfig.kickKey);
  const powerLabel = formatKeyLabel(controlsConfig.powerKey);

  const hintKick = document.getElementById('hint-kick-key');
  const hintPower = document.getElementById('hint-power-key');
  if (hintKick) hintKick.textContent = kickLabel;
  if (hintPower) hintPower.textContent = powerLabel;

  const powerBtn = document.getElementById('power-activate');
  if (powerBtn) {
    const power = ITEMS.powers.find(p => p.id === profile.equippedPower);
    const label = power ? `Ativar ${power.name} (${powerLabel})` : `Ativar poder (${powerLabel})`;
    powerBtn.title = label;
    powerBtn.setAttribute('aria-label', label);
  }
}

function updatePowerHud() {
  const hud = document.getElementById('power-hud');
  if (!hud) return;
  const power = ITEMS.powers.find(p => p.id === profile.equippedPower);
  hud.classList.toggle('hidden', !gameState.running || !power);
  document.getElementById('power-name').textContent = power ? power.name : 'Sem poder';

  const shotBuffPending = player1.nextKickPower > 1 || player1.nextKickReach > 1 || player1.powerEffect === 'curve' || player1.powerEffect === 'sniper' || player1.powerEffect === 'eagle';
  const visionActive = power?.id === 'vision' && player1.powerEffect === 'vision' && player1.powerEffectTimer > 0;
  const curveArmed = power?.id === 'curve' && player1.powerEffect === 'curve';
  const eagleArmed = power?.id === 'eagle' && (player1.powerEffect === 'eagle' || player1.nextKickReach > 1);
  const sniperArmed = power?.id === 'sniper' && player1.powerEffect === 'sniper';
  const shadowActive = power?.id === 'shadow' && player1.powerEffect === 'shadow' && player1.powerEffectTimer > 0;
  const egoActive = power?.id === 'ego' && player1.powerEffect === 'ego' && player1.powerEffectTimer > 0;
  const twoOneActive = typeof twoOnePlay !== 'undefined' && !!twoOnePlay;
  const snakeTackle = snakeTackles.find(tackle => tackle.owner === player1);
  const snakeActive = !!snakeTackle;
  const powerKeyLabel = formatKeyLabel(controlsConfig.powerKey);

  const powerButton = document.getElementById('power-activate');
  const powerButtonLabel = power ? `Ativar ${power.name} (${powerKeyLabel})` : `Ativar poder (${powerKeyLabel})`;
  powerButton.innerHTML = power ? (SKILL_ICONS[power.id] || getSvgIcon('icon-bolt', 22)) : getSvgIcon('icon-bolt', 22);
  powerButton.title = powerButtonLabel;
  powerButton.setAttribute('aria-label', powerButtonLabel);

  btnPass.hidden = !gameState.running;
  const visionLongPassMode = gameMode === '2v2' || gameMode === 'training';
  btnPass.textContent = curveArmed ? 'Passe curvo (F)' : visionActive && visionLongPassMode ? 'Passe da Visão (F)' : visionActive ? 'Passe teleguiado (F)' : 'Passe (F)';
  btnPass.title = curveArmed
    ? 'Passe curvo para o companheiro mais próximo (F)'
    : visionActive && visionLongPassMode
      ? 'Mire no aliado e pressione F; a linha rosa mostra o passe longo curvo'
      : visionActive
        ? 'Passe teleguiado para o companheiro mais próximo (F)'
      : 'Passe para o companheiro mais próximo (F)';

  const effectActive = player1.powerEffectTimer > 0 || snakeActive;
  const cooldownReady = player1.powerCooldown <= 0;
  const countdownLocked = (gameState.countdownTimer || 0) > 0;
  const ready = cooldownReady && !shotBuffPending && !effectActive && !twoOneActive && !countdownLocked;

  powerButton.classList.toggle('cooldown', !cooldownReady);
  powerButton.classList.toggle('active', visionActive || eagleArmed || sniperArmed || shadowActive || egoActive || twoOneActive || snakeActive);
  powerButton.disabled = !ready;

  if (ready && !powerReadyLast && power) {
    showPowerFeedback('Poder disponível!', true, false);
  }
  powerReadyLast = ready;

  const cooldownDuration = power?.id === 'phantom'
    ? phantomStats(player1).cooldown
    : (POWER_COOLDOWNS[power?.id] || 12);

  const fill = document.getElementById('power-meter-fill');
  fill.style.width = visionActive
    ? `${Math.max(0, (player1.powerEffectTimer / 20) * 100)}%`
    : cooldownReady
      ? '100%'
      : `${Math.max(0, 100 * (1 - player1.powerCooldown / cooldownDuration))}%`;

  const statusText = snakeTackle
    ? (snakeTackle.phase === 'lunge'
      ? 'Bote da Serpente em avanço!'
      : snakeTackle.phase === 'strike'
        ? 'Impacto da Serpente!'
        : 'Dissipando...')
    : twoOneActive
      ? (twoOnePlay.mode === 'wall' || twoOnePlay.mode === 'orbital'
        ? (twoOnePlay.phase === 'outbound' ? 'Tabela na Parede: avance para receber' : 'Parede retornando · receba!')
        : (twoOnePlay.phase === 'outbound' ? 'Toque e Passa: corra para receber' : 'Devolução de primeira!'))
      : visionActive
          ? `Visão ativa: ${player1.powerEffectTimer.toFixed(1)}s`
          : eagleArmed
            ? `Alcance estendido: ${player1.powerEffectTimer.toFixed(1)}s`
            : sniperArmed
              ? `Mira armada: ${player1.powerEffectTimer.toFixed(1)}s`
              : shadowActive
                ? `Sombra ativa: ${player1.powerEffectTimer.toFixed(1)}s`
                : egoActive
                  ? `Despertar do Ego: ${player1.powerEffectTimer.toFixed(1)}s`
                  : curveArmed
                    ? 'Curva armada · mire (mouse/WASD) e chute!'
                    : shotBuffPending
                      ? 'Próximo chute fortalecido'
                      : player1.dashTimer > 0
                        ? `Arrancada: ${player1.dashTimer.toFixed(1)}s`
                        : player1.powerEffectTimer > 0
                          ? `Efeito: ${player1.powerEffectTimer.toFixed(1)}s`
                          : ready
                            ? `Pronto · Tecla ${powerKeyLabel}`
                            : countdownLocked
                              ? 'Aguarde o apito inicial...'
                              : `Recarga: ${player1.powerCooldown.toFixed(1)}s`;

  document.getElementById('power-status').textContent = statusText;
}

function updateTimerDisplay() {
  const t = Math.max(0, Math.floor(gameState.isOvertime ? gameState.overtimeTimeRemaining : gameState.timeRemaining));
  const mins = Math.floor(t / 60).toString().padStart(2, '0');
  const secs = (t % 60).toString().padStart(2, '0');
  timerEl.textContent = gameState.isOvertime ? `GOL DE OURO · ${mins}:${secs}` : `${mins}:${secs}`;
}

function updatePlayerPreview() {
  if (!previewCanvas || !previewCtx) return;
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  const dummyPlayer = new Player(60, 60, 36, playerConfig.color, playerConfig.number, true);
  dummyPlayer.draw(previewCtx);
  if (badgeP1) badgeP1.style.backgroundColor = playerConfig.color;
}

function stashAppearancePanel() {
  const panel = document.getElementById('appearance-panel');
  const vault = document.getElementById('appearance-vault');
  if (panel && vault && panel.parentElement !== vault) {
    vault.appendChild(panel);
  }
}

function resumeMatch() {
  if (!gameState.isGameOver) {
    gameState.running = true;
    gameState.lastTimestamp = performance.now();
    if (typeof updateCountdownOverlay === 'function') updateCountdownOverlay();
    syncModalInertState();
    requestAnimationFrame(gameLoop);
    document.getElementById('power-hud').classList.toggle('hidden', !profile.equippedPower);
  }
}

function refreshResumeSlot() {
  const slot = document.getElementById('resume-slot');
  if (!slot) return;
  slot.innerHTML = '';
  if (menuWasRunning) {
    const btn = document.createElement('button');
    btn.id = 'menu-resume';
    btn.type = 'button';
    btn.className = 'secondary-btn cyber-btn resume-match-btn';
    btn.innerHTML = `<span class="cyber-chevrons" aria-hidden="true">&laquo;</span><span class="btn-inline-label">${getSvgIcon('icon-play', 16)}<span>Continuar Partida em Andamento</span></span><span class="cyber-chevrons" aria-hidden="true">&raquo;</span>`;
    btn.onclick = () => {
      menuOverlay.classList.add('hidden');
      resumeMatch();
    };
    slot.appendChild(btn);
  }
}

function closeFeaturePage() {
  cancelKeyRemap();
  stashAppearancePanel();
  const menuPage = document.getElementById('menu-page');
  const mainCard = document.getElementById('main-menu-card');
  menuPage.classList.add('hidden');
  menuPage.classList.remove('menu-page--shop', 'menu-page--credits', 'menu-page--missions');
  mainCard.style.display = '';
  refreshResumeSlot();
  if (typeof updateMissionsBadgeUI === 'function') updateMissionsBadgeUI();
}

function showFeaturePage(page) {
  cancelKeyRemap();
  stashAppearancePanel();

  activePage = page;
  menuWasRunning = gameState.running || menuWasRunning;
  gameState.running = false;

  const mainCard = document.getElementById('main-menu-card');
  const menuPage = document.getElementById('menu-page');
  const meta = PAGE_META[page] || { title: page, subtitle: '' };

  mainCard.style.display = 'none';
  menuPage.classList.remove('hidden');
  menuPage.classList.toggle('menu-page--shop', page === 'shop');
  menuPage.classList.toggle('menu-page--credits', page === 'credits');
  menuPage.classList.toggle('menu-page--missions', page === 'missions');

  const categoryTabs = (page === 'shop' || page === 'inventory')
    ? `
      <div class="menu-categories" role="tablist">
        <button type="button" data-cat="shirts" class="cat-tab-btn ${activeCategory === 'shirts' ? 'active' : ''}" role="tab" aria-selected="${activeCategory === 'shirts'}">${getSvgIcon('icon-shirt', 16)}<span>Camisas</span></button>
        <button type="button" data-cat="powers" class="cat-tab-btn ${activeCategory === 'powers' ? 'active' : ''}" role="tab" aria-selected="${activeCategory === 'powers'}">${getSvgIcon('icon-bolt', 16)}<span>Poderes &amp; Habilidades</span></button>
      </div>
    `
    : '';

  menuPage.innerHTML = `
    <div class="menu-page-scroll">
      <div class="menu-page-header">
        <div class="menu-page-title-wrap">
          <h2>${meta.title}</h2>
          <p class="menu-page-subtitle">${meta.subtitle}</p>
        </div>
        <div class="menu-page-header-right">
          <div class="menu-coins-badge" title="Seu saldo de Lito Coins">
            ${getSvgIcon('icon-litocoin', 18, 'svg-coin-icon')}
            <span id="page-coin-count">${ECONOMY.getCoins().toLocaleString('pt-BR')}</span>
            <small>Lito Coins</small>
          </div>
        </div>
      </div>

      ${categoryTabs}
      <div id="menu-page-content"></div>

      <div class="menu-page-footer">
        <button id="feature-back" type="button" class="secondary-btn cyber-btn"><span class="btn-inline-label">${getSvgIcon('icon-back', 16)}<span>Voltar ao Menu</span></span></button>
        ${menuWasRunning ? `<button id="feature-resume" type="button" class="primary-btn cyber-btn"><span class="btn-inline-label">${getSvgIcon('icon-play', 16)}<span>Continuar Partida</span></span></button>` : ''}
      </div>
    </div>
  `;

  if (page === 'shop' || page === 'inventory') renderItems();
  if (page === 'missions') renderMissions();
  if (page === 'options') renderOptions();
  if (page === 'credits') renderCredits();

  menuPage.querySelectorAll('[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      showFeaturePage(page);
    });
  });

  document.getElementById('feature-back').addEventListener('click', closeFeaturePage);
  const resumeBtn = document.getElementById('feature-resume');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
      closeFeaturePage();
      menuOverlay.classList.add('hidden');
      resumeMatch();
    });
  }
}

function renderItems() {
  const container = document.getElementById('menu-page-content');
  if (!container) return;

  const allItems = ITEMS[activeCategory];
  const owned = activeCategory === 'shirts' ? profile.ownedShirts : profile.ownedPowers;
  const items = activePage === 'inventory'
    ? allItems.filter(item => owned.includes(item.id))
    : allItems;

  let summaryHtml = '';
  if (activePage === 'inventory') {
    const equippedShirt = ITEMS.shirts.find(s => s.id === profile.equippedShirt);
    const equippedPower = ITEMS.powers.find(p => p.id === profile.equippedPower);
    summaryHtml = `
      <div class="equipped-summary-bar">
        <div class="equipped-summary-chip">
          <span class="nav-icon" aria-hidden="true">${getSvgIcon('icon-shirt', 22)}</span>
          <div>
            <small>Camisa Equipada</small>
            <strong>${equippedShirt ? equippedShirt.name : 'Clássica (Cor Personalizada)'}</strong>
          </div>
          ${equippedShirt ? '<button type="button" class="hud-btn" id="unequip-shirt-btn" style="margin-inline-start:auto;">Usar Clássica</button>' : ''}
        </div>
        <div class="equipped-summary-chip">
          <span class="nav-icon" aria-hidden="true">${equippedPower ? renderPowerIconMedia(equippedPower.id, 22, equippedPower.name) : getSvgIcon('icon-bolt', 22)}</span>
          <div>
            <small>Habilidade Equipada</small>
            <strong>${equippedPower ? equippedPower.name : 'Nenhuma'}</strong>
          </div>
          ${equippedPower ? '<button type="button" class="hud-btn" id="unequip-power-btn" style="margin-inline-start:auto;">Remover</button>' : ''}
        </div>
      </div>
    `;
  }

  if (activePage === 'inventory' && !items.length) {
    container.innerHTML = `
      ${summaryHtml}
      <div class="empty-inventory">
        <p>Você ainda não possui itens nesta categoria.</p>
        <button type="button" class="primary-btn cyber-btn" id="go-to-shop-btn"><span class="btn-inline-label">${getSvgIcon('icon-shop', 18)}<span>Visitar a Loja</span></span></button>
      </div>
    `;
    const goShop = document.getElementById('go-to-shop-btn');
    if (goShop) goShop.addEventListener('click', () => showFeaturePage('shop'));
    bindUnequipButtons();
    return;
  }

  const cardsHtml = items.map(item => {
    const has = owned.includes(item.id);
    const equipped = activeCategory === 'shirts'
      ? profile.equippedShirt === item.id
      : profile.equippedPower === item.id;

    const coinMini = getSvgIcon('icon-litocoin', 14, 'svg-coin-icon');
    const iconHtml = activeCategory === 'shirts'
      ? `<span class="item-icon shirt-icon" style="background:linear-gradient(90deg,${item.colors.join(',')})">${item.badge}</span>`
      : `<span class="item-icon item-icon-power">${renderPowerIconMedia(item.id, 22, item.name)}</span>`;

    const statusBadge = equipped
      ? '<span class="item-status-pill equipped">&#10003; Equipado</span>'
      : has
        ? '<span class="item-status-pill owned">Adquirido</span>'
        : `<span class="item-status-pill price">${coinMini} ${item.price.toLocaleString('pt-BR')}</span>`;

    const cooldownMeta = activeCategory === 'powers'
      ? `<span class="item-meta">Recarga base: ${POWER_COOLDOWNS[item.id] || 12}s</span>`
      : `<span class="item-meta">Uniforme oficial de clube</span>`;

    const level = item.id === 'phantom' ? phantomLevelFor(player1) : 0;
    const upgradeCost = item.id === 'phantom' ? PHANTOM_UPGRADE_COSTS[level + 1] : null;
    const phantomInfo = item.id === 'phantom' && has ? phantomStats(player1) : null;
    const levelInfo = phantomInfo
      ? `<small class="upgrade-level">Nível ${level}/3 · corte ${phantomInfo.duration.toFixed(2)}s · esquiva ${Math.round(phantomInfo.dodgeChance * 100)}% · recarga ${phantomInfo.cooldown}s</small>`
      : '';
    const upgradeControl = has && item.id === 'phantom'
      ? (upgradeCost
        ? `${levelInfo}<button type="button" class="secondary-btn upgrade-btn" data-upgrade="phantom">Melhorar Nv.${level + 1} · ${coinMini} ${upgradeCost.toLocaleString('pt-BR')}</button>`
        : `${levelInfo}<small class="upgrade-level">&#10003; Nível máximo atingido</small>`)
      : '';

    const actionLabel = has
      ? (equipped ? 'Equipado' : 'Equipar')
      : `<span class="btn-inline-label"><span>Comprar</span> ${coinMini} <span>${item.price.toLocaleString('pt-BR')}</span></span>`;

    return `
      <article class="menu-item ${equipped ? 'is-equipped' : ''}">
        <div class="item-card-top">
          ${iconHtml}
          ${statusBadge}
        </div>
        <strong class="item-title">${item.name}</strong>
        <div class="item-body">
          <p>${item.description}</p>
          ${cooldownMeta}
          ${levelInfo}
        </div>
        <div class="item-actions">
          ${has && item.id === 'phantom' && upgradeCost ? `<button type="button" class="secondary-btn upgrade-btn" data-upgrade="phantom"><span class="btn-inline-label"><span>Melhorar Nv.${level + 1}</span> ${coinMini} <span>${upgradeCost.toLocaleString('pt-BR')}</span></span></button>` : ''}
          <button type="button" class="${has ? 'secondary-btn' : 'primary-btn'} cyber-btn" data-item="${item.id}" ${equipped ? 'disabled' : ''}>${actionLabel}</button>
        </div>
      </article>
    `;
  }).join('');

  container.innerHTML = `${summaryHtml}<div class="menu-items">${cardsHtml}</div>`;
  bindUnequipButtons();

  container.querySelectorAll('[data-item]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = items.find(x => x.id === btn.dataset.item);
      if (!item) return;
      const arr = activeCategory === 'shirts' ? profile.ownedShirts : profile.ownedPowers;
      if (!arr.includes(item.id)) {
        if (ECONOMY.getCoins() < item.price) {
          showPowerFeedback('Saldo insuficiente de Lito Coins', true);
          return;
        }
        ECONOMY.spendCoins(item.price);
        arr.push(item.id);
        if (typeof MISSIONS !== 'undefined') MISSIONS.syncUnlockCount();
        showPowerFeedback(`${item.name} adquirido!`);
      } else {
        showPowerFeedback(`${item.name} equipado!`, true, false);
      }
      if (item.id === 'phantom' && !profile.powerLevels.phantom) {
        profile.powerLevels.phantom = 1;
      }
      if (activeCategory === 'shirts') {
        profile.equippedShirt = item.id;
      } else {
        profile.equippedPower = item.id;
      }
      persistProfile();
      player1.color = playerConfig.color;
      updatePlayerPreview();
      renderItems();
    });
  });

  container.querySelectorAll('[data-upgrade="phantom"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const level = Number(profile.powerLevels.phantom) || 1;
      const cost = PHANTOM_UPGRADE_COSTS[level + 1];
      if (!cost) return;
      if (ECONOMY.getCoins() < cost) {
        showPowerFeedback('Litocoins insuficientes para melhorar', true);
        return;
      }
      ECONOMY.spendCoins(cost);
      profile.powerLevels.phantom = level + 1;
      persistProfile();
      showPowerFeedback(`Drible Fantasma melhorado para nível ${level + 1}!`);
      renderItems();
    });
  });
}

function bindUnequipButtons() {
  const unequipShirtBtn = document.getElementById('unequip-shirt-btn');
  if (unequipShirtBtn) {
    unequipShirtBtn.addEventListener('click', () => {
      profile.equippedShirt = 'classic';
      persistProfile();
      updatePlayerPreview();
      renderItems();
      showPowerFeedback('Camisa clássica equipada', true, false);
    });
  }
  const unequipPowerBtn = document.getElementById('unequip-power-btn');
  if (unequipPowerBtn) {
    unequipPowerBtn.addEventListener('click', () => {
      profile.equippedPower = null;
      persistProfile();
      renderItems();
      showPowerFeedback('Poder desequipado', true, false);
    });
  }
}

function renderOptions() {
  const container = document.getElementById('menu-page-content');
  if (!container) return;

  container.innerHTML = `
    <div class="options-grid">
      <div id="options-appearance-slot" class="full-span"></div>

      <section class="options-panel-card">
        <div class="options-panel-header">
          <h3 class="heading-with-icon">${getSvgIcon('icon-audio', 18)}<span>Áudio e Efeitos</span></h3>
          <p>Controle o volume dos sons e apitos da partida</p>
        </div>
        <div class="volume-control-row">
          <div class="volume-header">
            <label for="feature-volume">Volume Geral</label>
            <strong id="volume-label">${Math.round(profile.volume ?? 70)}%</strong>
          </div>
          <input id="feature-volume" type="range" min="0" max="100" value="${profile.volume ?? 70}">
        </div>
        <label class="toggle-row" for="feature-mute">
          <input id="feature-mute" type="checkbox" ${profile.muted ? 'checked' : ''}>
          <span>Silenciar todo o áudio</span>
        </label>
      </section>

      <section class="options-panel-card">
        <div class="options-panel-header">
          <h3 class="heading-with-icon">${getSvgIcon('icon-gamepad', 18)}<span>Controles</span></h3>
          <p>Clique para remapear as teclas de Chute e Habilidade</p>
        </div>
        <div class="remap-list">
          <div class="remap-row">
            <div class="remap-info">
              <strong>Chute</strong>
              <small>Também funciona com Clique Esquerdo</small>
            </div>
            <div class="remap-actions">
              <span id="remap-badge-kickKey" class="key-badge key-badge-accent">${formatKeyLabel(controlsConfig.kickKey)}</span>
              <button type="button" class="secondary-btn remap-btn" data-remap="kickKey">Alterar Tecla</button>
            </div>
          </div>

          <div class="remap-row">
            <div class="remap-info">
              <strong>Usar Habilidade / Poder</strong>
              <small>Ativa o poder equipado no inventário</small>
            </div>
            <div class="remap-actions">
              <span id="remap-badge-powerKey" class="key-badge key-badge-gold">${formatKeyLabel(controlsConfig.powerKey)}</span>
              <button type="button" class="secondary-btn remap-btn" data-remap="powerKey">Alterar Tecla</button>
            </div>
          </div>

          <div class="remap-row">
            <div class="remap-info">
              <strong>Movimentação / Passe Especial</strong>
              <small>Controles padrão fixos da arena</small>
            </div>
            <div class="remap-actions">
              <span class="key-badge">WASD / Setas</span>
              <span class="key-badge">F</span>
            </div>
          </div>
        </div>

        <div class="remap-footer">
          <span id="remap-feedback" class="remap-feedback" aria-live="polite">Pronto para personalizar.</span>
          <button id="reset-controls-btn" type="button" class="secondary-btn">Restaurar Padrão</button>
        </div>
      </section>
    </div>
  `;

  // Move o painel persistente de aparência para o slot sem perder listeners nem o canvas de preview
  const appearanceSlot = document.getElementById('options-appearance-slot');
  const appearancePanel = document.getElementById('appearance-panel');
  if (appearanceSlot && appearancePanel) {
    appearanceSlot.appendChild(appearancePanel);
    updatePlayerPreview();
  }

  const range = container.querySelector('#feature-volume');
  range.addEventListener('input', () => {
    profile.volume = Number(range.value);
    Sound.volume = profile.volume / 100;
    Sound.applyVolume();
    container.querySelector('#volume-label').textContent = `${range.value}%`;
    persistProfile();
  });

  const mute = container.querySelector('#feature-mute');
  mute.addEventListener('change', () => {
    profile.muted = mute.checked;
    Sound.muted = mute.checked;
    Sound.applyVolume();
    persistProfile();
  });

  const feedbackEl = container.querySelector('#remap-feedback');
  const resetBtn = container.querySelector('#reset-controls-btn');

  function setRemapStatus(text, tone = '') {
    feedbackEl.textContent = text;
    feedbackEl.className = `remap-feedback ${tone}`.trim();
  }

  function refreshRemapButtonsUI() {
    container.querySelector('#remap-badge-kickKey').textContent = formatKeyLabel(controlsConfig.kickKey);
    container.querySelector('#remap-badge-powerKey').textContent = formatKeyLabel(controlsConfig.powerKey);
    container.querySelectorAll('.remap-btn').forEach(btn => {
      const listening = btn.dataset.remap === activeRemapAction;
      btn.classList.toggle('listening', listening);
      btn.textContent = listening ? 'Pressione tecla...' : 'Alterar Tecla';
    });
  }

  container.querySelectorAll('.remap-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.remap;
      if (activeRemapAction === action) {
        cancelKeyRemap();
        refreshRemapButtonsUI();
        setRemapStatus('Alteração cancelada.');
        return;
      }

      cancelKeyRemap();
      activeRemapAction = action;
      refreshRemapButtonsUI();
      setRemapStatus(`Pressione a nova tecla para ${action === 'kickKey' ? 'Chute' : 'Usar Poder'} (ESC cancela)...`);

      remapTimeoutHandler = e => {
        e.preventDefault();
        e.stopPropagation();

        const code = e.code;
        if (code === 'Escape') {
          cancelKeyRemap();
          refreshRemapButtonsUI();
          setRemapStatus('Alteração cancelada.');
          return;
        }

        const otherAction = action === 'kickKey' ? 'powerKey' : 'kickKey';
        const otherCode = controlsConfig[otherAction];

        if (RESERVED_KEYS.includes(code)) {
          setRemapStatus(`Conflito: ${formatKeyLabel(code)} é reservada para movimentação/passe!`, 'error');
          return;
        }
        if (code === otherCode) {
          const otherLabel = otherAction === 'kickKey' ? 'Chute' : 'Usar Poder';
          setRemapStatus(`Conflito: ${formatKeyLabel(code)} já está atribuída a "${otherLabel}"!`, 'error');
          return;
        }

        const nextControls = { ...controlsConfig, [action]: code };
        saveControls(nextControls);
        cancelKeyRemap();
        refreshRemapButtonsUI();
        updateControlHintsUI();
        updatePowerHud();
        setRemapStatus(`Tecla atualizada para ${formatKeyLabel(code)}!`, 'success');
      };

      window.addEventListener('keydown', remapTimeoutHandler, true);
    });
  });

  resetBtn.addEventListener('click', () => {
    cancelKeyRemap();
    resetControls();
    refreshRemapButtonsUI();
    updateControlHintsUI();
    updatePowerHud();
    setRemapStatus('Controles restaurados para ESPAÇO e Q.', 'success');
  });
}

function renderMissions() {
  const container = document.getElementById('menu-page-content');
  if (!container || typeof MISSIONS === 'undefined') return;

  const state = MISSIONS.load();
  const tabs = [
    { key: 'daily', label: 'Diárias', hint: 'Renova todo dia à 00:00 (horário local)' },
    { key: 'weekly', label: 'Semanais', hint: 'Renova toda segunda-feira' },
    { key: 'lifetime', label: 'De Vida', hint: 'Conquistas permanentes da conta (1x por carreira)' }
  ];

  const activeTabMeta = tabs.find(t => t.key === activeMissionTab) || tabs[0];

  const tabButtonsHtml = tabs.map(tab => {
    const isSelected = activeMissionTab === tab.key;
    const readyCount = MISSIONS.getTabReadyCount(tab.key);
    return `
      <button
        type="button"
        role="tab"
        id="mission-tab-${tab.key}"
        aria-selected="${isSelected}"
        aria-controls="mission-panel-${tab.key}"
        data-mission-tab="${tab.key}"
        class="mission-tab-btn"
      >
        <span>${tab.label}</span>
        ${readyCount > 0 ? `<span class="mission-tab-badge">${readyCount}</span>` : ''}
      </button>
    `;
  }).join('');

  const tabPanelsHtml = tabs.map(tab => {
    const isSelected = activeMissionTab === tab.key;
    const catalog = MISSIONS_CATALOG[tab.key] || [];
    const bucket = state[tab.key] || { progress: {}, claimed: {} };

    const cardsHtml = catalog.map(m => {
      const progress = Math.min(m.target, Math.max(0, Number(bucket.progress[m.id]) || 0));
      const claimed = !!bucket.claimed[m.id];
      const ready = progress >= m.target && !claimed;
      const pct = Math.max(0, Math.min(100, Math.round((progress / m.target) * 100)));

      let statusLabel = `${progress} / ${m.target}`;
      let actionHtml = `<span class="mission-status-tag">Em progresso</span>`;
      if (claimed) {
        statusLabel = `${m.target} / ${m.target}`;
        actionHtml = `<span class="mission-claimed-pill">Resgatada</span>`;
      } else if (ready) {
        actionHtml = `
          <button type="button" class="mission-claim-btn" data-claim-tab="${tab.key}" data-claim-id="${m.id}">
            Resgatar
          </button>
        `;
      }

      return `
        <article class="mission-card ${ready ? 'is-ready' : ''} ${claimed ? 'is-claimed' : ''}">
          <div class="mission-card-main">
            <div class="mission-card-head">
              <h3>${m.title}</h3>
              <span class="mission-reward-pill" title="Recompensa em Lito Coins">
                ${getSvgIcon('icon-litocoin', 15, 'svg-coin-icon')}
                <span>+${m.reward.toLocaleString('pt-BR')}</span>
              </span>
            </div>
            <p class="mission-card-desc">${m.desc}</p>
            <div class="mission-progress-row">
              <div class="mission-progress-bar" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="${m.target}">
                <div class="mission-progress-fill" style="width:${pct}%"></div>
              </div>
              <span class="mission-progress-count">${statusLabel}</span>
            </div>
          </div>
          <div class="mission-card-action">
            ${actionHtml}
          </div>
        </article>
      `;
    }).join('');

    return `
      <div
        id="mission-panel-${tab.key}"
        role="tabpanel"
        aria-labelledby="mission-tab-${tab.key}"
        class="mission-panel"
        ${isSelected ? '' : 'hidden'}
      >
        <div class="missions-list">
          ${cardsHtml}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="missions-shell">
      <div class="missions-topbar">
        <div class="missions-tabs" role="tablist" aria-label="Categorias de missões">
          ${tabButtonsHtml}
        </div>
        <div class="missions-reset-note">${activeTabMeta.hint}</div>
      </div>
      ${tabPanelsHtml}
    </div>
  `;

  container.querySelectorAll('[data-mission-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeMissionTab = btn.dataset.missionTab;
      renderMissions();
    });
  });

  container.querySelectorAll('[data-claim-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabKey = btn.dataset.claimTab;
      const missionId = btn.dataset.claimId;
      const claimedMission = MISSIONS.claim(tabKey, missionId);
      if (claimedMission && claimedMission.reward > 0) {
        if (typeof Sound !== 'undefined' && Sound.playGoal) {
          Sound.init();
          Sound.playGoal();
        }
        showPowerFeedback(`${claimedMission.title}: +${claimedMission.reward.toLocaleString('pt-BR')} Lito Coins!`);
        const pageCoinEl = document.getElementById('page-coin-count');
        if (pageCoinEl) pageCoinEl.textContent = ECONOMY.getCoins().toLocaleString('pt-BR');
        renderMissions();
      }
    });
  });
}

function renderCredits() {
  const container = document.getElementById('menu-page-content');
  if (!container) return;

  container.innerHTML = `
    <section class="credits-hero">
      <div class="credits-hero-badge">LITOBALL &bull; CYBER-ARCADE EDITION</div>
      <h3>Futebol de Botão Tático em Tempo Real</h3>
      <p>Construído com HTML5 Canvas 2D procedural, física dedicada, habilidades autorais e IA estratégica em 1v1 e 2v2.</p>
    </section>
    <div class="credits-grid">
      <article class="credit-card">
        <span class="credit-role">Criador &amp; Direção</span>
        <h3>Lito</h3>
        <p>Idealizador original, designer de gameplay e desenvolvedor principal do projeto Litoball.</p>
      </article>
      <article class="credit-card">
        <span class="credit-role">Colaboração</span>
        <h3>Rony</h3>
        <p>Apoio direto no desenvolvimento, testes e sugestões de mecânicas e balanceamento.</p>
      </article>
      <article class="credit-card">
        <span class="credit-role">Engenharia &amp; Assistência</span>
        <h3>Codex &amp; Antigravity</h3>
        <p>Modularização de arquitetura, remodelação de IAs 2v2, rework visual, missões e animações procedurais.</p>
      </article>
    </div>
  `;
}

function isFullscreenActive() {
  const stage = document.getElementById('fullscreen-stage');
  return !!document.fullscreenElement || !!stage?.classList.contains('is-pseudo-fullscreen');
}

function updateFullscreenUI() {
  const active = isFullscreenActive();
  const hudBtn = document.getElementById('btn-fullscreen');
  const menuBtn = document.getElementById('menu-fullscreen-btn');
  const fsIcon = getSvgIcon(active ? 'icon-exit-fullscreen' : 'icon-fullscreen', 14);
  if (hudBtn) {
    hudBtn.innerHTML = `${fsIcon}<span>${active ? 'Sair' : 'Tela'}</span>`;
    hudBtn.title = active ? 'Sair da Tela Cheia' : 'Ativar Tela Cheia';
  }
  if (menuBtn) {
    menuBtn.innerHTML = `${getSvgIcon(active ? 'icon-exit-fullscreen' : 'icon-fullscreen', 15)}<span>${active ? 'Sair da Tela Cheia' : 'Tela Cheia'}</span>`;
    menuBtn.title = active ? 'Sair da Tela Cheia' : 'Ativar Tela Cheia';
  }
}

async function toggleFullscreen() {
  const stage = document.getElementById('fullscreen-stage');
  if (!stage) return;
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (stage.classList.contains('is-pseudo-fullscreen')) {
      stage.classList.remove('is-pseudo-fullscreen');
    } else if (stage.requestFullscreen) {
      await stage.requestFullscreen();
    } else {
      stage.classList.toggle('is-pseudo-fullscreen');
    }
  } catch (e) {
    stage.classList.toggle('is-pseudo-fullscreen');
  }
  updateFullscreenUI();
}

function initUI() {
  const colorSwatches = document.querySelectorAll('.color-swatch');
  const customColorInput = document.getElementById('custom-color-input');
  const jerseyInput = document.getElementById('jersey-number-input');

  // Sincroniza UI de aparência com o perfil salvo
  customColorInput.value = playerConfig.color;
  jerseyInput.value = playerConfig.number;
  colorSwatches.forEach(s => {
    s.classList.toggle('active', s.dataset.color.toLowerCase() === playerConfig.color.toLowerCase());
  });

  colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      colorSwatches.forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      playerConfig.color = swatch.dataset.color;
      customColorInput.value = playerConfig.color;
      player1.color = playerConfig.color;
      homeMate.color = playerConfig.color;
      persistProfile();
      updatePlayerPreview();
    });
  });

  customColorInput.addEventListener('input', e => {
    colorSwatches.forEach(s => s.classList.remove('active'));
    playerConfig.color = e.target.value;
    player1.color = playerConfig.color;
    homeMate.color = playerConfig.color;
    persistProfile();
    updatePlayerPreview();
  });

  jerseyInput.addEventListener('input', e => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    if (val > 99) val = 99;
    playerConfig.number = val;
    player1.number = val;
    persistProfile();
    updatePlayerPreview();
  });

  document.querySelectorAll('input[name="pitch-theme"]').forEach(radio => {
    radio.checked = radio.value === (profile.pitchTheme || 'classic');
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      profile.pitchTheme = radio.value;
      persistProfile();
      if (typeof redrawIdlePitchScene === 'function') redrawIdlePitchScene();
    });
  });

  document.querySelectorAll('.menu-nav-row [data-view]').forEach(button => {
    button.addEventListener('click', () => showFeaturePage(button.dataset.view));
  });

  document.getElementById('start-training-btn').addEventListener('click', () => {
    Sound.init();
    beginTraining();
  });

  document.getElementById('power-activate').addEventListener('click', () => {
    Sound.init();
    applyPower(profile.equippedPower, player1);
  });

  const hudFsBtn = document.getElementById('btn-fullscreen');
  const menuFsBtn = document.getElementById('menu-fullscreen-btn');
  if (hudFsBtn) hudFsBtn.addEventListener('click', toggleFullscreen);
  if (menuFsBtn) menuFsBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', updateFullscreenUI);

  updateFullscreenUI();
  updatePlayerPreview();
  updateControlHintsUI();
  updateCoinUI();
  if (typeof updateMissionsBadgeUI === 'function') updateMissionsBadgeUI();
  syncModalInertState();
}
