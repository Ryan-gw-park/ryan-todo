# Agent 00: Director

> Orchestrator agent. When a Loop document is received, execute this protocol.
> Other agent files are read by the Director as needed. Claude Code only references this file directly.

---

## Execution Protocol

Work instructions must be written in English. Agent review reports are output in Korean.

### Phase 1: Scope Analysis

Read the Loop document and determine which agents are affected using this checklist:

| Condition | Agent |
|-----------|-------|
| SQL, migrations, table/column changes, DEFAULT values, indexes | `01-schema-guardian.md` |
| RLS policies, permission branching, isOwner/canEdit, scope changes | `02-permission-guard.md` |
| View addition/modification, store field changes, navigation changes | `03-view-consistency.md` |
| Card rendering, DnD, updateTask, inline editing, state transitions | `04-card-interaction.md` |
| Colors, styles, typography, mobile layout | `05-design-system.md` |
| Supabase queries, polling, optimistic updates, bundle, SW | `06-sync-performance.md` |

**Skip irrelevant agents.** Do not run all 6 every time.

### R-SPLIT: Work Instruction Size Gate

Before dispatching to agents, check work instruction line count.

- ≤ 100 lines: execute as single Loop
- 101–200 lines: WARN — recommend split, proceed if Ryan approves
- > 200 lines: BLOCK — must split into Sub-Loops (≤ 100 lines each)

Sub-Loop rules:
- Numbered Loop-XX.1, .2, .3, ...
- Each has own scope, checklist, commit
- Each independently verifiable (build + check)
- Earlier Sub-Loops committed before starting next
- Director reports split plan and awaits Ryan approval

### Phase 2: Agent Dispatch

Read each relevant agent's `.md` file and compare every phase/item in the Loop document against that agent's **BLOCK rules**.

Issue a verdict per agent:

- **PASS**: No rule violations found
- **WARN**: Caution needed but can proceed. Specify details
- **BLOCK**: Rule violation found. Cannot proceed without fix. Specify violation and fix direction
- **SKIP**: Not relevant to this Loop

### Phase 3: Synthesize Verdict

Collect all agent verdicts and issue the final judgment:

**CLEAR** — All agents PASS or SKIP. Proceed to implementation.

**REVISE LOOP** — One or more BLOCKs, resolvable by modifying the Loop document.
- Output specific fix instructions ("Remove border-left from Phase 3 milestone row styles").
- Ryan revises in Claude Web, then re-review.

**UPDATE RULES** — Loop document is fine, but agent rules don't cover a new situation.
- Propose which agent needs which new rule.
- After Ryan approves, patch the agent file and re-review.

### Phase 4: Output Report

Follow the format in `docs/agents/review-template.md`.

---

## Post-Implementation Lint (Agent Lint)

After implementation is complete, the Director runs a second pass:

```
1. Identify changed files (git diff --name-only or manual list)
2. Determine relevant agents based on changed files
3. Check changes against each agent's BLOCK rules
4. Violations found → output fix instructions (hotfix)
5. No violations → output "Agent Lint PASS"
```

### R-PRECOMMIT: Pre-Commit Verification Gate

After Agent Lint PASS, before git commit:

1. Extract all checklist items from work instruction
2. Verify each with grep, file read, or build
3. Report ✅/❌ per item
4. BLOCK commit if any ❌ — fix and re-verify first

If no checklist in work instruction, Director generates 3–5 items from 목표 section.

---

## Meta-Judgment Criteria

### Loop Document vs Agent Rules — Which to Fix

| Situation | Verdict | Reason |
|-----------|---------|--------|
| Loop doc violates existing rules | REVISE LOOP | Rules take priority |
| Agent rules don't cover the situation | UPDATE RULES | Rules need expansion |
| Agent rules conflict with actual code state | UPDATE RULES | Align rules to reality |
| Both Loop doc and rules are reasonable but conflict | Escalate to Ryan | Report "planning decision needed" |

### Known Divergence Utilization

Each agent has a **Known Divergences** section — a list of current rule violations in the codebase.

When a Loop touches a Known Divergence area, the Director proposes:

```
"This Loop modifies [filename].
Known divergence [KD-X.X] exists in this file.
Would you like to address it in this Loop? (scope expansion — Ryan approval needed)"
```

If Ryan says "not now", move on. If "yes", expand scope.
Never force. Only propose.

---

## Agent File Maintenance

1. Agent files are part of the codebase. Version-controlled in Git.
2. When a Loop completion affects agent rules, update the agent file in the same commit.
3. When a Known Divergence is resolved, remove it from the list.
4. Adding new BLOCK rules requires Ryan's approval.
5. Agent file changes do NOT require CLAUDE.md changes (CLAUDE.md only contains pointers).
