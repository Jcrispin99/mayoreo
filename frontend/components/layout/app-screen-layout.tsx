import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from './app-header';

type AppScreenLayoutProps = {
  children: ReactNode;
  title: string;
  userName?: string;
  onApplicationsPress?: () => void;
  onMenuPress?: () => void;
  onNotificationsPress?: () => void;
  onProfilePress?: () => void;
};

export function AppScreenLayout({
  children,
  title,
  userName,
  onApplicationsPress,
  onMenuPress,
  onNotificationsPress,
  onProfilePress,
}: AppScreenLayoutProps) {
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <AppHeader
        onApplicationsPress={onApplicationsPress}
        onMenuPress={onMenuPress}
        onNotificationsPress={onNotificationsPress}
        onProfilePress={onProfilePress}
        title={title}
        userName={userName}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F5F8' },
  content: { flex: 1 },
});
