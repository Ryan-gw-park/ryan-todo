import { COLOR, FONT } from '../../../../styles/designTokens'
import useStore from '../../../../hooks/useStore'
import { getColor } from '../../../../utils/colors'
import InlineAdd from '../../../shared/InlineAdd'
import DroppableCell from '../shared/DroppableCell'
import MiniAvatar from '../shared/MiniAvatar'
import CellContent from '../cells/CellContent'
import InlineMsAdd from '../cells/InlineMsAdd'

/* ═══════════════════════════════════════════════════════
   Team Matrix — Lane 카드 (프로젝트별 독립)
   12a: Lane 카드 구조 (focusMode 없음 — 개인 매트릭스 전용)
   ═══════════════════════════════════════════════════════ */
export default function TeamMatrixGrid({
  projects, tasks, members, collapsed, toggleCollapse,
  editingId, setEditingId, handleEditFinish,
  toggleDone, openDetail, activeId, currentTeamId,
  editingMsId, onStartMsEdit, handleMsEditFinish, cancelMsEdit,
  matrixMsCollapsed, toggleMatrixMsCollapse, handleMsDelete,
  matrixDoneCollapsed, toggleMatrixDoneCollapse,
}) {
  const milestones = useStore(s => s.milestones)
  const addTask = useStore(s => s.addTask)
  const addMilestoneInProject = useStore(s => s.addMilestoneInProject)

  if (members.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>팀원 정보를 불러오는 중...</div>
  }

  return (
    <div>
      {/* Sticky 팀원 헤더 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#fff',
        border: `1px solid ${COLOR.border}`, borderRadius: 10,
        padding: '8px 14px', marginBottom: 12,
        display: 'grid', gridTemplateColumns: `repeat(${members.length}, 1fr)`,
        alignItems: 'center', gap: 8,
      }}>
        {members.map(m => (
          <div key={m.id} style={{
            display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center',
          }}>
            <MiniAvatar name={m.displayName || m.name} size={18} />
            <span style={{ fontSize: FONT.caption, fontWeight: 600, color: COLOR.textPrimary }}>{m.displayName || m.name}</span>
          </div>
        ))}
      </div>

      {/* Lane 카드 리스트 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0, alignItems: 'start' }}>
        {projects.map(proj => {
          const c = getColor(proj.color)
          const projAllTasks = tasks.filter(t => t.projectId === proj.id && t.teamId === currentTeamId)
          const projActiveCount = projAllTasks.filter(t => !t.done).length
          const isCol = collapsed[proj.id]
          const projDoneCollapsed = matrixDoneCollapsed ? (matrixDoneCollapsed[proj.id] !== false) : true
          const onToggleProjDone = () => toggleMatrixDoneCollapse && toggleMatrixDoneCollapse(proj.id)

          return (
            <div key={proj.id} style={{
              background: '#fff', border: `1px solid ${COLOR.border}`, borderRadius: 10,
              marginBottom: 12, overflow: 'hidden',
            }}>
              {/* Lane 헤더 */}
              <div
                onClick={() => toggleCollapse(proj.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', cursor: 'pointer',
                  background: COLOR.bgSurface,
                  borderBottom: isCol ? 'none' : `1px solid ${COLOR.border}`,
                }}
              >
                <span style={{
                  fontSize: 10, color: COLOR.textSecondary, width: 10,
                  display: 'inline-block', textAlign: 'center',
                  transform: isCol ? 'rotate(-90deg)' : 'rotate(0)',
                  transition: 'transform 0.15s',
                }}>▾</span>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: c.dot, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary }}>{proj.name}</span>
                <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{projActiveCount}건</span>
              </div>

              {/* Lane 본문 */}
              {!isCol && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${members.length}, 1fr)` }}>
                  {members.map((mem, memIdx) => {
                    const cellTasks = projAllTasks.filter(t => t.assigneeId === mem.userId)
                      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                    const dropId = `tmat:${proj.id}:${mem.userId}`
                    const cellMs = milestones.filter(m => m.project_id === proj.id && m.owner_id === mem.userId)
                    const handleAddMsForCell = async () => {
                      const newMs = await addMilestoneInProject(proj.id, { ownerId: mem.userId })
                      if (newMs && onStartMsEdit) onStartMsEdit(newMs.id)
                    }
                    const handleCellMsAddTask = async (msId) => {
                      const t = await addTask({
                        text: '', projectId: proj.id, keyMilestoneId: msId,
                        category: 'today', scope: 'assigned', assigneeId: mem.userId,
                      })
                      if (t) setEditingId(t.id)
                    }
                    const isLastMember = memIdx === members.length - 1
                    return (
                      <DroppableCell key={dropId} id={dropId} activeId={activeId}>
                        <div style={{
                          padding: '8px 12px', minHeight: 60,
                          borderRight: !isLastMember ? `1px solid ${COLOR.border}` : 'none',
                        }}>
                          <CellContent
                            tasks={cellTasks}
                            cellMilestones={cellMs}
                            project={proj}
                            editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                            toggleDone={toggleDone} openDetail={openDetail}
                            matrixMsInteractive
                            editingMsId={editingMsId}
                            onStartMsEdit={onStartMsEdit}
                            handleMsEditFinish={handleMsEditFinish}
                            cancelMsEdit={cancelMsEdit}
                            matrixMsCollapsed={matrixMsCollapsed}
                            toggleMatrixMsCollapse={toggleMatrixMsCollapse}
                            handleMsDelete={handleMsDelete}
                            onMsAddTask={handleCellMsAddTask}
                            doneCollapsed={projDoneCollapsed}
                            onToggleDoneCollapse={onToggleProjDone}
                            cellSortableId={dropId}
                          />
                          <InlineAdd projectId={proj.id} category="today" color={c} extraFields={{ scope: 'assigned', assigneeId: mem.userId }} compact />
                          <InlineMsAdd onClick={handleAddMsForCell} />
                        </div>
                      </DroppableCell>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {projects.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>표시할 프로젝트가 없습니다</div>
      )}
    </div>
  )
}
