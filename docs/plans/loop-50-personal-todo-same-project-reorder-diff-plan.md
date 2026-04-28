---
phase: loop-50-personal-todo-same-project-reorder
source: docs/plans/loop-50-personal-todo-same-project-reorder-spec.md
date: 2026-04-27
status: diff-plan
prev: spec
next: execute
---

# Loop-50 Diff Plan — 지금 할일 같은 프로젝트 내 task 상하 순서 변경

> **변경 없음**: DB 마이그레이션 / RLS / Edge Function / API 엔드포인트 / 환경 변수 / 패키지 의존성. **프론트엔드 단독 수정**.
> **커밋 2개** (Spec §6, 피드백 #3 통합 후).

---

## 1. 변경 파일 요약

| 파일 | 커밋 # | 변경 라인 (추정) | 변경 내용 |
|---|---|---|---|
| [src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx) | C1 | L1-2 + L20 + L25-28 + L37-40 (+5/-3) | useDraggable → useSortable, transform/transition 갱신, sortableContextId prop + data |
| [src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx) | C1 | imports + L27-32 + L63-76 + L78-91 + L186-190 (~+18) | SortableContext + verticalListSortingStrategy, sortedTasks, taskIds useMemo (I1), section prop, handleAddFinish category=section (W3), TaskRow 에 sortableContextId 전달 |
| [src/components/views/personal-todo/PersonalTodoListTable.jsx](../../src/components/views/personal-todo/PersonalTodoListTable.jsx) | C1 | L239-247 + L296-305 + 신규 section prop 3 호출처 (~+3) | TodaySection / CollapsibleSection 의 ProjectGroup 호출에 section prop 전달 |
| [src/components/views/personal-todo/PersonalTodoShell.jsx](../../src/components/views/personal-todo/PersonalTodoShell.jsx) | C2 | L86 + L99~ + L132 (~+25) | handleDragEnd 에 task-on-task 분기 추가 (focus drop 다음, project header 앞), arrayMove + reorderTasks |

**총 4개 파일, 2 커밋, ~50 LOC 순증가.**

---

## 2. DB / API / Backend

- **DB 마이그레이션**: 없음. `tasks.sort_order` 컬럼 + `idx_*` 모두 기존.
- **RLS / Policy / Edge Function / 환경 변수 / 패키지**: 모두 무변경.
- **Store action**: `reorderTasks(reorderedList)` ([useStore.js:743-761](../../src/hooks/useStore.js#L743)) **재사용**. 시그니처/동작 무수정.

---

## 3. 커밋별 상세 hunk

### Commit 1 — `feat(personal-todo): useSortable + SortableContext + sectionTasks 정렬`

**Issue 의 R-01 + R-02 + R-04 통합 (피드백 #3 — useSortable 단독 적용 시 Loop-49 회귀 위험 회피).**

#### 1-1. `src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx`

```diff
@@ L1-3
 import { useState } from 'react'
-import { useDraggable } from '@dnd-kit/core'
+import { useSortable } from '@dnd-kit/sortable'
 import { CSS } from '@dnd-kit/utilities'

@@ L20 (function signature)
-export default function PersonalTodoTaskRow({ task, msLabel, isEtc }) {
+export default function PersonalTodoTaskRow({ task, msLabel, isEtc, sortableContextId }) {

@@ L25-28 (useDraggable → useSortable)
-  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
-    id: `bl-task:${task.id}`,
-    data: { task },  // R-06: ProjectGroup 의 isOver 시각 피드백 + Shell 의 cross-project drop 의존
-  })
+  // Loop-50 R-01: useDraggable → useSortable. data 에 sortableContextId 추가
+  // (Shell 의 sameContext 판단용). task 는 Loop-49 R-06 보존.
+  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
+    id: `bl-task:${task.id}`,
+    data: { task, sortableContextId },
+  })

@@ L37-40 (dragStyle — Translate → Transform + transition)
   const dragStyle = {
-    transform: CSS.Translate.toString(transform),
+    transform: CSS.Transform.toString(transform),
+    transition,
     opacity: rowOpacity,
   }
```

**LOC**: +5 / -3.
**리스크**: 낮음. useSortable 은 useDraggable + useDroppable 결합. SortableContext 가 같은 커밋에 등록되므로 외부 droppable 과 격리 보장 (피드백 #3).

#### 1-2. `src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx`

**⚠️ Hunk 적용 순서 (4차 W1 정정)** — 모든 라인 번호는 *현재 (편집 전) 파일 기준*. 순서대로 적용 시 라인 번호가 shift 되므로 아래 순번 엄수:

1. **Imports 추가** (L1-5 영역) — 가장 위
2. **Function signature** 에 `section` prop 추가 (L27-33)
3. **sortedTasks + sortableContextId + taskIds 3개 useMemo 블록 삽입** (현 L63 직전, tasksWithLabels 정의 바로 위)
4. **tasksWithLabels useMemo 갱신** — `sectionTasks` → `sortedTasks` (현 L63-76, 3 블록 삽입으로 라인 shift 됨에 주의)
5. **handleAddFinish 의 category=section 변경** + deps 갱신 (현 L78-91)
6. **Task rows 를 SortableContext wrap + sortableContextId prop 전달** (현 L186-190 = 단일 통합 hunk)

각 단계 적용 후 다음 단계의 라인 번호는 자동으로 shift 됨. 편집 도구 (Edit tool) 의 string-based replace 는 정확한 컨텍스트 매칭이라 오프셋 영향 없음 — 순서만 지키면 됨.

**Import 추가**:
```diff
@@ L1-5
 import React, { useMemo, useState, useCallback } from 'react'
 import { useDroppable, useDndContext } from '@dnd-kit/core'
+import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
 import useStore, { getCachedUserId } from '../../../../hooks/useStore'
 import { COLOR, FONT, LIST, SPACE, OPACITY } from '../../../../styles/designTokens'
 import PersonalTodoTaskRow from './PersonalTodoTaskRow'
```

**Function signature 에 section prop 추가**:
```diff
@@ L27-33
 export default function PersonalTodoProjectGroup({
   project,
   sectionTasks,
   milestones,
   isExpanded,
   onToggle,
+  section,  // 'today' | 'next' | 'backlog' — SortableContext id 의 일부
 }) {
```

**sortedTasks + sortableContextId + taskIds 정의 + tasksWithLabels 갱신** (현 L63-76 직전 + 갱신):
```diff
@@ before L63 (tasksWithLabels useMemo 직전)
+  // Loop-50 R-02: sectionTasks 명시 정렬 (store reorderTasks 가 sortOrder 만 갱신, array 순서 미변경 → 직접 sort 필수)
+  const sortedTasks = useMemo(
+    () => [...sectionTasks].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
+    [sectionTasks]
+  )
+
+  // Loop-50 R-04 #3: SortableContext id (project + section unique)
+  const sortableContextId = `bl-project-sortable:${project.id}:${section}`
+
+  // Loop-50 I1 (3차): SortableContext items 도 useMemo (매트릭스 CellContent.jsx:100 패턴 일관성)
+  const taskIds = useMemo(
+    () => sortedTasks.map(t => `bl-task:${t.id}`),
+    [sortedTasks]
+  )

@@ L63-76 (tasksWithLabels — sortedTasks 기반으로 변경)
   const tasksWithLabels = useMemo(() => {
     const msMap = new Map(milestones.map(m => [m.id, m]))
-    return sectionTasks.map((t, idx) => {
+    return sortedTasks.map((t, idx) => {
       const msId = t.keyMilestoneId ?? null
-      const prevMsId = idx === 0 ? '__init__' : (sectionTasks[idx - 1].keyMilestoneId ?? null)
+      const prevMsId = idx === 0 ? '__init__' : (sortedTasks[idx - 1].keyMilestoneId ?? null)
       const showLabel = msId !== prevMsId
       const label = msId ? (msMap.get(msId)?.title || '') : '기타'
       return {
         task: t,
         msLabel: showLabel ? label : '',
         isEtc: showLabel && msId == null,
       }
     })
-  }, [sectionTasks, milestones])
+  }, [sortedTasks, milestones])
```

**handleAddFinish 의 category 결정 — section prop 사용 (R-04 #4, W3 자연 수정)**:
```diff
@@ L78-91 (handleAddFinish)
   const handleAddFinish = useCallback((value) => {
     setAdding(false)
     const text = (value ?? '').trim()
     if (!text) return
     addTask({
       text,
       projectId: project.id,
       assigneeId: currentUserId,
       secondaryAssigneeId: null,
       keyMilestoneId: null,
-      category: 'today',
+      category: section,  // R-04 #4: 'today'/'next'/'backlog' 의 ProjectGroup 에서 추가 시 그 section 으로 (W3 자연 수정)
       isFocus: false,
     })
-  }, [addTask, project.id, currentUserId])
+  }, [addTask, project.id, currentUserId, section])
```

**Task rows 를 SortableContext 로 wrap + sortableContextId prop 전달 (W1 단일 hunk 로 통합)**:
```diff
@@ L185-191 (Task rows render — 단일 통합 hunk)
+      {/* Loop-50 R-02: SortableContext 등록 (DOM 무생성, items + verticalListSortingStrategy)
+          Fragment 처럼 자식 div 가 직접 grid item 이 됨 */}
+      <SortableContext items={taskIds} id={sortableContextId} strategy={verticalListSortingStrategy}>
       {/* Task rows (col 2 + col 3) */}
       {!isEmpty && isExpanded && tasksWithLabels.map(({ task, msLabel, isEtc }) => (
         <React.Fragment key={task.id}>
-          <PersonalTodoTaskRow task={task} msLabel={msLabel} isEtc={isEtc} />
+          <PersonalTodoTaskRow task={task} msLabel={msLabel} isEtc={isEtc} sortableContextId={sortableContextId} />
         </React.Fragment>
       ))}
+      </SortableContext>
```

**LOC**: ~+15 / -3.
**리스크**: 중. SortableContext 가 grid wrapper div 내부에 위치 — DOM 영향 없음 (provider 만). useSortable 의 droppable 은 SortableContext 안에서 격리 → 외부 droppable (Loop-49 ProjectGroup hotfix) 와 정상 공존.

#### 1-3. `src/components/views/personal-todo/PersonalTodoListTable.jsx`

**TodaySection 의 ProjectGroup 호출에 section prop 추가** (현 L239-247):
```diff
@@ L239-247 (TodaySection)
         return (
           <PersonalTodoProjectGroup
             key={p.id}
             project={p}
             sectionTasks={projTasks}
             milestones={milestones}
             isExpanded={isProjectExpanded(p.id)}
             onToggle={() => toggleProjectExpand(p.id)}
+            section="today"
           />
         )
```

**CollapsibleSection 의 ProjectGroup 호출에 section prop 추가 (next + backlog 공통)** — CollapsibleSection 의 props 에 section 도 받아서 전달:
```diff
@@ CollapsibleSection function signature (현 L260-264)
 function CollapsibleSection({
-  label, tasks, projects, milestones,
+  label, tasks, projects, milestones, section,
   isExpanded, onToggle,
   isProjectExpanded, toggleProjectExpand,
 }) {

@@ L296-305 (CollapsibleSection 의 ProjectGroup 호출)
             return (
               <PersonalTodoProjectGroup
                 key={p.id}
                 project={p}
                 sectionTasks={projTasks}
                 milestones={milestones}
                 isExpanded={isProjectExpanded(p.id)}
                 onToggle={() => toggleProjectExpand(p.id)}
+                section={section}
               />
             )

@@ PersonalTodoListTable 의 CollapsibleSection 호출 2곳 (현 L88-97, L100-109)
       <CollapsibleSection
         label="다음 할일"
         tasks={nextTasks}
         projects={projects}
         milestones={milestones}
         isExpanded={isSectionExpanded('next')}
         onToggle={() => toggleSection('next')}
         isProjectExpanded={isProjectExpanded}
         toggleProjectExpand={toggleProjectExpand}
+        section="next"
       />

       <CollapsibleSection
         label="남은 할일"
         tasks={backlogTasks}
         projects={projects}
         milestones={milestones}
         isExpanded={isSectionExpanded('backlog')}
         onToggle={() => toggleSection('backlog')}
         isProjectExpanded={isProjectExpanded}
         toggleProjectExpand={toggleProjectExpand}
+        section="backlog"
       />
```

**LOC**: ~+5.
**리스크**: 최저. props pass-through 만.

---

### Commit 2 — `feat(personal-todo-shell): same-project task-on-task reorder 분기`

**Issue 의 R-03 + R-05.**

#### 2-1. `src/components/views/personal-todo/PersonalTodoShell.jsx`

**Import 추가** (`reorderTasks` store action + `arrayMove` 는 이미 import):
```diff
@@ L52-54
   const currentUserId = getCachedUserId()
   const updateTask = useStore(s => s.updateTask)
   const reorderFocusTasks = useStore(s => s.reorderFocusTasks)
+  const reorderTasks = useStore(s => s.reorderTasks)
```

**handleDragEnd 의 `bl-task:*` 분기 안에 task-on-task 분기 추가** (현 L86-116):

```diff
@@ L85-116 (bl-task:* 분기 갱신)
     // ═══ 1) 백로그 → 포커스 패널 (F-23) ═══
     if (activeIdStr.startsWith('bl-task:')) {
       if (overId === 'focus-panel:root' || overId.startsWith('focus-card:')) {
         const taskId = activeIdStr.slice('bl-task:'.length)
         const maxOrder = focusTasks.reduce(
           (m, t) => Math.max(m, t.focusSortOrder ?? 0),
           0,
         )
         updateTask(taskId, { isFocus: true, focusSortOrder: maxOrder + 1 })
         setExpanded(taskId, true)
         return
       }
+
+      // ═══ 1.3) 같은 project + same section task-on-task reorder (Loop-50 R-03) ═══
+      // 우선순위: focus drop 다음, project header 앞 (피드백 Q3 — task-on-task 우선)
+      if (overId.startsWith('bl-task:') && overId !== activeIdStr) {
+        // W2 (3차) 가드: dnd-kit v5+ 의 useSortable 이 data.sortable = { containerId, index }
+        // 자동 병합 (공식 동작). 본 codebase 첫 사용 패턴이라 안전 가드 — 미정의 시 무시.
+        const sourceContextId = active.data?.current?.sortableContextId
+        const overContextId = over.data?.current?.sortable?.containerId
+        // sameContext = 같은 project + same section. 다른 context 또는 undefined = 무시 (Spec C5)
+        if (!sourceContextId || !overContextId || sourceContextId !== overContextId) return
+
+        const sourceTask = active.data?.current?.task
+        if (!sourceTask) return
+
+        // ListTable 필터 chain 과 동기화된 5조건 (Spec R-02 검증):
+        // assigneeId === currentUserId && !done && !deletedAt && projectId 일치 && category 일치
+        const cellTasks = tasks
+          .filter(t =>
+            t.assigneeId === currentUserId &&
+            !t.done &&
+            !t.deletedAt &&
+            t.projectId === sourceTask.projectId &&
+            t.category === sourceTask.category)
+          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
+
+        const sourceTaskId = activeIdStr.slice('bl-task:'.length)
+        const overTaskId = overId.slice('bl-task:'.length)
+        const oldIdx = cellTasks.findIndex(t => t.id === sourceTaskId)
+        const newIdx = cellTasks.findIndex(t => t.id === overTaskId)
+        if (oldIdx === -1 || newIdx === -1) return
+
+        const reordered = arrayMove(cellTasks, oldIdx, newIdx)
+        reorderTasks(reordered)
+        return
+      }

       // ═══ 1.5) 백로그 → 다른 프로젝트 (Loop-49 R-05) ═══
       if (overId.startsWith('bl-project:')) {
         const taskId = activeIdStr.slice('bl-task:'.length)
         const targetProjectId = overId.slice('bl-project:'.length)
         const task = active.data?.current?.task
         const targetProject = projects.find(p => p.id === targetProjectId)
         if (!task || !targetProject) return
         if (!canMoveTaskToProject(task, targetProject)) return
         updateTask(taskId, { projectId: targetProjectId })
         return
       }

       return
     }
```

**deps 갱신**:
```diff
@@ L132 (handleDragEnd useCallback deps)
-  }, [focusTasks, projects, updateTask, reorderFocusTasks, setExpanded])
+  }, [focusTasks, projects, tasks, currentUserId, updateTask, reorderFocusTasks, reorderTasks, setExpanded])
```

**LOC**: ~+30 / -1.
**리스크**: 중. 새 분기 추가. focus drop 분기 (1)) → task-on-task 분기 (1.3)) → project header 분기 (1.5)) 순서. 각 분기 독립, 상호 영향 없음.

---

## 4. 작업 순서 (의존성)

```
C1 (useSortable + SortableContext + sectionTasks 정렬 + section prop)
  ↓ 중간 빌드: cross-project DnD (Loop-49) 정상, drop 시 위치 원복 (Shell handler 미구현)
C2 (Shell handler task-on-task 분기)
  ↓ 전체 동작 완성
```

**의존성 핵심**:
- C1: 4 파일 동시 변경 (TaskRow + ProjectGroup + ListTable). useSortable 과 SortableContext 가 같은 커밋에 등록되어야 외부 droppable 과 격리 보장 — 피드백 #3 의 Loop-49 회귀 방지.
- C2: Shell handler 추가. C1 의 sortableContextId data + SortableContext containerId 활용.

---

## 5. 검증 절차

### 5-1. 커밋별 즉시 검증

각 커밋 머지 직후:
```bash
npm run build              # AC-15 빌드 통과
```

**C1 후**:
- 같은 project task drag → drag 시 다른 task 자리 비켜줌 (verticalListSortingStrategy displacement) 시각 확인
- drop 시 위치 원복 (Shell handler 미구현 → reorder 미실행). 정상.
- **Loop-49 회귀 검증** (피드백 #3 핵심):
  - 다른 project 헤더로 drag → cross-project move 정상 동작
  - 다른 project task list 영역 (task 아닌 빈 공간) drag → cross-project move 정상
  - V5 self-target 시각 변화 없음
- **W3 자연 수정 검증**:
  - "다음" 섹션 ProjectGroup 의 + 할일 → category='next' task 생성 → 그 섹션에 즉시 표시 (이전엔 "지금" 으로 잘못 들어감)
  - "남은" 섹션 동일
  - "지금" 섹션 + 할일 → category='today' (변화 없음, section='today' 전달)

**C2 후**:
- 같은 project task drag → drop → 순서 변경 + view 즉시 갱신
- 다른 project task 위 drag → drop → 무시 (Loop-49 cross-project 도 미발동, AC-05)
- 다른 section task 위 drag → 무시 (AC-06)

### 5-2. 통합 검증 (2 커밋 누적 후)

Spec §7 의 16 시나리오 모두 수동 실행:

**신규 기능** (8건):
1. "지금" project A→B 위로 drag → reorder
2. "다음" / "남은" 섹션 동일
3. self-target drop = no-op
4. 다른 project task drop = 무시 (cross-project move 도 미발동)
5. 다른 section task drop = 무시
6. 1개 task project drag = drop 무효
7. reorder 후 + 할일 = list 끝 위치
8. 자동 displacement 시각

**Loop-49/45 회귀** (5건):
9. 다른 project 헤더 drop = cross-project move
10. 다른 project task list 영역 drop = cross-project move
11. self-target 시각 변화 없음 (V5 가드)
12. focus panel drop = isFocus 갱신
13. focus card 간 reorder

**통합 시나리오** (3건):
14. reorder → 다른 project 헤더 drag (연속 동작)
15. polling 외부 sync 정합
16. detail panel category 변경 후 sortOrder 보존

### 5-3. 회귀 위험 모니터링

- **C1 의 SortableContext 격리 효과** (피드백 #3): cross-project DnD 가 정말 정상 동작하는지 우선 검증. SortableContext 가 외부 droppable 과 충돌하면 Loop-49 회귀.
- **R-02 의 sortedTasks `[...]` spread**: in-place sort 가 store mutate 하지 않음을 확인 (sort 결과 신규 array).
- **C2 의 cellTasks 필터 5조건**: ListTable 의 myTasks/section/projTasks chain 과 정확 일치 (Spec §R-02 검증). 향후 ListTable 필터 변경 시 cellTasks 도 같이 변경 필요 — helper 추출 후속 후보.
- **drop 직후 sortOrder 갱신과 polling race**: optimistic update 가 즉시 반영. polling 결과는 같거나 다른 sortOrder. 다르면 last-write-wins (N-14 관용).

---

## 6. 미해결 / 후속 항목

- **cellTasks 필터 helper 추출**: PersonalTodoListTable 의 myTasks 필터와 Shell 의 cellTasks 필터가 5조건 동일. 향후 한쪽만 변경하면 reorder 동작 깨짐. helper 함수 (`isMyVisibleTask(task, userId, projectId, category)`) 추출 후속 후보.
- **Cross-project task-on-task drop 지원**: Spec C5 에서 무시로 결정. 사용자가 다른 project task 위로 drag = move 의도일 가능성. 별도 Loop 후보 (Option B 영역).
- **Cross-section task drop 지원**: today→next 등 섹션 이동을 task drag 로. 별도 Loop 후보 (Option C 영역).
- **Drag overlay 도입**: 현재 row 자체가 cursor 따라 이동 (transform). drag overlay (별도 ghost) 시 더 매끄러운 UX. 별도 Loop 후보.
- **Mobile reorder UX 검증**: TouchSensor (delay 200, tolerance 5) 가 same-project reorder 에서도 자연스러운지 mobile 사용 확인 필요.

### 4차 리뷰에서 발견된 별도 Loop 후보

- **EC-3 — `reorderTasks` optimistic update 시 `updatedAt` 미갱신** (4차): [useStore.js:746-750](../../src/hooks/useStore.js#L746) 의 set 호출이 sortOrder 만 갱신, updatedAt 변경 없음. polling 도착 시 dedup 실패 가능성 (CLAUDE.md §4-3 의 "id + updated_at 비교" 패턴 위반). DB upsert 가 await 되기 전에 polling 이 도착하면 reorder 결과가 번쩍이다 되돌아가는 시각적 race 가능. **수정**: optimistic set 에 `updatedAt: new Date().toISOString()` 추가.
- **W3 — `reorderTasks` sequential upsert N+1** (4차): N 개 task reorder 시 N 번 직렬 await DB 왕복. 매트릭스도 같은 패턴이지만 personal todo 에서 첫 활성화. **수정**: `Promise.all([...updates.map(u => safeUpsertTask(...))])` 또는 batch upsert API.
- **W2 — C5 cross-project task row drop UX 피드백** (4차): 다른 project 의 task row 위 drop 시 무시되지만 시각 피드백 (cursor not-allowed) 없음 → 사용자 혼란. Loop-49 Q4 의 cursor 가드 패턴 (헤더 droppable) 을 task row droppable 에도 확장 필요.

위 3건 모두 본 Loop 의 store action 또는 Shell handler 수정 범위 외. 통합 핫픽스 또는 별도 Loop-51 후보.
