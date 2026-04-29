import type {
  RecommendationImpact,
  RiskFlag,
  RiskFlagCategory,
  RiskFlagSeverity,
  RiskFlagSource,
  RiskFlags,
  StructuredCoachOutput,
} from "./schemas";

export type RiskFlagCatalogEntry = {
  id: string;
  category: RiskFlagCategory;
  severity: RiskFlagSeverity;
  recommendationImpact: RecommendationImpact;
  patterns: RegExp[];
  professionalCareGuidance: string | null;
  summaryLabel: string;
};

export type RiskFlagInput = {
  source: RiskFlagSource;
  text: string;
  label?: string;
};

export type RiskFlagExtractionOptions = {
  generatedAt: string;
};

export type CoachRiskFlagRequest = {
  generated_at: string;
  user_message?: unknown;
  goal_profile?: unknown;
  event_profile?: unknown;
  daily_check_in?: unknown;
  typed_adjustment?: unknown;
  risk_flag_inputs?: readonly RiskFlagInput[];
};

const severityRank: Record<RiskFlagSeverity, number> = {
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
  urgent: 4,
};

const blockingSeverities = new Set<RiskFlagSeverity>(["high", "urgent"]);

export const riskFlagCatalog: RiskFlagCatalogEntry[] = [
  {
    id: "chest-pain",
    category: "cardiovascular_symptom",
    severity: "urgent",
    recommendationImpact: "professional_care",
    patterns: [
      /\bchest\s+(pain|pressure|tightness|discomfort)\b/i,
      /\bpressure\s+in\s+(my\s+)?chest\b/i,
    ],
    professionalCareGuidance:
      "Pause training and consider professional care before exercising with chest symptoms.",
    summaryLabel: "chest pain",
  },
  {
    id: "fainting",
    category: "fainting",
    severity: "urgent",
    recommendationImpact: "professional_care",
    patterns: [
      /\bfaint(ed|ing)\b/i,
      /\bfeel(ing)?\s+faint\b/i,
      /\bfelt\s+faint\b/i,
      /\bpassed\s+out\b/i,
      /\bblack(ed)?\s+out\b/i,
      /\bsyncope\b/i,
    ],
    professionalCareGuidance:
      "Pause training and consider professional care before exercising after fainting.",
    summaryLabel: "fainting",
  },
  {
    id: "unusual-shortness-of-breath",
    category: "respiratory_symptom",
    severity: "urgent",
    recommendationImpact: "professional_care",
    patterns: [
      /\b(unusual|unusually|new|newly|unexplained|unexpected|severe)\s+(short(ness)?\s+of\s+breath|short\s+of\s+breath|breathless(ness)?)\b/i,
      /\b(short(ness)?\s+of\s+breath|short\s+of\s+breath|breathless(ness)?)\b.{0,32}\b(unusual|new|unexplained|unexpected|severe)\b/i,
      /\bdifficulty\s+breathing\b/i,
      /\b(can't|cannot)\s+catch\s+(my\s+)?breath\b/i,
    ],
    professionalCareGuidance:
      "Pause training and consider professional care before exercising with unusual breathlessness.",
    summaryLabel: "unusual shortness of breath",
  },
  {
    id: "fever",
    category: "illness",
    severity: "high",
    recommendationImpact: "recovery_only",
    patterns: [/\bfever(ish)?\b/i, /\bhigh\s+temp(erature)?\b/i, /\bchills\b/i],
    professionalCareGuidance:
      "Avoid intensity while feverish and consider professional care if symptoms persist or worsen.",
    summaryLabel: "fever",
  },
  {
    id: "significant-pain",
    category: "pain",
    severity: "high",
    recommendationImpact: "recovery_only",
    patterns: [
      /\bsignificant\s+pain\b/i,
      /\bsevere\s+pain\b/i,
      /\bsharp\s+pain\b/i,
      /\bsharp\b.{0,24}\bpain\b/i,
      /\bworsening\s+pain\b/i,
      /\bpain\b.{0,24}\b(severe|sharp|worsening)\b/i,
    ],
    professionalCareGuidance:
      "Keep training to recovery only and consider professional care for significant, sharp, or worsening pain.",
    summaryLabel: "significant pain",
  },
  {
    id: "injury-concern",
    category: "injury",
    severity: "high",
    recommendationImpact: "recovery_only",
    patterns: [
      /\binjur(y|ed|ies)\b/i,
      /\bsprain(ed)?\b/i,
      /\bstrain(ed)?\b/i,
      /\btwisted\s+(my\s+)?(ankle|knee|wrist|back)\b/i,
      /\brolled\s+(my\s+)?(ankle|knee|wrist|foot)\b/i,
      /\btweaked\s+(my\s+)?(ankle|knee|wrist|back|hip|shoulder|calf|hamstring|quad)\b/i,
      /\bhurt\s+(my\s+)?(ankle|knee|wrist|back|hip|shoulder|foot|calf|hamstring|quad)\b/i,
      /\bpulled\s+(a\s+)?muscle\b/i,
      /\bpossible\s+fracture\b/i,
      /\b(can't|cannot)\s+bear\s+weight\b/i,
      /\blimp(ing|ed)?\b/i,
      /\bswollen\b/i,
      /\bswelling\b/i,
    ],
    professionalCareGuidance:
      "Keep training to recovery only and consider professional care for injury concerns.",
    summaryLabel: "injury concern",
  },
  {
    id: "pregnancy-related-concern",
    category: "pregnancy_related",
    severity: "moderate",
    recommendationImpact: "reduce_intensity",
    patterns: [/\bpregnan(t|cy)\b/i, /\bpostpartum\b/i, /\bprenatal\b/i],
    professionalCareGuidance:
      "Use conservative intensity and follow clinician guidance for pregnancy-related training concerns.",
    summaryLabel: "pregnancy-related concern",
  },
  {
    id: "disordered-eating-signal",
    category: "disordered_eating_signal",
    severity: "high",
    recommendationImpact: "professional_care",
    patterns: [
      /\beating\s+disorder\b/i,
      /\bpurging\b/i,
      /\brestricting\s+(food|calories|eating)\b/i,
      /\bafraid\s+to\s+eat\b/i,
      /\bskipping\s+meals\b/i,
      /\bunder[\s-]?eating\b/i,
    ],
    professionalCareGuidance:
      "Lower training demands and consider professional care for eating-related safety concerns.",
    summaryLabel: "disordered eating signal",
  },
  {
    id: "severe-fatigue",
    category: "severe_fatigue",
    severity: "moderate",
    recommendationImpact: "reduce_intensity",
    patterns: [
      /\bsevere\s+fatigue\b/i,
      /\bextreme\s+fatigue\b/i,
      /\bexhausted\b/i,
      /\bcan't\s+recover\b/i,
      /\bcannot\s+recover\b/i,
      /\bcrushed\b/i,
    ],
    professionalCareGuidance:
      "Reduce intensity and consider professional care if severe fatigue persists or feels unusual.",
    summaryLabel: "severe fatigue",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function noRiskFlags(generatedAt: string): RiskFlags {
  return {
    generated_at: generatedAt,
    highest_severity: "none",
    has_blocking_risk: false,
    summary: "No risk flags were supplied in the current structured input.",
    items: [
      {
        id: "no-risk-reported",
        category: "other",
        severity: "none",
        source: "coach_service",
        evidence:
          "No pain, illness, injury, or severe fatigue signal was provided.",
        recommendation_impact: "none",
        professional_care_guidance: null,
        created_at: generatedAt,
      },
    ],
  };
}

function highestSeverity(flags: readonly RiskFlag[]): RiskFlagSeverity {
  return flags.reduce<RiskFlagSeverity>(
    (highest, flag) =>
      severityRank[flag.severity] > severityRank[highest]
        ? flag.severity
        : highest,
    "none",
  );
}

function hasBlockingRisk(flags: readonly RiskFlag[]): boolean {
  return flags.some(
    (flag) =>
      blockingSeverities.has(flag.severity) ||
      flag.recommendation_impact === "professional_care" ||
      flag.recommendation_impact === "recovery_only",
  );
}

function riskSummary(flags: readonly RiskFlag[]): string {
  const labels = flags
    .filter((flag) => flag.severity !== "none")
    .map((flag) => {
      const entry = riskFlagCatalog.find(
        (candidate) => candidate.id === flag.id,
      );
      return entry?.summaryLabel ?? flag.category.replace(/_/g, " ");
    });

  if (!labels.length) {
    return "No risk flags were supplied in the current structured input.";
  }

  return `Detected risk flags for ${labels.join(", ")}. Use conservative guidance and lower confidence or intensity.`;
}

function buildRiskFlags(flags: RiskFlag[], generatedAt: string): RiskFlags {
  if (!flags.length) {
    return noRiskFlags(generatedAt);
  }

  const highest = highestSeverity(flags);

  return {
    generated_at: generatedAt,
    highest_severity: highest,
    has_blocking_risk: hasBlockingRisk(flags),
    summary: riskSummary(flags),
    items: flags,
  };
}

function negationBefore(text: string, matchIndex: number): boolean {
  const before =
    text
      .slice(Math.max(0, matchIndex - 120), matchIndex)
      .split(/[.!?;:]|(?:^|\b)(?:but|however|except|though|yet)(?:\b|$)/i)
      .pop() ?? "";

  return /(?:^|\b)(no|not|never|without|denies|denied|free of|do not have|don't have|haven't had|hasn't had)(?:\W+\w+){0,6}\W*$/i.test(
    before,
  );
}

function firstNonNegatedMatch(
  text: string,
  patterns: readonly RegExp[],
): RegExpExecArray | null {
  for (const pattern of patterns) {
    const flags = pattern.flags.includes("g")
      ? pattern.flags
      : `${pattern.flags}g`;
    const globalPattern = new RegExp(pattern.source, flags);
    let match = globalPattern.exec(text);

    while (match) {
      if (!negationBefore(text, match.index)) {
        return match;
      }
      match = globalPattern.exec(text);
    }
  }

  return null;
}

function evidenceFor(input: RiskFlagInput, matchedText: string): string {
  const prefix = input.label ? `${input.label}: ` : "";
  return `${prefix}${matchedText}`.trim();
}

export function extractRiskFlags(
  inputs: readonly RiskFlagInput[],
  { generatedAt }: RiskFlagExtractionOptions,
): RiskFlags {
  const flagsById = new Map<string, RiskFlag>();

  for (const input of inputs) {
    const text = input.text.trim();
    if (!text) {
      continue;
    }

    for (const entry of riskFlagCatalog) {
      if (flagsById.has(entry.id)) {
        continue;
      }

      const match = firstNonNegatedMatch(text, entry.patterns);
      if (!match) {
        continue;
      }

      flagsById.set(entry.id, {
        id: entry.id,
        category: entry.category,
        severity: entry.severity,
        source: input.source,
        evidence: evidenceFor(input, match[0]),
        recommendation_impact: entry.recommendationImpact,
        professional_care_guidance: entry.professionalCareGuidance,
        created_at: generatedAt,
      });
    }
  }

  return buildRiskFlags([...flagsById.values()], generatedAt);
}

function collectTextInputs(
  value: unknown,
  source: RiskFlagSource,
  label: string,
  inputs: RiskFlagInput[],
  depth = 0,
) {
  if (depth > 4 || value == null) {
    return;
  }

  if (typeof value === "string") {
    inputs.push({ source, text: value, label });
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectTextInputs(item, source, `${label}[${index}]`, inputs, depth + 1);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  Object.entries(value).forEach(([key, nestedValue]) => {
    collectTextInputs(
      nestedValue,
      source,
      `${label}.${key}`,
      inputs,
      depth + 1,
    );
  });
}

export function extractRiskFlagsFromCoachRequest(
  request: CoachRiskFlagRequest,
): RiskFlags {
  const inputs: RiskFlagInput[] = [];

  if (request.user_message) {
    collectTextInputs(
      request.user_message,
      "typed_adjustment",
      "user_message",
      inputs,
    );
  }
  if (request.goal_profile) {
    collectTextInputs(
      request.goal_profile,
      "goal_profile",
      "goal_profile",
      inputs,
    );
  }
  if (request.event_profile) {
    collectTextInputs(
      request.event_profile,
      "event_profile",
      "event_profile",
      inputs,
    );
  }
  if (request.daily_check_in) {
    collectTextInputs(
      request.daily_check_in,
      "daily_check_in",
      "daily_check_in",
      inputs,
    );
  }
  if (request.typed_adjustment) {
    collectTextInputs(
      request.typed_adjustment,
      "typed_adjustment",
      "typed_adjustment",
      inputs,
    );
  }

  if (request.risk_flag_inputs) {
    inputs.push(...request.risk_flag_inputs);
  }

  return extractRiskFlags(inputs, { generatedAt: request.generated_at });
}

function nonNoneRiskFlags(flags: RiskFlags): RiskFlag[] {
  return flags.items.filter((flag) => flag.severity !== "none");
}

function mergeRiskFlags(existing: RiskFlags, extracted: RiskFlags): RiskFlags {
  const flagsById = new Map<string, RiskFlag>();

  [...nonNoneRiskFlags(existing), ...nonNoneRiskFlags(extracted)].forEach(
    (flag) => {
      const current = flagsById.get(flag.id);
      if (
        !current ||
        severityRank[flag.severity] > severityRank[current.severity]
      ) {
        flagsById.set(flag.id, flag);
      }
    },
  );

  return buildRiskFlags([...flagsById.values()], extracted.generated_at);
}

function clampConfidence(value: number, maximum: number): number {
  return Math.max(0, Math.min(value, maximum));
}

function nextStatus(
  current: StructuredCoachOutput["readiness_status"]["status"],
  riskFlags: RiskFlags,
): StructuredCoachOutput["readiness_status"]["status"] {
  if (riskFlags.has_blocking_risk) {
    return "red";
  }

  if (riskFlags.highest_severity === "moderate" && current === "green") {
    return "yellow";
  }

  return current;
}

function overrideExplanation(riskFlags: RiskFlags): string {
  return `Risk flags lowered confidence and intensity: ${riskFlags.summary}`;
}

function riskGuidance(riskFlags: RiskFlags): string {
  const guidance = riskFlags.items
    .map((flag) => flag.professional_care_guidance)
    .filter((value): value is string => Boolean(value));

  if (!guidance.length) {
    return "Use recovery guidance until the risk signal is resolved.";
  }

  return guidance[0];
}

export function applyConservativeRiskOverride(
  output: StructuredCoachOutput,
  extractedRiskFlags: RiskFlags,
): StructuredCoachOutput {
  const riskFlags = mergeRiskFlags(output.risk_flags, extractedRiskFlags);
  const applied = riskFlags.highest_severity !== "none";

  if (!applied) {
    return {
      ...output,
      risk_flags: riskFlags,
    };
  }

  const recoveryOnly = riskFlags.has_blocking_risk;
  const maxConfidence = recoveryOnly ? 0.35 : 0.5;
  const explanation = overrideExplanation(riskFlags);
  const guidance = riskGuidance(riskFlags);

  return {
    ...output,
    risk_flags: riskFlags,
    readiness_status: {
      ...output.readiness_status,
      status: nextStatus(output.readiness_status.status, riskFlags),
      confidence: clampConfidence(
        output.readiness_status.confidence,
        maxConfidence,
      ),
      conservative_adjustment_reason: explanation,
      summary: `${output.readiness_status.summary} ${explanation}`,
    },
    daily_recommendation: {
      ...output.daily_recommendation,
      readiness_status: nextStatus(
        output.daily_recommendation.readiness_status,
        riskFlags,
      ),
      short_explanation: `${explanation} ${guidance}`,
      recommended_activity: {
        title: recoveryOnly
          ? "Recovery and professional-care check"
          : "Reduced-intensity recovery session",
        activity_type: recoveryOnly ? "rest" : "walk",
        intensity_target: "recovery",
        duration_minutes: recoveryOnly ? null : 20,
        volume: recoveryOnly
          ? "No hard training today"
          : "Easy movement only; stop if symptoms worsen",
        rationale: `${explanation} ${guidance}`,
      },
      easier_alternative: {
        ...output.daily_recommendation.easier_alternative,
        title: "Full rest",
        activity_type: "rest",
        intensity_target: "recovery",
        duration_minutes: null,
        volume: "Rest and monitor symptoms",
        rationale:
          "This is the lowest-intensity option while risk flags are present.",
      },
      what_to_avoid_today: Array.from(
        new Set([
          ...output.daily_recommendation.what_to_avoid_today,
          "hard training",
          "testing fitness",
          "pushing through symptoms",
        ]),
      ),
      confidence: clampConfidence(
        output.daily_recommendation.confidence,
        maxConfidence,
      ),
      sources_used: Array.from(
        new Set([...output.daily_recommendation.sources_used, "risk flags"]),
      ),
      risk_flags_applied: true,
    },
    health_check: {
      ...output.health_check,
      risks: Array.from(
        new Set([...output.health_check.risks, riskFlags.summary]),
      ),
      summary_markdown: `${output.health_check.summary_markdown}\n\n${explanation}`,
    },
    inspection_notes: Array.from(
      new Set([
        ...output.inspection_notes,
        "Safety risk flags were extracted before recommendation display and applied conservatively.",
      ]),
    ),
  };
}
