import { useNavigate } from 'react-router-dom'
import useStore from '../../hooks/useStore'
import { ViewIcons } from '../shared/Icons'

const TABS = [
  { id: 'personal-matrix', label: '매트릭스', icon: ViewIcons.matrix },
  { id: 'personal-weekly', label: '주간 플래너', icon: '📅' },
  { id: 'project', label: '프로젝트', icon: ViewIcons.project },
  { id: 'memory', label: '노트', icon: ViewIcons.memory },
]

const menuBtnStyle = {
  width: '100%', padding: '10px 20px', background: 'none',
  border: 'none', textAlign: 'left', fontSize: 14,
  cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', gap: 10,
}

export default function MobileDrawer({ open, onClose }) {
  const navigate = useNavigate()
  const { currentView, setView, userName } = useStore()
  const teamId = useStore(s => s.currentTeamId)
  const myTeams = useStore(s => s.myTeams)
  const setTeam = useStore(s => s.setTeam)
  const currentTeam = myTeams.find(t => t.id === teamId)
  const teamName = currentTeam?.name || null

  if (!open) return null

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
          zIndex: 200, transition: 'opacity 0.2s',
        }}
      />

      {/* 드로어 패널 */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 260,
        background: '#fff', zIndex: 201, padding: '20px 0',
        boxShadow: '4px 0 20px rgba(0,0,0,0.1)',
        animation: 'slideInLeft 0.2s ease',
        overflowY: 'auto',
      }}>
        {/* 사용자 정보 */}
        <div style={{ padding: '0 20px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: '#1E293B',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 16, fontWeight: 700,
              fontFamily: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
              flexShrink: 0,
            }}>{userName ? userName[0].toUpperCase() : 'R'}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#37352f' }}>{userName || 'User'}</div>
              <div style={{ fontSize: 12, color: '#999' }}>{teamName || '개인 모드'}</div>
            </div>
          </div>
        </div>

        {/* 뷰 메뉴 */}
        <nav style={{ padding: '12px 0' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setView(tab.id); onClose() }}
              style={{
                ...menuBtnStyle,
                fontWeight: currentView === tab.id ? 600 : 400,
                color: currentView === tab.id ? '#37352f' : '#888',
                background: currentView === tab.id ? '#f5f5f5' : 'none',
              }}
            >
              <span style={{ opacity: currentView === tab.id ? 1 : 0.5 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div style={{ borderTop: '1px solid #f0f0f0', margin: '0 20px' }} />

        {/* 팀 설정 + 내 정보 */}
        <div style={{ padding: '12px 0' }}>
          {teamId && (
            <button
              onClick={() => { navigate('/team/settings'); onClose() }}
              style={{ ...menuBtnStyle, color: '#888' }}
            >
              <span style={{ fontSize: 14 }}>⚙</span> 팀 설정
            </button>
          )}
          <button
            onClick={() => { navigate('/profile'); onClose() }}
            style={{ ...menuBtnStyle, color: '#888' }}
          >
            <span style={{ fontSize: 14 }}>👤</span> 내 정보
          </button>
          <button
            onClick={() => { navigate('/help'); onClose() }}
            style={{ ...menuBtnStyle, color: '#888' }}
          >
            <span style={{ fontSize: 14 }}>📖</span> 사용법
          </button>
        </div>

        {/* 팀 전환 */}
        {myTeams.length > 0 && (
          <>
            <div style={{ borderTop: '1px solid #f0f0f0', margin: '0 20px' }} />
            <div style={{ padding: '12px 20px' }}>
              <div style={{ fontSize: 11, color: '#bbb', marginBottom: 8, fontWeight: 600 }}>팀 전환</div>
              {myTeams.map(team => (
                <button
                  key={team.id}
                  onClick={() => { setTeam(team.id); onClose() }}
                  style={{
                    width: '100%', padding: '8px 0', background: 'none', border: 'none',
                    textAlign: 'left', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                    fontWeight: team.id === teamId ? 600 : 400,
                    color: team.id === teamId ? '#37352f' : '#888',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: 5, background: team.id === teamId ? '#37352f' : '#ccc',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 9, fontWeight: 700, flexShrink: 0,
                  }}>{team.name[0].toUpperCase()}</span>
                  {team.name}
                  {team.id === teamId && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#2c5282' }}>✓</span>}
                </button>
              ))}
              <button
                onClick={() => { setTeam(null); onClose() }}
                style={{
                  width: '100%', padding: '8px 0', background: 'none', border: 'none',
                  textAlign: 'left', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  fontWeight: !teamId ? 600 : 400,
                  color: !teamId ? '#37352f' : '#888',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: 5, background: !teamId ? '#37352f' : '#ccc',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 9, fontWeight: 700, flexShrink: 0,
                }}>P</span>
                개인 모드
                {!teamId && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#2c5282' }}>✓</span>}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
