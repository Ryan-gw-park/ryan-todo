# 프로젝트 뷰 커밋 3 — 타임라인 DnD 추가

## REQ-LOCK 요구사항 목록

| # | 요구사항 | 소스 |
|---|---------|------|
| R1 | 좌측 트리 DnD: 할일→다른 MS로 이동 | 대화 확정 |
| R2 | 좌측 트리 DnD: MS→하위 이동 / 순서 변경 | 대화 확정 |
| R3 | Gantt 바 전체 드래그 → 기간 시프트 (start+end 동시 이동) | 대화 확정 |
| R4 | Gantt 바 좌측 끝 드래그 → start 변경 | 대화 확정 |
| R5 | Gantt 바 우측 끝 드래그 → end 변경 | 대화 확정 |
| R6 | Ctrl+Z 되돌리기 | 대화 확정 |

---

## 대상 파일: `src/components/project/UnifiedProjectView.jsx`

커밋 2 적용 후 (`final-UnifiedProjectView.jsx` 상태) 기준.

---

### 3-1. import에 useRef, useEffect 추가

```
str_replace
path: src/components/project/UnifiedProjectView.jsx
old_str:
import { useState, useMemo, useCallback } from 'react'
new_str:
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
```

### 3-2. date helper 추가 (getBarStyle 다음)

```
str_replace
path: src/components/project/UnifiedProjectView.jsx
old_str:
// ─── Pill ───
new_str:
// ─── x ↔ date conversion ───
function getDayWidth(colW, scale) { return scale === 'week' ? colW / 7 : scale === 'month' ? colW / 30 : colW / 90 }
function fmtISO(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function xToDate(x, minD, colW, scale) { return addDays(minD, Math.round(x / getDayWidth(colW, scale))) }

// ─── Pill ───
```

### 3-3. store 액션 추가 (openConfirmDialog 다음)

```
str_replace
path: src/components/project/UnifiedProjectView.jsx
old_str:
  const openConfirmDialog = useStore(s => s.openConfirmDialog)
  const { pkm, loading: pkmLoading } = useProjectKeyMilestone(projectId)
new_str:
  const openConfirmDialog = useStore(s => s.openConfirmDialog)
  const updateTask = useStore(s => s.updateTask)
  const moveMilestone = useStore(s => s.moveMilestone)
  const reorderMilestones = useStore(s => s.reorderMilestones)
  const { pkm, loading: pkmLoading } = useProjectKeyMilestone(projectId)
```

### 3-4. Undo stack + toast 추가 (scale state 다음)

```
str_replace
path: src/components/project/UnifiedProjectView.jsx
old_str:
  // ─── Shared collapsed state ───
new_str:
  const [toast, setToast] = useState(null)

  // ─── Undo ───
  const undoStack = useRef([])
  const pushUndo = useCallback((action) => {
    undoStack.current.push(action)
    if (undoStack.current.length > 20) undoStack.current.shift()
  }, [])
  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return
    const action = undoStack.current.pop()
    action.undo()
    setToast({ msg: `되돌림: ${action.label}`, canUndo: undoStack.current.length > 0 })
    setTimeout(() => setToast(null), 2500)
  }, [])
  useEffect(() => {
    const handler = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo])
  const showToast = (msg) => { setToast({ msg, canUndo: true }); setTimeout(() => setToast(null), 4000) }

  // ─── Shared collapsed state ───
```

### 3-5. 타임라인 DnD 핸들러 추가 (backlogTasks 다음)

```
str_replace
path: src/components/project/UnifiedProjectView.jsx
old_str:
  const isMobile = window.innerWidth < 768
new_str:
  // ─── Timeline DnD handlers ───
  const handleTimelineTaskDrop = useCallback((taskId, fromMsId, toMsId) => {
    if (fromMsId === toMsId) return
    const fromMs = milestones.find(m => m.id === fromMsId)
    const toMs = milestones.find(m => m.id === toMsId)
    pushUndo({ label: '할일 이동', undo: () => updateTask(taskId, { keyMilestoneId: fromMsId }) })
    updateTask(taskId, { keyMilestoneId: toMsId })
    showToast(`할일을 "${fromMs?.title || '?'}" → "${toMs?.title || '?'}"로 이동`)
  }, [milestones, updateTask, pushUndo])

  const handleTimelineMsDropChild = useCallback((msId, targetId) => {
    if (msId === targetId) return
    const ms = milestones.find(m => m.id === msId)
    const oldParentId = ms?.parent_id || null
    pushUndo({ label: 'MS 하위 이동', undo: () => moveMilestone(msId, oldParentId) })
    moveMilestone(msId, targetId)
    setCollapsed(prev => { const n = new Set(prev); n.delete(targetId); return n })
    showToast(`"${ms?.title || '?'}" 하위로 이동`)
  }, [milestones, moveMilestone, pushUndo])

  const handleTimelineMsReorder = useCallback((msId, targetId, position) => {
    if (msId === targetId) return
    const ms = milestones.find(m => m.id === msId)
    const target = milestones.find(m => m.id === targetId)
    if (!ms || !target) return
    const targetParentId = target.parent_id || null
    const oldParentId = ms.parent_id || null
    if (oldParentId !== targetParentId) {
      pushUndo({ label: 'MS 이동+순서', undo: () => moveMilestone(msId, oldParentId) })
      moveMilestone(msId, targetParentId)
    }
    setTimeout(() => {
      const siblings = milestones
        .filter(m => m.project_id === ms.project_id && (m.parent_id || null) === targetParentId && m.id !== msId)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      const idx = siblings.findIndex(s => s.id === targetId)
      if (idx === -1) return
      const reordered = [...siblings]
      reordered.splice(position === 'above' ? idx : idx + 1, 0, milestones.find(m => m.id === msId))
      reorderMilestones(reordered)
      if (oldParentId === targetParentId) {
        pushUndo({ label: 'MS 순서 변경', undo: () => {
          const original = milestones.filter(m => m.project_id === ms.project_id && (m.parent_id || null) === targetParentId).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          reorderMilestones(original)
        }})
      }
    }, 100)
    showToast(`"${ms?.title || '?'}" 순서 변경`)
  }, [milestones, moveMilestone, reorderMilestones, pushUndo])

  // Gantt bar drag handler (called from DraggableBar)
  const handleBarDragEnd = useCallback((type, id, newStart, newEnd) => {
    if (type === 'task') {
      const task = projectTasks.find(t => t.id === id)
      if (!task) return
      const oldStart = task.startDate, oldEnd = task.dueDate
      pushUndo({ label: '할일 기간 변경', undo: () => updateTask(id, { startDate: oldStart, dueDate: oldEnd }) })
      updateTask(id, { startDate: newStart, dueDate: newEnd })
      showToast(`할일 기간: ${newStart} ~ ${newEnd}`)
    } else if (type === 'ms') {
      const ms = milestones.find(m => m.id === id)
      if (!ms) return
      const oldStart = ms.start_date, oldEnd = ms.end_date
      pushUndo({ label: 'MS 기간 변경', undo: () => updateMilestone(id, { start_date: oldStart, end_date: oldEnd }) })
      updateMilestone(id, { start_date: newStart, end_date: newEnd })
      showToast(`MS 기간: ${newStart} ~ ${newEnd}`)
    }
  }, [projectTasks, milestones, updateTask, updateMilestone, pushUndo])

  const isMobile = window.innerWidth < 768
```

### 3-6. Toast 렌더링 추가 (return 마지막, 닫는 div 전)

```
str_replace
path: src/components/project/UnifiedProjectView.jsx
old_str:
      </div>
    </div>
  )
}

/* ═══ TimelineMsRow
new_str:
      </div>

      {/* Toast */}
      {toast && <Toast msg={toast.msg} canUndo={toast.canUndo} onUndo={undo} onClose={() => setToast(null)} />}
    </div>
  )
}

/* ═══ Toast ═══ */
function Toast({ msg, canUndo, onUndo, onClose }) {
  if (!msg) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: '#1e293b', color: '#fff', padding: '8px 16px', borderRadius: 8,
      fontSize: FONT.label, fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      display: 'flex', alignItems: 'center', gap: 12, zIndex: 100,
    }}>
      {msg}
      {canUndo && (
        <button onClick={onUndo} style={{
          background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
          color: '#fff', borderRadius: 4, padding: '2px 10px', fontSize: FONT.caption,
          cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
        }}>Ctrl+Z</button>
      )}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}>✕</button>
    </div>
  )
}

/* ═══ TimelineMsRow
```

### 3-7. TimelineMsRow에 좌측 트리 DnD + Gantt 바 DnD 추가

TimelineMsRow 전체를 교체합니다:

```
str_replace
path: src/components/project/UnifiedProjectView.jsx
old_str:
/* ═══ TimelineMsRow — 타임라인 모드 재귀 노드 ═══ */
function TimelineMsRow({ node, depth, dotColor, collapsed, toggleNode, timelineCtx, projectTasks, toggleDone }) {
  const hasChildren = (node.children || []).length > 0
  const isCollapsed = collapsed.has(node.id)
  const [hover, setHover] = useState(false)

  const allTasks = projectTasks.filter(t => t.keyMilestoneId === node.id && !t.deletedAt)
  const activeTasks = allTasks.filter(t => !t.done).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

  const { columns, colW, minD, scale, todayLabel } = timelineCtx

  return (
    <>
      {/* MS row */}
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${COLOR.border}`, minHeight: 30 }}
      >
        {/* Left tree */}
        <div style={{
          width: TREE_W, flexShrink: 0, padding: '4px 8px', paddingLeft: 8 + depth * 22,
          display: 'flex', alignItems: 'center', gap: 5,
          borderRight: `1px solid ${COLOR.border}`,
        }}>
          {hasChildren ? (
            <span onClick={() => toggleNode(node.id)}
              style={{ fontSize: 11, color: COLOR.textSecondary, width: 12, textAlign: 'center', cursor: 'pointer',
                transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', flexShrink: 0 }}>▾</span>
          ) : <span style={{ width: 12, flexShrink: 0 }} />}
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
          <span style={{
            fontSize: FONT.label, fontWeight: depth === 0 ? 600 : 500, color: COLOR.textPrimary,
            flex: 1, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3,
          }}>{node.title || '(제목 없음)'}</span>
        </div>

        {/* Right: Gantt */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', height: '100%' }}>
            {columns.map((col, i) => {
              const isToday = col.label === todayLabel
              return (
                <div key={i} style={{
                  width: colW, flexShrink: 0,
                  borderRight: `1px solid ${isToday ? '#E53E3E' : COLOR.border}`,
                  background: isToday ? 'rgba(229,62,62,0.03)' : 'transparent',
                }} />
              )
            })}
          </div>
          {/* MS bar */}
          {node.start_date && node.end_date && (() => {
            const bs = getBarStyle(node.start_date, node.end_date, minD, colW, scale, dotColor, hasChildren ? 0.25 : 0.5)
            return bs ? <div style={bs} /> : null
          })()}
        </div>
      </div>

      {/* Task rows (only when expanded) */}
      {!isCollapsed && activeTasks.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${COLOR.border}`, minHeight: 26 }}>
          <div style={{
            width: TREE_W, flexShrink: 0, padding: '3px 8px', paddingLeft: 8 + (depth + 1) * 22 + 14,
            display: 'flex', alignItems: 'center', gap: 5,
            borderRight: `1px solid ${COLOR.border}`,
          }}>
            <div onClick={() => toggleDone(t.id)} style={{
              width: 12, height: 12, borderRadius: 3, flexShrink: 0, cursor: 'pointer',
              border: t.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`,
              background: t.done ? CHECKBOX.checkedBg : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {t.done && <svg width={7} height={7} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
            <span style={{
              fontSize: FONT.caption, color: COLOR.textPrimary, flex: 1,
              whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3,
            }}>{t.text}</span>
          </div>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', height: '100%' }}>
              {columns.map((col, i) => (
                <div key={i} style={{ width: colW, flexShrink: 0, borderRight: `1px solid ${COLOR.border}` }} />
              ))}
            </div>
            {t.startDate && t.dueDate && (() => {
              const bs = getBarStyle(t.startDate, t.dueDate, minD, colW, scale, dotColor, 0.4)
              return bs ? <div style={{ ...bs, height: 12, borderRadius: 3 }} /> : null
            })()}
          </div>
        </div>
      ))}

      {/* Children */}
      {hasChildren && !isCollapsed && node.children.map(child => (
        <TimelineMsRow
          key={child.id} node={child} depth={depth + 1} dotColor={dotColor}
          collapsed={collapsed} toggleNode={toggleNode}
          timelineCtx={timelineCtx}
          projectTasks={projectTasks}
          toggleDone={toggleDone}
        />
      ))}
    </>
  )
}
new_str:
/* ═══ TimelineMsRow — 타임라인 모드 재귀 노드 (좌측 트리 DnD + Gantt 바 DnD) ═══ */
function TimelineMsRow({ node, depth, dotColor, collapsed, toggleNode, timelineCtx, projectTasks, toggleDone,
  dragState, setDragState, onTaskDrop, onMsDropChild, onMsReorder, onBarDragEnd,
}) {
  const hasChildren = (node.children || []).length > 0
  const isCollapsed = collapsed.has(node.id)
  const [hover, setHover] = useState(false)
  const [dropTarget, setDropTarget] = useState(null) // 'task-zone' | 'ms-child' | 'ms-above' | 'ms-below'

  const allTasks = projectTasks.filter(t => t.keyMilestoneId === node.id && !t.deletedAt)
  const activeTasks = allTasks.filter(t => !t.done).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

  const { columns, colW, minD, scale, todayLabel } = timelineCtx

  const handleDragOver = (e, zone) => { e.preventDefault(); e.stopPropagation(); setDropTarget(zone) }
  const handleDragLeave = () => setDropTarget(null)
  const handleDrop = (e, zone) => {
    e.preventDefault(); e.stopPropagation(); setDropTarget(null)
    const type = e.dataTransfer.getData('type')
    if (type === 'task' && (zone === 'task-zone' || zone === 'ms-child')) {
      const taskId = e.dataTransfer.getData('taskId')
      const fromMsId = e.dataTransfer.getData('fromMsId')
      if (fromMsId !== node.id) onTaskDrop(taskId, fromMsId, node.id)
    }
    if (type === 'ms') {
      const msId = e.dataTransfer.getData('msId')
      if (msId === node.id) return
      if (zone === 'ms-child') onMsDropChild(msId, node.id)
      if (zone === 'ms-above') onMsReorder(msId, node.id, 'above')
      if (zone === 'ms-below') onMsReorder(msId, node.id, 'below')
    }
  }

  return (
    <>
      {dropTarget === 'ms-above' && <div style={{ height: 2, background: '#3182CE', margin: '0 10px', borderRadius: 1 }} />}

      {/* MS row */}
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${COLOR.border}`, minHeight: 30,
          background: dropTarget === 'ms-child' ? 'rgba(49,130,206,0.08)' : 'transparent',
          outline: dropTarget === 'ms-child' ? '2px dashed #3182CE' : 'none', outlineOffset: -2,
        }}
      >
        {/* Left tree — draggable MS */}
        <div
          draggable
          onDragStart={e => {
            e.dataTransfer.setData('type', 'ms')
            e.dataTransfer.setData('msId', node.id)
            setDragState({ type: 'ms', id: node.id })
          }}
          onDragOver={e => {
            if (dragState?.type === 'ms') {
              const rect = e.currentTarget.getBoundingClientRect()
              const y = e.clientY - rect.top
              const zone = y < rect.height * 0.25 ? 'ms-above' : y > rect.height * 0.75 ? 'ms-below' : 'ms-child'
              handleDragOver(e, zone)
            }
            if (dragState?.type === 'task') handleDragOver(e, 'task-zone')
          }}
          onDragLeave={handleDragLeave}
          onDrop={e => handleDrop(e, dropTarget || 'ms-child')}
          style={{
            width: TREE_W, flexShrink: 0, padding: '4px 8px', paddingLeft: 8 + depth * 22,
            display: 'flex', alignItems: 'center', gap: 5,
            borderRight: `1px solid ${COLOR.border}`, cursor: 'grab',
          }}
        >
          {hasChildren ? (
            <span onClick={ev => { ev.stopPropagation(); ev.preventDefault(); toggleNode(node.id) }}
              style={{ fontSize: 11, color: COLOR.textSecondary, width: 12, textAlign: 'center', cursor: 'pointer',
                transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', flexShrink: 0 }}>▾</span>
          ) : <span style={{ width: 12, flexShrink: 0 }} />}
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
          <span style={{
            fontSize: FONT.label, fontWeight: depth === 0 ? 600 : 500, color: COLOR.textPrimary,
            flex: 1, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3,
          }}>{node.title || '(제목 없음)'}</span>
        </div>

        {/* Right: Gantt */}
        <div
          onDragOver={e => { if (dragState?.type === 'task') handleDragOver(e, 'task-zone') }}
          onDragLeave={handleDragLeave}
          onDrop={e => handleDrop(e, 'task-zone')}
          style={{
            flex: 1, position: 'relative', overflow: 'hidden',
            background: dropTarget === 'task-zone' ? 'rgba(49,130,206,0.06)' : 'transparent',
          }}
        >
          <div style={{ display: 'flex', height: '100%' }}>
            {columns.map((col, i) => {
              const isToday = col.label === todayLabel
              return (
                <div key={i} style={{
                  width: colW, flexShrink: 0,
                  borderRight: `1px solid ${isToday ? '#E53E3E' : COLOR.border}`,
                  background: isToday ? 'rgba(229,62,62,0.03)' : 'transparent',
                }} />
              )
            })}
          </div>
          {/* MS bar — draggable */}
          {node.start_date && node.end_date && (
            <DraggableBar
              type="ms" id={node.id}
              startStr={node.start_date} endStr={node.end_date}
              minD={minD} colW={colW} scale={scale}
              barColor={dotColor} opacity={hasChildren ? 0.25 : 0.5}
              height={16}
              onDragEnd={onBarDragEnd}
            />
          )}
        </div>
      </div>

      {dropTarget === 'ms-below' && <div style={{ height: 2, background: '#3182CE', margin: '0 10px', borderRadius: 1 }} />}

      {/* Task rows (only when expanded) */}
      {!isCollapsed && activeTasks.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${COLOR.border}`, minHeight: 26 }}>
          {/* Left: task row — draggable */}
          <div
            draggable
            onDragStart={e => {
              e.dataTransfer.setData('type', 'task')
              e.dataTransfer.setData('taskId', t.id)
              e.dataTransfer.setData('fromMsId', node.id)
              setDragState({ type: 'task', id: t.id })
            }}
            style={{
              width: TREE_W, flexShrink: 0, padding: '3px 8px', paddingLeft: 8 + (depth + 1) * 22 + 14,
              display: 'flex', alignItems: 'center', gap: 5,
              borderRight: `1px solid ${COLOR.border}`, cursor: 'grab',
            }}
          >
            <div onClick={ev => { ev.stopPropagation(); toggleDone(t.id) }} style={{
              width: 12, height: 12, borderRadius: 3, flexShrink: 0, cursor: 'pointer',
              border: t.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`,
              background: t.done ? CHECKBOX.checkedBg : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {t.done && <svg width={7} height={7} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
            <span style={{
              fontSize: FONT.caption, color: COLOR.textPrimary, flex: 1,
              whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3,
            }}>{t.text}</span>
          </div>
          {/* Right: task Gantt bar — draggable */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', height: '100%' }}>
              {columns.map((col, i) => (
                <div key={i} style={{ width: colW, flexShrink: 0, borderRight: `1px solid ${COLOR.border}` }} />
              ))}
            </div>
            {t.startDate && t.dueDate && (
              <DraggableBar
                type="task" id={t.id}
                startStr={t.startDate} endStr={t.dueDate}
                minD={minD} colW={colW} scale={scale}
                barColor={dotColor} opacity={0.4}
                height={12}
                onDragEnd={onBarDragEnd}
              />
            )}
          </div>
        </div>
      ))}

      {/* Children */}
      {hasChildren && !isCollapsed && node.children.map(child => (
        <TimelineMsRow
          key={child.id} node={child} depth={depth + 1} dotColor={dotColor}
          collapsed={collapsed} toggleNode={toggleNode}
          timelineCtx={timelineCtx} projectTasks={projectTasks} toggleDone={toggleDone}
          dragState={dragState} setDragState={setDragState}
          onTaskDrop={onTaskDrop} onMsDropChild={onMsDropChild} onMsReorder={onMsReorder}
          onBarDragEnd={onBarDragEnd}
        />
      ))}
    </>
  )
}

/* ═══ DraggableBar — Gantt 바 드래그 (전체 이동 + 좌우 리사이즈) ═══ */
function DraggableBar({ type, id, startStr, endStr, minD, colW, scale, barColor, opacity, height, onDragEnd }) {
  const s = parseDate(startStr), e = parseDate(endStr)
  if (!s || !e) return null

  const dayW = getDayWidth(colW, scale)
  const left = daysBetween(minD, s) * dayW
  const width = Math.max(daysBetween(s, e) * dayW, colW * 0.4)

  const dragRef = useRef(null)
  const [dragMode, setDragMode] = useState(null) // 'move' | 'resize-left' | 'resize-right'
  const dragStartX = useRef(0)
  const origLeft = useRef(left)
  const origWidth = useRef(width)

  const handleMouseDown = (e, mode) => {
    e.preventDefault()
    e.stopPropagation()
    setDragMode(mode)
    dragStartX.current = e.clientX
    origLeft.current = left
    origWidth.current = width

    const handleMove = (ev) => {
      const delta = ev.clientX - dragStartX.current
      const bar = dragRef.current
      if (!bar) return

      if (mode === 'move') {
        bar.style.left = `${origLeft.current + delta}px`
      } else if (mode === 'resize-left') {
        const newLeft = origLeft.current + delta
        const newWidth = origWidth.current - delta
        if (newWidth > colW * 0.3) {
          bar.style.left = `${newLeft}px`
          bar.style.width = `${newWidth}px`
        }
      } else if (mode === 'resize-right') {
        const newWidth = origWidth.current + delta
        if (newWidth > colW * 0.3) {
          bar.style.width = `${newWidth}px`
        }
      }
    }

    const handleUp = (ev) => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      setDragMode(null)

      const delta = ev.clientX - dragStartX.current
      if (Math.abs(delta) < 3) return // ignore tiny movements

      let newStart, newEnd
      if (mode === 'move') {
        const newLeft = origLeft.current + delta
        newStart = fmtISO(xToDate(newLeft, minD, colW, scale))
        newEnd = fmtISO(xToDate(newLeft + origWidth.current, minD, colW, scale))
      } else if (mode === 'resize-left') {
        const newLeft = origLeft.current + delta
        newStart = fmtISO(xToDate(newLeft, minD, colW, scale))
        newEnd = endStr
      } else if (mode === 'resize-right') {
        newStart = startStr
        const newRight = origLeft.current + origWidth.current + delta
        newEnd = fmtISO(xToDate(newRight, minD, colW, scale))
      }

      if (newStart && newEnd) onDragEnd(type, id, newStart, newEnd)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  const HANDLE_W = 6

  return (
    <div
      ref={dragRef}
      style={{
        position: 'absolute', left, width, top: '50%', transform: 'translateY(-50%)',
        height, borderRadius: 4, background: barColor, opacity,
        cursor: dragMode === 'move' ? 'grabbing' : 'grab',
        display: 'flex', alignItems: 'center',
        userSelect: 'none',
      }}
      onMouseDown={e => handleMouseDown(e, 'move')}
    >
      {/* Left resize handle */}
      <div
        onMouseDown={e => handleMouseDown(e, 'resize-left')}
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: HANDLE_W,
          cursor: 'col-resize', borderRadius: '4px 0 0 4px',
        }}
      />
      {/* Right resize handle */}
      <div
        onMouseDown={e => handleMouseDown(e, 'resize-right')}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: HANDLE_W,
          cursor: 'col-resize', borderRadius: '0 4px 4px 0',
        }}
      />
    </div>
  )
}
```

### 3-8. TimelineMsRow 호출부에 DnD props 전달

```
str_replace
path: src/components/project/UnifiedProjectView.jsx
old_str:
                <TimelineMsRow
                  key={node.id} node={node} depth={0} dotColor={dotColor}
                  collapsed={collapsed} toggleNode={toggleNode}
                  timelineCtx={timelineCtx}
                  projectTasks={projectTasks}
                  toggleDone={toggleDone}
                />
new_str:
                <TimelineMsRow
                  key={node.id} node={node} depth={0} dotColor={dotColor}
                  collapsed={collapsed} toggleNode={toggleNode}
                  timelineCtx={timelineCtx}
                  projectTasks={projectTasks}
                  toggleDone={toggleDone}
                  dragState={dragState} setDragState={setDragState}
                  onTaskDrop={handleTimelineTaskDrop}
                  onMsDropChild={handleTimelineMsDropChild}
                  onMsReorder={handleTimelineMsReorder}
                  onBarDragEnd={handleBarDragEnd}
                />
```

### 3-9. dragState 추가 (scale state 다음)

```
str_replace
path: src/components/project/UnifiedProjectView.jsx
old_str:
  const [rightMode, setRightMode] = useState('전체 할일')
  const [scale, setScale] = useState('week')
new_str:
  const [rightMode, setRightMode] = useState('전체 할일')
  const [scale, setScale] = useState('week')
  const [dragState, setDragState] = useState(null) // { type: 'task'|'ms', id }
```

### 3-10. onDragEnd 글로벌 핸들러 (타임라인 컨테이너)

```
str_replace
path: src/components/project/UnifiedProjectView.jsx
old_str:
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
new_str:
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }} onDragEnd={() => setDragState(null)}>
```

---

## 커밋 실행

```bash
npm run build
git add -A
git commit -m "프로젝트 뷰 커밋 3: 타임라인 DnD — 좌측 트리(MS/할일 이동) + Gantt 바(기간 드래그+리사이즈) + Ctrl+Z"
git push origin main
```

---

## DELETE-5 검증

삭제 대상: 기존 TimelineMsRow (교체됨)

| 삭제 대상 | ① import | ② caller | ③ props | ④ deps | ⑤ types | 처리 |
|-----------|----------|----------|---------|--------|---------|------|
| TimelineMsRow (구) | — 내부 | 본 파일 render | 새 signature로 교체 | — | — | 교체 완료 |

추가 import: `useRef`, `useEffect` — 사용처: undoStack, keydown listener ✓
추가 store: `updateTask`, `moveMilestone`, `reorderMilestones` — 사용처: DnD 핸들러들 ✓
추가 컴포넌트: `DraggableBar`, `Toast` — 내부 전용 ✓

## REQ-LOCK 검증

| # | 요구사항 | 처리 위치 | 상태 |
|---|---------|-----------|------|
| R1 | 좌측 트리: 할일→MS 이동 | TimelineMsRow draggable task + handleTimelineTaskDrop | ✓ |
| R2 | 좌측 트리: MS 하위/순서 | TimelineMsRow draggable MS + handleMsDropChild/Reorder | ✓ |
| R3 | Gantt 바 전체 드래그 | DraggableBar mode='move' → onBarDragEnd | ✓ |
| R4 | Gantt 바 좌측 리사이즈 | DraggableBar mode='resize-left' → newStart | ✓ |
| R5 | Gantt 바 우측 리사이즈 | DraggableBar mode='resize-right' → newEnd | ✓ |
| R6 | Ctrl+Z | undoStack + useEffect keydown + Toast | ✓ |
