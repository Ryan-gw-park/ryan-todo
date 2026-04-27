# Recon — Loop-47: 백로그 UI 정비 + 프로젝트별 할일 추가

> **상위 입력**: Ryan 피드백 (Q1/Q2/Q3/Q4 유관, 3이슈 분할: 열 너비 / '즉시' 최상단 정렬 / "+ 새 할일" 미동작·프로젝트 선택 UI 부재)
> **조사 목적**: 정확한 버그 원인 확정 + 해결 범위 최소화

---

## ⚡ Q1, Q2 즉답 — 코드 분석만으로 결정 가능

### Q1. 백로그에서 '즉시' 현재 위치

**답: 팀 프로젝트 전체 뒤 + 개인 프로젝트 첫 번째** (6~8번째 근방).

근거: [UnifiedGridView.jsx:92-105](../../src/components/views/UnifiedGridView.jsx#L92-L105)

```jsx
const displayProjects = useMemo(() => {
  const isSys = (p) => p.isSystem === true || p.systemKey === 'instant'
  if (scope === 'team') { ... }
  const systemPs = sortProjectsLocally(filteredProjects.filter(isSys))
  const teamPs   = currentTeamId ? sortProjectsLocally(filteredProjects.filter(p => !isSys(p) && p.teamId === currentTeamId)) : []
  const personalPs = sortProjectsLocally(filteredProjects.filter(p => !isSys(p) && !p.teamId))
  return [...systemPs, ...teamPs, ...personalPs]
}, [scope, currentTeamId, filteredProjects, sortProjectsLocally])
```

**2가지 분기**:
- **`isSys('즉시') === true`** → systemPs에 포함 → 최상단 ✓
- **`isSys('즉시') === false`** → personalPs 에 포함 → teamPs 뒤에 위치 → 개인 프로젝트 그룹의 맨 앞 (sortProjectsLocally 내부 priority 분기는 systemPs가 이미 추출돼서 효력 없음)

스크린샷 현상 (팀 뒤 + 개인 첫 번째) → **`isSys('즉시') === false`** 로 확정.

### Q2. "+ 새 할일" 동작 실패 진단

**답: (b) input은 뜨지만 Enter 눌러도 아무 반응 없음 + 브라우저 콘솔에 경고 로그만**.

근거: [PersonalTodoListTable.jsx:119-139](../../src/components/views/personal-todo/PersonalTodoListTable.jsx#L119-L139)

```jsx
const handleAddFinish = (value) => {
  setAdding(false)
  const text = (value ?? '').trim()
  if (!text) return
  if (!instantProjectId) {
    console.warn('[Loop-45] 즉시 프로젝트 미확보 — 빠른 추가 불가')
    return   // ← UI 피드백 없이 silent return
  }
  addTask({ text, projectId: instantProjectId, ... })
}
```

**확인**: Ryan이 브라우저 DevTools → Console 열고 "+ 새 할일" → 텍스트 입력 → Enter 누르면 `[Loop-45] 즉시 프로젝트 미확보 — 빠른 추가 불가` 로그 뜸. 뜨면 위 진단 확정.

---

## 🔴 근본 원인 통합 진단

**Issue 2a ('즉시' 정렬)와 Issue 2b ("+ 새 할일" 미동작) 는 동일한 근본 원인**:

**→ 사용자 DB의 '즉시' 프로젝트가 `is_system=false` AND `system_key !== 'instant'` 상태**

관련 `instantProjectId` 조회 ([PersonalTodoListTable.jsx:63-71](../../src/components/views/personal-todo/PersonalTodoListTable.jsx#L63-L71)):

```jsx
const instantProjectId = useMemo(() => {
  const p = projects.find(x =>
    x.userId === currentUserId &&
    (x.systemKey === 'instant' || x.isSystem === true)   // ← defensive OR
  )
  return p?.id || null
}, [projects, currentUserId])
```

이 필터로도 매칭 안 되면 → 둘 다 false/null → `instantProjectId = null` → "+ 새 할일" 무반응 + 백로그 정렬 시 `isSys()=false` → 개인 섹션으로 강등.

**사이드바에서 최상단처럼 보이는 이유**: [Sidebar.jsx:82-86](../../src/components/layout/Sidebar.jsx#L82-L86) 의 filter는 섹션별로 나뉜 후 sortProjectsLocally 호출. '즉시'가 isSys()를 통과 못 해도 personalProjects 배열 내부에서 localProjectOrder 값(0일 가능성 높음)에 따라 맨 위로. Ryan 눈에 "개인 섹션 최상단"처럼 보이나 실제로는 **팀 섹션 뒤**에 렌더됨.

→ 코드 defensive fix로는 한계 도달. **DB UPDATE가 근본 해결**.

---

## A. PersonalTodoListTable.jsx — 구조 요약 (273 lines)

전체 verbatim은 파일 직접 참조. 핵심 역할:

| 라인 | 역할 |
|---|---|
| L21-L71 | `export default function PersonalTodoListTable` — myTasks 필터, 섹션 분할, instantProjectId 조회 |
| L74-L111 | 3섹션(지금 / 다음 / 남은) 렌더 |
| L114-L215 | `function TodaySection` — `handleAddFinish` + inline input + Project loop |
| L217-L273 | `function CollapsibleSection` — 다음/남은 (접힘) |

**"+ 새 할일" 구현 위치**: `TodaySection` L155-L168 버튼, L171-L190 input, L119-L139 핸들러.

**✅ 버튼 onClick은 정상 연결됨** (`setAdding(true)`). input도 정상 렌더됨. **실패 지점은 `handleAddFinish` 내부 `instantProjectId === null` 체크 후 silent return**.

---

## B. sortProjectsLocally + 호출 체인

### B1. 정의 (useStore.js L1437-L1450)

```js
// 로컬 순서 적용된 프로젝트 정렬
sortProjectsLocally: (projectList) => {
  const { localProjectOrder } = get()
  // Loop-46 QA fix: DB 상태 불일치 방어 — isSystem OR systemKey='instant'
  const isSys = (p) => p.isSystem === true || p.systemKey === 'instant'
  return [...projectList].sort((a, b) => {
    // Loop-45: system project 최상단 고정
    const sa = isSys(a), sb = isSys(b)
    if (sa !== sb) return sa ? -1 : 1
    const orderA = localProjectOrder[a.id] ?? a.sortOrder ?? 0
    const orderB = localProjectOrder[b.id] ?? b.sortOrder ?? 0
    return orderA - orderB
  })
},
```

**이 함수 자체는 isSystem priority가 정상 작동**. 문제는 아님.

### B2. 호출 체인

| 호출자 | 위치 | 방식 |
|---|---|---|
| Sidebar | [Sidebar.jsx:82-86](../../src/components/layout/Sidebar.jsx#L82-L86) | 섹션별 필터 후 각각 sort (system / team / personal / archived×2) |
| UnifiedGridView | [UnifiedGridView.jsx:98-103](../../src/components/views/UnifiedGridView.jsx#L98-L103) | 3그룹 (system / team / personal) 각각 sort 후 concat |
| useStore.getOrderedProjects | useStore.js:1454-1459 | teamPs + personalPs 2 sorts + 섹션 순서 교체 가능 |

**Ryan 제안 "가능성 1, 2, 3" 재평가**:

| 가능성 | 실제 |
|---|---|
| 1: 원본 projects 배열 그대로 iteration | **TodaySection.L193 `{projects.map(p => ...)}` 사용** → props.projects 는 displayProjects = 이미 정렬된 배열. iteration 자체는 정렬 순서대로 ✓ |
| 2: isSystem priority가 섹션별로만 작동 | 일부 맞음 — 3그룹(system/team/personal)으로 `filter.isSys` 분리 후 concat. 즉 concat 순서(`systemPs, teamPs, personalPs`)가 전체 정렬 보장 |
| 3: sortProjectsLocally가 두 번 호출되어 덮어씀 | 아님 — 각 그룹별로 1회만 sort |

**진짜 구조적 버그가 아니다**. 위 코드 로직은 '즉시'가 isSys()를 통과하면 최상단 고정, 통과 못하면 개인 섹션 첫 번째가 됨. 즉 **코드는 DB 상태에 따라 정확히 동작 중**.

---

## C. "+ 새 할일" 진단 (Q2 보강)

### C1. 동작 시퀀스

1. 사용자 `+ 새 할일` 버튼 클릭 → `setAdding(true)` (L158)
2. Inline input 렌더 (L172-L190, `autoFocus`)
3. 사용자 텍스트 타이핑 + Enter
4. `onKeyDown` → `handleAddFinish(e.target.value)` 호출 (L185)
5. **`if (!instantProjectId) { console.warn(...); return }`** ← 여기서 막힘
6. (정상 경로) `addTask({text, projectId: instantProjectId, ...})` 호출 → 성공 시 `"추가됐습니다 ✓"` 토스트 ([useStore.js:610](../../src/hooks/useStore.js#L610))

**현재 Ryan 상태**: 단계 5에서 멈춤. 토스트 없음, 에러 다이얼로그 없음, 콘솔 로그만.

### C2. `addTask` 동작 확인

[useStore.js:585-612](../../src/hooks/useStore.js#L585-L612):

```js
addTask: async (task) => {
  ...
  const project = task.projectId ? get().projects.find(p => p.id === task.projectId) : null
  const isPersonalProject = project && !project.teamId
  const effectiveTeamId = isPersonalProject ? null : (project?.teamId || teamId)
  ...
  const t = { id: uid(), done: false, notes: '', sortOrder: Date.now(), category: 'today', alarm: null, ...teamDefaults, ...task }
  if (isPersonalProject) { t.scope = 'private'; t.teamId = null; t.assigneeId = userId }
  set(s => ({ tasks: [...s.tasks, t] }))
  ...
  if (!error) get().showToast('추가됐습니다 ✓')
  return t
},
```

- `task.projectId` nullable (기술적으로 null 허용, L590 ternary)
- 그러나 **null projectId 저장 시 PersonalTodoProjectGroup 렌더에서 매칭되지 않아 UI 비가시**
- `addTask` 자체는 호출되면 성공적으로 task 생성. 현재는 **호출조차 안 됨** (L126 early return).

---

## D. FocusQuickAddInput — 재사용 가능 여부

[FocusQuickAddInput.jsx](../../src/components/views/personal-todo/cells/FocusQuickAddInput.jsx) 구조 요약:

| 요소 | 특징 |
|---|---|
| props | `{ instantProjectId, currentUserId }` |
| state | 단일 `value` (input 값) |
| handleAdd | async, 반환 task 의 `id` 로 `setSelectedFocusTaskId(t.id)` (F-36) |
| 프로젝트 선택 UI | **없음** (instantProjectId 로 강제 귀속) |

**재사용 판단**:
- 기본 시그니처(input + Enter + addTask)는 재활용 가능
- 프로젝트 선택 드롭다운은 **신규 구현** 필요 (FocusQuickAddInput 자체 수정 금지, TodaySection 내 수정이 깔끔)

---

## E. 권장 해결 방안

### E1. Issue 1 (열 너비) — A+B 조합 수용

Ryan 제안:
- LIST 토큰 축소: `colWidthProject 170→130`, `colWidthMilestone 130→90`
- Shell 비율 상향: 좌측 1.2fr → 1.6fr (중간 0.9fr, 우측 1.2fr 유지)
- Shell 좌측 min-width: `minmax(420px, 1.6fr)` 유지 가능 (또는 `minmax(460px, 1.6fr)` 여유)

**결론: 수용**. 뷰포트 1500px 가정 시 할일 열 ~309px 확보. 3줄 이상 줄바꿈 대폭 감소.

### E2. Issue 2a ('즉시' 정렬) — DB 정규화

**근본 해결**: SQL UPDATE (추정 1줄 실행으로 해결):

```sql
-- Ryan 본인 user_id 확인
SELECT id FROM auth.users WHERE email = 'gunwoong.park@gmail.com';

-- '즉시' 프로젝트 현재 상태 확인 (기대: is_system=false 또는 system_key NULL)
SELECT id, name, is_system, system_key, user_id, team_id, archived_at
FROM projects
WHERE name = '즉시';

-- 정규화 (정확한 user_id 로 교체)
UPDATE projects
SET is_system = true, system_key = 'instant'
WHERE name = '즉시' AND user_id = '<Ryan UUID>' AND team_id IS NULL;
```

**코드 변경 불요**. SQL 실행 즉시 적용.

**대안 (코드 fallback, 미권장)**: `instantProjectId` 조회에 `name === '즉시'` 추가. 위험 — 사용자가 다른 용도로 '즉시' 이름 프로젝트 만들 수 있음.

### E3. Issue 2b ("+ 새 할일" 미동작) — E2 해결 후 자연 해결 or 신규 UX

E2 정규화 후 `instantProjectId` 조회 성공 → 기존 "+ 새 할일" 기능 복구.

But Ryan 요구: **"특정 프로젝트로 귀속 가능한 방법 추가"** (Issue 3).

→ 별도 UX 개선 필요. E4에서 다룸.

### E4. Issue 3 (프로젝트 선택 UI) — Ryan 우선순위 수용: C → A

**Stage 2 — Commit 4 (먼저)**: 프로젝트별 "+ 할일" 버튼 (hover)
- `PersonalTodoProjectGroup` 헤더 영역 hover 시 우측 "+" 아이콘
- 클릭 → 해당 프로젝트 하단 inline input
- Enter → `addTask({text, projectId: project.id, assigneeId: userId, category: 'today'})`
- **장점**: 90% 사용 케이스 ("SAP에 task 추가" 등) 자연스럽게 해결, 구현 단순
- **제약**: task 의 `keyMilestoneId` 는 null (첫 MS 또는 '기타' 그룹으로 귀속)

**Stage 2 — Commit 5 (나중)**: 전역 "+ 새 할일" 드롭다운
- TodaySection 헤더의 "+ 새 할일" → adding 모드에서 `<select>` (프로젝트) + `<input>` (텍스트) 나란히
- 기본값: localStorage `lastSelectedProjectId` → '즉시' fallback
- Enter → `addTask({projectId: selected, ...})`
- 선택 후 localStorage 기록

### E5. Issue 관련 Ryan Q3 (Stage 3 F-11 예외)

**옵션**: 시스템 프로젝트는 task 0건이어도 백로그에 항상 표시.

현재 [PersonalTodoListTable.jsx:195](../../src/components/views/personal-todo/PersonalTodoListTable.jsx#L195):
```js
if (projTasks.length === 0) return null // F-11
```

수정안:
```js
if (projTasks.length === 0 && !project.isSystem && project.systemKey !== 'instant') return null
```

**효과**: '즉시'는 빈 상태여도 백로그 최상단에 표시되어 "여기에 추가되면 어디로 가는지" 시각화. `+ 할일` 버튼 유도 효과.

**단점**: 섹션 불필요한 시각 잡음 가능. Ryan이 Q3에 **Yes**로 결정하면 반영.

---

## F. Loop-47 실행 계획 (Ryan 결정 후 착수)

### Stage 0 — 즉시 SQL 실행 (Ryan 수동)

```sql
-- 1. user_id 확인
SELECT id FROM auth.users WHERE email = 'gunwoong.park@gmail.com';

-- 2. 즉시 프로젝트 현재 상태
SELECT id, name, is_system, system_key, user_id, team_id, archived_at
FROM projects WHERE name = '즉시';

-- 3. 정규화 (user_id 치환)
UPDATE projects SET is_system = true, system_key = 'instant'
WHERE name = '즉시' AND user_id = '<uuid>' AND team_id IS NULL;

-- 4. 재확인
SELECT id, name, is_system, system_key FROM projects WHERE name = '즉시';
```

브라우저 강력 새로고침 후 Issue 2a + 2b 자연 해결 여부 확인.

### Stage 1 — 즉시 실행 가능 (Claude Code)

| # | Commit | 파일 |
|---|---|---|
| 1 | feat(tokens): LIST 토큰 축소 + Shell 좌측 비율 1.6fr (Loop-47) | `designTokens.js`, `PersonalTodoShell.jsx` |
| 2 | (optional) fix: 시스템 프로젝트 F-11 예외 — task 0건에도 표시 (Q3 Yes 시) | `PersonalTodoListTable.jsx` |

### Stage 2 — 프로젝트 선택 UI (Claude Code, Ryan Q3/Q4 결정 후)

| # | Commit | 파일 |
|---|---|---|
| 3 | feat(cells): PersonalTodoProjectGroup hover "+ 할일" 버튼 + inline input | `PersonalTodoProjectGroup.jsx` |
| 4 | feat(list): 전역 "+ 새 할일" 드롭다운 (프로젝트 select + input) + localStorage | `PersonalTodoListTable.jsx` |

### Stage 3 — 회귀 테스트 (Ryan 수동)

- 백로그 '즉시' 최상단 확인
- "+ 새 할일" 으로 task 생성 확인
- 프로젝트별 hover "+ 할일" 동작 확인
- 전역 "+ 새 할일" 드롭다운 기본값 / localStorage 기억 확인

---

## G. Ryan 확인 필요 (최종 4건)

| # | 질문 | 권장 |
|---|---|---|
| Q1 | Stage 0 SQL 실행 + 결과 공유 | **예** (필수). UPDATE 쿼리도 같이 실행하고 결과 행 공유 |
| Q2 | Issue 1 해결 방식 | **A+B 조합** (토큰 축소 + 비율 1.6fr) |
| Q3 | F-11 예외 (시스템 프로젝트 항상 표시) | **Yes** — 존재감 유지, "+ 할일" 유도 |
| Q4 | Stage 2 순서 | **Commit 3 먼저 (프로젝트별 hover)** → Commit 4 나중 (전역 드롭다운) |

---

## H. 파일 크기

본 recon 약 17 KB — 30 KB 목표 내.
