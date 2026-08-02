import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MenuModule } from '../../config/menu';
import { COLORS } from '../../theme/colors';
import { ApplicationGrid } from '../menu/application-grid';

type ApplicationSwitcherProps = {
  modules: MenuModule[];
  visible: boolean;
  onClose: () => void;
  onModulePress: (module: MenuModule) => void;
};

export function ApplicationSwitcher({ modules, visible, onClose, onModulePress }: ApplicationSwitcherProps) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent={false} visible={visible}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <Icon source="view-grid-outline" color={COLORS.onPrimary} size={23} />
          </View>
          <Text style={styles.title}>Aplicaciones</Text>
          <Pressable accessibilityLabel="Cerrar aplicaciones" onPress={onClose} style={styles.close}>
            <Icon source="close" color={COLORS.textMuted} size={25} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ApplicationGrid modules={modules} onModulePress={onModulePress} title="Selecciona una aplicación" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: {
    height: 66,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  logo: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  title: { flex: 1, marginLeft: 12, color: COLORS.text, fontSize: 19, fontWeight: '800' },
  close: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 40 },
});
