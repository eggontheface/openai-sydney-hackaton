import type { SourceFreshness } from "../health/types";
import { buildReadinessStatus } from "./readinessStatus";

function freshness(
  label: string,
  state: SourceFreshness["state"],
): SourceFreshness {
  return {
    domain:
      label === "HRV" ? "hrv" : label === "Resting HR" ? "resting_hr" : "sleep",
    label,
    state,
    canonicalTypes: ["sleep_session"],
    sampleCount: state === "missing" ? 0 : 3,
    dayCount: state === "missing" ? 0 : 3,
    latestLocalDate: state === "missing" ? undefined : "2026-04-27",
    ageDays: state === "fresh" ? 0 : 3,
    limitations: [],
  };
}

describe("readiness status contract", () => {
  it("maps high numeric readiness to a green coach contract", () => {
    const status = buildReadinessStatus({
      score: 84,
      signalsUsed: ["sleep was 8h 02m", "RMSSD HRV is up 12 ms"],
      sourceFreshness: [],
    });

    expect(status.status).toBe("green");
    expect(status.confidence).toBeGreaterThanOrEqual(0.75);
    expect(status.score).toBe(84);
    expect(status.signalsUsed).toEqual([
      "sleep was 8h 02m",
      "RMSSD HRV is up 12 ms",
    ]);
    expect(status.staleSignalsIgnored).toEqual([]);
    expect(status.missingSignals).toEqual([]);
    expect(status.conservativeAdjustmentReason).toBeNull();
    expect(status.ui.label).toBe("Green");
    expect(status.ui.color).toBe("positive");
  });

  it("maps moderate or incomplete readiness to yellow and explains stale and missing data", () => {
    const status = buildReadinessStatus({
      score: 68,
      signalsUsed: ["sleep was adequate at 6h 50m"],
      sourceFreshness: [
        freshness("Sleep", "stale"),
        freshness("HRV", "missing"),
      ],
    });

    expect(status.status).toBe("yellow");
    expect(status.confidence).toBeLessThan(0.75);
    expect(status.staleSignalsIgnored).toEqual(["Sleep is stale"]);
    expect(status.missingSignals).toEqual(["HRV is missing"]);
    expect(status.conservativeAdjustmentReason).toMatch(/stale or missing/i);
    expect(status.ui.label).toBe("Yellow");
    expect(status.ui.color).toBe("warm");
  });

  it("maps low readiness to red recovery guidance", () => {
    const status = buildReadinessStatus({
      score: 42,
      signalsUsed: ["sleep was short at 5h 20m", "resting HR is up 8 bpm"],
      sourceFreshness: [],
    });

    expect(status.status).toBe("red");
    expect(status.confidence).toBeGreaterThanOrEqual(0.7);
    expect(status.ui.label).toBe("Red");
    expect(status.ui.color).toBe("warm");
    expect(status.ui.title).toMatch(/recovery/i);
  });

  it("treats unknown as conservative when only partial or no data exists", () => {
    const status = buildReadinessStatus({
      score: null,
      signalsUsed: [],
      sourceFreshness: [
        freshness("Sleep", "missing"),
        freshness("HRV", "missing"),
        freshness("Resting HR", "missing"),
      ],
    });

    expect(status.status).toBe("unknown");
    expect(status.confidence).toBeLessThanOrEqual(0.25);
    expect(status.score).toBeNull();
    expect(status.missingSignals).toEqual([
      "Sleep is missing",
      "HRV is missing",
      "Resting HR is missing",
    ]);
    expect(status.conservativeAdjustmentReason).toMatch(/unknown readiness/i);
    expect(status.ui.label).toBe("Unknown");
    expect(status.ui.color).toBe("warm");
    expect(status.ui.detail).toMatch(/easy/i);
  });

  it("treats partial synced data with no usable readiness signals as unknown", () => {
    const status = buildReadinessStatus({
      score: 56,
      signalsUsed: [],
      sourceFreshness: [
        freshness("Sleep", "partial"),
        freshness("HRV", "missing"),
      ],
    });

    expect(status.status).toBe("unknown");
    expect(status.score).toBeNull();
    expect(status.confidence).toBeLessThanOrEqual(0.25);
    expect(status.signalsUsed).toEqual([]);
    expect(status.conservativeAdjustmentReason).toMatch(/enough usable/i);
  });

  it("does not report stale or missing freshness explanations as used signals", () => {
    const status = buildReadinessStatus({
      score: 68,
      signalsUsed: [
        "sleep was adequate at 6h 50m",
        "Sleep is stale",
        "HRV is missing",
      ],
      sourceFreshness: [
        freshness("Sleep", "stale"),
        freshness("HRV", "missing"),
      ],
    });

    expect(status.signalsUsed).toEqual(["sleep was adequate at 6h 50m"]);
    expect(status.staleSignalsIgnored).toEqual(["Sleep is stale"]);
    expect(status.missingSignals).toEqual(["HRV is missing"]);
  });
});
