import type { SyncRange } from '../health/types';

export function makeSyncRange(days: number): SyncRange {
  const endDate = new Date();
  const startDate = startOfToday();
  startDate.setDate(startDate.getDate() - Math.max(0, days - 1));
  return { startDate, endDate };
}

export function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function trailingDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export function formatShortDateTime(value?: string | Date): string {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatRange({ startDate, endDate }: SyncRange): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return `${formatter.format(startDate)} to ${formatter.format(endDate)}`;
}
