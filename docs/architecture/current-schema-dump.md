# Current DB Schema Dump

> 작성일: 2026-03-12
> 목적: Loop-17 마이그레이션 작업 전 기존 스키마 완전 기록

---

## 1. 테이블 목록

현재 Supabase DB에 존재하는 테이블 5개:

| # | 테이블명 | 용도 | 생성 시점 |
|---|---------|------|----------|
| 1 | `tasks` | 할일 (핵심 테이블) | 초기 |
| 2 | `projects` | 프로젝트 | 초기 |
| 3 | `memos` | 노트/메모 | 초기 |
| 4 | `ui_state` | UI 상태 (collapse/expand) | Loop-16 |
| 5 | `push_subscriptions` | Web Push 구독 | Loop-15 |

---

## 2. 테이블별 컬럼 상세

### 2-1. `tasks`

> 출처: `useStore.js` → `taskToRow()` (L25-33), `mapTask()` (L62-69), `migration_loop15.sql`

| 컬럼명 | 타입 | NULL | DEFAULT | 제약조건 | 비고 |
|--------|------|------|---------|---------|------|
| `id` | text | NOT NULL | — | PRIMARY KEY | `Date.now().toString(36) + random` 형식, 프론트엔드 생성 |
| `text` | text | — | — | — | 할일 제목/내용 |
| `project_id` | text | YES | — | — | projects.id 참조 (FK 아닌 앱 레벨 관계) |
| `category` | text | — | — | — | 'today' \| 'next' \| 'backlog' \| 'done' |
| `done` | boolean | — | false | — | 완료 여부 |
| `due_date` | text/date | YES | NULL | — | 마감일 |
| `start_date` | text/date | YES | NULL | — | 시작일 |
| `notes` | text | — | '' | — | 메모/설명 |
| `prev_category` | text | YES | NULL | — | 완료 취소(undo) 시 복원용 |
| `sort_order` | integer/numeric | — | — | — | 정렬 순서 (Date.now() 기반) |
| `alarm` | JSONB | YES | NULL | — | Loop-15에서 추가. `{enabled, datetime, repeat, notified}` |

**참고**: `tasks` 테이블의 정확한 DDL은 Supabase 대시보드에서 직접 생성된 것으로, 초기 마이그레이션 파일이 존재하지 않음. 컬럼 타입은 프론트엔드 코드에서 추론.

### 2-2. `projects`

> 출처: `useStore.js` → `mapProject()` (L59-61), `addProject()` (L288-295), `reorderProjects()` (L326-335)

| 컬럼명 | 타입 | NULL | DEFAULT | 제약조건 | 비고 |
|--------|------|------|---------|---------|------|
| `id` | text | NOT NULL | — | PRIMARY KEY | 프론트엔드 생성 (`uid()`) |
| `name` | text | — | — | — | 프로젝트명 |
| `color` | text | — | — | — | 색상 코드 |
| `sort_order` | integer/numeric | — | 0 | — | 정렬 순서 |

### 2-3. `memos`

> 출처: `useStore.js` → `mapMemo()` (L53-58), `addMemo()` (L338-347), `updateMemo()` (L349-358)

| 컬럼명 | 타입 | NULL | DEFAULT | 제약조건 | 비고 |
|--------|------|------|---------|---------|------|
| `id` | text/uuid | NOT NULL | — | PRIMARY KEY | `crypto.randomUUID()` 형식 (UUID) |
| `title` | text | YES | '' | — | 메모 제목 |
| `notes` | text | YES | '' | — | 메모 내용 |
| `color` | text | — | 'yellow' | — | 메모 색상 |
| `sort_order` | integer/numeric | — | 0 | — | 정렬 순서 |
| `created_at` | timestamptz | — | now() | — | 생성 시각 |
| `updated_at` | timestamptz | — | now() | — | 수정 시각 |

### 2-4. `ui_state`

> 출처: `migration_loop16.sql`, `useStore.js` → `_saveCollapseState()` (L73-85)

| 컬럼명 | 타입 | NULL | DEFAULT | 제약조건 | 비고 |
|--------|------|------|---------|---------|------|
| `id` | text | NOT NULL | 'default' | PRIMARY KEY | 고정값 'default' 사용 |
| `collapse_state` | JSONB | NOT NULL | '{}' | — | 접기/펼치기 상태 저장 |
| `updated_at` | timestamptz | NOT NULL | now() | — | 수정 시각 |

**`collapse_state` JSONB 구조:**
```json
{
  "today": {},
  "matrix": {},
  "matrixDone": {},
  "timeline": {},
  "projectExpanded": {},
  "projectSection": {},
  "projectAllTop": {},
  "memo": {},
  "memoAllTop": {},
  "detailAllTop": {}
}
```

### 2-5. `push_subscriptions`

> 출처: `migration_loop15_4.sql`, `webPush.js`

| 컬럼명 | 타입 | NULL | DEFAULT | 제약조건 | 비고 |
|--------|------|------|---------|---------|------|
| `id` | uuid | NOT NULL | gen_random_uuid() | PRIMARY KEY | |
| `user_id` | text | NOT NULL | 'default' | — | 현재 고정값 사용 |
| `endpoint` | text | NOT NULL | — | UNIQUE | Push 구독 엔드포인트 |
| `p256dh` | text | NOT NULL | — | — | 암호화 키 |
| `auth` | text | NOT NULL | — | — | 인증 키 |
| `created_at` | timestamptz | — | now() | — | |
| `updated_at` | timestamptz | — | now() | — | |

---

## 3. FK (Foreign Key) 관계

**현재 DB 레벨 FK 없음.**

- `tasks.project_id` → `projects.id`: 앱 레벨에서만 관계 유지 (DB FK 미설정)
- 모든 ID가 프론트엔드에서 text로 생성되어 DB FK 제약 없이 운영 중

---

## 4. 기존 RLS 정책

### 4-1. `ui_state` (출처: `migration_loop16.sql`)

| 정책명 | 대상 | 작업 | 조건 |
|--------|------|------|------|
| `Authenticated users can read ui_state` | authenticated | SELECT | true |
| `Authenticated users can update ui_state` | authenticated | UPDATE | true |
| `Authenticated users can insert ui_state` | authenticated | INSERT | true |

### 4-2. `push_subscriptions` (출처: `migration_loop15_4.sql`)

| 정책명 | 대상 | 작업 | 조건 |
|--------|------|------|------|
| `allow_all` | — | ALL | true (USING + WITH CHECK) |

### 4-3. `tasks`, `projects`, `memos`

**마이그레이션 파일에 RLS 정책 없음.** Supabase 대시보드에서 직접 설정되었을 가능성 있음. 프론트엔드 코드에서 RLS 관련 로직 없음 (모든 인증된 사용자가 전체 접근하는 구조).

> ⚠ **확인 필요**: Supabase 대시보드에서 `tasks`, `projects`, `memos` 테이블의 실제 RLS 상태 확인 필요 (활성화 여부 + 정책 목록). 마이그레이션 파일이 없어 코드에서 확인 불가.

---

## 5. 기존 인덱스

### 확인된 인덱스 (마이그레이션 파일 기준)

| 테이블 | 인덱스명 | 컬럼/조건 | 출처 |
|--------|---------|-----------|------|
| `tasks` | `idx_tasks_alarm` | `(alarm IS NOT NULL) WHERE alarm IS NOT NULL` | `migration_loop15.sql` |
| `push_subscriptions` | `idx_push_subscriptions_endpoint` | `(endpoint)` UNIQUE | `migration_loop15_4.sql` |

### 암시적 인덱스 (PK, UNIQUE)

| 테이블 | 자동 인덱스 | 대상 |
|--------|-----------|------|
| `tasks` | PK index | `id` |
| `projects` | PK index | `id` |
| `memos` | PK index | `id` |
| `ui_state` | PK index | `id` |
| `push_subscriptions` | PK index | `id` |

> ⚠ `sort_order`, `project_id`, `category` 등에 인덱스 없음.

---

## 6. 기존 트리거/함수

**마이그레이션 파일에 트리거/함수 없음.**

- `updated_at` 자동 갱신 트리거 없음 (프론트엔드에서 직접 관리하거나 DB 기본값에 의존)
- Edge Function: `send-alarm` (Deno, `supabase/functions/send-alarm/index.ts`)
  - `push_subscriptions` 테이블에서 구독 목록 조회 후 Web Push 발송
  - 만료(410) 구독 자동 삭제

---

## 7. 프론트엔드 테이블/컬럼 참조 위치

### 7-1. `tasks` 테이블 참조

| 파일 | 라인 | 코드 | 설명 |
|------|------|------|------|
| `src/hooks/useStore.js` | L25-33 | `taskToRow(t)` | 프론트→DB 컬럼 매핑 |
| `src/hooks/useStore.js` | L62-69 | `mapTask(r)` | DB→프론트 컬럼 매핑 |
| `src/hooks/useStore.js` | L37 | `d.from('tasks').upsert(row)` | INSERT/UPDATE |
| `src/hooks/useStore.js` | L43 | `d.from('tasks').upsert(rowWithout)` | alarm 없는 fallback |
| `src/hooks/useStore.js` | L159 | `d.from('tasks').select('*').order('sort_order')` | 전체 조회 |
| `src/hooks/useStore.js` | L217 | `d.from('tasks').delete().eq('id', id)` | 삭제 |
| `src/hooks/useStore.js` | L312 | `d.from('tasks').delete().eq('id', tid)` | 프로젝트 삭제 시 연관 태스크 삭제 |

### 7-2. `projects` 테이블 참조

| 파일 | 라인 | 코드 | 설명 |
|------|------|------|------|
| `src/hooks/useStore.js` | L59-61 | `mapProject(r)` | DB→프론트 매핑 |
| `src/hooks/useStore.js` | L158 | `d.from('projects').select('*').order('sort_order')` | 전체 조회 |
| `src/hooks/useStore.js` | L293 | `d.from('projects').upsert({...})` | 생성 |
| `src/hooks/useStore.js` | L303 | `d.from('projects').upsert({...})` | 수정 |
| `src/hooks/useStore.js` | L320 | `d.from('projects').delete().eq('id', id)` | 삭제 |
| `src/hooks/useStore.js` | L332 | `d.from('projects').upsert(rows)` | 순서 변경 |
| `src/components/shared/SetupScreen.jsx` | L16 | `getDb().from('projects').select('id').limit(1)` | 연결 테스트 |

### 7-3. `memos` 테이블 참조

| 파일 | 라인 | 코드 | 설명 |
|------|------|------|------|
| `src/hooks/useStore.js` | L53-58 | `mapMemo(r)` | DB→프론트 매핑 |
| `src/hooks/useStore.js` | L160 | `d.from('memos').select('*').order('sort_order')` | 전체 조회 |
| `src/hooks/useStore.js` | L343-345 | `d.from('memos').upsert({...})` | 생성 |
| `src/hooks/useStore.js` | L355-357 | `d.from('memos').upsert({...})` | 수정 |
| `src/hooks/useStore.js` | L365 | `d.from('memos').delete().eq('id', id)` | 삭제 |

### 7-4. `ui_state` 테이블 참조

| 파일 | 라인 | 코드 | 설명 |
|------|------|------|------|
| `src/hooks/useStore.js` | L78-82 | `d.from('ui_state').upsert({...})` | 상태 저장 (debounced) |
| `src/hooks/useStore.js` | L161 | `d.from('ui_state').select('collapse_state').eq('id', 'default').maybeSingle()` | 상태 조회 |

### 7-5. `push_subscriptions` 테이블 참조

| 파일 | 라인 | 코드 | 설명 |
|------|------|------|------|
| `src/utils/webPush.js` | L30-33 | `supabase.from('push_subscriptions').upsert({...})` | 구독 저장 |
| `src/utils/webPush.js` | L45 | `supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)` | 구독 삭제 |
| `supabase/functions/send-alarm/index.ts` | L36 | `supabase.from('push_subscriptions').select('endpoint, p256dh, auth')` | 구독 조회 (Edge Function) |
| `supabase/functions/send-alarm/index.ts` | L55 | `supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)` | 만료 구독 삭제 |

### 7-6. Edge Function 참조

| 파일 | 라인 | 코드 | 설명 |
|------|------|------|------|
| `src/hooks/useAlarmEngine.js` | L66 | `d.functions.invoke('send-alarm', { body: { taskId, taskText } })` | 알람 Edge Function 호출 |

---

## 8. ID 생성 방식

| 테이블 | ID 생성 | 타입 | 위치 |
|--------|---------|------|------|
| `tasks` | `Date.now().toString(36) + Math.random().toString(36).slice(2,6)` | text | `useStore.js:13` → `uid()` |
| `projects` | 동일 (`uid()`) | text | `useStore.js:289` |
| `memos` | `crypto.randomUUID()` | uuid (text 저장) | `useStore.js:339` |
| `ui_state` | 고정값 `'default'` | text | `useStore.js:79` |
| `push_subscriptions` | `gen_random_uuid()` (DB 측) | uuid | `migration_loop15_4.sql:2` |

---

## 9. 아키텍처 문서(v2.0)와의 불일치 요약

| 항목 | 기존 (현재) | 아키텍처 문서 (목표) | 차이 |
|------|-----------|-------------------|------|
| 할일 테이블명 | `tasks` | `todos` | 이름 |
| 노트 테이블명 | `memos` | `notes` | 이름 |
| 할일 제목 컬럼 | `text` | `title` | 이름 |
| 할일 설명 컬럼 | `notes` | `description` | 이름 |
| 완료 상태 | `done` (boolean) | `status` (text: todo/in_progress/done) | 타입+구조 |
| 카테고리 | `category` (today/next/backlog/done) | `row_category` (today/next/remaining/completed) | 이름+값 |
| 알람 | `alarm` (JSONB) | `alarm_at` (timestamptz) + `alarm_repeat` (text) | 구조 |
| ID 타입 | text (프론트 생성) | uuid (DB 생성) | 타입 |
| FK 관계 | 없음 (앱 레벨) | 있음 (DB FK) | 무결성 |
| `created_by` | 없음 | uuid NOT NULL FK | 신규 |
| `assignee_id` | 없음 | uuid FK | 신규 |
| `scope` | 없음 | text DEFAULT 'private' | 신규 |
| `team_id` | 없음 | uuid FK | 신규 |
| `highlight_color` | 없음 | text | 신규 |
| projects.`user_id` | 없음 | uuid FK | 신규 |
| projects.`team_id` | 없음 | uuid FK | 신규 |
| projects.`created_by` | 없음 | uuid FK | 신규 |
| projects.`is_archived` | 없음 | boolean DEFAULT false | 신규 |
| `updated_at` on tasks | 없음 (확인 필요) | timestamptz DEFAULT now() | 신규 |

---

## 10. 마이그레이션 파일 이력

| 파일 | 내용 | Loop |
|------|------|------|
| `migration_loop15.sql` | tasks에 alarm JSONB 컬럼 + 인덱스 추가 | Loop-15 |
| `migration_loop15_4.sql` | push_subscriptions 테이블 생성 + RLS | Loop-15 |
| `migration_loop16.sql` | ui_state 테이블 생성 + RLS | Loop-16 |

> ⚠ `tasks`, `projects`, `memos` 테이블의 초기 CREATE TABLE 마이그레이션 파일이 없음. Supabase 대시보드에서 직접 생성된 것으로 추정.
