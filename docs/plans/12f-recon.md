# Phase 12f Recon — 뷰 통합 재설계 + 카드 grid 레이아웃

> 작성일: 2026-04-14
> 상태: 조사 완료

---

## 1. 요구사항 요약

세 핵심 뷰(개인 매트릭스, 팀 할일뷰, 프로젝트 메인뷰)를 **ProjectLaneCard**(공용 카드) + **ProjectGridLayout**(wrapper)으로 통합. today/next/later 3컬럼 폐기, 집중 모드 폐기, 백로그 사이드패널 폐기, 상단 토글 폐기.

---

## 2. 현재 상태 분석

### 2-1. 개인 매트릭스 (PersonalMatrixGrid.jsx)

- **구조**: Lane 카드 리스트, 내부 3컬럼 grid (`repeat(3, 1fr)` — today/next/later)
- **pill bar**: line 62-97 — 카테고리별 카운트 + 집중 모드 ◎ 버튼
- **focusMode**: 22개 라인에 걸쳐 분산 (line 56-58, 84-96, 102, 106, 126, 130, 134-135, 139, 153, 197, 217, 223)
- **CellContent**: 각 셀에 `CellContent` 컴포넌트 사용 (line 200) — MS 그룹핑, MilestoneRow 렌더
- **DroppableCell**: focusMode 아닐 때만 래핑 (line 223-229)
- **SortableLaneCard**: 12b 프로젝트 순서 DnD (line 14-30)
- **category 사용**: `t.category === cat.key`로 셀에 task 배치 (line 179)
- **Props**: 17개 (line 36-44)

### 2-2. 팀 할일뷰 (TeamMatrixGrid.jsx)

- **구조**: 12c 리팩터 완료 — Lane 카드 + MS 그룹(C안) / 담당자별(B안) 토글
- **Lane 내부**: MsGroupView (line 313-414) + OwnerGroupView (line 416-510)
- **MsGroupView**: MilestoneRow 재사용, dashed `+ 마일스톤 추가` 슬롯, "기타" 섹션
- **OwnerGroupView**: 담당자 sub-section + primary/secondary 분리 배열 (12d)
- **TeamTaskRow**: 담당자 배지 (TaskAssigneeChip 또는 StackedAvatar) + MS 태그
- **SortableLaneCard**: 프로젝트 순서 DnD (line 22-28)
- **Store 직접 접근**: 8개 (milestones, allTasks, addTask, updateTask, addMilestoneInProject, collapseState, toggleCollapse, openModal)
- **max-width**: 880px centered

### 2-3. 프로젝트 메인뷰 (UnifiedProjectView.jsx)

- **구조**: 헤더 + "전체 할일 | 타임라인" 토글 + 본문(MsTaskTreeMode 또는 Timeline) + BacklogPanel
- **MsTaskTreeMode**: MS 트리 좌측(340px) + 연결된 할일 우측(flex) — 2열 레이아웃
- **BacklogPanel**: 우측 280px 사이드패널 (line 433-440)
- **DndContext**: line 355 — BacklogPanel→MS cross-drop (9c)
- **타임라인 뷰**: line 385-429 — TimelineMsRow 컬럼 grid
- **상단 토글**: Pill 컴포넌트 (line 336-340) — `rightMode` state

### 2-4. 백로그 사이드패널

**BacklogPanel.jsx** (project view):
- 사용처: UnifiedProjectView (line 433) + CompactMilestoneTab (line 335)
- 필터: `!keyMilestoneId && !done && !deletedAt`
- 고유 기능: 검색, 필터 칩(내 것만/미배정/기한 임박), 정렬(기본/최근/오래된), DnD (useDraggable)
- InlineAdd: `category: 'backlog'`

**MsBacklogSidebar.jsx** (matrix/weekly view):
- 사용처: UnifiedGridView (line 514)
- MS + task 모두 표시, depth 필터, 주간 시간 필터
- 완전히 다른 컴포넌트 (BacklogPanel과 별개)

**주간 플래너**: MsBacklogSidebar 사용 — 백로그 제거 시 주간 플래너 sidebar도 영향

### 2-5. 상단 토글 및 라우팅

- **UnifiedGridView**: `<Pill items={[매트릭스, 주간 플래너]}` (line 419)
- **UnifiedProjectView**: `<Pill items={[전체 할일, 타임라인]}` (line 336-340)
- **App.jsx views**: team-matrix, team-weekly, team-timeline, team-members, personal-matrix, personal-weekly, personal-timeline, memory, project, projectLayer
- **Sidebar TASK_VIEWS**: 현재 `COMMON_VIEWS` + `TEAM_ONLY_VIEWS` 분리 (hotfix 중 수정)

### 2-6. today/next/later 사용 현황

- **category 필드**: text (`today | next | later | backlog | done`)
- **applyTransitionRules**: R2(배정 해제→backlog), R3(done→prevCategory 저장), R4(undone→prevCategory 복원), R5(projectId 변경→keyMilestoneId null)
- **PersonalWeeklyGrid**: `category === 'today'` 사용 — undated task를 today 셀에 표시 (line 24)
- **weeklySpan.js**: `category === 'today'` — Case 4 (startDate/dueDate 없는 task)
- **타임라인**: category 미사용 (날짜 기반)
- **결론**: category 필드 자체는 **폐기 불가** (주간 플래너에서 사용). 개인 매트릭스 UI에서만 today 필터로 축소.

---

## 3. 신규 컴포넌트 설계 평가

### 3-1. ProjectLaneCard 추출

**추출 대상**: TeamMatrixGrid의 Lane 카드 (line 209-287 외곽 + MsGroupView/OwnerGroupView)

**Props 설계 (초안)**:
```js
{
  project, tasks, milestones, members, memberColorMap,
  mode: 'team' | 'personal' | 'project',
  groupBy: 'milestone' | 'owner',
  filter: { today: boolean },
  truncate: { tasksPerGroup: 3, maxGroups: Infinity },
  expanded: boolean,
  onToggleExpand: () => void,
  collapsed: boolean,
  onToggleCollapse: () => void,
  // editing/interaction
  editingId, setEditingId, handleEditFinish,
  toggleDone, openDetail, updateTask,
  editingMsId, onStartMsEdit, handleMsEditFinish, cancelMsEdit, handleMsDelete,
  // DnD
  dragHandleProps: { attributes, listeners },
}
```

**Store 의존성 처리**: 8개 store 직접 접근 → props로 전달하거나, 카드 내부에서 store 구독 유지 (후자가 현실적, prop drilling 최소화)

**복잡도**: 중간 — MsGroupView/OwnerGroupView를 그대로 가져오고, 외곽만 props 기반으로 분리

### 3-2. ProjectGridLayout wrapper

**CSS Grid 접근**:
```css
display: grid;
grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
gap: 12px;
align-items: start;  /* 카드 높이 불일치 OK */
```

**반응형**: minmax로 자동 1/2/3열 전환 (화면 폭에 따라)
- ~700px: 1열
- ~1050px: 2열
- 1050px+: 3열

**카드 잘라내기**:
- `truncate` prop으로 제어
- CSS `max-height` + `overflow: hidden` (단순)
- "+ N개 더" / "+ N개 그룹 더"는 task/그룹 수 기반 **휴리스틱** (JS 측정 불필요)
- 확장 시 `max-height: none`, CSS Grid 자연 재배치

**카드 확장 state**: `expandedCardIds: Set` (여러 카드 동시 가능) 또는 `expandedCardId: string|null` (한 카드만)

---

## 4. 카드 잘라내기 로직 설계

### 알고리즘

1. 모든 그룹의 tasks를 `tasksPerGroup` (3)으로 slice
2. 초과 tasks → `+ N개 더` 표시
3. 카드 전체에 CSS `max-height` 적용
4. `overflow: hidden`으로 잘림
5. 잘린 상태이면 카드 하단에 `+ N개 그룹 더` 오버레이 표시 (잘린 그룹 수는 표시 그룹 수 - 보이는 그룹 수로 계산)

### 구현 방식 (권장: CSS + 휴리스틱)

- `max-height: 500px` (CSS)
- `overflow: hidden` (CSS)
- 카드 내부에서 그룹 수 × 예상 높이로 `showMoreGroups` flag 계산 (JS, 렌더 시 1회)
- 확장 시 `max-height: none` + `overflow: visible`

### "+ N개 더" 클릭

- 카드 state `expanded` 토글
- 확장 시: 모든 그룹 표시, 모든 tasks 표시 (limit 해제)
- 접기 시: 원래 truncate 적용

---

## 5. 담당자 아바타 회색 버그 (D11)

**조사 결과**: TeamMatrixGrid에서 `memberColorMap`은 정상 구축, MiniAvatar에 `color` prop도 전달됨 (line 245, 471). 코드상 문제 없음.

**가능한 원인**:
- `members` 배열이 빈 상태에서 `memberColorMap` 구축 → 빈 맵 → fallback `#888`
- `useTeamMembers.getMembers` 비동기 완료 전 렌더 → 색상 없음
- 이후 리렌더 시 색상 적용되지만 초기 렌더 때 회색

**수정**: `memberColorMap` 구축을 members 로드 완료 보장 후로 이동하거나, MiniAvatar에 `key={members.length}`로 리렌더 강제

---

## 6. MS tint 강화 (D10)

**현재 위치**: MilestoneRow.jsx line 68-69
- 일반: `hexToRgba(accentColor, 0.13)`
- hover: `hexToRgba(accentColor, 0.22)`

**변경**: 0.13 → 0.15, 0.22 → 0.25

**파급**: MilestoneRow는 PersonalMatrixGrid(CellContent 경유), TeamMatrixGrid(MsGroupView), 프로젝트 뷰(MsTaskTreeMode) 모두에서 사용 → 전체 뷰에 적용됨

---

## 7. 사용자 결정 필요 항목

### 카드 잘라내기

| # | 항목 | 옵션 |
|---|------|------|
| Q1 | 카드 max-height | 400 / 500 / 600 px |
| Q2 | 그룹별 task limit | 3 / 5 / 사용자 토글 |
| Q3 | 카드 확장 | (a) 한 번에 한 카드만 (b) 여러 카드 동시 |
| Q4 | 그룹 잘라내기 우선순위 | (a) 마지막 sort_order (b) task 수 적은 순 |
| Q5 | "기타" 섹션 잘라내기 우선순위 | (a) MS 그룹과 동일 (b) 항상 표시 (c) 항상 마지막 |

### 그리드 wrapper

| Q6 | 반응형 break point | (a) minmax(320px, 1fr) 자동 (b) 명시적 breakpoint |
| Q7 | gap 크기 | 8 / 12 / 16 px |

### 개인 매트릭스

| Q8 | today 필터 기본 상태 | (a) ON (b) OFF |
| Q9 | today 필터 OFF 시 범위 | (a) 모든 task (b) today + next만 |
| Q10 | 개인 매트릭스 grid 컬럼 | (a) 1열 (b) 반응형 1-2열 |
| Q11 | 카드 잘라내기 적용 | (a) 적용 (b) 미적용 (개인 task 적어서) |

### 프로젝트 메인뷰

| Q12 | "전체 할일 \| 타임라인" 토글 | (a) 유지 (b) 폐기 — 사이드바로 이동 |
| Q13 | 그룹 모드 토글 노출 | (a) 노출 (b) 미노출 |

### 기타

| Q14 | 주간 플래너 MsBacklogSidebar | (a) 유지 (b) 제거 (c) 다른 UI로 대체 |
| Q15 | 카드 확장 state localStorage | (a) 저장 (b) 미저장 (페이지 재진입 시 리셋) |

---

## 8. 위험 요소 및 대응

| # | 위험 | 대응 |
|---|------|------|
| R1 | 3컬럼 제거 시 category 필드 처리 | 필드 유지, UI 분류만 중단 |
| R2 | 백로그 제거 시 주간 플래너 sidebar 영향 | MsBacklogSidebar는 별도 컴포넌트, Q14 결정 필요 |
| R3 | focusMode 제거 시 localStorage 잔존 | 마이그레이션 코드로 정리 또는 무시 (orphan key) |
| R4 | ProjectLaneCard store 의존성 높음 | 내부에서 store 직접 구독 유지 (prop drilling 최소화) |
| R5 | 카드 잘라내기 시 CSS Grid 재배치 지연 | `will-change: max-height` + transition |
| R6 | 프로젝트 메인뷰 MsTaskTreeMode 제거 시 9c DnD 영향 | MsTaskTreeMode는 프로젝트 뷰 전용 → 제거 가능, DnD는 ProjectLaneCard로 이관 |
| R7 | 스냅샷에 제거된 state 참조 | `_defaultCollapseState`에서 관련 키 제거, 구버전 스냅샷 호환 방어 |
| R8 | CompactMilestoneTab에서 BacklogPanel 사용 | CompactMilestoneTab도 BacklogPanel 제거 필요 |

---

## 9. R-ATOMIC 커밋 시퀀스 제안 (14개)

| # | 커밋 | 내용 |
|---|------|------|
| 1 | `feat(shared): extract ProjectLaneCard from TeamMatrixGrid` | 공용 카드 추출 (기능 동일) |
| 2 | `feat(shared): add ProjectGridLayout with responsive grid` | wrapper 신규 |
| 3 | `feat(shared): add card truncation to ProjectLaneCard` | 잘라내기 로직 |
| 4 | `feat(shared): add card expand/collapse interaction` | 확장 동작 |
| 5 | `feat(team-todo): use ProjectLaneCard + ProjectGridLayout` | 팀 할일뷰 리팩토링 |
| 6 | `feat(personal): rewrite with ProjectLaneCard + today filter` | 개인 매트릭스 재작성 |
| 7 | `refactor: remove 12a focus mode + pill bar` | 12a 코드 제거 |
| 8 | `feat(project): rewrite project view with ProjectLaneCard` | 프로젝트 메인뷰 재작성 |
| 9 | `refactor: remove BacklogPanel from all views` | 백로그 제거 |
| 10 | `refactor: remove top view toggles` | 상단 토글 제거 |
| 11 | `style(milestone): strengthen MS tint 0.13→0.15` | D10 |
| 12 | `fix: resolve gray avatar color assignment` | D11 |
| 13 | `refactor: simplify B-view secondary to badge-only` | D21 |
| 14 | `fix(sidebar): separate personal/team view lists` | 개인에 팀원 탭 제거 |

---

## 10. 다음 단계

1. 사용자 Q1~Q15 결정
2. 12f-spec.md 작성
3. R-ATOMIC 구현 시작

Recon 완료. 다음 단계: `/spec 12f`로 요구사항을 확정하세요.
