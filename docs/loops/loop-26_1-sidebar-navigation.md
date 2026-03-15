# Loop-26.1 — 사이드바 네비게이션 (TopNav 대체)

## 목표
상단 네비게이션 바(TopNav)를 제거하고, 좌측 사이드바로 모든 네비게이션을 이전.  
기존 글로벌 뷰 5개(오늘 할일/매트릭스/타임라인/노트 + 전체 할일)는 기능 변경 없이 진입점만 이동.

---

## 전제 조건
- Loop-26.0 완료 (DB 스키마)
- 기존 모든 뷰 정상 동작 확인

---

## 핵심 원칙

1. **기존 뷰 컴포넌트 수정 금지** — TodayView, MatrixView, TeamMatrixView, ProjectView, TimelineView, MemoryView, AllTasksView 내부 코드 일절 변경하지 않는다
2. **Zustand `currentView` 패턴 유지** — 뷰 전환은 기존과 동일하게 `setView(key)` 방식
3. **프로젝트 레이어 진입은 26.2에서** — 이 Loop에서는 사이드바 + 글로벌 뷰 전환만 구현
4. **모바일 대응은 별도 Loop** — 데스크탑 사이드바만 이 Loop에서 구현. 모바일은 기존 BottomNav/MobileDrawer 유지

---

## 영향받는 파일

### 수정 대상
| 파일 | 변경 내용 | 규모 |
|------|----------|------|
| `src/App.jsx` | AppShell 레이아웃 변경 (사이드바 + 메인 영역) | M |
| `src/components/layout/TopNav.jsx` | 데스크탑에서 숨김 처리 (삭제 아님, 모바일 호환용) | S |

### 신규 생성
| 파일 | 역할 |
|------|------|
| `src/components/layout/Sidebar.jsx` | 좌측 사이드바 전체 |

### 수정 금지
- `src/components/views/*.jsx` — 모든 뷰 컴포넌트
- `src/hooks/useStore.js` — currentView 관련 로직 (이미 충분)
- `src/components/shared/*.jsx` — 공유 컴포넌트

---

## Sidebar.jsx 명세

### 구조

```
Sidebar
├── SidebarTop
│   ├── Logo (R 아이콘 + "Ryan's Todo")
│   └── TeamSwitcher (기존 TeamSwitcher 컴포넌트 재사용)
│
├── SidebarScroll (flex:1, overflow-y:auto)
│   ├── SectionLabel "글로벌 뷰"
│   ├── NavItem "오늘 할일"      → setView('today')
│   ├── NavItem "전체 할일"      → setView('allTasks')   ← 데스크탑에서도 표시
│   ├── NavItem "매트릭스"       → setView('matrix')
│   ├── NavItem "타임라인"       → setView('timeline')
│   ├── NavItem "노트"           → setView('memory')
│   ├── Divider
│   ├── SectionLabel "팀 프로젝트" + "+" 버튼
│   ├── ProjectItem[] (team_id가 있는 프로젝트)
│   ├── Divider
│   ├── SectionLabel "개인 프로젝트" + "+" 버튼
│   └── ProjectItem[] (team_id가 null인 프로젝트)
│
└── SidebarFooter
    ├── HelpItem "도움말"  → navigate('/help')
    ├── NotificationItem (알림 벨 + 읽지 않은 수)  → toggleNotificationPanel()
    ├── Divider
    └── ProfileItem (아바타 + 이름 + 이메일)  → navigate('/profile')
```

### 데이터 소스

```javascript
// Sidebar.jsx
import useStore from '../../hooks/useStore'

function Sidebar() {
  const {
    currentView, setView,
    projects, currentTeamId,
    showNotificationPanel, toggleNotificationPanel,
    userName,
  } = useStore()

  // 프로젝트 분리
  const teamProjects = projects.filter(p => p.teamId)
  const personalProjects = projects.filter(p => !p.teamId)

  // 프로젝트 클릭 시
  function handleProjectClick(projectId) {
    // 26.2에서 프로젝트 레이어 진입으로 확장
    // 26.1에서는 기존 ProjectView로 이동 + 프로젝트 필터 설정
    setView('project')
    // useProjectFilter 또는 store의 projectFilter 활용
  }
}
```

### 글로벌 뷰 아이템 정의

```javascript
const GLOBAL_VIEWS = [
  { key: 'today',    label: '오늘 할일',  icon: '📋' },
  { key: 'allTasks', label: '전체 할일',  icon: '📑' },
  { key: 'matrix',   label: '매트릭스',   icon: '⊞' },
  { key: 'timeline', label: '타임라인',   icon: '▤' },
  { key: 'memory',   label: '노트',       icon: '✎' },
]
```

> **"전체 할일"을 데스크탑에서도 표시.** 현재 모바일 전용이지만, 사이드바에서 접근할 수 있어야 함.
> AllTasksView 컴포넌트 자체는 수정하지 않음.

### 프로젝트 아이템

```javascript
function ProjectItem({ project, isActive, onClick }) {
  const color = getColor(project.color) // 기존 colors.js 활용

  return (
    <div
      onClick={() => onClick(project.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 12px', borderRadius: 7, margin: '1px 6px',
        cursor: 'pointer', fontSize: 13,
        background: isActive ? '#f0efe8' : 'transparent',
        color: isActive ? '#2C2C2A' : '#6b6a66',
        fontWeight: isActive ? 500 : 400,
      }}
    >
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color.dot, flexShrink: 0,
      }} />
      {project.name}
    </div>
  )
}
```

### TeamSwitcher 재사용

```javascript
// 기존 TeamSwitcher.jsx를 사이드바 상단에 배치
// props 변경 없이 그대로 import
import TeamSwitcher from '../team/TeamSwitcher'

// Sidebar 내부
<div style={{ padding: '0 14px' }}>
  <TeamSwitcher />
</div>
```

> **확인 필요:** TeamSwitcher가 현재 어떤 props를 받는지, 독립적으로 동작하는지 확인.
> TopNav 안에서만 쓰이던 컴포넌트라면 props 조정이 필요할 수 있음.

### 알림 + 프로필

```javascript
// 알림: 기존 NotificationPanel은 우측 슬라이드인으로 유지
// 사이드바에는 벨 아이콘 + unread count만 표시
<div onClick={() => set({ showNotificationPanel: true })}>
  🔔 알림
  {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
</div>

// 프로필: 기존 /profile 라우트로 이동
<div onClick={() => navigate('/profile')}>
  <Avatar name={userName} />
  <div>
    <div>{userName}</div>
    <div style={{ fontSize: 10, color: '#b4b2a9' }}>{email}</div>
  </div>
</div>
```

### "+새 할일" 버튼 위치

기존 TopNav의 "+새 할일" 버튼은 **사이드바에 넣지 않는다.**  
대신:
- 각 글로벌 뷰 내부의 기존 InlineAdd / + 추가 버튼 그대로 유지
- 프로젝트 레이어(26.2)에서는 Tasks 탭 내부에 추가 UI 제공
- 키보드 단축키 (있다면) 유지

---

## App.jsx 레이아웃 변경

### 현재 구조
```jsx
// App.jsx AppShell
<div>
  <TopNav />          {/* 상단 */}
  <ViewComponent />   {/* 메인 영역 */}
  <DetailPanel />     {/* 우측 슬라이드인 */}
</div>
```

### 변경 후 구조
```jsx
// App.jsx AppShell
<div style={{ display: 'flex', height: '100vh' }}>
  {!isMobile && <Sidebar />}                     {/* 좌측 사이드바 (데스크탑만) */}
  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
    {isMobile && <MobileTopBar />}                {/* 모바일 상단바 (기존 유지) */}
    <div style={{ flex: 1, overflow: 'auto' }}>
      <ViewComponent />                           {/* 메인 영역 */}
    </div>
    {isMobile && <BottomNav />}                   {/* 모바일 하단 (기존 유지) */}
  </div>
  <DetailPanel />                                 {/* 우측 슬라이드인 (기존 유지) */}
  {showNotificationPanel && <NotificationPanel />} {/* 알림 패널 (기존 유지) */}
</div>
```

### isMobile 판단
```javascript
// 기존 패턴 확인 후 동일하게 사용
// 현재 TopNav.jsx에서 window.innerWidth < 768 사용 중
const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
useEffect(() => {
  const handler = () => setIsMobile(window.innerWidth < 768)
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}, [])
```

---

## 스타일 명세

### 사이드바
```javascript
{
  width: 210,
  background: '#fff',
  borderRight: '0.5px solid #e8e6df',
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  userSelect: 'none',
  height: '100%',
}
```

### 활성 상태
```javascript
// 글로벌 뷰 활성
isActive = currentView === item.key

// 프로젝트 활성 (26.2에서 확장)
isActive = currentView === 'project' && selectedProjectId === project.id
```

### 색상 체계
```
배경: #fff
구분선: #e8e6df
섹션 레이블: #a09f99, 10px, 600 weight, uppercase
일반 아이템: #6b6a66, 13px
활성 아이템: #2C2C2A, background #f0efe8, 500 weight
호버: background #f5f4f0
프로필 이메일: #b4b2a9, 10px
```

---

## 키보드 단축키 유지

현재 AppShell에 `Ctrl+Shift+←/→`로 뷰 순환이 있다.  
VIEW_ORDER 배열에 따른 순환 로직은 **그대로 유지**.  
사이드바 추가로 인해 영향받지 않아야 한다.

---

## 검증 체크리스트

### 기능 검증
- [ ] 사이드바 글로벌 뷰 5개 클릭 → 각 뷰 정상 전환
- [ ] 사이드바 프로젝트 팀/개인 섹션 분리 표시
- [ ] 사이드바 프로젝트 클릭 → ProjectView로 전환 (26.1에서는 기존 동작)
- [ ] TeamSwitcher 정상 동작 (팀 전환 → 프로젝트 목록 갱신)
- [ ] 알림 벨 클릭 → NotificationPanel 열림
- [ ] 프로필 클릭 → /profile 이동
- [ ] 도움말 클릭 → /help 이동
- [ ] 프로젝트 "+" 클릭 → 프로젝트 추가 (기존 ProjectManager 활용)

### 회귀 검증
- [ ] TodayView 정상 (Task 추가/완료/삭제)
- [ ] MatrixView 정상 (드래그앤드롭)
- [ ] ProjectView 정상 (아웃라이너, 키보드 단축키 전체)
- [ ] TimelineView 정상 (간트 드래그)
- [ ] MemoryView 정상 (메모 CRUD)
- [ ] DetailPanel 정상 (슬라이드인, 노트 편집)
- [ ] 모바일 레이아웃 정상 (사이드바 미표시, 기존 MobileTopBar/BottomNav 유지)
- [ ] Ctrl+Shift+←/→ 뷰 순환 정상
- [ ] `npm run build` 성공

### 26.1 완료 조건
- [ ] 위 전항목 통과
- [ ] 데스크탑에서 TopNav 미표시 확인
- [ ] 사이드바 정상 렌더링
- [ ] 26.2 진행 가능한 상태

---

## 주의사항

- **TopNav.jsx를 삭제하지 않는다** — 모바일에서 MobileTopBar가 이를 참조할 수 있음. 데스크탑에서만 렌더링하지 않도록 조건 처리
- **AllTasksView가 데스크탑에서도 접근 가능하도록** — 기존에 모바일 전용이었으나 사이드바에 추가하면 데스크탑에서도 보임. AllTasksView 내부 수정 없이 렌더링만 허용
- **프로젝트 정렬은 기존 `sortProjectsLocally()` 활용** — 사이드바에서도 동일 순서
- **collapseState 관련 사이드바 자체의 접기/펼치기는 불필요** — 프로젝트 목록이 길어지면 스크롤로 처리
