export type GoalOption = {
  title: string;
  helper: string;
  prompt: string;
};

export const goalQuestion = "What are you hoping BioStream helps you achieve?";

export const goalSubtext =
  "Pick the closest option, or just type it below in your own words. I’ll work out the right path from there.";

export const goalFreeTextPrompt = "Or tell me in your own words...";

export const goalOptions: GoalOption[] = [
  {
    title: "Event",
    helper: "Race or challenge",
    prompt:
      "I am preparing for a specific race, competition, or fitness challenge.",
  },
  {
    title: "Performance",
    helper: "Capability",
    prompt:
      "I want to improve a fitness capability like speed, strength, endurance, or power.",
  },
  {
    title: "Routine",
    helper: "Consistency",
    prompt: "I want to build consistency and make training part of my life.",
  },
  {
    title: "Body",
    helper: "Composition",
    prompt:
      "I want to change my body composition, weight, muscle, or appearance safely.",
  },
  {
    title: "Return",
    helper: "Restart safely",
    prompt:
      "I am coming back after time off, injury, illness, or a major life change.",
  },
  {
    title: "Wellbeing",
    helper: "Energy and recovery",
    prompt:
      "I want more energy, better sleep, less stress, or better recovery.",
  },
  {
    title: "Explore",
    helper: "AI-guided",
    prompt: "I am not sure yet. Help me work out the right goal from my data.",
  },
];
