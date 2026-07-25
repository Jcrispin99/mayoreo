import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import type { Product } from './purchase-types';
import type { PurchaseProductableDraft } from './purchase-productable-types';

type ProductableLinesProps = {
  items: PurchaseProductableDraft[];
  products: Product[];
  readOnly: boolean;
  onAdd: () => void;
  onOpen: (item: PurchaseProductableDraft) => void;
};

export function ProductableLines({ items, products, readOnly, onAdd, onOpen }: ProductableLinesProps) {
  const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0);

  return (
    <View style={styles.container}>
      {!readOnly ? (
        <Button buttonColor="#EAEFEE" mode="contained" onPress={onAdd} textColor="#172423">
          Agregar
        </Button>
      ) : null}

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Aún no hay productos</Text>
          <Text style={styles.emptyText}>Presiona “Agregar” para crear la primera línea de la compra.</Text>
        </View>
      ) : items.map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        const purchaseUnit = item.purchaseUnits.find((candidate) => candidate.id === item.purchaseUnitId);
        const unitName = purchaseUnit?.name ?? product?.base_unit?.name ?? 'Unidad base';
        const subtotal = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);

        return (
          <Pressable
            accessibilityLabel={`${readOnly ? 'Ver' : 'Editar'} ${product?.name ?? 'producto'}`}
            accessibilityRole="button"
            key={item.key}
            onPress={() => onOpen(item)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.cardHeader}>
              <Text numberOfLines={2} style={styles.productName}>{product?.name ?? `Producto #${item.productId}`}</Text>
              <Text style={styles.subtotal}>S/ {subtotal.toFixed(2)}</Text>
            </View>
            <Text style={styles.sku}>{product?.sku ?? ''}</Text>
            <View style={styles.details}>
              <Text style={styles.detail}>Cantidad: {Number(item.quantity).toFixed(2)} {unitName}</Text>
              <Text style={styles.detail}>Costo unitario: S/ {Number(item.unitCost).toFixed(2)}</Text>
            </View>
          </Pressable>
        );
      })}

      {items.length > 0 ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>S/ {total.toFixed(2)}</Text>
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
