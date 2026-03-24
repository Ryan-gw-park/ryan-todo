# Loop-35K: Task-Project team_id 정합성 트리거 추가

> **분류**: Schema + Permission hardening
> **선행 조건**: Loop-35I, 35J 완료 + 꼬인 데이터 4건 복구 완료
> **Agent 리뷰 필수**
> **Convergence Target**: Permission Guard KD-2.1 관련, 신규 CT 추가

---

## 배경

Loop-35I에서 TeamMatrixView의 DnD else 분기를 추가하여 프론트엔드에서는 차단했지만,
DB 레벨에서는 여전히 아래 모순 상태가 INSERT/UPDATE 가능하다:

```
task.scope = 'assigned' + task.team_id = '팀A'
task.project_id = 'p5'  (개인 프로젝트, projects.team_id = NULL)
```

기존 CHECK 제약(`valid_scope`)은 scope/team_id/assignee_id 조합만 검증하고,
**프로젝트의 team_id와 할일의 team_id 일치 여부는 검증하지 않는다.**

이 트리거는 DB 레벨에서 모순을 원천 차단하는 마지막 방어선이다.

---

## 구현

### 새 마이그레이션 파일 생성

```bash
# 기존 패턴에 맞춰 타임스탬프 파일 생성
# supabase/migrations/ 내 최신 파일의 타임스탬프 확인 후 그 이후로
ls supabase/migrations/ | tail -3
```

### SQL 내용

```sql
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
```

---

## 트리거 규칙 요약

| 프로젝트 유형 | 허용되는 task scope | task.team_id |
|-------------|-------------------|-------------|
| 개인 (`projects.team_id = NULL`) | `private`만 | NULL |
| 팀 (`projects.team_id = uuid`) | `team` 또는 `assigned` | 프로젝트와 동일 team_id |
| project_id 없음 | 제한 없음 | 제한 없음 |
| project_id가 존재하지 않는 프로젝트 참조 | 제한 없음 | 제한 없음 (FK 없으니까) |

---

## 적용 전 검증

트리거를 생성하기 **전에**, 현재 DB에 트리거 규칙을 위반하는 데이터가 없는지 확인한다.
(Loop-35I에서 4건 복구했으므로 없어야 정상)

```sql
-- 위반 데이터 사전 검사
SELECT t.id, t.text, t.scope, t.team_id, t.project_id,
       p.team_id as proj_team_id,
       CASE
         WHEN p.team_id IS NULL AND t.scope != 'private'
           THEN 'personal project but not private scope'
         WHEN p.team_id IS NOT NULL AND t.scope = 'private'
           THEN 'team project but private scope'
         WHEN p.team_id IS NOT NULL AND t.team_id != p.team_id
           THEN 'team_id mismatch'
         ELSE 'OK'
       END as violation
FROM tasks t
JOIN projects p ON t.project_id = p.id
WHERE t.deleted_at IS NULL
  AND NOT (
    (p.team_id IS NULL AND t.scope = 'private') OR
    (p.team_id IS NOT NULL AND t.scope IN ('team', 'assigned') AND t.team_id = p.team_id) OR
    (t.project_id IS NULL)
  );
```

**결과가 0건이어야 트리거 생성 가능.** 위반 데이터가 있으면 먼저 복구한다.

---

## 적용 후 검증

```sql
-- 트리거가 정상 작동하는지 테스트 (실패해야 정상)

-- Test 1: 개인 프로젝트에 team scope 할일 → 실패해야 함
-- (실제 실행하지 마라 — 아래는 검증 개념만)
-- INSERT INTO tasks (id, text, project_id, scope, team_id)
-- VALUES ('test1', 'test', 'p5', 'team', '955e8993-...');
-- → RAISE EXCEPTION 예상

-- Test 2: 정상 케이스 — 개인 프로젝트에 private scope → 성공해야 함
-- INSERT INTO tasks (id, text, project_id, scope)
-- VALUES ('test2', 'test', 'p5', 'private');
-- → 성공 예상

-- 트리거 존재 확인
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'tasks'
  AND trigger_name = 'validate_task_project_consistency';
```

---

## 프론트엔드 에러 핸들링

트리거가 `RAISE EXCEPTION`을 던지면 Supabase 클라이언트에서 에러로 받는다.
현재 `safeUpsertTask`에서 에러를 `console.error`로만 처리하고 있으므로,
사용자에게는 "할일이 저장되지 않음" 상태가 된다.

**이번 Loop에서는 트리거만 추가하고, 프론트엔드 에러 표시는 별도 Loop에서 다룬다.**
트리거가 발동하는 케이스 자체가 코드 버그이므로(정상 동작에서는 발동 안 함),
console.error로 개발 중 감지하는 것만으로 충분하다.

---

## Agent 규칙 업데이트

이 트리거가 추가되면 아래 Agent 문서를 업데이트해야 한다:

### 01-schema-guardian.md — B7 CHECK 제약 섹션에 추가

```
### Trigger: validate_task_project_consistency
- Personal project (projects.team_id = NULL) → task.scope must be 'private'
- Team project (projects.team_id = uuid) → task.scope must be 'team' or 'assigned',
  and task.team_id must match projects.team_id
- Violation raises EXCEPTION (Supabase returns error to client)
```

### 02-permission-guard.md — Known Divergence KD-2.1에 주석 추가

```
KD-2.1 부분 완화: validate_task_project_consistency 트리거로
team/project 불일치는 DB 레벨에서 차단됨.
단, 같은 팀 내에서의 과도한 UPDATE 권한 문제는 여전히 존재.
```

---

## 검증 체크리스트

- [ ] 위반 데이터 사전 검사 결과 0건
- [ ] 마이그레이션 파일 생성 (기존 파일 수정 아님)
- [ ] 트리거 생성 성공
- [ ] 매트릭스 뷰 DnD 개인→개인 이동 정상 (private→private)
- [ ] 매트릭스 뷰 DnD 팀→팀 이동 정상 (team/assigned 유지)
- [ ] 매트릭스 뷰 DnD 팀→개인 이동 정상 (scope→private 자동 전환 by 35I 코드)
- [ ] 오늘 할일 뷰 할일 추가/편집 정상
- [ ] 프로젝트 뷰 할일 추가 정상
- [ ] 기존 할일 편집(updateTask) 정상 — 트리거가 불필요하게 차단하지 않는지
- [ ] `npm run build` 성공

---

## 주의사항

1. **기존 마이그레이션 파일 수정 금지.** 새 파일로 생성.
2. **위반 데이터가 있으면 트리거 생성 전에 먼저 복구.** 트리거가 있는 상태에서 기존 데이터는 UPDATE 시점에 걸린다.
3. **project_id가 NULL인 할일은 트리거 스킵.** 프로젝트 미연결 할일은 허용.
4. **project_id가 존재하지 않는 프로젝트를 참조하는 경우도 스킵.** 앱 레벨 참조이므로 FK 없음.
5. **프론트엔드 코드 수정 없음.** 이 Loop은 SQL 마이그레이션 + Agent 문서 업데이트만.

---

## 작업 내역

(작업 완료 후 기록)
