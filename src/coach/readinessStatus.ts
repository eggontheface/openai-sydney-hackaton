import type { CoachTone, SourceFreshness } from "../health/types";

export type ReadinessStatusValue = "green" | "yellow" | "red" | "unknown";

export type ReadinessStatusUi = {
  label: string;
  color: CoachTone;
  title: string;
  detail: string;
  reason: string;
  opener: string;
};

export type ReadinessStatusContract = {
  status: ReadinessStatusValue;
  confidence: number;
  score: number | null;
  signalsUsed: string[];
  staleSignalsIgnored: string[];
  missingSignals: string[];
  conservativeAdjustmentReason: string | null;
  ui: ReadinessStatusUi;
};

export type BuildReadinessStatusInput = {
  score: number | null;
  signalsUsed: string[];
  sourceFreshness?: SourceFreshness[];
};

const importantDomains = new Set([
  "sleep",
  "hrv",
  "resting_hr",
  "steps",
  "energy",
]);

function signalLabel(signal: SourceFreshness): string {
  return `${signal.label} is ${signal.state}`;
}

function confidenceFor(
  score: number | null,
  staleSignalsIgnored: string[],
  missingSignals: string[],
): number {
  if (score == null) {
    return 0.2;
  }

  const penalty =
    staleSignalsIgnored.length * 0.12 + missingSignals.length * 0.18;

  return Math.max(0.25, Math.min(0.9, Number((0.86 - penalty).toFixed(2))));
}

function baseStatus(
  score: number | null,
  hasUsableReadinessSignals: boolean,
  hasStaleOrMissingSignals: boolean,
): ReadinessStatusValue {
  if (score == null || !hasUsableReadinessSignals) {
    return "unknown";
  }

  if (score < 50) {
    return "red";
  }

  if (score >= 78 && !hasStaleOrMissingSignals) {
    return "green";
  }

  return "yellow";
}

function adjustmentReason(
  status: ReadinessStatusValue,
  hasUsableReadinessSignals: boolean,
  staleSignalsIgnored: string[],
  missingSignals: string[],
): string | null {
  if (status === "unknown") {
    if (!hasUsableReadinessSignals) {
      return "Unknown readiness is treated conservatively until enough usable recovery signals are available.";
    }

    return "Unknown readiness is treated conservatively until enough current recovery data is available.";
  }

  if (staleSignalsIgnored.length || missingSignals.length) {
    return "Stale or missing data lowered confidence and kept the readiness call conservative.";
  }

  return null;
}

function uiForStatus(status: ReadinessStatusValue): ReadinessStatusUi {
  if (status === "green") {
    return {
      label: "Green",
      color: "positive",
      title: "Quality session available",
      detail: "Current recovery supports planned intensity.",
      reason: "The usable recovery signals point toward a normal training day.",
      opener:
        "Green light today. Use the plan, then keep the recovery basics tight.",
    };
  }

  if (status === "red") {
    return {
      label: "Red",
      color: "warm",
      title: "Recovery priority",
      detail: "Keep training easy and avoid intensity.",
      reason: "The usable recovery signals point toward backing off today.",
      opener: "Red today. Keep this soft and protect the next useful session.",
    };
  }

  if (status === "unknown") {
    return {
      label: "Unknown",
      color: "warm",
      title: "Readiness unknown",
      detail: "Keep it easy until current recovery data is available.",
      reason:
        "There is not enough current data for a confident readiness call.",
      opener: "Readiness is unknown, so I would keep today conservative.",
    };
  }

  return {
    label: "Yellow",
    color: "warm",
    title: "Controlled aerobic work",
    detail: "Train, but keep intensity controlled.",
    reason: "The usable recovery signals support training with some restraint.",
    opener: "Yellow today. Stack the work, but leave room to adapt.",
  };
}

export function buildReadinessStatus({
  score,
  signalsUsed,
  sourceFreshness = [],
}: BuildReadinessStatusInput): ReadinessStatusContract {
  const relevantGaps = sourceFreshness.filter(
    (signal) =>
      importantDomains.has(signal.domain) &&
      (signal.state === "stale" || signal.state === "missing"),
  );
  const staleSignalsIgnored = relevantGaps
    .filter((signal) => signal.state === "stale")
    .map(signalLabel);
  const missingSignals = relevantGaps
    .filter((signal) => signal.state === "missing")
    .map(signalLabel);
  const ignoredSignalLabels = new Set([
    ...staleSignalsIgnored,
    ...missingSignals,
  ]);
  const usableSignals = signalsUsed.filter(
    (signal) => !ignoredSignalLabels.has(signal),
  );
  const hasUsableReadinessSignals = usableSignals.length > 0;
  const contractScore = hasUsableReadinessSignals ? score : null;
  const status = baseStatus(
    contractScore,
    hasUsableReadinessSignals,
    Boolean(staleSignalsIgnored.length || missingSignals.length),
  );

  return {
    status,
    confidence: confidenceFor(
      contractScore,
      staleSignalsIgnored,
      missingSignals,
    ),
    score: contractScore,
    signalsUsed: usableSignals,
    staleSignalsIgnored,
    missingSignals,
    conservativeAdjustmentReason: adjustmentReason(
      status,
      hasUsableReadinessSignals,
      staleSignalsIgnored,
      missingSignals,
    ),
    ui: uiForStatus(status),
  };
}
