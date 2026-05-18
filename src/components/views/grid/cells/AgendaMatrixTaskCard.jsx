import React, { useState } from 'react'
import useStore from '../../../../hooks/useStore'
import SortableTaskCard from '../../../dnd/SortableTaskCard'
import { COLOR, HIGHLIGHT, PILL } from '../../../../styles/designTokens'
import { matchingMentions, getMentionColorByIndex } from '../../../../utils/mentions'

/* AgendaMatrixTaskCard — Spec r2 C4b / C7 / C8.5
 *
 * R-COMP-8: SortableTaskCard 수정 0건 wrapper.
 *
 * Responsibilities:
 *   C4b: 카드 본체 (checkbox, 제목, 화살표) + ⭐ is_focus 뱃지 + category 칩
 *   C7:  cross-cell hover 강조 (store.hoveredTaskId selector)
 *   C8.5: hover 시 우측 X 버튼 → 셀의 agendaType 제거 (단일 태그 삭제)
 *
 * H-2 결정: data.type='agenda-matrix-task' 사용. FocusPanel drop은 의도되지 않은 시나리오 (no-op).
 */
const AgendaMatrixTaskCard = React.memo(function AgendaMatrixTaskCard({ task, cellKey, activeMentions, mentionColorMap }) {
  const isHovered = useStore(s => s.hoveredTaskId === task.id)
  const setHoveredTaskId = useStore(s => s.setHoveredTaskId)
  const updateTask = useStore(s => s.updateTask)
  const toggleDone = useStore(s => s.toggleDone)
  const openDetail = useStore(s => s.openDetail)
  const [editing, setEditing] = useState(false)
  const [localHover, setLocalHover] = useState(false)

  // Hotfix r7: 활성 mention 매칭 시 mention별 영구 색상으로 카드 강조
  // - 다중 매칭 task는 첫 번째 등장한 mention 색상으로 background 표시
  // - 추가 매칭은 좌측 dot로 누적 시각화
  const hitMentions = matchingMentions(task, activeMentions)
  const isMentionHit = hitMentions.length > 0
  const primaryHitColor = isMentionHit
    ? getMentionColorByIndex(mentionColorMap?.[hitMentions[0]] ?? 0)
    : null
  const showCategoryChip = task.category && task.category !== 'today'
  const categoryLabel = (
    task.category === 'next' ? '다음'
    : task.category === 'backlog' ? '백로그'
    : task.category === 'later' ? '나중'
    : task.category
  )

  const handleRemoveAgenda = (e) => {
    e.stopPropagation()
    const next = (task.agendas || []).filter(a => a !== cellKey.agendaType)
    updateTask(task.id, { agendas: next })
  }

  const handleEditFinish = (newText) => {
    setEditing(false)
    const trimmed = (newText || '').trim()
    if (trimmed && trimmed !== task.text) {
      updateTask(task.id, { text: trimmed })
    }
  }

  // 우선순위: hover(cross-cell) > mention 강조 > 기본
  // mention 강조: primaryHitColor 의 chipBg + dot outline + chipText 사용
  const wrapStyle = isHovered
    ? {
        background: HIGHLIGHT.crossCell.bg,
        outline: `1px solid ${HIGHLIGHT.crossCell.outline}`,
        color: HIGHLIGHT.crossCell.text,
      }
    : primaryHitColor
      ? {
          background: primaryHitColor.chipBg,
          outline: `1px solid ${primaryHitColor.dot}`,
          color: primaryHitColor.chipText,
        }
      : undefined

  const cardContent = (
    <div
      onMouseEnter={() => { setHoveredTaskId(task.id); setLocalHover(true) }}
      onMouseLeave={() => { setHoveredTaskId(null); setLocalHover(false) }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 4,
        fontSize: 12,
        padding: '4px 6px',
        borderRadius: 4,
        minWidth: 0,
        cursor: editing ? 'text' : 'grab',
        ...wrapStyle,
      }}
    >
      {/* ⭐ is_focus 뱃지 (R-UX-5) */}
      {task.isFocus && (
        <span
          aria-label="focus"
          style={{
            fontSize: 10,
            color: '#D85A30',
            flexShrink: 0,
            pointerEvents: 'none',
            marginTop: 1,
          }}
        >★</span>
      )}

      {/* Hotfix r6: 다중 mention 매칭 시 좌측에 추가 dot 누적 (primary는 outline으로 표시됨) */}
      {hitMentions.length > 1 && (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          flexShrink: 0,
          marginTop: 3,
        }}>
          {hitMentions.slice(1).map(name => {
            const c = getMentionColorByIndex(mentionColorMap?.[name] ?? 0)
            return (
              <span
                key={name}
                title={`@${name}`}
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: c.dot,
                }}
              />
            )
          })}
        </span>
      )}

      {/* checkbox (4-zone) */}
      <input
        type="checkbox"
        checked={!!task.done}
        onChange={() => toggleDone(task.id)}
        onMouseDown={e => e.stopPropagation()}
        style={{
          flexShrink: 0,
          marginTop: 2,
          background: isHovered ? '#fff' : undefined,
        }}
      />

      {/* 제목 (인라인 편집 zone) */}
      {editing
        ? (
          <textarea
            autoFocus
            defaultValue={task.text}
            rows={Math.max(1, Math.ceil((task.text || '').length / 14))}
            style={{
              flex: 1, minWidth: 0, width: '100%', boxSizing: 'border-box',
              fontSize: 12, border: `1px solid ${COLOR.border}`, borderRadius: 4,
              padding: '1px 4px', fontFamily: 'inherit', resize: 'none', lineHeight: 1.4,
              overflow: 'hidden',
            }}
            onBlur={e => handleEditFinish(e.target.value)}
            onMouseDown={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditFinish(e.target.value) }
              if (e.key === 'Escape') setEditing(false)
            }}
            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
          />
        )
        : (
          <span
            onClick={e => { e.stopPropagation(); setEditing(true) }}
            onMouseDown={e => e.stopPropagation()}
            style={{
              flex: 1, minWidth: 0,
              whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'break-word',
              cursor: 'text',
              textDecoration: task.done ? 'line-through' : undefined,
              color: task.done ? COLOR.textTertiary : 'inherit',
            }}
          >{task.text}</span>
        )}

      {/* category chip (R-UX-6) */}
      {showCategoryChip && !editing && !localHover && (
        <span style={{
          flexShrink: 0,
          fontSize: 9,
          background: PILL.amber.bg,
          color: PILL.amber.fg,
          borderRadius: 8,
          padding: '0 6px',
          fontWeight: 500,
          marginTop: 1,
        }}>
          {categoryLabel}
        </span>
      )}

      {/* hover 시: 화살표 (detail) + X (agenda 제거) */}
      {localHover && !editing && (
        <span style={{ display: 'inline-flex', gap: 2, flexShrink: 0, marginTop: 1 }}>
          <button
            onClick={e => { e.stopPropagation(); openDetail(task) }}
            onMouseDown={e => e.stopPropagation()}
            aria-label="상세 열기"
            style={{
              background: 'transparent', border: 0, padding: 0,
              width: 16, height: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: COLOR.textTertiary,
            }}
          >
            <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button
            onClick={handleRemoveAgenda}
            onMouseDown={e => e.stopPropagation()}
            aria-label="아젠다 태그 제거"
            style={{
              background: 'transparent', border: 0, padding: 0,
              width: 14, height: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: COLOR.textTertiary,
              fontSize: 12, lineHeight: 1,
            }}
          >×</button>
        </span>
      )}
    </div>
  )

  // 편집 중: drag 비활성 — 일반 div
  if (editing) {
    return <div key={task.id}>{cardContent}</div>
  }

  // 평상시: SortableTaskCard wrap (R-COMP-8)
  return (
    <SortableTaskCard
      id={`cell-task:${task.id}`}
      data={{
        type: 'agenda-matrix-task',
        task,
        cellKey,
      }}
      dragOpacity={0.4}
    >
      {cardContent}
    </SortableTaskCard>
  )
})

export default AgendaMatrixTaskCard
