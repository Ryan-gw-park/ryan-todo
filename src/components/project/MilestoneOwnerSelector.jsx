import { useState, useRef, useEffect } from 'react'
import MiniAvatar from '../views/grid/shared/MiniAvatar'

export default function MilestoneOwnerSelector({
  milestoneId,
  ownerId,
  ownerDisplay,
  members,
  hasChildren,
  onChangeOwner,
  onCascade,
  size = 20,
  currentTeamId,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // click-outside
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // currentTeamId === null → hidden spacer
  if (!currentTeamId) {
    return <div style={{ width: size, visibility: 'hidden', flexShrink: 0 }} />
  }

  const memberName = (userId) => {
    const m = members.find(mem => mem.userId === userId)
    return m ? (m.displayName || m.name || '?') : '?'
  }

  const mode = ownerDisplay?.mode || 'ghost'

  // 아바타 렌더
  const renderAvatar = () => {
    if (mode === 'single') {
      return <MiniAvatar name={memberName(ownerDisplay.ownerId)} size={size} />
    }
    if (mode === 'mixed') {
      const { topOwners = [], extraCount = 0 } = ownerDisplay
      return (
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {topOwners[0] && <MiniAvatar name={memberName(topOwners[0])} size={size} />}
          {topOwners[1] && <div style={{ marginLeft: -6 }}><MiniAvatar name={memberName(topOwners[1])} size={size} /></div>}
          {extraCount > 0 && (
            <span style={{ fontSize: 9, color: '#888780', marginLeft: 2 }}>+{extraCount}</span>
          )}
        </div>
      )
    }
    // ghost
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: '1px dashed #B4B2A9', background: 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.5, color: '#B4B2A9', flexShrink: 0,
      }}>+</div>
    )
  }

  const ariaLabel = mode === 'single'
    ? `오너: ${memberName(ownerDisplay.ownerId)}, 클릭하여 변경`
    : '오너 미지정, 클릭하여 지정'

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Trigger */}
      <div
        role="button"
        aria-label={ariaLabel}
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); setOpen(prev => !prev) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.stopPropagation(); setOpen(prev => !prev) }
          if (e.key === 'Escape') setOpen(false)
        }}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      >
        {renderAvatar()}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: size + 4, right: 0, zIndex: 100,
            width: 200, background: '#fff', border: '1px solid #e8e6df',
            borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.12)',
            padding: '6px 0', fontSize: 12,
          }}
        >
          {/* Header */}
          <div style={{ padding: '4px 12px 6px', fontSize: 11, color: '#a09f99', fontWeight: 500 }}>오너 지정</div>

          {/* 미지정 옵션 */}
          <div
            onClick={() => { onChangeOwner(null); setOpen(false) }}
            style={{
              padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              background: !ownerId ? '#f5f4f0' : 'transparent',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f5f4f0'}
            onMouseLeave={e => { if (ownerId) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid #ccc', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#ccc' }}>○</span>
            <span style={{ color: '#888780' }}>미지정</span>
          </div>

          {/* 멤버 목록 */}
          {members.map(m => {
            const isSelected = ownerId === m.userId
            return (
              <div
                key={m.userId}
                onClick={() => { onChangeOwner(m.userId); setOpen(false) }}
                style={{
                  padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  background: isSelected ? '#f5f4f0' : 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f4f0'}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                <MiniAvatar name={m.displayName || m.name || '?'} size={16} />
                <span style={{ color: isSelected ? '#2C2C2A' : '#6b6a66', fontWeight: isSelected ? 500 : 400 }}>
                  {m.displayName || m.name || '?'}
                </span>
              </div>
            )
          })}

          {/* Cascade 옵션 */}
          {hasChildren && (
            <>
              <div style={{ borderTop: '1px solid #e8e6df', margin: '4px 0' }} />
              <div
                onClick={() => { onCascade?.(ownerId, { overwrite: false }); setOpen(false) }}
                style={{
                  padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  color: '#2c5282', fontSize: 11,
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f4f0'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                ↗ 하위 MS에 전체 적용
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
