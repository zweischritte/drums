window.App = window.App || {};

App.Renderer = {
  canvas: null,
  ctx: null,
  noisePattern: null,
  flashes: [],

  init(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.resize();
    this._createNoisePattern();
  },

  resize() {
    const c = this.canvas;
    const parent = c.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width: w, height: h };
  },

  getSize() {
    const dpr = window.devicePixelRatio || 1;
    return { width: this.canvas.width / dpr, height: this.canvas.height / dpr };
  },

  _createNoisePattern() {
    const size = 128;
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const octx = off.getContext('2d');
    const imageData = octx.createImageData(size, size);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 30;
      d[i] = v * 0.3;
      d[i + 1] = v;
      d[i + 2] = v * 0.2;
      d[i + 3] = 40;
    }
    octx.putImageData(imageData, 0, 0);
    this.noisePattern = this.ctx.createPattern(off, 'repeat');
  },

  addFlash(x, y, color) {
    this.flashes.push({ x, y, color, time: performance.now(), duration: 250 });
  },

  zoneHueMap: {
    hangDrum: 30, marimba: 20, bell: 200, kalimba: 50,
    steelDrum: 180, glockenspiel: 280, xylophone: 10,
    vibraphone: 160, musicBox: 310, sitar: 60,
  },

  draw(balls, walls, vertex) {
    const { width, height } = this.getSize();
    const ctx = this.ctx;

    this._drawBackground(ctx, width, height);
    this._drawWalls(ctx, walls);
    this._drawTrails(ctx, balls, vertex);
    this._drawBalls(ctx, balls);
    this._drawFlashes(ctx);
  },

  _drawBackground(ctx, w, h) {
    // Base color
    ctx.fillStyle = '#0a2a1a';
    ctx.fillRect(0, 0, w, h);

    // Subtle radial gradient for depth
    const grd = ctx.createRadialGradient(w / 2, h * 0.6, 0, w / 2, h * 0.6, w * 0.7);
    grd.addColorStop(0, 'rgba(20, 60, 30, 0.4)');
    grd.addColorStop(1, 'rgba(5, 20, 10, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    // Noise overlay
    if (this.noisePattern) {
      ctx.fillStyle = this.noisePattern;
      ctx.fillRect(0, 0, w, h);
    }
  },

  _drawWalls(ctx, walls) {
    const zones = App.UI && App.UI.config.useZones ? App.UI.config.instrumentZones : null;
    const isV = (App.UI && App.UI.config.shapeType || 'v') === 'v';

    for (let wi = 0; wi < walls.length; wi++) {
      const wall = walls[wi];
      if (!wall) continue;
      const hasCurve = wall.curve && wall.curve !== 0 && wall.cp;

      // Glow
      ctx.beginPath();
      ctx.moveTo(wall.start.x, wall.start.y);
      if (hasCurve) {
        ctx.quadraticCurveTo(wall.cp.x, wall.cp.y, wall.end.x, wall.end.y);
      } else {
        ctx.lineTo(wall.end.x, wall.end.y);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Determine wall color
      let wallColor = 'rgba(255, 255, 255, 0.85)';

      if (wall.instrument) {
        // Per-wall instrument color
        const hue = this.zoneHueMap[wall.instrument] || 0;
        wallColor = wall.muted
          ? 'rgba(100, 100, 100, 0.4)'
          : `hsla(${hue}, 70%, 55%, 0.85)`;
      } else if (isV && zones && zones.length > 1) {
        // V-shape with zones: draw colored segments
        this._drawZonedWall(ctx, wall, hasCurve, zones);
        continue;
      }

      // Single color wall
      ctx.beginPath();
      ctx.moveTo(wall.start.x, wall.start.y);
      if (hasCurve) {
        ctx.quadraticCurveTo(wall.cp.x, wall.cp.y, wall.end.x, wall.end.y);
      } else {
        ctx.lineTo(wall.end.x, wall.end.y);
      }
      ctx.strokeStyle = wallColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  },

  _drawZonedWall(ctx, wall, hasCurve, zones) {
    const N = 80;
    let zoneIdx = 0;

    for (let seg = 0; seg < N; seg++) {
      const t0 = seg / N;
      const t1 = (seg + 1) / N;
      const normDist = (t0 + t1) / 2;

      while (zoneIdx < zones.length - 1 && normDist > zones[zoneIdx].to) zoneIdx++;
      const zone = zones[zoneIdx];
      const hue = this.zoneHueMap[zone.instrument] || 0;

      const x0 = this._bezierAt(wall.start.x, wall.cp ? wall.cp.x : (wall.start.x + wall.end.x) / 2, wall.end.x, t0, hasCurve);
      const y0 = this._bezierAt(wall.start.y, wall.cp ? wall.cp.y : (wall.start.y + wall.end.y) / 2, wall.end.y, t0, hasCurve);
      const x1 = this._bezierAt(wall.start.x, wall.cp ? wall.cp.x : (wall.start.x + wall.end.x) / 2, wall.end.x, t1, hasCurve);
      const y1 = this._bezierAt(wall.start.y, wall.cp ? wall.cp.y : (wall.start.y + wall.end.y) / 2, wall.end.y, t1, hasCurve);

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = zone.muted ? 'rgba(100,100,100,0.4)' : `hsla(${hue}, 70%, 55%, 0.85)`;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  },

  _bezierAt(p0, cp, p2, t, curved) {
    if (!curved) return p0 + (p2 - p0) * t;
    const mt = 1 - t;
    return mt * mt * p0 + 2 * mt * t * cp + t * t * p2;
  },

  _drawTrails(ctx, balls, vertex) {
    for (const ball of balls) {
      if (!ball.alive) continue;

      // Draw from ball's own origin, not from the shared vertex
      const ox = ball.originX !== undefined ? ball.originX : vertex.x;
      const oy = ball.originY !== undefined ? ball.originY : vertex.y;

      const gradient = ctx.createLinearGradient(ox, oy, ball.x, ball.y);
      gradient.addColorStop(0, `hsla(${ball.hue}, 90%, 60%, 0.05)`);
      gradient.addColorStop(1, `hsla(${ball.hue}, 90%, 60%, 0.6)`);

      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ball.x, ball.y);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  },

  _drawBalls(ctx, balls) {
    for (const ball of balls) {
      if (!ball.alive) continue;

      // Ball with gradient for 3D effect
      const grd = ctx.createRadialGradient(
        ball.x - ball.radius * 0.3, ball.y - ball.radius * 0.3, ball.radius * 0.1,
        ball.x, ball.y, ball.radius
      );
      grd.addColorStop(0, `hsla(${ball.hue}, 80%, 80%, 1)`);
      grd.addColorStop(1, `hsla(${ball.hue}, 90%, 50%, 1)`);

      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    }
  },

  _drawFlashes(ctx) {
    const now = performance.now();
    this.flashes = this.flashes.filter(f => now - f.time < f.duration);

    for (const f of this.flashes) {
      const progress = (now - f.time) / f.duration;
      const alpha = 1 - progress;
      const radius = 10 + progress * 25;

      const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, radius);
      grd.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.8})`);
      grd.addColorStop(0.5, `${f.color.replace(')', `, ${alpha * 0.4})`.replace('hsl(', 'hsla('))}`);
      grd.addColorStop(1, `rgba(255, 255, 255, 0)`);

      ctx.beginPath();
      ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    }
  }
};
