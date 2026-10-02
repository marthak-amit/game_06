// Ads + in-app purchase bridge.
// In a browser it runs a visible MOCK so the full flow can be tested.
// In the Capacitor app it uses @capacitor-community/admob (ads) and a purchase plugin hook (IAP).
// Replace the TEST ids below with real AdMob ids once the account is ready (see README).
import { Save } from './save.js';
import { PRODUCTS } from './config.js';

export const AD_IDS = {
  android: { interstitial: 'ca-app-pub-3940256099942544/1033173712', rewarded: 'ca-app-pub-3940256099942544/5224354917', banner: 'ca-app-pub-3940256099942544/6300978111' },
  ios:     { interstitial: 'ca-app-pub-3940256099942544/4411468910', rewarded: 'ca-app-pub-3940256099942544/1712485313', banner: 'ca-app-pub-3940256099942544/2934735716' },
};

const cap = () => (typeof window !== 'undefined' ? window.Capacitor : null);
const native = () => !!(cap() && cap().isNativePlatform && cap().isNativePlatform());
const admob = () => cap() && cap().Plugins && cap().Plugins.AdMob;
const ids = () => (cap() && cap().getPlatform && cap().getPlatform() === 'ios' ? AD_IDS.ios : AD_IDS.android);
const fast = typeof location !== 'undefined' && /fastads/.test(location.search);

function mockAd(kind) {
  return new Promise(resolve => {
    const el = document.getElementById('adOverlay');
    const title = el.querySelector('.ad-title'), count = el.querySelector('.ad-count'), btn = el.querySelector('.ad-close');
    title.textContent = kind === 'rewarded' ? 'Rewarded video (mock)' : 'Interstitial ad (mock)';
    let left = fast ? 0 : (kind === 'rewarded' ? 3 : 2);
    btn.disabled = true; btn.textContent = 'Wait…';
    el.classList.add('show');
    const done = ok => { el.classList.remove('show'); clearInterval(iv); btn.onclick = null; resolve(ok); };
    const tick = () => {
      count.textContent = left > 0 ? left : '✓';
      if (left <= 0) { btn.disabled = false; btn.textContent = kind === 'rewarded' ? 'Claim reward' : 'Close'; clearInterval(iv); }
      left--;
    };
    const iv = setInterval(tick, 1000); tick();
    btn.onclick = () => done(true);
  });
}

export const Ads = {
  ready: false,
  async init() {
    if (native() && admob()) {
      try { await admob().initialize({ initializeForTesting: true }); this.ready = true; } catch (e) { console.warn('AdMob init failed', e); }
    }
  },
  /** Resolves true only if the player earned the reward. */
  async showRewarded(placement) {
    if (native() && admob() && this.ready) {
      try {
        await admob().prepareRewardVideoAd({ adId: ids().rewarded });
        const res = await admob().showRewardVideoAd();
        return !!res;
      } catch (e) { console.warn('rewarded failed', e); return false; }
    }
    if (native()) return false;
    return mockAd('rewarded');
  },
  /** Called at natural breaks only (after a run). Never during play. */
  async maybeInterstitial() {
    const s = Save.d;
    s.runsSinceAd++;
    Save.save();
    if (s.removeAds) return;
    const now = Date.now();
    if (s.runsSinceAd < 3 || now - s.lastAdAt < 120000) return; // every 3rd run, max once per 2 min
    s.runsSinceAd = 0; s.lastAdAt = now; Save.save();
    if (native() && admob() && this.ready) {
      try { await admob().prepareInterstitial({ adId: ids().interstitial }); await admob().showInterstitial(); } catch (e) { /* no fill */ }
      return;
    }
    if (!native()) await mockAd('interstitial');
  },
};

export const IAP = {
  product: id => PRODUCTS.find(p => p.id === id),
  owned: id => Save.d.purchased.includes(id),
  /** Returns true if the purchase succeeded. Web = mock confirm. Native = plug in store SDK here. */
  async buy(id) {
    const p = this.product(id); if (!p) return false;
    let ok = false;
    if (native() && cap().Plugins.InAppPurchase) {
      try { ok = !!(await cap().Plugins.InAppPurchase.purchase({ productId: id })); } catch (e) { ok = false; }
    } else if (!native()) {
      ok = fast || window.confirm(`[MOCK STORE]\nBuy "${p.name}" for ${p.price}?`);
    }
    if (ok) this.grant(p);
    return ok;
  },
  grant(p) {
    const s = Save.d;
    if (p.once && s.purchased.includes(p.id)) return;
    if (p.once) s.purchased.push(p.id);
    if (p.coins) s.coins += p.coins;
    if (p.skin && !s.skins.includes(p.skin)) s.skins.push(p.skin);
    if (p.removeAds) s.removeAds = true;
    Save.save();
  },
};
