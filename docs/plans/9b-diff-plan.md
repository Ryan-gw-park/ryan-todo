# Phase 9b Diff Plan (v2) — 프로젝트 뷰 BacklogPanel

> 작성일: 2026-04-09
> 기준: `9b-spec-final.md` (확정 v2)
> 상태: 리뷰 반영 v2

---

## 0. 전제 요약

- DB / RLS 변경 없음
- DnD 없음 (9c로 분리)
- 9a 결과물 무수정 (MilestoneOwnerSelector 유지)
- 기존 파일은 **추가만** (삭제/변경 금지), 단 CompactMilestoneTab의 BACKLOG_MS 섹션은 **제거** (BacklogPanel로 대체)

---

## 리뷰 반영 사항 (v1 → v2)

| 리뷰 이슈 | 해결 |
|-----------|------|
| [C1] Hook 순서 위반 위험 | Step 4에서 모든 useState/useEffect를 early return 전에 배치 명시 |
| [C2] BACKLOG_MS 제거 시 DnD 소스 상실 | handleDragEnd의 `__backlog__` → `null` 치환 + backlogTasks 유지 |
| [C3] expandedMs에 `__backlog__` 잔류 | allMsIds 축소 시 `expandedMs`에서 `__backlog__` 제거 로직 추가 |
| [C4] InlineAdd assigneeId 미설정 | extraFields에 `assigneeId: null` 추가 |
| [W2/W6] 반응형 spec 위반 (unmount) | `display: none` 방식으로 변경 (mount 유지) |
| [I3] category 'today' vs 'backlog' | `category: 'backlog'`으로 변경 (기존 패턴 일관) |
| [null safety] 검색 시 t.text null 가능 | `(t.text \|\| '').toLowerCase()` 방어 |
| [W4] members 필드명 불일치 | `m.displayName \|\| '?'` (name 필드 없음 명시) |
| [빈 상태 구분] 검색 결과 없음 vs 진짜 빈 상태 | 필터/검색 활성 시 "검색 결과 없음" 별도 메시지 |

---

## Step 1: `backlogFilter.js` 신규 유틸

**파일**: `src/utils/backlogFilter.js` (신규)

```js
/**
 * 백로그 task 필터 유틸
 */
export function isBacklogTask(task) {
  return !task.keyMilestoneId && !task.done && !task.deletedAt
}
```

**커밋**: `feat(utils): add backlogFilter util (9b step 1)`

---

## Step 2: `TaskAssigneeChip.jsx` 신규 컴포넌트

**파일**: `src/components/project/TaskAssigneeChip.jsx` (신규)

**Props**:
```js
{
  taskId,            // string
  assigneeId,        // string | null
  members,           // [{ userId, displayName, role }] — name 필드 없음, displayName 사용
  onChangeAssignee,  // (userId: string | null) => void
  size,              // number (avatar 크기, default 14)
}
```

**구현 핵심**:

1. **state**: `const [open, setOpen] = useState(false)`, `const ref = useRef(null)`
2. **click-outside**: useEffect + mousedown listener (MilestoneOwnerSelector와 동일 패턴)
3. **아바타 렌더**:
   - `assigneeId` 있음: `<MiniAvatar name={memberName} size={size} />`
   - `assigneeId` null: ghost 아바타 (1px dashed `#B4B2A9`, 배경 투명, 중앙 `+`)
4. **memberName 조회**: `const memberName = (userId) => { const m = members.find(mem => mem.userId === userId); return m ? (m.displayName || '?') : '?' }`
5. **클릭 → 드롭다운** (width: 180px, right-aligned, top+4px):
   - 헤더: "담당자 변경" (fontSize 11, color `#a09f99`)
   - "미배정" 옵션
   - 멤버 목록 (아바타 + displayName, 현재값 하이라이트)
6. **cascade 없음**, mixed 모드 없음 (MS selector와의 차이)
7. **닫힘**: 외부 클릭 + ESC + 멤버 선택

**import**: `MiniAvatar` from `../views/grid/shared/MiniAvatar`

**커밋**: `feat(project): add TaskAssigneeChip component (9b step 2)`

---

## Step 3: `BacklogPanel.jsx` 신규 컴포넌트

**파일**: `src/components/project/BacklogPanel.jsx` (신규)

**Props**:
```js
{
  projectId,       // string
  projectTasks,    // task[] — 전체 프로젝트 tasks (필터는 내부에서)
  members,         // [{ userId, displayName }]
  currentTeamId,   // string | null
  color,           // { dot, text } — 프로젝트 색상 (InlineAdd에 전달)
  hidden,          // boolean — true이면 display: none (mount는 유지)
}
```

**구현 핵심**:

### 3-1. State
```js
const [searchQuery, setSearchQuery] = useState('')
const [filterChip, setFilterChip] = useState(null) // null | 'mine' | 'unassigned' | 'dueSoon'
const [sortMode, setSortMode] = useState('default') // 'default' | 'recent' | 'oldest'
```

### 3-2. 백로그 task 필터링
```js
import { isBacklogTask } from '../../utils/backlogFilter'

const userId = useStore(s => s.userId)
const updateTask = useStore(s => s.updateTask)
const toggleDone = useStore(s => s.toggleDone)
const openDetail = useStore(s => s.openDetail)

const backlogAll = useMemo(() => projectTasks.filter(isBacklogTask), [projectTasks])

const backlogTasks = useMemo(() => {
  let tasks = [...backlogAll]

  // 검색
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase()
    tasks = tasks.filter(t => (t.text || '').toLowerCase().includes(q))
  }

  // 필터 chip
  if (filterChip === 'mine') tasks = tasks.filter(t => t.assigneeId === userId)
  else if (filterChip === 'unassigned') tasks = tasks.filter(t => !t.assigneeId)
  else if (filterChip === 'dueSoon') {
    const now = new Date()
    const d3 = new Date(now.getTime() + 3 * 86400000)
    const d3Str = d3.toISOString().slice(0, 10)
    tasks = tasks.filter(t => t.dueDate && t.dueDate <= d3Str)
  }

  // 정렬
  if (sortMode === 'recent') tasks.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  else if (sortMode === 'oldest') tasks.sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''))
  else tasks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

  return tasks
}, [backlogAll, searchQuery, filterChip, sortMode, userId])
```

### 3-3. 2-섹션 분할
```js
const unassigned = backlogTasks.filter(t => !t.assigneeId)
const assigned = backlogTasks.filter(t => !!t.assigneeId)
const totalCount = backlogAll.length  // 필터/검색 전 전체 카운트 (헤더 badge용)
const filteredCount = unassigned.length + assigned.length
const hasActiveFilter = searchQuery.trim() || filterChip
```

### 3-4. 카운트 경고색
```js
function getBadgeStyle(count) {
  if (count >= 16) return { background: '#FCEBEB', color: '#A32D2D' }
  if (count >= 6) return { background: '#FAEEDA', color: '#854F0B' }
  return { background: '#f0efe8', color: '#888780' }
}
```

### 3-5. Task 행 렌더 (`BacklogTaskRow` 내부 컴포넌트)
```jsx
function BacklogTaskRow({ task, members, currentTeamId, onToggle, onOpen, onChangeAssignee, sortMode }) {
  const [hover, setHover] = useState(false)

  // dueDate D-3 판정
  const isDueSoon = (() => {
    if (!task.dueDate) return false
    const now = new Date()
    const d3 = new Date(now.getTime() + 3 * 86400000)
    return task.dueDate <= d3.toISOString().slice(0, 10)
  })()

  // 7일 미수정 판정 (오래된순 정렬 시만)
  const isStale = sortMode === 'oldest' && task.updatedAt && (() => {
    const diff = Date.now() - new Date(task.updatedAt).getTime()
    return diff > 7 * 86400000
  })()

  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={() => onOpen(task)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 8px', minHeight: 28, cursor: 'pointer',
        background: hover ? '#f5f4f0' : 'transparent',
        borderBottom: '0.5px solid #f0efe8',
      }}
    >
      {isStale && <span style={{ fontSize: 10, flexShrink: 0 }}>🕒</span>}

      {/* Checkbox */}
      <div onClick={e => { e.stopPropagation(); onToggle(task.id) }} style={{
        width: 12, height: 12, borderRadius: 3, flexShrink: 0, cursor: 'pointer',
        border: '1.5px solid #ccc', background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }} />

      {/* Text */}
      <span style={{ flex: 1, fontSize: 12, color: '#2C2C2A', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3 }}>
        {task.text || '(제목 없음)'}
      </span>

      {/* DueDate */}
      {task.dueDate && (
        isDueSoon ? (
          <span style={{ fontSize: 10, background: '#FCEBEB', color: '#A32D2D', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>
            {task.dueDate.slice(5)}
          </span>
        ) : (
          <span style={{ fontSize: 10, color: '#888780', flexShrink: 0 }}>{task.dueDate.slice(5)}</span>
        )
      )}

      {/* Assignee avatar */}
      {currentTeamId && (
        <TaskAssigneeChip
          taskId={task.id}
          assigneeId={task.assigneeId}
          members={members}
          onChangeAssignee={(userId) => onChangeAssignee(task.id, userId)}
          size={14}
        />
      )}
    </div>
  )
}
```

### 3-6. 메인 렌더 구조
```jsx
// hidden prop으로 display:none (mount 유지, state 보존)
<div style={{
  width: 280, flexShrink: 0, borderLeft: '1px solid #e8e6df',
  background: '#fafaf8', display: hidden ? 'none' : 'flex',
  flexDirection: 'column', height: '100%',
}}>
  {/* 헤더 */}
  <div style={{ padding: '12px 12px 8px', borderBottom: '0.5px solid #e8e6df' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>📥 백로그</span>
      <span style={{ ...getBadgeStyle(totalCount), fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 10 }}>{totalCount}</span>
      <div style={{ flex: 1 }} />
      <select value={sortMode} onChange={e => setSortMode(e.target.value)}
        style={{ border: 'none', background: 'none', fontSize: 10, color: '#888780', cursor: 'pointer', fontFamily: 'inherit' }}>
        <option value="default">기본순</option>
        <option value="recent">최근순</option>
        <option value="oldest">오래된순</option>
      </select>
    </div>
    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
      placeholder="검색…" style={{ width: '100%', padding: '5px 8px', fontSize: 11, border: '1px solid #e8e6df', borderRadius: 5, outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
      {[{ key: 'mine', label: '내 것만' }, { key: 'unassigned', label: '미배정' }, { key: 'dueSoon', label: '기한 임박' }].map(c => (
        <button key={c.key} onClick={() => setFilterChip(prev => prev === c.key ? null : c.key)}
          style={{ border: '1px solid', borderColor: filterChip === c.key ? '#2C2C2A' : '#e8e6df', borderRadius: 12,
            padding: '2px 8px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
            background: filterChip === c.key ? '#2C2C2A' : '#fff',
            color: filterChip === c.key ? '#fff' : '#888780' }}>
          {c.label}
        </button>
      ))}
    </div>
  </div>

  {/* 빈 상태 — 진짜 비어있음 */}
  {totalCount === 0 && (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#085041' }}>
      <span style={{ fontSize: 20, marginBottom: 4 }}>✓</span>
      <span style={{ fontSize: 12 }}>백로그가 깨끗합니다</span>
    </div>
  )}

  {/* 빈 상태 — 필터/검색 결과 없음 */}
  {totalCount > 0 && filteredCount === 0 && (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888780', fontSize: 12 }}>
      검색 결과 없음
    </div>
  )}

  {/* Task 목록 (스크롤) */}
  {filteredCount > 0 && (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {unassigned.length > 0 && (
        <>
          <SectionHeader label="미배정" count={unassigned.length} />
          {unassigned.map(t => (
            <BacklogTaskRow key={t.id} task={t} members={members} currentTeamId={currentTeamId}
              onToggle={toggleDone} onOpen={openDetail}
              onChangeAssignee={(taskId, userId) => updateTask(taskId, { assigneeId: userId })}
              sortMode={sortMode} />
          ))}
        </>
      )}
      {assigned.length > 0 && (
        <>
          <SectionHeader label="배정됨" count={assigned.length} />
          {assigned.map(t => (
            <BacklogTaskRow key={t.id} task={t} members={members} currentTeamId={currentTeamId}
              onToggle={toggleDone} onOpen={openDetail}
              onChangeAssignee={(taskId, userId) => updateTask(taskId, { assigneeId: userId })}
              sortMode={sortMode} />
          ))}
        </>
      )}
    </div>
  )}

  {/* 인라인 추가 */}
  <div style={{ padding: '4px 8px', borderTop: '0.5px solid #e8e6df' }}>
    <InlineAdd projectId={projectId} category="backlog" color={color}
      extraFields={{ keyMilestoneId: null, assigneeId: null }} />
  </div>
</div>
```

> **SectionHeader**: 내부 컴포넌트
> ```jsx
> function SectionHeader({ label, count }) {
>   return (
>     <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px 4px', color: '#888780', fontSize: 11 }}>
>       <span style={{ fontWeight: 500 }}>{label}</span>
>       <div style={{ flex: 1, height: 0.5, background: '#e8e6df' }} />
>       <span>{count}</span>
>     </div>
>   )
> }
> ```

**커밋**: `feat(project): add BacklogPanel component (9b step 3)`

---

## Step 4: `UnifiedProjectView.jsx` — BacklogPanel 통합

**파일**: `src/components/project/UnifiedProjectView.jsx`

### 변경 1 — import 추가 (파일 상단):
```js
import BacklogPanel from './BacklogPanel'
import useTeamMembers from '../../hooks/useTeamMembers'
```

### 변경 2 — state 추가 (⚠️ 반드시 early return 전에 배치):

> **Hook 순서 규칙**: 기존 파일에 `if (!project) return null` (line ~189) 같은 early return이 있다. 모든 useState/useEffect는 그 **앞**에 위치해야 React 훅 순서 위반이 발생하지 않는다.

기존 store selector들 근처 (line ~55 이후, early return 전)에 추가:
```js
const currentTeamId = useStore(s => s.currentTeamId)

const [members, setMembers] = useState([])
useEffect(() => {
  if (!currentTeamId) { setMembers([]); return }
  useTeamMembers.getMembers(currentTeamId).then(setMembers)
}, [currentTeamId])

const [wideEnough, setWideEnough] = useState(window.innerWidth >= 1024)
useEffect(() => {
  const handler = () => setWideEnough(window.innerWidth >= 1024)
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}, [])
```

### 변경 3 — 레이아웃 변경 (line 227 Content div):

**기존** (line 227):
```jsx
<div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
```

**변경** — flex-row wrapper 추가:
```jsx
<div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
  {/* 메인 콘텐츠 */}
  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
    {rightMode === '전체 할일' && (
      <MsTaskTreeMode
        /* 기존 props 그대로 */
      />
    )}
    {rightMode === '타임라인' && (
      /* 기존 타임라인 코드 그대로 */
    )}
  </div>

  {/* BacklogPanel — hidden prop으로 display:none, mount 유지 */}
  <BacklogPanel
    projectId={projectId}
    projectTasks={projectTasks}
    members={members}
    currentTeamId={currentTeamId}
    color={color}
    hidden={!wideEnough}
  />
</div>
```

**커밋**: `feat(project): integrate BacklogPanel into UnifiedProjectView (9b step 4)`

---

## Step 5: `CompactMilestoneTab.jsx` — BACKLOG_MS 제거 + BacklogPanel 마운트

**파일**: `src/components/project/CompactMilestoneTab.jsx`

### 변경 1 — import 추가:
```js
import BacklogPanel from './BacklogPanel'
```

### 변경 2 — BACKLOG_MS 관련 코드 수정:

**(a) allMsIds에서 `__backlog__` 제거** (line 82):
```diff
-const allMsIds = useMemo(() => [...milestones.map(m => m.id), '__backlog__'], [milestones])
+const allMsIds = useMemo(() => milestones.map(m => m.id), [milestones])
```

**(b) expandedMs에서 `__backlog__` 잔류 정리** — toggleExpandAll 근처에 추가:
```js
// __backlog__가 expandedMs에 남아있을 수 있으므로 제거
useEffect(() => {
  setExpandedMs(prev => {
    if (!prev.has('__backlog__')) return prev
    const n = new Set(prev)
    n.delete('__backlog__')
    return n
  })
}, [])
```

**(c) BACKLOG_MS 상수 제거** (line 202):
```diff
-const BACKLOG_MS = { id: '__backlog__', title: '백로그' }
```

**(d) 백로그 렌더 섹션 제거** (lines 287-303):
```diff
-{/* Backlog */}
-<div style={{ borderTop: '1.5px dashed #e8e6df' }}>
-  <CompactMilestoneRow
-    milestone={BACKLOG_MS}
-    tasks={backlogTasks}
-    ... (전체 제거)
-  />
-</div>
```

**(e) handleDragEnd `__backlog__` 로직 정리** (lines 140-141):
```diff
-const newKeyMilestoneId = (targetMsId === '__backlog__' || targetMsId === null) ? null : targetMsId
-const currentMsId = activeData.sourceMsId === '__backlog__' ? null : activeData.sourceMsId
+const newKeyMilestoneId = targetMsId || null
+const currentMsId = activeData.sourceMsId || null
```

**(f) handleAddTask `__backlog__` 정리** (line 154):
```diff
-const keyMilestoneId = (msId === '__backlog__' || msId === null) ? null : msId
+const keyMilestoneId = msId || null
```

### 변경 3 — 반응형 state 추가:
```js
const [wideEnough, setWideEnough] = useState(window.innerWidth >= 1024)
useEffect(() => {
  const handler = () => setWideEnough(window.innerWidth >= 1024)
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}, [])
```

> CompactMilestoneTab은 9a에서 이미 `members`, `currentTeamId` state가 있음. 추가 불필요.

### 변경 4 — 전체를 flex wrapper로 감싸기:

기존 `return (<div ref={containerRef}><DndContext ...>` 를:
```jsx
return (
  <div style={{ display: 'flex', height: '100%' }}>
    <div ref={containerRef} style={{ flex: 1, overflow: 'auto' }}>
      <DndContext ...>
        {/* 기존 코드 그대로 (BACKLOG 섹션만 제거됨) */}
      </DndContext>
    </div>

    <BacklogPanel
      projectId={projectId}
      projectTasks={projectTasks}
      members={members}
      currentTeamId={currentTeamId}
      color={{ dot: '#888', text: '#888' }}
      hidden={!wideEnough}
    />
  </div>
)
```

> `projectTasks`는 CompactMilestoneTab 내부에서 이미 계산됨 — 확인 필요. 없으면 `useStore(s => s.tasks).filter(t => t.projectId === projectId)` 패턴으로 가져옴.

**커밋**: `refactor(project): remove BACKLOG_MS from CompactMilestoneTab + mount BacklogPanel (9b step 5)`

---

## 작업 순서 요약

| Step | 파일 | 유형 | 의존성 |
|------|------|------|--------|
| 1 | `src/utils/backlogFilter.js` | 신규 | 없음 |
| 2 | `src/components/project/TaskAssigneeChip.jsx` | 신규 | MiniAvatar |
| 3 | `src/components/project/BacklogPanel.jsx` | 신규 | Step 1, 2, InlineAdd |
| 4 | `src/components/project/UnifiedProjectView.jsx` | 추가 | Step 3 |
| 5 | `src/components/project/CompactMilestoneTab.jsx` | 수정 | Step 3 |

---

## 검증 절차

각 Step 커밋 후: `npm run build` 통과

전체 완료 후 — Spec §10 QA 체크리스트:
- §10-1: 표시 (280px 패널, 2-섹션, 카운트 색상, dueDate pill, 빈 상태 + 검색 결과 없음)
- §10-2: 인터랙션 (체크박스, DetailPanel, assignee 변경, 검색, 필터, 정렬)
- §10-3: CompactMilestoneTab 회귀 (DnD task→MS 이동, MS reorder, 인라인 추가)
- §10-4: 매트릭스 ↔ 백로그 동기화
- §10-5: 반응형 (display:none, mount 유지, state 보존) + 빌드

---

## Review

### Adversarial Review (v1 → v2 반영)

**판정**: CONDITIONAL PASS

**v1 Critical 해결**:
- [C1] Hook 순서 → early return 전 배치 명시 ✓
- [C2] BACKLOG_MS DnD → `__backlog__` → null 치환 + 로직 정리 ✓
- [C3] expandedMs 잔류 → cleanup useEffect 추가 ✓
- [C4] InlineAdd assigneeId → extraFields에 `assigneeId: null` 추가 ✓

**잔여 Warning**:
- [W3] getMembers race condition: 기존 9a 패턴과 동일하므로 9b 범위에서는 미처리 (별도 이슈)
- [I1] CompactMilestoneTab의 BacklogPanel color 하드코딩: project color 접근이 어려우므로 `{ dot: '#888', text: '#888' }` 유지. 추후 개선 가능

**권장**: Step 5 구현 시 `projectTasks` 변수가 CompactMilestoneTab 내부에 존재하는지 확인 필요. 없으면 store에서 직접 가져와야 함.
