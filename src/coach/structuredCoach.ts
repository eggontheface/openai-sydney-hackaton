import {
  completeStructuredCoachOutputFixture,
  unknownReadinessStructuredCoachOutputFixture,
} from './fixtures/structuredCoach.fixtures';
import {
  parseStructuredCoachOutput,
  type StructuredCoachOutput,
} from './schemas';

export type StructuredCoachRequest = {
  generated_at: string;
  user_message?: string;
  goal_profile?: unknown;
  event_profile?: unknown;
  health_context?: unknown;
};

export type StructuredCoachService = {
  generateDailyRecommendation(
    request: StructuredCoachRequest,
  ): Promise<StructuredCoachOutput>;
};

export type MockStructuredCoachServiceOptions = {
  output?: unknown;
};

export function createMockStructuredCoachService(
  options: MockStructuredCoachServiceOptions = {},
): StructuredCoachService {
  const output = options.output ?? completeStructuredCoachOutputFixture;

  return {
    async generateDailyRecommendation(_request) {
      return parseStructuredCoachOutput(output);
    },
  };
}

export const mockStructuredCoachOutputs = {
  complete: completeStructuredCoachOutputFixture,
  unknownReadiness: unknownReadinessStructuredCoachOutputFixture,
};
