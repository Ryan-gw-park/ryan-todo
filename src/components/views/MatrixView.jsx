import { useState } from 'react'
import { DndContext, useDraggable, useDroppable, pointerWithin } from '@dnd-kit/core'
import useStore from '../../hooks/useStore'
import { getColor, CATEGORIES } from '../../utils/colors'
import { SettingsIcon, CheckIcon, UndoIcon } from '../shared/Icons'
import InlineAdd from '../shared/InlineAdd'

export default function MatrixView() {
  const { projects, tasks, setShowProjectMgr, moveTaskTo } = useStore()
  const isMobile = window.innerWidth < 768
  const LW = isMobile ? 80 : 108
  const COL_GAP = isMobile ? 8 : 10
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
    // over.id format: "projectId:category"
    const [targetProjectId, targetCategory] = over.id.split(':')
    const task = tasks.find(t => t.id === active.id)
    if (!task) return
    if (task.projectId === targetProjectId && task.category === targetCategory) return
    moveTaskTo(active.id, targetProjectId, targetCategory)
  }

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
            <div style={{ display: 'flex', gap: COL_GAP, minWidth: isMobile ? LW + projects.length * (COL_MIN + COL_GAP) : 'auto' }}>

              {/* Category label column */}
              <div style={{ width: LW, flexShrink: 0, ...(isMobile ? { position: 'sticky', left: 0, zIndex: 4, background: 'white' } : {}) }}>
                <div style={{ height: 52 }} />
                {CATEGORIES.map(cat => {
                  const isDone = cat.key === 'done'
                  return (
                    <div key={cat.key} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 14, paddingRight: 8, minHeight: isDone ? 50 : 90, alignSelf: 'flex-start' }}>
                      <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{cat.emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isDone ? '#999' : '#555', lineHeight: 1.3, whiteSpace: 'nowrap' }}>{cat.label}</span>
                    </div>
                  )
                })}
              </div>

              {/* Project columns */}
              {projects.map(p => {
                const c = getColor(p.color)
                const pt = tasks.filter(t => t.projectId === p.id)

                return (
                  <div key={p.id} style={{ flex: 1, minWidth: COL_MIN, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', background: 'white' }}>
                    {/* Project header */}
                    <div style={{ background: c.header, borderBottom: `2.5px solid ${c.dot}`, padding: isMobile ? '10px 10px' : '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52, boxSizing: 'border-box' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: c.dot, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: c.text, whiteSpace: 'nowrap' }}>{p.name}</span>
                      </div>
                      <span style={{ fontSize: 11, color: c.text, background: 'rgba(255,255,255,0.55)', borderRadius: 10, padding: '1px 8px', fontWeight: 600, flexShrink: 0 }}>{pt.length}</span>
                    </div>

                    {/* Category sections inside column */}
                    {CATEGORIES.map((cat, ri) => {
                      const isDoneRow = cat.key === 'done'
                      const catTasks = tasks.filter(t => t.projectId === p.id && t.category === cat.key)
                      const isCollapsed = isDoneRow && doneCollapsed[p.id] !== false && catTasks.length > 0

                      return (
                        <CategoryDropZone key={cat.key} id={`${p.id}:${cat.key}`} color={c} isDone={isDoneRow} isLast={ri === CATEGORIES.length - 1} activeId={activeId}>
                          {/* Category sub-label */}
                          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: isDoneRow ? '#ccc' : c.dot, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: isDoneRow ? '#aaa' : c.text }}>{cat.shortLabel || cat.label}</span>
                            <span style={{ fontSize: 10, color: isDoneRow ? '#bbb' : c.dot, fontWeight: 600 }}>{catTasks.length}</span>
                            {isDoneRow && catTasks.length > 0 && (
                              <button onClick={() => setDoneCollapsed(prev => ({ ...prev, [p.id]: !isCollapsed }))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 10, fontFamily: 'inherit', padding: '0 4px' }}>
                                {isCollapsed ? '펼치기' : '접기'}
                              </button>
                            )}
                          </div>

                          <div style={{ minHeight: 20 }}>
                            {isDoneRow && isCollapsed
                              ? <div style={{ fontSize: 11, color: '#ccc', padding: '2px 0' }}>완료 {catTasks.length}건</div>
                              : catTasks.map(task => <MatrixCard key={task.id} task={task} color={c} isDone={isDoneRow} />)
                            }
                          </div>
                          {!isDoneRow && <InlineAdd projectId={p.id} category={cat.key} color={c} />}
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
function CategoryDropZone({ id, color, isDone, isLast, activeId, children }) {
  const { isOver, setNodeRef } = useDroppable({ id })
  const showHighlight = isOver && activeId

  return (
    <div
      ref={setNodeRef}
      style={{
        padding: '10px 14px',
        background: showHighlight ? `${color.header}` : isDone ? '#fcfcfc' : 'white',
        borderBottom: isLast ? 'none' : '1px dashed rgba(0,0,0,0.06)',
        minHeight: isDone ? 44 : 80,
        transition: 'background 0.15s',
        ...(showHighlight ? { outline: `2px dashed ${color.dot}`, outlineOffset: -2, borderRadius: 4 } : {}),
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
    background: 'white',
    borderRadius: 8,
    padding: '10px 12px',
    border: '1px solid #e8e8e8',
    boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,0.12)' : '0 1px 2px rgba(0,0,0,0.04)',
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
      onMouseLeave={e => { if (!isDragging) e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)' }}
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
