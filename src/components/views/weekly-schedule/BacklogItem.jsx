// Commit 7에서 확장됨 — useDraggable
export default function BacklogItem({ kind, item }) {
  return <div>{item?.text || item?.title || ''}</div>
}
