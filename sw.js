/**
 * sw.js - Service Worker для 100% автономной работы PWA без интернета.
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

const CACHE_NAME = 'pharmagate-pwa-v2026.2.0';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './css/tabulator_custom.css',
    './js/app.js',
    './js/engine/app_config.js',
    './js/engine/dbf_engine.js',
    './js/engine/date_engine.js',
    './js/engine/pharma_math.js',
    './js/engine/text_engine.js',
    './js/engine/pipeline_sanitizers.js',
    './js/domain/models.js',
    './js/domain/network_profiles.js',
    './js/domain/flk_engine.js',
    './js/domain/commercial_guard.js',
    './js/domain/pharma_vocab.js',
    './js/services/universal_importer.js',
    './js/services/reconciler_service.js',
    './js/services/export_service.js',
    './js/ui/grid_controller.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            console.log('[PWA] Кэширование модулей для автономной работы...');
            await Promise.allSettled(
                ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.warn(`[PWA] Пропущен кэш ${url}:`, err)))
            );
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).catch(() => {
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});