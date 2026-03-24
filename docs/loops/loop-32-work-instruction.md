# Loop-32: 프로젝트·마일스톤 스키마 확장

> **목표:** projects와 key_milestones 테이블에 관리에 필요한 정보 컬럼을 추가하고, RLS 정책을 업데이트한다.
> **범위:** DB 스키마 + Store 데이터 로딩/저장 + 기존 UI에서 새 필드 읽기/쓰기 최소 연결. UI 레이아웃 변경은 Loop-33.
> **선행 조건:** Loop-31 완료 (category:'done' 폐지, applyTransitionRules 적용)

---

## 배경

### 현재 스키마 vs 필요 스키마

**projects 테이블:**
| 항목 | 현재 | 추가 |
|------|------|------|
| 이름 | ✅ name | — |
| 색상 | ✅ color | — |
| 순서 | ✅ sort_order | — |
| 팀 | ✅ team_id | — |
| 오너 | ✅ owner_id | — |
| 아카이브 | ✅ is_archived (UI 없음) | — |
| 설명 | ❌ | + description |
| 시작일 | ❌ | + start_date |
| 마감일 | ❌ | + due_date |
| 상태 | ❌ | + status |
| 생성자 | ❌ | + created_by |

**key_milestones 테이블:**
| 항목 | 현재 | 추가 |
|------|------|------|
| 제목 | ✅ title | — |
| 색상 | ✅ color | — |
| 순서 | ✅ sort_order | — |
| 프로젝트 | ✅ project_id | — |
| 설명 | ✅ description (이미 존재) | — |
| 시작일 | ✅ start_date (이미 존재) | — |
| 마감일 | ✅ end_date (이미 존재) | — |
| 담당자 | ❌ | + owner_id |
| 상태 | ❌ | + status |
| 생성자 | ❌ | + created_by |

> **주의:** key_milestones에는 description, start_date, end_date가 이미 존재하는 것으로 확인됨 (MilestoneHeader에서 편집 가능). 작업 시작 전 실제 테이블 구조를 `\d key_milestones` 로 반드시 재확인.

### Reference 테이블 RLS placeholder 수정 대상

| 테이블 | 현재 정책 |
|--------|---------|
| project_references | USING(true) |
| ref_milestones | USING(true) |
| ref_deliverables | USING(true) |
| ref_links | USING(true) |
| ref_policies | USING(true) |

---

## 작업 순서

> 반드시 작업 1(스키마 확인) → 2(마이그레이션) → 3(Store) → 4(UI 최소 연결) → 5(RLS) 순서.

---

### 작업 0: 현재 스키마 실제 확인 (필수 선행)

DB에서 실제 테이블 구조를 조회하여 아래 정보를 확인한다. 이 결과에 따라 작업 2의 마이그레이션 SQL이 달라진다.

```sql
-- Supabase SQL Editor에서 실행

-- projects 테이블 전체 컬럼
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'projects'
ORDER BY ordinal_position;

-- key_milestones 테이블 전체 컬럼
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'key_milestones'
ORDER BY ordinal_position;

-- key_milestones 기존 CHECK 제약조건
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'key_milestones'::regclass;

-- projects 기존 CHECK 제약조건
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'projects'::regclass;

-- Reference 테이블들의 현재 RLS 정책
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('project_references', 'ref_milestones', 'ref_deliverables', 'ref_links', 'ref_policies');
```

**결과를 기록하고, 아래 작업 2의 마이그레이션 SQL에서 "이미 존재하는 컬럼"은 `ADD COLUMN IF NOT EXISTS`로 보호되므로 안전하지만, 기록해 두어야 한다.**

---

### 작업 1: projects 테이블 마이그레이션

새 마이그레이션 파일: `supabase/migrations/2026XXXX_loop32_schema_extension.sql`

> 타임스탬프는 실행 시점에 맞춰 생성.

```sql
-- =============================================================
-- Loop-32: 프로젝트·마일스톤 스키마 확장
-- =============================================================

-- ─── projects 테이블 확장 ───

-- 설명
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- 기간
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT NULL;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT NULL;

-- 상태
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- status CHECK 제약조건 (이미 없을 때만)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'projects'::regclass
    AND conname = 'projects_status_check'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_status_check
      CHECK (status IN ('active', 'on_hold', 'completed', 'archived'));
  END IF;
END $$;

-- 생성자
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT NULL;
-- FK는 profiles 테이블 존재 시에만
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'projects'::regclass
    AND conname = 'projects_created_by_fkey'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES profiles(id);
  END IF;
END $$;
```

---

### 작업 2: key_milestones 테이블 마이그레이션

같은 마이그레이션 파일에 이어서:

```sql
-- ─── key_milestones 테이블 확장 ───

-- 담당자
ALTER TABLE key_milestones
  ADD COLUMN IF NOT EXISTS owner_id UUID DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'key_milestones'::regclass
    AND conname = 'key_milestones_owner_id_fkey'
  ) THEN
    ALTER TABLE key_milestones
      ADD CONSTRAINT key_milestones_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES profiles(id);
  END IF;
END $$;

-- 상태
ALTER TABLE key_milestones
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'not_started';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'key_milestones'::regclass
    AND conname = 'key_milestones_status_check'
  ) THEN
    ALTER TABLE key_milestones
      ADD CONSTRAINT key_milestones_status_check
      CHECK (status IN ('not_started', 'in_progress', 'completed'));
  END IF;
END $$;

-- 생성자
ALTER TABLE key_milestones
  ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'key_milestones'::regclass
    AND conname = 'key_milestones_created_by_fkey'
  ) THEN
    ALTER TABLE key_milestones
      ADD CONSTRAINT key_milestones_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES profiles(id);
  END IF;
END $$;

-- ─── description, start_date, end_date가 없을 경우를 대비 ───
-- (이미 존재하면 IF NOT EXISTS가 보호)
ALTER TABLE key_milestones
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

ALTER TABLE key_milestones
  ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT NULL;

ALTER TABLE key_milestones
  ADD COLUMN IF NOT EXISTS end_date DATE DEFAULT NULL;
```

---

### 작업 3: Reference 테이블 RLS 정책 수정

같은 마이그레이션 파일에 이어서:

```sql
-- ─── Reference 테이블 RLS placeholder → 프로젝트 소속 기반 정책 ───

-- project_references: 프로젝트 소속 팀의 멤버만 접근
DROP POLICY IF EXISTS "project_references_select" ON project_references;
DROP POLICY IF EXISTS "project_references_insert" ON project_references;
DROP POLICY IF EXISTS "project_references_update" ON project_references;
DROP POLICY IF EXISTS "project_references_delete" ON project_references;

-- 기존 placeholder 정책 이름이 다를 수 있으므로 모든 정책 제거 후 재생성
-- (테이블이 존재하지 않을 수도 있으므로 DO 블록으로 안전하게)
DO $$
BEGIN
  -- project_references
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_references') THEN
    -- 기존 정책 모두 삭제
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'project_references') LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON project_references', r.policyname);
    END LOOP;

    -- SELECT: 프로젝트가 내 팀에 속하거나 내가 생성한 개인 프로젝트
    CREATE POLICY "project_refs_select" ON project_references FOR SELECT
    USING (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );

    -- INSERT/UPDATE/DELETE: 동일 조건
    CREATE POLICY "project_refs_insert" ON project_references FOR INSERT
    WITH CHECK (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );

    CREATE POLICY "project_refs_update" ON project_references FOR UPDATE
    USING (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );

    CREATE POLICY "project_refs_delete" ON project_references FOR DELETE
    USING (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );
  END IF;
END $$;

-- ref_milestones, ref_deliverables, ref_links, ref_policies에 대해서도 동일 패턴 적용
-- 각 테이블이 project_id를 직접 가지는지, milestone을 통해 간접 참조하는지에 따라
-- USING 조건이 달라질 수 있음. 작업 0에서 확인한 스키마를 기반으로 결정.

-- 패턴: milestone 경유 참조인 경우
-- USING (
--   milestone_id IN (
--     SELECT id FROM key_milestones
--     WHERE project_id IN (
--       SELECT id FROM projects
--       WHERE team_id IN (SELECT get_my_team_ids())
--       OR (team_id IS NULL AND user_id = auth.uid())
--     )
--   )
-- )
```

> **주의:** Reference 테이블의 실제 컬럼명과 FK 구조는 작업 0에서 확인한 결과에 따라 조정. 위 SQL은 패턴 제시이며, 실제 테이블 구조에 맞춰야 한다.

---

### 작업 4: Store 데이터 로딩 확장

**대상 파일:** `src/store/useStore.js`

**4-1. projects 로딩에서 새 컬럼 포함**

현재 projects를 로딩하는 select 쿼리를 찾는다:

```bash
grep -n "from('projects')\|\.from.*project" src/store/useStore.js
```

select('*')를 사용하고 있다면 새 컬럼이 자동으로 포함되므로 변경 불필요.
특정 컬럼만 select하고 있다면 새 컬럼을 추가한다:
`description, start_date, due_date, status, created_by`

**4-2. key_milestones 로딩에서 새 컬럼 포함**

```bash
grep -n "from('key_milestones')\|\.from.*milestone" src/store/useStore.js
```

동일하게 확인 후 필요시 추가:
`owner_id, status, created_by`
(description, start_date, end_date는 이미 존재할 가능성 높음)

**4-3. projects 생성(addProject) 시 새 컬럼 초기값**

```bash
grep -n "addProject\|createProject" src/store/useStore.js -A 20
```

addProject 함수에서 Supabase insert 시 새 컬럼의 기본값을 포함하도록 수정:

```javascript
// 기존 필드에 추가:
description: '',
start_date: null,
due_date: null,
status: 'active',
created_by: userId,  // 현재 로그인 사용자
```

> created_by는 생성 시에만 설정하고 이후 변경 불가 (불변 필드).

**4-4. key_milestones 생성(addMilestone) 시 새 컬럼 초기값**

```bash
grep -n "addMilestone\|createMilestone" src/store/useStore.js -A 20
```

addMilestone 함수에 추가:

```javascript
owner_id: null,       // 생성 시 미배정, UI에서 나중에 설정
status: 'not_started',
created_by: userId,
```

**4-5. projects 업데이트 시 새 컬럼 저장**

updateProject 함수(또는 projects를 업데이트하는 함수)를 찾아서, 새 컬럼이 patch에 포함될 수 있도록 허용하는지 확인.

```bash
grep -n "updateProject\|update.*project" src/store/useStore.js -A 15
```

patch를 그대로 Supabase에 전달하는 구조라면 추가 작업 불필요.
특정 필드만 허용하는 화이트리스트 방식이라면 새 필드를 추가한다.

**4-6. key_milestones 업데이트 시 새 컬럼 저장**

```bash
grep -n "updateMilestone\|update.*milestone" src/store/useStore.js -A 15
```

동일하게 확인 후 필요시 새 필드를 허용.

---

### 작업 5: 기존 UI에서 새 필드 최소 연결

> **원칙:** Loop-33에서 UI를 통합 정비하므로, 이번에는 **데이터가 정상적으로 읽히고 저장되는 것**만 확인. 새로운 UI 요소는 추가하지 않음.

**5-1. 프로젝트 생성 시 created_by 자동 설정**

addProject 호출 시 created_by가 현재 userId로 설정되는지 확인 (작업 4-3에서 처리됨).

**5-2. 마일스톤 생성 시 created_by 자동 설정**

addMilestone 호출 시 created_by가 현재 userId로 설정되는지 확인 (작업 4-4에서 처리됨).

**5-3. 프로젝트 status 기본값 확인**

새로 만든 프로젝트가 status='active'로 생성되는지 확인.

**5-4. 마일스톤 status 기본값 확인**

새로 만든 마일스톤이 status='not_started'로 생성되는지 확인.

**5-5. 기존 마일스톤 편집 UI와의 호환성**

MilestoneHeader에서 이미 description, start_date, end_date를 편집하고 있으므로, 새로 추가한 컬럼(owner_id, status, created_by)이 기존 편집 로직을 방해하지 않는지 확인. select('*')라면 자동 포함되어 문제 없을 것.

---

## 완료 검증 체크리스트

```
[ ] 1. 작업 0 완료 — projects, key_milestones 실제 컬럼 구조 확인 기록
[ ] 2. 마이그레이션 SQL 생성 — supabase/migrations/ 디렉토리에 파일 존재
[ ] 3. 마이그레이션 실행 성공 — Supabase에서 에러 없이 적용
[ ] 4. projects 테이블에 새 컬럼 존재 확인:
       SELECT column_name FROM information_schema.columns
       WHERE table_name = 'projects'
       AND column_name IN ('description', 'start_date', 'due_date', 'status', 'created_by');
       → 5건
[ ] 5. key_milestones 테이블에 새 컬럼 존재 확인:
       SELECT column_name FROM information_schema.columns
       WHERE table_name = 'key_milestones'
       AND column_name IN ('owner_id', 'status', 'created_by');
       → 3건 (description, start_date, end_date는 기존 존재 확인)
[ ] 6. projects.status CHECK 제약조건 동작:
       INSERT INTO projects (id, name, status) VALUES ('test', 'test', 'invalid');
       → 에러 발생해야 함
[ ] 7. key_milestones.status CHECK 제약조건 동작:
       동일하게 확인
[ ] 8. Store에서 projects 로딩 시 새 컬럼 포함됨
       → 앱에서 프로젝트 목록 로딩 후 console.log로 확인
[ ] 9. Store에서 key_milestones 로딩 시 새 컬럼 포함됨
[ ] 10. 프로젝트 생성 시 created_by가 현재 userId로 설정됨
[ ] 11. 마일스톤 생성 시 created_by가 현재 userId로 설정됨
[ ] 12. 프로젝트 생성 시 status='active'
[ ] 13. 마일스톤 생성 시 status='not_started'
[ ] 14. Reference 테이블 RLS placeholder가 실제 정책으로 교체됨
        (또는 해당 테이블이 없으면 N/A)
[ ] 15. 기존 기능 회귀 없음:
        - 프로젝트 생성/수정/삭제 정상
        - 마일스톤 생성/수정/삭제 정상
        - 마일스톤에서 title/description/dates 인라인 편집 정상
        - 할일의 projectId/milestoneId 연결 정상
        - MatrixView 프로젝트 열 정상 표시
        - ProjectView 마일스톤 탭 정상
[ ] 16. 빌드 성공, 에러 0건
```

---

## 주의사항

1. **IF NOT EXISTS / DO $$ 블록 사용:** 마이그레이션이 멱등(idempotent)하도록 모든 ALTER TABLE에 IF NOT EXISTS, 모든 제약조건에 존재 확인 포함.

2. **기존 컬럼명 변경 금지:** tasks 테이블의 text, done, category, alarm, notes 등은 절대 변경하지 않는다. 이번 작업은 projects와 key_milestones만 대상.

3. **select('*') 여부:** Store에서 select('*')를 사용 중이라면 새 컬럼이 자동 포함되어 대부분의 Store 작업이 불필요. 하지만 addProject/addMilestone의 insert 시 기본값 설정은 필요.

4. **Reference 테이블 RLS:** 실제 테이블 구조를 작업 0에서 확인한 후 SQL을 확정한다. 테이블이 존재하지 않으면 해당 부분은 스킵.

5. **created_by 불변 원칙:** created_by는 INSERT 시에만 설정하고, UPDATE에서는 변경하지 않는다. RLS 정책에서 이를 보호할 수도 있지만, 이번 Loop에서는 앱 레벨에서만 관리.

---

## 다음 Loop 예고

- **Loop-33:** UI 통합 정비 — 프로젝트 설정 모달 통합(이름, 색상, 오너, 기간, 상태, 설명, 아카이브를 한 곳에서), 마일스톤 상세 패널 통합(제목, 담당자, 기간, 상태, 색상, 설명을 한 곳에서), 진행률 표시
