import {
  completeStructuredCoachOutputFixture,
  unknownReadinessStructuredCoachOutputFixture,
} from "./fixtures/structuredCoach.fixtures";
import { parseStructuredCoachOutput } from "./schemas";
import { createMockStructuredCoachService } from "./structuredCoach";

describe("structured coach output boundary", () => {
  it("accepts a complete structured coach output fixture", () => {
    const output = parseStructuredCoachOutput(
      completeStructuredCoachOutputFixture,
    );

    expect(output.risk_flags.highest_severity).toBe("none");
    expect(output.readiness_status.status).toBe("yellow");
    expect(output.daily_recommendation.easier_alternative.title).toContain(
      "Walk",
    );
  });

  it("rejects output with missing required risk flags", () => {
    const { risk_flags: _riskFlags, ...missingRiskFlags } =
      completeStructuredCoachOutputFixture;

    expect(() => parseStructuredCoachOutput(missingRiskFlags)).toThrow(
      "risk_flags is required",
    );
  });

  it("rejects risk flag items missing severity", () => {
    const output = {
      ...completeStructuredCoachOutputFixture,
      risk_flags: {
        ...completeStructuredCoachOutputFixture.risk_flags,
        highest_severity: "moderate",
        items: [
          {
            ...completeStructuredCoachOutputFixture.risk_flags.items[0],
            severity: undefined,
          },
        ],
      },
    };

    expect(() => parseStructuredCoachOutput(output)).toThrow(
      "risk_flags.items[0].severity is required",
    );
  });

  it("returns valid mock output without an API key", async () => {
    const service = createMockStructuredCoachService({
      output: unknownReadinessStructuredCoachOutputFixture,
    });

    const output = await service.generateDailyRecommendation({
      generated_at: "2026-04-29T12:00:00.000Z",
      user_message: "What should I do today?",
    });

    expect(output.readiness_status.status).toBe("unknown");
    expect(output.daily_recommendation.confidence).toBeLessThan(0.5);
    expect(output.risk_flags.summary).toContain("No risk flags");
  });

  it("applies conservative risk overrides before returning a recommendation", async () => {
    const service = createMockStructuredCoachService();

    const output = await service.generateDailyRecommendation({
      generated_at: "2026-04-29T12:00:00.000Z",
      user_message: "I have a fever and sharp knee pain today.",
    });

    expect(output.risk_flags.items.map((flag) => flag.id)).toEqual(
      expect.arrayContaining(["fever", "significant-pain"]),
    );
    expect(output.readiness_status.status).toBe("red");
    expect(output.daily_recommendation.risk_flags_applied).toBe(true);
    expect(output.daily_recommendation.short_explanation).toMatch(
      /lowered confidence and intensity/i,
    );
  });
});
