import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {writeMusic} from './music.mjs';

// Keep voice placement identical to the visual scene clock, then duck music under it.
export function mixAudio(silent, scenes, total, outPath, local) {
  const music = path.join(path.dirname(outPath), 'background-music.wav');
  writeMusic(music, total);
  const inputs = [], filters = [], labels = [];
  let offset = 0, index = 1;
  for (const scene of scenes) {
    if (scene.vo) {
      inputs.push('-i', local(scene.vo));
      filters.push(`[${index}:a]aresample=48000,adelay=${Math.round((offset + .15) * 1000)}:all=1[a${index}]`);
      labels.push(`[a${index}]`); index++;
    }
    offset += scene.dur;
  }
  inputs.push('-i', music);
  filters.push(`[${index}:a]volume=0.3[music]`);
  if (labels.length) {
    filters.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0,apad,atrim=duration=${total},loudnorm=I=-16:TP=-2:LRA=11,aresample=48000,asplit=2[voice][key]`);
    filters.push('[music][key]sidechaincompress=threshold=0.015:ratio=8:attack=15:release=350[ducked]');
    filters.push('[voice][ducked]amix=inputs=2:normalize=0,alimiter=limit=0.95:latency=1[mix]');
  } else filters.push('[music]alimiter=limit=0.95:latency=1[mix]');
  execFileSync('ffmpeg', ['-y','-loglevel','error','-i',silent,...inputs,'-filter_complex',filters.join(';'),'-map','0:v','-map','[mix]','-c:v','copy','-c:a','aac','-b:a','192k','-t',String(total),'-movflags','+faststart',outPath]);
}
