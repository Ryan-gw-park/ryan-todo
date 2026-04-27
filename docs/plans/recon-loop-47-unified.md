# Recon — Loop-47: 2-pane 복귀 + 포커스 카드 인라인 펼침 + UI 정비

> **상위 입력**: Ryan 통합 계획 (A 레이아웃 복귀 / B PROJECT_COLUMNS fix / C UI 정비)
> **1차 Recon**: `recon-focus-note-panel.md` + `recon-loop-47-backlog-adds.md` — 검증 완료 항목 재조사 금지
> **오진단 정정**: `recon-loop-47-backlog-adds.md §E2` "DB 정규화" → 진짜 원인은 **PROJECT_COLUMNS 컬럼 누락** (본 recon 에서 확정)
> **Read-only**, OutlinerEditor 수정 금지

---

## A. 2-pane 복귀 — 제거/수정 대상

### A1. Loop-46 도입물 처리 매트릭스

| # | 항목 | 상태 | 제안 처리 |
|---|---|---|---|
| A1-1 | `FocusNotePanel.jsx` | 독립 파일 130 lines, **importer 1곳**: [`PersonalTodoShell.jsx:10`](../../src/components/views/personal-todo/PersonalTodoShell.jsx#L10) | **삭제** (DELETE-5) |
| A1-2 | `selectedFocusTaskId` store 필드 | 정의 + setter + 4 consumers | **판단 필요** — 옵션 3안 (§A1.2) |
| A1-3 | F-41 뷰포트 분기 | **현재 Shell에 구현 없음** (Loop-46 Commit 7 미실행, Commit 6 QA 체크포인트에서 멈춤) | **제거할 코드 없음** ✓ |
| A1-4 | `isEmptyNotes` util | [`utils/notes.js:15-17`](../../src/utils/notes.js#L15) + `FocusCard.jsx:29` 사용 | **유지** |

### A1.1 FocusNotePanel.jsx verbatim 요약 (130 lines, 삭제 대상)

```jsx
// L1-L7 imports
import { useMemo, useRef, useCallback, useState } from 'react'
import useStore from '../../../hooks/useStore'
import { COLOR, FONT, SPACE } from '../../../styles/designTokens'
import { getColor } from '../../../utils/colors'
import OutlinerEditor from '../../shared/OutlinerEditor'

// L17 export default function FocusNotePanel({ tasks, projects }) { ... }
```

**삭제 시 import 정리 필요 위치**: Shell L10 (`import FocusNotePanel from './FocusNotePanel'`) + 렌더 사용처 L145-L151.

### A1.2 `selectedFocusTaskId` 처리 — 3안 제시

**store 정의** (useStore.js L1577-L1593):
```js
// L1577-L1581
// ─── Focus selection (Loop-46) ───
// 포커스 카드 중 선택된 것 (FocusNotePanel이 해당 task의 notes 렌더).
// reload 복원: localStorage. stale(선택 task가 unfocus/done/deleted 된 경우) 방어는
// FocusNotePanel 렌더 시점의 tasks.find 재검증 (spec F-40).
selectedFocusTaskId: localStorage.getItem('selectedFocusTaskId') || null,

// L1585-L1593
setSelectedFocusTaskId: (taskId) => {
  set({ selectedFocusTaskId: taskId || null })
  try {
    if (taskId) localStorage.setItem('selectedFocusTaskId', taskId)
    else localStorage.removeItem('selectedFocusTaskId')
  } catch {
    // localStorage quota / private mode 무시
  }
},
```

**Consumers (grep 전수)**:

| 파일 | 라인 | 용도 |
|---|---|---|
| `FocusNotePanel.jsx` | 18, 27, 29, 34 | 노트 패널 전환 — **삭제 예정** |
| `FocusCard.jsx` | 20 | `setSelectedFocusTaskId` import |
| `FocusCard.jsx` | 21 | `selectedFocusTaskId` 구독 |
| `FocusCard.jsx` | 28 | `isSelected = selectedFocusTaskId === task.id` |
| `FocusCard.jsx` | 53 | 카드 클릭 시 `setSelectedFocusTaskId(task.id)` |
| `FocusCard.jsx` | 59 | `border: isSelected ? COLOR.accent : COLOR.border` 시각 active |
| `PersonalTodoShell.jsx` | 53, 93, 113 | handleDragEnd 에서 bl-task 드롭 시 자동 선택 |
| `FocusQuickAddInput.jsx` | 14, 34 | QuickAdd Enter 후 자동 선택 |

**3안**:

| 옵션 | 장점 | 단점 |
|---|---|---|
| **(a) 완전 제거** | 코드 정리, Loop-47 범위 축소. FocusCard 시각 active 표시 없음 | 사용자가 마지막 touch한 카드 시각 구분 사라짐 (인라인 펼침 여부가 대체 가능) |
| **(b) 유지 — "active 시각 표시"만** | border:accent 강조 유지. auto-select 로직 재활용 | 노트 패널 제거 후 사용 의미 약함. "마지막 선택"이 2-pane에서 유의미한지 모호 |
| **(c) expandedFocusCardIds 로 대체** | 인라인 펼침 상태 자체가 "focus 여부" 시각 cue. selectedFocusTaskId 완전 제거 가능 | auto-expand ≠ 중복된 active 의미. 여러 카드 동시 펼침이라 "단일 active" 개념 충돌 |

**권장: (a) 완전 제거**. 인라인 펼침 상태 (expandedFocusCardIds 집합) 로 "해당 카드가 작업 대상" 시각 표현 충분. border 강조는 hover state 로 대체 가능.

### A2. Shell grid 현재 상태 verbatim

[`PersonalTodoShell.jsx`](../../src/components/views/personal-todo/PersonalTodoShell.jsx) (156 lines 전체 — 주요 섹션만 게시):

**현재 grid**:
```jsx
// L121-L126
<div style={{
  display: 'grid',
  gridTemplateColumns: 'minmax(420px, 1.2fr) minmax(240px, 0.9fr) minmax(320px, 1.2fr)',
  gap: 20,
  width: '100%',
}}>
```

**FocusColumn child (Loop-46 QA fix — droppable context 등록)**:
```jsx
// L30-L47
function FocusColumn({ children }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'focus-panel:root' })
  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 0,
        minHeight: 400,                 // 빈 focus 상태에도 충분한 drop 영역 확보
        background: isOver ? COLOR.bgHover : 'transparent',
        transition: 'background 0.15s',
        borderRadius: 6,
      }}
    >
      {children}
    </div>
  )
}
```

**3 columns 렌더 (L127-L152)**:
```jsx
{/* Column 1: 백로그 */}
<div style={{ minWidth: 0 }}>
  <PersonalTodoListTable ... />
</div>

{/* Column 2: 포커스 */}
<FocusColumn>
  <FocusPanel ... />
</FocusColumn>

{/* Column 3: 포커스 노트 패널 (Loop-46) — 제거 대상 */}
<div style={{ minWidth: 0 }}>
  <FocusNotePanel tasks={tasks} projects={projects} />
</div>
```

**resize 리스너**: **없음**. F-41 미구현 상태.

**A2 처리 방안**:
- `grid-template-columns` 2-pane 으로 단순화: `'minmax(420px, 1.5fr) minmax(280px, 1fr)'` (§C2 최종 권장)
- Column 3 블록 전체 삭제 + FocusNotePanel import 삭제
- `FocusColumn` wrapper 유지 (droppable context 등록 패턴 유지)

### A3. FocusCard 인라인 확장 영향

#### A3-1. `FocusCard.jsx` (154 lines) 현재 레이아웃

L48-L152 outer div:
```jsx
<div
  ref={setNodeRef}
  onMouseEnter={...} onMouseLeave={...}
  onClick={() => setSelectedFocusTaskId(task.id)}
  style={{
    ...sortableStyle,
    display: 'flex', alignItems: 'flex-start', gap: 8,
    padding: SPACE.cardPadding,
    background: '#fff',
    border: `1px solid ${isSelected ? COLOR.accent : COLOR.border}`,
    borderRadius: 6,
    marginBottom: 6,
    cursor: 'pointer',
  }}
>
  {/* Drag handle ⋮⋮ (L65-L75) */}
  {/* Checkbox (L77-L93) */}
  {/* Text + meta (L95-L134) */}
  {/* × (L136-L151) */}
</div>
```

**확장 시 필요한 구조 변경**:
- outer display: flex row → **flex column (세로 스택)**: header row (기존 구조) + body area (새 OutlinerEditor)
- 또는 outer 유지 + header를 새 내부 div로 감싸고 그 아래 body div 추가

**제안 구조**:
```jsx
<div style={{ ...card outer, display: 'flex', flexDirection: 'column' }}>
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
    {/* caret + drag handle + checkbox + text/meta + × */}
  </div>
  {isExpanded && (
    <div style={{ padding: '4px 0 0 24px' }}>  {/* 좌측 indent = caret width */}
      <OutlinerEditor notes={task.notes} onChange={handleNotesChange} accentColor={...} />
    </div>
  )}
</div>
```

**`▸` caret 삽입 위치**: 드래그 핸들 ⋮⋮ 자리 앞 or 체크박스 옆. 클릭 시 `setExpandedIds(prev => toggle(task.id))`. CSS `transform: rotate(90deg)` 로 ▼ 표현.

#### A3-2. DnD 충돌 체크

[`FocusCard.jsx:66-69`](../../src/components/views/personal-todo/cells/FocusCard.jsx#L66-L69):
```jsx
<div {...attributes} {...listeners} style={{ cursor: 'grab', ... }} ...>⋮⋮</div>
```

`useSortable`의 `attributes`/`listeners` 는 **드래그 핸들 ⋮⋮ 에만** spread. OuterContainer 에는 ref 만 연결 (L50). Body 영역 (확장 후 추가) 에는 listeners 없음 → **드래그 이벤트 전파 없음, 충돌 없음 ✓**.

체크박스/×/텍스트 onClick 들은 각자 `e.stopPropagation()` 호출 → body 영역 클릭도 outer onClick (setSelected) 로 bubble. body 안에 OutlinerEditor 의 textarea 가 있으니 textarea 클릭은 focus 이벤트만 발생 (click bubble은 되지만 select 자체는 무해).

#### A3-3. OutlinerEditor 인라인 높이 처리

[`OutlinerEditor.jsx:217-218`](../../src/components/shared/OutlinerEditor.jsx#L217):
```jsx
return (
  <div style={{ padding: '4px 0', minHeight: 40 }}>
    {visibleIndices.map(i => (<OutlinerRow ... />))}
    <button onClick={addNode} ...>+ 추가</button>
  </div>
)
```

- 명시적 height/maxHeight 없음. 내용에 따라 세로 flow. 부모 flex/grid 영향 없음 ✓
- 단, 부모 flex column 컨테이너에서 overflow 제약 없음 시 자연스럽게 확장. 카드 간 spacing은 `marginBottom: 6` (L61).

#### A3-4. 확장 애니메이션 — 기존 패턴

grep `transition.*height` 결과:
- `Sidebar.jsx:172`: `transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .2s'` — transform만
- `collapsing` 키워드 대응 전무

**판단**:
- 명시적 max-height / height 애니메이션 전례 없음
- **간단한 transform + opacity 전환** 또는 **즉시 toggle (애니 없음)** 권장
- max-height 기반 슬라이드는 구현 가능하나 OutlinerEditor 실제 높이 가변이라 `max-height: 1000px` 근사치 필요

**권장: 즉시 토글** (애니메이션 없음). caret 회전 `transform: rotate(90deg); transition: transform 0.15s` 만 적용하여 사용자 피드백 제공.

---

## B. PROJECT_COLUMNS fix

### B1. 현재 정의 verbatim

[`useStore.js:4-8`](../../src/hooks/useStore.js#L4-L8):
```js
// ─── Select 컬럼 최적화 ───
// tasks: alarm, deleted_at 컬럼은 DB에 없을 수 있으므로 select('*') 유지 (기존 fallback 로직 활용)
const TASK_COLUMNS = '*'
const PROJECT_COLUMNS = 'id, name, color, sort_order, team_id, user_id, owner_id, description, start_date, due_date, status, created_by, archived_at'
const MEMO_COLUMNS = 'id, title, notes, color, sort_order, created_at, updated_at'
```

**누락**: `is_system`, `system_key` 2개 컬럼. Loop-45 Commit 1 migration 에서 DB 컬럼 추가 + Commit 2 에서 mapProject 확장했으나 **select list 는 업데이트 안 함**.

### B2. `select(PROJECT_COLUMNS)` 호출 위치

grep 결과 **1곳만** (loadAll 내부):
- [`useStore.js:418`](../../src/hooks/useStore.js#L418): `let projectsQuery = d.from('projects').select(PROJECT_COLUMNS).order('sort_order')`

여타 위치는 `.select('id')` (SetupScreen) 로 해당 없음. **수정 위치는 useStore.js L7 단 1줄**.

### B3. `mapProject` 처리 (정상 — 컬럼 도착 시 맵핑 OK)

[`useStore.js:166-178`](../../src/hooks/useStore.js#L166-L178):
```js
function mapProject(r) {
  return {
    id: r.id, name: r.name, color: r.color, sortOrder: r.sort_order || 0,
    // ↓ Loop-20: 팀 관련 신규 필드 ↓
    teamId: r.team_id || null,
    userId: r.user_id || null,
    ownerId: r.owner_id || null,
    archivedAt: r.archived_at || null,
    // ↓ Loop-45: system project ↓
    isSystem: r.is_system === true,
    systemKey: r.system_key || null,
  }
}
```

`r.is_system` / `r.system_key` 가 undefined 면 `isSystem=false, systemKey=null` 로 귀결. PROJECT_COLUMNS 에 추가하면 DB 실제 값 (`true`, `'instant'`) 전달됨.

### B4. Loop-46 defensive OR 필터 위치 전수

| 파일 | 라인 | 패턴 |
|---|---|---|
| `Sidebar.jsx` | 85-90 | `const isSys = (p) => p.isSystem === true \|\| p.systemKey === 'instant'`<br>systemProjects / teamProjects / personalProjects / archived×2 |
| `useStore.js` | 1441-1444 | `sortProjectsLocally` 내부 `isSys(a)`/`isSys(b)` priority 분기 |
| `UnifiedGridView.jsx` | 95-103 | `displayProjects` useMemo 내 `systemPs/teamPs/personalPs` 분리 |
| `PersonalTodoListTable.jsx` | 66-68 | `instantProjectId` 조회 `(x.systemKey === 'instant' \|\| x.isSystem === true)` |
| `FocusPanel.jsx` | 28-30 | 동일 패턴 (Loop-46 에서 FocusQuickAddInput 이 구독) |

**제거 시 위험 평가**:
- PROJECT_COLUMNS fix 후엔 `isSystem === true` 단일 조건으로 충분 (DB 정합성 확보됨)
- **defensive OR 유지 권장**: 미래 system project 변형 대비. 비용 ~0 (boolean OR 1회), 안전망
- **Ryan 결정 요청**: (a) 유지 (b) 단순화 (`isSystem === true` 만)

---

## C. UI 정비

### C1. LIST 토큰 축소

#### C1-1. 현재 verbatim

[`designTokens.js:117-126`](../../src/styles/designTokens.js#L117-L126):
```js
// ─── 개인 할일 리스트 (Loop-45) ───
export const LIST = {
  colWidthProject:   170,
  colWidthMilestone: 130,
  sectionGap:        24,
  projectRowGap:     12,
  taskRowGap:        6,
  etcLabel: { fontStyle: 'italic', color: '#a09f99' },
};
```

#### C1-2. 참조 위치

grep `LIST.colWidthProject|LIST.colWidthMilestone`:
- `PersonalTodoProjectGroup.jsx:49`: `gridTemplateColumns: \`${LIST.colWidthProject}px ${LIST.colWidthMilestone}px 1fr\``

**단일 소비자** — 축소 시 영향 최소. TodayListTable / FocusPanel / FocusCard 등 무관.

#### C1-3. 한글 프로젝트명 줄바꿈 — 현재 스크린샷 기반 추정

| 프로젝트명 | 글자수 | 170px | 130px 예상 |
|---|---|---|---|
| 팀 개별 과제 | 6 | 1줄 | 1줄 (여유) |
| 26Q1 정기 이사회 | 9 | 1줄 | 1줄 (or 타이트) |
| 개인 개별 과제 | 6 | 1줄 | 1줄 |
| 개인 프로젝트 | 6 | 1줄 | 1줄 |
| ABI 코리아 | 6 | 1줄 | 1줄 |

**130px**: 한글 caret(12) + space + text. 실제 가용 ~110px. 한글 9-10 자까지 1줄. 기존 스크린샷에서 가장 긴 "26Q1 정기 이사회" 정도까지 수용. 더 긴 이름은 2줄 (`wordBreak: keep-all` 이미 적용).

**MS 이름 130→90**: 가용 ~70-80px. 한글 5-6자까지 1줄. 스크린샷 MS "자료 준비" (4자) / "이사회 진행" (5자) / "기타" (2자) — 모두 수용. 긴 MS명 (예: "프로젝트 생애 주기 vs 각 모듈") 은 어차피 90/130 둘 다 줄바꿈 — 본문은 task cell 의 1fr 에서 렌더되므로 직접 영향 없음.

**판단: 토큰 축소 안전**. 170→130, 130→90.

### C2. Shell 좌측 비율 검토 (2-pane 복귀 후)

#### C2-1. 뷰포트 1400px 기준 계산

Sidebar ~210px, 본문 padding 양쪽 48px = 306px 고정 제외 → 본문 영역 ~1094px.
- gap 20px × 1 = 20px 제외 → 1074px 로 2-column 분배.

| 비율 | 좌측 px | 우측 px | 좌측 내부 할일 열 (130+90 제외) | 평가 |
|---|---|---|---|---|
| 1.5fr : 1fr | 644 | 430 | 644 - 220 = 424 | 양호 — 한 줄 ~40자 |
| 1.6fr : 1fr | 661 | 413 | 661 - 220 = 441 | 매우 넓음 |
| 1.8fr : 1fr | 690 | 384 | 690 - 220 = 470 | 포커스 패널 좁음 (< FocusPanel content minWidth 320?) |
| 2fr : 1fr | 716 | 358 | 716 - 220 = 496 | 포커스 패널 상당히 좁음 |

#### C2-2. 포커스 카드 최소 폭

현재 FocusCard: drag handle 10 + checkbox 16 + text 1fr + × 20 + gap × 3 + padding 24 = ~90 + text = 최소 ~280-320px 권장 (OutlinerEditor 인라인 삽입 후엔 + 좀 더).

#### C2-3. 최종 권장

**`minmax(420px, 1.5fr) minmax(280px, 1fr); gap: 20px`**
- 좌측 할일 열 ~420px (뷰포트 1400 기준) — 한 줄 ~40자
- 우측 포커스 ~430px — 인라인 펼침 body 쓰기 충분
- minmax 하한으로 좁은 뷰포트 (1080px) 에서도 깨지지 않음. 더 좁아지면 자연스럽게 가로 스크롤.

### C3. F-11 예외 (시스템 프로젝트 표시)

#### C3-1. 현재 skip 로직

[`PersonalTodoListTable.jsx:195`](../../src/components/views/personal-todo/PersonalTodoListTable.jsx#L195) (TodaySection):
```jsx
if (projTasks.length === 0) return null // F-11
```

[`PersonalTodoListTable.jsx:252`](../../src/components/views/personal-todo/PersonalTodoListTable.jsx#L252) (CollapsibleSection):
```jsx
if (projTasks.length === 0) return null // F-11
```

**2곳 동일 패턴**. 양쪽 수정 필요.

#### C3-2. 수정안 (권장)

```jsx
if (projTasks.length === 0 && !p.isSystem) return null
```

→ system project 는 빈 상태에도 렌더됨.

#### C3-3. 빈 시스템 프로젝트 렌더 시 UI 변화

현재 PersonalTodoProjectGroup 로직 ([cells/PersonalTodoProjectGroup.jsx:41](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx#L41)):
```jsx
if (totalInSection === 0) return null
```

→ **여기도 같은 가드가 있어서 위 L195 통과해도 ProjectGroup 에서 return null** 됨.

**2 단계 수정 필요**:
1. `PersonalTodoListTable.jsx` L195, L252: 위 수정
2. `PersonalTodoProjectGroup.jsx:41`: `if (totalInSection === 0 && !project.isSystem) return null`

**빈 상태 렌더 시 UI** (spec 미정):
- 프로젝트 헤더 (▼ 즉시 / 0건)
- 본문: task row 없음, 그냥 공백
- "기타" MS 도 task 없으니 미렌더 (tasksWithLabels 빈 배열)

**제안 A**: 그냥 공백 — 미니멀. 프로젝트 헤더만 보이고 바로 다음 project로.
**제안 B**: 빈 MS 표시 안 하되 inline "+ 할일" 버튼 / 플레이스홀더 ("여기에 빠르게 추가" 등) — C4 Option 과 연계 시 시너지.

**권장: B** — 사용자 유도 효과. 단순 구현 (ProjectGroup 내 `if (totalInSection === 0 && project.isSystem)` 분기 추가).

### C4. 프로젝트 헤더 hover "+ 할일" (Issue 3 Option C)

#### C4-1. 프로젝트 헤더 JSX

[`cells/PersonalTodoProjectGroup.jsx:56-86`](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx#L56-L86) — Project col (grid col 1):
```jsx
<div
  onClick={onToggle}
  style={{
    gridRow: `1 / span ${spanRows}`,
    padding: '6px 12px 6px 4px',
    cursor: 'pointer',
    alignSelf: 'start',
    minWidth: 0,
  }}
>
  <div style={{  /* project name + caret */ }}>
    <span>{isExpanded ? '▼' : '▶'}</span>
    <span style={{ flex: 1, minWidth: 0 }}>{project.name}</span>
  </div>
  <div style={{ /* count "N건" */ }}>
    {totalInSection}건
  </div>
</div>
```

**특징**:
- 전체 div 클릭 시 `onToggle` (접기/펼치기) 호출
- "+ 할일" 버튼 추가 시 `e.stopPropagation()` 필수

#### C4-2. hover 패턴 예시

기존 code `[hover, setHover] = useState(false)` + `onMouseEnter/Leave` 패턴 여러 곳:
- `FocusCard.jsx:27, 51-52`
- `PersonalTodoTaskRow.jsx:74-75`
- `Sidebar.jsx:455` (SortableProjectItem hover)

ProjectGroup 에 동일 패턴 적용 가능.

#### C4-3. 클릭 충돌 해결

"+ 할일" 영역 클릭 시:
```jsx
<span
  onClick={e => { e.stopPropagation(); setAdding(true) }}  // onToggle 호출 방지
  style={{ ... }}
>+</span>
```

기존 Sidebar.jsx L550, L558 패턴 재사용.

#### C4-4. Inline input 렌더 위치

**옵션 A** — Project col 내부 (count 아래):
```jsx
<div>▼ 프로젝트명</div>
<div>N건</div>
{adding && <input autoFocus ... />}  // 여기
```

**옵션 B** — Task rows 영역 최하단 (col 2 + col 3 자리):
```jsx
{isExpanded && tasksWithLabels.map(...)}
{adding && (
  <>
    <div />  {/* col 1 empty placeholder */}
    <div style={{ gridColumn: '2 / 4' }}>  {/* col 2-3 merge */}
      <input ... />
    </div>
  </>
)}
```

**권장: B** — 프로젝트 col 은 헤더/카운트만, 입력은 task 행 자리에 나타나는 것이 UI 논리에 맞음.

#### C4-5. addTask API

[`useStore.js:585-612`](../../src/hooks/useStore.js#L585-L612):
```js
addTask: async (task) => {
  ...
  const t = { id: uid(), done: false, notes: '', sortOrder: Date.now(), category: 'today', alarm: null, ...teamDefaults, ...task }
  ...
  return t
},
```

호출 패턴:
```js
addTask({
  text,
  projectId: project.id,       // 해당 프로젝트
  assigneeId: currentUserId,
  secondaryAssigneeId: null,
  keyMilestoneId: null,        // 기본 '기타' 그룹
  category: 'today',           // 지금 할일 섹션에 생성
  isFocus: false,
})
```

정상 동작 확인 ✓.

### C5. 전역 "+ 새 할일" 드롭다운 (Issue 3 Option A)

#### C5-1. 현재 버튼 위치

[`PersonalTodoListTable.jsx:155-168`](../../src/components/views/personal-todo/PersonalTodoListTable.jsx#L155-L168):
```jsx
{!adding && (
  <button
    onClick={() => setAdding(true)}
    style={{
      border: `1px solid ${COLOR.border}`, background: '#fff',
      fontSize: FONT.caption, color: COLOR.textSecondary,
      padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
      fontFamily: 'inherit',
    }}
  >
    + 새 할일
  </button>
)}
```

클릭 → `setAdding(true)` → L171-L190 inline input 렌더. handleAddFinish (L119-L139) 는 **현재 projectId=instantProjectId 강제**.

#### C5-2. 드롭다운 옵션

**대상 프로젝트 목록**: Shell `projects` prop. Sidebar 동일 전달 (팀 + 개인). `currentTeamId` 있으면 팀 프로젝트도 포함 — 사용자 선택 가능.

**시스템 프로젝트** (`isSystem=true`): 목록 최상단 고정 (`sortProjectsLocally` 기본 동작 활용).

#### C5-3. 드롭다운 패턴 재사용

**커스텀 드롭다운 존재**:
- `components/common/MsDropdown.jsx` — MS 선택 (OutlinerEditor 내 사용)
- `components/project/OwnerDropdown.jsx` — 담당자 선택

**네이티브 `<select>` 사용 패턴**: `weekly-schedule/CellInlineAdd.jsx:78` 에 `<select value={selectedProjectId}>` 존재. **그대로 참조 가능**.

**판단**: 처음엔 네이티브 `<select>` 로 구현 (단순 + 접근성). 추후 UX 튜닝 시 OwnerDropdown 스타일 커스텀으로 전환 검토.

#### C5-4. localStorage 키 네이밍

기존 localStorage 키 관례:
- `currentTeamId` — 팀 ID
- `selectedFocusTaskId` — 단일 id (Loop-46)
- `personalSectionExpanded` — 맵 형태
- `membersViewDensity` — 스칼라

**제안 키**: `lastAddProjectId` 또는 `personalBacklogLastProject`. 네이밍 규칙: camelCase, 용도 서술.

**권장**: `lastAddProjectId` — 짧고 의미 명확.

초기값 fallback 체인:
1. localStorage 저장값 → 현재 projects 에 존재하는지 검증 (stale 방어)
2. 없으면 '즉시' (systemKey='instant') project.id
3. 그마저 없으면 projects[0].id (또는 null)

---

## D. 통합 연결점

### D1. Shell handleDragEnd 확장점

[`PersonalTodoShell.jsx:83-97`](../../src/components/views/personal-todo/PersonalTodoShell.jsx#L83-L97):
```js
// ═══ 1) 백로그 → 포커스 패널 (F-23) ═══
if (activeIdStr.startsWith('bl-task:')) {
  if (overId === 'focus-panel:root' || overId.startsWith('focus-card:')) {
    const taskId = activeIdStr.slice('bl-task:'.length)
    const maxOrder = focusTasks.reduce(
      (m, t) => Math.max(m, t.focusSortOrder ?? 0),
      0,
    )
    updateTask(taskId, { isFocus: true, focusSortOrder: maxOrder + 1 })
    // F-36: 드롭 직후 자동 active 선택
    setSelectedFocusTaskId(taskId)
    return
  }
  return
}
```

**Loop-47 추가 지점** (setSelectedFocusTaskId 바로 뒤):
```js
setExpandedFocusCards(prev => { const next = new Set(prev); next.add(taskId); persistToLS(next); return next })
```

(설계는 D3 참조)

### D2. FocusQuickAddInput handleAdd 확장점

[`FocusQuickAddInput.jsx:24-36`](../../src/components/views/personal-todo/cells/FocusQuickAddInput.jsx#L24-L36):
```js
const t = await addTask({
  text, projectId: instantProjectId, ...
  isFocus: true,
})
// F-36: 생성 직후 자동 active 선택
if (t?.id) setSelectedFocusTaskId(t.id)
setValue('')
```

**Loop-47 추가**: `if (t?.id)` 블록 내에서 `setExpandedFocusCards(add t.id)` 호출.

### D3. `expandedFocusCardIds` 저장 설계

#### D3-1. `usePivotExpandState` 재사용 가능성

[`usePivotExpandState.js:8-12`](../../src/hooks/usePivotExpandState.js#L8-L12):
```js
const KEYS = {
  team: 'matrixPivotExpanded',
  personal: 'personalMatrixPivotExpanded',
  personalSection: 'personalSectionExpanded',  // Loop-45 F-12
}
```

**구조**: `{[id]: boolean}` map. API: `pivotCollapsed` 객체 + `setPivotCollapsed(pid, value)`.

**포커스 카드 확장 적합성**:
- ✅ per-id boolean 관리 패턴 동일
- ✅ localStorage 저장
- ✅ 여러 카드 동시 펼침 허용 (spec 요구)

**권장: 재사용** — KEYS 에 `focusCardExpanded: 'focusCardExpanded'` 추가. FocusCard 에서 `const {pivotCollapsed: expandedCards, setPivotCollapsed: setExpandedCards} = usePivotExpandState('focusCardExpanded')`.

**주의**: 네이밍 약간 혼란스러움 (`pivotCollapsed` 변수명이 "expanded" 의미 담음). 자체 hook 신설도 고려 가능 (`useFocusCardExpand`) 이나 1~2 줄 중복이라 재사용이 경제적.

#### D3-2. KEYS 확장

`'focusCardExpanded'` 키 추가. 네이밍은 Loop-45 `'personalMatrixPivotExpanded'`, `'personalSectionExpanded'` 일관성 유지.

#### D3-3. Stale cleanup

**시나리오**: 카드 펼침 → × 버튼으로 unfocus → expandedCards 에 id 남음. localStorage 용량 누적.

**대응**:
- **선택 A (권장, 간단)**: 렌더 시 `expandedCards[task.id]` 체크만 하고 cleanup 안 함. 재포커스 시 자동 복원. 용량 부담 무시할 수준 (per-id boolean 수십 개 max)
- 선택 B: `updateTask({isFocus: false})` 시 store action 내에서 cleanup — store-hook 결합, 복잡

**권장: A** — 스펙 이슈 없음.

### D4. `selectedFocusTaskId` 재평가 (A1.2 와 연계)

#### D4-1. 참조 전수 (A1.2 표 재정리)

| 파일 | 라인 | 용도 분류 |
|---|---|---|
| `FocusNotePanel.jsx` L18, 27, 29, 34 | 노트 패널 전환 | **(a) 제거 대상** (패널 삭제) |
| `FocusCard.jsx` L20-28, 53, 59 | 시각 active 표시 (border accent) | **(b) 유지 후보** |
| `PersonalTodoShell.jsx` L53, 93, 113 | handleDragEnd bl-task→focus 직후 호출 | **(a) 제거 후보** (대체: setExpandedFocusCards) |
| `FocusQuickAddInput.jsx` L14, 34 | QuickAdd Enter 후 호출 | **(a) 제거 후보** (동일 대체) |

#### D4-2. Loop-47 선택

**옵션**:

**(i) 완전 제거** (권장):
- store field + setter + localStorage 제거
- FocusCard 에서 `isSelected` 개념 삭제, border 기본값 + expand 시 border accent 로 대체
- Shell handleDragEnd / FocusQuickAddInput: `setSelectedFocusTaskId` 호출을 `setExpandedFocusCards(add id)` 로 교체
- **장점**: 상태 단순화, 기능 충돌 없음
- **단점**: border accent 표시가 "펼친 상태" 와 동일 — "펼치지 않은 active 카드" 개념 사라짐 (UX 허용 가능)

**(ii) 유지 — 시각 표시만**:
- auto-select 로직은 그대로 (handleDragEnd / QuickAdd)
- FocusCard border accent 유지
- 인라인 펼침은 별개 (expandedCards)
- **장점**: 작업 이력 시각화 (auto-select 된 카드 강조)
- **단점**: 2개 상태 병존 (selected ≠ expanded) 혼란 가능

**권장: (i) 완전 제거**. 인라인 펼침 상태 자체가 "현재 편집 중" 을 명확히 표현 → selectedFocusTaskId 는 중복/불요.

---

## E. Loop-47 실행 계획 제안

### Stage 0 — PROJECT_COLUMNS 1줄 fix (최우선, 즉시)

| Commit | 파일 | 변경 |
|---|---|---|
| 0 | `useStore.js:7` | `is_system, system_key` 2컬럼 추가 |

이 하나로 **Issue 2a (즉시 최상단) + 2b (+ 새 할일)** 동시 해결. Vercel 재배포 후 브라우저 강력 새로고침 즉시 반영. 후속 Stage 들과 독립.

### Stage 1 — 2-pane 복귀 (중립 리팩터)

| # | Commit | 요지 |
|---|---|---|
| 1 | 2-pane grid 전환 + FocusNotePanel DELETE | Shell grid 2-col, FocusNotePanel.jsx 파일 삭제, import/render 정리 |
| 2 | selectedFocusTaskId 완전 제거 (옵션 i 선택 가정) | store field + setter + localStorage 삭제, 참조처 정리 |

### Stage 2 — 인라인 카드 펼침 (신규 기능)

| # | Commit | 요지 |
|---|---|---|
| 3 | usePivotExpandState 'focusCardExpanded' KEY 추가 | 1줄 |
| 4 | FocusCard 인라인 확장 body (OutlinerEditor 삽입 + caret toggle) | 주요 변경 |
| 5 | handleDragEnd/FocusQuickAddInput → auto-expand 연결 | Stage 1 Commit 2 완료 전제 |

### Stage 3 — UI 정비

| # | Commit | 요지 |
|---|---|---|
| 6 | LIST 토큰 축소 + Shell grid 비율 `1.5fr : 1fr` | 1~2 파일 |
| 7 | F-11 예외 — 시스템 프로젝트 task 0건에도 표시 | ListTable 2곳 + ProjectGroup 1곳 |

### Stage 4 — 할일 추가 UI (Ryan Q4 결정 후)

| # | Commit | 요지 |
|---|---|---|
| 8 | 프로젝트 헤더 hover "+ 할일" inline add | ProjectGroup 확장 |
| 9 | 전역 "+ 새 할일" 드롭다운 (프로젝트 select + localStorage) | ListTable TodaySection 확장 |

---

## F. Ryan 결정 요청 (8건)

| # | 질문 | 권장 |
|---|---|---|
| Q1 | selectedFocusTaskId 처리 (완전 제거 vs 시각 표시만 유지) | **완전 제거** (옵션 i) |
| Q2 | defensive OR 필터 유지 vs 단순화 (isSystem만) | **유지** (안전망) |
| Q3 | 인라인 펼침 애니메이션 (없음 vs max-height slide) | **없음** (caret rotate 만) |
| Q4 | Shell grid 비율 | `minmax(420, 1.5fr) minmax(280, 1fr); gap 20` |
| Q5 | LIST 토큰 축소 수치 | `colWidthProject 170→130, colWidthMilestone 130→90` |
| Q6 | F-11 예외 — 빈 시스템 프로젝트 UI | **제안 B** (프로젝트 헤더 + "여기에 + 할일" 플레이스홀더) |
| Q7 | Inline add input 렌더 위치 (Project col 내부 vs task rows 영역) | **task rows 영역** (옵션 B) |
| Q8 | 전역 드롭다운 — 네이티브 select vs 커스텀 (OwnerDropdown 스타일) | **네이티브 select** (1차), 후속 UX 튜닝 시 전환 |

---

## G. 파일 크기

약 29 KB — 40 KB 목표 내.
