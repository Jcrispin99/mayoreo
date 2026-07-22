import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

type MobileRecordListProps<T> = {
  data: T[];
  emptyIcon: string;
  emptyText: string;
  emptyTitle: string;
  error: string;
  keyExtractor: (item: T) => string;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  renderItem: (item: T) => ReactElement;
};

export function MobileRecordList<T>({
  data,
  emptyIcon,
  emptyText,
  emptyTitle,
  error,
  keyExtractor,
  loading,
  refreshing,
  onRefresh,
  onRetry,
  renderItem,
}: MobileRecordListProps<T>) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#73547B" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Icon source="cloud-alert-outline" color="#A24B5D" size={40} />
        <Text style={styles.error}>{error}</Text>
        <Button onPress={onRetry}>Reintentar</Button>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={data.length ? styles.list : styles.emptyList}
      data={data}
      keyExtractor={keyExtractor}
      refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} />}
      renderItem={({ item }) => renderItem(item)}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={styles.center}>
          <Icon source={emptyIcon} color="#9A8C9E" size={42} />
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 32 },
  emptyList: { flexGrow: 1 },
  center: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center' },
  error: { marginTop: 10, marginBottom: 6, color: '#8C3E4D', textAlign: 'center' },
  emptyTitle: { marginTop: 12, color: '#443C47', fontSize: 16, fontWeight: '800' },
  emptyText: { marginTop: 5, color: '#8C858F', fontSize: 12, textAlign: 'center' },
});
