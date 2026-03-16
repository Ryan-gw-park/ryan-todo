# Loop-26.3 — Reference 탭 구현

## 목표
프로젝트 레이어의 **Reference 탭** 완전 구현:
- 좌측: 주요 일정 (마일스톤)
- 우측: 핵심 결과물 (마일스톤별 연결)
- 하단 접힌 섹션: 참조 문서 / 합의된 정책
- 모든 섹션 인라인 CRUD + 자동 저장

---

## 전제 조건
- Loop-26.0 완료 (6개 신규 테이블, RLS 정책)
- Loop-26.2 완료 (ProjectLayer 셸, ReferenceTab 빈 상태)

---

## 핵심 원칙

1. **기존 코드 수정 금지** — 기존 뷰, 스토어 액션, 공유 컴포넌트 일절 변경 없음
2. **Supabase 직접 호출** — Reference 데이터는 Zustand store에 넣지 않는다. 각 탭에서 독립적으로 Supabase를 호출하는 커스텀 훅 사용. (기존 store의 tasks/projects 데이터 흐름과 격리)
3. **인라인 편집 UX** — 클릭하면 바로 편집, blur 시 자동 저장, 저장 버튼 없음
4. **인라인 스타일** — 기존 앱 패턴과 동일하게 인라인 스타일 사용

---

## 영향받는 파일

### 수정 대상
| 파일 | 변경 | 규모 |
|------|------|------|
| `src/components/project/ReferenceTab.jsx` | 임시 내용 → 실제 구현으로 교체 | L |

### 신규 생성
| 파일 | 역할 |
|------|------|
| `src/hooks/useProjectReference.js` | project_references 자동 초기화 + 조회 |
| `src/hooks/useRefMilestones.js` | ref_milestones CRUD |
| `src/hooks/useRefDeliverables.js` | ref_deliverables CRUD |
| `src/hooks/useRefLinks.js` | ref_links CRUD |
| `src/hooks/useRefPolicies.js` | ref_policies CRUD |
| `src/components/project/MilestoneItem.jsx` | 마일스톤 항목 (인라인 편집) |
| `src/components/project/DeliverableItem.jsx` | 결과물 항목 (인라인 편집) |

### 수정 금지
- `src/hooks/useStore.js`
- `src/components/shared/*`
- 기존 모든 뷰

---

## 훅 명세

### useProjectReference(projectId)

```javascript
// src/hooks/useProjectReference.js
import { useState, useEffect } from 'react'
import { getDb } from '../utils/supabase'

export function useProjectReference(projectId) {
  const [reference, setReference] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    init(projectId)
  }, [projectId])

  async function init(pid) {
    setLoading(true)
    const db = getDb()

    // 1. 조회
    let { data } = await db
      .from('project_references')
      .select('*')
      .eq('project_id', pid)
      .single()

    // 2. 없으면 자동 생성
    if (!data) {
      const { data: created } = await db
        .from('project_references')
        .insert({ project_id: pid })
        .select()
        .single()
      data = created
    }

    setReference(data)
    setLoading(false)
  }

  return { reference, loading }
}
```

### useRefMilestones(referenceId, projectId)

```javascript
// src/hooks/useRefMilestones.js
export function useRefMilestones(referenceId, projectId) {
  const [milestones, setMilestones] = useState([])

  useEffect(() => {
    if (!referenceId) return
    load()
  }, [referenceId])

  async function load() {
    const db = getDb()
    const { data } = await db
      .from('ref_milestones')
      .select('*')
      .eq('reference_id', referenceId)
      .order('sort_order', { ascending: true })
    setMilestones(data || [])
  }

  async function add() {
    const db = getDb()
    const { data } = await db
      .from('ref_milestones')
      .insert({
        reference_id: referenceId,
        project_id: projectId,
        title: '',
        sort_order: milestones.length,
      })
      .select()
      .single()
    if (data) setMilestones(prev => [...prev, data])
    return data
  }

  async function update(id, patch) {
    const db = getDb()
    await db.from('ref_milestones')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
  }

  async function remove(id) {
    const db = getDb()
    await db.from('ref_milestones').delete().eq('id', id)
    setMilestones(prev => prev.filter(m => m.id !== id))
  }

  return { milestones, add, update, remove, reload: load }
}
```

> `useRefDeliverables`, `useRefLinks`, `useRefPolicies`도 **동일 패턴**.
> 각 훅의 add/update/remove 시그니처 통일.
> `useRefDeliverables`는 추가로 `milestone_id` 필터링 지원.

---

## ReferenceTab.jsx 전체 구조

```jsx
export default function ReferenceTab({ projectId }) {
  const { reference, loading } = useProjectReference(projectId)

  if (loading) return <RefSkeleton />
  if (!reference) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 메인 영역: 좌 마일스톤 | 우 결과물 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* 컬럼 헤더 (sticky) */}
        <ColumnHeaders />

        {/* 마일스톤별 행 */}
        <MilestoneRows
          referenceId={reference.id}
          projectId={projectId}
        />
      </div>

      {/* 하단 접힌 섹션 */}
      <div style={{ borderTop: '0.5px solid #e8e6df', flexShrink: 0, background: '#fafaf8' }}>
        <CollapsibleSection
          icon="🔗" title="참조 문서"
          referenceId={reference.id}
          projectId={projectId}
          type="links"
        />
        <CollapsibleSection
          icon="✓" title="합의된 정책"
          referenceId={reference.id}
          projectId={projectId}
          type="policies"
        />
      </div>
    </div>
  )
}
```

---

## 마일스톤-결과물 좌우 레이아웃

### ColumnHeaders

```jsx
function ColumnHeaders({ milestoneCount, deliverableCount }) {
  return (
    <div style={{
      display: 'flex', position: 'sticky', top: 0, zIndex: 3,
      background: '#fff', borderBottom: '0.5px solid #e8e6df',
    }}>
      <div style={{ flex: 1, padding: '8px 22px', fontSize: 11, fontWeight: 600, color: '#a09f99' }}>
        📅 주요 일정 {milestoneCount}
      </div>
      <div style={{ flex: 1, padding: '8px 18px', fontSize: 11, fontWeight: 600, color: '#a09f99', borderLeft: '0.5px solid #e8e6df' }}>
        📋 핵심 결과물 {deliverableCount}
      </div>
    </div>
  )
}
```

### MilestoneRow (한 행 = 좌측 마일스톤 + 우측 결과물들)

```jsx
function MilestoneRow({ milestone, deliverables, onUpdateMilestone, onAddDeliverable, ... }) {
  return (
    <div style={{ display: 'flex', borderBottom: '0.5px solid #eeedea', minHeight: 72 }}>
      {/* 좌측: 마일스톤 */}
      <div style={{ flex: 1, padding: '14px 22px', borderRight: '0.5px solid #eeedea' }}>
        <MilestoneItem milestone={milestone} onUpdate={onUpdateMilestone} />
      </div>

      {/* 우측: 결과물 */}
      <div style={{ flex: 1, padding: '10px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
        {deliverables.map(d => (
          <DeliverableItem
            key={d.id}
            deliverable={d}
            milestoneColor={milestone.color}
            onUpdate={...}
            onDelete={...}
          />
        ))}
        <AddButton label="+ 결과물 추가" onClick={() => onAddDeliverable(milestone.id)} />

        {deliverables.length === 0 && (
          <EmptyState text="결과물 없음" onAdd={() => onAddDeliverable(milestone.id)} />
        )}
      </div>
    </div>
  )
}
```

---

## MilestoneItem.jsx 인라인 편집

```jsx
function MilestoneItem({ milestone, onUpdate, onDelete }) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(milestone.title)
  const [hovered, setHovered] = useState(false)

  function handleTitleBlur() {
    if (!title.trim()) {
      // 빈 제목 + 새로 생성된 항목 → 삭제
      if (!milestone.title) { onDelete(milestone.id); return }
      // 기존 데이터가 있던 항목 → 원복
      setTitle(milestone.title); setEditingTitle(false); return
    }
    if (title !== milestone.title) onUpdate(milestone.id, { title })
    setEditingTitle(false)
  }

  const isUrgent = milestone.end_date && daysUntil(milestone.end_date) <= 7 && daysUntil(milestone.end_date) >= 0

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
    >
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: milestone.color || '#1D9E75', marginTop: 4, flexShrink: 0 }} />

      <div style={{ flex: 1 }}>
        {editingTitle ? (
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => { if (e.key === 'Escape') { setTitle(milestone.title); setEditingTitle(false) } }}
            autoFocus
            style={{ fontSize: 14, fontWeight: 600, border: 'none', outline: 'none', width: '100%', background: 'transparent' }}
          />
        ) : (
          <div onClick={() => setEditingTitle(true)} style={{ fontSize: 14, fontWeight: 600, cursor: 'text' }}>
            {milestone.title || <span style={{ color: '#b4b2a9' }}>마일스톤 제목...</span>}
          </div>
        )}

        {/* 설명 (동일 인라인 편집 패턴) */}
        <DescriptionField
          value={milestone.description}
          onSave={(desc) => onUpdate(milestone.id, { description: desc })}
        />
      </div>

      {/* 날짜 */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <DateField
          startDate={milestone.start_date}
          endDate={milestone.end_date}
          onSave={(dates) => onUpdate(milestone.id, dates)}
          urgent={isUrgent}
        />
        {milestone.end_date && (
          <span style={{ fontSize: 10, color: isUrgent ? '#BA7517' : '#b4b2a9', display: 'block', marginTop: 1 }}>
            D{daysUntil(milestone.end_date)}
          </span>
        )}
      </div>

      {/* 삭제 (hover 시만) */}
      {hovered && (
        <button onClick={() => onDelete(milestone.id)} style={{ /* × 버튼 스타일 */ }}>×</button>
      )}
    </div>
  )
}
```

> **빈 제목 blur 정책 수정 (기존 설계 대비):**
> - 새로 생성한 항목(title이 ''): blur 시 삭제
> - 기존 데이터가 있던 항목: blur 시 원복 (실수 방지)

---

## DeliverableItem.jsx

```jsx
function DeliverableItem({ deliverable, milestoneColor, onUpdate, onDelete }) {
  // Task 연결 수 조회
  const taskCount = useStore(s =>
    s.tasks.filter(t => t.deliverableId === deliverable.id && !t.deletedAt && !t.done).length
  )

  return (
    <div style={{
      padding: '9px 12px', background: '#fafaf8', borderRadius: 7,
      borderLeft: `3px solid ${milestoneColor}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: '#b4b2a9', fontWeight: 600 }}>{deliverable.sort_order + 1 || ''}</span>
        {/* 인라인 편집 가능한 제목 */}
        <InlineTitle value={deliverable.title} onSave={title => onUpdate(deliverable.id, { title })} />
        <span style={{ fontSize: 11, color: '#6b6a66', flexShrink: 0 }}>
          {/* 담당자 표시 — assignee_ids 배열에서 이름 조회 */}
          {deliverable.assignee_ids?.join(' · ') || ''}
        </span>
      </div>

      <InlineDescription value={deliverable.description} onSave={desc => onUpdate(deliverable.id, { description: desc })} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
        {deliverable.tag_label && (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 500, background: deliverable.tag_bg, color: deliverable.tag_text_color }}>
            {deliverable.tag_label}
          </span>
        )}
        <span style={{ fontSize: 10, marginLeft: 'auto', color: taskCount > 0 ? '#0F6E56' : '#BA7517' }}>
          {taskCount > 0 ? `✓ Task ${taskCount}건` : '⚠ Task 미연결'}
        </span>
      </div>
    </div>
  )
}
```

> **Task 연결 수 조회:** `useStore`의 `tasks` 배열에서 `deliverableId` 필터링.
> 이 필드는 26.0에서 `tasks.deliverable_id` 추가 + 26.4에서 UI 연결 후 동작.
> 26.3 시점에서는 모든 결과물이 "Task 미연결"으로 표시됨 (정상).

---

## 하단 접힌 섹션 (참조 문서 / 합의된 정책)

```jsx
function CollapsibleSection({ icon, title, referenceId, projectId, type }) {
  const [open, setOpen] = useState(false)

  // type에 따라 적절한 훅 사용
  const hookResult = type === 'links'
    ? useRefLinks(referenceId, projectId)
    : useRefPolicies(referenceId, projectId)

  const { items, add, update, remove } = hookResult

  return (
    <>
      <div onClick={() => setOpen(!open)} style={{ /* 토글 바 스타일 */ }}>
        <span style={{ fontSize: 10, transform: open ? 'rotate(90deg)' : 'none' }}>▸</span>
        {icon} {title}
        <span style={{ /* count badge */ }}>{items.length}</span>
      </div>
      {open && (
        <div style={{ padding: '0 22px 14px 40px' }}>
          {items.map(item => type === 'links'
            ? <LinkItem key={item.id} item={item} onUpdate={update} onDelete={remove} />
            : <PolicyItem key={item.id} item={item} onUpdate={update} onDelete={remove} />
          )}
          <AddButton label="+ 추가" onClick={add} />
        </div>
      )}
    </>
  )
}
```

---

## useStore.js 변경 (deliverableId 매핑)

mapTask 함수에 deliverableId 추가가 필요:

```javascript
// useStore.js > mapTask 함수에 추가
deliverableId: r.deliverable_id || null,
```

> **이것만 추가.** mapTask의 기존 필드는 일절 변경하지 않음.
> taskToRow에도 대응 추가:
```javascript
// taskToRow에 추가
deliverable_id: t.deliverableId || null,
```

---

## 검증 체크리스트

- [ ] 프로젝트 첫 진입 시 `project_references` 자동 생성
- [ ] 마일스톤 추가 → DB INSERT 확인
- [ ] 마일스톤 제목/설명/날짜 인라인 편집 → blur 시 UPDATE
- [ ] 마일스톤 삭제 → 연결된 결과물도 CASCADE 삭제
- [ ] 결과물 추가 → milestone_id 연결 확인
- [ ] 결과물 인라인 편집 정상
- [ ] 좌우 행 정렬 — 마일스톤과 해당 결과물이 같은 행에 표시
- [ ] 참조 문서 접힌 섹션 펼치기/접기 + CRUD
- [ ] 합의된 정책 접힌 섹션 + CRUD
- [ ] 다른 프로젝트 전환 시 Reference 데이터 갱신
- [ ] 기존 글로벌 뷰 정상 (회귀)
- [ ] `npm run build` 성공

---

## 주의사항

- **useStore.js 변경은 mapTask/taskToRow에 deliverableId 매핑 추가만.** 다른 변경 절대 없음.
- **Reference 데이터는 Zustand에 넣지 않음.** 각 훅이 독립적으로 Supabase 호출. 이유: 기존 loadAll/mergeSyncUpdate 흐름과 충돌 방지.
- **담당자 표시:** assignee_ids는 text[] 배열. 현재 단계에서는 텍스트로 직접 입력. 추후 팀원 드롭다운 연동 가능.
- **정렬:** sort_order로 마일스톤 순서 관리. 드래그 재정렬은 추후 확장.
