---
phase: loop-48-note-bug-fix
source: docs/plans/loop-48-note-bug-fix-spec.md
date: 2026-04-27
status: diff-plan
prev: spec
next: execute
---

# Loop-48 Diff Plan — Note 버그 통합 수정

> **목적**: Spec 의 7 요구사항 (R-01 ~ R-07) 을 7개 R-ATOMIC 커밋으로 분리하여 정확한 diff hunk 정의.
> **변경 없음**: DB 마이그레이션, API/엔드포인트, RLS, edge function, env vars, 패키지 의존성. **프론트엔드 단독 수정**.

---

## 1. 변경 파일 요약

| 파일 | 커밋 # | 변경 라인 (추정) | 변경 내용 |
|---|---|---|---|
| [src/components/shared/OutlinerRow.jsx](../../src/components/shared/OutlinerRow.jsx) | C1 | L26-28 (+1) | useLayoutEffect dep `[node.text, node.level]` 추가 (W-NEW-3) |
| [src/hooks/useOutliner.js](../../src/hooks/useOutliner.js) | C2 | L160-173 (~+15) | Alt+Shift+Up swap with parent-boundary outdent |
| [src/hooks/useOutliner.js](../../src/hooks/useOutliner.js) | C3 | L175-188 (~+18) | Alt+Shift+Down swap with sibling-boundary outdent |
| [src/hooks/useOutliner.js](../../src/hooks/useOutliner.js) | C4 | L33-41, L111(OE), L255(useO) (+13) | pushUndo leading+trailing throttle |
| [src/components/shared/OutlinerEditor.jsx](../../src/components/shared/OutlinerEditor.jsx) | C4 | L111 (~+1) | handleTextChange uses pushUndoThrottled |
| [src/hooks/useOutliner.js](../../src/hooks/useOutliner.js) | C5 | L43-52 + new useLayoutEffect (~+18) | focus → hybrid (useLayoutEffect + rAF) |
| [src/components/shared/OutlinerEditor.jsx](../../src/components/shared/OutlinerEditor.jsx) | C6 | L20-32, L110-117 (~+12) | isEditingRef gate for sync race |
| [src/components/project/tasks/OutlinerTaskNode.jsx](../../src/components/project/tasks/OutlinerTaskNode.jsx) | C7 | L114-116 (~+15) | debounce + optimistic |

**총 4개 파일, 7개 커밋, ~93 LOC 순증가.**

---

## 2. DB / API / Backend

- **DB 마이그레이션**: 없음. `supabase/migrations/` 신규 파일 없음.
- **RLS / Policy**: 없음.
- **Edge Function**: 없음.
- **API 엔드포인트**: 없음. `updateTask` action 시그니처 무변경.
- **환경 변수**: 없음.

---

## 3. 커밋별 상세 hunk

### Commit 1 — `fix(outliner-row): autoResize useLayoutEffect dep [node.text, node.level]`

**파일**: [src/components/shared/OutlinerRow.jsx](../../src/components/shared/OutlinerRow.jsx)

```diff
@@ L26-28
   useLayoutEffect(() => {
     autoResize(localRef.current)
-  })
+  }, [node.text, node.level])
```

**LOC**: +1 / -1.
**리스크**: 최저. mount 시 `setRef` callback 내 `autoResize(el)` (L23) 와 `onChange`/`onFocus` 의 `autoResize(e.target)` (L63, L66) 보존 → 모든 height 갱신 경로 유지.

**D2 반영**: dep 에 `node.level` 포함 — Tab indent/outdent 시 `paddingLeft = node.level * 17` 변경 → textarea 가용 width 변경 → height 재계산 필요. text 만으로는 이 케이스 미커버.

---

### Commit 2 — `fix(outliner): Alt+Shift+Up swap with parent-boundary outdent`

**파일**: [src/hooks/useOutliner.js](../../src/hooks/useOutliner.js)

**대체 대상**: L159-173 (Alt+Shift+Up 분기)

```diff
@@ L159-173
     // Alt+Shift+↑ — swap with above (including children)
     if (e.altKey && e.shiftKey && e.key === 'ArrowUp') {
       e.preventDefault()
       if (idx === 0) return
-      pushUndo()
       const childEnd = getChildrenEnd(nodes, idx)
       const block = nodes.slice(idx, childEnd + 1)
+      const myLevel = nodes[idx].level
+
+      // 위쪽으로 traverse — 같은 level 또는 더 작은 level 노드 (Option β: 부모 매치 시 outdent)
+      let insertAt = -1
+      for (let j = idx - 1; j >= 0; j--) {
+        if (nodes[j].level <= myLevel) { insertAt = j; break }
+      }
+      if (insertAt === -1) return  // 매치 없음 (위쪽 모두 myLevel 초과)
+
+      pushUndoImmediate()
+      // Option β level 보정: 매치된 노드가 더 낮은 level 이면 block 전체 outdent
+      const targetLevel = nodes[insertAt].level
+      const delta = targetLevel - myLevel  // <= 0
+      const adjustedBlock = delta === 0 ? block : block.map(n => ({ ...n, level: n.level + delta }))
       const n = [...nodes]
       n.splice(idx, block.length)
-      const insertAt = Math.max(0, idx - 1)
-      n.splice(insertAt, 0, ...block)
+      n.splice(insertAt, 0, ...adjustedBlock)
       setNodes(n)
       focus(insertAt)
       return
     }
```

**참조**: `pushUndoImmediate` 는 C4 에서 도입. C2 가 단독 머지될 경우 `pushUndo` 그대로 사용 (C4 머지 후 일괄 rename).
→ **수정**: C2 는 `pushUndo()` 그대로 유지하고, C4 에서 `pushUndo` → `pushUndoImmediate` rename + character branch 만 throttled 로 분기. 커밋 독립성 확보.

```diff
   if (insertAt === -1) return  // 매치 없음
-  pushUndoImmediate()
+  pushUndo()  // C4 에서 rename
```

**LOC**: ~+12 / -2.
**리스크**: 중. swap 로직 자체가 변경됨. C9 음수 불가 증명 (Spec §4-1) 으로 bound check 불필요.

---

### Commit 3 — `fix(outliner): Alt+Shift+Down swap with sibling-boundary outdent`

**파일**: [src/hooks/useOutliner.js](../../src/hooks/useOutliner.js)

**대체 대상**: L174-188 (Alt+Shift+Down 분기)

**W8 보강 — `nextStart > childEnd` 보장 근거**: traverse 가 `j = childEnd + 1` 부터 시작하므로 `nextStart >= childEnd + 1`. block 길이 = `childEnd - idx + 1` 이고 splice 후 `nextStart` 의 실 위치는 `nextStart - block.length`. `nextEnd` 의 실 위치는 `nextEnd - block.length`. `nextEnd >= nextStart >= childEnd + 1` 이므로 `nextEnd - block.length >= childEnd + 1 - (childEnd - idx + 1) = idx` → insertAt = `nextEnd - block.length + 1 >= idx + 1` 항상 성립.

```diff
@@ L174-188
     // Alt+Shift+↓ — swap with below (including children)
     if (e.altKey && e.shiftKey && e.key === 'ArrowDown') {
       e.preventDefault()
       const childEnd = getChildrenEnd(nodes, idx)
       if (childEnd >= nodes.length - 1) return
-      pushUndo()
+      const myLevel = nodes[idx].level
+
+      // 다음 형제(같은 level 또는 더 작은 level)의 subtree 끝 찾기
+      let nextStart = -1
+      for (let j = childEnd + 1; j < nodes.length; j++) {
+        if (nodes[j].level <= myLevel) { nextStart = j; break }
+      }
+      if (nextStart === -1) return  // top-level 마지막
+
+      const nextEnd = getChildrenEnd(nodes, nextStart)
+      pushUndo()
       const block = nodes.slice(idx, childEnd + 1)
+      // Option β level 보정
+      const targetLevel = nodes[nextStart].level
+      const delta = targetLevel - myLevel  // <= 0
+      const adjustedBlock = delta === 0 ? block : block.map(n => ({ ...n, level: n.level + delta }))
       const n = [...nodes]
       n.splice(idx, block.length)
-      const insertAt = idx + 1
-      n.splice(insertAt, 0, ...block)
+      // block 제거 후 nextEnd 위치 = nextEnd - block.length, 그 다음 위치 = +1
+      const insertAt = nextEnd - block.length + 1
+      n.splice(insertAt, 0, ...adjustedBlock)
       setNodes(n)
       focus(insertAt)
       return
     }
```

**LOC**: ~+15 / -2.
**리스크**: 중. C2 와 동일 패턴 (대칭).

---

### Commit 4 — `fix(outliner): pushUndo leading + trailing throttle 500ms`

**파일 1**: [src/hooks/useOutliner.js](../../src/hooks/useOutliner.js)

**대체 대상**: L33-41 (pushUndo 정의)

```diff
@@ L33-41
   // Undo stack
   const undoStack = useRef([])
+  const lastUndoTime = useRef(0)
+  const trailingTimer = useRef(null)
+
+  const pushUndoImmediate = useCallback(() => {
+    const snap = JSON.stringify(nodesRef.current)
+    const stack = undoStack.current
+    if (stack.length > 0 && stack[stack.length - 1] === snap) return
+    stack.push(snap)
+    if (stack.length > MAX_UNDO) stack.shift()
+  }, [])
+
+  // Leading + trailing 500ms throttle — 입력 시작 직전 + 입력 종료 직후 양쪽 보존
+  // W-NEW-2: trailing 콜백에서 lastUndoTime 갱신 금지 — leading 억제 방지 (R-03 #2 보호)
+  const pushUndoThrottled = useCallback(() => {
+    const now = Date.now()
+    clearTimeout(trailingTimer.current)
+    if (now - lastUndoTime.current >= 500) {
+      lastUndoTime.current = now
+      pushUndoImmediate()  // leading edge — lastUndoTime 갱신
+    }
+    trailingTimer.current = setTimeout(() => {
+      pushUndoImmediate()  // trailing edge — lastUndoTime 갱신 안 함 (W-NEW-2)
+    }, 500)
+  }, [pushUndoImmediate])

-  const pushUndo = useCallback(() => {
-    const snap = JSON.stringify(nodesRef.current)
-    const stack = undoStack.current
-    if (stack.length > 0 && stack[stack.length - 1] === snap) return
-    stack.push(snap)
-    if (stack.length > MAX_UNDO) stack.shift()
-  }, [])
+  // 기존 pushUndo 시그니처 보존 — character input 만 throttled, 나머지 (Tab/Enter/Backspace/Swap/Paste) 는 immediate
+  const pushUndo = pushUndoImmediate
```

**대체 대상**: L253-256 (character branch)

```diff
@@ L253-256
     // Any other character input → push undo (throttled by snap comparison)
     if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
-      pushUndo()
+      pushUndoThrottled()
     }
```

**대체 대상**: hook return (L292)

```diff
@@ L292
-  return { refs, handleKeyDown, handlePaste, focus, selectionRef, onSelectionChange, clearSelection, pushUndo }
+  return { refs, handleKeyDown, handlePaste, focus, selectionRef, onSelectionChange, clearSelection, pushUndo, pushUndoThrottled }
```

**대체 대상**: handleKeyDown 의 `useCallback` deps (L257) — **3차 W1 반영: pushUndoThrottled 정의 직후에 함께 적용 필수**

```diff
@@ L257
-  }, [setNodes, focus, pushUndo])
+  }, [setNodes, focus, pushUndo, pushUndoThrottled])
```

**⚠️ 적용 체크리스트** (C4 단일 커밋 내 누락 방지):
- [ ] `useEffect` import 추가 (L1)
- [ ] `pushUndoImmediate` 정의 추가
- [ ] `pushUndoThrottled` 정의 추가 (trailing 에서 lastUndoTime 갱신 없음)
- [ ] 기존 `pushUndo` 정의 → `const pushUndo = pushUndoImmediate` alias
- [ ] `useEffect(() => () => clearTimeout(trailingTimer.current), [])` cleanup 추가
- [ ] character branch (L255) 의 `pushUndo()` → `pushUndoThrottled()`
- [ ] **handleKeyDown deps (L257) 에 `pushUndoThrottled` 추가** ← 누락 시 stale closure 로 throttle 미동작
- [ ] hook return (L292) 에 `pushUndoThrottled` 추가
- [ ] OutlinerEditor.jsx L81 destructure + L111-117 `handleTextChange` 에서 `pushUndoThrottled` 사용

**S2/W-NEW-2 정정**: 1차 리뷰의 S2 ("trailing 의 lastUndoTime 갱신") 는 잘못된 방향이었음 — 2차 리뷰에서 W-NEW-2 로 정정. **trailing 은 lastUndoTime 을 갱신하지 않음** (위 코드). 근거: idle 후 새 입력 시작 시 leading 발화 보장 (R-03 #2). snap 폭증 우려는 dedup (`stack[stack.length-1] === snap`) 으로 자동 해결.

**파일 2**: [src/components/shared/OutlinerEditor.jsx](../../src/components/shared/OutlinerEditor.jsx)

**대체 대상**: L81 (useOutliner destructure) + L110-117 (handleTextChange)

```diff
@@ L81
-  const { refs, handleKeyDown, handlePaste, focus, selectionRef, onSelectionChange, clearSelection, pushUndo } = useOutliner(...)
+  const { refs, handleKeyDown, handlePaste, focus, selectionRef, onSelectionChange, clearSelection, pushUndo, pushUndoThrottled } = useOutliner(...)

@@ L110-117
   const handleTextChange = useCallback((idx, text) => {
-    pushUndo()
+    pushUndoThrottled()
     setNodes(prev => {
       const n = [...prev]
       n[idx] = { ...n[idx], text }
       return n
     })
-  }, [pushUndo])
+  }, [pushUndoThrottled])
```

**Cleanup (unmount 시 trailingTimer)** — useOutliner 내부에 useEffect 추가:

```diff
@@ after L41 (pushUndoThrottled 정의 다음)
+  useEffect(() => () => clearTimeout(trailingTimer.current), [])
```

→ **주의**: `useOutliner` 가 `useEffect` 를 import 안 함. import 라인 추가 필요.

```diff
@@ L1
-import { useRef, useCallback } from 'react'
+import { useRef, useCallback, useEffect } from 'react'
```

**LOC**: ~+25 / -3 (양 파일 합계).
**리스크**: 중. throttle 도입으로 keystroke 처리 경로 변경. discrete 작업 (Tab/Enter/Backspace/Swap/Paste) 은 `pushUndo` 그대로 사용 → throttle 미적용 보장.

---

### Commit 5 — `fix(outliner): focus setTimeout → hybrid (useLayoutEffect + rAF)`

**파일**: [src/hooks/useOutliner.js](../../src/hooks/useOutliner.js)

**대체 대상**: L43-52 (focus 정의)

```diff
@@ L43-52 + 신규 useLayoutEffect
+  const pendingFocus = useRef(null)
+
+  // applyFocus: pendingFocus.current 를 직접 읽고 처리 (S1 반영 — Spec 의 인자 시그니처 대신 no-arg 단순화)
+  const applyFocus = useCallback(() => {
+    if (!pendingFocus.current) return
+    const { idx, pos } = pendingFocus.current
+    pendingFocus.current = null
+    const el = refs.current[idx]
+    if (!el) return
+    el.focus()
+    const p = pos === 'end' ? el.value.length : (typeof pos === 'number' ? pos : 0)
+    el.setSelectionRange(p, p)
+  }, [])
+
+  // rAF 콜백 wrapper — rAF 가 DOMHighResTimeStamp 인자를 전달하지만 무시
+  const rafApplyFocus = useCallback(() => { applyFocus() }, [applyFocus])
+
   /* ── Focus helper (runs after React commit) ── */
   const focus = useCallback((idx, pos = 'end') => {
-    setTimeout(() => {
-      const el = refs.current[idx]
-      if (!el) return
-      el.focus()
-      const p = pos === 'end' ? el.value.length : (typeof pos === 'number' ? pos : 0)
-      el.setSelectionRange(p, p)
-    }, 30)
+    pendingFocus.current = { idx, pos }
+    // Fallback: setNodes/setState 미동반 경로 (arrow nav, imperative) 용
+    // setNodes 동반 경로는 useLayoutEffect 가 commit 직후 처리하여 pendingFocus null 로 만듦
+    requestAnimationFrame(rafApplyFocus)
-  }, [])
+  }, [rafApplyFocus])
+
+  // useLayoutEffect (S3 반영 — useOutliner 내부에 위치 결정. hook 이 OutlinerEditor 에서 호출되므로
+  // 동일 commit phase 에서 실행. no-dep, 매 commit 후 실행하지만 pendingFocus null 체크로 cost 무시)
+  // W2 (3차) 반영 — ESLint react-hooks/exhaustive-deps 경고 회피 위해 화살표 함수로 래핑
+  useLayoutEffect(() => { applyFocus() })
```

**Import 추가**:
```diff
@@ L1
-import { useRef, useCallback, useEffect } from 'react'
+import { useRef, useCallback, useEffect, useLayoutEffect } from 'react'
```

**경로별 동작 확인** (Spec §4-3 F1~F4):
- **F1 (Mutating)**: setNodes → render → useLayoutEffect 동기 focus → pendingFocus null → rAF callback no-op
- **F2 (Selection)**: setSelection → setSelectedSet (OutlinerEditor wired) → re-render → useLayoutEffect 동기 focus → rAF no-op
- **F3 (Arrow Nav)**: state 미변경 → re-render 없음 → useLayoutEffect 미실행 → rAF fallback 이 다음 frame 에 처리
- **F4 (Imperative)**: focusFirst/focusLast 외부 호출 → focus() 호출 시점에 React phase 외 → rAF fallback

**OutlinerEditor.jsx focusFirst/focusLast 동작 확인** (L96-99):
- 외부 ref 에서 호출됨 → focus() 진입 → pendingFocus.current 저장 + rAF 예약
- 다음 frame 에 applyFocus 실행 → ref 해석 → focus 적용
- **주의**: 외부 호출 시점이 React render 외부면 useLayoutEffect 가 안 돌 수 있음 → rAF 가 처리. 정상.

**LOC**: ~+18 / -7.
**리스크**: 중. 14개 focus 호출 경로 모두 검증 필요. AC-07a (setTimeout 30 잔존 없음) grep 검증 필수.

---

### Commit 6 — `fix(outliner-editor): editing guard + lastEmitted normalization`

**파일**: [src/components/shared/OutlinerEditor.jsx](../../src/components/shared/OutlinerEditor.jsx)

**설계 변경 (D1 반영)**: 초기 diff plan 은 `handleTextChange` 에서만 isEditingRef set → Tab/Enter/Backspace/Swap/Paste 등 discrete 키 작업 후 race 미해결. **emit effect 단일 지점에서 set** 으로 일원화.

**round-trip safety (W-NEW-1 반영)**: `parseNotes`/`serializeNotes` 비대칭으로 raw notes (bullet prefix, whitespace 포함) 와 정규화 form 이 다름. lastEmitted 를 raw form 으로 저장하면 emit effect 가 mount 시 + 외부 sync 시 false-positive 트리거 → isEditingRef 오염 + 부모 데이터 정규화. **lastEmitted 를 항상 정규화 form 으로 유지** + sync effect 비교도 정규화 form 으로 일원화.

**대체 대상**: L16-22 (state/ref 초기화) + L25-32 (sync effect) + L34-41 (emit effect)

```diff
@@ L16-22 (state/ref 초기화 — W-NEW-1 정규화)
   const [nodes, setNodes] = useState(() => {
     const parsed = parseNotes(notes)
     return parsed.length ? parsed : [{ text: '', level: 0 }]
   })
-  const lastEmitted = useRef(notes || '')
+  // W-NEW-1: lastEmitted 를 정규화 form (serializeNotes 결과) 으로 초기화 → round-trip safe
+  const lastEmitted = useRef(null)
+  if (lastEmitted.current === null) {
+    lastEmitted.current = serializeNotes(nodes)
+  }
   const pendingAdd = useRef(false)
+  const isEditingRef = useRef(false)
+  const editingTimeoutRef = useRef(null)
   const [collapsed, setCollapsed] = useState({})
   const [selectedSet, setSelectedSet] = useState(new Set())

@@ L25-32 (sync effect — isEditingRef gate + 정규화 form 비교)
   /* ── Sync from parent (external edits) ── */
   useEffect(() => {
+    if (isEditingRef.current) return  // 편집 중 외부 sync 무시
-    if (notes !== lastEmitted.current) {
-      const parsed = parseNotes(notes)
-      setNodes(parsed.length ? parsed : [{ text: '', level: 0 }])
-      lastEmitted.current = notes || ''
-    }
+    // W-NEW-1: parseNotes → serializeNotes 정규화 후 비교. raw notes 와 lastEmitted 직접 비교 시 false-positive 발생
+    const parsed = parseNotes(notes)
+    const nextNodes = parsed.length ? parsed : [{ text: '', level: 0 }]
+    const normalized = serializeNotes(nextNodes)
+    if (normalized !== lastEmitted.current) {
+      setNodes(nextNodes)
+      lastEmitted.current = normalized  // 정규화 form 저장 — emit effect 비교 round-trip safe
+    }
   }, [notes])

@@ L34-41 (emit effect — D1 반영, 모든 로컬 변경 경로 일괄 보호)
   /* ── Emit local changes to parent ── */
   useEffect(() => {
     const serialized = serializeNotes(nodes)
     if (serialized !== lastEmitted.current) {
       lastEmitted.current = serialized
+      // 로컬 변경 마커 — text/Tab/Enter/Backspace/Swap/Paste 모두 이 경로 통과
+      isEditingRef.current = true
+      clearTimeout(editingTimeoutRef.current)
+      editingTimeoutRef.current = setTimeout(() => {
+        isEditingRef.current = false
+      }, 1000)
       onChange(serialized)
     }
   }, [nodes, onChange])
```

**handleTextChange 는 무수정** (D1 일원화로 isEditingRef set 불필요).

**자기에코 round-trip 검증** (W-NEW-1 해결 증명):
- mount 시: `lastEmitted = serializeNotes(initialNodes)` = 정규화 form. emit effect 첫 실행 → `serializeNotes(nodes) === lastEmitted` → skip ✓ (raw notes 가 bullet prefix 등을 포함해도 false-positive 없음).
- 외부 sync 시: `lastEmitted = serializeNotes(nextNodes)` 갱신. emit effect 재실행 → `serializeNotes(nodes) === lastEmitted` → skip ✓.
- 동일 raw notes 가 부모에서 반복 전달되어도 (parent re-render): sync effect 의 `normalized !== lastEmitted` 비교에서 동일 → setNodes skip ✓ (기존에는 raw 비교라 매번 setNodes 트리거 가능했음, 부수적 개선).

**Cleanup**: unmount 시 timeout cleanup

```diff
@@ after L41 (emit effect 다음)
+  useEffect(() => () => clearTimeout(editingTimeoutRef.current), [])
```

**LOC**: ~+15 / -4.
**리스크**: 중. sync/emit effect 양쪽 동작 변경. 테스트: (a) bullet prefix 포함 notes mount → 의도치 않은 onChange 없음 (W-NEW-1 회귀 방지), (b) 단독 텍스트 입력 → 1초 정지 후 외부 sync 반영 (E1, E3), (c) Tab/Enter/Backspace 후 800ms 이내 외부 sync 차단 (E6, E7), (d) Swap 후 외부 sync 차단 (E7).

---

### Commit 7 — `fix(outliner-task-node): debounce + optimistic update for notes`

**파일**: [src/components/project/tasks/OutlinerTaskNode.jsx](../../src/components/project/tasks/OutlinerTaskNode.jsx)

**대체 대상**: L114-116 (handleNotesChange)

**⚠️ 들여쓰기 주의 (3차 W3 반영)**: `debounceRef` 는 **컴포넌트 body 최상위 레벨** 에 선언. `useCallback` 내부에 넣으면 Rules of Hooks 위반 (조건부 호출). 아래 hunk 의 들여쓰기 = 2칸 (handleNotesChange 와 동일 레벨).

```diff
@@ L114-116
+  const debounceRef = useRef(null)            // ← 컴포넌트 body 최상위, useCallback 외부
   const handleNotesChange = useCallback((newNotes) => {
-    updateTask(task.id, { notes: newNotes })
+    clearTimeout(debounceRef.current)
+    debounceRef.current = setTimeout(() => {
+      updateTask(task.id, { notes: newNotes })
+    }, 800)
+    // 즉시 visual feedback (DetailPanel/FocusCard 패턴)
+    useStore.setState(s => ({
+      tasks: s.tasks.map(t => t.id === task.id ? { ...t, notes: newNotes } : t)
+    }))
   }, [task.id, updateTask])
+
+  // unmount cleanup — stale updateTask 호출 방지 (컴포넌트 body 최상위)
+  useEffect(() => () => clearTimeout(debounceRef.current), [])
```

**Import 확인**: L1 에 `useEffect`, `useRef`, `useCallback` 모두 이미 있음 ✓. `useStore` 도 이미 import ✓.

**LOC**: ~+10 / -1.
**리스크**: 중. project view (CompactTaskRow 와 다른 경로) 의 노트 저장 동작 변경. AC-14 (CompactTaskRow 영향 없음) 와 AC-10 (OutlinerTaskNode 800ms debounce) 모두 검증 필요.

---

## 4. 작업 순서 (의존성)

```
C1 (autoResize dep)        ← 독립, baseline
  ↓
C2 (Up swap)               ← pushUndo 사용 (rename 전)
  ↓
C3 (Down swap)             ← 동일
  ↓
C4 (pushUndo throttle)     ← pushUndo → pushUndoImmediate rename + pushUndoThrottled 추가
  ↓                          handleTextChange 가 pushUndoThrottled 사용
C5 (focus hybrid)          ← focus() 시그니처 무변경 (내부만), C2/C3 의 focus(insertAt) 호출 영향 없음
  ↓
C6 (isEditingRef)          ← handleTextChange 수정 (C4 와 같은 함수). C4 의 pushUndoThrottled 호출 보존
  ↓
C7 (OutlinerTaskNode)      ← OutlinerEditor 무관, 독립적이지만 C6 의 isEditingRef 효과로 통합 race 보호 완성
```

**의존성 핵심**:
- C2/C3 가 C4 머지 전에 `pushUndo()` 호출. C4 에서 `pushUndo = pushUndoImmediate` alias 유지 → C2/C3 호출 자동 호환.
- C5 의 focus 시그니처 (`focus(idx, pos)`) 무변경 → C2/C3 의 호출처 영향 없음.
- C6 의 handleTextChange 수정 시 C4 에서 도입한 `pushUndoThrottled()` 호출 보존 (지우지 말 것).

---

## 5. 검증 절차

### 5-1. 커밋별 즉시 검증

각 커밋 머지 직후:
```bash
npm run build              # AC-16
grep -rn "setTimeout.*30" src/hooks/useOutliner.js src/components/shared/OutlinerEditor.jsx  # AC-07a (C5 머지 후 확인)
```

### 5-2. 통합 검증 (7커밋 누적 후)

Spec §7 의 10개 시나리오 전부 수동 실행:

1. **DetailPanel 단독 빠른 타이핑** — 글자 누락/점프 없음 (AC-08)
2. **FocusCard 인라인 편집** — 타이핑 중 노트 아이콘 색 즉시 갱신 (AC-15)
3. **DetailPanel + FocusCard 동시 편집** — 양쪽 자기 입력 보호 (AC-09)
4. **MemoryView 메모 편집** — 회귀 없음 (AC-13)
5. **OutlinerTaskNode 노트 편집** — 800ms debounce 동작, 즉시 visual (AC-10)
6. **CompactTaskRow 노트 편집** — 회귀 없음 (AC-14)
7. **Swap 8 시나리오** (Spec §4-1 C1~C8): flat 첫/끝, 첫 자식, 마지막 자식, parent boundary outdent, 자식 동반, top-level — 모두 의도대로 동작 (AC-01, AC-02)
8. **Undo**: 1초 연속 타이핑 후 Ctrl+Z (시작 직전 복귀, AC-03), 짧은 타이핑 (<500ms) 후 Ctrl+Z (전체 undo, AC-04)
9. **Focus**: Enter split / Backspace merge / Tab / Shift+ArrowDown / ArrowUp navigation 모두 즉시 focus (AC-05, AC-06, AC-07)
10. **Paste**: 멀티라인 붙여넣기 후 마지막 line 끝에 cursor

### 5-3. Grep 검증 (AC-07a)

```bash
grep -n "setTimeout.*30" src/hooks/useOutliner.js src/components/shared/OutlinerEditor.jsx
# 기대 결과: 매치 없음
```

OutlinerTaskNode.jsx L36, L48 의 `setTimeout(..., 30/50)` 은 본 Loop 범위 외 (focusTitle/focusLast 의 imperative handle, useOutliner 와 별개) — 잔존 허용.

### 5-4. 회귀 위험 모니터링

- **C5 (focus hybrid)** 머지 후: paste 멀티라인 시 cursor 위치 (Spec §3 R-04 paste handler 동일 경로 사용 확인)
- **C6 (isEditingRef)** 머지 후: 다른 device 동기화 지연이 1.0~1.8초 (800ms debounce + 1000ms idle timeout) 인지 timing 측정
- **C7 (OutlinerTaskNode)** 머지 후: project view 의 task list 즉시 갱신 확인 (`useStore.setState` 가 단일 source of truth 이므로 정상 작동 보장됨, Spec R-07 사전 검증 §)

---

## 6. 미해결 / 후속 항목

- **OutlinerTaskNode focusTitle/focusLast 의 setTimeout 30/50ms** ([L36, L48](../../src/components/project/tasks/OutlinerTaskNode.jsx#L36)): focus() hybrid pattern 을 imperative handle 에도 적용하면 일관성 ↑. 본 Loop 범위 외, 별도 Loop 후보.
- **MemoryView 의 500ms debounce vs 본 Loop 의 800ms**: 일관성 차이 존재 (memo vs task). 본 Loop 에서 통일 미수행 (N-02 호출처 무영향 원칙).
- **Loop-46 N-13 정책 문서 갱신**: 본 Loop 가 첫 적용 사례. `docs/loops/loop-46*.md` 의 N-13 조항을 "props 인터페이스 무변경 시 내부 수정 허용" 으로 갱신 권장 (별도 PR).
