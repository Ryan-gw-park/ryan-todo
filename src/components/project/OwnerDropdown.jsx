import { useState, useEffect, useRef } from 'react'
import useStore from '../../hooks/useStore'
import useTeamMembers from '../../hooks/useTeamMembers'

export default function OwnerDropdown({ projectId, ownerId, onChangeOwner }) {
  const [open, setOpen] = useState(false)
  const [members, setMembers] = useState([])
  const currentTeamId = useStore(s => s.currentTeamId)
  const ref = useRef(null)

  useEffect(() => {
    if (!currentTeamId) return
    useTeamMembers.getMembers(currentTeamId).then(m => setMembers(m || []))
  }, [currentTeamId])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const owner = members.find(m => m.userId === ownerId)

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          fontSize: 11, color: owner ? '#2C2C2A' : '#D85A30', cursor: 'pointer',
          border: 'none', background: 'none', fontFamily: 'inherit', fontWeight: 500,
          padding: '2px 4px', borderRadius: 4,
        }}
      >
        {owner?.displayName || '미지정'} ▾
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, background: '#fff',
          border: '0.5px solid #e8e6df', borderRadius: 8, padding: '4px 0',
          boxShadow: '0 4px 16px rgba(0,0,0,.1)', zIndex: 100, minWidth: 140,
        }}>
          <div
            onClick={() => { onChangeOwner(null); setOpen(false) }}
            style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#a09f99' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f5f4f0'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            ✕ 미지정
          </div>
          {members.map(m => (
            <div
              key={m.userId}
              onClick={() => { onChangeOwner(m.userId); setOpen(false) }}
              style={{
                padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                fontWeight: m.userId === ownerId ? 600 : 400,
                background: m.userId === ownerId ? '#f0efe8' : 'transparent',
              }}
              onMouseEnter={e => { if (m.userId !== ownerId) e.currentTarget.style.background = '#f5f4f0' }}
              onMouseLeave={e => { if (m.userId !== ownerId) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{
                width: 18, height: 18, borderRadius: '50%', background: '#1D9E75',
                color: '#fff', fontSize: 9, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 600, flexShrink: 0,
              }}>
                {(m.displayName || '?')[0].toUpperCase()}
              </span>
              {m.displayName}
            </div>
          ))}
        </div>
      )}
    </span>
  )
}
