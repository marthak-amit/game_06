# 🎯 Volley Vault

A rogue-lite brick-volley mobile game. Aim, fire a volley, break the descending vault, pick a perk every 5 levels, survive the bosses.
Original concept (not related to Sky Stack / Cosmic Merge / Neon Swarm / Gravity Drift / Sling Sprite).

**Tech:** plain HTML5 Canvas + ES modules (no build step, free) wrapped for Android/iOS with [Capacitor](https://capacitorjs.com). Works offline; APK stays tiny (no asset files, audio is synthesized).

## What makes it sticky
- **Run-based roguelite**: 8 stackable perks (Multi Shot, Pierce, Blast, Chain Lightning, Rapid Fire, Lucky, Heavy Hit, Barrier) → every run plays differently.
- **Overdrive**: hits charge a meter; fire a flaming piercing x2-damage volley.
- **Bombs, lasers, bosses (every 10 levels)**, combo sounds, screen shake, haptics.
- **Meta progression**: permanent upgrades, 8 ball skins, daily login streak, 3 daily missions, **Daily Challenge** (same seeded vault for everyone).
- "So close!" near-best messaging, one-more-run loop.

## Monetization (wired, using mock/test IDs)
| Placement | Type | File |
|---|---|---|
| Revive after overflow | Rewarded | `main.js` `btnRevive` |
| Double run coins | Rewarded | `btnDouble` |
| Reroll perks | Rewarded | `btnReroll` |
| Daily reward x2 | Rewarded | rewards screen |
| After every 3rd run (max 1 / 2 min) | Interstitial | `monetization.js` `maybeInterstitial` |
| Remove Ads, Starter Pack, Rainbow ball, 3 coin packs | IAP | `config.js` `PRODUCTS` |

Interstitials only show at natural breaks (never mid-run) and never after Remove Ads is bought.

## Run it
```bash
npm run serve        # open http://localhost:8080  (add ?fastads to skip mock ad timers)
npm run sim          # headless balance simulation (bot)
```

## Android build
```bash
npm install
npm run android:add          # creates android/ and syncs www/
npm run android:open         # build/run in Android Studio
```
CI: `.github/workflows/android-debug.yml` builds a debug APK (Actions → Run workflow).

## To go live (needs your accounts)
1. **AdMob**: create app + 3 ad units; replace the Google *test* IDs in `www/js/monetization.js` (`AD_IDS`) and add the AdMob app ID to `AndroidManifest.xml` (see `@capacitor-community/admob` docs). Keep `initializeForTesting` off for release.
2. **IAP**: the web build mocks purchases. For stores, add a purchase plugin (RevenueCat / `cordova-plugin-purchase`) and call it from `IAP.buy` in `monetization.js`; product ids are in `config.js`. Validate receipts server-side before scaling.
3. Play Console: privacy policy, Data Safety form, target-audience (not children-only, otherwise ads rules change), signed AAB.
4. Replace the placeholder icon/splash (`@capacitor/assets`).

## Revenue reality check (₹10 lakh / month ≈ ₹33k/day ≈ $400/day)
No game can guarantee this; it is a *user-acquisition + retention* outcome. Rough math: at ~$0.04 blended ARPDAU (ads + ~2% payers) you need ≈10k daily active users; at $0.08 about 5k. Plan: soft-launch in a few countries, watch D1 ≥ 40% / D7 ≥ 12%, tune with `scripts/sim.mjs`, then scale paid UA only while CPI < LTV.
