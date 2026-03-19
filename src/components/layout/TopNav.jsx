import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../hooks/useStore'
import { PlusIcon, ViewIcons } from '../shared/Icons'
import TeamSwitcher from '../team/TeamSwitcher'
import useNotifications from '../../hooks/useNotifications'
import MobileAddSheet from './MobileAddSheet'

const VIEWS = [
  { id: 'today', label: '오늘 할일', icon: ViewIcons.today },
  { id: 'allTasks', label: '전체 할일', icon: '📋' },
  { id: 'matrix', label: '매트릭스', icon: ViewIcons.matrix },
  { id: 'project', label: '프로젝트', icon: ViewIcons.project },
  { id: 'timeline', label: '타임라인', icon: ViewIcons.timeline },
  { id: 'weekly', label: '주간 플래너', icon: '📅' },
  { id: 'memory', label: '노트', icon: ViewIcons.memory },
]

export default function TopNav() {
  const navigate = useNavigate()
  const { currentView, setView, userName } = useStore()
  const teamId = useStore(s => s.currentTeamId)
  const toggleNotificationPanel = useStore(s => s.toggleNotificationPanel)
  const showNotificationPanel = useStore(s => s.showNotificationPanel)
  const refreshTrigger = useStore(s => s.notificationRefreshTrigger)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showAddModal, setShowAddModal] = useState(false)

  // Loop-23: SyncProvider trigger 기반 뱃지 갱신 (30초 폴링 제거)
  useEffect(() => {
    if (!teamId) { setUnreadCount(0); return }
    let cancelled = false
    const check = async () => {
      const count = await useNotifications.getUnreadCount(teamId)
      if (!cancelled) setUnreadCount(count)
    }
    check()
    return () => { cancelled = true }
  }, [teamId, showNotificationPanel, refreshTrigger])

  return (
    <div style={{ borderBottom: '1px solid #f0f0f0', background: 'white', position: 'sticky', top: 0, zIndex: 50 }} className="desktop-nav">
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 48px', display: 'flex', alignItems: 'center', height: 52 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 20, flexShrink: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 700, fontFamily: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif", lineHeight: 1, paddingTop: 1, flexShrink: 0 }}>{userName ? userName[0].toUpperCase() : 'R'}</div>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#37352f' }}>{userName ? `${userName}'s Todo` : 'Todo'}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 2 }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, background: currentView === v.id ? '#f0f0f0' : 'transparent', color: currentView === v.id ? '#37352f' : '#999', transition: 'all 0.1s' }}
              onMouseEnter={e => { if (currentView !== v.id) e.currentTarget.style.background = '#f8f8f8' }}
              onMouseLeave={e => { if (currentView !== v.id) e.currentTarget.style.background = 'transparent' }}
            >
              {v.icon}{v.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => navigate('/help')}
            title="사용법"
            style={{
              background: 'none', border: '1px solid #e8e8e8', borderRadius: '50%',
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#999',
            }}
          >?</button>
          {teamId && (
            <button onClick={toggleNotificationPanel} title="알림" style={{
              position: 'relative', background: 'none', border: '1px solid #e8e8e8', borderRadius: '50%',
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0,
            }}>
              🔔
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: '#E53E3E' }} />
              )}
            </button>
          )}
          <TeamSwitcher />
          <button onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, border: 'none', fontFamily: 'inherit', background: '#37352f', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}><PlusIcon /> 새 할일</button>
          <button onClick={() => navigate('/profile')} title="내 정보"
            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #e8e8e8', background: '#f5f5f5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#999', fontFamily: 'inherit', marginLeft: 4 }}
            onMouseEnter={e => e.currentTarget.style.background = '#eee'}
            onMouseLeave={e => e.currentTarget.style.background = '#f5f5f5'}
          >{userName ? userName[0].toUpperCase() : '?'}</button>
        </div>
      </div>
      {showAddModal && <MobileAddSheet onClose={() => setShowAddModal(false)} />}
    </div>
  )
}
