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
    // Pendulum mode
    mode: 'pendulum',  // 'linear' or 'pendulum'
    minRadius: 30,
    radiusStep: 30,
    swingSpeed: 2,
    speedMode: 0,  // 0 = same angular speed, 100 = same ball (tangential) speed
    wallCurve: 0,  // -1 (concave/inward) to +1 (convex/outward)
    wallBounce: 1.0,  // wall plasticity: <1 = absorb energy, 1 = elastic, >1 = accelerate
    friction: 0,      // space friction: 0 = none, 1 = heavy
  },

  vertex: { x: 0, y: 0 },
  walls: {
    left: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
    right: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }
  },
  wallLength: 0,
  // Wall angles from vertical (radians) for pendulum mode
  wallAngleLeft: 0,
  wallAngleRight: 0,
  balls: [],

  updateWalls(canvasWidth, canvasHeight) {
    const vx = canvasWidth / 2;
    const vy = canvasHeight * 0.88;
    this.vertex = { x: vx, y: vy };

    const halfAngle = (this.config.vAngle / 2) * Math.PI / 180;
    this.wallLength = Math.min(canvasWidth, canvasHeight) * 0.85;

    // Store wall angles for pendulum boundary detection
    // Angle measured from straight up (negative Y), clockwise positive
    this.wallAngleLeft = -halfAngle;
    this.wallAngleRight = halfAngle;

    const leftEnd = {
      x: vx - Math.sin(halfAngle) * this.wallLength,
      y: vy - Math.cos(halfAngle) * this.wallLength
    };
    const rightEnd = {
      x: vx + Math.sin(halfAngle) * this.wallLength,
      y: vy - Math.cos(halfAngle) * this.wallLength
    };

    // Curve control point: perpendicular offset at the midpoint of each wall
    const curve = this.config.wallCurve || 0;
    const curveOffset = curve * this.wallLength * 0.25;

    // Left wall midpoint + perpendicular
    const lmx = (vx + leftEnd.x) / 2;
    const lmy = (vy + leftEnd.y) / 2;
    // Perpendicular to left wall (pointing inward = toward center)
    const ldx = leftEnd.x - vx;
    const ldy = leftEnd.y - vy;
    const lLen = Math.sqrt(ldx * ldx + ldy * ldy);
    // Perpendicular: rotate 90° clockwise (inward for left wall)
    const lnx = ldy / lLen;
    const lny = -ldx / lLen;

    const rmx = (vx + rightEnd.x) / 2;
    const rmy = (vy + rightEnd.y) / 2;
    const rdx = rightEnd.x - vx;
    const rdy = rightEnd.y - vy;
    const rLen = Math.sqrt(rdx * rdx + rdy * rdy);
    // Perpendicular: rotate 90° counter-clockwise (inward for right wall)
    const rnx = -rdy / rLen;
    const rny = rdx / rLen;

    this.walls.left = {
      start: { x: vx, y: vy },
      end: leftEnd,
      cp: { x: lmx + lnx * curveOffset, y: lmy + lny * curveOffset }
    };
    this.walls.right = {
      start: { x: vx, y: vy },
      end: rightEnd,
      cp: { x: rmx + rnx * curveOffset, y: rmy + rny * curveOffset }
    };

    // Precompute wall data for both modes
    this._precomputeWallData();
  },

  _precomputeWallData() {
    const N = 40;
    for (const key of ['left', 'right']) {
      const wall = this.walls[key];
      const polar = [];
      const segments = [];

      // Sample bezier at N+1 points
      const points = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const mt = 1 - t;
        points.push({
          x: mt * mt * wall.start.x + 2 * mt * t * wall.cp.x + t * t * wall.end.x,
          y: mt * mt * wall.start.y + 2 * mt * t * wall.cp.y + t * t * wall.end.y,
        });
      }

      // Build segments for linear collision
      for (let i = 0; i < N; i++) {
        segments.push({ a: points[i], b: points[i + 1] });
      }
      wall.segments = segments;

      // Build polar lookup for pendulum collision
      for (let i = 1; i <= N; i++) {
        const dx = points[i].x - this.vertex.x;
        const dy = points[i].y - this.vertex.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dx, -dy);
        if (radius > 1) {
          polar.push({ radius, angle });
        }
      }
      polar.sort((a, b) => a.radius - b.radius);
      wall.polar = polar;
    }
  },

  _wallAngleAtRadius(wallKey, radius) {
    const polar = this.walls[wallKey].polar;
    if (!polar || polar.length === 0) {
      const halfAngle = (this.config.vAngle / 2) * Math.PI / 180;
      return wallKey === 'left' ? -halfAngle : halfAngle;
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

    if (this.config.mode === 'pendulum') {
      this._launchPendulum(n);
    } else {
      this._launchLinear(n);
    }
  },

  _launchPendulum(n) {
    const halfAngle = (this.config.vAngle / 2) * Math.PI / 180;
    const startAngle = this.config.launchAngle * Math.PI / 180;

    for (let i = 0; i < n; i++) {
      // Each ball gets a different radius (distance from vertex)
      const radius = this.config.minRadius + i * this.config.radiusStep;

      // Current angular position (angle from vertical, 0 = straight up)
      // All start at the same angle
      const angle = startAngle;

      // Angular velocity (radians per second)
      // speedMode: 0 = same angular speed (outer balls faster in abs),
      //           100 = same tangential speed (inner balls faster angularly)
      const baseSpeed = this.config.swingSpeed;
      const refRadius = this.config.minRadius + ((n - 1) / 2) * this.config.radiusStep;
      const sameAngular = baseSpeed;
      const sameTangential = baseSpeed * refRadius / radius;
      const blend = (this.config.speedMode || 0) / 100;
      const angularVel = sameAngular * (1 - blend) + sameTangential * blend;

      const hue = (i / n) * 360;

      // Position on the arc
      const x = this.vertex.x + Math.sin(angle) * radius;
      const y = this.vertex.y - Math.cos(angle) * radius;

      this.balls.push({
        // Current position (computed from angle + radius)
        x: x,
        y: y,
        originX: this.vertex.x,
        originY: this.vertex.y,
        // Pendulum state
        pendulumAngle: angle,
        pendulumRadius: radius,
        angularVel: angularVel,
        // Visual
        radius: this.config.ballRadius,
        color: `hsl(${hue}, 90%, 60%)`,
        hue: hue,
        alive: true,
        lastCollisionTime: 0,
        bounceCount: 0,
        mode: 'pendulum',
      });
    }
  },

  _launchLinear(n) {
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
      const startY = this.vertex.y - this.config.startHeight - staggerOffset;
      const startX = this.vertex.x;

      const hue = (i / n) * 360;

      this.balls.push({
        x: startX,
        y: startY,
        originX: startX,
        originY: startY,
        vx: vx,
        vy: vy,
        radius: this.config.ballRadius,
        color: `hsl(${hue}, 90%, 60%)`,
        hue: hue,
        alive: true,
        lastCollisionTime: 0,
        bounceCount: 0,
        mode: 'linear',
      });
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
    // Apply space friction (exponential decay of angular velocity)
    if (this.config.friction > 0) {
      const frictionFactor = 1 - this.config.friction * dt * 3;
      ball.angularVel *= Math.max(0, frictionFactor);
    }

    // Move along arc
    const prevAngle = ball.pendulumAngle;
    ball.pendulumAngle += ball.angularVel * dt;

    // Get wall boundary angle for this ball's radius (accounts for wall curvature)
    const rightBound = this._wallAngleAtRadius('right', ball.pendulumRadius);
    const leftBound = this._wallAngleAtRadius('left', ball.pendulumRadius);

    let hitWall = null;

    if (ball.pendulumAngle >= rightBound) {
      ball.pendulumAngle = rightBound - (ball.pendulumAngle - rightBound);
      ball.angularVel = -ball.angularVel * this.config.wallBounce;
      hitWall = 'right';
    } else if (ball.pendulumAngle <= leftBound) {
      ball.pendulumAngle = leftBound - (ball.pendulumAngle - leftBound);
      ball.angularVel = -ball.angularVel * this.config.wallBounce;
      hitWall = 'left';
    }

    // Update position from angle + radius
    ball.x = this.vertex.x + Math.sin(ball.pendulumAngle) * ball.pendulumRadius;
    ball.y = this.vertex.y - Math.cos(ball.pendulumAngle) * ball.pendulumRadius;

    // Generate collision event on wall hit — only play sound within wall range
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
          ball: ball,
          velocity: Math.abs(ball.angularVel) / this.config.swingSpeed,
          wallSide: hitWall,
        });
      }
    }
  },

  _updateLinear(ball, dt, now, collisions) {
    // Apply space friction
    if (this.config.friction > 0) {
      const frictionFactor = 1 - this.config.friction * dt * 3;
      ball.vx *= Math.max(0, frictionFactor);
      ball.vy *= Math.max(0, frictionFactor);
    }

    // Apply gravity
    ball.vy += this.config.gravity * dt;

    // Move
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Check wall collisions (against bezier segments)
    for (const wallKey of ['left', 'right']) {
      const wall = this.walls[wallKey];
      const segs = wall.segments || [{ a: wall.start, b: wall.end }];
      let bestCol = null;

      for (const seg of segs) {
        const col = this._circleSegmentCollision(ball, seg.a, seg.b);
        if (col.hit && (!bestCol || col.penetration > bestCol.penetration)) {
          bestCol = col;
        }
      }

      if (bestCol && (now - ball.lastCollisionTime) > 50) {
        this._resolveCollision(ball, bestCol);
        ball.lastCollisionTime = now;
        ball.bounceCount++;

        const dist = this._pointDistance(this.vertex, bestCol.point);
        const normDist = dist / this.wallLength;

        // Only play sound within wall range
        if (normDist <= 1.0) {
          collisions.push({
            x: bestCol.point.x,
            y: bestCol.point.y,
            distance: dist,
            maxDistance: this.wallLength,
            normalizedDistance: normDist,
            ball: ball,
            velocity: Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) / this.config.ballSpeed,
            wallSide: wallKey,
          });
        }
      }
    }

    // Bounce off canvas edges instead of dying
    const canvasW = this.vertex.x * 2;
    const canvasH = this.vertex.y / 0.88;
    if (ball.x < ball.radius) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x > canvasW - ball.radius) {
      ball.x = canvasW - ball.radius;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y < ball.radius) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
    } else if (ball.y > canvasH - ball.radius) {
      ball.y = canvasH - ball.radius;
      ball.vy = -Math.abs(ball.vy);
    }
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
        t: t
      };
    }
    return { hit: false };
  },

  _resolveCollision(ball, col) {
    ball.x += col.normal.x * (col.penetration + 0.5);
    ball.y += col.normal.y * (col.penetration + 0.5);

    const dot = ball.vx * col.normal.x + ball.vy * col.normal.y;
    ball.vx -= 2 * dot * col.normal.x;
    ball.vy -= 2 * dot * col.normal.y;

    // Wall plasticity: <1 absorbs energy, 1 = elastic, >1 = accelerates
    const bounce = this.config.wallBounce;
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
