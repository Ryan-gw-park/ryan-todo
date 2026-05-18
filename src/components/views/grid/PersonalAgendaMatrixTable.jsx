import { useMemo, useState } from 'react'
import useStore, { getCachedUserId } from '../../../hooks/useStore'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { COLOR, FONT } from '../../../styles/designTokens'
import {
  AGENDA_TYPES,
  makeCellKey,
  makeRowId,
  getVisibleProjects,
} from '../../../utils/dnd/cellKeys/personalAgenda'
import AgendaColHeader from './cells/AgendaColHeader'
import AgendaRowHeader from './cells/AgendaRowHeader'
import AgendaMatrixCell from './cells/AgendaMatrixCell'

/* PersonalAgendaMatrixTable — Hotfix r3
 *
 * 행 = top-level project (모든 미아카이브 프로젝트 표시).
 * 열 = 4 고정 agenda.
 * Inbox 행 폐지. agendas 미지정 task는 'personal' 컬럼에 가상 표시 (getCellTasks 내부 처리).
 *
 * Row reorder: SortableContext + AgendaRowHeader(useSortable).
 *   - row 자체 drag → 다른 row 위에 drop → reorderProjects
 *   - task 카드 drag → row 헤더 drop → task.projectId 재할당
 *   - handler가 active.id 패턴으로 분기
 */
export default function PersonalAgendaMatrixTable({ projects, tasks }) {
  const currentUserId = getCachedUserId()
  const [hideDone, setHideDone] = useState(true)
  const localProjectOrder = useStore(s => s.localProjectOrder)

  const visibleProjects = useMemo(
    () => getVisibleProjects(projects, localProjectOrder),
    [projects, localProjectOrder]
  )

  const rowIds = useMemo(
    () => visibleProjects.map(p => makeRowId(p.id)),
    [visibleProjects]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 2px',
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
          gridTemplateColumns: '200px repeat(4, minmax(160px, 1fr))',
          gap: 1,
          background: COLOR.divider,
          minWidth: 200 + 4 * 160 + 4,
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

          {/* Project rows — SortableContext for row reorder */}
          <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
            {visibleProjects.map(project => (
              <RowGroup key={project.id}>
                <AgendaRowHeader project={project} />
                {AGENDA_TYPES.map(agendaType => (
                  <AgendaMatrixCell
                    key={`${project.id}-${agendaType}`}
                    cellKey={makeCellKey(project.id, agendaType)}
                    tasks={tasks}
                    hideDone={hideDone}
                    currentUserId={currentUserId}
                    project={project}
                  />
                ))}
              </RowGroup>
            ))}
          </SortableContext>

          {/* 빈 상태 */}
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
