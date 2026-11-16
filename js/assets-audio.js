/**
 * ==========================================================================
 * LITO BALL - GERENCIADOR DE ASSETS E SISTEMA DE ÁUDIO (js/assets-audio.js)
 * ==========================================================================
 */
'use strict';

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
   * Carrega imagens para sprites ou efeitos visuais.
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
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.applyVolume();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  applyVolume() {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    }
    this.activeAssetSounds = this.activeAssetSounds.filter(audio => !audio.ended);
    this.activeAssetSounds.forEach(audio => {
      audio.volume = this.muted ? 0 : this.volume;
    });
  },

  playAsset(name, fallback) {
    if (typeof Audio === 'undefined') {
      fallback.call(this);
      return;
    }
    const audio = new Audio(this.assetAudio[name]);
    audio.preload = 'auto';
    audio.volume = this.muted ? 0 : this.volume;
    this.activeAssetSounds.push(audio);
    audio.addEventListener('ended', () => {
      this.activeAssetSounds = this.activeAssetSounds.filter(item => item !== audio);
    }, { once: true });
    const playback = audio.play();
    if (playback && playback.catch) {
      playback.catch(() => {
        this.activeAssetSounds = this.activeAssetSounds.filter(item => item !== audio);
        fallback.call(this);
      });
    }
  },

  playNoiseBurst(duration, filterType, startFreq, endFreq, peak, delay = 0) {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime + delay;
      const samples = Math.ceil(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, samples, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < samples; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(startFreq, now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      source.start(now);
      source.stop(now + duration);
    } catch (e) {}
  },

  playLightning() {
    this.playPantherRush();
  },

  playPantherRush() {
    // Corte de vento cortante
    this.playNoiseBurst(0.35, 'bandpass', 5800, 340, 0.42);
    // Rugido abafado e ressonante de arranque felino
    this.playNoiseBurst(0.55, 'lowpass', 650, 48, 0.38, 0.05);
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(58, now + 0.45);
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {}
  },

  playBeeDribble() {
    // Zumbido acrobático e estalido leve de elevação (Sombrero Flick)
    this.playNoiseBurst(0.22, 'bandpass', 3800, 1100, 0.28);
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // Sweep ascendente do chapéu
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(840, now + 0.28);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);

      // Zumbido rápido de asa de abelha
      const buzz = this.ctx.createOscillator();
      const buzzGain = this.ctx.createGain();
      buzz.type = 'sawtooth';
      buzz.frequency.setValueAtTime(240, now);
      buzz.frequency.setValueAtTime(260, now + 0.1);
      buzzGain.gain.setValueAtTime(0.12, now);
      buzzGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      buzz.connect(buzzGain);
      buzzGain.connect(this.masterGain || this.ctx.destination);
      buzz.start(now);
      buzz.stop(now + 0.32);
    } catch (e) {}
  },

  playPhantom() {
    this.playBeeDribble();
  },

  playCannonSynth() {
    this.playNoiseBurst(0.19, 'lowpass', 2200, 170, 0.42);
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(170, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.22);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {}
  },

  playCannon() {
    try {
      this.playAsset('cannon', this.playCannonSynth);
    } catch (e) {
      this.playCannonSynth();
    }
  },

  playWebSnap() {
    this.playNoiseBurst(0.16, 'highpass', 3200, 1400, 0.24);
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.exponentialRampToValueAtTime(190, now + 0.14);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.004, now + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.17);
    } catch (e) {}
  },

  playSnakeStrike() {
    this.playNoiseBurst(0.24, 'bandpass', 3600, 420, 0.32);
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(460, now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.16);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.19);
    } catch (e) {}
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

  playPass() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(460, now);
      osc.frequency.exponentialRampToValueAtTime(145, now + 0.065);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.065);
      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
      this.playNoiseBurst(0.032, 'bandpass', 2200, 900, 0.08);
    } catch (e) {}
  },

  playCurvedKick() {
    this.playAsset('curvedKick', this.playKick);
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
  },

  playCountdownTick(isGo = false) {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = isGo ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isGo ? 880 : 520, now);
      if (isGo) osc.frequency.exponentialRampToValueAtTime(1320, now + 0.18);
      gain.gain.setValueAtTime(isGo ? 0.18 : 0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.008, now + (isGo ? 0.24 : 0.14));
      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      osc.start(now);
      osc.stop(now + (isGo ? 0.24 : 0.14));
    } catch (e) {}
  }
};

Sound.volume = (profile.volume ?? 70) / 100;
Sound.muted = !!profile.muted;
