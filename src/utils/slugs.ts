import type { CollectionEntry } from 'astro:content';

/**
 * 글 주소(`/posts/{urlSlug}/`)는 frontmatter의 `urlSlug`에 저장된 값을 그대로 쓴다.
 *
 * 예전에는 pubDate로 매 빌드마다 다시 계산했는데, 같은 날 글을 추가하거나 지우면
 * 이미 공개된 글의 주소가 바뀌었다. 주소는 발행할 때 한 번 정하고 바꾸지 않는다.
 * 반환: { postId → urlSlug } 매핑
 */
export function buildSlugMap(posts: CollectionEntry<'posts'>[]): Map<string, string> {
  const map = new Map<string, string>();
  const owner = new Map<string, string>();

  for (const post of posts) {
    const slug = post.data.urlSlug;
    const other = owner.get(slug);
    if (other) {
      throw new Error(`urlSlug "${slug}" 가 중복됩니다: ${other}, ${post.id}`);
    }
    owner.set(slug, post.id);
    map.set(post.id, slug);
  }

  return map;
}
