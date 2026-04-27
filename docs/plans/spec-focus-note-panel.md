# Spec — 포커스 노트 패널 (3-pane 확장)

> **상위 입력**: [recon-focus-note-panel.md](recon-focus-note-panel.md) — 검증 완료
> **목적**: Loop-45 이후 2-pane [백로그 \| 포커스] → 3-pane [백로그 \| 포커스 \| 노트] 확장. 선택된 포커스 카드의 `notes` 필드를 3번째 컬럼에 OutlinerEditor로 렌더, DetailPanel과 동일 필드 공유로 양방향 실시간 동기화.

---

## ⚠ 0. 선제 정정 — Tiptap 전제 제거

원 스펙 §0의 *"notes 필드(Tiptap JSON)"* 는 사실 오류. 코드베이스에 Tiptap/ProseMirror 전무:

**수정된 이해**:
- `tasks.notes` = **plain text** (tab-indent + '\n' 형식)
- parse/serialize: [utils/notes.js](../../src/utils/notes.js) 경유 — `parseNotes(notes: string): Node[]`, `serializeNotes(nodes: Node[]): string`
- OutlinerEditor가 내부적으로 `<textarea>` 기반 커스텀 구현 (Tiptap 미사용)
- 이하 spec은 모두 **plain text** 전제

---

## 1. Stage 0 — 프리컨디션 (Claude Code 실행 전 1회 검증)

### 1.1 DB 컬럼 타입 확인

**✅ 확정 가정**: `tasks.notes` 는 `text` 타입 (레거시, migration에 명시 없음). 거의 확실하므로 **migration 없이 진행**.

**검증 방법** (Claude Code Stage 0 체크포인트):
```sql
-- Supabase Studio → SQL Editor 실행
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tasks' AND column_name = 'notes';
-- 예상: notes | text
```

- `text` 확인되면 → 본 Loop 착수
- `text` 아니면 (`jsonb`, `varchar` 등) → 본 spec 재검토 (parseNotes/serializeNotes 입출력 형식 재확인 필요)

Migration SQL은 본 Loop에서 추가 **없음** (신규 컬럼/테이블 0).

---

## 2. 결정 사항

### 2.1 ❓ 6건 확정

| # | 항목 | 결정 | 근거 |
|---|---|---|---|
| 1 | DB 컬럼 타입 | `text` 가정, Stage 0에서 1회 검증 | 레거시 + 실사용 패턴 일치 |
| 2 | grid vs flex | **grid** (Shell 구조 전환) | `1.5fr:0.9fr:1.2fr` 명시성 + `minmax`로 min-width 보장 + 4-pane 확장 여지 |
| 3 | 아이콘 위치 | **메타 줄 끝** (flex spacer 뒤) | × 버튼과 hit target 분리, 한 줄 스캔 용이 |
| 4 | 최소 뷰포트 | **≥1080px 3-pane**, 미만은 2-pane fallback | 노트는 DetailPanel로 대체 가능 |
| 5 | 동시 편집 | **허용** (초기 릴리즈) | 빈도 낮음, 디바운스 800ms로 단방향 연속 타이핑 안전 |
| 6 | OutlinerEditor 수정 | **수정 금지** (#5와 연동) | "shared, never modified directly" 원칙 |

### 2.2 추가 결정 5건 (Recon 간접 제기)

| # | 항목 | 결정 |
|---|---|---|
| 1 | Shell `gap` | `24 → 20` (3-column 총 40px 여백) |
| 2 | 노트 패널 `borderLeft` | FocusPanel과 동일 `1px solid COLOR.border` — 3-section 시각 구분 |
| 3 | 빈 notes 판별 | `utils/notes.js`에 `isEmptyNotes(notes): boolean` 1줄 util 신설, FocusCard 아이콘 + FocusNotePanel empty state 2곳 재사용 |
| 4 | 자동 선택 트리거 | `FocusQuickAddInput` (addTask 반환값 활용) + Shell `handleDragEnd` bl-task→focus 직후 2곳 |
| 5 | debounce 800ms 출처 | DetailPanel L71-L81 패턴 **복제** (공통 hook 추출은 범위 외) |

---

## 3. REQ-LOCK

### 3.1 기능 (F-34 ~ F-41)

| ID | 요구사항 | 검증 기준 |
|---|---|---|
| **F-34** | Shell 레이아웃 변경: `display: grid; grid-template-columns: minmax(450px, 1.5fr) minmax(240px, 0.9fr) minmax(320px, 1.2fr); gap: 20px;` (flex → grid 전환) | DevTools `grid-template-columns` 확인 + 각 pane 최소폭 유지 |
| **F-35** | 포커스 카드 클릭 → `setSelectedFocusTaskId(task.id)` (openDetail과 **별개** 액션) → 노트 패널 즉시 해당 task로 전환 | 클릭 후 노트 패널 내용 갱신, DetailPanel 열리지 않음 |
| **F-36** | 자동 active 선택 트리거 2곳: ① `FocusQuickAddInput` Enter 직후 `addTask(...).then(t => setSelectedFocusTaskId(t.id))` ② Shell `handleDragEnd` 백로그→포커스 성공 직후 `setSelectedFocusTaskId(taskId)` | 생성/드롭 직후 노트 패널 = 새 task 노트 |
| **F-37** | FocusCard 메타 줄 끝에 노트 아이콘 — flex spacer(`<div style={{flex:1}}/>`) 뒤에 SVG 아이콘. `isEmptyNotes(task.notes)` ? `#d3d1c7` : `#2383e2`. 이모지 📝 대신 **SVG** 사용 (환경별 렌더 차이 회피) | 이모지 0 개, SVG path 존재 |
| **F-38** | FocusNotePanel 은 `tasks.notes` 단일 필드 사용. DetailPanel L71-L81 패턴 복제: (a) 즉시 optimistic store setState, (b) 800ms debounce 후 `updateTask(id, {notes})` | 타이핑 시 500ms 내 다른 구독자(DetailPanel) 반영 확인 |
| **F-39** | `focusTasks.length === 0` 또는 `selectedFocusTaskId === null` (또는 선택된 task 부재/삭제) → 노트 패널 empty state: "포커스 카드를 선택하면 노트가 여기에 표시됩니다" | 초기 상태 문구 표시 |
| **F-40** | `selectedFocusTaskId` Zustand store 필드 + localStorage 저장. `useStore.js` L1568 `currentTeamId` 전례 패턴 (`localStorage.getItem('selectedFocusTaskId')` 초기 로드, `setSelectedFocusTaskId` 액션이 setState + `localStorage.setItem` 동시 기록) | reload 후 이전 선택 복원 |
| **F-41** | 뷰포트 `window.innerWidth < 1080` → 노트 패널 숨김 (2-pane fallback = Loop-45 동작). `window.innerWidth < 768` → 기존 `PersonalMatrixMobileList` (변경 없음) | 브라우저 리사이즈 반응형 확인 |
| **F-42** | `FocusNotePanel` 헤더의 task 제목(+메타)을 clickable로 렌더 → 클릭 시 `openDetail(selectedTask)` 호출. hover 시 `text-decoration: underline` + `cursor: pointer` 시각 힌트. **근거**: Loop-45 F-01 필터로 포커스 task는 백로그에서 숨겨져 DetailPanel 진입 경로 부재 — 노트 외 날짜/상태/담당자/MS/댓글/알람 편집 UI 접근 필요 | 헤더 제목 클릭 → DetailPanel 열림, hover 시 underline 표시 |

### 3.2 비기능 (N-13 ~ N-14)

| ID | 요구사항 |
|---|---|
| N-13 | OutlinerEditor **수정 금지**. 현재 props API (`{notes, onChange, accentColor, onExitUp, onExitDown, allTopCollapsed}`) 그대로 재사용. 신규 파일에서 import만 |
| N-14 | 동시 편집 관용 — 초기 릴리즈 scope. 동일 사용자가 DetailPanel + FocusNotePanel 양쪽에서 동일 task 노트를 동시 편집할 경우, 최근 타이핑이 이김 (자연스러움). 리그레션 리포트 발생 시 후속 Loop에서 처리 |

---

## 4. Store 변경 (useStore.js)

### 4.1 신규 필드 + 액션 (selectedFocusTaskId)

기존 `currentTeamId` 패턴 (L1568, L1584-L1588) 복제:

```js
// store 초기값 정의 영역 (예: L1568 근처)
selectedFocusTaskId: localStorage.getItem('selectedFocusTaskId') || null,

// 액션 (store action 영역)
setSelectedFocusTaskId: (taskId) => {
  set({ selectedFocusTaskId: taskId || null })
  if (taskId) {
    try { localStorage.setItem('selectedFocusTaskId', taskId) } catch {}
  } else {
    try { localStorage.removeItem('selectedFocusTaskId') } catch {}
  }
},
```

**주의사항**:
- task가 삭제/done 처리되면 `selectedFocusTaskId` 는 stale 될 수 있음. FocusNotePanel이 렌더 시점에 `tasks.find(t => t.id === id && !t.done && !t.deletedAt && t.isFocus)` 로 재검증. 없으면 empty state.
- `toggleDone`/`updateTask({isFocus:false})` 액션에서 해당 task가 현재 selected면 auto-clear 고려 (옵션 — 다음 선택까지는 빈 empty state로 두어도 UX 수용 가능).

**스펙 단순화**: auto-clear 로직 없음. 패널이 stale id 방어.

---

## 5. Util 변경 (utils/notes.js)

### 5.1 `isEmptyNotes` 신설

```js
// utils/notes.js 끝에 추가
export function isEmptyNotes(notes) {
  return !notes || !notes.trim()
}
```

**사용처**:
- FocusCard: `const hasNotes = !isEmptyNotes(task.notes)` → 아이콘 색상 분기
- FocusNotePanel: empty state 판단 (선택된 task.notes 빈지 체크) — 단, empty state 판단은 `selectedFocusTaskId` null 체크가 우선. notes 비어있을 때는 OutlinerEditor가 자체로 "추가" 버튼 렌더하므로 별도 empty state 불필요

---

## 6. 신규 파일 (1개) + 수정 파일 (3개)

### 6.1 신규

| 파일 | 역할 |
|---|---|
| `src/components/views/personal-todo/FocusNotePanel.jsx` | 3번째 pane. `selectedFocusTaskId` 구독, 해당 task의 notes를 OutlinerEditor로 렌더, 800ms debounce 저장, empty state, sticky position. **헤더의 task 제목(+메타) 클릭 시 `openDetail(selectedTask)` 호출 (F-42)** — DetailPanel 진입 경로 제공 |

**시그니처**:
```jsx
export default function FocusNotePanel({ tasks, projects }) {
  // - selectedFocusTaskId = useStore(s => s.selectedFocusTaskId)
  // - openDetail = useStore(s => s.openDetail)
  // - selectedTask = tasks.find(t => t.id === selectedFocusTaskId && t.isFocus && !t.done && !t.deletedAt)
  // - debounceRef + handleNotesChange (DetailPanel L71-L81 복제)
  // - selectedTask === undefined → empty state
  // - accentColor: getColor(selectedTask의 project.color).dot
  // - 헤더: <button onClick={() => openDetail(selectedTask)}>{selectedTask.text}</button>
  //   + hover 시 text-decoration: underline (F-42)
}
```

### 6.2 수정

| 파일 | 변경 요지 |
|---|---|
| `src/hooks/useStore.js` | `selectedFocusTaskId` 필드 + `setSelectedFocusTaskId` 액션 추가 |
| `src/utils/notes.js` | `isEmptyNotes` 추가 (1줄 export) |
| `src/components/views/personal-todo/PersonalTodoShell.jsx` | flex → grid 전환 + 3-column + FocusNotePanel 렌더 + `handleDragEnd`의 바로그→focus 케이스에 `setSelectedFocusTaskId(taskId)` 추가 + 뷰포트 `<1080` 분기 (2-pane fallback) |
| `src/components/views/personal-todo/cells/FocusCard.jsx` | 메타 줄 끝에 SVG 노트 아이콘 추가 + 카드 클릭(또는 별도 영역) 시 `setSelectedFocusTaskId` 호출 |
| `src/components/views/personal-todo/cells/FocusQuickAddInput.jsx` | `handleAdd` 에서 `addTask(...)` 반환값 활용 → `setSelectedFocusTaskId(t.id)` |

---

## 7. 세부 구현 노트

### 7.1 Shell grid 전환 (F-34 + F-41)

```jsx
// PersonalTodoShell.jsx 핵심 리뷰
// 2-pane 조건: window.innerWidth < 1080 (F-41)
const isWide = typeof window !== 'undefined' && window.innerWidth >= 1080

<div style={{
  display: 'grid',
  gridTemplateColumns: isWide
    ? 'minmax(450px, 1.5fr) minmax(240px, 0.9fr) minmax(320px, 1.2fr)'
    : 'minmax(450px, 1.5fr) minmax(240px, 0.9fr)',
  gap: 20,
  width: '100%',
}}>
  {/* Left */}
  <div style={{ minWidth: 0 }}>
    <PersonalTodoListTable ... />
  </div>

  {/* Middle (Focus) — drop target 유지 */}
  <div ref={focusDropRef} style={{ minWidth: 240, ... }}>
    <FocusPanel ... />
  </div>

  {/* Right (Note) — 1080px 이상만 */}
  {isWide && (
    <div style={{ minWidth: 320, borderLeft: `1px solid ${COLOR.border}` }}>
      <FocusNotePanel tasks={tasks} projects={projects} />
    </div>
  )}
</div>
```

**주의**:
- `isWide` 는 `useState` + `resize` 리스너로 반응형 처리 필요 (단순 `window.innerWidth` 는 첫 마운트 값만 반영)
- resize 리스너: debounce 100-200ms 권장 (과도한 re-render 방지)

### 7.2 노트 아이콘 SVG (F-37)

📝 이모지 회피 이유: iOS/Android/Windows 렌더 차이로 크기·위치 불일치. SVG로 일관성 확보.

**제안 아이콘** (24x24 기반으로 스케일):
```jsx
// FocusCard.jsx 추가 영역
import { isEmptyNotes } from '../../../../utils/notes'

const hasNotes = !isEmptyNotes(task.notes)
const noteIconColor = hasNotes ? '#2383e2' : '#d3d1c7'

// 메타 줄 내부
<div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontSize: FONT.ganttMs }}>
  {projectLabel && <span style={projectLabelStyle}>{projectLabel}</span>}
  {milestone?.title && <span style={{color: COLOR.textTertiary}}>{projectLabel?'·':''} {milestone.title}</span>}
  <div style={{ flex: 1 }} />  {/* spacer: 아이콘을 우측 끝으로 */}
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ color: noteIconColor, flexShrink: 0 }}>
    {/* 간단한 노트/라인 아이콘 */}
    <path d="M4 4h16v16H4z M7 8h10 M7 12h10 M7 16h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
</div>
```

(정확한 SVG path 는 diff-plan 단계 또는 구현 시 적절한 아이콘 라이브러리 스타일로 확정)

### 7.3 FocusCard 클릭 분리 (F-35)

**현재 FocusCard** L91-L102:
```jsx
<div onClick={() => openDetail(task)} style={{...}}>
  {task.text}
</div>
```

**변경안**: "카드 본문 클릭" ≠ "DetailPanel 열기". spec F-35는 클릭 시 **setSelectedFocusTaskId만** 호출. DetailPanel 열기는 별도 경로(× 처럼 별도 버튼) 또는 제거.

**옵션 A**: 카드 본문 클릭 → `setSelectedFocusTaskId(task.id)`. DetailPanel 열기 액션은 제거 (노트 패널이 같은 역할). 단순 + 3-pane의 의미 강화.

**옵션 B**: 카드 본문 클릭 → 선택 + DetailPanel 둘 다. 양쪽에 노트 편집 UI 노출 → 동시 편집 위험 증가.

**권장: 옵션 A** — spec 1.2 "노트 패널에 해당 task의 notes 렌더"가 주 목적. DetailPanel은 상세 편집 (카테고리/MS/담당자 등) 용으로 역할 분리.

**확정**: 옵션 A + **노트 패널 헤더 clickable** (F-42) 병행. FocusCard에 아이콘 과포화 회피하면서 DetailPanel 진입 경로 확보:
- FocusCard = 선택/체크/해제 (클릭 = 선택만)
- FocusNotePanel 헤더 = 노트 + 상세 진입 (제목 클릭 = `openDetail`)
- 백로그 task는 기존 hover detail arrow 유지 (Loop-45)

이 구조로 포커스 task의 상세 편집 경로가 노트 패널 헤더 1개로 명확해짐.

### 7.4 selectedFocusTaskId stale 방어 (F-40)

FocusNotePanel 렌더:
```jsx
const selectedFocusTaskId = useStore(s => s.selectedFocusTaskId)
const selectedTask = useMemo(() => {
  if (!selectedFocusTaskId) return null
  return tasks.find(t =>
    t.id === selectedFocusTaskId &&
    t.isFocus === true &&
    !t.done &&
    !t.deletedAt
  ) || null
}, [tasks, selectedFocusTaskId])

if (!selectedTask) {
  return <EmptyState />  // F-39
}
// OutlinerEditor wrapper 렌더
```

localStorage 저장된 id가 삭제/unfocused/done 된 task를 가리키면 `selectedTask === null` → 자연스러운 empty state. 별도 cleanup 불필요.

---

## 8. R-ATOMIC 커밋 분할 (7 commits)

| # | Commit | 파일 | 빌드/상태 |
|---|---|---|---|
| 1 | `feat(utils): isEmptyNotes (Loop-46)` | `utils/notes.js` | ✅ (미사용) |
| 2 | `feat(store): selectedFocusTaskId 필드 + setter + localStorage 복원` | `useStore.js` | ✅ |
| 3 | `feat(cells): FocusCard 노트 SVG 아이콘 + 카드 클릭 시 setSelectedFocusTaskId` | `FocusCard.jsx` | ✅ (아이콘만 동작, 패널 미연결) |
| 4 | `feat(cells): FocusQuickAddInput + Shell handleDragEnd → 자동 선택` | `FocusQuickAddInput.jsx` + `PersonalTodoShell.jsx` (handleDragEnd만) | ✅ (선택 트리거만) |
| 5 | `feat(panel): FocusNotePanel 신규 (OutlinerEditor wrapper + 800ms debounce + empty state)` | `FocusNotePanel.jsx` (신규 1) | ✅ (미연결) |
| 6 | `feat(shell): 3-pane grid 전환 + FocusNotePanel wire + resize 반응형` | `PersonalTodoShell.jsx` (grid 구조 + 뷰포트 분기) | ✅ **QA 체크포인트** |
| 7 | `feat(shell): 뷰포트 <1080px 2-pane fallback 최종화` | `PersonalTodoShell.jsx` (세부 튜닝) | ✅ 완료 |

**Commit 6 = QA 전수 검증 포인트** — F-34~F-41 합격 후 7 진행.

**각 커밋 후 `npm run build` + eslint 신규 파일 통과 필수.**

---

## 9. QA 체크리스트 (Commit 6 이후)

### 9.1 3-pane 레이아웃

| 요구 | 방법 | 기준 |
|---|---|---|
| F-34 | DevTools → Shell div 선택 → `grid-template-columns` | `minmax(450px, 1.5fr) minmax(240px, 0.9fr) minmax(320px, 1.2fr)` (1080px 이상) |
| F-34 | 실제 렌더 폭 비율 | 대략 1.5:0.9:1.2 (viewport에 따라 변동) |
| F-41 | 브라우저 창 1080px 미만으로 리사이즈 | 노트 패널 숨김, 2-pane (Loop-45 동작) |
| F-41 | 768px 미만 | `PersonalMatrixMobileList` 렌더 |

### 9.2 선택 로직

| 요구 | 방법 | 기준 |
|---|---|---|
| F-35 | 포커스 카드 클릭 | 노트 패널 해당 task 노트 렌더. DetailPanel 열리지 **않음** |
| F-36 | FocusQuickAddInput Enter | 생성 직후 노트 패널이 새 task 로 전환 |
| F-36 | 백로그 → 포커스 드래그 드롭 | 드롭 직후 노트 패널이 드롭된 task 로 전환 |
| F-40 | 선택 후 브라우저 reload | `localStorage.getItem('selectedFocusTaskId')` 값 복원, 노트 패널 해당 task 렌더 |
| F-40 stale | 선택 후 해당 task × 버튼으로 unfocus → reload | 복원된 id가 stale → empty state |
| **F-42** | 노트 패널 헤더의 task 제목 클릭 | DetailPanel 오픈. hover 시 제목 underline 표시 |

### 9.3 노트 동기화

| 요구 | 방법 | 기준 |
|---|---|---|
| F-38 | 노트 패널에서 편집 + DetailPanel 동시 열기 | 800ms 내 DetailPanel 반영 |
| F-38 | DetailPanel 편집 → 노트 패널 반영 | 800ms 내 (디바운스 동일) |
| F-38 optimistic | 타이핑 중 즉각 반영 | 키 입력 직후 store 업데이트 (디바운스는 DB 저장만) |

### 9.4 아이콘 + 빈 상태

| 요구 | 방법 | 기준 |
|---|---|---|
| F-37 | 빈 notes task의 카드 | 아이콘 `#d3d1c7` (회색) |
| F-37 | notes 있는 task | 아이콘 `#2383e2` (파랑) |
| F-37 | DevTools → 아이콘 요소 | `<svg>` 태그, 이모지 0 |
| F-39 | 포커스 0건 or 선택 없음 | "포커스 카드를 선택하면 노트가 여기에 표시됩니다" |

### 9.5 비기능

| 요구 | 방법 | 기준 |
|---|---|---|
| N-13 | `git diff src/components/shared/OutlinerEditor.jsx` | 빈 diff |
| N-14 | 양쪽 동시 편집 | 최근 타이핑 값이 최종 반영 (spec 허용 동작) |

---

## 10. 리스크 / 확인 요청

### 10.1 기술 리스크

| # | 리스크 | 완화 |
|---|---|---|
| R1 | DB `notes` 컬럼이 `text` 아닌 경우 (거의 없음) | Stage 0 SQL 검증 |
| R2 | 동시 편집 시 커서 위치 손실 | N-14 허용. 사용자 리포트 발생 시 후속 Loop |
| R3 | resize 리스너 과도 리렌더 | 100-200ms debounce |
| R4 | Stage 0 검증 skip 시 spec 가정 오류 누적 | Commit 1 이전 Ryan이 SQL 1회 실행 |
| R5 | ~~selectedFocusTaskId가 팀 전환 후에도 남아있음~~ **CLOSED** | 유지로 확정. FocusPanel filter가 `assigneeId === currentUserId` 로 user-scoped (team 무관). stale id는 F-40 방어 (`selectedTask === null` → empty state)로 충분히 커버. setTeam cleanup 불요 |
| R6 | OutlinerEditor의 자기에코 L27 체크가 DetailPanel + FocusNotePanel 두 개에서 각각 동작 → 한쪽 에코는 다른 쪽에 영향 없음 | recon H 검토 완료 — 실질 위험 낮음 |

### 10.2 Ryan 확답 (확정됨)

| # | 사항 | 확정 |
|---|---|---|
| Q1 | Loop 번호 | **Loop-46** |
| Q2 | Stage 0 DB 검증 | **Ryan 직접 실행**. Commit 1 착수 전 Supabase Studio에서 `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tasks' AND column_name='notes'` 결과 1줄 공유 |
| Q3 | FocusCard 클릭 옵션 | **옵션 A** — `setSelectedFocusTaskId(task.id)` 만 호출, DetailPanel 미열기 |
| Q4 | DetailPanel 진입 경로 | **옵션 A + 노트 패널 헤더 clickable** (신규 F-42). 백로그 task는 기존 hover arrow 유지 |
| Q5 | setTeam 시 `selectedFocusTaskId` 초기화 | **유지** (초기화 안 함). FocusPanel이 user-scoped 필터, stale 방어(F-40)로 커버. R5 closed |
| Q6 | Commit 6 전수 QA 방식 | **수동 QA** (spec §9.1~9.5 체크리스트 브라우저 확인) |

**다음 단계**:
1. Ryan: Stage 0 SQL 실행 → `notes | text` 결과 공유
2. `docs/plans/diff-plan-focus-note-panel.md` (단일 문서, 7 commits) 작성 착수
3. Commit 1부터 순차 적용

---

## 11. 문서 크기

약 18 KB — spec 단일 문서 적정.
