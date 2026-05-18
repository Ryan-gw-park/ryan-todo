import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { COLOR } from '../../../../styles/designTokens'
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
  activeMentions,
  mentionColorMap,
  columnMode = 'agenda',
}) {
  const cellTasks = getCellTasks(tasks, cellKey, { currentUserId, hideDone, columnMode })
  const cellId = makeCellId(cellKey.projectId, cellKey.agendaType)
  const sortableId = makeSortableId(cellKey.projectId, cellKey.agendaType)

  // mention 모드에서는 cell drag(컬럼 변경)가 의미 없으므로 droppable data에 mode 동봉.
  // handler가 mode 검사 후 cross-cell column 변경은 silent return.
  const { setNodeRef, isOver } = useDroppable({
    id: cellId,
    data: { type: 'agenda-matrix-task', cellKey, columnMode },
  })

  const colorObj = project ? getColor(project.color) : getColor(null)

  // Hotfix r4: 빈 셀 흰색 (이전: 빗금 패턴)
  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? COLOR.bgHover : '#fff',
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
            activeMentions={activeMentions}
            mentionColorMap={mentionColorMap}
            columnMode={columnMode}
          />
        ))}
      </SortableContext>

      {/* InlineAdd: agenda 모드에서만 신규 task의 agenda를 자동 태깅 가능 */}
      {project && columnMode === 'agenda' && (
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
