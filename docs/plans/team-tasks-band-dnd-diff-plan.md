# DIFF PLAN: Team Tasks View — Band Layout & Drag-and-Drop

**Phase**: `team-tasks-band-dnd`
**Status**: Diff plan (spec v6 기반)
**작성일**: 2026-04-28
**선행 문서**:
- [team-tasks-band-dnd-recon.md](team-tasks-band-dnd-recon.md)
- [team-tasks-band-dnd-spec.md](team-tasks-band-dnd-spec.md) v6

---

## 0. spec §11.2 검증 결과 (diff-plan 진입 조건 충족)

| # | 항목 | 결과 | diff-plan 영향 |
|---|---|---|---|
| 1 | RLS 정책 grep | 관련 마이그레이션: `20260314300000_team_member_assign_policy.sql` 외 다수 (`20260312000000_loop17_team_schema.sql`, `20260317100000_loop32_schema_extension.sql` 등) | commit 1 작업 시 기존 정책 본문 확인 → cross-project UPDATE 허용 여부 판정. 충분하면 commit 제거 |
| 2 | UnifiedGridView `bl-*` active/dead | PersonalTodoShell은 자체 DndContext 사용 (UnifiedGridView outer 비등록). `BacklogPanel.jsx` / `CompactMilestoneTab.jsx`는 `src/components/project/` 위치 — UnifiedGridView 트리 외부. **결론: 현 desktop 라우팅에서 `bl-*` UnifiedGridView 분기는 미동작 가능성 높음** (mobile/project view에서 동작 가능성은 미확인). | **commit 9 무수정 유지** — 본 phase는 type 등록 추가 안 함. 분기 그대로 보존. 후속 phase에서 사용처 전수 조사 후 정리 |
| 3 | weekly schedule 라우팅 | [UnifiedGridView.jsx:14](../../src/components/views/UnifiedGridView.jsx#L14) 코멘트 "주간 플래너 제거됨 (PersonalWeeklyGrid, TeamWeeklyGrid)". **라우팅 노출 없음** | V-S-10 회귀 검증 **불필요** |
| 4 | SortableTaskCard 인터페이스 | PersonalTodoTaskRow는 col 3에만 listener 적용 (col 2 = MS label은 sortable 영역 외) → 단순 wrapper 컴포넌트로는 부족 | **`useSortableCard` hook + `SortableTaskCard` wrapper 둘 다 제공**. hook은 복잡 사용 (PersonalTodoTaskRow), wrapper는 단순 사용 (PivotTaskCell) |
| 5 | TeamMatrixGrid filter chain | `t.teamId === currentTeamId` ([TeamMatrixGrid.jsx:14](../../src/components/views/grid/grids/TeamMatrixGrid.jsx#L14)) + filter prop ([PivotMatrixTable.jsx:52-62](../../src/components/views/grid/PivotMatrixTable.jsx#L52)) + `!done && !deletedAt` ([PivotMatrixTable.jsx:127](../../src/components/views/grid/PivotMatrixTable.jsx#L127)) + 미배정 cell 추가 조건 ([PivotTaskCell.jsx:26-30](../../src/components/views/grid/cells/PivotTaskCell.jsx#L26-L30)) | `getCellTasks` 본문에 위 5조건 모두 반영. **secondary assignee 표시 task의 drag 정책 미정** (spec 미커버) — commit 10에서 추가 결정 필요 |

### 0.1 commit 10 추가 결정 항목 (spec 미커버 — diff-plan에서 lock-down)

**Secondary assignee task의 drag 정책**:

[PivotTaskCell.jsx:29-30](../../src/components/views/grid/cells/PivotTaskCell.jsx#L29-L30)에서 `t.secondaryAssigneeId === memberId`인 task는 그 멤버 컬럼에 **보조로 표시**됨 (R30). 하지만 실제 데이터의 `assigneeId`는 다른 멤버. drag 시 cellKey의 memberId를 어떻게 정할지:

- **선택 A** (권장): secondary 표시 위치에서는 **drag 비활성**. `useSortableCard` 호출을 `isPrimary` (= `t.assigneeId === memberId` 또는 미배정 cell) 일 때만 수행. secondary 표시는 read-only.
- 선택 B: secondary 표시에서도 drag 활성, cellKey는 primary 위치 기준으로 인코딩 (즉 같은 task가 두 cell에 표시되어도 drag는 primary cell에서만 실제 발동).

**선택 A 채택**. 근거: `useSortable` 호출이 같은 task id를 두 번 등록하면 dnd-kit 에러. primary 위치만 등록하는 게 자연스러움. commit 10에서 PivotTaskCell의 `useSortableCard` 호출을 `isPrimary || isUnassignedCol` 조건으로 감쌈.

---

## 1. 작업 순서 (commit 1 → 14)

각 commit은 빌드 통과 + 회귀 검증 필수. 의존성:
- commit 2 → commit 11 (`canMoveTaskToProject` 사용)
- commit 3 → commit 4, 5, 6, 7 (컴포넌트 추출이 행동 변경의 토대)
- commit 8 → commit 10 (`SortableTaskCard` 사용)
- commit 9 → commit 11 (디스패처 후 type 추가)
- commit 12 → commit 13 (drop indicator 토큰 사용)
- commit 14 = 마지막 (모든 신규 코드 통합 후 정리)

### 1.0 사전 작업 (commit 1 전)

`git grep -n "tasks_update\|UPDATE.*tasks\|tasks.*FOR UPDATE\|tasks.*WITH CHECK" supabase/migrations/`로 정확한 RLS 정책 본문 확인. 이미 cross-project UPDATE를 허용하는 정책이 있으면 commit 1 생략 → 13 commit 시퀀스. 없으면 commit 1 진행.

---

## 2. Commit별 변경 사항

### Commit 1 (조건부): RLS 정책 보강

**목적**: 같은 팀 내 다른 멤버의 task `project_id` / `key_milestone_id` / `assignee_id` 변경 허용.

**신규 파일**:
- `supabase/migrations/20260428000000_team_tasks_cross_project_dnd.sql`

**SQL 골격** (정확 정책 본문은 사전 작업 결과에 따라 조정):

```sql
-- Cross-project drop을 위한 UPDATE 정책 (기존 team_tasks_member_assign 보강)
-- 같은 팀 멤버는 서로의 task의 project_id / key_milestone_id / assignee_id 변경 가능
-- scope: 'team', 'assigned'에 한정

DROP POLICY IF EXISTS team_tasks_cross_project_update ON tasks;

CREATE POLICY team_tasks_cross_project_update
ON tasks
FOR UPDATE
USING (
  scope IN ('team', 'assigned')
  AND team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  scope IN ('team', 'assigned')
  AND team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  )
);
```

**검증**: 테스트 환경에서 다른 팀원이 만든 team task의 `project_id`를 supabase client로 UPDATE 시도 → 성공해야 함.

**롤백**: `DROP POLICY ... CASCADE` (이전 정책 복원 필요 시 추가 마이그레이션).

---

### Commit 2: `canMoveTaskToProject` → `src/utils/dnd/guards.js`

**목적**: 가드 함수를 view-specific 위치에서 중립 위치로 이동.

**신규 파일**:
- `src/utils/dnd/guards.js`

**파일 내용**:
```js
/* DnD guards — view-neutral. spec §12.3 */

/**
 * task → targetProject 이동 가능 여부.
 * Private task (!teamId) → personal/system project (!targetProject.teamId)
 * Team task (teamId) → 같은 팀 project
 * 자기 project → false (V5 self-target 가드)
 */
export function canMoveTaskToProject(task, targetProject) {
  if (!task || !targetProject) return false
  if (task.projectId === targetProject.id) return false
  if (!task.teamId) return !targetProject.teamId
  return task.teamId === targetProject.teamId
}
```

**수정 파일**:
- [src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx)
  - line 13-18: `export function canMoveTaskToProject` 함수 정의 **삭제**
  - line 1 import에 `import { canMoveTaskToProject } from '../../../../utils/dnd/guards'` 추가
  - 다른 view 컴포넌트가 named import 하던 위치 변경
- [src/components/views/personal-todo/PersonalTodoShell.jsx:11](../../src/components/views/personal-todo/PersonalTodoShell.jsx#L11)
  - `import { canMoveTaskToProject } from './cells/PersonalTodoProjectGroup'` → `import { canMoveTaskToProject } from '../../../utils/dnd/guards'`

**검증**: `git grep "canMoveTaskToProject" src/`로 import 위치 0건 외부 노출 (모두 `utils/dnd/guards`).

**회귀**: V-S-09c (백로그 task → 다른 프로젝트 drop) 동작 동일.

---

### Commit 3: 컴포넌트 추출 (행동 변경 없음)

**목적**: 후속 commit이 변경할 영역을 파일로 분리. 본 commit 자체는 화면 결과 동일.

**신규 파일**:
- `src/components/views/grid/cells/PivotProjectHeaderRow.jsx` — 현재 [PivotProjectRow.jsx](../../src/components/views/grid/cells/PivotProjectRow.jsx) 의 헤더 영역 추출 (rename 대신 신규 파일로). 기존 PivotProjectRow는 호출자.
- `src/components/views/grid/cells/PivotMilestoneBand.jsx` — 빈 골격 (commit 4에서 본문 채움). **props: `{ milestone, count, colSpan, dim = false, projectId }`** (W-4 정정 — `members` prop 제거. caller가 `colSpan` 직접 전달).

**수정 파일**:
- [src/components/views/grid/PivotMatrixTable.jsx](../../src/components/views/grid/PivotMatrixTable.jsx) line 144-150 — `PivotMsSubRow` 호출 그대로 유지 (commit 4에서 교체).

**검증**: 시각 결과 동일. `npm run build` 통과.

---

### Commit 4: MS 풀폭 밴드 + 미분류 dim

**목적**: L-03, L-04 구현.

**수정 파일**:
- `src/components/views/grid/cells/PivotMilestoneBand.jsx` — 본문 작성. props: `{ milestone, count, colSpan, dim = false, projectId }`. `<tr><td colSpan={colSpan}>` 풀폭 + 좌측 라벨 + 우측 카운트. **`members.length`에 내부 의존성 0** — caller가 `colSpan` 직접 주입 (W-4).
- [src/components/views/grid/PivotMatrixTable.jsx](../../src/components/views/grid/PivotMatrixTable.jsx) line 144-166:
  - `PivotMsSubRow` 호출 → `<PivotMilestoneBand colSpan={members.length + 3} ... />` + 별도 `tr`로 분리한 task rows. (`+3` = 거터 + 미배정 + 합계. commit 14 합계 제거 시 호출부에서만 `+2`로 수정)
  - `PivotUngroupedSubRow` → `<PivotMilestoneBand colSpan={members.length + 3} dim={true} ... />` + ungrouped task rows

**Acceptance**:
- L-03: 밴드 풀폭 (caller가 colSpan 주입 → 빌드 의존성 정확)
- L-04: 미분류 밴드는 `OPACITY.projectDimmed` 적용

**검증**: 화면에서 MS 라벨이 풀폭 한 줄로 표시. 미분류 그룹은 흐림.

---

### Commit 5: 프로젝트 헤더 카운트 통합

**목적**: L-02 구현.

**수정 파일**:
- `src/components/views/grid/cells/PivotProjectHeaderRow.jsx` 본문 — 프로젝트 제목 옆에 멤버별 카운트 셀 인라인. 별도 카운트 행 제거.
- [src/components/views/grid/cells/PivotProjectRow.jsx](../../src/components/views/grid/cells/PivotProjectRow.jsx) — `PivotProjectHeaderRow`로 위임. 기존 카운트 행 렌더링 코드 삭제.

**Acceptance**: L-02 — 카운트 셀이 프로젝트 헤더 행에 인라인. 별도 카운트 행 0건.

**검증**: DOM 검사. 카운트 위치 확인.

---

### Commit 6: 좌측 거터 130px + 행 패딩

**목적**: L-06, L-07 구현.

**수정 파일**:
- [src/styles/designTokens.js](../../src/styles/designTokens.js):
  - `PIVOT.colWidthProject = 170` → `LIST.colWidthLabelGutter = 130` 신규 토큰 추가 (또는 `PIVOT.colWidthLabelGutter = 130`). 기존 `PIVOT.colWidthProject` 그대로 유지 (다른 사용처 보호).
- [src/components/views/grid/PivotMatrixTable.jsx:78](../../src/components/views/grid/PivotMatrixTable.jsx#L78) `<col style={{ width: PIVOT.colWidthProject }} />` → 신규 토큰 사용
- 헤더/밴드/Task 행 padding 조정 (Claude Web mockup 기준)

**Acceptance**: L-06 — 거터 130px, ellipsis 0건. L-07 — 패딩 mockup 일치.

**검증**: DevTools에서 좌측 컬럼 폭 = 130px. 모든 활성 팀 프로젝트 제목이 한 줄로 표시.

---

### Commit 7: `+ 마일스톤` 호버 어포던스

**목적**: L-05 구현.

**수정 파일**:
- `src/components/views/grid/cells/PivotProjectHeaderRow.jsx`:
  - `onMouseEnter` / `onMouseLeave` 상태 추가
  - hover 시 우측 끝에 dashed-border pill 버튼 표시 (`+ 마일스톤`)
  - 클릭 → `addMilestoneInProject(project.id, { title: '' })` 호출 ([useStore.js:1087](../../src/hooks/useStore.js#L1087) 시그니처 정확). pkm은 store action이 select-or-insert 자동 처리 (W-6)
- [src/components/views/grid/PivotMatrixTable.jsx](../../src/components/views/grid/PivotMatrixTable.jsx) line 152-158: `PivotAddMsRow` 렌더 **삭제** (호버 어포던스로 대체) — commit 14의 DELETE-5에서 파일 삭제.

**Acceptance**: L-05 — 호버 전 비표시, 호버 시 dashed pill, 클릭 시 MS 생성.

**검증**: 마우스 hover/leave 테스트. 클릭으로 새 MS 생성.

---

### Commit 8: `SortableTaskCard` + `useSortableCard` 추출

**목적**: §12.4 universal 카드 래퍼.

**신규 파일**:
- `src/components/dnd/SortableTaskCard.jsx`:

```jsx
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { OPACITY } from '../../styles/designTokens'

/**
 * useSortableCard — hook 형태. 카드가 setNodeRef/listeners를 부분 영역에만
 * 적용하는 경우(예: PersonalTodoTaskRow의 col 3) 사용.
 * spec §12.4
 */
export function useSortableCard({ id, data, dragOpacity = 0.3 }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data })
  return {
    setNodeRef,
    attributes,
    listeners,
    isDragging,
    style: {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? dragOpacity : 1,
    },
  }
}

/**
 * SortableTaskCard — wrapper 컴포넌트. 카드 전체가 sortable 영역인 경우(예:
 * PivotTaskCell) 사용.
 */
export default function SortableTaskCard({ id, data, dragOpacity = 0.3, style: extraStyle, children, ...rest }) {
  const { setNodeRef, attributes, listeners, style } = useSortableCard({ id, data, dragOpacity })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{ ...style, ...extraStyle }} {...rest}>
      {children}
    </div>
  )
}
```

**수정 파일**:
- [src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx) line 27-30 — `useSortable` 직접 호출 → `useSortableCard({ id: 'bl-task:${task.id}', data: { task, sortableContextId } })` 로 변경. line 39-43의 `dragStyle` 객체 → hook 결과의 `style` 사용. **`isDragging`/`isFocus`/기타 opacity 계산은 PersonalTodoTaskRow가 자체 처리**(hook은 단일 dragOpacity만 노출)

**Acceptance**:
- V-S-09a~d 모두 회귀 0
- 특히 V-S-09d: `data.sortableContextId` 그대로 첨부 → PersonalTodoShell의 sameContext 가드 동일 작동

**검증** (W-2 보강):
1. 백로그 task drag/drop 4 시나리오 모두 동일 동작
2. **`useSortableCard`가 내부에서 `useSortable({ id, data })`를 그대로 호출하는지 코드 리뷰** — `data` 변형(spread 등) 금지. dnd-kit이 자동 병합하는 `data.current.sortable.containerId` 보존 검증
3. **드래그 중 콘솔에서 `console.log(over.data?.current?.sortable?.containerId)` 직접 확인** — Loop-50 sameContext 가드가 사용하는 필드. 값이 `bl-project-sortable:${pid}:${section}` 형태로 출력되어야 함
4. dnd-kit 버전 `@dnd-kit/sortable@^10.0.0` (package.json line 14) 에서 `sortable.containerId` 필드명 확정

---

### Commit 9: UnifiedGridView dispatcher 도입

**목적**: §12.1 universal ID 컨벤션 + §12.2 디스패처. 본 commit 범위 = UnifiedGridView 안 active branch만.

**신규 파일**:
- `src/utils/dnd/dispatcher.js` (W-3 정정 — 명시적 boolean 반환으로 fallback 구분):

```js
/* DnD dispatcher — spec §2.4 + W-3 fix */

const HANDLERS = {}

export function registerHandler(type, handler) {
  HANDLERS[type] = handler
}

/**
 * dispatch — drop 이벤트 처리 시도.
 * @returns true: 처리 완료. false: type 미등록 → caller가 fallback 분기 실행 가능.
 *          E-01/E-02 가드 통과 시에도 true (no-op이지만 처리됨)
 */
export function dispatch(e, ctx) {
  if (!e.over) return true                                    // E-01 (처리됨)
  if (e.active?.id && e.active.id === e.over.id) return true  // E-02 (처리됨)

  const type = e.over.data.current?.type ?? e.active.data.current?.type
  const handler = HANDLERS[type]
  if (!handler) return false                                  // type 미등록 → fallback
  handler(e, ctx)
  return true
}
```

**수정 파일**:
- [src/components/views/UnifiedGridView.jsx:170-](../../src/components/views/UnifiedGridView.jsx#L170) `handleDragEnd`:
  - 본문을 `dispatch(e, ctx)` 한 줄 호출로 교체
  - 기존 분기 로직을 named handler 함수로 분리 (같은 파일 내 또는 별도 모듈):
    - `handleProjectLaneDrop` (line 178-203)
    - `handlePersonalCellTaskDrop` (line 221-276) — 단, **§11.2 #2 검증 결과로 type 추가는 보류** (dead code 가능성). 본 commit은 분기 함수만 추출, type 등록은 commit 11에서 team matrix와 함께 추가
    - `handleMatrixMsDrop` (line 279+, 1.5 분기)
  - 등록: `registerHandler('project-lane', handleProjectLaneDrop)` + `registerHandler('matrix-ms', handleMatrixMsDrop)`.
  - **handleDragEnd 본문** (W-3 fallback 패턴):
    ```js
    const handleDragEnd = useCallback((e) => {
      setActiveId(null)
      const handled = dispatch(e, ctx)
      if (handled) return
      // fallback: 기존 string-prefix 분기 (bl-* 등)
      const activeIdStr = String(e.active?.id ?? '')
      // ... 기존 line 152, 161, 206, 208, 212 분기 본문 보존 ...
    }, [...])
    ```
- [src/components/views/grid/cells/MilestoneRow.jsx:44](../../src/components/views/grid/cells/MilestoneRow.jsx#L44) `useSortable` 호출에 `data: { type: 'matrix-ms', cellKey: { projectId: ms.project_id, memberId: ms.owner_id } }` 추가
- 사이드바 프로젝트 lane (`project-lane:`) 등록 위치 — `src/components/Sidebar.jsx` 또는 유사 파일 — `useSortable` 호출에 `data: { type: 'project-lane', projectId, section }` 추가 (정확 파일은 grep 후 결정)

**미수정 (보존)**:
- line 152, 161, 206, 208, 212의 `bl-*` prefix 분기 — §11.2 #2 결과 확정 전까지 무수정. dispatch가 false 반환 시 fallback 분기 실행 (W-3 정정 패턴).

**Acceptance**:
- `git grep "id\.startsWith\('cell-ms" src/components/views/UnifiedGridView.jsx` → 0건 (matrix-ms는 type 등록)
- `git grep "id\.startsWith\('project-lane" src/components/views/UnifiedGridView.jsx` → 0건
- `git grep "id\.startsWith\('bl-" src/components/views/UnifiedGridView.jsx` → 잔존 OK (보존)

**회귀 검증**:
- V-S-08 (personal matrix): PersonalMatrixGrid → PersonalTodoShell 위임이므로 영향 없음
- 기존 cell-ms drag (MS row를 다른 cell로 cascade): 동일 동작
- 기존 project-lane (사이드바 프로젝트 reorder): 동일 동작

---

### Commit 10: PivotTaskCell SortableTaskCard 적용

**목적**: D-01 — Team matrix 카드 sortable + 셀 단위 SortableContext.

**수정 파일**:
- [src/components/views/grid/cells/PivotTaskCell.jsx](../../src/components/views/grid/cells/PivotTaskCell.jsx):
  - import 추가: `import SortableTaskCard from '../../../../components/dnd/SortableTaskCard'`, `import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'`, `import { useMemo } from 'react'`
  - `cellTasks` (line 26-30) 정렬 추가: `.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))`
  - `sortableContextId` 변수: `const sortableContextId = \`team-cell-sortable:${projectId}:${milestoneId ?? 'null'}:${memberId ?? 'null'}\``
  - `taskIds` useMemo: cellTasks의 `cell-task:${task.id}` 배열
  - return JSX 외곽을 `<SortableContext id={sortableContextId} items={taskIds} strategy={verticalListSortingStrategy}>`로 감쌈
  - line 102-153 `<div key={task.id}>` 카드 JSX:
    - **`isPrimary || isUnassignedCol` 조건일 때만 `SortableTaskCard`로 래핑**. secondary 표시는 일반 `<div>` (drag 비활성). 근거: §0.1 결정.
    - `SortableTaskCard` props: `id={\`cell-task:${task.id}\`}`, `data={{ type: 'team-matrix-task', task, cellKey: { projectId, msId: milestoneId, memberId } }}`, `dragOpacity={0.3}`
    - 기존 카드 컨텐츠 (체크박스 + text + detail arrow) 는 children으로 그대로 전달
    - **편집 중에는 listeners 분리** — editing 시 SortableTaskCard 외곽 div의 listener를 비활성. 단순화: SortableTaskCard에 `disabled` prop 추가 또는 editing 시 카드 자체를 wrapper 외부에 렌더 (commit 작업 시 가독성 좋은 방식 선택).

**검증**:
- 모든 primary 표시 카드에 grab cursor + drag 가능
- secondary 표시 카드는 drag 불가 (시각 동일, 동작만 비활성)
- 편집 모드 진입 시 drag 발동 안 함
- 같은 cell 내 카드 위에 drop → 자동 displacement 시각

---

### Commit 11: Team matrix handler + 헬퍼 + droppable 등록

**목적**: D-03 ~ D-07.

**신규 파일**:
- `src/utils/dnd/cellKeys/teamMatrix.js`:

```js
/* spec §5.3 v6 — view-별 namespace 보존 */

export function matchesCellKey(a, b) {
  return (a.projectId ?? null) === (b.projectId ?? null)
      && (a.msId ?? null) === (b.msId ?? null)
      && (a.memberId ?? null) === (b.memberId ?? null)
}

/**
 * Team matrix cell tasks — PivotMatrixTable + PivotTaskCell의 표시 필터를 그대로 인용.
 * spec §11.2 #5 검증 결과 반영.
 *
 * 입력 `tasks` = store의 전체 tasks 배열 (UnifiedGridView ctx.tasks). PivotTaskCell이 받는
 * 사전-필터된 tasks가 아님. 5단계 모두 본 함수 안에서 적용 (W-5 정합성 — 이중 필터 방지).
 */
export function getCellTasks(tasks, cellKey, ctx) {
  // (1) team scope (TeamMatrixGrid filter)
  const teamFiltered = tasks.filter(t => t.teamId === ctx.currentTeamId)

  // (2) PivotMatrixTable filter prop ('all' | 'unassigned' | 'assigned') — ctx.filter 주입
  const filterProp = ctx.filter ?? 'all'
  const propFiltered = filterProp === 'unassigned'
    ? teamFiltered.filter(t => t.assigneeId == null && t.secondaryAssigneeId == null && t.scope === 'team')
    : filterProp === 'assigned'
      ? teamFiltered.filter(t => t.assigneeId != null || t.secondaryAssigneeId != null)
      : teamFiltered

  // (3) project + done + deletedAt
  const projFiltered = propFiltered.filter(t =>
    t.projectId === cellKey.projectId &&
    !t.done &&
    !t.deletedAt
  )

  // (4) keyMilestoneId
  const msFiltered = projFiltered.filter(t => (t.keyMilestoneId ?? null) === (cellKey.msId ?? null))

  // (5) memberId — 미배정 cell은 PivotTaskCell line 27 패턴
  const cellTasks = cellKey.memberId == null
    ? msFiltered.filter(t => t.assigneeId == null && t.secondaryAssigneeId == null && t.scope === 'team')
    : msFiltered.filter(t => t.assigneeId === cellKey.memberId)
    // 주: secondary는 reorder 대상 아님 (drag 비활성, §0.1)

  return cellTasks.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}
```

- `src/utils/dnd/resolveMemberFromX.js`:

```js
const LABEL_GUTTER = 130

export function resolveMemberFromX(rect, event, members) {
  const dropX = (event.activatorEvent?.clientX ?? 0) + (event.delta?.x ?? 0)
  const relX = dropX - rect.left - LABEL_GUTTER
  if (relX < 0) return '__GUTTER__'
  const colWidth = (rect.width - LABEL_GUTTER) / (members.length + 1)  // +1 = 미배정 컬럼
  const idx = Math.floor(relX / colWidth)
  if (idx < 0 || idx >= members.length + 1) return '__GUTTER__'
  // members.length 인덱스 = 미배정 컬럼 → null
  return idx === members.length ? null : (members[idx]?.userId ?? null)
}
```

**참고**: 미배정 컬럼이 `members` 뒤에 추가 컬럼으로 존재한다는 PivotMatrixTable 구조 ([line 80](../../src/components/views/grid/PivotMatrixTable.jsx#L80))를 따름.

- `src/components/views/grid/dnd/teamMatrixHandlers.js` (혹은 inline in UnifiedGridView):

```js
import { arrayMove } from '@dnd-kit/sortable'
import { canMoveTaskToProject } from '../../../../utils/dnd/guards'
import { matchesCellKey, getCellTasks } from '../../../../utils/dnd/cellKeys/teamMatrix'
import { resolveMemberFromX } from '../../../../utils/dnd/resolveMemberFromX'

export function handleTeamMatrixTaskDrop(e, ctx) {
  const srcCellKey = e.active.data.current.cellKey
  const dstCellKey = e.over.data.current.cellKey
  const task = e.active.data.current.task

  if (matchesCellKey(srcCellKey, dstCellKey)) {
    const cellTasks = getCellTasks(ctx.tasks, srcCellKey, ctx)
    const oldIdx = cellTasks.findIndex(t => t.id === task.id)
    const newIdx = cellTasks.findIndex(t => t.id === e.over.data.current.task.id)
    if (oldIdx === -1 || newIdx === -1) return
    return ctx.reorderTasks(arrayMove(cellTasks, oldIdx, newIdx))
  }
  applyCrossCell(task, srcCellKey, dstCellKey, ctx)
}

export function handleTeamMatrixBandDrop(e, ctx) {
  const memberId = resolveMemberFromX(e.over.rect, e, e.over.data.current.members)
  if (memberId === '__GUTTER__') return                              // E-11
  const srcCellKey = e.active.data.current.cellKey
  const dstCellKey = {
    projectId: e.over.data.current.projectId,
    msId: e.over.data.current.msId,
    memberId,
  }
  if (matchesCellKey(srcCellKey, dstCellKey)) return                 // E-13
  applyCrossCell(e.active.data.current.task, srcCellKey, dstCellKey, ctx)
}

export function handleTeamMatrixProjectHeaderDrop(e, ctx) {
  const memberId = resolveMemberFromX(e.over.rect, e, e.over.data.current.members)
  if (memberId === '__GUTTER__') return
  const srcCellKey = e.active.data.current.cellKey
  const dstCellKey = {
    projectId: e.over.data.current.projectId,
    msId: null,
    memberId,
  }
  if (matchesCellKey(srcCellKey, dstCellKey)) return
  applyCrossCell(e.active.data.current.task, srcCellKey, dstCellKey, ctx)
}

function applyCrossCell(task, srcCellKey, dstCellKey, ctx) {
  const patch = { category: 'today' }                                // team matrix only
  if (srcCellKey.projectId !== dstCellKey.projectId) {
    const dstProject = ctx.projects.find(p => p.id === dstCellKey.projectId)
    if (!canMoveTaskToProject(task, dstProject)) return              // D-09
    patch.projectId = dstCellKey.projectId
    patch.keyMilestoneId = dstCellKey.msId                           // R5 차단용 명시
  }
  if ((task.keyMilestoneId ?? null) !== (dstCellKey.msId ?? null)) patch.keyMilestoneId = dstCellKey.msId
  if ((task.assigneeId ?? null) !== (dstCellKey.memberId ?? null)) patch.assigneeId = dstCellKey.memberId

  ctx.updateTask(task.id, patch)

  const dstTasks = getCellTasks(ctx.tasks, dstCellKey, ctx)
  const srcTasks = getCellTasks(ctx.tasks, srcCellKey, ctx).filter(t => t.id !== task.id)
  ctx.reorderTasks([...dstTasks, task])                              // dst 끝
  ctx.reorderTasks(srcTasks)                                         // src 갭 압축
}
```

**수정 파일**:
- `src/components/views/grid/cells/PivotMilestoneBand.jsx`:
  - import: `useDroppable` from '@dnd-kit/core'
  - 외곽 td 또는 div를 `useDroppable({ id: \`team-matrix-band:${projectId}:${msId ?? 'null'}\`, data: { type: 'team-matrix-band', projectId, msId, members } })` 로 등록
  - `isOver` 시 hover 배경 = `COLOR.dropTargetTint` (commit 12에서 토큰 추가 후 사용)
- `src/components/views/grid/cells/PivotProjectHeaderRow.jsx`:
  - 동일 패턴: id = `team-matrix-project-header:${projectId}`, data = `{ type: 'team-matrix-project-header', projectId, members }`
- [src/components/views/UnifiedGridView.jsx](../../src/components/views/UnifiedGridView.jsx):
  - import: 위 3개 handler
  - `registerHandler('team-matrix-task', handleTeamMatrixTaskDrop)`, `registerHandler('team-matrix-band', handleTeamMatrixBandDrop)`, `registerHandler('team-matrix-project-header', handleTeamMatrixProjectHeaderDrop)`
  - `ctx` 객체 구성: `{ tasks, projects, currentTeamId, filter, updateTask, reorderTasks }`

**Acceptance**: D-03, D-04, D-05, D-06, D-07 모두 동작.

**검증**: 6개 시나리오 manual:
1. 같은 셀 내 task 위치 변경
2. cross-member (같은 MS) drag/drop
3. cross-MS (같은 project) drag/drop
4. cross-project drag/drop
5. MS 밴드에 drop (특정 카드 위 아닌)
6. 프로젝트 헤더에 drop

각 시나리오에서 DB의 task row 직접 조회 → patch 정확성 검증.

---

### Commit 12: DroppableCell 토큰화 + 신규 토큰

**목적**: §12.5 — 색상 하드코딩 제거.

**수정 파일**:
- [src/styles/designTokens.js](../../src/styles/designTokens.js):
  - `COLOR` 객체에 토큰 추가:
    ```js
    dropTargetTint: 'rgba(35, 131, 226, 0.06)',  // accent 6% — DroppableCell 기존 hover 인용
    dropIndicator: '#3182CE',                     // DroppableCell 기존 outline 색
    ```
  실제 값은 Claude Web 결정 사항. 기본값으로 시작.
- [src/components/views/grid/shared/DroppableCell.jsx](../../src/components/views/grid/shared/DroppableCell.jsx) line 11:
  - `background: 'rgba(49,130,206,0.06)'` → `background: COLOR.dropTargetTint`
  - `outline: \`2px dashed #3182CE\`` → `outline: \`2px dashed ${COLOR.dropIndicator}\``

**검증**:
- `git grep "#3182CE\|rgba(49,130,206" src/components/views/grid/shared/DroppableCell.jsx` → 0건
- DroppableCell 사용처 (PersonalWeeklyGrid 등)에서 시각 동일

---

### Commit 13: DragOverlay + drop indicator + auto-scroll

**목적**: D-10 시각 피드백 완성.

**수정 파일**:
- [src/components/views/UnifiedGridView.jsx:427](../../src/components/views/UnifiedGridView.jsx#L427) `<DndContext>`:
  - `<DragOverlay>` 추가 — active.data.current.type이 `team-matrix-task`일 때 카드 미니어처 렌더 (Claude Web mockup 기준 — flat 또는 그림자)
  - auto-scroll: dnd-kit 기본값 활성 (autoScroll prop)
- `PivotMilestoneBand.jsx`, `PivotProjectHeaderRow.jsx`의 isOver 시각 피드백 마무리:
  - `dropTargetTint` 배경 + 1.5px solid `COLOR.dropIndicator` 라인

**검증**:
- drag 시 source 카드 opacity 0.3
- drag 시 DragOverlay 카드가 포인터 따라감
- 밴드/헤더 hover 시 배경 tint
- 화면 가장자리 근접 시 auto-scroll

---

### Commit 14: DELETE-5 sweep

**목적**: 폐기 코드 일소.

**삭제**:
- [src/components/views/grid/cells/PivotAddMsRow.jsx](../../src/components/views/grid/cells/PivotAddMsRow.jsx) (commit 7에서 호출 제거됨, 본 commit에서 파일 삭제)
- [src/components/views/grid/cells/PivotMsSubRow.jsx](../../src/components/views/grid/cells/PivotMsSubRow.jsx) (commit 4에서 `PivotMilestoneBand`로 교체됨)
- [src/components/views/grid/cells/PivotUngroupedSubRow.jsx](../../src/components/views/grid/cells/PivotUngroupedSubRow.jsx) (commit 4에서 dim 밴드로 교체됨)
- [PivotMatrixTable.jsx:81](../../src/components/views/grid/PivotMatrixTable.jsx#L81) `<col style={{ width: PIVOT.colWidthTotal }} />` 제거 (합계 컬럼)
- [PivotMatrixTable.jsx:115-121](../../src/components/views/grid/PivotMatrixTable.jsx#L115) `<th>합계</th>` 제거
- [PivotMatrixTable.jsx:64](../../src/components/views/grid/PivotMatrixTable.jsx#L64) `minWidth` 계산에서 `+ PIVOT.colWidthTotal` 제거 (I-3)
- [src/components/views/grid/cells/PivotProjectRow.jsx](../../src/components/views/grid/cells/PivotProjectRow.jsx) line 64-75 합계 셀 제거 (commit 5/14 사이의 내부 정리)
- **`PIVOT.colWidthTotal` 토큰**: [designTokens.js](../../src/styles/designTokens.js)에서 다른 사용처 확인 후 0건이면 토큰 자체 삭제 (I-3). DELETE-5 ⑤ types/tokens 단계.
- 모든 `PivotMilestoneBand` 호출부의 `colSpan={members.length + 3}` → `colSpan={members.length + 2}`로 일괄 갱신 (W-4 후속 — 합계 컬럼 제거 반영)

**미삭제 (보존 — §11.2 #2 결과)**:
- UnifiedGridView line 152, 161, 206, 208, 212의 `bl-*` prefix 분기 — 후속 phase에서 사용처 audit 후 정리

**검증**:
- `git grep "PivotAddMsRow\|PivotMsSubRow\|PivotUngroupedSubRow"` → 0건
- `git grep "합계" src/components/views/grid/` → 0건
- DELETE-5 (① import / ② caller / ③ props / ④ deps / ⑤ types) 5단계 완료
- `npm run build` 통과

---

## 3. DB 마이그레이션 요약

| 파일 | 조건 | SQL |
|---|---|---|
| `supabase/migrations/20260428000000_team_tasks_cross_project_dnd.sql` | commit 1 — 기존 정책으로 cross-project UPDATE 허용 안 될 때만 | DROP POLICY + CREATE POLICY (위 commit 1 §) |

스키마 변경 없음. tasks 컬럼 변경 없음. 기존 `sort_order` 재사용.

---

## 4. API 변경

**신규 엔드포인트 0개**. **수정 엔드포인트 0개**.

Supabase RLS 정책 변경 1건 (조건부, commit 1).

---

## 5. 프론트엔드 변경 요약

### 5.1 신규 파일

| 경로 | commit | 책임 |
|---|---|---|
| `src/utils/dnd/guards.js` | 2 | view-neutral 가드 (canMoveTaskToProject) |
| `src/utils/dnd/dispatcher.js` | 9 | type 기반 dispatch + HANDLERS map |
| `src/utils/dnd/cellKeys/teamMatrix.js` | 11 | team matrix matchesCellKey + getCellTasks |
| `src/utils/dnd/resolveMemberFromX.js` | 11 | 밴드 drop 멤버 컬럼 해석 |
| `src/components/dnd/SortableTaskCard.jsx` | 8 | 공통 카드 래퍼 + useSortableCard hook |
| `src/components/views/grid/cells/PivotMilestoneBand.jsx` | 3, 4 | 풀폭 MS 밴드 |
| `src/components/views/grid/cells/PivotProjectHeaderRow.jsx` | 3, 5, 7 | 헤더 행 + 카운트 인라인 + 호버 어포던스 |
| `src/components/views/grid/dnd/teamMatrixHandlers.js` | 11 | team matrix handler 함수들 (선택 — UnifiedGridView 내 inline 가능) |
| `supabase/migrations/20260428000000_team_tasks_cross_project_dnd.sql` | 1 (조건부) | RLS 정책 |

### 5.2 수정 파일

| 경로 | 영향 commit | 변경 내용 |
|---|---|---|
| `src/components/views/UnifiedGridView.jsx` | 9, 11, 13 | handleDragEnd → dispatch shell. registerHandler 등록. DragOverlay |
| `src/components/views/grid/PivotMatrixTable.jsx` | 4, 5, 6, 14 | colgroup 갱신, MS/Ungrouped 호출 변경, 합계 컬럼 제거 |
| `src/components/views/grid/cells/PivotProjectRow.jsx` | 5, 14 | PivotProjectHeaderRow 위임. 합계 셀 제거 |
| `src/components/views/grid/cells/PivotTaskCell.jsx` | 10 | SortableContext + SortableTaskCard 래핑 + cellTasks sortOrder 정렬 + secondary drag 비활성 |
| `src/components/views/grid/cells/MilestoneRow.jsx` | 9 | useSortable에 `data: { type: 'matrix-ms', cellKey }` 추가 |
| `src/components/views/grid/shared/DroppableCell.jsx` | 12 | 토큰화 |
| `src/components/views/personal-todo/PersonalTodoShell.jsx` | 2 | canMoveTaskToProject import 경로 변경 |
| `src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx` | 2 | canMoveTaskToProject 함수 정의 삭제 + import 갱신 |
| `src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx` | 8 | useSortable → useSortableCard |
| `src/styles/designTokens.js` | 6, 12 | LABEL_GUTTER, dropTargetTint, dropIndicator 토큰 추가 |
| `src/components/Sidebar.jsx` (또는 project-lane 등록 위치) | 9 | useSortable에 `data: { type: 'project-lane', ... }` 추가 |

### 5.3 삭제 파일 (commit 14)

- `src/components/views/grid/cells/PivotAddMsRow.jsx`
- `src/components/views/grid/cells/PivotMsSubRow.jsx`
- `src/components/views/grid/cells/PivotUngroupedSubRow.jsx`

---

## 6. 의존성 그래프

```
1 (RLS) ────────────────────────────────────► 11 (cross-project drop)
2 (guards) ─────────────────────────────────► 11 (canMoveTaskToProject)
3 (extract) ──► 4 (band) ──► 5 (header) ──► 6 (gutter) ──► 7 (+MS hover)
                                                                  │
8 (SortableTaskCard) ──┬──► 10 (PivotTaskCell sortable) ──┐       │
                       │                                   │       │
9 (dispatcher) ────────┼──► 11 (team handlers) ◄───────────┴───────┤
                       │                                           │
12 (DroppableCell tokens) ──► 13 (DragOverlay + indicator)         │
                                                                    │
14 (DELETE-5 sweep) ◄───────────────────────────────────────────────┘
```

빌드 테스트 가능한 중간 지점:
- commit 7 후: 시각만 변경된 상태 (DnD 미적용)
- commit 11 후: 모든 DnD 작동, 시각 보강 전
- commit 13 후: feature complete, DELETE-5 전
- commit 14 후: 최종 상태

---

## 7. 검증 절차

각 commit 후 다음 단계:

### 7.1 자동 검증

```bash
npm run build
git status
git diff --stat
```

### 7.2 회귀 테스트 매트릭스 (각 commit 후 해당 항목)

| commit | 회귀 시나리오 |
|---|---|
| 1 | RLS — 다른 팀원의 team task project_id 변경 시도 → 성공 |
| 2 | V-S-09c (백로그 → 다른 프로젝트), V-S-11 (`canMoveTaskToProject` import 단일) |
| 3 | 시각 동일성 sweep (전체 view) |
| 4 | L-03/L-04 시각 |
| 5 | L-02 시각 |
| 6 | L-06/L-07 시각 |
| 7 | L-05 시각 + MS 생성 동작 |
| 8 | V-S-09a/b/c/d — personal-todo 4 시나리오 |
| 9 | personal matrix MS drag (cell-ms 분기), 사이드바 프로젝트 reorder |
| 10 | drag 시작 동작, secondary 카드 drag 불가 확인 |
| 11 | D-02~D-07 6 시나리오 + DB row 검증 |
| 12 | DroppableCell 사용처 시각 동일 (PersonalWeeklyGrid는 라우팅 부재로 영향 없음) |
| 13 | DragOverlay 시각, auto-scroll, hover 피드백 |
| 14 | 빌드 통과, dead code 0 |

### 7.3 spec §8 V-* 체크리스트

commit 14 후 spec §8의 모든 V-* 항목 통과 확인.

### 7.4 수동 시각 검증 항목 (Claude Web mockup 대조)

- 밴드 색상
- 미분류 dim 정도
- `+ 마일스톤` 버튼 모양
- DragOverlay 카드 모양
- drop indicator 위치/폭
- 행 패딩 정확 값

---

## 8. Diff Plan에서 미해결 (별도 검토 필요)

| # | 항목 | 권장 처리 |
|---|---|---|
| 1 | UnifiedGridView `bl-*` 분기의 dead/active 최종 판정 | 후속 phase — `BacklogPanel`/`CompactMilestoneTab` 사용처 audit 후 결정 |
| 2 | secondary assignee drag 정책 | §0.1에서 결정 (drag 비활성). 향후 사용자 피드백으로 재검토 |
| 3 | `LABEL_GUTTER` 130 토큰화 vs commit 6에 인라인 결정 | commit 6 작업 시 결정 |
| 4 | `category: 'today'` 강제가 task의 prevCategory 흐름과 충돌하는지 | [applyTransitionRules](../../src/hooks/useStore.js#L30) 의 R1/R5/R7 사고 실험 (R3/R4는 useStore.js에 미존재 — I-2 정정). 본 phase는 done=false 상태 task만 drag 대상이므로 done/prevCategory 흐름과 무관할 가능성. commit 11 작업 시 검증 |
| 5 | personal matrix가 후속 phase에서 PivotMatrixTable 같은 구조로 통합될 때의 cellKey 마이그레이션 경로 | 본 phase 외 |

---

## 9. 다음 단계

```
/execute team-tasks-band-dnd
```

`/execute`는 본 diff plan의 commit 1부터 14까지 순차 실행한다. 각 commit 사이에 회귀 검증 + 빌드 통과 확인.

---

## Appendix A: 참고 commit / 파일

(spec v6 Appendix와 동일)

- `fd7a2bc` Loop-50 useSortable + SortableContext + sectionTasks 정렬
- `25ab17b` Loop-50 same-project task-on-task reorder
- `4687e67` Loop-49 hotfix — droppable ref 영역 확장
- `5b6e94b` Loop-46 QA — DndContext 위치 결정 근거

---

## Appendix B: Diff Reviewer Adversarial Review 결과 + Resolution

`diff-reviewer` subagent로 회의적 리뷰 수행. **Critical 0, Warning 6, Info 3, Edge case 2** 발견. 모두 inline 정정 또는 별도 결정으로 처리.

### B.1 Warning 처리 (구현 차단 사유 사전 제거)

| # | 결함 | 위치 | 처리 |
|---|---|---|---|
| W-1 | `resolveMemberFromX`의 spec §5.4와 diff-plan §2 commit 11 코드 불일치 (`members.length` vs `members.length + 1`) | spec §5.4 ↔ commit 11 | **diff-plan 버전을 정본으로 확정**. PivotMatrixTable line 80에 미배정 컬럼이 `members` 외 추가로 존재하므로 `+1` 정확. spec §5.4는 후속 spec v7 갱신 또는 본 diff-plan을 정본으로 인용 |
| W-2 | commit 8 PersonalTodoTaskRow 마이그레이션의 sameContext 가드 무결성 검증 부재 | commit 8 | acceptance에 4개 검증 단계 추가 (코드 리뷰 + 콘솔 직접 확인 + dnd-kit 버전 명시) |
| W-3 | commit 9 dispatcher의 fallback null vs undefined 모호 | commit 9 | dispatcher 반환값 명시: **true (처리됨) / false (type 미등록 → fallback)**. handleDragEnd 본문에 `const handled = dispatch(); if (handled) return;` 패턴 |
| W-4 | commit 4 `PivotMilestoneBand` props에서 `members` 사라져 `colSpan` 계산 불가 | commit 3, 4 | props를 `{ milestone, count, colSpan, dim, projectId }`로 정정. caller가 colSpan 직접 주입 |
| W-5 | commit 11 `getCellTasks`의 ctx.tasks 형태 모호 (전체 vs 사전 필터) | commit 11 | docstring 추가: "store 전체 tasks 배열. PivotTaskCell이 받는 사전-필터 tasks가 아님. 5단계 모두 본 함수 안에서 적용 (이중 필터 방지)" |
| W-6 | commit 7 `addMilestoneInProject` 시그니처 부재 | commit 7 | `addMilestoneInProject(project.id, { title: '' })` 정확 시그니처 명시 + useStore.js:1087 reference |

### B.2 Info 처리

| # | 결함 | 처리 |
|---|---|---|
| I-1 | BacklogPanel.jsx의 `bl-task:` prefix가 UnifiedGridView DndContext 내부인지 외부인지 미확정 | 이미 §0 #2에 "BacklogPanel/CompactMilestoneTab은 `src/components/project/` 위치 — UnifiedGridView 트리 외부" 결론. **§8 #1 후속 phase 항목**으로 정착 — UnifiedGridView line 152~212의 `bl-*` 분기는 dead code 가능성. fallback 패턴(W-3)으로 잠시 유지 |
| I-2 | §8 #4의 "applyTransitionRules R3/R4" 잘못된 참조 (실제는 R1/R5/R7만 존재) | inline 정정 — "R1/R5/R7 사고 실험" |
| I-3 | commit 14 DELETE-5에 `PIVOT.colWidthTotal` 토큰 + `minWidth` 계산 정리 누락 | commit 14에 토큰 삭제 + `minWidth` 계산 갱신 명시 추가 |

### B.3 Edge case (별도 검증 필요 — 구현 시 주의)

| # | 결함 | 처리 |
|---|---|---|
| E-Race | `reorderTasks` 연속 호출 시 dst/src 모두 sortOrder 0부터 시작 → store 레벨 race | spec §4-3 "last-write-wins" + cell 내 sort로 격리. 각 cell이 자기 sortOrder만 참조하므로 inter-cell 충돌은 시각적으로 문제 없음. 단 polling re-load 시 동일 sortOrder를 가진 task가 같은 cell에 들어오는 건 cellKey filter로 자동 분리. **commit 11 acceptance에 "DB row 직접 조회로 cell 내 sortOrder 0..N-1 검증" 추가** |
| E-Filter | `PivotTaskCell.tasks`가 사전 필터된 배열인 반면 `getCellTasks(ctx.tasks, ...)`는 전체 처리 | W-5 처리로 정합. `ctx.tasks`는 store의 전체. PivotTaskCell의 사전 필터는 표시 전용 (drag 미관여) |

### B.4 호평 (보존)

- §0.1 secondary assignee drag 정책의 조기 lock-down — 명시적 처리
- commit 3의 행동 변경 없는 추출 단계 분리 — R-ATOMIC 충실

### B.5 결론

Reviewer 판정: **CONDITIONAL PASS**. Warning 6건 inline 정정 완료 후 `/execute` 진입 가능.

남은 미해결 (`/execute` 중 결정):
- §8 #1 UnifiedGridView `bl-*` 분기 active/dead 최종 판정 — 사용처 audit 필요. fallback 패턴으로 보존되므로 안전
- §8 #2 secondary assignee drag 정책 — §0.1에서 결정 (drag 비활성)
- §8 #3 LABEL_GUTTER 토큰화 시점 — commit 6 작업 시 결정
- §8 #4 category='today' 강제 vs prevCategory 충돌 — commit 11 작업 시 검증
- §8 #5 personal matrix 후속 phase cellKey 마이그레이션 — 본 phase 외
