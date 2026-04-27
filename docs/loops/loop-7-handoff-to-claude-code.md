# Ryan Todo — Loop 7 완료 요약 + Loop 8/9 요구사항

> 이 문서는 Claude Web(Opus)에서 기획·diff 작성하던 흐름을 Claude Code로 넘기기 위한 인수인계 문서입니다. Loop 7은 모두 Claude Web이 설계하고 Claude Code가 적용했으며, Loop 8/9부터는 Claude Code가 기획과 적용을 모두 담당합니다.

---

## 1. 최근 완료된 Loop 요약

### Sub-Loop 6 (사이드바 재구조)
- **커밋**: `20406d1`
- 글로벌 뷰 섹션(지금 할일 / 전체 할일) 완전 제거
- `TodayView.jsx`, `AllTasksView.jsx`, dead code `BottomNav.jsx`, `TopNav.jsx` 삭제
- 사이드바 3-섹션 구조: **개인 → 팀 → 프로젝트** (모든 사용자에게 개인 먼저)
- 개인 섹션: 매트릭스 / 주간 플래너 / 타임라인 / **노트** (노트가 개인 섹션 안으로 이동)
- 팀 섹션: 매트릭스 / 주간 플래너 / 타임라인 (노트 없음)
- 앱 첫 진입 화면: `personal-matrix`
- `UnifiedGridView` 우상단 `[팀|개인]` Pill 제거 — scope는 사이드바 위치(prop)로만 결정
- Legacy URL (`/today`, `/all-tasks`) → `/personal/matrix`로 리다이렉트
- `useStore.LEGACY_MAP`에 `today`, `allTasks` → `personal-matrix` alias 추가

### Sub-Loop 7-0 (UnifiedGridView 분산 구조 리팩터링)
- **커밋**: `539e9af`
- 800줄 monolith `UnifiedGridView.jsx` → 12개 모듈로 분할
- 동작 100% 동일 — 순수 리팩터링
- 신규 디렉토리 구조:
  ```
  src/components/views/
    UnifiedGridView.jsx              (orchestrator, ~275줄)
    grid/
      constants.js                   CATS, DAY_LABELS, getMonday, fmtDate, getWeekNumber
      grids/
        PersonalMatrixGrid.jsx       행=프로젝트, 열=카테고리
        TeamMatrixGrid.jsx           행=프로젝트, 열=팀원
        PersonalWeeklyGrid.jsx       행=프로젝트, 열=요일
        TeamWeeklyGrid.jsx           행=팀원, 열=요일
      cells/
        TaskRow.jsx                  (기존 TaskCard에서 rename)
        CellContent.jsx              (기존 MsGroupedTasks에서 rename)
        MilestoneRow.jsx             (7-A에서 신규 추가)
        InlineMsAdd.jsx              (7-C에서 신규 추가)
      shared/
        Pill.jsx
        MiniAvatar.jsx
        DroppableCell.jsx
        ProjectCell.jsx
  ```

### Sub-Loop 7-A (MilestoneRow 풀세트 + 개인 매트릭스 빈 MS)
- **커밋**: `196a24a`
- **신규**: `cells/MilestoneRow.jsx` — 매트릭스 셀 내 인터랙티브 MS 행
- 기능:
  1. MS 제목 인라인 편집 (`editingMsId` state, task `editingId`와 분리)
  2. MS breadcrumb (`getMsPath`로 `"법인설립 > 지점설립"` 형식)
  3. MS 접기/펼치기 (`collapseState.matrixMs` 그룹)
  4. hover `+` 버튼 → 빈 task 즉시 생성 + 자동 인라인 편집
  5. hover `⋮` 버튼 → 삭제 (`openConfirmDialog` 재사용)
  6. `›` 상세 버튼 (기존 동작)
- **개인 매트릭스 빈 MS 표시 (#7 해결)**: `today` 컬럼에만, `owner_id === userId` 필터
- `useStore.addTask`가 생성된 task 객체 반환 (1줄 추가) — auto inline edit용
- `useStore._defaultCollapseState`에 `matrixMs: {}` 추가
- `MilestoneRow`는 `interactive` prop으로 분기: `true`(매트릭스) vs `false`(주간, read-only)

### Sub-Loop 7-B (Done Section)
- **커밋**: 7-B
- 매트릭스 셀 하단에 done task를 회색 + 취소선으로 접힌 상태 표시
- **프로젝트 단위 collapse** (`collapseState.matrixDone[projectId]`)
- 기본 상태 = 접힘 (`matrixDoneCollapsed[pid] !== false`로 판정)
- Done section은 `CellContent.jsx` 내부 inline 정의 (~30줄)
- weekly grids 변경 없음 (매트릭스 = 관리 도구, weekly = 일정 보기 역할 분리)
- `cellActiveCount`/`projActiveCount` 변수로 count 계산 분리 (done 제외)
- `toggleMatrixDoneCollapse`는 `setCollapseValue` 직접 호출 (default true이라서 일반 toggle 로직 안 맞음)

### Sub-Loop 7-C (인라인 "+ 마일스톤")
- **커밋**: `e1816f1`
- **신규**: `cells/InlineMsAdd.jsx` — 작은 회색 텍스트 버튼
- **개인 매트릭스**: `today` 컬럼 셀에만 노출 (빈 MS 표시 규칙과 일관)
- **팀 매트릭스**: 모든 `(프로젝트 × 멤버)` 셀에 노출
- 클릭 → 빈 MS 생성 + 자동 인라인 편집 (7-A의 `editingMsId` 파이프라인 재사용)
- owner_id 자동 set: 개인=`userId`, 팀=`mem.userId`
- `useStore.addMilestone`에 5번째 optional 인자 `ownerId = null` 추가 — 기존 호출자 5곳 무영향
- **신규**: `useStore.addMilestoneInProject(projectId, { ownerId, title, parentId })` — pkm 자동 select-or-insert

### Sub-Loop 7-D (MS cross-cell DnD + Task Cascade)
- **커밋**: `2e6d0f2` (+ hotfix 1), `f99a500` (delete dialog fix)
- **신규**: `useStore.moveMilestoneWithTasks(msId, { targetProjectId, targetOwnerId })`
  - Recursive descendant 수집 (root + 모든 자식 MS)
  - Cross-project 시 target 프로젝트 `pkm` 자동 select-or-insert
  - Cross-project 시 root MS의 `parent_id`만 null로 끊고 자식은 보존
  - 모든 cascade MS의 `project_id`, `pkm_id`, `owner_id` 업데이트
  - 모든 cascade task의 `projectId`, `assigneeId`, `category='today'` 리셋
  - Task scope 정규화는 `updateTask`의 normalize 로직에 위임
- **MilestoneRow**: `useDraggable({ id: 'cell-ms:${ms.id}' })` 추가, `interactive && !isEditing`일 때만 활성
- **UnifiedGridView.handleDragEnd**: `bl-ms:`와 `cell-ms:` 통합 cascade 처리
- **Hotfix 1**: task cascade 시 `updateTask` patch에 `keyMilestoneId: task.keyMilestoneId` 명시 추가 — `applyTransitionRules` R5 규칙이 `projectId` 변경 시 patch에 `keyMilestoneId`가 없으면 자동 null 처리하는 함정 차단
- **Delete dialog fix**: `handleMsDelete`가 `DeleteConfirmDialog`의 올바른 인터페이스(`{ target: 'milestone', targetId, targetName }`) 사용. DeleteConfirmDialog의 milestone 분기는 DB 직접 삭제 대신 store의 `deleteMilestone` action 사용

### Sub-Loop 7-E1 (Task Sortable) + fix-1 + fix-2
- **커밋**: 7-E1, 7-E1 fix-1 (closestCenter), 7-E1 fix-2 (handleDragEnd 순서 재구성)
- **TaskRow**: `useDraggable` → `useSortable({ id: 'cell-task:${task.id}' })`, transform/transition 적용
- **CellContent**: `SortableContext`로 `msGroups + ungrouped`를 wrap (셀당 단일 context). done section은 밖에 둠
- **cellSortableId** prop: `dropId` 그대로 전달 (매트릭스만, weekly는 미전달 → SortableContext 없이 fallback)
- **UnifiedGridView.handleDragEnd**: 재구성 완료
  - source 식별(`isMs`, `msId`, `taskId`, `task`)을 함수 시작부로
  - **`over.startsWith('cell-task:')` 분기를 `parts.length < 3` 체크 앞으로** (fix-2의 핵심)
  - 그 안에서 MS source와 task source 양쪽 처리
  - Same cell vs cross cell 판정: `projectId + assigneeId + category` 필드 직접 비교
  - Cross-MS-group within same cell: `updateTask({ keyMilestoneId })` + `reorderTasks(arrayMove(...))`
  - Cross-cell sortable end: `updateTask({ projectId, assigneeId, category, keyMilestoneId: task.keyMilestoneId })` (R5 차단)
- **fix-1**: `collisionDetection={closestCenter}` 추가 — 기본 `rectIntersection`은 부모 `DroppableCell`을 우선 매칭해서 sortable item에 도달 못 함
- **fix-2**: 위의 분기 순서 재구성 — `cell-task:xxx`는 `split(':')` 결과 length=2라 `parts.length < 3`에 걸려서 cell-task 분기에 절대 도달 못 했던 문제

### Sub-Loop 7-E2 (MS Sortable + Task → MS 헤더 Drop)
- **커밋**: 7-E2
- **MilestoneRow**: `useDraggable` → `useSortable`로 교체
- **CellContent**: `allTaskIds` → `allItemIds` (MS id 포함). 단일 SortableContext에 MS와 task 모두
- **UnifiedGridView.handleDragEnd**: `over.startsWith('cell-ms:')` 분기 신규 추가 (parts.length 체크 앞)
  - MS source + same cell (`project_id + owner_id` 일치): `reorderMilestones`
  - MS source + cross cell: `moveMilestoneWithTasks` cascade
  - Task source + same cell: `updateTask({ keyMilestoneId })`
  - Task source + cross cell: `updateTask({ projectId, assigneeId, category, keyMilestoneId })` (new MS id)
- `useStore.reorderMilestones`는 이미 존재 — 재사용
- 요구사항 #4, #5, #6 모두 완료

---

## 2. 현재 데이터 모델 핵심 참고

### 중요 store 파일 경로
- `src/hooks/useStore.js` — Zustand store
- `src/hooks/useTeamMembers.js`, `src/hooks/useTeam.js`, `src/hooks/useProjectKeyMilestone.js`
- `src/utils/supabase.js` — `getDb()` 싱글톤
- `src/utils/milestoneTree.js` — `buildTree`, `getMsPath`, `computeDepth` 등
- `src/utils/colors.js` — `CATEGORIES`, `getColor`
- `src/styles/designTokens.js` — `COLOR`, `FONT`, `SPACE`, `CHECKBOX`, `GANTT`, `VIEW_WIDTH` 상수

### Supabase 테이블 (핵심만)
- `projects` — `id, name, color, team_id, archived_at, ...`
- `tasks` — `id, text, project_id, category, done, key_milestone_id, assignee_id, scope, team_id, start_date, due_date, sort_order, ...`
- `key_milestones` — `id, pkm_id, project_id, title, owner_id, parent_id, depth, sort_order, start_date, end_date, ...`
- `project_key_milestones` (pkm) — 프로젝트당 1 row, `id, project_id, created_by`

### applyTransitionRules (useStore.js line 28~80)
`updateTask` 호출 시 자동 적용되는 normalize 규칙:
- **R1**: `assigneeId` 설정 → `scope='assigned'`
- **R2**: `assigneeId=null` → `scope='team'|'private'`, 팀 task면 `category='backlog'`
- **R3**: `done=true` → `prevCategory` 저장
- **R4**: `done=false` → `prevCategory` 복원
- **R5**: `projectId` 변경 시 patch에 `keyMilestoneId` 없으면 **자동 null**
- **R6**: `scope='private'` → `teamId=null`, `assigneeId=null`
- **R7**: `scope='team'` → `assigneeId=null`

**디버깅 함정**: R5. `updateTask({ projectId: X })`만 호출하면 기존 `keyMilestoneId`가 사라짐. MS-task 연결을 보존하려면 반드시 `updateTask({ projectId: X, keyMilestoneId: currentTask.keyMilestoneId })` 형태로 명시.

### 중요 상수 개념
- **Task category**: `'today' | 'next' | 'later' | 'backlog' | 'done'` — task의 우선순위/상태 필드. **view key가 아님**. 코드에 `category: 'today'`가 보이면 task 생성/업데이트 시 카테고리 지정이지 view 전환이 아님.
- **Task scope**: `'private' | 'team' | 'assigned'`
  - `private`: 개인 프로젝트의 task (teamId=null, assigneeId=null)
  - `team`: 팀 프로젝트의 미배정 task (assigneeId=null)
  - `assigned`: 팀 프로젝트의 배정된 task (assigneeId=user)
- **Milestone depth**: DB `depth` 필드는 deprecated — `parent_id` 체인 traversal만 사용 (`computeDepth`, `getMsPath`)

### 현재 DnD 흐름 (7-E2 완료 기준)
`UnifiedGridView.handleDragEnd`:
1. **source 식별**: `isMs`, `msId`, `taskId`, `task`
2. **`over.startsWith('cell-task:')` 분기**: task → task drop (sortable end)
3. **`over.startsWith('cell-ms:')` 분기**: MS → task 또는 task → MS 헤더
4. **`parts.length < 3` early return**
5. **`mat:` 분기**: 개인 매트릭스 cell drop zone
6. **`tmat:` 분기**: 팀 매트릭스 cell drop zone
7. **`pw:` 분기**: 개인 주간 cell drop zone
8. **`tw:` 분기**: 팀 주간 cell drop zone

Drag id prefix:
- `cell-task:${taskId}` — 매트릭스 셀 내 task (sortable)
- `cell-ms:${msId}` — 매트릭스 셀 내 MS (sortable)
- `bl-task:${taskId}` — 백로그 사이드바의 task
- `bl-ms:${msId}` — 백로그 사이드바의 MS
- `${taskId}` (prefix 없음) — 주간 플래너의 task (아직 prefix 없음 — legacy)

`DndContext`: `collisionDetection={closestCenter}` 적용.

### 매트릭스 UI 구조
- 개인 매트릭스: 행 = 프로젝트, 열 = 카테고리(지금/다음/나중)
- 팀 매트릭스: 행 = 프로젝트, 열 = 팀원
- 각 셀은 `CellContent`를 렌더 → `MilestoneRow` (+) + task(TaskRow) + `InlineAdd` + `InlineMsAdd` + `DoneSection`
- 우측 `MsBacklogSidebar` — 매트릭스/주간 공통

### 개발 원칙 (메모리상 확립된 것)
- **R-ATOMIC**: 1 fix per commit
- **DELETE-5**: 삭제 시 5방향 cascade (import, caller, props, deps, types)
- **REQ-LOCK**: 요구사항 잠금 → diff 전후 검증 테이블
- **Vite TDZ 금지**: 모듈 레벨에서 `const X = COLOR.foo` 같은 imported value 참조 금지. 모든 token 참조는 컴포넌트 함수 내부 inline
- **코드 식별자 영어, UI 텍스트 한국어**
- **designTokens.js 단일 스타일 소스**
- **디자인 금기사항**:
  - `border-left` 색상 borders 금지
  - `text-overflow: ellipsis` 금지 (`word-break/wrap` 사용)
  - `#c4c2ba`, `#d3d1c7` 금지 (secondary text 최소 `#888780`)
  - D-day badges 금지, task 색상 indicator bars 금지
  - MS rows에 progress summary 금지 (1-line compact)
  - Depth labels: L1/L2/L3 (대/중/소분류 금지)
  - "지금 할일" (not "오늘 할일")
  - Gantt bars: MS와 task 모두 20px, 세로 중앙 정렬
  - Backlog sidebar 항상 표시

### Skills 참고
- `/mnt/skills/user/deletion-cascade/SKILL.md` — DELETE-5 protocol
- `/mnt/skills/user/req-verify/SKILL.md` — REQ-LOCK protocol

---

## 3. 남은 작업 — Loop 8 (주간 플래너 기간) + Loop 9 (프로젝트 뷰)

### Sub-Loop 8-A: Weekly Grid Multi-Day Span

#### 요구사항
> "개인/팀 주간 플래너 화면에서 과제 별 시작일~마감일을 설정하면, 과제가 마감일에 들어가짐 → 시작일~마감일 기간처럼 표시되면 좋을 것 같습니다"

**현재 동작**: `PersonalWeeklyGrid.jsx`, `TeamWeeklyGrid.jsx`에서 task를 `dueDate === ds`로만 필터링. `startDate`는 무시됨. `startDate 2026-04-07 ~ dueDate 2026-04-10` task는 오직 4/10 셀에만 표시.

**목표**: `startDate ~ dueDate` 기간 동안 해당하는 모든 요일 셀에 task가 "같은 task의 span"으로 표시되어야 함.

#### 디자인 옵션
1. **옵션 A (권장)**: task를 기간 시작 셀에만 표시하되, 시각적으로 "bar"가 여러 셀에 걸쳐 보이도록 span 처리
   - 구현: task를 `startDate` 셀에 표시, CSS `position: absolute` + `width: calc(n * 100%)` 또는 grid span으로 여러 셀에 걸치게
   - Gantt-like 시각 피드백
2. **옵션 B**: task를 기간의 모든 셀에 중복 표시 (같은 task가 5일이면 5개 셀에 보임)
   - 구현 단순, 시각적 중복
3. **옵션 C**: 기간 첫 셀에 전체 bar, 나머지 셀은 "연결됨" 표시 (점선 등)

→ 권장: **옵션 A** (Gantt 스타일 bar). 단점: CSS Grid에서 task 행이 동적으로 여러 개일 때 행 높이 계산이 복잡해짐. 대안: 각 셀 안에 "bar segment"를 그리고 continuity class로 연결 (시작 셀은 `rounded-left`, 끝 셀은 `rounded-right`, 중간은 flat).

#### 구현 힌트
- 필터 로직 변경: `t.startDate <= ds && ds <= t.dueDate` (둘 다 있으면) 또는 `t.dueDate === ds` (시작일 없으면)
- 같은 task가 여러 날짜 셀에 걸쳐 표시되므로 `key`는 `${task.id}:${ds}` 형식
- task의 위치 표시: `isStart = ds === t.startDate`, `isEnd = ds === t.dueDate`, `isMiddle = !isStart && !isEnd`
- 체크박스/편집 버튼은 `isStart`일 때만 표시 (중복 방지)

#### 결정 필요사항
1. **옵션 A/B/C 중 선택**
2. **weekend (토/일) 처리**: 현재 weekly는 5일(월~금)만 표시. 기간에 토/일이 포함되면 어떻게?
   - 그대로 잘라냄 (금요일에서 끝), 또는 주를 7일로 확장
3. **dueDate 없이 startDate만 있는 task**: startDate 셀에만 표시? 무한 span?
4. **startDate/dueDate 모두 없는 task**: 현재 동작(`category === 'today' && ds === todayStr`)은 유지?

#### 영향 파일
- `src/components/views/grid/grids/PersonalWeeklyGrid.jsx`
- `src/components/views/grid/grids/TeamWeeklyGrid.jsx`
- 새 헬퍼: `src/components/views/grid/grids/weeklySpan.js` (task 필터 + position 계산)
- 가능하면 cells/TaskRow.jsx는 건드리지 않음 (매트릭스 영향 회피). weekly 전용 span TaskRow를 분기 또는 prop으로 처리

---

### Sub-Loop 8-B: Weekly Cell 내 기간 인라인 편집

#### 요구사항
Weekly에서 task의 `startDate`/`dueDate`를 셀 내에서 직접 수정 가능하도록. DnD로 bar를 늘리거나 시작점 이동, 또는 클릭 시 date range picker.

#### 옵션
1. **Drag resize**: bar의 좌/우 핸들 drag → startDate/dueDate 변경
   - 복잡, 구현 난이도 높음
2. **Click → date range picker**: task 클릭 시 팝오버에서 날짜 범위 선택
   - 단순, dnd-kit 충돌 없음
3. **Detail panel 유도**: 현재처럼 detail 패널에서만 편집, weekly 인라인 편집 없음

→ 권장: **옵션 2**. 기존 detail panel의 date picker 컴포넌트 재사용 가능할 수 있음.

#### 결정 필요사항
1. 옵션 1/2/3 선택
2. 옵션 2 선택 시 어떤 trigger? 더블클릭? 우클릭? hover 시 작은 캘린더 아이콘?

#### 영향 파일
- 8-A 파일들 + detail panel의 date input 컴포넌트 재사용 검토

---

### Sub-Loop 8-C: Timeline View Weekly 동기화 검증

#### 요구사항
> "개인/팀 주간 플래너 화면에서 과제 기간을 지정하면, 타임라인에 해당 기간에 반영이 안됨"

#### 진단 필요
현재 타임라인 뷰 (`InlineTimelineView.jsx`, `TimelineEngine.jsx` 등)가 task의 `startDate`/`dueDate`를 어떻게 렌더하는지 확인:
- `src/components/timeline/TimelineEngine.jsx`
- `src/components/timeline/MilestoneGanttRow.jsx`
- `src/hooks/useProjectTimelineData.js`

weekly에서 수정한 기간이 timeline에 반영되는지는 데이터 동기화(store → view) 문제일 가능성이 높음 — Zustand store의 `tasks`는 single source이므로 자동으로 반영되어야 함. 문제라면 특정 timeline 컴포넌트가 `startDate`를 무시하고 `dueDate`만 보거나, 잘못된 memoization/selector 때문일 가능성.

#### 작업 순서
1. timeline 관련 파일 조사 — `grep -rn "startDate\|start_date" src/components/timeline/`
2. 재현 케이스: task에 `startDate='2026-04-07', dueDate='2026-04-10'` 설정 → timeline에서 bar가 어디 나오는지 확인
3. bug 찾으면 fix
4. 없으면 "이미 정상 동작" 확인 후 close

#### 영향 파일
- `src/components/timeline/*.jsx`
- `src/hooks/useProjectTimelineData.js`
- 가능하면 InlineTimelineView 건드리지 않기

---

### Sub-Loop 9-A: 프로젝트 뷰 Assignee + MS Owner UI

#### 요구사항 (사용자 원문)
> "프로젝트 화면에서 담당자는 마일스톤에도 담당자 Assign이 필요하다. 팀 매트릭스뷰에서 마일스톤을 담당자에게 매핑이 되면 그게 마일스톤의 담당자가 되는 것이고, 매트릭스 셀에서 정의된 프로젝트x담당자 셀에서 마일스톤과 할일은 그 즉시 해당 담당자로 배정이 되어야 한다."

#### 현재 상태
- 매트릭스 뷰: 7-C에서 MS 생성 시 `owner_id = mem.userId` 자동 set, task 생성 시 `assigneeId` 자동 set → **이미 동작**
- **프로젝트 뷰에서**: task에 assignee selector 있는지, MS에 owner selector 있는지 확인 필요
  - `src/components/project/ProjectView.jsx`, `UnifiedProjectView.jsx`, `MsTaskTreeMode.jsx`, `HierarchicalTree.jsx` 등
  - `src/components/shared/AssigneeSelector.jsx` — 이미 존재 (task용?)
  - `src/components/project/OwnerDropdown.jsx` — 이미 존재 (MS용?)

#### 작업
1. **조사 단계**: 현재 프로젝트 뷰에서 task에 assignee 선택 UI가 있는가? MS에 owner 선택 UI가 있는가? 있다면 왜 사용자가 "안됨"이라고 느끼는가 (UX 발견 어려움? 동작 버그?)
2. 발견되면 **UX 개선** (hover 시 아이콘, 상세 패널 외 inline 변경 등)
3. 없으면 **신규 추가**

#### 결정 필요사항
1. MS owner 선택 UI 위치: MS 행 hover 시 작은 avatar? 우클릭 메뉴? 상세 모달?
2. Task assignee 선택 UI 위치: task 행 끝에 작은 avatar? detail 패널만?
3. Drag-and-drop으로 assignee 변경도 가능하게? (매트릭스에서 이미 가능)

#### 영향 파일 (예상)
- `src/components/project/MsTaskTreeMode.jsx`
- `src/components/project/HierarchicalTree.jsx`
- `src/components/project/CompactMilestoneTab.jsx`
- `src/components/shared/AssigneeSelector.jsx`
- `src/components/project/OwnerDropdown.jsx`
- `src/components/shared/DetailPanel.jsx`
- 관련 타입 확장: 현재 `DetailPanel`에 assignee selector가 있는지 확인

---

### Sub-Loop 9-B: 프로젝트 뷰 BacklogPanel (우측 사이드패널)

#### 요구사항 (사용자 원문)
> "프로젝트 백로그가 맨 아래 별도 접기 상태로 존재하면 어떤 백로그가 남아 있는지 알기가 어렵다. 백로그로 살아 있지만 관리가 누락되고 있는 항목을 바로 보고 배정하거나 수정하거나 처리하도록 하기 위함이다."

> "프로젝트 뷰 우측에 현재는 아무것도 없고, 할일 상세 패널이 나중에 올라오는 구조이다. 백로그 우측 패널이 있어도 그 위로 할일 상세 페이지 패널이 올라오면 된다."

#### 목표
프로젝트 뷰 우측에 항상 펼쳐진 백로그 패널 신설. MS에 연결되지 않은 task들을 **노출 + 쉽게 관리**하도록 함.

#### 디자인 사양 (Claude Web 대화에서 합의됨)
- **위치**: 프로젝트 뷰 우측, ~280px 너비 (매트릭스의 `MsBacklogSidebar`와 시각 일관성)
- **콘텐츠**: 현재 프로젝트의 `keyMilestoneId === null && done === false` task만
- **항상 펼쳐진 리스트** — 접기 없음. 백로그가 0건이면 "✓ 백로그 비어있음"
- **카운트 + 경고 색상**:
  - 0~5건: 회색
  - 6~15건: 노란색
  - 16건+: 빨간색 ⚠
- **정렬**: `createdAt ASC` 기본 (오래된 것부터), 토글로 `DESC` 가능
- **Age 표시**: task 옆에 "3일 전", "2주 전" 등. 7일+ 노란색, 30일+ 빨간색
- **DnD**: task를 drag → MS 트리의 MS 행에 drop = `keyMilestoneId` set
- **인라인 추가**: 하단 `+ 백로그에 추가` (`InlineAdd` 재사용, `keyMilestoneId: null, category: 'today'`)
- **빈 상태**: "✓ 백로그 비어있음" 메시지 (관리 잘 되고 있다는 신호)

#### 레이아웃
```
┌─────────────┬──────────────────────────────┬─────────────────┐
│  Sidebar    │  ProjectView                 │  BacklogPanel   │
│  (좌측)     │  (메인 — MS 트리)            │  (우측 신규)    │
│             │                              │                 │
│             │                              │  📥 백로그 (12) │
│             │                              │                 │
│             │                              │  ┌───────────┐  │
│             │                              │  │ task1 (3d)│  │
│             │                              │  │ task2 (5d)│  │
│             │                              │  └───────────┘  │
│             │                              │                 │
│             │                              │  + 백로그 추가   │
└─────────────┴──────────────────────────────┴─────────────────┘
                         ↑
                 DetailPanel은 z-index로
                 BacklogPanel 위에 overlay
                 (기존 overlay 패턴 유지)
```

#### 작업
1. **조사**: 현재 `ProjectView.jsx` (또는 `UnifiedProjectView.jsx`)의 layout 구조 확인
   - `src/components/views/ProjectView.jsx`
   - `src/components/project/UnifiedProjectView.jsx`
2. **신규 컴포넌트**: `src/components/project/BacklogPanel.jsx`
3. **ProjectView**에 우측 영역 추가, BacklogPanel 마운트
4. **DnD 통합**: 기존 프로젝트 뷰의 DnD context에 백로그→MS drop zone 추가
   - MS 트리의 각 MS 행이 droppable (`project-ms:${msId}` 형식 등)
   - 백로그 task drop 시 `updateTask({ keyMilestoneId })`
5. **모바일**: 우측 패널 숨김 + 헤더 버튼으로 토글 (별도 검토)

#### 결정 필요사항
1. **DnD library context**: 프로젝트 뷰의 기존 DnD 구조 파악 필요 — 새 DndContext? 기존 DndContext 확장?
2. **BacklogPanel 내부에서 task 편집**: 인라인 편집 가능? 아니면 detail panel만?
3. **Done task 처리**: 백로그 패널에 done task 포함 안 함 (live only)
4. **신규 task 생성 시 기본 카테고리**: `category: 'today'`? 또는 project default?
5. **Age 계산 기준**: `createdAt` 필드가 store에 있는지 확인 — 없으면 `updated_at` 또는 task 생성 시간 trackable한 필드

#### 영향 파일 (예상)
- `src/components/project/BacklogPanel.jsx` (신규)
- `src/components/views/ProjectView.jsx` 또는 `src/components/project/UnifiedProjectView.jsx`
- 기존 MS 트리 컴포넌트의 droppable 설정
- 가능하면 `src/components/common/MsBacklogSidebar.jsx`는 건드리지 않음 (매트릭스용)

---

## 4. 작업 진행 권장 순서

우선순위는 사용자와 확인이 필요하지만, 의존성 기준:
1. **9-A** (프로젝트 뷰 assignee/owner UI) — 프로젝트 뷰 관련 작업의 기반
2. **9-B** (BacklogPanel) — 9-A와 같은 영역. 묶어서 작업 효율적
3. **8-A** (Weekly span) — 독립적, 언제든 가능
4. **8-C** (Timeline 동기화) — 8-A 후 검증
5. **8-B** (Weekly 인라인 편집) — 8-A 후

또는 사용자 pain point에 따라:
- 백로그 누락 방지가 더 시급하면 **9-B 먼저**
- 일정 관리가 더 시급하면 **8-A 먼저**

---

## 5. 각 작업 진입 전 Claude Code가 해야 할 일

각 sub-loop 시작 전:

1. **관련 파일 전수 조사**
   - 예: 8-A 시작 전 `grep -rn "startDate\|start_date\|dueDate" src/components/views/grid/grids/`
   - 기존 상수/hook/util 재사용 기회 찾기

2. **사용자와 디자인 결정 확인**
   - 각 sub-loop의 "결정 필요사항" 섹션 참고
   - 모호한 부분은 목업(이미지 또는 ASCII)으로 제안 후 합의

3. **DELETE-5 사전 점검**
   - 삭제/rename할 항목의 외부 참조 확인

4. **REQ-LOCK 표 작성**
   - 요구사항을 번호별로 나열
   - 각 요구사항이 어느 파일/라인에 적용되는지 매핑
   - diff 작성 후 검증 테이블로 자체 확인

5. **R-ATOMIC 분할**
   - 큰 sub-loop는 1/2/3 단계로 분할 (7-E가 7-E1/7-E2로 나뉜 것처럼)
   - 각 단계 적용 → 빌드 → 런타임 검증 → 다음 단계

6. **적용 후 빌드 + 런타임 검증 필수**
   - `npm run build` 통과
   - 관련 view 직접 열어서 기능 확인
   - 회귀 검증 — 이전 loop 기능이 여전히 동작하는지

---

## 6. 알려진 함정

1. **applyTransitionRules R5** — `updateTask`에서 `projectId` 변경 시 `keyMilestoneId` 자동 null. patch에 명시적으로 `keyMilestoneId: currentTask.keyMilestoneId` 포함해야 유지됨. (7-D hotfix 1 참고)

2. **dnd-kit collisionDetection** — sortable과 함께 쓸 때 default `rectIntersection`은 부모 droppable을 우선 매칭. sortable에서는 `closestCenter` 또는 `closestCorners` 권장. (7-E1 fix-1 참고)

3. **dnd-kit over.id parsing 순서** — `parts.length < 3` 같은 early return을 쓸 때, prefix 기반 분기(`cell-task:`, `cell-ms:`)는 반드시 그 체크 **앞**에 배치. `${prefix}:${id}`는 split 결과 2개이므로 3 미만으로 차단됨. (7-E1 fix-2 참고)

4. **Vite TDZ** — `const X = COLOR.foo`를 모듈 레벨에 두면 production 빌드에서 "Cannot access R before initialization" 에러. 모든 token 참조는 컴포넌트 함수 내부 inline에서만.

5. **designTokens.js 변경 금지** — 이 파일은 하나의 source of truth. 새 상수가 필요하면 추가만 하고, 기존 값 변경은 여러 view에 영향 줄 수 있음.

6. **tasks/memos 테이블 컬럼 변경 금지** (text, done, category, alarm) — 이미 확립된 데이터 모델.

7. **updateTask(id, patch) 시그니처 유지** — `updateTask({...task})` 형태로 바꾸면 안 됨.

8. **MsBacklogSidebar와 BacklogPanel은 다른 컴포넌트** — 둘을 혼동하지 말 것. 9-B에서 새로 만드는 BacklogPanel은 프로젝트 뷰 전용, 매트릭스의 MsBacklogSidebar와 의미가 다름.

9. **DeleteConfirmDialog 인터페이스** — `{ target, targetId, targetName, meta }` 형식. `{ title, message, onConfirm }` 형식으로 호출하면 동작 안 함. store의 action을 사용할 것 (`deleteMilestone` 등).

10. **addTask return value** — 7-A에서 `addTask`가 task 객체 반환하도록 변경됨. 기존 호출자는 return 무시해도 되지만, 새 코드에서 auto inline edit 필요 시 `const t = await addTask(...); if (t) setEditingId(t.id)` 패턴 사용.

---

## 7. 검증 체크리스트 템플릿

각 sub-loop 적용 후 최소한 아래 회귀 테스트:

**매트릭스 (개인/팀)**
- [ ] 진입/렌더
- [ ] task 체크/편집/상세 arrow
- [ ] MS 인라인 편집/삭제/토글/+task/상세
- [ ] InlineMsAdd
- [ ] Done section 접기/펼치기
- [ ] DnD: task 같은 셀 reorder
- [ ] DnD: task cross-cell
- [ ] DnD: task → MS 헤더
- [ ] DnD: MS 같은 셀 reorder
- [ ] DnD: MS cross-cell
- [ ] 백로그 → 매트릭스 drop

**주간 플래너 (개인/팀)**
- [ ] 진입/렌더
- [ ] task 체크/편집
- [ ] DnD: task cross-day
- [ ] 이번 주 ↔ 다른 주 이동

**프로젝트 뷰**
- [ ] 진입/렌더
- [ ] MS 트리 표시
- [ ] task 체크/편집/상세

**공통**
- [ ] `npm run build` 통과
- [ ] production build에서 Vite TDZ 에러 없음
- [ ] 사이드바 navigation 정상
- [ ] Login/logout 정상 (기본 health check)

---

## 8. 커밋 메시지 포맷

Loop 7에서 사용한 형식:
```
<type>(<scope>): <short summary> (<sub-loop id>)

<detailed description>
- bullet 1
- bullet 2
- ...

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

예:
```
feat(matrix): task sortable in cells (Sub-Loop 7-E1)

- TaskRow: useDraggable → useSortable, drag id 'cell-task:${task.id}'
- CellContent: SortableContext wraps msGroups + ungrouped
- ...
```

타입:
- `feat`: 신규 기능
- `fix`: 버그 수정
- `refactor`: 리팩터링
- `chore`: 기타 (문서, 빌드 설정 등)

Scope:
- `matrix`, `grid`, `sidebar`, `timeline`, `project`, `weekly`, `store` 등

---

이 문서는 Claude Code에게 "다음 sub-loop부터 기획+적용 모두 담당"을 위한 인수인계 자료입니다. 사용자가 추가 결정사항을 제공하면 그에 맞춰 작업을 진행하면 됩니다.
