# Loop-26.4 — Tasks 탭 (마일스톤 기반 아웃라이너) + 정렬 연동 + 탭 이름 변경

## 목표

1. **Reference 탭 이름을 "Key Milestone"으로 변경**
2. **Key Milestone 탭의 우측 Task 영역에서 Task DnD 순서 변경** 가능하게 구현
3. **Tasks 탭을 마일스톤별 섹션 아웃라이너 단일 뷰로 구현** (모드 바 없음)
4. **마일스톤 sort_order와 Task sort_order가 세 탭(Key Milestone / Tasks / 병렬 보기) 전체에 일관 적용**

---

## 전제 조건

- Loop-26.3 완료 (Key Milestone 탭 동작, 마일스톤 DnD 순서 변경 동작)
- 기존 ProjectView의 아웃라이너 컴포넌트(OutlinerTaskNode, CategorySection, OutlinerEditor, useOutliner) 정상 동작

---

## ★ 최우선 원칙 ★

1. **사용자 배치 순서 > 날짜 순서.** 마일스톤과 Task 모두 `sort_order` 기준 정렬. 시작일/종료일은 참고 정보일 뿐.
2. **기존 아웃라이너 코드 수정 금지.** OutlinerEditor, OutlinerRow, useOutliner, notes.js 내부 로직 한 줄도 변경하지 않는다.
3. **Tasks 탭의 아웃라이너는 기존 ProjectView 내부 컴포넌트를 재사용.** 접근법 B(파일 분리)로 추출된 OutlinerTaskNode, CategorySection을 import하여 조합한다.

---

## 1. 탭 이름 변경

### ProjectHeader.jsx

```javascript
// Before
const TABS = [
  { key: 'ref', label: 'Reference' },
  { key: 'tasks', label: 'Tasks', badge: ... },
  { key: 'parallel', label: '병렬 보기', ... },
]

// After
const TABS = [
  { key: 'ref', label: 'Key Milestone' },
  { key: 'tasks', label: 'Tasks', badge: ... },
  { key: 'parallel', label: '병렬 보기', ... },
]
```

### 관련 파일 전체 검색
"Reference" 텍스트가 하드코딩된 곳을 모두 찾아서 "Key Milestone"으로 변경.  
단, 코드 내 변수명/함수명(ReferenceTab, useProjectReference 등)은 **변경하지 않는다.** UI 레이블만 변경.

---

## 2. Key Milestone 탭 — Task DnD 순서 변경

### 현재 상태
우측 Task 목록에서 순서 변경 불가. Task가 추가된 순서대로만 표시.

### 변경 후
우측 Task 목록에서 **@dnd-kit으로 상하 드래그 순서 변경** 가능.  
변경된 순서는 `tasks.sort_order`에 저장.

### 구현

```jsx
// ReferenceTab.jsx 우측 Task 영역
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'

function MilestoneTaskPanel({ milestoneId, projectId }) {
  const tasks = useStore(s =>
    s.tasks
      .filter(t => t.refMilestoneId === milestoneId && !t.deletedAt)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  )
  const { reorderTasks } = useStore()

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = tasks.findIndex(t => t.id === active.id)
    const newIndex = tasks.findIndex(t => t.id === over.id)
    const reordered = arrayMove(tasks, oldIndex, newIndex)

    // sort_order 업데이트 (기존 store의 reorderTasks 활용)
    reorderTasks(reordered.map((t, i) => ({ ...t, sortOrder: i })))
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map(task => (
          <SortableTaskRow key={task.id} task={task} />
        ))}
      </SortableContext>
      <AddTaskButton milestoneId={milestoneId} projectId={projectId} />
    </DndContext>
  )
}

function SortableTaskRow({ task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  const { toggleDone, setDetailTask, deleteTask } = useStore()

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '3px 4px', borderRadius: 4, cursor: 'pointer',
      }}
        onClick={() => setDetailTask(task)}
      >
        {/* 드래그 핸들 */}
        <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#c2c0b6', fontSize: 10, flexShrink: 0 }}>
          ⠿
        </div>
        <div
          className={`tk-cb ${task.done ? 'dn' : ''}`}
          onClick={e => { e.stopPropagation(); toggleDone(task.id) }}
        />
        <input
          value={task.text}
          onChange={e => { /* 인라인 편집 */ }}
          onClick={e => e.stopPropagation()}
          style={{ flex: 1, fontSize: 12, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit' }}
          placeholder="Task 이름 입력..."
        />
        {/* 담당자 */}
        {/* 삭제 버튼 */}
      </div>
    </div>
  )
}
```

### 드래그 핸들
Task 행 왼쪽에 `⠿` 그립 아이콘. hover 시 grab 커서.

### 정렬 기준
```javascript
// 모든 곳에서 Task를 표시할 때 sort_order 기준 정렬
tasks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
```

---

## 3. Tasks 탭 — 마일스톤 기반 아웃라이너

### 탭 구조

모드 바 **없음**. 탭 클릭 시 바로 아웃라이너 표시.

```jsx
// src/components/project/TasksTab.jsx
export default function TasksTab({ projectId }) {
  // 모드 바 제거 — 단일 뷰
  return <MilestoneOutlinerView projectId={projectId} />
}
```

### ProjectLayer.jsx에서 모드 바 제거

```jsx
// Before
{tab === 'tasks' && (
  <ModeBar
    modes={[
      { key: 'list', label: '목록' },
      { key: 'outliner', label: '아웃라이너' },
      { key: 'timeline', label: '타임라인' },
    ]}
    ...
  />
)}

// After
// Tasks 탭 모드 바 완전 제거
// 병렬 보기 모드 바만 유지
```

### useStore.js 정리

```javascript
// 제거 가능
// projectLayerTaskMode 상태 및 setProjectLayerTaskMode 액션 제거
// (Tasks 탭에 모드가 없으므로 불필요)
```

---

### MilestoneOutlinerView 전체 구조

```
MilestoneOutlinerView
│
├── [마일스톤 섹션] ● 소집통지 발송 완료  (03.10→03.20 D-5)  ▼ 접기
│   ├── OutlinerTaskNode (기존 ProjectView 컴포넌트 재사용)
│   │   ├── □ 소집통지 메일 발송          Ethan  3/14
│   │   │   ├── • 1% 이상 주주 56명 개별 발송
│   │   │   ├── • 이사회 결의문 첨부 필수
│   │   │   └── + 추가
│   │   └── (접힌 노트)
│   ├── OutlinerTaskNode
│   │   └── □ 1% 이상 주주 연락          Ethan  3/16
│   └── + 할일 추가
│
├── [마일스톤 섹션] ● 안건자료 확정  (03.12→03.21 D-6)  ▼ 접기
│   ├── OutlinerTaskNode
│   │   └── □ 안건 PPT 작성              Ryan   3/14
│   │       ├── • 개회선언
│   │       ├── • 출석 주주 및 주식 수 보고
│   │       ├── ▷ 보고
│   │       ├── ▷ 안건
│   │       └── + 추가
│   └── + 할일 추가
│
├── ... (마일스톤 sort_order 순서대로)
│
└── [미연결 Task 섹션] 📋 기타 할일  ▼ 접기
    ├── OutlinerTaskNode
    │   └── □ 공동행사약정서 초안          Ryan   3/15
    ├── OutlinerTaskNode
    │   └── □ 소집 공고 초안              Ash    3/17
    └── + 할일 추가
```

---

### MilestoneOutlinerView.jsx 구현

```jsx
// src/components/project/tasks/MilestoneOutlinerView.jsx
import useStore from '../../../hooks/useStore'
import { useRefMilestones } from '../../../hooks/useRefMilestones'
import { useProjectReference } from '../../../hooks/useProjectReference'

export default function MilestoneOutlinerView({ projectId }) {
  const { reference } = useProjectReference(projectId)
  const { milestones } = useRefMilestones(reference?.id, projectId)

  const allTasks = useStore(s =>
    s.tasks.filter(t => t.projectId === projectId && !t.deletedAt)
  )

  // 마일스톤별 Task 그룹핑
  const milestoneTaskGroups = milestones.map(ms => ({
    milestone: ms,
    tasks: allTasks
      .filter(t => t.refMilestoneId === ms.id)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
  }))

  // 미연결 Task (refMilestoneId가 null)
  const unlinkedTasks = allTasks
    .filter(t => !t.refMilestoneId)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

  return (
    <div style={{ padding: '0 0 40px', overflow: 'auto' }}>
      {/* 마일스톤별 섹션 — sort_order 순서 */}
      {milestoneTaskGroups.map(({ milestone, tasks }) => (
        <MilestoneSection
          key={milestone.id}
          milestone={milestone}
          tasks={tasks}
          projectId={projectId}
        />
      ))}

      {/* 미연결 Task 섹션 */}
      {unlinkedTasks.length > 0 && (
        <UnlinkedSection
          tasks={unlinkedTasks}
          projectId={projectId}
        />
      )}
    </div>
  )
}
```

---

### MilestoneSection (고정 헤더 + 아웃라이너)

```jsx
function MilestoneSection({ milestone, tasks, projectId }) {
  const [collapsed, setCollapsed] = useState(false)
  const { addTask, setDetailTask } = useStore()

  async function handleAddTask() {
    const taskId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
    const newTask = {
      id: taskId,
      text: '',
      projectId: projectId,
      refMilestoneId: milestone.id,
      category: 'today',
      sortOrder: Date.now(),
    }
    await addTask(newTask)
    const created = useStore.getState().tasks.find(t => t.id === taskId)
    if (created) setDetailTask(created)
  }

  return (
    <div style={{ borderBottom: '0.5px solid #eeedea' }}>
      {/* ── 마일스톤 헤더 (아웃라이너 노드 아님, 고정 헤더) ── */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 20px 8px', cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{
          width: 9, height: 9, borderRadius: '50%',
          background: milestone.color || '#1D9E75', flexShrink: 0,
        }} />
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
          {milestone.title}
        </span>
        {/* 날짜 (축약형) */}
        {milestone.start_date && (
          <span style={{ fontSize: 11, color: '#a09f99' }}>
            {formatShort(milestone.start_date)} → {formatShort(milestone.end_date)}
          </span>
        )}
        {milestone.end_date && (
          <span style={{
            fontSize: 10, fontWeight: 500,
            color: isUrgent(milestone.end_date) ? '#BA7517' : '#b4b2a9',
          }}>
            D{daysUntil(milestone.end_date)}
          </span>
        )}
        <span style={{ fontSize: 12, color: '#b4b2a9', transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }}>
          ▾
        </span>
      </div>

      {/* ── 아웃라이너 영역 (기존 컴포넌트 재사용) ── */}
      {!collapsed && (
        <div style={{ padding: '0 20px 12px 38px' }}>
          {/*
            ★★★ 핵심: 기존 ProjectView의 OutlinerTaskNode를 그대로 사용 ★★★

            OutlinerTaskNode는 다음을 포함:
            - 드래그 핸들 + 체크박스 + 제목 + 날짜
            - 노트 토글 (접기/펼치기)
            - 펼쳤을 때 OutlinerEditor (기존 아웃라이너)
            - 담당자 표시

            모든 키보드 단축키가 그대로 동작:
            - ↑↓ 키보드 탐색
            - Enter → 상세패널 열기
            - Shift+↑↓ 블록 지정
            - Alt+Tab 부모+자식 동반 이동
            - Tab/Shift+Tab 노트 레벨 변경
          */}

          <DndContext collisionDetection={closestCenter} onDragEnd={handleTaskDragEnd}>
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {tasks.map(task => (
                <OutlinerTaskNode
                  key={task.id}
                  task={task}
                  color={getColor(/* project color */)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* 할일 추가 */}
          <div
            onClick={handleAddTask}
            style={{ padding: '6px 0', fontSize: 12, color: '#b4b2a9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            + 할일 추가
          </div>
        </div>
      )}
    </div>
  )
}
```

### Task DnD 순서 변경

```javascript
function handleTaskDragEnd(event) {
  const { active, over } = event
  if (!over || active.id === over.id) return

  const oldIndex = tasks.findIndex(t => t.id === active.id)
  const newIndex = tasks.findIndex(t => t.id === over.id)
  const reordered = arrayMove(tasks, oldIndex, newIndex)

  // 기존 store의 reorderTasks 사용
  reorderTasks(reordered.map((t, i) => ({ ...t, sortOrder: i })))
}
```

> **기존 `reorderTasks` 액션을 그대로 사용.** 시그니처 변경 없음.

---

### UnlinkedSection (미연결 Task)

`refMilestoneId`가 null인 Task들. 기존에 마일스톤 기능 도입 전에 만들어진 Task, 또는 아직 마일스톤에 배정되지 않은 Task.

```jsx
function UnlinkedSection({ tasks, projectId }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ borderBottom: '0.5px solid #eeedea' }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 20px 8px', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 13 }}>📋</span>
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>기타 할일</span>
        <span style={{ fontSize: 11, color: '#b4b2a9' }}>{tasks.length}건</span>
        <span style={{ fontSize: 12, color: '#b4b2a9', transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }}>▾</span>
      </div>

      {!collapsed && (
        <div style={{ padding: '0 20px 12px 38px' }}>
          <DndContext ...>
            <SortableContext ...>
              {tasks.map(task => (
                <OutlinerTaskNode key={task.id} task={task} ... />
              ))}
            </SortableContext>
          </DndContext>
          <div onClick={handleAddUnlinkedTask} style={{ /* + 할일 추가 */ }}>
            + 할일 추가
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## 4. 아웃라이너 컴포넌트 재사용 전략

### 접근법 B (파일 분리) — 승인됨

ProjectView.jsx(663 lines) 내부의 로컬 컴포넌트를 별도 파일로 추출:

| 추출 대상 | 현재 위치 | 추출 위치 |
|----------|----------|----------|
| OutlinerTaskNode | ProjectView.jsx 309-418 lines | `src/components/shared/OutlinerTaskNode.jsx` |
| CategorySection | ProjectView.jsx 190-307 lines | (Tasks 탭에서 사용하지 않음 — 마일스톤 섹션으로 대체) |
| TaskKeyboardNav | ProjectView.jsx 내부 | `src/components/shared/TaskKeyboardNav.jsx` |

### 추출 규칙

1. **내부 로직 한 줄도 변경하지 않는다.** 파일 분리만 수행.
2. 추출 후 **ProjectView.jsx는 추출된 컴포넌트를 import**하여 기존과 100% 동일하게 동작.
3. **추출 전 ProjectView의 회귀 테스트 필수** — 모든 키보드 단축키, DnD, 노트 편집 확인.
4. 추출 후 Tasks 탭의 MilestoneOutlinerView에서 동일 컴포넌트를 import하여 사용.

### OutlinerTaskNode 사용 방법

```jsx
// MilestoneOutlinerView에서
import OutlinerTaskNode from '../../shared/OutlinerTaskNode'

// OutlinerTaskNode가 기대하는 props 확인 후 동일하게 전달
<OutlinerTaskNode
  task={task}
  color={projectColor}
  isDragging={isDragging}
  isSelected={selectedTaskId === task.id}
/>
```

> **Claude Code에게:** OutlinerTaskNode의 정확한 props 인터페이스를 ProjectView.jsx에서 확인하고,
> MilestoneSection에서 동일하게 전달하라. props가 부족하면 기본값을 전달하되, OutlinerTaskNode 내부는 수정하지 않는다.

### TaskKeyboardNav 사용 방법

```jsx
// MilestoneOutlinerView 하단에
import TaskKeyboardNav from '../../shared/TaskKeyboardNav'

// 전체 Task 목록을 flat으로 전달
const allVisibleTasks = milestoneTaskGroups.flatMap(g => g.tasks).concat(unlinkedTasks)
<TaskKeyboardNav tasks={allVisibleTasks} />
```

> 마일스톤 섹션 사이를 ↑↓ 키로 자연스럽게 넘나들 수 있도록 전체 Task를 flat 배열로 전달.

---

## 5. 정렬 일관성 보장

### 세 탭의 마일스톤 순서

| 탭 | 정렬 기준 |
|---|---|
| Key Milestone | `ref_milestones.sort_order` ASC (DnD로 변경) |
| Tasks | `ref_milestones.sort_order` ASC (동일) |
| 병렬 보기 | `ref_milestones.sort_order` ASC (동일) |

### 세 탭의 Task 순서 (마일스톤 내)

| 탭 | 정렬 기준 |
|---|---|
| Key Milestone 우측 | `tasks.sort_order` ASC (DnD로 변경) |
| Tasks 아웃라이너 | `tasks.sort_order` ASC (동일) |
| 병렬 보기 | `tasks.sort_order` ASC (동일) |

### 정렬 헬퍼

```javascript
// 공통으로 사용
function sortByOrder(items) {
  return [...items].sort((a, b) => (a.sortOrder || a.sort_order || 0) - (b.sortOrder || b.sort_order || 0))
}
```

---

## 6. useStore.js 변경 사항 (최종)

### 추가/수정

```javascript
// state 추가 (26.2에서 이미 추가된 것 중 제거)
// projectLayerTaskMode ← 제거 (모드 없으므로)
// setProjectLayerTaskMode ← 제거

// mapTask 최종 형태
function mapTask(r) {
  return {
    // ... 기존 필드 모두 유지 ...
    refMilestoneId: r.ref_milestone_id || null,
    // deliverableId 제거 (사용하지 않음)
  }
}

// taskToRow 최종 형태
function taskToRow(t) {
  return {
    // ... 기존 필드 모두 유지 ...
    ref_milestone_id: t.refMilestoneId || null,
    // deliverable_id 제거 (사용하지 않음)
  }
}
```

---

## 영향받는 파일

### 수정 대상

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/components/project/ProjectHeader.jsx` | "Reference" → "Key Milestone" | S |
| `src/components/project/ProjectLayer.jsx` | Tasks 탭 모드 바 제거, projectLayerTaskMode 제거 | S |
| `src/components/project/TasksTab.jsx` | 모드 분기 제거 → MilestoneOutlinerView 단일 렌더링 | S |
| `src/components/project/ReferenceTab.jsx` | 우측 Task DnD 순서 변경 추가 | M |
| `src/components/views/ProjectView.jsx` | OutlinerTaskNode, TaskKeyboardNav 추출 (파일 분리) | M |
| `src/hooks/useStore.js` | projectLayerTaskMode 제거, mapTask/taskToRow 정리 | S |

### 신규 생성

| 파일 | 역할 |
|------|------|
| `src/components/project/tasks/MilestoneOutlinerView.jsx` | 마일스톤별 아웃라이너 뷰 |
| `src/components/shared/OutlinerTaskNode.jsx` | ProjectView에서 추출 |
| `src/components/shared/TaskKeyboardNav.jsx` | ProjectView에서 추출 |

### 삭제

| 파일 | 사유 |
|------|------|
| `src/components/project/tasks/TaskListMode.jsx` | Tasks 탭 모드 제거 |
| `src/components/project/tasks/TaskTimelineMode.jsx` | Tasks 탭 모드 제거 |

### 수정 금지

- `src/components/shared/OutlinerEditor.jsx`
- `src/components/shared/OutlinerRow.jsx`
- `src/hooks/useOutliner.js`
- `src/utils/notes.js`
- 기존 store 액션 시그니처 (addTask, updateTask, deleteTask, toggleDone, reorderTasks)

---

## 검증 체크리스트

### 탭 이름
- [ ] "Reference" → "Key Milestone" 변경 확인
- [ ] 모든 UI에서 "Reference" 텍스트 미노출 확인

### Key Milestone 탭 Task DnD
- [ ] 우측 Task 드래그 순서 변경 가능
- [ ] 변경 후 새로고침해도 순서 유지 (sort_order DB 저장)
- [ ] 드래그 중 시각적 피드백 (opacity 변화)
- [ ] 드래그 핸들(⠿) 표시

### Tasks 탭 아웃라이너
- [ ] 마일스톤별 섹션 헤더 표시 (닷 + 이름 + 날짜 + D-day)
- [ ] 섹션 순서 = 마일스톤 sort_order (사용자 배치 순서)
- [ ] 섹션 접기/펼치기 동작
- [ ] Task 순서 = tasks.sort_order (Key Milestone에서 배치한 순서)
- [ ] 미연결 Task "기타 할일" 섹션 표시
- [ ] + 할일 추가 → Task 생성 + **상세패널 자동 열기**
- [ ] 모드 바 미표시 확인 (단일 뷰)

### 아웃라이너 기능 보존 ★★★
- [ ] ↑↓ 키보드 탐색 (마일스톤 섹션 사이도 이동)
- [ ] Enter → 상세패널(DetailPanel) 열기
- [ ] Escape → 선택 해제
- [ ] Tab / Shift+Tab → 노트 레벨 변경
- [ ] Shift+↑↓ → 블록 지정
- [ ] Alt+Tab → 부모 노드 이동 시 자식 동반
- [ ] 드래그앤드롭 Task 순서 변경
- [ ] 노트 펼침/접힘 토글
- [ ] 노트 인라인 편집 + blur 시 자동 저장
- [ ] 상세패널 노트와 동일 데이터 연동
- [ ] 완료 체크 → done 카테고리 이동
- [ ] InlineAdd (+ 추가) 동작

### 정렬 일관성
- [ ] Key Milestone에서 마일스톤 DnD → Tasks 탭 섹션 순서 반영
- [ ] Key Milestone에서 Task DnD → Tasks 탭 아웃라이너 순서 반영
- [ ] Key Milestone에서 마일스톤 DnD → 병렬 보기 순서 반영
- [ ] Key Milestone에서 Task DnD → 병렬 보기 Task 순서 반영

### 기존 ProjectView 회귀
- [ ] 글로벌 ProjectView (사이드바에서 진입하지 않는 경우) 정상 동작
- [ ] 모든 키보드 단축키 기존과 100% 동일
- [ ] 노트 편집 정상
- [ ] 컴포넌트 추출 전후 동작 차이 없음

### 일반 회귀
- [ ] 기존 글로벌 뷰 5개 정상
- [ ] DetailPanel 정상
- [ ] 모바일 레이아웃 미영향
- [ ] `npm run build` 성공

---

## 주의사항

- **OutlinerTaskNode 추출 시 의존성 주의.** 이 컴포넌트가 ProjectView 내부의 state나 handler를 클로저로 참조하고 있을 수 있음. 추출 시 필요한 값을 모두 props로 전달하도록 변경하되, 컴포넌트 내부 로직은 변경하지 않음.
- **마일스톤 섹션 헤더는 아웃라이너 노드가 아니다.** Tab으로 레벨 변경 불가, DnD로 이동 불가. 접기/펼치기만 가능. 키보드 탐색 시 섹션 헤더는 건너뜀.
- **미연결 Task의 "+ 할일 추가"는 refMilestoneId를 null로 생성.** 추후 사용자가 상세패널에서 마일스톤을 배정할 수 있도록 확장 가능.
- **Key Milestone에서 마일스톤 순서를 바꾸면 Tasks 탭에 즉시 반영되어야 함.** 마일스톤 데이터가 커스텀 훅(useRefMilestones)에서 관리되므로, 두 탭이 같은 훅 인스턴스를 공유하거나 탭 전환 시 reload가 필요. 가장 간단한 방법: 탭 전환 시 useRefMilestones가 매번 sort_order 기준으로 재조회.
