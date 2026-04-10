import { useMemo } from 'react'
import { SortableContext, useSortable, verticalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { COLOR, FONT } from '../../../../styles/designTokens'
import useStore, { getCachedUserId } from '../../../../hooks/useStore'
import { getColor } from '../../../../utils/colors'
import InlineAdd from '../../../shared/InlineAdd'
import { CATS } from '../constants'
import DroppableCell from '../shared/DroppableCell'
import CellContent from '../cells/CellContent'
import InlineMsAdd from '../cells/InlineMsAdd'

// 12b: Sortable Lane wrapper
function SortableLaneCard({ projId, section, disabled, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `project-lane:${projId}`,
    data: { section, projectId: projId, type: 'project-lane' },
    disabled,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      {typeof children === 'function' ? children({ attributes, listeners }) : children}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Personal Matrix — Lane 카드 (프로젝트별 독립)
   12a: Lane 카드 + sticky 헤더 + 집중 모드
   ═══════════════════════════════════════════════════════ */
export default function PersonalMatrixGrid({
  projects, myTasks, collapsed, toggleCollapse,
  editingId, setEditingId, handleEditFinish,
  toggleDone, openDetail, activeId,
  editingMsId, onStartMsEdit, handleMsEditFinish, cancelMsEdit,
  matrixMsCollapsed, toggleMatrixMsCollapse, handleMsDelete,
  matrixDoneCollapsed, toggleMatrixDoneCollapse,
  focusMode, onToggleFocusMode,
}) {
  const milestones = useStore(s => s.milestones)
  const addTask = useStore(s => s.addTask)
  const addMilestoneInProject = useStore(s => s.addMilestoneInProject)
  const userId = getCachedUserId()

  const catCounts = useMemo(() => {
    const c = {}
    CATS.forEach(cat => { c[cat.key] = myTasks.filter(t => t.category === cat.key && !t.done).length })
    return c
  }, [myTasks])

  const displayCats = focusMode ? CATS.filter(c => c.key === 'today') : CATS
  const cardGridCols = focusMode ? '1fr' : `repeat(${CATS.length}, 1fr)`
  const outerCols = focusMode ? 'repeat(2, 1fr)' : '1fr'

  return (
    <div>
      {/* Summary pill bar (sticky 아님, 일반 flow) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 14px', marginBottom: 12,
      }}>
        {displayCats.map(cat => {
          const isToday = cat.key === 'today'
          return (
            <div key={cat.key} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 999,
              background: isToday ? 'rgba(229, 62, 62, 0.08)' : 'transparent',
              color: isToday ? '#991B1B' : COLOR.textSecondary,
              fontSize: FONT.caption, fontWeight: isToday ? 500 : 400,
            }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: cat.color }} />
              {cat.label}
              <span style={{ fontSize: FONT.tiny, opacity: 0.8 }}>{catCounts[cat.key]}</span>
            </div>
          )
        })}
        <div style={{ flex: 1 }} />
        <button
          onClick={onToggleFocusMode}
          title={focusMode ? '집중 모드 해제' : '집중 모드'}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            border: 'none',
            background: focusMode ? COLOR.danger : 'transparent',
            color: focusMode ? '#fff' : COLOR.textTertiary,
            cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >◎</button>
      </div>

      {/* Lane 카드 리스트 */}
      <SortableContext
        items={projects.map(p => `project-lane:${p.id}`)}
        strategy={focusMode ? rectSortingStrategy : verticalListSortingStrategy}
      >
      <div style={{
        display: 'grid', gridTemplateColumns: outerCols,
        gap: focusMode ? 8 : 0,
        alignItems: 'start',
      }}>
        {projects.map(proj => {
          const c = getColor(proj.color)
          const projAllTasks = myTasks.filter(t => t.projectId === proj.id)
          const projActiveCount = projAllTasks.filter(t => !t.done).length
          const isCol = collapsed[proj.id]
          const projMyMilestones = milestones.filter(m => m.project_id === proj.id && m.owner_id === userId)
          const projDoneCollapsed = matrixDoneCollapsed ? (matrixDoneCollapsed[proj.id] !== false) : true
          const onToggleProjDone = () => toggleMatrixDoneCollapse && toggleMatrixDoneCollapse(proj.id)
          const section = proj.teamId ? 'team' : 'personal'

          // 카테고리별 카운트 (접힌 Lane 요약용)
          const catCountsByProj = {}
          CATS.forEach(cat => {
            catCountsByProj[cat.key] = projAllTasks.filter(t => t.category === cat.key && !t.done).length
          })

          return (
            <SortableLaneCard key={proj.id} projId={proj.id} section={section} disabled={focusMode}>
              {({ attributes, listeners }) => (
            <div style={{
              background: '#fff', border: `1px solid ${COLOR.border}`, borderRadius: 10,
              marginBottom: focusMode ? 0 : 12, overflow: 'hidden',
            }}>
              {/* Lane 헤더 (drag handle) */}
              <div
                {...(focusMode ? {} : attributes)}
                {...(focusMode ? {} : listeners)}
                onClick={() => toggleCollapse(proj.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', cursor: focusMode ? 'pointer' : 'grab',
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
                {isCol ? (
                  focusMode ? (
                    <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>● {catCountsByProj.today}</span>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {CATS.map(cat => (
                        <span key={cat.key} style={{
                          fontSize: FONT.tiny, color: COLOR.textTertiary,
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                          <span style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: cat.color, display: 'inline-block',
                          }} />
                          {catCountsByProj[cat.key]}
                        </span>
                      ))}
                    </div>
                  )
                ) : (
                  <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{projActiveCount}건</span>
                )}
              </div>

              {/* Lane 본문 */}
              {!isCol && (
                <div style={{ display: 'grid', gridTemplateColumns: cardGridCols }}>
                  {displayCats.map(cat => {
                    const cellTasks = myTasks.filter(t => t.projectId === proj.id && t.category === cat.key)
                      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                    const dropId = `mat:${proj.id}:${cat.key}`
                    const cellMs = cat.key === 'today' ? projMyMilestones : null
                    const handleAddMsForCell = async () => {
                      const newMs = await addMilestoneInProject(proj.id, { ownerId: userId })
                      if (newMs && onStartMsEdit) onStartMsEdit(newMs.id)
                    }
                    const handleCellMsAddTask = async (msId) => {
                      const t = await addTask({
                        text: '', projectId: proj.id, keyMilestoneId: msId, category: cat.key,
                      })
                      if (t) setEditingId(t.id)
                    }
                    const cellInner = (
                      <div style={{
                        padding: '8px 12px', minHeight: 60,
                        borderRight: !focusMode && cat.key !== 'later' ? `1px solid ${COLOR.border}` : 'none',
                        background: cat.key === 'today' ? 'rgba(229, 62, 62, 0.04)' : 'transparent',
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
                          cellSortableId={focusMode ? null : dropId}
                        />
                        <InlineAdd projectId={proj.id} category={cat.key} color={c} compact />
                        {cat.key === 'today' && <InlineMsAdd onClick={handleAddMsForCell} />}
                      </div>
                    )
                    return focusMode ? (
                      <div key={dropId}>{cellInner}</div>
                    ) : (
                      <DroppableCell key={dropId} id={dropId} activeId={activeId}>
                        {cellInner}
                      </DroppableCell>
                    )
                  })}
                </div>
              )}
            </div>
              )}
            </SortableLaneCard>
          )
        })}
      </div>
      </SortableContext>

      {projects.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>표시할 프로젝트가 없습니다</div>
      )}
    </div>
  )
}
