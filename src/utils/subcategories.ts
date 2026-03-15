import type { Category } from './categories';

export interface Subcategory {
  slug: string;
  label: string;
}

export const subcategories: Record<Category, Subcategory[]> = {
  reading: [
    { slug: 'review', label: '서평' },
    { slug: 'note', label: '독서노트' },
  ],
  essay: [
    { slug: 'workout', label: '운동' },
    { slug: 'retrospective', label: '회고' },
    { slug: 'diary', label: '일기' },
  ],
  dev: [
    { slug: 'work', label: '업무' },
    { slug: 'til', label: 'TIL' },
  ],
};

/** 카테고리+slug로 소카테고리 label 조회 */
export function getSubcategoryLabel(category: Category, slug: string): string | undefined {
  return subcategories[category]?.find((s) => s.slug === slug)?.label;
}

/** 유효한 소카테고리 slug인지 확인 */
export function isValidSubcategory(category: Category, slug: string): boolean {
  return subcategories[category]?.some((s) => s.slug === slug) ?? false;
}
