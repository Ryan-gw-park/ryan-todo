import { useNavigate } from 'react-router-dom'
import useStore from '../../hooks/useStore'

const T = {
  card: '#ffffff', cardBorder: '#e8e8e8', text: '#1a1a1a',
  textSub: '#888', textMuted: '#adb5bd',
}

const btnStyle = {
  padding: '12px', width: '100%', fontSize: 14, fontWeight: 500,
  borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
}

export default function ModeSelect() {
  const navigate = useNavigate()
  const { myTeams, setTeam, userName } = useStore()

  const handleSelectTeam = (teamId) => {
    setTeam(teamId)
    navigate('/', { replace: true })
  }

  const handlePersonal = () => {
    setTeam(null)
    navigate('/', { replace: true })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
    }}>
      <div style={{ maxWidth: 400, width: '100%', padding: '0 24px' }}>
        <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.cardBorder}`, padding: '40px 32px', textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: '#37352f',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 22, fontWeight: 700, margin: '0 auto 12px',
          }}>R</div>

          <h2 style={{ margin: '12px 0 6px', fontSize: 22, fontWeight: 800, color: T.text }}>
            {userName ? `${userName}님, 안녕하세요` : '안녕하세요'}
          </h2>
          <p style={{ color: T.textSub, fontSize: 14, margin: '0 0 28px', lineHeight: 1.6 }}>
            어떤 모드로 시작할까요?
          </p>

          {/* Team list */}
          <div style={{ marginBottom: 20, textAlign: 'left' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.textSub }}>내 팀</span>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {myTeams.map(t => (
                <div
                  key={t.id}
                  onClick={() => handleSelectTeam(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 8,
                    border: `1px solid ${T.cardBorder}`, cursor: 'pointer',
                    background: '#fff', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9f9f9'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: '#37352f',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0,
                  }}>{(t.name || 'T')[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{t.name}</div>
                    {t.description && <div style={{ fontSize: 12, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>}
                  </div>
                  <span style={{ fontSize: 12, color: T.textMuted }}>→</span>
                </div>
              ))}
            </div>
          </div>

          {/* Personal mode */}
          <button
            onClick={handlePersonal}
            style={{ ...btnStyle, background: '#fff', color: T.text, border: `1px solid ${T.cardBorder}` }}
          >
            개인 모드로 시작
          </button>
        </div>
      </div>
    </div>
  )
}
