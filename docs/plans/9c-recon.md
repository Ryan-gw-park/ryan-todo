# Phase 9c Recon — MsTaskTreeMode DnD 마이그레이션 + BacklogPanel cross-drop

> 작성일: 2026-04-09
> 기준: `9b-spec-final.md` §11 후속, `loop-7-handoff-to-claude-code.md`
> 상태: 조사 완료

---

## 1. 요구사항 요약

MsTaskTreeMode의 네이티브 HTML5 DnD를 dnd-kit으로 마이그레이션하고, BacklogPanel에서 MS 트리로 task를 drag&drop할 수 있게 한다.

- **MsTaskTreeMode**: HTML5 `draggable/onDragStart/onDragOver/onDrop` → dnd-kit `useDraggable/useDroppable/DndContext`
- **BacklogPanel**: `useDraggable` 추가 → MS 트리의 droppable에 drop
- **UnifiedProjectView**: 단일 `DndContext`로 양쪽 감싸기

---

## 2. 현재 DnD 구현 분석

### 2-1. MsTaskTreeMode HTML5 DnD (700줄, 핵심)

**Drag 소스 2종**:
| 소스 | 요소 | dataTransfer | dragState |
|------|------|-------------|-----------|
| MS 헤더 (좌측) | `draggable` div | `type='ms', msId=node.id` | `{ type: 'ms', id }` |
| Task 행 (DragTask) | `draggable` div | `type='task', taskId, fromMsId` | `{ type: 'task', id }` |

**Drop 존 4종** (MsNode 내부):
| 존 | 감지 방법 | 대상 드래그 | 핸들러 |
|----|----------|-----------|--------|
| `ms-above` | clientY < 25% | MS만 | handleMsReorder(msId, targetId, 'above') |
| `ms-child` | 25% ≤ clientY ≤ 75% | MS만 | handleMsDropChild(msId, targetId) |
| `ms-below` | clientY > 75% | MS만 | handleMsReorder(msId, targetId, 'below') |
| `task-zone` | 우측 task 영역 | Task만 | handleTaskDrop(taskId, fromMsId, toMsId) |

**핸들러 3개**:
- `handleTaskDrop(taskId, fromMsId, toMsId)` → `updateTask(taskId, { keyMilestoneId: toMsId })`
- `handleMsDropChild(msId, targetId)` → `moveMilestone(msId, targetId)` + auto-expand
- `handleMsReorder(msId, targetId, position)` → parent 변경 + siblings reorder

**Undo**: 모든 핸들러가 `pushUndo` + `showToast` 포함

**clientY 기반 존 판정** (MsNode line 370-372):
```js
const rect = e.currentTarget.getBoundingClientRect()
const y = e.clientY - rect.top
const zone = y < rect.height * 0.25 ? 'ms-above' : y > rect.height * 0.75 ? 'ms-below' : 'ms-child'
```

### 2-2. 앱 전체 dnd-kit 패턴

| 컴포넌트 | ID 전략 | collision | sensors |
|---------|---------|-----------|---------|
| CompactMilestoneTab | data.type 기반 | pointerWithin | Pointer(3px) + Touch(200ms) |
| UnifiedGridView | prefix 파싱 (bl-task:, cell-ms:) | pointerWithin | Pointer(5px) + Touch(200ms) |
| MsBacklogSidebar | bl-ms:, bl-task: prefix | 상위 DndContext | 상위 sensors |
| MilestoneTaskChip | plain task.id + data.type | 상위 DndContext | 상위 sensors |

### 2-3. BacklogPanel (현재 DnD 없음)

- BacklogTaskRow: 정적 리스트, drag 없음
- CompactMilestoneTab 내에서 사용될 때 이미 DndContext 안에 있음
- UnifiedProjectView에서는 DndContext 바깥에 있음

---

## 3. 구현 옵션

### 옵션 A: UnifiedProjectView 레벨 단일 DndContext (권장)

```
UnifiedProjectView
└─ DndContext (sensors, collisionDetection, onDragStart/End)
   ├─ MsTaskTreeMode (useDraggable + useDroppable)
   └─ BacklogPanel (useDraggable)
```

**구현**:
1. MsTaskTreeMode에서 HTML5 DnD 전부 제거
2. MsNode의 MS 헤더 → `useDraggable({ id: 'tree-ms:{msId}' })`
3. MsNode의 task-zone → `useDroppable({ id: 'tree-drop:{msId}' })`
4. DragTask → `useDraggable({ id: 'tree-task:{taskId}', data: { type: 'task', taskId, fromMsId } })`
5. MS 헤더의 3-zone (above/child/below) → 커스텀 collision 또는 3개 thin droppable 영역
6. BacklogPanel의 BacklogTaskRow → `useDraggable({ id: 'bl-task:{taskId}' })`
7. UnifiedProjectView에 DndContext + handleDragEnd (ID prefix 파싱)

**장점**: 깔끔한 아키텍처, cross-container drop 자연스러움
**단점**: MsTaskTreeMode 대규모 리팩터 (HTML5 DnD → dnd-kit)
**위험**: MS 3-zone 판정을 dnd-kit에서 구현하기 까다로움

### 옵션 B: MsTaskTreeMode는 dnd-kit으로 교체하되, 3-zone은 단일 droppable + clientY 후처리

handleDragEnd에서 `event.activatorEvent.clientY`와 over 요소의 rect를 비교하여 zone 판정.

**장점**: 기존 zone 로직을 거의 그대로 재사용
**단점**: dnd-kit의 collision API를 우회하는 느낌

### 옵션 C: MsTaskTreeMode의 HTML5 DnD 유지 + BacklogPanel만 별도 DndContext

BacklogPanel에서 drag 시작 → custom event로 MsTaskTreeMode에 전달

**장점**: MsTaskTreeMode 변경 최소
**단점**: 두 DnD 시스템 공존, cross-drop 구현 복잡, 유지보수 어려움

---

## 4. 재사용 가능한 함수/패턴

| 항목 | 소스 | 재사용 |
|------|------|--------|
| handleTaskDrop 로직 | MsTaskTreeMode | 그대로 유지 (내부 호출만 변경) |
| handleMsDropChild 로직 | MsTaskTreeMode | 그대로 유지 |
| handleMsReorder 로직 | MsTaskTreeMode | 그대로 유지 |
| pushUndo/showToast | MsTaskTreeMode | 그대로 유지 |
| Sensors (Pointer+Touch) | CompactMilestoneTab | 동일 패턴 재사용 |
| DragOverlay 패턴 | CompactMilestoneTab | TaskChipOverlay 재사용 |
| data.type 기반 핸들러 분기 | CompactMilestoneTab | 동일 패턴 |

---

## 5. 위험 요소

### Critical

| # | 위험 | 영향 | 대응 |
|---|------|------|------|
| C1 | MsNode 3-zone (above/child/below) 판정 | dnd-kit은 요소 단위 collision → zone 분할 필요 | 옵션 B: handleDragEnd에서 clientY 후처리 |
| C2 | 700줄 파일 대규모 리팩터 회귀 | task reorder, MS 이동, 인라인 편집 깨질 위험 | 단계별 커밋 + 매 커밋 빌드/테스트 |
| C3 | DndContext 중첩 | CompactMilestoneTab은 자체 DndContext 보유 → BacklogPanel이 양쪽에서 사용됨 | CompactMilestoneTab의 DndContext를 BacklogPanel까지 확장 |

### Warning

| # | 위험 | 대응 |
|---|------|------|
| W1 | DragOverlay가 MsTaskTreeMode 스크롤 컨테이너 안에서 잘림 | DragOverlay를 document.body에 portal |
| W2 | touch 디바이스에서 drag 시 스크롤 간섭 | TouchSensor delay 200ms 설정 |
| W3 | 9a에서 추가한 MilestoneOwnerSelector 클릭 vs drag 충돌 | stopPropagation 확인 |

### 사전 확인

1. **MS 3-zone 구현 방식**: 3개 thin droppable div vs handleDragEnd clientY 후처리?
2. **DragOverlay 디자인**: 기존 CompactMilestoneTab의 TaskChipOverlay 재사용?
3. **BacklogPanel drag 시각**: opacity 0.4 + DragOverlay 미니카드?
4. **drop target 하이라이트**: MS 행에 outline ring? 배경색?

---

## 6. 권장 구현 전략

**옵션 A + B 하이브리드** (단일 DndContext + clientY 후처리):

| Step | 내용 | 위험도 |
|------|------|--------|
| 1 | MsTaskTreeMode DragTask: HTML5 → useDraggable | 낮음 (drag 소스만 변경) |
| 2 | MsNode task-zone: onDragOver/onDrop → useDroppable | 낮음 |
| 3 | MsNode MS 헤더: HTML5 drag → useDraggable + useDroppable | 중간 (3-zone 핵심) |
| 4 | UnifiedProjectView: DndContext 추가 + handleDragEnd (clientY 후처리) | 중간 |
| 5 | BacklogPanel: BacklogTaskRow에 useDraggable 추가 | 낮음 |
| 6 | DragOverlay + drop target 하이라이트 | 낮음 |

---

## 7. 영향 파일

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `src/components/project/MsTaskTreeMode.jsx` | **대규모 수정** | HTML5 DnD → dnd-kit (DragTask, MsNode) |
| `src/components/project/UnifiedProjectView.jsx` | 수정 | DndContext 추가, handleDragEnd |
| `src/components/project/BacklogPanel.jsx` | 수정 | BacklogTaskRow에 useDraggable 추가 |
| `src/components/project/CompactMilestoneTab.jsx` | 수정 | DndContext를 BacklogPanel까지 확장 |
