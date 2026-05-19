import { useEffect, useRef } from 'react'

// CHECKBOX 토큰 (src/styles/designTokens.js): size=16, radius=4
const CHECKBOX_SIZE = 16

// 클릭 타깃이 체크박스 노드(또는 그 하위 svg)인지 판정.
// PersonalTodoTaskRow / FocusCard / MsTaskTreeMode 등에서 체크박스는
//   <div onClick={toggleDone} style={{ width:16, height:16, borderRadius:4, cursor:'pointer', ... }}>
// 형태로 그려지므로 인라인 style 시그니처로 식별한다.
function isCheckboxNode(node, root) {
  let cur = node
  while (cur && cur !== root) {
    if (cur.nodeType === 1 && cur.tagName === 'DIV') {
      const s = cur.style
      const w = parseInt(s.width, 10)
      const h = parseInt(s.height, 10)
      if (
        w === CHECKBOX_SIZE &&
        h === CHECKBOX_SIZE &&
        s.borderRadius &&
        s.cursor === 'pointer'
      ) {
        return true
      }
    }
    cur = cur.parentElement
  }
  return false
}

/* MobileReadonlyWrapper
   체크박스 토글만 허용하는 read-only 영역.
   - 모든 click/pointerdown/mousedown/touchstart 를 capture 단계에서 가로채
     체크박스 노드가 아니면 stopImmediatePropagation + preventDefault.
   - 체크박스 노드면 그대로 통과시켜 onClick={toggleDone} 호출 보장.
   - DnD-kit (PointerSensor / TouchSensor) 의 활성 이벤트(pointerdown / touchstart)
     를 root 단에서 차단하므로 드래그 자체가 시작되지 않음.
*/
export default function MobileReadonlyWrapper({ children }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const block = (e) => {
      if (isCheckboxNode(e.target, el)) return
      // 체크박스 외 모든 인터랙션 차단
      e.stopImmediatePropagation()
      e.stopPropagation()
      // pointerdown / touchstart 는 preventDefault 시 스크롤도 죽으므로 click 만 preventDefault.
      if (e.type === 'click') e.preventDefault()
    }

    // touchstart 는 passive 기본값이라 cancelable 위해 명시 옵션 필요는 없음(여기선 propagation 만 막음).
    el.addEventListener('click', block, true)
    el.addEventListener('pointerdown', block, true)
    el.addEventListener('mousedown', block, true)
    el.addEventListener('touchstart', block, true)
    el.addEventListener('keydown', block, true)
    return () => {
      el.removeEventListener('click', block, true)
      el.removeEventListener('pointerdown', block, true)
      el.removeEventListener('mousedown', block, true)
      el.removeEventListener('touchstart', block, true)
      el.removeEventListener('keydown', block, true)
    }
  }, [])

  return (
    <div ref={ref} className="mobile-readonly">
      {children}
    </div>
  )
}
