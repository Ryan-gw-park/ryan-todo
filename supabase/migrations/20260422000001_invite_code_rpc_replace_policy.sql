-- ============================================================
-- Security Fix: invite_code 전역 노출 정책 제거 + RPC로 교체
-- Date: 2026-04-22
--
-- 문제:
--   기존 정책 teams_select_by_invite_code (20260313200000):
--     USING (invite_code IS NOT NULL)
--   → authenticated 사용자 누구나 invite_code 있는 모든 팀의
--     {id, name, description, invite_code, created_by, ...} SELECT 가능.
--   → 모든 활성 초대 코드가 로그인 사용자에게 노출되어
--     "초대 코드를 아는 것 = 초대받은 증거"라는 정책 전제가 무너짐.
--
-- 해결:
--   1. teams_select_by_invite_code 정책 제거
--   2. SECURITY DEFINER RPC get_team_by_invite(p_code) 도입
--      - 정확히 일치하는 code만 조회
--      - invite_code 필드는 반환하지 않음
--      - authenticated 사용자만 호출 가능
--
-- 클라이언트 영향:
--   useInvitation.getTeamByInvite + acceptInvite의 직접 쿼리가
--   rpc('get_team_by_invite', { p_code: token }) 호출로 대체됨.
-- ============================================================

-- 1. 느슨한 정책 제거
DROP POLICY IF EXISTS "teams_select_by_invite_code" ON teams;

-- 2. 초대 코드로 팀 정보 조회 RPC
--    SECURITY DEFINER로 RLS를 우회하되, 정확한 code 매칭 + 최소 필드만 반환
CREATE OR REPLACE FUNCTION public.get_team_by_invite(p_code text)
RETURNS TABLE(id uuid, name text, description text, auto_approve boolean)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT t.id, t.name, t.description, t.auto_approve
  FROM teams t
  WHERE t.invite_code = p_code
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_by_invite(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_team_by_invite(text) FROM anon, public;
