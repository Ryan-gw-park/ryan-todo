---
phase: loop-48-note-bug-fix
source: docs/plans/note-bug-analysis.md (6건 버그)
date: 2026-04-27
status: recon
---

# Loop-48 Recon — Note 버그 통합 수정

> 입력: [note-bug-analysis.md](note-bug-analysis.md) 의 6건 (Alt+Shift swap 2건 + race/성능 4건).
> 사용자 피드백: 단일 Loop 통합, R-ATOMIC 6커밋, isEditingRef 방어 채택, leading-edge throttle, useLayoutEffect dep 명시.

---

## 1. 영향 범위 — 코드베이스 실측

### 1-1. 직접 수정 대상 (3개 파일)

| 파일 | 수정 범위 | 근거 |
|---|---|---|
| [src/hooks/useOutliner.js](../../src/hooks/useOutliner.js) | L35-41 (pushUndo throttle), L44-52 (focus → useLayoutEffect 호환), L160-188 (Alt+Shift swap insertAt) | 4건 (#1, #2, #4, #5) |
| [src/components/shared/OutlinerEditor.jsx](../../src/components/shared/OutlinerEditor.jsx) | L25-32 (sync effect에 isEditingRef gate), L110-117 (handleTextChange에서 isEditing 표시) | 1건 (#3 race) |
| [src/components/shared/OutlinerRow.jsx](../../src/components/shared/OutlinerRow.jsx) | L26-28 (useLayoutEffect dep) | 1건 (#6) |

### 1-2. 간접 영향 — OutlinerEditor를 사용하는 5개 호출처

| 호출처 | 노트 저장 패턴 | 본 Loop 영향 |
|---|---|---|
| [DetailPanel.jsx:71-81](../../src/components/shared/DetailPanel.jsx#L71-L81) | 800ms debounce + `useStore.setState` optimistic | 무수정. 단, isEditingRef 도입 시 이 경로의 echo race 자연 해결 |
| [FocusCard.jsx:48-58](../../src/components/views/personal-todo/cells/FocusCard.jsx#L48-L58) | 800ms debounce + `useStore.setState` optimistic (DetailPanel 패턴 복제) | 무수정. 위와 동일 |
| [MemoryView.jsx:64-79](../../src/components/views/MemoryView.jsx#L64-L79) | 500ms debounce, optimistic 없음 | 무수정. 자기에코 race 원래 없음 |
| [OutlinerTaskNode.jsx:114-116](../../src/components/project/tasks/OutlinerTaskNode.jsx#L114-L116) | **debounce 없이 매 keystroke `updateTask` 직접** | 무수정. 본 Loop에서 안 건드림 (별도 핫픽스 후보로 기록만) |
| [CompactTaskRow.jsx:72-76](../../src/components/project/tasks/CompactTaskRow.jsx#L72-L76) | 부모(`onUpdateNote`)가 처리 — 호출처 ProjectView 결정 | 무수정 |

→ **본 Loop 의 변경은 OutlinerEditor / useOutliner / OutlinerRow 내부에 국한.** props 인터페이스 (`notes`, `onChange`, `accentColor`, `onExitUp`, `onExitDown`, `allTopCollapsed`) 무변경. 5개 호출처 코드 무변경. N-13 정책 (외부 API 변경 금지) 충족.

### 1-3. 코드베이스 사실 확인 (분석 보고서 검증 + 피드백 보강)

- ✅ `getChildrenEnd` ([useOutliner.js:70-78](../../src/hooks/useOutliner.js#L70)) 의 동작 재확인: `parentLevel`보다 큰 level 의 연속 노드를 자식으로 포함. 분석의 swap 진단 정확.
  - **boundary**: `idx === nodes.length - 1` 일 때 for-loop 미실행 → `end = idx` 반환. swap fix 의 `if (childEnd >= nodes.length - 1) return` 가드와 정합.
- ✅ `pushUndo` 가 character key 마다 호출됨 ([useOutliner.js:254-256](../../src/hooks/useOutliner.js#L254), [OutlinerEditor.jsx:111](../../src/components/shared/OutlinerEditor.jsx#L111)) — 이중 호출 (handleTextChange + handleKeyDown character branch). throttle 시 양쪽에 적용.
- ✅ `lastEmitted` ref 는 emit/sync 양쪽에서 갱신되므로 정상 흐름에서는 자기에코 차단됨. race 는 batch 경계에서만 발생 가능 — isEditingRef 가 더 robust.
- ✅ `autoResize` 가 `onChange`/`onFocus`에서도 호출됨 ([OutlinerRow.jsx:63, 66](../../src/components/shared/OutlinerRow.jsx#L63)). useLayoutEffect 에 dep `[node.text]` 추가해도 텍스트 변경 시 onChange 측에서 이미 호출되므로 사실상 **mount + collapse/expand 시에만 효과** — 안전.
- ✅ `OutlinerTaskNode` 에 **debounce 없이** `updateTask` 직접 호출 ([L114-116](../../src/components/project/tasks/OutlinerTaskNode.jsx#L114-L116)) — race/성능 핫픽스 별도 필요. 본 Loop 범위 외.
- ⚠️ **focus() 호출 지점 전수 (피드백 보강)**: `useOutliner.js` 내 14건 + `OutlinerEditor.jsx` 내 3건. **setNodes 동반 여부 분류**:

  | 분류 | 호출 지점 | setNodes 동반 |
  |---|---|---|
  | **Mutating (8건)** | L91 undo, L171 swap-up, L186 swap-down, L200 enter-empty, L207 enter-split, L216 backspace-empty, L289 paste, OutlinerEditor L105 (pendingAdd) | ✅ 있음 |
  | **Navigation only (6건)** | L104 selection-start, L115 selection-extend, L230·L231 arrow-up, L247·L248 arrow-down | ❌ 없음 |
  | **Imperative (2건)** | OutlinerEditor L97 focusFirst, L98 focusLast (외부 ref 호출) | ❌ 없음 |

  → **피드백 #3 우려가 실제 문제**: `useLayoutEffect(..., [nodes])` 적용 시 navigation/imperative 8건의 focus 가 실행되지 않음 (nodes 미변경으로 effect skip).
  → **해결안**: dep 배열을 **빼거나** (`useLayoutEffect(() => {...})` — 매 렌더 실행, pendingFocus null 체크로 cost 무시 가능) 또는 별도 **trigger counter ref** 도입. 분석 보고서 원안(no dep)이 사실상 정답. Spec 단계 결정 필요.

### 1-4. 정책/Spec 정합성

- **N-13 (Loop-46)**: "OutlinerEditor 수정 금지". 본 Loop는 *공유 컴포넌트 자체 버그* 수정. props 인터페이스 무변경 → N-13 취지(호출처 영향 차단)에 부합. **정책 완화 명시 필요** — Spec 단계에서 "외부 API 무변경 시 내부 수정 허용" 으로 재정의.
- **N-14 (Loop-46) 동시 편집 관용**: DetailPanel + FocusCard 동시 편집 시 한쪽 입력이 다른 쪽으로 propagate. 본 Loop의 isEditingRef 는 *편집 중인 인스턴스에서만 외부 sync 무시* — 동시 편집은 여전히 last-write-wins 로 관용. N-14 무변화.
- **R-ATOMIC**: 6건 모두 같은 영역(노트 편집)이지만 회귀 위험 분리를 위해 6커밋 분할 권장 (피드백 동의).

---

## 2. 구현 옵션 (3개) 과 trade-off

### Option A — **단일 Loop 6커밋, isEditingRef 추가, optimistic 유지** (권장, 피드백안)

**커밋 순서: 회귀 위험 역순 (안전한 것부터)** — 피드백 §2 채택. 중간 빌드 실패 시 원인 커밋 즉시 특정 가능.

```
Commit 1: fix(outliner-row): autoResize useLayoutEffect dep        (BUG #6, +1 LOC, 리스크 최저 → baseline)
Commit 2: fix(outliner): Alt+Shift+Up swap insertAt 정확화          (BUG #1, +10 LOC, 독립 로직)
Commit 3: fix(outliner): Alt+Shift+Down swap insertAt 정확화        (BUG #2, +10 LOC, 동일 패턴)
Commit 4: fix(outliner): pushUndo leading+trailing throttle 500ms   (BUG #5, +13 LOC, 성능 기반 확보)
Commit 5: fix(outliner): focus setTimeout → useLayoutEffect         (BUG #4, +15 LOC, throttle 적용 후 타이밍 변경)
Commit 6: fix(outliner): editing guard for external sync race       (BUG #3, +5 LOC, 가장 넓은 영향)
```

**Commit 4 보강 (피드백 §5 채택)**: leading-edge 만으로는 "타이핑 시작 후 500ms 이내에 종료" 시 마지막 상태가 snap 되지 않아 Ctrl+Z 가 입력 전 상태로 점프 → 입력 전체 유실. **leading + trailing 조합**으로 해결:

```js
const lastUndoTime = useRef(0)
const trailingTimer = useRef(null)

const pushUndoThrottled = useCallback(() => {
  const now = Date.now()
  clearTimeout(trailingTimer.current)
  if (now - lastUndoTime.current >= 500) {
    lastUndoTime.current = now
    pushUndoImmediate()  // leading edge — 입력 시작 직전 보존
  }
  trailingTimer.current = setTimeout(() => {
    pushUndoImmediate()  // trailing edge — 입력 종료 직후 보존
  }, 500)
}, [])
```

- **장점**: 모든 버그 동시 해결. props 인터페이스 무변경 → 5개 호출처 무영향. optimistic 유지 → 단독 편집 응답성 즉시. isEditingRef 가 echo race 차단. leading+trailing 으로 undo UX 완비.
- **단점**: useLayoutEffect 도입으로 focus 동작이 동기화됨 — 회귀 테스트 강화 필요. dep 처리는 §1-3 의 분석에 따라 **no-dep 또는 trigger counter** 채택 (Spec 결정).
- **LOC**: ~54.
- **리스크**: 중. focus 호출 14건의 setNodes 동반 여부가 분기점.

### Option B — **Loop-48 = P0 (BUG #1, #2) 핫픽스만, Loop-49 = 나머지** (분석 보고서 원안)

- **장점**: P0 즉시 머지 가능. 회귀 위험 최소. 사용자 보고 증상 80% (Alt+Shift swap) 즉시 해결.
- **단점**: 빠른 타이핑 race ("다른 노트로 튐") 미해결 잔존. 사용자가 Loop-49 까지 대기. Loop 전환 오버헤드.
- **LOC**: 20 (이번) + 30 (다음).
- **리스크**: 저. 단, 사용자 체감 최우선 이슈가 race 인 경우 효용 절반.

### Option C — **단일 Loop, optimistic update 완전 제거 (분석 보고서 P2 원안)**

```
Commit 1-2: Alt+Shift swap (위 동일)
Commit 3-5: P1 성능 (위 동일)
Commit 6: refactor(notes): FocusCard/DetailPanel optimistic setState 제거
           — debounce 만 사용, race 자체 소멸
```

- **장점**: race condition 의 근본 제거. isEditingRef 없이 단순.
- **단점**: 800ms 동안 동일 task 의 다른 인스턴스(DetailPanel ↔ FocusCard 동시 편집)에 변경 미반영. 단독 편집에서도 노트 저장 후 store 의 task.notes 가 800ms 늦게 갱신 → 다른 곳 (예: FocusCard 의 hasNotes 아이콘 색) 의 갱신 지연. **Loop-47 의 "노트 작성 중 아이콘 색 즉시 변화" 동작 회귀**.
- **LOC**: ~50.
- **리스크**: 중-고. UI 일관성 회귀 가능성. 호출처 2개 수정 → N-13 정책 위반.

### 권장: **Option A**

- 사용자 피드백 (단일 Loop, isEditingRef, leading-edge throttle, dep 명시) 모두 반영
- Option C 의 UI 회귀 회피 (FocusCard 노트 아이콘 색 즉시 갱신 유지)
- Option B 보다 race 해결 즉시 효과
- N-13 충족 (props 무변경)

---

## 3. 재사용 가능한 기존 패턴 / 함수

| 재사용 대상 | 위치 | 활용 |
|---|---|---|
| `getChildrenEnd(nodes, idx)` | [useOutliner.js:70-78](../../src/hooks/useOutliner.js#L70) | swap fix #1, #2 에서 그대로 사용 (block 범위 + nextEnd 계산) |
| `nodesRef.current` | useOutliner.js:19-20 | pushUndo throttle 의 snap source. dep 없는 useCallback 에서 최신 nodes 참조 |
| `lastEmitted` ref | OutlinerEditor.jsx:20 | isEditingRef 와 함께 echo 차단 — 보완재 |
| `pendingFocus` 패턴 (제안) | useOutliner.js focus()에 신규 도입 | 분석 보고서 제안. useLayoutEffect 와 함께 동기 focus |
| `pushUndo` 의 snap 비교 (`stack[stack.length-1] === snap`) | useOutliner.js:38 | throttle 추가해도 기존 dedup 로직 유지 — leading 과 trailing 이 같은 snap 이면 자동 중복 제거 |
| Loop-46 N-14 동시 편집 관용 | docs/loops/loop-46 | isEditingRef 가 단독 편집만 보호, 동시 편집은 N-14 그대로 |

---

## 4. 위험 요소 / 사전 확인 필요 사항

### 4-1. 코드 위험

| # | 위험 | 완화 |
|---|---|---|
| R1 | useLayoutEffect 의 dep 배열 선택 — `[nodes]` 시 navigation focus 6건 (selection/arrow) 미실행 | **no-dep 채택 권장** (분석 보고서 원안, pendingFocus null 체크로 cost 무시). 또는 trigger counter ref. Spec 결정 |
| R2 | pushUndo throttle leading-only 시 짧은 타이핑 종료 상태 미snap → Ctrl+Z 가 입력 전 상태로 점프, 텍스트 유실 | **leading + trailing 500ms 조합** 채택 (피드백 §5). 입력 시작 전 + 입력 종료 후 양쪽 보존 |
| R3 | isEditingRef 의 timeout 1000ms 직후 외부 sync 도착 → nodes reset → 다음 keystroke 가 reset된 nodes 위에서 실행 | **handleTextChange 진입 즉시 `isEditing.current = true` 설정 → 그 후 `clearTimeout`** 순서. 같은 JS tick 내 sync effect 끼어들 여지 차단 (피드백 §4) |
| R4 | swap fix 의 traverse 가 부모 경계에서 어떻게 처리되는지 미정의 — `<=` 시 첫 자식 outdent 또는 마지막 자식이 부모 밖으로 탈출 (구조 깨짐) | **`===` strict equality 채택 권장** (Workflowy 방식, Option α). 같은 레벨 형제만 swap, 부모 경계 시 no-op. indent/outdent 는 Tab/Shift+Tab 가 담당 (피드백 §1) |
| R5 | swap fix 의 traverse 가 빈 nodes 또는 모든 노드가 같은 level 인 경우 | `if (insertAt === -1) return` early exit. `if (idx === 0) return` 기존 가드 유지. 추가 edge case 테스트 필요 |
| R6 | autoResize dep `[node.text]` → collapsed/expanded 토글 시 row 가 다시 표시될 때 height 미갱신 | onFocus 에서 autoResize 호출 ([OutlinerRow.jsx:66](../../src/components/shared/OutlinerRow.jsx#L66)) 가 보완. 추가로 setRef callback 에서 mount 시 호출 ([L23](../../src/components/shared/OutlinerRow.jsx#L23)) 도 유지. **최초 렌더 시 height 0 우려** → setRef 의 autoResize 가 처리하므로 안전 (코드 확인 완료) |

### 4-2. 정책 위험

| # | 위험 | 완화 |
|---|---|---|
| P1 | N-13 정책 ("OutlinerEditor 수정 금지") 위반 | Spec 단계에서 "내부 수정 허용, props 무변경" 으로 재정의. 본 Loop 가 그 cas test |
| P2 | OutlinerTaskNode 의 debounce 누락 (별 race 잠재) 미해결 | 본 Loop 범위 외 명시. Loop-49 또는 별도 핫픽스 후보로 spec 에 기록 |

### 4-3. 사전 확인 항목 (Spec 단계)

1. **N-13 정책 완화 결정**: Ryan 승인 필요. "외부 API 무변경 시 내부 수정 허용" 명문화.
2. **Loop-46 N-14 (동시 편집 관용) 보존 확인**: isEditingRef 가 *자신* 인스턴스에서만 sync 무시 — 다른 인스턴스는 정상 sync. 의도 일치 검증.
3. **Throttle 500ms 결정**: leading + trailing 조합. 더 짧으면 (200ms) snap 중복, 더 길면 (1000ms) 의도치 않은 long-jump undo. **권장 leading+trailing 500ms** (피드백 §5).
4. **isEditingRef timeout 1000ms 결정**: 키보드 멈춘 후 외부 sync 재개까지의 idle 시간. handleTextChange 의 ordering (`isEditing=true` → `clearTimeout`) 명시 (R3 참조).
5. **OutlinerTaskNode 의 무debounce 처리 분리 확인**: 본 Loop 에 포함 안 함 — Spec 에 명시.
6. **회귀 테스트 시나리오 6개** (분석 보고서 §6 + 추가):
   - DetailPanel 단독 편집 (빠른 타이핑)
   - FocusCard 인라인 단독 편집 (빠른 타이핑)
   - DetailPanel + FocusCard 동시 편집 (N-14 관용 동작)
   - MemoryView 메모 편집
   - ProjectView CompactTaskRow / OutlinerTaskNode 편집 (영향 없음 검증)
   - Alt+Shift+Up/Down (분석 보고서의 4가지 트리 시나리오 + flat list 추가)
7. **Alt+Shift swap 부모 경계 동작 결정** (피드백 §1): traverse 비교 연산자 — strict `===` (Workflowy/Logseq 방식, 권장 Option α) vs `<=` + level 보정 (Option β). 권장 `===`: 같은 레벨 형제끼리만 swap, 부모 경계에서 no-op. indent/outdent 는 Tab/Shift+Tab 분리 담당 → scope 최소화.
8. **focus() 호출 지점 14건의 setNodes 동반 여부 전수** (피드백 §3, §1-3 표 참조): navigation/imperative 8건이 setNodes 미동반 → useLayoutEffect dep `[nodes]` 채택 시 미실행. **권장 no-dep** (분석 보고서 원안, pendingFocus null 체크). 또는 trigger counter ref 도입 결정.
9. **pushUndo trailing-edge snap 추가 여부** (피드백 §5): leading-only 시 짧은 타이핑 종료 상태 유실 → Ctrl+Z 가 입력 전 상태로 점프. **권장 leading+trailing 조합** (LOC +3, undo UX 완비).

---

## 5. 의존성 / 완료 조건

- **선행 의존**: 없음. 코드베이스 현 상태에서 즉시 가능.
- **차단 요인**: N-13 정책 완화 (Spec 단계 결정 사항).
- **빌드 확인**: `npm run build` (CLAUDE.md §5 Loop Workflow 5단계).
- **회귀 검증**: §4-3 (6) 의 시나리오 모두 통과.
- **PR 단위**: 단일 PR, 6커밋 (R-ATOMIC).

---

## 6. 다음 단계

1. **Spec 작성** (`/spec loop-48-note-bug-fix`): §4-3 사전 확인 항목 모두 결정. 구현 옵션 A 채택 명시. 6커밋 acceptance criteria 정의.
2. **Diff Plan** (`/diff-plan loop-48-note-bug-fix`): 커밋별 수정 hunk 작성.
3. **Execute** (`/execute loop-48-note-bug-fix`): Director (docs/agents/00-director.md) Guardian 리뷰 → 구현 → 빌드 → 회귀 테스트.
