# Phase 12f Diff Plan — 뷰 통합 재설계 + 카드 grid 레이아웃

> 작성일: 2026-04-14
> 기준: `12f-spec-v2.md` (확정)
> 상태: 리뷰 반영 v2

## 리뷰 반영 (v1 → v2)

| 이슈 | 해결 |
|------|------|
| [C1] SortableContext 누락 | Step 5: TeamMatrixGrid에서 `<SortableContext>` → `<ProjectGridLayout>` 감싸기 |
| [C2] milestones 선언 누락 | Step 6: `const milestones = useStore(s => s.milestones)` 추가 |
| [C3] Timeline DndContext 충돌 | Step 8: DndContext를 타임라인 분기 안으로 이동 |
| [W1] editingMsId 등 local state | ProjectLaneCard 내부 local state로 이전 (카드 단위 독립) |
| [W3] CompactMilestoneTab orphaned | Step 9에서 수정 불필요 가능, grep 확인 후 결정 |
| [W5] groupByOwner→groupBy 변환 | Step 5에 `groupBy={groupByOwner ? 'owner' : 'milestone'}` 명시 |

---

## 0. 전제 요약

- DB 변경 없음
- 14 R-ATOMIC 커밋
- 핵심 신규: ProjectLaneCard.jsx + ProjectGridLayout.jsx
- 핵심 재작성: PersonalMatrixGrid, TeamMatrixGrid, UnifiedProjectView
- 핵심 제거: focusMode, pill bar, BacklogPanel(프로젝트 뷰), 상단 뷰 토글, 12c B안 양쪽 출현

---

## Step 1: ProjectLaneCard 추출 (12f-1)

**파일**: `src/components/shared/ProjectLaneCard.jsx` (신규)

TeamMatrixGrid.jsx의 Lane 카드 구조(line 209-287 외곽 + MsGroupView + OwnerGroupView + TeamTaskRow + DashedSlot + getMemberInfo)를 독립 파일로 추출.

**Props** (spec §3-1-a):
- 데이터: `project, tasks, milestones, members, memberColorMap`
- 모드: `mode ('team'|'personal'|'project'), groupBy ('milestone'|'owner'), filter ({ today })`
- 잘라내기: `truncate ({ tasksPerGroup } | null), expanded, onToggleExpand`
- 접기: `collapsed, onToggleCollapse`
- DnD: `dragHandleProps`

**Store 접근** (I1): 카드 내부에서 useStore 직접 호출:
```js
const updateTask = useStore(s => s.updateTask)
const addTask = useStore(s => s.addTask)
const toggleDone = useStore(s => s.toggleDone)
const openDetail = useStore(s => s.openDetail)
const addMilestoneInProject = useStore(s => s.addMilestoneInProject)
const storeToggleCollapse = useStore(s => s.toggleCollapse)
const openModal = useStore(s => s.openModal)
const collapseState = useStore(s => s.collapseState)
```

**모드별 차이** (spec §3-1-c):
- `team`: 모든 task, 담당자 배지, 참여자 칩
- `personal`: 현재 사용자 task만 (props로 이미 필터됨), 담당자 배지 숨김, 참여자 칩 숨김
- `project`: 모든 task, 담당자 배지, 참여자 칩, truncate=null, 확장 버튼 숨김

**내부 컴포넌트**: MsGroupView, OwnerGroupView, TeamTaskRow, DashedSlot을 모두 같은 파일 안에 포함 (또는 별도 분리).

**커밋 1에서는**: TeamMatrixGrid.jsx가 `import ProjectLaneCard`해서 기존 인라인 렌더 대신 사용. max-width 880 유지. **기능 동일, 리팩토링만**.

**커밋**: `feat(shared): extract ProjectLaneCard from TeamMatrixGrid (12f-1)`

---

## Step 2: ProjectGridLayout 신규 (12f-2)

**파일**: `src/components/shared/ProjectGridLayout.jsx` (신규)

```jsx
export default function ProjectGridLayout({ projects, renderCard, expandedId, onToggleExpand }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
      gap: 12,
      alignItems: 'start',
    }}>
      {projects.map(proj => (
        <div key={proj.id} style={{
          gridColumn: expandedId === proj.id ? '1 / -1' : undefined,
        }}>
          {renderCard(proj, expandedId === proj.id)}
        </div>
      ))}
    </div>
  )
}
```

- `renderCard(project, isExpanded)` — 호출자가 ProjectLaneCard 렌더
- `expandedId` + `onToggleExpand` — 한 카드만 확장 (Q3)
- 확장 시 `grid-column: 1 / -1` (I5)
- 사용처 없음 (Step 5에서 연결)

**커밋**: `feat(shared): add ProjectGridLayout with responsive grid (12f-2)`

---

## Step 3: 카드 잘라내기 로직 (12f-3)

**파일**: `src/components/shared/ProjectLaneCard.jsx` 수정

ProjectLaneCard 내부에 잘라내기 로직 추가:

```jsx
const cardRef = useRef(null)
const [isOverflowing, setIsOverflowing] = useState(false)

const isTruncated = truncate !== null
const cardMaxHeight = isTruncated && !expanded ? 'min(600px, 70vh)' : 'none'

useEffect(() => {
  if (!isTruncated || expanded) { setIsOverflowing(false); return }
  const el = cardRef.current
  if (!el) return
  setIsOverflowing(el.scrollHeight > el.clientHeight)
}, [tasks, milestones, expanded, filter, groupBy, isTruncated])
```

카드 outer div:
```jsx
<div ref={cardRef} style={{
  maxHeight: cardMaxHeight,
  overflow: 'hidden',
  position: 'relative',
  transition: 'max-height 0.2s ease',
}}>
```

Overflow indicator:
```jsx
{isOverflowing && !expanded && (
  <>
    {/* gradient fade */}
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 50,
      background: 'linear-gradient(to bottom, transparent, #fff)',
      pointerEvents: 'none',
    }} />
    {/* "+ 더 보기" button */}
    <div onClick={onToggleExpand} style={{
      position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
      fontSize: 11, padding: '4px 12px', background: '#f0efe8', borderRadius: 12,
      cursor: 'pointer', zIndex: 1,
    }}>+ 더 보기</div>
  </>
)}
```

그룹별 task slice (truncate.tasksPerGroup):
```jsx
const displayTasks = isTruncated && !expanded
  ? groupTasks.slice(0, truncate.tasksPerGroup)
  : groupTasks

const hiddenCount = groupTasks.length - displayTasks.length
// hiddenCount > 0 이면 "+ N개 더" 표시
```

**커밋**: `feat(shared): add card truncation logic with scrollHeight measurement (12f-3)`

---

## Step 4: 카드 확장 동작 (12f-4)

**파일**: `src/components/shared/ProjectLaneCard.jsx` 수정

확장 상태일 때:
- `maxHeight: 'none'`
- 모든 그룹 + 모든 task 표시 (limit 해제)
- 카드 우상단에 "접기" 버튼:
```jsx
{expanded && onToggleExpand && (
  <button onClick={onToggleExpand} style={{
    position: 'absolute', top: 8, right: 8, fontSize: 11,
    padding: '2px 8px', background: '#f0efe8', borderRadius: 6,
    border: 'none', cursor: 'pointer', zIndex: 2,
  }}>접기 ▲</button>
)}
```

**커밋**: `feat(shared): add card expand/collapse with full-width row (12f-4)`

---

## Step 5: TeamMatrixGrid → ProjectGridLayout 래핑 (12f-5)

**파일**: `src/components/views/grid/grids/TeamMatrixGrid.jsx`

기존 max-width 880 + 1열 구조 → ProjectGridLayout으로 교체:

```jsx
import ProjectGridLayout from '../../../shared/ProjectGridLayout'

const [expandedId, setExpandedId] = useState(null)

return (
  <div>
    <Header groupBy={groupBy} onToggle={...} />
    <ProjectGridLayout
      projects={projects}
      expandedId={expandedId}
      onToggleExpand={(pid) => setExpandedId(prev => prev === pid ? null : pid)}
      renderCard={(proj, isExpanded) => (
        <SortableLaneCard projId={proj.id} section="team">
          {({ attributes, listeners }) => (
            <ProjectLaneCard
              project={proj}
              tasks={tasks.filter(t => t.projectId === proj.id && t.teamId === currentTeamId && !t.done && !t.deletedAt)}
              milestones={milestones.filter(m => m.project_id === proj.id)}
              members={members}
              memberColorMap={memberColorMap}
              mode="team"
              groupBy={groupBy}
              truncate={{ tasksPerGroup: 3 }}
              expanded={isExpanded}
              onToggleExpand={() => setExpandedId(prev => prev === proj.id ? null : proj.id)}
              collapsed={collapsed[proj.id]}
              onToggleCollapse={() => toggleProjectCollapse(proj.id)}
              dragHandleProps={{ ...attributes, ...listeners }}
            />
          )}
        </SortableLaneCard>
      )}
    />
  </div>
)
```

기존 Lane 렌더링 인라인 코드 **완전 제거** (Step 1에서 추출한 것이므로).
기존 `max-width: 880` 제거.

**커밋**: `feat(team-todo): wrap TeamMatrixGrid with ProjectGridLayout (12f-5)`

---

## Step 6: PersonalMatrixGrid 재작성 (12f-6)

**파일**: `src/components/views/grid/grids/PersonalMatrixGrid.jsx` — **전면 재작성**

today/next/later 3컬럼 + pill bar + focusMode 전부 제거.

```jsx
export default function PersonalMatrixGrid({ projects, myTasks, collapsed, toggleCollapse, ... }) {
  const [todayFilter, setTodayFilter] = useState(() =>
    localStorage.getItem('personalTodayFilter') !== 'false'
  )
  const [expandedId, setExpandedId] = useState(null)
  const userId = getCachedUserId()

  const toggleTodayFilter = useCallback(() => {
    setTodayFilter(prev => {
      const next = !prev
      localStorage.setItem('personalTodayFilter', String(next))
      return next
    })
  }, [])

  // today 필터 적용 후 프로젝트별 task
  const getFilteredTasks = (projId) => {
    let tasks = myTasks.filter(t => t.projectId === projId && !t.done && !t.deletedAt)
    if (todayFilter) tasks = tasks.filter(t => t.category === 'today')
    return tasks
  }

  const allFilteredCount = projects.reduce((sum, p) => sum + getFilteredTasks(p.id).length, 0)

  return (
    <div>
      {/* 헤더: today 필터 토글 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', marginBottom: 12 }}>
        <button onClick={toggleTodayFilter} style={{
          padding: '4px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
          background: todayFilter ? 'rgba(229,62,62,0.08)' : 'transparent',
          color: todayFilter ? '#991B1B' : '#888780',
          fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
        }}>
          ● today 필터 {todayFilter ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* today 필터 빈 상태 (I4) */}
      {todayFilter && allFilteredCount === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: '#888780' }}>
          <div style={{ fontSize: 14, marginBottom: 12 }}>오늘 할 일이 없습니다.</div>
          <button onClick={toggleTodayFilter} style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid #e8e6df',
            background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
          }}>모든 task 보기</button>
        </div>
      )}

      {/* 카드 grid */}
      {!(todayFilter && allFilteredCount === 0) && (
        <ProjectGridLayout
          projects={projects}
          expandedId={expandedId}
          onToggleExpand={(pid) => setExpandedId(prev => prev === pid ? null : pid)}
          renderCard={(proj, isExpanded) => (
            <SortableLaneCard projId={proj.id} section="personal" disabled={false}>
              {({ attributes, listeners }) => (
                <ProjectLaneCard
                  project={proj}
                  tasks={getFilteredTasks(proj.id)}
                  milestones={milestones.filter(m => m.project_id === proj.id && m.owner_id === userId)}
                  members={[]}
                  memberColorMap={{}}
                  mode="personal"
                  groupBy="milestone"
                  filter={{ today: todayFilter }}
                  truncate={{ tasksPerGroup: 3 }}
                  expanded={isExpanded}
                  onToggleExpand={() => setExpandedId(prev => prev === proj.id ? null : proj.id)}
                  collapsed={collapsed[proj.id]}
                  onToggleCollapse={() => toggleCollapse(proj.id)}
                  dragHandleProps={{ ...attributes, ...listeners }}
                />
              )}
            </SortableLaneCard>
          )}
        />
      )}
    </div>
  )
}
```

focusMode prop 수신 제거. CellContent/DroppableCell import 제거. CATS 상수 사용 제거.

**커밋**: `feat(personal): rewrite PersonalMatrixGrid with ProjectLaneCard + today filter (12f-6)`

---

## Step 7: 12a focusMode 제거 (12f-7)

**파일**: `src/components/views/UnifiedGridView.jsx`

제거:
- `focusMode` state (line 36-46)
- `toggleFocusMode` callback
- `focusModeActive` derived state
- PersonalMatrixGrid에 `focusMode`/`onToggleFocusMode` prop 전달 코드
- DndContext 조건부 분기 (focusModeActive) — DndContext를 항상 렌더로 통일
- localStorage `matrixFocusMode` 읽기 제거

**커밋**: `refactor: remove 12a focus mode + pill bar (12f-7)`

---

## Step 8: 프로젝트 메인뷰 재작성 (12f-8)

**파일**: `src/components/project/UnifiedProjectView.jsx`

MsTaskTreeMode + BacklogPanel + DndContext(9c) → ProjectLaneCard 단일 전체 화면:

```jsx
{rightMode === '전체 할일' ? (
  <ProjectLaneCard
    project={project}
    tasks={projectTasks}
    milestones={projMilestones}
    members={blMembers}
    memberColorMap={memberColorMap}
    mode="project"
    groupBy={groupBy}
    truncate={null}
    // expanded, onToggleExpand 미전달 (project 모드)
    collapsed={false}
    onToggleCollapse={() => {}}
  />
) : (
  /* 기존 Timeline 코드 유지 */
)}
```

헤더에 그룹 모드 토글 추가 (Q13):
```jsx
{rightMode === '전체 할일' && (
  <GroupByToggle value={groupBy} onChange={setGroupBy} />
)}
```

MsTaskTreeMode import 제거. BacklogPanel import 제거. 9c DndContext 분기 제거.

**커밋**: `feat(project): rewrite UnifiedProjectView with ProjectLaneCard mode=project (12f-8)`

---

## Step 9: BacklogPanel 제거 (12f-9)

**파일**: `UnifiedProjectView.jsx` (Step 8에서 이미 제거), `CompactMilestoneTab.jsx`

CompactMilestoneTab에서 BacklogPanel 관련 코드 제거:
- `import BacklogPanel` 제거
- BacklogPanel 렌더 블록 제거
- `wideEnough` state 관련 코드 정리 (BacklogPanel용이었음)

**커밋**: `refactor: remove BacklogPanel from project views (12f-9)`

---

## Step 10: 상단 뷰 토글 제거 (12f-10)

**파일**: `src/components/views/UnifiedGridView.jsx`

- `<Pill items={[매트릭스, 주간 플래너]}` 제거 (line ~419)
- `view` state + `setView` 제거 — `initialView` prop만 사용
- 조건부 렌더 (`view === 'matrix'`, `view === 'weekly'`)를 `initialView` 기반으로 변경

> `initialView`는 이미 `scope`처럼 사이드바에서 결정됨.

**커밋**: `refactor: remove top view toggles from grid views (12f-10)`

---

## Step 11: MS tint 강화 (12f-11)

**파일**: `src/components/views/grid/cells/MilestoneRow.jsx`

```diff
-  ? (hover && interactive ? hexToRgba(accentColor, 0.22) : hexToRgba(accentColor, 0.13))
+  ? (hover && interactive ? hexToRgba(accentColor, 0.25) : hexToRgba(accentColor, 0.15))
```

**커밋**: `style(milestone): strengthen MS tint 0.13→0.15 (12f-11)`

---

## Step 12: 아바타 컬러 버그 수정 (12f-12)

**파일**: ProjectLaneCard.jsx (또는 TeamMatrixGrid.jsx)

members 로드 보장: memberColorMap이 빈 맵일 때 fallback 개선.

```jsx
// memberColorMap 구축 시 members가 비어있으면 빈 맵 반환하되,
// MiniAvatar에 전달하는 color가 undefined 대신 항상 값이 있도록:
const mColor = memberColorMap[userId]?.dot || '#888'
```

실제 원인은 members 비동기 로드 완료 전 렌더. Step 1의 ProjectLaneCard에서 members가 빈 배열이면 참여자 칩을 렌더하지 않도록 가드 추가.

**커밋**: `fix(team): resolve gray avatar by ensuring members loaded before colorMap (12f-12)`

---

## Step 13: B안 부담당 단순화 (12f-13)

**파일**: `src/components/shared/ProjectLaneCard.jsx` (OwnerGroupView 내부)

12c B안 양쪽 출현 제거 (I6):
- `secondary` 배열 제거 (primary만 유지)
- sub-section 카운트: 정담당만 (`Edmond 4`)
- 부담당 표시: 정담당 task 행에 mini badge `+부 EdmondName`
- React key suffix `-secondary` 제거

**커밋**: `refactor(team-todo): simplify B-view secondary to badge-only (12f-13)`

---

## Step 14: Cleanup (12f-14)

- orphaned imports 정리 (CellContent, DroppableCell, InlineMsAdd 등 — PersonalMatrixGrid에서 더 이상 미사용)
- localStorage `matrixFocusMode` 키 — 읽기 시 무시 (삭제 코드 추가 선택)
- `_defaultCollapseState`에서 사용하지 않는 키 정리
- deprecated 스냅샷 키 방어 (I10)

**커밋**: `chore: cleanup orphaned imports + localStorage keys + snapshot defaults (12f-14)`

---

## 작업 순서 요약

| Step | 파일 | 유형 | 의존성 |
|------|------|------|--------|
| 1 | ProjectLaneCard.jsx (신규) + TeamMatrixGrid.jsx | 추출 | 없음 |
| 2 | ProjectGridLayout.jsx (신규) | 신규 | 없음 |
| 3 | ProjectLaneCard.jsx | 수정 | Step 1 |
| 4 | ProjectLaneCard.jsx | 수정 | Step 3 |
| 5 | TeamMatrixGrid.jsx | 수정 | Step 1, 2 |
| 6 | PersonalMatrixGrid.jsx | 재작성 | Step 1, 2 |
| 7 | UnifiedGridView.jsx | 수정 | Step 6 |
| 8 | UnifiedProjectView.jsx | 재작성 | Step 1 |
| 9 | CompactMilestoneTab.jsx | 수정 | Step 8 |
| 10 | UnifiedGridView.jsx | 수정 | Step 7 |
| 11 | MilestoneRow.jsx | 수정 | 없음 |
| 12 | ProjectLaneCard.jsx | 수정 | Step 1 |
| 13 | ProjectLaneCard.jsx | 수정 | Step 1 |
| 14 | 여러 파일 | 정리 | 전체 |

---

## 검증 절차

각 Step 후 `npm run build` 통과
최종: spec §8 QA 체크리스트 전체 (ProjectLaneCard, ProjectGridLayout, 잘라내기, 확장, 개인/팀/프로젝트 뷰, 제거 확인, 회귀, edge cases)
