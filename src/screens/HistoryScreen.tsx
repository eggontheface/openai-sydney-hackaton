import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Activity, ArrowRight, Dumbbell, Route } from 'lucide-react-native';

import { generateTrainingPlan } from '../coach/planEngine';
import { formatDateKey, formatNumber, hrvMetricLabel } from '../core/formatters';
import type { DailyMetrics, PipelineSnapshot, WorkoutRecord } from '../health/types';
import { formatDuration, formatShortDateTime } from '../lib/dates';
import { styles } from '../styles/appStyles';
import { tokens } from '../theme/tokens';
import { CoachDock } from '../ui/CoachDock';
import { DataCard, SectionLabel, SmallMetric, Sparkline } from '../ui/primitives';

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
  const chronological = history.slice().reverse();
  const hrvDays = chronological.filter((day) => day.hrvLastNightAvg != null);
  const latestHrvDay = hrvDays[hrvDays.length - 1];
  const compatibleDays = latestHrvDay
    ? chronological.filter((day) => {
        if (day.hrvLastNightAvg == null || day.hrvMethod !== latestHrvDay.hrvMethod) {
          return false;
        }
        if (
          day.hrvCanonicalType &&
          latestHrvDay.hrvCanonicalType &&
          day.hrvCanonicalType !== latestHrvDay.hrvCanonicalType
        ) {
          return false;
        }

        if (day.hrvSourceKey || latestHrvDay.hrvSourceKey) {
          return day.hrvSourceKey === latestHrvDay.hrvSourceKey;
        }

        return true;
      })
    : [];
  const chartDays = compatibleDays.slice(-7);
  const values = chartDays.map((day) => day.hrvLastNightAvg ?? 0);
  const labels = chartDays.map((day) =>
    new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1),
  );
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = 18 + (index / Math.max(values.length - 1, 1)) * 264;
    const y = 118 - ((value - min) / range) * 82;
    return [x, y];
  });
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const latestValue = values[values.length - 1];
  const baselineValues = values.slice(0, -1);
  const baseline = baselineValues.length
    ? baselineValues.reduce((sum, value) => sum + value, 0) / baselineValues.length
    : undefined;
  const delta = latestValue != null && baseline != null ? latestValue - baseline : undefined;
  const sectionTitle = `${hrvMetricLabel(latestHrvDay)} · 7-day`;

  return (
    <View style={styles.signalChart}>
      <View style={styles.signalChartHeader}>
        <View>
          <SectionLabel>{sectionTitle}</SectionLabel>
          <View style={styles.signalValueLine}>
            <Text style={styles.signalValue}>{formatNumber(latestValue, 0)}</Text>
            <Text style={styles.signalUnit}>ms</Text>
          </View>
        </View>
        <View style={styles.signalBaseline}>
          <Text style={styles.signalBaselineText}>vs baseline</Text>
          <Text style={styles.signalDelta}>
            {delta == null ? '—' : `${delta > 0 ? '+' : ''}${formatNumber(delta, 0)} ms`}
          </Text>
        </View>
      </View>
      <Svg height={150} width="100%" viewBox="0 0 300 150" preserveAspectRatio="none">
        <Rect fill={tokens.surfaceAlt} height={82} width={264} x={18} y={44} />
        <Path d="M18,86 L282,86" stroke={tokens.line} strokeDasharray="4 4" strokeWidth={1.4} />
        {line ? (
          <Path d={line} fill="none" stroke={tokens.cool} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} />
        ) : null}
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

export function HistoryScreen({ snapshot }: { snapshot: PipelineSnapshot }) {
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
