import { COLOR, FONT } from '../../../../styles/designTokens'
import { getMentionColor } from '../../../../utils/mentions'

/* AgendaMentionFilter — Hotfix r4
 *
 * 매트릭스 헤더에 노출되는 멘션 토글 칩 그룹.
 * task.text에서 자동 추출된 @멘션 목록을 다중 선택 토글.
 *
 * Props:
 *   - mentions: [{ name, count }] (extractAllMentions 결과)
 *   - active: Set<string>
 *   - onToggle: (name) => void
 *   - onClear: () => void
 */
export default function AgendaMentionFilter({ mentions, active, onToggle, onClear }) {
  if (!mentions || mentions.length === 0) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
      padding: '2px 0',
    }}>
      <span style={{
        fontSize: FONT.tiny,
        color: COLOR.textTertiary,
        marginRight: 4,
      }}>담당자 강조:</span>
      {mentions.map(({ name, count }) => {
        const isActive = active.has(name)
        const c = getMentionColor(name)
        return (
          <button
            key={name}
            type="button"
            onClick={() => onToggle(name)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: FONT.caption,
              padding: '2px 8px',
              borderRadius: 10,
              border: `1px solid ${isActive ? c.dot : COLOR.border}`,
              background: isActive ? c.chipBg : '#fff',
              color: isActive ? c.chipText : COLOR.textSecondary,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: isActive ? 600 : 400,
              transition: 'background 0.12s, border-color 0.12s',
            }}
            aria-pressed={isActive}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: c.dot, flexShrink: 0,
            }} />
            @{name}
            <span style={{
              fontSize: 9,
              color: isActive ? c.chipText : COLOR.textTertiary,
              opacity: 0.8,
            }}>{count}</span>
          </button>
        )
      })}
      {active.size > 0 && (
        <button
          type="button"
          onClick={onClear}
          style={{
            fontSize: FONT.caption,
            padding: '2px 8px',
            border: 0,
            background: 'transparent',
            color: COLOR.textTertiary,
            cursor: 'pointer',
            fontFamily: 'inherit',
            textDecoration: 'underline',
          }}
        >해제</button>
      )}
    </div>
  )
}
