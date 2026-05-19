import { useMemo } from 'react'
import {
  extractAllMentions,
  parseMentions,
  MENTION_PALETTE,
  MENTION_PALETTE_SIZE,
} from '../../../utils/mentions'
import useMentionColorMap from '../../../hooks/useMentionColorMap'
import MobileTaskListView from './MobileTaskListView'

export default function ByMentionTab({ projects, tasks }) {
  const activeTasks = useMemo(() => tasks.filter(t => !t.done), [tasks])
  const mentions = useMemo(() => extractAllMentions(activeTasks), [activeTasks])
  const colorMap = useMentionColorMap(mentions)

  const sections = useMemo(() => mentions.map(({ name }) => {
    const idx = colorMap[name]
    const safeIdx = typeof idx === 'number'
      ? ((idx % MENTION_PALETTE_SIZE) + MENTION_PALETTE_SIZE) % MENTION_PALETTE_SIZE
      : name.length % MENTION_PALETTE_SIZE
    const accent = MENTION_PALETTE[safeIdx].dot

    const tasksForMention = activeTasks.filter(t => parseMentions(t.text).includes(name))
    const subGroups = projects
      .map(p => ({
        key: p.id,
        title: p.name,
        tasks: tasksForMention
          .filter(t => t.projectId === p.id)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
      }))
      .filter(g => g.tasks.length > 0)

    return { key: name, title: name, accent, subGroups }
  }), [mentions, colorMap, activeTasks, projects])

  return (
    <MobileTaskListView
      sections={sections}
      expandScope="personalMention"
      emptyStateText="@담당자가 태깅된 할일이 없습니다"
    />
  )
}
