# V-Wall Drums — Autonomous Research Program

## Vision
Evolve from a 2D two-wall simulation into a configurable multi-dimensional acoustic space where arbitrary wall geometries produce generative music. The space itself becomes the instrument.

## Current State (Generation 0)
- 2D canvas with V-shaped wall (2 walls from shared vertex)
- Pendulum and linear physics modes
- 10 synthesized instruments with zone mapping
- Bezier-curved walls with polar collision
- Spatial audio (stereo ILD/ITD + HRTF)
- Preset system with localStorage persistence

## Research Directions (prioritized)

### Phase 1: Multi-Wall Geometry
- Support N walls, not just 2
- Walls can be placed anywhere, at any angle
- Wall editor: click to place vertices, drag to adjust
- Predefined shapes: triangle, square, pentagon, hexagon, circle, star
- Each wall can have its own instrument/zone assignment
- Each wall can have its own curve amount
- Ball sources can be placed anywhere (not just at vertex)

### Phase 2: Room Acoustics
- Enclosed spaces (rooms) where balls bounce inside
- Wall absorption coefficients (some walls absorb more)
- Resonance — certain room dimensions amplify certain frequencies
- Echo/delay based on room size
- Multiple ball sources at different positions

### Phase 3: 3D Space
- WebGL rendering for true 3D
- Balls moving in 3D space
- 3D wall planes
- Full HRTF spatial audio matching 3D positions
- Camera controls (orbit, zoom, pan)

### Phase 4: Generative Composition
- Sequencer mode — timed ball launches
- Pattern recording and playback
- Multiple spaces connected (balls travel between rooms)
- MIDI output for external instruments
- Recording/export to audio file

## Experiment Protocol

Each experiment follows this loop:

1. **Propose**: Describe the change and expected outcome
2. **Implement**: Code the change
3. **Test**: Verify visually and auditorily in browser
4. **Evaluate**: Does it work? Does it sound good? Is it stable?
5. **Decision**: Keep (commit) or discard (revert)
6. **Log**: Record in results.tsv

### Metrics (subjective, assessed via screenshot + code review)
- **Functionality**: Does the feature work without breaking existing features?
- **Audio quality**: Do new geometries produce interesting/musical sounds?
- **Visual quality**: Does the rendering look good?
- **Performance**: Does it maintain 60fps with 30 balls?
- **Complexity**: Is the code clean and maintainable?

### Rules
- Each experiment should be a focused, atomic change
- Test after each change — don't accumulate untested code
- If a change breaks existing features, revert immediately
- Commit working improvements to the branch
- Log all experiments (kept and discarded) in results.tsv

## File Scope
- `js/physics.js` — wall geometry, collision detection, ball dynamics
- `js/renderer.js` — canvas/WebGL rendering
- `js/audio.js` — sound synthesis and spatial audio
- `js/ui.js` — configuration panel
- `js/main.js` — orchestration
- `js/scales.js` — musical scales (rarely modified)
- `index.html` — layout and styles

## Technical Constraints
- Pure HTML/CSS/JS — no build tools, no frameworks
- Must work by opening index.html or via simple HTTP server
- Web Audio API for sound (no external audio libraries)
- Canvas 2D for now, WebGL for Phase 3
- Mobile-responsive UI
- Settings auto-persist to localStorage
