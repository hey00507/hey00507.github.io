import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(['reading', 'essay', 'dev']),
    subcategory: z.string().optional(),
    tags: z.array(z.string()).default([]),
    pubDate: z.union([z.string(), z.date()]).transform((v) => {
      if (v instanceof Date) {
        // YAML 자동 파싱된 Date는 UTC로 해석됨 → KST(+09:00)로 보정
        return new Date(v.getTime() - 9 * 60 * 60 * 1000);
      }
      return new Date(v.includes('+') || v.includes('Z') ? v : v + '+09:00');
    }),
    updatedDate: z.union([z.string(), z.date()]).optional().transform((v) => {
      if (!v) return undefined;
      if (v instanceof Date) {
        return new Date(v.getTime() - 9 * 60 * 60 * 1000);
      }
      return new Date(v.includes('+') || v.includes('Z') ? v : v + '+09:00');
    }),
    draft: z.boolean().default(false),
    // 독서 카테고리 전용
    bookTitle: z.string().optional(),
    bookAuthor: z.string().optional(),
    rating: z.number().min(1).max(5).optional(),
    // 공통 선택
    heroImage: z.string().optional(),
    // 코딩 카테고리 전용
    series: z.string().optional(),
  }),
});

export const collections = { posts };
