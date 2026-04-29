import { splitSyncRangeByDays } from "./ranges";

describe("splitSyncRangeByDays", () => {
  it("splits a long range into contiguous chunks", () => {
    const chunks = splitSyncRangeByDays(
      {
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-03-07T15:30:00.000Z"),
      },
      30,
    );

    expect(chunks.map((chunk) => chunk.startDate.toISOString())).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-01-31T00:00:00.000Z",
      "2026-03-02T00:00:00.000Z",
    ]);
    expect(chunks.map((chunk) => chunk.endDate.toISOString())).toEqual([
      "2026-01-31T00:00:00.000Z",
      "2026-03-02T00:00:00.000Z",
      "2026-03-07T15:30:00.000Z",
    ]);
  });

  it("keeps short ranges as a single chunk", () => {
    const range = {
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-08T12:00:00.000Z"),
    };

    expect(splitSyncRangeByDays(range, 30)).toEqual([
      {
        startDate: new Date(range.startDate),
        endDate: new Date(range.endDate),
      },
    ]);
  });

  it("rejects non-positive chunk sizes", () => {
    expect(() =>
      splitSyncRangeByDays(
        {
          startDate: new Date("2026-04-01T00:00:00.000Z"),
          endDate: new Date("2026-04-08T12:00:00.000Z"),
        },
        0,
      ),
    ).toThrow("maxDays must be greater than zero");
  });
});
