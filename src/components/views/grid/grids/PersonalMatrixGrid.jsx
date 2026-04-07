import { useMemo } from 'react'
import { COLOR, FONT } from '../../../../styles/designTokens'
import useStore, { getCachedUserId } from '../../../../hooks/useStore'
import { getColor } from '../../../../utils/colors'
import InlineAdd from '../../../shared/InlineAdd'
import { CATS } from '../constants'
import ProjectCell from '../shared/ProjectCell'
import DroppableCell from '../shared/DroppableCell'
import CellContent from '../cells/CellContent'

/* ═══════════════════════════════════════════════════════
   Personal Matrix — 행=프로젝트, 열=카테고리(지금/다음/나중)
   ═══════════════════════════════════════════════════════ */
export default function PersonalMatrixGrid({ projects, myTasks, collapsed, toggleCollapse, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, activeId }) {
  const milestones = useStore(s => s.milestones)
  const userId = getCachedUserId()
  const catCounts = useMemo(() => {
    const c = {}
    CATS.forEach(cat => { c[cat.key] = myTasks.filter(t => t.category === cat.key && !t.done).length })
    return c
  }, [myTasks])

  return (
    <div style={{ border: `1px solid ${COLOR.border}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Grid container — shared columns */}
      <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(${CATS.length}, 1fr)` }}>
        <div style={{ padding: '8px 10px', fontSize: FONT.caption, fontWeight: 600, color: COLOR.textTertiary, borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}`, background: COLOR.bgSurface }}>프로젝트</div>
        {CATS.map(cat => (
          <div key={cat.key} style={{ padding: '8px 10px', fontSize: FONT.caption, fontWeight: 600, color: cat.key === 'today' ? COLOR.danger : COLOR.textTertiary, borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}`, background: COLOR.bgSurface, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: cat.color }} />
            {cat.label}
            <span style={{ fontWeight: 400, color: COLOR.textTertiary, fontSize: FONT.tiny }}>{catCounts[cat.key]}</span>
          </div>
        ))}
        {projects.map(proj => {
          const c = getColor(proj.color)
          const projTasks = myTasks.filter(t => t.projectId === proj.id && !t.done)
          const isCol = collapsed[proj.id]
          return [
            <ProjectCell key={`p-${proj.id}`} proj={proj} color={c} count={projTasks.length} isCollapsed={isCol} onToggle={() => toggleCollapse(proj.id)} />,
            ...CATS.map(cat => {
              const cellTasks = myTasks.filter(t => t.projectId === proj.id && t.category === cat.key && !t.done)
                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
              const dropId = `mat:${proj.id}:${cat.key}`
              return (
                <DroppableCell key={dropId} id={dropId} activeId={activeId}>
                  <div style={{ padding: '6px 8px', minHeight: 36 }}>
                    {isCol ? (
                      cellTasks.length > 0 ? <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{cellTasks.length}건</span> : null
                    ) : (
                      <>
                        <CellContent tasks={cellTasks} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} />
                        <InlineAdd projectId={proj.id} category={cat.key} color={c} compact />
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
