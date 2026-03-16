import { useState, useRef, useCallback, useEffect } from 'react'
import { DndContext, DragOverlay, useDroppable, PointerSensor, TouchSensor, useSensors, useSensor } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import useStore from '../../hooks/useStore'
import { getColor, CATEGORIES } from '../../utils/colors'
import { SettingsIcon, CheckIcon, UndoIcon } from '../shared/Icons'
import { parseDateFromText } from '../../utils/dateParser'
import InlineAdd from '../shared/InlineAdd'

export default function MatrixView() {
  const { projects: rawProjects, tasks, setShowProjectMgr, moveTaskTo, reorderTasks, collapseState, toggleCollapse: storeToggle, sortProjectsLocally } = useStore()
  const projects = sortProjectsLocally(rawProjects)
  const isMobile = window.innerWidth < 768
  const LW = isMobile ? 80 : 110
  const COL_GAP = 10
  const COL_MIN = isMobile ? 200 : 0

  const doneCollapsed = collapseState.matrixDone || {}
  const [activeId, setActiveId] = useState(null)
  const collapsed = collapseState.matrix || {}
  const toggleCollapse = (pid) => storeToggle('matrix', pid)

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)

  const dd = new Date()
  const dateStr = `${dd.getFullYear()}년 ${dd.getMonth()+1}월 ${dd.getDate()}일 ${['일','월','화','수','목','금','토'][dd.getDay()]}요일`

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null

  const handleDragStart = (e) => setActiveId(e.active.id)
  const handleDragEnd = (e) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return

    const task = tasks.find(t => t.id === active.id)
    if (!task) return
    const overId = over.id

    // Dropped on a category drop zone (projectId:category)
    if (typeof overId === 'string' && overId.includes(':')) {
      const [targetProjectId, targetCategory] = overId.split(':')
      if (task.projectId === targetProjectId && task.category === targetCategory) return
      moveTaskTo(active.id, targetProjectId, targetCategory)
      return
    }

    // Dropped on another task
    const overTask = tasks.find(t => t.id === overId)
    if (!overTask) return

    if (task.projectId === overTask.projectId && task.category === overTask.category) {
      // Same cell: reorder
      const cellTasks = tasks
        .filter(t => t.projectId === task.projectId && t.category === task.category)
        .sort((a, b) => a.sortOrder - b.sortOrder)
      const oldIndex = cellTasks.findIndex(t => t.id === active.id)
      const newIndex = cellTasks.findIndex(t => t.id === overId)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        reorderTasks(arrayMove(cellTasks, oldIndex, newIndex))
      }
    } else {
      // Cross-cell: move to target's project+category
      moveTaskTo(active.id, overTask.projectId, overTask.category)
    }
  }

  const N = projects.length

  useEffect(() => {
    const handler = () => {
      setTimeout(() => {
        const el = document.querySelector('[data-view="matrix"] input[type="text"], [data-view="matrix"] input:not([type])')
        el?.focus()
      }, 50)
    }
    window.addEventListener('view-focus', handler)
    return () => window.removeEventListener('view-focus', handler)
  }, [])

  return (
    <div data-view="matrix" style={{ padding: isMobile ? '20px 0 100px' : '40px 48px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ marginBottom: 24, padding: isMobile ? '0 16px' : 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#37352f', margin: 0, letterSpacing: '-0.02em' }}>매트릭스 뷰</h1>
            <p style={{ fontSize: 14, color: '#999', marginTop: 4 }}>{dateStr}</p>
          </div>
          <button onClick={() => setShowProjectMgr(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: '1px solid #e0e0e0', background: 'white', cursor: 'pointer', color: '#888', fontSize: 12, fontFamily: 'inherit', fontWeight: 500, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#999'; e.currentTarget.style.color = '#37352f' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.color = '#888' }}>
            <SettingsIcon /> 프로젝트 관리
          </button>
        </div>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ overflowX: 'auto', padding: isMobile ? '0 12px' : 0 }}>
            <div style={{ minWidth: isMobile ? LW + N * (COL_MIN + COL_GAP) : 'auto' }}>

              {/* ── Header row ── */}
              <div style={{ display: 'flex', gap: COL_GAP, marginBottom: 0 }}>
                <div style={{ width: LW, flexShrink: 0, ...(isMobile ? { position: 'sticky', left: 0, zIndex: 4, background: 'white' } : {}) }} />
                {projects.map(p => {
                  const c = getColor(p.color)
                  const pt = tasks.filter(t => t.projectId === p.id)
                  const isCol = collapsed[p.id]
                  return (
                    <div key={p.id} onClick={() => toggleCollapse(p.id)} style={{
                      flex: isCol ? '0 0 48px' : 1, minWidth: isCol ? 48 : COL_MIN,
                      background: c.header, borderRadius: '10px 10px 0 0',
                      padding: isCol ? '12px 0' : (isMobile ? '10px 10px' : '12px 16px'),
                      display: 'flex', alignItems: 'center', justifyContent: isCol ? 'center' : 'space-between',
                      height: 48, boxSizing: 'border-box', borderBottom: `2.5px solid ${c.dot}`,
                      cursor: 'pointer', transition: 'flex 0.25s ease, min-width 0.25s ease, padding 0.25s ease',
                      overflow: 'hidden',
                    }}>
                      {isCol ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: c.dot }} />
                          <span style={{ fontSize: 10, fontWeight: 600, color: c.text }}>{pt.length}</span>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 3, background: c.dot, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: c.text, whiteSpace: 'nowrap' }}>{p.name}</span>
                          </div>
                          <span style={{ fontSize: 11, color: c.text, background: 'rgba(255,255,255,0.55)', borderRadius: 10, padding: '1px 8px', fontWeight: 600, flexShrink: 0 }}>{pt.length}</span>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* ── Category rows ── */}
              {CATEGORIES.map((cat, ri) => {
                const isDone = cat.key === 'done'
                const isLast = ri === CATEGORIES.length - 1
                const isFirst = ri === 0

                return (
                  <div key={cat.key} style={{ display: 'flex', gap: COL_GAP, alignItems: 'stretch' }}>
                    <div style={{
                      width: LW, flexShrink: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6,
                      alignSelf: 'flex-start', paddingTop: 14, paddingRight: 8,
                      ...(isMobile ? { position: 'sticky', left: 0, zIndex: 4, background: 'white' } : {}),
                    }}>
                      <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{cat.emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isDone ? '#999' : '#555', lineHeight: 1.3, whiteSpace: 'nowrap' }}>{cat.label}</span>
                    </div>

                    {projects.map(p => {
                      const c = getColor(p.color)
                      const isCol = collapsed[p.id]
                      const catTasks = tasks
                        .filter(t => t.projectId === p.id && t.category === cat.key)
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                      const isDoneCollapsed = isDone && doneCollapsed[p.id] !== false && catTasks.length > 0
                      const cellRadius = isLast ? '0 0 10px 10px' : '0'

                      return (
                        <CategoryDropZone
                          key={p.id}
                          id={`${p.id}:${cat.key}`}
                          color={c}
                          activeId={activeId}
                          style={{
                            flex: isCol ? '0 0 48px' : 1, minWidth: isCol ? 48 : COL_MIN,
                            background: isDone ? '#f7f7f5' : c.card,
                            borderRadius: cellRadius,
                            borderLeft: '1px solid rgba(0,0,0,0.04)',
                            borderRight: '1px solid rgba(0,0,0,0.04)',
                            borderBottom: isLast ? '1px solid rgba(0,0,0,0.04)' : 'none',
                            borderTop: isFirst ? 'none' : '1px solid rgba(0,0,0,0.06)',
                            padding: isCol ? '8px 4px' : (isMobile ? '8px 8px' : '10px 14px'),
                            minHeight: isDone ? 50 : 80,
                            transition: 'flex 0.25s ease, min-width 0.25s ease, padding 0.25s ease',
                            overflow: 'hidden',
                          }}
                        >
                          {isCol ? (
                            <div style={{ fontSize: 10, color: isDone ? '#bbb' : c.dot, fontWeight: 600, textAlign: 'center' }}>{catTasks.length}</div>
                          ) : (
                            <>
                              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <div style={{ width: 4, height: 4, borderRadius: '50%', background: isDone ? '#ccc' : c.dot, flexShrink: 0 }} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: isDone ? '#aaa' : c.text, opacity: 0.7 }}>{cat.shortLabel}</span>
                                <span style={{ fontSize: 10, color: isDone ? '#bbb' : c.dot, fontWeight: 600 }}>{catTasks.length}</span>
                                {isDone && catTasks.length > 0 && (
                                  <button onClick={() => storeToggle('matrixDone', p.id)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 10, fontFamily: 'inherit', padding: '0 4px' }}>
                                    {isDoneCollapsed ? '펼치기' : '접기'}
                                  </button>
                                )}
                              </div>
                              <div style={{ minHeight: 20 }}>
                                {isDone && isDoneCollapsed
                                  ? <div style={{ fontSize: 11, color: '#ccc', padding: '2px 0' }}>완료 {catTasks.length}건</div>
                                  : (
                                    <SortableContext items={catTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                      {catTasks.map(task => <MatrixCard key={task.id} task={task} color={c} isDone={isDone} />)}
                                    </SortableContext>
                                  )
                                }
                              </div>
                              {!isDone && <InlineAdd projectId={p.id} category={cat.key} color={c} />}
                            </>
                          )}
                        </CategoryDropZone>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Drag overlay */}
          <DragOverlay dropAnimation={null}>
            {activeTask ? <TaskOverlay task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}

function CategoryDropZone({ id, color, activeId, style: cellStyle, children }) {
  const { isOver, setNodeRef } = useDroppable({ id })
  const showHighlight = isOver && activeId

  return (
    <div ref={setNodeRef} style={{
      ...cellStyle, display: 'flex', flexDirection: 'column', transition: 'background 0.15s',
      ...(showHighlight ? { background: color.header, outline: `2px dashed ${color.dot}`, outlineOffset: -2 } : {}),
    }}>
      {children}
    </div>
  )
}

/* ─── Task card: click=edit, hover ▶=detail, long-press=drag ─── */
function MatrixCard({ task, color, isDone }) {
  const { toggleDone, updateTask, openDetail, moveTaskTo, deleteTask } = useStore()
  const isMobile = window.innerWidth < 768
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(task.text)
  const [hovering, setHovering] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const inputRef = useRef(null)
  const longPressTimer = useRef(null)

  useEffect(() => { setText(task.text) }, [task.text])
  useEffect(() => {
    if (editing && inputRef.current) {
      const el = inputRef.current
      el.focus()
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [editing])

  const saveText = useCallback(() => {
    const trimmed = text.trim()
    if (trimmed && trimmed !== task.text) {
      const { startDate, dueDate } = parseDateFromText(trimmed)
      const patch = { text: trimmed }
      if (startDate) patch.startDate = startDate
      if (dueDate) patch.dueDate = dueDate
      updateTask(task.id, patch)
    }
    if (!trimmed) setText(task.text)
    setEditing(false)
  }, [text, task.text, task.id, updateTask])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveText() }
    if (e.key === 'Escape') { setText(task.text); setEditing(false) }
  }

  const style = {
    background: '#ffffff',
    borderRadius: 8,
    padding: '8px 10px',
    border: '1px solid rgba(0,0,0,0.06)',
    boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,0.12)' : '0 1px 2px rgba(0,0,0,0.03)',
    marginBottom: 6,
    transition: isDragging ? 'none' : 'box-shadow 0.15s',
    opacity: isDone ? 0.5 : isDragging ? 0.3 : 1,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 100 : undefined,
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    cursor: isDragging ? 'grabbing' : 'default',
  }

  const mobileHandlers = isMobile ? {
    onTouchStart: () => { longPressTimer.current = setTimeout(() => setShowMenu(true), 500) },
    onTouchEnd: () => clearTimeout(longPressTimer.current),
    onTouchMove: () => clearTimeout(longPressTimer.current),
  } : {}

  return (
    <div
      ref={setNodeRef} style={style}
      {...(!isMobile ? listeners : {})} {...attributes}
      onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}
      {...mobileHandlers}
    >
      {/* Checkbox */}
      <div onClick={e => { e.stopPropagation(); toggleDone(task.id) }} style={{ paddingTop: 1, flexShrink: 0, cursor: 'pointer' }}>
        {isDone
          ? <div style={{ width: 14, height: 14, borderRadius: 3, background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#66bb6a' }}>
              <UndoIcon />
            </div>
          : <CheckIcon checked={false} size={14} />
        }
      </div>
      {/* Text: click=edit */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
            onKeyDown={handleKeyDown}
            onBlur={saveText}
            rows={1}
            style={{ width: '100%', fontSize: 13, lineHeight: '19px', border: 'none', outline: 'none', padding: 0, fontFamily: 'inherit', background: 'transparent', color: '#37352f', boxSizing: 'border-box', resize: 'none', overflow: 'hidden' }}
          />
        ) : (
          <div
            onClick={() => { if (!isDragging) setEditing(true) }}
            style={{ fontSize: 13, fontWeight: 500, lineHeight: '19px', color: isDone ? '#999' : '#37352f', textDecoration: isDone ? 'line-through' : 'none', cursor: 'text', minHeight: 19 }}
          >
            {task.text}
          </div>
        )}
      </div>
      {/* Detail open button — hover only (desktop) */}
      {!isMobile && (
        <button
          onClick={e => { e.stopPropagation(); openDetail(task) }}
          style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            opacity: hovering ? 1 : 0, transition: 'opacity 0.15s',
            width: 22, height: 22, borderRadius: 4, background: 'rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#999', cursor: 'pointer', border: 'none', padding: 0, flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; e.currentTarget.style.color = '#555' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = '#999' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      )}
      {/* Mobile context menu */}
      {isMobile && showMenu && <MobileContextMenu task={task} onClose={() => setShowMenu(false)} openDetail={openDetail} deleteTask={deleteTask} />}
    </div>
  )
}

/* ─── Mobile context menu ─── */
function MobileContextMenu({ task, onClose, openDetail, deleteTask }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.2)', zIndex: 999 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
        background: 'white', borderRadius: '16px 16px 0 0', padding: '8px 0 20px',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#ddd', margin: '0 auto 12px' }} />
        <button onClick={() => { onClose(); openDetail(task) }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 20px', background: 'none', border: 'none', fontSize: 15, color: '#37352f', cursor: 'pointer', fontFamily: 'inherit' }}>
          📄 상세 보기
        </button>
        <button onClick={() => { onClose(); if (confirm('삭제하시겠습니까?')) deleteTask(task.id) }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 20px', background: 'none', border: 'none', fontSize: 15, color: '#e53935', cursor: 'pointer', fontFamily: 'inherit' }}>
          🗑 삭제
        </button>
      </div>
    </>
  )
}

/* ─── Drag overlay card ─── */
function TaskOverlay({ task }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 6,
      padding: '8px 10px', borderRadius: 8, background: 'white',
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.06)',
      transform: 'rotate(2deg)', cursor: 'grabbing', maxWidth: 300,
    }}>
      <div style={{ paddingTop: 1, flexShrink: 0 }}>
        <CheckIcon checked={false} size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, lineHeight: '19px', color: '#37352f' }}>{task.text}</div>
      </div>
    </div>
  )
}
