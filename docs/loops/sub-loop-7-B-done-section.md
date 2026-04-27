# Sub-Loop 7-B: Done Section (회색 + 셀 하단 collapsed)

## 목표
요구사항 #4: "Done 처리된 Task는 회색처리하고, 셀 내에서 접기 상태로 가장 아래에 표시"

- done task가 매트릭스 셀에서 사라지지 않고 **하단 collapsed section**에 표시
- 기본 상태 = 접힘, 클릭으로 펼침
- 회색 + 취소선 스타일은 `TaskRow`에 이미 구현되어 있음 (`task.done` 분기) — 추가 작업 불필요
- 영속화: `collapseState['matrixDone']` 활용 (이미 store에 정의됨)
- weekly grids는 변경 없음 (Q1 답변에 따라 매트릭스에만 적용)

---

## REQ-LOCK 요구사항

1. done task는 원래 셀 위치에 머무름 (개인=원래 category, 팀=원래 assignee)
2. DoneSection은 셀 가장 하단에 노출, 빈 done은 표시하지 않음
3. collapse 단위 = **프로젝트 단위** (`matrixDone[projId]`) — 동일 프로젝트 모든 셀이 한꺼번에 토글
4. 기본 상태 = 접힘 (`matrixDoneCollapsed[projId] !== false`로 판정 → undefined도 접힘)
5. ProjectCell의 count는 **active task만** 카운트 (현재 동작 유지)
6. 카테고리/멤버 헤더의 카운트는 active task만 (현재 동작 유지)
7. weekly grids 동작 100% 동일 — `!t.done` 필터 유지
8. DoneSection은 신규 파일 생성하지 않고 `CellContent.jsx` 내부에 inline 정의 (~30줄)
9. Vite TDZ 0건

---

## 영향 파일

| # | 파일 | 종류 | 변경 요약 |
|---|---|---|---|
| 1 | `cells/CellContent.jsx` | EDIT | done task 분리 + DoneSection inline 정의 + props 2개 추가 |
| 2 | `grids/PersonalMatrixGrid.jsx` | EDIT | filter에서 `!t.done` 제거, activeCount 변수, doneCollapsed prop |
| 3 | `grids/TeamMatrixGrid.jsx` | EDIT | 동일 |
| 4 | `views/UnifiedGridView.jsx` | EDIT | matrixDoneCollapsed + toggleMatrixDoneCollapse + prop drilling |

---

## 1. EDIT: `src/components/views/grid/cells/CellContent.jsx`

### 1-1. groups useMemo에 done task 분리 추가

```jsx
// OLD
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
```
```jsx
// NEW
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
    result.sort((a, b) => (a.tasks[0]?.sortOrder || 0) - (b.tasks[0]?.sortOrder || 0))
    done.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    return { msGroups: result, ungrouped: noMs, done }
  }, [cellTasks, allMilestones, cellMilestones])
```

### 1-2. 함수 시그니처에 props 2개 추가

```jsx
// OLD
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
```
```jsx
// NEW
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
}) {
```

### 1-3. early return 분기에서 done section 추가 처리

```jsx
// OLD
  if (groups.msGroups.length === 0) {
    return cellTasks.map(t => (
      <TaskRow key={t.id} task={t} project={getProj(t)} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject={showProject} />
    ))
  }
```
```jsx
// NEW
  const taskRowProps = {
    project: undefined, // overridden per task
    editingId, setEditingId, handleEditFinish, toggleDone, openDetail, showProject,
  }

  if (groups.msGroups.length === 0) {
    return (
      <>
        {groups.ungrouped.map(t => (
          <TaskRow key={t.id} task={t} project={getProj(t)} {...taskRowProps} />
        ))}
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
```

> 변경 포인트 1: 기존 `cellTasks.map`은 done까지 포함했음 → 이제 `groups.ungrouped.map`으로 변경 (done 제외).
> 변경 포인트 2: DoneSection 추가.
> `taskRowProps` 객체로 prop 묶어서 가독성/중복 ↓.

### 1-4. main return의 마지막에 DoneSection 추가

```jsx
// OLD
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
```jsx
// NEW
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
```

### 1-5. DoneSection inline 컴포넌트 정의 — 파일 끝에 추가

```jsx
// 파일 끝, 기존 export default function CellContent의 닫는 } 이후에 추가

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
```

> `onToggle` undefined일 때 클릭 비활성 → weekly grids에서 doneCollapsed prop 안 넘기면 자연스럽게 비-인터랙티브. 다만 weekly에서는 애초에 done task가 cellTasks에 없어서 `doneTasks.length === 0`로 early return됨. 양쪽 안전장치.

---

## 2. EDIT: `src/components/views/grid/grids/PersonalMatrixGrid.jsx`

### 2-1. props에 doneCollapsed 추가

```jsx
// OLD
export default function PersonalMatrixGrid({
  projects, myTasks, collapsed, toggleCollapse,
  editingId, setEditingId, handleEditFinish,
  toggleDone, openDetail, activeId,
  // ─── MS interactivity (from UnifiedGridView) ───
  editingMsId, onStartMsEdit, handleMsEditFinish, cancelMsEdit,
  matrixMsCollapsed, toggleMatrixMsCollapse, handleMsDelete,
}) {
```
```jsx
// NEW
export default function PersonalMatrixGrid({
  projects, myTasks, collapsed, toggleCollapse,
  editingId, setEditingId, handleEditFinish,
  toggleDone, openDetail, activeId,
  // ─── MS interactivity (from UnifiedGridView) ───
  editingMsId, onStartMsEdit, handleMsEditFinish, cancelMsEdit,
  matrixMsCollapsed, toggleMatrixMsCollapse, handleMsDelete,
  // ─── Done section (from UnifiedGridView) ───
  matrixDoneCollapsed, toggleMatrixDoneCollapse,
}) {
```

### 2-2. cellTasks 필터에서 `!t.done` 제거 + activeCount 변수

```jsx
// OLD
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
```
```jsx
// NEW
        {projects.map(proj => {
          const c = getColor(proj.color)
          const projAllTasks = myTasks.filter(t => t.projectId === proj.id)
          const projActiveCount = projAllTasks.filter(t => !t.done).length
          const isCol = collapsed[proj.id]
          // #7: today 컬럼에 빈 MS 표시 — owner_id가 본인인 MS만
          const projMyMilestones = milestones.filter(m => m.project_id === proj.id && m.owner_id === userId)
          // 7-B: done section collapse — 프로젝트 단위, 기본 접힘
          const projDoneCollapsed = matrixDoneCollapsed ? (matrixDoneCollapsed[proj.id] !== false) : true
          const onToggleProjDone = () => toggleMatrixDoneCollapse && toggleMatrixDoneCollapse(proj.id)
          return [
            <ProjectCell key={`p-${proj.id}`} proj={proj} color={c} count={projActiveCount} isCollapsed={isCol} onToggle={() => toggleCollapse(proj.id)} />,
            ...CATS.map(cat => {
              const cellTasks = myTasks.filter(t => t.projectId === proj.id && t.category === cat.key)
                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
              const cellActiveCount = cellTasks.filter(t => !t.done).length
              const dropId = `mat:${proj.id}:${cat.key}`
              const cellMs = cat.key === 'today' ? projMyMilestones : null
```

### 2-3. isCol 분기 + CellContent 호출 수정

```jsx
// OLD
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
```
```jsx
// NEW
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
                        <InlineAdd projectId={proj.id} category={cat.key} color={c} compact />
                      </>
                    )}
                  </div>
                </DroppableCell>
              )
```

---

## 3. EDIT: `src/components/views/grid/grids/TeamMatrixGrid.jsx`

### 3-1. props에 doneCollapsed 추가

```jsx
// OLD
export default function TeamMatrixGrid({
  projects, tasks, members, collapsed, toggleCollapse,
  editingId, setEditingId, handleEditFinish,
  toggleDone, openDetail, activeId, currentTeamId,
  // ─── MS interactivity (from UnifiedGridView) ───
  editingMsId, onStartMsEdit, handleMsEditFinish, cancelMsEdit,
  matrixMsCollapsed, toggleMatrixMsCollapse, handleMsDelete,
}) {
```
```jsx
// NEW
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
```

### 3-2. projTasks 필터에서 `!t.done` 제거 + activeCount + done collapse

```jsx
// OLD
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
```
```jsx
// NEW
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
```

> 변수명: `projTasks` → `projAllTasks`로 의미 명확화. 기존 `projTasks.filter(t => t.assigneeId === mem.userId)`도 자연스럽게 따라옴.

### 3-3. isCol 분기 + CellContent 호출 수정

```jsx
// OLD
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
```
```jsx
// NEW
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
                      </>
                    )}
                  </div>
                </DroppableCell>
              )
```

---

## 4. EDIT: `src/components/views/UnifiedGridView.jsx`

### 4-1. matrixDoneCollapsed + toggle 추가

기존 `toggleMatrixMsCollapse` 정의 다음에 추가:

```js
// OLD
  // ─── MS collapse (matrix only) ───
  const matrixMsCollapsed = collapseState.matrixMs || EMPTY_OBJ
  const toggleMatrixMsCollapse = useCallback((msId) => toggleCollapse('matrixMs', msId), [toggleCollapse])
```
```js
// NEW
  // ─── MS collapse (matrix only) ───
  const matrixMsCollapsed = collapseState.matrixMs || EMPTY_OBJ
  const toggleMatrixMsCollapse = useCallback((msId) => toggleCollapse('matrixMs', msId), [toggleCollapse])
  // ─── Done section collapse (matrix only) — projectId → boolean (default true=접힘) ───
  const matrixDoneCollapsed = collapseState.matrixDone || EMPTY_OBJ
  const toggleMatrixDoneCollapse = useCallback((pid) => {
    // 기본이 접힘(true)이므로 첫 클릭 시 false(펼침)로 명시 set
    const cur = collapseState.matrixDone?.[pid]
    const next = cur === false ? true : false
    useStore.getState().setCollapseValue('matrixDone', pid, next)
  }, [collapseState.matrixDone])
```

> 일반 `toggleCollapse`는 `!cs[group]?.[key]` (undefined → true)로 동작하지만, 우리는 default가 **true(접힘)**라서 undefined일 때도 false로 가야 함. 그래서 `setCollapseValue` 직접 호출.

> `setCollapseValue` action은 store에 line 279~284에 이미 정의되어 있음 (useStore.js).

### 4-2. PersonalMatrixGrid + TeamMatrixGrid 호출에 신규 props 전달

```jsx
// OLD
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
                  matrixDoneCollapsed={matrixDoneCollapsed}
                  toggleMatrixDoneCollapse={toggleMatrixDoneCollapse}
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
                  matrixDoneCollapsed={matrixDoneCollapsed}
                  toggleMatrixDoneCollapse={toggleMatrixDoneCollapse}
                />
              )}
```

> Weekly grid 호출은 변경 없음. CellContent에서 `doneCollapsed` prop 미전달 → default `true` → DoneSection은 빈 doneTasks(weekly가 done filter로 미리 제외)이므로 어쨌든 early return null.

---

## DELETE-5 검증

| 항목 | ① import | ② caller | ③ props | ④ deps | ⑤ types | 처리 |
|---|---|---|---|---|---|---|
| `cellTasks.map`에서 `cellTasks` 직접 사용 (early return) | — | CellContent §1-3 | — | — | — | `groups.ungrouped.map`으로 교체 (done 제외) |
| `projTasks` (Personal) | — | PersonalMatrixGrid §2-2 1곳 | — | — | — | `projAllTasks` + `projActiveCount`로 분리 |
| `projTasks` (Team) | — | TeamMatrixGrid §3-2 2곳 | — | — | — | `projAllTasks`로 rename, 의미 보존 |
| `cellTasks.length` (Personal isCol) | — | PersonalMatrixGrid §2-3 | — | — | — | `cellActiveCount`로 교체 |
| `cellTasks.length` (Team isCol) | — | TeamMatrixGrid §3-3 | — | — | — | `cellActiveCount`로 교체 |
| `count={projTasks.length}` | — | ProjectCell prop | — | — | — | `count={projActiveCount}`로 교체 (count 의미 동일 — active만) |

### 잔여 import 검증
- [x] CellContent: 신규 import 0건 (DoneSection은 inline)
- [x] PersonalMatrixGrid: 신규 import 0건
- [x] TeamMatrixGrid: 신규 import 0건
- [x] UnifiedGridView: useStore destructure 변경 없음 (`setCollapseValue`는 `useStore.getState()` 직접 호출로 사용)

### 잔여 변수 검증
- [x] CellContent의 `groups`에 `done` 배열 추가 — 모든 분기에서 사용
- [x] `projTasks` 변수 → 모두 `projAllTasks` 또는 `projActiveCount`로 대체됨
- [x] `taskRowProps` 객체 — early return 분기 + DoneSection 호출에서만 사용 (지역 변수)

### 동작 동등성 검증 (변경 없는 부분)
- [x] Weekly grids 미수정
- [x] CellContent의 main return은 done section 추가 외 그대로 (msGroups 렌더 / ungrouped 렌더 동일)
- [x] TaskRow 미수정
- [x] MilestoneRow 미수정
- [x] InlineAdd 미수정
- [x] DnD 핸들러 미수정 (done task drop은 7-B 범위 밖 — 7-D/E에서 검토)

---

## REQ-LOCK 검증

| # | 요구사항 | 적용 위치 | 확인 |
|---|---|---|---|
| 1 | done task 원래 셀에 머무름 (R3 동작) | toggleDone가 category 유지 | ✓ |
| 2 | DoneSection 빈 done 안 그림 | DoneSection §1-5 early return | ✓ |
| 3 | collapse 단위 = 프로젝트 | matrixDone[projId] | ✓ |
| 4 | 기본 상태 = 접힘 | `matrixDoneCollapsed[pid] !== false` | ✓ |
| 5 | ProjectCell count = active만 | projActiveCount | ✓ |
| 6 | 카테고리/멤버 카운트 = active만 | catCounts (Personal): 변경 없음 (이미 `!t.done`), Team: 헤더 카운트 없음 | ✓ |
| 7 | weekly grids 동작 100% 동일 | 미수정 + cellTasks에 done 없음 | ✓ |
| 8 | DoneSection inline 정의 | CellContent.jsx 파일 끝 | ✓ |
| 9 | Vite TDZ 0건 | 모든 token inline 참조 | ✓ |

---

## 빌드 검증 명령

```bash
# 1. 빌드
npm run build

# 2. 옛 패턴 잔존 확인 (모두 0건이어야 함)
grep -n "projTasks" src/components/views/grid/grids/PersonalMatrixGrid.jsx src/components/views/grid/grids/TeamMatrixGrid.jsx
# 예상: 0건 — 모두 projAllTasks/projActiveCount로 교체

# 3. cellTasks.length 직접 사용 확인 (matrix grids에서 isCol 분기에는 cellActiveCount만 있어야 함)
grep -n "cellTasks.length" src/components/views/grid/grids/PersonalMatrixGrid.jsx src/components/views/grid/grids/TeamMatrixGrid.jsx
# 예상: 0건

# 4. DoneSection 정의 확인
grep -n "function DoneSection" src/components/views/grid/cells/CellContent.jsx
# 예상: 1건

# 5. matrixDone collapse import 경로 확인
grep -n "matrixDoneCollapsed\|toggleMatrixDoneCollapse" src/components/views/UnifiedGridView.jsx
# 예상: state 정의 + 2개 grid prop 전달
```

## 런타임 검증 체크리스트

### 매트릭스 (개인/팀 공통)
- [ ] 셀 안 active task 변화 없이 정상 표시
- [ ] 셀 하단에 `─── ✓ 완료 N건 ▾` 영역 표시 (done task ≥1건일 때만)
- [ ] done task 0건이면 done section 자체가 안 보임
- [ ] 클릭하면 펼침 → done task 회색 + 취소선으로 노출
- [ ] 다시 클릭하면 접힘
- [ ] 새로고침 후에도 펼침/접힘 상태 유지 (localStorage)
- [ ] 같은 프로젝트의 모든 셀이 한꺼번에 토글됨 (프로젝트 단위)
- [ ] task 체크 → done section으로 즉시 이동
- [ ] done task 다시 체크 해제 → active로 복귀, 원래 카테고리/셀로 돌아감

### 카운트 검증
- [ ] ProjectCell 좌측 컬럼의 "N건"이 active task만 카운트
- [ ] 카테고리 헤더 (지금/다음/나중)의 카운트 변화 없음 (이전과 동일)
- [ ] 프로젝트 접힘 상태의 셀 카운트가 active만 표시

### Weekly (regression)
- [ ] 개인 주간 / 팀 주간 변경 없이 정상
- [ ] done task는 weekly에 표시되지 않음 (기존 동작)

### 다른 7-A 기능과 충돌 없음
- [ ] MS 인라인 편집 정상
- [ ] MS + 버튼 정상 (active task 추가됨, done section과 무관)
- [ ] MS ⋮ 삭제 정상

---

## 커밋 메시지

```
feat(matrix): collapsed done section at cell bottom (Sub-Loop 7-B)

- DoneSection inline component in CellContent renders done tasks at cell bottom
- Project-level collapse via matrixDone collapseState group (default: collapsed)
- Empty done arrays render nothing (no visual noise)
- Personal & team matrix: cellTasks filter no longer excludes !t.done
  * Counts (ProjectCell, isCol fallback) split into projActiveCount/cellActiveCount
- Done task styling (gray + strikethrough) already handled by TaskRow
- Weekly grids unchanged — done filter preserved (matrix vs weekly role split)
- toggleMatrixDoneCollapse uses setCollapseValue directly (default true semantics)
```
