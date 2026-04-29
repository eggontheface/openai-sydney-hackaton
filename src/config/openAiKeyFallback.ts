export type StoredOpenAiApiKeySource = "secure_store" | "local_storage";
export type OpenAiApiKeySource = StoredOpenAiApiKeySource | "embedded" | null;

type ResolveOpenAiApiKeyOptions = {
  storedApiKey: unknown;
  storedSource: StoredOpenAiApiKeySource;
  embeddedApiKey: unknown;
};

export function normalizeOpenAiApiKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function resolveOpenAiApiKey({
  storedApiKey,
  storedSource,
  embeddedApiKey,
}: ResolveOpenAiApiKeyOptions): {
  apiKey: string | null;
  source: OpenAiApiKeySource;
} {
  const savedApiKey = normalizeOpenAiApiKey(storedApiKey);
  if (savedApiKey) {
    return {
      apiKey: savedApiKey,
      source: storedSource,
    };
  }

  const fallbackApiKey = normalizeOpenAiApiKey(embeddedApiKey);
  if (fallbackApiKey) {
    return {
      apiKey: fallbackApiKey,
      source: "embedded",
    };
  }

  return {
    apiKey: null,
    source: null,
  };
}
