import { Platform } from 'react-native';

import type { HealthProvider, SyncRange, SyncResult } from './types';

export function currentHealthProviderId(): HealthProvider | undefined {
  if (Platform.OS === 'ios') {
    return 'healthkit';
  }

  if (Platform.OS === 'android') {
    return 'health_connect';
  }

  return undefined;
}

export function currentHealthProviderLabel(): string {
  if (Platform.OS === 'ios') {
    return 'Apple Health';
  }

  if (Platform.OS === 'android') {
    return 'Health Connect';
  }

  return 'Unsupported platform';
}

export async function syncCurrentPlatform(range: SyncRange): Promise<SyncResult> {
  if (Platform.OS === 'ios') {
    const { syncAppleHealth } = await import('./appleHealth');
    return syncAppleHealth(range);
  }

  if (Platform.OS === 'android') {
    const { syncHealthConnect } = await import('./healthConnect');
    return syncHealthConnect(range);
  }

  throw new Error('Health data import is only available on iOS and Android dev builds.');
}

export async function openCurrentPlatformHealthSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    const { openAndroidHealthSettings } = await import('./healthConnect');
    return openAndroidHealthSettings();
  }

  throw new Error('Health settings are only available on Android dev builds.');
}
