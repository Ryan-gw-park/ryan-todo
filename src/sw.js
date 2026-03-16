// ═══════════════════════════════════════════════
// Workbox Precaching & Runtime Caching
// ═══════════════════════════════════════════════
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate, NetworkFirst } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'

import { createHandlerBoundToURL } from 'workbox-precaching'

// 설치 즉시 활성화
self.addEventListener('install', () => {
  self.skipWaiting()
})

// 활성화 시 즉시 제어권 획득
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

// Precache: VitePWA replaces self.__WB_MANIFEST with actual file list at build time
precacheAndRoute(self.__WB_MANIFEST)

// HTML Navigation → 프리캐시된 index.html 사용 (오프라인/캐시 만료 시 앱 셸 즉시 표시)
const navigationHandler = createHandlerBoundToURL('/index.html')
const navigationRoute = new NavigationRoute(navigationHandler, {
  denylist: [/^\/api\//, /^\/supabase\//],
})
registerRoute(navigationRoute)

// JS/CSS/Font → Cache First
registerRoute(
  ({ request }) => ['script', 'style', 'font'].includes(request.destination),
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
)

// Images → Cache First
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
)

// Supabase API → Network First (offline fallback to cache)
registerRoute(
  ({ url }) => url.hostname.includes('supabase'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  })
)

// ═══════════════════════════════════════════════
// Alarm Logic (migrated from public/sw.js)
// ═══════════════════════════════════════════════

// 알람 메시지 수신 → 네이티브 알림 발송
self.addEventListener('message', (e) => {
  if (e.data?.type === 'FIRE_ALARM') {
    const { title, body, taskId } = e.data
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `alarm-${taskId}`,
      renotify: true,
      data: { taskId },
      actions: [
        { action: 'snooze', title: '10분 후 다시 알림' },
        { action: 'dismiss', title: '닫기' },
      ],
    })
  }
})

// 알림 액션 클릭 처리
self.addEventListener('notificationclick', (e) => {
  const { action } = e
  const { taskId } = e.notification.data ?? {}
  e.notification.close()

  if (action === 'snooze') {
    e.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        for (const client of list) {
          client.postMessage({ type: 'SNOOZE_ALARM', taskId })
        }
      })
    )
    return
  }

  if (action === 'dismiss') return

  // 기본 클릭 → 앱 포커스
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return clients.openWindow('/')
    })
  )
})

// Web Push 수신 → 알림 표시
self.addEventListener('push', (e) => {
  if (!e.data) return

  let payload
  try {
    payload = e.data.json()
  } catch {
    payload = { title: '⏰ 알람', body: e.data.text(), taskId: null }
  }

  const { title = '⏰ 알람', body = '', taskId } = payload

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: taskId ? `alarm-${taskId}` : 'alarm',
      renotify: true,
      data: { taskId },
      actions: [
        { action: 'snooze', title: '10분 후 다시 알림' },
        { action: 'dismiss', title: '닫기' },
      ],
    })
  )
})
