import { useState, useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { COLOR, FONT } from '../../styles/designTokens'
import useStore from '../../hooks/useStore'
import { getColor } from '../../utils/colors'
import { computeDepth, getProjectMaxDepth } from '../../utils/milestoneTree'

/* ═══════════════════════════════════════════════════════
   MsBacklogSidebar — MS 배정 모드 백로그 사이드바
   팀/개인 매트릭스 공용
   ═══════════════════════════════════════════════════════ */

export default function MsBacklogSidebar({ projects, milestones, tasks, weekDateStrs }) {
  const [blProject, setBlProject] = useState('all')
  const [blAssign, setBlAssign] = useState('unassigned')
  const [contentType, setContentType] = useState('ms') // 'ms' | 'task'
  const [blTime, setBlTime] = useState('outside') // 'outside' | 'overdue' | 'unscheduled' | 'future'

  // Per-project depth map: { projectId: depthLevel }
  const [depthMap, setDepthMap] = useState(() => {
    const map = {}
    projects.forEach(p => { map[p.id] = 0 })
    return map
  })

  const setDepth = (pid, d) => setDepthMap(prev => ({ ...prev, [pid]: d }))

  // Compute max depth per project — parent_id 체인 기반 (DB depth 필드 사용 안함)
  const maxDepthMap = useMemo(() => {
    const map = {}
    projects.forEach(p => { map[p.id] = getProjectMaxDepth(milestones, p.id) })
    return map
  }, [projects, milestones])

  // Filter MS for backlog
  const backlogMs = useMemo(() => {
    let result = milestones

    // Project filter
    if (blProject !== 'all') {
      result = result.filter(m => m.project_id === blProject)
    }

    // Depth filter — parent_id 체인 기반 실제 depth (DB depth 필드 사용 안함)
    result = result.filter(m => {
      const targetDepth = depthMap[m.project_id] ?? 0
      const projMs = milestones.filter(ms => ms.project_id === m.project_id)
      return computeDepth(m, projMs) === targetDepth
    })

    // Assignment filter
    if (blAssign === 'unassigned') result = result.filter(m => !m.owner_id)
    else if (blAssign === 'assigned') result = result.filter(m => !!m.owner_id)

    return result
  }, [milestones, blProject, blAssign, depthMap])

  // Group MS by project
  const backlogByProject = useMemo(() => {
    const map = {}
    backlogMs.forEach(m => {
      if (!map[m.project_id]) map[m.project_id] = []
      map[m.project_id].push(m)
    })
    return map
  }, [backlogMs])

  // Filter tasks for backlog
  const backlogTasks = useMemo(() => {
    let result = tasks.filter(t => !t.done && !t.deletedAt)

    // Project filter
    if (blProject !== 'all') {
      result = result.filter(t => t.projectId === blProject)
    }

    // Assignment filter
    if (blAssign === 'unassigned') result = result.filter(t => !t.assigneeId)
    else if (blAssign === 'assigned') result = result.filter(t => !!t.assigneeId)

    // Weekly time filter (주간 플래너 모드일 때만 적용)
    if (weekDateStrs) {
      const weekStart = weekDateStrs[0]
      const weekEnd = weekDateStrs[weekDateStrs.length - 1]
      if (blTime === 'outside') {
        result = result.filter(t => !t.dueDate || !weekDateStrs.includes(t.dueDate))
      } else if (blTime === 'overdue') {
        result = result.filter(t => t.dueDate && t.dueDate < weekStart)
      } else if (blTime === 'unscheduled') {
        result = result.filter(t => !t.dueDate)
      } else if (blTime === 'future') {
        result = result.filter(t => t.dueDate && t.dueDate > weekEnd)
      }
    }

    return result.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [tasks, blProject, blAssign, weekDateStrs, blTime])

  // Group tasks by project
  const tasksByProject = useMemo(() => {
    const map = {}
    backlogTasks.forEach(t => {
      if (!map[t.projectId]) map[t.projectId] = []
      map[t.projectId].push(t)
    })
    return map
  }, [backlogTasks])

  // Get parent MS name for breadcrumb
  const msMap = useMemo(() => {
    const map = {}
    milestones.forEach(m => { map[m.id] = m })
    return map
  }, [milestones])

  const getParentPath = (ms) => {
    if (!ms.parent_id) return null
    const parts = []
    let current = msMap[ms.parent_id]
    const visited = new Set()
    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      parts.unshift(current.title || '?')
      current = current.parent_id ? msMap[current.parent_id] : null
    }
    return parts.length > 0 ? parts.join(' > ') : null
  }

  // MS task count
  const getTaskCount = (msId) => {
    return tasks.filter(t => t.keyMilestoneId === msId && !t.deletedAt).length
  }

  const pill = (active, label, onClick) => (
    <button onClick={onClick} style={{
      border: 'none', borderRadius: 4, padding: '3px 10px', fontSize: 10.5,
      fontFamily: 'inherit', cursor: 'pointer',
      fontWeight: active ? 600 : 400,
      background: active ? '#fff' : 'transparent',
      color: active ? COLOR.textPrimary : COLOR.textTertiary,
      boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
    }}>{label}</button>
  )

  // Projects that have multi-depth MS
  const multiDepthProjects = projects.filter(p => (maxDepthMap[p.id] || 0) > 0)

  return (
    <div style={{
      width: 280, flexShrink: 0, borderLeft: `1px solid ${COLOR.border}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: '#fafaf8',
    }}>
      {/* Header + filters */}
      <div style={{ padding: '12px 12px 8px', borderBottom: `1px solid ${COLOR.border}` }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLOR.textPrimary, marginBottom: 10 }}>백로그</div>

        {/* Project dropdown */}
        <select value={blProject} onChange={e => setBlProject(e.target.value)}
          style={{
            width: '100%', padding: '5px 8px', borderRadius: 6,
            border: `1px solid ${COLOR.border}`, fontSize: 11, fontFamily: 'inherit',
            color: COLOR.textPrimary, background: '#fff', marginBottom: 8, cursor: 'pointer',
          }}
        >
          <option value="all">전체 프로젝트</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {/* Content type toggle */}
        <div style={{ display: 'flex', gap: 2, background: '#f0efeb', borderRadius: 6, padding: 2, marginBottom: 6 }}>
          {pill(contentType === 'ms', 'MS', () => setContentType('ms'))}
          {pill(contentType === 'task', '할일', () => setContentType('task'))}
        </div>

        {/* Assignment filter */}
        <div style={{ display: 'flex', gap: 2, background: '#f0efeb', borderRadius: 6, padding: 2, marginBottom: weekDateStrs ? 6 : 8 }}>
          {pill(blAssign === 'all', '전체', () => setBlAssign('all'))}
          {pill(blAssign === 'unassigned', '미배정', () => setBlAssign('unassigned'))}
          {pill(blAssign === 'assigned', '배정됨', () => setBlAssign('assigned'))}
        </div>

        {/* Weekly time filter (주간 플래너 모드) */}
        {weekDateStrs && contentType === 'task' && (
          <div style={{ display: 'flex', gap: 2, background: '#f0efeb', borderRadius: 6, padding: 2, marginBottom: 8 }}>
            {pill(blTime === 'outside', '이번 주 외', () => setBlTime('outside'))}
            {pill(blTime === 'overdue', '지연', () => setBlTime('overdue'))}
            {pill(blTime === 'unscheduled', '미설정', () => setBlTime('unscheduled'))}
            {pill(blTime === 'future', '예정', () => setBlTime('future'))}
          </div>
        )}

        {/* Per-project depth selector — L1/L2/L3 (MS only) */}
        {contentType === 'ms' && multiDepthProjects.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10, color: COLOR.textTertiary, marginBottom: 6, fontWeight: 500 }}>프로젝트별 배정 단위</div>
            {multiDepthProjects.map(p => {
              const c = getColor(p.color)
              const maxD = maxDepthMap[p.id] || 0
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: COLOR.textSecondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  {Array.from({ length: maxD + 1 }, (_, d) => (
                    <button key={d} onClick={() => setDepth(p.id, d)} style={{
                      fontSize: 9, padding: '1px 6px', borderRadius: 3, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: (depthMap[p.id] ?? 0) === d ? c.dot : '#eee',
                      color: (depthMap[p.id] ?? 0) === d ? '#fff' : COLOR.textTertiary,
                      fontWeight: (depthMap[p.id] ?? 0) === d ? 600 : 400,
                    }}>L{d + 1}</button>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {contentType === 'ms' ? (
          <>
            {Object.entries(backlogByProject).map(([pid, msList]) => {
              const p = projects.find(pr => pr.id === pid)
              if (!p) return null
              const c = getColor(p.color)
              return (
                <div key={pid} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0', marginBottom: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: c.dot }}>{p.name}</span>
                    <span style={{ fontSize: 9, color: COLOR.textTertiary, marginLeft: 'auto' }}>{msList.length}개</span>
                  </div>
                  {msList.map(ms => (
                    <BacklogMsItem key={ms.id} ms={ms} dotColor={c.dot} getParentPath={getParentPath} getTaskCount={getTaskCount} />
                  ))}
                </div>
              )
            })}
            {backlogMs.length === 0 && (
              <div style={{ textAlign: 'center', color: COLOR.textTertiary, fontSize: 11, padding: 20 }}>
                {blAssign === 'unassigned' ? '미배정 MS가 없습니다' : '해당 필터에 맞는 MS가 없습니다'}
              </div>
            )}
          </>
        ) : (
          <>
            {Object.entries(tasksByProject).map(([pid, taskList]) => {
              const p = projects.find(pr => pr.id === pid)
              if (!p) return null
              const c = getColor(p.color)
              return (
                <div key={pid} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0', marginBottom: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: c.dot }}>{p.name}</span>
                    <span style={{ fontSize: 9, color: COLOR.textTertiary, marginLeft: 'auto' }}>{taskList.length}건</span>
                  </div>
                  {taskList.map(task => (
                    <BacklogTaskItem key={task.id} task={task} dotColor={c.dot} />
                  ))}
                </div>
              )
            })}
            {backlogTasks.length === 0 && (
              <div style={{ textAlign: 'center', color: COLOR.textTertiary, fontSize: 11, padding: 20 }}>
                {blAssign === 'unassigned' ? '미배정 할일이 없습니다' : '해당 필터에 맞는 할일이 없습니다'}
              </div>
            )}
          </>
        )}
      </div>

      {/* Hint */}
      <div style={{ padding: '8px 12px', borderTop: `1px solid ${COLOR.border}`, textAlign: 'center' }}>
        <span style={{ fontSize: 10, color: COLOR.textTertiary }}>← 셀로 드래그하여 {contentType === 'ms' ? 'MS' : '할일'} 배정</span>
      </div>
    </div>
  )
}

/* ─── Draggable backlog items (dnd-kit) ─── */

function BacklogMsItem({ ms, dotColor, getParentPath, getTaskCount }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `bl-ms:${ms.id}` })
  const parentPath = getParentPath(ms)
  const tc = getTaskCount(ms.id)
  const [hover, setHover] = useState(false)
  return (
    <div
      ref={setNodeRef} {...attributes} {...listeners}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 8px', marginBottom: 3, borderRadius: 5,
        background: hover ? `${dotColor}15` : `${dotColor}08`,
        border: `0.5px solid ${hover ? `${dotColor}40` : `${dotColor}18`}`,
        cursor: 'grab', fontSize: 11, transition: 'all 0.1s',
        opacity: isDragging ? 0.3 : 1,
      }}
    >
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, color: COLOR.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ms.title || '(제목 없음)'}
        </div>
        {parentPath && (
          <div style={{ fontSize: 8.5, color: COLOR.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {parentPath}
          </div>
        )}
      </div>
      {tc > 0 && <span style={{ fontSize: 9, color: COLOR.textTertiary, flexShrink: 0 }}>{tc}</span>}
    </div>
  )
}

function BacklogTaskItem({ task, dotColor }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `bl-task:${task.id}` })
  const [hover, setHover] = useState(false)
  return (
    <div
      ref={setNodeRef} {...attributes} {...listeners}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 5,
        padding: '4px 8px', marginBottom: 3, borderRadius: 5,
        background: hover ? `${dotColor}12` : `${dotColor}06`,
        border: `0.5px solid ${hover ? `${dotColor}35` : `${dotColor}15`}`,
        cursor: 'grab', fontSize: 11, transition: 'all 0.1s',
        opacity: isDragging ? 0.3 : 1,
      }}
    >
      <div style={{
        width: 12, height: 12, borderRadius: 2, flexShrink: 0, marginTop: 1,
        border: `1.5px solid ${COLOR.textTertiary}`, background: '#fff',
      }} />
      <span style={{
        flex: 1, fontWeight: 400, color: COLOR.textPrimary, lineHeight: 1.4,
        whiteSpace: 'normal', wordBreak: 'break-word',
      }}>
        {task.text}
      </span>
      {task.dueDate && (
        <span style={{ fontSize: 9, color: COLOR.textTertiary, flexShrink: 0 }}>{task.dueDate.slice(5)}</span>
      )}
    </div>
  )
}
