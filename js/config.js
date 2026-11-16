/**
 * ==========================================================================
 * LITO BALL - CONFIGURAÇÕES, CONSTANTES E CATÁLOGO DE ITENS (js/config.js)
 * ==========================================================================
 */
'use strict';

const ITEMS = {
  shirts: [
    { id: 'flamengo', name: 'Flamengo', price: 500, description: 'Camisa rubro-negra com escudo vetorial CRF.', colors: ['#171717', '#c8102e'], badge: 'CRF' },
    { id: 'vasco', name: 'Vasco da Gama', price: 750, description: 'Camisa preta e branca com faixa diagonal e cruz.', colors: ['#111111', '#f5f5f5'], badge: '✚' },
    { id: 'santos', name: 'Santos', price: 1000, description: 'Listras alvinegras com detalhes dourados.', colors: ['#111111', '#f8f8f8'], badge: 'SFC' },
    { id: 'decisao', name: 'Decisão Futebol Clube', price: 1500, description: 'Camisa azul e branca com escudo DFC.', colors: ['#1769aa', '#f2f7ff'], badge: 'DFC' }
  ],
  powers: [
    { id: 'cannon', name: 'Chute de Pistola', price: 1000, description: 'Arma o próximo chute com força explosiva e animação de disparo.' },
    { id: 'sprint', name: 'Speedster', price: 800, description: 'Explosão feral em velocidade máxima com o arranque da pantera escarlate, rastro de garras rubi e onda sônica.' },
    { id: 'phantom', name: 'Drible da Abelha', price: 1200, description: 'Drible acrobático de Meguru Bachira: dá um chapéu aéreo por cima do adversário com asas douradas e favos de mel.' },
    { id: 'vision', name: 'Visão de Campo', price: 1000, description: 'Por 20s, revela padrões táticos, aumenta a velocidade e libera um passe longo, curvo e teleguiado para um aliado.' },
    { id: 'curve', name: 'Curva Impossível', price: 1200, description: 'Mostra a prévia em arco e dispara um chute com efeito Magnus letal rumo ao gol.' },
    { id: 'twoOne', name: 'Toque e Passa', price: 1500, description: 'Tabela rápida com devolução de primeira e arrancada.' },
    { id: 'snakeTackle', name: 'Bote da Serpente', price: 1500, description: 'Avança em bote instantâneo contra o portador para desarmar com precisão.' },
    { id: 'control', name: 'Domínio Perfeito', price: 800, description: 'Amortece e cola a bola no pé instantaneamente ao ativar perto dela.' },
    { id: 'eagle', name: 'Salto de Águia', price: 1000, description: 'Estende bem o alcance do próximo chute ou interceptação até executar o golpe.' },
    { id: 'sniper', name: 'Instinto de Artilheiro', price: 1500, description: 'Chute potente e certeiro ao finalizar na zona ofensiva.' },
    { id: 'shadow', name: 'WEB', price: 1200, description: 'Conjura uma teia tática no gramado (4,5s) que prende o adversário ao entrar, zera sua velocidade e interrompe arrancadas e habilidades.' },
    { id: 'ego', name: 'Despertar do Ego', price: 2000, description: 'Aumenta bastante a velocidade e potência de chute por 5 segundos.' }
  ],
  avatars: [
    {
      id: 'pfp_default',
      name: 'Brasão Padrão',
      price: 0,
      image: null,
      rarity: 'Inicial',
      description: 'Emblema padrão do atleta Litoball para usar desde a primeira partida.'
    },
    {
      id: 'pfp_isagi',
      name: 'Yoichi Isagi',
      price: 400,
      image: 'img/perfil/isagipfp.jpg',
      rarity: 'Egoísta',
      description: 'Foto de perfil oficial de Yoichi Isagi para exibir na sua Cartinha e Carreira.'
    },
    {
      id: 'pfp_kurona',
      name: 'Ranze Kurona',
      price: 500,
      image: 'img/perfil/kuronapfp.jpg',
      rarity: 'Tubarão Rápido',
      description: 'Foto de perfil exclusiva de Kurona, mestre das tabelas em alta velocidade.'
    },
    {
      id: 'pfp_aiku',
      name: 'Oliver Aiku',
      price: 700,
      image: 'img/perfil/aikupfp.jpg',
      rarity: 'Muralha Defensiva',
      description: 'Foto de perfil de Oliver Aiku com aura defensiva de capitão.'
    },
    {
      id: 'pfp_sae',
      name: 'Sae Itoshi',
      price: 800,
      image: 'img/perfil/saepfp.jpg',
      rarity: 'New Gen XI',
      description: 'Foto de perfil premium de Sae Itoshi para atletas de elite.'
    }
  ],
  cards: [
    {
      id: 'card_gold',
      name: 'Card Ouro Clássico',
      price: 0,
      theme: 'gold',
      badge: 'FUT',
      iconId: 'icon-card-gold',
      image: null,
      rarity: 'Ouro Lendário',
      description: 'Edição Ouro Lendário premium com filigrana geométrica, moldura dupla esculpida e brilho metálico.',
      colors: ['#fef08a', '#d97706', '#78350f']
    },
    {
      id: 'card_dino',
      name: 'Card Dinossauro',
      price: 1500,
      theme: 'dino',
      badge: 'REX',
      iconId: 'icon-card-dino',
      image: 'img/cards/dinocard.png',
      rarity: 'Pré-Histórico',
      description: 'Arte pré-histórica jurássica com T-Rex estilizado, iluminação esmeralda e bordas de âmbar.',
      colors: ['#86efac', '#15803d', '#14532d']
    },
    {
      id: 'card_waifu',
      name: 'Card Anime Waifu',
      price: 1800,
      theme: 'waifu',
      badge: 'KWI',
      iconId: 'icon-card-waifu',
      image: 'img/cards/waifucard.jpg',
      rarity: 'Kawaii Edition',
      description: 'Visual exclusivo estilo anime com acabamento perolado, bordas pastel e detalhes em rosa brilhante.',
      colors: ['#fbcfe8', '#f43f5e', '#be185d']
    },
    {
      id: 'card_isagi',
      name: 'Card Yoichi Isagi',
      price: 2000,
      theme: 'isagi',
      badge: 'ACE',
      iconId: 'icon-card-isagi',
      image: 'img/cards/isagicard.png',
      rarity: 'Blue Lock Ace',
      description: 'Tema cibernético com peças de quebra-cabeça holográficas, visão espacial e verde fluorescente.',
      colors: ['#4ade80', '#059669', '#064e3b']
    },
    {
      id: 'card_chigiri',
      name: 'Card Hyoma Chigiri',
      price: 2000,
      theme: 'chigiri',
      badge: 'SPD',
      iconId: 'icon-card-chigiri',
      image: 'img/cards/chigiricard.jpg',
      rarity: 'Pantera Vermelha',
      description: 'Tema da Pantera Vermelha em rosa-choque e rubi incandescente com faíscas cortantes de velocidade.',
      colors: ['#fda4af', '#e11d48', '#881337']
    },
    {
      id: 'card_kurumi',
      name: 'Card Kurumi',
      price: 2200,
      theme: 'kurumi',
      badge: 'KRM',
      iconId: 'icon-card-kurumi',
      image: 'img/cards/kurumicard.jpg',
      rarity: 'Crimson Clockwork',
      description: 'Edição sombria carmesim e ouro envelhecido com estética de engrenagens temporais e aura gótica.',
      colors: ['#fb7185', '#991b1b', '#1c1917']
    }
  ]
};

const PLAYER_POSITIONS = [
  { id: 'ATA', label: 'ATA · Atacante' },
  { id: 'MEI', label: 'MEI · Meia' },
  { id: 'ALA', label: 'ALA · Ala / Ponta' },
  { id: 'ZAG', label: 'ZAG · Zagueiro / Fixo' },
  { id: 'GOL', label: 'GOL · Goleiro-Linha' }
];

const NATIONALITIES = [
  { code: 'BR', name: 'Brasil' },
  { code: 'JP', name: 'Japão' },
  { code: 'AR', name: 'Argentina' },
  { code: 'FR', name: 'França' },
  { code: 'ES', name: 'Espanha' },
  { code: 'DE', name: 'Alemanha' },
  { code: 'EN', name: 'Inglaterra' },
  { code: 'PT', name: 'Portugal' },
  { code: 'IT', name: 'Itália' },
  { code: 'UY', name: 'Uruguai' }
];

function getNationalityInfo(code) {
  return NATIONALITIES.find(n => n.code === code) || NATIONALITIES[0];
}

function renderNationalityFlagSvg(code = 'BR', width = 22, height = 15) {
  const c = String(code || 'BR').toUpperCase();
  let shapes = '';
  if (c === 'BR') {
    shapes = `<rect width="24" height="16" fill="#16a34a"/><polygon points="12,2 21,8 12,14 3,8" fill="#facc15"/><circle cx="12" cy="8" r="3.2" fill="#1d4ed8"/><path d="M9.1 7.6c1.8-.8 3.9-.6 5.8.5" stroke="#fff" stroke-width="0.9" fill="none"/>`;
  } else if (c === 'JP') {
    shapes = `<rect width="24" height="16" fill="#f8fafc"/><circle cx="12" cy="8" r="4.2" fill="#dc2626"/>`;
  } else if (c === 'AR') {
    shapes = `<rect width="24" height="16" fill="#38bdf8"/><rect y="5.3" width="24" height="5.4" fill="#f8fafc"/><circle cx="12" cy="8" r="2" fill="#f59e0b"/>`;
  } else if (c === 'FR') {
    shapes = `<rect width="8" height="16" fill="#1d4ed8"/><rect x="8" width="8" height="16" fill="#f8fafc"/><rect x="16" width="8" height="16" fill="#dc2626"/>`;
  } else if (c === 'ES') {
    shapes = `<rect width="24" height="16" fill="#dc2626"/><rect y="4" width="24" height="8" fill="#facc15"/><rect x="5.5" y="6" width="3" height="4" rx="0.6" fill="#b91c1c"/>`;
  } else if (c === 'DE') {
    shapes = `<rect width="24" height="5.4" fill="#111827"/><rect y="5.3" width="24" height="5.4" fill="#dc2626"/><rect y="10.6" width="24" height="5.4" fill="#facc15"/>`;
  } else if (c === 'EN') {
    shapes = `<rect width="24" height="16" fill="#f8fafc"/><rect x="10.2" width="3.6" height="16" fill="#dc2626"/><rect y="6.2" width="24" height="3.6" fill="#dc2626"/>`;
  } else if (c === 'PT') {
    shapes = `<rect width="9.5" height="16" fill="#15803d"/><rect x="9.5" width="14.5" height="16" fill="#dc2626"/><circle cx="9.5" cy="8" r="2.8" fill="#facc15"/>`;
  } else if (c === 'IT') {
    shapes = `<rect width="8" height="16" fill="#16a34a"/><rect x="8" width="8" height="16" fill="#f8fafc"/><rect x="16" width="8" height="16" fill="#dc2626"/>`;
  } else {
    shapes = `<rect width="24" height="16" fill="#f8fafc"/><rect y="2.5" width="24" height="2" fill="#2563eb"/><rect y="6.5" width="24" height="2" fill="#2563eb"/><rect y="10.5" width="24" height="2" fill="#2563eb"/><rect width="9" height="8" fill="#f8fafc"/><circle cx="4.5" cy="4" r="2.1" fill="#f59e0b"/>`;
  }
  return `<svg class="nat-flag-svg" viewBox="0 0 24 16" width="${width}" height="${height}" aria-hidden="true">${shapes}</svg>`;
}

function renderAvatarMediaHtml(avatarId, extraClass = '') {
  const list = ITEMS.avatars || [];
  const av = list.find(a => a.id === avatarId) || list[0];
  if (av && av.image) {
    const safeAlt = String(av.name || 'Foto de Perfil').replace(/"/g, '&quot;');
    return `<img class="pfp-img ${extraClass}" src="${av.image}" alt="${safeAlt}" decoding="async" onerror="this.hidden=true;if(this.nextElementSibling)this.nextElementSibling.hidden=false;" /><span class="pfp-svg-fallback" hidden>${getSvgIcon('icon-career', 26)}</span>`;
  }
  return `<span class="pfp-default-badge ${extraClass}">${getSvgIcon('icon-career', 26)}</span>`;
}

function renderCardBadgeIcon(cardData, size = 20) {
  if (!cardData) return getSvgIcon('icon-card', size);
  if (cardData.iconId) return getSvgIcon(cardData.iconId, size, 'svg-card-emblem');
  return getSvgIcon('icon-card', size);
}

function renderCardArtHtml(cardData, extraClass = '') {
  if (!cardData || !cardData.image) return '';
  const safeAlt = String(cardData.name || '').replace(/"/g, '&quot;');
  const cls = extraClass ? `card-bg-img ${extraClass}` : 'card-bg-img';
  return `<img class="${cls}" src="${cardData.image}" alt="${safeAlt}" decoding="async" onerror="this.hidden=true;" />`;
}

function getSvgIcon(symbolId, size = 18, extraClass = '') {
  const cls = extraClass ? `svg-icon ${extraClass}` : 'svg-icon';
  return `<svg class="${cls}" width="${size}" height="${size}" aria-hidden="true"><use href="#${symbolId}"></use></svg>`;
}

const SKILL_ICON_IDS = {
  cannon: 'icon-skill-cannon',
  sprint: 'icon-skill-sprint',
  phantom: 'icon-skill-phantom',
  vision: 'icon-skill-vision',
  curve: 'icon-skill-curve',
  twoOne: 'icon-skill-twoOne',
  snakeTackle: 'icon-skill-snakeTackle',
  control: 'icon-skill-control',
  eagle: 'icon-skill-eagle',
  sniper: 'icon-skill-sniper',
  shadow: 'icon-skill-shadow',
  ego: 'icon-skill-ego'
};

const SKILL_ICONS = Object.fromEntries(
  Object.entries(SKILL_ICON_IDS).map(([id, sym]) => [id, getSvgIcon(sym, 22, 'svg-skill-icon')])
);

const POWER_IMAGES = {
  cannon: 'img/icones dos poderes/isagi.jpg',
  sprint: 'img/icones dos poderes/chigiri.jpg',
  phantom: 'img/icones dos poderes/bachira.jpg',
  vision: 'img/icones dos poderes/niko.jpg',
  curve: 'img/icones dos poderes/rin.jpg',
  twoOne: 'img/icones dos poderes/kurona.jpg',
  snakeTackle: 'img/icones dos poderes/aiku.jpg',
  control: 'img/icones dos poderes/nagi.jpg',
  eagle: 'img/icones dos poderes/aryu.jpg',
  sniper: 'img/icones dos poderes/barou.jpg',
  shadow: 'img/icones dos poderes/karasu.jpg',
  ego: 'img/icones dos poderes/sae.jpg'
};

function renderPowerIconMedia(powerId, fallbackSize = 22, altText = '') {
  const fallback = getSvgIcon(SKILL_ICON_IDS[powerId] || 'icon-bolt', fallbackSize, 'svg-skill-icon');
  const src = POWER_IMAGES[powerId];
  if (!src) return fallback;
  const safeAlt = String(altText || '').replace(/"/g, '&quot;');
  return `
    <span class="item-power-frame">
      <img
        class="item-power-img"
        src="${src}"
        alt="${safeAlt}"
        loading="lazy"
        decoding="async"
        onerror="this.hidden=true;if(this.nextElementSibling)this.nextElementSibling.hidden=false;"
      />
      <span class="item-power-fallback" hidden aria-hidden="true">${fallback}</span>
    </span>
  `;
}

const POWER_COOLDOWNS = {
  cannon: 8,
  sprint: 12,
  phantom: 12,
  vision: 16,
  curve: 12,
  twoOne: 18,
  snakeTackle: 20,
  control: 10,
  eagle: 11,
  sniper: 14,
  shadow: 15,
  ego: 18
};

const POWER_LABELS = Object.fromEntries(ITEMS.powers.map(p => [p.id, p.name]));
const PHANTOM_UPGRADE_COSTS = { 2: 1000, 3: 1800 };

const PITCH_THEMES = [
  {
    id: 'classic',
    name: 'Campo Clássico',
    subtitle: 'Grama verde tradicional',
    accent: '#22c55e'
  },
  {
    id: 'futsal',
    name: 'Quadra de Futsal',
    subtitle: 'Madeira envernizada de salão',
    accent: '#f59e0b'
  },
  {
    id: 'cyber',
    name: 'Arena Futurista',
    subtitle: 'Cyber-Arena neon holográfica',
    accent: '#38bdf8'
  },
  {
    id: 'jurassic',
    name: 'Arena Jurássica',
    subtitle: 'Solo vulcânico, fóssil T-Rex e âmbar',
    accent: '#f59e0b'
  }
];

const MISSIONS_CATALOG = {
  daily: [
    { id: 'd_play_2', title: 'Aquecimento na Arena', desc: 'Jogue 2 partidas oficiais (1v1 ou 2v2).', target: 2, reward: 120 },
    { id: 'd_goals_5', title: 'Faro de Gol', desc: 'Marque 5 gols em partidas (1v1 ou 2v2).', target: 5, reward: 150 },
    { id: 'd_powers_4', title: 'Mestre das Habilidades', desc: 'Ative qualquer poder equipado 4 vezes.', target: 4, reward: 140 },
    { id: 'd_win_1', title: 'Vencedor do Dia', desc: 'Vença 1 partida no modo 1v1 ou 2v2.', target: 1, reward: 220 }
  ],
  weekly: [
    { id: 'w_play_10', title: 'Maratona Semanal', desc: 'Complete 10 partidas oficiais na semana.', target: 10, reward: 600 },
    { id: 'w_goals_25', title: 'Artilharia Pesada', desc: 'Marque 25 gols somados em 1v1 e 2v2.', target: 25, reward: 750 },
    { id: 'w_wins_5', title: 'Sequência Vitoriosa', desc: 'Conquiste 5 vitórias em partidas oficiais.', target: 5, reward: 900 },
    { id: 'w_win_2v2_3', title: 'Sintonia de Dupla', desc: 'Vença 3 partidas no modo 2v2 — Duplas.', target: 3, reward: 850 }
  ],
  lifetime: [
    { id: 'l_first_goal', title: 'Primeiro Gol na História', desc: 'Marque seu 1º gol em partida oficial.', target: 1, reward: 500 },
    { id: 'l_unlock_3', title: 'Colecionador de Elite', desc: 'Desbloqueie 3 itens (camisas ou poderes) na Loja.', target: 3, reward: 1200 },
    { id: 'l_win_1v1_5', title: 'Rei do Duelo 1v1', desc: 'Vença 5 partidas no modo clássico 1v1.', target: 5, reward: 1500 },
    { id: 'l_win_2v2_5', title: 'Campeão das Duplas', desc: 'Vença 5 partidas no modo 2v2.', target: 5, reward: 1800 },
    { id: 'l_goals_50', title: 'Artilheiro Lendário', desc: 'Alcance 50 gols marcados em partidas oficiais.', target: 50, reward: 2500 },
    { id: 'l_matches_25', title: 'Veterano do Litoball', desc: 'Conclua 25 partidas oficiais na carreira.', target: 25, reward: 3000 }
  ]
};

const DEFAULT_CONTROLS = {
  kickKey: 'Space',
  powerKey: 'KeyQ'
};

const RESERVED_KEYS = [
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyF', 'Escape'
];

function formatKeyLabel(code) {
  if (!code) return '?';
  if (code === 'Space') return 'ESPAÇO';
  if (code === 'Enter' || code === 'NumpadEnter') return 'ENTER';
  if (code === 'ShiftLeft') return 'SHIFT ESQ';
  if (code === 'ShiftRight') return 'SHIFT DIR';
  if (code === 'ControlLeft') return 'CTRL ESQ';
  if (code === 'ControlRight') return 'CTRL DIR';
  if (code === 'AltLeft') return 'ALT ESQ';
  if (code === 'AltRight') return 'ALT DIR';
  if (code === 'Tab') return 'TAB';
  if (code === 'Backspace') return 'BACKSPACE';
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  if (code === 'ArrowLeft') return '←';
  if (code === 'ArrowRight') return '→';
  if (code.startsWith('Key')) return code.slice(3).toUpperCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  return code.toUpperCase();
}

const CONFIG = {
  canvasWidth: 1000,
  canvasHeight: 600,

  // Regras da Partida
  rules: {
    matchDurationSeconds: 180, // 3 minutos de partida
    goalsToWin: 5              // Primeiro a 5 gols vence
  },

  // Linhas do campo de jogo
  pitch: {
    left: 120,
    right: 880,
    top: 65,
    bottom: 535,
    get width() { return this.right - this.left; },
    get height() { return this.bottom - this.top; },
    get centerX() { return (this.left + this.right) / 2; },
    get centerY() { return (this.top + this.bottom) / 2; },
    centerRadius: 85,
    penaltyWidth: 120,
    penaltyHeight: 250,
    goalAreaWidth: 45,
    goalAreaHeight: 140,
    lineWidth: 3.5
  },

  // Margens físicas externas do estádio (limite absoluto para jogadores e bola)
  stadium: {
    minX: 42,
    maxX: 958,
    minY: 22,
    maxY: 578
  },

  // Dimensões e parâmetros das traves
  goals: {
    depth: 65,
    topY: 235,
    bottomY: 365,
    postRadius: 8.5,
    netColor: 'rgba(255, 255, 255, 0.45)'
  },

  // Calibração da Física
  physics: {
    fixedDelta: 1 / 60,       // 60 atualizações por segundo cravadas
    playerAcceleration: 0.3249, // Aceleração mais 5% menor para um ritmo mais controlado
    playerMaxSpeed: 3.705,      // Velocidade máxima dos jogadores mais 5% menor
    dampingPlayer: 0.92,      // Amortecimento inercial do botão
    dampingBall: 0.988,       // Desaceleração orgânica da bola no gramado
    ballMaxSpeed: 9.747,      // Limite de velocidade da bola mais 5% menor
    restitutionPlayer: 0.65,  // Choque elástico entre botões
    restitutionBall: 0.82,    // Quique da bola em corpos rígidos
    restitutionWall: 0.85,    // Quique da bola em paredes e postes
    kickPower: 7.4005,        // Força base do chute mais 5% menor
    kickReachMargin: 9,       // Distância de alcance para acionar o chute
    kickCooldown: 0.28        // Tempo mínimo entre chutes (segundos)
  }
};

const PITCH_LAYOUTS = {
  training: {
    canvasWidth: 1000, canvasHeight: 600,
    left: 120, right: 880, top: 65, bottom: 535, goalHeight: 130,
    centerRadius: 85, penaltyWidth: 120, penaltyHeight: 250, goalAreaWidth: 45, goalAreaHeight: 140
  },
  match: {
    canvasWidth: 1000, canvasHeight: 600,
    left: 120, right: 880, top: 65, bottom: 535, goalHeight: 130,
    centerRadius: 85, penaltyWidth: 120, penaltyHeight: 250, goalAreaWidth: 45, goalAreaHeight: 140
  },
  '2v2': {
    canvasWidth: 1080, canvasHeight: 640,
    left: 80, right: 1000, top: 38, bottom: 602, goalHeight: 156,
    centerRadius: 90, penaltyWidth: 134, penaltyHeight: 274, goalAreaWidth: 50, goalAreaHeight: 160
  },
  '3v3': {
    canvasWidth: 1200, canvasHeight: 710,
    left: 84, right: 1116, top: 42, bottom: 668, goalHeight: 174,
    centerRadius: 98, penaltyWidth: 148, penaltyHeight: 304, goalAreaWidth: 56, goalAreaHeight: 182
  },
  '4v4': {
    canvasWidth: 1380, canvasHeight: 820,
    left: 90, right: 1290, top: 44, bottom: 776, goalHeight: 196,
    centerRadius: 110, penaltyWidth: 170, penaltyHeight: 348, goalAreaWidth: 64, goalAreaHeight: 208
  },
  '5v5': {
    canvasWidth: 1520, canvasHeight: 900,
    left: 96, right: 1424, top: 46, bottom: 854, goalHeight: 214,
    centerRadius: 120, penaltyWidth: 188, penaltyHeight: 382, goalAreaWidth: 70, goalAreaHeight: 226
  }
};

function getModePaceScale(mode) {
  const m = mode || (typeof gameMode === 'string' ? gameMode : 'match');
  if (m === '5v5') return { player: 0.82, ball: 1.16, kickPower: 1.22 };
  if (m === '4v4') return { player: 0.88, ball: 1.12, kickPower: 1.18 };
  if (m === '3v3') return { player: 0.95, ball: 1.08, kickPower: 1.12 };
  return { player: 1.0, ball: 1.0, kickPower: 1.0 };
}
