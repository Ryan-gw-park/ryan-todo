# Phase 12b Spec — 프로젝트 순서 커스터마이징 (신규 테이블 + DnD)

> 작성일: 2026-04-10
> 상태: **초안** (상세화 필요)
> 선행: `12b-recon.md`, Phase 12a (`55023f5`)

---

## 1. 목표

- 사용자별 프로젝트 순서를 **DB 테이블에 저장** (기기 간 동기화)
- 사이드바와 매트릭스 Lane에 **DnD로 순서 변경** 추가
- 기존 localStorage 방식을 DB로 마이그레이션

---

## 2. 확정 결정사항

| # | 항목 | 결정 |
|---|------|------|
| D1 | 저장 방식 | **신규 테이블** `user_project_order` |
| D2 | 동기화 범위 | **단일 순서** (팀/개인 모드 공통) |
| D3 | 사이드바 DnD UX | **hover 시 drag handle 아이콘 (≡) 표시**, 그걸로만 drag |
| D4 | 매트릭스 Lane DnD | **12b에 포함** — Lane 헤더 자체를 drag handle로 |
| D5 | DnD 라이브러리 | **`@dnd-kit/sortable`** (앱 표준) |
| D6 | 초기 마이그레이션 | **자동** — 첫 로그인 시 localStorage → DB 복사, 성공 후 localStorage 유지 (캐시) |
| D7 | 낙관적 업데이트 | 로컬 즉시 반영 → DB upsert 비동기 |
| D8 | RLS | 본인 것만 SELECT/INSERT/UPDATE/DELETE |
| D9 | 집중 모드와 충돌 | 12a 집중 모드에서는 Lane DnD도 비활성 |
| D10 | 신규 프로젝트 | sort_order가 없으면 기존 `project.sort_order` fallback |

---

## 3. DB 스키마

### 3-1. 신규 테이블 `user_project_order`

```sql
CREATE TABLE IF NOT EXISTS user_project_order (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id text NOT NULL,  -- projects.id가 text 타입 (기존 데이터 호환)
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

CREATE INDEX idx_upo_user ON user_project_order(user_id);

ALTER TABLE user_project_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upo_select_own" ON user_project_order FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "upo_insert_own" ON user_project_order FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "upo_update_own" ON user_project_order FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "upo_delete_own" ON user_project_order FOR DELETE
  USING (user_id = auth.uid());
```

### 3-2. 주의

- `project_id`는 **text** (기존 `projects.id`가 text)
- FK 제약 없음 (프로젝트 삭제 시 고아 row는 app-level 또는 주기적 cleanup)
- CLAUDE.md 규칙: "New→existing table references use text type" 준수

---

## 4. 기능 범위

### 4-1. Store 변경

1. **`loadUserProjectOrder()`** — 신규
   - 로그인 후 `user_project_order` 테이블 조회
   - `localProjectOrder` state에 `{ projectId: sort_order }` 형태로 저장
   - 실패 시 localStorage 캐시 유지

2. **`reorderProjects(newList)`** — 수정
   - 기존: localStorage만 업데이트
   - 변경: **localStorage + DB upsert** (낙관적)
   - 에러 시 console.error, 로컬은 유지

3. **초기 마이그레이션** — 로그인 시 1회
   - DB에 데이터 없고 localStorage에 있으면 → DB 업로드
   - DB에 데이터 있으면 → DB 우선

### 4-2. Sidebar DnD

1. **`@dnd-kit/sortable`** 적용
   - 각 프로젝트 section(팀/개인)마다 별도 SortableContext
   - 섹션 간 이동 없음 (팀→개인 금지)
2. **Drag handle**: hover 시 좌측에 `≡` 아이콘 표시
3. **Activation constraint**: PointerSensor `distance: 5px`
4. **onDragEnd**: `arrayMove` → `reorderProjects(newList)`

### 4-3. 매트릭스 Lane DnD

1. **PersonalMatrixGrid / TeamMatrixGrid**
2. Lane 카드 전체를 sortable item으로
3. Lane 헤더가 drag handle 역할 (클릭은 접기/펼치기, 드래그는 순서 변경)
4. 집중 모드 ON 시 DnD 비활성 (12a 조건부 DndContext 확장)
5. 기존 task/MS DnD(`cell-task:`, `cell-ms:`)와 **ID prefix로 구분** (`project-lane:${pid}`)

---

## 5. 기존 UI 영향

### 변경
- **Sidebar.jsx**: 프로젝트 리스트 SortableContext 래핑
- **PersonalMatrixGrid.jsx**: Lane 카드 SortableContext 래핑
- **TeamMatrixGrid.jsx**: 동일
- **UnifiedGridView.jsx**: DndContext onDragEnd에서 `project-lane:` prefix 처리 추가

### 변경 없음
- 기존 task/MS DnD (`cell-task:`, `cell-ms:`, `mat:`, `tmat:`) 그대로
- `sortProjectsLocally` 함수 그대로 (내부적으로 `localProjectOrder` 참조)

---

## 6. 영향 파일

### 신규
- `supabase/migrations/20260410_user_project_order.sql`

### 수정
- `src/hooks/useStore.js` — loadUserProjectOrder, reorderProjects DB 저장
- `src/components/layout/Sidebar.jsx` — SortableContext + drag handle
- `src/components/views/grid/grids/PersonalMatrixGrid.jsx` — Lane SortableContext
- `src/components/views/grid/grids/TeamMatrixGrid.jsx` — Lane SortableContext
- `src/components/views/UnifiedGridView.jsx` — handleDragEnd에 `project-lane:` 분기 추가

---

## 7. 리스크

| # | 리스크 | 대응 |
|---|--------|------|
| R1 | 기존 localStorage 사용자 데이터 유실 | 초기 마이그레이션 자동 업로드 |
| R2 | 매트릭스 내부 task/MS DnD와 충돌 | `project-lane:` prefix + Lane 헤더만 drag handle |
| R3 | 사이드바 클릭 vs drag 충돌 | drag handle 아이콘에만 리스너 연결 |
| R4 | 집중 모드와 Lane DnD 충돌 | 집중 모드 ON 시 SortableContext 비활성 |
| R5 | Sidebar 섹션 간 이동 | 섹션별 SortableContext 분리 |
| R6 | 낙관적 업데이트 실패 | console.error 기록, 로컬 유지 |

---

## 8. 구현 순서 (R-ATOMIC)

| # | 커밋 | 목적 |
|---|------|------|
| 1 | `feat(db): add user_project_order table with RLS` | DB 마이그레이션 |
| 2 | `feat(store): migrate reorderProjects to DB + initial localStorage migration` | store 로직 |
| 3 | `feat(sidebar): add DnD to project list with drag handle` | 사이드바 DnD |
| 4 | `feat(matrix): add Lane DnD to PersonalMatrixGrid + TeamMatrixGrid` | 매트릭스 Lane DnD |

---

## 9. QA 체크리스트

- [ ] `user_project_order` 테이블 생성 + RLS 동작
- [ ] 첫 로그인 시 localStorage → DB 마이그레이션
- [ ] 사이드바: hover 시 drag handle 표시
- [ ] 사이드바 DnD → 순서 변경 → DB 저장
- [ ] 다른 기기 로그인 시 동일 순서 반영
- [ ] 매트릭스 Lane DnD (Personal/Team)
- [ ] 집중 모드 ON 시 Lane DnD 비활성
- [ ] 기존 task/MS DnD 정상 동작 (회귀 없음)
- [ ] 팀 모드 ↔ 개인 모드 전환 시 순서 일관
- [ ] `npm run build` 통과
