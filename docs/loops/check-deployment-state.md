# 배포 상태 전수 점검

> 상황: Claude Code가 Step 1~6 완료 보고 (커밋 4d76498, 5664bdc).
> DB 마이그레이션도 완료. 그러나 배포된 앱에 변경사항이 반영되지 않음.
> 이 프롬프트의 모든 점검을 실행하고 결과를 보고하라.

---

## 1. Git 상태 점검

```bash
echo "=== 1-1. 현재 브랜치 ==="
git branch -v

echo ""
echo "=== 1-2. 최근 커밋 10개 ==="
git log --oneline -10

echo ""
echo "=== 1-3. 커밋 4d76498 존재 확인 (머지) ==="
git log --oneline | grep "4d76498" || echo "NOT FOUND"

echo ""
echo "=== 1-4. 커밋 5664bdc 존재 확인 (개선 6건) ==="
git log --oneline | grep "5664bdc" || echo "NOT FOUND"

echo ""
echo "=== 1-5. 워킹트리 상태 (미커밋 변경) ==="
git status --short

echo ""
echo "=== 1-6. remote 설정 ==="
git remote -v

echo ""
echo "=== 1-7. push 상태 — local vs remote ==="
git log --oneline origin/master..master 2>/dev/null || git log --oneline origin/main..main 2>/dev/null || echo "Cannot compare: check remote branch name"

echo ""
echo "=== 1-8. 모든 브랜치 목록 ==="
git branch -a
```

---

## 2. 코드 실제 반영 확인

개선 6건이 실제 코드에 존재하는지 확인:

```bash
echo "=== 2-1. MilestoneSelector 파일 존재 ==="
ls -la src/components/shared/MilestoneSelector.jsx 2>/dev/null || echo "FILE NOT FOUND"

echo ""
echo "=== 2-2. DetailPanel에서 MilestoneSelector import ==="
grep "MilestoneSelector" src/components/shared/DetailPanel.jsx || echo "NOT FOUND"

echo ""
echo "=== 2-3. DetailPanel에서 DeliverableSelector (제거되었어야 함) ==="
grep "DeliverableSelector" src/components/shared/DetailPanel.jsx || echo "CORRECTLY REMOVED"

echo ""
echo "=== 2-4. DetailPanel 생성자 표시 ==="
grep -n "생성자\|creatorName\|createdBy.*name" src/components/shared/DetailPanel.jsx || echo "NOT FOUND"

echo ""
echo "=== 2-5. ProjectHeader Owner 표시 ==="
grep -n "owner\|ownerId\|오너" src/components/project/ProjectHeader.jsx || echo "NOT FOUND"

echo ""
echo "=== 2-6. mapProject ownerId ==="
grep "ownerId\|owner_id" src/hooks/useStore.js || echo "NOT FOUND"

echo ""
echo "=== 2-7. MilestoneOutlinerView 미분류 섹션 ==="
grep -n "unlinked\|미분류\|기타 할일\|!.*keyMilestone" src/components/project/tasks/MilestoneOutlinerView.jsx | head -5 || echo "NOT FOUND"

echo ""
echo "=== 2-8. RowConfigSettings 팀/개인 분리 상태 ==="
grep -n "개인 프로젝트\|팀 프로젝트\|personalProject\|teamProject" src/components/shared/RowConfigSettings.jsx | head -5 || echo "NO SECTION SPLIT"
```

---

## 3. 배포 상태 점검

```bash
echo "=== 3-1. Vercel 설정 확인 ==="
cat vercel.json 2>/dev/null || echo "vercel.json NOT FOUND"

echo ""
echo "=== 3-2. 배포 브랜치 확인 (Vercel은 보통 main 또는 master) ==="
git branch -r

echo ""
echo "=== 3-3. 현재 HEAD가 가리키는 커밋 ==="
git rev-parse HEAD

echo ""
echo "=== 3-4. remote에 push된 최신 커밋 ==="
git rev-parse origin/master 2>/dev/null || git rev-parse origin/main 2>/dev/null || echo "Cannot resolve remote HEAD"

echo ""
echo "=== 3-5. push 안 된 커밋이 있는지 ==="
UNPUSHED=$(git log --oneline origin/master..HEAD 2>/dev/null || git log --oneline origin/main..HEAD 2>/dev/null)
if [ -z "$UNPUSHED" ]; then
  echo "모든 커밋이 push됨"
else
  echo "PUSH 안 된 커밋:"
  echo "$UNPUSHED"
fi
```

---

## 4. 빌드 확인

```bash
echo "=== 4-1. 로컬 빌드 테스트 ==="
npm run build 2>&1 | tail -20

echo ""
echo "=== 4-2. 빌드 결과물 존재 ==="
ls -la dist/ 2>/dev/null || ls -la build/ 2>/dev/null || echo "빌드 출력 디렉토리 없음"
```

---

## 5. 점검 결과 보고 양식

위 모든 결과를 아래 형식으로 정리하라:

```markdown
# 배포 점검 보고서

## Git 상태
- 현재 브랜치: [master/main]
- 최신 커밋: [해시] [메시지]
- 커밋 4d76498 (머지) 존재: [예/아니오]
- 커밋 5664bdc (개선 6건) 존재: [예/아니오]
- 미커밋 변경: [있음/없음]
- push 안 된 커밋: [있음(N개)/없음]

## 코드 반영 상태
| # | 항목 | 파일에 존재 | 코드 확인 |
|---|------|-----------|----------|
| 1 | MilestoneSelector | ? | ? |
| 2 | DeliverableSelector 제거 | ? | ? |
| 3 | 생성자 표시 | ? | ? |
| 4 | ProjectHeader Owner | ? | ? |
| 5 | mapProject ownerId | ? | ? |
| 6 | 미분류 섹션 | ? | ? |
| 7 | RowConfigSettings 통합 | ? | ? |

## 배포 상태
- remote 브랜치: [목록]
- local HEAD: [해시]
- remote HEAD: [해시]
- 불일치: [예/아니오]

## 빌드
- 로컬 빌드: [성공/실패]
- 에러 메시지: [있으면 기록]

## 진단 결론
- 원인: [push 안 됨 / 배포 브랜치 불일치 / 빌드 실패 / 코드 미반영 / 기타]
- 조치: [필요한 액션]
```
