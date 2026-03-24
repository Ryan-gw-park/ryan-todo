# 루트 폴더 정비 + Agent 체계 설치 + 학습 검증

> **목적**: 프로젝트 루트를 체계적으로 정리하고, Agent 문서를 설치하고, Claude Code가 Agent 체계를 학습한 뒤 실제 코드와 대조 검증한다.
> **중요**: Phase 1은 읽기 전용 조사, Phase 2부터 파일 이동/생성. 데이터 손실 없이 진행한다.

---

## Phase 1: 현재 루트 상태 조사

### 1-1. 루트 레벨 파일/디렉토리 전체 목록

```bash
# 루트 1단계만 (숨김 파일 포함)
ls -la

# 루트 2단계까지
find . -maxdepth 2 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' | sort
```

### 1-2. docs/ 내부 구조

```bash
find docs/ -type f | sort
```

### 1-3. 루트에 있으면 안 되는 파일 식별

아래 기준으로 분류하라:

**루트에 있어야 하는 것 (표준):**
- `package.json`, `package-lock.json`
- `vite.config.js` (또는 .ts)
- `CLAUDE.md`
- `.gitignore`, `.env`, `.env.local`
- `index.html`
- `README.md` (있으면)
- `vercel.json` 또는 `netlify.toml` (배포 설정)

**루트에 있으면 안 되는 것:**
- Loop 작업지시서 (.md) → `docs/loops/`로 이동
- 아키텍처/설계 문서 (.md) → `docs/architecture/`로 이동
- 목업/시안 파일 (.jsx, .html) → `docs/mockups/`로 이동
- SQL 파일 → `supabase/migrations/` 또는 `docs/migrations/`로 이동
- 임시 파일, 백업 파일 → 삭제 또는 `.gitignore`에 추가
- 미사용 설정 파일 (netlify.toml 등 이전 배포 설정) → 삭제

**분류 결과를 아래 형식으로 출력하라:**

```
=== 루트에 유지 ===
[파일 목록]

=== docs/loops/로 이동 ===
[파일 목록]

=== docs/architecture/로 이동 ===
[파일 목록]

=== docs/mockups/로 이동 ===
[파일 목록]

=== 삭제 후보 (확인 필요) ===
[파일 목록 + 사유]
```

**Phase 1은 여기서 멈추고, 분류 결과를 출력하여 확인을 받아라.**
확인 없이 Phase 2로 넘어가지 마라.

---

## Phase 2: 루트 정리 실행

Phase 1의 분류 결과가 승인되면 실행한다.

### 2-1. 디렉토리 생성

```bash
# 필요한 디렉토리 생성 (이미 있으면 무시)
mkdir -p docs/agents
mkdir -p docs/architecture
mkdir -p docs/mockups
mkdir -p docs/loops  # 이미 있을 가능성 높음
```

### 2-2. 파일 이동

Phase 1 분류 결과에 따라 `mv` 실행. 각 파일 이동 후 확인.

```bash
# 예시 (실제 파일명은 Phase 1 결과에 따라)
# mv ./some-architecture-doc.md docs/architecture/
# mv ./loop-XX-something.md docs/loops/
# mv ./mockup-something.jsx docs/mockups/
```

### 2-3. CLAUDE.md 교체

이 프롬프트에 첨부된 `CLAUDE.md` 파일이 새 버전이다.

```bash
# 기존 백업
cp CLAUDE.md docs/architecture/CLAUDE.md.backup-$(date +%Y%m%d)

# 첨부된 CLAUDE.md를 루트에 복사 (덮어쓰기)
cp /path/to/attached/CLAUDE.md ./CLAUDE.md
```

### 2-4. Agent 문서 배치

이 프롬프트에 첨부된 8개 Agent 파일을 `docs/agents/`에 복사한다.
**첨부 파일의 내용을 그대로 사용. 임의 수정 금지.**

```bash
# 첨부된 파일 → docs/agents/ 에 배치
cp /path/to/attached/00-director.md         docs/agents/00-director.md
cp /path/to/attached/01-schema-guardian.md   docs/agents/01-schema-guardian.md
cp /path/to/attached/02-permission-guard.md  docs/agents/02-permission-guard.md
cp /path/to/attached/03-view-consistency.md  docs/agents/03-view-consistency.md
cp /path/to/attached/04-card-interaction.md  docs/agents/04-card-interaction.md
cp /path/to/attached/05-design-system.md     docs/agents/05-design-system.md
cp /path/to/attached/06-sync-performance.md  docs/agents/06-sync-performance.md
cp /path/to/attached/review-template.md      docs/agents/review-template.md
```

**배치 확인:**
```bash
echo "=== Attached files detected ==="
ls -la /path/to/attached/*.md 2>/dev/null || echo "Check attachment paths"

echo ""
echo "=== Target directory ==="
ls -la docs/agents/
```

파일 경로는 첨부 방식에 따라 다를 수 있다. 첨부된 파일을 찾아서 올바른 위치에 복사하라.

**매핑 테이블 (첨부 파일명 → 배치 경로):**

| Attached file | Destination |
|---------------|-------------|
| `CLAUDE.md` | `./CLAUDE.md` (root, overwrite) |
| `00-director.md` | `docs/agents/00-director.md` |
| `01-schema-guardian.md` | `docs/agents/01-schema-guardian.md` |
| `02-permission-guard.md` | `docs/agents/02-permission-guard.md` |
| `03-view-consistency.md` | `docs/agents/03-view-consistency.md` |
| `04-card-interaction.md` | `docs/agents/04-card-interaction.md` |
| `05-design-system.md` | `docs/agents/05-design-system.md` |
| `06-sync-performance.md` | `docs/agents/06-sync-performance.md` |
| `review-template.md` | `docs/agents/review-template.md` |

### 2-5. 최종 루트 구조 확인

```bash
# 정리 후 루트 구조 출력
echo "=== 루트 레벨 ==="
ls -la

echo ""
echo "=== docs/ 구조 ==="
find docs/ -type f | sort

echo ""
echo "=== 루트에 .md 파일이 CLAUDE.md와 README.md만 남았는지 확인 ==="
ls *.md
```

**목표 루트 구조:**

```
ryan-todo/
├── .env.local
├── .gitignore
├── CLAUDE.md                    ← 새로 교체됨
├── README.md                    ← 있으면 유지
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── vercel.json                  ← 배포 설정 (있으면)
├── docs/
│   ├── agents/                  ← 신규
│   │   ├── 00-director.md
│   │   ├── 01-schema-guardian.md
│   │   ├── 02-permission-guard.md
│   │   ├── 03-view-consistency.md
│   │   ├── 04-card-interaction.md
│   │   ├── 05-design-system.md
│   │   ├── 06-sync-performance.md
│   │   └── review-template.md
│   ├── architecture/            ← 설계 문서 모음
│   ├── loops/                   ← Loop 작업지시서
│   ├── migrations/              ← 수동 마이그레이션 SQL
│   └── mockups/                 ← 목업/시안
├── src/
├── supabase/
└── public/
```

---

## Phase 3: Agent 체계 학습 + 코드베이스 대조 검증

CLAUDE.md와 Agent 문서가 설치된 후, 아래를 실행하여 문서와 실제 코드 간 정합성을 검증한다.

### 3-1. CLAUDE.md 읽기 + Agent 진입점 확인

```bash
# CLAUDE.md 전체 읽기
cat CLAUDE.md

# Agent 진입점 확인
cat docs/agents/00-director.md
```

CLAUDE.md §2에 "docs/agents/00-director.md를 읽고" 지시가 있는지 확인.

### 3-2. 6개 Guardian Agent 순차 읽기 + 코드 대조

각 Agent 파일을 읽고, BLOCK rules의 핵심 규칙이 실제 코드와 매칭되는지 검증한다.

#### Schema Guardian (01)

```bash
cat docs/agents/01-schema-guardian.md

# 검증: 기존 테이블 실제 존재 확인
grep -rn "from('tasks')\|from('projects')\|from('memos')" src/ --include="*.js" --include="*.jsx" | head -5

# 검증: PK 타입 규칙 — 기존 테이블이 text PK인지
grep -rn "id.*text\|text.*id" supabase/migrations/*.sql | head -5
```

#### Permission Guard (02)

```bash
cat docs/agents/02-permission-guard.md

# 검증: RLS 헬퍼 함수 존재 확인
grep -rn "get_my_team_ids\|get_my_owner_team_ids\|get_my_team_member_ids" supabase/migrations/*.sql | head -5

# 검증: isOwner 분기 위치 확인
grep -rn "isOwner" src/ --include="*.jsx" -l
```

#### View Consistency (03)

```bash
cat docs/agents/03-view-consistency.md

# 검증: currentView 값 목록 확인
grep -rn "currentView\|setCurrentView" src/ --include="*.js" --include="*.jsx" -n | head -10

# 검증: 네비게이션 3표면 확인
grep -rn "Sidebar\|BottomNav\|VIEW_ORDER" src/ --include="*.jsx" -l
```

#### Card + Interaction (04)

```bash
cat docs/agents/04-card-interaction.md

# 검증: updateTask 시그니처
grep -rn "function updateTask\|const updateTask" src/ --include="*.js" -A 2

# 검증: applyTransitionRules 위치
grep -rn "applyTransitionRules" src/ --include="*.js" -n | head -3

# 검증: DndContext 개수
grep -rn "<DndContext" src/ --include="*.jsx" -c
```

#### Design System (05)

```bash
cat docs/agents/05-design-system.md

# 검증: 프로젝트 컬러 단일 소스
cat src/utils/colors.js | head -30

# 검증: 금지 색상 현재 사용 여부
grep -rn "#c4c2ba\|#d3d1c7" src/ --include="*.jsx" --include="*.js" -n

# 검증: border-left 금지 패턴
grep -rn "borderLeft.*solid\|border-left.*solid" src/ --include="*.jsx" -n
```

#### Sync + Performance (06)

```bash
cat docs/agents/06-sync-performance.md

# 검증: SYNC_TABLES 현재 값
grep -rn "SYNC_TABLES" src/ --include="*.js" -A 2

# 검증: select('*') 현황
grep -rn "\.select(\s*['\"]?\*" src/ --include="*.js" --include="*.jsx" -n | wc -l

# 검증: 폴링 주기
grep -rn "POLL_INTERVAL\|10.000\|10_000" src/ --include="*.js" -n
```

### 3-3. 정합성 리포트 출력

검증 결과를 아래 형식으로 출력하라:

```
═══════════════════════════════════════════
 Agent 체계 설치 검증 리포트
 날짜: YYYY-MM-DD
═══════════════════════════════════════════

📁 파일 설치
─────────────────
 CLAUDE.md          [✅ 설치됨 | ❌ 누락]
 00-director.md     [✅ | ❌]
 01-schema.md       [✅ | ❌]
 02-permission.md   [✅ | ❌]
 03-view.md         [✅ | ❌]
 04-card.md         [✅ | ❌]
 05-design.md       [✅ | ❌]
 06-sync.md         [✅ | ❌]
 review-template.md [✅ | ❌]

🔍 코드 대조 검증
─────────────────
 01 Schema     [✅ 일치 | ⚠️ 불일치: 상세]
 02 Permission [✅ | ⚠️]
 03 View       [✅ | ⚠️]
 04 Card       [✅ | ⚠️]
 05 Design     [✅ | ⚠️]
 06 Sync       [✅ | ⚠️]

💡 발견된 불일치 (있으면)
─────────────────
 1. [Agent명] [규칙] vs [실제 코드] — [수정 제안]
 2. ...

🏁 결과: [체계 가동 준비 완료 | 조정 필요]
```

### 3-4. 불일치 발견 시

Agent 문서와 실제 코드가 불일치하면:
1. **Agent 문서가 틀린 경우** → Agent 문서를 수정하고 재검증
2. **코드가 Agent 문서 이후 변경된 경우** → Known divergence에 추가
3. **판단 불가** → 불일치 내용을 리포트에 기록하고 Ryan에게 보고

**코드를 수정하지 마라.** 이 프롬프트는 설치와 검증만 한다.

---

## Phase 4: 첫 번째 Agent 리뷰 시뮬레이션

체계가 올바르게 설치되었는지 확인하기 위해, 기존에 완료된 Loop 문서 하나를 골라 Agent 리뷰를 시뮬레이션한다.

```bash
# 가장 최근 Loop 문서 확인
ls docs/loops/ | sort | tail -3
```

가장 최근 Loop 문서를 하나 선택하여, `00-director.md`의 프로토콜에 따라 리뷰를 실행하라.

**이 리뷰는 시뮬레이션이다.** 실제 BLOCK이 나와도 코드를 수정하지 않는다.
리포트만 출력하여 Agent 체계가 정상 작동하는지 확인한다.

---

## 주의사항

1. **Phase 1 결과를 반드시 확인받고 Phase 2로 넘어가라.** 파일 이동/삭제는 되돌리기 어렵다.
2. **node_modules/, dist/, .git/ 은 절대 건드리지 마라.**
3. **src/ 내부는 이 프롬프트에서 건드리지 않는다.** 루트와 docs/만 정리한다.
4. **기존 CLAUDE.md는 삭제하지 말고 백업한다.**
5. **Agent 문서는 첨부된 파일을 그대로 사용한다.** 내용을 임의 수정하지 마라. 오타 수정도 금지.
