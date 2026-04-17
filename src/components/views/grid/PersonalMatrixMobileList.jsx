import { useMemo, useCallback } from 'react'
import useStore, { getCachedUserId } from '../../../hooks/useStore'
import usePivotExpandState from '../../../hooks/usePivotExpandState'
import { COLOR } from '../../../styles/designTokens'

/* ═════════════════════════════════════════════
   PersonalMatrixMobileList — 모바일 전용 개인 할일 뷰
   프로젝트별로 위→아래 단일 리스트 (시간 카테고리 구분 없음).
   탭 가능한 체크박스 + 제목. 상세 진입 = 제목 탭.
   할일 추가는 App.jsx 전역 FAB(MobileAddSheet) 사용.
   ═════════════════════════════════════════════ */
export default function PersonalMatrixMobileList({ projects, tasks }) {
  const { pivotCollapsed, setPivotCollapsed } = usePivotExpandState('personal')
  const toggleDone = useStore(s => s.toggleDone)
  const openDetail = useStore(s => s.openDetail)
  const currentUserId = getCachedUserId()

  const myTasks = useMemo(() =>
    tasks.filter(t => t.assigneeId === currentUserId && !t.done && !t.deletedAt),
    [tasks, currentUserId]
  )

  const isExpanded = useCallback((pid) => {
    const explicit = pivotCollapsed[pid]
    if (explicit === true) return true
    if (explicit === false) return false
    // 모바일 기본: task 있는 프로젝트 펼침, 없으면 접기
    return myTasks.some(t => t.projectId === pid)
  }, [pivotCollapsed, myTasks])

  const toggleProject = useCallback((pid) => {
    setPivotCollapsed(pid, !isExpanded(pid))
  }, [isExpanded, setPivotCollapsed])

  return (
    <div style={{ paddingBottom: 80 }}>
      {projects.map(p => {
          const projTasks = myTasks
            .filter(t => t.projectId === p.id)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          const expanded = isExpanded(p.id)
          return (
            <div key={p.id} style={{ borderBottom: `1px solid ${COLOR.border}` }}>
              <div
                onClick={() => toggleProject(p.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 12, color: COLOR.textSecondary, width: 12 }}>
                  {expanded ? '▼' : '▶'}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: COLOR.textPrimary, flex: 1, minWidth: 0, wordBreak: 'keep-all' }}>
                  {p.name}
                </span>
                <span style={{ fontSize: 12, color: COLOR.textTertiary }}>
                  {projTasks.length}건
                </span>
              </div>
              {expanded && projTasks.length === 0 && (
                <div style={{ padding: '4px 14px 8px 32px', fontSize: 11, color: COLOR.textTertiary }}>
                  할일 없음
                </div>
              )}
              {expanded && projTasks.map(task => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '6px 14px 6px 32px',
                    background: '#fff',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!task.done}
                    onChange={() => toggleDone(task.id)}
                    style={{ flexShrink: 0, width: 16, height: 16, marginTop: 2 }}
                  />
                  <span
                    onClick={() => openDetail(task)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13,
                      color: COLOR.textPrimary,
                      wordBreak: 'keep-all',
                      overflowWrap: 'break-word',
                      lineHeight: 1.4,
                      cursor: 'pointer',
                    }}
                  >{task.text}</span>
                  <CategoryChip category={task.category} />
                </div>
              ))}
            </div>
          )
        })}
        {projects.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: 13 }}>
          표시할 프로젝트가 없습니다
        </div>
      )}
    </div>
  )
}

function CategoryChip({ category }) {
  const map = {
    today:   { label: '지금', bg: '#FAEEDA', fg: '#854F0B' },
    next:    { label: '다음', bg: '#E6F1FB', fg: '#0C447C' },
    backlog: { label: '남은', bg: '#F1EFE8', fg: '#6B6A66' },
  }
  const meta = map[category] || map.backlog
  return (
    <span style={{
      flexShrink: 0,
      fontSize: 10,
      fontWeight: 600,
      padding: '2px 6px',
      borderRadius: 10,
      background: meta.bg,
      color: meta.fg,
      alignSelf: 'flex-start',
      marginTop: 2,
    }}>{meta.label}</span>
  )
}
