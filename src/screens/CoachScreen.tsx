import { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Activity,
  ArrowRight,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react-native";

import { generateTrainingPlan, resolveTrainingGoal } from "../coach/planEngine";
import {
  dataAge,
  formatDateKey,
  formatNumber,
  hrvMetricLabel,
  toneColor,
} from "../core/formatters";
import type { CoachConversationMessage, LastSync } from "../core/types";
import type { PipelineSnapshot } from "../health/types";
import { formatDuration as formatDurationFromDates } from "../lib/dates";
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

function coachGoalPhrase(goalText: string): string {
  const goal = goalText.trim().replace(/[.!?]+$/, "");
  const normalized = goal.toLowerCase();

  if (!goal) return "your training goal";
  if (normalized.includes("half marathon")) return "your half marathon goal";
  if (normalized.includes("marathon")) return "your marathon goal";
  if (normalized.includes("hyrox")) return "your HYROX goal";
  if (normalized.includes("strength")) return "your strength goal";
  if (normalized.includes("fitness")) return "your fitness goal";

  return goal;
}

export function CoachScreen({
  coachBusy,
  coachDraft,
  coachMessages,
  goalText,
  hasOpenAiApiKey,
  snapshot,
  lastSync,
  busy,
  status,
  warnings,
  onChangeCoachDraft,
  onSendCoachMessage,
  onSync,
  onOpenWorkout,
}: {
  coachBusy: boolean;
  coachDraft: string;
  coachMessages: CoachConversationMessage[];
  goalText: string;
  hasOpenAiApiKey: boolean;
  snapshot: PipelineSnapshot;
  lastSync: LastSync;
  busy: boolean;
  status: string;
  warnings: string[];
  onChangeCoachDraft: (value: string) => void;
  onSendCoachMessage: (message?: string) => void;
  onSync: () => void;
  onOpenWorkout: () => void;
}) {
  const current = snapshot.today;
  const recommendation = snapshot.recommendation;
  const readinessStatus = recommendation.readinessStatus;
  const accent = toneColor(recommendation.color);
  const plan = useMemo(
    () => generateTrainingPlan(snapshot, resolveTrainingGoal(goalText)),
    [goalText, snapshot],
  );
  const sleep = current?.sleepSeconds
    ? formatDurationFromDates(current.sleepSeconds)
    : "—";
  const hrv = current?.hrvLastNightAvg
    ? `${Math.round(current.hrvLastNightAvg)} ms`
    : "—";
  const hrvLabel = hrvMetricLabel(current);
  const rhr = current?.restingHr ? `${Math.round(current.restingHr)} bpm` : "—";
  const athleteName = "Martin";
  const goalPhrase = coachGoalPhrase(goalText);
  const wearableLabel =
    Platform.OS === "ios"
      ? "Apple Watch"
      : Platform.OS === "android"
        ? "connected wearable"
        : "wearable data";
  const sourceLabel =
    Platform.OS === "ios"
      ? "Apple Health"
      : Platform.OS === "android"
        ? "Health Connect"
        : "web demo data";
  const quickReplies = [
    "Talk me through the week",
    "What should we adjust?",
    "I feel different today",
  ];
  const coachInputDisabled = coachBusy || busy;
  const canSendCoachMessage = !coachBusy && !busy && Boolean(coachDraft.trim());
  const readinessExplanation = [
    readinessStatus.conservativeAdjustmentReason,
    readinessStatus.staleSignalsIgnored.length
      ? `Ignored: ${readinessStatus.staleSignalsIgnored.join(", ")}.`
      : null,
    readinessStatus.missingSignals.length
      ? `Missing: ${readinessStatus.missingSignals.join(", ")}.`
      : null,
  ].filter((line): line is string => Boolean(line));
  const composerPlaceholder = hasOpenAiApiKey
    ? busy
      ? "Sync in progress..."
      : "Ask your coach..."
    : "Ask your coach...";
  const hasSyncedData =
    snapshot.totalSamples > 0 ||
    snapshot.workoutCount > 0 ||
    snapshot.sleepCount > 0 ||
    snapshot.nutritionDays > 0 ||
    snapshot.coverageDays > 0;
  const loadingInitialMetrics = busy && !hasSyncedData;
  const coachGreeting = hasSyncedData
    ? `Good morning ${athleteName}. You are in a good spot to keep building toward ${goalPhrase}. I have checked the recovery picture and lined up today's work. If anything has changed since the data came in, tell me and I will adjust it.`
    : `Good morning ${athleteName}. Let's keep building toward ${goalPhrase}. I do not have enough wearable history yet, so I will keep things sensible and adjust as you give me more context.`;
  const feedRef = useRef<ScrollView | null>(null);

  function scrollFeedToEnd(animated = true) {
    requestAnimationFrame(() => {
      feedRef.current?.scrollToEnd({ animated });
    });
  }

  useEffect(() => {
    if (coachMessages.length || coachBusy) {
      scrollFeedToEnd();
    }
  }, [coachBusy, coachMessages.length]);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <CoachAvatar size={32} />
          <View>
            <Text style={styles.topTitle}>Coach</Text>
            <Text style={styles.topMeta}>
              {formatDateKey(current?.date)} · {dataAge(lastSync)}
            </Text>
          </View>
        </View>
        <MoreHorizontal color={tokens.muted} size={22} strokeWidth={2} />
      </View>

      <ScrollView
        contentContainerStyle={styles.feed}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (coachMessages.length || coachBusy) {
            scrollFeedToEnd();
          }
        }}
        ref={feedRef}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.coachHero}>
          <View style={styles.coachHeroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.coachHeroTitle}>
                Good morning, {athleteName}.
              </Text>
              <Text style={styles.coachHeroText}>
                {coachGreeting.replace(`Good morning ${athleteName}. `, "")}
              </Text>
            </View>
            <View style={styles.coachHeroBadge}>
              <Text style={styles.coachHeroBadgeText}>
                {recommendation.readinessLabel}
              </Text>
            </View>
          </View>
          <View style={styles.coachHeroMetrics}>
            <View style={styles.coachHeroMetric}>
              <Text style={styles.coachHeroMetricLabel}>Sleep</Text>
              <Text style={styles.coachHeroMetricValue}>{sleep}</Text>
            </View>
            <View style={styles.coachHeroMetric}>
              <Text style={styles.coachHeroMetricLabel}>{hrvLabel}</Text>
              <Text style={styles.coachHeroMetricValue}>
                {hrv.replace(" ms", "")}
              </Text>
            </View>
            <View style={styles.coachHeroMetric}>
              <Text style={styles.coachHeroMetricLabel}>RHR</Text>
              <Text style={styles.coachHeroMetricValue}>
                {rhr.replace(" bpm", "")}
              </Text>
            </View>
          </View>
        </View>

        <DataCard accent={accent} label="Sleep & recovery">
          <View style={styles.sourceLine}>
            <Text style={styles.sourceLineText}>
              {loadingInitialMetrics
                ? "Loading wearable data"
                : current?.hasSleep
                  ? wearableLabel
                  : "Waiting for wearable data"}
            </Text>
            <Text style={styles.sourceLineText}>
              {loadingInitialMetrics ? status : dataAge(lastSync)}
            </Text>
          </View>
          <View style={styles.metricGridFull}>
            <SmallMetric
              label="Sleep"
              loading={loadingInitialMetrics}
              value={sleep}
            />
            <SmallMetric
              label="Status"
              loading={loadingInitialMetrics}
              value={readinessStatus.ui.label}
            />
            <SmallMetric
              label="Score"
              loading={loadingInitialMetrics}
              value={formatNumber(recommendation.readiness ?? undefined)}
            />
            <SmallMetric
              label={hrvLabel}
              loading={loadingInitialMetrics}
              value={hrv.replace(" ms", "")}
            />
            <SmallMetric
              label="RHR"
              loading={loadingInitialMetrics}
              value={rhr.replace(" bpm", "")}
            />
          </View>
          <Text style={styles.helpText}>
            {loadingInitialMetrics
              ? `Getting recent data from ${sourceLabel}.`
              : recommendation.reason}
          </Text>
          {!loadingInitialMetrics
            ? readinessExplanation.map((line) => (
                <Text key={line} style={styles.helpText}>
                  {line}
                </Text>
              ))
            : null}
        </DataCard>

        <Pressable accessibilityRole="button" onPress={onOpenWorkout}>
          <DataCard accent={tokens.accent} label="Today's workout">
            <View style={styles.planHeader}>
              <View style={styles.planIcon}>
                <Activity color={tokens.surface} size={18} strokeWidth={2} />
              </View>
              <View style={styles.planCopy}>
                <Text style={styles.planTitle}>{plan.today.title}</Text>
                <View style={styles.coachPlanStats}>
                  <Text style={styles.coachPlanStat}>
                    {plan.today.durationMinutes}:00
                  </Text>
                  <Text style={styles.coachPlanStat}>~7.2 km</Text>
                  <Text style={styles.coachPlanStat}>
                    {plan.today.intensity}
                  </Text>
                </View>
                <Text style={styles.planDetail}>
                  Your {wearableLabel} will capture distance, pace, heart rate,
                  route, splits, and duration.
                </Text>
              </View>
              <ArrowRight color={tokens.muted} size={17} strokeWidth={2} />
            </View>
          </DataCard>
        </Pressable>

        {coachMessages.length ? (
          <Text style={styles.dateDivider}>Coach conversation</Text>
        ) : null}
        {coachMessages.map((message) =>
          message.role === "user" ? (
            <UserBubble key={message.id}>{message.text}</UserBubble>
          ) : (
            <CoachLine key={message.id}>{message.text}</CoachLine>
          ),
        )}
        {coachBusy ? (
          <CoachLine>
            Give me a second. I am checking your recent health data.
          </CoachLine>
        ) : null}

        {!hasSyncedData ? (
          <DataCard accent={tokens.accent} label="Datasource">
            <Text style={styles.helpText}>
              {sourceLabel} is the source of truth. Syncing creates raw schema
              rows, then derives daily coaching metrics locally on this device.
            </Text>
            <View style={styles.singleAction}>
              <AppButton
                disabled={busy}
                icon={RefreshCw}
                label={busy ? status : `Sync ${sourceLabel}`}
                onPress={onSync}
                variant="primary"
              />
            </View>
          </DataCard>
        ) : null}

        {warnings.length ? (
          <View style={styles.warningPanel}>
            {warnings.slice(0, 3).map((warning) => (
              <Text key={warning} style={styles.warningText}>
                {warning}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.chips}>
        {quickReplies.map((chip) => (
          <Pressable
            accessibilityRole="button"
            disabled={coachInputDisabled}
            key={chip}
            onPress={() => onSendCoachMessage(chip)}
            style={({ pressed }) => [
              styles.chip,
              coachInputDisabled && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.chipText}>{chip}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.composer}>
        <View style={styles.composerInput}>
          <TextInput
            accessibilityLabel="Ask your coach"
            autoCorrect
            cursorColor={tokens.accent}
            editable={!coachInputDisabled}
            onChangeText={onChangeCoachDraft}
            onSubmitEditing={() => onSendCoachMessage()}
            placeholder={composerPlaceholder}
            placeholderTextColor={tokens.muted}
            returnKeyType="send"
            selectionColor={tokens.accent}
            style={styles.composerTextInput}
            value={coachDraft}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={!canSendCoachMessage}
          onPress={() => onSendCoachMessage()}
          style={({ pressed }) => [
            styles.sendButton,
            !canSendCoachMessage && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {coachBusy ? (
            <ActivityIndicator color={tokens.surface} size="small" />
          ) : (
            <ArrowRight color={tokens.surface} size={18} strokeWidth={2.3} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
