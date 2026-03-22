# Agent 02: Permission Guard

> Protects RBAC, RLS policies, scope rules, and owner/member permission boundaries.
> Baseline: 2026-03-18 (codebase diagnostic)

---

## BLOCK Rules

### B1. DB RLS must be a subset of frontend permissions

What the frontend blocks MUST also be blocked at the DB level. Security that relies solely on frontend `readOnly` is forbidden.

```
Principle: DB allowed scope ⊆ FE allowed scope
Violation example: DB allows all team members to UPDATE, but FE restricts to owner/creator/assignee only
→ Supabase client can be called directly via browser DevTools, bypassing FE
```

When a new feature modifies data, verify that the target table's RLS UPDATE/DELETE policies enforce the same restrictions as the frontend.

### B2. New tables MUST have RLS + policies

RLS enabled + zero policies = all access denied. Include at least one SELECT policy.

```sql
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "new_table_select" ON new_table FOR SELECT
  USING (user_id = auth.uid());
```

### B3. Scope-CRUD matrix compliance

| Operation | private | team | assigned |
|-----------|---------|------|----------|
| SELECT | created_by only | all team members | all team members |
| INSERT | self | owner/member | owner (assignment) |
| UPDATE | created_by only | owner/creator only (DB) | owner/creator/assignee only (DB) |
| DELETE | created_by only | owner/created_by only | owner/created_by only |

**Private tasks are invisible to team owners.** Any RLS policy that exposes private tasks to non-creators is a BLOCK.

### B4. isOwner branching required for owner-only features

When implementing owner-only features (project deletion, team settings, member role changes), the frontend component MUST include `isOwner` branching.

Current components with isOwner:
- `DetailPanel.jsx` — canEdit/canDelete
- `CommentSection.jsx` — delete others' comments
- `TeamMatrixView.jsx` — other members' rows readOnly
- `TeamSettings.jsx` — full team control

New components that modify team data must include canEdit/canDelete logic.

### B5. Validate task scope for comments/notifications

Comments and notifications reference tasks via `task_id`. Linking to a `private` task is a scope violation.

When creating comments/notifications: verify target task's scope is `'team'` or `'assigned'`.

### B6. Cross-scope transition on DnD

When a task crosses the team↔personal boundary via DnD (or any move operation), scope MUST be adjusted:

```
team/assigned → personal project: scope='private', teamId=null, assigneeId=null
private → team project (today/next): scope='assigned', assigneeId=userId
private → team project (backlog): scope='team', assigneeId=null
```

Missing scope transition = BLOCK (task becomes invisible in filters).
Established in Loop-35I.

### B7. Use RLS helper functions

When writing new RLS policies, use existing SECURITY DEFINER functions. Direct subqueries are forbidden.

```sql
-- Correct
USING (team_id IN (SELECT get_my_team_ids()))

-- Forbidden — no recursion protection, performance hit
USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
```

| Function | Returns | Purpose |
|----------|---------|---------|
| `get_my_team_ids()` | SETOF uuid | Team IDs where I'm an active member |
| `get_my_owner_team_ids()` | SETOF uuid | Team IDs where I'm an owner |
| `get_my_team_member_ids()` | SETOF uuid | User IDs of teammates |

### B8: Cross-Scope Transition Policy (Loop-35I/35K)

- Team task → personal project DnD: scope must change to 'private',
  team_id=NULL, assignee_id=NULL
- Personal task → team project DnD: scope must change to 'team' or 'assigned',
  team_id must match project's team_id
- DB trigger `validate_task_project_consistency` enforces this at DB level
- Frontend must also validate before calling updateTask to avoid trigger errors
- Personal project tasks cannot be assigned to other team members
  (frontend shows toast: "개인 프로젝트 할일은 본인에게만 배정 가능합니다")

---

## Known Divergences

| ID | Severity | Description |
|----|----------|-------------|
| KD-2.1 | **HIGH** | `team_tasks_member_assign` policy: permissive OR gives all team members full UPDATE on all columns. Relies on FE canEdit only. **부분 완화**: Loop-35K `validate_task_project_consistency` 트리거로 team/project 불일치는 DB 레벨에서 차단됨. 단, 같은 팀 내에서의 과도한 UPDATE 권한 문제는 여전히 존재 |
| KD-2.2 | MEDIUM | `projects_team_update` open to all members. Should restrict to owner/creator |
| KD-2.3 | MEDIUM | `comments_select` filters by team_id without scope check. May expose comments on private tasks |
| KD-2.4 | LOW | `team_invitations` missing DELETE policy. Frontend `delete()` silently denied by RLS |
| KD-2.5 | LOW | `notifications` missing DELETE policy. Relies on server-side purge |
| KD-2.6 | LOW | `ui_state` uses `USING(true)` — no team isolation |
| KD-2.7 | INFO | `companies` table: RLS enabled + zero policies = full deny (currently unused) |
| KD-2.8 | LOW | Weekly Planner cross-member DnD (Loop-36B) allows reassigning tasks to other team members by changing assigneeId. Intentional for team collaboration but follows same over-permissive pattern as KD-2.1 |
| KD-2.9 | LOW | Hierarchical milestone deletion (Loop-37) cascades to all descendants. No separate permission check for deleting child milestones — if user can delete parent, all children are deleted. Matches ON DELETE CASCADE behavior |

---

## Convergence Targets

| ID | Target | Work |
|----|--------|------|
| CT-2.1 | KD-2.1 | Convert `team_tasks_member_assign` to restrictive, or limit UPDATE columns to `assignee_id` only |
| CT-2.2 | KD-2.2 | Add `created_by = auth.uid() OR team_id IN (SELECT get_my_owner_team_ids())` to projects UPDATE |
| CT-2.3 | KD-2.3 | Add `tasks.scope != 'private'` join condition to comments SELECT |
| CT-2.4 | KD-2.4 | Add DELETE policy to `team_invitations` (owner only) |

---

## Verification Commands

```bash
# Find components modifying team data without permission checks
grep -rn "updateTask\|deleteTask\|addTask\|deleteProject" src/ --include="*.jsx" -l | \
  xargs grep -L "isOwner\|canEdit\|canDelete"

# Find RLS policies filtering by team_id without scope check
grep -n "team_id IN.*get_my_team_ids" supabase/migrations/*.sql | grep -v "scope"
```
