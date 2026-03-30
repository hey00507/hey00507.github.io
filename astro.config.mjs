// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 콘텐츠 파일에서 pubDate/updatedDate를 읽어 slug → lastmod 매핑을 생성한다.
 * @astrojs/sitemap의 serialize 콜백은 Astro 빌드 파이프라인 외부이므로
 * getCollection() 대신 fs로 직접 frontmatter를 파싱한다.
 */
function buildLastmodMap() {
  const postsDir = path.resolve('./src/content/posts');
  /** @type {{ pubDate: Date, updatedDate?: Date, draft?: boolean, filePath: string }[]} */
  const entries = [];

  for (const category of fs.readdirSync(postsDir)) {
    const catDir = path.join(postsDir, category);
    if (!fs.statSync(catDir).isDirectory()) continue;
    for (const file of fs.readdirSync(catDir)) {
      if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
      const content = fs.readFileSync(path.join(catDir, file), 'utf-8');
      const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmMatch) continue;
      const fm = fmMatch[1];

      const pubMatch = fm.match(/^pubDate:\s*(.+)$/m);
      const updMatch = fm.match(/^updatedDate:\s*(.+)$/m);
      const draftMatch = fm.match(/^draft:\s*(.+)$/m);

      if (!pubMatch) continue;
      if (draftMatch && draftMatch[1].trim() === 'true') continue;

      const cleanDate = (s) => s.trim().replace(/^["']|["']$/g, '');
      entries.push({
        pubDate: new Date(cleanDate(pubMatch[1])),
        updatedDate: updMatch ? new Date(cleanDate(updMatch[1])) : undefined,
        filePath: `${category}/${file}`,
      });
    }
  }

  // slugs.ts와 동일한 로직으로 slug 생성
  entries.sort((a, b) => a.pubDate.valueOf() - b.pubDate.valueOf());
  /** @type {Map<string, typeof entries>} */
  const byDate = new Map();
  for (const e of entries) {
    const d = e.pubDate;
    const dateKey = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey).push(e);
  }

  /** @type {Map<string, string>} slug → lastmod ISO string */
  const lastmodMap = new Map();
  for (const [dateKey, datePosts] of byDate) {
    if (datePosts.length === 1) {
      const e = datePosts[0];
      lastmodMap.set(dateKey, (e.updatedDate ?? e.pubDate).toISOString());
    } else {
      datePosts.forEach((e, i) => {
        lastmodMap.set(`${dateKey}-${i + 1}`, (e.updatedDate ?? e.pubDate).toISOString());
      });
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

      // 카테고리 페이지: /dev/, /reading/, /essay/
      if (/\/(dev|reading|essay)\/$/.test(url)) {
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
