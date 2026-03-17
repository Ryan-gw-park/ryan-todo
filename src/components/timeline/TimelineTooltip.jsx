import { useState, useRef, useEffect } from 'react'

/**
 * Loop-34: 타임라인 바 호버 툴팁
 * 마우스 위치 추적 + 간트 바 상세정보 표시
 */
export default function TimelineTooltip({ data, x, y, visible }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })

  useEffect(() => {
    if (!visible || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = x + 12
    let top = y + 12

    // Right overflow
    if (left + rect.width > vw - 8) left = x - rect.width - 8
    // Bottom overflow
    if (top + rect.height > vh - 8) top = y - rect.height - 8

    setPos({ left, top })
  }, [x, y, visible])

  if (!visible || !data) return null

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        background: '#2C2C2A',
        color: '#fff',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 12,
        lineHeight: 1.6,
        zIndex: 1000,
        pointerEvents: 'none',
        maxWidth: 260,
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        whiteSpace: 'pre-line',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{data.title}</div>
      {data.lines.map((line, i) => (
        <div key={i} style={{ color: '#ccc' }}>{line}</div>
      ))}
    </div>
  )
}
