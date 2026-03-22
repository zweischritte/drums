window.App = window.App || {};

App.Renderer3D = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  wallMeshes: [],
  ballMeshes: [],
  trailLines: [],
  flashLights: [],
  ambientLight: null,
  initialized: false,

  async init(container) {
    const THREE = await this._loadThree();
    if (!THREE) return false;
    this.THREE = THREE;

    const w = container.clientWidth;
    const h = container.clientHeight;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a2a1a);
    this.scene.fog = new THREE.FogExp2(0x0a2a1a, 0.002);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 2000);
    this.camera.position.set(0, 300, 500);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    // Lights
    this.ambientLight = new THREE.AmbientLight(0x334433, 0.6);
    this.scene.add(this.ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(200, 400, 300);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x44ff88, 0.4, 1000);
    pointLight.position.set(0, 200, 0);
    this.scene.add(pointLight);

    // Ground plane (subtle grid)
    const gridHelper = new THREE.GridHelper(800, 20, 0x1a3a2a, 0x1a3a2a);
    gridHelper.position.y = -200;
    this.scene.add(gridHelper);

    // Orbit controls
    await this._loadOrbitControls(THREE);

    // Resize handler
    const ro = new ResizeObserver(() => {
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      this.camera.aspect = nw / nh;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(nw, nh);
    });
    ro.observe(container);

    this.initialized = true;
    return true;
  },

  async _loadThree() {
    if (window.THREE) return window.THREE;
    try {
      const module = await import('https://cdn.jsdelivr.net/npm/three@0.172.0/build/three.module.min.js');
      window.THREE = module;
      return module;
    } catch (e) {
      console.error('Failed to load Three.js:', e);
      return null;
    }
  },

  async _loadOrbitControls(THREE) {
    try {
      const module = await import('https://cdn.jsdelivr.net/npm/three@0.172.0/examples/jsm/controls/OrbitControls.js');
      this.controls = new module.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxDistance = 1500;
      this.controls.minDistance = 100;
    } catch (e) {
      console.warn('OrbitControls not loaded:', e);
    }
  },

  // Build 3D walls from the physics walls array
  buildWalls(walls, center) {
    const THREE = this.THREE;
    if (!THREE || !this.scene) return;

    // Remove old walls
    for (const m of this.wallMeshes) this.scene.remove(m);
    this.wallMeshes = [];

    const wallHeight = 80;
    const hueMap = App.Renderer.zoneHueMap;

    for (const wall of walls) {
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const wallLen = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dx, dy);

      // Map 2D coords to 3D: x stays x (centered), z = -y (depth), y = height
      const cx = ((wall.start.x + wall.end.x) / 2) - center.x;
      const cz = -(((wall.start.y + wall.end.y) / 2) - center.y);

      const geometry = new THREE.BoxGeometry(wallLen, wallHeight, 4);
      const hue = wall.instrument ? (hueMap[wall.instrument] || 0) : 0;
      const color = wall.instrument
        ? new THREE.Color(`hsl(${hue}, 60%, 40%)`)
        : new THREE.Color(0x445544);
      const opacity = wall.muted ? 0.2 : 0.7;

      const material = new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        opacity,
        emissive: color.clone().multiplyScalar(0.2),
        shininess: 60,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(cx, 0, cz);
      mesh.rotation.y = -angle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      this.scene.add(mesh);
      this.wallMeshes.push(mesh);
    }
  },

  // Update ball positions in 3D
  updateBalls(balls, center) {
    const THREE = this.THREE;
    if (!THREE || !this.scene) return;

    // Ensure we have enough ball meshes
    while (this.ballMeshes.length < balls.length) {
      const geo = new THREE.SphereGeometry(6, 16, 16);
      const mat = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        emissive: 0x333333,
        shininess: 100,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.ballMeshes.push(mesh);
    }

    // Update positions and visibility
    for (let i = 0; i < this.ballMeshes.length; i++) {
      const mesh = this.ballMeshes[i];
      if (i < balls.length && balls[i].alive) {
        const ball = balls[i];
        mesh.visible = true;
        mesh.position.x = ball.x - center.x;
        mesh.position.z = -(ball.y - center.y);
        mesh.position.y = 0;
        mesh.scale.setScalar(ball.radius / 6);

        // Update color
        const color = new THREE.Color(`hsl(${ball.hue}, 90%, 60%)`);
        mesh.material.color = color;
        mesh.material.emissive = color.clone().multiplyScalar(0.3);
      } else {
        mesh.visible = false;
      }
    }
  },

  addFlash(x, y, color, center) {
    const THREE = this.THREE;
    if (!THREE || !this.scene) return;

    const light = new THREE.PointLight(0xffffff, 2, 100);
    light.position.set(x - center.x, 10, -(y - center.y));
    this.scene.add(light);
    this.flashLights.push({ light, time: performance.now(), duration: 300 });
  },

  render() {
    if (!this.initialized) return;

    // Update flash lights
    const now = performance.now();
    this.flashLights = this.flashLights.filter(f => {
      const progress = (now - f.time) / f.duration;
      if (progress >= 1) {
        this.scene.remove(f.light);
        return false;
      }
      f.light.intensity = 2 * (1 - progress);
      return true;
    });

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  },

  getSize() {
    if (!this.renderer) return { width: 800, height: 600 };
    const size = this.renderer.getSize(new this.THREE.Vector2());
    return { width: size.x, height: size.y };
  },

  dispose() {
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
    this.initialized = false;
  }
};
