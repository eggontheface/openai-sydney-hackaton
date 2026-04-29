import type { CanonicalType, DailyMetrics, HrvMethod, PipelineSnapshot } from '../health/types';
import { formatDisplayDate, formatShortDateTime } from '../lib/dates';
import { tokens } from '../theme/tokens';
import type { LastSync } from './types';

export function toneColor(tone: PipelineSnapshot['recommendation']['color']) {
  if (tone === 'positive') return tokens.positive;
  if (tone === 'warm') return tokens.warm;
  if (tone === 'cool') return tokens.cool;
  return tokens.accent;
}

export function formatNumber(value?: number, digits = 0): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function hrvMethodLabel(method?: HrvMethod): string {
  if (method === 'rmssd') return 'RMSSD';
  if (method === 'sdnn') return 'SDNN';
  return 'HRV';
}

export function hrvMetricLabel(day?: DailyMetrics | null): string {
  const method = hrvMethodLabel(day?.hrvMethod);
  return day?.hrvLastNightAvg == null || method === 'HRV' ? 'HRV' : `HRV ${method}`;
}

export function formatDateKey(date?: string): string {
  if (!date) {
    return formatDisplayDate(new Date());
  }

  return formatDisplayDate(`${date}T12:00:00`);
}

export function metricLabel(type: CanonicalType): string {
  const labels: Partial<Record<CanonicalType, string>> = {
    active_energy: 'Active kcal',
    body_fat: 'Body fat',
    distance: 'Distance',
    heart_rate: 'Heart rate',
    hydration: 'Hydration',
    hrv_rmssd: 'HRV RMSSD',
    hrv_sdnn: 'HRV SDNN',
    lean_body_mass: 'Lean mass',
    nutrition: 'Nutrition',
    resting_heart_rate: 'Resting HR',
    sleep_session: 'Sleep',
    steps: 'Steps',
    total_energy: 'Total kcal',
    vo2max: 'VO2 max',
    weight: 'Weight',
    workout: 'Workout',
  };

  return labels[type] ?? type.replace(/_/g, ' ');
}

export function dataAge(lastSync: LastSync): string {
  if (!lastSync) {
    return 'Never synced';
  }

  return `Last sync ${formatShortDateTime(lastSync.ended_at)}`;
}
