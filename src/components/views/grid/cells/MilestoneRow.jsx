import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { COLOR } from '../../../../styles/designTokens'

/* ─── Milestone Row — 매트릭스 셀 내 MS 헤더 (인터랙티브) ─── */
/*
 * 비-인터랙티브 모드 (interactive=false): 토글 + 제목 + count + › 만 노출 (주간 플래너용)
 * 인터랙티브 모드 (interactive=true): + ⋮ 추가, 제목 인라인 편집 가능
 */
export default function MilestoneRow({
  ms,
  taskCount,
  collapsed,
  onToggleCollapse,
  isEditing,
  onStartEdit,
  onFinishEdit,
  onCancelEdit,
  onAddTask,
  onDelete,
  onOpenDetail,
  breadcrumb,
  interactive = false,
}) {
  const [hover, setHover] = useState(false)

  // 7-D/7-E2: sortable handle — interactive 모드에서만 활성, 편집 중에는 비활성
  const dragDisabled = !interactive || isEditing
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `cell-ms:${ms.id}`,
    disabled: dragDisabled,
  })

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const showHoverButtons = interactive && hover && !isEditing

  return (
    <div
      ref={setNodeRef}
      {...(dragDisabled ? {} : { ...attributes, ...listeners })}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...sortableStyle,
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 2px 2px', marginBottom: 1,
        background: hover && interactive ? COLOR.bgHover : 'transparent',
        borderRadius: 3,
        position: 'relative',
        cursor: dragDisabled ? 'default' : 'grab',
        opacity: isDragging ? 0.3 : 1,
      }}
    >
      {/* Toggle chevron */}
      <span
        onClick={e => { e.stopPropagation(); onToggleCollapse && onToggleCollapse() }}
        style={{
          fontSize: 9, color: COLOR.textTertiary, width: 10,
          cursor: onToggleCollapse ? 'pointer' : 'default',
          display: 'inline-block', textAlign: 'center',
          transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)',
          transition: 'transform 0.12s', flexShrink: 0,
        }}
      >▾</span>

      {/* Bullet */}
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.textTertiary, flexShrink: 0 }} />

      {/* Title area (breadcrumb + title) */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {breadcrumb && !isEditing && (
          <span style={{ fontSize: 9, color: COLOR.textTertiary, marginRight: 3 }}>
            {breadcrumb} ›
          </span>
        )}
        {isEditing ? (
          <input
            autoFocus
            defaultValue={ms.title || ''}
            onBlur={e => onFinishEdit && onFinishEdit(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); onFinishEdit && onFinishEdit(e.target.value) }
              if (e.key === 'Escape') { onCancelEdit && onCancelEdit() }
            }}
            onMouseDown={e => e.stopPropagation()}
            style={{
              fontSize: 11, fontWeight: 600,
              border: `1px solid ${COLOR.border}`, borderRadius: 3,
              outline: 'none', background: '#fff',
              color: COLOR.textPrimary, fontFamily: 'inherit',
              padding: '0 4px', width: '100%', boxSizing: 'border-box',
            }}
          />
        ) : (
          <span
            onClick={e => {
              if (!interactive) return
              e.stopPropagation()
              onStartEdit && onStartEdit()
            }}
            style={{
              fontSize: 11, fontWeight: 600, color: COLOR.textSecondary,
              cursor: interactive ? 'text' : 'default',
              whiteSpace: 'normal', wordBreak: 'break-word',
            }}
          >{ms.title || '(제목 없음)'}</span>
        )}
      </div>

      {/* Task count */}
      {!isEditing && (
        <span style={{ fontSize: 9, color: COLOR.textTertiary, flexShrink: 0 }}>
          {taskCount > 0 ? taskCount : ''}
        </span>
      )}

      {/* Hover-only action buttons (interactive only) */}
      {showHoverButtons && onAddTask && (
        <span
          title="할일 추가"
          onClick={e => { e.stopPropagation(); onAddTask() }}
          style={{
            fontSize: 13, color: COLOR.textTertiary, cursor: 'pointer',
            flexShrink: 0, padding: '0 3px', lineHeight: 1, fontWeight: 400,
          }}
          onMouseEnter={e => e.currentTarget.style.color = COLOR.textPrimary}
          onMouseLeave={e => e.currentTarget.style.color = COLOR.textTertiary}
        >+</span>
      )}
      {showHoverButtons && onDelete && (
        <span
          title="삭제"
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{
            fontSize: 12, color: COLOR.textTertiary, cursor: 'pointer',
            flexShrink: 0, padding: '0 3px', lineHeight: 1,
          }}
          onMouseEnter={e => e.currentTarget.style.color = COLOR.danger}
          onMouseLeave={e => e.currentTarget.style.color = COLOR.textTertiary}
        >⋮</span>
      )}

      {/* Detail arrow (always visible) */}
      {!isEditing && onOpenDetail && (
        <span
          onClick={e => { e.stopPropagation(); onOpenDetail() }}
          style={{
            fontSize: 11, color: COLOR.textTertiary, cursor: 'pointer',
            flexShrink: 0, padding: '0 2px', lineHeight: 1,
          }}
          onMouseEnter={e => e.currentTarget.style.color = COLOR.textPrimary}
          onMouseLeave={e => e.currentTarget.style.color = COLOR.textTertiary}
        >›</span>
      )}
    </div>
  )
}
