import { useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Activity, ArrowRight, MoreHorizontal, RefreshCw } from 'lucide-react-native';

import { generateTrainingPlan } from '../coach/planEngine';
import { dataAge, formatDateKey, formatNumber, hrvMetricLabel, toneColor } from '../core/formatters';
import type { CoachConversationMessage, LastSync } from '../core/types';
import type { PipelineSnapshot } from '../health/types';
import { formatDuration as formatDurationFromDates } from '../lib/dates';
import { styles } from '../styles/appStyles';
import { tokens } from '../theme/tokens';
import { AppButton, CoachAvatar, CoachLine, DataCard, SmallMetric, UserBubble } from '../ui/primitives';

export function CoachScreen({
  coachBusy,
  coachDraft,
  coachMessages,
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
  const accent = toneColor(recommendation.color);
  const plan = useMemo(() => generateTrainingPlan(snapshot, 'run'), [snapshot]);
  const sleep = current?.sleepSeconds ? formatDurationFromDates(current.sleepSeconds) : '—';
  const hrv = current?.hrvLastNightAvg ? `${Math.round(current.hrvLastNightAvg)} ms` : '—';
  const hrvLabel = hrvMetricLabel(current);
  const rhr = current?.restingHr ? `${Math.round(current.restingHr)} bpm` : '—';
  const quickReplies = ['Make it easier', 'Move it to tomorrow', "I'm short on time"];
  const canSendCoachMessage = hasOpenAiApiKey && !coachBusy && Boolean(coachDraft.trim());
  const composerPlaceholder = hasOpenAiApiKey
    ? 'Ask your coach...'
    : 'Save an OpenAI API key in You to chat';
  const hasSyncedData =
    snapshot.totalSamples > 0 ||
    snapshot.workoutCount > 0 ||
    snapshot.sleepCount > 0 ||
    snapshot.nutritionDays > 0 ||
    snapshot.coverageDays > 0;
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
        <Text style={styles.dateDivider}>This morning</Text>
        <CoachLine first>Good morning Martin.</CoachLine>

        <DataCard accent={accent} inset label="Sleep & recovery">
          <View style={styles.sourceLine}>
            <Text style={styles.sourceLineText}>
              {current?.hasSleep ? 'Apple Watch' : 'Waiting for wearable data'}
            </Text>
            <Text style={styles.sourceLineText}>{dataAge(lastSync)}</Text>
          </View>
          <View style={styles.metricGridFull}>
            <SmallMetric label="Sleep" value={sleep} />
            <SmallMetric label="Score" value={formatNumber(recommendation.readiness ?? undefined)} />
            <SmallMetric label={hrvLabel} value={hrv.replace(' ms', '')} />
            <SmallMetric label="RHR" value={rhr.replace(' bpm', '')} />
          </View>
          <Text style={styles.helpText}>{recommendation.reason}</Text>
        </DataCard>

        <Pressable accessibilityRole="button" onPress={onOpenWorkout}>
          <DataCard accent={tokens.ink} inset label="Today's workout">
            <View style={styles.planHeader}>
              <View style={styles.planIcon}>
                <Activity color={tokens.surface} size={18} strokeWidth={2} />
              </View>
              <View style={styles.planCopy}>
                <Text style={styles.planTitle}>{plan.today.title}</Text>
                <View style={styles.coachPlanStats}>
                  <Text style={styles.coachPlanStat}>{plan.today.durationMinutes}:00</Text>
                  <Text style={styles.coachPlanStat}>~7.2 km</Text>
                  <Text style={styles.coachPlanStat}>{plan.today.intensity}</Text>
                </View>
                <Text style={styles.planDetail}>
                  Your Apple Watch will capture distance, pace, heart rate, route, splits, and duration.
                </Text>
              </View>
              <ArrowRight color={tokens.muted} size={17} strokeWidth={2} />
            </View>
          </DataCard>
        </Pressable>

        {coachMessages.length ? <Text style={styles.dateDivider}>Coach conversation</Text> : null}
        {coachMessages.map((message) =>
          message.role === 'user' ? (
            <UserBubble key={message.id}>{message.text}</UserBubble>
          ) : (
            <CoachLine key={message.id}>{message.text}</CoachLine>
          ),
        )}
        {coachBusy ? (
          <CoachLine>Give me a second. I am checking your recent health data.</CoachLine>
        ) : null}

        {!hasSyncedData ? (
          <DataCard accent={tokens.accent} inset label="Datasource">
            <Text style={styles.helpText}>
              Health Connect is the source of truth. Syncing creates raw schema rows,
              then derives daily coaching metrics locally on this device.
            </Text>
            <View style={styles.singleAction}>
              <AppButton
                disabled={busy}
                icon={RefreshCw}
                label={busy ? status : 'Sync Health Connect'}
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
            disabled={coachBusy || !hasOpenAiApiKey}
            key={chip}
            onPress={() => onSendCoachMessage(chip)}
            style={({ pressed }) => [
              styles.chip,
              (coachBusy || !hasOpenAiApiKey) && styles.disabled,
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
            cursorColor={tokens.ink}
            editable={hasOpenAiApiKey && !coachBusy}
            onChangeText={onChangeCoachDraft}
            onSubmitEditing={() => onSendCoachMessage()}
            placeholder={composerPlaceholder}
            placeholderTextColor={tokens.muted}
            returnKeyType="send"
            selectionColor={tokens.ink}
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
