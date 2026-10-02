import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8123', '-d', 'www'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const out = process.argv[2] || '/tmp';
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e))); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
await page.goto('http://localhost:8123/?fastads');
await page.waitForTimeout(600);
await page.screenshot({ path: out + '/menu.png' });
await page.click('#btnPlay');
await page.waitForTimeout(400);
// drag to aim and shoot
const box = await page.locator('#c').boundingBox();
for (let i = 0; i < 4; i++) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 60);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * (0.3 + i * 0.15), box.y + 250, { steps: 4 });
  if (i === 0) await page.screenshot({ path: out + '/aim.png' });
  await page.mouse.up();
  await page.waitForTimeout(1000);
  if (i === 0) await page.screenshot({ path: out + '/fire.png' });
  await page.waitForFunction(() => window.__game.phase !== 'fire', null, { timeout: 30000 });
}
// force game over path
await page.evaluate(() => { const g = window.__game; g.level = 12; g.bricks.forEach(b => b.r = 99); g.phase = 'descend'; g.descendT = 0; });
await page.waitForTimeout(1200);
await page.screenshot({ path: out + '/over.png' });
await page.click('#btnDouble'); await page.waitForSelector('.ad-close:not([disabled])'); await page.click('.ad-close'); await page.waitForTimeout(300);
await page.click('#btnHome'); await page.waitForTimeout(500);
await page.click('#btnShop'); await page.waitForTimeout(200);
await page.screenshot({ path: out + '/shop.png' });
await page.click('[data-tab=store]'); await page.waitForTimeout(100);
await page.screenshot({ path: out + '/store.png' });
await page.click('#shop [data-close]');
await page.click('#btnRewards'); await page.waitForTimeout(200);
await page.screenshot({ path: out + '/rewards.png' });
console.log('errors:', errs.length ? errs : 'none');
await b.close(); srv.kill();
