# Loop-36A: 전체 할일 MS 그룹핑 + 매트릭스 MS 모드

> **분류**: Feature (글로벌 뷰 최적화)
> **선행 조건**: Loop-35 시리즈 완료 (35H/I/J/K)
> **참조 목업**: `docs/mockups/loop-36-mockup.jsx` — "전체 할일" 탭 + "매트릭스" 탭
> **Agent 리뷰 필수**

---

## 목표

1. **전체 할일 뷰**를 프로젝트 → 마일스톤 → 할일 계층 구조의 단일 뷰로 재구성
2. **매트릭스 뷰**에 마일스톤 모드 토글 추가 (할일 모드 / 마일스톤 모드)
3. 할일 카드에 MS 뱃지(컬러 도트 + 이름) 표시 추가 (매트릭스 할일 모드)

---

## Part 1: 전체 할일 뷰 — MS 그룹핑

### 현재 상태

AllTasksView는 프로젝트별로 할일을 flat list로 표시. 마일스톤 정보 없음.
인라인 편집 없음 (읽기 전용), 행 전체 클릭 → 상세 진입.

### 변경 사항

**레이아웃 변경**: 프로젝트 카드 안에 마일스톤 그룹이 들여쓰기로 표시.

```
┌ 정기주총 (8건)                              ▾
│ ● 공증 준비          ██░░░░  2/6  03/28
│   ☐ 위임:본+산은 추가하기                   남은  ▶
│   ☐ 등기서류 공증인 확인 체크               남은  ▶
│   ☐ 위임장 뿌리기+웹사이트 게재             남은  ▶
│   ☐ 필요 서류 공증인 확인 필요              남은  ▶
│ ● 안건자료 PPT       █░░░░░  1/2  03/25
│   ☐ 안건 PPT - 수요일 오후 3시             오늘  ▶
│   ☐ 안건 PPT 재무제표 분석                  남은  ▶
│ ● 의사록+첨부서류    ░░░░░░  0/1  04/01
│   ☐ 의사록 작성                             다음  ▶
│ 미연결 (2)
│   ☐ Sifive 메일 번역?                      오늘  ▶
│   ☐ 투표 역선                               남은  ▶
└
```

**프로젝트 카드 헤더**: 프로젝트 컬러 배경 + 도트 + 이름 + 할일 건수 + ▾ 접기/펼치기.

**마일스톤 그룹 헤더**: 들여쓰기 + 컬러 도트(6px) + MS 이름 + 진행률 바 + 완료/전체 + 마감일.

**할일 행**: 체크박스 + 제목 + 카테고리 라벨(오늘/다음/남은) + ▶ 상세 아이콘.

**미연결 섹션**: 마일스톤에 연결되지 않은 할일. 이탤릭 "미연결 (N)" 헤더 + 할일 목록. "+MS 연결" 텍스트 표시.

**접기/펼치기**: 프로젝트 단위로 접기/펼치기. useState로 로컬 관리.

### 진단 Phase

코드 수정 전에 아래를 조사하라:

```bash
# AllTasksView 현재 구조
cat src/components/views/AllTasksView.jsx

# AllTasksView에서 tasks를 어떻게 읽고 그룹핑하는지
grep -rn "useStore\|tasks\|projects\|filter\|group" src/components/views/AllTasksView.jsx -n | head -20

# key_milestones 데이터를 글로벌 뷰에서 읽을 수 있는지
grep -rn "keyMilestone\|key_milestone\|useKeyMilestones\|milestones" src/hooks/useStore.js -n | head -15

# milestones 데이터가 store에 있는지, 별도 훅인지
grep -rn "milestones\|loadMilestones\|setMilestones" src/hooks/useStore.js -n | head -15
```

**핵심 확인**: key_milestones 데이터가 현재 프로젝트 뷰(ProjectLayer) 내부의 커스텀 훅에서만 로드되는지, 아니면 글로벌 store에 있는지. 프로젝트 뷰 전용이라면 AllTasksView에서 접근하려면 store에 milestones를 올리거나, loadAll에 포함시켜야 한다.

### 구현 Phase

#### Phase 1: milestones 데이터 글로벌 접근 보장

진단 결과에 따라:
- **Store에 이미 있으면**: 그대로 사용
- **별도 훅(useKeyMilestones)이면**: store의 loadAll에 milestones 로딩 추가, 또는 AllTasksView에서 직접 훅 호출

```js
// loadAll 내부에 추가하는 경우:
const { data: milestones } = await d.from('key_milestones').select('id, title, color, status, sort_order, pkm_id, owner_id, start_date, due_date');
set({ milestones: milestones || [] });
```

#### Phase 2: AllTasksView 재구성

현재 AllTasksView를 수정하여 마일스톤 그룹핑 뷰로 전환.

```
데이터 흐름:
tasks (store) + milestones (store 또는 훅) + projects (store)
→ 프로젝트별 그룹핑
  → 각 프로젝트 내에서 마일스톤별 그룹핑
    → 미연결 할일 분리
```

**렌더링 구조**:
```jsx
{projects.map(project => (
  <ProjectCard key={project.id} project={project} expanded={...} onToggle={...}>
    {milestonesForProject.map(ms => (
      <MilestoneGroup key={ms.id} milestone={ms} tasks={tasksForMs}>
        {tasksForMs.map(task => (
          <TaskRow key={task.id} task={task} milestone={ms} />
        ))}
      </MilestoneGroup>
    ))}
    <UnlinkedGroup tasks={unlinkedTasks} />
  </ProjectCard>
))}
```

#### Phase 3: 할일 행 인터랙션

현재 AllTasksView는 읽기 전용(행 클릭 → 상세 진입)인데, 이번에 변경:

- 체크박스 클릭 → `toggleDone(id)` (기존 패턴)
- ▶ 아이콘 클릭 → `openDetail(taskId)` (상세 패널 진입)
- "+MS 연결" 클릭 → 해당 프로젝트의 MS 선택 드롭다운 → `updateTask(id, { keyMilestoneId: msId })`

**인라인 편집과 DnD는 이번 Loop에서 추가하지 않는다.** 전체 할일 뷰의 핵심은 조망(overview)이지 편집이 아니다. 편집은 매트릭스나 프로젝트 뷰에서 한다.

---

## Part 2: 매트릭스 뷰 — 할일 모드 + MS 모드

### 현재 상태

매트릭스 뷰에 `[전체|팀|개인]` 필터 + `[⚙ 뷰 관리]` 버튼이 있음.
행 = 카테고리(오늘/다음/남은) + 팀원 행, 열 = 프로젝트.

### 변경 사항

#### Phase 4: 모드 토글 UI 추가

기존 `[전체|팀|개인]` 옆에 `[할일 모드] [마일스톤 모드]` 토글 추가.

```
[할일 모드] [마일스톤 모드]  [전체|팀|개인]  [⚙ 뷰 관리]
```

상태: `matrixMode: 'task' | 'milestone'` — useState로 로컬 관리.

#### Phase 5: 할일 모드 — MS 뱃지 추가

기존 매트릭스 할일 카드에 소속 마일스톤 뱃지를 추가.

```
┌─────────────────────┐
│ ☐ 안건 PPT - 수 3시 │
│   ● 안건자료 PPT     │  ← MS 뱃지 (컬러 도트 + 이름)
└─────────────────────┘
```

- MS가 있으면: `<MsBadge ms={milestone} />` — 컬러 도트(6px) + MS 이름, 배경색 연하게
- MS가 없으면: `+MS 연결` 텍스트 (클릭 → MS 선택 드롭다운)
- MS 뱃지 클릭 → MS 상세 모달 진입 (`openMilestoneDetail(msId)`)

**기존 매트릭스의 DnD, 인라인 편집, 체크 토글은 그대로 유지.** MS 뱃지만 추가.

#### Phase 6: 마일스톤 모드 — 신규 뷰

`matrixMode === 'milestone'`일 때 렌더링되는 별도 컴포넌트.

**구조**:
- 행 = 담당자별 (Ryan, Edmond, ash.kim, eric.kim + 미배정)
- 열 = 프로젝트별 (팀 프로젝트만, 개인 프로젝트 제외)
- 셀 = 해당 담당자가 오너인 MS 카드 목록

**MS 카드 내부**:
```
┌─────────────────────┐
│ ● 공증 준비          │
│ ██░░░░  2/6         │  ← 진행률 바
│ 6건 · 03/28 · Ryan  │
└─────────────────────┘
```

- MS 이름 + 컬러 도트(6px)
- 진행률 바 (완료/전체)
- 할일 수 + 마감일 + 담당자
- 클릭 → MS 상세 모달

**DnD**: MS 카드를 다른 담당자 행으로 드래그 → `updateMilestone(msId, { owner_id: newOwnerId })`

**미배정 행**: `owner_id === null`인 MS 카드 모음. 항상 최하단.

**[전체|팀|개인] 필터**: 마일스톤 모드에서는 자동으로 팀 프로젝트만 표시 (개인 프로젝트에는 MS가 의미 없음).

---

## 공통 컴포넌트

이 Loop에서 추출하는 공통 컴포넌트:

| 컴포넌트 | 위치 | 역할 |
|---------|------|------|
| `MsBadge` | `src/components/common/MsBadge.jsx` | 컬러 도트 + MS 이름 뱃지 |
| `ProgressBar` | `src/components/common/ProgressBar.jsx` | MS 진행률 바 |
| `MilestoneCard` | `src/components/common/MilestoneCard.jsx` | MS 모드 셀 내 카드 |
| `MsDropdown` | `src/components/common/MsDropdown.jsx` | MS 선택 드롭다운 |

**기존 컴포넌트 수정 범위**:
- `AllTasksView.jsx` — 내부 렌더링 전면 변경 (마일스톤 그룹핑)
- `MatrixView.jsx` 또는 `TeamMatrixView.jsx` — 할일 카드에 MsBadge 추가
- 신규 `MilestoneMatrixView.jsx` — 마일스톤 모드 전체

---

## 검증 체크리스트

### 전체 할일 뷰
- [ ] 프로젝트별 카드 안에 마일스톤 그룹 표시
- [ ] 마일스톤 그룹 헤더에 컬러 도트 + 이름 + 진행률 + 마감일
- [ ] 미연결 할일이 "미연결 (N)" 섹션으로 분리
- [ ] 프로젝트 카드 접기/펼치기 동작
- [ ] 체크박스 클릭 → toggleDone 정상
- [ ] ▶ 아이콘 → DetailPanel 정상
- [ ] "+MS 연결" → 드롭다운 → updateTask(id, { keyMilestoneId }) 정상

### 매트릭스 할일 모드
- [ ] [할일 모드] [마일스톤 모드] 토글 표시
- [ ] 할일 카드에 MS 뱃지 표시 (있으면 컬러 도트+이름, 없으면 "+MS 연결")
- [ ] MS 뱃지 클릭 → MS 상세 모달
- [ ] 기존 DnD 카테고리 이동 정상 유지
- [ ] 기존 인라인 편집 정상 유지
- [ ] 기존 체크 토글 정상 유지

### 매트릭스 마일스톤 모드
- [ ] 행 = 담당자별, 열 = 팀 프로젝트별
- [ ] 셀 안에 MS 카드 (이름 + 진행률 + 할일 수 + 마감일)
- [ ] MS 카드 클릭 → MS 상세 모달
- [ ] MS 카드 DnD 담당자 행 이동 → owner_id 변경
- [ ] 미배정 행에 owner_id=null MS 표시
- [ ] [전체|팀|개인] 필터에서 팀만 자동 선택

### 회귀 검증
- [ ] 오늘 할일 뷰 정상
- [ ] 타임라인 뷰 정상
- [ ] 프로젝트 뷰 정상
- [ ] 노트 뷰 정상
- [ ] DetailPanel 정상
- [ ] 모바일 레이아웃 깨지지 않음
- [ ] `npm run build` 성공

---

## 주의사항

1. **updateTask(id, patch) 시그니처 엄수**
2. **updateMilestone도 동일 패턴 사용** — `updateMilestone(msId, patch)`
3. **milestones 데이터 로딩 방식은 진단 결과에 따라 결정** — store 확장 vs 훅 직접 호출
4. **기존 매트릭스 DnD를 건드리지 않는다** — 할일 모드는 MS 뱃지만 추가
5. **마일스톤 모드는 별도 컴포넌트(MilestoneMatrixView)로 생성** — 기존 MatrixView/TeamMatrixView 수정 최소화
6. **CSS 변수 사용 금지** — 인라인 스타일 컨벤션 유지
7. **왼쪽 컬러 보더 사용 금지** — 도트로 대체
8. **`select('*')` 금지** — milestones 로딩 시 필요한 컬럼만

---

## 작업 내역

(작업 완료 후 기록)
