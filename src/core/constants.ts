import {
  Activity,
  ChartColumn,
  Database,
  HeartPulse,
  Moon,
  Route,
  Zap,
} from "lucide-react-native";

import { completeCoachRecommendation } from "../coach/dailyRecommendation";
import { buildReadinessStatus } from "../coach/readinessStatus";
import { buildTrainingLoadSnapshot } from "../coach/trainingLoad";
import type { PipelineSnapshot } from "../health/types";
import type { AppSettings } from "../storage/appSettings";
import type { AnalyticsMetricConfig } from "./types";

export const ranges = [7, 30, 365];
export const baselineRangeDays = 365;

export const emptyAppSettings: AppSettings = {
  hasOpenAiApiKey: false,
  openAiApiKeySource: null,
  defaultSyncRangeDays: baselineRangeDays,
};

export const emptySnapshot: PipelineSnapshot = {
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
  trainingLoad: buildTrainingLoadSnapshot(),
  recommendation: completeCoachRecommendation({
    readiness: null,
    readinessStatus: buildReadinessStatus({
      score: null,
      signalsUsed: [],
      sourceFreshness: [],
    }),
    readinessLabel: "Unknown",
    color: "warm",
    title: "Readiness unknown",
    detail: "Keep it easy until current recovery data is available.",
    reason: "There is not enough current data for a confident readiness call.",
    opener: "Readiness is unknown, so I would keep today conservative.",
    strain: 0,
    strainTarget: "—",
  }),
};

export const analyticsMetrics: AnalyticsMetricConfig[] = [
  {
    id: "sleep",
    title: "Sleep",
    detail: "Duration and stages",
    types: ["sleep_session"],
    icon: Moon,
    gap: "Grant Sleep access or connect a source that writes sleep sessions.",
  },
  {
    id: "hrv",
    title: "HRV",
    detail: "Method-specific RMSSD or SDNN",
    types: ["hrv_rmssd", "hrv_sdnn"],
    icon: HeartPulse,
    gap: "Connect a source that writes HRV to Health Connect or Apple Health.",
  },
  {
    id: "rhr",
    title: "Resting HR",
    detail: "Daily resting heart rate",
    types: ["resting_heart_rate"],
    icon: HeartPulse,
    gap: "Grant Resting heart rate access or connect a source that writes RHR.",
  },
  {
    id: "heart-rate",
    title: "Heart rate",
    detail: "Daily average and range",
    types: ["heart_rate"],
    icon: HeartPulse,
    gap: "Grant Heart rate access or connect a wearable HR source.",
  },
  {
    id: "workouts",
    title: "Workouts",
    detail: "Deduped sessions",
    types: ["workout"],
    icon: Activity,
    gap: "Grant Exercise access or connect Garmin, Strava, or another workout source.",
  },
  {
    id: "activity",
    title: "Daily activity",
    detail: "Steps, energy, distance",
    types: ["steps", "active_energy", "total_energy", "distance"],
    icon: Zap,
    gap: "Grant activity permissions so steps, calories, and distance can sync.",
  },
  {
    id: "nutrition",
    title: "Nutrition",
    detail: "Calories, macros, hydration",
    types: ["nutrition", "hydration"],
    icon: Database,
    gap: "Connect a nutrition or hydration source that writes to Health Connect.",
  },
  {
    id: "body",
    title: "Body composition",
    detail: "Weight, fat, lean mass",
    types: ["weight", "body_fat", "lean_body_mass"],
    icon: ChartColumn,
    gap: "Connect a scale or body composition source.",
  },
  {
    id: "vo2",
    title: "VO2 max",
    detail: "Aerobic fitness estimate",
    types: ["vo2max"],
    icon: Route,
    gap: "Connect a source that writes VO2 max estimates.",
  },
];
