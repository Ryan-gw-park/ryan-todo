import { useState } from 'react'

/**
 * DetailZone — 상세 진입 ▶ 아이콘
 * 평소 숨김, 카드 호버 시 표시 (CSS hover는 부모에서 제어)
 * @param {function} onOpen - 상세 진입 콜백
 * @param {boolean} visible - 호버 상태 (부모에서 전달)
 */
export default function DetailZone({ onOpen, visible }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen?.() }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        flexShrink: 0,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.15s',
        cursor: 'pointer',
        border: 'none',
        background: 'none',
        padding: 0,
        color: hovered ? '#666' : '#b4b2a9',
      }}
      aria-label="상세 보기"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
