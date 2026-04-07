import { COLOR, FONT } from '../../../../styles/designTokens'
import useStore from '../../../../hooks/useStore'
import { getColor } from '../../../../utils/colors'
import InlineAdd from '../../../shared/InlineAdd'
import ProjectCell from '../shared/ProjectCell'
import DroppableCell from '../shared/DroppableCell'
import MiniAvatar from '../shared/MiniAvatar'
import CellContent from '../cells/CellContent'
import InlineMsAdd from '../cells/InlineMsAdd'

/* ═══════════════════════════════════════════════════════
   Team Matrix — 행=프로젝트, 열=팀원
   ═══════════════════════════════════════════════════════ */
export default function TeamMatrixGrid({
  projects, tasks, members, collapsed, toggleCollapse,
  editingId, setEditingId, handleEditFinish,
  toggleDone, openDetail, activeId, currentTeamId,
  // ─── MS interactivity (from UnifiedGridView) ───
  editingMsId, onStartMsEdit, handleMsEditFinish, cancelMsEdit,
  matrixMsCollapsed, toggleMatrixMsCollapse, handleMsDelete,
  // ─── Done section (from UnifiedGridView) ───
  matrixDoneCollapsed, toggleMatrixDoneCollapse,
}) {
  const milestones = useStore(s => s.milestones)
  const addTask = useStore(s => s.addTask)
  const addMilestoneInProject = useStore(s => s.addMilestoneInProject)

  if (members.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>팀원 정보를 불러오는 중...</div>
  }

  return (
    <div style={{ border: `1px solid ${COLOR.border}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(${members.length}, 1fr)` }}>
        <div style={{ padding: '8px 10px', fontSize: FONT.caption, fontWeight: 600, color: COLOR.textTertiary, borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}`, background: COLOR.bgSurface }}>프로젝트</div>
        {members.map(m => (
          <div key={m.id} style={{ padding: '8px 8px', borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}`, background: COLOR.bgSurface, display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
            <MiniAvatar name={m.displayName || m.name} size={20} />
            <span style={{ fontSize: FONT.caption, fontWeight: 600, color: COLOR.textPrimary }}>{m.displayName || m.name}</span>
          </div>
        ))}
        {projects.map(proj => {
          const c = getColor(proj.color)
          const projAllTasks = tasks.filter(t => t.projectId === proj.id && t.teamId === currentTeamId)
          const projActiveCount = projAllTasks.filter(t => !t.done).length
          const isCol = collapsed[proj.id]
          // 7-B: done section collapse — 프로젝트 단위, 기본 접힘
          const projDoneCollapsed = matrixDoneCollapsed ? (matrixDoneCollapsed[proj.id] !== false) : true
          const onToggleProjDone = () => toggleMatrixDoneCollapse && toggleMatrixDoneCollapse(proj.id)
          return [
            <ProjectCell key={`p-${proj.id}`} proj={proj} color={c} count={projActiveCount} isCollapsed={isCol} onToggle={() => toggleCollapse(proj.id)} />,
            ...members.map(mem => {
              const cellTasks = projAllTasks.filter(t => t.assigneeId === mem.userId)
                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
              const cellActiveCount = cellTasks.filter(t => !t.done).length
              const dropId = `tmat:${proj.id}:${mem.userId}`
              const cellMs = milestones.filter(m => m.project_id === proj.id && m.owner_id === mem.userId)
              // 7-C: 셀 위치(프로젝트 × 멤버)로 owner 자동 set
              const handleAddMsForCell = async () => {
                const newMs = await addMilestoneInProject(proj.id, { ownerId: mem.userId })
                if (newMs && onStartMsEdit) onStartMsEdit(newMs.id)
              }
              const handleCellMsAddTask = async (msId) => {
                const t = await addTask({
                  text: '',
                  projectId: proj.id,
                  keyMilestoneId: msId,
                  category: 'today',
                  scope: 'assigned',
                  assigneeId: mem.userId,
                })
                if (t) setEditingId(t.id)
              }
              return (
                <DroppableCell key={dropId} id={dropId} activeId={activeId}>
                  <div style={{ padding: '6px 8px', minHeight: 36 }}>
                    {isCol ? (
                      cellActiveCount > 0 ? <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{cellActiveCount}건</span> : null
                    ) : (
                      <>
                        <CellContent
                          tasks={cellTasks}
                          cellMilestones={cellMs}
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
                        />
                        <InlineAdd projectId={proj.id} category="today" color={c} extraFields={{ scope: 'assigned', assigneeId: mem.userId }} compact />
                        <InlineMsAdd onClick={handleAddMsForCell} />
                      </>
                    )}
                  </div>
                </DroppableCell>
              )
            })
          ]
        })}
      </div>

      {projects.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>표시할 프로젝트가 없습니다</div>
      )}
    </div>
  )
}
