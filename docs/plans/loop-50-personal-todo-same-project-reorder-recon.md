---
phase: loop-50-personal-todo-same-project-reorder
date: 2026-04-27
status: recon
prev: loop-49-note-font-and-cross-project-dnd
next: spec
---

# Loop-50 Recon — 지금 할일 같은 프로젝트 내 task 상하 순서 변경

> **사용자 요구**: "지금 할일" 섹션에서 같은 프로젝트 안의 task 를 drag & drop 으로 상하 순서 변경.
> **Loop-49 후속**: cross-project DnD 가 동작하는 자연스러운 다음 요구 (Loop-49 N-04 → Loop-50 으로 승격).

---

## 1. 코드베이스 영향 범위 분석

### 1-1. 현재 상태 (실측)

| 항목 | 위치 | 동작 |
|---|---|---|
| Task DnD 등록 | [PersonalTodoTaskRow.jsx:25-28](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx#L25) | `useDraggable({ id: 'bl-task:${task.id}', data: { task } })` — **useSortable 아님** |
| SortableContext | (없음) | PersonalTodoListTable / ProjectGroup 어디에도 없음 |
| Task list 정렬 | [PersonalTodoListTable.jsx:30-42](../../src/components/views/personal-todo/PersonalTodoListTable.jsx#L30) | `tasks.filter(...)` 만, 명시 sort 없음. useStore 가 `order('sort_order')` 로 fetch 한 자연 순서 사용 |
| Reorder action | [useStore.js:743-761](../../src/hooks/useStore.js#L743) | `reorderTasks(reorderedList)` 이미 존재 — 매트릭스가 사용 중. sortOrder 0,1,2,... 일괄 갱신 |
| Cross-project drop | [PersonalTodoShell.jsx:99-113](../../src/components/views/personal-todo/PersonalTodoShell.jsx#L99) | Loop-49 에서 구현 — `bl-task:* → bl-project:*` 분기 |

### 1-2. 매트릭스 view 의 reorder 패턴 (재사용 후보)

[CellContent.jsx:99-105](../../src/components/views/grid/cells/CellContent.jsx#L99) — Cell 안 task list 를 `<SortableContext items={taskIds} strategy={verticalListSortingStrategy}>` 로 감쌈.

[TaskRow.jsx:24-25](../../src/components/views/grid/cells/TaskRow.jsx#L24) — `useSortable({ id: 'cell-task:${task.id}' })` 사용.

[UnifiedGridView.jsx:221-275](../../src/components/views/UnifiedGridView.jsx#L221) — `handleDragEnd` 에서:
- `if (overId.startsWith('cell-task:'))` 분기 진입
- `sameCell` (project + assignee + category 모두 일치) → `arrayMove` + `reorderTasks(reordered)`
- `crossCell` → `updateTask({ projectId, assigneeId, category, keyMilestoneId })`

**완전 재사용 가능한 패턴**.

### 1-3. 핵심 발견 — 정렬 누락 위험 (R5)

[PersonalTodoListTable.jsx:30](../../src/components/views/personal-todo/PersonalTodoListTable.jsx#L30) 의 `myTasks = tasks.filter(...)` 결과는 **store 의 tasks array 순서 그대로**. store 의 `reorderTasks` ([useStore.js:746](../../src/hooks/useStore.js#L746)) 는:

```js
set(s => ({
  tasks: s.tasks.map(t => {
    const u = updates.find(x => x.id === t.id)
    return u ? { ...t, sortOrder: u.sortOrder } : t
  })
}))
```

→ **sortOrder 필드만 갱신, array 순서는 변경 안 함**. 따라서 reorder 후 view 가 즉시 갱신되지 않음 (다음 fetch/polling 후에야 새 sortOrder 가 array 순서로 반영됨).

**해결 방향**: PersonalTodoProjectGroup 또는 PersonalTodoListTable 에서 sectionTasks 를 `.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))` 로 명시 정렬 필요. UnifiedGridView 의 cellTasks 가 동일 패턴 ([UnifiedGridView.jsx:251](../../src/components/views/UnifiedGridView.jsx#L251)).

---

## 2. 영향받는 파일/모듈 목록

| 파일 | 변경 유형 |
|---|---|
| [src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx) | `useDraggable` → `useSortable` 교체. transform 적용 (Translate → Transform), transition 추가 |
| [src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx) | `<SortableContext items={taskIds} id={...} strategy={verticalListSortingStrategy}>` 로 task list 감쌈. sectionTasks 정렬 추가 |
| [src/components/views/personal-todo/PersonalTodoShell.jsx](../../src/components/views/personal-todo/PersonalTodoShell.jsx) | `handleDragEnd` 에 same-project task-on-task drop 분기 추가 (`bl-task:* → bl-task:*`). reorderTasks store action 사용 |

**부수적 영향 없음**: useStore (기존 reorderTasks 재사용), 다른 view (CellContent / TaskRow 매트릭스 패턴 무영향), 호출처 무영향.

---

## 3. 구현 옵션 + Trade-off

### Option A — Same project + same section 안만 reorder, cross-section/cross-project task-on-task 는 무시 (MVP, 권장)

- **drop on bl-task:**: source 와 target 의 (project, section) 모두 일치하면 reorder, 아니면 무시 (drop 무동작)
- 다른 project 로 옮기려면 기존 cross-project (헤더 drop) 사용
- 다른 section 으로 옮기려면 detail panel 의 category 드롭다운 사용
- **장점**: 사용자 명시 요구만 정확히 충족. validation 단순. 회귀 위험 최소
- **단점**: task-on-task drop 으로 다른 project / section 이동은 안 됨 — 사용자가 "왜 안 되지?" 헷갈릴 수 있음
- **LOC**: ~+25
- **리스크**: 저

### Option B — Same project + same section reorder + cross-section/cross-project task-on-task = move + insert at position

- **drop on bl-task:**: same (proj+section) → reorder. 다른 (proj or section) → updateTask({ projectId, category, ... }) + 가능하면 그 위치에 insert
- 매트릭스의 (project, assignee, category) cellKey 기반 sameCell/crossCell 판단 패턴 그대로 적용
- **장점**: 기능 풍부, 매트릭스 UX 와 일관성. cross-project 도 task-on-task drop 으로 가능 → 헤더 drop 외 추가 경로
- **단점**: cross-project 시 scope 가드 동일 위험 (Loop-49 §1-3 참조). insert position 계산 복잡 (target task 의 sortOrder 와 인접 sortOrder 사이로 끼움). validation matrix 확장 (Loop-49 §4-2 의 8 케이스 + section 차원)
- **LOC**: ~+50
- **리스크**: 중

### Option C — Same project reorder + cross-section task drop = section 변경만 (cross-project 무시)

- **drop on bl-task:**: same project + same section → reorder. same project + 다른 section → category 변경. 다른 project → 무시
- 같은 project 안에서 today ↔ next ↔ backlog 이동을 task-on-task drop 으로 가능
- **장점**: section 이동이 직관적 (drag 한 task 가 그 section 안에 들어감). cross-project 는 헤더 drop (Loop-49) 로 분리 → scope 가드 위험 없음
- **단점**: Option A 보다 +section 이동 1 케이스 추가, 살짝 복잡
- **LOC**: ~+35
- **리스크**: 중-저

### 권장: **Option A** (MVP)

근거:
- 사용자 보고는 "같은 프로젝트 내 task 상하 순서 변경" 만 명시 — Option A 가 정확히 일치
- Option B 의 cross-project task-on-task 는 헤더 drop (Loop-49) 와 중복 + scope 가드 위험 재발
- Option C 의 cross-section task drop 은 사용자가 명시적으로 요구 안 함 — 후속 Loop 후보

---

## 4. 재사용 가능한 기존 코드/패턴

| 재사용 대상 | 위치 | 활용 |
|---|---|---|
| `reorderTasks(reorderedList)` store action | [useStore.js:743-761](../../src/hooks/useStore.js#L743) | 그대로 호출. sortOrder 0,1,2,... 갱신 + DB upsert |
| `useSortable` + `verticalListSortingStrategy` 패턴 | [TaskRow.jsx:24](../../src/components/views/grid/cells/TaskRow.jsx#L24) + [CellContent.jsx:100](../../src/components/views/grid/cells/CellContent.jsx#L100) | 패턴 동일 적용. id prefix `bl-task:` 유지 |
| `arrayMove(list, oldIdx, newIdx)` from `@dnd-kit/sortable` | UnifiedGridView L263, PersonalTodoShell L108 (focus reorder) | 동일 패턴 |
| `cellTasks.sort((a,b) => sortOrder)` 명시 정렬 | [UnifiedGridView.jsx:251](../../src/components/views/UnifiedGridView.jsx#L251) | sectionTasks 정렬 추가 시 동일 패턴 |
| Loop-49 cross-project DnD 분기 | [PersonalTodoShell.jsx:99-113](../../src/components/views/personal-todo/PersonalTodoShell.jsx#L99) | 변경 없음. same-project task-on-task 분기를 그 위/아래에 추가 |
| `data: { task }` 첨부 (Loop-49 R-06) | [PersonalTodoTaskRow.jsx:27](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx#L27) | 유지. useSortable 도 동일 data 형태 지원 |
| ProjectGroup 의 droppable (Loop-49 R-04 hotfix) | [PersonalTodoProjectGroup.jsx:41](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx#L41) | 유지. useSortable 등록과 별개 (헤더 drop 은 cross-project, task-on-task 는 same-project reorder) |
| `CSS.Translate.toString(transform)` (useDraggable 패턴) | [PersonalTodoTaskRow.jsx:38](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx#L38) | useSortable 로 변경 시 `CSS.Transform.toString(transform)` + `transition` 추가 |

---

## 5. 위험 요소 / 사전 확인 필요 사항

### 코드 위험

| # | 위험 | 완화 |
|---|---|---|
| R1 | **R5 (정렬 누락)**: store 의 `reorderTasks` 가 sortOrder 만 갱신, array 순서 미변경 → reorder 후 view 즉시 갱신 안 됨 | PersonalTodoProjectGroup (또는 PersonalTodoListTable) 의 sectionTasks 를 `.sort((a,b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))` 로 명시 정렬. UnifiedGridView L251 패턴 |
| R2 | useSortable 은 useDraggable + useDroppable 결합 → task row 자체가 droppable. ProjectGroup 의 droppable (Loop-49) 와 collision detection 충돌 가능 | rectIntersection 이 dragged task 의 rect 와 task row + ProjectGroup 두 droppable 모두에 over 매치 → 더 가까운 (더 큰 intersection) target 우선. Shell handler 에서 `bl-task:* → bl-task:*` 분기를 `bl-task:* → bl-project:*` 분기보다 먼저 검사하면 task-on-task 우선. 명시 필요 |
| R3 | SortableContext id 충돌 — 한 view 에 여러 ProjectGroup → 여러 SortableContext. items 가 같은 task id 를 다른 context 에 등록하면 dnd-kit 혼란 | 각 ProjectGroup 의 SortableContext id 를 unique 하게: `bl-project-sortable:${project.id}:${section}`. items 는 그 group 안 task id 만 |
| R4 | Milestone group 간 task 이동 시 keyMilestoneId 변경 여부 | 본 Loop 옵션 A: 같은 project + section 안 reorder만 → milestone 무관. keyMilestoneId 보존 (변경 안 함). 사용자가 다른 milestone 의 task 위로 drop 해도 milestone 정렬 grouping 은 시각적 효과만 — 실제 task 의 milestone 변경 안 함 |
| R5 | 같은 project + section 의 task 가 1개일 때 SortableContext + useSortable 이 noop인지 | items 1개 SortableContext 도 정상 등록. drag 시작은 가능하지만 다른 target 없음 → drop = no-op. 안전 |
| R6 | drag overlay 미사용 (Loop-49 와 동일) → useSortable 의 transform/transition 이 row 자체에 적용. 시각적 ghost 없이 row 가 직접 움직임 | useSortable 의 기본 동작. matrix view 도 같은 방식 (drag overlay 매트릭스에서는 사용하지만 personal todo 는 미사용). 회귀 없음 |
| R7 | sortOrder 가 0,1,2,... 로 reset 되면 새 task 추가 시 충돌? | addTask 의 newTask sortOrder = `Date.now()` (1.7T 큰 숫자) → reorder 한 task 들 (0,1,2,...) 다음 자동 위치. ✓ |
| R8 | 매트릭스 view 에서 동일 task 를 reorder → personal todo view 의 같은 project group 에도 sortOrder 변경 반영 (전역 sortOrder) | 의도된 동작 (sortOrder 는 task 단위 전역 필드). 사용자 인지 필요 — 큰 영향 없음 |
| R9 | drop 직후 store optimistic update + DB upsert. polling 으로 외부 sync 도착 시 sortOrder race? | optimistic update 가 즉시 반영. DB upsert 가 같은 sortOrder 로 sync. polling 은 같은 값 → no-op |

### 정책 위험

| # | 위험 | 완화 |
|---|---|---|
| P1 | Loop-49 의 N-04 ("같은 project 내 task reorder = 본 Loop 범위 외") 가 본 Loop 으로 명시 승격됨 | spec 에 명시. cross-project DnD (Loop-49) 와 별개 기능 |
| P2 | Cross-project DnD (Loop-49) 와 same-project reorder (Loop-50) 의 UX 분리 | 헤더 drop = cross-project, task row drop = same-project reorder. drag 시 사용자가 어느 영역에 drop 할지 명확 |

### 사전 확인 항목 (Spec 단계)

1. **옵션 결정**: Option A (same project + section 만) vs B (cross-section/cross-project 포함) vs C (cross-section 만). **권장 A** (사용자 명시 정확히 충족, MVP).
2. **적용 섹션 범위**: "지금 할일" 만 vs "지금 + 다음 + 남은" 모두. 권장 **3개 섹션 모두** (PersonalTodoTaskRow 가 공유 컴포넌트 → 자동 적용 자연스러움. Loop-49 의 cross-project DnD 도 3개 섹션 모두 적용했음).
3. **sectionTasks 정렬 위치**: PersonalTodoListTable (filter 직후) vs PersonalTodoProjectGroup (filter 후). 권장 **PersonalTodoProjectGroup** (project filter 결과에 sort 적용 → 영향 범위 최소).
4. **Shell handler 분기 순서**: `bl-task:* → bl-task:*` (same-project reorder) vs `bl-task:* → bl-project:*` (cross-project move) 우선순위. 권장 **task-on-task 먼저** (구체적 target 우선).
5. **same-project + 다른 section task drop**: 무시 (Option A) vs 같은 section 으로 강제 reorder. 권장 **무시** (혼란 방지).
6. **Self-target (drag 한 task 자기 위로 drop)**: dnd-kit useSortable 기본 동작 — same id 면 reorder 안 함. 별도 처리 불필요.
7. **Milestone group 영향**: 다른 milestone 의 task 위로 drop 시 keyMilestoneId 보존 (Option A). 사용자가 milestone 변경 시도 시 detail panel 사용 명시.
8. **시각 피드백**: useSortable 의 기본 transform + transition 그대로. 별도 drag overlay 없음 (Loop-49 와 동일).
9. **회귀 테스트 시나리오**:
   - 같은 project + same section task 위/아래 drag → 순서 변경
   - 같은 project + 다른 section task 위 drag → 무시
   - 다른 project 의 task row 위 drag → 무시 (cross-project 는 헤더 drop 으로만)
   - 다른 project 헤더로 drag → cross-project move (Loop-49 동작 보존)
   - focus panel 로 drag → focus 등록 (Loop-45 동작 보존)
   - 1개 task 만 있는 project → drag 가능, drop 무효
   - 새 task 추가 후 reorder 한 list 끝에 자동 위치 (sortOrder Date.now() 효과)

---

## 6. 다음 단계

1. **Spec 작성** (`/spec loop-50-personal-todo-same-project-reorder`): §5 사전 확인 9건 결정. R-XX 요구사항 + N-XX non-goal + edge case + AC.
2. **Diff Plan**: 커밋 분리 (3 커밋 예상 — task row useSortable / ProjectGroup SortableContext + sort / Shell handler).
3. **Execute**: 빌드 + 통합 회귀 테스트.

---

## 부록: 분석 기준 코드 라인 색인

| 파일 | 주요 라인 |
|---|---|
| [PersonalTodoTaskRow.jsx](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx) | L25-28 useDraggable (변경 대상), L37-40 dragStyle |
| [PersonalTodoProjectGroup.jsx](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx) | L41-44 useDroppable (Loop-49 hotfix), L63-76 tasksWithLabels (sort 추가 위치), L186-190 task rows render |
| [PersonalTodoShell.jsx](../../src/components/views/personal-todo/PersonalTodoShell.jsx) | L77-132 handleDragEnd (same-project reorder 분기 추가 위치) |
| [PersonalTodoListTable.jsx](../../src/components/views/personal-todo/PersonalTodoListTable.jsx) | L30-42 myTasks filter (sort 추가 후보 위치) |
| [useStore.js reorderTasks](../../src/hooks/useStore.js) | L743-761 |
| [UnifiedGridView.jsx 매트릭스 reorder](../../src/components/views/UnifiedGridView.jsx) | L221-275 cell-task drop 분기 (재사용 패턴) |
| [CellContent.jsx](../../src/components/views/grid/cells/CellContent.jsx) | L99-105 SortableContext 패턴 |
| [TaskRow.jsx 매트릭스](../../src/components/views/grid/cells/TaskRow.jsx) | L24-25 useSortable 패턴 |
