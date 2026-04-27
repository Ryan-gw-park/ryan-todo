# Phase 8-B Recon — Weekly 인라인 기간 편집

> 작성일: 2026-04-09
> 기준: `loop-7-handoff-to-claude-code.md` §Sub-Loop 8-B
> 상태: 조사 완료

---

## 1. 요구사항 요약

주간 플래너에서 task의 startDate/dueDate를 셀 내에서 직접 수정 가능하도록 한다. 클릭 시 date range picker 팝오버 표시.

---

## 2. 현재 상태 분석

### 2-1. 기존 날짜 편집 방법

- **DetailPanel**: `<input type="date">` 2개 (시작일, 마감일)
- **커스텀 date picker 없음**: 전체 앱이 native `<input type="date">` 사용
- **라이브러리 없음**: react-datepicker 등 미설치

### 2-2. 주간 플래너에서 현재 날짜 표시

- TaskRow: `task.dueDate.slice(5)` (MM-DD 형식, showProject=false일 때만)
- 8-A 이후: span bar로 기간 시각화 (start/middle/end segment)

### 2-3. 트리거 방식 선택지

- **더블클릭**: 기존 single click이 인라인 텍스트 편집에 사용됨
- **hover 시 작은 캘린더 아이콘**: 깔끔, 기존 UI와 충돌 없음 (권장)
- **우클릭**: 모바일 미지원

### 2-4. 재사용 가능 패턴

| 항목 | 소스 |
|------|------|
| `<input type="date">` 스타일 | DetailPanel line 196-218 |
| Click-outside 닫기 | MilestoneSelector, ColorPicker, MilestoneOwnerSelector |
| Popover 포지셔닝 | `position: relative` + `absolute, top: 100%, zIndex: 100` |
| `updateTask(id, { startDate, dueDate })` | useStore — 이미 존재 |

---

## 3. 구현 옵션

### 옵션 A: TaskRow에 인라인 date popover (권장)

TaskRow hover 시 작은 📅 아이콘 → 클릭 → popover에 `<input type="date">` 2개 (시작일/마감일)

**구현**:
1. TaskRow에 hover 시 📅 아이콘 추가 (detail arrow 옆)
2. 클릭 → `DatePopover` 컴포넌트 표시
3. DatePopover: `position: absolute`, native date input 2개
4. onChange → `updateTask(task.id, { startDate, dueDate })`

**장점**: 간단, native date input 재사용, 기존 코드 최소 변경
**단점**: native date picker UI가 브라우저마다 다름

### 옵션 B: PersonalWeeklyGrid/TeamWeeklyGrid 레벨에서 popover

Grid 컴포넌트에 popover state를 두고, 아무 task의 날짜 아이콘 클릭 시 해당 task의 popover 표시.

**장점**: state 관리 집중
**단점**: Grid 컴포넌트 비대화

### 옵션 C: 날짜 DnD (bar 리사이즈)

8-A의 span bar 좌/우 끝을 drag하여 startDate/dueDate 변경.

**장점**: 직관적 UX
**단점**: 매우 복잡 (resize 핸들, 셀 경계 계산), 8-A의 CellContent 구조와 충돌

---

## 4. 위험 요소

| # | 위험 | 대응 |
|---|------|------|
| W1 | TaskRow click 이벤트 충돌 (텍스트 편집 vs 날짜 편집) | 별도 아이콘으로 트리거 분리 |
| W2 | popover가 셀 밖으로 넘침 | zIndex + overflow visible 확인 |
| W3 | 날짜 변경 시 span bar 즉시 재계산 | Zustand store 업데이트 → useMemo 재계산 (자동) |
| W4 | SpanBar(middle/end)에서는 날짜 편집 불가 | start/single TaskRow에서만 아이콘 표시 |

---

## 5. 영향 파일

| 파일 | 변경 | 내용 |
|------|------|------|
| `src/components/views/grid/cells/DatePopover.jsx` | **신규** | 인라인 날짜 편집 팝오버 |
| `src/components/views/grid/cells/TaskRow.jsx` | 수정 | 📅 아이콘 + DatePopover 통합 |
