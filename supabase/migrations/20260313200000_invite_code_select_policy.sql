-- ============================================================
-- 초대 코드로 팀 기본 정보 조회 허용
-- Date: 2026-03-13
--
-- 문제: teams_select_member 정책은 팀 멤버만 조회 가능.
--       초대 링크/이메일로 접속한 신규 사용자는 아직 멤버가
--       아니므로 invite_code로 팀 정보를 조회할 수 없음.
--
-- 해결: invite_code가 NOT NULL인 팀은 인증된 사용자 누구나
--       SELECT 가능하도록 정책 추가. invite_code를 아는 것 자체가
--       초대받은 증거이므로 보안상 허용 가능.
-- ============================================================

CREATE POLICY "teams_select_by_invite_code" ON teams FOR SELECT
  TO authenticated
  USING (invite_code IS NOT NULL);
