import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../hooks/useStore'
import useNotifications from '../../hooks/useNotifications'
import MobileDrawer from './MobileDrawer'

const VIEW_NAMES = {
  today: '오늘할일',
  matrix: '매트릭스',
  project: '프로젝트',
  timeline: '타임라인',
  memory: '노트',
}

export default function MobileTopBar() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const currentView = useStore(s => s.currentView)
  const userName = useStore(s => s.userName)
  const teamId = useStore(s => s.currentTeamId)
  const toggleNotificationPanel = useStore(s => s.toggleNotificationPanel)
  const showNotificationPanel = useStore(s => s.showNotificationPanel)
  const refreshTrigger = useStore(s => s.notificationRefreshTrigger)
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!teamId) { setUnreadCount(0); return }
    let cancelled = false
    useNotifications.getUnreadCount(teamId).then(count => {
      if (!cancelled) setUnreadCount(count)
    })
    return () => { cancelled = true }
  }, [teamId, showNotificationPanel, refreshTrigger])

  return (
    <>
      <div className="mobile-topbar" style={{
        padding: '10px 16px', borderBottom: '1px solid #f0f0f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: '#fff', zIndex: 100,
      }}>
        {/* 좌측: 햄버거 + 현재 뷰 이름 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setDrawerOpen(true)}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: '2px 4px', color: '#37352f', lineHeight: 1 }}
          >
            ☰
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#37352f' }}>
            {VIEW_NAMES[currentView] || currentView}
          </span>
        </div>

        {/* 우측: 알림 + 프로필 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {teamId && (
            <button
              onClick={toggleNotificationPanel}
              style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', position: 'relative', padding: '2px 4px', lineHeight: 1 }}
            >
              🔔
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: '#E53E3E' }} />
              )}
            </button>
          )}
          <button
            onClick={() => navigate('/profile')}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: '1px solid #e8e8e8',
              background: '#f5f5f5', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, color: '#999', fontFamily: 'inherit',
            }}
          >
            {userName ? userName[0].toUpperCase() : '?'}
          </button>
        </div>
      </div>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
