import { Platform } from 'react-native';

import { syncAppleHealth } from './appleHealth';
import { syncHealthConnect } from './healthConnect';
import type { HealthProvider, SyncRange, SyncResult } from './types';

export function currentHealthProviderId(): HealthProvider | undefined {
  if (Platform.OS === 'ios') {
    return 'apple_health';
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
    return syncAppleHealth(range);
  }

  if (Platform.OS === 'android') {
    return syncHealthConnect(range);
  }

  throw new Error('Health data import is only available on iOS and Android dev builds.');
}
