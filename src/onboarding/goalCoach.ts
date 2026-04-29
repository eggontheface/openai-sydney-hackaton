import type { PipelineSnapshot } from "../health/types";

const responsesUrl = "https://api.openai.com/v1/responses";
const onboardingGoalModel = "gpt-5.5";

type OpenAiResponseJson = {
  id?: unknown;
  output?: unknown;
  output_text?: unknown;
  error?: unknown;
};

export type GoalCoachMessage = {
  role: "assistant" | "user";
  text: string;
};

export type GoalCoachResponse = {
  responseId: string | null;
  text: string;
};

export type OnboardingAnswers = {
  analysis?: string;
  constraints?: string;
  data?: string;
  event?: string;
  goal?: string;
};

export type OnboardingDataSummary = {
  coverageDays: number;
  sleepSessions: number;
  workouts: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessageFromJson(json: OpenAiResponseJson): string | null {
  if (!isRecord(json.error)) {
    return null;
  }

  const message = json.error.message;
  return typeof message === "string" ? message : null;
}

function extractTextFromOutput(output: unknown): string | null {
  if (!Array.isArray(output)) {
    return null;
  }

  const chunks: string[] = [];

  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (isRecord(content) && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }

  const text = chunks.join("\n").trim();
  return text || null;
}

export function goalNeedsEventLookup(goalText: string): boolean {
  const text = goalText.toLowerCase();
  return [
    "event",
    "race",
    "competition",
    "challenge",
    "hyrox",
    "marathon",
    "triathlon",
    "run",
  ].some((keyword) => text.includes(keyword));
}

export function buildLocalGoalCoachReply(goalText: string): string {
  if (goalNeedsEventLookup(goalText)) {
    return [
      "Nice, that gives us a clear target. I’ll look for likely events rather than making you enter every detail manually.",
      "The useful next thing is the outcome: are you trying to finish comfortably, compete, or hit a specific time?",
    ].join("\n\n");
  }

  return [
    "Got it. I’ll treat this as an outcome-led plan, not force it into a race calendar.",
    "The useful next thing is what “better” should feel like in daily life: more energy, better sleep, body composition, strength, or consistency?",
  ].join("\n\n");
}

export function buildLocalOnboardingSummary({
  answers,
  dataSummary,
}: {
  answers: OnboardingAnswers;
  dataSummary: OnboardingDataSummary;
}): string {
  const goal =
    answers.goal?.trim() || "a safer, more personalised training goal";
  const constraints = answers.constraints?.trim() || "no major constraints yet";
  const event = answers.event?.trim();
  const dataLine =
    dataSummary.coverageDays > 0 ||
    dataSummary.workouts > 0 ||
    dataSummary.sleepSessions > 0
      ? `I’ve got ${dataSummary.coverageDays} days of coverage, ${dataSummary.workouts} workouts, and ${dataSummary.sleepSessions} sleep sessions to work from.`
      : "I do not have much connected data yet, so I’ll start conservatively and treat the first block as baseline-building.";

  return [
    `Here’s what I’ve understood: you’re working toward ${goal}${event ? `, with ${event}` : ""}.`,
    `${dataLine} I’ll also respect this from day one: ${constraints}.`,
    "I’ll start building a custom plan from your connected data, your goal, and the input you’ve shared, with conservative progression until the baseline is clear.",
  ].join("\n\n");
}

function buildSnapshotSummary(snapshot: PipelineSnapshot) {
  return {
    samples: snapshot.totalSamples,
    workouts: snapshot.workoutCount,
    sleepSessions: snapshot.sleepCount,
    nutritionDays: snapshot.nutritionDays,
    coverageDays: snapshot.coverageDays,
    readiness: snapshot.recommendation.readinessLabel,
    recentWorkouts: snapshot.recentWorkouts.slice(0, 5).map((workout) => ({
      name: workout.name ?? workout.activityType ?? "Workout",
      sport: workout.sportBucket,
      distanceKm: workout.distanceKm,
      avgHrBpm: workout.avgHrBpm,
      startAt: workout.startAt,
    })),
  };
}

function buildGoalCoachInput({
  conversation,
  snapshot,
  userMessage,
}: {
  conversation: GoalCoachMessage[];
  snapshot: PipelineSnapshot;
  userMessage: string;
}): string {
  const recentConversation = conversation.slice(-8);

  return [
    "Connected data summary:",
    JSON.stringify(buildSnapshotSummary(snapshot), null, 2),
    "",
    "Recent onboarding conversation:",
    recentConversation.length
      ? recentConversation
          .map((turn) => `${turn.role}: ${turn.text}`)
          .join("\n")
      : "No previous onboarding conversation.",
    "",
    `Latest user answer: ${userMessage}`,
    "",
    "Reply as the onboarding coach. Infer the goal branch, explain what you understood, and ask exactly one next question.",
  ].join("\n");
}

const onboardingGoalInstructions = [
  "You are BioStream, an AI-native onboarding coach for a privacy-first fitness app.",
  "Your job is to discuss the user’s goal naturally while quietly forming a structured goal profile.",
  "Do not make the user do data entry if the app can infer or look something up later.",
  "If the user mentions an event, say you can look up likely event details and ask for the smallest useful confirmation or target outcome.",
  "If the user describes a non-event goal, keep them on an outcome path and ask one practical follow-up.",
  "Be warm, concise, and specific. Use 2-4 short sentences. Ask exactly one question.",
  "Do not diagnose, prescribe treatment, or encourage aggressive training. If risk, injury, illness, or long layoff appears, bias toward baseline testing and conservative progression.",
].join("\n");

const onboardingSummaryInstructions = [
  "You are BioStream, an AI-native onboarding coach for a privacy-first fitness app.",
  "Summarise what the user has shared during onboarding and confirm that the app will build a custom plan from connected data plus their stated goal and constraints.",
  "Be concise, human, and confidence-aware. Do not overstate missing data.",
  "Mention safety or baseline testing when training history is thin, stale, or the user is returning from time off.",
  "Use 3 short paragraphs maximum. Do not ask another question.",
].join("\n");

export async function sendOnboardingGoalMessage({
  apiKey,
  conversation,
  previousResponseId,
  snapshot,
  userMessage,
}: {
  apiKey: string;
  conversation: GoalCoachMessage[];
  previousResponseId?: string | null;
  snapshot: PipelineSnapshot;
  userMessage: string;
}): Promise<GoalCoachResponse> {
  const payload: Record<string, unknown> = {
    model: onboardingGoalModel,
    instructions: onboardingGoalInstructions,
    input: buildGoalCoachInput({ conversation, snapshot, userMessage }),
    max_output_tokens: 700,
    reasoning: { effort: "medium" },
    truncation: "auto",
  };

  if (previousResponseId) {
    payload.previous_response_id = previousResponseId;
  }

  const response = await fetch(responsesUrl, {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const json = (await response.json()) as OpenAiResponseJson;

  if (!response.ok) {
    throw new Error(
      errorMessageFromJson(json) ??
        `OpenAI request failed with ${response.status}`,
    );
  }

  const text =
    (typeof json.output_text === "string" ? json.output_text.trim() : null) ??
    extractTextFromOutput(json.output);

  if (!text) {
    throw new Error("OpenAI returned an empty onboarding response.");
  }

  return {
    responseId: typeof json.id === "string" ? json.id : null,
    text,
  };
}

export async function sendOnboardingSummaryMessage({
  apiKey,
  answers,
  conversation,
  snapshot,
}: {
  apiKey: string;
  answers: OnboardingAnswers;
  conversation: GoalCoachMessage[];
  snapshot: PipelineSnapshot;
}): Promise<GoalCoachResponse> {
  const payload: Record<string, unknown> = {
    model: onboardingGoalModel,
    instructions: onboardingSummaryInstructions,
    input: [
      "Connected data summary:",
      JSON.stringify(buildSnapshotSummary(snapshot), null, 2),
      "",
      "Onboarding answers:",
      JSON.stringify(answers, null, 2),
      "",
      "Goal conversation:",
      conversation.length
        ? conversation.map((turn) => `${turn.role}: ${turn.text}`).join("\n")
        : "No goal conversation captured.",
    ].join("\n"),
    max_output_tokens: 700,
    reasoning: { effort: "medium" },
    truncation: "auto",
  };

  const response = await fetch(responsesUrl, {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const json = (await response.json()) as OpenAiResponseJson;

  if (!response.ok) {
    throw new Error(
      errorMessageFromJson(json) ??
        `OpenAI request failed with ${response.status}`,
    );
  }

  const text =
    (typeof json.output_text === "string" ? json.output_text.trim() : null) ??
    extractTextFromOutput(json.output);

  if (!text) {
    throw new Error("OpenAI returned an empty onboarding summary.");
  }

  return {
    responseId: typeof json.id === "string" ? json.id : null,
    text,
  };
}
