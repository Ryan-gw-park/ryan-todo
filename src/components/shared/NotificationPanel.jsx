import { useState, useEffect, useCallback } from 'react'
import useStore from '../../hooks/useStore'
import useNotifications from '../../hooks/useNotifications'

const EVENT_ICONS = {
  completed: '✅',
  commented: '💬',
  assigned: '📌',
  created: '➕',
}

// 상대 시간 포맷
function relativeTime(dateStr) {
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export default function NotificationPanel() {
  const teamId = useStore(s => s.currentTeamId)
  const togglePanel = useStore(s => s.toggleNotificationPanel)
  const openDetail = useStore(s => s.openDetail)
  const tasks = useStore(s => s.tasks)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    if (!teamId) return
    setLoading(true)
    const data = await useNotifications.getNotifications(teamId)
    setNotifications(data)
    useNotifications.markAllRead()
    setLoading(false)
  }, [teamId])

  useEffect(() => { loadNotifications() }, [loadNotifications])

  const handleClick = (taskId) => {
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      togglePanel()
      openDetail(task)
    }
  }

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        onClick={togglePanel}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.15)',
          zIndex: 200, transition: 'opacity 0.2s',
        }}
      />

      {/* 패널 */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 380, maxWidth: '90vw', background: 'white',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.2s ease-out',
      }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid #f0f0f0',
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#37352f' }}>🔔 알림</span>
          <button
            onClick={togglePanel}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 18, color: '#999', padding: '2px 6px', fontFamily: 'inherit',
            }}
          >✕</button>
        </div>

        {/* 알림 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#999', fontSize: 13 }}>로딩 중...</div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#bbb', fontSize: 13 }}>알림이 없습니다</div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleClick(n.taskId)}
                style={{
                  padding: '12px 20px', cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8f8f8'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', gap: 10 }}>
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                    {EVENT_ICONS[n.eventType] || '📋'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#37352f', lineHeight: 1.5 }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                      {relativeTime(n.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 하단 안내 */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid #f0f0f0',
          textAlign: 'center', fontSize: 11, color: '#bbb',
        }}>
          최근 30일 알림 표시
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
