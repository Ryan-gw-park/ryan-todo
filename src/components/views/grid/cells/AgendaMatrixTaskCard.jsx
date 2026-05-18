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
 *   C4b: 카드 본체 (checkbox, 제목, 화살표) + category 칩
 *   C7:  cross-cell hover 강조 (store.hoveredTaskId selector)
 *   C8.5: hover 시 우측 X 버튼 → 셀의 agendaType 제거 (단일 태그 삭제)
 *
 * H-2 결정: data.type='agenda-matrix-task' 사용. FocusPanel drop은 의도되지 않은 시나리오 (no-op).
 */
const AgendaMatrixTaskCard = React.memo(function AgendaMatrixTaskCard({ task, cellKey, activeMentions, mentionColorMap, columnMode = 'agenda' }) {
  const isHovered = useStore(s => s.hoveredTaskId === task.id)
  const setHoveredTaskId = useStore(s => s.setHoveredTaskId)
  const updateTask = useStore(s => s.updateTask)
  const toggleDone = useStore(s => s.toggleDone)
  const openDetail = useStore(s => s.openDetail)
  const [editing, setEditing] = useState(false)
  const [localHover, setLocalHover] = useState(false)

  // Hotfix r8: 활성 mention 매칭 시 카드 배경을 N등분 색 컬럼으로 분할
  //   - 1명 매칭: 단일 chipBg + dot outline + chipText
  //   - 2명 이상: linear-gradient hard-stop으로 카드 배경 가로 N등분 (각자 색상 영역)
  const hitMentions = matchingMentions(task, activeMentions)
  const hitColors = hitMentions.map(name =>
    getMentionColorByIndex(mentionColorMap?.[name] ?? 0)
  )
  const isMentionHit = hitColors.length > 0
  const isMultiMention = hitColors.length >= 2
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
  // 다중 매칭: linear-gradient hard-stop으로 균등 분할 (담당자별 색 컬럼)
  let wrapStyle
  if (isHovered) {
    wrapStyle = {
      background: HIGHLIGHT.crossCell.bg,
      outline: `1px solid ${HIGHLIGHT.crossCell.outline}`,
      color: HIGHLIGHT.crossCell.text,
    }
  } else if (isMultiMention) {
    const n = hitColors.length
    const segments = hitColors.map((c, i) => {
      const from = (i / n) * 100
      const to = ((i + 1) / n) * 100
      return `${c.chipBg} ${from}% ${to}%`
    }).join(', ')
    wrapStyle = {
      background: `linear-gradient(to right, ${segments})`,
      outline: `1px solid ${hitColors[0].dot}`,
      // 다중 색 배경 위 텍스트는 검정 (chipBg는 모두 옅은 톤)
      color: '#1f2937',
    }
  } else if (isMentionHit) {
    const c = hitColors[0]
    wrapStyle = {
      background: c.chipBg,
      outline: `1px solid ${c.dot}`,
      color: c.chipText,
    }
  }

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
      {/* Hotfix r8: 다중 매칭은 카드 background 색 컬럼 분할로 표현 (별도 dot 누적 불필요) */}
      {/* Hotfix r10: is_focus ★ 뱃지 제거 — FocusPanel 폐지로 set/toggle UI 부재, 의미 잃은 잔재. DB의 is_focus 컬럼은 보존. */}

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
          {columnMode === 'agenda' && (
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
          )}
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
