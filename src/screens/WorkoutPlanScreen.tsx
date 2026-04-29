import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import {
  Activity,
  ArrowRight,
  Dumbbell,
  Moon,
  MoreHorizontal,
  Route,
  Sparkles,
  type LucideIcon,
} from "lucide-react-native";

import {
  generateTrainingPlan,
  resolveTrainingGoal,
  type PlannedWorkout,
} from "../coach/planEngine";
import type { PipelineSnapshot } from "../health/types";
import { styles } from "../styles/appStyles";
import { tokens } from "../theme/tokens";
import { CoachDock } from "../ui/CoachDock";
import { DataCard, SectionLabel } from "../ui/primitives";

function workoutIconFor(workout: PlannedWorkout): LucideIcon {
  if (workout.sport === "strength") return Dumbbell;
  if (workout.sport === "ride") return Route;
  if (workout.sport === "recovery") return Moon;
  return Activity;
}

function CapturePill({ workout }: { workout: PlannedWorkout }) {
  const copy =
    workout.capture === "manual"
      ? "Manual strength metrics"
      : workout.capture === "watch"
        ? "Watch captured"
        : "No input needed";

  return (
    <View style={styles.capturePill}>
      <Text style={styles.capturePillText}>{copy}</Text>
    </View>
  );
}

function WorkoutDetail({ workout }: { workout: PlannedWorkout }) {
  const Icon = workoutIconFor(workout);

  return (
    <DataCard
      accent={tokens.accent}
      label={workout.label === "Today" ? "Workout today" : workout.label}
    >
      <View style={styles.planHeader}>
        <View style={styles.planIcon}>
          <Icon color={tokens.surface} size={20} strokeWidth={2} />
        </View>
        <View style={styles.planCopy}>
          <Text style={styles.planTitle}>{workout.title}</Text>
          <Text style={styles.planDetail}>{workout.detail}</Text>
        </View>
      </View>
      <View style={styles.workoutMetaRow}>
        <CapturePill workout={workout} />
        <Text style={styles.durationBadge}>
          {workout.durationMinutes ? `${workout.durationMinutes} min` : "Rest"}
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
    <DataCard accent={tokens.accent} label="Effort profile">
      <View style={styles.effortHeader}>
        <Text style={styles.effortMeta}>Watch metrics</Text>
      </View>
      <View style={styles.effortChartLarge}>
        <Svg
          height={78}
          width="100%"
          viewBox="0 0 300 78"
          preserveAspectRatio="none"
        >
          <Path
            d="M0,70 L38,66 L58,52 L76,44 L88,24 L100,40 L112,22 L124,39 L136,21 L148,39 L160,22 L172,40 L184,22 L196,39 L208,21 L220,38 L232,22 L244,44 L300,62 L300,78 L0,78 Z"
            fill={tokens.accentSoft}
          />
          <Path
            d="M0,70 L38,66 L58,52 L76,44 L88,24 L100,40 L112,22 L124,39 L136,21 L148,39 L160,22 L172,40 L184,22 L196,39 L208,21 L220,38 L232,22 L244,44 L300,62"
            fill="none"
            stroke={tokens.accent}
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
        <Icon color={tokens.accent} size={18} strokeWidth={2} />
      </View>
      <View style={styles.workoutCopy}>
        <Text style={styles.workoutTitle}>{workout.title}</Text>
        <Text style={styles.workoutMeta}>
          {workout.durationMinutes ? `${workout.durationMinutes} min` : "Rest"}{" "}
          · {workout.intensity}
        </Text>
      </View>
      <ArrowRight color={tokens.muted} size={17} strokeWidth={2} />
    </Pressable>
  );
}

export function WorkoutPlanScreen({
  goalText,
  snapshot,
}: {
  goalText: string;
  snapshot: PipelineSnapshot;
}) {
  const plan = useMemo(
    () => generateTrainingPlan(snapshot, resolveTrainingGoal(goalText)),
    [goalText, snapshot],
  );
  const [selectedId, setSelectedId] = useState(plan.today.id);
  const [actionMessage, setActionMessage] = useState("");
  const selected =
    plan.week.find((workout) => workout.id === selectedId) ?? plan.today;
  const TodayIcon = workoutIconFor(plan.today);
  const wearableLabel =
    Platform.OS === "ios"
      ? "Apple Watch"
      : Platform.OS === "android"
        ? "connected wearable"
        : "demo wearable";

  return (
    <View style={styles.screen}>
      <View style={styles.workoutTopBar}>
        <Pressable
          accessibilityLabel="Ask coach about workout"
          accessibilityRole="button"
          onPress={() =>
            setActionMessage(
              "Use the coach box below to ask about today or the week.",
            )
          }
          style={styles.roundIconButton}
        >
          <Sparkles color={tokens.accent} size={16} strokeWidth={2} />
        </Pressable>
        <SectionLabel>Workout</SectionLabel>
        <Pressable
          accessibilityLabel="Workout options"
          accessibilityRole="button"
          onPress={() =>
            setActionMessage(
              "Workout options are coming with native scheduling and wearable start integration.",
            )
          }
          style={styles.roundIconButton}
        >
          <MoreHorizontal color={tokens.accent} size={16} strokeWidth={2} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.workoutContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.workoutIntro}>Today · built from readiness</Text>
        <Text style={styles.workoutWelcome}>Welcome to today's workout</Text>
        <Text style={styles.workoutSubcopy}>
          One clear session for today, then a simple view of how the next seven
          days shape up.
        </Text>

        <SectionLabel>Workout today</SectionLabel>
        <DataCard accent={tokens.accent} label="">
          <View style={styles.planHeader}>
            <View style={styles.planIcon}>
              <TodayIcon color={tokens.surface} size={18} strokeWidth={2} />
            </View>
            <View style={styles.planCopy}>
              <Text style={styles.planTitle}>{plan.today.title}</Text>
              <View style={styles.coachPlanStats}>
                <Text style={styles.coachPlanStat}>
                  {plan.today.durationMinutes}:00 total
                </Text>
                <Text style={styles.coachPlanStat}>~7.2 km</Text>
                <Text style={styles.coachPlanStat}>{plan.today.intensity}</Text>
              </View>
            </View>
          </View>
          <View style={styles.capturePanel}>
            <View style={styles.captureTitleRow}>
              <Moon color={tokens.inkSoft} size={13} strokeWidth={2} />
              <Text style={styles.captureTitle}>
                Captured by {wearableLabel}
              </Text>
            </View>
            <Text style={styles.planDetail}>
              Distance, pace, heart rate, route, splits, and duration will be
              recorded automatically.
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
        {actionMessage ? (
          <View style={styles.warningPanel}>
            <Text style={styles.warningText}>{actionMessage}</Text>
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.workoutActions}>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            setActionMessage(
              Platform.OS === "web"
                ? "Starting on a wearable is available in a native mobile build."
                : "Wearable start is queued for native workout integration.",
            )
          }
          style={styles.startWatchButton}
        >
          <Moon color={tokens.surface} size={16} strokeWidth={2} />
          <Text style={styles.startWatchText}>Start on wearable</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            setActionMessage(
              `${selected.title} is ready to schedule once calendar integration is connected.`,
            )
          }
          style={styles.scheduleButton}
        >
          <Text style={styles.scheduleText}>Schedule</Text>
        </Pressable>
      </View>
    </View>
  );
}
