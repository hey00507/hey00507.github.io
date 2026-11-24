---
# gstack: design-md-format=spec
name: Ethan Devlog
description: 꾸밈 없이 글과 기록만 남기는 작업 기록장. 차분한 종이 바탕에 명조 제목, 고정폭 기록, 초록 강조 하나.
colors:
  surface: "#FBFBFA"
  surface-raised: "#F2F3F2"
  text: "#17191C"
  text-muted: "#5F6670"
  border: "#E3E5E8"
  accent: "#0E7A53"
  on-accent: "#FBFBFA"
  accent-tint: "#E4F2EC"
  code-surface: "#F3F4F4"
  success: "#0E7A53"
  info: "#2F6FB0"
  warning: "#A15C00"
  error: "#C0362C"
  surface-dark: "#111416"
  surface-raised-dark: "#1A1E21"
  text-dark: "#E8EAEC"
  text-muted-dark: "#9AA3AD"
  border-dark: "#2A3035"
  accent-dark: "#4CC38A"
  on-accent-dark: "#111416"
  accent-tint-dark: "#16302A"
  code-surface-dark: "#1A1E21"
  success-dark: "#4CC38A"
  info-dark: "#7FB2E5"
  warning-dark: "#E0A64A"
  error-dark: "#F0857B"
typography:
  display:
    fontFamily: Noto Serif KR
    fontWeight: 700
    fontSize: clamp(1.75rem, 5vw, 2.375rem)
    lineHeight: 1.35
    letterSpacing: -0.02em
  heading:
    fontFamily: Noto Serif KR
    fontWeight: 700
    fontSize: 1.5625rem
    lineHeight: 1.4
    letterSpacing: -0.01em
  list-title:
    fontFamily: Noto Serif KR
    fontWeight: 700
    fontSize: 1.3125rem
    lineHeight: 1.45
    letterSpacing: -0.01em
  body:
    fontFamily: Pretendard Variable
    fontSize: 1.0625rem
    lineHeight: 1.75
  summary:
    fontFamily: Pretendard Variable
    fontSize: 0.9375rem
    lineHeight: 1.65
  label:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontFeature: tnum
  mono:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    lineHeight: 1.7
rounded:
  sm: 4px
  md: 6px
  lg: 8px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 56px
  3xl: 72px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
  button-ghost:
    backgroundColor: "transparent"
    borderColor: "{colors.border}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.md}"
  code-block:
    backgroundColor: "{colors.code-surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
  note:
    backgroundColor: "{colors.accent-tint}"
    rounded: "{rounded.lg}"
  post-link:
    textColor: "{colors.accent}"
  nav-link:
    textColor: "{colors.text-muted}"
  nav-link-active:
    textColor: "{colors.text}"
---

# Ethan Devlog

## Overview

**Creative North Star:** 읽기 편한 글, 그 안에서 문제를 끝까지 파고드는 사람이 보이는 블로그. 그래서 화면은 작업 기록장처럼 글과 기록만 남긴다.

**Product context:** 백엔드 개발자의 개인 기술 블로그. 업무에서 푼 문제와 개인 프로젝트 개발기를 쓴다. 독자는 검색으로 들어온 개발자와 이력서 링크로 들어온 사람이다. "보면 좋고 안 봐도 그만"이라는 태도로 운영하므로, 눈길을 끌려는 장치는 두지 않는다.

**Mode per surface:**
- 글 본문: Read
- 홈, 카테고리, 아카이브, 태그: Read (훑어보는 목록)
- About: Read
- 검색 모달: Operate

**Reference sites:** https://jvns.ca, https://brandur.org, https://overreacted.io, https://ciechanow.ski, https://toss.tech (2026-11-24 조사). 개인 블로그 세 곳 모두 글 목록이 카드가 아닌 제목 목록이고 강조색이 하나였다. 본문 크기와 줄 간격은 ciechanow.ski(19px/1.6)와 toss.tech(17px/1.6) 범위에 맞췄다.

**Key characteristics:**
- 글 목록이 카드가 아니라 날짜가 붙은 기록으로 보인다
- 제목만 명조라서 "읽는 글"이라는 인상이 먼저 온다
- 날짜, 읽는 시간, 태그는 고정폭 글꼴로 조용히 놓인다
- 색은 초록 하나만 눈에 띄고, 링크와 버튼에만 쓰인다

## Colors

**Strategy:** Restrained. 강조색 하나와 무채색만 쓴다. 색이 드물어야 링크와 버튼이 바로 읽힌다.

**Light or dark:** 라이트가 기본이다. 긴 글을 낮에 책상 앞 모니터로 읽는 상황이 가장 흔하기 때문이다. 다크는 시스템 설정과 수동 전환을 따라 지원한다.

- `accent`는 상호작용 신호다. 본문 링크, 주 버튼, 목록 제목의 hover, 포커스 링에만 쓴다. 장식이나 제목 색으로 쓰지 않는다.
- `accent-tint`는 본문 안의 "확인한 것" 같은 안내 상자 바탕에만 쓴다.
- 초록을 고른 이유: Tailwind 기본 파랑(`#3b82f6`)을 벗어나고, 테스트가 통과했을 때의 색이라 "운영에서 문제없이 도는 것"을 다루는 글과 맞는다.
- 무채색은 살짝 차가운 회색 계열이다. 크림색 바탕은 쓰지 않는다.
- 다크는 단순 반전이 아니다. 바탕(`surface-dark`)보다 한 단계 밝은 `surface-raised-dark`로 코드 블록과 알림을 구분하고, 강조색은 밝은 초록(`accent-dark`)으로 바꿔 대비를 유지한다.
- 의미색(`info`, `warning`, `error`)은 상태 글자에만 쓴다. 바탕을 칠하지 않는다.

## Typography

- **제목 (Noto Serif KR 700):** 사이트 이름, 글 제목, 본문 h2, 목록의 글 제목. 한글 명조는 책과 긴 글의 글꼴이라 "읽는 글"이라는 신호가 된다. 한국 개발 블로그 대부분이 고딕만 쓰는 것과 구분되는 지점이다. 기울임꼴은 쓰지 않는다.
- **본문 (Pretendard Variable):** 본문, 요약, 내비게이션, 버튼. 영문 식별자와 한글이 섞이는 기술 글에서 가장 고르게 읽힌다. 한국 웹에서 흔한 글꼴이지만 본문 역할이라 유지한다.
- **기록 (JetBrains Mono):** 날짜, 읽는 시간, 카테고리, 태그, 코드. 블로그 이름의 "log"에 해당하는 목소리다. 보통 크기로 쓰고 자간을 벌리거나 대문자로 바꾸지 않는다.
- **로딩:** Pretendard는 jsDelivr의 dynamic subset CSS(`orioncactus/pretendard@v1.3.9`)를 그대로 쓴다. Noto Serif KR(600, 700)과 JetBrains Mono(400, 500)는 Google Fonts `css2`에서 `display=swap`으로 불러온다. 2026-11-24에 세 주소 모두 응답을 확인했다.
- **크기 단계:** 글 제목 38px, h2 25px, 목록 제목 21px, 본문 17px, 요약 15px, 기록 13px. 제목과 본문은 굵기만이 아니라 크기와 글꼴로 구분한다.
- 모바일(560px 이하)에서는 본문을 16px로 줄인다.

## Layout

- 한 단 레이아웃. 본문 폭은 최대 680px, 좌우 여백 24px.
- **글 목록:** 한 줄이 두 칸이다. 왼쪽 112px 칸에 날짜, 오른쪽 칸에 제목, 한 줄 요약, 기록(카테고리와 읽는 시간). 항목 사이는 1px 선으로만 나눈다. 테두리 카드, 색 뱃지, 썸네일은 두지 않는다.
- 560px 이하에서는 날짜가 제목 위로 올라가 한 칸이 된다.
- 세로 리듬: 문단 사이 24px, h2 위 56px, 페이지 머리 위 56px, 큰 구역 사이 72px.
- 그리드를 깨는 요소는 없다. 표와 코드 블록은 폭을 넘으면 가로로 스크롤한다.

## Elevation & Depth

그림자를 쓰지 않는다. 깊이는 1px 선(`border`)과 한 단계 다른 바탕(`surface-raised`, `code-surface`)으로만 표현한다. 예외는 검색 모달 하나로, 뒤 화면을 어둡게 덮는 막 위에 뜬다. 빛나는 테두리와 흐림 효과 패널은 쓰지 않는다.

## Shapes

- `sm` 4px: 인라인 코드
- `md` 6px: 버튼, 입력창, 알림
- `lg` 8px: 코드 블록, 안내 상자, 본문 이미지
- 알약 모양(완전히 둥근) 버튼과 태그는 쓰지 않는다. 태그는 `#이름` 글자만 둔다.

## Components

- **목록의 글 제목:** 평소에는 `text`, hover에서 `accent`. 밑줄 없음.
- **본문 링크:** `accent` 색에 1px 밑줄, 밑줄 간격 3px.
- **내비게이션 링크:** 평소 `text-muted`, hover와 현재 페이지는 `text`.
- **주 버튼:** `accent` 바탕. hover에서 조금 밝아진다.
- **보조 버튼:** 투명 바탕에 `border` 선. hover에서 선이 `accent`로 바뀐다.
- **입력창:** `border` 선. 포커스에서 `accent` 2px 외곽선.
- **포커스:** 키보드로 이동할 때만 `accent` 2px 외곽선을 2px 띄워서 보인다.
- **코드 블록:** `code-surface` 바탕에 `border` 선. 구문 강조는 지금의 Shiki 이중 테마를 유지한다.
- **안내 상자:** `accent-tint` 바탕, 선 없음. 굵은 머리말 뒤에 문장이 이어진다.
- **알림:** `surface-raised` 바탕에 고정폭 상태 글자(OK, INFO, WARN, ERROR)만 의미색으로 칠한다.
- **태그:** 고정폭 `#이름`, `text-muted`. hover에서 `accent`.
- **빈 상태:** 검색 결과 없음과 글 없는 카테고리는 한 문장으로만 알린다. 그림이나 아이콘을 넣지 않는다.

## Do's and Don'ts

- Do: 강조색은 링크, 버튼, hover, 포커스에만 쓴다.
- Do: 날짜와 숫자는 JetBrains Mono에 `tabular-nums`로 쓴다.
- Do: 목록 항목은 선으로 나누고 제목이 가장 먼저 읽히게 한다.
- Do: 새 요소를 만들 때는 먼저 글자와 여백만으로 해결되는지 본다.
- Do: 라이트와 다크 양쪽에서 대비를 확인한다.
- Don't: 글 목록에 테두리 카드, 그림자, 색 뱃지를 되살리지 않는다.
- Don't: 카드 한쪽에 색 선을 긋지 않는다. 상태는 바탕색이나 글자로 알린다.
- Don't: 제목에 그라데이션, 기울임꼴, 이모지를 쓰지 않는다.
- Don't: 고정폭 글자를 아주 작게 줄이고 자간을 벌린 대문자 라벨로 쓰지 않는다.
- Don't: Tailwind 기본 파랑이나 두 번째 강조색을 추가하지 않는다.
- Don't: 제목 위에 작은 머리말(kicker)을 얹지 않는다.

## Motion

- **Approach:** minimal-functional
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** 색과 바탕 전환 150ms. 그 밖의 움직임은 없다.
- **The one authored moment:** 없다. 유일한 움직임은 라이트와 다크를 바꿀 때 바탕과 글자색이 150ms 동안 넘어가는 것이다. `prefers-reduced-motion`이면 그것도 끈다.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-11-24 | 디자인 시스템 처음 작성 | /design-consultation으로 작성. 개발 블로그 5곳 조사와 HTML 미리보기 확인을 거쳤다 |
| 2026-11-24 | 글 목록을 카드에서 기록형 목록으로 | 조사한 개인 블로그가 모두 목록형이고, 제목이 주인공이 된다. 썸네일과 색 뱃지는 포기했다 |
| 2026-11-24 | 제목을 명조(Noto Serif KR)로 | "읽는 글"이라는 인상을 준다. 글꼴 로딩이 하나 늘어난다 |
| 2026-11-24 | 강조색을 파랑에서 초록으로 | 기본 파랑을 벗어나고 글의 성격과 맞는다. OG 이미지와 theme-color를 다시 맞춰야 한다 |
| 2026-11-24 | 외부 디자인 의견은 받지 않음 | 가볍게 운영하는 블로그라 미리보기를 직접 보고 고치는 편이 빠르다 |
