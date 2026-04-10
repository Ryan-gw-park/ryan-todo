# Phase 12a Diff Plan (v2) — 매트릭스 Lane UI 개편 + today 강조 + 집중 모드

> 작성일: 2026-04-10
> 기준: `12a-spec-v2.md` (확정)
> 상태: 리뷰 반영 v2

## 리뷰 반영 (v1 → v2)

| 이슈 | 해결 |
|------|------|
| [C1] DndContext 분기 시 MsBacklogSidebar/DragOverlay 위치 | children 변수 추출 패턴 명시 |
| [C2] 뷰 전환 후 focusMode state 혼란 | 집중 모드를 **개인 매트릭스 전용**으로 한정, `view === 'matrix' && scope === 'personal'`에서만 적용 |
| [C3] TeamMatrixGrid getCachedUserId import 누락 | **팀 매트릭스는 focusMode 무관** (사용자 결정) → import 불필요 |
| [W1] sticky 헤더 정렬 불일치 | **sticky 헤더에서 프로젝트 열 제거**, 카테고리 컬럼만 표시 |
| [W4] TeamMatrixGrid 변경 3 JSX 누락 | focusMode 제거로 단순화, Lane 카드 구조만 작성 |
| [W5] 2열 Lane 정렬 | `alignItems: start` 추가 |
| [W6] DroppableCell without DndContext | 집중 모드에서는 일반 div 사용 (DroppableCell 래핑 제거) |

---

## 0. 전제 요약

- DB / RLS 변경 없음
- **집중 모드는 개인 매트릭스 전용** (팀 매트릭스는 Lane 카드화만, 집중 모드 없음)
- 기존 DnD 동작 유지 (일반 모드), 집중 모드에서는 DndContext 비활성
- 기존 `collapseState.personalMatrix` / `matrix` 재사용
- localStorage key: `matrixFocusMode`

---

## Step 1: `UnifiedGridView.jsx` — focusMode state + DndContext 조건부

**파일**: `src/components/views/UnifiedGridView.jsx`

### 변경 1 — focusMode state (매트릭스 + 개인 전용):
```js
const [focusMode, setFocusMode] = useState(() => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('matrixFocusMode') === 'true'
})
const toggleFocusMode = useCallback(() => {
  setFocusMode(prev => {
    const next = !prev
    try { localStorage.setItem('matrixFocusMode', String(next)) } catch {}
    return next
  })
}, [])

// 집중 모드는 개인 매트릭스일 때만 활성 — 주간/팀에서는 무시
const focusModeActive = view === 'matrix' && scope === 'personal' && focusMode
```

### 변경 2 — PersonalMatrixGrid에만 focusMode prop 전달:
```diff
 <PersonalMatrixGrid
   projects={displayProjects} myTasks={myTasks}
   ...
+  focusMode={focusMode}
+  onToggleFocusMode={toggleFocusMode}
 />
```

TeamMatrixGrid는 focusMode 미전달.

### 변경 3 — DnD 조건부 활성화 (MsBacklogSidebar + DragOverlay 포함):

**기존** (line 378~):
```jsx
<div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>
  <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={...} onDragEnd={...}>
    <div style={{ flex: 1, overflow: 'auto' }}>
      {view === 'matrix' && scope === 'personal' && <PersonalMatrixGrid ... />}
      {view === 'matrix' && scope === 'team' && <TeamMatrixGrid ... />}
      {view === 'weekly' && ... }
    </div>
    <MsBacklogSidebar ... />
    <DragOverlay>...</DragOverlay>
  </DndContext>
</div>
```

**변경** — children 변수 추출 + 조건부 래핑:
```jsx
const gridContent = (
  <>
    <div style={{ flex: 1, overflow: 'auto' }}>
      {view === 'matrix' && scope === 'personal' && <PersonalMatrixGrid ... focusMode={focusMode} onToggleFocusMode={toggleFocusMode} />}
      {view === 'matrix' && scope === 'team' && <TeamMatrixGrid ... />}
      {view === 'weekly' && ... }
    </div>
    <MsBacklogSidebar ... />
  </>
)

return (
  <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>
    {focusModeActive ? (
      gridContent  /* DndContext 없이 */
    ) : (
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {gridContent}
        <DragOverlay>...</DragOverlay>
      </DndContext>
    )}
  </div>
)
```

> **DragOverlay**는 DndContext 안에만 렌더. 집중 모드에서는 DnD 자체가 없으므로 DragOverlay도 불필요.

**커밋**: `feat(matrix): add focusMode state with conditional DndContext (12a step 1)`

---

## Step 2: `PersonalMatrixGrid.jsx` — Lane 카드 구조 + sticky 헤더 + 집중 모드

**파일**: `src/components/views/grid/grids/PersonalMatrixGrid.jsx`

### 변경 1 — Props 추가:
```diff
 export default function PersonalMatrixGrid({
   ...
   matrixDoneCollapsed, toggleMatrixDoneCollapse,
+  focusMode, onToggleFocusMode,
 }) {
```

### 변경 2 — Return 전체 교체:

```jsx
const displayCats = focusMode ? CATS.filter(c => c.key === 'today') : CATS
// 카드 내부 grid 컬럼: 일반=3, 집중=1
const cardGridCols = focusMode ? '1fr' : `repeat(${CATS.length}, 1fr)`
// 외부 Lane 배치: 일반=1열, 집중=2열
const outerCols = focusMode ? 'repeat(2, 1fr)' : '1fr'

// Sticky 헤더 컬럼 (카드 내부와 동일) — 프로젝트 열 제거
// 일반: 카테고리 3개 + 토글 버튼
// 집중: 카테고리 1개 + 토글 버튼
const headerCols = focusMode ? '1fr 48px' : `repeat(${CATS.length}, 1fr) 48px`

return (
  <div>
    {/* Sticky 카테고리 헤더 */}
    <div style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: '#fff',
      border: `1px solid ${COLOR.border}`, borderRadius: 10,
      padding: '8px 14px', marginBottom: 12,
      display: 'grid', gridTemplateColumns: headerCols,
      alignItems: 'center', gap: 8,
    }}>
      {displayCats.map(cat => (
        <div key={cat.key} style={{
          fontSize: FONT.caption,
          fontWeight: cat.key === 'today' ? 700 : 600,
          color: cat.key === 'today' ? COLOR.danger : COLOR.textTertiary,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: cat.color }} />
          {cat.label}
          <span style={{ fontWeight: 400, color: COLOR.textTertiary, fontSize: FONT.tiny }}>{catCounts[cat.key]}</span>
        </div>
      ))}
      <button
        onClick={onToggleFocusMode}
        title={focusMode ? '집중 모드 해제' : '집중 모드'}
        style={{
          border: 'none',
          background: focusMode ? COLOR.danger : 'transparent',
          color: focusMode ? '#fff' : COLOR.textTertiary,
          borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
          fontSize: 14, justifySelf: 'end',
        }}
      >◎</button>
    </div>

    {/* Lane 카드 리스트 */}
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

        // 카테고리별 카운트 (접힌 Lane 요약용)
        const catCountsByProj = {}
        CATS.forEach(cat => {
          catCountsByProj[cat.key] = projAllTasks.filter(t => t.category === cat.key && !t.done).length
        })

        return (
          <div key={proj.id} style={{
            background: '#fff', border: `1px solid ${COLOR.border}`, borderRadius: 10,
            marginBottom: focusMode ? 0 : 12, overflow: 'hidden',
          }}>
            {/* Lane 헤더 */}
            <div
              onClick={() => toggleCollapse(proj.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', cursor: 'pointer',
                background: COLOR.bgSurface,
                borderBottom: isCol ? 'none' : `1px solid ${COLOR.border}`,
              }}
            >
              <span style={{
                fontSize: 10, color: COLOR.textSecondary, width: 10,
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

            {/* Lane 본문 (cells) */}
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

                  // 셀 내용
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

                  // 집중 모드: DroppableCell 래핑 없이 일반 div (DnD 없음)
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
        )
      })}
    </div>

    {projects.length === 0 && (
      <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>표시할 프로젝트가 없습니다</div>
    )}
  </div>
)
```

**커밋**: `feat(matrix): redesign PersonalMatrixGrid as Lane cards + focus mode (12a step 2)`

---

## Step 3: `TeamMatrixGrid.jsx` — Lane 카드 구조 (focusMode 없음)

**파일**: `src/components/views/grid/grids/TeamMatrixGrid.jsx`

팀 매트릭스는 **focusMode 없이 Lane 카드화만** 적용. 행=프로젝트, 열=팀원 유지.

### 변경 — Return 전체 교체:

```jsx
return (
  <div>
    {/* Sticky 팀원 헤더 */}
    <div style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: '#fff',
      border: `1px solid ${COLOR.border}`, borderRadius: 10,
      padding: '8px 14px', marginBottom: 12,
      display: 'grid', gridTemplateColumns: `repeat(${members.length}, 1fr)`,
      alignItems: 'center', gap: 8,
    }}>
      {members.map(m => (
        <div key={m.id} style={{
          display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center',
        }}>
          <MiniAvatar name={m.displayName || m.name} size={18} />
          <span style={{ fontSize: FONT.caption, fontWeight: 600, color: COLOR.textPrimary }}>{m.displayName || m.name}</span>
        </div>
      ))}
    </div>

    {/* Lane 카드 리스트 */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0, alignItems: 'start' }}>
      {projects.map(proj => {
        const c = getColor(proj.color)
        const projAllTasks = tasks.filter(t => t.projectId === proj.id && t.teamId === currentTeamId)
        const projActiveCount = projAllTasks.filter(t => !t.done).length
        const isCol = collapsed[proj.id]
        const projDoneCollapsed = matrixDoneCollapsed ? (matrixDoneCollapsed[proj.id] !== false) : true
        const onToggleProjDone = () => toggleMatrixDoneCollapse && toggleMatrixDoneCollapse(proj.id)

        return (
          <div key={proj.id} style={{
            background: '#fff', border: `1px solid ${COLOR.border}`, borderRadius: 10,
            marginBottom: 12, overflow: 'hidden',
          }}>
            {/* Lane 헤더 */}
            <div
              onClick={() => toggleCollapse(proj.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', cursor: 'pointer',
                background: COLOR.bgSurface,
                borderBottom: isCol ? 'none' : `1px solid ${COLOR.border}`,
              }}
            >
              <span style={{
                fontSize: 10, color: COLOR.textSecondary, width: 10,
                transform: isCol ? 'rotate(-90deg)' : 'rotate(0)',
                transition: 'transform 0.15s',
              }}>▾</span>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: c.dot, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary }}>{proj.name}</span>
              <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{projActiveCount}건</span>
            </div>

            {/* Lane 본문 */}
            {!isCol && (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${members.length}, 1fr)` }}>
                {members.map(mem => {
                  const cellTasks = projAllTasks.filter(t => t.assigneeId === mem.userId)
                    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                  const dropId = `tmat:${proj.id}:${mem.userId}`
                  const cellMs = milestones.filter(m => m.project_id === proj.id && m.owner_id === mem.userId)
                  const handleAddMsForCell = async () => {
                    const newMs = await addMilestoneInProject(proj.id, { ownerId: mem.userId })
                    if (newMs && onStartMsEdit) onStartMsEdit(newMs.id)
                  }
                  const handleCellMsAddTask = async (msId) => {
                    const t = await addTask({
                      text: '', projectId: proj.id, keyMilestoneId: msId,
                      category: 'today', scope: 'assigned', assigneeId: mem.userId,
                    })
                    if (t) setEditingId(t.id)
                  }
                  const isLastMember = mem.userId === members[members.length - 1].userId
                  return (
                    <DroppableCell key={dropId} id={dropId} activeId={activeId}>
                      <div style={{
                        padding: '8px 12px', minHeight: 60,
                        borderRight: !isLastMember ? `1px solid ${COLOR.border}` : 'none',
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
                          cellSortableId={dropId}
                        />
                        <InlineAdd projectId={proj.id} category="today" color={c} extraFields={{ scope: 'assigned', assigneeId: mem.userId }} compact />
                        <InlineMsAdd onClick={handleAddMsForCell} />
                      </div>
                    </DroppableCell>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>

    {projects.length === 0 && (
      <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>표시할 프로젝트가 없습니다</div>
    )}
  </div>
)
```

**커밋**: `feat(matrix): redesign TeamMatrixGrid as Lane cards (12a step 3)`

---

## 작업 순서 요약

| Step | 파일 | 유형 |
|------|------|------|
| 1 | `UnifiedGridView.jsx` | focusMode state + children 변수 + 조건부 DndContext |
| 2 | `PersonalMatrixGrid.jsx` | 대규모 수정 (Lane 카드 + 집중 모드) |
| 3 | `TeamMatrixGrid.jsx` | 대규모 수정 (Lane 카드만, focusMode 없음) |

---

## 검증 절차

전체 완료 후 `npm run build` + spec QA:
- 개인: Lane 카드, sticky 헤더(카테고리만), today tint, 집중 모드 토글, 2열 배치, DnD 비활성
- 팀: Lane 카드, sticky 팀원 헤더, 기존 DnD
- 접힌 Lane: 카테고리별 dot+건수 요약
- localStorage: `matrixFocusMode` 저장/복원
- 기존 뷰 (주간, 타임라인) 회귀 없음
