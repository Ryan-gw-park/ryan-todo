// public/sw.js
const CACHE_NAME = 'ryan-todo-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim())
})

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
