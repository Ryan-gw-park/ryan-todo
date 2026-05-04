---
phase: mobile-perf-01-quick-wins
source: docs/plans/mobile-perf-01-quick-wins-spec.md (v2)
date: 2026-04-30
status: diff-plan-v4 (적대적 재리뷰 v3 결함 반영)
prev: spec
next: execute
---

# mobile-perf-01 Diff Plan v2 — Quick Wins (적대적 리뷰 결함 반영)

> **변경 없음**: DB / RLS / Edge Function / API / 환경 변수 / 패키지 / vite.config.js.
> **3 커밋, 3 파일, ~+57 / -21 LOC**.
> **v2 추가**: W1~W6, EC-1, EC-2 fix 모두 반영.

---

## 1. 변경 파일 요약

| 파일 | 커밋 # | 변경 라인 (추정) | 변경 내용 |
|---|---|---|---|
| [src/hooks/useStore.js](../../src/hooks/useStore.js) | C1 | L14 영역 + L518-530 + L537 + L556 영역 + L1328 영역 (+38/-10) | `_msLoadSeq` + `_pendingDeleteMilestoneIds` 추가, milestones 쿼리 set() 이후로 이동, race guard, .catch, team-switch set skip, pendingDelete-aware merge, 빈배열 분기, **deleteMilestone 에 add/delete 호출** |
| [src/App.jsx](../../src/App.jsx) | C2 | L54-62 (+12/-3) | mobile 분기 + idle timeout 3000 + cancelIdleCallback cleanup |
| [src/hooks/useAlarmEngine.js](../../src/hooks/useAlarmEngine.js) | C3 | L17-51 (+15/-8) | main effect idle wrap + timeout 4000 + cancelIdleCallback |

---

## 2. DB / API / Backend

- DB / RLS / Edge Function / 환경 변수 / 패키지 / src 코드 외 파일: 모두 무변경.
- Store action 시그니처: 무변경.

---

## 3. 커밋별 상세 hunk

### Commit 1 — `perf(loadAll): defer milestones with race guard, optimistic merge, catch`

#### 1-1. `src/hooks/useStore.js`

**A. module-level sequence counter + pendingDelete Set 추가** (L14 `_loadAllRunning` 옆):

```diff
@@ L14-17
 // ─── Loop-35J: loadAll 중복 실행 방지 플래그 ───
 let _loadAllRunning = false
 // ─── 12b: 프로젝트 순서 최초 1회만 로드 ───
 let _projectOrderLoaded = false
+// ─── mobile-perf-01 R-01 (W1): milestones fire-and-forget race guard ───
+let _msLoadSeq = 0
+// ─── mobile-perf-01 R-01 v4: optimistic delete 추적 (외부 추가와 구분) ───
+const _pendingDeleteMilestoneIds = new Set()
```

**B. main patch 에서 `milestones` 제거 + 팀 전환 시 set 자체 skip (v3 — 적대적 재리뷰 C1 fix)** (L532-556):

```diff
@@ L532-556 (스냅샷 → 서버 전환 시 변경분만 set)
       const current = get()
       // userTaskSettings: 스냅샷에서 이미 복원된 값이 있으면 유지
       const currentUts = current.userTaskSettings
       const mergedUts = (currentUts && currentUts.length > 0) ? currentUts : taskSettings
-      const patch = { collapseState: cs, syncStatus: 'ok', userTaskSettings: mergedUts, milestones }
+      // mobile-perf-01 R-01: milestones 별도 비동기 set() 으로 이동
+      const patch = { collapseState: cs, syncStatus: 'ok', userTaskSettings: mergedUts }
       if (!isArrayEqual(current.tasks, tasks)) patch.tasks = tasks
       if (!isArrayEqual(current.projects, projects)) patch.projects = projects
       if (!isArrayEqual(current.memos, memos)) {
         // (기존 dirty memo 보존 로직 그대로)
         ...
       }
-      set(patch)
+      // W2 v3 (적대적 재리뷰 C1 fix): 팀 전환 감지 시 set(patch) 자체 skip
+      // 이유: stage 1 응답이 이전 팀 데이터 (teamId=L396 캡처값) → 새 팀 store 에 적용 시 오염
+      // 대신 milestones 만 reset (이전 표시 정리). 새 loadAll 이 곧 새 teamId 로 진입.
+      const prevTeamId = current.currentTeamId
+      if (teamId !== prevTeamId) {
+        set({ milestones: [], syncStatus: 'ok' })
+      } else {
+        set(patch)
+      }
```

> **v3 수정 근거**: 1차 v2 의 `patch.milestones = []` 만 추가하는 fix 는 적대적 재리뷰 C1 에서 결함 발견. patch 에 이미 tasks/projects/memos 가 포함되어 있어 stale 팀 데이터가 새 팀 store 에 적용됨. v3 는 set(patch) 자체 skip — milestones reset 만.

**C. milestones 쿼리 블록 (L517-530) 삭제, set() 다음에 신규 블록 삽입**:

기존 L517-530 (await 블록 — 전체 삭제):
```diff
@@ L517-530 (이 블록 전체 삭제)
-      // 마일스톤: 프로젝트 ID 기반으로 한번에 로딩 (별도 렌더 사이클 방지)
-      let milestones = []
-      const projectIdsList = projects.map(p => p.id)
-      if (projectIdsList.length > 0) {
-        try {
-          const msResult = await d.from('key_milestones')
-            .select('id, pkm_id, project_id, title, color, sort_order, owner_id, secondary_owner_id, status, start_date, end_date, created_by, parent_id, depth, scheduled_date')
-            .in('project_id', projectIdsList)
-            .order('sort_order')
-          milestones = msResult.data || []
-        } catch (e) {
-          // 마일스톤 로딩 실패해도 다른 데이터 반영에 영향 없음
-        }
-      }
```

set(patch) 다음에 신규 블록 삽입 (W1 race guard + EC-1 빈배열 + W3 catch + W4 merge v3 — optimistic delete 보존):
```diff
@@ set(patch) 직후 (L556 다음, L558 의 loadUserProjectOrder 직전)
       set(patch)  // 또는 set({ milestones: [], syncStatus: 'ok' }) — hunk B 의 분기

+      // ── mobile-perf-01 R-01: milestones fire-and-forget — 첫 페인트 차단 해제 ──
+      const projectIdsList = projects.map(p => p.id)
+      if (projectIdsList.length === 0) {
+        // EC-1: project 모두 삭제 case — milestones 도 빈 배열로 sync
+        if (get().milestones.length > 0) set({ milestones: [] })
+      } else {
+        const mySeq = ++_msLoadSeq  // W1 race guard
+        d.from('key_milestones')
+          .select('id, pkm_id, project_id, title, color, sort_order, owner_id, secondary_owner_id, status, start_date, end_date, created_by, parent_id, depth, scheduled_date')
+          .in('project_id', projectIdsList)
+          .order('sort_order')
+          .then(res => {
+            if (mySeq !== _msLoadSeq) return  // W1 — stale 응답 무시
+            if (res.error) {
+              console.warn('[Ryan Todo] milestones (deferred):', res.error.message)
+              return
+            }
+            if (!res.data) return
+            // W4/EC-2 v4 (적대적 재리뷰 v3 C1 fix): pendingDelete Set 으로 정확 merge.
+            //   v3 결함: dbFiltered = res.data.filter(curIds.has) 가 외부 추가도 잘못 제외 → 영구 손실.
+            //   v4: pendingDelete 만 명시 제외 → 외부 추가 정상 반영.
+            const cur = get().milestones
+            const dbFiltered = res.data.filter(m => !_pendingDeleteMilestoneIds.has(m.id))
+            const dbIds = new Set(dbFiltered.map(m => m.id))
+            const optimisticInserts = cur.filter(m => !dbIds.has(m.id) && !_pendingDeleteMilestoneIds.has(m.id))
+            // 중복 방지용 Map dedupe (안전망)
+            const merged = new Map()
+            for (const m of dbFiltered) merged.set(m.id, m)
+            for (const m of optimisticInserts) if (!merged.has(m.id)) merged.set(m.id, m)
+            set({ milestones: Array.from(merged.values()) })
+          })
+          .catch(e => {  // W3 — Unhandled Promise Rejection 방지
+            if (mySeq !== _msLoadSeq) return
+            console.warn('[Ryan Todo] milestones (deferred) network:', e?.message || e)
+          })
+      }

       // 12b: 사용자별 프로젝트 순서 로드 (최초 1회만, 내부에서 flag 체크)
       if (!_projectOrderLoaded) {
         try { await get().loadUserProjectOrder() } catch (e) { console.error('[loadAll] loadUserProjectOrder:', e) }
       }
```

> **v4 수정 근거 (적대적 재리뷰 v3 C1)**: v3 의 `dbFiltered = res.data.filter(curIds.has)` 는 "cur 에 없는 DB 항목" 을 모두 제외 → 외부 device 의 추가도 잘못 제외 → 팀 sync 영구 파괴. v4 는 사용자 의도 (delete) 를 module-level Set 으로 명시 추적 → 외부 추가와 정확 구분.

**D. snapshot 저장 (L564-569)**: 무수정.

**E. `_loadAllRunning` flag (L580)**: 무수정.

**F. `deleteMilestone` (L1328-1340) 수정 — pendingDelete 추적 (v4 추가)**:

```diff
@@ L1328-1340 (deleteMilestone)
   deleteMilestone: async (id) => {
     const d = db()
     if (!d) return
+    // mobile-perf-01 v4: optimistic delete 추적 (deferred fetch merge 시 외부 추가와 구분)
+    _pendingDeleteMilestoneIds.add(id)
     // Loop 41: L1 flat. CASCADE 재귀 제거. 단일 MS만 삭제.
     set(s => ({
       milestones: s.milestones.filter(m => m.id !== id),
       tasks: s.tasks.map(t => t.keyMilestoneId === id ? { ...t, keyMilestoneId: null } : t),
     }))
-    const { error } = await d.from('key_milestones').delete().eq('id', id)
-    if (error) console.error('[useStore] deleteMilestone:', error)
-    // DB에서도 연결된 task의 key_milestone_id 초기화
-    await d.from('tasks').update({ key_milestone_id: null, updated_at: new Date().toISOString() }).eq('key_milestone_id', id)
+    try {
+      const { error } = await d.from('key_milestones').delete().eq('id', id)
+      if (error) console.error('[useStore] deleteMilestone:', error)
+      // DB에서도 연결된 task의 key_milestone_id 초기화
+      await d.from('tasks').update({ key_milestone_id: null, updated_at: new Date().toISOString() }).eq('key_milestone_id', id)
+    } finally {
+      _pendingDeleteMilestoneIds.delete(id)
+    }
   },
```

**LOC (F)**: +6 / -3. 순증 +3.
**리스크**: 낮음. try/finally 로 DB 작업 결과와 무관하게 pendingDelete 해제 보장. DB 에러 시에도 leak 없음.

**LOC**: +30 / -10. 순증 +20.
**리스크**: 중. 신규 로직 (race guard + merge) 가 복잡. 단위 테스트 가능 시나리오 (M6, M7, M8) 가 spec §4.1 에 명시되어 있고, §7.1 에 수동 검증 시나리오 있음.

---

### Commit 2 — `perf(app-shell): trim mobile idle preload + idle timeout/cleanup`

#### 2-1. `src/App.jsx`

**Idle preload useEffect 에 mobile 분기 + cleanup + fallback timeout honor 추가** (L54-62):

```diff
@@ L54-62 (Idle 프리로드 — mobile 분기 + cleanup + v3 fallback timeout honor)
-  // Idle 프리로드 — 첫 화면 후 유휴 시간에 다른 뷰 미리 로드
-  useEffect(() => {
-    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 2000))
-    idle(() => {
-      import('./components/views/UnifiedGridView')
-      import('./components/views/ProjectView')
-      import('./components/views/InlineTimelineView')
-      import('./components/views/MemoryView')
-    })
-  }, [])
+  // Idle 프리로드 — 첫 화면 후 유휴 시간에 다른 뷰 미리 로드
+  // mobile-perf-01 R-02: 모바일은 MemoryView 만, 데스크탑은 4개 (기존)
+  // (UnifiedGridView 는 currentView=personal-matrix entry render 시 자동 lazy 트리거)
+  // W6 — cancelIdleCallback cleanup, W5/v3 — { timeout: 3000 } (fallback 도 timeout 인자 honor)
+  useEffect(() => {
+    const idle = window.requestIdleCallback || ((cb, opts) => setTimeout(cb, opts?.timeout ?? 2000))
+    const handle = idle(() => {
+      if (mobile) {
+        import('./components/views/MemoryView')
+      } else {
+        import('./components/views/UnifiedGridView')
+        import('./components/views/ProjectView')
+        import('./components/views/InlineTimelineView')
+        import('./components/views/MemoryView')
+      }
+    }, { timeout: 3000 })
+
+    return () => {
+      if (window.cancelIdleCallback) window.cancelIdleCallback(handle)
+      else clearTimeout(handle)
+    }
+  }, [mobile])
```

> **v3 수정 근거 (적대적 재리뷰 W1)**: setTimeout fallback 이 hardcoded 2000ms 였음 → timeout 옵션 honor 안 함. v3 는 `opts?.timeout ?? 2000` 으로 fallback 도 일관 동작.

**LOC**: +12 / -3. 순증 +9.
**리스크**: 최저. cleanup 으로 deps 변경 시 idle 누적 차단. handle 은 number 라 cancelIdleCallback / clearTimeout 모두 호환.

---

### Commit 3 — `perf(alarm-engine): defer setup with idle timeout + cancellable`

#### 3-1. `src/hooks/useAlarmEngine.js`

**main useEffect 본체를 idle 콜백으로 감싸기 + cancelIdleCallback** (L17-51):

```diff
@@ L17-51 (main useEffect)
   useEffect(() => {
-    // SW 등록은 main.jsx에서 처리 — 여기서는 ready만 사용
-
-    // alarm이 활성화된 task가 있으면 권한 요청
-    const hasActiveAlarm = tasksRef.current.some((t) => t.alarm?.enabled)
-    if (hasActiveAlarm && typeof Notification !== 'undefined' && Notification.permission === 'default') {
-      Notification.requestPermission()
-    }
-
-    // SW로부터 스누즈 요청 수신
-    const handleSWMessage = (e) => {
-      if (e.data?.type === 'SNOOZE_ALARM') {
-        const task = tasksRef.current.find((t) => t.id === e.data.taskId)
-        if (task?.alarm) {
-          const snoozed = snoozeAlarm(task.alarm)
-          updateTask(task.id, { alarm: snoozed })
-        }
-      }
-    }
-
-    if ('serviceWorker' in navigator) {
-      navigator.serviceWorker.addEventListener('message', handleSWMessage)
-    }
-
-    // 초기 즉시 체크
-    checkAlarms()
-
-    const timer = setInterval(checkAlarms, CHECK_INTERVAL_MS)
-    return () => {
-      clearInterval(timer)
-      if ('serviceWorker' in navigator) {
-        navigator.serviceWorker.removeEventListener('message', handleSWMessage)
-      }
-    }
+    // mobile-perf-01 R-03: idle 콜백으로 지연 (첫 페인트 critical path 분리)
+    // W5/v3 — { timeout: 4000 }, fallback 도 timeout 인자 honor
+    const idle = window.requestIdleCallback || ((cb, opts) => setTimeout(cb, opts?.timeout ?? 2000))
+    let cancelled = false
+    let cleanupFn = null
+
+    const handle = idle(() => {
+      if (cancelled) return
+
+      const hasActiveAlarm = tasksRef.current.some((t) => t.alarm?.enabled)
+      if (hasActiveAlarm && typeof Notification !== 'undefined' && Notification.permission === 'default') {
+        Notification.requestPermission()
+      }
+
+      const handleSWMessage = (e) => {
+        if (e.data?.type === 'SNOOZE_ALARM') {
+          const task = tasksRef.current.find((t) => t.id === e.data.taskId)
+          if (task?.alarm) {
+            const snoozed = snoozeAlarm(task.alarm)
+            updateTask(task.id, { alarm: snoozed })
+          }
+        }
+      }
+
+      if ('serviceWorker' in navigator) {
+        navigator.serviceWorker.addEventListener('message', handleSWMessage)
+      }
+
+      checkAlarms()
+      const timer = setInterval(checkAlarms, CHECK_INTERVAL_MS)
+      cleanupFn = () => {
+        clearInterval(timer)
+        if ('serviceWorker' in navigator) {
+          navigator.serviceWorker.removeEventListener('message', handleSWMessage)
+        }
+      }
+    }, { timeout: 4000 })
+
+    return () => {
+      cancelled = true
+      if (window.cancelIdleCallback) window.cancelIdleCallback(handle)
+      else clearTimeout(handle)
+      if (cleanupFn) cleanupFn()
+    }
   }, []) // eslint-disable-line react-hooks/exhaustive-deps
```

**LOC**: +15 / -8. 순증 +7.
**리스크**: 낮음. cancelled flag + cancelIdleCallback 이중 안전망. StrictMode 더블 마운트 안전 (각 마운트 별도 handle).

---

## 4. 작업 순서

```
C1 (loadAll milestones defer + race guard + optimistic merge)
C2 (mobile idle preload trim + timeout + cleanup)
C3 (alarm engine defer + timeout + cancellable)
```

3 커밋 모두 독립. 권장 순서 1→2→3.

---

## 5. 검증 절차

### 5-1. 빌드

```bash
npm run build              # AC-19
```

### 5-2. C1 후

- DevTools Network → milestones 요청이 main set() 후 (timing)
- 매트릭스 진입 → label blank → 갱신 (jank 없음)
- 노트 뷰 첫 페인트 milestones 와 무관
- **AC-08 (W1 race)**: Network throttling Fast 3G 로 1차 fetch 지연, 즉시 force-refresh 로 2차 fetch 발동 → 1차가 늦게 도착 → store 의 milestones 가 2차 값 (`mySeq !== _msLoadSeq` 동작)
- **AC-09 (W2 team switch)**: 팀 A → 팀 B 즉시 전환 → 매트릭스 즉시 milestones 비움 → 새 fetch 도착 후 새 데이터
- **AC-10 (W3 .catch)**: DevTools Network → Offline → polling cycle → 콘솔 Unhandled Promise Rejection 0건 (`.catch` 동작)
- **AC-11 (W4 optimistic)**: 매트릭스 milestone 추가 (DB insert pending 도중) + 동시 polling cycle → 추가한 milestone 보존
- **AC-14 (EC-1 빈배열)**: 모든 personal project 삭제 → milestones 빈 배열로 sync

### 5-3. C2 후

- DevTools Coverage → 모바일 viewport 에서 ProjectView/InlineTimelineView 미로드
- 데스크탑 viewport → 4 chunk idle 단계 로드
- **AC-13 (W6 cleanup)**: resize 모바일↔데스크탑 빠르게 5회 토글 → 콘솔 import 폭주 없음 (cleanup 동작)

### 5-4. C3 후

- Performance 녹화 → mount → first paint → ~2-4s 후 alarm engine 시작
- alarm 활성 task 사용자 → ~2-4s 후 권한 prompt (AC-17)
- alarm task 0건 → prompt 없음 (AC-18)
- **AC-12 (W5 timeout)**: DevTools Performance Throttle "CPU 4x" + 매트릭스 진입 (메인 스레드 바쁘게) → idle 4s 안에 alarm engine 시작 (timeout fallback 동작)
- 1초 내 unmount → setInterval 미등록

### 5-5. 통합 (3 커밋 누적)

- Cold start TTI 측정 (Phase 1 적용 전후 비교, ~150-400ms 단축 예상)
- 매트릭스 task drag → milestones 도착 후 정상
- Polling 외부 sync 정합 (race guard 와 함께)

### 5-6. 회귀 위험 모니터링

- **C1 race**: `_msLoadSeq` 가 module-level 이라 동일 모듈 내 여러 useStore 인스턴스 공유 OK. 다른 탭은 각자의 module instance 라 각 자 sequence — 탭 간 race 는 last-write-wins (DB sync).
- **C1 merge**: `optimistic` 배열이 빈 경우 정상 동작 (배열 spread). DB 응답이 빈 경우 (`res.data = []`) → optimistic 만 남음 (정상 — 모든 milestone 삭제된 case).
- **C2 cleanup type 일치**: requestIdleCallback handle (number) vs setTimeout handle (number) — 둘 다 number, cancelIdleCallback / clearTimeout 모두 number 받음.
- **C3 cleanup 순서**: cancelled=true 먼저 → cancelIdleCallback → cleanupFn (이미 등록된 setInterval 정리). idle 콜백이 setInterval 등록 도중에 cleanup 들어와도 cancelled flag 가 검사되므로 안전.

---

## 6. 미해결 / 후속

- ~~milestones race~~ → W1 fix.
- ~~Unhandled Promise Rejection~~ → W3 fix.
- ~~team switch stale~~ → W2 fix.
- ~~optimistic 덮어쓰기~~ → W4/EC-2 fix (insert/add 만).
- ~~busy tab alarm 영구 비활성~~ → W5 fix.
- ~~resize idle 누적~~ → W6 fix.
- ~~projectIdsList 빈배열~~ → EC-1 fix.
- **N-10 (별도 Loop 후보)**: optimistic update/delete 의 timestamp 비교.
- **별도 Loop 후보**: useAlarmEngine tasks 구독 → useStore.subscribe.
- **별도 Loop 후보**: initTeamState team_members 캐싱.
- **Phase 2 영역**: main Promise.all 분할.
- **Phase 3 영역**: vendor-dnd chunk + Sidebar lazy.
