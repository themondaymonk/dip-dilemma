// Divine Intervention Step 2 CK — service worker
// Strategy: cache app shell for offline launch; cache MP3s on play (runtime) so
// recently-heard episodes work offline. iOS limits total storage, so this degrades
// gracefully — streaming always works online; offline covers what you've recently played.
const SHELL = 'dip-shell-v1';
const AUDIO = 'dip-audio-v1';
const SHELL_FILES = [
  './', './index.html', './manifest.json',
  './icon-180.png', './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(()=>self.skipWaiting()).catch(()=>{}));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k!==SHELL && k!==AUDIO).map(k => caches.delete(k))
  )).then(()=>self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // MP3 audio: cache-first, then network, and stash a copy
  if (/\.mp3(\?|$)/i.test(url)) {
    e.respondWith(
      caches.open(AUDIO).then(cache =>
        cache.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
          // only cache full 200 responses (range requests come back 206 — skip those)
          if (resp.status === 200) { cache.put(e.request, resp.clone()).catch(()=>{}); }
          return resp;
        }).catch(()=> hit))
      )
    );
    return;
  }
  // Shell / fonts: cache-first with network fallback
  if (e.request.method === 'GET') {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && (url.startsWith(self.location.origin) || url.includes('fonts.g'))) {
          const copy = resp.clone(); caches.open(SHELL).then(c => c.put(e.request, copy)).catch(()=>{});
        }
        return resp;
      }).catch(()=> caches.match('./index.html')))
    );
  }
});
