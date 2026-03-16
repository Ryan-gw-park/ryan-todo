-- Loop-27: 프로젝트 Owner(책임자) 지정
-- 순수 표시 목적. 특별한 권한 없음.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 기존 프로젝트의 owner_id를 user_id(생성자)로 초기화
UPDATE projects SET owner_id = user_id WHERE owner_id IS NULL AND user_id IS NOT NULL;
