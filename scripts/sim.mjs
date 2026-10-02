// Headless balance simulation: node scripts/sim.mjs [runs]
import { Game, W, CELL } from '../www/js/game.js';
const runs = +process.argv[2] || 20;
const res = [];
for (let n = 0; n < runs; n++) {
  const g = new Game(null, { perk: (opts, cb) => cb(opts[Math.floor(Math.random() * opts.length)]) });
  g.newRun('normal', true);
  let frames = 0;
  while (!g.over && frames < 600000) {
    if (g.phase === 'aim') {
      if (g.odReady && !g.odArmed) g.toggleOverdrive();
      // aim at a random column with a lowish brick, with a bit of noise
      const bs = g.bricks.filter(b => b.type !== 'ball' && b.type !== 'coin');
      const tgt = bs.length ? bs[Math.floor(Math.random() * Math.min(bs.length, 6))] : null;
      const tx = tgt ? (tgt.c + 0.5) * CELL : W / 2, ty = tgt ? g.top + tgt.r * CELL : 200;
      let a = Math.atan2(g.floorY - ty, tx - g.lx) + (Math.random() - 0.5) * 0.25;
      a = Math.max(0.2, Math.min(Math.PI - 0.2, a));
      g.fire(a);
    }
    g.update(1 / 60); frames++;
  }
  res.push(g.level);
}
res.sort((a, b) => a - b);
console.log('levels', res.join(','), 'median', res[Math.floor(res.length / 2)]);
