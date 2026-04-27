# Phase 9b Recon — 프로젝트 뷰 BacklogPanel (우측 사이드패널)

> 작성일: 2026-04-09
> 기준: `loop-7-handoff-to-claude-code.md` §Sub-Loop 9-B
> 상태: 조사 완료

---

## 1. 요구사항 요약

> "프로젝트 백로그가 맨 아래 별도 접기 상태로 존재하면 어떤 백로그가 남아 있는지 알기가 어렵다."
> "프로젝트 뷰 우측에 백로그 패널이 있어도 그 위로 할일 상세 페이지 패널이 올라오면 된다."

**목표**: 프로젝트 뷰 우측에 항상 펼쳐진 백로그 패널 신설. MS에 연결되지 않은 task를 노출하고 쉽게 관리하도록 함.

---

## 2. 현재 상태 분석

### 2-1. 프로젝트 뷰 레이아웃 구조

**UnifiedProjectView.jsx** (300줄) — MS가 있는 프로젝트의 메인 뷰
- 헤더: 프로젝트명 + 모드 Pill (전체 할일 / 타임라인)
- 본문: `rightMode`에 따라 MsTaskTreeMode 또는 Timeline 렌더
- **우측 패널 없음** — 현재 전체 너비를 tree+tasks가 사용

**MsTaskTreeMode.jsx** (700줄) — "전체 할일" 모드
- 좌: MS 트리 (340px 고정) / 우: 연결된 할일 (flex)
- 백로그: 하단 `BacklogSection` (접힌 상태, `⊙ 백로그 N건`)
- DnD: **네이티브 HTML5** (dnd-kit 아님)

**CompactMilestoneTab.jsx** (381줄) — Compact 모드 (별도 탭)
- 좌: 마일스톤 / 우: 연결된 할일 (리사이즈 가능)
- 백로그: `__backlog__` pseudo-milestone으로 하단 렌더
- DnD: **dnd-kit** (SortableContext, DragOverlay)

### 2-2. 백로그 필터 패턴 (17+ 사용처)

```js
// 공통 패턴
const backlogTasks = projectTasks.filter(t => !t.keyMilestoneId && !t.done)
```

- `keyMilestoneId === null` → 백로그 (MS 미연결)
- `__backlog__` → UI 상수, DB 저장 시 `null`로 변환

### 2-3. 기존 백로그 UI 비교

| 컴포넌트 | 위치 | 용도 | DnD | 필터 |
|---------|------|------|-----|------|
| MsBacklogSidebar (280px) | 매트릭스 우측 | MS/Task 배정용 drag 소스 | dnd-kit useDraggable | 프로젝트, 배정, depth, 주간시간 |
| BacklogSection (MsTaskTreeMode) | 트리 하단 접힘 | 백로그 존재 표시 | 없음 | 현재 프로젝트만 |
| BACKLOG_MS (CompactMilestoneTab) | 하단 dashed 구분선 | 백로그 task 표시 | dnd-kit (task→MS 이동) | 현재 프로젝트만 |

### 2-4. DetailPanel 오버레이 구조

- **위치**: `position: fixed`, z-index 100 (backdrop z-index 90)
- **데스크톱**: 우측 480px 사이드바, slideIn 애니메이션
- **모바일**: 하단 시트 (top 8vh, 전폭)
- **트리거**: `useStore().openDetail(task)` → App.jsx에서 조건부 렌더
- **핵심**: BacklogPanel은 DetailPanel **아래**(z-index < 100)에 배치해야 함

### 2-5. Task 모델 관련

- `createdBy`: user ID (있음) — 누가 만들었는지
- `createdAt`: **없음** (tasks 테이블에 없음, memos에만 있음)
- `updatedAt`: 있음 — 마지막 수정 시간
- **Age 표시**: handoff 문서는 `createdAt` 기준 age 제안했으나, 필드 없음 → 대안 필요

### 2-6. DnD 컨텍스트 충돌 주의

- MsTaskTreeMode: **네이티브 HTML5 DnD** 사용
- CompactMilestoneTab: **dnd-kit** 사용
- 새 BacklogPanel의 DnD를 추가할 때, 기존 DnD 컨텍스트와 충돌 가능
- MsTaskTreeMode 안에서는 dnd-kit 추가 불가 (네이티브와 혼재 위험)

---

## 3. 구현 옵션

### 옵션 A: UnifiedProjectView 레벨에서 우측 패널 추가 (권장)

```
┌─────────┬──────────────────────────┬─────────────┐
│ Sidebar │ UnifiedProjectView       │ BacklogPanel│
│         │ (MsTaskTreeMode/Timeline)│ (280px)     │
│         │                          │             │
└─────────┴──────────────────────────┴─────────────┘
              DetailPanel (z-index 100, 위에 overlay)
```

**구현**:
- `UnifiedProjectView.jsx`에 flex 레이아웃 추가: `메인 (flex:1) + BacklogPanel (280px)`
- `BacklogPanel.jsx` 신규 컴포넌트
- DnD: BacklogPanel 내부에서 task를 drag → MsTaskTreeMode의 MS 행에 drop

**장점**: 
- 레이아웃 변경 최소 (UnifiedProjectView에 1개 div 추가)
- DetailPanel은 z-index 기반이라 자동으로 위에 뜸
- 모든 rightMode(전체할일/타임라인)에서 백로그 패널 표시 가능

**단점**:
- MsTaskTreeMode의 네이티브 DnD와 BacklogPanel의 dnd-kit 혼재 문제
- DnD 없이 시작하고 후속에서 추가하는 전략 필요

**Trade-off**: DnD는 Phase 2로 분리, 먼저 표시+인라인 편집만 구현

---

### 옵션 B: MsTaskTreeMode 내부에 우측 패널 삽입

**구현**: MsTaskTreeMode의 3-column 레이아웃으로 변경
```
[MS 트리 340px] [연결된 할일 flex] [백로그 280px]
```

**장점**: 같은 컴포넌트 내부라 state 공유 쉬움

**단점**:
- MsTaskTreeMode 700줄 → 더 비대해짐
- 타임라인 모드에서는 BacklogPanel이 안 보임
- "Don't Touch, Wrap It" 정신에 반함 (기존 레이아웃 변경)

---

### 옵션 C: 토글형 오버레이 패널 (DetailPanel과 유사)

**구현**: 백로그 버튼 클릭 시 우측에서 슬라이드 인

**장점**: 레이아웃 변경 없음, 필요할 때만 표시

**단점**: 
- handoff 요구사항 "항상 펼쳐진" 위반
- 백로그 누락 방지 목적에 맞지 않음 (숨겨져 있으면 의미 없음)

---

## 4. 재사용 가능한 함수/패턴

| 항목 | 소스 | 용도 |
|------|------|------|
| 백로그 필터 | `!t.keyMilestoneId && !t.done` | 백로그 task 식별 (17+ 사용처와 일관) |
| InlineAdd.jsx | `src/components/shared/` | `extraFields={{ keyMilestoneId: null }}` 로 백로그 task 추가 |
| MiniAvatar.jsx | `src/components/views/grid/shared/` | assignee 아바타 표시 |
| MilestoneTaskChip.jsx | `src/components/project/` | task chip 렌더 (CompactMilestoneTab에서 사용) |
| openDetail(task) | useStore action | task 클릭 → DetailPanel 열기 |
| toggleDone(id) | useStore action | 체크박스 토글 |
| designTokens.js | `src/styles/` | COLOR, FONT, SPACE 상수 |
| useDraggable (dnd-kit) | MsBacklogSidebar 패턴 | BacklogPanel DnD 구현 시 참고 |

---

## 5. 위험 요소 및 사전 확인

### Critical

| # | 위험 | 영향 | 대응 |
|---|------|------|------|
| C1 | DnD 혼재 (HTML5 vs dnd-kit) | MsTaskTreeMode는 네이티브 DnD, BacklogPanel은 dnd-kit → 동시 사용 시 충돌 | Phase 1: DnD 없이 표시만. Phase 2: DnD 통합 (별도 loop) |
| C2 | `createdAt` 필드 부재 | Age 표시 불가 (`tasks` 테이블에 없음) | `updatedAt` 사용하거나, Age 기능 생략, 또는 DB 마이그레이션 |
| C3 | 좁은 화면에서 3-column 레이아웃 | 1024px 미만 시 BacklogPanel이 메인 콘텐츠 압축 | 반응형: 특정 너비 이하에서 숨김 + 토글 버튼 |

### Warning

| # | 위험 | 대응 |
|---|------|------|
| W1 | DetailPanel과 BacklogPanel z-index 충돌 | BacklogPanel은 일반 flow (z-index 없음), DetailPanel은 fixed z-100 → 자동 해결 |
| W2 | CompactMilestoneTab에도 BacklogPanel 필요? | Compact 모드는 이미 하단에 백로그 있음 → 중복 방지 위해 "전체 할일" 모드만 적용 |
| W3 | 타임라인 모드에서 BacklogPanel 표시 여부 | handoff에서 명시 안 됨 → 사용자 결정 필요 |

### 사전 확인 필요 (사용자 결정)

1. **DnD 범위**: Phase 1에서 DnD 없이 표시+편집만? 아니면 DnD까지 한번에?
2. **Age 표시**: `createdAt` 없음 → (a) `updatedAt` 대체 (b) 생략 (c) DB 마이그레이션으로 추가?
3. **타임라인 모드**: 타임라인 뷰에서도 BacklogPanel 표시?
4. **반응형**: 좁은 화면(< 1024px)에서 BacklogPanel 처리 방식?
5. **카운트 경고색**: handoff의 0~5/6~15/16+ 단계별 색상 유지?
6. **정렬 기준**: `createdAt` 없으므로 대안 — `sortOrder`? `updatedAt`?

---

## 6. 권장 구현 전략

**옵션 A 채택** + 2-Phase 분할:

### Phase 9b-1: BacklogPanel 표시 + 인라인 관리
- `BacklogPanel.jsx` 신규 (280px 우측 패널)
- `UnifiedProjectView.jsx`에 flex 레이아웃 추가
- 백로그 task 목록 (체크박스, 텍스트, assignee, dueDate)
- 카운트 + 경고색 헤더
- task 클릭 → openDetail
- 인라인 추가 (InlineAdd 재사용)
- DnD 없음

### Phase 9b-2: DnD 통합 (후속)
- BacklogPanel task → MS 트리 drop
- MsTaskTreeMode의 네이티브 DnD를 dnd-kit으로 마이그레이션 검토
- 또는 BacklogPanel에서 네이티브 DnD 사용

---

## 7. 영향 파일 목록

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `src/components/project/BacklogPanel.jsx` | **신규** | 백로그 사이드패널 |
| `src/components/project/UnifiedProjectView.jsx` | 추가 | flex 레이아웃 + BacklogPanel 마운트 |
| `src/components/project/MsTaskTreeMode.jsx` | 미변경 | DnD 통합은 Phase 2 |
| `src/components/project/CompactMilestoneTab.jsx` | 미변경 | 이미 하단 백로그 있음 |
| DB 마이그레이션 | TBD | `createdAt` 추가 여부 사용자 결정 |
