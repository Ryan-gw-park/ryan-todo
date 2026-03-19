# Agent 05: Design System

> Protects colors, typography, banned visual patterns, and mobile responsiveness.
> Baseline: 2026-03-18 (codebase diagnostic)

---

## BLOCK Rules

### B1. Banned colors

```
#c4c2ba — too faint. Banned.
#d3d1c7 — too faint. Banned.
Minimum secondary text color: #888780 (nothing fainter for auxiliary text)
```

### B2. No left color borders

```css
/* ABSOLUTELY FORBIDDEN — on project, task, or milestone cards anywhere */
border-left: 3px solid #color;
borderLeft: '3px solid ...'
```

For visual differentiation, use top dots, background tints, or header background colors instead.

### B3. Project colors from single source only

Project color definitions exist in `src/utils/colors.js` and nowhere else. Never hardcode color values or copy them into components.

```js
// Correct
import { PROJECT_COLORS } from '../utils/colors'

// Forbidden — duplicate definition inside component
const colors = { yellow: { card: '#fef9ec', ... } }
```

Same rule applies to highlight colors. Single source, import everywhere.

### B4. Inline style convention

This project intentionally uses inline styles (0 CSS variables, className only for hover/media queries). Follow this convention:

- **New components**: use inline `style={{}}`
- **hover/focus/media queries**: create a new CSS file (never modify existing `global.css`)
- **Repeated style objects**: extract to constants for sharing (tech debt but currently tolerated)

### B5. Typography

```
Font: 'Noto Sans KR', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif
Primary text: #37352f (Notion style)
```

`#2C2C2A` is also present (Known Divergence), but new code MUST use `#37352f`.

### B6. Mobile breakpoint

```js
const isMobile = window.innerWidth < 768  // 768px — consistent everywhere
```

Using a different breakpoint value in new components = BLOCK.

### B7. Mobile touch targets

Touchable elements (buttons, checkboxes, tabs) must be minimum **44px × 44px**.
Apply iOS 16px font-size (zoom prevention) and `env(safe-area-inset-bottom)`.

---

## Known Divergences

| ID | Severity | Description |
|----|----------|-------------|
| KD-5.1 | MEDIUM | HIGHLIGHT_COLORS defined in 4 files with structural inconsistency (3 objects, 1 array) |
| KD-5.2 | LOW | Primary text color mixed: `#37352f` vs `#2C2C2A` (162 occurrences / 59 files) |
| KD-5.3 | LOW | Grey scale hardcoded without tokens (#888, #999, #aaa, etc. — 247 occurrences / 54 files) |
| KD-5.4 | MEDIUM | `isMobile` is a render-time snapshot (16+ components don't subscribe to resize/orientation) |
| KD-5.5 | LOW | TouchSensor delay inconsistency (TeamMatrixView 120ms vs rest 200ms) — overlaps Agent 04 |
| KD-5.6 | LOW | HelpPage contains `borderLeft: '3px solid #f0c36d'` — banned pattern |
| KD-5.7 | INFO | Identical style objects repeated across many files (modal backdrop, button defaults, etc.) |

---

## Convergence Targets

| ID | Target | Work |
|----|--------|------|
| CT-5.1 | KD-5.1 | Consolidate HIGHLIGHT_COLORS into `src/utils/colors.js`, convert 4 files to imports |
| CT-5.2 | KD-5.2 | Extract text colors to constants (`TEXT_PRIMARY`, `TEXT_SECONDARY`, etc.) |
| CT-5.3 | KD-5.3 | Tokenize major grey scale values (batch cleanup Loop) |
| CT-5.4 | KD-5.4 | Create `useIsMobile()` hook with resize/orientationchange subscription |
| CT-5.5 | KD-5.6 | Remove border-left from HelpPage |

---

## Project Color Map Reference

`src/utils/colors.js` defines 8 colors, each with 4 semantic values:

| Role | Description |
|------|-------------|
| card | Card background (light pastel) |
| header | Header background (one shade darker than card) |
| text | Text color (dark tone of that color) |
| dot | Project identification dot (darkest tone) |

---

## Verification Commands

```bash
# Detect banned colors
grep -rn "#c4c2ba\|#d3d1c7" src/ --include="*.jsx" --include="*.js" --include="*.css" -n

# Detect border-left color borders
grep -rn "borderLeft.*solid\|border-left.*solid" src/ --include="*.jsx" --include="*.js" --include="*.css" -n

# Detect HIGHLIGHT_COLORS duplication
grep -rn "HIGHLIGHT_COLORS\|highlightColors\|highlight_colors" src/ --include="*.jsx" --include="*.js" -l

# Detect hardcoded project colors outside utils/colors.js
grep -rn "fef9ec\|fdf2f0\|f0faf5\|eff6ff\|f5f3ff" src/ --include="*.jsx" | grep -v "utils/colors"
```
