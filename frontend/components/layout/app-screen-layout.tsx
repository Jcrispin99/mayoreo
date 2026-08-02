import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../../theme/colors';
import { AppHeader } from './app-header';

type AppScreenLayoutProps = {
  children: ReactNode;
  icon?: string;
  iconColor?: string;
  title: string;
  userName?: string;
  onApplicationsPress?: () => void;
  onMenuPress?: () => void;
  onNotificationsPress?: () => void;
  onProfilePress?: () => void;
};

export function AppScreenLayout({
  children,
  icon,
  iconColor,
  title,
  userName,
  onApplicationsPress,
  onMenuPress,
  onNotificationsPress,
  onProfilePress,
}: AppScreenLayoutProps) {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <AppHeader
        icon={icon}
        iconColor={iconColor}
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
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1 },
});
