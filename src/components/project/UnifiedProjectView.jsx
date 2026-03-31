import { useState, useMemo, useCallback } from 'react'
import { COLOR, FONT, CHECKBOX } from '../../styles/designTokens'
import useStore from '../../hooks/useStore'
import { useProjectKeyMilestone } from '../../hooks/useProjectKeyMilestone'
import { getColor } from '../../utils/colors'
import { buildTree } from '../../utils/milestoneTree'
import MsTaskTreeMode from './MsTaskTreeMode'

/* ═══════════════════════════════════════════════════════
   UnifiedProjectView v5 — 전체 할일 + 타임라인 통합
   좌측 트리 공유, 접기/펼치기 동기화, 주간/월간/분기 스케일
   ═══════════════════════════════════════════════════════ */

const TREE_W = 340

// ─── Date helpers ───
function parseDate(s) { return s ? new Date(s + 'T00:00:00') : null }
function daysBetween(a, b) { return Math.round((b - a) / 86400000) }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function formatWeek(d) { return `${d.getMonth() + 1}/${d.getDate()}` }
function formatMonth(d) { return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}` }
function formatQuarter(d) { return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}` }
function startOfWeek(d) { const r = new Date(d); const day = r.getDay(); r.setDate(r.getDate() - (day === 0 ? 6 : day - 1)); return r }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function startOfQuarter(d) { return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1) }

function getTimelineRange(milestones, tasks, projectId) {
  const dates = []
  milestones.filter(m => m.project_id === projectId).forEach(m => {
    if (m.start_date) dates.push(new Date(m.start_date))
    if (m.end_date) dates.push(new Date(m.end_date))
  })
  tasks.filter(t => t.projectId === projectId && !t.deletedAt).forEach(t => {
    if (t.startDate) dates.push(new Date(t.startDate))
    if (t.dueDate) dates.push(new Date(t.dueDate))
  })
  const valid = dates.filter(d => !isNaN(d))
  let minD = valid.length > 0 ? new Date(Math.min(...valid)) : new Date()
  let maxD = valid.length > 0 ? new Date(Math.max(...valid)) : addDays(new Date(), 90)
  return { minD: addDays(minD, -14), maxD: addDays(maxD, 14) }
}

function getColumns(minD, maxD, scale) {
  const cols = []
  if (scale === 'week') {
    let cur = startOfWeek(minD)
    while (cur <= maxD) { cols.push({ start: new Date(cur), label: formatWeek(cur) }); cur = addDays(cur, 7) }
  } else if (scale === 'month') {
    let cur = startOfMonth(minD)
    while (cur <= maxD) { cols.push({ start: new Date(cur), label: formatMonth(cur) }); cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1) }
  } else {
    let cur = startOfQuarter(minD)
    while (cur <= maxD) { cols.push({ start: new Date(cur), label: formatQuarter(cur) }); cur = new Date(cur.getFullYear(), cur.getMonth() + 3, 1) }
  }
  return cols
}

function getColWidth(scale) { return scale === 'week' ? 56 : scale === 'month' ? 80 : 100 }

function getBarStyle(startStr, endStr, minD, colW, scale, barColor, opacity) {
  const s = parseDate(startStr), e = parseDate(endStr)
  if (!s || !e) return null
  const dayW = scale === 'week' ? colW / 7 : scale === 'month' ? colW / 30 : colW / 90
  const left = daysBetween(minD, s) * dayW
  const width = Math.max(daysBetween(s, e) * dayW, colW * 0.4)
  return { position: 'absolute', left, width, top: '50%', transform: 'translateY(-50%)', height: 16, borderRadius: 4, background: barColor, opacity }
}

// ─── Pill ───
function Pill({ items, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 1, background: COLOR.bgHover, borderRadius: 7, padding: 2 }}>
      {items.map(it => (
        <button key={it.key} onClick={() => onChange(it.key)} style={{
          border: 'none', borderRadius: 5, padding: '4px 14px', fontSize: FONT.caption, fontFamily: 'inherit', cursor: 'pointer',
          fontWeight: active === it.key ? 600 : 400,
          background: active === it.key ? '#fff' : 'transparent',
          color: active === it.key ? COLOR.textPrimary : COLOR.textTertiary,
          boxShadow: active === it.key ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
        }}>{it.label}</button>
      ))}
    </div>
  )
}

// ─── Scale Pill ───
function ScalePill({ scale, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 1, background: COLOR.bgHover, borderRadius: 6, padding: 2 }}>
      {[{ k: 'week', l: '주간' }, { k: 'month', l: '월간' }, { k: 'quarter', l: '분기' }].map(it => (
        <button key={it.k} onClick={() => onChange(it.k)} style={{
          border: 'none', borderRadius: 4, padding: '3px 10px', fontSize: FONT.tiny, fontFamily: 'inherit', cursor: 'pointer',
          fontWeight: scale === it.k ? 600 : 400,
          background: scale === it.k ? '#fff' : 'transparent',
          color: scale === it.k ? COLOR.textPrimary : COLOR.textTertiary,
          boxShadow: scale === it.k ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
        }}>{it.l}</button>
      ))}
    </div>
  )
}

/* ═══ Main ═══ */
export default function UnifiedProjectView({ projectId }) {
  const project = useStore(s => s.projects.find(p => p.id === projectId))
  const milestones = useStore(s => s.milestones)
  const tasks = useStore(s => s.tasks)
  const toggleDone = useStore(s => s.toggleDone)
  const openDetail = useStore(s => s.openDetail)
  const addMilestone = useStore(s => s.addMilestone)
  const updateMilestone = useStore(s => s.updateMilestone)
  const deleteMilestone = useStore(s => s.deleteMilestone)
  const openConfirmDialog = useStore(s => s.openConfirmDialog)
  const { pkm, loading: pkmLoading } = useProjectKeyMilestone(projectId)

  const tree = useMemo(() => buildTree(milestones, projectId), [milestones, projectId])
  const color = project ? getColor(project.color) : null
  const pkmId = pkm?.id || null
  const dotColor = color?.dot || '#888'

  const [rightMode, setRightMode] = useState('전체 할일')
  const [scale, setScale] = useState('week')

  // ─── Shared collapsed state ───
  const [collapsed, setCollapsed] = useState(new Set())
  const toggleNode = useCallback((id) => {
    setCollapsed(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }, [])
  const expandAll = useCallback(() => setCollapsed(new Set()), [])
  const collapseAll = useCallback(() => {
    const ids = new Set()
    const walk = (nodes) => nodes.forEach(n => { if ((n.children || []).length > 0) { ids.add(n.id); walk(n.children) } })
    walk(tree)
    setCollapsed(ids)
  }, [tree])

  // ─── Timeline context ───
  const { minD, maxD } = useMemo(() => getTimelineRange(milestones, tasks, projectId), [milestones, tasks, projectId])
  const columns = useMemo(() => getColumns(minD, maxD, scale), [minD, maxD, scale])
  const colW = getColWidth(scale)
  const today = new Date()
  const todayLabel = scale === 'week' ? formatWeek(startOfWeek(today)) : scale === 'month' ? formatMonth(today) : formatQuarter(today)
  const timelineCtx = { columns, colW, minD, scale, todayLabel }

  // ─── Project tasks ───
  const projectTasks = useMemo(() => tasks.filter(t => t.projectId === projectId && !t.deletedAt), [tasks, projectId])
  const backlogTasks = useMemo(() => projectTasks.filter(t => !t.keyMilestoneId), [projectTasks])

  const isMobile = window.innerWidth < 768

  if (!project) return null
  if (pkmLoading) {
    return <div style={{ padding: 40, color: COLOR.textTertiary, textAlign: 'center', fontSize: FONT.body }}>로딩 중...</div>
  }
  if (isMobile) {
    return <div style={{ padding: 40, fontSize: FONT.label, color: COLOR.textTertiary, textAlign: 'center' }}>모바일에서는 간략 보기만 지원됩니다</div>
  }

  return (
    <div data-view="unified-project" style={{ height: '100%', display: 'flex', flexDirection: 'column', color: COLOR.textPrimary }}>
      {/* Header */}
      <div style={{ padding: '10px 20px 12px', borderBottom: `1px solid ${COLOR.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
          <span style={{ fontSize: FONT.projectTitle, fontWeight: 700 }}>{project.name}</span>
          <div style={{ flex: 1 }} />
          <Pill
            items={[{ key: '전체 할일', label: '전체 할일' }, { key: '타임라인', label: '타임라인' }]}
            active={rightMode}
            onChange={setRightMode}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={expandAll} style={toolBtnStyle}>모두 펼치기</button>
          <button onClick={collapseAll} style={toolBtnStyle}>모두 접기</button>
          {rightMode === '타임라인' && (
            <>
              <div style={{ width: 1, height: 16, background: COLOR.border, margin: '0 4px' }} />
              <ScalePill scale={scale} onChange={setScale} />
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {rightMode === '전체 할일' && (
          <MsTaskTreeMode
            tree={tree}
            projectTasks={projectTasks}
            backlogTasks={backlogTasks}
            projectId={projectId}
            pkmId={pkmId}
            color={color}
            toggleDone={toggleDone}
            openDetail={openDetail}
            addMilestone={addMilestone}
            updateMilestone={updateMilestone}
            deleteMilestone={deleteMilestone}
            openConfirmDialog={openConfirmDialog}
            externalCollapsed={collapsed}
            onToggleNode={toggleNode}
            onExpandAll={expandAll}
            onCollapseAll={collapseAll}
          />
        )}

        {rightMode === '타임라인' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
            <div style={{ border: `1px solid ${COLOR.border}`, borderRadius: 10, overflow: 'hidden', display: 'inline-flex', flexDirection: 'column', minWidth: '100%' }}>
              {/* Column header */}
              <div style={{ display: 'flex', background: COLOR.bgSurface, borderBottom: `1px solid ${COLOR.border}`, position: 'sticky', top: 0, zIndex: 2 }}>
                <div style={{ width: TREE_W, flexShrink: 0, padding: '6px 8px', fontSize: FONT.caption, fontWeight: 600, color: COLOR.textTertiary, borderRight: `1px solid ${COLOR.border}` }}>
                  마일스톤 / 할일
                </div>
                <div style={{ display: 'flex' }}>
                  {columns.map((col, i) => {
                    const isToday = col.label === todayLabel
                    return (
                      <div key={i} style={{
                        width: colW, flexShrink: 0, padding: '6px 4px', fontSize: FONT.tiny, fontWeight: isToday ? 700 : 500,
                        color: isToday ? '#E53E3E' : COLOR.textTertiary, textAlign: 'center',
                        borderRight: `1px solid ${isToday ? '#E53E3E' : COLOR.border}`,
                        background: isToday ? 'rgba(229,62,62,0.04)' : 'transparent',
                      }}>{col.label}</div>
                    )
                  })}
                </div>
              </div>

              {/* Tree rows */}
              {tree.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>마일스톤이 없습니다</div>
              )}
              {tree.map(node => (
                <TimelineMsRow
                  key={node.id} node={node} depth={0} dotColor={dotColor}
                  collapsed={collapsed} toggleNode={toggleNode}
                  timelineCtx={timelineCtx}
                  projectTasks={projectTasks}
                  toggleDone={toggleDone}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══ TimelineMsRow — 타임라인 모드 재귀 노드 ═══ */
function TimelineMsRow({ node, depth, dotColor, collapsed, toggleNode, timelineCtx, projectTasks, toggleDone }) {
  const hasChildren = (node.children || []).length > 0
  const isCollapsed = collapsed.has(node.id)
  const [hover, setHover] = useState(false)

  const allTasks = projectTasks.filter(t => t.keyMilestoneId === node.id && !t.deletedAt)
  const activeTasks = allTasks.filter(t => !t.done).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

  const { columns, colW, minD, scale, todayLabel } = timelineCtx

  return (
    <>
      {/* MS row */}
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${COLOR.border}`, minHeight: 30 }}
      >
        {/* Left tree */}
        <div style={{
          width: TREE_W, flexShrink: 0, padding: '4px 8px', paddingLeft: 8 + depth * 22,
          display: 'flex', alignItems: 'center', gap: 5,
          borderRight: `1px solid ${COLOR.border}`,
        }}>
          {hasChildren ? (
            <span onClick={() => toggleNode(node.id)}
              style={{ fontSize: 11, color: COLOR.textSecondary, width: 12, textAlign: 'center', cursor: 'pointer',
                transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', flexShrink: 0 }}>▾</span>
          ) : <span style={{ width: 12, flexShrink: 0 }} />}
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
          <span style={{
            fontSize: FONT.label, fontWeight: depth === 0 ? 600 : 500, color: COLOR.textPrimary,
            flex: 1, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3,
          }}>{node.title || '(제목 없음)'}</span>
        </div>

        {/* Right: Gantt */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', height: '100%' }}>
            {columns.map((col, i) => {
              const isToday = col.label === todayLabel
              return (
                <div key={i} style={{
                  width: colW, flexShrink: 0,
                  borderRight: `1px solid ${isToday ? '#E53E3E' : COLOR.border}`,
                  background: isToday ? 'rgba(229,62,62,0.03)' : 'transparent',
                }} />
              )
            })}
          </div>
          {/* MS bar */}
          {node.start_date && node.end_date && (() => {
            const bs = getBarStyle(node.start_date, node.end_date, minD, colW, scale, dotColor, hasChildren ? 0.25 : 0.5)
            return bs ? <div style={bs} /> : null
          })()}
        </div>
      </div>

      {/* Task rows (only when expanded) */}
      {!isCollapsed && activeTasks.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${COLOR.border}`, minHeight: 26 }}>
          <div style={{
            width: TREE_W, flexShrink: 0, padding: '3px 8px', paddingLeft: 8 + (depth + 1) * 22 + 14,
            display: 'flex', alignItems: 'center', gap: 5,
            borderRight: `1px solid ${COLOR.border}`,
          }}>
            <div onClick={() => toggleDone(t.id)} style={{
              width: 12, height: 12, borderRadius: 3, flexShrink: 0, cursor: 'pointer',
              border: t.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`,
              background: t.done ? CHECKBOX.checkedBg : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {t.done && <svg width={7} height={7} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
            <span style={{
              fontSize: FONT.caption, color: COLOR.textPrimary, flex: 1,
              whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3,
            }}>{t.text}</span>
          </div>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', height: '100%' }}>
              {columns.map((col, i) => (
                <div key={i} style={{ width: colW, flexShrink: 0, borderRight: `1px solid ${COLOR.border}` }} />
              ))}
            </div>
            {t.startDate && t.dueDate && (() => {
              const bs = getBarStyle(t.startDate, t.dueDate, minD, colW, scale, dotColor, 0.4)
              return bs ? <div style={{ ...bs, height: 12, borderRadius: 3 }} /> : null
            })()}
          </div>
        </div>
      ))}

      {/* Children */}
      {hasChildren && !isCollapsed && node.children.map(child => (
        <TimelineMsRow
          key={child.id} node={child} depth={depth + 1} dotColor={dotColor}
          collapsed={collapsed} toggleNode={toggleNode}
          timelineCtx={timelineCtx}
          projectTasks={projectTasks}
          toggleDone={toggleDone}
        />
      ))}
    </>
  )
}

/* ═══ Toolbar button style ═══ */
const toolBtnStyle = {
  border: 'none', borderRadius: 5, padding: '3px 10px',
  fontSize: FONT.tiny, fontFamily: 'inherit', cursor: 'pointer',
  background: COLOR.bgHover, color: COLOR.textSecondary, fontWeight: 500,
}
