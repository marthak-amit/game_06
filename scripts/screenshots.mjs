import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8124', '-d', 'www'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const out = process.argv[2] || 'screenshots';
const b = await chromium.launch({ executablePath: process.env.CHROME });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e))); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
await page.goto('http://localhost:8124/?fastads');
await page.waitForTimeout(700);
const snap = n => page.screenshot({ path: `${out}/${n}.png` });
await snap('01-menu');
await page.click('#btnPlay'); await page.waitForTimeout(300);
await snap('02-aim-start');
// bot: plays with the game's own API (time-stepped for speed). mode: 'lvl' stop at level, 'perk' stop at perk screen
const play = (stop, target) => page.evaluate(async ([stop, target]) => {
  const g = window.__game; let n = 0;
  while (!g.over && n++ < 400000) {
    if (stop === 'lvl' && g.level >= target && g.phase === 'aim') break;
    if (stop === 'perk' && g.phase === 'perk') break;
    if (g.phase === 'perk') { document.querySelector('.perk')?.click(); await new Promise(r => setTimeout(r, 20)); continue; }
    if (g.phase === 'aim') {
      if (g.odReady && !g.odArmed) g.toggleOverdrive();
      const bs = g.bricks.filter(b => b.type !== 'ball' && b.type !== 'coin');
      const t = bs.sort((a, b) => b.r - a.r)[0];
      const tx = t ? (t.c + 0.5) * 360 / 7 : 180, ty = t ? g.top + t.r * 360 / 7 : 200;
      const a = Math.atan2(g.floorY - 6 - ty, tx - g.lx) + (Math.random() - 0.5) * 0.2;
      g.fire(Math.max(0.2, Math.min(Math.PI - 0.2, a)));
    }
    for (let i = 0; i < 4; i++) g.update(1 / 60);
    if (n % 40 === 0) await new Promise(r => setTimeout(r, 0));
  }
  return g.level;
}, [stop, target]);
await play('lvl', 4); await page.waitForTimeout(500); await snap('03-level4');
await play('perk'); await page.waitForTimeout(400); await snap('04-perk-choice');
await page.click('.perk'); await page.waitForTimeout(200);
await play('lvl', 10); await snap('05-boss-level');
await page.waitForTimeout(1900);
await page.evaluate(() => { const g = window.__game; g.od = 45; g.fire(1.9); });
await page.waitForTimeout(900); await snap('06-volley-action');
await page.evaluate(() => { const g = window.__game; g.balls_live.length = 0; g.launched = g.toLaunch; });
await page.evaluate(() => { const g = window.__game; g.od = 45; });
await page.waitForTimeout(300);
await page.evaluate(() => { const g = window.__game; g.balls_live.length = 0; g.launched = g.toLaunch; });
await page.waitForTimeout(700);
if (await page.locator('.perk').first().isVisible()) { await page.click('.perk'); await page.waitForTimeout(300); }
await page.evaluate(() => { const g = window.__game; g.od = 45; g.phase = 'aim'; });
await page.waitForTimeout(300);
await page.click('#btnOD').catch(() => {}); await page.waitForTimeout(200);
const box = await page.locator('#c').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height - 80); await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.62, box.y + 300, { steps: 5 }); await page.waitForTimeout(100);
await snap('07-overdrive-aim');
await page.mouse.up(); await page.waitForTimeout(1200); await snap('08-overdrive-fire');
await page.evaluate(() => { const g = window.__game; g.balls_live.length = 0; g.launched = g.toLaunch; g.bricks.forEach(b => b.r = 99); g.phase = 'descend'; g.descendT = 0; });
await page.waitForTimeout(1300); await snap('09-game-over');
await page.click('#btnHome'); await page.waitForTimeout(300);
if (await page.locator('#adOverlay.show').count()) { await page.waitForSelector('.ad-close:not([disabled])'); await page.click('.ad-close'); await page.waitForTimeout(200); }
await page.click('#btnShop'); await page.waitForTimeout(200); await snap('10-shop-upgrades');
await page.click('[data-tab=skins]'); await page.waitForTimeout(100); await snap('11-shop-skins');
await page.click('[data-tab=store]'); await page.waitForTimeout(100); await snap('12-store');
await page.click('#shop [data-close]');
await page.click('#btnRewards'); await page.waitForTimeout(200); await snap('13-rewards');
await page.click('#rewards [data-close]');
await page.click('#btnSpin'); await page.waitForTimeout(200); await snap('14-lucky-spin');
console.log('errors:', errs.length ? errs : 'none');
await b.close(); srv.kill();
