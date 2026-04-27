# Sub-Loop 7-0: UnifiedGridView 분산 구조 리팩터링

## 목표
800줄 monolith `UnifiedGridView.jsx`를 12개 모듈로 분할.
**동작 100% 동일** — 향후 Sub-Loop 7-A~E의 작업 베이스 마련.

## 신규 디렉토리 구조
```
src/components/views/
  UnifiedGridView.jsx              (~290줄 — orchestrator만)
  grid/
    constants.js                   CATS, DAY_LABELS, EMPTY_OBJ, getMonday, fmtDate, getWeekNumber
    grids/
      PersonalMatrixGrid.jsx
      TeamMatrixGrid.jsx
      PersonalWeeklyGrid.jsx
      TeamWeeklyGrid.jsx
    cells/
      TaskRow.jsx                  (기존 TaskCard 컴포넌트 추출)
      CellContent.jsx              (기존 MsGroupedTasks 추출)
    shared/
      Pill.jsx
      MiniAvatar.jsx
      DroppableCell.jsx
      ProjectCell.jsx
```

> `hooks/` 폴더는 Sub-Loop 7-A 이후 (`useMsBreadcrumb`, `useMatrixDnd`) 추가 예정.

## REQ-LOCK 요구사항

1. **동작 100% 동일** — 어떤 prop, state, render 출력도 변경 금지
2. **Vite TDZ 위반 0건** — 모든 imported token(`COLOR`, `FONT`, `SPACE`, `CHECKBOX`, `VIEW_WIDTH`)은 컴포넌트 함수 내부에서만 참조. 모듈 레벨 `const X = COLOR.foo` 금지
3. **scope toggle 보존** — Loop 6이 별도로 다루므로 이 sub-loop에서 건드리지 않음
4. **dead destructure 보존** (`addTask`, `reorderTasks` 등) — 이번 sub-loop에서 cleanup 금지. 7-A 이후 각 sub-loop가 실제로 사용하는 시점에 정리
5. **DELETE-5** — UnifiedGridView.jsx 외부에서 `MsGroupedTasks`, `TaskCard`, `Pill`, `MiniAvatar`, `DroppableCell`, `ProjectCell`를 import하는 곳이 없는지 검증

---

## DELETE-5 사전 검증 (외부 참조 확인)

```bash
# 모두 0건이어야 함
grep -rn "from.*UnifiedGridView'" src/ --include="*.jsx" --include="*.js" \
  | grep -v "App.jsx"  # App.jsx만 default import 허용
grep -rn "MsGroupedTasks\|TaskCard\b" src/ --include="*.jsx" --include="*.js"
```

→ 검증 결과: `UnifiedGridView`는 `App.jsx`에서만 default import. `MsGroupedTasks`, `TaskCard`는 UnifiedGridView.jsx 내부에서만 사용. **외부 의존 0건 확인**.

---

## 1. CREATE: `src/components/views/grid/constants.js`

```js
// 매트릭스/주간 플래너 공통 상수 + 순수 헬퍼
// React 의존성 없음 — 어디서든 import 가능

export const CATS = [
  { key: 'today', label: '지금 할일', color: '#E53E3E' },
  { key: 'next', label: '다음', color: '#D69E2E' },
  { key: 'later', label: '나중', color: '#3182CE' },
]

export const DAY_LABELS = ['월', '화', '수', '목', '금']

export const EMPTY_OBJ = {}

export function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  date.setHours(0, 0, 0, 0)
  return date
}

export function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getWeekNumber(d) {
  const oneJan = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d - oneJan) / 86400000 + oneJan.getDay() + 1) / 7)
}
```

---

## 2. CREATE: `src/components/views/grid/shared/Pill.jsx`

```jsx
import { COLOR, FONT } from '../../../../styles/designTokens'

export default function Pill({ items, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 1, background: COLOR.bgHover, borderRadius: 7, padding: 2 }}>
      {items.map(it => (
        <button key={it.k} onClick={() => onChange(it.k)} style={{
          border: 'none', borderRadius: 5, padding: '4px 14px', fontSize: FONT.caption, fontFamily: 'inherit', cursor: 'pointer',
          fontWeight: active === it.k ? 600 : 400,
          background: active === it.k ? '#fff' : 'transparent',
          color: active === it.k ? COLOR.textPrimary : COLOR.textTertiary,
          boxShadow: active === it.k ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
        }}>{it.l}</button>
      ))}
    </div>
  )
}
```

---

## 3. CREATE: `src/components/views/grid/shared/MiniAvatar.jsx`

```jsx
export default function MiniAvatar({ name, size = 22 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: '#888',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.42, fontWeight: 600, flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}
```

---

## 4. CREATE: `src/components/views/grid/shared/DroppableCell.jsx`

```jsx
import { useDroppable } from '@dnd-kit/core'
import { COLOR } from '../../../../styles/designTokens'

export default function DroppableCell({ id, activeId, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const showHighlight = isOver && activeId
  return (
    <div ref={setNodeRef} style={{
      borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}`,
      transition: 'background 0.08s',
      ...(showHighlight ? { background: 'rgba(49,130,206,0.06)', outline: `2px dashed #3182CE`, outlineOffset: -2 } : {}),
    }}>
      {children}
    </div>
  )
}
```

---

## 5. CREATE: `src/components/views/grid/shared/ProjectCell.jsx`

```jsx
import { COLOR, FONT } from '../../../../styles/designTokens'

export default function ProjectCell({ proj, color, count, isCollapsed, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      padding: '8px 10px',
      display: 'flex', alignItems: isCollapsed ? 'center' : 'flex-start', gap: 5,
      borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}`,
      cursor: 'pointer', background: `${color.dot}04`,
    }}>
      <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary, width: 12, textAlign: 'center', transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', flexShrink: 0 }}>▾</span>
      <div style={{ width: 7, height: 7, borderRadius: 2, background: color.dot, flexShrink: 0, marginTop: isCollapsed ? 0 : 2 }} />
      <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary, flex: 1, whiteSpace: 'normal', wordBreak: 'break-word' }}>{proj.name}</span>
      <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{count}건</span>
    </div>
  )
}
```

---

## 6. CREATE: `src/components/views/grid/cells/TaskRow.jsx`

> 기존 `TaskCard` 컴포넌트 그대로 추출. 컴포넌트명만 `TaskCard` → `TaskRow`로 변경 (다른 곳에서 import되지 않으므로 안전).

```jsx
import { useState, useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { COLOR, FONT, CHECKBOX } from '../../../../styles/designTokens'
import { getColor } from '../../../../utils/colors'
import useStore from '../../../../hooks/useStore'

/* ─── Task Card (draggable, click-to-edit) ─── */
export default function TaskRow({ task, project, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, showProject, showMs }) {
  const milestones = useStore(s => s.milestones)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  const [hover, setHover] = useState(false)
  const isEditing = editingId === task.id

  // Find MS title for this task
  const msTitle = useMemo(() => {
    if (!showMs || !task.keyMilestoneId) return null
    return milestones.find(m => m.id === task.keyMilestoneId)?.title
  }, [showMs, task.keyMilestoneId, milestones])

  return (
    <div
      ref={setNodeRef}
      {...(isEditing ? {} : { ...attributes, ...listeners })}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 5, padding: '3px 4px', marginBottom: 1,
        borderRadius: 4, cursor: isEditing ? 'text' : 'grab', transition: 'background 0.08s',
        background: hover && !isEditing ? COLOR.bgHover : 'transparent',
        opacity: isDragging ? 0.3 : 1,
      }}
    >
      {/* Checkbox */}
      <div onClick={e => { e.stopPropagation(); e.preventDefault(); toggleDone(task.id) }} style={{
        width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, flexShrink: 0, cursor: 'pointer', marginTop: 1,
        border: task.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`,
        background: task.done ? CHECKBOX.checkedBg : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {task.done && <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <input
            autoFocus defaultValue={task.text}
            onBlur={e => handleEditFinish(task.id, e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleEditFinish(task.id, e.target.value) }
              if (e.key === 'Escape') setEditingId(null)
            }}
            onMouseDown={e => e.stopPropagation()}
            style={{ width: '100%', fontSize: FONT.body, border: 'none', outline: 'none', background: 'transparent', color: COLOR.textPrimary, fontFamily: 'inherit', padding: 0 }}
          />
        ) : (
          <span
            onClick={e => { e.stopPropagation(); e.preventDefault(); setEditingId(task.id) }}
            style={{
              fontSize: FONT.body, color: task.done ? COLOR.textTertiary : COLOR.textPrimary,
              lineHeight: 1.4, cursor: 'text', display: 'block',
              whiteSpace: 'normal', wordBreak: 'break-word',
              textDecoration: task.done ? 'line-through' : 'none',
            }}
          >{task.text}</span>
        )}
        {/* Meta: project + MS */}
        {(showProject || msTitle) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
            {showProject && project && (
              <>
                <div style={{ width: 5, height: 5, borderRadius: 1, background: getColor(project.color).dot, flexShrink: 0 }} />
                <span style={{ fontSize: FONT.ganttMs, color: COLOR.textTertiary }}>{project.name}</span>
              </>
            )}
            {msTitle && <span style={{ fontSize: FONT.ganttMs, color: COLOR.textTertiary }}>{showProject ? '·' : ''} {msTitle}</span>}
          </div>
        )}
      </div>

      {/* Due date badge */}
      {task.dueDate && !showProject && (
        <span style={{ fontSize: FONT.ganttMs, color: COLOR.textTertiary, flexShrink: 0 }}>{task.dueDate.slice(5)}</span>
      )}

      {/* Detail arrow */}
      {hover && !isEditing && (
        <div onClick={e => { e.stopPropagation(); e.preventDefault(); openDetail(task) }} style={{
          width: 16, height: 16, borderRadius: 3, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', opacity: 0.4,
        }}>
          <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      )}
    </div>
  )
}
```

---

## 7. CREATE: `src/components/views/grid/cells/CellContent.jsx`

> 기존 `MsGroupedTasks` 함수 그대로 추출. 컴포넌트명만 `MsGroupedTasks` → `CellContent`로 변경. `TaskCard` 호출은 `TaskRow`로 대체.

```jsx
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
```

---

## 8. CREATE: `src/components/views/grid/grids/PersonalMatrixGrid.jsx`

```jsx
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
```

> 참고: 원본 line 300, 301의 `milestones`, `userId` 변수는 함수 본문에서 사용되지 않지만 **dead destructure 보존 원칙**에 따라 그대로 유지합니다. Sub-Loop 7-A에서 실제 사용 시 또는 명시적 cleanup 시 정리.

---

## 9. CREATE: `src/components/views/grid/grids/TeamMatrixGrid.jsx`

```jsx
import { COLOR, FONT } from '../../../../styles/designTokens'
import useStore from '../../../../hooks/useStore'
import { getColor } from '../../../../utils/colors'
import InlineAdd from '../../../shared/InlineAdd'
import ProjectCell from '../shared/ProjectCell'
import DroppableCell from '../shared/DroppableCell'
import MiniAvatar from '../shared/MiniAvatar'
import CellContent from '../cells/CellContent'

/* ═══════════════════════════════════════════════════════
   Team Matrix — 행=프로젝트, 열=팀원
   ═══════════════════════════════════════════════════════ */
export default function TeamMatrixGrid({ projects, tasks, members, collapsed, toggleCollapse, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, activeId, currentTeamId }) {
  const milestones = useStore(s => s.milestones)
  if (members.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>팀원 정보를 불러오는 중...</div>
  }

  return (
    <div style={{ border: `1px solid ${COLOR.border}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Grid container */}
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
          const projTasks = tasks.filter(t => t.projectId === proj.id && !t.done && t.teamId === currentTeamId)
          const isCol = collapsed[proj.id]
          return [
            <ProjectCell key={`p-${proj.id}`} proj={proj} color={c} count={projTasks.length} isCollapsed={isCol} onToggle={() => toggleCollapse(proj.id)} />,
            ...members.map(mem => {
              const cellTasks = projTasks.filter(t => t.assigneeId === mem.userId)
                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
              const dropId = `tmat:${proj.id}:${mem.userId}`
              return (
                <DroppableCell key={dropId} id={dropId} activeId={activeId}>
                  <div style={{ padding: '6px 8px', minHeight: 36 }}>
                    {isCol ? (
                      cellTasks.length > 0 ? <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{cellTasks.length}건</span> : null
                    ) : (
                      <>
                        <CellContent tasks={cellTasks} cellMilestones={milestones.filter(m => m.project_id === proj.id && m.owner_id === mem.userId)} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} />
                        <InlineAdd projectId={proj.id} category="today" color={c} extraFields={{ scope: 'assigned', assigneeId: mem.userId }} compact />
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
```

---

## 10. CREATE: `src/components/views/grid/grids/PersonalWeeklyGrid.jsx`

```jsx
import { useMemo } from 'react'
import { COLOR, FONT } from '../../../../styles/designTokens'
import useStore from '../../../../hooks/useStore'
import { getColor } from '../../../../utils/colors'
import { DAY_LABELS, fmtDate } from '../constants'
import DroppableCell from '../shared/DroppableCell'
import CellContent from '../cells/CellContent'

/* ═══════════════════════════════════════════════════════
   Personal Weekly — 행=프로젝트, 열=요일
   ═══════════════════════════════════════════════════════ */
export default function PersonalWeeklyGrid({ projects, myTasks, weekDays, weekDateStrs, todayStr, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, activeId }) {
  const milestones = useStore(s => s.milestones)
  // 이번 주에 할일이 있는 프로젝트만
  const weekTasks = useMemo(() =>
    myTasks.filter(t => {
      if (t.done) return false
      if (t.dueDate && weekDateStrs.includes(t.dueDate)) return true
      if (!t.dueDate && t.category === 'today' && weekDateStrs.includes(todayStr)) return true
      return false
    }),
    [myTasks, weekDateStrs, todayStr]
  )

  const projectsWithTasks = useMemo(() => {
    const ids = new Set(weekTasks.map(t => t.projectId))
    return projects.filter(p => ids.has(p.id))
  }, [projects, weekTasks])

  return (
    <div style={{ border: `1px solid ${COLOR.border}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Grid container */}
      <div style={{ display: 'grid', gridTemplateColumns: '160px repeat(5, 1fr)' }}>
        <div style={{ padding: '8px 10px', fontSize: FONT.caption, fontWeight: 600, color: COLOR.textTertiary, borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}`, background: COLOR.bgSurface }}>프로젝트</div>
        {weekDays.map((d, i) => {
          const ds = fmtDate(d)
          const isToday = ds === todayStr
          return (
            <div key={i} style={{
              padding: '8px 8px', fontSize: FONT.caption, fontWeight: isToday ? 700 : 500,
              color: isToday ? '#E53E3E' : COLOR.textTertiary, textAlign: 'center',
              borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}`,
              background: isToday ? 'rgba(229,62,62,0.04)' : COLOR.bgSurface,
            }}>
              {DAY_LABELS[i]} {d.getMonth() + 1}/{d.getDate()}
              {isToday && <span style={{ fontSize: FONT.ganttMs, marginLeft: 3 }}>오늘</span>}
            </div>
          )
        })}
        {projectsWithTasks.map(proj => {
          const c = getColor(proj.color)
          return [
            <div key={`p-${proj.id}`} style={{ padding: '8px 10px', display: 'flex', alignItems: 'flex-start', gap: 5, borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}` }}>
              <div style={{ width: 7, height: 7, borderRadius: 2, background: c.dot, flexShrink: 0, marginTop: 3 }} />
              <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary, whiteSpace: 'normal', wordBreak: 'break-word' }}>{proj.name}</span>
            </div>,
            ...weekDays.map((d, di) => {
              const ds = fmtDate(d)
              const isToday = ds === todayStr
              const dayTasks = weekTasks.filter(t => {
                if (t.projectId !== proj.id) return false
                if (t.dueDate === ds) return true
                if (!t.dueDate && t.category === 'today' && ds === todayStr) return true
                return false
              })
              const dropId = `pw:${proj.id}:${ds}`
              return (
                <DroppableCell key={dropId} id={dropId} activeId={activeId}>
                  <div style={{
                    padding: '5px 6px', minHeight: 40,
                    background: isToday ? 'rgba(229,62,62,0.02)' : 'transparent',
                  }}>
                    <CellContent tasks={dayTasks} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} />
                    {dayTasks.length === 0 && <span style={{ fontSize: FONT.tiny, color: '#e0e0e0', display: 'block', textAlign: 'center', padding: '8px 0' }}>—</span>}
                  </div>
                </DroppableCell>
              )
            })
          ]
        })}
      </div>

      {projectsWithTasks.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>이번 주 예정된 할일이 없습니다</div>
      )}
    </div>
  )
}
```

---

## 11. CREATE: `src/components/views/grid/grids/TeamWeeklyGrid.jsx`

```jsx
import { useMemo } from 'react'
import { COLOR, FONT } from '../../../../styles/designTokens'
import { DAY_LABELS, fmtDate } from '../constants'
import DroppableCell from '../shared/DroppableCell'
import MiniAvatar from '../shared/MiniAvatar'
import CellContent from '../cells/CellContent'

/* ═══════════════════════════════════════════════════════
   Team Weekly — 행=팀원, 열=요일
   ═══════════════════════════════════════════════════════ */
export default function TeamWeeklyGrid({ projects, tasks, members, weekDays, weekDateStrs, todayStr, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, activeId, currentTeamId }) {
  if (members.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>팀원 정보를 불러오는 중...</div>
  }

  const projectMap = useMemo(() => {
    const m = {}; projects.forEach(p => { m[p.id] = p }); return m
  }, [projects])

  return (
    <div style={{ border: `1px solid ${COLOR.border}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Grid container */}
      <div style={{ display: 'grid', gridTemplateColumns: '160px repeat(5, 1fr)' }}>
        <div style={{ padding: '8px 10px', fontSize: FONT.caption, fontWeight: 600, color: COLOR.textTertiary, borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}`, background: COLOR.bgSurface }}>팀원</div>
        {weekDays.map((d, i) => {
          const ds = fmtDate(d)
          const isToday = ds === todayStr
          return (
            <div key={i} style={{
              padding: '8px 8px', fontSize: FONT.caption, fontWeight: isToday ? 700 : 500,
              color: isToday ? '#E53E3E' : COLOR.textTertiary, textAlign: 'center',
              borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}`,
              background: isToday ? 'rgba(229,62,62,0.04)' : COLOR.bgSurface,
            }}>
              {DAY_LABELS[i]} {d.getMonth() + 1}/{d.getDate()}
              {isToday && <span style={{ fontSize: FONT.ganttMs, marginLeft: 3 }}>오늘</span>}
            </div>
          )
        })}
        {members.map(mem => [
          <div key={`m-${mem.id}`} style={{ padding: '8px 10px', display: 'flex', alignItems: 'flex-start', gap: 8, borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}` }}>
            <MiniAvatar name={mem.displayName || mem.name} size={24} />
            <span style={{ fontSize: FONT.body, fontWeight: 600, color: COLOR.textPrimary }}>{mem.displayName || mem.name}</span>
          </div>,
          ...weekDays.map((d, di) => {
            const ds = fmtDate(d)
            const isToday = ds === todayStr
            const dayTasks = tasks.filter(t => {
              if (t.done || t.assigneeId !== mem.userId || t.teamId !== currentTeamId) return false
              if (t.dueDate === ds) return true
              if (!t.dueDate && t.category === 'today' && ds === todayStr) return true
              return false
            }).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
            const dropId = `tw:${mem.userId}:${ds}`
            return (
              <DroppableCell key={dropId} id={dropId} activeId={activeId}>
                <div style={{
                  padding: '5px 6px', minHeight: 48,
                  background: isToday ? 'rgba(229,62,62,0.02)' : 'transparent',
                }}>
                  <CellContent tasks={dayTasks} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject projectMap={projectMap} />
                  {dayTasks.length === 0 && <span style={{ fontSize: FONT.tiny, color: '#e0e0e0', display: 'block', textAlign: 'center', padding: '8px 0' }}>—</span>}
                </div>
              </DroppableCell>
            )
          })
        ])}
      </div>
    </div>
  )
}
```

---

## 12. REPLACE: `src/components/views/UnifiedGridView.jsx`

기존 800줄 파일을 아래 내용으로 **완전 교체**.

```bash
# 적용 방법: 기존 파일 삭제 후 새 파일 작성
# (str_replace로는 800줄 전체 교체가 비효율)
```

기존 파일 삭제 후 동일 경로에 새 파일 생성:

```jsx
import { useState, useMemo, useCallback, useEffect } from 'react'
import { COLOR, FONT, SPACE, VIEW_WIDTH, CHECKBOX } from '../../styles/designTokens'
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import useStore, { getCachedUserId } from '../../hooks/useStore'
import useTeamMembers from '../../hooks/useTeamMembers'
import useProjectFilter from '../../hooks/useProjectFilter'
import MsBacklogSidebar from '../common/MsBacklogSidebar'

import { EMPTY_OBJ, getMonday, fmtDate, getWeekNumber } from './grid/constants'
import Pill from './grid/shared/Pill'
import PersonalMatrixGrid from './grid/grids/PersonalMatrixGrid'
import TeamMatrixGrid from './grid/grids/TeamMatrixGrid'
import PersonalWeeklyGrid from './grid/grids/PersonalWeeklyGrid'
import TeamWeeklyGrid from './grid/grids/TeamWeeklyGrid'

/* ═══════════════════════════════════════════════════════
   UnifiedGridView — 매트릭스 + 주간 플래너 통합 (Orchestrator)
   [매트릭스|주간 플래너] × [팀|개인] = 4가지 모드
   
   개인 매트릭스: 행=프로젝트, 열=카테고리(지금/다음/나중)
   팀 매트릭스:   행=프로젝트, 열=팀원
   개인 주간:     행=프로젝트, 열=요일
   팀 주간:       행=팀원,     열=요일
   
   Sub-grid 컴포넌트는 ./grid/grids/* 참조
   Cell 컴포넌트는 ./grid/cells/* 참조
   ═══════════════════════════════════════════════════════ */

export default function UnifiedGridView({ initialView = 'matrix', initialScope = 'personal' }) {
  const [view, setView] = useState(initialView) // 'matrix' | 'weekly'
  const [scope, setScope] = useState(initialScope) // 'team' | 'personal'

  // ─── Store ───
  const { projects, tasks, updateTask, moveTaskTo, reorderTasks, toggleDone, openDetail, addTask, sortProjectsLocally, updateMilestone } = useStore()
  const currentTeamId = useStore(s => s.currentTeamId)
  const milestones = useStore(s => s.milestones)
  const userId = getCachedUserId()
  const isMobile = window.innerWidth < 768
  const collapseKey = scope === 'team' ? 'matrix' : 'personalMatrix'
  const collapseState = useStore(s => s.collapseState)
  const collapsed = collapseState[collapseKey] || EMPTY_OBJ
  const toggleCollapse = useStore(s => s.toggleCollapse)
  const toggleProjectCollapse = useCallback((pid) => toggleCollapse(collapseKey, pid), [collapseKey, toggleCollapse])

  // ─── Team members ───
  const [members, setMembers] = useState([])
  useEffect(() => {
    if (!currentTeamId) return
    let cancelled = false
    useTeamMembers.getMembers(currentTeamId).then(m => { if (!cancelled) setMembers(m) })
    return () => { cancelled = true }
  }, [currentTeamId])

  // ─── Week navigation ───
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const weekDays = useMemo(() => [0, 1, 2, 3, 4].map(i => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d
  }), [weekStart])
  const weekDateStrs = useMemo(() => weekDays.map(fmtDate), [weekDays])
  const todayStr = fmtDate(new Date())
  const prevWeek = () => setWeekStart(p => { const d = new Date(p); d.setDate(d.getDate() - 7); return d })
  const nextWeek = () => setWeekStart(p => { const d = new Date(p); d.setDate(d.getDate() + 7); return d })
  const goThisWeek = () => setWeekStart(getMonday(new Date()))

  // ─── Project filter ───
  const { filteredProjects, filteredTasks } = useProjectFilter(projects, tasks)
  const displayProjects = useMemo(() => {
    if (scope === 'team') {
      return currentTeamId ? filteredProjects.filter(p => p.teamId === currentTeamId) : []
    }
    // Personal: 아카이브 제외된 프로젝트 중 내 할일이 있는 것만
    const myTasks = tasks.filter(t => t.assigneeId === userId)
    const projIds = new Set(myTasks.map(t => t.projectId))
    return sortProjectsLocally(filteredProjects).filter(p => projIds.has(p.id))
  }, [scope, currentTeamId, filteredProjects, tasks, userId, projects, sortProjectsLocally])

  const myTasks = useMemo(() => {
    if (scope === 'personal') return tasks.filter(t => t.assigneeId === userId)
    return filteredTasks
  }, [scope, tasks, filteredTasks, userId])

  // ─── Inline edit ───
  const [editingId, setEditingId] = useState(null)
  const handleEditFinish = useCallback((taskId, newText) => {
    setEditingId(null)
    if (newText && newText.trim()) updateTask(taskId, { text: newText.trim() })
  }, [updateTask])

  // ─── DnD ───
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)
  const [activeId, setActiveId] = useState(null)
  const activeItem = useMemo(() => {
    if (!activeId) return null
    const id = String(activeId)
    if (id.startsWith('bl-ms:')) {
      const ms = milestones.find(m => m.id === id.slice(6))
      return ms ? { type: 'ms', data: ms } : null
    }
    const taskId = id.startsWith('bl-task:') ? id.slice(8) : id
    const task = tasks.find(t => t.id === taskId)
    return task ? { type: 'task', data: task } : null
  }, [activeId, tasks, milestones])

  const handleDragStart = (e) => setActiveId(e.active.id)

  const handleDragEnd = useCallback((e) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const activeIdStr = String(active.id)
    const overId = String(over.id)

    // Parse drop zone ID → extract patch
    // Format: "mat:projId:category" | "tmat:projId:memberId" | "pw:projId:dateStr" | "tw:memberId:dateStr"
    const parts = overId.split(':')
    if (parts.length < 3) return
    const mode = parts[0]

    // ─── Backlog MS drop → owner 배정 ───
    if (activeIdStr.startsWith('bl-ms:')) {
      const msId = activeIdStr.slice(6)
      if (mode === 'tmat') {
        const [, , targetMemberId] = parts
        updateMilestone(msId, { owner_id: targetMemberId })
      }
      // mat/pw/tw에는 MS 드롭 미적용
      return
    }

    // ─── Task drop (그리드 내부 or 백로그) ───
    const taskId = activeIdStr.startsWith('bl-task:') ? activeIdStr.slice(8) : activeIdStr
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    if (mode === 'mat') {
      // Personal matrix: project + category
      const [, targetProjId, targetCat] = parts
      if (task.projectId === targetProjId && task.category === targetCat) return
      moveTaskTo(taskId, targetProjId, targetCat)
    } else if (mode === 'tmat') {
      // Team matrix: project + assignee
      const [, targetProjId, targetMemberId] = parts
      if (task.projectId === targetProjId && task.assigneeId === targetMemberId) return
      updateTask(taskId, { projectId: targetProjId, assigneeId: targetMemberId, scope: 'assigned' })
    } else if (mode === 'pw') {
      // Personal weekly: project + date
      const [, , targetDate] = parts
      if (task.dueDate === targetDate) return
      updateTask(taskId, { dueDate: targetDate })
    } else if (mode === 'tw') {
      // Team weekly: member + date
      const [, targetMemberId, targetDate] = parts
      if (task.assigneeId === targetMemberId && task.dueDate === targetDate) return
      updateTask(taskId, { assigneeId: targetMemberId, dueDate: targetDate, scope: 'assigned' })
    }
  }, [tasks, moveTaskTo, updateTask, updateMilestone])

  // ─── Date strings ───
  const today = new Date()
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 ${['일', '월', '화', '수', '목', '금', '토'][today.getDay()]}요일`
  const weekNum = getWeekNumber(weekStart)
  const weekRange = `${weekStart.getFullYear()}.${String(weekStart.getMonth() + 1).padStart(2, '0')}.${String(weekStart.getDate()).padStart(2, '0')} ~ ${String(weekDays[4].getMonth() + 1).padStart(2, '0')}.${String(weekDays[4].getDate()).padStart(2, '0')} (${weekNum}주차)`

  // ─── Title ───
  const title = scope === 'team'
    ? (view === 'matrix' ? '팀 매트릭스' : '팀 주간 플래너')
    : (view === 'matrix' ? '개인 매트릭스' : '개인 주간 플래너')

  // ─── Guard ───
  if (scope === 'team' && !currentTeamId) {
    return <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>팀을 선택하세요.</div>
  }
  if (scope === 'team' && view !== 'matrix' && members.length === 0) {
    // Team weekly needs members; matrix can wait for members too
  }

  return (
    <div data-view="unified-grid" style={{ padding: isMobile ? SPACE.viewPaddingMobile : SPACE.viewPadding, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: VIEW_WIDTH.wide, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* ═══ Header ═══ */}
        <div style={{ marginBottom: 16, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: FONT.viewTitle, fontWeight: 700, color: COLOR.textPrimary, margin: 0, letterSpacing: '-0.02em' }}>{title}</h1>
            <div style={{ flex: 1 }} />
            <Pill items={[{ k: 'matrix', l: '매트릭스' }, { k: 'weekly', l: '주간 플래너' }]} active={view} onChange={setView} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: FONT.subtitle, color: COLOR.textTertiary }}>{view === 'matrix' ? dateStr : weekRange}</span>
            <div style={{ flex: 1 }} />
            <Pill items={[{ k: 'team', l: '팀' }, { k: 'personal', l: '개인' }]} active={scope} onChange={setScope} />
            {view === 'weekly' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
                <button onClick={prevWeek} style={{ border: `1px solid ${COLOR.border}`, background: '#fff', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: FONT.label, color: COLOR.textSecondary, fontFamily: 'inherit' }}>◀</button>
                <button onClick={goThisWeek} style={{ border: `1px solid ${COLOR.border}`, background: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: FONT.caption, color: COLOR.textSecondary, fontFamily: 'inherit' }}>이번 주</button>
                <button onClick={nextWeek} style={{ border: `1px solid ${COLOR.border}`, background: '#fff', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: FONT.label, color: COLOR.textSecondary, fontFamily: 'inherit' }}>▶</button>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Grid + Sidebar ═══ */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {view === 'matrix' && scope === 'personal' && (
                <PersonalMatrixGrid
                  projects={displayProjects} myTasks={myTasks}
                  collapsed={collapsed} toggleCollapse={toggleProjectCollapse}
                  editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                  toggleDone={toggleDone} openDetail={openDetail} activeId={activeId}
                />
              )}
              {view === 'matrix' && scope === 'team' && (
                <TeamMatrixGrid
                  projects={displayProjects} tasks={filteredTasks} members={members}
                  collapsed={collapsed} toggleCollapse={toggleProjectCollapse}
                  editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                  toggleDone={toggleDone} openDetail={openDetail} activeId={activeId}
                  currentTeamId={currentTeamId}
                />
              )}
              {view === 'weekly' && scope === 'personal' && (
                <PersonalWeeklyGrid
                  projects={displayProjects} myTasks={myTasks}
                  weekDays={weekDays} weekDateStrs={weekDateStrs} todayStr={todayStr}
                  editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                  toggleDone={toggleDone} openDetail={openDetail} activeId={activeId}
                />
              )}
              {view === 'weekly' && scope === 'team' && (
                <TeamWeeklyGrid
                  projects={projects} tasks={filteredTasks} members={members}
                  weekDays={weekDays} weekDateStrs={weekDateStrs} todayStr={todayStr}
                  editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                  toggleDone={toggleDone} openDetail={openDetail} activeId={activeId}
                  currentTeamId={currentTeamId}
                />
              )}
            </div>

            {/* Sidebar — DndContext 안에 위치해야 dnd-kit DnD 통신 가능 */}
            <MsBacklogSidebar projects={displayProjects} milestones={milestones} tasks={tasks} weekDateStrs={view === 'weekly' ? weekDateStrs : null} />

            <DragOverlay dropAnimation={null}>
              {activeItem?.type === 'task' ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                  background: '#fff', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  border: '1px solid rgba(0,0,0,0.06)', transform: 'rotate(2deg)', cursor: 'grabbing', maxWidth: 240,
                }}>
                  <div style={{ width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, border: `1.5px solid ${CHECKBOX.borderColor}`, flexShrink: 0 }} />
                  <span style={{ fontSize: FONT.body, color: COLOR.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeItem.data.text}</span>
                </div>
              ) : activeItem?.type === 'ms' ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                  background: '#fff', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  border: '1px solid rgba(0,0,0,0.06)', transform: 'rotate(2deg)', cursor: 'grabbing', maxWidth: 240,
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: COLOR.textTertiary, flexShrink: 0 }} />
                  <span style={{ fontSize: FONT.body, fontWeight: 500, color: COLOR.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeItem.data.title || '(제목 없음)'}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  )
}

/* ─── Styles ─── */
// navBtnStyle is inline to avoid TDZ in Vite production builds
// (module-level const referencing imported COLOR causes 'Cannot access R before initialization')
```

---

## 적용 순서 (Claude Code 작업 단계)

```bash
# 1. 신규 디렉토리 생성
mkdir -p src/components/views/grid/grids
mkdir -p src/components/views/grid/cells
mkdir -p src/components/views/grid/shared

# 2. 12개 신규 파일 작성 (위 1~11 + 새 UnifiedGridView)
#    Claude Code는 각 섹션의 코드 블록을 순서대로 create_file

# 3. 기존 UnifiedGridView.jsx 삭제 후 새 내용으로 재작성
#    (str_replace로 800줄 전체 교체는 비효율 → 삭제 후 create_file 권장)
```

---

## DELETE-5 검증 결과

| 삭제/이동 대상 | ① import | ② caller | ③ props | ④ deps | ⑤ types | 처리 |
|---|---|---|---|---|---|---|
| `MsGroupedTasks` (UnifiedGridView 내부 함수) | UnifiedGridView 내부 정의 | UnifiedGridView 내 4곳 (각 grid의 cell 렌더) | 동일 시그니처로 `CellContent` 이동 | useStore.milestones, openModal, useMemo | — | `cells/CellContent.jsx`로 이동, prop 동일 |
| `TaskCard` (UnifiedGridView 내부 함수) | 내부 정의 | `MsGroupedTasks` 내부에서 호출 | 동일 시그니처 | useStore, useDraggable, useState, useMemo, getColor, CHECKBOX, COLOR, FONT | — | `cells/TaskRow.jsx`로 이동 (이름 변경), `CellContent`에서 import |
| `Pill` (UnifiedGridView 내부 함수) | 내부 정의 | UnifiedGridView 헤더 2곳 | 동일 | COLOR, FONT | — | `shared/Pill.jsx`로 이동, orchestrator에서 import |
| `MiniAvatar` | 내부 정의 | TeamMatrixGrid, TeamWeeklyGrid | 동일 | — | — | `shared/MiniAvatar.jsx`로 이동, 두 grid에서 import |
| `DroppableCell` | 내부 정의 | 4개 grid 모두 | 동일 | useDroppable, COLOR | — | `shared/DroppableCell.jsx`로 이동 |
| `ProjectCell` | 내부 정의 | PersonalMatrixGrid, TeamMatrixGrid | 동일 | COLOR, FONT | — | `shared/ProjectCell.jsx`로 이동 |
| `PersonalMatrixGrid`, `TeamMatrixGrid`, `PersonalWeeklyGrid`, `TeamWeeklyGrid` (4개 grid 함수) | 내부 정의 | UnifiedGridView render | 동일 | 각자 사용하는 store/util/cell 컴포넌트 | — | `grids/*Grid.jsx` 4개 파일로 이동 |
| `CATS`, `DAY_LABELS`, `EMPTY_OBJ` (모듈 상수) | UnifiedGridView 내부 | 4 grid + UnifiedGridView | — | — | — | `constants.js`로 이동, 필요한 곳에서 import |
| `getMonday`, `fmtDate`, `getWeekNumber` (모듈 헬퍼) | UnifiedGridView 내부 | UnifiedGridView, PersonalWeeklyGrid, TeamWeeklyGrid | — | — | — | `constants.js`로 이동 |
| 외부 `UnifiedGridView` import 참조 | App.jsx만 (default import) | — | — | — | — | App.jsx 변경 불필요 (default export 유지) |

### 잔여 import 검증
- [x] 신규 12개 파일 모두 사용하는 식별자만 import (unused import 0건)
- [x] 새 UnifiedGridView.jsx의 destructure는 원본과 동일 (`addTask`, `reorderTasks` 포함 — dead 보존)
- [x] 모든 imported token (`COLOR`, `FONT` 등)은 컴포넌트 함수 내부에서만 참조 — Vite TDZ 위반 0건

### 동작 동등성 검증
- [x] PersonalMatrixGrid, TeamMatrixGrid, PersonalWeeklyGrid, TeamWeeklyGrid의 prop 시그니처 100% 동일
- [x] CellContent는 MsGroupedTasks의 prop 시그니처 100% 동일 (`tasks: cellTasks` 구조분해 alias 포함)
- [x] TaskRow는 TaskCard의 prop 시그니처 100% 동일
- [x] DragOverlay 렌더 로직 그대로 유지
- [x] handleDragEnd 로직 그대로 유지
- [x] scope toggle Pill 그대로 유지 (Loop 6 의존성 없음)

---

## REQ-LOCK 검증

| # | 요구사항 | 적용 위치 | 확인 |
|---|---|---|---|
| 1 | 동작 100% 동일 | 모든 컴포넌트 prop 시그니처 + render 출력 보존 | ✓ |
| 2 | Vite TDZ 0건 | 12개 파일 모두 token 참조는 함수 내부 inline JSX | ✓ |
| 3 | scope toggle 보존 | 새 UnifiedGridView §12 line `const [scope, setScope]...` + Pill 렌더 | ✓ |
| 4 | dead destructure 보존 | UnifiedGridView destructure에 `addTask`, `reorderTasks` 유지 | ✓ |
| 5 | DELETE-5 cascade | 위 표 | ✓ |

---

## 빌드 검증 명령

```bash
# 1. 신규 디렉토리 + 파일 존재 확인
ls src/components/views/grid/constants.js \
   src/components/views/grid/shared/Pill.jsx \
   src/components/views/grid/shared/MiniAvatar.jsx \
   src/components/views/grid/shared/DroppableCell.jsx \
   src/components/views/grid/shared/ProjectCell.jsx \
   src/components/views/grid/cells/TaskRow.jsx \
   src/components/views/grid/cells/CellContent.jsx \
   src/components/views/grid/grids/PersonalMatrixGrid.jsx \
   src/components/views/grid/grids/TeamMatrixGrid.jsx \
   src/components/views/grid/grids/PersonalWeeklyGrid.jsx \
   src/components/views/grid/grids/TeamWeeklyGrid.jsx \
   src/components/views/UnifiedGridView.jsx

# 2. UnifiedGridView 줄 수 검증 (대폭 축소되었는지)
wc -l src/components/views/UnifiedGridView.jsx
# 예상: ~290줄 (기존 800줄 → orchestrator만 남음)

# 3. 빌드
npm run build

# 4. 잔존 참조 grep — 모두 0건이어야 함
# 새 분리된 컴포넌트가 옛 이름으로 어디서 참조되면 안 됨
grep -rn "MsGroupedTasks\|function TaskCard" src/ --include="*.jsx" --include="*.js"

# 5. 옛 모듈-레벨 정의 잔존 확인 (UnifiedGridView 안에 남아있으면 안 됨)
grep -n "function PersonalMatrixGrid\|function TeamMatrixGrid\|function PersonalWeeklyGrid\|function TeamWeeklyGrid\|function ProjectCell\|function MsGroupedTasks\|function DroppableCell\|function TaskCard\|function Pill\|function MiniAvatar" src/components/views/UnifiedGridView.jsx
# 예상: 0건

# 6. 런타임 검증
# - 개인 매트릭스 진입 → 정상 렌더
# - 팀 매트릭스 진입 → 정상 렌더
# - 개인 주간 → 정상 렌더
# - 팀 주간 → 정상 렌더
# - 매트릭스/주간 토글 → 정상
# - 팀/개인 토글 → 정상
# - task 셀 간 DnD → 정상
# - 백로그 → 셀 DnD → 정상
# - task 인라인 편집 → 정상
# - task 체크 → 정상
# - 백로그 사이드바 → 정상
```

---

## 커밋 메시지

```
refactor(grid): split UnifiedGridView monolith into modular structure (Sub-Loop 7-0)

- Create grid/ subtree under views/ with constants/grids/cells/shared
- Extract PersonalMatrixGrid, TeamMatrixGrid, PersonalWeeklyGrid, TeamWeeklyGrid to grids/
- Extract MsGroupedTasks → CellContent, TaskCard → TaskRow to cells/
- Extract Pill, MiniAvatar, DroppableCell, ProjectCell to shared/
- Move CATS/DAY_LABELS/EMPTY_OBJ + getMonday/fmtDate/getWeekNumber to constants.js
- UnifiedGridView.jsx slimmed from 800 → ~290 lines (orchestrator only)
- 100% behavior preserved: same props, same render output, scope toggle intact
- No Vite TDZ violations: all token refs inline inside component bodies
- Foundation for Sub-Loop 7-A through 7-E (matrix MS interactivity)
```
