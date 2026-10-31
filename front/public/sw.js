// Service worker MindSet: приложение открывается без сети, открытые ранее сеты читаются офлайн.
//
// Что кэшируем:
//   • оболочку приложения (index.html) — чтобы интерфейс запускался без сети;
//   • статику CRA (/static/...) — имена файлов содержат хеш, поэтому кэш держим долго;
//   • ответы API на GET — чтобы прочитанные сеты были доступны офлайн.
// Запросы с изменением данных (POST/PUT/DELETE) не кэшируем никогда.
//
// При выходе из аккаунта страница присылает сообщение clear-data — кэш данных чистим,
// чтобы на общем устройстве чужие заметки не оставались.
const VERSION = "v1";
const SHELL_CACHE = `mindset-shell-${VERSION}`;
const ASSET_CACHE = `mindset-assets-${VERSION}`;
const DATA_CACHE = `mindset-data-${VERSION}`;
const SHELL_URL = new URL("./index.html", self.location).href;

const isAsset = (url) =>
    url.pathname.includes("/static/") ||
    /\.(?:css|js|png|jpe?g|svg|webp|gif|ico|woff2?|ttf)$/i.test(url.pathname);

const networkFirst = async (request, cacheName, fallbackUrl) => {
    const cache = await caches.open(cacheName);

    try {
        const response = await fetch(request);
        if (response && response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }

        if (fallbackUrl) {
            const shell = await caches.match(fallbackUrl);
            if (shell) {
                return shell;
            }
        }

        return new Response("Нет сети", { status: 503, statusText: "Offline" });
    }
};

const cacheFirst = async (request, cacheName) => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) {
        return cached;
    }

    const response = await fetch(request);
    if (response && response.ok) {
        cache.put(request, response.clone());
    }
    return response;
};

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(SHELL_CACHE)
            .then((cache) => cache.add(new Request(SHELL_URL, { cache: "reload" })))
            .then(() => self.skipWaiting())
            .catch(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys.filter((key) => !key.endsWith(VERSION)).map((key) => caches.delete(key))
                )
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener("message", (event) => {
    if (event.data?.type === "clear-data") {
        event.waitUntil(caches.delete(DATA_CACHE));
    }
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== "GET" || url.origin !== self.location.origin) {
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request, SHELL_CACHE, SHELL_URL));
        return;
    }

    if (isAsset(url)) {
        event.respondWith(cacheFirst(request, ASSET_CACHE));
        return;
    }

    // Остальные GET с нашего домена — это запросы к API: их и держим для офлайна.
    event.respondWith(networkFirst(request, DATA_CACHE));
});
