# UI 개선 5건 실행

> 전제: main 브랜치 최신 상태. 모든 항목을 이번에 완료.

---

## 개선 1: Key Milestone 탭에서도 미분류 할일 표시

### 현재 문제
Key Milestone 탭(마일스톤 관리 화면)에서 마일스톤이 0개이면 할일이 안 보인다. 
할일을 먼저 생성하고, 마일스톤을 나중에 만들어서 할일을 매핑할 수 있어야 한다.

### 수정 대상
```bash
cat src/components/project/KeyMilestoneTab.jsx
```

### 수정 방향

KeyMilestoneTab.jsx 전체 코드를 읽고, 마일스톤 목록 아래(또는 empty state 위치)에 **미분류 할일 섹션**을 추가하라.

```bash
# 현재 프로젝트의 할일을 store에서 가져오는 방식 확인
grep -n "tasks\|useStore.*task\|projectId" src/components/project/KeyMilestoneTab.jsx | head -20
```

**추가할 내용:**

1. useStore에서 tasks를 가져와서 현재 프로젝트의 `keyMilestoneId === null`인 할일을 필터링
2. 마일스톤 목록 아래에 미분류 할일 섹션을 렌더링
3. 각 할일은 간단한 리스트로 표시 (체크박스 + 제목 + 담당자)
4. 할일 클릭 시 DetailPanel 열기 (기존 `openDetail` 사용)

```jsx
// useStore에서 필요한 것
const tasks = useStore(s => s.tasks)
const openDetail = useStore(s => s.openDetail)

// 현재 프로젝트의 미분류 할일
const unlinkedTasks = tasks.filter(t => 
  t.projectId === projectId && 
  !t.keyMilestoneId && 
  !t.deletedAt && 
  t.category !== 'done'
)
```

```jsx
{/* 미분류 할일 섹션 — 마일스톤 목록 아래에 배치 */}
{unlinkedTasks.length > 0 && (
  <div style={{ marginTop: 24, padding: '0 20px' }}>
    <div style={{ 
      fontSize: 13, fontWeight: 600, color: '#999', 
      padding: '8px 0', borderBottom: '1px solid #f0efe8', marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 6 
    }}>
      📋 미배정 할일
      <span style={{ 
        fontSize: 11, background: '#f0efe8', borderRadius: 8, 
        padding: '1px 8px', fontWeight: 500, color: '#888' 
      }}>
        {unlinkedTasks.length}
      </span>
    </div>
    {unlinkedTasks.map(task => (
      <div
        key={task.id}
        onClick={() => openDetail(task)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 4px', cursor: 'pointer', borderRadius: 6,
          fontSize: 13, color: '#37352f',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#fafaf7'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <span style={{ color: '#ccc', fontSize: 11 }}>○</span>
        <span style={{ flex: 1 }}>{task.text || '(제목 없음)'}</span>
        {task.assigneeId && (
          <span style={{ fontSize: 11, color: '#aaa' }}>
            {/* 담당자 이름 — 기존 memberMap이 있으면 사용, 없으면 생략 */}
          </span>
        )}
      </div>
    ))}
    <div style={{ fontSize: 11, color: '#bbb', padding: '8px 4px', fontStyle: 'italic' }}>
      마일스톤을 추가한 후, 할일 상세에서 마일스톤을 연결할 수 있습니다
    </div>
  </div>
)}
```

> 기존 empty state 메시지("마일스톤을 추가하여 프로젝트 일정을 관리하세요")는 마일스톤이 0개 AND 미분류 할일도 0개일 때만 표시.
> 미분류 할일이 있으면 empty state 대신 미분류 할일 섹션을 보여줘야 한다.

---

## 개선 2: Tasks 탭 — 전체 접기/펼치기 기능

### 현재 문제
Tasks 탭(Image 2)에서 각 할일의 불릿포인트(노트)를 일괄 접기/펼치기 하는 기능이 없다.

### 수정 대상
```bash
# Tasks 탭 또는 MilestoneOutlinerView에서 접기/펼치기 관련 코드 확인
grep -rn "allTopCollapsed\|collapse.*all\|expand.*all\|접기\|펼치기" src/components/project/tasks/ --include="*.jsx" | head -10

# ProjectView에도 비슷한 기능이 있는지 확인 (기존 패턴 참고)
grep -rn "allTopCollapsed\|collapseState\|toggleCollapse.*projectSection\|모든 노트" src/components/views/ProjectView.jsx src/components/project/tasks/ --include="*.jsx" | head -15
```

### 수정 방향

ProjectView의 카테고리 섹션에 이미 있는 "모든 노트 접기/펼치기" 버튼과 동일한 패턴을 Tasks 탭에 적용하라.

**버튼 위치:** Tasks 탭 상단 (할일 목록 위)에 접기/펼치기 토글 버튼 추가

```jsx
// Tasks 탭 상단에 추가
const [allCollapsed, setAllCollapsed] = useState(false)

function toggleAllNotes() {
  const next = !allCollapsed
  setAllCollapsed(next)
  // 모든 할일의 노트를 접기/펼치기
  // 기존 collapseState 패턴을 사용하거나, 로컬 state로 관리
}
```

```jsx
{/* 전체 접기/펼치기 버튼 — 할일 목록 위 우측에 */}
<button
  onClick={toggleAllNotes}
  title={allCollapsed ? '모든 노트 펼치기' : '모든 노트 접기'}
  style={{
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#ccc', padding: 4, display: 'flex', alignItems: 'center', gap: 4,
    fontSize: 11,
  }}
  onMouseEnter={e => e.currentTarget.style.color = '#888'}
  onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
>
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    {allCollapsed ? (
      <>
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
  {allCollapsed ? '펼치기' : '접기'}
</button>
```

> **기존 패턴 확인 필수:** ProjectView의 CategorySection에 이미 `sectionCollapsed` + `toggleCollapse('projectSection', sectionKey)` 패턴이 있다. 
> Tasks 탭(MilestoneOutlinerView 또는 TaskOutlinerMode)에서도 동일한 useStore의 collapseState를 사용하는지 먼저 확인하고, 있으면 그 패턴을 따르라.
> 없으면 로컬 state로 `allCollapsed`를 관리하고, 각 OutlinerTaskNode에 prop으로 전달하라.

---

## 개선 3: Tasks 탭 — Alt+Shift+방향키로 할일 순서 변경

### 현재 문제
마우스 외에 키보드로 할일 순서를 변경할 수 없다.

### 수정 대상
```bash
# 할일 제목 input의 키보드 핸들러 확인
grep -rn "handleTitleKeyDown\|onKeyDown.*title\|Alt.*Shift.*Arrow\|altKey.*shiftKey" src/components/project/tasks/OutlinerTaskNode.jsx | head -10

# ProjectView의 기존 구현 확인 (이미 있을 수 있음)
grep -rn "Alt.*Shift.*Arrow\|altKey.*shiftKey\|onSwapUp\|onSwapDown" src/components/project/tasks/ --include="*.jsx" | head -10
```

### 수정 방향

**ProjectView의 OutlinerTaskNode에 이미 Alt+Shift+↑↓ 순서 변경이 구현되어 있을 가능성이 높다.** 
먼저 확인하고:
- 이미 있으면: Tasks 탭(MilestoneOutlinerView)에서 OutlinerTaskNode에 `onSwapUp`/`onSwapDown` prop을 전달하고 있는지 확인. 전달 안 하고 있으면 추가.
- 없으면: 아래 패턴으로 추가.

```bash
cat src/components/project/tasks/OutlinerTaskNode.jsx
```

**OutlinerTaskNode의 handleTitleKeyDown에 확인/추가:**

```javascript
const handleTitleKeyDown = (e) => {
  // Alt+Shift+↑ — 위로 순서 변경
  if (e.altKey && e.shiftKey && e.key === 'ArrowUp') {
    e.preventDefault()
    onSwapUp?.()
    return
  }
  // Alt+Shift+↓ — 아래로 순서 변경
  if (e.altKey && e.shiftKey && e.key === 'ArrowDown') {
    e.preventDefault()
    onSwapDown?.()
    return
  }
  // ...기존 키 핸들링...
}
```

**MilestoneOutlinerView에서 OutlinerTaskNode에 onSwapUp/onSwapDown 전달:**

```bash
grep -n "OutlinerTaskNode\|onSwap" src/components/project/tasks/MilestoneOutlinerView.jsx | head -10
```

MilestoneOutlinerView에서 할일 목록을 렌더링하는 부분을 찾아:

```jsx
{tasks.map((task, i) => (
  <OutlinerTaskNode
    key={task.id}
    task={task}
    // ...기존 props...
    onSwapUp={() => handleSwap(i, -1)}    // ★ 추가 (없으면)
    onSwapDown={() => handleSwap(i, 1)}   // ★ 추가 (없으면)
  />
))}
```

**handleSwap 함수 (MilestoneOutlinerView에 없으면 추가):**

```javascript
const handleSwap = useCallback((i, dir) => {
  const j = i + dir
  if (j < 0 || j >= sortedTasks.length) return
  const a = sortedTasks[i], b = sortedTasks[j]
  const aOrder = a.sortOrder, bOrder = b.sortOrder
  updateTask(a.id, { sortOrder: bOrder })
  updateTask(b.id, { sortOrder: aOrder })
}, [sortedTasks, updateTask])
```

> `updateTask(id, patch)` 시그니처 준수. sortOrder 스왑 방식은 ProjectView의 기존 구현과 동일하게.

---

## 개선 4: 프로젝트 헤더에 Owner Placeholder 항상 표시

### 현재 문제
Image 1: "● 정기주총 SCD팀"만 보이고 Owner 정보가 안 보인다.
Owner가 지정되어 있든 없든 Placeholder로 항상 보여야 한다.

### 수정 대상
```bash
cat src/components/project/ProjectHeader.jsx
```

### 수정 방향

ProjectHeader에서 Owner 표시 부분을 찾아 수정:

```jsx
{/* 현재 코드 (ownerName이 있을 때만 표시) */}
{ownerName && (
  <span>· {ownerName}</span>
)}

{/* 수정 후 (항상 표시) */}
<span style={{ fontSize: 11, color: '#a09f99' }}>
  · 프로젝트 오너 : {ownerName || '미지정'}
</span>
```

**결과 예시:**
- Owner 있을 때: `● 정기주총 SCD팀 · 프로젝트 오너 : Ryan Park`
- Owner 없을 때: `● 정기주총 SCD팀 · 프로젝트 오너 : 미지정`

---

## 개선 5: 탭 이름 한국어 변경

### 수정 대상
```bash
# 탭 이름이 정의된 곳 찾기
grep -rn "Key Milestone\|Tasks\|타임라인" src/components/project/ProjectHeader.jsx src/components/project/ProjectLayer.jsx | head -10
```

### 수정 내용

| 현재 (영어) | 변경 (한국어) |
|------------|-------------|
| Key Milestone | 마일스톤 |
| Tasks | 할일 |
| 타임라인 | 타임라인 (유지) |

탭 이름이 정의된 파일(ProjectHeader.jsx 또는 ProjectLayer.jsx)을 찾아 문자열을 교체:

```javascript
// 변경 전
{ key: 'milestone', label: 'Key Milestone' }
{ key: 'tasks', label: 'Tasks' }

// 변경 후
{ key: 'milestone', label: '마일스톤' }
{ key: 'tasks', label: '할일' }
```

탭 이름 외에도 앱 내에서 "Key Milestone"이라는 텍스트가 사용되는 모든 곳을 확인:

```bash
grep -rn "Key Milestone" src/ --include="*.jsx" --include="*.js"
```

모든 사용자 대면 텍스트를 "마일스톤"으로 변경하라. 
단, 테이블명(`key_milestones`), 훅명(`useKeyMilestones`), 컴포넌트명(`KeyMilestoneTab`) 같은 **코드 식별자는 변경하지 마라**.

---

## 검증 체크리스트

### 개선 1: Key Milestone 탭 미분류 할일
- [ ] 마일스톤 0개 + 할일 있음 → "📋 미배정 할일" 섹션에 할일 목록 표시
- [ ] 마일스톤 2개 + 미배정 할일 3개 → 마일스톤 아래에 미배정 섹션 표시
- [ ] 미배정 할일 클릭 → DetailPanel 열림
- [ ] 미배정 할일 0개 → 섹션 미표시

### 개선 2: 전체 접기/펼치기
- [ ] 접기 버튼 클릭 → 모든 할일의 노트가 접힘
- [ ] 펼치기 버튼 클릭 → 모든 할일의 노트가 펼쳐짐
- [ ] 개별 할일의 접기/펼치기는 기존대로 독립 동작

### 개선 3: Alt+Shift+방향키 순서 변경
- [ ] 할일 제목에 커서 → Alt+Shift+↑ → 위 할일과 순서 교체
- [ ] 할일 제목에 커서 → Alt+Shift+↓ → 아래 할일과 순서 교체
- [ ] 첫 번째 할일에서 Alt+Shift+↑ → 아무 일 없음 (에러 없음)
- [ ] 마지막 할일에서 Alt+Shift+↓ → 아무 일 없음 (에러 없음)
- [ ] 순서 변경 후 새로고침 → 변경된 순서 유지

### 개선 4: 프로젝트 오너 Placeholder
- [ ] Owner 지정된 프로젝트: "· 프로젝트 오너 : Ryan Park"
- [ ] Owner 미지정 프로젝트: "· 프로젝트 오너 : 미지정"
- [ ] 개인 프로젝트에서도 표시 (Owner가 있으면)

### 개선 5: 탭 이름 한국어
- [ ] "Key Milestone" → "마일스톤"
- [ ] "Tasks" → "할일"
- [ ] 탭 클릭 정상 동작
- [ ] 코드 식별자(변수명, 파일명, 테이블명) 변경 없음

### 회귀 검증
- [ ] TodayView 정상
- [ ] MatrixView DnD 정상
- [ ] ProjectView 아웃라이너 정상 (기존 Alt+Shift+↑↓ 순서 변경 포함)
- [ ] TimelineView 정상
- [ ] MemoryView 정상
- [ ] 개인 모드 전체 정상
- [ ] `npm run build` 성공

---

## 주의사항

- `updateTask(id, patch)` 시그니처 준수
- 기존 tasks/memos 테이블의 text/done/category/alarm 컬럼 변경 금지
- 기존 뷰 컴포넌트(TodayView, MatrixView, TimelineView, MemoryView) 내부 수정 금지
- 코드 식별자(파일명, 변수명, 테이블명, 훅명)는 영어 유지 — 사용자 대면 텍스트만 한국어로
- 완료 후 `git push origin main` 실행
