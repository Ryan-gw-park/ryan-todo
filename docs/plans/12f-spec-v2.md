# Phase 12f Spec v2 — 뷰 통합 재설계 + 카드 grid 레이아웃

> 작성일: 2026-04-14
> 상태: **확정 v2** (12개 issue 권장안 반영)
> 선행: `12f-recon.md`, Phase 12a~12d, Hotfix-01
> 변경 이력: v1 → v2 — store 접근 모델 명시, max-height/측정 방식 재설계, project 모드 truncate=null, 확장 시 full-width row, 12c B안 정밀화, 9c 대체 동선, today 필터 빈 상태, R-ATOMIC 명시

---

## 1. 목표

세 핵심 뷰(개인 매트릭스, 팀 할일뷰, 프로젝트 메인뷰)를 **ProjectLaneCard** + **ProjectGridLayout**으로 통합. 카드 grid 레이아웃으로 한 화면 비교, 카드 내부 그룹+task 잘라내기, 클릭 시 full-width 확장.

---

## 2. 확정 결정사항

### 2-1. 기본 결정 (D1~D12)

| # | 항목 | 결정 |
|---|------|------|
| D1 | today/next/later | today 필터로 축소 |
| D2 | 범위 | 단일 phase 12f |
| D3 | 프로젝트 메인뷰 | ProjectLaneCard 단일 카드 (잘라내기 없음) |
| D4 | "기타" vs MS | MS first-class 유지 |
| D5 | 백로그 | 팀/개인/프로젝트 뷰에서 제거 (주간 MsBacklogSidebar 유지) |
| D6 | 상단 뷰 토글 | 팀/개인 뷰 제거, 프로젝트 뷰는 유지(전체 할일/타임라인) |
| D7 | 공용 컴포넌트 | ProjectLaneCard + ProjectGridLayout |
| D8 | 집중 모드 | 폐기 |
| D9 | MS 추가 버튼 | dashed 슬롯 유지 |
| D10 | MS tint | 0.13 → 0.15 / 0.22 → 0.25 |
| D11 | 아바타 컬러 버그 | members 로드 보장 후 memberColorMap 구축 |
| D12 | 목록형 토글 | 라벨 정리 |

### 2-2. 카드 grid 결정 (Q1~Q15)

| # | 항목 | v1 | v2 (확정) |
|---|------|-----|-----------|
| Q1 | 카드 max-height | 500px | **`min(600px, 70vh)`** ⚠️ 변경 (Issue 8) |
| Q2 | 그룹별 task limit | 3개 | 3개 |
| Q3 | 카드 확장 | 한 카드만 | 한 카드만 |
| Q4 | 그룹 잘라내기 순서 | 마지막 sort_order부터 | 마지막 sort_order부터 |
| Q5 | "기타" 섹션 위치 | 항상 마지막 | 항상 마지막 (잘림 시 최우선) |
| Q6 | 반응형 grid | minmax(320px, 1fr) | minmax(320px, 1fr) |
| Q7 | gap | 12px | 12px |
| Q8 | today 필터 기본 | ON | ON |
| Q9 | OFF 시 범위 | 모든 task | 모든 task |
| Q10 | 개인 grid 컬럼 | 반응형 1-2열 | 반응형 1-2열 (auto-fit minmax 동일) |
| Q11 | 개인 카드 잘라내기 | 적용 | 적용 |
| Q12 | 프로젝트 뷰 토글 | 유지 | 유지 |
| Q13 | 프로젝트 뷰 그룹 토글 | 노출 | 노출 |
| Q14 | 주간 MsBacklogSidebar | 유지 | 유지 |
| Q15 | 카드 확장 localStorage | 미저장 | 미저장 |

### 2-3. v2 추가 결정 (Issue 1~12)

| # | 항목 | 결정 |
|---|------|------|
| **I1** | **ProjectLaneCard store 접근** | **카드 내부에서 useStore 직접 호출**. props는 데이터(project, tasks, milestones, members, memberColorMap)와 모드(mode, groupBy, filter, truncate, expanded)만. action(updateTask, addTask, addMilestone, toggleCollapse, openModal)은 카드 내부에서 store 호출. prop drilling 최소화. |
| **I2** | **잘라내기 측정 방식 (Issue 9 통합)** | **`scrollHeight > clientHeight` 측정** (휴리스틱 폐기). useRef + useEffect 1회 측정. 정확하고 단순. |
| **I3** | **project 모드 truncate** | **`truncate={null}`** — 잘라내기 로직 비활성. project 모드에서는 expanded state 자체가 의미 없음 (확장/접기 버튼 숨김). |
| **I4** | **today 필터 빈 상태** | today task 0개 + today 필터 ON일 때 "오늘 할 일이 없습니다. [모든 task 보기]" 버튼 표시. 클릭 시 필터 OFF. |
| **I5** | **카드 확장 시 grid 재배치** | **확장된 카드는 full-width row** — `grid-column: 1 / -1`. 확장 카드가 자기 row를 통째로 차지, 시선 자연스럽게 집중. 다른 카드는 다음 row로 밀려남. |
| **I6** | **12c B안 부담당 정밀화** | 양쪽 출현 폐기. sub-section 카운트는 정담당만 (`Edmond 4`, `+부 N` 표시 안 함). 부담당 task는 정담당의 task 행에 mini badge (`+부 EdmondName`)로만 표시. React key suffix `-secondary` 제거. |
| **I7** | **9c BacklogPanel→MS DnD 대체** | DetailPanel에서 task의 keyMilestoneId 변경으로 일원화. 카드 내부 "기타→MS 그룹" DnD는 12f 범위 외 (v2 검토). |
| **I8** | **R-ATOMIC 1번/5번 커밋 분리 명시** | 1번: ProjectLaneCard.jsx 생성 + TeamMatrixGrid 내부에서 import 사용 (max-width 880 유지). 5번: TeamMatrixGrid가 ProjectGridLayout으로 wrap (max-width 제거, grid 반응형). |
| **I9** | **카드 overflow 처리** | `overflow: hidden` (스크롤 없음). 잘림은 gradient fade로 시각적 처리. 클릭 시 확장. |
| **I10** | **스냅샷 호환** | 12a `matrixFocusMode`, 12c `teamMatrixGroupByOwner` localStorage 키 정리. 구버전 스냅샷의 `focusMode`, `personalMatrixView` 등 deprecated 키는 read 시 무시 (방어적). |

---

## 3. 기능 범위

### 3-1. ProjectLaneCard (공용 카드)

12c TeamMatrixGrid 내부 Lane 카드를 독립 추출.

#### 3-1-a. Props

```js
{
  // 데이터 (props로 전달)
  project,            // Project
  tasks,              // Task[] — 이미 필터된 task
  milestones,         // Milestone[]
  members,            // Member[]
  memberColorMap,     // { userId: color }
  
  // 모드
  mode,               // 'team' | 'personal' | 'project'
  groupBy,            // 'milestone' | 'owner'
  filter,             // { today?: boolean }
  
  // 잘라내기
  truncate,           // { tasksPerGroup: number } | null
                      // null이면 잘라내기 비활성 (project 모드)
  expanded,           // boolean — 확장 상태
  onToggleExpand,     // () => void
  
  // 접기/펼치기 (Lane 자체)
  collapsed,          // boolean
  onToggleCollapse,   // () => void
  
  // DnD (12b 프로젝트 순서)
  dragHandleProps,    // { attributes, listeners }
}
```

#### 3-1-b. Store 접근 (I1)

카드 내부에서 `useStore` 직접 호출:
```js
const updateTask = useStore(s => s.updateTask)
const addTask = useStore(s => s.addTask)
const addMilestoneInProject = useStore(s => s.addMilestoneInProject)
const toggleCollapse = useStore(s => s.toggleCollapse)
const openModal = useStore(s => s.openModal)
const editingId = useStore(s => s.editingId)
const setEditingId = useStore(s => s.setEditingId)
// ... 8개 store 직접 접근
```

action props로 받지 않음. 데이터는 props (테스트 가능), action은 store (편의).

#### 3-1-c. 모드별 차이

| 모드 | 표시 task | 담당자 배지 | 참여자 칩 | 잘라내기 | 확장 버튼 |
|------|----------|------------|----------|---------|----------|
| `team` | 모든 task | ✓ | ✓ | ✓ | ✓ |
| `personal` | 현재 사용자 task만 | ✗ | ✗ | ✓ | ✓ |
| `project` | 모든 task | ✓ | ✓ | ✗ (null) | ✗ |

### 3-2. ProjectGridLayout (wrapper)

#### 3-2-a. Props

```js
{
  projects,           // Project[]
  cardProps,          // (project) => CardProps
                      //   각 카드별 props 생성 함수
  // 확장 state는 wrapper 내부 관리
}
```

#### 3-2-b. CSS

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 12px;
  align-items: start;
}

.card.expanded {
  grid-column: 1 / -1;  /* I5: full-width row */
}
```

#### 3-2-c. 카드 확장 state 관리

```js
const [expandedId, setExpandedId] = useState(null)

const handleToggleExpand = (projectId) => {
  setExpandedId(prev => prev === projectId ? null : projectId)
}
```

- 한 카드만 확장 (Q3, I5)
- 다른 카드 확장 시 이전 카드 자동 접힘
- localStorage 미저장 (Q15)
- 페이지 재진입 시 모든 카드 접힌 상태

### 3-3. 카드 잘라내기 로직 (I2, I9)

#### 3-3-a. 단계

1. **그룹별 task slice**: `truncate.tasksPerGroup` (3)으로 제한
2. **각 그룹 끝 "+ N개 더"**: 그룹의 task가 limit 초과 시
3. **CSS max-height 적용**: `max-height: min(600px, 70vh)` (Q1)
4. **overflow hidden**: 스크롤 없이 시각적 잘림 (I9)
5. **scrollHeight 측정**: `el.scrollHeight > el.clientHeight` 시 잘림 발생 (I2)
6. **잘림 시 카드 하단 안내**: "+ N개 그룹 더" overlay + gradient fade
7. **expanded === true**: max-height `none`, 모든 그룹/task 표시, full-width row

#### 3-3-b. scrollHeight 측정 (I2)

```js
const cardRef = useRef(null)
const [isOverflowing, setIsOverflowing] = useState(false)

useEffect(() => {
  const el = cardRef.current
  if (!el) return
  setIsOverflowing(el.scrollHeight > el.clientHeight)
}, [tasks, milestones, expanded, filter, groupBy])
```

- 카드 mount + 데이터/필터 변경 시 1회 측정
- ResizeObserver 불필요 (overhead 회피)
- `isOverflowing === true` 이면 "+ N개 그룹 더" 안내 표시
- N의 정확한 계산은 휴리스틱: `숨겨진 그룹 수 = 전체 그룹 - 보이는 그룹 (CSS clip 기준)`. 부정확해도 OK — "더 있다"는 신호만 전달.
- **권장: 단순 "+ 더 보기"** (숫자 없이) 또는 "+ N 더 보기" (N은 단순 카운트)

#### 3-3-c. CSS

```css
.card {
  position: relative;
  max-height: min(600px, 70vh);
  overflow: hidden;
  transition: max-height 0.2s ease;
}

.card.expanded {
  max-height: none;
  grid-column: 1 / -1;
}

.card.is-overflowing::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 50px;
  background: linear-gradient(to bottom, transparent, var(--color-background-primary));
  pointer-events: none;
}

.card-more-overlay {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  padding: 4px 12px;
  background: var(--color-background-secondary);
  border-radius: 12px;
  cursor: pointer;
  z-index: 1;
}
```

#### 3-3-d. project 모드 (I3)

```jsx
<ProjectLaneCard
  mode='project'
  truncate={null}      // 잘라내기 비활성
  // expanded prop 무시
  // 확장 버튼 숨김
/>
```

내부 처리:
```jsx
const isTruncated = truncate !== null
const showExpandButton = isTruncated
const cardMaxHeight = isTruncated ? 'min(600px, 70vh)' : 'none'
```

### 3-4. 개인 매트릭스 재작성

#### 3-4-a. 구조 변경

- today/next/later 3컬럼 **폐기**
- 집중 모드 (focusMode, 2열 Lane) **폐기**
- pill bar **폐기**

#### 3-4-b. 새 구조

```jsx
<PersonalMatrixGrid>
  <Header>
    <DateLabel />
    <TodayFilterToggle value={todayFilter} onChange={setTodayFilter} />
  </Header>
  <ProjectGridLayout
    projects={personalProjects}
    cardProps={(project) => ({
      project,
      tasks: filterPersonalTasks(project, todayFilter, currentUserId),
      // ... 기타 props
      mode: 'personal',
      groupBy: 'milestone',  // 개인은 항상 milestone 그룹
      filter: { today: todayFilter },
      truncate: { tasksPerGroup: 3 },
    })}
  />
</PersonalMatrixGrid>
```

#### 3-4-c. today 필터

- 기본값: ON (Q8)
- localStorage `personalTodayFilter` 저장
- 필터 ON: `task.category === 'today'`
- 필터 OFF: 모든 task (category 무관)

#### 3-4-d. today 필터 빈 상태 (I4)

```jsx
{todayFilter && filteredTasks.length === 0 && (
  <EmptyState>
    오늘 할 일이 없습니다.
    <Button onClick={() => setTodayFilter(false)}>
      모든 task 보기
    </Button>
  </EmptyState>
)}
```

- today 필터 ON + 표시할 task 0개일 때만
- 빈 화면 대신 명확한 안내 + 액션 버튼
- 사용자가 "내 task가 없네?"로 오해 방지

### 3-5. 팀 할일뷰 리팩토링

#### 3-5-a. 구조 변경

- 기존 12c TeamMatrixGrid의 Lane 렌더링 코드 → ProjectLaneCard로 위임
- max-width 880px → grid 반응형 (Issue 8 grid wrapper)
- 그룹 모드 토글 (목록형/담당자별) — 헤더에 위치

#### 3-5-b. 새 구조

```jsx
<TeamMatrixGrid>
  <Header>
    <DateLabel />
    <GroupByToggle value={groupBy} onChange={setGroupBy} />
  </Header>
  <ProjectGridLayout
    projects={teamProjects}
    cardProps={(project) => ({
      project,
      tasks: project.tasks,
      // ...
      mode: 'team',
      groupBy,  // 'milestone' | 'owner'
      truncate: { tasksPerGroup: 3 },
    })}
  />
</TeamMatrixGrid>
```

#### 3-5-c. 12c B안 부담당 정밀화 (I6)

**제거되는 동작:**
- 부담당 task의 양쪽 sub-section 출현
- React key suffix `-secondary`
- 부쪽 sub-section의 muted 스타일
- 부쪽 checkbox read-only + 정 sub-section 점프 동작

**유지/수정되는 동작:**
- sub-section 헤더 카운트: 정담당만 (`Edmond 4`)
- `+부 N` 표시 안 함 (양쪽 출현이 없으므로 부쪽 카운트도 의미 없음)
- 부담당 표시 위치: 정담당의 task 행 우측 mini badge (`+부 EdmondName`)
- 미배정 sub-section: 정담당이 NULL인 task만

**시각 예시:**
```
Edmond 4
  □ MM                                          [+부 ash]
  □ 조직개편 사항 적용
  □ 규정 개정
  □ 본사/자회사 HR 데이터 수집
ash.kim 6
  □ Project Pipeline                            [+부 Ryan]
  ...
```

#### 3-5-d. 12c 5컬럼 grid 코드 완전 제거

- TeamMatrixGrid의 기존 5컬럼 grid 관련 모든 코드 제거
- DELETE-5 cascade: import, caller, props, deps, types

### 3-6. 프로젝트 메인뷰 재작성

#### 3-6-a. 구조 변경

- MsTaskTreeMode **폐기**
- BacklogPanel **폐기**
- "전체 할일 | 타임라인" 토글 **유지** (Q12)

#### 3-6-b. 새 구조

```jsx
<UnifiedProjectView>
  <Header>
    <ProjectInfo>● ABI 코리아 · 프로젝트 오너: Ryan</ProjectInfo>
    <ViewModeToggle value={rightMode} options={['전체 할일', '타임라인']} />
    {rightMode === '전체 할일' && (
      <GroupByToggle value={groupBy} onChange={setGroupBy} />
    )}
  </Header>
  
  {rightMode === '전체 할일' ? (
    <ProjectLaneCard
      project={project}
      tasks={project.tasks}
      mode='project'
      groupBy={groupBy}
      truncate={null}        // I3: 잘라내기 비활성
      // expanded 무시
      // 확장 버튼 숨김
    />
  ) : (
    <Timeline ... />          // 기존 Timeline 코드 유지
  )}
</UnifiedProjectView>
```

#### 3-6-c. project 모드 카드 스타일

- max-height 없음 (`truncate={null}`)
- 카드 border 없음? 또는 옅게? — spec에서 **border 있음 + 패딩** 권장 (다른 모드와 일관)
- 카드가 viewport를 채움
- "접기/확장" 버튼 없음

#### 3-6-d. 9c DnD 폐기 (I7)

- BacklogPanel→MS 드래그 워크플로우 폐기
- 대체 동선: DetailPanel에서 task의 keyMilestoneId 변경
- 카드 내부 "기타→MS 그룹" DnD는 12f 범위 외

### 3-7. 상단 토글 제거

- UnifiedGridView: "매트릭스 | 주간 플래너" Pill 제거
- 사이드바 메뉴가 유일한 진입점
- UnifiedProjectView: "전체 할일 | 타임라인" 유지 (Q12)

### 3-8. 백로그 제거

- BacklogPanel: UnifiedProjectView + CompactMilestoneTab에서 제거
- MsBacklogSidebar: 유지 (주간 플래너 전용)
- BacklogPanel 고유 기능(검색, 필터)은 폐기 — "기타" 섹션이 부분적 대체

### 3-9. 12a 코드 제거

- focusMode state (UnifiedGridView + PersonalMatrixGrid)
- 2열 Lane 레이아웃
- pill bar
- localStorage `matrixFocusMode` (I10)
- `rectSortingStrategy` import (focusMode 전용)
- 스냅샷 deprecated 키 방어 (I10)

### 3-10. 작은 개선

- MS tint: MilestoneRow alpha 0.13 → 0.15, hover 0.22 → 0.25 (D10)
- 아바타 컬러 버그: members 로드 보장 후 memberColorMap 구축 (D11)

---

## 4. UI 사양

### 4-1. 팀 할일뷰 카드 grid

```
[목록형 ▾]                              ↻

┌─ 팀 개별 과제 ─────┐ ┌─ 26Q1 이사회 ──────┐ ┌─ ABI 코리아 ──────┐
│ ▾ ● 팀 개별 과제 11│ │ ▾ ● 26Q1 이사회 15 │ │ ▸ ● ABI 코리아  0 │
│ ┃ MS 그룹 1    3/5 │ │ ┃ P&L          0/1 │ └──────────────────┘
│   □ task 1    ⓡ    │ │   □ P&L 비용  ⓔ    │
│   □ task 2    ⓔ    │ │ ┃ Pipeline    0/1  │ ┌─ 일본법인 ────────┐
│   □ task 3    ⓐ    │ │   □ Project Pipeline│ │ ▾ ● 일본법인  2  │
│   + 2개 더         │ │ ┃ 안건         0/6  │ │ 기타 ─────       │
│ ┃ MS 그룹 2    1/2 │ │   □ Engineering MS │ │   □ 일본삼성  ⓐ  │
│   □ task 4    ⓡ    │ │   □ Headcounts     │ │   □ 중국SCM  ⓐ   │
│   + 추가           │ │   □ Agenda         │ └──────────────────┘
│ + 마일스톤 추가    │ │   + 3개 더         │
│ 기타 ──────        │ │ ░░░░ gradient ░░░░ │
│   □ ARM 공문  ⓐ    │ │     + 더 보기      │
│ ░░░░ gradient ░░░░ │ └──────────────────┘
│     + 더 보기      │
└────────────────────┘

(반응형: 화면 폭에 따라 1/2/3열 자동)
```

### 4-2. 카드 확장 시 (full-width row, I5)

```
┌─ 팀 개별 과제 ─────┐ ┌─ 26Q1 이사회 ──────┐ ┌─ ABI 코리아 ──────┐
│ ▾ ● 팀 개별 과제 11│ │ ▾ ● 26Q1 이사회 15 │ │ ▸ ● ABI 코리아  0 │
│ ...                │ │ ...                │ └──────────────────┘
└────────────────────┘ └──────────────────┘

┌─ 일본법인 (확장) ──────────────────────────────────────────────┐
│ ▾ ● 일본법인  2                                       [접기 ▲] │
│ 기타 ──────                                                    │
│   □ 일본삼성 DSJ 미팅 F/U                                  ⓐ a │
│   □ 중국SCM 확인필요                                       ⓐ a │
│ + 마일스톤 추가                                                │
└────────────────────────────────────────────────────────────────┘

┌─ BIS ─────────────┐ ┌─ 26년 NDR ──────┐
│ ...               │ │ ...             │
└───────────────────┘ └─────────────────┘
```

확장 카드가 자기 row를 통째로 차지. 다른 카드는 다음 row로 밀려남.

### 4-3. 개인 매트릭스 today 필터 빈 상태 (I4)

```
[●━━ today 필터 ON]

  ┌──────────────────────────────────┐
  │                                  │
  │    오늘 할 일이 없습니다.          │
  │                                  │
  │    [모든 task 보기]                │
  │                                  │
  └──────────────────────────────────┘
```

### 4-4. 12c B안 부담당 표시 (I6)

```
sub-section 헤더: Edmond 4

  □ MM                                          [+부 ash]
  □ 조직개편 사항 적용
  □ 규정 개정
  □ 본사/자회사 HR 데이터 수집
```

부쪽 sub-section에는 출현 안 함. 정 sub-section에서만 mini badge로 표시.

---

## 5. 영향 파일

### 신규
| 파일 | 역할 |
|------|------|
| `src/components/shared/ProjectLaneCard.jsx` | 공용 프로젝트 카드 |
| `src/components/shared/ProjectGridLayout.jsx` | 카드 grid wrapper |

### 대규모 수정
| 파일 | 변경 |
|------|------|
| `PersonalMatrixGrid.jsx` | 전면 재작성 — today 필터 + ProjectGridLayout + 빈 상태 |
| `TeamMatrixGrid.jsx` | 리팩토링 — ProjectLaneCard + ProjectGridLayout 사용, 12c 5컬럼 grid 제거 |
| `UnifiedProjectView.jsx` | 재작성 — MsTaskTreeMode/BacklogPanel 폐기, ProjectLaneCard 단일 |
| `UnifiedGridView.jsx` | 상단 토글 제거, focusMode 제거 |

### 제거
| 항목 | 이유 |
|------|------|
| BacklogPanel.jsx 사용처 (UnifiedProjectView, CompactMilestoneTab) | D5 |
| focusMode 관련 코드 | D8 |
| pill bar 코드 | D8 |
| MsTaskTreeMode.jsx 사용처 | D3 (파일 보존 가능) |
| 12c B안 양쪽 출현 로직 | I6 |
| 9c BacklogPanel→MS DnD | I7 |
| localStorage `matrixFocusMode` | I10 |

### 수정
| 파일 | 변경 |
|------|------|
| `MilestoneRow.jsx` | tint alpha 0.15/0.25 (D10) |
| `useStore.js` | members 로드 후 memberColorMap 구축 보장 (D11), `_defaultCollapseState` 정리 |
| `Sidebar.jsx` | 이미 hotfix 중 수정 완료 |

---

## 6. 구현 순서 (R-ATOMIC, 14개)

| # | 커밋 | 내용 |
|---|------|------|
| 1 | `feat(shared): extract ProjectLaneCard from TeamMatrixGrid (12f-1)` | **추출만** — ProjectLaneCard.jsx 생성, TeamMatrixGrid 내부에서 import 사용. max-width 880 유지. 기능 동일. (I8) |
| 2 | `feat(shared): add ProjectGridLayout with responsive grid (12f-2)` | wrapper 신규. 사용처 없음 (단독 추가). |
| 3 | `feat(shared): add card truncation logic with scrollHeight measurement (12f-3)` | ProjectLaneCard에 잘라내기 로직 + isOverflowing 측정 (I2) + gradient fade (I9) |
| 4 | `feat(shared): add card expand/collapse with full-width row (12f-4)` | 확장 동작 + `grid-column: 1 / -1` (I5) |
| 5 | `feat(team-todo): wrap TeamMatrixGrid with ProjectGridLayout (12f-5)` | TeamMatrixGrid가 ProjectGridLayout 사용. max-width 880 → grid 반응형. (I8) |
| 6 | `feat(personal): rewrite PersonalMatrixGrid with ProjectLaneCard + today filter (12f-6)` | 개인 매트릭스 재작성, today 필터 빈 상태 안내 포함 (I4) |
| 7 | `refactor: remove 12a focus mode + pill bar (12f-7)` | 12a 코드 제거 + localStorage 키 정리 (I10) |
| 8 | `feat(project): rewrite UnifiedProjectView with ProjectLaneCard mode=project (12f-8)` | 프로젝트 메인뷰 재작성, truncate=null (I3), 9c DnD 폐기 (I7) |
| 9 | `refactor: remove BacklogPanel from project views (12f-9)` | UnifiedProjectView + CompactMilestoneTab에서 제거 |
| 10 | `refactor: remove top view toggles from grid views (12f-10)` | UnifiedGridView 상단 토글 제거 |
| 11 | `style(milestone): strengthen MS tint 0.13→0.15 (12f-11)` | D10 |
| 12 | `fix(team): resolve gray avatar by ensuring members loaded before colorMap (12f-12)` | D11 |
| 13 | `refactor(team-todo): simplify B-view secondary to badge-only (12f-13)` | I6 — 양쪽 출현 폐기, mini badge로 일원화 |
| 14 | `chore: cleanup orphaned imports + localStorage keys + snapshot defaults (12f-14)` | DELETE-5 cascade 정리, deprecated 키 방어 (I10) |

각 커밋:
- REQ-LOCK protocol
- DELETE-5 cascade 검증 (특히 7, 9, 13, 14)
- npm run build 통과

---

## 7. 위험 요소

| # | 위험 | 대응 |
|---|------|------|
| R1 | 3컬럼 제거 시 category 필드 처리 | 필드 유지, UI 분류만 중단 (recon 2-6) |
| R2 | 백로그 제거 시 주간 플래너 영향 | MsBacklogSidebar는 별도, Q14 유지 |
| R3 | focusMode 제거 시 localStorage 잔존 | I10 마이그레이션 코드 |
| R4 | ProjectLaneCard store 의존성 높음 | I1 — 카드 내부 직접 store, prop drilling 최소화 |
| R5 | 카드 잘라내기 정확도 | I2 — scrollHeight 측정, 휴리스틱 폐기 |
| R6 | 확장 시 grid 재배치 시선 흐트러짐 | I5 — full-width row, 시선 자연 집중 |
| R7 | 9c DnD 폐기 시 사용자 워크플로우 변화 | I7 — DetailPanel MS 변경으로 대체, 사용자 안내 필요 |
| R8 | 스냅샷 호환 | I10 — deprecated 키 무시 (방어적 read) |
| R9 | 12c B안 코드 제거 범위 | I6 + 13번 커밋 + DELETE-5 cascade |
| R10 | min(600px, 70vh)의 작은 화면 동작 | 70vh가 작은 화면(800px)에서 560px → 카드 적게 잘림 |
| R11 | scrollHeight 측정의 SSR/hydration 이슈 | useEffect 사용 (client only), 초기 렌더 시 isOverflowing=false |

---

## 8. QA 체크리스트

### ProjectLaneCard
- [ ] mode='team': 모든 task + 담당자 배지 + 참여자 칩
- [ ] mode='personal': 현재 사용자 task만 + 담당자 배지 숨김
- [ ] mode='project': 모든 task + 잘라내기 비활성 + 확장 버튼 숨김
- [ ] groupBy='milestone': MS 그룹 + "기타" 섹션
- [ ] groupBy='owner': 담당자 sub-section + MS 태그
- [ ] 그룹별 task 3개 + "+ N개 더"
- [ ] dashed `+ 마일스톤 추가` 슬롯 (mode != 'personal')
- [ ] store 직접 접근 (props 폭증 없음, I1)

### ProjectGridLayout
- [ ] 반응형 1/2/3열 (minmax 320px)
- [ ] gap 12px
- [ ] align-items: start (높이 불일치 OK)
- [ ] expandedId state 한 카드만
- [ ] 다른 카드 클릭 시 이전 자동 접힘

### 카드 잘라내기 (I2, I9)
- [ ] max-height: min(600px, 70vh) 적용
- [ ] overflow: hidden (스크롤 없음)
- [ ] scrollHeight > clientHeight 측정 정확
- [ ] 잘림 시 gradient fade
- [ ] "+ 더 보기" overlay 표시
- [ ] 클릭 → 카드 확장
- [ ] 확장 시 max-height: none
- [ ] 확장 시 grid-column: 1 / -1 (full-width row, I5)
- [ ] 다른 카드 위치 변화 (다음 row로 밀림)
- [ ] 접기 시 원래 상태

### project 모드 (I3)
- [ ] truncate=null 전달
- [ ] max-height 무제한
- [ ] 확장 버튼 표시 안 됨
- [ ] expanded prop 무시

### 개인 매트릭스
- [ ] today 필터 ON → today task만
- [ ] today 필터 OFF → 모든 task
- [ ] localStorage `personalTodayFilter` 저장
- [ ] **today 필터 ON + 빈 상태 → "오늘 할 일이 없습니다" 안내** (I4)
- [ ] **빈 상태 "모든 task 보기" 버튼 → 필터 OFF**
- [ ] 3컬럼 구조 없음 (today/next/later 폐기)
- [ ] 집중 모드 없음
- [ ] pill bar 없음
- [ ] 반응형 1-2열 grid

### 팀 할일뷰
- [ ] 카드 grid 반응형
- [ ] 목록형/담당자별 토글
- [ ] **B안 부담당: 정담당 sub-section만, mini badge `+부 EdmondName`** (I6)
- [ ] **B안 sub-section 카운트: 정담당만 (`Edmond 4`, `+부 N` 표시 안 함)** (I6)
- [ ] **부쪽 sub-section 출현 없음** (I6)
- [ ] React key suffix `-secondary` 제거 확인 (I6)
- [ ] max-width 880 → grid 반응형
- [ ] 12c 5컬럼 grid 코드 완전 제거

### 프로젝트 메인뷰
- [ ] ProjectLaneCard 단일 전체 화면
- [ ] truncate=null, max-height 없음
- [ ] "전체 할일 | 타임라인" 토글 유지
- [ ] 그룹 모드 토글 노출 (Q13)
- [ ] BacklogPanel 없음
- [ ] **9c DnD 폐기, DetailPanel에서 task의 MS 변경으로 대체** (I7)

### 제거 확인
- [ ] 상단 "매트릭스 | 주간 플래너" 토글 없음
- [ ] focusMode state 없음
- [ ] localStorage `matrixFocusMode` 정리 (I10)
- [ ] pill bar 없음
- [ ] BacklogPanel import 없음 (UnifiedProjectView, CompactMilestoneTab)
- [ ] MsTaskTreeMode 사용처 없음 (파일 보존)

### 회귀
- [ ] 주간 플래너 정상 (MsBacklogSidebar 유지)
- [ ] 타임라인 정상
- [ ] 팀원 뷰 (12d MembersView) 정상
- [ ] DnD 프로젝트 순서 정상 (12b)
- [ ] 12c 단일 owner task 정상 표시
- [ ] 12d 정/부 시스템 정상 (스택 아바타, DualAssigneeSelector)
- [ ] 스냅샷 save/restore 정상 (deprecated 키 무시)
- [ ] `npm run build` 통과

### Edge Cases
- [ ] 빈 프로젝트 (task 0개) 카드 표시
- [ ] task 1개 카드 정상 표시 (잘라내기 발동 안 함)
- [ ] 그룹 1개 + task 30개 카드 (큰 그룹) 정상
- [ ] 그룹 10개 + task 100개 카드 정상 (다수 잘림)
- [ ] 카드 확장 중 데이터 변경 (task 추가/완료) 정상
- [ ] 작은 화면 (800px) min(600, 70vh) → 560px 동작
- [ ] 큰 화면 (1440px) min(600, 70vh) → 600px 동작

---

## 9. v1 → v2 변경 요약

**Issue 1 (store 접근)** — 카드 내부에서 useStore 직접 호출. props는 데이터+모드만. action props 폐기.

**Issue 2 (측정 방식)** — 휴리스틱 → scrollHeight 측정. useRef + useEffect 1회. 정확하고 단순.

**Issue 3 (project 모드)** — `truncate={null}` 전달. expanded state 무시. 확장 버튼 숨김.

**Issue 4 (today 필터 빈 상태)** — "오늘 할 일이 없습니다" + "모든 task 보기" 버튼.

**Issue 5 (확장 시 grid 재배치)** — `grid-column: 1 / -1` full-width row. 확장 카드가 자기 row 통째.

**Issue 6 (12c B안 정밀화)** — 양쪽 출현 폐기. sub-section 정담당만. mini badge `+부 EdmondName`. key suffix 제거.

**Issue 7 (9c DnD 대체)** — DetailPanel에서 task MS 변경. 카드 내부 DnD는 12f 범위 외.

**Issue 8 (max-height)** — 500px → `min(600px, 70vh)`. 작은 화면 70%, 큰 화면 600px.

**Issue 9 (overflow)** — overflow: hidden + gradient fade. 카드 내부 스크롤 없음.

**Issue 10 (스냅샷 호환)** — deprecated 키 read 시 무시. localStorage 정리.

**커밋 시퀀스 14개 유지** — 1번/5번 분리 명시 (I8).
