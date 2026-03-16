import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../hooks/useStore'

const T = {
  card: '#ffffff', cardBorder: '#e8e8e8', text: '#1a1a1a',
  textSub: '#888', textMuted: '#adb5bd', accent: '#2c5282',
}

export default function TeamSwitcher({ controlled, open: externalOpen, onClose }) {
  const navigate = useNavigate()
  const { myTeams, currentTeamId, setTeam } = useStore()
  const [internalOpen, setInternalOpen] = useState(false)
  const ref = useRef(null)

  const isControlled = controlled === true
  const open = isControlled ? externalOpen : internalOpen
  const closeDropdown = isControlled ? onClose : () => setInternalOpen(false)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) closeDropdown()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (myTeams.length === 0) return null

  const currentTeam = myTeams.find(t => t.id === currentTeamId)
  const label = currentTeam ? currentTeam.name : '개인'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {!isControlled && (
        <button
          onClick={() => setInternalOpen(!internalOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 6,
            border: `1px solid ${T.cardBorder}`, background: '#fff',
            cursor: 'pointer', fontSize: 12, fontWeight: 500,
            color: T.textSub, fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >
          <span style={{
            width: 16, height: 16, borderRadius: 4,
            background: currentTeam ? '#37352f' : '#ccc',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 9, fontWeight: 700, flexShrink: 0,
          }}>
            {currentTeam ? currentTeam.name[0].toUpperCase() : 'P'}
          </span>
          {label}
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.4 }}>
            <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: T.card, border: `1px solid ${T.cardBorder}`,
          borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          minWidth: 180, zIndex: 100, overflow: 'hidden',
        }}>
          {/* Personal mode */}
          <div
            onClick={() => { setTeam(null); closeDropdown() }}
            style={{
              padding: '10px 14px', fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              background: !currentTeamId ? '#f5f5f5' : '#fff',
              color: T.text,
            }}
            onMouseEnter={e => { if (currentTeamId) e.currentTarget.style.background = '#fafafa' }}
            onMouseLeave={e => { if (currentTeamId) e.currentTarget.style.background = '#fff' }}
          >
            <span style={{
              width: 20, height: 20, borderRadius: 5, background: '#ccc',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 10, fontWeight: 700,
            }}>P</span>
            개인
            {!currentTeamId && <span style={{ marginLeft: 'auto', fontSize: 11, color: T.accent }}>✓</span>}
          </div>

          {myTeams.length > 0 && <div style={{ height: 1, background: T.cardBorder }} />}

          {/* Teams */}
          {myTeams.map(t => (
            <div
              key={t.id}
              onClick={() => { setTeam(t.id); closeDropdown() }}
              style={{
                padding: '10px 14px', fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                background: currentTeamId === t.id ? '#f5f5f5' : '#fff',
                color: T.text,
              }}
              onMouseEnter={e => { if (currentTeamId !== t.id) e.currentTarget.style.background = '#fafafa' }}
              onMouseLeave={e => { if (currentTeamId !== t.id) e.currentTarget.style.background = '#fff' }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: 5, background: '#37352f',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 10, fontWeight: 700,
              }}>{t.name[0].toUpperCase()}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
              {currentTeamId === t.id && <span style={{ fontSize: 11, color: T.accent }}>✓</span>}
            </div>
          ))}

          <div style={{ height: 1, background: T.cardBorder }} />

          {/* Team settings + Create */}
          {currentTeam && (
            <div
              onClick={() => { navigate('/team/settings'); closeDropdown() }}
              style={{ padding: '10px 14px', fontSize: 13, cursor: 'pointer', color: T.textSub, display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <span style={{
                width: 20, height: 20, borderRadius: 5, background: '#e8e8e8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#999', fontSize: 11,
              }}>⚙</span>
              팀 설정
            </div>
          )}
          <div
            onClick={() => { navigate('/onboarding'); closeDropdown() }}
            style={{ padding: '10px 14px', fontSize: 13, cursor: 'pointer', color: T.textSub, display: 'flex', alignItems: 'center', gap: 8 }}
            onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            <span style={{
              width: 20, height: 20, borderRadius: 5, background: '#e8e8e8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#999', fontSize: 11,
            }}>+</span>
            새 팀 / 참가
          </div>
        </div>
      )}
    </div>
  )
}
