import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {mixAudio} from './audio.mjs';

test('music fills the reel, ducks under voice, and keeps narration timing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-audio-'));
  const ff = args => execFileSync('ffmpeg', ['-y','-loglevel','error',...args]);
  const file = name => path.join(dir, name);
  try {
    ff(['-f','lavfi','-i','color=c=black:s=64x64:r=12:d=4','-c:v','libx264',file('silent.mp4')]);
    ff(['-f','lavfi','-i','sine=frequency=3000:sample_rate=48000:duration=1.8',file('voice.wav')]);
    mixAudio(file('silent.mp4'), [{vo:'voice.wav',dur:2.3},{dur:1.7}], 4, file('voice.mp4'), file);
    mixAudio(file('silent.mp4'), [{dur:4}], 4, file('music.mp4'), file);
    const pcm = (name, filter) => {
      const raw = ff(['-i',file(name),'-vn','-af',filter,'-ar','48000','-ac','1','-f','f32le','pipe:1']);
      return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
    };
    const rms = (data, start, end) => {
      let sum = 0, n = 0;
      for (let i = Math.floor(start*48000); i < Math.min(data.length, Math.floor(end*48000)); i++) {sum += data[i]**2; n++;}
      return Math.sqrt(sum/n);
    };
    const mixedMusic = pcm('voice.mp4','lowpass=f=1200:p=2,lowpass=f=1200:p=2');
    const musicOnly = pcm('music.mp4','lowpass=f=1200:p=2,lowpass=f=1200:p=2');
    assert.ok(rms(musicOnly,.5,1.5) > .001, 'background must be audible');
    assert.ok(rms(mixedMusic,.5,1.5) < rms(musicOnly,.5,1.5)*.8, 'music must duck while speech plays');
    assert.ok(rms(mixedMusic,3,3.4) > rms(musicOnly,3,3.4)*.65, 'music must recover after speech');
    const voice = pcm('voice.mp4','highpass=f=2400:p=2');
    assert.ok(rms(voice,.3,1.6) > rms(mixedMusic,.3,1.6)*3, 'voice must stay above music');
    assert.ok(rms(voice,0,.1) < rms(voice,.3,1.6)*.05, 'voice must respect 150ms scene offset');
    assert.ok(rms(voice,2.2,3) < rms(voice,.3,1.6)*.05, 'voice must end before scene transition');
    const all = pcm('voice.mp4','anull');
    assert.ok(all.length >= 4*48000 && all.length < 4.1*48000, 'output must cover full duration');
    let peak = 0; for (const v of all) peak = Math.max(peak,Math.abs(v));
    assert.ok(peak < 1, 'mixed audio must not clip');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
