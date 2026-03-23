---
title: "Astro 블로그 v1 완성 — SEO, 반응형, WebP, PWA까지 하루 만에"
description: "sitemap 최적화, 구조화 데이터, WebP 자동 변환, Service Worker까지. 개인 블로그를 검색엔진과 모바일에 제대로 대응시킨 과정을 정리한다."
category: "dev"
subcategory: "til"
tags: ["astro", "seo", "pwa", "webp", "블로그", "performance"]
pubDate: 2026-03-23T22:00:00
series: "블로그 구축기"
---

블로그를 만든 지 열흘 정도 됐다. 글은 19개까지 늘었는데, 문득 궁금해서 Google Search Console에 들어가 봤다. 인덱싱된 페이지가 0개. sitemap은 있었지만 `lastmod`가 빠져 있어서 구글 크롤러 입장에서는 "이 페이지가 언제 바뀐 건지" 알 수가 없는 상태였다.

SEO를 고치려고 앉았다가, 결국 404 페이지, 읽기 진행률 바, WebP 변환, PWA까지 하루 만에 12개 커밋을 쏟아냈다. 블로그 인프라를 v1으로 마무리한 기록이다.

## SEO — 검색엔진에 제대로 알려주기

### sitemap에 lastmod 넣기

Astro의 `@astrojs/sitemap`은 기본적으로 URL 목록만 만들어준다. 그런데 검색엔진 크롤러가 "이 페이지를 다시 방문해야 하나?"를 판단하려면 `lastmod`(마지막 수정일)가 있어야 한다. 없으면 크롤러가 우선순위를 매길 근거가 없어서 인덱싱이 느려진다.

`serialize` 콜백에서 각 URL의 성격에 따라 다른 값을 넣었다.

```javascript
// astro.config.mjs
sitemap({
  serialize(item) {
    const slug = item.url.replace(site, '').replace(/\/$/, '');

    if (lastmodMap[slug]) {
      item.lastmod = lastmodMap[slug];
      item.changefreq = 'monthly';  // 포스트는 자주 안 바뀌니까
      item.priority = 0.8;
    }
    else if (slug === '') {
      item.changefreq = 'daily';    // 홈은 새 글마다 바뀌니까
      item.priority = 1.0;
    }
    else if (['dev', 'reading', 'essay'].includes(slug)) {
      item.changefreq = 'weekly';   // 카테고리 페이지
      item.priority = 0.6;
    }
    return item;
  }
})
```

여기서 삽질이 하나 있었다. `serialize` 콜백은 Astro 빌드 파이프라인 바깥에서 실행되기 때문에 Content Collection API를 쓸 수 없다. 그래서 빌드 전에 마크다운 파일을 직접 `fs`로 읽어서 frontmatter의 날짜를 파싱하는 방식으로 `lastmodMap`을 만들었다. 그런데 일부 마크다운이 CRLF 줄바꿈이라 파싱이 깨졌고, 정규식을 `\r?\n`으로 바꿔서 해결했다.

### 구조화 데이터 — 검색 결과를 예쁘게

검색 결과에서 그냥 제목+URL만 나오는 것과, 작성자/날짜/경로가 함께 나오는 건 클릭률 차이가 크다. 이걸 가능하게 해주는 게 JSON-LD 구조화 데이터다.

사이트 전체에는 `WebSite` 스키마를, 각 포스트에는 `BlogPosting` + `BreadcrumbList` 스키마를 넣었다. 카테고리/아카이브 페이지에는 `CollectionPage`를 적용했다.

```javascript
// 포스트 페이지 — BlogPosting 스키마
{
  '@type': 'BlogPosting',
  headline: title,
  datePublished: pubDate.toISOString(),
  dateModified: updatedDate?.toISOString(),
  author: { '@type': 'Person', name: 'Ethan Kim' },
}
```

`BreadcrumbList`는 `홈 → 카테고리 → 글 제목` 3단계로 구성했다. Google 검색 결과에 이 경로가 표시되면 사용자가 사이트 구조를 한눈에 파악할 수 있다.

### 메타 태그와 캐시

태그/아카이브 페이지에 `description` 메타 태그가 빠져 있었다. 검색엔진이 자동으로 만들어주긴 하지만, 직접 쓴 설명이 훨씬 정확하다. 각 페이지 성격에 맞는 description을 추가했다.

`Cache-Control: no-cache`도 기본으로 걸려 있었는데 제거했다. GitHub Pages 같은 정적 사이트에서 캐시를 꺼놓으면 매번 전체 리소스를 다시 받게 되니까, 오히려 성능만 나빠진다.

## UX — 작지만 신경 쓰이는 것들

### 404 페이지

Astro는 `src/pages/404.astro` 파일만 만들면 자동으로 404를 처리해준다. 기본 404는 너무 허전해서, "페이지를 찾을 수 없습니다" 메시지와 함께 홈/아카이브로 돌아가는 링크를 넣었다. 방문자가 막다른 길에서 헤매지 않도록.

### 읽기 진행률 바

긴 글을 읽을 때 "지금 어디쯤 읽고 있지?" 싶을 때가 있다. 포스트 페이지 상단에 가로 진행률 바를 추가했다. 목록 페이지에서는 안 보이고, 포스트에서만 나온다.

스크롤 이벤트를 직접 핸들러에 걸면 매 픽셀마다 호출되니까 성능이 안 좋다. `requestAnimationFrame`으로 감싸서 한 프레임에 한 번만 계산하도록 했다.

### Back-to-Top & Skip-to-Content

맨 위로 올라가는 버튼은 `scrollY > 400px`일 때만 나타나도록 했다. 짧은 페이지에서는 필요 없으니까.

Skip-to-Content는 키보드 사용자를 위한 접근성 링크다. 평소에는 화면에 안 보이지만 Tab을 누르면 나타나서 본문으로 바로 점프할 수 있다. 화면 리더 사용자가 헤더 내비게이션을 매번 넘기지 않아도 되도록.

## 성능 — WebP 자동 변환

블로그 이미지가 대부분 JPEG/PNG인데, WebP로 바꾸면 평균 70% 정도 용량이 줄어든다. 매번 수동으로 변환하는 건 까먹기 쉬우니까, 빌드 시 자동으로 돌아가는 스크립트를 만들었다.

```javascript
// scripts/generate-webp.mjs
await sharp(imgPath)
  .webp({ quality: 80 })
  .toFile(webpPath);
```

`public/images/` 안의 모든 JPG/PNG를 순회하면서 같은 위치에 `.webp`를 생성한다. 이미 변환된 건 건너뛴다. 원본만 git에 커밋하고 WebP는 `.gitignore`에 넣어서 빌드 시마다 새로 만든다. 이렇게 하면 원본 이미지만 관리하면 되니까 편하다.

HTML에서는 `<picture>` 태그로 WebP를 우선 로드하되, 혹시 지원 안 하는 브라우저가 있으면 원본으로 대체한다.

빌드 순서도 맞춰야 했다. WebP 생성 → Astro 빌드 → PageFind 검색 인덱싱 순으로.

```json
"build": "node scripts/generate-webp.mjs && astro build && npx pagefind --site dist"
```

## 소셜 공유 버튼

포스트 하단에 공유 버튼 4개를 달았다 — X(Twitter), Facebook, 카카오톡/웹 공유, 링크 복사.

카카오톡 공유에 카카오 SDK를 쓸까 고민했는데, 그러면 앱 키 발급이 필요하고 SDK 스크립트도 불러와야 한다. 대신 `navigator.share` Web Share API를 택했다. 모바일에서는 카카오톡을 포함한 네이티브 공유 시트가 바로 뜨고, 데스크톱에서 지원 안 하면 클립보드 복사로 대체된다. 외부 의존성 없이 깔끔하게 해결.

```javascript
if (navigator.share) {
  await navigator.share({ title, url });
} else {
  await navigator.clipboard.writeText(url);
}
```

## 모바일 반응형

데스크톱에서만 확인하면서 만들다 보니 모바일에서 깨지는 부분이 꽤 있었다.

- **이미지/비디오**가 화면을 넘어감 → `max-width: 100%`로 컨테이너 안에 가두기
- **코드 블록**이 잘림 → `overflow-x: auto`로 가로 스크롤
- **테이블**도 마찬가지 → `display: block; overflow-x: auto`
- **이미지 갤러리** → 데스크톱에서는 나란히(50%), 모바일에서는 세로 스택(100%)
- **헤더** → 데스크톱은 hover 드롭다운, 모바일은 햄버거 메뉴 + 아코디언

모바일 헤더는 아코디언으로 구현했다. 상위 메뉴를 탭하면 하위 메뉴가 펼쳐지면서 Chevron 아이콘이 회전한다. Escape 키로도 닫을 수 있고, `aria-expanded`로 스크린 리더 접근성도 챙겼다.

## PWA — 오프라인에서도 읽기

정적 블로그에 PWA가 필요할까? 고민했는데, 한 번 읽은 글을 지하철에서 다시 보고 싶을 때가 있다면 충분히 가치 있다고 생각했다. Service Worker 하나만 추가하면 되니까 비용도 작다.

HTML 요청은 **Network First** — 네트워크가 되면 최신 페이지를, 안 되면 캐시에서, 그것도 없으면 오프라인 안내 페이지를 보여준다. CSS/JS/이미지 같은 정적 리소스는 **Cache First** — 한 번 받으면 캐시에서 바로 제공한다. 자주 안 바뀌는 리소스를 매번 네트워크로 받을 이유가 없다.

```javascript
// sw.js
const APP_SHELL = ['/', '/offline/', '/favicon.svg', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
  );
});
```

오프라인 페이지는 "이전에 방문한 페이지는 오프라인에서도 볼 수 있어요"라는 안내와 함께 캐시된 홈 링크를 제공한다.

## 마무리 — 그리고 3월 안에 해결할 것

하루 만에 12개 커밋. SEO를 고치려다 모멘텀이 붙어서 UX, 성능, PWA까지 한 번에 밀어붙였다.

Google Search Console에 sitemap을 제출하고 Naver에도 등록했는데, 아직 두 곳 다 인덱싱이 안 됐다. sitemap 제출 후 보통 2~7일 걸린다고 하니까 조금 기다려봐야 한다. **3월이 끝나기 전에 Google과 Naver 검색에서 내 블로그가 나오는 걸 확인하는 게 목표다.** 만약 자동 인덱싱이 안 되면 URL 검사 도구로 수동 요청이라도 넣어볼 생각이다.

이제 인프라는 v1으로 마무리. 앞으로는 포스팅에 집중할 차례다.

다음 글에서는 Claude를 개인 PT 코치로 만든 `/coach` 스킬 이야기를 다뤄보겠다.
