/**
 * StatusZone — 카드 타입별 좌측 상태 영역
 * task: 체크박스 14x14
 * milestone: 컬러 도트 6px
 * project: 컬러 도트 8px
 */
export default function StatusZone({ type, data, onToggle }) {
  const zoneStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    flexShrink: 0,
    padding: 4,
  }

  if (type === 'task') {
    return (
      <div
        style={zoneStyle}
        onClick={(e) => { e.stopPropagation(); onToggle?.() }}
      >
        <div
          style={{
            width: 14, height: 14, borderRadius: 3,
            border: data.done ? '1.5px solid #1D9E75' : '1.5px solid #c4c2ba',
            background: data.done ? '#1D9E75' : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.1s',
          }}
          onMouseEnter={(e) => {
            if (!data.done) e.currentTarget.style.borderColor = '#888'
          }}
          onMouseLeave={(e) => {
            if (!data.done) e.currentTarget.style.borderColor = '#c4c2ba'
          }}
        >
          {data.done && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
    )
  }

  if (type === 'milestone') {
    return (
      <div style={zoneStyle}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: data.color || '#1D9E75', flexShrink: 0 }} />
      </div>
    )
  }

  if (type === 'project') {
    return (
      <div style={zoneStyle}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: data.color || '#1D9E75', flexShrink: 0 }} />
      </div>
    )
  }

  return null
}
