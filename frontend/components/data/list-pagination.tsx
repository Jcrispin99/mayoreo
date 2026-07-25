import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

type ListPaginationProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onSearchPress?: () => void;
  searchActive?: boolean;
};

export function ListPagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onSearchPress,
  searchActive = false,
}: ListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const firstItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <View style={styles.container}>
      <Text style={styles.counter}>{firstItem}–{lastItem} / {totalItems}</Text>
      <View style={styles.navigation}>
        <Pressable
          accessibilityLabel="Página anterior"
          accessibilityRole="button"
          disabled={currentPage <= 1}
          onPress={() => onPageChange(currentPage - 1)}
          style={({ pressed }) => [styles.navigationButton, pressed && styles.pressed]}
        >
          <Icon source="chevron-left" color={currentPage <= 1 ? '#B9B3BC' : '#60706E'} size={23} />
        </Pressable>
        <View style={styles.separator} />
        <Pressable
          accessibilityLabel="Página siguiente"
          accessibilityRole="button"
          disabled={currentPage >= totalPages}
          onPress={() => onPageChange(currentPage + 1)}
          style={({ pressed }) => [styles.navigationButton, pressed && styles.pressed]}
        >
          <Icon source="chevron-right" color={currentPage >= totalPages ? '#B9B3BC' : '#60706E'} size={23} />
        </Pressable>
      </View>
      <Pressable
        accessibilityLabel="Buscar"
        accessibilityRole="button"
        onPress={onSearchPress ?? (() => undefined)}
        style={({ pressed }) => [styles.searchButton, searchActive && styles.searchActive, pressed && styles.searchPressed]}
      >
        <Icon source="magnify" color="#172423" size={21} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  counter: { color: '#334155', fontSize: 13, fontVariant: ['tabular-nums'] },
  navigation: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: '#EAEFEE',
  },
  navigationButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  separator: { width: 1, height: '100%', backgroundColor: '#D2D6DC' },
  pressed: { backgroundColor: '#DDE0E5' },
  searchButton: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DFE2E7',
    borderRadius: 4,
    backgroundColor: '#EAEFEE',
  },
  searchPressed: { borderColor: '#B4232D', backgroundColor: '#FFE5E5' },
  searchActive: { borderColor: '#B4232D', backgroundColor: '#FFE5E5' },
});
