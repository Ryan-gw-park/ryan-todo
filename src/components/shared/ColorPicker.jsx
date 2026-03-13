import { useRef, useEffect } from 'react'
import useStore from '../../hooks/useStore'

const COLORS = [
  { key: 'red',    bg: '#E53E3E' },
  { key: 'orange', bg: '#DD6B20' },
  { key: 'yellow', bg: '#D69E2E' },
  { key: 'blue',   bg: '#3182CE' },
  { key: 'green',  bg: '#38A169' },
  { key: 'purple', bg: '#805AD5' },
]

export default function ColorPicker({ taskId, currentColor, onClose, style: posStyle }) {
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleSelect = async (colorKey) => {
    useStore.getState().setHighlightColor(taskId, colorKey)
    onClose()
  }

  const handleClear = async () => {
    useStore.getState().setHighlightColor(taskId, null)
    onClose()
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        background: '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        padding: '8px 10px',
        zIndex: 200,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        ...posStyle,
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Clear button */}
      <div
        onClick={handleClear}
        title="색상 없음"
        style={{
          width: 22, height: 22, borderRadius: '50%',
          border: '2px solid #ddd', background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 10, color: '#aaa',
          outline: !currentColor ? '2px solid #37352f' : 'none',
          outlineOffset: 1,
        }}
      >✕</div>

      {COLORS.map(c => (
        <div
          key={c.key}
          onClick={() => handleSelect(c.key)}
          title={c.key}
          style={{
            width: 22, height: 22, borderRadius: '50%',
            background: c.bg, cursor: 'pointer',
            outline: currentColor === c.key ? '2px solid #37352f' : 'none',
            outlineOffset: 1,
          }}
        />
      ))}
    </div>
  )
}
