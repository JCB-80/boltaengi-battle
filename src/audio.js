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
    this.bgmAudio = null;
    this.bgmTrackKey = '';
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
   * Google Flow Music / Lyria 스튜디오 마스터링 9종 BGM 엔진
   * - 로비 + 8종 베이커리 맵별 고유 Earworm 트랙 1:1 매칭
   * - 1.2초 부드러운 크로스페이드(Crossfade) 전환
   * - 서든데스(마지막 30초 / 후반전) 템포 부스트(playbackRate 1.08)
   * - 전자 비프음 BGM 폴백 완전 폐기
   */
  startLobbyBgm() {
    this.setSuddenDeath(false);
    this.startBgm('lobby');
  }

  startBattleBgm(mapKey = null) {
    this.setSuddenDeath(false);
    this.startBgm('battle', mapKey);
  }

  stopLobbyBgm() {
    this.stopBgm();
  }

  stopBattleBgm() {
    this.stopBgm();
  }

  setSuddenDeath(active) {
    this.suddenDeath = Boolean(active);
    if (this.bgmAudio) {
      try {
        this.bgmAudio.playbackRate = this.suddenDeath ? 1.08 : 1.0;
      } catch {
        // ignore
      }
    }
  }

  playMove() {
    // Subtle soft tick for countdown/step
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  _fadeAudio(el, fromVol, toVol, durationMs = 1200, onDone = null) {
    if (!el) return;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      try {
        el.volume = Math.max(0, Math.min(1, fromVol + (toVol - fromVol) * t));
      } catch {
        return;
      }
      if (t < 1) {
        requestAnimationFrame(step);
      } else if (onDone) {
        onDone();
      }
    };
    requestAnimationFrame(step);
  }

  startBgm(mode = 'lobby', mapKey = this.currentMapKey) {
    this.bgmMode = mode;
    if (mapKey) this.currentMapKey = mapKey;
    if (this.muted || !this.bgmEnabled) return;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }

    const validMaps = new Set([
      'bridge', 'twin_peaks', 'archipelago', 'citadel',
      'matcha_cliff', 'honey_waffle', 'blueberry_tart', 'melon_soda',
    ]);
    const trackKey = mode === 'battle'
      ? (validMaps.has(this.currentMapKey) ? this.currentMapKey : 'bridge')
      : 'lobby';
    const mp3Url = `./assets/bgm/${trackKey}.mp3?v=lyria1`;
    const targetVol = mode === 'battle' ? 0.36 : 0.44;

    if (typeof Audio === 'undefined') return;
    try {
      if (this.bgmAudio && this.bgmTrackKey === trackKey && !this.bgmAudio.paused) {
        this._fadeAudio(this.bgmAudio, this.bgmAudio.volume, targetVol, 500);
        return;
      }
      const prevAudio = this.bgmAudio;
      if (prevAudio) {
        this._fadeAudio(prevAudio, prevAudio.volume, 0, 1200, () => {
          try {
            prevAudio.pause();
            prevAudio.currentTime = 0;
          } catch {}
        });
      }

      const el = new Audio(mp3Url);
      el.loop = true;
      el.volume = 0.001;
      el.playbackRate = this.suddenDeath ? 1.08 : 1.0;
      this.bgmAudio = el;
      this.bgmTrackKey = trackKey;
      const p = el.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          this._fadeAudio(el, 0.001, targetVol, 1200);
        }).catch(() => {
          // Will resume automatically on first user gesture
        });
      } else {
        this._fadeAudio(el, 0.001, targetVol, 1200);
      }
    } catch {
      // ignore audio element error
    }
  }

  stopBgm() {
    if (this.bgmAudio) {
      const dying = this.bgmAudio;
      this.bgmAudio = null;
      this.bgmTrackKey = '';
      this._fadeAudio(dying, dying.volume, 0, 450, () => {
        try { dying.pause(); } catch {}
      });
    }
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
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
