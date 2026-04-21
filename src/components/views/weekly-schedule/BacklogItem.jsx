import { useDraggable } from '@dnd-kit/core'
import { COLOR } from '../../../styles/designTokens'

/**
 * 백로그의 개별 드래그 아이템. kind='task'|'ms'.
 * - isDragging: opacity 0.4 (UnifiedGridView 패턴)
 * - scheduled(이미 배치됨): opacity 0.3 + line-through
 */
export default function BacklogItem({ kind, item, scheduled, projectColor }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${kind}:${item.id}`,
    data: { kind, item },
  })

  const isMS = kind === 'ms'
  const title = isMS ? item.title : item.text

  const style = {
    opacity: isDragging ? 0.4 : (scheduled ? 0.3 : 1),
    textDecoration: scheduled ? 'line-through' : 'none',
    cursor: 'grab',
    padding: '4px 8px',
    marginLeft: isMS ? 12 : 18,
    fontSize: 12,
    color: isMS ? '#534AB7' : COLOR.textPrimary,
    background: isMS ? '#EEEDFE' : 'transparent',
    borderRadius: isMS ? 3 : 0,
    fontWeight: isMS ? 500 : 400,
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  }

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={style}>
      {!isMS && projectColor && (
        <span style={{
          width: 6, height: 6, borderRadius: 2,
          background: projectColor, flexShrink: 0,
        }} />
      )}
      <span>{title}</span>
    </div>
  )
}
