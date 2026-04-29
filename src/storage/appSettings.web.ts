import { resolveOpenAiApiKey } from "../config/openAiKeyFallback";
import type { OpenAiApiKeySource } from "../config/openAiKeyFallback";
import { localOpenAiApiKey } from "../config/localOpenAiApiKey.generated";

export type AppSettings = {
  hasOpenAiApiKey: boolean;
  openAiApiKeySource: OpenAiApiKeySource;
  defaultSyncRangeDays: number;
  athleteName: string | null;
};

type StoredAppSettings = {
  defaultSyncRangeDays?: number;
  athleteName?: string | null;
};

const openAiApiKeyStorageKey = "biostream.openai_api_key";
const appSettingsStorageKey = "biostream.local_settings";
const fallbackDefaultSyncRangeDays = 30;
const fallbackSettings: StoredAppSettings = {
  defaultSyncRangeDays: fallbackDefaultSyncRangeDays,
};
const allowedSyncRanges = new Set([7, 30, 365]);

function readLocalStorage(key: string): string | null {
  return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
}

function writeLocalStorage(key: string, value: string): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(key, value);
  }
}

function removeLocalStorage(key: string): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(key);
  }
}

function normalizeSettings(settings: StoredAppSettings): StoredAppSettings {
  const defaultSyncRangeDays = allowedSyncRanges.has(
    Number(settings.defaultSyncRangeDays),
  )
    ? Number(settings.defaultSyncRangeDays)
    : fallbackSettings.defaultSyncRangeDays;
  const athleteName =
    typeof settings.athleteName === "string" && settings.athleteName.trim()
      ? settings.athleteName.trim().slice(0, 80)
      : null;

  return {
    athleteName,
    defaultSyncRangeDays,
  };
}

async function loadStoredSettings(): Promise<StoredAppSettings> {
  const raw = readLocalStorage(appSettingsStorageKey);
  if (!raw) {
    return fallbackSettings;
  }

  try {
    return normalizeSettings(JSON.parse(raw) as StoredAppSettings);
  } catch {
    return fallbackSettings;
  }
}

export async function loadAppSettings(): Promise<AppSettings> {
  const settings = await loadStoredSettings();
  const apiKey = readLocalStorage(openAiApiKeyStorageKey);
  const activeApiKey = resolveOpenAiApiKey({
    storedApiKey: apiKey,
    storedSource: "local_storage",
    embeddedApiKey: localOpenAiApiKey,
  });

  return {
    athleteName: settings.athleteName ?? null,
    hasOpenAiApiKey: Boolean(activeApiKey.apiKey),
    openAiApiKeySource: activeApiKey.source,
    defaultSyncRangeDays:
      settings.defaultSyncRangeDays ?? fallbackDefaultSyncRangeDays,
  };
}

export async function saveAppSettings(
  settings: Partial<StoredAppSettings>,
): Promise<AppSettings> {
  const current = await loadStoredSettings();
  const next = normalizeSettings({
    ...current,
    ...settings,
  });

  writeLocalStorage(appSettingsStorageKey, JSON.stringify(next));
  return loadAppSettings();
}

export async function saveOpenAiApiKey(apiKey: string): Promise<AppSettings> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("Enter an API key before saving.");
  }

  writeLocalStorage(openAiApiKeyStorageKey, trimmed);
  return loadAppSettings();
}

export async function clearOpenAiApiKey(): Promise<AppSettings> {
  removeLocalStorage(openAiApiKeyStorageKey);
  return loadAppSettings();
}

export async function readOpenAiApiKey(): Promise<string | null> {
  return resolveOpenAiApiKey({
    storedApiKey: readLocalStorage(openAiApiKeyStorageKey),
    storedSource: "local_storage",
    embeddedApiKey: localOpenAiApiKey,
  }).apiKey;
}
