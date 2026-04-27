# Diff-Plan — Loop-46: 포커스 노트 패널 (3-pane 확장)

> **상위 입력**: [spec-focus-note-panel.md](spec-focus-note-panel.md) (확정)
> **커밋 범위**: Commits 1~7 (전체 Loop-46)
> **Stage 0 검증 완료**: `tasks.notes | text` (Supabase 확인)
> **QA 체크포인트**: Commit 6 (3-pane wired). 전수 QA 통과 후 Commit 7 진행.

---

## 커밋 시퀀스 요약

| # | 파일 | 변경 규모 | 빌드/상태 |
|---|---|---|---|
| 1 | `src/utils/notes.js` | +5 lines (isEmptyNotes export) | ✅ (미사용) |
| 2 | `src/hooks/useStore.js` | +15 lines (field + action + localStorage) | ✅ |
| 3 | `src/components/views/personal-todo/cells/FocusCard.jsx` | outer onClick + SVG 아이콘 추가, 텍스트 onClick 교체 | ✅ (아이콘+선택만, 패널 미연결) |
| 4 | `FocusQuickAddInput.jsx` + `PersonalTodoShell.jsx` handleDragEnd | +3 lines 각 | ✅ (자동 선택 트리거) |
| 5 | `src/components/views/personal-todo/FocusNotePanel.jsx` (신규) | ~140 lines | ✅ (미연결) |
| 6 | `src/components/views/personal-todo/PersonalTodoShell.jsx` | flex → grid, FocusNotePanel wire, gap 24→20 | ✅ **QA 체크포인트** |
| 7 | `src/components/views/personal-todo/PersonalTodoShell.jsx` | isWide state + resize listener + 조건부 3rd column | ✅ 완료 |

**각 커밋 후 `npm run build` + 신규 파일 `npx eslint` 통과 필수**.

---

# Commit 1 — `isEmptyNotes` 유틸 신설

**파일**: `src/utils/notes.js`
**변경**: export 1개 추가 (파일 끝)

## Edit 1.1

**old_string**:
```js
export function serializeNotes(nodes) {
  return nodes.filter(n => n.text.trim()).map(n => '\t'.repeat(n.level) + n.text).join('\n')
}
```

**new_string**:
```js
export function serializeNotes(nodes) {
  return nodes.filter(n => n.text.trim()).map(n => '\t'.repeat(n.level) + n.text).join('\n')
}

// Loop-46: 빈 노트 판별 — FocusCard 아이콘 색 분기 등에 재사용
export function isEmptyNotes(notes) {
  return !notes || !notes.trim()
}
```

**커밋 메시지**:
```
feat(utils): isEmptyNotes 유틸 추가 (Loop-46)

- FocusCard 노트 아이콘 색 분기 (#2383e2 vs #d3d1c7) 등에서 재사용
- 기존 notes.js의 parseNotes/serializeNotes와 동일한 plain text (tab-indent) 전제
- 관용구 `!notes || !notes.trim()` 를 1곳으로 통일

Loop-46 Commit 1/7
```

---

# Commit 2 — Store: `selectedFocusTaskId` 필드 + setter + localStorage

**파일**: `src/hooks/useStore.js`
**블록**: 2개 Edit

## Edit 2.1 — 필드 초기화 (currentTeamId 아래)

**old_string** (L1567-L1574 추정 — `// ─── Team State (Loop-19) ───` 블록):
```js
  // ─── Team State (Loop-19) ───
  currentTeamId: localStorage.getItem('currentTeamId') || null,
  myTeams: [],
  myRole: null, // 'owner' | 'member' | null
  teamLoading: true,
  onboardingSkipped: JSON.parse(localStorage.getItem('onboardingSkipped') || 'false'),
```

**new_string**:
```js
  // ─── Team State (Loop-19) ───
  currentTeamId: localStorage.getItem('currentTeamId') || null,
  myTeams: [],
  myRole: null, // 'owner' | 'member' | null
  teamLoading: true,
  onboardingSkipped: JSON.parse(localStorage.getItem('onboardingSkipped') || 'false'),

  // ─── Focus selection (Loop-46) ───
  // 포커스 카드 중 선택된 것 (FocusNotePanel이 해당 task의 notes 렌더).
  // reload 복원: localStorage. stale(선택 task가 unfocus/done/deleted 된 경우) 방어는
  // FocusNotePanel 렌더 시점의 tasks.find 재검증 (spec F-40).
  selectedFocusTaskId: localStorage.getItem('selectedFocusTaskId') || null,
```

## Edit 2.2 — setter 액션 (적절한 위치에 추가, setTeam 직전 권장)

**old_string** (L1576 근처 `setTeam` action 시작):
```js
  setTeam: async (teamId) => {
```

**new_string**:
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

**⚠ 주의**: Q5 결정 — `setTeam` 에서 `selectedFocusTaskId` clear 안 함 (R5 closed). FocusPanel filter가 user-scoped이고 F-40 stale 방어로 충분.

**커밋 메시지**:
```
feat(store): selectedFocusTaskId 필드 + setter + localStorage 복원 (Loop-46)

- 포커스 카드 선택 상태 store 전역 관리 (FocusNotePanel 구독용)
- currentTeamId (L1568) 패턴 복제 — 초기값 localStorage에서 로드
- setSelectedFocusTaskId 액션: setState + localStorage 동시 기록
- try/catch: quota / private 모드 무시

F-40: reload 복원 지원.
Q5 결정: setTeam 시 clear 안 함 (user-scoped 필터 + stale 방어로 충분).

Loop-46 Commit 2/7
```

---

# Commit 3 — FocusCard: 노트 아이콘 + 카드 클릭 시 선택

**파일**: `src/components/views/personal-todo/cells/FocusCard.jsx`
**블록**: 3개 Edit

## Edit 3.1 — imports 확장

**old_string**:
```js
import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../../../../hooks/useStore'
import { COLOR, FONT, CHECKBOX, SPACE } from '../../../../styles/designTokens'
```

**new_string**:
```js
import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../../../../hooks/useStore'
import { COLOR, FONT, CHECKBOX, SPACE } from '../../../../styles/designTokens'
import { isEmptyNotes } from '../../../../utils/notes'
```

## Edit 3.2 — 훅 추가 + 외부 div onClick (outer div)

**old_string**:
```js
export default function FocusCard({ task, project, milestone }) {
  const toggleDone = useStore(s => s.toggleDone)
  const updateTask = useStore(s => s.updateTask)
  const openDetail = useStore(s => s.openDetail)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `focus-card:${task.id}`,
  })

  const [hover, setHover] = useState(false)
```

**new_string**:
```js
export default function FocusCard({ task, project, milestone }) {
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

## Edit 3.3 — outer div에 onClick + selected 스타일

**old_string**:
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

**new_string**:
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

## Edit 3.4 — 텍스트의 openDetail 제거 (F-35 옵션 A)

**old_string**:
```jsx
      {/* Text + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          onClick={() => openDetail(task)}
          style={{
            fontSize: FONT.body,
            color: task.done ? COLOR.textTertiary : COLOR.textPrimary,
            textDecoration: task.done ? 'line-through' : 'none',
            lineHeight: 1.4, cursor: 'pointer',
            wordBreak: 'break-word',
          }}
        >
          {task.text}
        </div>
```

**new_string**:
```jsx
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
```

**주의**: outer div의 onClick이 카드 전체 클릭 = 선택 처리. 이 텍스트 div는 더 이상 독립 onClick 불필요. 클릭 이벤트는 outer로 bubble.

**❗ 현재 import `openDetail`이 unused 됨** — 다음 Edit에서 처리:

## Edit 3.5 — openDetail import 제거 (unused)

**old_string**:
```js
  const toggleDone = useStore(s => s.toggleDone)
  const updateTask = useStore(s => s.updateTask)
  const setSelectedFocusTaskId = useStore(s => s.setSelectedFocusTaskId)
  const selectedFocusTaskId = useStore(s => s.selectedFocusTaskId)
```

**new_string**: (동일, openDetail line 이미 3.2에서 제거됨 — 이 edit은 no-op 확인용)

Edit 3.2에서 이미 `openDetail` 라인을 제거했으므로 추가 edit 불필요. **3.2 재확인**: 기존 코드 `const openDetail = useStore(s => s.openDetail)` 를 **제거**하고 `setSelectedFocusTaskId`/`selectedFocusTaskId` 선언으로 교체하는 것이 맞음.

→ Edit 3.2 new_string에서 `const openDetail = useStore(s => s.openDetail)` 라인 삭제됨 (위 new_string 확인).

## Edit 3.6 — 메타 줄 끝에 SVG 노트 아이콘 추가

**old_string**:
```jsx
        {(projectLabel || milestone?.title) && (
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
          </div>
        )}
```

**new_string**:
```jsx
        {(projectLabel || milestone?.title || true) && (
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
            {/* F-37: 노트 아이콘 (hasNotes → #2383e2, 없음 → #d3d1c7) */}
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
        )}
```

**주의**: `(projectLabel || milestone?.title || true)` 로 변경 — 이제 노트 아이콘이 항상 표시되므로 조건 제거. 실제로는 `true` 하드코딩 대신 조건 전체 제거가 깔끔:

**Edit 3.6 대안 (권장)**:
```jsx
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
          {/* F-37: 노트 아이콘 */}
          <svg ... />
        </div>
```

(대괄호 `{(... && ...)` 조건 전체 삭제, 메타 줄은 항상 렌더. 아이콘이 유일한 필수 요소)

**커밋 메시지**:
```
feat(cells): FocusCard 노트 SVG 아이콘 + 카드 클릭 시 선택 (Loop-46)

- Outer div onClick → setSelectedFocusTaskId(task.id) (F-35 옵션 A)
- 선택 시 border 색을 COLOR.accent (파란색) 로 강조
- 텍스트의 openDetail 호출 제거 (카드 선택이 주 액션; DetailPanel 진입은
  FocusNotePanel 헤더 클릭 경로로 이관 — F-42, Commit 5에서 구현)
- 메타 줄 끝에 SVG 노트 아이콘 (spacer + 24x24 viewBox):
  · hasNotes → COLOR.accent (#2383e2)
  · 빈 노트 → #d3d1c7
- 이모지 📝 미사용 (환경별 렌더 차이 회피, N-13 준수)

Loop-46 Commit 3/7
```

---

# Commit 4 — 자동 선택 (FocusQuickAddInput + Shell handleDragEnd)

**블록**: 2개 파일 수정

## Edit 4.1 — `FocusQuickAddInput.jsx`

**old_string** (L1-L14 영역):
```js
import { useState } from 'react'
import useStore from '../../../../hooks/useStore'
import { COLOR, FONT } from '../../../../styles/designTokens'
```

**new_string**:
```js
import { useState } from 'react'
import useStore from '../../../../hooks/useStore'
import { COLOR, FONT } from '../../../../styles/designTokens'
```

(imports 동일, 변경 없음 — `useStore` 이미 import됨)

## Edit 4.2 — `handleAdd` 를 async로 + setter 연결

**old_string**:
```js
export default function FocusQuickAddInput({ instantProjectId, currentUserId }) {
  const addTask = useStore(s => s.addTask)
  const [value, setValue] = useState('')

  const handleAdd = () => {
    const text = value.trim()
    if (!text) return
    if (!instantProjectId) {
      // '즉시' 프로젝트 seed 실패 상태 — 호출 skip.
      // Stage 3에서 Shell이 seed 재시도 or 사용자 안내.
      return
    }
    addTask({
      text,
      projectId: instantProjectId,
      assigneeId: currentUserId,
      secondaryAssigneeId: null,
      keyMilestoneId: null,
      category: 'today',
      isFocus: true,
    })
    setValue('')
  }
```

**new_string**:
```js
export default function FocusQuickAddInput({ instantProjectId, currentUserId }) {
  const addTask = useStore(s => s.addTask)
  const setSelectedFocusTaskId = useStore(s => s.setSelectedFocusTaskId)
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
    // F-36: 생성 직후 자동 active 선택
    if (t?.id) setSelectedFocusTaskId(t.id)
    setValue('')
  }
```

## Edit 4.3 — Shell `handleDragEnd` 백로그→포커스 케이스

**파일**: `PersonalTodoShell.jsx`

**old_string** (store 구독 영역):
```js
  const updateTask = useStore(s => s.updateTask)
  const reorderFocusTasks = useStore(s => s.reorderFocusTasks)
```

**new_string**:
```js
  const updateTask = useStore(s => s.updateTask)
  const reorderFocusTasks = useStore(s => s.reorderFocusTasks)
  const setSelectedFocusTaskId = useStore(s => s.setSelectedFocusTaskId)
```

## Edit 4.4 — case 1 (bl-task → focus) 에 auto-select

**old_string**:
```js
    // ═══ 1) 백로그 → 포커스 패널 (F-23) ═══
    if (activeIdStr.startsWith('bl-task:')) {
      if (overId === 'focus-panel:root' || overId.startsWith('focus-card:')) {
        const taskId = activeIdStr.slice('bl-task:'.length)
        const maxOrder = focusTasks.reduce(
          (m, t) => Math.max(m, t.focusSortOrder ?? 0),
          0,
        )
        updateTask(taskId, { isFocus: true, focusSortOrder: maxOrder + 1 })
        return
      }
      return
    }
```

**new_string**:
```js
    // ═══ 1) 백로그 → 포커스 패널 (F-23) ═══
    if (activeIdStr.startsWith('bl-task:')) {
      if (overId === 'focus-panel:root' || overId.startsWith('focus-card:')) {
        const taskId = activeIdStr.slice('bl-task:'.length)
        const maxOrder = focusTasks.reduce(
          (m, t) => Math.max(m, t.focusSortOrder ?? 0),
          0,
        )
        updateTask(taskId, { isFocus: true, focusSortOrder: maxOrder + 1 })
        // F-36: 드롭 직후 자동 active 선택
        setSelectedFocusTaskId(taskId)
        return
      }
      return
    }
```

## Edit 4.5 — `handleDragEnd` useCallback deps 갱신

**old_string**:
```js
  }, [focusTasks, updateTask, reorderFocusTasks])
```

**new_string**:
```js
  }, [focusTasks, updateTask, reorderFocusTasks, setSelectedFocusTaskId])
```

**커밋 메시지**:
```
feat(cells): 자동 active 선택 — QuickAdd + DragEnd (Loop-46)

F-36 대응:
- FocusQuickAddInput.handleAdd: async 화, addTask 반환값(t)의 id를
  setSelectedFocusTaskId 로 연결 → Enter 직후 노트 패널이 새 task 로 전환
- PersonalTodoShell.handleDragEnd 백로그→포커스 케이스: updateTask 직후
  setSelectedFocusTaskId(taskId) → 드롭 직후 노트 패널이 드롭된 task 로 전환
- useCallback dependency array에 setSelectedFocusTaskId 추가

FocusNotePanel 은 아직 미구현 — 이 커밋에서는 store 필드만 업데이트.
다음 Commit 5에서 FocusNotePanel 구현, Commit 6에서 wire.

Loop-46 Commit 4/7
```

---

# Commit 5 — FocusNotePanel 신규 파일

**파일 (신규)**: `src/components/views/personal-todo/FocusNotePanel.jsx`

## 전체 내용

```jsx
import { useMemo, useRef, useCallback, useState } from 'react'
import useStore from '../../../hooks/useStore'
import { COLOR, FONT, SPACE } from '../../../styles/designTokens'
import { getColor } from '../../../utils/colors'
import OutlinerEditor from '../../shared/OutlinerEditor'

/* ═══════════════════════════════════════════════
   FocusNotePanel (Loop-46)
   3번째 pane — 선택된 포커스 카드의 notes 편집

   - selectedFocusTaskId 구독 (store)
   - stale 방어: tasks.find(... && isFocus && !done && !deletedAt) 재검증
   - 헤더 task 제목 클릭 → openDetail (F-42)
   - DetailPanel L71-L81 debounce 800ms + optimistic update 패턴 복제 (F-38)
   - OutlinerEditor 수정 금지 — props만 연결 (N-13)
   ═══════════════════════════════════════════════ */
export default function FocusNotePanel({ tasks, projects }) {
  const selectedFocusTaskId = useStore(s => s.selectedFocusTaskId)
  const updateTask = useStore(s => s.updateTask)
  const openDetail = useStore(s => s.openDetail)

  const [titleHover, setTitleHover] = useState(false)
  const debounceRef = useRef(null)

  // F-40 stale 방어: 선택된 task가 여전히 유효한지 확인
  const selectedTask = useMemo(() => {
    if (!selectedFocusTaskId) return null
    return tasks.find(t =>
      t.id === selectedFocusTaskId &&
      t.isFocus === true &&
      !t.done &&
      !t.deletedAt
    ) || null
  }, [tasks, selectedFocusTaskId])

  const project = useMemo(() => {
    if (!selectedTask) return null
    return projects.find(p => p.id === selectedTask.projectId) || null
  }, [projects, selectedTask])

  const accentColor = useMemo(() => {
    if (project?.isSystem) return '#888780'
    return project ? getColor(project.color).dot : '#bbb'
  }, [project])

  // DetailPanel L71-L81 패턴 복제 (F-38)
  const handleNotesChange = useCallback((newNotes) => {
    if (!selectedTask) return
    const tid = selectedTask.id
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateTask(tid, { notes: newNotes })
    }, 800)
    // Optimistic local update
    useStore.setState(s => ({
      tasks: s.tasks.map(t => t.id === tid ? { ...t, notes: newNotes } : t)
    }))
  }, [selectedTask, updateTask])

  // F-39: empty state
  if (!selectedTask) {
    return (
      <div style={{
        position: 'sticky', top: 0, alignSelf: 'flex-start',
        padding: SPACE.cellPadding, minHeight: 200,
        borderLeft: `1px solid ${COLOR.border}`,
      }}>
        <div style={{
          padding: '40px 16px', textAlign: 'center',
          color: COLOR.textTertiary, fontSize: FONT.body,
          lineHeight: 1.6,
        }}>
          포커스 카드를 선택하면<br />노트가 여기에 표시됩니다
        </div>
      </div>
    )
  }

  // F-22 재활용: system project → "프로젝트 미지정"
  const projectLabel = project?.isSystem ? '프로젝트 미지정' : (project?.name || '')

  return (
    <div style={{
      position: 'sticky', top: 0, alignSelf: 'flex-start',
      padding: SPACE.cellPadding, minHeight: 200,
      borderLeft: `1px solid ${COLOR.border}`,
    }}>
      {/* Header — 제목 클릭 시 DetailPanel (F-42) */}
      <button
        onClick={() => openDetail(selectedTask)}
        onMouseEnter={() => setTitleHover(true)}
        onMouseLeave={() => setTitleHover(false)}
        style={{
          display: 'block', width: '100%', textAlign: 'left',
          background: 'transparent', border: 'none',
          padding: '8px 4px', marginBottom: 10,
          borderBottom: `1px solid ${COLOR.border}`,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
        title="클릭하여 상세 보기"
      >
        <div style={{
          fontSize: FONT.sectionTitle, fontWeight: 600,
          color: COLOR.textPrimary, lineHeight: 1.3,
          wordBreak: 'break-word',
          textDecoration: titleHover ? 'underline' : 'none',
        }}>
          {selectedTask.text}
        </div>
        {projectLabel && (
          <div style={{
            fontSize: FONT.caption, color: COLOR.textTertiary,
            marginTop: 4,
            fontStyle: project?.isSystem ? 'italic' : 'normal',
          }}>
            {projectLabel}
          </div>
        )}
      </button>

      {/* Notes editor (OutlinerEditor 수정 금지, props만 연결 — N-13) */}
      <OutlinerEditor
        notes={selectedTask.notes}
        onChange={handleNotesChange}
        accentColor={accentColor}
      />
    </div>
  )
}
```

**커밋 메시지**:
```
feat(panel): FocusNotePanel 신규 (Loop-46 Commit 5/7)

- selectedFocusTaskId store 구독 → 해당 task 의 notes 를 OutlinerEditor 로 렌더
- stale 방어: tasks.find(... && isFocus && !done && !deletedAt) 재검증 (F-40)
- 헤더 task 제목 버튼: 클릭 → openDetail(selectedTask). hover 시 underline (F-42)
- 노트 변경: DetailPanel L71-L81 패턴 복제 — 800ms debounce + 즉시 optimistic setState (F-38)
- Empty state: selectedTask === null → "포커스 카드를 선택하면..." (F-39)
- sticky position, borderLeft — FocusPanel 동일 스타일로 3-section 시각 구분
- accentColor: project.isSystem → #888780, 일반은 getColor(project.color).dot
- OutlinerEditor 수정 없음 (N-13) — props API 그대로 사용

미연결 상태 — Commit 6 에서 Shell 이 wire.
```

---

# Commit 6 — Shell: flex → grid + FocusNotePanel wire (⚠ QA 체크포인트)

**파일**: `src/components/views/personal-todo/PersonalTodoShell.jsx`
**블록**: 3개 Edit

## Edit 6.1 — import 추가

**old_string**:
```js
import PersonalTodoListTable from './PersonalTodoListTable'
import FocusPanel from './FocusPanel'
```

**new_string**:
```js
import PersonalTodoListTable from './PersonalTodoListTable'
import FocusPanel from './FocusPanel'
import FocusNotePanel from './FocusNotePanel'
```

## Edit 6.2 — 주석 설명 업데이트

**old_string**:
```js
/* ═══════════════════════════════════════════════
   PersonalTodoShell (Loop-45)
   2컬럼 오케스트레이터 — 좌측 백로그 (flex 3) + 우측 포커스 패널 (flex 2)

   자체 DndContext (nested inside UnifiedGridView의 outer context).
   @dnd-kit은 useSortable/useDroppable이 nearest DndContext로 register되므로,
   Shell 내부 드래그(bl-task:*, focus-card:*)는 outer와 완전 격리.

   DnD 시나리오 (spec §8.3):
     1) 백로그 task → 포커스 패널 (focus-panel:root 또는 focus-card:*) (F-23)
        → updateTask(id, { isFocus: true, focusSortOrder: max+1 })
     2) 포커스 카드 간 reorder (F-25)
        → reorderFocusTasks(reordered)
     3) 포커스 카드 → 패널 밖 drop (F-24)
        → updateTask(id, { isFocus: false }) — category 보존 (N-09)
   ═══════════════════════════════════════════════ */
```

**new_string**:
```js
/* ═══════════════════════════════════════════════
   PersonalTodoShell (Loop-45 → Loop-46)
   3컬럼 오케스트레이터 (grid) — 백로그 : 포커스 : 노트 = 1.5fr : 0.9fr : 1.2fr
   Loop-46 Commit 6: flex → grid 전환, FocusNotePanel wire.

   자체 DndContext (nested inside UnifiedGridView의 outer context).
   @dnd-kit은 useSortable/useDroppable이 nearest DndContext로 register되므로,
   Shell 내부 드래그(bl-task:*, focus-card:*)는 outer와 완전 격리.

   DnD 시나리오:
     1) 백로그 task → 포커스 패널 (focus-panel:root 또는 focus-card:*) (F-23)
        → updateTask(id, { isFocus: true, focusSortOrder: max+1 })
        + setSelectedFocusTaskId(taskId) (F-36)
     2) 포커스 카드 간 reorder (F-25) → reorderFocusTasks(reordered)
     3) focus-card → 패널 밖 drop: no-op (× 버튼만 해제)

   ⚠ Commit 6 범위: 3컬럼 grid always — resize 반응형은 Commit 7에서 추가.
   ═══════════════════════════════════════════════ */
```

## Edit 6.3 — 렌더 구간 flex → grid + 3rd column

**old_string**:
```jsx
      <div style={{
        display: 'flex',
        gap: 24,
        width: '100%',
        // alignItems 기본값(stretch)으로 우측 column이 container 높이만큼 stretch
        // → focus-panel:root droppable이 우측 전체 영역 커버
      }}>
        {/* Left: 백로그 3섹션 (flex 3) */}
        <div style={{ flex: 3, minWidth: 0 }}>
          <PersonalTodoListTable
            projects={projects}
            tasks={tasks}
            milestones={milestones}
          />
        </div>

        {/* Right: 포커스 드롭존 + 패널 (flex 2, 영역 전체가 drop target) */}
        <div
          ref={focusDropRef}
          style={{
            flex: 2,
            minWidth: 280,
            background: focusIsOver ? COLOR.bgHover : 'transparent',
            transition: 'background 0.15s',
            borderRadius: 6,
          }}
        >
          <FocusPanel
            projects={projects}
            tasks={tasks}
            milestones={milestones}
          />
        </div>
      </div>
```

**new_string**:
```jsx
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(450px, 1.5fr) minmax(240px, 0.9fr) minmax(320px, 1.2fr)',
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

        {/* Column 2: 포커스 드롭존 + 패널 (영역 전체가 drop target) */}
        <div
          ref={focusDropRef}
          style={{
            minWidth: 0,
            background: focusIsOver ? COLOR.bgHover : 'transparent',
            transition: 'background 0.15s',
            borderRadius: 6,
          }}
        >
          <FocusPanel
            projects={projects}
            tasks={tasks}
            milestones={milestones}
          />
        </div>

        {/* Column 3: 포커스 노트 패널 (Loop-46) */}
        <div style={{ minWidth: 0 }}>
          <FocusNotePanel
            tasks={tasks}
            projects={projects}
          />
        </div>
      </div>
```

**커밋 메시지**:
```
feat(shell): 3-pane grid 전환 + FocusNotePanel wire (Loop-46 Commit 6/7)

- display: flex → grid
- grid-template-columns: minmax(450px, 1.5fr) minmax(240px, 0.9fr) minmax(320px, 1.2fr)
  · 각 pane 최소 폭 보장 (recon F2: 백로그 ProjectGroup 170+130=300 + task text 150)
- gap: 24 → 20 (3-column 총 40px 여백)
- FocusNotePanel 3번째 컬럼에 마운트 (F-34)
- resize 반응형은 Commit 7에서 추가 — 현재는 3컬럼 always
- 주석 업데이트 (Loop-45 → Loop-46)

⚠ QA 체크포인트 — spec §9.1~9.5 전수 검증 필요.
통과 시 Commit 7 (뷰포트 <1080px 2-pane fallback) 진행.
```

---

## ⚠ Commit 6 이후 QA (Ryan 수동, spec §9.1~9.5)

### 9.1 3-pane 레이아웃
- [ ] F-34: DevTools Shell div → `grid-template-columns: minmax(450px, 1.5fr) minmax(240px, 0.9fr) minmax(320px, 1.2fr)`
- [ ] F-34: 실제 렌더 폭 대략 1.5 : 0.9 : 1.2 비율

### 9.2 선택 로직
- [ ] F-35: FocusCard 클릭 → 노트 패널 해당 task 렌더. DetailPanel 열리지 **않음**
- [ ] F-36: QuickAdd Enter → 새 카드 생성 + 노트 패널 자동 전환
- [ ] F-36: 백로그 → 포커스 드롭 → 노트 패널 자동 전환
- [ ] F-40: 선택 후 reload → 이전 선택 복원
- [ ] F-40 stale: 선택 후 × 버튼 해제 → reload → empty state
- [ ] F-42: 노트 패널 헤더 제목 클릭 → DetailPanel 오픈, hover 시 underline

### 9.3 동기화
- [ ] F-38: 노트 패널 편집 + DetailPanel 열기 → 800ms 내 반영
- [ ] F-38 optimistic: 타이핑 시 즉각 UI 반영 (디바운스는 DB 저장만)

### 9.4 아이콘 + 빈 상태
- [ ] F-37: 빈 notes task 카드 → 아이콘 `#d3d1c7`
- [ ] F-37: notes 있는 task → 아이콘 `#2383e2` (accent)
- [ ] F-37: DevTools → `<svg>` 태그 확인, 이모지 0
- [ ] F-39: 포커스 0건 or 선택 없음 → "포커스 카드를 선택하면..."

### 9.5 비기능
- [ ] N-13: `git diff src/components/shared/OutlinerEditor.jsx` → 빈 diff
- [ ] N-14: 양쪽 동시 편집 시 최근 타이핑 최종 반영 (관용)

---

# Commit 7 — 뷰포트 <1080px 2-pane fallback

**파일**: `src/components/views/personal-todo/PersonalTodoShell.jsx`
**블록**: 3개 Edit

## Edit 7.1 — React hooks import 확장

**old_string**:
```js
import { useCallback, useMemo } from 'react'
```

**new_string**:
```js
import { useCallback, useEffect, useMemo, useState } from 'react'
```

## Edit 7.2 — isWide state + resize listener

**old_string** (기존 focusTasks useMemo 바로 뒤에 삽입):
```js
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
```

**new_string**:
```js
  // F-41: 뷰포트 반응형 — <1080px 이면 3rd column 숨김 (2-pane fallback = Loop-45 동작)
  const [isWide, setIsWide] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1080
  )
  useEffect(() => {
    let rafId = null
    const onResize = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        setIsWide(window.innerWidth >= 1080)
        rafId = null
      })
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
```

## Edit 7.3 — grid-template-columns + 3rd column 조건부 렌더

**old_string**:
```jsx
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(450px, 1.5fr) minmax(240px, 0.9fr) minmax(320px, 1.2fr)',
        gap: 20,
        width: '100%',
      }}>
```

**new_string**:
```jsx
      <div style={{
        display: 'grid',
        gridTemplateColumns: isWide
          ? 'minmax(450px, 1.5fr) minmax(240px, 0.9fr) minmax(320px, 1.2fr)'
          : 'minmax(450px, 1.5fr) minmax(240px, 0.9fr)',
        gap: 20,
        width: '100%',
      }}>
```

## Edit 7.4 — 3rd column 조건부 렌더

**old_string**:
```jsx
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
        {/* Column 3: 포커스 노트 패널 (Loop-46) — 뷰포트 ≥1080px 에서만 (F-41) */}
        {isWide && (
          <div style={{ minWidth: 0 }}>
            <FocusNotePanel
              tasks={tasks}
              projects={projects}
            />
          </div>
        )}
      </div>
```

**커밋 메시지**:
```
feat(shell): 뷰포트 <1080px 2-pane fallback 최종화 (Loop-46 Commit 7/7)

F-41 대응:
- useState/useEffect 추가 (isWide 상태 + window resize 리스너)
- requestAnimationFrame 디바운스 (resize 과도 리렌더 방지)
- grid-template-columns 조건부:
  · ≥1080px → 3-pane (1.5fr 0.9fr 1.2fr)
  · <1080px → 2-pane (1.5fr 0.9fr) — Loop-45 동작 동등
- FocusNotePanel 3번째 컬럼 조건부 마운트

<768px 모바일은 PersonalMatrixGrid 분기에서 이미 PersonalMatrixMobileList
렌더 — 본 Shell 로직 도달 안 함 (N-11).

Loop-46 전체 완료.
```

---

## 최종 검증 (Commit 7 이후)

- [ ] `npm run build` 통과
- [ ] `npx eslint src/components/views/personal-todo/ src/utils/notes.js src/hooks/useStore.js` clean (pre-existing useStore 에러는 무시)
- [ ] 브라우저 리사이즈 1080px 경계 → 3-pane/2-pane 토글 부드러움 (디바운스 RAF)
- [ ] spec §9.1~9.5 전수 재검증 (최종 통과)

## 롤백 시나리오

| 증상 | 조치 |
|---|---|
| Commit 6 QA 실패 (3-pane 레이아웃 이슈) | `git revert HEAD` → Commit 5 까지 롤백. Stage 2 파일 tree-shake로 안전 |
| Commit 7 responsive 이슈 | `git revert HEAD` → Commit 6 상태 (3-pane always). 추후 재시도 |
| 노트 동기화 버그 | Commit 5 수정 (debounce 시간 조정 등). DB 변경 없으므로 코드만 revert 가능 |
| 전체 되돌림 | `git revert HEAD~6..HEAD` (7 커밋 일괄 revert). store 필드만 남음 (무해) |

## 예상 누적 커밋

| 단계 | 커밋 수 | 누적 |
|---|---|---|
| Stage 1 (Commits 1-4) | 4 | 4 |
| Commit 5 (FocusNotePanel) | 1 | 5 |
| Commit 6 (Shell wire) ⚠ QA | 1 | 6 |
| Commit 7 (Responsive) | 1 | 7 |

## 문서 크기

약 24 KB — 단일 diff-plan 문서 적정 수준.
