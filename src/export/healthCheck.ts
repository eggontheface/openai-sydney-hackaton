import type { PipelineSnapshot, SourceFreshness } from "../health/types";

export type HealthCheckMarkdownOptions = {
  generatedAt?: string | Date;
};

function isoString(value: string | Date | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? new Date().toISOString();
}

function countLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function fallbackDetail(source: SourceFreshness): string {
  switch (source.state) {
    case "missing":
      return "No local data is available for this domain.";
    case "partial":
      return "Coverage is incomplete for this domain.";
    case "stale":
      return "The latest local data is older than the freshness window.";
    case "fresh":
    default:
      return "No limitation was recorded.";
  }
}

function sourceDetail(source: SourceFreshness): string {
  return source.limitations.length
    ? source.limitations.join(" ")
    : fallbackDetail(source);
}

function sourceCoverageLine(source: SourceFreshness): string {
  const latest = source.latestLocalDate ?? "no latest date";
  const age =
    source.ageDays == null ? "" : `; age ${countLabel(source.ageDays, "day")}`;

  return `- ${source.label}: ${source.state}; latest ${latest}; ${countLabel(
    source.dayCount,
    "day",
  )}; ${countLabel(source.sampleCount, "sample")}${age}.`;
}

function staleLine(source: SourceFreshness): string {
  const latest = source.latestLocalDate
    ? `${source.label} last updated on ${source.latestLocalDate}`
    : `${source.label} has no latest local date`;
  const age =
    source.ageDays == null ? "" : `, ${countLabel(source.ageDays, "day")} ago`;

  return `- ${latest}${age}: ${sourceDetail(source)}`;
}

function missingLine(source: SourceFreshness): string {
  return `- ${source.label} is missing: ${sourceDetail(source)}`;
}

function partialLine(source: SourceFreshness): string {
  return `- ${source.label} is partial: ${sourceDetail(source)}`;
}

function missingCheckIns(sourceFreshness: SourceFreshness[]): boolean {
  return sourceFreshness.some(
    (source) => source.domain === "check_ins" && source.state === "missing",
  );
}

function hasLocalHealthData(snapshot: PipelineSnapshot): boolean {
  return Boolean(
    snapshot.totalSamples ||
    snapshot.workoutCount ||
    snapshot.sleepCount ||
    snapshot.nutritionDays ||
    snapshot.coverageDays,
  );
}

function section(title: string, lines: string[]): string[] {
  return [`## ${title}`, ...lines, ""];
}

export function generateHealthCheckMarkdown(
  snapshot: PipelineSnapshot,
  options: HealthCheckMarkdownOptions = {},
): string {
  const generatedAt = isoString(options.generatedAt);
  const localDataAvailable = hasLocalHealthData(snapshot);
  const partialSources = snapshot.sourceFreshness.filter(
    (source) => source.state === "partial",
  );
  const staleSources = snapshot.sourceFreshness.filter(
    (source) => source.state === "stale",
  );
  const missingSources = snapshot.sourceFreshness.filter(
    (source) => source.state === "missing",
  );

  const known: string[] = localDataAvailable
    ? [
        `- Pipeline coverage: ${countLabel(snapshot.coverageDays, "day")}, ${countLabel(
          snapshot.totalSamples,
          "sample",
        )}, ${countLabel(snapshot.workoutCount, "workout")}, ${countLabel(
          snapshot.sleepCount,
          "sleep day",
        )}, ${countLabel(snapshot.nutritionDays, "nutrition day")}.`,
      ]
    : ["- Pipeline coverage: no local health data is available."];

  if (snapshot.today) {
    known.push(
      `- Today: ${snapshot.today.date}, ${snapshot.today.dataCompleteness} completeness, ${countLabel(
        snapshot.today.sourceCount,
        "active source domain",
      )}.`,
    );
  } else {
    known.push("- Today: no daily rollup is available.");
  }

  const readiness = snapshot.recommendation.readiness;
  const readinessScore = readiness == null ? "" : ` (${readiness}/100)`;
  known.push(
    `- Readiness estimate: ${snapshot.recommendation.readinessLabel}${readinessScore}, target strain ${snapshot.recommendation.strainTarget}.`,
  );

  const sourceCoverage = snapshot.sourceFreshness.length
    ? snapshot.sourceFreshness.map(sourceCoverageLine)
    : ["- Source freshness rows are unavailable."];

  const uncertain = partialSources.map(partialLine);
  if (!snapshot.sourceFreshness.length) {
    uncertain.push("- Source freshness rows are unavailable.");
  }
  if (snapshot.today?.dataCompleteness === "partial") {
    uncertain.push(
      "- Today is partial, so current-day totals may change after the next sync.",
    );
  }
  if (snapshot.recommendation.readiness == null) {
    uncertain.push("- Readiness estimate is unknown from local data.");
  }
  if (!uncertain.length) {
    uncertain.push(
      "- No uncertainty flags were found in local snapshot metadata.",
    );
  }

  const stale = staleSources.length
    ? staleSources.map(staleLine)
    : ["- No stale domains were reported."];

  const risky: string[] = [];
  if (staleSources.length || missingSources.length) {
    risky.push(
      "- Stale or missing domains reduce confidence; avoid using this export as proof of current readiness.",
    );
  }
  if (missingCheckIns(snapshot.sourceFreshness)) {
    risky.push(
      "- No daily check-in is available; subjective fatigue, soreness, pain, illness, and motivation are unknown.",
    );
  }
  if (!localDataAvailable) {
    risky.push(
      "- Local health data is missing; recommendations should stay conservative.",
    );
  }
  if (!risky.length) {
    risky.push("- No local risk-confidence flags were found.");
  }

  const missing = missingSources.map(missingLine);
  if (!snapshot.sourceFreshness.length) {
    missing.push("- No source coverage dates are available.");
  }
  if (!localDataAvailable) {
    missing.push(
      "- Local health data is missing; recommendations should stay conservative.",
    );
  }
  if (!missing.length) {
    missing.push("- No missing source domains were reported.");
  }

  const lines = [
    "# health_check.md",
    "",
    `Generated at: ${generatedAt}`,
    "",
    "This file is generated locally from the pipeline snapshot. It summarizes data coverage and confidence only.",
    "",
    ...section("Known", known),
    ...section("Source Coverage", sourceCoverage),
    ...section("Uncertain", uncertain),
    ...section("Stale", stale),
    ...section("Risky", risky),
    ...section("Missing", missing),
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}
