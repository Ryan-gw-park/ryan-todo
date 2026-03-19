# Review Template

> The Director follows this format when outputting Loop review results.
> Report output is in Korean (Ryan reads these directly).

---

## Loop Review Report Format

```
═══════════════════════════════════════════
 Loop-XX 리뷰 리포트
 날짜: YYYY-MM-DD
═══════════════════════════════════════════

📋 변경 범위 요약
─────────────────
[Loop 문서에서 파악한 변경 내용 1~3줄 요약]

📊 Agent 판정
─────────────────
 01 Schema      [PASS | WARN | BLOCK | SKIP]  [사유 한 줄]
 02 Permission  [PASS | WARN | BLOCK | SKIP]  [사유 한 줄]
 03 View sync   [PASS | WARN | BLOCK | SKIP]  [사유 한 줄]
 04 Card/DnD    [PASS | WARN | BLOCK | SKIP]  [사유 한 줄]
 05 Design      [PASS | WARN | BLOCK | SKIP]  [사유 한 줄]
 06 Sync/perf   [PASS | WARN | BLOCK | SKIP]  [사유 한 줄]

🏁 최종 판정: [CLEAR | REVISE LOOP | UPDATE RULES]
─────────────────

[CLEAR인 경우]
✅ 모든 검증 통과. 구현을 시작합니다.

[REVISE LOOP인 경우]
🔴 BLOCK 항목:
  1. [Agent명] [구체적 위반 내용]
     → 수정 방향: [어떻게 고쳐야 하는지]
  2. ...

⚠️ WARN 항목:
  1. [Agent명] [주의 사항]
     → 구현 시 유의점: [...]

[UPDATE RULES인 경우]
🟡 규칙 확장 필요:
  1. [Agent명] [새로 추가할 규칙 초안]
     → Ryan 승인 후 Agent 파일 패치

💡 Convergence 제안 (선택)
─────────────────
[이번 Loop 작업 영역과 겹치는 Known divergence가 있으면 제안]
  - [KD-X.X] [내용] — 이번에 같이 정리할까요?
```

---

## Agent Lint Report Format (post-implementation)

```
═══════════════════════════════════════════
 Loop-XX Agent Lint 리포트
 날짜: YYYY-MM-DD
═══════════════════════════════════════════

📁 변경된 파일
─────────────────
[파일 목록]

📊 Agent 검증
─────────────────
 01 Schema      [PASS | FAIL]  [사유]
 02 Permission  [PASS | FAIL]  [사유]
 03 View sync   [PASS | FAIL]  [사유]
 04 Card/DnD    [PASS | FAIL]  [사유]
 05 Design      [PASS | FAIL]  [사유]
 06 Sync/perf   [PASS | FAIL]  [사유]

🏁 결과: [PASS — 커밋 가능 | FAIL — 핫픽스 필요]

[FAIL인 경우]
🔧 수정 필요:
  1. [파일명:행번호] [위반 내용] → [수정 방향]
```

---

## Verdict Criteria Summary

| Verdict | Condition | Ryan's Action |
|---------|-----------|---------------|
| PASS | No violations for this agent | None |
| WARN | Not a violation but caution needed | Acknowledge and proceed |
| BLOCK | Rule violation, cannot proceed | Fix Loop doc, re-review |
| SKIP | Not relevant to this Loop | None |
| CLEAR | All PASS/SKIP | Start implementation |
| REVISE LOOP | 1+ BLOCKs | Fix in Claude Web |
| UPDATE RULES | Agent rules insufficient | Ryan approves → patch rules → re-review |
