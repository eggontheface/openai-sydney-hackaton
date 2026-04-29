import { render, screen } from "@testing-library/react-native";

import { completeCoachRecommendation } from "../coach/dailyRecommendation";
import { buildReadinessStatus } from "../coach/readinessStatus";
import { emptySnapshot } from "../core/constants";
import type { CoachConversationMessage, LastSync } from "../core/types";
import { CoachScreen, coachGreetingForDate } from "./CoachScreen";

const baseProps = {
  busy: false,
  coachBusy: false,
  coachDraft: "",
  coachMessages: [] as CoachConversationMessage[],
  goalText: "",
  hasOpenAiApiKey: false,
  lastSync: null as LastSync,
  onChangeCoachDraft: jest.fn(),
  onOpenWorkout: jest.fn(),
  onSendCoachMessage: jest.fn(),
  onSync: jest.fn(),
  snapshot: emptySnapshot,
  status: "Ready",
  warnings: [] as string[],
};

describe("CoachScreen athlete greeting", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-29T09:00:00"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not fall back to a hardcoded athlete name", () => {
    render(<CoachScreen {...baseProps} athleteName={undefined} />);

    expect(screen.queryByText(/Martin/i)).toBeNull();
    expect(screen.getByText("Good morning.")).toBeOnTheScreen();
  });

  it("uses the supplied athlete name when one is available", () => {
    render(<CoachScreen {...baseProps} athleteName="Sam" />);

    expect(screen.getByText("Good morning, Sam.")).toBeOnTheScreen();
    expect(screen.queryByText(/Martin/i)).toBeNull();
  });

  it("uses an afternoon greeting after noon", () => {
    jest.setSystemTime(new Date("2026-04-29T14:00:00"));

    render(<CoachScreen {...baseProps} athleteName="Sam" />);

    expect(screen.getByText("Good afternoon, Sam.")).toBeOnTheScreen();
    expect(screen.queryByText("Good morning, Sam.")).toBeNull();
  });

  it("maps the current hour to a coach greeting", () => {
    expect(coachGreetingForDate(new Date("2026-04-29T08:00:00"))).toBe(
      "Good morning",
    );
    expect(coachGreetingForDate(new Date("2026-04-29T12:00:00"))).toBe(
      "Good afternoon",
    );
    expect(coachGreetingForDate(new Date("2026-04-29T18:00:00"))).toBe(
      "Good evening",
    );
  });
});

describe("CoachScreen readiness status", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-29T09:00:00"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders yellow readiness as color indicators instead of visible status text", () => {
    const readinessStatus = buildReadinessStatus({
      score: 68,
      signalsUsed: ["sleep was adequate at 6h 50m"],
      sourceFreshness: [],
    });
    const snapshot = {
      ...emptySnapshot,
      totalSamples: 1,
      recommendation: completeCoachRecommendation({
        readiness: 68,
        readinessStatus,
        readinessLabel: readinessStatus.ui.label,
        color: readinessStatus.ui.color,
        title: readinessStatus.ui.title,
        detail: readinessStatus.ui.detail,
        reason: readinessStatus.ui.reason,
        opener: readinessStatus.ui.opener,
        strain: 45,
        strainTarget: "4-6",
      }),
    };

    render(<CoachScreen {...baseProps} snapshot={snapshot} />);

    expect(screen.queryByText("Yellow")).toBeNull();
    expect(screen.getAllByLabelText("Readiness status: Yellow")).toHaveLength(
      2,
    );
  });
});
