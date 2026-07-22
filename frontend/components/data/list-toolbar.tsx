import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { ListPagination } from './list-pagination';
import { ListSearch, type ListFilterOption } from './list-search';

type ListToolbarProps = {
  title: string;
  page: number;
  pageSize: number;
  totalItems: number;
  query: string;
  activeFilterIds: string[];
  filterOptions: ListFilterOption[];
  onCreate?: () => void;
  onPageChange: (page: number) => void;
  onQueryChange: (query: string) => void;
  onToggleFilter: (filterId: string) => void;
};

export function ListToolbar({
  title,
  page,
  pageSize,
  totalItems,
  query,
  activeFilterIds,
  filterOptions,
  onCreate,
  onPageChange,
  onQueryChange,
  onToggleFilter,
}: ListToolbarProps) {
  const [searchVisible, setSearchVisible] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.toolbarRow}>
        <View style={styles.headingRow}>
          {onCreate ? (
            <Button buttonColor="#73547B" compact icon="plus" mode="contained" onPress={onCreate}>
              Nuevo
            </Button>
          ) : null}
          <Text style={styles.heading}>{title}</Text>
        </View>
        <View style={styles.pagination}>
          <ListPagination
            onPageChange={onPageChange}
            onSearchPress={() => setSearchVisible((visible) => !visible)}
            page={page}
            pageSize={pageSize}
            searchActive={searchVisible || Boolean(query.trim()) || activeFilterIds.length > 0}
            totalItems={totalItems}
          />
        </View>
      </View>
      {searchVisible ? (
        <ListSearch
          activeFilterIds={activeFilterIds}
          filterOptions={filterOptions}
          onQueryChange={onQueryChange}
          onToggleFilter={onToggleFilter}
          query={query}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#DED9E0',
    backgroundColor: '#FFFFFF',
  },
  toolbarRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  pagination: { marginLeft: 'auto' },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heading: { color: '#332D36', fontSize: 20, fontWeight: '800' },
});
