import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { COLOR } from '../../../../styles/designTokens'
import StackedAvatar from '../../../shared/StackedAvatar'

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/* ─── Milestone Row — 매트릭스 셀 내 MS 헤더 (인터랙티브) ─── */
/*
 * 10a: 배경색 + accent bar + alive/total 카운트 + 들여쓰기 기반 그룹 헤더
 * 비-인터랙티브 모드 (interactive=false): 토글 + 제목 + count + › 만 노출 (주간 플래너용)
 * 인터랙티브 모드 (interactive=true): + ⋮ 추가, 제목 인라인 편집 가능
 */
export default function MilestoneRow({
  ms,
  taskCount,
  aliveCount,
  totalCount,
  accentColor,
  isEmpty,
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
  ownerInfo,           // 12d: { primary: { name, color }, secondary: { name, color } | null } | null
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
        padding: '2px 6px 2px 4px',
        marginBottom: 1,
        background: accentColor
          ? (hover && interactive ? hexToRgba(accentColor, 0.22) : hexToRgba(accentColor, 0.13))
          : (hover && interactive ? '#E8E6DD' : '#F1EFE8'),
        borderRadius: 4,
        position: 'relative',
        cursor: dragDisabled ? 'default' : 'grab',
        opacity: isDragging ? 0.3 : (isEmpty && !hover ? 0.5 : 1),
      }}
    >
      {/* Accent bar */}
      {accentColor && (
        <div style={{ width: 3, height: 14, borderRadius: 1, background: accentColor, flexShrink: 0 }} />
      )}

      {/* Toggle chevron */}
      <span
        onClick={e => { e.stopPropagation(); !isEditing && onToggleCollapse && onToggleCollapse() }}
        style={{
          fontSize: 10, color: COLOR.textSecondary, width: 10,
          cursor: (!isEditing && onToggleCollapse) ? 'pointer' : 'default',
          display: 'inline-block', textAlign: 'center',
          transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)',
          transition: 'transform 0.12s', flexShrink: 0,
        }}
      >▾</span>

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
              fontSize: 12, fontWeight: 500,
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
              fontSize: 12, fontWeight: 500, color: COLOR.textPrimary,
              cursor: interactive ? 'text' : 'default',
              whiteSpace: 'normal', wordBreak: 'break-word',
            }}
          >{ms.title || '(제목 없음)'}</span>
        )}
      </div>

      {/* Alive/Total count badge */}
      {!isEditing && totalCount > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 500, color: '#888780',
          background: '#E8E6DD', borderRadius: 8, padding: '0 5px',
          flexShrink: 0,
        }}>{aliveCount}/{totalCount}</span>
      )}
      {/* Fallback: taskCount only (for non-count callers) */}
      {!isEditing && !totalCount && taskCount > 0 && (
        <span style={{ fontSize: 10, color: COLOR.textTertiary, flexShrink: 0 }}>{taskCount}</span>
      )}

      {/* Owner badge (12d) */}
      {ownerInfo?.primary && (
        <StackedAvatar
          primary={ownerInfo.primary}
          secondary={ownerInfo.secondary}
          size={14}
          showLabel={false}
        />
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

      {/* Detail arrow (hover only, disabled during edit) */}
      {!isEditing && onOpenDetail && hover && (
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
