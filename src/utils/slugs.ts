import type { CollectionEntry } from 'astro:content';

/**
 * pubDate 기반으로 날짜 slug를 생성한다.
 * 같은 날짜에 여러 글이 있으면 시간순으로 -2, -3 을 붙인다.
 * 반환: { postId → dateSlug } 매핑
 */
export function buildSlugMap(posts: CollectionEntry<'posts'>[]): Map<string, string> {
  const sorted = [...posts].sort((a, b) => a.data.pubDate.valueOf() - b.data.pubDate.valueOf());

  // 날짜별 그룹핑
  const byDate = new Map<string, CollectionEntry<'posts'>[]>();
  for (const post of sorted) {
    const d = post.data.pubDate;
    const dateKey = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(post);
  }

  // slug 할당
  const map = new Map<string, string>();
  for (const [dateKey, datePosts] of byDate) {
    if (datePosts.length === 1) {
      map.set(datePosts[0].id, dateKey);
    } else {
      datePosts.forEach((post, i) => {
        map.set(post.id, `${dateKey}-${i + 1}`);
      });
    }
  }

  return map;
}
