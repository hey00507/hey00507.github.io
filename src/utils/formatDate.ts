/**
 * 날짜를 "2026-03-13 14:30:00" 형식으로 포맷한다.
 * 시간이 00:00:00이면 날짜만 표시한다.
 * UTC 기준으로 출력하여 frontmatter에 적은 시간이 그대로 표시된다.
 */
export function formatDateTime(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');

  if (hh === '00' && mm === '00' && ss === '00') {
    return `${y}-${m}-${d}`;
  }
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

/** 날짜만: "2026-03-13" */
export function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 월일만: "03-13" (아카이브용) */
export function formatMonthDay(date: Date): string {
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${m}-${d}`;
}
