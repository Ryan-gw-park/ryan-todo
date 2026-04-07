import { useMemo } from 'react'
import { COLOR } from '../../../../styles/designTokens'
import useStore from '../../../../hooks/useStore'
import TaskRow from './TaskRow'

/* ─── Cell Content — 셀 안에서 할일을 MS별로 그룹핑 ─── */
export default function CellContent({ tasks: cellTasks, cellMilestones, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, showProject, project, projectMap }) {
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
      result.push({ msId, msTitle: ms?.title || '(제목 없음)', tasks: msTasks })
    })
    if (cellMilestones) {
      const msWithTasks = new Set(Object.keys(msMap))
      cellMilestones.forEach(ms => {
        if (!msWithTasks.has(ms.id)) {
          result.push({ msId: ms.id, msTitle: ms.title || '(제목 없음)', tasks: [] })
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
      {groups.msGroups.map(g => (
        <div key={g.msId} style={{ marginBottom: 4 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 2px 1px', marginBottom: 1,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.textTertiary, flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: COLOR.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {g.msTitle}
            </span>
            <span style={{ fontSize: 9, color: COLOR.textTertiary, flexShrink: 0 }}>{g.tasks.length > 0 ? g.tasks.length : ''}</span>
            <span
              onClick={e => { e.stopPropagation(); openModal({ type: 'milestoneDetail', milestoneId: g.msId, returnTo: null }) }}
              style={{ fontSize: 11, color: COLOR.textTertiary, cursor: 'pointer', flexShrink: 0, padding: '0 2px', lineHeight: 1 }}
              onMouseEnter={e => e.currentTarget.style.color = COLOR.textPrimary}
              onMouseLeave={e => e.currentTarget.style.color = COLOR.textTertiary}
            >›</span>
          </div>
          {g.tasks.map(t => (
            <TaskRow key={t.id} task={t} project={getProj(t)} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject={showProject} />
          ))}
        </div>
      ))}
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
