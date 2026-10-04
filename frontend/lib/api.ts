import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// 10.0.2.2 is the Android emulator's alias for the host machine's localhost.
// Release builds read EXPO_PUBLIC_API_URL from .env.production (inlined at bundle time).
const ANDROID_EMULATOR_HOST = 'http://10.0.2.2:8000/api/v1';
const DEFAULT_HOST = 'http://localhost:8000/api/v1';

function developmentApiHost(): string | null {
  if (!__DEV__) return null;

  const metroHost = Constants.expoConfig?.hostUri
    ?.replace(/^https?:\/\//, '')
    .split(':')[0];

  return metroHost ? `http://${metroHost}:8000/api/v1` : null;
}

export const api = axios.create({
  baseURL:
    process.env.EXPO_PUBLIC_API_URL ??
    developmentApiHost() ??
    (Platform.OS === 'android' ? ANDROID_EMULATOR_HOST : DEFAULT_HOST),
  headers: { Accept: 'application/json' },
  timeout: 15_000,
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

/**
 * Mensaje de error para listas/pantallas: distingue la falta de permisos (403)
 * de fallas genéricas de red o servidor.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error) && error.response?.status === 403) {
    return 'No tienes permisos para ver esta sección. Contacta a un administrador.';
  }
  return fallback;
}
