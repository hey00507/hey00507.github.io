import type { Category } from './categories';

export interface Subcategory {
  slug: string;
  label: string;
}

/** 블로그의 세 갈래. 상단 메뉴와 /dev/{slug}/ 페이지가 이 목록으로 만들어진다. */
export const subcategories: Record<Category, Subcategory[]> = {
  dev: [
    { slug: 'work', label: '업무·문제 해결' },
    { slug: 'project', label: '개인 프로젝트' },
    { slug: 'til', label: '공부' },
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
