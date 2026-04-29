import { localDateKey } from "../lib/dates";
import { getPipelineSnapshot, saveDailyCheckIn } from "./trainingStore.web";

function installLocalStorage(): void {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    },
  });
}

describe("web training store daily check-ins", () => {
  beforeEach(() => {
    installLocalStorage();
    localStorage.clear();
  });

  it("adds saved check-ins to web snapshots, freshness, and pain guardrails", async () => {
    const today = localDateKey(new Date());

    await saveDailyCheckIn({
      localDate: today,
      sleepQuality: 3,
      soreness: 2,
      energy: 3,
      pain: "moderate",
      availableTimeMinutes: 45,
      preferredActivity: "mobility",
      completedYesterday: false,
    });

    const snapshot = await getPipelineSnapshot();
    const checkInFreshness = snapshot.sourceFreshness.find(
      (source) => source.domain === "check_ins",
    );

    expect(snapshot.todayCheckIn).toMatchObject({
      localDate: today,
      pain: "moderate",
      source: "user_reported",
    });
    expect(snapshot.checkInHistory).toHaveLength(1);
    expect(checkInFreshness).toMatchObject({
      state: "fresh",
      sampleCount: 1,
      dayCount: 1,
      latestLocalDate: today,
    });
    expect(snapshot.recommendation.readinessLabel).toBe("Pain flag");
    expect(snapshot.recommendation.readinessStatus.status).toBe("red");
    expect(snapshot.recommendation.recommendedActivity.intensityTarget).toBe(
      "easy only",
    );
    expect(snapshot.recommendation.whatToAvoidToday).toContain(
      "hard intervals",
    );
  });
});
