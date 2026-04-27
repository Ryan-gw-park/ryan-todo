# Loop Workflow 이식 가이드

> Claude Code에서 "사전기획 → 상세기획 → Diff Plan → 코드리뷰 → 실행"을 강제하는 워크플로우.
> 새 프로젝트에 이 체계를 그대로 복제하기 위한 작업지시서.

---

## 개요: 왜 이 체계인가

Claude Code는 강력하지만, 지시 없이 놔두면 코드를 바로 생성하려 한다.
이 워크플로우는 **5개 게이트**를 강제하여 다음을 보장한다:

1. **Recon** — 코드를 읽기 전에 영향 범위부터 파악
2. **Spec** — Claude Code가 초안, **Claude Web(또는 사람)이 상세화** → 역할 분리
3. **Diff Plan** — 파일별 변경 계획을 코드 수정 전에 확정
4. **Review** — 적대적 자가 리뷰 + 외부 모델 교차 리뷰로 결함 사전 차단
5. **Execute** — plan에 명시된 것만 실행. 즉흥 변경 금지

핵심 원칙: **Claude Code는 계획을 세우는 도구이자 실행하는 도구이지, 기획하는 도구가 아니다.**
기획(상세 요구사항, 엣지케이스, 비즈니스 룰)은 사람 또는 Claude Web이 담당한다.

---

## 전제조건

- Claude Code CLI 또는 IDE 확장 설치 완료
- Gemini CLI 설치 (교차 리뷰용, 선택사항): `npm install -g @google/gemini-cli`
- Gemini CLI MCP 서버 설정 (선택사항)

---

## Step 1: 디렉토리 구조 생성

프로젝트 루트에서 아래 구조를 생성한다:

```
your-project/
├── CLAUDE.md                  ← 워크플로우 헌법 (Step 2)
├── Docs/
│   └── plans/                 ← 게이트 산출물 저장소
├── .claude/
│   ├── commands/              ← 슬래시 명령어 (Step 3)
│   │   ├── recon.md
│   │   ├── spec.md
│   │   ├── diff-plan.md
│   │   └── execute.md
│   └── agents/                ← subagent 정의 (Step 4)
│       └── diff-reviewer.md
```

```bash
mkdir -p Docs/plans .claude/commands .claude/agents
```

---

## Step 2: CLAUDE.md 작성

이 파일이 전체 워크플로우의 **헌법**이다. Claude Code는 대화 시작 시 이 파일을 자동으로 읽는다.

아래 템플릿을 프로젝트에 맞게 수정하여 `CLAUDE.md`로 저장한다.

```markdown
# {프로젝트명} — Working Agreement

## Workflow Gates

모든 코드 변경은 아래 게이트를 순서대로 통과해야 한다.
스킵 금지. 게이트 누락 시 작업 중단하고 사용자에게 알릴 것.

### Gate 1: Recon (Plan Mode)
- **트리거**: `/recon {phase}`
- 코드베이스 영향 범위 분석
- 2~3개 구현 옵션과 trade-off
- **산출물**: `Docs/plans/{phase}-recon.md`
- **다음**: 사용자에게 "다음: `/spec {phase}` 실행하세요" 안내

### Gate 2: Spec (초안)
- **트리거**: `/spec {phase}`
- 사용자와 대화하며 요구사항 초안 작성
- **산출물**: `Docs/plans/{phase}-spec.md` (초안)
- **전제조건**: recon 파일 존재 필수 (없으면 `/recon` 먼저 안내)
- **다음**: 사용자에게 반드시 다음을 안내:
  > "Spec 초안이 저장되었습니다. **Claude Web에서 spec을 검토하고 상세화해 주세요.**
  > 상세화 완료 후 이 파일을 업데이트하고 `/diff-plan {phase}`를 실행하세요."
- **절대 바로 diff-plan으로 넘어가지 말 것**

### Gate 2.5: Spec 확정 (사용자 주도)
- 사용자가 Claude Web 또는 직접 편집으로 spec을 상세화
- 상세화된 spec 파일을 `Docs/plans/{phase}-spec.md`에 반영
- 사용자가 "spec 확정" 또는 `/diff-plan` 실행 시 다음 단계 진입

### Gate 3: Diff Plan (Plan Mode)
- **트리거**: `/diff-plan {phase}`
- recon + spec 파일 기반 파일별 변경 계획
- **산출물**: `Docs/plans/{phase}-diff-plan.md`
- **전제조건**: spec 파일 존재 필수 (없으면 거부)
- **리뷰 2단계** (반드시 순서대로):
  1. **Adversarial Claude reviewer**: diff-reviewer subagent 호출 (적대적 시스템 프롬프트, 결함만 찾음)
  2. **Gemini CLI MCP** (설정된 경우): 외부 모델로 교차 리뷰
- 리뷰 결과를 diff-plan 파일에 `## Review` 섹션으로 추가
- BLOCK 판정 시 수정 후 재리뷰
- **다음**: 사용자에게 "다음: `/execute {phase}` 실행하세요" 안내

### Gate 4: Execute
- **트리거**: `/execute {phase}`
- **전제조건**: diff-plan 파일 존재 필수 (없으면 거부)
- diff-plan에 명시된 변경만 실행. plan에 없는 변경 금지
- 각 변경 후 빌드 확인
- 완료 시 커밋

### Gate 5: Post Review
- 실행 완료 후 자동 수행
- 변경된 파일 목록 + 빌드 결과 보고
- diff-reviewer subagent로 사후 리뷰

## Claude의 행동 규칙

### 각 게이트 진입 시 Claude는 반드시:
1. 현재 단계에서 필요한 정보가 충분한지 점검
2. 부족한 정보에 대해 사용자에게 **질문을 먼저** 함
3. 가능한 **액션 옵션을 제안**
4. 사용자 확인 후 진행

### Hard Rules
- Plan mode 산출물은 항상 **파일로 저장** (대화에만 남기지 말 것)
- 한 Phase = 한 기능. 스코프 확장 시 새 Phase 생성
- spec에 없는 기능 추가 금지. 발견 시 사용자에게 보고하고 spec 업데이트 요청
- 코드베이스 전체 읽기 금지. 영향 파일만 읽을 것
- 동일 파일 재읽기 금지 (이미 컨텍스트에 있으면 재사용)

## Phase 번호 체계
Phase 번호는 `/recon 1a` 형식으로 사용.
1a, 1b, 1c... → 2a, 2b... 순서로 진행.

## 프로젝트 구조
{여기에 실제 프로젝트 디렉토리 구조를 기술}

## 기술 스택
{여기에 실제 기술 스택을 기술}
```

### 커스터마이징 포인트

| 항목 | 수정 방법 |
|------|-----------|
| 프로젝트명 | 상단 제목 변경 |
| Phase 번호 체계 | 프로젝트 히스토리에 맞게 시작 번호 조정 |
| 프로젝트 구조 | 실제 디렉토리 구조 반영 |
| 기술 스택 | 실제 스택 기술 (빌드 명령어, 테스트 명령어 등) |
| 리뷰 단계 | Gemini 외 다른 MCP 리뷰어 추가/제거 가능 |

---

## Step 3: 슬래시 명령어 생성

### `.claude/commands/recon.md`

```markdown
Phase $ARGUMENTS에 대한 Recon을 수행한다.

Plan mode로 진입하여 다음을 수행:

1. 사용자가 설명한 기능/변경에 대해 코드베이스 영향 범위 분석
2. 영향받는 파일/모듈 목록 작성
3. 2~3개 구현 옵션과 각각의 trade-off 분석
4. 기존 코드에서 재사용 가능한 함수/패턴 식별
5. 위험 요소 및 사전 확인 필요 사항 나열

산출물을 `Docs/plans/$ARGUMENTS-recon.md`로 저장한다.

저장 후 사용자에게 다음을 안내:
- "Recon 완료. 다음 단계: `/spec $ARGUMENTS`로 요구사항을 확정하세요."

절대 코드 수정 금지. 분석과 파일 저장만 수행.
```

### `.claude/commands/spec.md`

```markdown
Phase $ARGUMENTS에 대한 Spec 초안을 작성한다.

먼저 전제조건을 확인:
- `Docs/plans/$ARGUMENTS-recon.md` 파일이 존재하는지 확인
- 없으면: "⛔ recon 파일이 없습니다. 먼저 `/recon $ARGUMENTS`를 실행하세요." 라고 안내하고 중단

존재하면:
1. recon 파일을 읽는다
2. 사용자에게 AskUserQuestion으로 요구사항을 구체적으로 질문한다:
   - 핵심 기능 범위
   - UI 변경 필요 여부
   - DB 변경 필요 여부
   - 우선순위/제약 사항
3. 확정된 요구사항을 `Docs/plans/$ARGUMENTS-spec.md`로 저장한다

저장 후 **반드시** 다음을 안내 (이 단계를 건너뛰지 말 것):

> "📝 Spec 초안이 `Docs/plans/$ARGUMENTS-spec.md`에 저장되었습니다.
>
> **다음 단계 (중요):**
> 1. Claude Web에서 이 spec을 검토하고 상세화해 주세요
> 2. 목업, 엣지케이스, 비즈니스 룰 등을 보강하세요
> 3. 상세화 완료 후 파일을 업데이트하고 `/diff-plan $ARGUMENTS`를 실행하세요
>
> ⚠️ Spec 상세화 없이 바로 diff-plan으로 넘어가지 마세요."

절대 코드 수정 금지. 절대 자동으로 diff-plan 단계로 넘어가지 말 것.
```

### `.claude/commands/diff-plan.md`

```markdown
Phase $ARGUMENTS에 대한 Diff Plan을 작성한다.

먼저 전제조건을 확인:
- `Docs/plans/$ARGUMENTS-spec.md` 파일이 존재하는지 확인
- 없으면: "⛔ spec 파일이 없습니다. 먼저 `/spec $ARGUMENTS`를 실행하세요." 라고 안내하고 중단

존재하면:
1. recon 파일과 spec 파일을 모두 읽는다
2. Plan mode로 진입하여 다음을 작성한다:
   - 변경할 파일 목록 (파일별 변경 내용 요약)
   - DB 마이그레이션 필요 여부 + SQL
   - API 변경 사항 (새 엔드포인트, 수정 엔드포인트)
   - 프론트엔드 변경 사항 (컴포넌트, 페이지)
   - 작업 순서 (의존성 고려)
   - 검증 절차
3. 산출물을 `Docs/plans/$ARGUMENTS-diff-plan.md`로 저장한다
4. diff-reviewer subagent를 호출하여 리뷰를 요청한다 (가능한 경우)

저장 후 안내:
- "Diff Plan 작성 완료. 다음 단계: `/execute $ARGUMENTS`로 실행하세요."

절대 코드 수정 금지. 계획과 파일 저장만 수행.
```

### `.claude/commands/execute.md`

```markdown
Phase $ARGUMENTS의 Diff Plan을 실행한다.

먼저 전제조건을 확인:
- `Docs/plans/$ARGUMENTS-diff-plan.md` 파일이 존재하는지 확인
- 없으면: "⛔ diff-plan 파일이 없습니다. 먼저 `/diff-plan $ARGUMENTS`를 실행하세요." 라고 안내하고 중단

존재하면:
1. diff-plan 파일을 읽는다
2. 사용자에게 실행 전 최종 확인을 요청한다:
   - 변경될 파일 목록 요약
   - "이대로 실행해도 될까요?"
3. 사용자 승인 후, diff-plan에 명시된 변경만 순서대로 실행한다
4. **plan에 없는 변경은 절대 하지 않는다**
5. 각 step 후 빌드 확인 (TypeScript 컴파일 에러 없는지)
6. 모든 변경 완료 후:
   - git add + commit (phase 번호 포함 메시지)
   - 빌드 최종 확인
   - 변경 요약 보고

실행 중 예상치 못한 에러 발생 시:
- 즉시 중단
- 에러 내용 보고
- 사용자 지시 대기 (자의적으로 우회하지 말 것)
```

---

## Step 4: diff-reviewer subagent 생성

### `.claude/agents/diff-reviewer.md`

이 에이전트의 핵심은 **적대적 관점**이다. "괜찮아 보인다"는 답 금지.

```markdown
---
name: diff-reviewer
description: Diff plan의 결함만 찾는 회의적 리뷰어. 저자는 반드시 뭔가 빠뜨렸다고 가정한다.
tools: Read, Grep, Glob
model: sonnet
---

당신은 **적대적(adversarial) 코드 리뷰어**입니다.
당신의 유일한 목적은 주어진 diff plan의 **결함, 누락, 위험**을 찾는 것입니다.

## 핵심 원칙
- 저자(Claude)는 반드시 뭔가 빠뜨렸다고 가정하라
- "괜찮아 보인다"는 답변 금지. 무조건 문제를 찾아라
- 찾지 못하면 더 깊이 파라
- spec과 diff plan의 불일치를 한 줄씩 대조하라

## 점검 항목 (반드시 모두 확인)

### A. Spec 커버리지
- spec의 모든 결정 사항이 diff plan에 반영되었는가?
- spec에 있는데 diff plan에 없는 항목은?
- diff plan에 있는데 spec에 없는 항목은? (스코프 확장)

### B. 아키텍처
- 기존 코드 패턴과 일관성이 있는가?
- 라우트 매칭 충돌 가능성은?
- 컴포넌트 props 인터페이스가 기존 패턴과 맞는가?

### C. 엣지 케이스
- 빈 배열/null/undefined 처리
- 0건 결과
- 최대값 초과 (limit, 그룹 레벨 등)
- 네트워크 에러
- 동시성 (race condition)

### D. 보안
- SQL injection 가능성
- 권한 누락
- 입력 검증 누락

### E. 성능
- N+1 쿼리
- 불필요한 전체 스캔
- 메모리 폭발 가능성

### F. 데이터 무결성
- 마이그레이션 안전성
- 롤백 가능성
- 기존 데이터 영향

## 보고 형식

## Adversarial Review

### 판정: PASS / BLOCK / CONDITIONAL PASS

### Critical (BLOCK 사유)
- [C1] ...

### Warning (수정 권장)
- [W1] ...

### Info (참고)
- [I1] ...

### Spec 불일치
- spec #{번호} vs diff plan: ...

### 누락된 엣지 케이스
- ...

### 권장 수정
1. ...

BLOCK 조건:
- Critical 1개 이상
- Spec 불일치 2개 이상
- 보안 취약점 발견
- 데이터 손실 위험

CONDITIONAL PASS:
- Warning만 있고 Critical 없음

PASS 조건:
- Critical/Warning 모두 없음 (거의 불가능 — 더 깊이 파라)
```

---

## Step 5: Gemini CLI MCP 설정 (선택사항)

교차 리뷰를 위해 Gemini CLI를 MCP 서버로 연결한다.

### 5-1. Gemini CLI 설치
```bash
npm install -g @google/gemini-cli
```

### 5-2. API 키 설정
```bash
# 환경변수 방식
export GEMINI_API_KEY="your-api-key"

# 또는 설정 파일 방식
# ~/.gemini/settings.json에 키 저장
```

### 5-3. MCP 서버 등록

`.claude/settings.local.json` 또는 글로벌 설정에 추가:

```json
{
  "mcpServers": {
    "gemini": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/gemini-mcp@latest"]
    }
  }
}
```

> **주의**: Gemini MCP 서버는 Claude Code 시작 시 gemini CLI가 PATH에 있어야 한다.
> 설치 후 Claude Code를 재시작해야 MCP pool이 정상 초기화된다.

---

## Step 6: 사용법 (실제 워크플로우)

### 전체 흐름도

```
사용자                    Claude Code                 Claude Web / 사람
  │                          │                              │
  ├─ /recon 1a ────────────► │                              │
  │                          ├─ 코드 분석                    │
  │                          ├─ recon.md 저장                │
  │  ◄─────── "다음: /spec" ─┤                              │
  │                          │                              │
  ├─ /spec 1a ─────────────► │                              │
  │                          ├─ 질문 → 초안 작성              │
  │                          ├─ spec.md 저장                 │
  │  ◄── "Claude Web에서     │                              │
  │       상세화하세요" ──────┤                              │
  │                          │                              │
  ├─ spec.md를 전달 ─────────┼────────────────────────────► │
  │                          │                    spec 상세화 │
  │  ◄───────────────────────┼──── 상세화된 spec.md 반환 ────┤
  │                          │                              │
  ├─ spec.md 업데이트 ──────►│                              │
  ├─ /diff-plan 1a ────────► │                              │
  │                          ├─ 파일별 변경 계획              │
  │                          ├─ diff-reviewer 리뷰           │
  │                          ├─ Gemini 교차 리뷰             │
  │                          ├─ BLOCK → 수정 → 재리뷰        │
  │                          ├─ diff-plan.md 저장            │
  │  ◄─── "다음: /execute" ──┤                              │
  │                          │                              │
  ├─ /execute 1a ──────────► │                              │
  │                          ├─ plan대로만 코드 수정          │
  │                          ├─ 빌드 확인                    │
  │                          ├─ git commit                   │
  │  ◄─── 완료 보고 ─────────┤                              │
```

### 명령어 요약

| 명령어 | 설명 | 산출물 |
|--------|------|--------|
| `/recon 1a` | 영향 범위 분석 | `Docs/plans/1a-recon.md` |
| `/spec 1a` | 요구사항 초안 | `Docs/plans/1a-spec.md` |
| (수동) | Claude Web에서 spec 상세화 | `1a-spec.md` 업데이트 |
| `/diff-plan 1a` | 파일별 변경 계획 + 리뷰 | `Docs/plans/1a-diff-plan.md` |
| `/execute 1a` | plan대로 코드 수정 + 커밋 | 코드 변경 + git commit |

### Claude Web에서 Spec 상세화할 때 주는 프롬프트 예시

```
아래는 {프로젝트명}의 Phase 1a에 대한 spec 초안이다.

[spec.md 내용 붙여넣기]

다음을 보강해줘:
1. 엣지케이스 목록 (빈 값, 에러, 경계값)
2. UI 상세 (레이아웃, 인터랙션, 상태별 화면)
3. 비즈니스 룰 (조건부 로직, 권한, 제약사항)
4. 데이터 모델 변경이 있으면 스키마 상세
5. 결정이 필요한 항목은 선택지와 trade-off를 제시

최종 산출물은 개발자가 바로 diff-plan을 작성할 수 있는 수준으로.
```

---

## 설계 원칙과 주의사항

### 왜 Gate 2.5 (사람의 상세화)가 중요한가

Claude Code는 **코드베이스 맥락**에 강하지만, 비즈니스 요구사항의 미묘함을 놓친다.
Claude Web은 **긴 대화형 사고**에 강하지만, 코드베이스를 모른다.

| 역할 | Claude Code | Claude Web / 사람 |
|------|-------------|-------------------|
| 코드 분석 | O | X |
| 기술 옵션 평가 | O | △ |
| 비즈니스 룰 상세화 | △ | O |
| 엣지케이스 도출 | △ | O |
| 파일별 변경 계획 | O | X |
| 코드 실행 | O | X |

이 분업이 없으면 Claude Code가 spec을 대충 쓰고 바로 코딩에 들어간다.
Gate 2.5가 이를 차단한다.

### diff-reviewer가 적대적이어야 하는 이유

같은 Claude가 plan을 쓰고 리뷰하면 자기 확증 편향이 발생한다.
"결함을 반드시 찾아라"는 시스템 프롬프트가 이를 깨뜨린다.
외부 모델 (Gemini) 교차 리뷰는 모델 자체의 사각지대를 보완한다.

### 흔한 실수와 대응

| 실수 | 증상 | 대응 |
|------|------|------|
| spec 없이 코딩 시작 | 기능이 요구사항과 다름 | CLAUDE.md의 게이트 강제 규칙이 차단 |
| diff-plan 무시하고 즉흥 수정 | 예상치 못한 부작용 | execute 명령어에 "plan에 없는 변경 금지" 명시 |
| 리뷰 건너뜀 | 배포 후 버그 | diff-plan 명령어에 리뷰 강제 포함 |
| Phase 스코프 확장 | 끝나지 않는 작업 | "한 Phase = 한 기능" 규칙 |
| Claude Web 상세화 생략 | 얕은 spec → 구멍 많은 plan | Gate 2.5 안내 메시지가 매번 경고 |

---

## 빠른 시작 (복사-붙여넣기용)

새 프로젝트에서 아래를 Claude Code에 지시하면 된다:

```
아래 구조로 Loop 워크플로우를 세팅해줘:

1. CLAUDE.md — 워크플로우 게이트 규칙 (5단계: recon → spec → diff-plan → execute → post-review)
2. .claude/commands/ — recon.md, spec.md, diff-plan.md, execute.md
3. .claude/agents/diff-reviewer.md — 적대적 리뷰어
4. Docs/plans/ 디렉토리

기술 스택: {여기에 기술}
프로젝트 구조: {여기에 구조}

이 가이드를 참고해: {이 파일 경로 또는 내용}
```

또는 이 가이드의 Step 2~4 파일들을 그대로 복사하고, CLAUDE.md의 프로젝트 구조/기술 스택 섹션만 수정한다.
