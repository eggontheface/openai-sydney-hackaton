import type { PipelineSnapshot } from '../health/types';
import { formatDuration } from '../lib/dates';
import type { CoachHealthContext } from '../storage/trainingStore';

export const openAiCoachModel = 'gpt-5.5';

export type OpenAiCoachConversationMessage = {
  role: 'assistant' | 'user';
  text: string;
};

export type OpenAiCoachResponse = {
  responseId: string | null;
  text: string;
};

type OpenAiResponseJson = {
  id?: unknown;
  output?: unknown;
  output_text?: unknown;
  error?: unknown;
};

const responsesUrl = 'https://api.openai.com/v1/responses';

// OpenAI's JS SDK does not currently support React Native, so this wrapper calls
// the same Responses API directly from the Expo app.
const coachInstructions = [
  'You are BioStream, a practical health and fitness coach inside a private mobile app.',
  'Use only the supplied local health summary and conversation. Do not pretend to see data that is absent.',
  'The SQLite table inventory is authoritative for whether synced health data exists. If it says synced rows exist, never say no health data is synced.',
  'Give concise coaching guidance for today. Keep replies to 2-5 short sentences and ask at most one follow-up question.',
  'Be conservative with pain, injury, illness, fever, chest pain, fainting, unusual shortness of breath, or severe fatigue. In those cases lower intensity and suggest professional care when symptoms are serious, sharp, worsening, chest-related, or unusual.',
  'Do not diagnose, prescribe treatment, or make emergency claims. Separate what the data supports from what remains uncertain.',
  'When data is stale or missing, say so plainly and use a safer recommendation.',
].join('\n');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessageFromJson(json: OpenAiResponseJson): string | null {
  if (!isRecord(json.error)) {
    return null;
  }

  const message = json.error.message;
  return typeof message === 'string' ? message : null;
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
      if (!isRecord(content)) {
        continue;
      }

      if (typeof content.text === 'string') {
        chunks.push(content.text);
      }
    }
  }

  const text = chunks.join('\n').trim();
  return text || null;
}

function safeDate(value?: string): string | undefined {
  return value ? value.slice(0, 10) : undefined;
}

function buildCoachContext(snapshot: PipelineSnapshot, healthContext: CoachHealthContext) {
  return {
    generatedAt: new Date().toISOString(),
    dataAvailability: {
      hasSyncedHealthData: healthContext.hasSyncedHealthData,
      instruction: healthContext.coachDataInstruction,
      sqliteTables: healthContext.sqliteTables,
    },
    totals: {
      samples: snapshot.totalSamples,
      workouts: snapshot.workoutCount,
      sleepSessions: snapshot.sleepCount,
      nutritionDays: snapshot.nutritionDays,
      coverageDays: snapshot.coverageDays,
    },
    currentRecommendation: snapshot.recommendation,
    sourceFreshness: snapshot.sourceFreshness.map((source) => ({
      domain: source.domain,
      label: source.label,
      state: source.state,
      latestLocalDate: source.latestLocalDate,
      lastUpdatedAt: source.lastUpdatedAt,
      ageDays: source.ageDays,
      limitations: source.limitations,
    })),
    today: snapshot.today
      ? {
          date: snapshot.today.date,
          wellnessDataStatus: snapshot.today.wellnessDataStatus,
          sleep: snapshot.today.sleepSeconds
            ? formatDuration(snapshot.today.sleepSeconds)
            : null,
          hrvMs: snapshot.today.hrvLastNightAvg,
          hrvMethod: snapshot.today.hrvMethod,
          hrvSourceApp: snapshot.today.hrvSourceApp,
          restingHr: snapshot.today.restingHr,
          steps: snapshot.today.steps,
          activeKcal: snapshot.today.activeKcal,
          workoutCount: snapshot.today.workoutCount,
          activityElapsedSeconds: snapshot.today.activityElapsedSeconds,
        }
      : null,
    recentDays: snapshot.history.slice(0, 7).map((day) => ({
      date: day.date,
      wellnessDataStatus: day.wellnessDataStatus,
      sleep: day.sleepSeconds ? formatDuration(day.sleepSeconds) : null,
      hrvMs: day.hrvLastNightAvg,
      hrvMethod: day.hrvMethod,
      hrvSourceApp: day.hrvSourceApp,
      restingHr: day.restingHr,
      steps: day.steps,
      workoutCount: day.workoutCount,
      activityElapsedSeconds: day.activityElapsedSeconds,
    })),
    recentWorkouts: snapshot.recentWorkouts.slice(0, 5).map((workout) => ({
      date: safeDate(workout.startAt),
      name: workout.name ?? workout.activityType ?? 'Workout',
      sport: workout.sportBucket,
      duration: formatDuration(workout.elapsedSeconds),
      distanceKm: workout.distanceKm,
      avgHrBpm: workout.avgHrBpm,
    })),
    metricAvailability: snapshot.metricAvailability.map((metric) => ({
      type: metric.canonicalType,
      samples: metric.sampleCount,
      days: metric.dayCount,
      latestDate: metric.latestDate,
    })),
    sqliteDerivedContext: {
      generatedAt: healthContext.generatedAt,
      metricAvailability: healthContext.metricAvailability,
      sourceFreshness: healthContext.sourceFreshness.map((source) => ({
        domain: source.domain,
        label: source.label,
        state: source.state,
        latestLocalDate: source.latestLocalDate,
        lastUpdatedAt: source.lastUpdatedAt,
        ageDays: source.ageDays,
        limitations: source.limitations,
      })),
      latestSamplesByType: healthContext.latestSamplesByType,
      recentDailyMetrics: healthContext.recentDailyMetrics.map((day) => ({
        date: day.date,
        wellnessDataStatus: day.wellnessDataStatus,
        sourceCount: day.sourceCount,
        sleep: day.sleepSeconds ? formatDuration(day.sleepSeconds) : null,
        hrvMs: day.hrvLastNightAvg,
        hrvMethod: day.hrvMethod,
        hrvSourceApp: day.hrvSourceApp,
        restingHr: day.restingHr,
        heartRateAvgBpm: day.heartRateAvgBpm,
        steps: day.steps,
        activeKcal: day.activeKcal,
        workoutCount: day.workoutCount,
        runWorkoutCount: day.runWorkoutCount,
        rideWorkoutCount: day.rideWorkoutCount,
        strengthWorkoutCount: day.strengthWorkoutCount,
        activityElapsedSeconds: day.activityElapsedSeconds,
        activityKcal: day.activityKcal,
        weightKg: day.weightKg,
        vo2max: day.vo2max,
      })),
      recentWorkouts: healthContext.recentWorkouts.map((workout) => ({
        date: workout.localDate,
        name: workout.name ?? workout.activityType ?? 'Workout',
        sport: workout.sportBucket,
        duration: formatDuration(workout.elapsedSeconds),
        distanceKm: workout.distanceKm,
        activeKcal: workout.activeKcal,
        avgHrBpm: workout.avgHrBpm,
        sourceApp: workout.sourceApp,
      })),
    },
  };
}

function buildCoachInput({
  conversation,
  healthContext,
  snapshot,
  userMessage,
}: {
  conversation: OpenAiCoachConversationMessage[];
  healthContext: CoachHealthContext;
  snapshot: PipelineSnapshot;
  userMessage: string;
}): string {
  const recentConversation = conversation.slice(-8);

  return [
    'Local health summary:',
    JSON.stringify(buildCoachContext(snapshot, healthContext), null, 2),
    '',
    'Recent conversation:',
    recentConversation.length
      ? recentConversation.map((turn) => `${turn.role}: ${turn.text}`).join('\n')
      : 'No previous coach conversation in this session.',
    '',
    `Latest user message: ${userMessage}`,
  ].join('\n');
}

export async function sendCoachMessage({
  apiKey,
  conversation,
  healthContext,
  previousResponseId,
  snapshot,
  userMessage,
}: {
  apiKey: string;
  conversation: OpenAiCoachConversationMessage[];
  healthContext: CoachHealthContext;
  previousResponseId?: string | null;
  snapshot: PipelineSnapshot;
  userMessage: string;
}): Promise<OpenAiCoachResponse> {
  const payload: Record<string, unknown> = {
    model: openAiCoachModel,
    instructions: coachInstructions,
    input: buildCoachInput({ conversation, healthContext, snapshot, userMessage }),
    max_output_tokens: 1200,
    reasoning: { effort: 'high' },
    truncation: 'auto',
  };

  if (previousResponseId) {
    payload.previous_response_id = previousResponseId;
  }

  const response = await fetch(responsesUrl, {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const json = (await response.json()) as OpenAiResponseJson;

  if (!response.ok) {
    throw new Error(errorMessageFromJson(json) ?? `OpenAI request failed with ${response.status}`);
  }

  const text =
    (typeof json.output_text === 'string' ? json.output_text.trim() : null) ??
    extractTextFromOutput(json.output);

  if (!text) {
    throw new Error('OpenAI returned an empty coach response.');
  }

  return {
    responseId: typeof json.id === 'string' ? json.id : null,
    text,
  };
}
