# Loop-30 — 통합 타임라인: 마일스톤 그룹핑 + 프로젝트 타임라인 통합

## 목표

기존 TimelineView.jsx를 **최소한으로 수정**하면서, 마일스톤 그룹핑 간트 + 프로젝트 타임라인 통합 + 필터 시스템을 구현한다. 신규 로직은 전부 별도 파일로 분리하여 기존 파일 크기를 최대한 유지한다.

### 핵심 구조

```
글로벌 타임라인:  <TimelineView />                    ← 전체 프로젝트, 필터 바 전체 표시
프로젝트 타임라인: <TimelineView projectId="p1" />    ← 해당 프로젝트 고정, 프로젝트 셀렉트 숨김
```

하나의 TimelineView가 `projectId` prop 유무로 스코프를 결정한다.
GanttMode.jsx는 이 통합 컴포넌트로 대체된다 (파일은 삭제하지 않음).

---

## 전제 조건

- Loop-27 완료 (CompactMilestoneTab, key_milestone_id 활용)
- Loop-28 진단 보고서 확인 완료 (TimelineView 679줄 구조 파악)
- DB 변경 없음

---

## 합의된 결정 사항

| 항목 | 결정 |
|------|------|
| 통합 베이스 | A+ 방식: TimelineView.jsx 최소 수정 (~20줄 추가), 신규 로직 별도 파일 |
| 프로젝트 타임라인 필터 | 뷰 깊이 + 담당자 필터 모두 표시 (프로젝트 셀렉트만 숨김) |
| GanttMode.jsx | 통합 후 대체 (파일 보존, 삭제 안 함) |
| 접기 상태 저장 | 기존 `collapseState.timeline`에 마일스톤 ID도 함께 저장 |
| 담당자 필터 데이터 | 기존 `useTeamMembers` 훅 재사용 |
| 담당자 컬럼 | 좌측 할일 목록에 담당자 컬럼 활성화 |
| 간트 블록 담당자 | on/off 토글로 간트 바 위 담당자 표시 제어 |

---

## 반드시 읽어야 할 파일 (작업 전)

```
src/pages/TimelineView.jsx                          # 핵심 — 679줄, 최소 수정 대상
src/components/project/GanttMode.jsx                 # 212줄 — 대체 대상, 구조 파악용
src/components/project/ProjectLayer.jsx              # tab='ptimeline' 라우팅
src/hooks/useKeyMilestones.js                        # 마일스톤 데이터
src/hooks/useTeamMembers.js                          # 담당자 목록
src/store/useStore.js                                # tasks, projects, collapseState
```

**TimelineView.jsx를 완전히 읽고 아래를 파악한 뒤 진행하라:**
1. `dateToCol` 함수 시그니처 및 반환값
2. `TaskRow` 컴포넌트의 props 전체 목록
3. 날짜 헤더 렌더링 컴포넌트/함수
4. 오늘 기준선 렌더링 위치
5. DndContext + onDragEnd 핸들러 구조
6. `projectRows` 데이터 구조 (프로젝트→할일 매핑)
7. 기존 ProjectFilter 컴포넌트 위치
8. 스케일 전환(월간/분기/연간) 상태 관리
9. 좌측 목록의 행 렌더링 구조 (프로젝트 헤더 행 + 할일 행)
10. 간트 바 위 텍스트/날짜 표기 방식

---

## 파일 구조

### TimelineView.jsx 변경량 (~20줄 추가)

```javascript
// 추가 1: prop 선언
function TimelineView({ projectId = null }) {

// 추가 2: 신규 훅 import + 호출
import { useTimelineGrouping } from '../hooks/useTimelineGrouping'
import { TimelineFilters } from '../components/timeline/TimelineFilters'
import { MilestoneGanttRow } from '../components/timeline/MilestoneGanttRow'

const {
  groupedRows, depth, setDepth,
  selProjects, setSelProjects,
  selMembers, setSelMembers,
  showAssigneeOnBar, setShowAssigneeOnBar,
  collapsed, toggleCollapse,
} = useTimelineGrouping({ projectId, tasks, projects, milestones })

// 추가 3: 필터 바 (기존 ProjectFilter 위 또는 옆)
<TimelineFilters
  projectId={projectId}
  depth={depth} onDepthChange={setDepth}
  projects={projects} selProjects={selProjects} onProjectsChange={setSelProjects}
  members={members} selMembers={selMembers} onMembersChange={setSelMembers}
  showAssigneeOnBar={showAssigneeOnBar} onToggleAssigneeOnBar={setShowAssigneeOnBar}
/>

// 추가 4: 기존 projectRows.map 루프를 groupedRows.map으로 교체
// (기존 TaskRow 컴포넌트는 수정 없이 그대로 사용)
}
```

### 신규 파일 목록

```
src/hooks/useTimelineGrouping.js              # 마일스톤 그룹핑 + 필터 + 접기 상태 로직
src/hooks/useMilestonesByProjects.js           # 여러 프로젝트 마일스톤 한번에 조회
src/components/timeline/TimelineFilters.jsx    # 필터 바 UI (깊이 + 프로젝트 + 담당자 + 토글)
src/components/timeline/MilestoneGanttRow.jsx  # 마일스톤 간트 행 렌더링
src/components/shared/DepthToggle.jsx          # 뷰 깊이 3단 토글
src/components/shared/MultiSelectFilter.jsx    # 범용 멀티셀렉트 드롭다운
```

### 수정 파일

```
src/pages/TimelineView.jsx         # ~20줄 추가 (위 설명)
src/components/project/ProjectLayer.jsx  # ptimeline 탭 → TimelineView projectId 전달로 교체
```

### 수정 금지

```
src/pages/TimelineView.jsx 내부의 기존 코드 (dateToCol, TaskRow, DnD, 날짜 헤더 등)
src/components/project/GanttMode.jsx     # 삭제/수정 금지, 파일 보존
src/components/project/CompactMilestoneTab.jsx
src/components/project/CompactTaskList.jsx
```

---

## Phase 1: useTimelineGrouping 훅

```
src/hooks/useTimelineGrouping.js
```

이 훅이 TimelineView에 필요한 모든 신규 상태와 데이터 변환을 담당한다.
TimelineView.jsx에서는 이 훅 하나만 호출하면 된다.

### 입력

```javascript
function useTimelineGrouping({ projectId, tasks, projects }) {
```

- `projectId`: null이면 글로벌, 값이 있으면 프로젝트 스코프
- `tasks`: useStore의 전체 tasks 배열
- `projects`: useStore의 전체 projects 배열

### 내부 상태

```javascript
const [depth, setDepth] = useState('milestone')  // 'project' | 'milestone' | 'task'
const [selProjects, setSelProjects] = useState(null)  // null = 전체
const [selMembers, setSelMembers] = useState(null)    // null = 전체
const [showAssigneeOnBar, setShowAssigneeOnBar] = useState(true)

// collapseState는 기존 Zustand 패턴 사용
const collapseState = useStore(s => s.collapseState?.timeline || {})
const setCollapseState = useStore(s => s.setCollapseState)
```

### 마일스톤 데이터

```javascript
// projectId가 있으면 해당 프로젝트만, 없으면 선택된 프로젝트 전체
const targetProjectIds = projectId
  ? [projectId]
  : (selProjects || projects.map(p => p.id))

const milestones = useMilestonesByProjects(targetProjectIds)
```

### 출력: groupedRows

기존 TimelineView의 `projectRows` 형태와 호환되는 계층 데이터 구조.

```javascript
// depth='project' → 기존과 동일 (프로젝트→할일)
// depth='milestone' → 프로젝트→마일스톤 (할일 숨김)
// depth='task' → 프로젝트→마일스톤→할일 (전체 표시)

return {
  groupedRows,         // 렌더링용 계층 데이터
  depth, setDepth,
  selProjects, setSelProjects,
  selMembers, setSelMembers,
  showAssigneeOnBar, setShowAssigneeOnBar,
  collapsed: collapseState,
  toggleCollapse,
  milestones,          // MilestoneGanttRow 렌더링용
}
```

### groupedRows 데이터 형식

```javascript
[
  {
    type: 'project',
    project: { id, name, color },
    startDate, endDate,          // 프로젝트 전체 범위
    collapsed: boolean,
    children: [                  // depth !== 'project'일 때만
      {
        type: 'milestone',
        milestone: { id, title, color, startDate, endDate },
        collapsed: boolean,
        taskCount: number,
        doneCount: number,
        children: [              // depth === 'task'일 때만
          {
            type: 'task',
            task: { ...기존 task 객체 },
          }
        ]
      },
      {
        type: 'milestone',
        milestone: { id: '__backlog__', title: '백로그', color: '#b4b2a9' },
        children: [ ... ]
      }
    ]
  }
]
```

### 필터 적용 순서

1. `projectId` 또는 `selProjects`로 프로젝트 필터
2. `selMembers`로 할일의 담당자 필터 (마일스톤은 필터 안 함)
3. `depth`에 따라 children 포함 여부 결정
4. 시작일/마감일 없는 할일도 포함 (좌측 목록에는 표시하되 간트 바는 미표시)

---

## Phase 2: useMilestonesByProjects 훅

```
src/hooks/useMilestonesByProjects.js
```

```javascript
export function useMilestonesByProjects(projectIds) {
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!projectIds?.length) { setMilestones([]); return }
    setLoading(true)
    supabase
      .from('key_milestones')
      .select('*')
      .in('project_id', projectIds)
      .order('sort_order')
      .then(({ data }) => { setMilestones(data || []); setLoading(false) })
  }, [JSON.stringify(projectIds)])  // 배열 비교

  return { milestones, loading }
}
```

빈 배열일 때 쿼리하지 않도록 guard.

---

## Phase 3: 필터 바 컴포넌트

### 3-1. DepthToggle.jsx

```
src/components/shared/DepthToggle.jsx
```

3단계 뷰 깊이 토글. 스타일은 목업 참조.

```jsx
const OPTIONS = [
  { key: 'project', label: '프로젝트' },
  { key: 'milestone', label: '+ 마일스톤' },
  { key: 'task', label: '+ 할일' },
]
```

스타일:
```
배경: #f0efe8, borderRadius: 6, padding: 2
활성: background #fff, color #2C2C2A, fontWeight 500
비활성: transparent, color #888780
fontSize: 11px
```

### 3-2. MultiSelectFilter.jsx

```
src/components/shared/MultiSelectFilter.jsx
```

Props:
```typescript
{
  label: string,
  options: Array<{ id: string, name: string, color?: string }>,
  selected: string[] | null,   // null = 전체 선택
  onChange: (ids: string[] | null) => void,
}
```

UI:
- 버튼: `{label}` + 선택 개수 뱃지 (전체면 뱃지 숨김) + ▾
- 드롭다운: "전체" 체크박스 + 개별 항목 체크박스
- 프로젝트 항목에는 color dot 표시
- 외부 클릭 시 닫힘 (useRef + mousedown)
- 전체 선택 시 `onChange(null)` (null = 필터 없음)

스타일:
```
버튼: border 0.5px solid #d3d1c7, borderRadius 6, fontSize 12, color #5F5E5A
뱃지: background #1D9E75, color #fff, borderRadius 999, fontSize 10
드롭다운: background #fff, borderRadius 8, boxShadow 0 4px 16px rgba(0,0,0,.1)
체크박스: 14×14, borderRadius 3, 선택 시 #1D9E75
```

### 3-3. TimelineFilters.jsx

```
src/components/timeline/TimelineFilters.jsx
```

모든 필터를 한 줄에 배치. `projectId` prop이 있으면 프로젝트 셀렉트를 숨긴다.

```jsx
function TimelineFilters({
  projectId,
  depth, onDepthChange,
  projects, selProjects, onProjectsChange,
  members, selMembers, onMembersChange,
  showAssigneeOnBar, onToggleAssigneeOnBar,
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 14px', borderBottom: '0.5px solid #e8e6df',
      background: '#fafaf8', flexWrap: 'wrap',
    }}>
      <DepthToggle value={depth} onChange={onDepthChange} />

      {/* 프로젝트 필터 — projectId가 있으면 숨김 */}
      {!projectId && (
        <MultiSelectFilter
          label="프로젝트"
          options={projects.map(p => ({ id: p.id, name: p.name, color: p.color }))}
          selected={selProjects}
          onChange={onProjectsChange}
        />
      )}

      <MultiSelectFilter
        label="담당자"
        options={members.map(m => ({ id: m.userId, name: m.displayName }))}
        selected={selMembers}
        onChange={onMembersChange}
      />

      {/* 간트 바 담당자 표시 토글 */}
      <label style={{
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 11, color: '#888780', cursor: 'pointer', userSelect: 'none',
        marginLeft: 'auto',
      }}>
        <input
          type="checkbox"
          checked={showAssigneeOnBar}
          onChange={(e) => onToggleAssigneeOnBar(e.target.checked)}
          style={{ accentColor: '#1D9E75' }}
        />
        바에 담당자
      </label>
    </div>
  )
}
```

---

## Phase 4: MilestoneGanttRow 컴포넌트

```
src/components/timeline/MilestoneGanttRow.jsx
```

마일스톤 그룹 헤더 행. 기존 TimelineView의 행 높이/구조에 맞춰야 한다.

Props:
```typescript
{
  milestone: { id, title, color, startDate, endDate },
  dateToCol: function,     // TimelineView에서 전달받는 기존 좌표 변환 함수
  colWidth: number,        // 기존 컬럼 너비
  totalCols: number,       // 기존 총 컬럼 수
  collapsed: boolean,
  onToggle: () => void,
  hasChildren: boolean,
  taskCount: number,
  doneCount: number,
  isBacklog: boolean,
}
```

### 좌측 영역

```
[▾] [●] 마일스톤 제목                                    [마감일] [진행률]
```

- indent: paddingLeft 26px (프로젝트 행보다 한 단계 들여쓰기)
- 색상 dot: 7×7, `milestone.color`
- 제목: fontSize 12, fontWeight 500, color `#2C2C2A`
- 마감일: fontSize 10, color `#a09f99`
- 진행률: fontSize 10, color `#888780`, "완료/전체" 형식
- 백로그: dot color `#b4b2a9`, 날짜/진행률 표시 방식 동일

### 간트 영역

**기존 `dateToCol` 함수를 사용하여 마일스톤 바 위치를 계산한다.**

```javascript
const startCol = dateToCol(milestone.startDate)
const endCol = dateToCol(milestone.endDate)
// 기존 colWidth를 사용하여 픽셀 위치 계산
const left = startCol * colWidth
const width = Math.max(colWidth, (endCol - startCol + 1) * colWidth)
```

마일스톤 바 스타일:
```javascript
{
  position: 'absolute',
  left, width,
  height: 16,
  borderRadius: 3,
  background: `${milestone.color}30`,  // ~19% opacity
  border: `1px solid ${milestone.color}50`,  // ~31% opacity
  top: '50%',
  transform: 'translateY(-50%)',
}
```

백로그 행: 간트 바 없음.

---

## Phase 5: TimelineView.jsx 수정 (최소)

### 5-1. projectId prop 추가

```javascript
// 변경 전
export default function TimelineView() {

// 변경 후
export default function TimelineView({ projectId = null }) {
```

### 5-2. useTimelineGrouping 호출

기존 데이터 변수(tasks, projects) 아래에 추가:

```javascript
import { useTimelineGrouping } from '../hooks/useTimelineGrouping'
import TimelineFilters from '../components/timeline/TimelineFilters'
import MilestoneGanttRow from '../components/timeline/MilestoneGanttRow'

const {
  groupedRows, depth, setDepth,
  selProjects, setSelProjects,
  selMembers, setSelMembers,
  showAssigneeOnBar, setShowAssigneeOnBar,
  collapsed, toggleCollapse, milestones,
} = useTimelineGrouping({ projectId, tasks, projects })

const members = useTeamMembers.getMembers(currentTeamId)
```

### 5-3. 필터 바 삽입

기존 헤더/스케일 컨트롤 아래, 날짜 헤더 위에 삽입:

```jsx
<TimelineFilters
  projectId={projectId}
  depth={depth} onDepthChange={setDepth}
  projects={projects} selProjects={selProjects} onProjectsChange={setSelProjects}
  members={members || []} selMembers={selMembers} onMembersChange={setSelMembers}
  showAssigneeOnBar={showAssigneeOnBar} onToggleAssigneeOnBar={setShowAssigneeOnBar}
/>
```

### 5-4. 렌더링 루프 교체

**기존 `projectRows.map(...)` 루프를 `groupedRows`로 교체.**

이것이 가장 큰 변경이지만, 핵심 원칙은:
- 기존 **프로젝트 헤더 행** 렌더링 코드는 그대로 사용 (type === 'project')
- 기존 **TaskRow 컴포넌트**는 수정 없이 그대로 사용 (type === 'task')
- **마일스톤 행만 새로 삽입** (type === 'milestone')

```jsx
{groupedRows.map(row => {
  if (row.type === 'project') {
    return (
      <Fragment key={row.project.id}>
        {/* 기존 프로젝트 헤더 행 렌더링 — 코드 그대로 */}
        {renderProjectHeader(row.project, row.collapsed, () => toggleCollapse(row.project.id))}

        {!row.collapsed && row.children?.map(child => {
          if (child.type === 'milestone') {
            return (
              <Fragment key={child.milestone.id}>
                <MilestoneGanttRow
                  milestone={child.milestone}
                  dateToCol={dateToCol}
                  colWidth={colWidth}
                  totalCols={totalCols}
                  collapsed={child.collapsed}
                  onToggle={() => toggleCollapse(child.milestone.id)}
                  hasChildren={child.children?.length > 0}
                  taskCount={child.taskCount}
                  doneCount={child.doneCount}
                  isBacklog={child.milestone.id.includes('backlog')}
                />

                {!child.collapsed && child.children?.map(taskRow => (
                  /* ★ 기존 TaskRow 컴포넌트 그대로 사용 ★ */
                  <TaskRow
                    key={taskRow.task.id}
                    task={taskRow.task}
                    {...existingTaskRowProps}
                    showAssignee={showAssigneeOnBar}
                    indent={2}
                  />
                ))}
              </Fragment>
            )
          }
          // depth='project'일 때 할일 직접 표시 (마일스톤 없이)
          if (child.type === 'task') {
            return <TaskRow key={child.task.id} task={child.task} {...existingTaskRowProps} />
          }
          return null
        })}
      </Fragment>
    )
  }
  return null
})}
```

**`renderProjectHeader`와 `TaskRow`는 기존 TimelineView.jsx에 이미 있는 코드를 그대로 참조.**
필요하면 기존 인라인 렌더링 코드를 함수로 추출하되, 내부 로직은 변경하지 않는다.

### 5-5. 담당자 컬럼 활성화

좌측 할일 목록에 담당자를 표시하는 컬럼 추가.

**기존 좌측 목록의 할일 행 렌더링 부분에서:**

```jsx
// 기존 할일 행:  [할일 텍스트]                     [마감일]
// 변경 후:       [할일 텍스트]              [담당자] [마감일]

// 할일 행 렌더링에 담당자 표시 추가 (기존 텍스트 오른쪽에 삽입)
{task.assigneeName && (
  <span style={{
    fontSize: 10, color: '#888780',
    flexShrink: 0, minWidth: 36,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  }}>
    {task.assigneeName}
  </span>
)}
```

좌측 목록의 컬럼 헤더에도 "담당자" 레이블 추가:
```
프로젝트 / 할일          담당자    마감일
```

**이 부분은 기존 TaskRow 내부를 수정해야 할 수 있다.**
TaskRow가 별도 컴포넌트이면 props로 `showAssigneeColumn`을 추가.
인라인이면 해당 위치에 조건부 JSX 삽입.

### 5-6. 간트 블록 담당자 표시 토글

기존 TaskRow의 간트 바 위에 담당자 이름을 표시하는 기능.
`showAssigneeOnBar` 상태로 on/off.

```jsx
// 간트 바 렌더링 부분에서
{showAssigneeOnBar && task.assigneeName && (
  <span style={{
    position: 'absolute',
    right: -4,              // 바 오른쪽 바깥
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 10,
    color: '#888780',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  }}>
    {task.assigneeName}
  </span>
)}
```

담당자 이름이 바 오른쪽에 표시. 바 내부에 넣으면 텍스트가 겹칠 수 있으므로 바 바깥 오른쪽이 안전.

**기존 간트 바 위 텍스트 표기(할일 제목, 기간)와 충돌하지 않도록 위치 조정.** 기존 텍스트가 바 왼쪽/위쪽에 있다면, 담당자는 바 오른쪽에 배치.

---

## Phase 6: ProjectLayer.jsx 수정

### 6-1. ptimeline 탭 → TimelineView 연결

```javascript
// 변경 전
import GanttMode from './GanttMode'
// tab === 'ptimeline' → <GanttMode projectId={projectId} />

// 변경 후
import TimelineView from '../../pages/TimelineView'
// tab === 'ptimeline' → <TimelineView projectId={projectId} />
```

### 6-2. ModeBar 숨김

기존 ptimeline 탭의 gantt/detail 모드 전환 ModeBar를 숨긴다:

```javascript
// 기존
{tab === 'ptimeline' && (
  <ModeBar modes={[...]} ... />
)}

// 변경: ModeBar 렌더링 제거 (또는 조건부 숨김)
{tab === 'ptimeline' && false && (
  <ModeBar modes={[...]} ... />
)}
```

GanttMode.jsx import는 제거하되 파일 자체는 삭제하지 않는다.

---

## Phase 7: projectId 모드에서의 동작 차이

TimelineView가 `projectId`를 받았을 때 달라지는 부분:

| 요소 | 글로벌 (projectId=null) | 프로젝트 (projectId="p1") |
|------|------------------------|--------------------------|
| 타이틀 | "타임라인" + 연월 | 프로젝트 헤더에서 처리 (TimelineView 자체 타이틀 숨김) |
| 프로젝트 셀렉트 | 표시 | 숨김 |
| 뷰 깊이 토글 | 표시 | 표시 |
| 담당자 셀렉트 | 표시 | 표시 |
| 간트 바 담당자 토글 | 표시 | 표시 |
| 전체/팀/개인 스코프 토글 | 표시 (기존) | 숨김 |
| 월간/분기/연간 | 표시 | 표시 |
| 좌측 목록 프로젝트 헤더 | 표시 (여러 프로젝트) | 숨김 (단일 프로젝트이므로) |
| 데이터 | 전체 프로젝트 | 해당 프로젝트만 |
| DnD | 기존 유지 | 기존 유지 |

구현:
```javascript
// TimelineView 내부에서 projectId 존재 여부로 분기
const isProjectMode = !!projectId

// 타이틀 영역
{!isProjectMode && (
  <h1>타임라인</h1>
  // ... 기존 타이틀 + 연월 표시
)}

// 프로젝트 헤더 행 (좌측 목록)
// isProjectMode일 때는 프로젝트 헤더 행을 렌더링하지 않고 마일스톤부터 바로 표시
```

---

## 스타일 가이드

### 마일스톤 간트 행

| 요소 | 스타일 |
|------|--------|
| 좌측 indent | paddingLeft: 26px |
| 색상 dot | 7×7, borderRadius 50%, milestone.color |
| 제목 | fontSize 12, fontWeight 500, color #2C2C2A |
| 마감일 | fontSize 10, color #a09f99 |
| 진행률 | fontSize 10, color #888780 |
| 접기 화살표 | fontSize 8, color #a09f99, rotate(-90deg) when collapsed |
| 행 배경 | transparent (호버 시 #fdfcfa) |
| 간트 바 | milestone.color + opacity 0.19 fill + opacity 0.31 border, height 16, borderRadius 3 |

### 할일 행 들여쓰기 (마일스톤 하위)

| 요소 | 스타일 |
|------|--------|
| 좌측 indent | paddingLeft: 42px (프로젝트 10 + 마일스톤 16 + 할일 16) |
| 간트 바 | 기존 TaskRow 스타일 그대로 |

### 담당자 컬럼 (좌측 목록)

| 요소 | 스타일 |
|------|--------|
| 텍스트 | fontSize 10, color #888780 |
| 너비 | minWidth 36px, flexShrink 0 |
| 오버플로 | ellipsis |

### 담당자 바 표시 (간트 바 오른쪽)

| 요소 | 스타일 |
|------|--------|
| 텍스트 | fontSize 10, color #888780 |
| 위치 | 바 오른쪽 바깥 (right: -4px 또는 left: 100% + 4px) |
| 다른 텍스트와 겹침 방지 | pointerEvents: none |

### 필터 바

| 요소 | 스타일 |
|------|--------|
| 배경 | #fafaf8 |
| 하단 경계 | 0.5px solid #e8e6df |
| padding | 6px 14px |
| gap | 8px |
| flexWrap | wrap |

### "바에 담당자" 토글

| 요소 | 스타일 |
|------|--------|
| 레이블 | fontSize 11, color #888780 |
| 체크박스 | accentColor #1D9E75 |
| 위치 | 필터 바 우측 (marginLeft: auto) |

---

## 검증 체크리스트

### 기존 기능 보존 (최우선)
- [ ] 기존 간트 바 렌더링 정상 (텍스트 표기, 기간 표시, 강조색)
- [ ] 기존 날짜 헤더 정상 (월간/분기/연간 전환)
- [ ] 오늘 기준선 정상
- [ ] 기존 DnD 정상
- [ ] 간트 바 클릭 → 상세패널 정상
- [ ] 기존 스코프 필터(전체/팀/개인) 정상
- [ ] 월 이동, 오늘 버튼 정상

### 필터
- [ ] 뷰 깊이 토글: 프로젝트 / +마일스톤 / +할일 전환
- [ ] 프로젝트 멀티셀렉트: 복수 선택/해제
- [ ] 담당자 멀티셀렉트: 복수 선택/해제
- [ ] 필터 조합 정상 (프로젝트 2개 + 담당자 1명)

### 마일스톤 그룹핑
- [ ] 마일스톤 헤더 행 렌더링 (dot + 제목 + 마감일 + 진행률)
- [ ] 마일스톤 간트 바 (반투명 + border)
- [ ] 마일스톤 접기/펼치기
- [ ] 백로그 행 (마일스톤 미연결 할일)
- [ ] 접기 상태가 collapseState.timeline에 저장

### 담당자 표시
- [ ] 좌측 할일 목록에 담당자 컬럼 표시
- [ ] 간트 바 오른쪽에 담당자 표시 (토글 on)
- [ ] 토글 off 시 담당자 숨김
- [ ] 기존 바 텍스트(할일 제목, 기간)와 겹치지 않는지

### 프로젝트 타임라인
- [ ] ProjectLayer ptimeline 탭 → TimelineView(projectId) 렌더링
- [ ] 프로젝트 셀렉트 숨겨짐
- [ ] 뷰 깊이 + 담당자 필터 표시
- [ ] 해당 프로젝트 마일스톤 + 할일만 표시
- [ ] 프로젝트 헤더 행 미표시 (단일 프로젝트이므로)
- [ ] 간트 바 기존 기능 전부 동작

### 글로벌 동기화
- [ ] 프로젝트 타임라인에서 할일 변경 → 글로벌 타임라인 반영
- [ ] 마일스톤 탭에서 할일 마일스톤 변경 → 타임라인 그룹핑 반영

### 회귀
- [ ] 오늘 할일, 전체 할일, 매트릭스 뷰 정상
- [ ] CompactMilestoneTab 정상
- [ ] CompactTaskList 정상
- [ ] DetailPanel 정상
- [ ] `npm run build` 성공

---

## 주의사항

1. **기존 TimelineView.jsx의 내부 로직(dateToCol, TaskRow, DnD, 날짜 헤더) 수정 금지** — 신규 코드는 별도 파일에서 import
2. **기존 TaskRow에 props 추가는 허용** — `showAssignee`, `indent` 등 확장 props. 기존 props 삭제/변경 금지
3. **dateToCol 함수를 MilestoneGanttRow에 props로 전달** — 새로 만들지 않음
4. **GanttMode.jsx 삭제/수정 금지** — ProjectLayer의 import만 교체
5. **updateTask(id, patch) 시그니처 엄수**
6. **collapseState.timeline에 마일스톤 ID 저장 시 기존 프로젝트 ID와 충돌 없음** (UUID vs text)
7. **groupedRows 포맷이 기존 projectRows와 호환되도록 설계** — 기존 렌더링 코드를 최대한 재사용
8. **assigneeName은 useTeamMembers에서 COALESCE(tm.display_name, profiles.display_name) 패턴**

---

## 작업 내역
(작업 완료 후 기록)
