import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import type { MenuModule } from '../../config/menu';

type ApplicationGridProps = {
  modules: MenuModule[];
  onModulePress: (module: MenuModule) => void;
  title?: string;
};

export function ApplicationGrid({ modules, onModulePress, title = 'Aplicaciones' }: ApplicationGridProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const horizontalPadding = containerWidth >= 760 ? 56 : 24;
  const availableWidth = Math.max(0, containerWidth - (horizontalPadding * 2));
  const columns = availableWidth >= 1000
    ? 4
    : availableWidth >= 520
      ? 3
      : 2;
  const gap = availableWidth >= 520 ? 24 : 16;
  const cardWidth = availableWidth > 0
    ? Math.min(190, (availableWidth - (gap * (columns - 1))) / columns)
    : 0;

  function measureContainer(event: LayoutChangeEvent) {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth !== containerWidth) setContainerWidth(nextWidth);
  }

  return (
    <View
      onLayout={measureContainer}
      style={[styles.container, { paddingHorizontal: horizontalPadding }]}
    >
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={[styles.grid, { gap }]}>
        {modules.map((module) => (
          <Pressable
            accessibilityHint={`Abrir el módulo ${module.title}`}
            accessibilityRole="button"
            key={module.id}
            onPress={() => onModulePress(module)}
            style={({ pressed }) => [
              styles.card,
              cardWidth > 0 ? { width: cardWidth } : styles.cardPending,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={[styles.iconTile, { backgroundColor: module.softColor }]}>
              <Icon source={module.icon} color={module.color} size={30} />
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
  container: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
  },
  heading: {
    marginTop: 32,
    marginBottom: 30,
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#37313A',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.25,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  card: {
    minHeight: 142,
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DED8E1',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  cardPending: { width: '46%' },
  cardPressed: {
    opacity: 0.78,
    borderColor: '#C8BCCB',
    backgroundColor: '#F4F0F5',
    transform: [{ scale: 0.985 }],
  },
  iconTile: {
    width: 54,
    height: 54,
    marginBottom: 14,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  title: {
    width: '100%',
    minHeight: 30,
    paddingHorizontal: 4,
    color: '#3D3640',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
});
