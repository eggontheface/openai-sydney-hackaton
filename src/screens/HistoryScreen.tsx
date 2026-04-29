import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { Activity, ArrowRight, Dumbbell, Route } from "lucide-react-native";

import { generateTrainingPlan, resolveTrainingGoal } from "../coach/planEngine";
import {
  formatDateKey,
  formatNumber,
  hrvMetricLabel,
} from "../core/formatters";
import type {
  DailyMetrics,
  PipelineSnapshot,
  WorkoutRecord,
} from "../health/types";
import { formatDuration, formatShortDateTime } from "../lib/dates";
import { styles } from "../styles/appStyles";
import { tokens } from "../theme/tokens";
import { CoachDock } from "../ui/CoachDock";
import {
  DataCard,
  SectionLabel,
  SmallMetric,
  Sparkline,
} from "../ui/primitives";

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
    workout.sportBucket === "strength"
      ? Dumbbell
      : workout.sportBucket === "ride"
        ? Route
        : Activity;
  const Icon = icon;

  return (
    <View style={styles.workoutRow}>
      <View style={styles.workoutIcon}>
        <Icon color={tokens.accent} size={18} strokeWidth={2} />
      </View>
      <View style={styles.workoutCopy}>
        <Text style={styles.workoutTitle}>
          {workout.name ?? workout.activityType ?? "Workout"}
        </Text>
        <Text style={styles.workoutMeta}>
          {formatShortDateTime(workout.startAt)} ·{" "}
          {formatDuration(workout.elapsedSeconds)}
        </Text>
      </View>
      <ArrowRight color={tokens.muted} size={17} strokeWidth={2} />
    </View>
  );
}

function valueForSignal(day: DailyMetrics, signal: string): number | null {
  if (signal === "Sleep")
    return day.sleepSeconds == null ? null : day.sleepSeconds / 3600;
  if (signal === "Strain") return day.steps ?? day.distanceKm ?? null;
  if (signal === "Body") return day.weightKg ?? day.restingHr ?? null;
  return day.hrvLastNightAvg ?? null;
}

function signalUnit(signal: string, day?: DailyMetrics): string {
  if (signal === "Sleep") return "hrs";
  if (signal === "Strain") return day?.steps != null ? "steps" : "km";
  if (signal === "Body") return day?.weightKg != null ? "kg" : "bpm";
  return "ms";
}

function signalTitle(signal: string, day?: DailyMetrics): string {
  if (signal === "Sleep") return "Sleep duration · 7-day";
  if (signal === "Strain")
    return day?.steps != null ? "Steps · 7-day" : "Distance · 7-day";
  if (signal === "Body")
    return day?.weightKg != null ? "Weight · 7-day" : "Resting HR · 7-day";
  return `${hrvMetricLabel(day)} · 7-day`;
}

function SignalTrendChart({
  activeSignal,
  history,
}: {
  activeSignal: string;
  history: DailyMetrics[];
}) {
  const chronological = history.slice().reverse();
  const signalDays = chronological.filter(
    (day) => valueForSignal(day, activeSignal) != null,
  );
  const latestSignalDay = signalDays[signalDays.length - 1];
  const compatibleDays =
    activeSignal === "Recovery" && latestSignalDay
      ? chronological.filter((day) => {
          if (
            day.hrvLastNightAvg == null ||
            day.hrvMethod !== latestSignalDay.hrvMethod
          ) {
            return false;
          }
          if (
            day.hrvCanonicalType &&
            latestSignalDay.hrvCanonicalType &&
            day.hrvCanonicalType !== latestSignalDay.hrvCanonicalType
          ) {
            return false;
          }

          if (day.hrvSourceKey || latestSignalDay.hrvSourceKey) {
            return day.hrvSourceKey === latestSignalDay.hrvSourceKey;
          }

          return true;
        })
      : signalDays;
  const chartDays = compatibleDays.slice(-7);
  const values = chartDays.map((day) => valueForSignal(day, activeSignal) ?? 0);
  const labels = chartDays.map((day) =>
    new Date(`${day.date}T12:00:00`)
      .toLocaleDateString(undefined, { weekday: "short" })
      .slice(0, 1),
  );
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = 18 + (index / Math.max(values.length - 1, 1)) * 264;
    const y = 118 - ((value - min) / range) * 82;
    return [x, y];
  });
  const line = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`)
    .join(" ");
  const latestValue = values[values.length - 1];
  const baselineValues = values.slice(0, -1);
  const baseline = baselineValues.length
    ? baselineValues.reduce((sum, value) => sum + value, 0) /
      baselineValues.length
    : undefined;
  const delta =
    latestValue != null && baseline != null
      ? latestValue - baseline
      : undefined;
  const unit = signalUnit(activeSignal, latestSignalDay);
  const sectionTitle = signalTitle(activeSignal, latestSignalDay);
  const digits =
    activeSignal === "Sleep" ||
    (activeSignal === "Strain" && latestSignalDay?.steps == null)
      ? 1
      : 0;

  return (
    <View style={styles.signalChart}>
      <View style={styles.signalChartHeader}>
        <View>
          <SectionLabel>{sectionTitle}</SectionLabel>
          <View style={styles.signalValueLine}>
            <Text style={styles.signalValue}>
              {formatNumber(latestValue, digits)}
            </Text>
            <Text style={styles.signalUnit}>{unit}</Text>
          </View>
        </View>
        <View style={styles.signalBaseline}>
          <Text style={styles.signalBaselineText}>vs baseline</Text>
          <Text style={styles.signalDelta}>
            {delta == null
              ? "—"
              : `${delta > 0 ? "+" : ""}${formatNumber(delta, digits)} ${unit}`}
          </Text>
        </View>
      </View>
      <Svg
        height={150}
        width="100%"
        viewBox="0 0 300 150"
        preserveAspectRatio="none"
      >
        <Rect
          fill={tokens.accentWash}
          height={82}
          rx={8}
          width={264}
          x={18}
          y={44}
        />
        <Path
          d="M18,86 L282,86"
          stroke={tokens.line}
          strokeDasharray="4 4"
          strokeWidth={1.4}
        />
        {line ? (
          <Path
            d={line}
            fill="none"
            stroke={tokens.accent}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.4}
          />
        ) : null}
        {points.map(([x, y], index) => (
          <Circle
            cx={x}
            cy={y}
            fill={tokens.brass}
            key={`${x}-${y}-${index}`}
            r={3}
          />
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

function HistorySignalPanel({
  activeSignal,
  history,
  today,
}: {
  activeSignal: string;
  history: DailyMetrics[];
  today: DailyMetrics | null;
}) {
  const recentRestingHr = history
    .slice(0, 7)
    .reverse()
    .map((day) => day.restingHr)
    .filter((value): value is number => value != null);

  if (activeSignal === "Strain") {
    const recent = history.slice(0, 7).reverse();
    const strainData = recent.map(
      (day) => day.activityElapsedSeconds ?? day.steps ?? 0,
    );

    return (
      <>
        <DataCard accent={tokens.accent} label="Training load">
          <Text style={styles.historyMiniValue}>
            {formatDuration(today?.activityElapsedSeconds)}
          </Text>
          <View style={styles.miniSparkWrap}>
            <Sparkline
              color={tokens.accent}
              data={strainData.length ? strainData : [0]}
            />
          </View>
        </DataCard>
        <View style={styles.historyMiniGrid}>
          <View style={styles.historyMiniColumn}>
            <DataCard accent={tokens.brass} label="Active kcal">
              <Text style={styles.historyMiniValue}>
                {formatNumber(today?.activeKcal)}
              </Text>
            </DataCard>
          </View>
          <View style={styles.historyMiniColumn}>
            <DataCard accent={tokens.accent} label="Distance">
              <Text style={styles.historyMiniValue}>
                {formatNumber(today?.distanceKm, 1)} km
              </Text>
            </DataCard>
          </View>
        </View>
      </>
    );
  }

  if (activeSignal === "Sleep") {
    return (
      <View style={styles.historyMiniGrid}>
        <View style={styles.historyMiniColumn}>
          <DataCard accent={tokens.cool} label="Sleep">
            <Text style={styles.historyMiniValue}>
              {formatDuration(today?.sleepSeconds)}
            </Text>
            <View style={styles.sleepBars}>
              {history
                .slice(0, 7)
                .reverse()
                .map((day) => {
                  const hours = (day.sleepSeconds ?? 0) / 3600;
                  return (
                    <View
                      key={day.date}
                      style={[
                        styles.sleepBar,
                        { height: Math.max(8, Math.min(34, hours * 4)) },
                      ]}
                    />
                  );
                })}
            </View>
          </DataCard>
        </View>
        <View style={styles.historyMiniColumn}>
          <DataCard accent={tokens.accent} label="Efficiency">
            <Text style={styles.historyMiniValue}>
              {today?.sleepEfficiency == null
                ? "—"
                : `${formatNumber(today.sleepEfficiency * 100)}%`}
            </Text>
          </DataCard>
        </View>
      </View>
    );
  }

  if (activeSignal === "Body") {
    return (
      <View style={styles.historyMiniGrid}>
        <View style={styles.historyMiniColumn}>
          <DataCard accent={tokens.accent} label="Weight">
            <Text style={styles.historyMiniValue}>
              {formatNumber(today?.weightKg, 1)} kg
            </Text>
          </DataCard>
        </View>
        <View style={styles.historyMiniColumn}>
          <DataCard accent={tokens.brass} label="VO2 max">
            <Text style={styles.historyMiniValue}>
              {formatNumber(today?.vo2max, 0)}
            </Text>
          </DataCard>
        </View>
      </View>
    );
  }

  return (
    <>
      <SignalTrendChart activeSignal={activeSignal} history={history} />
      <View style={styles.historyMiniGrid}>
        <View style={styles.historyMiniColumn}>
          <DataCard accent={tokens.cool} label="Sleep">
            <Text style={styles.historyMiniValue}>
              {formatDuration(today?.sleepSeconds)}
            </Text>
            <View style={styles.sleepBars}>
              {history
                .slice(0, 7)
                .reverse()
                .map((day) => {
                  const hours = (day.sleepSeconds ?? 0) / 3600;
                  return (
                    <View
                      key={day.date}
                      style={[
                        styles.sleepBar,
                        { height: Math.max(8, Math.min(34, hours * 4)) },
                      ]}
                    />
                  );
                })}
            </View>
          </DataCard>
        </View>
        <View style={styles.historyMiniColumn}>
          <DataCard accent={tokens.accent} label="RHR">
            <Text style={styles.historyMiniValue}>
              {formatNumber(today?.restingHr)} bpm
            </Text>
            <View style={styles.miniSparkWrap}>
              <Sparkline
                color={tokens.accent}
                data={
                  recentRestingHr.length
                    ? recentRestingHr
                    : [today?.restingHr ?? 0]
                }
              />
            </View>
          </DataCard>
        </View>
      </View>
    </>
  );
}

export function HistoryScreen({
  goalText,
  snapshot,
}: {
  goalText: string;
  snapshot: PipelineSnapshot;
}) {
  const [activeSignal, setActiveSignal] = useState("Recovery");
  const today = snapshot.today;
  const imported = snapshot.recentWorkouts.length
    ? snapshot.recentWorkouts.slice(0, 4)
    : [];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.historySignalContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.historyWindow}>Last 7 days</Text>
        <Text style={styles.historyTitle}>
          Your <Text style={styles.historyTitleItalic}>signal</Text>
        </Text>

        <View style={styles.signalTabs}>
          {["Recovery", "Strain", "Sleep", "Body"].map((signal) => (
            <Pressable
              accessibilityRole="button"
              key={signal}
              onPress={() => setActiveSignal(signal)}
              style={[
                styles.signalTab,
                activeSignal === signal && styles.signalTabActive,
              ]}
            >
              <Text
                style={[
                  styles.signalTabText,
                  activeSignal === signal && styles.signalTabTextActive,
                ]}
              >
                {signal}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.summaryGrid}>
          <SmallMetric
            label="Raw samples"
            value={formatNumber(snapshot.totalSamples)}
          />
          <SmallMetric
            label="Workouts"
            value={formatNumber(snapshot.workoutCount)}
          />
          <SmallMetric
            label="Sleep nights"
            value={formatNumber(snapshot.sleepCount)}
          />
          <SmallMetric
            label="Nutrition days"
            value={formatNumber(snapshot.nutritionDays)}
          />
        </View>

        <HistorySignalPanel
          activeSignal={activeSignal}
          history={snapshot.history}
          today={today}
        />

        <SectionLabel>Imported from Strava</SectionLabel>
        <View style={styles.listCard}>
          {imported.length ? (
            imported.map((workout) => (
              <WorkoutItem key={workout.workoutId} workout={workout} />
            ))
          ) : (
            <Text style={styles.emptyText}>No workouts imported yet.</Text>
          )}
        </View>
      </ScrollView>
      <CoachDock
        plan={generateTrainingPlan(snapshot, resolveTrainingGoal(goalText))}
      />
    </View>
  );
}
