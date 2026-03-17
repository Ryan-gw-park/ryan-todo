import { useState, useRef, useCallback, useEffect } from 'react'
import { DndContext, DragOverlay, useDroppable, PointerSensor, TouchSensor, useSensors, useSensor, pointerWithin, rectIntersection } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import useStore from '../../hooks/useStore'
import { getCachedUserId } from '../../hooks/useStore'
import useMatrixConfig from '../../hooks/useMatrixConfig'
import useTeamMembers from '../../hooks/useTeamMembers'
import { getDb } from '../../utils/supabase'
import { getColor } from '../../utils/colors'
import { SettingsIcon, CheckIcon, UndoIcon } from '../shared/Icons'
import { parseDateFromText } from '../../utils/dateParser'
import InlineAdd from '../shared/InlineAdd'
import ColorPicker from '../shared/ColorPicker'
import RowConfigSettings from '../shared/RowConfigSettings'
import ProjectFilter from '../shared/ProjectFilter'
import useProjectFilter from '../../hooks/useProjectFilter'

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
  const LW = isMobile ? 80 : 110
  const COL_GAP = 10
  const COL_MIN = isMobile ? 200 : 0

  // Column collapse (shared with original MatrixView via store)
  const collapsed = collapseState.matrix || {}
  const doneCollapsed = collapseState.matrixDone || {}
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
    { id: '_me_today', section: 'me_today', label: '오늘 할일', row_type: 'task_row', sort_order: 1, parent_section: 'me' },
    { id: '_me_next', section: 'me_next', label: '다음 할일', row_type: 'task_row', sort_order: 2, parent_section: 'me' },
    { id: '_team', section: 'team', label: teamName, row_type: 'section_header', sort_order: 3, is_collapsed: false },
    { id: '_remaining', section: 'remaining', label: '미배정', row_type: 'remaining', sort_order: 90 },
    { id: '_completed', section: 'completed', label: '완료', row_type: 'completed', sort_order: 99, is_collapsed: true },
  ]

  const [config, setConfig] = useState(defaultConfig)
  // 팀원 접기 상태: collapsedMembers Set에 포함된 팀원만 요약 모드
  // 팀 섹션 펼치기 = 모든 팀원 상세 카드 표시 (기본), 개별 클릭으로 접기 토글
  const [collapsedMembers, setCollapsedMembers] = useState(new Set())
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
      const [members, existingCfg] = await Promise.all([
        useTeamMembers.getMembers(currentTeamId),
        useMatrixConfig.getConfig(uid, currentTeamId),
      ])
      if (cancelled) return
      let cfg = existingCfg
      if (cfg.length === 0) {
        cfg = await useMatrixConfig.initConfig(uid, currentTeamId, members)
      }
      if (!cancelled) setConfig(cfg)
      useMatrixConfig.syncMembers(uid, currentTeamId, members).then(async () => {
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

  const handleToggleSection = useCallback(async (configItem) => {
    setConfig(prev => prev.map(c => c.id === configItem.id ? { ...c, is_collapsed: !c.is_collapsed } : c))
    await useMatrixConfig.toggleCollapse(configItem.id, configItem.is_collapsed)
  }, [])

  const handleToggleMember = useCallback((mappedUserId) => {
    setCollapsedMembers(prev => {
      const next = new Set(prev)
      if (next.has(mappedUserId)) next.delete(mappedUserId)
      else next.add(mappedUserId)
      return next
    })
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

    // ── 팀원 행 drop ──
    // Loop-31: category 강제 변경 제거 — R1이 scope='assigned' 자동 설정
    if (typeof overId === 'string' && overId.startsWith('member:')) {
      const targetMemberId = overId.split(':')[1]
      updateTask(active.id, {
        assigneeId: targetMemberId,
      })
      return
    }

    // ── 카테고리 drop zone (projectId:category) ──
    if (typeof overId === 'string' && overId.includes(':')) {
      const [targetProjectId, targetCategory] = overId.split(':')
      const project = projects.find(p => p.id === targetProjectId)

      // Loop-31: 드롭 대상의 expected scope/assigneeId 결정
      let expectedScope = task.scope
      let expectedAssignee = task.assigneeId
      if (project?.teamId) {
        if (targetCategory === 'today' || targetCategory === 'next') {
          expectedScope = 'assigned'
          expectedAssignee = userId
        } else if (targetCategory === 'backlog') {
          expectedScope = 'team'
          expectedAssignee = null
        }
      }
      const expectedDone = targetCategory === 'done'

      // 조기 리턴: 모든 상태가 동일할 때만
      const isSamePosition = (
        task.projectId === targetProjectId &&
        task.category === targetCategory &&
        task.scope === expectedScope &&
        task.assigneeId === expectedAssignee &&
        task.done === expectedDone
      )
      if (isSamePosition) return

      const patch = { projectId: targetProjectId, category: targetCategory }

      // 자동 배정
      if (project?.teamId) {
        if (targetCategory === 'today' || targetCategory === 'next') {
          patch.scope = 'assigned'
          patch.assigneeId = userId
        } else if (targetCategory === 'backlog') {
          patch.scope = 'team'
          patch.assigneeId = null
        }
      }

      // Loop-31: done 처리 — 완료 행 drop 시 done=true, 미완료 행 drop 시 done=false
      if (targetCategory === 'done' && !task.done) {
        patch.done = true
      } else if (targetCategory !== 'done' && task.done) {
        patch.done = false
      }

      updateTask(active.id, patch)
      return
    }

    // ── 다른 task 위에 drop ──
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
      // Cross-cell: 대상 task 위치로 이동
      const project = projects.find(p => p.id === overTask.projectId)
      const patch = { projectId: overTask.projectId, category: overTask.category }

      if (project?.teamId) {
        if (overTask.category === 'today' || overTask.category === 'next') {
          patch.scope = 'assigned'
          patch.assigneeId = userId
        } else if (overTask.category === 'backlog') {
          patch.scope = 'team'
          patch.assigneeId = null
        }
      }

      // Loop-31: done 처리 — 대상 task의 done 상태 기준
      if (overTask.done && !task.done) {
        patch.done = true
      } else if (!overTask.done && task.done) {
        patch.done = false
      }

      updateTask(active.id, patch)
    }
  }

  // Group config rows
  const sectionHeaders = config.filter(r => r.row_type === 'section_header')
  const meHeader = sectionHeaders.find(r => r.section === 'me')
  const teamHeader = sectionHeaders.find(r => r.section === 'team')
  const taskRows = config.filter(r => r.row_type === 'task_row').sort((a, b) => a.sort_order - b.sort_order)
  const memberRows = config.filter(r => r.row_type === 'member_row').sort((a, b) => a.sort_order - b.sort_order)
  const remainingRow = config.find(r => r.row_type === 'remaining')
  const completedRow = config.find(r => r.row_type === 'completed')

  // Filter helpers
  const myTasksForRow = (category) => tasks
    .filter(t => {
      if (t.category !== category) return false
      if (t.done) return false
      if (t.teamId === currentTeamId && t.assigneeId === userId && t.scope === 'assigned') return true
      // scope='team'(미배정)은 "남은 할일"에만 표시 — 여기서 제외
      if (t.scope === 'private' && t.createdBy === userId) return true
      if (!t.teamId && !t.scope) return true
      return false
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const memberTasks = (memberId) => tasks
    .filter(t => t.assigneeId === memberId && t.scope === 'assigned' && t.teamId === currentTeamId && !t.done)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const remainingTasks = tasks
    .filter(t => t.teamId === currentTeamId && t.scope === 'team' && !t.assigneeId && !t.done && t.category === 'backlog')
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const completedTasks = tasks
    .filter(t => {
      if (!t.done) return false
      if (t.teamId === currentTeamId) return true
      if (t.scope === 'private' && t.createdBy === userId) return true
      if (!t.teamId && !t.scope) return true
      return false
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)

  // Loop-20.2: 전역 필터 적용
  const { filteredProjects, filteredTasks: _ft } = useProjectFilter(projects, tasks)

  // 프로젝트 열 — localProjectOrder 기준 단일 리스트 (섹션 분리 없음)
  const allColumns = filteredProjects
  const N = allColumns.length
  const rowCategoryMap = { me_today: 'today', me_next: 'next' }

  return (
    <div data-view="matrix" style={{ padding: isMobile ? '20px 0 100px' : '40px 48px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32, padding: isMobile ? '0 16px' : 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#37352f', margin: 0, letterSpacing: '-0.02em' }}>매트릭스 뷰</h1>
            <p style={{ fontSize: 14, color: '#999', marginTop: 4 }}>{dateStr}</p>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <ProjectFilter />
            <button onClick={() => setShowRowConfig(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: '1px solid #e0e0e0', background: 'white', cursor: 'pointer', color: '#888', fontSize: 12, fontFamily: 'inherit', fontWeight: 500, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#999'; e.currentTarget.style.color = '#37352f' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.color = '#888' }}
            >
              <SettingsIcon /> 뷰 관리
            </button>
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={matrixCollision} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ overflowX: 'auto', padding: isMobile ? '0 12px' : 0 }}>
            <div style={{ minWidth: isMobile ? LW + N * (COL_MIN + COL_GAP) : 'auto' }}>

              {/* ── Project header row ── */}
              <div style={{ display: 'flex', gap: COL_GAP, marginBottom: 0 }}>
                <div style={{ width: LW, flexShrink: 0, ...(isMobile ? { position: 'sticky', left: 0, zIndex: 4, background: 'white' } : {}) }} />
                {allColumns.map(p => {
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

              {/* ── 나 섹션 ── */}
              {meHeader && (
                <SectionHeader
                  config={{ ...meHeader, label: userName }}
                  onToggle={handleToggleSection}
                />
              )}
              {meHeader && !meHeader.is_collapsed && taskRows.map(row => {
                const category = rowCategoryMap[row.section] || 'today'
                const rowTasks = myTasksForRow(category)
                return (
                  <TaskRowWithDnd
                    key={row.id}
                    label={row.label}
                    emoji={category === 'today' ? '🎯' : '📌'}
                    columns={allColumns}
                    tasks={rowTasks}
                    isMobile={isMobile}
                    LW={LW}
                    COL_GAP={COL_GAP}
                    COL_MIN={COL_MIN}
                    category={category}
                    activeId={activeId}
                    collapsed={collapsed}
                    extraFields={currentTeamId ? { scope: 'assigned', assigneeId: userId } : undefined}
                  />
                )
              })}

              {/* ── 팀 섹션 ── */}
              <div style={{ height: 16 }} />
              {teamHeader && (
                <SectionHeader
                  config={{ ...teamHeader, label: teamName }}
                  onToggle={handleToggleSection}
                />
              )}
              {teamHeader && !teamHeader.is_collapsed && memberRows.map(row => {
                const isMemberCollapsed = collapsedMembers.has(row.mapped_user_id)
                const mTasks = memberTasks(row.mapped_user_id)
                return (
                  <MemberDropZone key={row.id} memberId={row.mapped_user_id} activeId={activeId}>
                    {!isMemberCollapsed ? (
                      <>
                        {/* 펼친 상태: 이름 헤더 (전체 너비) + 상세 카드 */}
                        <div
                          onClick={() => handleToggleMember(row.mapped_user_id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', cursor: 'pointer' }}
                        >
                          <MemberAvatar name={row.label} size={22} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>{row.label}</span>
                          <span style={{ fontSize: 10, color: '#aaa' }}>▾</span>
                          <span style={{ fontSize: 11, color: '#bbb', marginLeft: 4 }}>{mTasks.length}건</span>
                        </div>
                        <ReadOnlyRow
                          columns={allColumns}
                          tasks={mTasks}
                          isMobile={isMobile}
                          LW={LW}
                          COL_GAP={COL_GAP}
                          COL_MIN={COL_MIN}
                          collapsed={collapsed}
                          isOwner={isOwner}
                        />
                      </>
                    ) : (
                      /* 접힌 상태: 프로젝트별 카운트 표시 */
                      <div
                        onClick={() => handleToggleMember(row.mapped_user_id)}
                        style={{ display: 'flex', gap: COL_GAP, cursor: 'pointer', alignItems: 'stretch' }}
                      >
                        <div style={{
                          width: LW, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                          paddingTop: 10, paddingBottom: 10, paddingRight: 8, paddingLeft: 12,
                          ...(isMobile ? { position: 'sticky', left: 0, zIndex: 4, background: 'white' } : {}),
                        }}>
                          <MemberAvatar name={row.label} size={22} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.label}</span>
                          <span style={{ fontSize: 10, color: '#aaa' }}>▸</span>
                        </div>
                        {allColumns.map(p => {
                                  const isCol = collapsed[p.id]
                          const isPersonalCol = !p.teamId
                          const count = isPersonalCol ? 0 : mTasks.filter(t => t.projectId === p.id).length
                          return (
                            <div key={p.id} style={{
                              flex: isCol ? '0 0 48px' : 1, minWidth: isCol ? 48 : COL_MIN,
                              background: isPersonalCol ? '#f5f5f3' : '#fafafa',
                              borderLeft: '1px solid rgba(0,0,0,0.04)',
                              borderRight: '1px solid rgba(0,0,0,0.04)',
                              borderTop: '1px solid rgba(0,0,0,0.06)',
                              padding: isCol ? '8px 4px' : '8px 14px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              minHeight: 36,
                              transition: 'flex 0.25s ease, min-width 0.25s ease, padding 0.25s ease',
                              overflow: 'hidden',
                            }}>
                              {count > 0 ? (
                                <span style={{
                                  fontSize: 12, fontWeight: 600, color: '#666',
                                  background: '#eee', borderRadius: 10, padding: '2px 10px',
                                }}>{count}</span>
                              ) : (
                                !isCol && <span style={{ fontSize: 11, color: '#ddd' }}>—</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </MemberDropZone>
                )
              })}

              {/* ── 남은 할일 + 완료 통합 섹션 ── */}
              <div style={{ height: 16 }} />
              {remainingRow && (
                <SectionHeader
                  config={{ ...remainingRow, label: '남은 할일 · 완료' }}
                  onToggle={handleToggleSection}
                />
              )}
              {remainingRow && !remainingRow.is_collapsed && (
                <>
                  <TaskRowWithDnd
                    label="남은 할일"
                    emoji="📋"
                    columns={allColumns}
                    tasks={remainingTasks}
                    isMobile={isMobile}
                    LW={LW}
                    COL_GAP={COL_GAP}
                    COL_MIN={COL_MIN}
                    category="backlog"
                    activeId={activeId}
                    collapsed={collapsed}
                    extraFields={currentTeamId ? { scope: 'team' } : undefined}
                  />
                  {completedRow && (
                    <CompletedRow
                      columns={allColumns}
                      tasks={completedTasks}
                      isMobile={isMobile}
                      LW={LW}
                      COL_GAP={COL_GAP}
                      COL_MIN={COL_MIN}
                      activeId={activeId}
                      collapsed={collapsed}
                      doneCollapsed={doneCollapsed}
                      storeToggle={storeToggle}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Drag overlay */}
          <DragOverlay dropAnimation={null}>
            {activeTask ? <TaskOverlay task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
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
  )
}

/* ═══ Section Header — lane-style: {name} ▾ ═══ */
function SectionHeader({ config, onToggle }) {
  return (
    <div>
      <div
        onClick={() => onToggle(config)}
        style={{
          display: 'flex', alignItems: 'center',
          padding: '0 0 4px',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>{config.label}</span>
        <span style={{
          fontSize: 11, color: '#bbb',
          marginLeft: 6,
          transition: 'transform 0.2s ease',
          display: 'inline-block',
          transform: config.is_collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
        }}>▾</span>
      </div>
      <div style={{ borderBottom: '1px solid #ece8e1', marginBottom: 6 }} />
    </div>
  )
}

/* ═══ Member Drop Zone — 팀원 행 드롭 대상 ═══ */
function MemberDropZone({ memberId, activeId, children }) {
  const { isOver, setNodeRef } = useDroppable({ id: `member:${memberId}` })
  return (
    <div ref={setNodeRef} style={{
      transition: 'background 0.08s',
      ...(isOver && activeId ? { background: 'rgba(49,130,206,0.06)', borderRadius: 8 } : {}),
    }}>
      {children}
    </div>
  )
}

/* ═══ Category Drop Zone ═══ */
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

/* ═══ Task Row with DnD — editable rows (나 섹션, 남은 할일) ═══ */
function TaskRowWithDnd({ label, emoji, columns, tasks: rowTasks, isMobile, LW, COL_GAP, COL_MIN, category, activeId, collapsed, extraFields }) {
  return (
    <div style={{ display: 'flex', gap: COL_GAP, alignItems: 'stretch' }}>
      <div style={{
        width: LW, flexShrink: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6,
        alignSelf: 'flex-start', paddingTop: 14, paddingRight: 8, paddingLeft: 12,
        ...(isMobile ? { position: 'sticky', left: 0, zIndex: 4, background: 'white' } : {}),
      }}>
        {emoji && <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>}
        <span style={{ fontSize: 13, fontWeight: 600, color: '#555', lineHeight: 1.3, whiteSpace: 'nowrap' }}>{label}</span>
      </div>

      {columns.map(p => {
        const c = getColor(p.color)
        const isCol = collapsed[p.id]
        const cellTasks = rowTasks.filter(t => t.projectId === p.id)
        return (
          <CategoryDropZone
            key={p.id}
            id={`${p.id}:${category}`}
            color={c}
            activeId={activeId}
            style={{
              flex: isCol ? '0 0 48px' : 1, minWidth: isCol ? 48 : COL_MIN,
              background: c.card,
              borderLeft: '1px solid rgba(0,0,0,0.04)',
              borderRight: '1px solid rgba(0,0,0,0.04)',
              borderTop: '1px solid rgba(0,0,0,0.06)',
              padding: isCol ? '8px 4px' : (isMobile ? '8px 8px' : '10px 14px'),
              minHeight: 60,
              transition: 'flex 0.25s ease, min-width 0.25s ease, padding 0.25s ease',
              overflow: 'hidden',
            }}
          >
            {isCol ? (
              <div style={{ fontSize: 10, color: c.dot, fontWeight: 600, textAlign: 'center' }}>{cellTasks.length}</div>
            ) : (
              <>
                <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: c.text, opacity: 0.7 }}>{label}</span>
                  <span style={{ fontSize: 10, color: c.dot, fontWeight: 600 }}>{cellTasks.length}</span>
                </div>
                <SortableContext items={cellTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {cellTasks.map(task => (
                    <TeamMatrixCard key={task.id} task={task} readOnly={false} />
                  ))}
                </SortableContext>
                <InlineAdd projectId={p.id} category={category} color={c} extraFields={extraFields} />
              </>
            )}
          </CategoryDropZone>
        )
      })}
    </div>
  )
}

/* ═══ Member Detail Row — 팀장: 편집 가능, 팀원: 읽기전용 ═══ */
function ReadOnlyRow({ columns, tasks: rowTasks, isMobile, LW, COL_GAP, COL_MIN, collapsed, isOwner }) {
  return (
    <div style={{ display: 'flex', gap: COL_GAP, alignItems: 'stretch' }}>
      <div style={{
        width: LW, flexShrink: 0,
        alignSelf: 'flex-start', paddingTop: 6, paddingRight: 8,
        ...(isMobile ? { position: 'sticky', left: 0, zIndex: 4, background: 'white' } : {}),
      }} />

      {columns.map(p => {
        const c = getColor(p.color)
        const isCol = collapsed[p.id]
        // 팀원 펼침 행: 개인 프로젝트 열은 빈 셀
        const isPersonalCol = !p.teamId
        const cellTasks = isPersonalCol ? [] : rowTasks.filter(t => t.projectId === p.id)
        return (
          <div key={p.id} style={{
            flex: isCol ? '0 0 48px' : 1, minWidth: isCol ? 48 : COL_MIN,
            background: isPersonalCol ? '#f5f5f3' : c.card,
            borderLeft: '1px solid rgba(0,0,0,0.04)',
            borderRight: '1px solid rgba(0,0,0,0.04)',
            borderTop: '1px solid rgba(0,0,0,0.06)',
            padding: isCol ? '8px 4px' : (isMobile ? '8px 8px' : '10px 14px'),
            minHeight: 40,
            transition: 'flex 0.25s ease, min-width 0.25s ease, padding 0.25s ease',
            overflow: 'hidden',
          }}>
            {isCol ? (
              <div style={{ fontSize: 10, color: c.dot, fontWeight: 600, textAlign: 'center' }}>{cellTasks.length}</div>
            ) : isPersonalCol ? (
              <span style={{ fontSize: 11, color: '#ddd' }}>—</span>
            ) : (
              <>
                <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: c.text, opacity: 0.7 }}>상세</span>
                  <span style={{ fontSize: 10, color: c.dot, fontWeight: 600 }}>{cellTasks.length}</span>
                </div>
                {cellTasks.map(task => (
                  <TeamMatrixCard key={task.id} task={task} readOnly={!isOwner} />
                ))}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ═══ Completed Row — 프로젝트별 접기/펼치기 ═══ */
function CompletedRow({ columns, tasks: doneTasks, isMobile, LW, COL_GAP, COL_MIN, activeId, collapsed, doneCollapsed, storeToggle }) {
  return (
    <div style={{ display: 'flex', gap: COL_GAP, alignItems: 'stretch' }}>
      <div style={{
        width: LW, flexShrink: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6,
        alignSelf: 'flex-start', paddingTop: 14, paddingRight: 8, paddingLeft: 12,
        ...(isMobile ? { position: 'sticky', left: 0, zIndex: 4, background: 'white' } : {}),
      }}>
        <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>✅</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#999', lineHeight: 1.3, whiteSpace: 'nowrap' }}>완료</span>
      </div>
      {columns.map(p => {
        const c = getColor(p.color)
        const isCol = collapsed[p.id]
        const cellTasks = doneTasks.filter(t => t.projectId === p.id)
        const isDoneCollapsed = doneCollapsed[p.id] !== false && cellTasks.length > 0
        return (
          <CategoryDropZone
            key={p.id}
            id={`${p.id}:done`}
            color={c}
            activeId={activeId}
            style={{
              flex: isCol ? '0 0 48px' : 1, minWidth: isCol ? 48 : COL_MIN,
              background: '#f7f7f5',
              borderLeft: '1px solid rgba(0,0,0,0.04)',
              borderRight: '1px solid rgba(0,0,0,0.04)',
              borderBottom: '1px solid rgba(0,0,0,0.04)',
              borderRadius: '0 0 10px 10px',
              padding: isCol ? '8px 4px' : (isMobile ? '8px 8px' : '10px 14px'),
              minHeight: 50,
              transition: 'flex 0.25s ease, min-width 0.25s ease, padding 0.25s ease',
              overflow: 'hidden',
            }}
          >
            {isCol ? (
              <div style={{ fontSize: 10, color: '#bbb', fontWeight: 600, textAlign: 'center' }}>{cellTasks.length}</div>
            ) : (
              <>
                <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#ccc', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#aaa', opacity: 0.7 }}>완료</span>
                  <span style={{ fontSize: 10, color: '#bbb', fontWeight: 600 }}>{cellTasks.length}</span>
                  {cellTasks.length > 0 && (
                    <button onClick={(e) => { e.stopPropagation(); storeToggle('matrixDone', p.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 10, fontFamily: 'inherit', padding: '0 4px' }}>
                      {isDoneCollapsed ? '펼치기' : '접기'}
                    </button>
                  )}
                </div>
                <div style={{ minHeight: 20 }}>
                  {isDoneCollapsed
                    ? <div style={{ fontSize: 11, color: '#ccc', padding: '2px 0' }}>완료 {cellTasks.length}건</div>
                    : (
                      <SortableContext items={cellTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                        {cellTasks.map(task => (
                          <TeamMatrixCard key={task.id} task={task} readOnly={false} isDone />
                        ))}
                      </SortableContext>
                    )
                  }
                </div>
              </>
            )}
          </CategoryDropZone>
        )
      })}
    </div>
  )
}

/* ═══ Team Matrix Card — DnD + highlight color + mobile menu ═══ */
function TeamMatrixCard({ task, readOnly, isDone }) {
  const { toggleDone, updateTask, openDetail, deleteTask } = useStore()
  const isMobile = window.innerWidth < 768

  // DnD (only for editable cards)
  const sortableResult = useSortable({ id: task.id, disabled: readOnly, transition: { duration: 120, easing: 'ease' } })
  const { attributes, listeners, setNodeRef, transform, transition: sortTransition, isDragging } = sortableResult

  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(task.text)
  const [hovering, setHovering] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
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

  // Highlight color override — 팀 모드: 개인별, 개인 모드: tasks 직접
  const hlColorKey = useStore.getState().getHighlightColor(task.id)
  const hlColor = hlColorKey && HIGHLIGHT_COLORS[hlColorKey]
  const cardBg = hlColor ? hlColor.bg : '#ffffff'
  const cardTextColor = hlColor ? '#ffffff' : (isDone ? '#999' : '#37352f')

  const style = {
    background: cardBg,
    borderRadius: 8,
    padding: '8px 10px',
    border: hlColor ? 'none' : '1px solid rgba(0,0,0,0.06)',
    boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,0.12)' : '0 1px 2px rgba(0,0,0,0.03)',
    marginBottom: 6,
    transition: isDragging ? 'none' : [sortTransition, 'box-shadow 0.15s'].filter(Boolean).join(', '),
    opacity: isDone ? 0.5 : isDragging ? 0.3 : 1,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 100 : undefined,
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    cursor: isDragging ? 'grabbing' : 'default',
  }

  const handleContextMenu = (e) => {
    if (readOnly) return
    e.preventDefault()
    setShowColorPicker(true)
  }

  const mobileHandlers = (isMobile && !readOnly) ? {
    onTouchStart: () => { longPressTimer.current = setTimeout(() => setShowMenu(true), 500) },
    onTouchEnd: () => clearTimeout(longPressTimer.current),
    onTouchMove: () => clearTimeout(longPressTimer.current),
  } : {}

  return (
    <div
      ref={!readOnly ? setNodeRef : undefined}
      style={style}
      {...(!readOnly && !isMobile ? listeners : {})}
      {...(!readOnly ? attributes : {})}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onContextMenu={handleContextMenu}
      {...mobileHandlers}
    >
      {/* Color picker popover */}
      {showColorPicker && (
        <ColorPicker
          taskId={task.id}
          currentColor={hlColorKey}
          onClose={() => setShowColorPicker(false)}
          style={{ top: -36, right: 0 }}
        />
      )}

      {/* Checkbox */}
      <div
        onClick={e => { e.stopPropagation(); if (!readOnly) toggleDone(task.id) }}
        style={{ paddingTop: 1, flexShrink: 0, cursor: readOnly ? 'default' : 'pointer', opacity: readOnly ? 0.4 : 1 }}
      >
        {isDone
          ? <div style={{ width: 14, height: 14, borderRadius: 3, background: hlColor ? 'rgba(255,255,255,0.3)' : '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: hlColor ? '#fff' : '#66bb6a' }}>
              <UndoIcon />
            </div>
          : <CheckIcon checked={false} size={14} />
        }
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!readOnly && editing ? (
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
            onKeyDown={handleKeyDown}
            onBlur={saveText}
            rows={1}
            style={{ width: '100%', fontSize: 13, lineHeight: '19px', border: 'none', outline: 'none', padding: 0, fontFamily: 'inherit', background: 'transparent', color: cardTextColor, boxSizing: 'border-box', resize: 'none', overflow: 'hidden' }}
          />
        ) : (
          <div
            onClick={() => { if (!readOnly && !isDragging) setEditing(true) }}
            style={{ fontSize: 13, fontWeight: 500, lineHeight: '19px', color: cardTextColor, textDecoration: isDone ? 'line-through' : 'none', cursor: readOnly ? 'default' : 'text', minHeight: 19 }}
          >
            {task.text}
          </div>
        )}
      </div>

      {/* Read-only indicator — clickable to open detail */}
      {readOnly && (
        <span
          onClick={e => { e.stopPropagation(); openDetail(task) }}
          style={{ fontSize: 11, color: hlColor ? 'rgba(255,255,255,0.6)' : '#ccc', flexShrink: 0, paddingTop: 2, cursor: 'pointer' }}
        >👁</span>
      )}

      {/* Detail button (hover, desktop) */}
      {!isMobile && (
        <button
          onClick={e => { e.stopPropagation(); openDetail(task) }}
          style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            opacity: hovering ? 1 : 0, transition: 'opacity 0.15s',
            width: 22, height: 22, borderRadius: 4, background: hlColor ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: hlColor ? '#fff' : '#999', cursor: 'pointer', border: 'none', padding: 0, flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = hlColor ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.08)'; e.currentTarget.style.color = hlColor ? '#fff' : '#555' }}
          onMouseLeave={e => { e.currentTarget.style.background = hlColor ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = hlColor ? '#fff' : '#999' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      )}

      {/* Mobile context menu */}
      {isMobile && !readOnly && showMenu && (
        <MobileContextMenu task={task} onClose={() => setShowMenu(false)} openDetail={openDetail} deleteTask={deleteTask} />
      )}
    </div>
  )
}

/* ═══ Mobile Context Menu ═══ */
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
        <div style={{ fontSize: 13, lineHeight: '19px', color: hlColor ? '#fff' : '#37352f' }}>{task.text}</div>
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
