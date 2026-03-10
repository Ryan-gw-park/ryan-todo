export function parseNotes(notes) {
  if (!notes || !notes.trim()) return []
  return notes.split('\n').filter(l => l.trim()).map(l => {
    let level = 0, i = 0
    while (i < l.length && l[i] === '\t') { level++; i++ }
    return { text: l.slice(i).replace(/^[•\-*]\s*/, '').trim(), level }
  }).filter(n => n.text)
}

export function serializeNotes(nodes) {
  return nodes.filter(n => n.text.trim()).map(n => '\t'.repeat(n.level) + n.text).join('\n')
}
