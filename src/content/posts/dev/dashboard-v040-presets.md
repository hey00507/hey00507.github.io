---
title: "Claude Dashboard v0.4.0 — 세션 프리셋과 3-tier Fallback"
description: "macOS에서 Claude 프로세스를 세션별로 구분하는 삽질기, 세션 색상 시스템, 그리고 컨텍스트 압축에도 살아남는 3-tier fallback 설계"
category: "dev"
pubDate: "2026-03-18T01:20:00.000Z"
tags: ["claude-code", "typescript", "fastify", "macos", "process-detection", "statusline"]
draft: false
---

[지난 글](/posts/dev/claude-dashboard)에서 Claude Multiple Dashboard의 v0.3.0까지 만든 이야기를 했다. 오늘은 v0.4.0 안정화 과정에서 겪은 기술적 문제들과, 세션 프리셋 자동화 시스템을 설계한 과정을 정리한다.

## macOS에서 Claude 프로세스 추적이 어려운 이유

대시보드의 process scanner는 30초마다 `ps`로 Claude 프로세스를 확인하고, 죽은 세션을 정리한다. 문제는 **어떤 프로세스가 어떤 세션인지** 구분하는 것이었다.

### 시도 1: lsof로 cwd 매칭 — 실패

```bash
lsof -a -d cwd -p 27448,27461,28876 -Fp -Fn
```

결과:
```
p27448 → n/Users/ethankim
p27461 → n/Users/ethankim
p28876 → n/Users/ethankim
```

모든 Claude 프로세스의 cwd가 홈 디렉토리(`~/`)다. Claude Code는 프로젝트 디렉토리가 아니라 홈에서 실행되기 때문이다. 세션 구분 불가.

### 시도 2: transcript 파일 lsof — 실패

Claude Code가 transcript `.jsonl` 파일을 열고 있을 거라 생각했지만, 원자적 쓰기(open-write-close)를 하기 때문에 `lsof`에 안 잡힌다.

### 최종 해결: PID 수 비교 + transcript mtime 랭킹

발상을 바꿨다. 프로세스를 세션에 1:1 매핑하는 대신, **수량 비교**로 접근했다.

```
top-level Claude PID 수 >= 활성 세션 수 → 모든 세션 alive
top-level Claude PID 수 < 활성 세션 수 → transcript mtime로 순위 매기고 오래된 것부터 정리
```

서브에이전트(Claude가 Agent tool로 생성한 자식 프로세스)는 parent PID가 다른 Claude인 것으로 필터링한다.

![멀티 터미널 세션](/images/posts/dashboard-v040/terminal-sessions.png)

여기에 **disconnected 유예 기간**을 추가했다. 한 번의 스캔으로 바로 ended 처리하지 않고, 먼저 `disconnected` 상태로 전환 → 다음 스캔(30초 후)에서도 여전히 매칭 안 되면 그때 `ended`로 에스컬레이션한다. 네트워크 지연이나 일시적 부하로 인한 오탐을 방지하기 위해서다.

## 세션 색상 시스템

![작업 전](/images/posts/dashboard-v040/light-overview.png)

위 스크린샷처럼, 세션이 3개만 되어도 어디가 어딘지 헷갈린다. 세션 카드에 색상을 입히기로 했다.

### CSS data-attribute 방식

inline style 대신 `data-color` attribute를 사용했다.

```css
.session-card[data-color="red"]   { background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; }
.session-card[data-color="blue"]  { background: rgba(59, 130, 246, 0.08); border-left: 3px solid #3b82f6; }
```

이렇게 하면 다크/라이트 테마별 투명도를 CSS에서 독립적으로 관리할 수 있고, JS에서는 `data-color="red"`만 넣으면 된다.

![세션 색상 적용 후](/images/posts/dashboard-v040/session-colors.png)

## 세션 프리셋: `/session-setting --save`

매번 세션을 열 때마다 `/session-setting name:대시보드 color:red`를 치는 건 번거롭다. 프로젝트 디렉토리별로 기본값을 저장해두면 자동으로 적용되게 만들었다.

```json
// ~/.claude-dashboard/config.json
{
  "sessionDefaults": {
    "/Users/me/dashboard": { "name": "대시보드", "color": "red" },
    "/Users/me/cloudpocket": { "name": "CloudPocket", "color": "blue" }
  }
}
```

서버의 `handleEvent`에서 `SessionStart` 이벤트를 받으면 `cwd`를 매칭해서 자동 적용한다. 단, 홈 디렉토리(`~/`)같은 범용 경로는 제외 — 여러 세션이 같은 cwd를 가질 수 있으니까.

## 3-tier Fallback: 컨텍스트 압축에도 살아남기

Claude Code는 컨텍스트가 가득 차면 자동으로 압축(compaction)한다. 이때 `/tmp` 파일이 유실될 수 있다. 세션 이름/색상이 날아가는 문제를 해결하기 위해 3단계 fallback을 설계했다.

```
statusline.sh 실행
  ├─ Tier 1: /tmp/claude-sessions/{id}.name  ← 빠름 (정상 시)
  ├─ Tier 2: ~/.claude-dashboard/sessions/{id}.json  ← 영구 저장
  └─ Tier 3: config.json sessionDefaults  ← 프로젝트 기본값
```

핵심은 Tier 2에서 `/tmp` 파일을 **자가 복구**하는 것이다. Tier 2에서 대시보드 JSON을 읽으면, 동시에 `/tmp` 파일을 다시 생성한다. 다음 호출부터는 다시 Tier 1(빠른 경로)로 돌아간다.

## 테스트

오늘 하루 동안 55개 → 90개로 35개 테스트를 추가했다. process scanner, session defaults, API integration 테스트가 주요 추가분이다.

---

[Claude Multiple Dashboard](https://github.com/hey00507/claude-multiple-dashboard) — npm install로 바로 쓸 수 있다.
