// Loop 44: 개인 매트릭스 시간 컬럼 정의
// category enum 기준 (src/utils/colors.js:CATEGORIES)
// 'done' 카테고리는 !t.done 필터로 별도 제외되므로 여기 미포함

export const TIME_COLUMNS = [
  { key: 'today',   label: '지금 할일' },
  { key: 'next',    label: '다음 할일' },
  { key: 'backlog', label: '남은 할일' },
]
