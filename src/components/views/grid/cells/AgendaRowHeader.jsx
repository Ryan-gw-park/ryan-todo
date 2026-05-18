import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { COLOR, FONT } from '../../../../styles/designTokens'
import { getColor } from '../../../../utils/colors'
import { makeRowId } from '../../../../utils/dnd/cellKeys/personalAgenda'

/* AgendaRowHeader — Hotfix r3 (row = project)
 *
 * 책임:
 *   - project 정보 표시 (color dot + name)
 *   - droppable: task 카드 drop 시 `type='agenda-matrix-row'` → projectId 재할당
 *   - sortable: 행 헤더 자체 drag 시 `type='agenda-matrix-row-reorder'` → row 순서 변경
 *
 * useSortable이 자체 useDroppable + useDraggable 둘 다 제공하므로 두 시나리오를 함께 처리.
 * Handler가 active.id 패턴 (cell-task: vs agenda-row:) 으로 분기.
 */
export default function AgendaRowHeader({ project }) {
  const rowId = makeRowId(project.id)
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: rowId,
    data: {
      type: 'agenda-matrix-row-reorder',
      projectId: project.id,
      // task drop 시 fallback type — dispatcher가 over.type 우선 매칭
      rowProjectId: project.id,
    },
  })

  const color = getColor(project.color)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: isOver ? COLOR.bgHover : '#fff',
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderRight: `1px solid ${COLOR.border}`,
    opacity: isDragging ? 0.4 : 1,
    cursor: 'grab',
    userSelect: 'none',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <span style={{
        width: 10, height: 10, borderRadius: 2,
        background: color.dot, flexShrink: 0,
      }} />
      <span style={{
        fontSize: FONT.body,
        fontWeight: 600,
        color: COLOR.textPrimary,
        whiteSpace: 'normal',
        wordBreak: 'keep-all',
        flex: 1,
        minWidth: 0,
      }}>
        {project.name || '(이름 없음)'}
      </span>
    </div>
  )
}
