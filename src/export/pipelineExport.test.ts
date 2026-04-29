import type { PipelineSnapshot } from "../health/types";

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
    recentWorkouts: [],
    recentSamples: [],
    trainingLoad: buildTrainingLoadSnapshot(),
    recommendation: {
      readiness: null,
      readinessLabel: "Unknown",
      color: "neutral",
      title: "Connect data",
      detail: "No local data yet.",
      reason: "No platform data is available.",
      opener: "Connect a health source.",
      strain: 0,
      strainTarget: "0",
    },
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
