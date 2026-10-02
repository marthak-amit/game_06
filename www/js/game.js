// Volley Vault core: rogue-lite brick volley. Logic is DOM-free so it can be simulated in Node.
import { Save, today } from './save.js';
import { Sfx, buzz } from './audio.js';
import { SKINS, PERKS } from './config.js';

export const W = 360, COLS = 7, CELL = W / COLS, BR = 6, PAD = 2.5;
const OD_MAX = 45;           // hits needed to charge Overdrive
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export class Game {
  constructor(canvas, hooks = {}) {
    this.canvas = canvas || null;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.hooks = hooks;
    this.scale = 1; this.dpr = 1;
    this.H = 640; this.top = 78; this.bottomPad = 70;
    this.phase = 'menu';
    this.t = 0;
    this.particles = []; this.texts = []; this.bolts = []; this.banner = null;
    this.shake = 0; this.flash = 0;
    this.ambient = Array.from({ length: 14 }, (_, i) => ({ x: (i * 53) % W, y: (i * 97) % 600, vx: 40 + (i % 5) * 18, vy: 60 + (i % 4) * 22, r: 3 + (i % 3) }));
    this.aim = null; this.aiming = false;
    this.speed = 1;
    this.layout(640);
    this.newRun('normal', true);
    this.phase = 'menu';
    if (canvas) this.bind();
  }

  // ---------- layout ----------
  layout(H, safeTop = 0, safeBottom = 0) {
    this.H = H;
    this.top = 78 + safeTop;
    this.bottomPad = 74 + safeBottom;
    this.rows = clamp(Math.floor((H - this.top - this.bottomPad) / CELL), 8, 11);
    this.floorY = this.top + this.rows * CELL + 10;
    this.H = Math.max(H, this.floorY + 60);
  }

  resize(cssW, cssH, safeTop = 0, safeBottom = 0) {
    const w = Math.min(cssW, 480);
    const scale = w / W;
    const H = clamp(cssH / scale, 560, 860);
    this.layout(H, safeTop / scale, safeBottom / scale);
    this.scale = scale;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cw = Math.round(W * scale), ch = Math.round(this.H * scale);
    this.canvas.style.width = cw + 'px'; this.canvas.style.height = ch + 'px';
    this.canvas.width = Math.round(cw * this.dpr); this.canvas.height = Math.round(ch * this.dpr);
    return { w: cw, h: ch };
  }

  // ---------- run lifecycle ----------
  newRun(mode = 'normal', silent = false) {
    const up = Save.d.upgrades;
    this.mode = mode;
    this.rng = mode === 'daily' ? mulberry32(hashStr(today())) : Math.random;
    this.level = 1;
    this.balls = 3 + up.balls + (Save.d.purchased.includes('starter_pack') ? 2 : 0);
    this.pending = 0;
    this.perks = {};
    this.shield = up.net;
    this.bricks = []; this.balls_live = []; this.particles = []; this.texts = []; this.bolts = [];
    this.runCoins = 0; this.runBricks = 0; this.runPickups = 0; this.bossKills = 0; this.odUses = 0; this.revives = 0;
    this.combo = 0; this.od = 0; this.odArmed = false; this.banner = null; this.bestCombo = 0;
    this.lx = W / 2; this.nextLx = null;
    this.speed = 1; this.fireTime = 0;
    for (let i = 0; i < up.head; i++) this.grantPerk(this.randomPerks(1)[0]);
    for (let k = 0; k < 3; k++) { this.descend(); this.spawnRow(); }
    this.phase = 'aim';
    this.over = false;
    if (!silent) Sfx.click();
  }

  get ballSpeed() { return 640 * (1 + 0.1 * (this.perks.rapid || 0)); }
  get totalBalls() { return this.balls + 2 * (this.perks.multi || 0); }

  // ---------- generation ----------
  hpFor(L) {
    const r = this.rng;
    let hp = L * (1 + L / 13) * (0.7 + r() * 0.6);
    if (L > 3 && r() < 0.1) hp *= 1.8;
    return Math.max(1, Math.round(hp));
  }

  freeCell(c, r) { return !this.bricks.some(b => c >= b.c && c < b.c + b.w && r >= b.r && r < b.r + b.h); }

  addBrick(type, c, r, hp, w = 1, h = 1) {
    const b = { type, c, r, w, h, hp, max: hp, py: this.top + (r - 1) * CELL, flash: 0 };
    this.bricks.push(b);
    return b;
  }

  spawnRow() {
    const L = this.level, r = this.rng, lucky = this.perks.lucky || 0;
    const cols = [0, 1, 2, 3, 4, 5, 6];
    for (let i = cols.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cols[i], cols[j]] = [cols[j], cols[i]]; }
    if (L > 1 && L % 10 === 0) {
      const c = Math.floor(r() * 6);
      this.addBrick('boss', c, -1, Math.round(L * 7.5), 2, 2);
      const free = cols.filter(x => x < c || x > c + 1);
      this.addBrick('ball', free[0], 0, 1);
      return;
    }
    let n = 2 + (r() < 0.55 ? 1 : 0) + (L > 8 && r() < 0.4 ? 1 : 0) + (L > 20 && r() < 0.4 ? 1 : 0);
    n = Math.min(n, 5);
    for (let i = 0; i < n; i++) {
      let type = 'brick';
      if (L >= 4 && r() < 0.09) type = 'bomb'; else if (L >= 7 && r() < 0.06) type = 'laser';
      this.addBrick(type, cols[i], 0, this.hpFor(L));
    }
    let k = n;
    if (r() < 0.9 + lucky * 0.04) this.addBrick('ball', cols[k++], 0, 1);
    if (k < 7 && r() < 0.28 + lucky * 0.1) this.addBrick('coin', cols[k++], 0, 1);
  }

  descend() {
    for (const b of this.bricks) b.r++;
  }

  // ---------- perks ----------
  randomPerks(n) {
    const pool = Object.keys(PERKS).filter(k => (this.perks[k] || 0) < PERKS[k].max);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, n);
  }
  grantPerk(k) {
    if (!k) return;
    this.perks[k] = (this.perks[k] || 0) + 1;
    if (k === 'barrier') this.shield++;
  }

  // ---------- input ----------
  bind() {
    const c = this.canvas;
    const pos = e => {
      const rc = c.getBoundingClientRect();
      return { x: (e.clientX - rc.left) / this.scale, y: (e.clientY - rc.top) / this.scale };
    };
    c.addEventListener('pointerdown', e => { Sfx.unlock(); const p = pos(e); this.pointerDown(p.x, p.y); c.setPointerCapture && c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', e => { if (this.aiming) { const p = pos(e); this.pointerMove(p.x, p.y); } });
    const up = () => this.pointerUp();
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', () => { this.aiming = false; this.aim = null; });
  }
  pointerDown(x, y) { if (this.phase !== 'aim') return; this.aiming = true; this.pointerMove(x, y); }
  pointerMove(x, y) {
    const ox = this.lx, oy = this.floorY - BR;
    const dy = oy - y;
    if (dy < 26) { this.aim = null; return; }
    let a = Math.atan2(dy, x - ox);
    a = clamp(a, 0.16, Math.PI - 0.16);
    this.aim = a;
  }
  pointerUp() {
    if (!this.aiming) return;
    this.aiming = false;
    if (this.aim != null && this.phase === 'aim') this.fire(this.aim);
    this.aim = null;
  }

  fire(angle) {
    this.dirx = Math.cos(angle); this.diry = -Math.sin(angle);
    this.toLaunch = this.totalBalls; this.launched = 0; this.launchTimer = 0;
    this.interval = 0.075 / (1 + 0.15 * (this.perks.rapid || 0));
    this.landed = 0; this.nextLx = null; this.combo = 0; this.fireTime = 0; this.speed = 1;
    this.volleyOD = this.odArmed;
    if (this.odArmed) { this.odArmed = false; this.od = 0; this.odUses++; Sfx.od(); this.flash = 0.35; this.hooks.odFired && this.hooks.odFired(); }
    this.pending = 0;
    this.phase = 'fire';
    this.hooks.fired && this.hooks.fired();
  }

  toggleOverdrive() {
    if (this.phase !== 'aim' || this.od < OD_MAX) return false;
    this.odArmed = !this.odArmed; Sfx.click(); return true;
  }
  get odReady() { return this.od >= OD_MAX; }
  get odPct() { return Math.min(1, this.od / OD_MAX); }

  fastForward() { this.speed = this.speed > 1 ? 1 : 2.4; Sfx.click(); }
  recall() {
    for (const b of this.balls_live) { b.y = this.floorY - BR; b.vy = Math.abs(b.vy) + 1; }
    this.toLaunch = this.launched; // stop launching the rest; they'd land instantly otherwise
    this.landAllRemaining();
  }
  landAllRemaining() {
    const rest = this.balls_live.slice();
    for (const b of rest) this.landBall(b);
  }

  // ---------- simulation ----------
  update(dt) {
    dt = Math.min(dt, 1 / 20);
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 2);
    if (this.banner) { this.banner.life -= dt; if (this.banner.life <= 0) this.banner = null; }
    if (this.phase === 'fire') this.updateFire(dt * this.speed);
    else if (this.phase === 'descend') this.updateDescend(dt);
    if (this.phase === 'menu') this.updateAmbient(dt);
    // smooth brick slide + flash decay
    for (const b of this.bricks) {
      const target = this.top + b.r * CELL;
      b.py += (target - b.py) * Math.min(1, dt * 16);
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 6);
    }
    // launcher glide
    if (this.nextLx != null && this.phase !== 'fire') { this.lx += (this.nextLx - this.lx) * Math.min(1, dt * 14); }
    this.updateFx(dt);
  }

  updateAmbient(dt) {
    for (const a of this.ambient) {
      a.x += a.vx * dt; a.y += a.vy * dt;
      if (a.x < 0 || a.x > W) a.vx *= -1;
      if (a.y < 0 || a.y > this.H) a.vy *= -1;
    }
  }

  updateFx(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt; if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]; t.life -= dt; t.y -= 26 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) { this.bolts[i].life -= dt; if (this.bolts[i].life <= 0) this.bolts.splice(i, 1); }
  }

  updateFire(dt) {
    this.fireTime += dt;
    this.launchTimer -= dt;
    while (this.launched < this.toLaunch && this.launchTimer <= 0) {
      const od = this.volleyOD;
      const crit = Save.d.upgrades.crit * 0.04;
      this.balls_live.push({
        x: this.lx, y: this.floorY - BR, vx: this.dirx * this.ballSpeed, vy: this.diry * this.ballSpeed,
        pierce: od ? 999 : (this.perks.pierce || 0), dmg: (1 + 0.35 * (this.perks.power || 0)) * (od ? 2 : 1),
        crit, od, inside: new Set(), trail: [],
      });
      this.launched++; this.launchTimer += this.interval;
      if (this.launched % 2 === 1) Sfx.shoot();
    }
    // sub-stepped movement keeps fast balls from tunnelling through bricks
    const maxMove = this.ballSpeed * dt;
    const steps = Math.max(1, Math.ceil(maxMove / 3.2));
    const sdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (let i = this.balls_live.length - 1; i >= 0; i--) this.stepBall(this.balls_live[i], sdt);
    }
    for (const b of this.balls_live) {
      b.trail.push(b.x, b.y); if (b.trail.length > 12) b.trail.splice(0, 2);
      this.antiStall(b);
    }
    if (this.launched >= this.toLaunch && this.balls_live.length === 0) this.endTurn();
    else if (this.fireTime > 40) this.recall();
  }

  antiStall(b) {
    const min = 70;
    if (Math.abs(b.vy) < min) b.vy = (b.vy < 0 ? -1 : 1) * min;
  }

  stepBall(b, dt) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx); }
    else if (b.x > W - BR) { b.x = W - BR; b.vx = -Math.abs(b.vx); }
    if (b.y < this.top + BR - 6) { b.y = this.top + BR - 6; b.vy = Math.abs(b.vy); }
    if (b.vy > 0 && b.y >= this.floorY - BR) { this.landBall(b); return; }
    const bricks = this.bricks;
    for (let i = 0; i < bricks.length; i++) {
      const k = bricks[i];
      const kx = k.c * CELL + PAD, ky = this.top + k.r * CELL + PAD;
      const kw = k.w * CELL - PAD * 2, kh = k.h * CELL - PAD * 2;
      if (k.type === 'ball' || k.type === 'coin') {
        const cx = kx + kw / 2, cy = ky + kh / 2, d = BR + 13;
        if ((b.x - cx) * (b.x - cx) + (b.y - cy) * (b.y - cy) < d * d) this.collect(k);
        continue;
      }
      const px = clamp(b.x, kx, kx + kw), py = clamp(b.y, ky, ky + kh);
      const dx = b.x - px, dy = b.y - py, d2 = dx * dx + dy * dy;
      if (d2 >= BR * BR) { if (b.inside.size) b.inside.delete(k); continue; }
      if (b.inside.has(k)) continue;
      let nx, ny, pen;
      if (d2 > 1e-6) { const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; pen = BR - d; }
      else {
        const l = b.x - kx, r = kx + kw - b.x, t = b.y - ky, bt = ky + kh - b.y, m = Math.min(l, r, t, bt);
        nx = m === l ? -1 : m === r ? 1 : 0; ny = m === t ? -1 : m === bt ? 1 : 0; pen = BR + m;
      }
      if (b.pierce > 0) { b.pierce--; b.inside.add(k); }
      else {
        b.x += nx * pen; b.y += ny * pen;
        const dot = b.vx * nx + b.vy * ny;
        if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
      }
      this.hitBrick(k, b);
    }
  }

  landBall(b) {
    const i = this.balls_live.indexOf(b);
    if (i >= 0) this.balls_live.splice(i, 1);
    if (this.nextLx == null) this.nextLx = clamp(b.x, BR + 4, W - BR - 4);
    this.landed++;
  }

  hitBrick(k, b) {
    this.combo++; if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    if (this.combo === 25 || this.combo === 50 || this.combo === 100) { this.text(W / 2, this.top + 120, 'COMBO x' + this.combo + '!', '#ffe066'); this.shake = Math.max(this.shake, 4); }
    this.od = Math.min(OD_MAX, this.od + (this.volleyOD ? 0 : 1));
    Sfx.hit(this.combo);
    let dmg = b.dmg;
    if (Math.random() < b.crit) { dmg *= 2; this.text(b.x, b.y - 8, 'CRIT', '#ffe066'); }
    this.damage(k, dmg, true, b);
  }

  damage(k, dmg, fromBall, ball) {
    if (k.hp <= 0) return;
    k.hp -= dmg; k.flash = 1;
    if (fromBall) {
      const bl = this.perks.blast || 0;
      if (bl && Math.random() < 0.08 + bl * 0.05) this.explode(k, Math.max(1, dmg * 1.5), 1.55);
    }
    if (k.hp <= 0) this.destroy(k);
  }

  explode(k, dmg, radiusCells) {
    const cx = (k.c + k.w / 2) * CELL, cy = (k.r + k.h / 2) * CELL;
    this.burst(cx, this.top + cy, '#ffb347', 14, 200);
    this.shake = Math.max(this.shake, 3);
    for (const o of this.bricks.slice()) {
      if (o === k || o.hp <= 0 || o.type === 'ball' || o.type === 'coin') continue;
      const ox = (o.c + o.w / 2) * CELL, oy = (o.r + o.h / 2) * CELL;
      if (Math.hypot(ox - cx, oy - cy) < radiusCells * CELL + (o.w - 1) * CELL * 0.5) this.damage(o, dmg, false);
    }
  }

  destroy(k) {
    const i = this.bricks.indexOf(k); if (i < 0) return;
    this.bricks.splice(i, 1);
    this.runBricks++;
    const cx = (k.c + k.w / 2) * CELL, cy = this.top + (k.r + k.h / 2) * CELL;
    const col = this.brickColor(k);
    this.burst(cx, cy, col, k.type === 'boss' ? 40 : 10, k.type === 'boss' ? 320 : 170);
    Sfx.smash(); buzz(8);
    const L = this.level;
    if (k.type === 'bomb') { Sfx.boom(); this.shake = 9; this.explode(k, Math.max(3, Math.ceil(L * 0.6)), 1.6); }
    if (k.type === 'laser') {
      Sfx.zap(); this.shake = 5;
      this.bolts.push({ x1: 0, y1: cy, x2: W, y2: cy, life: 0.25, w: 5 });
      for (const o of this.bricks.slice()) if (o !== k && o.type !== 'ball' && o.type !== 'coin' && o.r <= k.r + k.h - 1 && o.r + o.h - 1 >= k.r) this.damage(o, Math.max(2, Math.ceil(L * 0.5)), false);
    }
    if (k.type === 'boss') {
      this.bossKills++; this.shake = 14; this.flash = 0.5; Sfx.boom(); buzz(40);
      this.runCoins += 25; this.text(cx, cy, '+25 BOSS', '#ffd23d');
    } else if (Math.random() < 0.07) {
      this.runCoins += 1; this.text(cx, cy, '+1', '#ffd23d');
    }
    const chain = this.perks.chain || 0;
    if (chain) {
      const targets = this.bricks.filter(o => o.type !== 'ball' && o.type !== 'coin' && o.hp > 0);
      for (let n = 0; n < chain && targets.length; n++) {
        const o = targets.splice(Math.floor(Math.random() * targets.length), 1)[0];
        const ox = (o.c + o.w / 2) * CELL, oy = this.top + (o.r + o.h / 2) * CELL;
        this.bolts.push({ x1: cx, y1: cy, x2: ox, y2: oy, life: 0.18, w: 3 });
        Sfx.zap();
        this.damage(o, Math.max(2, Math.ceil(L * 0.45)), false);
      }
    }
  }

  collect(k) {
    const i = this.bricks.indexOf(k); if (i < 0) return;
    this.bricks.splice(i, 1);
    const cx = (k.c + 0.5) * CELL, cy = this.top + (k.r + 0.5) * CELL;
    if (k.type === 'ball') {
      this.balls++; this.text(cx, cy, '+1 ball', '#7dffb0'); Sfx.pickup(); this.burst(cx, cy, '#7dffb0', 8, 120);
    } else {
      const v = 2 + (this.perks.lucky || 0);
      this.runCoins += v; this.runPickups++; this.text(cx, cy, '+' + v, '#ffd23d'); Sfx.coin(); this.burst(cx, cy, '#ffd23d', 8, 120);
    }
  }

  // ---------- turn flow ----------
  endTurn() {
    this.phase = 'descend'; this.descendT = 0.3; this.speed = 1;
    this.completed = this.level;
    this.level++;
    this.runCoins += 1;
    this.descend();
    this.spawnRow();
    // uncollected pickups that fall off the bottom just vanish
    this.bricks = this.bricks.filter(b => !((b.type === 'ball' || b.type === 'coin') && b.r >= this.rows));
    if (this.level % 10 === 0) this.showBanner('⚠ BOSS INCOMING', '#ff3d7f');
    else if (this.level % 5 === 1 && this.level > 1) this.showBanner('LEVEL ' + this.level, '#38e8ff');
    this.hooks.level && this.hooks.level(this.level);
  }

  updateDescend(dt) {
    this.descendT -= dt;
    if (this.descendT > 0) return;
    if (this.bricks.some(b => b.r + b.h - 1 >= this.rows)) return this.overflow();
    if (this.completed % 5 === 0) {
      const opts = this.randomPerks(3);
      if (opts.length) {
        this.phase = 'perk';
        Sfx.perk();
        this.hooks.perk && this.hooks.perk(opts, k => { this.grantPerk(k); this.phase = 'aim'; });
        return;
      }
    }
    this.phase = 'aim';
  }

  overflow() {
    if (this.shield > 0) {
      this.shield--; this.perks.barrier = Math.max(0, (this.perks.barrier || 0) - 1);
      this.clearBottom(3); this.shake = 14; this.flash = 0.6; Sfx.boom(); buzz(60);
      this.text(W / 2, this.floorY - 60, 'BARRIER!', '#7dd3ff');
      this.phase = 'aim';
      return;
    }
    this.phase = 'over'; this.over = true;
    Sfx.over(); buzz(80);
    Save.d.games++; Save.d.totalLevels += this.level;
    this.hooks.over && this.hooks.over(this.summary());
  }

  clearBottom(n) {
    for (const b of this.bricks.slice()) {
      if (b.r + b.h - 1 >= this.rows - n) {
        this.bricks.splice(this.bricks.indexOf(b), 1);
        this.burst((b.c + b.w / 2) * CELL, this.top + (b.r + b.h / 2) * CELL, this.brickColor(b), 8, 160);
      }
    }
  }

  revive() {
    this.revives++;
    this.clearBottom(3);
    this.over = false; this.phase = 'aim';
    this.shake = 10; this.flash = 0.5; Sfx.win();
    Save.d.games = Math.max(0, Save.d.games - 1); Save.d.totalLevels = Math.max(0, Save.d.totalLevels - this.level);
  }

  summary() {
    const up = Save.d.upgrades;
    const base = this.runCoins + Math.floor(this.level * 1.5);
    const coins = Math.round(base * (1 + 0.12 * up.coin));
    return { level: this.level, coins, bricks: this.runBricks, pickups: this.runPickups, boss: this.bossKills, od: this.odUses, combo: this.bestCombo, mode: this.mode, revives: this.revives };
  }

  // ---------- fx helpers ----------
  showBanner(s, color) { this.banner = { s, color, life: 1.6, max: 1.6 }; }
  burst(x, y, color, n, spd) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = spd * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, g: 380, life: 0.35 + Math.random() * 0.35, max: 0.7, size: 2 + Math.random() * 3, color });
    }
  }
  text(x, y, s, color) { this.texts.push({ x, y, s, color, life: 0.8 }); }

  brickColor(k) {
    if (k.type === 'bomb') return '#ff6b4a';
    if (k.type === 'laser') return '#c77dff';
    if (k.type === 'boss') return '#ff3d7f';
    const ratio = k.hp / Math.max(1, this.level);
    return ratio < 0.55 ? '#2fd4c0' : ratio < 0.85 ? '#5be37a' : ratio < 1.15 ? '#f4d03f' : ratio < 1.6 ? '#ff9f43' : '#ff5d73';
  }

  skin() {
    const s = SKINS.find(x => x.id === Save.d.skin) || SKINS[0];
    return s.rainbow ? `hsl(${(this.t * 120) % 360},100%,62%)` : s.color;
  }

  // ---------- rendering ----------
  predict() {
    // Simulate the aim line with up to 2 bounces so the player can plan angles.
    const pts = [];
    let x = this.lx, y = this.floorY - BR, vx = Math.cos(this.aim), vy = -Math.sin(this.aim), len = 0, bounces = 0;
    pts.push([x, y]);
    while (len < 760 && bounces < 3) {
      const px = x, py = y;
      x += vx * 3; y += vy * 3; len += 3;
      if (x < BR || x > W - BR) { vx = -vx; x = clamp(x, BR, W - BR); bounces++; pts.push([x, y]); continue; }
      if (y < this.top - 6 + BR) { vy = -vy; bounces++; pts.push([x, y]); continue; }
      for (const k of this.bricks) {
        if (k.type === 'ball' || k.type === 'coin') continue;
        const kx = k.c * CELL + PAD - BR, ky = this.top + k.r * CELL + PAD - BR, kw = k.w * CELL - 2 * PAD + 2 * BR, kh = k.h * CELL - 2 * PAD + 2 * BR;
        if (x > kx && x < kx + kw && y > ky && y < ky + kh) {
          if (px <= kx || px >= kx + kw) vx = -vx; else vy = -vy;
          x = px; y = py; bounces = 9; break;
        }
      }
      pts.push([x, y]);
    }
    return pts;
  }

  render() {
    const g = this.ctx; if (!g) return;
    const s = this.scale * this.dpr;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.clearRect(0, 0, W, this.H);
    if (this.phase === 'menu') { this.renderAmbient(g); return; }
    if (this.shake > 0) g.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    // danger zone + guides
    for (let c = 1; c < COLS; c++) { g.fillStyle = 'rgba(255,255,255,0.025)'; g.fillRect(c * CELL - 0.5, this.top, 1, this.rows * CELL); }
    const dz = g.createLinearGradient(0, this.top + (this.rows - 1) * CELL, 0, this.floorY);
    dz.addColorStop(0, 'rgba(255,60,90,0)'); dz.addColorStop(1, 'rgba(255,60,90,0.22)');
    g.fillStyle = dz; g.fillRect(0, this.top + (this.rows - 1) * CELL, W, CELL + 10);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, this.floorY, W, 2);

    for (const k of this.bricks) this.drawBrick(g, k);

    if (this.phase === 'aim' && this.aiming && this.aim != null) {
      const pts = this.predict();
      g.fillStyle = this.odArmed ? '#ff9f43' : 'rgba(255,255,255,0.85)';
      let acc = 0;
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        acc += Math.hypot(x1 - x0, y1 - y0);
        if (acc > 13) { acc = 0; g.globalAlpha = Math.max(0.15, 1 - i / pts.length); g.beginPath(); g.arc(x1, y1, 2.2, 0, 6.283); g.fill(); }
      }
      g.globalAlpha = 1;
    }

    const col = this.skin();
    g.globalCompositeOperation = 'lighter';
    for (const b of this.balls_live) {
      const c = b.od ? '#ff9f43' : col;
      g.strokeStyle = c; g.lineCap = 'round';
      for (let i = 2; i < b.trail.length; i += 2) {
        g.globalAlpha = (i / b.trail.length) * 0.5; g.lineWidth = BR * 1.4 * (i / b.trail.length);
        g.beginPath(); g.moveTo(b.trail[i - 2], b.trail[i - 1]); g.lineTo(b.trail[i], b.trail[i + 1]); g.stroke();
      }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    for (const b of this.balls_live) {
      const c = b.od ? '#ffb347' : col;
      g.fillStyle = c; g.beginPath(); g.arc(b.x, b.y, BR, 0, 6.283); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(b.x - 1.5, b.y - 1.8, BR * 0.35, 0, 6.283); g.fill();
    }

    // launcher
    if (this.phase !== 'over') {
      const ly = this.floorY - BR;
      if (this.phase === 'aim' || this.launched < this.toLaunch || this.phase === 'descend') {
        g.fillStyle = this.odArmed ? '#ffb347' : col;
        g.beginPath(); g.arc(this.lx, ly, BR + 1, 0, 6.283); g.fill();
        if (this.phase === 'aim') {
          g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = 'bold 12px system-ui, sans-serif'; g.textAlign = 'center';
          g.fillText('x' + this.totalBalls, this.lx, ly + 22);
        }
      }
      if (this.nextLx != null && this.phase === 'fire') {
        g.fillStyle = col; g.beginPath(); g.arc(this.nextLx, ly, BR, 0, 6.283); g.fill();
      }
    }

    g.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      g.globalAlpha = Math.max(0, p.life / p.max); g.fillStyle = p.color;
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    for (const b of this.bolts) {
      g.globalAlpha = Math.min(1, b.life * 5); g.strokeStyle = '#d9b3ff'; g.lineWidth = b.w;
      g.beginPath(); g.moveTo(b.x1, b.y1);
      const mx = (b.x1 + b.x2) / 2 + (Math.random() - 0.5) * 24, my = (b.y1 + b.y2) / 2 + (Math.random() - 0.5) * 24;
      g.lineTo(mx, my); g.lineTo(b.x2, b.y2); g.stroke();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.textAlign = 'center'; g.font = 'bold 13px system-ui, sans-serif';
    for (const t of this.texts) { g.globalAlpha = Math.min(1, t.life * 2.2); g.fillStyle = t.color; g.fillText(t.s, t.x, t.y); }
    g.globalAlpha = 1;
    if (this.phase === 'fire' && this.combo >= 8) {
      g.globalAlpha = 0.16; g.fillStyle = '#fff'; g.font = '900 96px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText(this.combo, W / 2, this.top + (this.rows * CELL) / 2 + 30); g.globalAlpha = 1;
    }
    if (this.banner) {
      const b = this.banner, k = b.life / b.max, a = Math.min(1, k * 3, (1 - k) * 6 + 0.2);
      g.globalAlpha = Math.max(0, Math.min(1, a)); g.fillStyle = b.color; g.textAlign = 'center';
      g.font = '900 28px system-ui, sans-serif'; g.fillText(b.s, W / 2, this.top + 70 + (1 - k) * -12); g.globalAlpha = 1;
    }
    if (this.flash > 0) { g.fillStyle = `rgba(255,255,255,${this.flash * 0.5})`; g.fillRect(0, 0, W, this.H); }
  }

  renderAmbient(g) {
    g.globalCompositeOperation = 'lighter';
    const col = this.skin();
    for (const a of this.ambient) {
      g.globalAlpha = 0.35; g.fillStyle = col; g.beginPath(); g.arc(a.x, a.y, a.r * 2.4, 0, 6.283); g.fill();
      g.globalAlpha = 0.9; g.beginPath(); g.arc(a.x, a.y, a.r, 0, 6.283); g.fill();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }

  rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  drawBrick(g, k) {
    const x = k.c * CELL + PAD, y = k.py + PAD, w = k.w * CELL - PAD * 2, h = k.h * CELL - PAD * 2;
    if (k.type === 'ball') {
      const cx = x + w / 2, cy = y + h / 2, pulse = 1 + Math.sin(this.t * 5 + k.c) * 0.08;
      g.strokeStyle = '#7dffb0'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 11 * pulse, 0, 6.283); g.stroke();
      g.fillStyle = '#7dffb0'; g.font = 'bold 16px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('+', cx, cy + 1); g.textBaseline = 'alphabetic';
      return;
    }
    if (k.type === 'coin') {
      const cx = x + w / 2, cy = y + h / 2, sq = Math.abs(Math.cos(this.t * 3 + k.c));
      g.fillStyle = '#ffd23d'; g.beginPath(); g.ellipse(cx, cy, 4 + 8 * sq, 11, 0, 0, 6.283); g.fill();
      g.strokeStyle = '#b8860b'; g.lineWidth = 2; g.stroke();
      return;
    }
    const col = this.brickColor(k);
    const grad = g.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, col); grad.addColorStop(1, shade(col, -0.35));
    g.fillStyle = grad; this.rr(g, x, y, w, h, 9); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; this.rr(g, x + 3, y + 3, w - 6, h * 0.35, 6); g.fill();
    if (k.flash > 0) { g.fillStyle = `rgba(255,255,255,${k.flash * 0.6})`; this.rr(g, x, y, w, h, 9); g.fill(); }
    if (k.type === 'bomb' || k.type === 'laser') {
      g.font = '14px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(k.type === 'bomb' ? '💣' : '⚡', x + 12, y + 17);
    }
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${k.type === 'boss' ? 34 : 18}px system-ui, sans-serif`;
    g.fillText(Math.ceil(k.hp), x + w / 2, y + h / 2 + 1);
    g.textBaseline = 'alphabetic';
    if (k.type === 'boss') { g.font = '700 11px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillText('BOSS', x + w / 2, y + 16); }
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = clamp(Math.round(r + r * amt), 0, 255); g = clamp(Math.round(g + g * amt), 0, 255); b = clamp(Math.round(b + b * amt), 0, 255);
  return `rgb(${r},${g},${b})`;
}
