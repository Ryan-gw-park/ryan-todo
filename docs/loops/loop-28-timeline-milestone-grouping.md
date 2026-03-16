# Loop-28 — 타임라인 뷰 마일스톤 그룹핑 개편

## 목표

글로벌 타임라인 뷰와 프로젝트 타임라인 뷰를 **마일스톤 그룹핑 간트**로 개편한다.
마일스톤 = 중간 레벨 업무 묶음(Work Package), 할일 = 하위 실행 단위.

핵심 변경:
1. 글로벌 타임라인: 뷰 깊이 필터(프로젝트 / +마일스톤 / +할일) + 프로젝트 멀티셀렉트 + 담당자 멀티셀렉트
2. 프로젝트 타임라인: 해당 프로젝트의 마일스톤+할일 계층 간트
3. 기존 타임라인 뷰의 모든 기능/UI 100% 보존

## 전제 조건

- Loop-27 완료 (CompactMilestoneTab, tasks.key_milestone_id 활용 확인)
- DB 변경 없음 (key_milestones 테이블, tasks.key_milestone_id 이미 존재)

---

## 반드시 읽어야 할 파일 (작업 전)

```
src/pages/TimelineView.jsx            # 기존 글로벌 타임라인 — 핵심 보존 대상
src/components/project/ProjectLayer.jsx  # tab='ptimeline' 라우팅
src/components/project/GanttMode.jsx     # 프로젝트 타임라인 (존재하면)
src/hooks/useKeyMilestones.js            # 마일스톤 데이터
src/store/useStore.js                    # tasks, projects 데이터
```

**작업 시작 전 TimelineView.jsx를 완전히 읽고, 아래 항목을 파악하라:**
1. 간트 바 렌더링 로직 (시작일/종료일 → 좌표 변환)
2. 날짜 헤더 (주간/월간/분기 스케일 전환)
3. 오늘 기준선 렌더링
4. 좌측 항목 목록 렌더링 (프로젝트별 그룹핑)
5. 간트 바 위 텍스트 표기 (할일 제목, 기간 등)
6. DnD 설정 (DndContext, sensors, onDragEnd)
7. 뷰 모드 전환 (월간/분기/연간 등)
8. 기존 필터/토글 UI
9. 간트 바 클릭 → 상세패널 진입 로직
10. 기존 CSS 클래스명 및 스타일링 방식

---

## "Don't Touch, Wrap It" 전략

### 글로벌 타임라인

**기존 TimelineView.jsx를 직접 수정한다.** 단, 아래 원칙을 엄수:
- 기존 간트 바 렌더링 함수/컴포넌트는 수정하지 않고 그대로 사용
- 기존 날짜 헤더, 오늘 기준선, DnD 설정은 건드리지 않음
- 기존 좌측 목록의 항목 렌더링 로직에 **마일스톤 행을 추가 삽입**하는 방식
- 기존 필터 UI 옆에 새 필터 컴포넌트를 **나란히 배치**

### 프로젝트 타임라인

**기존 GanttMode 컴포넌트가 존재하면** 그것을 확장한다.
**존재하지 않거나 빈 상태이면** ProjectTimelineView.jsx를 신규 생성한다.
글로벌 TimelineView의 간트 렌더링 로직을 재사용하되, 데이터 소스만 프로젝트 스코프로 제한.

### 신규 생성 파일

```
src/components/timeline/TimelineFilters.jsx     # 뷰 깊이 + 프로젝트 + 담당자 필터 바
src/components/timeline/MilestoneGanttRow.jsx   # 마일스톤 그룹 헤더 행
src/components/shared/MultiSelectFilter.jsx     # 범용 멀티셀렉트 드롭다운
src/components/shared/DepthToggle.jsx           # 뷰 깊이 토글
```

### 수정 파일

```
src/pages/TimelineView.jsx                      # 글로벌 타임라인에 필터 + 마일스톤 그룹핑 추가
src/components/project/ProjectLayer.jsx         # tab='ptimeline' → 프로젝트 타임라인 연결
```

---

## Phase 1: 코드베이스 조사 (필수 선행)

TimelineView.jsx를 읽고 아래를 diagnostic-report에 기록하라.

```
1. 파일 총 줄 수
2. 간트 바 렌더 함수명 및 위치 (예: renderGanttBar, GanttBar 컴포넌트 등)
3. 날짜→좌표 변환 함수 (예: dateToX, dayToPercent 등)
4. 좌측 목록 렌더링 부분 — 현재 그룹핑 기준 (프로젝트별? flat?)
5. 뷰 모드 상태 관리 (월간/분기/연간 등)
6. DndContext 위치 및 onDragEnd 핸들러
7. 기존 필터 UI (있다면)
8. CSS 파일 또는 인라인 스타일 방식
9. GanttMode.jsx 존재 여부 및 내용
10. 프로젝트 타임라인(ProjectLayer ptimeline 탭)의 현재 구현 상태
```

**이 조사 결과에 따라 아래 Phase 2~4의 구체적 삽입 위치가 결정된다.**

---

## Phase 2: 글로벌 타임라인 — 필터 바 추가

### 2-1. DepthToggle 컴포넌트

```
src/components/shared/DepthToggle.jsx
```

3단계 뷰 깊이 토글:
- **"프로젝트"** — 프로젝트 단위 바만 표시 (기존과 유사)
- **"+ 마일스톤"** — 프로젝트 아래 마일스톤 헤더 바 추가
- **"+ 할일"** — 마일스톤 아래 개별 할일 바 추가

```jsx
const DEPTH_OPTIONS = [
  { key: 'project', label: '프로젝트' },
  { key: 'milestone', label: '+ 마일스톤' },
  { key: 'task', label: '+ 할일' },
]

function DepthToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 1, background: '#f0efe8', borderRadius: 6, padding: 2 }}>
      {DEPTH_OPTIONS.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)} style={{
          fontSize: 11, padding: '3px 10px', borderRadius: 5, border: 'none',
          background: value === o.key ? '#fff' : 'transparent',
          color: value === o.key ? '#2C2C2A' : '#888780',
          fontWeight: value === o.key ? 600 : 400,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
```

### 2-2. MultiSelectFilter 컴포넌트

```
src/components/shared/MultiSelectFilter.jsx
```

범용 멀티셀렉트 드롭다운. 프로젝트 필터와 담당자 필터에 동일하게 사용.

Props:
```typescript
{
  label: string,             // "프로젝트" 또는 "담당자"
  options: Array<{ id, name, color? }>,
  selected: string[],        // 선택된 ID 배열
  onChange: (ids: string[]) => void,
}
```

UI:
- 버튼: `{label}` + 선택 개수 뱃지 (전체 선택이면 뱃지 숨김)
- 클릭 → 드롭다운: "전체" 체크박스 + 개별 항목 체크박스
- 프로젝트 항목에는 색상 dot 표시
- 외부 클릭 시 닫힘

### 2-3. TimelineFilters 컴포넌트

```
src/components/timeline/TimelineFilters.jsx
```

DepthToggle + MultiSelectFilter(프로젝트) + MultiSelectFilter(담당자)를 한 줄에 배치.

```jsx
function TimelineFilters({ depth, onDepthChange, projects, selProjects, onProjectsChange, members, selMembers, onMembersChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 14px', borderBottom: '0.5px solid #e8e6df',
      background: '#fafaf8', flexWrap: 'wrap',
    }}>
      <DepthToggle value={depth} onChange={onDepthChange} />
      <MultiSelectFilter label="프로젝트" options={projects} selected={selProjects} onChange={onProjectsChange} />
      <MultiSelectFilter label="담당자" options={members} selected={selMembers} onChange={onMembersChange} />
    </div>
  )
}
```

### 2-4. TimelineView.jsx에 필터 바 삽입

**기존 TimelineView의 최상단 (헤더/모드 바 아래, 날짜 헤더 위)에 TimelineFilters를 삽입.**

상태 추가:
```javascript
const [timelineDepth, setTimelineDepth] = useState('project')  // 'project' | 'milestone' | 'task'
const [selProjects, setSelProjects] = useState(null)  // null = 전체
const [selMembers, setSelMembers] = useState(null)    // null = 전체
```

Zustand에 넣지 않고 TimelineView 로컬 state로 관리. (다른 뷰에서 돌아왔을 때 초기화되어도 무방)

---

## Phase 3: 글로벌 타임라인 — 마일스톤 그룹핑 렌더링

### 3-1. 데이터 준비

```javascript
// 기존: 프로젝트별 할일 그룹
// 변경: 프로젝트 → 마일스톤 → 할일 3계층

const filteredProjects = projects.filter(p =>
  !selProjects || selProjects.includes(p.id)
)

// 각 프로젝트의 마일스톤 가져오기
// useKeyMilestones는 pkmId가 필요하므로, 전체 마일스톤을 한번에 가져오는 방법 필요
// 옵션 A: key_milestones 테이블을 직접 쿼리 (프로젝트 ID 목록으로)
// 옵션 B: 각 프로젝트별로 useKeyMilestones 호출 (비효율적)
// → 옵션 A 권장: useMilestonesByProjects(projectIds) 훅 신규 생성
```

**useMilestonesByProjects 훅 생성:**
```javascript
// src/hooks/useMilestonesByProjects.js
export function useMilestonesByProjects(projectIds) {
  const [milestones, setMilestones] = useState([])

  useEffect(() => {
    if (!projectIds?.length) { setMilestones([]); return }
    supabase
      .from('key_milestones')
      .select('*')
      .in('project_id', projectIds)
      .order('sort_order')
      .then(({ data }) => setMilestones(data || []))
  }, [projectIds.join(',')])

  return milestones
}
```

할일 필터링:
```javascript
const filteredTasks = tasks.filter(t => {
  if (t.deletedAt || t.done) return false
  if (selProjects && !selProjects.includes(t.projectId)) return false
  if (selMembers && t.assigneeId && !selMembers.includes(t.assigneeId)) return false
  // 시작일 또는 마감일이 있는 할일만 타임라인에 표시
  if (!t.startDate && !t.dueDate) return false
  return true
})
```

### 3-2. 계층별 렌더링 (핵심)

**기존 TimelineView의 좌측 목록 + 간트 영역 렌더링 루프를 확장한다.**

기존 구조 (추정):
```
프로젝트 A
  ├── 할일 1  ████████
  ├── 할일 2      ██████
  └── 할일 3        ████
프로젝트 B
  ├── 할일 4  ██████████
  └── 할일 5      ████
```

변경 후 구조 (depth='task'):
```
▾ 프로젝트 A                    ░░░░░░░░░░░░░░░░  (프로젝트 범위 바, 연하게)
  ▾ ● 마일스톤 X               ▓▓▓▓▓▓▓▓          (마일스톤 바, 반투명+border)
      할일 1                     ████████          (할일 바, 기존 스타일 그대로)
      할일 2                         ██████
  ▾ ● 마일스톤 Y                   ▓▓▓▓▓▓▓▓▓▓
      할일 3                           ████
  ● 백로그                      (바 없음)
      할일 4                     ████████
```

**구현 방식: 기존 렌더링 루프를 감싸는 새 루프 추가**

```jsx
{filteredProjects.map(project => {
  const projectMs = milestones.filter(m => m.project_id === project.id)
  const projectTasks = filteredTasks.filter(t => t.projectId === project.id)

  // 프로젝트 범위 바 (가장 이른 시작일 ~ 가장 늦은 종료일)
  const pStart = getEarliestDate(projectMs, projectTasks)
  const pEnd = getLatestDate(projectMs, projectTasks)

  return (
    <div key={project.id}>
      {/* 프로젝트 행 — 기존 프로젝트 헤더 스타일 그대로 사용 */}
      <ProjectRow
        project={project}
        startDate={pStart}
        endDate={pEnd}
        collapsed={collapsed.has(project.id)}
        onToggle={() => toggle(project.id)}
        depth={timelineDepth}
      />

      {/* depth가 'project'이면 여기서 끝 */}

      {/* depth가 'milestone' 이상이고 펼쳐져 있으면 */}
      {timelineDepth !== 'project' && !collapsed.has(project.id) && (
        <>
          {projectMs.map(ms => {
            const msTasks = projectTasks.filter(t => t.keyMilestoneId === ms.id)

            return (
              <div key={ms.id}>
                {/* 마일스톤 헤더 행 */}
                <MilestoneGanttRow
                  milestone={ms}
                  collapsed={collapsed.has(ms.id)}
                  onToggle={() => toggle(ms.id)}
                  hasChildren={timelineDepth === 'task' && msTasks.length > 0}
                />

                {/* depth가 'task'이고 펼쳐져 있으면 */}
                {timelineDepth === 'task' && !collapsed.has(ms.id) && (
                  msTasks.map(task => (
                    /* ★ 기존 간트 바 렌더링 컴포넌트를 그대로 사용 ★ */
                    <ExistingTaskGanttRow key={task.id} task={task} indent={2} />
                  ))
                )}
              </div>
            )
          })}

          {/* 백로그 (마일스톤 미연결 할일) */}
          {(() => {
            const backlogTasks = projectTasks.filter(t => !t.keyMilestoneId)
            if (backlogTasks.length === 0) return null
            return (
              <div>
                <MilestoneGanttRow
                  milestone={{ id: `${project.id}__backlog`, title: '백로그', color: '#b4b2a9' }}
                  collapsed={collapsed.has(`${project.id}__backlog`)}
                  onToggle={() => toggle(`${project.id}__backlog`)}
                  hasChildren={timelineDepth === 'task'}
                  isBacklog
                />
                {timelineDepth === 'task' && !collapsed.has(`${project.id}__backlog`) && (
                  backlogTasks.map(task => (
                    <ExistingTaskGanttRow key={task.id} task={task} indent={2} />
                  ))
                )}
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
})}
```

**"ExistingTaskGanttRow"는 기존 TimelineView에서 할일을 렌더링하는 컴포넌트/함수를 그대로 의미한다.** 실제 이름은 조사 단계에서 파악. 기존 간트 바 위 텍스트 표기, 기간 표시, 클릭 → 상세패널 등 모든 기능이 보존되어야 한다.

### 3-3. MilestoneGanttRow 컴포넌트

```
src/components/timeline/MilestoneGanttRow.jsx
```

마일스톤 헤더 행. 기존 타임라인의 행 높이/구조에 맞춰야 한다.

좌측 영역:
```
[▾] [●] 마일스톤 제목                    indent level 1
```

간트 영역:
```
     ▓▓▓▓▓▓▓▓▓▓▓▓     ← 마일스톤 색상, opacity 0.25 채움 + 0.4 border
```

스타일:
```javascript
// 마일스톤 바: 반투명 배경 + 얇은 border
{
  position: 'absolute',
  left: `${msStartPos}%`,
  width: `${msWidthPercent}%`,
  height: 16,  // 할일 바보다 약간 높거나 같게
  borderRadius: 3,
  background: `${ms.color}30`,  // 30 = ~19% opacity hex
  border: `1px solid ${ms.color}50`,  // 50 = ~31% opacity
  top: '50%',
  transform: 'translateY(-50%)',
}
```

마일스톤의 시작일/종료일 → 좌표 변환은 **기존 TimelineView의 날짜→좌표 함수를 반드시 재사용**한다. 새로 만들지 않는다.

### 3-4. 프로젝트 행 바 스타일 (depth에 따라)

- depth='project': 기존 프로젝트 바 스타일 그대로 (진한 바)
- depth='milestone' 또는 'task': 프로젝트 바를 매우 연하게 (opacity 0.15) 표시하고, 마일스톤 바가 시각적으로 더 눈에 띄게

### 3-5. 접기/펼치기 상태

```javascript
const [collapsed, setCollapsed] = useState(new Set())

const toggle = useCallback((id) => {
  setCollapsed(prev => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })
}, [])
```

프로젝트 ID, 마일스톤 ID, `{projectId}__backlog` 를 collapsed Set에서 관리.

---

## Phase 4: 프로젝트 타임라인 (ProjectLayer ptimeline 탭)

### 4-1. 현재 상태 파악

ProjectLayer.jsx에서 `tab='ptimeline'`일 때 어떤 컴포넌트가 렌더링되는지 확인:
- GanttMode / DetailMode가 있다면 → GanttMode를 확장
- 빈 상태라면 → ProjectTimelineView 신규 생성

### 4-2. 프로젝트 타임라인 구현

글로벌 타임라인과 동일한 간트 엔진을 사용하되:
- 필터 바 없음 (프로젝트 고정, 담당자 필터는 선택적으로 추가 가능)
- 뷰 깊이는 항상 "마일스톤 + 할일" (depth='task' 고정)
- 해당 프로젝트의 마일스톤 + 할일만 표시
- 접기/펼치기 동작

데이터:
```javascript
const { milestones } = useKeyMilestones(pkm?.id, projectId)
const projectTasks = tasks.filter(t => t.projectId === projectId && !t.deletedAt)
```

렌더링은 Phase 3의 마일스톤 그룹핑 코드에서 프로젝트 루프를 제거한 것과 동일:
```
▾ ● 공증 준비               ▓▓▓▓▓▓▓▓
    등기 서류 체크             ████████
    필요 서류 확인               ██████
▾ ● 안건자료 PPT                ▓▓▓▓▓▓▓▓
    안건 PPT — Jason            ████████
    안건 PPT — 재무제표           ██████
  ● 백로그
    Sifive 메일                 ████
```

### 4-3. 기존 타임라인 기능 보존

프로젝트 타임라인에서도 아래 기능이 모두 동작해야 한다:
- 간트 바 위 텍스트 표기 (기존 방식 그대로)
- 기간 표시 (기존 방식 그대로)
- 오늘 기준선
- 날짜 헤더 (주간/월간 스케일)
- 간트 바 클릭 → 상세패널
- DnD (기존에 있었다면)

**기존 TimelineView의 간트 렌더링 로직을 함수/컴포넌트로 추출하여 공유하는 것이 이상적.**
만약 추출이 너무 위험하면, 프로젝트 타임라인에서 글로벌 TimelineView를 프로젝트 필터 적용 상태로 렌더링하는 방식도 고려.

---

## Phase 5: 기존 '병렬 보기' 모드 정리

### 5-1. 확인

ProjectLayer.jsx에서 `tab='ptimeline'` 관련 ModeBar가 있는지 확인:
- GanttMode / DetailMode 전환이 있다면
- DetailMode (결과물+Task 병렬 보기)가 있다면

### 5-2. 제거 또는 유지 판단

마일스톤 그룹핑 간트가 병렬 보기의 역할을 대체하므로:
- **DetailMode / 병렬 보기 모드 자체는 이 Loop에서 제거하지 않는다** (안전을 위해)
- **ModeBar에서 모드 전환 버튼을 숨긴다** (또는 "타임라인" 하나만 남긴다)
- 추후 별도 정리 Loop에서 완전 제거

---

## 스타일 가이드

### 마일스톤 간트 바

```
배경: 마일스톤 color + opacity 0.25 (hex suffix '40')
Border: 마일스톤 color + opacity 0.4 (hex suffix '66'), 1px
높이: 16~18px
borderRadius: 3px
```

### 프로젝트 요약 바 (depth != 'project')

```
배경: 프로젝트 color + opacity 0.15
Border: 없음
높이: 10px
borderRadius: 3px
```

### 할일 간트 바

**기존 스타일 그대로 유지.** 기존 TimelineView에서 사용하는 바 스타일, 텍스트 표기, 기간 표시를 일절 변경하지 않는다.

### 좌측 목록 들여쓰기

```
프로젝트:   indent 0 (paddingLeft: 10px)
마일스톤:   indent 1 (paddingLeft: 26px) + 색상 dot 7×7
할일:       indent 2 (paddingLeft: 42px)
```

### 접기 화살표

```
▾ (펼침) / ▸ (접힘)
fontSize: 8~9px, color: #a09f99
transition: transform 0.15s
```

### 필터 바

```
background: #fafaf8
borderBottom: 0.5px solid #e8e6df
padding: 6px 14px
gap: 8px
flexWrap: wrap (좁은 화면 대응)
```

### 뷰 깊이 토글

```
배경: #f0efe8, borderRadius: 6, padding: 2
활성 버튼: background #fff, color #2C2C2A, fontWeight 600
비활성: background transparent, color #888780
fontSize: 11px
```

### 멀티셀렉트 드롭다운

```
버튼: border 0.5px solid #d3d1c7, borderRadius: 6, fontSize: 12
드롭다운: background #fff, border 0.5px solid #e8e6df, borderRadius: 8, boxShadow
체크박스: 14×14, borderRadius 3, 선택 시 background #1D9E75
선택 개수 뱃지: background #1D9E75, color #fff, borderRadius 999, fontSize: 10
```

---

## 검증 체크리스트

### 기존 기능 보존 (최우선)
- [ ] 기존 간트 바 렌더링 정상 (텍스트 표기, 기간 표시, 색상)
- [ ] 기존 날짜 헤더 정상 (주간/월간/분기/연간 전환)
- [ ] 오늘 기준선 정상
- [ ] 기존 DnD 정상 (있었다면)
- [ ] 간트 바 클릭 → 상세패널 정상
- [ ] 기존 뷰 모드 전환 정상

### 글로벌 타임라인 — 뷰 깊이
- [ ] "프로젝트" 모드: 프로젝트 바만 표시 (기존과 유사)
- [ ] "+ 마일스톤" 모드: 프로젝트 아래 마일스톤 헤더 바 표시
- [ ] "+ 할일" 모드: 마일스톤 아래 할일 간트 바 표시
- [ ] 깊이 전환 시 접기 상태 유지

### 글로벌 타임라인 — 필터
- [ ] 프로젝트 멀티셀렉트: 특정 프로젝트만 표시
- [ ] 담당자 멀티셀렉트: 특정 담당자 할일만 표시
- [ ] 전체 선택/해제 동작
- [ ] 필터 조합 (프로젝트 2개 + 담당자 1명)

### 글로벌 타임라인 — 마일스톤 표시
- [ ] 마일스톤 바가 start_date~end_date 범위로 정확히 표시
- [ ] 마일스톤 색상 반영 (반투명 + border)
- [ ] 마일스톤 제목이 좌측 목록에 표시
- [ ] 마일스톤 접기/펼치기 동작
- [ ] 백로그 행 (마일스톤 미연결 할일 그룹)

### 프로젝트 타임라인
- [ ] ProjectLayer ptimeline 탭에서 마일스톤 그룹핑 간트 표시
- [ ] 해당 프로젝트 마일스톤 + 할일만 표시
- [ ] 간트 바 기존 기능 모두 동작 (텍스트, 기간, 클릭)
- [ ] 접기/펼치기 동작

### 글로벌 동기화
- [ ] 글로벌 타임라인에서 할일 수정 → 프로젝트 마일스톤 뷰에 반영
- [ ] 프로젝트 마일스톤 뷰에서 할일 마일스톤 변경 → 글로벌 타임라인에 반영

### 회귀
- [ ] 오늘 할일, 전체 할일, 매트릭스 뷰 정상
- [ ] CompactMilestoneTab 정상
- [ ] TasksTab / MilestoneOutlinerView 정상
- [ ] DetailPanel 정상
- [ ] `npm run build` 성공

---

## 주의사항

1. **기존 TimelineView의 간트 바 렌더링을 수정하지 않는다** — 마일스톤 행은 추가 삽입이지 기존 교체가 아님
2. **날짜→좌표 변환 함수는 기존 것을 반드시 재사용** — 새로 만들면 기존 바와 위치가 어긋남
3. **DndContext가 있는 경우, 마일스톤 행은 DnD 대상이 아님** — 마일스톤 행은 시각적 그룹 헤더일 뿐
4. **useMilestonesByProjects 훅의 Supabase 쿼리는 project_id IN 필터 사용** — 빈 배열일 때 쿼리하지 않도록 guard
5. **collapsed Set에 프로젝트 ID와 마일스톤 ID가 섞임** — 충돌 없음 (UUID vs text 타입이라 자연 분리)
6. **updateTask(id, patch) 시그니처 엄수**
7. **기존 CSS 클래스 수정 금지** — 신규 스타일은 인라인 또는 신규 CSS 파일

---

## 작업 내역
(작업 완료 후 기록)
