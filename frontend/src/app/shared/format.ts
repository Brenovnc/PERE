const activityTypeLabels: Record<string, string> = {
  TRUE_FALSE: 'Verdadeiro ou falso',
  FILL_BLANK: 'Completar lacunas',
  GUESS_CONCEPT: 'Jogo das pistas',
  ORDERING: 'Ordenação',
  EXPOSURE: 'Exposição',
};

export function activityTypeLabel(type: string): string {
  return activityTypeLabels[type] ?? type;
}

/** "2026-11-13" → "13/11" (or "13/11/2026" with the year). */
export function formatIsoDate(value: string, includeYear = false): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return includeYear ? `${day}/${month}/${year}` : `${day}/${month}`;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** "Hoje", "Ontem", a date, or "Nunca". */
export function formatLastAccess(value: string | null): string {
  if (!value) return 'Nunca';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nunca';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, today)) return 'Hoje';
  if (sameDay(date, yesterday)) return 'Ontem';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/** Saves a file the browser received (module export). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
