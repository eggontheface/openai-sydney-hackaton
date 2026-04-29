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

export function localDateKey(value: Date | string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function secondsBetween(startAt: string, endAt: string): number {
  return Math.max(0, (new Date(endAt).getTime() - new Date(startAt).getTime()) / 1000);
}

export function formatDuration(seconds?: number): string {
  if (!seconds) {
    return '—';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (!hours) {
    return `${minutes}m`;
  }

  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export function formatDisplayDate(value?: string | Date): string {
  if (!value) {
    return 'Today';
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export function formatRange({ startDate, endDate }: SyncRange): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return `${formatter.format(startDate)} to ${formatter.format(endDate)}`;
}
