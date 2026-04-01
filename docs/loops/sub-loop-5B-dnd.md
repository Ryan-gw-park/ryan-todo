# Sub-Loop 5-B: MsTaskTreeMode에 DnD 추가

아래 str_replace 명령을 순서대로 실행하라. 코드를 자의적으로 해석하거나 추가 수정하지 마라.

---

## 파일: src/components/project/MsTaskTreeMode.jsx

### 수정 1: import에 dnd-kit 추가

old_str:
```
import { useState, useCallback, useRef, useMemo } from 'react'
import { COLOR, FONT, CHECKBOX } from '../../styles/designTokens'
import useStore from '../../hooks/useStore'
import { getColor } from '../../utils/colors'
import { countTasksRecursive } from '../../utils/milestoneTree'
```

new_str:
```
import { useState, useCallback, useRef, useMemo } from 'react'
import { DndContext, DragOverlay, useDroppable, useDraggable, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { COLOR, FONT, CHECKBOX } from '../../styles/designTokens'
import useStore from '../../hooks/useStore'
import { getColor } from '../../utils/colors'
import { countTasksRecursive } from '../../utils/milestoneTree'
```

### 수정 2: store에서 reorderTasks 추가

old_str:
```
  const addTask = useStore(s => s.addTask)
  const updateTask = useStore(s => s.updateTask)
```

new_str:
```
  const addTask = useStore(s => s.addTask)
  const updateTask = useStore(s => s.updateTask)
  const reorderTasks = useStore(s => s.reorderTasks)
```

### 수정 3: DnD state + sensors + handlers 추가 (collapseAll 뒤에)

old_str:
```
  const expandAll = useCallback(() => { setCollapsed(new Set()) }, [])

  // ─── MS CRUD ───
```

new_str:
```
  const expandAll = useCallback(() => { setCollapsed(new Set()) }, [])

  // ─── DnD ───
  const [activeId, setActiveId] = useState(null)
  const [activeType, setActiveType] = useState(null) // 'task' | 'ms'
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)

  const activeTask = activeId && activeType === 'task' ? projectTasks.find(t => t.id === activeId) : null

  const handleDragStart = useCallback((event) => {
    const { active } = event
    const data = active.data?.current
    if (data?.type === 'task') {
      setActiveId(active.id)
      setActiveType('task')
    } else if (data?.type === 'ms') {
      setActiveId(active.id)
      setActiveType('ms')
    }
  }, [])

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    setActiveId(null)
    setActiveType(null)
    if (!over || !active) return

    const activeData = active.data?.current
    const overData = over.data?.current

    // ── Task dropped on MS drop zone → move to that MS ──
    if (activeData?.type === 'task' && overData?.type === 'ms-drop') {
      const taskId = active.id
      const targetMsId = overData.msId
      const task = projectTasks.find(t => t.id === taskId)
      if (!task) return
      if (task.keyMilestoneId === targetMsId) return
      updateTask(taskId, { keyMilestoneId: targetMsId })
      return
    }

    // ── Task dropped on another task → reorder within same MS or move to target's MS ──
    if (activeData?.type === 'task' && overData?.type === 'task') {
      const dragTask = projectTasks.find(t => t.id === active.id)
      const overTask = projectTasks.find(t => t.id === over.id)
      if (!dragTask || !overTask) return

      if (dragTask.keyMilestoneId === overTask.keyMilestoneId) {
        // Same MS: reorder
        const msTasks = projectTasks
          .filter(t => t.keyMilestoneId === dragTask.keyMilestoneId && !t.done && !t.deletedAt)
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        const oldIdx = msTasks.findIndex(t => t.id === active.id)
        const newIdx = msTasks.findIndex(t => t.id === over.id)
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = [...msTasks]
          const [moved] = reordered.splice(oldIdx, 1)
          reordered.splice(newIdx, 0, moved)
          reorderTasks(reordered)
        }
      } else {
        // Different MS: move to target's MS
        updateTask(active.id, { keyMilestoneId: overTask.keyMilestoneId })
      }
      return
    }

    // ── Task dropped on backlog → remove MS link ──
    if (activeData?.type === 'task' && overData?.type === 'backlog-drop') {
      updateTask(active.id, { keyMilestoneId: null })
      return
    }
  }, [projectTasks, updateTask, reorderTasks])

  // ─── MS CRUD ───
```

### 수정 4: return문에 DndContext 래핑 추가

old_str:
```
  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ minWidth: maxDepth * COL_W + TASK_MIN_W, padding: '0 24px' }}>

        {/* ─── Toolbar: 모두 접기/펼치기 ─── */}
```

new_str:
```
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ minWidth: maxDepth * COL_W + TASK_MIN_W, padding: '0 24px' }}>

        {/* ─── Toolbar: 모두 접기/펼치기 ─── */}
```

### 수정 5: 컴포넌트 끝에 DndContext 닫기 + DragOverlay 추가

old_str:
```
        {/* Backlog */}
        {backlogTasks.length > 0 && (
          <BacklogSection tasks={backlogTasks} onToggle={toggleDone} onOpen={t => openDetail(t)} />
        )}
      </div>
    </div>
  )
}
```

new_str:
```
        {/* Backlog */}
        {backlogTasks.length > 0 && (
          <BacklogSection tasks={backlogTasks} onToggle={toggleDone} onOpen={t => openDetail(t)} />
        )}
      </div>
    </div>

    {/* Drag overlay */}
    <DragOverlay dropAnimation={null}>
      {activeTask ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', background: '#fff', borderRadius: 6,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', border: '1px solid #e0e0e0',
          transform: 'rotate(2deg)', cursor: 'grabbing', maxWidth: 300,
        }}>
          <div style={{ width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, border: `1.5px solid ${CHECKBOX.borderColor}`, flexShrink: 0 }} />
          <span style={{ fontSize: FONT.body, color: COLOR.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTask.text}</span>
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
  )
}
```

### 수정 6: Leaf MS 행에 useDroppable 추가 — 할일을 받을 수 있는 드롭 영역

리프 MS 행(`type === 'leaf'`) 렌더링에서, 외부 div에 droppable을 적용한다.

old_str:
```
          // ═══ Leaf MS (first row: MS title + first task) ═══
          if (row.type === 'leaf') {
            const isHover = hoverMsId === row.node.id
            const isEditing = editingMsId === row.node.id
            return (
              <div key={`l-${row.node.id}`}
                onMouseEnter={() => setHoverMsId(row.node.id)}
                onMouseLeave={() => setHoverMsId(null)}
                style={{ display: 'flex', borderBottom: `0.5px solid ${S.border}`, minHeight: 32 }}
              >
```

new_str:
```
          // ═══ Leaf MS (first row: MS title + first task) ═══
          if (row.type === 'leaf') {
            const isHover = hoverMsId === row.node.id
            const isEditing = editingMsId === row.node.id
            return (
              <MsDropZone key={`l-${row.node.id}`} msId={row.node.id} activeId={activeId}>
              <div
                onMouseEnter={() => setHoverMsId(row.node.id)}
                onMouseLeave={() => setHoverMsId(null)}
                style={{ display: 'flex', borderBottom: `0.5px solid ${S.border}`, minHeight: 32 }}
              >
```

### 수정 7: Leaf MS 행 닫는 태그에 MsDropZone 닫기

leaf 행의 닫는 `</div>` 뒤에 `</MsDropZone>`을 추가해야 한다. leaf 블록의 끝을 찾는다:

old_str:
```
                <TaskCell task={row.task} editingTaskId={editingTaskId} onStartEdit={setEditingTaskId} onFinishEdit={handleTaskEditFinish} onToggle={toggleDone} onDetail={openDetail} minW={TASK_MIN_W} />
              </div>
            )
          }

          // ═══ Additional task row ═══
```

new_str:
```
                <TaskCell task={row.task} editingTaskId={editingTaskId} onStartEdit={setEditingTaskId} onFinishEdit={handleTaskEditFinish} onToggle={toggleDone} onDetail={openDetail} minW={TASK_MIN_W} activeId={activeId} />
              </div>
              </MsDropZone>
            )
          }

          // ═══ Additional task row ═══
```

### 수정 8: Additional task row에도 TaskCell에 activeId 전달

old_str:
```
                <TaskCell task={row.task} editingTaskId={editingTaskId} onStartEdit={setEditingTaskId} onFinishEdit={handleTaskEditFinish} onToggle={toggleDone} onDetail={openDetail} minW={TASK_MIN_W} />
              </div>
            )
          }

          // ═══ Done summary ═══
```

new_str:
```
                <TaskCell task={row.task} editingTaskId={editingTaskId} onStartEdit={setEditingTaskId} onFinishEdit={handleTaskEditFinish} onToggle={toggleDone} onDetail={openDetail} minW={TASK_MIN_W} activeId={activeId} />
              </div>
            )
          }

          // ═══ Done summary ═══
```

### 수정 9: TaskCell에 useDraggable 추가 — 제목 외 영역이 드래그 핸들

old_str:
```
/* ═══ Task Cell ═══ */
function TaskCell({ task, editingTaskId, onStartEdit, onFinishEdit, onToggle, onDetail, minW }) {
  const [hover, setHover] = useState(false)
  if (!task) return <div style={{ flex: 1, minWidth: minW }} />

  const isEditing = editingTaskId === task.id

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 12px', minWidth: minW,
        background: hover ? '#fafaf8' : 'transparent', transition: 'background 0.1s',
      }}
    >
      {/* Drag handle (visual only for now — DnD in Sub-Loop 5-B) */}
      <div style={{ width: 12, opacity: hover ? 0.35 : 0, transition: 'opacity 0.15s', cursor: 'grab', flexShrink: 0 }}>
        <svg width="8" height="12" viewBox="0 0 8 12" fill="#999">
          <circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
          <circle cx="2" cy="6" r="1.2" /><circle cx="6" cy="6" r="1.2" />
          <circle cx="2" cy="10" r="1.2" /><circle cx="6" cy="10" r="1.2" />
        </svg>
      </div>

      {/* Checkbox */}
      <div onClick={e => { e.stopPropagation(); onToggle(task.id) }} style={{
```

new_str:
```
/* ═══ MsDropZone — droppable area for each leaf MS ═══ */
function MsDropZone({ msId, activeId, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `ms-drop:${msId}`,
    data: { type: 'ms-drop', msId },
  })
  return (
    <div ref={setNodeRef} style={{
      transition: 'background 0.1s',
      ...(isOver && activeId ? { background: 'rgba(49,130,206,0.06)', borderRadius: 4 } : {}),
    }}>
      {children}
    </div>
  )
}

/* ═══ Task Cell — draggable, title=edit zone, rest=drag zone ═══ */
function TaskCell({ task, editingTaskId, onStartEdit, onFinishEdit, onToggle, onDetail, minW, activeId }) {
  const [hover, setHover] = useState(false)
  if (!task) return <div style={{ flex: 1, minWidth: minW }} />

  const isEditing = editingTaskId === task.id
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { type: 'task', taskId: task.id },
  })

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 12px', minWidth: minW,
        background: hover ? '#fafaf8' : 'transparent', transition: 'background 0.1s',
        opacity: isDragging ? 0.3 : 1,
      }}
    >
      {/* Drag handle — this is the drag trigger (title is excluded) */}
      <div {...listeners} {...attributes} style={{ width: 12, opacity: hover ? 0.35 : 0, transition: 'opacity 0.15s', cursor: 'grab', flexShrink: 0 }}>
        <svg width="8" height="12" viewBox="0 0 8 12" fill="#999">
          <circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
          <circle cx="2" cy="6" r="1.2" /><circle cx="6" cy="6" r="1.2" />
          <circle cx="2" cy="10" r="1.2" /><circle cx="6" cy="10" r="1.2" />
        </svg>
      </div>

      {/* Checkbox */}
      <div onClick={e => { e.stopPropagation(); onToggle(task.id) }} style={{
```

### 수정 10: TaskCell의 Detail arrow 뒤에 droppable 타겟 추가 (task-on-task reorder용)

TaskCell 함수의 마지막 return 닫기 직전, detail arrow div 바로 뒤:

old_str:
```
      {/* Detail arrow */}
      <div onClick={() => onDetail(task)} style={{
        width: 22, height: 22, borderRadius: 4, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', opacity: hover ? 0.5 : 0, transition: 'opacity 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = '#f0efeb'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M6 3l5 5-5 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}
```

new_str:
```
      {/* Detail arrow */}
      <div onClick={() => onDetail(task)} style={{
        width: 22, height: 22, borderRadius: 4, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', opacity: hover ? 0.5 : 0, transition: 'opacity 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = '#f0efeb'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M6 3l5 5-5 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Invisible drop target for task-on-task reorder */}
      <TaskDropTarget taskId={task.id} activeId={activeId} />
    </div>
  )
}

/* ═══ Task Drop Target — invisible droppable for reorder ═══ */
function TaskDropTarget({ taskId, activeId }) {
  const { setNodeRef, isOver } = useDroppable({
    id: taskId,
    data: { type: 'task', taskId },
  })
  if (!activeId) return null
  return (
    <div ref={setNodeRef} style={{
      position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
      background: isOver ? 'rgba(49,130,206,0.08)' : 'transparent',
      pointerEvents: 'all', zIndex: isOver ? 1 : -1,
      borderTop: isOver ? '2px solid #3182CE' : 'none',
      transition: 'background 0.1s',
    }} />
  )
}
```

### 수정 11: TaskCell 외부 div에 position:relative 추가 (TaskDropTarget이 absolute 사용)

수정 9에서 이미 교체한 TaskCell의 외부 div에 `position: 'relative'`를 추가한다:

old_str (수정 9에서 넣은 코드):
```
      style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 12px', minWidth: minW,
        background: hover ? '#fafaf8' : 'transparent', transition: 'background 0.1s',
        opacity: isDragging ? 0.3 : 1,
      }}
```

new_str:
```
      style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 12px', minWidth: minW,
        background: hover ? '#fafaf8' : 'transparent', transition: 'background 0.1s',
        opacity: isDragging ? 0.3 : 1,
        position: 'relative',
      }}
```

---

## 검증

```bash
npm run build
```

- [ ] 할일의 드래그 핸들(⠿)을 잡고 드래그 시작 → DragOverlay 카드 표시
- [ ] 할일을 같은 MS 내 다른 할일 위에 드롭 → 순서 변경 (sortOrder 업데이트)
- [ ] 할일을 다른 MS 영역에 드롭 → keyMilestoneId 변경 (할일이 해당 MS로 이동)
- [ ] 할일을 다른 MS의 다른 할일 위에 드롭 → 해당 MS로 이동
- [ ] 할일 제목 클릭/더블클릭 → 인라인 편집 (드래그 시작 안 됨)
- [ ] 할일 체크박스 클릭 → 완료 토글 (드래그 시작 안 됨)
- [ ] 할일 ▸ 클릭 → 상세 패널 (드래그 시작 안 됨)
- [ ] 드래그 중 target MS에 파란색 하이라이트
- [ ] 드래그 중 target 할일 위에 파란색 상단 보더
- [ ] MS 접기/펼치기 여전히 동작
- [ ] 모두 접기/펼치기 여전히 동작
- [ ] 인라인 편집 여전히 동작
- [ ] 타임라인 모드 전환 여전히 정상
- [ ] npm run build 성공

git push origin main
