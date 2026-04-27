# Sub-Loop 7-E2: MS Sortable + Task → MS 헤더 Drop

## 목표
요구사항 #4 마지막: "마일스톤 간 순서 위치 드래그앤드랍 변경" + "마일스톤을 특정 과제 위로 지정"
요구사항 #6 마지막: "마일스톤 하위로 Task 지정" (MS 헤더에 task 직접 drop)

- MilestoneRow를 useDraggable → useSortable로 변경
- 같은 셀 내 MS 순서 변경 (`reorderMilestones`)
- 다른 셀의 MS 헤더 위로 MS drop = cross-cell cascade (`moveMilestoneWithTasks`)
- task를 MS 헤더 위로 drop = `keyMilestoneId` 변경 + cross-cell이면 추가 cascade

---

## REQ-LOCK 요구사항

1. MilestoneRow `useSortable({ id: 'cell-ms:${ms.id}' })` — `interactive=true && !isEditing`일 때만
2. CellContent items 배열에 MS id 포함 — MS와 task가 같은 SortableContext
3. 같은 셀 MS sortable end → `reorderMilestones` (sort_order batch update)
4. 다른 셀 MS sortable end → `moveMilestoneWithTasks` (7-D cascade)
5. task → MS 헤더 drop:
   - 같은 셀: `updateTask({ keyMilestoneId })` 만
   - 다른 셀: `updateTask({ projectId, assigneeId, category: 'today', keyMilestoneId })` (R5 차단 자동)
6. MS → task 헤더 drop (`cell-task:`) — 같은 셀이면 no-op (moveMilestoneWithTasks early return), 다른 셀이면 cascade (기존 fix-2 동작 그대로)
7. weekly grids 변경 없음
8. Vite TDZ 0건
9. 7-E1, 7-E1 fix-1/fix-2의 기존 동작 모두 보존

---

## 영향 파일

| # | 파일 | 종류 | 변경 요약 |
|---|---|---|---|
| 1 | `src/components/views/grid/cells/MilestoneRow.jsx` | EDIT | useDraggable → useSortable, transform 적용 |
| 2 | `src/components/views/grid/cells/CellContent.jsx` | EDIT | allTaskIds → allItemIds (MS id 포함) |
| 3 | `src/components/views/UnifiedGridView.jsx` | EDIT | handleDragEnd: over=cell-ms: 분기 신규 추가, store destructure에 reorderMilestones 추가 |

> useStore — 변경 없음 (`reorderMilestones` 이미 존재)
> grids/* — 변경 없음 (cellSortableId prop 그대로)

---

## 1. EDIT: `src/components/views/grid/cells/MilestoneRow.jsx`

### 1-1. import 변경

```jsx
// OLD
import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { COLOR } from '../../../../styles/designTokens'
```
```jsx
// NEW
import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { COLOR } from '../../../../styles/designTokens'
```

### 1-2. useDraggable → useSortable + transform

```jsx
// OLD
  // 7-D: drag handle — interactive 모드에서만 활성, 편집 중에는 비활성
  const dragDisabled = !interactive || isEditing
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `cell-ms:${ms.id}`,
    disabled: dragDisabled,
  })

  const showHoverButtons = interactive && hover && !isEditing

  return (
    <div
      ref={setNodeRef}
      {...(dragDisabled ? {} : { ...attributes, ...listeners })}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 2px 2px', marginBottom: 1,
        background: hover && interactive ? COLOR.bgHover : 'transparent',
        borderRadius: 3,
        position: 'relative',
        cursor: dragDisabled ? 'default' : 'grab',
        opacity: isDragging ? 0.3 : 1,
      }}
    >
```
```jsx
// NEW
  // 7-D/7-E2: sortable handle — interactive 모드에서만 활성, 편집 중에는 비활성
  const dragDisabled = !interactive || isEditing
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `cell-ms:${ms.id}`,
    disabled: dragDisabled,
  })

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const showHoverButtons = interactive && hover && !isEditing

  return (
    <div
      ref={setNodeRef}
      {...(dragDisabled ? {} : { ...attributes, ...listeners })}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...sortableStyle,
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 2px 2px', marginBottom: 1,
        background: hover && interactive ? COLOR.bgHover : 'transparent',
        borderRadius: 3,
        position: 'relative',
        cursor: dragDisabled ? 'default' : 'grab',
        opacity: isDragging ? 0.3 : 1,
      }}
    >
```

> 변경: `useDraggable` → `useSortable`, `transform`/`transition` 추출, `sortableStyle` 객체로 inline style 시작 부분에 spread.
> 나머지 본문(input/buttons/breadcrumb 등) 변경 없음.

---

## 2. EDIT: `src/components/views/grid/cells/CellContent.jsx`

### 2-1. allTaskIds → allItemIds (MS id 포함)

```jsx
// OLD
  // 7-E1: 셀 내 모든 active task id 수집 (MS 그룹 + ungrouped, done 제외)
  const allTaskIds = useMemo(() => {
    const ids = []
    groups.msGroups.forEach(g => g.tasks.forEach(t => ids.push(`cell-task:${t.id}`)))
    groups.ungrouped.forEach(t => ids.push(`cell-task:${t.id}`))
    return ids
  }, [groups])
```
```jsx
// NEW
  // 7-E1/7-E2: 셀 내 모든 sortable item id 수집
  // - MS 헤더 (msGroups의 msId)
  // - MS 안 task
  // - ungrouped task
  // done은 SortableContext 밖 (제외)
  const allItemIds = useMemo(() => {
    const ids = []
    groups.msGroups.forEach(g => {
      ids.push(`cell-ms:${g.msId}`)
      g.tasks.forEach(t => ids.push(`cell-task:${t.id}`))
    })
    groups.ungrouped.forEach(t => ids.push(`cell-task:${t.id}`))
    return ids
  }, [groups])
```

### 2-2. SortableContext에 전달하는 items 변수 이름 변경

기존 두 곳 (early return + main return)에서 `items={allTaskIds}` → `items={allItemIds}`로 교체:

```jsx
// OLD (2곳)
        <SortableContext items={allTaskIds} id={cellSortableId} strategy={verticalListSortingStrategy}>
```
```jsx
// NEW (2곳)
        <SortableContext items={allItemIds} id={cellSortableId} strategy={verticalListSortingStrategy}>
```

---

## 3. EDIT: `src/components/views/UnifiedGridView.jsx`

### 3-1. store destructure에 reorderMilestones 추가

```js
// OLD
  const { projects, tasks, updateTask, moveTaskTo, reorderTasks, toggleDone, openDetail, addTask, sortProjectsLocally, updateMilestone, deleteMilestone, openConfirmDialog, moveMilestoneWithTasks } = useStore()
```
```js
// NEW
  const { projects, tasks, updateTask, moveTaskTo, reorderTasks, toggleDone, openDetail, addTask, sortProjectsLocally, updateMilestone, deleteMilestone, openConfirmDialog, moveMilestoneWithTasks, reorderMilestones } = useStore()
```

### 3-2. handleDragEnd에 over=cell-ms: 분기 추가

`cell-task:` 분기 직후, `parts.length < 3` 체크 직전에 추가:

```js
// OLD
    // ═══ 1) over가 cell-task: (sortable item 위에 drop) ═══
    if (overId.startsWith('cell-task:')) {
      // ... (fix-2 로직 그대로)
      return
    }

    // ═══ 2) over가 droppable cell zone (mat/tmat/pw/tw) ═══
    const parts = overId.split(':')
    if (parts.length < 3) return
    const mode = parts[0]
```
```js
// NEW
    // ═══ 1) over가 cell-task: (sortable item 위에 drop) ═══
    if (overId.startsWith('cell-task:')) {
      // ... (fix-2 로직 그대로 — 변경 없음)
      return
    }

    // ═══ 1.5) over가 cell-ms: (MS 헤더 위에 drop) — 7-E2 ═══
    if (overId.startsWith('cell-ms:')) {
      const overMsId = overId.slice(8)
      const overMs = milestones.find(m => m.id === overMsId)
      if (!overMs) return

      // MS source — MS sortable end (same cell) or cascade (cross cell)
      if (isMs) {
        if (msId === overMsId) return
        const activeMs = milestones.find(m => m.id === msId)
        if (!activeMs) return

        const sameCell = (
          activeMs.project_id === overMs.project_id &&
          activeMs.owner_id === overMs.owner_id
        )

        if (sameCell) {
          // 같은 셀 내 MS 순서 변경
          const cellMs = milestones.filter(m =>
            m.project_id === activeMs.project_id &&
            m.owner_id === activeMs.owner_id
          ).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

          const oldIndex = cellMs.findIndex(m => m.id === msId)
          const newIndex = cellMs.findIndex(m => m.id === overMsId)
          if (oldIndex === -1 || newIndex === -1) return

          const reordered = arrayMove(cellMs, oldIndex, newIndex)
          reorderMilestones(reordered)
        } else {
          // 다른 셀 — over MS의 cell로 cascade
          moveMilestoneWithTasks(msId, {
            targetProjectId: overMs.project_id,
            targetOwnerId: overMs.owner_id,
          })
        }
        return
      }

      // Task source — task를 MS 헤더 위로 drop = keyMilestoneId 변경
      if (!task) return
      const sameCell = (
        task.projectId === overMs.project_id &&
        task.assigneeId === overMs.owner_id
      )

      if (sameCell) {
        // 같은 셀 — keyMilestoneId만 변경
        if (task.keyMilestoneId === overMsId) return
        updateTask(task.id, { keyMilestoneId: overMsId })
      } else {
        // 다른 셀 — cross-cell + keyMilestoneId 새 MS로 set
        updateTask(task.id, {
          projectId: overMs.project_id,
          assigneeId: overMs.owner_id,
          category: 'today',
          keyMilestoneId: overMsId,
        })
      }
      return
    }

    // ═══ 2) over가 droppable cell zone (mat/tmat/pw/tw) ═══
    const parts = overId.split(':')
    if (parts.length < 3) return
    const mode = parts[0]
```

### 3-3. useCallback deps 갱신

```js
// OLD
  }, [tasks, moveTaskTo, updateTask, moveMilestoneWithTasks, userId, reorderTasks])
```
```js
// NEW
  }, [tasks, milestones, moveTaskTo, updateTask, moveMilestoneWithTasks, userId, reorderTasks, reorderMilestones])
```

> deps 추가: `milestones` (overMs/activeMs find), `reorderMilestones` (신규 호출).

---

## DELETE-5 검증

| 항목 | ① import | ② caller | ③ props | ④ deps | ⑤ types | 처리 |
|---|---|---|---|---|---|---|
| MilestoneRow `useDraggable` import | MilestoneRow §1-1 | useDraggable 호출 1곳 | — | — | — | `useSortable`로 교체 |
| CellContent `allTaskIds` 변수 | — | SortableContext items prop 2곳 | — | useMemo 1곳 | — | `allItemIds`로 rename + MS id 추가 |
| handleDragEnd `cell-ms:` over 분기 신규 | — | UnifiedGridView §3-2 | — | useCallback deps | — | 신규 추가 |
| handleDragEnd useCallback deps | — | — | — | milestones, reorderMilestones 추가 | — | 갱신 |

### 잔여 import 검증
- [x] MilestoneRow: `useSortable`, `CSS` 추가 — 사용
- [x] CellContent: 신규 import 0건 (allItemIds 변수 rename만)
- [x] UnifiedGridView: `reorderMilestones` destructure 추가 — handleDragEnd 사용
- [x] 다른 곳에서 `allTaskIds` 참조 0건 (rename 안전)

### 동작 동등성 (변경 없는 부분)
- [x] TaskRow — 변경 없음
- [x] InlineMsAdd — 변경 없음 (MS 추가 후 setEditingId 정상)
- [x] DoneSection — 변경 없음
- [x] Weekly grids — cellSortableId 미전달 → SortableContext 비활성 → MilestoneRow의 useSortable이 SortableContext 없이 일반 draggable처럼 fallback (7-E1과 동일 패턴)
- [x] cell-task: 분기 (fix-2) — 변경 없음
- [x] cell drop zone 분기 (mat/tmat/pw/tw) — 변경 없음
- [x] MS source + over=cell-task: 분기 (fix-2) — 변경 없음 (same cell이면 cascade의 early return으로 no-op, 다른 셀이면 cascade)
- [x] 7-A 인라인 편집/삭제, 7-B done section, 7-C InlineMsAdd, 7-D MS DnD cascade, 7-E1 task sortable — 모두 보존

---

## REQ-LOCK 검증

| # | 요구사항 | 적용 위치 | 확인 |
|---|---|---|---|
| 1 | MilestoneRow useSortable | MilestoneRow §1-2 | ✓ |
| 2 | items 배열에 MS id | CellContent §2-1 | ✓ |
| 3 | same cell MS reorder | UnifiedGridView §3-2 sameCell 분기 | ✓ |
| 4 | cross cell MS cascade | UnifiedGridView §3-2 else | ✓ |
| 5 | task → MS 헤더 drop | UnifiedGridView §3-2 task 분기 | ✓ |
| 6 | MS → cell-task fallback | fix-2 그대로 보존 | ✓ |
| 7 | weekly 변경 없음 | grids/* 미수정 | ✓ |
| 8 | Vite TDZ 0건 | 모든 token inline | ✓ |
| 9 | 기존 동작 보존 | 위 동등성 검증 | ✓ |

---

## 빌드 검증 명령

```bash
# 1. 빌드
npm run build

# 2. MilestoneRow의 useSortable 사용
grep -n "useSortable" src/components/views/grid/cells/MilestoneRow.jsx
# 예상: import 1건 + 호출 1건

# 3. CellContent allItemIds rename 확인
grep -n "allTaskIds\|allItemIds" src/components/views/grid/cells/CellContent.jsx
# 예상: allItemIds만, allTaskIds 0건

# 4. cell-ms: over 분기 사용
grep -n "overId.startsWith('cell-ms:')" src/components/views/UnifiedGridView.jsx
# 예상: 1건 (handleDragEnd 안 신규 분기)

# 5. reorderMilestones destructure
grep -n "reorderMilestones" src/components/views/UnifiedGridView.jsx
# 예상: destructure 1건 + 호출 1건 + deps 1건
```

## 런타임 검증 체크리스트

### MS 순서 변경 (같은 셀)
- [ ] 같은 셀에 MS 2개 이상 만든 후 한 MS를 다른 MS 헤더 위로 drag
- [ ] visual reorder 정상
- [ ] drop 후 순서 유지 (새로고침 후에도)
- [ ] DB sort_order 업데이트 (Supabase 직접 확인)

### task → MS 헤더 drop (같은 셀)
- [ ] ungrouped task를 같은 셀의 MS 헤더 위로 drag
- [ ] task가 그 MS 그룹 안으로 이동 (keyMilestoneId 변경)
- [ ] sortOrder는 그대로 (그 MS 그룹 안에서 자연 정렬)

### task → MS 헤더 drop (다른 셀)
- [ ] task를 다른 셀의 MS 헤더 위로 drag
- [ ] task의 projectId, assigneeId, category, keyMilestoneId 모두 변경
- [ ] 새 MS 그룹 안에 표시

### task → 빈 MS 헤더 drop
- [ ] task 0개인 MS (cellMilestones에서만 표시되는 빈 MS) 헤더 위로 task drag
- [ ] task가 그 MS에 합류 (count: 0건 → 1건)

### MS → 다른 MS 헤더 drop (cross cell)
- [ ] 다른 셀의 MS 헤더 위로 MS drag
- [ ] cascade 정상 (자식 MS + task 모두 따라감)
- [ ] over MS와 같은 (project_id, owner_id)로 active MS의 메타 update

### MS → cell-task: drop (회귀)
- [ ] 다른 셀의 task 위로 MS drag → fix-1/fix-2 동작 (cascade)
- [ ] 같은 셀의 task 위로 MS drag → no-op (early return — 의도된 동작)

### 7-E1 회귀
- [ ] 같은 MS 그룹 내 task reorder — 정상
- [ ] cross-MS-group within same cell — keyMilestoneId 변경 + reorder
- [ ] cross-cell task drag (over=다른 task) — 정상

### 7-A/B/C 회귀
- [ ] MS 인라인 편집 — 편집 중 drag 비활성 (dragDisabled)
- [ ] MS + 버튼 task 추가 — 정상
- [ ] MS ⋮ 삭제 — confirm dialog 정상
- [ ] MS 토글 (▾) — 접기/펼치기 정상
- [ ] Done section 펼침/접힘 — 정상
- [ ] InlineMsAdd → 새 MS 즉시 편집 모드 — 정상

### Weekly 회귀
- [ ] 개인 주간 — task drag 정상, MS 헤더는 read-only (interactive=false)
- [ ] 팀 주간 — 동일

---

## 잠재 디버깅 포인트

### 1. 빈 MS 헤더가 작아서 drop target 매칭 어려움
빈 MS는 task 0개라 행 높이가 작음. closestCenter가 작은 영역도 잘 매칭하지만, 만약 잘 안 잡히면 MilestoneRow의 padding을 살짝 늘리는 fix.

### 2. SortableContext items 배열의 ID 일관성
allItemIds에서 MS id는 `cell-ms:${g.msId}`로 만들고, MilestoneRow의 useSortable id도 같은 형식. 두 id가 정확히 일치해야 sortable 동작. 빌드 후 console에서 활성 sortable items 확인 가능.

### 3. cross cell MS reorder 시 sortOrder 충돌
다른 owner의 MS와 sort_order가 0,1,2... 겹치는 건 정상 (filter로 분리되므로). 같은 owner의 MS만 reorder됨.

---

## 커밋 메시지

```
feat(matrix): MS sortable + task→MS-header drop (Sub-Loop 7-E2)

- MilestoneRow: useDraggable → useSortable with id 'cell-ms:${ms.id}'
  * Disabled when !interactive || isEditing (same as 7-D rule)
  * transform/transition applied for visual sortable feedback
- CellContent: allTaskIds → allItemIds, MS id included before MS's tasks
  * Single SortableContext per cell handles MS + task as one ordered list
- UnifiedGridView handleDragEnd:
  * New branch: over.startsWith('cell-ms:')
    - MS source same cell → reorderMilestones (sort_order batch)
    - MS source cross cell → moveMilestoneWithTasks cascade
    - Task source same cell → updateTask({ keyMilestoneId })
    - Task source cross cell → updateTask({ projectId, assigneeId, category, keyMilestoneId })
  * New branch placed BEFORE parts.length<3 check (fix-2 lesson applied)
  * MS source + over=cell-task: branch unchanged (delegates to cascade or no-ops)
- reorderMilestones added to store destructure
- useCallback deps gain milestones, reorderMilestones
- MS reorder achieves requirement #4 final piece
- Task → MS header drop achieves requirement #6 final piece
```
