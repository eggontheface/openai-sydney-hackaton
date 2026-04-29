import type { SyncRange } from "./types";

export function splitSyncRangeByDays(
  range: SyncRange,
  maxDays: number,
): SyncRange[] {
  if (!Number.isFinite(maxDays) || maxDays <= 0) {
    throw new Error("maxDays must be greater than zero");
  }

  const endMs = range.endDate.getTime();
  const chunks: SyncRange[] = [];
  let chunkStart = new Date(range.startDate);

  while (chunkStart.getTime() < endMs) {
    const chunkEnd = new Date(chunkStart);
    chunkEnd.setDate(chunkEnd.getDate() + maxDays);

    const boundedEnd =
      chunkEnd.getTime() < endMs ? chunkEnd : new Date(range.endDate);

    chunks.push({
      startDate: new Date(chunkStart),
      endDate: boundedEnd,
    });

    chunkStart = new Date(boundedEnd);
  }

  return chunks.length
    ? chunks
    : [
        {
          startDate: new Date(range.startDate),
          endDate: new Date(range.endDate),
        },
      ];
}
