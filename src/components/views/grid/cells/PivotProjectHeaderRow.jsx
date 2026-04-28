import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import useStore from '../../../../hooks/useStore'
import { COLOR, PILL, PIVOT } from '../../../../styles/designTokens'

/* ═════════════════════════════════════════════
   PivotProjectHeaderRow — 프로젝트 헤더 행 (spec §3.2 L-02 / L-05)

   책임:
     - L-02: 멤버별 카운트 셀이 같은 행에 인라인 (별도 카운트 행 없음)
     - L-05: hover 시 우측 끝에 `+ 마일스톤` dashed-border pill (commit 7)

   카운트 집계: Primary만 (R06)
   미배정 = assigneeId IS NULL AND secondaryAssigneeId IS NULL AND scope='team' (R31)
   5+ amber, 10+ coral (R13)
   ═════════════════════════════════════════════ */
export default function PivotProjectHeaderRow({ project, members, tasks, isExpanded, onToggle, onTotalClick }) {
  const addMilestoneInProject = useStore(s => s.addMilestoneInProject)
  const [hover, setHover] = useState(false)
  const [adding, setAdding] = useState(false)

  // commit 11: 프로젝트 헤더 행을 droppable로 등록 (D-07).
  // task drop 시 dispatcher가 type='team-matrix-project-header' 분기 → 가상 backlog 안착.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `team-matrix-project-header:${project.id}`,
    data: {
      type: 'team-matrix-project-header',
      projectId: project.id,
      members,
    },
  })

  const countByMember = {}
  for (const m of members) {
    countByMember[m.userId] = tasks.filter(t => t.assigneeId === m.userId).length
  }
  const unassignedCount = tasks.filter(t =>
    t.assigneeId == null && t.secondaryAssigneeId == null && t.scope === 'team'
  ).length
  const total = tasks.length

  const handleAddMs = (value) => {
    setAdding(false)
    setHover(false)
    const title = (value ?? '').trim()
    if (!title) return
    // useStore.js:1087 시그니처 — addMilestoneInProject(projectId, { title }).
    // pkm은 store가 select-or-insert 자동 처리.
    addMilestoneInProject(project.id, { title })
  }

  return (
    <tr
      ref={setDropRef}
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { if (!adding) setHover(false) }}
      style={{
        cursor: 'pointer',
        borderBottom: `1px solid ${COLOR.border}`,
        background: isOver ? COLOR.dropTargetTint : '#fff',
        transition: 'background 0.15s',
      }}
    >
      <td
        style={{
          position: 'sticky',
          left: 0,
          background: isOver ? COLOR.dropTargetTint : '#fff',
          zIndex: 2,
          padding: '5px 12px',
          fontSize: 13,
          fontWeight: 500,
          color: COLOR.textPrimary,
          wordBreak: 'keep-all',
          overflowWrap: 'break-word',
        }}
      >
        <span style={{ display: 'inline-block', width: 12, color: COLOR.textSecondary }}>
          {isExpanded ? '▼' : '▶'}
        </span>
        {' '}
        {project.name}
        <span style={{ marginLeft: 8, color: COLOR.textTertiary, fontWeight: 400, fontSize: 11 }}>
          {total}건
        </span>
      </td>
      {members.map(m => (
        <td key={m.userId} style={{ textAlign: 'center' }}>
          <CountCell n={countByMember[m.userId]} />
        </td>
      ))}
      <td style={{ textAlign: 'center' }}>
        <CountCell n={unassignedCount} />
      </td>
      <td
        onClick={e => { e.stopPropagation(); onTotalClick?.(project.id) }}
        style={{
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 600,
          color: COLOR.textSecondary,
          cursor: onTotalClick ? 'pointer' : 'default',
          position: 'relative',
        }}
      >
        {!adding && total}
        {hover && !adding && isExpanded && (
          <span
            onClick={e => { e.stopPropagation(); setAdding(true) }}
            style={{
              position: 'absolute',
              right: 4,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 10,
              border: `1px dashed ${COLOR.textTertiary}`,
              color: COLOR.textSecondary,
              background: '#fff',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontWeight: 400,
            }}
            title="마일스톤 추가"
          >+ MS</span>
        )}
        {adding && (
          <input
            autoFocus
            placeholder="마일스톤 제목"
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onBlur={e => handleAddMs(e.target.value)}
            onKeyDown={e => {
              e.stopPropagation()
              if (e.key === 'Enter') handleAddMs(e.target.value)
              if (e.key === 'Escape') { setAdding(false); setHover(false) }
            }}
            style={{
              width: '100%',
              fontSize: 11,
              border: `1px solid ${COLOR.border}`,
              borderRadius: 4,
              padding: '2px 6px',
              fontFamily: 'inherit',
              color: COLOR.textPrimary,
              boxSizing: 'border-box',
            }}
          />
        )}
      </td>
    </tr>
  )
}

function CountCell({ n }) {
  if (n === 0 || n == null) {
    return <span style={{ color: PIVOT.emptyCellColor, fontSize: PIVOT.emptyCellFontSize }}>{PIVOT.emptyCellMarker}</span>
  }
  if (n >= 10) {
    return (
      <span style={{
        background: PILL.coral.bg, color: PILL.coral.fg,
        borderRadius: PILL.coral.borderRadius, padding: PILL.coral.padding,
        fontWeight: PILL.coral.fontWeight, fontSize: 11,
      }}>{n}</span>
    )
  }
  if (n >= 5) {
    return (
      <span style={{
        background: PILL.amber.bg, color: PILL.amber.fg,
        borderRadius: PILL.amber.borderRadius, padding: PILL.amber.padding,
        fontWeight: PILL.amber.fontWeight, fontSize: 11,
      }}>{n}</span>
    )
  }
  return <span style={{ fontSize: 12, color: COLOR.textPrimary }}>{n}</span>
}
