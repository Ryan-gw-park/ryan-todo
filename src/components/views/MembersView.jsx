import { useState, useMemo, useEffect, useCallback } from 'react'
import { COLOR, FONT } from '../../styles/designTokens'
import useStore from '../../hooks/useStore'
import useTeamMembers from '../../hooks/useTeamMembers'
import { getColor, getColorByIndex } from '../../utils/colors'
import MiniAvatar from './grid/shared/MiniAvatar'

/* ═══════════════════════════════════════════════════════
   MembersView — 팀원 뷰 (멤버 컬럼 칸반)
   12d: 워크로드 비교 분석 뷰, DnD v1 비활성
   ═══════════════════════════════════════════════════════ */

const COL_W = 240

export default function MembersView() {
  const tasks = useStore(s => s.tasks)
  const projects = useStore(s => s.projects)
  const currentTeamId = useStore(s => s.currentTeamId)
  const toggleDone = useStore(s => s.toggleDone)
  const openDetail = useStore(s => s.openDetail)
  const collapseState = useStore(s => s.collapseState)
  const storeToggleCollapse = useStore(s => s.toggleCollapse)

  const [members, setMembers] = useState([])
  useEffect(() => {
    if (!currentTeamId) { setMembers([]); return }
    useTeamMembers.getMembers(currentTeamId).then(setMembers)
  }, [currentTeamId])

  // 멤버 색상 매핑 (stable sort by userId)
  const sortedMembers = useMemo(() => [...members].sort((a, b) => (a.userId || '').localeCompare(b.userId || '')), [members])
  const memberColorMap = useMemo(() => {
    const map = {}
    sortedMembers.forEach((m, i) => { map[m.userId] = getColorByIndex(i) })
    return map
  }, [sortedMembers])

  // 팀 task (done/deleted 제외)
  const teamTasks = useMemo(() =>
    tasks.filter(t => t.teamId === currentTeamId && !t.done && !t.deletedAt),
    [tasks, currentTeamId]
  )

  // 멤버별 정담당 task 수
  const memberPrimaryCounts = useMemo(() => {
    const counts = {}
    members.forEach(m => { counts[m.userId] = 0 })
    teamTasks.forEach(t => { if (t.assigneeId && counts[t.assigneeId] !== undefined) counts[t.assigneeId]++ })
    return counts
  }, [members, teamTasks])

  // mount-time stable order (정담당 task 수 내림차순)
  const [sortedMemberIds, setSortedMemberIds] = useState(null)
  useEffect(() => {
    if (sortedMemberIds === null && members.length > 0) {
      const sorted = [...members]
        .map(m => ({ id: m.userId, count: memberPrimaryCounts[m.userId] || 0 }))
        .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
        .map(x => x.id)
      setSortedMemberIds(sorted)
    }
  }, [members, memberPrimaryCounts, sortedMemberIds])

  const handleRefreshSort = useCallback(() => setSortedMemberIds(null), [])

  // 밀도 토글
  const [density, setDensity] = useState(() => localStorage.getItem('membersViewDensity') || 'comfortable')
  const toggleDensity = useCallback(() => {
    setDensity(prev => {
      const next = prev === 'comfortable' ? 'compact' : 'comfortable'
      localStorage.setItem('membersViewDensity', next)
      return next
    })
  }, [])

  const isCompact = density === 'compact'

  // 프로젝트 접기 toggle (복합키: memberId:projectId)
  const membersViewCollapsed = collapseState.membersView || {}
  const toggleProjectGroup = useCallback((memberId, projectId) => {
    storeToggleCollapse('membersView', `${memberId}:${projectId}`)
  }, [storeToggleCollapse])

  if (!currentTeamId) {
    return <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary }}>팀을 선택하세요</div>
  }
  if (members.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary }}>팀원 정보를 불러오는 중...</div>
  }

  const orderedMembers = sortedMemberIds
    ? sortedMemberIds.map(id => members.find(m => m.userId === id)).filter(Boolean)
    : members

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', flexShrink: 0, borderBottom: `1px solid ${COLOR.border}` }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: COLOR.textPrimary }}>팀원</span>
        <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{members.length}명</span>
        <div style={{ flex: 1 }} />
        <button onClick={handleRefreshSort} title="멤버 정렬 새로고침"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: COLOR.textTertiary, padding: 4 }}>↻</button>
        <button onClick={toggleDensity}
          style={{ border: `1px solid ${COLOR.border}`, background: isCompact ? '#2C2C2A' : '#fff', color: isCompact ? '#fff' : COLOR.textSecondary, borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: FONT.caption, fontFamily: 'inherit' }}>
          {isCompact ? '컴팩트' : '편안'}
        </button>
      </div>

      {/* 컬럼 영역 (가로 스크롤) */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, padding: '12px 20px', minWidth: orderedMembers.length * (COL_W + 8), alignItems: 'flex-start' }}>
          {orderedMembers.map(mem => {
            const mColor = memberColorMap[mem.userId]?.dot || '#888'
            const primaryTasks = teamTasks.filter(t => t.assigneeId === mem.userId)
            const secondaryTasks = teamTasks.filter(t => t.secondaryAssigneeId === mem.userId && t.assigneeId !== mem.userId)
            const primaryCount = primaryTasks.length
            const secondaryCount = secondaryTasks.length

            // 프로젝트별 그룹핑 (정담당)
            const projGroups = {}
            primaryTasks.forEach(t => {
              if (!projGroups[t.projectId]) projGroups[t.projectId] = []
              projGroups[t.projectId].push(t)
            })

            return (
              <div key={mem.userId} style={{ width: COL_W, flexShrink: 0, background: '#fff', border: `1px solid ${COLOR.border}`, borderRadius: 10, overflow: 'hidden' }}>
                {/* 컬럼 헤더 (sticky) */}
                <div style={{
                  position: 'sticky', top: 0, zIndex: 3,
                  padding: '10px 12px', background: '#fff',
                  borderBottom: `1px solid ${COLOR.border}`,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <MiniAvatar name={mem.displayName || '?'} size={22} color={mColor} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: COLOR.textPrimary }}>{mem.displayName || '?'}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>
                    {primaryCount}{secondaryCount > 0 ? <span style={{ color: COLOR.textTertiary }}> +부 {secondaryCount}</span> : ''}
                  </span>
                </div>

                {/* 정담당 영역 */}
                <div style={{ padding: '8px 12px' }}>
                  {primaryCount === 0 && secondaryCount === 0 && (
                    <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: COLOR.textTertiary }}>할 일 없음</div>
                  )}
                  {primaryCount === 0 && secondaryCount > 0 && (
                    <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: COLOR.textTertiary }}>정담당 task 없음</div>
                  )}
                  {Object.entries(projGroups).map(([projId, tasks]) => {
                    const proj = projects.find(p => p.id === projId)
                    if (!proj) return null
                    const projColor = getColor(proj.color)
                    const isCollapsed = !!membersViewCollapsed[`${mem.userId}:${projId}`]
                    return (
                      <div key={projId} style={{ marginBottom: 6 }}>
                        {/* 프로젝트 헤더 */}
                        <div
                          onClick={() => toggleProjectGroup(mem.userId, projId)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
                            cursor: 'pointer', fontSize: 11, fontWeight: 600, color: COLOR.textSecondary,
                          }}
                        >
                          <span style={{ fontSize: 8, transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.12s' }}>▾</span>
                          <div style={{ width: 6, height: 6, borderRadius: 2, background: projColor.dot, flexShrink: 0 }} />
                          <span style={{ flex: 1 }}>{proj.name}</span>
                          <span style={{ fontWeight: 400, color: COLOR.textTertiary }}>{tasks.length}</span>
                        </div>
                        {/* Task 리스트 */}
                        {!isCollapsed && tasks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(t => (
                          <MemberTaskRow key={t.id} task={t} isCompact={isCompact} onToggle={toggleDone} onOpen={openDetail} />
                        ))}
                      </div>
                    )
                  })}
                </div>

                {/* 부담당 섹션 */}
                {secondaryCount > 0 && (
                  <div style={{ borderTop: '1px dashed #e8e6df', padding: '8px 12px' }}>
                    <div style={{ fontSize: 11, color: COLOR.textTertiary, fontWeight: 500, marginBottom: 4 }}>부담당 ({secondaryCount})</div>
                    {secondaryTasks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(t => {
                      const primaryMem = t.assigneeId ? members.find(m => m.userId === t.assigneeId) : null
                      return (
                        <div key={`${t.id}-sec`} style={{ opacity: 0.55, marginBottom: 2 }}>
                          <MemberTaskRow task={t} isCompact={isCompact} onToggle={() => {}} onOpen={openDetail} readOnly />
                          <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(0,0,0,0.05)', borderRadius: 3, marginLeft: 22, color: COLOR.textTertiary }}>
                            정 {primaryMem?.displayName || '미배정'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ═══ MemberTaskRow ═══ */
function MemberTaskRow({ task, isCompact, onToggle, onOpen, readOnly }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onOpen(task)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: isCompact ? '3px 12px 3px 22px' : '6px 12px 6px 22px',
        cursor: 'pointer', borderRadius: 3,
        background: hover ? COLOR.bgHover : 'transparent',
      }}
    >
      {/* Checkbox */}
      <div onClick={e => { e.stopPropagation(); if (!readOnly) onToggle(task.id) }} style={{
        width: 12, height: 12, borderRadius: 3, flexShrink: 0,
        border: '1.5px solid #ccc', background: '#fff',
        cursor: readOnly ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }} />
      {/* Text */}
      <span style={{
        flex: 1, fontSize: isCompact ? 11 : 12, color: COLOR.textPrimary,
        lineHeight: isCompact ? 1.3 : 1.4,
        whiteSpace: isCompact ? 'nowrap' : 'normal',
        overflow: isCompact ? 'hidden' : 'visible',
        textOverflow: isCompact ? 'ellipsis' : 'clip',
        wordBreak: 'break-word',
      }}>{task.text || '(제목 없음)'}</span>
      {/* Detail arrow */}
      {hover && (
        <div style={{ width: 14, height: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
          <svg width="8" height="8" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      )}
    </div>
  )
}
