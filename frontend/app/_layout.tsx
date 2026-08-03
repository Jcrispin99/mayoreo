import '../global.css';

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth-context';
import { PriceNotificationsProvider } from '../lib/price-notifications-context';
import { paperTheme } from '../theme/colors';
import type { Settings } from 'react-native-paper/lib/typescript/core/settings';

const paperSettings: Settings = {
  icon: ({ name, color, size }) => (
    <MaterialCommunityIcons name={name as never} color={color} size={size} />
  ),
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider settings={paperSettings} theme={paperTheme}>
        <AuthProvider>
          <PriceNotificationsProvider>
            <StatusBar style="dark" />
            <Slot />
          </PriceNotificationsProvider>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
