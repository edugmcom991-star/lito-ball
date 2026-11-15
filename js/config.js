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
    { id: 'sprint', name: 'Arrancada Relâmpago', price: 800, description: 'Explosão de velocidade por 4 segundos.' },
    { id: 'phantom', name: 'Drible Fantasma', price: 1200, description: 'Com a bola dominada, corta para o lado e escapa de botes.' },
    { id: 'vision', name: 'Visão de Campo', price: 1000, description: 'Por 20s, revela padrões táticos, aumenta a velocidade e libera um passe longo, curvo e teleguiado para um aliado.' },
    { id: 'curve', name: 'Curva Impossível', price: 1200, description: 'Mostra a prévia em arco e dispara um chute com efeito Magnus letal rumo ao gol.' },
    { id: 'twoOne', name: 'Toque e Passa', price: 1500, description: 'Tabela rápida com devolução de primeira e arrancada.' },
    { id: 'snakeTackle', name: 'Bote da Serpente', price: 1500, description: 'Avança em bote instantâneo contra o portador para desarmar com precisão.' },
    { id: 'control', name: 'Domínio Perfeito', price: 800, description: 'Amortece e cola a bola no pé instantaneamente ao ativar perto dela.' },
    { id: 'eagle', name: 'Salto de Águia', price: 1000, description: 'Estende bem o alcance do próximo chute ou interceptação até executar o golpe.' },
    { id: 'sniper', name: 'Instinto de Artilheiro', price: 1500, description: 'Chute potente e certeiro ao finalizar na zona ofensiva.' },
    { id: 'shadow', name: 'Sombra do Marcador', price: 1200, description: 'Marcação cerrada automática acompanhando o adversário com a bola por 4 segundos.' },
    { id: 'ego', name: 'Despertar do Ego', price: 2000, description: 'Aumenta bastante a velocidade e potência de chute por 5 segundos.' }
  ]
};

const SKILL_ICONS = {
  cannon: '🔫',
  sprint: '⚡',
  phantom: '👻',
  vision: '👁️',
  curve: '🌀',
  twoOne: '🔄',
  snakeTackle: '🐍',
  control: '🧲',
  eagle: '🦅',
  sniper: '🎯',
  shadow: '🛡️',
  ego: '🔥'
};

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
  shadow: 14,
  ego: 18
};

const POWER_LABELS = Object.fromEntries(ITEMS.powers.map(p => [p.id, p.name]));
const PHANTOM_UPGRADE_COSTS = { 2: 1000, 3: 1800 };

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
  match: { left: 120, right: 880, top: 65, bottom: 535, goalHeight: 130 },
  '2v2': { left: 72, right: 928, top: 32, bottom: 568, goalHeight: 154 }
};
