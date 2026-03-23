const CACHE_NAME = 'ethan-blog-v1';
const OFFLINE_URL = '/offline/';

// 앱 셸: 항상 캐시하는 핵심 리소스
const APP_SHELL = [
  '/',
  '/offline/',
  '/favicon.svg',
  '/manifest.json',
];

// install — 앱 셸 캐시
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// activate — 이전 버전 캐시 삭제
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// fetch — Network First + 캐시 Fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 다른 오리진 요청은 무시 (analytics, CDN 등)
  if (!request.url.startsWith(self.location.origin)) return;

  // HTML 페이지 요청
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 성공하면 캐시에 저장
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          // 오프라인이면 캐시에서 찾고, 없으면 오프라인 페이지
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // CSS, JS, 이미지 등 정적 리소스: Cache First
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
      )
    );
    return;
  }
});
