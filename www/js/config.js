// Static game configuration: perks, upgrades, skins, store products, rewards.

export const PERKS = {
  multi:   { name: 'Multi Shot',      icon: '➕', desc: '+2 balls every volley',          max: 5 },
  power:   { name: 'Heavy Hit',       icon: '💪', desc: '+35% ball damage',               max: 5 },
  pierce:  { name: 'Pierce',          icon: '🏹', desc: 'Balls punch through +1 brick',   max: 3 },
  blast:   { name: 'Blast',           icon: '💥', desc: 'Hits may explode nearby bricks', max: 4 },
  chain:   { name: 'Chain Lightning', icon: '⚡', desc: 'Kills zap +1 more brick',        max: 4 },
  rapid:   { name: 'Rapid Fire',      icon: '🚀', desc: 'Balls launch & fly faster',      max: 3 },
  lucky:   { name: 'Lucky',           icon: '🍀', desc: 'More ball & coin pickups',       max: 3 },
  barrier: { name: 'Barrier',         icon: '🛡️', desc: 'Survive one overflow',           max: 2 },
};

export const UPGRADES = {
  balls: { name: 'Starting Balls', icon: '⚪', desc: '+1 ball at the start of every run', max: 6, cost: n => Math.round(120 * Math.pow(1.75, n)) },
  crit:  { name: 'Critical Hit',   icon: '🎯', desc: '+4% chance for balls to hit x2',    max: 8, cost: n => Math.round(150 * Math.pow(1.6, n)) },
  coin:  { name: 'Coin Boost',     icon: '🪙', desc: '+12% coins from every run',         max: 8, cost: n => Math.round(100 * Math.pow(1.65, n)) },
  head:  { name: 'Head Start',     icon: '🎁', desc: 'Begin each run with a free perk',   max: 3, cost: n => Math.round(400 * Math.pow(2.4, n)) },
  net:   { name: 'Safety Net',     icon: '🕸️', desc: 'Start each run with a Barrier',     max: 2, cost: n => Math.round(900 * Math.pow(2.2, n)) },
};

export const SKINS = [
  { id: 'neon',    name: 'Neon',    color: '#38e8ff', price: 0 },
  { id: 'ember',   name: 'Ember',   color: '#ff7a3d', price: 250 },
  { id: 'lime',    name: 'Acid',    color: '#a5ff3d', price: 500 },
  { id: 'royal',   name: 'Royal',   color: '#a98bff', price: 900 },
  { id: 'rose',    name: 'Rose',    color: '#ff5fa2', price: 1400 },
  { id: 'gold',    name: 'Gold',    color: '#ffd23d', price: 2200 },
  { id: 'plasma',  name: 'Plasma',  color: '#00ffa8', price: 0, iap: 'starter_pack' },
  { id: 'rainbow', name: 'Rainbow', color: '#ffffff', price: 0, iap: 'vip_skin', rainbow: true },
];

// Prices shown here are placeholders for the web mock; real store prices come from Play/App Store.
export const PRODUCTS = [
  { id: 'starter_pack', name: 'Starter Pack', desc: '1,000 coins + Plasma ball + 2 Starting Balls', price: '₹79', coins: 1000, skin: 'plasma', balls: 2, once: true, hot: true },
  { id: 'remove_ads',   name: 'Remove Ads',   desc: 'No more interstitials. Rewarded ads stay optional.', price: '₹249', removeAds: true, once: true },
  { id: 'vip_skin',     name: 'Rainbow Ball', desc: 'Animated rainbow trail', price: '₹149', skin: 'rainbow', once: true },
  { id: 'coins_s',      name: 'Coin Pouch',   desc: '600 coins',   price: '₹79',  coins: 600 },
  { id: 'coins_m',      name: 'Coin Bag',     desc: '3,500 coins', price: '₹349', coins: 3500 },
  { id: 'coins_l',      name: 'Coin Vault',   desc: '9,000 coins', price: '₹749', coins: 9000 },
];

export const DAILY_REWARDS = [50, 100, 150, 250, 300, 400, 800];

export const MISSION_TEMPLATES = [
  { id: 'bricks',  text: n => `Destroy ${n} bricks`,        goals: [120, 250, 400], reward: [40, 70, 110] },
  { id: 'level',   text: n => `Reach level ${n} in one run`, goals: [8, 14, 22],     reward: [40, 80, 140] },
  { id: 'pickups', text: n => `Collect ${n} coin pickups`,  goals: [6, 12, 20],     reward: [40, 70, 110] },
  { id: 'boss',    text: n => `Defeat ${n === 1 ? 'a boss' : n + ' bosses'}`, goals: [1, 2, 3], reward: [80, 140, 220] },
  { id: 'od',      text: n => `Use Overdrive ${n} time${n > 1 ? 's' : ''}`, goals: [1, 2, 3], reward: [50, 90, 140] },
  { id: 'runs',    text: n => `Play ${n} runs`,             goals: [3, 5, 8],       reward: [30, 60, 100] },
];
