window.App = window.App || {};

App.Main = {
  animationId: null,
  lastTime: 0,
  running: false,
  scaleFreqs: [],

  use3D: false,

  init() {
    const canvas = document.getElementById('canvas');
    const panel = document.getElementById('panel');
    this.canvasWrap = document.getElementById('canvas-wrap');

    App.Renderer.init(canvas);

    App.UI.init(panel, {
      onChange: this._onConfigChange.bind(this),
      onLaunch: this._launch.bind(this),
      onReset: this._reset.bind(this),
    });

    // Initial wall setup — sync all config
    const size = App.Renderer.getSize();
    Object.assign(App.Physics.config, App.UI.config);
    App.Physics.updateWalls(size.width, size.height);

    // Handle resize
    const ro = new ResizeObserver(() => {
      if (!this.use3D) {
        const s = App.Renderer.resize();
        App.Physics.updateWalls(s.width, s.height);
      }
      if (!this.running) this._drawStatic();
    });
    ro.observe(canvas.parentElement);

    // Mobile panel toggle
    const toggle = document.getElementById('panel-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        panel.classList.toggle('open');
      });
    }

    // Don't auto-enable 3D on load — wait for Launch or explicit toggle
    // Reset render3D to false so 2D is the default view
    if (App.UI.config.render3D && App.UI.config.shapeType !== 'cube') {
      App.UI.config.render3D = false;
    }

    // Draw initial static scene
    this._drawStatic();
  },

  async _enable3D() {
    if (this.use3D) return;
    const canvas = document.getElementById('canvas');
    canvas.style.display = 'none';

    const ok = await App.Renderer3D.init(this.canvasWrap);
    if (ok) {
      this.use3D = true;
      App.Renderer3D.buildWalls(App.Physics.walls, App.Physics.center);
      App.Renderer3D.render();
    } else {
      canvas.style.display = 'block';
      App.UI.config.render3D = false;
    }
  },

  _disable3D() {
    if (!this.use3D) return;
    this.use3D = false;
    App.Renderer3D.dispose();
    const canvas = document.getElementById('canvas');
    canvas.style.display = 'block';
    App.Renderer.resize();
    const size = App.Renderer.getSize();
    App.Physics.updateWalls(size.width, size.height);
  },

  _drawStatic() {
    if (this.use3D) {
      App.Renderer3D.buildWalls(App.Physics.walls, App.Physics.center);
      App.Renderer3D.render();
    } else {
      App.Renderer.draw([], App.Physics.walls, App.Physics.vertex);
    }
  },

  _onConfigChange(key, value) {
    // 3D toggle
    if (key === 'render3D') {
      if (value === true || value === 'true') {
        this._enable3D();
      } else {
        this._disable3D();
      }
    }

    // Physics params
    if (key in App.Physics.config) {
      App.Physics.config[key] = value;
    }

    if (key === 'vAngle' || key === 'wallCurve' || key === 'shapeType' || key === 'shapeRotation') {
      App.Physics.config[key] = App.UI.config[key];
      // Auto-switch to linear for non-V shapes
      if (key === 'shapeType' && value !== 'v' && App.UI.config.mode === 'pendulum') {
        App.UI.config.mode = 'linear';
        App.Physics.config.mode = 'linear';
      }
      // Auto-enable 3D for cube
      if (key === 'shapeType' && value === 'cube' && !this.use3D) {
        this._enable3D();
      }
      const size = App.Renderer.getSize();
      App.Physics.updateWalls(size.width, size.height);
      if (key === 'shapeType' || key === 'shapeRotation') {
        // Rebuild UI to show/hide V-specific controls
        const panel = document.getElementById('panel');
        App.UI._buildControls(panel);
      }
      if (!this.running) this._drawStatic();
    }

    if (key === 'volume') {
      App.Audio.setVolume(value);
    }

    if (key === 'reverb') {
      App.Audio.setReverb(value);
    }

    if (key === 'spatialMode') {
      App.Audio.spatialMode = value;
    }
    if (key === 'stereoWidth') {
      App.Audio.stereoWidth = value;
    }
    if (key === 'panAmount') {
      App.Audio.panAmount = value;
    }
    if (key === 'itdAmount') {
      App.Audio.itdAmount = value;
    }
    if (key === 'maxItd') {
      App.Audio.maxItd = value / 1000;
    }
    if (key === 'hrtfSpread') {
      App.Audio.hrtfSpread = value;
    }
    if (key === 'hrtfDepth') {
      App.Audio.hrtfDepth = value;
    }

    // Rebuild scale for musical changes
    if (['baseNote', 'baseOctave', 'octaveRange', 'scale'].includes(key)) {
      this._rebuildScale();
    }
  },

  _playZonedNote(freq, normDist, velocity, pan) {
    const zones = App.UI.config.instrumentZones;
    const blend = App.UI.config.zoneBlend || 0;

    // Find which zone(s) this distance falls into
    let prevTo = 0;
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i];
      const zVol = (zone.volume !== undefined ? zone.volume : 1.0) * (zone.muted ? 0 : 1);
      if (normDist <= zone.to || i === zones.length - 1) {
        if (blend > 0) {
          if (i > 0 && normDist < prevTo + blend) {
            const t = (normDist - prevTo) / blend;
            const prev = zones[i - 1];
            const prevVol = (prev.volume !== undefined ? prev.volume : 1.0) * (prev.muted ? 0 : 1);
            if (prevVol > 0) App.Audio.playNote(freq, prev.instrument, velocity * (1 - t) * prevVol, pan, normDist);
            if (zVol > 0) App.Audio.playNote(freq, zone.instrument, velocity * t * zVol, pan, normDist);
            return;
          }
          if (i < zones.length - 1 && normDist > zone.to - blend) {
            const t = (zone.to - normDist) / blend;
            const next = zones[i + 1];
            const nextVol = (next.volume !== undefined ? next.volume : 1.0) * (next.muted ? 0 : 1);
            if (zVol > 0) App.Audio.playNote(freq, zone.instrument, velocity * t * zVol, pan, normDist);
            if (nextVol > 0) App.Audio.playNote(freq, next.instrument, velocity * (1 - t) * nextVol, pan, normDist);
            return;
          }
        }
        if (zVol > 0) App.Audio.playNote(freq, zone.instrument, velocity * zVol, pan, normDist);
        return;
      }
      prevTo = zone.to;
    }
  },

  _rebuildScale() {
    const c = App.UI.config;
    this.scaleFreqs = App.Scales.buildScale(c.baseNote, c.baseOctave, c.octaveRange, c.scale);
  },

  async _launch() {
    App.Audio.ensureContext();
    App.Audio.setVolume(App.UI.config.volume);
    App.Audio.setReverb(App.UI.config.reverb);
    App.Audio.spatialMode = App.UI.config.spatialMode;
    App.Audio.stereoWidth = App.UI.config.stereoWidth;
    App.Audio.panAmount = App.UI.config.panAmount;
    App.Audio.itdAmount = App.UI.config.itdAmount;
    App.Audio.maxItd = App.UI.config.maxItd / 1000;
    App.Audio.hrtfSpread = App.UI.config.hrtfSpread;
    App.Audio.hrtfDepth = App.UI.config.hrtfDepth;

    this._rebuildScale();

    // Sync all config to physics
    Object.assign(App.Physics.config, App.UI.config);

    // Auto-enable/disable 3D based on shape
    const needs3D = App.UI.config.shapeType === 'cube';
    if (needs3D && !this.use3D) {
      await this._enable3D();
    } else if (!needs3D && this.use3D) {
      this._disable3D();
    }

    const size = this.use3D ? App.Renderer3D.getSize() : App.Renderer.getSize();
    App.Physics.updateWalls(size.width, size.height);
    App.Physics.launchBalls();

    if (this.use3D) {
      App.Renderer3D.buildWalls(App.Physics.walls, App.Physics.center);
    }

    this.running = true;
    this.lastTime = performance.now();

    if (this.animationId) cancelAnimationFrame(this.animationId);
    this._loop(this.lastTime);
  },

  _reset() {
    this.running = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    App.Physics.balls = [];
    App.Renderer.flashes = [];
    this._drawStatic();
  },

  _loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    // Sync physics config from UI (for live changes)
    App.Physics.config.gravity = App.UI.config.gravity;
    App.Physics.config.ballRadius = App.UI.config.ballRadius;
    App.Physics.config.swingSpeed = App.UI.config.swingSpeed;
    App.Physics.config.wallBounce = App.UI.config.wallBounce;
    App.Physics.config.friction = App.UI.config.friction;

    const collisions = App.Physics.update(dt);

    for (const c of collisions) {
      const freq = App.Scales.distanceToNote(c.normalizedDistance, this.scaleFreqs);
      const pan = c.wallSide === 'left' ? -1 : 1;

      // Per-wall instrument takes priority
      if (c.wall && c.wall.instrument && !c.wall.muted) {
        const vol = c.wall.volume !== undefined ? c.wall.volume : 1.0;
        App.Audio.playNote(freq, c.wall.instrument, c.velocity * vol, pan, c.normalizedDistance);
      } else if (App.UI.config.useZones && App.UI.config.instrumentZones.length > 0) {
        this._playZonedNote(freq, c.normalizedDistance, c.velocity, pan);
      } else {
        App.Audio.playNote(freq, App.UI.config.instrument, c.velocity, pan, c.normalizedDistance);
      }
      if (this.use3D) {
        App.Renderer3D.addFlash(c.x, c.y, c.ball.color, App.Physics.center);
      } else {
        App.Renderer.addFlash(c.x, c.y, c.ball.color);
      }
    }

    if (this.use3D) {
      App.Renderer3D.updateBalls(App.Physics.balls, App.Physics.center);
      App.Renderer3D.render();
    } else {
      App.Renderer.draw(App.Physics.balls, App.Physics.walls, App.Physics.vertex);
    }

    if (App.Physics.hasActiveBalls()) {
      this.animationId = requestAnimationFrame(this._loop.bind(this));
    } else if (App.UI.config.continuous) {
      this._launch();
    } else {
      this.running = false;
      this.animationId = null;
    }
  }
};

// Start when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.Main.init();
});
