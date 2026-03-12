# Loop-16: PWA Precache & Offline Support

## 상태: completed

## 배경
- PWA 콜드 스타트 20-30초 딜레이 발생
- 원인: public/sw.js가 알림 전용으로, fetch 핸들러/캐싱이 전혀 없었음
- 매번 네트워크에서 517KB JS 풀 다운로드 필요

## 변경 내역

### 패키지 추가
- `vite-plugin-pwa` — Vite 빌드와 Workbox 통합
- `workbox-precaching` — 빌드 산출물 precache
- `workbox-routing` — 요청별 캐싱 전략 라우팅
- `workbox-strategies` — CacheFirst, NetworkFirst 등 전략
- `workbox-cacheable-response` — 캐시 가능 응답 필터링
- `workbox-expiration` — 캐시 만료 관리

### 파일 변경

| 파일 | 변경 |
|------|------|
| `vite.config.js` | VitePWA 플러그인 추가 (injectManifest 전략) |
| `src/sw.js` | 신규 생성 — Workbox 캐싱 + 기존 알람 로직 통합 |
| `src/main.jsx` | SW 등록 코드 추가 (window load 이벤트) |
| `src/hooks/useAlarmEngine.js` | SW 중복 등록 제거 |
| `public/sw.js` | 삭제 (src/sw.js로 이전) |
| `netlify.toml` | 캐시 헤더 5개 규칙 추가 |
| `public/manifest.json` | 변경 없음 (manifest: false 설정) |

### 캐싱 전략
- **Precache**: 빌드 산출물 15개 (HTML, JS, CSS, 아이콘, manifest 등)
- **JS/CSS/Font**: Cache First (30일 만료, 최대 60개)
- **Images**: Cache First (30일 만료, 최대 100개)
- **Supabase API**: Network First (5초 타임아웃, 24시간 캐시, 최대 50개)

### Netlify 캐시 헤더
- `/assets/*` → immutable, 1년
- `/sw.js`, `/index.html` → must-revalidate
- `/manifest.json` → 1일
- `/*.png` → 1주

## 검증 결과
- 빌드 성공 (vite build + SW 빌드)
- `dist/sw.js`에 precache manifest 주입 확인 (15 entries, 590.51 KiB)
- 알람 로직 보존 확인 (notificationclick, FIRE_ALARM, SNOOZE_ALARM)
- `dist/manifest.json` 복사 확인

## 예상 효과
- 2회차 이후 콜드 스타트: 20-30초 → 1-2초
- 오프라인 시 캐시된 앱 셸 표시 가능
- Supabase API 응답 캐시로 오프라인 fallback 지원
