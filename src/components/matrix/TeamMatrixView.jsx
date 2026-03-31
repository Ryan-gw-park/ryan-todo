import { useState, useCallback, useEffect } from 'react'
import { COLOR, FONT, SPACE, VIEW_WIDTH } from '../../styles/designTokens'
import { DndContext, DragOverlay, useDroppable, PointerSensor, TouchSensor, useSensors, useSensor, pointerWithin, rectIntersection } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import useStore from '../../hooks/useStore'
import { getCachedUserId } from '../../hooks/useStore'
import useMatrixConfig from '../../hooks/useMatrixConfig'
import useTeamMembers from '../../hooks/useTeamMembers'
import { getDb } from '../../utils/supabase'
import { getColor } from '../../utils/colors'
import { SettingsIcon, CheckIcon } from '../shared/Icons'
import { parseDateFromText } from '../../utils/dateParser'
import InlineAdd from '../shared/InlineAdd'
import ColorPicker from '../shared/ColorPicker'
import RowConfigSettings from '../shared/RowConfigSettings'
import useProjectFilter from '../../hooks/useProjectFilter'
import UniversalCard from '../common/UniversalCard'
import MsBacklogSidebar from '../common/MsBacklogSidebar'


// Custom collision: pointerWithin → prefer task cards for reorder, fall back to category zone for cross-cell
function matrixCollision(args) {
  const pw = pointerWithin(args)
  if (pw.length > 0) {
    // Prefer specific task card (for same-cell reorder); if none, use category zone
    const task = pw.find(c => typeof c.id === 'string' && !c.id.includes(':') && !c.id.startsWith('member:'))
    if (task) return [task]
    const zone = pw.find(c => typeof c.id === 'string' && c.id.includes(':'))
    if (zone) return [zone]
    return pw
  }
  return rectIntersection(args)
}

const HIGHLIGHT_COLORS = {
  red:    { bg: '#E53E3E' },
  orange: { bg: '#DD6B20' },
  yellow: { bg: '#D69E2E' },
  blue:   { bg: '#3182CE' },
  green:  { bg: '#38A169' },
  purple: { bg: '#805AD5' },
}

export default function TeamMatrixView() {
  const { projects, tasks, currentTeamId, setShowProjectMgr, updateTask, reorderTasks, collapseState, toggleCollapse: storeToggle } = useStore()
  const myRole = useStore(s => s.myRole)
  const isOwner = myRole === 'owner'
  const isMobile = window.innerWidth < 768

  const [members, setMembers] = useState([])

  const milestones = useStore(s => s.milestones)

  // Column collapse (shared with original MatrixView via store)
  const collapsed = collapseState.matrix || {}
  const toggleCollapse = (pid) => storeToggle('matrix', pid)

  // DnD
  const [activeId, setActiveId] = useState(null)
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)
  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null

  // Lane names: display_name + team name (must be before defaultConfig)
  const userName = useStore(s => s.userName) || '나'
  const currentTeam = useStore(s => s.myTeams.find(t => t.id === s.currentTeamId))
  const teamName = currentTeam?.name || '팀'

  // 즉시 렌더링을 위한 기본 config (DB 로드 전까지 사용)
  const cachedUid = getCachedUserId()
  const defaultConfig = [
    { id: '_me', section: 'me', label: userName, row_type: 'section_header', sort_order: 0, is_collapsed: false },
    { id: '_me_today', section: 'me_today', label: '지금 할일', row_type: 'task_row', sort_order: 1, parent_section: 'me' },
    { id: '_me_next', section: 'me_next', label: '다음 할일', row_type: 'task_row', sort_order: 2, parent_section: 'me' },
    { id: '_team', section: 'team', label: teamName, row_type: 'section_header', sort_order: 3, is_collapsed: false },
    { id: '_remaining', section: 'remaining', label: '미배정', row_type: 'remaining', sort_order: 90 },
    { id: '_completed', section: 'completed', label: '완료', row_type: 'completed', sort_order: 99, is_collapsed: true },
  ]

  const [config, setConfig] = useState(defaultConfig)
  const [userId, setUserId] = useState(cachedUid)
  const [showRowConfig, setShowRowConfig] = useState(false)

  const dd = new Date()
  const dateStr = `${dd.getFullYear()}년 ${dd.getMonth()+1}월 ${dd.getDate()}일 ${['일','월','화','수','목','금','토'][dd.getDay()]}요일`

  // 백그라운드로 실제 config 로드
  useEffect(() => {
    if (!currentTeamId) return
    let cancelled = false
    ;(async () => {
      const supabase = getDb()
      if (!supabase) return
      let uid = cachedUid
      if (!uid) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        uid = user.id
      }
      if (!cancelled) setUserId(uid)
      const [fetchedMembers, existingCfg] = await Promise.all([
        useTeamMembers.getMembers(currentTeamId),
        useMatrixConfig.getConfig(uid, currentTeamId),
      ])
      if (cancelled) return
      setMembers(fetchedMembers) // Loop-38: store members for sub-views
      let cfg = existingCfg
      if (cfg.length === 0) {
        cfg = await useMatrixConfig.initConfig(uid, currentTeamId, fetchedMembers)
      }
      if (!cancelled) setConfig(cfg)
      useMatrixConfig.syncMembers(uid, currentTeamId, fetchedMembers).then(async () => {
        if (!cancelled) {
          const refreshed = await useMatrixConfig.getConfig(uid, currentTeamId)
          setConfig(refreshed)
        }
      })
    })()
    return () => { cancelled = true }
  }, [currentTeamId])

  // view-focus: 탭 전환 시 첫 input 자동 포커스
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

  // DnD handlers
  const handleDragStart = (e) => setActiveId(e.active.id)

  const handleDragEnd = (e) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const task = tasks.find(t => t.id === active.id)
    if (!task) return
    const overId = over.id

    // ── 셀 drop zone (projectId:memberId) ──
    if (typeof overId === 'string' && overId.includes(':')) {
      const [targetProjectId, targetMemberId] = overId.split(':')
      if (task.projectId === targetProjectId && task.assigneeId === targetMemberId) return

      const patch = {
        projectId: targetProjectId,
        assigneeId: targetMemberId,
        scope: 'assigned',
      }
      if (task.done) patch.done = false

      updateTask(active.id, patch)
      return
    }

    // ── 다른 task 위에 drop ──
    const overTask = tasks.find(t => t.id === overId)
    if (!overTask) return

    if (task.projectId === overTask.projectId && task.assigneeId === overTask.assigneeId) {
      // Same cell: reorder
      const cellTasks = tasks
        .filter(t => t.projectId === task.projectId && t.assigneeId === task.assigneeId && !t.done)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      const oldIndex = cellTasks.findIndex(t => t.id === active.id)
      const newIndex = cellTasks.findIndex(t => t.id === overId)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        reorderTasks(arrayMove(cellTasks, oldIndex, newIndex))
      }
    } else {
      // Cross-cell: 대상 task의 project + assignee로 이동
      const patch = {
        projectId: overTask.projectId,
        assigneeId: overTask.assigneeId,
        scope: 'assigned',
      }
      if (task.done) patch.done = false
      updateTask(active.id, patch)
    }
  }

  // Group config rows

  // Loop-20.2: 전역 필터 적용
  const { filteredProjects, filteredTasks: _ft } = useProjectFilter(projects, tasks)

  // 프로젝트 열 — 팀 모드에서는 팀 프로젝트만 표시 (개인 프로젝트 제외)
  const allColumns = currentTeamId
    ? filteredProjects.filter(p => p.teamId === currentTeamId)
    : filteredProjects

  // teamId 로딩 전 guard — 모든 hooks 이후에 위치 (Rules of Hooks 준수)
  if (!currentTeamId) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>
        팀을 선택하세요. 사이드바에서 팀을 전환할 수 있습니다.
      </div>
    )
  }

  // members 로딩 전 guard — 그리드 열이 0개면 빈 화면 방지
  if (members.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>
        팀원 정보를 불러오는 중...
      </div>
    )
  }


  return (
    <div data-view="matrix" style={{ padding: isMobile ? SPACE.viewPaddingMobile : SPACE.viewPadding }}>
      <div style={{ maxWidth: VIEW_WIDTH.wide, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32, padding: isMobile ? '0 16px' : 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: FONT.viewTitle, fontWeight: 700, color: COLOR.textPrimary, margin: 0, letterSpacing: '-0.02em' }}>팀 매트릭스</h1>
              <p style={{ fontSize: FONT.subtitle, color: COLOR.textTertiary, marginTop: 4 }}>{dateStr}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setShowRowConfig(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: `1px solid ${COLOR.border}`, background: 'white', cursor: 'pointer', color: COLOR.textSecondary, fontSize: FONT.label, fontFamily: 'inherit', fontWeight: 500, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = COLOR.textTertiary; e.currentTarget.style.color = COLOR.textPrimary }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = COLOR.border; e.currentTarget.style.color = COLOR.textSecondary }}
            >
              <SettingsIcon /> 뷰 관리
            </button>
          </div>
        </div>


        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <DndContext sensors={sensors} collisionDetection={matrixCollision} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '0 12px' : 0 }}>
            <div style={{ border: `1px solid ${COLOR.border}`, borderRadius: 10, overflow: 'hidden' }}>
              {/* ── Column header: 프로젝트 | 팀원... ── */}
              <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(${members.length}, 1fr)` }}>
                <div style={{ padding: '8px 10px', background: COLOR.bgSurface, borderBottom: `1px solid ${COLOR.border}`, borderRight: `1px solid ${COLOR.border}`, fontSize: FONT.caption, fontWeight: 600, color: COLOR.textTertiary }}>
                  프로젝트
                </div>
                {members.map(mem => (
                  <div key={mem.id} style={{ padding: '8px 10px', background: COLOR.bgSurface, borderBottom: `1px solid ${COLOR.border}`, borderRight: `1px solid ${COLOR.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MemberAvatar name={mem.displayName || mem.name} size={20} />
                    <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary }}>{mem.displayName || mem.name}</span>
                  </div>
                ))}
              </div>

              {/* ── Project rows (1줄 병합) ── */}
              {allColumns.map(proj => {
                const c = getColor(proj.color)
                const projTasks = tasks.filter(t => t.projectId === proj.id && !t.done && t.teamId === currentTeamId)
                const isCollapsed = collapsed[proj.id]

                return (
                  <div key={proj.id} style={{ display: 'grid', gridTemplateColumns: `160px repeat(${members.length}, 1fr)` }}>
                    {/* Left: project name + toggle */}
                    <div
                      onClick={() => toggleCollapse(proj.id)}
                      style={{
                        padding: '8px 10px', borderBottom: `1px solid ${COLOR.border}`, borderRight: `1px solid ${COLOR.border}`,
                        display: 'flex', alignItems: isCollapsed ? 'center' : 'flex-start', gap: 5,
                        background: `${c.dot}04`, cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 9, color: COLOR.textTertiary, width: 12, textAlign: 'center', transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', flexShrink: 0 }}>▾</span>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0, marginTop: isCollapsed ? 0 : 2 }} />
                      <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary, flex: 1 }}>{proj.name}</span>
                      <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{projTasks.length}건</span>
                    </div>
                    {/* Right cells: collapsed=count, expanded=tasks */}
                    {members.map(mem => {
                      const cellTasks = projTasks.filter(t => t.assigneeId === mem.userId)
                        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                      const dropId = `${proj.id}:${mem.userId}`
                      return isCollapsed ? (
                        <div key={mem.id} style={{
                          padding: '8px 10px', borderBottom: `1px solid ${COLOR.border}`, borderRight: `1px solid ${COLOR.border}`,
                          fontSize: FONT.tiny, color: COLOR.textTertiary, background: `${c.dot}04`,
                          display: 'flex', alignItems: 'center',
                        }}>
                          {cellTasks.length > 0 ? `${cellTasks.length}건` : '—'}
                        </div>
                      ) : (
                        <CategoryDropZone
                          key={mem.id}
                          id={dropId}
                          color={c}
                          activeId={activeId}
                          style={{ padding: '6px 10px', borderBottom: `1px solid ${COLOR.border}`, borderRight: `1px solid ${COLOR.border}`, minHeight: 36 }}
                        >
                          {cellTasks.length === 0 ? (
                            <span style={{ fontSize: FONT.tiny, color: '#e0e0e0' }}>—</span>
                          ) : (
                            <SortableContext items={cellTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                              {cellTasks.map(t => (
                                <TeamMatrixCard key={t.id} task={t} readOnly={mem.userId !== userId && !isOwner} />
                              ))}
                            </SortableContext>
                          )}
                          <InlineAdd
                            projectId={proj.id}
                            category="today"
                            color={c}
                            extraFields={{ scope: 'assigned', assigneeId: mem.userId }}
                            compact
                          />
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
        <MsBacklogSidebar projects={filteredProjects} milestones={milestones} tasks={tasks} />
        </div>

      {/* Row Config Settings Modal */}
      {showRowConfig && userId && (
        <RowConfigSettings
          userId={userId}
          teamId={currentTeamId}
          showProjectMgr={() => setShowProjectMgr(true)}
          onClose={async () => {
            setShowRowConfig(false)
            const cfg = await useMatrixConfig.getConfig(userId, currentTeamId)
            setConfig(cfg)
          }}
        />
      )}
      </div>
    </div>
  )
}

/* ═══ Category Drop Zone — droppable cell ═══ */
function CategoryDropZone({ id, color, activeId, style: cellStyle, children }) {
  const { isOver, setNodeRef } = useDroppable({ id })
  const showHighlight = isOver && activeId

  return (
    <div ref={setNodeRef} style={{
      ...cellStyle, display: 'flex', flexDirection: 'column', transition: 'background 0.08s',
      ...(showHighlight ? { background: color.header, outline: `2px dashed ${color.dot}`, outlineOffset: -2 } : {}),
    }}>
      {children}
    </div>
  )
}

/* ═══ Team Matrix Card — DnD + highlight color + mobile menu ═══ */
function TeamMatrixCard({ task, readOnly, isDone }) {
  const { toggleDone, updateTask, openDetail } = useStore()
  const isMobile = window.innerWidth < 768

  // DnD (only for editable cards)
  const { attributes, listeners, setNodeRef, transform, transition: sortTransition, isDragging } = useSortable({ id: task.id, disabled: readOnly, transition: { duration: 120, easing: 'ease' } })

  const [showColorPicker, setShowColorPicker] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const handleTitleSave = useCallback((text) => {
    const { startDate, dueDate } = parseDateFromText(text)
    const patch = { text }
    if (startDate) patch.startDate = startDate
    if (dueDate) patch.dueDate = dueDate
    updateTask(task.id, patch)
  }, [task.id, updateTask])

  // Highlight color override
  const hlColorKey = useStore.getState().getHighlightColor(task.id)
  const hlColor = hlColorKey && HIGHLIGHT_COLORS[hlColorKey]

  const handleContextMenu = (e) => {
    if (readOnly) return
    e.preventDefault()
    setShowColorPicker(true)
  }

  return (
    <div onContextMenu={handleContextMenu} style={{ position: 'relative' }}>
      {/* Color picker popover */}
      {showColorPicker && (
        <ColorPicker
          taskId={task.id}
          currentColor={hlColorKey}
          onClose={() => setShowColorPicker(false)}
          style={{ top: -36, right: 0 }}
        />
      )}

      <UniversalCard
        type="task"
        data={{ id: task.id, name: task.text, done: task.done }}
        expanded={expanded}
        onToggleExpand={() => setExpanded(v => !v)}
        onTitleSave={!readOnly ? handleTitleSave : undefined}
        onStatusToggle={!readOnly ? () => toggleDone(task.id) : undefined}
        onDetailOpen={() => openDetail(task)}
        dragRef={!readOnly ? setNodeRef : undefined}
        dragStyle={{
          transition: isDragging ? 'none' : [sortTransition, 'box-shadow 0.15s'].filter(Boolean).join(', '),
          transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
          zIndex: isDragging ? 100 : undefined,
        }}
        dragListeners={!readOnly && !isMobile ? listeners : undefined}
        dragAttributes={!readOnly ? attributes : undefined}
        isDragging={isDragging}
        style={{
          background: hlColor ? hlColor.bg : '#ffffff',
          borderRadius: 8,
          padding: '4px 6px',
          border: hlColor ? 'none' : '1px solid rgba(0,0,0,0.06)',
          boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,0.12)' : '0 1px 2px rgba(0,0,0,0.03)',
          marginBottom: 6,
          opacity: isDone ? 0.5 : undefined,
          ...(hlColor ? { color: '#fff' } : {}),
        }}
        renderExpanded={task.notes ? () => (
          <div style={{ fontSize: 12, color: hlColor ? 'rgba(255,255,255,0.8)' : '#888', lineHeight: 1.4 }}>
            {task.notes.length > 80 ? task.notes.slice(0, 80) + '…' : task.notes}
          </div>
        ) : undefined}
      />
    </div>
  )
}

/* ═══ Drag Overlay Card ═══ */
function TaskOverlay({ task }) {
  const hlColorKey = useStore.getState().getHighlightColor(task.id)
  const hlColor = hlColorKey && HIGHLIGHT_COLORS[hlColorKey]
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 6,
      padding: '8px 10px', borderRadius: 8,
      background: hlColor ? hlColor.bg : 'white',
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      border: hlColor ? 'none' : '1px solid rgba(0,0,0,0.06)',
      transform: 'rotate(2deg)', cursor: 'grabbing', maxWidth: 300,
    }}>
      <div style={{ paddingTop: 1, flexShrink: 0 }}>
        <CheckIcon checked={false} size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: FONT.body, lineHeight: '19px', color: hlColor ? '#fff' : COLOR.textPrimary }}>{task.text}</div>
      </div>
    </div>
  )
}

/* ═══ Member Avatar ═══ */
function MemberAvatar({ name, size = 22 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: '#888',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.45, fontWeight: 600, flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}







