window.App = window.App || {};

App.Physics = {
  config: {
    vAngle: 60,
    ballSpeed: 300,
    numBalls: 12,
    gravity: 0,
    ballRadius: 6,
    staggerHeight: 0,
    sideSpeed: 0,
    verticalSpeed: 0,
    startHeight: 0,
    spread: 100,
    launchAngle: 0,
    mode: 'pendulum',
    minRadius: 30,
    radiusStep: 30,
    swingSpeed: 2,
    speedMode: 0,
    wallCurve: 0,
    wallBounce: 1.0,
    friction: 0,
    shapeType: 'v',
    shapeRotation: 0,
  },

  // Multi-wall state
  walls: [],
  vertex: { x: 0, y: 0 },     // backward compat alias for ballSource (V-shape)
  ballSource: { x: 0, y: 0 },
  center: { x: 0, y: 0 },
  wallLength: 0,
  shapeResult: null,
  balls: [],

  updateWalls(canvasWidth, canvasHeight) {
    const result = App.Shapes.generate(
      this.config.shapeType || 'v',
      canvasWidth, canvasHeight,
      this.config
    );

    this.walls = result.walls;
    this.ballSource = result.ballSource;
    this.center = result.center;
    this.wallLength = result.maxWallLength;
    this.shapeResult = result;

    // Backward compat for V-shape pendulum
    this.vertex = this.ballSource;
  },

  _wallAngleAtRadius(wallIndex, radius) {
    const wall = this.walls[wallIndex];
    const polar = wall ? wall.polar : null;
    if (!polar || polar.length === 0) {
      const halfAngle = (this.config.vAngle / 2) * Math.PI / 180;
      return wallIndex === 0 ? -halfAngle : halfAngle;
    }
    if (radius <= polar[0].radius) return polar[0].angle;
    if (radius >= polar[polar.length - 1].radius) return polar[polar.length - 1].angle;
    for (let i = 0; i < polar.length - 1; i++) {
      if (radius >= polar[i].radius && radius <= polar[i + 1].radius) {
        const t = (radius - polar[i].radius) / (polar[i + 1].radius - polar[i].radius);
        return polar[i].angle + t * (polar[i + 1].angle - polar[i].angle);
      }
    }
    return polar[polar.length - 1].angle;
  },

  launchBalls() {
    this.balls = [];
    const n = this.config.numBalls;
    const isV = (this.config.shapeType || 'v') === 'v';

    if (this.config.mode === 'pendulum' && isV) {
      this._launchPendulum(n);
    } else {
      this._launchLinear(n);
    }
  },

  _launchPendulum(n) {
    const startAngle = this.config.launchAngle * Math.PI / 180;

    for (let i = 0; i < n; i++) {
      const radius = this.config.minRadius + i * this.config.radiusStep;

      const baseSpeed = this.config.swingSpeed;
      const refRadius = this.config.minRadius + ((n - 1) / 2) * this.config.radiusStep;
      const sameAngular = baseSpeed;
      const sameTangential = baseSpeed * refRadius / radius;
      const blend = (this.config.speedMode || 0) / 100;
      const angularVel = sameAngular * (1 - blend) + sameTangential * blend;

      const hue = (i / n) * 360;
      const x = this.vertex.x + Math.sin(startAngle) * radius;
      const y = this.vertex.y - Math.cos(startAngle) * radius;

      this.balls.push({
        x, y,
        originX: this.vertex.x,
        originY: this.vertex.y,
        pendulumAngle: startAngle,
        pendulumRadius: radius,
        angularVel,
        radius: this.config.ballRadius,
        color: `hsl(${hue}, 90%, 60%)`,
        hue,
        alive: true,
        lastCollisionTime: 0,
        bounceCount: 0,
        mode: 'pendulum',
      });
    }
  },

  _launchLinear(n) {
    const isV = (this.config.shapeType || 'v') === 'v';
    const src = this.ballSource;

    if (isV) {
      // V-shape: fan within the V angle
      const halfAngle = (this.config.vAngle / 2) * Math.PI / 180;
      const margin = halfAngle * 0.08;
      const spreadFactor = this.config.spread / 100;
      const baseAngle = this.config.launchAngle * Math.PI / 180;

      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1);
        const fanAngle = -halfAngle + margin + t * (2 * halfAngle - 2 * margin);
        const angle = baseAngle * (1 - spreadFactor) + fanAngle * spreadFactor;

        const speed = this.config.ballSpeed;
        const vx = Math.sin(angle) * speed + this.config.sideSpeed;
        const vy = -Math.cos(angle) * speed + this.config.verticalSpeed;

        const staggerOffset = (n === 1) ? 0 : i * this.config.staggerHeight;
        const startX = src.x;
        const startY = src.y - this.config.startHeight - staggerOffset;
        const hue = (i / n) * 360;

        this.balls.push({
          x: startX, y: startY,
          originX: startX, originY: startY,
          vx, vy,
          radius: this.config.ballRadius,
          color: `hsl(${hue}, 90%, 60%)`,
          hue,
          alive: true,
          lastCollisionTime: 0,
          bounceCount: 0,
          mode: 'linear',
        });
      }
    } else {
      // Polygon: fan in all directions from center
      const spreadFactor = this.config.spread / 100;
      const baseAngle = this.config.launchAngle * Math.PI / 180;

      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1);
        // Full 360° fan spread, or narrow cone from launchAngle
        const fanAngle = t * 2 * Math.PI;
        const angle = baseAngle * (1 - spreadFactor) + fanAngle * spreadFactor;

        const speed = this.config.ballSpeed;
        const vx = Math.sin(angle) * speed;
        const vy = -Math.cos(angle) * speed;
        const hue = (i / n) * 360;

        this.balls.push({
          x: src.x, y: src.y,
          originX: src.x, originY: src.y,
          vx, vy,
          radius: this.config.ballRadius,
          color: `hsl(${hue}, 90%, 60%)`,
          hue,
          alive: true,
          lastCollisionTime: 0,
          bounceCount: 0,
          mode: 'linear',
        });
      }
    }
  },

  update(dt) {
    const collisions = [];
    const now = performance.now();

    for (const ball of this.balls) {
      if (!ball.alive) continue;

      if (ball.mode === 'pendulum') {
        this._updatePendulum(ball, dt, now, collisions);
      } else {
        this._updateLinear(ball, dt, now, collisions);
      }
    }

    return collisions;
  },

  _updatePendulum(ball, dt, now, collisions) {
    if (this.config.friction > 0) {
      const frictionFactor = 1 - this.config.friction * dt * 3;
      ball.angularVel *= Math.max(0, frictionFactor);
    }

    const prevAngle = ball.pendulumAngle;
    ball.pendulumAngle += ball.angularVel * dt;

    // Walls[0] = left, walls[1] = right for V-shape
    const leftBound = this._wallAngleAtRadius(0, ball.pendulumRadius);
    const rightBound = this._wallAngleAtRadius(1, ball.pendulumRadius);

    let hitWall = null;
    let hitWallIndex = -1;

    if (ball.pendulumAngle >= rightBound) {
      ball.pendulumAngle = rightBound - (ball.pendulumAngle - rightBound);
      ball.angularVel = -ball.angularVel * (this.walls[1].bounce || this.config.wallBounce);
      hitWall = 'right';
      hitWallIndex = 1;
    } else if (ball.pendulumAngle <= leftBound) {
      ball.pendulumAngle = leftBound - (ball.pendulumAngle - leftBound);
      ball.angularVel = -ball.angularVel * (this.walls[0].bounce || this.config.wallBounce);
      hitWall = 'left';
      hitWallIndex = 0;
    }

    ball.x = this.vertex.x + Math.sin(ball.pendulumAngle) * ball.pendulumRadius;
    ball.y = this.vertex.y - Math.cos(ball.pendulumAngle) * ball.pendulumRadius;

    if (hitWall && (now - ball.lastCollisionTime) > 50) {
      ball.lastCollisionTime = now;
      ball.bounceCount++;

      const normDist = ball.pendulumRadius / this.wallLength;

      if (normDist <= 1.0) {
        collisions.push({
          x: ball.x,
          y: ball.y,
          distance: ball.pendulumRadius,
          maxDistance: this.wallLength,
          normalizedDistance: normDist,
          ball,
          velocity: Math.abs(ball.angularVel) / this.config.swingSpeed,
          wallSide: hitWall,
          wallIndex: hitWallIndex,
          wall: this.walls[hitWallIndex],
        });
      }
    }
  },

  _updateLinear(ball, dt, now, collisions) {
    if (this.config.friction > 0) {
      const frictionFactor = 1 - this.config.friction * dt * 3;
      ball.vx *= Math.max(0, frictionFactor);
      ball.vy *= Math.max(0, frictionFactor);
    }

    ball.vy += this.config.gravity * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Check wall collisions against ALL walls
    for (let wi = 0; wi < this.walls.length; wi++) {
      const wall = this.walls[wi];
      const segs = wall.segments || [{ a: wall.start, b: wall.end }];
      let bestCol = null;

      for (const seg of segs) {
        const col = this._circleSegmentCollision(ball, seg.a, seg.b);
        if (col.hit && (!bestCol || col.penetration > bestCol.penetration)) {
          bestCol = col;
        }
      }

      if (bestCol && (now - ball.lastCollisionTime) > 50) {
        // Use per-wall bounce or global
        const bounce = wall.bounce || this.config.wallBounce;
        this._resolveCollision(ball, bestCol, bounce);
        ball.lastCollisionTime = now;
        ball.bounceCount++;

        const dist = this._pointDistance(this.ballSource, bestCol.point);
        const normDist = dist / this.wallLength;

        if (normDist <= 1.5) {
          // Determine wall side for stereo pan
          const wallMidX = (wall.start.x + wall.end.x) / 2;
          const side = wallMidX < this.center.x ? 'left' : 'right';

          collisions.push({
            x: bestCol.point.x,
            y: bestCol.point.y,
            distance: dist,
            maxDistance: this.wallLength,
            normalizedDistance: Math.min(1, normDist),
            ball,
            velocity: Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) / this.config.ballSpeed,
            wallSide: side,
            wallIndex: wi,
            wall,
          });
        }
      }
    }

    // Bounce off canvas edges
    const canvasW = this.center.x * 2;
    const canvasH = this.center.y * 2;
    if (ball.x < ball.radius) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx); }
    else if (ball.x > canvasW - ball.radius) { ball.x = canvasW - ball.radius; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < ball.radius) { ball.y = ball.radius; ball.vy = Math.abs(ball.vy); }
    else if (ball.y > canvasH - ball.radius) { ball.y = canvasH - ball.radius; ball.vy = -Math.abs(ball.vy); }
  },

  _circleSegmentCollision(ball, A, B) {
    const ABx = B.x - A.x;
    const ABy = B.y - A.y;
    const APx = ball.x - A.x;
    const APy = ball.y - A.y;
    const abLenSq = ABx * ABx + ABy * ABy;
    if (abLenSq === 0) return { hit: false };

    let t = (APx * ABx + APy * ABy) / abLenSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = A.x + t * ABx;
    const closestY = A.y + t * ABy;
    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    const distSq = dx * dx + dy * dy;
    const r = ball.radius;

    if (distSq < r * r) {
      const dist = Math.sqrt(distSq) || 0.001;
      return {
        hit: true,
        point: { x: closestX, y: closestY },
        normal: { x: dx / dist, y: dy / dist },
        penetration: r - dist,
        t
      };
    }
    return { hit: false };
  },

  _resolveCollision(ball, col, bounce) {
    ball.x += col.normal.x * (col.penetration + 0.5);
    ball.y += col.normal.y * (col.penetration + 0.5);

    const dot = ball.vx * col.normal.x + ball.vy * col.normal.y;
    ball.vx -= 2 * dot * col.normal.x;
    ball.vy -= 2 * dot * col.normal.y;

    bounce = bounce || this.config.wallBounce;
    ball.vx *= bounce;
    ball.vy *= bounce;
  },

  _pointDistance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  },

  hasActiveBalls() {
    return this.balls.some(b => b.alive);
  }
};
