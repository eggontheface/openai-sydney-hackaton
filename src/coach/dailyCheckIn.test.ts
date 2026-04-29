import {
  buildDailyCheckInContextSignals,
  createDefaultDailyCheckIn,
  normalizeDailyCheckIn,
  painRiskFlagFor,
} from "./dailyCheckIn";

describe("daily check-in model", () => {
  it("creates a neutral user-reported check-in for a local date", () => {
    const checkIn = createDefaultDailyCheckIn(
      "2026-04-29",
      "2026-04-29T07:30:00.000Z",
    );

    expect(checkIn).toMatchObject({
      localDate: "2026-04-29",
      sleepQuality: 3,
      soreness: 2,
      energy: 3,
      pain: "none",
      availableTimeMinutes: 30,
      preferredActivity: "easy_cardio",
      completedYesterday: false,
      source: "user_reported",
      createdAt: "2026-04-29T07:30:00.000Z",
      updatedAt: "2026-04-29T07:30:00.000Z",
    });
  });

  it("normalizes partial input and preserves original creation time", () => {
    const checkIn = normalizeDailyCheckIn(
      {
        localDate: "2026-04-28",
        sleepQuality: 7,
        soreness: -1,
        energy: 1,
        pain: "severe",
        availableTimeMinutes: 999,
        preferredActivity: "strength",
        completedYesterday: true,
        source: "user_reported",
        createdAt: "2026-04-28T06:00:00.000Z",
        updatedAt: "2026-04-28T06:00:00.000Z",
      },
      "2026-04-29",
      "2026-04-29T08:00:00.000Z",
    );

    expect(checkIn).toMatchObject({
      localDate: "2026-04-29",
      sleepQuality: 5,
      soreness: 1,
      energy: 1,
      pain: "severe",
      availableTimeMinutes: 120,
      preferredActivity: "strength",
      completedYesterday: true,
      createdAt: "2026-04-28T06:00:00.000Z",
      updatedAt: "2026-04-29T08:00:00.000Z",
    });
  });

  it("makes pain an explicit user-reported risk flag", () => {
    const checkIn = createDefaultDailyCheckIn(
      "2026-04-29",
      "2026-04-29T07:30:00.000Z",
    );

    expect(painRiskFlagFor({ ...checkIn, pain: "none" })).toBeNull();
    expect(painRiskFlagFor({ ...checkIn, pain: "moderate" })).toBe(
      "user-reported moderate pain",
    );
  });

  it("summarizes user-reported values as recommendation context", () => {
    const checkIn = createDefaultDailyCheckIn(
      "2026-04-29",
      "2026-04-29T07:30:00.000Z",
    );

    expect(
      buildDailyCheckInContextSignals({
        ...checkIn,
        sleepQuality: 2,
        soreness: 4,
        energy: 1,
        pain: "mild",
        availableTimeMinutes: 20,
        preferredActivity: "mobility",
        completedYesterday: true,
      }),
    ).toEqual([
      "user-reported sleep quality is poor",
      "user-reported soreness is high",
      "user-reported energy is low",
      "user-reported mild pain",
      "user has 20 min available",
      "user prefers mobility today",
      "user completed yesterday's session",
    ]);
  });
});
