import type {
  CoachRecommendation,
  CoachRecommendationActivity,
} from "../health/types";
import type { ReadinessStatusContract } from "./readinessStatus";

type DailyRecommendationFields = Pick<
  CoachRecommendation,
  | "shortExplanation"
  | "recommendedActivity"
  | "easierAlternative"
  | "whatToAvoidToday"
  | "confidence"
  | "sourcesUsed"
  | "sourcesIgnored"
  | "checkInQuestion"
>;

export type CoachRecommendationBase = Omit<
  CoachRecommendation,
  keyof DailyRecommendationFields
>;

export type DailyRecommendationContractInput = {
  readinessStatus: ReadinessStatusContract;
  title: string;
  detail: string;
  reason: string;
  readinessSignals?: string[];
  contextSignals?: string[];
};

function unique(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function confidenceFor(status: ReadinessStatusContract): number {
  if (status.status === "unknown") {
    return Math.min(status.confidence, 0.35);
  }

  if (status.status === "red") {
    return Math.min(status.confidence, 0.55);
  }

  if (status.status === "yellow") {
    return Math.min(status.confidence, 0.74);
  }

  return status.confidence;
}

function intensityTarget(status: ReadinessStatusContract): string {
  if (status.status === "green") return "planned intensity";
  if (status.status === "red") return "easy only";
  if (status.status === "unknown") return "easy until clearer";
  return "controlled aerobic";
}

function easierAlternativeFor(
  status: ReadinessStatusContract,
): CoachRecommendationActivity {
  if (status.status === "green") {
    return {
      title: "Short aerobic option",
      intensityTarget: "easy conversational",
      durationOrVolume: "25-35 min",
      rationale:
        "Use this if energy, soreness, or schedule changes after the data sync.",
    };
  }

  if (status.status === "red" || status.status === "unknown") {
    return {
      title: "Walk and mobility",
      intensityTarget: "very easy",
      durationOrVolume: "10-20 min",
      rationale:
        "This keeps movement available without treating incomplete or poor readiness as a training green light.",
    };
  }

  return {
    title: "Shorten the aerobic work",
    intensityTarget: "easy",
    durationOrVolume: "20-30 min",
    rationale:
      "A shorter option keeps the habit while respecting mixed readiness signals.",
  };
}

function avoidsFor(status: ReadinessStatusContract): string[] {
  if (status.status === "green") {
    return ["large volume jumps", "turning easy work into a race"];
  }

  if (status.status === "red") {
    return ["hard intervals", "max efforts", "long sessions"];
  }

  if (status.status === "unknown") {
    return ["hard efforts", "new maxes", "adding volume from incomplete data"];
  }

  return ["threshold work", "extra volume", "testing pace"];
}

function checkInFor(status: ReadinessStatusContract): string {
  if (status.status === "green") {
    return "Any soreness, illness, or schedule constraint before you start?";
  }

  if (status.status === "red") {
    return "Is there pain, illness, or unusual fatigue I should account for today?";
  }

  if (status.status === "unknown") {
    return "How do you feel today: rested, normal, tired, sore, or unwell?";
  }

  return "Do you feel normal enough to train, or should we shorten this?";
}

export function buildDailyRecommendationFields({
  readinessStatus,
  title,
  detail,
  reason,
  readinessSignals = [],
  contextSignals = [],
}: DailyRecommendationContractInput): DailyRecommendationFields {
  const sourcesUsed = unique(
    readinessSignals.length ? readinessSignals : readinessStatus.signalsUsed,
  );
  const sourcesIgnored = unique([
    ...readinessStatus.staleSignalsIgnored,
    ...readinessStatus.missingSignals,
    ...contextSignals,
  ]);

  return {
    shortExplanation: reason,
    recommendedActivity: {
      title,
      intensityTarget: intensityTarget(readinessStatus),
      durationOrVolume: detail,
      rationale: reason,
    },
    easierAlternative: easierAlternativeFor(readinessStatus),
    whatToAvoidToday: avoidsFor(readinessStatus),
    confidence: confidenceFor(readinessStatus),
    sourcesUsed,
    sourcesIgnored,
    checkInQuestion: checkInFor(readinessStatus),
  };
}

export function completeCoachRecommendation(
  base: CoachRecommendationBase,
  input: Omit<
    DailyRecommendationContractInput,
    "readinessStatus" | "title" | "detail" | "reason"
  > = {},
): CoachRecommendation {
  return {
    ...base,
    ...buildDailyRecommendationFields({
      readinessStatus: base.readinessStatus,
      title: base.title,
      detail: base.detail,
      reason: base.reason,
      ...input,
    }),
  };
}
