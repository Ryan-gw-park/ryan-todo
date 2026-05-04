---
phase: mobile-perf-03-dnd-chunk
source: docs/plans/mobile-perf-03-dnd-chunk-spec.md (v4)
date: 2026-04-30
status: diff-plan-v4 (적대적 재리뷰 v3 결함 반영)
prev: spec
next: execute
---

# mobile-perf-03 Diff Plan v3 — `@dnd-kit` vendor chunk + Sidebar lazy (적대적 재리뷰 결함 반영)

> **변경 없음**: DB / RLS / Edge Function / API / 환경 변수 / 패키지 / src 다른 파일 / 다른 설정.
> **1 커밋, 2 파일 (vite.config.js + App.jsx), ~+5 / -1 LOC**.
> **전제**: Phase 1 v3 머지 완료 (R-02 모바일 idle preload 분기). §0 verification 필수.
> **v3 차이**: Phase 1 의존성 명시 (§0), fallback width 210→210 (C2 fix), AC-06 검증 시 idle 후 재확인 (W4).

---

## 0. Phase 1 머지 verification (필수 — 적대적 재리뷰 C1)

Phase 3 의 모바일 AC-06 은 Phase 1 R-02 (모바일 idle preload 분기) 적용 전제.

```bash
# v4 (적대적 재리뷰 C1 fix): mobile 분기 단독 검증 (-F 로 fixed string)
grep -A 10 "Idle 프리로드" src/App.jsx | grep -F "if (mobile)"
# 출력 없으면 Phase 1 미적용 → STOP
```

위 검증 실패 시 Phase 3 실행 중단.

---

## 1. 변경 파일 요약

| 파일 | 커밋 # | 변경 라인 | 변경 내용 |
|---|---|---|---|
| [vite.config.js](../../vite.config.js) | C1 | L13-14 영역 (+1 line) | `manualChunks` 에 `'vendor-dnd': [...]` 추가 |
| [src/App.jsx](../../src/App.jsx) | C1 | L17 (-1) + L17 영역 (+1 lazy) + L110 영역 (+2 Suspense wrapping) | `Sidebar` static import → `React.lazy`, render 시 Suspense fallback |

---

## 2. DB / API / Backend

- DB / RLS / Edge Function / 환경 변수 / 패키지 / src 다른 파일: 모두 무변경.
- Sidebar 컴포넌트 자체 변경 없음 (import 시점만 lazy 화).
- vite-plugin-pwa injectManifest 가 자동으로 vendor-dnd 를 manifest 포함.

---

## 3. 커밋별 상세 hunk

### Commit 1 — `build(vite): split @dnd-kit into vendor-dnd chunk + lazy Sidebar`

#### 1-1. `vite.config.js`

```diff
@@ L7-16 (manualChunks)
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           'vendor-react': ['react', 'react-dom', 'react-router-dom'],
           'vendor-supabase': ['@supabase/supabase-js'],
           'vendor-state': ['zustand'],
+          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
         }
       }
     }
   },
```

**LOC**: +1.
**리스크**: 최저.

#### 1-2. `src/App.jsx`

**A. `Sidebar` static import → `React.lazy`** (L17):

```diff
@@ L8-17 (Sidebar import 위치)
 // 즉시 필요한 것만 정적 import
 import SetupScreen from './components/shared/SetupScreen'
 import LoginScreen from './components/shared/LoginScreen'
 import MobileTopBar from './components/layout/MobileTopBar'
 import FAB from './components/layout/FAB'
 import Toast from './components/shared/Toast'
 import UpdateToast from './components/shared/UpdateToast'
 import { ViewSkeleton, LoadingSpinner } from './components/shared/Skeleton'
 import { SyncProviderWrapper } from './sync/SyncContext'
-import Sidebar from './components/layout/Sidebar'
 import useViewUrlSync from './hooks/useViewUrlSync'
```

**B. Sidebar 를 lazy 정의 영역에 추가** (L20-41 영역):

```diff
@@ L20-41 (lazy 정의 영역)
 // React.lazy 코드 스플리팅 — 뷰 컴포넌트 동적 import
 const ProjectView = lazy(() => import('./components/views/ProjectView'))
 const TimelineView = lazy(() => import('./components/views/TimelineView'))
 ...
+// mobile-perf-03 R-02: Sidebar lazy 화 — 모바일 entry chunk 에서 dnd-kit 제거
+const Sidebar = lazy(() => import('./components/layout/Sidebar'))
```

**C. AppShell 의 Sidebar 렌더에 Suspense 추가** (L110 영역):

```diff
@@ L107-111 (AppShell render)
   return (
     <div style={{ display: 'flex', height: '100vh', background: '#fff' }}>
       {/* 사이드바 (데스크탑만) */}
-      {!mobile && <Sidebar />}
+      {/* mobile-perf-03 R-02: Sidebar lazy + Suspense (모바일 entry 에서 dnd-kit 제거) */}
+      {!mobile && (
+        <Suspense fallback={<div style={{ width: 210 }} />}>
+          <Sidebar />
+        </Suspense>
+      )}
```

**LOC (App.jsx)**: +4 / -1. 순증 +3.
**리스크**: 낮음. `lazy` 와 `Suspense` 모두 이미 [App.jsx L1](../../src/App.jsx#L1) 에 import 되어 있음. fallback width 210 은 [Sidebar.jsx L18](../../src/components/layout/Sidebar.jsx#L18) 의 `S.sidebarW: 210` 과 정확 일치 (v3 — 적대적 재리뷰 C2 fix, 1차 v2 의 240 은 잘못된 수치). collapsed 시 (S.collapsedW: 52) 는 사용자 toggle 후 짧은 시간만 — acceptable.

---

## 4. 작업 순서

```
Phase 1, 2 와 독립
  ↓
C1 (vite.config.js manualChunks + App.jsx Sidebar lazy)
  ↓ 빌드 + 검증
```

**Decision**: chunk 분리 + Sidebar lazy 가 함께 적용되어야 W1 fix 효과 — 단일 커밋으로 묶음.

---

## 5. 검증 절차

### 5-1. 빌드 검증

```bash
npm run build
```

**검증**:
1. 빌드 출력에 `vendor-dnd-*.js` chunk 표시 (예: `vendor-dnd-XXXX.js  30.XX kB │ gzip: 9.XX kB`)
2. 매트릭스/Sidebar/프로젝트 chunk size 감소 (`ls -la dist/assets/`)
3. PWA manifest 확인 (`grep "vendor-dnd" dist/sw.js` 또는 precache list)
4. **AC-05 (W1 핵심) — modulepreload 검증**:
   ```bash
   grep "modulepreload" dist/index.html
   # vendor-dnd-*.js 가 modulepreload 에 없어야 함 (모바일 entry 에서 진짜 lazy)
   ```
   결과: `vendor-react`, `vendor-state`, `vendor-supabase` 는 entry 직접 의존 → modulepreload 에 있음 (정상). `vendor-dnd` 는 Sidebar/UnifiedGridView 가 lazy 라 entry 의 정적 의존 그래프에 없음 → modulepreload 에 **없어야** 함.

### 5-2. 런타임 검증

```bash
npm run preview
```

**모바일 viewport** (Chrome DevTools mobile emulation, 예: iPhone 12 Pro):
5. localStorage 비우기 + memory view 진입 시뮬레이션 (예: `localStorage.setItem('currentView', 'memory')` 또는 URL 직접 진입) → DevTools Network → vendor-dnd-*.js 요청 **부재** (AC-06).
   **v3 추가 (적대적 재리뷰 W4)**: idle 콜백 발동 시점 (마운트 후 ~3초) 이후 추가 4초 대기 (총 7초) 후 Network 패널 재확인. Phase 1 미적용 상태에서 false positive (idle 발동 전 검증 = pass 처럼 보임) 방지.
6. 매트릭스 진입 → vendor-dnd 가 UnifiedGridView lazy 와 병렬 fetch (AC-07)
7. 매트릭스 → 노트 전환 → 노트 진입 시 추가 vendor-dnd fetch 없음 (캐시)

**데스크탑 viewport** (정상):
8. 첫 진입 → Sidebar 영역에 잠시 fallback (width 210 빈 div) 후 Sidebar 렌더
9. DevTools Network → Sidebar lazy chunk + vendor-dnd 가 entry 직후 병렬 fetch
10. 매트릭스 진입 → vendor-dnd 캐시 hit

### 5-3. dnd 동작 회귀 (spec §7-3)

11. 매트릭스 cell 안 task reorder
12. 매트릭스 cross-project drag
13. 매트릭스 focus drop
14. 매트릭스 ms group reorder
15. Sidebar BacklogPanel drag (데스크탑)
16. 프로젝트 뷰 ms tab reorder
17. 타임라인 drag
18. 모바일 touch drag

### 5-4. resize 회귀

19. 데스크탑 → 모바일 resize → Sidebar 언마운트, vendor-dnd 캐시 유지
20. 모바일 → 데스크탑 resize → Sidebar lazy 첫 트리거 (idle preload 미포함) → fetch 수십~수백 ms 후 렌더 (fallback width 210 표시)

### 5-5. 캐시 / 배포

21. 매트릭스 코드 1줄 수정 → 재빌드 → vendor-dnd hash 무변경 (AC-14)

### 5-6. PWA offline

22. DevTools Application → Service Workers → Offline → 매트릭스 진입 → 정상 (AC-16)

### 5-7. 회귀 위험 모니터링

- **W1 핵심 검증**: `dist/index.html` modulepreload 에 vendor-dnd 부재 확인 (5-1 항목 4번). 만약 modulepreload 에 포함되면 → spec 의 lazy 가정 깨짐 → 추가 조사 필요 (Sidebar 외 다른 entry path 에서 dnd-kit 사용 가능성).
- **데스크탑 Sidebar fallback flicker**: 첫 페인트 시 width 210 빈 div → Sidebar 등장. layout shift 없음 (width 일치). 시각적 차이 acceptable. 사용자 불만 시 별도 Loop 에서 skeleton 도입.
- **Sidebar 가 lazy 라 Sidebar 안의 hooks (예: useNotifications) 도 lazy**: 첫 페인트 후 Sidebar lazy chunk 도착 시 hooks 활성화. 알림 polling 등이 ~수백 ms 늦게 시작 — 정상 (Phase 1 의 alarm engine defer 와 일관).

---

## 6. 미해결 / 후속

- ~~W1 Sidebar static import~~ → R-02 fix (lazy + Suspense)
- ~~W2 idle preload 의 UnifiedGridView~~ → 모바일에선 Phase 1 으로 제거됨. 데스크탑은 acceptable
- ~~W3 sw.js 검증~~ → 5-1 항목 3번에 추가
- ~~AC-06 달성 가능성~~ → modulepreload 검증으로 보강
- **별도 후속**: Sidebar Suspense fallback skeleton 도입 (시각 polish)
- **별도 후속**: Bundle analyzer 도입
- **별도 후속**: `@dnd-kit/modifiers` 등 추가 패키지 도입 시 vendor-dnd 배열 갱신
