-- Loop-35H: notifications.updated_at 컬럼 추가 + 트리거 + 인덱스
-- 배경: notifications 테이블 생성 시 updated_at 누락.
--        폴링 delta sync에 필요하며, Loop-23의 idx_notifications_updated 인덱스의 선행 조건.

-- 1. 컬럼 추가
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. 기존 레코드에 created_at 값으로 백필
UPDATE notifications
  SET updated_at = created_at
  WHERE updated_at IS NULL;

-- 3. 자동 갱신 트리거 연결 (update_updated_at 함수는 Loop-17에서 이미 생성됨)
DROP TRIGGER IF EXISTS set_updated_at ON notifications;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. 인덱스 생성 (Loop-23에서 시도했으나 컬럼 부재로 실패했을 수 있음)
CREATE INDEX IF NOT EXISTS idx_notifications_updated
  ON notifications (updated_at);
