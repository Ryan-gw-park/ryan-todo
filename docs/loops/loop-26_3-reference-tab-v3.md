# Loop-26.3 수정 (v3) — Reference 단순화 + 상세패널 연동

## 목표

1. **결과물-Task 매핑 제거** — Task는 마일스톤에만 연결. 결과물은 순수 참조 정보.
2. **우측 Task 패널 단순화** — 마일스톤별 flat 목록 (결과물별 그룹핑 없음)
3. **상세패널(DetailPanel) 연동** — Task 클릭 시 상세패널 열기, Task 추가 시 상세패널 자동 열기

---

## 변경 요약

### Before (현재 구현)
- 결과물과 Task가 `deliverable_id`로 매핑
- 우측 Task 패널에 결과물별 그룹핑 시도
- Task 추가 후 상세패널 미연동
- "미연결 결과물 N건" 경고 배지

### After
- Task는 `ref_milestone_id`로 마일스톤에만 연결
- `deliverable_id` 사용하지 않음
- 결과물은 왼쪽에서 확인만 하는 Anchor 역할
- 우측 Task는 마일스톤별 flat 목록
- Task 클릭 → 상세패널 열기
- Task 추가 → 상세패널 자동 열기

---

## 1. DB 변경

### 제거 (또는 무시)

`tasks.deliverable_id` 컬럼은 **삭제하지 않되 사용하지 않는다.**  
이미 추가된 컬럼을 삭제하면 마이그레이션 리스크가 있으므로, 코드에서 참조하지 않으면 된다.

### 유지

`tasks.ref_milestone_id` — 이 컬럼만 Task↔마일스톤 연결에 사용.

---

## 2. useStore.js 변경

### mapTask

```javascript
// 기존 유지
refMilestoneId: r.ref_milestone_id || null,

// deliverableId는 제거하거나 남겨둬도 무방 (사용하지 않음)
// deliverableId: r.deliverable_id || null,  ← 이 줄 제거 또는 주석
```

### taskToRow

```javascript
// 기존 유지
ref_milestone_id: t.refMilestoneId || null,

// deliverable_id 제거
// deliverable_id: t.deliverableId || null,  ← 이 줄 제거 또는 주석
```

---

## 3. ReferenceTab.jsx 변경

### 좌측 패널 (변경 없음)
마일스톤 > 결과물 계층 구조 그대로 유지.
결과물은 1줄 항목 + 상태 태그(진행중/완료/대기) 클릭 순환.

### 우측 패널 (단순화)

결과물별 그룹핑 **제거**. 마일스톤에 연결된 모든 Task를 flat 목록으로 표시.

```
● 소집통지 발송 완료           │ □ 소집통지 메일 발송         Ethan  ✕
  주주 1% 이상 이메일...       │ □ 1% 이상 주주 연락         Ethan  ✕
  2026.03.10 → 03.20 D-5      │ ✓ 주주분류 확인             Ash    ✕
  1  소집통지서 + 공고문       │ + Task 추가
  + 결과물 추가                │
```

- 결과물 태그(`tk-dvtag`) 제거 — Task 옆에 결과물명 표시하지 않음
- "미연결 결과물 N건" 경고 제거
- "⚠ Task 없음" 경고는 유지 — 마일스톤에 Task가 하나도 없을 때만

### Task 조회 로직

```javascript
// 우측 패널: 해당 마일스톤에 연결된 Task 조회
const milestoneTasks = tasks.filter(t =>
  t.refMilestoneId === milestone.id && !t.deletedAt
)
```

### Task 추가 로직

```javascript
async function handleAddTask(milestoneId) {
  const newTask = await addTask({
    text: '',
    projectId: projectId,
    refMilestoneId: milestoneId,
    // deliverableId 설정하지 않음
    category: 'today',
  })
  // ★ 상세패널 즉시 열기
  if (newTask) {
    setDetailTask(newTask)
  }
}
```

---

## 4. 상세패널(DetailPanel) 연동 ★

### Task 클릭 → 상세패널 열기

우측 Task 목록에서 Task 텍스트 또는 행 영역을 클릭하면 상세패널이 열린다.

```jsx
function TaskRow({ task, milestone }) {
  const { toggleDone, setDetailTask, deleteTask } = useStore()

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '3px 4px', borderRadius: 4, cursor: 'pointer',
      }}
      onClick={() => setDetailTask(task)}  // ★ 클릭 시 상세패널
    >
      <div
        className={`tk-cb ${task.done ? 'dn' : ''}`}
        onClick={(e) => {
          e.stopPropagation()  // 상세패널 열지 않고 완료 토글만
          toggleDone(task.id)
        }}
      />
      <input
        value={task.text}
        onChange={e => { /* 인라인 편집 */ }}
        onClick={e => e.stopPropagation()}  // input 클릭 시 상세패널 안 열림
        onBlur={handleSave}
        style={{ flex: 1, fontSize: 12, border: 'none', outline: 'none', background: 'transparent' }}
        placeholder="Task 이름 입력..."
      />
      <AssigneePill assigneeId={task.assigneeId} />
      <button
        className="del-btn"
        onClick={(e) => {
          e.stopPropagation()  // 삭제 시 상세패널 안 열림
          deleteTask(task.id)
        }}
      >✕</button>
    </div>
  )
}
```

**클릭 영역 규칙:**
- 행 전체 클릭 → `setDetailTask(task)` → 상세패널 열기
- 체크박스 클릭 → `toggleDone()` only (stopPropagation)
- input 클릭 → 인라인 편집 모드 (stopPropagation)
- ✕ 클릭 → `deleteTask()` only (stopPropagation)

### Task 추가 → 상세패널 자동 열기

"+ Task 추가" 클릭 시:
1. `addTask()` 호출하여 빈 Task 생성 (text: '', category: 'today')
2. 생성된 Task로 `setDetailTask()` 호출
3. 상세패널에서 제목, 담당자, 날짜, 노트 등 상세 편집

```javascript
async function handleAddTask(milestoneId) {
  // 1. Task 생성
  const taskId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
  const newTask = {
    id: taskId,
    text: '',
    projectId: projectId,
    refMilestoneId: milestoneId,
    category: 'today',
    sortOrder: Date.now(),
  }
  await addTask(newTask)

  // 2. 상세패널 열기
  // addTask 후 store의 tasks에서 방금 추가된 Task를 찾아서 전달
  const created = useStore.getState().tasks.find(t => t.id === taskId)
  if (created) {
    useStore.getState().setDetailTask(created)
  }
}
```

> **주의:** `addTask`는 async이고 optimistic UI로 즉시 store에 반영되므로,
> 호출 직후 `getState().tasks`에서 찾을 수 있다.
> 만약 찾지 못하면 약간의 delay 후 재시도하거나, addTask의 반환값을 활용.

---

## 5. 프로젝트 헤더 배지 변경

### Before
```
병렬 보기 [미배정 3]  ← 결과물-Task 미연결 기반
```

### After
```
병렬 보기  ← 배지 제거 (또는 다른 기준으로 변경)
```

결과물-Task 매핑이 없으므로 "미배정" 카운트의 근거가 사라진다.  
대신 **Task가 0인 마일스톤 수**를 배지로 표시할 수 있다:

```javascript
const emptyMilestoneCount = milestones.filter(ms =>
  tasks.filter(t => t.refMilestoneId === ms.id && !t.deletedAt).length === 0
).length

// 배지: emptyMilestoneCount > 0 ? `미배정 ${emptyMilestoneCount}` : null
```

---

## 6. Tasks 탭 변경

### 결과물 태그 제거

Tasks 탭 목록 모드에서 Task 옆에 표시하던 결과물명 태그(`<span class="tdv">`) **제거**.

```jsx
// Before
<span className="tdv">{deliverableName}</span>

// After
// 제거. Task 행에 결과물 관련 표시 없음.
```

### Reference 요약 바 변경

```
// Before
다음 마일스톤: 소집통지 발송 — 3/20 (D-5)  [미연결 결과물 2건]

// After
다음 마일스톤: 소집통지 발송 — 3/20 (D-5)
// "미연결 결과물" 경고 제거
```

---

## 수정 대상 파일

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/components/project/ReferenceTab.jsx` | 우측 패널 단순화 + 상세패널 연동 | M |
| `src/hooks/useStore.js` | mapTask/taskToRow에서 deliverableId 제거 | S |
| `src/components/project/ProjectHeader.jsx` | 병렬 보기 배지 로직 변경 | S |
| `src/components/project/tasks/TaskListMode.jsx` | 결과물 태그 제거, 요약 바 변경 | S |

## 수정 금지

- `src/components/shared/DetailPanel.jsx` — 기존 그대로 사용
- `src/components/shared/OutlinerEditor.jsx` — 절대 수정 금지
- `src/hooks/useOutliner.js` — 절대 수정 금지
- 기존 store 액션 시그니처 (addTask, updateTask, deleteTask, toggleDone, setDetailTask)

---

## 검증 체크리스트

### Reference 탭
- [ ] 좌측: 마일스톤 > 결과물 계층 정상
- [ ] 결과물은 확인용 (Task 매핑 없음)
- [ ] 결과물 상태 태그 클릭 순환 (진행중/완료/대기) 정상
- [ ] 우측: 마일스톤별 Task flat 목록 (결과물별 그룹핑 없음)
- [ ] 우측 Task 행 클릭 → **상세패널 열림** ★
- [ ] 우측 Task 체크박스 클릭 → 완료 토글 (상세패널 안 열림)
- [ ] 우측 Task input 클릭 → 인라인 편집 (상세패널 안 열림)
- [ ] 우측 Task ✕ 클릭 → 삭제 (상세패널 안 열림)
- [ ] + Task 추가 → 새 Task 생성 + **상세패널 자동 열림** ★
- [ ] 상세패널에서 노트 편집 → 저장 정상
- [ ] 상세패널 닫기 후 Reference 탭 상태 유지

### 데이터 동기화
- [ ] Reference에서 Task 추가 → 글로벌 오늘할일에 즉시 반영
- [ ] Reference에서 Task 완료 → 글로벌 매트릭스에 즉시 반영
- [ ] 글로벌 뷰에서 Task 수정 → Reference 우측에 즉시 반영

### 제거 확인
- [ ] 결과물-Task 연결 UI 없음 확인
- [ ] 결과물 태그(tk-dvtag) Tasks 탭에서 제거 확인
- [ ] "미연결 결과물 N건" 경고 제거 확인

### 회귀 검증
- [ ] 기존 글로벌 뷰 5개 정상
- [ ] DetailPanel 정상 (슬라이드인 + 노트 + 댓글)
- [ ] 프로젝트 전환 시 정상
- [ ] `npm run build` 성공

---

## 주의사항

- **결과물은 데이터 연결 없이 시각적 Anchor로만 존재.** 결과물 테이블(ref_deliverables)은 유지하되 tasks와 FK 관계를 사용하지 않음.
- **`tasks.deliverable_id` 컬럼은 DB에서 삭제하지 않음.** 코드에서 참조하지 않으면 됨. 추후 필요하면 활용 가능.
- **상세패널은 기존 `setDetailTask(task)` 호출만으로 열림.** DetailPanel.jsx 내부 수정 없음.
- **Task 추가 시 `addTask()` 시그니처 확인.** 기존 `addTask(taskObject)` 패턴에 `refMilestoneId` 필드가 포함되도록 taskToRow에서 `ref_milestone_id`로 매핑되는지 확인.
