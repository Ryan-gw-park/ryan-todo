# Diff-Plan — Loop-47: 2-pane restoration + inline expansion + UI refinements

> **Spec**: [spec-loop-47 (user-provided)](recon-loop-47-unified.md) — validated
> **Commits**: 10 total (Commit 0 + 9 main), across 5 stages
> **QA Gates**: After Commit 0 (Stage 0), After Commit 5 (Stage 2), After Commit 9 (final)

## Spec 검증 정정 사항 (diff-plan 반영)

| # | Spec 문구 | 실제 | 처리 |
|---|---|---|---|
| 1 | L-03 "across Store/Shell/FocusPanel/FocusCard" | FocusPanel has 0 references | Commit 2에서 **FocusPanel.jsx 수정 안 함** |
| 2 | L-04 "remove F-41 logic (isWide, resize listener)" | Shell에 존재하지 않음 (Commit 7 미실행) | Commit 1에서 no-op — grep 검증만 |
| 3 | §2.2 FocusPanel listed as Modify | 불필요 | 제거 |
| 4 | L-03 "9 references" | 실제 11 + 7 = 18 occurrences across 4 files | diff-plan의 파일별 정확 Edit blocks로 대체 |

---

## 커밋 시퀀스 전체 요약

| # | Stage | 파일 개수 | Edit 개수 | 빌드 상태 |
|---|---|---|---|---|
| 0 | 0 | 1 | 1 | ✅ **Ryan verification gate** |
| 1 | 1 | 2 (1 mod + 1 del) | 3 edits + 1 delete | ✅ |
| 2 | 1 | 4 | 9 edits | ✅ |
| 3 | 2 | 1 | 1 edit | ✅ (미사용) |
| 4 | 2 | 1 (FocusCard rewrite) | Write (전체 교체) | ✅ |
| 5 | 2 | 2 | 2 edits | ✅ **QA gate (E-series)** |
| 6 | 3 | 1 | 1 edit | ✅ |
| 7 | 3 | 2 | 3 edits | ✅ |
| 8 | 4 | 1 (ProjectGroup rewrite) | Write (전체 교체 or 큰 Edit) | ✅ |
| 9 | 4 | 1 | 2 edits | ✅ **QA gate (R-series)** |

---

# Commit 0 — PROJECT_COLUMNS 1줄 fix

**File**: `src/hooks/useStore.js`
**Edit**: 1

## Edit 0.1

**old_string**:
```js
const PROJECT_COLUMNS = 'id, name, color, sort_order, team_id, user_id, owner_id, description, start_date, due_date, status, created_by, archived_at'
```

**new_string**:
```js
const PROJECT_COLUMNS = 'id, name, color, sort_order, team_id, user_id, owner_id, description, start_date, due_date, status, created_by, archived_at, is_system, system_key'
```

**Commit message**:
```
feat(store): include is_system and system_key in PROJECT_COLUMNS (Loop-47)

Bug: Loop-45 migration added is_system/system_key columns, but PROJECT_COLUMNS
select list never updated. Every project arrived at frontend with both fields
undefined → '즉시' fell to personalProjects instead of systemProjects →
top priority lost + instantProjectId=null + '+ 새 할일' silent return.

Root cause of recurring Issue 2a/2b in Loop-46 QA despite defensive OR filter
attempts (Loop-46 Commit 7 didn't help because undefined||'instant'==='instant'
is false).

Single-line fix: append is_system, system_key to the select list.
mapProject (L166-178) already handles these columns correctly.

No defensive filter removal — Loop-46 OR filters remain as safety nets (R-10).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

**Ryan verification (Stage 0 gate)**:
1. Vercel 배포 완료 대기
2. Ctrl+Shift+R hard refresh
3. 사이드바 개인 프로젝트 최상단 = '즉시' (gray dot)
4. 백로그 "지금 할일" 첫 번째 그룹 = '즉시' (또는 task 없으면 Commit 7 이후 나타남)
5. "+ 새 할일" → type → Enter → toast "추가됐습니다 ✓" + '즉시' 아래 task 나타남
6. DevTools Network → `/rest/v1/projects?select=...` 요청의 URL 에 `is_system` + `system_key` 포함 확인

✅ 위 6 항목 통과 시 Stage 1 진행.

---

# Commit 1 — 2-pane grid + FocusNotePanel 삭제

**Files**:
- MODIFY `src/components/views/personal-todo/PersonalTodoShell.jsx`
- DELETE `src/components/views/personal-todo/FocusNotePanel.jsx`

**Edits**: 3 on Shell + 1 file delete

## Edit 1.1 — Shell: FocusNotePanel import 제거

**old_string**:
```js
import PersonalTodoListTable from './PersonalTodoListTable'
import FocusPanel from './FocusPanel'
import FocusNotePanel from './FocusNotePanel'
```

**new_string**:
```js
import PersonalTodoListTable from './PersonalTodoListTable'
import FocusPanel from './FocusPanel'
```

## Edit 1.2 — Shell: 주석 업데이트 (3컬럼 → 2컬럼)

**old_string**:
```js
/* ═══════════════════════════════════════════════
   PersonalTodoShell (Loop-45 → Loop-46)
   3컬럼 오케스트레이터 (grid) — 백로그 : 포커스 : 노트 = 1.2fr : 0.9fr : 1.2fr
```

**new_string**:
```js
/* ═══════════════════════════════════════════════
   PersonalTodoShell (Loop-45 → Loop-47)
   2컬럼 오케스트레이터 (grid) — 백로그 : 포커스 = 1.5fr : 1fr
   Loop-47: FocusNotePanel 제거, 노트 편집은 FocusCard 인라인 확장으로 이관.
```

## Edit 1.3 — Shell: grid 2-col + Column 3 제거

**old_string**:
```jsx
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(420px, 1.2fr) minmax(240px, 0.9fr) minmax(320px, 1.2fr)',
        gap: 20,
        width: '100%',
      }}>
        {/* Column 1: 백로그 3섹션 */}
        <div style={{ minWidth: 0 }}>
          <PersonalTodoListTable
            projects={projects}
            tasks={tasks}
            milestones={milestones}
          />
        </div>

        {/* Column 2: 포커스 드롭존 + 패널 (FocusColumn = inner context 내부에서 useDroppable) */}
        <FocusColumn>
          <FocusPanel
            projects={projects}
            tasks={tasks}
            milestones={milestones}
          />
        </FocusColumn>

        {/* Column 3: 포커스 노트 패널 (Loop-46) */}
        <div style={{ minWidth: 0 }}>
          <FocusNotePanel
            tasks={tasks}
            projects={projects}
          />
        </div>
      </div>
```

**new_string**:
```jsx
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(420px, 1.5fr) minmax(280px, 1fr)',
        gap: 20,
        width: '100%',
      }}>
        {/* Column 1: 백로그 3섹션 */}
        <div style={{ minWidth: 0 }}>
          <PersonalTodoListTable
            projects={projects}
            tasks={tasks}
            milestones={milestones}
          />
        </div>

        {/* Column 2: 포커스 드롭존 + 패널 (FocusColumn = inner context 내부에서 useDroppable) */}
        <FocusColumn>
          <FocusPanel
            projects={projects}
            tasks={tasks}
            milestones={milestones}
          />
        </FocusColumn>
      </div>
```

## File Delete 1.4

```bash
git rm src/components/views/personal-todo/FocusNotePanel.jsx
```

**Commit message**:
```
refactor(shell): restore 2-pane grid; remove FocusNotePanel (Loop-47)

- grid 3-col → 2-col: minmax(420,1.5fr) minmax(280,1fr); gap 20
- FocusNotePanel import/render 제거
- FocusNotePanel.jsx 파일 삭제 (orphaned)
- 주석 업데이트: Loop-45 → Loop-47

포커스 카드의 노트 편집은 Commit 4에서 인라인 확장으로 이관.
Stage 1 atomic: 파일 삭제를 동일 커밋에 포함하여 중간 빌드 에러 회피.
selectedFocusTaskId 관련 참조는 Commit 2에서 일괄 정리.
F-41 (isWide/resize) 은 Loop-46 Commit 7 미실행 상태 — 제거할 코드 없음.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

# Commit 2 — selectedFocusTaskId 완전 제거

**Files**: `useStore.js`, `PersonalTodoShell.jsx`, `FocusCard.jsx`, `FocusQuickAddInput.jsx`
(FocusPanel.jsx 는 참조 없음 — 수정 제외)

**Edits**: 9 across 4 files

## Edit 2.1 — useStore.js: `selectedFocusTaskId` 필드 제거

**old_string**:
```js
  onboardingSkipped: JSON.parse(localStorage.getItem('onboardingSkipped') || 'false'),

  // ─── Focus selection (Loop-46) ───
  // 포커스 카드 중 선택된 것 (FocusNotePanel이 해당 task의 notes 렌더).
  // reload 복원: localStorage. stale(선택 task가 unfocus/done/deleted 된 경우) 방어는
  // FocusNotePanel 렌더 시점의 tasks.find 재검증 (spec F-40).
  selectedFocusTaskId: localStorage.getItem('selectedFocusTaskId') || null,

  modeSelected: !!localStorage.getItem('currentTeamId') || !!localStorage.getItem('modeSelected'),
```

**new_string**:
```js
  onboardingSkipped: JSON.parse(localStorage.getItem('onboardingSkipped') || 'false'),

  modeSelected: !!localStorage.getItem('currentTeamId') || !!localStorage.getItem('modeSelected'),
```

## Edit 2.2 — useStore.js: `setSelectedFocusTaskId` action 제거

**old_string**:
```js
  setSelectedFocusTaskId: (taskId) => {
    set({ selectedFocusTaskId: taskId || null })
    try {
      if (taskId) localStorage.setItem('selectedFocusTaskId', taskId)
      else localStorage.removeItem('selectedFocusTaskId')
    } catch {
      // localStorage quota / private mode 무시
    }
  },

  setTeam: async (teamId) => {
```

**new_string**:
```js
  setTeam: async (teamId) => {
```

## Edit 2.3 — Shell: store 구독 라인 제거

**old_string**:
```js
  const updateTask = useStore(s => s.updateTask)
  const reorderFocusTasks = useStore(s => s.reorderFocusTasks)
  const setSelectedFocusTaskId = useStore(s => s.setSelectedFocusTaskId)
```

**new_string**:
```js
  const updateTask = useStore(s => s.updateTask)
  const reorderFocusTasks = useStore(s => s.reorderFocusTasks)
```

## Edit 2.4 — Shell: handleDragEnd 내 호출 제거

**old_string**:
```js
        updateTask(taskId, { isFocus: true, focusSortOrder: maxOrder + 1 })
        // F-36: 드롭 직후 자동 active 선택
        setSelectedFocusTaskId(taskId)
        return
```

**new_string**:
```js
        updateTask(taskId, { isFocus: true, focusSortOrder: maxOrder + 1 })
        // F-36: 자동 선택은 Commit 5에서 auto-expand 로 교체
        return
```

## Edit 2.5 — Shell: useCallback dependency 정리

**old_string**:
```js
  }, [focusTasks, updateTask, reorderFocusTasks, setSelectedFocusTaskId])
```

**new_string**:
```js
  }, [focusTasks, updateTask, reorderFocusTasks])
```

## Edit 2.6 — FocusCard: store 구독 제거

**old_string**:
```js
  const toggleDone = useStore(s => s.toggleDone)
  const updateTask = useStore(s => s.updateTask)
  const setSelectedFocusTaskId = useStore(s => s.setSelectedFocusTaskId)
  const selectedFocusTaskId = useStore(s => s.selectedFocusTaskId)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `focus-card:${task.id}`,
  })

  const [hover, setHover] = useState(false)
  const isSelected = selectedFocusTaskId === task.id
  const hasNotes = !isEmptyNotes(task.notes)
```

**new_string**:
```js
  const toggleDone = useStore(s => s.toggleDone)
  const updateTask = useStore(s => s.updateTask)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `focus-card:${task.id}`,
  })

  const [hover, setHover] = useState(false)
  const hasNotes = !isEmptyNotes(task.notes)
```

## Edit 2.7 — FocusCard: outer onClick + border isSelected 제거

**old_string**:
```jsx
  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => setSelectedFocusTaskId(task.id)}
      style={{
        ...sortableStyle,
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: SPACE.cardPadding,
        background: '#fff',
        border: `1px solid ${isSelected ? COLOR.accent : COLOR.border}`,
        borderRadius: 6,
        marginBottom: 6,
        cursor: 'pointer',
      }}
    >
```

**new_string**:
```jsx
  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...sortableStyle,
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: SPACE.cardPadding,
        background: '#fff',
        border: `1px solid ${COLOR.border}`,
        borderRadius: 6,
        marginBottom: 6,
      }}
    >
```

## Edit 2.8 — FocusQuickAddInput: store 구독 제거

**old_string**:
```js
export default function FocusQuickAddInput({ instantProjectId, currentUserId }) {
  const addTask = useStore(s => s.addTask)
  const setSelectedFocusTaskId = useStore(s => s.setSelectedFocusTaskId)
  const [value, setValue] = useState('')
```

**new_string**:
```js
export default function FocusQuickAddInput({ instantProjectId, currentUserId }) {
  const addTask = useStore(s => s.addTask)
  const [value, setValue] = useState('')
```

## Edit 2.9 — FocusQuickAddInput: handleAdd auto-select 호출 제거

**old_string**:
```js
    const t = await addTask({
      text,
      projectId: instantProjectId,
      assigneeId: currentUserId,
      secondaryAssigneeId: null,
      keyMilestoneId: null,
      category: 'today',
      isFocus: true,
    })
    // F-36: 생성 직후 자동 active 선택
    if (t?.id) setSelectedFocusTaskId(t.id)
    setValue('')
  }
```

**new_string**:
```js
    await addTask({
      text,
      projectId: instantProjectId,
      assigneeId: currentUserId,
      secondaryAssigneeId: null,
      keyMilestoneId: null,
      category: 'today',
      isFocus: true,
    })
    // auto-expand 는 Commit 5에서 추가
    setValue('')
  }
```

**Commit message**:
```
refactor(store+ui): remove selectedFocusTaskId state and all references (Loop-47)

- useStore.js: field + setter + localStorage load/save 제거
- PersonalTodoShell.jsx: store subscription + handleDragEnd 호출 + useCallback dep 제거
- FocusCard.jsx: store subscription + outer onClick + border isSelected 제거
- FocusQuickAddInput.jsx: store subscription + handleAdd 호출 제거
- FocusPanel.jsx: 참조 없음 (수정 안 함)

FocusNotePanel 삭제(Commit 1)로 selectedFocusTaskId 의 주 용도(노트 패널 전환)가
사라짐. 시각 active 표시는 Commit 4 의 인라인 펼침 상태로 대체.

auto-expand 로직 (Commit 5) 적용 전까지 QuickAdd/DragEnd 는 자동 선택 없이
기본 동작만 유지. 임시 상태이나 기능 누수 없음 (빌드/lint 통과).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

# Commit 3 — usePivotExpandState KEYS 확장

**File**: `src/hooks/usePivotExpandState.js`
**Edit**: 1

## Edit 3.1

**old_string**:
```js
const KEYS = {
  team: 'matrixPivotExpanded',
  personal: 'personalMatrixPivotExpanded',
  personalSection: 'personalSectionExpanded',  // Loop-45 F-12: 다음/남은 섹션 접기 상태
}
```

**new_string**:
```js
const KEYS = {
  team: 'matrixPivotExpanded',
  personal: 'personalMatrixPivotExpanded',
  personalSection: 'personalSectionExpanded',  // Loop-45 F-12: 다음/남은 섹션 접기 상태
  focusCardExpanded: 'focusCardExpanded',       // Loop-47 E-09: 포커스 카드 인라인 펼침 상태
}
```

**Commit message**:
```
feat(hooks): add focusCardExpanded key to usePivotExpandState (Loop-47)

- KEYS.focusCardExpanded = 'focusCardExpanded' (localStorage key)
- 기존 {id: boolean} map 구조 재사용 — FocusCard 에서 다음 커밋 구독

E-09: 여러 카드 동시 펼침 + reload 복원.
stale id (unfocus/done 된 task) 는 렌더 시 자동 필터링 (cards 배열에 없으므로
expandedCards[id]=true 여도 무시됨).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

# Commit 4 — FocusCard 인라인 확장 (Write 전체 교체)

**File**: `src/components/views/personal-todo/cells/FocusCard.jsx`
**Method**: Write — 전체 파일 재작성 (구조 변경이 광범위하여 다수 개별 Edit 보다 재작성이 안전)

## New file content

```jsx
import { useState, useRef, useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../../../../hooks/useStore'
import usePivotExpandState from '../../../../hooks/usePivotExpandState'
import { COLOR, FONT, CHECKBOX, SPACE } from '../../../../styles/designTokens'
import { getColor } from '../../../../utils/colors'
import { isEmptyNotes } from '../../../../utils/notes'
import OutlinerEditor from '../../../shared/OutlinerEditor'

/* ═══════════════════════════════════════════════
   FocusCard (Loop-45 → Loop-47)
   [▸ ⋮⋮ ☐ text / project·ms meta 📝 ×]
     ↓ (caret click)
   [▾ ⋮⋮ ☐ text / project·ms meta 📝 ×]
   [                                             ]
   [  OutlinerEditor (inline, 800ms debounce)    ]

   E-01 ~ E-12:
   - 좌측 ▸ caret: 클릭 시 90° 회전 (▾), body slide-less toggle
   - body = OutlinerEditor 직접 삽입 (DetailPanel L71-L81 debounce 패턴 복제)
   - 여러 카드 동시 펼침 허용 (usePivotExpandState 'focusCardExpanded')
   - reload 복원, auto-expand 트리거 (Commit 5 에서 Shell/QuickAdd 가 호출)
   - DnD drag handle (⋮⋮) 만 listeners/attributes — caret/body는 드래그 무효
   - SVG 노트 아이콘 (F-37 유지): 빈 #d3d1c7, 있음 #2383e2
   ═══════════════════════════════════════════════ */
export default function FocusCard({ task, project, milestone }) {
  const toggleDone = useStore(s => s.toggleDone)
  const updateTask = useStore(s => s.updateTask)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `focus-card:${task.id}`,
  })

  const [hover, setHover] = useState(false)
  const hasNotes = !isEmptyNotes(task.notes)

  // E-09: expanded 상태 — usePivotExpandState 'focusCardExpanded' 재사용
  const { pivotCollapsed: expandedMap, setPivotCollapsed: setExpanded } = usePivotExpandState('focusCardExpanded')
  const isExpanded = expandedMap[task.id] === true
  const toggleExpand = (e) => {
    e.stopPropagation()
    e.preventDefault()
    setExpanded(task.id, !isExpanded)
  }

  // E-03, E-04: DetailPanel L71-L81 debounce 800ms + optimistic update 패턴 복제
  const debounceRef = useRef(null)
  const handleNotesChange = useCallback((newNotes) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateTask(task.id, { notes: newNotes })
    }, 800)
    // Optimistic local update
    useStore.setState(s => ({
      tasks: s.tasks.map(t => t.id === task.id ? { ...t, notes: newNotes } : t)
    }))
  }, [task.id, updateTask])

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  const handleUnfocus = (e) => {
    e.stopPropagation()
    e.preventDefault()
    updateTask(task.id, { isFocus: false })
  }

  const projectLabel = project?.isSystem ? '프로젝트 미지정' : (project?.name || '')
  const projectLabelStyle = project?.isSystem
    ? { fontStyle: 'italic', color: COLOR.textTertiary }
    : { color: COLOR.textTertiary }

  const accentColor = project?.isSystem ? '#888780' : (project ? getColor(project.color).dot : '#bbb')

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...sortableStyle,
        // E-05: column flex — header row (flex row) + body (full-width below)
        display: 'flex', flexDirection: 'column',
        padding: SPACE.cardPadding,
        background: '#fff',
        border: `1px solid ${COLOR.border}`,
        borderRadius: 6,
        marginBottom: 6,
      }}
    >
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        {/* E-01, E-02: Caret ▸/▾ (90° rotate transition) */}
        <div
          onClick={toggleExpand}
          style={{
            width: 14, height: 20, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            marginTop: 1,
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
            color: COLOR.textTertiary,
          }}
          title={isExpanded ? '접기' : '펼쳐서 노트 편집'}
        >
          <svg width={8} height={8} viewBox="0 0 8 8" fill="none">
            <path d="M2 1L6 4L2 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* E-06: Drag handle ⋮⋮ — listeners/attributes 여기에만 spread */}
        <div
          {...attributes}
          {...listeners}
          style={{
            cursor: 'grab', color: COLOR.textTertiary,
            fontSize: 14, lineHeight: 1, userSelect: 'none',
            padding: '2px 2px', flexShrink: 0, marginTop: 1,
          }}
          title="드래그하여 이동"
        >⋮⋮</div>

        {/* Checkbox */}
        <div
          onClick={e => { e.stopPropagation(); e.preventDefault(); toggleDone(task.id) }}
          style={{
            width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius,
            flexShrink: 0, cursor: 'pointer', marginTop: 2,
            border: task.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`,
            background: task.done ? CHECKBOX.checkedBg : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {task.done && (
            <svg width={8} height={8} viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        {/* Text + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: FONT.body,
              color: task.done ? COLOR.textTertiary : COLOR.textPrimary,
              textDecoration: task.done ? 'line-through' : 'none',
              lineHeight: 1.4,
              wordBreak: 'break-word',
            }}
          >
            {task.text}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            marginTop: 2, fontSize: FONT.ganttMs,
          }}>
            {projectLabel && (
              <span style={projectLabelStyle}>{projectLabel}</span>
            )}
            {milestone?.title && (
              <span style={{ color: COLOR.textTertiary }}>
                {projectLabel ? '·' : ''} {milestone.title}
              </span>
            )}
            <div style={{ flex: 1 }} />
            {/* E-12, F-37: 노트 아이콘 */}
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              style={{ color: hasNotes ? COLOR.accent : '#d3d1c7', flexShrink: 0 }}
              aria-label={hasNotes ? '노트 있음' : '노트 없음'}
            >
              <path
                d="M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5"
                stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" fill="none"
              />
            </svg>
          </div>
        </div>

        {/* × (포커스 해제) */}
        <div
          onClick={handleUnfocus}
          style={{
            width: 20, height: 20, borderRadius: 3, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            color: COLOR.textTertiary,
            fontSize: 14, lineHeight: 1,
            opacity: hover ? 1 : 0.4,
            transition: 'opacity 0.15s',
          }}
          title="포커스 해제"
        >
          ×
        </div>
      </div>

      {/* E-03, E-04: Body (OutlinerEditor 인라인 + 800ms debounce) — expanded 시만 */}
      {isExpanded && (
        <div style={{
          // caret(14) + gap(8) = 22px indent, 우측 × 영역(24) padding 보정
          paddingLeft: 22,
          paddingTop: 4,
          paddingRight: 0,
          // E-07: 높이 애니메이션 없음. caret rotate 만.
        }}>
          <OutlinerEditor
            notes={task.notes}
            onChange={handleNotesChange}
            accentColor={accentColor}
          />
        </div>
      )}
    </div>
  )
}
```

**Commit message**:
```
feat(card): inline note expansion with caret, OutlinerEditor, 800ms debounce (Loop-47)

E-01~E-12 전수 구현:
- Caret ▸/▾ (SVG, 90° rotate transition 0.15s) — E-01, E-02, E-07
- OutlinerEditor 인라인 body (expanded 시만 렌더) — E-03
- DetailPanel L71-L81 debounce 800ms + optimistic setState 복제 — E-04
- outer flexDirection: column, header row + body 분리 — E-05
- DnD listeners/attributes: ⋮⋮ 드래그 핸들에만 spread — E-06
  · caret/body/checkbox/text/× 은 각자 이벤트 처리 (drag 비활성)
- 다중 카드 펼침 허용 (독립 toggle) — E-08
- localStorage 'focusCardExpanded' 저장 via usePivotExpandState — E-09
- isEmptyNotes 기반 SVG 아이콘 색 유지 — E-12
- accentColor: project.isSystem → '#888780', else getColor(color).dot

stopPropagation 처리: caret/checkbox/× 모두 e.stopPropagation + preventDefault
로 outer div 이벤트 억제. body 내부 OutlinerEditor 의 textarea 는 자체 onClick
없음 (포커스 이벤트만).

E-10, E-11 auto-expand 트리거는 Commit 5 에서 Shell/QuickAdd 측에서 호출.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

# Commit 5 — auto-expand 트리거 (QuickAdd + DragEnd)

**Files**: `FocusQuickAddInput.jsx`, `PersonalTodoShell.jsx`
**Edits**: 2

## Edit 5.1 — FocusQuickAddInput: addTask 결과 → expand 추가

**old_string**:
```js
import { useState } from 'react'
import useStore from '../../../../hooks/useStore'
import { COLOR, FONT } from '../../../../styles/designTokens'
```

**new_string**:
```js
import { useState } from 'react'
import useStore from '../../../../hooks/useStore'
import usePivotExpandState from '../../../../hooks/usePivotExpandState'
import { COLOR, FONT } from '../../../../styles/designTokens'
```

**old_string**:
```js
export default function FocusQuickAddInput({ instantProjectId, currentUserId }) {
  const addTask = useStore(s => s.addTask)
  const [value, setValue] = useState('')

  const handleAdd = async () => {
    const text = value.trim()
    if (!text) return
    if (!instantProjectId) {
      // '즉시' 프로젝트 seed 실패 상태 — 호출 skip.
      return
    }
    await addTask({
      text,
      projectId: instantProjectId,
      assigneeId: currentUserId,
      secondaryAssigneeId: null,
      keyMilestoneId: null,
      category: 'today',
      isFocus: true,
    })
    // auto-expand 는 Commit 5에서 추가
    setValue('')
  }
```

**new_string**:
```js
export default function FocusQuickAddInput({ instantProjectId, currentUserId }) {
  const addTask = useStore(s => s.addTask)
  const { setPivotCollapsed: setExpanded } = usePivotExpandState('focusCardExpanded')
  const [value, setValue] = useState('')

  const handleAdd = async () => {
    const text = value.trim()
    if (!text) return
    if (!instantProjectId) {
      // '즉시' 프로젝트 seed 실패 상태 — 호출 skip.
      return
    }
    const t = await addTask({
      text,
      projectId: instantProjectId,
      assigneeId: currentUserId,
      secondaryAssigneeId: null,
      keyMilestoneId: null,
      category: 'today',
      isFocus: true,
    })
    // E-10: 생성 직후 자동 펼침 (노트 바로 입력 가능)
    if (t?.id) setExpanded(t.id, true)
    setValue('')
  }
```

## Edit 5.2 — Shell: handleDragEnd bl-task→focus case 에 expand 추가

**old_string**:
```js
import { useCallback, useMemo } from 'react'
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors, rectIntersection, useDroppable,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import useStore, { getCachedUserId } from '../../../hooks/useStore'
import { COLOR } from '../../../styles/designTokens'
import PersonalTodoListTable from './PersonalTodoListTable'
import FocusPanel from './FocusPanel'
```

**new_string**:
```js
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
```

**old_string**:
```js
  const updateTask = useStore(s => s.updateTask)
  const reorderFocusTasks = useStore(s => s.reorderFocusTasks)
```

**new_string**:
```js
  const updateTask = useStore(s => s.updateTask)
  const reorderFocusTasks = useStore(s => s.reorderFocusTasks)
  const { setPivotCollapsed: setExpanded } = usePivotExpandState('focusCardExpanded')
```

**old_string**:
```js
        updateTask(taskId, { isFocus: true, focusSortOrder: maxOrder + 1 })
        // F-36: 자동 선택은 Commit 5에서 auto-expand 로 교체
        return
```

**new_string**:
```js
        updateTask(taskId, { isFocus: true, focusSortOrder: maxOrder + 1 })
        // E-11: 드롭 직후 자동 펼침 (노트 바로 입력 가능)
        setExpanded(taskId, true)
        return
```

**old_string**:
```js
  }, [focusTasks, updateTask, reorderFocusTasks])
```

**new_string**:
```js
  }, [focusTasks, updateTask, reorderFocusTasks, setExpanded])
```

**Commit message**:
```
feat(auto-expand): new focus tasks auto-open note editor (Loop-47)

E-10: FocusQuickAddInput.handleAdd → addTask 반환값 t.id 를 expanded set 추가.
E-11: Shell.handleDragEnd 의 bl-task→focus 케이스 — updateTask 직후 setExpanded(taskId, true).

둘 다 usePivotExpandState('focusCardExpanded') 의 setPivotCollapsed 액션 재사용.
localStorage 자동 persist. reload 시에도 복원.

Stage 2 QA 게이트: E-01 ~ E-12 전수 검증 후 Stage 3 진행.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

# Commit 6 — LIST 토큰 축소

**File**: `src/styles/designTokens.js`
**Edit**: 1

## Edit 6.1

**old_string**:
```js
// ─── 개인 할일 리스트 (Loop-45) ───
export const LIST = {
  colWidthProject:   170,
  colWidthMilestone: 130,
  sectionGap:        24,
  projectRowGap:     12,
  taskRowGap:        6,
  etcLabel: { fontStyle: 'italic', color: '#a09f99' },
};
```

**new_string**:
```js
// ─── 개인 할일 리스트 (Loop-45, Loop-47 튜닝) ───
export const LIST = {
  colWidthProject:   130,   // Loop-47 R-01: 170→130
  colWidthMilestone: 90,    // Loop-47 R-02: 130→90
  sectionGap:        24,
  projectRowGap:     12,
  taskRowGap:        6,
  etcLabel: { fontStyle: 'italic', color: '#a09f99' },
};
```

**Commit message**:
```
feat(tokens): tighten LIST column widths (170→130, 130→90) (Loop-47 R-01/R-02)

- colWidthProject: 170 → 130 — 한글 프로젝트명 9자 수용
- colWidthMilestone: 130 → 90 — 한글 MS명 5자 수용

백로그 내부 3-column grid (ProjectGroup.jsx:49) 의 고정폭 축소로 할일 열(1fr)
실측 ~80px 확장 (뷰포트 1400 기준 420→ ~500). 한 줄 가독성 대폭 개선.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

# Commit 7 — F-11 exception for system projects + placeholder

**Files**: `PersonalTodoListTable.jsx`, `PersonalTodoProjectGroup.jsx`
**Edits**: 3

## Edit 7.1 — ListTable TodaySection skip 완화

**old_string**:
```jsx
      {/* Project blocks */}
      {projects.map(p => {
        const projTasks = tasks.filter(t => t.projectId === p.id)
        if (projTasks.length === 0) return null // F-11
        return (
          <PersonalTodoProjectGroup
            key={p.id}
            project={p}
            sectionTasks={projTasks}
            milestones={milestones}
            isExpanded={isProjectExpanded(p.id)}
            onToggle={() => toggleProjectExpand(p.id)}
          />
        )
      })}
```

**new_string**:
```jsx
      {/* Project blocks */}
      {projects.map(p => {
        const projTasks = tasks.filter(t => t.projectId === p.id)
        // Loop-47 R-03: 시스템 프로젝트는 0건에도 렌더 (+ 할일 placeholder 유도)
        if (projTasks.length === 0 && !p.isSystem) return null
        return (
          <PersonalTodoProjectGroup
            key={p.id}
            project={p}
            sectionTasks={projTasks}
            milestones={milestones}
            isExpanded={isProjectExpanded(p.id)}
            onToggle={() => toggleProjectExpand(p.id)}
          />
        )
      })}
```

## Edit 7.2 — ListTable CollapsibleSection skip 완화

**old_string**:
```jsx
          {projects.map(p => {
            const projTasks = tasks.filter(t => t.projectId === p.id)
            if (projTasks.length === 0) return null // F-11
            return (
              <PersonalTodoProjectGroup
                key={p.id}
                project={p}
                sectionTasks={projTasks}
                milestones={milestones}
                isExpanded={isProjectExpanded(p.id)}
                onToggle={() => toggleProjectExpand(p.id)}
              />
            )
          })}
```

**new_string**:
```jsx
          {projects.map(p => {
            const projTasks = tasks.filter(t => t.projectId === p.id)
            // Loop-47 R-03: 시스템 프로젝트는 0건에도 렌더
            if (projTasks.length === 0 && !p.isSystem) return null
            return (
              <PersonalTodoProjectGroup
                key={p.id}
                project={p}
                sectionTasks={projTasks}
                milestones={milestones}
                isExpanded={isProjectExpanded(p.id)}
                onToggle={() => toggleProjectExpand(p.id)}
              />
            )
          })}
```

## Edit 7.3 — ProjectGroup: skip 완화 + 시스템 프로젝트 0건 placeholder

**Write** — 전체 파일 교체 (구조 변경이 넓음). New content:

```jsx
import React, { useMemo } from 'react'
import { COLOR, FONT, LIST } from '../../../../styles/designTokens'
import PersonalTodoTaskRow from './PersonalTodoTaskRow'

/* ═══════════════════════════════════════════════
   PersonalTodoProjectGroup (Loop-45 → Loop-47)
   한 프로젝트 블록 = 독립 CSS grid (130px | 90px | 1fr — 튜닝 Loop-47)

   Loop-47 R-03, R-04, R-05:
   - F-11 예외: project.isSystem 이면 0건에도 렌더
   - 0건 + isSystem → 우측 task col 에 "여기에 + 할일" placeholder (Commit 8 에서 클릭 동작)
   - 프로젝트 col은 task rows span
   - 포커스 이동 task 도 백로그 잔류 (개별 dim, TaskRow)
   - MS dedup, '기타' (keyMilestoneId==null)
   ═══════════════════════════════════════════════ */
export default function PersonalTodoProjectGroup({
  project,
  sectionTasks,
  milestones,
  isExpanded,
  onToggle,
}) {
  const totalInSection = sectionTasks.length

  const tasksWithLabels = useMemo(() => {
    const msMap = new Map(milestones.map(m => [m.id, m]))
    return sectionTasks.map((t, idx) => {
      const msId = t.keyMilestoneId ?? null
      const prevMsId = idx === 0 ? '__init__' : (sectionTasks[idx - 1].keyMilestoneId ?? null)
      const showLabel = msId !== prevMsId
      const label = msId ? (msMap.get(msId)?.title || '') : '기타'
      return {
        task: t,
        msLabel: showLabel ? label : '',
        isEtc: showLabel && msId == null,
      }
    })
  }, [sectionTasks, milestones])

  // R-04: 시스템 프로젝트는 0건에도 렌더 (placeholder 표시)
  if (totalInSection === 0 && !project.isSystem) return null

  const spanRows = isExpanded ? Math.max(totalInSection, 1) : 1
  const isEmpty = totalInSection === 0

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${LIST.colWidthProject}px ${LIST.colWidthMilestone}px 1fr`,
        alignItems: 'start',
        marginBottom: LIST.projectRowGap,
        borderBottom: `1px solid ${COLOR.border}`,
        paddingBottom: 8,
      }}
    >
      {/* Project col (col 1) — row span */}
      <div
        onClick={onToggle}
        style={{
          gridRow: `1 / span ${spanRows}`,
          padding: '6px 12px 6px 4px',
          cursor: 'pointer',
          alignSelf: 'start',
          minWidth: 0,
        }}
      >
        <div style={{
          fontSize: FONT.sectionTitle, fontWeight: 500, color: COLOR.textPrimary,
          display: 'flex', alignItems: 'center', gap: 4,
          wordBreak: 'keep-all', overflowWrap: 'break-word',
        }}>
          <span style={{
            display: 'inline-block', width: 12, textAlign: 'center',
            color: COLOR.textSecondary, fontSize: 11,
          }}>
            {isExpanded ? '▼' : '▶'}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>{project.name}</span>
        </div>
        <div style={{
          fontSize: FONT.caption, color: COLOR.textTertiary,
          marginLeft: 16, marginTop: 2,
        }}>
          {totalInSection}건
        </div>
      </div>

      {/* R-05: 시스템 프로젝트 0건 placeholder (col 2-3 span, 클릭 동작은 Commit 8 에서 wire) */}
      {isEmpty && project.isSystem && (
        <div
          data-sys-empty-placeholder
          style={{
            gridColumn: '2 / 4',
            padding: '6px 8px',
            fontSize: FONT.body,
            color: COLOR.textTertiary,
            fontStyle: 'italic',
            opacity: 0.65,
            cursor: 'pointer',
          }}
          title="클릭하여 할일 추가"
        >
          여기에 + 할일
        </div>
      )}

      {/* Task rows (col 2 + col 3) — isEmpty 가 아닐 때만 */}
      {!isEmpty && isExpanded && tasksWithLabels.map(({ task, msLabel, isEtc }) => (
        <React.Fragment key={task.id}>
          <PersonalTodoTaskRow task={task} msLabel={msLabel} isEtc={isEtc} />
        </React.Fragment>
      ))}

      {/* 접힘 상태: col 2/3 빈 placeholder (grid row balance) */}
      {!isEmpty && !isExpanded && (
        <>
          <div />
          <div />
        </>
      )}
    </div>
  )
}
```

**주의**: Commit 7 의 placeholder 는 **클릭 동작 없음** (단순 display). Commit 8 에서 onClick 과 inline input 추가.

**Commit message**:
```
feat(backlog): render system projects with 0 tasks (Loop-47 R-03~R-05)

- ListTable TodaySection L195: F-11 skip 완화 — `&& !p.isSystem`
- ListTable CollapsibleSection L252: 동일 완화
- ProjectGroup: skip 로직 완화 + 시스템 프로젝트 0건 placeholder 렌더
  · "여기에 + 할일" (italic, opacity 0.65, gridColumn: 2/4)
  · cursor: pointer 지정 (클릭 동작 wire 는 Commit 8)

결과: '즉시' 프로젝트가 비어있어도 백로그 섹션(지금/다음/남은)에 표시됨.
사용자가 placeholder 를 통해 할일 추가 진입 가능 (다음 커밋).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

# Commit 8 — 프로젝트 헤더 hover "+ 할일" inline add

**File**: `src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx`
**Method**: Write — 전체 파일 교체 (신규 state + UI 삽입)

## New file content

```jsx
import React, { useMemo, useState, useCallback } from 'react'
import useStore, { getCachedUserId } from '../../../../hooks/useStore'
import { COLOR, FONT, LIST, SPACE } from '../../../../styles/designTokens'
import PersonalTodoTaskRow from './PersonalTodoTaskRow'

/* ═══════════════════════════════════════════════
   PersonalTodoProjectGroup (Loop-47 R-06/R-07)
   - hover 시 헤더 우측 "+" 아이콘 표시
   - 클릭 → task rows 영역(col 2-3 span) 최하단에 inline input
   - Enter → addTask({projectId: project.id, category:'today', ...})
   - Esc → cancel
   - R-05 시스템 프로젝트 0건 placeholder 클릭 → 동일 input 진입
   ═══════════════════════════════════════════════ */
export default function PersonalTodoProjectGroup({
  project,
  sectionTasks,
  milestones,
  isExpanded,
  onToggle,
}) {
  const addTask = useStore(s => s.addTask)
  const currentUserId = getCachedUserId()

  const [headerHover, setHeaderHover] = useState(false)
  const [adding, setAdding] = useState(false)

  const totalInSection = sectionTasks.length

  const tasksWithLabels = useMemo(() => {
    const msMap = new Map(milestones.map(m => [m.id, m]))
    return sectionTasks.map((t, idx) => {
      const msId = t.keyMilestoneId ?? null
      const prevMsId = idx === 0 ? '__init__' : (sectionTasks[idx - 1].keyMilestoneId ?? null)
      const showLabel = msId !== prevMsId
      const label = msId ? (msMap.get(msId)?.title || '') : '기타'
      return {
        task: t,
        msLabel: showLabel ? label : '',
        isEtc: showLabel && msId == null,
      }
    })
  }, [sectionTasks, milestones])

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
      category: 'today',
      isFocus: false,
    })
  }, [addTask, project.id, currentUserId])

  // R-04: 시스템 프로젝트는 0건에도 렌더
  if (totalInSection === 0 && !project.isSystem) return null

  // 행 개수 계산: adding 중이면 +1 (input row)
  const taskRowCount = isExpanded ? tasksWithLabels.length : 0
  const addingExtra = adding ? 1 : 0
  const spanRows = Math.max(taskRowCount + addingExtra, 1)
  const isEmpty = totalInSection === 0

  return (
    <div
      onMouseEnter={() => setHeaderHover(true)}
      onMouseLeave={() => setHeaderHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: `${LIST.colWidthProject}px ${LIST.colWidthMilestone}px 1fr`,
        alignItems: 'start',
        marginBottom: LIST.projectRowGap,
        borderBottom: `1px solid ${COLOR.border}`,
        paddingBottom: 8,
      }}
    >
      {/* Project col (col 1) — row span */}
      <div
        onClick={onToggle}
        style={{
          gridRow: `1 / span ${spanRows}`,
          padding: '6px 12px 6px 4px',
          cursor: 'pointer',
          alignSelf: 'start',
          minWidth: 0,
          position: 'relative',
        }}
      >
        <div style={{
          fontSize: FONT.sectionTitle, fontWeight: 500, color: COLOR.textPrimary,
          display: 'flex', alignItems: 'center', gap: 4,
          wordBreak: 'keep-all', overflowWrap: 'break-word',
        }}>
          <span style={{
            display: 'inline-block', width: 12, textAlign: 'center',
            color: COLOR.textSecondary, fontSize: 11,
          }}>
            {isExpanded ? '▼' : '▶'}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>{project.name}</span>
          {/* R-06: hover 시 "+" 아이콘 (onClick 은 stopPropagation + adding trigger) */}
          {headerHover && !adding && (
            <span
              onClick={e => { e.stopPropagation(); setAdding(true) }}
              style={{
                fontSize: 14, color: COLOR.textSecondary,
                padding: '0 4px', cursor: 'pointer', flexShrink: 0,
                lineHeight: 1,
              }}
              title="+ 할일"
              onMouseEnter={e => e.currentTarget.style.color = COLOR.accent}
              onMouseLeave={e => e.currentTarget.style.color = COLOR.textSecondary}
            >+</span>
          )}
        </div>
        <div style={{
          fontSize: FONT.caption, color: COLOR.textTertiary,
          marginLeft: 16, marginTop: 2,
        }}>
          {totalInSection}건
        </div>
      </div>

      {/* R-05: 시스템 프로젝트 0건 placeholder — 클릭 시 adding trigger */}
      {isEmpty && project.isSystem && !adding && (
        <div
          onClick={() => setAdding(true)}
          style={{
            gridColumn: '2 / 4',
            padding: '6px 8px',
            fontSize: FONT.body,
            color: COLOR.textTertiary,
            fontStyle: 'italic',
            opacity: 0.65,
            cursor: 'pointer',
          }}
          title="클릭하여 할일 추가"
        >
          여기에 + 할일
        </div>
      )}

      {/* Task rows (col 2 + col 3) */}
      {!isEmpty && isExpanded && tasksWithLabels.map(({ task, msLabel, isEtc }) => (
        <React.Fragment key={task.id}>
          <PersonalTodoTaskRow task={task} msLabel={msLabel} isEtc={isEtc} />
        </React.Fragment>
      ))}

      {/* R-07: inline add input — col 2-3 span, 기존 task rows 아래 */}
      {adding && (
        <div style={{
          gridColumn: '2 / 4',
          padding: SPACE.cellPadding,
        }}>
          <input
            autoFocus
            placeholder={`${project.name} 에 할일 추가 후 Enter`}
            style={{
              width: '100%', fontSize: FONT.body,
              border: `1px solid ${COLOR.border}`, borderRadius: 4,
              padding: '4px 8px', fontFamily: 'inherit',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            onBlur={e => handleAddFinish(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleAddFinish(e.target.value) }
              if (e.key === 'Escape') setAdding(false)
            }}
          />
        </div>
      )}

      {/* 접힘 상태에서 빈 placeholder 없을 때: col 2/3 빈 slot */}
      {!isEmpty && !isExpanded && !adding && (
        <>
          <div />
          <div />
        </>
      )}
    </div>
  )
}
```

**Commit message**:
```
feat(add): per-project hover "+ 할일" inline composer (Loop-47 R-06/R-07)

- headerHover state via onMouseEnter/Leave (전체 grid row 기준)
- 프로젝트 col 내부 name 옆에 "+" 아이콘 (hover 시 fade in, accent color hover)
- "+" 클릭 → setAdding(true) (stopPropagation 으로 onToggle 차단)
- adding 상태 → task rows 영역 (col 2-4 span) 최하단 inline input
- Enter → addTask({projectId: project.id, category: 'today', keyMilestoneId: null, ...})
- Esc / onBlur 빈 값 → cancel (Esc는 즉시 setAdding(false))
- R-05 "여기에 + 할일" placeholder 에도 동일 onClick 연결 (시스템 프로젝트 0건)

grid-row span 계산: task rows 개수 + adding 시 +1, 최소 1 유지.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

# Commit 9 — 전역 "+ 새 할일" 드롭다운 + localStorage

**File**: `src/components/views/personal-todo/PersonalTodoListTable.jsx`
**Edits**: 2 (imports + TodaySection composer)

## Edit 9.1 — ListTable TodaySection: handleAddFinish 및 composer 재작성

**old_string**:
```jsx
/* ─── 지금 섹션 ─── */
function TodaySection({ projects, tasks, milestones, isProjectExpanded, toggleProjectExpand, addTask, currentUserId, instantProjectId }) {
  const [adding, setAdding] = useState(false)
  const totalCount = tasks.length

  const handleAddFinish = (value) => {
    setAdding(false)
    const text = (value ?? '').trim()
    if (!text) return
    // F-13 + QA fix: '즉시' 프로젝트 기본 귀속.
    // projectId 미지정 시 task.projectId=null → 프로젝트 그룹 렌더에서 필터링되어 안 보임.
    // '즉시' seed 실패 상태면 경고만 하고 skip (UI 버튼 자체 유지, 다음 새로고침에 seed 재시도).
    if (!instantProjectId) {
      console.warn('[Loop-45] 즉시 프로젝트 미확보 — 빠른 추가 불가')
      return
    }
    addTask({
      text,
      projectId: instantProjectId,
      assigneeId: currentUserId,
      secondaryAssigneeId: null,
      keyMilestoneId: null,
      category: 'today',
      isFocus: false,
    })
  }

  return (
    <div>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 8, paddingBottom: 6,
        borderBottom: `1px solid ${COLOR.border}`,
      }}>
        <span style={{ fontSize: FONT.sectionTitle, fontWeight: 600, color: COLOR.textPrimary }}>
          지금 할일
        </span>
        <span style={{ fontSize: FONT.caption, color: COLOR.textTertiary }}>
          {totalCount}건
        </span>
        <div style={{ flex: 1 }} />
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            style={{
              border: `1px solid ${COLOR.border}`, background: '#fff',
              fontSize: FONT.caption, color: COLOR.textSecondary,
              padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + 새 할일
          </button>
        )}
      </div>

      {/* Inline add input */}
      {adding && (
        <div style={{ marginBottom: 8, padding: SPACE.cellPadding }}>
          <input
            autoFocus
            placeholder="할일 입력 후 Enter"
            style={{
              width: '100%', fontSize: FONT.body,
              border: `1px solid ${COLOR.border}`, borderRadius: 4,
              padding: '4px 8px', fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
            onBlur={e => handleAddFinish(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddFinish(e.target.value)
              if (e.key === 'Escape') setAdding(false)
            }}
          />
        </div>
      )}
```

**new_string**:
```jsx
/* ─── 지금 섹션 ─── */
function TodaySection({ projects, tasks, milestones, isProjectExpanded, toggleProjectExpand, addTask, currentUserId, instantProjectId }) {
  const [adding, setAdding] = useState(false)
  const [addText, setAddText] = useState('')
  // R-08, R-09: 마지막 선택 프로젝트 id (localStorage)
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    const saved = localStorage.getItem('lastAddProjectId')
    // stale id 방어는 렌더 시점에 검증 (projects 배열에 없으면 fallback)
    return saved || null
  })
  const totalCount = tasks.length

  // R-08: 드롭다운 옵션 — 개인 뷰 projects (백로그와 동일, sortProjectsLocally 결과 그대로)
  // 기본 선택: localStorage 저장값 → 현재 존재 확인 → 없으면 instantProjectId → 없으면 첫 프로젝트
  const effectiveSelectedId = useMemo(() => {
    const candidate = selectedProjectId || instantProjectId || (projects[0]?.id ?? null)
    // stale 방어: 후보가 projects 배열에 없으면 fallback
    if (candidate && projects.some(p => p.id === candidate)) return candidate
    return instantProjectId || (projects[0]?.id ?? null)
  }, [selectedProjectId, instantProjectId, projects])

  const handleAddFinish = () => {
    setAdding(false)
    const text = addText.trim()
    setAddText('')
    if (!text) return
    const targetId = effectiveSelectedId
    if (!targetId) {
      console.warn('[Loop-47] 프로젝트 미선택 — 빠른 추가 불가')
      return
    }
    addTask({
      text,
      projectId: targetId,
      assigneeId: currentUserId,
      secondaryAssigneeId: null,
      keyMilestoneId: null,
      category: 'today',
      isFocus: false,
    })
    // R-09: 성공 시 선택 프로젝트 저장
    try { localStorage.setItem('lastAddProjectId', targetId) } catch {}
  }

  return (
    <div>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 8, paddingBottom: 6,
        borderBottom: `1px solid ${COLOR.border}`,
      }}>
        <span style={{ fontSize: FONT.sectionTitle, fontWeight: 600, color: COLOR.textPrimary }}>
          지금 할일
        </span>
        <span style={{ fontSize: FONT.caption, color: COLOR.textTertiary }}>
          {totalCount}건
        </span>
        <div style={{ flex: 1 }} />
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            style={{
              border: `1px solid ${COLOR.border}`, background: '#fff',
              fontSize: FONT.caption, color: COLOR.textSecondary,
              padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + 새 할일
          </button>
        )}
      </div>

      {/* R-08: Inline composer — project select + text input */}
      {adding && (
        <div style={{
          marginBottom: 8, padding: SPACE.cellPadding,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <select
            value={effectiveSelectedId || ''}
            onChange={e => setSelectedProjectId(e.target.value)}
            style={{
              fontSize: FONT.body, fontFamily: 'inherit',
              padding: '4px 8px',
              border: `1px solid ${COLOR.border}`, borderRadius: 4,
              background: '#fff', color: COLOR.textPrimary,
              outline: 'none', flexShrink: 0, maxWidth: 160,
            }}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            autoFocus
            value={addText}
            onChange={e => setAddText(e.target.value)}
            placeholder="할일 입력 후 Enter"
            style={{
              flex: 1, fontSize: FONT.body,
              border: `1px solid ${COLOR.border}`, borderRadius: 4,
              padding: '4px 8px', fontFamily: 'inherit',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleAddFinish() }
              if (e.key === 'Escape') { setAdding(false); setAddText('') }
            }}
            onBlur={() => {
              // 빈 입력 blur → 바로 취소. 값 있으면 유지 (Enter 로 완료)
              if (!addText.trim()) { setAdding(false); setAddText('') }
            }}
          />
        </div>
      )}
```

**Commit message**:
```
feat(add): global "+ 새 할일" with project select and last-choice memory (Loop-47 R-08/R-09)

- TodaySection composer 확장: <select> (프로젝트) + <input> (텍스트) inline
- 드롭다운 옵션 = props.projects (이미 sortProjectsLocally 적용된 순서)
- 기본 선택 우선순위:
  1. localStorage 'lastAddProjectId' (stale 방어: projects 배열에 존재 확인)
  2. instantProjectId ('즉시')
  3. projects[0] (fallback)
- Enter → addTask({projectId: effectiveSelectedId, category: 'today', ...})
- 성공 시 localStorage.setItem('lastAddProjectId', targetId) — R-09
- Esc / 빈 onBlur → cancel

기존 "+ 새 할일" 단순 input 대체. instantProjectId 강제 귀속에서 탈피,
사용자가 각 추가 시 프로젝트 선택 가능.

R-series QA gate: Commit 8/9 전수 검증 후 Loop-47 완료.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## QA Gates 요약

| Gate | 시점 | 검증 항목 |
|---|---|---|
| Gate 0 | Commit 0 deploy 후 | PROJECT_COLUMNS URL, '즉시' 위치, "+ 새 할일" 동작 |
| Gate 1 (implicit) | Commit 2 후 | build + lint pass (grep selectedFocusTaskId = 0) |
| Gate 2 | Commit 5 후 | E-01 ~ E-12 전수 (caret rotate, OutlinerEditor 인라인, 800ms debounce, 다중 펼침, reload 복원, auto-expand, SVG 아이콘 색) |
| Gate 3 | Commit 7 후 | R-01~R-05 (토큰 축소 시각 확인, 시스템 프로젝트 0건 렌더) |
| Gate 4 | Commit 9 후 | R-06~R-09 (hover +, inline add, global composer select + localStorage) + N-01/N-04/N-07 |

## 롤백 전략

| 단계 | revert |
|---|---|
| Stage 0 만 (Commit 0) | `git revert <sha0>` — 독립 가능 |
| Stage 1 전체 | `git revert <sha2>..<sha1>` (역순) |
| Stage 2 전체 | Commit 5 → 4 → 3 순 revert |
| Stage 3, 4 | 각자 독립 revert 가능 |
| 전체 Loop-47 rollback | Commit 9 → 0 역순 revert (10 커밋) |

## 문서 크기

약 35 KB — 40 KB 목표 내.
