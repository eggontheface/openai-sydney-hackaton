import { completeStructuredCoachOutputFixture } from "./fixtures/structuredCoach.fixtures";
import {
  applyConservativeRiskOverride,
  extractRiskFlags,
  extractRiskFlagsFromCoachRequest,
} from "./riskFlags";

const generatedAt = "2026-04-29T12:00:00.000Z";

describe("risk flag extraction", () => {
  it.each([
    ["chest pain", "I had chest pain during my run", "chest-pain"],
    ["fainting", "I fainted after intervals yesterday", "fainting"],
    [
      "unusual shortness of breath",
      "I am unusually short of breath on easy stairs",
      "unusual-shortness-of-breath",
    ],
    ["fever", "I have a fever and chills today", "fever"],
    ["significant pain", "My knee has severe sharp pain", "significant-pain"],
    [
      "injury concern",
      "I think I injured my ankle and it is swollen",
      "injury-concern",
    ],
  ])("extracts %s as a blocking risk", (_label, text, expectedId) => {
    const flags = extractRiskFlags([{ source: "daily_check_in", text }], {
      generatedAt,
    });

    expect(flags.items.map((flag) => flag.id)).toContain(expectedId);
    expect(flags.has_blocking_risk).toBe(true);
    expect(["high", "urgent"]).toContain(flags.highest_severity);
  });

  it("collects onboarding, check-in, and typed adjustment text through the request helper", () => {
    const flags = extractRiskFlagsFromCoachRequest({
      generated_at: generatedAt,
      goal_profile: {
        constraints: ["returning from a calf injury"],
      },
      daily_check_in: {
        symptoms: "Feverish this morning",
      },
      typed_adjustment: "Also unusually short of breath walking upstairs",
    });

    expect(flags.items.map((flag) => flag.source)).toEqual(
      expect.arrayContaining([
        "goal_profile",
        "daily_check_in",
        "typed_adjustment",
      ]),
    );
    expect(flags.items.map((flag) => flag.id)).toEqual(
      expect.arrayContaining([
        "injury-concern",
        "fever",
        "unusual-shortness-of-breath",
      ]),
    );
  });

  it("does not flag negated symptom phrases", () => {
    const flags = extractRiskFlags(
      [
        {
          source: "daily_check_in",
          text: "No chest pain, no fever, and not short of breath today.",
        },
      ],
      { generatedAt },
    );

    expect(flags.highest_severity).toBe("none");
    expect(flags.has_blocking_risk).toBe(false);
    expect(flags.items).toHaveLength(1);
    expect(flags.items[0].id).toBe("no-risk-reported");
  });

  it("keeps positive risks after a negated clause", () => {
    const flags = extractRiskFlags(
      [
        {
          source: "daily_check_in",
          text: "No chest pain but I fainted yesterday and have a fever today.",
        },
      ],
      { generatedAt },
    );

    expect(flags.items.map((flag) => flag.id)).toEqual(
      expect.arrayContaining(["fainting", "fever"]),
    );
    expect(flags.items.map((flag) => flag.id)).not.toContain("chest-pain");
    expect(flags.has_blocking_risk).toBe(true);
  });

  it("does not treat generic faint or breathless wording as urgent symptoms", () => {
    const flags = extractRiskFlags(
      [
        {
          source: "daily_check_in",
          text: "I have faint soreness and felt breathless after hard intervals, but nothing unusual.",
        },
      ],
      { generatedAt },
    );

    expect(flags.highest_severity).toBe("none");
    expect(flags.items[0].id).toBe("no-risk-reported");
  });

  it.each([
    "I hurt my knee during a run",
    "I rolled my ankle on the trail",
    "I tweaked my back lifting",
    "I am limping today",
    "I cannot bear weight on my foot",
  ])("extracts common injury wording: %s", (text) => {
    const flags = extractRiskFlags([{ source: "typed_adjustment", text }], {
      generatedAt,
    });

    expect(flags.items.map((flag) => flag.id)).toContain("injury-concern");
    expect(flags.has_blocking_risk).toBe(true);
  });
});

describe("conservative risk override", () => {
  it("forces red recovery guidance and explains the confidence/intensity reduction", () => {
    const flags = extractRiskFlags(
      [
        {
          source: "typed_adjustment",
          text: "I have chest pain and feel faint when I stand up.",
        },
      ],
      { generatedAt },
    );

    const output = applyConservativeRiskOverride(
      completeStructuredCoachOutputFixture,
      flags,
    );

    expect(output.risk_flags.highest_severity).toBe("urgent");
    expect(output.readiness_status.status).toBe("red");
    expect(output.readiness_status.confidence).toBeLessThanOrEqual(0.35);
    expect(output.readiness_status.conservative_adjustment_reason).toMatch(
      /risk flags lowered confidence and intensity/i,
    );
    expect(output.daily_recommendation.risk_flags_applied).toBe(true);
    expect(
      output.daily_recommendation.recommended_activity.intensity_target,
    ).toBe("recovery");
    expect(output.daily_recommendation.short_explanation).toMatch(
      /lowered confidence and intensity/i,
    );
    expect(output.daily_recommendation.short_explanation).toMatch(
      /professional care/i,
    );
  });
});
