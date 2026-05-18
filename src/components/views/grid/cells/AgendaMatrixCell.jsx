import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { COLOR, MATRIX } from '../../../../styles/designTokens'
import { getColor } from '../../../../utils/colors'
import {
  getCellTasks,
  makeCellId,
  makeSortableId,
} from '../../../../utils/dnd/cellKeys/personalAgenda'
import InlineAdd from '../../../shared/InlineAdd'
import AgendaMatrixTaskCard from './AgendaMatrixTaskCard'

/* AgendaMatrixCell — Spec r2 C4b / C6
 *
 * 한 셀 = (msId, agendaType). 셀 내부 = task list + InlineAdd ("+ 추가").
 *
 * Cell droppable data: { type: 'agenda-matrix-task', cellKey } → dispatcher 매칭용
 * SortableContext id: agenda-cell-sortable:{msId|inbox}:{agendaType}
 *
 * H-5 대응: 외부 컨테이너에 overflow 처리 위임. 본 셀은 padding/min-height만 책임.
 * B-3 수정: InlineAdd는 색 객체(getColor 결과)를 요구. milestone의 project 또는 inbox의 instant project 색 사용.
 */
export default function AgendaMatrixCell({
  cellKey,
  tasks,
  hideDone,
  currentUserId,
  project,         // milestone이 속한 project (inbox일 땐 instant project)
}) {
  const cellTasks = getCellTasks(tasks, cellKey, { currentUserId, hideDone })
  const cellId = makeCellId(cellKey.msId, cellKey.agendaType)
  const sortableId = makeSortableId(cellKey.msId, cellKey.agendaType)

  const { setNodeRef, isOver } = useDroppable({
    id: cellId,
    data: { type: 'agenda-matrix-task', cellKey },
  })

  const isEmpty = cellTasks.length === 0
  const colorObj = project ? getColor(project.color) : getColor(null)
  const projectId = project?.id || null

  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver
          ? COLOR.bgHover
          : (isEmpty ? MATRIX.stripedPattern : '#fff'),
        minHeight: 60,
        padding: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        transition: 'background 0.12s',
      }}
    >
      <SortableContext
        id={sortableId}
        items={cellTasks.map(t => `cell-task:${t.id}`)}
        strategy={verticalListSortingStrategy}
      >
        {cellTasks.map(task => (
          <AgendaMatrixTaskCard
            key={task.id}
            task={task}
            cellKey={cellKey}
          />
        ))}
      </SortableContext>

      {/* C6: InlineAdd — 항상 마운트, 사용자가 "+ 추가" 클릭으로 활성화 */}
      {projectId && (
        <InlineAdd
          projectId={projectId}
          category="today"
          color={colorObj}
          extraFields={{
            agendas: [cellKey.agendaType],
            keyMilestoneId: cellKey.msId,  // null = inbox
          }}
        />
      )}
    </div>
  )
}
