import { COLOR } from '../../../../styles/designTokens'

/* ─── Inline MS Add — 매트릭스 셀 하단의 작은 "+ 마일스톤" 버튼 ─── */
export default function InlineMsAdd({ onClick }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick && onClick() }}
      style={{
        display: 'block',
        marginTop: 2,
        padding: '3px 4px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: 11,
        color: '#c8c8c8',
        fontFamily: 'inherit',
        transition: 'color 0.12s',
        width: '100%',
        textAlign: 'left',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = COLOR.textSecondary }}
      onMouseLeave={e => { e.currentTarget.style.color = '#c8c8c8' }}
    >
      + 마일스톤
    </button>
  )
}
