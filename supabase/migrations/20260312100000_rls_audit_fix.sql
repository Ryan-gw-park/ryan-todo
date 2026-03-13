-- ============================================================
-- RLS 감사 보완 마이그레이션
-- Date: 2026-03-12
-- Ref: loop-21 RLS 전수 점검
--
-- 변경 사항:
--   1. push_subscriptions: allow_all → 본인 구독만 관리
--   2. ui_state: DELETE 정책 추가 (일관성)
--   3. notifications: INSERT 정책 추가 (서비스 역할 + 본인)
-- ============================================================


-- ============================================================
-- 1. push_subscriptions: 과도한 allow_all 정책 → 본인만 CRUD
-- 기존: USING(true) = anon 포함 전체 허용 (보안 위험)
-- 변경: user_id = auth.uid() 기반 제한
-- ============================================================

DROP POLICY IF EXISTS "allow_all" ON push_subscriptions;

-- 본인 구독 조회
CREATE POLICY "push_sub_select_own" ON push_subscriptions FOR SELECT
  USING (user_id::uuid = auth.uid());

-- 본인 구독 생성 (user_id가 text 타입이므로 캐스팅)
CREATE POLICY "push_sub_insert_own" ON push_subscriptions FOR INSERT
  WITH CHECK (user_id::uuid = auth.uid());

-- 본인 구독 수정
CREATE POLICY "push_sub_update_own" ON push_subscriptions FOR UPDATE
  USING (user_id::uuid = auth.uid());

-- 본인 구독 삭제
CREATE POLICY "push_sub_delete_own" ON push_subscriptions FOR DELETE
  USING (user_id::uuid = auth.uid());


-- ============================================================
-- 2. ui_state: DELETE 정책 추가 (일관성)
-- 기존: SELECT/INSERT/UPDATE만 있음 (authenticated)
-- ============================================================

CREATE POLICY "Authenticated users can delete ui_state"
  ON ui_state FOR DELETE TO authenticated USING (true);


-- ============================================================
-- 3. notifications: INSERT 정책 추가
-- 알림은 주로 서버(service_role)에서 생성하지만,
-- 클라이언트에서 직접 생성이 필요한 경우(예: 멘션 알림)를 위해
-- 본인이 actor인 알림만 INSERT 허용
-- ============================================================

CREATE POLICY "notifications_insert" ON notifications FOR INSERT
  WITH CHECK (actor_id = auth.uid());

-- 본인 관련 알림 읽음 처리 (is_read 등)
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  USING (target_user_id = auth.uid());


-- ============================================================
-- DONE: RLS 감사 보완 완료
-- ============================================================
