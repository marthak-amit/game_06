// Tiny procedural synth: no audio assets to ship, so the APK stays small.
import { Save } from './save.js';

let ctx = null, master = null, lastHit = 0;

function tone(freq, dur = 0.1, type = 'sine', vol = 0.15, slide = 0, delay = 0) {
  if (!ctx || !Save.d.sound) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

export const Sfx = {
  unlock() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
      } catch (e) { return; }
    }
    if (ctx.state === 'suspended') ctx.resume();
  },
  hit(combo) {
    if (!ctx) return;
    const n = performance.now();
    if (n - lastHit < 28) return; lastHit = n;
    tone(260 + Math.min(combo, 36) * 24, 0.07, 'triangle', 0.1);
  },
  smash() { tone(180, 0.18, 'square', 0.12, -90); tone(520, 0.1, 'triangle', 0.1, 200, 0.02); },
  pickup() { tone(660, 0.08, 'sine', 0.14); tone(990, 0.12, 'sine', 0.12, 0, 0.06); },
  coin() { tone(1200, 0.06, 'square', 0.07); tone(1600, 0.1, 'square', 0.07, 0, 0.05); },
  shoot() { tone(420, 0.05, 'sine', 0.05, 120); },
  boom() { tone(120, 0.35, 'sawtooth', 0.2, -80); tone(60, 0.4, 'square', 0.15, -20); },
  zap() { tone(900, 0.12, 'sawtooth', 0.08, -600); },
  click() { tone(500, 0.04, 'triangle', 0.1); },
  perk() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.13, 0, i * 0.07)); },
  over() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.1, 0, i * 0.13)); },
  od() { tone(200, 0.5, 'sawtooth', 0.12, 800); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.2, 'triangle', 0.12, 0, i * 0.08)); },
};

export function buzz(ms) {
  if (!Save.d.haptics) return;
  try {
    const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if (H) H.vibrate({ duration: ms }); else if (navigator.vibrate) navigator.vibrate(ms);
  } catch (e) { /* ignore */ }
}
