import {
  buildLocalGoalCoachReply,
  buildLocalOnboardingSummary,
  goalNeedsEventLookup,
} from "./goalCoach";

describe("onboarding goal coach", () => {
  it("asks one useful follow-up for event goals without making the user fill everything in", () => {
    expect(goalNeedsEventLookup("I want to do HYROX this year")).toBe(true);

    expect(buildLocalGoalCoachReply("I want to do HYROX this year")).toContain(
      "I’ll look for likely events",
    );
  });

  it("keeps non-event goals on an outcome path", () => {
    expect(goalNeedsEventLookup("I want more energy and better sleep")).toBe(
      false,
    );

    expect(
      buildLocalGoalCoachReply("I want more energy and better sleep"),
    ).toContain("outcome-led plan");
  });

  it("summarises onboarding inputs and confirms plan creation", () => {
    const summary = buildLocalOnboardingSummary({
      answers: {
        data: "Connected Apple Health.",
        analysis: "Looks right.",
        goal: "Looking to do a marathon.",
        constraints: "I can train four days a week.",
      },
      dataSummary: {
        coverageDays: 60,
        sleepSessions: 42,
        workouts: 18,
      },
    });

    expect(summary).toContain("marathon");
    expect(summary).toContain("four days");
    expect(summary).toContain("custom plan");
  });
});
