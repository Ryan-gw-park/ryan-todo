import { useDroppable } from '@dnd-kit/core'
import { COLOR, FONT } from '../../../../styles/designTokens'
import { getColor } from '../../../../utils/colors'
import { makeRowId } from '../../../../utils/dnd/cellKeys/personalAgenda'

/* AgendaRowHeader — Spec r2 C4a + C9
 * 행 헤더 (key_milestone 1행). C9: row droppable 적용.
 */
export default function AgendaRowHeader({ milestone, project }) {
  const color = project ? getColor(project.color) : null
  const rowId = makeRowId(milestone.id)

  const { setNodeRef, isOver } = useDroppable({
    id: rowId,
    data: { type: 'agenda-matrix-row', msId: milestone.id },
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? COLOR.bgHover : '#fff',
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        borderRight: `1px solid ${COLOR.border}`,
        transition: 'background 0.12s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {color && (
          <span style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: color.dot,
            flexShrink: 0,
          }} />
        )}
        <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>
          {project?.name || '(no project)'}
        </span>
      </div>
      <span style={{
        fontSize: FONT.body,
        fontWeight: 600,
        color: COLOR.textPrimary,
        whiteSpace: 'normal',
        wordBreak: 'keep-all',
      }}>
        {milestone.title || '(제목 없음)'}
      </span>
    </div>
  )
}
