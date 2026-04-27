# Note 기능 전면 재검증 분석 보고서

> **조사 범위**: OutlinerEditor 전체 동작 + 키보드 핸들러 (`useOutliner`) + 통합 패턴 (DetailPanel / FocusCard)
> **사용자 보고 증상**: (1) 빠른 입력 시 다른 노트로 튐, (2) Alt+Shift+방향키로 불릿 이동 시 이상동작
> **결론**: 6건 버그 확인 (확실 2 + 의심 4). 가장 영향 큰 것은 **Alt+Shift+Up swap의 insertAt 위치 계산 오류** + **빠른 타이핑 시 useEffect 실행 순서 race**.

---

## 1. 컴포넌트 구조 요약

```
OutlinerEditor (parent state: nodes[])
  ↓ uses
useOutliner hook (refs, handleKeyDown, focus, undoStack)
  ↓ renders
OutlinerRow × N (controlled <textarea>)

호출 사이트:
  · DetailPanel.jsx L282 — task.notes 편집 (800ms debounce)
  · FocusCard.jsx (Loop-47 인라인 펼침) — task.notes 편집 (800ms debounce)
  · MemoryView.jsx — memo.notes 편집
  · CompactTaskRow.jsx, OutlinerTaskNode.jsx — project view 내 편집
```

### 핵심 흐름 (Loop-47 인라인 펼침 기준)

```
사용자 키 입력
  → OutlinerRow <textarea> onChange
  → OutlinerEditor.handleTextChange(idx, text)
     · pushUndo() — JSON.stringify(nodes) 푸시
     · setNodes(prev => 변경)
  → React commit
  → useEffect [nodes] 실행
     · serializeNotes(nodes) 비교
     · 자기에코 ref 비교 (lastEmitted)
     · onChange(serialized) 호출
  → FocusCard.handleNotesChange (또는 DetailPanel)
     · clearTimeout(debounceRef)
     · setTimeout 800ms → updateTask(id, {notes})
     · useStore.setState (즉시) — optimistic update
  → Zustand store change
  → 부모 (FocusPanel / DetailPanel) 리렌더
  → OutlinerEditor 에 새 notes prop 전달
  → useEffect [notes] 실행
     · notes !== lastEmitted ? setNodes(parseNotes) : skip
```

---

## 2. 확인된 버그 (확실 2건)

### 🔴 BUG #1: Alt+Shift+Up swap 의 `insertAt` 잘못된 계산

**위치**: [`useOutliner.js:160-173`](../../src/hooks/useOutliner.js#L160-L173)

```js
// Alt+Shift+↑ — swap with above (including children)
if (e.altKey && e.shiftKey && e.key === 'ArrowUp') {
  e.preventDefault()
  if (idx === 0) return
  pushUndo()
  const childEnd = getChildrenEnd(nodes, idx)
  const block = nodes.slice(idx, childEnd + 1)
  const n = [...nodes]
  n.splice(idx, block.length)
  const insertAt = Math.max(0, idx - 1)   // ← 단순 idx-1
  n.splice(insertAt, 0, ...block)
  setNodes(n)
  focus(insertAt)
  return
}
```

**문제**: `insertAt = idx - 1` 은 위쪽 노드의 **그 자체 인덱스**일 뿐. 위쪽 노드가 다른 subtree 의 마지막 자식인 경우, 해당 자식 위치에 삽입되어 **그 부모 subtree 안으로 잘못 들어감**.

**재현 시나리오**:
```
0: A          (level 0)
1: B          (level 0)
2: C          (level 1, B의 자식)
3: D          (level 0)  ← 사용자 위치
```

D 에서 Alt+Shift+Up 입력 시:
- `childEnd = 3`, `block = [D]`
- `splice(3, 1)` → `[A, B, C]`
- `insertAt = max(0, 2) = 2`
- `splice(2, 0, D)` → `[A, B, D, C]`

**결과**: D 가 C 위로 들어가 **B 의 두 번째 자식** 위치로. 사용자 의도는 `[A, D, B, C]` (B subtree 위로 D).

**더 단순한 사례**:
```
0: A          (level 0)
1: B          (level 1, A의 자식)
2: C          (level 0)  ← 사용자
```

C에서 Up:
- block = [C], splice(2,1) → [A, B]
- insertAt = 1, splice(1, 0, C) → [A, C, B]

→ C 가 A 의 첫째 자식 위치로 들어감. **사용자 의도는 `[C, A, B]` (C 가 맨 위)**.

**올바른 동작**: 위쪽의 동일 level 형제 또는 더 작은 level 노드의 시작점을 찾아 그 자리에 삽입해야 함 (Workflowy/Logseq 동작).

**제안 수정**:
```js
if (e.altKey && e.shiftKey && e.key === 'ArrowUp') {
  e.preventDefault()
  if (idx === 0) return
  pushUndo()
  const childEnd = getChildrenEnd(nodes, idx)
  const block = nodes.slice(idx, childEnd + 1)
  const myLevel = nodes[idx].level

  // 위쪽으로 traverse 하여 같은 level 또는 더 작은 level 의 노드 찾기
  let insertAt = -1
  for (let j = idx - 1; j >= 0; j--) {
    if (nodes[j].level <= myLevel) {
      insertAt = j
      break
    }
  }
  if (insertAt === -1) return  // 위로 더 못감

  const n = [...nodes]
  n.splice(idx, block.length)
  n.splice(insertAt, 0, ...block)
  setNodes(n)
  focus(insertAt)
  return
}
```

### 🔴 BUG #2: Alt+Shift+Down swap 의 일부 케이스 잘못된 동작

**위치**: [`useOutliner.js:175-188`](../../src/hooks/useOutliner.js#L175-L188)

```js
if (e.altKey && e.shiftKey && e.key === 'ArrowDown') {
  e.preventDefault()
  const childEnd = getChildrenEnd(nodes, idx)
  if (childEnd >= nodes.length - 1) return
  pushUndo()
  const block = nodes.slice(idx, childEnd + 1)
  const n = [...nodes]
  n.splice(idx, block.length)
  const insertAt = idx + 1   // ← block 제거 후 idx+1
  n.splice(insertAt, 0, ...block)
  setNodes(n)
  focus(insertAt)
  return
}
```

**문제**: `insertAt = idx + 1` 은 block 제거 후의 idx+1, 즉 원래 nodes 의 `childEnd + 2` 위치. 다음 형제 노드의 **첫 자식이 있다면 그 자식 다음 위치**로 가야 하나, 단순히 +1만 함 → 다음 형제 위로 들어가면서 **다음 형제의 형제 위치 (아닌 첫 자식 위치)** 로 가는 케이스 발생.

**재현 시나리오**:
```
0: A          ← 사용자
1: B          (level 1, A의 자식)
2: C          (level 1, A의 자식)
3: D          (level 0)
```

A 에서 Down:
- childEnd = 2 (B, C 모두 A의 자식)
- block = [A, B, C]
- splice(0, 3) → [D]
- insertAt = 1, splice(1, 0, A, B, C) → [D, A, B, C]

**결과**: `[D, A, B, C]` — D가 위, A 블록이 아래. 사용자 의도일 것 (정상).

다른 시나리오:
```
0: A          ← 사용자
1: B          (level 0)
2: C          (level 1, B의 자식)
```

A 에서 Down:
- childEnd = 0 (A는 자식 없음)
- block = [A]
- splice(0, 1) → [B, C]
- insertAt = 1, splice(1, 0, A) → [B, A, C]

**결과**: A 가 B 와 C 사이 — **B의 자식 위치**로 들어감. 사용자 의도는 `[B, C, A]` (B subtree 다음으로).

**올바른 동작**: 다음 sibling 의 subtree 끝 다음 위치로 삽입.

**제안 수정**:
```js
if (e.altKey && e.shiftKey && e.key === 'ArrowDown') {
  e.preventDefault()
  const childEnd = getChildrenEnd(nodes, idx)
  if (childEnd >= nodes.length - 1) return
  const myLevel = nodes[idx].level

  // 다음 형제(같은 level 또는 더 작은 level)의 subtree 끝 찾기
  let nextStart = -1
  for (let j = childEnd + 1; j < nodes.length; j++) {
    if (nodes[j].level <= myLevel) {
      nextStart = j
      break
    }
  }
  if (nextStart === -1) return  // 더 못감 (top-level 마지막)

  const nextEnd = getChildrenEnd(nodes, nextStart)
  pushUndo()
  const block = nodes.slice(idx, childEnd + 1)
  const n = [...nodes]
  n.splice(idx, block.length)
  // block 제거 후 nextEnd 위치는 (nextEnd - block.length)
  const insertAt = nextEnd - block.length + 1
  n.splice(insertAt, 0, ...block)
  setNodes(n)
  focus(insertAt)
  return
}
```

---

## 3. 의심 버그 (race condition / 성능 이슈, 4건)

### 🟡 BUG #3: 빠른 타이핑 시 useEffect 실행 순서 race

**위치**: [`OutlinerEditor.jsx:25-41`](../../src/components/shared/OutlinerEditor.jsx#L25-L41)

```js
/* ── Sync from parent (external edits) ── */
useEffect(() => {
  if (notes !== lastEmitted.current) {
    const parsed = parseNotes(notes)
    setNodes(parsed.length ? parsed : [{ text: '', level: 0 }])
    lastEmitted.current = notes || ''
  }
}, [notes])

/* ── Emit local changes to parent ── */
useEffect(() => {
  const serialized = serializeNotes(nodes)
  if (serialized !== lastEmitted.current) {
    lastEmitted.current = serialized
    onChange(serialized)
  }
}, [nodes, onChange])
```

**자기에코 보호 패턴**:
- 자기 emit 한 값과 parent props 의 notes 가 같으면 setNodes skip
- React 가 [notes] effect 를 [nodes] effect 보다 **먼저** 실행 보장 (선언 순서)

**race 시나리오 (이론)**:

1. t0: 사용자 "h" 입력 → setNodes → useEffect [nodes] → onChange("h") → store optimistic update
2. t0+microtask: store change → 부모 리렌더 → OutlinerEditor 새 notes="h" prop
3. t1 (사용자 "i" 빠르게 입력): 사용자 키스트로크 onChange → handleTextChange → setNodes (nodes [{text:"hi"}])
4. React batch: 두 가지 변경 처리
   - notes prop "h" (이전 store)
   - nodes 자체 [{text:"hi"}]
5. commit. useEffect 실행 순서:
   - **[notes] 먼저**: notes "h" === lastEmitted "h" → skip ✓
   - **[nodes] 다음**: serialize "hi" ≠ lastEmitted "h" → onChange("hi") → store update

이론상 안전. 하지만 **React 18+ 의 batching 경계가 비동기 boundary 를 넘는 경우** 또는 **다른 컴포넌트의 setState 가 효과 사이에 끼어드는 경우** 순서가 어긋날 수 있음.

**관찰 가능한 증상**:
- 빠른 타이핑 중 일부 글자 누락
- 중간 글자가 다음 노드로 점프 (race로 setNodes(parseNotes("h")) 실행되어 [{text:"h"}] 로 reset 후, 사용자가 친 "i" 가 다음 element 에 입력)

**근본 해결**:
- `lastEmitted` 비교를 더 robust 하게 — 비동기 boundary 넘어 보호
- 또는 **optimistic update 제거** — debounce 만 사용. parent 가 notes prop 새로 emit 안 하면 자기에코 race 자체가 사라짐

**제안 fix**: FocusCard / DetailPanel 의 `useStore.setState(s => tasks.map ...)` optimistic update 제거. 800ms debounce 만 두면 그 시간 동안 자기 에코 race 발생 안 함. 단점: DetailPanel 과 FocusCard 동시 편집 시 800ms 안에 다른 곳 반영 안 됨 — Loop-46 N-14 동시 편집 관용 정책에 부합.

### 🟡 BUG #4: focus() setTimeout 30ms race

**위치**: [`useOutliner.js:44-52`](../../src/hooks/useOutliner.js#L44-L52)

```js
const focus = useCallback((idx, pos = 'end') => {
  setTimeout(() => {
    const el = refs.current[idx]
    if (!el) return
    el.focus()
    const p = pos === 'end' ? el.value.length : (typeof pos === 'number' ? pos : 0)
    el.setSelectionRange(p, p)
  }, 30)
}, [])
```

**문제**: `setTimeout(..., 30)` 으로 비동기 focus. 30ms 동안 React 가 추가 리렌더할 수 있음. `refs.current[idx]` 가 그 사이에 다른 row 의 element 를 가리킬 수도 (특히 setNodes 로 nodes 배열 변경 시).

**재현 가능 시나리오**:
- Enter 로 split → focus(idx+1, 'start')
- 30ms 사이에 외부 sync (snapshot, polling) 으로 nodes 배열 재설정 → refs.current[idx+1] 이 다른 row 가 됨 → 잘못된 row 에 focus

**제안 fix**: `useLayoutEffect` 또는 `requestAnimationFrame` 사용:
```js
const pendingFocus = useRef(null)
const focus = useCallback((idx, pos = 'end') => {
  pendingFocus.current = { idx, pos }
}, [])

useLayoutEffect(() => {
  if (!pendingFocus.current) return
  const { idx, pos } = pendingFocus.current
  pendingFocus.current = null
  const el = refs.current[idx]
  if (!el) return
  el.focus()
  const p = pos === 'end' ? el.value.length : (typeof pos === 'number' ? pos : 0)
  el.setSelectionRange(p, p)
})
```

→ React commit 직후 layout phase 에 동기적 focus. 30ms 지연 없음. nodes 갱신 후 refs 도 같은 commit 에 갱신됨.

### 🟡 BUG #5: pushUndo 매 키스트로크 JSON.stringify 비용

**위치**: [`useOutliner.js:35-41`](../../src/hooks/useOutliner.js#L35-L41) + [`OutlinerEditor.jsx:111`](../../src/components/shared/OutlinerEditor.jsx#L111)

```js
const handleTextChange = useCallback((idx, text) => {
  pushUndo()                  // ← 매 키스트로크
  setNodes(prev => { ... })
}, [pushUndo])
```

```js
const pushUndo = useCallback(() => {
  const snap = JSON.stringify(nodesRef.current)   // ← 매번 전체 직렬화
  const stack = undoStack.current
  if (stack.length > 0 && stack[stack.length - 1] === snap) return
  ...
}, [])
```

**문제**: 노드 수가 많거나 텍스트 길면 매 키스트로크마다 JSON.stringify 전체 호출. 빠른 타이핑 시 메인 스레드 점유 → 입력 응답성 저하 → "튀는" 체감.

또한 `handleKeyDown` L254-L256 에서도 character key 마다 pushUndo 호출.

**제안 fix**:
- pushUndo 를 throttle/debounce (예: 500ms 마다 1회)
- 또는 첫 keypress 시에만 pushUndo, 이후 같은 idx 연속 입력은 skip

### 🟡 BUG #6: OutlinerRow autoResize 매 렌더 layout thrash

**위치**: [`OutlinerRow.jsx:26-28`](../../src/components/shared/OutlinerRow.jsx#L26-L28)

```jsx
useLayoutEffect(() => {
  autoResize(localRef.current)
})
```

**문제**: `useLayoutEffect` dependency 없음 → **매 렌더마다** 실행. autoResize 는 `el.style.height = '0'; el.style.height = el.scrollHeight + 'px'` 로 forced reflow 트리거. 빠른 타이핑 + 많은 row (50+) 시 layout thrash.

부수 영향: hover, selected 등 무관한 prop 변경에도 autoResize 발생.

**제안 fix**: dependency 명시:
```jsx
useLayoutEffect(() => {
  autoResize(localRef.current)
}, [node.text])  // ← text 변경 시만
```

---

## 4. 통합 위험 — 동시 편집 (Loop-46 N-14)

DetailPanel 과 FocusCard 둘 다 같은 task 의 노트를 편집하는 OutlinerEditor 인스턴스 보유 가능. 한쪽 onChange → optimistic store update → 다른 쪽 OutlinerEditor 에 새 notes prop 전달 → 자기에코 ref 가 자체 인스턴스 기준이라 mismatch → setNodes(parseNotes) → **상대편 사용자 입력 손실 + 커서 위치 reset**.

**의도된 관용** (Loop-46 N-14 spec). 하지만 사용자가 한쪽만 사용 중이라도 **외부 sync (PWA polling, 다른 device 동기)** 가 도착하면 같은 증상.

---

## 5. 우선순위별 수정 권장

### P0 (사용자가 바로 체감하는 버그, 명확)

| # | 버그 | 파일 | 추정 LOC |
|---|---|---|---|
| 1 | **Alt+Shift+Up swap insertAt 오류** | useOutliner.js L160-173 | +10 |
| 2 | **Alt+Shift+Down swap insertAt 오류** | useOutliner.js L175-188 | +10 |

이 둘만 수정해도 사용자의 "alt+shift+방향키 이상동작" 이슈 80% 해결. 즉시 수정 가능.

### P1 (성능 + 빠른 타이핑 race)

| # | 버그 | 파일 | 추정 LOC |
|---|---|---|---|
| 3 | autoResize useLayoutEffect dep 추가 | OutlinerRow.jsx L26-28 | +1 |
| 4 | pushUndo throttle | useOutliner.js L35-41 + L111 | ~10 |
| 5 | focus() setTimeout → useLayoutEffect | useOutliner.js L44-52 | ~15 |

성능 개선 + 빠른 타이핑 응답성 개선. "튀는" 체감 저감.

### P2 (race condition 근본 해결)

| # | 버그 | 파일 | 추정 LOC |
|---|---|---|---|
| 6 | Optimistic update 제거 OR lastEmitted 비교 강화 | FocusCard / DetailPanel | -5 / +5 |

사용자 보고 증상의 핵심 race condition 해결. 단점: 동시 편집 시 800ms 동안 한쪽만 보임.

---

## 6. 추가 고려사항

### OutlinerEditor 수정 금지 정책 (N-13)

Loop-46 N-13: "OutlinerEditor 수정 금지". 본 분석은 **공유 컴포넌트 자체 버그**를 다수 식별 — 이는 **기존 정책 재검토 필요**한 신호.

OutlinerEditor 와 useOutliner 는 4곳에서 사용되는 **shared layer**. 버그 수정은 모든 사용처(DetailPanel, MemoryView, CompactTaskRow, OutlinerTaskNode, FocusCard) 에 동시 영향 — **수정이 위험하기보다는 가치가 큼**. 

권장: N-13 정책을 "OutlinerEditor 의 외부 API 변경 금지" 로 완화. 내부 버그 수정은 허용. 또는 새 Loop 단독으로 OutlinerEditor 핫픽스.

### 회귀 테스트 항목

수정 후 회귀 검증:
1. DetailPanel 노트 편집 (단독)
2. FocusCard 인라인 노트 편집 (단독)
3. DetailPanel + FocusCard 동시 편집 (동시 편집 race 명시 동작 확인)
4. MemoryView 메모 편집
5. ProjectView CompactTaskRow / OutlinerTaskNode 편집
6. Alt+Shift+Up/Down (다양한 트리 구조)
7. Tab/Shift+Tab indent (subtree + selection)
8. Enter split, Backspace empty 삭제
9. 빠른 타이핑 (50+ 노드 환경)
10. 멀티라인 paste

---

## 7. 결론

사용자 보고 증상은 **6건 버그의 복합 결과**:
- "alt+shift+방향키 이상동작" → BUG #1, #2 (단순 위치 계산 오류)
- "다른 노트로 튐" → BUG #3, #4, #5, #6 의 race + 성능 효과 복합
- 가장 빠른 효과는 **P0 (alt+shift swap 2건) 즉시 수정**
- 빠른 타이핑 race 해결은 **P2 (optimistic 제거)** — 정책적 결정 필요

권장 진행 순서:
1. **Loop-48 핫픽스** — P0 alt+shift swap 2건 (즉시)
2. **Loop-49 후속** — P1 성능 + P2 race
3. **N-13 정책 재검토** — OutlinerEditor 내부 수정 허용 여부

각 항목 별도 spec 으로 진행할지, 통합 Loop 으로 묶을지는 Ryan 판단.

---

## 부록: 분석된 파일 목록

| 파일 | 역할 | 주요 라인 |
|---|---|---|
| [`OutlinerEditor.jsx`](../../src/components/shared/OutlinerEditor.jsx) | 노드 상태 + parent sync + 자기에코 | L25-L41 sync, L110-L117 handleTextChange |
| [`useOutliner.js`](../../src/hooks/useOutliner.js) | 키보드 핸들러 + undo + focus | L44-L52 focus, L160-L188 alt+shift swap |
| [`OutlinerRow.jsx`](../../src/components/shared/OutlinerRow.jsx) | 단일 row + textarea | L26-L28 autoResize, L58-L69 textarea |
| [`utils/notes.js`](../../src/utils/notes.js) | parse / serialize | 12 lines 전체 |
| [`FocusCard.jsx`](../../src/components/views/personal-todo/cells/FocusCard.jsx) (Loop-47) | 인라인 펼침 + 800ms debounce | L46-L57 handleNotesChange |
| [`DetailPanel.jsx`](../../src/components/shared/DetailPanel.jsx) | 우측 패널 노트 | L71-L81 handleNotesChange |
