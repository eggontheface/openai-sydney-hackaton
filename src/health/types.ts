export type HealthProvider = 'apple_health' | 'health_connect';

export type HealthMetric =
  | 'steps'
  | 'active_energy'
  | 'distance'
  | 'heart_rate'
  | 'workout';

export type NormalizedHealthSample = {
  id: string;
  provider: HealthProvider;
  metric: HealthMetric;
  startTime: string;
  endTime: string;
  value: number;
  unit: string;
  sourceName?: string;
  sourceId?: string;
  rawJson: string;
};

export type SyncRange = {
  startDate: Date;
  endDate: Date;
};

export type SyncResult = {
  provider: HealthProvider;
  samples: NormalizedHealthSample[];
  warnings: string[];
};

export type MetricSummary = {
  metric: HealthMetric;
  value: number;
  unit: string;
  samples: number;
};

export type PipelineSnapshot = {
  totalSamples: number;
  today: MetricSummary[];
  trailing7Days: MetricSummary[];
};
