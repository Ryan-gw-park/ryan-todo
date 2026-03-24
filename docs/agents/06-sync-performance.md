# Agent 06: Sync + Performance

> Protects polling synchronization, optimistic updates, bundle size, caching, and soft delete.
> Baseline: 2026-03-18 (codebase diagnostic)

---

## BLOCK Rules

### B1. No select('*') in new Supabase queries

```js
// Forbidden — transmits unnecessary columns (especially large text like notes)
const { data } = await supabase.from('tasks').select('*')

// Correct — explicit columns only
const { data } = await supabase.from('tasks').select('id, text, done, category, project_id, ...')
```

**Exception**: During early development when schema is unstable, `select('*')` is tolerated with a TODO comment marking the explicit-column conversion point.

### B2. Verify SYNC_TABLES when modifying shared data

When a new feature modifies data shared between team members, verify the target table is in `SYNC_TABLES`.

Current SYNC_TABLES: `['tasks', 'notifications']`

Changes to tables NOT in SYNC_TABLES are invisible to other team members until `loadAll()`. The work instruction must either note this limitation explicitly or include SYNC_TABLES expansion.

### B3. Optimistic update pattern

New data-modifying features MUST follow this 3-step pattern:

```
1. Apply to local state immediately (set())
2. Async DB call (safeUpsertTask / supabase.from().update())
3. Failure handling — at minimum console.error + rollback attempt
```

Missing step 3 = WARN (not BLOCK, since existing code also lacks rollback).

### B4. Polling target tables need updated_at index

When adding a new table to SYNC_TABLES, it MUST have all three:
1. `updated_at` column (`timestamptz DEFAULT now()`)
2. `set_updated_at` trigger
3. `idx_[table]_updated` index

Missing any one = BLOCK.

### B5. Soft delete WHERE condition

Team-mode task queries MUST include `deleted_at IS NULL`.
Currently only `tasks` uses soft delete. Other tables (projects, memos, comments) use hard delete.

```js
// Team-mode tasks query
.select('...').is('deleted_at', null)
```

### B6. Inactive tab optimization

Polling MUST stop when `document.visibilityState === 'hidden'` and resume on `visibilitychange` with `loadAll()` + polling restart. Code that bypasses this pattern is forbidden.

### B7. New dependencies must declare bundle impact

When adding a dependency to `package.json`:
- Work instruction must state bundle size impact ("~50KB gzipped")
- Prefer dynamic import (`React.lazy` or `import()`) where possible
- Review whether it should be added to `vite.config` manualChunks

### B8. loadAll Concurrency Guard (Loop-35J)

The _loadAllRunning flag in useStore.js MUST NOT be removed.
It prevents:
1. React StrictMode double-fire in dev mode
2. Tab visibility restoration racing with auth-flow loadAll
3. Optimistic updates being overwritten by concurrent loadAll

Pattern:
```
if (_loadAllRunning) return;
_loadAllRunning = true;
try { ... } finally { _loadAllRunning = false; }
```

### B9. milestones in loadAll (Loop-36A)

key_milestones data is loaded in the global loadAll Promise.all.
Query: select('id, title, color, status, sort_order, pkm_id, owner_id, start_date, due_date, parent_id, depth')
Do NOT load milestones in separate useEffect or custom hook for global views.
Project-specific hooks (useKeyMilestones etc.) may still exist for specialized queries
but the global store.milestones is the primary source for all views.

### B10. Inline Gantt — No Additional Queries (Loop-37)

UnifiedProjectView timeline mode renders gantt bars from store.milestones + store.tasks.
No additional Supabase queries for timeline data.
All date calculations (toX, computeGroupSpan) are pure frontend functions in
src/utils/ganttHelpers.js — no network calls.

### B11: Scope Filtering Performance (Loop-39)

Scope filtering runs on every render — use useMemo.

Team scope filter:
```js
const teamProjects = useMemo(() =>
  projects.filter(p => p.teamId), [projects]);
const teamTasks = useMemo(() =>
  tasks.filter(t => teamProjects.some(p => p.pkmId === t.projectId)),
  [tasks, teamProjects]);
```

Personal scope filter:
```js
const myTasks = useMemo(() =>
  tasks.filter(t => t.assigneeId === me || t.createdBy === me),
  [tasks, me]);
const myMs = useMemo(() =>
  milestones.filter(m => m.ownerId === me),
  [milestones, me]);
```

Performance thresholds:
- tasks < 200: useMemo optional
- tasks 200–500: useMemo recommended
- tasks > 500: useMemo required, consider virtualization

### B12: No Additional Queries on Scope Switch (Loop-39)

Switching between team and personal views MUST NOT trigger loadAll()
or any Supabase query. store.tasks and store.milestones already
contain all data for both scopes.

Scope switch = frontend filter change only.
Navigation: sidebar click → viewId change → component re-render with
different scope prop → useMemo recalculates filtered data.

Anti-pattern to BLOCK:
```js
useEffect(() => { loadAll(); }, [scope]); // WRONG — no re-fetch
```

---

## Known Divergences

| ID | Severity | Description |
|----|----------|-------------|
| KD-6.1 | MEDIUM | `comments` not in SYNC_TABLES. Types/merge logic ready but polling not wired |
| KD-6.2 | MEDIUM | `projects`/`memos` not polled. Team project changes invisible until tab reload |
| KD-6.3 | MEDIUM | Soft-deleted tasks have no purge mechanism. Rows accumulate indefinitely |
| KD-6.4 | LOW | 12 instances of `select('*')` including in polling |
| KD-6.5 | LOW | @dnd-kit 3 packages not in manualChunks |
| KD-6.6 | LOW | lastSync not persisted. Even brief tab switches trigger full reload |
| KD-6.7 | LOW | Optimistic update failure: no rollback, console.error only |
| KD-6.8 | LOW | `TASK_COLUMNS = '*'` — needs explicit column list after schema stabilization |
| KD-6.9 | LOW | WeeklyPlannerView (Loop-36B) filters tasks by dueDate for the selected week. Frontend-only filter on store.tasks. Performance concern if tasks grow very large (1000+) |
| KD-6.10 | LOW | ganttHelpers.js (Loop-37) contains pure utility functions (toX, getWeekDates, computeGroupSpan). Shared between UnifiedProjectView and potentially global TimelineView — convergence target for future cleanup |

---

## Convergence Targets

| ID | Target | Work |
|----|--------|------|
| CT-6.1 | KD-6.1 | Add `comments` to SYNC_TABLES + wire polling |
| CT-6.2 | KD-6.2 | Add `projects` to SYNC_TABLES (verify updated_at index first) |
| CT-6.3 | KD-6.3 | Supabase Edge Function or pg_cron to purge 30+ day soft-deleted records |
| CT-6.4 | KD-6.4 | Replace `TASK_COLUMNS = '*'` with explicit column list |
| CT-6.5 | KD-6.5 | Add dnd-kit to vite.config manualChunks |
| CT-6.6 | KD-6.7 | Add rollback utility for optimistic update failures (snapshot previous state) |

---

## Current Polling Architecture Reference

```
PollingSyncProvider
├── POLL_INTERVAL_MS = 10_000 (10 seconds)
├── SYNC_TABLES = ['tasks', 'notifications']
├── Activation: team mode only (personal mode blocked)
├── Delta sync: updated_at-based (notifications uses created_at)
├── Idempotency: id + updatedAt comparison
├── Inactive tab: stop on visibilitychange, resume with loadAll()
└── Error handling: console.error, retry next cycle
```

### loadAll Architecture (updated Loop-37)

loadAll now fetches in single Promise.all:
- tasks
- projects
- memos
- notifications
- milestones (key_milestones) — added Loop-36A
- userTaskSettings — integrated Loop-35J

Single set() call after all fetches complete — prevents multi-render flicker.

_loadAllRunning guard (Loop-35J): module-level boolean flag prevents concurrent
loadAll execution. Handles StrictMode double-fire and tab restoration race conditions.

---

## Verification Commands

```bash
# Count select('*') usage
grep -rn "\.select(\s*['\"]?\*['\"]?\s*)" src/ --include="*.js" --include="*.jsx" -n

# Check SYNC_TABLES value
grep -rn "SYNC_TABLES" src/ --include="*.js" --include="*.jsx" -A 2

# Find team-mode task queries missing deleted_at filter
grep -rn "from.*tasks.*select\|\.from.*tasks" src/ --include="*.js" --include="*.jsx" -A 5 | grep -v "deleted_at"

# Check current dependencies
cat package.json | grep -A 50 '"dependencies"'

# Check manualChunks config
grep -rn "manualChunks" vite.config.* -A 20
```
