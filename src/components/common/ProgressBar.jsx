/**
 * ProgressBar — 마일스톤 진행률 바
 * @param {number} done - 완료 건수
 * @param {number} total - 전체 건수
 * @param {string} color - 바 색상 (default: #22c55e)
 * @param {number} width - 바 너비 (default: 60)
 */
export default function ProgressBar({ done = 0, total = 0, color = '#22c55e', width = 60 }) {
  const pct = total > 0 ? (done / total) * 100 : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width, height: 4, borderRadius: 2, background: '#e8e6df', flexShrink: 0 }}>
        <div style={{
          width: `${pct}%`, height: 4, borderRadius: 2,
          background: color, transition: 'width 0.3s',
        }} />
      </div>
      <span style={{ fontSize: 11, color: '#6b6a66', flexShrink: 0 }}>{done}/{total}</span>
    </div>
  )
}
