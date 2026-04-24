import React, { useMemo } from 'react'
import { COLOR, FONT, LIST, OPACITY } from '../../../../styles/designTokens'
import PersonalTodoTaskRow from './PersonalTodoTaskRow'

/* ═══════════════════════════════════════════════
   PersonalTodoProjectGroup (Loop-45)
   한 프로젝트 블록 = 독립 CSS grid (170px | 130px | 1fr)

   - 프로젝트 col은 task 행들을 span (gridRow: '1 / span N')
   - task.isFocus 있으면 전체 opacity: OPACITY.projectDimmed (F-31)
   - "N건" 카운트 + "N건 포커스 이동" 부가 힌트 (F-32)
   - F-11: tasks 0건이면 render skip (부모가 보장해도 방어)
   - 접힘 시 header만 렌더
   - MS dedup: 동일 MS 연속 task는 2번째부터 msLabel=''
   - keyMilestoneId==null → '기타' (isEtc=true)
   ═══════════════════════════════════════════════ */
export default function PersonalTodoProjectGroup({
  project,
  sectionTasks,          // 이 섹션(지금/다음/남은)에 속한 이 프로젝트의 task 리스트
  milestones,            // 전체 milestones 배열
  allProjectTasks,       // 이 프로젝트의 모든 task (흐림/포커스 카운트용)
  isExpanded,
  onToggle,
}) {
  const focusCount = useMemo(
    () => allProjectTasks.filter(t => t.isFocus).length,
    [allProjectTasks]
  )
  const hasFocus = focusCount > 0
  const totalInSection = sectionTasks.length

  // F-11: 이 섹션에 task 0건이면 skip
  if (totalInSection === 0) return null

  const resolveMsLabel = (msId) => {
    if (!msId) return '기타'
    const ms = milestones.find(m => m.id === msId)
    return ms?.title || ''
  }

  const tasksWithLabels = useMemo(() => {
    let prevMsId = '__init__'
    return sectionTasks.map(t => {
      const msId = t.keyMilestoneId ?? null
      const showLabel = msId !== prevMsId
      prevMsId = msId
      return {
        task: t,
        msLabel: showLabel ? resolveMsLabel(msId) : '',
        isEtc: showLabel && msId == null,
      }
    })
  }, [sectionTasks, milestones])

  const spanRows = isExpanded ? totalInSection : 1

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${LIST.colWidthProject}px ${LIST.colWidthMilestone}px 1fr`,
        alignItems: 'start',
        opacity: hasFocus ? OPACITY.projectDimmed : 1,
        transition: 'opacity 0.2s',
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
        {hasFocus && (
          <div style={{
            fontSize: FONT.caption, color: COLOR.textTertiary,
            marginLeft: 16, marginTop: 2,
            fontStyle: 'italic',
          }}>
            {focusCount}건 포커스 이동
          </div>
        )}
      </div>

      {/* Task rows (col 2 + col 3) */}
      {isExpanded && tasksWithLabels.map(({ task, msLabel, isEtc }) => (
        <React.Fragment key={task.id}>
          <PersonalTodoTaskRow task={task} msLabel={msLabel} isEtc={isEtc} />
        </React.Fragment>
      ))}

      {/* 접힘 상태: col 2/3 빈 placeholder (grid row balance) */}
      {!isExpanded && (
        <>
          <div />
          <div />
        </>
      )}
    </div>
  )
}
