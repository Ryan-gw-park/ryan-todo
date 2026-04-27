# Sub-Loop 7-A: MilestoneRow 풀세트 + 개인 매트릭스 빈 MS 표시

## 목표
매트릭스 셀 내 MS 행을 인터랙티브 컴포넌트(`MilestoneRow`)로 교체하여 5가지 기능 추가:
1. MS 제목 인라인 편집
2. MS breadcrumb (`L1 > L2 > current`) 표시
3. MS 접기/펼치기 (matrixMs collapse 그룹)
4. MS 행 hover → `+` 즉시 task 추가 + 자동 인라인 편집
5. MS 행 hover → `⋮` 삭제 (기존 confirmDialog 패턴 재사용)

추가 요구사항:
6. **개인 매트릭스의 "지금" 컬럼**에 빈 MS 표시 (#7)

> MS 추가(요구사항 #2)는 7-C로 분리. 7-A는 기존 MS 행을 풍부하게 만드는 데 집중.

---

## REQ-LOCK 요구사항

1. MS 인라인 편집 — `editingMsId` 별도 state, task 편집(`editingId`)과 namespace 충돌 없음
2. breadcrumb은 `getMsPath(msId, milestones)` 재사용 — 신규 hook 불필요
3. MS 접기 상태는 `collapseState['matrixMs']`에 저장 — localStorage 자동 영속화
4. MS `+` 클릭 시 빈 task 즉시 생성 + 자동 인라인 편집 모드 진입 (자동 포커스)
5. MS `⋮` 삭제는 `openConfirmDialog` 재사용 — 7-A에서 신규 모달 도입 안 함
6. 개인 매트릭스 빈 MS 표시 조건: `project_id === proj.id && owner_id === userId`, **today 카테고리 셀에만**
7. MilestoneRow는 `interactive` prop으로 매트릭스/주간 분기 — 주간 셀에서는 read-only(현재와 동일)
8. Vite TDZ 위반 0건 — 모든 token 참조는 컴포넌트 함수 내부 inline
9. 기존 task 편집/체크/DnD/InlineAdd 동작은 변경 없음
10. weekly grids 렌더 출력 동등성 100%

---

## 영향 파일

| # | 파일 | 종류 | 변경 요약 |
|---|---|---|---|
| 1 | `src/hooks/useStore.js` | EDIT | `addTask` return `t` (1줄), `_defaultCollapseState`에 `matrixMs: {}` 추가 (1줄) |
| 2 | `src/components/views/grid/cells/MilestoneRow.jsx` | **CREATE** | 신규 — 인터랙티브 MS 행 컴포넌트 |
| 3 | `src/components/views/grid/cells/CellContent.jsx` | EDIT | 인라인 MS 헤더 → `<MilestoneRow>`, 신규 props 9개 추가, collapsed 시 task 숨김 |
| 4 | `src/components/views/grid/grids/PersonalMatrixGrid.jsx` | EDIT | `cellMilestones`를 today 셀에만 전달, `addTask` import, 셀별 `onMsAddTask` 클로저, MS 인터랙티브 props 전달 |
| 5 | `src/components/views/grid/grids/TeamMatrixGrid.jsx` | EDIT | 셀별 `onMsAddTask` 클로저, MS 인터랙티브 props 전달 |
| 6 | `src/components/views/grid/grids/PersonalWeeklyGrid.jsx` | EDIT | `matrixMsInteractive={false}` prop만 추가 (방어적), 또는 변경 없음 |
| 7 | `src/components/views/grid/grids/TeamWeeklyGrid.jsx` | EDIT | 위와 동일 |
| 8 | `src/components/views/UnifiedGridView.jsx` | EDIT | `editingMsId` state, `handleMsEditFinish`, `handleMsDelete`, `matrixMsCollapsed`, `toggleMatrixMsCollapse` 추가, 두 매트릭스 grid에 prop drilling |

---

## 1. EDIT: `src/hooks/useStore.js`

### 1-1. addTask가 task 객체 반환하도록 수정 (auto inline edit를 위해)

addTask 함수 끝부분:
```js
// OLD
    const { error } = await safeUpsertTask(d, t)
    if (error) console.error('[Ryan Todo] addTask:', error)
    set({ syncStatus: error ? 'error' : 'ok' })
    if (!error) get().showToast('추가됐습니다 ✓')
  },
```
```js
// NEW
    const { error } = await safeUpsertTask(d, t)
    if (error) console.error('[Ryan Todo] addTask:', error)
    set({ syncStatus: error ? 'error' : 'ok' })
    if (!error) get().showToast('추가됐습니다 ✓')
    return t
  },
```

> 비-호환성 0건. 기존 호출자 모두 return value를 캡처하지 않음 (`addTask({...})` 또는 `await addTask({...})` 형태).

### 1-2. _defaultCollapseState에 matrixMs 추가

```js
// OLD
const _defaultCollapseState = {
  today: {},          // projectId → boolean
  allTasks: {},       // projectId → boolean (모바일 모든 할일 뷰)
  matrix: {},         // projectId → boolean
  matrixDone: {},     // projectId → boolean
  timeline: {},       // projectId → boolean
  projectExpanded: {},// taskId → boolean (false = collapsed)
  projectSection: {}, // "projectId:catKey" → boolean (true = collapsed)
  projectAllTop: {},  // taskId → boolean
  memo: {},           // memoId → boolean (true = body collapsed)
  memoAllTop: {},     // memoId → boolean
  detailAllTop: {},   // taskId → boolean
}
```
```js
// NEW
const _defaultCollapseState = {
  today: {},          // projectId → boolean
  allTasks: {},       // projectId → boolean (모바일 모든 할일 뷰)
  matrix: {},         // projectId → boolean
  matrixDone: {},     // projectId → boolean
  matrixMs: {},       // msId → boolean (true = MS 접힘, 매트릭스 셀 내)
  timeline: {},       // projectId → boolean
  projectExpanded: {},// taskId → boolean (false = collapsed)
  projectSection: {}, // "projectId:catKey" → boolean (true = collapsed)
  projectAllTop: {},  // taskId → boolean
  memo: {},           // memoId → boolean (true = body collapsed)
  memoAllTop: {},     // memoId → boolean
  detailAllTop: {},   // taskId → boolean
}
```

---

## 2. CREATE: `src/components/views/grid/cells/MilestoneRow.jsx`

```jsx
import { useState } from 'react'
import { COLOR } from '../../../../styles/designTokens'

/* ─── Milestone Row — 매트릭스 셀 내 MS 헤더 (인터랙티브) ─── */
/*
 * 비-인터랙티브 모드 (interactive=false): 토글 + 제목 + count + › 만 노출 (주간 플래너용)
 * 인터랙티브 모드 (interactive=true): + ⋮ 추가, 제목 인라인 편집 가능
 */
export default function MilestoneRow({
  ms,
  taskCount,
  collapsed,
  onToggleCollapse,
  isEditing,
  onStartEdit,
  onFinishEdit,
  onCancelEdit,
  onAddTask,
  onDelete,
  onOpenDetail,
  breadcrumb,
  interactive = false,
}) {
  const [hover, setHover] = useState(false)

  const showHoverButtons = interactive && hover && !isEditing

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 2px 2px', marginBottom: 1,
        background: hover && interactive ? COLOR.bgHover : 'transparent',
        borderRadius: 3,
        position: 'relative',
      }}
    >
      {/* Toggle chevron */}
      <span
        onClick={e => { e.stopPropagation(); onToggleCollapse && onToggleCollapse() }}
        style={{
          fontSize: 9, color: COLOR.textTertiary, width: 10,
          cursor: onToggleCollapse ? 'pointer' : 'default',
          display: 'inline-block', textAlign: 'center',
          transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)',
          transition: 'transform 0.12s', flexShrink: 0,
        }}
      >▾</span>

      {/* Bullet */}
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.textTertiary, flexShrink: 0 }} />

      {/* Title area (breadcrumb + title) */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {breadcrumb && !isEditing && (
          <span style={{ fontSize: 9, color: COLOR.textTertiary, marginRight: 3 }}>
            {breadcrumb} ›
          </span>
        )}
        {isEditing ? (
          <input
            autoFocus
            defaultValue={ms.title || ''}
            onBlur={e => onFinishEdit && onFinishEdit(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); onFinishEdit && onFinishEdit(e.target.value) }
              if (e.key === 'Escape') { onCancelEdit && onCancelEdit() }
            }}
            onMouseDown={e => e.stopPropagation()}
            style={{
              fontSize: 11, fontWeight: 600,
              border: `1px solid ${COLOR.border}`, borderRadius: 3,
              outline: 'none', background: '#fff',
              color: COLOR.textPrimary, fontFamily: 'inherit',
              padding: '0 4px', width: '100%', boxSizing: 'border-box',
            }}
          />
        ) : (
          <span
            onClick={e => {
              if (!interactive) return
              e.stopPropagation()
              onStartEdit && onStartEdit()
            }}
            style={{
              fontSize: 11, fontWeight: 600, color: COLOR.textSecondary,
              cursor: interactive ? 'text' : 'default',
              whiteSpace: 'normal', wordBreak: 'break-word',
            }}
          >{ms.title || '(제목 없음)'}</span>
        )}
      </div>

      {/* Task count */}
      {!isEditing && (
        <span style={{ fontSize: 9, color: COLOR.textTertiary, flexShrink: 0 }}>
          {taskCount > 0 ? taskCount : ''}
        </span>
      )}

      {/* Hover-only action buttons (interactive only) */}
      {showHoverButtons && onAddTask && (
        <span
          title="할일 추가"
          onClick={e => { e.stopPropagation(); onAddTask() }}
          style={{
            fontSize: 13, color: COLOR.textTertiary, cursor: 'pointer',
            flexShrink: 0, padding: '0 3px', lineHeight: 1, fontWeight: 400,
          }}
          onMouseEnter={e => e.currentTarget.style.color = COLOR.textPrimary}
          onMouseLeave={e => e.currentTarget.style.color = COLOR.textTertiary}
        >+</span>
      )}
      {showHoverButtons && onDelete && (
        <span
          title="삭제"
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{
            fontSize: 12, color: COLOR.textTertiary, cursor: 'pointer',
            flexShrink: 0, padding: '0 3px', lineHeight: 1,
          }}
          onMouseEnter={e => e.currentTarget.style.color = COLOR.danger}
          onMouseLeave={e => e.currentTarget.style.color = COLOR.textTertiary}
        >⋮</span>
      )}

      {/* Detail arrow (always visible) */}
      {!isEditing && onOpenDetail && (
        <span
          onClick={e => { e.stopPropagation(); onOpenDetail() }}
          style={{
            fontSize: 11, color: COLOR.textTertiary, cursor: 'pointer',
            flexShrink: 0, padding: '0 2px', lineHeight: 1,
          }}
          onMouseEnter={e => e.currentTarget.style.color = COLOR.textPrimary}
          onMouseLeave={e => e.currentTarget.style.color = COLOR.textTertiary}
        >›</span>
      )}
    </div>
  )
}
```

---

## 3. EDIT: `src/components/views/grid/cells/CellContent.jsx`

기존 인라인 MS 헤더 div를 `<MilestoneRow>` 컴포넌트 호출로 교체. 신규 props를 추가 받아서 MilestoneRow에 전달. collapsed 시 하위 task 숨김.

**전체 파일을 아래 내용으로 교체:**

```jsx
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
```

**주요 변경**:
- `import MilestoneRow` 추가 + `import { getMsPath }` 추가
- props 9개 추가 (모두 optional, 주간 플래너 호출 시 undefined → 인터랙티브 비활성화)
- `result.push({ msId, msTitle: ms?.title })` → `result.push({ msId, ms })` (전체 ms 객체 보관 — MilestoneRow에 넘기기 위해)
- 인라인 MS 헤더 div 삭제 → `<MilestoneRow>` 컴포넌트 호출
- `!msCollapsed && g.tasks.map(...)` — collapsed 시 task 숨김 (matrix에서만 가능, weekly는 toggleMatrixMsCollapse 없으니 항상 false)

---

## 4. EDIT: `src/components/views/grid/grids/PersonalMatrixGrid.jsx`

`cellMilestones`를 today 셀에만 전달, 신규 props 받기, `addTask` import, 셀별 `onMsAddTask` 클로저 작성.

**전체 파일 교체:**

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
   #7: today 컬럼에 빈 MS 표시 (owner_id === userId)
   ═══════════════════════════════════════════════════════ */
export default function PersonalMatrixGrid({
  projects, myTasks, collapsed, toggleCollapse,
  editingId, setEditingId, handleEditFinish,
  toggleDone, openDetail, activeId,
  // ─── MS interactivity (from UnifiedGridView) ───
  editingMsId, onStartMsEdit, handleMsEditFinish, cancelMsEdit,
  matrixMsCollapsed, toggleMatrixMsCollapse, handleMsDelete,
}) {
  const milestones = useStore(s => s.milestones)
  const addTask = useStore(s => s.addTask)
  const userId = getCachedUserId()

  const catCounts = useMemo(() => {
    const c = {}
    CATS.forEach(cat => { c[cat.key] = myTasks.filter(t => t.category === cat.key && !t.done).length })
    return c
  }, [myTasks])

  return (
    <div style={{ border: `1px solid ${COLOR.border}`, borderRadius: 10, overflow: 'hidden' }}>
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
          // #7: today 컬럼에 빈 MS 표시 — owner_id가 본인인 MS만
          const projMyMilestones = milestones.filter(m => m.project_id === proj.id && m.owner_id === userId)
          return [
            <ProjectCell key={`p-${proj.id}`} proj={proj} color={c} count={projTasks.length} isCollapsed={isCol} onToggle={() => toggleCollapse(proj.id)} />,
            ...CATS.map(cat => {
              const cellTasks = myTasks.filter(t => t.projectId === proj.id && t.category === cat.key && !t.done)
                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
              const dropId = `mat:${proj.id}:${cat.key}`
              const cellMs = cat.key === 'today' ? projMyMilestones : null
              const handleCellMsAddTask = async (msId) => {
                const t = await addTask({
                  text: '',
                  projectId: proj.id,
                  keyMilestoneId: msId,
                  category: cat.key,
                })
                if (t) setEditingId(t.id)
              }
              return (
                <DroppableCell key={dropId} id={dropId} activeId={activeId}>
                  <div style={{ padding: '6px 8px', minHeight: 36 }}>
                    {isCol ? (
                      cellTasks.length > 0 ? <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{cellTasks.length}건</span> : null
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
                        />
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

**주요 변경**:
- props에 MS interactivity 7개 추가
- `addTask` store에서 import
- `projMyMilestones` (owner_id === userId 필터)
- `cellMs = cat.key === 'today' ? projMyMilestones : null`
- 셀별 `handleCellMsAddTask` 클로저 (await + setEditingId)
- `<CellContent>`에 신규 props 전달 + `matrixMsInteractive` 활성화

---

## 5. EDIT: `src/components/views/grid/grids/TeamMatrixGrid.jsx`

신규 props 받기 + 셀별 `onMsAddTask` 클로저(assigneeId=mem.userId) 작성.

**전체 파일 교체:**

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
export default function TeamMatrixGrid({
  projects, tasks, members, collapsed, toggleCollapse,
  editingId, setEditingId, handleEditFinish,
  toggleDone, openDetail, activeId, currentTeamId,
  // ─── MS interactivity (from UnifiedGridView) ───
  editingMsId, onStartMsEdit, handleMsEditFinish, cancelMsEdit,
  matrixMsCollapsed, toggleMatrixMsCollapse, handleMsDelete,
}) {
  const milestones = useStore(s => s.milestones)
  const addTask = useStore(s => s.addTask)

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
          const projTasks = tasks.filter(t => t.projectId === proj.id && !t.done && t.teamId === currentTeamId)
          const isCol = collapsed[proj.id]
          return [
            <ProjectCell key={`p-${proj.id}`} proj={proj} color={c} count={projTasks.length} isCollapsed={isCol} onToggle={() => toggleCollapse(proj.id)} />,
            ...members.map(mem => {
              const cellTasks = projTasks.filter(t => t.assigneeId === mem.userId)
                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
              const dropId = `tmat:${proj.id}:${mem.userId}`
              const cellMs = milestones.filter(m => m.project_id === proj.id && m.owner_id === mem.userId)
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
                      cellTasks.length > 0 ? <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{cellTasks.length}건</span> : null
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
                        />
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

**주요 변경**:
- props 7개 추가, `addTask` store import
- `cellMs` 변수로 추출 (가독성)
- 셀별 `handleCellMsAddTask` 클로저 (assigneeId=mem.userId, scope='assigned')
- `<CellContent>`에 신규 props 전달 + `matrixMsInteractive` 활성화

---

## 6. EDIT: `src/components/views/grid/grids/PersonalWeeklyGrid.jsx`

**변경 없음.** Weekly grids는 `matrixMsInteractive` prop을 명시적으로 전달하지 않음 → CellContent에서 default `false` 적용 → MilestoneRow가 read-only 모드(현재와 동일 동작).

> 검증 필요: 7-A 빌드 후 weekly view 진입해서 MS 헤더 렌더 확인. interactive=false일 때 hover 버튼 + 편집 비활성화되는지.

---

## 7. EDIT: `src/components/views/grid/grids/TeamWeeklyGrid.jsx`

**변경 없음.** 위와 동일 이유.

---

## 8. EDIT: `src/components/views/UnifiedGridView.jsx`

`editingMsId` state, MS callback 핸들러, matrixMs collapse 로직 추가. 두 매트릭스 grid에 prop drilling.

### 8-1. import에 추가 store actions 가져오기

```js
// OLD
  const { projects, tasks, updateTask, moveTaskTo, reorderTasks, toggleDone, openDetail, addTask, sortProjectsLocally, updateMilestone } = useStore()
```
```js
// NEW
  const { projects, tasks, updateTask, moveTaskTo, reorderTasks, toggleDone, openDetail, addTask, sortProjectsLocally, updateMilestone, deleteMilestone, openConfirmDialog } = useStore()
```

### 8-2. matrixMsCollapsed 추가 + toggleMatrixMsCollapse callback

기존 `const collapsed = collapseState[collapseKey] || EMPTY_OBJ` 다음 줄에 추가:

```js
// OLD
  const collapseState = useStore(s => s.collapseState)
  const collapsed = collapseState[collapseKey] || EMPTY_OBJ
  const toggleCollapse = useStore(s => s.toggleCollapse)
  const toggleProjectCollapse = useCallback((pid) => toggleCollapse(collapseKey, pid), [collapseKey, toggleCollapse])
```
```js
// NEW
  const collapseState = useStore(s => s.collapseState)
  const collapsed = collapseState[collapseKey] || EMPTY_OBJ
  const toggleCollapse = useStore(s => s.toggleCollapse)
  const toggleProjectCollapse = useCallback((pid) => toggleCollapse(collapseKey, pid), [collapseKey, toggleCollapse])
  // ─── MS collapse (matrix only) ───
  const matrixMsCollapsed = collapseState.matrixMs || EMPTY_OBJ
  const toggleMatrixMsCollapse = useCallback((msId) => toggleCollapse('matrixMs', msId), [toggleCollapse])
```

### 8-3. editingMsId state + 핸들러 추가

기존 `const [editingId, setEditingId] = useState(null)` 다음에 추가:

```js
// OLD
  // ─── Inline edit ───
  const [editingId, setEditingId] = useState(null)
  const handleEditFinish = useCallback((taskId, newText) => {
    setEditingId(null)
    if (newText && newText.trim()) updateTask(taskId, { text: newText.trim() })
  }, [updateTask])
```
```js
// NEW
  // ─── Inline edit (task) ───
  const [editingId, setEditingId] = useState(null)
  const handleEditFinish = useCallback((taskId, newText) => {
    setEditingId(null)
    if (newText && newText.trim()) updateTask(taskId, { text: newText.trim() })
  }, [updateTask])

  // ─── Inline edit (milestone) ───
  const [editingMsId, setEditingMsId] = useState(null)
  const onStartMsEdit = useCallback((msId) => {
    setEditingId(null) // task 편집 종료
    setEditingMsId(msId)
  }, [])
  const cancelMsEdit = useCallback(() => setEditingMsId(null), [])
  const handleMsEditFinish = useCallback((msId, value) => {
    setEditingMsId(null)
    if (value && value.trim()) updateMilestone(msId, { title: value.trim() })
  }, [updateMilestone])
  const handleMsDelete = useCallback((msId, msTitle) => {
    openConfirmDialog({
      title: '마일스톤 삭제',
      message: `"${msTitle || '제목 없음'}"을(를) 삭제하시겠습니까?\n하위 마일스톤도 모두 삭제됩니다.`,
      confirmText: '삭제',
      onConfirm: () => deleteMilestone(msId),
    })
  }, [openConfirmDialog, deleteMilestone])
```

### 8-4. 두 매트릭스 grid에 신규 props 전달

```jsx
// OLD
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
```
```jsx
// NEW
              {view === 'matrix' && scope === 'personal' && (
                <PersonalMatrixGrid
                  projects={displayProjects} myTasks={myTasks}
                  collapsed={collapsed} toggleCollapse={toggleProjectCollapse}
                  editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                  toggleDone={toggleDone} openDetail={openDetail} activeId={activeId}
                  editingMsId={editingMsId}
                  onStartMsEdit={onStartMsEdit}
                  handleMsEditFinish={handleMsEditFinish}
                  cancelMsEdit={cancelMsEdit}
                  matrixMsCollapsed={matrixMsCollapsed}
                  toggleMatrixMsCollapse={toggleMatrixMsCollapse}
                  handleMsDelete={handleMsDelete}
                />
              )}
              {view === 'matrix' && scope === 'team' && (
                <TeamMatrixGrid
                  projects={displayProjects} tasks={filteredTasks} members={members}
                  collapsed={collapsed} toggleCollapse={toggleProjectCollapse}
                  editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                  toggleDone={toggleDone} openDetail={openDetail} activeId={activeId}
                  currentTeamId={currentTeamId}
                  editingMsId={editingMsId}
                  onStartMsEdit={onStartMsEdit}
                  handleMsEditFinish={handleMsEditFinish}
                  cancelMsEdit={cancelMsEdit}
                  matrixMsCollapsed={matrixMsCollapsed}
                  toggleMatrixMsCollapse={toggleMatrixMsCollapse}
                  handleMsDelete={handleMsDelete}
                />
              )}
```

> Weekly grid 호출은 변경 없음.

---

## REQ-LOCK 검증

| # | 요구사항 | 적용 위치 | 확인 |
|---|---|---|---|
| 1 | editingMsId 별도 namespace | UnifiedGridView §8-3 | ✓ |
| 2 | breadcrumb은 getMsPath 재사용 | CellContent §3 import | ✓ |
| 3 | matrixMs collapse 영속화 | useStore §1-2 + UnifiedGridView §8-2 | ✓ |
| 4 | + 클릭 → task 즉시 생성 + 자동 편집 | Personal/Team Grid §4, §5 handleCellMsAddTask | ✓ |
| 5 | ⋮ 삭제는 openConfirmDialog 재사용 | UnifiedGridView §8-3 handleMsDelete | ✓ |
| 6 | 개인 매트릭스 빈 MS today 셀 + owner 필터 | PersonalMatrixGrid §4 projMyMilestones | ✓ |
| 7 | weekly read-only mode | CellContent §3 default `matrixMsInteractive=false` | ✓ |
| 8 | Vite TDZ 0건 | 모든 token 참조는 컴포넌트 함수 내부 inline | ✓ |
| 9 | task 편집/체크/DnD/InlineAdd 변경 없음 | TaskRow, InlineAdd 미수정 | ✓ |
| 10 | weekly grids 렌더 동등성 | PersonalWeeklyGrid, TeamWeeklyGrid 미수정 | ✓ |

---

## DELETE-5 검증

이 sub-loop는 **추가가 주이고 삭제는 거의 없음**. 유일한 "삭제"는 CellContent.jsx 안의 인라인 MS 헤더 div 블록.

| 삭제 대상 | ① import | ② caller | ③ props | ④ deps | ⑤ types | 처리 |
|---|---|---|---|---|---|---|
| CellContent 내 인라인 MS 헤더 `<div>` | — | CellContent 내부 1곳 | `g.msTitle`, `g.tasks.length`, `openModal` 호출 | useMemo, useStore | — | `<MilestoneRow>` 호출로 교체 |
| `g.msTitle` 필드 | — | 위 인라인 div + MilestoneRow에 ms 객체 전달 | — | — | — | groups.result에서 `ms` 객체 통째로 보관, MilestoneRow 안에서 `ms.title` 사용 |

### 잔여 import 검증
- [x] CellContent: MilestoneRow, getMsPath import 추가 — 모두 사용
- [x] PersonalMatrixGrid: addTask import 추가 — handleCellMsAddTask에서 사용
- [x] TeamMatrixGrid: addTask import 추가 — handleCellMsAddTask에서 사용
- [x] UnifiedGridView: useStore destructure에 deleteMilestone, openConfirmDialog 추가 — handleMsDelete에서 사용
- [x] MilestoneRow: useState, COLOR 사용, 모든 폰트는 inline 숫자 (FONT import 불필요)

### 잔여 변수 검증
- [x] CellContent: `g.msTitle` 참조 0건 (groups에서 `ms` 객체로 변경)
- [x] 기존 inline div 안에서만 사용되던 변수 0건

### addTask return value 호환성
- [x] 기존 호출자 13곳 모두 return value 미사용 → 비-호환성 0건
- [x] 신규 호출자 (handleCellMsAddTask 2곳)에서 `const t = await addTask(...); if (t) setEditingId(t.id)`

---

## 빌드 검증 명령

```bash
# 1. 신규 파일 존재 확인
ls src/components/views/grid/cells/MilestoneRow.jsx

# 2. 빌드
npm run build

# 3. 잔존 옛 패턴 확인 (모두 0건이어야 함)
grep -n "g.msTitle" src/components/views/grid/cells/CellContent.jsx
# 예상: 0건 — ms 객체로 통합됨

# 4. 인터랙티브 prop drilling 일치성
grep -n "matrixMsInteractive" src/components/views/grid/grids/*.jsx
# 예상: PersonalMatrixGrid + TeamMatrixGrid 각 1건, weekly grids 0건

# 5. import 정합성
grep -n "import.*MilestoneRow" src/components/views/grid/cells/CellContent.jsx
grep -n "import.*addTask\|s.addTask" src/components/views/grid/grids/PersonalMatrixGrid.jsx src/components/views/grid/grids/TeamMatrixGrid.jsx

# 6. addTask return
grep -n "return t" src/hooks/useStore.js | head
# addTask 함수 내부 1건 추가 확인
```

## 런타임 검증 체크리스트

### 매트릭스 (개인/팀 공통)
- [ ] MS 행 hover 시 행 배경색 변경 + + ⋮ 버튼 노출
- [ ] MS 제목 클릭 → input 등장 + 자동 포커스
- [ ] Enter / blur → 저장 (DB 반영 확인 — Supabase 에디터에서 title 변경 확인)
- [ ] Escape → 편집 취소 (값 원복)
- [ ] task 편집 중 MS 편집 시작 → task 편집 자동 종료
- [ ] MS ▾ 클릭 → 하위 task 숨김, 다시 클릭 → 펼침
- [ ] 새로고침 후에도 collapse 상태 유지 (localStorage)
- [ ] MS + 버튼 클릭 → 빈 task 생성 + 즉시 편집 모드 (포커스 + 빈 input)
- [ ] MS ⋮ 클릭 → confirm dialog 등장 → 삭제 시 MS와 하위 관계 task의 keyMilestoneId null (DB)
- [ ] MS › 클릭 → milestone detail modal 등장 (기존 동작)
- [ ] breadcrumb: parent_id 있는 MS는 "L1 > L2 > " prefix 표시, root MS는 prefix 없음

### 개인 매트릭스 (#7)
- [ ] today 컬럼에 task 0개인 MS도 표시됨 (owner_id === 본인 user)
- [ ] 다른 사람이 owner인 MS는 표시 안 됨
- [ ] next/later 컬럼에는 task만 표시 (MS 헤더 없음)
- [ ] 같은 MS가 today에 빈 헤더 + next/later에 그 MS 안 task가 ungrouped로 보일 수 있음 — 의도된 동작 (Q1 답변 A)

### 주간 플래너 (regression)
- [ ] MS 헤더 표시 — 토글/편집/+/⋮ 모두 비활성화 (read-only)
- [ ] MS › 상세 버튼은 동작
- [ ] task 편집/체크/DnD 모두 정상

### 백로그 사이드바
- [ ] 변경 없이 정상 동작

---

## 커밋 메시지

```
feat(matrix): MilestoneRow with inline edit/breadcrumb/collapse/+task/delete (Sub-Loop 7-A)

- New MilestoneRow component (cells/MilestoneRow.jsx) replaces inline MS header
- Features (matrix only, weekly stays read-only):
  * Inline title edit (separate editingMsId namespace)
  * Breadcrumb prefix using getMsPath (e.g. "법인설립 > 지점설립")
  * Per-MS collapse via matrixMs collapseState group
  * Hover + button: instant empty task creation + auto inline edit
  * Hover ⋮ button: delete via openConfirmDialog (existing pattern)
  * › detail button preserved
- Personal matrix shows empty MS in today column (owner_id === userId only)
- useStore: addTask returns task object (additive, no breaking change)
- useStore: _defaultCollapseState gains matrixMs key
- Weekly grids unchanged (interactive=false default in CellContent)
```
