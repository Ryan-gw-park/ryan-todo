import { useDraggable } from '@dnd-kit/core'
import { COLOR } from '../../../styles/designTokens'

/**
 * 백로그의 개별 드래그 아이템. kind='task'|'ms'.
 * - isDragging: opacity 0.4 (UnifiedGridView 패턴)
 * - scheduled(이미 배치됨): opacity 0.3 + line-through
 * - bullet / 텍스트는 neutral 색상 (프로젝트 색은 헤더 dot에만 사용)
 */
export default function BacklogItem({ kind, item, scheduled }) {
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
    color: COLOR.textPrimary,
    fontWeight: isMS ? 500 : 400,
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  }

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={style}>
      <span style={{
        width: 6, height: 6,
        borderRadius: isMS ? '50%' : 2,
        background: '#888780',
        flexShrink: 0,
      }} />
      <span>{title}</span>
    </div>
  )
}
