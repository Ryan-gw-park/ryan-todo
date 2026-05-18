/* @멘션 자동 인식 유틸 — Hotfix r5
 *
 * task.text의 "@이름" 형태 담당자 태그를 추출.
 *
 * 패턴:
 *   - 단일: "@김", "@John", "@홍길동", "@user_1"
 *   - 다중('+' 구분): "@Ethan+Ash" → ['Ethan', 'Ash'],
 *                     "@Ethan+Ash+Bob" → ['Ethan', 'Ash', 'Bob'],
 *                     "@김+이" → ['김', '이']
 *   - 비매칭: "email@example.com" (이메일 — '@' 앞에 문자 있으면 제외)
 */
const MENTION_RE = /(?:^|[^\wㄱ-힝])@([\wㄱ-힝][\wㄱ-힝\d_]*(?:\+[\wㄱ-힝][\wㄱ-힝\d_]*)*)/g

export function parseMentions(text) {
  if (!text) return []
  const seen = new Set()
  const out = []
  let m
  MENTION_RE.lastIndex = 0
  while ((m = MENTION_RE.exec(text)) !== null) {
    // '+' 구분 다중 태그 지원: "Ethan+Ash" → ["Ethan", "Ash"]
    const names = m[1].split('+')
    for (const name of names) {
      if (name && !seen.has(name)) {
        seen.add(name)
        out.push(name)
      }
    }
  }
  return out
}

/* 매트릭스에 보이는 모든 task에서 mention 모음 (unique, 빈도순 정렬) */
export function extractAllMentions(tasks) {
  const counts = new Map()
  for (const t of tasks || []) {
    if (!t || !t.text || t.deletedAt) continue
    for (const name of parseMentions(t.text)) {
      counts.set(name, (counts.get(name) || 0) + 1)
    }
  }
  // 빈도 내림차순 → 이름 가나다순
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }))
}

/* task가 활성 mention set에 매칭되는지 */
export function taskMatchesAnyMention(task, activeMentions) {
  if (!activeMentions || activeMentions.size === 0) return false
  if (!task || !task.text) return false
  const names = parseMentions(task.text)
  for (const n of names) {
    if (activeMentions.has(n)) return true
  }
  return false
}

/* task에서 활성 mention과 매칭되는 이름들 (text 등장 순서) */
export function matchingMentions(task, activeMentions) {
  if (!activeMentions || activeMentions.size === 0) return []
  if (!task || !task.text) return []
  return parseMentions(task.text).filter(n => activeMentions.has(n))
}

/* Mention 색상 팔레트 — Hotfix r7
 *
 * 16색. 인접 인덱스(0-1, 1-2, ...)가 색상환에서 충분히 멀도록 배치
 * (red→cyan→amber→violet→green→rose→blue→lime→fuchsia→teal→
 *  orange→indigo→emerald→pink→sky→yellow). 한 사람이 한 색을 영구 사용하도록
 * 인덱스는 useMentionColorMap hook이 localStorage로 관리한다.
 */
export const MENTION_PALETTE = [
  { dot: '#DC2626', chipBg: '#FEE2E2', chipText: '#7F1D1D' },  //  0 red
  { dot: '#06B6D4', chipBg: '#CFFAFE', chipText: '#155E75' },  //  1 cyan
  { dot: '#D97706', chipBg: '#FEF3C7', chipText: '#78350F' },  //  2 amber
  { dot: '#8B5CF6', chipBg: '#EDE9FE', chipText: '#4C1D95' },  //  3 violet
  { dot: '#16A34A', chipBg: '#DCFCE7', chipText: '#14532D' },  //  4 green
  { dot: '#F43F5E', chipBg: '#FFE4E6', chipText: '#881337' },  //  5 rose
  { dot: '#2563EB', chipBg: '#DBEAFE', chipText: '#1E3A8A' },  //  6 blue
  { dot: '#65A30D', chipBg: '#ECFCCB', chipText: '#365314' },  //  7 lime
  { dot: '#D946EF', chipBg: '#FAE8FF', chipText: '#701A75' },  //  8 fuchsia
  { dot: '#0D9488', chipBg: '#CCFBF1', chipText: '#134E4A' },  //  9 teal
  { dot: '#EA580C', chipBg: '#FFEDD5', chipText: '#7C2D12' },  // 10 orange
  { dot: '#4F46E5', chipBg: '#E0E7FF', chipText: '#312E81' },  // 11 indigo
  { dot: '#059669', chipBg: '#D1FAE5', chipText: '#064E3B' },  // 12 emerald
  { dot: '#DB2777', chipBg: '#FCE7F3', chipText: '#831843' },  // 13 pink
  { dot: '#0284C7', chipBg: '#E0F2FE', chipText: '#0C4A6E' },  // 14 sky
  { dot: '#CA8A04', chipBg: '#FEF9C3', chipText: '#713F12' },  // 15 yellow
]

export const MENTION_PALETTE_SIZE = MENTION_PALETTE.length

export function getMentionColorByIndex(idx) {
  const i = ((idx | 0) % MENTION_PALETTE_SIZE + MENTION_PALETTE_SIZE) % MENTION_PALETTE_SIZE
  return MENTION_PALETTE[i]
}
