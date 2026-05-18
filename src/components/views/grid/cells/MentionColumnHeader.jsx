import { COLOR, FONT } from '../../../../styles/designTokens'
import { getMentionColorByIndex } from '../../../../utils/mentions'

/* MentionColumnHeader — Hotfix r9 (column mode='mention')
 *
 * 컬럼 헤더가 mention 이름을 표시. 색상은 mentionColorMap의 영구 인덱스 사용.
 */
export default function MentionColumnHeader({ mentionName, count, colorMap }) {
  const c = getMentionColorByIndex(colorMap?.[mentionName] ?? 0)
  return (
    <div style={{
      background: '#fff',
      padding: '10px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontWeight: 600,
      fontSize: 12,
      color: c.chipText,
    }}>
      <span style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: c.dot,
        flexShrink: 0,
      }} />
      <span style={{
        whiteSpace: 'normal',
        wordBreak: 'keep-all',
        flex: 1,
        minWidth: 0,
      }}>@{mentionName}</span>
      {typeof count === 'number' && (
        <span style={{
          fontSize: FONT.tiny,
          color: COLOR.textTertiary,
          flexShrink: 0,
        }}>{count}</span>
      )}
    </div>
  )
}
