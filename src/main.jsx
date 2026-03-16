import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'

// SW 등록 + 자동 업데이트 (프로덕션만)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
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

      // 3) 새 SW가 waiting 상태로 들어오면 reload
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            window.location.reload()
          }
        })
      })
    }).catch(err => {
      console.error('SW registration failed:', err)
    })

    // 4) controller 변경 감지 — 다른 탭에서 SW 업데이트된 경우
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!window.__swReloading) {
        window.__swReloading = true
        window.location.reload()
      }
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
