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

/* AgendaMatrixCell — Hotfix r3 (cellKey = { projectId, agendaType })
 *
 * 한 셀 = (projectId, agendaType). 셀 내부 = 본인 task 목록 + InlineAdd.
 *
 * Cell droppable data: { type: 'agenda-matrix-task', cellKey }
 */
export default function AgendaMatrixCell({
  cellKey,
  tasks,
  hideDone,
  currentUserId,
  project,
}) {
  const cellTasks = getCellTasks(tasks, cellKey, { currentUserId, hideDone })
  const cellId = makeCellId(cellKey.projectId, cellKey.agendaType)
  const sortableId = makeSortableId(cellKey.projectId, cellKey.agendaType)

  const { setNodeRef, isOver } = useDroppable({
    id: cellId,
    data: { type: 'agenda-matrix-task', cellKey },
  })

  const isEmpty = cellTasks.length === 0
  const colorObj = project ? getColor(project.color) : getColor(null)

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

      {/* InlineAdd: "+ 추가" 버튼 (사용자 클릭 시 input 활성) */}
      {project && (
        <InlineAdd
          projectId={project.id}
          category="today"
          color={colorObj}
          extraFields={{
            agendas: [cellKey.agendaType],
            keyMilestoneId: null,
          }}
        />
      )}
    </div>
  )
}
