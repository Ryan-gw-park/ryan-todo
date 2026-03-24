# Loop-27 — 프로젝트 마일스톤 뷰 컴팩트 개편

## 목표

기존 KeyMilestoneTab(좌우 분할, 마일스톤당 ~120px)을 **CompactMilestoneTab**(컴팩트 테이블 로우, 마일스톤당 ~40px)으로 교체한다.

핵심 변경:
1. 마일스톤 1행 = 좌측 마일스톤 정보 + 우측 연결된 할일 칩
2. 접기/펼치기로 상세(기간, 설명, 결과물) 표시
3. 마일스톤 간 할일 cross-container DnD
4. 백로그를 마일스톤 행으로 통합
5. 프로젝트 오너 변경 드롭다운

## 전제 조건

- 진단 보고서 커밋: bfedf2550c9facd3a01aa251a2244f1195d8337f
- DB 스키마 변경 없음 (`tasks.key_milestone_id`, `projects.owner_id` 이미 존재)

---

## 반드시 읽어야 할 파일 (작업 전)

```
docs/mockup-v8.html              # 있으면 참조 (없으면 무시)
src/components/project/KeyMilestoneTab.jsx   # 기존 구현 — 교체 대상, 구조 파악용
src/components/project/ProjectLayer.jsx      # 탭 라우팅 — 수정 지점
src/components/project/ProjectHeader.jsx     # 오너 드롭다운 추가 지점
src/components/shared/InlineAdd.jsx          # 재사용 대상
src/hooks/useKeyMilestones.js                # 재사용 — milestones CRUD
src/hooks/useKeyDeliverables.js              # 재사용 — deliverables CRUD
src/hooks/useKeyLinks.js                     # 재사용 — 참조문서
src/hooks/useKeyPolicies.js                  # 재사용 — 합의된 정책
src/hooks/useProjectKeyMilestone.js          # 재사용 — pkm 자동생성
src/hooks/useTeamMembers.js                  # 재사용 — 팀원 목록 (오너 드롭다운)
src/store/useStore.js                        # addTask, updateTask, toggleDone, openDetail, reorderTasks 확인
```

---

## "Don't Touch, Wrap It" 예외 선언

이 Loop에서는 **KeyMilestoneTab.jsx를 직접 수정하지 않고, 새로운 CompactMilestoneTab.jsx로 교체**한다.

수정 허용 파일:
- `ProjectLayer.jsx` — `tab='milestone'` 렌더링 대상을 KeyMilestoneTab → CompactMilestoneTab으로 교체
- `ProjectHeader.jsx` — 오너 변경 드롭다운 추가
- `useStore.js` — 필요한 경우에만 최소 수정 (새 액션 추가 시)

신규 생성 파일:
- `src/components/project/CompactMilestoneTab.jsx` — 메인 컴포넌트
- `src/components/project/CompactMilestoneRow.jsx` — 개별 마일스톤 행
- `src/components/project/MilestoneTaskChip.jsx` — 할일 칩 (DnD draggable)
- `src/components/project/OwnerDropdown.jsx` — 오너 선택 드롭다운

절대 수정 금지:
- `KeyMilestoneTab.jsx` — 삭제하지도 않는다 (fallback용 보존)
- `MatrixView.jsx`, `TeamMatrixView.jsx`, `TodayView.jsx`, `TimelineView.jsx`
- 기존 훅 파일들 (useKeyMilestones 등) — 읽기만
- `DetailPanel.jsx`, `MilestoneSelector.jsx`

---

## 단계별 구현

### Phase 1: CompactMilestoneTab 셸 + 기본 렌더링

**1-1. CompactMilestoneTab.jsx 생성**

```
src/components/project/CompactMilestoneTab.jsx
```

Props: `{ projectId }`

내부에서 사용할 훅:
```javascript
const { pkm, loading: pkmLoading } = useProjectKeyMilestone(projectId)
const { milestones, add: addMilestone, update: updateMilestone, remove: removeMilestone, reorder: reorderMilestones } = useKeyMilestones(pkm?.id, projectId)
const { deliverables, add: addDeliverable, getByMilestone } = useKeyDeliverables(pkm?.id, projectId)
const { items: links } = useKeyLinks(pkm?.id, projectId)
const { items: policies } = useKeyPolicies(pkm?.id, projectId)

// Zustand store
const tasks = useStore(s => s.tasks)
const addTask = useStore(s => s.addTask)
const updateTask = useStore(s => s.updateTask)
const toggleDone = useStore(s => s.toggleDone)
const openDetail = useStore(s => s.openDetail)
```

할일 필터링:
```javascript
const projectTasks = useMemo(() =>
  tasks.filter(t => t.projectId === projectId && !t.deletedAt),
  [tasks, projectId]
)

// 마일스톤별 할일 그룹
const getTasksForMilestone = useCallback((msId) =>
  projectTasks.filter(t => t.keyMilestoneId === msId && !t.done)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
  [projectTasks]
)

// 백로그 할일 (keyMilestoneId가 null이고 완료 아닌 것)
const backlogTasks = useMemo(() =>
  projectTasks.filter(t => !t.keyMilestoneId && !t.done)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
  [projectTasks]
)
```

상태:
```javascript
const [expandedMs, setExpandedMs] = useState(new Set())  // 펼쳐진 마일스톤 ID 집합
```

**1-2. 레이아웃 구조 (목업 기준)**

```
┌─────────────────────────────────────────────────────────────────────┐
│ [▾ 펼치기]  마일스톤                    │  연결된 할일              │ ← sticky 컬럼헤더
├─────────────────────────────────────────┼───────────────────────────┤
│ ⠿ ▾ ● 주주분류 + 1% 이상 개별 연락     │ [✓주주명부] [○1%연락] 1/2 │ ← 접힌 상태
├─────────────────────────────────────────┼───────────────────────────┤
│ ⠿ ▾ ● 위임장 발송 + 등기 서류 취합     │ [○위임:본+산은] [○Sifive] │ ← 펼친 상태
│      2026.03.13 → 2026.03.17          │ [+ 추가]              0/2 │
│      본사 + 산은 위임장 포함            │                           │
│      • 결과물 추가                      │                           │
├─────────────────────────────────────────┼───────────────────────────┤
│ + 마일스톤 추가                         │                           │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┼ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│   ▾ ● 백로그                            │ [○Sifive 메일] [+ 추가]  │ ← 점선 위 고정
├─────────────────────────────────────────┴───────────────────────────┤
│ 📎 참조 문서 (0)                                                    │
│ ✓ 합의된 정책 (0)                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

핵심 레이아웃 규칙:
- 전체: `display: flex; flex-direction: column`
- 각 행: `display: flex; align-items: stretch` — 좌측(flex:1) + 우측(width: 400px, borderLeft)
- 행이 펼쳐지면 좌측 높이가 늘어나고, 우측도 함께 늘어남 (flex stretch)
- 접힌 상태 행 높이: ~40px. 펼친 상태: 내용에 따라 가변
- 접힌 상태에서 할일 칩은 최대 2개만 프리뷰 + "+N개 더보기" 뱃지
- 펼치면 모든 할일 칩 표시

**1-3. 컬럼 헤더 (sticky)**

```jsx
<div style={{
  display: 'flex', alignItems: 'center', height: 30, padding: '0 12px',
  background: '#fafaf8', borderBottom: '0.5px solid #e8e6df',
  fontSize: 10.5, color: '#b4b2a9', fontWeight: 600,
  position: 'sticky', top: 0, zIndex: 2,
}}>
  <button onClick={toggleExpandAll} style={{ /* 전체 펼치기/접기 */ }}>
    <span style={{ transform: allExpanded ? 'none' : 'rotate(-90deg)' }}>▾</span>
    {allExpanded ? '접기' : '펼치기'}
  </button>
  <div style={{ flex: 1, paddingLeft: 22 }}>마일스톤</div>
  <div style={{ width: 400, flexShrink: 0, paddingLeft: 12 }}>연결된 할일</div>
</div>
```

전체 펼치기/접기 로직:
```javascript
const allMsIds = useMemo(() => [...milestones.map(m => m.id), '__backlog__'], [milestones])
const allExpanded = expandedMs.size >= allMsIds.length

const toggleExpandAll = useCallback(() => {
  if (allExpanded) setExpandedMs(new Set())
  else setExpandedMs(new Set(allMsIds))
}, [allExpanded, allMsIds])
```

**1-4. ProjectLayer.jsx 수정**

```javascript
// 변경 전
import KeyMilestoneTab from './KeyMilestoneTab'
// tab === 'milestone' → <KeyMilestoneTab projectId={projectId} />

// 변경 후
import CompactMilestoneTab from './CompactMilestoneTab'
// tab === 'milestone' → <CompactMilestoneTab projectId={projectId} />
```

KeyMilestoneTab import는 제거하되, 파일 자체는 삭제하지 않는다.

---

### Phase 2: CompactMilestoneRow 컴포넌트

**2-1. CompactMilestoneRow.jsx 생성**

```
src/components/project/CompactMilestoneRow.jsx
```

Props:
```typescript
{
  milestone: object,        // key_milestones row 또는 백로그 가상 객체
  tasks: array,             // 이 마일스톤에 연결된 할일 배열
  expanded: boolean,
  onToggleExpand: (msId) => void,
  onTaskToggle: (taskId) => void,
  onAddTask: (msId, text) => void,
  onTaskClick: (task) => void,
  onTaskDrop: (taskId, targetMsId) => void,  // DnD 드랍 핸들러
  isDragOver: boolean,
  isBacklog: boolean,
}
```

**2-2. 좌측 영역 (마일스톤 정보)**

접힌 상태 (한 줄):
```
[드래그그립 ⠿] [▾] [●] 마일스톤 제목 (줄임 없음)     [프로그레스 ▪▪▪ 1/2]
```

펼친 상태 (확장):
```
[드래그그립 ⠿] [▾] [●] 마일스톤 제목
                       2026.03.13 → 2026.03.17       ← 기간 (연한 색 #ccc9c0)
                       설명 텍스트                     ← 설명 (#a09f99)
                       • 결과물 추가                   ← 결과물 (#c4c2ba)
```

펼침 영역 순서: **기간 → 설명 → 결과물** (이 순서 반드시 준수)

마일스톤 제목: `whiteSpace: 'normal'` — 줄바꿈 허용, 줄임 없음.

기간 표시: `YYYY.MM.DD → YYYY.MM.DD` 형식, 색상 `#ccc9c0` (매우 연함). **D-day 표시 없음.**

백로그 행: 드래그 그립 없음, 기간 없음, 결과물 없음, 색상 dot `#b4b2a9`.

프로그레스 뱃지 (할일 있을 때만):
```
[▪▪▪▪░░] 2/5     ← 미니 프로그레스 바 (width: 32px) + 완료/전체 텍스트
```
- 바 배경: `#eeeee6`, 채움: `#1D9E75`
- 텍스트: `9.5px, #b4b2a9, tabular-nums`

**2-3. 우측 영역 (연결된 할일)**

```
width: 400px, borderLeft: '0.5px solid #f0efe8'
```

접힌 상태: 할일 칩 최대 2개 + "+N개 더보기" 뱃지 + "+ 추가" 버튼
펼친 상태: 모든 할일 칩 + "+ 추가" 버튼

빈 상태 (할일 0개):
```
┌─────────────────────────────────────┐
│   할일을 드래그하여 연결   [+ 추가]  │  ← 점선 border, 드래그 드랍 존
└─────────────────────────────────────┘
```
- `border: 1.5px dashed #e0ddd6`, 드래그 오버 시 `borderColor: '#1D9E75', background: '#f0fdf4'`

**2-4. 호버/펼침 시각 피드백**

```javascript
background: isDragOver ? '#f0fdf4'   // 드래그 오버
          : expanded   ? '#fafaf8'   // 펼침
          : hover      ? '#fdfcfa'   // 호버
          : 'transparent'

boxShadow: isDragOver ? 'inset 0 0 0 1.5px #1D9E75' : 'none'
```

드래그 그립 `⠿`: 호버 시에만 표시 (`opacity: hover ? 0.8 : 0`)

---

### Phase 3: DnD — 마일스톤 순서 + 할일 마일스톤간 이동

**3-1. DnD 전략: 단일 DndContext + 듀얼 타입**

기존 KeyMilestoneTab의 2개 독립 DndContext를 1개로 통합한다.

```
CompactMilestoneTab
└── DndContext (단일)
    ├── SortableContext (milestones — 마일스톤 순서 DnD)
    │   ├── SortableMilestoneRow (m1)
    │   ├── SortableMilestoneRow (m2)
    │   └── ...
    └── 각 행 내부
        └── useDroppable (milestone:{msId} — 할일 드랍 존)
            └── DraggableTaskChip ×N (할일 칩 — useDraggable)
```

**3-2. 드래그 타입 구분**

draggable 아이템에 `data` 속성으로 타입을 구분한다:

```javascript
// 마일스톤 순서 DnD
useSortable({ id: ms.id, data: { type: 'milestone' } })

// 할일 칩 DnD
useDraggable({ id: task.id, data: { type: 'task', taskId: task.id, sourceMsId: ms.id } })
```

**3-3. 드랍존 설정**

각 마일스톤 행의 우측 할일 영역:
```javascript
const { setNodeRef, isOver } = useDroppable({
  id: `milestone:${ms.id}`,
  data: { type: 'milestone-drop', milestoneId: ms.id }
})
```

백로그 행:
```javascript
const { setNodeRef, isOver } = useDroppable({
  id: 'milestone:__backlog__',
  data: { type: 'milestone-drop', milestoneId: null }
})
```

**3-4. onDragEnd 핸들러**

```javascript
const handleDragEnd = useCallback((event) => {
  const { active, over } = event
  if (!over) return

  const activeData = active.data.current
  const overData = over.data.current

  // Case 1: 마일스톤 순서 변경
  if (activeData?.type === 'milestone' && overData?.type === 'milestone') {
    if (active.id !== over.id) {
      const oldIndex = milestones.findIndex(m => m.id === active.id)
      const newIndex = milestones.findIndex(m => m.id === over.id)
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderMilestones(arrayMove([...milestones], oldIndex, newIndex))
      }
    }
    return
  }

  // Case 2: 할일을 다른 마일스톤으로 이동
  if (activeData?.type === 'task') {
    let targetMsId = null

    // 드랍존 위에 놓았을 때
    if (overData?.type === 'milestone-drop') {
      targetMsId = overData.milestoneId  // null이면 백로그
    }
    // 다른 할일 칩 위에 놓았을 때 → 그 칩의 마일스톤으로 이동
    else if (overData?.type === 'task') {
      targetMsId = overData.sourceMsId
    }
    // 마일스톤 행 자체 위에 놓았을 때
    else if (overData?.type === 'milestone') {
      targetMsId = over.id
    }

    if (targetMsId !== undefined && activeData.sourceMsId !== targetMsId) {
      // keyMilestoneId 변경: targetMsId가 '__backlog__'이면 null, 아니면 그대로
      const newKeyMilestoneId = (targetMsId === '__backlog__' || targetMsId === null) ? null : targetMsId
      updateTask(activeData.taskId, { keyMilestoneId: newKeyMilestoneId })
    }
    return
  }
}, [milestones, reorderMilestones, updateTask])
```

**3-5. 센서 + 충돌 감지**

MatrixView와 동일한 센서 설정 사용:
```javascript
const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
const sensors = useSensors(pointerSensor, touchSensor)
```

충돌 감지: `pointerWithin` 또는 `closestCenter`. 테스트 후 결정.

**3-6. 마일스톤 순서 DnD에서 백로그 제외**

SortableContext의 items에 백로그를 포함하지 않는다:
```javascript
<SortableContext items={milestones.map(m => m.id)} strategy={verticalListSortingStrategy}>
  {/* 마일스톤 행들 */}
</SortableContext>
{/* 백로그 행은 SortableContext 밖 */}
```

---

### Phase 4: MilestoneTaskChip + 인라인 할일 입력

**4-1. MilestoneTaskChip.jsx**

기존 `InlineAdd.jsx`의 패턴과 MatrixCard의 인라인 편집 패턴을 참조하되, 칩 형태로 구현.

```
src/components/project/MilestoneTaskChip.jsx
```

기능:
- 체크 원형 클릭 → `toggleDone(task.id)` (useStore)
- 칩 전체 클릭 → `openDetail(task)` (useStore)
- `useDraggable` 적용 → 마일스톤 간 DnD
- 드래그 시 시각 피드백: `border: 1px dashed #1D9E75, background: #e8f5e9`

칩 스타일:
```
background: #f5f4f0, borderRadius: 5, padding: 3px 8px, fontSize: 12
완료 시: 체크 원형 초록, 텍스트 line-through + #c4c2ba
```

**4-2. 인라인 할일 추가**

기존 `InlineAdd.jsx`를 재사용하되, extraFields에 keyMilestoneId를 포함:
```javascript
<InlineAdd
  projectId={projectId}
  category="today"
  extraFields={{ keyMilestoneId: ms.id }}
  placeholder="+ 추가"
/>
```

만약 InlineAdd가 extraFields를 지원하지 않는다면, 로컬에서 간단한 인라인 입력 컴포넌트를 만든다:
```javascript
function MilestoneInlineAdd({ projectId, milestoneId }) {
  const addTask = useStore(s => s.addTask)
  const [text, setText] = useState('')
  const [active, setActive] = useState(false)

  const handleSubmit = () => {
    if (!text.trim()) { setActive(false); return }
    addTask({
      text: text.trim(),
      projectId,
      category: 'today',
      keyMilestoneId: milestoneId || null,  // null이면 백로그
    })
    setText('')
  }
  // ... Enter/Escape 핸들링, blur 시 저장
}
```

---

### Phase 5: 백로그 행 + "+ 마일스톤 추가"

**5-1. 백로그를 마일스톤 행으로 표시**

마일스톤 목록 아래, `+ 마일스톤 추가` 아래에 점선 구분선(`borderTop: 1.5px dashed #e8e6df`)을 두고 백로그 행을 렌더링한다.

```jsx
{/* 일반 마일스톤 행들 */}
{sorted.map(ms => <CompactMilestoneRow ... />)}

{/* 마일스톤 추가 */}
<div onClick={handleAddMilestone} style={{ /* + 마일스톤 추가 */ }}>
  + 마일스톤 추가
</div>

{/* 백로그 — 항상 최하단 */}
<div style={{ borderTop: '1.5px dashed #e8e6df' }}>
  <CompactMilestoneRow
    milestone={{ id: '__backlog__', title: '백로그', color: '#b4b2a9' }}
    tasks={backlogTasks}
    expanded={expandedMs.has('__backlog__')}
    isBacklog={true}
    ...
  />
</div>
```

백로그 행 특성:
- 드래그 그립 없음 (순서 변경 불가, 항상 최하단)
- 기간 없음
- 결과물 추가 없음
- 색상 dot: `#b4b2a9` (회색)

**5-2. 마일스톤 추가**

```javascript
const handleAddMilestone = async () => {
  const newMs = await addMilestone({
    title: '새 마일스톤',
    sortOrder: milestones.length,
  })
  if (newMs) {
    setExpandedMs(prev => new Set([...prev, newMs.id]))
    // 제목 인라인 편집 모드 자동 진입 (가능하면)
  }
}
```

---

### Phase 6: 프로젝트 오너 변경 드롭다운

**6-1. OwnerDropdown.jsx 생성**

```
src/components/project/OwnerDropdown.jsx
```

Props: `{ projectId, ownerId, onChangeOwner }`

```javascript
function OwnerDropdown({ projectId, ownerId, onChangeOwner }) {
  const [open, setOpen] = useState(false)
  const currentTeamId = useStore(s => s.currentTeamId)
  const members = useTeamMembers.getMembers(currentTeamId)
  const owner = members?.find(m => m.userId === ownerId)
  const ref = useRef(null)

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <span ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{ /* 미지정 ▾ 또는 이름 ▾ */ }}>
        {owner?.displayName || '미지정'} ▾
      </button>
      {open && (
        <div style={{ position: 'absolute', ... }}>
          <div onClick={() => { onChangeOwner(null); setOpen(false) }}>✕ 미지정</div>
          {members?.map(m => (
            <div key={m.userId} onClick={() => { onChangeOwner(m.userId); setOpen(false) }}>
              {/* 아바타 + 이름 */}
            </div>
          ))}
        </div>
      )}
    </span>
  )
}
```

**6-2. ProjectHeader.jsx 수정**

기존 "오너 : {ownerName || '미지정'}" 텍스트를 OwnerDropdown으로 교체:

```javascript
// 변경 전 (lines 14-26 근처)
<span>오너 : {ownerName || '미지정'}</span>

// 변경 후
<span>오너 : </span>
<OwnerDropdown
  projectId={project.id}
  ownerId={project.ownerId}
  onChangeOwner={(newOwnerId) => updateProject(project.id, { ownerId: newOwnerId })}
/>
```

`updateProject`이 useStore에 없으면 Supabase 직접 호출:
```javascript
const handleChangeOwner = async (newOwnerId) => {
  await supabase.from('projects').update({ owner_id: newOwnerId }).eq('id', project.id)
  // 로컬 상태 반영 — useStore.updateProject 또는 projects 리로드
}
```

---

### Phase 7: 하단 접힌 섹션 (참조문서 + 합의된 정책)

기존 KeyMilestoneTab의 CollapsibleSection 패턴을 그대로 복제하거나, 동일한 컴포넌트가 export되어 있으면 import해서 사용한다.

```jsx
{/* 참조 문서 */}
<CollapsibleSection title="📎 참조 문서" count={links.length}>
  {/* links 목록 */}
</CollapsibleSection>

{/* 합의된 정책 */}
<CollapsibleSection title="✓ 합의된 정책" count={policies.length}>
  {/* policies 목록 */}
</CollapsibleSection>
```

만약 CollapsibleSection이 별도 export되어 있지 않으면, CompactMilestoneTab 내부에 간단히 구현:
```jsx
function FooterSection({ icon, label, count, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderTop: '0.5px solid #f0efe8' }}>
      <div onClick={() => setOpen(!open)} style={{ fontSize: 11, color: '#c4c2ba', cursor: 'pointer', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon} {label} <span style={{ fontSize: 9.5, background: '#eeeee6', borderRadius: 999, padding: '0 5px' }}>{count}</span>
      </div>
      {open && <div style={{ padding: '0 16px 8px' }}>{children}</div>}
    </div>
  )
}
```

---

## 스타일 가이드 (목업 기준)

### 색상 팔레트
| 용도 | 색상 |
|------|------|
| 마일스톤 기본 dot | `#1D9E75` |
| 마일스톤 긴급 dot | `#D85A30` |
| 백로그 dot | `#b4b2a9` |
| 행 배경 (기본) | `transparent` |
| 행 배경 (호버) | `#fdfcfa` |
| 행 배경 (펼침) | `#fafaf8` |
| 행 배경 (드래그 오버) | `#f0fdf4` |
| 드래그 오버 border | `inset 0 0 0 1.5px #1D9E75` |
| 할일 칩 배경 | `#f5f4f0` |
| 할일 칩 드래그 중 | `#e8f5e9 + border 1px dashed #1D9E75` |
| 컬럼 헤더 배경 | `#fafaf8` |
| 기간 텍스트 | `#ccc9c0` (매우 연함) |
| 설명 텍스트 | `#a09f99` |
| 결과물 추가 텍스트 | `#c4c2ba` |
| 드래그 그립 | `#d3d1c7` |
| 프로그레스 바 배경 | `#eeeee6` |
| 프로그레스 바 채움 | `#1D9E75` |
| + 추가 / 비활성 텍스트 | `#c4c2ba` |
| 오너 미지정 텍스트 | `#D85A30` |
| 행 구분선 | `0.5px solid #f0efe8` |
| 백로그 구분선 | `1.5px dashed #e8e6df` |

### 폰트 크기
| 요소 | 크기 |
|------|------|
| 마일스톤 제목 | 13px, fontWeight 500 |
| 할일 칩 텍스트 | 12px |
| 기간 | 10.5px |
| 설명 | 11.5px |
| 프로그레스 카운트 | 9.5px |
| 컬럼 헤더 | 10.5px, fontWeight 600 |
| "+ 추가" 류 | 11px |

---

## 검증 체크리스트

### 기본 렌더링
- [ ] 마일스톤 8개 + 백로그 1개 = 총 9행 표시
- [ ] 접힌 상태에서 8개 마일스톤이 스크롤 없이 한 화면에 보이는가
- [ ] 마일스톤 제목이 줄임 없이 전체 표시되는가
- [ ] 접힌 상태에서 할일 칩이 최대 2개 + "+N개 더보기" 표시
- [ ] 프로그레스 바 + 완료/전체 카운트 정확한가

### 펼치기/접기
- [ ] 개별 마일스톤 ▾ 클릭 → 행이 확장 (분리 영역 아님)
- [ ] 펼치면 기간 → 설명 → 결과물 추가 순서로 표시
- [ ] 펼치면 우측 할일 영역도 모든 칩이 보이는가
- [ ] 전체 펼치기/접기 토글 정상 동작
- [ ] 기간은 `#ccc9c0`으로 연하게 표시
- [ ] D-day가 어디에도 표시되지 않는 것을 확인

### DnD — 마일스톤 순서
- [ ] 마일스톤 행 드래그 그립으로 순서 변경 가능
- [ ] 백로그 행은 드래그 불가 (항상 최하단)
- [ ] 순서 변경 후 DB에 반영 (reorderMilestones)

### DnD — 할일 마일스톤 간 이동
- [ ] 할일 칩을 다른 마일스톤 행에 드랍 → keyMilestoneId 변경
- [ ] 할일 칩을 백로그 행에 드랍 → keyMilestoneId = null
- [ ] 백로그 칩을 마일스톤 행에 드랍 → keyMilestoneId = msId
- [ ] 빈 마일스톤에 드래그 오버 시 점선 드랍존 강조 (초록)
- [ ] 드랍 후 글로벌 뷰(오늘 할일, 매트릭스)에 즉시 반영 (Zustand 자동)

### 할일 인터랙션
- [ ] 체크 원형 클릭 → 완료 토글 (취소선 + 초록 체크)
- [ ] 할일 칩 클릭 → DetailPanel 열림 (openDetail)
- [ ] "+ 추가" 클릭 → 인라인 입력 → Enter → 할일 생성 (keyMilestoneId 설정됨)
- [ ] 백로그에서 할일 추가 시 keyMilestoneId = null

### 프로젝트 오너
- [ ] 헤더 "오너: 미지정 ▾" 클릭 → 팀원 드롭다운 표시
- [ ] 팀원 선택 → owner_id DB 저장 → 헤더에 이름 반영
- [ ] "미지정" 선택 → owner_id = null

### 글로벌 동기화
- [ ] 프로젝트 뷰에서 할일 생성 → 오늘 할일/매트릭스에 즉시 표시
- [ ] 매트릭스에서 할일 완료 → 프로젝트 마일스톤 뷰에서 칩 체크 반영
- [ ] DetailPanel에서 마일스톤 변경 → 컴팩트 뷰에서 칩 이동 반영

### 회귀 검증
- [ ] 할일 탭 (TasksTab / MilestoneOutlinerView) 정상 동작
- [ ] 타임라인 탭 정상 동작
- [ ] 글로벌 오늘 할일, 전체 할일, 매트릭스, 타임라인, 노트 뷰 정상
- [ ] DetailPanel 정상 (MilestoneSelector 포함)
- [ ] 모바일 레이아웃 깨지지 않는가
- [ ] `npm run build` 성공

---

## 주의사항

1. **updateTask(id, patch) 시그니처 엄수** — `updateTask({...task})` 형태 절대 사용 금지
2. **KeyMilestoneTab.jsx 수정/삭제 금지** — fallback 보존. ProjectLayer의 import만 교체
3. **DndContext 중첩 금지** — 단일 DndContext 안에서 마일스톤 sortable + 할일 draggable/droppable 모두 처리
4. **백로그 행의 onDrop에서 keyMilestoneId = null 설정** — `__backlog__` 문자열을 DB에 저장하지 않는다
5. **기존 훅(useKeyMilestones 등) 수정 금지** — 반환값을 그대로 사용
6. **CSS 파일 수정 금지** — 모든 스타일은 인라인 또는 신규 CSS 파일로 처리
7. **전체 펼치기/접기의 allMsIds에 '__backlog__' 포함** — 백로그도 펼침/접힘 대상

---

## 작업 내역
(작업 완료 후 기록)
