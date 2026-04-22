import { useState, useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { COLOR } from '../../../styles/designTokens'
import { getColor, getColorByIndex } from '../../../utils/colors'
import BacklogItem from './BacklogItem'

/**
 * 백로그 패널 (좌측 230px).
 * - 프로젝트별/담당자별 토글 (로컬 state)
 * - 실시간 검색 (title + notes / title + description)
 * - useDroppable({ id: 'backlog' }) — 셀→백로그 되돌리기 타겟
 * - 배치 완료(scheduled_date !== null) 항목: opacity 0.3 + line-through
 */
export default function BacklogPanel({
  backlogTasks = [],
  backlogMilestones = [],
  tasks = [],
  milestones = [],
  projects = [],
  members = [],
  teamProjectIds,
}) {
  const [mode, setMode] = useState('project') // 'project' | 'member'
  const [search, setSearch] = useState('')
  // 프로젝트별 접기/펼치기 — 기본 전체 접힘 (expanded set이 비어있으면 모두 접힘)
  const [expandedProjectIds, setExpandedProjectIds] = useState(() => new Set())

  const toggleProject = (projectId) => {
    setExpandedProjectIds(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const { setNodeRef, isOver } = useDroppable({ id: 'backlog' })

  // 검색 필터: task = text+notes, ms = title+description
  const matches = (item, kind) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    if (kind === 'task') {
      return (item.text || '').toLowerCase().includes(q) ||
             (item.notes || '').toLowerCase().includes(q)
    }
    return (item.title || '').toLowerCase().includes(q) ||
           (item.description || '').toLowerCase().includes(q)
  }

  // 팀 프로젝트만 포함 — 개인 프로젝트 task/MS가 백로그에 섞이지 않도록
  const projectMap = useMemo(() => {
    const m = {}
    for (const p of projects) {
      if (teamProjectIds && !teamProjectIds.has(p.id)) continue
      m[p.id] = p
    }
    return m
  }, [projects, teamProjectIds])

  const memberColorMap = useMemo(() => {
    const map = {}
    const sorted = [...members].sort((a, b) => (a.userId || '').localeCompare(b.userId || ''))
    sorted.forEach((mem, i) => { map[mem.userId] = getColorByIndex(i) })
    return map
  }, [members])

  // 현재 모드가 필요로 하는 aggregation
  // 프로젝트별: projects → { project, tasks, milestones }
  // 담당자별: members → { member, projects → { project, tasks, milestones } }

  const totalUnscheduled = backlogTasks.length + backlogMilestones.length

  // 렌더용 구조 생성 — 프로젝트별
  const projectGroups = useMemo(() => {
    if (mode !== 'project') return []
    const groups = new Map()
    for (const t of tasks) {
      if (!projectMap[t.projectId] || !matches(t, 'task') || t.done || t.deletedAt) continue
      if (!groups.has(t.projectId)) {
        groups.set(t.projectId, { project: projectMap[t.projectId], tasks: [], milestones: [] })
      }
      groups.get(t.projectId).tasks.push(t)
    }
    for (const m of milestones) {
      if (!projectMap[m.project_id] || !matches(m, 'ms')) continue
      if (!groups.has(m.project_id)) {
        groups.set(m.project_id, { project: projectMap[m.project_id], tasks: [], milestones: [] })
      }
      groups.get(m.project_id).milestones.push(m)
    }
    return Array.from(groups.values())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tasks, milestones, projectMap, search])

  // 담당자별: member별 project 서브그룹
  const memberGroups = useMemo(() => {
    if (mode !== 'member') return []
    const out = members.map(mem => ({ member: mem, projectMap: new Map() }))
    for (const t of tasks) {
      if (!projectMap[t.projectId] || !matches(t, 'task') || t.done || t.deletedAt) continue
      if (!t.assigneeId) continue
      const bucket = out.find(g => g.member.userId === t.assigneeId)
      if (!bucket) continue
      if (!bucket.projectMap.has(t.projectId)) {
        bucket.projectMap.set(t.projectId, { project: projectMap[t.projectId], tasks: [], milestones: [] })
      }
      bucket.projectMap.get(t.projectId).tasks.push(t)
    }
    // MS는 owner_id 기준으로 담당자별 분배
    for (const m of milestones) {
      if (!projectMap[m.project_id] || !matches(m, 'ms')) continue
      if (!m.owner_id) continue
      const bucket = out.find(g => g.member.userId === m.owner_id)
      if (!bucket) continue
      if (!bucket.projectMap.has(m.project_id)) {
        bucket.projectMap.set(m.project_id, { project: projectMap[m.project_id], tasks: [], milestones: [] })
      }
      bucket.projectMap.get(m.project_id).milestones.push(m)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, members, tasks, milestones, projectMap, search])

  const panelStyle = {
    width: 230,
    flexShrink: 0,
    background: isOver ? 'rgba(49,130,206,0.08)' : COLOR.bgSurface,
    borderRight: `0.5px solid ${COLOR.border}`,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  }

  return (
    <div ref={setNodeRef} style={panelStyle}>
      {/* 헤더 */}
      <div style={{
        padding: '12px 12px 8px',
        borderBottom: `0.5px solid ${COLOR.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLOR.textPrimary }}>백로그</span>
          <span style={{ fontSize: 11, color: COLOR.textSecondary }}>{totalUnscheduled}건</span>
        </div>
        {/* 토글 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {['project', 'member'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 11,
                border: `0.5px solid ${COLOR.border}`,
                borderRadius: 4,
                background: mode === m ? COLOR.bgActive : 'white',
                color: mode === m ? COLOR.textPrimary : COLOR.textSecondary,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >{m === 'project' ? '프로젝트별' : '담당자별'}</button>
          ))}
        </div>
        {/* 검색 */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="검색..."
          style={{
            width: '100%',
            padding: '4px 8px',
            fontSize: 12,
            border: `0.5px solid ${COLOR.border}`,
            borderRadius: 4,
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* 스크롤 영역 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {mode === 'project' && projectGroups.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: COLOR.textTertiary }}>
            {search ? '검색 결과 없음' : '모든 항목이 배치되었습니다'}
          </div>
        )}
        {mode === 'project' && projectGroups.map(g => {
          const expanded = expandedProjectIds.has(g.project.id)
          return (
            <div key={g.project.id} style={{ marginBottom: 4 }}>
              <div
                onClick={() => toggleProject(g.project.id)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: COLOR.textPrimary,
                  display: 'flex', alignItems: 'center', gap: 6,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{
                  width: 10, flexShrink: 0,
                  fontSize: 9, color: '#888780',
                  lineHeight: 1,
                }}>
                  {expanded ? '▼' : '▶'}
                </span>
                <span style={{
                  width: 7, height: 7, borderRadius: 2,
                  background: getColor(g.project.color).dot,
                  flexShrink: 0,
                }} />
                <span>{g.project.name}</span>
                <span style={{ marginLeft: 'auto', color: '#888780', fontWeight: 400 }}>
                  {g.tasks.length + g.milestones.length}
                </span>
              </div>
              {expanded && (
                <>
                  {g.milestones.map(m => (
                    <BacklogItem key={`ms:${m.id}`} kind="ms" item={m} scheduled={!!m.scheduled_date} />
                  ))}
                  {g.tasks.map(t => (
                    <BacklogItem key={`task:${t.id}`} kind="task" item={t}
                      scheduled={!!t.scheduledDate}
                    />
                  ))}
                </>
              )}
            </div>
          )
        })}

        {mode === 'member' && memberGroups.every(g => g.projectMap.size === 0) && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: COLOR.textTertiary }}>
            {search ? '검색 결과 없음' : '담당자 배정된 항목이 없습니다'}
          </div>
        )}
        {mode === 'member' && memberGroups.map(g => {
          if (g.projectMap.size === 0) return null
          const color = memberColorMap[g.member.userId]?.dot || '#888'
          return (
            <div key={g.member.userId} style={{ marginBottom: 4 }}>
              <div style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                color: COLOR.textSecondary,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: color, flexShrink: 0,
                }} />
                <span>{g.member.displayName}</span>
              </div>
              {Array.from(g.projectMap.values()).map(sub => (
                <div key={sub.project.id}>
                  <div style={{
                    padding: '2px 10px 2px 18px',
                    fontSize: 10,
                    color: COLOR.textTertiary,
                  }}>{sub.project.name}</div>
                  {sub.milestones.map(m => (
                    <BacklogItem key={`ms:${m.id}`} kind="ms" item={m} scheduled={!!m.scheduled_date} />
                  ))}
                  {sub.tasks.map(t => (
                    <BacklogItem key={`task:${t.id}`} kind="task" item={t}
                      scheduled={!!t.scheduledDate}
                    />
                  ))}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
