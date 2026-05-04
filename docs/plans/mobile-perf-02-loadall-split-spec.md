---
phase: mobile-perf-02-loadall-split
source: inline-recon (대화 내 코드베이스 진단) + 적대적 리뷰 결함 반영
date: 2026-04-30
status: spec-v4 (적대적 재리뷰 v3 결함 반영)
prev: mobile-perf-01-quick-wins
next: diff-plan
---

# mobile-perf-02 Spec v2 — `loadAll` 단계 분할 (적대적 리뷰 결함 반영)

> **목표**: `loadAll` 의 main `Promise.all` 5쿼리를 "첫 페인트 필수" + "백그라운드" 2단계로 분리. 매트릭스/노트 뷰 첫 task row / memo 표시 시점 단축.
> **변경 파일 1개 (useStore.js), 코드 LOC 순증가 ~30, DB/API/패키지 무변경.**
> **R-ATOMIC 1 커밋**.
> **전제**: Phase 1 (mobile-perf-01) v2 완료. milestones 는 이미 fire-and-forget + race guard.
> **v2 차이**: 적대적 리뷰의 C1, C2, C3, W1, W2, W4 모두 반영. boolean flag 도입으로 `_defaultCollapseState` 의존 제거.

---

## 1. Scope (수정 대상 1개 파일)

| 파일 | 변경 요약 |
|---|---|
| [src/hooks/useStore.js](../../src/hooks/useStore.js) | `loadAll` 의 main `Promise.all` 을 critical (`tasks + projects + memos`) → set() → background (`ui_state + taskSettings`) 2 단계로 분할. **v2 추가**: `csFromSnapshot`/`utsFromSnapshot` boolean flag 도입 (`_defaultCollapseState` 의존 제거), stage 2 진입 시 teamId 검증, stage 2 sequence guard. |

---

## 2. 요구사항

### R-00 — Phase 1 머지 verification (적대적 리뷰 C1)

**전제**: 본 Phase 시작 전 Phase 1 의 milestones fire-and-forget 가 이미 적용되어 있어야 함.

**verification 절차**:
1. `git log --oneline | head -5` — Phase 1 의 3 커밋 (`perf(loadAll): defer milestones...`, `perf(app-shell): trim mobile idle...`, `perf(alarm-engine): defer setup...`) 존재 확인.
2. `useStore.js` 의 L518-530 영역에 milestones await 블록이 **없어야** 함 (Phase 1 으로 이동됨).
3. `useStore.js` 상단에 `let _msLoadSeq = 0` 존재 확인.
4. 위 셋 중 하나라도 실패 → 본 Phase 실행 중단, Phase 1 부터 다시 진행.

### R-01 — main `Promise.all` 을 critical / background 2 단계로 분할 + boolean flag 가드

**현상**: [useStore.js:426-432](../../src/hooks/useStore.js#L426) 가 5 쿼리를 한꺼번에 await.

**v2 핵심 변경 (적대적 리뷰 C2 fix)**: `_defaultCollapseState` 가 14개 키 (각 빈 객체) 라 `Object.values(curCs).some(v => Object.keys(v).length > 0)` 같은 검사로는 "default 인지 vs DB/snapshot 값인지" 안전 구분 불가. **boolean flag 로 stage 1 에서 결정한 path 를 stage 2 에 전달**.

**요구**:

1. **Stage 1 (critical)**: `projects + tasks + memos` 만 `Promise.all`. await.
2. **Stage 1 처리** (기존 로직 보존):
   - deleted_at retry (L437-456)
   - mapProject / mapTask / mapMemo
   - instant project seed (L485-515) — critical path 안에 유지
3. **collapseState path flag (C2 fix)**:
   ```js
   // stage 1 에서 결정
   const currentCs = get().collapseState
   const csFromSnapshot = currentCs && Object.values(currentCs).some(v => v && Object.keys(v).length > 0)
   let cs
   if (csFromSnapshot) {
     cs = currentCs  // snapshot/사용자 toggle 값 유지
   } else {
     cs = { ..._defaultCollapseState }  // stage 1 default. stage 2 가 DB 값으로 갱신
   }
   ```
   `csFromSnapshot` 은 stage 1 에서만 평가 — **closure 로 stage 2 에 전달**. stage 2 진입 시 사용자 toggle 이 추가됐을 가능성도 있지만, csFromSnapshot=false 이면 항상 DB 값 적용 (사용자 toggle 도 stage 1 default 위에 추가된 것이라 DB 값 + user toggle merge 가 필요한데 — **간단성 위해 DB 값 그대로 적용. 사용자 toggle 은 polling 사이 ~수백 ms 안에서만 가능, 보존 보다 단순성 우선**).

   > **Decision**: `csFromSnapshot=false` (콜드 스타트) 시 stage 2 도착까지 사용자가 어떤 group 을 toggle 하면, stage 2 도착 시 DB 값이 그 toggle 을 덮어씀. **이는 의도된 동작** — 콜드 스타트의 짧은 시간 (~수백 ms) 사용자 toggle 보존보다 DB 값 우선 (사용자가 toggle 한 직후 페이지 reload 한 케이스에선 DB 가 이미 그 toggle 을 저장한 상태이므로 DB=user 값. 콜드 스타트 직후 새 toggle 은 _saveCollapseState debounce 500ms 후 DB 저장 → race 가능 → 단순성 우선).

4. **userTaskSettings — stage 2 가 polling cycle 마다 항상 적용 (v4 — 적대적 재리뷰 v3 C1 fix)**:

   **v3 결함**: `utsFromSnapshot = (length>0) && (snapshotTeamId === teamId)` — `snapshotTeamId` 는 restoreSnapshot 시점에만 갱신, polling cycle 들에서 변경 안 됨. 같은 팀 내 polling 시 utsFromSnapshot 영구 true → stage 2 영구 미적용 → 다른 device 변경이 24h 안 영원히 미반영.

   **v4 fix**: `utsFromSnapshot` 검사 자체 제거 — stage 2 가 polling cycle 마다 userTaskSettings 를 항상 DB 값으로 적용.
   ```js
   // v4 — utsFromSnapshot flag 제거. stage 2 then 안에서 무조건 적용:
   bgPatch.userTaskSettings = taskSettings2
   ```

   **trade-off (acceptable)**: 사용자가 task setting 변경 → optimistic local update → DB 저장 도중 polling stage 2 도착 → DB 가 이전 값이면 사용자 변경 일시 롤백 → 다음 cycle 정합. 본 codebase 에 highlight color 외 user task setting 사용처 적고, race window 짧음. 받아들일 수 있음.

   **csFromSnapshot 은 유지**: 사용자 collapseState toggle 보존 우선 (toggle 사용처 매우 많고 race 시 사용자 인지 즉시).

5. **Stage 1 set()** (C3 fix — 위치 명확화):
   ```js
   const patch = { syncStatus: 'ok', collapseState: cs }
   if (!isArrayEqual(current.tasks, tasks)) patch.tasks = tasks
   if (!isArrayEqual(current.projects, projects)) patch.projects = projects
   // memos dirty 처리 (기존)
   ...
   // Phase 1 W2: 팀 전환 감지 시 milestones reset (Phase 1 의 patch)
   if (teamId !== current.currentTeamId) patch.milestones = []
   set(patch)
   ```

6. **Stage 2 fire-and-forget — 위치 + sequence guard (v3 — 적대적 재리뷰: stage 2 race)**:

   **v3 추가**: module-level `_s2LoadSeq` counter 도입 (Phase 1 의 `_msLoadSeq` 와 동일 패턴) — 두 polling cycle 의 stage 2 가 순서 역전 도착 시 stale 결과 폐기.

   파일 상단에 추가:
   ```js
   let _s2LoadSeq = 0
   ```

   stage 2 fire (set(patch) 직후, loadUserProjectOrder 이전):
   ```js
   set(patch)

   // Phase 1: milestones fire-and-forget (이미 존재) ...

   // mobile-perf-02 v3: stage 2 fire-and-forget (sequence guard + teamId guard)
   const stage2TeamId = teamId  // closure capture (W1 race)
   const s2Seq = ++_s2LoadSeq    // v3 race guard
   Promise.all([
     d.from('ui_state').select('collapse_state').eq('id', 'default').maybeSingle(),
     _fetchUserTaskSettings(teamId),
   ]).then(([uiR2, taskSettings2]) => {
     // v3 — sequence guard: stale stage 2 응답 폐기 (느린 1차가 빠른 2차 후 도착 시)
     if (s2Seq !== _s2LoadSeq) return
     // W1 — teamId race guard: stage 2 도착 시 currentTeamId 가 다르면 폐기
     if (get().currentTeamId !== stage2TeamId) return
     const bgPatch = {}
     if (!csFromSnapshot) {
       const loaded = uiR2?.data?.collapse_state || {}
       const cs2 = { ..._defaultCollapseState }
       for (const key of Object.keys(cs2)) {
         if (loaded[key] && typeof loaded[key] === 'object') cs2[key] = loaded[key]
       }
       bgPatch.collapseState = cs2
     }
     // v4: utsFromSnapshot guard 제거 — 매 cycle 무조건 적용
     bgPatch.userTaskSettings = taskSettings2
     if (Object.keys(bgPatch).length > 0) set(bgPatch)
   }).catch(e => {
     if (s2Seq !== _s2LoadSeq) return
     console.warn('[Ryan Todo] loadAll stage2:', e?.message || e)
   })

   // 이후 12b: loadUserProjectOrder (기존 위치 유지)
   if (!_projectOrderLoaded) {
     try { await get().loadUserProjectOrder() } catch (e) { ... }
   }
   ```

   **C3 의 위치 결정**: stage 2 fire-and-forget 는 `set(patch)` 직후, `loadUserProjectOrder` await 이전. 이유:
   - `loadUserProjectOrder` 가 await 라 critical path 안에 있고, stage 2 와 병렬로 진행되어야 RTT 효율 최대.
   - snapshot 저장 (L564) 시점에 stage 2 의 userTaskSettings 가 도착했을 수 있음 — **수용** (snapshot 갱신 측면에서 오히려 이득. spec 의 "24h 안 stale" 우려가 일부 해소).

7. **`_loadAllRunning` flag** (W2 spec 정정):

   기존 spec 은 "stage 1 finally 즉시 해제" 라 표현 → 실제론 try 블록 종료 후 finally 에서 해제 (loadUserProjectOrder + snapshot 저장 후). **본 v2 spec 은 정확히 표현**: "loadAll try 블록 전체 종료 후 finally 에서 해제. stage 2 fire-and-forget 는 try 안에서 시작되지만 await 안 함 → try 종료 시점엔 진행 중. flag 해제 시점에 stage 2 가 진행 중인 것은 정상".

8. **에러 처리**:
   - Stage 1 실패: 기존 catch 그대로 (`syncStatus: 'error'`).
   - Stage 2 실패: console.warn 1회.
   - W1 race guard 미통과: 무처리 (silent return).

### R-02 — `_loadAllRunning` 동작 보존 (정정)

**v2 정정**: spec 은 "stage 1 finally" 가 아닌 "try 블록 종료 후 finally" 라고 정확히 기술. 실제 동작 변경 없음.

**요구**:
1. flag entry 가드 (L389-391): `if (_loadAllRunning) return` — 보존.
2. flag 해제 (L580): `_loadAllRunning = false` (try 블록 종료 후) — 보존.
3. **Stage 2 fire-and-forget 는 try 블록 안에서 시작되지만 await 안 함 → try 종료 시점엔 진행 중. flag 해제 시점에 stage 2 가 진행 중인 것은 정상**.

### R-03 — Stage 1 critical 실패 시 graceful degradation

기존과 동일.

---

## 3. Non-Goals

| # | 비요구사항 | 근거 |
|---|---|---|
| N-01 | view-aware loading (currentView 기반 우선순위) | 별도 Loop |
| N-02 | milestones 위치 변경 | Phase 1 위치 유지 |
| N-03 | snapshot 저장 시점 변경 | 기존 위치 유지 |
| N-04 | initTeamState 흐름 변경 | App.jsx 영역 |
| N-05 | _fetchUserTaskSettings 캐싱 | 별도 후속 |
| N-06 | DB / RLS / API 변경 | 프론트엔드 단독 |
| N-07 | Stage 2 의 ui_state / taskSettings 분리 fire-and-forget | 단일 Promise.all 효율 우선 |
| N-08 | Polling cycle stage 분할 비활성 | branch 복잡도 ↑ vs 이득 ↓ |
| N-09 | csFromSnapshot=false 콜드 스타트에서 사용자 toggle 의 stage 2 우선순위 | 단순성 우선. 콜드 스타트 ~수백 ms 안 사용자 toggle race 는 acceptable |

---

## 4. Edge Cases

### 4-1. Cold start

| Case | 입력 | 기대 동작 |
|---|---|---|
| C1 | snapshot 없음 + 사용자 toggle 없음 | stage 1 default 적용 → stage 2 도착 → DB 값 적용 (csFromSnapshot=false) |
| C2 | snapshot 없음 + stage 1 await 중 사용자 group toggle | csFromSnapshot 은 set(patch) 직전 평가. 만약 stage 1 await 중 toggle 이 발생해 currentCs 가 toggle 값 보유 → csFromSnapshot=true → stage 2 미적용 (사용자 toggle 보존). **이게 의도된 동작** — colder start 의 짧은 시간 안 사용자 toggle 보존 (N-09 정정 — 이전 spec 의 "DB 값으로 덮어씀" 표현이 혼란 야기). 다음 polling cycle 의 stage 1 시점엔 toggle 이 _saveCollapseState 500ms debounce 로 DB 저장 후 → 다음 cycle 에서 csFromSnapshot=true 로 안정 |
| C2b | snapshot 없음 + stage 1 await 중 toggle 없음 | csFromSnapshot=false → stage 2 도착 → DB 값 적용 (정상 cold start) |
| C3 | snapshot 없음 + stage 1 fail | throw → catch → syncStatus='error'. stage 2 미발사 |
| C4 | snapshot 없음 + stage 2 fail | stage 1 정상, UI 정상. console.warn |

### 4-2. Warm start

| Case | 입력 | 기대 동작 |
|---|---|---|
| W1 | snapshot collapseState 가 모든 키 빈 객체 (저장된 값에 toggle 없음) | csFromSnapshot=false → stage 2 도착 시 DB 값 적용. **이게 "snapshot 보존 깨진다" 가 아닌 의도된 동작** — snapshot 의 빈 collapseState 는 사실상 default 와 동일, DB 값과 sync 가 더 정확 |
| W2 | snapshot collapseState 에 toggle 값 존재 | csFromSnapshot=true → stage 2 무변경 (사용자 toggle 보존) |
| W3 | snapshot teamId vs actual teamId 불일치 | App.jsx 단에서 setTasks([]) 등 → snapshot 무효화. loadAll 진행 시 stage 1 새 데이터, stage 2 의 teamId 는 새 teamId |
| W4 v4 | snapshot userTaskSettings 가 stale → polling cycle 도착 | stage 2 가 매 cycle 무조건 userTaskSettings 적용 → 다른 device 변경 다음 polling cycle 에 반영 |

### 4-3. Polling cycle

| Case | 입력 | 기대 동작 |
|---|---|---|
| P1 | 다른 device 변경 → 10s polling | _loadAllRunning 가드 → stage 1 await → set 변경분만. stage 2 fire-and-forget |
| P2 | 동시 polling cycle (StrictMode 더블 마운트 + 빠른 시간) | flag entry 가드 → 1차만 진행, 2차 즉시 return |
| P3 | stage 2 race — 두 polling cycle 의 stage 2 가 동시 진행 (v3 — _s2LoadSeq guard) | 1차 stage 2 fire 시 s2Seq=1 → 2차 stage 2 fire 시 s2Seq=2 → _s2LoadSeq=2. 1차 응답 늦게 도착 → `s2Seq(1) !== _s2LoadSeq(2)` → 폐기. 2차 응답 적용. **race 차단** |

### 4-4. teamId race (W1 fix)

| Case | 입력 | 기대 동작 |
|---|---|---|
| T1 | stage 1 await 중 사용자가 팀 A → 팀 B 전환 | stage 1 응답은 팀 A 데이터. set(patch) 안에 `milestones:[]` (Phase 1 W2). stage 2 의 stage2TeamId 는 팀 A. stage 2 then 에서 `get().currentTeamId === 팀 B` 라 **stage 2 결과 폐기** (W1 guard) |
| T2 | stage 2 fire 후 사용자가 팀 전환 | 위와 동일 |
| T3 | stage 1, 2 모두 팀 A 일 때 진행. 새 loadAll 가 팀 B 로 시작 | Stage 2 (팀 A) 늦게 도착 → guard → 폐기. 팀 B stage 2 가 적용 |

---

## 5. Acceptance Criteria

### 5-1. 신규 동작

- [ ] AC-01: cold start stage 1 set() 시점이 stage 2 await 없이 발생
- [ ] AC-02: cold start 첫 페인트 추가 ~50-150ms 단축 (Phase 1 + Phase 2 합산)
- [ ] AC-03: stage 2 도착 시 collapseState 갱신 (csFromSnapshot=false case)
- [ ] AC-04: stage 2 실패해도 UI 정상 (console.warn 1회)

### 5-2. v2 결함 fix 검증

- [ ] AC-05 (C1): Phase 1 머지 검증 절차 통과 후에만 본 Phase 실행 (R-00)
- [ ] AC-06 (C2): warm start (snapshot toggle 값 있음) 시 stage 2 가 collapseState 안 덮어씀 (csFromSnapshot=true 동작)
- [ ] AC-07 (C2): warm start (snapshot 모든 키 빈 객체) 시 stage 2 가 DB 값 적용 (csFromSnapshot=false 동작 — 의도된)
- [ ] AC-08 (C3): stage 2 fire-and-forget 가 set(patch) 직후, loadUserProjectOrder 이전에 시작 (코드 위치 검증)
- [ ] AC-09 (W1): 팀 전환 race 시 stage 2 결과 폐기 (`get().currentTeamId !== stage2TeamId` 동작)
- [ ] AC-10 (W2): spec/diff-plan 의 `_loadAllRunning` 동작 설명 정확
- [ ] AC-11 (W4): snapshot userTaskSettings stale 24h 안 acceptable, cold start 시 정합

### 5-3. 회귀 방지

- [ ] AC-12: warm start 사용자 collapseState 보존 (csFromSnapshot=true)
- [ ] AC-13: warm start 첫 페인트 시각 무영향
- [ ] AC-14: polling cycle 정상 (10s 간격)
- [ ] AC-15: 팀 전환 시 stage 1/2 모두 새 teamId 기반
- [ ] AC-16: instant project seed 가 stage 1 안에서 동작
- [ ] AC-17: deleted_at retry 동작
- [ ] AC-18: dirty memo 보존

### 5-4. 빌드 / 품질

- [ ] AC-19: `npm run build` 성공
- [ ] AC-20: ESLint 경고 추가 없음
- [ ] AC-21: 1 커밋 R-ATOMIC

---

## 6. 커밋 계획 (R-ATOMIC 1 커밋)

```
Commit 1: perf(loadAll): split critical and background queries with snapshot flag guards
            (R-01 + R-02 + R-03, ~+30 / -10 LOC)
            - main Promise.all 을 critical 3쿼리로 축소
            - csFromSnapshot / utsFromSnapshot boolean flag 도입 (_defaultCollapseState 의존 제거)
            - stage 2: ui_state + taskSettings Promise.all (fire-and-forget)
            - stage 2 위치: set(patch) 직후, loadUserProjectOrder 이전
            - stage 2 teamId race guard (`get().currentTeamId !== stage2TeamId` → 폐기)
            - milestones 위치 Phase 1 그대로
            - snapshot 저장 위치 유지
            - _loadAllRunning flag 동작 보존 (try 블록 전체 종료 후 finally 해제)
```

**의존성**: Phase 1 (mobile-perf-01) v2 머지 완료 후 진행 (R-00 verification).

---

## 7. 회귀 테스트 시나리오

### 7-1. R-00 Phase 1 verification

1. `git log --oneline | head` — Phase 1 3 커밋 존재 확인
2. `useStore.js` L518 영역 — milestones await 블록 부재 확인
3. `useStore.js` 상단 `_msLoadSeq` 존재 확인

### 7-2. Cold start

4. localStorage 비우기 → reload → stage 1 응답 후 first task row, stage 2 응답 후 collapseState 갱신
5. 콜드 스타트 직후 사용자 toggle → stage 2 도착 시 DB 값 우선 (N-09 수용)
6. milestones 도착 후 ms group 갱신

### 7-3. Warm start (C2 검증)

7. snapshot 에 toggle 값 있는 상태 reload → csFromSnapshot=true → stage 2 collapseState 무변경 (AC-06, AC-12)
8. snapshot 에 toggle 없음 (모든 키 빈 객체) reload → csFromSnapshot=false → stage 2 DB 값 적용 (AC-07)
9. snapshot 의 userTaskSettings 있는 상태 → utsFromSnapshot=true → stage 2 미적용 (AC-11)

### 7-4. Polling

10. 다른 device 변경 → 10s polling → stage 1 새 task 표시
11. polling 중 stage 2 가 collapseState 덮어쓰기 시도 → csFromSnapshot=true 라 무변경

### 7-5. teamId race (W1)

12. 팀 A 모드에서 loadAll stage 1 await 중 → 팀 B 로 전환 → 새 loadAll → 첫 stage 2 (팀 A) 결과 도착 → guard 폐기 → 새 stage 2 (팀 B) 적용 (AC-09)

### 7-6. 에러 / 엣지

13. Network offline → stage 1 실패 → syncStatus='error', UI snapshot 유지
14. ui_state RLS 차단 → stage 2 실패 → console.warn, UI 정상
15. 팀 전환 → stage 1/2 모두 새 teamId 기반
16. instant project seed
17. deleted_at retry
18. dirty memo 보존

### 7-7. 통합 측정

19. Cold start TTI 측정 — Phase 1 + Phase 2 합산 단축

---

## 8. 미해결 / 후속

- ~~C1 Phase 1 머지 전제~~ → R-00 verification 추가
- ~~C2 hasSnapshotCs2 로직~~ → boolean flag (csFromSnapshot/utsFromSnapshot) 로 교체
- ~~C3 stage 2 삽입 위치~~ → set(patch) 직후, loadUserProjectOrder 이전 명시
- ~~W1 teamId race~~ → stage 2 then 진입 시 currentTeamId 비교, 다르면 폐기
- ~~W2 _loadAllRunning 설명 오류~~ → spec 정정 ("try 블록 전체 종료 후 finally")
- ~~W4 userTaskSettings 영구 stale~~ → 24h 안 acceptable. 별도 Loop 후보 (stage 2 then 안에서 snapshot 재저장)
- **별도 Loop 후보**: view-aware loading (currentView 우선순위)
- **별도 Loop 후보**: _fetchUserTaskSettings 캐싱
- **별도 Loop 후보**: collapseState 의 LWT (last-write-timestamp) 비교
- **별도 Loop 후보**: initTeamState team_members 캐싱
