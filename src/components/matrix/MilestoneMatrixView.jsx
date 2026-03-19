import { useState, useEffect, useMemo } from 'react'
import useStore from '../../hooks/useStore'
import useTeamMembers from '../../hooks/useTeamMembers'
import { getColor } from '../../utils/colors'
import ProgressBar from '../common/ProgressBar'

/**
 * MilestoneMatrixView — 마일스톤 모드
 * 행 = 담당자별, 열 = 프로젝트별, 셀 = MS 카드
 * @param {Array} projects
 * @param {Array} milestones
 * @param {Array} tasks
 */
export default function MilestoneMatrixView({ projects, milestones, tasks }) {
  const currentTeamId = useStore(s => s.currentTeamId)
  const userName = useStore(s => s.userName) || '나'
  const [members, setMembers] = useState([])

  // 팀 모드: 멤버 로딩
  useEffect(() => {
    if (!currentTeamId) return
    let cancelled = false
    useTeamMembers.getMembers(currentTeamId).then(m => {
      if (!cancelled) setMembers(m)
    })
    return () => { cancelled = true }
  }, [currentTeamId])

  // 팀 프로젝트만 필터 (마일스톤 모드에서는 팀 프로젝트만 의미 있음)
  const teamProjects = useMemo(() => {
    if (!currentTeamId) return projects // 개인 모드: 모든 프로젝트
    return projects.filter(p => p.teamId === currentTeamId)
  }, [projects, currentTeamId])

  // 담당자 행 구성
  const memberRows = useMemo(() => {
    if (!currentTeamId || members.length === 0) {
      // 개인 모드: "나" 행만
      return [{ id: '_me', name: userName, userId: null }]
    }
    return members.map(m => ({
      id: m.id,
      name: m.displayName || m.email?.split('@')[0] || '?',
      userId: m.userId,
    }))
  }, [currentTeamId, members, userName])

  // MS별 할일 수 / 완료 수 계산
  const msStats = useMemo(() => {
    const stats = {}
    milestones.forEach(ms => { stats[ms.id] = { total: 0, done: 0 } })
    tasks.forEach(t => {
      if (!t.keyMilestoneId || !stats[t.keyMilestoneId]) return
      stats[t.keyMilestoneId].total += 1
      if (t.done) stats[t.keyMilestoneId].done += 1
    })
    return stats
  }, [milestones, tasks])

  // 미배정 MS (owner_id === null)
  const unassignedMs = useMemo(() =>
    milestones.filter(ms => !ms.owner_id),
  [milestones])

  const isMobile = window.innerWidth < 768
  const COL_COUNT = teamProjects.length
  const LW = isMobile ? 80 : 120

  if (teamProjects.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#999', padding: 40, fontSize: 13 }}>
        표시할 프로젝트가 없습니다.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `${LW}px repeat(${COL_COUNT}, minmax(160px, 1fr))`,
        gap: 1,
        minWidth: LW + COL_COUNT * 160,
      }}>
        {/* ─── Header row ─── */}
        <div style={{ padding: 8 }} />
        {teamProjects.map(p => {
          const c = getColor(p.color)
          return (
            <div key={p.id} style={{
              background: c.header, borderRadius: '8px 8px 0 0',
              padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </span>
            </div>
          )
        })}

        {/* ─── Member rows ─── */}
        {memberRows.map(mem => {
          const msForMember = (projId) => milestones.filter(ms => {
            if (ms.project_id !== projId) return false
            if (!currentTeamId) return true // 개인 모드: 모든 MS
            return ms.owner_id === mem.userId
          })

          return [
            // Row label
            <div key={`label-${mem.id}`} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: 8,
              borderBottom: '0.5px solid #e8e6df',
            }}>
              <MemberAvatar name={mem.name} />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#37352f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mem.name.split(' ')[0]}
              </span>
            </div>,

            // Cells per project
            ...teamProjects.map(p => {
              const c = getColor(p.color)
              const projMs = msForMember(p.id)
              return (
                <div key={`${mem.id}-${p.id}`} style={{
                  background: c.card, padding: 8, minHeight: 80,
                  borderBottom: '0.5px solid #e8e6df',
                }}>
                  {projMs.length === 0 && (
                    <span style={{ fontSize: 11, color: '#a09f99' }}>—</span>
                  )}
                  {projMs.map(ms => (
                    <MsCard key={ms.id} ms={ms} stats={msStats[ms.id]} />
                  ))}
                </div>
              )
            }),
          ]
        })}

        {/* ─── 미배정 row ─── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: 8,
          borderBottom: '0.5px solid #e8e6df',
        }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#a09f99', fontStyle: 'italic' }}>
            미배정
          </span>
        </div>
        {teamProjects.map(p => {
          const c = getColor(p.color)
          const projUnassigned = unassignedMs.filter(ms => ms.project_id === p.id)
          return (
            <div key={`unassign-${p.id}`} style={{
              background: c.card, padding: 8, minHeight: 40,
              borderBottom: '0.5px solid #e8e6df',
            }}>
              {projUnassigned.length === 0 && (
                <span style={{ fontSize: 11, color: '#a09f99' }}>—</span>
              )}
              {projUnassigned.map(ms => (
                <MsCard key={ms.id} ms={ms} stats={msStats[ms.id]} dimmed />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══ MS Card ═══ */
function MsCard({ ms, stats, dimmed }) {
  const done = stats?.done || 0
  const total = stats?.total || 0
  const color = ms.color || '#22c55e'
  const dueLabel = ms.end_date
    ? new Date(ms.end_date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
    : ''

  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: '8px 10px', marginBottom: 6,
      cursor: 'pointer', border: '0.5px solid #e8e6df',
      opacity: dimmed ? 0.7 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#37352f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ms.title || '(제목 없음)'}
        </span>
      </div>
      <ProgressBar done={done} total={total} color={color} width={50} />
      <div style={{ fontSize: 11, color: '#a09f99', marginTop: 2 }}>
        {total}건{dueLabel ? ` · ${dueLabel}` : ''}
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
