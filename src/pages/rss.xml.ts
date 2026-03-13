import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { buildSlugMap } from '../utils/slugs';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const allPosts = (await getCollection('posts')).filter((p) => !p.data.draft);
  const slugMap = buildSlugMap(allPosts);
  const posts = allPosts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return rss({
    title: "Ethan's Blog",
    description: '독서, 일상, 코딩에 대한 기록',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/posts/${slugMap.get(post.id)}/`,
      categories: [post.data.category, ...post.data.tags],
    })),
  });
}
