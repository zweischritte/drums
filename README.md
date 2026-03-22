# V-Wall Drums

A browser-based generative music simulation where colored balls bounce inside a V-shaped wall, producing synthesized percussion sounds on each impact. Inspired by [@project.jdm](https://www.instagram.com/project.jdm/) on Instagram.

**No dependencies. No build tools. Pure HTML/CSS/JS + Web Audio API.**

## Quick Start

```bash
# Option 1: Local server
python3 -m http.server 8742 --directory .
# Open http://localhost:8742

# Option 2: Direct file
open index.html
```

Click **Launch** to start the simulation.

## Architecture

```
drums/
├── index.html          # Entry point, layout, embedded CSS (responsive)
└── js/
    ├── scales.js       # Musical scale definitions, MIDI-to-frequency mapping
    ├── audio.js        # Web Audio API synthesis engine, 10 instruments, spatial audio
    ├── physics.js      # 2 physics modes, collision detection, curved walls
    ├── renderer.js     # Canvas rendering: background, walls, balls, trails, flashes
    ├── ui.js           # Full control panel, presets, instrument zones
    └── main.js         # Animation loop, event dispatch, config orchestration
```

All JS files use a shared `window.App` namespace. No ES modules (avoids CORS issues with `file://`). Load order matters: `scales → audio → physics → renderer → ui → main`.

---

## Physics Modes

### Pendulum (Arc)
Each ball swings along a circular arc at a fixed radius from the V's vertex. When the arc reaches a wall, the ball bounces back. The radius determines the pitch — inner balls (short radius) produce low notes, outer balls (long radius) produce high notes.

- **Collision detection**: Precomputed polar lookup table from the bezier wall curve. For each ball radius, the wall's boundary angle is interpolated from 60 sampled points along the quadratic bezier.
- **Speed modes**: Blends between same angular velocity (outer balls faster) and same tangential velocity (inner balls swing faster).

### Linear (Bounce)
Balls launch from configurable positions with velocity vectors. Standard 2D physics: gravity, friction, wall reflection. Walls are approximated as 40 line segments from the bezier curve for accurate curved-wall collision.

- **Collision detection**: Circle-vs-line-segment for each of the 40 bezier segments per wall. Best (deepest penetration) collision is resolved.
- **Reflection**: Velocity reflected off the segment's local normal, scaled by wall bounce factor.

---

## Audio Engine

### Synthesis
All sounds are generated in real-time using the Web Audio API — no audio samples. Each instrument preset creates a network of `OscillatorNode`, `GainNode`, `BiquadFilterNode`, and `BufferSource` nodes.

### Instruments (10)

| Instrument | Technique | Decay |
|---|---|---|
| **Hang Drum** | 2 detuned sines + octave/fifth harmonics, bandpass filter, pitch bend on attack | 3s |
| **Marimba** | Sine + 4x overtone, lowpass sweep | 1.2s |
| **Bell** | Inharmonic partials (1x, 2.76x, 5.4x, 8.93x) | 5s |
| **Kalimba** | Sine + 3x, noise-burst pluck transient | 0.8s |
| **Steel Drum** | Sine + triangle harmonics, pitch wobble | 1.8s |
| **Glockenspiel** | Pure sine partials with slight inharmonicity, highpass sparkle | 4s |
| **Xylophone** | Sine + 3x + square click transient, lowpass sweep | 0.6s |
| **Vibraphone** | Sine harmonics with LFO tremolo (5.5 Hz) | 4s |
| **Music Box** | Thin metallic pluck, strong 2x + 5x overtones, highpass | 2s |
| **Sitar** | Detuned sawtooths, sympathetic resonance, narrow bandpass | 3s |

### Signal Chain
```
Oscillators → [Filter] → Output Gain → Spatial Panner → Dry Gain ──→ Master Gain → Compressor → Destination
                                                        └──→ Convolver (reverb) → Reverb Gain ─┘
```

### Voice Management
- Max 128 simultaneous voices
- Each voice tracked with `onended` callback + safety timeout fallback
- Voices auto-released after note duration + 0.5s even if callback fails

### Reverb
Synthetic convolution reverb generated at init time — a 2.5s exponentially-decaying white noise impulse response in a stereo `AudioBuffer`, applied via `ConvolverNode`.

---

## Spatial Audio

Three modes available:

### Off (Mono)
All sounds play from center. No spatial processing.

### Stereo (ILD + ITD)
Manual binaural rendering with two components:

- **ILD (Interaural Level Difference)**: `StereoPannerNode` — volume panning based on which wall was hit (left wall → left speaker, right wall → right speaker). Amount controlled by Pan slider.
- **ITD (Interaural Time Difference)**: `DelayNode` pair — the far ear receives the sound up to 30ms later. Signal is split to stereo channels, each routed through an independent delay, then merged. Amount controlled by Delay slider, ceiling by Max Delay.

### HRTF (8D)
Browser-native Head-Related Transfer Function via `PannerNode` with `panningModel: 'HRTF'`:

- **X axis** (left/right): Wall side × HRTF Spread
- **Y axis** (up/down): Ball's normalized distance × spread × 0.3
- **Z axis** (front/back): Mapped from normalized distance via HRTF Depth — inner balls in front, outer balls behind

The browser applies frequency-dependent binaural filtering, ILD, ITD, and head-shadow effects automatically. Best experienced with headphones.

---

## Instrument Zones

Instead of a single global instrument, you can assign different instruments to different height ranges:

- **Enable Zones** toggle activates the zone system
- Each zone defines: instrument, boundary position (% of height range), volume, mute state
- **Visual bar** shows color-coded zone segments
- **Walls render in zone colors** when zones are enabled
- **Drag-and-drop reordering** via drag handles (swaps instruments/volumes, keeps boundaries)
- **Blend slider** (0–50%): Crossfade width between adjacent zones. In blend regions, both instruments play simultaneously with weighted volumes.
- **Mute button** per zone: Silences the zone without removing it

---

## Wall Geometry

### V-Shape
Two walls emanating from a shared vertex. Opening angle configurable (20°–160°).

### Wall Curve
Walls rendered as quadratic bezier curves. Control point offset perpendicular to the wall midpoint:
- **Positive** = convex (walls bow outward)
- **Negative** = concave (walls bow inward)
- **Zero** = straight lines

Physics collision detection uses the actual curve (40 segments for linear mode, polar lookup for pendulum mode).

---

## Configurable Parameters

### Physics (shared)
| Parameter | Range | Description |
|---|---|---|
| V Angle | 20–160° | Opening angle of the V-shaped wall |
| Balls | 1–30 | Number of balls |
| Ball Size | 3–15 px | Ball radius |
| Launch Angle | -90 to 90° | Direction of launch (0° = straight up) |
| Spread | 0–100% | 0% = all same angle, 100% = full fan across V |
| Wall Curve | -100 to 100 | Bezier curve amount (negative = concave, positive = convex) |
| Wall Bounce | 50–150% | Energy on bounce (<100% = absorb, 100% = elastic, >100% = accelerate) |
| Friction | 0–100% | Space friction (exponential velocity decay) |

### Pendulum Mode
| Parameter | Range | Description |
|---|---|---|
| Min Radius | 10–200 px | Distance of innermost ball from vertex |
| Radius Step | 5–200 px | Distance increment between balls |
| Swing Speed | 0.05–10 | Base angular velocity (rad/s) |
| Speed Mode | 0–100% | 0% = same angular speed, 100% = same tangential speed |

### Linear Mode
| Parameter | Range | Description |
|---|---|---|
| Speed | 50–800 px/s | Launch velocity |
| Gravity | 0–500 | Downward acceleration |
| Start Height | 0–500 px | Spawn point above vertex |
| Stagger Height | 0–50 px | Vertical spacing between ball start positions |
| Side Speed | -300 to 300 px/s | Initial horizontal velocity |
| Vertical Speed | -300 to 300 px/s | Initial vertical velocity |

### Music
| Parameter | Options | Description |
|---|---|---|
| Base Note | C through B | Root note of the scale |
| Octave | 2–5 | Starting octave |
| Octave Range | 1–4 | How many octaves the pitch spans |
| Scale | Pentatonic, Major, Minor, Chromatic, Hirajoshi, Whole Tone | Note selection |
| Instrument | 10 presets | Global instrument (when zones disabled) |

### Audio
| Parameter | Range | Description |
|---|---|---|
| Reverb | 0–100% | Convolution reverb wet amount |
| Volume | 0–100% | Master output level |

### Spatial Audio
| Parameter | Range | Description |
|---|---|---|
| Mode | Off / Stereo / HRTF | Spatial processing mode |
| Stereo Width | 0–100% | Overall pan amount (stereo mode) |
| Pan (ILD) | 0–100% | Volume difference between ears |
| Delay (ITD) | 0–100% | Interaural time delay amount |
| Max Delay | 0.1–30 ms | Maximum ITD delay time |
| HRTF Spread | 0.5–10 m | 3D positioning spread (HRTF mode) |
| HRTF Depth | 0.5–10 m | Front-back depth mapping (HRTF mode) |

---

## Presets

### Built-in Presets
- **Classic Fan** — Default pendulum with hang drum
- **Slow Meditation** — Slow swings, pentatonic, heavy reverb
- **Music Box** — Fast, many balls, major scale, music box timbre
- **Steel Paradise** — Caribbean steel drum, wide V
- **Temple Bells** — Slow bells, hirajoshi scale, narrow V
- **Sitar Raga** — Sitar with hirajoshi scale
- **Chaos Bounce** — Linear mode, 20 balls, gravity, xylophone, chromatic

### User Presets
- Saved to `localStorage` under key `vwall-drums-presets`
- Full config snapshot including zones, spatial settings, physics params
- Loading resets to defaults first, then applies preset (clean state)

### Auto-Persist
All settings auto-save to `localStorage` on every change (key: `vwall-drums-settings`). Restored on page reload.

---

## Rendering

- **Canvas API** with `devicePixelRatio` scaling for Retina displays
- **Background**: Dark green (#0a2a1a) with radial gradient depth and procedural 128x128 noise pattern overlay
- **Walls**: Quadratic bezier curves with 8px glow + 3px main stroke. Zone-colored segments when zones enabled (80 segments per wall).
- **Balls**: Radial gradient fill (lighter center, saturated edge) for 3D appearance
- **Trails**: Linear gradient lines from each ball's origin point to current position
- **Collision flashes**: Expanding radial gradient circles, 250ms lifetime, auto-cleaned

---

## Mobile Support

- Responsive layout: sidebar panel on desktop (280px), bottom drawer on mobile (<768px)
- Touch-optimized controls with `touch-action: manipulation`
- Panel toggle button (bottom-right circle) on mobile viewports

---

## Browser Requirements

- Modern browser with Web Audio API support
- HRTF mode requires `PannerNode` with HRTF support (Chrome, Firefox, Safari, Edge)
- Best experienced with headphones (especially HRTF mode)
