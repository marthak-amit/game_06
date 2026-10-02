import { Game } from './game.js';
import { Save, today } from './save.js';
import { Sfx } from './audio.js';
import { Ads, IAP } from './monetization.js';
import { PERKS, UPGRADES, SKINS, PRODUCTS, DAILY_REWARDS, MISSION_TEMPLATES } from './config.js';

const $ = id => document.getElementById(id);
const stage = $('stage'), canvas = $('c');
let paused = false, perkCb = null, lastSummary = null, doubled = false;

// ---------- helpers ----------
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1800);
}
const screens = ['menu', 'shop', 'rewards', 'spin', 'settings', 'perk', 'pause', 'over'];
function show(id) { for (const s of screens) $(s).classList.toggle('show', s === id); }
function hideAll() { show(null); }
const fmt = n => n.toLocaleString('en-US');
const btnSfx = () => Sfx.click();

// ---------- game ----------
const game = new Game(canvas, {
  level: () => {},
  fired: () => { if (!Save.d.tutorialDone) { Save.d.tutorialDone = true; Save.save(); } },
  perk: (opts, cb) => openPerks(opts, cb),
  over: s => onOver(s),
});
window.__game = game; // handy for debugging / automated tests

function resize() {
  const probe = getComputedStyle($('safe-probe'));
  const st = parseFloat(probe.paddingTop) || 0, sb = parseFloat(probe.paddingBottom) || 0;
  const { w, h } = game.resize(window.innerWidth, window.innerHeight, st, sb);
  stage.style.width = w + 'px'; stage.style.height = h + 'px';
  stage.style.setProperty('--st', st + 'px');
  stage.style.setProperty('--odb', 12 + sb + 'px');
  $('hint').style.top = (game.floorY - 90) * game.scale + 'px';
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------- missions ----------
function ensureMissions() {
  const m = Save.d.missions;
  if (m.date === today()) return;
  const pool = MISSION_TEMPLATES.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  m.date = today();
  m.list = pool.map(t => {
    const tier = Math.floor(Math.random() * 3);
    return { id: t.id, goal: t.goals[tier], reward: t.reward[tier], prog: 0, claimed: false };
  });
  Save.save();
}
function missionProgress(id, n, mode = 'add') {
  for (const m of Save.d.missions.list) {
    if (m.id !== id) continue;
    m.prog = mode === 'max' ? Math.max(m.prog, n) : m.prog + n;
  }
}
const claimable = () => Save.d.missions.list.filter(m => m.prog >= m.goal && !m.claimed).length;
const dailyAvailable = () => Save.d.daily.lastClaim !== today();

// ---------- menu ----------
function refreshMenu() {
  $('mBest').textContent = Save.d.best; $('mCoins').textContent = fmt(Save.d.coins);
  $('dotRewards').classList.toggle('hidden', !(dailyAvailable() || claimable()));
  $('dotSpin').classList.toggle('hidden', !(spinState().used < 1));
  const dc = Save.d.dailyChallenge;
  $('btnDaily').textContent = dc.date === today() && dc.rewarded ? `📅 DAILY · best ${dc.best}` : '📅 DAILY CHALLENGE · +100🪙';
}
function goMenu() {
  game.phase = 'menu'; game.over = false;
  $('hud').classList.add('hidden');
  refreshMenu(); show('menu');
}

function startRun(mode) {
  Sfx.unlock(); Sfx.click();
  doubled = false;
  hideAll();
  game.newRun(mode);
  $('hud').classList.remove('hidden');
  $('hint').classList.toggle('hidden', Save.d.tutorialDone);
  paused = false;
  syncHud(true);
}
$('btnPlay').onclick = () => startRun('normal');
$('btnDaily').onclick = () => startRun('daily');
document.querySelectorAll('[data-close]').forEach(b => (b.onclick = () => { btnSfx(); refreshMenu(); show('menu'); }));

// ---------- HUD ----------
let hudKey = '';
function syncHud(force) {
  const g = game;
  const key = [g.level, g.od >= 45, g.odArmed, g.phase, g.runCoins, Object.entries(g.perks).join(), g.shield, g.speed, g.fireTime > 5].join('|');
  $('hBest').textContent = (g.mode === 'daily' ? 'DAILY · ' : '') + 'BEST ' + (g.mode === 'daily' ? Save.d.dailyChallenge.best : Save.d.best);
  $('odBar').firstElementChild.style.width = g.odPct * 100 + '%';
  if (!force && key === hudKey) return;
  hudKey = key;
  $('hLevel').textContent = 'LEVEL ' + g.level;
  $('hCoins').textContent = '🪙 ' + g.runCoins;
  const od = $('btnOD');
  od.classList.toggle('hidden', !(g.odReady && g.phase === 'aim'));
  od.classList.toggle('armed', g.odArmed);
  od.textContent = g.odArmed ? '🔥 ARMED – FIRE!' : '🔥 OVERDRIVE';
  $('btnFF').classList.toggle('hidden', g.phase !== 'fire');
  $('btnRecall').classList.toggle('hidden', !(g.phase === 'fire' && g.fireTime > 5));
  $('btnFF').textContent = g.speed > 1 ? '⏵' : '⏩';
  const chips = Object.entries(g.perks).filter(([, v]) => v > 0).map(([k, v]) => `<span>${PERKS[k].icon}${v > 1 ? v : ''}</span>`);
  if (g.shield > 0 && !g.perks.barrier) chips.push(`<span>🛡️${g.shield}</span>`);
  $('perkRow').innerHTML = chips.join('');
  if (g.phase !== 'aim') $('hint').classList.add('hidden');
}
$('btnOD').onclick = () => { game.toggleOverdrive(); syncHud(true); };
$('btnFF').onclick = () => { game.fastForward(); syncHud(true); };
$('btnRecall').onclick = () => { game.recall(); Sfx.click(); };
$('btnPause').onclick = () => { if (game.phase === 'menu' || game.phase === 'over') return; paused = true; Sfx.click(); show('pause'); };
$('btnResume').onclick = () => { paused = false; Sfx.click(); hideAll(); };
$('btnQuit').onclick = () => { paused = false; endRunEarly(); };
document.addEventListener('visibilitychange', () => { if (document.hidden && ['aim', 'fire'].includes(game.phase)) { paused = true; show('pause'); } });

function endRunEarly() {
  // Quitting still banks coins; counts as a finished run.
  const s = game.summary(); game.over = true; game.phase = 'over';
  Save.d.games++; Save.d.totalLevels += game.level;
  bank(s); lastSummary = s; goMenu();
}

// ---------- perks ----------
function openPerks(opts, cb) {
  perkCb = cb;
  const box = $('perkChoices');
  const render = list => {
    box.innerHTML = '';
    list.forEach(k => {
      const lvl = game.perks[k] || 0, p = PERKS[k];
      const b = document.createElement('button'); b.className = 'perk';
      b.innerHTML = `<span class="ic">${p.icon}</span><span><b>${p.name} ${lvl ? '→ Lv ' + (lvl + 1) : ''}</b><small>${p.desc}</small></span>`;
      b.onclick = () => { Sfx.perk(); hideAll(); const f = perkCb; perkCb = null; f(k); syncHud(true); };
      box.appendChild(b);
    });
  };
  render(opts);
  $('btnReroll').onclick = async () => {
    if (await Ads.showRewarded('reroll')) render(game.randomPerks(3));
  };
  show('perk');
}

// ---------- game over ----------
function bank(s) {
  const d = Save.d;
  Save.addCoins(s.coins);
  if (s.mode === 'normal' && s.level > d.best) d.best = s.level;
  missionProgress('bricks', s.bricks); missionProgress('pickups', s.pickups); missionProgress('boss', s.boss);
  missionProgress('od', s.od); missionProgress('level', s.level, 'max'); missionProgress('runs', 1);
  Save.save();
}

function onOver(s) {
  const d = Save.d, prevBest = d.best;
  let extra = '';
  if (s.mode === 'daily') {
    const dc = d.dailyChallenge;
    if (dc.date !== today()) { dc.date = today(); dc.best = 0; dc.rewarded = false; }
    dc.best = Math.max(dc.best, s.level);
    if (!dc.rewarded) { dc.rewarded = true; s.coins += 100; extra = 'Daily bonus +100🪙! '; }
  }
  bank(s); lastSummary = s;
  const isBest = s.mode === 'normal' && s.level > prevBest;
  $('oTitle').textContent = isBest ? '🏆 NEW BEST!' : 'Vault Overflow!';
  $('oLevel').textContent = s.level;
  $('oBricks').textContent = s.bricks; $('oCombo').textContent = s.combo; $('oBest').textContent = s.mode === 'daily' ? d.dailyChallenge.best : d.best; $('oCoins').textContent = '+' + s.coins;
  const gap = d.best - s.level;
  $('oMsg').textContent = extra + (isBest ? 'Incredible run!' : gap > 0 && gap <= 4 ? `So close! Only ${gap} level${gap > 1 ? 's' : ''} from your best.` : 'One more run?');
  $('btnRevive').classList.toggle('hidden', s.revives >= 1);
  $('btnDouble').classList.remove('hidden'); $('btnDouble').disabled = false;
  $('btnDouble').textContent = `🎬 DOUBLE COINS (+${s.coins})`;
  setTimeout(() => { hideAll(); show('over'); }, 450);
}

$('btnRevive').onclick = async () => {
  if (!(await Ads.showRewarded('revive'))) return toast('No ad available right now');
  // Un-bank this run's coins; they are banked again when the run really ends.
  Save.d.coins = Math.max(0, Save.d.coins - lastSummary.coins); Save.save();
  hideAll(); game.revive(); paused = false; syncHud(true);
};
$('btnDouble').onclick = async () => {
  if (doubled || !lastSummary) return;
  if (await Ads.showRewarded('double')) {
    doubled = true; Save.addCoins(lastSummary.coins); $('btnDouble').disabled = true; $('btnDouble').textContent = '✓ Doubled!'; Sfx.win();
    $('oCoins').textContent = '+' + lastSummary.coins * 2;
  } else toast('No ad available right now');
};
$('btnAgain').onclick = async () => { await Ads.maybeInterstitial(); startRun(lastSummary ? lastSummary.mode : 'normal'); };
$('btnHome').onclick = async () => { await Ads.maybeInterstitial(); goMenu(); };

// ---------- shop ----------
let tab = 'up';
document.querySelectorAll('.tabs button').forEach(b => (b.onclick = () => { tab = b.dataset.tab; btnSfx(); renderShop(); }));
$('btnShop').onclick = () => { btnSfx(); tab = 'up'; renderShop(); show('shop'); };

function renderShop() {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $('sCoins').textContent = '🪙 ' + fmt(Save.d.coins);
  const body = $('shopBody'); body.innerHTML = '';
  const d = Save.d;
  if (tab === 'up') {
    for (const [id, u] of Object.entries(UPGRADES)) {
      const lvl = d.upgrades[id], maxed = lvl >= u.max, cost = u.cost(lvl);
      const el = document.createElement('div'); el.className = 'item';
      el.innerHTML = `<div class="ic">${u.icon}</div><div class="tx"><b>${u.name}</b><small>${u.desc}</small><div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>`;
      const b = document.createElement('button'); b.textContent = maxed ? 'MAX' : '🪙 ' + fmt(cost); b.disabled = maxed || d.coins < cost;
      b.onclick = () => { if (d.coins < cost) return; d.coins -= cost; d.upgrades[id]++; Save.save(); Sfx.perk(); renderShop(); };
      el.appendChild(b); body.appendChild(el);
    }
  } else if (tab === 'skins') {
    for (const s of SKINS) {
      const owned = d.skins.includes(s.id), cur = d.skin === s.id;
      const el = document.createElement('div'); el.className = 'item';
      el.innerHTML = `<div class="ic"><div class="swatch" style="background:${s.rainbow ? 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' : s.color};color:${s.color}"></div></div><div class="tx"><b>${s.name}</b><small>${s.iap ? 'Special offer item' : owned ? 'Owned' : 'Ball skin'}</small></div>`;
      const b = document.createElement('button');
      if (owned) { b.textContent = cur ? 'EQUIPPED' : 'EQUIP'; b.disabled = cur; b.onclick = () => { d.skin = s.id; Save.save(); Sfx.click(); renderShop(); }; }
      else if (s.iap) { b.textContent = 'Store'; b.onclick = () => { tab = 'store'; renderShop(); }; }
      else { b.textContent = '🪙 ' + fmt(s.price); b.disabled = d.coins < s.price; b.onclick = () => { d.coins -= s.price; d.skins.push(s.id); d.skin = s.id; Save.save(); Sfx.perk(); renderShop(); }; }
      el.appendChild(b); body.appendChild(el);
    }
  } else {
    for (const p of PRODUCTS) {
      const owned = p.once && IAP.owned(p.id);
      const el = document.createElement('div'); el.className = 'item' + (p.hot && !owned ? ' hot' : '');
      el.innerHTML = `<div class="ic">${p.removeAds ? '🚫' : p.skin ? '🌈' : '🪙'}</div><div class="tx"><b>${p.name}${p.hot ? ' 🔥' : ''}</b><small>${p.desc}</small></div>`;
      const b = document.createElement('button'); b.textContent = owned ? 'OWNED' : p.price; b.disabled = owned;
      b.onclick = async () => { if (await IAP.buy(p.id)) { Sfx.win(); toast('Purchased: ' + p.name); renderShop(); } };
      el.appendChild(b); body.appendChild(el);
    }
  }
}

// ---------- rewards (daily login + missions) ----------
$('btnRewards').onclick = () => { btnSfx(); renderRewards(); show('rewards'); };
function renderRewards() {
  const d = Save.d, body = $('rewardsBody'); body.innerHTML = '';
  const avail = dailyAvailable();
  const streak = d.daily.streak % 7;
  const wrap = document.createElement('div'); wrap.className = 'item'; wrap.style.flexDirection = 'column'; wrap.style.alignItems = 'stretch';
  wrap.innerHTML = `<b>Daily login streak: ${d.daily.streak} 🔥</b><div class="days">${DAILY_REWARDS.map((r, i) => `<div class="day ${i < streak || (!avail && i === streak - 1 + (streak === 0 ? 7 : 0)) ? 'done' : ''} ${avail && i === streak ? 'now' : ''}">D${i + 1}<b>${r}</b></div>`).join('')}</div>`;
  const row = document.createElement('div'); row.style.display = 'flex'; row.style.gap = '6px';
  const claim = document.createElement('button'); claim.textContent = avail ? `Claim ${DAILY_REWARDS[streak]} 🪙` : 'Come back tomorrow'; claim.disabled = !avail; claim.style.flex = '1';
  const dbl = document.createElement('button'); dbl.textContent = '🎬 x2'; dbl.disabled = !avail;
  const doClaim = mult => {
    const amt = DAILY_REWARDS[streak] * mult;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const ystr = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
    d.daily.streak = d.daily.lastClaim === ystr ? d.daily.streak + 1 : 1;
    d.daily.lastClaim = today(); Save.addCoins(amt); Sfx.win(); toast(`+${amt} 🪙`); renderRewards(); refreshMenu();
  };
  claim.onclick = () => doClaim(1);
  dbl.onclick = async () => { if (await Ads.showRewarded('daily_x2')) doClaim(2); };
  row.append(claim, dbl); wrap.appendChild(row); body.appendChild(wrap);

  const h = document.createElement('b'); h.textContent = "Today's missions"; h.style.textAlign = 'left'; body.appendChild(h);
  for (const m of d.missions.list) {
    const t = MISSION_TEMPLATES.find(x => x.id === m.id), done = m.prog >= m.goal;
    const el = document.createElement('div'); el.className = 'item';
    el.innerHTML = `<div class="tx"><b>${t.text(m.goal)}</b><small>${Math.min(m.prog, m.goal)} / ${m.goal}</small><div class="bar"><i style="width:${Math.min(100, (m.prog / m.goal) * 100)}%"></i></div></div>`;
    const b = document.createElement('button'); b.textContent = m.claimed ? '✓' : `🪙 ${m.reward}`; b.disabled = !done || m.claimed;
    b.onclick = () => { m.claimed = true; Save.addCoins(m.reward); Sfx.coin(); renderRewards(); refreshMenu(); };
    el.appendChild(b); body.appendChild(el);
  }
}

// ---------- lucky spin ----------
const PRIZES = [50, 30, 100, 20, 250, 40, 75, 500];
const WEIGHTS = [14, 22, 12, 22, 4, 16, 9, 1];
function spinState() {
  const d = Save.d;
  if (!d.spin || d.spin.date !== today()) d.spin = { date: today(), used: 0 };
  return d.spin;
}
let wheelRot = 0, spinning = false;
function buildWheel() {
  const w = $('wheel'); if (w.children.length) return;
  PRIZES.forEach((p, i) => { const b = document.createElement('b'); b.style.transform = `rotate(${i * 45 + 22.5}deg)`; b.innerHTML = `<span>${p}</span>`; w.appendChild(b); });
}
function renderSpin() {
  buildWheel();
  const st = spinState(), left = 4 - st.used;
  $('spinInfo').textContent = st.used === 0 ? 'Your free spin is ready!' : left > 0 ? `${left} bonus spin${left > 1 ? 's' : ''} left today (watch an ad)` : 'No spins left today — come back tomorrow';
  const b = $('btnSpinGo'); b.disabled = spinning || left <= 0;
  b.textContent = st.used === 0 ? 'SPIN FREE' : '🎬 WATCH AD · SPIN';
}
$('btnSpin').onclick = () => { btnSfx(); renderSpin(); show('spin'); };
$('btnSpinGo').onclick = async () => {
  const st = spinState(); if (spinning || st.used >= 4) return;
  if (st.used > 0 && !(await Ads.showRewarded('spin'))) return toast('No ad available right now');
  spinning = true; st.used++; Save.save(); $('btnSpinGo').disabled = true;
  const tot = WEIGHTS.reduce((a, b) => a + b, 0); let r = Math.random() * tot, idx = 0;
  while (idx < WEIGHTS.length - 1 && (r -= WEIGHTS[idx]) > 0) idx++;
  const jitter = (Math.random() - 0.5) * 30;
  wheelRot += 360 * 5 + (360 - (idx * 45 + 22.5)) - (wheelRot % 360) + jitter;
  $('wheel').style.transform = `rotate(${wheelRot}deg)`;
  const tick = setInterval(() => Sfx.click(), 180);
  setTimeout(() => {
    clearInterval(tick); spinning = false;
    Save.addCoins(PRIZES[idx]); Sfx.win(); toast(`+${PRIZES[idx]} 🪙`); renderSpin(); refreshMenu();
  }, 4100);
};

// ---------- back button (Android) ----------
function onBack() {
  const open = screens.find(s => $(s).classList.contains('show'));
  if (open === 'menu' || !open) {
    if (game.phase === 'aim' || game.phase === 'fire') { paused = true; show('pause'); }
    return;
  }
  if (open === 'pause') { paused = false; hideAll(); }
  else if (open === 'over') goMenu();
  else if (open !== 'perk') { refreshMenu(); show('menu'); }
}
document.addEventListener('backbutton', onBack);
try { const A = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App; A && A.addListener('backButton', onBack); } catch (e) { /* web */ }

// ---------- settings ----------
$('btnSettings').onclick = () => { btnSfx(); $('optSound').checked = Save.d.sound; $('optHaptics').checked = Save.d.haptics; show('settings'); };
$('optSound').onchange = e => { Save.d.sound = e.target.checked; Save.save(); };
$('optHaptics').onchange = e => { Save.d.haptics = e.target.checked; Save.save(); };
$('btnRestore').onclick = () => toast('Purchases restored');
$('btnReroll').textContent = '🎬 Watch ad · Reroll perks';

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = (now - last) / 1000; last = now;
  if (!paused) game.update(dt);
  game.render();
  if (game.phase !== 'menu') syncHud(false);
  requestAnimationFrame(frame);
}

ensureMissions();
resize();
Ads.init();
goMenu();
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
