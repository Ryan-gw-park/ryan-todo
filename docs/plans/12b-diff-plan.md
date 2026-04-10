# Phase 12b Diff Plan (v2) — 프로젝트 순서 커스터마이징

> 작성일: 2026-04-10
> 기준: `12b-spec-v2.md`
> 상태: 리뷰 반영 v2

## 리뷰 반영 (v1 → v2)

| 이슈 | 해결 |
|------|------|
| [C1] loadAll 폴링마다 loadUserProjectOrder 호출 | `_projectOrderLoaded` 플래그 → 최초 1회만 |
| [C2] 이벤트 핸들러에서 useStore.getState() | store action에서 getState() 사용은 허용 (Banned #7은 render) |
| [C3] sort_order 섹션 간 숫자 충돌 | reorderProjects가 **전체 프로젝트 리스트를 전역 index로 재계산** |
| [W1] ProjectItem 직접 수정 | SortableProjectItem wrapper에만 drag handle |
| [W3] 팀 프로젝트 삭제 시 타 팀원 고아 row | 12b 범위 외, 본인 row만 삭제 |
| [W4] focusMode에서 SortableLane DnDContext 밖 | Grid 내부 SortableContext도 focusMode 조건부 |
| [Spec D13] 단일 SortableContext 위반 | 단일 context로 통합 (사이드바) |
| [DragOverlay] activeItem 구조 불일치 | 기존 useMemo activeItem 확장 |

---

## Step 1: DB 마이그레이션

**파일**: `supabase/migrations/20260410_user_project_order.sql` (신규)

```sql
CREATE TABLE IF NOT EXISTS user_project_order (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_upo_user ON user_project_order(user_id);

ALTER TABLE user_project_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upo_select_own" ON user_project_order FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "upo_insert_own" ON user_project_order FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "upo_update_own" ON user_project_order FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "upo_delete_own" ON user_project_order FOR DELETE
  USING (user_id = auth.uid());
```

---

## Step 2: Store 수정

**파일**: `src/hooks/useStore.js`

### 변경 1 — 최상단 플래그:
```js
// line 15 근처 (_loadAllRunning 옆)
let _projectOrderLoaded = false
```

### 변경 2 — `loadUserProjectOrder` 신규:
`setLocalProjectOrder` 뒤에 추가:
```js
loadUserProjectOrder: async () => {
  if (_projectOrderLoaded) return
  const d = db()
  if (!d) return
  const userId = _cachedUserId || (await d.auth.getUser()).data?.user?.id
  if (!userId) return
  const { data, error } = await d.from('user_project_order').select('project_id, sort_order')
  if (error) { console.error('[useStore] loadUserProjectOrder:', error); return }

  // 초기 마이그레이션: DB 비어있고 localStorage에 있으면 업로드
  if (!data || data.length === 0) {
    const local = JSON.parse(localStorage.getItem('localProjectOrder') || '{}')
    const keys = Object.keys(local)
    if (keys.length > 0) {
      const rows = keys.map(pid => ({
        user_id: userId,
        project_id: pid,
        sort_order: local[pid],
        updated_at: new Date().toISOString(),
      }))
      const { error: upErr } = await d.from('user_project_order').upsert(rows)
      if (upErr) console.error('[useStore] loadUserProjectOrder migration:', upErr)
      set({ localProjectOrder: local })
    } else {
      set({ localProjectOrder: {} })
    }
    _projectOrderLoaded = true
    return
  }

  const orderMap = {}
  data.forEach(r => { orderMap[r.project_id] = r.sort_order })
  set({ localProjectOrder: orderMap })
  try { localStorage.setItem('localProjectOrder', JSON.stringify(orderMap)) } catch {}
  _projectOrderLoaded = true
},
```

### 변경 3 — `reorderProjects` 전역 재계산 + DB upsert:
```diff
 reorderProjects: async (newList) => {
-  // 로컬 순서 저장 (DB 업데이트 안 함 → 개인별 적용)
-  const orderMap = {}
-  newList.forEach((p, i) => { orderMap[p.id] = i })
-  const { localProjectOrder } = get()
-  const merged = { ...localProjectOrder, ...orderMap }
-  set({ localProjectOrder: merged })
-  localStorage.setItem('localProjectOrder', JSON.stringify(merged))
+  // 12b: 전역 sort_order 재계산
+  // newList = 특정 섹션에서 arrayMove된 결과. 전체 프로젝트 기준으로 새 index 부여.
+  const { projects, localProjectOrder } = get()
+  // 현재 localProjectOrder에 들어간 newList의 순서를 먼저 덮어쓰기
+  const partialMap = {}
+  newList.forEach((p, i) => { partialMap[p.id] = i })
+
+  // 전체 프로젝트를 새 partialMap + 기존 localProjectOrder 기준으로 정렬
+  const sorted = [...projects].sort((a, b) => {
+    const oA = partialMap[a.id] !== undefined ? partialMap[a.id] : (localProjectOrder[a.id] ?? a.sortOrder ?? 0)
+    const oB = partialMap[b.id] !== undefined ? partialMap[b.id] : (localProjectOrder[b.id] ?? b.sortOrder ?? 0)
+    return oA - oB
+  })
+
+  // 전역 index 재부여
+  const newOrderMap = {}
+  sorted.forEach((p, i) => { newOrderMap[p.id] = i })
+
+  // 로컬 즉시 반영
+  set({ localProjectOrder: newOrderMap })
+  try { localStorage.setItem('localProjectOrder', JSON.stringify(newOrderMap)) } catch {}
+
+  // DB batch upsert
+  const d = db()
+  if (!d) return
+  const userId = _cachedUserId || (await d.auth.getUser()).data?.user?.id
+  if (!userId) return
+  const rows = Object.entries(newOrderMap).map(([pid, order]) => ({
+    user_id: userId,
+    project_id: pid,
+    sort_order: order,
+    updated_at: new Date().toISOString(),
+  }))
+  const { error } = await d.from('user_project_order').upsert(rows)
+  if (error) console.error('[useStore] reorderProjects DB:', error)
 },
```

> **중요**: 섹션 내에서 arrayMove가 된 newList 순서가 최우선이고, 나머지 프로젝트는 기존 순서 유지. 그 결과를 전체 기준으로 index 재부여.

### 변경 4 — loadAll 완료 후 체인:
```diff
       if (!isArrayEqual(current.memos, memos)) patch.memos = memos
       set(patch)
+
+      // 12b: 사용자별 프로젝트 순서 로드 (최초 1회만)
+      if (!_projectOrderLoaded) {
+        try { await get().loadUserProjectOrder() } catch (e) { console.error('[loadAll] loadUserProjectOrder:', e) }
+      }
```

### 변경 5 — deleteProject에 본인 row 삭제:
```diff
     if (d) {
       const { error } = await d.from('projects').delete().eq('id', id)
       if (error) console.error('[Ryan Todo] deleteProject:', error)
+      // 12b: 본인의 user_project_order row 삭제 (타 팀원 row는 RLS로 불가 — 향후 Edge Function)
+      const userId = _cachedUserId
+      if (userId) {
+        await d.from('user_project_order').delete().eq('project_id', id).eq('user_id', userId)
+      }
     }
```

**커밋**: `feat(store): migrate project order to DB + flag-based one-time load (12b step 2)`

---

## Step 3: Sidebar DnD

**파일**: `src/components/layout/Sidebar.jsx`

### 변경 1 — import 추가:
```js
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
```

### 변경 2 — SortableProjectItem 컴포넌트 (파일 내부, ProjectItem 위):
```jsx
function SortableProjectItem({ project, section, isActive, onClick, collapsed, indent, archiveFn }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `project-sidebar:${project.id}`,
    data: { section, projectId: project.id },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
  }
  const [hover, setHover] = useState(false)
  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Drag handle (hover 시 표시) — ProjectItem을 감싸고 왼쪽에 아이콘 */}
      {hover && !collapsed && (
        <div
          {...attributes}
          {...listeners}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', left: 2, top: '50%', transform: 'translateY(-50%)',
            cursor: 'grab', color: '#b4b2a9', fontSize: 11, fontWeight: 700,
            padding: '4px 2px', lineHeight: 1, zIndex: 2, userSelect: 'none',
          }}
        >≡</div>
      )}
      <ProjectItem
        project={project}
        isActive={isActive}
        onClick={onClick}
        collapsed={collapsed}
        indent={indent}
        archiveFn={archiveFn}
      />
    </div>
  )
}
```

> **주의**: ProjectItem은 **수정하지 않음**. wrapper에만 drag handle 추가.

### 변경 3 — Sidebar 본체에 DndContext + 단일 SortableContext:

기존 `teamProjects`, `personalProjects` 렌더 부분을 단일 DndContext + 단일 SortableContext로 감쌈. 섹션은 렌더만 분리되지만 sortable items는 합쳐짐.

```jsx
// Sidebar 함수 내부
const reorderProjects = useStore(s => s.reorderProjects)
const sortProjectsLocally = useStore(s => s.sortProjectsLocally)

const sidebarSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

const allSortableProjects = useMemo(() => {
  return [...teamProjects, ...personalProjects]
}, [teamProjects, personalProjects])

const handleSidebarDragEnd = useCallback((event) => {
  const { active, over } = event
  if (!over || active.id === over.id) return
  const activeSection = active.data.current?.section
  const overSection = over.data.current?.section
  if (activeSection !== overSection) return // 섹션 경계 금지

  const activePid = active.data.current?.projectId
  const overPid = over.data.current?.projectId
  if (!activePid || !overPid) return

  // 해당 섹션의 정렬된 리스트에서 arrayMove
  const sectionList = activeSection === 'team' ? teamProjects : personalProjects
  const oldIdx = sectionList.findIndex(p => p.id === activePid)
  const newIdx = sectionList.findIndex(p => p.id === overPid)
  if (oldIdx === -1 || newIdx === -1) return
  const reordered = arrayMove(sectionList, oldIdx, newIdx)
  reorderProjects(reordered)
}, [teamProjects, personalProjects, reorderProjects])
```

프로젝트 리스트 렌더 부분을 DndContext + 단일 SortableContext로 래핑:

```jsx
<DndContext
  sensors={sidebarSensors}
  collisionDetection={closestCenter}
  modifiers={[restrictToVerticalAxis]}
  onDragEnd={handleSidebarDragEnd}
>
  <SortableContext
    items={allSortableProjects.map(p => `project-sidebar:${p.id}`)}
    strategy={verticalListSortingStrategy}
  >
    {/* 팀 프로젝트 */}
    {currentTeamId && (
      <>
        {!collapsed && <SubSectionHeader ... />}
        {!sectionCollapsed.projTeam && teamProjects.map(p => (
          <SortableProjectItem
            key={p.id} project={p} section="team"
            isActive={isProjectActive(p.id)}
            onClick={() => enterProjectLayer(p.id)}
            collapsed={collapsed} indent={collapsed ? 0 : 1}
            archiveFn={archiveProject}
          />
        ))}
      </>
    )}

    {/* 팀 아카이브 — 기존 그대로 (DnD 없음) */}

    {/* 개인 프로젝트 */}
    {!collapsed && <SubSectionHeader ... />}
    {!sectionCollapsed.projPersonal && personalProjects.map(p => (
      <SortableProjectItem
        key={p.id} project={p} section="personal"
        isActive={isProjectActive(p.id)}
        onClick={() => enterProjectLayer(p.id)}
        collapsed={collapsed} indent={collapsed ? 0 : 1}
        archiveFn={archiveProject}
      />
    ))}

    {/* 개인 아카이브 — 기존 그대로 */}
  </SortableContext>
</DndContext>
```

**커밋**: `feat(sidebar): add DnD to project list with drag handle (12b step 3)`

---

## Step 4: 매트릭스 Lane DnD

**파일**: `PersonalMatrixGrid.jsx`, `TeamMatrixGrid.jsx`, `UnifiedGridView.jsx`

### 4-1. PersonalMatrixGrid.jsx — SortableContext 추가 + SortableLane

```js
import { SortableContext, useSortable, verticalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

Lane 카드 map을 SortableContext로 감싸기 (focusMode 무관, 내부 `disabled`로 제어):
```jsx
<SortableContext
  items={projects.map(p => `project-lane:${p.id}`)}
  strategy={focusMode ? rectSortingStrategy : verticalListSortingStrategy}
>
  {projects.map(proj => (
    <SortableLaneCard
      key={proj.id}
      proj={proj}
      section="personal"  // 개인 매트릭스는 모두 personal로 처리 (또는 proj.teamId 기반)
      disabled={focusMode}
      /* 기존 Lane 내용을 children 또는 prop으로 */
    />
  ))}
</SortableContext>
```

**SortableLaneCard 컴포넌트** (파일 내부):
```jsx
function SortableLaneCard({ proj, section, disabled, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `project-lane:${proj.id}`,
    data: { section, projectId: proj.id, type: 'project-lane' },
    disabled,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      {typeof children === 'function' ? children({ attributes, listeners }) : children}
    </div>
  )
}
```

Lane 헤더에 `attributes`/`listeners` 바인딩:
```jsx
<SortableLaneCard proj={proj} section={proj.teamId ? 'team' : 'personal'} disabled={focusMode}>
  {({ attributes, listeners }) => (
    <div key={proj.id} style={{ ...laneCardStyle, marginBottom: focusMode ? 0 : 12 }}>
      <div
        {...attributes}
        {...listeners}
        onClick={() => toggleCollapse(proj.id)}
        style={{ ...laneHeaderStyle, cursor: focusMode ? 'pointer' : 'grab' }}
      >
        {/* 기존 헤더 내용 */}
      </div>
      {/* Lane 본문 */}
    </div>
  )}
</SortableLaneCard>
```

> **중요**: focusMode일 때는 DndContext 자체가 없으므로 useSortable은 Context 없음 에러를 낸다. 해결책: SortableContext 자체를 focusMode 조건부 렌더.

**수정**: focusMode 분기:
```jsx
{focusMode ? (
  <div style={{ display: 'grid', gridTemplateColumns: outerCols, gap: 8, alignItems: 'start' }}>
    {projects.map(proj => (
      <div key={proj.id} style={{ ...laneCardStyle }}>
        {/* Lane 그대로 (drag 없음) */}
      </div>
    ))}
  </div>
) : (
  <SortableContext items={projects.map(p => `project-lane:${p.id}`)} strategy={verticalListSortingStrategy}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0, alignItems: 'start' }}>
      {projects.map(proj => (
        <SortableLaneCard key={proj.id} proj={proj} section="personal" disabled={false}>
          {({ attributes, listeners }) => (
            <div style={{ ...laneCardStyle }}>
              {/* 헤더에 attributes/listeners */}
            </div>
          )}
        </SortableLaneCard>
      ))}
    </div>
  </SortableContext>
)}
```

### 4-2. TeamMatrixGrid.jsx — 동일 패턴 (focusMode 없음이므로 항상 SortableContext)

TeamMatrixGrid는 focusMode가 없으므로 SortableContext를 조건 없이 감쌈. section="team".

### 4-3. UnifiedGridView.jsx — handleDragEnd에 project-lane 분기

```js
const handleDragEnd = (event) => {
  setActiveId(null)
  const { active, over } = event
  if (!over || active.id === over.id) return

  const activeIdStr = String(active.id)

  // 12b: project-lane DnD (다른 분기보다 먼저)
  if (activeIdStr.startsWith('project-lane:')) {
    const activeSection = active.data.current?.section
    const overSection = over.data.current?.section
    if (activeSection && overSection && activeSection !== overSection) return

    const activePid = active.data.current?.projectId
    const overPid = over.data.current?.projectId
    if (!activePid || !overPid) return

    // 섹션의 정렬된 리스트에서 arrayMove
    const { projects: allProj } = useStore.getState()
    const sortProjectsLocally = useStore.getState().sortProjectsLocally
    let sectionList
    if (activeSection === 'team') {
      sectionList = sortProjectsLocally(allProj.filter(p => p.teamId === currentTeamId && !p.archivedAt))
    } else {
      sectionList = sortProjectsLocally(allProj.filter(p => !p.teamId && !p.archivedAt))
    }
    const oldIdx = sectionList.findIndex(p => p.id === activePid)
    const newIdx = sectionList.findIndex(p => p.id === overPid)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove(sectionList, oldIdx, newIdx)
    useStore.getState().reorderProjects(reordered)
    return
  }

  // 기존 task/MS 로직 ...
}
```

### 4-4. DragOverlay — Lane 헤더 축소 표시

`activeItem` useMemo 확장:
```js
const activeItem = useMemo(() => {
  if (!activeId) return null
  const s = String(activeId)
  if (s.startsWith('project-lane:')) {
    const pid = s.slice(13)
    const proj = projects.find(p => p.id === pid)
    if (proj) {
      const c = getColor(proj.color)
      return { type: 'project-lane', data: { name: proj.name, dotColor: c.dot } }
    }
    return null
  }
  // 기존 task/ms 분기 ...
}, [activeId, tasks, milestones, projects])
```

DragOverlay 내부:
```jsx
{activeItem?.type === 'project-lane' ? (
  <div style={{
    background: '#fff', border: '1px solid #e8e6df', borderRadius: 10,
    padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    display: 'flex', alignItems: 'center', gap: 8, cursor: 'grabbing',
  }}>
    <div style={{ width: 8, height: 8, borderRadius: 2, background: activeItem.data.dotColor, flexShrink: 0 }} />
    <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary }}>{activeItem.data.name}</span>
  </div>
) : /* 기존 */ }
```

**커밋**: `feat(matrix): add Lane DnD to Personal/TeamMatrixGrid (12b step 4)`

---

## 작업 순서

| Step | 파일 |
|------|------|
| 1 | `supabase/migrations/20260410_user_project_order.sql` |
| 2 | `useStore.js` |
| 3 | `Sidebar.jsx` |
| 4 | `PersonalMatrixGrid.jsx`, `TeamMatrixGrid.jsx`, `UnifiedGridView.jsx` |

---

## 검증

- 각 Step 후 `npm run build`
- 최종 QA: spec §9 체크리스트
