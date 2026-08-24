/**
 * sw.js — Service Worker
 * 功能：离线缓存壳 / Web Push 通知 / 本地定时通知
 */
const CACHE = 'training-pwa-v2';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './plan-data.js',
  './extra-data.js',
  './config.js',
  './crypto.js',
  './api.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      const copy = res.clone();
      if (res.ok && e.request.url.indexOf(self.location.origin) === 0) {
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (hit) {
        return hit || caches.match('./index.html');
      });
    })
  );
});

// Web Push
self.addEventListener('push', function (e) {
  let data = { title: '训练助手', body: '', url: './' };
  try { data = Object.assign(data, e.data.json()); } catch (err) {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { url: data.url || './' }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return clients.openWindow(url);
  }));
});

// 本地定时通知（App 打开时注册）
const timers = {};
self.addEventListener('message', function (e) {
  const msg = e.data || {};
  if (msg.type === 'clear' && msg.id === 'all') {
    Object.keys(timers).forEach(function (k) { clearTimeout(timers[k]); delete timers[k]; });
    return;
  }
  if (msg.type === 'schedule') {
    if (timers[msg.id]) clearTimeout(timers[msg.id]);
    timers[msg.id] = setTimeout(function () {
      self.registration.showNotification(msg.title, {
        body: msg.body,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: msg.id,
        data: { url: msg.url || './' }
      });
      delete timers[msg.id];
    }, Math.max(0, msg.when - Date.now()));
  } else if (msg.type === 'clear') {
    if (timers[msg.id]) { clearTimeout(timers[msg.id]); delete timers[msg.id]; }
  }
});
