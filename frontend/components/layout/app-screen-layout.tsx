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
  onAttendanceMarkPress?: () => void;
  onMenuPress?: () => void;
  onNotificationsPress?: () => void;
  notificationCount?: number;
  onProfilePress?: () => void;
};

export function AppScreenLayout({
  children,
  icon,
  iconColor,
  title,
  userName,
  onApplicationsPress,
  onAttendanceMarkPress,
  onMenuPress,
  onNotificationsPress,
  notificationCount,
  onProfilePress,
}: AppScreenLayoutProps) {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <AppHeader
        icon={icon}
        iconColor={iconColor}
        onApplicationsPress={onApplicationsPress}
        onAttendanceMarkPress={onAttendanceMarkPress}
        onMenuPress={onMenuPress}
        onNotificationsPress={onNotificationsPress}
        notificationCount={notificationCount}
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
