---
phase: loop-50-personal-todo-same-project-reorder
source: docs/plans/loop-50-personal-todo-same-project-reorder-recon.md
date: 2026-04-27
status: spec-draft
prev: recon
next: diff-plan
---

# Loop-50 Spec — 지금 할일 같은 프로젝트 내 task 상하 순서 변경

> **승인된 결정 (AskUserQuestion)**:
> - Q1 동작 범위 = **Option A** (same project + same section 안만 reorder)
> - Q2 sort 위치 = **PersonalTodoProjectGroup 안**
> - Q3 Shell handler 분기 우선순위 = **task-on-task 먼저, 그 다음 project header**
> - Q4 적용 섹션 = **"지금" + "다음" + "남은" 3개 모두**

---

## 1. Scope (수정 대상 3개 파일)

| 파일 | 변경 요약 |
|---|---|
| [src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx) | `useDraggable` → `useSortable`. transform 적용 변경 (Translate → Transform), transition 추가. data 첨부에 sortableContextId 정보 추가 |
| [src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx) | `<SortableContext items={taskIds} id={contextId} strategy={verticalListSortingStrategy}>` 로 task list 감쌈. sectionTasks 를 sortOrder ASC 로 명시 정렬 |
| [src/components/views/personal-todo/PersonalTodoShell.jsx](../../src/components/views/personal-todo/PersonalTodoShell.jsx) | `handleDragEnd` 에 `bl-task:* → bl-task:*` (same-project + same-section) reorder 분기 추가. 우선순위 = project header 분기보다 먼저 검사 |
| [src/components/views/personal-todo/PersonalTodoListTable.jsx](../../src/components/views/personal-todo/PersonalTodoListTable.jsx) | TodaySection / CollapsibleSection 의 `<PersonalTodoProjectGroup>` 호출에 `section` prop 전달 (R-04 의존). 3 호출처 (today/next/backlog) (피드백 #4) |

**변경 없음**: DB 마이그레이션 / RLS / Edge Function / API / 환경 변수 / 패키지. **store action `reorderTasks` 재사용** ([useStore.js:743-761](../../src/hooks/useStore.js#L743)) — 시그니처/동작 무수정.

---

## 2. 요구사항

### R-01 — PersonalTodoTaskRow 를 useSortable 로 전환

**현상**: [PersonalTodoTaskRow.jsx:25-28](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx#L25) 가 `useDraggable` 사용 → reorder 불가.

**요구**:
1. `useDraggable` → `useSortable` 교체. id 는 `bl-task:${task.id}` 유지 (Loop-49 cross-project + Loop-45 focus drop 호환).
2. data 는 `{ task, sortableContextId }` 형태:
   - `task`: Loop-49 R-06 그대로 보존 (cross-project / 시각 피드백 의존)
   - `sortableContextId`: source task 가 속한 SortableContext 의 id (`bl-project-sortable:${projectId}:${section}`). Shell 의 sameContext 판단용.
3. transform: `CSS.Translate.toString(transform)` → `CSS.Transform.toString(transform)` 로 변경 (useSortable 표준).
4. `transition` 도 dragStyle 에 추가 (useSortable 반환값).
5. 기존 isDragging opacity 0.3, isFocus dim, hover/edit 동작 모두 보존.

### R-02 — PersonalTodoProjectGroup 에 SortableContext 추가 + sectionTasks 정렬

**현상**: [PersonalTodoProjectGroup.jsx:186-190](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx#L186) 가 sectionTasks 를 그대로 map. SortableContext 없음. sort 없음.

**요구**:
1. **section prop 추가**: `<PersonalTodoProjectGroup section="today" | "next" | "backlog" ... />`. 부모 (PersonalTodoListTable) 가 전달 — 각 섹션 (TodaySection, CollapsibleSection) 에서 자기 section 키 명시.
2. **sectionTasks 정렬** (R5 위험 해소):
   ```js
   const sortedTasks = useMemo(
     () => [...sectionTasks].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
     [sectionTasks]
   )
   ```
   - **위치**: tasksWithLabels 계산 직전. tasksWithLabels 는 sortedTasks 기준으로 재계산.
   - **`[...]` spread 필수**: in-place sort 가 store 의 sectionTasks 를 mutate 하면 React 미감지. 새 배열 생성.
3. **SortableContext 등록**:
   ```js
   const taskIds = sortedTasks.map(t => `bl-task:${t.id}`)
   const sortableContextId = `bl-project-sortable:${project.id}:${section}`
   ```
   ```jsx
   <SortableContext items={taskIds} id={sortableContextId} strategy={verticalListSortingStrategy}>
     {sortedTasks.map(...)}
   </SortableContext>
   ```
4. **PersonalTodoTaskRow 에 `sortableContextId` prop 전달** (피드백 #5): 각 task row 가 자신이 속한 SortableContext id 를 알아야 R-01 의 useSortable data 첨부 가능. ProjectGroup 의 task render 시 `<PersonalTodoTaskRow ... sortableContextId={sortableContextId} />`.
5. **Loop-49 droppable (헤더 cross-project) 보존**: `useDroppable({ id: 'bl-project:${project.id}' })` 무수정. SortableContext 와 동일 컴포넌트 안에 공존.
6. **시스템 프로젝트 0건 placeholder 분기**: SortableContext items 빈 배열. 동작 OK.
7. **R-04 (Loop-49) 의 V5 self-target 가드 영향 없음**: 헤더 droppable 시각 피드백 로직 그대로.

**필터 chain 동기화 검증 (피드백 #2 — 코드 실측 완료)**:

ProjectGroup 의 sectionTasks 는 다음 필터 chain 의 결과:
1. PersonalTodoListTable L30-37: `myTasks = tasks.filter(t => t.assigneeId === currentUserId && !t.done && !t.deletedAt)`
2. L40-42: `todayTasks/nextTasks/backlogTasks = myTasks.filter(t => t.category === <section>)`
3. L235: `projTasks = sectionTasks.filter(t => t.projectId === p.id)` (section task 를 project 별 분리)

→ ProjectGroup 의 sortedTasks 는 다음 5 조건 AND 결과:
- `assigneeId === currentUserId`
- `!done`
- `!deletedAt`
- `category === <section>`
- `projectId === project.id`

R-03 의 Shell cellTasks 필터 도 **정확히 동일한 5 조건** 사용. 두 계산 결과 일치 보장. **이 동기화는 PersonalTodoListTable 의 myTasks 필터 변경 시 깨질 수 있음** — 향후 리팩터링 시 R-03 의 cellTasks 필터를 함께 변경하거나 helper 함수로 추출 필요 (별도 Loop 후보).

### R-03 — PersonalTodoShell handleDragEnd 분기 추가 (task-on-task reorder)

**현상**: [PersonalTodoShell.jsx:86-115](../../src/components/views/personal-todo/PersonalTodoShell.jsx#L86) 의 `bl-task:*` 분기는 focus drop / project header drop 만 처리.

**요구**:
1. **신규 분기 (Q3 — task-on-task 먼저)**: `bl-task:*` 분기 안에서 첫 번째 검사:
   ```js
   if (overId.startsWith('bl-task:') && overId !== activeIdStr) {
     const sourceContextId = active.data?.current?.sortableContextId
     const overContextId = over.data?.current?.sortable?.containerId
     // sameContext = 같은 project + same section
     if (sourceContextId !== overContextId) return  // 다른 context = 무시
     const sourceTaskId = activeIdStr.slice('bl-task:'.length)
     const overTaskId = overId.slice('bl-task:'.length)
     // sortedTasks 재계산 (Shell 에서 다시) 또는 store 의 tasks 기반
     const cellTasks = tasks
       .filter(t =>
         t.assigneeId === currentUserId &&
         !t.done &&
         !t.deletedAt &&
         t.projectId === sourceTask.projectId &&
         t.category === sourceTask.category)
       .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
     const oldIdx = cellTasks.findIndex(t => t.id === sourceTaskId)
     const newIdx = cellTasks.findIndex(t => t.id === overTaskId)
     if (oldIdx === -1 || newIdx === -1) return
     const reordered = arrayMove(cellTasks, oldIdx, newIdx)
     reorderTasks(reordered)
     return
   }
   ```
2. **순서**: focus drop 분기 (`focus-panel:root` / `focus-card:*`) → **task-on-task 분기 (신규)** → project header 분기 (`bl-project:*`) → return.
3. **검증**: source/over context id 가 다르면 (다른 project 또는 다른 section) → 무시. cross-section / cross-project task drop 미지원 (N-04 명시).
4. **arrayMove + reorderTasks** 호출. `reorderTasks` 가 sortOrder 0,1,2,... 일괄 갱신 + DB upsert.
5. **deps 갱신**: `tasks`, `currentUserId` 추가 (closure 사용).

### R-04 — section 식별자 props 추가 (다목적 사용)

**요구**:
1. PersonalTodoProjectGroup 의 props 에 `section: 'today' | 'next' | 'backlog'` 추가.
2. PersonalTodoListTable 의 TodaySection 이 `section="today"`, CollapsibleSection 이 `section="next" | "backlog"` 전달.
3. **용도 1 — SortableContext id**: `sortableContextId = bl-project-sortable:${project.id}:${section}`. 같은 project 가 3개 section 에 동시 등장해도 context id 다름 → SortableContext 충돌 없음.
4. **용도 2 — handleAddFinish 의 category 결정 (W3, 기존 버그 자연 수정)**:
   - 현재 [PersonalTodoProjectGroup.jsx:88](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx#L88) 의 `handleAddFinish` 가 `category: 'today'` 하드코딩 → "다음" / "남은" 섹션의 ProjectGroup `+ 할일` 버튼으로 추가한 task 가 "지금" 섹션에 잘못 표시됨 (Loop-50 이전부터 존재한 버그).
   - section prop 도입 시점에 자연 수정: `category: section` 으로 변경. section 값 ('today'/'next'/'backlog') 이 task.category 와 1:1 대응.
   - 영향: "다음" 섹션 ProjectGroup 에서 + 할일 → category='next' task 생성 → 즉시 그 섹션에 표시. "남은" 도 동일.
   - **enum 동일성 보장 근거 (4차 I3)**:
     - PersonalTodoListTable L40-42 에서 `tasks.filter(t => t.category === 'today' | 'next' | 'backlog')` 로 3 섹션 분리 → task.category 가 정확히 이 3값 중 하나.
     - addTask 의 default category = 'today' (useStore.js L600), spread 순서가 `{ ..., category: 'today', ..., ...task }` 라 명시 전달값 우선 — `category: section` 정상 override.
     - section prop 의 source 도 PersonalTodoListTable 의 `<TodaySection section="today">` / `<CollapsibleSection section="next" | "backlog">` 3값 — closed enum.
     - DB CHECK constraint 별도 검증 안 함 (기존 task.category 값이 동일 enum 으로 동작 중 → 회귀 없음).

### R-05 — Loop-49 cross-project DnD 와 공존 검증

**요구**:
1. useSortable 의 droppable (task row 자체) + 기존 useDroppable (헤더, Loop-49) **둘 다 동작**:
   - dragged task 가 다른 task row 위 → useSortable droppable 매치 → R-03 분기
   - dragged task 가 다른 project 헤더 위 → useDroppable 매치 → Loop-49 R-05 분기
   - dragged task 가 ProjectGroup 의 task list 영역 위 (특정 task 위 아닌) → ProjectGroup droppable (Loop-49 hotfix 로 전체 영역) 매치 → cross-project move
2. **collision detection (rectIntersection)** 동작: 더 큰 intersection 우선. task row (좁고 정확) vs ProjectGroup (넓음) — 일반적으로 task row 위 마우스 시 task row 우선. Shell handler 분기 순서 (R-03 task-on-task 먼저) 로 보장.

---

## 3. Non-Goals (N-XX)

| # | 비요구사항 | 근거 |
|---|---|---|
| N-01 | Cross-section task drop (예: today task 를 next 의 task 위로) | Q1 Option A 결정. category 변경은 detail panel 에서 처리 |
| N-02 | Cross-project task-on-task drop (예: project X 의 task 를 project Y 의 task 위로) | Q1 Option A 결정. cross-project 는 헤더 drop (Loop-49) 으로만 |
| N-03 | Milestone group 간 task 이동 시 keyMilestoneId 변경 | 같은 project + section 안 reorder만. milestone 무관. 사용자가 milestone 변경 원하면 detail panel 사용 |
| N-04 | useStore 의 reorderTasks action 시그니처 / 동작 변경 | 기존 매트릭스가 사용 중. 그대로 호출만 |
| N-05 | Drag overlay 도입 | Loop-49 와 동일 — 미사용. useSortable 의 transform/transition 으로 row 자체가 움직임 |
| N-06 | Mobile 전용 reorder UX (long-press 등) | TouchSensor 기존 설정 (delay 200, tolerance 5) 그대로 |
| N-07 | Backlog (다른 view 의 BacklogPanel 등) 의 reorder 변경 | Personal Todo view 전용. 다른 view 영향 없음 |
| N-08 | DB 마이그레이션 / RLS / 백엔드 변경 | 프론트엔드 단독. sortOrder 컬럼 + reorderTasks 액션 모두 기존 |
| N-09 | reorder 후 keyMilestoneId 자동 갱신 (milestone 그룹 경계 cross 시) | 매트릭스의 cross-MS-group within same cell 패턴 ([UnifiedGridView.jsx:258-262](../../src/components/views/UnifiedGridView.jsx#L258)) 미적용. 본 Loop 는 단순 reorder 만 |

> **Note (4차 I1 정리)**: 이전 N-10 ("`+ 할일` category='today' 하드코딩 버그 자연 수정") 은 실제로 본 Loop 에서 *수정하는 것* (R-04 #4) 이라 Non-Goal 섹션에 부적절. R-04 #4 단일 기술로 통일.

---

## 4. Edge Cases

### 4-1. Reorder 시나리오

| Case | 입력 | 기대 동작 |
|---|---|---|
| R1 | 같은 project + same section task A 를 task B 위로 drop | reorder. sortOrder 0,1,2,... 갱신. view 즉시 갱신 |
| R2 | 같은 project + same section task A 를 자기 자신 위 drop | dnd-kit useSortable 기본 동작 — same id 면 reorder 안 함. R-03 의 `overId !== activeIdStr` 가드 |
| R3 | 다른 project 의 task 위 drop | sourceContextId !== overContextId → 무시. 시각 피드백 없음 |
| R4 | 같은 project 의 다른 section task 위 drop | sourceContextId !== overContextId → 무시 (project.id 같지만 section 다름) |
| R5 | task 1개만 있는 project + section 에서 그 task drag | drag 가능. drop target 자기 자신 외 없음 → no-op |
| R6 | 빈 project (system project placeholder) 의 SortableContext | items=[] SortableContext 정상 등록. drop 대상 없음 (다른 task 가 이 group 으로 와도 task-on-task 매치 없음) |
| R7 | reorder 후 새 task 추가 (`+ 할일` inline composer) | newTask sortOrder = `Date.now()` (~1.7T) → reorder 한 task 들 (0,1,2,...) 다음 자동 위치 ✓ |
| R8 | Polling 중 외부 sync 도착 (다른 device 가 같은 project 의 task reorder) | optimistic update 가 즉시 반영 후 DB upsert. polling 결과가 같은 sortOrder 면 no-op. 다른 sortOrder 면 last-write-wins (N-14 관용) |
| R9 | reorder 직후 unmount (페이지 이동 등) | reorderTasks 의 DB upsert 가 await 안 끝나도 store optimistic update 이미 반영. 다음 mount 시 polling 으로 정합 |

### 4-2. Cross-project / cross-section drop 동작 (Loop-49 회귀 검증)

| Case | 입력 | 기대 동작 |
|---|---|---|
| C1 | task A drag → 다른 project 헤더 drop | Loop-49 cross-project 동작 (R-03 task-on-task 분기 미매치 → R-04 project header 분기 매치) |
| C2 | task A drag → 다른 project 의 task list 영역 drop (특정 task 위 아닌) | Loop-49 hotfix 의 ProjectGroup 전체 droppable 매치 → cross-project move (헤더 drop 과 동일) |
| C3 | task A drag → 우측 focus panel drop | Loop-45 focus drop 동작 (`focus-panel:root` 매치) |
| C4 | task A drag → focus card 위 drop | Loop-45 focus drop 동작 (`focus-card:*` 매치) |
| C5 | task A drag → 다른 project 의 task row 위 drop | R-03 task-on-task 분기에서 sourceContextId !== overContextId → **return → handleDragEnd 전체 종료** (다음 project header 분기로 fallthrough 안 됨). Loop-49 cross-project move 도 발동 안 함. **사용자 학습 비용**: cross-project 이동은 project 헤더 영역 (task list 사이 빈 공간 포함, Loop-49 hotfix) 에 drop 필요. Spec UX 결정 — task-on-task 우선 + 다른 context 무시 (피드백 #1) |

### 4-3. SortableContext 동작

| Case | 입력 | 기대 동작 |
|---|---|---|
| S1 | 같은 project 가 today + next + backlog 3 section 에 동시 등장 | 각 ProjectGroup 의 sortableContextId 가 `bl-project-sortable:projectId:section` 으로 unique → 3개 SortableContext 독립 등록 |
| S2 | 같은 project + section 의 task list 가 milestone 별 grouping 표시 (msLabel) | SortableContext 는 grouping 무관 — 모든 task 를 하나의 list 로. milestone label 은 시각적 grouping (R-02 의 tasksWithLabels). reorder 시 milestone 경계 무시하고 sortOrder 변경 |
| S3 | 빈 project (sectionTasks.length === 0) | items=[] SortableContext. drop 대상 없음 → 다른 곳에서 drop 와도 매치 안 됨 |

### 4-4. 시각 피드백

| Case | 상태 | 표시 |
|---|---|---|
| V1 | idle | 기존 hover / edit 동작 |
| V2 | task drag 시작 | dragged row opacity 0.3 (기존), useSortable transform 으로 row 가 cursor 따라 이동 |
| V3 | drag 중 다른 task 위 hover (sameContext) | useSortable 의 자동 displacement — 다른 task 들이 자리 비켜줌 (verticalListSortingStrategy 기본) |
| V4 | drag 중 다른 task 위 hover (다른 context) | displacement 없음 (다른 SortableContext). dragged row 만 cursor 따라 이동 |
| V5 | drag 중 다른 project 헤더 위 (Loop-49) | 기존 bgHover/dim 동작 (R-04 hotfix) |
| V6 | drop 직후 | reorderTasks 호출 → store optimistic update → re-render. 새 sortOrder 순서로 list 재정렬 |

---

## 5. Acceptance Criteria

### 5-1. 신규 기능

- [ ] AC-01: "지금 할일" project 안의 task A 를 task B 위로 drag → 순서 변경, view 즉시 갱신
- [ ] AC-02: "다음" 섹션 same-project task reorder 동작
- [ ] AC-03: "남은" 섹션 same-project task reorder 동작
- [ ] AC-04: dragged task 자기 자신 위 drop = no-op
- [ ] AC-05: 다른 project 의 task 위 drop = **완전 무시** — task-on-task 분기에서 contextId 불일치로 return → 후속 분기 (project header) 도 미발동 → cross-project move 안 됨. 의도된 동작 (피드백 #1). 사용자가 cross-project move 원하면 project 헤더 영역에 drop 필요
- [ ] AC-06: 같은 project 의 다른 section task 위 drop = 무시
- [ ] AC-07: useSortable 의 자동 displacement — drag 중 다른 task 들이 자리 비켜줌
- [ ] AC-08: reorder 후 새 task 추가 → list 끝에 자동 위치 (sortOrder Date.now() 효과)
- [ ] AC-09: 1개 task project 에서 drag = drop target 자기 외 없음, no-op

### 5-2. Loop-49 회귀 (중요)

- [ ] AC-10: task drag → 다른 project 헤더 drop = cross-project move (Loop-49 동작 보존)
- [ ] AC-11: task drag → 다른 project 의 task list 영역 drop (task row 아닌) = cross-project move (Loop-49 hotfix 동작 보존)
- [ ] AC-12: 같은 project drag (V5 self-target) = 시각 변화 없음 (Loop-49 W6 가드 보존)
- [ ] AC-13: task drag → 우측 focus panel drop = isFocus 갱신 (Loop-45 동작 보존)
- [ ] AC-14: focus card 간 reorder (Loop-45 F-25 동작 보존)

### 5-3. 빌드 / 품질

- [ ] AC-15: `npm run build` 성공
- [ ] AC-16: ESLint 경고 추가 없음
- [ ] AC-17: 2 커밋 R-ATOMIC 분리 (피드백 #3 통합 — useSortable + SortableContext 동시 적용으로 중간 상태 회귀 방지)

---

## 6. 커밋 계획 (R-ATOMIC 2커밋, 피드백 #3 통합)

**Commit 통합 근거 (피드백 #3)**: useSortable 단독 적용 시 task row 가 droppable 됨 → SortableContext 없으면 외부 droppable (ProjectGroup 헤더) 보다 먼저 매치 가능 → Shell handler 의 `bl-project:*` 분기 미발동 → **Loop-49 cross-project DnD 회귀**. SortableContext 가 같은 커밋에 등록되어야 task row droppable 의 동작이 context 안으로 격리되어 외부 droppable 과 정상 공존. R-ATOMIC 의 "중간 커밋에서 기존 기능 깨지면 안 됨" 원칙 우선.

```
Commit 1: feat(personal-todo): useSortable + SortableContext + sectionTasks 정렬
            (R-01 + R-02 + R-04, ~+25 LOC)
            - PersonalTodoTaskRow: useDraggable → useSortable, transform/transition 갱신,
              data 에 task + sortableContextId 첨부, sortableContextId prop 받음
            - PersonalTodoProjectGroup: SortableContext + verticalListSortingStrategy 등록,
              sortedTasks useMemo (sectionTasks 정렬), TaskRow 에 sortableContextId prop 전달,
              section prop 받음
            - PersonalTodoListTable: 3 호출처 (today/next/backlog) 에 section prop 전달
            - 중간 상태에서 cross-project DnD (Loop-49) 정상 동작 보장 (SortableContext 격리 효과)
            - drop 시 위치 원복 (Shell handler 미구현)

Commit 2: feat(personal-todo-shell): same-project task-on-task reorder 분기
            (R-03 + R-05, ~+25 LOC)
            - bl-task:* 분기 안에 task-on-task 분기 추가 (focus drop 다음, project header 앞)
            - sameContext 검증 (sortableContextId 비교, over.data?.current?.sortable?.containerId)
            - cellTasks 정렬 + arrayMove + reorderTasks 호출
            - deps 갱신 (tasks, currentUserId, reorderTasks)
            - 이 커밋 후: 전체 동작 완성
```

**의존성 핵심**:
- C1: useSortable + SortableContext + 정렬 + section prop 동시 적용 → 중간 상태에서도 Loop-49 회귀 없음. drag 시 시각 displacement 가능, drop 후 위치 원복 (Shell 미구현이라 정상)
- C2: Shell handler 추가 → 전체 동작 완성

---

## 7. 회귀 테스트 시나리오

각 커밋 머지 직후 + 통합 검증.

### 7-1. 신규 기능 (AC-01 ~ AC-09)

1. "지금" project 안 task A 를 task B 위로 drag → 순서 변경 ✓
2. "다음" / "남은" 섹션도 동일 동작 ✓
3. dragged task 를 자기 자신 위 drop → no-op
4. 다른 project task 위 drop → 무시 (cross-project move 발동 안 함)
5. 다른 section task 위 drop → 무시
6. 1개 task project drag → drop 무효
7. reorder 후 + 할일 → list 끝 위치
8. drag 중 다른 task 자리 비켜줌 시각 확인 (verticalListSortingStrategy)

### 7-2. Loop-49 / Loop-45 회귀 (AC-10 ~ AC-14)

9. 다른 project 헤더로 drag → cross-project move 정상
10. 다른 project task list 영역 (task 아닌 빈 공간) drag → cross-project move 정상
11. 같은 project 위 drag (self-target) → 시각 변화 없음
12. focus panel drop → isFocus 갱신
13. focus card 간 reorder → focusSortOrder 갱신

### 7-3. 통합 시나리오

14. 같은 project 안 reorder → 다른 project 헤더로 같은 task drag → cross-project move (연속 동작)
15. polling 도착 시 sortOrder 갱신 반영 (외부 sync 정합성)
16. detail panel 에서 category 변경 후 view 에 sortOrder 보존 확인

---

## 8. 미해결 사항

본 Spec 단계에서 모든 설계 결정 확정 완료. Diff Plan 단계에서는 코드 작성만 수행.

- ~~Q1 동작 범위~~ → Option A 채택
- ~~Q2 sort 위치~~ → PersonalTodoProjectGroup 안
- ~~Q3 Shell 분기 우선순위~~ → task-on-task 먼저
- ~~Q4 적용 섹션~~ → 3개 모두
- ~~sectionTasks 정렬 방법~~ → useMemo + spread sort (R-02)
- ~~SortableContext id 충돌 방지~~ → `bl-project-sortable:${projectId}:${section}` (R-04)
- ~~self-target 처리~~ → R-03 의 `overId !== activeIdStr` 가드
- ~~milestone group 처리~~ → keyMilestoneId 보존 (N-09)
- ~~drag overlay~~ → 미도입 (N-05)
- ~~AC-05 cross-project move 미발동 명시~~ → 피드백 #1 반영
- ~~Shell cellTasks 필터 vs ListTable 필터 동기화 검증~~ → 피드백 #2 코드 실측 완료, 5조건 정확 일치. R-02 본문에 명시
- ~~Commit 1 단독 useSortable 시 Loop-49 회귀 위험~~ → 피드백 #3, 2커밋 통합으로 해소
- ~~PersonalTodoListTable Scope 누락~~ → 피드백 #4, §1 추가
- ~~sortableContextId prop 전달 명시 누락~~ → 피드백 #5, R-02 #4 추가
