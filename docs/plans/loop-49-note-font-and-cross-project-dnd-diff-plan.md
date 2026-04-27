---
phase: loop-49-note-font-and-cross-project-dnd
source: docs/plans/loop-49-note-font-and-cross-project-dnd-spec.md
date: 2026-04-27
status: diff-plan
prev: spec
next: execute
---

# Loop-49 Diff Plan — 노트 폰트 통일 + 프로젝트 간 DnD

> **변경 없음**: DB 마이그레이션, RLS, edge function, API 엔드포인트, env vars, 패키지 의존성. **프론트엔드 단독 수정**.
> **커밋 4개** (Spec §6 통합본).

---

## 1. 변경 파일 요약

| 파일 | 커밋 # | 변경 라인 (추정) | 변경 내용 |
|---|---|---|---|
| [src/components/shared/OutlinerRow.jsx](../../src/components/shared/OutlinerRow.jsx) | C1 | L13-17 + L68 (+5/-2) | fontSize prop + 비례 lineHeight 계산 |
| [src/components/shared/OutlinerEditor.jsx](../../src/components/shared/OutlinerEditor.jsx) | C1 | L15 + L219-238 (+2) | fontSize pass-through |
| [src/components/views/personal-todo/cells/FocusCard.jsx](../../src/components/views/personal-todo/cells/FocusCard.jsx) | C1 | L216-220 (+1) | fontSize={FONT.body} 전달 |
| [src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx) | C2 | L25-27 (+1) | useDraggable data: { task } |
| [src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx) | C3 | import + L82-126 (~+25) | 헤더 useDroppable + isOver 시각 피드백 |
| [src/components/views/personal-todo/PersonalTodoShell.jsx](../../src/components/views/personal-todo/PersonalTodoShell.jsx) | C4 | L76-114 (~+25) | isAllowedDrop + cross-project drop 분기 |

**총 5개 파일, 4개 커밋, ~58 LOC 순증가.**

---

## 2. DB / API / Backend

- **DB 마이그레이션**: 없음. supabase/migrations/ 신규 파일 없음.
- **RLS / Policy / Edge Function / 환경 변수 / 패키지**: 모두 무변경.
- **Store action 시그니처**: `updateTask(id, patch)` 무변경. 기존 `applyTransitionRules` R5 (projectId → keyMilestoneId 초기화) + personal-target 가드 자동 활용.

---

## 3. 커밋별 상세 hunk

### Commit 1 — `feat(outliner): fontSize prop + FocusCard 12 적용`

**Issue #1 전체 (R-01 + R-02 + R-03). 3 파일 동시 수정 — 개별 적용 시 사용자 체감 없음 (R-ATOMIC = 이슈 단위).**

#### 1-1. `src/components/shared/OutlinerRow.jsx`

```diff
@@ L13-17
-export default function OutlinerRow({ node, idx, accentColor, inputRef, onTextChange, onKeyDown, onPaste, onDelete, onChangeLevel, showPlaceholder, hasChildren, isCollapsed, onToggleCollapse, selected, onMouseDown, onMouseEnter }) {
+export default function OutlinerRow({ node, idx, accentColor, inputRef, onTextChange, onKeyDown, onPaste, onDelete, onChangeLevel, showPlaceholder, hasChildren, isCollapsed, onToggleCollapse, selected, onMouseDown, onMouseEnter, fontSize }) {
   const localRef = useRef(null)
   const isMobile = window.innerWidth < 768
-  // 불릿포인트: 데스크탑 14px, 모바일 13px (할일 제목과 동일)
-  const fontSize = isMobile ? 13 : 14
+  // textarea fontSize — prop 전달 시 우선, 미전달 시 기존 default 보존 (호출처 무영향)
+  // lineHeight 비례 계산: 14×1.42=20 (기존 desktop), 13×1.42=18 (기존 mobile 19→18, 1px 변화),
+  // 12×1.42=17 (FocusCard 신규)
+  const effectiveFontSize = typeof fontSize === 'number' ? fontSize : (isMobile ? 13 : 14)
+  const effectiveLineHeight = `${Math.round(effectiveFontSize * 1.42)}px`

@@ L68 (textarea style)
-        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize, lineHeight: isMobile ? '19px' : '20px', padding: '2px 4px', fontFamily: 'inherit', color: '#37352f', boxSizing: 'border-box', resize: 'none', overflow: 'hidden', display: 'block', fontWeight: 400 }}
+        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: effectiveFontSize, lineHeight: effectiveLineHeight, padding: '2px 4px', fontFamily: 'inherit', color: '#37352f', boxSizing: 'border-box', resize: 'none', overflow: 'hidden', display: 'block', fontWeight: 400 }}
```

**Bullet `-` 텍스트 (L55) 미수정**: 현재 hardcoded `fontSize: 12` 보존. 이유: bullet 은 시각 marker 역할 (텍스트보다 작아야 자연스러움). default fontSize=14 일 때 bullet 12 = 적절한 비율. fontSize=12 시 bullet 12 = 동일 — 회귀 없음. **Spec R-01 #3 ("bullet 도 effectiveFontSize 적용") 의 default 케이스 회귀 (12→14) 우려로 제외 결정**.

**Bullet dot (`getBulletStyle`)**: 별도 css 객체 (텍스트 fontSize 무관) → 무수정.

#### 1-2. `src/components/shared/OutlinerEditor.jsx`

```diff
@@ L15 (forwardRef function signature)
-const OutlinerEditor = forwardRef(function OutlinerEditor({ notes, onChange, accentColor, onExitUp, onExitDown, allTopCollapsed }, ref) {
+const OutlinerEditor = forwardRef(function OutlinerEditor({ notes, onChange, accentColor, onExitUp, onExitDown, allTopCollapsed, fontSize }, ref) {

@@ L219-238 (OutlinerRow 호출)
       <OutlinerRow
         key={i}
         node={nodes[i]}
         idx={i}
         accentColor={accentColor}
+        fontSize={fontSize}
         inputRef={el => refs.current[i] = el}
         onTextChange={handleTextChange}
         ...
```

#### 1-3. `src/components/views/personal-todo/cells/FocusCard.jsx`

```diff
@@ L216-220 (OutlinerEditor 호출)
       {isExpanded && (
         <div style={{...}}>
           <OutlinerEditor
             notes={task.notes}
             onChange={handleNotesChange}
             accentColor={accentColor}
+            fontSize={FONT.body}
           />
         </div>
       )}
```

`FONT.body` (= 12) 는 이미 file 상단 import 됨 ([FocusCard.jsx:6](../../src/components/views/personal-todo/cells/FocusCard.jsx#L6)) — 추가 import 불필요.

**N-13 정책 적용 명시 (commit message)**: "addative prop + default 동작 보존 = N-13 충족" — Loop-46 N-13 의 첫 적용 사례. Spec §3 N-02 참조.

**LOC**: ~+8 / -2.
**리스크**: 낮음. 4개 미전달 호출처 (DetailPanel/MemoryView/CompactTaskRow/OutlinerTaskNode) 는 default 14/13 동작 보존. mobile 13 의 lineHeight 가 19→18 로 1px 변화 — 회귀 테스트 시 시각 확인 필요.

---

### Commit 2 — `feat(personal-todo-task-row): useDraggable data 에 task 첨부`

**Issue #2 의 R-06. C3/C4 의 시각 피드백 + Shell handler 의존성.**

#### 2-1. `src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx`

```diff
@@ L25-27
-  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
-    id: `bl-task:${task.id}`,
-  })
+  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
+    id: `bl-task:${task.id}`,
+    data: { task },  // R-06: ProjectGroup 의 isOver 시각 피드백 + Shell 의 cross-project drop 의존
+  })
```

**LOC**: +1 / -0.
**리스크**: 최저. 추가 data 만 — 기존 동작 무영향.
**중간 빌드 검증**: 이 커밋만 적용 시 동작 변화 없음 (data 가 사용되는 곳이 아직 없음). 정상.

---

### Commit 3 — `feat(personal-todo-project-group): droppable + 시각 피드백`

**Issue #2 의 R-04 + R-07. 헤더 영역 only droppable (Option D-ii).**

#### 3-1. `src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx`

**Import 추가**:
```diff
@@ L1-4
 import React, { useMemo, useState, useCallback } from 'react'
+import { useDroppable, useDndContext } from '@dnd-kit/core'
 import useStore, { getCachedUserId } from '../../../../hooks/useStore'
 import usePivotExpandState from '../../../../hooks/usePivotExpandState'
-import { COLOR, FONT, LIST, SPACE } from '../../../../styles/designTokens'
+import { COLOR, FONT, LIST, SPACE, OPACITY } from '../../../../styles/designTokens'
 import PersonalTodoTaskRow from './PersonalTodoTaskRow'
```

**Component body 에 droppable + validation 추가** (component function 안, return 전):
```diff
@@ after L27 (state declarations)
   const [headerHover, setHeaderHover] = useState(false)
   const [adding, setAdding] = useState(false)

+  // R-04: 헤더 영역 droppable 등록 (Option D-ii)
+  const { setNodeRef: setDropRef, isOver } = useDroppable({
+    id: `bl-project:${project.id}`,
+    data: { projectId: project.id, teamId: project.teamId, isSystem: project.isSystem },
+  })
+
+  // R-07: drag 중인 source task 와 비교하여 drop 가능 여부 판정
+  // active 가 bl-task:* 일 때만 valid 검증, 아니면 idle 동작
+  const { active } = useDndContext()
+  const dragSourceTask = active?.data?.current?.task
+  const isDragActive = !!active && String(active.id).startsWith('bl-task:')
+  const isAllowedDrop = isDragActive && dragSourceTask
+    ? canMoveTaskToProject(dragSourceTask, project)
+    : false
+  const isSelfTarget = isDragActive && dragSourceTask?.projectId === project.id
+
+  // 시각 피드백 결정 (R-07 V1~V5)
+  // W6 (3차) 반영: V5 self-drop 시 dim 차단 — !isSelfTarget 가드 추가
+  const headerBg = isOver && isAllowedDrop && !isSelfTarget ? COLOR.bgHover : 'transparent'
+  const headerOpacity = isOver && isDragActive && !isAllowedDrop && !isSelfTarget ? OPACITY.projectDimmed : 1
+  const headerCursor = isOver && isDragActive && !isAllowedDrop && !isSelfTarget ? 'not-allowed' : undefined
```

**`canMoveTaskToProject` helper (파일 상단, component 외부에 정의)**:
```diff
@@ L5 (after imports, before component)
+/* ── R-05/R-07: same-type drop validation (Option 2A) ──
+   Private task → personal/system project (둘 다 !teamId)
+   Team task → same-team project (teamId 일치)
+   같은 project 자기 자신 = false (no-op)
+   Spec §4-2 8가지 매트릭스 참조 */
+function canMoveTaskToProject(task, targetProject) {
+  if (!task || !targetProject) return false
+  if (task.projectId === targetProject.id) return false  // 자기 자신
+  if (!task.teamId) return !targetProject.teamId          // private → personal/system
+  return task.teamId === targetProject.teamId             // team → same-team
+}
+
+export { canMoveTaskToProject }  // R-05 (Shell) 에서 재사용
+
 export default function PersonalTodoProjectGroup({...}) {
```

**헤더 div 에 setNodeRef + 시각 피드백 부착** (현 L82-126):
```diff
@@ L82-126 (Project col header)
       {/* Project col (col 1) — row span */}
       <div
+        ref={setDropRef}
         onClick={onToggle}
         style={{
           gridRow: `1 / span ${spanRows}`,
           padding: '6px 12px 6px 4px',
-          cursor: 'pointer',
+          cursor: headerCursor || 'pointer',
+          background: headerBg,
+          opacity: headerOpacity,
+          transition: 'background 0.15s, opacity 0.15s',
           alignSelf: 'start',
           minWidth: 0,
           position: 'relative',
         }}
       >
         ... (기존 내용 무수정)
       </div>
```

**LOC**: ~+25 / -1.
**리스크**: 중. droppable 등록 + useDndContext 호출 추가. 기존 onClick (toggle) 동작 보존 — drag 중에도 click 동작은 dnd-kit 가 distance=5 activationConstraint 로 분리. 시각 피드백 결정 로직이 매 렌더 실행 — 비용 무시 (ref 비교만).

**중간 빌드 검증**: 이 커밋만 적용 시 droppable 등록되지만 Shell handler 에 분기 없음 → drop 시 no-op (기존 "그 외 분기 = no-op" 로직). 시각 피드백은 정상 표시 (drop 가능/차단 색상 변화 보임).

---

### Commit 4 — `feat(personal-todo-shell): cross-project drop 분기 + validation`

**Issue #2 의 R-05. handleDragEnd 에 새 분기 추가.**

#### 4-1. `src/components/views/personal-todo/PersonalTodoShell.jsx`

**Import 추가**:
```diff
@@ L1-10
 import { useCallback, useMemo } from 'react'
 import {
   DndContext, PointerSensor, TouchSensor, useSensor, useSensors, rectIntersection, useDroppable,
 } from '@dnd-kit/core'
 import { arrayMove } from '@dnd-kit/sortable'
 import useStore, { getCachedUserId } from '../../../hooks/useStore'
 import usePivotExpandState from '../../../hooks/usePivotExpandState'
 import { COLOR } from '../../../styles/designTokens'
 import PersonalTodoListTable from './PersonalTodoListTable'
 import FocusPanel from './FocusPanel'
+import { canMoveTaskToProject } from './cells/PersonalTodoProjectGroup'
```

**handleDragEnd 에 cross-project 분기 추가** (현 L76-114):
```diff
@@ L76-114 (handleDragEnd)
   const handleDragEnd = useCallback((e) => {
     const { active, over } = e
     const activeIdStr = String(active?.id || '')

     if (!over) return

     const overId = String(over.id)

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
+      // ═══ 1.5) 백로그 → 다른 프로젝트 (Loop-49 R-05) ═══
+      if (overId.startsWith('bl-project:')) {
+        const taskId = activeIdStr.slice('bl-task:'.length)
+        const targetProjectId = overId.slice('bl-project:'.length)
+        // R-06 으로 active.data 항상 첨부됨 — fallback 불필요 (W2 정정)
+        const task = active.data?.current?.task
+        const targetProject = projects.find(p => p.id === targetProjectId)
+        if (!task || !targetProject) return
+        // same-type validation (Spec §4-2 매트릭스)
+        if (!canMoveTaskToProject(task, targetProject)) return
+        // R5 (applyTransitionRules) 가 keyMilestoneId 자동 초기화
+        // personal-target 가드 (useStore.js:621) 가 자동 적용 (private 보호)
+        updateTask(taskId, { projectId: targetProjectId })
+        return
+      }
+
       return
     }

     // ═══ 2) 포커스 내부 reorder (F-25) ═══
     ...
   }, [focusTasks, updateTask, reorderFocusTasks, setExpanded])
```

**deps 갱신** (현 L114): **W4 (3차) 정정** — `tasks` dep 제거 (fallback 사라짐), `projects` 만 추가 (closure 에서 직접 사용):
```diff
-  }, [focusTasks, updateTask, reorderFocusTasks, setExpanded])
+  }, [focusTasks, projects, updateTask, reorderFocusTasks, setExpanded])
```

**LOC**: ~+15 / -1.
**리스크**: 중. 새 drop 분기 추가. 기존 분기 (focus drop, focus reorder) 무영향. **W4 정정 후 `projects` 만 deps 추가** (`tasks` 는 fallback 제거로 closure 미사용 → dep 불필요). projects 갱신 시 handleDragEnd 재생성 — 비용 무시.

---

## 4. 작업 순서 (의존성)

```
C1 (fontSize prop)              ← 독립, Issue #1 완결
  ↓
C2 (useDraggable data)          ← C3/C4 의존성
  ↓
C3 (ProjectGroup droppable)     ← canMoveTaskToProject helper 정의 (C4 가 import)
  ↓
C4 (Shell drop handler)         ← C3 의 helper import + R-05 분기
```

**의존성 핵심**:
- C2 가 C3 의 isOver 시각 피드백 + C4 의 active.data 조회 필수.
- C3 의 `canMoveTaskToProject` export → C4 의 import.
- C4 가 C3 droppable 의 drop 이벤트를 수신.
- 중간 단계에서 빌드 통과 + 부분 동작 가능 (drop 시도 시 무반응 → 이상 동작 없음).

---

## 5. 검증 절차

### 5-1. 커밋별 즉시 검증

각 커밋 머지 직후:
```bash
npm run build              # AC-18 빌드 통과
```

**C1 후**: FocusCard 펼침 → 노트 입력 → 폰트 12 시각 확인 (브라우저). DetailPanel 노트 14 보존 확인.
**C2 후**: 동작 변화 없음 (data 첨부만). 빌드 통과만 확인.
**C3 후**: 백로그 task drag 시 다른 project 헤더에 hover → 시각 피드백 (bgHover 또는 dim) 표시. drop = no-op (Shell 핸들러 미구현).
**C4 후**: drop 시 실제 projectId 갱신 → view 즉시 갱신.

### 5-2. 통합 검증 (4커밋 누적 후)

Spec §7 의 13 시나리오 모두 수동 실행:

**Issue #1 회귀** (5건):
1. FocusCard 펼침 노트 폰트 12 확인 (AC-01, AC-02)
2. DetailPanel 노트 폰트 14 확인 (AC-03)
3. MemoryView 메모 폰트 14 확인 (AC-04)
4. ProjectView OutlinerTaskNode 노트 14 확인 (AC-05)
5. ProjectView CompactTaskRow 노트 14 확인 (AC-06)

**Issue #2 신규 + 회귀** (8건):
6. private task → personal project drop (AC-08)
7. "다음" / "남은" 섹션도 동일 (AC-09)
8. system project ("즉시") 로 drop (AC-10)
9. team task → same-team project drop (AC-11)
10. private → team project drop 차단 (AC-12, dim+not-allowed)
11. team → personal project drop 차단 (AC-13)
12. 같은 project 로 drop = no-op (AC-14)
13. focus panel drop / focus reorder 회귀 (AC-15, AC-16)

### 5-3. 회귀 위험 모니터링

- **mobile 13 의 lineHeight 19→18 변화** (C1): mobile FocusCard 시각 확인. 1줄 textarea 의 시각 회귀 시 비례 계수 조정 (1.42 → 1.46).
- **C3 의 useDndContext 호출** (drag 활성화 시 매 렌더 active 변경 → ProjectGroup re-render): 50+ project 환경에서 성능 측정. 이슈 시 React.memo 또는 useDndMonitor 으로 최적화 (별도 Loop).
- **active.data 직접 사용** (C4, W2/W-NEW-1 갱신): `tasks.find()` fallback 제거. `active.data?.current?.task` 만 사용 — undefined 시 `if (!task...)` early return → 데이터 손실 없음. R-06 적용 보장으로 항상 첨부되므로 early return 미발동.

---

## 6. 미해결 / 후속 항목

- **W5 (3차) — useDndContext re-render 비용**: drag 시작/종료마다 모든 ProjectGroup 동시 re-render. 사용자 스크린샷 환경 (~10 project) 무영향, 50+ project 환경 알려진 위험. 별도 Loop 후보 — 옵션:
  - (a) `useDndMonitor` 도입 + 로컬 state 로 active 추적. ProjectGroup re-render 회피
  - (b) `React.memo(PersonalTodoProjectGroup)` + custom comparator. 효과 제한적 (context 변경 시 re-render 강제)
  - (c) 부모 (PersonalTodoListTable) 에서 active 1회 계산 후 prop drilling. 가장 확실하지만 침습적
- **scope 가드 비대칭** (Spec N-03b): UnifiedGridView 매트릭스 cross-cell move 의 team→personal 자동 변환 동작은 본 Loop 범위 외. 별도 Loop 후보.
- **백로그 task reorder 기능**: 같은 project 내 reorder 미지원. SortableContext 도입 + Shell handler 확장 필요. 별도 Loop.
- **mobile DnD UX 검증**: TouchSensor 기존 설정 (delay 200, tolerance 5) 그대로 사용. mobile 사용 시 cross-project drop 사용성 확인 필요 (UX 보고 시).
- **CompactTaskRow / OutlinerTaskNode 의 setTimeout(30/50ms) focus**: Loop-48 의 useOutliner hybrid pattern 미적용. 별도 핫픽스 후보.
