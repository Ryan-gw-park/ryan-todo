---
phase: mobile-perf-01-quick-wins
source: inline-recon (대화 내 코드베이스 진단) + 적대적 리뷰 결함 반영
date: 2026-04-30
status: spec-v4 (적대적 재리뷰 v3 결함 반영)
prev: (none — 인라인 리콘)
next: diff-plan
---

# mobile-perf-01 Spec v2 — Quick Wins (적대적 리뷰 결함 반영)

> **목표**: 모바일 개인 모드에서 첫 페인트(TTI) 단축. "개인 할일"(personal-matrix) 과 "노트"(memory) 두 뷰만 사용 가정.
> **변경 파일 3개, 코드 LOC 순증가 ~50, DB/API/패키지 무변경.**
> **R-ATOMIC 3 커밋**.
> **v2 차이**: 적대적 리뷰의 W1~W6, EC-1, EC-2 모두 반영. milestones race + optimistic 보존 + idle timeout + cleanup 추가.

---

## 1. Scope (수정 대상 3개 파일)

| 파일 | 변경 요약 |
|---|---|
| [src/hooks/useStore.js](../../src/hooks/useStore.js) | `loadAll` 의 `key_milestones` 쿼리를 main `set()` 다음으로 분리 (fire-and-forget). **추가**: sequence guard (`_msLoadSeq` module-level), `.catch()`, 팀 전환 감지 시 set(patch) skip, optimistic insert/delete 보존 merge, 빈 projectIds 분기. **v4 추가**: `_pendingDeleteMilestoneIds` Set + `deleteMilestone` 에 add/delete 호출 (외부 추가 영구 손실 방지). |
| [src/App.jsx](../../src/App.jsx) | Idle preload 목록을 mobile 분기로 축소. **추가**: `requestIdleCallback` 에 `{ timeout: 3000 }` 옵션, `cancelIdleCallback` cleanup. |
| [src/hooks/useAlarmEngine.js](../../src/hooks/useAlarmEngine.js) | `useEffect` 본체를 `requestIdleCallback` 으로 감쌈. **추가**: `{ timeout: 4000 }` 옵션. |

**변경 없음**: DB / RLS / Edge Function / API / 환경 변수 / 패키지 / vite.config.js.

---

## 2. 요구사항

### R-01 — `loadAll` 의 milestones 쿼리 분리 (fire-and-forget) + race / optimistic / catch / 빈배열 가드

**현상**: [useStore.js:518-530](../../src/hooks/useStore.js#L518) 의 `key_milestones` 쿼리가 main `Promise.all` 직후에 직렬 await. 첫 페인트 차단. **MemoryView 는 milestones 미사용**.

**v2 추가 요구 (적대적 리뷰 W1, W2, W3, W4/EC-2, EC-1)**:

1. **현재 위치 (L518-530) 의 milestones 쿼리 블록 삭제**, main `set(patch)` 호출 (L556) 이후로 이동.

2. **main `patch` 객체에서 milestones 제거** (L537):
   ```js
   const patch = { collapseState: cs, syncStatus: 'ok', userTaskSettings: mergedUts }
   ```

3. **W2 v3 — 팀 전환 감지 시 set(patch) 자체를 skip (적대적 재리뷰 C1 fix)**:
   1차 v2 의 `patch.milestones = []` 만 추가하는 fix 는 결함 — `patch` 에 이미 `tasks/projects/memos` 가 포함되어 있어 stale 팀 데이터가 새 팀 store 에 적용됨. v3 는 set(patch) 자체를 skip:
   ```js
   const prevTeamId = get().currentTeamId  // patch 직전 시점
   if (teamId !== prevTeamId) {
     // stale 팀 데이터 — tasks/projects/memos/milestones 모두 적용 금지
     // 새 loadAll cycle 이 곧 새 teamId 로 진입할 것 (App.jsx 의 effect chain).
     // 본 cycle 의 stage 1 결과는 폐기. milestones 만 reset (이전 표시 정리).
     set({ milestones: [], syncStatus: 'ok' })
   } else {
     set(patch)
   }
   ```

   > **Note**: prevTeamId 비교는 set(patch) 직전에. teamId(L396 캡처) 와 다르면 stage 1 응답이 이전 팀 데이터 → 새 팀 store 진입 차단.

4. **W1 — sequence guard 도입 (module-level)**:
   파일 상단(`_loadAllRunning` 옆)에 추가:
   ```js
   let _msLoadSeq = 0
   ```
   loadAll 내부 fire-and-forget 시작 시:
   ```js
   const mySeq = ++_msLoadSeq
   ```
   `.then()` 안:
   ```js
   if (mySeq !== _msLoadSeq) return  // stale 응답 무시
   ```

5. **EC-1 + W4/EC-2 v4 (적대적 재리뷰 v3 C1 fix) — 빈 projectIdsList 분기 + pendingDelete Set 으로 정확한 merge**:

   **v3 결함**: v3 의 `dbFiltered = res.data.filter(curIds.has)` 는 "DB 에만 있고 cur 에 없는 항목 = optimistic delete" 로 가정 → 그러나 다른 device 에서 추가한 milestone 도 같은 패턴 (cur 에 없음) → **외부 추가 영구 손실** (팀 sync 파괴).

   **v4 fix**: optimistic delete 를 별도 module-level Set 으로 명시 추적 → 외부 추가와 구분.

   파일 상단에 추가:
   ```js
   let _msLoadSeq = 0  // 기존
   const _pendingDeleteMilestoneIds = new Set()  // v4 추가
   ```

   `deleteMilestone` (L1328) 수정 — set 호출 전 add, DB 작업 완료 후 delete:
   ```js
   deleteMilestone: async (id) => {
     const d = db()
     if (!d) return
     _pendingDeleteMilestoneIds.add(id)  // v4: optimistic delete 추적
     set(s => ({
       milestones: s.milestones.filter(m => m.id !== id),
       tasks: s.tasks.map(t => t.keyMilestoneId === id ? { ...t, keyMilestoneId: null } : t),
     }))
     try {
       const { error } = await d.from('key_milestones').delete().eq('id', id)
       if (error) console.error('[useStore] deleteMilestone:', error)
       await d.from('tasks').update({ key_milestone_id: null, updated_at: new Date().toISOString() }).eq('key_milestone_id', id)
     } finally {
       _pendingDeleteMilestoneIds.delete(id)  // v4: DB 작업 종료 시점에 해제
     }
   },
   ```

   merge 로직 (set(patch) 다음 fire-and-forget 블록):
   ```js
   const projectIdsList = projects.map(p => p.id)
   if (projectIdsList.length === 0) {
     // EC-1: 모든 project 삭제 case — milestones 도 빈 상태로 sync
     if (get().milestones.length > 0) set({ milestones: [] })
   } else {
     const mySeq = ++_msLoadSeq
     d.from('key_milestones')
       .select(...)
       .in('project_id', projectIdsList)
       .order('sort_order')
       .then(res => {
         if (mySeq !== _msLoadSeq) return  // W1 stale guard
         if (res.error) {
           console.warn('[Ryan Todo] milestones (deferred):', res.error.message)
           return
         }
         if (!res.data) return
         // v4 — optimistic insert + delete 정확 보존 (외부 추가 손실 방지):
         //   - DB 응답에서 pendingDelete 항목 제외 (delete 보존)
         //   - cur 에만 있고 pendingDelete 도 아닌 항목 = optimistic insert → 보존
         //   - DB 에만 있고 cur 에 없는 항목 = 외부 추가 → 포함 (자동 — pendingDelete 제외 후 그대로)
         //   - 양쪽 다 있는 항목 = DB 값 우선 (update race 는 N-10 acceptable)
         const cur = get().milestones
         const dbFiltered = res.data.filter(m => !_pendingDeleteMilestoneIds.has(m.id))
         const dbIds = new Set(dbFiltered.map(m => m.id))
         const optimisticInserts = cur.filter(m => !dbIds.has(m.id) && !_pendingDeleteMilestoneIds.has(m.id))
         // 중복 방지 위해 Map 으로 dedupe (이론상 dbIds + optimisticInserts 가 disjoint 라 불필요하지만 안전망)
         const merged = new Map()
         for (const m of dbFiltered) merged.set(m.id, m)
         for (const m of optimisticInserts) if (!merged.has(m.id)) merged.set(m.id, m)
         set({ milestones: Array.from(merged.values()) })
       })
       .catch(e => {  // W3 — Unhandled Promise Rejection 방지
         if (mySeq !== _msLoadSeq) return
         console.warn('[Ryan Todo] milestones (deferred) network:', e?.message || e)
       })
   }
   ```

   **v4 fix 결과**:
   - optimistic delete 보존: pendingDelete 가 DB 응답에서 제외 → 사용자 삭제 직후 polling 도착해도 부활 안 됨
   - 외부 추가 보존: cur 에 없는 DB 항목 (pendingDelete 제외) 은 그대로 포함 → 다른 device 추가가 정상 반영
   - optimistic insert 보존: addMilestone 이 pessimistic 패턴이라 보통 DB 응답에 이미 포함. 만약 race 로 cur 에만 있으면 보존

6. **Merge 의 의미 (v4)**: `_pendingDeleteMilestoneIds` Set 으로 사용자 의도(delete) 를 명시 추적, 외부 추가와 구분.
   - `_pendingDeleteMilestoneIds.has(id)` = 사용자가 직접 삭제 진행 중 → DB 응답에서 제외
   - cur 에 있는 DB 항목 = 정상 sync → 포함
   - cur 에 없는 DB 항목 (pendingDelete 제외) = 외부 추가 → 포함 (보존)
   - cur 에만 있는 항목 = optimistic insert → 보존 (insert race 시점)

7. **Snapshot 저장 (L564-569) 영향 없음**: 기존 동작 보존.

8. **`_loadAllRunning` flag**: 기존 finally (L580) 위치 유지. milestones fire-and-forget 와 무관.

### R-02 — 모바일 idle preload 축소 + cleanup + timeout (v3 — fallback timeout 일치)

**현상**: [App.jsx:54-62](../../src/App.jsx#L54) 가 idle 시 4개 preload. 모바일에선 사실상 timeline/project 미사용.

**v3 추가 요구 (적대적 재리뷰 W1 fix)**: setTimeout fallback 이 timeout 옵션을 honor 하도록 시그니처 변경.

1. AppShell 의 idle preload `useEffect` 에 mobile 분기 + cleanup + fallback timeout 인자 honor:
   ```jsx
   useEffect(() => {
     // v3: fallback 도 timeout 인자 honor — opts?.timeout 또는 default 2000
     const idle = window.requestIdleCallback || ((cb, opts) => setTimeout(cb, opts?.timeout ?? 2000))
     const handle = idle(() => {
       if (mobile) {
         import('./components/views/MemoryView')
       } else {
         import('./components/views/UnifiedGridView')
         import('./components/views/ProjectView')
         import('./components/views/InlineTimelineView')
         import('./components/views/MemoryView')
       }
     }, { timeout: 3000 })

     return () => {
       if (window.cancelIdleCallback) window.cancelIdleCallback(handle)
       else clearTimeout(handle)
     }
   }, [mobile])
   ```

2. **timeout 의미**: requestIdleCallback 의 두 번째 인자 `{ timeout }` — 바쁜 탭에서도 N ms 후 강제 발동 보장. v3: setTimeout fallback 도 동일 timeout 사용 (지원/미지원 환경 일관).

3. **cleanup**: deps `[mobile]` 변경 시 또는 unmount 시 idle 콜백 취소. 중복 등록 방지. handle type 은 number (둘 다) 라 cancelIdleCallback / clearTimeout 모두 number 받음.

4. **데스크탑 동작 보존**: `mobile === false` 분기는 기존 4-preload.

### R-03 — `useAlarmEngine` idle defer + timeout

**현상**: [useAlarmEngine.js:17-51](../../src/hooks/useAlarmEngine.js#L17) main `useEffect` 가 마운트 즉시 실행 (Notification permission, checkAlarms, setInterval).

**v3 추가 요구 (적대적 재리뷰 W1 fix — fallback timeout honor)**:

1. main `useEffect` 본체를 `requestIdleCallback({ timeout: 4000 })` 으로 감쌈. fallback 도 timeout 인자 honor:
   ```js
   useEffect(() => {
     // v3: fallback 도 timeout 인자 honor
     const idle = window.requestIdleCallback || ((cb, opts) => setTimeout(cb, opts?.timeout ?? 2000))
     let cancelled = false
     let cleanupFn = null

     const handle = idle(() => {
       if (cancelled) return
       // ... 기존 본체 ...
       cleanupFn = () => { ... }
     }, { timeout: 4000 })  // W5 — 바쁜 탭에서도 4초 안에 강제 발동

     return () => {
       cancelled = true
       if (window.cancelIdleCallback) window.cancelIdleCallback(handle)
       else clearTimeout(handle)
       if (cleanupFn) cleanupFn()
     }
   }, [])
   ```

2. **timeout 의미**: 모바일 매트릭스 DnD 애니메이션 등으로 메인 스레드 바쁠 때도 4초 안에 alarm engine 시작 보장. 바쁜 탭 + 알람 발사 누락 시나리오 차단.

3. **cancelIdleCallback**: handle 받아 cleanup 시 취소. cancelled flag 와 이중 안전망.

4. **알람 정확도**: 4s + 60s polling = 알람 시각 대비 최대 ~5s 지연. 1분 알림 정확도 안에서 무영향.

---

## 3. Non-Goals (N-XX)

| # | 비요구사항 | 근거 |
|---|---|---|
| N-01 | 모바일 alarm engine 완전 비활성 | 알림 필수 |
| N-02 | 매트릭스 milestones 미사용 | UnifiedGridView group 보존 |
| N-03 | `loadAll` main Promise.all 분할 | Phase 2 |
| N-04 | dnd-kit chunk 분리 | Phase 3 |
| N-05 | `initTeamState` team_members 캐시 | 별도 Loop |
| N-06 | Service Worker 등록 시점 변경 | main.jsx 영역 |
| N-07 | 데스크탑 idle preload 축소 | 데스크탑 사이드바 즉시 view 전환 — 4 preload 유지 |
| N-08 | UnifiedGridView 의 milestones=[] 시각 처리 변경 | 기존 동작 |
| N-09 | Snapshot 에 milestones 추가 | trade-off 부적절 |
| N-10 | Optimistic update/delete 의 timestamp 기반 정합성 | 본 Phase 는 add(insert) 의 race 만 처리 |
| N-11 | Sidebar 의 dnd-kit static import 변경 (vendor-dnd lazy 화) | Phase 3 영역 |

---

## 4. Edge Cases

### 4-1. R-01 (milestones defer + race / optimistic)

| Case | 입력 | 기대 동작 |
|---|---|---|
| M1 | 콜드 스타트, snapshot 없음 | tasks/projects/memos 먼저 페인트 → 수백 ms 후 milestones 도착 → 매트릭스 milestone label/group 갱신 |
| M2 | 매트릭스 진입 시 milestones 도착 전 | milestones=[] 로 매트릭스 렌더, 도착 시 자연 갱신 |
| M3 | 노트 뷰만 사용 | fetch 1회 발생하지만 첫 페인트 차단 없음 |
| M4 | milestones fetch HTTP 에러 (`res.error`) | console.warn, milestones 기존값 유지 |
| M5 | milestones fetch 네트워크 단절 (Promise reject) | `.catch()` 로 console.warn, Unhandled Promise Rejection 없음 (W3) |
| M6 | 두 polling cycle 의 fetch 가 순서 역전 (1차가 늦게 도착) | `_msLoadSeq` 가드 → 1차 무시, 2차 적용 (W1) |
| M7 | 팀 전환 직후 매트릭스 표시 | set(patch) 안에 `milestones: []` 포함 → 즉시 reset, 새 fetch 도착 시 새 팀 데이터 (W2) |
| M8 | 사용자가 milestone 추가 (optimistic) → 그 직후 deferred fetch 응답 도착 | DB 응답에 신규 milestone 미포함 시 → merge by id 로 optimistic 보존 (W4/EC-2). DB 응답에 포함 시 → 양쪽 동일 → DB 값 우선 |
| M9 | 모든 project 삭제 → projectIdsList=[] | fetch skip + `milestones: []` 강제 sync (EC-1) |
| M10 | 사용자가 milestone update/delete (optimistic) → fetch 응답이 이전 상태 | optimistic 일시 롤백 (acceptable). 다음 cycle 에서 정합 (N-10) |

### 4-2. R-02 (idle preload 축소)

| Case | 입력 | 기대 동작 |
|---|---|---|
| P1 | 모바일 첫 진입 → personal-matrix | UnifiedGridView lazy (entry render 시), idle 시 MemoryView |
| P2 | 모바일 currentView=memory 직접 진입 (URL/snapshot) | MemoryView idle preload → 거의 즉시 표시 |
| P3 | resize 모바일↔데스크탑 빈번 | deps `mobile` 변경 → cleanup → cancelIdleCallback → 새 idle 등록 (W6 fix) |
| P4 | 데스크탑 첫 진입 | 4 preload |
| P5 | unmount 시점에 idle 콜백 미발동 | cleanup 으로 cancel — leak 없음 |

### 4-3. R-03 (alarm engine defer + timeout)

| Case | 입력 | 기대 동작 |
|---|---|---|
| A1 | 마운트 후 ~2-4s 내 unmount | cancelled=true + cancelIdleCallback → setInterval 등록 안 됨 |
| A2 | requestIdleCallback 미지원 | setTimeout(2000) fallback. 2s 후 시작 |
| A3 | requestIdleCallback 지원 + 바쁜 탭 (애니메이션 지속) | timeout 4000 으로 4s 안에 강제 발동 (W5) |
| A4 | alarm 시각 도래 task 존재 + idle 시점 | idle 후 즉시 checkAlarms() — ~4s 지연 안에서 발사 (1분 정확도) |
| A5 | 데스크탑 (mobile 무관 공통 적용) | 동일하게 ~2-4s 지연. 1분 polling 안에서 무영향 |

---

## 5. Acceptance Criteria

### 5-1. 신규 동작

- [ ] AC-01: 콜드 스타트 시 매트릭스/노트 첫 페인트가 milestones 왕복 만큼 빠름
- [ ] AC-02: 매트릭스 첫 페인트 시 milestones 도착 전 ms group label blank → 도착 후 갱신
- [ ] AC-03: 노트 뷰 첫 페인트가 milestones 와 무관
- [ ] AC-04: 모바일 idle 단계에서 ProjectView/InlineTimelineView import 안 함
- [ ] AC-05: 데스크탑 idle 단계에서 4개 view preload (기존 동작)
- [ ] AC-06: alarm engine `Notification.requestPermission()` 시점이 마운트 ~2-4s 후 (Performance 검증)
- [ ] AC-07: alarm 발사 정확도 1분 이내 유지

### 5-2. v2 결함 fix 검증 (적대적 리뷰)

- [ ] AC-08 (W1): 두 polling cycle 의 milestones fetch 응답 순서 역전 시 stale 무시 — `_msLoadSeq` 가드 동작
- [ ] AC-09 (W2): 팀 전환 즉시 매트릭스에 이전 팀 milestone 표시 안 됨
- [ ] AC-10 (W3): 네트워크 단절 시 Unhandled Promise Rejection 콘솔 0건
- [ ] AC-11 (W4/EC-2): 사용자가 milestone 추가 (optimistic) → deferred fetch 응답 → optimistic milestone 보존
- [ ] AC-12 (W5): 바쁜 탭 (DevTools Performance 인공적 부하) 에서도 alarm engine 4s 안에 시작
- [ ] AC-13 (W6): resize 빈번 시 idle preload effect 의 cancelIdleCallback 정상 호출 (콘솔에 import 폭주 없음)
- [ ] AC-14 (EC-1): project 모두 삭제 → milestones 즉시 빈 배열로 sync

### 5-3. 회귀 방지

- [ ] AC-15: 매트릭스 milestone group 표시 정상 (도착 후)
- [ ] AC-16: Polling cycle milestones 재fetch (race guard 와 함께)
- [ ] AC-17: alarm 활성 task 존재 사용자 첫 진입 → ~2-4s 후 권한 prompt
- [ ] AC-18: alarm task 0건 사용자 → prompt 발생 안 함

### 5-4. 빌드 / 품질

- [ ] AC-19: `npm run build` 성공
- [ ] AC-20: ESLint 경고 추가 없음
- [ ] AC-21: 3 커밋 R-ATOMIC 분리

---

## 6. 커밋 계획 (R-ATOMIC 3 커밋)

```
Commit 1: perf(loadAll): defer milestones with race guard, optimistic merge, catch
            (R-01, ~+30 / -10 LOC)
            - milestones 쿼리를 set() 후로 이동
            - _msLoadSeq module-level sequence guard
            - .catch() 추가 (Unhandled Promise Rejection 방지)
            - 팀 전환 감지 시 set(patch) 안에 milestones:[] 포함
            - DB 응답 + optimistic merge by id
            - projectIdsList=[] 빈 배열 분기

Commit 2: perf(app-shell): trim mobile idle preload + idle timeout/cleanup
            (R-02, ~+12 / -3 LOC)
            - mobile 분기 (모바일은 MemoryView 만)
            - requestIdleCallback timeout 3000
            - cancelIdleCallback cleanup

Commit 3: perf(alarm-engine): defer setup with idle timeout + cancellable
            (R-03, ~+15 / -8 LOC)
            - main effect idle 콜백 wrap
            - timeout 4000 (바쁜 탭 보장)
            - cancelIdleCallback + cancelled flag 이중 안전망
```

**의존성**: 3 커밋 모두 독립.

---

## 7. 회귀 테스트 시나리오

### 7-1. R-01 검증

1. 콜드 스타트 → DevTools Network 응답 timing 확인
2. 매트릭스 진입 → label blank → 갱신 (jank 없음)
3. 노트 뷰 진입 → milestones 와 무관 표시
4. **W1 race**: DevTools Network throttling 으로 1차 fetch 인위적 지연 → 2차 도착 후 1차 도착 → store 의 milestones 가 2차 값 (`_msLoadSeq` 동작)
5. **W3 catch**: Network offline 후 polling cycle → 콘솔 Unhandled Promise Rejection 미발생
6. **W2 팀 전환**: 팀 A → 팀 B 즉시 전환 → 매트릭스에 팀 A milestone 표시 안 됨
7. **W4 optimistic**: 매트릭스 milestone 추가 직후 polling cycle → 추가한 milestone 보존
8. **EC-1 빈 배열**: 모든 personal project 삭제 → milestones array 빈 배열

### 7-2. R-02 검증

9. 모바일 viewport → DevTools Coverage → ProjectView/InlineTimelineView 미로드
10. 데스크탑 viewport → 4 chunk idle 로드
11. **W6 cleanup**: resize 모바일↔데스크탑 빠르게 토글 → 콘솔 import 폭주 없음

### 7-3. R-03 검증

12. alarm 활성 task 사용자 진입 → ~2-4s 후 권한 prompt
13. alarm task 0건 → prompt 없음
14. **W5 timeout**: DevTools Performance Throttle (CPU 4x) + 매트릭스 진입 → idle 4s 안에 alarm engine 시작
15. 1초 내 unmount → setInterval 미등록

### 7-4. 통합

16. Cold start TTI 측정 → Phase 1 적용 전후 비교 (~150-400ms 단축 예상)
17. 매트릭스 task drag → milestones 도착 후 정상
18. Polling 외부 sync 정합 (race guard 와 함께)
19. 팀 전환 + alarm + dnd 통합 회귀 없음

---

## 8. 미해결 / 후속

- ~~milestones race~~ → W1 fix (sequence guard)
- ~~Unhandled Promise Rejection~~ → W3 fix (.catch)
- ~~team switch stale~~ → W2 fix (set patch 안에 reset)
- ~~optimistic 덮어쓰기~~ → W4/EC-2 fix (merge by id, add 만)
- ~~busy tab alarm 영구 비활성~~ → W5 fix (timeout 4000)
- ~~resize 시 idle 누적~~ → W6 fix (cancelIdleCallback)
- ~~projectIdsList 빈 배열~~ → EC-1 fix
- **N-10 (별도 Loop 후보)**: optimistic update/delete 의 timestamp 기반 정합성. 본 Phase 는 insert(add) 만 보존.
- **별도 Loop 후보**: `useAlarmEngine` 의 `useStore((s) => s.tasks)` 구독 → useStore.subscribe 직접 호출 (App 재렌더 비용 0).
- **별도 Loop 후보**: `initTeamState` team_members 쿼리 캐싱.
