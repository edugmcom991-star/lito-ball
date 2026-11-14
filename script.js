/**
 * ==========================================================================
 * LITO BALL - FUTEBOL DE BOTÃO 2D (HAXBALL ARCADE)
 * ARQUITETURA MODULAR (script.js)
 * ==========================================================================
 * Suporta:
 *  - Física determinística em 60 FPS (Fixed Timestep independente de Hz do monitor)
 *  - Sub-stepping e barreiras anti-tunelamento (a bola nunca atravessa o estádio)
 *  - Chute direcional limpo (elimina o bug de elástico / rebote reverso)
 *  - Limite de tempo regressivo (3 minutos) e regra de ouro de 5 gols para vitória
 *  - Sistema de Assets pronto para substituição por Sprites (PNG/SVG)
 */

'use strict';

/* ==========================================================================
   0. SISTEMA DE ECONOMIA — LITO COINS (localStorage)
   ========================================================================== */
const ECONOMY = {
  LS_KEY_COINS:  'litoBall_coins',
  LS_KEY_STATS:  'litoBall_stats',
  LS_KEY_PROFILE: 'litoBall_profile',
  WELCOME_BONUS: 500000,

  REWARDS: {
    win:     100,
    draw:    40,
    loss:    20,
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
        const credit=this.WELCOME_BONUS-balance;
        localStorage.setItem(this.LS_KEY_COINS, this.WELCOME_BONUS);
        try { const stats=JSON.parse(localStorage.getItem(this.LS_KEY_STATS)||'{}');stats.totalEarned=(stats.totalEarned||0)+credit;localStorage.setItem(this.LS_KEY_STATS,JSON.stringify(stats)); } catch(e) {}
      }
      localStorage.setItem('litoBall_testCreditApplied', 'yes');
    }
  },

  /** Retorna saldo atual como número inteiro */
  getCoins() {
    return parseInt(localStorage.getItem(this.LS_KEY_COINS) || '0', 10);
  },
  profile() {
    try { return JSON.parse(localStorage.getItem(this.LS_KEY_PROFILE) || '{"ownedShirts":["classic"],"ownedPowers":[],"powerLevels":{},"equippedShirt":"classic","equippedPower":null,"volume":70,"muted":false}'); } catch (e) { return { ownedShirts:['classic'], ownedPowers:[], powerLevels:{}, equippedShirt:'classic', equippedPower:null, volume:70, muted:false }; }
  },
  saveProfile(profile) { localStorage.setItem(this.LS_KEY_PROFILE, JSON.stringify(profile)); },

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

  /** Gasta moedas — retorna false se saldo insuficiente (pronto para a futura loja) */
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

// Inicializa a economia ao carregar o script
ECONOMY.load();

const ITEMS = {
  shirts: [
    {id:'flamengo',name:'Flamengo',price:500,description:'Camisa rubro-negra com escudo vetorial CRF.',colors:['#171717','#c8102e'],badge:'CRF'},
    {id:'vasco',name:'Vasco da Gama',price:750,description:'Camisa preta e branca com faixa diagonal e cruz.',colors:['#111111','#f5f5f5'],badge:'✚'},
    {id:'santos',name:'Santos',price:1000,description:'Listras alvinegras com detalhes dourados.',colors:['#111111','#f8f8f8'],badge:'SFC'},
    {id:'decisao',name:'Decisão Futebol Clube',price:1500,description:'Camisa azul e branca com escudo DFC.',colors:['#1769aa','#f2f7ff'],badge:'DFC'}
  ],
  powers: [
    {id:'cannon',name:'Chute de Canhão',price:1000,description:'Próximo chute ganha força moderada.'},
    {id:'sprint',name:'Arrancada Relâmpago',price:800,description:'Aumenta a velocidade por 4 segundos.'},
    {id:'phantom',name:'Drible Fantasma',price:1200,description:'Com a bola dominada, corta para o lado e tenta escapar de um bote.'},
    {id:'vision',name:'Visão de Campo',price:1000,description:'Por 20s, revela padrões táticos, dá velocidade e libera passes teleguiados.'},
    {id:'curve',name:'Curva Impossível',price:1200,description:'Permite mirar um chute ou passe que curva suavemente durante a trajetória.'},
    {id:'twoOne',name:'Toque e Passa',price:1500,description:'Combina um passe curto com uma devolução de primeira e uma arrancada para receber.'},
    {id:'snakeTackle',name:'Bote da Serpente',price:1500,description:'Mire um bote em faixa curta para tentar desarmar um rival ou desviar a bola.'},
    {id:'control',name:'Domínio Perfeito',price:800,description:'Amortece a bola no próximo contato.'},
    {id:'eagle',name:'Salto de Águia',price:1000,description:'Aumenta o alcance do próximo chute.'},
    {id:'sniper',name:'Instinto de Artilheiro',price:1500,description:'Bônus leve ao finalizar perto do gol.'},
    {id:'shadow',name:'Sombra do Marcador',price:1200,description:'Acompanha de perto o bot por 4 segundos.'},
    {id:'ego',name:'Despertar do Ego',price:2000,description:'Velocidade e força levemente maiores por 5 segundos.'}
  ]
};
let profile = ECONOMY.profile();
profile.ownedShirts=profile.ownedShirts||['classic'];profile.ownedPowers=profile.ownedPowers||[];profile.powerLevels=profile.powerLevels||{};

/* ==========================================================================
   1. CONFIGURAÇÕES GERAIS E GEOMETRIA DO JOGO
   ========================================================================== */
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

  // Calibração da Física (Equilibrada, cadenciada e suave)
  physics: {
    fixedDelta: 1 / 60,       // 60 atualizações por segundo cravadas
    playerAcceleration: 0.44, // Aceleração suave por frame
    playerMaxSpeed: 4.8,      // Velocidade máxima cadenciada do botão
    dampingPlayer: 0.92,      // Amortecimento inercial do botão
    dampingBall: 0.988,       // Desaceleração orgânica da bola no gramado
    ballMaxSpeed: 12.8,       // Limite de velocidade seguro contra tunelamento
    restitutionPlayer: 0.65,  // Choque elástico entre botões
    restitutionBall: 0.82,    // Quique da bola em corpos rígidos
    restitutionWall: 0.85,    // Quique da bola em paredes e postes
    kickPower: 9.6,           // Força direcional do chute
    kickReachMargin: 9,       // Distância de alcance para acionar o chute
    kickCooldown: 0.28        // Tempo mínimo entre chutes (segundos)
  }
};
const PITCH_LAYOUTS = {
  match: {left:120,right:880,top:65,bottom:535,goalHeight:130},
  '2v2': {left:72,right:928,top:32,bottom:568,goalHeight:154}
};

/* ==========================================================================
   2. GERENCIADOR DE ASSETS E SPRITES (FÁCIL EXTENSÃO FUTURA)
   ========================================================================== */
class AssetManager {
  constructor() {
    this.sprites = {
      ball: null,
      player1: null,
      player2: null,
      pitchTexture: null
    };
    this.isLoaded = false;
  }

  /**
   * Permite carregar sprites facilmente no futuro:
   * assets.loadSprite('ball', 'caminho/para/bola.png');
   */
  loadSprite(key, src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.sprites[key] = img;
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  hasSprite(key) {
    return this.sprites[key] !== null && this.sprites[key].complete;
  }
}

const assets = new AssetManager();

/* ==========================================================================
   3. SISTEMA DE ÁUDIO SINTETIZADO (WEB AUDIO API)
   ========================================================================== */
const Sound = {
  ctx: null,
  masterGain: null,
  volume: 0.7,
  muted: false,
  assetAudio: {
    lightning: 'sfx/flutie8211-ray-gun-blast-1-546936.mp3',
    cannon: 'sfx/cannon.mp3',
    phantom: 'sfx/dragon-studio-ghost-horror-sound-382709.mp3',
    curvedKick: 'sfx/chute curv.mp3'
  },
  activeAssetSounds: [],
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) { this.ctx = new AudioCtx(); this.masterGain=this.ctx.createGain(); this.masterGain.connect(this.ctx.destination); this.applyVolume(); }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },
  applyVolume() {
    if(this.masterGain) this.masterGain.gain.setTargetAtTime(this.muted?0:this.volume,this.ctx.currentTime,0.03);
    this.activeAssetSounds=this.activeAssetSounds.filter(audio=>!audio.ended);
    this.activeAssetSounds.forEach(audio=>audio.volume=this.muted?0:this.volume);
  },
  playAsset(name, fallback) {
    if(typeof Audio==='undefined') { fallback.call(this); return; }
    const audio=new Audio(this.assetAudio[name]); audio.preload='auto'; audio.volume=this.muted?0:this.volume;
    this.activeAssetSounds.push(audio);
    audio.addEventListener('ended',()=>{this.activeAssetSounds=this.activeAssetSounds.filter(item=>item!==audio);},{once:true});
    const playback=audio.play(); if(playback&&playback.catch)playback.catch(()=>{this.activeAssetSounds=this.activeAssetSounds.filter(item=>item!==audio);fallback.call(this);});
  },
  playNoiseBurst(duration, filterType, startFreq, endFreq, peak, delay=0) {
    if (!this.ctx) return;
    try {
      const now=this.ctx.currentTime+delay;
      const samples=Math.ceil(this.ctx.sampleRate*duration);
      const buffer=this.ctx.createBuffer(1,samples,this.ctx.sampleRate);
      const data=buffer.getChannelData(0);
      for(let i=0;i<samples;i++) data[i]=(Math.random()*2-1)*(1-i/samples);
      const source=this.ctx.createBufferSource(); source.buffer=buffer;
      const filter=this.ctx.createBiquadFilter(); filter.type=filterType;
      filter.frequency.setValueAtTime(startFreq,now); filter.frequency.exponentialRampToValueAtTime(Math.max(40,endFreq),now+duration);
      const gain=this.ctx.createGain(); gain.gain.setValueAtTime(0.001,now); gain.gain.exponentialRampToValueAtTime(peak,now+0.012); gain.gain.exponentialRampToValueAtTime(0.001,now+duration);
      source.connect(filter);filter.connect(gain);gain.connect(this.masterGain||this.ctx.destination);source.start(now);source.stop(now+duration);
    } catch(e) {}
  },
  playLightning() {
    this.playAsset('lightning',this.playLightningSynth);
  },
  playLightningSynth() {
    this.playNoiseBurst(0.42,'bandpass',5200,220,0.34);
    this.playNoiseBurst(0.72,'lowpass',900,65,0.24,0.12);
    if(!this.ctx)return;
    try { const now=this.ctx.currentTime+0.08;const osc=this.ctx.createOscillator();const gain=this.ctx.createGain();osc.type='triangle';osc.frequency.setValueAtTime(125,now);osc.frequency.exponentialRampToValueAtTime(42,now+0.42);gain.gain.setValueAtTime(0.18,now);gain.gain.exponentialRampToValueAtTime(0.001,now+0.48);osc.connect(gain);gain.connect(this.masterGain||this.ctx.destination);osc.start(now);osc.stop(now+0.5); } catch(e) {}
  },
  playCannon() {
    this.playAsset('cannon',this.playCannonSynth);
  },
  playPhantom() {
    this.playAsset('phantom',this.playLightningSynth);
  },
  playCannonSynth() {
    this.playNoiseBurst(0.19,'lowpass',2200,170,0.42);
    if(!this.ctx)return;
    try { const now=this.ctx.currentTime;const osc=this.ctx.createOscillator();const gain=this.ctx.createGain();osc.type='sawtooth';osc.frequency.setValueAtTime(170,now);osc.frequency.exponentialRampToValueAtTime(48,now+0.22);gain.gain.setValueAtTime(0.32,now);gain.gain.exponentialRampToValueAtTime(0.001,now+0.24);osc.connect(gain);gain.connect(this.masterGain||this.ctx.destination);osc.start(now);osc.stop(now+0.25); } catch(e) {}
  },
  playKick() {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.08);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  },
  playCurvedKick() {
    this.playAsset('curvedKick',this.playKick);
  },
  playPost() {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(1150, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.12);
      gain.gain.setValueAtTime(0.20, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  },
  playGoal() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [0, 0.14, 0.28].forEach((offset, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200 + idx * 300, now + offset);
        gain.gain.setValueAtTime(0.18, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.12);
        osc.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.12);
      });
    } catch (e) {}
  },
  playWhistle() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [0, 0.18].forEach(offset => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(2200, now + offset);
        gain.gain.setValueAtTime(0.15, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.14);
        osc.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.14);
      });
    } catch (e) {}
  }
};
Sound.volume=(profile.volume??70)/100; Sound.muted=!!profile.muted;

/* ==========================================================================
   4. ENTIDADES: JOGADOR, BOLA, POSTES E PARTÍCULAS
   ========================================================================== */

/**
 * Classe Player (Botão)
 */
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
    this.aiPowerThink = 6 + Math.random() * 3;
    this.aiPowerId = null;

    // Controle de Chute
    this.kickCooldownTimer = 0;
    this.kickRingTimer = 0;
    this.ignoreBallCollisionFrames = 0; // Previne colisão elástica no frame do chute
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
    this.twoOneRunTimer = 0;
    this.powerEffect=null;this.powerEffectTimer=0;
    this.ghostCutTimer = 0;
    this.ghostTrailTimer = 0;
    this.ghostDodgeUsed = false;
    this.ghostDodgeSuccess = false;
    this.phantomDribbleTimer = 0;
    this.visionRunTimer = 0;
    this.tackleStaggerTimer = 0;
  }

  update(dt) {
    if (this.powerCooldown > 0) this.powerCooldown = Math.max(0, this.powerCooldown - dt);
    if (this.powerEffectTimer > 0) {
      this.powerEffectTimer = Math.max(0,this.powerEffectTimer-dt);
      if(this.powerEffectTimer===0){
        if(this.powerEffect==='vision')this.powerCooldown=POWER_COOLDOWNS.vision;
        this.powerEffect=null;
      }
    }
    if (this.dashTimer > 0) this.dashTimer = Math.max(0, this.dashTimer - dt);
    if (this.twoOneRunTimer > 0) this.twoOneRunTimer = Math.max(0,this.twoOneRunTimer-dt);
    if (this.visionRunTimer > 0) this.visionRunTimer = Math.max(0,this.visionRunTimer-dt);
    if (this.tackleStaggerTimer > 0) this.tackleStaggerTimer = Math.max(0,this.tackleStaggerTimer-dt);
    if (this.ghostCutTimer > 0) this.ghostCutTimer = Math.max(0, this.ghostCutTimer - dt);
    if (this.phantomDribbleTimer > 0) this.phantomDribbleTimer = Math.max(0,this.phantomDribbleTimer-dt);
    if (this.ghostTrailTimer > 0) this.ghostTrailTimer -= dt;
    if (this.kickCooldownTimer > 0) this.kickCooldownTimer -= dt;
    if (this.kickRingTimer > 0) this.kickRingTimer -= dt;
    if (this.ignoreBallCollisionFrames > 0) this.ignoreBallCollisionFrames--;

    // Fricção inercial
    this.vx *= CONFIG.physics.dampingPlayer;
    this.vy *= CONFIG.physics.dampingPlayer;

    // Limite de velocidade máxima do botão
    const currentSpeed = Math.hypot(this.vx, this.vy);
    const maxSpeed = this.dashTimer > 0 ? 10.5 : this.twoOneRunTimer > 0 ? 7.6 : this.ghostCutTimer > 0 ? 6.2 : CONFIG.physics.playerMaxSpeed * (this.powerEffect === 'sprint' ? 1.32 : this.powerEffect === 'ego' ? 1.12 : this.powerEffect === 'vision' ? 1.08 : 1);
    if (currentSpeed > maxSpeed) {
      this.vx = (this.vx / currentSpeed) * maxSpeed;
      this.vy = (this.vy / currentSpeed) * maxSpeed;
    }

    this.x += this.vx;
    this.y += this.vy;

    this.resolveStadiumBounds();
  }

  /**
   * Chute com vetor limpo e direcional:
   * Elimina completamente o "efeito elástico" e repulsão invertida.
   */
  tryKick(ball, inputDirX = 0, inputDirY = 0, isPass = false, guidedTarget = null) {
    if (this.kickCooldownTimer > 0) return false;
    const curvedKick=this.powerEffect==='curve';

    const dx = ball.x - this.x;
    const dy = ball.y - this.y;
    const dist = Math.hypot(dx, dy);
    const kickReach = this.radius + ball.radius + CONFIG.physics.kickReachMargin * (this.nextKickReach || 1);

    if (dist <= kickReach) {
      this.kickRingTimer = 0.15;
      this.kickCooldownTimer = CONFIG.physics.kickCooldown;
      if(isPass){
        ball.passTarget=guidedTarget;ball.passSource=this;ball.passExpiry=2.8;ball.passWasVision=this===player1&&gameMode==='2v2'&&this.powerEffect==='vision';
        if(this.powerEffect==='vision'){ball.visionPassAssistTimer=1.5;ball.visionPassAssistEnabled=Math.random()<.78;}
      }
      else {ball.passTarget=null;ball.passSource=null;ball.passExpiry=0;ball.passWasVision=false;if(gameMode==='2v2'&&twoVtwoStats)twoVtwoStats.passStreak=0;}
      this.ignoreBallCollisionFrames = 4; // Desativa colisão elástica reversa temporariamente
      ball.dribbleLockTimer=0.42;
      ball.dribbleLockOwner=this;

      // Vetor normalizado do centro do jogador para a bola
      let nx = dist > 0.0001 ? dx / dist : (this.isHuman ? 1 : -1);
      let ny = dist > 0.0001 ? dy / dist : 0;

      // O passe guiado prioriza a posição do companheiro, mantendo um toque do contato físico.
      if(guidedTarget){
        const tx=guidedTarget.x-ball.x,ty=guidedTarget.y-ball.y,targetLen=Math.hypot(tx,ty)||1;
        nx=nx*0.12+(tx/targetLen)*0.88;ny=ny*0.12+(ty/targetLen)*0.88;
        const len=Math.hypot(nx,ny)||1;nx/=len;ny/=len;
      } else {
      // Se o jogador estiver intencionalmente se movimentando, pondera a direção do chute
      const hasInput = Math.hypot(inputDirX, inputDirY) > 0.1;
      if (hasInput) {
        const inputLen = Math.hypot(inputDirX, inputDirY);
        const inX = inputDirX / inputLen;
        const inY = inputDirY / inputLen;

        // A Curva privilegia a mira informada pelo jogador; chutes comuns preservam a direção do contato.
        const contactWeight=curvedKick?0.30:0.70;
        nx = nx * contactWeight + inX * (1-contactWeight);
        ny = ny * contactWeight + inY * (1-contactWeight);
        const combinedLen = Math.hypot(nx, ny) || 1;
        nx /= combinedLen;
        ny /= combinedLen;
      }
      }

      // 1. SEPARAÇÃO IMEDIATA: afasta a bola para fora do raio do botão
      const targetDist = this.radius + ball.radius + 2.5;
      ball.x = this.x + nx * targetDist;
      ball.y = this.y + ny * targetDist;

      // 2. VELOCIDADE RESULTANTE LIMPA: substitui inércia residual contrária
      const kickMultiplier=this.nextKickPower||1;
      let power = CONFIG.physics.kickPower * kickMultiplier * (isPass ? 0.9 : 1);
      if (this.powerEffect === 'ego') power *= 1.12;
      if (this.powerEffect === 'sniper' && (this.isHuman ? this.x > 700 : this.x < 300)) power *= 1.10;
      ball.vx = nx * power;
      ball.vy = ny * power;
      if(kickMultiplier>1.5) { ball.powerShotTimer=0.9; Sound.playCannon(); }
      if (curvedKick) {
        const requestedSide=this.isHuman?(input.up?-1:input.down?1:(this.y<CONFIG.pitch.centerY?1:-1)):(this.y<CONFIG.pitch.centerY?1:-1);
        ball.curveTimer=1.05;ball.curveSide=requestedSide;ball.curveRate=0.82;ball.curveTrail=[];
        this.powerEffect=null;this.powerEffectTimer=0;this.powerCooldown=POWER_COOLDOWNS.curve;
      }
      if (this.powerEffect === 'sniper') { this.powerEffect=null; this.powerEffectTimer=0; }
      this.nextKickPower = 1;
      this.nextKickReach = 1;

      // Leve recuo no jogador
      this.vx -= nx * 0.6;
      this.vy -= ny * 0.6;

      addImpactSpark(ball.x, ball.y);
      if(curvedKick) Sound.playCurvedKick();
      else if(kickMultiplier<=1.5) Sound.playKick();
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
    // Verificação de Sprite personalizado no AssetManager
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

    // Renderizador Vetorial Procedural de Alta Qualidade
    renderCtx.save();

    // Sombra projetada
    renderCtx.beginPath();
    renderCtx.arc(this.x, this.y + 3, this.radius + 1, 0, Math.PI * 2);
    renderCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    renderCtx.fill();

    // Anel de Chute (Kick Ring Feedback)
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
        renderCtx.save(); renderCtx.beginPath(); renderCtx.arc(this.x,this.y,this.radius-2,0,Math.PI*2); renderCtx.clip();
        renderCtx.fillStyle=shirt.colors[0]; renderCtx.fillRect(this.x-this.radius,this.y-this.radius,this.radius*2,this.radius*2);
        renderCtx.fillStyle=shirt.colors[1];
        if(shirt.id==='vasco') { renderCtx.beginPath(); renderCtx.moveTo(this.x-this.radius,this.y-this.radius*.55); renderCtx.lineTo(this.x+this.radius,this.y+this.radius*.55); renderCtx.lineTo(this.x+this.radius,this.y+this.radius*.82); renderCtx.lineTo(this.x-this.radius,this.y-this.radius*.28); renderCtx.fill(); }
        else { for(let sx=this.x-this.radius;sx<this.x+this.radius;sx+=shirt.id==='santos'?9:12) renderCtx.fillRect(sx,this.y-this.radius,shirt.id==='santos'?4:5,this.radius*2); }
        renderCtx.fillStyle='#fff'; renderCtx.font=`bold ${Math.floor(this.radius*.42)}px Arial`; renderCtx.textAlign='center'; renderCtx.textBaseline='middle'; renderCtx.fillText(shirt.badge,this.x,this.y-this.radius*.47); renderCtx.restore();
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
      renderCtx.beginPath(); renderCtx.arc(this.x,this.y,this.radius+8,0,Math.PI*2);
      renderCtx.strokeStyle='rgba(90,220,255,.9)';renderCtx.lineWidth=2;renderCtx.setLineDash([4,3]);renderCtx.stroke();renderCtx.setLineDash([]);
    }

    renderCtx.restore();
  }
}

/**
 * Classe Ball (Bola)
 */
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
    this.visionPassAssistTimer = 0;
    this.visionPassAssistEnabled = false;
    this.curveTimer=0;this.curveSide=1;this.curveRate=0;this.curveTrail=[];
    this.dribbleLockTimer=0;
    this.dribbleLockOwner=null;
    this.passTarget=null;
    this.passSource=null;
    this.passExpiry=0;
    this.passWasVision=false;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.trail = [];
    this.powerShotTimer = 0;
    this.visionPassAssistTimer = 0;
    this.visionPassAssistEnabled = false;
    this.curveTimer=0;this.curveTrail=[];
    this.dribbleLockTimer=0;
    this.dribbleLockOwner=null;
    this.passTarget=null;
    this.passSource=null;
    this.passExpiry=0;
    this.passWasVision=false;
  }

  update() {
    if(this.dribbleLockTimer>0){this.dribbleLockTimer=Math.max(0,this.dribbleLockTimer-1/60);if(this.dribbleLockTimer===0)this.dribbleLockOwner=null;}
    if(this.curveTimer>0){
      this.curveTimer=Math.max(0,this.curveTimer-1/60);
      const angle=this.curveSide*this.curveRate/60,speed=Math.hypot(this.vx,this.vy),cos=Math.cos(angle),sin=Math.sin(angle),oldVx=this.vx,oldVy=this.vy;
      this.vx=oldVx*cos-oldVy*sin;this.vy=oldVx*sin+oldVy*cos;
      if(speed>0.1){this.curveTrail.push({x:this.x,y:this.y});if(this.curveTrail.length>15)this.curveTrail.shift();}
    } else if(this.curveTrail.length)this.curveTrail.shift();
    if(this.powerShotTimer>0)this.powerShotTimer=Math.max(0,this.powerShotTimer-1/60);
    this.vx *= CONFIG.physics.dampingBall;
    this.vy *= CONFIG.physics.dampingBall;

    const speed = Math.hypot(this.vx, this.vy);
    const maxSpeed = this.powerShotTimer>0 ? CONFIG.physics.ballMaxSpeed*1.4 : CONFIG.physics.ballMaxSpeed;
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

    // BARREIRA DE SEGURANÇA (Hard Bounds): Impede a bola de atravessar o estádio
    this.enforceHardBounds();
  }

  /**
   * Garante que a bola nunca fuja das extremidades do estádio e do campo
   */
  enforceHardBounds() {
    const p = CONFIG.pitch;
    const g = CONFIG.goals;
    const s = CONFIG.stadium;

    // Linha Lateral Superior (pitch.top)
    if (this.y - this.radius < p.top) {
      this.y = p.top + this.radius;
      this.vy = Math.abs(this.vy) * CONFIG.physics.restitutionWall;
    }

    // Linha Lateral Inferior (pitch.bottom)
    if (this.y + this.radius > p.bottom) {
      this.y = p.bottom - this.radius;
      this.vy = -Math.abs(this.vy) * CONFIG.physics.restitutionWall;
    }

    // Limites absolutos de segurança no estádio (fora da área dos gols)
    const isInsideGoalY = this.y >= g.topY && this.y <= g.bottomY;
    if (!isInsideGoalY) {
      if (this.x - this.radius < p.left) {
        this.x = p.left + this.radius;
        this.vx = Math.abs(this.vx) * CONFIG.physics.restitutionWall;
      }
      if (this.x + this.radius > p.right) {
        this.x = p.right - this.radius;
        this.vx = -Math.abs(this.vx) * CONFIG.physics.restitutionWall;
      }
    } else {
      // Dentro da rede: não ultrapassar o fundo da rede
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

    // Limites de teto/piso absolutos do canvas
    if (this.y < s.minY) this.y = s.minY + this.radius;
    if (this.y > s.maxY) this.y = s.maxY - this.radius;
  }

  draw(renderCtx) {
    if(this.curveTrail?.length){renderCtx.save();renderCtx.lineCap='round';renderCtx.lineJoin='round';for(let i=1;i<this.curveTrail.length;i++){const a=this.curveTrail[i-1],b=this.curveTrail[i],t=i/this.curveTrail.length;renderCtx.beginPath();renderCtx.moveTo(a.x,a.y);renderCtx.lineTo(b.x,b.y);renderCtx.strokeStyle=`rgba(55,170,255,${t*0.48})`;renderCtx.lineWidth=2+t*4;renderCtx.shadowColor='#32aaff';renderCtx.shadowBlur=5+t*8;renderCtx.stroke();}renderCtx.restore();}
    // Verificação de Sprite personalizado para a bola
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

    // Rastro visual de velocidade
    for (let i = 0; i < this.trail.length; i++) {
      const pt = this.trail[i];
      const progress = (i + 1) / this.trail.length;
      renderCtx.beginPath();
      renderCtx.arc(pt.x, pt.y, this.radius * (0.3 + 0.6 * progress), 0, Math.PI * 2);
      renderCtx.fillStyle = `rgba(255, 255, 255, ${0.14 * progress})`;
      renderCtx.fill();
    }

    // Sombra
    renderCtx.beginPath();
    renderCtx.arc(this.x + 2, this.y + 3, this.radius, 0, Math.PI * 2);
    renderCtx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    renderCtx.fill();

    // Corpo esférico com relevo
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

    // Detalhe central estilo Haxball
    renderCtx.fillStyle = '#1e293b';
    renderCtx.beginPath();
    renderCtx.arc(this.x, this.y, this.radius * 0.32, 0, Math.PI * 2);
    renderCtx.fill();

    renderCtx.restore();
  }
}

/**
 * Postes das Traves
 */
class GoalPost {
  constructor(x, y, radius = CONFIG.goals.postRadius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
  }

  draw(renderCtx) {
    renderCtx.save();
    renderCtx.beginPath();
    renderCtx.arc(this.x, this.y + 2, this.radius, 0, Math.PI * 2);
    renderCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    renderCtx.fill();

    renderCtx.beginPath();
    renderCtx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    renderCtx.fillStyle = '#f1f5f9';
    renderCtx.fill();

    renderCtx.lineWidth = 2.2;
    renderCtx.strokeStyle = '#0f172a';
    renderCtx.stroke();
    renderCtx.restore();
  }
}

// Lista de partículas e faíscas de impacto
const particles = [];
const lightningTrails = [];
const phantomShadows = [];
const snakeTackles = [];
const snakeAtlasFrames = [
  {x:58,y:615,w:220,h:238},
  {x:365,y:595,w:330,h:280},
  {x:715,y:595,w:430,h:285},
  {x:1135,y:585,w:378,h:298}
];
let snakeSpriteCanvas=null;

// Reutiliza a folha de animação existente e remove o gramado para não cobrir o campo.
assets.loadSprite('snakeAiku','img/cobra do aiku.png').then(image=>{
  const spriteCanvas=document.createElement('canvas');
  spriteCanvas.width=image.naturalWidth;spriteCanvas.height=image.naturalHeight;
  const spriteCtx=spriteCanvas.getContext('2d',{willReadFrequently:true});
  spriteCtx.drawImage(image,0,0);
  const pixels=spriteCtx.getImageData(0,0,spriteCanvas.width,spriteCanvas.height),data=pixels.data;
  for(let i=0;i<data.length;i+=4){
    const r=data[i],g=data[i+1],b=data[i+2],max=Math.max(r,g,b),min=Math.min(r,g,b);
    const grass=g-r>9&&g-b>7&&g>r*1.05;
    const fieldMark=max-min<18&&max>78;
    if(grass||fieldMark)data[i+3]=0;
  }
  spriteCtx.putImageData(pixels,0,0);
  snakeSpriteCanvas=spriteCanvas;
}).catch(()=>{});

function getSnakeTackleEndpoint(tackle){
  const actor=tackle.owner,p=CONFIG.pitch,dx=tackle.dirX,dy=tackle.dirY;
  let distance=tackle.range;
  if(dx>0)distance=Math.min(distance,(p.right-actor.radius-6-actor.x)/dx);
  else if(dx<0)distance=Math.min(distance,(p.left+actor.radius+6-actor.x)/dx);
  if(dy>0)distance=Math.min(distance,(p.bottom-actor.radius-6-actor.y)/dy);
  else if(dy<0)distance=Math.min(distance,(p.top+actor.radius+6-actor.y)/dy);
  distance=Math.max(0,distance);
  for(const post of posts){
    const along=(post.x-actor.x)*dx+(post.y-actor.y)*dy;
    const side=Math.abs((post.x-actor.x)*(-dy)+(post.y-actor.y)*dx);
    if(along>0&&along<distance&&side<post.radius+14)distance=Math.max(0,along-post.radius-12);
  }
  return {x:actor.x+dx*distance,y:actor.y+dy*distance,distance};
}

function getSnakeLaneOffset(tackle,x,y){
  const dx=x-tackle.owner.x,dy=y-tackle.owner.y;
  return {along:dx*tackle.dirX+dy*tackle.dirY,side:Math.abs(dx*(-tackle.dirY)+dy*tackle.dirX)};
}

function getSnakeOpponents(actor){
  if(actor===player1||actor===homeMate)return gameMode==='2v2'?[player2,awayMate]:[player2];
  return gameMode==='2v2'?[player1,homeMate]:[player1];
}

function addSnakeFadeParticles(x,y){
  for(let i=0;i<10;i++){
    const angle=Math.random()*Math.PI*2,speed=.7+Math.random()*2;
    particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:.55,decay:.055+Math.random()*.035,color:i%2?'#c4b5fd':'#8b5cf6'});
  }
}

function attemptSnakeTackle(tackle){
  if(tackle.resolved)return;
  const actor=tackle.owner,end=getSnakeTackleEndpoint(tackle);
  if(end.distance<12)return;
  const carrier=findControlledActor(getSnakeOpponents(actor));
  const carrierLane=carrier?getSnakeLaneOffset(tackle,carrier.x,carrier.y):null;
  const carrierContact=!!carrier&&carrierLane.along>=8&&carrierLane.along<=end.distance+carrier.radius&&carrierLane.side<=carrier.radius+9;
  const ballLanes=[getSnakeLaneOffset(tackle,ball.x,ball.y),getSnakeLaneOffset(tackle,ball.x+ball.vx*.18,ball.y+ball.vy*.18)];
  const ballContact=ballLanes.some(lane=>lane.along>=0&&lane.along<=end.distance&&lane.side<=ball.radius+11);
  if(!carrierContact&&!ballContact)return;

  tackle.resolved=true;
  const contactGap=carrierContact?carrierLane.side:Math.min(...ballLanes.filter(lane=>lane.along>=0&&lane.along<=end.distance).map(lane=>lane.side));
  const width=carrierContact?carrier.radius+9:ball.radius+11;
  const accuracy=Math.max(0,1-contactGap/width);
  const chance=(carrierContact ? .43 : .48)+accuracy*.22;
  if(Math.random()>chance){tackle.outcome='miss';return;}

  tackle.hit=true;
  if(carrierContact){
    const side=Math.sign((ball.x-actor.x)*(-tackle.dirY)+(ball.y-actor.y)*tackle.dirX)||1;
    const impulseX=tackle.dirX*.58-tackle.dirY*side*.82,impulseY=tackle.dirY*.58+tackle.dirX*side*.82;
    const length=Math.hypot(impulseX,impulseY)||1;
    ball.vx=impulseX/length*8.3;ball.vy=impulseY/length*8.3;
    carrier.tackleStaggerTimer=.22;
    tackle.outcome='disarm';
  } else {
    const along=ball.vx*tackle.dirX+ball.vy*tackle.dirY;
    const side=Math.sign(ball.vx*(-tackle.dirY)+ball.vy*tackle.dirX)||1;
    ball.vx-=tackle.dirX*along*1.45;ball.vy-=tackle.dirY*along*1.45;
    ball.vx+=-tackle.dirY*side*1.8;ball.vy+=tackle.dirX*side*1.8;
    tackle.outcome='deflect';
  }
  ball.dribbleLockTimer=0;ball.dribbleLockOwner=null;ball.passTarget=null;ball.passSource=null;ball.passExpiry=0;ball.passWasVision=false;
  ball.curveTimer=0;ball.curveTrail=[];
  addImpactSpark(ball.x,ball.y);addSnakeFadeParticles(ball.x,ball.y);
  if(actor.isHuman)showPowerFeedback(tackle.outcome==='disarm'?'Bote certeiro: bola desarmada':'Bola desviada pelo Bote da Serpente',true,false);
}

function updateSnakeTackles(dt,moveX=0,moveY=0){
  for(let i=snakeTackles.length-1;i>=0;i--){
    const tackle=snakeTackles[i];
    if(tackle.phase==='warning'&&tackle.owner.isHuman&&(moveX||moveY)){
      const length=Math.hypot(moveX,moveY)||1;tackle.dirX=moveX/length;tackle.dirY=moveY/length;
    }
    tackle.timer=Math.max(0,tackle.timer-dt);
    if(tackle.timer>0)continue;
    if(tackle.phase==='warning'){tackle.phase='expand';tackle.timer=tackle.phaseDuration=.25;}
    else if(tackle.phase==='expand'){tackle.phase='strike';tackle.timer=tackle.phaseDuration=.18;}
    else if(tackle.phase==='strike'){
      if(!tackle.resolved)attemptSnakeTackle(tackle);
      if(tackle.timer<=0){
        tackle.owner.powerCooldown=POWER_COOLDOWNS.snakeTackle;
        if(!tackle.hit&&tackle.owner.isHuman)showPowerFeedback(tackle.outcome==='miss'?'O bote não desarmou o adversário':'O bote passou longe da bola',true,false);
        const end=getSnakeTackleEndpoint(tackle);addSnakeFadeParticles(end.x,end.y);
        tackle.phase='fade';tackle.timer=tackle.phaseDuration=.28;
      }
    } else if(tackle.phase==='fade')snakeTackles.splice(i,1);
  }
}

function addPhantomShadow(player) {
  phantomShadows.push({x:player.x,y:player.y,radius:player.radius,color:player.color,number:player.number,life:0.28,maxLife:0.28});
}

function updateAndDrawPhantomShadows(renderCtx) {
  for(let i=phantomShadows.length-1;i>=0;i--){
    const shadow=phantomShadows[i];shadow.life-=1/60;
    if(shadow.life<=0){phantomShadows.splice(i,1);continue;}
    renderCtx.save();renderCtx.globalAlpha=(shadow.life/shadow.maxLife)*0.4;
    renderCtx.beginPath();renderCtx.arc(shadow.x,shadow.y,shadow.radius+2,0,Math.PI*2);
    renderCtx.fillStyle=shadow.color;renderCtx.shadowColor='#b8f2ff';renderCtx.shadowBlur=14;renderCtx.fill();
    renderCtx.lineWidth=2;renderCtx.strokeStyle='#d9f8ff';renderCtx.stroke();
    renderCtx.fillStyle='#fff';renderCtx.font=`bold ${Math.floor(shadow.radius*.8)}px Arial`;renderCtx.textAlign='center';renderCtx.textBaseline='middle';renderCtx.fillText(shadow.number,shadow.x,shadow.y);
    renderCtx.restore();
  }
}

function addLightningTrail(player) {
  const backX=-player.facingX,backY=-player.facingY;
  const sideX=-backY,sideY=backX;
  const points=[];
  for(let i=0;i<6;i++){
    const along=i*9;
    const zigzag=i===0||i===5?0:(Math.random()-.5)*15;
    points.push({x:player.x+backX*(player.radius+along)+sideX*zigzag,y:player.y+backY*(player.radius+along)+sideY*zigzag});
  }
  lightningTrails.push({points,life:0.2,maxLife:0.2});
}

function updateAndDrawLightningTrails(renderCtx) {
  for(let i=lightningTrails.length-1;i>=0;i--){
    const trail=lightningTrails[i]; trail.life-=1/60;
    if(trail.life<=0){lightningTrails.splice(i,1);continue;}
    const alpha=trail.life/trail.maxLife;
    renderCtx.save();renderCtx.globalAlpha=alpha;renderCtx.lineCap='round';renderCtx.lineJoin='round';
    renderCtx.beginPath();renderCtx.moveTo(trail.points[0].x,trail.points[0].y);
    for(let p=1;p<trail.points.length;p++)renderCtx.lineTo(trail.points[p].x,trail.points[p].y);
    renderCtx.strokeStyle='#38bdf8';renderCtx.lineWidth=6;renderCtx.shadowColor='#38bdf8';renderCtx.shadowBlur=18;renderCtx.stroke();
    renderCtx.strokeStyle='#e0f2fe';renderCtx.lineWidth=2.2;renderCtx.shadowBlur=7;renderCtx.stroke();renderCtx.restore();
  }
}

function addImpactSpark(x, y) {
  for (let i = 0; i < 7; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.2 + Math.random() * 2.8;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: 0.05 + Math.random() * 0.05,
      color: '#ffffff'
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
    renderCtx.globalAlpha = p.life;
    renderCtx.fillStyle = p.color;
    renderCtx.beginPath();
    renderCtx.arc(p.x, p.y, 2.0, 0, Math.PI * 2);
    renderCtx.fill();
    renderCtx.restore();
  }
}

/* ==========================================================================
   5. FÍSICA E COLISÕES (COM SUB-STEPPING E TRATAMENTO DE REBOTE)
   ========================================================================== */

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

// Segmentos sólidos do campo e redes
const wallSegments = [];
const netSegmentsForPlayers = [];
function rebuildPitchCollisionGeometry() {
  const p=CONFIG.pitch,g=CONFIG.goals,r=CONFIG.physics.restitutionWall;
  wallSegments.splice(0,wallSegments.length,
    {x1:p.left,y1:p.top,x2:p.right,y2:p.top,rest:r},
    {x1:p.left,y1:p.bottom,x2:p.right,y2:p.bottom,rest:r},
    {x1:p.left,y1:p.top,x2:p.left,y2:g.topY,rest:r},
    {x1:p.left,y1:g.bottomY,x2:p.left,y2:p.bottom,rest:r},
    {x1:p.right,y1:p.top,x2:p.right,y2:g.topY,rest:r},
    {x1:p.right,y1:g.bottomY,x2:p.right,y2:p.bottom,rest:r},
    {x1:p.left-g.depth,y1:g.topY,x2:p.left,y2:g.topY,rest:.35},
    {x1:p.left-g.depth,y1:g.topY,x2:p.left-g.depth,y2:g.bottomY,rest:.35},
    {x1:p.left-g.depth,y1:g.bottomY,x2:p.left,y2:g.bottomY,rest:.35},
    {x1:p.right,y1:g.topY,x2:p.right+g.depth,y2:g.topY,rest:.35},
    {x1:p.right+g.depth,y1:g.topY,x2:p.right+g.depth,y2:g.bottomY,rest:.35},
    {x1:p.right,y1:g.bottomY,x2:p.right+g.depth,y2:g.bottomY,rest:.35}
  );
  netSegmentsForPlayers.splice(0,netSegmentsForPlayers.length,
    {x1:p.left-g.depth,y1:g.topY,x2:p.left,y2:g.topY},
    {x1:p.left-g.depth,y1:g.topY,x2:p.left-g.depth,y2:g.bottomY},
    {x1:p.left-g.depth,y1:g.bottomY,x2:p.left,y2:g.bottomY},
    {x1:p.right,y1:g.topY,x2:p.right+g.depth,y2:g.topY},
    {x1:p.right+g.depth,y1:g.topY,x2:p.right+g.depth,y2:g.bottomY},
    {x1:p.right,y1:g.bottomY,x2:p.right+g.depth,y2:g.bottomY}
  );
}

function resolveBallBoundaries(b) {
  for (let i = 0; i < wallSegments.length; i++) {
    const seg = wallSegments[i];
    resolveCircleSegment(b, seg.x1, seg.y1, seg.x2, seg.y2, seg.rest);
  }
}

/* ==========================================================================
   6. INTELIGÊNCIA ARTIFICIAL (BOT FSM BALANCEADO)
   ========================================================================== */
const aiState = {
  mode: 'DEFEND',
  targetX: 740,
  targetY: 300,
  ownGoalCenter: { x: CONFIG.pitch.right, y: CONFIG.pitch.centerY },
  enemyGoalCenter: { x: CONFIG.pitch.left, y: CONFIG.pitch.centerY }
};

function shadowAdjustedTarget(actor,targetX,targetY,opponents){
  if(actor.powerEffect!=='shadow'||!opponents.length)return {x:targetX,y:targetY};
  const mark=opponents.reduce((nearest,opponent)=>Math.hypot(opponent.x-actor.x,opponent.y-actor.y)<Math.hypot(nearest.x-actor.x,nearest.y-actor.y)?opponent:nearest,opponents[0]);
  return {x:targetX+(mark.x-actor.x)*.22,y:targetY+(mark.y-actor.y)*.22};
}

function closestActorTo(target,actors){
  return actors.reduce((closest,actor)=>Math.hypot(actor.x-target.x,actor.y-target.y)<Math.hypot(closest.x-target.x,closest.y-target.y)?actor:closest,actors[0]);
}

function findControlledActor(actors){return actors.find(isBallControlledBy)||null;}

function chooseBotSupportTarget(carrier,runner,defenders,attackDirection){
  const p=CONFIG.pitch,advances=[118,164,210],lanes=[-132,-78,78,132];
  let best=null,bestScore=-Infinity;
  for(const advance of advances)for(const lane of lanes){
    const target={
      x:Math.max(p.left+runner.radius+16,Math.min(p.right-runner.radius-16,carrier.x+attackDirection*advance)),
      y:Math.max(p.top+runner.radius+16,Math.min(p.bottom-runner.radius-16,carrier.y+lane))
    };
    const carrierGap=Math.hypot(target.x-carrier.x,target.y-carrier.y);
    const defenderGap=defenders.length?Math.min(...defenders.map(defender=>Math.hypot(target.x-defender.x,target.y-defender.y))):190;
    const runnerPathBlocked=defenders.some(defender=>pointSegmentDistance(defender.x,defender.y,runner.x,runner.y,target.x,target.y)<defender.radius+runner.radius+12);
    const passPathBlocked=isPassPathBlocked(ball,target,carrier);
    const forward=Math.max(0,(target.x-carrier.x)*attackDirection);
    const score=Math.min(defenderGap,210)*.52-Math.abs(carrierGap-158)*.28+Math.min(forward,220)*.16
      -(passPathBlocked?105:0)-(runnerPathBlocked?45:0)-Math.hypot(target.x-runner.x,target.y-runner.y)*.025;
    if(score>bestScore){bestScore=score;best=target;}
  }
  return best||{x:carrier.x+attackDirection*140,y:carrier.y};
}

function steerBotToward(actor,targetX,targetY,speedScale=1){
  const dx=targetX-actor.x,dy=targetY-actor.y,distance=Math.hypot(dx,dy);
  if(distance<1)return;
  const desiredSpeed=Math.min(CONFIG.physics.playerMaxSpeed*.92,Math.max(.8,distance*.12))*speedScale;
  const blend=Math.min(.2,.12*speedScale);
  actor.facingX=dx/distance;actor.facingY=dy/distance;
  actor.vx+=(actor.facingX*desiredSpeed-actor.vx)*blend;
  actor.vy+=(actor.facingY*desiredSpeed-actor.vy)*blend;
}

function steerBotDefense(actor,pressingBot,carrier,markedAttacker,ownGoalX){
  if(actor===pressingBot){
    steerBotToward(actor,carrier.x+carrier.vx*1.4,carrier.y+carrier.vy*1.4,1.08);
    return;
  }
  const goalSide=ownGoalX>=CONFIG.pitch.centerX?1:-1,p=CONFIG.pitch;
  const targetX=Math.max(p.left+actor.radius+18,Math.min(p.right-actor.radius-18,markedAttacker.x+goalSide*66));
  const targetY=Math.max(p.top+actor.radius+18,Math.min(p.bottom-actor.radius-18,markedAttacker.y+(carrier.y-markedAttacker.y)*.16));
  steerBotToward(actor,targetX,targetY,.96);
}

function updateAI(dt) {
  const ownGoal = aiState.ownGoalCenter;

  let targetGoalY = CONFIG.pitch.centerY;
  if (player1.y > CONFIG.pitch.centerY) {
    targetGoalY = CONFIG.goals.topY + 35;
  } else {
    targetGoalY = CONFIG.goals.bottomY - 35;
  }

  const distToBall = Math.hypot(ball.x - player2.x, ball.y - player2.y);
  if(gameMode!=='training')updatePowerBot(dt,player2);
  if(gameMode==='2v2'){
    const redCarrier=findControlledActor([player2,awayMate]),blueCarrier=findControlledActor([player1,homeMate]);
    if(redCarrier===awayMate){
      const target=chooseBotSupportTarget(awayMate,player2,[player1,homeMate],-1);
      steerBotToward(player2,target.x,target.y);return;
    }
    if(blueCarrier){
      const pressBot=closestActorTo(ball,[player2,awayMate]),mark=blueCarrier===player1?homeMate:player1;
      steerBotDefense(player2,pressBot,blueCarrier,mark,CONFIG.pitch.right);return;
    }
    if(!redCarrier){
      const chaser=closestActorTo(ball,[player2,awayMate]);
      if(chaser!==player2){
        const target=chooseBotSupportTarget(chaser,player2,[player1,homeMate],-1);
        steerBotToward(player2,target.x,target.y);return;
      }
    }
  }
  if(isBallControlledBy(player2)){
    const dx=CONFIG.pitch.left-ball.x,dy=targetGoalY-ball.y,goalDistance=Math.hypot(dx,dy)||1;
    const mateIsAhead=gameMode==='2v2'&&awayMate.x<ball.x-35;
    if(mateIsAhead&&Math.hypot(awayMate.x-ball.x,awayMate.y-ball.y)<205&&goalDistance>260&&player2.kickCooldownTimer<=0&&!isPassPathBlocked(ball,awayMate,player2)){
      player2.tryKick(ball,0,0,true,awayMate);return;
    }
    player2.facingX=dx/goalDistance;player2.facingY=dy/goalDistance;
    player2.vx+=player2.facingX*CONFIG.physics.playerAcceleration*0.8;
    player2.vy+=player2.facingY*CONFIG.physics.playerAcceleration*0.8;
    if(goalDistance<275&&player2.kickCooldownTimer<=0)player2.tryKick(ball,player2.facingX,player2.facingY);
    return;
  }
  const ballDistToOwnGoal = Math.hypot(ball.x - ownGoal.x, ball.y - ownGoal.y);

  const attackDx = CONFIG.pitch.left - ball.x;
  const attackDy = targetGoalY - ball.y;
  const attackDist = Math.hypot(attackDx, attackDy);
  const attackDirX = attackDx / attackDist;
  const attackDirY = attackDy / attackDist;

  const behindBallOffset = 42;
  const idealAttackX = ball.x - attackDirX * behindBallOffset;
  const idealAttackY = ball.y - attackDirY * behindBallOffset;

  const isAheadOfBall = player2.x < ball.x + 12;

  if (ball.x > CONFIG.pitch.centerX + 50 || (ball.vx > 1.0 && ball.x > CONFIG.pitch.centerX - 40)) {
    if (isAheadOfBall && ballDistToOwnGoal < 220) {
      aiState.mode = 'DEFEND';
    } else if (isAheadOfBall) {
      aiState.mode = 'REPOSITION';
    } else {
      aiState.mode = 'ATTACK';
    }
  } else {
    if (isAheadOfBall) {
      aiState.mode = 'REPOSITION';
    } else {
      aiState.mode = 'ATTACK';
    }
  }

  if (aiState.mode === 'DEFEND') {
    const t = 0.55;
    aiState.targetX = ownGoal.x + (ball.x - ownGoal.x) * t;
    aiState.targetY = ownGoal.y + (ball.y - ownGoal.y) * t;
    if (aiState.targetX > CONFIG.pitch.right - 26) {
      aiState.targetX = CONFIG.pitch.right - 26;
    }
  } else if (aiState.mode === 'REPOSITION') {
    const avoidOffset = 52;
    const steerUp = ball.y > CONFIG.pitch.centerY;
    aiState.targetX = ball.x + 42;
    aiState.targetY = steerUp ? ball.y - avoidOffset : ball.y + avoidOffset;
  } else if (aiState.mode === 'ATTACK') {
    aiState.targetX = idealAttackX;
    aiState.targetY = idealAttackY;
    const distToIdeal = Math.hypot(idealAttackX - player2.x, idealAttackY - player2.y);
    if (distToIdeal < 22) {
      aiState.targetX = ball.x;
      aiState.targetY = ball.y;
    }
  }

  const shadowTarget=shadowAdjustedTarget(player2,aiState.targetX,aiState.targetY,[player1,...(gameMode==='2v2'?[homeMate]:[])]);
  aiState.targetX=Math.max(CONFIG.pitch.left+22,Math.min(CONFIG.pitch.right-22,shadowTarget.x));
  aiState.targetY=Math.max(CONFIG.pitch.top+22,Math.min(CONFIG.pitch.bottom-22,shadowTarget.y));

  const toTargetDx = aiState.targetX - player2.x;
  const toTargetDy = aiState.targetY - player2.y;
  const toTargetDist = Math.hypot(toTargetDx, toTargetDy);

  if (toTargetDist > 4) {
    const moveDirX = toTargetDx / toTargetDist;
    const moveDirY = toTargetDy / toTargetDist;
    player2.facingX=moveDirX;player2.facingY=moveDirY;
    player2.vx += moveDirX * CONFIG.physics.playerAcceleration;
    player2.vy += moveDirY * CONFIG.physics.playerAcceleration;
  }

  // Chute inteligente do bot (mira intencionalmente para a esquerda/gol adversário)
  if (distToBall <= player2.radius + ball.radius + CONFIG.physics.kickReachMargin && ball.x-CONFIG.pitch.left<275) {
    const botBallX = ball.x - player2.x;
    const isFacingEnemyGoal = botBallX < -0.1;
    if (isFacingEnemyGoal && player2.x > ball.x - 2) {
      player2.tryKick(ball, -1, (targetGoalY - ball.y) / 200);
    }
  }
}

function updateAwayMateAI(dt) {
  const p=CONFIG.pitch,goalY=ball.y<p.centerY?CONFIG.goals.topY+28:CONFIG.goals.bottomY-28;
  updatePowerBot(dt,awayMate);
  if(gameMode==='2v2'){
    const redCarrier=findControlledActor([player2,awayMate]),blueCarrier=findControlledActor([player1,homeMate]);
    if(redCarrier===player2){
      const target=chooseBotSupportTarget(player2,awayMate,[player1,homeMate],-1);
      steerBotToward(awayMate,target.x,target.y);return;
    }
    if(blueCarrier){
      const pressBot=closestActorTo(ball,[player2,awayMate]),mark=blueCarrier===player1?homeMate:player1;
      steerBotDefense(awayMate,pressBot,blueCarrier,mark,p.right);return;
    }
    if(!redCarrier){
      const chaser=closestActorTo(ball,[player2,awayMate]);
      if(chaser!==awayMate){
        const target=chooseBotSupportTarget(chaser,awayMate,[player1,homeMate],-1);
        steerBotToward(awayMate,target.x,target.y);return;
      }
    }
  }
  if(isBallControlledBy(awayMate)){
    const goalDistance=Math.hypot(ball.x-p.left,goalY-ball.y);
    awayMate.facingX=-1;awayMate.facingY=(goalY-ball.y)/(Math.hypot(p.left-ball.x,goalY-ball.y)||1);
    if(player2.x<ball.x-35&&Math.hypot(player2.x-ball.x,player2.y-ball.y)<220&&goalDistance>260&&awayMate.kickCooldownTimer<=0&&!isPassPathBlocked(ball,player2,awayMate)){
      awayMate.tryKick(ball,0,0,true,player2);return;
    }
    if(goalDistance<270&&awayMate.kickCooldownTimer<=0){awayMate.tryKick(ball,awayMate.facingX,awayMate.facingY);return;}
    awayMate.vx+=awayMate.facingX*CONFIG.physics.playerAcceleration*.72;
    awayMate.vy+=awayMate.facingY*CONFIG.physics.playerAcceleration*.72;
    return;
  }
  const carrier=isBallControlledBy(player2)?player2:null;
  let targetX,targetY;
  if(carrier){
    const sign=ball.y<p.centerY?1:-1;
    targetX=Math.max(p.left+45,ball.x-115);
    const upper=Math.max(p.top+38,Math.min(p.bottom-38,ball.y+sign*88));
    const lower=Math.max(p.top+38,Math.min(p.bottom-38,ball.y-sign*88));
    targetY=Math.hypot(upper-player1.x,upper-player1.y)>Math.hypot(lower-player1.x,lower-player1.y)?upper:lower;
  } else {
    const mateDistance=Math.hypot(ball.x-awayMate.x,ball.y-awayMate.y),carrierDistance=Math.hypot(ball.x-player2.x,ball.y-player2.y);
    if(mateDistance<carrierDistance+35){targetX=ball.x;targetY=ball.y;}
    else {targetX=Math.max(p.centerX+35,Math.min(p.right-48,p.centerX+(ball.x-p.centerX)*.38));targetY=ball.y+(ball.y<p.centerY?42:-42);}
  }
  targetY=Math.max(p.top+35,Math.min(p.bottom-35,targetY));
  const shadowTarget=shadowAdjustedTarget(awayMate,targetX,targetY,[player1,homeMate]);targetX=shadowTarget.x;targetY=shadowTarget.y;
  targetX=Math.max(p.left+22,Math.min(p.right-22,targetX));targetY=Math.max(p.top+22,Math.min(p.bottom-22,targetY));
  const dx=targetX-awayMate.x,dy=targetY-awayMate.y,dist=Math.hypot(dx,dy)||1;
  if(dist>6){awayMate.facingX=dx/dist;awayMate.facingY=dy/dist;awayMate.vx+=awayMate.facingX*CONFIG.physics.playerAcceleration*.88;awayMate.vy+=awayMate.facingY*CONFIG.physics.playerAcceleration*.88;}
  if(Math.hypot(ball.x-awayMate.x,ball.y-awayMate.y)<awayMate.radius+ball.radius+CONFIG.physics.kickReachMargin&&ball.x>p.centerX-160&&awayMate.kickCooldownTimer<=0){
    const dirX=ball.x-awayMate.x,dirY=ball.y-awayMate.y;
    if(dirX>0)awayMate.tryKick(ball,1,(goalY-ball.y)/200);
  }
}

function updateHomeMateAI(dt) {
  const p=CONFIG.pitch;
  if(gameMode==='2v2'&&homeMate.visionRunTimer>0&&isBallControlledBy(homeMate)){
    homeMate.facingX=homeMate.visionRunDirectionX;homeMate.facingY=homeMate.visionRunDirectionY;
    homeMate.vx+=homeMate.facingX*CONFIG.physics.playerAcceleration*1.45;
    homeMate.vy+=homeMate.facingY*CONFIG.physics.playerAcceleration*1.45;
    return;
  }
  if(twoOnePlay?.target===homeMate&&twoOnePlay.phase==='receiveWait'){
    if(!isBallReceivedBy(homeMate))return;
    const faceX=player1.x-homeMate.x,faceY=player1.y-homeMate.y,length=Math.hypot(faceX,faceY)||1;
    homeMate.facingX=faceX/length;homeMate.facingY=faceY/length;
    if(twoOnePlay.waitTimer<=0){
      const targetPoint=projectTwoOneReceiver(CONFIG.physics.kickPower*.9*.92);
      if(homeMate.kickCooldownTimer>0||isPassPathBlocked(ball,targetPoint,homeMate)){finishTwoOne(false,'O retorno foi bloqueado; jogada encerrada');return;}
      if(homeMate.tryKick(ball,0,0,true,targetPoint)){
        ball.vx*=0.92;ball.vy*=0.92;ball.dribbleLockTimer=0.16;ball.dribbleLockOwner=homeMate;twoOnePlay.phase='return';twoOnePlay.timer=2.1;twoOnePlay.returnAssistTimer=1.8;twoOnePlay.returnTurnBudget=.68;
      }else finishTwoOne(false,'O companheiro não conseguiu devolver a bola');
    }
    return;
  }
  if(twoOnePlay?.target===homeMate&&twoOnePlay.phase==='outbound'){
  if(isBallReceivedBy(homeMate)){
      twoOnePlay.phase='receiveWait';twoOnePlay.waitTimer=0.8;twoOnePlay.timer=2.6;twoOnePlay.receiveLostTimer=0;
      return;
    }
    const tx=ball.x+ball.vx*3,ty=ball.y+ball.vy*3,dx=tx-homeMate.x,dy=ty-homeMate.y,distance=Math.hypot(dx,dy)||1;
    homeMate.facingX=dx/distance;homeMate.facingY=dy/distance;
    homeMate.vx+=homeMate.facingX*CONFIG.physics.playerAcceleration*1.08;homeMate.vy+=homeMate.facingY*CONFIG.physics.playerAcceleration*1.08;
    return;
  }
  if(twoOnePlay?.target===homeMate&&twoOnePlay.phase==='return')return;
  if(gameMode==='2v2'&&!isBallControlledBy(homeMate)){
    const blueCarrier=findControlledActor([player1,homeMate]),redCarrier=findControlledActor([player2,awayMate]);
    if(blueCarrier===player1){
      const target=chooseBotSupportTarget(player1,homeMate,[player2,awayMate],1);
      steerBotToward(homeMate,target.x,target.y);return;
    }
    if(redCarrier){
      const mark=redCarrier===player2?awayMate:player2,pressBot=closestActorTo(ball,[player1,homeMate]);
      steerBotDefense(homeMate,pressBot,redCarrier,mark,p.left);return;
    }
    const chaser=closestActorTo(ball,[player1,homeMate]);
    if(chaser===homeMate){
      steerBotToward(homeMate,ball.x+ball.vx*.6,ball.y+ball.vy*.6);return;
    }
    const target=chooseBotSupportTarget(player1,homeMate,[player2,awayMate],1);
    steerBotToward(homeMate,target.x,target.y);return;
  }
  if(isBallControlledBy(homeMate)){
    const playerDistance=Math.hypot(player1.x-ball.x,player1.y-ball.y);
    const goalY=ball.y< p.centerY?CONFIG.goals.topY+28:CONFIG.goals.bottomY-28;
    const goalDistance=Math.hypot(p.right-ball.x,goalY-ball.y);
    if(goalDistance<260&&homeMate.kickCooldownTimer<=0){homeMate.tryKick(ball,0,0,false,{x:p.right,y:goalY});return;}
    if(playerDistance<285&&homeMate.kickCooldownTimer<=0&&!isPassPathBlocked(ball,player1,homeMate)){
      homeMate.tryKick(ball,0,0,true,player1);return;
    }
    const length=Math.hypot(p.right-ball.x,goalY-ball.y)||1;homeMate.facingX=(p.right-ball.x)/length;homeMate.facingY=(goalY-ball.y)/length;
    homeMate.vx+=homeMate.facingX*CONFIG.physics.playerAcceleration*0.72;homeMate.vy+=homeMate.facingY*CONFIG.physics.playerAcceleration*0.72;
    return;
  }
  let targetX=Math.max(p.left+25,Math.min(p.right-38,ball.x+105));
  const upperY=Math.max(p.top+38,Math.min(p.bottom-38,ball.y-92));
  const lowerY=Math.max(p.top+38,Math.min(p.bottom-38,ball.y+92));
  const safetyScore=y=>Math.hypot(targetX-player2.x,y-player2.y)*0.75+Math.hypot(targetX-player1.x,y-player1.y)*0.3+(gameMode==='2v2'?Math.hypot(targetX-awayMate.x,y-awayMate.y)*.7:0);
  let targetY=safetyScore(upperY)>=safetyScore(lowerY)?upperY:lowerY;
  if(Math.hypot(targetX-player1.x,targetY-player1.y)<64)targetY=targetY===upperY?lowerY:upperY;
  const shadowTarget=shadowAdjustedTarget(homeMate,targetX,targetY,[player2,...(gameMode==='2v2'?[awayMate]:[])]);
  targetX=shadowTarget.x;targetY=shadowTarget.y;
  targetX=Math.max(p.left+22,Math.min(p.right-22,targetX));targetY=Math.max(p.top+22,Math.min(p.bottom-22,targetY));
  const dx=targetX-homeMate.x,dy=targetY-homeMate.y,distance=Math.hypot(dx,dy);
  if(distance>7){homeMate.facingX=dx/distance;homeMate.facingY=dy/distance;homeMate.vx+=(dx/distance)*CONFIG.physics.playerAcceleration*0.82;homeMate.vy+=(dy/distance)*CONFIG.physics.playerAcceleration*0.82;}
}

function pointSegmentDistance(px,py,x1,y1,x2,y2) {
  const dx=x2-x1,dy=y2-y1,lengthSquared=dx*dx+dy*dy;
  const t=lengthSquared?Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/lengthSquared)):0;
  return Math.hypot(px-(x1+t*dx),py-(y1+t*dy));
}
function isPassPathBlocked(from,to,attacker){
  const opponents=(attacker===player1||attacker===homeMate)?[player2,...(gameMode==='2v2'?[awayMate]:[])]:[player1,...(gameMode==='2v2'?[homeMate]:[])];
  if(opponents.some(opponent=>pointSegmentDistance(opponent.x,opponent.y,from.x,from.y,to.x,to.y)<opponent.radius+ball.radius+8))return true;
  return posts.some(post=>pointSegmentDistance(post.x,post.y,from.x,from.y,to.x,to.y)<post.radius+ball.radius+4);
}

function isVisionPassLaneBlocked() {
  const blockers=[player2,...(gameMode==='2v2'?[awayMate]:[])];
  if(gameMode!=='training'&&blockers.some(opponent=>pointSegmentDistance(opponent.x,opponent.y,ball.x,ball.y,homeMate.x,homeMate.y)<opponent.radius+ball.radius+12))return true;
  return posts.some(post=>pointSegmentDistance(post.x,post.y,ball.x,ball.y,homeMate.x,homeMate.y)<post.radius+ball.radius+5);
}
function nearestPassTeammate(actor){
  const candidates=[homeMate].filter(teammate=>teammate!==actor);
  return candidates.sort((a,b)=>Math.hypot(a.x-actor.x,a.y-actor.y)-Math.hypot(b.x-actor.x,b.y-actor.y))[0]||null;
}
function getTwoOneEligibleTargets(actor){
  if(gameMode==='match')return [];
  const target=homeMate,distance=Math.hypot(target.x-actor.x,target.y-actor.y),pitch=CONFIG.pitch;
  const opponents=[player2,...(gameMode==='2v2'?[awayMate]:[])];
  if(distance>230||opponents.some(opponent=>Math.hypot(target.x-opponent.x,target.y-opponent.y)<opponent.radius+target.radius+24))return [];
  if(target.x-target.radius<pitch.left+8||target.x+target.radius>pitch.right-8||target.y-target.radius<pitch.top+8||target.y+target.radius>pitch.bottom-8)return [];
  if(isPassPathBlocked(ball,target,actor))return [];
  return [target];
}
function projectTwoOneReceiver(ballSpeed){
  let dirX=(input.right?1:0)-(input.left?1:0),dirY=(input.down?1:0)-(input.up?1:0);
  const hasMoveInput=!!(dirX||dirY);
  if(hasMoveInput){const length=Math.hypot(dirX,dirY);dirX/=length;dirY/=length;}
  else if(twoOnePlay){dirX=twoOnePlay.runDirection.x;dirY=twoOnePlay.runDirection.y;}
  else {
    const speed=Math.hypot(player1.vx,player1.vy);
    if(speed>0.55){dirX=player1.vx/speed;dirY=player1.vy/speed;}
    else {dirX=player1.facingX;dirY=player1.facingY;}
  }
  const velocityAlongRun=player1.vx*dirX+player1.vy*dirY;
  const projectedSpeed=hasMoveInput&&!twoOnePlay?Math.max(CONFIG.physics.playerMaxSpeed,velocityAlongRun):Math.max(0,velocityAlongRun);
  const gap=Math.hypot(player1.x-ball.x,player1.y-ball.y);
  // A bola e o recebedor avançam ao mesmo tempo; projeta o encontro pela velocidade relativa.
  const frames=Math.max(4,Math.min(120,gap/Math.max(1.8,ballSpeed-projectedSpeed)));
  const p=CONFIG.pitch,lead=projectedSpeed*frames+(twoOnePlay?22:10);
  return {x:Math.max(p.left+player1.radius,Math.min(p.right-player1.radius,player1.x+dirX*lead)),y:Math.max(p.top+player1.radius,Math.min(p.bottom-player1.radius,player1.y+dirY*lead))};
}
function chooseTwoOneRunDirection(actor){
  const base=Math.atan2(actor.facingY,actor.facingX),directions=[0,Math.PI/6,-Math.PI/6,Math.PI/3,-Math.PI/3].map(offset=>({x:Math.cos(base+offset),y:Math.sin(base+offset),turn:Math.abs(offset)}));
  const pitch=CONFIG.pitch;
  const clear=d=>{
    const tx=actor.x+d.x*100,ty=actor.y+d.y*100;
    if(tx<pitch.left+actor.radius||tx>pitch.right-actor.radius||ty<pitch.top+actor.radius||ty>pitch.bottom-actor.radius)return false;
    if([player2,...(gameMode==='2v2'?[awayMate]:[])].some(opponent=>pointSegmentDistance(opponent.x,opponent.y,actor.x,actor.y,tx,ty)<actor.radius+opponent.radius+8))return false;
    if(pointSegmentDistance(homeMate.x,homeMate.y,actor.x,actor.y,tx,ty)<actor.radius+homeMate.radius+6)return false;
    return posts.every(post=>pointSegmentDistance(post.x,post.y,actor.x,actor.y,tx,ty)>actor.radius+post.radius+5);
  };
  const valid=directions.filter(clear);if(!valid.length)return {x:actor.facingX,y:actor.facingY};
  return valid.sort((a,b)=>{
    const score=d=>Math.hypot(actor.x+d.x*100-player2.x,actor.y+d.y*100-player2.y)*0.18+Math.hypot(actor.x+d.x*100-homeMate.x,actor.y+d.y*100-homeMate.y)*0.08-d.turn*100;
    return score(b)-score(a);
  })[0];
}
function confirmTwoOneSelection(){
  if(!twoOneSelection)return false;
  const target=twoOneSelection.target,eligible=getTwoOneEligibleTargets(player1);
  if(!isBallControlledBy(player1)||!eligible.includes(target)){
    twoOneSelection=null;showPowerFeedback('O alvo ficou indisponível; Toque e Passa cancelado',true);return false;
  }
  if(isPassPathBlocked(ball,target,player1)){twoOneSelection=null;showPowerFeedback('Linha bloqueada; Toque e Passa cancelado',true);return false;}
  if(!player1.tryKick(ball,0,0,true,target)){
    twoOneSelection=null;showPowerFeedback('Aguarde para dominar a bola antes da tabela',true);return false;
  }
  // A short, controlled feed gives the moving receiver room to cushion the ball.
  ball.vx*=0.50;ball.vy*=0.50;
  player1.powerCooldown=POWER_COOLDOWNS.twoOne;player1.powerEffect='twoOne';player1.powerEffectTimer=0;
  const run=chooseTwoOneRunDirection(player1);
  twoOnePlay={phase:'outbound',target,timer:2.5,runDirection:{x:run.x,y:run.y},runTimer:0.58,trail:[]};
  input.up=false;input.down=false;input.left=false;input.right=false;input.kickRequested=false;input.passRequested=false;
  player1.vx=0;player1.vy=0;
  twoOneSelection=null;showPowerFeedback('Toque e Passa! Arranque para receber',false);
  return true;
}
function finishTwoOne(success,message){
  if(!twoOnePlay)return;
  if(success&&gameMode==='2v2'&&twoVtwoStats)twoVtwoStats.completed.twoOne=true;
  twoOnePlay=null;player1.powerEffect=null;player1.powerEffectTimer=0;twoOneImpactTimer=success?0.32:0;
  if(message)showPowerFeedback(message,!success);
}
function updateTwoOneState(dt){
  if(twoOneSelection){
    twoOneSelection.timer-=dt;
    if(twoOneSelection.timer<=0){twoOneSelection=null;showPowerFeedback('Seleção de alvo cancelada',true);}
  }
  if(twoOneImpactTimer>0)twoOneImpactTimer=Math.max(0,twoOneImpactTimer-dt);
  if(!twoOnePlay)return;
  const play=twoOnePlay;play.timer-=dt;
  const speed=Math.hypot(ball.vx,ball.vy);
  if(speed>1){play.trail.push({x:ball.x,y:ball.y});if(play.trail.length>11)play.trail.shift();}
  else if(play.trail.length)play.trail.shift();
  if(play.phase==='return'){
    if(isBallReceivedBy(player1)){finishTwoOne(true,'Tabela concluída!');return;}
    const distanceToReceiver=Math.hypot(ball.x-player1.x,ball.y-player1.y),receiveRadius=player1.radius+ball.radius+24;
    if(distanceToReceiver<=receiveRadius){play.returnApproachStarted=true;play.returnNearTimer=(play.returnNearTimer||0)+dt;if(play.returnNearTimer>0.18){finishTwoOne(false,'A devolução não chegou controlada; siga a jogada');return;}}
    else if(play.returnApproachStarted){finishTwoOne(false,'A devolução passou; siga a jogada');return;}
  }
  if(play.phase==='receiveWait'){
    if(isBallReceivedBy(play.target)){
      play.receiveLostTimer=0;play.waitTimer=Math.max(0,play.waitTimer-dt);
    } else {
      play.receiveLostTimer=(play.receiveLostTimer||0)+dt;
      const distance=Math.hypot(ball.x-play.target.x,ball.y-play.target.y);
      if(distance>play.target.radius+ball.radius+24||play.receiveLostTimer>0.18){finishTwoOne(false,'O companheiro perdeu a bola; jogada encerrada');return;}
    }
  }
  if(gameMode!=='training'&&(isBallControlledBy(player2)||(gameMode==='2v2'&&isBallControlledBy(awayMate)))){finishTwoOne(false,'Passe interceptado; jogada encerrada');return;}
  if(play.timer<=0||ball.curveTimer>0&&play.phase==='return'){finishTwoOne(false,'A tabela não encaixou; siga a jogada');}
}
function updateTwoOneReturnAssist(dt){
  if(!twoOnePlay||twoOnePlay.phase!=='return'||twoOnePlay.returnAssistTimer<=0)return;
  const speed=Math.hypot(ball.vx,ball.vy);if(speed<2)return;
  twoOnePlay.returnAssistTimer=Math.max(0,twoOnePlay.returnAssistTimer-dt);
  const target=projectTwoOneReceiver(speed);
  if(isPassPathBlocked(ball,target,homeMate)){finishTwoOne(false,'Passe de retorno bloqueado; a bola segue');return;}
  if(twoOnePlay.returnTurnBudget<=0)return;
  const dx=target.x-ball.x,dy=target.y-ball.y,angle=Math.atan2(ball.vx*dy-ball.vy*dx,ball.vx*dx+ball.vy*dy);
  const turn=Math.sign(angle)*Math.min(Math.abs(angle),.035,twoOnePlay.returnTurnBudget),cos=Math.cos(turn),sin=Math.sin(turn),vx=ball.vx,vy=ball.vy;
  ball.vx=vx*cos-vy*sin;ball.vy=vx*sin+vy*cos;twoOnePlay.returnTurnBudget-=Math.abs(turn);
}

function updateVisionPassAssist(dt) {
  if(ball.visionPassAssistTimer<=0)return;
  ball.visionPassAssistTimer=Math.max(0,ball.visionPassAssistTimer-dt);
  const passer=ball.passSource,target=ball.passTarget;
  if(!ball.visionPassAssistEnabled||!passer||!target||passer.powerEffect!=='vision'||passer.powerEffectTimer<=0)return;
  const speed=Math.hypot(ball.vx,ball.vy);
  if(speed<3)return;
  const ux=ball.vx/speed,uy=ball.vy/speed,lookAhead=Math.min(250,speed*24);
  const endX=ball.x+ux*lookAhead,endY=ball.y+uy*lookAhead;
  const along=(target.x-ball.x)*ux+(target.y-ball.y)*uy;
  if(along<18||along>lookAhead||pointSegmentDistance(target.x,target.y,ball.x,ball.y,endX,endY)>46)return;
  const bluePass=passer===player1||passer===homeMate;
  const blockers=bluePass?[player2,...(gameMode==='2v2'?[awayMate]:[])]:[player1,...(gameMode==='2v2'?[homeMate]:[])],blockRadius=ball.radius+4;
  if(blockers.some(opponent=>pointSegmentDistance(opponent.x,opponent.y,ball.x,ball.y,target.x,target.y)<opponent.radius+blockRadius))return;
  for(const post of posts)if(pointSegmentDistance(post.x,post.y,ball.x,ball.y,target.x,target.y)<post.radius+ball.radius+3)return;
  const toX=target.x-ball.x,toY=target.y-ball.y;
  const angle=Math.atan2(ux*toY-uy*toX,ux*toX+uy*toY);
  if(Math.abs(angle)>0.5)return;
  const turn=Math.max(-0.0035,Math.min(0.0035,angle));
  const cos=Math.cos(turn),sin=Math.sin(turn);
  ball.vx=(ux*cos-uy*sin)*speed;ball.vy=(ux*sin+uy*cos)*speed;
}

function chooseVisionRunDirection(mate) {
  const p=CONFIG.pitch,candidates=[{x:1,y:-.45},{x:1,y:.45},{x:.8,y:-.75},{x:.8,y:.75}];
  return candidates.map(dir=>{
    const len=Math.hypot(dir.x,dir.y),nx=dir.x/len,ny=dir.y/len,tx=mate.x+nx*96,ty=mate.y+ny*96;
    if(tx<p.left+mate.radius||tx>p.right-mate.radius||ty<p.top+mate.radius||ty>p.bottom-mate.radius)return {dir,score:-Infinity};
    const space=Math.min(Math.hypot(tx-player2.x,ty-player2.y),Math.hypot(tx-awayMate.x,ty-awayMate.y));
    const playerClear=Math.hypot(tx-player1.x,ty-player1.y);
    if(playerClear<player1.radius+mate.radius+18)return {dir,score:-Infinity};
    return {dir,score:space+Math.min(playerClear,120)*.08+nx*16};
  }).sort((a,b)=>b.score-a.score)[0]?.dir||{x:1,y:0};
}

function updateTwoVtwoPassProgress(dt) {
  if(gameMode!=='2v2'||!twoVtwoStats)return;
  if(visionPassRoute){visionPassRoute.timer=Math.max(0,visionPassRoute.timer-dt);if(!visionPassRoute.timer)visionPassRoute=null;}
  if(ball.passExpiry>0)ball.passExpiry=Math.max(0,ball.passExpiry-dt);
  if(!ball.passTarget){if(isBallControlledBy(player2)||isBallControlledBy(awayMate)){twoVtwoStats.passStreak=0;twoVtwoStats.goalAssistPending=false;}return;}
  const target=ball.passTarget,source=ball.passSource;
  if(isBallReceivedBy(target)){
    const teammatePass=(source===player1&&target===homeMate)||(source===homeMate&&target===player1);
    if(teammatePass){
      twoVtwoStats.passStreak++;if(twoVtwoStats.passStreak>=4)twoVtwoStats.completed.passes=true;
      if(source===homeMate&&target===player1)twoVtwoStats.goalAssistPending=true;
    }
    if(ball.passWasVision&&source===player1&&target===homeMate){
      const run=chooseVisionRunDirection(homeMate);
      homeMate.visionRunDirectionX=run.x;homeMate.visionRunDirectionY=run.y;homeMate.visionRunTimer=.46;
      visionPassRoute={from:{x:player1.x,y:player1.y},to:{x:homeMate.x,y:homeMate.y},timer:1.35,maxTimer:1.35};
      showPowerFeedback('Passe encaixado · parceiro ataca o espaço',true,false);
    }
    ball.passTarget=null;ball.passSource=null;ball.passExpiry=0;ball.passWasVision=false;
    return;
  }
  const intercepted=isBallControlledBy(player2)||isBallControlledBy(awayMate);
  const possessionChanged=(isBallControlledBy(player1)||isBallControlledBy(homeMate))&&source!==ball.dribbleLockOwner;
  if(intercepted||ball.passExpiry<=0||possessionChanged){
    twoVtwoStats.passStreak=0;
    if(intercepted)twoVtwoStats.goalAssistPending=false;
    ball.passTarget=null;ball.passSource=null;ball.passExpiry=0;ball.passWasVision=false;
  }
}

const POWER_COOLDOWNS = {cannon:8,sprint:12,phantom:12,vision:16,curve:12,twoOne:18,snakeTackle:16,control:12,eagle:12,sniper:14,shadow:15,ego:18};
const POWER_LABELS = Object.fromEntries(ITEMS.powers.map(p => [p.id,p.name]));
const PHANTOM_UPGRADE_COSTS = {2:1000,3:1800};
function phantomLevelFor(actor) {
  return actor.isHuman ? Math.max(1,Math.min(3,Number(profile.powerLevels.phantom)||1)) : 1;
}
function phantomStats(actor) {
  const level=phantomLevelFor(actor);
  return {level,duration:[0,0.55,0.60,0.65][level],dodgeChance:[0,0.38,0.44,0.50][level],cutForce:[0,4.8,5.1,5.4][level],cooldown:[0,12,11.25,10.5][level]};
}
function isBallControlledBy(actor) {
  if(actor.tackleStaggerTimer>0)return false;
  const closeEnough=Math.hypot(ball.x-actor.x,ball.y-actor.y)<=actor.radius+ball.radius+9;
  const relativeSpeed=Math.hypot(ball.vx-actor.vx,ball.vy-actor.vy);
  return closeEnough&&relativeSpeed<=7.5;
}
function isBallReceivedBy(actor){
  const distance=Math.hypot(ball.x-actor.x,ball.y-actor.y),relativeSpeed=Math.hypot(ball.vx-actor.vx,ball.vy-actor.vy);
  // Uses the control radius and the same capture-speed limit as the dribble system.
  return distance<=actor.radius+ball.radius+9&&relativeSpeed<=8.5;
}
function choosePhantomCut(actor) {
  const sideX=-actor.facingY,sideY=actor.facingX;
  const bot=actor.isHuman?player2:player1;
  const score=(sign)=>{
    const x=actor.x+sideX*sign*64,y=actor.y+sideY*sign*64,s=CONFIG.stadium;
    const clearance=Math.min(x-s.minX,s.maxX-x,y-s.minY,s.maxY-y);
    return Math.hypot(x-bot.x,y-bot.y)+Math.min(clearance,64)*0.35;
  };
  const sign=score(1)>=score(-1)?1:-1;
  return {x:sideX*sign,y:sideY*sign};
}
function phantomEvadesBote(holder,defender) {
  if(holder.powerEffect!=='phantom'||holder.powerEffectTimer<=0)return false;
  const inRange=Math.hypot(defender.x-ball.x,defender.y-ball.y)<=defender.radius+ball.radius+8;
  if(inRange&&!holder.ghostDodgeUsed){
    holder.ghostDodgeUsed=true;holder.ghostDodgeSuccess=Math.random()<phantomStats(holder).dodgeChance;
    if(holder.ghostDodgeSuccess&&holder.isHuman)showPowerFeedback('O bote passou pela sombra',true);
  }
  return holder.ghostDodgeSuccess;
}
function shouldBallContact(collidingPlayer,ghostHolders){return !ghostHolders.some(holder=>phantomEvadesBote(holder,collidingPlayer));}
function updatePhantomBallCarry(actor,dt) {
  if(actor.powerEffect!=='phantom'||actor.phantomDribbleTimer<=0||(ball.dribbleLockTimer>0&&ball.dribbleLockOwner===actor)||input.kickRequested)return;
  const inputX=actor.isHuman?(input.right?1:0)-(input.left?1:0):0;
  const inputY=actor.isHuman?(input.down?1:0)-(input.up?1:0):0;
  if(inputX||inputY){const len=Math.hypot(inputX,inputY);actor.phantomDirectionX=inputX/len;actor.phantomDirectionY=inputY/len;}
  else if(Math.hypot(actor.vx,actor.vy)>0.8){const len=Math.hypot(actor.vx,actor.vy);actor.phantomDirectionX=actor.vx/len;actor.phantomDirectionY=actor.vy/len;}
  const targetX=actor.x+actor.phantomDirectionX*(actor.radius+ball.radius+4);
  const targetY=actor.y+actor.phantomDirectionY*(actor.radius+ball.radius+4);
  const errorX=targetX-ball.x,errorY=targetY-ball.y;
  const correction=(value)=>Math.max(-2.1,Math.min(2.1,value*0.12));
  ball.vx+=(actor.vx-ball.vx)*0.08+correction(errorX);
  ball.vy+=(actor.vy-ball.vy)*0.08+correction(errorY);
}
function updatePlayerDribbleControl(actor){
  if(actor.tackleStaggerTimer>0||actor.powerEffect==='phantom'||ball.curveTimer>0||ball.powerShotTimer>0||(ball.dribbleLockTimer>0&&ball.dribbleLockOwner===actor)||(actor.isHuman&&input.kickRequested))return;
  const dx=ball.x-actor.x,dy=ball.y-actor.y,dist=Math.hypot(dx,dy),contactRange=actor.radius+ball.radius+18;
  if(dist>contactRange||Math.hypot(ball.vx-actor.vx,ball.vy-actor.vy)>8.5)return;
  let faceX=actor.facingX,faceY=actor.facingY;
  if(actor.isHuman){
    const moveX=(input.right?1:0)-(input.left?1:0),moveY=(input.down?1:0)-(input.up?1:0);
    if(!moveX&&!moveY&&Math.hypot(actor.vx,actor.vy)<0.35)return;
    if(moveX||moveY){const length=Math.hypot(moveX,moveY);faceX=moveX/length;faceY=moveY/length;}
  } else if(Math.hypot(actor.vx,actor.vy)<0.35)return;
  const targetDistance=actor.radius+ball.radius+4,targetX=actor.x+faceX*targetDistance,targetY=actor.y+faceY*targetDistance;
  const correction=value=>Math.max(-2.2,Math.min(2.2,value*0.14));
  // Carry responsivo: a bola ganha a velocidade do jogador e uma correção curta rumo ao toque à frente.
  ball.vx+=(actor.vx-ball.vx)*0.38+correction(targetX-ball.x);
  ball.vy+=(actor.vy-ball.vy)*0.38+correction(targetY-ball.y);
}
function applyPower(id, actor) {
  if (!id || actor.powerCooldown > 0 || gameState.pausedForGoal || gameState.isGameOver || actor.powerEffectTimer > 0 || actor.powerEffect || actor.nextKickPower !== 1 || actor.nextKickReach !== 1 || twoOneSelection || twoOnePlay || snakeTackles.some(tackle=>tackle.owner===actor)) return false;
  const nearBall = Math.hypot(ball.x-actor.x,ball.y-actor.y) <= actor.radius+ball.radius+CONFIG.physics.kickReachMargin+15;
  if(id==='snakeTackle'){
    const opponents=getSnakeOpponents(actor),carrier=findControlledActor(opponents);
    if(!['match','2v2','training'].includes(gameMode)||!carrier||Math.hypot(carrier.x-actor.x,carrier.y-actor.y)>185){
      if(actor.isHuman)showPowerFeedback('O Bote da Serpente exige um rival com a bola por perto',true,false);
      return false;
    }
    const directionLength=Math.hypot(actor.facingX,actor.facingY)||1;
    snakeTackles.push({owner:actor,phase:'warning',timer:.42,phaseDuration:.42,dirX:actor.facingX/directionLength,dirY:actor.facingY/directionLength,range:164,resolved:false,hit:false,outcome:null});
  }
  if(id==='twoOne'){
    if(actor!==player1||!isBallControlledBy(actor)){if(actor.isHuman)showPowerFeedback('Domine a bola para iniciar Toque e Passa',true);return false;}
    const targets=getTwoOneEligibleTargets(actor);
    if(!targets.length){showPowerFeedback('Nenhum companheiro próximo e livre para Toque e Passa',true);return false;}
    twoOneSelection={target:targets[0],timer:3};showPowerFeedback(`Alvo: companheiro · pressione F ou clique nele`,true);
    return true;
  }
  if (id==='curve'&&!isBallControlledBy(actor)){if(actor.isHuman)showPowerFeedback('Domine a bola para usar Curva Impossível',true);return false;}
  if (['control','eagle','sniper'].includes(id) && !nearBall) return false;
  if (id === 'phantom' && !isBallControlledBy(actor)) {
    if(actor.isHuman)showPowerFeedback('Domine a bola para usar o Drible Fantasma',true);
    return false;
  }
  if (id === 'cannon') actor.nextKickPower=1.65;
  else if (id === 'curve') actor.powerEffect='curve';
  else if (id === 'control') { ball.vx*=0.32; ball.vy*=0.32; }
  else if (id === 'eagle') actor.nextKickReach=1.65;
  else if (id === 'phantom') {
    const stats=phantomStats(actor),cut=choosePhantomCut(actor);
    actor.powerEffect='phantom';actor.powerEffectTimer=stats.duration;
    actor.phantomDribbleTimer=stats.duration;actor.phantomDirectionX=cut.x;actor.phantomDirectionY=cut.y;
    actor.ghostCutTimer=0.22;actor.ghostDodgeUsed=false;actor.ghostDodgeSuccess=false;actor.ghostTrailTimer=0;
    actor.vx+=cut.x*stats.cutForce;actor.vy+=cut.y*stats.cutForce;
    ball.vx+=cut.x*stats.cutForce*0.72;ball.vy+=cut.y*stats.cutForce*0.72;
  }
  else if (id === 'sprint') {
    let dx=actor.facingX,dy=actor.facingY;const len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;
    actor.vx=dx*10.5;actor.vy=dy*10.5;actor.dashTimer=0.72;
  } else if (id === 'ego') {
    actor.powerEffect=id; actor.powerEffectTimer=id==='ego'?5:4;
  } else if (id === 'vision') { actor.powerEffect='vision'; actor.powerEffectTimer=20; }
  else if (id === 'shadow') { actor.powerEffect='shadow'; actor.powerEffectTimer=4; }
  else if (id === 'sniper') actor.powerEffect='sniper';
  actor.powerCooldown=id==='vision'||id==='curve'||id==='snakeTackle'?0:(id==='phantom'?phantomStats(actor).cooldown:(POWER_COOLDOWNS[id]||12));
  if (actor.isHuman) {
    showPowerFeedback(`${POWER_LABELS[id]} ativado`, false, !['cannon','sprint','phantom','snakeTackle'].includes(id));
  }
  else showPowerFeedback(`${POWER_LABELS[id]}: bot`, true);
  if(id==='sprint') Sound.playLightning();
  if(id==='phantom')Sound.playPhantom();
  return true;
}
let powerReadyLast = true;
function updatePowerBot(dt,actor=player2) {
  actor.aiPowerThink-=dt;
  if (actor.aiPowerThink>0 || actor.powerCooldown>0 || actor.powerEffectTimer>0 || actor.powerEffect) return;
  actor.aiPowerThink=7+Math.random()*3;
  if (Math.random()>0.32 || Math.hypot(ball.x-actor.x,ball.y-actor.y)>190) return;
  const botPowers=ITEMS.powers.filter(power=>power.id!=='twoOne');
  actor.aiPowerId=botPowers[Math.floor(Math.random()*botPowers.length)].id;
  const id=actor.aiPowerId,nearBall=Math.hypot(ball.x-actor.x,ball.y-actor.y)<=actor.radius+ball.radius+30;
  if(['cannon','curve','control','eagle','sniper','phantom'].includes(id)&&!nearBall)return;
  if(['curve','phantom'].includes(id)&&!isBallControlledBy(actor))return;
  if(id==='sprint'&&Math.hypot(ball.x-actor.x,ball.y-actor.y)<40)return;
  if(id==='shadow'&&Math.hypot(ball.x-actor.x,ball.y-actor.y)>145)return;
  applyPower(id,actor);actor.aiPowerId=null;
}
function showPowerFeedback(message, quiet=false, sound=true) {
  const toast=document.getElementById('power-toast'); if(!toast) return;
  toast.textContent=message; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),quiet?900:1300);
  if(!quiet&&sound) Sound.playKick();
}

/* ==========================================================================
   7. ELEMENTOS DO DOM E ESTADO DA PARTIDA
   ========================================================================== */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const previewCanvas = document.getElementById('player-preview-canvas');
const previewCtx = previewCanvas.getContext('2d');

const menuOverlay = document.getElementById('menu-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const gameOverTitle = document.getElementById('game-over-title');
const gameOverReason = document.getElementById('game-over-reason');
const finalScoreP1El = document.getElementById('final-score-p1');
const finalScoreP2El = document.getElementById('final-score-p2');
const finalBadgeP1 = document.getElementById('final-badge-p1');

const startBtn = document.getElementById('start-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const btnMenu = document.getElementById('btn-menu');
const btnPass = document.getElementById('btn-pass');
const btnRestart = document.getElementById('btn-restart');
const jerseyInput = document.getElementById('jersey-number-input');
const customColorInput = document.getElementById('custom-color-input');
const colorSwatches = document.querySelectorAll('.color-swatch');

const scoreP1El = document.getElementById('score-p1');
const scoreP2El = document.getElementById('score-p2');
const timerEl = document.getElementById('hud-timer');
const goalBanner = document.getElementById('goal-banner');
const badgeP1 = document.getElementById('badge-p1');

// Instanciação das Entidades
const player1 = new Player(260, 300, 22, '#2b70f6', 10, true);
const player2 = new Player(740, 300, 22, '#e53935', 10, false);
const homeMate = new Player(390, 220, 20, '#2b70f6', 7, false);
homeMate.isTeammate=true;
const awayMate = new Player(810, 380, 20, '#f15b5b', 9, false);
awayMate.isAwayMate=true;
const ball = new Ball(CONFIG.pitch.centerX, CONFIG.pitch.centerY, 9.5);

const posts = [
  new GoalPost(CONFIG.pitch.left, CONFIG.goals.topY),
  new GoalPost(CONFIG.pitch.left, CONFIG.goals.bottomY),
  new GoalPost(CONFIG.pitch.right, CONFIG.goals.topY),
  new GoalPost(CONFIG.pitch.right, CONFIG.goals.bottomY)
];

function setPitchLayout(mode='match') {
  const layout=PITCH_LAYOUTS[mode==='2v2'?'2v2':'match'],p=CONFIG.pitch,g=CONFIG.goals;
  homeMate.radius=mode==='2v2'?22:20;awayMate.radius=mode==='2v2'?22:20;
  p.left=layout.left;p.right=layout.right;p.top=layout.top;p.bottom=layout.bottom;
  const center=(p.top+p.bottom)/2;g.topY=center-layout.goalHeight/2;g.bottomY=center+layout.goalHeight/2;
  posts[0].x=posts[2].x=p.left;posts[1].x=posts[3].x=p.right;
  posts.forEach((post,index)=>post.y=index%2===0?g.topY:g.bottomY);
  rebuildPitchCollisionGeometry();
  aiState.ownGoalCenter={x:p.right,y:p.centerY};
  aiState.enemyGoalCenter={x:p.left,y:p.centerY};
}

// Estado global do jogo
let gameState = {
  running: false,
  isGameOver: false,
  pausedForGoal: false,
  goalPauseTimer: 0,
  timeRemaining: CONFIG.rules.matchDurationSeconds, // 180s regressivos
  scoreP1: 0,
  scoreP2: 0,
  isOvertime: false,
  overtimeTimeRemaining: 60,
  lastTimestamp: 0,
  physicsAccumulator: 0
};
let gameMode='match';
let trainingMatchSnapshot=null;
let trainingReturnMode='match';
let hasNormalMatchInProgress=false;
let trainingDummyHasBall=false;
let twoOneSelection=null,twoOnePlay=null,twoOneImpactTimer=0;
let visionPassRoute=null;
let twoVtwoStats=null;

function newTwoVtwoStats(){return {passStreak:0,completed:{passes:false,twoOne:false,goalAfterMatePass:false},goalAssistPending:false};}

let playerConfig = {
  color: '#2b70f6',
  number: 10
};

// Controles do Jogador
const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  kickRequested: false,
  passRequested: false,
  powerRequested: false
};

window.addEventListener('keydown', (e) => {
  Sound.init();
  const code = e.code;
  if (!twoOnePlay && (code === 'KeyW' || code === 'ArrowUp')) input.up = true;
  if (!twoOnePlay && (code === 'KeyS' || code === 'ArrowDown')) input.down = true;
  if (!twoOnePlay && (code === 'KeyA' || code === 'ArrowLeft')) input.left = true;
  if (!twoOnePlay && (code === 'KeyD' || code === 'ArrowRight')) input.right = true;
  if (code === 'Space') {
    if(!twoOnePlay)input.kickRequested = true;
    e.preventDefault();
  }
  if (code === 'KeyF' && !twoOnePlay && !e.repeat && gameState.running && !gameState.isGameOver && !gameState.pausedForGoal) { input.passRequested=true; e.preventDefault(); }
  if(code==='Escape'&&twoOneSelection){twoOneSelection=null;input.passRequested=false;showPowerFeedback('Seleção cancelada',true);}
  if (code === 'KeyQ') { if(!twoOnePlay)input.powerRequested = true; e.preventDefault(); }
});

window.addEventListener('keyup', (e) => {
  const code = e.code;
  if (code === 'KeyW' || code === 'ArrowUp') input.up = false;
  if (code === 'KeyS' || code === 'ArrowDown') input.down = false;
  if (code === 'KeyA' || code === 'ArrowLeft') input.left = false;
  if (code === 'KeyD' || code === 'ArrowRight') input.right = false;
  if (code === 'Space') input.kickRequested = false;
  if (code === 'KeyF') input.passRequested = false;
  if (code === 'KeyQ') input.powerRequested = false;
});

window.addEventListener('mousedown', (e) => {
  Sound.init();
  if(twoOneSelection||twoOnePlay)return;
  if (e.button === 0 && gameState.running && !gameState.isGameOver && !e.target.closest('button')) {
    input.kickRequested = true;
  }
});

canvas.addEventListener('click',e=>{
  if(!twoOneSelection)return;
  const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*canvas.width/rect.width,y=(e.clientY-rect.top)*canvas.height/rect.height;
  if(Math.hypot(x-twoOneSelection.target.x,y-twoOneSelection.target.y)<=twoOneSelection.target.radius+22)confirmTwoOneSelection();
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) input.kickRequested = false;
});
btnPass.addEventListener('click',()=>{if(gameState.running&&!gameState.isGameOver&&!gameState.pausedForGoal&&!twoOnePlay)input.passRequested=true;});

/* ==========================================================================
   8. DETECÇÃO DE GOLS E FIM DE PARTIDA
   ========================================================================== */

function checkGoal() {
  if (gameState.pausedForGoal || gameState.isGameOver) return;

  const p = CONFIG.pitch;
  const g = CONFIG.goals;
  const isInsideGoalY = ball.y >= g.topY && ball.y <= g.bottomY;

  // Gol do Bot Vermelho (bola no gol esquerdo)
  if (ball.x + ball.radius < p.left - 4 && isInsideGoalY) {
    handleGoal('p2');
  }
  // Gol do Jogador (bola no gol direito)
  else if (ball.x - ball.radius > p.right + 4 && isInsideGoalY) {
    handleGoal('p1');
  }
}

function handleGoal(scoringTeam) {
  gameState.pausedForGoal = true;
  gameState.goalPauseTimer = 2.0;

  if (scoringTeam === 'p1') {
    gameState.scoreP1++;
    scoreP1El.textContent = gameState.scoreP1;
    goalBanner.style.color = '#38bdf8';
    goalBanner.textContent = 'GOOOOL!';
  } else {
    gameState.scoreP2++;
    scoreP2El.textContent = gameState.scoreP2;
    goalBanner.style.color = '#f87171';
    goalBanner.textContent = gameMode==='2v2'?'GOL ADVERSÁRIO!':'GOL DO BOT!';
  }

  if(gameMode==='2v2'&&scoringTeam==='p1'&&twoVtwoStats?.goalAssistPending)twoVtwoStats.completed.goalAfterMatePass=true;
  if(gameMode==='2v2'&&twoVtwoStats)twoVtwoStats.goalAssistPending=false;

  goalBanner.classList.add('show');
  Sound.playGoal();

  for (let i = 0; i < 35; i++) {
    addImpactSpark(ball.x, ball.y);
  }

  if(gameMode==='2v2'&&gameState.isOvertime){
    setTimeout(()=>endGame(scoringTeam==='p1'?'p1_golden_goal':'p2_golden_goal'),1200);
  } else if(gameMode!=='2v2'&&(gameState.scoreP1 >= CONFIG.rules.goalsToWin || gameState.scoreP2 >= CONFIG.rules.goalsToWin)) {
    setTimeout(() => endGame(gameState.scoreP1 >= CONFIG.rules.goalsToWin ? 'p1_win_5_goals' : 'p2_win_5_goals'),1500);
  }
}

function beginGoldenGoal() {
  gameState.isOvertime=true;gameState.overtimeTimeRemaining=60;gameState.timeRemaining=0;
  resetPositions();gameState.pausedForGoal=true;gameState.goalPauseTimer=1.2;
  goalBanner.style.color='#fbbf24';goalBanner.textContent='GOL DE OURO';goalBanner.classList.add('show');
  updateTimerDisplay();showPowerFeedback('Empate · prorrogação de gol de ouro',true,false);
}

function endGame(reason) {
  gameState.isGameOver = true;
  gameState.running = false;
  Sound.playWhistle();
  ECONOMY.recordMatch();

  finalScoreP1El.textContent = gameState.scoreP1;
  finalScoreP2El.textContent = gameState.scoreP2;
  finalBadgeP1.style.backgroundColor = playerConfig.color;
  const finalTeamNames=document.querySelectorAll('.final-team-name');
  finalTeamNames[0].textContent=gameMode==='2v2'?'Você + Parceiro':'Você';
  finalTeamNames[1].textContent=gameMode==='2v2'?'Dupla adversária':'Bot';

  // Determina resultado
  let outcome; // 'win' | 'draw' | 'loss'
  if (reason === 'p1_win_5_goals' || reason === 'p1_golden_goal') {
    outcome = 'win';
    gameOverTitle.textContent  = 'VITÓRIA ÉPICA!';
    gameOverTitle.style.color  = '#4ade80';
    gameOverReason.textContent = reason==='p1_golden_goal'?'Sua dupla marcou o gol de ouro e venceu!':`Você atingiu ${CONFIG.rules.goalsToWin} gols primeiro e conquistou a partida!`;
  } else if (reason === 'p2_win_5_goals' || reason === 'p2_golden_goal') {
    outcome = 'loss';
    gameOverTitle.textContent  = 'DERROTA!';
    gameOverTitle.style.color  = '#f87171';
    gameOverReason.textContent = reason==='p2_golden_goal'?'A dupla adversária marcou o gol de ouro.':`O Bot Vermelho atingiu ${CONFIG.rules.goalsToWin} gols primeiro.`;
  } else {
    // Tempo Esgotado
    if (gameState.scoreP1 > gameState.scoreP2) {
      outcome = 'win';
      gameOverTitle.textContent  = 'VITÓRIA!';
      gameOverTitle.style.color  = '#4ade80';
      gameOverReason.textContent = gameMode==='2v2'?'Sua dupla venceu a partida!':'O tempo regulamentar acabou e você venceu no placar!';
    } else if (gameState.scoreP2 > gameState.scoreP1) {
      outcome = 'loss';
      gameOverTitle.textContent  = 'DERROTA!';
      gameOverTitle.style.color  = '#f87171';
      gameOverReason.textContent = gameMode==='2v2'?'A dupla adversária venceu a partida.':'O tempo acabou e o Bot Vermelho marcou mais gols.';
    } else {
      outcome = 'draw';
      gameOverTitle.textContent  = 'EMPATE!';
      gameOverTitle.style.color  = '#fbbf24';
      gameOverReason.textContent = gameMode==='2v2'?'O gol de ouro não saiu. A partida terminou empatada.':'Partida muito disputada! Terminou em empate.';
    }
  }

  // Calcula recompensas
  const baseReward  = ECONOMY.REWARDS[outcome === 'win' ? 'win' : outcome === 'draw' ? 'draw' : 'loss'];
  const participationReward=gameMode==='2v2'?50:0;
  const winBonus=gameMode==='2v2'&&outcome==='win'?50:0;
  const goalsReward = gameState.scoreP1 * ECONOMY.REWARDS.perGoal;
  const challengeReward=gameMode==='2v2'&&twoVtwoStats?Object.values(twoVtwoStats.completed).reduce((sum,complete)=>sum+(complete?25:0),0):0;
  const totalReward = baseReward + participationReward + winBonus + goalsReward + challengeReward;
  const newBalance  = ECONOMY.addCoins(totalReward);

  // Preenche UI de Recompensas
  const resultLabel = outcome === 'win' ? 'Vitória' : outcome === 'draw' ? 'Empate' : 'Derrota';
  document.getElementById('reward-result-label').textContent = `${resultLabel}:`;
  document.getElementById('reward-result-val').textContent   = `+${baseReward} 🪙`;
  document.getElementById('reward-goals-label').textContent  = `${gameMode==='2v2'?'Gols da dupla':'Gols marcados'} (${gameState.scoreP1}×10):`;
  document.getElementById('reward-goals-val').textContent    = `+${goalsReward} 🪙`;
  document.getElementById('reward-participation-row').hidden=gameMode!=='2v2';
  document.getElementById('reward-participation-val').textContent=`+${participationReward} 🪙`;
  document.getElementById('reward-win-row').hidden=winBonus===0;
  document.getElementById('reward-win-val').textContent=`+${winBonus} 🪙`;
  document.getElementById('reward-challenges-row').hidden=gameMode!=='2v2';
  document.getElementById('reward-challenges-val').textContent=`+${challengeReward} 🪙`;
  const challengeNames={passes:'Completar 4 passes seguidos',twoOne:'Completar uma tabela Toque e Passa',goalAfterMatePass:'Marcar após receber do parceiro'};
  document.getElementById('two-v-two-challenges-summary').textContent=gameMode==='2v2'&&twoVtwoStats?`Desafios (25 litocoins cada):\n${Object.entries(challengeNames).map(([key,name])=>`${twoVtwoStats.completed[key]?'✓':'○'} ${name}`).join('\n')}`:'';
  document.getElementById('two-v-two-challenges-summary').hidden=gameMode!=='2v2';
  document.getElementById('reward-new-balance').textContent  = `🪙 ${newBalance.toLocaleString('pt-BR')}`;

  // Animação de contagem do total ganho
  const totalEl = document.getElementById('reward-total-val');
  totalEl.textContent = '+0 🪙';
  let counted = 0;
  const step  = Math.max(1, Math.floor(totalReward / 30));
  const timer = setInterval(() => {
    counted = Math.min(counted + step, totalReward);
    totalEl.textContent = `+${counted} 🪙`;
    if (counted >= totalReward) clearInterval(timer);
  }, 40);

  updateCoinUI();
  gameOverOverlay.classList.remove('hidden');
}

function resetPositions() {
  snakeTackles.length=0;
  twoOneSelection=null;twoOnePlay=null;twoOneImpactTimer=0;
  const p=CONFIG.pitch;
  if(gameMode==='2v2'){
    player1.reset(p.left+p.width*.30,p.centerY);
    homeMate.reset(p.left+p.width*.43,p.centerY+82);
    player2.reset(p.right-p.width*.30,p.centerY+5);
    awayMate.reset(p.right-p.width*.43,p.centerY-82);
  } else if(gameMode==='training'){
    trainingDummyHasBall=true;player1.reset(p.centerX-200,p.centerY);player1.facingX=1;player1.facingY=0;homeMate.reset(p.centerX-285,p.centerY+105);
    player2.reset(p.centerX-70,p.centerY);pinTrainingDummy();awayMate.reset(CONFIG.canvasWidth+130,CONFIG.canvasHeight+100);
  } else {
    player1.reset(260,300);player2.reset(740,300);
    homeMate.reset(CONFIG.canvasWidth+100,CONFIG.canvasHeight+100);awayMate.reset(CONFIG.canvasWidth+130,CONFIG.canvasHeight+100);
  }
  ball.reset(p.centerX,p.centerY);visionPassRoute=null;
  goalBanner.classList.remove('show');
}

function copyEntityState(entity){return JSON.parse(JSON.stringify(entity));}
function restoreEntityReference(entity){if(!entity)return null;return entity.isHuman?player1:entity.isAwayMate?awayMate:entity.isTeammate?homeMate:player2;}
function serializeSnakeTackle(tackle){const ownerKey=tackle.owner===player1?'player1':tackle.owner===homeMate?'homeMate':tackle.owner===awayMate?'awayMate':'player2';const {owner,...state}=tackle;return {...state,ownerKey};}
function restoreSnakeTackle(state){const {ownerKey,...tackle}=state;return {...tackle,owner:({player1,player2,homeMate,awayMate})[ownerKey]||player1};}
function pinTrainingDummy(){
  const p=CONFIG.pitch;
  player2.x=p.centerX-70;player2.y=p.centerY;player2.vx=0;player2.vy=0;player2.facingX=-1;player2.facingY=0;
}
function updateTrainingDummyBall(){
  if(gameMode!=='training')return;
  const distance=Math.hypot(ball.x-player2.x,ball.y-player2.y),speed=Math.hypot(ball.vx,ball.vy),holdDistance=player2.radius+ball.radius+4;
  if(ball.dribbleLockOwner===player1||speed>4.5||distance>holdDistance+65)trainingDummyHasBall=false;
  else if(!trainingDummyHasBall&&!ball.dribbleLockOwner&&speed<.8&&distance<100)trainingDummyHasBall=true;
  if(!trainingDummyHasBall)return;
  ball.x=player2.x-player2.radius-ball.radius-4;ball.y=player2.y;ball.vx=0;ball.vy=0;ball.dribbleLockTimer=1/60;ball.dribbleLockOwner=player2;
}
function beginTraining(){
  trainingReturnMode=gameMode==='2v2'?'2v2':'match';
  trainingMatchSnapshot=hasNormalMatchInProgress?{game:{timeRemaining:gameState.timeRemaining,scoreP1:gameState.scoreP1,scoreP2:gameState.scoreP2,isGameOver:gameState.isGameOver,pausedForGoal:gameState.pausedForGoal,goalPauseTimer:gameState.goalPauseTimer,isOvertime:gameState.isOvertime,overtimeTimeRemaining:gameState.overtimeTimeRemaining},player1:copyEntityState(player1),player2:copyEntityState(player2),homeMate:copyEntityState(homeMate),awayMate:copyEntityState(awayMate),ball:copyEntityState(ball),twoOneSelection:twoOneSelection?{timer:twoOneSelection.timer}:null,twoOnePlay:twoOnePlay?{...twoOnePlay,runDirection:{...twoOnePlay.runDirection},trail:twoOnePlay.trail.map(point=>({...point}))}:null,twoOneImpactTimer,twoVtwoStats:twoVtwoStats?copyEntityState(twoVtwoStats):null}:null;
  if(trainingMatchSnapshot)trainingMatchSnapshot.snakeTackles=snakeTackles.map(serializeSnakeTackle);
  snakeTackles.length=0;
  setPitchLayout('match');
  gameMode='training';gameState.running=true;gameState.isGameOver=false;gameState.pausedForGoal=false;gameState.physicsAccumulator=0;
  refreshModeHud();
  twoOneSelection=null;twoOnePlay=null;twoOneImpactTimer=0;
  trainingDummyHasBall=true;
  player1.reset(CONFIG.pitch.centerX-200,CONFIG.pitch.centerY);player1.facingX=1;player1.facingY=0;player1.powerCooldown=0;player1.powerEffect=null;player1.powerEffectTimer=0;player1.nextKickPower=1;player1.nextKickReach=1;
  homeMate.reset(CONFIG.pitch.centerX-285,CONFIG.pitch.centerY+105);homeMate.vx=0;homeMate.vy=0;
  player2.reset(CONFIG.pitch.centerX-70,CONFIG.pitch.centerY);pinTrainingDummy();player2.powerCooldown=0;player2.aiPowerId=null;awayMate.reset(CONFIG.canvasWidth+130,CONFIG.canvasHeight+100);ball.reset(CONFIG.pitch.centerX,CONFIG.pitch.centerY);
  input.passRequested=false;input.kickRequested=false;
  document.getElementById('hud-score').hidden=true;timerEl.hidden=true;document.getElementById('hud-training-label').hidden=false;
  document.getElementById('name-p2').hidden=false;document.querySelectorAll('#hud .team-badge')[1].hidden=false;
  btnMenu.textContent='Voltar ao menu';btnRestart.textContent='Reiniciar treino';
  document.getElementById('power-hud').classList.toggle('hidden',!profile.equippedPower);
  menuOverlay.classList.add('hidden');gameOverOverlay.classList.add('hidden');menuWasRunning=false;
  gameState.lastTimestamp=performance.now();requestAnimationFrame(gameLoop);
}
function leaveTraining(){
  gameState.running=false;trainingDummyHasBall=false;gameMode=trainingReturnMode;setPitchLayout(gameMode);
  const hadMatchSnapshot=!!trainingMatchSnapshot;
  document.getElementById('hud-score').hidden=false;timerEl.hidden=false;document.getElementById('hud-training-label').hidden=true;
  document.getElementById('name-p2').hidden=false;document.querySelectorAll('#hud .team-badge')[1].hidden=false;refreshModeHud();
  btnMenu.textContent='Menu';btnRestart.textContent='Reset';
  if(trainingMatchSnapshot){
    const snapshot=trainingMatchSnapshot;Object.assign(player1,snapshot.player1);Object.assign(player2,snapshot.player2);Object.assign(homeMate,snapshot.homeMate);Object.assign(awayMate,snapshot.awayMate);Object.assign(ball,snapshot.ball);if(ball.dribbleLockOwner&&!(ball.dribbleLockOwner instanceof Player)){ball.dribbleLockOwner=ball.dribbleLockOwner.isTeammate?homeMate:ball.dribbleLockOwner.isHuman?player1:ball.dribbleLockOwner.isAwayMate?awayMate:player2;}Object.assign(gameState,snapshot.game);twoOneSelection=snapshot.twoOneSelection?{...snapshot.twoOneSelection,target:homeMate}:null;twoOnePlay=snapshot.twoOnePlay?{...snapshot.twoOnePlay,target:homeMate}:null;twoOneImpactTimer=snapshot.twoOneImpactTimer||0;twoVtwoStats=snapshot.twoVtwoStats;snakeTackles.splice(0,snakeTackles.length,...(snapshot.snakeTackles||[]).map(restoreSnakeTackle));trainingMatchSnapshot=null;
    ball.passTarget=restoreEntityReference(ball.passTarget);ball.passSource=restoreEntityReference(ball.passSource);
    scoreP1El.textContent=gameState.scoreP1;scoreP2El.textContent=gameState.scoreP2;updateTimerDisplay();
  }
  document.getElementById('power-hud').classList.add('hidden');
  menuWasRunning=hadMatchSnapshot&&!gameState.isGameOver;
}
function resetTraining(){
  twoOneSelection=null;twoOnePlay=null;twoOneImpactTimer=0;
  trainingDummyHasBall=true;
  player1.reset(CONFIG.pitch.centerX-200,CONFIG.pitch.centerY);player1.facingX=1;player1.facingY=0;player1.powerCooldown=0;player1.powerEffect=null;player1.powerEffectTimer=0;player1.nextKickPower=1;player1.nextKickReach=1;
  homeMate.reset(CONFIG.pitch.centerX-285,CONFIG.pitch.centerY+105);player2.reset(CONFIG.pitch.centerX-70,CONFIG.pitch.centerY);pinTrainingDummy();player2.powerCooldown=0;player2.aiPowerId=null;player2.nextKickPower=1;player2.nextKickReach=1;awayMate.reset(CONFIG.canvasWidth+130,CONFIG.canvasHeight+100);ball.reset(CONFIG.pitch.centerX,CONFIG.pitch.centerY);
}

function refreshModeHud(){
  document.getElementById('name-p1').textContent=gameMode==='2v2'?'Você + Parceiro':'Você';
  document.getElementById('name-p2').textContent=gameMode==='training'?'Adversário de Treino':gameMode==='2v2'?'Dupla Vermelha':'Bot Vermelho';
  document.getElementById('badge-p1').style.backgroundColor=playerConfig.color;
  document.querySelectorAll('#hud .team-badge')[1].style.backgroundColor='#e53935';
  document.getElementById('hud-training-label').textContent='Treino livre · adversário parado';
}

function startFreshMatch(mode='match') {
  gameMode=mode==='2v2'?'2v2':'match';setPitchLayout(gameMode);trainingMatchSnapshot=null;
  hasNormalMatchInProgress=true;
  input.passRequested=false;
  input.kickRequested=false;input.up=false;input.down=false;input.left=false;input.right=false;
  gameState.scoreP1 = 0;
  gameState.scoreP2 = 0;
  gameState.timeRemaining = CONFIG.rules.matchDurationSeconds;
  gameState.isGameOver = false;
  gameState.pausedForGoal = false;
  gameState.goalPauseTimer = 0;
  gameState.isOvertime=false;gameState.overtimeTimeRemaining=60;
  twoVtwoStats=gameMode==='2v2'?newTwoVtwoStats():null;
  player1.powerCooldown=0; player1.powerEffect=null; player1.powerEffectTimer=0; player1.nextKickPower=1; player1.nextKickReach=1;
  player2.powerCooldown=0; player2.powerEffect=null; player2.powerEffectTimer=0; player2.nextKickPower=1; player2.nextKickReach=1;
  for(const bot of [homeMate,awayMate,player2]){bot.powerCooldown=0;bot.aiPowerThink=6+Math.random()*3;bot.aiPowerId=null;bot.nextKickPower=1;bot.nextKickReach=1;}
  scoreP1El.textContent = '0';
  scoreP2El.textContent = '0';
  updateTimerDisplay();
  gameOverOverlay.classList.add('hidden');
  document.getElementById('hud-score').hidden=false;timerEl.hidden=false;document.getElementById('hud-training-label').hidden=true;
  document.getElementById('name-p2').hidden=false;document.querySelectorAll('#hud .team-badge')[1].hidden=false;refreshModeHud();
  resetPositions();
  updateCoinUI();
  updatePowerHud();
}

/** Atualiza todos os displays de moedas na tela (HUD + Menu) */
function updateCoinUI() {
  const bal = ECONOMY.getCoins();
  const formatted = bal.toLocaleString('pt-BR');
  const hudEl  = document.getElementById('hud-coin-count');
  const menuEl = document.getElementById('menu-coin-count');
  if (hudEl)  hudEl.textContent  = formatted;
  if (menuEl) menuEl.textContent = formatted;
}

const menuCard=document.querySelector('#menu-overlay .menu-card');
menuCard.classList.add('menu-card-wide');
const appearanceControls=[...menuCard.querySelectorAll('.menu-group')];
const playerPreview=menuCard.querySelector('.preview-container');
if(playerPreview) playerPreview.style.display='none';
appearanceControls.forEach(el=>el.remove());
const navRow=document.createElement('div'); navRow.className='menu-nav-row'; navRow.innerHTML='<button class="secondary-btn" data-training>Treino</button><button class="secondary-btn" data-view="options">Opções</button><button class="secondary-btn" data-view="shop">Loja</button><button class="secondary-btn" data-view="inventory">Inventário</button><button class="secondary-btn" data-view="credits">Créditos</button>';
startBtn.before(navRow);
navRow.querySelector('[data-training]').addEventListener('click',beginTraining);
startBtn.textContent='Jogar 1v1';
const menuPage=document.createElement('div'); menuPage.className='menu-page hidden'; document.getElementById('menu-overlay').appendChild(menuPage);
let menuWasRunning=false, activePage='shop', activeCategory='shirts';
const pageNames={shop:'Loja',inventory:'Inventário',options:'Opções',credits:'Créditos'};
function persistProfile(){ECONOMY.saveProfile(profile);updateCoinUI();updatePowerHud();const pageBalance=menuPage.querySelector('.menu-page-header .menu-coins-badge');if(pageBalance)pageBalance.textContent=`🪙 ${ECONOMY.getCoins().toLocaleString('pt-BR')}`;}
function showFeaturePage(page){
  activePage=page; menuWasRunning=gameState.running||menuWasRunning; gameState.running=false;
  menuCard.style.display='none'; menuPage.classList.remove('hidden'); menuPage.innerHTML=`<div class="menu-page-header"><h2>${pageNames[page]}</h2><span class="menu-coins-badge">🪙 ${ECONOMY.getCoins().toLocaleString('pt-BR')}</span></div><div class="menu-categories">${page==='shop'||page==='inventory'?`<button data-cat="shirts" class="${activeCategory==='shirts'?'active':''}">Camisas</button><button data-cat="powers" class="${activeCategory==='powers'?'active':''}">Poderes</button>`:''}</div><div id="menu-page-content"></div><button id="feature-back" class="secondary-btn">Voltar ao menu</button>${menuWasRunning?'<button id="feature-resume" class="primary-btn">Continuar partida</button>':''}`;
  if(page==='shop'||page==='inventory') renderItems();
  if(page==='options') renderOptions();
  if(page==='credits') document.getElementById('menu-page-content').innerHTML='<p>Jogo feito inteiramente pelo Lito, com a ajuda do Codex e do Antigravity.</p><p>Rony ajudou no jogo.</p>';
  menuPage.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{activeCategory=b.dataset.cat;showFeaturePage(page);});
  document.getElementById('feature-back').onclick=()=>{menuPage.classList.add('hidden');menuCard.style.display='';};
  const resume=document.getElementById('feature-resume'); if(resume) resume.onclick=()=>{menuPage.classList.add('hidden');menuCard.style.display='';resumeMatch();};
}
function resumeMatch(){if(!gameState.isGameOver){gameState.running=true;gameState.lastTimestamp=performance.now();requestAnimationFrame(gameLoop);document.getElementById('power-hud').classList.remove('hidden');}}
function renderItems(){
  const container=document.getElementById('menu-page-content');
  const allItems=ITEMS[activeCategory]; const owned=activeCategory==='shirts'?profile.ownedShirts:profile.ownedPowers;
  const items=activePage==='inventory'?allItems.filter(item=>owned.includes(item.id)):allItems;
  if(activePage==='inventory'&&!items.length){container.innerHTML='<p class="empty-inventory">Ainda não há itens nesta categoria. Visite a loja para adquirir.</p>';return;}
  container.innerHTML=`<div class="menu-items">${items.map(item=>{
    const has=owned.includes(item.id),equipped=activeCategory==='shirts'?profile.equippedShirt===item.id:profile.equippedPower===item.id;
    const visual=activeCategory==='shirts'?`<span class="item-icon shirt-icon" style="background:linear-gradient(90deg,${item.colors.join(',')})">${item.badge}</span>`:'<span class="item-icon">⚡</span>';
    const level=item.id==='phantom'?phantomLevelFor(player1):0;
    const upgradeCost=item.id==='phantom'?PHANTOM_UPGRADE_COSTS[level+1]:null;
    const phantomInfo=item.id==='phantom'&&has?phantomStats(player1):null;
    const levelInfo=phantomInfo?`<small class="upgrade-level">Nível ${level}/3 · corte ${phantomInfo.duration.toFixed(2)}s · chance de escapar ${Math.round(phantomInfo.dodgeChance*100)}% · recarga ${phantomInfo.cooldown}s</small>`:'';
    const upgradeControl=has&&item.id==='phantom'?(upgradeCost?`${levelInfo}<button class="secondary-btn upgrade-btn" data-upgrade="phantom">Melhorar · ${upgradeCost.toLocaleString('pt-BR')} litocoins</button>`:`${levelInfo}<small class="upgrade-level">Nível máximo</small>`):'';
    return `<article class="menu-item">${visual}<strong>${item.name}${equipped?' · Equipado':''}</strong><p>${item.description}</p><small>${item.price.toLocaleString('pt-BR')} litocoins${has?' · Adquirido':''}</small>${upgradeControl}<button class="${has?'secondary-btn':'primary-btn'}" data-item="${item.id}">${has?(equipped?'Equipado':'Equipar'):'Comprar'}</button></article>`;
  }).join('')}</div>`;
  container.querySelectorAll('[data-item]').forEach(btn=>btn.onclick=()=>{
    const item=items.find(x=>x.id===btn.dataset.item); const arr=activeCategory==='shirts'?profile.ownedShirts:profile.ownedPowers;
    if(!arr.includes(item.id)) {if(ECONOMY.getCoins()<item.price){showPowerFeedback('Saldo insuficiente');return;} ECONOMY.spendCoins(item.price);arr.push(item.id);showPowerFeedback(`${item.name} comprado`);}
    if(item.id==='phantom'&&!profile.powerLevels.phantom)profile.powerLevels.phantom=1;
    if(activeCategory==='shirts'){profile.equippedShirt=item.id;}else{profile.equippedPower=item.id;}
    persistProfile();player1.color=playerConfig.color;renderItems();
  });
  container.querySelectorAll('[data-upgrade="phantom"]').forEach(btn=>btn.onclick=()=>{
    const level=Number(profile.powerLevels.phantom)||1,cost=PHANTOM_UPGRADE_COSTS[level+1];
    if(!cost)return;
    if(ECONOMY.getCoins()<cost){showPowerFeedback('Litocoins insuficientes para melhorar',true);return;}
    ECONOMY.spendCoins(cost);profile.powerLevels.phantom=level+1;persistProfile();
    showPowerFeedback(`Drible Fantasma nível ${level+1}`);renderItems();
  });
}
function renderOptions(){
 const c=document.getElementById('menu-page-content'); c.innerHTML=`<label>Volume <strong id="volume-label">${Math.round((profile.volume??70))}%</strong></label><input id="feature-volume" type="range" min="0" max="100" value="${profile.volume??70}"><label class="toggle-row"><input id="feature-mute" type="checkbox" ${profile.muted?'checked':''}> Silenciar</label>`;
 appearanceControls.forEach(el=>c.appendChild(el));
 const range=c.querySelector('#feature-volume');range.oninput=()=>{profile.volume=Number(range.value);Sound.volume=profile.volume/100;Sound.applyVolume();c.querySelector('#volume-label').textContent=range.value+'%';persistProfile();};
 const mute=c.querySelector('#feature-mute');mute.onchange=()=>{profile.muted=mute.checked;Sound.muted=mute.checked;Sound.applyVolume();persistProfile();};
}
function updatePowerHud(){
 const hud=document.getElementById('power-hud'); if(!hud)return;
 const power=ITEMS.powers.find(p=>p.id===profile.equippedPower);
 hud.classList.toggle('hidden',!gameState.running||!power);
 document.getElementById('power-name').textContent=power?power.name:'Sem poder';
 const shotBuffPending=player1.nextKickPower>1||player1.nextKickReach>1||player1.powerEffect==='curve'||player1.powerEffect==='sniper';
 const visionActive=power?.id==='vision'&&player1.powerEffect==='vision'&&player1.powerEffectTimer>0;
 const curveArmed=power?.id==='curve'&&player1.powerEffect==='curve';
 const twoOneChoosing=!!twoOneSelection,twoOneActive=!!twoOnePlay;
  const snakeTackle=snakeTackles.find(tackle=>tackle.owner===player1),snakeActive=!!snakeTackle;
  const powerButton=document.getElementById('power-activate'),powerButtonLabel=power?.id==='snakeTackle'?'Ativar Bote da Serpente (Q)':'Ativar poder (Q)';powerButton.textContent=power?.id==='snakeTackle'?'🐍':'⚡';powerButton.title=powerButtonLabel;powerButton.setAttribute('aria-label',powerButtonLabel);
 btnPass.hidden=!gameState.running;btnPass.textContent=curveArmed?'Passe curvo (F)':visionActive?'Passe teleguiado (F)':'Passe (F)';btnPass.title=curveArmed?'Passe curvo para o companheiro mais próximo':visionActive?'Passe teleguiado para o companheiro mais próximo':'Passe para o companheiro mais próximo (F)';
  const effectActive=player1.powerEffectTimer>0||snakeActive;
  const cooldownReady=player1.powerCooldown<=0;const ready=cooldownReady&&!shotBuffPending&&!effectActive&&!twoOneChoosing&&!twoOneActive;const btn=powerButton;btn.classList.toggle('cooldown',!cooldownReady);btn.classList.toggle('active',visionActive||twoOneChoosing||twoOneActive||snakeActive);btn.disabled=!ready;
 if(ready&&!powerReadyLast&&power){showPowerFeedback('Poder disponível',true);} powerReadyLast=ready;
 const cooldownDuration=power?.id==='phantom'?phantomStats(player1).cooldown:(POWER_COOLDOWNS[power?.id]||12);
 const fill=document.getElementById('power-meter-fill');
 fill.style.width=visionActive?`${Math.max(0,player1.powerEffectTimer/20*100)}%`:cooldownReady?'100%':`${Math.max(0,100*(1-player1.powerCooldown/cooldownDuration))}%`;
  document.getElementById('power-status').textContent=snakeTackle?(snakeTackle.phase==='warning'?'Mire com WASD/Setas · bote iminente':snakeTackle.phase==='expand'?'Cobra se expandindo':snakeTackle.phase==='strike'?'Bote em andamento':'Cobra desaparecendo'):twoOneChoosing?`Escolha ${twoOneSelection.target.isTeammate?'companheiro':'alvo'} · F ou clique`:twoOneActive?twoOnePlay.phase==='outbound'?'Toque e Passa: arranque para o espaço':twoOnePlay.phase==='receiveWait'?`Companheiro devolve em ${twoOnePlay.waitTimer.toFixed(1)}s`:'Passe adiantado · receba no pé':visionActive?`Visão ativa: ${player1.powerEffectTimer.toFixed(1)}s`:curveArmed?'Curva armada · mire e chute/passe':shotBuffPending?'Próximo chute fortalecido':player1.dashTimer>0?`Dash: ${player1.dashTimer.toFixed(1)}s`:player1.powerEffectTimer>0?`Efeito: ${player1.powerEffectTimer.toFixed(1)}s`:ready?'Pronto · Q':`Recarga ${player1.powerCooldown.toFixed(1)}s`;
}
navRow.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>showFeaturePage(button.dataset.view)));
document.querySelector('#menu-overlay .menu-card').querySelectorAll('.color-swatch').forEach(swatch=>swatch.addEventListener('click',()=>{playerConfig.color=swatch.dataset.color;player1.color=playerConfig.color;homeMate.color=playerConfig.color;}));
document.getElementById('power-activate').addEventListener('click',()=>applyPower(profile.equippedPower,player1));
window.addEventListener('keydown',e=>{if(e.code==='KeyQ'&&gameState.running&&!gameState.isGameOver)applyPower(profile.equippedPower,player1);});

function updateTimerDisplay() {
  const t = Math.max(0, Math.floor(gameState.isOvertime?gameState.overtimeTimeRemaining:gameState.timeRemaining));
  const mins = Math.floor(t / 60).toString().padStart(2, '0');
  const secs = (t % 60).toString().padStart(2, '0');
  timerEl.textContent = gameState.isOvertime?`GOL DE OURO · ${mins}:${secs}`:`${mins}:${secs}`;
}

/* ==========================================================================
   9. RENDERIZAÇÃO GRÁFICA DO CAMPO E REDES
   ========================================================================== */

function drawPitch(renderCtx) {
  const p = CONFIG.pitch;

  // Se houver sprite de textura de gramado registrado no AssetManager, desenha-o
  if (assets.hasSprite('pitchTexture')) {
    renderCtx.drawImage(assets.sprites.pitchTexture, 0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
    return;
  }

  // 1. Área externa do estádio
  renderCtx.fillStyle = '#1c241c';
  renderCtx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

  // 2. Gramado principal
  renderCtx.fillStyle = '#2f7d3d';
  renderCtx.fillRect(p.left, p.top, p.width, p.height);

  // Listras verticais sutis
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

  // 3. Linhas Brancas do Campo
  renderCtx.strokeStyle = '#ffffff';
  renderCtx.lineWidth = p.lineWidth;
  renderCtx.lineCap = 'round';
  renderCtx.lineJoin = 'round';

  renderCtx.strokeRect(p.left, p.top, p.width, p.height);

  // Linha Central
  renderCtx.beginPath();
  renderCtx.moveTo(p.centerX, p.top);
  renderCtx.lineTo(p.centerX, p.bottom);
  renderCtx.stroke();

  // Círculo Central
  renderCtx.beginPath();
  renderCtx.arc(p.centerX, p.centerY, p.centerRadius, 0, Math.PI * 2);
  renderCtx.stroke();

  // Ponto Central
  renderCtx.beginPath();
  renderCtx.arc(p.centerX, p.centerY, 4.5, 0, Math.PI * 2);
  renderCtx.fillStyle = '#ffffff';
  renderCtx.fill();

  // Grandes Áreas
  const paTop = p.centerY - p.penaltyHeight / 2;
  renderCtx.strokeRect(p.left, paTop, p.penaltyWidth, p.penaltyHeight);
  renderCtx.strokeRect(p.right - p.penaltyWidth, paTop, p.penaltyWidth, p.penaltyHeight);

  // Pequenas Áreas
  const gaTop = p.centerY - p.goalAreaHeight / 2;
  renderCtx.strokeRect(p.left, gaTop, p.goalAreaWidth, p.goalAreaHeight);
  renderCtx.strokeRect(p.right - p.goalAreaWidth, gaTop, p.goalAreaWidth, p.goalAreaHeight);

  // Marcas de Pênalti
  renderCtx.beginPath();
  renderCtx.arc(p.left + 85, p.centerY, 3.5, 0, Math.PI * 2);
  renderCtx.arc(p.right - 85, p.centerY, 3.5, 0, Math.PI * 2);
  renderCtx.fillStyle = '#ffffff';
  renderCtx.fill();

  // Redes das Traves
  drawGoalNets(renderCtx);
}

function drawVisionPuzzleOverlay(renderCtx) {
  if(player1.powerEffect!=='vision'||player1.powerEffectTimer<=0)return;
  const p=CONFIG.pitch,size=54,knob=size*.12;
  renderCtx.save();renderCtx.beginPath();renderCtx.rect(p.left,p.top,p.width,p.height);renderCtx.clip();
  renderCtx.strokeStyle='#9be7ff';renderCtx.lineWidth=1.25;renderCtx.globalAlpha=0.105;
  for(let row=0,y=p.top;y<p.bottom;y+=size,row++)for(let col=0,x=p.left;x<p.right;x+=size,col++){
    const right=Math.min(x+size,p.right),bottom=Math.min(y+size,p.bottom),w=right-x,h=bottom-y;
    const edge=(row+col)%4;
    renderCtx.beginPath();renderCtx.moveTo(x,y);
    if(edge===0&&w>size*.8){renderCtx.lineTo(x+w*.36,y);renderCtx.bezierCurveTo(x+w*.38,y-knob,x+w*.62,y-knob,x+w*.64,y);}
    renderCtx.lineTo(right,y);
    if(edge===1&&h>size*.8){renderCtx.lineTo(right,y+h*.36);renderCtx.bezierCurveTo(right+knob,y+h*.38,right+knob,y+h*.62,right,y+h*.64);}
    renderCtx.lineTo(right,bottom);
    if(edge===2&&w>size*.8){renderCtx.lineTo(x+w*.64,bottom);renderCtx.bezierCurveTo(x+w*.62,bottom+knob,x+w*.38,bottom+knob,x+w*.36,bottom);}
    renderCtx.lineTo(x,bottom);
    if(edge===3&&h>size*.8){renderCtx.lineTo(x,y+h*.64);renderCtx.bezierCurveTo(x-knob,y+h*.62,x-knob,y+h*.38,x,y+h*.36);}
    renderCtx.closePath();renderCtx.stroke();
  }
  renderCtx.globalAlpha=0.15;renderCtx.beginPath();renderCtx.arc(ball.x,ball.y,ball.radius+12,0,Math.PI*2);renderCtx.stroke();
  renderCtx.restore();
}

function drawTwoVtwoVisionGuidance(renderCtx) {
  if(gameMode!=='2v2'||player1.powerEffect!=='vision'||player1.powerEffectTimer<=0)return;
  renderCtx.save();renderCtx.lineCap='round';renderCtx.setLineDash([5,5]);
  const pulse=.62+Math.sin(performance.now()/130)*.16;
  renderCtx.globalAlpha=pulse;renderCtx.strokeStyle='#baf4ff';renderCtx.lineWidth=2;
  renderCtx.beginPath();renderCtx.arc(homeMate.x,homeMate.y,homeMate.radius+11,0,Math.PI*2);renderCtx.stroke();
  const p=CONFIG.pitch,ideas=[{x:1,y:-.65},{x:1,y:.65},{x:.65,y:-1},{x:.65,y:1}];
  for(const idea of ideas){
    const length=Math.hypot(idea.x,idea.y),x=homeMate.x+idea.x/length*90,y=homeMate.y+idea.y/length*90;
    if(x<p.left+25||x>p.right-25||y<p.top+25||y>p.bottom-25)continue;
    const nearest=Math.min(Math.hypot(x-player2.x,y-player2.y),Math.hypot(x-awayMate.x,y-awayMate.y));
    if(nearest<42)continue;
    renderCtx.globalAlpha=.22+Math.min(.24,nearest/500);renderCtx.beginPath();renderCtx.arc(x,y,9,0,Math.PI*2);renderCtx.stroke();
  }
  renderCtx.setLineDash([]);
  if(visionPassRoute){
    const alpha=Math.min(1,visionPassRoute.timer/visionPassRoute.maxTimer);
    renderCtx.globalAlpha=alpha*.68;renderCtx.strokeStyle='#c8f7ff';renderCtx.lineWidth=3;
    renderCtx.beginPath();renderCtx.moveTo(visionPassRoute.from.x,visionPassRoute.from.y);renderCtx.lineTo(visionPassRoute.to.x,visionPassRoute.to.y);renderCtx.stroke();
    const count=5;
    for(let i=1;i<count;i++){
      const t=i/count,x=visionPassRoute.from.x+(visionPassRoute.to.x-visionPassRoute.from.x)*t,y=visionPassRoute.from.y+(visionPassRoute.to.y-visionPassRoute.from.y)*t;
      renderCtx.beginPath();renderCtx.arc(x,y,4.5,0,Math.PI*2);renderCtx.fillStyle='#e3fbff';renderCtx.fill();
      renderCtx.beginPath();renderCtx.arc(x,y,7.5,0,Math.PI*2);renderCtx.strokeStyle='#9eeaff';renderCtx.lineWidth=1;renderCtx.stroke();
    }
  }
  renderCtx.restore();
}

function drawSnakeTackles(renderCtx){
  for(const tackle of snakeTackles){
    const actor=tackle.owner,end=getSnakeTackleEndpoint(tackle),angle=Math.atan2(tackle.dirY,tackle.dirX);
    renderCtx.save();renderCtx.lineCap='round';renderCtx.lineJoin='round';
    if(tackle.phase==='warning'){
      const pulse=.42+Math.sin(performance.now()/55)*.12;
      renderCtx.globalAlpha=pulse;renderCtx.strokeStyle='#facc15';renderCtx.fillStyle='#fde68a';renderCtx.lineWidth=3;renderCtx.setLineDash([8,7]);
      renderCtx.beginPath();renderCtx.moveTo(actor.x+tackle.dirX*(actor.radius+5),actor.y+tackle.dirY*(actor.radius+5));renderCtx.lineTo(end.x,end.y);renderCtx.stroke();renderCtx.setLineDash([]);
      renderCtx.beginPath();renderCtx.arc(end.x,end.y,8,0,Math.PI*2);renderCtx.stroke();
      const sideX=-tackle.dirY,sideY=tackle.dirX;
      renderCtx.beginPath();renderCtx.moveTo(end.x,end.y);renderCtx.lineTo(end.x-tackle.dirX*14+sideX*7,end.y-tackle.dirY*14+sideY*7);renderCtx.lineTo(end.x-tackle.dirX*14-sideX*7,end.y-tackle.dirY*14-sideY*7);renderCtx.closePath();renderCtx.fill();
    }
    if(snakeSpriteCanvas){
      const progress=1-tackle.timer/tackle.phaseDuration;
      const frameIndex=tackle.phase==='warning'?0:tackle.phase==='expand'?1:tackle.phase==='strike'?2:3;
      const frame=snakeAtlasFrames[frameIndex];
      const length=tackle.phase==='warning'?42:tackle.phase==='expand'?58+progress*106:tackle.phase==='strike'?164:132;
      const height=tackle.phase==='warning'?28:tackle.phase==='expand'?34+progress*28:tackle.phase==='strike'?66:78;
      renderCtx.globalAlpha=tackle.phase==='fade'?Math.max(0,tackle.timer/tackle.phaseDuration)*.78:.82;
      if(tackle.phase==='fade')renderCtx.translate(end.x-tackle.dirX*38,end.y-tackle.dirY*38);
      else renderCtx.translate(actor.x+tackle.dirX*(actor.radius*.35),actor.y+tackle.dirY*(actor.radius*.35));
      renderCtx.rotate(angle);
      renderCtx.drawImage(snakeSpriteCanvas,frame.x,frame.y,frame.w,frame.h,0,-height/2,length,height);
    }
    renderCtx.restore();
  }
}

function drawTwoOneVisuals(renderCtx){
  if(!twoOneSelection&&!twoOnePlay&&twoOneImpactTimer<=0)return;
  renderCtx.save();renderCtx.lineCap='round';renderCtx.lineJoin='round';
  if(twoOneSelection){
    const target=twoOneSelection.target,alpha=0.55+Math.sin(performance.now()/90)*0.18;
    renderCtx.globalAlpha=alpha;renderCtx.strokeStyle='#67e8f9';renderCtx.fillStyle='#a5f3fc';renderCtx.lineWidth=3;renderCtx.setLineDash([9,7]);
    renderCtx.beginPath();renderCtx.moveTo(player1.x,player1.y);renderCtx.lineTo(target.x,target.y);renderCtx.stroke();renderCtx.setLineDash([]);
    renderCtx.beginPath();renderCtx.arc(target.x,target.y,target.radius+13,0,Math.PI*2);renderCtx.stroke();
    const angle=Math.atan2(target.y-player1.y,target.x-player1.x);renderCtx.beginPath();renderCtx.moveTo(target.x,target.y);renderCtx.lineTo(target.x-Math.cos(angle-.48)*14,target.y-Math.sin(angle-.48)*14);renderCtx.lineTo(target.x-Math.cos(angle+.48)*14,target.y-Math.sin(angle+.48)*14);renderCtx.closePath();renderCtx.fill();
  }
  if(twoOnePlay){
    const points=twoOnePlay.trail;for(let i=1;i<points.length;i++){const t=i/points.length;renderCtx.beginPath();renderCtx.moveTo(points[i-1].x,points[i-1].y);renderCtx.lineTo(points[i].x,points[i].y);renderCtx.strokeStyle=`rgba(103,232,249,${t*.32})`;renderCtx.lineWidth=1+t*2;renderCtx.stroke();}
    if(twoOnePlay.runTimer>0){renderCtx.strokeStyle='rgba(103,232,249,.45)';renderCtx.lineWidth=2;renderCtx.setLineDash([4,5]);renderCtx.beginPath();renderCtx.arc(player1.x,player1.y,player1.radius+7,0,Math.PI*2);renderCtx.stroke();renderCtx.setLineDash([]);}
  }
  if(twoOneImpactTimer>0){const progress=1-twoOneImpactTimer/.32;renderCtx.globalAlpha=1-progress;renderCtx.strokeStyle='#a5f3fc';renderCtx.shadowColor='#22d3ee';renderCtx.shadowBlur=14;renderCtx.lineWidth=3;renderCtx.beginPath();renderCtx.arc(ball.x,ball.y,ball.radius+4+progress*14,0,Math.PI*2);renderCtx.stroke();}
  renderCtx.restore();
}

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

/* ==========================================================================
   10. LOOP PRINCIPAL COM FIXED TIMESTEP (INDEPENDÊNCIA DE TAXA DE HZ)
   ========================================================================== */

function physicsStep(dt) {
  if (gameState.isGameOver) return;

  // 1. Temporizador de Partida Regressivo
  if(gameMode==='training'){
    // Treino livre sem cronômetro, gols ou fim de partida.
  } else if (!gameState.pausedForGoal) {
    if(gameMode==='2v2'&&gameState.isOvertime){
      gameState.overtimeTimeRemaining-=dt;
      if(gameState.overtimeTimeRemaining<=0){gameState.overtimeTimeRemaining=0;updateTimerDisplay();endGame('time_out');return;}
    } else {
      gameState.timeRemaining -= dt;
      if (gameState.timeRemaining <= 0) {
        gameState.timeRemaining = 0;updateTimerDisplay();
        if(gameMode==='2v2'&&gameState.scoreP1===gameState.scoreP2){beginGoldenGoal();return;}
        endGame('time_out');return;
      }
    }
    updateTimerDisplay();
  } else {
    gameState.goalPauseTimer -= dt;
    if (gameState.goalPauseTimer <= 0) {
      gameState.pausedForGoal = false;
      resetPositions();
    }
  }

  // 2. Entrada do Jogador Humano
  let moveX = 0;
  let moveY = 0;
  if (!twoOnePlay&&input.left) moveX -= 1;
  if (!twoOnePlay&&input.right) moveX += 1;
  if (!twoOnePlay&&input.up) moveY -= 1;
  if (!twoOnePlay&&input.down) moveY += 1;

  if (moveX !== 0 && moveY !== 0) {
    const inv = 1 / Math.SQRT2;
    moveX *= inv;
    moveY *= inv;
  }
  const moveLength=Math.hypot(moveX,moveY);
  if(moveLength>0.1){player1.facingX=moveX/moveLength;player1.facingY=moveY/moveLength;}
  if(!gameState.pausedForGoal)updateSnakeTackles(dt,moveX,moveY);
  if (gameMode!=='training'&&player1.powerEffect === 'shadow') { const marker=gameMode==='2v2'&&Math.hypot(awayMate.x-player1.x,awayMate.y-player1.y)<Math.hypot(player2.x-player1.x,player2.y-player1.y)?awayMate:player2,dx=marker.x-player1.x,dy=marker.y-player1.y,d=Math.hypot(dx,dy)||1;moveX+=dx/d*.3;moveY+=dy/d*.3; }

  if (!gameState.pausedForGoal) {
    player1.vx += moveX * CONFIG.physics.playerAcceleration;
    player1.vy += moveY * CONFIG.physics.playerAcceleration;

    if(input.passRequested){
      input.passRequested=false;
      if(twoOnePlay){}
      else if(twoOneSelection)confirmTwoOneSelection();
      else {
        const teammate=nearestPassTeammate(player1),teammateDistance=teammate?Math.hypot(teammate.x-player1.x,teammate.y-player1.y):Infinity;
        if(!teammate||teammateDistance>320)showPowerFeedback('Nenhum aliado próximo para receber o passe',true);
        else if(isVisionPassLaneBlocked())showPowerFeedback('Linha de passe bloqueada',true);
        else {
          const passed=player1.tryKick(ball,moveX,moveY,true,teammate);
          if(!passed)showPowerFeedback(player1.kickCooldownTimer>0?'Aguarde para passar':'Chegue perto da bola para passar',true);
        }
      }
    } else if(input.kickRequested&&!twoOnePlay)player1.tryKick(ball,moveX,moveY);

    // 3. IA do companheiro e do adversário
    if(gameMode==='2v2'){
      updatePowerBot(dt,homeMate);updateHomeMateAI(dt);updateAI(dt);updateAwayMateAI(dt);
    } else if(gameMode==='match')updateAI(dt);
    else if(twoOnePlay?.target===homeMate)updateHomeMateAI(dt);
  }

  // 4. Atualização cinemática
  if(twoOnePlay&&twoOnePlay.runTimer>0){const d=twoOnePlay.runDirection;player1.vx+=d.x*CONFIG.physics.playerAcceleration*1.8;player1.vy+=d.y*CONFIG.physics.playerAcceleration*1.8;player1.twoOneRunTimer=twoOnePlay.runTimer;twoOnePlay.runTimer=Math.max(0,twoOnePlay.runTimer-dt);}
  player1.update(dt);
  if(gameMode==='training'||gameMode==='2v2')homeMate.update(dt);
  player2.update(dt);if(gameMode==='training')pinTrainingDummy();
  if(gameMode==='2v2')awayMate.update(dt);
  updatePlayerDribbleControl(player1);
  if(gameMode==='training'||gameMode==='2v2')updatePlayerDribbleControl(homeMate);
  if(gameMode!=='training')updatePlayerDribbleControl(player2);
  if(gameMode==='2v2')updatePlayerDribbleControl(awayMate);
  updatePhantomBallCarry(player1,dt);
  if(gameMode!=='training')updatePhantomBallCarry(player2,dt);
  if(gameMode==='2v2'){updatePhantomBallCarry(homeMate,dt);updatePhantomBallCarry(awayMate,dt);}
  updateVisionPassAssist(dt);
  updateTwoOneReturnAssist(dt);
  if(player1.dashTimer>0)addLightningTrail(player1);
  if(gameMode==='2v2'){if(homeMate.dashTimer>0)addLightningTrail(homeMate);if(player2.dashTimer>0)addLightningTrail(player2);if(awayMate.dashTimer>0)addLightningTrail(awayMate);}
  if(player1.powerEffect==='phantom'&&player1.powerEffectTimer>0&&player1.ghostTrailTimer<=0){addPhantomShadow(player1);player1.ghostTrailTimer=0.055;}
  ball.update();

  // 5. Resolução de Colisões
  resolveCircleCollision(player1, player2, CONFIG.physics.restitutionPlayer);
  if(gameMode==='training'||gameMode==='2v2')resolveCircleCollision(player1, homeMate, CONFIG.physics.restitutionPlayer);
  if(gameMode==='2v2'){
    resolveCircleCollision(player1,awayMate,CONFIG.physics.restitutionPlayer);
    resolveCircleCollision(player2,homeMate,CONFIG.physics.restitutionPlayer);
    resolveCircleCollision(player2,awayMate,CONFIG.physics.restitutionPlayer);
    resolveCircleCollision(homeMate,awayMate,CONFIG.physics.restitutionPlayer);
  }
  if(gameMode==='training'){pinTrainingDummy();updateTrainingDummyBall();}

  // Colisão da bola com os jogadores (respeita imunidade anti-ricochete do chute)
  if (player1.ignoreBallCollisionFrames <= 0) {
    if(shouldBallContact(player1,[player2,...(gameMode==='2v2'?[awayMate]:[])]))resolveCircleCollision(player1, ball, CONFIG.physics.restitutionBall);
  }
  if (player2.ignoreBallCollisionFrames <= 0) {
    if(shouldBallContact(player2,[player1,...(gameMode==='2v2'?[homeMate]:[])]))resolveCircleCollision(player2, ball, CONFIG.physics.restitutionBall);
  }
  if((gameMode==='training'||gameMode==='2v2')&&homeMate.ignoreBallCollisionFrames<=0&&shouldBallContact(homeMate,[player2,...(gameMode==='2v2'?[awayMate]:[])]))resolveCircleCollision(homeMate,ball,CONFIG.physics.restitutionBall);
  if(gameMode==='2v2'&&awayMate.ignoreBallCollisionFrames<=0&&shouldBallContact(awayMate,[player1,homeMate]))resolveCircleCollision(awayMate,ball,CONFIG.physics.restitutionBall);

  // Postes
  for (let i = 0; i < posts.length; i++) {
    resolveCirclePostCollision(ball, posts[i], CONFIG.physics.restitutionWall);
    resolveCirclePostCollision(player1, posts[i], 0.35);
    if(gameMode==='training'||gameMode==='2v2')resolveCirclePostCollision(homeMate, posts[i], 0.35);
    resolveCirclePostCollision(player2, posts[i], 0.35);
    if(gameMode==='2v2')resolveCirclePostCollision(awayMate,posts[i],0.35);
  }

  // Paredes externas das traves para jogadores
  for (let i = 0; i < netSegmentsForPlayers.length; i++) {
    const seg = netSegmentsForPlayers[i];
    resolveCircleSegment(player1, seg.x1, seg.y1, seg.x2, seg.y2, 0.2);
    if(gameMode==='training'||gameMode==='2v2')resolveCircleSegment(homeMate, seg.x1, seg.y1, seg.x2, seg.y2, 0.2);
    resolveCircleSegment(player2, seg.x1, seg.y1, seg.x2, seg.y2, 0.2);
    if(gameMode==='2v2')resolveCircleSegment(awayMate,seg.x1,seg.y1,seg.x2,seg.y2,.2);
  }

  // Paredes e redes para a bola
  resolveBallBoundaries(ball);
  updateTwoOneState(dt);
  updateTwoVtwoPassProgress(dt);

  // 6. Verificação de Gol
  if(gameMode==='training'){
    const p=CONFIG.pitch,speed=Math.hypot(ball.vx,ball.vy),tooFar=Math.hypot(ball.x-player1.x,ball.y-player1.y)>360&&Math.hypot(ball.x-homeMate.x,ball.y-homeMate.y)>300&&Math.hypot(ball.x-player2.x,ball.y-player2.y)>300;
    if(ball.x<p.left||ball.x>p.right||ball.y<p.top||ball.y>p.bottom||(speed<0.18&&tooFar))ball.reset(p.centerX,p.centerY);
  } else checkGoal();
}

function gameLoop(timestamp) {
  if (!gameState.running) return;

  if (!gameState.lastTimestamp) gameState.lastTimestamp = timestamp;
  let elapsed = (timestamp - gameState.lastTimestamp) / 1000;
  if (elapsed > 0.1) elapsed = 0.1; // Trava contra congelamentos de aba
  gameState.lastTimestamp = timestamp;

  // Acumulador de tempo fixo (Garante exatos 60 FPS de física em qualquer tela)
  const fixedDelta = CONFIG.physics.fixedDelta;
  gameState.physicsAccumulator += elapsed;

  while (gameState.physicsAccumulator >= fixedDelta) {
    physicsStep(fixedDelta);
    gameState.physicsAccumulator -= fixedDelta;
  }

  // Renderização Gráfica
  ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  drawPitch(ctx);
  drawVisionPuzzleOverlay(ctx);
  drawTwoVtwoVisionGuidance(ctx);

  for (let i = 0; i < posts.length; i++) posts[i].draw(ctx);
  updateAndDrawParticles(ctx);
  updateAndDrawPhantomShadows(ctx);
  updateAndDrawLightningTrails(ctx);
  drawSnakeTackles(ctx);
  drawTwoOneVisuals(ctx);
  ball.draw(ctx);
  player1.draw(ctx);
  if(gameMode==='training'||gameMode==='2v2')homeMate.draw(ctx);
  player2.draw(ctx);
  if(gameMode==='2v2')awayMate.draw(ctx);
  updatePowerHud();

  requestAnimationFrame(gameLoop);
}

/* ==========================================================================
   11. PREVIEW DO BOTÃO NO MENU E GERENCIADOR DE EVENTOS DA UI
   ========================================================================== */

function updatePlayerPreview() {
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  const dummyPlayer = new Player(60, 60, 36, playerConfig.color, playerConfig.number, true);
  dummyPlayer.draw(previewCtx);
  badgeP1.style.backgroundColor = playerConfig.color;
}

colorSwatches.forEach(swatch => {
  swatch.addEventListener('click', () => {
    colorSwatches.forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    playerConfig.color = swatch.dataset.color;
    customColorInput.value = playerConfig.color;
    player1.color = playerConfig.color;
    homeMate.color = playerConfig.color;
    updatePlayerPreview();
  });
});

customColorInput.addEventListener('input', (e) => {
  colorSwatches.forEach(s => s.classList.remove('active'));
  playerConfig.color = e.target.value;
  player1.color = playerConfig.color;
  homeMate.color = playerConfig.color;
  updatePlayerPreview();
});

jerseyInput.addEventListener('input', (e) => {
  let val = parseInt(e.target.value, 10);
  if (isNaN(val) || val < 1) val = 1;
  if (val > 99) val = 99;
  playerConfig.number = val;
  player1.number = val;
  updatePlayerPreview();
});

startBtn.addEventListener('click', () => {
  Sound.init();
  menuWasRunning=false;
  const resumeButton=document.getElementById('menu-resume'); if(resumeButton) resumeButton.remove();
  menuOverlay.classList.add('hidden');
  startFreshMatch('match');
  document.getElementById('power-hud').classList.toggle('hidden',!profile.equippedPower);
  if (!gameState.running) {
    gameState.running = true;
    gameState.lastTimestamp = performance.now();
    requestAnimationFrame(gameLoop);
  }
});

const twoVtwoStartBtn=document.createElement('button');
twoVtwoStartBtn.id='start-2v2-btn';twoVtwoStartBtn.className='secondary-btn two-v-two-mode-btn';twoVtwoStartBtn.textContent='2V2 — Duplas contra Duplas';
startBtn.after(twoVtwoStartBtn);
twoVtwoStartBtn.addEventListener('click',()=>{
  Sound.init();menuWasRunning=false;const resumeButton=document.getElementById('menu-resume');if(resumeButton)resumeButton.remove();
  menuOverlay.classList.add('hidden');startFreshMatch('2v2');document.getElementById('power-hud').classList.toggle('hidden',!profile.equippedPower);
  gameState.running=true;gameState.lastTimestamp=performance.now();requestAnimationFrame(gameLoop);
});

playAgainBtn.addEventListener('click', () => {
  Sound.init();
  startFreshMatch(gameMode==='2v2'?'2v2':'match');
  document.getElementById('power-hud').classList.toggle('hidden',!profile.equippedPower);
  if (!gameState.running) {
    gameState.running = true;
    gameState.lastTimestamp = performance.now();
    requestAnimationFrame(gameLoop);
  }
});

btnMenu.addEventListener('click', () => {
  if(gameMode==='training')leaveTraining();
  else if (gameState.running) { menuWasRunning=true; gameState.running=false; document.getElementById('power-hud').classList.add('hidden'); }
  menuOverlay.classList.remove('hidden');
  menuPage.classList.add('hidden'); menuCard.style.display='';
  if(!menuWasRunning){const oldResume=document.getElementById('menu-resume');if(oldResume)oldResume.remove();}
  if(menuWasRunning&&!document.getElementById('menu-resume')){const b=document.createElement('button');b.id='menu-resume';b.className='secondary-btn';b.textContent='Continuar partida';startBtn.after(b);b.onclick=()=>{menuOverlay.classList.add('hidden');resumeMatch();};}
  updateCoinUI();
});

btnRestart.addEventListener('click', () => {
  if(gameMode==='training')resetTraining();else startFreshMatch(gameMode==='2v2'?'2v2':'match');
});

// Listener do botão "Voltar ao Menu" na tela de Game Over
const gameOverMenuBtn = document.getElementById('game-over-menu-btn');
if (gameOverMenuBtn) {
  gameOverMenuBtn.addEventListener('click', () => {
    menuWasRunning=false; const resumeButton=document.getElementById('menu-resume');if(resumeButton)resumeButton.remove();
    gameOverOverlay.classList.add('hidden');
    menuOverlay.classList.remove('hidden');
    updateCoinUI();
  });
}

// Inicialização inicial do canvas, prévias e moedas
updatePlayerPreview();
drawPitch(ctx);
for (let i = 0; i < posts.length; i++) posts[i].draw(ctx);
ball.draw(ctx);
player1.draw(ctx);
player2.draw(ctx);
updateCoinUI();
