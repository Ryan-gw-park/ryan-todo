# Weekly Schedule 뷰 — Recon

- **Phase**: weekly-schedule
- **Spec 문서**: `docs/plans/weekly-schedule-recon-spec.md` (REQ-LOCK R1~R18)
- **목업**: `docs/plans/weekly-schedule-mockup.html`
- **Date**: 2026-04-21
- **원칙**: Don't Touch, Wrap It / R-ATOMIC / designTokens 우선

---

## 1. 코드베이스 영향 범위 분석

### 1-1. 유형별 변경

| 유형 | 영향 |
|------|------|
| DB 스키마 | `tasks.scheduled_date`, `key_milestones.scheduled_date` **신규** (nullable date). 기존 칼럼 불변 |
| Zustand 스토어 | `mapTask`에 매핑 1줄, `addMilestone` SELECT에 1줄 — **시그니처 불변** |
| 라우팅 | `App.jsx` views/VIEW_ORDER + `useViewUrlSync` 1줄 추가 |
| 사이드바 | `TEAM_ONLY_VIEWS`에 1 항목 추가 |
| 신규 뷰 | `WeeklyScheduleView` + 하위 6개 컴포넌트 (신규 폴더 `src/components/views/weekly-schedule/`) |
| 신규 hook | `useWeeklySchedule` |
| 신규 util | `src/utils/weekDate.js` (ISO 주차 계산 + 월요일 시작) |
| DnD | `@dnd-kit/core`, `@dnd-kit/sortable` **이미 설치됨** — 신규 설치 불요 |
| 기존 뷰 | **0 LOC 수정** (MatrixView/TimelineView/MembersView/UnifiedGridView 건드리지 않음) |

### 1-2. 스펙의 사실관계 정정

| # | 스펙 진술 | 실제 | 처리 |
|---|----------|------|------|
| 1 | "MS 배지: 기존 앱 MS 배지와 동일(#EEEDFE/#534AB7)" | 별도 Badge 컴포넌트 없음. 인라인 스타일로만 존재 | 이 뷰에서 인라인 구현 |
| 2 | "DragOverlay: 기존 MsTaskTreeMode와 동일 패턴" | MsTaskTreeMode는 `DndContext`를 **소유하지 않고** 부모 overlay를 사용. 실제 패턴은 **`UnifiedGridView.jsx:425-481`, `UnifiedProjectView.jsx:426-484`**의 `DragOverlay dropAnimation={null} + pointerWithin` 조합 | Unified* 패턴 계승 |
| 3 | "designTokens `COLOR.bgSecondary`" | 토큰에 존재하지 않음. 실 토큰: `bgSurface #fafaf8` / `bgHover #f5f4f0` / `bgActive #f0efeb` | 결정 6에서 해결 |
| 4 | "과거 주간 플래너 폐기 이력" | 현재 코드의 `TeamWeeklyGrid.jsx` / `PersonalWeeklyGrid.jsx`는 폐기 대상 **아님** — `UnifiedGridView`의 weekly 모드(`/team/weekly`, `/personal/weekly`)용 타임라인 기반 뷰. start_date/due_date 기반이라 `scheduled_date` 기반 신규 뷰와 **완전 독립** | 둘 다 유지, 신규는 `team-weekly-schedule`로 별도 |

### 1-3. view key 명명 주의

- 기존: `team-weekly` (`/team/weekly`) = UnifiedGridView weekly 모드 (타임라인 기반)
- 신규: `team-weekly-schedule` (`/team/weekly-schedule`) = 백로그+그리드+DnD (scheduled_date 기반)

`team-weekly` ≠ `team-weekly-schedule`. 이름 유사하나 데이터 모델/UX 완전 다름.

---

## 2. 영향 파일 / 모듈 목록

### 2-1. 수정 대상 (최소 표면)

| 파일 | 지점 | 변경 | 예상 LOC |
|------|------|------|---------|
| `supabase/migrations/20260420_weekly_scheduled_date.sql` | 신규 | `tasks` + `key_milestones`에 `scheduled_date date DEFAULT NULL` | +10 |
| `src/hooks/useStore.js` | `mapTask` (:171-190) | `scheduledDate: r.scheduled_date \|\| null` 추가 | +1 |
| `src/hooks/useStore.js` | `addMilestone` SELECT (:930-954) | `scheduled_date` 칼럼 명시 | +1 |
| `src/hooks/useMilestonesByProjects.js` | SELECT 칼럼 | `scheduled_date` 추가 | +1 |
| `src/hooks/useKeyMilestones.js` | SELECT 칼럼 | `scheduled_date` 추가 | +1 |
| `src/App.jsx` | views 객체 + VIEW_ORDER | `'team-weekly-schedule': WeeklyScheduleView` | +3 |
| `src/hooks/useViewUrlSync.js` | VIEW_TO_PATH | `'team-weekly-schedule': '/team/weekly-schedule'` | +1 |
| `src/components/layout/Sidebar.jsx` | `TEAM_ONLY_VIEWS` (:40-42) | `{ key: 'weekly-schedule', label: '주간 스케줄', icon: '📅' }` | +1 |

**수정 합계**: ~19 LOC

### 2-2. 신규 파일

| 파일 | 책임 | 예상 LOC |
|------|------|---------|
| `src/utils/weekDate.js` | `getMondayOf`, `getWeekDays`, `getISOWeekNumber`, `formatWeekRange` | ~50 |
| `src/hooks/useWeeklySchedule.js` | 주간 네비게이션 + `scheduledTasks`/`scheduledMilestones`/`backlogTasks`/`backlogMilestones` 도출 | ~70 |
| `src/components/views/WeeklyScheduleView.jsx` | 레이아웃 orchestrator, `DndContext` + `DragOverlay` 소유 | ~140 |
| `src/components/views/weekly-schedule/BacklogPanel.jsx` | 좌측 230px 패널, 토글/검색/트리 | ~150 |
| `src/components/views/weekly-schedule/BacklogItem.jsx` | `useDraggable` item | ~60 |
| `src/components/views/weekly-schedule/ScheduleGrid.jsx` | 멤버×요일 그리드 | ~100 |
| `src/components/views/weekly-schedule/ScheduleCell.jsx` | `useDroppable` 셀 + 내용 렌더 | ~90 |
| `src/components/views/weekly-schedule/CellInlineAdd.jsx` | "+" 인라인 태스크 생성 | ~70 |
| `src/components/views/weekly-schedule/DragPreview.jsx` | DragOverlay 콘텐츠 (2deg rotate + shadow) | ~40 |

**신규 합계**: ~770 LOC

### 2-3. 수정 금지

| 파일 | 이유 |
|------|------|
| `src/components/shared/OutlinerEditor.jsx` | CLAUDE.md never modify |
| `src/components/views/UnifiedGridView.jsx` | 기존 `team-weekly` 뷰 — 참조만 |
| `src/components/views/grid/grids/TeamWeeklyGrid.jsx` | UnifiedGridView 하위 — 타임라인 기반, 무관 |
| `src/components/views/MatrixView.*`, `MembersView.jsx`, `TimelineView/*` | 제약 §9 규칙 3 |
| `src/components/shared/InlineAdd.jsx` | wrap, don't modify (결정 5 참조) |

---

## 3. 구현 옵션 & Trade-off

### 결정 1 — 날짜 라이브러리

| 항목 | A: `date-fns` 설치 | **B: native Date + `weekDate.js` util** | C: `dayjs` 설치 |
|------|-------------------|----------------------------------------|-----------------|
| 번들 영향 | +~5KB gz (tree-shaken) | +0 | +~2KB + plugin |
| 앱 일관성 | 깨짐 (현재 앱 date-fns 미사용) | 유지 (`PersonalWeeklyGrid:40-50` 동일 패턴) | 깨짐 |
| 재사용 | `grid/constants.js` fmtDate/DAY_LABELS 무시 | 기존 유틸 재사용 + 주차 계산만 신규 | A와 유사 |
| ISO 주차 구현 | 라이브러리 제공 | native 10~12줄 | plugin 필요 |
| LOC | util ~10 / hook ~80 | util ~50 / hook ~70 | A와 유사 |
| 위험 | 종속성 추가 | ISO 주차 연 경계 주의 | 종속성 추가 |

**권장**: **B**. 현재 앱 전체 주간 로직이 native Date. 종속성 추가 이유 부족. `grid/constants.js`의 `fmtDate`/`DAY_LABELS` 재사용.

### 결정 2 — DragOverlay 구현

| 항목 | **A: 신규 DragOverlay (UnifiedGridView 패턴 계승)** | B: MsTaskTreeMode 방식 (opacity 0.4) | C: 둘 다 |
|------|---------------------------------------------------|------------------------------------|---------|
| 스펙 §5-3 충족 | 2deg rotate + shadow 목업 그대로 | 미충족 (스펙 위반) | 충족하지만 중복 |
| 기존 관례 | UnifiedGridView/UnifiedProjectView 동일 | — | — |
| UX | 백로그→먼 셀 드래그 시 추적 가능 | 원본이 230px 고정, 추적 불가 | 혼란 |
| LOC | 40 | 0 | 80 |

**권장**: **A**. UnifiedGridView가 이미 `DndContext + DragOverlay dropAnimation={null} + pointerWithin` 사용. 신규 뷰는 자체 `DndContext` 소유.

### 결정 3 — 백로그 토글 상태 관리

| 항목 | **A: BacklogPanel 로컬 `useState`** | B: WeeklyScheduleView 상위 + prop | C: Zustand | D: localStorage |
|------|------------------------------------|----------------------------------|-----------|-----------------|
| 복잡도 | 최소 | drilling | store 오염 | key 관리 |
| 영속화 | 뷰 이탈 시 리셋 | 동일 | 세션 내 유지 | 영구 |
| 원칙 부합 | "UI 상태는 local" | 과한 추상화 | store는 도메인 데이터만 | — |
| LOC | +3 | +8 | +10 | +8 |

**권장**: **A**. 뷰 이탈 시 "프로젝트별"로 리셋 = 미팅 세션 내 문제 없음. 추후 localStorage 이관 비용 낮음.

### 결정 4 — MS 드래그 시 하위 task 처리

스펙 §5-1 원문: "MS 드래그 시 MS의 `scheduled_date`만 설정. 하위 task 기존 assignee 유지. assignee 없는 task는 셀의 memberId로."

| 항목 | **A: 스펙 그대로 cascade** | B: MS만 설정 | C: 확인 모달 |
|------|-------------------------|-------------|-------------|
| 스펙 R11 준수 | 예 | **위반** | 예 |
| 입력 속도 (§0 핵심 요구) | 빠름 | 빠르나 목적 미달 | 느림 |
| 일괄 변경 위험 | 큼 (되돌리기 필요) | 없음 | 모달이 방지 |
| Supabase 라운드트립 | N+1 — bulk update 최적화 권장 | 1 | 1 + 사용자 클릭 |
| 되돌리기 | 셀→백로그 개별 드래그 (§5-4) | 불필요 | 불필요 |
| LOC | ~25 + bulk helper | ~8 | ~60 |

**권장**: **A + Supabase bulk update 최적화**. 하위 task cascade 시 `useStore`에 `updateTasksBulk({ ids, patch })` 추가 검토(spec 단계 확정). `category`는 cross-cell과 다르므로 리셋 **안 함** (R7 해석).

### 결정 5 — 셀 내 "+" 인라인 태스크 생성

| 항목 | A: `InlineAdd` 재사용 | **B: 전용 `CellInlineAdd` 신규** | C: 모달 |
|------|---------------------|------------------------------|---------|
| 스펙 R14 준수 | 예 (wrap 필요) | 예 | 위반 |
| InlineAdd `parseDateFromText` 부작용 | 셀 date 고정과 엉킴 가능 | 없음 | 해당 없음 |
| InlineAdd prop 확장 필요 | projectId 선택 UX 추가 → wrap 필요 | 해당 없음 | 해당 없음 |
| 입력 속도 | 빠름 | 빠름 | 느림 |
| LOC | ~50 (wrapper) + 부작용 | ~70 | ~80 |

**권장**: **B**. InlineAdd 재사용은 `parseDateFromText` 부작용으로 오히려 위험. 전용 컴포넌트가 명확. **projectId 결정**: (i) 이번 뷰 세션에서 마지막 선택 기억 + (iii) 드롭다운 제공.

### 결정 6 — `bgSecondary` 토큰 처리

| 항목 | A: 토큰 추가 | **B: `bgSurface`로 매핑** | C: 하드코딩 |
|------|------------|----------------------|------------|
| §7 "designTokens 사용" 준수 | 예 | 예 | **위반** |
| 글로벌 토큰 부채 | 신규 토큰 1개 추가 | 없음 | 없음 |
| 목업 #f8f7f5 vs bgSurface #fafaf8 | 정확 일치 | 육안 식별 불가 수준 | 정확 |
| LOC | +1 | 0 | 여러 곳 |

**권장**: **B**. 스펙의 `bgSecondary`는 목업 변수명 기준이고, §7은 designTokens 필수화. `bgSurface` 매핑 명시로 해결.

---

## 4. 재사용 가능한 기존 함수 / 패턴

| 패턴 | 위치 | 활용 |
|------|------|------|
| `MiniAvatar(name, size, color)` | `src/components/views/grid/shared/MiniAvatar.jsx` | 그리드 멤버 열, 백로그 담당자별 헤더 |
| `getColorByIndex(idx)` | `src/utils/colors.js:16-18` | 멤버 아바타 컬러 |
| `useTeamMembers()` / `useTeam` | `src/hooks/useTeamMembers.js` | 멤버 목록 (userId/displayName/avatarUrl) |
| `fmtDate`, `DAY_LABELS` | `src/components/views/grid/constants.js` | "월 4/20" 헤더 포맷 |
| `useStore.addTask(task)` | `:535-562` | 셀 인라인 생성 — `scheduled_date`/`assigneeId`/`projectId` 전달 |
| `useStore.updateTask(id, patch)` | `:564-585` | task scheduled_date 변경 (시그니처 그대로) |
| `useKeyMilestones.update(id, patch)` | `src/hooks/useKeyMilestones.js` | milestone scheduled_date 변경 |
| `DndContext + DragOverlay + pointerWithin` | `UnifiedGridView.jsx:425-481`, `UnifiedProjectView.jsx:426-484` | DnD 기반 패턴 계승 |
| `PointerSensor activationConstraint {distance:5}` | Sidebar.jsx, Unified* | 일관 activation 기준 |
| `position: sticky, left:0, z-index:1` | `TeamWeeklyGrid.jsx:42-46` | sticky 멤버 열 |
| `PILL.amber` 토큰 | `designTokens.js` | 오늘 헤더 하이라이트 |
| `getColor(colorId).dot` | `src/utils/colors.js` | 프로젝트 dot 시각화 |
| `HierarchicalTree.jsx` | `src/components/project/HierarchicalTree.jsx` | 백로그 트리 참조 구조 |
| `InlineAdd` 동작 원리 (참조만) | `src/components/shared/InlineAdd.jsx` | 새 `CellInlineAdd` 참조 |

---

## 5. 위험 요소 & 사전 확인 필요

### 5-1. 사전 확인 (spec 단계 이전에 해결)

| # | 항목 | 방법 | 영향 결정 |
|---|------|------|----------|
| 1 | Supabase 대시보드에서 `tasks`/`key_milestones` 현재 실제 스키마 재확인 | Table Editor | R1, R2 마이그레이션 안전 적용 |
| 2 | 주차 번호 해석: ISO 주차(월요일 시작) vs 한국식? | Ryan 확인 | 결정 1 B의 util 구현 |
| 3 | `scheduled_date` 범위: 월~금만? 주말 포함? | 목업은 5일. 스펙 §4-1도 5일 | 월~금 확정 |
| 4 | MS 드래그 cascade 시 Supabase bulk update 허용 여부 | 기존 `.in('id', [...]).update({...})` 패턴 있는지 확인 | 결정 4 A 성능 |
| 5 | 사이드바 📅 이모지 vs custom SVG | Ryan 취향 | 작은 결정 |

### 5-2. 구현 위험

| # | 위험 | 완화 |
|---|------|------|
| R1 | MS cascade 시 N+1 update → 느림, 일부 실패 시 정합성 깨짐 | Supabase `.in('id', ids).update(...)` 단일 쿼리 + 에러 전파 |
| R2 | MS 드래그 되돌리기(셀→백로그) 시 하위 task도 scheduled_date=null로 cascade? 여부 | spec 단계에서 결정 필요 — 일관성상 cascade 권장 |
| R3 | `category='today'` 리셋 규칙(§9 #7)과 scheduled_date 변경의 교차 | scheduled_date는 "배치 날짜"로 category와 독립 → category 불변 권장 |
| R4 | `team-weekly`와 `team-weekly-schedule` 이름 유사로 유저 혼동 | 사이드바 라벨 "주간 타임라인" vs "주간 스케줄" 명확화 제안 (기존 팀 섹션 라벨이 "할일"/"타임라인"이라 자연스럽게 구분됨) |
| R5 | 백로그 필터: `scheduled_date IS NULL AND done = false` + 팀 프로젝트만 → 현재 필터 조합이 store에 없음 | `useWeeklySchedule` hook 내 클라이언트 필터 (task 수 수백 규모라 성능 OK) |
| R6 | `mapTask` 수정(scheduledDate 매핑 1줄)은 global — 다른 뷰 영향 없음 검증 필요 | 신규 필드라 기존 렌더에 영향 없음 (undefined → null 기본값) |
| R7 | `addMemo`처럼 `updateTask` upsert payload에 `scheduled_date` 포함 경로 | 기존 `safeUpsertTask`가 `'*'` 방식이면 자동 포함. Row 매핑 `taskToRow`가 `scheduled_date`도 전달하도록 검증 필요 (spec에서 확정) |
| R8 | DragOverlay의 z-index 충돌 (앱의 모달/토스트 위) | `z-index: 9999` 또는 기존 overlay z-index 값 계승 |
| R9 | `@dnd-kit`의 sensor activation distance 5px가 셀 내 task의 "체크박스 클릭"과 충돌 | 체크박스는 button으로 분리, `stopPropagation()` 또는 sensor 설정 예외 처리 (UnifiedGridView 선례 참조) |

### 5-3. 테스트 관점 (spec에서 구체화할 시나리오)

- T1: 백로그 task 드래그 → 셀 드롭 → DB에 `scheduled_date + assigneeId` 반영 + 백로그 opacity 0.3 취소선
- T2: 백로그 MS 드래그 → 셀 드롭 → MS + 하위 모든 task scheduled_date 동일 값 반영
- T3: 셀→셀 이동 → assigneeId/date 갱신
- T4: 배치된 항목 → "미배정" 되돌리기 (scheduled_date = null)
- T5: 셀 "+" → 텍스트 입력 → Enter → 새 task 생성, 즉시 해당 셀에 표시
- T6: 주간 네비게이션 (이전/이번/다음)
- T7: 프로젝트별 ↔ 담당자별 토글 + 검색 필터 + 배치 완료 동기화
- T8: 팀 프로젝트만 노출 (개인 프로젝트 제외)
- T9: 완료된 task(`done=true`) 백로그 제외
- T10: 기존 `team-weekly` / `team-timeline` / `team-matrix` 뷰 무영향

---

## 6. 저자 권장 조합 요약

| 결정 | 선택 | 사유 |
|------|------|------|
| 1. 날짜 라이브러리 | **B (native Date + util)** | 앱 일관성, 종속성 無 |
| 2. DragOverlay | **A (신규, Unified\* 계승)** | 스펙 §5-3 충족 + 기존 관례 |
| 3. 백로그 토글 상태 | **A (로컬 state)** | 복잡도 최소, 원칙 부합 |
| 4. MS cascade | **A (스펙대로 + bulk update)** | 스펙 준수 + 성능 |
| 5. 셀 인라인 생성 | **B (전용 컴포넌트)** | InlineAdd 부작용 회피 |
| 6. bgSecondary | **B (`bgSurface` 매핑)** | §7 준수, 토큰 부채 없음 |

**이 조합의 총 변경량**: 신규 ~770 LOC (9개 파일), 수정 ~19 LOC (6개 파일), 0 LOC 수정(기존 뷰 전체).

---

## 7. 다음 단계

`/spec weekly-schedule`를 실행해 위 6개 결정을 확정하고 요구사항을 문서화한다. 확정 이후 `/diff-plan weekly-schedule` → `/execute weekly-schedule` 순.

spec 단계에서 반드시 결정할 추가 사항:
- MS 드래그 되돌리기 cascade 여부 (하위 task도 scheduled_date=null?)
- `category` 불변 정책 명문화
- 사이드바 라벨 "주간 스케줄" 확정 (vs 기존 "타임라인")
- 📅 이모지 vs custom SVG
- `updateTasksBulk` 신규 추가 여부 (결정 4 성능)
