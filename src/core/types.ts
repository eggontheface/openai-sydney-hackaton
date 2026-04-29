import type { LucideIcon } from 'lucide-react-native';

import type { CanonicalType } from '../health/types';
import type { getLastSyncRun } from '../storage/trainingStore';

export type LastSync = Awaited<ReturnType<typeof getLastSyncRun>>;
export type Tab = 'coach' | 'workout' | 'history' | 'you';
export type OnboardingStepId = 'data' | 'analysis' | 'goal' | 'event' | 'constraints';

export type OnboardingSuggestion = {
  title: string;
  helper: string;
  prompt: string;
};

export type OnboardingStep = {
  id: OnboardingStepId;
  question: string;
  subtext: string;
  suggestions: OnboardingSuggestion[];
};

export type MetricStatus = 'live' | 'permission' | 'empty' | 'unchecked';

export type CoachConversationMessage = {
  id: string;
  role: 'coach' | 'user';
  text: string;
};

export type AnalyticsMetricConfig = {
  id: string;
  title: string;
  detail: string;
  types: CanonicalType[];
  icon: LucideIcon;
  gap: string;
};
