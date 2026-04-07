import { useMemo } from 'react'
import { COLOR } from '../../../../styles/designTokens'
import useStore from '../../../../hooks/useStore'
import { getMsPath } from '../../../../utils/milestoneTree'
import TaskRow from './TaskRow'
import MilestoneRow from './MilestoneRow'

/* ─── Cell Content — 셀 안에서 할일을 MS별로 그룹핑 ─── */
export default function CellContent({
  tasks: cellTasks, cellMilestones,
  editingId, setEditingId, handleEditFinish,
  toggleDone, openDetail, showProject, project, projectMap,
  // ─── MS interactivity props (matrix only) ───
  matrixMsInteractive = false,
  editingMsId,
  onStartMsEdit,        // (msId) => void
  handleMsEditFinish,   // (msId, value) => void
  cancelMsEdit,         // () => void
  matrixMsCollapsed,    // {[msId]: boolean}
  toggleMatrixMsCollapse, // (msId) => void
  handleMsDelete,       // (msId, msTitle) => void
  onMsAddTask,          // (msId) => void  -- closure with cell context
}) {
  const getProj = (t) => project || (projectMap && projectMap[t.projectId]) || null
  const allMilestones = useStore(s => s.milestones)
  const openModal = useStore(s => s.openModal)

  const groups = useMemo(() => {
    const msMap = {}
    const noMs = []
    cellTasks.forEach(t => {
      if (t.keyMilestoneId) {
        if (!msMap[t.keyMilestoneId]) msMap[t.keyMilestoneId] = []
        msMap[t.keyMilestoneId].push(t)
      } else {
        noMs.push(t)
      }
    })
    const result = []
    Object.entries(msMap).forEach(([msId, msTasks]) => {
      const ms = allMilestones.find(m => m.id === msId)
      result.push({ msId, ms: ms || { id: msId, title: '(제목 없음)' }, tasks: msTasks })
    })
    if (cellMilestones) {
      const msWithTasks = new Set(Object.keys(msMap))
      cellMilestones.forEach(ms => {
        if (!msWithTasks.has(ms.id)) {
          result.push({ msId: ms.id, ms, tasks: [] })
        }
      })
    }
    result.sort((a, b) => (a.tasks[0]?.sortOrder || 0) - (b.tasks[0]?.sortOrder || 0))
    return { msGroups: result, ungrouped: noMs }
  }, [cellTasks, allMilestones, cellMilestones])

  if (groups.msGroups.length === 0) {
    return cellTasks.map(t => (
      <TaskRow key={t.id} task={t} project={getProj(t)} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject={showProject} />
    ))
  }

  return (
    <>
      {groups.msGroups.map(g => {
        const msCollapsed = matrixMsCollapsed ? !!matrixMsCollapsed[g.msId] : false
        const breadcrumb = matrixMsInteractive ? getMsPath(g.msId, allMilestones) : null
        return (
          <div key={g.msId} style={{ marginBottom: 4 }}>
            <MilestoneRow
              ms={g.ms}
              taskCount={g.tasks.length}
              collapsed={msCollapsed}
              onToggleCollapse={toggleMatrixMsCollapse ? () => toggleMatrixMsCollapse(g.msId) : null}
              isEditing={matrixMsInteractive && editingMsId === g.msId}
              onStartEdit={matrixMsInteractive ? () => onStartMsEdit && onStartMsEdit(g.msId) : null}
              onFinishEdit={matrixMsInteractive ? (value) => handleMsEditFinish && handleMsEditFinish(g.msId, value) : null}
              onCancelEdit={matrixMsInteractive ? () => cancelMsEdit && cancelMsEdit() : null}
              onAddTask={matrixMsInteractive && onMsAddTask ? () => onMsAddTask(g.msId) : null}
              onDelete={matrixMsInteractive && handleMsDelete ? () => handleMsDelete(g.msId, g.ms.title) : null}
              onOpenDetail={() => openModal({ type: 'milestoneDetail', milestoneId: g.msId, returnTo: null })}
              breadcrumb={breadcrumb}
              interactive={matrixMsInteractive}
            />
            {!msCollapsed && g.tasks.map(t => (
              <TaskRow key={t.id} task={t} project={getProj(t)} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject={showProject} />
            ))}
          </div>
        )
      })}
      {groups.ungrouped.length > 0 && (
        <div style={{ marginTop: groups.msGroups.length > 0 ? 2 : 0 }}>
          {groups.msGroups.length > 0 && (
            <div style={{ height: '0.5px', background: COLOR.border, margin: '3px 0' }} />
          )}
          {groups.ungrouped.map(t => (
            <TaskRow key={t.id} task={t} project={getProj(t)} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject={showProject} />
          ))}
        </div>
      )}
    </>
  )
}
