export type OnboardingQuickReply = {
  label: string;
  prompt: string;
};

export type OnboardingQuickReplyStep =
  | "analysis"
  | "constraints"
  | "data"
  | "event"
  | "goal"
  | "summary";

export function getOnboardingQuickReplies({
  eventGoal,
  sourceLabel,
  stepId,
}: {
  eventGoal?: boolean;
  sourceLabel: string;
  stepId: OnboardingQuickReplyStep;
}): OnboardingQuickReply[] {
  if (stepId === "data") {
    return [
      {
        label: "Connect data",
        prompt: `Connect ${sourceLabel} and analyse my wearable and workout history first.`,
      },
      {
        label: "Skip for now",
        prompt:
          "Skip data connection for now. Start with safe assumptions and ask me later.",
      },
    ];
  }

  if (stepId === "analysis") {
    return [
      {
        label: "Looks right",
        prompt: "That looks right. Use this analysis as the starting point.",
      },
      {
        label: "Keep it safe",
        prompt:
          "Be conservative until you have more reliable training history.",
      },
    ];
  }

  if (stepId === "goal") {
    return [
      {
        label: "Marathon",
        prompt: "I am looking to do a marathon.",
      },
      {
        label: "HYROX",
        prompt: "I am looking to do HYROX.",
      },
      {
        label: "Get consistent",
        prompt:
          "I want to build consistency and make training part of my life.",
      },
      {
        label: "Not sure yet",
        prompt:
          "I am not sure yet. Help me work out the right goal from my data.",
      },
    ];
  }

  if (stepId === "event") {
    return eventGoal
      ? [
          {
            label: "Find it",
            prompt:
              "Keep searching for the event using my goal text and location context.",
          },
          {
            label: "No event yet",
            prompt:
              "There is no event date yet. Build a sustainable plan around my outcome goal.",
          },
        ]
      : [
          {
            label: "That’s right",
            prompt:
              "Build my plan around this outcome without an event date for now.",
          },
          {
            label: "Add later",
            prompt:
              "Start with this outcome and let me add a race, competition, or challenge later.",
          },
        ];
  }

  if (stepId === "constraints") {
    return [
      {
        label: "4 days/week",
        prompt: "I can train 4 days per week.",
      },
      {
        label: "Mornings",
        prompt: "I usually prefer to train before work.",
      },
      {
        label: "Injury concern",
        prompt:
          "I have had some niggles, so keep the first few weeks conservative.",
      },
      {
        label: "No constraints",
        prompt: "No other constraints for now.",
      },
    ];
  }

  return [];
}
