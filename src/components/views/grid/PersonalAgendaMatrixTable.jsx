import { useMemo, useState } from 'react'
import { getCachedUserId } from '../../../hooks/useStore'
import { COLOR, FONT, MATRIX } from '../../../styles/designTokens'
import {
  AGENDA_TYPES,
  makeCellKey,
  getVisibleMilestones,
} from '../../../utils/dnd/cellKeys/personalAgenda'
import AgendaColHeader from './cells/AgendaColHeader'
import AgendaRowHeader from './cells/AgendaRowHeader'
import AgendaMatrixCell from './cells/AgendaMatrixCell'
import AgendaInboxRow from './cells/AgendaInboxRow'

/* PersonalAgendaMatrixTable — Spec r2 C4a / C4b / C5 / C6 / C7 / C8.5 / C9
 *
 * 행 = key_milestone (uuid), 열 = 4 agenda (고정)
 *
 * D5 평탄화: milestone sub-row 없음.
 * 행 필터: 현재 사용자에게 할당된 미완료 task가 ≥1개인 milestone (변동 행 수).
 *
 * H-5 대응: 컨테이너 overflow-x: auto (가로 스크롤 대비).
 * H-6 대응: hideDone toggle 헤더에 노출.
 */
export default function PersonalAgendaMatrixTable({ projects, tasks, milestones }) {
  const currentUserId = getCachedUserId()
  const [hideDone, setHideDone] = useState(true)

  const visibleMs = useMemo(
    () => getVisibleMilestones(milestones, tasks, projects, currentUserId),
    [milestones, tasks, projects, currentUserId]
  )

  // inbox row의 instant project (InlineAdd projectId용)
  const instantProject = useMemo(() => {
    return (projects || []).find(p =>
      p.userId === currentUserId &&
      (p.systemKey === 'instant' || p.isSystem === true)
    ) || null
  }, [projects, currentUserId])

  // milestone.project_id → project 조회 맵
  const projectById = useMemo(() => {
    const m = new Map()
    for (const p of projects || []) m.set(p.id, p)
    return m
  }, [projects])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      {/* 헤더 (제목 + hideDone 토글) */}
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

      {/* 매트릭스 본체 */}
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
          minWidth: 200 + 4 * 160 + 4, // 가로 스크롤 보장
        }}>
          {/* Header row */}
          <div style={{
            background: '#fff',
            padding: '10px 12px',
            fontWeight: 600,
            fontSize: FONT.label,
            color: COLOR.textSecondary,
          }}>
            프로젝트 / 마일스톤
          </div>
          {AGENDA_TYPES.map(agendaType => (
            <AgendaColHeader key={agendaType} agendaType={agendaType} />
          ))}

          {/* Inbox row (C5) — 항상 표시 */}
          <AgendaInboxRow tasks={tasks} currentUserId={currentUserId} />
          {AGENDA_TYPES.map(agendaType => (
            <AgendaMatrixCell
              key={`inbox-${agendaType}`}
              cellKey={makeCellKey(null, agendaType)}
              tasks={tasks}
              hideDone={hideDone}
              currentUserId={currentUserId}
              project={instantProject}
            />
          ))}

          {/* Milestone rows */}
          {visibleMs.map(ms => {
            const project = projectById.get(ms.project_id) || null
            return (
              <RowGroup key={ms.id}>
                <AgendaRowHeader milestone={ms} project={project} />
                {AGENDA_TYPES.map(agendaType => (
                  <AgendaMatrixCell
                    key={`${ms.id}-${agendaType}`}
                    cellKey={makeCellKey(ms.id, agendaType)}
                    tasks={tasks}
                    hideDone={hideDone}
                    currentUserId={currentUserId}
                    project={project}
                  />
                ))}
              </RowGroup>
            )
          })}

          {/* 빈 상태 안내 */}
          {visibleMs.length === 0 && (
            <div style={{
              gridColumn: '1 / -1',
              padding: '24px 12px',
              background: '#fff',
              textAlign: 'center',
              fontSize: FONT.caption,
              color: COLOR.textTertiary,
              fontStyle: 'italic',
            }}>
              아직 마일스톤에 배정된 미완료 할일이 없습니다. 신규 할일에 추가해 보세요.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 단일 grid row를 같은 위치에 배치하기 위한 Fragment wrapper
function RowGroup({ children }) {
  return <>{children}</>
}
