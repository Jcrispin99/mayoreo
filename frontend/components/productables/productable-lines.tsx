import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

export type ProductableLineView = {
  key: number | string;
  productName: string;
  sku?: string;
  details: string[];
  subtotal: number | null;
};

type ProductableLinesProps = {
  addDisabled?: boolean;
  emptyText: string;
  emptyTitle: string;
  lines: ProductableLineView[];
  onAdd?: () => void;
  onOpen?: (key: ProductableLineView['key']) => void;
  readOnly?: boolean;
  showTotal?: boolean;
  total?: number;
  totalLabel?: string;
};

function money(value: number) {
  return `S/ ${value.toFixed(2)}`;
}

export function ProductableLines({
  addDisabled = false,
  emptyText,
  emptyTitle,
  lines,
  onAdd,
  onOpen,
  readOnly = false,
  showTotal = true,
  total,
  totalLabel = 'Total',
}: ProductableLinesProps) {
  const displayedTotal = total ?? lines.reduce(
    (sum, line) => sum + (line.subtotal ?? 0),
    0,
  );

  return (
    <View style={styles.container}>
      {!readOnly && onAdd ? (
        <Button
          buttonColor="#EAEFEE"
          disabled={addDisabled}
          mode="contained"
          onPress={onAdd}
          textColor="#172423"
        >
          Agregar
        </Button>
      ) : null}

      {lines.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      ) : lines.map((line) => (
        <Pressable
          accessibilityLabel={onOpen ? `${readOnly ? 'Ver' : 'Editar'} ${line.productName}` : undefined}
          accessibilityRole={onOpen ? 'button' : undefined}
          disabled={!onOpen}
          key={line.key}
          onPress={() => onOpen?.(line.key)}
          style={({ pressed }) => [
            styles.card,
            pressed && onOpen && styles.cardPressed,
          ]}
        >
          <View style={styles.cardHeader}>
            <Text numberOfLines={2} style={styles.productName}>{line.productName}</Text>
            <Text style={styles.subtotal}>
              {line.subtotal === null ? '—' : money(line.subtotal)}
            </Text>
          </View>
          {line.sku ? <Text style={styles.sku}>{line.sku}</Text> : null}
          <View style={styles.details}>
            {line.details.map((detail, index) => (
              <Text key={`${line.key}-${index}`} style={styles.detail}>{detail}</Text>
            ))}
          </View>
        </Pressable>
      ))}

      {showTotal && lines.length > 0 ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{totalLabel}</Text>
          <Text style={styles.totalValue}>{money(displayedTotal)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  empty: { paddingVertical: 36, paddingHorizontal: 20, alignItems: 'center', borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 8, backgroundColor: '#FFFFFF' },
  emptyTitle: { color: '#172423', fontSize: 14, fontWeight: '800' },
  emptyText: { marginTop: 5, textAlign: 'center', color: '#60706E', fontSize: 11, lineHeight: 17 },
  card: { padding: 16, borderWidth: 1, borderColor: '#D8DADF', backgroundColor: '#FFFFFF' },
  cardPressed: { backgroundColor: '#F7F2F7', borderColor: '#879692' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  productName: { flex: 1, color: '#172423', fontSize: 13, fontWeight: '900', lineHeight: 19 },
  subtotal: { color: '#172423', fontSize: 13, fontWeight: '900' },
  sku: { marginTop: 3, color: '#60706E', fontSize: 10, fontWeight: '700' },
  details: { marginTop: 17, gap: 10 },
  detail: { color: '#6B7380', fontSize: 12 },
  totalRow: { paddingTop: 15, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#D7E0DE' },
  totalLabel: { color: '#172423', fontSize: 16, fontWeight: '800' },
  totalValue: { color: '#B4232D', fontSize: 19, fontWeight: '900' },
});
