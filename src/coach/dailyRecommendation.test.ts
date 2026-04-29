import { buildReadinessStatus } from "./readinessStatus";
import { buildDailyRecommendationFields } from "./dailyRecommendation";

describe("daily recommendation contract", () => {
  it("includes activity, easier alternative, avoid list, source awareness, and check-in question", () => {
    const readinessStatus = buildReadinessStatus({
      score: 84,
      signalsUsed: ["sleep was 8h", "resting HR is down 4 bpm"],
      sourceFreshness: [],
    });

    const recommendation = buildDailyRecommendationFields({
      readinessStatus,
      title: "Quality run",
      detail: "10 min easy · 4 x 5 min strong · cool down",
      reason: "Recovery supports a harder aerobic stimulus.",
      readinessSignals: readinessStatus.signalsUsed,
    });

    expect(recommendation.recommendedActivity.title).toBe("Quality run");
    expect(recommendation.recommendedActivity.intensityTarget).toBe(
      "planned intensity",
    );
    expect(recommendation.easierAlternative.title).toBe("Short aerobic option");
    expect(recommendation.whatToAvoidToday).toContain("large volume jumps");
    expect(recommendation.sourcesUsed).toEqual([
      "sleep was 8h",
      "resting HR is down 4 bpm",
    ]);
    expect(recommendation.sourcesIgnored).toEqual([]);
    expect(recommendation.confidence).toBeGreaterThanOrEqual(0.75);
    expect(recommendation.checkInQuestion).toMatch(/soreness|illness/i);
  });

  it("reduces confidence and keeps guidance conservative when readiness is unknown", () => {
    const readinessStatus = buildReadinessStatus({
      score: 62,
      signalsUsed: [],
      sourceFreshness: [],
    });

    const recommendation = buildDailyRecommendationFields({
      readinessStatus,
      title: "Easy walk + mobility",
      detail: "20-30 min easy movement",
      reason: "Readiness is unknown, so today's call stays conservative.",
      contextSignals: ["training load unavailable"],
    });

    expect(readinessStatus.status).toBe("unknown");
    expect(recommendation.confidence).toBeLessThanOrEqual(0.35);
    expect(recommendation.recommendedActivity.intensityTarget).toBe(
      "easy until clearer",
    );
    expect(recommendation.easierAlternative.intensityTarget).toBe("very easy");
    expect(recommendation.whatToAvoidToday).toContain("hard efforts");
    expect(recommendation.sourcesUsed).toEqual([]);
    expect(recommendation.sourcesIgnored).toContain(
      "training load unavailable",
    );
    expect(recommendation.checkInQuestion).toMatch(/feel today/i);
  });
});
