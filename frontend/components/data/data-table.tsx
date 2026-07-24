import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { MobileRecordList } from './mobile-record-list';

export type DataTableColumn<T> = {
  key: string;
  title: string;
  style: StyleProp<ViewStyle>;
  headerAlign?: 'left' | 'center' | 'right';
  renderCell: (item: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  footer?: ReactNode;
  emptyIcon: string;
  emptyText: string;
  emptyTitle: string;
  error: string;
  keyExtractor: (item: T) => string;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  onRowPress?: (item: T) => void;
  rowStyle?: StyleProp<ViewStyle>;
  rowAccessibilityLabel?: (item: T) => string;
  showHeader?: boolean;
};

export function DataTable<T>({
  columns,
  data,
  footer,
  emptyIcon,
  emptyText,
  emptyTitle,
  error,
  keyExtractor,
  loading,
  refreshing,
  onRefresh,
  onRetry,
  onRowPress,
  rowStyle,
  rowAccessibilityLabel,
  showHeader = true,
}: DataTableProps<T>) {
  const shouldRenderHeader = showHeader && !loading && !error && data.length > 0;

  return (
    <View style={styles.table}>
      {shouldRenderHeader ? (
        <View accessibilityRole="header" style={styles.header}>
          {columns.map((column) => (
            <View key={column.key} style={[styles.cell, column.style]}>
              <Text style={[styles.headerText, { textAlign: column.headerAlign ?? 'left' }]}>
                {column.title}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <MobileRecordList
        data={data}
        footer={footer ? <>{footer}</> : undefined}
        emptyIcon={emptyIcon}
        emptyText={emptyText}
        emptyTitle={emptyTitle}
        error={error}
        keyExtractor={keyExtractor}
        loading={loading}
        onRefresh={onRefresh}
        onRetry={onRetry}
        refreshing={refreshing}
        renderItem={(item) => (
          <Pressable
            accessibilityLabel={rowAccessibilityLabel?.(item)}
            accessibilityRole={onRowPress ? 'button' : undefined}
            onPress={onRowPress ? () => onRowPress(item) : undefined}
            style={styles.rowButton}
          >
            {({ pressed }) => (
              <View style={[styles.row, rowStyle, pressed && onRowPress && styles.rowPressed]}>
                {columns.map((column) => (
                  <View key={column.key} style={[styles.cell, column.style]}>
                    {column.renderCell(item)}
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  table: { flex: 1 },
  header: {
    minHeight: 38,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#D8D3DA',
    backgroundColor: '#EEEAF0',
  },
  headerText: {
    color: '#625A67',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  rowButton: { width: '100%' },
  row: {
    width: '100%',
    minHeight: 112,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#D8D3DA',
    backgroundColor: '#FFFFFF',
  },
  rowPressed: { backgroundColor: '#F2EDF4' },
  cell: { justifyContent: 'center' },
});
