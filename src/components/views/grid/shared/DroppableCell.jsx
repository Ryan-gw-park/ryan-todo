import { useDroppable } from '@dnd-kit/core'
import { COLOR } from '../../../../styles/designTokens'

export default function DroppableCell({ id, activeId, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const showHighlight = isOver && activeId
  return (
    <div ref={setNodeRef} style={{
      borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}`,
      transition: 'background 0.08s',
      ...(showHighlight ? { background: COLOR.dropTargetTint, outline: `2px dashed ${COLOR.dropIndicator}`, outlineOffset: -2 } : {}),
    }}>
      {children}
    </div>
  )
}
