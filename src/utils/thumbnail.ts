/** 마크다운 본문에서 첫 번째 이미지 URL을 추출 */
export function extractFirstImage(body: string | undefined): string | undefined {
  if (!body) return undefined;

  // HTML img 태그: <img src="..." />
  const htmlMatch = body.match(/<img\s[^>]*src=["']([^"']+)["']/);
  if (htmlMatch) return htmlMatch[1];

  // 마크다운 이미지: ![alt](url)
  const mdMatch = body.match(/!\[[^\]]*\]\(([^)]+)\)/);
  if (mdMatch) return mdMatch[1];

  return undefined;
}
