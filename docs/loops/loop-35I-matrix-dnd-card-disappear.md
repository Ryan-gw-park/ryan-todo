# Loop-35I: 매트릭스 뷰 DnD 카테고리 이동 시 카드 소실 버그

> **분류**: Bugfix
> **선행 조건**: Loop-35H (핫픽스) 완료
> **심각도**: HIGH — 사용자가 할일을 이동하면 매트릭스 뷰에서 사라짐
> **Agent 리뷰 필수**: 이 Loop은 Agent 체계 최초 실전 적용 대상

---

## 현상

1. 매트릭스 뷰에서 "남은 할일" 영역의 할일 카드를 "오늘 할일" 영역으로 드래그앤드랍
2. **매트릭스 뷰에서 해당 카드가 사라짐** — "오늘 할일"에도, "남은 할일"에도 없음
3. 오늘 할일 뷰로 전환하면 해당 할일이 **정상 표시됨**
4. 매트릭스 뷰로 다시 돌아오면 여전히 카드가 보이지 않음 (새로고침 전까지)

## 원인 분석 방향

이 현상은 아래 시나리오 중 하나 (또는 조합)일 가능성이 높다:

**가설 A — 카테고리 변경은 정상이나 매트릭스 뷰의 필터/분류 로직이 변경된 category를 반영하지 못함.**
- store의 tasks 배열에서 해당 할일의 `category`가 `'today'`로 정상 변경됨
- 오늘 할일 뷰는 `category === 'today'`로 필터하므로 정상 표시
- 매트릭스 뷰는 카테고리별로 할일을 그룹핑하는 로직이 별도로 있을 수 있고, 이 로직이 변경을 놓침

**가설 B — DnD onDragEnd에서 category 변경 후 매트릭스 뷰의 로컬 상태가 갱신되지 않음.**
- MatrixView가 tasks를 내부 state로 복사해서 쓰고 있다면, store 변경이 반영 안 됨
- useStore 셀렉터가 아닌 getState()로 읽고 있다면 리렌더 안 됨 (Agent 03 B3 관련)

**가설 C — applyTransitionRules가 category를 예상과 다르게 변환.**
- 남은 할일(backlog) → 오늘 할일(today) 이동 시 R1~R7 규칙이 category를 다른 값으로 변환
- 예: done=true인 할일을 이동하면 category가 무시되거나, prev_category 관련 로직이 간섭

**가설 D — 팀/개인 모드 분기에서 데이터 경로가 다름.**
- 스크린샷에 "전체/팀/개인" 탭이 있으며 현재 "전체" 모드
- 전체 모드에서 DnD 시 TeamMatrixView vs MatrixView 중 어느 컴포넌트가 처리하는지에 따라 동작이 다를 수 있음

---

## 진단 Phase

코드를 수정하기 전에 아래 조사를 실행하고 결과를 보고하라.

### 진단 1: DnD onDragEnd에서 category 변경 확인

```bash
# MatrixView와 TeamMatrixView의 onDragEnd 핸들러 전체 확인
grep -rn "onDragEnd\|handleDragEnd" src/components/matrix/ src/components/views/MatrixView* --include="*.jsx" -A 30
```

조사 항목:
- [ ] onDragEnd에서 `updateTask(id, { category: newCategory })` 를 호출하는가?
- [ ] `applyTransitionRules`를 경유하는가? (updateTask 경유면 자동 경유)
- [ ] DnD 이후 로컬 state를 별도로 업데이트하는 코드가 있는가?

### 진단 2: 매트릭스 뷰의 tasks 데이터 소스

```bash
# MatrixView에서 tasks를 어떻게 읽는지 확인
grep -rn "useStore\|getState\|tasks" src/components/matrix/MatrixView.jsx --include="*.jsx" -n | head -20
grep -rn "useStore\|getState\|tasks" src/components/matrix/TeamMatrixView.jsx --include="*.jsx" -n | head -20
```

조사 항목:
- [ ] `useStore(s => s.tasks)`로 읽는가, `useStore.getState().tasks`로 읽는가?
- [ ] 내부에서 tasks를 useState로 복사하는 코드가 있는가?
- [ ] 카테고리별 그룹핑은 어디서 이루어지는가? (컴포넌트 내부 vs 유틸 함수)

### 진단 3: 전체/팀/개인 탭과 뷰 컴포넌트 매핑

```bash
# "전체" 탭에서 실제로 렌더되는 컴포넌트 확인
grep -rn "전체\|전체.*탭\|filter.*all\|viewMode\|matrixMode" src/components/matrix/ --include="*.jsx" -n | head -20
```

조사 항목:
- [ ] "전체" 모드에서 MatrixView와 TeamMatrixView 중 어느 것이 렌더되는가?
- [ ] "전체" 모드에서 DnD가 MatrixView의 onDragEnd를 타는가, TeamMatrixView의 것을 타는가?

### 진단 4: applyTransitionRules 규칙 중 backlog→today 관련

```bash
# applyTransitionRules 전체 내용 확인
grep -rn "applyTransitionRules" src/ --include="*.js" -A 40
```

조사 항목:
- [ ] backlog → today 이동 시 적용되는 규칙은 무엇인가?
- [ ] prev_category가 어떻게 설정되는가?
- [ ] done=false인 할일의 카테고리 변경에 간섭하는 규칙이 있는가?

### 진단 5: console.log 삽입으로 실시간 확인

```js
// MatrixView (또는 TeamMatrixView)의 onDragEnd 핸들러 시작 부분에 추가
console.log('[DnD] dragEnd:', { activeId, overCategory, currentTask });

// updateTask 함수 내부에 추가
console.log('[updateTask] id:', id, 'patch:', patch, 'afterRules:', expandedPatch);

// MatrixView의 카테고리 그룹핑 로직에 추가
console.log('[Matrix] tasks by category:', { today: todayTasks.length, backlog: backlogTasks.length });
```

**진단 결과를 보고한 후, 수정 코드를 작성하라.**

---

## 수정 Phase

진단 결과에 따라 적절한 수정을 적용한다.

### 수정 원칙

1. **updateTask(id, patch) 시그니처 엄수** — DnD에서도 반드시 이 경로를 탄다
2. **applyTransitionRules 경유 필수** — category 변경은 반드시 transition rules를 거친다
3. **getState() 직접 호출 금지** — 발견되면 useStore 셀렉터로 전환
4. **최소 수정** — 이 버그 수정 범위를 넘어서는 리팩토링 금지

---

## 검증 체크리스트

### 핵심 검증 (반드시 통과)
- [ ] 매트릭스 뷰: 남은 할일 → 오늘 할일 DnD 이동 후 "오늘 할일" 영역에 카드 표시됨
- [ ] 매트릭스 뷰: 오늘 할일 → 다음 할일 DnD 이동 후 "다음 할일" 영역에 카드 표시됨
- [ ] 매트릭스 뷰: 오늘 할일 → 남은 할일 DnD 이동 후 "남은 할일" 영역에 카드 표시됨
- [ ] 오늘 할일 뷰: DnD로 이동한 할일이 category에 맞게 표시/비표시됨
- [ ] 새로고침 없이 매트릭스 뷰에서 즉시 반영됨

### 회귀 검증
- [ ] 매트릭스 뷰: 기존 할일 인라인 편집 정상
- [ ] 매트릭스 뷰: 체크박스 완료 토글 정상
- [ ] 매트릭스 뷰: 같은 카테고리 내 순서 변경 DnD 정상
- [ ] 매트릭스 뷰: 팀 모드에서도 동일 동작
- [ ] 오늘 할일 뷰: DnD 순서 변경 정상
- [ ] 상세 패널: 카테고리 변경된 할일의 정보 정상 표시
- [ ] `npm run build` 성공

---

## 주의사항

1. **이 Loop은 Agent 체계 최초 실전 적용이다.** 코드 작성 전에 `docs/agents/00-director.md`의 프로토콜에 따라 리뷰를 실행하라.
2. **진단 console.log는 수정 완료 후 반드시 제거한다.**
3. **수정 범위를 이 버그로 한정한다.** Convergence target(DnD 팩토리 통합 등)은 제안만 하고 Ryan 승인 없이 실행하지 마라.
4. **스크린샷 기준**: 매트릭스 뷰에서 "전체" 탭, Ryan Park 영역의 "오늘 할일" 행이 대상

---

## 작업 내역

(작업 완료 후 기록)
