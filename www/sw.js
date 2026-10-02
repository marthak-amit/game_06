const C = 'vv-v1';
const FILES = ['./', 'index.html', 'css/style.css', 'js/main.js', 'js/game.js', 'js/save.js', 'js/audio.js', 'js/config.js', 'js/monetization.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x))))));
self.addEventListener('fetch', e => e.respondWith(fetch(e.request).catch(() => caches.match(e.request))));
