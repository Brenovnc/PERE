const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** "Hoje às 14:30", "Amanhã" or "21/11/2026" (capitalized for the start of a sentence). */
export function formatReviewDate(value: string, now = new Date()): string {
  const date = new Date(value);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const reviewDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((reviewDay.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return `Hoje às ${timeFormat.format(date)}`;
  if (days === 1) return 'Amanhã';
  return dateFormat.format(date);
}

/** Same as formatReviewDate, in lower case for the middle of a sentence. */
export function reviewLabel(value: string): string {
  const text = formatReviewDate(value);
  return text.startsWith('Hoje') || text === 'Amanhã'
    ? text.charAt(0).toLowerCase() + text.slice(1)
    : text;
}
