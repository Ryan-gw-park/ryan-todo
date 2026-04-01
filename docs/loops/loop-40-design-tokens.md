# Loop-40: Design Tokens — 생성 + 전체 뷰 적용

> **목적**: 하드코딩된 스타일 값을 중앙 토큰 파일로 통합하여 뷰 간 불일치를 구조적으로 방지
> **방식**: Opus가 작성한 파일과 diff를 Claude Code가 적용만 한다

---

## Step 1: designTokens.js 생성

아래 파일을 `src/styles/designTokens.js`에 정확히 생성하라. 한 글자도 바꾸지 마라.

```js
/**
 * Design Tokens — 모든 뷰에서 import하여 사용
 * 이 파일의 값을 변경하면 전체 앱에 반영됨
 * 직접 하드코딩 금지 — 반드시 이 토큰을 import하여 사용
 */

// ─── 색상 ───
export const COLOR = {
  textPrimary: '#37352f',
  textSecondary: '#6b6a66',
  textTertiary: '#a09f99',
  border: '#e8e6df',
  bgSurface: '#fafaf8',
  bgHover: '#f5f4f0',
  bgActive: '#f0efeb',
  divider: '#e8e6df',
  danger: '#ef4444',
  accent: '#2383e2',
  todayLine: '#e53935',
};

// ─── 폰트 ───
export const FONT = {
  viewTitle: 26,       // 뷰 제목 (h1)
  projectTitle: 17,    // 프로젝트 뷰 제목
  sectionTitle: 15,    // 프로젝트 카드 헤더 등
  subtitle: 14,        // 날짜, 부제
  body: 13,            // 본문 텍스트, 할일 텍스트
  label: 12,           // 라벨, 셀 헤더, 담당자 이름
  caption: 11,         // 보조 텍스트, 뱃지, 카운트
  tiny: 10,            // 최소 텍스트, depth 뱃지, 아주 작은 보조
  ganttMs: 9,          // 간트 MS 바 내부 텍스트
  ganttTask: 9,        // 간트 할일 바 내부 텍스트 (8.5→9 통일)
};

// ─── 간격 ───
export const SPACE = {
  // 뷰 최외곽 패딩
  viewPadding: '40px 48px',
  viewPaddingMobile: '20px 16px 100px',
  // 뷰 내부 컨텐츠 패딩 (풀 width 뷰에서는 사용하지 않음)
  contentPadding: '0 24px',
  // 카드 내부
  cardPadding: '8px 12px',
  cellPadding: '4px 8px',
  // 간격
  sectionGap: 16,
  rowGap: 4,
  itemGap: 8,
};

// ─── 행 높이 ───
export const ROW = {
  standard: 36,        // 표준 행 높이 (매트릭스, 리스트)
  compact: 30,         // 컴팩트 행 (프로젝트 뷰 트리)
  timeline: 36,        // 타임라인 행
  weekly: 80,          // 주간 플래너 셀 최소 높이
};

// ─── 간트 바 ───
export const GANTT = {
  msBarHeight: 20,       // MS 바 높이 (16→20)
  taskBarHeight: 20,     // 할일 바 높이 (14→20, MS와 통일)
  taskBarDoneHeight: 10, // 완료된 할일 바 (8→10)
  barRadius: 5,          // 바 borderRadius (4→5)
  minBarWidth: 25,       // 최소 바 너비
  todayLineWidth: 1.5,
  todayLineOpacity: 0.4,
  weekColumnWidth: 50,   // 기본 주간 컬럼 너비
};

// ─── 뷰 너비 ───
export const VIEW_WIDTH = {
  narrow: 960,         // TodayView, AllTasksView
  medium: 1100,        // ProjectView (전체 할일 모드)
  wide: 1400,          // MatrixView, TimelineView, ProjectView (타임라인)
  full: '100%',        // WeeklyPlanner
};

// ─── 체크박스 ───
export const CHECKBOX = {
  size: 16,
  radius: 4,
  borderColor: '#ccc',
  checkedBg: '#2383e2',
};

// ─── 사이드바 ───
export const SIDEBAR = {
  width: 220,
  sectionFontSize: 11,
  sectionFontWeight: 600,
  sectionColor: '#a09f99',
  itemFontSize: 13,
  itemPadding: '6px 12px',
  itemRadius: 6,
  activeBg: '#f0efeb',
  hoverBg: '#f5f4f0',
};

// ─── 유틸 함수 ───
export const isMobileWidth = () => window.innerWidth < 768;
```

이것만 생성하고 커밋하라. 다른 파일은 건드리지 마라.
커밋 메시지: "feat: add designTokens.js — centralized style constants"
git push origin main
