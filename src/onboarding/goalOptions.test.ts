import { goalOptions, goalQuestion, goalFreeTextPrompt } from "./goalOptions";

describe("goal onboarding options", () => {
  it("presents MECE goal options with a free-text escape hatch", () => {
    expect(goalQuestion).toBe(
      "What are you hoping BioStream helps you achieve?",
    );
    expect(goalFreeTextPrompt).toBe("Or tell me in your own words...");

    expect(goalOptions.map((option) => option.title)).toEqual([
      "Event",
      "Performance",
      "Routine",
      "Body",
      "Return",
      "Wellbeing",
      "Explore",
    ]);

    expect(goalOptions.map((option) => option.helper)).toEqual([
      "Race or challenge",
      "Capability",
      "Consistency",
      "Composition",
      "Restart safely",
      "Energy and recovery",
      "AI-guided",
    ]);
  });
});
