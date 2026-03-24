# 종합 분석: Loop 26 고아 커밋 복구 + 개선 6건 실행 계획 (v2)

> 작성일: 2026-03-16
> 근거: git diff master 7f90d07 실제 출력 기반 분석
> 상황: Master(198cd2e)와 Loop 26(7f90d07)이 de6fbd3에서 분기. 양쪽 모두 유효한 변경 포함.

---

## Part A: 분기 현황 + 충돌 파일별 실제 차이

### 분기 구조

```
de6fbd3 (UI/UX improvements) ← 공통 조상
    │
    ├── Master (3 커밋)
    │   ├── 5fa08cc  팀/개인 프로젝트 섹션 통합 리오더
    │   ├── 0e3df78  Matrix DnD: matrixCollision 커스텀 충돌 감지
    │   └── 198cd2e  DnD 속도 향상: distance:3, transition:120ms
    │   └── (워킹트리 미커밋) Sidebar.jsx S 객체 + localStorage + 알림뱃지
    │
    └── Loop 26 고아 (2 커밋)
        ├── 747b4c8  iOS PWA 콜드 스타트 최적화 + Vercel 마이그레이션
        └── 7f90d07  Loop 26: Project Layer + Key Milestone + Tasks
```

> **중요 발견:** Master에 Sidebar.jsx가 워킹트리(미커밋)로 존재한다. 
> Loop 26에도 Sidebar.jsx가 커밋되어 있다. 양쪽 내용이 다르다.

### 통계: 59 files changed, 12,734 insertions, 554 deletions

---

### 충돌 파일 8개 상세 분석 (실제 diff 기반)

#### 1. src/App.jsx — 양쪽 모두 레이아웃 구조 변경

| 영역 | Master | Loop 26 | 채택 |
|------|--------|---------|------|
| TopNav import | 있음 | **제거됨** → Sidebar import | Loop 26 |
| ProjectLayer lazy import | 없음 | **추가됨** | Loop 26 |
| views 객체 | 6개 뷰 | **+projectLayer: ProjectLayer** | Loop 26 |
| 레이아웃 | TopNav 상단 + 세로 배치 | **flex: Sidebar 좌측 + 메인 우측** | Loop 26 |
| FAB | 항상 표시 | **모바일만** `{mobile && <FAB />}` | Loop 26 |
| snapshotRestored state | 없음 | **추가됨** | Loop 26 |
| restoreSnapshot 호출 | initTeamState 내부 | **useEffect에서 Auth 전 호출** | Loop 26 |
| teamId 불일치 검증 | 없음 | **snapshotTeamId !== actualTeamId → 데이터 비움** | Loop 26 |
| clearSnapshot (Auth 실패) | 없음 | **useEffect로 자동 처리** | Loop 26 |
| 스냅샷 있으면 AppShell 즉시 표시 | 없음 | **Step 2에서 Routes 렌더링** | Loop 26 |

**결론: Loop 26 버전을 기본 채택.** 단, Master 워킹트리의 Sidebar가 이미 같은 레이아웃 구조(flex + Sidebar)를 사용하므로 구조적 충돌은 적음.

#### 2. src/hooks/useStore.js — 핵심 충돌 (diff 83줄 변경)

**Loop 26에서 추가된 것 (모두 채택):**

```
taskToRow: +key_milestone_id (L69), +deliverable_id (L70)
mapTask: +keyMilestoneId (L123), +deliverableId (L124)
state: +snapshotTeamId (L171), +snapshotRestored (L172)
restoreSnapshot: teamId 검증 제거 → snapshotTeamId/snapshotRestored로 지연 검증
+clearSnapshot(): snapshotRestored=false, 데이터 비움, localStorage 삭제
logout: localStorage.removeItem → get().clearSnapshot()
updateProject: +safePatch (teamId/userId/created_by/id 제외)
deleteProject: +팀장 권한 가드 + 개인 프로젝트 소유자 확인
+sidebarCollapsed: false, +toggleSidebar
+selectedProjectId, +projectLayerTab ('milestone'|'tasks'|'ptimeline')
+projectTimelineMode ('gantt'|'detail')
+enterProjectLayer(projectId), +setProjectLayerTab(tab), +setProjectTimelineMode(mode)
```

**Master와 충돌하는 부분:**

| 항목 | Master | Loop 26 | 채택 |
|------|--------|---------|------|
| sidebarCollapsed | localStorage 연동 + 토글 | `false` + 단순 토글 | **Master** (localStorage 유지) |

**결론: Loop 26의 모든 추가분을 채택하되, sidebarCollapsed만 Master 방식으로.**

#### 3. src/components/matrix/TeamMatrixView.jsx — DnD 설정 반대 방향

| 항목 | Master | Loop 26 | 채택 |
|------|--------|---------|------|
| 충돌 감지 | `matrixCollision` (커스텀 함수) | `rectIntersection` (내장) | **Master** |
| 센서 | `distance: 3` (즉각 반응) | `delay: 200` (느림) | **Master** |
| 카드 트랜지션 | `duration: 120, easing: 'ease'` | 기본값 (250ms) | **Master** |
| 드롭존 트랜지션 | `0.08s` (빠름) | `0.15s` | **Master** |
| 프로젝트 열 구조 | 통합 리스트 (`filteredProjects`) | 팀/개인 분리 + spacer | **Master** |

**결론: Master 버전 그대로 유지. Loop 26 변경 무시.**

#### 4. src/components/layout/Sidebar.jsx — 양쪽 모두 신규 (내용 다름)

| 항목 | Master (워킹트리) | Loop 26 | 채택 |
|------|-------------------|---------|------|
| 간격 상수 | `S` 객체 (18개 상수) | 하드코딩 개별 값 | **Master** |
| sidebarCollapsed | localStorage 연동 | 메모리만 | **Master** |
| 알림 뱃지 | `useNotifications.getUnreadCount` | `unreadCount: 0` (미구현) | **Master** |
| 프로젝트 클릭 | `setView('project')` | `enterProjectLayer(projectId)` | **Loop 26** |
| 프로젝트 활성 표시 | 뷰 기반 | `selectedProjectId` 기반 하이라이트 | **Loop 26** |
| email 표시 | 확인 필요 | Supabase에서 조회 | **Loop 26** |

**결론: Master를 기본으로, Loop 26의 enterProjectLayer + selectedProjectId 하이라이트를 수동 이식.**

#### 5. src/components/shared/DetailPanel.jsx — Loop 26 추가만

**Loop 26에서 추가된 것 (diff +44줄):**
- `import DeliverableSelector` 추가
- `milestoneName` state + useEffect 쿼리 (keyMilestoneId → key_milestones.title)
- 마일스톤 읽기전용 표시 행 (◆ 아이콘)
- DeliverableSelector 결과물 선택 행

**결론: Master에 Loop 26 추가분만 병합. 충돌 없음.**

#### 6. src/components/views/ProjectView.jsx — Loop 26에서 대폭 축소

**Loop 26 변경:**
- `CategorySection`, `OutlinerTaskNode`, `AddTaskButton` 3개 인라인 컴포넌트(~440줄)를 `src/components/project/tasks/`로 분리 추출
- ProjectView는 ~220줄로 축소
- `import { CategorySection } from '../project/tasks'` 추가
- 기존 기능 100% 유지 (분리만)

**결론: Loop 26 구조 채택.** 추출된 컴포넌트 파일들은 Phase 2에서 이미 복사됨.

#### 7. src/components/views/TimelineView.jsx — Loop 26 변경 (+30줄)

diff 확인 필요. 프로젝트 타임라인 관련 변경으로 추정.

**결론: Loop 26 변경 채택.**

#### 8. 추가 수정 파일들

| 파일 | Loop 26 변경 | 채택 |
|------|-------------|------|
| `src/hooks/useProjectFilter.js` | +20/-20 변경 | Loop 26 |
| `src/components/shared/RowConfigSettings.jsx` | +114줄 확장 | Loop 26 |
| `.gitignore` | +1줄 | Loop 26 |
| `README.md` | +2/-1 | Loop 26 |
| `package-lock.json` | -13줄 | Loop 26 |

---

## Part B: 고아 커밋 복구 — Claude Code 실행 프롬프트

### Phase 1: 백업

```bash
# 1. 현재 Master 상태 백업
git branch backup-master-before-merge

# 2. 워킹트리에 미커밋 변경이 있다면 먼저 커밋 또는 stash
git stash save "master working tree before loop26 merge"

# 3. Loop 26 고아 커밋 접근 확인
git log --oneline 7f90d07 -1
git log --oneline 747b4c8 -1

# 접근 불가하면:
git reflog | grep -i "loop\|project.layer\|key.milestone" | head -10
```

### Phase 2: Loop 26 전용 신규 파일 복사 (충돌 없음 — 20+ 파일)

```bash
# 프로젝트 레이어 컴포넌트
git checkout 7f90d07 -- \
  src/components/project/ProjectLayer.jsx \
  src/components/project/ProjectHeader.jsx \
  src/components/project/KeyMilestoneTab.jsx \
  src/components/project/TasksTab.jsx

# Tasks 탭 분리 컴포넌트
git checkout 7f90d07 -- \
  src/components/project/tasks/CategorySection.jsx \
  src/components/project/tasks/OutlinerTaskNode.jsx \
  src/components/project/tasks/AddTaskButton.jsx \
  src/components/project/tasks/MilestoneOutlinerView.jsx \
  src/components/project/tasks/TaskOutlinerMode.jsx \
  src/components/project/tasks/index.js

# 타임라인 모드
git checkout 7f90d07 -- \
  src/components/project/timeline/GanttMode.jsx \
  src/components/project/timeline/DetailMode.jsx

# 공유 컴포넌트
git checkout 7f90d07 -- \
  src/components/shared/DeliverableSelector.jsx

# Hooks
git checkout 7f90d07 -- \
  src/hooks/useKeyMilestones.js \
  src/hooks/useKeyDeliverables.js \
  src/hooks/useKeyLinks.js \
  src/hooks/useKeyPolicies.js \
  src/hooks/useProjectKeyMilestone.js \
  src/hooks/useProjectTimelineData.js

# 유틸
git checkout 7f90d07 -- src/utils/auth.js

# 인프라
git checkout 7f90d07 -- vercel.json

# 마이그레이션 + 문서
git checkout 7f90d07 -- supabase/
git checkout 7f90d07 -- docs/
git checkout 7f90d07 -- scripts/

# 확인
ls -la src/components/project/
ls -la src/components/project/tasks/
ls -la src/components/project/timeline/
ls -la src/hooks/useKey*.js
ls -la src/hooks/useProject*.js
echo "Phase 2 complete: $(git diff --cached --stat | tail -1)"
```

### Phase 3: 충돌 파일 수동 머지 (8개)

---

#### 파일 1: src/App.jsx

**전략: Loop 26 버전을 기본 채택**

```bash
git checkout 7f90d07 -- src/App.jsx
```

이렇게 하면 Loop 26의 App.jsx를 통째로 가져온다. 이 파일에는:
- ✅ Sidebar import (TopNav 제거됨)
- ✅ ProjectLayer lazy import
- ✅ views 객체에 projectLayer 포함
- ✅ flex 레이아웃 (Sidebar + 메인)
- ✅ iOS PWA 스냅샷 최적화 전체
- ✅ FAB 모바일 전용

**Master에서 추가 확인할 것:**
Master에만 있고 Loop 26에 없는 변경이 있는지 diff로 재확인:

```bash
# Master에만 있는 App.jsx 변경을 확인
git diff 7f90d07 master -- src/App.jsx
```

만약 Master에 App.jsx 관련 추가 변경이 있었다면 수동으로 이식. 
현재 diff 분석 기준으로는 Master의 App.jsx 변경은 Loop 26에 모두 포함(상위호환)되어 있다.

---

#### 파일 2: src/hooks/useStore.js

**전략: Master를 기본으로, Loop 26 추가분을 수동 이식**

Loop 26의 useStore.js 변경은 깔끔한 추가(addition)이므로, 정확한 위치에 삽입한다.

```bash
# 양쪽 비교용 파일 생성
git show 7f90d07:src/hooks/useStore.js > /tmp/store-loop26.js
cp src/hooks/useStore.js /tmp/store-master.js
```

**이식할 변경 목록 (Loop 26 → Master):**

**2-1. taskToRow 함수에 2줄 추가:**
`updated_at` 라인 바로 뒤에:
```javascript
    // ↓ Loop-26: Key Milestone 연결 ↓
    key_milestone_id: t.keyMilestoneId || null,
    deliverable_id: t.deliverableId || null,
```

**2-2. mapTask 함수에 3줄 추가:**
`deletedAt` 라인 바로 뒤에:
```javascript
    // ↓ Loop-26: Key Milestone 연결 ↓
    keyMilestoneId: r.key_milestone_id || null,
    deliverableId: r.deliverable_id || null,
```

**2-3. 스냅샷 상태 추가:**
`setUserName` 라인 근처에:
```javascript
  // ─── 스냅샷 상태 (iOS PWA 콜드 스타트 최적화) ───
  snapshotTeamId: null,
  snapshotRestored: false,
```

**2-4. restoreSnapshot 함수 교체:**
기존 restoreSnapshot 함수를 Loop 26 버전으로 교체:
```javascript
  restoreSnapshot: () => {
    try {
      const cached = localStorage.getItem(SNAPSHOT_KEY)
      if (!cached) return false
      const snapshot = JSON.parse(cached)
      if (Date.now() - snapshot.timestamp > SNAPSHOT_MAX_AGE) return false
      set({
        tasks: snapshot.tasks || [],
        projects: snapshot.projects || [],
        memos: snapshot.memos || [],
        snapshotTeamId: snapshot.teamId || null,
        snapshotRestored: true,
      })
      return true
    } catch (e) {
      return false
    }
  },
```

**2-5. clearSnapshot 함수 추가 (restoreSnapshot 바로 뒤에):**
```javascript
  clearSnapshot: () => {
    set({
      snapshotRestored: false,
      snapshotTeamId: null,
      tasks: [],
      projects: [],
      memos: [],
    })
    try { localStorage.removeItem(SNAPSHOT_KEY) } catch (e) {}
  },
```

**2-6. logout 함수 수정:**
`localStorage.removeItem(SNAPSHOT_KEY)` → `get().clearSnapshot()`

**2-7. updateProject 함수 수정:**
기존 `set(s => ({ projects: ... }))` 앞에 safePatch 로직 추가:
```javascript
  updateProject: async (id, patch) => {
    const {
      teamId, userId, team_id, user_id,
      created_by, createdBy, id: _id,
      ...safePatch
    } = patch
    set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, ...safePatch } : p) }))
    // 이하 기존 로직 유지 (safePatch 대신 patch를 쓰는 DB 호출도 safePatch로 교체)
```

**2-8. deleteProject 함수에 권한 가드 추가:**
기존 `const d = db()` 앞에 Loop 26의 가드 코드 전체 삽입 (팀장 체크 + 개인 소유자 체크)

**2-9. sidebarCollapsed — Master 방식 유지:**
Master에 이미 localStorage 연동 sidebarCollapsed가 있으면 **그대로 유지**.
없으면 Loop 26의 단순 버전을 추가하되, localStorage 연동을 추가:
```javascript
  sidebarCollapsed: JSON.parse(localStorage.getItem('sidebarCollapsed') || 'false'),
  toggleSidebar: () => set(s => {
    const next = !s.sidebarCollapsed
    localStorage.setItem('sidebarCollapsed', JSON.stringify(next))
    return { sidebarCollapsed: next }
  }),
```

**2-10. Project Layer 상태 추가 (파일 끝, `}))` 직전):**
```javascript
  // ─── Project Layer (Loop-26.2) ───
  selectedProjectId: null,
  projectLayerTab: 'milestone',
  projectTimelineMode: 'gantt',

  enterProjectLayer: (projectId) => set({
    currentView: 'projectLayer',
    selectedProjectId: projectId,
    projectLayerTab: 'milestone',
  }),

  setProjectLayerTab: (tab) => set({ projectLayerTab: tab }),
  setProjectTimelineMode: (mode) => set({ projectTimelineMode: mode }),
```

---

#### 파일 3: src/components/matrix/TeamMatrixView.jsx

**전략: Master 유지. Loop 26 변경 무시.**

```bash
# 아무것도 안 함. Master 버전 그대로.
echo "TeamMatrixView: keeping master version (matrixCollision + distance:3 + 120ms)"
```

---

#### 파일 4: src/components/layout/Sidebar.jsx

**전략: Master 워킹트리 버전을 기본으로, Loop 26의 ProjectLayer 진입 로직을 이식**

```bash
# Master 워킹트리에 Sidebar.jsx가 있는지 확인
git stash list  # stash에 있을 수 있음
cat src/components/layout/Sidebar.jsx | head -5  # 현재 상태 확인
```

**Master Sidebar에 이식할 Loop 26 변경:**

1. `enterProjectLayer` import 또는 useStore에서 가져오기:
```javascript
const { ..., selectedProjectId, enterProjectLayer } = useStore()
```

2. 프로젝트 클릭 핸들러 변경:
```javascript
// Master 방식 (변경 전)
function handleProjectClick(projectId) {
  setView('project')  // 또는 유사
}

// Loop 26 방식 (변경 후)
function handleProjectClick(projectId) {
  enterProjectLayer(projectId)
}
```

3. 프로젝트 활성 상태 판별 추가:
```javascript
const isProjectActive = (projectId) =>
  currentView === 'projectLayer' && selectedProjectId === projectId
```

4. 프로젝트 리스트 아이템에 활성 하이라이트 적용:
```jsx
style={{
  background: isProjectActive(p.id) ? '#f0efe8' : 'transparent',
  // ...기존 스타일
}}
```

**Master에서 유지할 것:**
- S 객체 간격 상수 (18개)
- localStorage 연동 sidebarCollapsed
- useNotifications.getUnreadCount 알림 뱃지

---

#### 파일 5: src/components/shared/DetailPanel.jsx

**전략: Master에 Loop 26 추가분만 삽입**

```bash
git show 7f90d07:src/components/shared/DetailPanel.jsx > /tmp/detail-loop26.jsx
```

**삽입할 내용:**

5-1. import 추가:
```javascript
import DeliverableSelector from './DeliverableSelector'
```

5-2. milestoneName state + useEffect 추가 (컴포넌트 상단, `allTopCollapsed` 선언 뒤에):
```javascript
  const [milestoneName, setMilestoneName] = useState(null)
  useEffect(() => {
    if (!task?.keyMilestoneId) {
      setMilestoneName(null)
      return
    }
    getDb()
      ?.from('key_milestones')
      .select('title')
      .eq('id', task.keyMilestoneId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('[DetailPanel] milestone query failed:', error.message)
          setMilestoneName(null)
          return
        }
        setMilestoneName(data?.title || null)
      })
  }, [task?.keyMilestoneId])
```

5-3. 마일스톤 표시 행 추가 (카테고리 바로 위에):
```jsx
{task.keyMilestoneId && milestoneName && (
  <DetailRow label="마일스톤">
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#2C2C2A' }}>
      <span style={{ color: '#1D9E75', fontSize: 10 }}>◆</span>
      <span>{milestoneName}</span>
    </div>
  </DetailRow>
)}
```

5-4. 결과물 선택 행 추가 (마일스톤 바로 아래):
```jsx
{task.projectId && (
  <DetailRow label="결과물">
    <DeliverableSelector
      projectId={task.projectId}
      value={task.deliverableId}
      onChange={(deliverableId) => canEdit && updateTask(task.id, { deliverableId })}
    />
  </DetailRow>
)}
```

---

#### 파일 6: src/components/views/ProjectView.jsx

**전략: Loop 26 버전 채택 (컴포넌트 분리)**

```bash
git checkout 7f90d07 -- src/components/views/ProjectView.jsx
```

Loop 26의 ProjectView는 인라인 컴포넌트를 `src/components/project/tasks/`로 추출한 버전이다.
Phase 2에서 이미 추출된 파일들을 복사했으므로 import 경로가 일치한다.

---

#### 파일 7+8: 나머지 수정 파일

```bash
# TimelineView, useProjectFilter, RowConfigSettings는 Loop 26 채택
git checkout 7f90d07 -- \
  src/components/views/TimelineView.jsx \
  src/hooks/useProjectFilter.js \
  src/components/shared/RowConfigSettings.jsx \
  .gitignore \
  README.md
```

---

### Phase 4: 검증

```bash
# 빌드 확인
npm run build

# 빌드 실패 시 에러 메시지를 분석하고 누락된 import/export를 수정
# 흔한 에러:
# - Loop 26 파일이 Master에 없는 유틸을 import → 해당 유틸 파일 복사
# - Master 파일이 Loop 26에서 제거된 컴포넌트를 import → import 경로 수정
```

### Phase 4 검증 체크리스트

**글로벌 뷰:**
- [ ] TodayView 정상 (Task 추가/완료/삭제)
- [ ] AllTasksView 정상
- [ ] MatrixView DnD 정상 (**matrixCollision 커스텀 충돌 감지 동작 확인**)
- [ ] TeamMatrixView DnD 정상 (**distance:3 빠른 활성화 확인**)
- [ ] TimelineView 정상
- [ ] MemoryView 정상

**프로젝트 레이어 (Loop 26 신기능):**
- [ ] 사이드바에서 프로젝트 클릭 → ProjectLayer 진입
- [ ] Key Milestone 탭: 마일스톤/결과물/링크/정책 CRUD
- [ ] Tasks 탭: 할일 추가/완료/삭제
- [ ] 프로젝트 타임라인 탭 정상

**iOS PWA (Loop 26):**
- [ ] 콜드 스타트 시 restoreSnapshot으로 즉시 표시
- [ ] Auth 완료 후 teamId 불일치 시 스냅샷 무효화
- [ ] Auth 실패 시 clearSnapshot → 로그인 화면

**사이드바:**
- [ ] 축소/확장 토글 후 새로고침 → 상태 유지 (**localStorage**)
- [ ] 알림 뱃지 읽지 않은 수 표시
- [ ] 프로젝트 클릭 시 활성 하이라이트

**보안 (hotfix):**
- [ ] deleteProject 팀장 권한 가드
- [ ] updateProject 소속 변경 차단

- [ ] **npm run build 성공**
- [ ] 개인 모드 (teamId=null) 전체 정상

### Phase 5: 커밋

```bash
git add -A
git status

git commit -m "Merge Loop 26 orphan (7f90d07) into Master

Project Layer: ProjectLayer, ProjectHeader, KeyMilestoneTab, TasksTab
Key Milestone hooks: 5 hooks + timeline data
iOS PWA cold start: snapshot before auth + teamId validation
DetailPanel: milestone display + DeliverableSelector
Security: deleteProject guard + updateProject immutable fields
ProjectView: component extraction (440→220 lines)
Infra: Vercel migration + auth utils

Preserved from Master:
- DnD: matrixCollision + distance:3 + 120ms transition
- Sidebar: S constants + localStorage collapse + notification badge
- TeamMatrixView: unified project list"
```

---

## Part C: 머지 완료 후 — 개선 6건 실행 계획

### 의존 관계 + 실행 순서

```
[머지 완료] ← 전제 조건 (npm run build 성공)
    │
    ├── Step 2: 개선 5 — Tasks 탭 Milestone 없이 Task 표시
    │   └── MilestoneOutlinerView.jsx만 수정. 가장 독립적.
    │
    ├── Step 3: 개선 3+6 — DetailPanel 결과물→마일스톤 교체
    │   └── DeliverableSelector 제거 + MilestoneSelector 신규
    │
    ├── Step 4: 개선 2 — DetailPanel 생성자/배정자 표시
    │   └── Step 3과 같은 파일. 반드시 Step 3 뒤에.
    │
    ├── Step 5: 개선 1 — 프로젝트 Owner 지정
    │   └── DB 마이그레이션 포함. Ryan 직접 SQL 실행.
    │
    └── Step 6: 개선 4 — 노트 마우스 블록 지정
        └── 완전 독립적이지만 난이도 중간.
```

---

### Step 2: 개선 5 — Tasks 탭 Milestone 없이 Task 표시

**문제:** MilestoneOutlinerView가 `milestones.map()`으로만 Task를 렌더링하여, 마일스톤 0개면 Task가 안 보인다.

**수정 파일:** `src/components/project/tasks/MilestoneOutlinerView.jsx` (516줄)

**수정 방향:**
1. 마일스톤별 그룹핑 렌더링 유지
2. **"미분류" 섹션을 milestones.map() 앞 또는 뒤에 추가:**
   - `keyMilestoneId === null`인 Task를 여기에 표시
   - 마일스톤이 0개여도 이 섹션이 보이면 Task가 보인다
3. Task 추가 버튼은 마일스톤과 무관하게 항상 활성화
4. "미분류" 섹션 헤더: `📋 할일` 또는 `미배정` (마일스톤이 있을 때만 헤더 표시, 마일스톤 0개면 헤더 없이 바로 Task 목록)

**검증:**
- [ ] 마일스톤 0개 + Task 있음 → Task 목록 보임
- [ ] 마일스톤 2개 + 미분류 Task 3개 → 마일스톤 섹션 + "미분류" 섹션 모두 보임
- [ ] 마일스톤 2개 + 미분류 Task 0개 → "미분류" 섹션 안 보임
- [ ] Task 추가 → keyMilestoneId=null로 생성 → 미분류에 표시

---

### Step 3: 개선 3+6 — DetailPanel 결과물→마일스톤 교체

**문제:** Ryan 요구: "결과물이 아니라 연결된 Key Milestone을 항목으로 보여줘야 한다."

**수정 파일:**
- `src/components/shared/DetailPanel.jsx` — DeliverableSelector 제거, MilestoneSelector 추가
- `src/components/shared/MilestoneSelector.jsx` — 신규 컴포넌트

**수정 방향:**
1. DetailPanel에서 `DeliverableSelector` import 및 사용 부분 제거
2. 마일스톤 표시를 읽기전용 → **선택 가능한 드롭다운**으로 변경
3. MilestoneSelector 컴포넌트 신규 생성:
   - props: `projectId`, `value` (현재 keyMilestoneId), `onChange`
   - 현재 프로젝트의 key_milestones 목록을 Supabase에서 조회
   - 드롭다운으로 선택/변경 가능
   - "연결 해제" 옵션으로 keyMilestoneId = null
4. onChange 시 `updateTask(taskId, { keyMilestoneId })` 호출
5. DeliverableSelector.jsx 파일 자체는 삭제하지 않음 (다른 곳에서 쓸 수 있으므로)

**검증:**
- [ ] 마일스톤 드롭다운에 현재 프로젝트의 마일스톤 목록 표시
- [ ] 마일스톤 선택 → 새로고침 → 유지됨
- [ ] 마일스톤 "연결 해제" → keyMilestoneId=null → 새로고침 → 유지됨
- [ ] 프로젝트가 없는 할일 → MilestoneSelector 미표시
- [ ] 마일스톤이 0개인 프로젝트 → MilestoneSelector 미표시 (또는 빈 상태)

---

### Step 4: 개선 2 — DetailPanel 생성자 + 배정자 표시

**문제:** 누가 할일을 만들었는지, 누가 배정받았는지 상세 패널에서 안 보인다.

**수정 파일:** `src/components/shared/DetailPanel.jsx`

**전제 확인 (진단 보고서 기반):**
- mapTask에 `createdBy` (created_by) 매핑: ✅ 이미 있음
- mapTask에 `assigneeId` (assignee_id) 매핑: ✅ 이미 있음
- userId → 이름 변환: 기존 `getDisplayName` 또는 `memberMap` 패턴 사용

**수정 방향:**
1. DetailPanel에서 `task.createdBy`로 생성자 이름 표시 (읽기전용)
2. DetailPanel에서 `task.assigneeId`로 배정자 이름 표시 (읽기전용)
3. 이름 조회: 팀 모드에서는 `useTeamMembers`의 memberMap 활용, 개인 모드에서는 표시 안 함
4. 팀 모드가 아니면 (teamId=null) 생성자/배정자 행 자체를 숨김

**UI:**
```
마일스톤   ◆ Q1 마감           [드롭다운 — Step 3에서 추가]
생성자     Ryan Park           [읽기전용]
담당자     Ethan Kim           [읽기전용]
카테고리   🔥 오늘 할일         [기존]
```

**검증:**
- [ ] 팀 모드: 생성자/배정자 이름 표시
- [ ] 개인 모드: 생성자/배정자 행 미표시
- [ ] 배정자 없는 할일: "미배정" 또는 행 미표시
- [ ] 생성자 없는 할일 (레거시 데이터): 행 미표시

---

### Step 5: 개선 1 — 프로젝트 Owner(책임자) 지정

**문제:** 프로젝트에 created_by(생성자)는 있지만 정식 Owner(책임자)가 없다.

**수정 파일:**
- DB: `ALTER TABLE projects ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL`
- `src/hooks/useStore.js` — mapProject에 ownerId 추가
- `src/components/shared/ProjectManager.jsx` — Owner 선택 드롭다운
- `src/components/project/ProjectHeader.jsx` — Owner 이름 표시
- `src/components/shared/OwnerSelector.jsx` — 신규 (팀원 드롭다운, AssigneeSelector와 유사)

**수정 방향:**
1. DB 마이그레이션 SQL 생성 (Ryan 직접 실행)
2. mapProject에 `ownerId: r.owner_id || null` 추가
3. addProject에서 기본 owner_id = 생성자 (currentUserId)
4. ProjectManager.jsx: 수정 모달에 Owner 드롭다운 추가 (팀원 목록에서 선택)
5. ProjectHeader: Owner 이름 + 아바타(또는 이니셜) 표시
6. Owner에게 특별한 권한 없음 — 순수 표시 목적

**검증:**
- [ ] 프로젝트 생성 시 owner_id = 생성자
- [ ] 프로젝트 수정에서 Owner 변경 가능
- [ ] ProjectHeader에 Owner 이름 표시
- [ ] Owner가 null인 기존 프로젝트: "미지정" 또는 생성자로 폴백

---

### Step 6: 개선 4 — 노트 마우스 블록 지정

**문제:** 키보드(Shift+Arrow)로는 여러 불릿 선택 가능하지만, 마우스로는 단일 불릿 내 텍스트만 선택된다.

**진단 확인:** Shift+Click 블록 선택은 이미 동작한다. 마우스 드래그 선택이 안 되는 것.

**수정 파일:** 불릿 아이템 컴포넌트 + 부모 컨테이너 (진단 결과에서 특정된 파일)

**수정 방향 — Shift+Click은 이미 동작하므로, 마우스 드래그 선택 추가:**

1. 부모 컨테이너에 `onMouseDown` → 드래그 시작 감지
2. `onMouseMove` → 드래그 중 범위 계산 → selectedIds 업데이트
3. `onMouseUp` → 드래그 종료
4. 드래그 시작 조건: 불릿 좌측 여백 영역에서 시작 (텍스트 편집 영역에서는 기존 동작 유지)
5. 선택된 불릿에 하이라이트 스타일 적용 (기존 키보드 선택과 동일한 state 공유)

**주의사항:**
- contentEditable 영역에서의 마우스 텍스트 선택(Selection API)과 충돌하지 않도록 영역 분리
- 드래그 선택은 불릿 좌측 여백(bullet dot 영역)에서 시작할 때만 활성화
- 텍스트 영역에서의 마우스 동작은 기존과 100% 동일하게 유지

**검증:**
- [ ] 불릿 좌측에서 마우스 드래그 → 여러 불릿 선택됨 (하이라이트)
- [ ] 텍스트 영역에서 마우스 드래그 → 기존 텍스트 선택 동작 유지
- [ ] Shift+Click → 기존대로 범위 선택 동작
- [ ] 키보드 Shift+Arrow → 기존대로 동작
- [ ] 마우스 선택 후 키보드로 확장 → 동작
- [ ] 키보드 선택 후 마우스로 변경 → 동작

---

## Part D: 전체 실행 로드맵

```
Step 1: 고아 커밋 머지 (Part B)
  ├── Phase 1: 백업 + stash
  ├── Phase 2: 신규 파일 20+ 복사
  ├── Phase 3: 충돌 파일 8개 수동 머지
  ├── Phase 4: npm run build + 기능 검증
  └── Phase 5: 커밋

Step 2: 개선 5 — Tasks 탭 미분류 섹션 추가
Step 3: 개선 3+6 — DetailPanel MilestoneSelector 교체
Step 4: 개선 2 — DetailPanel 생성자/배정자 표시
Step 5: 개선 1 — 프로젝트 Owner (DB 마이그레이션 포함)
Step 6: 개선 4 — 노트 마우스 드래그 블록 지정
```

---

## Part E: 주의사항

1. **고아 커밋 머지를 최우선으로.** 개선 6건은 머지 완료 + 빌드 성공 후 진행.
2. **Master의 DnD 개선을 절대 잃지 마라.** TeamMatrixView는 Master 그대로 유지.
3. **Sidebar는 Master 기본 + Loop 26의 enterProjectLayer만 이식.** S 상수, localStorage, 알림뱃지는 Master.
4. **개선 3+6과 개선 2는 같은 파일 수정.** 반드시 3+6 먼저.
5. **개선 1의 DB 마이그레이션은 Ryan이 직접 실행.**
6. **updateTask(id, patch) 시그니처 절대 준수.**
7. **기존 tasks/memos 테이블의 text/done/category/alarm 컬럼 절대 변경 금지.**
8. **Phase 3에서 useStore.js 수동 머지가 가장 까다롭다.** 10개 이식 항목을 하나씩 정확한 위치에 삽입하라.
9. **빌드 실패 시 가장 흔한 원인:** Loop 26 파일이 Master에 없는 유틸을 import. 해당 유틸 파일을 Phase 2에서 누락했는지 확인.
