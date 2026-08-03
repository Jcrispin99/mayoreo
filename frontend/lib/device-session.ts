import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEVICE_ID_STORAGE_KEY = 'mayoreo.auth.device-id';

function buildGeneratedDeviceId(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);

  return `generated-${Platform.OS}-${Date.now().toString(36)}-${randomPart}`;
}

async function resolveNativeDeviceId(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      return Application.getAndroidId();
    }

    if (Platform.OS === 'ios') {
      return await Application.getIosIdForVendorAsync();
    }
  } catch {
    // Fall back to a persisted app-generated identifier when the OS value is unavailable.
  }

  return null;
}

export async function getPersistentDeviceId(): Promise<string> {
  const storedDeviceId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (storedDeviceId) {
    return storedDeviceId;
  }

  const nativeDeviceId = await resolveNativeDeviceId();
  const deviceId = nativeDeviceId && nativeDeviceId.trim() !== '' ? nativeDeviceId : buildGeneratedDeviceId();

  await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);

  return deviceId;
}

export function getDeviceName(): string {
  const appName = Application.applicationName?.trim() || 'Mayoreo';
  const rawDeviceName = typeof Constants.deviceName === 'string' ? Constants.deviceName.trim() : '';
  const platformName = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web';

  return rawDeviceName !== '' ? `${rawDeviceName} · ${appName}` : `${appName} (${platformName})`;
}
