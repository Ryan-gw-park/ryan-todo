# Loop-26.4 — Tasks 탭 (목록 / 아웃라이너 / 타임라인)

## 목표
프로젝트 레이어의 **Tasks 탭** 구현. 3가지 뷰 모드:
- **목록**: 시간 그룹(오늘/이번 주/다음 주) 리스트
- **아웃라이너**: 기존 ProjectView의 Workflowy 스타일 뷰 **그대로 재사용**
- **타임라인**: 프로젝트 Task 간트

---

## 전제 조건
- Loop-26.3 완료 (Reference 탭 동작, tasks.deliverable_id 매핑)
- Loop-26.2 완료 (TasksTab 빈 상태, 모드 바 동작)

---

## ★ 최우선 원칙 ★

**아웃라이너 모드는 기존 코드를 그대로 사용한다.**

기존 `ProjectView.jsx`에 구현된:
- `OutlinerTaskNode` (309-418 lines) — 드래그 핸들, 체크박스, 제목, 노트 토글, 펼침/접힘
- `CategorySection` (190-307 lines) — 카테고리별 DnD 컨텍스트, SortableContext
- `TaskKeyboardNav` — ↑↓ 이동, Enter 상세 열기, Escape 선택 해제
- `TaskOutliner` — OutlinerEditor를 감싸는 래퍼 (노트 저장 연동)
- `OutlinerEditor.jsx` (shared) — 불릿포인트 아웃라이너 에디터
- `useOutliner.js` — 키보드/포커스 로직 (Shift+방향키 블록 지정, Alt+Tab 부모 이동 시 자식 동반 등)

이 모든 컴포넌트와 훅의 **내부 코드를 한 줄도 수정하지 않는다.**
아웃라이너 모드에서는 이들을 import하여 조합한다.

---

## 영향받는 파일

### 수정 대상
| 파일 | 변경 | 규모 |
|------|------|------|
| `src/components/project/TasksTab.jsx` | 임시 → 3모드 실제 구현 | L |

### 신규 생성
| 파일 | 역할 |
|------|------|
| `src/components/project/tasks/TaskListMode.jsx` | 목록 모드 |
| `src/components/project/tasks/TaskOutlinerMode.jsx` | 아웃라이너 모드 (기존 컴포넌트 조합) |
| `src/components/project/tasks/TaskTimelineMode.jsx` | 간트 모드 |

### 수정 금지 ★★★
- `src/components/views/ProjectView.jsx` — 내부 절대 수정 금지
- `src/components/shared/OutlinerEditor.jsx` — 절대 수정 금지
- `src/components/shared/OutlinerRow.jsx` — 절대 수정 금지
- `src/hooks/useOutliner.js` — 절대 수정 금지
- `src/utils/notes.js` — 절대 수정 금지
- `src/hooks/useStore.js` — 기존 액션 수정 금지 (신규 추가만 허용)

---

## TasksTab.jsx

```jsx
// src/components/project/TasksTab.jsx
import TaskListMode from './tasks/TaskListMode'
import TaskOutlinerMode from './tasks/TaskOutlinerMode'
import TaskTimelineMode from './tasks/TaskTimelineMode'

export default function TasksTab({ projectId, mode }) {
  switch (mode) {
    case 'list': return <TaskListMode projectId={projectId} />
    case 'outliner': return <TaskOutlinerMode projectId={projectId} />
    case 'timeline': return <TaskTimelineMode projectId={projectId} />
    default: return <TaskListMode projectId={projectId} />
  }
}
```

---

## 1. TaskListMode.jsx (목록 모드)

### Reference 요약 바

```jsx
function RefSummaryBar({ projectId }) {
  // ref_milestones에서 가장 가까운 마일스톤 조회
  const [nextMs, setNextMs] = useState(null)
  const [unlinkedCount, setUnlinkedCount] = useState(0)

  useEffect(() => {
    // Supabase 직접 호출 (경량)
    loadNextMilestone(projectId).then(setNextMs)
    loadUnlinkedDeliverableCount(projectId).then(setUnlinkedCount)
  }, [projectId])

  if (!nextMs) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '9px 22px', background: '#fafaf8',
      borderBottom: '0.5px solid #e8e6df', fontSize: 11, color: '#a09f99',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#BA7517' }} />
        <span>다음 마일스톤:</span>
        <span style={{ fontWeight: 600, color: '#2C2C2A', fontSize: 12 }}>
          {nextMs.title} — {formatDate(nextMs.end_date)}
        </span>
        <span style={{ color: '#BA7517', fontWeight: 600 }}>
          (D{daysUntil(nextMs.end_date)})
        </span>
      </div>
      {unlinkedCount > 0 && (
        <div style={{ marginLeft: 'auto' }}>
          <span style={{ background: '#FAEEDA', color: '#854F0B', fontSize: 10, padding: '2px 8px', borderRadius: 3, fontWeight: 500 }}>
            미연결 결과물 {unlinkedCount}건
          </span>
        </div>
      )}
    </div>
  )
}
```

### Task 목록 (시간 그룹)

```jsx
function TaskListMode({ projectId }) {
  const tasks = useStore(s =>
    s.tasks.filter(t => t.projectId === projectId && !t.deletedAt)
  )
  const { detailTask, setDetailTask } = useStore()

  // 시간 그룹 분류
  const today = tasks.filter(t => t.category === 'today' && !t.done)
  const next = tasks.filter(t => t.category === 'next' && !t.done)
  const backlog = tasks.filter(t => t.category === 'backlog' && !t.done)
  const done = tasks.filter(t => t.done)

  return (
    <div>
      <RefSummaryBar projectId={projectId} />

      <TaskGroup label="🔥 오늘 할일" tasks={today} />
      <TaskGroup label="📌 다음 할일" tasks={next} />
      <TaskGroup label="📋 남은 할일" tasks={backlog} />
      {done.length > 0 && <TaskGroup label="✅ 완료" tasks={done} collapsed />}
    </div>
  )
}

function TaskGroup({ label, tasks, collapsed }) {
  const [open, setOpen] = useState(!collapsed)

  return (
    <div style={{ padding: '16px 22px 6px' }}>
      <div onClick={() => setOpen(!open)} style={{ fontSize: 12, fontWeight: 600, color: '#6b6a66', cursor: 'pointer', marginBottom: 8 }}>
        {label} <span style={{ color: '#b4b2a9', fontWeight: 400 }}>{tasks.length}</span>
      </div>
      {open && tasks.map(t => <TaskListRow key={t.id} task={t} />)}
    </div>
  )
}
```

### TaskListRow (결과물 태그 포함)

```jsx
function TaskListRow({ task }) {
  const { toggleDone, setDetailTask } = useStore()
  const deliverable = useDeliverableName(task.deliverableId) // 결과물 이름 조회

  return (
    <div
      onClick={() => setDetailTask(task)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', cursor: 'pointer' }}
    >
      <CheckBox done={task.done} onClick={(e) => { e.stopPropagation(); toggleDone(task.id) }} />
      <span style={{ flex: 1, fontSize: 13, textDecoration: task.done ? 'line-through' : 'none', color: task.done ? '#b4b2a9' : '#2C2C2A' }}>
        {task.text}
      </span>

      {/* 결과물 태그 (선택적) */}
      {deliverable && (
        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 3, border: '0.5px solid #e8e6df', color: '#a09f99', background: '#fafaf8', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {deliverable}
        </span>
      )}

      <AssigneePill assigneeId={task.assigneeId} />
      <span style={{ fontSize: 11, color: '#b4b2a9', minWidth: 30, textAlign: 'right' }}>
        {formatShortDate(task.dueDate)}
      </span>
    </div>
  )
}
```

### useDeliverableName 훅

```javascript
// 결과물 ID → 이름 조회 (경량)
function useDeliverableName(deliverableId) {
  const [name, setName] = useState(null)
  useEffect(() => {
    if (!deliverableId) return
    getDb().from('ref_deliverables').select('title').eq('id', deliverableId).single()
      .then(({ data }) => setName(data?.title || null))
  }, [deliverableId])
  return name
}
```

---

## 2. TaskOutlinerMode.jsx ★ (기존 코드 재사용)

### 핵심: ProjectView의 내부 구조를 그대로 조합

```jsx
// src/components/project/tasks/TaskOutlinerMode.jsx
import useStore from '../../../hooks/useStore'

/**
 * ★★★ 구현 방법 ★★★
 *
 * ProjectView.jsx(663 lines) 내부에 정의된 컴포넌트들:
 * - OutlinerTaskNode (309-418)
 * - CategorySection (190-307)
 * - TaskKeyboardNav
 *
 * 이들은 현재 ProjectView.jsx 파일 안에 로컬 함수로 정의되어 있다.
 * 직접 import할 수 없다.
 *
 * [접근법 A — 권장]
 * ProjectView 자체를 렌더링하되, 프로젝트 필터를 미리 설정한다.
 *
 * ProjectView는 내부에서 useProjectFilter 또는 store의 projectFilter를 읽어서
 * 프로젝트 탭을 필터링한다. 따라서:
 * 1. store에서 현재 selectedProjectId에 해당하는 프로젝트 탭을 활성화
 * 2. ProjectView를 그대로 렌더링
 * 3. ProjectView의 상단 헤더("프로젝트" 타이틀 + 프로젝트 탭바)만 숨김 처리
 *
 * [접근법 B — 리팩토링 필요 시]
 * ProjectView 내부 컴포넌트를 별도 파일로 추출한다.
 * 단, 이 경우에도 내부 로직은 한 줄도 변경하지 않는다.
 * 파일 분리만 수행.
 *
 * ★ Claude Code에게:
 * 먼저 접근법 A를 시도하라.
 * ProjectView.jsx 코드를 읽고, 프로젝트 필터를 외부에서 제어할 수 있는지 확인.
 * ProjectView가 props로 projectId를 받을 수 있다면 가장 이상적.
 * 불가능하다면 접근법 B로 전환하되, 아래 규칙을 엄수:
 *
 * [접근법 B 규칙]
 * 1. ProjectView.jsx에서 OutlinerTaskNode, CategorySection, TaskKeyboardNav를
 *    별도 파일로 추출 (src/components/project/tasks/ 하위)
 * 2. 추출 시 함수 시그니처, 내부 로직, 스타일 일절 변경 금지
 * 3. 추출 후 ProjectView.jsx는 추출된 컴포넌트를 import하여 기존과 동일하게 동작
 * 4. 추출된 컴포넌트를 TaskOutlinerMode에서도 import하여 사용
 * 5. ProjectView 회귀 테스트 필수: 모든 키보드 단축키, DnD, 노트 편집이 기존과 100% 동일하게 동작해야 함
 */

export default function TaskOutlinerMode({ projectId }) {
  // 접근법에 따라 구현이 달라짐 — Claude Code가 코드를 읽고 결정

  // 접근법 A 예시:
  // return <ProjectViewWithFilter projectId={projectId} hideHeader />

  // 접근법 B 예시:
  // return (
  //   <div>
  //     {CATEGORIES.filter(c => c.key !== 'done').map(cat => (
  //       <CategorySection
  //         key={cat.key}
  //         category={cat}
  //         tasks={tasks.filter(t => t.category === cat.key)}
  //         projectId={projectId}
  //         color={projectColor}
  //       />
  //     ))}
  //     <TaskKeyboardNav tasks={allTasks} />
  //   </div>
  // )

  return <div style={{ padding: 40, color: '#b4b2a9' }}>
    아웃라이너 모드 — 구현 시 위 주석의 접근법 A 또는 B 적용
  </div>
}
```

> **이 파일의 구현은 Claude Code가 ProjectView.jsx를 직접 읽고 판단한다.**
> 작업 지시서에서 정확한 코드를 제공하는 것이 아니라, **접근 전략과 제약 조건**을 명확히 한다.

### 필수 보존 목록 (아웃라이너 모드에서 반드시 동작해야 하는 것들)

- [ ] ↑↓ 키보드 탐색
- [ ] Enter → 상세패널(DetailPanel) 열기
- [ ] Escape → 선택 해제
- [ ] Tab / Shift+Tab → 노트 레벨 변경
- [ ] Shift+↑↓ → 블록 지정
- [ ] Alt+Tab → 부모 노드 이동 시 자식 동반
- [ ] 드래그앤드롭 순서 변경
- [ ] 노트 펼침/접힘 토글
- [ ] 노트 인라인 편집 + blur 시 자동 저장
- [ ] 완료 체크 → 카테고리 이동
- [ ] InlineAdd (+ 추가) 동작
- [ ] 카테고리 섹션 접기/펼치기

---

## 3. TaskTimelineMode.jsx (간트 모드)

### 접근법: 기존 TimelineView 참조하되 독립 구현

```jsx
// src/components/project/tasks/TaskTimelineMode.jsx
export default function TaskTimelineMode({ projectId }) {
  const tasks = useStore(s =>
    s.tasks.filter(t => t.projectId === projectId && !t.deletedAt && !t.done)
  )

  // 간트 컬럼 생성 (주 단위)
  const columns = generateWeekColumns() // 현재 기준 ±2개월

  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <GanttHeader columns={columns} />
        <tbody>
          {tasks.map(t => (
            <GanttTaskRow key={t.id} task={t} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

> **기존 TimelineView.jsx를 수정하지 않는다.**
> TaskTimelineMode는 단일 프로젝트 Task만 간트로 보여주는 경량 버전.
> TimelineView의 복잡한 DnD/리사이즈/멀티 프로젝트 기능은 포함하지 않는다.
> 날짜 계산은 `tasks.start_date` ~ `tasks.due_date` 범위로 바 표시.
> start_date 없으면 due_date만으로 1주 폭 바 표시.

### 간트 바 계산

```javascript
function calcBar(task, columns) {
  const start = task.startDate || task.dueDate
  const end = task.dueDate || task.startDate
  if (!start && !end) return null // 날짜 없는 Task는 하단 목록으로

  const startCol = columns.findIndex(c => isDateInWeek(start, c.weekStart))
  const endCol = columns.findIndex(c => isDateInWeek(end, c.weekStart))
  const left = (startCol / columns.length) * 100
  const width = (Math.max(1, endCol - startCol + 1) / columns.length) * 100
  return { left, width }
}
```

---

## 검증 체크리스트

### 목록 모드
- [ ] Reference 요약 바 표시 (다음 마일스톤 + 미연결 결과물 수)
- [ ] 오늘/다음/남은/완료 그룹 정상
- [ ] Task 클릭 → DetailPanel 열기
- [ ] 결과물 태그 표시 (deliverableId 있는 Task)
- [ ] 담당자, 날짜 표시

### 아웃라이너 모드 ★★★
- [ ] 기존 ProjectView와 **100% 동일한 동작** (아래 전항목 확인)
- [ ] ↑↓ 키보드 탐색
- [ ] Enter → DetailPanel 열기
- [ ] Tab/Shift+Tab 노트 레벨 변경
- [ ] Shift+↑↓ 블록 지정
- [ ] Alt+Tab 부모+자식 동반 이동
- [ ] 드래그앤드롭 순서 변경
- [ ] 노트 펼침/접힘
- [ ] 노트 인라인 편집 + 자동 저장
- [ ] DetailPanel 노트와 동일 데이터 연동 확인
- [ ] 완료 체크 → done 카테고리 이동
- [ ] InlineAdd 동작

### 타임라인 모드
- [ ] 프로젝트 Task 간트 바 표시
- [ ] 날짜 있는 Task만 바 표시
- [ ] 오늘 기준선
- [ ] 담당자 표시

### 회귀 검증
- [ ] 기존 글로벌 ProjectView 정상 동작 (사이드바에서 글로벌 뷰 진입 시)
- [ ] DetailPanel 정상
- [ ] 기존 글로벌 뷰 전체 정상
- [ ] `npm run build` 성공

---

## 주의사항

- **아웃라이너 모드가 이 Loop의 핵심이자 최대 리스크.** 기존 컴포넌트 재사용이 매끄럽지 않으면 가장 많은 시간이 소요됨. 접근법 A/B 판단을 우선 수행하고, 어느 쪽이든 기존 로직 변경은 절대 금지.
- **TaskListRow에서 DetailPanel 열기**: `setDetailTask(task)` 호출. 기존 패턴 그대로.
- **결과물 태그 선택 UI는 이 Loop에서 구현하지 않음.** DetailPanel에 deliverable_id 선택 드롭다운을 추가하는 것은 별도 서브 Loop 또는 26.5 이후.
