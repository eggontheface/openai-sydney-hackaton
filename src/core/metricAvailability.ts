import type { CanonicalType, MetricAvailability } from '../health/types';

export function availabilityForTypes(
  availability: MetricAvailability[],
  types: CanonicalType[],
): MetricAvailability {
  const rows = availability.filter((row) => types.includes(row.canonicalType));
  const latestDates = rows
    .map((row) => row.latestDate)
    .filter((date): date is string => Boolean(date))
    .sort();

  return {
    canonicalType: types[0],
    sampleCount: rows.reduce((sum, row) => sum + row.sampleCount, 0),
    dayCount: Math.max(0, ...rows.map((row) => row.dayCount)),
    latestDate: latestDates[latestDates.length - 1],
  };
}
