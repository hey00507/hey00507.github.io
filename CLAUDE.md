# Blog Writing Rules

> **글 문체/톤/표현 규칙은 [WRITING_STYLE.md](./WRITING_STYLE.md)를 반드시 참조한다.**
> 이 파일은 구조(카테고리, frontmatter, 이미지 경로, 영상)만 다루고, 글쓰기 스타일은 WRITING_STYLE.md에서 관리한다.

## 카테고리 & 소카테고리

기술 블로그다. 일상 글(일기·운동·주간 회고·서평)은 네이버 블로그에 쓰고 여기에는 올리지 않는다.

| category | subcategory | slug | 메뉴 이름 | 용도 |
|----------|-------------|------|----------|------|
| dev | work | `/dev/work/` | 업무·문제 해결 | 회사 업무에서 푼 문제 |
| dev | project | `/dev/project/` | 개인 프로젝트 | 사이드 프로젝트 개발기 |
| dev | til | `/dev/til/` | 공부 | 개념 정리, 학습 기록 |

`til`(공부)은 아직 글이 없어 메뉴에서 숨겨 두었다. 첫 글을 올릴 때 `src/utils/subcategories.ts`의 주석을 풀어 다시 켠다.

## 브랜치·커밋·배포

`main`에 push하면 GitHub Actions가 바로 배포한다. 그래서 `main`에는 직접 커밋하지 않는다.

| 작업 | 브랜치 | 예시 |
|------|--------|------|
| 새 글 기고 | `write` | 글 작성, 이미지 추가 |
| 기존 글·페이지 수정 | `edit` | 오탈자, 문장 수정, About 수정 |
| 구조 개선·인프라 변경 | 내용에 맞는 이름 | `tech-blog-cleanup`, `ci-build-check` |

- 브랜치는 `main`에서 새로 만들고, `main`에 합친 뒤 지운다. 다음 작업 때 같은 이름으로 다시 만든다 (오래 두면 `main`과 어긋난다)
- 작업 단위마다 바로 커밋한다. push는 모아서 한 번에 해도 된다
- `main`에 합치기 전에 `pnpm build`가 통과하는지 확인한다
- push와 `main` 병합은 사용자 확인을 받고 한다

## 글 제목 규칙

| 유형 | 제목 형식 | 예시 |
|------|----------|------|
| 개발 | 자유 | HabitFlow — SwiftUI + Firebase로 습관 트래커 만들기 |

## Frontmatter 필수 사항

```yaml
---
title: "제목"
description: "1~2줄 설명"
category: "dev"            # dev 고정
subcategory: "work"        # work, project, til 중 택 1 (위 표 참조)
tags: ["태그1", "태그2"]
pubDate: 2026-03-21T21:30:00  # 반드시 현재 시각의 시·분·초까지 정확히 맞출 것
urlSlug: "20260321"        # 글 주소 /posts/{urlSlug}/ — 발행할 때 한 번 정하고 절대 바꾸지 않는다
updatedDate: 2026-03-23T10:00:00  # 기존 글 수정 시 추가 (선택)
draft: false
---
```

- `urlSlug`는 필수. 발행일 `YYYYMMDD`로 정한다. 그날 이미 쓰인 값이 있으면 `-2`, `-3`을 붙인다
  - 확인: `grep -rh '^urlSlug:' src/content/posts | grep 20260321`
  - 이미 공개된 글의 `urlSlug`는 바꾸지 않는다. 글을 지워도 다른 글의 값은 그대로 둔다 (주소·조회수·댓글이 이 값에 묶여 있다)
  - 중복이거나 빠지면 빌드가 실패한다

- `pubDate`는 반드시 **글 작성 시점의 현재 시각**(시·분·초)을 `date` 명령으로 확인하여 설정 (미래 시간이면 글이 안 보임, 임의의 시간 금지)
- `subcategory`는 반드시 위 표의 slug 값 사용
- `updatedDate`는 기존 글을 수정할 때 추가 — sitemap lastmod에 반영되어 검색엔진이 변경을 감지

## 이미지 규칙

- 경로: `public/images/{카테고리별}/`
  - 개발 스크린샷: `public/images/dev/`
  - 일기/에세이 이미지: `public/images/diary/`
  - 포스트별 묶음: `public/images/posts/{slug}/`
  - 독서 이미지: `public/images/reading/`
- 압축: `sips -s formatOptions 60 -Z 800` (JPEG 60%, 최대 800px)
- HEIC/PNG → JPEG 변환: `sips -s format jpeg`
- 크기 제한: 원본 대신 적절한 `max-width` 지정 (보통 200~350px)
- alt 텍스트: 반드시 의미 있는 설명 포함
- 이미지 주석(캡션): WRITING_STYLE.md의 "이미지 주석" 섹션 참조
- WebP 자동 변환: 빌드 시 `scripts/generate-webp.mjs`가 jpg/jpeg/png → webp 자동 생성. 원본만 커밋하면 됨 (webp는 .gitignore)

## 영상 규칙

- 형식: MP4 (MOV는 ffmpeg으로 변환)
- 오디오 불필요 시: `ffmpeg -i input.mp4 -an -c:v copy output.mp4`
- MOV→MP4 변환: `ffmpeg -i input.MOV -c:v libx264 -crf 28 -preset medium -c:a aac -movflags +faststart -vf "scale='min(720,iw)':-2" output.mp4`
- 영상 썸네일: ffmpeg으로 첫 프레임 캡처하여 `heroImage` 또는 본문 `<img>` 삽입
  - `ffmpeg -i video.mp4 -vframes 1 -q:v 2 thumbnail.jpeg`
- 영상 태그: `<video>` 사용, `autoplay loop muted playsinline` 속성 필수

## PostCard 썸네일

- 블로그 PostCard에 썸네일이 표시됨 (본문 첫 `<img>` 또는 `heroImage`)
- 다른 레포/외부 URL 이미지를 참조하면 빌드 시 깨질 수 있음 → 반드시 `public/images/` 내부 경로 사용

### 이미지 글의 heroImage 중복 방지

- **heroImage와 본문 첫 이미지가 동일한 경우**:
  - frontmatter에 `heroImageOnly: true` 추가 → PostCard 썸네일로만 사용, 본문에서는 heroImage 자동 표시 숨김
  - 본문의 `<img>` 태그는 그대로 유지 — 캡션과 함께 원하는 위치에 표시
  - heroImage를 별도로 지정하지 않으면 본문 첫 `<img>`가 자동으로 썸네일이 되므로, 이 경우 heroImage를 아예 생략해도 된다

### 영상 글의 썸네일 처리

- **본문에 영상만 있는 경우** (이미지 없음):
  - 영상에서 중요해 보이는 장면을 캡처하여 썸네일 생성: `ffmpeg -i video.mp4 -vframes 1 -q:v 2 thumbnail.jpeg`
  - `heroImage`에 캡처 이미지 경로 지정
  - frontmatter에 `heroImageOnly: true` 추가 → PostCard 썸네일로만 사용, 본문에서는 자동 숨김
  - PostCard에서는 `heroImage`로 썸네일 표시, 본문에서는 영상만 보임

- **본문에 이미지 + 영상이 함께 있는 경우**:
  - 별도 지정이 없으면 **첫 번째 이미지**를 `heroImage`(썸네일)로 지정
  - 본문에 이미지가 자연스럽게 보이므로 `display:none` 불필요
