# Recon Spec — 개인 할일 매트릭스 뷰 (프로젝트 × 아젠다)

| 항목 | 값 |
|---|---|
| 작성 단계 | Recon (조사) |
| 수신 | Claude Code |
| 출력 형식 | Recon Report (마크다운 1개 파일) |
| 절대 금지 | 코드 수정 · diff 작성 · DB 마이그레이션 실행 |
| 다음 단계 | 본 Report 기반으로 Opus가 Spec 문서(REQ-LOCK 포맷) 작성 |

---

## 0. 배경 & 목적

현재 "개인 할일" 뷰는 프로젝트(키 마일스톤) 기준 1차원 그룹핑이지만, 실제 사용자의 워크플로우는 4개 아젠다 컨텍스트(Jason 위클리 / Planning 위클리 / 의사결정 필요 / 내 개인 할일)를 **동시에 펼쳐놓고 일별 우선순위를 잡는 것**이 핵심 행위. 같은 할일이 여러 아젠다에 다중 태그되는 N:M 관계를 정직하게 표현해야 함.

해결책: **프로젝트 × 아젠다 피벗 매트릭스** 뷰로 "개인 할일" 뷰 전면 재설계. 팀 매트릭스(프로젝트 × 멤버)와 동일한 축 구조이므로 컴포넌트 패턴 재사용 가능성 높음.

---

## 1. 최종 UI 명세 (확정)

### 1.1 레이아웃

```
┌─────────────────────────────────────────────────────────────┐
│ 헤더: "개인 할일" + 날짜 + [완료 숨김] [새 할일]              │
├──────────┬──────────┬───────────┬───────────┬───────────────┤
│ 프로젝트  │ Jason    │ Planning  │ 의사결정   │ 내 개인 할일  │
│          │ 위클리   │ 위클리    │ 필요      │              │
├──────────┼──────────┼───────────┼───────────┼───────────────┤
│ 📥 신규  │ task     │ task      │ task      │ task          │
│ 할일     │ [+추가]  │ [+추가]   │ [+추가]   │ [+추가]       │
├──────────┼──────────┼───────────┼───────────┼───────────────┤
│ ABI Korea│ task     │ task,task │ task      │ task          │
├──────────┼──────────┼───────────┼───────────┼───────────────┤
│ 26Q1 …  │ task     │ task      │ task      │ (빗금)        │
├──────────┴──────────┴───────────┴───────────┴───────────────┤
│ (계속)                                                       │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 행 / 열 / 셀 정의

- **행 (rows)**: `신규 할일` (고정 최상단) + 프로젝트(키 마일스톤) 목록
- **열 (columns)**: 4개 고정 아젠다
  - `weekly_jason` — Jason 위클리
  - `weekly_planning` — Planning 위클리
  - `decision_needed` — 의사결정 필요 (이전 "to Jason")
  - `personal` — 내 개인 할일
- **셀 (cells)**: 해당 (프로젝트, 아젠다) 교차점의 task 목록
  - 같은 task가 여러 아젠다에 태그되면 여러 셀에 동시 노출
  - 셀 내 task는 sort_index 순 정렬

### 1.3 마일스톤(MS) 처리 — 확정: B안

매트릭스 셀에서는 **MS 계층 평탄화** (MS sub-row 없음). MS 정보는 task detail panel에서만 노출.

### 1.4 신규 할일 (Inbox) Row

- 매트릭스 최상단 고정 행
- `keyMilestoneId === null && done === false` 인 task들이 여기로 들어옴 (= 백로그와 동일 식별)
- 각 셀(아젠다별) 하단에 "+ 빠른 추가" 인라인 인풋
- 신규 task를 빠르게 캡처 → 나중에 프로젝트 행으로 드래그하면 `keyMilestoneId` 할당
- 다른 프로젝트 행과 시각적으로 구분 (베이지 배경 `#FAF8F2`, inbox 아이콘)

### 1.5 빈 셀 (빗금)

- (프로젝트, 아젠다) 교차점에 task 0개 → 빗금 배경
- 클릭 시 그 교차점으로 새 task 즉시 추가 (`keyMilestoneId` + `agendas: [열]` 자동 세팅)

### 1.6 크로스셀 동시 강조 — 확정

특정 task에 hover 시, 동일한 task ID가 들어있는 모든 셀의 task 카드가 동시 강조됨.

- 강조 스타일: `background: #FAEEDA` (amber 50) + `box-shadow: 0 0 0 1px #EF9F27` (amber 400 outline)
- 텍스트 색: `#633806` (amber 800)
- Zustand store에 `ui.hoveredTaskId: string | null` 추가

### 1.7 드래그 인터랙션 (dnd-kit)

| from | to | 결과 |
|---|---|---|
| 셀 내 task | 같은 행 다른 셀 | task의 `agendas` 배열에 도착 열의 아젠다 추가 |
| 셀 내 task | 다른 행의 셀 | `keyMilestoneId` 변경 + 도착 셀의 아젠다 추가 |
| 신규 할일 row의 task | 프로젝트 행의 셀 | `keyMilestoneId` 할당 |
| 셀 내 같은 셀 안 재정렬 | 동일 셀 | `sort_index` 갱신 |

### 1.8 4-zone 이벤트 (셀 내 task 카드)

기존 규칙 그대로 적용:
- 타이틀 영역: 인라인 편집
- 비-타이틀 영역: 드래그 시작
- 체크박스: done 토글
- 화살표(또는 우측 영역): detail panel 열기

---

## 2. 코드베이스 조사 영역

각 영역에서 (a) 현재 상태 (b) 신규 매트릭스에 필요한 변경 (c) 재사용 가능 여부 답변.

### 2.1 기존 매트릭스 컴포넌트

조사 대상:
- `src/components/` 내 매트릭스 관련 모든 컴포넌트 위치
- 특히 `PivotTaskCell`, `MatrixView`, 그 외 매트릭스 렌더링 로직
- 메모에 언급된 `matrix-unified-v3.jsx` 목업 파일이 실제로 무엇을 참조한 것인지 추적
- 팀 매트릭스가 현재 어떤 prop으로 행/열 차원을 받는지 (하드코딩? prop 기반?)

산출:
- 컴포넌트 트리 (사이드바 → 팀 매트릭스 뷰까지)
- 각 컴포넌트의 책임 범위 한 줄 설명
- **재사용 가능 컴포넌트 목록** + 재사용 방식 (그대로 / prop 추가 / fork 후 수정)

### 2.2 데이터 모델 / DB

조사 대상:
- `tasks` 테이블 현재 컬럼 전체 (특히 `keyMilestoneId`, `scope`, `category`, `sort_index`/`sort_order`, `done`)
- `tasks.scope` 값 종류 (memory: `private | team | assigned`)
- Supabase 마이그레이션 디렉터리 위치 + 명명 규칙
- RLS 정책 (개인 scope 필터 패턴)

산출:
- `tasks` 테이블 컬럼 표 (이름 / 타입 / nullable / 기본값 / 의미)
- 마이그레이션 파일 작성 위치 + 기존 파일 명명 예시 1~2건

### 2.3 라우팅 / 사이드바

조사 대상:
- 사이드바 "할일" 메뉴(개인 섹션) → 어떤 컴포넌트가 마운트되는지
- 라우트 정의 파일 위치 (React Router? 직접 state?)
- 현재 "개인 할일" 뷰 컴포넌트의 파일 경로 + 진입점

산출:
- 사이드바 클릭 → 개인 할일 뷰 마운트까지의 경로 코드 흐름 (3~5줄)
- 뷰 교체 시 변경해야 할 파일 위치

### 2.4 Zustand store

조사 대상:
- store 파일 위치 (`src/store/` 등)
- `tasks`, `projects`, `keyMilestones` slice 구조
- `updateTask(id, patch)` 액션 정의 + 호출처
- 기존 hover/selected 같은 UI 상태 관리 패턴 (있는지)

산출:
- store slice 목록 + 책임
- `updateTask` 시그니처 (변경 금지 사항)
- `ui.hoveredTaskId` 추가 위치 제안

### 2.5 dnd-kit 사용 현황

조사 대상:
- 현재 dnd-kit이 어디서 어떻게 쓰이는지 (DndContext, sortable, droppable 위치)
- `handleDragEnd` 패턴 (특히 메모에 언급된 `over.data.current.type` 사용처)
- 메모: "cross-project task moves must explicitly include `keyMilestoneId` in patch to prevent `applyTransitionRules` R5 nullification" 의 실제 코드 위치
- 셀↔셀, 행↔행 드래그를 위한 droppable id 명명 규칙 기존 사용 예시

산출:
- dnd-kit 적용된 컴포넌트 목록
- 기존 droppable id 명명 패턴 (`cell:${projectId}:${agenda}` 같은 형식 정착 가능 여부)
- `applyTransitionRules` 함수 위치 + R5 규칙 코드

### 2.6 백로그 / 카테고리 처리

조사 대상:
- `category` 컬럼의 enum 값들 (`today` 외에 무엇이 있는지)
- 메모: "Category label: '지금 할일' (not '오늘 할일')" 의 UI 노출 위치
- `keyMilestoneId === null` 백로그가 현재 UI 어디에 표시되는지
- 백로그 task가 매트릭스 진입 시 "신규 할일" row로 자동 분류될 때 충돌 가능성

산출:
- `category` 값별 의미 표
- 백로그 task 현재 노출 위치 + 신규 할일 row 진입 시 영향

### 2.7 designTokens.js

조사 대상:
- `src/styles/designTokens.js` 현재 export 구조 (COLOR, FONT, SPACE, GANTT, CHECKBOX)
- 매트릭스 컴포넌트에서 토큰 참조 패턴 (메모: Vite TDZ 룰 — 모듈 레벨 const 금지)
- 토큰 추가 시 영향 받는 파일 범위

산출:
- 현재 export 구조 트리
- 신규 토큰 추가 위치 제안:
  - `AGENDA.jasonWeekly / planningWeekly / decisionNeeded / personal` (dot color + chip bg/text)
  - `HIGHLIGHT.crossCell` (amber 50/400/800 세트)
  - `MATRIX.inboxRowBg` (`#FAF8F2`)

---

## 3. 결정해야 할 질문 (Recon에서 답변 필요)

각 질문에 (a) 현재 상태 (b) A안/B안 비교 (c) 권장안 + 근거 형식으로 답변.

### Q1. 아젠다 데이터 모델

- A안: `tasks.agendas text[]` 단일 컬럼 (가벼움, 쿼리 단순)
- B안: 별도 `task_agendas(task_id, agenda_type, created_at)` 테이블 (향후 메타데이터 확장 여지)
- 권장 + 근거 (RLS / 인덱싱 / 기존 update 패스와의 호환성 관점)

### Q2. 신규 할일 Row 식별자

- 현재 `keyMilestoneId === null && done === false` 만으로 충분한가?
- 기존 백로그 표시 UI와 충돌 가능성 있는가?
- 별도 플래그(`is_inbox` boolean) 필요한가, 불필요한가?

### Q3. 기존 "개인 할일" 뷰 처분

- A안: 신규 매트릭스가 기존 뷰 완전 대체 (사이드바 "할일" 메뉴 → 매트릭스만)
- B안: 토글로 [매트릭스 | 리스트] 두 뷰 병존
- 기존 뷰 컴포넌트가 다른 곳에서도 사용되는지 (재사용 의존성) 확인 필수

### Q4. 팀 매트릭스 컴포넌트 재사용 가능 여부

- 현재 `MatrixView` 또는 동등 컴포넌트가 prop으로 행/열 차원을 받는 구조인가?
- 받으면: `columns="agendas"` 같은 prop만 추가하면 되는 수준인가?
- 안 받으면: 별도 `PersonalMatrixView` 신설 필요. 이 경우 공통 추출 가능한 하위 컴포넌트(셀, 행 헤더 등) 식별.

### Q5. 카테고리(`category === 'today'`)와 매트릭스의 관계

- 매트릭스에 보이는 task 범위:
  - A안: 모든 미완료 task (`done === false`)
  - B안: `category === 'today'`만
- 기존 뷰가 어떻게 필터하는지 확인 후 결정

### Q6. Personal scope 필터

- 메모: "Personal scope blocks assignee/owner changes"
- 매트릭스에서 보이는 task의 범위: `scope === 'private'` 만? assignee가 자기 자신인 것까지?
- 현재 "개인 할일" 뷰의 필터 로직을 그대로 따를 수 있는지 확인

### Q7. Detail Panel에서 MS 표시

- 매트릭스 셀의 task 카드 우측 화살표 클릭 → detail panel 열림
- 현재 detail panel에 MS(키 마일스톤) 정보 표시 코드가 이미 있는가?
- 없으면 별도 commit 필요

### Q8. 크로스셀 hover 성능

- 매트릭스 cell 수: 약 (프로젝트 8개 + inbox 1) × 4 아젠다 = 36 셀
- 각 셀 내 task 수 평균 2~3개 → 전체 ~100 task 렌더링
- `hoveredTaskId` 변경 시 100개 task 카드 re-render 영향
- React.memo / 셀별 selector 최적화 필요 여부 판단

### Q9. 셀 / 행 드래그 droppable 설계

- droppable id 명명 규칙:
  - 셀: `cell:${projectId|'inbox'}:${agendaType}`
  - 행: `row:${projectId|'inbox'}`
- `over.data.current.type` 에 무엇을 담을지 (`'cell'` / `'row'` / `'task'`)
- 기존 패턴과 충돌 여부

### Q10. 빠른 추가 input UX

- 셀 하단 dashed placeholder click → 인라인 input 활성화 → Enter로 task 생성
- 현재 코드베이스에 유사한 인라인 입력 패턴이 있는지 (재사용 가능 컴포넌트 후보)

---

## 4. 제약사항 체크리스트

신규 매트릭스 뷰가 다음 메모 기반 제약을 위반하지 않는지 Recon Report에 체크.

- [ ] `updateTask(id, patch)` 시그니처 불변
- [ ] `tasks` 테이블 기존 컬럼 (text/done/category/alarm) rename/modify 금지 → 신규 컬럼만 추가
- [ ] 기존 뷰 컴포넌트(TodayView, MatrixView, TimelineView, MemoryView) 내부 수정 금지 → 매트릭스 신설은 wrap 또는 신규 컴포넌트
- [ ] `OutlinerEditor`, `OutlinerRow`, `useOutliner`, `notes.js` 미수정
- [ ] Left color border 금지 (`border-left` X)
- [ ] Title ellipsis (`text-overflow: ellipsis`) 금지 → `white-space: normal` + `word-break: keep-all`
- [ ] Vite TDZ: 모듈 레벨 const로 designTokens 참조 금지 → 함수 내부 또는 인라인
- [ ] Personal scope: assignee/owner 변경 차단 유지
- [ ] 카테고리 라벨 "지금 할일" 유지
- [ ] 색상 #c4c2ba, #d3d1c7 금지 (secondary text는 최소 #888780)
- [ ] D-day badge 미사용
- [ ] 4-zone 이벤트 분리 규칙 (title=인라인편집, non-title=drag, checkbox=토글, arrow=detail panel)
- [ ] Highlight 카드 체크박스 흰 배경
- [ ] 사이드바 3-section 구조 (글로벌 / 할일 / 프로젝트) 유지
- [ ] 코드 식별자 영문 / 사용자 노출 텍스트 한국어

---

## 5. R-ATOMIC 커밋 분할 (사전 제안)

Recon Report에서 이 분할안의 타당성 검토 + 조정 의견.

| # | 커밋 | 핵심 변경 | 종속성 |
|---|---|---|---|
| C1 | `feat: add agendas column to tasks table` | DB 마이그레이션 + RLS 업데이트 | (없음) |
| C2 | `feat: add AGENDA and HIGHLIGHT.crossCell design tokens` | designTokens.js 확장 | (없음) |
| C3 | `feat: add ui.hoveredTaskId state and updateTaskAgendas action` | Zustand store 확장 | C1 |
| C4 | `feat: add PersonalMatrixView read-only rendering` | 컴포넌트 신설 (셀 렌더링, 행/열 헤더, 빗금 셀) | C1, C2, C3 |
| C5 | `feat: add inbox row to PersonalMatrixView` | 신규 할일 row 컴포넌트 (셀당 빠른 추가 input) | C4 |
| C6 | `feat: enable cell click to create task at intersection` | 빈 셀 클릭 → 신규 task (`keyMilestoneId` + `agendas` 자동) | C4 |
| C7 | `feat: enable cross-cell highlight on hover` | hoveredTaskId 연동 + 강조 스타일 | C3, C4 |
| C8 | `feat: enable cell-to-cell drag to retag agenda` | dnd-kit droppable + handleDragEnd 분기 | C4 |
| C9 | `feat: enable row-to-row drag to reassign project` | 행 간 드래그 (특히 inbox → project) | C8 |
| C10 | `feat: route personal sidebar to PersonalMatrixView` | 사이드바 연결, 기존 뷰 처분 (Q3 결정 의존) | C4~C9 |

각 커밋은 빌드 통과 + 회귀 없는 상태로 분리. R-ATOMIC 원칙 — 하나의 관심사만.

---

## 6. Recon Report 산출물 형식

`recon-report-personal-agenda-matrix.md` 파일로 작성. 다음 섹션 포함:

1. **요약** (5~10줄): 핵심 발견 사항 + 권장 진행 방향
2. **2.1 ~ 2.7 조사 결과**: 각 영역별 (a)(b)(c) 답변
3. **Q1 ~ Q10 답변**: 각 질문별 권장안 + 근거
4. **제약사항 체크리스트 결과**: 모든 제약이 신규 매트릭스에서 지켜질 수 있는지
5. **컴포넌트 트리 (현재 / 신규)**: 텍스트 트리
6. **재사용 가능 / 신설 필요 컴포넌트 목록**
7. **DB 마이그레이션 SQL 초안** (Q1 결정 이후)
8. **R-ATOMIC 커밋 분할 검토 의견**: 위 제안에 대한 조정 사항
9. **위험 요소 / 모호점**: Spec 단계 전에 추가 결정 필요한 항목
10. **Open Questions**: Opus가 추가로 답변해야 할 사항 (있다면)

---

## 7. 작업 규칙

- ❌ 코드 변경 / diff 작성 절대 금지
- ❌ DB 마이그레이션 실행 금지
- ❌ 추측 금지 — 모르면 "확인 필요"로 표시
- ✅ 실제 소스 파일 열람 후 답변
- ✅ 파일 경로 + 라인 번호로 근거 명시
- ✅ 영문 식별자 그대로 사용 (`PivotTaskCell`, `updateTask` 등)
- ✅ 한국어로 설명 / 답변

---

## 8. 입력 자료

- `userMemories` (현재 작업 컨텍스트)
- 이전 채팅에서 확정된 목업 4종 (탭 안 → 4-스택 안 → 매트릭스 안 → 매트릭스 v2 with 신규할일 row)
- 코드베이스 zip (별도 업로드 예정)
- `matrix-unified-v3.jsx` 목업 (확정된 팀 매트릭스 레이아웃)

