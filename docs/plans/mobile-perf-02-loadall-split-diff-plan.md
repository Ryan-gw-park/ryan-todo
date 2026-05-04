---
phase: mobile-perf-02-loadall-split
source: docs/plans/mobile-perf-02-loadall-split-spec.md (v2)
date: 2026-04-30
status: diff-plan-v4 (적대적 재리뷰 v3 결함 반영)
prev: spec
next: execute
---

# mobile-perf-02 Diff Plan v2 — `loadAll` 단계 분할 (적대적 리뷰 결함 반영)

> **변경 없음**: DB / RLS / Edge Function / API / 환경 변수 / 패키지 / 다른 파일.
> **1 커밋, 1 파일 (useStore.js 의 loadAll 함수만), ~+35 / -10 LOC**.
> **전제**: Phase 1 (mobile-perf-01) v2 머지 완료 — R-00 verification 통과.
> **v2 추가**: C1 verification, C2 boolean flag, C3 위치 명시, W1 teamId guard, W2 정정, W4 명시.

---

## 0. Phase 1 머지 verification (필수 — 적대적 리뷰 C1)

**실행 전 검증**:
```bash
# 1. Phase 1 3 커밋 존재
git log --oneline | grep -E "(perf\(loadAll\): defer milestones|perf\(app-shell\): trim mobile|perf\(alarm-engine\): defer setup)"
# 3개 줄 출력 기대

# 2. useStore.js 의 milestones await 블록 부재 (L517-530 영역에서)
# Phase 1 적용 후엔 set(patch) 다음에 fire-and-forget 형태로 위치
grep -n "key_milestones" src/hooks/useStore.js
# .from('key_milestones') 호출이 set(patch) 다음 (L556 이후) 위치인지 확인

# 3. _msLoadSeq module-level counter 존재
grep -n "_msLoadSeq" src/hooks/useStore.js
# `let _msLoadSeq = 0` 줄 출력 기대
```

**위 셋 중 하나라도 실패 → 실행 중단, Phase 1 먼저 진행**.

---

## 1. 변경 파일 요약

| 파일 | 커밋 # | 변경 라인 (추정) | 변경 내용 |
|---|---|---|---|
| [src/hooks/useStore.js](../../src/hooks/useStore.js) | C1 | L426-432, L460-474, L532-556, set(patch) 직후 신규 블록 | main Promise.all 5→3, csFromSnapshot/utsFromSnapshot boolean flag, stage 2 fire-and-forget (set 직후 + loadUserProjectOrder 이전), stage2TeamId race guard |

---

## 2. DB / API / Backend

- DB / RLS / Edge Function / 환경 변수 / 패키지: 모두 무변경.
- Store action / 헬퍼 시그니처: 무변경.

---

## 3. 커밋별 상세 hunk

### Commit 1 — `perf(loadAll): split critical and background queries with snapshot flag guards`

#### 1-1. `src/hooks/useStore.js`

**A. main `Promise.all` 을 critical 3 쿼리로 축소** (L426-432):

```diff
@@ L426-432
-      const [pr, trResult, mr, uiR, taskSettings] = await Promise.all([
-        projectsQuery,
-        tasksQuery,
-        d.from('memos').select(MEMO_COLUMNS).order('sort_order'),
-        d.from('ui_state').select('collapse_state').eq('id', 'default').maybeSingle(),
-        _fetchUserTaskSettings(teamId),
-      ])
+      // mobile-perf-02 R-01: critical (tasks+projects+memos) 만 await — 첫 페인트 차단 해제
+      // ui_state + taskSettings 는 stage 2 fire-and-forget (set 직후, loadUserProjectOrder 이전)
+      const [pr, trResult, mr] = await Promise.all([
+        projectsQuery,
+        tasksQuery,
+        d.from('memos').select(MEMO_COLUMNS).order('sort_order'),
+      ])
```

**B. collapseState 처리 — boolean flag 도입** (L459-474, C2 fix):

기존:
```js
const currentCs = get().collapseState
const hasSnapshotCs = currentCs && Object.values(currentCs).some(v => v && Object.keys(v).length > 0)
let cs
if (hasSnapshotCs) {
  cs = currentCs
} else {
  const loaded = uiR?.data?.collapse_state || {}
  cs = { ..._defaultCollapseState }
  for (const key of Object.keys(cs)) {
    if (loaded[key] && typeof loaded[key] === 'object') {
      cs[key] = loaded[key]
    }
  }
}
```

→ 변경:
```diff
@@ L459-474 (collapseState 병합 — boolean flag)
       // Merge loaded collapse state with defaults — preserve snapshot values if already restored
-      const currentCs = get().collapseState
-      const hasSnapshotCs = currentCs && Object.values(currentCs).some(v => v && Object.keys(v).length > 0)
+      // mobile-perf-02 R-01 C2 fix: snapshot path 여부를 boolean flag 로 — _defaultCollapseState 의존 제거.
+      //   csFromSnapshot=true  → snapshot/사용자 toggle 값. stage 2 무변경.
+      //   csFromSnapshot=false → default 사용. stage 2 도착 시 DB 값 적용.
+      const currentCs = get().collapseState
+      const csFromSnapshot = currentCs && Object.values(currentCs).some(v => v && Object.keys(v).length > 0)
       let cs
-      if (hasSnapshotCs) {
+      if (csFromSnapshot) {
         cs = currentCs
       } else {
-        const loaded = uiR?.data?.collapse_state || {}
+        // stage 1 default. stage 2 가 DB 값으로 갱신 (csFromSnapshot=false 일 때만)
         cs = { ..._defaultCollapseState }
-        for (const key of Object.keys(cs)) {
-          if (loaded[key] && typeof loaded[key] === 'object') {
-            cs[key] = loaded[key]
-          }
-        }
       }
```

**C. main `set(patch)` — userTaskSettings 를 patch 에서 완전 제거 (v4 — utsFromSnapshot 제거) + Phase 1 set skip 분기 보존** (L532-556):

```diff
@@ L532-556 (stage 1 set patch)
       const current = get()
-      // userTaskSettings: 스냅샷에서 이미 복원된 값이 있으면 유지
-      const currentUts = current.userTaskSettings
-      const mergedUts = (currentUts && currentUts.length > 0) ? currentUts : taskSettings
-      const patch = { collapseState: cs, syncStatus: 'ok', userTaskSettings: mergedUts }
+      // mobile-perf-02 R-01 v4: userTaskSettings 는 stage 2 가 매 cycle 적용 (guard 없음).
+      // utsFromSnapshot 검사 제거 (v3 결함: 같은 팀 내 polling stale).
+      const patch = { syncStatus: 'ok', collapseState: cs }
       if (!isArrayEqual(current.tasks, tasks)) patch.tasks = tasks
       if (!isArrayEqual(current.projects, projects)) patch.projects = projects
       if (!isArrayEqual(current.memos, memos)) {
         // dirty memo 보존 로직 (기존 그대로)
         const dirty = get().dirtyMemoIds
         const dirtyIds = Object.keys(dirty)
         if (dirtyIds.length === 0) {
           patch.memos = memos
         } else {
           const localMap = new Map(current.memos.map(m => [m.id, m]))
           const merged = memos.map(m => dirty[m.id] ? (localMap.get(m.id) || m) : m)
           for (const m of current.memos) {
             if (dirty[m.id] && !memos.find(s => s.id === m.id)) merged.push(m)
           }
           patch.memos = merged
         }
       }
-      set(patch)
+      // Phase 1 v3 hunk B: 팀 전환 감지 시 set(patch) 자체 skip
+      const prevTeamId = current.currentTeamId
+      if (teamId !== prevTeamId) {
+        set({ milestones: [], syncStatus: 'ok' })
+      } else {
+        set(patch)
+      }
```

> **v4 수정 근거**:
> 1. `utsFromSnapshot` 검사 제거 — v3 의 `snapshotTeamId === teamId` 가 같은 팀 내 polling stale 못 막음. v4 는 stage 2 가 매 cycle userTaskSettings 적용.
> 2. `set(patch)` 분기 처리는 Phase 1 v3/v4 의 set skip 로직과 동일 — Phase 2 적용 후에도 보존.

**D. Stage 2 fire-and-forget + sequence guard 신규 블록 (v3 — 적대적 재리뷰: stage 2 race fix)**:

**v3 추가**: 파일 상단에 `_s2LoadSeq` counter 추가. stage 2 fire 시 ++_s2LoadSeq, then/catch 안에서 stale 응답 폐기.

`useStore.js` 상단 (Phase 1 의 `_msLoadSeq` 옆):
```diff
@@ L17 (mobile-perf-01 의 _msLoadSeq 다음)
 let _msLoadSeq = 0
+// ─── mobile-perf-02 v3: stage 2 fire-and-forget race guard ───
+let _s2LoadSeq = 0
```

set(patch) 다음 (Phase 1 milestones fire-and-forget 와 함께, loadUserProjectOrder 직전):
```diff
       set(patch)  // 또는 set({ milestones: [], syncStatus: 'ok' }) — hunk C 의 분기

       // Phase 1 R-01 (existing): milestones fire-and-forget
       const projectIdsList = projects.map(p => p.id)
       if (projectIdsList.length === 0) {
         if (get().milestones.length > 0) set({ milestones: [] })
       } else {
         const mySeq = ++_msLoadSeq
         d.from('key_milestones').select(...).in('project_id', projectIdsList).order('sort_order')
           .then(res => { ... })
           .catch(e => { ... })
       }

+      // ── mobile-perf-02 R-01 v3: Stage 2 background — sequence guard + teamId guard ──
+      const stage2TeamId = teamId
+      const s2Seq = ++_s2LoadSeq  // v3 race guard
+      Promise.all([
+        d.from('ui_state').select('collapse_state').eq('id', 'default').maybeSingle(),
+        _fetchUserTaskSettings(teamId),
+      ]).then(([uiR2, taskSettings2]) => {
+        if (s2Seq !== _s2LoadSeq) return  // v3 — stale stage 2 폐기
+        if (get().currentTeamId !== stage2TeamId) return  // teamId race
+        const bgPatch = {}
+        if (!csFromSnapshot) {
+          const loaded = uiR2?.data?.collapse_state || {}
+          const cs2 = { ..._defaultCollapseState }
+          for (const key of Object.keys(cs2)) {
+            if (loaded[key] && typeof loaded[key] === 'object') cs2[key] = loaded[key]
+          }
+          bgPatch.collapseState = cs2
+        }
+        // v4: utsFromSnapshot guard 제거 — 매 cycle 무조건 적용
+        bgPatch.userTaskSettings = taskSettings2
+        if (Object.keys(bgPatch).length > 0) set(bgPatch)
+      }).catch(e => {
+        if (s2Seq !== _s2LoadSeq) return
+        console.warn('[Ryan Todo] loadAll stage2:', e?.message || e)
+      })

       // 12b: 사용자별 프로젝트 순서 로드 (최초 1회만, 내부에서 flag 체크) — 위치 그대로
       if (!_projectOrderLoaded) {
         try { await get().loadUserProjectOrder() } catch (e) { console.error('[loadAll] loadUserProjectOrder:', e) }
       }
```

> **v3 수정 근거 (적대적 재리뷰)**: 두 polling cycle 의 stage 2 가 순서 역전 도착 시 stale 결과로 정상 결과 덮음. v3 의 `_s2LoadSeq` 가드가 차단.

> **C3 결정 근거**: stage 2 fire-and-forget 가 `set(patch)` 직후, `loadUserProjectOrder` await 이전.
> - stage 2 와 loadUserProjectOrder 가 병렬 진행 → RTT 효율
> - snapshot 저장 (L564) 시점에 stage 2 의 결과가 들어왔을 가능성 → snapshot 의 userTaskSettings 가 더 최신값일 수 있음 (오히려 W4 의 stale 우려 일부 완화)
> - csFromSnapshot/utsFromSnapshot 은 set(patch) 직전 평가, stage 2 closure 가 그 값 캡처 → 사용자 toggle 이 set 직후 발생해도 stage 2 결정엔 영향 없음 (의도된 동작 — N-09)

**E. snapshot 저장 (L564-569)**: 무수정.

```js
const snapshot = { tasks, projects, memos, teamId, timestamp: Date.now(), collapseState: get().collapseState, userTaskSettings: get().userTaskSettings }
localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
```

> snapshot 저장 시점에 stage 2 가 도착했을 수도, 안 도착했을 수도. 도착했으면 더 최신, 안 도착했으면 stale. 둘 다 acceptable (24h 안 정합 가정 — Spec W4).

**F. `_loadAllRunning` flag (L580)**: 무수정 (try 블록 전체 종료 후 finally 에서 해제 — W2 정정).

**LOC**: +35 / -10. 순증 +25.
**리스크**: 중. boolean flag 도입으로 _defaultCollapseState 구조 의존 제거. stage 2 closure 가 csFromSnapshot/utsFromSnapshot/stage2TeamId 캡처 — closure 안전.

---

## 4. 작업 순서 (의존성)

```
Phase 1 v2 머지 완료 → R-00 verification 통과
  ↓
C1 (loadAll critical/background 분할 + boolean flag + teamId guard)
  ↓ stage 1: tasks/projects/memos 만 await → 첫 페인트 단축
  ↓ stage 2: ui_state + taskSettings fire-and-forget
  ↓ stage 2 가 loadUserProjectOrder 와 병렬 진행
  ↓ teamId race guard 로 팀 전환 race 차단
```

---

## 5. 검증 절차

### 5-1. R-00 verification

```bash
git log --oneline | grep -E "perf\((loadAll|app-shell|alarm-engine)\):"
grep -n "_msLoadSeq" src/hooks/useStore.js
# 두 검증 통과 확인
```

### 5-2. 빌드

```bash
npm run build              # AC-19
```

### 5-3. Cold start

1. localStorage 비우기 → hard reload + Slow 4G
2. DevTools Network → critical 3쿼리 응답 → set() 발생 → 첫 task row, 그 후 ui_state/taskSettings/key_milestones 도착
3. Performance 녹화 → mount → first task row → Phase 1+2 합산 단축 측정
4. stage 2 도착 후 collapseState 갱신 (csFromSnapshot=false case, AC-03)
5. 콜드 스타트 직후 사용자 group toggle → stage 2 도착 → DB 값 우선 (N-09 수용)

### 5-4. Warm start (C2 boolean flag 검증)

6. snapshot 에 toggle 값 있는 상태 reload → csFromSnapshot=true → stage 2 가 collapseState 무변경 (AC-06)
7. snapshot 에 toggle 없음 (모든 키 빈 객체 — toggle 한 번도 안 한 상태에서 저장된 snapshot) reload → csFromSnapshot=false → stage 2 DB 값 적용 (AC-07)
8. snapshot userTaskSettings 있는 상태 → utsFromSnapshot=true → stage 2 미적용 (AC-11)

### 5-5. teamId race (W1)

9. 팀 A → stage 1 await 중 → 팀 B 로 전환 → 첫 stage 2 (팀 A) 결과 늦게 도착 → guard 폐기 → 새 loadAll 의 stage 2 (팀 B) 적용 (AC-09)
   - 측정 방법: Network throttling 으로 stage 1 인위적 지연, 그 사이 팀 전환 트리거. stage 2 의 closure 가 stage2TeamId=팀A 인 채 then 진입 → `get().currentTeamId === 팀B` → return.

### 5-6. Polling cycle

10. 다른 device 변경 → 10s polling → stage 1 새 데이터, stage 2 csFromSnapshot=true 라 collapseState 보존
11. polling 중 동시 cycle (StrictMode 또는 빠른 재호출) → flag entry 가드

### 5-7. 에러 / 엣지

12. Network offline → stage 1 throw → catch → syncStatus='error'
13. ui_state RLS 차단 (시뮬레이션) → stage 2 catch → console.warn, UI 정상
14. dirty memo 편집 중 polling → memo 보존
15. instant project seed (stage 1 안)
16. deleted_at retry

### 5-8. 회귀 위험 모니터링

- **C2 boolean flag**: csFromSnapshot 이 set(patch) 직전 시점에 평가. stage 2 closure 가 캡처. 사용자 toggle 이 set 후, stage 2 도착 전이라도 csFromSnapshot 값 변경 안 됨 → DB 값 적용 (의도된 — N-09).
- **C3 위치**: stage 2 가 loadUserProjectOrder await 보다 먼저 fire. loadUserProjectOrder 가 1회성 (`_projectOrderLoaded` 가드) 이라 매 cycle 마다 await 안 함.
- **W1 teamId guard**: stage 2 then 진입 시 currentTeamId 검사. 팀 전환 후 새 loadAll 의 stage 1 set 도 `currentTeamId` 변경 후에 진행 (App.jsx 의 initTeamState → loadAll 순서). guard 정확.
- **race vs StrictMode**: StrictMode 더블 마운트 → loadAll 두 번 호출 → flag entry 가드 → 1차만 진행. 2차 즉시 return. 1차의 stage 2 가 도착 → 정상 set. 안전.

---

## 6. 미해결 / 후속

- ~~C1 Phase 1 머지~~ → R-00 verification 추가
- ~~C2 hasSnapshotCs2~~ → boolean flag 교체
- ~~C3 stage 2 위치~~ → set(patch) 직후, loadUserProjectOrder 이전
- ~~W1 teamId race~~ → stage 2 then 진입 guard
- ~~W2 _loadAllRunning 설명~~ → spec 정정
- ~~W4 userTaskSettings stale~~ → 24h 내 acceptable (Spec N-10)
- **별도 Loop 후보**: snapshot 저장을 stage 2 then 안에서 한 번 더 (userTaskSettings 갱신 보장)
- **별도 Loop 후보**: view-aware loading
- **별도 Loop 후보**: collapseState LWT 비교
