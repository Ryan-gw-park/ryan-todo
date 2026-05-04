---
phase: mobile-perf-03-dnd-chunk
source: inline-recon (대화 내 코드베이스 진단) + 적대적 리뷰 결함 반영
date: 2026-04-30
status: spec-v4 (적대적 재리뷰 v3 결함 반영)
prev: mobile-perf-02-loadall-split
next: diff-plan
---

# mobile-perf-03 Spec v4 — `@dnd-kit` vendor chunk + Sidebar lazy import (적대적 재리뷰 v3 결함 반영)

> **목표**: `@dnd-kit/*` vendor chunk 분리 + `Sidebar` lazy import 로 모바일 entry chunk 에서 dnd-kit 제거.
> **변경 파일 2개 (vite.config.js + App.jsx), 코드 LOC 순증가 ~5, DB/API/패키지 무변경.**
> **R-ATOMIC 1 커밋 (chunk 분리 + Sidebar lazy 가 함께 적용되어야 효과 발현)**.
> **v2 차이**: 적대적 리뷰 W1 (Sidebar static import 결함) 의 근본 원인 해결 — Sidebar 를 lazy 로 전환하여 모바일 첫 페인트 시 vendor-dnd 미로드 보장.

---

## 0. Phase 1 머지 verification (필수 — 적대적 재리뷰 C1)

Phase 3 의 모바일 AC-06 은 **Phase 1 R-02 (모바일 idle preload 분기)** 적용을 전제. 본 Phase 실행 전 검증:

```bash
# v4 (적대적 재리뷰 C1 fix): Phase 1 R-02 의 mobile 분기 단독 검증.
# v3 의 -E "(...|MemoryView)" 는 false positive (MemoryView 는 Phase 1 적용 전/후 모두 존재).
grep -A 10 "Idle 프리로드" src/App.jsx | grep -F "if (mobile)"
# 출력 없으면 Phase 1 미적용 → STOP
```

위 검증 실패 시 → Phase 3 실행 중단, Phase 1 머지 후 진행.

---

## 1. Scope (수정 대상 2개 파일)

| 파일 | 변경 요약 |
|---|---|
| [vite.config.js](../../vite.config.js) | `manualChunks` 에 `'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities']` 항목 추가 |
| [src/App.jsx](../../src/App.jsx) | `Sidebar` static import 를 `React.lazy` 로 전환. `{!mobile && <Sidebar />}` 렌더 시 `<Suspense fallback={null}>` 으로 감쌈. 모바일 entry chunk 에서 dnd-kit 제거 |

**변경 없음**: DB / RLS / Edge Function / API / 환경 변수 / 패키지 / src 다른 파일 / 다른 설정.

---

## 2. 요구사항

### R-01 — `@dnd-kit/*` 를 `vendor-dnd` chunk 로 분리

**현상**: [vite.config.js:10-15](../../vite.config.js#L10) 의 `manualChunks` 가 `vendor-react`, `vendor-supabase`, `vendor-state` 만 분리. dnd-kit 은 default chunk 분배 → 매트릭스/사이드바 chunk 에 inline.

**요구**:
1. `manualChunks` 에 신규 entry:
   ```js
   'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
   ```
2. 빌드 시 `dist/assets/vendor-dnd-*.js` 생성. 사용 chunk 에서 dnd-kit 코드 추출.
3. PWA `vite-plugin-pwa` 의 `injectManifest` `globPatterns: ['**/*.{js,...}']` 가 자동 포함.

### R-02 — `Sidebar` lazy import 로 모바일 entry chunk 에서 dnd-kit 제거 (W1 fix)

**현상**: [App.jsx:17](../../src/App.jsx#L17) 가 `Sidebar` 를 static import. [Sidebar.jsx:3-5](../../src/components/layout/Sidebar.jsx#L3) 가 `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` 를 static import. → entry 모듈 그래프에 dnd-kit 포함 → 모바일에서 Sidebar 가 렌더 안 되는데도 dnd-kit 이 entry 와 함께 즉시 fetch.

**적대적 리뷰 W1 의 결함**: spec v1 의 AC-06 ("노트 뷰 첫 진입 시 vendor-dnd 미로드"), E2, R-01 §3 의 "lazy fetch" 가정이 거짓이었음. v2 는 이를 근본 fix.

**요구**:
1. App.jsx 의 `Sidebar` import 를 `React.lazy` 로 전환:
   ```js
   const Sidebar = lazy(() => import('./components/layout/Sidebar'))
   ```
2. AppShell 의 `{!mobile && <Sidebar />}` 렌더를 Suspense 로 감쌈:
   ```jsx
   {!mobile && (
     <Suspense fallback={<div style={{ width: 210 }} />}>
       <Sidebar />
     </Suspense>
   )}
   ```
   fallback 의 width 는 [Sidebar.jsx L18](../../src/components/layout/Sidebar.jsx#L18) 의 `S.sidebarW: 210` 과 정확 일치 (적대적 재리뷰 C2 fix — 1차 v2 의 240 은 잘못된 수치, 30px layout shift 야기). collapsed 시는 좁은 width (S.collapsedW: 52) — 시각적 차이 acceptable (사용자 toggle 후 짧은 시간만).

3. **결과**:
   - 모바일 (`mobile=true`) entry chunk: Sidebar/dnd-kit 코드 미포함. vendor-dnd 도 entry 와 무관하게 lazy.
   - 데스크탑 (`mobile=false`) 첫 페인트: AppShell render 시 Sidebar lazy import 트리거 → vendor-dnd 도 함께 fetch (병렬). Suspense fallback 으로 layout shift 최소.

4. **데스크탑에서의 영향**: 첫 페인트 시 Sidebar 가 Suspense fallback 표시 → 수십~수백 ms 후 Sidebar lazy chunk 도착 → 실제 Sidebar 렌더. **수용** — 데스크탑 첫 페인트 ~수백 ms 지연 가능. 사용자가 가장 먼저 사용하는 건 메인 view (매트릭스), Sidebar 는 보조 — Suspense 로 점진 표시 acceptable.

5. **Idle preload 와의 상호작용 (v3 — 적대적 재리뷰 C1: Phase 1 의존성 강화)**:

   **Phase 3 의 AC-06 ("모바일 노트 뷰 첫 진입 시 vendor-dnd 미로드") 는 Phase 1 R-02 (모바일 idle preload 분기 — MemoryView 만) 적용을 전제로 한다**. Phase 1 미적용 상태에서 Phase 3 단독 적용 시:
   - Sidebar lazy → entry chunk 에서 dnd-kit 제거 ✓
   - 그러나 idle 콜백 (~3초 후) 발동 → 모바일에서도 `UnifiedGridView` import → `vendor-dnd` fetch → AC-06 깨짐.

   **v3 결정**: Phase 1 → Phase 2 → Phase 3 순차 실행. Phase 3 의 R-00 verification 으로 Phase 1 머지 확인 (§0).

   - Phase 1 적용 후 모바일 idle preload 는 `MemoryView` 만 → vendor-dnd 안 끌어옴.
   - 데스크탑 idle preload 는 4 view 그대로 → `UnifiedGridView` lazy 가 idle 시 vendor-dnd fetch 발동 (수용 — entry chunk 에선 빠짐).
   - 모바일 첫 페인트 시 vendor-dnd 가 정말 lazy: Sidebar 미렌더 + idle preload 에 UnifiedGridView 없음 + entry render 시 personal-matrix 라 UnifiedGridView lazy 로 vendor-dnd 도 함께 fetch (entry 의 정적 의존 그래프 외).

### R-03 — 빌드 결과 검증

**요구**:
1. `npm run build` 후 `dist/assets/vendor-dnd-*.js` 생성.
2. 매트릭스/Sidebar/프로젝트 chunk size 가 변경 전 대비 감소.
3. **dist/index.html 의 modulepreload 검증** (적대적 리뷰 권장):
   ```bash
   grep "modulepreload" dist/index.html
   ```
   - `vendor-dnd-*.js` 가 modulepreload 에 **없어야** 모바일 첫 페인트 시 lazy 효과 보장.
   - `vendor-react`, `vendor-state` 등 entry 직접 의존은 modulepreload 에 있어도 정상.
4. PWA precache 에 `vendor-dnd-*.js` 포함 (offline 대응).

### R-04 — 캐시 무효화 분리

**요구**:
1. 매트릭스 코드만 수정 시 `vendor-dnd-*.js` hash 무변경 → 브라우저 캐시 hit.
2. dnd-kit 패키지 업그레이드 시 hash 변경 → 강제 재다운로드.
3. PWA service worker 가 신규 chunk 를 manifest 에 자동 포함.

---

## 3. Non-Goals

| # | 비요구사항 | 근거 |
|---|---|---|
| N-01 | dnd-kit 자체를 lazy import (각 컴포넌트 dynamic import) | 매트릭스 entry 가 useDraggable 직접 사용 → static import 자연. 복잡도 ↑ |
| N-02 | 모바일 dnd 비활성 | 매트릭스 drag 모바일도 동작. 비활성 시 회귀 |
| N-03 | dnd-kit 외 다른 라이브러리 chunk 분리 (예: lucide-react) | 별도 후속 |
| N-04 | vite build target / minify 변경 | 별도 검토 |
| N-05 | PWA precache 전략 변경 | injectManifest 그대로 |
| N-06 | vendor-react / vendor-supabase / vendor-state chunk 변경 | 본 Phase 외 |
| N-07 | Bundle analyzer 도입 | 별도 후속 |
| N-08 | Sidebar 자체의 dnd-kit 사용 변경 (사이드바 기능 변경) | 본 Phase 는 import 시점만 lazy 화 |
| N-09 | 데스크탑 첫 페인트 Sidebar fallback 의 시각적 polish | 단순 fixed-width div fallback 수용 |

---

## 4. Edge Cases

| Case | 입력 | 기대 동작 |
|---|---|---|
| E1 | 모바일 첫 진입 (personal-matrix) | main entry → vendor-react → useStore → AppShell → Sidebar 미렌더 (`{!mobile && ...}`) → Sidebar lazy 미트리거 → vendor-dnd 미fetch. UnifiedGridView lazy 트리거 시점에 vendor-dnd 도 병렬 fetch |
| E2 | 모바일 첫 진입 (memory) | UnifiedGridView 도 미트리거 → vendor-dnd 미fetch. MemoryView 만 fetch |
| E3 | 데스크탑 첫 진입 | AppShell render 시 Sidebar lazy 트리거 → Sidebar chunk + vendor-dnd 병렬 fetch. Suspense fallback (width 210 div) 표시 → 수십~수백 ms 후 Sidebar 렌더 |
| E4 | 데스크탑 → 모바일 resize | mobile=true → Sidebar 언마운트. vendor-dnd 는 이미 fetch → 캐시. 매트릭스에서 계속 사용 |
| E5 | 모바일 → 데스크탑 resize | mobile=false → Sidebar lazy 첫 트리거 (idle preload 에 미포함). Sidebar chunk + vendor-dnd fetch (캐시 없을 시 수십~수백 ms) → fallback 표시 → Sidebar 렌더 |
| E6 | 매트릭스 코드 수정 → 재빌드 | vendor-dnd hash 무변경 (R-04) |
| E7 | dnd-kit 업그레이드 → 재빌드 | vendor-dnd hash 변경 (R-04) |
| E8 | PWA offline | service worker manifest 의 vendor-dnd precache → 정상 |
| E9 | 매트릭스 task drag | dnd 동작 정상 |
| E10 | 사이드바 task drag (BacklogPanel, 데스크탑) | dnd 동작 정상 (vendor-dnd 도착 후) |

---

## 5. Acceptance Criteria

### 5-1. 빌드 결과

- [ ] AC-01: `npm run build` 성공
- [ ] AC-02: `dist/assets/vendor-dnd-*.js` 1개 생성
- [ ] AC-03: 매트릭스/사이드바/프로젝트 chunk size 감소
- [ ] AC-04: PWA manifest (`dist/sw.js` 또는 precache list) 에 vendor-dnd 포함
- [ ] AC-05 (W1 핵심): `dist/index.html` 의 modulepreload 에 `vendor-dnd-*.js` **부재** (모바일 entry 에서 진짜 lazy)

### 5-2. 런타임 동작

- [ ] AC-06 (W1 핵심): 모바일 첫 진입 (memory view) → vendor-dnd-*.js 미로드. **idle 발동 후 4초 추가 대기 후 재확인** (적대적 재리뷰 W4 — Phase 1 미적용 상태에서의 false positive 방지)
- [ ] AC-07: 모바일 매트릭스 첫 진입 → vendor-dnd 가 UnifiedGridView lazy 와 함께 병렬 fetch
- [ ] AC-08: 데스크탑 첫 진입 → Sidebar lazy + vendor-dnd 병렬 fetch. Suspense fallback 표시 후 Sidebar 렌더
- [ ] AC-09: 매트릭스 task drag (cell 안 reorder, cross-project, focus drop, ms reorder) 정상
- [ ] AC-10: Sidebar BacklogPanel drag 정상
- [ ] AC-11: 프로젝트 뷰 ms reorder, hierarchical tree drag 정상
- [ ] AC-12: 타임라인 drag 정상
- [ ] AC-13: 모바일 touch drag (TouchSensor delay 200, tolerance 5) 정상

### 5-3. 캐시 / 배포

- [ ] AC-14: 매트릭스 코드 수정 후 vendor-dnd hash 무변경 (캐시 hit)
- [ ] AC-15: dnd-kit 업그레이드 시 hash 변경
- [ ] AC-16: PWA offline 모드 매트릭스 정상

### 5-4. 빌드 / 품질

- [ ] AC-17: ESLint 경고 추가 없음
- [ ] AC-18: 1 커밋 R-ATOMIC

---

## 6. 커밋 계획 (R-ATOMIC 1 커밋)

```
Commit 1: build(vite): split @dnd-kit into vendor-dnd chunk + lazy Sidebar
            (R-01 + R-02 + R-03 + R-04, ~+5 / -1 LOC)
            - vite.config.js manualChunks 에 'vendor-dnd' entry 추가
            - App.jsx 의 Sidebar import → React.lazy
            - AppShell 의 Sidebar 렌더를 Suspense (fallback width 210 div) 로 감쌈
            - 모바일 entry chunk 에서 dnd-kit 제거 (W1 fix)
            - 데스크탑 첫 페인트 Sidebar 점진 표시 (acceptable)
```

**의존성**: Phase 1, Phase 2 와 독립.

---

## 7. 회귀 테스트 시나리오

### 7-1. 빌드 검증

1. `npm run build`
2. `dist/assets/` → vendor-dnd-*.js 존재
3. chunk size 비교 (변경 전/후)
4. PWA manifest 검증
5. **modulepreload 검증** (W1 핵심):
   ```bash
   grep -E "modulepreload.+vendor-dnd" dist/index.html
   # 결과 없어야 함 (vendor-dnd 가 modulepreload 에 없음 = 진짜 lazy)
   ```

### 7-2. 런타임 검증 (개발 + 빌드 미리보기)

6. `npm run preview` + 모바일 viewport (Chrome DevTools mobile emulation)
7. 노트 뷰 첫 진입 (예: localStorage 에 currentView='memory' 강제) → DevTools Network 에서 vendor-dnd-*.js 미로드 (AC-06)
8. 매트릭스 첫 진입 → vendor-dnd 가 UnifiedGridView 와 병렬 fetch (AC-07)
9. 데스크탑 viewport 첫 진입 → Sidebar 영역에 잠시 fallback (width 210 빈 div) → Sidebar 렌더 (AC-08)
10. 매트릭스 → 노트 → 매트릭스 → 두 번째 진입 시 vendor-dnd 캐시 hit (304/disk)

### 7-3. dnd 동작 회귀 (Spec §4 E9-E10)

11. 매트릭스 cell 안 task reorder
12. 매트릭스 cross-project drag
13. 매트릭스 focus drop
14. 매트릭스 ms group reorder
15. Sidebar BacklogPanel drag
16. 프로젝트 뷰 ms tab reorder
17. 타임라인 drag
18. 모바일 touch drag (Chrome DevTools mobile emulation 또는 실 디바이스)

### 7-4. resize / 캐시 / 배포

19. 모바일 → 데스크탑 resize → Sidebar lazy 트리거, fallback → 렌더
20. 데스크탑 → 모바일 resize → Sidebar 언마운트
21. 매트릭스 코드 1줄 수정 → 재빌드 → vendor-dnd hash 무변경 (AC-14)
22. (선택) dnd-kit 가상 업그레이드 → vendor-dnd hash 변경 검증 후 원복

### 7-5. PWA offline

23. DevTools Application → Service Workers → Offline → 매트릭스 진입 → 정상 (precache 의 vendor-dnd 사용)

---

## 8. 미해결 / 후속

- ~~W1 Sidebar static import 로 entry chunk 에 dnd-kit 포함~~ → R-02 fix (Sidebar lazy import + Suspense)
- ~~W2 idle preload 의 UnifiedGridView 가 vendor-dnd 끌어옴~~ → 데스크탑 한정 acceptable (모바일은 Phase 1 R-02 로 idle preload 에서 UnifiedGridView 제거됨). spec §2 R-02 #5 명시
- ~~W3 src/sw.js 검증 절차~~ → 7-1 4번에 PWA manifest 검증 추가
- ~~AC-06 달성 가능 여부~~ → R-02 fix 후 달성 가능 (modulepreload 부재 검증으로 보강)
- **별도 후속**: Bundle analyzer (vite-plugin-visualizer)
- **별도 후속**: lucide-react 셰이킹 / chunk
- **별도 후속**: `@dnd-kit/modifiers` 등 추가 도입 시 vendor-dnd 배열 갱신
- **별도 후속**: 데스크탑 Sidebar Suspense fallback 의 시각 polish (skeleton 등)
