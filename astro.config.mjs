// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 콘텐츠 파일에서 urlSlug → lastmod 매핑을 생성한다.
 * @astrojs/sitemap의 serialize 콜백은 Astro 빌드 파이프라인 외부이므로
 * getCollection() 대신 fs로 직접 frontmatter를 파싱한다.
 * 글 주소는 frontmatter의 urlSlug에 저장된 값이다 (src/utils/slugs.ts 참고).
 */
function buildLastmodMap() {
  const postsDir = path.resolve('./src/content/posts');
  /** @type {Map<string, string>} urlSlug → lastmod ISO string */
  const lastmodMap = new Map();
  const cleanValue = (s) => s.trim().replace(/^["']|["']$/g, '');

  for (const category of fs.readdirSync(postsDir)) {
    const catDir = path.join(postsDir, category);
    if (!fs.statSync(catDir).isDirectory()) continue;
    for (const file of fs.readdirSync(catDir)) {
      if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
      const content = fs.readFileSync(path.join(catDir, file), 'utf-8');
      const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmMatch) continue;
      const fm = fmMatch[1];

      const slugMatch = fm.match(/^urlSlug:\s*(.+)$/m);
      const pubMatch = fm.match(/^pubDate:\s*(.+)$/m);
      const updMatch = fm.match(/^updatedDate:\s*(.+)$/m);
      const draftMatch = fm.match(/^draft:\s*(.+)$/m);

      if (!slugMatch || !pubMatch) continue;
      if (draftMatch && draftMatch[1].trim() === 'true') continue;

      const lastmod = new Date(cleanValue((updMatch ?? pubMatch)[1]));
      lastmodMap.set(cleanValue(slugMatch[1]), lastmod.toISOString());
    }
  }
  return lastmodMap;
}

const lastmodMap = buildLastmodMap();

// https://astro.build/config
export default defineConfig({
  site: 'https://hey00507.github.io',
  integrations: [sitemap({
    filter(page) {
      // 태그 페이지는 noindex이므로 sitemap에서도 제외
      return !page.includes('/tags/');
    },
    serialize(item) {
      const url = item.url;

      // 포스트 페이지: /posts/{slug}/
      const postMatch = url.match(/\/posts\/([^/]+)\/$/);
      if (postMatch) {
        const slug = postMatch[1];
        const lastmod = lastmodMap.get(slug);
        return { ...item, lastmod: lastmod ?? undefined, changefreq: 'monthly', priority: 0.8 };
      }

      // 홈
      if (url.endsWith('.github.io/') || url.endsWith('.github.io')) {
        return { ...item, changefreq: 'daily', priority: 1.0 };
      }

      // 카테고리 페이지: /dev/
      if (/\/dev\/$/.test(url)) {
        return { ...item, changefreq: 'weekly', priority: 0.6 };
      }

      // 페이지네이션
      if (/\/\d+\/$/.test(url)) {
        return { ...item, changefreq: 'daily', priority: 0.3 };
      }

      // 기타 (about, archive 등)
      return { ...item, changefreq: 'monthly', priority: 0.3 };
    },
  })],
  markdown: {
    // 한글 조사 앞뒤에서 따옴표 방향을 잘못 바꾸는 일이 있어 자동 변환을 끈다
    smartypants: false,
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'tokyo-night',
      },
    },
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
