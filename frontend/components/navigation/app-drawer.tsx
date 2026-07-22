import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getInitials } from '../layout/app-header';

type AppDrawerProps = {
  visible: boolean;
  user?: { name: string; email: string } | null;
  onClose: () => void;
  onHomePress: () => void;
  onSettingsPress: () => void;
  onHelpPress: () => void;
  onLogoutPress: () => void;
};

export function AppDrawer({
  visible,
  user,
  onClose,
  onHomePress,
  onSettingsPress,
  onHelpPress,
  onLogoutPress,
}: AppDrawerProps) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
      <View style={styles.modal}>
        <Pressable accessibilityLabel="Cerrar menú" onPress={onClose} style={styles.backdrop} />
        <SafeAreaView edges={['top', 'bottom']} style={styles.drawer}>
          <View style={styles.header}>
            <View style={styles.logo}>
              <Icon source="view-grid-outline" color="#FFFFFF" size={24} />
            </View>
            <Text style={styles.brand}>Mayoreo</Text>
            <Pressable accessibilityLabel="Cerrar menú" hitSlop={8} onPress={onClose} style={styles.close}>
              <Icon source="close" color="#5F5863" size={23} />
            </Pressable>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitials}>{getInitials(user?.name)}</Text>
            </View>
            <View style={styles.profileCopy}>
              <Text numberOfLines={1} style={styles.profileName}>
                {user?.name || 'Usuario'}
              </Text>
              <Text numberOfLines={1} style={styles.profileEmail}>
                {user?.email}
              </Text>
            </View>
          </View>

          <Text style={styles.label}>MENÚ</Text>
          <Pressable onPress={onHomePress} style={[styles.item, styles.itemActive]}>
            <Icon source="home-variant-outline" color="#73547B" size={23} />
            <Text style={styles.itemActiveText}>Inicio</Text>
          </Pressable>
          <Pressable onPress={onSettingsPress} style={styles.item}>
            <Icon source="cog-outline" color="#716A75" size={23} />
            <Text style={styles.itemText}>Configuración</Text>
          </Pressable>
          <Pressable onPress={onHelpPress} style={styles.item}>
            <Icon source="help-circle-outline" color="#716A75" size={23} />
            <Text style={styles.itemText}>Ayuda</Text>
          </Pressable>

          <View style={styles.spacer} />
          <View style={styles.divider} />
          <Pressable accessibilityRole="button" onPress={onLogoutPress} style={styles.item}>
            <Icon source="logout" color="#BE485D" size={23} />
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </Pressable>
          <Text style={styles.version}>Mayoreo móvil · v1.0</Text>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, flexDirection: 'row' },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(25, 18, 28, 0.48)',
  },
  drawer: {
    width: '84%',
    maxWidth: 350,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
  },
  header: { height: 67, flexDirection: 'row', alignItems: 'center' },
  logo: {
    width: 39,
    height: 39,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#62426F',
  },
  brand: { marginLeft: 11, color: '#342C37', fontSize: 20, fontWeight: '800' },
  close: {
    width: 38,
    height: 38,
    marginLeft: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    marginTop: 8,
    marginBottom: 27,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#F5F1F6',
  },
  profileAvatar: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#73547B',
  },
  profileInitials: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  profileCopy: { flex: 1, marginLeft: 12 },
  profileName: { color: '#382F3B', fontSize: 14, fontWeight: '800' },
  profileEmail: { marginTop: 3, color: '#887F8B', fontSize: 11 },
  label: {
    marginBottom: 9,
    marginLeft: 12,
    color: '#A39CA6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  item: {
    minHeight: 50,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 13,
  },
  itemActive: { backgroundColor: '#F0EAF2' },
  itemText: { color: '#625B66', fontSize: 14, fontWeight: '600' },
  itemActiveText: { color: '#684770', fontSize: 14, fontWeight: '800' },
  spacer: { flex: 1, minHeight: 24 },
  divider: { height: 1, marginBottom: 5, backgroundColor: '#EEE9EF' },
  logoutText: { color: '#B74559', fontSize: 14, fontWeight: '700' },
  version: {
    marginTop: 10,
    marginBottom: 4,
    color: '#AEA7B0',
    fontSize: 10,
    textAlign: 'center',
  },
});
