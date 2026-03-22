window.App = window.App || {};

App.Audio = {
  ctx: null,
  masterGain: null,
  compressor: null,
  reverbGain: null,
  dryGain: null,
  convolver: null,
  activeVoices: 0,
  maxVoices: 128,
  spatialMode: 'off',  // 'off', 'stereo', 'hrtf'
  stereoWidth: 0,
  panAmount: 1.0,
  itdAmount: 0,
  maxItd: 0.0006,
  hrtfSpread: 3,       // how far apart sounds are placed in 3D space (meters)
  hrtfDepth: 2,        // front-back depth mapping

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -12;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 4;
    this.compressor.connect(this.ctx.destination);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.compressor);

    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 0.7;
    this.dryGain.connect(this.masterGain);

    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.3;
    this.reverbGain.connect(this.masterGain);

    this.convolver = this.ctx.createConvolver();
    this.convolver.buffer = this._createReverbIR(2.5, 2.0);
    this.convolver.connect(this.reverbGain);
  },

  ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  setVolume(v) {
    if (this.masterGain) this.masterGain.gain.value = v;
  },

  setReverb(v) {
    if (this.reverbGain) this.reverbGain.gain.value = v;
    if (this.dryGain) this.dryGain.gain.value = 1.0 - v * 0.5;
  },

  _createReverbIR(duration, decay) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const length = rate * duration;
    const buffer = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  },

  setStereoWidth(v) {
    this.stereoWidth = v;
  },

  _trackVoice(osc, duration) {
    this.activeVoices++;
    let released = false;
    const release = () => {
      if (!released) { released = true; this.activeVoices = Math.max(0, this.activeVoices - 1); }
    };
    osc.onended = release;
    // Safety: release voice even if onended doesn't fire
    setTimeout(release, (duration + 0.5) * 1000);
  },

  _createPannedOutput(pan, normDist) {
    pan = Math.max(-1, Math.min(1, pan || 0));
    normDist = normDist || 0.5;
    const ctx = this.ctx;

    if (this.spatialMode === 'hrtf') {
      return this._createHrtfOutput(pan, normDist);
    }

    if (this.spatialMode === 'stereo') {
      return this._createStereoOutput(pan);
    }

    // Off — mono center
    const gain = ctx.createGain();
    gain.connect(this.dryGain);
    gain.connect(this.convolver);
    return gain;
  },

  _createStereoOutput(pan) {
    const ctx = this.ctx;
    const absPan = Math.abs(pan);
    const usePan = this.panAmount > 0.01 && absPan > 0.01;
    const useItd = this.itdAmount > 0.01 && absPan > 0.01;

    if (!usePan && !useItd) {
      const gain = ctx.createGain();
      gain.connect(this.dryGain);
      gain.connect(this.convolver);
      return gain;
    }

    const panner = ctx.createStereoPanner();
    panner.pan.value = pan * this.panAmount;

    if (!useItd) {
      panner.connect(this.dryGain);
      panner.connect(this.convolver);
      return panner;
    }

    const delay = absPan * this.maxItd * this.itdAmount;
    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    const delayLeft = ctx.createDelay(0.05);
    const delayRight = ctx.createDelay(0.05);

    if (pan > 0) {
      delayLeft.delayTime.value = delay;
      delayRight.delayTime.value = 0;
    } else {
      delayLeft.delayTime.value = 0;
      delayRight.delayTime.value = delay;
    }

    panner.connect(splitter);
    splitter.connect(delayLeft, 0);
    splitter.connect(delayRight, 1);
    delayLeft.connect(merger, 0, 0);
    delayRight.connect(merger, 0, 1);

    merger.connect(this.dryGain);
    merger.connect(this.convolver);
    return panner;
  },

  _createHrtfOutput(pan, normDist) {
    const ctx = this.ctx;
    // HRTF PannerNode — browser handles binaural rendering
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 20;
    panner.rolloffFactor = 1;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;

    // Map ball position to 3D space around the listener
    // pan (-1 to 1) → x position (left/right)
    // normDist (0 to 1) → z position (front/back) + y (height)
    const spread = this.hrtfSpread;
    const depth = this.hrtfDepth;

    const x = pan * spread;
    // Closer balls in front, farther balls behind and slightly above
    const z = -(1 - normDist) * depth + normDist * depth * 0.5;
    const y = normDist * spread * 0.3;

    panner.positionX.value = x;
    panner.positionY.value = y;
    panner.positionZ.value = z;

    panner.connect(this.dryGain);
    panner.connect(this.convolver);
    return panner;
  },

  playNote(frequency, instrument, velocity, pan, normDist) {
    if (!this.ctx || this.activeVoices >= this.maxVoices) return;
    velocity = Math.min(1, Math.max(0.1, velocity || 0.7));
    // For stereo mode, scale pan by stereoWidth
    if (this.spatialMode === 'stereo') {
      pan = (pan || 0) * this.stereoWidth;
    }

    const preset = this.presets[instrument] || this.presets.hangDrum;
    preset.call(this, frequency, velocity, pan, normDist);
  },

  presets: {
    hangDrum(freq, vel, pan, normDist) {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const dur = 3.0;

      const output = ctx.createGain();
      output.gain.setValueAtTime(0, now);
      output.gain.linearRampToValueAtTime(vel * 0.35, now + 0.005);
      output.gain.exponentialRampToValueAtTime(vel * 0.2, now + 0.08);
      output.gain.exponentialRampToValueAtTime(0.001, now + dur);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq * 1.5;
      filter.Q.value = 1.5;
      filter.connect(output);

      // Fundamental with pitch bend
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq * 1.005, now);
      osc1.frequency.exponentialRampToValueAtTime(freq, now + 0.04);
      osc1.connect(filter);

      // Detuned for warmth
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 0.995;
      osc2.connect(filter);

      // Octave harmonic
      const osc3 = ctx.createOscillator();
      osc3.type = 'sine';
      osc3.frequency.value = freq * 2;
      const g3 = ctx.createGain();
      g3.gain.value = 0.25;
      osc3.connect(g3);
      g3.connect(filter);

      // Fifth harmonic
      const osc4 = ctx.createOscillator();
      osc4.type = 'sine';
      osc4.frequency.value = freq * 3;
      const g4 = ctx.createGain();
      g4.gain.value = 0.06;
      osc4.connect(g4);
      g4.connect(filter);

      output.connect(this._createPannedOutput(pan, normDist));

      const oscs = [osc1, osc2, osc3, osc4];
      this._trackVoice(osc1, dur);
      oscs.forEach(o => { o.start(now); o.stop(now + dur); });
    },

    marimba(freq, vel, pan, normDist) {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const dur = 1.2;

      const output = ctx.createGain();
      output.gain.setValueAtTime(0, now);
      output.gain.linearRampToValueAtTime(vel * 0.4, now + 0.003);
      output.gain.exponentialRampToValueAtTime(0.001, now + dur);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3000, now);
      filter.frequency.exponentialRampToValueAtTime(500, now + 0.2);
      filter.Q.value = 1;
      filter.connect(output);

      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = freq;
      osc1.connect(filter);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 4;
      const g2 = ctx.createGain();
      g2.gain.value = 0.15;
      osc2.connect(g2);
      g2.connect(filter);

      output.connect(this._createPannedOutput(pan, normDist));

      this._trackVoice(osc1, dur);
      [osc1, osc2].forEach(o => { o.start(now); o.stop(now + dur); });
    },

    bell(freq, vel, pan, normDist) {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const dur = 5.0;

      const output = ctx.createGain();
      output.gain.setValueAtTime(0, now);
      output.gain.linearRampToValueAtTime(vel * 0.3, now + 0.002);
      output.gain.exponentialRampToValueAtTime(0.001, now + dur);

      const ratios = [1, 2.76, 5.4, 8.93];
      const gains = [1, 0.5, 0.25, 0.1];
      const decays = [dur, dur * 0.7, dur * 0.4, dur * 0.25];

      const oscs = ratios.map((ratio, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq * ratio;

        const g = ctx.createGain();
        g.gain.setValueAtTime(gains[i], now);
        g.gain.exponentialRampToValueAtTime(0.001, now + decays[i]);
        osc.connect(g);
        g.connect(output);
        return osc;
      });

      output.connect(this._createPannedOutput(pan, normDist));

      this._trackVoice(oscs[0], dur);
      oscs.forEach(o => { o.start(now); o.stop(now + dur); });
    },

    kalimba(freq, vel, pan, normDist) {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const dur = 0.8;

      const output = ctx.createGain();
      output.gain.setValueAtTime(0, now);
      output.gain.linearRampToValueAtTime(vel * 0.45, now + 0.001);
      output.gain.exponentialRampToValueAtTime(0.001, now + dur);

      // Pluck transient — short noise burst
      const noiseLen = ctx.sampleRate * 0.012;
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const noiseData = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen);
      }
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      const noiseFilt = ctx.createBiquadFilter();
      noiseFilt.type = 'bandpass';
      noiseFilt.frequency.value = freq;
      noiseFilt.Q.value = 5;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = vel * 0.6;
      noiseSrc.connect(noiseFilt);
      noiseFilt.connect(noiseGain);
      noiseGain.connect(output);
      noiseSrc.start(now);
      noiseSrc.stop(now + 0.015);

      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = freq;
      osc1.connect(output);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 3;
      const g2 = ctx.createGain();
      g2.gain.value = 0.08;
      osc2.connect(g2);
      g2.connect(output);

      output.connect(this._createPannedOutput(pan, normDist));

      this._trackVoice(osc1, dur);
      [osc1, osc2].forEach(o => { o.start(now); o.stop(now + dur); });
    },

    steelDrum(freq, vel, pan, normDist) {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const dur = 1.8;

      const output = ctx.createGain();
      output.gain.setValueAtTime(0, now);
      output.gain.linearRampToValueAtTime(vel * 0.4, now + 0.003);
      output.gain.exponentialRampToValueAtTime(vel * 0.15, now + 0.1);
      output.gain.exponentialRampToValueAtTime(0.001, now + dur);

      // Bright metallic tone — sine + triangle harmonics
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = freq;
      osc1.connect(output);

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = freq * 2;
      const g2 = ctx.createGain();
      g2.gain.value = 0.35;
      osc2.connect(g2);
      g2.connect(output);

      const osc3 = ctx.createOscillator();
      osc3.type = 'sine';
      osc3.frequency.value = freq * 3.01;
      const g3 = ctx.createGain();
      g3.gain.value = 0.15;
      osc3.connect(g3);
      g3.connect(output);

      // Slight pitch wobble for steel resonance
      const osc4 = ctx.createOscillator();
      osc4.type = 'sine';
      osc4.frequency.value = freq * 4.02;
      const g4 = ctx.createGain();
      g4.gain.setValueAtTime(0.12, now);
      g4.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.5);
      osc4.connect(g4);
      g4.connect(output);

      output.connect(this._createPannedOutput(pan, normDist));

      this._trackVoice(osc1, dur);
      [osc1, osc2, osc3, osc4].forEach(o => { o.start(now); o.stop(now + dur); });
    },

    glockenspiel(freq, vel, pan, normDist) {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const dur = 4.0;

      const output = ctx.createGain();
      output.gain.setValueAtTime(0, now);
      output.gain.linearRampToValueAtTime(vel * 0.25, now + 0.001);
      output.gain.exponentialRampToValueAtTime(0.001, now + dur);

      // High, pure, crystalline — sine partials with slight inharmonicity
      const ratios = [1, 2.0, 3.98, 5.95];
      const gains = [1, 0.6, 0.3, 0.12];

      const oscs = ratios.map((ratio, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq * ratio;
        const g = ctx.createGain();
        g.gain.setValueAtTime(gains[i], now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur * (1 - i * 0.2));
        osc.connect(g);
        g.connect(output);
        return osc;
      });

      // Highpass for sparkle
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = freq * 0.8;
      hp.Q.value = 0.5;
      output.connect(hp);
      hp.connect(this._createPannedOutput(pan, normDist));

      this._trackVoice(oscs[0], dur);
      oscs.forEach(o => { o.start(now); o.stop(now + dur); });
    },

    xylophone(freq, vel, pan, normDist) {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const dur = 0.6;

      const output = ctx.createGain();
      output.gain.setValueAtTime(0, now);
      output.gain.linearRampToValueAtTime(vel * 0.45, now + 0.002);
      output.gain.exponentialRampToValueAtTime(0.001, now + dur);

      // Dry, woody — sine + strong 3x partial, fast decay
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = freq;
      osc1.connect(output);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 3;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.3, now);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc2.connect(g2);
      g2.connect(output);

      // Click transient
      const osc3 = ctx.createOscillator();
      osc3.type = 'square';
      osc3.frequency.value = freq * 6;
      const g3 = ctx.createGain();
      g3.gain.setValueAtTime(0.08, now);
      g3.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
      osc3.connect(g3);
      g3.connect(output);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 8, now);
      filter.frequency.exponentialRampToValueAtTime(freq * 2, now + 0.1);
      output.connect(filter);
      filter.connect(this._createPannedOutput(pan, normDist));

      this._trackVoice(osc1, dur);
      [osc1, osc2, osc3].forEach(o => { o.start(now); o.stop(now + dur); });
    },

    vibraphone(freq, vel, pan, normDist) {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const dur = 4.0;

      const output = ctx.createGain();
      output.gain.setValueAtTime(0, now);
      output.gain.linearRampToValueAtTime(vel * 0.3, now + 0.005);
      output.gain.exponentialRampToValueAtTime(0.001, now + dur);

      // Warm, tremolo — sine fundamentals with LFO amplitude modulation
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = freq;

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 2;
      const g2 = ctx.createGain();
      g2.gain.value = 0.25;
      osc2.connect(g2);

      const osc3 = ctx.createOscillator();
      osc3.type = 'sine';
      osc3.frequency.value = freq * 4;
      const g3 = ctx.createGain();
      g3.gain.value = 0.08;
      osc3.connect(g3);

      // Tremolo LFO
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 5.5;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.15;
      lfo.connect(lfoGain);
      lfoGain.connect(output.gain);

      osc1.connect(output);
      g2.connect(output);
      g3.connect(output);

      output.connect(this._createPannedOutput(pan, normDist));

      this._trackVoice(osc1, dur);
      [osc1, osc2, osc3, lfo].forEach(o => { o.start(now); o.stop(now + dur); });
    },

    musicBox(freq, vel, pan, normDist) {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const dur = 2.0;

      const output = ctx.createGain();
      output.gain.setValueAtTime(0, now);
      output.gain.linearRampToValueAtTime(vel * 0.3, now + 0.001);
      output.gain.exponentialRampToValueAtTime(vel * 0.08, now + 0.15);
      output.gain.exponentialRampToValueAtTime(0.001, now + dur);

      // Thin, metallic pluck — high overtones, fast attack
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq * 1.002, now);
      osc1.frequency.exponentialRampToValueAtTime(freq, now + 0.02);
      osc1.connect(output);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 2;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.4, now);
      g2.gain.exponentialRampToValueAtTime(0.05, now + 0.3);
      osc2.connect(g2);
      g2.connect(output);

      const osc3 = ctx.createOscillator();
      osc3.type = 'sine';
      osc3.frequency.value = freq * 5.03;
      const g3 = ctx.createGain();
      g3.gain.setValueAtTime(0.15, now);
      g3.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc3.connect(g3);
      g3.connect(output);

      // Highpass for thinness
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = freq * 0.5;
      output.connect(hp);
      hp.connect(this._createPannedOutput(pan, normDist));

      this._trackVoice(osc1, dur);
      [osc1, osc2, osc3].forEach(o => { o.start(now); o.stop(now + dur); });
    },

    sitar(freq, vel, pan, normDist) {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const dur = 3.0;

      const output = ctx.createGain();
      output.gain.setValueAtTime(0, now);
      output.gain.linearRampToValueAtTime(vel * 0.35, now + 0.003);
      output.gain.exponentialRampToValueAtTime(vel * 0.12, now + 0.2);
      output.gain.exponentialRampToValueAtTime(0.001, now + dur);

      // Buzzy, nasal — sawtooth filtered + sympathetic resonance
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq * 1.008, now);
      osc1.frequency.exponentialRampToValueAtTime(freq, now + 0.08);

      // Sympathetic string (detuned)
      const osc2 = ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = freq * 1.01;
      const g2 = ctx.createGain();
      g2.gain.value = 0.3;
      osc2.connect(g2);

      // Buzz resonance
      const osc3 = ctx.createOscillator();
      osc3.type = 'sine';
      osc3.frequency.value = freq * 2.005;
      const g3 = ctx.createGain();
      g3.gain.value = 0.2;
      osc3.connect(g3);

      // Bandpass for nasal quality
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq * 2;
      bp.Q.value = 4;

      osc1.connect(bp);
      g2.connect(bp);
      g3.connect(bp);
      bp.connect(output);

      output.connect(this._createPannedOutput(pan, normDist));

      this._trackVoice(osc1, dur);
      [osc1, osc2, osc3].forEach(o => { o.start(now); o.stop(now + dur); });
    }
  }
};
