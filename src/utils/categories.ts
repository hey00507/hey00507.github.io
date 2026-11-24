export const categories = {
  dev: { label: '개발', color: 'var(--color-accent)' },
} as const;

export type Category = keyof typeof categories;
