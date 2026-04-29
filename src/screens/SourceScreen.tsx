import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Activity,
  ChartColumn,
  Check,
  Database,
  Download,
  HeartPulse,
  Lock,
  Moon,
  RefreshCw,
  Settings,
  Shield,
  Trash2,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';

import { ranges } from '../core/constants';
import { dataAge, formatDateKey, formatNumber, metricLabel } from '../core/formatters';
import { availabilityForTypes } from '../core/metricAvailability';
import type { LastSync } from '../core/types';
import {
  currentHealthProviderLabel,
  openCurrentPlatformHealthSettings,
} from '../health/syncPipeline';
import type {
  CanonicalType,
  DailyMetrics,
  HealthConnectReadDiagnostic,
  PipelineSnapshot,
  SourceFreshness,
} from '../health/types';
import { formatShortDateTime } from '../lib/dates';
import type { AppSettings } from '../storage/appSettings';
import { styles } from '../styles/appStyles';
import { tokens } from '../theme/tokens';
import { AppButton, SectionLabel } from '../ui/primitives';
import { AnalyticsPanel } from './AnalyticsScreen';

function PermissionRow({
  icon: Icon,
  title,
  detail,
  active,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  active: boolean;
}) {
  return (
    <View style={styles.permissionRow}>
      <Icon color={tokens.inkSoft} size={18} strokeWidth={2} />
      <View style={styles.permissionCopy}>
        <Text style={styles.permissionTitle}>{title}</Text>
        <Text style={styles.permissionDetail}>{detail}</Text>
      </View>
      <View style={[styles.toggle, active && styles.toggleActive]}>
        <View style={[styles.toggleKnob, active && styles.toggleKnobActive]}>
          {active ? <Check color={tokens.accent} size={11} strokeWidth={3} /> : null}
        </View>
      </View>
    </View>
  );
}

function diagnosticTitle(diagnostic: HealthConnectReadDiagnostic): string {
  const kind = diagnostic.readKind === 'aggregate' ? 'daily' : 'records';
  return `${metricLabel(diagnostic.canonicalType)} · ${kind}`;
}

function diagnosticDetail(diagnostic: HealthConnectReadDiagnostic): string {
  const permission =
    diagnostic.permission === 'granted' ? 'Permission granted' : 'Permission missing';
  const counts = `${diagnostic.recordsRead} read · ${diagnostic.samplesWritten} saved`;
  return diagnostic.message ? `${permission} · ${counts} · ${diagnostic.message}` : `${permission} · ${counts}`;
}

function DiagnosticRow({ diagnostic }: { diagnostic: HealthConnectReadDiagnostic }) {
  const active = diagnostic.permission === 'granted' && diagnostic.samplesWritten > 0;

  return (
    <View style={styles.diagnosticRow}>
      <View style={[styles.diagnosticDot, active && styles.diagnosticDotActive]} />
      <View style={styles.diagnosticCopy}>
        <Text style={styles.diagnosticTitle}>{diagnosticTitle(diagnostic)}</Text>
        <Text style={styles.diagnosticDetail}>{diagnosticDetail(diagnostic)}</Text>
      </View>
    </View>
  );
}

function freshnessStateLabel(state: SourceFreshness['state']): string {
  if (state === 'fresh') return 'Fresh';
  if (state === 'partial') return 'Partial';
  if (state === 'stale') return 'Stale';
  return 'Missing';
}

function freshnessBadgeStyle(state: SourceFreshness['state']) {
  if (state === 'fresh') return styles.scoreBadge_live;
  if (state === 'partial') return styles.scoreBadge_permission;
  if (state === 'stale') return styles.scoreBadge_empty;
  return styles.scoreBadge_unchecked;
}

function SourceFreshnessRow({ source }: { source: SourceFreshness }) {
  const active = source.state === 'fresh' || source.state === 'partial';
  const detailParts = [
    source.latestLocalDate ? `Latest ${formatDateKey(source.latestLocalDate)}` : null,
    source.lastUpdatedAt ? `Updated ${formatShortDateTime(source.lastUpdatedAt)}` : null,
    source.sampleCount ? `${formatNumber(source.sampleCount)} rows` : null,
  ].filter(Boolean);
  const detail = [...detailParts, ...source.limitations].join(' · ') || 'No status detail available';

  return (
    <View style={styles.diagnosticRow}>
      <View style={[styles.diagnosticDot, active && styles.diagnosticDotActive]} />
      <View style={styles.diagnosticCopy}>
        <View style={styles.scoreTitleLine}>
          <Text style={styles.diagnosticTitle}>{source.label}</Text>
          <Text style={[styles.scoreBadge, freshnessBadgeStyle(source.state)]}>
            {freshnessStateLabel(source.state)}
          </Text>
        </View>
        <Text style={styles.diagnosticDetail}>{detail}</Text>
      </View>
    </View>
  );
}

function hasDiagnosticSamples(
  diagnostics: HealthConnectReadDiagnostic[],
  types: CanonicalType[],
): boolean {
  return diagnostics.some(
    (diagnostic) =>
      types.includes(diagnostic.canonicalType) && diagnostic.samplesWritten > 0,
  );
}

export function SourceScreen({
  snapshot,
  lastSync,
  appSettings,
  apiKeyDraft,
  settingsBusy,
  busy,
  status,
  rangeDays,
  setRangeDays,
  setApiKeyDraft,
  onSync,
  onExport,
  onClear,
  onSaveApiKey,
  onClearApiKey,
  onSetDefaultRange,
}: {
  snapshot: PipelineSnapshot;
  lastSync: LastSync;
  appSettings: AppSettings;
  apiKeyDraft: string;
  settingsBusy: boolean;
  busy: boolean;
  status: string;
  rangeDays: number;
  setRangeDays: (value: number) => void;
  setApiKeyDraft: (value: string) => void;
  onSync: () => void;
  onExport: () => void;
  onClear: () => void;
  onSaveApiKey: () => void;
  onClearApiKey: () => void;
  onSetDefaultRange: (value: number) => void;
}) {
  const sourceLabel = currentHealthProviderLabel();
  const apiKeyStatus =
    appSettings.openAiApiKeySource === 'secure_store'
      ? 'Saved on this device'
      : appSettings.openAiApiKeySource === 'env'
        ? 'Loaded from .env'
        : 'Not saved';
  const apiKeyPlaceholder = appSettings.hasOpenAiApiKey ? 'Replace active key' : 'sk-...';
  const diagnosticFocus: CanonicalType[] = [
    'sleep_session',
    'resting_heart_rate',
    'hrv_rmssd',
    'hrv_sdnn',
    'heart_rate',
  ];
  const focusedDiagnostics = snapshot.latestDiagnostics.filter((diagnostic) =>
    diagnosticFocus.includes(diagnostic.canonicalType),
  );
  const hasSamples = (types: CanonicalType[]) =>
    hasDiagnosticSamples(snapshot.latestDiagnostics, types);
  const hasAvailability = (types: CanonicalType[]) =>
    availabilityForTypes(snapshot.metricAvailability, types).sampleCount > 0;
  const hasHistory = (predicate: (day: DailyMetrics) => boolean) =>
    snapshot.history.some(predicate);
  const hasSleepSignal =
    snapshot.sleepCount > 0 ||
    hasHistory((day) => day.sleepSeconds != null) ||
    hasSamples(['sleep_session']) ||
    hasAvailability(['sleep_session']);
  const hasVitalsSignal =
    hasHistory(
      (day) =>
        day.heartRateAvgBpm != null ||
        day.restingHr != null ||
        day.hrvLastNightAvg != null ||
        day.vo2max != null,
    ) ||
    hasSamples(['heart_rate', 'resting_heart_rate', 'hrv_rmssd', 'hrv_sdnn', 'vo2max']) ||
    hasAvailability(['heart_rate', 'resting_heart_rate', 'hrv_rmssd', 'hrv_sdnn', 'vo2max']);
  const hasWorkoutSignal = snapshot.workoutCount > 0 || hasAvailability(['workout']);
  const hasActivitySignal =
    hasHistory((day) => day.hasSteps || day.hasEnergy || day.distanceKm != null) ||
    hasSamples(['steps', 'active_energy', 'total_energy', 'distance']) ||
    hasAvailability(['steps', 'active_energy', 'total_energy', 'distance']);
  const hasNutritionSignal =
    snapshot.nutritionDays > 0 ||
    hasSamples(['nutrition', 'hydration']) ||
    hasAvailability(['nutrition', 'hydration']);
  const hasBodySignal =
    hasHistory(
      (day) =>
        day.weightKg != null ||
        day.bodyFatPct != null ||
        day.leanBodyMassKg != null,
    ) ||
    hasSamples(['weight', 'body_fat', 'lean_body_mass']) ||
    hasAvailability(['weight', 'body_fat', 'lean_body_mass']);

  return (
    <View style={styles.screen}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageEyebrow}>Datasource</Text>
        <Text style={styles.pageTitle}>{sourceLabel}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <View style={styles.connectCard}>
          <View style={styles.connectIcon}>
            {busy ? (
              <ActivityIndicator color={tokens.accent} />
            ) : (
              <Shield color={tokens.accent} size={26} strokeWidth={2} />
            )}
          </View>
          <Text style={styles.connectTitle}>Local API pipeline</Text>
          <Text style={styles.connectText}>
            Reads Health Connect records into schema tables, then derives the coaching
            surface from daily rollups. Nothing leaves the device from this app.
          </Text>
          <Text style={styles.connectMeta}>
            {status} · {dataAge(lastSync)}
          </Text>
        </View>

        <View style={styles.rangeRow}>
          {ranges.map((days) => (
            <Pressable
              accessibilityRole="button"
              key={days}
              onPress={() => setRangeDays(days)}
              style={[styles.rangeButton, days === rangeDays && styles.rangeButtonActive]}
            >
              <Text
                style={[
                  styles.rangeButtonText,
                  days === rangeDays && styles.rangeButtonTextActive,
                ]}
              >
                {days}d
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.actionsRow}>
          <AppButton
            disabled={busy}
            icon={RefreshCw}
            label={busy ? 'Syncing' : 'Sync'}
            onPress={onSync}
            variant="primary"
          />
          <AppButton
            disabled={busy || snapshot.totalSamples === 0}
            icon={Download}
            label="Export"
            onPress={onExport}
          />
        </View>
        <View style={styles.actionsRow}>
          {Platform.OS === 'android' ? (
            <AppButton
              disabled={busy}
              icon={Settings}
              label="Permissions"
              onPress={() => void openCurrentPlatformHealthSettings().catch((error) => {
                Alert.alert('Health settings', String(error instanceof Error ? error.message : error));
              })}
            />
          ) : null}
          <AppButton
            disabled={busy || snapshot.totalSamples === 0}
            icon={Trash2}
            label="Clear"
            onPress={onClear}
            variant="danger"
          />
        </View>

        <AnalyticsPanel lastSync={lastSync} snapshot={snapshot} />

        <SectionLabel>Local app settings</SectionLabel>
        <View style={styles.settingsCard}>
          <View style={styles.settingsHeader}>
            <View style={styles.settingsIcon}>
              <Lock color={tokens.accent} size={18} strokeWidth={2} />
            </View>
            <View style={styles.settingsCopy}>
              <Text style={styles.settingsTitle}>OpenAI API key</Text>
              <Text style={styles.settingsMeta}>{apiKeyStatus}</Text>
            </View>
          </View>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setApiKeyDraft}
            placeholder={apiKeyPlaceholder}
            placeholderTextColor={tokens.muted}
            secureTextEntry
            style={styles.apiKeyInput}
            value={apiKeyDraft}
          />
          <View style={styles.actionsRow}>
            <AppButton
              disabled={settingsBusy || !apiKeyDraft.trim()}
              icon={Check}
              label={appSettings.hasOpenAiApiKey ? 'Replace' : 'Save'}
              onPress={onSaveApiKey}
            />
            <AppButton
              disabled={settingsBusy || !appSettings.hasOpenAiApiKey}
              icon={Trash2}
              label="Clear key"
              onPress={onClearApiKey}
              variant="danger"
            />
          </View>

          <View style={styles.settingDivider} />
          <View style={styles.settingRow}>
            <View style={styles.settingsCopy}>
              <Text style={styles.settingsTitle}>Default sync range</Text>
              <Text style={styles.settingsMeta}>{appSettings.defaultSyncRangeDays} days</Text>
            </View>
            <View style={styles.settingSegments}>
              {ranges.map((days) => (
                <Pressable
                  accessibilityRole="button"
                  disabled={settingsBusy}
                  key={days}
                  onPress={() => onSetDefaultRange(days)}
                  style={[
                    styles.settingSegment,
                    appSettings.defaultSyncRangeDays === days && styles.settingSegmentActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.settingSegmentText,
                      appSettings.defaultSyncRangeDays === days &&
                        styles.settingSegmentTextActive,
                    ]}
                  >
                    {days}d
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <SectionLabel>Source freshness</SectionLabel>
        <View style={styles.diagnosticList}>
          {snapshot.sourceFreshness.length ? (
            snapshot.sourceFreshness.map((source) => (
              <SourceFreshnessRow key={source.domain} source={source} />
            ))
          ) : (
            <Text style={styles.emptyText}>Run a sync to derive source freshness.</Text>
          )}
        </View>

        <SectionLabel>Schema coverage</SectionLabel>
        <View style={styles.permissionList}>
          <PermissionRow
            active={hasSleepSignal}
            detail="Sleep sessions and stages"
            icon={Moon}
            title="Sleep"
          />
          <PermissionRow
            active={hasVitalsSignal}
            detail="HR, HRV, resting HR, VO2 max"
            icon={HeartPulse}
            title="Vitals"
          />
          <PermissionRow
            active={hasWorkoutSignal}
            detail="Sessions, duration, sport buckets"
            icon={Activity}
            title="Workouts"
          />
          <PermissionRow
            active={hasActivitySignal}
            detail="Steps, energy, distance"
            icon={Zap}
            title="Daily activity"
          />
          <PermissionRow
            active={hasNutritionSignal}
            detail="Calories, macros, hydration"
            icon={Database}
            title="Nutrition"
          />
          <PermissionRow
            active={hasBodySignal}
            detail="Weight, body fat, lean mass"
            icon={ChartColumn}
            title="Body composition"
          />
        </View>

        <SectionLabel>{`Latest ${sourceLabel} read`}</SectionLabel>
        <View style={styles.diagnosticList}>
          {focusedDiagnostics.length ? (
            focusedDiagnostics.map((diagnostic) => (
              <DiagnosticRow
                diagnostic={diagnostic}
                key={`${diagnostic.recordType}:${diagnostic.readKind}`}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>Run a sync to see sleep and vitals read results.</Text>
          )}
        </View>

        <View style={styles.privacyCard}>
          <Lock color={tokens.muted} size={16} strokeWidth={2} />
          <Text style={styles.privacyText}>
            Vendor-only metrics such as stress, body battery, sleep score, and
            training load are preserved only when a source writes them. They are not
            fabricated from generic platform data.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
