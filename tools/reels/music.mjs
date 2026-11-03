// Original procedural instrumental: soft plucks and chords, no downloaded tracks.
import fs from 'node:fs';

export function writeMusic(file, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 180) throw new Error('Invalid music duration');
  const rate = 48000, frames = Math.ceil(seconds * rate), audio = new Float32Array(frames);
  const beat = 60 / 88;
  const chords = [[60,64,67,71], [57,60,64,67], [53,57,60,64], [55,59,62,67]];
  const note = (midi, start, duration, gain, pluck) => {
    const hz = 440 * 2 ** ((midi - 69) / 12);
    for (let j = 0, n = Math.floor(duration * rate), at = Math.floor(start * rate); j < n && at + j < frames; j++) {
      const t = j / rate;
      const envelope = pluck ? Math.min(1, t / .012) * Math.exp(-t * 4.5) : Math.min(1, t / .2, (duration - t) / .3);
      audio[at + j] += gain * envelope * (Math.sin(2 * Math.PI * hz * t) + .18 * Math.sin(4 * Math.PI * hz * t));
    }
  };
  for (let bar = 0; bar * 4 * beat < seconds; bar++) {
    const chord = chords[bar % chords.length], start = bar * 4 * beat;
    for (const pitch of chord) note(pitch - 12, start, 4 * beat, .025, false);
    for (let b = 0; b < 8; b++) note(chord[[0,2,1,3,2,1,3,2][b]] + 12, start + b * beat / 2, .65, .14, true);
  }
  const wav = Buffer.alloc(44 + frames * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++) {
    const fade = Math.max(0, Math.min(1, i / rate / .6, (frames - 1 - i) / rate / 1.2));
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, audio[i] * fade)) * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, wav);
}
