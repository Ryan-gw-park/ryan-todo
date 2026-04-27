# Sub-Loop 7-E1: Task Sortable (셀 내 순서 + cross-MS-group + cross-cell)

## 목표
요구사항 #5: "Task 간 순서 조정"
요구사항 #6 일부: "마일스톤 하위로 Task 지정" (cross-MS-group drag)

매트릭스 셀 안에서 task를 sortable로 만들어 같은 셀 내 순서 변경. 같은 셀 안에서 다른 MS 그룹의 task 위로 drop 시 keyMilestoneId 자동 변경 (= 다른 MS로 이동). 다른 셀의 task 위로 drop 시 cross-cell 이동.

> MS 헤더 위에 task drop (빈 MS에 task 추가)은 7-E2 범위.
> MS 행 자체의 sortable도 7-E2 범위.

---

## REQ-LOCK 요구사항

1. 매트릭스 셀당 단일 SortableContext (MS 그룹 + ungrouped 통합)
2. TaskRow → `useDraggable` 제거, `useSortable` 적용
3. Task drag id prefix: `cell-task:${task.id}` (사이드바 `bl-task:`와 일관)
4. handleDragEnd 분기:
   - `over.id`가 `cell-task:` prefix → sortable end (over task의 셀 정보로 same/cross 판정)
   - `over.id`가 `mat:`/`tmat:`/`pw:`/`tw:` → 기존 cross-cell 핸들러 (변경 없음)
   - `over.id`가 `bl-ms:`/`cell-ms:` → 7-D MS cascade (변경 없음)
5. Same-cell sortable end:
   - 같은 MS 그룹: reorder만 (`reorderTasks`)
   - 다른 MS 그룹: keyMilestoneId 변경 (`updateTask`) + reorder
6. Cross-cell (over가 다른 셀의 cell-task): over task의 projectId/assigneeId/category 채용 + keyMilestoneId 보존 (R5 차단)
7. done section task는 sortable 제외 (SortableContext 밖)
8. weekly grids 변경 없음
9. MS 행은 7-E1에서 sortable 아님 — `useDraggable` 그대로 (7-E2에서 변경)
10. Vite TDZ 0건

---

## 영향 파일

| # | 파일 | 종류 | 변경 요약 |
|---|---|---|---|
| 1 | `src/components/views/grid/cells/TaskRow.jsx` | EDIT | useDraggable → useSortable, drag id prefix |
| 2 | `src/components/views/grid/cells/CellContent.jsx` | EDIT | SortableContext wrap, allTaskIds 계산, cellSortableId prop 추가 |
| 3 | `src/components/views/grid/grids/PersonalMatrixGrid.jsx` | EDIT | CellContent에 cellSortableId prop 전달 (= dropId 재사용) |
| 4 | `src/components/views/grid/grids/TeamMatrixGrid.jsx` | EDIT | 동일 |
| 5 | `src/components/views/UnifiedGridView.jsx` | EDIT | handleDragEnd cell-task: 분기 추가, activeItem cell-task: 인식, arrayMove import |

> MilestoneRow, weekly grids, useStore — **변경 없음**.

---

## 1. EDIT: `src/components/views/grid/cells/TaskRow.jsx`

### 1-1. import 변경

```jsx
// OLD
import { useState, useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { COLOR, FONT, CHECKBOX } from '../../../../styles/designTokens'
```
```jsx
// NEW
import { useState, useMemo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { COLOR, FONT, CHECKBOX } from '../../../../styles/designTokens'
```

### 1-2. useDraggable → useSortable, drag id prefix, transform 적용

```jsx
// OLD
export default function TaskRow({ task, project, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, showProject, showMs }) {
  const milestones = useStore(s => s.milestones)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  const [hover, setHover] = useState(false)
  const isEditing = editingId === task.id

  // Find MS title for this task
  const msTitle = useMemo(() => {
    if (!showMs || !task.keyMilestoneId) return null
    return milestones.find(m => m.id === task.keyMilestoneId)?.title
  }, [showMs, task.keyMilestoneId, milestones])

  return (
    <div
      ref={setNodeRef}
      {...(isEditing ? {} : { ...attributes, ...listeners })}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 5, padding: '3px 4px', marginBottom: 1,
        borderRadius: 4, cursor: isEditing ? 'text' : 'grab', transition: 'background 0.08s',
        background: hover && !isEditing ? COLOR.bgHover : 'transparent',
        opacity: isDragging ? 0.3 : 1,
      }}
    >
```
```jsx
// NEW
export default function TaskRow({ task, project, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, showProject, showMs }) {
  const milestones = useStore(s => s.milestones)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `cell-task:${task.id}`,
  })
  const [hover, setHover] = useState(false)
  const isEditing = editingId === task.id

  // Find MS title for this task
  const msTitle = useMemo(() => {
    if (!showMs || !task.keyMilestoneId) return null
    return milestones.find(m => m.id === task.keyMilestoneId)?.title
  }, [showMs, task.keyMilestoneId, milestones])

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      {...(isEditing ? {} : { ...attributes, ...listeners })}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...sortableStyle,
        display: 'flex', alignItems: 'flex-start', gap: 5, padding: '3px 4px', marginBottom: 1,
        borderRadius: 4, cursor: isEditing ? 'text' : 'grab', transition: sortableStyle.transition || 'background 0.08s',
        background: hover && !isEditing ? COLOR.bgHover : 'transparent',
        opacity: isDragging ? 0.3 : 1,
      }}
    >
```

> 핵심 변경: `useDraggable({ id: task.id })` → `useSortable({ id: 'cell-task:'+task.id })`. transform/transition 적용. 나머지 input/checkbox/buttons 변경 없음 (그대로 stopPropagation으로 drag/click 충돌 방지).

> 컴포넌트 본문의 input/svg 등은 그대로. 생략.

---

## 2. EDIT: `src/components/views/grid/cells/CellContent.jsx`

### 2-1. import 추가

```jsx
// OLD
import { useMemo } from 'react'
import { COLOR } from '../../../../styles/designTokens'
import useStore from '../../../../hooks/useStore'
import { getMsPath } from '../../../../utils/milestoneTree'
import TaskRow from './TaskRow'
import MilestoneRow from './MilestoneRow'
```
```jsx
// NEW
import { useMemo } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { COLOR } from '../../../../styles/designTokens'
import useStore from '../../../../hooks/useStore'
import { getMsPath } from '../../../../utils/milestoneTree'
import TaskRow from './TaskRow'
import MilestoneRow from './MilestoneRow'
```

### 2-2. 함수 시그니처에 cellSortableId prop 추가

```jsx
// OLD
export default function CellContent({
  tasks: cellTasks, cellMilestones,
  editingId, setEditingId, handleEditFinish,
  toggleDone, openDetail, showProject, project, projectMap,
  // ─── MS interactivity props (matrix only) ───
  matrixMsInteractive = false,
  editingMsId,
  onStartMsEdit,
  handleMsEditFinish,
  cancelMsEdit,
  matrixMsCollapsed,
  toggleMatrixMsCollapse,
  handleMsDelete,
  onMsAddTask,
  // ─── Done section props (matrix only) ───
  doneCollapsed = true,
  onToggleDoneCollapse,
}) {
```
```jsx
// NEW
export default function CellContent({
  tasks: cellTasks, cellMilestones,
  editingId, setEditingId, handleEditFinish,
  toggleDone, openDetail, showProject, project, projectMap,
  // ─── MS interactivity props (matrix only) ───
  matrixMsInteractive = false,
  editingMsId,
  onStartMsEdit,
  handleMsEditFinish,
  cancelMsEdit,
  matrixMsCollapsed,
  toggleMatrixMsCollapse,
  handleMsDelete,
  onMsAddTask,
  // ─── Done section props (matrix only) ───
  doneCollapsed = true,
  onToggleDoneCollapse,
  // ─── Sortable props (matrix only, 7-E1) ───
  cellSortableId,
}) {
```

### 2-3. allTaskIds useMemo 추가 (groups useMemo 직후)

```jsx
// 기존 groups useMemo 다음에 추가
  // 7-E1: 셀 내 모든 active task id 수집 (MS 그룹 + ungrouped, done 제외)
  const allTaskIds = useMemo(() => {
    const ids = []
    groups.msGroups.forEach(g => g.tasks.forEach(t => ids.push(`cell-task:${t.id}`)))
    groups.ungrouped.forEach(t => ids.push(`cell-task:${t.id}`))
    return ids
  }, [groups])
```

### 2-4. early return 분기와 main return을 SortableContext로 wrap

`cellSortableId`가 있을 때만 SortableContext 활성화. 없으면 (weekly) 그대로.

#### early return 분기 변경

```jsx
// OLD
  if (groups.msGroups.length === 0) {
    return (
      <>
        {groups.ungrouped.map(t => (
          <TaskRow key={t.id} task={t} project={getProj(t)} {...taskRowProps} />
        ))}
        <DoneSection
          doneTasks={groups.done}
          collapsed={doneCollapsed}
          onToggle={onToggleDoneCollapse}
          getProj={getProj}
          taskRowProps={taskRowProps}
        />
      </>
    )
  }
```
```jsx
// NEW
  if (groups.msGroups.length === 0) {
    const ungroupedRows = groups.ungrouped.map(t => (
      <TaskRow key={t.id} task={t} project={getProj(t)} {...taskRowProps} />
    ))
    return (
      <>
        {cellSortableId ? (
          <SortableContext items={allTaskIds} id={cellSortableId} strategy={verticalListSortingStrategy}>
            {ungroupedRows}
          </SortableContext>
        ) : (
          ungroupedRows
        )}
        <DoneSection
          doneTasks={groups.done}
          collapsed={doneCollapsed}
          onToggle={onToggleDoneCollapse}
          getProj={getProj}
          taskRowProps={taskRowProps}
        />
      </>
    )
  }
```

#### main return 변경 — msGroups + ungrouped를 SortableContext 안에 wrap

```jsx
// OLD
  return (
    <>
      {groups.msGroups.map(g => {
        const msCollapsed = matrixMsCollapsed ? !!matrixMsCollapsed[g.msId] : false
        const breadcrumb = matrixMsInteractive ? getMsPath(g.msId, allMilestones) : null
        return (
          <div key={g.msId} style={{ marginBottom: 4 }}>
            <MilestoneRow ... />
            {!msCollapsed && g.tasks.map(t => (
              <TaskRow key={t.id} task={t} project={getProj(t)} ... />
            ))}
          </div>
        )
      })}
      {groups.ungrouped.length > 0 && (
        <div style={{ marginTop: groups.msGroups.length > 0 ? 2 : 0 }}>
          {groups.msGroups.length > 0 && (
            <div style={{ height: '0.5px', background: COLOR.border, margin: '3px 0' }} />
          )}
          {groups.ungrouped.map(t => (
            <TaskRow key={t.id} task={t} project={getProj(t)} ... />
          ))}
        </div>
      )}
      <DoneSection ... />
    </>
  )
}
```
```jsx
// NEW
  const groupedContent = (
    <>
      {groups.msGroups.map(g => {
        const msCollapsed = matrixMsCollapsed ? !!matrixMsCollapsed[g.msId] : false
        const breadcrumb = matrixMsInteractive ? getMsPath(g.msId, allMilestones) : null
        return (
          <div key={g.msId} style={{ marginBottom: 4 }}>
            <MilestoneRow
              ms={g.ms}
              taskCount={g.tasks.length}
              collapsed={msCollapsed}
              onToggleCollapse={toggleMatrixMsCollapse ? () => toggleMatrixMsCollapse(g.msId) : null}
              isEditing={matrixMsInteractive && editingMsId === g.msId}
              onStartEdit={matrixMsInteractive ? () => onStartMsEdit && onStartMsEdit(g.msId) : null}
              onFinishEdit={matrixMsInteractive ? (value) => handleMsEditFinish && handleMsEditFinish(g.msId, value) : null}
              onCancelEdit={matrixMsInteractive ? () => cancelMsEdit && cancelMsEdit() : null}
              onAddTask={matrixMsInteractive && onMsAddTask ? () => onMsAddTask(g.msId) : null}
              onDelete={matrixMsInteractive && handleMsDelete ? () => handleMsDelete(g.msId, g.ms.title) : null}
              onOpenDetail={() => openModal({ type: 'milestoneDetail', milestoneId: g.msId, returnTo: null })}
              breadcrumb={breadcrumb}
              interactive={matrixMsInteractive}
            />
            {!msCollapsed && g.tasks.map(t => (
              <TaskRow key={t.id} task={t} project={getProj(t)} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject={showProject} />
            ))}
          </div>
        )
      })}
      {groups.ungrouped.length > 0 && (
        <div style={{ marginTop: groups.msGroups.length > 0 ? 2 : 0 }}>
          {groups.msGroups.length > 0 && (
            <div style={{ height: '0.5px', background: COLOR.border, margin: '3px 0' }} />
          )}
          {groups.ungrouped.map(t => (
            <TaskRow key={t.id} task={t} project={getProj(t)} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject={showProject} />
          ))}
        </div>
      )}
    </>
  )

  return (
    <>
      {cellSortableId ? (
        <SortableContext items={allTaskIds} id={cellSortableId} strategy={verticalListSortingStrategy}>
          {groupedContent}
        </SortableContext>
      ) : (
        groupedContent
      )}
      <DoneSection
        doneTasks={groups.done}
        collapsed={doneCollapsed}
        onToggle={onToggleDoneCollapse}
        getProj={getProj}
        taskRowProps={{ editingId, setEditingId, handleEditFinish, toggleDone, openDetail, showProject }}
      />
    </>
  )
}
```

> 핵심 변경: 기존 main return의 JSX를 `groupedContent` 변수로 추출 → `cellSortableId` 있을 때만 SortableContext로 감쌈. DoneSection은 SortableContext 밖. weekly grids는 cellSortableId 안 넘기므로 그대로 동작.

---

## 3. EDIT: `src/components/views/grid/grids/PersonalMatrixGrid.jsx`

CellContent 호출에 `cellSortableId={dropId}` 추가:

```jsx
// OLD (CellContent 호출 부분)
                        <CellContent
                          tasks={cellTasks}
                          cellMilestones={cellMs}
                          editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                          toggleDone={toggleDone} openDetail={openDetail}
                          matrixMsInteractive
                          editingMsId={editingMsId}
                          onStartMsEdit={onStartMsEdit}
                          handleMsEditFinish={handleMsEditFinish}
                          cancelMsEdit={cancelMsEdit}
                          matrixMsCollapsed={matrixMsCollapsed}
                          toggleMatrixMsCollapse={toggleMatrixMsCollapse}
                          handleMsDelete={handleMsDelete}
                          onMsAddTask={handleCellMsAddTask}
                          doneCollapsed={projDoneCollapsed}
                          onToggleDoneCollapse={onToggleProjDone}
                        />
```
```jsx
// NEW
                        <CellContent
                          tasks={cellTasks}
                          cellMilestones={cellMs}
                          editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                          toggleDone={toggleDone} openDetail={openDetail}
                          matrixMsInteractive
                          editingMsId={editingMsId}
                          onStartMsEdit={onStartMsEdit}
                          handleMsEditFinish={handleMsEditFinish}
                          cancelMsEdit={cancelMsEdit}
                          matrixMsCollapsed={matrixMsCollapsed}
                          toggleMatrixMsCollapse={toggleMatrixMsCollapse}
                          handleMsDelete={handleMsDelete}
                          onMsAddTask={handleCellMsAddTask}
                          doneCollapsed={projDoneCollapsed}
                          onToggleDoneCollapse={onToggleProjDone}
                          cellSortableId={dropId}
                        />
```

> 변경 1줄: `cellSortableId={dropId}` 추가. dropId는 이미 `mat:${proj.id}:${cat.key}` 형식.

---

## 4. EDIT: `src/components/views/grid/grids/TeamMatrixGrid.jsx`

동일하게 `cellSortableId={dropId}` 추가:

```jsx
// OLD
                        <CellContent
                          tasks={cellTasks}
                          cellMilestones={cellMs}
                          ...
                          doneCollapsed={projDoneCollapsed}
                          onToggleDoneCollapse={onToggleProjDone}
                        />
```
```jsx
// NEW
                        <CellContent
                          tasks={cellTasks}
                          cellMilestones={cellMs}
                          ...
                          doneCollapsed={projDoneCollapsed}
                          onToggleDoneCollapse={onToggleProjDone}
                          cellSortableId={dropId}
                        />
```

> dropId는 `tmat:${proj.id}:${mem.userId}` 형식.

---

## 5. EDIT: `src/components/views/UnifiedGridView.jsx`

### 5-1. import에 arrayMove 추가

```js
// OLD
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
```
```js
// NEW
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
```

### 5-2. activeItem에 cell-task: prefix 인식 추가

```js
// OLD
  const activeItem = useMemo(() => {
    if (!activeId) return null
    const id = String(activeId)
    if (id.startsWith('bl-ms:')) {
      const ms = milestones.find(m => m.id === id.slice(6))
      return ms ? { type: 'ms', data: ms } : null
    }
    if (id.startsWith('cell-ms:')) {
      const ms = milestones.find(m => m.id === id.slice(8))
      return ms ? { type: 'ms', data: ms } : null
    }
    const taskId = id.startsWith('bl-task:') ? id.slice(8) : id
    const task = tasks.find(t => t.id === taskId)
    return task ? { type: 'task', data: task } : null
  }, [activeId, tasks, milestones])
```
```js
// NEW
  const activeItem = useMemo(() => {
    if (!activeId) return null
    const id = String(activeId)
    if (id.startsWith('bl-ms:')) {
      const ms = milestones.find(m => m.id === id.slice(6))
      return ms ? { type: 'ms', data: ms } : null
    }
    if (id.startsWith('cell-ms:')) {
      const ms = milestones.find(m => m.id === id.slice(8))
      return ms ? { type: 'ms', data: ms } : null
    }
    // 7-E1: cell-task: prefix 인식
    const taskId = id.startsWith('bl-task:') ? id.slice(8)
      : id.startsWith('cell-task:') ? id.slice(10)
      : id
    const task = tasks.find(t => t.id === taskId)
    return task ? { type: 'task', data: task } : null
  }, [activeId, tasks, milestones])
```

### 5-3. handleDragEnd 분기 확장

기존 task drop 분기 앞에 cell-task: sortable end 처리 추가, 그리고 task id 추출 로직 변경:

```js
// OLD (전체 task drop 부분)
    // ─── Task drop (그리드 내부 or 백로그) ───
    const taskId = activeIdStr.startsWith('bl-task:') ? activeIdStr.slice(8) : activeIdStr
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    if (mode === 'mat') {
      // Personal matrix: project + category
      const [, targetProjId, targetCat] = parts
      if (task.projectId === targetProjId && task.category === targetCat) return
      moveTaskTo(taskId, targetProjId, targetCat)
    } else if (mode === 'tmat') {
      // Team matrix: project + assignee
      const [, targetProjId, targetMemberId] = parts
      if (task.projectId === targetProjId && task.assigneeId === targetMemberId) return
      updateTask(taskId, { projectId: targetProjId, assigneeId: targetMemberId, scope: 'assigned' })
    } else if (mode === 'pw') {
      // Personal weekly: project + date
      const [, , targetDate] = parts
      if (task.dueDate === targetDate) return
      updateTask(taskId, { dueDate: targetDate })
    } else if (mode === 'tw') {
      // Team weekly: member + date
      const [, targetMemberId, targetDate] = parts
      if (task.assigneeId === targetMemberId && task.dueDate === targetDate) return
      updateTask(taskId, { assigneeId: targetMemberId, dueDate: targetDate, scope: 'assigned' })
    }
  }, [tasks, moveTaskTo, updateTask, moveMilestoneWithTasks, userId])
```
```js
// NEW
    // ─── Task drop (cell-task / bl-task / raw) ───
    // 7-E1: cell-task: prefix 추가
    const taskId = activeIdStr.startsWith('bl-task:') ? activeIdStr.slice(8)
      : activeIdStr.startsWith('cell-task:') ? activeIdStr.slice(10)
      : activeIdStr
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    // 7-E1: over가 cell-task: 면 sortable end (다른 task 위에 drop)
    if (overId.startsWith('cell-task:')) {
      const overTaskId = overId.slice(10)
      if (overTaskId === task.id) return
      const overTask = tasks.find(t => t.id === overTaskId)
      if (!overTask) return

      // 같은 셀 판정 — projectId + assigneeId + category 모두 일치
      const sameCell = (
        task.projectId === overTask.projectId &&
        task.assigneeId === overTask.assigneeId &&
        task.category === overTask.category
      )

      if (sameCell) {
        // 같은 셀 sortable end → reorder (필요시 keyMilestoneId 변경)
        const cellTasks = tasks.filter(t =>
          t.projectId === task.projectId &&
          t.assigneeId === task.assigneeId &&
          t.category === task.category &&
          !t.done
        ).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

        const oldIndex = cellTasks.findIndex(t => t.id === task.id)
        const newIndex = cellTasks.findIndex(t => t.id === overTaskId)
        if (oldIndex === -1 || newIndex === -1) return

        // cross-MS-group within same cell — keyMilestoneId 변경 후 reorder
        if (task.keyMilestoneId !== overTask.keyMilestoneId) {
          updateTask(task.id, {
            keyMilestoneId: overTask.keyMilestoneId,
            // 다른 필드는 건드리지 않음 — projectId 그대로 → R5 트리거 안 됨
          })
        }
        const reordered = arrayMove(cellTasks, oldIndex, newIndex)
        reorderTasks(reordered)
      } else {
        // 다른 셀 — over task의 위치로 cross-cell move
        // R5 차단을 위해 keyMilestoneId 명시 보존
        updateTask(task.id, {
          projectId: overTask.projectId,
          assigneeId: overTask.assigneeId,
          category: overTask.category,
          keyMilestoneId: task.keyMilestoneId,
        })
      }
      return
    }

    // ─── over가 droppable cell (mat/tmat/pw/tw) ───
    if (mode === 'mat') {
      // Personal matrix: project + category
      const [, targetProjId, targetCat] = parts
      if (task.projectId === targetProjId && task.category === targetCat) return
      moveTaskTo(taskId, targetProjId, targetCat)
    } else if (mode === 'tmat') {
      // Team matrix: project + assignee
      const [, targetProjId, targetMemberId] = parts
      if (task.projectId === targetProjId && task.assigneeId === targetMemberId) return
      updateTask(taskId, { projectId: targetProjId, assigneeId: targetMemberId, scope: 'assigned' })
    } else if (mode === 'pw') {
      // Personal weekly: project + date
      const [, , targetDate] = parts
      if (task.dueDate === targetDate) return
      updateTask(taskId, { dueDate: targetDate })
    } else if (mode === 'tw') {
      // Team weekly: member + date
      const [, targetMemberId, targetDate] = parts
      if (task.assigneeId === targetMemberId && task.dueDate === targetDate) return
      updateTask(taskId, { assigneeId: targetMemberId, dueDate: targetDate, scope: 'assigned' })
    }
  }, [tasks, moveTaskTo, updateTask, moveMilestoneWithTasks, userId, reorderTasks])
```

### 5-4. store destructure에 reorderTasks 보존 확인

기존 destructure:
```js
const { projects, tasks, updateTask, moveTaskTo, reorderTasks, toggleDone, ... } = useStore()
```

`reorderTasks`는 이미 destructure되어 있음. **변경 없음**. (use 안 했다고 destructure에서 빠졌을 가능성 — 7-D doc상 보존했지만 실제 적용 시 제거되었을 수 있음. 빌드 검증 필수.)

> **확인 필요**: `reorderTasks`가 현재 destructure에 살아있는지. 빠져있다면 추가.

---

## DELETE-5 검증

| 항목 | ① import | ② caller | ③ props | ④ deps | ⑤ types | 처리 |
|---|---|---|---|---|---|---|
| TaskRow `useDraggable` import | TaskRow §1-1 | TaskRow 본문 1곳 | — | — | — | `useSortable`로 교체 |
| TaskRow drag id `task.id` (raw) | — | useDraggable 호출 | — | — | — | `cell-task:${task.id}`로 교체 |
| CellContent `cellSortableId` prop 신규 | — | PersonalMatrixGrid, TeamMatrixGrid | — | SortableContext 활성 조건 | — | 신규 추가 |
| handleDragEnd `taskId` 추출 로직 | — | UnifiedGridView §5-3 | — | — | — | cell-task: 분기 추가 |
| `arrayMove` import 신규 | UnifiedGridView §5-1 | handleDragEnd | — | — | — | 신규 추가 |
| handleDragEnd useCallback deps | — | — | — | reorderTasks 추가 | — | deps에 reorderTasks 추가 |

### 잔여 import 검증
- [x] TaskRow: `useDraggable` 제거, `useSortable` + `CSS` 추가 — 모두 사용
- [x] CellContent: `SortableContext`, `verticalListSortingStrategy` 추가 — 사용
- [x] UnifiedGridView: `arrayMove` 추가 — handleDragEnd에서 사용
- [x] PersonalMatrixGrid, TeamMatrixGrid: 신규 import 0건

### 동작 동등성 (변경 없는 부분)
- [x] Weekly grids — `cellSortableId` 미전달 → SortableContext 비활성 → 그대로 동작
- [x] MilestoneRow — 변경 없음 (7-E2)
- [x] Cross-cell drop (`mat:`/`tmat:`) — 기존 분기 그대로
- [x] MS DnD (`bl-ms:`/`cell-ms:`) — 7-D 그대로
- [x] InlineAdd, InlineMsAdd, DoneSection — 변경 없음
- [x] Task 인라인 편집/체크/상세 — TaskRow 본문 그대로

---

## REQ-LOCK 검증

| # | 요구사항 | 적용 위치 | 확인 |
|---|---|---|---|
| 1 | 셀당 단일 SortableContext | CellContent §2-4 | ✓ |
| 2 | useSortable 적용 | TaskRow §1-2 | ✓ |
| 3 | drag id `cell-task:` | TaskRow §1-2 | ✓ |
| 4 | over 분기 (cell-task: → sortable, mat/tmat → cross-cell, MS → 7-D) | UnifiedGridView §5-3 | ✓ |
| 5 | same-cell reorder + cross-MS-group keyMilestoneId 변경 | UnifiedGridView §5-3 sameCell 분기 | ✓ |
| 6 | cross-cell 시 keyMilestoneId 보존 (R5 차단) | UnifiedGridView §5-3 else 분기 | ✓ |
| 7 | done section sortable 제외 | CellContent §2-4 SortableContext 밖 | ✓ |
| 8 | weekly 변경 없음 | cellSortableId 미전달 시 SortableContext 비활성 | ✓ |
| 9 | MilestoneRow 변경 없음 | 미수정 (7-E2) | ✓ |
| 10 | Vite TDZ 0건 | 모든 token inline | ✓ |

---

## 빌드 검증 명령

```bash
# 1. 빌드
npm run build

# 2. useSortable 사용 확인
grep -n "useSortable" src/components/views/grid/cells/TaskRow.jsx
# 예상: import 1건 + 호출 1건

# 3. SortableContext 사용 확인
grep -n "SortableContext" src/components/views/grid/cells/CellContent.jsx
# 예상: import 1건 + 사용 2건 (early return + main return)

# 4. cell-task: prefix 사용
grep -rn "cell-task:" src/components/views/
# 예상: TaskRow useSortable id, CellContent allTaskIds 매핑, UnifiedGridView 분기 처리

# 5. arrayMove import
grep -n "arrayMove" src/components/views/UnifiedGridView.jsx
# 예상: import 1건 + 사용 1건

# 6. cellSortableId prop drilling
grep -n "cellSortableId" src/components/views/grid/grids/PersonalMatrixGrid.jsx src/components/views/grid/grids/TeamMatrixGrid.jsx src/components/views/grid/cells/CellContent.jsx
# 예상: 두 grid에서 prop 전달 + CellContent에서 prop 받기

# 7. reorderTasks가 useStore destructure에 살아있는지 (안전망)
grep -n "reorderTasks" src/components/views/UnifiedGridView.jsx
# 예상: destructure 1건 + handleDragEnd 사용 1건 + deps 1건
```

## 런타임 검증 체크리스트

### 같은 MS 그룹 안 task 순서 변경
- [ ] 같은 MS 안 task 1개를 그룹 내 다른 task 위/아래로 drag
- [ ] visual reorder 정상
- [ ] drop 후 순서 유지 (새로고침 후에도)
- [ ] DB sortOrder 업데이트 (Supabase 직접 확인)
- [ ] keyMilestoneId 변화 없음

### Cross-MS-group 같은 셀 내
- [ ] 같은 셀의 다른 MS 그룹 task 위로 drag
- [ ] 자동으로 그 MS 그룹으로 합류
- [ ] keyMilestoneId가 새 MS의 id로 변경 (Supabase 직접 확인)
- [ ] sortOrder도 같이 reorder
- [ ] 새로고침 후에도 정확

### Ungrouped → MS group (같은 셀)
- [ ] MS 미연결 task를 같은 셀의 MS 그룹 안 task 위로 drag
- [ ] keyMilestoneId가 그 MS로 set됨
- [ ] task가 MS 그룹 안에 표시됨

### MS group → ungrouped (같은 셀)
- [ ] MS 안 task를 같은 셀의 ungrouped task 위로 drag
- [ ] **현재 7-E1에서는 이 동작이 의도대로 안 될 수 있음** — over가 ungrouped task면 그 task도 keyMilestoneId가 null이라 sortable end 시 active의 keyMilestoneId가 null로 set됨 ✓ (정상)

### Cross-cell (다른 매트릭스 셀)
- [ ] 다른 셀의 task 위로 drag → over task의 셀 정보로 cross-cell move
- [ ] 7-D 동작 그대로 유지 — keyMilestoneId 보존
- [ ] target 셀로 정상 이동

### Cross-cell (셀 빈 공간)
- [ ] task를 다른 셀의 빈 공간(droppable)에 drop → 기존 mat/tmat 분기로 처리
- [ ] 7-D 동작 그대로

### MS DnD 회귀 (7-D)
- [ ] MS 헤더 drag → 다른 셀로 drop → cascade 정상
- [ ] MS 안 task가 빈 MS로 드래그 — MS 행 드롭은 7-E2 범위, 7-E1에서 noop 가능

### 인라인 편집/체크 회귀 (7-A)
- [ ] task 텍스트 클릭 → input 활성, drag 동작 안 됨
- [ ] checkbox 클릭 → drag 시작 안 됨, done toggle 정상
- [ ] task hover 시 detail arrow → 정상

### Done section 회귀 (7-B)
- [ ] done task는 sortable 영역 밖
- [ ] done section 펼침/접힘 정상
- [ ] task 체크 → done section으로 이동, 다시 체크 해제 → active 영역 복귀

### Weekly grids 회귀
- [ ] 개인/팀 주간 — task drag/체크/편집 모두 정상
- [ ] cellSortableId 미전달 → SortableContext 비활성 → 기존 useDraggable과 동일하게 동작

---

## 잠재 이슈 — 디버깅 포인트

### 1. useSortable이 useDraggable을 대체할 때 cross-context drag
`useSortable`은 SortableContext 안에서만 활성. weekly에서 cellSortableId 미전달 시 SortableContext 없음 → useSortable의 sortable 데이터 없음 → 일반 draggable처럼 동작 (sortable 기능 비활성, drag만 가능). dnd-kit이 이 케이스를 graceful하게 처리하는지 확인 필요.

만약 weekly에서 task drag가 깨지면, 대안:
- TaskRow에 `inSortableContext` prop 추가해서 useSortable vs useDraggable 분기
- 또는 weekly에도 SortableContext 적용 (cellSortableId만 전달, 동작은 sortable)

### 2. 같은 셀 안 cross-MS-group 시 ordering 불일치
sortable end의 newIndex는 시각적 위치 기준. 그런데 keyMilestoneId가 변경되면 다음 렌더 시 그룹이 재구성되어 task가 다른 위치로 갈 수 있음. 일관성 검증 필요.

### 3. arrayMove 결과의 sortOrder
`reorderTasks(reordered)`는 array의 인덱스를 sortOrder로 set. 같은 셀의 모든 task에 대해 0부터 다시 매김 → 다른 셀의 task와 sortOrder 충돌 가능성? 하지만 셀별로 filter해서 표시하므로 충돌 없음.

---

## 커밋 메시지

```
feat(matrix): task sortable in cells (Sub-Loop 7-E1)

- TaskRow: useDraggable → useSortable, drag id 'cell-task:${task.id}'
- CellContent: SortableContext wraps msGroups + ungrouped (single context per cell)
  * Done section stays outside sortable
  * cellSortableId prop activates context (weekly grids skip, stay non-sortable)
- PersonalMatrixGrid, TeamMatrixGrid: pass cellSortableId={dropId} to CellContent
- UnifiedGridView handleDragEnd:
  * cell-task: prefix recognized in activeItem and taskId extraction
  * Over cell-task: → sortable end branch
    - Same cell (projectId+assigneeId+category match): reorderTasks
    - Cross-MS-group within same cell: updateTask(keyMilestoneId) + reorderTasks
    - Different cell: cross-cell updateTask with R5-blocking keyMilestoneId
  * Other modes (mat/tmat/pw/tw, bl-ms/cell-ms) unchanged
- arrayMove imported from @dnd-kit/sortable
- MilestoneRow, weekly grids unchanged (MS sortable + MS-as-droppable in 7-E2)
```
