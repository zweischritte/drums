window.App = window.App || {};

// Extends App.Shapes with 3D shape generators
App.Shapes3D = {
  generate(shapeType, canvasWidth, canvasHeight, config) {
    const generator = this._generators[shapeType];
    if (!generator) return null;
    return generator.call(this, canvasWidth, canvasHeight, config);
  },

  _generators: {
    cube(canvasWidth, canvasHeight, config) {
      const size = Math.min(canvasWidth, canvasHeight) * 0.35;
      const hw = size;   // half-width (x)
      const hh = size;   // half-height (y)
      const hd = size;   // half-depth (z)
      const bounce = config.wallBounce || 1.0;

      const walls = [
        // Right wall (+x)
        {
          id: 0, instrument: null, volume: 1.0, muted: false, bounce,
          plane3d: {
            normal: { x: -1, y: 0, z: 0 },
            d: hw,
            center: { x: hw, y: 0, z: 0 },
            corners: [
              { x: hw, y: -hh, z: -hd }, { x: hw, y: hh, z: -hd },
              { x: hw, y: hh, z: hd }, { x: hw, y: -hh, z: hd },
            ]
          },
          // 2D projection for UI compat
          start: { x: canvasWidth / 2 + hw, y: canvasHeight / 2 - hh },
          end: { x: canvasWidth / 2 + hw, y: canvasHeight / 2 + hh },
          curve: 0, segments: [], length: hh * 2,
        },
        // Left wall (-x)
        {
          id: 1, instrument: null, volume: 1.0, muted: false, bounce,
          plane3d: {
            normal: { x: 1, y: 0, z: 0 },
            d: hw,
            center: { x: -hw, y: 0, z: 0 },
            corners: [
              { x: -hw, y: -hh, z: hd }, { x: -hw, y: hh, z: hd },
              { x: -hw, y: hh, z: -hd }, { x: -hw, y: -hh, z: -hd },
            ]
          },
          start: { x: canvasWidth / 2 - hw, y: canvasHeight / 2 - hh },
          end: { x: canvasWidth / 2 - hw, y: canvasHeight / 2 + hh },
          curve: 0, segments: [], length: hh * 2,
        },
        // Top wall (+y)
        {
          id: 2, instrument: null, volume: 1.0, muted: false, bounce,
          plane3d: {
            normal: { x: 0, y: -1, z: 0 },
            d: hh,
            center: { x: 0, y: hh, z: 0 },
            corners: [
              { x: -hw, y: hh, z: -hd }, { x: hw, y: hh, z: -hd },
              { x: hw, y: hh, z: hd }, { x: -hw, y: hh, z: hd },
            ]
          },
          start: { x: canvasWidth / 2 - hw, y: canvasHeight / 2 - hh },
          end: { x: canvasWidth / 2 + hw, y: canvasHeight / 2 - hh },
          curve: 0, segments: [], length: hw * 2,
        },
        // Bottom wall (-y)
        {
          id: 3, instrument: null, volume: 1.0, muted: false, bounce,
          plane3d: {
            normal: { x: 0, y: 1, z: 0 },
            d: hh,
            center: { x: 0, y: -hh, z: 0 },
            corners: [
              { x: -hw, y: -hh, z: hd }, { x: hw, y: -hh, z: hd },
              { x: hw, y: -hh, z: -hd }, { x: -hw, y: -hh, z: -hd },
            ]
          },
          start: { x: canvasWidth / 2 - hw, y: canvasHeight / 2 + hh },
          end: { x: canvasWidth / 2 + hw, y: canvasHeight / 2 + hh },
          curve: 0, segments: [], length: hw * 2,
        },
        // Front wall (+z)
        {
          id: 4, instrument: null, volume: 1.0, muted: false, bounce,
          plane3d: {
            normal: { x: 0, y: 0, z: -1 },
            d: hd,
            center: { x: 0, y: 0, z: hd },
            corners: [
              { x: -hw, y: -hh, z: hd }, { x: -hw, y: hh, z: hd },
              { x: hw, y: hh, z: hd }, { x: hw, y: -hh, z: hd },
            ]
          },
          start: { x: canvasWidth / 2 - hw, y: canvasHeight / 2 },
          end: { x: canvasWidth / 2 + hw, y: canvasHeight / 2 },
          curve: 0, segments: [], length: hw * 2,
        },
        // Back wall (-z)
        {
          id: 5, instrument: null, volume: 1.0, muted: false, bounce,
          plane3d: {
            normal: { x: 0, y: 0, z: 1 },
            d: hd,
            center: { x: 0, y: 0, z: -hd },
            corners: [
              { x: hw, y: -hh, z: -hd }, { x: hw, y: hh, z: -hd },
              { x: -hw, y: hh, z: -hd }, { x: -hw, y: -hh, z: -hd },
            ]
          },
          start: { x: canvasWidth / 2, y: canvasHeight / 2 - hh },
          end: { x: canvasWidth / 2, y: canvasHeight / 2 + hh },
          curve: 0, segments: [], length: hh * 2,
        },
      ];

      return {
        walls,
        center: { x: canvasWidth / 2, y: canvasHeight / 2 },
        center3d: { x: 0, y: 0, z: 0 },
        ballSource: { x: canvasWidth / 2, y: canvasHeight / 2 },
        ballSource3d: { x: 0, y: 0, z: 0 },
        maxWallLength: size * 2,
        roomSize: { x: hw * 2, y: hh * 2, z: hd * 2 },
        supportsOrbits: false,
        is3D: true,
      };
    },
  }
};
