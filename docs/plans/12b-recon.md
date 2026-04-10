# Phase 12b Recon — 프로젝트 순서 커스터마이징 (신규 테이블 + DnD)

> 작성일: 2026-04-10
> 상태: 조사 완료

---

## 1. 요구사항 요약

- 사용자별 프로젝트 순서 저장 (본인 전용, 다른 팀원에게 영향 없음)
- 모든 뷰에서 동기화 (매트릭스, 사이드바, 주간, 프로젝트 레이어 등)
- 드래그 앤 드롭으로 순서 변경
- **신규 테이블 방식** (기기 간 동기화)

---

## 2. 현재 상태 (중요)

### 2-1. **이미 localStorage 방식으로 구현됨** ⭐

`src/hooks/useStore.js`:
- `localProjectOrder` state (localStorage 키: `localProjectOrder`)
- `sortProjectsLocally(projectList)` — 로컬 순서 기반 정렬
- `reorderProjects(newList)` — localStorage에 저장

이미 사이드바, 매트릭스, 주간 플래너 모두 `sortProjectsLocally`를 사용하여 정렬.

### 2-2. 기존 DnD 구현

- **ProjectManager.jsx**: 네이티브 HTML5 DnD로 프로젝트 순서 변경 (localStorage만)
- **KeyMilestoneTab.jsx**: `@dnd-kit/sortable`로 MS 순서 변경 (DB 저장)

### 2-3. 사이드바

`src/components/layout/Sidebar.jsx`: 프로젝트 리스트에 **DnD 없음** — 정렬만 적용됨.

---

## 3. Phase 12b의 실제 작업 범위

기존 localStorage 방식이 **이미 작동 중**이므로, 12b는 다음 두 가지입니다:

### A. localStorage → DB 마이그레이션 (기기 간 동기화)

1. **신규 테이블 `user_project_order`** 생성
   - `user_id uuid`, `project_id text`, `sort_order int`, `updated_at timestamptz`
   - PRIMARY KEY: `(user_id, project_id)`
   - RLS: 본인 것만 읽기/쓰기
   - project_id가 **text 타입** (기존 projects.id가 text)

2. **Store 업데이트**:
   - `loadUserProjectOrder()` 추가 — 로그인 시 DB에서 로드
   - `reorderProjects()` 수정 — DB에 upsert + localStorage는 캐시로 유지
   - 기존 localStorage 데이터 있으면 최초 1회 DB로 마이그레이션

### B. 사이드바 DnD 추가

1. **Sidebar.jsx**: 프로젝트 리스트에 DnD 추가
   - 옵션 1: 네이티브 HTML5 (ProjectManager 패턴 재사용)
   - 옵션 2: `@dnd-kit/sortable` (KeyMilestoneTab 패턴)

2. **Matrix Lane DnD** (12a 결과물):
   - PersonalMatrixGrid / TeamMatrixGrid의 Lane 카드에 DnD 추가
   - Lane 헤더를 drag handle로 사용

---

## 4. 구현 옵션 비교

### 옵션 A: 신규 테이블 + `@dnd-kit/sortable`
- DB: `user_project_order` 테이블
- DnD: KeyMilestoneTab 패턴 재사용 (dnd-kit)
- **장점**: 기기 간 동기화, 풍부한 DnD UX, 기존 dnd-kit 인프라 재사용
- **단점**: 마이그레이션 복잡도 ↑

### 옵션 B: 신규 테이블 + 네이티브 HTML5 DnD
- DB: 동일
- DnD: ProjectManager 패턴 재사용
- **장점**: 구현 단순
- **단점**: 앱 전체가 dnd-kit 표준인데 예외 발생

### 옵션 C: profiles JSONB 컬럼 + dnd-kit
- DB: `profiles.preferences JSONB` 추가
- **장점**: 테이블 1개 추가 대신 컬럼 1개 추가
- **단점**: 전체 덮어쓰기 필요, 다른 설정과 혼재

**권장**: **옵션 A** — 깔끔한 분리 + dnd-kit 표준 유지

---

## 5. 영향 파일

### 신규
| 파일 | 내용 |
|------|------|
| `supabase/migrations/20260410_user_project_order.sql` | 테이블 + RLS |

### 수정
| 파일 | 변경 |
|------|------|
| `src/hooks/useStore.js` | `loadUserProjectOrder`, `reorderProjects` DB 저장, 초기 localStorage 마이그레이션 |
| `src/components/layout/Sidebar.jsx` | 프로젝트 리스트에 DnD 추가 |
| `src/components/views/grid/grids/PersonalMatrixGrid.jsx` | Lane 카드에 DnD 추가 |
| `src/components/views/grid/grids/TeamMatrixGrid.jsx` | Lane 카드에 DnD 추가 |

---

## 6. 재사용 가능한 패턴

| 항목 | 소스 |
|------|------|
| `sortProjectsLocally` | useStore.js (이미 존재) |
| `localProjectOrder` state | useStore.js (이미 존재) |
| `reorderProjects` | useStore.js (이미 존재, 수정 필요) |
| `@dnd-kit/sortable` 패턴 | KeyMilestoneTab.jsx, MsTaskTreeMode 등 |
| `arrayMove` from `@dnd-kit/sortable` | 여러 곳 |
| RLS policy 패턴 | `20260312000000_loop17_team_schema.sql` |

---

## 7. 위험 요소

| # | 위험 | 대응 |
|---|------|------|
| W1 | 기존 localStorage 데이터 소실 | 첫 로그인 시 localStorage → DB 마이그레이션 로직 |
| W2 | 매트릭스 Lane 내부에 이미 task/MS DnD가 있음 | Lane 헤더 전용 drag handle, task DnD와 ID prefix로 분리 |
| W3 | 사이드바 DnD와 클릭 충돌 | drag handle 아이콘 또는 PointerSensor distance 설정 |
| W4 | 프로젝트 ID는 text, user_id는 uuid | 신규 테이블에서 project_id를 text로 선언 |
| W5 | RLS로 본인 행만 읽기 | `user_id = auth.uid()` 정책 |
| W6 | DB upsert 시 race condition | 단순 upsert로 충분 (최종 상태만 중요) |
| W7 | Lane 카드 내부 DnD 활성화 시 12a의 "집중 모드 DnD 비활성"과 충돌 | 집중 모드에서는 Lane DnD도 비활성 |

---

## 8. 사전 확인 필요

1. **DB 마이그레이션 범위**: 테이블만 생성 vs profile JSONB 확장?
2. **사이드바 DnD UX**: 
   - (a) 전체 프로젝트 row drag
   - (b) drag handle 아이콘 (hover 시 표시)
3. **매트릭스 Lane DnD**: 12b에 포함 vs 별도 phase?
4. **초기 마이그레이션**: localStorage 데이터가 있으면 DB로 자동 복사 할까요?
5. **팀 범위**: 개인 모드와 팀 모드 별도 순서? 아니면 단일 순서?
