import type { WorkoutRecord } from "../health/types";
import type { RiskFlagSeverity, RiskFlags, RiskFlagSource } from "./schemas";

export type TrainingState =
  | "first_time_athlete"
  | "returning_after_extended_gap"
  | "inconsistent_or_low_recent_activity"
  | "consistent_recreational_athlete"
  | "advanced_athlete"
  | "currently_limited"
  | "unknown";

export type TrainingStateRecommendedBehavior =
  | "baseline_building"
  | "normal_progression"
  | "recovery_or_professional_guidance"
  | "conservative_discovery";

export type TrainingStateCheckIn = {
  source: RiskFlagSource;
  text: string;
};

export type ClassifyTrainingStateInput = {
  asOfDate: string;
  workouts?: readonly WorkoutRecord[];
  checkIns?: readonly TrainingStateCheckIn[];
  riskFlags?: RiskFlags | null;
};

export type TrainingStateClassification = {
  state: TrainingState;
  confidence: number;
  explanation: string;
  recommendedBehavior: TrainingStateRecommendedBehavior;
  baselineBuildingRecommended: boolean;
  recommendationConfidenceMultiplier: number;
  activeDaysLast30: number;
  totalWorkoutMinutesLast30: number;
  longestGapDays: number | null;
  signalsUsed: string[];
};

const firstTimePatterns = [
  /\b(first[-\s]?time|brand new|new to (training|exercise|running|fitness))\b/i,
  /\b(just starting|never trained|beginner)\b/i,
];

const limitedPatterns = [
  /\b(injur(y|ed)|pain|sick|ill|fever|limited|doctor|clinician)\b/i,
  /\b(recovering from|can't train|cannot train)\b/i,
];

const severityRank: Record<RiskFlagSeverity, number> = {
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
  urgent: 4,
};

function parseLocalDate(date: string): Date {
  return new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
}

function daysBetween(earlier: string, later: string): number {
  const earlierTime = parseLocalDate(earlier).getTime();
  const laterTime = parseLocalDate(later).getTime();

  return Math.floor((laterTime - earlierTime) / 86_400_000);
}

function uniqueWorkoutDatesWithinDays(
  workouts: readonly WorkoutRecord[],
  asOfDate: string,
  days: number,
): string[] {
  const dates = new Set<string>();

  for (const workout of workouts) {
    const ageDays = daysBetween(workout.localDate, asOfDate);
    if (ageDays >= 0 && ageDays < days) {
      dates.add(workout.localDate);
    }
  }

  return [...dates].sort();
}

function totalMinutesWithinDays(
  workouts: readonly WorkoutRecord[],
  asOfDate: string,
  days: number,
): number {
  return workouts.reduce((total, workout) => {
    const ageDays = daysBetween(workout.localDate, asOfDate);

    if (ageDays < 0 || ageDays >= days) {
      return total;
    }

    return total + workout.elapsedSeconds / 60;
  }, 0);
}

function longestGapDays(workouts: readonly WorkoutRecord[]): number | null {
  const dates = [
    ...new Set(workouts.map((workout) => workout.localDate)),
  ].sort();

  if (dates.length < 2) {
    return null;
  }

  return dates.slice(1).reduce((longest, date, index) => {
    const gap = daysBetween(dates[index], date);
    return Math.max(longest, gap);
  }, 0);
}

function hasPattern(
  checkIns: readonly TrainingStateCheckIn[],
  patterns: readonly RegExp[],
): boolean {
  return checkIns.some((checkIn) =>
    patterns.some((pattern) => pattern.test(checkIn.text)),
  );
}

function hasLimitedRisk(riskFlags?: RiskFlags | null): boolean {
  if (!riskFlags) {
    return false;
  }

  return (
    riskFlags.has_blocking_risk ||
    severityRank[riskFlags.highest_severity] >= severityRank.high
  );
}

function buildClassification(
  state: TrainingState,
  confidence: number,
  explanation: string,
  recommendedBehavior: TrainingStateRecommendedBehavior,
  activeDaysLast30: number,
  totalWorkoutMinutesLast30: number,
  longestGap: number | null,
  signalsUsed: string[],
): TrainingStateClassification {
  const baselineBuildingRecommended =
    recommendedBehavior === "baseline_building";
  const recommendationConfidenceMultiplier =
    state === "unknown" ? 0.6 : state === "currently_limited" ? 0.7 : 1;

  return {
    state,
    confidence,
    explanation,
    recommendedBehavior,
    baselineBuildingRecommended,
    recommendationConfidenceMultiplier,
    activeDaysLast30,
    totalWorkoutMinutesLast30,
    longestGapDays: longestGap,
    signalsUsed,
  };
}

export function classifyTrainingState(
  input: ClassifyTrainingStateInput,
): TrainingStateClassification {
  const workouts = input.workouts ?? [];
  const checkIns = input.checkIns ?? [];
  const activeDatesLast30 = uniqueWorkoutDatesWithinDays(
    workouts,
    input.asOfDate,
    30,
  );
  const activeDaysLast30 = activeDatesLast30.length;
  const totalWorkoutMinutesLast30 = Math.round(
    totalMinutesWithinDays(workouts, input.asOfDate, 30),
  );
  const longestGap = longestGapDays(workouts);
  const signalsUsed: string[] = [];

  if (workouts.length) {
    signalsUsed.push("recent workouts");
  }
  if (checkIns.length) {
    signalsUsed.push("check-ins");
  }
  if (input.riskFlags) {
    signalsUsed.push("risk flags");
  }

  if (
    hasLimitedRisk(input.riskFlags) ||
    hasPattern(checkIns, limitedPatterns)
  ) {
    return buildClassification(
      "currently_limited",
      0.85,
      "Current check-ins or risk flags indicate a limitation, so recommendations should stay conservative.",
      "recovery_or_professional_guidance",
      activeDaysLast30,
      totalWorkoutMinutesLast30,
      longestGap,
      signalsUsed,
    );
  }

  if (!workouts.length && hasPattern(checkIns, firstTimePatterns)) {
    return buildClassification(
      "first_time_athlete",
      0.75,
      "The available check-in describes a first-time athlete, so baseline-building behavior is recommended.",
      "baseline_building",
      activeDaysLast30,
      totalWorkoutMinutesLast30,
      longestGap,
      signalsUsed,
    );
  }

  if (!workouts.length) {
    return buildClassification(
      "unknown",
      0.3,
      "There is not enough workout or check-in data to classify the current training state.",
      "conservative_discovery",
      activeDaysLast30,
      totalWorkoutMinutesLast30,
      longestGap,
      signalsUsed,
    );
  }

  if (longestGap !== null && longestGap >= 35 && activeDaysLast30 > 0) {
    return buildClassification(
      "returning_after_extended_gap",
      0.8,
      `Recent workouts resumed after an extended ${longestGap}-day training gap, so baseline-building behavior is recommended.`,
      "baseline_building",
      activeDaysLast30,
      totalWorkoutMinutesLast30,
      longestGap,
      signalsUsed,
    );
  }

  if (activeDaysLast30 <= 2) {
    return buildClassification(
      "inconsistent_or_low_recent_activity",
      0.7,
      `${activeDaysLast30} active day${activeDaysLast30 === 1 ? "" : "s"} in the last 30 days indicates inconsistent or low recent activity.`,
      "baseline_building",
      activeDaysLast30,
      totalWorkoutMinutesLast30,
      longestGap,
      signalsUsed,
    );
  }

  if (activeDaysLast30 >= 6 && totalWorkoutMinutesLast30 >= 360) {
    return buildClassification(
      "advanced_athlete",
      0.85,
      `${activeDaysLast30} active days and ${totalWorkoutMinutesLast30} workout minutes in the last 30 days indicate advanced recent training consistency.`,
      "normal_progression",
      activeDaysLast30,
      totalWorkoutMinutesLast30,
      longestGap,
      signalsUsed,
    );
  }

  return buildClassification(
    "consistent_recreational_athlete",
    0.75,
    `${activeDaysLast30} active days in the last 30 days indicate consistent recreational training.`,
    "normal_progression",
    activeDaysLast30,
    totalWorkoutMinutesLast30,
    longestGap,
    signalsUsed,
  );
}
