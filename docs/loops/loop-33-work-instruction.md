# Loop-33: UI 통합 정비 — 프로젝트·마일스톤 CRUD 모달 통합

> **목표:** 흩어진 프로젝트/마일스톤 CRUD UI를 통합 모달로 재구성하고, Loop-32에서 추가한 새 필드의 편집 UI를 제공한다.
> **범위:** UI 컴포넌트 신규 생성 + 기존 컴포넌트 진입점 연결. Store 로직 변경 없음.
> **선행 조건:** Loop-31 (상태 정비) + Loop-32 (스키마 확장) 완료

---

## 설계 결정 (확정)

| 항목 | 결정 |
|------|------|
| 프로젝트 설정 | **전면 모달** — 설정 + 마일스톤 목록 |
| 마일스톤 상세 | **전면 모달** — 상세 + 연결된 할일 목록 |
| 동시 열기 | **불가** — 프로젝트 모달, 마일스톤 모달, 할일 DetailPanel 중 하나만 |
| 삭제 확인 | **다이얼로그 필수** — 현재 모달 위에 오버레이 |
| 마일스톤 모달 진입점 | 프로젝트 설정 모달 + 프로젝트 뷰 + 글로벌 뷰 (확장 가능 구조) |

### 모달 네비게이션 흐름

```
사이드바 / 프로젝트 헤더 / ProjectManager
  → 프로젝트 설정 모달 열기
    → 마일스톤 행 클릭 → 마일스톤 상세 모달 (프로젝트 모달 닫힘)
      → ‹ 뒤로 → 프로젝트 설정 모달 복귀
      → 할일 행 클릭 → 할일 DetailPanel (마일스톤 모달 닫힘)
      → 삭제 버튼 → 삭제 확인 다이얼로그 (오버레이)

프로젝트 뷰 마일스톤 탭 / CompactMilestoneTab / 글로벌 뷰 (추후)
  → 마일스톤 상세 모달 직접 열기 (프로젝트 모달 경유 없이)
    → ‹ 뒤로 시: 프로젝트 모달 경유로 진입했을 때만 프로젝트 모달로 복귀
                 직접 진입했을 때는 모달 닫힘
```

---

## 작업 순서

> 작업 1(모달 매니저) → 2(프로젝트 모달) → 3(마일스톤 모달) → 4(삭제 확인) → 5(진입점 연결) → 6(기존 UI 정리)

---

### 작업 1: 모달 매니저 — 단일 모달 상태 관리

**목적:** "한 번에 하나만 열림" 규칙을 전역에서 관리하는 상태 레이어.

**1-1. Store에 모달 상태 추가**

`src/store/useStore.js` (또는 별도 `useModalStore.js`)에 모달 상태를 추가한다:

```javascript
// 모달 상태
activeModal: null,
// activeModal 값 형태:
// null — 아무것도 안 열림
// { type: 'projectSettings', projectId: '...' }
// { type: 'milestoneDetail', milestoneId: '...', returnTo: null | { type: 'projectSettings', projectId: '...' } }
// { type: 'deleteConfirm', target: 'project' | 'milestone', targetId: '...', targetName: '...', meta: {} }

// 액션
openModal: (modalState) => set({ activeModal: modalState }),
closeModal: () => set({ activeModal: null }),
```

**1-2. 모달 열기 시 기존 패널 닫기**

openModal 호출 시:
- 할일 DetailPanel이 열려 있으면 닫는다 (기존 selectedTaskId를 null로)
- 다른 모달이 열려 있으면 교체된다 (activeModal 덮어쓰기)

할일 DetailPanel 열기 시:
- activeModal이 있으면 null로 닫는다

```javascript
openModal: (modalState) => set({ activeModal: modalState, selectedTaskId: null }),
selectTask: (taskId) => set({ selectedTaskId: taskId, activeModal: null }),
```

> 주의: selectedTaskId가 현재 할일 DetailPanel을 여는 상태 키인지 확인. 실제 키 이름은 코드에서 확인 후 맞춘다.

**1-3. 모달 렌더링 컨테이너**

앱의 최상위 레이아웃(App.jsx 또는 Layout.jsx)에 모달 렌더링 영역을 추가한다:

```jsx
// App.jsx 또는 Layout.jsx 하단
{activeModal && <ModalRouter />}
```

**1-4. ModalRouter 컴포넌트 생성**

```
src/components/modals/ModalRouter.jsx
```

```jsx
// activeModal.type에 따라 해당 모달 컴포넌트를 렌더링
// 'projectSettings' → <ProjectSettingsModal />
// 'milestoneDetail' → <MilestoneDetailModal />
// 'deleteConfirm' → <DeleteConfirmDialog />
```

모달 바깥 영역(backdrop) 클릭 시 closeModal() 호출.
deleteConfirm은 기존 모달 위에 오버레이로 렌더링 (별도 z-index 레이어).

---

### 작업 2: 프로젝트 설정 모달

**파일:** `src/components/modals/ProjectSettingsModal.jsx` (신규)

**2-1. 레이아웃 구조**

```
┌─────────────────────────────┐
│ 헤더: "프로젝트 설정"    [×] │
├─────────────────────────────┤
│ 프로젝트 이름 (input)        │
│ 색상 (color dots)           │
│ 오너 (드롭다운)              │
│ 상태 (칩: 진행중/보류/완료/보관) │  ← NEW
│ 기간 (시작일 ~ 마감일)        │  ← NEW
│ 진행률 (bar + 텍스트)         │  계산값, 읽기전용
│ 설명 (textarea)             │  ← NEW
│─────────────────────────────│
│ 마일스톤 (N)                 │
│  ┌ dot ─ 이름 ─ 담당자·기간·상태 ─ 진행률 ─ › ┐  │
│  │ ... 반복 ...                              │  │
│  └───────────────────────────────────────────┘  │
│  + N개 더 보기 (5개 초과 시)   │
│─────────────────────────────│
│ [보관]  [삭제]               │
└─────────────────────────────┘
```

**2-2. 데이터 로딩**

```javascript
const project = useStore(s => s.projects.find(p => p.id === projectId));
const milestones = useStore(s => s.milestones?.filter(m => m.projectId === projectId) || []);
const tasks = useStore(s => s.tasks.filter(t => t.projectId === projectId));
```

**2-3. 진행률 계산**

```javascript
// 마일스톤 기반 진행률
const completedMs = milestones.filter(m => m.status === 'completed').length;
const progress = milestones.length > 0 ? Math.round((completedMs / milestones.length) * 100) : 0;
```

**2-4. 필드 변경 핸들러**

각 필드 변경 시 Store의 updateProject(projectId, patch)를 호출한다.
자동 저장 (debounce 300ms for text fields, 즉시 for 선택형):

```javascript
// 이름, 설명 → debounce
// 색상, 오너, 상태, 기간 → 즉시 저장
const handleChange = (field, value) => {
  updateProject(projectId, { [field]: value });
};
```

> updateProject 함수가 없으면 updateTask와 유사한 패턴으로 Store에 추가. 이미 있다면 새 필드를 허용하는지 확인 (Loop-32에서 처리됨).

**2-5. 마일스톤 목록 행**

각 마일스톤 행에 표시할 정보:
- color dot
- title
- owner 이름 (또는 "미배정")
- 기간 (시작 ~ 마감)
- status 칩
- 진행률 bar + %
- `›` 클릭 시 마일스톤 모달 열기

```javascript
const handleMilestoneClick = (milestoneId) => {
  openModal({
    type: 'milestoneDetail',
    milestoneId,
    returnTo: { type: 'projectSettings', projectId }
  });
};
```

**2-6. 마일스톤 목록 기본 5개 표시, "+ N개 더 보기"로 확장**

```javascript
const [showAll, setShowAll] = useState(false);
const visibleMs = showAll ? milestones : milestones.slice(0, 5);
```

**2-7. 보관/삭제 버튼**

```javascript
// 보관: updateProject(projectId, { is_archived: true })
// → 모달 닫기 후 목록에서 제거 (또는 보관된 프로젝트 섹션으로 이동)

// 삭제: 삭제 확인 다이얼로그 열기
const handleDelete = () => {
  openModal({
    type: 'deleteConfirm',
    target: 'project',
    targetId: projectId,
    targetName: project.name,
    meta: {
      milestoneCount: milestones.length,
      taskCount: tasks.length,
      returnTo: null  // 삭제 후 모달 닫힘
    }
  });
};
```

---

### 작업 3: 마일스톤 상세 모달

**파일:** `src/components/modals/MilestoneDetailModal.jsx` (신규)

**3-1. 레이아웃 구조**

```
┌──────────────────────────────────────────┐
│ [‹] 마일스톤 상세       [프로젝트뱃지] [삭제] [×] │
├──────────────────────────────────────────┤
│ 제목 (input, 큰 글씨)                      │
│ 색상 (color dots)                  ← NEW │
│ 담당자 (드롭다운)                    ← NEW │
│ 상태 (칩: 시작전/진행중/완료)          ← NEW │
│ 기간 (시작일 ~ 마감일)                      │
│ 진행률 (bar + 텍스트)                 계산값 │
│ 설명 (textarea)                          │
│──────────────────────────────────────────│
│ 연결된 할일 (N)                            │
│  ┌ □ ─ 할일이름 ─ [카테고리칩] ─ 담당자 ┐     │
│  │ ... 반복 ...                        │     │
│  └─────────────────────────────────────┘     │
│  + 할일 추가                                │
└──────────────────────────────────────────┘
```

**3-2. 핵심 설계: 진입점에 따른 뒤로 버튼 동작**

```javascript
// activeModal.returnTo가 있으면 → 뒤로 버튼으로 해당 모달 복귀
// returnTo가 없으면 → 뒤로 버튼으로 모달 닫힘

const handleBack = () => {
  if (activeModal.returnTo) {
    openModal(activeModal.returnTo);  // 프로젝트 설정 모달로 복귀
  } else {
    closeModal();  // 직접 진입이었으면 그냥 닫힘
  }
};
```

이 구조 덕분에 **어디서 진입하든 동일한 모달 컴포넌트**를 사용하되, 뒤로 가기 동작만 달라진다:

```javascript
// 프로젝트 설정 모달에서 진입:
openModal({ type: 'milestoneDetail', milestoneId, returnTo: { type: 'projectSettings', projectId } });

// 프로젝트 뷰 마일스톤 탭에서 직접 진입:
openModal({ type: 'milestoneDetail', milestoneId, returnTo: null });

// 글로벌 뷰에서 진입 (추후):
openModal({ type: 'milestoneDetail', milestoneId, returnTo: null });
```

**3-3. 데이터 로딩**

```javascript
const milestone = useStore(s => s.milestones?.find(m => m.id === milestoneId));
const project = useStore(s => s.projects.find(p => p.id === milestone?.projectId));
const linkedTasks = useStore(s => s.tasks.filter(t => t.keyMilestoneId === milestoneId));
```

**3-4. 진행률 계산**

```javascript
const doneTasks = linkedTasks.filter(t => t.done).length;
const progress = linkedTasks.length > 0 ? Math.round((doneTasks / linkedTasks.length) * 100) : 0;
```

**3-5. 필드 변경 핸들러**

```javascript
const handleChange = (field, value) => {
  updateMilestone(milestoneId, { [field]: value });
};
```

새 필드: owner_id, status, color

기존 필드: title, description, start_date, end_date

> updateMilestone 함수가 Store에 있는지 확인. 없으면 추가.

**3-6. 연결된 할일 목록**

각 할일 행에 표시:
- 체크박스 (done 토글 — toggleDone 호출)
- 할일 이름
- 카테고리 칩 (today=노란, next=파란, backlog=회색)
- 담당자 이름 (또는 "미배정")

할일 행 클릭 시 → 할일 DetailPanel 열기:
```javascript
const handleTaskClick = (taskId) => {
  closeModal();  // 마일스톤 모달 닫힘
  selectTask(taskId);  // 할일 DetailPanel 열림
};
```

**3-7. "+ 할일 추가" 버튼**

```javascript
const handleAddTask = () => {
  addTask({
    projectId: milestone.projectId,
    keyMilestoneId: milestoneId,
    category: 'backlog',
    // 팀 할일이면 scope: 'team', teamId 설정
    // 개인이면 scope: 'private'
  });
};
```

> addTask의 현재 시그니처를 확인하여 맞춤.

**3-8. 프로젝트 뱃지**

헤더에 소속 프로젝트 표시:
```jsx
<span className="project-badge" onClick={() => openModal({ type: 'projectSettings', projectId: project.id })}>
  <span className="dot" style={{ background: project.color }} />
  {project.name}
</span>
```

**3-9. 삭제 버튼**

```javascript
const handleDelete = () => {
  openModal({
    type: 'deleteConfirm',
    target: 'milestone',
    targetId: milestoneId,
    targetName: milestone.title,
    meta: {
      taskCount: linkedTasks.length,
      returnTo: activeModal.returnTo  // 삭제 후 프로젝트 모달로 복귀 (있으면)
    }
  });
};
```

---

### 작업 4: 삭제 확인 다이얼로그

**파일:** `src/components/modals/DeleteConfirmDialog.jsx` (신규)

**4-1. 레이아웃**

```
┌─────────────────────────┐
│      ⚠ (아이콘)          │
│                          │
│   {대상}을 삭제하시겠습니까?  │
│                          │
│  [경고 박스] (프로젝트일 때)  │
│  "N개 마일스톤과 M개 할일이  │
│   모두 삭제됩니다."        │
│                          │
│  [안내] (마일스톤일 때)      │
│  "N개 할일의 마일스톤 연결이  │
│   해제됩니다."            │
│                          │
│   [취소]  [삭제]          │
└─────────────────────────┘
```

**4-2. 오버레이 렌더링**

deleteConfirm은 ModalRouter에서 **기존 모달과 별도 레이어**로 렌더링한다.
즉, deleteConfirm이 열려 있어도 뒤에 프로젝트/마일스톤 모달이 보인다 (dimmed).

```jsx
// ModalRouter.jsx
return (
  <>
    {activeModal?.type === 'projectSettings' && <ProjectSettingsModal />}
    {activeModal?.type === 'milestoneDetail' && <MilestoneDetailModal />}
    {activeModal?.type === 'deleteConfirm' && (
      <>
        {/* 뒤에 원래 모달이 있었다면 유지 — 실제로는 activeModal이 교체되므로
            deleteConfirm 열기 전 이전 모달 상태를 meta.returnTo에 저장하여 처리 */}
        <DeleteConfirmDialog />
      </>
    )}
  </>
);
```

> 구현 팁: deleteConfirm을 activeModal에 넣으면 이전 모달이 사라진다. 대안으로 `confirmDialog`를 별도 상태로 관리:

```javascript
// Store
confirmDialog: null,  // { target, targetId, targetName, meta }
openConfirmDialog: (state) => set({ confirmDialog: state }),
closeConfirmDialog: () => set({ confirmDialog: null }),
```

이렇게 하면 프로젝트/마일스톤 모달이 열린 상태에서 confirmDialog가 위에 오버레이로 뜬다.

**4-3. 삭제 실행**

```javascript
const handleConfirmDelete = async () => {
  if (target === 'project') {
    await deleteProject(targetId);
    closeConfirmDialog();
    closeModal();  // 프로젝트 모달도 닫힘
  } else if (target === 'milestone') {
    await deleteMilestone(targetId);
    closeConfirmDialog();
    // returnTo가 있으면 프로젝트 모달로 복귀
    if (meta.returnTo) {
      openModal(meta.returnTo);
    } else {
      closeModal();
    }
  }
};

const handleCancel = () => {
  closeConfirmDialog();
  // 기존 모달은 그대로 유지
};
```

**4-4. 프로젝트 삭제 시 경고 메시지**

```
"이 프로젝트에 연결된 {milestoneCount}개 마일스톤과 {taskCount}개 할일이 모두 삭제됩니다.
 이 작업은 되돌릴 수 없습니다."
```

빨간 배경 경고 박스로 표시.

**4-5. 마일스톤 삭제 시 안내 메시지**

```
"'{targetName}' 마일스톤을 삭제하면 연결된 {taskCount}개 할일의 마일스톤 연결이 해제됩니다.
 할일 자체는 삭제되지 않습니다."
```

일반 텍스트로 표시.

---

### 작업 5: 진입점 연결

**5-1. 프로젝트 설정 모달 진입점**

3곳에서 프로젝트 설정 모달을 열 수 있도록 연결한다:

**A. 사이드바 프로젝트 항목 컨텍스트 메뉴 (또는 ... 버튼)**

```bash
# 사이드바에서 프로젝트 관련 컴포넌트 찾기
grep -rn "프로젝트\|project" src/components/Sidebar* src/components/sidebar* --include="*.jsx" -l
```

해당 컴포넌트에 "설정" 메뉴 항목 추가:
```javascript
onClick={() => openModal({ type: 'projectSettings', projectId })
```

**B. 프로젝트 헤더 (ProjectHeader)**

```bash
grep -rn "ProjectHeader" src/components/ --include="*.jsx" -l
```

기존 톱니/설정 아이콘이 있으면 해당 onClick을 연결.
없으면 헤더에 톱니 아이콘 추가.

**C. ProjectManager 모달 내부**

기존 ProjectManager에서 프로젝트별 편집/설정 버튼이 있으면 해당 onClick을 연결.
ProjectManager의 기존 인라인 편집(이름, 색상)은 **유지하되**, "상세 설정" 버튼을 추가하여 새 모달로 이동 가능하게 한다.

```javascript
// ProjectManager 내부 각 프로젝트 행에 톱니 아이콘 추가
onClick={() => openModal({ type: 'projectSettings', projectId })}
```

**5-2. 마일스톤 상세 모달 진입점**

**A. 프로젝트 설정 모달 마일스톤 목록 (작업 2에서 이미 구현)**

**B. 프로젝트 뷰 CompactMilestoneTab**

```bash
grep -rn "CompactMilestoneTab\|KeyMilestoneTab\|MilestoneHeader" src/components/ --include="*.jsx" -l
```

마일스톤 제목 또는 ... 메뉴에 "상세" 항목 추가:
```javascript
onClick={() => openModal({ type: 'milestoneDetail', milestoneId, returnTo: null })}
```

> returnTo: null → 뒤로 가기 시 모달 닫힘 (프로젝트 모달 경유 아님)

**C. 글로벌 뷰 (추후 연결용 — 이번 Loop에서는 구조만)**

MatrixView, TodayView 등에서 마일스톤 관련 UI가 있다면 진입점을 추가할 수 있지만, 이번 Loop에서는 **openModal 호출 구조만 확보**하고 실제 UI 버튼 추가는 하지 않는다.

향후 연결 시:
```javascript
// 어디서든 이 한 줄이면 마일스톤 모달이 열림
openModal({ type: 'milestoneDetail', milestoneId, returnTo: null });
```

**5-3. 할일 DetailPanel에서 마일스톤 연결 클릭**

현재 DetailPanel에 마일스톤 선택 UI(MilestoneSelector)가 있다면, 선택된 마일스톤 이름 클릭 시 마일스톤 모달을 여는 진입점을 추가한다:

```javascript
// 마일스톤 이름 클릭
onClick={() => openModal({ type: 'milestoneDetail', milestoneId: task.keyMilestoneId, returnTo: null })}
```

---

### 작업 6: 기존 UI 정리

**6-1. 기존 기능 유지, 중복 제거**

기존 ProjectManager의 인라인 편집(이름, 색상, 삭제)은 **유지**한다.
- ProjectManager는 프로젝트 목록 관리(순서 변경, 생성, 빠른 편집)에 특화
- 새 프로젝트 설정 모달은 상세 설정에 특화
- 두 UI가 공존하되 역할이 다름

**6-2. 기존 OwnerDropdown**

ProjectHeader의 OwnerDropdown은 유지한다.
프로젝트 설정 모달에서도 동일한 OwnerDropdown 컴포넌트를 재사용한다.

**6-3. 마일스톤 삭제 — 확인 다이얼로그 적용**

기존 MilestoneHeader의 ✕ 버튼(확인 없이 즉시 삭제)을 수정:
```javascript
// 기존:
onClick={() => deleteMilestone(milestoneId)}

// 수정:
onClick={() => openConfirmDialog({
  target: 'milestone',
  targetId: milestoneId,
  targetName: milestone.title,
  meta: { taskCount: linkedTasks.length, returnTo: null }
})}
```

**6-4. 마일스톤 인라인 편집 유지**

MilestoneHeader의 제목/설명/날짜 인라인 편집은 유지한다.
마일스톤 상세 모달과 MilestoneHeader 인라인 편집이 같은 Store 데이터를 공유하므로 자동 동기화된다.

---

## 스타일 가이드

### 모달 공통

```css
/* 배경 오버레이 */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
  z-index: 1000;
}

/* 모달 컨테이너 */
.modal-container {
  background: var(--color-background-primary);
  border-radius: 12px;
  border: 0.5px solid var(--color-border-tertiary);
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

/* 삭제 확인 다이얼로그 */
.confirm-backdrop {
  z-index: 1100;  /* 모달 위에 */
}

.confirm-dialog {
  max-width: 380px;
  text-align: center;
}
```

### 상태 칩 색상

```
진행 중 (active):    bg #EAF3DE, text #27500A, border #97C459
보류 (on_hold):     bg #FAEEDA, text #633806, border #FAC775
완료 (completed):   bg #E1F5EE, text #085041, border #5DCAA5
보관 (archived):    bg #F1EFE8, text #444441, border #B4B2A9

시작 전 (not_started): bg #F1EFE8, text #444441, border #B4B2A9
진행 중 (in_progress): bg #E6F1FB, text #0C447C, border #85B7EB
완료 (completed):      bg #E1F5EE, text #085041, border #5DCAA5
```

### 카테고리 칩 (할일 목록 내)

```
오늘 (today):   bg #FAEEDA, text #633806
다음 (next):    bg #E6F1FB, text #0C447C
남은 (backlog): bg #F1EFE8, text #444441
```

### 진행률 바

```
높이: 5~6px, border-radius: 3px
배경: var(--color-background-secondary)
채움: 마일스톤/프로젝트 color 또는 기본 #5DCAA5
```

### 삭제 경고 박스 (프로젝트 삭제 시)

```
bg: #FCEBEB, text: #791F1F, border-radius: 6px, padding: 8px 12px
```

---

## 파일 구조

```
src/components/modals/
├── ModalRouter.jsx          ← 모달 타입별 라우팅
├── ProjectSettingsModal.jsx ← 프로젝트 설정 통합 모달
├── MilestoneDetailModal.jsx ← 마일스톤 상세 통합 모달
└── DeleteConfirmDialog.jsx  ← 삭제 확인 다이얼로그
```

---

## 완료 검증 체크리스트

```
[ ] 1. ModalRouter가 App/Layout 최상위에 렌더링됨
[ ] 2. activeModal 상태가 Store에 존재하고 openModal/closeModal 동작
[ ] 3. 프로젝트 모달, 마일스톤 모달, 할일 DetailPanel 중 하나만 열림 확인
[ ] 4. 프로젝트 설정 모달:
       - 이름, 색상, 오너 편집 → 즉시 저장 확인
       - 상태 칩 선택 → status 저장 확인
       - 기간 입력 → start_date, due_date 저장 확인
       - 설명 입력 → description 저장 확인
       - 진행률 바 = 완료 마일스톤 / 전체 마일스톤 정확
       - 마일스톤 목록 표시 (이름, 담당자, 기간, 상태, 진행률)
       - 마일스톤 클릭 → 마일스톤 모달 열림, 프로젝트 모달 닫힘
       - 5개 초과 시 "+ N개 더 보기" 동작
[ ] 5. 마일스톤 상세 모달:
       - 제목 편집 → 즉시 저장
       - 색상, 담당자, 상태 편집 → 저장 확인 (NEW 필드)
       - 기간 편집 → start_date, end_date 저장
       - 설명 편집 → description 저장
       - 진행률 바 = 완료 할일 / 전체 할일 정확
       - 연결된 할일 목록 (체크박스, 이름, 카테고리 칩, 담당자)
       - 체크박스 클릭 → toggleDone 동작
       - 할일 클릭 → 할일 DetailPanel 열림, 마일스톤 모달 닫힘
       - "+ 할일 추가" → 마일스톤에 연결된 새 할일 생성
       - 프로젝트 뱃지 표시 + 클릭 시 프로젝트 설정 모달 열림
[ ] 6. ‹ 뒤로 버튼:
       - 프로젝트 모달 경유 진입 → 프로젝트 모달로 복귀
       - 직접 진입 → 모달 닫힘
[ ] 7. 삭제 확인 다이얼로그:
       - 프로젝트 삭제 시 빨간 경고 박스 + 마일스톤/할일 수 표시
       - 마일스톤 삭제 시 안내 메시지 + 할일 수 표시
       - "취소" → 기존 모달로 복귀
       - "삭제" → 삭제 실행 후 적절한 화면으로 이동
[ ] 8. 진입점:
       - 사이드바 프로젝트 ... 메뉴 → 프로젝트 설정 모달
       - 프로젝트 헤더 톱니 → 프로젝트 설정 모달
       - ProjectManager 행 → 프로젝트 설정 모달
       - CompactMilestoneTab 마일스톤 제목 → 마일스톤 모달
       - 프로젝트 설정 모달 마일스톤 행 → 마일스톤 모달
       - DetailPanel 마일스톤 이름 클릭 → 마일스톤 모달
[ ] 9. 기존 MilestoneHeader ✕ 삭제 → 삭제 확인 다이얼로그 경유
[ ] 10. 기존 기능 회귀 없음:
        - ProjectManager 인라인 편집 (이름, 색상) 정상
        - ProjectManager 생성/삭제 정상
        - MilestoneHeader 인라인 편집 (제목, 설명, 날짜) 정상
        - CompactMilestoneTab DnD 할일 연결 정상
        - 할일 DetailPanel 정상 동작
        - MatrixView, TodayView, TimelineView 회귀 없음
[ ] 11. 빌드 성공, 에러 0건
```

---

## 다음 단계

- **Loop-34 이후 (잔여 정비):** Minor 버그 수정, DnD silent failure 토스트, 글로벌 뷰에서 마일스톤 모달 진입점 추가, MS-Project 교차 참조 검증
