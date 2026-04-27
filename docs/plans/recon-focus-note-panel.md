# Recon — 포커스 노트 패널 (3-pane 확장)

> **작업 범위**: Loop-45 이후, 2-pane [백로그 \| 포커스] → 3-pane [백로그 \| 포커스 \| 노트] 확장
> **원칙**: read-only, verbatim 인용, 실제 라인 번호 일치
> **상위 입력 참조**: `docs/plans/recon-v2-personal-todo-focus.md` (중복 조사 회피)

## ⚠ 선제 정정 — 사용자 스펙의 전제 오류

사용자 스펙 §0 원문: *"`notes` 필드(Tiptap JSON)를 3번째 컬럼에서 Workflowy 스타일 불릿 트리로 즉시 편집 가능"*

**실제 확인 결과**:
- 코드베이스에 **Tiptap / ProseMirror 전혀 미사용** (grep `tiptap|Tiptap|ProseMirror` 결과 0 files)
- `notes` 필드는 **plain text** (탭 들여쓰기 + 줄바꿈 포맷). parse/serialize는 [utils/notes.js](../../src/utils/notes.js) 참조:
  ```js
  // L1-L12 전체
  export function parseNotes(notes) {
    if (!notes || !notes.trim()) return []
    return notes.split('\n').filter(l => l.trim()).map(l => {
      let level = 0, i = 0
      while (i < l.length && l[i] === '\t') { level++; i++ }
      return { text: l.slice(i).replace(/^[•\-*]\s*/, '').trim(), level }
    }).filter(n => n.text)
  }
  export function serializeNotes(nodes) {
    return nodes.filter(n => n.text.trim()).map(n => '\t'.repeat(n.level) + n.text).join('\n')
  }
  ```

→ 스펙 1.1~1.3은 그대로 유효 (OutlinerEditor 재사용, notes 필드 공유). **1.3 "Tiptap JSON"만 "plain text (tab-indent)"로 정정**. 이후 본 recon은 plain text 전제로 작성.

---

## A. OutlinerEditor 컴포넌트 완전 파악

### A1. 파일 경로 및 줄 수

- 경로: [`src/components/shared/OutlinerEditor.jsx`](../../src/components/shared/OutlinerEditor.jsx)
- 전체: **252 lines** (wc -l 기준)

### A2. Export 시그니처 verbatim (L15)

```js
const OutlinerEditor = forwardRef(function OutlinerEditor({ notes, onChange, accentColor, onExitUp, onExitDown, allTopCollapsed }, ref) {
```

- `forwardRef` 적용 — ref 속성 지원
- 모든 props 선택적 (TypeScript 없어 기본 유무 판별 불가 — 호출부에서 미지정 가능). 디폴트 없음

### A3. 주요 props 의미

| prop | 타입 | 의미 | 필수 여부 |
|---|---|---|---|
| `notes` | string | tab-indent + '\n' 형식의 plain text (L2 `parseNotes(notes)` 기반) | 사실상 필수 (없으면 빈 문자열로 간주, L17-L19) |
| `onChange` | `(serialized: string) => void` | 내부 편집 결과를 직렬화해 부모로 전달 (L37-L40) | 필수 호출 (L39 `onChange(serialized)` 직접 호출, undefined 시 crash 가능) |
| `accentColor` | string | 프로젝트 dot color 등 강조 색 (L224, L243) | 선택 |
| `onExitUp` / `onExitDown` | fn | 위/아래 경계 이탈 시 부모 포커스 이동 콜백 (`useOutliner` 전달, L81) | 선택 |
| `allTopCollapsed` | boolean \| undefined | top-level 일괄 접기/펼치기 외부 제어 (L44-L59) | 선택 |
| `ref.current` | `{focusFirst(), focusLast()}` | 외부에서 커서 이동 트리거 (L96-L99 `useImperativeHandle`) | 선택 |

**❌ 스펙에서 상정된 다른 props는 부재**:
- `placeholder` — grep 0 match (L242 "추가" 라벨은 + 버튼 하드코딩)
- `readOnly` — 없음 (onChange 미전달 시 crash 가능성, DetailPanel L282 `canEdit ? handleNotesChange : undefined` 로 방어)
- `autoFocus` — 없음
- `onBlur` — 없음 (디바운스 부재로 blur 이벤트 훅 불필요)

### A4. 내부에서 사용하는 extensions

Tiptap 사용 **없음**. 자체 구현:
- L1: `useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle` from 'react'
- L2: `parseNotes, serializeNotes` from '../../utils/notes'
- L3: `useOutliner` from '../../hooks/useOutliner' (키보드/포커스 로직)
- L4: `OutlinerRow` from './OutlinerRow' (한 노드 렌더)
- L5: `PlusIcon` from './Icons'

각 노드는 `<textarea>` 기반 ([OutlinerRow.jsx](../../src/components/shared/OutlinerRow.jsx) — 별도 확인 필요 시 열람).

### A5. `value`(=`notes`) prop 형식

**plain text** — `'\t'` 들여쓰기 + `'\n'` 줄바꿈. Tiptap JSON 아님. `null`/`''`/`undefined` 안전 (L17: `parseNotes(notes)` 내부 guard).

### A6. `onChange` 콜백 인자

**string** (직렬화된 tab-indent text). L36-L40:
```js
const serialized = serializeNotes(nodes)
if (serialized !== lastEmitted.current) {
  lastEmitted.current = serialized
  onChange(serialized)
}
```

### A7. 내부 디바운스/쓰로틀

**없음**. `nodes` 상태가 변할 때마다 `useEffect`가 즉시 `serializeNotes`→`onChange` 호출 (L35-L41). 디바운스는 **외부(호출자)가 책임** — DetailPanel이 800ms 디바운스 구현 (§B5).

### A8. `value` prop 변경 시 리렌더 동작 (중요)

L25-L32:
```js
/* ── Sync from parent (external edits) ── */
useEffect(() => {
  if (notes !== lastEmitted.current) {
    const parsed = parseNotes(notes)
    setNodes(parsed.length ? parsed : [{ text: '', level: 0 }])
    lastEmitted.current = notes || ''
  }
}, [notes])
```

**핵심**: `lastEmitted` ref로 "직전에 내가 emit한 것인지" 추적.
- **자기 에코 방지**: 내가 onChange로 쏜 값과 동일한 값이 props로 다시 들어오면 `notes === lastEmitted.current` → setNodes 스킵 (커서 위치 유지)
- **외부 변경 감지**: 다른 컴포넌트(또는 sync)가 값을 바꿔 내 `lastEmitted`와 다르면 → `setNodes`로 **전체 덮어쓰기** (커서 위치 상실 위험)

**❓ 동시 편집 위험**: DetailPanel + FocusNotePanel 양쪽 열린 상태에서 A panel이 편집하면 B panel의 OutlinerEditor가 setNodes 호출 → B panel 커서 위치 잃음. §H4 참조.

### A9. 빈 상태 판별

**전용 유틸 부재**. 관용구:
- `utils/notes.js` L2: `if (!notes || !notes.trim()) return []`
- `components/project/tasks/OutlinerTaskNode.jsx:27`: `const hasNotes = !!(task.notes && task.notes.trim())`
- `components/views/MemoryView.jsx:168`: `if (memo.title || (memo.notes && memo.notes.trim())) { ... }`

→ 본 Loop에서 "notes 비어있음" 판별 시 **`!task.notes || !task.notes.trim()`** 동일 패턴 사용 권장. 신규 유틸 추가는 불필요하나 기능 재사용 측면에서 `isEmptyNotes(notes)` 1줄 util 신설 고려 가능.

### A10. OutlinerEditor importers (grep `from.*OutlinerEditor`)

```
src/components/views/MemoryView.jsx:5
src/components/shared/DetailPanel.jsx:7
src/components/project/tasks/CompactTaskRow.jsx:2
src/components/project/tasks/OutlinerTaskNode.jsx:5
```

총 4곳. 신규 `FocusNotePanel` 추가 시 5번째.

---

## B. DetailPanel 내 노트 영역 구현

### B1. 파일 경로

[`src/components/shared/DetailPanel.jsx`](../../src/components/shared/DetailPanel.jsx) (513 lines)

### B2. 노트 영역 JSX verbatim (L270-L290)

```jsx
// L270-L290
                      <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M10 5l2-2-2-2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                    </>
                  ) : (
                    <>
                      <path d="M2 3h10M2 7h6M2 11h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M12 7l-2 2-2-2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                    </>
                  )}
                </svg>
              </button>
            </div>
            <OutlinerEditor notes={task.notes} onChange={canEdit ? handleNotesChange : undefined} accentColor={c.dot} allTopCollapsed={allTopCollapsed} />
          </div>
        </div>
      </div>
    </>
  )
}
```

핵심 호출: L282 (단일 줄):
```jsx
<OutlinerEditor notes={task.notes} onChange={canEdit ? handleNotesChange : undefined} accentColor={c.dot} allTopCollapsed={allTopCollapsed} />
```

### B3. `notes` prop 출처

L36: `const { detailTask, closeDetail, tasks, projects, updateTask, deleteTask, toggleDone, collapseState, toggleCollapse, currentTeamId, openModal } = useStore()`

L40: `const task = detailTask ? tasks.find(t => t.id === detailTask.id) : null`

→ **store 구독**: `tasks` 배열에서 `detailTask.id`로 찾은 task의 `notes` 필드 전달. `detailTask` 자체는 store의 `{id, ...}` 스냅샷이지만 실제 최신 데이터는 `tasks.find(...)`로 재조회 (stale 방지).

### B4. `onChange` 핸들러 verbatim (L71-L81)

```js
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
```

### B5. 저장 타이밍

- **로컬 store**: 즉시 (L78-L80 `useStore.setState(...)` 동기)
- **Supabase upsert**: 800ms 디바운스 (L73-L76 `setTimeout`)
- **cleanup**: 다음 keystroke가 이전 timer 취소 (L73 `clearTimeout`). 마지막 입력 후 800ms 지나면 DB 저장.

### B6. 리렌더 경로

1. 사용자 타이핑 → OutlinerEditor `onChange(serialized)` → DetailPanel `handleNotesChange(newNotes)`
2. `useStore.setState` 직접 호출 (L78-L80) → tasks 배열 새 참조 + task 객체 새 참조
3. Zustand가 `tasks` selector 구독자 모두에게 알림
4. DetailPanel L36 `useStore()` (전체 구독) → 리렌더 → L40 `task` 새 값 → OutlinerEditor에 새 `notes` prop 전달
5. OutlinerEditor L27 `notes !== lastEmitted.current` 체크 → 자신이 방금 emit한 값과 동일 → setNodes skip (A8 에코 방지)

**⚠ 주의 포인트**: DetailPanel은 `useStore()` **전체 구독** (`const {...} = useStore()`). task가 변하지 않아도 다른 store 필드 변경에도 리렌더. 성능상 큰 이슈 아니지만 신규 FocusNotePanel은 selector 기반 구독으로 최적화 권장.

---

## C. `tasks.notes` 필드 현황

### C1. `mapTask` 내 `notes` 처리 (useStore.js L179-L200)

```js
function mapTask(r) {
  return {
    id: r.id, text: r.text, projectId: r.project_id, category: r.category || 'backlog',
    done: r.done || false, dueDate: r.due_date || '', startDate: r.start_date || '',
    notes: r.notes || '', prevCategory: r.prev_category || '',
    sortOrder: r.sort_order || 0, alarm: r.alarm ?? null,
    ...
```

- 기본값: `''` (빈 문자열)
- 타입: string (DB에서 null이면 '' 로 coerce)

### C2. `taskToRow` 내 `notes` serialize (L116-L140)

```js
function taskToRow(t) {
  const row = {
    id: t.id, text: t.text, project_id: t.projectId, category: t.category,
    done: t.done, due_date: t.dueDate || null, start_date: t.startDate || null,
    notes: t.notes, prev_category: t.prevCategory || null, sort_order: t.sortOrder,
    ...
```

- 직접 전달 (`t.notes` 그대로). null/undefined/empty string 그대로 저장. DB 쪽에서 어떻게 저장되는지는 컬럼 타입 의존.

### C3. DB 컬럼 타입

- **`supabase/migrations/` 전체에서 `notes text`/`notes jsonb`/`notes varchar` 명시적 grep 결과 0 match**
- 즉, `notes` 컬럼은 Loop-17 migration(2026-03-12) **이전**에 이미 존재한 레거시 컬럼. CLAUDE.md §3-2: "기존 컬럼명 유지 + 기존 타입 유지" 원칙 적용.
- 코드 사용 패턴(string assignment, `trim()` 호출)으로 볼 때 **text** 타입으로 추정 ❓.
- 확인 방법: Supabase Studio → Table Editor → tasks → `notes` 컬럼 메타데이터 조회.

### C4. 현재 DB 저장 형식 — plain text (tab-indent)

`serializeNotes` 출력 형식:
```
프로젝트 A 관련
\t하위 아이템 1
\t하위 아이템 2
\t\t더 들여쓴 아이템
두 번째 최상위
```

(Tiptap JSON ❌, HTML ❌, Markdown ❌. Tab + newline plain text ✅)

### C5. 빈 노트 판별 유틸

**전용 함수 없음**. 관용구 위치 (A9 재인용):
- `utils/notes.js:L2` — `!notes || !notes.trim()`
- `OutlinerTaskNode.jsx:L27` — `const hasNotes = !!(task.notes && task.notes.trim())`
- `MemoryView.jsx:L168, L301` — `if (memo.title || (memo.notes && memo.notes.trim()))`

→ **제안**: FocusCard 노트 아이콘 색 판정 시 동일 패턴 사용:
```js
const hasNotes = !!(task.notes && task.notes.trim())
const iconColor = hasNotes ? '#2383e2' : '#d3d1c7'  // 스펙 1.2
```

---

## D. Loop-45 구현 결과 — 포커스 관련 파일 verbatim

### D1. `PersonalTodoShell.jsx` (140 lines) — §4 D1 이미 위에서 verbatim 게시됨

(앞부분 L1-L140 전체 recon 본문 상단 참조 — 중복 피하려 재인용 생략. 핵심 구조만 아래 요약.)

**구조 개요**:
- L27 `export default function PersonalTodoShell({ projects, tasks, milestones })`
- L33-L46 `focusTasks` useMemo (정렬 포함)
- L48-L50 sensors
- L54-L56 `useDroppable({id: 'focus-panel:root'})` — Shell 레벨에 위치 (Loop-45 revision)
- L58-L96 `handleDragEnd` (case 1: bl-task→focus, case 2: focus reorder; case 3/fallback 제거됨)
- L104-L137 렌더: flex 구조 (grid 아님)
  - L112 좌측 `<div style={{ flex: 3, minWidth: 0 }}>`
  - L121 우측 `<div ref={focusDropRef} style={{ flex: 2, minWidth: 280, background: focusIsOver ? COLOR.bgHover : 'transparent', ... }}>`
  - `alignItems`는 기본값(stretch) — 우측 wrapper가 container 높이 전체 차지

### D2. `FocusPanel.jsx` (117 lines) verbatim

```jsx
// L1-L117 전체 (최신 Loop-45 QA 후 상태 — useDroppable 제거됨)
1→import { useMemo } from 'react'
2→import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
3→import { getCachedUserId } from '../../../hooks/useStore'
4→import { COLOR, FONT, SPACE } from '../../../styles/designTokens'
5→import FocusCard from './cells/FocusCard'
6→import FocusQuickAddInput from './cells/FocusQuickAddInput'
7→
22→export default function FocusPanel({ projects, tasks, milestones }) {
23→  const currentUserId = getCachedUserId()
24→
26→  const instantProjectId = useMemo(() => {
27→    const p = projects.find(x => x.userId === currentUserId && x.systemKey === 'instant')
28→    return p?.id || null
29→  }, [projects, currentUserId])
30→
31→  const focusTasks = useMemo(() => {
32→    const mine = tasks.filter(t =>
33→      t.assigneeId === currentUserId &&
34→      t.isFocus === true &&
35→      !t.done &&
36→      !t.deletedAt
37→    )
38→    return mine.sort((a, b) => {
39→      const oa = a.focusSortOrder ?? 0
40→      const ob = b.focusSortOrder ?? 0
41→      if (oa !== ob) return oa - ob
42→      return (b.updatedAt || '').localeCompare(a.updatedAt || '')
43→    })
44→  }, [tasks, currentUserId])
...
61→  return (
62→    <div
63→      style={{
64→        position: 'sticky',
65→        top: 0,
66→        alignSelf: 'flex-start',
67→        padding: SPACE.cellPadding,
68→        minHeight: 200,
69→        borderLeft: `1px solid ${COLOR.border}`,
70→      }}
71→    >
...
93→      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
94→        {focusTasks.map(task => (
95→          <FocusCard
96→            key={task.id}
97→            task={task}
98→            project={projectById.get(task.projectId)}
99→            milestone={task.keyMilestoneId ? msById.get(task.keyMilestoneId) : null}
100→          />
101→        ))}
102→      </SortableContext>
...
```

### D3. `FocusCard.jsx` (138 lines) verbatim

핵심 구간 (L44-L138, 전체):

```jsx
44→  return (
45→    <div
46→      ref={setNodeRef}
47→      onMouseEnter={() => setHover(true)}
48→      onMouseLeave={() => setHover(false)}
49→      style={{
50→        ...sortableStyle,
51→        display: 'flex', alignItems: 'flex-start', gap: 8,
52→        padding: SPACE.cardPadding,
53→        background: '#fff',
54→        border: `1px solid ${COLOR.border}`,
55→        borderRadius: 6,
56→        marginBottom: 6,
57→      }}
58→    >
59→      {/* Drag handle ⋮⋮ */}
60→      <div {...attributes} {...listeners} style={{...}} title="드래그하여 이동" >⋮⋮</div>
71→      {/* Checkbox */}
72→      <div onClick={...} style={{ width: CHECKBOX.size, ... }}>...</div>
89→      {/* Text + meta */}
90→      <div style={{ flex: 1, minWidth: 0 }}>
91→        <div onClick={() => openDetail(task)} style={{ fontSize: FONT.body, ... }}>
101→          {task.text}
102→        </div>
103→        {(projectLabel || milestone?.title) && (
104→          <div style={{
105→            display: 'flex', alignItems: 'center', gap: 4,
106→            marginTop: 2, fontSize: FONT.ganttMs,
107→          }}>
108→            {projectLabel && <span style={projectLabelStyle}>{projectLabel}</span>}
111→            {milestone?.title && <span style={{color:COLOR.textTertiary}}>{projectLabel?'·':''} {milestone.title}</span>}
115→          </div>
116→        )}
117→      </div>
118→
119→      {/* × (포커스 해제) */}
120→      <div onClick={handleUnfocus} style={{
121→        width: 20, height: 20, borderRadius: 3, flexShrink: 0,
122→        display:'flex', alignItems:'center', justifyContent:'center',
123→        cursor: 'pointer', color: COLOR.textTertiary,
124→        fontSize: 14, lineHeight: 1,
125→        opacity: hover ? 1 : 0.4,
126→        transition: 'opacity 0.15s',
127→      }} title="포커스 해제">×</div>
136→    </div>
137→  )
138→}
```

### D4. `FocusQuickAddInput.jsx` (61 lines) — §4 D4 이미 게시

```jsx
12→export default function FocusQuickAddInput({ instantProjectId, currentUserId }) {
13→  const addTask = useStore(s => s.addTask)
14→  const [value, setValue] = useState('')
15→
16→  const handleAdd = () => {
17→    const text = value.trim()
18→    if (!text) return
19→    if (!instantProjectId) { return }
24→    addTask({
25→      text,
26→      projectId: instantProjectId,
27→      assigneeId: currentUserId,
28→      secondaryAssigneeId: null,
29→      keyMilestoneId: null,
30→      category: 'today',
31→      isFocus: true,
32→    })
33→    setValue('')
34→  }
```

**❓ 3-pane spec 1.2 "카드 생성 직후 자동 active 선택"**: 현재 `addTask(...)` 호출 후 반환값 미사용. addTask는 생성된 task 반환 (useStore.js L611 `return t`). FocusQuickAddInput에서 `const newTask = await addTask(...)` 후 `setSelectedFocusTaskId(newTask.id)` 호출 가능 — 이 추가 로직이 필요.

### D5. Shell `grid-template-columns` 현재 값

**grid 아님, flex 사용**. L104-L110:
```jsx
<div style={{
  display: 'flex',
  gap: 24,
  width: '100%',
  // alignItems 기본값(stretch)
}}>
```

- 좌측: `flex: 3, minWidth: 0` (L112)
- 우측: `flex: 2, minWidth: 280` (L121)
- 비율 3:2 = 60%:40%

**❗ 사용자 스펙 1.1 "3-pane 1.5fr : 0.9fr : 1.2fr"** = flex 값으로 치환 가능 (1.5:0.9:1.2 ≈ 5:3:4). 또는 `display: grid; grid-template-columns: 1.5fr 0.9fr 1.2fr` 로 변경. flex vs grid 택일은 spec 결정 사항.

### D6. 선택된 포커스 카드(active/selected) 개념

**현재 코드에 존재하지 않음**. grep `selectedFocusTaskId|activeFocusTaskId|currentFocusTaskId` → 0 matches. `FocusCard`는 클릭 시 `openDetail(task)` 호출 (L92) — DetailPanel 열기 용도뿐.

→ **신규 도입 필요**: 다음 중 택 1:
1. Zustand store에 `selectedFocusTaskId` 필드 추가 (전역 공유 필요 시)
2. `PersonalTodoShell` local state (현재 뷰 내에서만 필요하면)
3. `usePivotExpandState('personalFocusSelected')` KEY 추가 후 localStorage 유지

spec §1.2 "reload 복원" 고려 시 3번 또는 1번+localStorage 조합이 적합 (§G 참조).

---

## E. 노트 아이콘 표시 공간 확인

### E1. 현재 FocusCard 메타 정보 줄 (L103-L116)

```jsx
103→{(projectLabel || milestone?.title) && (
104→  <div style={{
105→    display: 'flex', alignItems: 'center', gap: 4,
106→    marginTop: 2, fontSize: FONT.ganttMs,
107→  }}>
108→    {projectLabel && (
109→      <span style={projectLabelStyle}>{projectLabel}</span>
110→    )}
111→    {milestone?.title && (
112→      <span style={{ color: COLOR.textTertiary }}>
113→        {projectLabel ? '·' : ''} {milestone.title}
114→      </span>
115→    )}
116→  </div>
117→)}
```

- `display: flex` + `alignItems: center`, gap 4
- 좌측부터: 프로젝트명 (italic일 수 있음) · MS.title
- **우측 여백 없음** — 콘텐츠만큼만 차지

### E2. 메타 줄 우측에 아이콘 추가 공간 확보 가능 여부

**가능**. 옵션:
1. **메타 줄 끝에 spacer + 아이콘 추가**:
   ```jsx
   <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontSize: FONT.ganttMs }}>
     {projectLabel && <span>...</span>}
     {milestone?.title && <span>...</span>}
     <div style={{ flex: 1 }} />  {/* spacer */}
     <span style={{ fontSize: 12, color: hasNotes ? '#2383e2' : '#d3d1c7' }}>📝</span>
   </div>
   ```
2. **flex:1 영역 밖, 카드 우측 × 버튼 옆 아이콘 추가** (L90 `<div style={{flex: 1, minWidth: 0}}>` 과 L120 `× div` 사이에 `📝`)

옵션 2는 × 와 정렬되어 시각적으로 깔끔. 옵션 1은 메타 줄 내부에서 "이 task의 context(프로젝트/MS/노트 유무)"를 한 눈에 보여주는 느낌.

spec 1.2 "포커스 카드 내 노트 아이콘" 모호 → diff-plan 단계에서 UX 결정. 의견: **옵션 1 (메타 줄 끝)** 권장 — 포커스 카드의 세로 공간 절약 + 클릭 타깃이 커서 hover 피드백 자연스러움.

### E3. × 버튼 현재 위치 및 충돌 가능성

L119-L135의 × 버튼은 카드 **최우측** (flex row 마지막 자식). 20x20 버튼. 아이콘을 **옵션 2**로 × 바로 옆에 두면 hit target 2개 나란히 배치 — 명확한 두 버튼 영역. 충돌 없음.

**옵션 1** 선택 시 아이콘은 메타 줄 내부 → ×와 아예 다른 세로 위치 → 충돌 불가.

### E4. 프로젝트 색상 dot / 장식 요소

현재 FocusCard는 프로젝트 color dot **미사용**. `project?.color`를 참조하지만 text label만 렌더 (L109). TaskRow와 달리 dot 없이 text-only 메타.

→ 노트 아이콘 추가 시 dot 충돌 걱정 없음.

---

## F. 3-pane 레이아웃 전환 영향

### F1. 왼쪽 백로그(`PersonalTodoListTable`) 내부 3열 그리드의 반응

[`PersonalTodoProjectGroup.jsx`](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx) 내부는 `display: grid; grid-template-columns: 170px 130px 1fr` (LIST.colWidthProject 170 + colWidthMilestone 130 + flexible task 1fr).

**Shell 좌측 wrapper 폭이 줄면**:
- 좌측 wrapper의 실제 px = (container_width × flex_비율) - gap
- ProjectGroup의 170 + 130 = 300px 고정 — 좌측 wrapper가 300px 미만으로 줄면 task 1fr 영역이 음수 → overflow
- 일반 데스크탑(1400px 뷰포트 기준) 좌측 1.5fr = 약 585px → 300 + 285px 남음 → 문제 없음
- 좁은 뷰포트(1024px) 좌측 1.5fr = 약 420px → 300 + 120px 남음 → task col 120px, task text가 줄바꿈/잘림 빈번

### F2. 최소 폭 기준

- ProjectGroup 내부 고정 300px (project + MS col)
- task text 최소 ~150px 확보 필요 (한글 2~3줄)
- → 좌측 wrapper 최소 **450px**

Shell 전체 컨테이너 폭 W, 3-pane 비율 1.5 : 0.9 : 1.2 = 총 3.6. 좌측 비율 1.5/3.6 = 41.7%
- W × 0.417 ≥ 450 → W ≥ **1080px**

**❓ 1080px 미만 (태블릿 가로, 일부 랩탑)**: 3-pane 깨짐 — 사용자 스펙 1.1 "데스크탑 전용 (≥768px)" 은 너무 낮음. **≥1080px** 권장. 그 이하는 2-pane 또는 mobile list로 fallback.

### F3. FocusPanel `position: sticky` 유효성

[`FocusPanel.jsx`](../../src/components/views/personal-todo/FocusPanel.jsx) L63-L66:
```jsx
<div style={{
  position: 'sticky',
  top: 0,
  alignSelf: 'flex-start',
  ...
}}>
```

sticky의 scroll ancestor는 `overflow: auto` 가진 부모. UnifiedGridView L426의 `<div style={{ flex: 1, overflow: 'auto' }}>` 가 해당.

**3-pane 전환 후에도**: 
- Shell이 같은 `overflow: auto` 부모 아래 있으므로 sticky 유효 ✓
- 각 pane이 독립적으로 sticky 가지면 3개가 동시 위 고정 가능 — 노트 패널도 sticky 적용 시 자연스러움

**❓ 주의**: sticky는 **parent element의 높이가 sticky element 높이보다 커야** 작동. 부모 wrapper의 `align-self: stretch` 가 충분한 높이 확보 필요. 현재 Shell은 stretch로 잘 작동.

### F4. 2-pane → 3-pane 재검토 항목

| 항목 | 현재 (2-pane) | 3-pane 대응 |
|---|---|---|
| Shell L104 flex 컨테이너 | `display: flex, gap: 24` | 유지 가능. `gap: 24` 으로 3개 column 사이 48px (2×24) 총 여백 — 과도할 수 있음, `gap: 20` 정도로 축소 고려 |
| 좌측 L112 `flex: 3, minWidth: 0` | 3:2 비율 | 1.5:0.9:1.2 → `flex: 1.5` (또는 grid 사용) |
| 우측 L121 `flex: 2, minWidth: 280` | sticky drop zone | 포커스 `flex: 0.9` + `minWidth: 240` |
| FocusPanel `borderLeft: 1px solid border` | 좌측 구분선 | 유지 + 노트 패널에도 동일 `borderLeft` 적용 → 시각적 3-section 구분 |
| FocusPanel `minHeight: 200` | 빈 상태 드롭존 확보 | 유지 |
| `focus-panel:root` useDroppable (Shell L54) | 우측 flex 컬럼 전체 | 유지 (노트 패널 신설이어도 포커스 drop은 가운데 column만) |

---

## G. localStorage 키 패턴 재사용

### G1. `usePivotExpandState` KEYS 상수 verbatim

[`src/hooks/usePivotExpandState.js`](../../src/hooks/usePivotExpandState.js) L8-L12:
```js
const KEYS = {
  team: 'matrixPivotExpanded',
  personal: 'personalMatrixPivotExpanded',
  personalSection: 'personalSectionExpanded',  // Loop-45 F-12: 다음/남은 섹션 접기 상태
}
```

### G2. 네이밍 컨벤션

- camelCase key
- 용도 서술 어미: `Expanded` (접기 상태), `Collapsed` (반대), `Sections` (구조 상태)
- 스토리지 키는 `{scope}{feature}{property}` 형식 (`personalSection + Expanded`)

### G3. selectedFocusTaskId 저장 hook 선택

**usePivotExpandState는 `{pid: boolean}` map 형태**에 특화 — 단일 string id 저장에 오버스펙.

**옵션 비교**:

| 옵션 | 장점 | 단점 |
|---|---|---|
| A. Zustand store 필드 `selectedFocusTaskId` (in-memory only) | 전역 공유 간편, 리렌더 통합 | reload 시 소실 |
| B. Zustand store 필드 + `localStorage.setItem` 미들웨어 | 영속 + 전역 | 초기 로드 로직 필요, 코드 2-3줄 추가 |
| C. 신규 hook `useSelectedFocusTask()` (localStorage + useState) | 단순, 로컬 scope | 여러 컴포넌트에서 구독 시 상태 동기화 어려움 |
| D. `usePivotExpandState('personalFocusSelected')` — map에 `{'id': taskId}` 형태로 저장 | 재사용 | 오용 — map 구조 오남용 |

**권장: 옵션 B** (간단한 Zustand 필드 + initialValue를 `localStorage.getItem('selectedFocusTaskId')` 로 읽기, `setSelectedFocusTaskId` 액션이 setState + localStorage 둘 다 기록). 현재 패턴 [`useStore.js:1568 currentTeamId`](../../src/hooks/useStore.js#L1568), [`L1572 onboardingSkipped`](../../src/hooks/useStore.js#L1572) 등과 동일.

### G4. 기존 "선택된 ID" 저장 유사 패턴

grep `selectedProjectId|lastViewedTaskId|selectedFocusTaskId|selectedTaskId` 결과 (상위 20 hits):

| 패턴 | 위치 | 저장 방식 |
|---|---|---|
| `selectedProjectId` | [`useStore.js:1649`](../../src/hooks/useStore.js#L1649) `selectedProjectId: null` | **store in-memory only, localStorage 없음** — reload 시 null |
| `selectedProjectId` | [`useStore.js:1655`](../../src/hooks/useStore.js#L1655) `selectedProjectId: projectId,` (enterProjectLayer action) | store 세팅 |
| `selectedProjectId` | [`WeeklyScheduleView.jsx:42`](../../src/components/views/WeeklyScheduleView.jsx#L42) `useState(null)` | 로컬 state |

→ 유사 "selected id" 는 대부분 **store in-memory** 또는 **component useState**. localStorage 저장은 **sectionOrder / expanded state / language / mode** 등 사용자 preference에만.

**판단**: selectedFocusTaskId는 "사용자가 마지막으로 선택한 focus" = preference에 가까움. localStorage 저장이 UX 상 자연스러움 (reload 시 커서 복원). 옵션 B 유지.

---

## H. 양방향 동기화 검증 시나리오

### H1. `updateTask`의 tasks 배열 set 패턴 (useStore.js L614-L635)

```js
updateTask: async (id, patch) => {
  const currentTask = get().tasks.find(x => x.id === id)
  if (!currentTask) return
  const resolvedPatch = applyTransitionRules(currentTask, patch)
  ...
  set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...resolvedPatch } : t) }))
  ...
}
```

→ **확인**: `.map(...)`으로 **새 tasks 배열** 생성, 변경된 task도 **새 객체** (`{...t, ...resolvedPatch}`). 참조 변경 → Zustand 구독자 리렌더 트리거 ✓.

DetailPanel의 L78-L80 optimistic update도 동일 패턴:
```js
useStore.setState(s => ({
  tasks: s.tasks.map(t => t.id === task.id ? { ...t, notes: newNotes } : t)
}))
```

### H2. 같은 task 두 컴포넌트 독립 구독 시 Zustand 기본 동작

Zustand 기본: **같은 state를 여러 컴포넌트가 구독하면, state 변경 시 모든 구독자 리렌더**.

DetailPanel L36: `const {...} = useStore()` — 전체 store 구독 (거의 모든 변경에 리렌더)
FocusNotePanel 예상: `const task = useStore(s => s.tasks.find(t => t.id === selectedId))` — selector 기반 구독

**결과**: tasks 배열 변경 시 양쪽 다 리렌더. task 객체가 같으면 React memoization으로 자식(OutlinerEditor)에 전달되는 props가 `Object.is` 같으면 스킵 가능. 하지만 `tasks.find(...)` 는 매번 새 `task` 객체 반환? — 아니다, map 결과의 동일 id 객체 참조 그대로. 변경된 task만 새 객체.

즉:
- task A가 변경 → 양쪽에서 A의 새 객체 참조 → 양쪽 OutlinerEditor re-render
- task A가 변경, 동시에 B는 안 변경 → 양쪽 모두 tasks 새 배열이므로 리렌더되지만, B의 `task` 참조는 같음 → B 쪽 OutlinerEditor는 `notes` prop 동일 → A8 자기에코 방지로 setNodes 스킵

### H3. OutlinerEditor의 `value` (notes) 변경 시 내부 state 재설정 (L25-L32)

```js
useEffect(() => {
  if (notes !== lastEmitted.current) {
    const parsed = parseNotes(notes)
    setNodes(parsed.length ? parsed : [{ text: '', level: 0 }])
    lastEmitted.current = notes || ''
  }
}, [notes])
```

**커서 위치**: `setNodes` 호출 → OutlinerRow 재마운트 X, 기존 인스턴스 유지 (node 배열만 변경). 하지만 **textarea 내부 `value` prop**이 `node.text`에 바인딩되어 있으므로 외부 notes 변경 시 textarea 값이 재설정. 만약 사용자가 타이핑 중간에 외부 업데이트가 오면:
- textarea 재렌더 → 커서 position 리셋 가능 (브라우저 기본 동작)
- 최근 타이핑한 글자가 소실될 수 있음 (자신의 nodes state가 덮어쓰기 됨)

**자기 에코 방지(L27)**: `notes === lastEmitted.current` 체크로 **자신이 emit한 변경은 스킵**. 그러나 **다른 컴포넌트가 emit한 변경은 통과** → setNodes → 커서/타이핑 리셋.

### H4. "양쪽 동시 타이핑" 위험 요소

**시나리오**:
1. User opens DetailPanel for task X → OutlinerEditor A 마운트
2. User also has FocusNotePanel showing task X → OutlinerEditor B 마운트  
3. User types "hello" in A → A의 nodes 업데이트 → A onChange → DetailPanel handleNotesChange (optimistic store update + 800ms 디바운스)
4. Store tasks[X].notes = "hello" → 모든 구독자 리렌더
5. B는 `notes` prop으로 "hello" 받음 → B의 `lastEmitted.current`는 "" (전 상태) → "hello" !== "" → `setNodes(parseNotes("hello"))` → B의 nodes 업데이트, textarea 재렌더

**결과**: B의 textarea에는 "hello" 표시됨. 만약 user가 이 시점에 B에서도 타이핑 중이었다면 (예: "x"), B의 "x" 내용은 A 업데이트로 덮어쓰기 — 소실.

**실제 위험도**: 
- 동일 사용자가 두 패널에서 동시에 같은 task를 편집할 가능성은 낮음
- 하지만 selection/focus가 양쪽에 있으면 키 입력이 의도와 다른 곳으로 갈 수 있음
- 디바운스 800ms 이내에는 store 업데이트가 없으므로 같은 패널에서 연속 타이핑은 안전

**완화 방안** (diff-plan 단계 결정):
1. FocusNotePanel 활성 시 DetailPanel에서 같은 task 노트 편집 **read-only** 전환
2. 또는 DetailPanel 열릴 때 FocusNotePanel의 OutlinerEditor `disabled` (부재하므로 `onChange={undefined}` 패턴) — **현재 OutlinerEditor는 readOnly prop 없음** → ⚠ OutlinerEditor 수정 없이 구현 불가. onChange를 no-op로 교체해도 내부 편집은 가능.
3. 가장 단순: 동일 task 편집 상황을 허용하되 디바운스 윈도우(800ms)를 늘리거나, 포커스가 활성인 쪽 우선 — 복잡.

**권장**: 초기 릴리즈는 "동시 편집 위험 허용" — 실사용에서 드문 케이스, 발생 시 가장 최근 타이핑이 이김 (자연스러움). 리그레션 리포트 올라오면 옵션 1 구현.

---

## 완료 체크

- [x] A1 ~ A10 OutlinerEditor 완전 파악 (forwardRef, 6 props, tab-indent plain text, 디바운스 없음, 자기에코 L26-L32)
- [x] B1 ~ B6 DetailPanel 노트 영역 (L282 호출, L71-L81 debounce 800ms + optimistic)
- [x] C1 ~ C5 tasks.notes 현황 (mapTask L183, taskToRow L120, DB text 타입 추정 ❓, 빈 판별 util 없음)
- [x] D1 ~ D6 Loop-45 포커스 파일 verbatim (Shell flex 3:2, FocusPanel sticky, FocusCard 메타 줄 L103-L117, active 개념 없음)
- [x] E1 ~ E4 FocusCard 아이콘 공간 (옵션 1/2 제안, × 버튼 충돌 없음)
- [x] F1 ~ F4 3-pane 영향 (좌측 minimum 450px, 뷰포트 ≥1080px 권장, sticky 유효, flex → grid 검토)
- [x] G1 ~ G4 localStorage 패턴 (KEYS map 구조, selectedProjectId 전례로 store 필드 + localStorage 권장)
- [x] H1 ~ H4 동기화 (tasks.map 새 참조, Zustand 양쪽 리렌더, L25-L32 자기에코 방지, 동시 편집 위험 낮음)

## 불확실 항목

| # | 항목 | 근거 |
|---|---|---|
| 1 | DB `tasks.notes` 컬럼 타입 정확 명세 | Loop-17 이전 레거시, migration에 명시 없음. `text` 추정 but Supabase Studio 확인 권장 |
| 2 | 3-pane 비율 1.5:0.9:1.2의 grid vs flex 구현 | spec 정의 모호 — flex 값으로 반환 가능하나 grid가 더 명확 |
| 3 | 노트 아이콘 위치 (옵션 1 메타 줄 끝 vs 옵션 2 × 옆) | spec 미결정 |
| 4 | 3-pane 깨지는 최소 뷰포트 | 사용자 스펙 768px은 과도하게 낮음. 1080px 권장하나 확정 필요 |
| 5 | 동시 편집 처리 정책 | 위험 낮지만 spec 결정 필요 (허용 vs readOnly 전환) |
| 6 | OutlinerEditor 수정 금지 원칙과 H4 완화책 충돌 | OutlinerEditor에 readOnly 추가 없이는 옵션 1/2 구현 어려움. spec 판단 필요 |

## 파일 크기

약 27 KB — 30KB 목표 내.
