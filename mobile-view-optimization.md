# 모바일 뷰 UI 최적화

> 모바일(768px 이하)에서 3개 뷰만 표시: 오늘할일, 프로젝트, 노트.
> 매트릭스/타임라인은 완전 숨김. 모든 수정은 데스크탑에 영향 없어야 함.

---

## 1. 모바일 뷰 — 4개 탭

### 구성

| 순서 | 뷰 | 내용 |
|:---:|---|---|
| 1 | **오늘할일** | 오늘 카테고리 할일만 (기존) |
| 2 | **모든 할일** | 오늘 + 다음 + 남은 + 완료 — 전체 (신규) |
| 3 | **프로젝트** | 아웃라이너 (기존) |
| 4 | **노트** | 메모 카드 (기존) |

> 매트릭스/타임라인은 데스크탑 전용. 모바일에서 숨김.

### "모든 할일" 뷰 — 오늘할일과 동일 UI + 카테고리 전체 표시

```
모든 할일

[전체] [팀] [개인]                전체 접기

● 정기주총                              3
  🔥 안건 PPT 작성
  🔥 소집통지 메일 발송
  📌 전화 확인 - 본 회신 마지막
  ─ ─ ─ ─
  ✅ 결산공시 (완료)

● ABI 코리아                            2
  🔥 Todo 스케줄링
  📌 ABI 이사회 Paper Work

● BIS                                   2
  🔥 제출 서류 작성
  📌 Sales팀 자료 취합

● 일본법인/해외SCM                       2
  🔥 PO/물류/자금 Flow 정리
  🔥 일본법인 계약 Flow 정리

● 개별과제                               1
  🔥 사업보고서 업데이트
```

카테고리 구분: 🔥 오늘 / 📌 다음 / 📋 남은 / ✅ 완료 — 아이콘으로 구분, 별도 섹션 헤더 없이 프로젝트 안에서 순서대로 나열.

---

### `src/components/views/AllTasksView.jsx` 신규 생성

오늘할일 뷰(TodayView.jsx)를 기반으로 하되, tasks 필터를 `category === 'today'`가 아니라 **전체**로 변경:

```jsx
import { useState, useCallback } from 'react'
import useStore from '../../hooks/useStore'
import useProjectFilter from '../../hooks/useProjectFilter'
import ProjectFilter from '../shared/ProjectFilter'
import TaskItem from '../shared/TaskItem'

// 카테고리 순서 + 아이콘
const CAT_ORDER = ['today', 'next', 'backlog', 'done']
const CAT_ICON = { today: '🔥', next: '📌', backlog: '📋', done: '✅' }

export default function AllTasksView() {
  const { tasks, projects, collapseState, toggleCollapse } = useStore()
  const { filteredProjects, filteredTasks } = useProjectFilter(projects, tasks)
  const collapsed = collapseState.allTasks || {}

  const allCollapsed = filteredProjects.every(p => collapsed[p.id])
  const toggleAll = () => {
    const newState = {}
    filteredProjects.forEach(p => { newState[p.id] = !allCollapsed })
    useStore.getState().setCollapseGroup('allTasks', newState)
  }

  return (
    <div style={{ padding: '16px' }}>
      {/* 상단 */}
      <div className="today-header" style={{ marginBottom: 16 }}>
        <div className="today-greeting">
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#37352f' }}>모든 할일</h1>
        </div>
        <div className="today-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <ProjectFilter />
          <button onClick={toggleAll} style={{
            background: 'none', border: '1px solid #e8e8e8', borderRadius: 6,
            padding: '4px 10px', fontSize: 12, color: '#999', cursor: 'pointer',
          }}>{allCollapsed ? '전체 펼치기' : '전체 접기'}</button>
        </div>
      </div>

      {/* 프로젝트별 할일 */}
      {filteredProjects.map(p => {
        const projectTasks = filteredTasks.filter(t => t.projectId === p.id)
        if (projectTasks.length === 0) return null

        const isCollapsed = collapsed[p.id]
        // 카테고리 순서대로 정렬
        const sorted = [...projectTasks].sort((a, b) => {
          const catA = CAT_ORDER.indexOf(a.category)
          const catB = CAT_ORDER.indexOf(b.category)
          if (catA !== catB) return catA - catB
          return (a.sortOrder || 0) - (b.sortOrder || 0)
        })

        return (
          <div key={p.id} style={{
            background: '#fafaf8', borderRadius: 10, padding: '12px 14px',
            marginBottom: 12, border: '1px solid #f0ede8',
          }}>
            {/* 프로젝트 헤더 */}
            <div
              onClick={() => toggleCollapse('allTasks', p.id)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer', marginBottom: isCollapsed ? 0 : 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: COLORS[p.color]?.dot || '#999' }}>●</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
              </div>
              <span style={{ fontSize: 12, color: '#bbb', fontWeight: 600 }}>
                {projectTasks.filter(t => !t.done).length}
              </span>
            </div>

            {/* 할일 목록 */}
            {!isCollapsed && sorted.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                <span style={{ fontSize: 11, marginTop: 5, flexShrink: 0, width: 16, textAlign: 'center' }}>
                  {CAT_ICON[t.category] || ''}
                </span>
                <div style={{ flex: 1 }}>
                  <TaskItem task={t} compact />
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
```

> `COLORS`는 기존 `utils/colors.js`에서 import.
> `TaskItem`은 기존 공유 컴포넌트 재사용.
> collapse 상태는 `collapseState.allTasks` 그룹으로 별도 관리.

---

### MobileDrawer — 4개 탭으로 수정

```jsx
const MOBILE_TABS = [
  { id: 'today', label: '오늘할일', icon: '◎' },
  { id: 'allTasks', label: '모든 할일', icon: '📋' },
  { id: 'project', label: '프로젝트', icon: '📁' },
  { id: 'memory', label: '노트', icon: '📝' },
]
```

### App.jsx — allTasks 뷰 등록 + 모바일 리다이렉트

```jsx
const AllTasksView = lazy(() => import('./components/views/AllTasksView'))

// AppShell 내부 views 매핑
const views = {
  today: TodayView,
  allTasks: AllTasksView,  // ★ 신규
  matrix: teamId ? TeamMatrixView : MatrixView,
  project: ProjectView,
  timeline: TimelineView,
  memory: MemoryView,
}

// 모바일에서 matrix/timeline 접근 방지
useEffect(() => {
  if (mobile && (currentView === 'matrix' || currentView === 'timeline')) {
    setView('today')
  }
}, [currentView, mobile])
```

### MobileTopBar — 뷰 이름 추가

```jsx
const MOBILE_VIEW_NAMES = {
  today: '오늘할일',
  allTasks: '모든 할일',
  project: '프로젝트',
  memory: '노트',
}
```

### useStore — collapseState 기본값에 allTasks 추가

```javascript
const _defaultCollapseState = {
  today: {},
  allTasks: {},  // ★ 신규
  matrix: {},
  // ... 기존 유지
}
```

---

## 2. 오늘할일 뷰 — 필터 토글 위치 조정

### 현재 문제
인사말 텍스트와 [전체|팀|개인] + "전체 접기"가 같은 줄에 있어서 좁고 겹침.

### 변경

```
🌤 좋은 하루 되세요, Ryan
2026년 3월 13일 금요일

[전체] [팀] [개인]                전체 접기
────────────────────────────────────────
● 개별과제  ...
```

### TodayView.jsx 수정

상단 영역의 flex 컨테이너에 모바일 분기 추가. 현재 인사말+필터가 어떤 구조인지 확인 후, className을 추가하여 CSS로 분리:

```css
@media (max-width: 767px) {
  .today-header {
    flex-direction: column !important;
    gap: 12px;
    padding: 16px 16px 12px !important;
  }
  .today-header .today-greeting h1 {
    font-size: 18px;
  }
  .today-header .today-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }
}
```

인사말과 필터 영역에 각각 className 추가 필요:
- 인사말 영역: `className="today-greeting"`
- 필터+접기 영역: `className="today-toolbar"`
- 전체 컨테이너: `className="today-header"`

---

## 3. 할일 추가 모달 — 중앙 모달로 변경

### 현재 문제
바텀 시트가 화면 맨 아래에 붙어서 키보드에 가려지고 눈에 안 띔.

### 변경
바텀 시트 대신 **화면 중앙 모달**로 변경:

### MobileAddSheet (또는 FAB 내부 시트) 수정

```jsx
{/* 배경 오버레이 */}
<div onClick={onClose} style={{
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  zIndex: 300,
}} />

{/* 중앙 모달 */}
<div style={{
  position: 'fixed',
  top: '25vh',          // ★ 화면 상단 25% 위치
  left: 16,
  right: 16,
  background: '#fff',
  borderRadius: 16,
  padding: '20px',
  zIndex: 301,
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  animation: 'fadeScaleIn 0.2s ease',
}}>
  {/* 프로젝트 선택 */}
  <label style={{ fontSize: 12, color: '#999', display: 'block', marginBottom: 4 }}>프로젝트</label>
  <select style={{
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #e5e5e5', fontSize: 14, fontFamily: 'inherit',
    marginBottom: 12, background: '#fafafa',
  }}>
    {projects.map(p => (
      <option key={p.id} value={p.id}>{p.name}</option>
    ))}
  </select>

  {/* 할일 입력 + 추가 */}
  <div style={{ display: 'flex', gap: 8 }}>
    <input
      autoFocus
      placeholder="할 일을 입력하세요"
      style={{
        flex: 1, padding: '10px 12px', borderRadius: 8,
        border: '1px solid #e5e5e5', fontSize: 14, fontFamily: 'inherit',
      }}
    />
    <button style={{
      padding: '10px 16px', borderRadius: 8,
      background: '#37352f', color: '#fff', border: 'none',
      fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
    }}>추가</button>
  </div>
</div>
```

### global.css 애니메이션 추가

```css
@keyframes fadeScaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
```

---

## 4. BottomNav 제거 확인

기존 `global.css`에서 `.mobile-bottomnav`이 모바일에서 보이도록 설정되어 있으면 숨김으로 변경:

```css
/* 모바일에서도 하단 탭바 숨김 — 드로어로 대체 */
.mobile-bottomnav { display: none !important; }
```

---

## 5. FAB 위치 조정

하단 탭바 제거 후 FAB 위치 수정:

```css
@media (max-width: 767px) {
  .mobile-fab {
    bottom: 24px !important;  /* 기존 76px → 24px (탭바 사라진 만큼) */
  }
}
```

---

## 6. 프로젝트 뷰 모바일 대응

프로젝트 뷰는 세로 아웃라이너라 모바일에서도 잘 동작하지만, 프로젝트 탭 바가 좁으면 스크롤 필요:

```css
@media (max-width: 767px) {
  .project-tab-bar {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0 16px;
  }
  .project-tab-bar::-webkit-scrollbar {
    display: none;
  }
}
```

---

## 변경 파일 요약

| 파일 | 변경 | 영향 |
|------|------|------|
| `AllTasksView.jsx` | **신규** — 모든 할일 뷰 (TodayView 기반, 전체 카테고리) | 모바일 주력 |
| `MobileDrawer.jsx` | 메뉴 4개 (오늘할일/모든 할일/프로젝트/노트) | 모바일만 |
| `MobileTopBar.jsx` | 뷰 이름 매핑 4개 | 모바일만 |
| `App.jsx` (AppShell) | allTasks 뷰 등록 + 모바일 matrix/timeline 리다이렉트 | 모바일만 |
| `useStore.js` | collapseState에 `allTasks: {}` 추가 | 기본값 추가만 |
| `TodayView.jsx` | 상단에 className 추가 (today-header/greeting/toolbar) | CSS만 |
| `MobileAddSheet.jsx` / `FAB.jsx` | 바텀 시트 → 중앙 모달 | 모바일만 |
| `global.css` | 모바일 미디어쿼리 추가 | 모바일만 |
| `TopNav.jsx` | **변경 없음** | 데스크탑 5개 탭 유지 |
| `TeamMatrixView.jsx` | **변경 없음** | 모바일에서 접근 불가 |
| `TimelineView.jsx` | **변경 없음** | 동일 |

---

## 완료 조건

### 뷰 제한
- [ ] 모바일 드로어: 오늘할일, 모든 할일, 프로젝트, 노트 4개
- [ ] "모든 할일" 뷰: 프로젝트별 전체 카테고리(🔥📌📋✅) 세로 리스트
- [ ] "모든 할일" 뷰: 프로젝트 필터(전체/팀/개인) 동작
- [ ] "모든 할일" 뷰: 프로젝트 접기/펼치기 동작
- [ ] 모바일 초기 뷰: 오늘할일
- [ ] 모바일에서 matrix/timeline 접근 시 자동으로 today로 전환
- [ ] 데스크탑: 5개 뷰 모두 정상 (변경 없음, allTasks는 데스크탑에서도 접근 가능하지만 메뉴에 없음)

### 오늘할일 뷰
- [ ] 필터 [전체|팀|개인] + 전체 접기가 인사말 아래 별도 줄
- [ ] 모바일에서 여백 적절

### 할일 추가
- [ ] + 버튼 → 중앙 모달 (top: 25vh)
- [ ] 키보드 올라와도 입력 필드 안 가려짐
- [ ] 프로젝트 선택 + 입력 + 추가 버튼 정상
- [ ] 배경 클릭 시 모달 닫힘

### 기타
- [ ] 하단 탭바 완전 숨김
- [ ] FAB 위치: bottom 24px
- [ ] 프로젝트 탭 바 가로 스크롤
- [ ] 데스크탑 기능 회귀 없음
