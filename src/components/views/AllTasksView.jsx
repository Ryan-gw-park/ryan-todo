import { useState, useEffect } from 'react'
import useStore from '../../hooks/useStore'
import useProjectFilter from '../../hooks/useProjectFilter'
import useTeamMembers from '../../hooks/useTeamMembers'
import ProjectFilter from '../shared/ProjectFilter'
import TaskItem from '../shared/TaskItem'
import { getColor } from '../../utils/colors'

// 카테고리 순서 + 아이콘
const CAT_ORDER = ['today', 'next', 'backlog', 'done']
const CAT_ICON = { today: '🔥', next: '📌', backlog: '📋', done: '✅' }

// 강조 색상
const HIGHLIGHT_COLORS = {
  red:    { bg: '#E53E3E' },
  orange: { bg: '#DD6B20' },
  yellow: { bg: '#D69E2E' },
  blue:   { bg: '#3182CE' },
  green:  { bg: '#38A169' },
  purple: { bg: '#805AD5' },
}

export default function AllTasksView() {
  const { tasks, projects, collapseState, toggleCollapse, setCollapseGroup, currentTeamId } = useStore()
  const { filteredProjects, filteredTasks } = useProjectFilter(projects, tasks)
  const collapsed = collapseState.allTasks || {}
  const isMobile = window.innerWidth < 768

  // 팀원 이름 조회 (팀 모드일 때)
  const [memberMap, setMemberMap] = useState({})
  useEffect(() => {
    if (!currentTeamId) return
    useTeamMembers.getMembers(currentTeamId).then(members => {
      const map = {}
      members.forEach(m => { map[m.userId] = m.displayName })
      setMemberMap(map)
    })
  }, [currentTeamId])

  const allCollapsed = filteredProjects.every(p => collapsed[p.id])
  const toggleAll = () => {
    const newState = {}
    filteredProjects.forEach(p => { newState[p.id] = !allCollapsed })
    setCollapseGroup('allTasks', newState)
  }

  return (
    <div data-view="allTasks" style={{ padding: isMobile ? '20px 16px 100px' : '40px 48px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* 상단 */}
        <div className="today-header" style={{ marginBottom: isMobile ? 16 : 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="today-greeting">
            <h1 style={{ fontSize: isMobile ? 18 : 26, fontWeight: 700, color: '#37352f', margin: 0 }}>모든 할일</h1>
          </div>
          <div className="today-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ProjectFilter />
            <button
              onClick={toggleAll}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#999', fontFamily: 'inherit', padding: '4px 0', whiteSpace: 'nowrap' }}
              onMouseEnter={e => e.currentTarget.style.color = '#37352f'}
              onMouseLeave={e => e.currentTarget.style.color = '#999'}
            >
              {allCollapsed ? '전체 펼치기' : '전체 접기'}
            </button>
          </div>
        </div>

        {/* 프로젝트별 할일 */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
          {filteredProjects.map(p => {
            const projectTasks = filteredTasks.filter(t => t.projectId === p.id)
            if (projectTasks.length === 0) return null

            const isCollapsed = collapsed[p.id]
            const color = getColor(p.color)
            // 카테고리 순서대로 정렬
            const sorted = [...projectTasks].sort((a, b) => {
              const catA = CAT_ORDER.indexOf(a.category)
              const catB = CAT_ORDER.indexOf(b.category)
              if (catA !== catB) return catA - catB
              return (a.sortOrder || 0) - (b.sortOrder || 0)
            })

            return (
              <div key={p.id} style={{
                background: color.card, borderRadius: 10, overflow: 'hidden',
                border: '1px solid rgba(0,0,0,0.04)',
              }}>
                {/* 프로젝트 헤더 */}
                <div
                  onClick={() => toggleCollapse('allTasks', p.id)}
                  style={{
                    background: color.header,
                    padding: '12px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: color.dot }} />
                    <span style={{ fontSize: isMobile ? 14 : 15, fontWeight: 600, color: color.text }}>{p.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: color.text, background: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '2px 8px', fontWeight: 600 }}>
                      {projectTasks.filter(t => !t.done).length}
                    </span>
                    <span style={{ color: color.text, opacity: 0.5, fontSize: 12, transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
                  </div>
                </div>

                {/* 할일 목록 */}
                {!isCollapsed && (
                  <div style={{ padding: '10px 16px' }}>
                    {sorted.map(t => {
                      const assigneeName = currentTeamId && t.assigneeId ? memberMap[t.assigneeId] : null
                      const hlColorKey = useStore.getState().getHighlightColor(t.id)
                      const hlColor = hlColorKey && HIGHLIGHT_COLORS[hlColorKey]
                      return (
                        <div key={t.id} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 4,
                          background: hlColor ? hlColor.bg : 'transparent',
                          borderRadius: 6,
                          padding: '2px 8px',
                          marginBottom: 1,
                        }}>
                          <span style={{ fontSize: 11, marginTop: 6, flexShrink: 0, width: 16, textAlign: 'center', color: hlColor ? '#fff' : undefined }}>
                            {CAT_ICON[t.category] || ''}
                          </span>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <TaskItem task={t} compact hlColor={hlColor?.bg} />
                            </div>
                            {assigneeName && (
                              <span style={{ fontSize: 11, color: hlColor ? 'rgba(255,255,255,0.8)' : '#aaa', fontWeight: 500, flexShrink: 0, marginLeft: 4 }}>
                                {assigneeName}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
        })}
        </div>

        {filteredProjects.every(p => filteredTasks.filter(t => t.projectId === p.id).length === 0) && (
          <div style={{ textAlign: 'center', color: '#bbb', padding: '40px 0', fontSize: 14 }}>
            할일이 없습니다
          </div>
        )}
      </div>
    </div>
  )
}
