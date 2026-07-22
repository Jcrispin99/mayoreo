import '../global.css';

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth-context';
import type { Settings } from 'react-native-paper/lib/typescript/core/settings';

const paperSettings: Settings = {
  icon: ({ name, color, size }) => (
    <MaterialCommunityIcons name={name as never} color={color} size={size} />
  ),
};

const paperTheme = {
  ...MD3LightTheme,
  roundness: 1.6,
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider settings={paperSettings} theme={paperTheme}>
        <AuthProvider>
          <StatusBar style="auto" />
          <Slot />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
