import { useState, useEffect } from 'react'

/**
 * UpdateToast — SW 업데이트 감지 시 화면 하단에 토스트 표시
 * 사용자가 "새로고침" 클릭 시에만 reload 수행
 */
export default function UpdateToast() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handler = () => setVisible(true)
    window.addEventListener('sw-update-available', handler)
    return () => window.removeEventListener('sw-update-available', handler)
  }, [])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      zIndex: 99999, display: 'flex', alignItems: 'center', gap: 12,
      background: '#37352f', color: '#fff', borderRadius: 10,
      padding: '10px 16px', boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
      fontSize: 13, fontFamily: 'inherit', animation: 'slideUp 0.25s ease',
    }}>
      <span>새 버전이 있습니다</span>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: '#fff', color: '#37352f', border: 'none', borderRadius: 6,
          padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        새로고침
      </button>
      <button
        onClick={() => setVisible(false)}
        style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer', fontSize: 16, padding: '0 2px', lineHeight: 1,
        }}
        title="닫기"
      >
        ×
      </button>
    </div>
  )
}
