import axios from 'axios';
import { Platform } from 'react-native';

// 10.0.2.2 is the Android emulator's alias for the host machine's localhost.
// Release builds read EXPO_PUBLIC_API_URL from .env.production (inlined at bundle time).
const ANDROID_EMULATOR_HOST = 'http://10.0.2.2:8000/api/v1';
const DEFAULT_HOST = 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL:
    process.env.EXPO_PUBLIC_API_URL ??
    (Platform.OS === 'android' ? ANDROID_EMULATOR_HOST : DEFAULT_HOST),
  headers: { Accept: 'application/json' },
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}
