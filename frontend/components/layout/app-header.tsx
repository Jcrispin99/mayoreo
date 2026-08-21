import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../theme/colors';

type AppHeaderProps = {
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

export function getInitials(name?: string) {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];

  if (words.length === 0) return 'U';

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

export function AppHeader({
  icon = 'view-grid-outline',
  iconColor = COLORS.primaryDark,
  title,
  userName,
  onApplicationsPress,
  onAttendanceMarkPress,
  onMenuPress,
  onNotificationsPress,
  notificationCount = 0,
  onProfilePress,
}: AppHeaderProps) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.bar}>
        <Pressable
          accessibilityLabel={onApplicationsPress ? 'Abrir aplicaciones' : 'Abrir menú'}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onApplicationsPress ?? onMenuPress}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Icon source={onApplicationsPress ? 'view-grid-outline' : 'menu'} color={COLORS.text} size={24} />
        </Pressable>

        <View style={[styles.brand, onAttendanceMarkPress && styles.brandWithAttendance]}>
          <View style={styles.brandMark}>
            <Icon source={icon} color={iconColor} size={18} />
          </View>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
        </View>

        <View style={styles.actions}>
          {onAttendanceMarkPress ? (
            <Pressable
              accessibilityLabel="Marcar asistencia con QR"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onAttendanceMarkPress}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Icon source="qrcode-scan" color={COLORS.text} size={24} />
            </Pressable>
          ) : null}
          {onNotificationsPress ? (
            <Pressable
              accessibilityLabel="Notificaciones"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onNotificationsPress}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Icon source="bell-outline" color={COLORS.text} size={23} />
              {notificationCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text adjustsFontSizeToFit numberOfLines={1} style={styles.notificationBadgeText}>
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
          {onProfilePress ? (
            <Pressable
              accessibilityLabel="Abrir perfil"
              accessibilityRole="button"
              onPress={onProfilePress}
              style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
            >
              <Text style={styles.avatarText}>{getInitials(userName)}</Text>
            </Pressable>
          ) : null}
          {onApplicationsPress && onMenuPress ? (
            <Pressable
              accessibilityLabel="Abrir menú del módulo"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onMenuPress}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Icon source="menu" color={COLORS.text} size={25} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: COLORS.surface },
  bar: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  pressed: { opacity: 0.68 },
  brand: {
    position: 'absolute',
    left: 68,
    right: 108,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  brandWithAttendance: { right: 196 },
  brandMark: {
    width: 31,
    height: 31,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: COLORS.primaryContainer,
  },
  title: {
    flexShrink: 1,
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  actions: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 1,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: COLORS.primaryDark,
    borderWidth: 1,
    borderColor: COLORS.surface,
  },
  notificationBadgeText: { color: COLORS.white, fontSize: 8, fontWeight: '900', textAlign: 'center' },
  avatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: COLORS.primaryContainer,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  avatarText: { color: COLORS.onPrimaryContainer, fontSize: 12, fontWeight: '800' },
});
