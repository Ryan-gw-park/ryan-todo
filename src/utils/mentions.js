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

/* 일관된 mention 색상 — 이름 해시 기반 (COLOR_OPTIONS 8개 순환) */
const MENTION_PALETTE = [
  { dot: '#d4a039', chipBg: '#FBF1DE', chipText: '#7A5512' },  // yellow
  { dot: '#5B9A6A', chipBg: '#E5F1E8', chipText: '#2F573B' },  // green
  { dot: '#5b8fd4', chipBg: '#E3ECF6', chipText: '#26517E' },  // blue
  { dot: '#8e6ebf', chipBg: '#EDE5F5', chipText: '#4E3879' },  // purple
  { dot: '#cb7161', chipBg: '#F6E2DD', chipText: '#7A3326' },  // pink
  { dot: '#d48a3f', chipBg: '#F8E8D5', chipText: '#7A4A19' },  // orange
  { dot: '#4a9e8e', chipBg: '#DCEEEB', chipText: '#235149' },  // teal
  { dot: '#c46060', chipBg: '#F5DDDD', chipText: '#722C2C' },  // red
]

function hashName(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function getMentionColor(name) {
  return MENTION_PALETTE[hashName(name) % MENTION_PALETTE.length]
}
