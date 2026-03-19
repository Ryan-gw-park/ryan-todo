# RLS 감사 보고서

**점검일:** 2026-03-12
**점검 범위:** public 스키마 전체 13개 테이블
**기준 문서:** ryan-todo-team-architecture.md v2.1, 섹션 4-2 권한 매트릭스 + 섹션 9 RLS

---

## 1. RLS 활성화 상태

| 테이블 | RLS 활성화 | 활성화 시점 |
|--------|:---------:|------------|
| tasks | ✅ | Loop-17 |
| projects | ✅ | Loop-17 |
| memos | ✅ | Loop-17 |
| profiles | ✅ | Loop-17 |
| companies | ✅ | Loop-17 |
| teams | ✅ | Loop-17 |
| team_members | ✅ | Loop-17 |
| team_invitations | ✅ | Loop-17 |
| comments | ✅ | Loop-17 |
| notifications | ✅ | Loop-17 |
| matrix_row_config | ✅ | Loop-17 |
| ui_state | ✅ | Loop-16 |
| push_subscriptions | ✅ | Loop-15 |

**결과:** 모든 public 테이블에 RLS 활성화 확인 ✅

---

## 2. 정책 목록 (최종 상태)

> 최종 적용 마이그레이션: `20260312000002_loop17_hotfix_recursion.sql`
> SECURITY DEFINER 헬퍼: `get_my_team_ids()`, `get_my_owner_team_ids()`, `get_my_team_member_ids()`

### tasks (8개 정책)

| 정책명 | cmd | USING / WITH CHECK |
|--------|-----|-------------------|
| private_tasks_select | SELECT | `scope='private' AND created_by=auth.uid()` |
| private_tasks_insert | INSERT | `scope='private' AND (created_by=auth.uid() OR created_by IS NULL)` |
| private_tasks_update | UPDATE | `scope='private' AND created_by=auth.uid()` |
| private_tasks_delete | DELETE | `scope='private' AND created_by=auth.uid()` |
| team_tasks_select | SELECT | `scope IN ('team','assigned') AND team_id IN (get_my_team_ids())` |
| team_tasks_insert | INSERT | `scope IN ('team','assigned') AND team_id IN (get_my_team_ids())` |
| team_tasks_update | UPDATE | `scope IN ('team','assigned') AND (owner_team OR created_by=me OR assignee_id=me)` |
| team_tasks_delete | DELETE | `scope IN ('team','assigned') AND (owner_team OR created_by=me)` |

**권한 매트릭스 대조:**
- ✅ 팀장 전체 수정/삭제
- ✅ 팀원 본인 생성분 수정/삭제
- ✅ 배정된 팀원 본인 배정분 수정
- ✅ 팀원 배정분 삭제 불가 (created_by만 허용)
- ✅ 개인 할일 본인만 CRUD

### projects (8개 정책)

| 정책명 | cmd | USING / WITH CHECK |
|--------|-----|-------------------|
| projects_private_select | SELECT | `team_id IS NULL AND user_id=auth.uid()` |
| projects_private_insert | INSERT | `team_id IS NULL AND (user_id=auth.uid() OR user_id IS NULL)` |
| projects_private_update | UPDATE | `team_id IS NULL AND user_id=auth.uid()` |
| projects_private_delete | DELETE | `team_id IS NULL AND user_id=auth.uid()` |
| projects_team_select | SELECT | `team_id IN (get_my_team_ids())` |
| projects_team_insert | INSERT | `team_id IN (get_my_team_ids())` |
| projects_team_update | UPDATE | `team_id IN (get_my_team_ids())` |
| projects_team_delete | DELETE | `team_id IN (get_my_owner_team_ids())` |

**권한 매트릭스 대조:**
- ✅ 팀 프로젝트 조회: 같은 팀 소속
- ✅ 팀 프로젝트 생성: 팀원 누구나
- ✅ 팀 프로젝트 수정: 팀원 누구나
- ✅ 팀 프로젝트 삭제: 팀장만
- ✅ 개인 프로젝트 본인만 CRUD

### memos (4개 정책)

| 정책명 | cmd | USING / WITH CHECK |
|--------|-----|-------------------|
| memos_select | SELECT | `user_id=auth.uid()` |
| memos_insert | INSERT | `user_id=auth.uid() OR user_id IS NULL` |
| memos_update | UPDATE | `user_id=auth.uid()` |
| memos_delete | DELETE | `user_id=auth.uid()` |

✅ 본인만 CRUD

### comments (4개 정책)

| 정책명 | cmd | USING / WITH CHECK |
|--------|-----|-------------------|
| comments_select | SELECT | `task_id의 team_id IN (get_my_team_ids())` |
| comments_insert | INSERT | `author_id=auth.uid()` |
| comments_update | UPDATE | `author_id=auth.uid()` |
| comments_delete | DELETE | `author_id=me OR 팀장(task의 team_id IN get_my_owner_team_ids())` |

**권한 매트릭스 대조:**
- ✅ 팀 소속이면 댓글 조회
- ✅ 본인 댓글만 수정
- ✅ 본인 댓글 + 팀장 모든 댓글 삭제

### notifications (3개 정책 — 감사 보완 포함)

| 정책명 | cmd | USING / WITH CHECK |
|--------|-----|-------------------|
| notifications_select | SELECT | `owner_team OR target_user_id=me OR actor_id=me` |
| notifications_insert | INSERT | `actor_id=auth.uid()` ← **보완 추가** |
| notifications_update_own | UPDATE | `target_user_id=auth.uid()` ← **보완 추가** |

### profiles (2개 정책)

| 정책명 | cmd | USING / WITH CHECK |
|--------|-----|-------------------|
| profiles_owner | ALL | `id=auth.uid()` |
| profiles_team_select | SELECT | `id IN (get_my_team_member_ids())` |

✅ 본인 전체 CRUD + 같은 팀 소속 조회

### teams (4개 정책)

| 정책명 | cmd | USING / WITH CHECK |
|--------|-----|-------------------|
| teams_select_member | SELECT | `id IN (get_my_team_ids())` |
| teams_insert | INSERT | `created_by=auth.uid()` |
| teams_update_owner | UPDATE | `id IN (get_my_owner_team_ids())` |
| teams_delete_owner | DELETE | `id IN (get_my_owner_team_ids())` |

✅ 소속 팀 조회, 팀장만 수정/삭제

### team_members (4개 정책)

| 정책명 | cmd | USING / WITH CHECK |
|--------|-----|-------------------|
| team_members_select | SELECT | `team_id IN (get_my_team_ids())` |
| team_members_insert | INSERT | `owner_team OR user_id=me` |
| team_members_update | UPDATE | `owner_team OR user_id=me` |
| team_members_delete | DELETE | `owner_team OR user_id=me` |

✅ 같은 팀 조회, 팀장 관리, 본인 가입/수정/탈퇴

### team_invitations (3개 정책)

| 정책명 | cmd | USING / WITH CHECK |
|--------|-----|-------------------|
| team_invitations_select | SELECT | `owner_team OR invited_email=me` |
| team_invitations_insert | INSERT | `invited_by=me AND owner_team` |
| team_invitations_update | UPDATE | `owner_team OR invited_email=me` |

✅ 팀장 생성, 팀장+초대받은 본인 조회/수정

### matrix_row_config (1개 정책)

| 정책명 | cmd | USING / WITH CHECK |
|--------|-----|-------------------|
| matrix_row_config_owner | ALL | `user_id=auth.uid()` |

✅ 본인 설정만 CRUD

### ui_state (4개 정책 — DELETE 보완 포함)

| 정책명 | cmd | 조건 |
|--------|-----|------|
| Authenticated users can read ui_state | SELECT | `TO authenticated USING(true)` |
| Authenticated users can insert ui_state | INSERT | `TO authenticated WITH CHECK(true)` |
| Authenticated users can update ui_state | UPDATE | `TO authenticated USING(true)` |
| Authenticated users can delete ui_state | DELETE | `TO authenticated USING(true)` ← **보완 추가** |

### push_subscriptions (4개 정책 — 보완 교체)

| 정책명 | cmd | USING / WITH CHECK |
|--------|-----|-------------------|
| ~~allow_all~~ → push_sub_select_own | SELECT | `user_id::uuid=auth.uid()` ← **보완 교체** |
| push_sub_insert_own | INSERT | `user_id::uuid=auth.uid()` ← **보완 추가** |
| push_sub_update_own | UPDATE | `user_id::uuid=auth.uid()` ← **보완 추가** |
| push_sub_delete_own | DELETE | `user_id::uuid=auth.uid()` ← **보완 추가** |

### companies (0개 정책)

RLS 활성화 + 정책 없음 = deny-all (의도적, UI 미구현)

---

## 3. 감사 보완 내역

| # | 테이블 | 변경 | 사유 |
|---|--------|------|------|
| 1 | push_subscriptions | `allow_all` → 본인 user_id 기반 4개 정책 | **보안 위험**: anon 포함 전체 접근 허용 상태였음 |
| 2 | ui_state | DELETE 정책 추가 | 일관성 (SELECT/INSERT/UPDATE만 있었음) |
| 3 | notifications | INSERT + UPDATE 정책 추가 | 클라이언트 알림 생성 및 읽음 처리 지원 |

**마이그레이션 파일:** `supabase/migrations/20260312100000_rls_audit_fix.sql`

---

## 4. 하위 호환 검증

| 검증 항목 | 상태 |
|-----------|------|
| 기존 tasks CRUD (scope='private', created_by 매핑) | ✅ hotfix_compat 트리거가 created_by 자동 채움 |
| 기존 projects CRUD (team_id=NULL, user_id 매핑) | ✅ hotfix_compat 트리거가 user_id 자동 채움 |
| 기존 memos CRUD (user_id 매핑) | ✅ hotfix_compat 트리거가 user_id 자동 채움 |
| INSERT 시 NULL 필드 허용 (created_by, user_id) | ✅ INSERT 정책에 OR IS NULL 조건 |
| ui_state 전체 접근 (authenticated) | ✅ 변경 없음 |
| push_subscriptions 본인만 | ⚠️ 기존 allow_all에서 제한됨 — 기존 데이터의 user_id가 올바르게 설정되어 있어야 함 |

---

## 5. 결론

Loop-17에서 생성한 RLS 정책은 **핵심 비즈니스 로직(tasks, projects, teams, members)에 대해 완전**하다.

보완 3건은 모두 **기존 정책의 누락/과도 허용 보정**이며, 핵심 기능에 대한 회귀 위험은 없다. `push_subscriptions`의 `allow_all → user_id 기반` 전환 시 기존 구독 데이터의 `user_id` 필드가 정확한지 확인 필요.
