# Phase 12b Spec v2 — 프로젝트 순서 커스터마이징 (신규 테이블 + DnD)

> 작성일: 2026-04-10
> 상태: **확정** (보완 5건 반영)
> 선행: `12b-recon.md`, `12b-spec.md`, Phase 12a (`55023f5`)
> 변경 이력: v1 → v2 (5가지 보완)

---

## 1. 목표

- 사용자별 프로젝트 순서를 **DB 테이블에 저장** (기기 간 동기화)
- 사이드바와 매트릭스 Lane에 **DnD로 순서 변경** 추가
- 기존 localStorage 방식을 DB로 마이그레이션

---

## 2. 확정 결정사항

| # | 항목 | 결정 |
|---|------|------|
| D1 | 저장 방식 | 신규 테이블 `user_project_order` |
| D2 | 순서 스코프 | **단일 전역 sort_order**. 팀/개인 섹션은 필터링만 적용 |
| D3 | 사이드바 DnD UX | hover 시 drag handle `≡` 표시, 그걸로만 drag |
| D4 | 매트릭스 Lane DnD | 12b 포함 — Lane 헤더를 drag handle로 |
| D5 | DnD 라이브러리 | `@dnd-kit/sortable` |
| D6 | 초기 마이그레이션 | 자동 — `loadProjects()` 완료 후 `loadUserProjectOrder()` 체인 호출 |
| D7 | 낙관적 업데이트 | 로컬 즉시 반영 → DB upsert 비동기 |
| D8 | RLS | 본인 것만 SELECT/INSERT/UPDATE/DELETE |
| D9 | 집중 모드 충돌 | 12a 조건부 DndContext가 자동 적용 (추가 작업 불필요) |
| D10 | upsert 전략 | **배치 upsert** (`supabase.from(...).upsert(rows)`) — 전체 순서 한 번에 |
| D11 | 고아 row cleanup | **`deleteProject`** 에서 `user_project_order` 동시 삭제 |
| D12 | Lane DragOverlay | Lane 헤더만 축소 표시 (activeDragType state로 분기) |
| D13 | 사이드바 SortableContext | **단일 컨텍스트** + restrictToVerticalAxis + 섹션 경계 modifier |
| D14 | 섹션 간 이동 금지 | onDragEnd에서 active/over 섹션 비교 후 다르면 무시 |

---

## 3. DB 스키마

### 3-1. 신규 테이블

```sql
CREATE TABLE IF NOT EXISTS user_project_order (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id text NOT NULL,  -- projects.id가 text 타입
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

CREATE INDEX idx_upo_user ON user_project_order(user_id);

ALTER TABLE user_project_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upo_select_own" ON user_project_order FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "upo_insert_own" ON user_project_order FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "upo_update_own" ON user_project_order FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "upo_delete_own" ON user_project_order FOR DELETE USING (user_id = auth.uid());
```

### 3-2. 주의사항

- `project_id` text (기존 `projects.id` 호환)
- FK 제약 없음 (D11로 app-level cleanup)
- CLAUDE.md "New→existing text type" 규칙 준수

---

## 4. 기능 범위

### 4-1. Store 변경

**`loadUserProjectOrder()`** — 신규
```js
loadUserProjectOrder: async () => {
  const d = db()
  if (!d) return
  const { data, error } = await d.from('user_project_order').select('project_id, sort_order')
  if (error) { console.error('[useStore] loadUserProjectOrder:', error); return }
  const orderMap = {}
  data.forEach(r => { orderMap[r.project_id] = r.sort_order })

  // 초기 마이그레이션: DB가 비어있고 localStorage에 있으면 업로드
  if (data.length === 0) {
    const local = JSON.parse(localStorage.getItem('localProjectOrder') || '{}')
    const keys = Object.keys(local)
    if (keys.length > 0) {
      const rows = keys.map(pid => ({
        user_id: getCachedUserId(),
        project_id: pid,
        sort_order: local[pid],
      }))
      await d.from('user_project_order').upsert(rows)
      set({ localProjectOrder: local })
      return
    }
  }

  set({ localProjectOrder: orderMap })
  localStorage.setItem('localProjectOrder', JSON.stringify(orderMap)) // 캐시 갱신
},
```

**`reorderProjects(newList)`** — 수정 (localStorage + DB batch upsert)
```js
reorderProjects: async (newList) => {
  const userId = getCachedUserId()
  if (!userId) return

  // 로컬 즉시 반영
  const orderMap = {}
  newList.forEach((p, i) => { orderMap[p.id] = i })
  const { localProjectOrder } = get()
  const merged = { ...localProjectOrder, ...orderMap }
  set({ localProjectOrder: merged })
  localStorage.setItem('localProjectOrder', JSON.stringify(merged))

  // DB batch upsert
  const d = db()
  if (!d) return
  const rows = Object.entries(orderMap).map(([pid, order]) => ({
    user_id: userId,
    project_id: pid,
    sort_order: order,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await d.from('user_project_order').upsert(rows)
  if (error) console.error('[useStore] reorderProjects DB:', error)
},
```

**`loadProjects()` 체인**: 완료 후 `loadUserProjectOrder()` 호출
```js
// loadProjects 내부 끝에 추가
await get().loadUserProjectOrder()
```

**`deleteProject()`**: 고아 row 삭제 추가
```js
// 기존 로직 뒤에
await d.from('user_project_order').delete().eq('project_id', pid)
```

### 4-2. Sidebar DnD

- **단일 SortableContext** (팀+개인 projects 모두 포함)
- drag handle: hover 시 `≡` 아이콘 좌측 표시
- PointerSensor `distance: 5`
- **섹션 경계 modifier**: `active.data.current.section !== over.data.current.section`이면 onDragEnd에서 early return
- 각 프로젝트 항목에 `data: { section: 'team' | 'personal' }` 포함
- `arrayMove` → `reorderProjects(newList)`

### 4-3. 매트릭스 Lane DnD

- **UnifiedGridView의 기존 DndContext에 통합** (Lane은 `project-lane:${pid}` prefix)
- PersonalMatrixGrid / TeamMatrixGrid의 Lane 카드 전체를 sortable
- Lane 헤더가 drag handle (기존 onClick 접기/펼치기는 유지, drag는 PointerSensor distance로 분리)
- `handleDragEnd`에 `project-lane:` prefix 분기 추가
- 집중 모드에서는 DndContext 자체가 비활성 → 자동 해결

### 4-4. DragOverlay

- `activeDragType` state 추가 (`'task' | 'ms' | 'project-lane' | null`)
- Lane 드래그 시 Lane 헤더만 축소 표시 (프로젝트 dot + 이름 + 카운트)
- 기존 task/MS overlay는 그대로

---

## 5. 섹션 간 이동 금지 구현

```js
// handleDragEnd (사이드바 + 매트릭스 공통)
const handleDragEnd = (event) => {
  const { active, over } = event
  if (!over || active.id === over.id) return

  // project-lane DnD
  const activeIdStr = String(active.id)
  if (activeIdStr.startsWith('project-lane:')) {
    const activeSection = active.data.current?.section
    const overSection = over.data.current?.section
    if (activeSection && overSection && activeSection !== overSection) return // 섹션 경계 금지

    // arrayMove 후 reorderProjects 호출
    const activePid = activeIdStr.slice(13)
    const overPid = String(over.id).startsWith('project-lane:')
      ? String(over.id).slice(13) : null
    if (!overPid) return
    // 현재 표시 projects 기준으로 arrayMove
    const { projects, sortProjectsLocally } = useStore.getState()
    const sorted = sortProjectsLocally(projects)
    const oldIdx = sorted.findIndex(p => p.id === activePid)
    const newIdx = sorted.findIndex(p => p.id === overPid)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove(sorted, oldIdx, newIdx)
    useStore.getState().reorderProjects(reordered)
    return
  }

  // 기존 task/MS DnD 분기...
}
```

---

## 6. 영향 파일

### 신규
- `supabase/migrations/20260410_user_project_order.sql`

### 수정
- `src/hooks/useStore.js` — loadUserProjectOrder, reorderProjects DB, deleteProject cleanup, loadProjects 체인
- `src/components/layout/Sidebar.jsx` — SortableContext, drag handle, 섹션 data
- `src/components/views/grid/grids/PersonalMatrixGrid.jsx` — Lane SortableContext
- `src/components/views/grid/grids/TeamMatrixGrid.jsx` — Lane SortableContext
- `src/components/views/UnifiedGridView.jsx` — handleDragEnd `project-lane:` 분기, DragOverlay 분기

---

## 7. 리스크

| # | 리스크 | 대응 |
|---|--------|------|
| R1 | localStorage 데이터 유실 | 초기 마이그레이션 자동 업로드 |
| R2 | Lane DnD와 task/MS DnD 충돌 | `project-lane:` prefix + PointerSensor distance 5px |
| R3 | 사이드바 클릭 vs drag 충돌 | drag handle에만 listener |
| R4 | 집중 모드 Lane DnD | 12a 조건부 DndContext로 자동 해결 |
| R5 | 섹션 간 이동 | handleDragEnd에서 section 비교 후 early return |
| R6 | loadProjects/loadUserProjectOrder race | loadProjects 완료 후 체인 호출 |
| R7 | 고아 row | deleteProject에서 동시 삭제 |
| R8 | 배치 upsert 실패 | 로컬은 유지, console.error만 |

---

## 8. 구현 순서 (R-ATOMIC)

| # | 커밋 |
|---|------|
| 1 | `feat(db): add user_project_order table with RLS (12b step 1)` |
| 2 | `feat(store): migrate reorderProjects to DB + loadUserProjectOrder chain (12b step 2)` |
| 3 | `feat(sidebar): add DnD to project list with drag handle (12b step 3)` |
| 4 | `feat(matrix): add Lane DnD to Personal/TeamMatrixGrid (12b step 4)` |

---

## 9. QA 체크리스트

- [ ] `user_project_order` 테이블 생성 + RLS
- [ ] 첫 로그인 시 localStorage → DB 마이그레이션 자동
- [ ] 사이드바: hover 시 ≡ drag handle 표시
- [ ] 사이드바 DnD → 순서 변경 → DB 저장
- [ ] **팀 섹션의 프로젝트를 개인 섹션으로 드래그하면 무시됨**
- [ ] 기기 2대 로그인 시 동일 순서 반영
- [ ] 개인 매트릭스 Lane DnD
- [ ] 팀 매트릭스 Lane DnD
- [ ] Lane 드래그 시 DragOverlay에 Lane 헤더 축소 표시
- [ ] 집중 모드 ON 시 Lane DnD 비활성 (DndContext 미렌더)
- [ ] **프로젝트 삭제 시 `user_project_order`에서 같이 삭제됨**
- [ ] 기존 task/MS DnD 정상 동작 (회귀 없음)
- [ ] 팀 ↔ 개인 모드 전환 시 순서 일관
- [ ] `npm run build` 통과
