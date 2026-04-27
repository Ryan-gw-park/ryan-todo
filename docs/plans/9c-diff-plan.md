# Phase 9c Diff Plan (v2) — MsTaskTreeMode DnD 마이그레이션 + BacklogPanel cross-drop

> 작성일: 2026-04-09
> 기준: `9c-spec-final.md` (확정)
> 상태: 리뷰 반영 v2

---

## 0. 전제 요약

- DB / RLS 변경 없음
- **단일 커밋** (Step 1~3 개별 커밋 시 빌드 깨짐 → 통합)
- DndContext는 **'전체 할일' 모드만 감싸기** (타임라인 HTML5 DnD 충돌 방지)
- MsTaskTreeMode의 BacklogSection 제거 (BacklogPanel로 대체 완료)
- clientY 후처리: `lastPointerY.current` 단일 버전

## 리뷰 반영 (v1 → v2)

| 이슈 | 해결 |
|------|------|
| [C1] setCollapsed 미존재 | handleAddChildMs의 setCollapsed → onToggleNode 재사용 |
| [C2] 개별 커밋 빌드 깨짐 | 단일 커밋 통합 |
| [C3] clientY 두 버전 충돌 | lastPointerY.current만 사용 |
| [C4] Timeline DnD 충돌 | DndContext를 '전체 할일' 모드만 감싸기 |
| [C5] setCollapsed 의존성 누락 | handleMsDropChild는 MsTaskTreeMode에 유지, collapsed 조작은 onToggleNode prop |
| [W1] BacklogPanel onClick vs listeners | PointerSensor distance:3px 자연 분리 |
| [W3] CompactMilestoneTab Case 3 도달 불가 | bl-task 체크를 Case 2 앞에 배치 |
| [W6] BacklogSection 잔존 | 제거 |

## 핵심 설계 변경

**핸들러 이동 전략 변경**: handleTaskDrop/handleMsDropChild/handleMsReorder를 MsTaskTreeMode에 **유지**한다. UnifiedProjectView의 handleDndEnd에서는 ID 파싱 후 이 핸들러들을 MsTaskTreeMode에 props로 전달하지 않고, **MsTaskTreeMode에 `onExternalTaskDrop` prop을 추가**하여 BacklogPanel→MS drop만 처리한다. 기존 MsNode 내부 drop은 dnd-kit의 onDragEnd에서 처리.

**수정**: 실제로는 dnd-kit에서 drop 처리가 DndContext의 onDragEnd에서 통합 처리되므로, 기존 handleDrop(MsNode 내부)을 제거하고 **모든 drop 로직을 UnifiedProjectView의 handleDndEnd로 이동**해야 한다. MsTaskTreeMode의 handleTaskDrop/handleMsDropChild/handleMsReorder는 **콜백 props로 UnifiedProjectView에서 전달**.

---

## 변경 파일 (4개)

| 파일 | 변경 |
|------|------|
| `MsTaskTreeMode.jsx` | HTML5 DnD 제거, useDraggable/useDroppable, BacklogSection 제거, 핸들러를 props로 받기 |
| `UnifiedProjectView.jsx` | DndContext 추가, handleDndEnd, DnD 핸들러 정의, DragOverlay |
| `BacklogPanel.jsx` | BacklogTaskRow에 useDraggable 추가 |
| `CompactMilestoneTab.jsx` | DndContext 범위 확장, bl-task 케이스 추가 |

커밋: `feat(project): migrate MsTaskTreeMode to dnd-kit + BacklogPanel cross-drop (Phase 9c)`
