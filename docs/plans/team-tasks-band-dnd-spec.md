# SPEC v6: Team Tasks View — Band Layout & Drag-and-Drop

**Phase**: `team-tasks-band-dnd`
**Status**: v6 (v5 critical 3 + moderate 2 + minor 4 처리 → diff-plan 진입 가능)
**작성일**: 2026-04-28
**선행 문서**:
- 설계 의도: [docs/plans/recon-team-tasks-band-dnd.md](recon-team-tasks-band-dnd.md)
- 코드 검증 recon: [docs/plans/team-tasks-band-dnd-recon.md](team-tasks-band-dnd-recon.md)

---

## 0. v6 변경 요약

### 0.1 Critical 3건 처리 (코드 검증 결과 반영)

| # | v5 결함 | v6 처리 |
|---|---|---|
| 1 | PivotTaskCell의 personal/team 공유 여부 미확인 | **검증 완료**: PersonalMatrixGrid desktop = PersonalTodoShell 위임 (별도 DndContext). PivotTaskCell은 team matrix 전용. commit 10은 PivotTaskCell 단일 파일만 — R-ATOMIC 안전. v5 commit 9의 "PersonalMatrixGrid의 모든 useSortable" 사전조건은 **잘못된 가정** → 삭제. |
| 2 | `matchesCellKey` introspection이 §12.6 위반 | view별 모듈 분리: `src/utils/dnd/cellKeys/teamMatrix.js`. (personal matrix는 본 phase에서 cellKey 도입 안 함 — §0.4 참조) |
| 3 | `getCellTasks` filter chain 통일 위험 | view별 모듈 분리로 자동 해소. §11.2에 "team matrix cell selector 코드 직접 확인 + filter chain 명시" 추가 |

### 0.2 Moderate 2건 처리

| # | v5 결함 | v6 처리 |
|---|---|---|
| 1 | §11.2 #2 (bl-* active/dead) 보류가 §12.1과 충돌 | **§11.2 격상** — spec 확정 직전 필수 항목으로 마킹. 결과에 따라 commit 9 범위 조정 |
| 2 | 같은 cell 자체 밴드/헤더 drop = 침묵 reorder | E-13 신설 + §5.2 pseudo-code에 가드 추가 |

### 0.3 Minor 4건 처리

| # | v5 결함 | v6 처리 |
|---|---|---|
| 1 | E-02 체크 위치 | dispatcher에 single source — §5.1에 명시 |
| 2 | D-04 "다른 멤버면 assigneeId도" 모호 | `srcCellKey.memberId !== dstCellKey.memberId`로 명시 |
| 3 | V-S-09d 추상성 | "PersonalTodoTaskRow의 `data.sortableContextId`가 SortableTaskCard 마이그레이션 후 sameContext 가드에 그대로 작동" 명시 |
| 4 | matchesCellKey null 비교 안전성 | 모든 비교 `(a ?? null) === (b ?? null)` 통일 |

### 0.4 v6 핵심 결정: personal matrix는 본 phase 무영향

v5는 "commit 9가 personal matrix `useSortable` 호출에 type/cellKey 등록"을 가정했지만, 코드 검증 결과 **PersonalMatrixGrid desktop은 PersonalTodoShell로 완전 위임**되어 UnifiedGridView의 DndContext 안에 personal matrix 카드 드래그가 없다. PersonalMatrixMobileList(모바일)와 `grid/cells/TaskRow.jsx` (weekly schedule가 인용 — `BacklogPanel.jsx` 등) 가 존재하지만 본 phase 범위 외 — §11.2에서 사용처 확정 후 commit 9 범위에 추가 여부 판단.

**본 phase의 "personal matrix" 영향**:
- PersonalTodoShell (별도 DndContext) — 무수정
- PersonalMatrixMobileList — §11.2 검증 결과에 따름
- `grid/cells/TaskRow.jsx` 사용처 — §11.2 검증 결과에 따름

---

## 1. R-ATOMIC Commit 시퀀스 (확정 14개)

| # | Type | Title | 관련 REQ |
|---|---|---|---|
| 1 | `chore` | tasks UPDATE RLS 정책 보강 (cross-project 허용. 기존 정책 충분 시 본 commit 제거) | D-05 컨틴전시 |
| 2 | `refactor(dnd)` | `canMoveTaskToProject` → `src/utils/dnd/guards.js` 이전. PersonalTodoProjectGroup의 export 제거, 호출처 import 경로 갱신 | §12.3 |
| 3 | `refactor` | `PivotMilestoneBand` / `PivotProjectHeaderRow` 추출 (행동 변경 없음) | 구조 준비 |
| 4 | `feat` | MS를 풀폭 밴드로 렌더 + 미분류 밴드 dim | L-03, L-04 |
| 5 | `feat` | 프로젝트 헤더 행에 멤버별 카운트 통합 | L-02 |
| 6 | `feat` | 좌측 거터 130px + 행 패딩 조정 | L-06, L-07 |
| 7 | `feat` | 호버 어포던스 `+ 마일스톤` 버튼 | L-05 |
| 8 | `refactor(dnd)` | `SortableTaskCard` 공통 래퍼 추출 (`src/components/dnd/SortableTaskCard.jsx`) + PersonalTodoTaskRow 마이그레이션. **`data` 형태 보존**: `{ task, sortableContextId }` 그대로. | §12.4 |
| 9 | `refactor(dnd)` | UnifiedGridView `handleDragEnd` → `over.data.current.type` 디스패처. **본 phase 범위 = UnifiedGridView 안 active branch만**. `cell-ms:` ([MilestoneRow.jsx:44](../../src/components/views/grid/cells/MilestoneRow.jsx#L44))에 `data: { type: 'matrix-ms', cellKey: { projectId: project_id, memberId: owner_id } }` 등록. `project-lane:` 분기에 `data: { type: 'project-lane', ... }` 등록. **`bl-*`/`cell-task:` 분기 처리는 §11.2 검증 결과에 따라 결정** (active code면 type 등록, dead면 commit 14 DELETE-5 흡수). 헬퍼 신규: `src/utils/dnd/dispatcher.js` (HANDLERS map + dispatch shell). | §12.1, §12.2 |
| 10 | `feat` | `PivotTaskCell` 카드를 `SortableTaskCard`로 래핑. `data = { type: 'team-matrix-task', task, cellKey: { projectId, msId, memberId } }`. 셀 단위 `SortableContext` 등록 (id = `team-cell-sortable:${pid}:${msId ?? 'null'}:${memberId ?? 'null'}`, items = cellTasks의 id, strategy = `verticalListSortingStrategy`). | D-01, D-02 |
| 11 | `feat` | 디스패처에 `team-matrix-task` / `team-matrix-band` / `team-matrix-project-header` handler 추가. cross-cell drop 시 patch에 `category: 'today'` 강제 (해당 분기 내부에서만). MS 밴드 / 헤더 droppable 등록 (band-level only). **헬퍼 신규**: (a) `src/utils/dnd/cellKeys/teamMatrix.js` (`matchesCellKey`, `getCellTasks`) (b) `src/utils/dnd/resolveMemberFromX.js`. | D-03~D-07 |
| 12 | `refactor(tokens)` | `DroppableCell.jsx` 색상 하드코딩(`#3182CE`) → `COLOR.dropTargetTint` / `COLOR.dropIndicator` 토큰화 + designTokens.js 토큰 추가 | §12.5 |
| 13 | `feat` | DragOverlay 카드 모양 + drop indicator + auto-scroll | D-10 |
| 14 | `chore` | DELETE-5 sweep (합계 셀 인라인 코드, `PivotAddMsRow`, 구 `PivotMsSubRow`. §11.2 검증 결과 dead code면 `bl-*` UnifiedGridView 분기도) | recon §10 |

### 1.1 Commit 별 사전조건 / 검증

- **commit 1**: `git grep "tasks_update\|UPDATE.*tasks" supabase/migrations/`로 정책 확인. 충분하면 commit 제거.
- **commit 2**: `canMoveTaskToProject` import grep — 사용처 = PersonalTodoShell([Shell:11](../../src/components/views/personal-todo/PersonalTodoShell.jsx#L11)) + PersonalTodoProjectGroup self-import. 두 곳 갱신.
- **commit 8**: PersonalTodoTaskRow 마이그레이션 — drag/drop, transform, transition, dim, **`data.sortableContextId` prop 흐름 보존** (Loop-50 `25ab17b` sameContext 가드가 그대로 작동해야 함).
- **commit 9**: §11.2 #2 결과에 따라 범위 확정. dispatcher 도입 후 grep `id\.startsWith\('cell-` / `id\.startsWith\('project-lane` 가 dispatcher 본문에서 0건. `bl-*` 결과는 §11.2에 따름.
- **commit 10**: PivotTaskCell 단일 파일 수정. PersonalMatrixGrid 무영향 (PersonalTodoShell 위임).
- **commit 11**: cross-project 분기에 `canMoveTaskToProject` 가드 (commit 2 import 경로). team matrix cellKey filter chain은 §11.2 #5 결과 반영.

빌드는 모든 commit 사이에서 통과.

---

## 2. 아키텍처 결정

### 2.1 단일 DndContext (UnifiedGridView)

[UnifiedGridView.jsx:427](../../src/components/views/UnifiedGridView.jsx#L427) DndContext 그대로. 신규 컨텍스트 추가 금지 (Loop-46 QA `5b6e94b`).

### 2.2 두 DndContext 공존 = 의도된 결정

1. UnifiedGridView (매트릭스 + weekly schedule)
2. PersonalTodoShell (백로그 + 포커스)

본 phase 무변경. cross-view drag 요구 없음, sensor/collision 차이 의도적.

### 2.3 Droppable 등록 전략

**Band-level only** — 셀 단위 droppable 미등록.
- 등록: 프로젝트 헤더 (프로젝트당 1) + MS 밴드 (프로젝트 × (MS+1)). 총 ≈ 55개.
- 카드는 sortable.
- 빈 셀은 droppable 미등록.

멤버 컬럼 해석 = `resolveMemberFromX(over.rect, event, members)` (commit 11).

### 2.4 ID 컨벤션 — `data.current.type` 디스패치

`id`는 unique opaque, 의미는 `data` 에. handler 분기는 `over.data.current?.type`.

```js
// Team matrix 카드 (commit 10)
useSortable({
  id: `cell-task:${task.id}`,
  data: {
    type: 'team-matrix-task',
    task,
    cellKey: { projectId, msId, memberId },  // (project, MS, member)
  },
})

// Team matrix MS 밴드 (commit 11)
useDroppable({
  id: `team-matrix-band:${projectId}:${msId ?? 'null'}`,
  data: { type: 'team-matrix-band', projectId, msId, members },
})

// Team matrix 프로젝트 헤더 (commit 11)
useDroppable({
  id: `team-matrix-project-header:${projectId}`,
  data: { type: 'team-matrix-project-header', projectId, members },
})

// MS source (commit 9, 기존 useSortable에 data 추가)
useSortable({
  id: `cell-ms:${ms.id}`,
  data: {
    type: 'matrix-ms',
    cellKey: { projectId: ms.project_id, memberId: ms.owner_id },
  },
})

// project-lane (commit 9, 기존 useSortable에 data 추가)
useSortable({
  id: `project-lane:${pid}`,
  data: { type: 'project-lane', projectId: pid, section /* personal|team */ },
})
```

**디스패처** (commit 9, `src/utils/dnd/dispatcher.js`):

```js
export const HANDLERS = {
  'team-matrix-task': handleTeamMatrixTaskDrop,
  'team-matrix-band': handleTeamMatrixBandDrop,
  'team-matrix-project-header': handleTeamMatrixProjectHeaderDrop,
  'matrix-ms': handleMatrixMsDrop,        // personal/team 공유 (cell key = (project, owner) 동일)
  'project-lane': handleProjectLaneDrop,
  // 'personal-matrix-task' / 'cell-task on UnifiedGridView': §11.2 결과
}

export const dispatch = (e, ctx) => {
  // E-02: source = over 가드 (Minor 1) — dispatcher single source
  if (e.active?.id && e.over?.id && e.active.id === e.over.id) return
  if (!e.over) return

  const handlerKey = e.over.data.current?.type ?? e.active.data.current?.type
  const handler = HANDLERS[handlerKey]
  if (!handler) return
  return handler(e, ctx)
}
```

UnifiedGridView `handleDragEnd` = dispatch shell 한 줄.

---

## 3. REQ-LOCK 요구사항 (확정본 — v6)

### 3.1 Layout 요구사항

| ID | Requirement |
|---|---|
| L-01 | `합계` 컬럼 제거. 프로젝트 합계 = 헤더 인라인. MS 합계 = 밴드 우측. |
| L-02 | 프로젝트 헤더 행이 멤버 카운트 흡수. |
| L-03 | MS 라벨 = 풀폭 가로 밴드. |
| L-04 | 미분류 그룹 dim. 라벨 `미분류`. |
| L-05 | `+ 마일스톤` 호버 어포던스. |
| L-06 | 좌측 거터 130px. ellipsis 금지. |
| L-07 | 행 수직 패딩 축소. |
| L-08 | 멤버 컬럼 헤더, 그리드 = `130px + N×1fr`. |

### 3.2 DnD 요구사항 (v6 갱신)

| ID | Requirement | Acceptance |
|---|---|---|
| D-01 | Task 카드 sortable + 셀 단위 SortableContext | (1) `PivotTaskCell` 카드를 `SortableTaskCard` 래퍼로. data = `{ type: 'team-matrix-task', task, cellKey: { projectId, msId, memberId } }`. (2) 셀 단위 `SortableContext` 등록: id = `team-cell-sortable:${pid}:${msId ?? 'null'}:${memberId ?? 'null'}`, items = cellTasks id, strategy = `verticalListSortingStrategy`. |
| D-02 | 같은 (project, MS, member) reorder | `team-matrix-task` 분기. same-cell 판정 = `matchesCellKey(srcCellKey, dstCellKey)` from `src/utils/dnd/cellKeys/teamMatrix.js`. |
| D-03 | cross-member (같은 project, 같은 MS) | patch = `{ assigneeId: dstCellKey.memberId, category: 'today' }`. category 강제는 본 분기 내부만. |
| D-04 | cross-MS (같은 project) | patch = `{ keyMilestoneId: dstCellKey.msId, category: 'today' }`. **`srcCellKey.memberId !== dstCellKey.memberId` 시 `assigneeId: dstCellKey.memberId`도 추가** (Minor 2). |
| D-05 | cross-project | (1) `canMoveTaskToProject(task, dstProject)` 가드 from `src/utils/dnd/guards.js`. (2) patch = `{ projectId, keyMilestoneId, assigneeId, category: 'today' }`. R5/R7 자동. |
| D-06 | MS 밴드 drop (`team-matrix-band`) | `handleTeamMatrixBandDrop`. (1) `resolveMemberFromX` → memberId 또는 `__GUTTER__`. (2) `__GUTTER__` 면 return. (3) **dst cellKey가 src cellKey와 일치 시 return** (E-13). (4) cross-project면 `canMoveTaskToProject`. (5) updateTask + reorderTasks. |
| D-07 | 프로젝트 헤더 drop (`team-matrix-project-header`) | 동일. dstCellKey.msId = null. E-13 가드 동일. |
| D-08 | API 무변경 | `updateTask` / `reorderTasks` 시그니처 무변경. 신규 store 액션 0개. |
| D-09 | scope 가드 | `canMoveTaskToProject` from `src/utils/dnd/guards.js`. 본 phase 신규 함수 작성 금지. |
| D-10 | 시각 피드백 | source 카드 `OPACITY.projectDimmed`. drop indicator 1.5px line + `COLOR.accent`. 밴드/헤더 hover = `COLOR.dropTargetTint` (commit 12). Loop-49 `4687e67` 참조: hit zone 넓게, 시각 영역 좁게. |

### 3.3 비기능 요구사항

| ID | Requirement |
|---|---|
| N-01 | DB 컬럼 변경 없음. RLS 정책은 commit 1 조건부. |
| N-02 | `updateTask` / `reorderTasks` / `canMoveTaskToProject` 시그니처 무변경. |
| N-03 | 본 phase 영향 = UnifiedGridView dispatcher + PivotTaskCell + PivotMatrix 트리 + PersonalTodoTaskRow(commit 8 wrapper) + designTokens. PersonalTodoShell `handleDragEnd` 무수정. |
| N-04 | `npm run build` 성공. |
| N-05 | TDZ rule 준수. |
| N-06 | 색상 하드코딩 0건. commit 12 DroppableCell 정리. |
| N-07 | UnifiedGridView dispatch order 우선순위 보존. |
| N-08 | `canMoveTaskToProject` import 단일 경로 (`src/utils/dnd/guards.js`). |

---

## 4. 사용자 결정 사항 요약

| Round | 질문 | 답변 | v6 적용 |
|---|---|---|---|
| 1 Q1 | Phase 범위 | Layout + DnD 모두 한 phase | §1 |
| 1 Q2 | drop 시 category | 항상 `'today'` | D-03/D-04/D-05 — `team-matrix-task` 분기 내부 |
| 1 Q3 | Cross-project drop | 지원 | D-05 |
| 1 Q4 | Store API | `updateTask` + `reorderTasks`만 | D-08 |
| 2 Q1 | reorderTasks 호출 규칙 | Dst 전체 + Src 갭 압축 | §5.4 |
| 2 Q2 | RLS 컨틴전시 | 마이그레이션 추가 | commit 1 (조건부) |
| 2 Q3 | 라벨 거터 drop | 거부 (no-op) | D-06/D-07 (`__GUTTER__`) |
| 2 Q4 | Undo | Out of Scope | §9 |

---

## 5. 데이터 흐름 명세

### 5.1 Dispatcher 분기 (commit 9)

E-02 + E-01 가드는 **dispatcher single source** (Minor 1):

```js
export const dispatch = (e, ctx) => {
  if (!e.over) return                                    // E-01
  if (e.active.id === e.over.id) return                  // E-02
  const handlerKey = e.over.data.current?.type ?? e.active.data.current?.type
  const handler = HANDLERS[handlerKey]
  if (!handler) return
  return handler(e, ctx)
}
```

Type → handler 매핑 (UnifiedGridView only):

| type | handler | source/over |
|---|---|---|
| `team-matrix-task` | `handleTeamMatrixTaskDrop` | team matrix 카드 → 카드 |
| `team-matrix-band` | `handleTeamMatrixBandDrop` | team matrix 카드 → MS 밴드 |
| `team-matrix-project-header` | `handleTeamMatrixProjectHeaderDrop` | team matrix 카드 → 프로젝트 헤더 |
| `matrix-ms` | `handleMatrixMsDrop` | MS source → MS/카드 over (personal/team 공유) |
| `project-lane` | `handleProjectLaneDrop` | 사이드바 프로젝트 reorder |
| `cell-task:` (UnifiedGridView 잔존) | **§11.2 #2 결과** | — |
| `bl-*:` (UnifiedGridView 잔존) | **§11.2 #2 결과** | — |

PersonalTodoShell의 `bl-task:`/`bl-project:`/`focus-card:` 분기는 별도 DndContext — 본 phase 무영향.

### 5.2 Team matrix handler pseudo-code (commit 10/11)

```
handleTeamMatrixTaskDrop(e, ctx):
  const srcCellKey = e.active.data.current.cellKey   // { projectId, msId, memberId }
  const dstCellKey = e.over.data.current.cellKey
  if (matchesCellKey(srcCellKey, dstCellKey)) {
    // same-cell reorder
    const cellTasks = getCellTasks(ctx.tasks, srcCellKey)
    const oldIdx = cellTasks.findIndex(t => t.id === e.active.data.current.task.id)
    const newIdx = cellTasks.findIndex(t => t.id === e.over.data.current.task.id)
    if (oldIdx === -1 || newIdx === -1) return
    return reorderTasks(arrayMove(cellTasks, oldIdx, newIdx))
  }
  applyCrossCell(e.active.data.current.task, srcCellKey, dstCellKey, ctx)
  return

handleTeamMatrixBandDrop(e, ctx):
  const memberId = resolveMemberFromX(e.over.rect, e, e.over.data.current.members)
  if (memberId === '__GUTTER__') return                                    // E-11
  const srcCellKey = e.active.data.current.cellKey
  const dstCellKey = {
    projectId: e.over.data.current.projectId,
    msId: e.over.data.current.msId,
    memberId,
  }
  if (matchesCellKey(srcCellKey, dstCellKey)) return                       // E-13
  applyCrossCell(e.active.data.current.task, srcCellKey, dstCellKey, ctx)

handleTeamMatrixProjectHeaderDrop(e, ctx):
  const memberId = resolveMemberFromX(e.over.rect, e, e.over.data.current.members)
  if (memberId === '__GUTTER__') return
  const srcCellKey = e.active.data.current.cellKey
  const dstCellKey = {
    projectId: e.over.data.current.projectId,
    msId: null,
    memberId,
  }
  if (matchesCellKey(srcCellKey, dstCellKey)) return                       // E-13
  applyCrossCell(e.active.data.current.task, srcCellKey, dstCellKey, ctx)

// 공통 헬퍼 (commit 11 내부, src/utils/dnd/cellKeys/teamMatrix.js 가능)
function applyCrossCell(task, srcCellKey, dstCellKey, ctx) {
  const patch = { category: 'today' }                                       // team matrix only
  if (srcCellKey.projectId !== dstCellKey.projectId) {
    const dstProject = ctx.projects.find(p => p.id === dstCellKey.projectId)
    if (!canMoveTaskToProject(task, dstProject)) return                     // D-09
    patch.projectId = dstCellKey.projectId
    patch.keyMilestoneId = dstCellKey.msId                                  // R5 차단용 명시 보존
  }
  if ((task.keyMilestoneId ?? null) !== (dstCellKey.msId ?? null)) patch.keyMilestoneId = dstCellKey.msId
  if ((task.assigneeId ?? null) !== (dstCellKey.memberId ?? null)) patch.assigneeId = dstCellKey.memberId
  updateTask(task.id, patch)

  const dstTasks = getCellTasks(ctx.tasks, dstCellKey)
  const srcTasks = getCellTasks(ctx.tasks, srcCellKey).filter(t => t.id !== task.id)
  reorderTasks([...dstTasks, task])                                          // dst 끝에 삽입
  reorderTasks(srcTasks)                                                     // src 갭 압축
}
```

### 5.3 view별 cellKey 모듈 (commit 11 — Critical 2/3 처리)

```js
// src/utils/dnd/cellKeys/teamMatrix.js
export function matchesCellKey(a, b) {
  return (a.projectId ?? null) === (b.projectId ?? null)
      && (a.msId ?? null) === (b.msId ?? null)
      && (a.memberId ?? null) === (b.memberId ?? null)
}

export function getCellTasks(tasks, cellKey) {
  return tasks
    .filter(t =>
      (t.projectId ?? null) === (cellKey.projectId ?? null) &&
      (t.keyMilestoneId ?? null) === (cellKey.msId ?? null) &&
      (t.assigneeId ?? null) === (cellKey.memberId ?? null)
    )
    .filter(/* team matrix 표시 필터 — §11.2 #5 검증 결과 반영 */)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}
```

`personal-matrix` 카드가 본 phase 영향 안에 들어오면(§11.2 #2 결과) 별도 모듈 `src/utils/dnd/cellKeys/personalMatrix.js`로 정의. **한 함수가 두 view의 cellKey를 introspection하지 않는다** (§12.6 보존).

### 5.4 resolveMemberFromX (commit 11)

```js
// src/utils/dnd/resolveMemberFromX.js
const LABEL_GUTTER = 130

export function resolveMemberFromX(rect, event, members) {
  const dropX = (event.activatorEvent?.clientX ?? 0) + (event.delta?.x ?? 0)
  const relX = dropX - rect.left - LABEL_GUTTER
  if (relX < 0) return '__GUTTER__'
  const colWidth = (rect.width - LABEL_GUTTER) / members.length
  const idx = Math.floor(relX / colWidth)
  if (idx < 0 || idx >= members.length) return '__GUTTER__'
  return members[idx]?.userId ?? null  // null = 미배정
}
```

정확 시그니처는 diff-plan에서 dnd-kit 이벤트 객체 형태 확인 후 확정. `LABEL_GUTTER`는 `LIST.colWidthLabelGutter` 등 디자인 토큰 도입 검토.

### 5.5 reorderTasks 호출 규칙 (Round 2 Q1)

[useStore.js:743-761](../../src/hooks/useStore.js#L743-L761):
- 인자 `Task[]` → `sortOrder = i` (0..N) + DB upsert each
- store array 순서 미변경 → 컴포넌트는 `sort((a,b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))` 직접

확정:
- 같은 cell reorder: 1회
- cross-cell drop: (1) `updateTask` (2) dst (3) src 모두 호출 — 끝/사이 구분 없음

### 5.6 `applyTransitionRules`

[useStore.js:30-82](../../src/hooks/useStore.js#L30-L82):
- R1: `assigneeId` 설정 → `scope='assigned'`
- R5: `projectId` 변경 → `keyMilestoneId=null` 자동 (patch에 명시 없을 때만). cross-project drop 시 dst MS 명시로 미발동
- R7: `scope='team'` → `assigneeId=null`. 다른 팀 cross-project drop 시 발동

D-05 다른 팀 분기는 R7 위임.

### 5.7 Optimistic 실패 시 롤백 (E-10)

본 phase 범위 외, polling cycle (≤10s)에 truth 갱신.

---

## 6. UI/시각 명세

**Claude Web mockup**(선행 초안 §13)을 정본으로.

**Claude Web 결정 항목**:
- MS 밴드 배경색
- 미분류 밴드 dim (`OPACITY.projectDimmed` 후보)
- `+ 마일스톤` 버튼 dashed-border
- DragOverlay 카드 그림자/rotation/scale
- drop indicator 위치 / 폭
- L-04 dim 토큰 / L-07 패딩 정확 값
- E-04 접힌 프로젝트 hover auto-expand
- `COLOR.dropTargetTint` 후보값
- `LABEL_GUTTER` 토큰화 검토

---

## 7. 엣지케이스

| ID | 엣지케이스 | 정책 |
|---|---|---|
| E-01 | drop 영역 밖 | `dispatch` 안 `if (!over) return` |
| E-02 | source = over | `dispatch` 안 single-source 가드 (Minor 1) |
| E-03 | MS 0개 프로젝트 | 헤더 droppable만 활성, 가상 backlog 안착 |
| E-04 | 접힌(▶) 프로젝트 hover | Claude Web 결정. 기본 후보: 300ms hover auto-expand |
| E-05 | cross-project drag 중 source MS 비워짐 | source MS 유지 |
| E-06 | 미배정 컬럼 drop | `assigneeId=null` |
| E-07 | 동시 편집 | last-write-wins |
| E-08 | 검색/필터 적용 drop | Team Tasks View 검색 UI 부재 |
| E-09 | drop 직후 polling | optimistic update + id+updated_at 비교 |
| E-10 | RLS 거부 | commit 1 마이그레이션. §5.7 |
| E-11 | 라벨 거터(0–130px) drop | `resolveMemberFromX` `__GUTTER__` → handler return |
| E-12 | personal matrix cross-cell drop | 본 phase 영향 0 — `category` 강제는 `team-matrix-task` 분기 내부만. PersonalTodoShell 자체 무수정 |
| **E-13** | **밴드/헤더 drop이 src와 같은 cellKey로 해석** | **`matchesCellKey` true 시 handler return** (Moderate 2). 사용자가 카드를 가까운 위치에 떨어뜨려도 침묵 reorder 없음 |

---

## 8. 검증 체크리스트 (post-impl)

| ID | Check |
|---|---|
| V-L-01~08 | (v3 동일) |
| V-D-01~10 | (v3 동일, D-01/D-02/D-04/D-06/D-07 acceptance는 §3.2 v6) |
| V-S-01 | category가 team matrix cross-cell drop 후 `'today'`. PersonalTodoShell 무영향 |
| V-S-02 | cross-project + 다른 팀 → R7로 assignee 비워짐 |
| V-S-03 | 신규 store 액션 0개 |
| V-S-04 | 마이그레이션 = RLS 정책 1개만 (필요 시) |
| V-S-05 | RLS 정책 commit 후 cross-project 동작 |
| V-S-06 | dst + src reorderTasks 모두 호출 |
| V-S-07 | 라벨 거터 drop 거부 |
| V-S-08 | **personal matrix 회귀 0** (PersonalMatrixGrid → PersonalTodoShell 위임 → PersonalTodoShell 무수정 보장으로 자동 충족. 단 §11.2 #2 결과로 추가 분기 생기면 V-S-08a~d 분해): |
| V-S-08a | (조건부) UnifiedGridView 잔존 personal-matrix 경로 same-cell reorder |
| V-S-08b | (조건부) 같은 경로 cross-member |
| V-S-08c | (조건부) 같은 경로 cross-category |
| V-S-08d | (조건부) 같은 경로 cross-project |
| V-S-09 | **personal-todo 회귀 0** — commit 8 SortableTaskCard + commit 2 guards 이전 영향: |
| V-S-09a | 백로그 task → 포커스 패널 drop — `isFocus: true, focusSortOrder: max+1` 동일 동작 |
| V-S-09b | focus 카드 reorder — `reorderFocusTasks` 동일 |
| V-S-09c | 백로그 task → 다른 프로젝트 — `canMoveTaskToProject` (commit 2 신 import 경로) + `projectId` 변경 |
| V-S-09d | **same-context reorder (Loop-50)** — `PersonalTodoTaskRow`의 `data.sortableContextId`가 `SortableTaskCard` 마이그레이션 후에도 그대로 첨부되어 `PersonalTodoShell.handleDragEnd` 의 sameContext 가드 (`sourceContextId === overContextId`)에서 동일 작동 (Minor 3) |
| V-S-10 | weekly schedule DnD 회귀 0 (라우팅 노출 + `cell-task:` 활용 시) — §11.2 #3 결과 반영 |
| V-S-11 | `canMoveTaskToProject` import 경로 단일 (`grep "canMoveTaskToProject" src/`) |
| V-S-12 | `SortableTaskCard` 가 PersonalTodoTaskRow + PivotTaskCell 양쪽 사용 |
| V-S-13 | 디스패처 type 기반 (`grep "id\.startsWith\('cell-\|id\.startsWith\('project-lane" src/components/views/UnifiedGridView.jsx` 0건) |
| V-S-14 | `bl-*` 처리 = §11.2 #2 결과 일치 |
| V-S-15 | `matchesCellKey` view-별 모듈에 위치 (`src/utils/dnd/cellKeys/`) — `grep "'msId' in cellKey\|'category' in cellKey"` 0건 |
| V-S-16 | E-13 자체-cell 밴드/헤더 drop 시 reorderTasks 호출 0회 |
| V-G-01~06 | (v3 동일) |

---

## 9. Out of Scope

- MS 밴드 자체 reorder
- 프로젝트 순서 reorder (사이드바 별도)
- 다중 선택 drag
- 키보드 a11y DnD
- Personal Tasks View 동일 패턴 복제 (별도 phase)
- 팀 vs 개인 scope cross drag
- Undo (Ctrl+Z)
- 실시간 RLS 거부 시 즉시 store 롤백
- 검색/필터 상태 drop
- 단일 DndContext hoist
- PersonalTodoShell `handleDragEnd` 디스패처화 (후속 phase)
- PersonalMatrixMobileList DnD 검토 (§11.2 #2 결과로 결정)

---

## 10. 코드 재사용 매트릭스

| 항목 | 위치 | 본 phase 사용 |
|---|---|---|
| `canMoveTaskToProject` | **commit 2 이후 `src/utils/dnd/guards.js`** | named import |
| `SortableTaskCard` | **commit 8 이후 `src/components/dnd/SortableTaskCard.jsx`** | useSortable + transform/transition + isDragging dim |
| `dispatch` + `HANDLERS` | **commit 9 이후 `src/utils/dnd/dispatcher.js`** | dispatch shell + type 등록 |
| Team matrix `matchesCellKey` / `getCellTasks` | **commit 11 이후 `src/utils/dnd/cellKeys/teamMatrix.js`** | view별 namespace |
| `resolveMemberFromX` | **commit 11 이후 `src/utils/dnd/resolveMemberFromX.js`** | 밴드/헤더 멤버 컬럼 해석 |
| `OPACITY.projectDimmed` | designTokens.js:129+ | dim/dragging |
| `COLOR.accent` | designTokens.js:18 | drop indicator |
| `COLOR.dropTargetTint`, `COLOR.dropIndicator` | **commit 12 이후 designTokens.js** | hover 배경, indicator 통일 |
| sensor / `pointerWithin` | UnifiedGridView line 427 | 재사용 |
| `arrayMove`, `CSS.Transform.toString` | npm | reorder + transform |
| `applyTransitionRules` | useStore.js:30-82 | R5/R7 |
| `reorderTasks` | useStore.js:743-761 | sortOrder 0..N |
| `updateTask` | useStore.js:614-635 | 시그니처 무변경 |
| `getCachedUserId` | useStore.js:112 | user id |

---

## 11. 다음 단계

### 11.1 Claude Web 시각 결정 (mockup 정본화)
1. §6 시각 토큰 (밴드 색·dim·hover·DragOverlay·indicator·auto-scroll·L-04 dim·L-07 패딩)
2. E-04 접힌 프로젝트 auto-expand
3. `COLOR.dropTargetTint` 후보값
4. DragOverlay 카드 그림자 정책
5. `LABEL_GUTTER` 토큰화 (`LIST.colWidthLabelGutter` 등)

### 11.2 ⚠ Spec 확정 직전 필수 코드 검증 (격상 — Moderate 1)

본 5건은 spec 확정 (= /diff-plan 진입) 전에 **모두 답이 나와야 한다**. "diff-plan에서"로 미루기 금지.

| # | 검증 항목 | 영향 |
|---|---|---|
| 1 | `git grep "tasks_update\|UPDATE.*tasks" supabase/migrations/`로 RLS 정책 확인 | commit 1 필요 여부 |
| 2 | UnifiedGridView line 152, 161, 206, 208, 212의 `bl-*` prefix가 active code인지 dead code인지. **`grep "useDraggable\|useSortable\|useDroppable" src/`에서 `bl-*` id 등록 위치 추적**. (1) PersonalTodoShell만 등록하면 dead → commit 14 흡수. (2) UnifiedGridView 트리에서 등록되는 `bl-*` 사용처(예: 모바일·weekly) 발견 시 commit 9에 type 등록 추가 | commit 9 범위 + commit 14 범위 + V-S-13/14 |
| 3 | `weekly-schedule` 라우팅 노출 여부 + `grid/cells/TaskRow.jsx`의 `useSortable` 사용처 | V-S-10 필수 여부, commit 9 추가 분기 |
| 4 | `SortableTaskCard` 인터페이스 (props/expose attributes) 초안 — PersonalTodoTaskRow의 `data: { task, sortableContextId }` + PivotTaskCell의 `data: { type, task, cellKey }` 양쪽 만족 | commit 8 |
| 5 | TeamMatrixGrid의 task 표시 필터 chain (`PivotMatrixTable.jsx` selector). **현재 [TeamMatrixGrid.jsx:14](../../src/components/views/grid/grids/TeamMatrixGrid.jsx#L14)는 `tasks.filter(t => t.teamId === currentTeamId)` 만 — PivotMatrixTable 내부 추가 필터(예: `!done`, `!deletedAt`) 정확 형태 확인** | commit 11 `getCellTasks` 의 `team matrix 표시 필터` 자리에 그대로 인용 |

상세화/검증 완료 후:

```
/diff-plan team-tasks-band-dnd
```

⚠️ §11.1 + §11.2 모두 완료 전 diff-plan 진입 금지.

---

## 12. 유니버설 DnD 정비 원칙

본 phase 종료 후 코드베이스에 정착시키는 규칙.

### 12.1 ID 컨벤션
- `id` = unique opaque string. 의미는 `data.current.type` + payload.
- handler는 `over.data.current?.type` 으로 분기. `id.startsWith(...)` 금지.

### 12.2 Handler 디스패처
- `handleDragEnd` = dispatch shell.
- 각 type 별 named handler.
- 새 type = `HANDLERS` map 등록.

### 12.3 가드 / 유틸 위치
- 가드: `src/utils/dnd/guards.js`
- 헬퍼: `src/utils/dnd/`
- View별 cellKey 모듈: **`src/utils/dnd/cellKeys/<view>.js`** — 한 함수가 여러 뷰의 cellKey를 introspection 금지 (§12.6 보존)
- View-specific 컴포넌트의 가드/헬퍼 export 금지

### 12.4 카드 래퍼
- 모든 sortable 카드 = `src/components/dnd/SortableTaskCard.jsx`
- useSortable + transform/transition + isDragging dim 한 곳에서
- 카드 내용 children, data prop으로 디스패처 정보 전달

### 12.5 토큰
- DnD 시각 효과 = designTokens.js
- 본 phase commit 12에서 `DroppableCell` 정리

### 12.6 Cell key 추상
- 매트릭스 종류마다 cellKey 차원 다름:
  - personal matrix: `(projectId, memberId, category)`
  - team matrix: `(projectId, msId, memberId)`
  - 미래 weekly-schedule: `(memberId, dayOfWeek)` 등
- Same-cell 판정 = 각 view의 type에 매핑된 handler가 자체 cellKey 비교
- 한 함수가 여러 view cellKey introspection 금지 (`'msId' in cellKey` 같은 분기 금지)
- 뷰가 다르면 type도 다르다 (`personal-matrix-task` vs `team-matrix-task`)

### 12.7 두 DndContext 정책 + PersonalTodoShell 마이그레이션
- 두 DndContext 공존 = 의도된 결정
- 새 뷰는 기존 두 DndContext 중 하나에 얹기 (Loop-46 함정)
- PersonalTodoShell `handleDragEnd`도 후속 phase에서 §12.1~12.4 패턴으로 마이그레이션

### 12.8 SortableContext 등록 단위
- 셀(또는 그룹) 단위 — 매트릭스 전체 1개 컨텍스트 금지

### 12.9 dispatch shell 단일 가드 위치
- E-01 (`!over`), E-02 (source = over) 같은 공통 가드는 dispatcher 안. handler 안에 중복 금지

---

## Appendix

### 핵심 commit
- `fd7a2bc` (2026-04-28) Loop-50 useSortable + SortableContext + sectionTasks 정렬
- `25ab17b` (2026-04-28) Loop-50 same-project task-on-task reorder + sameContext 가드
- `4687e67` (2026-04-27) Loop-49 hotfix — droppable ref 영역 확장
- `127e187` Loop-49 cross-project drop + same-type validation
- `b6c8de5` Loop-49 V5 가드 시각 피드백
- `5b6e94b` Loop-46 QA — DndContext 위치 결정 근거

### 핵심 파일
- [UnifiedGridView.jsx:170-](../../src/components/views/UnifiedGridView.jsx#L170) — handleDragEnd (commit 9)
- [UnifiedGridView.jsx:427](../../src/components/views/UnifiedGridView.jsx#L427) — DndContext
- [PivotTaskCell.jsx:102-153](../../src/components/views/grid/cells/PivotTaskCell.jsx#L102-L153) — SortableTaskCard 적용
- [PersonalMatrixGrid.jsx](../../src/components/views/grid/grids/PersonalMatrixGrid.jsx) — desktop = PersonalTodoShell 위임 (본 phase 무영향 확정)
- [TeamMatrixGrid.jsx](../../src/components/views/grid/grids/TeamMatrixGrid.jsx) — PivotMatrixTable wrapper
- [PersonalTodoShell.jsx](../../src/components/views/personal-todo/PersonalTodoShell.jsx) — sameContext 가드 정본 (무수정)
- [PersonalTodoProjectGroup.jsx:13](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx#L13) — `canMoveTaskToProject` (commit 2 이전 위치)
- [PersonalTodoTaskRow.jsx](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx) — useSortable (commit 8 마이그레이션)
- [grid/cells/TaskRow.jsx](../../src/components/views/grid/cells/TaskRow.jsx) — `useSortable` 사용 — §11.2 #3 검증 대상
- [grid/cells/MilestoneRow.jsx:44](../../src/components/views/grid/cells/MilestoneRow.jsx#L44) — `cell-ms:` source (commit 9 type 등록)
- [grid/shared/DroppableCell.jsx](../../src/components/views/grid/shared/DroppableCell.jsx) — 토큰화 대상 (commit 12)

### 신규 모듈
- `src/utils/dnd/guards.js` — `canMoveTaskToProject` (commit 2)
- `src/components/dnd/SortableTaskCard.jsx` — 공통 카드 래퍼 (commit 8)
- `src/utils/dnd/dispatcher.js` — `dispatch` + `HANDLERS` (commit 9)
- `src/utils/dnd/cellKeys/teamMatrix.js` — team matrix `matchesCellKey`, `getCellTasks` (commit 11)
- `src/utils/dnd/resolveMemberFromX.js` — 밴드 drop 멤버 컬럼 해석 (commit 11)
- `src/styles/designTokens.js` — `dropTargetTint`, `dropIndicator` 토큰 (commit 12)

### 핵심 함수
- `applyTransitionRules` — R1/R5/R7
- `reorderTasks(reorderedTasks)` — sortOrder 0..N
- `updateTask(id, patch)` — 시그니처 무변경
- `canMoveTaskToProject(task, targetProject)` — 위치 변경 (commit 2)
- `getCachedUserId()`
- `matchesCellKey(srcCellKey, dstCellKey)` — view별 모듈 (commit 11)
- `getCellTasks(tasks, cellKey)` — view별 모듈 (commit 11)
- `resolveMemberFromX(rect, event, members)` — `__GUTTER__` 또는 memberId (commit 11)
- `dispatch(e, ctx)` — dispatch shell (commit 9)
