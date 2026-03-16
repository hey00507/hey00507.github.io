import { getCollection } from 'astro:content';

/**
 * 공개 가능한 글만 필터링 (draft 제외 + 미래 pubDate 제외)
 *
 * frontmatter의 pubDate는 KST 기준으로 작성되지만 YAML 파서가 UTC로 해석한다.
 * 비교 시 현재 시각에 +9시간을 더해 KST 기준으로 판정한다.
 */
export async function getPublishedPosts() {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const nowAsKST = new Date(Date.now() + KST_OFFSET_MS);
  return (await getCollection('posts')).filter(
    (p) => !p.data.draft && p.data.pubDate <= nowAsKST,
  );
}
