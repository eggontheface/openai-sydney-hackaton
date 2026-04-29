import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowRight, MoreHorizontal, RefreshCw } from 'lucide-react-native';

import { formatNumber } from '../core/formatters';
import { resolveOnboardingEvent } from '../core/onboarding';
import type { OnboardingStep, OnboardingStepId, OnboardingSuggestion } from '../core/types';
import type { PipelineSnapshot } from '../health/types';
import { styles } from '../styles/appStyles';
import { tokens } from '../theme/tokens';
import { AppButton, CoachAvatar, CoachLine, DataCard, SectionLabel, SmallMetric, UserBubble } from '../ui/primitives';

export function CoachOnboardingScreen({
  busy,
  canSync,
  onComplete,
  onSync,
  sourceLabel,
  status,
  snapshot,
}: {
  busy: boolean;
  canSync: boolean;
  onComplete: (goal: string) => void;
  onSync: () => void;
  sourceLabel: string;
  status: string;
  snapshot: PipelineSnapshot;
}) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [composerDraft, setComposerDraft] = useState('');
  const [goalText, setGoalText] = useState('');
  const [answers, setAnswers] = useState<Record<OnboardingStepId, string>>({
    data: '',
    analysis: '',
    goal: '',
    event: '',
    constraints: '',
  });
  const athleteName: string | undefined = undefined;
  const welcomeLine = athleteName
    ? `Hello ${athleteName}, welcome to BioStream.`
    : 'Hello, welcome to BioStream.';
  const connectLabel = `Connect ${sourceLabel}`;
  const eventMatch = resolveOnboardingEvent(goalText);
  const hasSyncedData =
    snapshot.totalSamples > 0 ||
    snapshot.workoutCount > 0 ||
    snapshot.sleepCount > 0 ||
    snapshot.nutritionDays > 0 ||
    snapshot.coverageDays > 0;
  const analysisQuestion = hasSyncedData
    ? 'I’ve analysed your connected history. Here’s what I can see so far.'
    : 'I don’t have wearable history yet, so I’ll start conservatively and treat this as a baseline-first setup.';
  const analysisSubtext = hasSyncedData
    ? `I found ${formatNumber(snapshot.totalSamples)} records, ${formatNumber(snapshot.workoutCount)} workouts, and ${formatNumber(snapshot.sleepCount)} sleep nights. I’ll use this to avoid over-prescribing.`
    : 'You can still continue. Once you connect Apple Health or Health Connect, I’ll replace assumptions with real sleep, recovery, and training history.';
  const eventQuestion = eventMatch
    ? `I found a likely match: ${eventMatch.name}. Is this the one?`
    : 'I could not confidently match an event yet. I can keep searching while we start with a safe first block.';
  const eventSubtext = eventMatch
    ? `${eventMatch.date} · ${eventMatch.location} · ${eventMatch.confidence} match from the ${eventMatch.source}.`
    : 'If you name the city or organiser, I will try to resolve the event automatically instead of making you fill in the details.';
  const eventSuggestions: OnboardingSuggestion[] = eventMatch
    ? [
        {
          title: "Yes, that's it",
          helper: eventMatch.source,
          prompt: `Use ${eventMatch.name}, ${eventMatch.date}, at ${eventMatch.location}.`,
        },
        {
          title: 'Different event',
          helper: 'Keep searching',
          prompt: 'That is not the right event. Search for another event match before locking the plan.',
        },
        {
          title: 'No event',
          helper: 'Outcome goal',
          prompt: 'Do not lock an event yet. Build a general training plan around my goal.',
        },
      ]
    : [
        {
          title: 'Keep searching',
          helper: 'AI lookup',
          prompt: 'Keep searching for the event using my goal text and location context.',
        },
        {
          title: 'No event',
          helper: 'Outcome goal',
          prompt: 'There is no event. Build a sustainable plan around my outcome goal.',
        },
      ];
  const steps: OnboardingStep[] = [
    {
      id: 'data',
      question: welcomeLine,
      subtext: `Let’s connect up your data so I can get started. I’ll pull what I can from ${sourceLabel}, look at your recent training, sleep, recovery, and any gaps, then we’ll talk about what you’re working toward.`,
      suggestions: [
        {
          title: connectLabel,
          helper: sourceLabel,
          prompt: `Connect ${sourceLabel} and analyse my wearable and workout history first.`,
        },
        {
          title: 'Skip for now',
          helper: 'Manual start',
          prompt: 'Skip data connection for now. Start with safe assumptions and ask me later.',
        },
      ],
    },
    {
      id: 'analysis',
      question: analysisQuestion,
      subtext: analysisSubtext,
      suggestions: [
        {
          title: 'Looks right',
          helper: 'Continue',
          prompt: 'That looks right. Use this analysis as the starting point.',
        },
        {
          title: 'Be conservative',
          helper: 'Safety first',
          prompt: 'Be conservative until you have more reliable training history.',
        },
      ],
    },
    {
      id: 'goal',
      question: 'Now, what event or outcome are we training for?',
      subtext: 'You can answer naturally. I’ll resolve events myself where I can, then ask only for the details I cannot infer.',
      suggestions: [
        {
          title: 'HYROX',
          helper: 'Event goal',
          prompt: 'I am training for HYROX and want to finish under 90 minutes.',
        },
        {
          title: 'Run event',
          helper: 'Race goal',
          prompt: 'I am training for a half marathon and want to finish under 2 hours.',
        },
        {
          title: 'Strength',
          helper: 'Training goal',
          prompt: 'I want to build strength and train 4 days a week.',
        },
      ],
    },
    {
      id: 'event',
      question: eventQuestion,
      subtext: eventSubtext,
      suggestions: eventSuggestions,
    },
    {
      id: 'constraints',
      question: 'Any constraints I should respect from day one?',
      subtext: 'Injuries, equipment access, schedule, recovery, travel, and preferred training days change the plan more than people expect.',
      suggestions: [
        {
          title: 'Equipment',
          helper: 'HYROX readiness',
          prompt: 'I have gym access but not always sleds or ski erg.',
        },
        {
          title: 'Schedule',
          helper: 'Availability',
          prompt: 'I can train 4 days per week, usually before work.',
        },
        {
          title: 'Injury risk',
          helper: 'Guardrail',
          prompt: 'I have had some niggles, so keep the first few weeks conservative.',
        },
      ],
    },
  ];
  const activeStep = steps[activeStepIndex] ?? steps[0]!;
  const activeAnswer = answers[activeStep.id];
  const canSend = composerDraft.trim().length > 2;
  const isDataStep = activeStep.id === 'data';
  const isFinalStep = activeStep.id === 'constraints';
  const completedSteps = steps.slice(0, activeStepIndex).filter((step) => Boolean(answers[step.id]));

  function answerStep(value: string) {
    const nextValue = value.trim();
    if (!nextValue) return;

    setAnswers((current) => ({
      ...current,
      [activeStep.id]: nextValue,
    }));
    setComposerDraft('');

    if (activeStep.id === 'goal') {
      setGoalText(nextValue);
    }

    if (activeStep.id === 'data') {
      if (nextValue.toLowerCase().includes('connect')) {
        onSync();
      }
      setActiveStepIndex((index) => Math.min(index + 1, steps.length - 1));
      return;
    }

    if (activeStep.id === 'constraints') {
      onComplete(goalText || 'Training with recovery-aware adjustments.');
      return;
    }

    setActiveStepIndex((index) => Math.min(index + 1, steps.length - 1));
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <CoachAvatar size={32} />
          <View>
            <Text style={styles.topTitle}>Coach</Text>
            <Text style={styles.topMeta}>Connect. Analyse. Plan.</Text>
          </View>
        </View>
        <MoreHorizontal color={tokens.muted} size={22} strokeWidth={2} />
      </View>

      <ScrollView
        contentContainerStyle={styles.feed}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.dateDivider}>Setup</Text>
        <View style={styles.onboardingProgress}>
          {steps.map((step, index) => (
            <View
              key={step.id}
              style={[
                styles.onboardingProgressDot,
                index <= activeStepIndex && styles.onboardingProgressDotActive,
              ]}
            />
          ))}
        </View>

        {completedSteps.map((step) => (
          <View key={step.id} style={styles.onboardingThreadBlock}>
            <CoachLine>{step.question}</CoachLine>
            <UserBubble>{answers[step.id] ?? ''}</UserBubble>
          </View>
        ))}

        <CoachLine>{activeStep.question}</CoachLine>
        <DataCard accent={tokens.ink} inset label={activeStep.id === 'data' ? 'Datasource' : 'Coach setup'}>
          <Text style={styles.helpText}>{activeStep.subtext}</Text>
          {activeStep.id === 'analysis' ? (
            <View style={styles.metricGridFull}>
              <SmallMetric label="Records" value={formatNumber(snapshot.totalSamples)} />
              <SmallMetric label="Workouts" value={formatNumber(snapshot.workoutCount)} />
              <SmallMetric label="Sleep" value={formatNumber(snapshot.sleepCount)} />
              <SmallMetric label="Readiness" value={snapshot.recommendation.readinessLabel} />
            </View>
          ) : null}
          {activeStep.id === 'data' ? (
            <View style={styles.singleAction}>
              <AppButton
                disabled={!canSync || busy}
                icon={RefreshCw}
                label={busy ? status : connectLabel}
                onPress={() => answerStep(`Connect ${sourceLabel} now.`)}
                variant="primary"
              />
            </View>
          ) : null}
        </DataCard>

        {!activeAnswer ? (
          <View style={styles.suggestedReplyWrap}>
            <SectionLabel>Suggested replies</SectionLabel>
            <View style={styles.setupCardGrid}>
              {activeStep.suggestions.map((suggestion) => (
                <Pressable
                  accessibilityRole="button"
                  key={suggestion.title}
                  onPress={() => answerStep(suggestion.prompt)}
                  style={({ pressed }) => [styles.setupOptionCard, pressed && styles.pressed]}
                >
                  <Text style={styles.setupOptionTitle}>{suggestion.title}</Text>
                  <Text style={styles.setupOptionHelper}>{suggestion.helper}</Text>
                  <Text style={styles.setupOptionText}>{suggestion.prompt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.composer}>
        <View style={styles.composerInput}>
          <TextInput
            accessibilityLabel="Message your coach"
            autoCorrect
            cursorColor={tokens.ink}
            onChangeText={setComposerDraft}
            onSubmitEditing={() => {
              if (canSend) answerStep(composerDraft);
            }}
            placeholder={isDataStep ? `Connect ${sourceLabel} or skip...` : 'Message your coach...'}
            placeholderTextColor={tokens.muted}
            returnKeyType="send"
            selectionColor={tokens.ink}
            style={styles.composerTextInput}
            value={composerDraft}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={!isDataStep && !isFinalStep && !canSend}
          onPress={() => {
            if (isDataStep && !composerDraft.trim()) {
              answerStep('Skip data connection for now.');
              return;
            }
            if (isFinalStep && !composerDraft.trim()) {
              answerStep('No other constraints for now.');
              return;
            }
            answerStep(composerDraft);
          }}
          style={({ pressed }) => [
            styles.sendButton,
            !isDataStep && !isFinalStep && !canSend && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <ArrowRight color={tokens.surface} size={18} strokeWidth={2.3} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
