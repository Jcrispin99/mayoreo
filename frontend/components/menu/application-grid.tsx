import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import type { MenuModule } from '../../config/menu';

type ApplicationGridProps = {
  modules: MenuModule[];
  onModulePress: (module: MenuModule) => void;
  title?: string;
};

export function ApplicationGrid({ modules, onModulePress, title = 'Aplicaciones' }: ApplicationGridProps) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.grid}>
        {modules.map((module) => (
          <Pressable
            accessibilityHint={`Abrir el módulo ${module.title}`}
            accessibilityRole="button"
            key={module.id}
            onPress={() => onModulePress(module)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={[styles.iconTile, { backgroundColor: module.softColor }]}>
              <Icon source={module.icon} color={module.color} size={34} />
            </View>
            <Text numberOfLines={2} style={styles.title}>
              {module.title}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    marginTop: 30,
    marginBottom: 20,
    color: '#37313A',
    fontSize: 17,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    rowGap: 24,
  },
  card: {
    width: '18%',
    minHeight: 100,
    paddingHorizontal: 4,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 16,
  },
  cardPressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  iconTile: {
    width: 52,
    height: 52,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  title: {
    color: '#4A434D',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
