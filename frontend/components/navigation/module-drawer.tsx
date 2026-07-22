import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MenuItem, MenuModule } from '../../config/menu';
import { getInitials } from '../layout/app-header';

type ModuleDrawerProps = {
  module: MenuModule;
  selectedItemId?: string;
  user?: { name: string; email: string } | null;
  visible: boolean;
  onApplicationsPress: () => void;
  onClose: () => void;
  onItemPress: (item: MenuItem) => void;
  onLogoutPress: () => void;
};

export function ModuleDrawer({
  module,
  selectedItemId,
  user,
  visible,
  onApplicationsPress,
  onClose,
  onItemPress,
  onLogoutPress,
}: ModuleDrawerProps) {
  const groups = module.items.reduce<Record<string, MenuItem[]>>((result, item) => {
    (result[item.group] ??= []).push(item);
    return result;
  }, {});

  return (
    <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
      <View style={styles.modal}>
        <Pressable accessibilityLabel="Cerrar menú" onPress={onClose} style={styles.backdrop} />
        <SafeAreaView edges={['top', 'bottom']} style={styles.drawer}>
          <View style={styles.header}>
            <View style={[styles.moduleIcon, { backgroundColor: module.softColor }]}>
              <Icon source={module.icon} color={module.color} size={28} />
            </View>
            <Text numberOfLines={1} style={styles.moduleName}>
              {module.title}
            </Text>
            <Pressable accessibilityLabel="Cerrar menú" hitSlop={8} onPress={onClose} style={styles.close}>
              <Icon source="close" color="#5F5863" size={23} />
            </Pressable>
          </View>

          <Pressable onPress={onApplicationsPress} style={styles.applicationsItem}>
            <View style={styles.applicationsIcon}>
              <Icon source="view-grid-outline" color="#73547B" size={22} />
            </View>
            <Text style={styles.applicationsText}>Aplicaciones</Text>
            <Icon source="chevron-right" color="#AAA3AD" size={21} />
          </Pressable>

          <View style={styles.divider} />
          <ScrollView contentContainerStyle={styles.menuList} showsVerticalScrollIndicator={false}>
            {Object.entries(groups).map(([group, items]) => (
              <View key={group} style={styles.group}>
                <Text style={styles.label}>{group.toUpperCase()}</Text>
                {items.map((item) => {
                  const active = item.id === selectedItemId;

                  return (
                    <Pressable
                      accessibilityState={{ selected: active }}
                      key={item.id}
                      onPress={() => onItemPress(item)}
                      style={[styles.item, active && styles.itemActive]}
                    >
                      <Icon source={item.icon} color={active ? module.color : '#716A75'} size={22} />
                      <Text
                        numberOfLines={1}
                        style={[styles.itemText, active && { color: module.color, fontWeight: '800' }]}
                      >
                        {item.title}
                      </Text>
                      {item.badge ? <Text style={styles.badge}>{item.badge}</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <View style={styles.userDivider} />
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
            </View>
            <View style={styles.userCopy}>
              <Text numberOfLines={1} style={styles.userName}>
                {user?.name || 'Usuario'}
              </Text>
              <Text numberOfLines={1} style={styles.userEmail}>
                {user?.email}
              </Text>
            </View>
            <Pressable accessibilityLabel="Cerrar sesión" hitSlop={8} onPress={onLogoutPress} style={styles.logout}>
              <Icon source="logout" color="#BE485D" size={22} />
            </Pressable>
          </View>
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
    width: '86%',
    maxWidth: 360,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
  },
  header: { height: 72, flexDirection: 'row', alignItems: 'center' },
  moduleIcon: {
    width: 43,
    height: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  moduleName: {
    flex: 1,
    marginLeft: 12,
    color: '#342C37',
    fontSize: 19,
    fontWeight: '800',
  },
  close: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  applicationsItem: {
    minHeight: 58,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#F5F1F6',
  },
  applicationsIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  applicationsText: { flex: 1, marginLeft: 11, color: '#59445E', fontSize: 14, fontWeight: '800' },
  divider: { height: 1, marginVertical: 20, backgroundColor: '#EEE9EF' },
  label: {
    marginBottom: 9,
    marginLeft: 12,
    color: '#A39CA6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  menuList: { gap: 18, paddingBottom: 16 },
  group: { gap: 3 },
  item: {
    minHeight: 50,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 13,
  },
  itemActive: { backgroundColor: '#F0EAF2' },
  itemText: { flex: 1, color: '#625B66', fontSize: 14, fontWeight: '600' },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
    borderRadius: 8,
    color: '#684770',
    backgroundColor: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  userDivider: { height: 1, backgroundColor: '#EEE9EF' },
  userRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#73547B',
  },
  avatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  userCopy: { flex: 1, marginLeft: 11 },
  userName: { color: '#382F3B', fontSize: 12, fontWeight: '800' },
  userEmail: { marginTop: 2, color: '#918A94', fontSize: 10 },
  logout: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
