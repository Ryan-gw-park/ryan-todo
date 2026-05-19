import { useState, useMemo } from 'react'
import useStore, { getCachedUserId } from '../../hooks/useStore'
import MobileTabBar from './MobileTabBar'
import ByTodayTab from './tabs/ByTodayTab'
import ByProjectTab from './tabs/ByProjectTab'
import ByAgendaTab from './tabs/ByAgendaTab'
import ByMentionTab from './tabs/ByMentionTab'

function sortProjects(projects, localProjectOrder) {
  return [...projects].sort((a, b) => {
    const orderA = localProjectOrder[a.id] ?? a.sortOrder ?? 0
    const orderB = localProjectOrder[b.id] ?? b.sortOrder ?? 0
    return orderA - orderB
  })
}

export default function MobilePersonalPage({ onGoInput }) {
  const [tab, setTab] = useState('today')
  const currentUserId = getCachedUserId()
  const tasks = useStore(s => s.tasks)
  const projects = useStore(s => s.projects)
  const localProjectOrder = useStore(s => s.localProjectOrder)

  const sortedProjects = useMemo(
    () => sortProjects(projects, localProjectOrder),
    [projects, localProjectOrder]
  )

  const myTasks = useMemo(
    () => tasks.filter(t => t.assigneeId === currentUserId && !t.deletedAt),
    [tasks, currentUserId]
  )

  return (
    <div className="mobile-app" style={{ minHeight: '100vh', background: '#fafaf8' }}>
      {/* 상단 헤더 + 백 버튼 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 12px',
          background: '#fff',
          borderBottom: '1px solid #ececec',
        }}
      >
        <button
          onClick={onGoInput}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: 14,
            color: '#37352f',
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: '6px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ opacity: 0.6 }}>←</span> 입력
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#37352f' }}>
          개인 할일
        </span>
        <span style={{ width: 56 }} />
      </div>

      <MobileTabBar tab={tab} onChange={setTab} />

      <div key={tab}>
        {tab === 'today'   && <ByTodayTab   projects={sortedProjects} tasks={myTasks} />}
        {tab === 'project' && <ByProjectTab projects={sortedProjects} tasks={myTasks} />}
        {tab === 'agenda'  && <ByAgendaTab  projects={sortedProjects} tasks={myTasks} />}
        {tab === 'mention' && <ByMentionTab projects={sortedProjects} tasks={myTasks} />}
      </div>
    </div>
  )
}
