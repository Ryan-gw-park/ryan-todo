# Loop-34: 타임라인 뷰 최적화

> **목표:** 글로벌/프로젝트 타임라인을 단일 엔진으로 통합하고, 3단계 필터·기간 상속·컬러 스킴·시간 스케일을 구현한다.
> **범위:** TimelineView 컴포넌트 재구조화. Store 로직 변경은 기간 상속 계산 유틸만.
> **선행 조건:** Loop-31 (상태 정비) + Loop-32 (스키마 확장) + Loop-33 (UI 통합 정비) 완료

---

## 설계 결정 (확정)

### 핵심 원칙

**글로벌 타임라인과 프로젝트 타임라인은 동일한 엔진.** 시작 레벨만 다르고 나머지 기능은 100% 동일.

| 기능 | 글로벌 | 프로젝트 |
|------|--------|---------|
| 깊이 필터 | [프로젝트] [+마일스톤] [+할일] | [마일스톤] [+할일] |
| 범위 필터 | [전체] [팀] [개인] | 동일 |
| 담당자 필터 | 드롭다운 체크박스 | 동일 |
| 프로젝트 필터 | 드롭다운 (글로벌만) | 없음 (이미 특정 프로젝트) |
| 시간 스케일 | [월간] [분기] [연간] | 동일 |
| 기간 상속 | 동일 | 동일 |
| 컬러 스킴 | 동일 | 동일 |
| 접기/펼치기 | 동일 | 동일 |
| 행 높이/들여쓰기 | 동일 | 동일 |
| 오늘 라인 | 동일 | 동일 |

---

## 작업 순서

> 작업 1(데이터 계층 구조화) → 2(기간 상속) → 3(타임라인 엔진) → 4(필터 시스템) → 5(컬러 스킴) → 6(시간 스케일) → 7(접기/펼치기) → 8(진입점 통합)

---

### 작업 1: 데이터 계층 구조화 — buildTimelineTree

**파일:** `src/utils/timelineUtils.js` (신규)

**목적:** flat한 projects/milestones/tasks 배열을 타임라인 렌더링용 트리 구조로 변환.

**1-1. 트리 노드 구조 정의**

```javascript
// 타임라인에서 사용하는 통일된 노드 구조
// 프로젝트, 마일스톤, 할일 모두 같은 형태

{
  id: string,
  type: 'project' | 'milestone' | 'task',
  name: string,
  color: string,           // 프로젝트 고유색 또는 MS 고유색
  projectColor: string,    // 항상 프로젝트의 색상 (할일·MS에서 상위 참조용)
  ownerId: string | null,
  ownerName: string | null,
  startDate: Date | null,  // 직접값 또는 상속값
  dueDate: Date | null,    // 직접값 또는 상속값
  inherited: boolean,      // 기간이 하위에서 상속되었는지
  progress: number,        // 0~100 (프로젝트/MS만)
  done: boolean,           // 할일만
  category: string,        // 할일만: 'today'|'next'|'backlog'
  depth: number,           // 0=프로젝트, 1=마일스톤, 2=할일
  children: [],            // 하위 노드 배열
  expanded: boolean,       // 접기/펼치기 상태 (기본: true)
  visible: boolean,        // 현재 필터에 의해 표시 여부
  raw: object,             // 원본 데이터 참조
}
```

**1-2. buildTimelineTree 함수**

```javascript
/**
 * @param {Object} params
 * @param {Array} params.projects - Store의 projects 배열
 * @param {Array} params.milestones - Store의 milestones 배열
 * @param {Array} params.tasks - Store의 tasks 배열 (done=false + 필터 적용 후)
 * @param {Array} params.members - 팀 멤버 목록 (이름 매핑용)
 * @param {string} params.rootLevel - 'project' | 'milestone'
 * @param {string|null} params.projectId - 프로젝트 뷰일 때 특정 프로젝트 ID
 * @returns {Array} 트리 노드 배열
 */
function buildTimelineTree({ projects, milestones, tasks, members, rootLevel, projectId }) {
  // 1. rootLevel에 따라 최상위 노드 결정
  // 2. 각 프로젝트 아래에 마일스톤 배치
  // 3. 각 마일스톤 아래에 연결된 할일 배치
  // 4. 미연결 할일(milestoneId=null)은 프로젝트 직속 자식으로 배치
  // 5. 각 노드에 기간 상속 적용 (작업 2)
  // 6. 각 노드에 진행률 계산
}
```

**1-3. 구현 세부**

```javascript
function buildTimelineTree({ projects, milestones, tasks, members, rootLevel, projectId }) {
  const memberMap = Object.fromEntries(members.map(m => [m.id, m.displayName || m.name]));

  // 프로젝트 필터
  const targetProjects = projectId
    ? projects.filter(p => p.id === projectId)
    : projects.filter(p => !p.is_archived);

  const tree = targetProjects.map(project => {
    // 이 프로젝트의 마일스톤
    const projMilestones = milestones
      .filter(m => m.projectId === project.id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    // 이 프로젝트의 할일
    const projTasks = tasks.filter(t => t.projectId === project.id);

    // 마일스톤별 할일 그룹핑
    const msNodes = projMilestones.map(ms => {
      const msTasks = projTasks
        .filter(t => t.keyMilestoneId === ms.id)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      const taskNodes = msTasks.map(t => ({
        id: t.id,
        type: 'task',
        name: t.text,
        color: project.color,
        projectColor: project.color,
        ownerId: t.assigneeId,
        ownerName: t.assigneeId ? memberMap[t.assigneeId] || '—' : '미배정',
        startDate: t.startDate ? new Date(t.startDate) : null,
        dueDate: t.dueDate ? new Date(t.dueDate) : null,
        inherited: false,
        progress: 0,
        done: t.done,
        category: t.category,
        depth: rootLevel === 'project' ? 2 : 1,
        children: [],
        expanded: false,
        visible: true,
        raw: t,
      }));

      const doneTasks = msTasks.filter(t => t.done).length;

      return {
        id: ms.id,
        type: 'milestone',
        name: ms.title,
        color: ms.color || project.color,
        projectColor: project.color,
        ownerId: ms.owner_id,
        ownerName: ms.owner_id ? memberMap[ms.owner_id] || '—' : '—',
        startDate: ms.start_date ? new Date(ms.start_date) : null,
        dueDate: ms.end_date ? new Date(ms.end_date) : null,
        inherited: false, // 작업 2에서 재계산
        progress: msTasks.length > 0 ? Math.round((doneTasks / msTasks.length) * 100) : 0,
        done: false,
        category: '',
        depth: rootLevel === 'project' ? 1 : 0,
        children: taskNodes,
        expanded: true,
        visible: true,
        raw: ms,
      };
    });

    // 미연결 할일 (milestoneId = null)
    const unlinkedTasks = projTasks
      .filter(t => !t.keyMilestoneId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    const unlinkedTaskNodes = unlinkedTasks.map(t => ({
      id: t.id,
      type: 'task',
      name: t.text,
      color: project.color,
      projectColor: project.color,
      ownerId: t.assigneeId,
      ownerName: t.assigneeId ? memberMap[t.assigneeId] || '—' : '미배정',
      startDate: t.startDate ? new Date(t.startDate) : null,
      dueDate: t.dueDate ? new Date(t.dueDate) : null,
      inherited: false,
      progress: 0,
      done: t.done,
      category: t.category,
      depth: rootLevel === 'project' ? 1 : 0,
      children: [],
      expanded: false,
      visible: true,
      raw: t,
    }));

    const allChildren = [...msNodes, ...unlinkedTaskNodes];
    const completedMs = projMilestones.filter(m => m.status === 'completed').length;

    return {
      id: project.id,
      type: 'project',
      name: project.name,
      color: project.color,
      projectColor: project.color,
      ownerId: project.owner_id,
      ownerName: project.owner_id ? memberMap[project.owner_id] || '—' : '—',
      startDate: project.start_date ? new Date(project.start_date) : null,
      dueDate: project.due_date ? new Date(project.due_date) : null,
      inherited: false, // 작업 2에서 재계산
      progress: projMilestones.length > 0
        ? Math.round((completedMs / projMilestones.length) * 100)
        : 0,
      done: false,
      category: '',
      depth: 0,
      children: allChildren,
      expanded: true,
      visible: true,
      raw: project,
    };
  });

  // rootLevel이 'milestone'이면 프로젝트 노드를 벗기고 마일스톤부터 시작
  if (rootLevel === 'milestone' && tree.length === 1) {
    const projNode = tree[0];
    return projNode.children.map(c => ({ ...c, depth: c.type === 'milestone' ? 0 : (c.type === 'task' ? 0 : c.depth) }));
  }

  return tree;
}
```

---

### 작업 2: 기간 상속 — computeInheritedDates

**파일:** `src/utils/timelineUtils.js` (같은 파일)

**2-1. 상속 함수**

```javascript
/**
 * 트리를 순회하며 기간이 없는 노드에 하위 기간을 상속.
 * bottom-up으로 처리: 자식 먼저 → 부모.
 */
function applyDateInheritance(nodes) {
  for (const node of nodes) {
    // 먼저 자식들에게 재귀 적용
    if (node.children.length > 0) {
      applyDateInheritance(node.children);
    }

    // 직접 기간이 있으면 상속 불필요
    if (node.startDate && node.dueDate) {
      node.inherited = false;
      continue;
    }

    // 하위 노드의 기간 수집
    const childDates = node.children
      .filter(c => c.startDate || c.dueDate)
      .flatMap(c => [c.startDate, c.dueDate].filter(Boolean));

    if (childDates.length === 0) continue;

    const allDates = childDates.map(d => d.getTime());

    if (!node.startDate) {
      node.startDate = new Date(Math.min(...allDates));
      node.inherited = true;
    }
    if (!node.dueDate) {
      node.dueDate = new Date(Math.max(...allDates));
      node.inherited = true;
    }
  }
}
```

**2-2. buildTimelineTree 함수 끝에 호출**

```javascript
// buildTimelineTree 마지막에:
applyDateInheritance(tree);
return tree;
```

**2-3. 시각적 구분**

렌더링 시:
- `node.inherited === false` → 바 실선 테두리 (`border: 0.5px solid`)
- `node.inherited === true` → 바 점선 테두리 (`border: 0.5px dashed`)
- 기간 없음 (startDate=null && dueDate=null) → 바 없이 좌측 패널에 이름만 회색 표시

---

### 작업 3: 타임라인 엔진 — TimelineEngine 컴포넌트

**파일:** `src/components/timeline/TimelineEngine.jsx` (신규)

글로벌 타임라인과 프로젝트 타임라인이 공유하는 핵심 렌더링 엔진.

**3-1. Props 인터페이스**

```javascript
/**
 * @param {string} rootLevel - 'project' | 'milestone'
 * @param {string|null} projectId - 프로젝트 뷰일 때만
 * @param {string} initialScale - 'monthly' | 'quarterly' | 'yearly'
 * @param {string} initialDepth - 'project' | 'milestone' | 'task'
 */
function TimelineEngine({ rootLevel, projectId, initialScale, initialDepth }) {
  // ...
}
```

**3-2. 내부 상태**

```javascript
// 필터 상태
const [depthFilter, setDepthFilter] = useState(initialDepth);
  // 'project' | 'milestone' | 'task'
  // 프로젝트 뷰에서는 'milestone' | 'task'

const [scopeFilter, setScopeFilter] = useState('all');
  // 'all' | 'team' | 'personal'

const [selectedMembers, setSelectedMembers] = useState(null);
  // null = 전체, Set<userId> = 선택된 멤버만

const [selectedProject, setSelectedProject] = useState(null);
  // 글로벌 뷰에서만 사용. null = 전체

// 시간 스케일
const [timeScale, setTimeScale] = useState(initialScale);
  // 'monthly' | 'quarterly' | 'yearly'

// 네비게이션 (현재 보고 있는 기간)
const [viewDate, setViewDate] = useState(new Date());
  // 월간: 해당 월의 1일
  // 분기: 해당 분기 첫날
  // 연간: 해당 연도 1/1

// 접기/펼치기 상태
const [expandedIds, setExpandedIds] = useState(new Set());
  // 확장된 노드 ID들. 기본: 모든 프로젝트/MS 확장
```

**3-3. 레이아웃 구조**

```
┌─────────────────────────────────────────────────────┐
│ TimelineToolbar (필터 + 스케일)                        │
├────────────────────┬────────────────────────────────┤
│ TimelineLeftPanel  │ TimelineGrid                   │
│ (이름 + 담당자 +   │ (헤더 + 간트바 영역 + 오늘선)    │
│  진행률)           │                                │
├────────────────────┴────────────────────────────────┤
│ (가로 스크롤 동기화)                                   │
└─────────────────────────────────────────────────────┘
```

**3-4. 렌더링 행 생성 — flattenVisibleRows**

트리를 depthFilter와 expandedIds에 따라 flat 배열로 변환:

```javascript
function flattenVisibleRows(tree, depthFilter, expandedIds) {
  const rows = [];

  function traverse(nodes) {
    for (const node of nodes) {
      // depthFilter에 따른 가시성
      const maxDepth = depthFilter === 'project' ? 0
                     : depthFilter === 'milestone' ? 1
                     : 2;

      // depth가 maxDepth 이하인 노드만 표시
      if (node.depth > maxDepth) continue;

      // 필터에 의해 숨겨진 노드 스킵
      if (!node.visible) continue;

      rows.push(node);

      // 펼쳐져 있고 자식이 있으면 재귀
      if (expandedIds.has(node.id) && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(tree);
  return rows;
}
```

---

### 작업 4: 필터 시스템 — TimelineToolbar

**파일:** `src/components/timeline/TimelineToolbar.jsx` (신규)

**4-1. 레이아웃**

```
좌측:
  [깊이 필터 그룹]  |  [범위 필터 그룹]  |  [담당자 드롭다운]  |  [프로젝트 드롭다운*]

우측:
  [월간|분기|연간]

* 프로젝트 드롭다운은 rootLevel === 'project'일 때만 표시
```

**4-2. 깊이 필터 (DepthFilter)**

```jsx
// 토글 버튼 그룹
// rootLevel === 'project' (글로벌):
//   [프로젝트] [+ 마일스톤] [+ 할일]
// rootLevel === 'milestone' (프로젝트):
//   [마일스톤] [+ 할일]

// 동작: 클릭 시 depthFilter 상태 변경
// "프로젝트" 클릭 → depthFilter = 'project'
// "+ 마일스톤" 클릭 → depthFilter = 'milestone'
// "+ 할일" 클릭 → depthFilter = 'task'
```

**주의:** 프로젝트 뷰에서 rootLevel이 'milestone'이면, depthFilter 선택지가 'milestone' | 'task'만 존재. 'project'는 선택 불가.

**4-3. 범위 필터 (ScopeFilter)**

```jsx
// [전체] [팀] [개인] 토글
// scopeFilter 상태 변경
// 'all' → 모든 항목
// 'team' → teamId가 있는 프로젝트/할일
// 'personal' → scope === 'private' 또는 teamId가 없는 프로젝트
```

트리 빌드 시 scopeFilter를 적용:
```javascript
// buildTimelineTree 호출 전에 projects/tasks를 필터
const filteredProjects = scopeFilter === 'all' ? projects
  : scopeFilter === 'team' ? projects.filter(p => p.team_id)
  : projects.filter(p => !p.team_id);

const filteredTasks = scopeFilter === 'all' ? tasks
  : scopeFilter === 'team' ? tasks.filter(t => t.teamId)
  : tasks.filter(t => t.scope === 'private');
```

**4-4. 담당자 필터 (AssigneeFilter)**

드롭다운 체크박스 방식:

```jsx
// 드롭다운 열기 버튼: "담당자 ▾"
// 드롭다운 내부:
//   ☑ 전체 선택
//   ───────────
//   ☑ Ryan Park
//   ☑ Ethan
//   ☑ Ash
//   ☑ Eric
//   ☑ Edmond
//   ───────────
//   ☑ 미배정 표시
```

필터 적용 로직:
```javascript
// selectedMembers가 null이면 전체 표시
// selectedMembers가 Set이면:
//   할일: assigneeId가 Set에 포함된 것만
//   마일스톤: owner_id가 Set에 포함 OR 하위 할일 중 하나라도 포함
//   프로젝트: 하위 중 하나라도 보이면 표시

// "미배정 표시" 체크 해제 시:
//   assigneeId === null인 할일 숨김
//   owner_id === null인 마일스톤 숨김 (단, 하위 할일이 보이면 유지)
```

**4-5. 프로젝트 필터 (글로벌 뷰에서만)**

```jsx
// 드롭다운: "프로젝트 ▾"
// 내부: 프로젝트 목록 체크박스
// 선택된 프로젝트만 트리에 포함
// rootLevel === 'milestone'이면 이 드롭다운 자체를 렌더링하지 않음
```

**4-6. 시간 스케일 (ScaleSelector)**

```jsx
// 우측 정렬
// [월간] [분기] [연간] 토글 그룹
// timeScale 상태 변경
```

---

### 작업 5: 컬러 스킴 — getBarStyles

**파일:** `src/utils/timelineUtils.js` (같은 파일)

**5-1. 프로젝트 색상 → 컬러 ramp 매핑**

```javascript
const COLOR_RAMP_MAP = {
  // 프로젝트에서 사용하는 색상 → ramp 이름
  '#378ADD': 'blue',
  '#E24B4A': 'red',
  '#EF9F27': 'amber',
  '#1D9E75': 'teal',
  '#7F77DD': 'purple',
  '#D4537E': 'pink',
  '#888780': 'gray',
};

// 각 ramp의 stop 값
const RAMP_STOPS = {
  blue:   { 50: '#E6F1FB', 100: '#B5D4F4', 200: '#85B7EB', 400: '#378ADD', 600: '#185FA5', 800: '#0C447C' },
  red:    { 50: '#FCEBEB', 100: '#F7C1C1', 200: '#F09595', 400: '#E24B4A', 600: '#A32D2D', 800: '#791F1F' },
  amber:  { 50: '#FAEEDA', 100: '#FAC775', 200: '#EF9F27', 400: '#BA7517', 600: '#854F0B', 800: '#633806' },
  teal:   { 50: '#E1F5EE', 100: '#9FE1CB', 200: '#5DCAA5', 400: '#1D9E75', 600: '#0F6E56', 800: '#085041' },
  purple: { 50: '#EEEDFE', 100: '#CECBF6', 200: '#AFA9EC', 400: '#7F77DD', 600: '#534AB7', 800: '#3C3489' },
  pink:   { 50: '#FBEAF0', 100: '#F4C0D1', 200: '#ED93B1', 400: '#D4537E', 600: '#993556', 800: '#72243E' },
  gray:   { 50: '#F1EFE8', 100: '#D3D1C7', 200: '#B4B2A9', 400: '#888780', 600: '#5F5E5A', 800: '#444441' },
};
```

**5-2. getBarStyles 함수**

```javascript
function getBarStyles(node) {
  // 완료된 할일: 회색
  if (node.type === 'task' && node.done) {
    return {
      fill: RAMP_STOPS.gray[100],      // #D3D1C7
      border: 'none',
      progressFill: 'none',
      textColor: RAMP_STOPS.gray[400], // #888780
      strikethrough: true,
    };
  }

  // 색상에서 ramp 결정
  const rampName = COLOR_RAMP_MAP[node.color] || COLOR_RAMP_MAP[node.projectColor] || 'gray';
  const ramp = RAMP_STOPS[rampName];

  if (node.type === 'project') {
    return {
      fill: ramp[50],
      border: `0.5px ${node.inherited ? 'dashed' : 'solid'} ${ramp[600]}`,
      progressFill: ramp[400],   // 30% opacity로 적용
      progressOpacity: 0.3,
      textColor: ramp[800],
    };
  }

  if (node.type === 'milestone') {
    // MS 고유색이 있으면 해당 ramp 사용, 없으면 프로젝트 ramp
    const msRampName = node.color !== node.projectColor
      ? (COLOR_RAMP_MAP[node.color] || rampName)
      : rampName;
    const msRamp = RAMP_STOPS[msRampName];

    return {
      fill: msRamp[50],
      border: `0.5px ${node.inherited ? 'dashed' : 'solid'} ${msRamp[200]}`,
      progressFill: msRamp[400],
      progressOpacity: 0.3,
      textColor: msRamp[800],
    };
  }

  // 할일: 프로젝트 색상의 200 stop (단색)
  return {
    fill: ramp[200],
    border: 'none',
    progressFill: 'none',
    textColor: ramp[800],
  };
}
```

---

### 작업 6: 시간 스케일 — TimelineGrid

**파일:** `src/components/timeline/TimelineGrid.jsx` (신규)

**6-1. 스케일별 그리드 설정**

```javascript
function getScaleConfig(timeScale, viewDate) {
  if (timeScale === 'monthly') {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    return {
      label: `${year}년 ${month + 1}월`,
      columns: daysInMonth,
      columnWidth: 'calc(100% / ' + daysInMonth + ')',
      headers: Array.from({ length: daysInMonth }, (_, i) => ({
        label: String(i + 1),
        date: new Date(year, month, i + 1),
      })),
      getColumnIndex: (date) => date.getDate() - 1,
      prevPeriod: () => new Date(year, month - 1, 1),
      nextPeriod: () => new Date(year, month + 1, 1),
    };
  }

  if (timeScale === 'quarterly') {
    const quarter = Math.floor(viewDate.getMonth() / 3);
    const startMonth = quarter * 3;
    const startDate = new Date(viewDate.getFullYear(), startMonth, 1);
    const endDate = new Date(viewDate.getFullYear(), startMonth + 3, 0);

    // 13주 (또는 해당 분기의 실제 주 수)
    const weeks = [];
    let current = new Date(startDate);
    // 첫 주 월요일로 맞춤
    current.setDate(current.getDate() - ((current.getDay() + 6) % 7));
    let weekNum = 1;
    while (current <= endDate || weekNum <= 13) {
      weeks.push({
        label: `W${weekNum}`,
        startDate: new Date(current),
        endDate: new Date(current.getFullYear(), current.getMonth(), current.getDate() + 6),
      });
      current.setDate(current.getDate() + 7);
      weekNum++;
      if (weekNum > 14) break;  // 안전장치
    }

    return {
      label: `${viewDate.getFullYear()} Q${quarter + 1} (${startMonth + 1}월 ~ ${startMonth + 3}월)`,
      columns: weeks.length,
      headers: weeks.map(w => ({ label: w.label, date: w.startDate })),
      getColumnIndex: (date) => {
        return weeks.findIndex(w => date >= w.startDate && date <= w.endDate);
      },
      prevPeriod: () => new Date(viewDate.getFullYear(), startMonth - 3, 1),
      nextPeriod: () => new Date(viewDate.getFullYear(), startMonth + 3, 1),
    };
  }

  if (timeScale === 'yearly') {
    const year = viewDate.getFullYear();
    return {
      label: `${year}`,
      columns: 12,
      headers: Array.from({ length: 12 }, (_, i) => ({
        label: `${i + 1}월`,
        date: new Date(year, i, 1),
      })),
      getColumnIndex: (date) => date.getMonth(),
      prevPeriod: () => new Date(year - 1, 0, 1),
      nextPeriod: () => new Date(year + 1, 0, 1),
    };
  }
}
```

**6-2. 바 위치/너비 계산**

```javascript
function getBarPosition(node, scaleConfig) {
  if (!node.startDate || !node.dueDate) return null;

  const startCol = scaleConfig.getColumnIndex(node.startDate);
  const endCol = scaleConfig.getColumnIndex(node.dueDate);

  if (startCol < 0 && endCol < 0) return null;  // 범위 밖
  if (startCol >= scaleConfig.columns && endCol >= scaleConfig.columns) return null;

  const clampedStart = Math.max(0, startCol);
  const clampedEnd = Math.min(scaleConfig.columns - 1, endCol);
  const span = clampedEnd - clampedStart + 1;

  return {
    left: `calc(${clampedStart} / ${scaleConfig.columns} * 100%)`,
    width: `calc(${span} / ${scaleConfig.columns} * 100%)`,
    clippedLeft: startCol < 0,   // 왼쪽이 잘렸는지 (바 왼쪽 끝 둥글기 제거)
    clippedRight: endCol >= scaleConfig.columns,
  };
}
```

**6-3. 오늘 라인**

```javascript
const todayIndex = scaleConfig.getColumnIndex(new Date());
const todayLineLeft = todayIndex >= 0 && todayIndex < scaleConfig.columns
  ? `calc((${todayIndex} + 0.5) / ${scaleConfig.columns} * 100%)`
  : null;
```

**6-4. 네비게이션 UI**

```jsx
// ◄ 이전 | 기간 레이블 | 다음 ► | [오늘]
<button onClick={() => setViewDate(scaleConfig.prevPeriod())}>◄ 이전</button>
<span>{scaleConfig.label}</span>
<button onClick={() => setViewDate(scaleConfig.nextPeriod())}>다음 ►</button>
<button onClick={() => setViewDate(new Date())}>오늘</button>
```

---

### 작업 7: 접기/펼치기

**7-1. 토글 버튼**

좌측 패널의 프로젝트/마일스톤 행에 ▶/▼ 버튼:

```jsx
// 접힌 상태: ▶ (children이 있을 때만 표시)
// 펼친 상태: ▼
{node.children.length > 0 && (
  <button onClick={() => toggleExpand(node.id)}>
    {expandedIds.has(node.id) ? '▼' : '▶'}
  </button>
)}
```

**7-2. 기본 확장 상태**

```javascript
// 초기화 시: depthFilter에 따라 기본 확장 설정
// depthFilter === 'project' → 아무것도 확장 안 함
// depthFilter === 'milestone' → 모든 프로젝트 확장
// depthFilter === 'task' → 모든 프로젝트 + 모든 마일스톤 확장
```

**7-3. depthFilter 변경 시 확장 상태 리셋**

```javascript
useEffect(() => {
  if (depthFilter === 'project') {
    setExpandedIds(new Set());
  } else if (depthFilter === 'milestone') {
    // 모든 프로젝트 노드 확장
    setExpandedIds(new Set(tree.filter(n => n.type === 'project').map(n => n.id)));
  } else {
    // 모든 프로젝트 + 마일스톤 확장
    const allExpandable = [];
    tree.forEach(p => {
      allExpandable.push(p.id);
      p.children.forEach(c => { if (c.type === 'milestone') allExpandable.push(c.id); });
    });
    setExpandedIds(new Set(allExpandable));
  }
}, [depthFilter, tree]);
```

---

### 작업 8: 진입점 통합

**8-1. 글로벌 타임라인 (기존 TimelineView 교체)**

```bash
# 기존 타임라인 뷰 파일 확인
find src/components -name "*[Tt]imeline*" | sort
```

기존 TimelineView를 TimelineEngine 래퍼로 교체:

```jsx
// src/components/views/TimelineView.jsx
function TimelineView() {
  return (
    <TimelineEngine
      rootLevel="project"
      projectId={null}
      initialScale="monthly"
      initialDepth="task"    // 기존과 동일한 초기 표시
    />
  );
}
```

**8-2. 프로젝트 타임라인 (ProjectView 타임라인 탭)**

```bash
# 프로젝트 뷰의 타임라인 탭 컴포넌트 확인
grep -rn "timeline\|타임라인" src/components/*[Pp]roject* --include="*.jsx" -l
```

기존 프로젝트 타임라인을 TimelineEngine 래퍼로 교체:

```jsx
// ProjectView의 타임라인 탭 내부
function ProjectTimeline({ projectId }) {
  return (
    <TimelineEngine
      rootLevel="milestone"
      projectId={projectId}
      initialScale="monthly"
      initialDepth="task"
    />
  );
}
```

**8-3. 기존 TimelineView의 DnD 유지**

현재 TimelineView에 간트바 드래그(기간 시프트), 리사이즈(시작일/마감일 변경), 프로젝트 간 이동 DnD가 구현되어 있다면, 이를 TimelineEngine 내부로 이식한다.

```bash
# 기존 DnD 핸들러 확인
grep -rn "onDrag\|handleDrag\|onResize\|handleResize" src/components/*[Tt]imeline* --include="*.jsx" -A 10
```

DnD 이벤트 핸들러에서 updateTask/moveTaskTo 호출 로직은 그대로 유지하되, 새 트리 구조의 node.raw를 참조하여 원본 데이터에 접근한다:

```javascript
// 기존: task.id, task.startDate 등 직접 접근
// 신규: node.raw.id, node.raw.startDate 등 원본 참조

const handleDragEnd = (nodeId, newStartDate, newDueDate) => {
  const node = findNode(tree, nodeId);
  if (!node) return;

  if (node.type === 'task') {
    updateTask(node.raw.id, { startDate: newStartDate, dueDate: newDueDate });
  }
  // 마일스톤/프로젝트 바 드래그 시:
  // → updateMilestone 또는 updateProject 호출
};
```

---

## 행 높이 및 들여쓰기

| 레벨 | 행 높이 | 좌측 들여쓰기 | 바 높이 | 바 상단 패딩 | 배경 |
|------|--------|------------|--------|-----------|------|
| 프로젝트 | 36px | 0px | 22px | 7px | background-secondary |
| 마일스톤 | 30px | 16px | 18px | 6px | transparent |
| 할일 | 26px | 32px | 14px | 6px | transparent |

---

## 좌측 패널 열 구성

```
┌──────────────────────────────────┐
│ ▶/▼  dot  이름          담당자  %  │
├──────────────────────────────────┤
│ 토글  색상  프로젝트/MS/할일  오너  진행률│
└──────────────────────────────────┘

열 너비:
- 토글: 16px (자식 없으면 빈 공간)
- dot: 8px (프로젝트) / 6px (마일스톤) / 없음 (할일: 체크박스 자리)
- 이름: flex: 1 (overflow: ellipsis)
- 담당자: 48px (이름 또는 이니셜, overflow: hidden)
- 진행률: 32px (프로젝트/MS만. 할일은 빈 공간)
```

---

## 호버 툴팁

바 위에 마우스 올리면 상세 정보 표시:

```
프로젝트 바:
  정기주총
  기간: 1/15 ~ 3/28 (72일)
  오너: Ryan Park
  진행률: 42% (5/12 마일스톤)
  상태: 진행 중

마일스톤 바:
  공증 준비
  기간: 2/1 ~ 3/10 (37일)  [상속됨]
  담당자: Ryan Park
  진행률: 33% (2/6 할일)

할일 바:
  안건 PPT - 수요일 오후 3시 Jason
  기간: 3/10 ~ 3/20
  담당자: Ryan
  상태: 오늘 할일
```

---

## 완료 검증 체크리스트

```
[ ] 1. buildTimelineTree가 프로젝트→마일스톤→할일 트리를 정상 생성
[ ] 2. applyDateInheritance:
       - 직접 기간이 있는 노드: inherited=false, 직접 값 유지
       - 기간 없고 하위 있는 노드: inherited=true, min/max 상속
       - 기간 없고 하위도 없는 노드: 바 없이 이름만 표시
[ ] 3. 깊이 필터 — 글로벌:
       - "프로젝트" → 프로젝트 바만 표시, 마일스톤/할일 숨김
       - "+ 마일스톤" → 프로젝트 헤더 + MS 바, 할일 숨김
       - "+ 할일" → 전체 3레벨 표시
[ ] 4. 깊이 필터 — 프로젝트:
       - "마일스톤" → MS 바 + 미연결 할일만
       - "+ 할일" → MS 그룹 + 하위 할일 전체
[ ] 5. 범위 필터: 전체/팀/개인 정상 작동
[ ] 6. 담당자 필터: 드롭다운 체크박스, 선택/해제 시 즉시 반영
[ ] 7. 프로젝트 필터: 글로벌에서만 표시, 선택 시 해당 프로젝트만
[ ] 8. 컬러 스킴:
       - 프로젝트 바: 프로젝트 색상 50 fill + 600 border + 진행률 400
       - 마일스톤 바: MS 색상(또는 프로젝트) 50 fill + 200 border + 진행률
       - 할일 바: 프로젝트 색상 200 단색
       - 완료 할일: gray 100 + 취소선
       - 상속 기간: 점선 테두리
[ ] 9. 시간 스케일:
       - 월간: 1일=1칸, 날짜 헤더, ◄►네비, 오늘 버튼
       - 분기: 1주=1칸, 주차 헤더 (W1~W13), ◄►네비
       - 연간: 1월=1칸, 월 헤더, ◄►네비
       - 모든 스케일에서 오늘 라인 표시
[ ] 10. 접기/펼치기:
       - ▶/▼ 토글 클릭 시 하위 노드 접힘/펼침
       - depthFilter 변경 시 확장 상태 자동 리셋
       - 접힌 프로젝트의 바는 여전히 표시
[ ] 11. 행 높이: 프로젝트 36px, 마일스톤 30px, 할일 26px
[ ] 12. 좌측 패널: 이름 + 담당자 + 진행률 열 정상 표시
[ ] 13. 호버 툴팁: 바 위에 마우스 올리면 상세 정보 표시
[ ] 14. 글로벌 타임라인 = TimelineEngine(rootLevel='project')
[ ] 15. 프로젝트 타임라인 = TimelineEngine(rootLevel='milestone')
[ ] 16. 두 뷰에서 필터/스케일/접기 동작이 완전히 동일
[ ] 17. 기존 DnD 유지:
       - 할일 바 드래그 → startDate/dueDate 변경
       - 할일 바 리사이즈 → startDate 또는 dueDate 변경
       - (마일스톤/프로젝트 바 드래그는 이번에 구현하지 않아도 됨 — 추후)
[ ] 18. 기존 기능 회귀 없음:
       - MatrixView, TodayView, ProjectView 정상
       - 할일 DetailPanel 정상
       - DnD로 할일 기간 변경 후 바 위치 즉시 반영
[ ] 19. 빌드 성공, 에러 0건
```

---

## 파일 구조

```
src/
├── utils/
│   └── timelineUtils.js         ← buildTimelineTree, applyDateInheritance,
│                                   getBarStyles, getScaleConfig, getBarPosition
├── components/
│   └── timeline/
│       ├── TimelineEngine.jsx    ← 핵심 엔진 (글로벌/프로젝트 공유)
│       ├── TimelineToolbar.jsx   ← 필터 + 스케일 + 네비게이션
│       ├── TimelineLeftPanel.jsx ← 좌측: 이름 + 담당자 + 진행률
│       ├── TimelineGrid.jsx      ← 우측: 헤더 + 간트바 + 오늘선
│       └── TimelineTooltip.jsx   ← 호버 툴팁
```

---

## 다음 단계

- **Loop-35 이후:** Minor 버그 수정, DnD silent failure 토스트, 마일스톤/프로젝트 바 드래그(기간 변경), 글로벌 뷰에서 마일스톤 모달 진입점 추가
