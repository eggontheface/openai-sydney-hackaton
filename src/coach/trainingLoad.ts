import type {
  TrainingLoadIntervalsFields,
  TrainingLoadSnapshot,
  TrainingLoadSourceKind,
  TrainingLoadStatus,
} from "../health/types";

type SuppliedTrainingLoadStatus = Exclude<TrainingLoadStatus, "unavailable">;

export type TrainingLoadSourceInput = {
  trainingLoadStatus: SuppliedTrainingLoadStatus;
  sourceKind: TrainingLoadSourceKind;
  sourceName: string;
  method?: string;
  asOf?: string;
  staleAfterDays?: number;
  intervals?: TrainingLoadIntervalsFields;
};

export type BuildTrainingLoadSnapshotInput = {
  source?: TrainingLoadSourceInput | null;
  genericPlatformWorkoutCount?: number;
};

export type TrainingLoadRecommendationBoundary = {
  canUseTrainingLoad: boolean;
  intensityAdjustment: "none";
  sourcesUsed: string[];
  sourcesIgnored: string[];
  recommendationNote: string;
};

export type TrainingLoadExport = {
  training_load_status: TrainingLoadStatus;
  label: string;
  summary: string;
  source_kind: TrainingLoadSourceKind | null;
  source_name: string | null;
  method: string | null;
  as_of: string | null;
  stale_after_days: number | null;
  intervals: TrainingLoadIntervalsFields | null;
  limitations: string[];
};

const unavailableLimitations = [
  "Health Connect and Apple Health workouts are preserved as raw activity history, not converted into CTL, ATL, TSB, or daily training load.",
  "Connect an external load source or add a documented local model before using training load in recommendations.",
];

export function buildTrainingLoadSnapshot(
  input: BuildTrainingLoadSnapshotInput = {},
): TrainingLoadSnapshot {
  if (!input.source) {
    return {
      trainingLoadStatus: "unavailable",
      label: "Training load unavailable",
      summary:
        "Training load is not available from the current platform data. Workouts stay available for history, but load is not estimated from generic activity records.",
      limitations: [...unavailableLimitations],
    };
  }

  const source = input.source;

  if (source.trainingLoadStatus === "derived" && !source.method) {
    return {
      trainingLoadStatus: "unavailable",
      label: "Training load unavailable",
      summary:
        "A derived training load source was provided without a documented method, so it is ignored.",
      sourceKind: source.sourceKind,
      sourceName: source.sourceName,
      limitations: [
        "Derived training load must include a method name before it can influence recommendations.",
        ...unavailableLimitations,
      ],
    };
  }

  if (source.trainingLoadStatus === "stale") {
    return {
      trainingLoadStatus: "stale",
      label: "Training load stale",
      summary:
        "A training load source exists, but it is stale and should be shown only as unavailable for today.",
      sourceKind: source.sourceKind,
      sourceName: source.sourceName,
      method: source.method,
      asOf: source.asOf,
      staleAfterDays: source.staleAfterDays,
      intervals: source.intervals,
      limitations: [
        "Stale training load is preserved for export and ignored by recommendation logic.",
      ],
    };
  }

  return {
    trainingLoadStatus: source.trainingLoadStatus,
    label:
      source.trainingLoadStatus === "source-provided"
        ? "Training load source-provided"
        : "Training load derived",
    summary:
      source.trainingLoadStatus === "source-provided"
        ? "Training load was supplied by an explicit source and can cross the recommendation boundary."
        : "Training load was produced by a documented local method and can cross the recommendation boundary.",
    sourceKind: source.sourceKind,
    sourceName: source.sourceName,
    method: source.method,
    asOf: source.asOf,
    staleAfterDays: source.staleAfterDays,
    intervals: source.intervals,
    limitations: [
      "This boundary preserves load fields but does not calculate a training stress model.",
    ],
  };
}

export function recommendationBoundaryForTrainingLoad(
  snapshot: TrainingLoadSnapshot,
): TrainingLoadRecommendationBoundary {
  if (
    snapshot.trainingLoadStatus === "source-provided" ||
    snapshot.trainingLoadStatus === "derived"
  ) {
    const source = snapshot.sourceName ?? "training load source";

    return {
      canUseTrainingLoad: true,
      intensityAdjustment: "none",
      sourcesUsed: [`training load from ${source}`],
      sourcesIgnored: [],
      recommendationNote:
        "Training load is available at the boundary, but this placeholder does not calculate intensity changes from it.",
    };
  }

  const ignored =
    snapshot.trainingLoadStatus === "stale"
      ? "stale training load"
      : "training load unavailable";

  return {
    canUseTrainingLoad: false,
    intensityAdjustment: "none",
    sourcesUsed: [],
    sourcesIgnored: [ignored],
    recommendationNote:
      snapshot.trainingLoadStatus === "stale"
        ? "Stale training load was ignored instead of being used to raise intensity."
        : "Training load was unavailable, so no load score was estimated from generic workouts.",
  };
}

export function toTrainingLoadExport(
  snapshot: TrainingLoadSnapshot,
): TrainingLoadExport {
  return {
    training_load_status: snapshot.trainingLoadStatus,
    label: snapshot.label,
    summary: snapshot.summary,
    source_kind: snapshot.sourceKind ?? null,
    source_name: snapshot.sourceName ?? null,
    method: snapshot.method ?? null,
    as_of: snapshot.asOf ?? null,
    stale_after_days: snapshot.staleAfterDays ?? null,
    intervals: snapshot.intervals ?? null,
    limitations: snapshot.limitations,
  };
}
