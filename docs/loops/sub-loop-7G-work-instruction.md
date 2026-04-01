# Sub-Loop 7G — 데드 코드 정리 (A~F 누락분)

> 커밋 F 적용 후 진행
> 검증 결과 발견된 누락 6건 일괄 정리

---

## 검증 결과 요약

| # | 파일 | 누락 항목 | 원인 |
|---|------|-----------|------|
| 1 | TeamMatrixView | `CompactMsRow` import | 커밋A에서 사용처 삭제했으나 import 누락 |
| 2 | TeamMatrixView | `{ getMsPath, getVisibleMs }` import | 이 파일에서 원래 미사용 (import만 존재) |
| 3 | TeamMatrixView | `doneCollapsed` 변수 | 커밋A에서 CompletedRow 삭제했으나 변수 누락 |
| 4 | PersonalMatrixView | `CATEGORIES` import | 원래 미사용 |
| 5 | PersonalMatrixView | `useCallback` import | 원래 미사용 |
| 6 | TeamMatrixView | `members` 초기값 `[]` → 빈 그리드 깜빡임 | 커밋B에서 members를 그리드 열로 사용하면서 발생 |

---

## G-1. TeamMatrixView — 데드 import 삭제

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
import CompactMsRow from '../common/CompactMsRow'
import MsBacklogSidebar from '../common/MsBacklogSidebar'
import { getMsPath, getVisibleMs } from '../../utils/milestoneTree'
new_str:
import MsBacklogSidebar from '../common/MsBacklogSidebar'
```

## G-2. TeamMatrixView — doneCollapsed 삭제

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
  const collapsed = collapseState.matrix || {}
  const doneCollapsed = collapseState.matrixDone || {}
  const toggleCollapse = (pid) => storeToggle('matrix', pid)
new_str:
  const collapsed = collapseState.matrix || {}
  const toggleCollapse = (pid) => storeToggle('matrix', pid)
```

## G-3. PersonalMatrixView — 데드 import 삭제

```
str_replace
path: src/components/views/PersonalMatrixView.jsx
old_str:
import { useState, useMemo, useEffect, useCallback } from 'react'
new_str:
import { useState, useMemo, useEffect } from 'react'
```

```
str_replace
path: src/components/views/PersonalMatrixView.jsx
old_str:
import { getColor, CATEGORIES } from '../../utils/colors'
new_str:
import { getColor } from '../../utils/colors'
```

## G-4. TeamMatrixView — members 빈 배열 가드

커밋 B에서 `members`가 그리드 열을 정의하는데, 초기값이 `[]`라서 useEffect 완료 전까지 빈 그리드가 깜빡입니다.

기존 `currentTeamId` 가드 뒤에 members 가드를 추가:

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
  // teamId 로딩 전 guard — 모든 hooks 이후에 위치 (Rules of Hooks 준수)
  if (!currentTeamId) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>
        팀을 선택하세요. 사이드바에서 팀을 전환할 수 있습니다.
      </div>
    )
  }
new_str:
  // teamId 로딩 전 guard — 모든 hooks 이후에 위치 (Rules of Hooks 준수)
  if (!currentTeamId) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>
        팀을 선택하세요. 사이드바에서 팀을 전환할 수 있습니다.
      </div>
    )
  }

  // members 로딩 전 guard — 그리드 열이 0개면 빈 화면 방지
  if (members.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>
        팀원 정보를 불러오는 중...
      </div>
    )
  }
```

---

## 커밋 실행

```bash
npm run build
git add -A
git commit -m "Sub-Loop 7G: 데드 코드 정리 — CompactMsRow/milestoneTree/doneCollapsed/CATEGORIES/useCallback import 삭제 + members 로딩 가드"
git push origin main
```

---

## 최종 검증 체크리스트

- [ ] `npm run build` 에러 없음
- [ ] `npm run build` warning 중 unused import 없음
- [ ] 팀 매트릭스: 팀원 로딩 전 "불러오는 중..." 표시
- [ ] 팀 매트릭스: 팀원 로딩 후 정상 그리드 표시
- [ ] 개인 매트릭스: 기존 동작 동일
