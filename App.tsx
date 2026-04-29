import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import {
  Activity,
  ArrowRight,
  ChartColumn,
  Check,
  Database,
  Download,
  Dumbbell,
  HeartPulse,
  History,
  Lock,
  Mic,
  Moon,
  MoreHorizontal,
  RefreshCw,
  Route,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  User,
  Zap,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import {
  answerCoachQuestion,
  generateTrainingPlan,
  type PlannedWorkout,
  type TrainingPlan,
} from './src/coach/planEngine';
import {
  currentHealthProviderId,
  currentHealthProviderLabel,
  openCurrentPlatformHealthSettings,
  syncCurrentPlatform,
} from './src/health/syncPipeline';
import type {
  CanonicalType,
  DailyMetrics,
  HealthConnectReadDiagnostic,
  MetricAvailability,
  PipelineSnapshot,
  SourceFreshness,
  WorkoutRecord,
} from './src/health/types';
import {
  formatDisplayDate,
  formatDuration,
  formatRange,
  formatShortDateTime,
  makeSyncRange,
} from './src/lib/dates';
import {
  clearOpenAiApiKey,
  loadAppSettings,
  readOpenAiApiKey,
  saveAppSettings,
  saveOpenAiApiKey,
} from './src/storage/appSettings';
import type { AppSettings } from './src/storage/appSettings';
import {
  clearPipeline,
  exportPipelineJson,
  getCoachHealthContext,
  getLastSyncRun,
  getPipelineSnapshot,
  initTrainingStore,
  recordSyncRun,
  upsertSyncPayload,
} from './src/storage/trainingStore';
import {
  openAiCoachModel,
  sendCoachMessage,
  type OpenAiCoachConversationMessage,
} from './src/ai/openaiCoach';

const ranges = [7, 30, 365];
const baselineRangeDays = 365;

const emptyAppSettings: AppSettings = {
  hasOpenAiApiKey: false,
  openAiApiKeySource: null,
  defaultSyncRangeDays: baselineRangeDays,
};

const tokens = {
  bg: '#fafaf8',
  bgDeep: '#f0efea',
  surface: '#ffffff',
  surfaceAlt: '#f5f4f0',
  ink: '#0a0a0a',
  inkSoft: '#2a2a2a',
  muted: '#6a6a6a',
  line: '#e6e6e2',
  lineSoft: '#f0f0ec',
  accent: '#0a0a0a',
  accentDeep: '#000000',
  accentSoft: '#e8e8e4',
  positive: '#0a7a4a',
  warm: '#b8915a',
  cool: '#5a7a9a',
  danger: '#b42318',
  serif: 'Georgia',
};

const emptySnapshot: PipelineSnapshot = {
  totalSamples: 0,
  workoutCount: 0,
  sleepCount: 0,
  nutritionDays: 0,
  coverageDays: 0,
  metricAvailability: [],
  sourceFreshness: [],
  latestDiagnostics: [],
  today: null,
  history: [],
  recentWorkouts: [],
  recentSamples: [],
  recommendation: {
    readiness: null,
    readinessLabel: 'Connect',
    color: 'neutral',
    title: 'Sync Health Connect',
    detail: 'Import data to build a baseline.',
    reason: 'No platform data is available yet.',
    opener: 'Connect Health Connect and run a sync.',
    strain: 0,
    strainTarget: '—',
  },
};

type LastSync = Awaited<ReturnType<typeof getLastSyncRun>>;
type Tab = 'coach' | 'workout' | 'analytics' | 'history' | 'you';

type MetricStatus = 'live' | 'permission' | 'empty' | 'unchecked';

type CoachConversationMessage = {
  id: string;
  role: 'coach' | 'user';
  text: string;
};

type AnalyticsMetricConfig = {
  id: string;
  title: string;
  detail: string;
  types: CanonicalType[];
  icon: LucideIcon;
  gap: string;
};

const analyticsMetrics: AnalyticsMetricConfig[] = [
  {
    id: 'sleep',
    title: 'Sleep',
    detail: 'Duration and stages',
    types: ['sleep_session'],
    icon: Moon,
    gap: 'Grant Sleep access or connect a source that writes sleep sessions.',
  },
  {
    id: 'hrv',
    title: 'HRV',
    detail: 'RMSSD or Apple SDNN',
    types: ['hrv_rmssd', 'hrv_sdnn'],
    icon: HeartPulse,
    gap: 'Connect a source that writes HRV to Health Connect or Apple Health.',
  },
  {
    id: 'rhr',
    title: 'Resting HR',
    detail: 'Daily resting heart rate',
    types: ['resting_heart_rate'],
    icon: HeartPulse,
    gap: 'Grant Resting heart rate access or connect a source that writes RHR.',
  },
  {
    id: 'heart-rate',
    title: 'Heart rate',
    detail: 'Daily average and range',
    types: ['heart_rate'],
    icon: HeartPulse,
    gap: 'Grant Heart rate access or connect a wearable HR source.',
  },
  {
    id: 'workouts',
    title: 'Workouts',
    detail: 'Deduped sessions',
    types: ['workout'],
    icon: Activity,
    gap: 'Grant Exercise access or connect Garmin, Strava, or another workout source.',
  },
  {
    id: 'activity',
    title: 'Daily activity',
    detail: 'Steps, energy, distance',
    types: ['steps', 'active_energy', 'total_energy', 'distance'],
    icon: Zap,
    gap: 'Grant activity permissions so steps, calories, and distance can sync.',
  },
  {
    id: 'nutrition',
    title: 'Nutrition',
    detail: 'Calories, macros, hydration',
    types: ['nutrition', 'hydration'],
    icon: Database,
    gap: 'Connect a nutrition or hydration source that writes to Health Connect.',
  },
  {
    id: 'body',
    title: 'Body composition',
    detail: 'Weight, fat, lean mass',
    types: ['weight', 'body_fat', 'lean_body_mass'],
    icon: ChartColumn,
    gap: 'Connect a scale or body composition source.',
  },
  {
    id: 'vo2',
    title: 'VO2 max',
    detail: 'Aerobic fitness estimate',
    types: ['vo2max'],
    icon: Route,
    gap: 'Connect a source that writes VO2 max estimates.',
  },
];

function toneColor(tone: PipelineSnapshot['recommendation']['color']) {
  if (tone === 'positive') return tokens.positive;
  if (tone === 'warm') return tokens.warm;
  if (tone === 'cool') return tokens.cool;
  return tokens.accent;
}

function formatNumber(value?: number, digits = 0): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatDateKey(date?: string): string {
  if (!date) {
    return formatDisplayDate(new Date());
  }

  return formatDisplayDate(`${date}T12:00:00`);
}

function metricLabel(type: CanonicalType): string {
  const labels: Partial<Record<CanonicalType, string>> = {
    active_energy: 'Active kcal',
    body_fat: 'Body fat',
    distance: 'Distance',
    heart_rate: 'Heart rate',
    hydration: 'Hydration',
    hrv_rmssd: 'HRV',
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

function dataAge(lastSync: LastSync): string {
  if (!lastSync) {
    return 'Never synced';
  }

  return `Last sync ${formatShortDateTime(lastSync.ended_at)}`;
}

function createCoachMessage(
  role: CoachConversationMessage['role'],
  text: string,
): CoachConversationMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
  };
}

function toOpenAiConversation(
  messages: CoachConversationMessage[],
): OpenAiCoachConversationMessage[] {
  return messages.map((message) => ({
    role: message.role === 'coach' ? 'assistant' : 'user',
    text: message.text,
  }));
}

function AppButton({
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
  const primary = variant === 'primary';
  const danger = variant === 'danger';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonPrimary,
        danger && styles.buttonDanger,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Icon
        color={primary ? tokens.surface : danger ? tokens.danger : tokens.ink}
        size={17}
        strokeWidth={2}
      />
      <Text
        style={[
          styles.buttonText,
          primary && styles.buttonPrimaryText,
          danger && styles.buttonDangerText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function CoachAvatar({ size = 34 }: { size?: number }) {
  return (
    <View style={styles.coachAvatarWrap}>
      <View
        style={[
          styles.coachAvatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        <Text style={[styles.coachAvatarText, { fontSize: size * 0.45 }]}>c</Text>
      </View>
      <View style={styles.coachOnlineDot} />
    </View>
  );
}

function Ring({
  value,
  color,
  size = 78,
  stroke = 7,
}: {
  value: number | null;
  color: string;
  size?: number;
  stroke?: number;
}) {
  const safeValue = value ?? 0;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeValue / 100) * circumference;

  return (
    <View style={{ width: size, height: size }}>
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={tokens.line}
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={color}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={stroke}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.ringCenter}>
          <Text style={styles.ringValue}>{value == null ? '—' : value}</Text>
        </View>
      </View>
    </View>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const width = 150;
  const height = 44;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((value, index) => {
    const x = (index / Math.max(1, data.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return [x, y];
  });
  const path = points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`)
    .join(' ');

  return (
    <Svg height={height} width="100%" viewBox={`0 0 ${width} ${height}`}>
      <Path d={path} fill="none" stroke={color} strokeLinecap="round" strokeWidth={2} />
    </Svg>
  );
}

function CoachLine({ children, first }: { children: string; first?: boolean }) {
  return (
    <View style={[styles.coachLine, first && styles.coachLineFirst]}>
      {first ? <CoachAvatar size={32} /> : <View style={styles.coachSpacer} />}
      <Text style={styles.coachText}>{children}</Text>
    </View>
  );
}

function UserBubble({ children }: { children: string }) {
  return (
    <View style={styles.userBubble}>
      <Text style={styles.userText}>{children}</Text>
    </View>
  );
}

function DataCard({
  label,
  children,
  accent,
  inset,
}: {
  label: string;
  children: React.ReactNode;
  accent?: string;
  inset?: boolean;
}) {
  return (
    <View style={[styles.dataCard, inset && styles.dataCardInset, accent && styles.dataCardWithAccent]}>
      {label ? (
        <View style={styles.dataCardHeader}>
          <View style={[styles.dataCardAccent, { backgroundColor: accent ?? tokens.accent }]} />
          <SectionLabel>{label}</SectionLabel>
        </View>
      ) : null}
      {children}
    </View>
  );
}

function SmallMetric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View style={styles.smallMetric}>
      <Text style={styles.smallMetricLabel}>{label}</Text>
      <Text style={styles.smallMetricValue}>{value}</Text>
      {sub ? <Text style={styles.smallMetricSub}>{sub}</Text> : null}
    </View>
  );
}

function CoachScreen({
  coachBusy,
  coachDraft,
  coachMessages,
  hasOpenAiApiKey,
  snapshot,
  lastSync,
  busy,
  status,
  warnings,
  onChangeCoachDraft,
  onSendCoachMessage,
  onSync,
  onOpenWorkout,
}: {
  coachBusy: boolean;
  coachDraft: string;
  coachMessages: CoachConversationMessage[];
  hasOpenAiApiKey: boolean;
  snapshot: PipelineSnapshot;
  lastSync: LastSync;
  busy: boolean;
  status: string;
  warnings: string[];
  onChangeCoachDraft: (value: string) => void;
  onSendCoachMessage: (message?: string) => void;
  onSync: () => void;
  onOpenWorkout: () => void;
}) {
  const current = snapshot.today;
  const recommendation = snapshot.recommendation;
  const accent = toneColor(recommendation.color);
  const plan = useMemo(() => generateTrainingPlan(snapshot, 'run'), [snapshot]);
  const sleep = current?.sleepSeconds ? formatDuration(current.sleepSeconds) : '—';
  const hrv = current?.hrvLastNightAvg ? `${Math.round(current.hrvLastNightAvg)} ms` : '—';
  const rhr = current?.restingHr ? `${Math.round(current.restingHr)} bpm` : '—';
  const quickReplies = ['Make it easier', 'Move it to tomorrow', "I'm short on time"];
  const canSendCoachMessage = hasOpenAiApiKey && !coachBusy && Boolean(coachDraft.trim());
  const composerPlaceholder = hasOpenAiApiKey
    ? 'Ask your coach...'
    : 'Save an OpenAI API key in You to chat';
  const hasSyncedData =
    snapshot.totalSamples > 0 ||
    snapshot.workoutCount > 0 ||
    snapshot.sleepCount > 0 ||
    snapshot.nutritionDays > 0 ||
    snapshot.coverageDays > 0;
  const feedRef = useRef<ScrollView | null>(null);

  function scrollFeedToEnd(animated = true) {
    requestAnimationFrame(() => {
      feedRef.current?.scrollToEnd({ animated });
    });
  }

  useEffect(() => {
    if (coachMessages.length || coachBusy) {
      scrollFeedToEnd();
    }
  }, [coachBusy, coachMessages.length]);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <CoachAvatar size={32} />
          <View>
            <Text style={styles.topTitle}>Coach</Text>
            <Text style={styles.topMeta}>
              {formatDateKey(current?.date)} · {dataAge(lastSync)}
            </Text>
          </View>
        </View>
        <MoreHorizontal color={tokens.muted} size={22} strokeWidth={2} />
      </View>

      <ScrollView
        contentContainerStyle={styles.feed}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (coachMessages.length || coachBusy) {
            scrollFeedToEnd();
          }
        }}
        ref={feedRef}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.dateDivider}>This morning</Text>
        <CoachLine first>Good morning Martin.</CoachLine>

        <DataCard accent={accent} inset label="Sleep & recovery">
          <View style={styles.sourceLine}>
            <Text style={styles.sourceLineText}>
              {current?.hasSleep ? 'Apple Watch' : 'Waiting for wearable data'}
            </Text>
            <Text style={styles.sourceLineText}>{dataAge(lastSync)}</Text>
          </View>
          <View style={styles.metricGridFull}>
            <SmallMetric label="Sleep" value={sleep} />
            <SmallMetric label="Score" value={formatNumber(recommendation.readiness ?? undefined)} />
            <SmallMetric label="HRV" value={hrv.replace(' ms', '')} />
            <SmallMetric label="RHR" value={rhr.replace(' bpm', '')} />
          </View>
          <Text style={styles.helpText}>{recommendation.reason}</Text>
        </DataCard>

        <Pressable accessibilityRole="button" onPress={onOpenWorkout}>
          <DataCard accent={tokens.ink} inset label="Today's workout">
            <View style={styles.planHeader}>
              <View style={styles.planIcon}>
                <Activity color={tokens.surface} size={18} strokeWidth={2} />
              </View>
              <View style={styles.planCopy}>
                <Text style={styles.planTitle}>{plan.today.title}</Text>
                <View style={styles.coachPlanStats}>
                  <Text style={styles.coachPlanStat}>{plan.today.durationMinutes}:00</Text>
                  <Text style={styles.coachPlanStat}>~7.2 km</Text>
                  <Text style={styles.coachPlanStat}>{plan.today.intensity}</Text>
                </View>
                <Text style={styles.planDetail}>
                  Your Apple Watch will capture distance, pace, heart rate, route, splits, and duration.
                </Text>
              </View>
              <ArrowRight color={tokens.muted} size={17} strokeWidth={2} />
            </View>
          </DataCard>
        </Pressable>

        {coachMessages.length ? <Text style={styles.dateDivider}>Coach conversation</Text> : null}
        {coachMessages.map((message) =>
          message.role === 'user' ? (
            <UserBubble key={message.id}>{message.text}</UserBubble>
          ) : (
            <CoachLine key={message.id}>{message.text}</CoachLine>
          ),
        )}
        {coachBusy ? (
          <CoachLine>Give me a second. I am checking your recent health data.</CoachLine>
        ) : null}

        {!hasSyncedData ? (
          <DataCard accent={tokens.accent} inset label="Datasource">
            <Text style={styles.helpText}>
              Health Connect is the source of truth. Syncing creates raw schema rows,
              then derives daily coaching metrics locally on this device.
            </Text>
            <View style={styles.singleAction}>
              <AppButton
                disabled={busy}
                icon={RefreshCw}
                label={busy ? status : 'Sync Health Connect'}
                onPress={onSync}
                variant="primary"
              />
            </View>
          </DataCard>
        ) : null}

        {warnings.length ? (
          <View style={styles.warningPanel}>
            {warnings.slice(0, 3).map((warning) => (
              <Text key={warning} style={styles.warningText}>
                {warning}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.chips}>
        {quickReplies.map((chip) => (
          <Pressable
            accessibilityRole="button"
            disabled={coachBusy || !hasOpenAiApiKey}
            key={chip}
            onPress={() => onSendCoachMessage(chip)}
            style={({ pressed }) => [
              styles.chip,
              (coachBusy || !hasOpenAiApiKey) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.chipText}>{chip}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.composer}>
        <View style={styles.composerInput}>
          <TextInput
            accessibilityLabel="Ask your coach"
            autoCorrect
            cursorColor={tokens.ink}
            editable={hasOpenAiApiKey && !coachBusy}
            onChangeText={onChangeCoachDraft}
            onSubmitEditing={() => onSendCoachMessage()}
            placeholder={composerPlaceholder}
            placeholderTextColor={tokens.muted}
            returnKeyType="send"
            selectionColor={tokens.ink}
            style={styles.composerTextInput}
            value={coachDraft}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={!canSendCoachMessage}
          onPress={() => onSendCoachMessage()}
          style={({ pressed }) => [
            styles.sendButton,
            !canSendCoachMessage && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {coachBusy ? (
            <ActivityIndicator color={tokens.surface} size="small" />
          ) : (
            <ArrowRight color={tokens.surface} size={18} strokeWidth={2.3} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

type CoachMessage = {
  id: string;
  role: 'user' | 'coach';
  text: string;
};

function workoutIconFor(workout: PlannedWorkout): LucideIcon {
  if (workout.sport === 'strength') return Dumbbell;
  if (workout.sport === 'ride') return Route;
  if (workout.sport === 'recovery') return Moon;
  return Activity;
}

function CapturePill({ workout }: { workout: PlannedWorkout }) {
  const copy =
    workout.capture === 'manual'
      ? 'Manual strength metrics'
      : workout.capture === 'watch'
        ? 'Watch captured'
        : 'No input needed';

  return (
    <View style={styles.capturePill}>
      <Text style={styles.capturePillText}>{copy}</Text>
    </View>
  );
}

function WorkoutDetail({ workout }: { workout: PlannedWorkout }) {
  const Icon = workoutIconFor(workout);

  return (
    <DataCard accent={tokens.ink} label={workout.label === 'Today' ? 'Workout today' : workout.label}>
      <View style={styles.planHeader}>
        <View style={styles.planIcon}>
          <Icon color={tokens.ink} size={20} strokeWidth={2} />
        </View>
        <View style={styles.planCopy}>
          <Text style={styles.planTitle}>{workout.title}</Text>
          <Text style={styles.planDetail}>{workout.detail}</Text>
        </View>
      </View>
      <View style={styles.workoutMetaRow}>
        <CapturePill workout={workout} />
        <Text style={styles.durationBadge}>
          {workout.durationMinutes ? `${workout.durationMinutes} min` : 'Rest'}
        </Text>
      </View>
      <Text style={styles.helpText}>{workout.reason}</Text>
      {workout.metrics.length ? (
        <View style={styles.metricTags}>
          {workout.metrics.map((metric) => (
            <View key={metric} style={styles.metricTag}>
              <Text style={styles.metricTagText}>{metric}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </DataCard>
  );
}

function EffortProfileCard() {
  return (
    <DataCard accent={tokens.ink} label="Effort profile">
      <View style={styles.effortHeader}>
        <Text style={styles.effortMeta}>Watch metrics</Text>
      </View>
      <View style={styles.effortChartLarge}>
        <Svg height={78} width="100%" viewBox="0 0 300 78" preserveAspectRatio="none">
          <Path
            d="M0,70 L38,66 L58,52 L76,44 L88,24 L100,40 L112,22 L124,39 L136,21 L148,39 L160,22 L172,40 L184,22 L196,39 L208,21 L220,38 L232,22 L244,44 L300,62 L300,78 L0,78 Z"
            fill="#deded8"
          />
          <Path
            d="M0,70 L38,66 L58,52 L76,44 L88,24 L100,40 L112,22 L124,39 L136,21 L148,39 L160,22 L172,40 L184,22 L196,39 L208,21 L220,38 L232,22 L244,44 L300,62"
            fill="none"
            stroke={tokens.ink}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </Svg>
      </View>
    </DataCard>
  );
}

function PlanDayRow({
  workout,
  selected,
  onPress,
}: {
  workout: PlannedWorkout;
  selected: boolean;
  onPress: () => void;
}) {
  const Icon = workoutIconFor(workout);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.planDayRow, selected && styles.planDayRowActive]}
    >
      <View style={styles.planDayLabel}>
        <Text style={styles.planDayText}>{workout.label}</Text>
      </View>
      <View style={styles.workoutIcon}>
        <Icon color={tokens.ink} size={18} strokeWidth={2} />
      </View>
      <View style={styles.workoutCopy}>
        <Text style={styles.workoutTitle}>{workout.title}</Text>
        <Text style={styles.workoutMeta}>
          {workout.durationMinutes ? `${workout.durationMinutes} min` : 'Rest'} · {workout.intensity}
        </Text>
      </View>
      <ArrowRight color={tokens.muted} size={17} strokeWidth={2} />
    </Pressable>
  );
}

function CoachDock({ plan }: { plan: TrainingPlan }) {
  const [collapsed, setCollapsed] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<CoachMessage[]>([]);

  function send() {
    const question = draft.trim();
    if (!question) return;

    const answer = answerCoachQuestion(question, plan);
    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-user`, role: 'user', text: question },
      { id: `${Date.now()}-coach`, role: 'coach', text: answer },
    ]);
    setDraft('');
    setCollapsed(false);
  }

  if (collapsed) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setCollapsed(false)} style={styles.coachBubbleButton}>
        <Sparkles color={tokens.surface} size={18} strokeWidth={2} />
      </Pressable>
    );
  }

  return (
    <View style={styles.coachDock}>
      {messages.length ? (
        <ScrollView
          contentContainerStyle={styles.coachDockMessages}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.coachDockMessagesScroll}
        >
          {messages.slice(-4).map((message) => (
            <View
              key={message.id}
              style={[
                styles.coachDockMessage,
                message.role === 'user' && styles.coachDockMessageUser,
              ]}
            >
              <Text
                style={[
                  styles.coachDockMessageText,
                  message.role === 'user' && styles.coachDockMessageTextUser,
                ]}
              >
                {message.text}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.coachDockInputRow}>
        <Sparkles color={tokens.ink} size={15} strokeWidth={2} />
        <TextInput
          cursorColor={tokens.ink}
          onChangeText={setDraft}
          onSubmitEditing={send}
          placeholder="Ask about today or the week..."
          placeholderTextColor={tokens.muted}
          returnKeyType="send"
          selectionColor={tokens.ink}
          style={styles.coachDockInput}
          value={draft}
        />
        <Mic color={tokens.muted} size={15} strokeWidth={2} />
        <Pressable
          accessibilityRole="button"
          onPress={draft.trim() ? send : () => setCollapsed(true)}
          style={[styles.coachDockSend, !draft.trim() && styles.coachDockCollapse]}
        >
          <ArrowRight color={draft.trim() ? tokens.surface : tokens.muted} size={18} strokeWidth={2.2} />
        </Pressable>
      </View>
    </View>
  );
}

function WorkoutPlanScreen({ snapshot }: { snapshot: PipelineSnapshot }) {
  const plan = useMemo(() => generateTrainingPlan(snapshot, 'run'), [snapshot]);
  const [selectedId, setSelectedId] = useState(plan.today.id);
  const selected = plan.week.find((workout) => workout.id === selectedId) ?? plan.today;
  const TodayIcon = workoutIconFor(plan.today);

  return (
    <View style={styles.screen}>
      <View style={styles.workoutTopBar}>
        <View style={styles.roundIconButton}>
          <Sparkles color={tokens.ink} size={16} strokeWidth={2} />
        </View>
        <SectionLabel>Workout</SectionLabel>
        <View style={styles.roundIconButton}>
          <MoreHorizontal color={tokens.ink} size={16} strokeWidth={2} />
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.workoutContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.workoutIntro}>Today · built from readiness</Text>
        <Text style={styles.workoutWelcome}>Welcome to today's workout</Text>
        <Text style={styles.workoutSubcopy}>
          One clear session for today, then a simple view of how the next seven days shape up.
        </Text>

        <SectionLabel>Workout today</SectionLabel>
        <DataCard accent={tokens.ink} label="">
          <View style={styles.planHeader}>
            <View style={styles.planIcon}>
              <TodayIcon color={tokens.surface} size={18} strokeWidth={2} />
            </View>
            <View style={styles.planCopy}>
              <Text style={styles.planTitle}>{plan.today.title}</Text>
              <View style={styles.coachPlanStats}>
                <Text style={styles.coachPlanStat}>{plan.today.durationMinutes}:00 total</Text>
                <Text style={styles.coachPlanStat}>~7.2 km</Text>
                <Text style={styles.coachPlanStat}>{plan.today.intensity}</Text>
              </View>
            </View>
          </View>
          <View style={styles.capturePanel}>
            <View style={styles.captureTitleRow}>
              <Moon color={tokens.inkSoft} size={13} strokeWidth={2} />
              <Text style={styles.captureTitle}>Captured by Apple Watch</Text>
            </View>
            <Text style={styles.planDetail}>
              Distance, pace, heart rate, route, splits, and duration will be recorded automatically.
            </Text>
          </View>
        </DataCard>

        <EffortProfileCard />

        <DataCard accent={tokens.accent} label="Why this, today">
          <Text style={styles.helpText}>{plan.whyToday}</Text>
        </DataCard>

        <SectionLabel>Plan</SectionLabel>
        <View style={styles.listCard}>
          {plan.week.map((workout) => (
            <PlanDayRow
              key={workout.id}
              onPress={() => setSelectedId(workout.id)}
              selected={selected.id === workout.id}
              workout={workout}
            />
          ))}
        </View>

        <WorkoutDetail workout={selected} />
        <CoachDock plan={plan} />
      </ScrollView>
      <View style={styles.workoutActions}>
        <Pressable accessibilityRole="button" style={styles.startWatchButton}>
          <Moon color={tokens.surface} size={16} strokeWidth={2} />
          <Text style={styles.startWatchText}>Start on Watch</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.scheduleButton}>
          <Text style={styles.scheduleText}>Schedule</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DayRow({ day }: { day: DailyMetrics }) {
  return (
    <View style={styles.dayRow}>
      <View style={styles.dayMain}>
        <Text style={styles.dayTitle}>{formatDateKey(day.date)}</Text>
        <Text style={styles.dayMeta}>
          {day.wellnessDataStatus} · {day.sourceCount} domains
        </Text>
      </View>
      <View style={styles.dayStats}>
        <Text style={styles.dayStat}>{formatNumber(day.steps)}</Text>
        <Text style={styles.dayStatLabel}>steps</Text>
      </View>
      <View style={styles.dayStats}>
        <Text style={styles.dayStat}>{formatDuration(day.sleepSeconds)}</Text>
        <Text style={styles.dayStatLabel}>sleep</Text>
      </View>
    </View>
  );
}

function WorkoutItem({ workout }: { workout: WorkoutRecord }) {
  const icon =
    workout.sportBucket === 'strength' ? Dumbbell : workout.sportBucket === 'ride' ? Route : Activity;
  const Icon = icon;

  return (
    <View style={styles.workoutRow}>
      <View style={styles.workoutIcon}>
        <Icon color={tokens.ink} size={18} strokeWidth={2} />
      </View>
      <View style={styles.workoutCopy}>
        <Text style={styles.workoutTitle}>{workout.name ?? workout.activityType ?? 'Workout'}</Text>
        <Text style={styles.workoutMeta}>
          {formatShortDateTime(workout.startAt)} · {formatDuration(workout.elapsedSeconds)}
        </Text>
      </View>
      <ArrowRight color={tokens.muted} size={17} strokeWidth={2} />
    </View>
  );
}

function SignalTrendChart({ history }: { history: DailyMetrics[] }) {
  const values = history
    .slice()
    .reverse()
    .slice(-7)
    .map((day) => day.hrvLastNightAvg ?? day.restingHr ?? 0);
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = 18 + (index / Math.max(values.length - 1, 1)) * 264;
    const y = 118 - ((value - min) / range) * 82;
    return [x, y];
  });
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ');

  return (
    <View style={styles.signalChart}>
      <View style={styles.signalChartHeader}>
        <View>
          <SectionLabel>HRV · 7-day</SectionLabel>
          <View style={styles.signalValueLine}>
            <Text style={styles.signalValue}>{formatNumber(values[values.length - 1], 0)}</Text>
            <Text style={styles.signalUnit}>ms</Text>
          </View>
        </View>
        <View style={styles.signalBaseline}>
          <Text style={styles.signalBaselineText}>vs baseline</Text>
          <Text style={styles.signalDelta}>+2 ms</Text>
        </View>
      </View>
      <Svg height={150} width="100%" viewBox="0 0 300 150" preserveAspectRatio="none">
        <Rect fill={tokens.surfaceAlt} height={82} width={264} x={18} y={44} />
        <Path d="M18,86 L282,86" stroke={tokens.line} strokeDasharray="4 4" strokeWidth={1.4} />
        <Path d={line} fill="none" stroke={tokens.cool} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} />
        {points.map(([x, y], index) => (
          <Circle cx={x} cy={y} fill={tokens.cool} key={`${x}-${y}-${index}`} r={3} />
        ))}
      </Svg>
      <View style={styles.signalDays}>
        {labels.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.signalDayText}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function HistoryScreen({ snapshot }: { snapshot: PipelineSnapshot }) {
  const [activeSignal, setActiveSignal] = useState('Recovery');
  const today = snapshot.today;
  const imported = snapshot.recentWorkouts.length
    ? snapshot.recentWorkouts.slice(0, 4)
    : [];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.historySignalContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.historyWindow}>Last 7 days</Text>
        <Text style={styles.historyTitle}>
          Your <Text style={styles.historyTitleItalic}>signal</Text>
        </Text>

        <View style={styles.signalTabs}>
          {['Recovery', 'Strain', 'Sleep', 'Body'].map((signal) => (
            <Pressable
              accessibilityRole="button"
              key={signal}
              onPress={() => setActiveSignal(signal)}
              style={[styles.signalTab, activeSignal === signal && styles.signalTabActive]}
            >
              <Text style={[styles.signalTabText, activeSignal === signal && styles.signalTabTextActive]}>
                {signal}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.summaryGrid}>
          <SmallMetric label="Raw samples" value={formatNumber(snapshot.totalSamples)} />
          <SmallMetric label="Workouts" value={formatNumber(snapshot.workoutCount)} />
          <SmallMetric label="Sleep nights" value={formatNumber(snapshot.sleepCount)} />
          <SmallMetric label="Nutrition days" value={formatNumber(snapshot.nutritionDays)} />
        </View>

        <SignalTrendChart history={snapshot.history} />

        <View style={styles.historyMiniGrid}>
          <View style={styles.historyMiniColumn}>
            <DataCard accent={tokens.cool} label="Sleep">
              <Text style={styles.historyMiniValue}>{formatDuration(today?.sleepSeconds)}</Text>
              <View style={styles.sleepBars}>
                {[0.62, 0.72, 0.66, 0.7, 0.55, 0.61, 0.82].map((height, index) => (
                  <View key={index} style={[styles.sleepBar, { height: 34 * height }]} />
                ))}
              </View>
            </DataCard>
          </View>
          <View style={styles.historyMiniColumn}>
            <DataCard accent={tokens.ink} label="RHR">
              <Text style={styles.historyMiniValue}>{formatNumber(today?.restingHr)} bpm</Text>
              <View style={styles.miniSparkWrap}>
                <Sparkline color={tokens.muted} data={[53, 51, 52, 50, 54, 55, today?.restingHr ?? 53]} />
              </View>
            </DataCard>
          </View>
        </View>

        <SectionLabel>Imported from Strava</SectionLabel>
        <View style={styles.listCard}>
          {imported.length ? (
            imported.map((workout) => <WorkoutItem key={workout.workoutId} workout={workout} />)
          ) : (
            <Text style={styles.emptyText}>No workouts imported yet.</Text>
          )}
        </View>
      </ScrollView>
      <CoachDock plan={generateTrainingPlan(snapshot, 'run')} />
    </View>
  );
}

function availabilityForTypes(
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

function AnalyticsScreen({ snapshot, lastSync }: { snapshot: PipelineSnapshot; lastSync: LastSync }) {
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
    <View style={styles.screen}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageEyebrow}>Pipeline scoreboard</Text>
        <Text style={styles.pageTitle}>Analytics</Text>
      </View>
      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
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
      </ScrollView>
    </View>
  );
}

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

function SourceScreen({
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

function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: 'coach', label: 'Coach', icon: Sparkles },
    { id: 'workout', label: 'Workout', icon: Dumbbell },
    { id: 'analytics', label: 'Analytics', icon: ChartColumn },
    { id: 'history', label: 'History', icon: History },
    { id: 'you', label: 'You', icon: User },
  ];

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const activeTab = active === tab.id;
        const Icon = tab.icon;

        return (
          <Pressable
            accessibilityRole="button"
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={styles.tabItem}
          >
            <Icon
              color={activeTab ? tokens.ink : tokens.muted}
              size={23}
              strokeWidth={activeTab ? 2.2 : 1.8}
            />
            <Text style={[styles.tabText, activeTab && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('coach');
  const [rangeDays, setRangeDays] = useState(baselineRangeDays);
  const [snapshot, setSnapshot] = useState<PipelineSnapshot>(emptySnapshot);
  const [lastSync, setLastSync] = useState<LastSync>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(emptyAppSettings);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [coachDraft, setCoachDraft] = useState('');
  const [coachMessages, setCoachMessages] = useState<CoachConversationMessage[]>([]);
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachResponseId, setCoachResponseId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const range = useMemo(() => makeSyncRange(rangeDays), [rangeDays]);
  const canSync = Platform.OS === 'ios' || Platform.OS === 'android';

  async function refreshStore() {
    const [nextSnapshot, nextLastSync] = await Promise.all([
      getPipelineSnapshot(),
      getLastSyncRun(),
    ]);
    setSnapshot(nextSnapshot);
    setLastSync(nextLastSync);
  }

  useEffect(() => {
    void initTrainingStore()
      .then(async () => {
        const nextSettings = await loadAppSettings();
        setAppSettings(nextSettings);
        setRangeDays(nextSettings.defaultSyncRangeDays);
        await refreshStore();
      })
      .catch((error) => setStatus(String(error instanceof Error ? error.message : error)));
  }, []);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  async function saveApiKey() {
    setSettingsBusy(true);
    try {
      const nextSettings = await saveOpenAiApiKey(apiKeyDraft);
      setAppSettings(nextSettings);
      setApiKeyDraft('');
      setStatus('OpenAI API key saved locally');
    } catch (error) {
      setStatus(String(error instanceof Error ? error.message : error));
    } finally {
      setSettingsBusy(false);
    }
  }

  async function removeApiKey() {
    setSettingsBusy(true);
    try {
      const nextSettings = await clearOpenAiApiKey();
      setAppSettings(nextSettings);
      setApiKeyDraft('');
      setStatus('OpenAI API key cleared');
    } catch (error) {
      setStatus(String(error instanceof Error ? error.message : error));
    } finally {
      setSettingsBusy(false);
    }
  }

  async function setDefaultSyncRange(days: number) {
    setSettingsBusy(true);
    try {
      const nextSettings = await saveAppSettings({ defaultSyncRangeDays: days });
      setAppSettings(nextSettings);
      setRangeDays(nextSettings.defaultSyncRangeDays);
      setStatus(`Default sync range set to ${nextSettings.defaultSyncRangeDays}d`);
    } catch (error) {
      setStatus(String(error instanceof Error ? error.message : error));
    } finally {
      setSettingsBusy(false);
    }
  }

  async function submitCoachMessage(messageOverride?: string) {
    const text = (messageOverride ?? coachDraft).trim();
    if (!text || coachBusy) {
      return;
    }

    const apiKey = await readOpenAiApiKey();
    if (!apiKey) {
      setStatus('Save an OpenAI API key in You before messaging the coach.');
      return;
    }

    const userMessage = createCoachMessage('user', text);
    const requestConversation = toOpenAiConversation(coachMessages);

    setCoachDraft('');
    setCoachMessages((messages) => [...messages, userMessage]);
    setCoachBusy(true);
    setStatus(`Coach is checking SQLite health data with ${openAiCoachModel}`);

    try {
      const freshSnapshot = await getPipelineSnapshot();
      const healthContext = await getCoachHealthContext({ rebuildDaily: false });
      setSnapshot(freshSnapshot);
      const response = await sendCoachMessage({
        apiKey,
        conversation: requestConversation,
        healthContext,
        previousResponseId: coachResponseId,
        snapshot: freshSnapshot,
        userMessage: text,
      });
      setCoachResponseId(response.responseId);
      setCoachMessages((messages) => [...messages, createCoachMessage('coach', response.text)]);
      setStatus(`Coach answered with ${openAiCoachModel}`);
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error);
      setStatus(message);
      setCoachMessages((messages) => [
        ...messages,
        createCoachMessage(
          'coach',
          `I couldn't reach the OpenAI API. ${message}`,
        ),
      ]);
    } finally {
      setCoachBusy(false);
    }
  }

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
      const saved = await upsertSyncPayload(result);
      await recordSyncRun(result.provider, range, saved, startedAt);
      setWarnings(result.warnings);
      setStatus(`Synced ${saved.toLocaleString()} records`);
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
    Alert.alert('Clear local data', 'Remove imported records, rollups, and sync history?', [
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.appShell}
      >
        {activeTab === 'coach' ? (
          <CoachScreen
            busy={busy}
            coachBusy={coachBusy}
            coachDraft={coachDraft}
            coachMessages={coachMessages}
            hasOpenAiApiKey={appSettings.hasOpenAiApiKey}
            lastSync={lastSync}
            onChangeCoachDraft={setCoachDraft}
            onSendCoachMessage={submitCoachMessage}
            onOpenWorkout={() => setActiveTab('workout')}
            onSync={runSync}
            snapshot={snapshot}
            status={status}
            warnings={warnings}
          />
        ) : null}
        {activeTab === 'workout' ? <WorkoutPlanScreen snapshot={snapshot} /> : null}
        {activeTab === 'analytics' ? (
          <AnalyticsScreen lastSync={lastSync} snapshot={snapshot} />
        ) : null}
        {activeTab === 'history' ? <HistoryScreen snapshot={snapshot} /> : null}
        {activeTab === 'you' ? (
          <SourceScreen
            apiKeyDraft={apiKeyDraft}
            appSettings={appSettings}
            busy={busy}
            lastSync={lastSync}
            onClear={confirmClear}
            onClearApiKey={removeApiKey}
            onExport={runExport}
            onSaveApiKey={saveApiKey}
            onSetDefaultRange={setDefaultSyncRange}
            onSync={runSync}
            rangeDays={rangeDays}
            setApiKeyDraft={setApiKeyDraft}
            setRangeDays={setRangeDays}
            settingsBusy={settingsBusy}
            snapshot={snapshot}
            status={status}
          />
        ) : null}
        {!keyboardVisible ? <TabBar active={activeTab} onChange={setActiveTab} /> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: tokens.bg,
    flex: 1,
  },
  appShell: {
    flex: 1,
    backgroundColor: tokens.bg,
  },
  screen: {
    flex: 1,
    backgroundColor: tokens.bg,
  },
  topBar: {
    alignItems: 'center',
    borderBottomColor: tokens.lineSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 7,
  },
  topBarLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  topTitle: {
    color: tokens.ink,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  topMeta: {
    color: tokens.muted,
    fontFamily: 'monospace',
    fontSize: 10.5,
    letterSpacing: 0,
    marginTop: 1,
  },
  coachAvatarWrap: {
    position: 'relative',
  },
  coachAvatar: {
    alignItems: 'center',
    backgroundColor: tokens.ink,
    justifyContent: 'center',
  },
  coachAvatarText: {
    color: tokens.surface,
    fontFamily: tokens.serif,
    fontStyle: 'italic',
    fontWeight: '700',
    lineHeight: 18,
  },
  coachOnlineDot: {
    backgroundColor: tokens.positive,
    borderColor: tokens.bg,
    borderRadius: 5,
    borderWidth: 2,
    bottom: -1,
    height: 9,
    position: 'absolute',
    right: -1,
    width: 9,
  },
  feed: {
    gap: 13,
    padding: 16,
    paddingBottom: 12,
  },
  dateDivider: {
    alignSelf: 'center',
    color: tokens.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  coachLine: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    maxWidth: '92%',
  },
  coachLineFirst: {
    marginTop: 2,
  },
  coachSpacer: {
    flexShrink: 0,
    width: 32,
  },
  coachText: {
    color: tokens.ink,
    flexShrink: 1,
    fontFamily: tokens.serif,
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 25,
    paddingHorizontal: 2,
    paddingVertical: 3,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: tokens.ink,
    borderRadius: 18,
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  userText: {
    color: tokens.surface,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
  },
  dataCard: {
    backgroundColor: tokens.surface,
    borderColor: tokens.lineSoft,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  dataCardInset: {
    marginLeft: 42,
  },
  dataCardWithAccent: {
    borderLeftWidth: 2,
  },
  dataCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  dataCardAccent: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  sectionLabel: {
    color: tokens.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  recoveryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  sourceLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  sourceLineText: {
    color: tokens.muted,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
  },
  recoveryCopy: {
    flex: 1,
    gap: 9,
  },
  readinessLine: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
  },
  readinessLabel: {
    color: tokens.ink,
    fontFamily: tokens.serif,
    fontSize: 18,
    fontStyle: 'italic',
    fontWeight: '500',
    letterSpacing: 0,
  },
  readinessMeta: {
    color: tokens.muted,
    fontSize: 12,
    letterSpacing: 0,
  },
  ringCenter: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  ringValue: {
    color: tokens.ink,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricGridFull: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  smallMetric: {
    backgroundColor: tokens.surfaceAlt,
    borderColor: tokens.lineSoft,
    borderRadius: 4,
    borderWidth: 1,
    minHeight: 62,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexBasis: '47%',
    flexGrow: 1,
  },
  smallMetricLabel: {
    color: tokens.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  smallMetricValue: {
    color: tokens.ink,
    fontFamily: tokens.serif,
    fontSize: 22,
    fontWeight: '400',
    letterSpacing: 0,
    marginTop: 4,
  },
  smallMetricSub: {
    color: tokens.muted,
    fontSize: 11,
    letterSpacing: 0,
    marginTop: 2,
  },
  planHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  planIcon: {
    alignItems: 'center',
    backgroundColor: tokens.ink,
    borderRadius: 99,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  planCopy: {
    flex: 1,
  },
  planTitle: {
    color: tokens.ink,
    fontFamily: tokens.serif,
    fontSize: 22,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 25,
  },
  planDetail: {
    color: tokens.muted,
    fontSize: 13,
    letterSpacing: 0,
    marginTop: 2,
    lineHeight: 18,
  },
  coachPlanStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 7,
  },
  coachPlanStat: {
    color: tokens.ink,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'capitalize',
  },
  effortChart: {
    backgroundColor: tokens.surfaceAlt,
    borderRadius: 8,
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  strainRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  strainLabel: {
    color: tokens.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  strainValue: {
    color: tokens.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  helpText: {
    color: tokens.inkSoft,
    fontSize: 13,
    letterSpacing: 0,
    lineHeight: 19,
  },
  contextRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  contextCopy: {
    flex: 1,
  },
  contextTitle: {
    color: tokens.ink,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
  contextText: {
    color: tokens.muted,
    fontSize: 11,
    letterSpacing: 0,
    lineHeight: 16,
    marginTop: 2,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentButton: {
    alignItems: 'center',
    backgroundColor: tokens.surfaceAlt,
    borderColor: tokens.lineSoft,
    borderRadius: 99,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 42,
    paddingHorizontal: 9,
  },
  segmentButtonActive: {
    backgroundColor: tokens.ink,
    borderColor: tokens.ink,
  },
  segmentButtonText: {
    color: tokens.inkSoft,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  segmentButtonTextActive: {
    color: tokens.surface,
  },
  singleAction: {
    marginTop: 2,
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
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  chips: {
    borderTopColor: tokens.lineSoft,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  chip: {
    backgroundColor: tokens.surface,
    borderColor: tokens.line,
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chipText: {
    color: tokens.inkSoft,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  composer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    borderBottomColor: tokens.lineSoft,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  composerInput: {
    backgroundColor: tokens.surface,
    borderColor: tokens.line,
    borderRadius: 99,
    borderWidth: 1,
    color: tokens.ink,
    flex: 1,
    fontSize: 14,
    height: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  composerTextInput: {
    color: tokens.ink,
    flex: 1,
    fontSize: 14,
    includeFontPadding: false,
    height: 40,
    letterSpacing: 0,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: tokens.ink,
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  pageHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  pageEyebrow: {
    color: tokens.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  pageTitle: {
    color: tokens.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 2,
  },
  pageContent: {
    gap: 14,
    padding: 18,
    paddingBottom: 28,
  },
  workoutTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8,
  },
  roundIconButton: {
    alignItems: 'center',
    backgroundColor: tokens.surface,
    borderColor: tokens.line,
    borderRadius: 99,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  workoutContent: {
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 112,
  },
  workoutIntro: {
    color: tokens.muted,
    fontSize: 12,
    letterSpacing: 0,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  listCard: {
    backgroundColor: tokens.surface,
    borderColor: tokens.lineSoft,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dayRow: {
    alignItems: 'center',
    borderBottomColor: tokens.lineSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 68,
    paddingHorizontal: 12,
  },
  dayMain: {
    flex: 1,
  },
  dayTitle: {
    color: tokens.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  dayMeta: {
    color: tokens.muted,
    fontSize: 12,
    letterSpacing: 0,
    marginTop: 2,
  },
  dayStats: {
    alignItems: 'flex-end',
    minWidth: 62,
  },
  dayStat: {
    color: tokens.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  dayStatLabel: {
    color: tokens.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  workoutRow: {
    alignItems: 'center',
    borderBottomColor: tokens.lineSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 66,
    paddingHorizontal: 12,
  },
  workoutIcon: {
    alignItems: 'center',
    backgroundColor: tokens.surfaceAlt,
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  workoutCopy: {
    flex: 1,
  },
  workoutTitle: {
    color: tokens.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  workoutMeta: {
    color: tokens.muted,
    fontSize: 12,
    letterSpacing: 0,
    marginTop: 2,
  },
  workoutWelcome: {
    color: tokens.ink,
    fontFamily: tokens.serif,
    fontSize: 29,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 34,
  },
  workoutSubcopy: {
    color: tokens.muted,
    fontSize: 14,
    letterSpacing: 0,
    lineHeight: 21,
  },
  workoutMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  capturePill: {
    backgroundColor: tokens.accentSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  capturePillText: {
    color: tokens.accentDeep,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  capturePanel: {
    backgroundColor: tokens.surfaceAlt,
    borderRadius: 4,
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  captureTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  captureTitle: {
    color: tokens.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  effortHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: -28,
  },
  effortMeta: {
    color: tokens.muted,
    fontSize: 12,
    letterSpacing: 0,
  },
  effortChartLarge: {
    height: 86,
    justifyContent: 'center',
  },
  durationBadge: {
    color: tokens.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  metricTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  metricTag: {
    backgroundColor: tokens.surfaceAlt,
    borderColor: tokens.lineSoft,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  metricTagText: {
    color: tokens.inkSoft,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
  },
  planDayRow: {
    alignItems: 'center',
    borderBottomColor: tokens.lineSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 68,
    paddingHorizontal: 12,
  },
  planDayRowActive: {
    backgroundColor: tokens.surfaceAlt,
  },
  planDayLabel: {
    alignItems: 'center',
    minWidth: 46,
  },
  planDayText: {
    color: tokens.muted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  coachDock: {
    backgroundColor: tokens.bg,
    borderTopColor: tokens.lineSoft,
    borderTopWidth: 1,
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  coachDockHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  coachDockTitle: {
    color: tokens.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  coachDockMessages: {
    gap: 7,
  },
  coachDockMessagesScroll: {
    maxHeight: 160,
  },
  coachDockMessage: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.surfaceAlt,
    borderColor: tokens.lineSoft,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: '90%',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  coachDockMessageUser: {
    alignSelf: 'flex-end',
    backgroundColor: tokens.ink,
    borderColor: tokens.ink,
  },
  coachDockMessageText: {
    color: tokens.inkSoft,
    fontSize: 13,
    letterSpacing: 0,
    lineHeight: 18,
  },
  coachDockMessageTextUser: {
    color: tokens.surface,
    fontWeight: '800',
  },
  coachDockInputRow: {
    alignItems: 'center',
    backgroundColor: tokens.surface,
    borderColor: tokens.line,
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 44,
    paddingLeft: 12,
    paddingRight: 4,
  },
  coachDockInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: tokens.ink,
    flex: 1,
    fontSize: 14,
    includeFontPadding: false,
    height: 42,
    lineHeight: 18,
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  coachDockSend: {
    alignItems: 'center',
    backgroundColor: tokens.ink,
    borderRadius: 99,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  coachDockCollapse: {
    backgroundColor: tokens.surface,
    borderColor: tokens.line,
    borderWidth: 1,
  },
  coachBubbleButton: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: tokens.ink,
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  workoutActions: {
    backgroundColor: tokens.bg,
    borderTopColor: tokens.lineSoft,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  startWatchButton: {
    alignItems: 'center',
    backgroundColor: tokens.ink,
    borderRadius: 14,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 50,
    justifyContent: 'center',
  },
  startWatchText: {
    color: tokens.surface,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  scheduleButton: {
    alignItems: 'center',
    backgroundColor: tokens.surface,
    borderColor: tokens.line,
    borderRadius: 14,
    borderWidth: 1,
    flex: 0.75,
    height: 50,
    justifyContent: 'center',
  },
  scheduleText: {
    color: tokens.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  historySignalContent: {
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  historyWindow: {
    color: tokens.muted,
    fontSize: 13,
    letterSpacing: 0,
  },
  historyTitle: {
    color: tokens.ink,
    fontFamily: tokens.serif,
    fontSize: 28,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 30,
    marginTop: -12,
  },
  historyTitleItalic: {
    fontStyle: 'italic',
  },
  signalTabs: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 4,
  },
  signalTab: {
    backgroundColor: tokens.surface,
    borderColor: tokens.line,
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  signalTabActive: {
    backgroundColor: tokens.ink,
    borderColor: tokens.ink,
  },
  signalTabText: {
    color: tokens.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
  },
  signalTabTextActive: {
    color: tokens.surface,
  },
  signalChart: {
    backgroundColor: tokens.surface,
    borderColor: tokens.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  signalChartHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signalValueLine: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  signalValue: {
    color: tokens.ink,
    fontFamily: tokens.serif,
    fontSize: 32,
    fontWeight: '400',
    letterSpacing: 0,
  },
  signalUnit: {
    color: tokens.inkSoft,
    fontSize: 13,
    letterSpacing: 0,
  },
  signalBaseline: {
    alignItems: 'flex-end',
  },
  signalBaselineText: {
    color: tokens.muted,
    fontSize: 12,
    letterSpacing: 0,
  },
  signalDelta: {
    color: tokens.positive,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 3,
  },
  signalDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 1,
    marginTop: -10,
  },
  signalDayText: {
    color: tokens.inkSoft,
    fontSize: 12,
    letterSpacing: 0,
  },
  historyMiniGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  historyMiniColumn: {
    flex: 1,
  },
  historyMiniValue: {
    color: tokens.ink,
    fontFamily: tokens.serif,
    fontSize: 25,
    fontWeight: '400',
    letterSpacing: 0,
  },
  sleepBars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 5,
    height: 38,
    marginTop: 10,
  },
  sleepBar: {
    backgroundColor: '#b6c5d3',
    borderRadius: 2,
    flex: 1,
  },
  miniSparkWrap: {
    height: 38,
    justifyContent: 'center',
    marginTop: 8,
  },
  emptyText: {
    color: tokens.muted,
    fontSize: 14,
    letterSpacing: 0,
    padding: 14,
  },
  connectCard: {
    backgroundColor: tokens.surface,
    borderColor: tokens.lineSoft,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  connectIcon: {
    alignItems: 'center',
    backgroundColor: tokens.accentSoft,
    borderRadius: 8,
    height: 54,
    justifyContent: 'center',
    marginBottom: 14,
    width: 54,
  },
  connectTitle: {
    color: tokens.ink,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
  },
  connectText: {
    color: tokens.inkSoft,
    fontSize: 13,
    letterSpacing: 0,
    lineHeight: 20,
    marginTop: 6,
  },
  connectMeta: {
    color: tokens.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 12,
  },
  rangeRow: {
    backgroundColor: tokens.bgDeep,
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
  rangeButtonActive: {
    backgroundColor: tokens.surface,
    borderColor: tokens.line,
    borderWidth: 1,
  },
  rangeButtonText: {
    color: tokens.muted,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  rangeButtonTextActive: {
    color: tokens.ink,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    alignItems: 'center',
    backgroundColor: tokens.surface,
    borderColor: tokens.line,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 10,
  },
  buttonPrimary: {
    backgroundColor: tokens.ink,
    borderColor: tokens.ink,
  },
  buttonDanger: {
    backgroundColor: '#fff4f2',
    borderColor: '#ffd4cc',
  },
  buttonText: {
    color: tokens.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  buttonPrimaryText: {
    color: tokens.surface,
  },
  buttonDangerText: {
    color: tokens.danger,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.78,
  },
  scoreList: {
    backgroundColor: tokens.surface,
    borderColor: tokens.line,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scoreRow: {
    alignItems: 'flex-start',
    borderBottomColor: tokens.lineSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 92,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  scoreIcon: {
    alignItems: 'center',
    backgroundColor: tokens.surfaceAlt,
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  scoreCopy: {
    flex: 1,
    gap: 5,
  },
  scoreTitleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  scoreTitle: {
    color: tokens.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  scoreBadge: {
    borderRadius: 6,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
    textTransform: 'uppercase',
  },
  scoreBadge_live: {
    backgroundColor: tokens.accentSoft,
    color: tokens.accentDeep,
  },
  scoreBadge_permission: {
    backgroundColor: '#fff4f2',
    color: tokens.danger,
  },
  scoreBadge_empty: {
    backgroundColor: '#fff7e7',
    color: '#8a5a00',
  },
  scoreBadge_unchecked: {
    backgroundColor: tokens.surfaceAlt,
    color: tokens.muted,
  },
  scoreMeta: {
    color: tokens.muted,
    fontSize: 12,
    letterSpacing: 0,
  },
  scoreTrack: {
    backgroundColor: tokens.lineSoft,
    borderRadius: 4,
    height: 7,
    overflow: 'hidden',
  },
  scoreFill: {
    backgroundColor: tokens.accent,
    borderRadius: 4,
    height: 7,
  },
  scoreDetail: {
    color: tokens.inkSoft,
    fontSize: 11,
    letterSpacing: 0,
    lineHeight: 16,
  },
  gapList: {
    backgroundColor: tokens.surface,
    borderColor: tokens.line,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gapRow: {
    borderBottomColor: tokens.lineSoft,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  gapTitle: {
    color: tokens.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  gapDetail: {
    color: tokens.muted,
    fontSize: 12,
    letterSpacing: 0,
    lineHeight: 17,
    marginTop: 3,
  },
  settingsCard: {
    backgroundColor: tokens.surface,
    borderColor: tokens.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  settingsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  settingsIcon: {
    alignItems: 'center',
    backgroundColor: tokens.accentSoft,
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  settingsCopy: {
    flex: 1,
  },
  settingsTitle: {
    color: tokens.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  settingsMeta: {
    color: tokens.muted,
    fontSize: 12,
    letterSpacing: 0,
    marginTop: 2,
  },
  apiKeyInput: {
    backgroundColor: tokens.surfaceAlt,
    borderColor: tokens.lineSoft,
    borderRadius: 8,
    borderWidth: 1,
    color: tokens.ink,
    fontSize: 14,
    letterSpacing: 0,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  settingDivider: {
    backgroundColor: tokens.lineSoft,
    height: 1,
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  settingSegments: {
    backgroundColor: tokens.bgDeep,
    borderRadius: 8,
    flexDirection: 'row',
    padding: 3,
  },
  settingSegment: {
    alignItems: 'center',
    borderRadius: 6,
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 48,
    paddingHorizontal: 8,
  },
  settingSegmentActive: {
    backgroundColor: tokens.surface,
    borderColor: tokens.line,
    borderWidth: 1,
  },
  settingSegmentText: {
    color: tokens.muted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  settingSegmentTextActive: {
    color: tokens.ink,
  },
  permissionList: {
    backgroundColor: tokens.surface,
    borderColor: tokens.line,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  permissionRow: {
    alignItems: 'center',
    borderBottomColor: tokens.lineSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 14,
  },
  permissionCopy: {
    flex: 1,
  },
  permissionTitle: {
    color: tokens.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  permissionDetail: {
    color: tokens.muted,
    fontSize: 12,
    letterSpacing: 0,
    marginTop: 2,
  },
  diagnosticList: {
    backgroundColor: tokens.surface,
    borderColor: tokens.line,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  diagnosticRow: {
    alignItems: 'flex-start',
    borderBottomColor: tokens.lineSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  diagnosticDot: {
    backgroundColor: tokens.line,
    borderRadius: 5,
    height: 10,
    marginTop: 4,
    width: 10,
  },
  diagnosticDotActive: {
    backgroundColor: tokens.positive,
  },
  diagnosticCopy: {
    flex: 1,
  },
  diagnosticTitle: {
    color: tokens.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  diagnosticDetail: {
    color: tokens.muted,
    fontSize: 11,
    letterSpacing: 0,
    lineHeight: 16,
    marginTop: 2,
  },
  toggle: {
    backgroundColor: tokens.line,
    borderRadius: 8,
    height: 24,
    justifyContent: 'center',
    paddingHorizontal: 2,
    width: 40,
  },
  toggleActive: {
    backgroundColor: tokens.ink,
  },
  toggleKnob: {
    alignItems: 'center',
    backgroundColor: tokens.surface,
    borderRadius: 8,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  toggleKnobActive: {
    marginLeft: 16,
  },
  privacyCard: {
    alignItems: 'flex-start',
    backgroundColor: tokens.surfaceAlt,
    borderColor: tokens.lineSoft,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  privacyText: {
    color: tokens.muted,
    flex: 1,
    fontSize: 12,
    letterSpacing: 0,
    lineHeight: 18,
  },
  tabBar: {
    backgroundColor: tokens.surface,
    borderTopColor: tokens.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 5,
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
    minHeight: 50,
    justifyContent: 'center',
  },
  tabText: {
    color: tokens.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
  },
  tabTextActive: {
    color: tokens.ink,
    fontWeight: '900',
  },
});
