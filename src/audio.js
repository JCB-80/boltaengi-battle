// 저작권 클린(Clean-IP) WebAudio 토이 사운드 신디사이저
// 외부 음원 없이 마림바·스프링·고무 풍선·장난감 폭발음을 실시간 합성합니다.

export class ToyAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmEnabled = true;
    this.bgmTimer = null;
    this.bgmGain = null;
    this.bgmStep = 0;
    this.nextNoteTime = 0;
  }

  ensureContext() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopBgm();
    } else if (this.bgmEnabled) {
      this.startBgm(this.bgmMode || 'lobby');
    }
    return this.muted;
  }

  toggleBgm() {
    this.bgmEnabled = !this.bgmEnabled;
    if (!this.bgmEnabled) {
      this.stopBgm();
    } else {
      this.startBgm(this.bgmMode || 'lobby');
    }
    return this.bgmEnabled;
  }

  playLaunch(powerRatio = 0.6, isHeavy = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isHeavy ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(isHeavy ? 140 : 190, now);
    osc.frequency.exponentialRampToValueAtTime(
      (isHeavy ? 520 : 420) + powerRatio * 280,
      now + (isHeavy ? 0.22 : 0.16)
    );

    gain.gain.setValueAtTime(isHeavy ? 0.24 : 0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isHeavy ? 0.26 : 0.2));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);

    // 발사 순간 묵직한 저음 펀치("퍽!") + 탄성 스냅 추가
    const punchOsc = ctx.createOscillator();
    const punchGain = ctx.createGain();
    punchOsc.type = 'sine';
    punchOsc.frequency.setValueAtTime(isHeavy ? 155 : 130 + powerRatio * 25, now);

    // 짧은 고무줄 튕김 스냅("뾱!")
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'square';
    snapOsc.frequency.setValueAtTime(620 + powerRatio * 240, now);
    snapOsc.frequency.exponentialRampToValueAtTime(180, now + 0.045);
    snapGain.gain.setValueAtTime(0.08 + powerRatio * 0.05, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    snapOsc.connect(snapGain);
    snapGain.connect(ctx.destination);
    snapOsc.start(now);
    snapOsc.stop(now + 0.055);
    punchOsc.frequency.exponentialRampToValueAtTime(36, now + 0.095);
    punchGain.gain.setValueAtTime(isHeavy ? 0.34 : 0.25, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.105);
    punchOsc.connect(punchGain);
    punchGain.connect(ctx.destination);
    punchOsc.start(now);
    punchOsc.stop(now + 0.11);
  }

  playSkillCharge() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.045);
      gain.gain.setValueAtTime(0.12, now + idx * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.19);
    });
  }

  playHeavyImpact() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // 대지진 저음 임팩트
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.55);
    subGain.gain.setValueAtTime(0.32, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.6);
  }

  playAirTrigger() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.035);
      gain.gain.setValueAtTime(0.14, now + idx * 0.035);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.035);
      osc.stop(now + idx * 0.035 + 0.15);
    });
  }

  playBounce() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.18);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playExplosion(radius = 45) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = Math.min(0.45, 0.22 + radius * 0.003);

    // 묵직한 장난감 북 저음
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(135, now);
    sub.frequency.exponentialRampToValueAtTime(36, now + duration);
    subGain.gain.setValueAtTime(0.26, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + duration);

    // 노이즈 버스트 (모래/블록 파쇄감)
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.8);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(920, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + duration);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.22, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
  }

  playBlockBreak() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.09);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playDropOut() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.55);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.56);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.58);
  }

  /**
   * 태풍이 다가올 때 들리는 은은하고 약한 바람 소리 (휴우우~ 밴드패스 노이즈)
   */
  playTornadoBreeze(duration = 1.8) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(2.6, now);
    filter.frequency.setValueAtTime(280, now);
    filter.frequency.linearRampToValueAtTime(520, now + duration * 0.45);
    filter.frequency.linearRampToValueAtTime(240, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.048, now + duration * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  /**
   * 로비 화면용 신나는 140 BPM 베이커리 팝 배경음 (Clean-IP 자체 신디사이저)
   */
  startLobbyBgm() {
    this.startBgm('lobby');
  }

  startBattleBgm(mapKey = null) {
    this.startBgm('battle', mapKey);
  }

  stopLobbyBgm() {
    this.stopBgm();
  }

  stopBattleBgm() {
    this.stopBgm();
  }

  startBgm(mode = 'lobby', mapKey = this.currentMapKey) {
    this.bgmMode = mode;
    if (mapKey) this.currentMapKey = mapKey;
    if (this.muted || !this.bgmEnabled) return;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;

    const targetGain = mode === 'battle' ? 0.32 : 0.45;
    if (!this.bgmGain) {
      this.bgmGain = ctx.createGain();
      this.bgmGain.gain.setValueAtTime(targetGain, ctx.currentTime);
      this.bgmGain.connect(ctx.destination);
    } else {
      this.bgmGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.04);
    }

    this.bgmStep = 0;
    this.battleTrackIdx = Math.floor(Math.random() * 3);
    this.nextNoteTime = ctx.currentTime + 0.04;

    const lobbyTrack = {
      bpm: 142,
      melody: [
        523.25, 659.25, 783.99, 0,      880.0,  783.99, 659.25, 783.99,
        587.33, 739.99, 783.99, 0,      987.77, 880.0,  783.99, 587.33,
        659.25, 783.99, 880.0,  1046.5, 880.0,  783.99, 659.25, 523.25,
        698.46, 880.0,  1046.5, 0,      987.77, 880.0,  783.99, 659.25,
      ],
      bass: [
        130.81, 261.63, 130.81, 261.63, 130.81, 261.63, 164.81, 196.0,
        196.0,  392.0,  196.0,  392.0,  196.0,  392.0,  164.81, 146.83,
        220.0,  440.0,  220.0,  440.0,  220.0,  440.0,  196.0,  164.81,
        174.61, 349.23, 174.61, 349.23, 196.0,  392.0,  246.94, 196.0,
      ],
      harm: [],
    };

    // 중독성 있는 3가지 인게임 아케이드 트랙 (루프마다 자동 교대 재생!)
    const battleTracks = [
      // Track 0: 달콤 슈가 대시 (144 BPM 펑키 훅)
      {
        bpm: 144,
        melody: [
          659.25, 783.99, 880.0,  0,      1046.5, 880.0,  783.99, 659.25,
          587.33, 659.25, 783.99, 0,      880.0,  783.99, 659.25, 587.33,
          523.25, 659.25, 783.99, 1046.5, 987.77, 880.0,  783.99, 659.25,
          698.46, 880.0,  1046.5, 1174.66,1046.5, 880.0,  783.99, 0,
          1046.5, 0,      880.0,  783.99, 659.25, 783.99, 880.0,  1046.5,
          987.77, 0,      783.99, 659.25, 587.33, 659.25, 783.99, 987.77,
          880.0,  1046.5, 1174.66,1046.5, 880.0,  783.99, 659.25, 523.25,
          587.33, 659.25, 783.99, 880.0,  783.99, 0,      659.25, 0,
        ],
        bass: [
          174.61, 349.23, 174.61, 349.23, 174.61, 349.23, 196.0,  174.61,
          196.0,  392.0,  196.0,  392.0,  196.0,  392.0,  246.94, 196.0,
          130.81, 261.63, 130.81, 261.63, 164.81, 329.63, 164.81, 196.0,
          220.0,  440.0,  220.0,  440.0,  196.0,  392.0,  164.81, 146.83,
          174.61, 349.23, 174.61, 349.23, 196.0,  392.0,  196.0,  392.0,
          164.81, 329.63, 164.81, 329.63, 220.0,  440.0,  220.0,  196.0,
          146.83, 293.66, 146.83, 293.66, 196.0,  392.0,  196.0,  392.0,
          130.81, 261.63, 164.81, 196.0,  261.63, 0,      196.0,  0,
        ],
        harm: [329.63, 0, 440.0, 0, 523.25, 0, 440.0, 0],
      },
      // Track 1: 말랑볼 팡팡 카니발 (148 BPM 통통 리듬)
      {
        bpm: 148,
        melody: [
          783.99, 783.99, 880.0,  987.77, 1174.66,0,      987.77, 880.0,
          783.99, 659.25, 587.33, 659.25, 783.99, 0,      659.25, 587.33,
          523.25, 587.33, 659.25, 783.99, 880.0,  783.99, 659.25, 523.25,
          587.33, 739.99, 880.0,  987.77, 880.0,  739.99, 587.33, 0,
          1174.66,987.77, 880.0,  783.99, 880.0,  987.77, 1174.66,0,
          1046.5, 987.77, 880.0,  783.99, 659.25, 783.99, 880.0,  0,
          698.46, 880.0,  1046.5, 880.0,  783.99, 659.25, 587.33, 659.25,
          783.99, 880.0,  987.77, 1174.66,1046.5, 0,      783.99, 0,
        ],
        bass: [
          196.0,  392.0,  246.94, 392.0,  196.0,  392.0,  293.66, 196.0,
          164.81, 329.63, 196.0,  329.63, 164.81, 329.63, 246.94, 164.81,
          130.81, 261.63, 164.81, 261.63, 130.81, 261.63, 196.0,  130.81,
          146.83, 293.66, 185.0,  293.66, 196.0,  392.0,  246.94, 196.0,
          196.0,  392.0,  246.94, 392.0,  196.0,  392.0,  293.66, 196.0,
          220.0,  440.0,  261.63, 440.0,  220.0,  440.0,  329.63, 220.0,
          174.61, 349.23, 220.0,  349.23, 196.0,  392.0,  246.94, 196.0,
          196.0,  293.66, 392.0,  293.66, 261.63, 0,      196.0,  0,
        ],
        harm: [392.0, 0, 493.88, 0, 587.33, 0, 493.88, 0],
      },
      // Track 2: 무지개 베이커리 러시 (140 BPM 애니 액션 그루브)
      {
        bpm: 140,
        melody: [
          440.0,  523.25, 659.25, 880.0,  783.99, 659.25, 587.33, 523.25,
          440.0,  523.25, 659.25, 0,      783.99, 880.0,  987.77, 880.0,
          698.46, 880.0,  1046.5, 0,      987.77, 880.0,  783.99, 659.25,
          587.33, 659.25, 783.99, 880.0,  783.99, 659.25, 587.33, 0,
          880.0,  1046.5, 1174.66,1318.51,1174.66,1046.5, 880.0,  783.99,
          698.46, 880.0,  1046.5, 880.0,  783.99, 659.25, 587.33, 659.25,
          523.25, 659.25, 783.99, 1046.5, 987.77, 783.99, 659.25, 587.33,
          440.0,  523.25, 659.25, 783.99, 880.0,  0,      659.25, 0,
        ],
        bass: [
          110.0,  220.0,  110.0,  220.0,  110.0,  220.0,  130.81, 164.81,
          110.0,  220.0,  110.0,  220.0,  164.81, 329.63, 196.0,  164.81,
          174.61, 349.23, 174.61, 349.23, 196.0,  392.0,  196.0,  164.81,
          146.83, 293.66, 146.83, 293.66, 196.0,  392.0,  164.81, 146.83,
          220.0,  440.0,  220.0,  440.0,  196.0,  392.0,  196.0,  392.0,
          174.61, 349.23, 174.61, 349.23, 164.81, 329.63, 164.81, 146.83,
          130.81, 261.63, 130.81, 261.63, 196.0,  392.0,  196.0,  164.81,
          110.0,  220.0,  130.81, 164.81, 220.0,  0,      164.81, 0,
        ],
        harm: [261.63, 0, 329.63, 0, 440.0, 0, 329.63, 0],
      },
    ];

    // 8종 맵별 고유 중독성 멜로디 · 베이스 · 아르페지오 · 음색 트랙
    const mapTracks = {
      // 1) bridge: Sunny Pop Arcade Hook (C Major, 146 BPM)
      bridge: {
        bpm: 146,
        wave: 'square',
        melody: [
          659.25, 0, 783.99, 880.0, 1046.5, 0, 880.0, 783.99,
          659.25, 783.99, 880.0, 1046.5, 1174.66, 0, 1046.5, 880.0,
          783.99, 0, 659.25, 587.33, 523.25, 587.33, 659.25, 783.99,
          880.0, 987.77, 1046.5, 880.0, 783.99, 0, 659.25, 0,
          1046.5, 1046.5, 1174.66, 1318.51, 1174.66, 1046.5, 880.0, 783.99,
          880.0, 0, 1046.5, 880.0, 783.99, 659.25, 587.33, 523.25,
          698.46, 880.0, 1046.5, 1174.66, 1046.5, 880.0, 783.99, 659.25,
          587.33, 659.25, 783.99, 987.77, 1046.5, 0, 783.99, 0,
        ],
        bass: [
          130.81, 261.63, 130.81, 261.63, 196.0, 392.0, 196.0, 164.81,
          220.0, 440.0, 220.0, 440.0, 174.61, 349.23, 196.0, 174.61,
          164.81, 329.63, 164.81, 329.63, 146.83, 293.66, 196.0, 146.83,
          130.81, 261.63, 164.81, 196.0, 261.63, 196.0, 130.81, 0,
        ],
        harm: [329.63, 523.25, 392.0, 659.25, 349.23, 523.25, 392.0, 587.33],
      },
      // 2) twin_peaks: Crystal Bell Winter Waltz/Pop (D Major, 138 BPM)
      twin_peaks: {
        bpm: 138,
        wave: 'triangle',
        melody: [
          1174.66, 0, 987.77, 880.0, 739.99, 880.0, 987.77, 0,
          1174.66, 1318.51, 1479.98, 0, 1318.51, 1174.66, 987.77, 880.0,
          783.99, 987.77, 1174.66, 0, 987.77, 880.0, 739.99, 659.25,
          587.33, 739.99, 880.0, 1174.66, 987.77, 0, 880.0, 0,
          1479.98, 0, 1318.51, 1174.66, 987.77, 1174.66, 1318.51, 0,
          1174.66, 987.77, 880.0, 739.99, 659.25, 739.99, 880.0, 987.77,
          783.99, 987.77, 1174.66, 1318.51, 1174.66, 987.77, 880.0, 739.99,
          659.25, 783.99, 880.0, 1108.73, 1174.66, 0, 880.0, 0,
        ],
        bass: [
          146.83, 293.66, 220.0, 293.66, 185.0, 369.99, 220.0, 185.0,
          196.0, 392.0, 246.94, 392.0, 146.83, 293.66, 220.0, 146.83,
          164.81, 329.63, 246.94, 329.63, 220.0, 440.0, 277.18, 220.0,
          196.0, 392.0, 220.0, 440.0, 146.83, 293.66, 146.83, 0,
        ],
        harm: [587.33, 739.99, 880.0, 739.99, 493.88, 659.25, 783.99, 659.25],
      },
      // 3) archipelago: Bouncy Candy Carnival (G Major, 152 BPM)
      archipelago: {
        bpm: 152,
        wave: 'square',
        melody: [
          783.99, 987.77, 1174.66, 0, 1318.51, 1174.66, 987.77, 783.99,
          880.0, 1046.5, 1174.66, 987.77, 880.0, 739.99, 659.25, 587.33,
          783.99, 880.0, 987.77, 1174.66, 1318.51, 1479.98, 1318.51, 1174.66,
          1046.5, 987.77, 880.0, 783.99, 739.99, 0, 587.33, 0,
          1567.98, 0, 1318.51, 1174.66, 987.77, 1046.5, 1174.66, 0,
          1318.51, 1174.66, 1046.5, 987.77, 880.0, 987.77, 1046.5, 0,
          783.99, 987.77, 1174.66, 1318.51, 1174.66, 987.77, 880.0, 739.99,
          783.99, 987.77, 1174.66, 1479.98, 1567.98, 0, 1174.66, 0,
        ],
        bass: [
          196.0, 392.0, 246.94, 392.0, 164.81, 329.63, 246.94, 196.0,
          130.81, 261.63, 196.0, 261.63, 146.83, 293.66, 220.0, 146.83,
          196.0, 392.0, 246.94, 392.0, 220.0, 440.0, 261.63, 220.0,
          174.61, 349.23, 196.0, 392.0, 196.0, 293.66, 196.0, 0,
        ],
        harm: [392.0, 493.88, 587.33, 493.88, 523.25, 659.25, 587.33, 493.88],
      },
      // 4) citadel: Boss Volcano Electro-Rock (E Minor, 156 BPM)
      citadel: {
        bpm: 156,
        wave: 'sawtooth',
        melody: [
          659.25, 0, 659.25, 783.99, 987.77, 0, 880.0, 783.99,
          659.25, 783.99, 880.0, 987.77, 1046.5, 987.77, 880.0, 783.99,
          587.33, 0, 587.33, 739.99, 880.0, 0, 783.99, 739.99,
          659.25, 587.33, 493.88, 587.33, 659.25, 0, 493.88, 0,
          1318.51, 0, 1174.66, 987.77, 1046.5, 987.77, 880.0, 783.99,
          987.77, 0, 880.0, 783.99, 739.99, 783.99, 880.0, 987.77,
          659.25, 783.99, 987.77, 1318.51, 1174.66, 987.77, 880.0, 739.99,
          659.25, 783.99, 987.77, 1174.66, 1318.51, 0, 987.77, 0,
        ],
        bass: [
          164.81, 164.81, 329.63, 164.81, 164.81, 164.81, 246.94, 196.0,
          130.81, 130.81, 261.63, 130.81, 146.83, 146.83, 293.66, 146.83,
          164.81, 164.81, 329.63, 164.81, 196.0, 196.0, 392.0, 196.0,
          123.47, 123.47, 246.94, 146.83, 164.81, 246.94, 164.81, 0,
        ],
        harm: [329.63, 392.0, 493.88, 392.0, 293.66, 369.99, 440.0, 369.99],
      },
      // 5) matcha_cliff: Breezy Pentatonic Tea Garden (D Pentatonic, 136 BPM)
      matcha_cliff: {
        bpm: 136,
        wave: 'triangle',
        melody: [
          587.33, 659.25, 880.0, 0, 987.77, 880.0, 659.25, 587.33,
          659.25, 880.0, 1174.66, 0, 987.77, 880.0, 659.25, 0,
          880.0, 987.77, 1174.66, 1318.51, 1174.66, 987.77, 880.0, 659.25,
          587.33, 659.25, 880.0, 987.77, 880.0, 0, 659.25, 0,
          1174.66, 0, 1318.51, 1174.66, 987.77, 880.0, 987.77, 1174.66,
          880.0, 0, 659.25, 587.33, 659.25, 880.0, 987.77, 0,
          1174.66, 987.77, 880.0, 659.25, 587.33, 659.25, 880.0, 1174.66,
          987.77, 880.0, 659.25, 587.33, 587.33, 0, 880.0, 0,
        ],
        bass: [
          146.83, 293.66, 220.0, 293.66, 196.0, 392.0, 220.0, 196.0,
          164.81, 329.63, 220.0, 329.63, 146.83, 293.66, 220.0, 146.83,
          196.0, 392.0, 293.66, 392.0, 220.0, 440.0, 293.66, 220.0,
          146.83, 220.0, 293.66, 220.0, 146.83, 293.66, 146.83, 0,
        ],
        harm: [440.0, 587.33, 659.25, 587.33, 493.88, 659.25, 880.0, 659.25],
      },
      // 6) honey_waffle: Funky Cafe Groove (F Major7, 146 BPM)
      honey_waffle: {
        bpm: 146,
        wave: 'square',
        melody: [
          698.46, 0, 880.0, 1046.5, 0, 1318.51, 1174.66, 1046.5,
          880.0, 1046.5, 1174.66, 0, 1046.5, 880.0, 783.99, 698.46,
          783.99, 880.0, 1046.5, 1174.66, 1396.91, 0, 1318.51, 1046.5,
          880.0, 783.99, 698.46, 783.99, 880.0, 0, 698.46, 0,
          1396.91, 1318.51, 1174.66, 1046.5, 1174.66, 1318.51, 1396.91, 0,
          1174.66, 1046.5, 880.0, 783.99, 698.46, 783.99, 880.0, 1046.5,
          783.99, 880.0, 1046.5, 1318.51, 1174.66, 1046.5, 880.0, 783.99,
          698.46, 880.0, 1046.5, 1318.51, 1396.91, 0, 1046.5, 0,
        ],
        bass: [
          174.61, 349.23, 220.0, 261.63, 196.0, 392.0, 261.63, 196.0,
          164.81, 329.63, 220.0, 329.63, 146.83, 293.66, 220.0, 146.83,
          116.54, 233.08, 174.61, 233.08, 130.81, 261.63, 196.0, 130.81,
          174.61, 220.0, 261.63, 196.0, 174.61, 349.23, 174.61, 0,
        ],
        harm: [440.0, 523.25, 659.25, 523.25, 392.0, 523.25, 587.33, 523.25],
      },
      // 7) blueberry_tart: Dreamy Anime Synthwave (A Minor -> C Major, 140 BPM)
      blueberry_tart: {
        bpm: 140,
        wave: 'triangle',
        melody: [
          880.0, 0, 1046.5, 1174.66, 1318.51, 0, 1174.66, 1046.5,
          987.77, 1046.5, 1174.66, 0, 880.0, 783.99, 659.25, 587.33,
          698.46, 880.0, 1046.5, 1318.51, 1174.66, 1046.5, 987.77, 880.0,
          783.99, 880.0, 987.77, 1174.66, 1046.5, 0, 880.0, 0,
          1318.51, 1396.91, 1567.98, 0, 1318.51, 1174.66, 1046.5, 880.0,
          1046.5, 1174.66, 1318.51, 1174.66, 1046.5, 987.77, 880.0, 783.99,
          698.46, 880.0, 1046.5, 1318.51, 1567.98, 1318.51, 1174.66, 1046.5,
          880.0, 987.77, 1046.5, 1318.51, 1760.0, 0, 1318.51, 0,
        ],
        bass: [
          110.0, 220.0, 110.0, 220.0, 164.81, 329.63, 196.0, 164.81,
          174.61, 349.23, 174.61, 349.23, 196.0, 392.0, 246.94, 196.0,
          130.81, 261.63, 130.81, 261.63, 196.0, 392.0, 164.81, 146.83,
          174.61, 349.23, 196.0, 392.0, 220.0, 440.0, 220.0, 0,
        ],
        harm: [523.25, 659.25, 880.0, 659.25, 440.0, 523.25, 659.25, 523.25],
      },
      // 8) melon_soda: Fizzy Tropical Chiptune Pop (Bb Major, 154 BPM)
      melon_soda: {
        bpm: 154,
        wave: 'square',
        melody: [
          932.33, 1174.66, 1396.91, 0, 1567.98, 1396.91, 1174.66, 932.33,
          1046.5, 1174.66, 1396.91, 1567.98, 1396.91, 1174.66, 1046.5, 932.33,
          783.99, 932.33, 1046.5, 1174.66, 1396.91, 0, 1174.66, 1046.5,
          932.33, 783.99, 698.46, 783.99, 932.33, 0, 698.46, 0,
          1567.98, 1396.91, 1174.66, 1396.91, 1567.98, 1864.66, 1567.98, 1396.91,
          1174.66, 1046.5, 932.33, 1046.5, 1174.66, 1396.91, 1567.98, 0,
          1046.5, 1174.66, 1396.91, 1567.98, 1396.91, 1174.66, 1046.5, 932.33,
          932.33, 1174.66, 1396.91, 1567.98, 1864.66, 0, 1396.91, 0,
        ],
        bass: [
          116.54, 233.08, 174.61, 233.08, 130.81, 261.63, 196.0, 130.81,
          146.83, 293.66, 220.0, 293.66, 155.56, 311.13, 233.08, 155.56,
          174.61, 349.23, 261.63, 349.23, 196.0, 392.0, 293.66, 196.0,
          155.56, 311.13, 174.61, 349.23, 116.54, 233.08, 116.54, 0,
        ],
        harm: [466.16, 587.33, 698.46, 587.33, 523.25, 698.46, 783.99, 698.46],
      },
    };
    const activeMapTrack = mode === 'battle' ? mapTracks[this.currentMapKey] || null : null;

    const getTrack = () => {
      if (mode !== 'battle') return lobbyTrack;
      return activeMapTrack || battleTracks[this.battleTrackIdx];
    };

    const scheduleStep = (stepIdx, t) => {
      if (!this.bgmGain || this.muted || !this.bgmEnabled) return;
      const tr = getTrack();
      const stepDuration = 60 / tr.bpm / 2;
      const mFreq = tr.melody[stepIdx % tr.melody.length];
      const bFreq = tr.bass[stepIdx % tr.bass.length];
      const hFreq = tr.harm.length ? tr.harm[stepIdx % tr.harm.length] : 0;

      // 1) 듀얼 디튠 리드 신스 (더 풍성하고 선명한 멜로디)
      if (mFreq > 0) {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const g = ctx.createGain();
        const waveType = mode === 'battle' ? (tr.wave || 'square') : 'triangle';
        osc1.type = waveType;
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(mFreq, t);
        osc2.frequency.setValueAtTime(mFreq * 1.004, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(mode === 'battle' ? 0.068 : 0.105, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 0.88);
        osc1.connect(g);
        osc2.connect(g);
        g.connect(this.bgmGain);
        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + stepDuration * 0.92);
        osc2.stop(t + stepDuration * 0.92);
      }

      // 1.5) 반짝이는 화음 아르페지오 레이어
      if (hFreq > 0) {
        const aOsc = ctx.createOscillator();
        const aGain = ctx.createGain();
        aOsc.type = 'triangle';
        aOsc.frequency.setValueAtTime(hFreq, t);
        aGain.gain.setValueAtTime(0.045, t);
        aGain.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 0.75);
        aOsc.connect(aGain);
        aGain.connect(this.bgmGain);
        aOsc.start(t);
        aOsc.stop(t + stepDuration * 0.8);
      }

      // 2) 바운스 베이스
      if (bFreq > 0) {
        const bOsc = ctx.createOscillator();
        const bGain = ctx.createGain();
        bOsc.type = 'sine';
        bOsc.frequency.setValueAtTime(bFreq, t);
        bGain.gain.setValueAtTime(0.095, t);
        bGain.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 0.85);
        bOsc.connect(bGain);
        bGain.connect(this.bgmGain);
        bOsc.start(t);
        bOsc.stop(t + stepDuration * 0.9);
      }

      // 3) 4분음표 킥 + 엇박 하이햇
      if (stepIdx % 2 === 0) {
        const kOsc = ctx.createOscillator();
        const kGain = ctx.createGain();
        kOsc.type = 'sine';
        kOsc.frequency.setValueAtTime(125, t);
        kOsc.frequency.exponentialRampToValueAtTime(42, t + 0.08);
        kGain.gain.setValueAtTime(0.11, t);
        kGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        kOsc.connect(kGain);
        kGain.connect(this.bgmGain);
        kOsc.start(t);
        kOsc.stop(t + 0.1);
      } else {
        const hOsc = ctx.createOscillator();
        const hGain = ctx.createGain();
        hOsc.type = 'square';
        hOsc.frequency.setValueAtTime(4200, t);
        hGain.gain.setValueAtTime(0.014, t);
        hGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        hOsc.connect(hGain);
        hGain.connect(this.bgmGain);
        hOsc.start(t);
        hOsc.stop(t + 0.035);
      }
    };

    this.bgmTimer = setInterval(() => {
      if (!this.ctx || this.muted || !this.bgmEnabled) return;
      if (this.ctx.state === 'suspended') return;
      const tr = getTrack();
      const stepDuration = 60 / tr.bpm / 2;
      const loopLen = tr.melody.length;
      while (this.nextNoteTime < this.ctx.currentTime + 0.14) {
        scheduleStep(this.bgmStep, this.nextNoteTime);
        this.nextNoteTime += stepDuration;
        this.bgmStep = (this.bgmStep + 1) % loopLen;
        if (this.bgmStep === 0 && mode === 'battle' && !activeMapTrack) {
          this.battleTrackIdx = (this.battleTrackIdx + 1) % battleTracks.length;
        }
      }
    }, 35);
  }

  stopBgm() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03);
    }
  }

  /**
   * 볼 꼬집고 당길 때 나는 귀여운 말랑 뽀잉·까르르 사운드
   */
  playCuteSqueak(isRelease = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = isRelease ? [660, 880, 1046.5] : [587.33, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.24, t + 0.07);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.14);
    });
  }

  /**
   * 정통 직격 명중 시 터지는 박수갈채(짝짝짝!) + 환호 차임 사운드
   */
  playApplause() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1) 여러 명이 번갈아 치는 듯한 14연타 박수 노이즈 버스트
    const bufLen = Math.floor(ctx.sampleRate * 0.085);
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      const env = Math.pow(1 - i / bufLen, 2.4);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const clapTimes = [0.02, 0.09, 0.15, 0.22, 0.28, 0.36, 0.43, 0.51, 0.59, 0.68, 0.77, 0.87, 0.98, 1.1];
    clapTimes.forEach((offset, idx) => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1050 + (idx % 4) * 240, now + offset);
      filter.Q.setValueAtTime(1.4, now + offset);

      const gain = ctx.createGain();
      const fade = idx > 9 ? 0.55 : 1.0;
      gain.gain.setValueAtTime(0.24 * fade, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.085);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(now + offset);
    });

    // 2) 경쾌한 "나이스 샷!" 축하 화음
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + 0.04 + i * 0.05;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }
}
