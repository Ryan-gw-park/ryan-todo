import { AGENDA } from '../../../../styles/designTokens'
import { AGENDA_LABELS, AGENDA_TOKEN_KEYS } from '../../../../utils/dnd/cellKeys/personalAgenda'

/* AgendaColHeader — Spec r2 C4a
 * 컬럼 헤더 (4 agenda 고정)
 */
export default function AgendaColHeader({ agendaType }) {
  const tokens = AGENDA[AGENDA_TOKEN_KEYS[agendaType]] || AGENDA.personal
  return (
    <div style={{
      background: '#fff',
      padding: '10px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontWeight: 600,
      fontSize: 12,
      color: tokens.chipText,
    }}>
      <span style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: 2,
        background: tokens.dot,
        flexShrink: 0,
      }} />
      <span style={{ whiteSpace: 'normal', wordBreak: 'keep-all' }}>
        {AGENDA_LABELS[agendaType]}
      </span>
    </div>
  )
}
