# Phase 11a Spec (Final) — 노트 뷰 1열 리스트 + 우측 상세 패널

> 작성일: 2026-04-10
> 상태: **확정**

## 결정사항
- 좌측 리스트: 제목만 (미리보기 없음)
- 삭제 버튼: 리스트 항목 hover + 우측 상세 모두
- 모바일: 리스트 → 선택 → 상세 전환 (뒤로가기)
- 기존 fullscreen 모드 → selectedMemoId 기반 split pane으로 대체

## 영향 파일
- `src/components/views/MemoryView.jsx` — 단일 파일 리팩터
