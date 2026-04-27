# Loop-XX: 사이드바 재구조 + TodayView/AllTasksView 삭제

## REQ-LOCK 요구사항

1. **글로벌 뷰 섹션 완전 제거** — 사이드바에서 "지금 할일", "전체 할일" 메뉴 항목 + "글로벌 뷰" 섹션 라벨 삭제
2. **TodayView, AllTasksView 컴포넌트 파일 삭제**
3. **사이드바 섹션 순서 = 개인 → 팀 → 프로젝트** (모든 사용자에게 개인 먼저)
4. **노트(memory)는 개인 섹션 안으로 이동** — 팀 섹션에는 노트 없음
5. **기존 "할일" 부모 라벨 + 팀/개인 sub-section 헤더 구조 폐기** → 개인/팀이 top-level 섹션
6. **앱 첫 진입 화면 = 개인 매트릭스** (`personal-matrix`)
7. **UnifiedGridView 우상단 `[팀|개인]` 토글 제거** — scope는 사이드바 위치(prop)로만 결정
8. **URL/store 마이그레이션** — 기존 `/today`, `/all-tasks` URL 또는 `currentView='today'/'allTasks'` 진입 시 `personal-matrix`로 리다이렉트 (북마크/로컬스토리지 호환)
9. **모바일 메뉴(MobileDrawer) 정리** — `today`/`allTasks` 탭 제거
10. **DELETE-5 cascade 전체 검증**

---

## 결정 사항 (사용자 추가 확인 권장)

### D1. 모바일 grid view 리다이렉트
현재 `App.jsx` line 97-101에서 모바일 사용자가 `team-*` / `personal-*` 뷰 진입 시 강제로 `today`로 리다이렉트하는 로직이 있음. TodayView가 사라지므로 이 로직은:
- **선택 A (적용)**: 리다이렉트 대상을 `personal-matrix`로 변경. UnifiedGridView가 모바일에서 가로 스크롤로 표시되지만 기능적으로는 동작.
- 선택 B: 리다이렉트 자체를 제거. → 동일 결과.

→ **선택 A로 진행**. 모바일 grid UX 개선은 별도 follow-up.

### D2. BottomNav.jsx, TopNav.jsx 처리
이 두 파일은 import 검색 결과 **어디서도 사용되지 않는 dead code**이지만 `today`/`allTasks` 키를 참조함.
- **선택 A (적용)**: 같은 commit에서 두 파일 삭제. DELETE-5 원칙에 부합.
- 선택 B: 그대로 둠 → dead code 누적.

→ **선택 A로 진행**.

---

## 영향 파일 목록

| 파일 | 종류 | 변경 요약 |
|---|---|---|
| `src/components/views/TodayView.jsx` | **DELETE** | 전체 삭제 |
| `src/components/views/AllTasksView.jsx` | **DELETE** | 전체 삭제 |
| `src/components/layout/BottomNav.jsx` | **DELETE** | dead code |
| `src/components/layout/TopNav.jsx` | **DELETE** | dead code |
| `src/App.jsx` | EDIT | lazy import 2건 제거, idle preload 1건 제거, VIEW_ORDER 수정, views map 수정, fallback 수정, 모바일 redirect 수정 |
| `src/hooks/useStore.js` | EDIT | `currentView` 기본값 변경, LEGACY_MAP 수정 |
| `src/hooks/useViewUrlSync.js` | EDIT | VIEW_TO_PATH에서 today/allTasks 제거, 기본 redirect 변경 |
| `src/components/layout/Sidebar.jsx` | EDIT | GLOBAL_VIEWS 제거, 섹션 렌더 재구조 (개인 → 팀 → 프로젝트), 노트 개인으로 이동 |
| `src/components/views/UnifiedGridView.jsx` | EDIT | `[팀\|개인]` Pill 제거, scope state → 상수화 |
| `src/components/layout/MobileDrawer.jsx` | EDIT | TABS에서 today/allTasks 제거, personal-matrix 추가 |

---

## 1. DELETE: `src/components/views/TodayView.jsx`

```bash
rm src/components/views/TodayView.jsx
```

## 2. DELETE: `src/components/views/AllTasksView.jsx`

```bash
rm src/components/views/AllTasksView.jsx
```

## 3. DELETE: `src/components/layout/BottomNav.jsx`

```bash
rm src/components/layout/BottomNav.jsx
```

## 4. DELETE: `src/components/layout/TopNav.jsx`

```bash
rm src/components/layout/TopNav.jsx
```

---

## 5. EDIT: `src/App.jsx`

### 5-1. lazy import 제거
```js
// OLD
const TodayView = lazy(() => import('./components/views/TodayView'))
const AllTasksView = lazy(() => import('./components/views/AllTasksView'))
// MatrixView removed — replaced by UnifiedGridView
const ProjectView = lazy(() => import('./components/views/ProjectView'))
```
```js
// NEW
// MatrixView removed — replaced by UnifiedGridView
// TodayView, AllTasksView removed — personal-matrix is now the default landing view
const ProjectView = lazy(() => import('./components/views/ProjectView'))
```

### 5-2. idle preload 수정
```js
// OLD
    idle(() => {
      import('./components/views/TodayView')
      import('./components/views/ProjectView')
      import('./components/views/TimelineView')
      import('./components/views/MemoryView')
    })
```
```js
// NEW
    idle(() => {
      import('./components/views/UnifiedGridView')
      import('./components/views/ProjectView')
      import('./components/views/InlineTimelineView')
      import('./components/views/MemoryView')
    })
```

### 5-3. VIEW_ORDER 수정 (개인 우선, today/allTasks 제거)
```js
// OLD
  const VIEW_ORDER = ['today', 'allTasks', 'team-matrix', 'team-timeline', 'team-weekly', 'personal-matrix', 'personal-timeline', 'personal-weekly', 'memory']
```
```js
// NEW
  const VIEW_ORDER = ['personal-matrix', 'personal-weekly', 'personal-timeline', 'memory', 'team-matrix', 'team-weekly', 'team-timeline']
```

### 5-4. views map 수정
```js
// OLD
  const views = useMemo(() => ({
    today: TodayView, allTasks: AllTasksView, memory: MemoryView,
    'team-matrix': () => <UnifiedGridView initialView="matrix" initialScope="team" />,
    'team-timeline': InlineTimelineView,
    'team-weekly': () => <UnifiedGridView initialView="weekly" initialScope="team" />,
    'personal-matrix': () => <UnifiedGridView initialView="matrix" initialScope="personal" />,
    'personal-timeline': () => <InlineTimelineView scope="personal" />,
    'personal-weekly': () => <UnifiedGridView initialView="weekly" initialScope="personal" />,
    project: ProjectView, projectLayer: ProjectLayer,
  }), [])
  const ViewComponent = views[currentView] || TodayView
```
```js
// NEW
  const views = useMemo(() => ({
    memory: MemoryView,
    'team-matrix': () => <UnifiedGridView initialView="matrix" initialScope="team" />,
    'team-timeline': InlineTimelineView,
    'team-weekly': () => <UnifiedGridView initialView="weekly" initialScope="team" />,
    'personal-matrix': () => <UnifiedGridView initialView="matrix" initialScope="personal" />,
    'personal-timeline': () => <InlineTimelineView scope="personal" />,
    'personal-weekly': () => <UnifiedGridView initialView="weekly" initialScope="personal" />,
    project: ProjectView, projectLayer: ProjectLayer,
  }), [])
  const ViewComponent = views[currentView] || views['personal-matrix']
```

### 5-5. 모바일 redirect 수정
```js
// OLD
  // 모바일에서 team/personal scope 뷰 접근 시 today로 리다이렉트
  useEffect(() => {
    if (mobile && (currentView.startsWith('team-') || currentView.startsWith('personal-'))) {
      setView('today')
    }
  }, [currentView, mobile])
```
```js
// NEW
  // 모바일에서 team scope 뷰 접근 시 personal-matrix로 리다이렉트
  // (personal-* 는 모바일에서도 허용 — UnifiedGridView 가로 스크롤)
  useEffect(() => {
    if (mobile && currentView.startsWith('team-')) {
      setView('personal-matrix')
    }
  }, [currentView, mobile])
```

---

## 6. EDIT: `src/hooks/useStore.js`

### 6-1. currentView 기본값
```js
// OLD
  currentView: 'today',
```
```js
// NEW
  currentView: 'personal-matrix',
```

### 6-2. LEGACY_MAP — today/allTasks 마이그레이션
```js
// OLD
  setView: (v) => {
    const LEGACY_MAP = { matrix: 'team-matrix', timeline: 'team-timeline', weekly: 'team-weekly', now: 'today' }
    set({ currentView: LEGACY_MAP[v] || v })
  },
```
```js
// NEW
  setView: (v) => {
    const LEGACY_MAP = {
      matrix: 'team-matrix', timeline: 'team-timeline', weekly: 'team-weekly',
      now: 'personal-matrix', today: 'personal-matrix', allTasks: 'personal-matrix',
    }
    set({ currentView: LEGACY_MAP[v] || v })
  },
```

---

## 7. EDIT: `src/hooks/useViewUrlSync.js`

### 7-1. VIEW_TO_PATH 정리
```js
// OLD
const VIEW_TO_PATH = {
  today:               '/today',
  allTasks:            '/all-tasks',
  memory:              '/notes',
  'team-matrix':       '/team/matrix',
  'team-timeline':     '/team/timeline',
  'team-weekly':       '/team/weekly',
  'personal-matrix':   '/personal/matrix',
  'personal-timeline': '/personal/timeline',
  'personal-weekly':   '/personal/weekly',
  project:             '/projects',
}
```
```js
// NEW
const VIEW_TO_PATH = {
  memory:              '/notes',
  'team-matrix':       '/team/matrix',
  'team-timeline':     '/team/timeline',
  'team-weekly':       '/team/weekly',
  'personal-matrix':   '/personal/matrix',
  'personal-timeline': '/personal/timeline',
  'personal-weekly':   '/personal/weekly',
  project:             '/projects',
}

// Legacy URL aliases — 북마크 호환 (구 URL → personal-matrix)
const LEGACY_PATHS = new Set(['/today', '/all-tasks'])
```

### 7-2. URL → view 매칭에 legacy 처리 추가
```js
// OLD
    const view = PATH_TO_VIEW[path]
    if (view) {
      skipUrlUpdate.current = true
      setView(view)
      initialized.current = true
      return
    }

    skipUrlUpdate.current = true
    setView('today')
    initialized.current = true
    if (path === '/' || !view) {
      skipViewUpdate.current = true
      navigate('/today', { replace: true })
    }
```
```js
// NEW
    const view = PATH_TO_VIEW[path]
    if (view) {
      skipUrlUpdate.current = true
      setView(view)
      initialized.current = true
      return
    }

    // Legacy URL (/today, /all-tasks) 또는 알 수 없는 경로 → personal-matrix
    skipUrlUpdate.current = true
    setView('personal-matrix')
    initialized.current = true
    if (path === '/' || LEGACY_PATHS.has(path) || !view) {
      skipViewUpdate.current = true
      navigate('/personal/matrix', { replace: true })
    }
```

### 7-3. 기본 fallback path 변경
```js
// OLD
      targetPath = VIEW_TO_PATH[currentView] || '/today'
```
```js
// NEW
      targetPath = VIEW_TO_PATH[currentView] || '/personal/matrix'
```

---

## 8. EDIT: `src/components/layout/Sidebar.jsx`

### 8-1. GLOBAL_VIEWS 상수 제거
```js
// OLD
const GLOBAL_VIEWS = [
  { key: 'today',    label: '지금 할일',  icon: '📋' },
  { key: 'allTasks', label: '전체 할일',  icon: '📑' },
  { key: 'memory',   label: '노트',       icon: '✎' },
]

const TASK_VIEWS = [
  { key: 'matrix',   label: '매트릭스',   icon: '⊞' },
  { key: 'timeline', label: '타임라인',   icon: '▤' },
  { key: 'weekly',   label: '주간 플래너', icon: '📅' },
]
```
```js
// NEW
const TASK_VIEWS = [
  { key: 'matrix',   label: '매트릭스',   icon: '⊞' },
  { key: 'weekly',   label: '주간 플래너', icon: '📅' },
  { key: 'timeline', label: '타임라인',   icon: '▤' },
]
```

> 참고: 사용자 요구사항 순서 = 매트릭스 → 주간 플래너 → 타임라인 (개인 뷰 (매트릭스, 주간 플래너, 타임라인, 노트))

### 8-2. 섹션 렌더 — 글로벌 뷰 + 할일 부모 라벨 + sub-section 헤더 폐기, 개인/팀/프로젝트 3-section 구조
```jsx
// OLD
      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: `${S.dividerMy}px 0` }}>
        {/* ─── Section 1: 글로벌 뷰 ─── */}
        {!collapsed && <SectionLabel label="글로벌 뷰" />}
        {GLOBAL_VIEWS.map(v => (
          <NavItem key={v.key} icon={v.icon} label={v.label} isActive={currentView === v.key} onClick={() => setView(v.key)} collapsed={collapsed} />
        ))}

        <Divider />

        {/* ─── Section 2: 할일 ─── */}
        {!collapsed && <SectionLabel label="할일" />}

        {/* 팀 subsection */}
        {currentTeamId && !collapsed && (
          <SubSectionHeader label="팀" collapsed={sectionCollapsed.taskTeam} onClick={() => toggleSection('taskTeam')} />
        )}
        {currentTeamId && !sectionCollapsed.taskTeam && TASK_VIEWS.map(v => (
          <NavItem key={`team-${v.key}`} icon={v.icon} label={v.label}
            isActive={currentView === `team-${v.key}`}
            onClick={() => setView(`team-${v.key}`)}
            collapsed={collapsed}
            indent={collapsed ? 0 : 1}
          />
        ))}

        {/* 개인 subsection */}
        {!collapsed && (
          <SubSectionHeader label="개인" collapsed={sectionCollapsed.taskPersonal} onClick={() => toggleSection('taskPersonal')} />
        )}
        {!sectionCollapsed.taskPersonal && TASK_VIEWS.map(v => (
          <NavItem key={`personal-${v.key}`} icon={v.icon} label={v.label}
            isActive={currentView === `personal-${v.key}`}
            onClick={() => setView(`personal-${v.key}`)}
            collapsed={collapsed}
            indent={collapsed ? 0 : 1}
          />
        ))}

        <Divider />

        {/* ─── Section 3: 프로젝트 ─── */}
```
```jsx
// NEW
      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: `${S.dividerMy}px 0` }}>
        {/* ─── Section 1: 개인 ─── */}
        {!collapsed && <SectionLabel label="개인" />}
        {TASK_VIEWS.map(v => (
          <NavItem key={`personal-${v.key}`} icon={v.icon} label={v.label}
            isActive={currentView === `personal-${v.key}`}
            onClick={() => setView(`personal-${v.key}`)}
            collapsed={collapsed}
          />
        ))}
        <NavItem icon="✎" label="노트" isActive={currentView === 'memory'} onClick={() => setView('memory')} collapsed={collapsed} />

        {/* ─── Section 2: 팀 (currentTeamId 있을 때만) ─── */}
        {currentTeamId && (
          <>
            <Divider />
            {!collapsed && <SectionLabel label="팀" />}
            {TASK_VIEWS.map(v => (
              <NavItem key={`team-${v.key}`} icon={v.icon} label={v.label}
                isActive={currentView === `team-${v.key}`}
                onClick={() => setView(`team-${v.key}`)}
                collapsed={collapsed}
              />
            ))}
          </>
        )}

        <Divider />

        {/* ─── Section 3: 프로젝트 ─── */}
```

> 참고: `taskTeam`, `taskPersonal` sub-section collapse 상태 키는 더 이상 렌더되지 않음. localStorage `sidebarSections` 값에 남아있어도 무해 (다음 toggleSection 호출 시 자연 정리됨). 명시적 클린업 불필요.

---

## 9. EDIT: `src/components/views/UnifiedGridView.jsx`

### 9-1. scope state → 상수
```js
// OLD
export default function UnifiedGridView({ initialView = 'matrix', initialScope = 'personal' }) {
  const [view, setView] = useState(initialView) // 'matrix' | 'weekly'
  const [scope, setScope] = useState(initialScope) // 'team' | 'personal'
```
```js
// NEW
export default function UnifiedGridView({ initialView = 'matrix', initialScope = 'personal' }) {
  const [view, setView] = useState(initialView) // 'matrix' | 'weekly'
  const scope = initialScope // 'team' | 'personal' — 사이드바 위치로만 결정, 토글 없음
```

### 9-2. `[팀|개인]` Pill 제거
```jsx
// OLD
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: FONT.subtitle, color: COLOR.textTertiary }}>{view === 'matrix' ? dateStr : weekRange}</span>
            <div style={{ flex: 1 }} />
            <Pill items={[{ k: 'team', l: '팀' }, { k: 'personal', l: '개인' }]} active={scope} onChange={setScope} />
            {view === 'weekly' && (
```
```jsx
// NEW
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: FONT.subtitle, color: COLOR.textTertiary }}>{view === 'matrix' ? dateStr : weekRange}</span>
            <div style={{ flex: 1 }} />
            {view === 'weekly' && (
```

---

## 10. EDIT: `src/components/layout/MobileDrawer.jsx`

### 10-1. TABS 정리
```js
// OLD
const TABS = [
  { id: 'today', label: '지금 할일', icon: ViewIcons.today },
  { id: 'allTasks', label: '전체 할일', icon: '📋' },
  { id: 'project', label: '프로젝트', icon: ViewIcons.project },
  { id: 'memory', label: '노트', icon: ViewIcons.memory },
]
```
```js
// NEW
const TABS = [
  { id: 'personal-matrix', label: '매트릭스', icon: ViewIcons.matrix },
  { id: 'personal-weekly', label: '주간 플래너', icon: '📅' },
  { id: 'project', label: '프로젝트', icon: ViewIcons.project },
  { id: 'memory', label: '노트', icon: ViewIcons.memory },
]
```

---

## DELETE-5 검증 결과

| 삭제 대상 | ① import | ② caller | ③ props | ④ deps | ⑤ types | 처리 |
|---|---|---|---|---|---|---|
| `TodayView` 컴포넌트 | App.jsx L21, L56 ✓ | App.jsx L85 (views map), L94 (fallback), L99 (mobile redirect) ✓ | — | 자체 파일 ✓ | — | 파일 삭제 + 6곳 cascade |
| `AllTasksView` 컴포넌트 | App.jsx L22 ✓ | App.jsx L85 (views map) ✓ | — | 자체 파일 ✓ | — | 파일 삭제 + 2곳 cascade |
| `BottomNav` 컴포넌트 | (없음 — 모든 import 검색 0건) | (없음) | — | TABS 상수, ViewIcons import ✓ | — | dead code 파일 삭제 |
| `TopNav` 컴포넌트 | (없음 — 모든 import 검색 0건) | (없음) | — | TABS 상수, ViewIcons import ✓ | — | dead code 파일 삭제 |
| `GLOBAL_VIEWS` 상수 | (Sidebar.jsx 내부) | Sidebar.jsx L203 ✓ | — | — | — | 상수 삭제 + map 렌더 삭제 |
| `taskTeam`/`taskPersonal` collapse keys | — | Sidebar.jsx 두 SubSectionHeader ✓ | — | localStorage `sidebarSections` (자연 정리) | — | 렌더 코드 삭제, 잔존 데이터 무해 |
| `setScope` setter | — | UnifiedGridView L214 (Pill onChange) ✓ | — | `scope` state → 상수화 ✓ | — | useState→상수, Pill 삭제 |
| `today` view key | LEGACY_MAP에 alias 추가로 마이그레이션 | App.jsx VIEW_ORDER, useViewUrlSync VIEW_TO_PATH, MobileDrawer TABS, BottomNav TABS, TopNav TABS, Sidebar GLOBAL_VIEWS ✓ | — | — | — | 모든 활성 참조 제거, legacy alias 유지 |
| `allTasks` view key | LEGACY_MAP에 alias 추가로 마이그레이션 | App.jsx VIEW_ORDER, useViewUrlSync VIEW_TO_PATH, MobileDrawer TABS, BottomNav TABS, TopNav TABS, Sidebar GLOBAL_VIEWS ✓ | — | — | — | 모든 활성 참조 제거, legacy alias 유지 |

### 잔여 import 검증
- [x] `App.jsx`: TodayView, AllTasksView import 제거 → 본문 사용 0건 확인
- [x] `Sidebar.jsx`: GLOBAL_VIEWS 제거 후 본문 사용 0건 확인 (TASK_VIEWS는 유지)
- [x] `MobileDrawer.jsx`: ViewIcons.today 참조 제거됨, ViewIcons import는 다른 항목(matrix/project/memory) 때문에 유지
- [x] `useViewUrlSync.js`: PATH_TO_VIEW는 VIEW_TO_PATH에서 자동 파생 → 별도 수정 불필요

### 잔여 변수 검증
- [x] `setScope`: Pill 삭제 후 사용처 0건 → useState 상수화로 제거
- [x] `taskTeam`/`taskPersonal` 키: SubSectionHeader 두 곳 삭제 후 사용처 0건
- [x] `category: 'today'` (task 카테고리): 절대 건드리지 않음 — 이는 view key가 아니라 task DB 컬럼 값
- [x] `CATEGORIES` in `colors.js`: `today/next/backlog/done`은 task category 정의이므로 보존

### category vs view 구분 (TDZ 주의 — 중요)
이 diff에서 절대 변경 금지:
- `src/utils/colors.js` line 21 — `{ key: 'today', label: '오늘 할일' }` (task category)
- `src/components/views/UnifiedGridView.jsx` line 24 — `{ key: 'today', label: '지금 할일' }` (matrix column category)
- `src/hooks/useTeam.js` 모든 `category: 'today'` (task 생성 시 기본 카테고리)
- `src/components/project/CompactMilestoneTab.jsx`, `KeyMilestoneTab.jsx`, `MilestoneOutlinerView.jsx`의 `category: 'today'` (동일)
- `src/hooks/useStore.js` line 516 `category: 'today'` (addTask 기본값)
- `src/styles/designTokens.js` line 74 주석 (단순 주석)

이들은 전부 **task 카테고리 필드 값**이며, 우리가 삭제하는 **view key** `'today'`와는 별개의 네임스페이스.

---

## REQ-LOCK 검증

| # | 요구사항 | 적용 위치 | 확인 |
|---|---|---|---|
| 1 | 글로벌 뷰 섹션 제거 | Sidebar.jsx 8-1, 8-2 | ✓ |
| 2 | TodayView/AllTasksView 파일 삭제 | DELETE 1, 2 | ✓ |
| 3 | 섹션 순서 = 개인 → 팀 → 프로젝트 | Sidebar.jsx 8-2 | ✓ |
| 4 | 노트는 개인 섹션 안 | Sidebar.jsx 8-2 (NavItem 노트 ‖ TASK_VIEWS 직후) | ✓ |
| 5 | "할일" 부모 라벨 + sub-section 헤더 폐기 | Sidebar.jsx 8-2 | ✓ |
| 6 | 첫 진입 = personal-matrix | useStore.js 6-1, useViewUrlSync.js 7-2/7-3, App.jsx 5-4 fallback | ✓ |
| 7 | UnifiedGridView `[팀\|개인]` 토글 제거 | UnifiedGridView.jsx 9-1, 9-2 | ✓ |
| 8 | 레거시 URL/view key 호환 | useStore.js 6-2 LEGACY_MAP, useViewUrlSync.js 7-2 LEGACY_PATHS | ✓ |
| 9 | MobileDrawer today/allTasks 제거 | MobileDrawer.jsx 10-1 | ✓ |
| 10 | DELETE-5 검증 | 위 표 | ✓ |

---

## 적용 후 빌드 검증 권장 명령

```bash
# 1. 전체 빌드
npm run build

# 2. 잔존 참조 grep (둘 다 0건이어야 함 — colors.js / UnifiedGridView line 24 / *category* 제외)
grep -rn "TodayView\|AllTasksView" src/ --include="*.jsx" --include="*.js"
grep -rn "GLOBAL_VIEWS\|글로벌 뷰" src/ --include="*.jsx" --include="*.js"

# 3. dead nav 파일 삭제 확인
ls src/components/layout/BottomNav.jsx src/components/layout/TopNav.jsx 2>&1 | grep "No such"
```

## 커밋 전략

R-ATOMIC 단일 커밋 1개:
```
refactor(sidebar): restructure sidebar to 개인/팀/프로젝트, drop TodayView+AllTasksView

- Delete TodayView, AllTasksView, BottomNav (dead), TopNav (dead)
- Sidebar: drop 글로벌 뷰 + 할일 sub-section headers, top-level 개인/팀/프로젝트
- 개인 section now contains 매트릭스/주간/타임라인/노트
- Default landing view: personal-matrix
- UnifiedGridView: remove [팀|개인] toggle, scope is prop-only
- Legacy URL/view migration: today, allTasks → personal-matrix
- MobileDrawer: replace today/allTasks with personal-matrix/personal-weekly
```
