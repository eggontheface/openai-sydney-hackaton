import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';

import { openAiCoachModel, sendCoachMessage } from './src/ai/openaiCoach';
import { createCoachMessage, toOpenAiConversation } from './src/core/coachConversation';
import { baselineRangeDays, emptyAppSettings, emptySnapshot } from './src/core/constants';
import type { CoachConversationMessage, LastSync, SyncRuns, Tab } from './src/core/types';
import { CoachOnboardingScreen } from './src/screens/CoachOnboardingScreen';
import { CoachScreen } from './src/screens/CoachScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SourceScreen } from './src/screens/SourceScreen';
import { WorkoutPlanScreen } from './src/screens/WorkoutPlanScreen';
import { currentHealthProviderId, currentHealthProviderLabel, syncCurrentPlatform } from './src/health/syncPipeline';
import type { PipelineSnapshot, SyncRange } from './src/health/types';
import { formatRange, makeSyncRange } from './src/lib/dates';
import {
  clearOpenAiApiKey,
  loadAppSettings,
  readOpenAiApiKey,
  saveAppSettings,
  saveOpenAiApiKey,
} from './src/storage/appSettings';
import type { AppSettings } from './src/storage/appSettings';
import {
  clearPipeline,
  exportPipelineJson,
  getCoachHealthContext,
  getLastSyncRun,
  getLastSuccessfulSyncRun,
  getPipelineSnapshot,
  getRecentSyncRuns,
  initTrainingStore,
  recordSyncRun,
  upsertSyncPayload,
} from './src/storage/trainingStore';
import { styles } from './src/styles/appStyles';
import { TabBar } from './src/ui/TabBar';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('coach');
  const [rangeDays, setRangeDays] = useState(baselineRangeDays);
  const [snapshot, setSnapshot] = useState<PipelineSnapshot>(emptySnapshot);
  const [goalText, setGoalText] = useState('');
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [lastSync, setLastSync] = useState<LastSync>(null);
  const [lastSuccessfulSync, setLastSuccessfulSync] = useState<LastSync>(null);
  const [recentSyncRuns, setRecentSyncRuns] = useState<SyncRuns>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(emptyAppSettings);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [coachDraft, setCoachDraft] = useState('');
  const [coachMessages, setCoachMessages] = useState<CoachConversationMessage[]>([]);
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachResponseId, setCoachResponseId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const range = useMemo(() => makeSyncRange(rangeDays), [rangeDays]);
  const canSync = Platform.OS === 'ios' || Platform.OS === 'android';

  async function refreshStore() {
    const [nextSnapshot, nextLastSync, nextLastSuccessfulSync, nextRecentSyncRuns] = await Promise.all([
      getPipelineSnapshot(),
      getLastSyncRun(),
      getLastSuccessfulSyncRun(),
      getRecentSyncRuns(),
    ]);
    setSnapshot(nextSnapshot);
    setLastSync(nextLastSync);
    setLastSuccessfulSync(nextLastSuccessfulSync);
    setRecentSyncRuns(nextRecentSyncRuns);
  }

  useEffect(() => {
    void initTrainingStore()
      .then(async () => {
        const nextSettings = await loadAppSettings();
        setAppSettings(nextSettings);
        setRangeDays(nextSettings.defaultSyncRangeDays);
        await refreshStore();
      })
      .catch((error) => setStatus(String(error instanceof Error ? error.message : error)));
  }, []);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  async function saveApiKey() {
    setSettingsBusy(true);
    try {
      const nextSettings = await saveOpenAiApiKey(apiKeyDraft);
      setAppSettings(nextSettings);
      setApiKeyDraft('');
      setStatus('OpenAI API key saved locally');
    } catch (error) {
      setStatus(String(error instanceof Error ? error.message : error));
    } finally {
      setSettingsBusy(false);
    }
  }

  async function removeApiKey() {
    setSettingsBusy(true);
    try {
      const nextSettings = await clearOpenAiApiKey();
      setAppSettings(nextSettings);
      setApiKeyDraft('');
      setStatus('OpenAI API key cleared');
    } catch (error) {
      setStatus(String(error instanceof Error ? error.message : error));
    } finally {
      setSettingsBusy(false);
    }
  }

  async function setDefaultSyncRange(days: number) {
    setSettingsBusy(true);
    try {
      const nextSettings = await saveAppSettings({ defaultSyncRangeDays: days });
      setAppSettings(nextSettings);
      setRangeDays(nextSettings.defaultSyncRangeDays);
      setStatus(`Default sync range set to ${nextSettings.defaultSyncRangeDays}d`);
    } catch (error) {
      setStatus(String(error instanceof Error ? error.message : error));
    } finally {
      setSettingsBusy(false);
    }
  }

  async function submitCoachMessage(messageOverride?: string) {
    const text = (messageOverride ?? coachDraft).trim();
    if (!text || coachBusy) {
      return;
    }

    const apiKey = await readOpenAiApiKey();
    if (!apiKey) {
      setStatus('Save an OpenAI API key in You before messaging the coach.');
      return;
    }

    const userMessage = createCoachMessage('user', text);
    const requestConversation = toOpenAiConversation(coachMessages);

    setCoachDraft('');
    setCoachMessages((messages) => [...messages, userMessage]);
    setCoachBusy(true);
    setStatus(`Coach is checking SQLite health data with ${openAiCoachModel}`);

    try {
      const freshSnapshot = await getPipelineSnapshot();
      const healthContext = await getCoachHealthContext({ rebuildDaily: false });
      setSnapshot(freshSnapshot);
      const response = await sendCoachMessage({
        apiKey,
        conversation: requestConversation,
        healthContext,
        previousResponseId: coachResponseId,
        snapshot: freshSnapshot,
        userMessage: text,
      });
      setCoachResponseId(response.responseId);
      setCoachMessages((messages) => [...messages, createCoachMessage('coach', response.text)]);
      setStatus(`Coach answered with ${openAiCoachModel}`);
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error);
      setStatus(message);
      setCoachMessages((messages) => [
        ...messages,
        createCoachMessage(
          'coach',
          `I couldn't reach the OpenAI API. ${message}`,
        ),
      ]);
    } finally {
      setCoachBusy(false);
    }
  }

  function makeIncrementalSyncRange(lastSuccessful: LastSync): SyncRange | null {
    if (!lastSuccessful) {
      return null;
    }

    const startDate = new Date(lastSuccessful.range_end);
    if (Number.isNaN(startDate.getTime())) {
      return null;
    }

    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date();
    if (startDate.getTime() > endDate.getTime()) {
      startDate.setTime(endDate.getTime());
      startDate.setHours(0, 0, 0, 0);
    }

    return { startDate, endDate };
  }

  async function runSync(syncType: 'manual' | 'incremental' = 'manual') {
    if (!canSync) {
      setStatus('Use an iOS or Android dev build.');
      return;
    }

    const provider = currentHealthProviderId();
    const startedAt = new Date().toISOString();
    const syncRange =
      syncType === 'incremental' ? makeIncrementalSyncRange(lastSuccessfulSync) : range;

    if (!syncRange) {
      setStatus('Run a manual sync before incremental sync.');
      return;
    }

    setBusy(true);
    setWarnings([]);
    setStatus(`Syncing ${formatRange(syncRange)}`);

    try {
      const result = await syncCurrentPlatform(syncRange);
      const saved = await upsertSyncPayload(result);
      await recordSyncRun(result.provider, syncRange, saved, startedAt, undefined, {
        syncType,
        healthSampleCount: result.samples.length,
        workoutCount: result.workouts.length,
        sleepSessionCount: result.sleepSessions.length,
        nutritionDayCount: result.nutritionDaily.length,
        warningCount: result.warnings.length,
        diagnosticCount: result.diagnostics.length,
      });
      setWarnings(result.warnings);
      setStatus(`Synced ${saved.toLocaleString()} records`);
      await refreshStore();
    } catch (error) {
      if (provider) {
        await recordSyncRun(provider, syncRange, 0, startedAt, error, { syncType });
      }
      setStatus(String(error instanceof Error ? error.message : error));
      await refreshStore();
    } finally {
      setBusy(false);
    }
  }

  async function runExport() {
    setBusy(true);
    try {
      const fileUri = await exportPipelineJson();
      setStatus(`Exported ${fileUri.split('/').pop()}`);
    } catch (error) {
      setStatus(String(error instanceof Error ? error.message : error));
    } finally {
      setBusy(false);
    }
  }

  function confirmClear() {
    Alert.alert('Clear local data', 'Remove imported records, rollups, and sync history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          void clearPipeline()
            .then(refreshStore)
            .then(() => setStatus('Local pipeline cleared'));
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.appShell}
      >
        {!hasCompletedOnboarding ? (
          <CoachOnboardingScreen
            busy={busy}
            canSync={canSync}
            onComplete={(nextGoal) => {
              setGoalText(nextGoal);
              setHasCompletedOnboarding(true);
              setActiveTab('coach');
            }}
            onSync={runSync}
            sourceLabel={canSync ? currentHealthProviderLabel() : 'Apple Health / Health Connect'}
            status={status}
            snapshot={snapshot}
          />
        ) : null}
        {hasCompletedOnboarding && activeTab === 'coach' ? (
          <CoachScreen
            busy={busy}
            coachBusy={coachBusy}
            coachDraft={coachDraft}
            coachMessages={coachMessages}
            hasOpenAiApiKey={appSettings.hasOpenAiApiKey}
            lastSync={lastSync}
            onChangeCoachDraft={setCoachDraft}
            onSendCoachMessage={submitCoachMessage}
            onOpenWorkout={() => setActiveTab('workout')}
            onSync={runSync}
            snapshot={snapshot}
            status={status}
            warnings={warnings}
          />
        ) : null}
        {hasCompletedOnboarding && activeTab === 'workout' ? <WorkoutPlanScreen snapshot={snapshot} /> : null}
        {hasCompletedOnboarding && activeTab === 'history' ? <HistoryScreen snapshot={snapshot} /> : null}
        {hasCompletedOnboarding && activeTab === 'you' ? (
          <SourceScreen
            apiKeyDraft={apiKeyDraft}
            appSettings={appSettings}
            busy={busy}
            lastSync={lastSync}
            lastSuccessfulSync={lastSuccessfulSync}
            onClear={confirmClear}
            onClearApiKey={removeApiKey}
            onExport={runExport}
            onIncrementalSync={() => void runSync('incremental')}
            onSaveApiKey={saveApiKey}
            onSetDefaultRange={setDefaultSyncRange}
            onSync={runSync}
            rangeDays={rangeDays}
            recentSyncRuns={recentSyncRuns}
            setApiKeyDraft={setApiKeyDraft}
            setRangeDays={setRangeDays}
            settingsBusy={settingsBusy}
            snapshot={snapshot}
            status={status}
          />
        ) : null}
        {!keyboardVisible ? (
          <TabBar
            active={hasCompletedOnboarding ? activeTab : 'coach'}
            onChange={(tab) => {
              if (hasCompletedOnboarding) {
                setActiveTab(tab);
              } else {
                setActiveTab('coach');
              }
            }}
          />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
