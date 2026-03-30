import { useState, useMemo, useEffect, useCallback } from 'react'
import { COLOR, FONT, SPACE, VIEW_WIDTH } from '../../styles/designTokens'
import { DndContext, useDroppable, useDraggable, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import useStore from '../../hooks/useStore'
import { getCachedUserId } from '../../hooks/useStore'
import { getColor, CATEGORIES } from '../../utils/colors'
import InlineAdd from '../shared/InlineAdd'
import MSBadge from '../common/MSBadge'
import MsBacklogSidebar from '../common/MsBacklogSidebar'

/* ═══════════════════════════════════════════════════════
   PersonalMatrixView — 개인 매트릭스
   행=프로젝트, 열=카테고리(오늘/다음/나중/완료)
   scope="personal" — 내가 owner/assignee인 할일만
   ═══════════════════════════════════════════════════════ */

const CAT_COLS = [
  { key: 'today', label: '지금 할일', dot: '#E53E3E' },
  { key: 'next', label: '다음', dot: '#D69E2E' },
  { key: 'later', label: '나중', dot: '#3182CE' },
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
    <div data-view="personal-matrix" style={{ padding: isMobile ? SPACE.viewPaddingMobile : SPACE.viewPadding }}>
      <div style={{ maxWidth: VIEW_WIDTH.wide, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24, padding: isMobile ? '0 16px' : 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: FONT.viewTitle, fontWeight: 700, color: COLOR.textPrimary, margin: 0, letterSpacing: '-0.02em' }}>개인 매트릭스</h1>
            <p style={{ fontSize: FONT.subtitle, color: COLOR.textTertiary, marginTop: 4 }}>{dateStr}</p>
          </div>
          <div style={{ display: 'flex', gap: 2, background: '#f5f4f0', borderRadius: 7, padding: 2 }}>
            <button onClick={() => setShowMs(false)} style={{
              border: 'none', borderRadius: 5, padding: '4px 14px', fontSize: FONT.caption, fontFamily: 'inherit', cursor: 'pointer',
              fontWeight: !showMs ? 600 : 400, background: !showMs ? '#fff' : 'transparent',
              color: !showMs ? COLOR.textPrimary : COLOR.textTertiary,
              boxShadow: !showMs ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}>할일 모드</button>
            <button onClick={() => setShowMs(true)} style={{
              border: 'none', borderRadius: 5, padding: '4px 14px', fontSize: FONT.caption, fontFamily: 'inherit', cursor: 'pointer',
              fontWeight: showMs ? 600 : 400, background: showMs ? '#fff' : 'transparent',
              color: showMs ? COLOR.textPrimary : COLOR.textTertiary,
              boxShadow: showMs ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}>MS 배정</button>
          </div>
        </div>

        {/* 요약 */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, padding: isMobile ? '0 16px' : 0, fontSize: FONT.label, color: COLOR.textTertiary }}>
          <span>전체: <b style={{ color: COLOR.textPrimary }}>{myTasks.filter(t => !t.done).length}</b>건</span>
          {CAT_COLS.map(cat => (
            <span key={cat.key}>{cat.label}: <b style={{ color: COLOR.textPrimary }}>{catCounts[cat.key]}</b></span>
          ))}
          <span style={{ color: '#bbb' }}>완료: {catCounts.done}</span>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ flex: 1, overflowX: 'auto', padding: isMobile ? '0 12px' : 0 }}>
            {/* Grid header */}
            <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${CAT_COLS.length}, 1fr)`, gap: 0, border: '0.5px solid #e8e6df', borderRadius: '10px 10px 0 0', overflow: 'hidden' }}>
              <div style={{ padding: '8px 10px', background: COLOR.bgSurface, borderBottom: `1px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`, fontSize: FONT.caption, fontWeight: 600, color: COLOR.textTertiary }}>
                프로젝트
              </div>
              {CAT_COLS.map(cat => (
                <div key={cat.key} style={{
                  padding: '8px 10px', background: COLOR.bgSurface, borderBottom: `1px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`,
                  fontSize: FONT.caption, fontWeight: 600,
                  color: cat.key === 'today' ? COLOR.danger : cat.key === 'next' ? COLOR.textPrimary : COLOR.textTertiary,
                }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: cat.dot, marginRight: 4, verticalAlign: 'middle' }} />
                  {cat.label}
                  <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary, marginLeft: 6 }}>{catCounts[cat.key]}</span>
                </div>
              ))}
            </div>

            {/* Project rows */}
            <div style={{ border: '0.5px solid #e8e6df', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
              {projectsWithTasks.map(proj => {
                const c = getColor(proj.color)
                const projTasks = myTasks.filter(t => t.projectId === proj.id && !t.done)
                const isCollapsed = collapsed[proj.id]
                return (
                  <div key={proj.id}>
                    {/* Project header — clickable to collapse */}
                    <div
                      onClick={() => toggleCollapse(proj.id)}
                      style={{ display: 'grid', gridTemplateColumns: `140px repeat(${CAT_COLS.length}, 1fr)`, cursor: 'pointer' }}
                    >
                      <div style={{
                        padding: '8px 10px', borderBottom: `0.5px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`,
                        display: 'flex', alignItems: 'center', gap: 5, background: `${c.dot}04`,
                      }}>
                        <span style={{ fontSize: 12, color: COLOR.textTertiary, width: 14, textAlign: 'center', transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', flexShrink: 0 }}>▾</span>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                        <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary, flex: 1 }}>{proj.name}</span>
                        <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{projTasks.length}건</span>
                      </div>
                      {/* Collapsed summary per category */}
                      {CAT_COLS.map(cat => {
                        const count = myTasks.filter(t => t.projectId === proj.id && t.category === cat.key && !t.done).length
                        return (
                          <div key={cat.key} style={{
                            padding: '8px 10px', borderBottom: `0.5px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`,
                            fontSize: 10, color: COLOR.textTertiary, background: `${c.dot}04`,
                          }}>
                            {isCollapsed ? (count > 0 ? `${count}건` : '—') : ''}
                          </div>
                        )
                      })}
                    </div>

                    {/* Expanded: task cells */}
                    {!isCollapsed && (
                      <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${CAT_COLS.length}, 1fr)` }}>
                        <div style={{ borderBottom: `0.5px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}` }} />
                        {CAT_COLS.map(cat => {
                          const cellTasks = myTasks.filter(t => t.projectId === proj.id && t.category === cat.key && !t.done)
                          const dropId = `${proj.id}:${cat.key}`
                          return (
                            <CellDrop key={dropId} id={dropId}>
                              <div style={{ padding: '6px 8px', borderBottom: `0.5px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`, minHeight: 36 }}>
                                {cellTasks.length === 0 ? (
                                  <span style={{ fontSize: 10, color: '#e0e0e0' }}>—</span>
                                ) : cellTasks.map(t => (
                                  <DraggableTask key={t.id} task={t} showMs={showMs} msMap={msMap} />
                                ))}
                                <div style={{ paddingLeft: 19, marginTop: 2 }}>
                                  <InlineAdd projectId={proj.id} category={cat.key} color={c} compact />
                                </div>
                              </div>
                            </CellDrop>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Empty state */}
              {projectsWithTasks.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body, gridColumn: '1 / -1' }}>
                  배정된 할일이 없습니다. 팀 매트릭스에서 할일을 배정받거나, + 추가로 직접 생성하세요.
                </div>
              )}
            </div>
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeTask && (
              <div style={{ background: '#fff', borderRadius: 5, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: '4px 8px', fontSize: FONT.body, color: COLOR.textPrimary, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeTask.text}
              </div>
            )}
          </DragOverlay>
        </DndContext>
        <MsBacklogSidebar projects={projects} milestones={milestones} tasks={tasks} />
        </div>
      </div>
    </div>
  )
}

function CellDrop({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} style={{ background: isOver ? COLOR.bgActive : 'transparent', transition: 'background 0.1s' }}>
      {children}
    </div>
  )
}

function DraggableTask({ task, showMs, msMap }) {
  const { openDetail, toggleDone } = useStore()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => openDetail(task)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 5, padding: '3px 6px', marginBottom: 1,
        borderRadius: 4, cursor: 'grab', transition: 'background 0.1s',
        opacity: isDragging ? 0.3 : 1,
      }}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.background = COLOR.bgHover }}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div onClick={e => { e.stopPropagation(); e.preventDefault(); toggleDone(task.id) }} style={{
        width: 14, height: 14, borderRadius: 3, flexShrink: 0, cursor: 'pointer', marginTop: 1,
        border: task.done ? 'none' : `1.5px solid #c8c7c1`,
        background: task.done ? '#22c55e' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {task.done && <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>
      <span style={{
        flex: 1, fontSize: FONT.body, color: task.done ? COLOR.textTertiary : COLOR.textPrimary, lineHeight: 1.4,
        textDecoration: task.done ? 'line-through' : 'none',
      }}>
        {task.text}
      </span>
      {showMs && task.keyMilestoneId && msMap[task.keyMilestoneId] && (
        <MSBadge ms={msMap[task.keyMilestoneId]} size="xs" />
      )}
      {task.dueDate && <span style={{ fontSize: FONT.ganttMs, color: COLOR.textTertiary, flexShrink: 0 }}>{task.dueDate.slice(5)}</span>}
    </div>
  )
}
