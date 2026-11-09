/**
 * sw.js - Service Worker для 100% автономной работы PWA без интернета.
 * Архитектура: Network-First для локальных скриптов (мгновенные обновления на GitHub Pages)
 * + Cache-First для внешних CDN библиотек + Offline-First fallback.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

const CACHE_NAME = 'pharmagate-pwa-v2026.3.0';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './css/tabulator_custom.css',
    './icons/favicon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './js/vendor/tabulator.min.js',
    './js/app.js',
    './js/engine/app_config.js',
    './js/engine/date_engine.js',
    './js/engine/dbf_doctor_engine.js',
    './js/engine/dbf_engine.js',
    './js/engine/pharma_math.js',
    './js/engine/pipeline_sanitizers.js',
    './js/engine/text_engine.js',
    './js/domain/action_inspector_engine.js',
    './js/domain/advisor_engine.js',
    './js/domain/column_presets.js',
    './js/domain/commercial_guard.js',
    './js/domain/flk_engine.js',
    './js/domain/fuzzy_column_matcher.js',
    './js/domain/knowledge_base_data.js',
    './js/domain/models.js',
    './js/domain/network_profiles.js',
    './js/domain/pharma_vocab.js',
    './js/services/access_wasm_driver.js',
    './js/services/cross_platform_hub.js',
    './js/services/export_service.js',
    './js/services/guide_service.js',
    './js/services/reconciler_service.js',
    './js/services/session_cache.js',
    './js/services/sqlite_wasm_service.js',
    './js/services/universal_importer.js',
    './js/ui/grid_controller.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            console.log('[PWA] Предварительное кэширование модулей для автономной работы...');
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
    const request = event.request;
    const url = new URL(request.url);

    // Только для GET-запросов (пропускаем chrome-extension, POST, etc.)
    if (request.method !== 'GET') return;

    // Внешние CDN зависимости: Cache-First с сохранением в кэш
    if (url.origin !== self.location.origin) {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) return cached;
                return fetch(request).then(response => {
                    if (response && response.status === 200) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
                    }
                    return response;
                }).catch(() => cached);
            })
        );
        return;
    }

    // Для локальных файлов и навигации: Network-First с немедленным fallback на кэш при офлайне
    event.respondWith(
        fetch(request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, responseToCache).catch(() => {});
                });
            }
            return networkResponse;
        }).catch(() => {
            return caches.match(request).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                if (request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                return new Response('Офлайн режим: ресурс недоступен', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            });
        })
    );
});
