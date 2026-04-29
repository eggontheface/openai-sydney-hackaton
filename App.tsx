import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from "react-native";

import { openAiCoachModel, sendCoachMessage } from "./src/ai/openaiCoach";
import {
  generateTrainingPlan,
  resolveTrainingGoal,
} from "./src/coach/planEngine";
import {
  createCoachMessage,
  toOpenAiConversation,
} from "./src/core/coachConversation";
import {
  baselineRangeDays,
  emptyAppSettings,
  emptySnapshot,
} from "./src/core/constants";
import type {
  CoachConversationMessage,
  LastSync,
  SyncRuns,
  Tab,
} from "./src/core/types";
import { CoachOnboardingScreen } from "./src/screens/CoachOnboardingScreen";
import { CoachScreen } from "./src/screens/CoachScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { SourceScreen } from "./src/screens/SourceScreen";
import { SplashScreen, StartLoadingScreen } from "./src/screens/SplashScreen";
import { WorkoutPlanScreen } from "./src/screens/WorkoutPlanScreen";
import {
  currentHealthProviderId,
  currentHealthProviderLabel,
  syncCurrentPlatform,
} from "./src/health/syncPipeline";
import type { PipelineSnapshot, SyncRange } from "./src/health/types";
import { formatRange, makeSyncRange } from "./src/lib/dates";
import {
  buildLocalGoalCoachReply,
  buildLocalOnboardingSummary,
  sendOnboardingGoalMessage,
  sendOnboardingSummaryMessage,
  type GoalCoachMessage,
  type GoalCoachResponse,
  type OnboardingAnswers,
} from './src/onboarding/goalCoach';
import {
  clearOpenAiApiKey,
  loadAppSettings,
  readOpenAiApiKey,
  saveAppSettings,
  saveOpenAiApiKey,
} from "./src/storage/appSettings";
import type { AppSettings } from "./src/storage/appSettings";
import {
  clearPipeline,
  exportPipelineArtifacts,
  getCoachHealthContext,
  getLastSyncRun,
  getLastSuccessfulSyncRun,
  getPipelineSnapshot,
  getRecentSyncRuns,
  initTrainingStore,
  recordSyncRun,
  upsertSyncPayload,
} from "./src/storage/trainingStore";
import { styles } from "./src/styles/appStyles";
import { TabBar } from "./src/ui/TabBar";

export default function App() {
  const [entryMode, setEntryMode] = useState<
    "splash" | "onboarding" | "loading-start" | "app"
  >("splash");
  const [activeTab, setActiveTab] = useState<Tab>("coach");
  const [rangeDays, setRangeDays] = useState(baselineRangeDays);
  const [snapshot, setSnapshot] = useState<PipelineSnapshot>(emptySnapshot);
  const [goalText, setGoalText] = useState("");
  const [lastSync, setLastSync] = useState<LastSync>(null);
  const [lastSuccessfulSync, setLastSuccessfulSync] = useState<LastSync>(null);
  const [recentSyncRuns, setRecentSyncRuns] = useState<SyncRuns>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(emptyAppSettings);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [coachDraft, setCoachDraft] = useState("");
  const [coachMessages, setCoachMessages] = useState<
    CoachConversationMessage[]
  >([]);
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachResponseId, setCoachResponseId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [storeReady, setStoreReady] = useState(false);
  const bootstrapPromiseRef = useRef<Promise<void> | null>(null);

  const range = useMemo(() => makeSyncRange(rangeDays), [rangeDays]);
  const canSync = Platform.OS === "ios" || Platform.OS === "android";
  const sourceLabel = canSync
    ? currentHealthProviderLabel()
    : "Apple Health / Health Connect";

  async function refreshStore() {
    const [
      nextSnapshot,
      nextLastSync,
      nextLastSuccessfulSync,
      nextRecentSyncRuns,
    ] = await Promise.all([
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
    const bootstrap = initTrainingStore()
      .then(async () => {
        const nextSettings = await loadAppSettings();
        setAppSettings(nextSettings);
        setRangeDays(nextSettings.defaultSyncRangeDays);
        await refreshStore();
      })
      .catch((error) =>
        setStatus(String(error instanceof Error ? error.message : error)),
      )
      .finally(() => setStoreReady(true));

    bootstrapPromiseRef.current = bootstrap;
    void bootstrap;
  }, []);

  async function ensureStoreReady() {
    if (bootstrapPromiseRef.current) {
      await bootstrapPromiseRef.current;
    }
  }

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true),
    );
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false),
    );

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
      setApiKeyDraft("");
      setStatus("OpenAI API key saved locally");
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
      setApiKeyDraft("");
      setStatus("OpenAI API key cleared");
    } catch (error) {
      setStatus(String(error instanceof Error ? error.message : error));
    } finally {
      setSettingsBusy(false);
    }
  }

  async function setDefaultSyncRange(days: number) {
    setSettingsBusy(true);
    try {
      const nextSettings = await saveAppSettings({
        defaultSyncRangeDays: days,
      });
      setAppSettings(nextSettings);
      setRangeDays(nextSettings.defaultSyncRangeDays);
      setStatus(
        `Default sync range set to ${nextSettings.defaultSyncRangeDays}d`,
      );
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

    if (busy) {
      setStatus(
        "Wait for the current sync to finish before messaging the coach.",
      );
      return;
    }

    const userMessage = createCoachMessage("user", text);
    const requestConversation = toOpenAiConversation(coachMessages);

    setCoachDraft("");

    const apiKey = await readOpenAiApiKey();
    if (!apiKey) {
      setStatus("Save an OpenAI API key in You before messaging the coach.");
      setCoachMessages((messages) => [
        ...messages,
        userMessage,
        createCoachMessage("coach", localCoachFallback(text)),
      ]);
      return;
    }

    setCoachMessages((messages) => [...messages, userMessage]);
    setCoachBusy(true);
    setStatus(`Coach is checking SQLite health data with ${openAiCoachModel}`);

    try {
      const freshSnapshot = await getPipelineSnapshot();
      const healthContext = await getCoachHealthContext({
        rebuildDaily: false,
      });
      const plan = generateTrainingPlan(
        freshSnapshot,
        resolveTrainingGoal(goalText),
      );
      setSnapshot(freshSnapshot);
      const response = await sendCoachMessage({
        apiKey,
        conversation: requestConversation,
        goalText,
        healthContext,
        plan,
        previousResponseId: coachResponseId,
        snapshot: freshSnapshot,
        userMessage: text,
      });
      setCoachResponseId(response.responseId);
      setCoachMessages((messages) => [
        ...messages,
        createCoachMessage("coach", response.text),
      ]);
      setStatus(`Coach answered with ${openAiCoachModel}`);
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error);
      const isLocalDatabaseError = message
        .toLowerCase()
        .includes("database is locked");
      setStatus(message);
      setCoachMessages((messages) => [
        ...messages,
        createCoachMessage(
          "coach",
          isLocalDatabaseError
            ? `I couldn't read the local health database. Wait for sync to finish, then try again. ${message}`
            : `I couldn't reach the OpenAI API. ${message}`,
        ),
      ]);
    } finally {
      setCoachBusy(false);
    }
  }

  async function discussOnboardingGoal({
    conversation,
    previousResponseId,
    userMessage,
  }: {
    conversation: GoalCoachMessage[];
    previousResponseId?: string | null;
    userMessage: string;
  }): Promise<GoalCoachResponse> {
    const apiKey = await readOpenAiApiKey();

    if (!apiKey) {
      setStatus('Onboarding coach is running in local demo mode. Add an OpenAI API key in You for live AI.');
      return {
        responseId: null,
        text: buildLocalGoalCoachReply(userMessage),
      };
    }

    const freshSnapshot = await getPipelineSnapshot();
    setSnapshot(freshSnapshot);
    setStatus('Onboarding coach is discussing your goal with OpenAI');

    const response = await sendOnboardingGoalMessage({
      apiKey,
      conversation,
      previousResponseId,
      snapshot: freshSnapshot,
      userMessage,
    });
    setStatus('Onboarding coach updated your goal profile');
    return response;
  }

  async function summarizeOnboarding({
    answers,
    conversation,
  }: {
    answers: OnboardingAnswers;
    conversation: GoalCoachMessage[];
  }): Promise<GoalCoachResponse> {
    const freshSnapshot = await getPipelineSnapshot();
    setSnapshot(freshSnapshot);

    const apiKey = await readOpenAiApiKey();
    if (!apiKey) {
      setStatus('Onboarding summary is running in local demo mode. Add an OpenAI API key in You for live AI.');
      return {
        responseId: null,
        text: buildLocalOnboardingSummary({
          answers,
          dataSummary: {
            coverageDays: freshSnapshot.coverageDays,
            sleepSessions: freshSnapshot.sleepCount,
            workouts: freshSnapshot.workoutCount,
          },
        }),
      };
    }

    setStatus('Onboarding coach is summarising your setup with OpenAI');
    const response = await sendOnboardingSummaryMessage({
      apiKey,
      answers,
      conversation,
      snapshot: freshSnapshot,
    });
    setStatus('Onboarding summary ready');
    return response;
  }

  function localCoachFallback(message: string): string {
    const normalized = message.toLowerCase();
    const mentionsPain =
      normalized.includes("pain") ||
      normalized.includes("sore") ||
      normalized.includes("knee") ||
      normalized.includes("niggle") ||
      normalized.includes("injur");
    const mentionsFatigue =
      normalized.includes("tired") ||
      normalized.includes("fatigue") ||
      normalized.includes("exhausted") ||
      normalized.includes("sick") ||
      normalized.includes("ill");

    if (mentionsPain) {
      return "Yes. Put the knee first today: swap impact work for an easy walk, bike, or mobility session, and keep discomfort at a very low level. Stop if it is sharp, worsening, swollen, or changes your gait; if it persists, skip running and get it checked. Save an OpenAI API key in You when you want me to talk through the full plan trade-off properly.";
    }

    if (mentionsFatigue) {
      return "Yes. Treat that as useful context and downshift today: reduce duration, keep intensity easy, or move the session to tomorrow. The plan should adapt to how you feel, not just what the wearable says. Save an OpenAI API key in You when you want a proper back-and-forth on the broader plan.";
    }

    return "I have captured that context. The cards show the data, but this is the kind of detail I should use to adapt the plan. Save an OpenAI API key in You when you want a proper AI coaching conversation around it.";
  }

  function makeIncrementalSyncRange(
    lastSuccessful: LastSync,
  ): SyncRange | null {
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

  async function runSync(syncType: "manual" | "incremental" = "manual") {
    await ensureStoreReady();

    if (!canSync) {
      setStatus("Use an iOS or Android dev build.");
      return;
    }

    const provider = currentHealthProviderId();
    const startedAt = new Date().toISOString();
    const syncRange =
      syncType === "incremental"
        ? makeIncrementalSyncRange(lastSuccessfulSync)
        : range;

    if (!syncRange) {
      setStatus("Run a manual sync before incremental sync.");
      return;
    }

    setBusy(true);
    setWarnings([]);
    setStatus(`Syncing ${formatRange(syncRange)}`);

    try {
      const result = await syncCurrentPlatform(syncRange);
      const saved = await upsertSyncPayload(result);
      await recordSyncRun(
        result.provider,
        syncRange,
        saved,
        startedAt,
        undefined,
        {
          syncType,
          healthSampleCount: result.samples.length,
          workoutCount: result.workouts.length,
          sleepSessionCount: result.sleepSessions.length,
          nutritionDayCount: result.nutritionDaily.length,
          warningCount: result.warnings.length,
          diagnosticCount: result.diagnostics.length,
        },
      );
      setWarnings(result.warnings);
      setStatus(`Synced ${saved.toLocaleString()} records`);
      await refreshStore();
    } catch (error) {
      if (provider) {
        await recordSyncRun(provider, syncRange, 0, startedAt, error, {
          syncType,
        });
      }
      setStatus(String(error instanceof Error ? error.message : error));
      await refreshStore();
    } finally {
      setBusy(false);
    }
  }

  async function syncDataAndStart() {
    setActiveTab("coach");
    setEntryMode("loading-start");
    setStatus(
      canSync
        ? `Loading data from ${sourceLabel}`
        : "Opening local health store",
    );

    await ensureStoreReady();
    await runSync();
    setEntryMode("app");
  }

  async function runExport() {
    setBusy(true);
    try {
      const result = await exportPipelineArtifacts();
      setStatus(
        `Exported ${result.jsonFileUri.split("/").pop()} and ${result.healthCheckFileUri.split("/").pop()}`,
      );
    } catch (error) {
      setStatus(String(error instanceof Error ? error.message : error));
    } finally {
      setBusy(false);
    }
  }

  function confirmClear() {
    Alert.alert(
      "Clear local data",
      "Remove imported records, rollups, and sync history?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            void clearPipeline()
              .then(refreshStore)
              .then(() => setStatus("Local pipeline cleared"));
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        style={styles.appShell}
      >
        {entryMode === "splash" ? (
          <SplashScreen
            busy={!storeReady}
            onStartOnboarding={() => setEntryMode("onboarding")}
            onSyncAndStart={() => void syncDataAndStart()}
            sourceLabel={sourceLabel}
            status={storeReady ? status : "Opening local health store"}
          />
        ) : null}
        {entryMode === "onboarding" ? (
          <CoachOnboardingScreen
            busy={busy}
            canSync={canSync}
            onDiscussGoal={discussOnboardingGoal}
            onComplete={(nextGoal) => {
              setGoalText(nextGoal);
              setEntryMode("app");
              setActiveTab("coach");
            }}
            onSummarizeOnboarding={summarizeOnboarding}
            onSync={runSync}
            sourceLabel={sourceLabel}
            status={status}
            snapshot={snapshot}
          />
        ) : null}
        {entryMode === "loading-start" ? (
          <StartLoadingScreen sourceLabel={sourceLabel} status={status} />
        ) : null}
        {entryMode === "app" && activeTab === "coach" ? (
          <CoachScreen
            busy={busy}
            coachBusy={coachBusy}
            coachDraft={coachDraft}
            coachMessages={coachMessages}
            goalText={goalText}
            hasOpenAiApiKey={appSettings.hasOpenAiApiKey}
            lastSync={lastSync}
            onChangeCoachDraft={setCoachDraft}
            onSendCoachMessage={submitCoachMessage}
            onOpenWorkout={() => setActiveTab("workout")}
            onSync={runSync}
            snapshot={snapshot}
            status={status}
            warnings={warnings}
          />
        ) : null}
        {entryMode === "app" && activeTab === "workout" ? (
          <WorkoutPlanScreen goalText={goalText} snapshot={snapshot} />
        ) : null}
        {entryMode === "app" && activeTab === "history" ? (
          <HistoryScreen goalText={goalText} snapshot={snapshot} />
        ) : null}
        {entryMode === "app" && activeTab === "you" ? (
          <SourceScreen
            apiKeyDraft={apiKeyDraft}
            appSettings={appSettings}
            busy={busy}
            lastSync={lastSync}
            lastSuccessfulSync={lastSuccessfulSync}
            onClear={confirmClear}
            onClearApiKey={removeApiKey}
            onExport={runExport}
            onIncrementalSync={() => void runSync("incremental")}
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
        {!keyboardVisible && entryMode === "app" ? (
          <TabBar active={activeTab} onChange={setActiveTab} />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
