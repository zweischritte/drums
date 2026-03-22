window.App = window.App || {};

App.UI = {
  config: {
    mode: 'pendulum',
    vAngle: 60,
    ballSpeed: 300,
    numBalls: 12,
    ballRadius: 6,
    gravity: 0,
    staggerHeight: 0,
    sideSpeed: 0,
    verticalSpeed: 0,
    startHeight: 0,
    spread: 100,
    launchAngle: 0,
    shapeType: 'v',
    shapeRotation: 0,
    wallCurve: 0,
    wallBounce: 1.0,
    friction: 0,
    minRadius: 30,
    radiusStep: 30,
    swingSpeed: 2,
    speedMode: 0,
    baseNote: 'D',
    baseOctave: 3,
    octaveRange: 2,
    scale: 'pentatonic',
    instrument: 'hangDrum',
    useZones: false,
    instrumentZones: [
      { instrument: 'hangDrum', to: 0.5, volume: 1.0 },
      { instrument: 'bell', to: 1.0, volume: 1.0 },
    ],
    zoneBlend: 0.1,
    reverb: 0.3,
    volume: 0.7,
    spatialMode: 'off',
    stereoWidth: 0,
    panAmount: 1.0,
    itdAmount: 0,
    maxItd: 0.6,
    hrtfSpread: 3,
    hrtfDepth: 2,
    continuous: false,
  },

  _defaults: null,

  onChange: null,
  onLaunch: null,
  onReset: null,

  _settingsKey: 'vwall-drums-settings',

  init(panelEl, callbacks) {
    // Store defaults before any restore
    this._defaults = JSON.parse(JSON.stringify(this.config));

    const origOnChange = callbacks.onChange;
    this.onChange = (key, value) => {
      origOnChange && origOnChange(key, value);
      this._persistSettings();
    };
    this.onLaunch = callbacks.onLaunch;
    this.onReset = callbacks.onReset;
    this._restoreSettings();
    this._buildControls(panelEl);
  },

  _persistSettings() {
    try {
      localStorage.setItem(this._settingsKey, JSON.stringify(this.config));
    } catch {}
  },

  _restoreSettings() {
    try {
      const saved = localStorage.getItem(this._settingsKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(this.config, parsed);
      }
    } catch {}
  },

  _buildControls(panel) {
    panel.innerHTML = '';

    // Title
    const title = document.createElement('h1');
    title.textContent = 'V-Wall Drums';
    title.className = 'panel-title';
    panel.appendChild(title);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row';

    const launchBtn = document.createElement('button');
    launchBtn.textContent = 'Launch';
    launchBtn.className = 'btn btn-launch';
    launchBtn.addEventListener('click', () => this.onLaunch && this.onLaunch());
    btnRow.appendChild(launchBtn);

    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset';
    resetBtn.className = 'btn btn-reset';
    resetBtn.addEventListener('click', () => this.onReset && this.onReset());
    btnRow.appendChild(resetBtn);

    panel.appendChild(btnRow);

    // Mode & Shape
    this._addSection(panel, 'Mode', [
      this._createSelect('Shape', [
        { v: 'v', l: 'V-Shape' },
        { v: 'triangle', l: 'Triangle' },
        { v: 'square', l: 'Square' },
        { v: 'pentagon', l: 'Pentagon' },
        { v: 'hexagon', l: 'Hexagon' },
        { v: 'circle', l: 'Circle' },
        { v: 'star', l: 'Star' },
      ], this.config.shapeType || 'v', 'shapeType'),
      this._createSelect('Physics Mode', [
        { v: 'pendulum', l: 'Pendulum (Arc)' },
        { v: 'linear', l: 'Linear (Bounce)' },
      ], this.config.mode, 'mode'),
    ]);

    // Shared controls
    const isV = (this.config.shapeType || 'v') === 'v';
    const physicsControls = [];
    if (isV) {
      physicsControls.push(this._createSlider('V Angle', 20, 160, 1, this.config.vAngle, 'vAngle', '°'));
    } else {
      physicsControls.push(this._createSlider('Rotation', 0, 360, 1, this.config.shapeRotation || 0, 'shapeRotation', '°'));
    }
    this._addSection(panel, 'Physics', [
      ...physicsControls,
      this._createSlider('Balls', 1, 30, 1, this.config.numBalls, 'numBalls', ''),
      this._createSlider('Ball Size', 3, 15, 1, this.config.ballRadius, 'ballRadius', 'px'),
      this._createSlider('Launch Angle', -90, 90, 1, this.config.launchAngle, 'launchAngle', '°'),
      this._createSlider('Spread', 0, 100, 1, this.config.spread, 'spread', '%'),
      this._createSlider('Wall Curve', -100, 100, 1, this.config.wallCurve * 100, 'wallCurve', '', 0.01),
      this._createSlider('Wall Bounce', 50, 150, 1, this.config.wallBounce * 100, 'wallBounce', '%', 0.01),
      this._createSlider('Friction', 0, 100, 1, this.config.friction * 100, 'friction', '%', 0.01),
    ]);

    // Pendulum-specific
    this._addSection(panel, 'Pendulum', [
      this._createSlider('Min Radius', 10, 200, 5, this.config.minRadius, 'minRadius', 'px'),
      this._createSlider('Radius Step', 5, 200, 1, this.config.radiusStep, 'radiusStep', 'px'),
      this._createSlider('Swing Speed', 0.05, 10, 0.05, this.config.swingSpeed, 'swingSpeed', ''),
      this._createSlider('Speed Mode', 0, 100, 1, this.config.speedMode, 'speedMode', '%'),
    ]);

    // Linear-specific
    this._addSection(panel, 'Linear', [
      this._createSlider('Speed', 50, 800, 10, this.config.ballSpeed, 'ballSpeed', 'px/s'),
      this._createSlider('Gravity', 0, 500, 10, this.config.gravity, 'gravity', ''),
      this._createSlider('Start Height', 0, 500, 10, this.config.startHeight, 'startHeight', 'px'),
      this._createSlider('Stagger Height', 0, 50, 1, this.config.staggerHeight, 'staggerHeight', 'px'),
      this._createSlider('Side Speed', -300, 300, 10, this.config.sideSpeed, 'sideSpeed', 'px/s'),
      this._createSlider('Vertical Speed', -300, 300, 10, this.config.verticalSpeed, 'verticalSpeed', 'px/s'),
    ]);

    this._addSection(panel, 'Music', [
      this._createSelect('Base Note', [
        'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
      ], this.config.baseNote, 'baseNote'),
      this._createSelect('Octave', ['2', '3', '4', '5'], String(this.config.baseOctave), 'baseOctave', true),
      this._createSlider('Octave Range', 1, 4, 1, this.config.octaveRange, 'octaveRange', ''),
      this._createSelect('Scale', [
        { v: 'pentatonic', l: 'Pentatonic' },
        { v: 'major', l: 'Major' },
        { v: 'minor', l: 'Minor' },
        { v: 'chromatic', l: 'Chromatic' },
        { v: 'hirajoshi', l: 'Hirajoshi' },
        { v: 'wholetone', l: 'Whole Tone' },
      ], this.config.scale, 'scale'),
      this._createSelect('Instrument', [
        { v: 'hangDrum', l: 'Hang Drum' },
        { v: 'marimba', l: 'Marimba' },
        { v: 'bell', l: 'Bell' },
        { v: 'kalimba', l: 'Kalimba' },
        { v: 'steelDrum', l: 'Steel Drum' },
        { v: 'glockenspiel', l: 'Glockenspiel' },
        { v: 'xylophone', l: 'Xylophone' },
        { v: 'vibraphone', l: 'Vibraphone' },
        { v: 'musicBox', l: 'Music Box' },
        { v: 'sitar', l: 'Sitar' },
      ], this.config.instrument, 'instrument'),
    ]);

    // Instrument Zones section (V-shape)
    if (isV) {
      this._buildZonesUI(panel);
    }

    // Per-wall instruments (polygon shapes)
    if (!isV && App.Physics.walls.length > 0) {
      this._buildWallInstrumentsUI(panel);
    }

    this._addSection(panel, 'Audio', [
      this._createSlider('Reverb', 0, 100, 1, this.config.reverb * 100, 'reverb', '%', 0.01),
      this._createSlider('Volume', 0, 100, 1, this.config.volume * 100, 'volume', '%', 0.01),
    ]);

    this._addSection(panel, 'Spatial Audio', [
      this._createSelect('Mode', [
        { v: 'off', l: 'Off (Mono)' },
        { v: 'stereo', l: 'Stereo (ILD+ITD)' },
        { v: 'hrtf', l: 'HRTF (8D)' },
      ], this.config.spatialMode, 'spatialMode'),
      this._createSlider('Stereo Width', 0, 100, 1, this.config.stereoWidth * 100, 'stereoWidth', '%', 0.01),
      this._createSlider('Pan (ILD)', 0, 100, 1, this.config.panAmount * 100, 'panAmount', '%', 0.01),
      this._createSlider('Delay (ITD)', 0, 100, 1, this.config.itdAmount * 100, 'itdAmount', '%', 0.01),
      this._createSlider('Max Delay', 0.1, 30, 0.1, this.config.maxItd, 'maxItd', 'ms'),
      this._createSlider('HRTF Spread', 0.5, 10, 0.1, this.config.hrtfSpread, 'hrtfSpread', 'm'),
      this._createSlider('HRTF Depth', 0.5, 10, 0.1, this.config.hrtfDepth, 'hrtfDepth', 'm'),
    ]);

    // Continuous toggle
    const contRow = document.createElement('div');
    contRow.className = 'control-row toggle-row';
    const contLabel = document.createElement('label');
    contLabel.className = 'toggle-label';
    const contCheck = document.createElement('input');
    contCheck.type = 'checkbox';
    contCheck.checked = this.config.continuous;
    contCheck.addEventListener('change', () => {
      this.config.continuous = contCheck.checked;
      this.onChange && this.onChange('continuous', this.config.continuous);
    });
    contLabel.appendChild(contCheck);
    contLabel.appendChild(document.createTextNode(' Continuous'));
    contRow.appendChild(contLabel);
    panel.appendChild(contRow);

    // Presets section
    this._buildPresetsUI(panel);
  },

  // --- Per-wall instruments (polygon shapes) ---
  _buildWallInstrumentsUI(panel) {
    const section = document.createElement('div');
    section.className = 'section';
    const h2 = document.createElement('h2');
    h2.textContent = 'Wall Instruments';
    section.appendChild(h2);

    const walls = App.Physics.walls;
    const hueMap = App.Renderer.zoneHueMap;

    walls.forEach((wall, i) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;gap:4px;align-items:center;margin-bottom:4px;';

      // Wall number label
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:11px;color:#8b949e;width:16px;';
      lbl.textContent = (i + 1);
      wrap.appendChild(lbl);

      // Mute
      const muteBtn = document.createElement('button');
      muteBtn.textContent = wall.muted ? '\u{1F507}' : '\u{1F50A}';
      muteBtn.style.cssText = 'width:22px;height:20px;padding:0;background:' + (wall.muted ? '#da3633' : '#30363d') + ';color:#c9d1d9;border:none;border-radius:3px;cursor:pointer;font-size:11px;';
      muteBtn.addEventListener('click', () => {
        wall.muted = !wall.muted;
        this._buildWallInstrumentsUI_refresh(section, panel);
      });
      wrap.appendChild(muteBtn);

      // Instrument select
      const sel = document.createElement('select');
      sel.style.cssText = 'flex:1;padding:3px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;border-radius:3px;font-size:11px;';
      // "Default" option
      const defOpt = document.createElement('option');
      defOpt.value = '';
      defOpt.textContent = '(global)';
      defOpt.selected = !wall.instrument;
      sel.appendChild(defOpt);
      for (const opt of this._instrumentOptions) {
        const o = document.createElement('option');
        o.value = opt.v;
        o.textContent = opt.l;
        o.selected = opt.v === wall.instrument;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => {
        wall.instrument = sel.value || null;
        this.onChange && this.onChange('wallInstruments', null);
      });
      wrap.appendChild(sel);

      // Volume
      const vol = document.createElement('input');
      vol.type = 'range';
      vol.min = 0; vol.max = 100; vol.value = Math.round((wall.volume || 1) * 100);
      vol.style.cssText = 'width:40px;';
      vol.addEventListener('input', () => {
        wall.volume = parseInt(vol.value) / 100;
      });
      wrap.appendChild(vol);

      section.appendChild(wrap);
    });

    panel.appendChild(section);
  },

  _buildWallInstrumentsUI_refresh(section, panel) {
    const parent = section.parentNode;
    const next = section.nextSibling;
    parent.removeChild(section);
    const newSection = document.createElement('div');
    // Rebuild inline
    const walls = App.Physics.walls;
    newSection.className = 'section';
    const h2 = document.createElement('h2');
    h2.textContent = 'Wall Instruments';
    newSection.appendChild(h2);
    // Just rebuild the panel
    this._buildControls(parent);
  },

  // --- Instrument list ---
  _instrumentOptions: [
    { v: 'hangDrum', l: 'Hang Drum' },
    { v: 'marimba', l: 'Marimba' },
    { v: 'bell', l: 'Bell' },
    { v: 'kalimba', l: 'Kalimba' },
    { v: 'steelDrum', l: 'Steel Drum' },
    { v: 'glockenspiel', l: 'Glockenspiel' },
    { v: 'xylophone', l: 'Xylophone' },
    { v: 'vibraphone', l: 'Vibraphone' },
    { v: 'musicBox', l: 'Music Box' },
    { v: 'sitar', l: 'Sitar' },
  ],

  // --- Instrument Zones ---
  _buildZonesUI(panel) {
    const section = document.createElement('div');
    section.className = 'section';
    const h2 = document.createElement('h2');
    h2.textContent = 'Instrument Zones';
    section.appendChild(h2);

    // Toggle: single instrument vs zones
    const toggleRow = document.createElement('div');
    toggleRow.className = 'control-row toggle-row';
    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle-label';
    const toggleCheck = document.createElement('input');
    toggleCheck.type = 'checkbox';
    toggleCheck.checked = this.config.useZones;
    toggleCheck.addEventListener('change', () => {
      this.config.useZones = toggleCheck.checked;
      zoneContainer.style.display = toggleCheck.checked ? 'block' : 'none';
      this.onChange && this.onChange('useZones', this.config.useZones);
    });
    toggleLabel.appendChild(toggleCheck);
    toggleLabel.appendChild(document.createTextNode(' Enable Zones'));
    toggleRow.appendChild(toggleLabel);
    section.appendChild(toggleRow);

    // Zone container (hidden when zones disabled)
    const zoneContainer = document.createElement('div');
    zoneContainer.id = 'zone-container';
    zoneContainer.style.display = this.config.useZones ? 'block' : 'none';

    // Visual zone bar + zone list
    this._renderZoneEditor(zoneContainer);

    section.appendChild(zoneContainer);
    panel.appendChild(section);
  },

  _renderZoneEditor(container) {
    container.innerHTML = '';
    const zones = this.config.instrumentZones;

    // Visual bar showing zones as colored segments
    const bar = document.createElement('div');
    bar.style.cssText = 'width:100%;height:30px;border-radius:4px;overflow:hidden;display:flex;margin-bottom:10px;border:1px solid #30363d;';

    const hueMap = {
      hangDrum: 30, marimba: 20, bell: 200, kalimba: 50,
      steelDrum: 180, glockenspiel: 280, xylophone: 10,
      vibraphone: 160, musicBox: 310, sitar: 60,
    };

    let prevTo = 0;
    zones.forEach((zone, i) => {
      const width = ((zone.to - prevTo) * 100);
      const seg = document.createElement('div');
      const hue = hueMap[zone.instrument] || 0;
      seg.style.cssText = `flex:0 0 ${width}%;background:hsl(${hue},60%,35%);display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;overflow:hidden;white-space:nowrap;padding:0 2px;`;
      seg.textContent = this._instrumentOptions.find(o => o.v === zone.instrument)?.l || zone.instrument;
      bar.appendChild(seg);
      prevTo = zone.to;
    });
    container.appendChild(bar);

    // Zone entries
    prevTo = 0;
    zones.forEach((zone, i) => {
      // Ensure volume exists
      if (zone.volume === undefined) zone.volume = 1.0;

      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin-bottom:4px;padding:6px;background:#0d1117;border-radius:6px;border:1px solid #21262d;cursor:grab;transition:opacity 0.15s,border-color 0.15s;';
      wrap.draggable = true;
      wrap.dataset.zoneIndex = i;

      wrap.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', i);
        wrap.style.opacity = '0.4';
      });
      wrap.addEventListener('dragend', () => {
        wrap.style.opacity = '1';
      });
      wrap.addEventListener('dragover', (e) => {
        e.preventDefault();
        wrap.style.borderColor = '#58a6ff';
      });
      wrap.addEventListener('dragleave', () => {
        wrap.style.borderColor = '#21262d';
      });
      wrap.addEventListener('drop', (e) => {
        e.preventDefault();
        wrap.style.borderColor = '#21262d';
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
        const toIdx = i;
        if (fromIdx !== toIdx) {
          // Swap instruments and volumes, keep boundary positions
          const fromInst = zones[fromIdx].instrument;
          const fromVol = zones[fromIdx].volume;
          zones[fromIdx].instrument = zones[toIdx].instrument;
          zones[fromIdx].volume = zones[toIdx].volume;
          zones[toIdx].instrument = fromInst;
          zones[toIdx].volume = fromVol;
          this._renderZoneEditor(container);
          this.onChange && this.onChange('instrumentZones', this.config.instrumentZones);
        }
      });

      // Row 1: drag handle + instrument + boundary + remove
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:4px;align-items:center;';

      // Drag handle
      const handle = document.createElement('span');
      handle.textContent = '⠿';
      handle.style.cssText = 'color:#484f58;font-size:14px;cursor:grab;user-select:none;';
      row.appendChild(handle);

      // Mute button
      if (zone.muted === undefined) zone.muted = false;
      const muteBtn = document.createElement('button');
      muteBtn.textContent = zone.muted ? '🔇' : '🔊';
      muteBtn.style.cssText = 'width:24px;height:22px;padding:0;background:' + (zone.muted ? '#da3633' : '#30363d') + ';color:#c9d1d9;border:none;border-radius:4px;cursor:pointer;font-size:12px;line-height:1;';
      muteBtn.addEventListener('click', () => {
        zone.muted = !zone.muted;
        this._renderZoneEditor(container);
        this.onChange && this.onChange('instrumentZones', this.config.instrumentZones);
      });
      row.appendChild(muteBtn);

      // Instrument select
      const sel = document.createElement('select');
      sel.style.cssText = 'flex:1;padding:4px;background:#161b22;color:#c9d1d9;border:1px solid #30363d;border-radius:4px;font-size:12px;';
      for (const opt of this._instrumentOptions) {
        const o = document.createElement('option');
        o.value = opt.v;
        o.textContent = opt.l;
        o.selected = opt.v === zone.instrument;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => {
        zone.instrument = sel.value;
        this._renderZoneEditor(container);
        this.onChange && this.onChange('instrumentZones', this.config.instrumentZones);
      });
      row.appendChild(sel);

      // Boundary slider (except last zone which always ends at 1.0)
      if (i < zones.length - 1) {
        const pct = document.createElement('input');
        pct.type = 'range';
        pct.min = Math.round(prevTo * 100) + 5;
        pct.max = Math.round((zones[i + 1]?.to || 1) * 100) - 5;
        pct.value = Math.round(zone.to * 100);
        pct.style.cssText = 'width:55px;';
        pct.addEventListener('input', () => {
          zone.to = parseInt(pct.value) / 100;
          this._renderZoneEditor(container);
          this.onChange && this.onChange('instrumentZones', this.config.instrumentZones);
        });
        row.appendChild(pct);

        const lbl = document.createElement('span');
        lbl.style.cssText = 'font-size:11px;color:#8b949e;width:28px;text-align:right;';
        lbl.textContent = Math.round(zone.to * 100) + '%';
        row.appendChild(lbl);
      } else {
        const lbl = document.createElement('span');
        lbl.style.cssText = 'font-size:11px;color:#8b949e;width:85px;text-align:right;';
        lbl.textContent = '100%';
        row.appendChild(lbl);
      }

      // Remove button (only if more than 1 zone)
      if (zones.length > 1) {
        const rm = document.createElement('button');
        rm.textContent = '×';
        rm.style.cssText = 'width:22px;height:22px;padding:0;background:#30363d;color:#c9d1d9;border:none;border-radius:4px;cursor:pointer;font-size:14px;line-height:1;';
        rm.addEventListener('click', () => {
          zones.splice(i, 1);
          // Redistribute: last zone always ends at 1.0
          zones[zones.length - 1].to = 1.0;
          this._renderZoneEditor(container);
          this.onChange && this.onChange('instrumentZones', this.config.instrumentZones);
        });
        row.appendChild(rm);
      }

      wrap.appendChild(row);

      // Row 2: volume slider
      const volRow = document.createElement('div');
      volRow.style.cssText = 'display:flex;gap:4px;align-items:center;margin-top:4px;';
      const volLbl = document.createElement('span');
      volLbl.style.cssText = 'font-size:11px;color:#8b949e;width:24px;';
      volLbl.textContent = 'Vol';
      volRow.appendChild(volLbl);

      const volSlider = document.createElement('input');
      volSlider.type = 'range';
      volSlider.min = 0;
      volSlider.max = 100;
      volSlider.value = Math.round(zone.volume * 100);
      volSlider.style.cssText = 'flex:1;';
      const volVal = document.createElement('span');
      volVal.style.cssText = 'font-size:11px;color:#8b949e;width:28px;text-align:right;';
      volVal.textContent = Math.round(zone.volume * 100) + '%';
      volSlider.addEventListener('input', () => {
        zone.volume = parseInt(volSlider.value) / 100;
        volVal.textContent = volSlider.value + '%';
        this.onChange && this.onChange('instrumentZones', this.config.instrumentZones);
      });
      volRow.appendChild(volSlider);
      volRow.appendChild(volVal);
      wrap.appendChild(volRow);

      container.appendChild(wrap);
      prevTo = zone.to;
    });

    // Add zone button
    const addRow = document.createElement('div');
    addRow.style.cssText = 'margin-top:4px;margin-bottom:8px;';
    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Add Zone';
    addBtn.className = 'btn btn-reset';
    addBtn.style.cssText += 'width:100%;padding:6px;font-size:12px;';
    addBtn.addEventListener('click', () => {
      const lastZone = zones[zones.length - 1];
      const splitAt = lastZone.to - (lastZone.to - (zones.length > 1 ? zones[zones.length - 2].to : 0)) / 2;
      // Split the last zone
      lastZone.to = Math.round(splitAt * 100) / 100;
      zones.push({ instrument: 'bell', to: 1.0, volume: 1.0 });
      this._renderZoneEditor(container);
      this.onChange && this.onChange('instrumentZones', this.config.instrumentZones);
    });
    addRow.appendChild(addBtn);
    container.appendChild(addRow);

    // Blend slider
    const blendRow = this._createSlider('Blend', 0, 50, 1, this.config.zoneBlend * 100, 'zoneBlend', '%', 0.01);
    container.appendChild(blendRow);
  },

  // --- Preset system ---

  _storageKey: 'vwall-drums-presets',

  _getPresets() {
    try {
      return JSON.parse(localStorage.getItem(this._storageKey)) || {};
    } catch { return {}; }
  },

  _savePresets(presets) {
    localStorage.setItem(this._storageKey, JSON.stringify(presets));
  },

  _buildPresetsUI(panel) {
    const section = document.createElement('div');
    section.className = 'section';
    const h2 = document.createElement('h2');
    h2.textContent = 'Presets';
    section.appendChild(h2);

    // Preset selector
    const selectRow = document.createElement('div');
    selectRow.className = 'control-row';
    const presetSelect = document.createElement('select');
    presetSelect.id = 'preset-select';
    this._populatePresetSelect(presetSelect);
    selectRow.appendChild(presetSelect);
    section.appendChild(selectRow);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row';

    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load';
    loadBtn.className = 'btn btn-reset';
    loadBtn.addEventListener('click', () => this._loadPreset());
    btnRow.appendChild(loadBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'btn btn-reset';
    deleteBtn.addEventListener('click', () => this._deletePreset());
    btnRow.appendChild(deleteBtn);

    section.appendChild(btnRow);

    // Save row
    const saveRow = document.createElement('div');
    saveRow.className = 'btn-row';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'preset-name';
    nameInput.placeholder = 'Preset name...';
    nameInput.style.cssText = 'flex:1;padding:6px 8px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;border-radius:6px;font-size:13px;outline:none;';
    saveRow.appendChild(nameInput);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'btn btn-launch';
    saveBtn.style.flex = '0 0 60px';
    saveBtn.addEventListener('click', () => this._savePreset());
    saveRow.appendChild(saveBtn);

    section.appendChild(saveRow);
    panel.appendChild(section);
  },

  _populatePresetSelect(select) {
    if (!select) select = document.getElementById('preset-select');
    if (!select) return;
    select.innerHTML = '';

    // Built-in presets
    const builtins = this._builtinPresets();
    const userPresets = this._getPresets();

    if (Object.keys(builtins).length > 0) {
      const group1 = document.createElement('optgroup');
      group1.label = 'Built-in';
      for (const name of Object.keys(builtins)) {
        const o = document.createElement('option');
        o.value = 'builtin:' + name;
        o.textContent = name;
        group1.appendChild(o);
      }
      select.appendChild(group1);
    }

    if (Object.keys(userPresets).length > 0) {
      const group2 = document.createElement('optgroup');
      group2.label = 'My Presets';
      for (const name of Object.keys(userPresets)) {
        const o = document.createElement('option');
        o.value = 'user:' + name;
        o.textContent = name;
        group2.appendChild(o);
      }
      select.appendChild(group2);
    }
  },

  _savePreset() {
    const nameInput = document.getElementById('preset-name');
    const name = (nameInput.value || '').trim();
    if (!name) return;

    const presets = this._getPresets();
    presets[name] = JSON.parse(JSON.stringify(this.config));
    this._savePresets(presets);
    nameInput.value = '';
    this._populatePresetSelect();
  },

  _loadPreset() {
    const select = document.getElementById('preset-select');
    if (!select || !select.value) return;

    const [type, name] = [select.value.split(':')[0], select.value.substring(select.value.indexOf(':') + 1)];
    let preset;
    if (type === 'builtin') {
      preset = this._builtinPresets()[name];
    } else {
      preset = this._getPresets()[name];
    }
    if (!preset) return;

    // Reset to defaults first, then apply preset (ensures clean state)
    const defaults = JSON.parse(JSON.stringify(this._defaults));
    Object.assign(this.config, defaults, preset);
    // Rebuild the full UI to reflect new values
    const panel = document.getElementById('panel');
    this._buildControls(panel);
    // Notify all changes
    for (const key of Object.keys(this.config)) {
      this.onChange && this.onChange(key, this.config[key]);
    }
  },

  _deletePreset() {
    const select = document.getElementById('preset-select');
    if (!select || !select.value) return;
    if (!select.value.startsWith('user:')) return; // can't delete built-ins

    const name = select.value.substring(5);
    const presets = this._getPresets();
    delete presets[name];
    this._savePresets(presets);
    this._populatePresetSelect();
  },

  _builtinPresets() {
    return {
      'Classic Fan': {
        mode: 'pendulum', vAngle: 60, numBalls: 12, ballRadius: 6,
        launchAngle: 0, spread: 100, wallCurve: 0,
        minRadius: 30, radiusStep: 30, swingSpeed: 2, speedMode: 0,
        baseNote: 'D', baseOctave: 3, octaveRange: 2,
        scale: 'pentatonic', instrument: 'hangDrum',
        reverb: 0.3, volume: 0.7, stereoWidth: 0.5, continuous: false,
      },
      'Slow Meditation': {
        mode: 'pendulum', vAngle: 80, numBalls: 8, ballRadius: 8,
        launchAngle: 0, spread: 100, wallCurve: 0,
        minRadius: 40, radiusStep: 40, swingSpeed: 0.3, speedMode: 50,
        baseNote: 'C', baseOctave: 3, octaveRange: 2,
        scale: 'pentatonic', instrument: 'hangDrum',
        reverb: 0.6, volume: 0.6, stereoWidth: 0.8, continuous: false,
      },
      'Music Box': {
        mode: 'pendulum', vAngle: 50, numBalls: 15, ballRadius: 4,
        launchAngle: 0, spread: 100, wallCurve: 0.3,
        minRadius: 20, radiusStep: 20, swingSpeed: 3, speedMode: 80,
        baseNote: 'C', baseOctave: 4, octaveRange: 2,
        scale: 'major', instrument: 'musicBox',
        reverb: 0.4, volume: 0.5, stereoWidth: 0.6, continuous: false,
      },
      'Steel Paradise': {
        mode: 'pendulum', vAngle: 90, numBalls: 10, ballRadius: 7,
        launchAngle: 15, spread: 100, wallCurve: 0.2,
        minRadius: 30, radiusStep: 35, swingSpeed: 1.5, speedMode: 30,
        baseNote: 'G', baseOctave: 3, octaveRange: 2,
        scale: 'major', instrument: 'steelDrum',
        reverb: 0.35, volume: 0.7, stereoWidth: 0.7, continuous: false,
      },
      'Temple Bells': {
        mode: 'pendulum', vAngle: 40, numBalls: 6, ballRadius: 10,
        launchAngle: 0, spread: 100, wallCurve: -0.3,
        minRadius: 50, radiusStep: 50, swingSpeed: 0.5, speedMode: 100,
        baseNote: 'E', baseOctave: 3, octaveRange: 3,
        scale: 'hirajoshi', instrument: 'bell',
        reverb: 0.7, volume: 0.5, stereoWidth: 0.9, continuous: false,
      },
      'Sitar Raga': {
        mode: 'pendulum', vAngle: 70, numBalls: 8, ballRadius: 6,
        launchAngle: -10, spread: 100, wallCurve: 0,
        minRadius: 35, radiusStep: 35, swingSpeed: 1.2, speedMode: 60,
        baseNote: 'D', baseOctave: 3, octaveRange: 2,
        scale: 'hirajoshi', instrument: 'sitar',
        reverb: 0.5, volume: 0.6, stereoWidth: 0.6, continuous: false,
      },
      'Chaos Bounce': {
        mode: 'linear', vAngle: 70, numBalls: 20, ballRadius: 5,
        ballSpeed: 400, gravity: 200, launchAngle: 0, spread: 100, wallCurve: 0,
        startHeight: 0, staggerHeight: 0, sideSpeed: 0, verticalSpeed: 0,
        baseNote: 'C', baseOctave: 3, octaveRange: 3,
        scale: 'chromatic', instrument: 'xylophone',
        reverb: 0.2, volume: 0.7, stereoWidth: 1.0, continuous: true,
      },
    };
  },

  _addSection(parent, title, controls) {
    const section = document.createElement('div');
    section.className = 'section';
    const h2 = document.createElement('h2');
    h2.textContent = title;
    section.appendChild(h2);
    for (const ctrl of controls) {
      section.appendChild(ctrl);
    }
    parent.appendChild(section);
  },

  _createSlider(label, min, max, step, value, key, unit, multiplier) {
    const row = document.createElement('div');
    row.className = 'control-row';

    const lbl = document.createElement('label');
    lbl.textContent = label;

    const valSpan = document.createElement('span');
    valSpan.className = 'val';
    valSpan.textContent = value + (unit || '');

    const input = document.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;

    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      const actual = multiplier ? v * multiplier : v;
      valSpan.textContent = v + (unit || '');
      this.config[key] = actual;
      this.onChange && this.onChange(key, actual);
    });

    const header = document.createElement('div');
    header.className = 'control-header';
    header.appendChild(lbl);
    header.appendChild(valSpan);
    row.appendChild(header);
    row.appendChild(input);
    return row;
  },

  _createSelect(label, options, value, key, isNumeric) {
    const row = document.createElement('div');
    row.className = 'control-row';

    const lbl = document.createElement('label');
    lbl.textContent = label;

    const select = document.createElement('select');
    for (const opt of options) {
      const o = document.createElement('option');
      if (typeof opt === 'object') {
        o.value = opt.v;
        o.textContent = opt.l;
        o.selected = opt.v === value;
      } else {
        o.value = opt;
        o.textContent = opt;
        o.selected = opt === value;
      }
      select.appendChild(o);
    }

    select.addEventListener('change', () => {
      const v = isNumeric ? parseInt(select.value) : select.value;
      this.config[key] = v;
      this.onChange && this.onChange(key, v);
    });

    row.appendChild(lbl);
    row.appendChild(select);
    return row;
  }
};
