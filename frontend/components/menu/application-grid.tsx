import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import type { MenuModule } from '../../config/menu';
import { COLORS } from '../../theme/colors';

type ApplicationGridProps = {
  modules: MenuModule[];
  onModulePress: (module: MenuModule) => void;
  title?: string;
};

export function ApplicationGrid({ modules, onModulePress, title = 'Aplicaciones' }: ApplicationGridProps) {
  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.grid}>
        {modules.map((module) => (
          <Pressable
            accessibilityHint={`Abrir el módulo ${module.title}`}
            accessibilityRole="button"
            android_ripple={{ color: module.softColor }}
            key={module.id}
            onPress={() => onModulePress(module)}
            style={[styles.card, { backgroundColor: module.color }]}
          >
            <View style={[styles.iconTile, { borderLeftColor: module.color }]}>
              <Icon source={module.icon} color={module.color} size={28} />
            </View>
            <Text numberOfLines={2} style={styles.title}>{module.title}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 720,
    paddingHorizontal: 20,
    alignSelf: 'center',
  },
  heading: {
    marginTop: 32,
    marginBottom: 24,
    alignItems: 'center',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.25,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  card: {
    width: '48%',
    height: 56,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
  },
  iconTile: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderLeftWidth: 1,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
  },
  title: {
    flex: 1,
    marginLeft: 10,
    color: COLORS.onPrimary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
});
