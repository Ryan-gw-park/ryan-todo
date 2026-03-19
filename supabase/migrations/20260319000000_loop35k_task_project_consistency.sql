-- Loop-35K: Task-Project team_id consistency trigger
-- Prevents tasks from having a team_id that doesn't match their project's team_id
-- Also prevents team-scoped tasks from being linked to personal projects and vice versa

CREATE OR REPLACE FUNCTION validate_task_project_consistency()
RETURNS trigger AS $$
DECLARE
  v_project_team_id uuid;
BEGIN
  -- Skip if no project_id (orphan tasks allowed)
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Look up the project's team_id
  SELECT team_id INTO v_project_team_id
  FROM projects
  WHERE id = NEW.project_id;

  -- Project not found — allow (app-level reference, no FK)
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Rule 1: Personal project (team_id NULL) → task must be private
  IF v_project_team_id IS NULL AND NEW.scope != 'private' THEN
    RAISE EXCEPTION 'Task scope must be ''private'' for personal project (project_id: %)', NEW.project_id;
  END IF;

  -- Rule 2: Team project → task must be team or assigned, and team_id must match
  IF v_project_team_id IS NOT NULL THEN
    IF NEW.scope = 'private' THEN
      RAISE EXCEPTION 'Task scope cannot be ''private'' for team project (project_id: %)', NEW.project_id;
    END IF;
    IF NEW.team_id != v_project_team_id THEN
      RAISE EXCEPTION 'Task team_id (%) does not match project team_id (%) for project %',
        NEW.team_id, v_project_team_id, NEW.project_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to tasks table (INSERT and UPDATE)
DROP TRIGGER IF EXISTS validate_task_project_consistency ON tasks;
CREATE TRIGGER validate_task_project_consistency
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION validate_task_project_consistency();
