window.App = window.App || {};

App.Shapes = {
  generate(shapeType, canvasWidth, canvasHeight, config) {
    const generator = this._generators[shapeType] || this._generators.v;
    const result = generator.call(this, canvasWidth, canvasHeight, config);

    // Precompute segments and polar data for each wall
    for (const wall of result.walls) {
      this._computeWallData(wall);
    }

    return result;
  },

  _computeWallData(wall) {
    const N = 40;
    const points = [];
    const hasCurve = wall.curve && wall.curve !== 0;

    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const mt = 1 - t;
      if (hasCurve && wall.cp) {
        points.push({
          x: mt * mt * wall.start.x + 2 * mt * t * wall.cp.x + t * t * wall.end.x,
          y: mt * mt * wall.start.y + 2 * mt * t * wall.cp.y + t * t * wall.end.y,
        });
      } else {
        points.push({
          x: wall.start.x + (wall.end.x - wall.start.x) * t,
          y: wall.start.y + (wall.end.y - wall.start.y) * t,
        });
      }
    }

    // Build segments for linear collision
    wall.segments = [];
    for (let i = 0; i < N; i++) {
      wall.segments.push({ a: points[i], b: points[i + 1] });
    }

    // Compute wall length
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    wall.length = Math.sqrt(dx * dx + dy * dy);
  },

  _computeBezierCP(start, end, curve) {
    if (!curve || curve === 0) {
      return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    }
    const mx = (start.x + end.x) / 2;
    const my = (start.y + end.y) / 2;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x: mx, y: my };
    // Perpendicular (inward for closed shapes)
    const nx = -dy / len;
    const ny = dx / len;
    const offset = curve * len * 0.25;
    return { x: mx + nx * offset, y: my + ny * offset };
  },

  _generators: {
    v(canvasWidth, canvasHeight, config) {
      const vx = canvasWidth / 2;
      const vy = canvasHeight * 0.88;
      const halfAngle = ((config.vAngle || 60) / 2) * Math.PI / 180;
      const wallLength = Math.min(canvasWidth, canvasHeight) * 0.85;
      const curve = config.wallCurve || 0;

      const leftEnd = {
        x: vx - Math.sin(halfAngle) * wallLength,
        y: vy - Math.cos(halfAngle) * wallLength
      };
      const rightEnd = {
        x: vx + Math.sin(halfAngle) * wallLength,
        y: vy - Math.cos(halfAngle) * wallLength
      };

      // Compute control points with correct perpendicular directions
      const curveOffset = curve * wallLength * 0.25;

      // Left wall perpendicular
      const ldx = leftEnd.x - vx;
      const ldy = leftEnd.y - vy;
      const lLen = Math.sqrt(ldx * ldx + ldy * ldy);
      const lnx = ldy / lLen;
      const lny = -ldx / lLen;
      const lmx = (vx + leftEnd.x) / 2;
      const lmy = (vy + leftEnd.y) / 2;

      // Right wall perpendicular
      const rdx = rightEnd.x - vx;
      const rdy = rightEnd.y - vy;
      const rLen = Math.sqrt(rdx * rdx + rdy * rdy);
      const rnx = -rdy / rLen;
      const rny = rdx / rLen;
      const rmx = (vx + rightEnd.x) / 2;
      const rmy = (vy + rightEnd.y) / 2;

      const walls = [
        {
          id: 0,
          start: { x: vx, y: vy },
          end: leftEnd,
          curve: curve,
          cp: { x: lmx + lnx * curveOffset, y: lmy + lny * curveOffset },
          instrument: null,
          volume: 1.0,
          muted: false,
          bounce: config.wallBounce || 1.0,
          side: 'left',
        },
        {
          id: 1,
          start: { x: vx, y: vy },
          end: rightEnd,
          curve: curve,
          cp: { x: rmx + rnx * curveOffset, y: rmy + rny * curveOffset },
          instrument: null,
          volume: 1.0,
          muted: false,
          bounce: config.wallBounce || 1.0,
          side: 'right',
        }
      ];

      // Precompute polar data for pendulum mode
      const vertex = { x: vx, y: vy };
      for (const wall of walls) {
        const polar = [];
        const N = 60;
        for (let i = 1; i <= N; i++) {
          const t = i / N;
          const mt = 1 - t;
          const px = mt * mt * wall.start.x + 2 * mt * t * wall.cp.x + t * t * wall.end.x;
          const py = mt * mt * wall.start.y + 2 * mt * t * wall.cp.y + t * t * wall.end.y;
          const ddx = px - vertex.x;
          const ddy = py - vertex.y;
          const radius = Math.sqrt(ddx * ddx + ddy * ddy);
          const angle = Math.atan2(ddx, -ddy);
          if (radius > 1) polar.push({ radius, angle });
        }
        polar.sort((a, b) => a.radius - b.radius);
        wall.polar = polar;
      }

      return {
        walls,
        center: { x: vx, y: vy * 0.5 },
        ballSource: { x: vx, y: vy },
        maxWallLength: wallLength,
        supportsOrbits: true,
        wallAngleLeft: -halfAngle,
        wallAngleRight: halfAngle,
      };
    },

    triangle(canvasWidth, canvasHeight, config) {
      return App.Shapes._polygon(3, canvasWidth, canvasHeight, config);
    },

    square(canvasWidth, canvasHeight, config) {
      return App.Shapes._polygon(4, canvasWidth, canvasHeight, config);
    },

    pentagon(canvasWidth, canvasHeight, config) {
      return App.Shapes._polygon(5, canvasWidth, canvasHeight, config);
    },

    hexagon(canvasWidth, canvasHeight, config) {
      return App.Shapes._polygon(6, canvasWidth, canvasHeight, config);
    },

    circle(canvasWidth, canvasHeight, config) {
      return App.Shapes._polygon(24, canvasWidth, canvasHeight, config);
    },

    star(canvasWidth, canvasHeight, config) {
      const cx = canvasWidth / 2;
      const cy = canvasHeight / 2;
      const outerR = Math.min(canvasWidth, canvasHeight) * 0.4;
      const innerR = outerR * 0.4;
      const points = 5;
      const rotation = (config.shapeRotation || 0) * Math.PI / 180 - Math.PI / 2;
      const curve = config.wallCurve || 0;

      const vertices = [];
      for (let i = 0; i < points * 2; i++) {
        const angle = rotation + (i * Math.PI) / points;
        const r = i % 2 === 0 ? outerR : innerR;
        vertices.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
      }

      const walls = [];
      for (let i = 0; i < vertices.length; i++) {
        const start = vertices[i];
        const end = vertices[(i + 1) % vertices.length];
        const cp = App.Shapes._computeBezierCP(start, end, curve);
        walls.push({
          id: i,
          start, end, curve, cp,
          instrument: null, volume: 1.0, muted: false,
          bounce: config.wallBounce || 1.0,
        });
      }

      const maxLen = Math.max(...walls.map(w => {
        const dx = w.end.x - w.start.x;
        const dy = w.end.y - w.start.y;
        return Math.sqrt(dx * dx + dy * dy);
      }));

      return {
        walls,
        center: { x: cx, y: cy },
        ballSource: { x: cx, y: cy },
        maxWallLength: maxLen,
        supportsOrbits: false,
      };
    },
  },

  _polygon(sides, canvasWidth, canvasHeight, config) {
    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;
    const radius = Math.min(canvasWidth, canvasHeight) * 0.4;
    const rotation = (config.shapeRotation || 0) * Math.PI / 180 - Math.PI / 2;
    const curve = config.wallCurve || 0;

    const vertices = [];
    for (let i = 0; i < sides; i++) {
      const angle = rotation + (i * 2 * Math.PI) / sides;
      vertices.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    }

    const walls = [];
    for (let i = 0; i < sides; i++) {
      const start = vertices[i];
      const end = vertices[(i + 1) % sides];
      const cp = this._computeBezierCP(start, end, curve);
      walls.push({
        id: i,
        start, end, curve, cp,
        instrument: null, volume: 1.0, muted: false,
        bounce: config.wallBounce || 1.0,
      });
    }

    const maxLen = Math.max(...walls.map(w => {
      const dx = w.end.x - w.start.x;
      const dy = w.end.y - w.start.y;
      return Math.sqrt(dx * dx + dy * dy);
    }));

    return {
      walls,
      center: { x: cx, y: cy },
      ballSource: { x: cx, y: cy },
      maxWallLength: maxLen,
      supportsOrbits: false,
    };
  },
};
