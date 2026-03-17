---
title: "프로세스 생명주기와 터미널 프로토콜 — 브라우저 터미널 구현 삽질기"
description: "Claude Dashboard에 node-pty + xterm.js 브라우저 터미널을 구현하면서 만난 Orphan Process, Zombie Process, Kitty Protocol, CSS hidden 함정까지 정리"
category: "dev"
subcategory: "til"
tags: ["node-pty", "xterm", "kitty-protocol", "unix-process", "macos", "css"]
series: "Claude Dashboard 개발기"
pubDate: 2026-03-17T18:06:00
draft: false
---

Claude Dashboard에 브라우저 터미널을 넣기로 했다. `node-pty`로 PTY를 만들고, WebSocket으로 연결하고, `xterm.js`로 렌더링하면 끝일 줄 알았는데 — 하루 종일 버그와 싸웠다.

오늘 만난 문제들을 정리한다.

---

## 1. Unix 프로세스 상태 — Orphan, Zombie, Self-kill

CS 교과서에서만 보던 개념을 실전에서 만났다.

### Orphan Process

부모 프로세스가 먼저 종료되어 **부모 없이 남은 자식 프로세스**. Unix 커널이 init(PID 1)에게 입양시킨다 (`reparenting`).

```
Parent (PID 100) ──fork──▶ Child (PID 200)
       │                        │
   exit(0)                  still running
       ✗                        │
                          reparented → init (PID 1)
```

**실전 사례**: 대시보드 서버를 재시작하면 PTY로 생성한 claude 프로세스가 부모(서버)를 잃고 남아있었다. 세션 파일에는 `ptyId`가 기록돼 있는데 메모리에는 없어서, 프론트엔드가 없는 PTY에 무한 재연결을 시도했다. 서버 시작 시 이전 PTY 세션을 자동 정리하는 로직을 추가해서 해결.

### Zombie Process

실행은 끝났지만 부모가 `wait()` / `waitpid()`로 **exit status를 수거하지 않아** 프로세스 테이블에 `<defunct>`로 남은 상태.

```
Parent (PID 100) ──fork──▶ Child (PID 200)
                                │
                            exit(0)
                                │
                          zombie <defunct>  ← wait() 안 불림
```

리소스는 거의 안 쓰지만 PID 슬롯을 점유한다. `SIGCHLD` 핸들러에서 `waitpid()`를 호출해야 정리됨. 다행히 node-pty는 `onExit` 콜백에서 자동 수거해준다.

### Self-kill — 서버가 자기 자신을 종료한 사건

오늘의 하이라이트. 세션 종료 기능에서 `ps aux | grep claude`로 대상 프로세스를 찾았는데, `claude-dash`(대시보드 서버 자체)도 `claude` 문자열을 포함하고 있었다. 서버가 자기 자신에게 `SIGTERM`을 보내서 죽어버렸다.

```c
kill(getpid(), SIGTERM);  // 의도치 않은 자기 종료
```

**해결**: `ps -eo pid,comm`에서 `comm` 필드(실행 파일명)가 정확히 `claude`인 것만 매칭하고, 자기 PID는 제외하도록 수정.

---

## 2. Kitty Keyboard Protocol — 터미널에서 키가 안 먹히는 이유

브라우저 터미널에서 Claude Code를 실행했더니 `[12621;9u]` 같은 이상한 문자가 출력되고 키 입력이 안 됐다.

### 원인

현대 터미널 앱(Ghostty, Kitty, WezTerm 등)은 **Kitty keyboard protocol**을 지원한다. Claude Code는 시작 시 터미널에 "너 뭘 지원해?" 하고 물어본다:

```
앱 → 터미널:  ESC[c          (DA1: 기능 조회)
터미널 → 앱:  ESC[?62;22c    (VT220 호환 응답)

앱 → 터미널:  ESC[?u          (Kitty 지원 여부)
터미널 → 앱:  ESC[?0u         (미지원)

앱 → 터미널:  ESC[>1u         (Kitty 모드 활성화)
```

실제 터미널(Ghostty 등)은 DA1에 자동 응답하지만, xterm.js → WebSocket → 서버 구조에서는 **아무도 응답하지 않았다**. Claude Code는 응답 없이도 Kitty 모드를 켜버리고, xterm.js는 Kitty 형식을 모르니 raw escape sequence가 그대로 출력됐다.

### 해결

PTY wrapper에서 출력 스트림을 감시하여 쿼리를 감지하고 서버 측에서 자동 응답:

```typescript
ptyProcess.onData((data) => {
  if (data.includes('\x1b[c'))  ptyProcess.write('\x1b[?62;22c');  // DA1
  if (data.includes('\x1b[>c')) ptyProcess.write('\x1b[>0;0;0c');  // DA2
  if (data.includes('\x1b[?u')) ptyProcess.write('\x1b[?0u');      // Kitty
});
```

교훈: 웹 터미널을 만들 때, 실제 터미널이 암묵적으로 처리하는 **프로토콜 핸드셰이크**가 꽤 많다. PTY wrapper에서 이걸 대신해줘야 한다.

---

## 3. PTY (Pseudo-Terminal) 아키텍처

웹 터미널의 데이터 흐름은 생각보다 깊다:

```
[Browser]          [Server]              [OS]
 xterm.js  ←WS→  terminal.ts  ←pipe→  node-pty  ←→  /bin/zsh → claude
  (render)        (route)              (PTY)         (shell)    (app)
```

### Scrollback Buffer

WebSocket이 끊겼다 재연결되면 이전 터미널 내용이 사라진다. tmux/screen과 같은 원리로 서버 측에 링 버퍼를 둬서 재연결 시 복원:

```typescript
const MAX_SCROLLBACK = 5000;
session.scrollback.push(data);
if (session.scrollback.length > MAX_SCROLLBACK) {
  session.scrollback.splice(0, session.scrollback.length - MAX_SCROLLBACK);
}
```

### node-pty spawn-helper 권한 문제

`npm install` 후 `posix_spawnp failed` 에러가 난다면, prebuild 바이너리(`spawn-helper`)의 실행 권한이 누락된 것. `chmod +x`로 해결. `postinstall` 스크립트에 넣어두면 편하다.

---

## 4. CSS `hidden` 속성의 함정

터미널 그리드 뷰를 `hidden` 속성으로 숨겨뒀는데, 페이지를 열면 항상 보였다.

```html
<section class="grid-view" hidden>  <!-- hidden = display:none -->
```

```css
.grid-view { display: flex; }  /* specificity가 높아 hidden을 무시! */
```

CSS의 `display: flex`가 HTML `hidden` 속성의 `display: none`보다 우선순위가 높다. `hidden`은 시맨틱 래퍼일 뿐, CSS specificity 규칙을 따른다.

**해결**: `[hidden]` attribute selector로 명시적 처리:

```css
.grid-view[hidden] { display: none !important; }
.grid-view:not([hidden]) { display: flex; }
```

---

## 5. macOS에서 프로세스 cwd 추적의 한계

프로세스 스캐너에서 "이 claude 프로세스가 어떤 디렉토리에서 실행 중인지" 알아내려 했다.

- **Linux**: `/proc/PID/cwd` 심볼릭 링크로 정확히 알 수 있다
- **macOS**: `/proc`가 없다. `lsof -p PID -d cwd`를 시도했는데, 해당 PID뿐 아니라 **시스템 전체 프로세스의 cwd**를 반환했다

결국 cwd 매칭을 포기하고, claude 프로세스 존재 여부(`ps`)만 확인하는 보수적 전략으로 전환. 세션 매칭은 hook 이벤트의 메타데이터에 의존하는 것이 macOS에서는 안정적이다.

---

## 정리

| 문제 | 원인 | 해결 |
|------|------|------|
| 서버 자체 종료 | `grep claude`가 서버 자신 매칭 | `comm` 필드 정확 매칭 + PID 제외 |
| 터미널 입력 불가 | Kitty protocol DA1 미응답 | PTY에서 자동 응답 |
| PTY 연결 실패 | `~/` tilde 미확장 | `os.homedir()` 치환 |
| 대시보드 깨짐 | CSS display:flex가 hidden 무시 | `[hidden]` + `!important` |
| 세션 상태 오류 | macOS lsof 부정확 | 프로세스 존재 여부만 확인 |

브라우저 터미널이라는 하나의 기능을 넣는데, OS 프로세스 관리부터 터미널 프로토콜, CSS specificity까지 건드리게 될 줄은 몰랐다. 하나를 깊이 파면 결국 전부 연결돼 있다.
