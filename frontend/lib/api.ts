import axios from 'axios';
import { Platform } from 'react-native';

// 10.0.2.2 is the Android emulator's alias for the host machine's localhost.
// On a physical device, replace with your Mac's LAN IP (e.g. http://192.168.1.50:8000/api/v1).
const ANDROID_EMULATOR_HOST = 'http://10.0.2.2:8000/api/v1';
const DEFAULT_HOST = 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: Platform.OS === 'android' ? ANDROID_EMULATOR_HOST : DEFAULT_HOST,
  headers: { Accept: 'application/json' },
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}
