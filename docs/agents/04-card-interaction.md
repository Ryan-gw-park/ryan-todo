# Agent 04: Card + Interaction

> Protects universal card patterns, DnD, state transitions, inline editing, and click/drag separation.
> Baseline: 2026-03-18 (codebase diagnostic)

---

## BLOCK Rules

### B1. updateTask signature is sacred

```js
// Correct
updateTask(id, { done: true, category: 'today' })

// ABSOLUTELY FORBIDDEN
updateTask({ ...task, done: true })
updateTask(task)
```

Pipeline: `updateTask(id, patch)` → `applyTransitionRules(currentTask, patch)` → optimistic merge → `safeUpsertTask`. Direct DB calls that bypass this pipeline are also forbidden.

### B2. All state changes MUST go through applyTransitionRules

When modifying task state (done, category, scope, etc.), `applyTransitionRules` MUST be invoked. This pure function applies 7 business rules (R1–R7) to expand the patch.

```
Location: useStore.js (top, ~line 25)
Call path: updateTask → applyTransitionRules → expanded patch → DB
```

Calling `supabase.from('tasks').update(...)` directly to change state skips business rules.

### B3. New DndContext must use standard sensor config

When adding a new DndContext, use this standard configuration:

```
PointerSensor:  activationConstraint: { distance: 3 }
TouchSensor:    activationConstraint: { delay: 200, tolerance: 5 }
KeyboardSensor: coordinateGetter: sortableKeyboardCoordinates
```

Deviation requires explicit justification in the work instruction.

### B4. Click vs drag separation mechanism

New components rendering draggable cards MUST implement the 5-layer separation:

1. **dnd-kit activationConstraint** — distance or delay for primary separation
2. **Zone stopPropagation** — StatusZone, TitleZone, DetailZone each block events
3. **Mobile drag listener removal** — `!isMobile ? listeners : undefined`
4. **isDragging visual feedback** — `opacity: 0.3` during drag
5. **Click → detail panel** — when not dragging, open DetailPanel

### B5. Inline editing pattern: blur saves

Follow the TitleZone implementation:

```
Click → show input → type → Enter (save + next row) or blur (save) or Escape (cancel)
onMouseDown: stopPropagation (DnD isolation)
parseDateFromText(text) → auto-extract startDate/dueDate
```

### B6. No nested DndContext

Never nest DndContext inside another DndContext. Using multiple SortableContexts within a single DndContext is allowed.

---

## Known Divergences

| ID | Severity | Description |
|----|----------|-------------|
| KD-4.1 | **MEDIUM** | 8 independent DndContexts across 6 files with no shared config factory — root cause of all inconsistencies |
| KD-4.2 | MEDIUM | Collision detection varies: rectIntersection / custom matrixCollision / closestCenter / pointerWithin |
| KD-4.3 | MEDIUM | TouchSensor delay varies: 0ms (not set) / 120ms / 200ms |
| KD-4.4 | MEDIUM | MilestoneOutlinerView and KeyMilestoneTab have no sensors configured (0px threshold) |
| KD-4.5 | LOW | PointerSensor distance varies: 3px / 5px |
| KD-4.6 | LOW | TitleZone onBlur always calls save() — unintended saves possible |
| KD-4.7 | LOW | MilestoneTaskChip has drag listeners + onClick simultaneously attached |
| KD-4.8 | INFO | TimelineGrid uses raw mousedown/up (no dnd-kit — separate paradigm) |

**Current 8 DndContext inventory:**

| File | Collision | Pointer dist | Touch delay |
|------|-----------|-------------|-------------|
| MatrixView | rectIntersection (default) | 3px | 200ms |
| TeamMatrixView | custom matrixCollision | 3px | 120ms |
| TodayView | closestCenter | 3px | 200ms |
| TimelineEngine | — | — | — |
| CompactTaskList | pointerWithin | 3px | 200ms |
| MilestoneOutlinerView ×2 | closestCenter | **not set** | **not set** |
| CompactMilestoneTab | pointerWithin | 3px | 200ms |

---

## Convergence Targets

| ID | Target | Work |
|----|--------|------|
| CT-4.1 | KD-4.1–4.5 | Create `createStandardSensors()` factory → migrate all 8 DndContexts |
| CT-4.2 | KD-4.4 | Add standard sensor config to MilestoneOutlinerView/KeyMilestoneTab |
| CT-4.3 | KD-4.2 | Unify collision detection to 2 strategies: list-type (closestCenter) and matrix-type (pointerWithin+fallback) |

---

## Verification Commands

```bash
# Detect updateTask signature violations
grep -rn "updateTask(" src/ --include="*.jsx" --include="*.js" | \
  grep -v "updateTask(id\|updateTask(taskId\|updateTask(item\.id\|function updateTask\|const updateTask"

# Count DndContexts
grep -rn "<DndContext" src/ --include="*.jsx" -c

# Find DndContexts without sensors prop
grep -rn "<DndContext" src/ --include="*.jsx" -B 5 | grep -v "sensors="

# Detect direct DB state changes bypassing applyTransitionRules
grep -rn "supabase.*from.*tasks.*update\|\.update({" src/ --include="*.js" --include="*.jsx" -n | \
  grep -v "safeUpsert\|useStore"
```
