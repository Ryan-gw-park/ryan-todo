import { useState } from 'react'

/**
 * MSBadge — 마일스톤 뱃지 (할일 카드 메타 행에 표시)
 * @param {object} milestone - { id, title, color }
 * @param {function} onClick - 클릭 콜백 (상세 모달 열기 등)
 */
export default function MSBadge({ milestone, onClick }) {
  const [hovered, setHovered] = useState(false)

  if (!milestone) return null

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(milestone.id) }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '1px 6px',
        borderRadius: 8,
        fontSize: 9,
        background: '#f5f4f0',
        color: '#666',
        border: hovered ? '0.5px solid #c4c2ba' : '0.5px solid #e8e6df',
        cursor: 'pointer',
        fontFamily: 'inherit',
        lineHeight: 1.4,
      }}
    >
      <span style={{
        width: 4, height: 4, borderRadius: '50%',
        background: milestone.color || '#1D9E75', flexShrink: 0,
      }} />
      <span style={{
        whiteSpace: 'nowrap', overflow: 'hidden',
        textOverflow: 'ellipsis', maxWidth: 80,
      }}>
        {milestone.title || '마일스톤'}
      </span>
    </button>
  )
}
