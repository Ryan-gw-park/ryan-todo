# Hotfix-A Recon — 노트 데이터 유실 박멸 + 저장 상태 UI

- **Phase**: Hotfix-A (긴급 핫픽스, Loop 아님)
- **상위 플랜**: `docs/plans/notes-fix-plan.md`
- **Date**: 2026-04-20
- **원칙**: 데이터 유실 수정 > 크래시 수정 > 사용성 개선
- **제약**: OutlinerEditor 수정 금지 / 기존 DB 컬럼명 유지 / 새 컴포넌트는 래퍼 방식

---

## 1. 코드베이스 영향 범위 분석

### 1-1. 유실 체인(사용자 리포트 → 코드 경로)

사용자 리포트 "쓰는 중 사라진다 + 과거 저장본도 사라진다"를 구성하는 4개 결함이 Hotfix-A 범위:

| # | 결함 위치 | 증상 |
|---|----------|------|
| a | `src/hooks/useStore.js:489` `loadAll` memos 배열 통째 교체 | 편집 중 탭 전환/복귀 시 서버 stale 값으로 로컬 입력 덮어씀 |
| b | `src/hooks/useStore.js:870-872` upsert payload에 `updated_at` 누락 | DB UPDATE 후에도 `updated_at` 갱신 안 됨(memos는 트리거 없음) → loadAll이 매번 "다름" 오판 |
| c | `src/components/shared/OutlinerEditor.jsx:26-32` 외부 `notes` 변경 시 즉시 setNodes | 편집 중 외부 리셋이 사용자 입력을 증발 |
| d | `src/hooks/useStore.js:873` upsert 실패 시 console.error만 | 사용자 인지 불가 → 다음 loadAll이 옛 값 회복 → "저장 완료된 노트도 사라짐" |

### 1-2. 팀 싱크 / 폴링 경로

- `src/sync/PollingSyncProvider.js:3` — 10초 폴링, 대상 `['tasks', 'notifications']`만. **memos 미포함**.
- `src/sync/SyncContext.jsx:55` — 탭 복귀 시 `loadAll()` 호출. **이 경로로 memos가 덮어써짐**.
- `src/hooks/useStore.js:1417` — 팀 전환 시 `loadAll()`.
- `src/App.jsx:221` — 앱 부팅 시 `loadAll()`.

Hotfix-A 범위에서는 SyncContext/PollingSyncProvider 자체는 건드리지 않는다. loadAll 머지 단계에서 dirty 격리만 적용.

### 1-3. DB 트리거 사실관계 (결정적)

- `supabase/migrations/20260312000000_loop17_team_schema.sql:527` 근처의 `BEFORE UPDATE` 트리거 부착 테이블 리스트:
  `['profiles', 'companies', 'teams', 'comments', 'matrix_row_config', 'tasks', 'projects']`.
  **`memos` 없음** → UPDATE 시 `updated_at` 자동 갱신 안 됨.
- INSERT: 컬럼 DEFAULT `now()`에만 의존.
- 의미: Hotfix-A-2에서 upsert payload에 `updated_at`을 **반드시** 명시해야 함. 미명시 시 isArrayEqual 오판 → 리렌더 폭증/포커스 유실 잠재.

---

## 2. 영향 파일 / 모듈 목록

### 수정 대상

| 파일 | 수정 지점 | 내용 | 예상 LOC |
|------|-----------|------|---------|
| `src/hooks/useStore.js` | `:252` 초기값 | `dirtyMemoIds: {}` 필드 추가 | +1 |
| `src/hooks/useStore.js` | `:489` loadAll 머지 | dirty 메모만 로컬 유지, 나머지는 서버 반영 | +12~15 |
| `src/hooks/useStore.js` | `:850-861` addMemo | 진입 시 dirty set, upsert payload에 `updated_at` 추가, .catch로 dirty 해제 | +6~8 |
| `src/hooks/useStore.js` | `:863-874` updateMemo | 동일 패턴 | +6~8 |
| `src/components/views/MemoryView.jsx` | `:52-98` MemoDetailPane debounce 영역 | 저장 상태 로컬 state(`saveState`: `idle\|saving\|saved\|error`) + fade 타이머 | +20~30 |
| `src/components/views/MemoryView.jsx` | `:147-194` 헤더 영역 | 상태 인디케이터 UI(텍스트 + 색) | +10~15 |

### 수정 금지 / 건드리지 않음

| 파일 | 이유 |
|------|------|
| `src/components/shared/OutlinerEditor.jsx` | CLAUDE.md "never modify" 제약 |
| `src/utils/notes.js` | 파서/시리얼라이저는 변경 불필요 |
| `src/sync/PollingSyncProvider.js`, `SyncContext.jsx` | Hotfix-B 범위 |
| `supabase/migrations/*` | 스키마 변경 없음 (트리거 부재는 확인만) |

---

## 3. 구현 옵션 & Trade-off

### 결정 1 — dirty 상태 자료구조

| 항목 | A: `Set<string>` | B: `{[id]: true}` plain object | C: `Map<id, {dirty, status}>` 통합 |
|------|------------------|--------------------------------|------------------------------------|
| 불변 업데이트 | `new Set(prev).add(id)` | `{...prev, [id]: true}` | `new Map(prev).set(id, {...})` |
| Selector 친화 | `has(id)` — 참조 동등 OK | `!!s.dirtyMemoIds[id]` — OK, JSON 직렬화 가능 | Map은 JSON.stringify 불가 → 스냅샷 경로에 부작용 |
| 스냅샷 영향 (`useStore.js:499`) | Set은 직렬화 불가 → 스냅샷에서 제외 처리 필요 | 그대로 JSON 직렬화 OK | Map 또한 제외 처리 필요 |
| 확장성 (A-3 status 통합) | status 별도 필드 필요 | 같은 패턴으로 옆에 필드 추가 용이 | 단일 구조로 우아 |
| 기존 코드와의 어울림 | `collapseState`는 plain object 패턴 | 일관 | 선례 없음 |
| 예상 LOC | +15~20 | +15~20 | +25~35 |
| Risky | 낮음 | 낮음 | 중간 (스냅샷 직렬화 경로) |

**권장**: **B (plain object)**. 프로젝트 dict 스타일과 일관, 스냅샷 직렬화 안전, A-3 status 필드와 나란히 배치 용이.

### 결정 2 — `memoSaveStatus` 관리 위치

| 항목 | A: 글로벌 Zustand `{[id]: status}` | B: MemoryView 로컬 state | C: 혼합 (dirty=글로벌, fade=로컬) |
|------|-----------------------------------|--------------------------|-------------------------------------|
| 단일 진실 원천 | 예 | 단일 뷰 범위 내 예 | 두 곳에 분산 |
| MyProfile.jsx:104-126 fade 선례 | fade 타이머를 별도 로컬 관리 필요 | 동일 패턴 그대로 | B와 동일 |
| 다른 뷰 확장성 | 즉시 | 복제 필요 | dirty만 재사용 |
| 구현 복잡도 | updateMemo 진입/완료/실패에서 set | updateMemo Promise `.then().catch()`로 반영 | 양쪽 |
| 예상 LOC | +30~40 | +20~25 | +35~45 |
| Risky | 중간 | 낮음 | 중간 (이중 진실) |

**권장**: **B (로컬)**. MemoryView가 유일한 편집 뷰이고 MyProfile 선례가 로컬이다. 확장 요구 발생 시 A로 승격 비용 낮음. dirty 격리(A-1)와 UI 상태(A-3)는 목적이 다르므로 분리가 타당.

### 결정 3 — `lockedNotes` 래퍼 구현

| 항목 | A: MemoryView 로컬 `lockedNotes` state | B: OutlinerEditor에 `preserveLocalOnExternalChange` prop | C: 래퍼 없음 — A-1 dirty-set 단일 방어 |
|------|----------------------------------------|----------------------------------------------------------|---------------------------------------|
| OutlinerEditor 수정 | 없음 | **금지 제약 위반** | 없음 |
| 방어선 | loadAll + 렌더 이중 | (금지) | A-1 단일 |
| 새 버그 유발 위험 | `useEffect` 동기화 실수 시 "반대 방향" 유실 가능 (예: 메모 전환 시 flush 전 lock 해제 타이밍) | N/A | A-1 정확성에 의존 |
| 실시간 협업 미래 | 다른 사용자의 업데이트까지 차단 (과도) | 동일 | dirty 메모에 한해 차단 — 명확 |
| 예상 LOC | +25~35 | (금지) | 0 |
| Risky | 중간~높음 | 금지 | 낮음 |

**권장**: **C (래퍼 없음)**. A-1이 loadAll 머지 단계에서 dirty 메모의 배열 항목을 서버 값으로 교체하지 않으므로 `memo.notes`는 항상 로컬 최신이다. lockedNotes 추가 레이어는 debounce flush/메모 전환 타이밍과 얽혀 새 유실을 만들 위험이 실질적. A-1 테스트 커버리지가 불충분하다고 판단되면 A로 승격.

### 결정 4 — upsert에 `updated_at` 명시 방식

**선결 사실**: memos는 BEFORE UPDATE 트리거 미부착(위 1-3 참조). 따라서 클라이언트가 명시하지 않으면 `updated_at`은 UPDATE 시 갱신되지 않는다.

| 항목 | A: `updated_at: m.updatedAt` (로컬 값 전달) | B: `updated_at: new Date().toISOString()` (매번 새 값) | C: 미명시 (현상 유지) |
|------|---------------------------------------------|--------------------------------------------------------|----------------------|
| 로컬 set 값과 DB 값 일치 | 동일 객체 재사용 → 일치 보장 | 공유 변수로 만들면 일치, 아니면 밀리초 차이 | **불일치** (DB는 이전 값 유지) |
| isArrayEqual 동작 | 정상 ("같음" 판정) | 공유 변수로 구현 시 정상 | **오판** ("다름" → 리렌더/포커스 유실) |
| 트리거 충돌 | 없음 (memos 트리거 부재) | 없음 | 없음 |
| 불변식 관리 비용 | 낮음 (이미 set된 m.updatedAt 재사용) | 중간 (두 지점 동기화 필요) | 없음 |
| 예상 LOC | +2 | +2~4 | 0 |
| Risky | 낮음 | 낮음 | **높음** |

**권장**: **A (`m.updatedAt` 재사용)**. C는 사실상 허용 불가. B는 A와 등가이나 불변식 유지 비용. A는 `updateMemo`가 이미 생성한 `m.updatedAt`을 그대로 payload에 넣으면 되어 가장 단순.

---

## 4. 재사용 가능한 기존 함수 / 패턴

| 패턴 | 위치 | Hotfix-A 활용 |
|------|------|---------------|
| `saving/saved` + 2초 fade state | `src/components/shared/MyProfile.jsx:60-61, 104-126, 199-206` | A-3 저장 상태 UI를 동일 패턴으로. `error` 상태만 추가 |
| `showToast(msg, opts)` | `src/hooks/useStore.js:366-370` | upsert 실패 시 `showToast('노트 저장 실패', { type: 'error' })`로 사용자 알림 |
| `isArrayEqual(a, b)` (id+updatedAt 키 Set 비교) | `src/hooks/useStore.js:193-202` | loadAll 머지에서 계속 사용. 단, 결과를 어떻게 해석할지만 바꿈 (배열 교체 → dirty 격리 후 선택적 교체) |
| Zustand functional update | `src/hooks/useStore.js` 전반 | `set(s => ({...}))` 기존 패턴 유지 |
| `useStore(s => s.xxx)` selector | `src/components/shared/MyProfile.jsx:57`, `src/sync/SyncContext.jsx:11` 등 | 필요 시 MemoryView에서 선택적 구독 — 그러나 결정 2 권장(로컬)에서는 selector 불필요 |
| tasks upsert `updated_at` 명시 선례 | `src/hooks/useStore.js` 내 `taskToRow` 근처 | A-2가 이 패턴을 memos에 이식 |
| debounce + unmount/beforeunload flush | `src/components/views/MemoryView.jsx:60-98` | 기존 구조 유지. 새로운 fade/error state만 덧붙임 |
| `crypto.randomUUID()` id 생성 | `src/hooks/useStore.js:851` | 유지 |

---

## 5. 위험 요소 & 사전 확인 필요

### 5-1. 사전 확인 (spec 단계 이전에 해결)

| # | 항목 | 방법 | 영향 결정 |
|---|------|------|----------|
| 1 | `memos.updated_at` 컬럼 타입 | Supabase 대시보드 → Table Editor → memos | A-2 구현 (ISO 문자열 전달 타당성) |
| 2 | memos UPDATE 트리거 존재 여부 재확인 | Supabase SQL: `SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgrelid = 'memos'::regclass AND tgname NOT LIKE 'RI_%';` | Decision 4 최종 (현재 리포상으로는 없음) |
| 3 | 로컬 `m.updatedAt`과 DB 컬럼 precision 일치 여부 | timestamp with time zone은 microsecond, ISO는 millisecond — 왕복 시 절단 없는지 확인 | A-2: 라운드트립 후 isArrayEqual 통과 여부 |
| 4 | 스냅샷 저장(`useStore.js:499`) 시 `dirtyMemoIds` 직렬화 | plain object는 JSON OK, Set/Map은 `JSON.stringify` 시 `{}` → 제외 처리 필요 | Decision 1 최종 |

### 5-2. 구현 위험

| # | 위험 | 완화 |
|---|------|------|
| R1 | `dirtyMemoIds` 해제 타이밍 오류로 dirty 영구 고착 → 서버 변경이 영원히 반영 안 됨 | upsert Promise의 `.then()`(성공)과 `.catch()`(실패) **둘 다에서** 해제. 단, 실패 시는 메모리 보존 우선 정책이면 유지 — spec에서 결정 |
| R2 | loadAll 머지에서 dirty 메모의 "새 행이 서버에 아직 없는" 케이스 (addMemo 직후 upsert 전) | 로컬에만 있는 dirty 항목은 merge 결과에 추가로 push — `notes-fix-plan.md` 원안 로직 적용 |
| R3 | `updated_at` 명시로 인해 DB가 과거 값으로 write되어 서버 타 클라이언트보다 뒤처지는 현상 | 로컬 시계가 과거일 때만 발생. 현재 단일 사용자 범위에서 실사용 문제 없음. 실시간 협업 단계에서 재검토 |
| R4 | MemoDetailPane `saveState` 타이머와 메모 전환이 엮일 때 타이머 누수 | `clearTimeout`을 cleanup에서 호출 |
| R5 | `isArrayEqual` 호출 비용은 그대로 (dirty 격리는 true일 때만 분기) — 퍼포먼스 영향 없음 | — |
| R6 | dirty 메모 제외 머지 후에도 배열 참조는 항상 새로 만들어야 함. 그렇지 않으면 `memos` 배열이 stable → 구독 컴포넌트가 서버 변경을 인지 못 함 | merged 배열을 `[...merged]` 또는 `.map()`으로 새 참조 보장 |
| R7 | OutlinerEditor의 `lastEmitted` ref와 MemoryView의 `isDirty`가 별개로 동작 — 만약 Decision 3에서 C를 선택했는데 A-1이 미세하게 실패하면 외부 리셋이 발생 | A-1 테스트 커버리지를 spec에서 명시. 불안 시 Decision 3을 A로 승격 |

### 5-3. 테스트 관점 (spec에서 구체화할 시나리오)

- 타이핑 중 `loadAll` 수동 트리거 → 로컬 내용 유지되는지
- 타이핑 완료 500ms 후 `updateMemo` upsert 성공 → dirty 해제, saveState='saved' 2초 후 idle
- 네트워크 오프라인 시 upsert 실패 → dirty 유지, saveState='error', 다음 편집으로 재시도
- 탭 숨김 → 복귀 (`loadAll` 호출) 시 로컬 편집 유지
- 메모 A 타이핑 → 메모 B 전환 → A의 pending save가 올바른 id로 flush
- 신규 메모 생성 직후 서버 upsert 전 `loadAll` 발동 → 로컬에만 있는 메모 사라지지 않음

---

## 저자 권장 조합 요약

| 결정 | 선택 | 사유 |
|------|------|------|
| 1. dirty 자료구조 | **B (plain object)** | 스냅샷 직렬화 안전, 기존 dict 스타일 일관 |
| 2. saveStatus 위치 | **B (MemoryView 로컬)** | MyProfile 선례, 현재 편집 뷰 1개 |
| 3. lockedNotes 래퍼 | **C (없음)** | A-1이 단일 방어로 충분, 새 버그 위험 회피 |
| 4. updated_at 명시 | **A (`m.updatedAt` 재사용)** | 트리거 부재 + 불변식 자연 유지 |

이 조합의 총 예상 변경: **~70~95 LOC**, 2개 파일 (`useStore.js`, `MemoryView.jsx`), 신규 파일 없음.

---

## 다음 단계

`/spec Hotfix-A`를 실행해 위 4개 결정을 확정하고 요구사항을 문서화한다. 확정 이후 `/diff-plan Hotfix-A` → `/execute Hotfix-A` 순.
