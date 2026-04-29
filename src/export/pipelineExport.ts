import type { PipelineSnapshot } from "../health/types";
import { generateHealthCheckMarkdown } from "./healthCheck";

export type PipelineExportArtifactOptions = {
  exportedAt?: string | Date;
  timestamp?: number;
};

export type PipelineExportArtifacts = {
  exportedAt: string;
  jsonFileName: string;
  healthCheckFileName: string;
  healthCheckMarkdown: string;
};

function isoString(value: string | Date | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? new Date().toISOString();
}

export function buildPipelineExportArtifacts(
  snapshot: PipelineSnapshot,
  options: PipelineExportArtifactOptions = {},
): PipelineExportArtifacts {
  const exportedAt = isoString(options.exportedAt);
  const timestamp = options.timestamp ?? Date.now();

  return {
    exportedAt,
    jsonFileName: `biostream-pipeline-${timestamp}.json`,
    healthCheckFileName: `health_check-${timestamp}.md`,
    healthCheckMarkdown: generateHealthCheckMarkdown(snapshot, {
      generatedAt: exportedAt,
    }),
  };
}
