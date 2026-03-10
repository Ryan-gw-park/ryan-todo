import { getBulletStyle } from '../../utils/colors'
import { OutdentIcon, IndentIcon, TrashIcon } from './Icons'

export default function OutlinerRow({ node, idx, accentColor, inputRef, onTextChange, onKeyDown, onDelete, onChangeLevel, showPlaceholder }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, paddingLeft: node.level * 22, minHeight: 30 }} className="bullet-row">
      <div style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div style={getBulletStyle(node.level, accentColor)} />
      </div>
      <input
        ref={inputRef}
        value={node.text}
        onChange={e => onTextChange(idx, e.target.value)}
        onKeyDown={e => onKeyDown(e, idx)}
        placeholder={showPlaceholder ? '노트를 입력하세요...' : ''}
        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, lineHeight: '22px', padding: '3px 4px', fontFamily: 'inherit', color: '#37352f', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', gap: 1, opacity: 0, transition: 'opacity 0.12s', flexShrink: 0 }} className="bullet-actions">
        {node.level > 0 && (
          <button onClick={() => onChangeLevel(idx, -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 2, display: 'flex' }}>
            <OutdentIcon />
          </button>
        )}
        {node.level < 3 && idx > 0 && (
          <button onClick={() => onChangeLevel(idx, 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 2, display: 'flex' }}>
            <IndentIcon />
          </button>
        )}
        <button onClick={() => onDelete(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dbb', padding: 2, display: 'flex' }}>
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}
