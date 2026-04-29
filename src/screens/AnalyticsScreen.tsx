import { ScrollView, Text, View } from 'react-native';
import { Database } from 'lucide-react-native';

import { analyticsMetrics } from '../core/constants';
import { dataAge, formatDateKey, formatNumber } from '../core/formatters';
import { availabilityForTypes } from '../core/metricAvailability';
import type { AnalyticsMetricConfig, LastSync, MetricStatus } from '../core/types';
import type {
  CanonicalType,
  HealthConnectReadDiagnostic,
  MetricAvailability,
  PipelineSnapshot,
} from '../health/types';
import { styles } from '../styles/appStyles';
import { tokens } from '../theme/tokens';
import { SectionLabel, SmallMetric } from '../ui/primitives';

function diagnosticsForTypes(
  diagnostics: HealthConnectReadDiagnostic[],
  types: CanonicalType[],
): HealthConnectReadDiagnostic[] {
  return diagnostics.filter((diagnostic) => types.includes(diagnostic.canonicalType));
}

function metricStatus(
  availability: MetricAvailability,
  diagnostics: HealthConnectReadDiagnostic[],
): MetricStatus {
  if (availability.sampleCount > 0) {
    return 'live';
  }
  if (diagnostics.some((diagnostic) => diagnostic.permission === 'missing')) {
    return 'permission';
  }
  if (diagnostics.some((diagnostic) => diagnostic.permission === 'granted')) {
    return 'empty';
  }
  return 'unchecked';
}

function statusLabel(status: MetricStatus): string {
  if (status === 'live') return 'Live';
  if (status === 'permission') return 'Permission';
  if (status === 'empty') return 'No data';
  return 'Not checked';
}

function scoreBadgeStyle(status: MetricStatus) {
  if (status === 'live') return styles.scoreBadge_live;
  if (status === 'permission') return styles.scoreBadge_permission;
  if (status === 'empty') return styles.scoreBadge_empty;
  return styles.scoreBadge_unchecked;
}

function statusDetail(
  config: AnalyticsMetricConfig,
  availability: MetricAvailability,
  diagnostics: HealthConnectReadDiagnostic[],
): string {
  if (availability.sampleCount > 0) {
    const days = availability.dayCount === 1 ? '1 day' : `${availability.dayCount} days`;
    const latest = availability.latestDate ? ` · latest ${formatDateKey(availability.latestDate)}` : '';
    return `${formatNumber(availability.sampleCount)} records · ${days}${latest}`;
  }

  const message = diagnostics.find((diagnostic) => diagnostic.message)?.message;
  if (message) {
    return message;
  }

  return config.gap;
}

function ScoreboardRow({
  config,
  snapshot,
}: {
  config: AnalyticsMetricConfig;
  snapshot: PipelineSnapshot;
}) {
  const availability = availabilityForTypes(snapshot.metricAvailability, config.types);
  const diagnostics = diagnosticsForTypes(snapshot.latestDiagnostics, config.types);
  const status = metricStatus(availability, diagnostics);
  const coverageRatio = snapshot.coverageDays
    ? Math.min(1, availability.dayCount / snapshot.coverageDays)
    : 0;
  const Icon = config.icon;

  return (
    <View style={styles.scoreRow}>
      <View style={styles.scoreIcon}>
        <Icon color={tokens.inkSoft} size={18} strokeWidth={2} />
      </View>
      <View style={styles.scoreCopy}>
        <View style={styles.scoreTitleLine}>
          <Text style={styles.scoreTitle}>{config.title}</Text>
          <Text style={[styles.scoreBadge, scoreBadgeStyle(status)]}>
            {statusLabel(status)}
          </Text>
        </View>
        <Text style={styles.scoreMeta}>{config.detail}</Text>
        <View style={styles.scoreTrack}>
          <View style={[styles.scoreFill, { width: `${Math.round(coverageRatio * 100)}%` }]} />
        </View>
        <Text style={styles.scoreDetail}>{statusDetail(config, availability, diagnostics)}</Text>
      </View>
    </View>
  );
}

export function AnalyticsPanel({ snapshot, lastSync }: { snapshot: PipelineSnapshot; lastSync: LastSync }) {
  const scoredMetrics = analyticsMetrics.map((config) => {
    const availability = availabilityForTypes(snapshot.metricAvailability, config.types);
    const diagnostics = diagnosticsForTypes(snapshot.latestDiagnostics, config.types);
    return {
      config,
      status: metricStatus(availability, diagnostics),
    };
  });
  const liveCount = scoredMetrics.filter((metric) => metric.status === 'live').length;
  const gapCount = scoredMetrics.filter((metric) => metric.status !== 'live').length;
  const topGaps = scoredMetrics.filter((metric) => metric.status !== 'live').slice(0, 3);

  return (
    <>
      <SectionLabel>Analytics</SectionLabel>
      <View style={styles.summaryGrid}>
        <SmallMetric label="Coverage days" value={formatNumber(snapshot.coverageDays)} />
        <SmallMetric label="Live metrics" value={`${liveCount}/${analyticsMetrics.length}`} />
        <SmallMetric label="Open gaps" value={formatNumber(gapCount)} />
        <SmallMetric label="Raw samples" value={formatNumber(snapshot.totalSamples)} />
      </View>

      <SectionLabel>Data availability</SectionLabel>
      <View style={styles.scoreList}>
        {analyticsMetrics.map((config) => (
          <ScoreboardRow config={config} key={config.id} snapshot={snapshot} />
        ))}
      </View>

      <SectionLabel>Gaps to close</SectionLabel>
      <View style={styles.gapList}>
        {topGaps.length ? (
          topGaps.map(({ config }) => (
            <View key={config.id} style={styles.gapRow}>
              <Text style={styles.gapTitle}>{config.title}</Text>
              <Text style={styles.gapDetail}>{config.gap}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Core metrics are available for the current dataset.</Text>
        )}
      </View>

      <View style={styles.privacyCard}>
        <Database color={tokens.muted} size={16} strokeWidth={2} />
        <Text style={styles.privacyText}>
          Scores reflect local records already imported into the on-device SQLite pipeline.
          {` ${dataAge(lastSync)}.`}
        </Text>
      </View>
    </>
  );
}

export function AnalyticsScreen({ snapshot, lastSync }: { snapshot: PipelineSnapshot; lastSync: LastSync }) {
  return (
    <View style={styles.screen}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageEyebrow}>Pipeline scoreboard</Text>
        <Text style={styles.pageTitle}>Analytics</Text>
      </View>
      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <AnalyticsPanel lastSync={lastSync} snapshot={snapshot} />
      </ScrollView>
    </View>
  );
}
