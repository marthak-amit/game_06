const KEY = 'volleyvault_save_v1';

export const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

const defaults = () => ({
  coins: 0, best: 0, games: 0, totalLevels: 0,
  upgrades: { balls: 0, crit: 0, coin: 0, head: 0, net: 0 },
  skins: ['neon'], skin: 'neon',
  removeAds: false, purchased: [],
  sound: true, haptics: true,
  daily: { lastClaim: '', streak: 0 },
  missions: { date: '', list: [] },
  dailyChallenge: { date: '', best: 0, rewarded: false },
  tutorialDone: false,
  runsSinceAd: 0, lastAdAt: 0,
});

let data = null;

function load() {
  data = defaults();
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      data = { ...data, ...p, upgrades: { ...data.upgrades, ...(p.upgrades || {}) } };
    }
  } catch (e) { /* storage unavailable: run in memory */ }
}

export const Save = {
  get d() { if (!data) load(); return data; },
  save() {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  },
  addCoins(n) { this.d.coins += Math.round(n); this.save(); },
  reset() { data = defaults(); this.save(); },
};
