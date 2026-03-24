# Loop-31: 할일 상태 기반 정비

> **목표:** 모든 뷰에서 할일 상태가 일관되게 동작하도록 상태 전이 로직을 중앙화하고, 확인된 버그를 수정한다.
> **범위:** store 로직 레이어 + 뷰 필터 조건. UI 구조 변경 없음.
> **선행 조건:** Loop-27 이후 최신 코드

---

## 배경 및 설계 결정

### 확정된 규칙

1. **category:'done' 폐지** — `done` 필드(boolean)가 완료의 유일한 기준. category는 우선순위만 표현: 'today' | 'next' | 'backlog'
2. **배정 해제 시 category='backlog' 리셋** — 미배정 팀 할일은 무조건 backlog
3. **applyTransitionRules 헬퍼** — 모든 updateTask 호출에서 연쇄 변경을 자동 적용

### 상태 전이 규칙 (R1~R7)

```
R1: assigneeId 설정 → scope = 'assigned'
R2: assigneeId = null → scope = 'team' (teamId 있을 때) / 'private' (없을 때)
R2+: 팀 할일 배정 해제 → category = 'backlog'
R3: done = true → prevCategory = 현재 category (category 변경 안 함)
R4: done = false → prevCategory = ''
R5: projectId 변경 → keyMilestoneId = null (명시적 설정 없으면)
R6: scope = 'private' → teamId = null, assigneeId = null
R7: scope = 'team' → assigneeId = null
```

### 확인된 버그 (이번 Loop에서 수정)

| # | 위험도 | 버그 | 위치 |
|---|--------|------|------|
| 1 | 🔴 | DnD 조기 리턴 — scope/assigneeId 미검사 | TeamMatrixView.jsx ~line 173 |
| 2 | 🔴 | remainingTasks에 category 필터 없음 | TeamMatrixView.jsx ~line 269-271 |
| 3 | 🔴 | toggleTask 미정의 (런타임 에러) | CompactTaskList.jsx ~line 17 |
| 4 | 🟡 | moveTaskTo에서 keyMilestoneId 미초기화 | useStore.js moveTaskTo |
| 7 | 🟡 | 팀원 행 drop 시 category 강제 'next' | TeamMatrixView.jsx ~line 160-167 |

### 뷰별 필터 조건 (확정 기준)

| 뷰 | 섹션 | 필터 |
|----|------|------|
| TodayView | 전체 | `category='today' AND done=false` |
| TodayView | 팀 탭 | + `teamId=currentTeamId` |
| TodayView | 개인 탭 | + `scope='private'` |
| MatrixView(개인) | 오늘 행 | `category='today' AND done=false` |
| MatrixView(개인) | 다음 행 | `category='next' AND done=false` |
| MatrixView(개인) | 남은 행 | `category='backlog' AND done=false` |
| MatrixView(개인) | 완료 행 | `done=true` |
| TeamMatrixView | 내 오늘 | `category='today' AND done=false AND (내할일*)` |
| TeamMatrixView | 내 다음 | `category='next' AND done=false AND (내할일*)` |
| TeamMatrixView | 팀원 행 | `scope='assigned' AND assigneeId=memberId AND done=false` |
| TeamMatrixView | 남은 할일 | `scope='team' AND !assigneeId AND done=false AND category='backlog'` |
| TeamMatrixView | 완료 | `done=true AND teamId=currentTeamId` |
| TimelineView | 간트바 | `done=false AND (선택 필터)` |
| ProjectView | MS 연결 | `projectId=id AND milestoneId=msId` |
| ProjectView | 백로그 | `projectId=id AND milestoneId=null` |

*내할일 = (scope='assigned' AND assigneeId=userId) OR (scope='private' AND createdBy=userId) OR (!teamId AND !scope)*

---

## 작업 순서

> **중요:** 반드시 작업 1 → 2 → 3 → 4 → 5 순서로 진행. 작업 1(헬퍼)이 나머지의 기반.
> **원칙:** updateTask(id, patch) 시그니처 유지. 기존 컴포넌트 구조 변경 금지 ("Don't Touch, Wrap It" 원칙은 유지하되, 이번은 store 내부 로직 수정이므로 직접 수정 허용).

---

### 작업 1: applyTransitionRules 헬퍼 도입

**대상 파일:** `src/store/useStore.js`

**1-1. 헬퍼 함수 추가**

useStore.js 파일 상단(store 정의 바깥)에 아래 함수를 추가한다:

```javascript
function applyTransitionRules(currentTask, patch) {
  const resolved = { ...patch };

  // R1: assigneeId 설정 → scope='assigned'
  if ('assigneeId' in resolved && resolved.assigneeId !== currentTask.assigneeId) {
    if (resolved.assigneeId) {
      if (!('scope' in resolved)) resolved.scope = 'assigned';
    } else {
      // R2: assigneeId=null → scope='team' 또는 'private'
      if (!('scope' in resolved)) {
        resolved.scope = currentTask.teamId ? 'team' : 'private';
      }
      // R2+: 팀 할일 배정 해제 → category='backlog'
      if (currentTask.teamId && !('category' in resolved)) {
        resolved.category = 'backlog';
      }
    }
  }

  // R3: done=true → prevCategory 저장 (category는 변경 안 함)
  if ('done' in resolved) {
    if (resolved.done && !currentTask.done) {
      resolved.prevCategory = currentTask.category;
    }
    // R4: done=false → prevCategory 초기화
    if (!resolved.done && currentTask.done) {
      resolved.prevCategory = '';
    }
  }

  // R5: projectId 변경 → keyMilestoneId 초기화
  if ('projectId' in resolved && resolved.projectId !== currentTask.projectId) {
    if (!('keyMilestoneId' in resolved)) {
      resolved.keyMilestoneId = null;
    }
  }

  // R6: scope='private' → teamId, assigneeId 초기화
  if (resolved.scope === 'private') {
    if (!('teamId' in resolved)) resolved.teamId = null;
    if (!('assigneeId' in resolved)) resolved.assigneeId = null;
  }

  // R7: scope='team' → assigneeId 초기화
  if (resolved.scope === 'team' && !('assigneeId' in resolved)) {
    resolved.assigneeId = null;
  }

  return resolved;
}
```

**1-2. updateTask에 헬퍼 적용**

updateTask 함수 내부에서 Supabase upsert/update 호출 전에 patch를 변환한다:

```javascript
// updateTask(id, patch) 내부 — 기존 로직에서 patch를 사용하는 부분을 찾아서:
const currentTask = get().tasks.find(t => t.id === id);
if (!currentTask) return;
const resolvedPatch = applyTransitionRules(currentTask, patch);
// 이하 resolvedPatch를 사용하여 로컬 state 업데이트 + Supabase upsert
```

**1-3. moveTaskTo에도 헬퍼 적용**

moveTaskTo 함수 내부에서도 동일하게 적용한다. moveTaskTo가 내부적으로 updateTask를 호출한다면 자동 적용되므로 확인만 하면 된다. 만약 moveTaskTo가 직접 Supabase를 호출한다면 동일하게 applyTransitionRules를 적용한다.

**1-4. 기존 핸들러에서 중복 로직 정리**

applyTransitionRules가 처리하는 연쇄 변경을 각 컴포넌트에서 수동으로 하고 있는 부분을 찾아 정리한다:
- AssigneeSelector에서 scope 설정 → applyTransitionRules R1/R2가 처리하므로, 명시적으로 scope을 patch에 넣고 있다면 **유지해도 무방** (헬퍼는 명시적 값이 있으면 덮어쓰지 않음)
- 단, 충돌이 없는지 확인

**주의사항:**
- applyTransitionRules는 `'필드' in resolved` 로 patch에 해당 필드가 **명시적으로 포함된 경우에만** 규칙 발동
- 컴포넌트가 이미 올바른 값을 명시적으로 넘기는 경우 헬퍼가 덮어쓰지 않음 (안전)
- `resolved.assigneeId !== currentTask.assigneeId` 로 실제 변경이 있을 때만 발동

---

### 작업 2: category:'done' 폐지

**2-1. DB 마이그레이션**

새 마이그레이션 파일을 생성한다:

```sql
-- Loop-31: category:'done' 폐지 — done 필드가 완료의 유일한 기준
-- category='done'인 행의 category를 이전 값으로 복원

UPDATE tasks 
SET category = CASE 
  WHEN prev_category IS NOT NULL AND prev_category != '' THEN prev_category
  ELSE 'backlog'
END,
updated_at = now()
WHERE category = 'done';

-- 확인: category='done'인 행이 0건이어야 함
-- SELECT count(*) FROM tasks WHERE category = 'done';
```

> Supabase Dashboard > SQL Editor에서 실행하거나, supabase/migrations/ 디렉토리에 새 파일로 추가.

**2-2. toggleDone 함수 수정**

`src/store/useStore.js`의 toggleDone 함수를 수정한다:

현재 toggleDone이 하는 일:
```javascript
// 완료 시: { done: true, category: 'done', prevCategory: 이전값 }
// 취소 시: { done: false, category: prevCategory || 'backlog', prevCategory: '' }
```

수정 후:
```javascript
// 완료 시: { done: true }
// → applyTransitionRules R3가 자동으로 prevCategory 저장
// → category는 변경하지 않음

// 취소 시: { done: false }
// → applyTransitionRules R4가 자동으로 prevCategory='' 설정
// → category는 변경하지 않음 (이미 원래 값 유지 중)
```

구체적으로: toggleDone 함수에서 `category: 'done'` 설정 부분을 제거하고, 완료 취소 시 `category: prevCategory || 'backlog'` 부분도 제거한다. done 필드만 토글하면 applyTransitionRules가 나머지를 처리한다.

**2-3. moveTaskTo 함수 수정**

moveTaskTo 내부에서 `category === 'done'` 분기를 찾아 수정:
- 완료 행으로 이동(드롭) 시: `{ done: true }` 만 전달 (category:'done' 제거)
- 완료→미완료 이동 시: `{ done: false, category: targetCategory }` 전달

**2-4. DetailPanel 카테고리 버튼 수정**

DetailPanel에서 카테고리 선택 버튼의 동작을 수정:

현재:
```javascript
// 카테고리 버튼 클릭: { category: ct.key, done: false, prevCategory: '' }
```

수정 후:
```javascript
// 'today'/'next'/'backlog' 버튼 클릭:
//   - done이 true인 상태라면: { category: ct.key, done: false }
//   - done이 false인 상태라면: { category: ct.key }
```

> 'done' 버튼이 별도로 있다면 → `{ done: true }` 로 변경. DetailPanel에 카테고리 옵션으로 'done'이 포함되어 있다면 해당 옵션을 카테고리 버튼 그룹에서 제거하고, 기존 "완료 처리" 버튼/체크박스가 done 토글을 담당하도록 한다.

**2-5. 코드베이스 전체에서 category === 'done' 제거**

```bash
grep -rn "category.*'done'\|category.*\"done\"\|=== 'done'" src/ --include="*.js" --include="*.jsx"
```

위 검색 결과에서 모든 `category === 'done'` 또는 `category: 'done'` 을 `done === true` 또는 `done: true`로 교체한다.

**예외:** 카테고리 상수 배열에 'done'이 포함된 경우 제거한다.

---

### 작업 3: Critical 버그 3건 수정

**3-1. 버그 #1 — DnD 조기 리턴 수정**

**파일:** `TeamMatrixView.jsx`

DnD onDragEnd 핸들러에서 조기 리턴 조건을 찾는다. 현재 조건:

```javascript
if (task.projectId === targetProjectId && task.category === targetCategory) return;
```

이 조건을 다음으로 교체한다:

```javascript
// 드롭 대상 영역에 따른 expected 상태 결정
// droppableId 파싱으로 어느 영역인지 판단해야 함
// (실제 droppableId 인코딩 규칙은 코드에서 확인)

// 기본 원칙: category + scope + assigneeId가 모두 동일할 때만 조기 리턴
// scope와 assigneeId는 드롭 대상 행(row)에 따라 결정됨

const isSamePosition = (
  task.projectId === targetProjectId &&
  task.category === targetCategory &&
  task.scope === expectedScope &&
  task.assigneeId === expectedAssignee
);
if (isSamePosition) return;
```

expectedScope/expectedAssignee 결정 로직:
- "내 할일" 행 (오늘/다음) → `scope='assigned'`, `assigneeId=userId`
- "남은 할일" 행 → `scope='team'`, `assigneeId=null`
- "팀원" 행 → `scope='assigned'`, `assigneeId=해당 memberId`
- "완료" 행 → scope/assigneeId 변경 없음, done만 변경

droppableId 인코딩 규칙을 코드에서 확인하여 위 분기를 구현한다.

**3-2. 버그 #2 — remainingTasks 필터 수정**

**파일:** `TeamMatrixView.jsx`

현재:
```javascript
const remainingTasks = tasks
  .filter(t => t.teamId === currentTeamId && t.scope === 'team' && !t.assigneeId && !t.done)
```

수정:
```javascript
const remainingTasks = tasks
  .filter(t => t.teamId === currentTeamId && t.scope === 'team' && !t.assigneeId && !t.done && t.category === 'backlog')
```

`t.category === 'backlog'` 조건을 추가한다.

**3-3. 버그 #3 — toggleTask → toggleDone**

**파일:** `CompactTaskList.jsx`

useStore()에서 디스트럭처하는 `toggleTask`를 `toggleDone`으로 변경한다.

```javascript
// 현재:
const { toggleTask, ... } = useStore();

// 수정:
const { toggleDone, ... } = useStore();
```

이 함수를 호출하는 모든 곳도 함께 변경한다:
```bash
grep -rn "toggleTask" src/components/CompactTaskList.jsx
```

모든 `toggleTask(` 를 `toggleDone(` 으로 교체.

---

### 작업 4: 뷰별 필터 조건 통일

모든 뷰에서 필터 조건을 "배경 및 설계 결정 > 뷰별 필터 조건" 표와 일치시킨다.

**4-1. 검색 대상**

```bash
# done 필터 누락 찾기
grep -rn "category.*today\|category.*next\|category.*backlog" src/components/ --include="*.jsx" --include="*.js"

# 각 결과에서 같은 필터 체인에 !t.done 또는 t.done === false가 있는지 확인
```

**4-2. TodayView**

현재: `t.category === 'today'` 만 필터
수정: `t.category === 'today' && !t.done` 추가

**4-3. TeamMatrixView — myTasksForRow**

현재 myTasksForRow 함수에서 `!t.done` 조건이 있는지 확인하고, 없으면 추가한다.

**4-4. TeamMatrixView — memberTasks**

현재: `t.assigneeId === memberId && t.scope === 'assigned'` 만 필터
수정: `&& !t.done` 추가

**4-5. TeamMatrixView — 완료 섹션**

현재: `t.category === 'done'` 으로 필터하고 있다면
수정: `t.done === true` 로 교체

**4-6. MatrixView (개인 모드)**

완료 섹션이 `category === 'done'` 기반이라면 `done === true`로 교체.
미완료 행(오늘/다음/남은)에 `!t.done` 명시적 추가.

**4-7. TimelineView**

기존에 `done=false` 필터가 있는지 확인. 있으면 유지, 없으면 추가.

**4-8. AllTasksView (전체 할일)**

존재한다면 done 기반 정렬/필터 확인.

---

### 작업 5: Major 버그 2건 수정

**5-1. 버그 #4 — moveTaskTo에서 keyMilestoneId 미초기화**

이미 작업 1에서 applyTransitionRules R5로 처리됨.

확인 사항:
- moveTaskTo가 내부적으로 updateTask를 호출하는지 확인
- 호출한다면 → R5가 자동 적용 → 추가 작업 불필요
- 직접 Supabase를 호출한다면 → moveTaskTo 내부에서도 applyTransitionRules 적용 필요

```bash
# moveTaskTo 함수 내부 확인
grep -n "moveTaskTo" src/store/useStore.js -A 30
```

**5-2. 버그 #7 — 팀원 행 drop 시 category 강제 'next' 제거**

**파일:** `TeamMatrixView.jsx`

팀원 행(member row)에 할일을 drop할 때의 핸들러를 찾는다:

```bash
grep -n "member\|팀원\|'next'" src/components/TeamMatrixView.jsx | head -30
```

현재: 팀원 행 drop 시 `category: 'next'` 를 강제 설정
수정: category 강제 설정을 제거하고, `{ assigneeId: memberId }` 만 전달
→ applyTransitionRules R1이 `scope: 'assigned'` 를 자동 설정
→ category는 원래 값 유지

---

## 완료 검증 체크리스트

아래 항목을 모두 통과해야 Loop-31 완료:

```
[ ] 1. applyTransitionRules 함수가 useStore.js에 존재
[ ] 2. updateTask 내부에서 applyTransitionRules가 호출됨
[ ] 3. moveTaskTo 내부에서도 applyTransitionRules가 적용됨 (직접 또는 updateTask 경유)
[ ] 4. DB에 category='done'인 행 0건 (마이그레이션 실행 확인)
[ ] 5. toggleDone이 category를 변경하지 않음 — done 필드만 토글
[ ] 6. toggleDone 완료 시 prevCategory에 이전 category 저장됨
[ ] 7. toggleDone 취소 시 prevCategory='' 초기화됨, category는 원래 값 유지
[ ] 8. 남은 할일에 category='backlog'인 할일만 표시 (category='today'/'next' 미포함)
[ ] 9. 남은 할일 → 같은 프로젝트 오늘 할일로 DnD → 정상 동작 (조기 리턴 안 됨)
[ ] 10. CompactTaskList 체크박스 클릭 시 TypeError 없음
[ ] 11. 프로젝트 간 DnD 시 keyMilestoneId가 null로 초기화됨
[ ] 12. 팀원 행 drop 시 원래 category 유지 (강제 'next' 아님)
[ ] 13. 모든 미완료 섹션에서 done=true 할일 미표시
[ ] 14. 완료 섹션에서 done=true 할일만 표시 (category 무관)
[ ] 15. 개인 모드 MatrixView 정상 동작 (회귀 없음)
[ ] 16. TodayView 정상 동작 — 전체/팀/개인 탭 모두 확인
[ ] 17. TimelineView 정상 동작 (회귀 없음)
[ ] 18. DetailPanel 카테고리 버튼 → category 변경 정상 (done과 독립)
[ ] 19. DetailPanel 담당자 배정 → scope='assigned' 자동 전환
[ ] 20. DetailPanel 담당자 해제 → scope='team' + category='backlog' 자동 전환
[ ] 21. 코드베이스에 category='done' 문자열 참조 0건
         grep -rn "category.*'done'" src/ --include="*.js" --include="*.jsx" | wc -l
         → 0 이어야 함

검증 방법:
- 각 뷰를 열어 할일이 올바른 섹션에 표시되는지 육안 확인
- DnD로 할일을 이동하며 상태 변경 확인
- 체크박스로 완료/취소 반복하며 category 유지 확인
- 담당자 배정/해제 후 scope/category 변경 확인
- Supabase Dashboard에서 tasks 테이블 직접 조회하여 데이터 정합성 확인
```

---

## 다음 Loop 예고

- **Loop-32:** 스키마 확장 — projects/key_milestones에 기간, 상태, 설명, 담당자 컬럼 추가 + RLS 정책
- **Loop-33:** UI 통합 정비 — 프로젝트/마일스톤 CRUD 모달 통합 + 새 필드 UI + 진행률 표시
