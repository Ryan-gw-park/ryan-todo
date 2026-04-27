---
phase: loop-48-note-bug-fix
source: docs/plans/note-bug-analysis.md, docs/plans/loop-48-note-bug-fix-recon.md
date: 2026-04-27
status: spec-draft
prev: recon
next: diff-plan
---

# Loop-48 Spec — Note 버그 통합 수정

> **목적**: 노트 편집기(OutlinerEditor + useOutliner) 의 6건 버그 + OutlinerTaskNode race 1건을 통합 수정.
> **승인된 결정 (AskUserQuestion 결과)**:
> - Q1 Swap 경계 = **Option β** (부모 밖 탈출 + level 보정, `<=`)
> - Q2 N-13 정책 = **완화** (props 인터페이스 무변경 시 내부 수정 허용)
> - Q3 Undo throttle = **leading + trailing 500ms**
> - Q4 OutlinerTaskNode = **본 Loop 포함** (DetailPanel/FocusCard 패턴 통일)

---

## 1. Scope (수정 대상 4개 파일)

| 파일 | 수정 범위 |
|---|---|
| [src/hooks/useOutliner.js](../../src/hooks/useOutliner.js) | swap 2건 + pushUndo throttle + focus 동기화 (4건) |
| [src/components/shared/OutlinerEditor.jsx](../../src/components/shared/OutlinerEditor.jsx) | isEditingRef gate (1건) |
| [src/components/shared/OutlinerRow.jsx](../../src/components/shared/OutlinerRow.jsx) | autoResize useLayoutEffect dep (1건) |
| [src/components/project/tasks/OutlinerTaskNode.jsx](../../src/components/project/tasks/OutlinerTaskNode.jsx) | handleNotesChange debounce + optimistic (1건, Q4 추가) |

> **Scope 확장 경위 (Q4)**: Recon 단계에서는 OutlinerEditor 내부 6건 (BUG #1~#6) 만 대상이었으나, AskUserQuestion Q4 에서 OutlinerTaskNode 의 무debounce race (recon §1-3 ⚠️ 발견) 를 본 Loop 에 포함하기로 결정 → R-07 추가, 7번째 커밋 신설. DetailPanel/FocusCard/OutlinerTaskNode 3개 호출처가 동일 패턴(800ms debounce + optimistic) 으로 통일됨.

---

## 2. 요구사항

### R-01 — Alt+Shift+Up swap 정확화 (BUG #1, Option β)

**현상**: `useOutliner.js:160-173` 의 `insertAt = idx - 1` 이 위쪽 노드의 단순 인덱스 → 위 노드가 다른 subtree 의 자식이면 그 부모 안으로 잘못 들어감.

**요구**: 현재 노드(+자식 block) 가 위쪽으로 swap 될 때:
1. 같은 level 또는 더 작은 level 의 노드를 위로 traverse 하여 첫 매치 위치(insertAt) 찾기 (`<=` 비교)
2. **Option β level 보정**: 매치된 노드의 level 이 myLevel 보다 작으면(`<`), block 전체를 `targetLevel - myLevel` 만큼 outdent (모든 block 노드의 level 에 동일 차이 적용; 자식 간 상대 level 차 보존)
3. 매치된 노드의 level 이 myLevel 과 같으면(`===`), level 보정 없음 (단순 swap)
4. 매치 없음 (idx === 0 또는 위쪽 모두 myLevel 초과) → no-op
5. swap 후 focus 는 insertAt 위치

**예시** (myLevel=1):
```
0: Parent(L0)
1:   A(L1)         ← 마지막 자식, 사용자 위치
2: Uncle(L0)

A에서 Alt+Shift+Up:
  block = [A(L1)], traverse 위로 → 매치 = 0:Parent(L0, L0<L1)
  level 보정: targetLevel(0) - myLevel(1) = -1 → A(L1) → A(L0)
  splice/insert 결과: [A(L0), Parent(L0)] (Parent 의 자식이던 A가 sibling으로 outdent)
```

### R-02 — Alt+Shift+Down swap 정확화 (BUG #2, Option β)

**현상**: `useOutliner.js:175-188` 의 `insertAt = idx + 1` 이 다음 형제의 첫 자식 위치로 잘못 들어감.

**요구**: 현재 노드(+자식 block) 가 아래쪽으로 swap 될 때:
1. block 끝(`childEnd`) 다음부터 같은 level 또는 더 작은 level 의 노드를 traverse → `nextStart` 찾기 (`<=` 비교)
2. `nextStart` 의 subtree 끝(`nextEnd = getChildrenEnd(nodes, nextStart)`) 계산
3. block 제거 후 `insertAt = nextEnd - block.length + 1`
4. **Option β level 보정**: `nextStart` 노드의 level 이 myLevel 보다 작으면(`<`), block 전체를 `nextStartLevel - myLevel` 만큼 outdent
5. 매치 없음 (top-level 마지막) → no-op
6. swap 후 focus 는 보정된 insertAt 위치

**예시** (myLevel=1, 첫 자식 outdent):
```
0: Parent(L0)
1:   A(L1)         ← 사용자 (첫 자식)
2:   B(L1)
3: Uncle(L0)

A에서 Alt+Shift+Down:
  block = [A(L1)] (A의 자식 없음), childEnd=1
  traverse from idx 2: B(L1, L1<=L1) 매치 → nextStart=2
  nextEnd = 2 (B의 자식 없음)
  insertAt = 2 - 1 + 1 = 2, level 보정 없음 (B.level === myLevel)
  결과: [Parent(L0), B(L1), A(L1), Uncle(L0)] — A↔B 형제 swap ✓

마지막 자식 outdent 케이스 (myLevel=1, B 위치에서 Down):
  block = [B(L1)], childEnd=2
  traverse from idx 3: Uncle(L0, L0<L1) 매치 → nextStart=3
  nextEnd = 3
  level 보정: 0 - 1 = -1 → B(L1) → B(L0)
  insertAt = 3 - 1 + 1 = 3
  결과: [Parent(L0), A(L1), Uncle(L0), B(L0)] — B가 Uncle 뒤로 outdent
```

### R-03 — pushUndo leading + trailing throttle (BUG #5)

**현상**: `useOutliner.js:35-41` + `OutlinerEditor.jsx:111` 에서 매 keystroke `JSON.stringify(nodes)` → 빠른 타이핑 시 메인 스레드 점유.

**요구**:
1. `pushUndoThrottled` 신규 함수 도입. 기존 `pushUndo` 는 immediate 버전으로 보존 (`pushUndoImmediate`).
2. **Leading edge**: 마지막 leading snap 이후 500ms 경과 시 즉시 snap (입력 시작 직전 상태 보존).
3. **Trailing edge**: 매 호출마다 trailingTimer 재설정 → 500ms 후 snap (입력 종료 직후 상태 보존). **`lastUndoTime` 갱신 없음** (W-NEW-2 반영 — trailing 이 leading 을 억제하면 R-03 #2 위반).
4. 기존 dedup (`stack[stack.length-1] === snap`) 유지 → leading 과 trailing 이 같은 snap 이면 자동 중복 제거.
5. `handleTextChange` ([OutlinerEditor.jsx:111](../../src/components/shared/OutlinerEditor.jsx#L111)) 와 `handleKeyDown` character branch ([useOutliner.js:254-256](../../src/hooks/useOutliner.js#L254)) 에서 `pushUndoThrottled` 사용.
6. **block 변경 작업** (Tab, Alt+Shift swap, Enter, Backspace, Paste) 은 기존 `pushUndoImmediate` 그대로 사용 — discrete 작업이라 throttle 불필요.

**Trailing 의 lastUndoTime 갱신 금지 근거 (W-NEW-2)**: trailing 콜백에서 `lastUndoTime = Date.now()` 갱신 시, idle 후 새 입력 시작 → `now - lastUndoTime < 500` → leading 발화 억제 → 입력 시작 snap 누락 → Ctrl+Z 가 더 이전 상태로 점프. trailing 의 목적은 "종료 직후 보존" 이지 "다음 leading 억제" 가 아님. lastUndoTime 은 leading edge 에서만 갱신.

### R-04 — focus() 동기화 via hybrid (useLayoutEffect + rAF fallback) (BUG #4)

**현상**: `useOutliner.js:44-52` 의 `setTimeout(..., 30)` → 30ms 동안 외부 sync 가 nodes 재설정 시 잘못된 row 에 focus.

**확정 설계 — hybrid pattern** (Spec 단계 결정. recon §8 의 미해결 항목 해소):

focus() 호출 14건 중 setNodes 미동반 8건이 존재 (recon §1-3 cross-check). 단일 `useLayoutEffect` 만 쓰면 미동반 경로의 focus 가 미실행됨. **두 경로 모두 커버하는 hybrid**:

```js
// useOutliner.js
const pendingFocus = useRef(null)

// applyFocus: pendingFocus.current 를 직접 읽고 처리 (S1 반영 — no-arg 단순화)
const applyFocus = useCallback(() => {
  if (!pendingFocus.current) return
  const { idx, pos } = pendingFocus.current
  pendingFocus.current = null
  const el = refs.current[idx]
  if (!el) return
  el.focus()
  const p = pos === 'end' ? el.value.length : (typeof pos === 'number' ? pos : 0)
  el.setSelectionRange(p, p)
}, [])

// rAF wrapper — DOMHighResTimeStamp 인자 무시
const rafApplyFocus = useCallback(() => { applyFocus() }, [applyFocus])

const focus = useCallback((idx, pos = 'end') => {
  pendingFocus.current = { idx, pos }
  requestAnimationFrame(rafApplyFocus)
}, [rafApplyFocus])

// useLayoutEffect (S3 반영 — useOutliner 내부 위치 결정. hook 이 OutlinerEditor render cycle 안에서
// 호출되므로 commit phase 동기 실행. no-dep, pendingFocus null 체크로 cost 무시)
useLayoutEffect(applyFocus)
```

**경로별 동작**:
| 경로 | 매커니즘 | 타이밍 |
|---|---|---|
| Mutating (Enter/Backspace/Tab/Swap/Paste/Undo/pendingAdd) — setNodes 동반 | `useLayoutEffect` 가 commit 직후 동기 실행 → `pendingFocus.current` null | render commit 직후 (동기) |
| Selection 확장 — setSelectedSet 동반 | `useLayoutEffect` 가 selection re-render 의 commit 직후 실행 | render commit 직후 (동기) |
| Arrow Nav — state 변경 없음 | re-render 미발생 → `useLayoutEffect` 미실행 → rAF fallback 이 처리 | 다음 frame (~16ms) |
| Imperative (focusFirst/focusLast) — 외부 호출, 동기 처리 가능 | 동일 hybrid 적용 | render commit 또는 rAF |

**요구**:
1. `pendingFocus` ref + `applyFocus` 헬퍼 신설.
2. `focus(idx, pos)` = `pendingFocus.current 저장 + rAF fallback` (위 코드).
3. `useLayoutEffect` (no-dep) 에서 commit 직후 `pendingFocus` 처리.
4. `setTimeout(..., 30)` **완전 제거** — useOutliner.js L45 + OutlinerTaskNode.jsx L119, L48 (handleNotesExitUp/Down 내부 50ms·30ms setTimeout 도 동일 패턴 적용 가능, 단 본 Loop 에선 useOutliner 만).
5. paste handler ([useOutliner.js:289](../../src/hooks/useOutliner.js#L289)) 의 focus 도 동일 경로 사용.
6. unmount 시 rAF cleanup 불필요 (rAF 콜백 내부에서 `pendingFocus.current` null 체크).

### R-05 — isEditingRef gate for external sync race (BUG #3)

**현상**: `OutlinerEditor.jsx:25-32` 의 sync effect 가 자기에코 ref 비교만으로 race 방지 → React batch 경계에서 setNodes(parseNotes) 가 사용자 입력 위에 덮어씀.

**설계 보강 (D1 반영)**: 초기 spec 은 `handleTextChange` 에서만 isEditingRef set 했으나, **Tab/Enter/Backspace/Swap/Paste 등 discrete 키 작업 후 800ms 부모 debounce 동안 외부 sync 도착 시 동일 race 발생**. 모든 로컬 setNodes 경로를 일관되게 보호하기 위해 **emit effect 단일 지점에서 set** 으로 일원화.

**자기에코 가드 정규화 (W-NEW-1 반영)**: `parseNotes` 와 `serializeNotes` 가 비대칭 (bullet prefix `"- 항목"` 제거, trailing whitespace trim). 원본 `notes` 와 `lastEmitted` 를 동일 form 으로 비교하면 mount 시 + 외부 sync 시 false-positive 발생 → emit effect 가 스스로 트리거되어 `isEditingRef` 잘못 set + 부모 데이터 정규화 호출. **lastEmitted 를 항상 정규화 form 으로 유지** + sync effect 의 비교도 정규화 form 으로 일원화.

**요구**:
1. `OutlinerEditor` 에 `isEditingRef = useRef(false)` 와 `editingTimeoutRef = useRef(null)` 추가.
2. **lastEmitted 초기값을 정규화 form 으로** (W-NEW-1):
   ```js
   const [nodes, setNodes] = useState(() => {
     const parsed = parseNotes(notes)
     return parsed.length ? parsed : [{ text: '', level: 0 }]
   })
   // W-NEW-1: 첫 렌더 시 정규화 form 으로 초기화
   const lastEmitted = useRef(null)
   if (lastEmitted.current === null) {
     lastEmitted.current = serializeNotes(nodes)
   }
   ```
3. **sync effect — 정규화 form 으로 비교** (W-NEW-1):
   ```js
   useEffect(() => {
     if (isEditingRef.current) return                 // 편집 중 외부 sync 무시
     const parsed = parseNotes(notes)
     const nextNodes = parsed.length ? parsed : [{ text: '', level: 0 }]
     const normalized = serializeNotes(nextNodes)
     if (normalized !== lastEmitted.current) {        // 정규화 form 끼리 비교 → false-positive 방지
       setNodes(nextNodes)
       lastEmitted.current = normalized               // 정규화 form 저장
     }
   }, [notes])
   ```
4. **emit effect 에서 isEditingRef set** (모든 로컬 변경 경로 일괄 처리):
   ```js
   useEffect(() => {
     const serialized = serializeNotes(nodes)
     if (serialized !== lastEmitted.current) {
       lastEmitted.current = serialized
       isEditingRef.current = true                  // 로컬 변경 마커
       clearTimeout(editingTimeoutRef.current)
       editingTimeoutRef.current = setTimeout(() => {
         isEditingRef.current = false
       }, 1000)
       onChange(serialized)
     }
   }, [nodes, onChange])
   ```
5. **자기에코 가드 round-trip safety** (W-NEW-1 검증): sync effect 가 외부 notes 적용 후 `lastEmitted = serializeNotes(nextNodes)` 저장. emit effect 가 같은 nodes 에 대해 `serializeNotes(nodes) === lastEmitted.current` → emit skip → isEditingRef 잘못 set 안 됨 ✓. bullet prefix/whitespace 가 있는 raw notes 도 mount 시 정상 처리.
6. 컴포넌트 unmount 시 timeout cleanup.
7. **handleTextChange 는 isEditingRef 무관여** — emit effect 가 모든 setNodes 후속 동작을 단일 지점에서 보호.

### R-06 — autoResize useLayoutEffect dep (BUG #6)

**현상**: `OutlinerRow.jsx:26-28` dep 미명시 → 매 렌더마다 forced reflow.

**요구**:
1. `useLayoutEffect(() => { autoResize(localRef.current) }, [node.text, node.level])` 로 변경. **D2 반영**: level 변경 시 paddingLeft 변경 → textarea 가용 width 변경 → height 재계산 필요. dep 에 `node.level` 포함하여 Tab indent/outdent 후 height 어긋남 방지.
2. mount 시 `setRef` callback 의 `autoResize(el)` ([L23](../../src/components/shared/OutlinerRow.jsx#L23)) 호출은 그대로 유지 → 최초 height 0 회귀 방지.
3. onChange/onFocus 의 `autoResize(e.target)` ([L63, L66](../../src/components/shared/OutlinerRow.jsx#L63)) 도 그대로 유지 → 텍스트 변경 시 즉시 갱신 보장.

### R-07 — OutlinerTaskNode debounce + optimistic 통일 (Q4, scope 확장)

**현상**: `OutlinerTaskNode.jsx:114-116` 의 `handleNotesChange` 가 매 keystroke `updateTask` 직접 호출 → race + 성능.

**사전 검증 (Spec 단계 확인 완료)**:
- ✅ **`updateTask` stability**: Zustand store action 으로 정의 ([useStore.js:614-635](../../src/hooks/useStore.js#L614)) → `create((set, get) => ({ updateTask: async ... }))` 내 정의되어 store init 시 1회 생성. `useStore(s => s.updateTask)` 반환값은 stable reference → `useCallback` deps 에 포함해도 debounce 무효화 없음.
- ✅ **`useStore.setState` 가 OutlinerTaskNode view 갱신**: project view 의 task list 도 동일 store 의 `tasks` 배열에서 select. 단일 source of truth. setState 즉시 모든 구독 컴포넌트 re-render → optimistic 동작 보장.
- ✅ **`updateTask` 자체가 내부 optimistic + DB write 동시 수행** ([useStore.js:626](../../src/hooks/useStore.js#L626)). DetailPanel/FocusCard 의 외부 setState 는 *800ms debounce 동안의 즉시 visual feedback* 용도 (예: hasNotes 아이콘 색 즉시 갱신). 두 setState 가 같은 결과로 수렴 → 중복 안전.
- ✅ **applyTransitionRules 영향**: `notes` 키만 수정 → `applyTransitionRules` ([useStore.js:617](../../src/hooks/useStore.js#L617)) 가 scope/teamId/assigneeId 등 전이 규칙 대상 키만 처리. notes-only 패치는 scope 보호 영향 없음.

**요구**:
1. DetailPanel L71-81 패턴 복제: `debounceRef` + `setTimeout(800ms)` + `useStore.setState` optimistic update.
2. `handleNotesChange` 변경:
   ```js
   const debounceRef = useRef(null)
   const handleNotesChange = useCallback((newNotes) => {
     clearTimeout(debounceRef.current)
     debounceRef.current = setTimeout(() => {
       updateTask(task.id, { notes: newNotes })
     }, 800)
     useStore.setState(s => ({
       tasks: s.tasks.map(t => t.id === task.id ? { ...t, notes: newNotes } : t)
     }))
   }, [task.id, updateTask])
   ```
3. unmount 시 `clearTimeout(debounceRef.current)` cleanup → stale updateTask 호출 방지. (단, 이미 fire 된 setTimeout 콜백 내부에서 호출된 `updateTask` (async promise) 는 취소 불가. unmount 후 store 갱신은 발생할 수 있으나 부작용 없음 — store 만 업데이트, 사라진 컴포넌트에 영향 없음.)
4. R-05 의 isEditingRef 가 OutlinerEditor 내부에서 echo race 도 방지 → OutlinerTaskNode 의 호출처 동작 일관성 확보.

**Timing gap 수용 결정 (D3 반영)**: 800ms debounce + 1000ms isEditingRef timeout 조합으로 마지막 keystroke 후 **800~1800ms 사이에 외부 sync race window** 가 존재. 이 윈도우 내에 외부 sync 가 도착하면 cursor reset 가능.

- **수용 근거**: (1) 사용자가 1.8초 동안 idle 한 후 외부 device 변경이 도착하는 빈도는 낮음. (2) PWA polling 10초 주기 대비 짧음. (3) Loop-46 N-14 동시 편집 관용 정책의 연장선 (last-write-wins). (4) updateTask 호출 시점에 isEditingRef 를 추가 연장하는 대안은 OutlinerTaskNode → OutlinerEditor 역방향 의존 도입 → N-13 (props 무변경) 위반.
- **명시적 수용**: 본 Spec 은 race window 800-1800ms 를 N-14 의 실용적 한계로 수용. 사용자 영향 보고 시 재논의.

---

## 3. Non-Goals (N-XX)

| # | 비요구사항 | 근거 |
|---|---|---|
| N-01 | OutlinerEditor 의 props 인터페이스 변경 | N-13 완화 조건. `notes`, `onChange`, `accentColor`, `onExitUp`, `onExitDown`, `allTopCollapsed` 무변경 |
| N-02 | DetailPanel / FocusCard / MemoryView / CompactTaskRow 의 노트 저장 로직 변경 | 호출처 무영향 원칙. R-07 의 OutlinerTaskNode 만 예외 (Q4 결정) |
| N-03 | Loop-46 N-14 (동시 편집 관용) 정책 변경 | isEditingRef 는 *자신* 인스턴스만 보호. 다른 인스턴스는 정상 sync → N-14 그대로 |
| N-04 | parseNotes / serializeNotes ([utils/notes.js](../../src/utils/notes.js)) 의 변경 | 본 Loop 범위 외 |
| N-05 | undo 전체 재설계 (브랜치형 undo, redo 분리 등) | leading+trailing throttle 만 추가. 기존 stack 구조 유지 |
| N-06 | mobile/desktop 레이아웃 변경 | 키보드/race 수정만 |
| N-07 | DB 스키마 변경, RLS 변경, edge function 변경 | 프론트엔드 단독 수정 |

---

## 4. Edge Cases

### 4-1. Swap 경계 (R-01, R-02)

| Case | 입력 | 기대 동작 |
|---|---|---|
| C1 | flat list, 첫 노드 Alt+Shift+Up | no-op (`idx === 0`) |
| C2 | flat list, 마지막 노드 Alt+Shift+Down | no-op (`childEnd >= nodes.length - 1` 가드) |
| C3 | level 0 마지막 노드 Alt+Shift+Down | 더 큰 level 노드만 아래에 있으면 traverse 매치 없음 → no-op |
| C4 | 첫 자식 (myLevel=1, idx=1, parent at 0) Alt+Shift+Up | parent 발견 → block.level = 0 으로 outdent. parent 위 sibling 으로 삽입. 예: `[Parent(L0), A(L1), Uncle(L0)]` 에서 A Up → `[A(L0), Parent(L0), Uncle(L0)]` (Uncle 위치 보존) |
| C5 | 마지막 자식 + 다음 uncle 존재, Alt+Shift+Down | uncle 발견 → block.level = uncle.level 로 outdent. uncle 뒤 sibling으로 삽입 |
| C6 | 자식이 있는 노드 swap (block.length > 1) | block 내부 상대 level 차 보존. 예: parent(L1)+child(L2) outdent → parent(L0)+child(L1) |
| C7 | top-level (L0) 노드를 위로 → 위에 L0 형제 있음 | 단순 swap, level 보정 없음 (L0 === L0) |
| C8 | top-level 첫 노드 Alt+Shift+Up | no-op (`idx === 0` early return) |
| C9 | block+자식 outdent 시 level 음수 불가 증명 | `delta = targetLevel - myLevel` 이고 block 내 모든 노드는 `node.level >= myLevel` (children 정의상). 보정 후 `node.level + delta = node.level + targetLevel - myLevel >= myLevel + targetLevel - myLevel = targetLevel >= 0`. 음수 발생 불가 → bound 가드 불필요 |
| C10 | swap 시 기존 selection 잔존 (`useOutliner.js:154-157` clear 가드는 `!shift && !ctrl` 통과 키만 처리 → alt+shift 통과 안 함) | **의도된 동작 수용**: 사용자가 selection 후 Alt+Shift 로 단일 노드 swap → selection 유지. 다음 Tab 으로 bulk indent 가능 (선택→swap→indent 워크플로). swap 함수는 `idx` 파라미터의 단일 노드+자식만 이동, selection 영역 전체 swap 은 미지원 (별도 Loop). 회귀 테스트 시 selection 잔존 확인 |

### 4-2. Throttle (R-03)

| Case | 입력 | 기대 동작 |
|---|---|---|
| T1 | 1초 연속 타이핑 (10 keystrokes) | leading 1회 + trailing 1회 = 2 snap. 중간 dedup 으로 유효 snap ≤ 2 |
| T2 | 단일 keystroke 후 정지 | leading snap 1회 (= trailing 도 같은 snap 이라 dedup) |
| T3 | Tab/Enter/Backspace 등 discrete 작업 | `pushUndoImmediate` 즉시 snap (throttle 미적용) |
| T4 | 타이핑 중 unmount | trailingTimer cleanup. snap 유실 가능성 있으나 unmount 시 어차피 nodes 폐기 → 무영향 |

### 4-3. Focus (R-04)

| Case | 입력 | 기대 동작 |
|---|---|---|
| F1 | Enter split → focus(idx+1, 'start') | setNodes 동반 → 같은 commit에서 동기 focus |
| F2 | Shift+ArrowDown selection | setNodes 미동반 + setState(selection) → 컴포넌트 re-render → useLayoutEffect 실행 → pendingFocus 처리 ✓ |
| F3 | ArrowUp/Down navigation | setNodes 미동반 + setState 미동반 → re-render 없음 → useLayoutEffect 미실행 → **focus 미발생** ⚠️ |
| F4 | F3 대응 | rAF fallback 이 다음 frame (~16ms) 에 처리. setTimeout 30ms 보다 빠름 ✓ |
| F5 | 연속 focus(idx1) → focus(idx2) 호출 | pendingFocus.current 가 idx2 로 덮어써짐 → 마지막 호출만 유효. 첫 rAF 콜백은 pendingFocus 가 이미 처리되어 null → no-op (의도된 동작) |
| F6 | Arrow Up/Down 의 동기 setSelectionRange + async focus() 혼합 | useOutliner.js L223-226, L238-241 의 동기 cursor 이동은 그대로 동작. focus(idx-1) 만 rAF fallback 으로 처리 — 두 동작 독립이므로 race 없음 |

### 4-4. isEditingRef (R-05)

| Case | 입력 | 기대 동작 |
|---|---|---|
| E1 | 단독 편집 (FocusCard 만 열림) | isEditing=true 동안 외부 sync 무시. 1초 idle 후 sync 재개 |
| E2 | DetailPanel + FocusCard 동시 편집 | 각 인스턴스의 isEditingRef 독립. 양쪽 모두 자기 입력 보호 → N-14 관용 |
| E3 | 외부 device sync 도착 (PWA polling 10초 주기) | 사용자가 1초 이상 정지하면 다음 sync 적용. 활발 타이핑 중에는 지연 |
| E4 | 999ms 정지 후 재타이핑 race | handleTextChange 진입 즉시 `isEditing=true` set → clearTimeout 호출 → race window 무 (R-05 ordering) |
| E5 | unmount 직후 외부 sync | timeout cleanup 으로 isEditing leak 없음 |
| E6 | Tab indent/Enter split/Backspace merge 후 800ms idle 중 외부 sync (D1 반영) | emit effect 가 setNodes 후 isEditingRef set → 외부 sync 차단 ✓. 모든 로컬 setNodes 경로 일괄 보호 |
| E7 | Alt+Shift swap 직후 외부 sync (D1 반영) | E6 와 동일 — emit effect 가 단일 지점에서 처리 ✓ |
| E8 | bullet prefix 포함 notes (`"- 항목"`) mount (W-NEW-1) | lastEmitted 정규화 초기화로 emit effect 가 false-trigger 안 함. 부모 task.notes 가 자동 정규화되어 DB 저장되는 부작용 없음 ✓ |
| E9 | 부모가 동일 raw notes 를 반복 전달 (re-render 시) | sync effect 가 정규화 form 비교 → 동일 시 setNodes skip → 불필요 re-render 방지 ✓ |

### 4-5. autoResize (R-06)

| Case | 입력 | 기대 동작 |
|---|---|---|
| A1 | 텍스트 입력 | onChange autoResize 즉시 호출 ✓ |
| A2 | 초기 mount | setRef autoResize 호출 ✓ |
| A3 | collapse → expand | row remount → setRef 호출 ✓ |
| A4 | hover/selected style 변경 | useLayoutEffect dep `[node.text, node.level]` 미변경 → autoResize 미실행 (성능 개선 의도) ✓ |
| A5 | 외부 sync 로 text 변경 | dep 매치 → autoResize 실행 ✓ |
| A6 | Tab indent/outdent (level 변경) | dep 에 `node.level` 포함 → autoResize 실행. paddingLeft 변경에 따른 height 재계산 보장 (D2 반영) ✓ |

---

## 5. Acceptance Criteria

### 5-1. 기능

- [ ] AC-01: R-01 의 8 swap 시나리오 (4-1 C1~C8) 모두 의도대로 동작
- [ ] AC-02: R-02 의 동일 8 시나리오 Down 방향 동작
- [ ] AC-03: 1초 연속 타이핑 후 Ctrl+Z 시 입력 *시작 직전* 상태로 복귀, 한 번 더 Ctrl+Z 시 더 이전 상태 (T1)
- [ ] AC-04: 짧은 타이핑 (< 500ms) 후 Ctrl+Z 시 입력 전체가 한 번에 undo (trailing snap 효과)
- [ ] AC-05: Enter split / Backspace merge / Tab indent / Paste multi-line 후 focus 가 올바른 row 에 즉시 (visual lag 없음)
- [ ] AC-06: Shift+ArrowDown 으로 selection 확장 시 focus 가 선택된 row 로 이동 (F2)
- [ ] AC-07: ArrowUp/Down navigation 시 focus 가 rAF fallback 으로 정상 동작 (F3/F4 hybrid)
- [ ] AC-07a: `setTimeout(..., 30)` 호출이 useOutliner.js / OutlinerEditor.jsx 코드에 잔존하지 않음 (grep 검증)
- [ ] AC-08: 빠른 타이핑 (50+ 노드 환경) 시 글자 누락/점프 없음 (BUG #3 race 해결)
- [ ] AC-09: DetailPanel + FocusCard 동시 편집 시 양쪽 입력 모두 자기 인스턴스에서는 보호 (N-14)
- [ ] AC-10: OutlinerTaskNode (project view) 노트 편집 시 800ms debounce + 즉시 optimistic 반영

### 5-2. 회귀 (호출처 무영향)

- [ ] AC-11: DetailPanel 노트 편집 정상
- [ ] AC-12: FocusCard 인라인 노트 편집 정상 (Loop-47 동작 보존)
- [ ] AC-13: MemoryView 메모 편집 정상
- [ ] AC-14: CompactTaskRow (project view) 노트 편집 정상 (**N-02 명시**: 본 Loop 는 CompactTaskRow 의 매 keystroke `updateTask` 직접 호출 패턴 미수정. 회귀 검증 = 기존 동작 보존만 확인. race/성능 개선은 별도 Loop 후보)
- [ ] AC-15: 노트 아이콘 색 (FocusCard hasNotes) 즉시 갱신 (optimistic 보존)

### 5-3. 빌드/품질

- [ ] AC-16: `npm run build` 성공
- [ ] AC-17: TypeScript/ESLint 경고 추가 없음
- [ ] AC-18: 7커밋 R-ATOMIC 분리 (커밋 순서 §6)

---

## 6. 커밋 계획 (R-ATOMIC 7커밋)

회귀 위험 역순. Q4 결정으로 7번째 커밋 추가.

```
Commit 1: fix(outliner-row): autoResize useLayoutEffect dep [node.text]
            (BUG #6 / R-06, +1 LOC, baseline)

Commit 2: fix(outliner): Alt+Shift+Up swap with parent-boundary outdent
            (BUG #1 / R-01, ~+15 LOC, Option β level 보정 포함)

Commit 3: fix(outliner): Alt+Shift+Down swap with sibling-boundary outdent
            (BUG #2 / R-02, ~+15 LOC, 동일 패턴)

Commit 4: fix(outliner): pushUndo leading + trailing throttle 500ms
            (BUG #5 / R-03, +13 LOC)

Commit 5: fix(outliner): focus setTimeout → useLayoutEffect (no-dep)
            (BUG #4 / R-04, +15 LOC, F3/F4 처리 포함)

Commit 6: fix(outliner-editor): editing guard for external sync race
            (BUG #3 / R-05, +8 LOC)

Commit 7: fix(outliner-task-node): debounce + optimistic update for notes
            (Q4 / R-07, ~+15 LOC, DetailPanel 패턴 복제)
```

---

## 7. 회귀 테스트 시나리오

각 커밋 머지 후 즉시 실행. 7커밋 누적 후 최종 통합 검증.

1. **단독 편집** — DetailPanel 빠른 타이핑 (한글 + 영문 혼합)
2. **인라인 편집** — FocusCard 펼침 → 빠른 타이핑 → 노트 아이콘 즉시 색 변화 확인
3. **동시 편집** — 같은 task 를 DetailPanel + FocusCard 동시 열고 한쪽 입력 (N-14)
4. **메모 편집** — MemoryView 빠른 타이핑 (debounce 500ms 동작)
5. **프로젝트 편집** — CompactTaskRow + OutlinerTaskNode 노트 편집 (R-07 효과 확인)
6. **Swap** — 4-1 의 C1~C8 8개 시나리오 모두 수동 재현
7. **Undo** — 1초 연속 타이핑 → Ctrl+Z (입력 시작 직전 복귀), 짧은 타이핑 → Ctrl+Z (전체 undo)
8. **Focus** — Enter split / Backspace merge / Tab / Shift+ArrowDown / ArrowUp navigation 모두 즉시 focus
9. **Paste** — 멀티라인 paste 후 마지막 line 끝에 cursor
10. **외부 sync** — 다른 탭에서 task.notes 수정 → 1초 정지 후 본 탭에 반영

---

## 8. 미해결 사항

본 Spec 단계에서 모든 설계 결정 확정 완료. Diff Plan 단계에서는 코드 작성만 수행.

- ~~F4 navigation focus 처리 방식~~ → R-04 hybrid pattern 으로 확정 (useLayoutEffect + rAF fallback)
- ~~R-01/R-02 traverse 조건~~ → R-01/R-02 본문 에 `<=` 명시, level 보정 로직 정의 완료 (C9 음수 불가 증명 포함)
- ~~R-07 isEditingRef 상호작용~~ → R-07 본문에 검증 결과 (800ms + 1000ms = 1.0~1.8초 wait, 수용 가능) 명시 완료
- ~~OutlinerTaskNode unmount cleanup~~ → R-07 요구사항 #3 에 명시 완료
