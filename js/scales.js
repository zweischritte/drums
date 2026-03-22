window.App = window.App || {};

App.Scales = {
  NOTE_NAMES: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],

  SCALE_DEFS: {
    pentatonic: [0, 2, 4, 7, 9],
    major:      [0, 2, 4, 5, 7, 9, 11],
    minor:      [0, 2, 3, 5, 7, 8, 10],
    chromatic:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    hirajoshi:  [0, 2, 3, 7, 8],
    wholetone:  [0, 2, 4, 6, 8, 10],
  },

  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  },

  noteNameToMidi(name, octave) {
    const idx = this.NOTE_NAMES.indexOf(name);
    if (idx === -1) return 60;
    return (octave + 1) * 12 + idx;
  },

  buildScale(baseNote, baseOctave, octaveRange, scaleName) {
    const intervals = this.SCALE_DEFS[scaleName] || this.SCALE_DEFS.pentatonic;
    const baseMidi = this.noteNameToMidi(baseNote, baseOctave);
    const freqs = [];

    for (let oct = 0; oct < octaveRange; oct++) {
      for (const interval of intervals) {
        const midi = baseMidi + oct * 12 + interval;
        freqs.push(this.midiToFreq(midi));
      }
    }
    // Add the root of the next octave for completeness
    freqs.push(this.midiToFreq(baseMidi + octaveRange * 12));

    return freqs;
  },

  distanceToNote(normalizedDist, scaleFreqs) {
    if (!scaleFreqs.length) return 440;
    const idx = Math.round(normalizedDist * (scaleFreqs.length - 1));
    const clamped = Math.max(0, Math.min(scaleFreqs.length - 1, idx));
    return scaleFreqs[clamped];
  }
};
