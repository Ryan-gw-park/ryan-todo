// 모바일 단순화 이후 이 컴포넌트는 사용되지 않는다.
// 기존에 PersonalMatrixGrid.jsx 가 이 파일을 import 하고 있고
// PersonalMatrixGrid 는 "Don't Touch, Wrap It" 규칙으로 수정 금지 대상이므로
// 깨진 import 를 피하기 위해 PersonalTodoShell 재export 스텁으로만 남긴다.
// (window.innerWidth < 768 분기는 데스크탑에서 도달하지 않으므로 사실상 dead path.)
export { default } from '../personal-todo/PersonalTodoShell'
