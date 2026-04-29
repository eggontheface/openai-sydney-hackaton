import {
  buildTrainingLoadSnapshot,
  recommendationBoundaryForTrainingLoad,
  toTrainingLoadExport,
} from "./trainingLoad";

describe("training load boundary", () => {
  it("marks training load unavailable instead of deriving it from generic workout history", () => {
    const snapshot = buildTrainingLoadSnapshot({
      genericPlatformWorkoutCount: 8,
    });
    const boundary = recommendationBoundaryForTrainingLoad(snapshot);
    const exported = toTrainingLoadExport(snapshot);

    expect(snapshot.trainingLoadStatus).toBe("unavailable");
    expect(snapshot.intervals).toBeUndefined();
    expect(boundary.canUseTrainingLoad).toBe(false);
    expect(boundary.intensityAdjustment).toBe("none");
    expect(boundary.sourcesIgnored).toContain("training load unavailable");
    expect(exported.training_load_status).toBe("unavailable");
    expect(exported.intervals).toBeNull();
  });

  it("preserves source-provided Intervals-ready fields without calculating a model", () => {
    const snapshot = buildTrainingLoadSnapshot({
      source: {
        trainingLoadStatus: "source-provided",
        sourceKind: "intervals_icu",
        sourceName: "Intervals.icu",
        method: "external_source",
        asOf: "2026-04-28T08:00:00.000Z",
        intervals: {
          ctl: 42,
          atl: 51,
          tsb: -9,
          rampRate7d: 2.5,
          dailyLoad: 86,
          dailyLoadUnit: "intervals_icu_load",
        },
      },
    });
    const boundary = recommendationBoundaryForTrainingLoad(snapshot);
    const exported = toTrainingLoadExport(snapshot);

    expect(snapshot.trainingLoadStatus).toBe("source-provided");
    expect(snapshot.intervals).toEqual({
      ctl: 42,
      atl: 51,
      tsb: -9,
      rampRate7d: 2.5,
      dailyLoad: 86,
      dailyLoadUnit: "intervals_icu_load",
    });
    expect(boundary.canUseTrainingLoad).toBe(true);
    expect(boundary.intensityAdjustment).toBe("none");
    expect(exported.training_load_status).toBe("source-provided");
    expect(exported.intervals?.ctl).toBe(42);
  });

  it("allows derived load only when a documented method is supplied", () => {
    const snapshot = buildTrainingLoadSnapshot({
      source: {
        trainingLoadStatus: "derived",
        sourceKind: "documented_local_model",
        sourceName: "Local load model",
        method: "documented_trimp_v1",
        asOf: "2026-04-28T08:00:00.000Z",
        intervals: {
          dailyLoad: 54,
          dailyLoadUnit: "trimp",
        },
      },
    });
    const boundary = recommendationBoundaryForTrainingLoad(snapshot);
    const exported = toTrainingLoadExport(snapshot);

    expect(snapshot.trainingLoadStatus).toBe("derived");
    expect(boundary.canUseTrainingLoad).toBe(true);
    expect(exported.method).toBe("documented_trimp_v1");
    expect(exported.intervals?.dailyLoadUnit).toBe("trimp");
  });

  it("downgrades derived load without a documented method to unavailable", () => {
    const snapshot = buildTrainingLoadSnapshot({
      source: {
        trainingLoadStatus: "derived",
        sourceKind: "documented_local_model",
        sourceName: "Local load model",
      },
    });
    const boundary = recommendationBoundaryForTrainingLoad(snapshot);
    const exported = toTrainingLoadExport(snapshot);

    expect(snapshot.trainingLoadStatus).toBe("unavailable");
    expect(boundary.canUseTrainingLoad).toBe(false);
    expect(exported.training_load_status).toBe("unavailable");
    expect(exported.limitations.join(" ")).toMatch(/method name/i);
  });

  it("preserves stale load for export but ignores it for recommendations", () => {
    const snapshot = buildTrainingLoadSnapshot({
      source: {
        trainingLoadStatus: "stale",
        sourceKind: "intervals_icu",
        sourceName: "Intervals.icu",
        method: "external_source",
        asOf: "2026-04-20T08:00:00.000Z",
        staleAfterDays: 3,
        intervals: {
          ctl: 38,
          atl: 42,
          tsb: -4,
        },
      },
    });
    const boundary = recommendationBoundaryForTrainingLoad(snapshot);
    const exported = toTrainingLoadExport(snapshot);

    expect(snapshot.trainingLoadStatus).toBe("stale");
    expect(boundary.canUseTrainingLoad).toBe(false);
    expect(boundary.sourcesIgnored).toContain("stale training load");
    expect(exported.training_load_status).toBe("stale");
    expect(exported.intervals?.ctl).toBe(38);
  });
});
