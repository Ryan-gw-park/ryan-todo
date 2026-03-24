# SW 자동 업데이트 핫픽스

## 문제

배포 후에도 사용자가 이전 버전의 캐시된 JS를 계속 보게 됨. DevTools에서 수동으로 "Update on reload"을 체크해야만 새 버전이 반영됨.

## 원인

Service Worker가 새 버전을 감지해도 `waiting` 상태에서 멈춤. 기존 페이지가 닫히기 전까지 새 SW가 활성화되지 않음 (SW 기본 동작).

## 수정 — 2개 파일

### 1. src/sw.js — 설치 즉시 활성화

sw.js에 다음이 확실히 포함되어 있는지 확인하고, 없으면 추가:

```javascript
// install 이벤트에서 즉시 활성화
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

// activate 이벤트에서 즉시 제어권 획득
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})
```

`self.skipWaiting()`이 precache 관련 코드와 충돌하지 않는지 확인할 것. Workbox의 `precacheAndRoute` 사용 시에도 위 코드는 안전하게 동작한다.

### 2. src/main.jsx — 앱에서 SW 업데이트 자동 감지 + 새로고침

main.jsx의 SW 등록 코드를 수정한다. 현재 `registerSW()` 또는 `navigator.serviceWorker.register()` 호출 부분을 찾아서 아래 패턴으로 교체/보강:

```javascript
// SW 등록 + 자동 업데이트
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then((registration) => {

    // 1) 주기적 업데이트 체크 (5분마다)
    setInterval(() => {
      registration.update()
    }, 5 * 60 * 1000)

    // 2) 페이지 포커스 시 업데이트 체크
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update()
      }
    })

    // 3) 새 SW가 waiting 상태로 들어오면 즉시 활성화 요청
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (!newWorker) return

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // 새 버전 설치됨 — 페이지 새로고침으로 적용
          // skipWaiting은 sw.js에서 처리하므로 여기서는 reload만
          window.location.reload()
        }
      })
    })
  })

  // 4) controller 변경 감지 — 다른 탭에서 SW가 업데이트된 경우
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // 이미 reload 중이면 중복 방지
    if (!window.__swReloading) {
      window.__swReloading = true
      window.location.reload()
    }
  })
}
```

**만약 vite-plugin-pwa의 `registerSW`를 사용 중이라면:**

```javascript
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  // 새 SW 감지 시 즉시 업데이트
  onNeedRefresh() {
    // 자동 업데이트 — 사용자 확인 없이 즉시 적용
    updateSW(true)
  },
  onOfflineReady() {
    console.log('[SW] Offline ready')
  },
})

// 페이지 포커스 시 업데이트 체크
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    updateSW()
  }
})
```

**어떤 방식으로 SW를 등록하고 있는지 확인 후** 적절한 패턴을 적용할 것.

---

## 주의사항

- `window.location.reload()`가 무한 루프에 빠지지 않도록 `window.__swReloading` 플래그 사용
- 사용자가 폼 입력 중에 갑자기 reload되면 UX 문제 — 하지만 이 앱은 팀 내부 도구이므로 즉시 reload가 적합. 범용 앱이라면 "새 버전이 있습니다. 업데이트" 토스트를 띄우는 방식이 더 나음
- skipWaiting + clients.claim 조합은 Workbox injectManifest에서 안전함

## 테스트

- [ ] 배포 후 기존 탭에서 새로고침 → 새 버전 반영 확인
- [ ] 배포 후 탭 전환(다른 탭 갔다가 복귀) → 자동 업데이트 확인
- [ ] 시크릿 모드에서 첫 접속 → 정상 동작
- [ ] `npm run build` 성공
