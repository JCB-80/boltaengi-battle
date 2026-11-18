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
      this.stopLobbyBgm();
    }
    return this.muted;
  }

  toggleBgm() {
    this.bgmEnabled = !this.bgmEnabled;
    if (!this.bgmEnabled) {
      this.stopLobbyBgm();
    } else {
      this.startLobbyBgm();
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
    if (this.muted || !this.bgmEnabled) return;
    if (this.bgmTimer) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (!this.bgmGain) {
      this.bgmGain = ctx.createGain();
      this.bgmGain.gain.setValueAtTime(0.45, ctx.currentTime);
      this.bgmGain.connect(ctx.destination);
    } else {
      this.bgmGain.gain.setTargetAtTime(0.45, ctx.currentTime, 0.04);
    }

    this.nextNoteTime = ctx.currentTime + 0.04;
    const stepDuration = 60 / 142 / 2; // 142 BPM 8분음표 (경쾌한 템포)

    // 32-step 신나는 C-G-Am-F 아케이드 팝 멜로디 (Hz)
    const melody = [
      523.25, 659.25, 783.99, 0,      880.0,  783.99, 659.25, 783.99, // C
      587.33, 739.99, 783.99, 0,      987.77, 880.0,  783.99, 587.33, // G
      659.25, 783.99, 880.0,  1046.5, 880.0,  783.99, 659.25, 523.25, // Am
      698.46, 880.0,  1046.5, 0,      987.77, 880.0,  783.99, 659.25, // F -> G
    ];
    const bass = [
      130.81, 261.63, 130.81, 261.63, 130.81, 261.63, 164.81, 196.0,  // C
      196.0,  392.0,  196.0,  392.0,  196.0,  392.0,  164.81, 146.83, // G
      220.0,  440.0,  220.0,  440.0,  220.0,  440.0,  196.0,  164.81, // Am
      174.61, 349.23, 174.61, 349.23, 196.0,  392.0,  246.94, 196.0,  // F -> G
    ];

    const scheduleStep = (stepIdx, t) => {
      if (!this.bgmGain || this.muted || !this.bgmEnabled) return;
      const mFreq = melody[stepIdx % melody.length];
      const bFreq = bass[stepIdx % bass.length];

      // 1) 통통 튀는 리드 신스
      if (mFreq > 0) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(mFreq, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.11, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 0.88);
        osc.connect(g);
        g.connect(this.bgmGain);
        osc.start(t);
        osc.stop(t + stepDuration * 0.92);
      }

      // 2) 바운스 베이스
      if (bFreq > 0) {
        const bOsc = ctx.createOscillator();
        const bGain = ctx.createGain();
        bOsc.type = 'sine';
        bOsc.frequency.setValueAtTime(bFreq, t);
        bGain.gain.setValueAtTime(0.09, t);
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
      while (this.nextNoteTime < this.ctx.currentTime + 0.14) {
        scheduleStep(this.bgmStep, this.nextNoteTime);
        this.nextNoteTime += stepDuration;
        this.bgmStep = (this.bgmStep + 1) % 32;
      }
    }, 35);
  }

  stopLobbyBgm() {
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
}
