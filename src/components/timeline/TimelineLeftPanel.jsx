import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ROW_HEIGHTS, INDENTS, getBarStyles } from '../../utils/timelineUtils'
import { getColor } from '../../utils/colors'

const ASSIGNEE_W = 50
const PROGRESS_W = 32

/**
 * Loop-34: 타임라인 좌측 패널
 * 트리 구조 행 렌더링: 토글 + dot + 이름 + 담당자 + 진행률
 */
export default function TimelineLeftPanel({
  rows,
  expandedIds,
  onToggleExpand,
  onOpenDetail,
  activeId,
  panelW,
  isProjectMode,
}) {
  return (
    <div style={{ width: panelW, flexShrink: 0, borderRight: '1px solid #f0f0f0', background: 'white', zIndex: 5 }}>
      {/* Header spacer for date headers */}
      <div style={{ height: 32, display: 'flex', alignItems: 'center', padding: '0 12px' }}>
        <span style={{ fontSize: 12, color: '#999', fontWeight: 500, flex: 1, minWidth: 0 }}>프로젝트 / 할일</span>
        <span style={{ fontSize: 10, color: '#999', fontWeight: 500, width: ASSIGNEE_W, textAlign: 'left', flexShrink: 0, borderLeft: '1px solid #f0f0f0', paddingLeft: 8 }}>담당자</span>
        <span style={{ fontSize: 10, color: '#999', fontWeight: 500, width: PROGRESS_W, textAlign: 'center', flexShrink: 0, borderLeft: '1px solid #f0f0f0' }}>%</span>
      </div>

      {/* Rows */}
      {rows.map(node => {
        if (node.type === 'task') {
          return (
            <SortableTaskRow
              key={node.id}
              node={node}
              onOpenDetail={onOpenDetail}
              isDragging={activeId === node.id}
            />
          )
        }
        return (
          <GroupRow
            key={node.id}
            node={node}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
          />
        )
      })}
    </div>
  )
}

/* ── Project / Milestone row ── */
function GroupRow({ node, expandedIds, onToggleExpand }) {
  const isExpanded = expandedIds.has(node.id)
  const hasChildren = node.children.length > 0
  const rowH = ROW_HEIGHTS[node.type]
  const indent = INDENTS[node.depth] || 0
  const isProject = node.type === 'project'
  const c = getColor(node.color)
  const barStyle = getBarStyles(node)

  return (
    <div
      onClick={() => hasChildren && onToggleExpand(node.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: `0 4px 0 ${4 + indent}px`,
        cursor: hasChildren ? 'pointer' : 'default',
        height: rowH, boxSizing: 'border-box',
        borderBottom: '1px solid #f0f0f0',
        background: isProject ? 'transparent' : '#fafafa',
      }}
    >
      {/* Toggle arrow */}
      {hasChildren ? (
        <span style={{
          fontSize: isProject ? 11 : 9, color: '#bbb',
          transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 0.15s', flexShrink: 0, width: 16, textAlign: 'center',
        }}>▾</span>
      ) : (
        <span style={{ width: 16, flexShrink: 0 }} />
      )}

      {/* Color dot */}
      <div style={{
        width: isProject ? 8 : 7,
        height: isProject ? 8 : 7,
        borderRadius: isProject ? 2 : 2,
        background: c.dot,
        flexShrink: 0,
      }} />

      {/* Name */}
      <span style={{
        fontSize: isProject ? 13 : 12,
        fontWeight: isProject ? 600 : 500,
        color: isProject ? c.text : '#555',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flex: 1, minWidth: 0,
      }}>
        {node.name}
      </span>

      {/* Assignee */}
      <span style={{
        fontSize: 10, color: '#aaa', fontWeight: 500,
        width: ASSIGNEE_W, textAlign: 'left', flexShrink: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        borderLeft: '1px solid #f0f0f0', paddingLeft: 8,
      }}>
        {node.ownerName && node.ownerName !== '—' ? node.ownerName : ''}
      </span>

      {/* Progress */}
      <span style={{
        fontSize: 10, color: '#aaa', fontWeight: 600,
        width: PROGRESS_W, textAlign: 'center', flexShrink: 0,
        borderLeft: '1px solid #f0f0f0',
      }}>
        {node.progress > 0 ? `${node.progress}%` : ''}
      </span>
    </div>
  )
}

/* ── Task row (sortable for DnD) ── */
function SortableTaskRow({ node, onOpenDetail, isDragging }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: node.id })
  const rowH = ROW_HEIGHTS.task
  const indent = INDENTS[node.depth] || 0

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        padding: `0 4px 0 ${4 + indent + 16}px`,
        height: rowH, display: 'flex', alignItems: 'center', gap: 8,
        cursor: 'grab', boxSizing: 'border-box',
        opacity: isDragging ? 0.3 : 1,
        background: 'transparent',
      }}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onOpenDetail(node.raw) }}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.background = 'rgba(0,0,0,0.02)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{
        fontSize: 12, color: node.done ? '#bbb' : '#555',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flex: 1, minWidth: 0,
        textDecoration: node.done ? 'line-through' : 'none',
      }}>
        {node.name}
      </span>

      <span style={{
        fontSize: 10, color: '#aaa', fontWeight: 500,
        width: ASSIGNEE_W, textAlign: 'left', flexShrink: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        borderLeft: '1px solid #f0f0f0', paddingLeft: 8,
      }}>
        {node.ownerName !== '미배정' ? node.ownerName : ''}
      </span>

      {/* Empty progress cell for alignment */}
      <span style={{ width: PROGRESS_W, flexShrink: 0, borderLeft: '1px solid #f0f0f0' }} />
    </div>
  )
}
