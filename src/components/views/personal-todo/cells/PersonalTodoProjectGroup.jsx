import React, { useMemo, useState, useCallback } from 'react'
import { useDroppable, useDndContext } from '@dnd-kit/core'
import useStore, { getCachedUserId } from '../../../../hooks/useStore'
import { COLOR, FONT, LIST, SPACE, OPACITY } from '../../../../styles/designTokens'
import PersonalTodoTaskRow from './PersonalTodoTaskRow'

/* ── R-05/R-07: same-type drop validation (Loop-49 Option 2A) ──
   Private task → personal/system project (둘 다 !teamId)
   Team task → same-team project (teamId 일치)
   같은 project 자기 자신 = false (no-op, V5 가드)
   Spec §4-2 8가지 매트릭스 참조 */
export function canMoveTaskToProject(task, targetProject) {
  if (!task || !targetProject) return false
  if (task.projectId === targetProject.id) return false
  if (!task.teamId) return !targetProject.teamId
  return task.teamId === targetProject.teamId
}

/* ═══════════════════════════════════════════════
   PersonalTodoProjectGroup (Loop-47 R-06/R-07)
   - hover 시 헤더 우측 "+" 아이콘 표시
   - 클릭 → task rows 영역(col 2-3 span) 최하단에 inline input
   - Enter → addTask({projectId: project.id, category:'today', ...})
   - Esc → cancel
   - R-05 시스템 프로젝트 0건 placeholder 클릭 → 동일 input 진입
   ═══════════════════════════════════════════════ */
export default function PersonalTodoProjectGroup({
  project,
  sectionTasks,
  milestones,
  isExpanded,
  onToggle,
}) {
  const addTask = useStore(s => s.addTask)
  const currentUserId = getCachedUserId()

  const [headerHover, setHeaderHover] = useState(false)
  const [adding, setAdding] = useState(false)

  // R-04: 헤더 영역 droppable 등록 (Option D-ii)
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `bl-project:${project.id}`,
    data: { projectId: project.id, teamId: project.teamId, isSystem: project.isSystem },
  })

  // R-07: drag 중인 source task 와 비교하여 drop 가능 여부 판정
  const { active } = useDndContext()
  const dragSourceTask = active?.data?.current?.task
  const isDragActive = !!active && String(active.id).startsWith('bl-task:')
  const isAllowedDrop = isDragActive && dragSourceTask
    ? canMoveTaskToProject(dragSourceTask, project)
    : false
  const isSelfTarget = isDragActive && dragSourceTask?.projectId === project.id

  // 시각 피드백 결정 (R-07 V1~V5)
  // W6 (3차) 가드: V5 self-drop 시 모든 시각 효과 차단 — !isSelfTarget 필수
  const headerBg = isOver && isAllowedDrop && !isSelfTarget ? COLOR.bgHover : 'transparent'
  const headerOpacity = isOver && isDragActive && !isAllowedDrop && !isSelfTarget ? OPACITY.projectDimmed : 1
  const headerCursor = isOver && isDragActive && !isAllowedDrop && !isSelfTarget ? 'not-allowed' : undefined

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

  const handleAddFinish = useCallback((value) => {
    setAdding(false)
    const text = (value ?? '').trim()
    if (!text) return
    addTask({
      text,
      projectId: project.id,
      assigneeId: currentUserId,
      secondaryAssigneeId: null,
      keyMilestoneId: null,
      category: 'today',
      isFocus: false,
    })
  }, [addTask, project.id, currentUserId])

  // R-04: 시스템 프로젝트는 0건에도 렌더
  if (totalInSection === 0 && !project.isSystem) return null

  // 행 개수 계산: adding 중이면 +1 (input row)
  const taskRowCount = isExpanded ? tasksWithLabels.length : 0
  const addingExtra = adding ? 1 : 0
  const spanRows = Math.max(taskRowCount + addingExtra, 1)
  const isEmpty = totalInSection === 0

  return (
    <div
      ref={setDropRef}
      onMouseEnter={() => setHeaderHover(true)}
      onMouseLeave={() => setHeaderHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: `${LIST.colWidthProject}px ${LIST.colWidthMilestone}px 1fr`,
        alignItems: 'start',
        marginBottom: LIST.projectRowGap,
        borderBottom: `1px solid ${COLOR.border}`,
        paddingBottom: 8,
      }}
    >
      {/* Project col (col 1) — row span.
          Loop-49 R-04 (hotfix): setDropRef 는 최외곽 div 로 이동 (rectIntersection
          이 col 1 헤더 (130px) 과 col 2-3 task row 의 영역 불일치로 isOver 미발동
          이슈 해소). 시각 피드백 (bgHover/dim/cursor) 은 헤더 col 에 유지하여
          "어디로 옮기는지" 명시적 표시. */}
      <div
        onClick={onToggle}
        style={{
          gridRow: `1 / span ${spanRows}`,
          padding: '6px 12px 6px 4px',
          cursor: headerCursor || 'pointer',
          background: headerBg,
          opacity: headerOpacity,
          transition: 'background 0.15s, opacity 0.15s',
          alignSelf: 'start',
          minWidth: 0,
          position: 'relative',
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
          {/* R-06: hover 시 "+" 아이콘 (onClick 은 stopPropagation + adding trigger) */}
          {headerHover && !adding && (
            <span
              onClick={e => { e.stopPropagation(); setAdding(true) }}
              style={{
                fontSize: 14, color: COLOR.textSecondary,
                padding: '0 4px', cursor: 'pointer', flexShrink: 0,
                lineHeight: 1,
              }}
              title="+ 할일"
              onMouseEnter={e => e.currentTarget.style.color = COLOR.accent}
              onMouseLeave={e => e.currentTarget.style.color = COLOR.textSecondary}
            >+</span>
          )}
        </div>
        <div style={{
          fontSize: FONT.caption, color: COLOR.textTertiary,
          marginLeft: 16, marginTop: 2,
        }}>
          {totalInSection}건
        </div>
      </div>

      {/* R-05: 시스템 프로젝트 0건 placeholder — 클릭 시 adding trigger */}
      {isEmpty && project.isSystem && !adding && (
        <div
          onClick={() => setAdding(true)}
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

      {/* Task rows (col 2 + col 3) */}
      {!isEmpty && isExpanded && tasksWithLabels.map(({ task, msLabel, isEtc }) => (
        <React.Fragment key={task.id}>
          <PersonalTodoTaskRow task={task} msLabel={msLabel} isEtc={isEtc} />
        </React.Fragment>
      ))}

      {/* R-07: inline add input — col 2-3 span, 기존 task rows 아래 */}
      {adding && (
        <div style={{
          gridColumn: '2 / 4',
          padding: SPACE.cellPadding,
        }}>
          <input
            autoFocus
            placeholder={`${project.name} 에 할일 추가 후 Enter`}
            style={{
              width: '100%', fontSize: FONT.body,
              border: `1px solid ${COLOR.border}`, borderRadius: 4,
              padding: '4px 8px', fontFamily: 'inherit',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            onBlur={e => handleAddFinish(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleAddFinish(e.target.value) }
              if (e.key === 'Escape') setAdding(false)
            }}
          />
        </div>
      )}

      {/* 접힘 상태에서 빈 placeholder 없을 때: col 2/3 빈 slot */}
      {!isEmpty && !isExpanded && !adding && (
        <>
          <div />
          <div />
        </>
      )}
    </div>
  )
}
