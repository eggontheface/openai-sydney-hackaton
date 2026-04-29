import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ArrowRight,
  MoreHorizontal,
  RefreshCw,
  Sparkles,
} from "lucide-react-native";

import { formatNumber } from "../core/formatters";
import { resolveOnboardingEvent } from "../core/onboarding";
import type {
  OnboardingStep,
  OnboardingStepId,
  OnboardingSuggestion,
} from "../core/types";
import type { PipelineSnapshot } from "../health/types";
import {
  buildLocalGoalCoachReply,
  buildLocalOnboardingSummary,
  goalNeedsEventLookup,
  type GoalCoachMessage,
  type GoalCoachResponse,
  type OnboardingAnswers,
} from "../onboarding/goalCoach";
import { goalFreeTextPrompt, goalQuestion } from "../onboarding/goalOptions";
import { getOnboardingQuickReplies } from "../onboarding/quickReplies";
import { styles } from "../styles/appStyles";
import { tokens } from "../theme/tokens";
import {
  AppButton,
  CoachAvatar,
  CoachLine,
  DataCard,
  SmallMetric,
  UserBubble,
} from "../ui/primitives";

export function CoachOnboardingScreen({
  busy,
  canSync,
  onDiscussGoal,
  onComplete,
  onSummarizeOnboarding,
  onSync,
  sourceLabel,
  status,
  snapshot,
}: {
  busy: boolean;
  canSync: boolean;
  onDiscussGoal: (request: {
    conversation: GoalCoachMessage[];
    previousResponseId?: string | null;
    userMessage: string;
  }) => Promise<GoalCoachResponse>;
  onComplete: (goal: string) => void;
  onSummarizeOnboarding: (request: {
    answers: OnboardingAnswers;
    conversation: GoalCoachMessage[];
  }) => Promise<GoalCoachResponse>;
  onSync: () => void;
  sourceLabel: string;
  status: string;
  snapshot: PipelineSnapshot;
}) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [composerDraft, setComposerDraft] = useState("");
  const [goalText, setGoalText] = useState("");
  const [goalCoachBusy, setGoalCoachBusy] = useState(false);
  const [goalCoachMessages, setGoalCoachMessages] = useState<
    GoalCoachMessage[]
  >([]);
  const [goalCoachResponseId, setGoalCoachResponseId] = useState<string | null>(
    null,
  );
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [answers, setAnswers] = useState<Record<OnboardingStepId, string>>({
    data: "",
    analysis: "",
    goal: "",
    event: "",
    constraints: "",
    summary: "",
  });
  const athleteName: string | undefined = undefined;
  const welcomeLine = athleteName
    ? `Hello ${athleteName}, welcome to BioStream.`
    : "Hello, welcome to BioStream.";
  const connectLabel = `Connect ${sourceLabel}`;
  const dataActionLabel = canSync
    ? connectLabel
    : "Continue with demo baseline";
  const eventMatch = resolveOnboardingEvent(goalText);
  const hasSyncedData =
    snapshot.totalSamples > 0 ||
    snapshot.workoutCount > 0 ||
    snapshot.sleepCount > 0 ||
    snapshot.nutritionDays > 0 ||
    snapshot.coverageDays > 0;
  const analysisQuestion = hasSyncedData
    ? "I’ve analysed your connected history. Here’s what I can see so far."
    : "I don’t have wearable history yet, so I’ll start conservatively and treat this as a baseline-first setup.";
  const analysisSubtext = hasSyncedData
    ? `I found ${formatNumber(snapshot.totalSamples)} records, ${formatNumber(snapshot.workoutCount)} workouts, and ${formatNumber(snapshot.sleepCount)} sleep nights. I’ll use this to avoid over-prescribing.`
    : "You can still continue. Once you connect Apple Health or Health Connect, I’ll replace assumptions with real sleep, recovery, and training history.";
  const isEventGoal = goalNeedsEventLookup(goalText) || Boolean(eventMatch);
  const eventQuestion = eventMatch
    ? `I found a likely match: ${eventMatch.name}. Is this the one?`
    : isEventGoal
      ? "I can help find the event instead of making you fill in the details."
      : "Got it. I’ll shape the plan around that outcome rather than forcing it into an event.";
  const eventSubtext = eventMatch
    ? `${eventMatch.date} · ${eventMatch.location} · ${eventMatch.confidence} match from the ${eventMatch.source}.`
    : isEventGoal
      ? "If you know the event name, city, organiser, or rough timing, type it below and I’ll try to resolve the rest."
      : "If that changes later, we can attach an event or target date without restarting your setup.";
  const eventSuggestions: OnboardingSuggestion[] = eventMatch
    ? [
        {
          title: "Yes, that's it",
          helper: eventMatch.source,
          prompt: `Use ${eventMatch.name}, ${eventMatch.date}, at ${eventMatch.location}.`,
        },
        {
          title: "Different event",
          helper: "Keep searching",
          prompt:
            "That is not the right event. Search for another event match before locking the plan.",
        },
        {
          title: "No event",
          helper: "Outcome goal",
          prompt:
            "Do not lock an event yet. Build a general training plan around my goal.",
        },
      ]
    : [];
  const steps: OnboardingStep[] = [
    {
      id: "data",
      question: welcomeLine,
      subtext: `Let’s connect up your data so I can get started. I’ll pull what I can from ${sourceLabel}, look at your recent training, sleep, recovery, and any gaps, then we’ll talk about what you’re working toward.`,
    },
    {
      id: "analysis",
      question: analysisQuestion,
      subtext: analysisSubtext,
    },
    {
      id: "goal",
      question: goalQuestion,
      subtext:
        "What’s the thing you’d like to be ready for, or the change you want to feel first?",
    },
    {
      id: "event",
      question: eventQuestion,
      subtext: eventSubtext,
      suggestions: eventSuggestions,
    },
    {
      id: "constraints",
      question: "Any constraints I should respect from day one?",
      subtext:
        "Injuries, equipment access, schedule, recovery, travel, and preferred training days change the plan more than people expect.",
    },
    {
      id: "summary",
      question: "Here’s what I’ll use to build your plan.",
      subtext:
        summaryText || "I’m summarising your data, goal, and constraints now.",
    },
  ];
  const activeStep = steps[activeStepIndex] ?? steps[0]!;
  const activeAnswer = answers[activeStep.id];
  const canSend = composerDraft.trim().length > 2;
  const isDataStep = activeStep.id === "data";
  const isGoalStep = activeStep.id === "goal";
  const isFinalStep = activeStep.id === "constraints";
  const isSummaryStep = activeStep.id === "summary";
  const completedSteps = steps
    .slice(0, activeStepIndex)
    .filter((step) => Boolean(answers[step.id]));
  const quickReplies = getOnboardingQuickReplies({
    eventGoal: isEventGoal,
    sourceLabel,
    stepId: activeStep.id,
  });

  function continueFromGoal() {
    if (!goalText.trim()) return;
    setActiveStepIndex((index) => Math.min(index + 1, steps.length - 1));
  }

  async function discussGoal(nextValue: string) {
    const userMessage: GoalCoachMessage = { role: "user", text: nextValue };
    const requestConversation = [...goalCoachMessages, userMessage];

    setGoalText(nextValue);
    setAnswers((current) => ({
      ...current,
      goal: nextValue,
    }));
    setGoalCoachMessages(requestConversation);
    setGoalCoachBusy(true);

    try {
      const response = await onDiscussGoal({
        conversation: requestConversation,
        previousResponseId: goalCoachResponseId,
        userMessage: nextValue,
      });
      setGoalCoachResponseId(response.responseId);
      setGoalCoachMessages((messages) => [
        ...messages,
        { role: "assistant", text: response.text },
      ]);
    } catch {
      setGoalCoachMessages((messages) => [
        ...messages,
        {
          role: "assistant",
          text: `${buildLocalGoalCoachReply(nextValue)}\n\nI could not reach the AI coach just then, so I kept this in demo mode.`,
        },
      ]);
    } finally {
      setGoalCoachBusy(false);
    }
  }

  async function summarizeOnboarding(nextConstraints: string) {
    const nextAnswers = {
      ...answers,
      constraints: nextConstraints,
    };

    setSummaryBusy(true);
    setSummaryText("");
    setActiveStepIndex((index) => Math.min(index + 1, steps.length - 1));

    try {
      const response = await onSummarizeOnboarding({
        answers: nextAnswers,
        conversation: goalCoachMessages,
      });
      setSummaryText(response.text);
      setAnswers((current) => ({
        ...current,
        summary: response.text,
      }));
    } catch {
      const text = buildLocalOnboardingSummary({
        answers: nextAnswers,
        dataSummary: {
          coverageDays: snapshot.coverageDays,
          sleepSessions: snapshot.sleepCount,
          workouts: snapshot.workoutCount,
        },
      });
      setSummaryText(text);
      setAnswers((current) => ({
        ...current,
        summary: text,
      }));
    } finally {
      setSummaryBusy(false);
    }
  }

  function answerStep(value: string) {
    const nextValue = value.trim();
    if (!nextValue) return;

    setAnswers((current) => ({
      ...current,
      [activeStep.id]: nextValue,
    }));
    setComposerDraft("");

    if (activeStep.id === "goal") {
      void discussGoal(nextValue);
      return;
    }

    if (activeStep.id === "data") {
      if (canSync && nextValue.toLowerCase().includes("connect")) {
        onSync();
      }
      setActiveStepIndex((index) => Math.min(index + 1, steps.length - 1));
      return;
    }

    if (activeStep.id === "constraints") {
      void summarizeOnboarding(nextValue);
      return;
    }

    if (activeStep.id === "summary") {
      onComplete(goalText || "Training with recovery-aware adjustments.");
      return;
    }

    setActiveStepIndex((index) => Math.min(index + 1, steps.length - 1));
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
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
            <UserBubble>{answers[step.id] ?? ""}</UserBubble>
          </View>
        ))}

        <CoachLine>{activeStep.question}</CoachLine>
        <DataCard
          accent={tokens.accent}
          inset
          label={activeStep.id === "data" ? "Datasource" : "Coach setup"}
        >
          <Text style={styles.helpText}>{activeStep.subtext}</Text>
          {activeStep.id === "analysis" ? (
            <View style={styles.metricGridFull}>
              <SmallMetric
                label="Records"
                value={formatNumber(snapshot.totalSamples)}
              />
              <SmallMetric
                label="Workouts"
                value={formatNumber(snapshot.workoutCount)}
              />
              <SmallMetric
                label="Sleep"
                value={formatNumber(snapshot.sleepCount)}
              />
              <SmallMetric
                label="Readiness"
                value={snapshot.recommendation.readinessLabel}
              />
            </View>
          ) : null}
          {activeStep.id === "data" ? (
            <View style={styles.singleAction}>
              <AppButton
                disabled={busy}
                icon={RefreshCw}
                label={busy ? status : dataActionLabel}
                onPress={() =>
                  answerStep(
                    canSync
                      ? `Connect ${sourceLabel} now.`
                      : "Continue with a conservative demo baseline until native health data is connected.",
                  )
                }
                variant="primary"
              />
            </View>
          ) : null}
          {activeStep.id === "goal" ? (
            <Text style={styles.setupFreeTextHint}>{goalFreeTextPrompt}</Text>
          ) : null}
          {activeStep.id === "summary" ? (
            <View style={styles.singleAction}>
              <AppButton
                disabled={summaryBusy || !summaryText.trim()}
                icon={Sparkles}
                label={summaryBusy ? "Summarising..." : "Start plan"}
                onPress={() => answerStep(summaryText || "Start plan")}
                variant="primary"
              />
            </View>
          ) : null}
        </DataCard>

        {isGoalStep && goalCoachMessages.length ? (
          <View style={styles.goalCoachThread}>
            {goalCoachMessages.map((message, index) =>
              message.role === "user" ? (
                <UserBubble key={`${message.role}-${index}`}>
                  {message.text}
                </UserBubble>
              ) : (
                <CoachLine key={`${message.role}-${index}`}>
                  {message.text}
                </CoachLine>
              ),
            )}
            {goalCoachBusy ? (
              <CoachLine>Thinking through your goal...</CoachLine>
            ) : null}
            {!goalCoachBusy ? (
              <View style={styles.goalContinueRow}>
                <AppButton
                  disabled={!goalText.trim()}
                  icon={ArrowRight}
                  label="Continue"
                  onPress={continueFromGoal}
                  variant="primary"
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.composer, styles.onboardingComposer]}>
        {quickReplies.length && !isSummaryStep ? (
          <ScrollView
            contentContainerStyle={styles.quickReplyRailContent}
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            style={styles.quickReplyRail}
          >
            {quickReplies.map((reply) => (
              <Pressable
                accessibilityLabel={`Suggested reply: ${reply.label}`}
                accessibilityRole="button"
                disabled={goalCoachBusy}
                key={reply.label}
                onPress={() => answerStep(reply.prompt)}
                style={({ pressed }) => [
                  styles.quickReplyPill,
                  goalCoachBusy && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.quickReplyText}>{reply.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <View style={styles.composerRow}>
          <View style={styles.composerInput}>
            <TextInput
              accessibilityLabel="Message your coach"
              autoCorrect
              cursorColor={tokens.accent}
              editable={!isSummaryStep}
              onChangeText={setComposerDraft}
              onSubmitEditing={() => {
                if (canSend) answerStep(composerDraft);
              }}
              placeholder={
                isSummaryStep
                  ? "Ready when the summary is finished"
                  : isDataStep
                    ? `Connect ${sourceLabel} or skip...`
                    : "Message your coach..."
              }
              placeholderTextColor={tokens.muted}
              returnKeyType="send"
              selectionColor={tokens.accent}
              style={styles.composerTextInput}
              value={composerDraft}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={
              isSummaryStep ||
              goalCoachBusy ||
              (!isDataStep && !isFinalStep && !canSend)
            }
            onPress={() => {
              if (isDataStep && !composerDraft.trim()) {
                answerStep("Skip data connection for now.");
                return;
              }
              if (isFinalStep && !composerDraft.trim()) {
                answerStep("No other constraints for now.");
                return;
              }
              answerStep(composerDraft);
            }}
            style={({ pressed }) => [
              styles.sendButton,
              (isSummaryStep ||
                goalCoachBusy ||
                (!isDataStep && !isFinalStep && !canSend)) &&
                styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <ArrowRight color={tokens.surface} size={18} strokeWidth={2.3} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
