import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { DndContext, DragOverlay, useDroppable, PointerSensor, TouchSensor, useSensors, useSensor } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import useStore from '../../hooks/useStore'
import useProjectFilter from '../../hooks/useProjectFilter'
import { useMilestonesByProjects } from '../../hooks/useMilestonesByProjects'
import useTeamMembers from '../../hooks/useTeamMembers'
import {
  buildTimelineTree, flattenVisibleRows, getColumns, getMonthHeaders,
  dateToColIndex, COL_WIDTHS, isSameDay, addMonths, startOfMonth, addDays,
} from '../../utils/timelineUtils'
import TimelineToolbar from './TimelineToolbar'
import TimelineLeftPanel from './TimelineLeftPanel'
import TimelineGrid from './TimelineGrid'

const LEFT_PANEL = 220
const LEFT_PANEL_MOBILE = 130

/**
 * Loop-34: TimelineEngine — 글로벌/프로젝트 타임라인 공유 엔진
 *
 * @param {string} rootLevel - 'project' (global) | 'milestone' (project)
 * @param {string|null} projectId - project mode only
 * @param {string} initialScale - 'month' | 'quarter' | 'year'
 * @param {string} initialDepth - 'project' | 'milestone' | 'task'
 */
export default function TimelineEngine({ rootLevel, projectId, initialScale = 'month', initialDepth = 'task' }) {
  const isProjectMode = !!projectId
  const {
    projects, tasks, openDetail, updateTask, reorderTasks, moveTaskTo,
    collapseState, toggleCollapse: storeToggle, currentTeamId,
  } = useStore()
  const { filteredProjects, filteredTasks } = useProjectFilter(projects, tasks)
  const isMobile = window.innerWidth < 768
  const panelW = isMobile ? LEFT_PANEL_MOBILE : LEFT_PANEL

  const today = useMemo(() => new Date(), [])
  const [baseDate, setBaseDate] = useState(() => startOfMonth(today))
  const [scale, setScale] = useState(initialScale)
  const gridRef = useRef(null)
  const [activeId, setActiveId] = useState(null)

  // ── Filter state ──
  const [depthFilter, setDepthFilter] = useState(
    isProjectMode ? (initialDepth === 'project' ? 'milestone' : initialDepth) : initialDepth
  )
  const [scopeFilter, setScopeFilter] = useState('all')
  const [selectedMembers, setSelectedMembers] = useState(null)
  const [showUnassigned, setShowUnassigned] = useState(true)
  const [selectedProjects, setSelectedProjects] = useState(null)
  const [showAssigneeOnBar, setShowAssigneeOnBar] = useState(false)

  // ── Expand/collapse state ──
  const [expandedIds, setExpandedIds] = useState(new Set())

  // ── Team members ──
  const [memberMap, setMemberMap] = useState({})
  const [memberList, setMemberList] = useState([])
  useEffect(() => {
    if (!currentTeamId) return
    useTeamMembers.getMembers(currentTeamId).then(members => {
      const map = {}
      members.forEach(m => { map[m.userId] = m.displayName })
      setMemberMap(map)
      setMemberList(members)
    })
  }, [currentTeamId])

  // ── Milestones ──
  const projectIds = useMemo(() => filteredProjects.map(p => p.id), [filteredProjects])
  const { milestones: allMilestones } = useMilestonesByProjects(projectIds)

  // ── Column computation ──
  const colW = COL_WIDTHS[scale]
  const columns = useMemo(() => getColumns(baseDate, scale), [baseDate, scale])
  const monthHeaders = useMemo(() => getMonthHeaders(baseDate, scale), [baseDate, scale])

  const todayCol = useMemo(() => {
    if (scale === 'year') {
      for (let i = columns.length - 1; i >= 0; i--) {
        if (columns[i].date <= today) return i
      }
      return -1
    }
    return columns.findIndex(c => isSameDay(c.date, today))
  }, [columns, today, scale])

  // ── Navigation ──
  const navigate = (dir) => {
    if (scale === 'month') setBaseDate(d => addMonths(d, dir))
    else if (scale === 'quarter') setBaseDate(d => addMonths(d, dir * 3))
    else setBaseDate(d => new Date(d.getFullYear() + dir, 0, 1))
  }
  const goToday = () => {
    setBaseDate(startOfMonth(today))
    setTimeout(() => {
      if (!gridRef.current) return
      const idx = columns.findIndex(c => isSameDay(c.date, today))
      if (idx >= 0) gridRef.current.scrollLeft = idx * colW - 200
    }, 50)
  }

  // Auto-scroll to today on mount / scale change
  useEffect(() => {
    setTimeout(() => {
      if (!gridRef.current) return
      const idx = columns.findIndex(c => {
        if (scale === 'year') return c.date <= today && addDays(c.date, 7) > today
        return isSameDay(c.date, today)
      })
      if (idx >= 0) gridRef.current.scrollLeft = Math.max(0, idx * colW - 200)
    }, 100)
  }, [scale, baseDate])

  // ── Build tree + apply filters ──
  const displayProjects = useMemo(() => {
    let result = isProjectMode
      ? filteredProjects.filter(p => p.id === projectId)
      : filteredProjects

    if (!isProjectMode && selectedProjects) {
      result = result.filter(p => selectedProjects.includes(p.id))
    }

    // Scope filter
    if (scopeFilter === 'team') result = result.filter(p => p.teamId)
    else if (scopeFilter === 'personal') result = result.filter(p => !p.teamId)

    return result
  }, [filteredProjects, selectedProjects, isProjectMode, projectId, scopeFilter])

  const displayTasks = useMemo(() => {
    let result = filteredTasks.filter(t => !t.deletedAt)
    if (isProjectMode) {
      result = result.filter(t => t.projectId === projectId)
    } else if (selectedProjects) {
      result = result.filter(t => selectedProjects.includes(t.projectId))
    }
    // Scope filter
    if (scopeFilter === 'team') result = result.filter(t => t.teamId)
    else if (scopeFilter === 'personal') result = result.filter(t => t.scope === 'private')

    // Assignee filter
    if (selectedMembers) {
      result = result.filter(t => {
        if (!t.assigneeId) return showUnassigned
        return selectedMembers.includes(t.assigneeId)
      })
    } else if (!showUnassigned) {
      result = result.filter(t => !!t.assigneeId)
    }

    return result
  }, [filteredTasks, selectedProjects, selectedMembers, showUnassigned, isProjectMode, projectId, scopeFilter])

  const tree = useMemo(() => {
    return buildTimelineTree({
      projects: displayProjects,
      milestones: allMilestones,
      tasks: displayTasks,
      members: memberList,
      rootLevel,
      projectId,
    })
  }, [displayProjects, allMilestones, displayTasks, memberList, rootLevel, projectId])

  // ── Expand state: reset on depthFilter change ──
  useEffect(() => {
    if (depthFilter === 'project') {
      setExpandedIds(new Set())
    } else if (depthFilter === 'milestone') {
      setExpandedIds(new Set(tree.filter(n => n.type === 'project').map(n => n.id)))
    } else {
      const allExpandable = []
      tree.forEach(p => {
        allExpandable.push(p.id)
        p.children.forEach(c => { if (c.type === 'milestone') allExpandable.push(c.id) })
      })
      setExpandedIds(new Set(allExpandable))
    }
  }, [depthFilter, tree.map(n => n.id).join(',')])

  const toggleExpand = useCallback((id) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ── Flatten rows for rendering ──
  const rows = useMemo(() => flattenVisibleRows(tree, depthFilter, expandedIds), [tree, depthFilter, expandedIds])
  const taskIds = useMemo(() => rows.filter(r => r.type === 'task').map(r => r.id), [rows])

  // ── DnD ──
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null

  const handleDragStart = (e) => setActiveId(e.active.id)
  const handleDragEnd = (e) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return

    const task = tasks.find(t => t.id === active.id)
    if (!task) return
    const overId = over.id

    if (typeof overId === 'string' && overId.startsWith('project:')) {
      const targetProjectId = overId.slice(8)
      if (task.projectId === targetProjectId) return
      moveTaskTo(active.id, targetProjectId, task.category)
      return
    }

    const overTask = tasks.find(t => t.id === overId)
    if (!overTask) return

    if (task.projectId === overTask.projectId) {
      const projectTasks = tasks
        .filter(t => t.projectId === task.projectId && !t.done)
        .sort((a, b) => a.sortOrder - b.sortOrder)
      const oldIndex = projectTasks.findIndex(t => t.id === active.id)
      const newIndex = projectTasks.findIndex(t => t.id === overId)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        reorderTasks(arrayMove(projectTasks, oldIndex, newIndex))
      }
    } else {
      moveTaskTo(active.id, overTask.projectId, task.category)
    }
  }

  // ── Period label ──
  const periodLabel = useMemo(() => {
    if (scale === 'month') return `${baseDate.getFullYear()}년 ${baseDate.getMonth() + 1}월`
    if (scale === 'quarter') {
      const m1 = baseDate.getMonth() + 1
      return `${baseDate.getFullYear()}년 ${m1}~${m1 + 2}월`
    }
    return `${baseDate.getFullYear()}년`
  }, [baseDate, scale])

  const prevLabel = scale === 'month' ? `${addMonths(baseDate, -1).getMonth() + 1}월` : scale === 'quarter' ? '이전' : `${baseDate.getFullYear() - 1}`
  const nextLabel = scale === 'month' ? `${addMonths(baseDate, 1).getMonth() + 1}월` : scale === 'quarter' ? '다음' : `${baseDate.getFullYear() + 1}`

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: isProjectMode ? '100%' : undefined,
      padding: isProjectMode ? 0 : (isMobile ? '20px 0 100px' : '40px 48px'),
    }}>
      <div style={{
        maxWidth: isProjectMode ? undefined : 1400,
        margin: isProjectMode ? 0 : '0 auto',
        flex: isProjectMode ? 1 : undefined,
        display: 'flex', flexDirection: 'column',
        width: isProjectMode ? undefined : '100%',
      }}>
        {/* Title (global mode only) */}
        {!isProjectMode && (
          <div style={{ marginBottom: 16, padding: isMobile ? '0 16px' : 0 }}>
            <h1 style={{ fontSize: 27, fontWeight: 700, color: '#37352f', margin: 0 }}>타임라인</h1>
            <p style={{ fontSize: 15, color: '#999', marginTop: 4 }}>{periodLabel}</p>
          </div>
        )}

        {/* Toolbar */}
        <TimelineToolbar
          depthFilter={depthFilter}
          onDepthChange={setDepthFilter}
          rootLevel={rootLevel}
          scopeFilter={scopeFilter}
          onScopeChange={setScopeFilter}
          hasTeam={!!currentTeamId}
          members={memberList}
          selectedMembers={selectedMembers}
          onMembersChange={setSelectedMembers}
          showUnassigned={showUnassigned}
          onToggleUnassigned={() => setShowUnassigned(v => !v)}
          projects={filteredProjects}
          selectedProjects={selectedProjects}
          onProjectsChange={setSelectedProjects}
          scale={scale}
          onScaleChange={setScale}
          periodLabel={periodLabel}
          prevLabel={prevLabel}
          nextLabel={nextLabel}
          onNavigate={navigate}
          onGoToday={goToday}
          showAssigneeOnBar={showAssigneeOnBar}
          onToggleAssigneeOnBar={currentTeamId ? () => setShowAssigneeOnBar(v => !v) : undefined}
          isProjectMode={isProjectMode}
        />

        {/* Main grid area */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', overflow: 'hidden', background: 'white', flex: isProjectMode ? 1 : undefined }}>
              {/* Left panel */}
              <TimelineLeftPanel
                rows={rows}
                expandedIds={expandedIds}
                onToggleExpand={toggleExpand}
                onOpenDetail={openDetail}
                activeId={activeId}
                panelW={panelW}
                isProjectMode={isProjectMode}
              />

              {/* Month header spacer sync */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Month header spacer for left panel alignment */}
                {scale !== 'month' && (
                  <div style={{ height: 0 }} />
                )}

                {/* Right grid */}
                <TimelineGrid
                  rows={rows}
                  columns={columns}
                  colW={colW}
                  scale={scale}
                  monthHeaders={monthHeaders}
                  todayCol={todayCol}
                  gridRef={gridRef}
                  activeId={activeId}
                  updateTask={updateTask}
                  openDetail={openDetail}
                  showAssigneeOnBar={showAssigneeOnBar}
                  memberMap={memberMap}
                />
              </div>
            </div>
          </SortableContext>

          {/* Drag overlay */}
          <DragOverlay dropAnimation={null}>
            {activeTask ? (
              <div style={{
                padding: '0 10px 0 16px', height: 26, display: 'flex', alignItems: 'center',
                background: 'white', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                border: '1px solid #e0e0e0', cursor: 'grabbing', width: 160,
              }}>
                <span style={{ fontSize: 12, color: '#37352f', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeTask.text}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Empty states */}
        {!projects.length && (
          <div style={{ padding: 60, textAlign: 'center', color: '#bbb', fontSize: 14 }}>프로젝트를 추가하면 타임라인이 표시됩니다</div>
        )}
        {projects.length > 0 && rows.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: '#bbb', fontSize: 14 }}>해당 필터에 맞는 항목이 없습니다</div>
        )}
      </div>
    </div>
  )
}
