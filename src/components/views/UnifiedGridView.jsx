import { useState, useMemo, useCallback, useEffect } from 'react'
import { COLOR, FONT, SPACE, VIEW_WIDTH, CHECKBOX } from '../../styles/designTokens'
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay, pointerWithin } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import useStore, { getCachedUserId } from '../../hooks/useStore'
import useTeamMembers from '../../hooks/useTeamMembers'
import useProjectFilter from '../../hooks/useProjectFilter'
import { getColor } from '../../utils/colors'

import { EMPTY_OBJ, getMonday, fmtDate, getWeekNumber } from './grid/constants'
// Pill removed (12f — top toggle removed)
import PersonalMatrixGrid from './grid/grids/PersonalMatrixGrid'
import TeamMatrixGrid from './grid/grids/TeamMatrixGrid'
import { dispatch as dispatchDrop, registerHandler } from '../../utils/dnd/dispatcher'
import {
  handleTeamMatrixTaskDrop,
  handleTeamMatrixBandDrop,
  handleTeamMatrixProjectHeaderDrop,
} from './grid/dnd/teamMatrixHandlers'

// team-tasks-band-dnd commit 11: team matrix handlers 등록.
// 모듈 import 시점 1회 등록 (HANDLERS map은 dispatcher 모듈 스코프).
registerHandler('team-matrix-task', handleTeamMatrixTaskDrop)
registerHandler('team-matrix-band', handleTeamMatrixBandDrop)
registerHandler('team-matrix-project-header', handleTeamMatrixProjectHeaderDrop)
// 주간 플래너 제거됨 (PersonalWeeklyGrid, TeamWeeklyGrid)

/* ═══════════════════════════════════════════════════════
   UnifiedGridView — 매트릭스 + 주간 플래너 통합 (Orchestrator)
   [매트릭스|주간 플래너] × [팀|개인] = 4가지 모드

   개인 매트릭스: 행=프로젝트, 열=카테고리(지금/다음/나중)
   팀 매트릭스:   행=프로젝트, 열=팀원
   개인 주간:     행=프로젝트, 열=요일
   팀 주간:       행=팀원,     열=요일

   Sub-grid 컴포넌트는 ./grid/grids/* 참조
   Cell 컴포넌트는 ./grid/cells/* 참조
   ═══════════════════════════════════════════════════════ */

export default function UnifiedGridView({ initialView = 'matrix', initialScope = 'personal' }) {
  const view = initialView // 12f: 사이드바에서 결정, 상단 토글 제거
  const scope = initialScope

  // 12f: focusMode 폐기 (today 필터로 대체)

  // ─── 팀 매트릭스 담당자별 그룹 토글 (12c) ───
  const [groupByOwner, setGroupByOwner] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('teamMatrixGroupByOwner') === 'true'
  })
  const toggleGroupByOwner = useCallback(() => {
    setGroupByOwner(prev => {
      const next = !prev
      try { localStorage.setItem('teamMatrixGroupByOwner', String(next)) } catch {}
      return next
    })
  }, [])

  // ─── Store ───
  const { projects, tasks, updateTask, moveTaskTo, reorderTasks, toggleDone, openDetail, addTask, sortProjectsLocally, updateMilestone, deleteMilestone, openConfirmDialog, moveMilestoneWithTasks, reorderMilestones } = useStore()
  const currentTeamId = useStore(s => s.currentTeamId)
  const milestones = useStore(s => s.milestones)
  const userId = getCachedUserId()
  const isMobile = window.innerWidth < 768
  const collapseKey = scope === 'team' ? 'matrix' : 'personalMatrix'
  const collapseState = useStore(s => s.collapseState)
  const collapsed = collapseState[collapseKey] || EMPTY_OBJ
  const toggleCollapse = useStore(s => s.toggleCollapse)
  const toggleProjectCollapse = useCallback((pid) => toggleCollapse(collapseKey, pid), [collapseKey, toggleCollapse])
  // ─── MS collapse (matrix only) ───
  const matrixMsCollapsed = collapseState.matrixMs || EMPTY_OBJ
  const toggleMatrixMsCollapse = useCallback((msId) => toggleCollapse('matrixMs', msId), [toggleCollapse])
  // ─── Done section collapse (matrix only) — projectId → boolean (default true=접힘) ───
  const matrixDoneCollapsed = collapseState.matrixDone || EMPTY_OBJ
  const toggleMatrixDoneCollapse = useCallback((pid) => {
    // 기본이 접힘(true)이므로 첫 클릭 시 false(펼침)로 명시 set
    const cur = collapseState.matrixDone?.[pid]
    const next = cur === false ? true : false
    useStore.getState().setCollapseValue('matrixDone', pid, next)
  }, [collapseState.matrixDone])

  // ─── Team members ───
  const [members, setMembers] = useState([])
  useEffect(() => {
    if (!currentTeamId) return
    let cancelled = false
    useTeamMembers.getMembers(currentTeamId).then(m => { if (!cancelled) setMembers(m) })
    return () => { cancelled = true }
  }, [currentTeamId])

  // ─── Week navigation ───
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const weekDays = useMemo(() => [0, 1, 2, 3, 4].map(i => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d
  }), [weekStart])
  const weekDateStrs = useMemo(() => weekDays.map(fmtDate), [weekDays])
  const todayStr = fmtDate(new Date())
  const prevWeek = () => setWeekStart(p => { const d = new Date(p); d.setDate(d.getDate() - 7); return d })
  const nextWeek = () => setWeekStart(p => { const d = new Date(p); d.setDate(d.getDate() + 7); return d })
  const goThisWeek = () => setWeekStart(getMonday(new Date()))

  // ─── Project filter ───
  const { filteredProjects, filteredTasks } = useProjectFilter(projects, tasks)
  const displayProjects = useMemo(() => {
    // Loop-46 QA fix: DB 상태 불일치 방어 — isSystem OR systemKey='instant'
    const isSys = (p) => p.isSystem === true || p.systemKey === 'instant'
    if (scope === 'team') {
      // 팀 매트릭스: 팀 프로젝트만 (system project 제외)
      return currentTeamId ? sortProjectsLocally(filteredProjects.filter(p => !isSys(p) && p.teamId === currentTeamId)) : []
    }
    // Loop-45: 개인 뷰 순서 = 시스템 → 팀 → 개인 (사이드바와 동일)
    const systemPs = sortProjectsLocally(filteredProjects.filter(isSys))
    const teamPs = currentTeamId ? sortProjectsLocally(filteredProjects.filter(p => !isSys(p) && p.teamId === currentTeamId)) : []
    const personalPs = sortProjectsLocally(filteredProjects.filter(p => !isSys(p) && !p.teamId))
    return [...systemPs, ...teamPs, ...personalPs]
  }, [scope, currentTeamId, filteredProjects, sortProjectsLocally])

  const myTasks = useMemo(() => {
    if (scope === 'personal') return tasks.filter(t => t.assigneeId === userId)
    return filteredTasks
  }, [scope, tasks, filteredTasks, userId])

  // ─── Inline edit (task) ───
  const [editingId, setEditingId] = useState(null)
  const handleEditFinish = useCallback((taskId, newText) => {
    setEditingId(null)
    if (newText && newText.trim()) updateTask(taskId, { text: newText.trim() })
  }, [updateTask])

  // ─── Inline edit (milestone) ───
  const [editingMsId, setEditingMsId] = useState(null)
  const onStartMsEdit = useCallback((msId) => {
    setEditingId(null) // task 편집 종료
    setEditingMsId(msId)
  }, [])
  const cancelMsEdit = useCallback(() => setEditingMsId(null), [])
  const handleMsEditFinish = useCallback((msId, value) => {
    setEditingMsId(null)
    if (value && value.trim()) updateMilestone(msId, { title: value.trim() })
  }, [updateMilestone])
  const handleMsDelete = useCallback((msId, msTitle) => {
    openConfirmDialog({
      target: 'milestone',
      targetId: msId,
      targetName: msTitle || '제목 없음',
    })
  }, [openConfirmDialog])

  // ─── DnD ───
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)
  const [activeId, setActiveId] = useState(null)
  const activeItem = useMemo(() => {
    if (!activeId) return null
    const id = String(activeId)
    // 12b: project-lane 분기
    if (id.startsWith('project-lane:')) {
      const proj = projects.find(p => p.id === id.slice(13))
      if (!proj) return null
      return { type: 'project-lane', data: proj }
    }
    if (id.startsWith('bl-ms:')) {
      const ms = milestones.find(m => m.id === id.slice(6))
      return ms ? { type: 'ms', data: ms } : null
    }
    if (id.startsWith('cell-ms:')) {
      const ms = milestones.find(m => m.id === id.slice(8))
      return ms ? { type: 'ms', data: ms } : null
    }
    // 7-E1: cell-task: prefix 인식
    const taskId = id.startsWith('bl-task:') ? id.slice(8)
      : id.startsWith('cell-task:') ? id.slice(10)
      : id
    const task = tasks.find(t => t.id === taskId)
    return task ? { type: 'task', data: task } : null
  }, [activeId, tasks, milestones, projects])

  const handleDragStart = (e) => setActiveId(e.active.id)

  const handleDragEnd = useCallback((e) => {
    setActiveId(null)

    // team-tasks-band-dnd commit 9: dispatcher 우선 시도 (spec §12.1, §12.2)
    // 등록된 type 핸들러가 처리하면 true → early return.
    // 미등록 type 또는 type 없음 → false → 아래 string-prefix fallback 실행.
    // 점진 마이그레이션 단계: 새 DnD 사용처는 data.current.type 등록 필수.
    const ctx = {
      tasks, projects, milestones, members,
      currentTeamId, currentUserId: userId,
      updateTask, reorderTasks, reorderMilestones, moveMilestoneWithTasks,
    }
    const handled = dispatchDrop(e, ctx)
    if (handled) return

    const { active, over } = e
    if (!over) return
    const activeIdStr = String(active.id)
    const overId = String(over.id)

    // 12b: project-lane DnD (다른 분기보다 먼저)
    if (activeIdStr.startsWith('project-lane:')) {
      if (!overId.startsWith('project-lane:')) return
      if (activeIdStr === overId) return
      const activeSection = active.data.current?.section
      const overSection = over.data.current?.section
      if (activeSection && overSection && activeSection !== overSection) return

      const activePid = active.data.current?.projectId
      const overPid = over.data.current?.projectId
      if (!activePid || !overPid) return

      const { projects: allProj } = useStore.getState()
      const sortProjectsLocallyFn = useStore.getState().sortProjectsLocally
      let sectionList
      if (activeSection === 'team') {
        sectionList = sortProjectsLocallyFn(allProj.filter(p => p.teamId === currentTeamId && !p.archivedAt))
      } else {
        sectionList = sortProjectsLocallyFn(allProj.filter(p => !p.teamId && !p.archivedAt))
      }
      const oldIdx = sectionList.findIndex(p => p.id === activePid)
      const newIdx = sectionList.findIndex(p => p.id === overPid)
      if (oldIdx === -1 || newIdx === -1) return
      const reordered = arrayMove(sectionList, oldIdx, newIdx)
      useStore.getState().reorderProjects(reordered)
      return
    }

    // ── source 식별 ──
    const isMs = activeIdStr.startsWith('bl-ms:') || activeIdStr.startsWith('cell-ms:')
    const msId = isMs
      ? (activeIdStr.startsWith('bl-ms:') ? activeIdStr.slice(6) : activeIdStr.slice(8))
      : null

    const taskId = !isMs
      ? (activeIdStr.startsWith('bl-task:') ? activeIdStr.slice(8)
        : activeIdStr.startsWith('cell-task:') ? activeIdStr.slice(10)
        : activeIdStr)
      : null
    const task = !isMs ? tasks.find(t => t.id === taskId) : null

    // ═══ 1) over가 cell-task: (sortable item 위에 drop) ═══
    // 7-E1 fix-2: parts.length 체크 앞에 위치 — 'cell-task:xxx' 는 split 결과 length 2이므로
    //             이전에는 parts.length<3 차단으로 도달 불가했음
    if (overId.startsWith('cell-task:')) {
      const overTaskId = overId.slice(10)
      const overTask = tasks.find(t => t.id === overTaskId)
      if (!overTask) return

      // MS source — over task의 셀로 cascade
      if (isMs) {
        moveMilestoneWithTasks(msId, {
          targetProjectId: overTask.projectId,
          targetOwnerId: overTask.assigneeId || userId,
        })
        return
      }

      // Task source — sortable end
      if (!task || overTaskId === task.id) return

      const sameCell = (
        task.projectId === overTask.projectId &&
        task.assigneeId === overTask.assigneeId &&
        task.category === overTask.category
      )

      if (sameCell) {
        // 같은 셀 sortable end → reorder (필요시 keyMilestoneId 변경)
        const cellTasks = tasks.filter(t =>
          t.projectId === task.projectId &&
          t.assigneeId === task.assigneeId &&
          t.category === task.category &&
          !t.done
        ).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

        const oldIndex = cellTasks.findIndex(t => t.id === task.id)
        const newIndex = cellTasks.findIndex(t => t.id === overTaskId)
        if (oldIndex === -1 || newIndex === -1) return

        // cross-MS-group within same cell — keyMilestoneId 변경
        if (task.keyMilestoneId !== overTask.keyMilestoneId) {
          updateTask(task.id, {
            keyMilestoneId: overTask.keyMilestoneId,
          })
        }
        const reordered = arrayMove(cellTasks, oldIndex, newIndex)
        reorderTasks(reordered)
      } else {
        // 다른 셀 — over task의 위치로 cross-cell move
        // R5 차단을 위해 keyMilestoneId 명시 보존
        updateTask(task.id, {
          projectId: overTask.projectId,
          assigneeId: overTask.assigneeId,
          category: overTask.category,
          keyMilestoneId: task.keyMilestoneId,
        })
      }
      return
    }

    // ═══ 1.5) over가 cell-ms: (MS 헤더 위에 drop) — 7-E2 ═══
    if (overId.startsWith('cell-ms:')) {
      const overMsId = overId.slice(8)
      const overMs = milestones.find(m => m.id === overMsId)
      if (!overMs) return

      // MS source — MS sortable end (same cell) or cascade (cross cell)
      if (isMs) {
        if (msId === overMsId) return
        const activeMs = milestones.find(m => m.id === msId)
        if (!activeMs) return

        const sameCell = (
          activeMs.project_id === overMs.project_id &&
          activeMs.owner_id === overMs.owner_id
        )

        if (sameCell) {
          // 같은 셀 내 MS 순서 변경
          const cellMs = milestones.filter(m =>
            m.project_id === activeMs.project_id &&
            m.owner_id === activeMs.owner_id
          ).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

          const oldIndex = cellMs.findIndex(m => m.id === msId)
          const newIndex = cellMs.findIndex(m => m.id === overMsId)
          if (oldIndex === -1 || newIndex === -1) return

          const reordered = arrayMove(cellMs, oldIndex, newIndex)
          reorderMilestones(reordered)
        } else {
          // 다른 셀 — over MS의 cell로 cascade
          moveMilestoneWithTasks(msId, {
            targetProjectId: overMs.project_id,
            targetOwnerId: overMs.owner_id,
          })
        }
        return
      }

      // Task source — task를 MS 헤더 위로 drop = keyMilestoneId 변경
      if (!task) return
      const sameCell = (
        task.projectId === overMs.project_id &&
        task.assigneeId === overMs.owner_id
      )

      if (sameCell) {
        // 같은 셀 — keyMilestoneId만 변경
        if (task.keyMilestoneId === overMsId) return
        updateTask(task.id, { keyMilestoneId: overMsId })
      } else {
        // 다른 셀 — cross-cell + keyMilestoneId 새 MS로 set
        updateTask(task.id, {
          projectId: overMs.project_id,
          assigneeId: overMs.owner_id,
          category: 'today',
          keyMilestoneId: overMsId,
        })
      }
      return
    }

    // ═══ 2) over가 droppable cell zone (mat/tmat/pw/tw) ═══
    const parts = overId.split(':')
    if (parts.length < 3) return
    const mode = parts[0]

    // MS source → cell drop
    if (isMs) {
      let targetProjectId = null
      let targetOwnerId = null
      if (mode === 'mat') {
        const [, projId] = parts
        targetProjectId = projId
        targetOwnerId = userId
      } else {
        // tmat 제거 (12c — 팀 매트릭스는 더 이상 DroppableCell 미사용)
        // pw/tw weekly: MS drop 무시
        return
      }
      moveMilestoneWithTasks(msId, { targetProjectId, targetOwnerId })
      return
    }

    // Task source → cell drop
    if (!task) return

    if (mode === 'mat') {
      const [, targetProjId, targetCat] = parts
      if (task.projectId === targetProjId && task.category === targetCat) return
      moveTaskTo(taskId, targetProjId, targetCat)
    } else if (mode === 'pw') {
      const [, , targetDate] = parts
      if (task.dueDate === targetDate) return
      updateTask(taskId, { dueDate: targetDate })
    } else if (mode === 'tw') {
      const [, targetMemberId, targetDate] = parts
      if (task.assigneeId === targetMemberId && task.dueDate === targetDate) return
      updateTask(taskId, { assigneeId: targetMemberId, dueDate: targetDate, scope: 'assigned' })
    }
  }, [tasks, projects, milestones, currentTeamId, moveTaskTo, updateTask, moveMilestoneWithTasks, userId, reorderTasks, reorderMilestones])

  // ─── Date strings ───
  const today = new Date()
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 ${['일', '월', '화', '수', '목', '금', '토'][today.getDay()]}요일`
  const weekNum = getWeekNumber(weekStart)
  const weekRange = `${weekStart.getFullYear()}.${String(weekStart.getMonth() + 1).padStart(2, '0')}.${String(weekStart.getDate()).padStart(2, '0')} ~ ${String(weekDays[4].getMonth() + 1).padStart(2, '0')}.${String(weekDays[4].getDate()).padStart(2, '0')} (${weekNum}주차)`

  // ─── Title ───
  const title = scope === 'team' ? '팀 할일' : '개인 할일'

  // ─── Guard ───
  if (scope === 'team' && !currentTeamId) {
    return <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>팀을 선택하세요.</div>
  }
  if (scope === 'team' && view !== 'matrix' && members.length === 0) {
    // Team weekly needs members; matrix can wait for members too
  }

  return (
    <div data-view="unified-grid" style={{ padding: isMobile ? SPACE.viewPaddingMobile : SPACE.viewPadding, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: VIEW_WIDTH.wide, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* ═══ Header ═══ */}
        <div style={{ marginBottom: 16, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: FONT.viewTitle, fontWeight: 700, color: COLOR.textPrimary, margin: 0, letterSpacing: '-0.02em' }}>{title}</h1>
            <div style={{ flex: 1 }} />
            {/* 12f: 상단 뷰 토글 제거 — 사이드바 메뉴로 일원화 */}
            {view === 'matrix' && scope === 'team' && (
              <button
                onClick={toggleGroupByOwner}
                style={{
                  border: `1px solid ${COLOR.border}`,
                  background: groupByOwner ? '#2C2C2A' : '#fff',
                  color: groupByOwner ? '#fff' : COLOR.textSecondary,
                  borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                  fontSize: FONT.caption, fontFamily: 'inherit', fontWeight: 500,
                }}
              >{groupByOwner ? '담당자별' : '목록형'}</button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: FONT.subtitle, color: COLOR.textTertiary }}>{dateStr}</span>
          </div>
        </div>

        {/* ═══ Grid + Sidebar ═══ */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>
          <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {view === 'matrix' && scope === 'personal' && (
                <PersonalMatrixGrid
                  projects={displayProjects} myTasks={myTasks}
                  collapsed={collapsed} toggleCollapse={toggleProjectCollapse}
                  toggleDone={toggleDone} openDetail={openDetail} activeId={activeId}
                  matrixMsCollapsed={matrixMsCollapsed}
                  toggleMatrixMsCollapse={toggleMatrixMsCollapse}
                  handleMsDelete={handleMsDelete}
                  matrixDoneCollapsed={matrixDoneCollapsed}
                  toggleMatrixDoneCollapse={toggleMatrixDoneCollapse}
                />
              )}
              {view === 'matrix' && scope === 'team' && (
                <TeamMatrixGrid
                  projects={displayProjects} tasks={filteredTasks} members={members}
                  collapsed={collapsed} toggleCollapse={toggleProjectCollapse}
                  toggleDone={toggleDone} openDetail={openDetail} activeId={activeId}
                  currentTeamId={currentTeamId}
                  groupByOwner={groupByOwner}
                />
              )}
              {/* 주간 플래너 제거됨 */}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeItem?.type === 'project-lane' ? (
                <div style={{
                  background: '#fff', border: '1px solid #e8e6df', borderRadius: 10,
                  padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'grabbing',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: getColor(activeItem.data.color).dot, flexShrink: 0 }} />
                  <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary }}>{activeItem.data.name}</span>
                </div>
              ) : activeItem?.type === 'task' ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                  background: '#fff', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  border: '1px solid rgba(0,0,0,0.06)', transform: 'rotate(2deg)', cursor: 'grabbing', maxWidth: 240,
                }}>
                  <div style={{ width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, border: `1.5px solid ${CHECKBOX.borderColor}`, flexShrink: 0 }} />
                  <span style={{ fontSize: FONT.body, color: COLOR.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeItem.data.text}</span>
                </div>
              ) : activeItem?.type === 'ms' ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                  background: '#fff', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  border: '1px solid rgba(0,0,0,0.06)', transform: 'rotate(2deg)', cursor: 'grabbing', maxWidth: 240,
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: COLOR.textTertiary, flexShrink: 0 }} />
                  <span style={{ fontSize: FONT.body, fontWeight: 500, color: COLOR.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeItem.data.title || '(제목 없음)'}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  )
}

/* ─── Styles ─── */
// navBtnStyle is inline to avoid TDZ in Vite production builds
// (module-level const referencing imported COLOR causes 'Cannot access R before initialization')
