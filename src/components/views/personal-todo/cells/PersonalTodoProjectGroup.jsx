import React, { useMemo } from 'react'
import { COLOR, FONT, LIST } from '../../../../styles/designTokens'
import PersonalTodoTaskRow from './PersonalTodoTaskRow'

/* ═══════════════════════════════════════════════
   PersonalTodoProjectGroup (Loop-45 → Loop-47)
   한 프로젝트 블록 = 독립 CSS grid (130px | 90px | 1fr — 튜닝 Loop-47)

   Loop-47 R-03, R-04, R-05:
   - F-11 예외: project.isSystem 이면 0건에도 렌더
   - 0건 + isSystem → 우측 task col 에 "여기에 + 할일" placeholder (Commit 8 에서 클릭 동작)
   - 프로젝트 col은 task rows span
   - 포커스 이동 task 도 백로그 잔류 (개별 dim, TaskRow)
   - MS dedup, '기타' (keyMilestoneId==null)
   ═══════════════════════════════════════════════ */
export default function PersonalTodoProjectGroup({
  project,
  sectionTasks,
  milestones,
  isExpanded,
  onToggle,
}) {
  const totalInSection = sectionTasks.length

  const tasksWithLabels = useMemo(() => {
    const msMap = new Map(milestones.map(m => [m.id, m]))
    return sectionTasks.map((t, idx) => {
      const msId = t.keyMilestoneId ?? null
      const prevMsId = idx === 0 ? '__init__' : (sectionTasks[idx - 1].keyMilestoneId ?? null)
      const showLabel = msId !== prevMsId
      const label = msId ? (msMap.get(msId)?.title || '') : '기타'
      return {
        task: t,
        msLabel: showLabel ? label : '',
        isEtc: showLabel && msId == null,
      }
    })
  }, [sectionTasks, milestones])

  // R-04: 시스템 프로젝트는 0건에도 렌더 (placeholder 표시)
  if (totalInSection === 0 && !project.isSystem) return null

  const spanRows = isExpanded ? Math.max(totalInSection, 1) : 1
  const isEmpty = totalInSection === 0

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${LIST.colWidthProject}px ${LIST.colWidthMilestone}px 1fr`,
        alignItems: 'start',
        marginBottom: LIST.projectRowGap,
        borderBottom: `1px solid ${COLOR.border}`,
        paddingBottom: 8,
      }}
    >
      {/* Project col (col 1) — row span */}
      <div
        onClick={onToggle}
        style={{
          gridRow: `1 / span ${spanRows}`,
          padding: '6px 12px 6px 4px',
          cursor: 'pointer',
          alignSelf: 'start',
          minWidth: 0,
        }}
      >
        <div style={{
          fontSize: FONT.sectionTitle, fontWeight: 500, color: COLOR.textPrimary,
          display: 'flex', alignItems: 'center', gap: 4,
          wordBreak: 'keep-all', overflowWrap: 'break-word',
        }}>
          <span style={{
            display: 'inline-block', width: 12, textAlign: 'center',
            color: COLOR.textSecondary, fontSize: 11,
          }}>
            {isExpanded ? '▼' : '▶'}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>{project.name}</span>
        </div>
        <div style={{
          fontSize: FONT.caption, color: COLOR.textTertiary,
          marginLeft: 16, marginTop: 2,
        }}>
          {totalInSection}건
        </div>
      </div>

      {/* R-05: 시스템 프로젝트 0건 placeholder (col 2-3 span, 클릭 동작은 Commit 8 에서 wire) */}
      {isEmpty && project.isSystem && (
        <div
          data-sys-empty-placeholder
          style={{
            gridColumn: '2 / 4',
            padding: '6px 8px',
            fontSize: FONT.body,
            color: COLOR.textTertiary,
            fontStyle: 'italic',
            opacity: 0.65,
            cursor: 'pointer',
          }}
          title="클릭하여 할일 추가"
        >
          여기에 + 할일
        </div>
      )}

      {/* Task rows (col 2 + col 3) — isEmpty 가 아닐 때만 */}
      {!isEmpty && isExpanded && tasksWithLabels.map(({ task, msLabel, isEtc }) => (
        <React.Fragment key={task.id}>
          <PersonalTodoTaskRow task={task} msLabel={msLabel} isEtc={isEtc} />
        </React.Fragment>
      ))}

      {/* 접힘 상태: col 2/3 빈 placeholder (grid row balance) */}
      {!isEmpty && !isExpanded && (
        <>
          <div />
          <div />
        </>
      )}
    </div>
  )
}
