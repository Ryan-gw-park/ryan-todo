# Loop-26.2 — 프로젝트 레이어 셸 (Reference / Tasks / 병렬 보기 탭)

## 목표
사이드바에서 프로젝트를 클릭하면 진입하는 **프로젝트 레이어** 구현.  
프로젝트 헤더 + 3개 탭(Reference / Tasks / 병렬 보기) 셸만 구현.  
각 탭의 콘텐츠는 26.3~26.5에서 채움.

---

## 전제 조건
- Loop-26.1 완료 (사이드바 + 글로벌 뷰 전환 정상)

---

## 핵심 설계

### 뷰 전환 확장

기존 `currentView` 패턴을 확장한다.

```javascript
// 기존 (26.1까지)
currentView: 'today' | 'allTasks' | 'matrix' | 'project' | 'timeline' | 'memory'

// 26.2 추가
currentView: 'projectLayer'   // 프로젝트 레이어 진입 시
selectedProjectId: null        // 선택된 프로젝트 ID
projectLayerTab: 'ref'         // 'ref' | 'tasks' | 'parallel'
projectLayerTaskMode: 'list'   // 'list' | 'outliner' | 'timeline'
projectLayerParaMode: 'simple' // 'simple' | 'detail'
```

### useStore.js 변경 (최소)

```javascript
// 추가할 state
selectedProjectId: null,
projectLayerTab: 'ref',
projectLayerTaskMode: 'list',
projectLayerParaMode: 'simple',

// 추가할 action
enterProjectLayer: (projectId) => set({
  currentView: 'projectLayer',
  selectedProjectId: projectId,
  projectLayerTab: 'ref',
}),
setProjectLayerTab: (tab) => set({ projectLayerTab: tab }),
setProjectLayerTaskMode: (mode) => set({ projectLayerTaskMode: mode }),
setProjectLayerParaMode: (mode) => set({ projectLayerParaMode: mode }),
```

> **기존 state/action 수정 없음.** 새 state만 추가.

---

## 영향받는 파일

### 수정 대상
| 파일 | 변경 | 규모 |
|------|------|------|
| `src/hooks/useStore.js` | state 4개 + action 4개 추가 | S |
| `src/App.jsx` | AppShell의 views 객체에 `projectLayer: ProjectLayer` 추가 | S |
| `src/components/layout/Sidebar.jsx` | 프로젝트 클릭 시 `enterProjectLayer(id)` 호출 | S |

### 신규 생성
| 파일 | 역할 |
|------|------|
| `src/components/project/ProjectLayer.jsx` | 프로젝트 레이어 셸 (헤더 + 탭 + 모드바 + 콘텐츠) |
| `src/components/project/ProjectHeader.jsx` | 프로젝트 헤더 (닷 + 이름 + 메타 + 탭) |
| `src/components/project/ReferenceTab.jsx` | Reference 탭 (26.3에서 구현, 빈 상태) |
| `src/components/project/TasksTab.jsx` | Tasks 탭 (26.4에서 구현, 빈 상태) |
| `src/components/project/ParallelView.jsx` | 병렬 보기 (26.5에서 구현, 빈 상태) |

### 수정 금지
- 기존 `ProjectView.jsx` — 이 컴포넌트는 글로벌 뷰로서 존속. 프로젝트 레이어와 별개.

---

## ProjectLayer.jsx 명세

```jsx
// src/components/project/ProjectLayer.jsx
import useStore from '../../hooks/useStore'
import ProjectHeader from './ProjectHeader'
import ReferenceTab from './ReferenceTab'
import TasksTab from './TasksTab'
import ParallelView from './ParallelView'

export default function ProjectLayer() {
  const {
    selectedProjectId, projects,
    projectLayerTab, setProjectLayerTab,
    projectLayerTaskMode, setProjectLayerTaskMode,
    projectLayerParaMode, setProjectLayerParaMode,
  } = useStore()

  const project = projects.find(p => p.id === selectedProjectId)
  if (!project) return <div>프로젝트를 선택하세요</div>

  const tab = projectLayerTab
  const taskMode = projectLayerTaskMode
  const paraMode = projectLayerParaMode

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ProjectHeader
        project={project}
        currentTab={tab}
        onTabChange={setProjectLayerTab}
      />

      {/* 모드 바: Tasks와 병렬 보기에서만 표시 */}
      {tab === 'tasks' && (
        <ModeBar
          modes={[
            { key: 'list', label: '목록' },
            { key: 'outliner', label: '아웃라이너' },
            { key: 'timeline', label: '타임라인' },
          ]}
          current={taskMode}
          onChange={setProjectLayerTaskMode}
        />
      )}
      {tab === 'parallel' && (
        <ModeBar
          modes={[
            { key: 'simple', label: '타임라인' },
            { key: 'detail', label: '결과물 + Task' },
          ]}
          current={paraMode}
          onChange={setProjectLayerParaMode}
        />
      )}

      {/* 탭 콘텐츠 */}
      <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
        {tab === 'ref' && <ReferenceTab projectId={selectedProjectId} />}
        {tab === 'tasks' && <TasksTab projectId={selectedProjectId} mode={taskMode} />}
        {tab === 'parallel' && <ParallelView projectId={selectedProjectId} mode={paraMode} />}
      </div>
    </div>
  )
}
```

### ModeBar 컴포넌트 (ProjectLayer 내부 또는 별도 파일)

```jsx
function ModeBar({ modes, current, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 1,
      padding: '6px 20px', background: '#fafaf8',
      borderBottom: '0.5px solid #e8e6df', flexShrink: 0,
    }}>
      {modes.map(m => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          style={{
            fontSize: 11, padding: '4px 12px', borderRadius: 5,
            cursor: 'pointer', border: 'none', fontFamily: 'inherit',
            fontWeight: current === m.key ? 600 : 500,
            background: current === m.key ? '#e8e6df' : 'transparent',
            color: current === m.key ? '#2C2C2A' : '#a09f99',
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
```

---

## ProjectHeader.jsx 명세

```jsx
function ProjectHeader({ project, currentTab, onTabChange }) {
  const color = getColor(project.color)
  const tasks = useStore(s => s.tasks.filter(t => t.projectId === project.id && !t.deletedAt))
  const taskCount = tasks.filter(t => !t.done).length

  // TODO: 26.3 이후 미배정 결과물 수 계산
  const unassignedCount = 0

  const TABS = [
    { key: 'ref', label: 'Reference' },
    { key: 'tasks', label: 'Tasks', badge: String(taskCount) },
    { key: 'parallel', label: '병렬 보기', badgeWarn: unassignedCount > 0 ? `미배정 ${unassignedCount}` : null },
  ]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      height: 48, padding: '0 20px',
      background: '#fff', borderBottom: '0.5px solid #e8e6df', flexShrink: 0,
    }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color.dot }} />
      <span style={{ fontSize: 15, fontWeight: 600 }}>{project.name}</span>
      <span style={{ fontSize: 11, color: '#a09f99' }}>
        {/* 프로젝트 메타: 기간, 팀 이름 등 — 추후 확장 */}
        {project.teamId ? 'SCD팀' : '개인'}
      </span>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => onTabChange(t.key)}
            style={{
              fontSize: 12, padding: '5px 14px', borderRadius: 7,
              cursor: 'pointer', border: 'none', fontFamily: 'inherit',
              fontWeight: currentTab === t.key ? 600 : 500,
              background: currentTab === t.key ? '#f0efe8' : 'transparent',
              color: currentTab === t.key ? '#2C2C2A' : '#a09f99',
            }}
          >
            {t.label}
            {t.badge && <span style={{ fontSize: 10, background: '#e8e6df', borderRadius: 999, padding: '1px 7px', marginLeft: 4, color: '#a09f99' }}>{t.badge}</span>}
            {t.badgeWarn && <span style={{ fontSize: 10, background: '#FAEEDA', borderRadius: 999, padding: '1px 7px', marginLeft: 4, color: '#854F0B' }}>{t.badgeWarn}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
```

---

## Sidebar.jsx 프로젝트 클릭 수정

```javascript
// 26.1에서는 setView('project')였던 부분을 변경
function handleProjectClick(projectId) {
  enterProjectLayer(projectId)
}
```

### 사이드바 활성 상태

```javascript
// 글로벌 뷰
const isGlobalActive = (key) => currentView === key

// 프로젝트
const isProjectActive = (projectId) =>
  currentView === 'projectLayer' && selectedProjectId === projectId
```

---

## App.jsx views 객체 수정

```javascript
const views = {
  today: TodayView,
  allTasks: AllTasksView,
  matrix: teamId ? TeamMatrixView : MatrixView,
  project: ProjectView,        // 기존 글로벌 ProjectView 유지
  timeline: TimelineView,
  memory: MemoryView,
  projectLayer: ProjectLayer,  // ★ 신규
}
```

---

## 빈 탭 콘텐츠 (26.3~26.5 구현 전 임시)

### ReferenceTab.jsx (임시)
```jsx
export default function ReferenceTab({ projectId }) {
  return (
    <div style={{ padding: 40, color: '#b4b2a9', textAlign: 'center' }}>
      Reference 탭 — Loop-26.3에서 구현 예정
    </div>
  )
}
```

### TasksTab.jsx (임시)
```jsx
export default function TasksTab({ projectId, mode }) {
  return (
    <div style={{ padding: 40, color: '#b4b2a9', textAlign: 'center' }}>
      Tasks 탭 ({mode} 모드) — Loop-26.4에서 구현 예정
    </div>
  )
}
```

### ParallelView.jsx (임시)
```jsx
export default function ParallelView({ projectId, mode }) {
  return (
    <div style={{ padding: 40, color: '#b4b2a9', textAlign: 'center' }}>
      병렬 보기 ({mode} 모드) — Loop-26.5에서 구현 예정
    </div>
  )
}
```

---

## 뒤로가기 동선

사이드바에서 글로벌 뷰를 클릭하면 프로젝트 레이어에서 자연스럽게 빠져나온다.
(currentView가 'today' 등으로 바뀌면서 ProjectLayer가 언마운트)

브라우저 뒤로가기는 현재 앱이 클라이언트 사이드 라우팅을 제한적으로만 쓰므로,
History API 통합은 이 Loop에서 하지 않는다.

---

## 검증 체크리스트

### 기능 검증
- [ ] 사이드바 프로젝트 클릭 → 프로젝트 레이어 진입 (ProjectHeader 표시)
- [ ] Reference / Tasks / 병렬 보기 탭 전환 정상
- [ ] Tasks 탭 → 목록/아웃라이너/타임라인 모드 바 표시 및 전환
- [ ] 병렬 보기 → 타임라인/결과물+Task 모드 바 표시 및 전환
- [ ] Reference 탭 → 모드 바 미표시
- [ ] 사이드바에서 글로벌 뷰 클릭 → 프로젝트 레이어 퇴장
- [ ] 사이드바에서 다른 프로젝트 클릭 → 프로젝트 전환
- [ ] 프로젝트 헤더에 Tasks 수 badge 표시
- [ ] 사이드바 프로젝트 항목 활성 상태 표시

### 회귀 검증
- [ ] 기존 글로벌 뷰 5개 모두 정상
- [ ] DetailPanel 정상 동작
- [ ] 모바일 레이아웃 미영향
- [ ] `npm run build` 성공

---

## 주의사항

- **기존 ProjectView (글로벌)는 건드리지 않는다.** `currentView === 'project'`일 때 기존 ProjectView가 렌더링되는 경로는 그대로 유지. 사이드바에서 프로젝트를 클릭하면 `projectLayer`로 진입하므로 별도 경로.
- **26.2에서는 탭 콘텐츠를 빈 상태로 둔다.** 각 탭의 실제 구현은 26.3~26.5에서 순차적으로 채움.
- **모드 바의 모드 상태는 Zustand에 저장** — 탭 전환 후 돌아와도 이전 모드가 유지됨.
