/**
 * service-worker.js — Service Worker para soporte offline
 *
 * Responsabilidad: Cachear todos los recursos de la app para
 * funcionar completamente sin conexión a internet.
 *
 * Estrategia: Cache First para assets estáticos, Network First para HTML.
 * Implementa versionado para actualizaciones limpias.
 */

const CACHE_NAME = 'bjt-cache-v1';
const APP_CACHE = 'bjt-app-v1';
const ASSETS_CACHE = 'bjt-assets-v1';

/* ====================================================================
   RECURSOS A CACHÉ
   ==================================================================== */

// Recursos críticos de la aplicación (Network First)
const APP_FILES = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.json',
  './modules/deck.js',
  './modules/blackjack.js',
  './modules/trainer.js',
  './modules/stats.js',
  './modules/ui.js',
  './modules/animations.js',
  './modules/audio.js',
  './modules/storage.js'
];

// Assets estáticos (Cache First)
const ASSET_FILES = [
  './assets/icons/icon-72.png',
  './assets/icons/icon-96.png',
  './assets/icons/icon-128.png',
  './assets/icons/icon-144.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

/* ====================================================================
   INSTALACIÓN
   ==================================================================== */

self.addEventListener('install', (event) => {
  console.log('[SW] Instalando...', CACHE_NAME);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando app shell...');
        return cache.addAll(APP_FILES);
      })
      .then(() => {
        console.log('[SW] Cacheando assets...');
        return caches.open(ASSETS_CACHE);
      })
      .then(cache => {
        return cache.addAll(ASSET_FILES);
      })
      .then(() => {
        console.log('[SW] Instalación completada');
        return self.skipWaiting();
      })
      .catch(err => {
        console.warn('[SW] Error durante instalación:', err);
        // No fallar la instalación, la app puede funcionar sin algunos assets
      })
  );
});

/* ====================================================================
   ACTIVACIÓN — Limpieza de caches antiguos
   ==================================================================== */

self.addEventListener('activate', (event) => {
  console.log('[SW] Activando...', CACHE_NAME);

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== APP_CACHE && name !== ASSETS_CACHE)
          .map(name => {
            console.log('[SW] Eliminando cache antiguo:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activación completada');
      return self.clients.claim();
    })
  );
});

/* ====================================================================
   FETCH — Estrategia de cache
   ==================================================================== */

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorar requests no-GET y de extensiones no web
  if (event.request.method !== 'GET') return;

  // No cachear requests a APIs externas
  if (url.origin !== self.location.origin) {
    // Para fuentes de Google, usar cache-first si están cacheadas
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      event.respondWith(fontStrategy(event.request));
      return;
    }
    return;
  }

  // Estrategia para archivos de la app
  if (APP_FILES.includes(url.pathname) || ASSET_FILES.includes(url.pathname)) {
    event.respondWith(cacheFirstStrategy(event.request));
  } else {
    // Para otros archivos locales, intentar cache primero
    event.respondWith(cacheFirstStrategy(event.request));
  }
});

/* ====================================================================
   ESTRATEGIAS DE CACHE
   ==================================================================== */

/**
 * Cache First: intenta cache, si no existe va a red y cachea.
 *
 * @param {Request} request - Request original.
 * @returns {Response} Response cacheado o de red.
 */
async function cacheFirstStrategy(request) {
  // 1. Buscar en cache
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  // 2. Buscar en todos los caches
  for (const cacheName of [CACHE_NAME, APP_CACHE, ASSETS_CACHE]) {
    const match = await caches.open(cacheName).then(c => c.match(request));
    if (match) return match;
  }

  // 3. Ir a red
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => {
        cache.put(request, clone);
      });
    }
    return response;
  } catch (err) {
    console.warn('[SW] Fetch fallido:', request.url);
    // Retornar fallback offline
    return new Response(
      '<html><body style="background:#050705;color:#f4ecd8;font-family:sans-serif;text-align:center;padding:40px;"><h1>♠ ♦</h1><p>Offline — Blackjack Trainer Pro</p><p>Tu app está lista. Conexión perdida pero puedes seguir usando la aplicación.</p></html>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/**
 * Estrategia para fuentes de Google (cache con refresh).
 *
 * @param {Request} request - Request de fuente.
 * @returns {Response}
 */
async function fontStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => {
        cache.put(request, clone);
      });
    }
    return response;
  } catch {
    // Sin fuentes = sin problema, fallback a sistema
    return new Response('', { status: 204 });
  }
}

/* ====================================================================
   PUSH NOTIFICATIONS (Preparado para futuro)
   ==================================================================== */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Recuerda practicar tu conteo hoy.',
    icon: './assets/icons/icon-192.png',
    badge: './assets/icons/icon-72.png',
    vibrate: [100, 50, 100],
    data: data.url || './',
    actions: [
      { action: 'open', title: 'Abrir App' },
      { action: 'dismiss', title: 'Descartar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Blackjack Trainer Pro', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data));
});

/* ====================================================================
   MESSAGE HANDLING
   ==================================================================== */

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
