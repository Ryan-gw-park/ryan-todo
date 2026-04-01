# Sub-Loop 6-B: 백로그 사이드바 상시 표시 + 미배정 행 제거

아래 str_replace 명령을 순서대로 실행하라. 코드를 자의적으로 해석하거나 추가 수정하지 마라.

---

## 파일 1: src/components/matrix/TeamMatrixView.jsx

### 수정 1: 할일 모드 DndContext 블록을 flex 레이아웃으로 감싸기 + 사이드바 추가

old_str:
```
        {subView === 'matrix' && <DndContext sensors={sensors} collisionDetection={matrixCollision} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ overflowX: 'auto', padding: isMobile ? '0 12px' : 0 }}>
```

new_str:
```
        {subView === 'matrix' && <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <DndContext sensors={sensors} collisionDetection={matrixCollision} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ flex: 1, overflowX: 'auto', padding: isMobile ? '0 12px' : 0 }}>
```

### 수정 2: DndContext 닫기 뒤에 사이드바 + flex 래퍼 닫기 추가

할일 모드의 DragOverlay 뒤, DndContext 닫기 부분을 찾는다:

old_str:
```
          <DragOverlay>
            {activeTask && (
              <div style={{ background: '#fff', borderRadius: 5, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: '4px 8px', fontSize: FONT.body, color: COLOR.textPrimary, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeTask.text}
              </div>
            )}
          </DragOverlay>
        </DndContext>}
```

new_str:
```
          <DragOverlay>
            {activeTask && (
              <div style={{ background: '#fff', borderRadius: 5, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: '4px 8px', fontSize: FONT.body, color: COLOR.textPrimary, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeTask.text}
              </div>
            )}
          </DragOverlay>
        </DndContext>
        <MsBacklogSidebar projects={filteredProjects} milestones={milestones} tasks={tasks} />
        </div>}
```

### 수정 3: 미배정 섹션("남은 할일") 숨기기

미배정 행을 렌더하는 부분을 찾는다. config에서 row_type === 'remaining'인 행:

```bash
grep -n "remaining\|남은 할일\|미배정" src/components/matrix/TeamMatrixView.jsx | head -20
```

찾은 줄에서 remaining 섹션 렌더 블록을 `{false &&` 로 감싸라.

아래 패턴 중 하나를 찾아 교체:

**패턴 A** — row_type === 'remaining' 분기가 있는 경우:

old_str:
```
              {row.row_type === 'remaining' && (
```

new_str:
```
              {false && row.row_type === 'remaining' && (
```

**패턴 B** — section === 'remaining' 분기가 있는 경우:

old_str:
```
              {row.section === 'remaining' && (
```

new_str:
```
              {false && row.section === 'remaining' && (
```

**두 패턴 모두 없으면** 아래 grep으로 확인하라:

```bash
grep -n "remaining" src/components/matrix/TeamMatrixView.jsx
```

해당 렌더 블록의 시작 조건에 `false &&` 를 추가하라.

### 수정 4: 완료 섹션("완료")도 동일하게 처리 — 선택 사항

완료 섹션은 유지해도 되지만, 백로그 사이드바와 중복될 수 있으므로 확인 후 결정:

```bash
grep -n "completed\|완료" src/components/matrix/TeamMatrixView.jsx | head -10
```

완료 섹션은 그대로 유지하라 (접힌 상태 기본이므로 공간 차지 적음).

---

## 파일 2: src/components/views/PersonalMatrixView.jsx

### 수정 5: 백로그 사이드바를 모드에 관계없이 항상 표시

old_str:
```
        {showMs && <MsBacklogSidebar projects={projects} milestones={milestones} tasks={tasks} />}
```

new_str:
```
        <MsBacklogSidebar projects={projects} milestones={milestones} tasks={tasks} />
```

---

## 검증

```bash
npm run build
```

- [ ] 팀 매트릭스 → '할일 모드' → 우측에 백로그 사이드바 표시됨
- [ ] 팀 매트릭스 → '마일스톤 모드' → 우측에 백로그 사이드바 표시됨 (기존과 동일)
- [ ] 팀 매트릭스 → 그리드에 미배정 행이 보이지 않음
- [ ] 팀 매트릭스 → 완료 섹션은 그대로 유지 (접힌 상태)
- [ ] 개인 매트릭스 → '할일 모드' → 우측에 백로그 사이드바 표시됨
- [ ] 개인 매트릭스 → 'MS 배정' → 우측에 백로그 사이드바 표시됨 (기존과 동일)
- [ ] 백로그 사이드바: 프로젝트 드롭다운 동작
- [ ] 백로그 사이드바: 전체/미배정/배정됨 필터 동작
- [ ] 백로그 사이드바: depth 선택 L1/L2/L3 동작
- [ ] 그리드 DnD 여전히 정상
- [ ] npm run build 성공

git push origin main
