import { useEffect, useRef, useState } from "react";
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
  AlertTriangle,
  ArrowRight,
  Check,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react-native";

import type { ReadinessStatusValue } from "../coach/readinessStatus";
import {
  createDefaultDailyCheckIn,
  dailyCheckInPainOptions,
  dailyCheckInPreferredActivityOptions,
  dailyCheckInScaleOptions,
  dailyCheckInTimeOptions,
  painRiskFlagFor,
} from "../coach/dailyCheckIn";
import {
  dataAge,
  formatDateKey,
  formatNumber,
  hrvMetricLabel,
  toneColor,
} from "../core/formatters";
import type { CoachConversationMessage, LastSync } from "../core/types";
import type {
  DailyCheckIn,
  DailyCheckInPain,
  DailyCheckInPreferredActivity,
  PipelineSnapshot,
} from "../health/types";
import {
  formatDuration as formatDurationFromDates,
  localDateKey,
} from "../lib/dates";
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

export function coachGreetingForDate(now = new Date()): string {
  const hour = now.getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";

  return "Good evening";
}

function readinessStatusColor(status: ReadinessStatusValue): string {
  if (status === "green") return tokens.positive;
  if (status === "yellow") return tokens.warm;
  if (status === "red") return tokens.danger;

  return tokens.muted;
}

function ReadinessStatusIndicator({
  label,
  status,
  variant = "metric",
}: {
  label: string;
  status: ReadinessStatusValue;
  variant?: "hero" | "metric";
}) {
  const color = readinessStatusColor(status);

  return (
    <View
      accessibilityLabel={`Readiness status: ${label}`}
      accessibilityRole="image"
      accessible
      style={
        variant === "hero"
          ? styles.coachHeroStatusIndicator
          : styles.readinessStatusIndicator
      }
    >
      <View
        style={[
          variant === "hero"
            ? styles.coachHeroStatusDot
            : styles.readinessStatusDot,
          { backgroundColor: color },
        ]}
      />
      {variant === "metric" ? (
        <View
          style={[styles.readinessStatusRail, { backgroundColor: color }]}
        />
      ) : null}
    </View>
  );
}

function scaleLabel(value: number): string {
  if (value === 1) return "Low";
  if (value === 2) return "Fair";
  if (value === 3) return "OK";
  if (value === 4) return "Good";
  return "High";
}

function painLabel(value: DailyCheckInPain): string {
  return value === "none"
    ? "None"
    : value.charAt(0).toUpperCase() + value.slice(1);
}

function activityLabel(value: DailyCheckInPreferredActivity): string {
  switch (value) {
    case "easy_cardio":
      return "Easy";
    case "run":
      return "Run";
    case "ride":
      return "Ride";
    case "strength":
      return "Lift";
    case "mobility":
      return "Mobility";
    case "rest":
      return "Rest";
  }
}

function CheckInSegment<T extends string | number>({
  label,
  value,
  options,
  format,
  risk,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  format: (value: T) => string;
  risk?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.checkInGroup}>
      <Text style={styles.checkInLabel}>{label}</Text>
      <View style={styles.segmentRow}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              accessibilityRole="button"
              key={String(option)}
              onPress={() => onChange(option)}
              style={({ pressed }) => [
                styles.segmentButton,
                selected && styles.segmentButtonSelected,
                selected && risk && styles.segmentButtonRisk,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.segmentButtonText,
                  selected && styles.segmentButtonTextSelected,
                  selected && risk && styles.segmentButtonRiskText,
                ]}
              >
                {format(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function CoachScreen({
  athleteName,
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
  onSaveDailyCheckIn,
  onSync,
  onOpenWorkout,
}: {
  athleteName?: string | null;
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
  onSaveDailyCheckIn: (draft: Partial<DailyCheckIn>) => void | Promise<void>;
  onSync: () => void;
  onOpenWorkout: () => void;
}) {
  const current = snapshot.today;
  const checkInDate = localDateKey(new Date());
  const [checkInDraft, setCheckInDraft] = useState<DailyCheckIn>(() =>
    snapshot.todayCheckIn
      ? snapshot.todayCheckIn
      : createDefaultDailyCheckIn(checkInDate),
  );
  const recommendation = snapshot.recommendation;
  const readinessStatus = recommendation.readinessStatus;
  const accent = toneColor(recommendation.color);
  const sleep = current?.sleepSeconds
    ? formatDurationFromDates(current.sleepSeconds)
    : "—";
  const hrv = current?.hrvLastNightAvg
    ? `${Math.round(current.hrvLastNightAvg)} ms`
    : "—";
  const hrvLabel = hrvMetricLabel(current);
  const rhr = current?.restingHr ? `${Math.round(current.restingHr)} bpm` : "—";
  const displayName = athleteName?.trim() || null;
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
  const coachGreeting = coachGreetingForDate();
  const coachHeroTitle = displayName
    ? `${coachGreeting}, ${displayName}.`
    : `${coachGreeting}.`;
  const coachHeroText = hasSyncedData
    ? `You are in a good spot to keep building toward ${goalPhrase}. I have checked the recovery picture and lined up today's work. If anything has changed since the data came in, tell me and I will adjust it.`
    : `Let's keep building toward ${goalPhrase}. I do not have enough wearable history yet, so I will keep things sensible and adjust as you give me more context.`;
  const feedRef = useRef<ScrollView | null>(null);
  const painRisk = painRiskFlagFor(checkInDraft);

  useEffect(() => {
    setCheckInDraft(
      snapshot.todayCheckIn
        ? snapshot.todayCheckIn
        : createDefaultDailyCheckIn(checkInDate),
    );
  }, [checkInDate, snapshot.todayCheckIn]);

  function updateCheckInDraft(patch: Partial<DailyCheckIn>) {
    setCheckInDraft((currentDraft) => {
      const next = {
        ...currentDraft,
        ...patch,
        localDate: checkInDate,
      };
      void onSaveDailyCheckIn(next);
      return next;
    });
  }

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
              <Text style={styles.coachHeroTitle}>{coachHeroTitle}</Text>
              <Text style={styles.coachHeroText}>{coachHeroText}</Text>
            </View>
            <View style={styles.coachHeroBadge}>
              <ReadinessStatusIndicator
                label={readinessStatus.ui.label}
                status={readinessStatus.status}
                variant="hero"
              />
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
            <View style={styles.smallMetric}>
              <Text style={styles.smallMetricLabel}>Status</Text>
              {loadingInitialMetrics ? (
                <View style={styles.smallMetricLoading}>
                  <ActivityIndicator color={tokens.accent} size="small" />
                </View>
              ) : (
                <ReadinessStatusIndicator
                  label={readinessStatus.ui.label}
                  status={readinessStatus.status}
                />
              )}
            </View>
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

        <DataCard
          accent={painRisk ? tokens.danger : tokens.brass}
          label="Daily check-in"
        >
          <View style={styles.sourceLine}>
            <Text style={styles.sourceLineText}>User-reported context</Text>
            <Text
              style={[
                styles.sourceLineText,
                painRisk && styles.checkInRiskText,
              ]}
            >
              {painRisk ?? "No pain flagged"}
            </Text>
          </View>
          <View style={styles.checkInGrid}>
            <CheckInSegment
              format={scaleLabel}
              label="Sleep quality"
              onChange={(sleepQuality) => updateCheckInDraft({ sleepQuality })}
              options={dailyCheckInScaleOptions}
              value={checkInDraft.sleepQuality}
            />
            <CheckInSegment
              format={scaleLabel}
              label="Soreness"
              onChange={(soreness) => updateCheckInDraft({ soreness })}
              options={dailyCheckInScaleOptions}
              value={checkInDraft.soreness}
            />
            <CheckInSegment
              format={scaleLabel}
              label="Energy"
              onChange={(energy) => updateCheckInDraft({ energy })}
              options={dailyCheckInScaleOptions}
              value={checkInDraft.energy}
            />
            <CheckInSegment
              format={painLabel}
              label="Pain"
              onChange={(pain) => updateCheckInDraft({ pain })}
              options={dailyCheckInPainOptions}
              risk={checkInDraft.pain !== "none"}
              value={checkInDraft.pain}
            />
            <CheckInSegment
              format={(minutes) => `${minutes}m`}
              label="Available time"
              onChange={(availableTimeMinutes) =>
                updateCheckInDraft({ availableTimeMinutes })
              }
              options={dailyCheckInTimeOptions}
              value={checkInDraft.availableTimeMinutes}
            />
            <CheckInSegment
              format={activityLabel}
              label="Preferred activity"
              onChange={(preferredActivity) =>
                updateCheckInDraft({ preferredActivity })
              }
              options={dailyCheckInPreferredActivityOptions}
              value={checkInDraft.preferredActivity}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              updateCheckInDraft({
                completedYesterday: !checkInDraft.completedYesterday,
              })
            }
            style={({ pressed }) => [
              styles.checkInToggle,
              checkInDraft.completedYesterday && styles.checkInToggleSelected,
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.checkInToggleIcon,
                checkInDraft.completedYesterday &&
                  styles.checkInToggleIconSelected,
              ]}
            >
              {checkInDraft.completedYesterday ? (
                <Check color={tokens.surface} size={14} strokeWidth={3} />
              ) : null}
            </View>
            <Text style={styles.checkInToggleText}>
              Completed yesterday's session
            </Text>
            {painRisk ? (
              <AlertTriangle
                color={tokens.danger}
                size={17}
                strokeWidth={2.2}
              />
            ) : null}
          </Pressable>
        </DataCard>

        <Pressable accessibilityRole="button" onPress={onOpenWorkout}>
          <DataCard accent={tokens.accent} label="Today's workout">
            <View style={styles.planHeader}>
              <View style={styles.planIcon}>
                <Activity color={tokens.surface} size={18} strokeWidth={2} />
              </View>
              <View style={styles.planCopy}>
                <Text style={styles.planTitle}>
                  {recommendation.recommendedActivity.title}
                </Text>
                <View style={styles.coachPlanStats}>
                  <Text style={styles.coachPlanStat}>
                    {recommendation.recommendedActivity.durationOrVolume}
                  </Text>
                  <Text style={styles.coachPlanStat}>
                    {recommendation.recommendedActivity.intensityTarget}
                  </Text>
                  <Text style={styles.coachPlanStat}>
                    {Math.round(recommendation.confidence * 100)}% confidence
                  </Text>
                </View>
                <Text style={styles.planDetail}>
                  {recommendation.shortExplanation}
                </Text>
                <Text style={styles.planDetail}>
                  Easier: {recommendation.easierAlternative.title} ·{" "}
                  {recommendation.easierAlternative.durationOrVolume}.
                </Text>
                <Text style={styles.planDetail}>
                  Avoid: {recommendation.whatToAvoidToday.join(", ")}.
                </Text>
                <Text style={styles.planDetail}>
                  Sources:{" "}
                  {recommendation.sourcesUsed.length
                    ? recommendation.sourcesUsed.join(", ")
                    : "no usable readiness sources"}
                  {recommendation.sourcesIgnored.length
                    ? ` · Ignored: ${recommendation.sourcesIgnored.join(", ")}`
                    : ""}
                </Text>
                <Text style={styles.planDetail}>
                  Check-in: {recommendation.checkInQuestion}
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
