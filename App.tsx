import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Database,
  Download,
  HeartPulse,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';

import { openAndroidHealthSettings } from './src/health/healthConnect';
import {
  currentHealthProviderId,
  currentHealthProviderLabel,
  syncCurrentPlatform,
} from './src/health/syncPipeline';
import type {
  HealthMetric,
  MetricSummary,
  PipelineSnapshot,
} from './src/health/types';
import { formatRange, formatShortDateTime, makeSyncRange } from './src/lib/dates';
import {
  clearPipeline,
  exportPipelineJson,
  getLastSyncRun,
  getPipelineSnapshot,
  getRecentSamples,
  initTrainingStore,
  recordSyncRun,
  upsertSamples,
} from './src/storage/trainingStore';

const ranges = [1, 7, 30];

const metricOrder: HealthMetric[] = [
  'steps',
  'active_energy',
  'distance',
  'heart_rate',
  'workout',
];

const metricLabels: Record<HealthMetric, string> = {
  steps: 'Steps',
  active_energy: 'Active kcal',
  distance: 'Distance',
  heart_rate: 'Avg HR',
  workout: 'Training',
};

type LastSync = Awaited<ReturnType<typeof getLastSyncRun>>;
type RecentSample = Awaited<ReturnType<typeof getRecentSamples>>[number];

function findMetric(rows: MetricSummary[], metric: HealthMetric): MetricSummary | undefined {
  return rows.find((row) => row.metric === metric);
}

function formatMetric(row: MetricSummary | undefined, metric: HealthMetric): string {
  if (!row) {
    return metric === 'distance' ? '0.0 km' : '0';
  }

  if (metric === 'distance') {
    return `${(row.value / 1000).toFixed(1)} km`;
  }

  if (metric === 'heart_rate') {
    return `${Math.round(row.value)} bpm`;
  }

  if (metric === 'workout') {
    return `${Math.round(row.value)} min`;
  }

  return `${Math.round(row.value).toLocaleString()}`;
}

function Button({
  label,
  icon: Icon,
  onPress,
  disabled,
  variant = 'secondary',
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.primaryButton,
        variant === 'danger' && styles.dangerButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Icon
        color={variant === 'primary' ? '#ffffff' : variant === 'danger' ? '#b42318' : '#24535d'}
        size={18}
        strokeWidth={2.2}
      />
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' && styles.primaryButtonText,
          variant === 'danger' && styles.dangerButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MetricCard({
  label,
  today,
  week,
  samples,
}: {
  label: string;
  today: string;
  week: string;
  samples: number;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{today}</Text>
      <Text style={styles.metricSubvalue}>{week} / 7d</Text>
      <Text style={styles.metricMeta}>{samples} samples</Text>
    </View>
  );
}

function RecentSampleRow({ sample }: { sample: RecentSample }) {
  return (
    <View style={styles.sampleRow}>
      <View style={styles.sampleDot} />
      <View style={styles.sampleContent}>
        <Text style={styles.sampleTitle}>
          {metricLabels[sample.metric]} · {sample.provider.replace('_', ' ')}
        </Text>
        <Text style={styles.sampleMeta}>
          {formatShortDateTime(sample.start_time)} · {Number(sample.value).toFixed(1)}{' '}
          {sample.unit}
        </Text>
      </View>
    </View>
  );
}

export default function App() {
  const [rangeDays, setRangeDays] = useState(7);
  const [snapshot, setSnapshot] = useState<PipelineSnapshot>({
    totalSamples: 0,
    today: [],
    trailing7Days: [],
  });
  const [lastSync, setLastSync] = useState<LastSync>(null);
  const [recentSamples, setRecentSamples] = useState<RecentSample[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [warnings, setWarnings] = useState<string[]>([]);

  const range = useMemo(() => makeSyncRange(rangeDays), [rangeDays]);
  const providerLabel = currentHealthProviderLabel();
  const canSync = Platform.OS === 'ios' || Platform.OS === 'android';

  async function refreshStore() {
    const [nextSnapshot, nextLastSync, nextRecentSamples] = await Promise.all([
      getPipelineSnapshot(),
      getLastSyncRun(),
      getRecentSamples(),
    ]);

    setSnapshot(nextSnapshot);
    setLastSync(nextLastSync);
    setRecentSamples(nextRecentSamples);
  }

  useEffect(() => {
    async function boot() {
      await initTrainingStore();
      await refreshStore();
    }

    void boot().catch((error) => {
      setStatus(String(error instanceof Error ? error.message : error));
    });
  }, []);

  async function runSync() {
    if (!canSync) {
      setStatus('Use an iOS or Android dev build.');
      return;
    }

    const provider = currentHealthProviderId();
    const startedAt = new Date().toISOString();

    setBusy(true);
    setWarnings([]);
    setStatus(`Syncing ${formatRange(range)}`);

    try {
      const result = await syncCurrentPlatform(range);
      const saved = await upsertSamples(result.samples);
      await recordSyncRun(result.provider, range, saved, startedAt);
      setWarnings(result.warnings);
      setStatus(`Synced ${saved.toLocaleString()} samples`);
      await refreshStore();
    } catch (error) {
      if (provider) {
        await recordSyncRun(provider, range, 0, startedAt, error);
      }
      setStatus(String(error instanceof Error ? error.message : error));
      await refreshStore();
    } finally {
      setBusy(false);
    }
  }

  async function runExport() {
    setBusy(true);
    try {
      const fileUri = await exportPipelineJson();
      setStatus(`Exported ${fileUri.split('/').pop()}`);
    } catch (error) {
      setStatus(String(error instanceof Error ? error.message : error));
    } finally {
      setBusy(false);
    }
  }

  function confirmClear() {
    Alert.alert('Clear local data', 'Remove imported samples and sync history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          void clearPipeline()
            .then(refreshStore)
            .then(() => setStatus('Local pipeline cleared'));
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Local training pipeline</Text>
            <Text style={styles.title}>{providerLabel}</Text>
          </View>
          <View style={styles.headerBadge}>
            <HeartPulse color="#24535d" size={24} strokeWidth={2.2} />
          </View>
        </View>

        <View style={styles.statusPanel}>
          <View style={styles.statusRow}>
            <View style={styles.statusIcon}>
              {busy ? (
                <ActivityIndicator color="#24535d" />
              ) : (
                <ShieldCheck color="#24535d" size={22} strokeWidth={2.2} />
              )}
            </View>
            <View style={styles.statusCopy}>
              <Text style={styles.statusTitle}>{status}</Text>
              <Text style={styles.statusMeta}>
                Last sync {formatShortDateTime(lastSync?.ended_at)} ·{' '}
                {snapshot.totalSamples.toLocaleString()} samples stored
              </Text>
            </View>
          </View>

          <View style={styles.rangeRow}>
            {ranges.map((days) => (
              <Pressable
                accessibilityRole="button"
                key={days}
                onPress={() => setRangeDays(days)}
                style={[
                  styles.rangeButton,
                  rangeDays === days && styles.activeRangeButton,
                ]}
              >
                <Text
                  style={[
                    styles.rangeButtonText,
                    rangeDays === days && styles.activeRangeButtonText,
                  ]}
                >
                  {days}d
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actions}>
            <Button
              disabled={busy}
              icon={RefreshCw}
              label="Sync"
              onPress={runSync}
              variant="primary"
            />
            <Button
              disabled={busy || snapshot.totalSamples === 0}
              icon={Download}
              label="Export"
              onPress={runExport}
            />
          </View>

          <View style={styles.actions}>
            {Platform.OS === 'android' ? (
              <Button
                disabled={busy}
                icon={Settings}
                label="Settings"
                onPress={() => void openAndroidHealthSettings()}
              />
            ) : null}
            <Button
              disabled={busy || snapshot.totalSamples === 0}
              icon={Trash2}
              label="Clear"
              onPress={confirmClear}
              variant="danger"
            />
          </View>
        </View>

        {warnings.length ? (
          <View style={styles.warningPanel}>
            {warnings.slice(0, 3).map((warning) => (
              <Text key={warning} style={styles.warningText}>
                {warning}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.metricGrid}>
          {metricOrder.map((metric) => {
            const today = findMetric(snapshot.today, metric);
            const week = findMetric(snapshot.trailing7Days, metric);

            return (
              <MetricCard
                key={metric}
                label={metricLabels[metric]}
                samples={week?.samples ?? today?.samples ?? 0}
                today={formatMetric(today, metric)}
                week={formatMetric(week, metric)}
              />
            );
          })}
        </View>

        <View style={styles.sectionHeader}>
          <Database color="#24535d" size={20} strokeWidth={2.2} />
          <Text style={styles.sectionTitle}>Recent samples</Text>
        </View>

        <View style={styles.sampleList}>
          {recentSamples.length ? (
            recentSamples.map((sample) => (
              <RecentSampleRow key={sample.id} sample={sample} />
            ))
          ) : (
            <Text style={styles.emptyText}>No samples imported yet.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f7f6',
  },
  content: {
    padding: 18,
    paddingBottom: 32,
    gap: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  eyebrow: {
    color: '#6b7774',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: '#102426',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 3,
  },
  headerBadge: {
    alignItems: 'center',
    backgroundColor: '#d8efec',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  statusPanel: {
    backgroundColor: '#ffffff',
    borderColor: '#d9e2df',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  statusIcon: {
    alignItems: 'center',
    backgroundColor: '#e7f4f2',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  statusCopy: {
    flex: 1,
    gap: 2,
  },
  statusTitle: {
    color: '#102426',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  statusMeta: {
    color: '#65736f',
    fontSize: 13,
    letterSpacing: 0,
  },
  rangeRow: {
    backgroundColor: '#edf2f1',
    borderRadius: 8,
    flexDirection: 'row',
    padding: 4,
  },
  rangeButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  activeRangeButton: {
    backgroundColor: '#ffffff',
    borderColor: '#cfdcda',
    borderWidth: 1,
  },
  rangeButtonText: {
    color: '#65736f',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  activeRangeButtonText: {
    color: '#102426',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#eef6f4',
    borderColor: '#cfe0dd',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 10,
  },
  primaryButton: {
    backgroundColor: '#24535d',
    borderColor: '#24535d',
  },
  dangerButton: {
    backgroundColor: '#fff4f2',
    borderColor: '#ffd4cc',
  },
  disabledButton: {
    opacity: 0.45,
  },
  pressedButton: {
    opacity: 0.78,
  },
  buttonText: {
    color: '#24535d',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  dangerButtonText: {
    color: '#b42318',
  },
  warningPanel: {
    backgroundColor: '#fff8df',
    borderColor: '#f0dc95',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  warningText: {
    color: '#6d5600',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    backgroundColor: '#ffffff',
    borderColor: '#d9e2df',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 132,
    padding: 12,
    width: '48.5%',
  },
  metricLabel: {
    color: '#65736f',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#102426',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 12,
  },
  metricSubvalue: {
    color: '#24535d',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 6,
  },
  metricMeta: {
    color: '#7d8a86',
    fontSize: 12,
    letterSpacing: 0,
    marginTop: 8,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitle: {
    color: '#102426',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
  sampleList: {
    backgroundColor: '#ffffff',
    borderColor: '#d9e2df',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sampleRow: {
    alignItems: 'center',
    borderBottomColor: '#edf1f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 12,
  },
  sampleDot: {
    backgroundColor: '#69b3a9',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  sampleContent: {
    flex: 1,
    gap: 3,
  },
  sampleTitle: {
    color: '#102426',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'capitalize',
  },
  sampleMeta: {
    color: '#65736f',
    fontSize: 13,
    letterSpacing: 0,
  },
  emptyText: {
    color: '#65736f',
    fontSize: 14,
    letterSpacing: 0,
    padding: 16,
  },
});
