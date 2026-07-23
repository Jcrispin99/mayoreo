import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Divider, Icon, Menu, Text } from 'react-native-paper';

export type ListFilterOption = {
  id: string;
  label: string;
  group: string;
  icon?: string;
};

type ListSearchProps = {
  activeFilterIds: string[];
  filterOptions: ListFilterOption[];
  query: string;
  onQueryChange: (query: string) => void;
  onToggleFilter: (filterId: string) => void;
  collapsible?: boolean;
  collapsedAction?: ReactNode;
  expanded?: boolean;
  filterIcon?: string;
  filtersTitle?: string;
  onExpandedChange?: (expanded: boolean) => void;
  placeholder?: string;
  searchAccessibilityLabel?: string;
};

export function ListSearch({
  activeFilterIds,
  filterOptions,
  query,
  onQueryChange,
  onToggleFilter,
  collapsible = false,
  collapsedAction,
  expanded: controlledExpanded,
  filterIcon = 'menu-down',
  filtersTitle = 'Filtros',
  onExpandedChange,
  placeholder = 'Buscar...',
  searchAccessibilityLabel = 'Buscar registros',
}: ListSearchProps) {
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [internalExpanded, setInternalExpanded] = useState(!collapsible || Boolean(query));
  const expanded = controlledExpanded ?? internalExpanded;
  const activeOptions = filterOptions.filter((option) => activeFilterIds.includes(option.id));
  const groups = [...new Set(filterOptions.map((option) => option.group))];

  useEffect(() => {
    if (!collapsible || !query || expanded) return;
    setInternalExpanded(true);
    onExpandedChange?.(true);
  }, [collapsible, expanded, onExpandedChange, query]);

  if (collapsible && !expanded) {
    return (
      <View style={styles.container}>
        <View style={styles.collapsedActions}>
          <Pressable
            accessibilityLabel="Abrir buscador"
            accessibilityRole="button"
            onPress={() => {
              setInternalExpanded(true);
              onExpandedChange?.(true);
            }}
            style={styles.collapsedButton}
          >
            <Icon source="magnify" color="#465263" size={21} />
            {activeOptions.length > 0 ? (
              <View pointerEvents="none" style={styles.activeCount}>
                <Text style={styles.activeCountText}>{activeOptions.length}</Text>
              </View>
            ) : null}
          </Pressable>
          {collapsedAction}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Icon source="magnify" color="#465263" size={20} />
        <ScrollView
          contentContainerStyle={styles.searchContent}
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={styles.searchScroll}
        >
          {activeOptions.map((option) => (
            <Pressable
              accessibilityLabel={`Quitar filtro ${option.label}`}
              key={option.id}
              onPress={() => onToggleFilter(option.id)}
              style={styles.filterChip}
            >
              {option.icon ? <Icon source={option.icon} color="#493D20" size={15} /> : null}
              <Text style={styles.filterChipText}>{option.label}</Text>
              <Icon source="close" color="#687181" size={15} />
            </Pressable>
          ))}
          <TextInput
            accessibilityLabel={searchAccessibilityLabel}
            autoFocus={collapsible}
            onChangeText={onQueryChange}
            placeholder={placeholder}
            placeholderTextColor="#8A8F99"
            style={styles.input}
            value={query}
          />
        </ScrollView>

        {collapsible ? (
          <Pressable
            accessibilityLabel="Cerrar buscador"
            accessibilityRole="button"
            onPress={() => {
              onQueryChange('');
              setFiltersVisible(false);
              setInternalExpanded(false);
              onExpandedChange?.(false);
            }}
            style={styles.collapseButton}
          >
            <Icon source="close" color="#687181" size={19} />
          </Pressable>
        ) : null}

        <Menu
          anchor={
            <Pressable
              accessibilityLabel="Mostrar filtros"
              accessibilityRole="button"
              onPress={() => setFiltersVisible(true)}
              style={[styles.filterButton, (filtersVisible || activeOptions.length > 0) && styles.filterButtonActive]}
            >
              <Icon
                source={filterIcon}
                color={filtersVisible || activeOptions.length > 0 ? '#73547B' : '#243445'}
                size={21}
              />
            </Pressable>
          }
          anchorPosition="bottom"
          contentStyle={styles.menu}
          onDismiss={() => setFiltersVisible(false)}
          visible={filtersVisible}
        >
          <View style={styles.menuTitle}>
            <Icon source="filter-variant" color="#73547B" size={19} />
            <Text style={styles.menuTitleText}>{filtersTitle}</Text>
          </View>
          {filterOptions.length === 0 ? (
            <Text style={styles.noFilters}>No hay filtros disponibles.</Text>
          ) : groups.map((group, groupIndex) => (
            <View key={group}>
              {groupIndex > 0 ? <Divider /> : null}
              <Text style={styles.groupLabel}>{group}</Text>
              {filterOptions.filter((option) => option.group === group).map((option) => {
                const selected = activeFilterIds.includes(option.id);
                return (
                  <Menu.Item
                    key={option.id}
                    leadingIcon={selected ? 'check' : option.icon}
                    onPress={() => onToggleFilter(option.id)}
                    title={option.label}
                    titleStyle={selected ? styles.selectedOption : undefined}
                  />
                );
              })}
            </View>
          ))}
        </Menu>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12 },
  collapsedActions: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6 },
  collapsedButton: {
    position: 'relative',
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CDD2DA',
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
  },
  activeCount: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#D18A25' },
  activeCountText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  searchBox: {
    height: 42,
    paddingLeft: 11,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CDD2DA',
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  searchContent: { minWidth: '100%', alignItems: 'center', gap: 6, paddingLeft: 8 },
  searchScroll: { flex: 1 },
  input: { minWidth: 120, flexGrow: 1, height: 40, paddingHorizontal: 4, color: '#263244', fontSize: 13, outlineStyle: 'none' } as never,
  collapseButton: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center' },
  filterChip: {
    height: 28,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 4,
    backgroundColor: '#E9ECF0',
  },
  filterChipText: { color: '#344054', fontSize: 11, fontWeight: '700' },
  filterButton: {
    width: 42,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#CDD2DA',
    backgroundColor: '#F7F8FA',
  },
  filterButtonActive: { borderLeftColor: '#168C8C', backgroundColor: '#EFFAFA' },
  menu: { width: 280, maxHeight: 420, backgroundColor: '#FFFFFF' },
  menuTitle: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuTitleText: { color: '#2E3542', fontSize: 15, fontWeight: '800' },
  groupLabel: { paddingHorizontal: 16, paddingTop: 10, color: '#8A7F8D', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  selectedOption: { color: '#5E3D66', fontWeight: '800' },
  noFilters: { paddingHorizontal: 16, paddingBottom: 16, color: '#85808A', fontSize: 12 },
});
