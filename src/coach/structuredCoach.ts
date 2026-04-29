import {
  completeStructuredCoachOutputFixture,
  unknownReadinessStructuredCoachOutputFixture,
} from "./fixtures/structuredCoach.fixtures";
import {
  parseStructuredCoachOutput,
  type StructuredCoachOutput,
} from "./schemas";
import {
  applyConservativeRiskOverride,
  extractRiskFlagsFromCoachRequest,
  type RiskFlagInput,
} from "./riskFlags";

export type StructuredCoachRequest = {
  generated_at: string;
  user_message?: string;
  goal_profile?: unknown;
  event_profile?: unknown;
  health_context?: unknown;
  daily_check_in?: unknown;
  typed_adjustment?: unknown;
  risk_flag_inputs?: readonly RiskFlagInput[];
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
    async generateDailyRecommendation(request) {
      const parsedOutput = parseStructuredCoachOutput(output);
      const riskFlags = extractRiskFlagsFromCoachRequest(request);
      return applyConservativeRiskOverride(parsedOutput, riskFlags);
    },
  };
}

export const mockStructuredCoachOutputs = {
  complete: completeStructuredCoachOutputFixture,
  unknownReadiness: unknownReadinessStructuredCoachOutputFixture,
};
