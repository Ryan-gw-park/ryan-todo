import { useState, useRef, useEffect } from 'react'

/**
 * MsDropdown — 마일스톤 선택 드롭다운 ("+MS 연결" 클릭 시)
 * @param {Array} milestones - [{ id, title, color }]
 * @param {function} onSelect - (milestoneId) => void
 */
export default function MsDropdown({ milestones, onSelect }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, color: '#a09f99', fontFamily: 'inherit', padding: '0 2px',
        }}
      >
        +MS 연결
      </button>
      {open && milestones.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100,
          background: '#fff', border: '1px solid #e8e6df', borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4,
          minWidth: 160, maxHeight: 200, overflow: 'auto',
        }}>
          {milestones.map(ms => (
            <button
              key={ms.id}
              onClick={(e) => { e.stopPropagation(); onSelect(ms.id); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                width: '100%', padding: '6px 8px', border: 'none',
                background: 'transparent', cursor: 'pointer',
                borderRadius: 4, fontFamily: 'inherit', fontSize: 12,
                color: '#37352f', textAlign: 'left',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f5f4f0'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: ms.color || '#22c55e', flexShrink: 0,
              }} />
              <span style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {ms.title || '(제목 없음)'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
