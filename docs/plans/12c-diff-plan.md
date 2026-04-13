# Phase 12c Diff Plan — 팀 매트릭스 리스트형 전환

> 작성일: 2026-04-13
> 기준: `12c-spec-v2.md` (확정)
> 상태: 초안

---

## 0. 전제 요약

- TeamMatrixGrid.jsx **완전 재작성** (5컬럼 grid → 플랫 리스트 + MS 그룹)
- DB 변경 없음
- `tmat:` DnD prefix 제거 → UnifiedGridView handleDragEnd에서 `tmat:` 분기 정리
- `teamMatrixMsCollapsed` 신규 collapse state 키 추가
- MiniAvatar에 `color` prop 추가
- 개인 매트릭스 변경 없음

---

## Step 1: `useStore.js` — teamMatrixMsCollapsed 추가 + MiniAvatar color

### 변경 1 — _defaultCollapseState에 신규 키 추가 (line 230~):
```diff
   matrixMs: {},       // msId → boolean (true = MS 접힘, 매트릭스 셀 내)
+  teamMatrixMs: {},   // msId → boolean (팀 매트릭스 전용, 개인과 분리)
   timeline: {},
```

### 변경 2 — MiniAvatar.jsx에 `color` prop 추가:

**파일**: `src/components/views/grid/shared/MiniAvatar.jsx`

```diff
-export default function MiniAvatar({ name, size = 22 }) {
+export default function MiniAvatar({ name, size = 22, color }) {
   return (
-    <div style={{ ... background: '#888', ... }}>
+    <div style={{ ... background: color || '#888', ... }}>
```

**커밋**: `feat(store): add teamMatrixMs collapse state + MiniAvatar color prop (12c prep)`

---

## Step 2: `TeamMatrixGrid.jsx` — 완전 재작성 (C안: 플랫 리스트 + MS 그룹)

**파일**: `src/components/views/grid/grids/TeamMatrixGrid.jsx` — **전체 교체**

### 핵심 구조:

```jsx
export default function TeamMatrixGrid({
  projects, tasks, members, collapsed, toggleCollapse,
  editingId, setEditingId, handleEditFinish,
  toggleDone, openDetail, activeId, currentTeamId,
  editingMsId, onStartMsEdit, handleMsEditFinish, cancelMsEdit,
  handleMsDelete,
  groupByOwner,  // 12c 신규 prop (C↔B 토글)
}) {
  const milestones = useStore(s => s.milestones)
  const allTasks = useStore(s => s.tasks)
  const addTask = useStore(s => s.addTask)
  const addMilestoneInProject = useStore(s => s.addMilestoneInProject)
  const collapseState = useStore(s => s.collapseState)
  const toggleCollapse = useStore(s => s.toggleCollapse)
  const teamMsCollapsed = collapseState.teamMatrixMs || {}
  const toggleTeamMsCollapse = useCallback((msId) => toggleCollapse('teamMatrixMs', msId), [toggleCollapse])

  // 멤버 색상 매핑 (stable sort by userId)
  const sortedMembers = useMemo(() => [...members].sort((a, b) => a.userId.localeCompare(b.userId)), [members])
  const memberColorMap = useMemo(() => {
    const map = {}
    sortedMembers.forEach((m, i) => { map[m.userId] = getColorByIndex(i) })
    return map
  }, [sortedMembers])

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <SortableContext items={projects.map(p => `project-lane:${p.id}`)} strategy={verticalListSortingStrategy}>
        {projects.map(proj => (
          <SortableLaneCard key={proj.id} projId={proj.id} section="team">
            {({ attributes, listeners }) => (
              <ProjectLane
                proj={proj} tasks={tasks} milestones={milestones} allTasks={allTasks}
                members={members} memberColorMap={memberColorMap}
                collapsed={collapsed[proj.id]}
                onToggleCollapse={() => toggleCollapse(proj.id)}
                teamMsCollapsed={teamMsCollapsed}
                toggleTeamMsCollapse={toggleTeamMsCollapse}
                currentTeamId={currentTeamId}
                groupByOwner={groupByOwner}
                editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                toggleDone={toggleDone} openDetail={openDetail}
                editingMsId={editingMsId} onStartMsEdit={onStartMsEdit}
                handleMsEditFinish={handleMsEditFinish} cancelMsEdit={cancelMsEdit}
                handleMsDelete={handleMsDelete}
                addTask={addTask} addMilestoneInProject={addMilestoneInProject}
                dragHandleProps={{ ...attributes, ...listeners }}
              />
            )}
          </SortableLaneCard>
        ))}
      </SortableContext>

      {projects.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>표시할 프로젝트가 없습니다</div>
      )}
    </div>
  )
}
```

### ProjectLane 내부 컴포넌트 (같은 파일):

**C안 (기본):**
```
Lane 헤더: chevron + dot + 프로젝트명 + 참여자 칩 (task 수 내림차순)
Lane 본문:
  MS 그룹 1 (MilestoneRow 재사용)
    task 1 (+ 우측 담당자 배지)
    task 2
    + task 추가
  MS 그룹 2 ...
    + task 추가
  dashed "+ 마일스톤 추가" 슬롯
  "기타" 섹션
    task N (MS 미연결)
    + task 추가
```

**B안 (groupByOwner):**
```
Lane 헤더: chevron + dot + 프로젝트명
Lane 본문:
  "미배정" sub-section (N)
    task (+ MS 태그)
    + task 추가
  "Ryan" sub-section (3)
    task (+ MS 태그)
    + task 추가
  "Edmond" sub-section (3)
    ...
```

### 참여자 칩 (Lane 헤더 우측):
```jsx
// task 수 내림차순으로 멤버별 카운트
const memberCounts = useMemo(() => {
  const counts = {}
  projTasks.forEach(t => {
    const key = t.assigneeId || '__unassigned__'
    counts[key] = (counts[key] || 0) + 1
  })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([userId, count]) => ({ userId, count }))
}, [projTasks])
```

### task 행에 담당자 배지:
```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
  <MiniAvatar name={memberName} size={14} color={memberColor?.dot} />
  <span style={{ fontSize: 11, color: COLOR.textTertiary }}>{memberName}</span>
</div>
```

미배정 task: ghost 아바타 (dashed border, 기존 TaskAssigneeChip 패턴 재사용)

### MS 그룹 헤더:
`MilestoneRow` (cells/MilestoneRow.jsx) 재사용 — `teamMsCollapsed` / `toggleTeamMsCollapse` 전달

### alive/total 카운트:
`computeMilestoneCount(msId, allTasks)` 사용 (DB 전체 기준, D19)

### dashed 마일스톤 추가 슬롯:
```jsx
<div
  onClick={handleAddMs}
  onMouseEnter={() => setSlotHover(true)}
  onMouseLeave={() => setSlotHover(false)}
  style={{
    height: 32, margin: '6px 14px', borderRadius: 6,
    border: `1px dashed ${COLOR.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, color: COLOR.textTertiary,
    opacity: slotHover ? 1 : 0.4,
    cursor: 'pointer', transition: 'opacity 0.15s',
  }}
>+ 마일스톤 추가</div>
```

### "기타" 섹션:
```jsx
{/* 기타 섹션 헤더 */}
<div style={{ padding: '6px 14px 2px', fontSize: 11, fontWeight: 500, color: COLOR.textTertiary, background: 'rgba(0,0,0,0.025)' }}>기타</div>
{/* MS 미연결 task */}
{ungroupedTasks.map(t => <TaskRow ... />)}
{/* + task 추가 */}
<InlineAdd ... extraFields={{ keyMilestoneId: null }} />
```

### DELETE-5: 제거 대상

- `DroppableCell` import + 사용 제거 (팀 매트릭스에서만)
- `CellContent` import + 사용 제거 (팀 매트릭스에서만)
- `InlineMsAdd` import + 사용 제거 (dashed 슬롯으로 대체)
- `matrixMsCollapsed` / `toggleMatrixMsCollapse` props 제거 (→ `teamMatrixMs` 내부 처리)
- `matrixDoneCollapsed` / `toggleMatrixDoneCollapse` props 제거 (done 섹션 패턴 변경)

**커밋**: `feat(team-matrix): replace grid with flat list + MS groups + owner badges (12c step 2)`

---

## Step 3: `UnifiedGridView.jsx` — 토글 + handleDragEnd 정리

### 변경 1 — groupByOwner state 추가:
```js
const [groupByOwner, setGroupByOwner] = useState(() => {
  return localStorage.getItem('teamMatrixGroupByOwner') === 'true'
})
const toggleGroupByOwner = useCallback(() => {
  setGroupByOwner(prev => {
    const next = !prev
    try { localStorage.setItem('teamMatrixGroupByOwner', String(next)) } catch {}
    return next
  })
}, [])
```

### 변경 2 — TeamMatrixGrid에 groupByOwner prop 추가:
```diff
 <TeamMatrixGrid
   projects={displayProjects} tasks={filteredTasks} members={members}
   ...
+  groupByOwner={groupByOwner}
 />
```

### 변경 3 — 헤더에 토글 버튼 추가 (팀 매트릭스일 때만):
```jsx
{view === 'matrix' && scope === 'team' && (
  <button
    onClick={toggleGroupByOwner}
    style={{
      border: `1px solid ${COLOR.border}`,
      background: groupByOwner ? '#2C2C2A' : '#fff',
      color: groupByOwner ? '#fff' : COLOR.textSecondary,
      borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
      fontSize: FONT.caption, fontFamily: 'inherit', fontWeight: 500,
    }}
  >{groupByOwner ? '담당자별' : '목록형'}</button>
)}
```

### 변경 4 — handleDragEnd에서 `tmat:` 분기 정리:

기존 `tmat:` 분기(lines 352-353, 371-374)는 더 이상 `DroppableCell`이 없으므로 **유지하되 dead code로 남겨도 무방** (다른 뷰에서 사용하지 않으므로). 또는 제거.

**권장**: 깔끔하게 제거. `mode === 'tmat'` 분기 2곳 삭제.

### 변경 5 — teamMatrixMs 관련 props 추가 (TeamMatrixGrid에):

UnifiedGridView에서 `teamMatrixMs` collapse를 관리:
```js
const teamMatrixMsCollapsed = collapseState.teamMatrixMs || EMPTY_OBJ
const toggleTeamMatrixMsCollapse = useCallback((msId) => toggleCollapse('teamMatrixMs', msId), [toggleCollapse])
```

> 또는 TeamMatrixGrid 내부에서 직접 store 접근 (현재 접근법). 외부에서 전달하는 것보다 간결.

**커밋**: `feat(team-matrix): add group-by-owner toggle + cleanup tmat DnD (12c step 3)`

---

## Step 4: 담당자 변경 dropdown (owner picker)

TeamMatrixGrid 내부 task 행의 우측 아바타 배지 클릭 → 멤버 dropdown.

기존 `TaskAssigneeChip.jsx` (9b에서 생성) 재사용 가능:
- props: `taskId, assigneeId, members, onChangeAssignee, size`
- 클릭 → dropdown 팝업, 멤버 선택 → `updateTask(taskId, { assigneeId })`

TeamMatrixGrid의 task 행에서:
```jsx
<TaskAssigneeChip
  taskId={t.id}
  assigneeId={t.assigneeId}
  members={members}
  onChangeAssignee={(userId) => updateTask(t.id, { assigneeId: userId, scope: userId ? 'assigned' : 'team' })}
  size={14}
/>
```

**커밋**: `feat(team-matrix): add owner picker dropdown on badge click (12c step 4)`

---

## 작업 순서

| Step | 파일 |
|------|------|
| 1 | `useStore.js` (_defaultCollapseState) + `MiniAvatar.jsx` |
| 2 | `TeamMatrixGrid.jsx` (완전 재작성) |
| 3 | `UnifiedGridView.jsx` (토글 + tmat 정리) |
| 4 | `TeamMatrixGrid.jsx` (TaskAssigneeChip 통합) |

> Step 2+4를 합칠 수 있음 (같은 파일). 실질 3 커밋.

---

## 검증

각 Step 후 `npm run build` 통과
최종: spec §8 QA 체크리스트 전체
특히: `tmat:` DnD 분기 제거 후 기존 뷰 회귀 없는지 확인
