# Loop-36B: 주간 플래너 (신규 뷰)

> **분류**: Feature (신규 글로벌 뷰)
> **선행 조건**: Loop-36A 완료 (milestones 글로벌 접근 + MsBadge/ProgressBar 공통 컴포넌트)
> **참조 목업**: `docs/mockups/loop-36-mockup.jsx` — "주간 플래너" 탭
> **Agent 리뷰 필수**

---

## 목표

팀원이 함께 보면서 이번 주 할일을 협의하는 시간표 뷰.
행 = 담당자, 열 = 월~금 요일.
우측 백로그 사이드바에서 할일을 끌어다 요일에 배치하거나, 요일에서 빼서 백로그로 되돌린다.

---

## 핵심 사용 시나리오

1. **주간 미팅**: 팀 전체가 화면을 보면서 "이번 주 누가 뭘 마무리하는지" 확인
2. **업무 배분**: 특정 요일에 업무가 몰린 팀원을 발견 → DnD로 다른 요일/담당자로 분산
3. **백로그 관리**: 이번 주에 당겨서 할 할일을 백로그에서 끌어오거나, 이번 주 범위에서 빼서 백로그로 밀기
4. **마일스톤 현황**: 백로그 사이드바에서 마일스톤 탭으로 전환하여 진행 현황 파악

---

## 구조

### 메인 그리드 (좌측)

```
[할일|마일스톤] [전체|팀|개인] [◀ 이번주 ▶] 2026.03.17~03.21 (12주차)

담당자    월 3/17       화 3/18       수 3/19       목 3/20       금 3/21
─────────────────────────────────────────────────────────────────────
R Ryan    ┌───────┐    ┌───────┐    ┌───────┐
          │원진회신│    │안건PPT│    │사업보고│
          │개별과제│    │정기주총│    │BIS    │
          └───────┘    │Sifive │    └───────┘
                       │정기주총│
                       └───────┘
E Edmond               ┌───────┐
                       │의사록 │
                       │정기주총│
                       └───────┘
A ash                                ┌───────┐
                                     │Sifive │
                                     │위임투표│
                                     └───────┘
E eric    (빈 칸)       (빈 칸)       (빈 칸)       (빈 칸)       (빈 칸)
```

### 백로그 사이드바 (우측, 260px)

```
백로그
┌──────────────────────┐
│ ▼ 전체 프로젝트       │  ← 프로젝트 드롭다운
│ [전체] [남은] [다음]  │  ← 카테고리 필터
│ [할일] [마일스톤]     │  ← 탭 전환
├──────────────────────┤
│ ● 정기주총            │
│   안건PPT 재무제표    │  ← 드래그 가능
│   등기서류 공증인     │
│   위임장 뿌리기       │
│ ● ABI 코리아          │
│   ABI 이사회 Paper    │
│ ...                   │
├──────────────────────┤
│  ← 요일 셀로 드래그   │  ← 힌트 영역
└──────────────────────┘
```

---

## 진단 Phase

```bash
# 1. 사이드바 진입 경로 — currentView에 'weekly' 추가 필요
grep -rn "currentView\|VIEW_ORDER" src/ --include="*.js" --include="*.jsx" -n | head -15

# 2. 네비게이션 3표면 — Sidebar, BottomNav, Keyboard 업데이트 필요
grep -rn "today.*allTasks.*matrix\|VIEW_ORDER\|BottomNav\|currentView.*=" src/ --include="*.jsx" -n | head -20

# 3. tasks에서 dueDate로 필터링하는 기존 패턴
grep -rn "dueDate\|due_date\|startDate\|start_date" src/hooks/useStore.js -n | head -10

# 4. 팀원 목록 가져오는 방법
grep -rn "teamMembers\|members\|getTeamMembers" src/ --include="*.js" --include="*.jsx" -n | head -10

# 5. 기존 DnD에서 assigneeId 변경하는 패턴 (TeamMatrixView 참조)
grep -rn "assigneeId\|assignee_id" src/components/matrix/TeamMatrixView.jsx -n | head -15

# 6. milestones 글로벌 접근 — Loop-36A에서 어떻게 처리했는지 확인
grep -rn "milestones" src/hooks/useStore.js -n | head -10
```

---

## 구현 Phase

### Phase 1: 뷰 등록 + 네비게이션

**currentView에 'weekly' 추가:**

```js
// useStore.js — currentView 초기값 목록에 추가
currentView: 'today' // 기존. 'weekly' 값을 VIEW_ORDER에 추가
```

**네비게이션 3표면 업데이트 (Agent 03 B2 준수):**

| 표면 | 추가 항목 | 위치 |
|------|----------|------|
| Sidebar | 📅 주간 플래너 | 타임라인 아래 |
| BottomNav | 주간 | 타임라인 옆 (모바일에서 표시할지 검토 필요) |
| Keyboard VIEW_ORDER | 'weekly' | timeline 뒤에 추가 |

**React.lazy 등록:**

```js
const WeeklyPlannerView = lazy(() => import('./components/views/WeeklyPlannerView'));
```

### Phase 2: WeeklyPlannerView 셸

```
src/components/views/WeeklyPlannerView.jsx
```

**Props/State:**
- `currentWeekStart`: Date — 이번 주 월요일. `[◀ 이번주 ▶]`로 변경
- `viewFilter`: '전체' | '팀' | '개인'
- `contentMode`: '할일' | '마일스톤'

**데이터 소스:**
- `tasks` from store — dueDate로 요일 매핑
- `milestones` from store (36A에서 추가됨)
- `teamMembers` from store — 행 구성
- `projects` from store — 카드 컬러

**주 계산:**
```js
const getWeekDays = (startDate) => {
  // startDate = 월요일
  return [0,1,2,3,4].map(offset => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + offset);
    return d;
  });
};
```

### Phase 3: 메인 그리드

**행 = 담당자:**
- 팀 모드: 팀원 목록 + "미배정" 행
- 개인 모드: "나" 행만
- 전체: 팀원 + 개인

**열 = 월~금:**
- 오늘 요일 하이라이트 (연한 노란색 배경)
- 각 셀: 해당 담당자 + 해당 날짜의 할일 카드 목록

**할일 매핑 기준:**
```js
const getTasksForCell = (memberId, date) => {
  const dateStr = formatDate(date); // 'YYYY-MM-DD' or 'MM/DD'
  return tasks.filter(t =>
    t.assignee === memberId &&
    t.dueDate === dateStr &&
    !t.done
  );
};
```

**할일 카드 (셀 내부):**
```
┌──────────────────┐
│ 안건 PPT 3시     │  ← 할일 제목
│ ● 정기주총        │  ← 프로젝트 도트 + 이름
└──────────────────┘
```
- 프로젝트 컬러 카드 배경
- 드래그 가능 (cursor: grab)
- 클릭 → DetailPanel 진입

**마일스톤 모드 (contentMode === '마일스톤'):**
할일 대신 MS 카드 표시. 해당 주에 기간이 걸치는 마일스톤을 담당자별로 배치.
DnD는 비활성 (마일스톤은 요일 단위 이동이 아님). 클릭 → MS 상세 모달.

### Phase 4: 백로그 사이드바

**컴포넌트**: `WeeklyBacklogSidebar.jsx` — WeeklyPlannerView 내부에 렌더.

**프로젝트 드롭다운:**
- "전체 프로젝트" (기본) → 프로젝트별 flat 목록
- 특정 프로젝트 선택 → 마일스톤별 트리 구조

**카테고리 필터:** `[전체|남은|다음]`

**탭 전환:** `[할일|마일스톤]`
- 할일 탭: 드래그 가능한 할일 행
- 마일스톤 탭: MS 카드 목록 (클릭 → 모달, DnD 없음)

**백로그 할일 필터 기준:**
```js
const backlogTasks = tasks.filter(t => {
  if (t.done) return false;
  // 이번 주 요일에 이미 배치된 할일 제외
  if (isInCurrentWeek(t.dueDate, currentWeekStart)) return false;
  // 프로젝트 필터
  if (selectedProject !== '전체' && t.projectId !== selectedProject) return false;
  // 카테고리 필터
  if (catFilter === '남은') return t.category === 'backlog';
  if (catFilter === '다음') return t.category === 'next';
  return true;
});
```

**마일스톤별 트리 (프로젝트 선택 시):**
```
● 공증 준비         ██░░░░  2/6
  등기서류 공증인 확인       남은
  위임장 뿌리기+웹사이트     남은
● 안건자료 PPT      █░░░░░  1/2
  안건PPT 재무제표 분석      남은
미연결 (3)
  투표 역선                  남은
```

### Phase 5: DnD 상호작용

**단일 DndContext** — 메인 그리드 + 백로그 사이드바를 감쌈.

**드래그 소스:**
- 요일 셀 내 할일 카드 → `useDraggable({ data: { type: 'task', taskId, source: 'grid' } })`
- 백로그 할일 행 → `useDraggable({ data: { type: 'task', taskId, source: 'backlog' } })`

**드롭 대상:**
- 요일 셀 → `useDroppable({ data: { type: 'day-cell', memberId, date } })`
- 백로그 영역 → `useDroppable({ data: { type: 'backlog' } })`

**onDragEnd 핸들러:**

```js
// 백로그 → 요일 셀
if (source === 'backlog' && targetType === 'day-cell') {
  updateTask(taskId, {
    dueDate: targetDate,       // 해당 요일 날짜
    category: 'today',         // 이번 주에 배치 = 오늘 할일
    assigneeId: targetMemberId // 해당 담당자
  });
}

// 요일 셀 → 백로그
if (source === 'grid' && targetType === 'backlog') {
  updateTask(taskId, {
    dueDate: null,
    category: 'backlog'
  });
}

// 요일 셀 → 다른 요일 셀
if (source === 'grid' && targetType === 'day-cell') {
  const patch = { dueDate: targetDate };
  if (targetMemberId !== currentAssignee) {
    patch.assigneeId = targetMemberId;
  }
  updateTask(taskId, patch);
}
```

**모든 DnD는 `applyTransitionRules` 경유** (updateTask가 자동으로 호출).

**센서 설정 (Agent 04 B3 준수):**
```js
PointerSensor: { activationConstraint: { distance: 3 } }
TouchSensor: { activationConstraint: { delay: 200, tolerance: 5 } }
```

### Phase 6: 주 탐색

```
[◀] [이번주] [▶]  2026.03.17 ~ 03.21 (12주차)
```

- `◀` 클릭 → currentWeekStart -= 7일
- `이번주` 클릭 → currentWeekStart = 이번 주 월요일로 리셋
- `▶` 클릭 → currentWeekStart += 7일
- 주차 번호: `getWeekNumber(currentWeekStart)`

---

## scope 전환 처리 (Agent 02 + 35K 트리거)

백로그에서 요일 셀로 이동 시, 대상 할일의 scope와 assigneeId가 바뀔 수 있다.
Loop-35K 트리거가 task-project team_id 정합성을 DB 레벨에서 검증하므로,
**개인 프로젝트의 할일을 다른 팀원에게 배정하면 트리거가 거부한다.**

이 케이스 처리:
```js
// 개인 프로젝트 할일을 다른 사람에게 배정하려 할 때
const project = projects.find(p => p.id === task.projectId);
if (!project.teamId && targetMemberId !== myUserId) {
  // 토스트: "개인 프로젝트 할일은 본인에게만 배정 가능합니다"
  return;
}
```

---

## 검증 체크리스트

### 기본 기능
- [ ] 사이드바에 "주간 플래너" 메뉴 표시 + 클릭 시 뷰 전환
- [ ] 행 = 담당자, 열 = 월~금 요일 그리드 정상 렌더링
- [ ] 오늘 요일 셀 하이라이트
- [ ] [◀ 이번주 ▶] 주 탐색 정상 동작
- [ ] dueDate가 해당 주인 할일이 올바른 셀에 표시

### DnD
- [ ] 백로그 → 요일 셀: dueDate 설정 + category='today' + assigneeId 변경
- [ ] 요일 셀 → 백로그: dueDate=null + category='backlog'
- [ ] 요일 셀 → 다른 요일: dueDate 변경
- [ ] 요일 셀 → 다른 담당자 행: assigneeId 변경
- [ ] 개인 프로젝트 할일 → 타인 배정 시 거부 (토스트)
- [ ] DnD 후 글로벌 뷰(오늘할일, 매트릭스)에 즉시 반영

### 백로그 사이드바
- [ ] "전체 프로젝트" 선택 시 프로젝트별 flat 목록
- [ ] 특정 프로젝트 선택 시 마일스톤별 트리
- [ ] [전체|남은|다음] 카테고리 필터 동작
- [ ] [할일|마일스톤] 탭 전환 동작
- [ ] 이번 주에 이미 배치된 할일은 백로그에 표시 안 됨

### 필터
- [ ] [전체|팀|개인] 필터 → 담당자 행 + 할일 필터링
- [ ] [할일|마일스톤] 모드 전환

### 네비게이션 (Agent 03 B2)
- [ ] Sidebar에 메뉴 추가됨
- [ ] BottomNav에 추가 또는 명시적 제외 결정
- [ ] Keyboard VIEW_ORDER에 'weekly' 추가됨

### 회귀 검증
- [ ] 오늘 할일 뷰 정상
- [ ] 전체 할일 뷰 정상 (36A)
- [ ] 매트릭스 뷰 정상 (36A)
- [ ] 타임라인 뷰 정상
- [ ] 프로젝트 뷰 정상
- [ ] DetailPanel 정상
- [ ] 모바일 레이아웃 깨지지 않음
- [ ] `npm run build` 성공

---

## 주의사항

1. **updateTask(id, patch) 시그니처 엄수**
2. **applyTransitionRules 경유 필수** — 특히 category 변경 시
3. **DnD 센서 표준 설정 사용** (distance: 3, delay: 200)
4. **DndContext 중첩 금지** — 메인 그리드 + 백로그를 하나의 DndContext로
5. **CSS 변수 사용 금지** — 인라인 스타일 컨벤션
6. **왼쪽 컬러 보더 금지** — 프로젝트 도트로 대체
7. **`select('*')` 금지**
8. **개인 프로젝트 할일의 타인 배정 차단** — Loop-35K 트리거 + 프론트 사전 검증
9. **React.lazy 등록** — 기존 코드 스플리팅 패턴 준수
10. **네비게이션 3표면 모두 업데이트** — 하나라도 누락 시 Agent 03 BLOCK

---

## 작업 내역

(작업 완료 후 기록)
