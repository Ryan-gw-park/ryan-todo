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

-- 생성자 (이미 존재할 수 있음 — IF NOT EXISTS로 보호)
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

-- ─── Reference 테이블 RLS placeholder → 프로젝트 소속 기반 정책 ───

-- 모든 Reference 테이블은 project_id(text) 컬럼을 직접 보유
-- 기존 placeholder 정책 삭제 후 프로젝트 소속 기반 정책 재생성

-- === project_references ===
DO $$
DECLARE r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_references') THEN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'project_references') LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON project_references', r.policyname);
    END LOOP;

    CREATE POLICY "project_refs_select" ON project_references FOR SELECT
    USING (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );

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

-- === ref_milestones ===
DO $$
DECLARE r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ref_milestones') THEN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'ref_milestones') LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON ref_milestones', r.policyname);
    END LOOP;

    CREATE POLICY "ref_milestones_select" ON ref_milestones FOR SELECT
    USING (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );

    CREATE POLICY "ref_milestones_insert" ON ref_milestones FOR INSERT
    WITH CHECK (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );

    CREATE POLICY "ref_milestones_update" ON ref_milestones FOR UPDATE
    USING (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );

    CREATE POLICY "ref_milestones_delete" ON ref_milestones FOR DELETE
    USING (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );
  END IF;
END $$;

-- === ref_deliverables ===
DO $$
DECLARE r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ref_deliverables') THEN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'ref_deliverables') LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON ref_deliverables', r.policyname);
    END LOOP;

    CREATE POLICY "ref_deliverables_select" ON ref_deliverables FOR SELECT
    USING (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );

    CREATE POLICY "ref_deliverables_insert" ON ref_deliverables FOR INSERT
    WITH CHECK (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );

    CREATE POLICY "ref_deliverables_update" ON ref_deliverables FOR UPDATE
    USING (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );

    CREATE POLICY "ref_deliverables_delete" ON ref_deliverables FOR DELETE
    USING (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );
  END IF;
END $$;

-- === ref_links ===
DO $$
DECLARE r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ref_links') THEN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'ref_links') LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON ref_links', r.policyname);
    END LOOP;

    CREATE POLICY "ref_links_select" ON ref_links FOR SELECT
    USING (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );

    CREATE POLICY "ref_links_insert" ON ref_links FOR INSERT
    WITH CHECK (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );

    CREATE POLICY "ref_links_update" ON ref_links FOR UPDATE
    USING (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );

    CREATE POLICY "ref_links_delete" ON ref_links FOR DELETE
    USING (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );
  END IF;
END $$;

-- === ref_policies ===
DO $$
DECLARE r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ref_policies') THEN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'ref_policies') LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON ref_policies', r.policyname);
    END LOOP;

    CREATE POLICY "ref_policies_select" ON ref_policies FOR SELECT
    USING (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );

    CREATE POLICY "ref_policies_insert" ON ref_policies FOR INSERT
    WITH CHECK (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );

    CREATE POLICY "ref_policies_update" ON ref_policies FOR UPDATE
    USING (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );

    CREATE POLICY "ref_policies_delete" ON ref_policies FOR DELETE
    USING (
      project_id IN (
        SELECT id FROM projects
        WHERE team_id IN (SELECT get_my_team_ids())
        OR (team_id IS NULL AND user_id = auth.uid())
      )
    );
  END IF;
END $$;
