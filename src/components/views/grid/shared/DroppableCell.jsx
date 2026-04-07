import { useDroppable } from '@dnd-kit/core'
import { COLOR } from '../../../../styles/designTokens'

export default function DroppableCell({ id, activeId, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const showHighlight = isOver && activeId
  return (
    <div ref={setNodeRef} style={{
      borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}`,
      transition: 'background 0.08s',
      ...(showHighlight ? { background: 'rgba(49,130,206,0.06)', outline: `2px dashed #3182CE`, outlineOffset: -2 } : {}),
    }}>
      {children}
    </div>
  )
}
