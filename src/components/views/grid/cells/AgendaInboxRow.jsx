import { useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { COLOR, FONT, MATRIX } from '../../../../styles/designTokens'
import { makeRowId } from '../../../../utils/dnd/cellKeys/personalAgenda'

/* AgendaInboxRow — Spec r2 C5
 *
 * 신규 할일(미분류) 행. tbody 최상단 고정.
 * 식별: keyMilestoneId === null && assigneeId === me && !done && !deletedAt
 * 행 droppable id: 'agenda-row:inbox'
 */
export default function AgendaInboxRow({ tasks, currentUserId }) {
  const rowId = makeRowId(null)
  const { setNodeRef, isOver } = useDroppable({
    id: rowId,
    data: { type: 'agenda-matrix-row', msId: null },
  })

  const inboxCount = useMemo(
    () => tasks.filter(t =>
      t.assigneeId === currentUserId &&
      t.keyMilestoneId == null &&
      !t.done && !t.deletedAt
    ).length,
    [tasks, currentUserId]
  )

  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? COLOR.bgHover : MATRIX.inboxRowBg,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        borderRight: `1px solid ${COLOR.border}`,
        transition: 'background 0.12s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14, lineHeight: 1 }} role="img" aria-label="inbox">📥</span>
        <span style={{ fontSize: FONT.body, fontWeight: 600, color: COLOR.textPrimary }}>
          신규 할일
        </span>
        {inboxCount > 0 && (
          <span style={{ fontSize: FONT.caption, color: COLOR.textTertiary }}>
            {inboxCount}
          </span>
        )}
      </div>
      <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>
        프로젝트/마일스톤 미배정
      </span>
    </div>
  )
}
