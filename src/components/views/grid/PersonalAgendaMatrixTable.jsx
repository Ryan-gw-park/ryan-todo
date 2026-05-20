import { useCallback, useEffect, useMemo, useState } from 'react'
import useStore, { getCachedUserId } from '../../../hooks/useStore'
import usePivotExpandState from '../../../hooks/usePivotExpandState'
import useMentionColorMap from '../../../hooks/useMentionColorMap'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { COLOR, FONT } from '../../../styles/designTokens'
import {
  AGENDA_TYPES,
  makeCellKey,
  makeRowId,
  getVisibleProjects,
} from '../../../utils/dnd/cellKeys/personalAgenda'
import { extractAllMentions } from '../../../utils/mentions'
import AgendaColHeader from './cells/AgendaColHeader'
import AgendaRowHeader from './cells/AgendaRowHeader'
import AgendaMatrixCell from './cells/AgendaMatrixCell'
import AgendaMentionFilter from './cells/AgendaMentionFilter'
import MentionColumnHeader from './cells/MentionColumnHeader'

const COLUMN_MODE_KEY = 'agendaMatrixColumnMode'

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

  // Hotfix r9: 컬럼 모드 토글 (agenda ↔ mention). localStorage 유지.
  const [columnMode, setColumnMode] = useState(() => {
    try { return localStorage.getItem(COLUMN_MODE_KEY) || 'agenda' }
    catch { return 'agenda' }
  })
  useEffect(() => {
    try { localStorage.setItem(COLUMN_MODE_KEY, columnMode) } catch { /* noop */ }
  }, [columnMode])
  const toggleColumnMode = useCallback(() => {
    setColumnMode(prev => (prev === 'agenda' ? 'mention' : 'agenda'))
  }, [])

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
  // 개인 프로젝트 task는 scope='private' → assigneeId=null. RLS에서 owner에게만 전달되므로 본인 소유.
  const myVisibleTasks = useMemo(
    () => (tasks || []).filter(t =>
      (t.assigneeId === currentUserId || (!t.teamId && !t.assigneeId)) &&
      !t.deletedAt &&
      (hideDone ? !t.done : true)
    ),
    [tasks, currentUserId, hideDone]
  )

  const mentions = useMemo(
    () => extractAllMentions(myVisibleTasks),
    [myVisibleTasks]
  )

  // Hotfix r7: 담당자별 영구 고유 색상 매핑 (localStorage)
  const mentionColorMap = useMentionColorMap(mentions)

  // Hotfix r9: 모드별 컬럼 키 목록
  //   - agenda: 고정 4 enum
  //   - mention: 추출된 mention 이름 (빈도순)
  const columnKeys = useMemo(() => {
    if (columnMode === 'mention') {
      return mentions.map(m => m.name)
    }
    return AGENDA_TYPES
  }, [columnMode, mentions])

  // mention 모드에서 mention 0건이면 컬럼 0개 → 안내 표시 필요
  const mentionEmpty = columnMode === 'mention' && columnKeys.length === 0

  const toggleRow = useCallback((pid) => {
    const cur = pivotCollapsed[pid] === true
    setPivotCollapsed(pid, !cur)
  }, [pivotCollapsed, setPivotCollapsed])

  // 행별 task 수 (모든 cell 합산, 모드 무관 — 본인 task 전체 수)
  const taskCountByProject = useMemo(() => {
    const m = new Map()
    for (const p of visibleProjects) {
      const cnt = (tasks || []).filter(t =>
        (t.assigneeId === currentUserId || (!t.teamId && !t.assigneeId)) &&
        !t.deletedAt &&
        (hideDone ? !t.done : true) &&
        t.projectId === p.id
      ).length
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* 컬럼 모드 토글 */}
          <div style={{
            display: 'inline-flex',
            border: `1px solid ${COLOR.border}`,
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <button
              type="button"
              onClick={() => columnMode !== 'agenda' && toggleColumnMode()}
              style={{
                fontSize: FONT.caption,
                padding: '3px 10px',
                background: columnMode === 'agenda' ? COLOR.bgActive : '#fff',
                color: columnMode === 'agenda' ? COLOR.textPrimary : COLOR.textTertiary,
                border: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: columnMode === 'agenda' ? 600 : 400,
              }}
            >아젠다</button>
            <button
              type="button"
              onClick={() => columnMode !== 'mention' && toggleColumnMode()}
              style={{
                fontSize: FONT.caption,
                padding: '3px 10px',
                background: columnMode === 'mention' ? COLOR.bgActive : '#fff',
                color: columnMode === 'mention' ? COLOR.textPrimary : COLOR.textTertiary,
                border: 0,
                borderLeft: `1px solid ${COLOR.border}`,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: columnMode === 'mention' ? 600 : 400,
              }}
            >담당자</button>
          </div>
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
      </div>

      {/* @멘션 토글 그룹 */}
      <AgendaMentionFilter
        mentions={mentions}
        active={activeMentions}
        onToggle={toggleMention}
        onClear={clearMentions}
        colorMap={mentionColorMap}
      />

      {/* 본체 */}
      {mentionEmpty ? (
        <div style={{
          padding: '24px 12px',
          border: `1px solid ${COLOR.border}`,
          borderRadius: 6,
          background: '#fff',
          textAlign: 'center',
          fontSize: FONT.caption,
          color: COLOR.textTertiary,
          fontStyle: 'italic',
        }}>
          @태그된 담당자가 없습니다. task 텍스트에 “@이름” 또는 “@A+B” 형식으로 담당자를 추가하세요.
        </div>
      ) : (
        <div style={{
          overflowX: 'auto',
          overflowY: 'visible',
          border: `1px solid ${COLOR.border}`,
          borderRadius: 6,
          background: COLOR.divider,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `220px repeat(${columnKeys.length}, minmax(160px, 1fr))`,
            gap: 1,
            background: COLOR.divider,
            minWidth: 220 + columnKeys.length * 160 + (columnKeys.length + 1),
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
            {columnKeys.map(columnKey => (
              columnMode === 'mention'
                ? (
                  <MentionColumnHeader
                    key={columnKey}
                    mentionName={columnKey}
                    count={mentions.find(m => m.name === columnKey)?.count}
                    colorMap={mentionColorMap}
                  />
                )
                : <AgendaColHeader key={columnKey} agendaType={columnKey} />
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
                    {/* 접힌 행은 row header가 1/-1 span — cells 미렌더 */}
                    {!isCollapsed && columnKeys.map(columnKey => (
                      <AgendaMatrixCell
                        key={`${project.id}-${columnKey}`}
                        cellKey={makeCellKey(project.id, columnKey)}
                        tasks={tasks}
                        hideDone={hideDone}
                        currentUserId={currentUserId}
                        project={project}
                        activeMentions={activeMentions}
                        mentionColorMap={mentionColorMap}
                        columnMode={columnMode}
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
      )}
    </div>
  )
}

function RowGroup({ children }) {
  return <>{children}</>
}
