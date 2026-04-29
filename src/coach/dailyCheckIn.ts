import type {
  DailyCheckIn,
  DailyCheckInPain,
  DailyCheckInPreferredActivity,
} from "../health/types";

const painValues: DailyCheckInPain[] = ["none", "mild", "moderate", "severe"];
const preferredActivityValues: DailyCheckInPreferredActivity[] = [
  "easy_cardio",
  "run",
  "ride",
  "strength",
  "mobility",
  "rest",
];

export const dailyCheckInScaleOptions = [1, 2, 3, 4, 5] as const;
export const dailyCheckInPainOptions = painValues;
export const dailyCheckInPreferredActivityOptions = preferredActivityValues;
export const dailyCheckInTimeOptions = [15, 20, 30, 45, 60, 90, 120] as const;

function clamp(value: unknown, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function closestAvailableMinutes(value: unknown): number {
  const minutes = clamp(value, 15, 120);
  return dailyCheckInTimeOptions.reduce((closest, option) =>
    Math.abs(option - minutes) < Math.abs(closest - minutes) ? option : closest,
  );
}

function enumOrDefault<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function createDefaultDailyCheckIn(
  localDate: string,
  now = new Date().toISOString(),
): DailyCheckIn {
  return {
    localDate,
    sleepQuality: 3,
    soreness: 2,
    energy: 3,
    pain: "none",
    availableTimeMinutes: 30,
    preferredActivity: "easy_cardio",
    completedYesterday: false,
    source: "user_reported",
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeDailyCheckIn(
  input: Partial<DailyCheckIn> | null | undefined,
  localDate: string,
  now = new Date().toISOString(),
): DailyCheckIn {
  const base = createDefaultDailyCheckIn(localDate, now);

  return {
    ...base,
    localDate,
    sleepQuality: clamp(input?.sleepQuality, 1, 5),
    soreness: clamp(input?.soreness, 1, 5),
    energy: clamp(input?.energy, 1, 5),
    pain: enumOrDefault(input?.pain, painValues, base.pain),
    availableTimeMinutes: closestAvailableMinutes(input?.availableTimeMinutes),
    preferredActivity: enumOrDefault(
      input?.preferredActivity,
      preferredActivityValues,
      base.preferredActivity,
    ),
    completedYesterday: Boolean(input?.completedYesterday),
    source: "user_reported",
    createdAt: input?.createdAt ?? now,
    updatedAt: now,
  };
}

export function painRiskFlagFor(checkIn: DailyCheckIn | null): string | null {
  if (!checkIn || checkIn.pain === "none") return null;
  return `user-reported ${checkIn.pain} pain`;
}

function qualityLabel(value: number, low: string, mid: string, high: string) {
  if (value <= 2) return low;
  if (value >= 4) return high;
  return mid;
}

function activityLabel(value: DailyCheckInPreferredActivity): string {
  switch (value) {
    case "easy_cardio":
      return "easy cardio";
    case "run":
      return "running";
    case "ride":
      return "cycling";
    case "strength":
      return "strength";
    case "mobility":
      return "mobility";
    case "rest":
      return "rest";
  }
}

export function buildDailyCheckInContextSignals(
  checkIn: DailyCheckIn | null,
): string[] {
  if (!checkIn) return [];

  const painRisk = painRiskFlagFor(checkIn);

  return [
    `user-reported sleep quality is ${qualityLabel(
      checkIn.sleepQuality,
      "poor",
      "normal",
      "good",
    )}`,
    `user-reported soreness is ${qualityLabel(
      checkIn.soreness,
      "low",
      "moderate",
      "high",
    )}`,
    `user-reported energy is ${qualityLabel(
      checkIn.energy,
      "low",
      "normal",
      "high",
    )}`,
    painRisk,
    `user has ${checkIn.availableTimeMinutes} min available`,
    `user prefers ${activityLabel(checkIn.preferredActivity)} today`,
    checkIn.completedYesterday
      ? "user completed yesterday's session"
      : "user did not complete yesterday's session",
  ].filter((signal): signal is string => Boolean(signal));
}
