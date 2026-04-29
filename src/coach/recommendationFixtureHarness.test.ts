import {
  loadRecommendationFixtureCases,
  runRecommendationFixture,
  runRecommendationFixtures,
} from "./recommendationFixtureHarness";

const highIntensityPattern =
  /planned intensity|threshold|interval|tempo|race|max/i;

describe("recommendation fixture harness", () => {
  it("loads the required deterministic recommendation fixtures", () => {
    expect(
      loadRecommendationFixtureCases().map((fixture) => fixture.id),
    ).toEqual([
      "no-data",
      "stale-data",
      "poor-sleep",
      "high-readiness",
      "pain-flag",
      "illness-flag",
      "returning-athlete",
      "event-goal",
    ]);
  });

  it("snapshots structured recommendation output for all fixtures", () => {
    expect(runRecommendationFixtures()).toMatchSnapshot();
  });

  it("keeps pain and illness fixtures away from high-intensity plans", () => {
    const outputs = runRecommendationFixtures().filter((output) =>
      ["pain-flag", "illness-flag"].includes(output.fixtureId),
    );

    expect(outputs).not.toHaveLength(0);
    for (const output of outputs) {
      expect(output.riskFlags.hasBlockingRisk).toBe(true);
      expect(output.recommendation.readinessStatus).toBe("red");
      expect(
        output.recommendation.recommendedActivity.intensityTarget,
      ).not.toMatch(highIntensityPattern);
      expect(output.recommendation.whatToAvoidToday).toEqual(
        expect.arrayContaining(["hard intervals", "max efforts"]),
      );
    }
  });

  it("uses conservative guidance when readiness is unknown", () => {
    const output = runRecommendationFixture("no-data");

    expect(output.recommendation.readinessStatus).toBe("unknown");
    expect(output.recommendation.confidence).toBeLessThanOrEqual(0.35);
    expect(output.recommendation.recommendedActivity.intensityTarget).toBe(
      "easy until clearer",
    );
    expect(output.recommendation.sourcesIgnored).toEqual(
      expect.arrayContaining(["Sleep is missing", "HRV is missing"]),
    );
    expect(output.recommendation.nextCheckInQuestion).toMatch(/feel today/i);
  });
});
