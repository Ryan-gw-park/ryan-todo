# 주간 스케줄 뷰 — Recon 요구사항

> 이 문서는 Claude Web(Opus)에서 기획 완료된 주간 스케줄 뷰의 구현 요구사항입니다.
> 첨부된 `weekly-schedule-mockup.html`을 브라우저에서 열어 동작을 확인한 뒤 구현하세요.

---

## 0. 배경

팀 위클리 미팅에서 화이트보드를 사용하여 워크스트림별 담당자/데드라인을 협의하고 있음.
앱에 이미 유사한 뷰(팀원 뷰, 팀 매트릭스)가 있지만, 다음 이유로 미팅 중 대체가 안 됨:

1. **입력 속도**: 태스크 하나 배치하는 데 클릭이 너무 많음
2. **요일 기반 스케줄링 부재**: 타임라인의 start_date/end_date와 다른 "이번주 데드라인" 개념이 없음
3. **MS/Task 혼재 불가**: 어떤 건 MS 레벨로, 어떤 건 Task 레벨로 데드라인을 잡는데 기존 뷰는 이를 지원 안 함
4. **백로그 → 스케줄 배치 워크플로우 부재**: 미팅은 "할일 풀에서 이번주 요일에 배치"하는 흐름인데 이걸 지원하는 UI가 없음

> **과거 위클리뷰 폐기 이력**: 이전에 주간 플래너 뷰를 구현했으나 사용성 문제(타임라인 날짜 매핑 어려움, MS/Task 혼재 불가)로 Ryan이 직접 사이드바에서 제거함.
> 이번 구현은 타임라인 날짜와 완전 독립된 `scheduled_date` 필드를 사용하여 근본 원인을 해결함.

---

## 1. 데이터 모델

### 1-1. DB 스키마 변경

**`tasks` 테이블에 칼럼 추가:**
```sql
ALTER TABLE tasks ADD COLUMN scheduled_date date DEFAULT NULL;
```

**`key_milestones` 테이블에 칼럼 추가:**
```sql
ALTER TABLE key_milestones ADD COLUMN scheduled_date date DEFAULT NULL;
```

### 1-2. 필드 정의

| 필드 | 타입 | 설명 |
|------|------|------|
| `scheduled_date` | date, nullable | 주간 스케줄에서 배치된 날짜. 타임라인 `start_date`/`end_date`와 완전 독립. |

- `scheduled_date`가 null인 항목 = 주간 스케줄 미배정 (백로그 풀에 표시)
- `scheduled_date`가 이번주 월~금 범위인 항목 = 해당 요일 셀에 표시
- 기존 `start_date`/`end_date`는 절대 변경하지 않음 — 타임라인 뷰 전용

### 1-3. Zustand Store 변경

**`useStore.js`에 추가:**
```js
// updateTask(id, patch) 시그니처 변경 없음 — patch에 scheduled_date 포함 가능
// 예: updateTask(taskId, { scheduled_date: '2026-04-22' })
// 예: updateTask(taskId, { scheduled_date: null })  // 미배정으로 되돌리기
```

**key_milestones용 업데이트 함수:**
- 기존 reference/key milestone은 custom hook으로 Supabase 직접 호출
- `scheduled_date` 업데이트도 동일 패턴 사용 (store action 아님)

---

## 2. 뷰 구조

### 2-1. 사이드바 위치

```
팀
 ├ 할일       (기존 팀 매트릭스)
 ├ 타임라인   (기존)
 ├ 팀원       (기존)
 └ 주간 스케줄 ← 신규
```

- view key: `team-weekly-schedule`
- URL path: `/team/weekly-schedule`
- 사이드바 "팀" 섹션 마지막에 추가

### 2-2. 레이아웃

```
┌────────────────────────────────────────────────────┐
│ [백로그 패널 230px]  │  [주간 그리드 flex:1]       │
│                      │                              │
│ ┌──────────────────┐ │ ┌──────────────────────────┐ │
│ │ 백로그     35건  │ │ │ 주간 스케줄              │ │
│ │[프로젝트별|담당자별]│ │ │ 4/20~24 (17주차) [◀ 이번주 ▶]│
│ │[검색...]         │ │ ├────┬────┬────┬────┬────┤ │
│ │                  │ │ │팀원│ 월 │ 화 │ 수 │ 목 │금│ │
│ │ ● 26Q1 이사회 13│ │ │────┼────┼────┼────┼────┤ │
│ │   ◆ P&L    3건  │ │ │ Ed │    │    │    │    │  │ │
│ │   □ Pipeline    │ │ │ Ash│    │    │    │    │  │ │
│ │   □ Eng MS      │ │ │Eric│    │    │    │    │  │ │
│ │   □ Headcounts  │ │ │Ryan│    │    │    │    │  │ │
│ │   ...           │ │ │Ethn│    │    │    │    │  │ │
│ │                  │ │ ├────┴────┴────┴────┴────┤ │
│ │ ● 26년 NDR    5 │ │ │ [범례: MS / 할일 / 드래그]│ │
│ │   □ NDR Data    │ │ └──────────────────────────┘ │
│ │   ...           │ │                              │
│ └──────────────────┘ │                              │
└────────────────────────────────────────────────────┘
```

---

## 3. 백로그 패널 요구사항

### 3-1. 기본 구조
- 너비: 230px, flex-shrink: 0
- 배경: designTokens `COLOR.bgSecondary`
- 구성: 헤더 → 그룹 토글 → 검색바 → 스크롤 영역

### 3-2. 그룹 토글 (프로젝트별 / 담당자별)

**프로젝트별 (기본):**
- 프로젝트 → MS/Task 트리 구조
- 프로젝트 헤더: 프로젝트 dot 컬러 + 이름 + 건수
- MS 아이템: 보라색 체크박스 + 보라색 텍스트 + 하위 건수
- Task 아이템: 일반 체크박스 + 텍스트

**담당자별:**
- 멤버 → 프로젝트 → MS/Task 트리 구조
- 멤버 헤더: 아바타 + 이름 + 건수
- 하위는 프로젝트별 서브그룹 → 동일한 MS/Task 아이템

### 3-3. 백로그 풀 데이터 소스
- `scheduled_date`가 null인 모든 팀 프로젝트의 미완료 tasks + key_milestones
- 완료된 항목(`done === true`)은 제외
- 프로젝트 필터: 팀 프로젝트만 (개인 프로젝트 제외)

### 3-4. 검색
- 입력 시 실시간 필터링
- task 제목, MS 제목에 대해 부분 일치

### 3-5. 배치 완료 표시
- 그리드 셀에 드롭된 항목은 백로그에서 opacity: 0.3 + 취소선
- 프로젝트별/담당자별 양쪽 모두 동기화

---

## 4. 주간 그리드 요구사항

### 4-1. 그리드 구조
- 행: 팀 멤버 (useTeam hook에서 가져옴)
- 열: 월~금 (이번주 5일)
- 열 헤더: "월 4/20" 형식, 오늘 하이라이트 (amber 배경)
- 멤버 셀: 아바타 + 이름, sticky left

### 4-2. 셀 내용
- `scheduled_date`가 해당 날짜 + `assigneeId`가 해당 멤버인 항목 표시
- **프로젝트별 그룹**: 셀 내에서 같은 프로젝트 항목끼리 묶어서 프로젝트명 표시
- **MS**: 보라색 배지로 표시 (`cell-ms-badge` 클래스)
- **Task**: 체크박스 + 텍스트 (`cell-task` 클래스)
- 셀 hover 시 우측 하단에 "+" 표시

### 4-3. 주간 네비게이션
- ◀ 이전주 / 이번주 / 다음주 ▶
- "이번주" 버튼 클릭 시 현재 주로 복귀
- 주차 표시: "4월 20일 ~ 24일 (17주차)"

### 4-4. 오늘 하이라이트
- 오늘 날짜에 해당하는 열 헤더: amber 배경
- 해당 열의 셀: 약한 amber 배경 (rgba)

---

## 5. DnD 요구사항

### 5-1. 드래그 소스: 백로그 아이템
- dnd-kit 사용 (앱 전체에서 동일 라이브러리 사용)
- Task 드래그: 개별 task의 `scheduled_date` + `assigneeId` 설정
- MS 드래그: MS 자체의 `scheduled_date` 설정 + 하위 모든 task의 `scheduled_date` 일괄 설정
  - MS 드래그 시 assigneeId는 드롭된 셀의 멤버로 설정? → **아니요, MS의 assignee는 변경하지 않음.** MS 드래그는 `scheduled_date`만 설정. 하위 task들의 기존 assignee 유지.
  - 단, 하위 task에 assignee가 없는 경우 드롭된 셀의 멤버를 기본값으로 설정

### 5-2. 드롭 타겟: 그리드 셀
- 각 셀은 `(memberId, date)` 쌍을 가짐
- 드롭 시:
  - **Task**: `updateTask(taskId, { scheduled_date: date, assigneeId: memberId })`
  - **MS**: milestone의 `scheduled_date = date` 업데이트 (custom hook), 하위 task는 `scheduled_date = date` 일괄 업데이트 (assigneeId는 기존 유지, 없으면 memberId)

### 5-3. 드래그 시각 피드백
- DragOverlay: 아이템 제목 텍스트 (2deg 회전 + 그림자) — 기존 MsTaskTreeMode DnD와 동일 패턴
- 드롭 타겟 셀: 파란 dashed outline + 약한 파란 배경
- 담당자별 모드에서 드래그 시: 해당 멤버 행 전체에 약한 파란 배경 하이라이트

### 5-4. 그리드 내 이동
- 이미 배치된 항목을 다른 셀로 드래그 → 요일/담당자 변경
- 배치된 항목을 백로그로 되돌리기 → `scheduled_date = null` 설정
  - 구현 방법: 셀 내 아이템에 우클릭 메뉴 or "×" 버튼 → "미배정으로" 액션

### 5-5. 셀 내 직접 생성 (+ 버튼)
- 셀의 "+" 클릭 → 인라인 텍스트 입력
- Enter 시 새 task 생성: `{ text: 입력값, assigneeId: 셀의 memberId, scheduled_date: 셀의 date, projectId: ?, category: 'today' }`
- 프로젝트 선택: 가장 최근 사용한 프로젝트 or 간단한 드롭다운

---

## 6. 컴포넌트 구조

```
src/components/views/
  WeeklyScheduleView.jsx          ← 메인 orchestrator (신규)
  weekly-schedule/
    BacklogPanel.jsx               ← 좌측 백로그 패널 (신규)
    ScheduleGrid.jsx               ← 우측 그리드 (신규)
    ScheduleCell.jsx               ← 개별 셀 (드롭 타겟) (신규)
    BacklogItem.jsx                ← 백로그 드래그 아이템 (신규)
```

### 6-1. 재사용 가능 컴포넌트
- `MiniAvatar` (from `grid/shared/MiniAvatar.jsx`) — 멤버 아바타
- `getColorByIndex` — 멤버 컬러
- `useTeam` hook — 팀 멤버 목록
- `useStore` — tasks CRUD
- key_milestones는 기존 custom hook 패턴 (Supabase 직접 호출)

### 6-2. 신규 Hook
```
src/hooks/
  useWeeklySchedule.js             ← 주간 네비게이션 + 데이터 fetch (신규)
```

- `currentWeekStart` (Monday date)
- `goToPrevWeek()`, `goToNextWeek()`, `goToThisWeek()`
- `weekDays` = [Mon, Tue, Wed, Thu, Fri] dates 배열
- `scheduledTasks` = tasks filtered by `scheduled_date` in week range
- `scheduledMilestones` = milestones filtered by `scheduled_date` in week range
- `backlogTasks` = tasks where `scheduled_date === null && done !== true`
- `backlogMilestones` = milestones where `scheduled_date === null`

---

## 7. 스타일 규칙

- 모든 색상값은 `designTokens.js`의 `COLOR`, `FONT`, `SPACE` 사용
- 그리드 border: 0.5px solid, `COLOR.border` 사용
- 마일스톤 배지: `background: #EEEDFE, color: #534AB7` (기존 앱 MS 배지와 동일)
- 프로젝트 dot 컬러: 기존 프로젝트 컬러 시스템 재사용
- border-left 컬러바 금지 (기존 디자인 원칙)
- 최소 회색 텍스트: `#888780` (기존 원칙)
- ellipsis 금지 — white-space normal + word-break (기존 원칙)
- **목업 HTML 파일의 CSS를 참조하되, 실제 구현에서는 designTokens 값으로 대체할 것**

---

## 8. 라우팅 & 사이드바

### 8-1. App.jsx
```js
// views 객체에 추가
'team-weekly-schedule': WeeklyScheduleView,

// VIEW_ORDER에 추가 (팀 섹션)
// useViewUrlSync VIEW_TO_PATH에 추가
'team-weekly-schedule': '/team/weekly-schedule',
```

### 8-2. Sidebar.jsx
- 팀 섹션의 TASK_VIEWS 또는 별도 NavItem으로 추가
- 아이콘: 📅 또는 적절한 아이콘
- 라벨: "주간 스케줄"

---

## 9. 제약사항 & 원칙

| # | 규칙 |
|---|------|
| 1 | `updateTask(id, patch)` 시그니처 절대 변경 금지 |
| 2 | `tasks`/`memos` 테이블의 기존 칼럼(text/done/category/alarm) 절대 수정/삭제 금지 |
| 3 | 기존 뷰 컴포넌트(MatrixView, TimelineView, MembersView 등) 내부 수정 금지 — wrap, don't touch |
| 4 | Reference/Key Milestone 데이터는 store 밖에서 custom hook으로 직접 Supabase 호출 |
| 5 | Task CRUD는 반드시 store action 사용 (글로벌 뷰 동기화) |
| 6 | TDZ rule: `const/let/var`로 module-level에서 designTokens 참조 금지. 함수 내부 또는 inline으로만 참조 |
| 7 | `category`는 cross-cell/cross-project 이동 시 `'today'`로 리셋 |
| 8 | border-left 컬러바 금지 |
| 9 | gray 텍스트 최소값 `#888780` |
| 10 | R-ATOMIC: 1 issue per commit |

---

## 10. Recon 작업 순서

Claude Code는 아래 순서로 recon을 진행:

### Phase 1: 코드 탐색
1. 현재 사이드바 구조 확인 (`Sidebar.jsx` — 팀 섹션 NavItem 목록)
2. 현재 라우팅 구조 확인 (`App.jsx` — views 객체, VIEW_ORDER)
3. `useStore.js` — `updateTask` 함수, `addTask` 함수 시그니처 확인
4. key_milestones custom hook 패턴 확인 (어떤 hook이 Supabase 직접 호출하는지)
5. `useTeam.js` — 팀 멤버 데이터 구조 확인
6. `designTokens.js` — COLOR, FONT, SPACE 값 확인
7. 기존 DnD 구현 패턴 확인 (`MsTaskTreeMode.jsx` — dnd-kit 사용 방식)
8. `MiniAvatar.jsx`, `getColorByIndex` 위치/인터페이스 확인
9. 팀원 뷰 (`MembersView.jsx` 또는 관련 파일) — 멤버별 카드 구조 참조

### Phase 2: DB 마이그레이션
10. Supabase에 `scheduled_date` 칼럼 추가 SQL 작성 + 적용

### Phase 3: 구현
11. `useWeeklySchedule.js` hook 구현
12. `WeeklyScheduleView.jsx` 메인 컴포넌트
13. `BacklogPanel.jsx` 백로그 패널 (프로젝트별/담당자별 토글 포함)
14. `ScheduleGrid.jsx` + `ScheduleCell.jsx` 그리드
15. DnD 연결 (dnd-kit)
16. 사이드바 + 라우팅 등록

### Phase 4: 검증
17. `npm run build` 성공 확인
18. 기능 테스트 (DnD, 토글, 주간 네비게이션, 셀 내 생성)
19. 기존 뷰(팀 매트릭스, 타임라인, 팀원) 영향 없음 확인

---

## 11. 목업 파일

첨부 파일: `weekly-schedule-mockup.html`

- 브라우저에서 직접 열어서 동작 확인 가능
- 백로그 → 그리드 드래그 & 드롭 동작
- 프로젝트별 / 담당자별 토글 동작
- 검색 필터 동작
- **이 목업의 레이아웃, 색상, 간격, 폰트 크기를 최대한 동일하게 구현할 것**
- 단, CSS 하드코딩 색상은 designTokens 값으로 대체

---

## REQ-LOCK 요구사항 테이블

| # | 요구사항 | 비고 |
|---|---------|------|
| R1 | `tasks.scheduled_date` 칼럼 추가 (date, nullable) | DB migration |
| R2 | `key_milestones.scheduled_date` 칼럼 추가 (date, nullable) | DB migration |
| R3 | 기존 `start_date`/`end_date` 절대 변경 없음 | 타임라인 뷰와 독립 |
| R4 | 백로그 패널: 프로젝트별 그룹 (기본) | 목업 참조 |
| R5 | 백로그 패널: 담당자별 그룹 (토글) | 목업 참조 |
| R6 | 백로그 패널: 검색 필터 | 실시간 부분 일치 |
| R7 | 그리드: 행=멤버, 열=월~금 | 목업 참조 |
| R8 | 그리드: 오늘 열 하이라이트 | amber 배경 |
| R9 | 그리드: 셀 내 프로젝트별 그룹 + MS/Task 혼재 | 목업 참조 |
| R10 | DnD: 백로그 Task → 셀 드롭 시 scheduled_date + assigneeId 설정 | dnd-kit 사용 |
| R11 | DnD: 백로그 MS → 셀 드롭 시 MS + 하위 tasks scheduled_date 일괄 설정 | MS assignee 불변 |
| R12 | DnD: 셀 → 셀 이동 (요일/담당자 변경) | |
| R13 | DnD: 배치된 항목 → 미배정 되돌리기 | scheduled_date = null |
| R14 | 셀 내 "+" 직접 태스크 생성 | 인라인 입력 |
| R15 | 주간 네비게이션 (이전주/이번주/다음주) | |
| R16 | 사이드바 팀 섹션에 "주간 스케줄" 추가 | view key: team-weekly-schedule |
| R17 | 배치 완료 항목 백로그에서 취소선 표시 | 프로젝트별/담당자별 동기화 |
| R18 | 담당자별 드래그 시 해당 멤버 행 하이라이트 | 시각적 가이드 |
