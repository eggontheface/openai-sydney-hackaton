export type AppSettings = {
  hasOpenAiApiKey: boolean;
  openAiApiKeySource: 'secure_store' | 'local_storage' | 'env' | null;
  defaultSyncRangeDays: number;
};

type StoredAppSettings = {
  defaultSyncRangeDays?: number;
};

const openAiApiKeyStorageKey = 'biostream.openai_api_key';
const appSettingsStorageKey = 'biostream.local_settings';
const fallbackSettings: StoredAppSettings = {
  defaultSyncRangeDays: 365,
};
const allowedSyncRanges = new Set([7, 30, 365]);

function readEnvOpenAiApiKey(): string | null {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim();
  return apiKey || null;
}

function readLocalStorage(key: string): string | null {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
}

function writeLocalStorage(key: string, value: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
  }
}

function removeLocalStorage(key: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
  }
}

function normalizeSettings(settings: StoredAppSettings): StoredAppSettings {
  const defaultSyncRangeDays = allowedSyncRanges.has(Number(settings.defaultSyncRangeDays))
    ? Number(settings.defaultSyncRangeDays)
    : fallbackSettings.defaultSyncRangeDays;

  return {
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
  const envApiKey = readEnvOpenAiApiKey();

  return {
    hasOpenAiApiKey: Boolean(apiKey || envApiKey),
    openAiApiKeySource: apiKey ? 'local_storage' : envApiKey ? 'env' : null,
    defaultSyncRangeDays: settings.defaultSyncRangeDays ?? 365,
  };
}

export async function saveAppSettings(settings: Partial<StoredAppSettings>): Promise<AppSettings> {
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
    throw new Error('Enter an API key before saving.');
  }

  writeLocalStorage(openAiApiKeyStorageKey, trimmed);
  return loadAppSettings();
}

export async function clearOpenAiApiKey(): Promise<AppSettings> {
  removeLocalStorage(openAiApiKeyStorageKey);
  return loadAppSettings();
}

export async function readOpenAiApiKey(): Promise<string | null> {
  return readLocalStorage(openAiApiKeyStorageKey) ?? readEnvOpenAiApiKey();
}
