import { useCallback, useMemo, useState } from 'react'
import useStore, { getCachedUserId } from '../../../hooks/useStore'
import usePivotExpandState from '../../../hooks/usePivotExpandState'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { COLOR, FONT } from '../../../styles/designTokens'
import {
  AGENDA_TYPES,
  makeCellKey,
  makeRowId,
  getVisibleProjects,
  getCellTasks,
} from '../../../utils/dnd/cellKeys/personalAgenda'
import { extractAllMentions } from '../../../utils/mentions'
import AgendaColHeader from './cells/AgendaColHeader'
import AgendaRowHeader from './cells/AgendaRowHeader'
import AgendaMatrixCell from './cells/AgendaMatrixCell'
import AgendaMentionFilter from './cells/AgendaMentionFilter'

/* PersonalAgendaMatrixTable — Hotfix r4
 *
 * 행 = top-level project (모든 미아카이브). 열 = 4 고정 agenda.
 * 빈 셀 흰색. 행 접기/펼치기. @멘션 토글 강조.
 */
export default function PersonalAgendaMatrixTable({ projects, tasks }) {
  const currentUserId = getCachedUserId()
  const [hideDone, setHideDone] = useState(true)
  const localProjectOrder = useStore(s => s.localProjectOrder)
  const { pivotCollapsed, setPivotCollapsed } = usePivotExpandState('agendaMatrix')

  // @멘션 활성 set (다중 선택)
  const [activeMentions, setActiveMentions] = useState(() => new Set())
  const toggleMention = useCallback((name) => {
    setActiveMentions(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])
  const clearMentions = useCallback(() => setActiveMentions(new Set()), [])

  const visibleProjects = useMemo(
    () => getVisibleProjects(projects, localProjectOrder),
    [projects, localProjectOrder]
  )

  const rowIds = useMemo(
    () => visibleProjects.map(p => makeRowId(p.id)),
    [visibleProjects]
  )

  // 본인 task만 대상으로 mention 추출 (매트릭스에 실제 보이는 범위)
  const myVisibleTasks = useMemo(
    () => (tasks || []).filter(t =>
      t.assigneeId === currentUserId &&
      !t.deletedAt &&
      (hideDone ? !t.done : true)
    ),
    [tasks, currentUserId, hideDone]
  )

  const mentions = useMemo(
    () => extractAllMentions(myVisibleTasks),
    [myVisibleTasks]
  )

  const toggleRow = useCallback((pid) => {
    const cur = pivotCollapsed[pid] === true
    setPivotCollapsed(pid, !cur)
  }, [pivotCollapsed, setPivotCollapsed])

  // 행별 task 수 (모든 cell 합산, 가상 personal 분기 포함)
  const taskCountByProject = useMemo(() => {
    const m = new Map()
    for (const p of visibleProjects) {
      let cnt = 0
      // 4 셀 합산하되 중복 task 없도록 set
      const ids = new Set()
      for (const a of AGENDA_TYPES) {
        const ts = getCellTasks(tasks, { projectId: p.id, agendaType: a }, {
          currentUserId, hideDone,
        })
        for (const t of ts) ids.add(t.id)
      }
      cnt = ids.size
      m.set(p.id, cnt)
    }
    return m
  }, [visibleProjects, tasks, currentUserId, hideDone])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '4px 2px',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textSecondary }}>
          개인 할일 매트릭스
        </span>
        <button
          onClick={() => setHideDone(prev => !prev)}
          style={{
            fontSize: FONT.caption,
            color: hideDone ? COLOR.textTertiary : COLOR.textPrimary,
            background: hideDone ? 'transparent' : COLOR.bgActive,
            border: `1px solid ${COLOR.border}`,
            borderRadius: 4,
            padding: '3px 8px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {hideDone ? '완료 숨김' : '완료 표시'}
        </button>
      </div>

      {/* @멘션 토글 그룹 */}
      <AgendaMentionFilter
        mentions={mentions}
        active={activeMentions}
        onToggle={toggleMention}
        onClear={clearMentions}
      />

      {/* 본체 */}
      <div style={{
        overflowX: 'auto',
        overflowY: 'visible',
        border: `1px solid ${COLOR.border}`,
        borderRadius: 6,
        background: COLOR.divider,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '220px repeat(4, minmax(160px, 1fr))',
          gap: 1,
          background: COLOR.divider,
          minWidth: 220 + 4 * 160 + 4,
        }}>
          {/* Column headers */}
          <div style={{
            background: '#fff',
            padding: '10px 12px',
            fontWeight: 600,
            fontSize: FONT.label,
            color: COLOR.textSecondary,
          }}>
            프로젝트
          </div>
          {AGENDA_TYPES.map(agendaType => (
            <AgendaColHeader key={agendaType} agendaType={agendaType} />
          ))}

          {/* Project rows */}
          <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
            {visibleProjects.map(project => {
              const isCollapsed = pivotCollapsed[project.id] === true
              return (
                <RowGroup key={project.id}>
                  <AgendaRowHeader
                    project={project}
                    taskCount={taskCountByProject.get(project.id) || 0}
                    isCollapsed={isCollapsed}
                    onToggle={toggleRow}
                  />
                  {/* Hotfix r5: 접힌 행은 row header가 5 columns 전부 차지 (filler 불필요) */}
                  {!isCollapsed && AGENDA_TYPES.map(agendaType => (
                    <AgendaMatrixCell
                      key={`${project.id}-${agendaType}`}
                      cellKey={makeCellKey(project.id, agendaType)}
                      tasks={tasks}
                      hideDone={hideDone}
                      currentUserId={currentUserId}
                      project={project}
                      activeMentions={activeMentions}
                    />
                  ))}
                </RowGroup>
              )
            })}
          </SortableContext>

          {visibleProjects.length === 0 && (
            <div style={{
              gridColumn: '1 / -1',
              padding: '24px 12px',
              background: '#fff',
              textAlign: 'center',
              fontSize: FONT.caption,
              color: COLOR.textTertiary,
              fontStyle: 'italic',
            }}>
              표시할 프로젝트가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RowGroup({ children }) {
  return <>{children}</>
}
