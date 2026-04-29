import type { PipelineSnapshot } from "../health/types";
import { safeJsonStringify } from "../lib/json";
import { generateHealthCheckMarkdown } from "./healthCheck";
import { buildLlmBundle, type LlmBundleOptions } from "./llmBundle";

export type PipelineExportArtifactOptions = {
  exportedAt?: string | Date;
  timestamp?: number;
  llmBundle?: LlmBundleOptions;
};

export type PipelineExportArtifacts = {
  exportedAt: string;
  jsonFileName: string;
  healthCheckFileName: string;
  llmBundleFileName: string;
  healthCheckMarkdown: string;
  llmBundleJson: string;
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
    llmBundleFileName: `llm_bundle-${timestamp}.json`,
    healthCheckMarkdown: generateHealthCheckMarkdown(snapshot, {
      generatedAt: exportedAt,
    }),
    llmBundleJson: safeJsonStringify(
      buildLlmBundle(snapshot, {
        ...options.llmBundle,
        exportedAt,
      }),
    ),
  };
}
