import { useState, useMemo, useEffect, useCallback } from 'react'
import { DndContext, useDroppable, useDraggable, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import useStore from '../../hooks/useStore'
import { getCachedUserId } from '../../hooks/useStore'
import { getColor, CATEGORIES } from '../../utils/colors'
import InlineAdd from '../shared/InlineAdd'
import MSBadge from '../common/MSBadge'

/* ═══════════════════════════════════════════════════════
   PersonalMatrixView — 개인 매트릭스
   행=프로젝트, 열=카테고리(오늘/다음/나중/완료)
   scope="personal" — 내가 owner/assignee인 할일만
   ═══════════════════════════════════════════════════════ */

const CAT_COLS = [
  { key: 'today', label: '오늘', emoji: '🔴' },
  { key: 'next', label: '다음', emoji: '🟡' },
  { key: 'later', label: '나중', emoji: '🔵' },
]

export default function PersonalMatrixView() {
  const { projects, tasks, moveTaskTo, reorderTasks, collapseState, toggleCollapse: storeToggle, sortProjectsLocally } = useStore()
  const isMobile = window.innerWidth < 768
  const userId = getCachedUserId()
  const milestones = useStore(s => s.milestones)
  const [showMs, setShowMs] = useState(false)

  const msMap = useMemo(() => {
    const m = {}
    milestones.forEach(ms => { m[ms.id] = ms })
    return m
  }, [milestones])

  const collapsed = collapseState.personalMatrix || {}
  const toggleCollapse = (pid) => storeToggle('personalMatrix', pid)

  // 내 할일만 필터
  const myTasks = useMemo(() =>
    tasks.filter(t => t.assigneeId === userId || t.createdBy === userId),
    [tasks, userId]
  )

  // 내 할일이 있는 프로젝트만
  const allProjects = sortProjectsLocally(projects)
  const projectsWithTasks = useMemo(() => {
    const projIds = new Set(myTasks.map(t => t.projectId))
    return allProjects.filter(p => projIds.has(p.id))
  }, [allProjects, myTasks])

  // DnD
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)
  const [activeId, setActiveId] = useState(null)
  const activeTask = activeId ? myTasks.find(t => t.id === activeId) : null

  const handleDragStart = (e) => setActiveId(e.active.id)
  const handleDragEnd = (e) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const task = myTasks.find(t => t.id === active.id)
    if (!task) return
    const overId = over.id
    // Drop on category zone: projectId:category
    if (typeof overId === 'string' && overId.includes(':')) {
      const [targetProjectId, targetCategory] = overId.split(':')
      if (task.projectId === targetProjectId && task.category === targetCategory) return
      moveTaskTo(active.id, targetProjectId, targetCategory)
    }
  }

  const dd = new Date()
  const dateStr = `${dd.getFullYear()}년 ${dd.getMonth() + 1}월 ${dd.getDate()}일 ${['일', '월', '화', '수', '목', '금', '토'][dd.getDay()]}요일`

  // 카테고리별 통계
  const catCounts = useMemo(() => {
    const c = {}
    CAT_COLS.forEach(cat => { c[cat.key] = myTasks.filter(t => t.category === cat.key && !t.done).length })
    c.done = myTasks.filter(t => t.done).length
    return c
  }, [myTasks])

  useEffect(() => {
    const handler = () => {
      setTimeout(() => {
        const el = document.querySelector('[data-view="personal-matrix"] input[type="text"], [data-view="personal-matrix"] input:not([type])')
        el?.focus()
      }, 50)
    }
    window.addEventListener('view-focus', handler)
    return () => window.removeEventListener('view-focus', handler)
  }, [])

  return (
    <div data-view="personal-matrix" style={{ padding: isMobile ? '20px 0 100px' : '40px 48px' }}>
      <div>
        {/* Header */}
        <div style={{ marginBottom: 24, padding: isMobile ? '0 16px' : 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#37352f', margin: 0, letterSpacing: '-0.02em' }}>개인 매트릭스</h1>
            <p style={{ fontSize: 14, color: '#999', marginTop: 4 }}>{dateStr}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: '#999' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={showMs} onChange={e => setShowMs(e.target.checked)} style={{ accentColor: '#37352f' }} />
              MS 뱃지
            </label>
          </div>
        </div>

        {/* 요약 */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, padding: isMobile ? '0 16px' : 0, fontSize: 12, color: '#999' }}>
          <span>전체: <b style={{ color: '#37352f' }}>{myTasks.filter(t => !t.done).length}</b>건</span>
          {CAT_COLS.map(cat => (
            <span key={cat.key}>{cat.label}: <b style={{ color: '#37352f' }}>{catCounts[cat.key]}</b></span>
          ))}
          <span style={{ color: '#bbb' }}>완료: {catCounts.done}</span>
        </div>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ overflowX: 'auto', padding: isMobile ? '0 12px' : 0 }}>
            {/* Grid header */}
            <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${CAT_COLS.length}, 1fr)`, gap: 0, border: '0.5px solid #e8e6df', borderRadius: '10px 10px 0 0', overflow: 'hidden' }}>
              <div style={{ padding: '8px 10px', background: '#fafaf8', borderBottom: '1px solid #e8e6df', borderRight: '0.5px solid #e8e6df', fontSize: 11, fontWeight: 600, color: '#a09f99' }}>
                프로젝트
              </div>
              {CAT_COLS.map(cat => (
                <div key={cat.key} style={{
                  padding: '8px 10px', background: '#fafaf8', borderBottom: '1px solid #e8e6df', borderRight: '0.5px solid #e8e6df',
                  fontSize: 11, fontWeight: 600,
                  color: cat.key === 'today' ? '#ef4444' : cat.key === 'next' ? '#37352f' : '#a09f99',
                }}>
                  {cat.emoji} {cat.label}
                  <span style={{ fontSize: 10, color: '#a09f99', marginLeft: 6 }}>{catCounts[cat.key]}</span>
                </div>
              ))}
            </div>

            {/* Project rows */}
            <div style={{ border: '0.5px solid #e8e6df', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
              {projectsWithTasks.map(proj => {
                const c = getColor(proj.color)
                const projTasks = myTasks.filter(t => t.projectId === proj.id && !t.done)
                return (
                  <div key={proj.id} style={{ display: 'grid', gridTemplateColumns: `140px repeat(${CAT_COLS.length}, 1fr)` }}>
                    {/* Project label */}
                    <div style={{
                      padding: '8px 10px', borderBottom: '0.5px solid #e8e6df', borderRight: '0.5px solid #e8e6df',
                      display: 'flex', alignItems: 'flex-start', gap: 6, background: `${c.dot}04`,
                    }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0, marginTop: 3 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#37352f' }}>{proj.name}</div>
                        <div style={{ fontSize: 10, color: '#a09f99' }}>{projTasks.length}건</div>
                      </div>
                    </div>

                    {/* Category cells */}
                    {CAT_COLS.map(cat => {
                      const cellTasks = myTasks.filter(t => t.projectId === proj.id && t.category === cat.key && !t.done)
                      const dropId = `${proj.id}:${cat.key}`
                      return (
                        <CellDrop key={dropId} id={dropId}>
                          <div style={{ padding: '4px 4px', borderBottom: '0.5px solid #e8e6df', borderRight: '0.5px solid #e8e6df', minHeight: 50 }}>
                            {cellTasks.length === 0 ? (
                              <span style={{ fontSize: 10, color: '#e0e0e0', padding: '8px', display: 'block' }}>—</span>
                            ) : cellTasks.map(t => (
                              <DraggableTask key={t.id} task={t} showMs={showMs} msMap={msMap} />
                            ))}
                            <div style={{ padding: '2px 8px' }}>
                              <InlineAdd projectId={proj.id} category={cat.key} color={c} compact />
                            </div>
                          </div>
                        </CellDrop>
                      )
                    })}
                  </div>
                )
              })}

              {/* Empty state */}
              {projectsWithTasks.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13, gridColumn: '1 / -1' }}>
                  배정된 할일이 없습니다. 팀 매트릭스에서 할일을 배정받거나, + 추가로 직접 생성하세요.
                </div>
              )}
            </div>
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeTask && (
              <div style={{ background: '#fff', borderRadius: 5, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: '4px 8px', fontSize: 11, color: '#37352f', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeTask.text}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}

function CellDrop({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} style={{ background: isOver ? '#f0efeb' : 'transparent', transition: 'background 0.1s' }}>
      {children}
    </div>
  )
}

function DraggableTask({ task, showMs, msMap }) {
  const { openDetail } = useStore()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => openDetail(task)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '3px 6px', marginBottom: 1,
        borderRadius: 4, cursor: 'grab', transition: 'background 0.1s',
        opacity: isDragging ? 0.3 : 1,
      }}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.background = '#f5f4f0' }}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{
        flex: 1, fontSize: 11, color: task.done ? '#a09f99' : '#37352f', lineHeight: 1.3,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textDecoration: task.done ? 'line-through' : 'none',
      }}>
        {task.text}
      </span>
      {showMs && task.milestoneId && msMap[task.milestoneId] && (
        <MSBadge ms={msMap[task.milestoneId]} size="xs" />
      )}
      {task.dueDate && <span style={{ fontSize: 9, color: '#a09f99', flexShrink: 0 }}>{task.dueDate.slice(5)}</span>}
    </div>
  )
}
