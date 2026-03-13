-- Loop-22: 알림 생성 트리거 4개
-- 팀 할일 생성/배정/완료, 댓글 작성 시 notifications 테이블에 자동 레코드 생성

-- ═══ 트리거 1: 할일 생성 알림 ═══
CREATE OR REPLACE FUNCTION notify_task_created()
RETURNS trigger AS $$
BEGIN
  IF NEW.scope IN ('team', 'assigned') AND NEW.team_id IS NOT NULL THEN
    INSERT INTO notifications (team_id, actor_id, task_id, event_type, message)
    VALUES (
      NEW.team_id,
      NEW.created_by,
      NEW.id,
      'created',
      (SELECT COALESCE(tm.display_name, p.display_name)
       FROM profiles p
       LEFT JOIN team_members tm ON tm.user_id = p.id AND tm.team_id = NEW.team_id
       WHERE p.id = NEW.created_by)
      || '이(가) ''' || LEFT(NEW.text, 50) || '''을(를) 생성했습니다'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_task_created
  AFTER INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_task_created();

-- ═══ 트리거 2: 할일 배정 알림 ═══
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS trigger AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL
     AND (OLD.assignee_id IS NULL OR OLD.assignee_id != NEW.assignee_id)
     AND NEW.team_id IS NOT NULL THEN
    INSERT INTO notifications (team_id, actor_id, target_user_id, task_id, event_type, message)
    VALUES (
      NEW.team_id,
      auth.uid(),
      NEW.assignee_id,
      NEW.id,
      'assigned',
      (SELECT COALESCE(tm.display_name, p.display_name)
       FROM profiles p
       LEFT JOIN team_members tm ON tm.user_id = p.id AND tm.team_id = NEW.team_id
       WHERE p.id = auth.uid())
      || '이(가) ''' || LEFT(NEW.text, 50) || '''을(를) '
      || (SELECT COALESCE(tm2.display_name, p2.display_name)
          FROM profiles p2
          LEFT JOIN team_members tm2 ON tm2.user_id = p2.id AND tm2.team_id = NEW.team_id
          WHERE p2.id = NEW.assignee_id)
      || '에게 배정했습니다'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_task_assigned
  AFTER UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_task_assigned();

-- ═══ 트리거 3: 할일 완료 알림 ═══
CREATE OR REPLACE FUNCTION notify_task_completed()
RETURNS trigger AS $$
BEGIN
  IF NEW.done = true AND OLD.done = false AND NEW.team_id IS NOT NULL THEN
    INSERT INTO notifications (team_id, actor_id, target_user_id, task_id, event_type, message)
    VALUES (
      NEW.team_id,
      auth.uid(),
      NEW.created_by,
      NEW.id,
      'completed',
      (SELECT COALESCE(tm.display_name, p.display_name)
       FROM profiles p
       LEFT JOIN team_members tm ON tm.user_id = p.id AND tm.team_id = NEW.team_id
       WHERE p.id = auth.uid())
      || '이(가) ''' || LEFT(NEW.text, 50) || '''을(를) 완료했습니다'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_task_completed
  AFTER UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_task_completed();

-- ═══ 트리거 4: 댓글 작성 알림 ═══
CREATE OR REPLACE FUNCTION notify_comment_created()
RETURNS trigger AS $$
DECLARE
  v_task RECORD;
BEGIN
  SELECT id, text, team_id, created_by, assignee_id
  INTO v_task FROM tasks WHERE id = NEW.task_id;

  IF v_task.team_id IS NOT NULL THEN
    INSERT INTO notifications (team_id, actor_id, target_user_id, task_id, event_type, message)
    VALUES (
      v_task.team_id,
      NEW.author_id,
      CASE
        WHEN v_task.assignee_id IS NOT NULL AND v_task.assignee_id != NEW.author_id
          THEN v_task.assignee_id
        WHEN v_task.created_by != NEW.author_id
          THEN v_task.created_by
        ELSE NULL
      END,
      NEW.task_id,
      'commented',
      (SELECT COALESCE(tm.display_name, p.display_name)
       FROM profiles p
       LEFT JOIN team_members tm ON tm.user_id = p.id AND tm.team_id = v_task.team_id
       WHERE p.id = NEW.author_id)
      || '이(가) ''' || LEFT(v_task.text, 50) || '''에 댓글을 남겼습니다'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_comment_created
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION notify_comment_created();
