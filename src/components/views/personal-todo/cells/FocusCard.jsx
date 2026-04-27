import { useState, useRef, useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../../../../hooks/useStore'
import usePivotExpandState from '../../../../hooks/usePivotExpandState'
import { COLOR, FONT, CHECKBOX, SPACE } from '../../../../styles/designTokens'
import { getColor } from '../../../../utils/colors'
import { isEmptyNotes } from '../../../../utils/notes'
import OutlinerEditor from '../../../shared/OutlinerEditor'

/* ═══════════════════════════════════════════════
   FocusCard (Loop-45 → Loop-47)
   [▸ ⋮⋮ ☐ text / project·ms meta 📝 ×]
     ↓ (caret click)
   [▾ ⋮⋮ ☐ text / project·ms meta 📝 ×]
   [                                             ]
   [  OutlinerEditor (inline, 800ms debounce)    ]

   E-01 ~ E-12:
   - 좌측 ▸ caret: 클릭 시 90° 회전 (▾), body slide-less toggle
   - body = OutlinerEditor 직접 삽입 (DetailPanel L71-L81 debounce 패턴 복제)
   - 여러 카드 동시 펼침 허용 (usePivotExpandState 'focusCardExpanded')
   - reload 복원, auto-expand 트리거 (Commit 5 에서 Shell/QuickAdd 가 호출)
   - DnD drag handle (⋮⋮) 만 listeners/attributes — caret/body는 드래그 무효
   - SVG 노트 아이콘 (F-37 유지): 빈 #d3d1c7, 있음 #2383e2
   ═══════════════════════════════════════════════ */
export default function FocusCard({ task, project, milestone }) {
  const toggleDone = useStore(s => s.toggleDone)
  const updateTask = useStore(s => s.updateTask)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `focus-card:${task.id}`,
  })

  const [hover, setHover] = useState(false)
  const hasNotes = !isEmptyNotes(task.notes)

  // E-09: expanded 상태 — usePivotExpandState 'focusCardExpanded' 재사용
  const { pivotCollapsed: expandedMap, setPivotCollapsed: setExpanded } = usePivotExpandState('focusCardExpanded')
  const isExpanded = expandedMap[task.id] === true
  const toggleExpand = (e) => {
    e.stopPropagation()
    e.preventDefault()
    setExpanded(task.id, !isExpanded)
  }

  // E-03, E-04: DetailPanel L71-L81 debounce 800ms + optimistic update 패턴 복제
  const debounceRef = useRef(null)
  const handleNotesChange = useCallback((newNotes) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateTask(task.id, { notes: newNotes })
    }, 800)
    // Optimistic local update
    useStore.setState(s => ({
      tasks: s.tasks.map(t => t.id === task.id ? { ...t, notes: newNotes } : t)
    }))
  }, [task.id, updateTask])

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  const handleUnfocus = (e) => {
    e.stopPropagation()
    e.preventDefault()
    updateTask(task.id, { isFocus: false })
  }

  const projectLabel = project?.isSystem ? '프로젝트 미지정' : (project?.name || '')
  const projectLabelStyle = project?.isSystem
    ? { fontStyle: 'italic', color: COLOR.textTertiary }
    : { color: COLOR.textTertiary }

  const accentColor = project?.isSystem ? '#888780' : (project ? getColor(project.color).dot : '#bbb')

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...sortableStyle,
        // E-05: column flex — header row (flex row) + body (full-width below)
        display: 'flex', flexDirection: 'column',
        padding: SPACE.cardPadding,
        background: '#fff',
        border: `1px solid ${COLOR.border}`,
        borderRadius: 6,
        marginBottom: 6,
      }}
    >
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        {/* E-01, E-02: Caret ▸/▾ (90° rotate transition) */}
        <div
          onClick={toggleExpand}
          style={{
            width: 14, height: 20, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            marginTop: 1,
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
            color: COLOR.textTertiary,
          }}
          title={isExpanded ? '접기' : '펼쳐서 노트 편집'}
        >
          <svg width={8} height={8} viewBox="0 0 8 8" fill="none">
            <path d="M2 1L6 4L2 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* E-06: Drag handle ⋮⋮ — listeners/attributes 여기에만 spread */}
        <div
          {...attributes}
          {...listeners}
          style={{
            cursor: 'grab', color: COLOR.textTertiary,
            fontSize: 14, lineHeight: 1, userSelect: 'none',
            padding: '2px 2px', flexShrink: 0, marginTop: 1,
          }}
          title="드래그하여 이동"
        >⋮⋮</div>

        {/* Checkbox */}
        <div
          onClick={e => { e.stopPropagation(); e.preventDefault(); toggleDone(task.id) }}
          style={{
            width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius,
            flexShrink: 0, cursor: 'pointer', marginTop: 2,
            border: task.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`,
            background: task.done ? CHECKBOX.checkedBg : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {task.done && (
            <svg width={8} height={8} viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        {/* Text + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: FONT.body,
              color: task.done ? COLOR.textTertiary : COLOR.textPrimary,
              textDecoration: task.done ? 'line-through' : 'none',
              lineHeight: 1.4,
              wordBreak: 'break-word',
            }}
          >
            {task.text}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            marginTop: 2, fontSize: FONT.ganttMs,
          }}>
            {projectLabel && (
              <span style={projectLabelStyle}>{projectLabel}</span>
            )}
            {milestone?.title && (
              <span style={{ color: COLOR.textTertiary }}>
                {projectLabel ? '·' : ''} {milestone.title}
              </span>
            )}
            <div style={{ flex: 1 }} />
            {/* E-12, F-37: 노트 아이콘 */}
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              style={{ color: hasNotes ? COLOR.accent : '#d3d1c7', flexShrink: 0 }}
              aria-label={hasNotes ? '노트 있음' : '노트 없음'}
            >
              <path
                d="M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5"
                stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" fill="none"
              />
            </svg>
          </div>
        </div>

        {/* × (포커스 해제) */}
        <div
          onClick={handleUnfocus}
          style={{
            width: 20, height: 20, borderRadius: 3, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            color: COLOR.textTertiary,
            fontSize: 14, lineHeight: 1,
            opacity: hover ? 1 : 0.4,
            transition: 'opacity 0.15s',
          }}
          title="포커스 해제"
        >
          ×
        </div>
      </div>

      {/* E-03, E-04: Body (OutlinerEditor 인라인 + 800ms debounce) — expanded 시만 */}
      {isExpanded && (
        <div style={{
          // caret(14) + gap(8) = 22px indent, 우측 × 영역(24) padding 보정
          paddingLeft: 22,
          paddingTop: 4,
          paddingRight: 0,
          // E-07: 높이 애니메이션 없음. caret rotate 만.
        }}>
          <OutlinerEditor
            notes={task.notes}
            onChange={handleNotesChange}
            accentColor={accentColor}
          />
        </div>
      )}
    </div>
  )
}
