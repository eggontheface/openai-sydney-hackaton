import { getOnboardingQuickReplies } from "./quickReplies";

describe("onboarding quick replies", () => {
  it("keeps goal suggestions compact enough for pill UI", () => {
    const replies = getOnboardingQuickReplies({
      sourceLabel: "Apple Health",
      stepId: "goal",
    });

    expect(replies.map((reply) => reply.label)).toEqual([
      "Marathon",
      "HYROX",
      "Get consistent",
      "Not sure yet",
    ]);
    expect(replies.every((reply) => reply.label.length <= 16)).toBe(true);
  });

  it("does not show quick replies on the summary step", () => {
    expect(
      getOnboardingQuickReplies({
        sourceLabel: "Apple Health",
        stepId: "summary",
      }),
    ).toEqual([]);
  });
});
