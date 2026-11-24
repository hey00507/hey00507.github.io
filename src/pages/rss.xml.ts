import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { getPublishedPosts } from '../utils/posts';
import { buildSlugMap } from '../utils/slugs';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const allPosts = await getPublishedPosts();
  const slugMap = buildSlugMap(allPosts);
  const posts = allPosts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return rss({
    title: "Ethan Devlog",
    description: '업무에서 푼 문제, 개인 프로젝트, 공부를 기록하는 백엔드 개발 블로그',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/posts/${slugMap.get(post.id)}/`,
      categories: [post.data.category, ...post.data.tags],
    })),
  });
}
