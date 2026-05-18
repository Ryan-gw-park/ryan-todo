import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { COLOR, FONT } from '../../../../styles/designTokens'
import { makeRowId } from '../../../../utils/dnd/cellKeys/personalAgenda'

/* AgendaRowHeader — Hotfix r6 (project color dot 제거)
 *
 * 역할:
 *   - project 이름 + task 카운트 표시
 *   - droppable: task 카드 drop 시 projectId 재할당
 *   - sortable: row 헤더 자체 drag 시 row 순서 변경
 *   - 접기/펼치기 토글 (chevron 버튼)
 */
export default function AgendaRowHeader({ project, taskCount, isCollapsed, onToggle }) {
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
      rowProjectId: project.id,
    },
  })

  // Hotfix r5: 접힌 행은 헤더가 전체 너비 차지 (cell filler 제거 → 회색 띠 사라짐)
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: isOver ? COLOR.bgHover : '#fff',
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderRight: isCollapsed ? 'none' : `1px solid ${COLOR.border}`,
    opacity: isDragging ? 0.4 : 1,
    cursor: 'grab',
    userSelect: 'none',
    ...(isCollapsed ? { gridColumn: '1 / -1' } : null),
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
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
      {taskCount > 0 && (
        <span style={{
          fontSize: FONT.caption,
          color: COLOR.textTertiary,
          flexShrink: 0,
        }}>{taskCount}</span>
      )}
      <button
        type="button"
        onMouseDown={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation()
          onToggle?.(project.id)
        }}
        aria-label={isCollapsed ? '행 펼치기' : '행 접기'}
        style={{
          flexShrink: 0,
          width: 20,
          height: 20,
          padding: 0,
          background: 'transparent',
          border: 0,
          color: COLOR.textTertiary,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'inherit',
        }}
      >
        <svg
          width="10" height="10" viewBox="0 0 16 16"
          style={{
            transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.12s',
          }}
        >
          <path d="M3 5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
