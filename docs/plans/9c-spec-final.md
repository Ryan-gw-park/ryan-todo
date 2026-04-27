# Phase 9c Spec (Final) — MsTaskTreeMode DnD 마이그레이션 + BacklogPanel cross-drop

> 작성일: 2026-04-09
> 상태: **확정**
> 선행: `9c-recon.md`, Phase 9a (`cc1544d`), Phase 9b (`80887b0`)

---

## 1. 목표

1. MsTaskTreeMode의 네이티브 HTML5 DnD를 **dnd-kit으로 전환** (앱 전체 DnD 표준 통일)
2. BacklogPanel에서 MS 트리로 **task cross-drop** 활성화
3. 기존 동작 100% 유지 (task 이동, MS 재배치, MS 하위 이동, undo)

---

## 2. 확정 결정사항

| # | 항목 | 결정 |
|---|------|------|
| D1 | DnD 라이브러리 | dnd-kit (앱 전체 표준) |
| D2 | MS 3-zone 판정 | **clientY 후처리** (handleDragEnd에서 마우스 Y좌표로 above/child/below 판정) |
| D3 | Drop target 하이라이트 | **outline ring** (`outline: 2px solid #3182CE; outline-offset: -2px`) |
| D4 | DndContext 위치 | UnifiedProjectView 레벨 (MsTaskTreeMode + BacklogPanel 공유) |
| D5 | Drag ID 전략 | prefix 기반: `tree-ms:`, `tree-task:`, `bl-task:` |
| D6 | DragOverlay | TaskChipOverlay 재사용 (9b BacklogPanel 패턴), MS용 MilestoneOverlay |
| D7 | Sensors | PointerSensor(3px) + TouchSensor(200ms, 5px) — CompactMilestoneTab과 동일 |
| D8 | Collision detection | `pointerWithin` — 앱 전체 표준 |
| D9 | BacklogPanel drag 시각 | 원본 opacity 0.4 + DragOverlay 미니카드 |
| D10 | CompactMilestoneTab | 기존 DndContext를 BacklogPanel까지 확장 |
| D11 | DB 변경 | 없음 |
| D12 | Undo | 기존 pushUndo/showToast 로직 100% 유지 |

---

## 3. 기능 범위

### 3-1. IN SCOPE

1. **MsTaskTreeMode DnD 마이그레이션**
   - DragTask: HTML5 `draggable/onDragStart` → `useDraggable({ id: 'tree-task:{taskId}' })`
   - MsNode task-zone: `onDragOver/onDrop` → `useDroppable({ id: 'tree-drop:{msId}' })`
   - MsNode MS 헤더: `draggable` → `useDraggable({ id: 'tree-ms:{msId}' })` + `useDroppable({ id: 'tree-ms-zone:{msId}' })`
   - `dragState` 제거 → dnd-kit `active` 상태로 대체
   - `dropTarget` 제거 → `isOver` + clientY 후처리로 대체

2. **UnifiedProjectView DndContext**
   - 단일 DndContext로 MsTaskTreeMode + BacklogPanel 감싸기
   - sensors, collisionDetection 설정
   - handleDragStart: activeTask/activeMs state 설정
   - handleDragEnd: ID prefix 파싱 → 기존 핸들러 호출
   - DragOverlay: task/MS 미니카드

3. **BacklogPanel useDraggable**
   - BacklogTaskRow에 `useDraggable({ id: 'bl-task:{taskId}' })` 추가
   - isDragging: opacity 0.4
   - DragOverlay에서 미니카드 표시

4. **CompactMilestoneTab DndContext 확장**
   - 기존 DndContext가 BacklogPanel도 감싸도록 조정
   - BacklogPanel의 bl-task drop → handleDragEnd에서 처리

5. **MS 3-zone clientY 후처리**
   - handleDragEnd에서 `over.id.startsWith('tree-ms-zone:')` 감지
   - `activatorEvent.clientY`와 over 요소의 `rect`로 zone 판정:
     - Y < 25%: above → handleMsReorder(msId, targetId, 'above')
     - 25~75%: child → handleMsDropChild(msId, targetId)
     - Y > 75%: below → handleMsReorder(msId, targetId, 'below')

6. **Drop target 시각 피드백**
   - `isOver` 상태일 때 MS 행에 `outline: 2px solid #3182CE; outline-offset: -2px`
   - task-zone: 연한 파란 배경 (`rgba(49,130,206,0.05)`)

### 3-2. OUT OF SCOPE

- Task sortable (같은 MS 내 task 순서 변경) — 현재도 미구현, 9c 범위 외
- MS sortable (같은 부모 내 MS 순서 DnD) — 3-zone reorder로 처리
- BacklogPanel 내부 task reorder
- 타임라인 뷰 DnD 변경

---

## 4. 데이터 흐름

### 4-1. Task drag (BacklogPanel → MS 트리)
```
BacklogTaskRow useDraggable({ id: 'bl-task:{taskId}' })
  → DragOverlay 미니카드 표시
  → MsNode useDroppable({ id: 'tree-drop:{msId}' }) isOver → outline ring
  → Drop → handleDragEnd
  → ID 파싱: 'bl-task:' prefix → taskId
  → over: 'tree-drop:' prefix → msId
  → updateTask(taskId, { keyMilestoneId: msId })
  → pushUndo + showToast
```

### 4-2. Task drag (MS 트리 내부)
```
DragTask useDraggable({ id: 'tree-task:{taskId}', data: { fromMsId } })
  → MsNode useDroppable({ id: 'tree-drop:{msId}' }) isOver
  → Drop → handleDragEnd
  → handleTaskDrop(taskId, fromMsId, toMsId)
```

### 4-3. MS drag (MS → MS)
```
MsNode useDraggable({ id: 'tree-ms:{msId}' })
  → MsNode useDroppable({ id: 'tree-ms-zone:{msId}' }) isOver → outline ring
  → Drop → handleDragEnd
  → clientY 후처리 → zone 판정
  → above/below → handleMsReorder(msId, targetId, position)
  → child → handleMsDropChild(msId, targetId)
```

---

## 5. 영향 파일

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `src/components/project/MsTaskTreeMode.jsx` | **대규모 수정** | HTML5 DnD 제거, useDraggable/useDroppable 추가 |
| `src/components/project/UnifiedProjectView.jsx` | 수정 | DndContext 추가, handleDragEnd, DragOverlay |
| `src/components/project/BacklogPanel.jsx` | 수정 | BacklogTaskRow에 useDraggable 추가 |
| `src/components/project/CompactMilestoneTab.jsx` | 수정 | DndContext 범위를 BacklogPanel까지 확장 |

---

## 6. 구현 순서 (R-ATOMIC)

| # | 커밋 | 목적 | 위험도 |
|---|------|------|--------|
| 1 | `refactor: migrate DragTask to useDraggable` | task drag 소스만 변경, drop은 아직 HTML5 | 낮음 |
| 2 | `refactor: migrate MsNode task-zone to useDroppable` | task drop 영역 변경 | 중간 |
| 3 | `refactor: migrate MsNode MS drag to useDraggable+useDroppable` | MS drag + 3-zone | 높음 |
| 4 | `feat: add DndContext to UnifiedProjectView + handleDragEnd` | 통합 + DragOverlay | 중간 |
| 5 | `feat: add useDraggable to BacklogPanel BacklogTaskRow` | cross-drop 활성화 | 낮음 |
| 6 | `feat: extend CompactMilestoneTab DndContext for BacklogPanel` | Compact 모드 cross-drop | 낮음 |

---

## 7. QA 체크리스트

### 7-1. MsTaskTreeMode 회귀 (⭐ critical)
- [ ] Task drag → 다른 MS로 이동
- [ ] MS drag → above (위에 삽입)
- [ ] MS drag → child (하위로 이동)
- [ ] MS drag → below (아래에 삽입)
- [ ] Undo (Ctrl+Z) 모든 DnD 작업
- [ ] Toast 메시지 표시
- [ ] 인라인 편집 중 drag 비활성화
- [ ] hover +하위/삭제 버튼 동작
- [ ] 9a owner avatar 클릭 vs drag 충돌 없음

### 7-2. BacklogPanel cross-drop
- [ ] BacklogPanel task drag 시작 → opacity 0.4
- [ ] DragOverlay 미니카드 표시
- [ ] MS 행 위에 hover → outline ring
- [ ] Drop → task가 백로그에서 사라지고 MS 트리에 등장
- [ ] Undo 가능
- [ ] CompactMilestoneTab에서도 동일 동작

### 7-3. 시각 피드백
- [ ] Drop target: outline 2px solid #3182CE
- [ ] Task-zone: 연한 파란 배경
- [ ] DragOverlay: 그림자 + 미니카드

### 7-4. 빌드 & 반응형
- [ ] `npm run build` 성공
- [ ] Vite TDZ 오류 없음
- [ ] 1024px 미만 → BacklogPanel hidden (DnD 무관)
- [ ] 매트릭스/주간/타임라인 뷰 회귀 없음
