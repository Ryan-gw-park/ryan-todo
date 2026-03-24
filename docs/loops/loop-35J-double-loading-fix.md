# Loop-35J: 이중 로딩 + DnD 낙관적 업데이트 유실 수정

> **분류**: Bugfix (HIGH)
> **선행 조건**: Loop-35I 완료
> **Agent 리뷰 필수**

---

## 현상

### 현상 1: 화면이 두 번 로딩됨
앱 접속 시 첫 번째 화면이 스쳐 지나가고, 두 번째 화면이 다시 로딩되어 최종 표시됨.
첫 번째 화면에서는 DnD로 이동한 할일이 정상 표시되지만,
두 번째 로딩 후에는 이동 전 상태로 되돌아감.

### 현상 2: DnD 이동 결과가 유실됨
매트릭스 뷰에서 할일을 DnD로 이동 → 낙관적 업데이트로 즉시 반영 →
이중 로딩의 두 번째 `loadAll()`이 발생 → DB에 아직 반영되지 않은 상태를 다시 읽어옴 →
이동 전 상태로 복귀.

또는: DB에는 반영되었지만, 두 번째 로딩이 별도의 `loadAll()`을 트리거하면서
낙관적 상태를 DB 상태로 덮어쓰는데, 이 과정에서 highlight_color 등
user_task_settings 적용 타이밍 차이로 인해 화면이 갱신됨.

---

## 원인 분석 방향

이전 Loop-28에서 진단된 이중 로딩 원인 4가지:

1. **SW `updatefound` + `controllerchange` 이중 reload** — Loop-28에서 수정 지시했으나 완전히 적용되었는지 미확인
2. **`TOKEN_REFRESHED` auth 이벤트가 `SIGNED_IN`과 동일하게 `initTeamState()` + `loadAll()` 재실행** — Loop-28에서 분기 처리 지시
3. **`loadUserTaskSettings()`가 `loadAll()` 후 await 없이 호출** → 2차 렌더 패스 — Loop-28에서 `Promise.all` 통합 지시
4. **snapshot → server 데이터 전환 시 전체 배열 교체** → Zustand `set()` 트리거

### 진단 확인 사항

```bash
# 1. SW 강제 reload가 남아있는지 확인
grep -rn "location\.reload\|window\.location\.reload" src/ --include="*.js" --include="*.jsx" -n

# 2. onAuthStateChange에서 TOKEN_REFRESHED 분기 처리가 되어있는지
grep -rn "TOKEN_REFRESHED\|onAuthStateChange\|SIGNED_IN" src/ --include="*.js" --include="*.jsx" -A 5

# 3. loadUserTaskSettings가 loadAll 안에 통합되었는지, 별도 호출인지
grep -rn "loadUserTaskSettings\|loadAll" src/ --include="*.js" --include="*.jsx" -n

# 4. snapshot 복원 흐름 — snapshotRestored 플래그 사용 확인
grep -rn "snapshotRestored\|restoreSnapshot\|SNAPSHOT" src/ --include="*.js" --include="*.jsx" -n

# 5. App.jsx 또는 AppShell의 useEffect 의존성 배열 확인 — session 객체가 의존성에 있으면 매 토큰 갱신마다 재실행
grep -rn "useEffect" src/App.jsx src/components/layout/AppShell.jsx --include="*.jsx" -A 5

# 6. connected 상태 토글이 loadAll을 트리거하는지
grep -rn "connected\|setConnected" src/ --include="*.js" --include="*.jsx" -n | head -15

# 7. initTeamState 호출 횟수 — 앱 시작 시 몇 번 호출되는지
grep -rn "initTeamState" src/ --include="*.js" --include="*.jsx" -n
```

### 브라우저 콘솔 진단

```js
// App.jsx 또는 AppShell의 최상위 useEffect에 추가
console.log('[App] render', { authLoading, connected, snapshotRestored, currentTeamId });

// loadAll 함수 진입점에 추가
console.log('[loadAll] called', new Error().stack.split('\n').slice(1,4).join(' ← '));

// onAuthStateChange 핸들러에 추가
console.log('[Auth] event:', event, 'session:', !!session);
```

**콘솔에서 `[loadAll] called`가 2회 이상 나오면, 호출 스택을 추적하여 어디서 중복 호출되는지 확인.**

---

## 수정 Phase

진단 결과에 따라 아래 수정을 적용한다.

### Fix 1: TOKEN_REFRESHED 이벤트 분기

```js
// onAuthStateChange 핸들러
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    // 세션만 갱신하고, initTeamState/loadAll 재실행하지 않음
    set({ session });
    return;
  }
  if (event === 'SIGNED_IN') {
    // 여기서만 initTeamState + loadAll 실행
    initTeamState(session);
  }
  // ...
});
```

### Fix 2: SW reload 제거

```js
// sw.js 또는 SW 등록부에서 location.reload() 호출이 있으면 제거
// 대신 토스트로 "새 버전이 있습니다. 새로고침하세요" 알림
```

### Fix 3: loadAll 중복 호출 방지

```js
// loadAll에 실행 중 플래그 추가
let _loadAllRunning = false;
const loadAll = async () => {
  if (_loadAllRunning) {
    console.log('[loadAll] skipped — already running');
    return;
  }
  _loadAllRunning = true;
  try {
    // ... 기존 로직
  } finally {
    _loadAllRunning = false;
  }
};
```

### Fix 4: useEffect 의존성 배열 정리

```js
// 의존성에 session 객체 자체가 있으면 매 토큰 갱신마다 재실행됨
// session 대신 boolean (!!session 또는 isAuthenticated)을 의존성으로 사용
useEffect(() => {
  if (isAuthenticated) { loadAll(); }
}, [isAuthenticated]);  // ← session 객체가 아닌 boolean
```

---

## 수정 원칙

1. **이중 로딩 원인을 먼저 해결하고, DnD 유실은 자연 해결을 확인한다.** 이중 로딩이 없어지면 낙관적 업데이트가 덮어씌워지는 문제도 함께 사라질 가능성이 높다.
2. **`loadAll()` 호출 횟수를 콘솔로 반드시 확인한다.** 수정 전 N회 → 수정 후 1회 확인.
3. **진단 console.log는 수정 완료 후 반드시 제거한다.**
4. **updateTask(id, patch) 시그니처 엄수.**
5. **기존 동작(폴링, 스냅샷 복원, 팀 모드 전환)이 깨지지 않게 한다.**

---

## 검증 체크리스트

### 핵심 검증
- [ ] 앱 접속 시 화면이 한 번만 로딩됨 (이중 로딩 없음)
- [ ] 콘솔에서 `[loadAll]` 호출이 1회만 기록됨
- [ ] 매트릭스 뷰 DnD 카테고리 이동 후 카드가 이동된 위치에 유지됨
- [ ] 매트릭스 뷰 DnD 이동 후 새로고침해도 이동 상태 유지 (DB 저장 확인)
- [ ] 하이라이트 색상(빨간 강조 등)이 첫 로딩에서 즉시 표시됨

### 회귀 검증
- [ ] 팀 모드 ↔ 개인 모드 전환 정상
- [ ] 팀원 초대 후 데이터 로드 정상
- [ ] 탭 비활성 → 재활성 시 폴링 재개 + loadAll() 정상
- [ ] 새로고침(F5) 후 모든 데이터 정상 표시
- [ ] iOS PWA 콜드스타트 시 스냅샷 복원 정상
- [ ] 로그아웃 → 재로그인 시 정상 동작
- [ ] `npm run build` 성공

---

## 주의사항

1. **이 버그는 Loop-28에서 진단되었으나 완전 수정이 확인되지 않은 것이다.** Loop-28 수정사항이 코드에 실제로 적용되었는지 먼저 확인하라.
2. **snapshot 복원 흐름을 건드리면 iOS PWA 콜드스타트가 깨질 수 있다.** `snapshotRestored` 플래그와 관련 useEffect를 수정할 때 극히 주의하라.
3. **이중 로딩 원인이 여러 개 동시에 존재할 수 있다.** 하나 고쳐서 나아졌다고 끝내지 말고, 모든 원인을 확인하라.

---

## 작업 내역

(작업 완료 후 기록)
