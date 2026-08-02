import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Icon, Text, TextInput } from 'react-native-paper';

export type PickerProduct = {
  id: number;
  name: string;
  sku: string;
};

type ProductPickerListProps = {
  products: PickerProduct[];
  selectedId?: number | null;
  pageSize?: number;
  onSelect: (product: PickerProduct) => void;
};

/**
 * Selector de variante inline: busca por nombre o SKU y lista resultados
 * en tandas de `pageSize` (5 por defecto). Renderiza en la propia pantalla,
 * por lo que funciona dentro de modales nativos (donde el Menu de Paper no).
 */
export function ProductPickerList({ products, selectedId, pageSize = 5, onSelect }: ProductPickerListProps) {
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [pageSize, query]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    if (!normalized) return products;
    return products.filter((product) =>
      `${product.name} ${product.sku}`.toLocaleLowerCase('es').includes(normalized));
  }, [products, query]);

  const visible = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visible.length;

  return (
    <View style={styles.container}>
      <TextInput
        dense
        left={<TextInput.Icon icon="magnify" />}
        mode="flat"
        onChangeText={setQuery}
        placeholder="Buscar por nombre o SKU"
        style={styles.search}
        value={query}
      />

      {visible.length === 0 ? (
        <Text style={styles.empty}>
          {products.length === 0 ? 'No hay variantes disponibles.' : `Sin resultados para «${query.trim()}».`}
        </Text>
      ) : (
        <View style={styles.list}>
          {visible.map((product) => {
            const selected = product.id === selectedId;
            return (
              <Pressable
                accessibilityLabel={`Seleccionar ${product.name}`}
                key={product.id}
                onPress={() => onSelect(product)}
                style={[styles.row, selected && styles.rowSelected]}
              >
                <View style={styles.rowCopy}>
                  <Text numberOfLines={1} style={styles.rowName}>{product.name}</Text>
                  <Text numberOfLines={1} style={styles.rowSku}>{product.sku}</Text>
                </View>
                {selected ? <Icon source="check-circle" color="#B4232D" size={20} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}

      {remaining > 0 ? (
        <Button
          compact
          mode="text"
          onPress={() => setVisibleCount((current) => current + pageSize)}
          textColor="#B4232D"
        >
          {`Mostrar ${Math.min(pageSize, remaining)} más (${remaining} restantes)`}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  search: { backgroundColor: 'transparent' },
  empty: { paddingVertical: 10, color: '#60706E', fontSize: 13 },
  list: { borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 10, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  row: { minHeight: 52, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D7E0DE' },
  rowSelected: { backgroundColor: '#FCE8EA' },
  rowCopy: { flex: 1 },
  rowName: { color: '#172423', fontSize: 14, fontWeight: '700' },
  rowSku: { marginTop: 2, color: '#60706E', fontSize: 11 },
});
