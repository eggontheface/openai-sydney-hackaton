import type { PipelineSnapshot } from "../health/types";

import { completeCoachRecommendation } from "../coach/dailyRecommendation";
import { buildReadinessStatus } from "../coach/readinessStatus";
import { buildTrainingLoadSnapshot } from "../coach/trainingLoad";
import { buildPipelineExportArtifacts } from "./pipelineExport";

function snapshot(): PipelineSnapshot {
  return {
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
    todayCheckIn: null,
    checkInHistory: [],
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
      reason:
        "There is not enough current data for a confident readiness call.",
      opener: "Readiness is unknown, so I would keep today conservative.",
      strain: 0,
      strainTarget: "0",
    }),
  };
}

describe("buildPipelineExportArtifacts", () => {
  it("uses stable artifact names and the export timestamp for health_check.md", () => {
    const artifacts = buildPipelineExportArtifacts(snapshot(), {
      exportedAt: "2026-04-29T05:00:00.000Z",
      timestamp: 123,
    });

    expect(artifacts.jsonFileName).toBe("biostream-pipeline-123.json");
    expect(artifacts.healthCheckFileName).toBe("health_check-123.md");
    expect(artifacts.healthCheckMarkdown).toContain(
      "Generated at: 2026-04-29T05:00:00.000Z",
    );
  });
});
