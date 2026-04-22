-- ============================================================
-- Fix: teams INSERT ... RETURNING 42501 RLS 위반
-- Date: 2026-04-22
--
-- 증상:
--   팀 생성 시 POST /rest/v1/teams?select=* → 403 Forbidden (42501)
--   "new row violates row-level security policy for table 'teams'"
--
-- 원인:
--   - teams_insert WITH CHECK (created_by = auth.uid()) 은 통과
--   - 그러나 Supabase JS의 .insert().select()는 return=representation을
--     사용하므로, 방금 INSERT된 행이 SELECT 정책도 통과해야 함.
--   - 기존 SELECT 정책(teams_select_member)은 team_members 행이 있어야
--     하는데, team_members INSERT는 teams INSERT 다음 단계라 새 팀은
--     아직 get_my_team_ids()에 포함 안 됨 → RETURNING 실패 → 42501.
--
-- 해결:
--   created_by = auth.uid()인 행은 본인이 SELECT 가능하도록 정책 추가.
--   이로써 INSERT ... RETURNING이 정상 동작.
-- ============================================================

DROP POLICY IF EXISTS "teams_select_own_created" ON teams;

CREATE POLICY "teams_select_own_created" ON teams FOR SELECT
  USING (created_by = auth.uid());
