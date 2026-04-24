import { useState, useMemo, useCallback } from 'react'
import useStore, { getCachedUserId } from '../../../hooks/useStore'
import usePivotExpandState from '../../../hooks/usePivotExpandState'
import { COLOR, FONT, LIST, SPACE } from '../../../styles/designTokens'
import PersonalTodoProjectGroup from './cells/PersonalTodoProjectGroup'

/* ═══════════════════════════════════════════════
   PersonalTodoListTable (Loop-45)
   백로그 영역 — 3섹션: [지금] [다음+남은 접힘 footer]

   F-01: "지금" = category='today' && !isFocus && !done && !deletedAt
   F-02: 하단 "다음/남은" 접힘 기본값
   F-10: assigneeId === userId && !done && !deletedAt (상위에서 선별)
   F-11: task 0건 프로젝트 렌더 skip
   F-12: 섹션 접힘 상태 = usePivotExpandState('personalSection')
   F-13: 지금 섹션 헤더 우측 "+ 새 할일" 인라인 입력

   각 섹션 내부 = 프로젝트 loop → ProjectGroup
   섹션 간 projects 순서 = props.projects (이미 sortProjectsLocally 적용)
   ═══════════════════════════════════════════════ */
export default function PersonalTodoListTable({ projects, tasks, milestones }) {
  const currentUserId = getCachedUserId()
  const addTask = useStore(s => s.addTask)
  const { pivotCollapsed: projectCollapsed, setPivotCollapsed: setProjectCollapsed } = usePivotExpandState('personal')
  const { pivotCollapsed: sectionCollapsed, setPivotCollapsed: setSectionCollapsed } = usePivotExpandState('personalSection')

  // 기본 필터 (F-10, F-15): 내 할일 + 미완료 + 미삭제 + 비포커스 (포커스는 우측 패널)
  const myTasks = useMemo(() =>
    tasks.filter(t =>
      t.assigneeId === currentUserId &&
      !t.done &&
      !t.deletedAt &&
      !t.isFocus
    ),
    [tasks, currentUserId]
  )

  // 섹션별 분할
  const todayTasks = useMemo(() => myTasks.filter(t => t.category === 'today'), [myTasks])
  const nextTasks = useMemo(() => myTasks.filter(t => t.category === 'next'), [myTasks])
  const backlogTasks = useMemo(() => myTasks.filter(t => t.category === 'backlog'), [myTasks])

  // 프로젝트 펼침 판정 — 자동: 해당 섹션에 task 있는 프로젝트
  const isProjectExpanded = useCallback((pid) => {
    const explicit = projectCollapsed[pid]
    if (explicit === true) return true
    if (explicit === false) return false
    return true // 기본 펼침 — task 있는 프로젝트만 렌더되므로 자동 펼침이 자연스러움
  }, [projectCollapsed])

  const toggleProjectExpand = useCallback((pid) => {
    setProjectCollapsed(pid, !isProjectExpanded(pid))
  }, [isProjectExpanded, setProjectCollapsed])

  // 다음/남은 섹션 접힘 (기본 접힘 = F-02)
  // sectionCollapsed[key] === false → 펼침, true/undefined → 접힘
  const isSectionExpanded = useCallback((key) => sectionCollapsed[key] === false, [sectionCollapsed])
  const toggleSection = useCallback((key) => {
    setSectionCollapsed(key, isSectionExpanded(key) ? true : false)
  }, [isSectionExpanded, setSectionCollapsed])

  // 프로젝트별 전체 task (흐림/포커스 카운트)
  const tasksByProjectAll = useMemo(() => {
    const m = new Map()
    for (const t of tasks) {
      if (t.assigneeId !== currentUserId) continue
      if (t.deletedAt) continue
      const arr = m.get(t.projectId) || []
      arr.push(t)
      m.set(t.projectId, arr)
    }
    return m
  }, [tasks, currentUserId])

  // '즉시' 시스템 프로젝트 id (F-13 "+ 새 할일" 기본 귀속지)
  const instantProjectId = useMemo(() => {
    const p = projects.find(x => x.userId === currentUserId && x.systemKey === 'instant')
    return p?.id || null
  }, [projects, currentUserId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: LIST.sectionGap }}>
      {/* ── 지금 할일 섹션 (F-01, F-13) ── */}
      <TodaySection
        projects={projects}
        tasks={todayTasks}
        milestones={milestones}
        allTasksMap={tasksByProjectAll}
        isProjectExpanded={isProjectExpanded}
        toggleProjectExpand={toggleProjectExpand}
        addTask={addTask}
        currentUserId={currentUserId}
        instantProjectId={instantProjectId}
      />

      {/* ── 다음 할일 섹션 (F-02) ── */}
      <CollapsibleSection
        label="다음 할일"
        tasks={nextTasks}
        projects={projects}
        milestones={milestones}
        allTasksMap={tasksByProjectAll}
        isExpanded={isSectionExpanded('next')}
        onToggle={() => toggleSection('next')}
        isProjectExpanded={isProjectExpanded}
        toggleProjectExpand={toggleProjectExpand}
      />

      {/* ── 남은 할일 섹션 (F-02) ── */}
      <CollapsibleSection
        label="남은 할일"
        tasks={backlogTasks}
        projects={projects}
        milestones={milestones}
        allTasksMap={tasksByProjectAll}
        isExpanded={isSectionExpanded('backlog')}
        onToggle={() => toggleSection('backlog')}
        isProjectExpanded={isProjectExpanded}
        toggleProjectExpand={toggleProjectExpand}
      />
    </div>
  )
}

/* ─── 지금 섹션 ─── */
function TodaySection({ projects, tasks, milestones, allTasksMap, isProjectExpanded, toggleProjectExpand, addTask, currentUserId, instantProjectId }) {
  const [adding, setAdding] = useState(false)
  const totalCount = tasks.length

  const handleAddFinish = (value) => {
    setAdding(false)
    const text = (value ?? '').trim()
    if (!text) return
    // F-13 + QA fix: '즉시' 프로젝트 기본 귀속.
    // projectId 미지정 시 task.projectId=null → 프로젝트 그룹 렌더에서 필터링되어 안 보임.
    // '즉시' seed 실패 상태면 경고만 하고 skip (UI 버튼 자체 유지, 다음 새로고침에 seed 재시도).
    if (!instantProjectId) {
      console.warn('[Loop-45] 즉시 프로젝트 미확보 — 빠른 추가 불가')
      return
    }
    addTask({
      text,
      projectId: instantProjectId,
      assigneeId: currentUserId,
      secondaryAssigneeId: null,
      keyMilestoneId: null,
      category: 'today',
      isFocus: false,
    })
  }

  return (
    <div>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 8, paddingBottom: 6,
        borderBottom: `1px solid ${COLOR.border}`,
      }}>
        <span style={{ fontSize: FONT.sectionTitle, fontWeight: 600, color: COLOR.textPrimary }}>
          지금 할일
        </span>
        <span style={{ fontSize: FONT.caption, color: COLOR.textTertiary }}>
          {totalCount}건
        </span>
        <div style={{ flex: 1 }} />
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            style={{
              border: `1px solid ${COLOR.border}`, background: '#fff',
              fontSize: FONT.caption, color: COLOR.textSecondary,
              padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + 새 할일
          </button>
        )}
      </div>

      {/* Inline add input */}
      {adding && (
        <div style={{ marginBottom: 8, padding: SPACE.cellPadding }}>
          <input
            autoFocus
            placeholder="할일 입력 후 Enter"
            style={{
              width: '100%', fontSize: FONT.body,
              border: `1px solid ${COLOR.border}`, borderRadius: 4,
              padding: '4px 8px', fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
            onBlur={e => handleAddFinish(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddFinish(e.target.value)
              if (e.key === 'Escape') setAdding(false)
            }}
          />
        </div>
      )}

      {/* Project blocks */}
      {projects.map(p => {
        const projTasks = tasks.filter(t => t.projectId === p.id)
        if (projTasks.length === 0) return null // F-11
        return (
          <PersonalTodoProjectGroup
            key={p.id}
            project={p}
            sectionTasks={projTasks}
            milestones={milestones}
            allProjectTasks={allTasksMap.get(p.id) || []}
            isExpanded={isProjectExpanded(p.id)}
            onToggle={() => toggleProjectExpand(p.id)}
          />
        )
      })}

      {totalCount === 0 && !adding && (
        <div style={{ padding: 20, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>
          지금 할일이 없습니다
        </div>
      )}
    </div>
  )
}

/* ─── 접힘 섹션 (다음/남은) ─── */
function CollapsibleSection({
  label, tasks, projects, milestones, allTasksMap,
  isExpanded, onToggle,
  isProjectExpanded, toggleProjectExpand,
}) {
  const totalCount = tasks.length

  return (
    <div>
      {/* Section header (clickable) */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 0', borderBottom: `1px solid ${COLOR.border}`,
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 11, color: COLOR.textSecondary, width: 12, textAlign: 'center' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
        <span style={{ fontSize: FONT.sectionTitle, fontWeight: 600, color: COLOR.textPrimary }}>
          {label}
        </span>
        <span style={{ fontSize: FONT.caption, color: COLOR.textTertiary }}>
          {totalCount}건
        </span>
      </div>

      {/* Projects (expanded only) */}
      {isExpanded && (
        <div style={{ marginTop: 8 }}>
          {projects.map(p => {
            const projTasks = tasks.filter(t => t.projectId === p.id)
            if (projTasks.length === 0) return null // F-11
            return (
              <PersonalTodoProjectGroup
                key={p.id}
                project={p}
                sectionTasks={projTasks}
                milestones={milestones}
                allProjectTasks={allTasksMap.get(p.id) || []}
                isExpanded={isProjectExpanded(p.id)}
                onToggle={() => toggleProjectExpand(p.id)}
              />
            )
          })}
          {totalCount === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.caption }}>
              항목 없음
            </div>
          )}
        </div>
      )}
    </div>
  )
}
