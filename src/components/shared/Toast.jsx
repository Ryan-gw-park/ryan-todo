import { useState, useEffect, useRef } from 'react'
import useStore from '../../hooks/useStore'

export default function Toast() {
  const toast = useStore(s => s.toast)
  const undoComplete = useStore(s => s.undoComplete)
  const [visible, setVisible] = useState(null)
  const [fading, setFading] = useState(false)
  const fadeTimer = useRef()

  useEffect(() => {
    if (toast) {
      clearTimeout(fadeTimer.current)
      setVisible(toast)
      setFading(false)
    } else if (visible) {
      setFading(true)
      fadeTimer.current = setTimeout(() => setVisible(null), 300)
    }
  }, [toast])

  if (!visible) return null

  const isMobile = window.innerWidth < 768

  return (
    <div style={{
      position: 'fixed',
      bottom: isMobile ? 72 : 24,
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#37352f',
      color: 'white',
      padding: '10px 20px',
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 500,
      zIndex: 300,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      animation: fading ? 'toastOut 0.3s ease-out forwards' : 'toastIn 0.25s ease-out',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ color: '#66bb6a' }}>✓</span>
      <span>{visible.msg}</span>
      {visible.undoTaskId && (
        <button
          onClick={() => undoComplete(visible.undoTaskId, visible.undoPrevCategory)}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 4,
            color: '#fff',
            fontSize: 12,
            padding: '2px 8px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontWeight: 500,
            marginLeft: 4,
          }}
        >
          되돌리기
        </button>
      )}
    </div>
  )
}
