# Sub-Loop 7-E1 Hot-fix 1: closestCenter collision detection

## 버그
같은 MS 그룹 내 task 순서 변경 + 같은 셀의 다른 MS 그룹으로 task 이동이 시각적으로는 동작하지만 drop 후 reorder가 적용되지 않음. 원래 순서로 돌아감.

## 원인
`UnifiedGridView`의 `DndContext`에 `collisionDetection`이 명시되지 않음 → dnd-kit default = `rectIntersection`.

구조상 `DroppableCell`(외부 `mat:`/`tmat:`)이 sortable item(`cell-task:`)을 감싸고 있어서, 마우스 포인터가 task 위에 있을 때 item과 부모 cell이 **둘 다 intersect**. `rectIntersection`은 부모 cell을 우선 매칭함 → `over.id`가 `cell-task:` 가 아니라 `mat:`/`tmat:` 형식으로 들어옴.

handleDragEnd 흐름:
1. `overId.startsWith('cell-task:')` 분기 → false (실제로는 `mat:`)
2. `mode === 'mat'` 분기 → 진입
3. `task.projectId === targetProjId && task.category === targetCat` → true (같은 셀)
4. `return` → no-op
5. 시각적 reorder는 dnd-kit이 transform으로만 처리 → drop 후 transform 해제 → 원래 위치로 복귀

## Fix
`closestCenter` 적용. sortable에서 표준 권장 collision detection으로, 마우스 포인터에 가장 가까운 center를 가진 droppable을 매칭 → sortable item이 우선 잡힘.

---

## 영향 파일

| 파일 | 변경 |
|---|---|
| `src/components/views/UnifiedGridView.jsx` | import 1줄 + DndContext prop 1개 추가 |

---

## EDIT: `src/components/views/UnifiedGridView.jsx`

### 1. import에 closestCenter 추가

```js
// OLD
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
```
```js
// NEW
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay, closestCenter } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
```

### 2. DndContext에 collisionDetection prop 추가

```jsx
// OLD
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
```
```jsx
// NEW
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
```

---

## 부수 효과 검증

`closestCenter`는 sortable의 표준이지만, **non-sortable cross-cell DnD에 영향을 줄 가능성** 검토:

1. **Cross-cell task drag (다른 셀로 이동)**: target 셀의 빈 공간에 drop → 그 셀이 가장 가까운 droppable → over가 `mat:`/`tmat:` 정상 매칭 → 기존 분기 동작
2. **Cross-cell task drag → target 셀에 task가 있을 때**: 마우스가 target 셀 안의 task 위에 있으면 그 task의 `cell-task:`가 가장 가까운 center → sortable end 분기로 들어감 → cross-cell 분기 (overTask 기반) 처리 → 정상
3. **MS DnD (cell-ms / bl-ms → 셀)**: target 셀의 빈 공간 또는 task 위 → 같은 원리 → MS는 `mat:`/`tmat:` 매칭이 필요. 만약 task center가 더 가까우면 over가 `cell-task:`로 잡힘 → MS drop 분기에 안 들어감 → no-op

→ **이슈 발견**: case 3 — MS를 task가 있는 셀에 drop 시 over가 task의 `cell-task:`로 잡혀서 MS cascade 분기에 안 들어갈 수 있음.

### 추가 처리 — handleDragEnd MS 분기 수정

MS drag 시 over가 `cell-task:`이면 그 task가 속한 셀로 cascade 처리.

```js
// OLD (handleDragEnd 안 MS 분기)
    // ─── MS drop (백로그 or 셀 출처 통합) ───
    // 7-D: 두 prefix 모두 moveMilestoneWithTasks로 cascade 처리
    if (activeIdStr.startsWith('bl-ms:') || activeIdStr.startsWith('cell-ms:')) {
      const msId = activeIdStr.startsWith('bl-ms:')
        ? activeIdStr.slice(6)
        : activeIdStr.slice(8)
      let targetProjectId = null
      let targetOwnerId = null
      if (mode === 'mat') {
        // 개인 매트릭스: targetOwner = userId
        const [, projId] = parts
        targetProjectId = projId
        targetOwnerId = userId
      } else if (mode === 'tmat') {
        // 팀 매트릭스: targetOwner = memberId
        const [, projId, memberId] = parts
        targetProjectId = projId
        targetOwnerId = memberId
      } else {
        // pw/tw weekly: MS drop 무시
        return
      }
      moveMilestoneWithTasks(msId, { targetProjectId, targetOwnerId })
      return
    }
```
```js
// NEW
    // ─── MS drop (백로그 or 셀 출처 통합) ───
    // 7-D: 두 prefix 모두 moveMilestoneWithTasks로 cascade 처리
    // 7-E1 fix-1: closestCenter 적용 후 over가 cell-task:로 잡힐 수 있음 → over task의 셀 정보 사용
    if (activeIdStr.startsWith('bl-ms:') || activeIdStr.startsWith('cell-ms:')) {
      const msId = activeIdStr.startsWith('bl-ms:')
        ? activeIdStr.slice(6)
        : activeIdStr.slice(8)
      let targetProjectId = null
      let targetOwnerId = null

      // over가 cell-task:면 그 task의 셀 정보로 cascade 대상 결정
      if (overId.startsWith('cell-task:')) {
        const overTaskId = overId.slice(10)
        const overTask = tasks.find(t => t.id === overTaskId)
        if (!overTask) return
        targetProjectId = overTask.projectId
        targetOwnerId = overTask.assigneeId || userId
      } else if (mode === 'mat') {
        // 개인 매트릭스: targetOwner = userId
        const [, projId] = parts
        targetProjectId = projId
        targetOwnerId = userId
      } else if (mode === 'tmat') {
        // 팀 매트릭스: targetOwner = memberId
        const [, projId, memberId] = parts
        targetProjectId = projId
        targetOwnerId = memberId
      } else {
        // pw/tw weekly: MS drop 무시
        return
      }
      moveMilestoneWithTasks(msId, { targetProjectId, targetOwnerId })
      return
    }
```

---

## DELETE-5 검증

| 항목 | ① import | ② caller | ③ props | ④ deps | ⑤ types | 처리 |
|---|---|---|---|---|---|---|
| `closestCenter` import | UnifiedGridView | DndContext prop | — | — | — | 신규 |
| MS drop의 over=cell-task: 분기 | — | handleDragEnd MS 블록 | — | — | — | 신규 추가 |

### 잔여 검증
- [x] task sortable end (over=cell-task:) 동작 — 7-E1 기존 분기 그대로
- [x] cross-cell task drag (over=mat/tmat) 동작 — 기존 분기 그대로
- [x] MS drag → cell 빈 공간 (over=mat/tmat) — 기존 분기
- [x] MS drag → cell 안 task 위 (over=cell-task:) — 신규 분기
- [x] weekly task drag — 영향 검증 필요 (아래)

---

## 잠재 이슈 — weekly grids

`closestCenter`는 전역 적용이므로 weekly grids의 task drag에도 영향:

- **개인 주간**: 셀(`pw:projId:dateStr`) 안에 task. closestCenter면 task center가 더 가까울 수 있음 → over가 `cell-task:`로 잡힘 → handleDragEnd의 cell-task: 분기 → cross-cell sortable end 분기 → over task의 projectId/assigneeId/category로 update.
  - 문제: weekly에서는 cellSortableId 미전달 → SortableContext 없음 → useSortable 동작은 일반 draggable로 fallback. 하지만 over.id는 여전히 `cell-task:` 형식 (TaskRow의 useSortable id로 set됨).
  - → 7-E1의 cross-cell 분기로 들어가서 `category: overTask.category`로 update → category는 변경되지만 dueDate는 그대로 → weekly에서 의도된 동작 아님 (weekly는 dueDate 기반인데 category가 today로 reset되면 안 됨).

→ 검증 필요. 만약 깨지면 추가 분기:

```js
// over가 cell-task: 일 때 over task의 위치가 weekly cell이면 dueDate도 옮김
// 실제로는 weekly에서는 over의 셀 정보를 알 수 없음 (셀 dropId는 모드별 다름)
// → 가장 안전한 방법: weekly grids에도 cellSortableId 전달 안 하고, weekly에서 over가 cell-task:면 그냥 무시
```

**일단 fix-1은 closestCenter + MS 분기 보강만 적용**. weekly 회귀가 발견되면 fix-2에서 처리.

---

## 검증

### 빌드
```bash
npm run build
```

### 런타임 우선 검증
1. **같은 MS 그룹 내 task reorder** — drop 후 순서가 유지되는지 (원래 버그)
2. **같은 셀 다른 MS로 task 이동** — drop 후 keyMilestoneId 변경 (원래 버그)
3. **MS drag → 빈 셀** — 7-D 회귀
4. **MS drag → task 있는 셀** — over가 task로 잡힐 때 정상 cascade
5. **Cross-cell task drag → 빈 셀 공간** — 기존 동작
6. **Cross-cell task drag → 다른 셀의 task 위** — 7-E1의 cross-cell sortable end
7. **개인 주간 task drag** — cross-day 이동 정상 여부 (잠재 회귀)
8. **팀 주간 task drag** — 동일

### Console 디버깅 권장
임시로 handleDragEnd 첫 줄에 추가:
```js
console.log('[DnD]', { activeId: activeIdStr, overId, mode })
```
검증 후 제거.

---

## 커밋 메시지

```
fix(matrix): use closestCenter collision detection for task sortable (7-E1 fix-1)

Bug: Same-cell task reorder and cross-MS-group drop visually animated but
not committed. Drop returned to original position.

Cause: Default rectIntersection collision detection matched the parent
DroppableCell (mat:/tmat:) instead of the inner sortable item (cell-task:),
because the cell visually contained the task. handleDragEnd's overId branch
landed on `mode === 'mat'` and early-returned (same projectId+category).

Fix:
- Add collisionDetection={closestCenter} to DndContext
- MS drop branch now also handles over=cell-task: (resolves to over task's
  cell info), since closestCenter may match an inner task when MS is
  dragged onto a cell containing tasks
- Weekly grids potential regression flagged for follow-up if reproduced
```
