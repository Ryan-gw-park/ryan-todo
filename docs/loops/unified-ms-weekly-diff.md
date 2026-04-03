# MS 그룹 헤더 + 빈 MS 표시 + 주간 백로그 시간 필터 + 타임라인 스크롤 — 통합 Diff

## REQ-LOCK 요구사항

| # | 요구사항 | 출처 |
|---|---------|------|
| R1 | 매트릭스/주간 셀에서 할일을 MS별 그룹 헤더로 표시 | 목업 확정 |
| R2 | 할일 없는 MS도 배정된 셀에 헤더로 표시 (팀 매트릭스) | 버그 수정 |
| R3 | 주간 플래너 백로그에 시간 기반 필터 추가 (지연/미설정/예정) | 사용자 확정 |
| R4 | MS 없는 셀은 기존 플랫 렌더링 유지 | 목업 확정 |
| R5 | 기존 기능 전부 유지 (체크박스, 인라인 편집, DnD, + 추가, 구분선) | 사용자 지시 |
| R6 | 타임라인 로딩 시 왼쪽 영역 전체 노출 | 사용자 지시 |

## 수정 파일

| 파일 | 변경 |
|---|---|
| `InlineTimelineView.jsx` | 미사용 import 정리 + 스크롤 수정 |
| `MsBacklogSidebar.jsx` | `weekDateStrs` prop + 시간 기반 필터 |
| `UnifiedGridView.jsx` | `MsGroupedTasks` 컴포넌트 + 4개 그리드 + 사이드바 prop |

---

## Part 1: 타임라인 스크롤 수정

### Diff #1 — `src/components/views/InlineTimelineView.jsx` : 미사용 import 정리

```javascript
<<<<<<< OLD
  parseDate, daysBetween, addDays, fmtISO, getDayWidth, getBarStyle,
=======
  parseDate, addDays, fmtISO, getBarStyle,
>>>>>>> NEW
```

### Diff #2 — `src/components/views/InlineTimelineView.jsx` : 스크롤 수정

```javascript
<<<<<<< OLD
  // ─── Auto-scroll to today ───
  useEffect(() => {
    if (!gridRef.current) return
    const dayW = getDayWidth(colW, scale)
    const todayOffset = daysBetween(minD, new Date()) * dayW
    setTimeout(() => {
      if (gridRef.current) gridRef.current.scrollLeft = Math.max(0, todayOffset - 200)
    }, 100)
  }, [scale])
=======
  // ─── Auto-scroll to today (왼쪽 트리 영역 보존) ───
  useEffect(() => {
    if (!gridRef.current) return
    setTimeout(() => {
      if (gridRef.current) gridRef.current.scrollLeft = 0
    }, 100)
  }, [scale])
>>>>>>> NEW
```

---

## Part 2: 주간 백로그 시간 필터

### Diff #3 — `src/components/common/MsBacklogSidebar.jsx` : props + state 추가

```javascript
<<<<<<< OLD
export default function MsBacklogSidebar({ projects, milestones, tasks }) {
  const [blProject, setBlProject] = useState('all')
  const [blAssign, setBlAssign] = useState('unassigned')
  const [contentType, setContentType] = useState('ms') // 'ms' | 'task'
=======
export default function MsBacklogSidebar({ projects, milestones, tasks, weekDateStrs }) {
  const [blProject, setBlProject] = useState('all')
  const [blAssign, setBlAssign] = useState('unassigned')
  const [contentType, setContentType] = useState('ms') // 'ms' | 'task'
  const [blTime, setBlTime] = useState('outside') // 'outside' | 'overdue' | 'unscheduled' | 'future'
>>>>>>> NEW
```

### Diff #4 — `src/components/common/MsBacklogSidebar.jsx` : 할일 필터에 시간 조건 추가

```javascript
<<<<<<< OLD
  // Filter tasks for backlog
  const backlogTasks = useMemo(() => {
    let result = tasks.filter(t => !t.done && !t.deletedAt)

    // Project filter
    if (blProject !== 'all') {
      result = result.filter(t => t.projectId === blProject)
    }

    // Assignment filter
    if (blAssign === 'unassigned') result = result.filter(t => !t.assigneeId)
    else if (blAssign === 'assigned') result = result.filter(t => !!t.assigneeId)

    return result.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [tasks, blProject, blAssign])
=======
  // Filter tasks for backlog
  const backlogTasks = useMemo(() => {
    let result = tasks.filter(t => !t.done && !t.deletedAt)

    // Project filter
    if (blProject !== 'all') {
      result = result.filter(t => t.projectId === blProject)
    }

    // Assignment filter
    if (blAssign === 'unassigned') result = result.filter(t => !t.assigneeId)
    else if (blAssign === 'assigned') result = result.filter(t => !!t.assigneeId)

    // Weekly time filter (주간 플래너 모드일 때만 적용)
    if (weekDateStrs) {
      const weekStart = weekDateStrs[0]
      const weekEnd = weekDateStrs[weekDateStrs.length - 1]
      if (blTime === 'outside') {
        result = result.filter(t => !t.dueDate || !weekDateStrs.includes(t.dueDate))
      } else if (blTime === 'overdue') {
        result = result.filter(t => t.dueDate && t.dueDate < weekStart)
      } else if (blTime === 'unscheduled') {
        result = result.filter(t => !t.dueDate)
      } else if (blTime === 'future') {
        result = result.filter(t => t.dueDate && t.dueDate > weekEnd)
      }
    }

    return result.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [tasks, blProject, blAssign, weekDateStrs, blTime])
>>>>>>> NEW
```

### Diff #5 — `src/components/common/MsBacklogSidebar.jsx` : 시간 필터 UI 추가

배정 필터 바로 아래에 삽입한다.

```javascript
<<<<<<< OLD
        {/* Assignment filter */}
        <div style={{ display: 'flex', gap: 2, background: '#f0efeb', borderRadius: 6, padding: 2, marginBottom: 8 }}>
          {pill(blAssign === 'all', '전체', () => setBlAssign('all'))}
          {pill(blAssign === 'unassigned', '미배정', () => setBlAssign('unassigned'))}
          {pill(blAssign === 'assigned', '배정됨', () => setBlAssign('assigned'))}
        </div>

        {/* Per-project depth selector — L1/L2/L3 (MS only) */}
=======
        {/* Assignment filter */}
        <div style={{ display: 'flex', gap: 2, background: '#f0efeb', borderRadius: 6, padding: 2, marginBottom: weekDateStrs ? 6 : 8 }}>
          {pill(blAssign === 'all', '전체', () => setBlAssign('all'))}
          {pill(blAssign === 'unassigned', '미배정', () => setBlAssign('unassigned'))}
          {pill(blAssign === 'assigned', '배정됨', () => setBlAssign('assigned'))}
        </div>

        {/* Weekly time filter (주간 플래너 모드) */}
        {weekDateStrs && contentType === 'task' && (
          <div style={{ display: 'flex', gap: 2, background: '#f0efeb', borderRadius: 6, padding: 2, marginBottom: 8 }}>
            {pill(blTime === 'outside', '이번 주 외', () => setBlTime('outside'))}
            {pill(blTime === 'overdue', '지연', () => setBlTime('overdue'))}
            {pill(blTime === 'unscheduled', '미설정', () => setBlTime('unscheduled'))}
            {pill(blTime === 'future', '예정', () => setBlTime('future'))}
          </div>
        )}

        {/* Per-project depth selector — L1/L2/L3 (MS only) */}
>>>>>>> NEW
```

---

## Part 3: MsGroupedTasks + 셀 교체

### Diff #6 — `src/components/views/UnifiedGridView.jsx` : MsGroupedTasks 컴포넌트 추가

`DroppableCell` 함수 바로 앞에 삽입한다.

```javascript
<<<<<<< OLD
/* ─── Droppable Cell ─── */
function DroppableCell({ id, activeId, children }) {
=======
/* ─── MS Grouped Tasks — 셀 안에서 할일을 MS별로 그룹핑 ─── */
function MsGroupedTasks({ tasks: cellTasks, cellMilestones, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, showProject, project, projectMap }) {
  const getProj = (t) => project || (projectMap && projectMap[t.projectId]) || null
  const allMilestones = useStore(s => s.milestones)

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
    // 할일 없는 MS도 표시 (cellMilestones에서 조회)
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
      <TaskCard key={t.id} task={t} project={getProj(t)} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject={showProject} />
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
          </div>
          {g.tasks.map(t => (
            <TaskCard key={t.id} task={t} project={getProj(t)} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject={showProject} />
          ))}
        </div>
      ))}
      {groups.ungrouped.length > 0 && (
        <div style={{ marginTop: groups.msGroups.length > 0 ? 2 : 0 }}>
          {groups.msGroups.length > 0 && (
            <div style={{ height: '0.5px', background: COLOR.border, margin: '3px 0' }} />
          )}
          {groups.ungrouped.map(t => (
            <TaskCard key={t.id} task={t} project={getProj(t)} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject={showProject} />
          ))}
        </div>
      )}
    </>
  )
}

/* ─── Droppable Cell ─── */
function DroppableCell({ id, activeId, children }) {
>>>>>>> NEW
```

### Diff #7 — PersonalMatrixGrid 셀

```javascript
<<<<<<< OLD
                      <>
                        {cellTasks.map(t => (
                          <TaskCard key={t.id} task={t} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} />
                        ))}
                        <InlineAdd projectId={proj.id} category={cat.key} color={c} compact />
                      </>
=======
                      <>
                        <MsGroupedTasks tasks={cellTasks} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} />
                        <InlineAdd projectId={proj.id} category={cat.key} color={c} compact />
                      </>
>>>>>>> NEW
```

### Diff #8 — TeamMatrixGrid: milestones 조회 + 셀에 cellMilestones 전달

```javascript
<<<<<<< OLD
function TeamMatrixGrid({ projects, tasks, members, collapsed, toggleCollapse, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, activeId, currentTeamId }) {
  if (members.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>팀원 정보를 불러오는 중...</div>
  }
=======
function TeamMatrixGrid({ projects, tasks, members, collapsed, toggleCollapse, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, activeId, currentTeamId }) {
  const milestones = useStore(s => s.milestones)
  if (members.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>팀원 정보를 불러오는 중...</div>
  }
>>>>>>> NEW
```

```javascript
<<<<<<< OLD
                      <>
                        {cellTasks.map(t => (
                          <TaskCard key={t.id} task={t} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} />
                        ))}
                        <InlineAdd projectId={proj.id} category="today" color={c} extraFields={{ scope: 'assigned', assigneeId: mem.userId }} compact />
                      </>
=======
                      <>
                        <MsGroupedTasks tasks={cellTasks} cellMilestones={milestones.filter(m => m.project_id === proj.id && m.owner_id === mem.userId)} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} />
                        <InlineAdd projectId={proj.id} category="today" color={c} extraFields={{ scope: 'assigned', assigneeId: mem.userId }} compact />
                      </>
>>>>>>> NEW
```

### Diff #9 — PersonalWeeklyGrid 셀

```javascript
<<<<<<< OLD
                    {dayTasks.map(t => (
                      <TaskCard key={t.id} task={t} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showMs />
                    ))}
                    {dayTasks.length === 0 && <span style={{ fontSize: FONT.tiny, color: '#e0e0e0', display: 'block', textAlign: 'center', padding: '8px 0' }}>—</span>}
=======
                    <MsGroupedTasks tasks={dayTasks} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} />
                    {dayTasks.length === 0 && <span style={{ fontSize: FONT.tiny, color: '#e0e0e0', display: 'block', textAlign: 'center', padding: '8px 0' }}>—</span>}
>>>>>>> NEW
```

### Diff #10 — TeamWeeklyGrid 셀

```javascript
<<<<<<< OLD
                  {dayTasks.map(t => {
                    const proj = projectMap[t.projectId]
                    return <TaskCard key={t.id} task={t} project={proj} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject showMs />
                  })}
                  {dayTasks.length === 0 && <span style={{ fontSize: FONT.tiny, color: '#e0e0e0', display: 'block', textAlign: 'center', padding: '8px 0' }}>—</span>}
=======
                  <MsGroupedTasks tasks={dayTasks} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject projectMap={projectMap} />
                  {dayTasks.length === 0 && <span style={{ fontSize: FONT.tiny, color: '#e0e0e0', display: 'block', textAlign: 'center', padding: '8px 0' }}>—</span>}
>>>>>>> NEW
```

### Diff #11 — 사이드바에 weekDateStrs 전달

```javascript
<<<<<<< OLD
          {/* Sidebar */}
          <MsBacklogSidebar projects={displayProjects} milestones={milestones} tasks={tasks} />
=======
          {/* Sidebar */}
          <MsBacklogSidebar projects={displayProjects} milestones={milestones} tasks={tasks} weekDateStrs={view === 'weekly' ? weekDateStrs : null} />
>>>>>>> NEW
```

---

## REQ-LOCK 검증

| # | 요구사항 | Diff | 처리 |
|---|---------|------|------|
| R1 | MS 그룹 헤더 표시 | #6,#7,#8,#9,#10 | ✅ |
| R2 | 빈 MS도 표시 (팀 매트릭스) | #6 (`cellMilestones`), #8 (`milestones.filter`) | ✅ |
| R3 | 주간 백로그 시간 필터 | #3,#4,#5,#11 | ✅ |
| R4 | MS 없는 셀 플랫 유지 | #6 (`msGroups.length === 0` 분기) | ✅ |
| R5 | 기존 기능 유지 | TaskCard/InlineAdd/DroppableCell 불변 | ✅ |
| R6 | 타임라인 스크롤 | #1,#2 | ✅ |

## DELETE-5 검증

| 삭제 대상 | ① import | ② caller | ③ props | ④ deps | ⑤ types | 처리 |
|-----------|----------|----------|---------|--------|---------|------|
| 개인매트릭스 `cellTasks.map(TaskCard)` | N/A | `MsGroupedTasks`로 대체 | 동일 | N/A | N/A | ✅ |
| 팀매트릭스 `cellTasks.map(TaskCard)` | N/A | `MsGroupedTasks`로 대체 | 동일 + `cellMilestones` 추가 | N/A | N/A | ✅ |
| 개인주간 `dayTasks.map(TaskCard showMs)` | N/A | `MsGroupedTasks`로 대체 | `showMs` 제거 → MS 헤더가 대체 | N/A | N/A | ✅ |
| 팀주간 `dayTasks.map(TaskCard)` | N/A | `MsGroupedTasks`로 대체 | `showProject`+`projectMap` | N/A | N/A | ✅ |
| 타임라인 scroll L183-186 | L12 import 정리 | N/A | N/A | `getDayWidth`,`daysBetween` 삭제 | N/A | ✅ |

### 잔여 import 검증
- [x] `useMemo` — 이미 import, MsGroupedTasks에서 사용 → ✅
- [x] `useStore` — 이미 import, MsGroupedTasks + TeamMatrixGrid에서 사용 → ✅
- [x] `useState` — MsBacklogSidebar에서 이미 import, `blTime` state 추가 → ✅
- [x] `getDayWidth`, `daysBetween` — import에서 제거 (#1), 본문 사용처도 제거 (#2) → ✅

---

## Claude Code 프롬프트

```
아래 diff를 순서대로 적용하라. 해석이나 판단 없이 지시 그대로만 이행하라.

파일 1: src/components/views/InlineTimelineView.jsx — str_replace #1~#2
파일 2: src/components/common/MsBacklogSidebar.jsx — str_replace #3~#5
파일 3: src/components/views/UnifiedGridView.jsx — str_replace #6~#11

적용 순서:
1.  #1  (InlineTimelineView import 정리)
2.  #2  (InlineTimelineView 스크롤 수정)
3.  #3  (MsBacklogSidebar props + state)
4.  #4  (MsBacklogSidebar 할일 시간 필터 로직)
5.  #5  (MsBacklogSidebar 시간 필터 UI)
6.  #6  (UnifiedGridView MsGroupedTasks 컴포넌트)
7.  #7  (PersonalMatrixGrid 셀)
8.  #8  (TeamMatrixGrid milestones 조회 + 셀) — 이 항목은 str_replace 2건
9.  #9  (PersonalWeeklyGrid 셀)
10. #10 (TeamWeeklyGrid 셀)
11. #11 (사이드바 weekDateStrs prop)

각 str_replace 적용 후 파일 저장.
모든 적용 완료 후:
  npm run build
  빌드 성공 시: git add -A && git commit -m "feat: MS group headers, empty MS display, weekly backlog time filter, timeline scroll fix" && git push origin main
  빌드 실패 시: 에러 내용만 보고 (수정 금지)
```
