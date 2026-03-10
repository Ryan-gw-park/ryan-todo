import { useState } from 'react'
import { DndContext, useDraggable, useDroppable, pointerWithin } from '@dnd-kit/core'
import useStore from '../../hooks/useStore'
import { getColor, CATEGORIES } from '../../utils/colors'
import { SettingsIcon, CheckIcon, UndoIcon } from '../shared/Icons'
import InlineAdd from '../shared/InlineAdd'

export default function MatrixView() {
  const { projects, tasks, setShowProjectMgr, moveTaskTo } = useStore()
  const isMobile = window.innerWidth < 768
  const LW = isMobile ? 80 : 110
  const COL_GAP = 10
  const COL_MIN = isMobile ? 200 : 0

  const [doneCollapsed, setDoneCollapsed] = useState({})
  const [activeId, setActiveId] = useState(null)

  const dd = new Date()
  const dateStr = `${dd.getFullYear()}년 ${dd.getMonth()+1}월 ${dd.getDate()}일 ${['일','월','화','수','목','금','토'][dd.getDay()]}요일`

  const handleDragStart = (e) => setActiveId(e.active.id)
  const handleDragEnd = (e) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const [targetProjectId, targetCategory] = over.id.split(':')
    const task = tasks.find(t => t.id === active.id)
    if (!task) return
    if (task.projectId === targetProjectId && task.category === targetCategory) return
    moveTaskTo(active.id, targetProjectId, targetCategory)
  }

  const N = projects.length

  return (
    <div style={{ padding: isMobile ? '20px 0 100px' : '40px 48px' }}>
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

        <DndContext collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ overflowX: 'auto', padding: isMobile ? '0 12px' : 0 }}>
            <div style={{ minWidth: isMobile ? LW + N * (COL_MIN + COL_GAP) : 'auto' }}>

              {/* ── Header row ── */}
              <div style={{ display: 'flex', gap: COL_GAP, marginBottom: 0 }}>
                <div style={{ width: LW, flexShrink: 0, ...(isMobile ? { position: 'sticky', left: 0, zIndex: 4, background: 'white' } : {}) }} />
                {projects.map(p => {
                  const c = getColor(p.color)
                  const pt = tasks.filter(t => t.projectId === p.id)
                  return (
                    <div key={p.id} style={{ flex: 1, minWidth: COL_MIN, background: c.header, borderRadius: '10px 10px 0 0', padding: isMobile ? '10px 10px' : '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48, boxSizing: 'border-box', borderBottom: `2.5px solid ${c.dot}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: c.dot, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: c.text, whiteSpace: 'nowrap' }}>{p.name}</span>
                      </div>
                      <span style={{ fontSize: 11, color: c.text, background: 'rgba(255,255,255,0.55)', borderRadius: 10, padding: '1px 8px', fontWeight: 600, flexShrink: 0 }}>{pt.length}</span>
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
                    {/* Left label */}
                    <div style={{
                      width: LW, flexShrink: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6,
                      alignSelf: 'flex-start', paddingTop: 14, paddingRight: 8,
                      ...(isMobile ? { position: 'sticky', left: 0, zIndex: 4, background: 'white' } : {}),
                    }}>
                      <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{cat.emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isDone ? '#999' : '#555', lineHeight: 1.3, whiteSpace: 'nowrap' }}>{cat.label}</span>
                    </div>

                    {/* Project cells for this category */}
                    {projects.map(p => {
                      const c = getColor(p.color)
                      const catTasks = tasks.filter(t => t.projectId === p.id && t.category === cat.key)
                      const isCollapsed = isDone && doneCollapsed[p.id] !== false && catTasks.length > 0

                      const cellRadius = isLast ? '0 0 10px 10px' : '0'

                      return (
                        <CategoryDropZone
                          key={p.id}
                          id={`${p.id}:${cat.key}`}
                          color={c}
                          isDone={isDone}
                          activeId={activeId}
                          style={{
                            flex: 1, minWidth: COL_MIN,
                            background: isDone ? '#f7f7f5' : c.card,
                            borderRadius: cellRadius,
                            borderLeft: `1px solid rgba(0,0,0,0.04)`,
                            borderRight: `1px solid rgba(0,0,0,0.04)`,
                            borderBottom: isLast ? '1px solid rgba(0,0,0,0.04)' : 'none',
                            borderTop: isFirst ? 'none' : '1px solid rgba(0,0,0,0.06)',
                            padding: isMobile ? '8px 8px' : '10px 14px',
                            minHeight: isDone ? 50 : 80,
                          }}
                        >
                          {/* Category sub-label */}
                          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: isDone ? '#ccc' : c.dot, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: isDone ? '#aaa' : c.text, opacity: 0.7 }}>{cat.shortLabel}</span>
                            <span style={{ fontSize: 10, color: isDone ? '#bbb' : c.dot, fontWeight: 600 }}>{catTasks.length}</span>
                            {isDone && catTasks.length > 0 && (
                              <button onClick={() => setDoneCollapsed(prev => ({ ...prev, [p.id]: !isCollapsed }))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 10, fontFamily: 'inherit', padding: '0 4px' }}>
                                {isCollapsed ? '펼치기' : '접기'}
                              </button>
                            )}
                          </div>

                          <div style={{ minHeight: 20 }}>
                            {isDone && isCollapsed
                              ? <div style={{ fontSize: 11, color: '#ccc', padding: '2px 0' }}>완료 {catTasks.length}건</div>
                              : catTasks.map(task => <MatrixCard key={task.id} task={task} color={c} isDone={isDone} />)
                            }
                          </div>
                          {!isDone && <InlineAdd projectId={p.id} category={cat.key} color={c} />}
                        </CategoryDropZone>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </DndContext>
      </div>
    </div>
  )
}

/* ─── Droppable category zone ─── */
function CategoryDropZone({ id, color, isDone, activeId, style: cellStyle, children }) {
  const { isOver, setNodeRef } = useDroppable({ id })
  const showHighlight = isOver && activeId

  return (
    <div
      ref={setNodeRef}
      style={{
        ...cellStyle,
        display: 'flex',
        flexDirection: 'column',
        transition: 'background 0.15s',
        ...(showHighlight ? {
          background: color.header,
          outline: `2px dashed ${color.dot}`,
          outlineOffset: -2,
        } : {}),
      }}
    >
      {children}
    </div>
  )
}

/* ─── Draggable task card (board-view style) ─── */
function MatrixCard({ task, color, isDone }) {
  const { openDetail, toggleDone } = useStore()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })

  const style = {
    background: '#ffffff',
    borderRadius: 8,
    padding: '10px 12px',
    border: '1px solid rgba(0,0,0,0.06)',
    boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,0.12)' : '0 1px 2px rgba(0,0,0,0.03)',
    marginBottom: 6,
    cursor: isDragging ? 'grabbing' : 'grab',
    transition: isDragging ? 'none' : 'box-shadow 0.15s',
    opacity: isDone ? 0.5 : isDragging ? 0.9 : 1,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)${isDragging ? ' rotate(2deg)' : ''}` : undefined,
    zIndex: isDragging ? 100 : undefined,
    position: isDragging ? 'relative' : undefined,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
  }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)' }}
      onMouseLeave={e => { if (!isDragging) e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)' }}
    >
      <div onClick={e => { e.stopPropagation(); toggleDone(task.id) }} style={{ paddingTop: 1, flexShrink: 0 }}>
        {isDone
          ? <div style={{ width: 18, height: 18, borderRadius: 4, background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#66bb6a' }}><UndoIcon /></div>
          : <CheckIcon checked={false} />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }} onClick={() => openDetail(task)}>
        <div style={{ fontSize: 13, lineHeight: '19px', color: isDone ? '#999' : '#37352f', textDecoration: isDone ? 'line-through' : 'none' }}>{task.text}</div>
        {task.dueDate && <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>{task.dueDate}</div>}
      </div>
    </div>
  )
}
