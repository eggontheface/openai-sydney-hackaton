import type {
  PipelineSnapshot,
  SourceFreshness,
  SourceFreshnessDomain,
} from "../health/types";
import {
  goalCategories,
  parseStructuredCoachOutput,
  structuredCoachSchemaVersion,
  type EventProfile,
  type GoalCategory,
  type GoalProfile,
  type ReadinessStatusValue,
  type RecommendationActivity,
  type RecommendationImpact,
  type RiskFlag,
  type RiskFlagCategory,
  type RiskFlagSeverity,
  type StructuredCoachOutput,
} from "./schemas";
import type {
  StructuredCoachRequest,
  StructuredCoachService,
} from "./structuredCoach";

type RecordValue = Record<string, unknown>;

type CoachSignalContext = {
  missingSignals: string[];
  sourcesIgnored: string[];
  sourcesUsed: string[];
  staleSignals: string[];
};

const importantDomains: SourceFreshnessDomain[] = [
  "sleep",
  "workouts",
  "hrv",
  "resting_hr",
  "check_ins",
];

const signalLabels: Record<SourceFreshnessDomain, string> = {
  sleep: "sleep",
  workouts: "recent workouts",
  steps: "steps",
  energy: "energy",
  hrv: "hrv",
  resting_hr: "resting HR",
  nutrition: "nutrition",
  hydration: "hydration",
  body_composition: "body composition",
  check_ins: "daily check-in",
};

const severityRank: Record<RiskFlagSeverity, number> = {
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
  urgent: 4,
};

const defaultGeneratedAt = "2026-04-29T00:00:00.000Z";

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim()),
  );
}

function score(value: unknown, fallback: number): number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? value
    : fallback;
}

function unionValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  if (
    typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
  ) {
    return value as T[number];
  }
  return fallback;
}

function snapshotFromHealthContext(value: unknown): PipelineSnapshot | null {
  const candidate =
    isRecord(value) && "snapshot" in value ? value.snapshot : value;

  if (!isRecord(candidate)) {
    return null;
  }

  if (
    typeof candidate.totalSamples !== "number" ||
    typeof candidate.workoutCount !== "number" ||
    !isRecord(candidate.recommendation)
  ) {
    return null;
  }

  return candidate as PipelineSnapshot;
}

function textIncludesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function inferGoalCategory(userMessage: string): GoalCategory {
  const text = userMessage.toLowerCase();

  if (
    textIncludesAny(text, [
      "coming back",
      "returning",
      "long break",
      "year off",
      "time off",
    ])
  ) {
    return "return_to_training";
  }

  if (
    textIncludesAny(text, [
      "hyrox",
      "marathon",
      "10k",
      "5k",
      "triathlon",
      "event",
      "race",
    ])
  ) {
    return "event_preparation";
  }

  if (textIncludesAny(text, ["strength", "muscle", "lift", "hypertrophy"])) {
    return "strength";
  }

  if (textIncludesAny(text, ["run", "ride", "cycle", "endurance"])) {
    return "endurance";
  }

  if (textIncludesAny(text, ["weight", "fat loss", "body composition"])) {
    return "body_composition";
  }

  if (textIncludesAny(text, ["energy", "sleep better", "health"])) {
    return "health_and_energy";
  }

  return "unknown";
}

function buildGoalProfile(request: StructuredCoachRequest): GoalProfile {
  const profile = isRecord(request.goal_profile) ? request.goal_profile : {};
  const inferredGoal = inferGoalCategory(request.user_message ?? "");
  const suppliedPrimary = unionValue(
    profile.primary_goal,
    goalCategories,
    inferredGoal,
  );
  const returningSignal =
    suppliedPrimary === "return_to_training" ||
    textIncludesAny((request.user_message ?? "").toLowerCase(), [
      "coming back",
      "returning",
      "long break",
      "year off",
      "time off",
    ]);

  return {
    primary_goal: suppliedPrimary,
    secondary_goals: stringArray(profile.secondary_goals).map((goal) =>
      unionValue(goal, goalCategories, "unknown"),
    ),
    motivation:
      typeof profile.motivation === "string" ? profile.motivation : null,
    timeframe: typeof profile.timeframe === "string" ? profile.timeframe : null,
    experience_level: unionValue(
      profile.experience_level,
      ["beginner", "recreational", "advanced", "returning", "unknown"] as const,
      returningSignal ? "returning" : "unknown",
    ),
    preferred_activities: stringArray(profile.preferred_activities),
    disliked_activities: stringArray(profile.disliked_activities),
    constraints: [
      ...stringArray(profile.constraints),
      ...(returningSignal ? ["long training gap"] : []),
    ].filter((value, index, all) => all.indexOf(value) === index),
    coaching_style: unionValue(
      profile.coaching_style,
      ["direct", "supportive", "technical", "unknown"] as const,
      "direct",
    ),
    starting_strategy: returningSignal
      ? "Start with baseline work before progressing volume or intensity."
      : typeof profile.starting_strategy === "string"
        ? profile.starting_strategy
        : "Use the least aggressive useful option until current context is clear.",
    confidence: score(profile.confidence, returningSignal ? 0.7 : 0.45),
    updated_at:
      typeof profile.updated_at === "string"
        ? profile.updated_at
        : request.generated_at,
  };
}

function buildEventProfile(request: StructuredCoachRequest): EventProfile {
  const profile = isRecord(request.event_profile) ? request.event_profile : {};
  const text = (request.user_message ?? "").toLowerCase();
  const eventIntent =
    typeof profile.event_intent === "boolean"
      ? profile.event_intent
      : textIncludesAny(text, [
          "hyrox",
          "marathon",
          "10k",
          "5k",
          "triathlon",
          "event",
          "race",
        ]);

  return {
    event_intent: eventIntent,
    event_name:
      typeof profile.event_name === "string" ? profile.event_name : null,
    event_type:
      typeof profile.event_type === "string" ? profile.event_type : null,
    event_date:
      typeof profile.event_date === "string" ? profile.event_date : null,
    location: typeof profile.location === "string" ? profile.location : null,
    distance_or_format:
      typeof profile.distance_or_format === "string"
        ? profile.distance_or_format
        : null,
    missing_fields: eventIntent ? stringArray(profile.missing_fields) : [],
    confidence: score(profile.confidence, eventIntent ? 0.55 : 0.35),
  };
}

function makeRiskFlag({
  category,
  createdAt,
  evidence,
  id,
  impact,
  professionalCareGuidance,
  severity,
}: {
  category: RiskFlagCategory;
  createdAt: string;
  evidence: string;
  id: string;
  impact: RecommendationImpact;
  professionalCareGuidance: string | null;
  severity: RiskFlagSeverity;
}): RiskFlag {
  return {
    id,
    category,
    severity,
    source: "typed_adjustment",
    evidence,
    recommendation_impact: impact,
    professional_care_guidance: professionalCareGuidance,
    created_at: createdAt,
  };
}

function extractRiskFlags(
  userMessage: string,
  generatedAt: string,
): RiskFlag[] {
  const text = userMessage.toLowerCase();
  const flags: RiskFlag[] = [];

  if (
    textIncludesAny(text, ["chest pain", "chest discomfort", "tight chest"])
  ) {
    flags.push(
      makeRiskFlag({
        id: "cardiovascular-symptom",
        category: "cardiovascular_symptom",
        severity: "urgent",
        impact: "professional_care",
        evidence: userMessage,
        professionalCareGuidance:
          "Chest pain or chest discomfort is a reason to stop training and seek qualified medical advice promptly.",
        createdAt: generatedAt,
      }),
    );
  }

  if (textIncludesAny(text, ["fainted", "fainting", "passed out"])) {
    flags.push(
      makeRiskFlag({
        id: "fainting",
        category: "fainting",
        severity: "urgent",
        impact: "professional_care",
        evidence: userMessage,
        professionalCareGuidance:
          "Fainting is not a training signal to push through; pause exercise and get qualified medical advice.",
        createdAt: generatedAt,
      }),
    );
  }

  if (
    textIncludesAny(text, [
      "unusual shortness of breath",
      "shortness of breath",
      "short of breath",
      "breathless walking",
    ])
  ) {
    flags.push(
      makeRiskFlag({
        id: "respiratory-symptom",
        category: "respiratory_symptom",
        severity: "urgent",
        impact: "professional_care",
        evidence: userMessage,
        professionalCareGuidance:
          "Unusual breathlessness should be treated cautiously; avoid training and seek qualified advice if it is new, worsening, or concerning.",
        createdAt: generatedAt,
      }),
    );
  }

  if (
    textIncludesAny(text, ["fever", "flu", "covid", "sick"]) ||
    /\bill(ness)?\b/.test(text)
  ) {
    flags.push(
      makeRiskFlag({
        id: "illness",
        category: "illness",
        severity: "high",
        impact: "recovery_only",
        evidence: userMessage,
        professionalCareGuidance:
          "Fever or illness is a reason to avoid training intensity and seek care if symptoms are severe, worsening, or unusual.",
        createdAt: generatedAt,
      }),
    );
  }

  if (
    textIncludesAny(text, [
      "pain",
      "hurts",
      "hurt",
      "injury",
      "injured",
      "niggle",
      "knee",
      "ankle",
      "back pain",
      "back hurts",
    ])
  ) {
    flags.push(
      makeRiskFlag({
        id: "pain-or-injury",
        category: textIncludesAny(text, ["injury", "injured"])
          ? "injury"
          : "pain",
        severity: "high",
        impact: "recovery_only",
        evidence: userMessage,
        professionalCareGuidance:
          "Do not train through sharp, worsening, swollen, or gait-changing pain; get it checked if it persists.",
        createdAt: generatedAt,
      }),
    );
  }

  if (textIncludesAny(text, ["severe fatigue", "exhausted", "wiped out"])) {
    flags.push(
      makeRiskFlag({
        id: "severe-fatigue",
        category: "severe_fatigue",
        severity: "high",
        impact: "recovery_only",
        evidence: userMessage,
        professionalCareGuidance:
          "Severe fatigue should lower training stress; seek qualified care if it is unusual, persistent, or worsening.",
        createdAt: generatedAt,
      }),
    );
  }

  return flags;
}

function highestSeverity(flags: RiskFlag[]): RiskFlagSeverity {
  return flags.reduce<RiskFlagSeverity>(
    (highest, flag) =>
      severityRank[flag.severity] > severityRank[highest]
        ? flag.severity
        : highest,
    "none",
  );
}

function noRiskFlag(generatedAt: string): RiskFlag {
  return {
    id: "no-risk-reported",
    category: "other",
    severity: "none",
    source: "coach_service",
    evidence:
      "No pain, illness, injury, severe fatigue, or urgent symptom was provided.",
    recommendation_impact: "none",
    professional_care_guidance: null,
    created_at: generatedAt,
  };
}

function buildSignalContext(
  snapshot: PipelineSnapshot | null,
): CoachSignalContext {
  if (
    !snapshot ||
    (snapshot.totalSamples === 0 && snapshot.workoutCount === 0)
  ) {
    return {
      missingSignals: [
        "sleep",
        "recent workouts",
        "daily check-in",
        "hrv",
        "resting HR",
      ],
      sourcesIgnored: [],
      sourcesUsed: [],
      staleSignals: [],
    };
  }

  const freshnessByDomain = new Map<SourceFreshnessDomain, SourceFreshness>();
  for (const freshness of snapshot.sourceFreshness) {
    freshnessByDomain.set(freshness.domain, freshness);
  }

  const sourcesUsed: string[] = [];
  const sourcesIgnored: string[] = [];
  const missingSignals: string[] = [];
  const staleSignals: string[] = [];

  for (const domain of importantDomains) {
    const freshness = freshnessByDomain.get(domain);
    const label = signalLabels[domain];

    if (!freshness || freshness.state === "missing") {
      missingSignals.push(label);
      continue;
    }

    if (freshness.state === "stale") {
      staleSignals.push(domain);
      sourcesIgnored.push(domain);
      continue;
    }

    sourcesUsed.push(domain);
  }

  if (!snapshot.today?.sleepSeconds && !missingSignals.includes("sleep")) {
    missingSignals.push("sleep");
  }

  if (
    !snapshot.recentWorkouts.length &&
    !missingSignals.includes("recent workouts")
  ) {
    missingSignals.push("recent workouts");
  }

  return {
    missingSignals,
    sourcesIgnored,
    sourcesUsed,
    staleSignals,
  };
}

function hasNoUsableData(snapshot: PipelineSnapshot | null) {
  return (
    !snapshot || (snapshot.totalSamples === 0 && snapshot.workoutCount === 0)
  );
}

function hasPoorSleep(snapshot: PipelineSnapshot | null) {
  return Boolean(
    snapshot?.today?.sleepSeconds && snapshot.today.sleepSeconds < 5 * 60 * 60,
  );
}

function isReturningAthlete(goalProfile: GoalProfile, userMessage: string) {
  return (
    goalProfile.primary_goal === "return_to_training" ||
    goalProfile.experience_level === "returning" ||
    textIncludesAny(userMessage.toLowerCase(), [
      "coming back",
      "returning",
      "long break",
      "year off",
      "time off",
    ])
  );
}

function determineReadinessStatus({
  blockingRisk,
  goalProfile,
  signals,
  snapshot,
  userMessage,
}: {
  blockingRisk: boolean;
  goalProfile: GoalProfile;
  signals: CoachSignalContext;
  snapshot: PipelineSnapshot | null;
  userMessage: string;
}): ReadinessStatusValue {
  const readiness = snapshot?.recommendation.readiness ?? null;

  if (blockingRisk) return "red";
  if (hasNoUsableData(snapshot)) return "unknown";
  if (hasPoorSleep(snapshot)) return "red";
  if (readiness != null && readiness < 55) return "red";
  if (isReturningAthlete(goalProfile, userMessage)) return "yellow";
  if (signals.staleSignals.length >= 2) return "yellow";
  if (readiness == null) return "unknown";
  if (readiness >= 72) return "green";
  if (readiness >= 55) return "yellow";
  return "unknown";
}

function confidenceFor(
  status: ReadinessStatusValue,
  blockingRisk: boolean,
  staleCount: number,
) {
  if (blockingRisk) return 0.4;
  if (status === "unknown") return 0.35;
  if (status === "red") return 0.48;
  if (staleCount > 0) return 0.58;
  if (status === "green") return 0.76;
  return 0.62;
}

function conservativeReason({
  blockingRisk,
  returning,
  signals,
  snapshot,
  status,
}: {
  blockingRisk: boolean;
  returning: boolean;
  signals: CoachSignalContext;
  snapshot: PipelineSnapshot | null;
  status: ReadinessStatusValue;
}) {
  if (blockingRisk) {
    return "Risk flags override the training plan, so intensity is reduced to recovery only.";
  }
  if (hasNoUsableData(snapshot)) {
    return "Missing current data lowers confidence, so the safest useful baseline option is recommended.";
  }
  if (hasPoorSleep(snapshot)) {
    return "Short sleep lowers readiness, so today should prioritize recovery.";
  }
  if (returning) {
    return "A long training gap requires baseline work before event-specific progression.";
  }
  if (signals.staleSignals.length) {
    return "Stale sources are ignored for current readiness, so the recommendation stays conservative.";
  }
  if (status === "green") return null;
  return "Mixed or incomplete signals require a lower-risk training choice.";
}

function activityFor({
  blockingRisk,
  returning,
  status,
}: {
  blockingRisk: boolean;
  returning: boolean;
  status: ReadinessStatusValue;
}): RecommendationActivity {
  if (blockingRisk) {
    return {
      title: "Recovery only",
      activity_type: "mobility",
      intensity_target: "recovery",
      duration_minutes: 10,
      volume: "Gentle mobility or complete rest",
      rationale: "Risk flags take priority over fitness goals today.",
    };
  }

  if (status === "unknown") {
    return {
      title: "Baseline walk",
      activity_type: "walk",
      intensity_target: "recovery",
      duration_minutes: 20,
      volume: "Relaxed pace",
      rationale:
        "Unknown readiness should not be treated as permission to train hard.",
    };
  }

  if (status === "red") {
    return {
      title: "Recovery walk",
      activity_type: "walk",
      intensity_target: "recovery",
      duration_minutes: 20,
      volume: "Easy enough to breathe through your nose",
      rationale:
        "Low readiness supports circulation without adding training stress.",
    };
  }

  if (returning) {
    return {
      title: "Baseline aerobic walk",
      activity_type: "walk",
      intensity_target: "easy",
      duration_minutes: 25,
      volume: "Finish feeling like you could keep going",
      rationale:
        "Returning athletes need tolerance checks before event-specific work.",
    };
  }

  if (status === "yellow") {
    return {
      title: "Easy aerobic session",
      activity_type: "walk",
      intensity_target: "easy",
      duration_minutes: 25,
      volume: "Keep it conversational",
      rationale:
        "Mixed or stale signals support useful work without testing fitness.",
    };
  }

  return {
    title: "Easy aerobic run",
    activity_type: "run",
    intensity_target: "easy",
    duration_minutes: 35,
    volume: "Conversational pace only",
    rationale:
      "Fresh recovery and workout signals support normal easy training.",
  };
}

function easierAlternativeFor(
  activity: RecommendationActivity,
): RecommendationActivity {
  if (activity.activity_type === "mobility") {
    return {
      title: "Complete rest",
      activity_type: "rest",
      intensity_target: "recovery",
      duration_minutes: null,
      volume: "No training today",
      rationale:
        "Rest is appropriate when symptoms or pain are the limiting factor.",
    };
  }

  if (
    activity.activity_type === "walk" &&
    activity.intensity_target === "recovery"
  ) {
    return {
      title: "Mobility reset",
      activity_type: "mobility",
      intensity_target: "recovery",
      duration_minutes: 10,
      volume: "Gentle range of motion",
      rationale: "A shorter option keeps the day low risk.",
    };
  }

  return {
    title: "Short recovery walk",
    activity_type: "walk",
    intensity_target: "recovery",
    duration_minutes: 15,
    volume: "Relaxed pace",
    rationale:
      "Use this if subjective readiness is lower than the data suggests.",
  };
}

function avoidListFor({
  blockingRisk,
  returning,
  status,
}: {
  blockingRisk: boolean;
  returning: boolean;
  status: ReadinessStatusValue;
}) {
  const avoid = ["hard intervals", "max-effort testing"];

  if (blockingRisk) {
    avoid.push("training through symptoms");
  }

  if (returning || status !== "green") {
    avoid.push("large volume jumps");
  }

  return avoid;
}

function shortExplanationFor(
  status: ReadinessStatusValue,
  blockingRisk: boolean,
  returning: boolean,
) {
  if (blockingRisk) {
    return "Risk context changes the plan today, so the recommendation is recovery only.";
  }
  if (returning) {
    return "Because you are returning after time off, today should establish a baseline rather than chase event fitness.";
  }
  if (status === "unknown") {
    return "Not enough reliable current data is available, so choose a conservative baseline option.";
  }
  if (status === "red") {
    return "Recovery signals are low, so today should avoid added strain.";
  }
  if (status === "yellow") {
    return "Some signals are mixed, stale, or incomplete, so keep the work easy.";
  }
  return "Fresh signals support normal easy training without testing fitness.";
}

export function generateStructuredCoachRecommendation(
  request: StructuredCoachRequest,
): StructuredCoachOutput {
  const generatedAt = request.generated_at || defaultGeneratedAt;
  const userMessage = request.user_message ?? "";
  const snapshot = snapshotFromHealthContext(request.health_context);
  const goalProfile = buildGoalProfile(request);
  const eventProfile = buildEventProfile(request);
  const riskFlagItems = extractRiskFlags(userMessage, generatedAt);
  const highestRiskSeverity = highestSeverity(riskFlagItems);
  const blockingRisk =
    severityRank[highestRiskSeverity] >= severityRank.high ||
    riskFlagItems.some((flag) =>
      ["recovery_only", "professional_care"].includes(
        flag.recommendation_impact,
      ),
    );
  const signals = buildSignalContext(snapshot);
  const returning = isReturningAthlete(goalProfile, userMessage);
  const readinessStatus = determineReadinessStatus({
    blockingRisk,
    goalProfile,
    signals,
    snapshot,
    userMessage,
  });
  const confidence = confidenceFor(
    readinessStatus,
    blockingRisk,
    signals.staleSignals.length,
  );
  const activity = activityFor({
    blockingRisk,
    returning,
    status: readinessStatus,
  });
  const easierAlternative = easierAlternativeFor(activity);
  const conservativeAdjustmentReason = conservativeReason({
    blockingRisk,
    returning,
    signals,
    snapshot,
    status: readinessStatus,
  });
  const riskFlags = riskFlagItems.length
    ? riskFlagItems
    : [noRiskFlag(generatedAt)];

  const output: StructuredCoachOutput = {
    schema_version: structuredCoachSchemaVersion,
    generated_at: generatedAt,
    goal_profile: goalProfile,
    event_profile: eventProfile,
    risk_flags: {
      generated_at: generatedAt,
      highest_severity: highestRiskSeverity,
      has_blocking_risk: blockingRisk,
      summary: blockingRisk
        ? "Risk flags lowered the recommendation to recovery guidance."
        : "No risk flags were supplied in the current structured input.",
      items: riskFlags,
    },
    stale_data_report: {
      generated_at: generatedAt,
      stale_signals: signals.staleSignals,
      missing_signals: signals.missingSignals,
      ignored_signals: signals.sourcesIgnored,
      limitations: [
        ...signals.staleSignals.map(
          (signal) => `${signal} is stale and was ignored`,
        ),
        ...signals.missingSignals.map((signal) => `${signal} is missing`),
      ],
    },
    readiness_status: {
      status: readinessStatus,
      confidence,
      score: snapshot?.recommendation.readiness ?? null,
      signals_used: signals.sourcesUsed,
      stale_signals_ignored: signals.staleSignals,
      missing_signals: signals.missingSignals,
      conservative_adjustment_reason: conservativeAdjustmentReason,
      summary:
        readinessStatus === "green"
          ? "Current signals support normal easy training."
          : (conservativeAdjustmentReason ??
            "Current signals require a conservative choice."),
    },
    daily_recommendation: {
      readiness_status: readinessStatus,
      short_explanation: shortExplanationFor(
        readinessStatus,
        blockingRisk,
        returning,
      ),
      recommended_activity: activity,
      easier_alternative: easierAlternative,
      what_to_avoid_today: avoidListFor({
        blockingRisk,
        returning,
        status: readinessStatus,
      }),
      confidence,
      sources_used: blockingRisk
        ? ["typed adjustment", ...signals.sourcesUsed]
        : signals.sourcesUsed,
      sources_ignored: signals.sourcesIgnored,
      check_in_question: blockingRisk
        ? "Are symptoms new, worsening, sharp, chest-related, or unusual for you?"
        : "Any pain, illness, unusual breathlessness, or severe fatigue today?",
      risk_flags_applied: blockingRisk,
    },
    health_check: {
      generated_at: generatedAt,
      known: signals.sourcesUsed.length
        ? signals.sourcesUsed
        : ["No fresh training signals"],
      uncertain: signals.missingSignals.length
        ? signals.missingSignals
        : ["Subjective soreness and energy"],
      stale: signals.staleSignals,
      missing: signals.missingSignals,
      risks: riskFlagItems.length
        ? riskFlagItems.map((flag) => flag.evidence)
        : ["No risk flags supplied"],
      summary_markdown:
        readinessStatus === "green"
          ? "Readiness is supported by fresh source-aware data."
          : "Recommendation was kept conservative because current context is risky, stale, missing, or incomplete.",
    },
    inspection_notes: [
      "Generated by deterministic recommendation gauntlet harness.",
      "Conservative overrides are applied before output validation.",
    ],
  };

  return parseStructuredCoachOutput(output);
}

export function createDeterministicStructuredCoachService(): StructuredCoachService {
  return {
    async generateDailyRecommendation(request) {
      return generateStructuredCoachRecommendation(request);
    },
  };
}
