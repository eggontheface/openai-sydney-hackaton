import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';

import { safeJsonStringify } from '../lib/json';
import { startOfToday, trailingDays } from '../lib/dates';
import type {
  HealthMetric,
  HealthProvider,
  MetricSummary,
  NormalizedHealthSample,
  PipelineSnapshot,
  SyncRange,
} from '../health/types';

type DbSampleRow = {
  id: string;
  provider: HealthProvider;
  metric: HealthMetric;
  start_time: string;
  end_time: string;
  value: number;
  unit: string;
  source_name: string | null;
  source_id: string | null;
  raw_json: string;
  synced_at: string;
};

type SyncRunRow = {
  id: number;
  provider: HealthProvider;
  started_at: string;
  ended_at: string;
  range_start: string;
  range_end: string;
  sample_count: number;
  status: 'ok' | 'error';
  error: string | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | undefined;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('training_pipeline.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS health_samples (
          id TEXT PRIMARY KEY NOT NULL,
          provider TEXT NOT NULL,
          metric TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          value REAL NOT NULL,
          unit TEXT NOT NULL,
          source_name TEXT,
          source_id TEXT,
          raw_json TEXT NOT NULL,
          synced_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_health_samples_metric_time
          ON health_samples(metric, start_time);

        CREATE INDEX IF NOT EXISTS idx_health_samples_provider_time
          ON health_samples(provider, start_time);

        CREATE TABLE IF NOT EXISTS sync_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT NOT NULL,
          range_start TEXT NOT NULL,
          range_end TEXT NOT NULL,
          sample_count INTEGER NOT NULL,
          status TEXT NOT NULL,
          error TEXT
        );
      `);

      return db;
    });
  }

  return dbPromise;
}

export async function initTrainingStore(): Promise<void> {
  await getDb();
}

export async function upsertSamples(samples: NormalizedHealthSample[]): Promise<number> {
  if (samples.length === 0) {
    return 0;
  }

  const db = await getDb();
  const syncedAt = new Date().toISOString();

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const sample of samples) {
      await txn.runAsync(
        `
          INSERT OR REPLACE INTO health_samples (
            id, provider, metric, start_time, end_time, value, unit,
            source_name, source_id, raw_json, synced_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        sample.id,
        sample.provider,
        sample.metric,
        sample.startTime,
        sample.endTime,
        sample.value,
        sample.unit,
        sample.sourceName ?? null,
        sample.sourceId ?? null,
        sample.rawJson,
        syncedAt,
      );
    }
  });

  return samples.length;
}

export async function recordSyncRun(
  provider: HealthProvider,
  range: SyncRange,
  sampleCount: number,
  startedAt: string,
  error?: unknown,
): Promise<void> {
  const db = await getDb();
  const endedAt = new Date().toISOString();

  await db.runAsync(
    `
      INSERT INTO sync_runs (
        provider, started_at, ended_at, range_start, range_end,
        sample_count, status, error
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    provider,
    startedAt,
    endedAt,
    range.startDate.toISOString(),
    range.endDate.toISOString(),
    sampleCount,
    error ? 'error' : 'ok',
    error ? String(error instanceof Error ? error.message : error) : null,
  );
}

async function summarizeSince(startTime: Date): Promise<MetricSummary[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    metric: HealthMetric;
    value: number;
    unit: string;
    samples: number;
  }>(
    `
      SELECT
        metric,
        CASE
          WHEN metric = 'heart_rate' THEN AVG(value)
          ELSE SUM(value)
        END AS value,
        unit,
        COUNT(*) AS samples
      FROM health_samples
      WHERE start_time >= ?
      GROUP BY metric, unit
      ORDER BY metric
    `,
    startTime.toISOString(),
  );

  return rows.map((row) => ({
    metric: row.metric,
    value: Number(row.value ?? 0),
    unit: row.unit,
    samples: Number(row.samples ?? 0),
  }));
}

export async function getPipelineSnapshot(): Promise<PipelineSnapshot> {
  const db = await getDb();
  const countRow = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM health_samples',
  );

  return {
    totalSamples: Number(countRow?.total ?? 0),
    today: await summarizeSince(startOfToday()),
    trailing7Days: await summarizeSince(trailingDays(7)),
  };
}

export async function getLastSyncRun(): Promise<SyncRunRow | null> {
  const db = await getDb();
  return db.getFirstAsync<SyncRunRow>(
    'SELECT * FROM sync_runs ORDER BY id DESC LIMIT 1',
  );
}

export async function getRecentSamples(limit = 12): Promise<DbSampleRow[]> {
  const db = await getDb();
  return db.getAllAsync<DbSampleRow>(
    `
      SELECT *
      FROM health_samples
      ORDER BY start_time DESC
      LIMIT ?
    `,
    limit,
  );
}

export async function clearPipeline(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM health_samples;
    DELETE FROM sync_runs;
  `);
}

export async function exportPipelineJson(): Promise<string> {
  const db = await getDb();
  const samples = await db.getAllAsync<DbSampleRow>(
    'SELECT * FROM health_samples ORDER BY start_time ASC',
  );
  const syncRuns = await db.getAllAsync<SyncRunRow>(
    'SELECT * FROM sync_runs ORDER BY started_at ASC',
  );

  const payload = {
    schema: 'training_pipeline_export.v1',
    exportedAt: new Date().toISOString(),
    samples,
    syncRuns,
  };

  const directory = FileSystem.documentDirectory;
  if (!directory) {
    throw new Error('No writable document directory is available on this device.');
  }

  const fileUri = `${directory}training-pipeline-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(fileUri, safeJsonStringify(payload), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Export training pipeline JSON',
    });
  }

  return fileUri;
}
