import { useMemo } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
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
  // ─── Done section props (matrix only) ───
  doneCollapsed = true,    // default 접힘
  onToggleDoneCollapse,    // () => void
  // ─── Sortable props (matrix only, 7-E1) ───
  cellSortableId,
}) {
  const getProj = (t) => project || (projectMap && projectMap[t.projectId]) || null
  const allMilestones = useStore(s => s.milestones)
  const openModal = useStore(s => s.openModal)

  const groups = useMemo(() => {
    const msMap = {}
    const noMs = []
    const done = []
    cellTasks.forEach(t => {
      if (t.done) {
        done.push(t)
        return
      }
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
    result.sort((a, b) => (a.ms.sort_order ?? 0) - (b.ms.sort_order ?? 0))
    done.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    return { msGroups: result, ungrouped: noMs, done }
  }, [cellTasks, allMilestones, cellMilestones])

  // 7-E1/7-E2: 셀 내 모든 sortable item id 수집 (MS 헤더 + task, done 제외)
  const allItemIds = useMemo(() => {
    const ids = []
    groups.msGroups.forEach(g => {
      ids.push(`cell-ms:${g.msId}`)
      g.tasks.forEach(t => ids.push(`cell-task:${t.id}`))
    })
    groups.ungrouped.forEach(t => ids.push(`cell-task:${t.id}`))
    return ids
  }, [groups])

  const taskRowProps = {
    project: undefined, // overridden per task
    editingId, setEditingId, handleEditFinish, toggleDone, openDetail, showProject,
  }

  if (groups.msGroups.length === 0) {
    const ungroupedRows = groups.ungrouped.map(t => (
      <TaskRow key={t.id} task={t} project={getProj(t)} {...taskRowProps} />
    ))
    return (
      <>
        {cellSortableId ? (
          <SortableContext items={allItemIds} id={cellSortableId} strategy={verticalListSortingStrategy}>
            {ungroupedRows}
          </SortableContext>
        ) : (
          ungroupedRows
        )}
        <DoneSection
          doneTasks={groups.done}
          collapsed={doneCollapsed}
          onToggle={onToggleDoneCollapse}
          getProj={getProj}
          taskRowProps={taskRowProps}
        />
      </>
    )
  }

  const groupedContent = (
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

  return (
    <>
      {cellSortableId ? (
        <SortableContext items={allItemIds} id={cellSortableId} strategy={verticalListSortingStrategy}>
          {groupedContent}
        </SortableContext>
      ) : (
        groupedContent
      )}
      <DoneSection
        doneTasks={groups.done}
        collapsed={doneCollapsed}
        onToggle={onToggleDoneCollapse}
        getProj={getProj}
        taskRowProps={{ editingId, setEditingId, handleEditFinish, toggleDone, openDetail, showProject }}
      />
    </>
  )
}

/* ─── Done Section — 셀 하단의 완료 task 접기 영역 ─── */
function DoneSection({ doneTasks, collapsed, onToggle, getProj, taskRowProps }) {
  if (!doneTasks || doneTasks.length === 0) return null
  return (
    <div style={{
      marginTop: 4, paddingTop: 3,
      borderTop: `0.5px dashed ${COLOR.border}`,
    }}>
      <div
        onClick={e => { e.stopPropagation(); onToggle && onToggle() }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          cursor: onToggle ? 'pointer' : 'default',
          padding: '2px 4px',
          fontSize: 10, color: COLOR.textTertiary,
          userSelect: 'none',
        }}
      >
        <span style={{
          width: 10, fontSize: 9, textAlign: 'center',
          transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)',
          transition: 'transform 0.12s', display: 'inline-block',
        }}>▾</span>
        <span>✓ 완료 {doneTasks.length}건</span>
      </div>
      {!collapsed && doneTasks.map(t => (
        <TaskRow key={t.id} task={t} project={getProj(t)} {...taskRowProps} />
      ))}
    </div>
  )
}
