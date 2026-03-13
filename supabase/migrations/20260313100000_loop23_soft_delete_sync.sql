-- Loop-23: Soft Delete + 폴링 동기화 인덱스

-- tasks에 deleted_at 추가
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- soft delete 필터 성능 인덱스
CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at) WHERE deleted_at IS NOT NULL;

-- comments updated_at 인덱스 (폴링 delta fetch용)
CREATE INDEX IF NOT EXISTS idx_comments_updated ON comments(updated_at);

-- notifications updated_at 인덱스 (폴링 delta fetch용)
CREATE INDEX IF NOT EXISTS idx_notifications_updated ON notifications(updated_at);
