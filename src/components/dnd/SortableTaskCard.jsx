import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/* ═══════════════════════════════════════════════
   SortableTaskCard / useSortableCard — DnD 공통 카드 래퍼 (spec §12.4)

   useSortableCard (hook 형태):
     카드가 setNodeRef/listeners를 부분 영역에만 적용하는 경우 사용.
     예: PersonalTodoTaskRow의 col 3 (col 2 = MS label은 sortable 영역 외).
     editing 중 listener 분리 같은 미묘한 사용 케이스도 커버.

   SortableTaskCard (wrapper 컴포넌트):
     카드 전체가 sortable 영역인 경우 사용.
     예: PivotTaskCell의 inline task <div>.

   data prop은 디스패처(spec §2.4)가 사용 — `{ type, task, cellKey, sortableContextId, ... }` 형태로 caller가 정의.
   dragOpacity는 isDragging 시 적용. caller가 자체 opacity 처리하면 1로 두고 외부에서 처리 가능.
   ═══════════════════════════════════════════════ */
export function useSortableCard({ id, data, dragOpacity = 0.3 }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data })
  return {
    setNodeRef,
    attributes,
    listeners,
    isDragging,
    style: {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? dragOpacity : 1,
    },
  }
}

export default function SortableTaskCard({ id, data, dragOpacity = 0.3, style: extraStyle, children, ...rest }) {
  const { setNodeRef, attributes, listeners, style } = useSortableCard({ id, data, dragOpacity })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{ ...style, ...extraStyle }} {...rest}>
      {children}
    </div>
  )
}
