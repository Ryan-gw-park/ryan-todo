import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react'
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
import MSBadge from '../common/MSBadge'
import CompactMsRow from '../common/CompactMsRow'
import { getMsPath, getVisibleMs } from '../../utils/milestoneTree'

const MilestoneMatrixView = lazy(() => import('./MilestoneMatrixView'))

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

  const [matrixMode, setMatrixMode] = useState('task') // 'task' | 'milestone'

  // Loop-38: sub-view tabs + depth toggle
  const [subView, setSubView] = useState('matrix') // 'matrix' | 'project' | 'member'
  const [depthFilter, setDepthFilter] = useState('0') // 'all' | '0' | '1' | '2'
  const [members, setMembers] = useState([])
  const [showUnassigned, setShowUnassigned] = useState(false)

  // 마일스톤 데이터
  const milestones = useStore(s => s.milestones)
  const msMap = useMemo(() => {
    const m = {}
    milestones.forEach(ms => { m[ms.id] = ms })
    return m
  }, [milestones])

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
      } else {
        // Loop-35I: 개인 프로젝트 타겟 — scope='private'로 전환
        expectedScope = 'private'
        expectedAssignee = null
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
      } else {
        // Loop-35I: 개인 프로젝트 타겟 — scope='private'로 전환, teamId 해제
        patch.scope = 'private'
        patch.teamId = null
        patch.assigneeId = null
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
      } else {
        // Loop-35I: 개인 프로젝트 타겟 — scope='private'로 전환, teamId 해제
        patch.scope = 'private'
        patch.teamId = null
        patch.assigneeId = null
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

  // 프로젝트 열 — 팀 모드에서는 팀 프로젝트만 표시 (개인 프로젝트 제외)
  const allColumns = currentTeamId
    ? filteredProjects.filter(p => p.teamId === currentTeamId)
    : filteredProjects
  const N = allColumns.length
  const rowCategoryMap = { me_today: 'today', me_next: 'next' }

  // teamId 로딩 전 guard — 모든 hooks 이후에 위치 (Rules of Hooks 준수)
  if (!currentTeamId) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>
        팀을 선택하세요. 사이드바에서 팀을 전환할 수 있습니다.
      </div>
    )
  }

  // 마일스톤 모드 → 별도 컴포넌트
  if (matrixMode === 'milestone') {
    return (
      <div data-view="matrix" style={{ padding: isMobile ? SPACE.viewPaddingMobile : SPACE.viewPadding }}>
        <div style={{ maxWidth: VIEW_WIDTH.wide, margin: '0 auto' }}>
          <div style={{ marginBottom: 32, padding: isMobile ? '0 16px' : 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <TeamModePill active={matrixMode} onChange={setMatrixMode} />
              <button onClick={() => setShowRowConfig(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: `1px solid ${COLOR.border}`, background: 'white', cursor: 'pointer', color: COLOR.textSecondary, fontSize: FONT.label, fontFamily: 'inherit', fontWeight: 500 }}>
                <SettingsIcon /> 뷰 관리
              </button>
            </div>
          </div>
          <Suspense fallback={<div style={{ textAlign: 'center', color: COLOR.textTertiary, padding: 40 }}>로딩...</div>}>
            <MilestoneMatrixView projects={filteredProjects} milestones={milestones} tasks={tasks} />
          </Suspense>
        </div>
        {showRowConfig && <RowConfigSettings teamId={currentTeamId} userId={userId} onClose={() => setShowRowConfig(false)} onSave={cfg => { setConfig(cfg); setShowRowConfig(false) }} />}
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
            <TeamModePill active={matrixMode} onChange={setMatrixMode} />
            <button onClick={() => setShowRowConfig(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: `1px solid ${COLOR.border}`, background: 'white', cursor: 'pointer', color: COLOR.textSecondary, fontSize: FONT.label, fontFamily: 'inherit', fontWeight: 500, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = COLOR.textTertiary; e.currentTarget.style.color = COLOR.textPrimary }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = COLOR.border; e.currentTarget.style.color = COLOR.textSecondary }}
            >
              <SettingsIcon /> 뷰 관리
            </button>
          </div>
        </div>

        {/* Header row 2: sub-view tabs + depth toggle (Loop-38) */}
        <div style={{ marginBottom: 20, padding: isMobile ? '0 16px' : 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SubViewPill active={subView} onChange={setSubView} />
          <div style={{ width: 1, height: 20, background: '#e8e6df' }} />
          <DepthToggle value={depthFilter} onChange={setDepthFilter} />
        </div>

        {/* Loop-38: conditional sub-view rendering */}
        {/* subView === 'matrix' → rendered below via original DnD task grid */}
        {subView === 'project' && (
          <SubviewProject
            projects={filteredProjects}
            milestones={milestones}
            tasks={tasks}
            members={members}
            depthFilter={depthFilter}
          />
        )}
        {subView === 'member' && (
          <SubviewMember
            projects={filteredProjects}
            milestones={milestones}
            tasks={tasks}
            members={members}
            userId={userId}
            depthFilter={depthFilter}
          />
        )}

        {/* Original task-mode grid — shown when subView is 'matrix' */}
        {subView === 'matrix' && <DndContext sensors={sensors} collisionDetection={matrixCollision} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ overflowX: 'auto', padding: isMobile ? '0 12px' : 0 }}>
            <div style={{ minWidth: isMobile ? LW + N * (COL_MIN + COL_GAP) : 'auto' }}>

              {/* ── Project header row ── */}
              <div style={{ display: 'flex', gap: COL_GAP, marginBottom: 0 }}>
                <div style={{ width: LW, flexShrink: 0, ...(isMobile ? { position: 'sticky', left: 0, zIndex: 4, background: 'white' } : {}) }} />
                {allColumns.map(p => {
                  const c = getColor(p.color)
                  const pt = tasks.filter(t => t.projectId === p.id && !t.done)
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
                    msMap={msMap}
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
                          <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textSecondary }}>{row.label}</span>
                          <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>▾</span>
                          <span style={{ fontSize: FONT.caption, color: COLOR.textTertiary, marginLeft: 4 }}>{mTasks.length}건</span>
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
                          msMap={msMap}
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
                    msMap={msMap}
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
                      msMap={msMap}
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
        </DndContext>}

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
function TaskRowWithDnd({ label, emoji, columns, tasks: rowTasks, isMobile, LW, COL_GAP, COL_MIN, category, activeId, collapsed, extraFields, msMap }) {
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
                    <TeamMatrixCard key={task.id} task={task} readOnly={false} milestone={msMap[task.keyMilestoneId]} />
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
function ReadOnlyRow({ columns, tasks: rowTasks, isMobile, LW, COL_GAP, COL_MIN, collapsed, isOwner, msMap }) {
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
                  <TeamMatrixCard key={task.id} task={task} readOnly={!isOwner} milestone={msMap[task.keyMilestoneId]} />
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
function CompletedRow({ columns, tasks: doneTasks, isMobile, LW, COL_GAP, COL_MIN, activeId, collapsed, doneCollapsed, storeToggle, msMap }) {
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
                          <TeamMatrixCard key={task.id} task={task} readOnly={false} isDone milestone={msMap[task.keyMilestoneId]} />
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
function TeamMatrixCard({ task, readOnly, isDone, milestone }) {
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
        renderMeta={milestone ? () => <MSBadge milestone={milestone} /> : undefined}
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

/* ═══ Mode Pill — [할일 모드][마일스톤 모드] ═══ */
function TeamModePill({ active, onChange }) {
  const items = [{ key: 'task', label: '할일 모드' }, { key: 'milestone', label: '마일스톤 모드' }]
  return (
    <div style={{ display: 'flex', gap: 2, background: '#fafaf8', borderRadius: 8, padding: 2 }}>
      {items.map(it => (
        <button key={it.key} onClick={() => onChange(it.key)} style={{
          border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
          fontWeight: active === it.key ? 600 : 400,
          background: active === it.key ? '#fff' : 'transparent',
          color: active === it.key ? COLOR.textPrimary : COLOR.textTertiary,
          boxShadow: active === it.key ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
        }}>{it.label}</button>
      ))}
    </div>
  )
}

/* ═══ Sub-view Pill — [매트릭스][프로젝트별][담당자별] (Loop-38) ═══ */
function SubViewPill({ active, onChange }) {
  const items = [
    { key: 'matrix', label: '매트릭스' },
    { key: 'project', label: '프로젝트별' },
    { key: 'member', label: '담당자별' },
  ]
  return (
    <div style={{ display: 'flex', gap: 1, background: '#f5f4f0', borderRadius: 7, padding: 2 }}>
      {items.map(it => (
        <button key={it.key} onClick={() => onChange(it.key)} style={{
          border: 'none', borderRadius: 5, padding: '4px 12px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
          fontWeight: active === it.key ? 600 : 400,
          background: active === it.key ? '#fff' : 'transparent',
          color: active === it.key ? '#37352f' : '#a09f99',
          boxShadow: active === it.key ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
        }}>{it.label}</button>
      ))}
    </div>
  )
}

/* ═══ Depth Toggle — [전체][대분류][중분류][소분류] (Loop-38) ═══ */
function DepthToggle({ value, onChange }) {
  const items = [
    { key: 'all', label: '전체' },
    { key: '0', label: '대분류' },
    { key: '1', label: '중분류' },
    { key: '2', label: '소분류' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10.5, color: '#a09f99' }}>표시 단위:</span>
      <div style={{ display: 'flex', gap: 2 }}>
        {items.map(it => (
          <button key={it.key} onClick={() => onChange(it.key)} style={{
            border: 'none', borderRadius: 4, padding: '3px 10px', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
            fontWeight: value === it.key ? 600 : 400,
            background: value === it.key ? '#1e293b' : '#f5f4f0',
            color: value === it.key ? '#fff' : '#a09f99',
          }}>{it.label}</button>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Loop-38.2: Sub-view Components
═══════════════════════════════════════════════════════════ */

const S = {
  textPrimary: '#37352f',
  textSecondary: '#6b6a66',
  textTertiary: '#a09f99',
  border: '#e8e6df',
}

function Dot({ color, size = 7 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0 }} />
}

function Avatar({ member, size = 18 }) {
  const initial = (member?.displayName || member?.name || '?')[0].toUpperCase()
  const bg = member?.color || '#888'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.42, fontWeight: 600, flexShrink: 0,
    }}>
      {initial}
    </div>
  )
}

// Helper: filter milestones by depth
function filterByDepth(milestones, projectId, depthFilter) {
  const projMs = milestones.filter(m => m.project_id === projectId)
  if (depthFilter === 'all') return projMs
  const d = parseInt(depthFilter)
  // Flat projects (maxDepth 0) always show their milestones
  const hasDeepMs = projMs.some(m => (m.depth ?? 0) > 0)
  if (!hasDeepMs) return projMs // flat project, show all
  return projMs.filter(m => (m.depth ?? 0) === d)
}

// Helper: get task count for milestone
function getMsTaskCount(msId, tasks) {
  return tasks.filter(t => t.keyMilestoneId === msId && !t.deletedAt).length
}

// Helper: get assignee member
function getAssignee(ms, members) {
  if (!ms.owner_id) return null
  return members.find(m => m.userId === ms.owner_id) || null
}

/* ═══ SubviewMatrix — member × project grid ═══ */
function SubviewMatrix({ projects, milestones, tasks, members, depthFilter, showUnassigned, setShowUnassigned }) {
  const N = projects.length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `90px repeat(${N}, 1fr)`, gap: 0 }}>
      {/* Header row */}
      <div style={{ borderBottom: `1px solid ${S.border}` }} />
      {projects.map(p => {
        const c = getColor(p.color)
        const visibleMs = filterByDepth(milestones, p.id, depthFilter)
        return (
          <div key={p.id} style={{
            background: `${c.dot}10`, padding: '7px 8px',
            borderBottom: `1px solid ${S.border}`,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Dot color={c.dot} size={7} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: S.textPrimary }}>{p.name}</span>
            <span style={{ fontSize: 9, color: S.textTertiary, marginLeft: 'auto' }}>{visibleMs.length}</span>
          </div>
        )
      })}

      {/* Member rows */}
      {members.map(mem => (
        <>
          <div key={`label-${mem.id}`} style={{
            display: 'flex', alignItems: 'flex-start', gap: 4,
            padding: '6px 4px', borderBottom: `0.5px solid ${S.border}`,
          }}>
            <Avatar member={mem} size={20} />
            <span style={{ fontSize: 10.5, fontWeight: 600, color: S.textPrimary, lineHeight: 1.6 }}>
              {mem.displayName || mem.name}
            </span>
          </div>
          {projects.map(p => {
            const c = getColor(p.color)
            const visibleMs = filterByDepth(milestones, p.id, depthFilter).filter(m => m.owner_id === mem.userId)
            return (
              <div key={`${mem.id}-${p.id}`} style={{
                padding: '4px 4px', borderBottom: `0.5px solid ${S.border}`, background: `${c.dot}03`,
              }}>
                {visibleMs.length === 0 ? (
                  <span style={{ fontSize: 10, color: '#e0e0e0', padding: '4px 8px', display: 'block' }}>—</span>
                ) : visibleMs.map(ms => (
                  <CompactMsRow
                    key={ms.id}
                    milestone={ms}
                    milestones={milestones}
                    color={c.dot}
                    taskCount={getMsTaskCount(ms.id, tasks)}
                    assignee={getAssignee(ms, members)}
                  />
                ))}
              </div>
            )
          })}
        </>
      ))}

      {/* Unassigned row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 3, padding: '6px 4px',
        cursor: 'pointer', borderBottom: `0.5px solid ${S.border}`,
      }} onClick={() => setShowUnassigned(!showUnassigned)}>
        <span style={{ fontSize: 9, color: S.textTertiary }}>{showUnassigned ? '▾' : '▸'}</span>
        <span style={{ fontSize: 10, color: S.textTertiary, fontStyle: 'italic' }}>미배정</span>
      </div>
      {projects.map(p => {
        const c = getColor(p.color)
        const unassigned = filterByDepth(milestones, p.id, depthFilter).filter(m => !m.owner_id)
        return (
          <div key={`un-${p.id}`} style={{
            padding: '4px 4px', borderBottom: `0.5px solid ${S.border}`, background: `${c.dot}02`,
          }}>
            {!showUnassigned ? (
              <span style={{ fontSize: 10, color: S.textTertiary, padding: '2px 8px' }}>
                {unassigned.length > 0 ? `${unassigned.length}개` : '—'}
              </span>
            ) : unassigned.map(ms => (
              <CompactMsRow
                key={ms.id}
                milestone={ms}
                milestones={milestones}
                color={c.dot}
                taskCount={getMsTaskCount(ms.id, tasks)}
                assignee={null}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

/* ═══ SubviewProject — 2-column project cards ═══ */
function SubviewProject({ projects, milestones, tasks, members, depthFilter }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {projects.map(p => {
        const c = getColor(p.color)
        const visibleMs = filterByDepth(milestones, p.id, depthFilter)
        const assigned = visibleMs.filter(m => m.owner_id)
        const unassigned = visibleMs.filter(m => !m.owner_id)

        // Group by member
        const byMember = {}
        assigned.forEach(m => {
          const key = m.owner_id
          if (!byMember[key]) byMember[key] = []
          byMember[key].push(m)
        })

        return (
          <div key={p.id} style={{
            background: '#fff', borderRadius: 8, border: `0.5px solid ${S.border}`, overflow: 'hidden',
          }}>
            {/* Card header */}
            <div style={{
              background: `${c.dot}10`, padding: '8px 12px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Dot color={c.dot} size={8} />
              <span style={{ fontSize: 12, fontWeight: 700, color: S.textPrimary }}>{p.name}</span>
              <span style={{ fontSize: 10, color: S.textTertiary, marginLeft: 'auto' }}>{visibleMs.length} MS</span>
            </div>

            {/* Card body */}
            <div style={{ padding: '6px 8px' }}>
              {Object.entries(byMember).map(([userId, msList]) => {
                const mem = members.find(m => m.userId === userId)
                return (
                  <div key={userId} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 4px' }}>
                      <Avatar member={mem} size={16} />
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: S.textPrimary }}>
                        {mem?.displayName || mem?.name || '?'}
                      </span>
                      <span style={{ fontSize: 9, color: S.textTertiary }}>{msList.length}개</span>
                    </div>
                    {msList.map(ms => (
                      <CompactMsRow
                        key={ms.id}
                        milestone={ms}
                        milestones={milestones}
                        color={c.dot}
                        taskCount={getMsTaskCount(ms.id, tasks)}
                        assignee={mem}
                      />
                    ))}
                  </div>
                )
              })}

              {/* Unassigned section */}
              {unassigned.length > 0 && (
                <div style={{ marginTop: 4, paddingTop: 4, borderTop: `0.5px dashed ${S.border}` }}>
                  <span style={{ fontSize: 9.5, color: S.textTertiary, fontStyle: 'italic', padding: '0 4px' }}>
                    미배정 ({unassigned.length})
                  </span>
                  {unassigned.slice(0, 5).map(ms => (
                    <CompactMsRow
                      key={ms.id}
                      milestone={ms}
                      milestones={milestones}
                      color={c.dot}
                      taskCount={getMsTaskCount(ms.id, tasks)}
                      assignee={null}
                    />
                  ))}
                  {unassigned.length > 5 && (
                    <span style={{ fontSize: 9, color: S.textTertiary, padding: '2px 8px' }}>
                      ...외 {unassigned.length - 5}개
                    </span>
                  )}
                </div>
              )}

              {/* Empty state */}
              {assigned.length === 0 && unassigned.length === 0 && (
                <span style={{ fontSize: 10, color: S.textTertiary, padding: 8, display: 'block', textAlign: 'center' }}>
                  마일스톤 없음
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ═══ SubviewMember — member portfolio cards ═══ */
function SubviewMember({ projects, milestones, tasks, members, userId, depthFilter }) {
  const [showUnassignedCard, setShowUnassignedCard] = useState(false)

  return (
    <div>
      {/* Member cards */}
      {members.map(mem => {
        const myMs = []
        projects.forEach(p => {
          const c = getColor(p.color)
          const visibleMs = filterByDepth(milestones, p.id, depthFilter).filter(m => m.owner_id === mem.userId)
          if (visibleMs.length) myMs.push({ project: p, color: c, ms: visibleMs })
        })
        const totalMs = myMs.reduce((a, g) => a + g.ms.length, 0)
        const totalT = myMs.reduce((a, g) => a + g.ms.reduce((b, m) => b + getMsTaskCount(m.id, tasks), 0), 0)

        return (
          <div key={mem.id} style={{
            marginBottom: 8, background: '#fff', borderRadius: 8,
            border: `0.5px solid ${S.border}`, overflow: 'hidden',
          }}>
            {/* Card header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              background: '#fafaf8', borderBottom: `0.5px solid ${S.border}`,
            }}>
              <Avatar member={mem} size={22} />
              <span style={{ fontSize: 12, fontWeight: 700, color: S.textPrimary }}>
                {mem.displayName || mem.name}
              </span>
              <span style={{ fontSize: 10.5, color: S.textTertiary }}>{totalMs} MS · {totalT} 할일</span>
              {totalT > 10 && (
                <span style={{ fontSize: 9.5, color: '#ef4444', fontWeight: 600 }}>⚠ 과부하</span>
              )}
            </div>

            {/* Card body */}
            <div style={{ padding: '6px 8px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {myMs.length === 0 ? (
                <span style={{ fontSize: 10.5, color: S.textTertiary, fontStyle: 'italic', padding: 4 }}>
                  배정된 마일스톤 없음
                </span>
              ) : myMs.map(g => (
                <div key={g.project.id} style={{ minWidth: 200, flex: '1 1 220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 4px', marginBottom: 2 }}>
                    <Dot color={g.color.dot} size={6} />
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: g.color.dot }}>{g.project.name}</span>
                    <span style={{ fontSize: 9, color: S.textTertiary }}>{g.ms.length}개</span>
                  </div>
                  {g.ms.map(ms => (
                    <CompactMsRow
                      key={ms.id}
                      milestone={ms}
                      milestones={milestones}
                      color={g.color.dot}
                      taskCount={getMsTaskCount(ms.id, tasks)}
                      assignee={mem}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Unassigned card */}
      {(() => {
        const unassignedGroups = []
        projects.forEach(p => {
          const c = getColor(p.color)
          const visibleMs = filterByDepth(milestones, p.id, depthFilter).filter(m => !m.owner_id)
          if (visibleMs.length) unassignedGroups.push({ project: p, color: c, ms: visibleMs })
        })
        if (unassignedGroups.length === 0) return null
        const totalUn = unassignedGroups.reduce((a, g) => a + g.ms.length, 0)

        return (
          <div style={{
            marginTop: 8, background: '#fff', borderRadius: 8,
            border: `0.5px solid ${S.border}`, overflow: 'hidden',
          }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                background: '#fafaf8', borderBottom: `0.5px solid ${S.border}`, cursor: 'pointer',
              }}
              onClick={() => setShowUnassignedCard(!showUnassignedCard)}
            >
              <span style={{ fontSize: 9, color: S.textTertiary }}>{showUnassignedCard ? '▾' : '▸'}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: S.textTertiary }}>미배정</span>
              <span style={{ fontSize: 10.5, color: S.textTertiary }}>{totalUn}개</span>
            </div>
            {showUnassignedCard && (
              <div style={{ padding: '6px 8px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {unassignedGroups.map(g => (
                  <div key={g.project.id} style={{ minWidth: 200, flex: '1 1 220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 4px', marginBottom: 2 }}>
                      <Dot color={g.color.dot} size={6} />
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: g.color.dot }}>{g.project.name}</span>
                      <span style={{ fontSize: 9, color: S.textTertiary }}>{g.ms.length}개</span>
                    </div>
                    {g.ms.map(ms => (
                      <CompactMsRow
                        key={ms.id}
                        milestone={ms}
                        milestones={milestones}
                        color={g.color.dot}
                        taskCount={getMsTaskCount(ms.id, tasks)}
                        assignee={null}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
