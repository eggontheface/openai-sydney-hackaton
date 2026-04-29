import type { PipelineSnapshot, SourceFreshness } from "../health/types";

import { buildTrainingLoadSnapshot } from "../coach/trainingLoad";
import { generateHealthCheckMarkdown } from "./healthCheck";

const generatedAt = "2026-04-29T05:00:00.000Z";

function source(
  overrides: Partial<SourceFreshness> &
    Pick<SourceFreshness, "domain" | "label">,
): SourceFreshness {
  return {
    state: "fresh",
    canonicalTypes: [],
    sampleCount: 0,
    dayCount: 0,
    limitations: [],
    ...overrides,
  };
}

function snapshot(overrides: Partial<PipelineSnapshot> = {}): PipelineSnapshot {
  return {
    totalSamples: 128,
    workoutCount: 4,
    sleepCount: 6,
    nutritionDays: 5,
    coverageDays: 14,
    metricAvailability: [],
    sourceFreshness: [
      source({
        domain: "sleep",
        label: "Sleep",
        state: "fresh",
        sampleCount: 6,
        dayCount: 6,
        latestLocalDate: "2026-04-29",
      }),
      source({
        domain: "workouts",
        label: "Workouts",
        state: "stale",
        sampleCount: 2,
        dayCount: 2,
        latestLocalDate: "2026-04-24",
        ageDays: 5,
        limitations: ["No workout import has completed this week."],
      }),
      source({
        domain: "steps",
        label: "Steps",
        state: "partial",
        sampleCount: 14,
        dayCount: 7,
        latestLocalDate: "2026-04-29",
        limitations: ["Today is still in progress."],
      }),
      source({
        domain: "check_ins",
        label: "Check-ins",
        state: "missing",
        limitations: [
          "Daily check-ins are not implemented in local storage yet.",
        ],
      }),
    ],
    latestDiagnostics: [],
    today: {
      date: "2026-04-29",
      dataCompleteness: "partial",
      wellnessDataStatus: "Watch data without nutrition",
      sourceCount: 3,
      hasPlatformWellness: true,
      hasActivity: true,
      hasNutrition: false,
      hasSleep: true,
      hasSteps: true,
      hasEnergy: true,
      steps: 6400,
      activeKcal: 410,
      sleepSeconds: 7 * 3600,
      restingHr: 52,
      hrvLastNightAvg: 48,
      workoutCount: 0,
      generatedAt,
    },
    history: [],
    recentWorkouts: [],
    recentSamples: [],
    trainingLoad: buildTrainingLoadSnapshot(),
    recommendation: {
      readiness: 62,
      readinessLabel: "Yellow",
      color: "warm",
      title: "Keep it easy",
      detail: "Easy aerobic session only.",
      reason: "Freshness is mixed.",
      opener: "Use the current data conservatively.",
      strain: 5,
      strainTarget: "4-6",
    },
    ...overrides,
  };
}

describe("generateHealthCheckMarkdown", () => {
  it("summarizes known, uncertain, stale, risky, and missing local data", () => {
    const markdown = generateHealthCheckMarkdown(snapshot(), { generatedAt });

    expect(markdown).toContain("# health_check.md");
    expect(markdown).toContain("Generated at: 2026-04-29T05:00:00.000Z");
    expect(markdown).toContain("## Known");
    expect(markdown).toContain(
      "- Pipeline coverage: 14 days, 128 samples, 4 workouts, 6 sleep days, 5 nutrition days.",
    );
    expect(markdown).toContain(
      "- Today: 2026-04-29, partial completeness, 3 active source domains.",
    );
    expect(markdown).toContain(
      "- Readiness estimate: Yellow (62/100), target strain 4-6.",
    );
    expect(markdown).toContain("## Source Coverage");
    expect(markdown).toContain(
      "- Sleep: fresh; latest 2026-04-29; 6 days; 6 samples.",
    );
    expect(markdown).toContain(
      "- Workouts: stale; latest 2026-04-24; 2 days; 2 samples; age 5 days.",
    );
    expect(markdown).toContain("## Uncertain");
    expect(markdown).toContain(
      "- Steps is partial: Today is still in progress.",
    );
    expect(markdown).toContain(
      "- Today is partial, so current-day totals may change after the next sync.",
    );
    expect(markdown).toContain("## Stale");
    expect(markdown).toContain(
      "- Workouts last updated on 2026-04-24, 5 days ago: No workout import has completed this week.",
    );
    expect(markdown).toContain("## Risky");
    expect(markdown).toContain(
      "- Stale or missing domains reduce confidence; avoid using this export as proof of current readiness.",
    );
    expect(markdown).toContain(
      "- No daily check-in is available; subjective fatigue, soreness, pain, illness, and motivation are unknown.",
    );
    expect(markdown).toContain("## Missing");
    expect(markdown).toContain(
      "- Check-ins is missing: Daily check-ins are not implemented in local storage yet.",
    );
    expect(markdown).not.toMatch(
      /\b(diagnose|diagnosis|treatment|prescribe|prescription|disease)\b/i,
    );
  });

  it("reports an empty snapshot without inventing available data", () => {
    const markdown = generateHealthCheckMarkdown(
      snapshot({
        totalSamples: 0,
        workoutCount: 0,
        sleepCount: 0,
        nutritionDays: 0,
        coverageDays: 0,
        sourceFreshness: [],
        today: null,
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
      }),
      { generatedAt },
    );

    expect(markdown).toContain(
      "- Pipeline coverage: no local health data is available.",
    );
    expect(markdown).toContain("- Today: no daily rollup is available.");
    expect(markdown).toContain("- Source freshness rows are unavailable.");
    expect(markdown).toContain("- No source coverage dates are available.");
    expect(markdown).toContain(
      "- Local health data is missing; recommendations should stay conservative.",
    );
  });
});
