# Ethan's Blog

독서, 일상, 코딩에 대한 기록을 담는 개인 블로그.

**https://hey00507.github.io/**

## Tech Stack

| 항목 | 선택 |
|------|------|
| Framework | Astro 6 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Search | Pagefind |
| Comments | Giscus |
| OG Image | Satori + resvg |
| Deploy | GitHub Pages (GitHub Actions) |
| Analytics | GoatCounter |

## Features

- 3개 카테고리 (독서 / 일상 / 코딩) + 7개 소카테고리
- 다크/라이트 모드 (시스템 감지 + 수동 토글)
- 정적 전문 검색 (Pagefind)
- 독서 대시보드 (별점 분포, 월별 통계)
- 시리즈 네비게이션 (코딩 카테고리)
- OG 이미지 자동 생성 (카테고리별 그라데이션)
- RSS 피드, SEO, Sitemap
- 조회수 (GoatCounter)

## Project Structure

```
src/
├── components/        # UI 컴포넌트
│   ├── Header.astro          # 드롭다운 네비게이션
│   ├── PostCard.astro        # 글 카드 (소카테고리 뱃지)
│   ├── SubcategoryNav.astro  # 소카테고리 탭
│   ├── SeriesNav.astro       # 시리즈 이전/다음
│   ├── Search.astro          # Pagefind 검색
│   ├── Comments.astro        # Giscus 댓글
│   └── ThemeToggle.astro     # 다크모드 토글
├── content/posts/     # 마크다운 글
│   ├── reading/              # 독서 (서평, 독서노트)
│   ├── essay/                # 일상 (운동, 회고, 일기)
│   └── dev/                  # 코딩 (업무, TIL)
├── layouts/
│   └── BaseLayout.astro      # 공통 레이아웃 + SEO
├── pages/
│   ├── reading/              # 독서 + 소카테고리 라우팅
│   │   ├── index.astro
│   │   ├── [subcategory].astro
│   │   └── dashboard.astro
│   ├── essay/                # 일상 + 소카테고리 라우팅
│   ├── dev/                  # 코딩 + 소카테고리 + 시리즈
│   │   ├── index.astro
│   │   ├── [subcategory].astro
│   │   └── series/[name].astro
│   ├── posts/[...slug].astro # 글 상세
│   ├── og/[...slug].png.ts   # OG 이미지 생성
│   ├── tags/                 # 태그 목록/상세
│   ├── archive.astro         # 연도별 아카이브
│   └── rss.xml.ts            # RSS 피드
└── utils/
    ├── categories.ts         # 카테고리 정의
    ├── subcategories.ts      # 소카테고리 정의
    ├── readingTime.ts        # 읽기 시간 계산
    ├── formatDate.ts         # 날짜 포맷
    └── slugs.ts              # URL slug 생성
```

## Getting Started

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # 프로덕션 빌드 (dist/)
pnpm preview      # 빌드 결과 로컬 확인
```

## Writing a Post

`src/content/posts/{category}/` 에 마크다운 파일을 추가:

```yaml
---
title: "글 제목"
description: "한 줄 요약"
category: "reading"          # reading | essay | dev
subcategory: "review"        # 선택
tags: ["서평", "소설"]
pubDate: 2026-03-16
bookTitle: "책 제목"          # 독서 전용
bookAuthor: "저자"            # 독서 전용
rating: 4                    # 독서 전용 (1-5)
series: "시리즈명"            # 코딩 전용
draft: false
---
```

## Deploy

`main` 브랜치에 push하면 GitHub Actions가 자동으로 빌드 + 배포합니다.
