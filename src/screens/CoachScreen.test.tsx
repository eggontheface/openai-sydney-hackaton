import { render, screen } from "@testing-library/react-native";

import { emptySnapshot } from "../core/constants";
import type { CoachConversationMessage, LastSync } from "../core/types";
import { CoachScreen } from "./CoachScreen";

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
});
