import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { ActivityIndicator, Button, Checkbox, Icon, Menu, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { ListSearch } from '../../components/data/list-search';
import { api, apiErrorMessage } from '../../lib/api';
import { COLORS, MODULE_COLORS } from '../../theme/colors';
import type { Supplier } from './purchase-types';

type PurchaseUnit = {
  id: number;
  name: string;
  conversion_factor: string | number;
  is_default_purchase?: boolean;
};

type ProductVariant = {
  id: number;
  sku: string;
  variant_name: string | null;
  display_name?: string;
  is_active: boolean;
  is_principal: boolean;
  base_unit?: { id: number; code: string; name: string } | null;
  purchase_units?: PurchaseUnit[];
};

type ProductTemplate = {
  id: number;
  name: string;
  is_active: boolean;
  variants: ProductVariant[];
};

type SupplierOffer = {
  id: number;
  supplierId: number;
  variantId: number;
  productPurchaseUnitId: number | null;
  originalPrice: number;
  originalUnit: string;
  comparisonPrice: number;
  comparisonUnit: string;
  orderedAt: string;
  notes?: string | null;
};

type SupplierPriceProduct = {
  id: number;
  template_name: string;
  variant_name: string | null;
  sku: string;
  base_unit: { id: number; code: string; name: string } | null;
  purchase_units: PurchaseUnit[];
  prices: Array<{
    id: number;
    supplier_id: number;
    unit_cost: string | number;
    original_unit: string;
    product_purchase_unit_id: number | null;
    comparison_price: number;
    comparison_unit: string;
    quoted_at: string;
    notes?: string | null;
  }>;
};

type Pagination = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

type ComparisonFilter = 'all' | 'priced' | 'missing';

const FILTERS: Array<{ id: ComparisonFilter; label: string; icon: string }> = [
  { id: 'all', label: 'Todos', icon: 'view-list-outline' },
  { id: 'priced', label: 'Con precio', icon: 'cash-check' },
  { id: 'missing', label: 'Sin precio', icon: 'cash-remove' },
];

const moneyFormatter = new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function moneyAmount(value: number) {
  return moneyFormatter.format(value);
}

function comparisonUnit(variant: ProductVariant) {
  const code = variant.base_unit?.code.trim().toLocaleLowerCase('es') ?? 'un.';
  if (code === 'g' || code === 'gr') return { factor: 1000, label: 'kg' };
  if (code === 'ml') return { factor: 1000, label: 'L' };
  return { factor: 1, label: variant.base_unit?.code || 'un.' };
}

function freshnessLabel(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  const difference = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (difference === 0) return 'Hoy';
  if (difference === 1) return 'Ayer';
  if (difference < 30) return `Hace ${difference} días`;
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function variantName(variant: ProductVariant) {
  return variant.variant_name || (variant.is_principal ? 'Variante principal' : variant.display_name) || 'Sin nombre';
}

function supplierInitials(name: string) {
  const ignoredWords = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
  const words = name
    .replace(/\([^)]*\)/g, '')
    .trim()
    .split(/\s+/)
    .filter((word) => word && !ignoredWords.has(word.toLocaleLowerCase('es')));

  if (words.length === 0) return 'PR';
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase('es');
  return `${words[0][0]}${words[1][0]}`.toLocaleUpperCase('es');
}

export function SupplierPriceComparison() {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const [templates, setTemplates] = useState<ProductTemplate[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [offers, setOffers] = useState<Map<string, SupplierOffer>>(new Map());
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);
  const [draftSupplierIds, setDraftSupplierIds] = useState<number[]>([]);
  const [inspectedSupplierId, setInspectedSupplierId] = useState<number | null>(null);
  const [supplierSelectionVisible, setSupplierSelectionVisible] = useState(false);
  const [editingPrice, setEditingPrice] = useState<{
    variant: ProductVariant;
    supplier: Supplier;
    offer?: SupplierOffer;
  } | null>(null);
  const [priceCost, setPriceCost] = useState('');
  const [pricePurchaseUnitId, setPricePurchaseUnitId] = useState<number | null>(null);
  const [priceQuotedAt, setPriceQuotedAt] = useState('');
  const [priceNotes, setPriceNotes] = useState('');
  const [priceUnitMenuVisible, setPriceUnitMenuVisible] = useState(false);
  const [savingPrice, setSavingPrice] = useState(false);
  const [priceError, setPriceError] = useState('');
  const [filter, setFilter] = useState<ComparisonFilter>('priced');
  const [query, setQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    current_page: 1,
    last_page: 1,
    per_page: 12,
    total: 0,
    from: null,
    to: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadSuppliers = useCallback(async () => {
    try {
      const response = await api.get('/supplier-product-prices/suppliers');
      const loadedSuppliers = (response.data.data ?? []) as Supplier[];
      setSuppliers(loadedSuppliers);
      setSelectedSupplierIds((current) => {
        const availableIds = new Set(loadedSuppliers.map((supplier) => supplier.id));
        return current.filter((id) => availableIds.has(id));
      });
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudieron cargar los proveedores.'));
    }
  }, []);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');

    try {
      const response = await api.get('/supplier-product-prices', {
        params: {
          page,
          per_page: 12,
          search: debouncedQuery || undefined,
          filter: ['priced', 'missing'].includes(filter) ? filter : 'all',
          supplier_ids: selectedSupplierIds.length > 0 ? selectedSupplierIds.join(',') : undefined,
        },
      });
      const payload = response.data.data as { items: SupplierPriceProduct[]; pagination: Pagination };
      const nextOffers = new Map<string, SupplierOffer>();
      const nextTemplates = payload.items.map((item): ProductTemplate => {
        item.prices.forEach((price) => nextOffers.set(`${item.id}:${price.supplier_id}`, {
          id: price.id,
          supplierId: price.supplier_id,
          variantId: item.id,
          productPurchaseUnitId: price.product_purchase_unit_id,
          originalPrice: Number(price.unit_cost),
          originalUnit: price.original_unit,
          comparisonPrice: Number(price.comparison_price),
          comparisonUnit: price.comparison_unit,
          orderedAt: price.quoted_at,
          notes: price.notes,
        }));

        return {
          id: item.id,
          name: item.template_name,
          is_active: true,
          variants: [{
            id: item.id,
            sku: item.sku,
            variant_name: item.variant_name,
            is_active: true,
            is_principal: false,
            base_unit: item.base_unit,
            display_name: item.template_name,
            purchase_units: item.purchase_units,
          }],
        };
      });

      setTemplates(nextTemplates);
      setOffers(nextOffers);
      setPagination(payload.pagination);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudo cargar el comparador de precios.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedQuery, filter, page, selectedSupplierIds]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, filter, selectedSupplierIds]);

  const inspectedSupplier = suppliers.find((supplier) => supplier.id === inspectedSupplierId) ?? null;
  const selectedSuppliers = useMemo(
    () => suppliers.filter((supplier) => selectedSupplierIds.includes(supplier.id)),
    [selectedSupplierIds, suppliers],
  );
  const showingBestPrices = selectedSupplierIds.length === 0;
  const consideredSupplierIds = useMemo(
    () => new Set(showingBestPrices ? suppliers.map((supplier) => supplier.id) : selectedSupplierIds),
    [selectedSupplierIds, showingBestPrices, suppliers],
  );
  const consideredOffersByVariant = useMemo(() => {
    const grouped = new Map<number, SupplierOffer[]>();
    offers.forEach((offer) => {
      if (!consideredSupplierIds.has(offer.supplierId)) return;
      const current = grouped.get(offer.variantId) ?? [];
      current.push(offer);
      grouped.set(offer.variantId, current.sort((first, second) => first.comparisonPrice - second.comparisonPrice));
    });
    return grouped;
  }, [consideredSupplierIds, offers]);

  const visibleTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');

    return templates.map((template) => {
      const templateMatches = template.name.toLocaleLowerCase('es').includes(normalizedQuery);
      const variants = template.variants.filter((variant) => {
        if (!variant.is_active) return false;
        const matchesQuery = !normalizedQuery || templateMatches
          || `${variantName(variant)} ${variant.sku}`.toLocaleLowerCase('es').includes(normalizedQuery);
        if (!matchesQuery) return false;

        const bestOffer = consideredOffersByVariant.get(variant.id)?.[0];
        if (filter === 'priced') return Boolean(bestOffer);
        if (filter === 'missing') return !bestOffer;
        return true;
      });

      return { ...template, variants };
    }).filter((template) => template.variants.length > 0);
  }, [consideredOffersByVariant, filter, query, templates]);
  const visibleVariantRows = useMemo(
    () => visibleTemplates.flatMap((template) => template.variants.map((variant) => ({ template, variant }))),
    [visibleTemplates],
  );

  const inspectedSupplierSummary = useMemo(() => {
    if (inspectedSupplierId === null) return null;
    const supplierOffers = Array.from(offers.values())
      .filter((offer) => offer.supplierId === inspectedSupplierId)
      .sort((first, second) => second.orderedAt.localeCompare(first.orderedAt));

    return {
      products: supplierOffers.length,
      lastQuote: supplierOffers[0]?.orderedAt,
    };
  }, [inspectedSupplierId, offers]);

  function openPriceEditor(variant: ProductVariant, supplierId: number, offer?: SupplierOffer) {
    const supplier = suppliers.find((item) => item.id === supplierId);
    if (!supplier) return;

    const defaultUnit = variant.purchase_units?.find((unit) => unit.is_default_purchase)
      ?? variant.purchase_units?.[0];
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');

    setEditingPrice({ variant, supplier, offer });
    setPriceCost(offer ? String(offer.originalPrice) : '');
    setPricePurchaseUnitId(offer?.productPurchaseUnitId ?? defaultUnit?.id ?? null);
    setPriceQuotedAt(offer?.orderedAt ?? today);
    setPriceNotes(offer?.notes ?? '');
    setPriceError('');
  }

  async function savePrice() {
    if (!editingPrice) return;
    const numericCost = Number(priceCost.replace(',', '.'));
    if (!Number.isFinite(numericCost) || numericCost <= 0) {
      setPriceError('Ingresa un precio mayor que cero.');
      return;
    }
    if (!priceQuotedAt) {
      setPriceError('Ingresa la fecha del precio.');
      return;
    }

    setSavingPrice(true);
    setPriceError('');
    try {
      await api.post('/supplier-product-prices', {
        supplier_id: editingPrice.supplier.id,
        product_id: editingPrice.variant.id,
        product_purchase_unit_id: pricePurchaseUnitId,
        unit_cost: numericCost,
        quoted_at: priceQuotedAt,
        notes: priceNotes.trim() || null,
      });
      setEditingPrice(null);
      await load(true);
    } catch (requestError) {
      setPriceError(apiErrorMessage(requestError, 'No se pudo guardar el precio.'));
    } finally {
      setSavingPrice(false);
    }
  }

  function renderSupplierMatrix() {
    const productColumnWidth = compact ? 148 : 210;
    const supplierColumnWidth = compact ? 56 : 66;
    const bestSupplierColumnWidth = compact ? 180 : 240;
    const matrixSuppliers = selectedSuppliers;
    const supplierColumnCount = showingBestPrices ? 1 : matrixSuppliers.length;
    const supplierTableWidth = showingBestPrices
      ? supplierColumnWidth + bestSupplierColumnWidth
      : Math.max(supplierColumnCount * supplierColumnWidth, supplierColumnWidth);

    function renderMatrixCell(
      variant: ProductVariant,
      offer: SupplierOffer | undefined,
      key: string | number,
      targetSupplierId?: number,
    ) {
      const bestOffer = consideredOffersByVariant.get(variant.id)?.[0];
      const best = Boolean(showingBestPrices && offer && bestOffer
        && offer.comparisonPrice === bestOffer.comparisonPrice);

      const editableSupplierId = targetSupplierId ?? offer?.supplierId;

      return (
        <View
          key={key}
          style={[styles.matrixPriceSlot, { width: supplierColumnWidth }]}
        >
          <Pressable
            accessibilityHint="Mantén presionado un segundo para editar el precio"
            accessibilityLabel={offer ? `Precio ${moneyAmount(offer.comparisonPrice)}` : 'Sin precio registrado'}
            accessibilityRole="button"
            delayLongPress={1000}
            onLongPress={() => {
              if (editableSupplierId !== undefined) openPriceEditor(variant, editableSupplierId, offer);
            }}
            style={({ pressed }) => [
              styles.matrixOfferCell,
              best && styles.matrixBestCell,
              pressed && editableSupplierId !== undefined && styles.matrixCellPressed,
            ]}
          >
            {offer ? (
              <>
                <View style={styles.matrixPriceRow}>
                  <Text numberOfLines={1} style={[styles.matrixPrice, best && styles.matrixBestPrice]}>
                    {moneyAmount(offer.comparisonPrice)}
                  </Text>
                </View>
                <Text numberOfLines={1} style={styles.matrixPriceUnit}>por {offer.comparisonUnit}</Text>
                <Text numberOfLines={1} style={styles.matrixQuoteMeta}>
                  {freshnessLabel(offer.orderedAt)}
                </Text>
              </>
            ) : (
              <View style={styles.matrixMissingPrice}>
                <Icon color={COLORS.textSubtle} size={13} source="minus" />
                <Text numberOfLines={1} style={styles.matrixMissingText}>Sin precio</Text>
              </View>
            )}
          </Pressable>
        </View>
      );
    }

    function renderBestSupplierCell(offer: SupplierOffer | undefined, key: string) {
      const supplier = offer
        ? suppliers.find((item) => item.id === offer.supplierId)
        : undefined;

      return (
        <View key={key} style={[styles.matrixBestSupplierSlot, { width: bestSupplierColumnWidth }]}>
          {supplier ? (
            <View style={styles.matrixBestSupplierCell}>
              <Text
                numberOfLines={3}
                style={[styles.matrixBestSupplierName, { width: bestSupplierColumnWidth - 20 }]}
              >
                {supplier.name}
              </Text>
            </View>
          ) : (
            <View style={styles.matrixBestSupplierCell}>
              <Icon color={COLORS.textSubtle} size={13} source="minus" />
              <Text style={styles.matrixMissingText}>Sin proveedor</Text>
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={styles.matrixCard}>
        <View style={styles.matrixLayout}>
          <View style={[styles.matrixProductPane, { width: productColumnWidth }]}>
            <View style={styles.matrixProductHeader}>
              <Text style={styles.matrixHeaderEyebrow}>CATÁLOGO</Text>
              <Text style={styles.matrixProductHeaderTitle}>Producto / variante</Text>
            </View>
            {visibleVariantRows.map(({ template, variant }) => (
              <View key={variant.id} style={styles.matrixProductRow}>
                <Text numberOfLines={2} style={styles.matrixVariantName}>
                  {template.name}
                  {variant.variant_name ? ` · ${variant.variant_name}` : ''}
                </Text>
                <Text numberOfLines={1} style={styles.matrixVariantMeta}>
                  {variant.sku} · {comparisonUnit(variant).label}
                </Text>
              </View>
            ))}
          </View>

          <ScrollView
            bounces={false}
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator
            style={styles.matrixSupplierScroll}
          >
            <View style={[styles.matrixSupplierTable, { width: supplierTableWidth }]}>
              <View style={[styles.matrixSupplierHeaderRow, { width: supplierTableWidth }]}>
                {showingBestPrices ? (
                  <>
                    <View
                      style={[styles.matrixSupplierSlot, { width: supplierColumnWidth }]}
                    >
                      <View style={styles.matrixSupplierHeader}>
                        <View style={styles.matrixSupplierInitials}>
                          <Icon color={MODULE_COLORS.purchases.color} size={17} source="star-circle-outline" />
                        </View>
                        <Text style={styles.matrixCurrency}>S/</Text>
                      </View>
                    </View>
                    <View
                      style={[styles.matrixSupplierSlot, { width: bestSupplierColumnWidth }]}
                    >
                      <View style={styles.matrixBestSupplierHeader}>
                        <Icon color={MODULE_COLORS.purchases.color} size={16} source="truck-outline" />
                        <Text style={styles.matrixBestSupplierHeaderText}>Proveedor</Text>
                      </View>
                    </View>
                  </>
                ) : matrixSuppliers.map((supplier) => (
                  <View
                    key={supplier.id}
                    style={[styles.matrixSupplierSlot, { width: supplierColumnWidth }]}
                  >
                    <Pressable
                      accessibilityLabel={`Ver datos de ${supplier.name}`}
                      accessibilityRole="button"
                      onPress={() => setInspectedSupplierId(supplier.id)}
                      style={({ pressed }) => [styles.matrixSupplierHeader, pressed && styles.pressed]}
                    >
                      <View style={styles.matrixSupplierInitials}>
                        <Text style={styles.matrixSupplierInitialsText}>{supplierInitials(supplier.name)}</Text>
                      </View>
                      <Text style={styles.matrixCurrency}>S/</Text>
                    </Pressable>
                  </View>
                ))}
              </View>

              {visibleVariantRows.map(({ variant }) => (
                <View
                  key={variant.id}
                  style={[styles.matrixOfferRow, { width: supplierTableWidth }]}
                >
                  {showingBestPrices
                    ? (
                      <>
                        {renderMatrixCell(
                          variant,
                          consideredOffersByVariant.get(variant.id)?.[0],
                          `best-${variant.id}`,
                        )}
                        {renderBestSupplierCell(
                          consideredOffersByVariant.get(variant.id)?.[0],
                          `best-supplier-${variant.id}`,
                        )}
                      </>
                    )
                    : matrixSuppliers.map((supplier) => renderMatrixCell(
                      variant,
                      offers.get(`${variant.id}:${supplier.id}`),
                      `${supplier.id}-${variant.id}`,
                      supplier.id,
                    ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  const editingPurchaseUnit = editingPrice?.variant.purchase_units?.find(
    (unit) => unit.id === pricePurchaseUnitId,
  );

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={MODULE_COLORS.purchases.color} size="large" />
        <Text style={styles.stateText}>Preparando el comparador...</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
      contentContainerStyle={styles.content}
      data={[] as ProductTemplate[]}
      keyExtractor={(item) => String(item.id)}
      ListEmptyComponent={visibleTemplates.length > 0 ? null : (
        <View style={styles.emptyState}>
          <Icon color={COLORS.textMuted} size={42} source={error ? 'alert-circle-outline' : 'magnify-close'} />
          <Text style={styles.emptyTitle}>{error ? 'No se pudo cargar' : 'Sin coincidencias'}</Text>
          <Text style={styles.stateText}>{error || 'Prueba con otro texto o cambia los filtros.'}</Text>
          {error ? <Button mode="outlined" onPress={() => void load()}>Reintentar</Button> : null}
        </View>
      )}
      ListHeaderComponent={(
        <View style={styles.headerContent}>
          <View style={styles.searchPanel}>
            <ScrollView
              contentContainerStyle={styles.filters}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {FILTERS.map((item) => {
                const active = filter === item.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={item.id}
                    onPress={() => setFilter(item.id)}
                    style={({ pressed }) => [
                      styles.filterButton,
                      active && styles.filterButtonActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Icon color={active ? COLORS.onPrimaryContainer : COLORS.textMuted} size={16} source={item.icon} />
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.resultsHeader}>
            <View style={styles.resultsTitleGroup}>
              <Text style={styles.resultsTitle}>Productos y variantes</Text>
              <Pressable
                accessibilityLabel={selectedSuppliers.length > 0
                  ? `${selectedSuppliers.length} proveedores seleccionados`
                  : 'Seleccionar proveedores'}
                accessibilityRole="button"
                onPress={() => {
                  setDraftSupplierIds(selectedSupplierIds);
                  setSupplierSelectionVisible(true);
                }}
                style={({ pressed }) => [
                  styles.supplierIconButton,
                  selectedSuppliers.length > 0 && styles.supplierIconButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <Icon
                  color={selectedSuppliers.length > 0 ? MODULE_COLORS.purchases.color : COLORS.textMuted}
                  size={21}
                  source="truck-outline"
                />
              </Pressable>
              <Pressable
                accessibilityLabel="Mostrar mejores precios"
                accessibilityRole="button"
                onPress={() => setSelectedSupplierIds([])}
                style={({ pressed }) => [
                  styles.supplierIconButton,
                  showingBestPrices && styles.supplierIconButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <Icon
                  color={showingBestPrices ? MODULE_COLORS.purchases.color : COLORS.textMuted}
                  size={21}
                  source="star-outline"
                />
              </Pressable>
            </View>
            <View style={styles.resultsActions}>
              <Pressable
                accessibilityLabel="Buscar productos"
                accessibilityRole="button"
                onPress={() => setSearchExpanded((expanded) => !expanded)}
                style={({ pressed }) => [
                  styles.resultsSearchButton,
                  (searchExpanded || Boolean(query.trim())) && styles.resultsSearchButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <Icon color={COLORS.text} size={21} source="magnify" />
              </Pressable>
              <Text style={styles.resultsCount}>
                {pagination.total === 0
                  ? '0 productos'
                  : `${pagination.from}–${pagination.to} de ${pagination.total}`}
              </Text>
            </View>
          </View>
          {searchExpanded ? (
            <View style={styles.expandedSearch}>
              <ListSearch
                activeFilterIds={[]}
                collapsible
                expanded={searchExpanded}
                filterOptions={[]}
                onExpandedChange={setSearchExpanded}
                onQueryChange={setQuery}
                onToggleFilter={() => undefined}
                placeholder="Buscar producto, variante o SKU"
                query={query}
                searchAccessibilityLabel="Buscar producto, variante o SKU"
                showFilters={false}
              />
            </View>
          ) : null}
          {visibleTemplates.length > 0 ? renderSupplierMatrix() : null}
          {pagination.last_page > 1 ? (
            <View style={styles.paginationBar}>
              <Button
                compact
                disabled={pagination.current_page <= 1 || loading}
                icon="chevron-left"
                mode="outlined"
                onPress={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </Button>
              <Text style={styles.paginationText}>
                Página {pagination.current_page} de {pagination.last_page}
              </Text>
              <Button
                compact
                contentStyle={styles.nextPageButton}
                disabled={pagination.current_page >= pagination.last_page || loading}
                icon="chevron-right"
                mode="outlined"
                onPress={() => setPage((current) => Math.min(pagination.last_page, current + 1))}
              >
                Siguiente
              </Button>
            </View>
          ) : null}
        </View>
      )}
      refreshControl={(
        <RefreshControl
          colors={[MODULE_COLORS.purchases.color]}
          onRefresh={() => void load(true)}
          refreshing={refreshing}
          tintColor={MODULE_COLORS.purchases.color}
        />
      )}
      renderItem={() => null}
      />
      <Portal>
        <Modal
          contentContainerStyle={styles.priceModal}
          dismissable={!savingPrice}
          onDismiss={() => setEditingPrice(null)}
          visible={editingPrice !== null}
        >
          {editingPrice ? (
            <View style={styles.priceModalContent}>
              <View>
                <Text style={styles.supplierModalEyebrow}>
                  {editingPrice.offer ? 'ACTUALIZAR PRECIO' : 'AGREGAR PRECIO'}
                </Text>
                <Text style={styles.supplierModalTitle}>{editingPrice.variant.display_name}</Text>
                <Text style={styles.priceModalSupplier}>{editingPrice.supplier.name}</Text>
              </View>

              <View style={styles.priceModalFields}>
                <Menu
                  anchor={(
                    <Pressable
                      accessibilityLabel="Seleccionar presentación de compra"
                      accessibilityRole="button"
                      onPress={() => setPriceUnitMenuVisible(true)}
                      style={({ pressed }) => [styles.priceUnitSelector, pressed && styles.pressed]}
                    >
                      <View style={styles.priceUnitSelectorText}>
                        <Text style={styles.priceFieldLabel}>PRESENTACIÓN DE COMPRA</Text>
                        <Text numberOfLines={1} style={styles.priceUnitValue}>
                          {editingPurchaseUnit?.name ?? 'Unidad base'}
                        </Text>
                      </View>
                      <Icon color={COLORS.textMuted} size={20} source="chevron-down" />
                    </Pressable>
                  )}
                  onDismiss={() => setPriceUnitMenuVisible(false)}
                  visible={priceUnitMenuVisible}
                >
                  {editingPrice.variant.purchase_units?.map((unit) => (
                    <Menu.Item
                      key={unit.id}
                      leadingIcon={unit.id === pricePurchaseUnitId ? 'check' : 'package-variant'}
                      onPress={() => {
                        setPricePurchaseUnitId(unit.id);
                        setPriceUnitMenuVisible(false);
                      }}
                      title={unit.name}
                    />
                  ))}
                </Menu>

                <TextInput
                  keyboardType="decimal-pad"
                  label="Precio de la presentación (S/)"
                  mode="outlined"
                  onChangeText={setPriceCost}
                  value={priceCost}
                />
                <TextInput
                  label="Fecha (AAAA-MM-DD)"
                  mode="outlined"
                  onChangeText={setPriceQuotedAt}
                  value={priceQuotedAt}
                />
                <TextInput
                  label="Observación opcional"
                  mode="outlined"
                  multiline
                  numberOfLines={3}
                  onChangeText={setPriceNotes}
                  value={priceNotes}
                />
              </View>

              {priceError ? <Text style={styles.priceError}>{priceError}</Text> : null}
              <View style={styles.priceModalActions}>
                <Button disabled={savingPrice} mode="text" onPress={() => setEditingPrice(null)}>Cancelar</Button>
                <Button loading={savingPrice} mode="contained" onPress={() => void savePrice()}>
                  Guardar precio
                </Button>
              </View>
            </View>
          ) : null}
        </Modal>
        <Modal
          contentContainerStyle={styles.supplierSelectionModal}
          dismissable
          onDismiss={() => setSupplierSelectionVisible(false)}
          visible={supplierSelectionVisible}
        >
          <View style={styles.supplierSelectionContent}>
            <View>
              <Text style={styles.supplierModalEyebrow}>PROVEEDORES</Text>
              <Text style={styles.supplierModalTitle}>Seleccionar proveedores</Text>
              <Text style={styles.supplierSelectionHelp}>
                Marca los proveedores que quieres mostrar juntos en la tabla.
              </Text>
            </View>
            <ScrollView style={styles.supplierSelectionList}>
              {suppliers.map((supplier) => {
                const checked = draftSupplierIds.includes(supplier.id);
                return (
                  <Checkbox.Item
                    key={supplier.id}
                    label={supplier.name}
                    mode="android"
                    onPress={() => setDraftSupplierIds((current) => current.includes(supplier.id)
                      ? current.filter((id) => id !== supplier.id)
                      : [...current, supplier.id])}
                    position="leading"
                    status={checked ? 'checked' : 'unchecked'}
                    style={styles.supplierCheckbox}
                  />
                );
              })}
            </ScrollView>
            <View style={styles.supplierSelectionActions}>
              <Button mode="text" onPress={() => setSupplierSelectionVisible(false)}>Cancelar</Button>
              <Button
                mode="contained"
                onPress={() => {
                  setSelectedSupplierIds(draftSupplierIds);
                  setSupplierSelectionVisible(false);
                }}
              >
                Aplicar
              </Button>
            </View>
          </View>
        </Modal>
        <Modal
          contentContainerStyle={styles.supplierModal}
          dismissable
          onDismiss={() => setInspectedSupplierId(null)}
          visible={inspectedSupplier !== null}
        >
          {inspectedSupplier ? (
            <View style={styles.supplierModalContent}>
              <View style={styles.supplierModalHeading}>
                <View style={styles.supplierModalInitials}>
                  <Text style={styles.supplierModalInitialsText}>{supplierInitials(inspectedSupplier.name)}</Text>
                </View>
                <View style={styles.supplierModalIdentity}>
                  <Text style={styles.supplierModalEyebrow}>PROVEEDOR</Text>
                  <Text style={styles.supplierModalTitle}>{inspectedSupplier.name}</Text>
                </View>
              </View>
              <View style={styles.supplierModalDetails}>
                <View style={styles.supplierModalDetail}>
                  <Text style={styles.supplierModalLabel}>RUC / documento</Text>
                  <Text style={styles.supplierModalValue}>{inspectedSupplier.document_number || 'No registrado'}</Text>
                </View>
                <View style={styles.supplierModalDetail}>
                  <Text style={styles.supplierModalLabel}>Teléfono</Text>
                  <Text style={styles.supplierModalValue}>{inspectedSupplier.phone || 'No registrado'}</Text>
                </View>
                <View style={styles.supplierModalDetail}>
                  <Text style={styles.supplierModalLabel}>Correo</Text>
                  <Text numberOfLines={2} style={styles.supplierModalValue}>{inspectedSupplier.email || 'No registrado'}</Text>
                </View>
                <View style={styles.supplierModalDetail}>
                  <Text style={styles.supplierModalLabel}>Precios disponibles</Text>
                  <Text style={styles.supplierModalValue}>{inspectedSupplierSummary?.products ?? 0} variantes</Text>
                </View>
                <View style={styles.supplierModalDetail}>
                  <Text style={styles.supplierModalLabel}>Última cotización</Text>
                  <Text style={styles.supplierModalValue}>
                    {inspectedSupplierSummary?.lastQuote
                      ? freshnessLabel(inspectedSupplierSummary.lastQuote)
                      : 'Sin cotizaciones'}
                  </Text>
                </View>
              </View>
              <Button mode="contained" onPress={() => setInspectedSupplierId(null)}>Cerrar</Button>
            </View>
          ) : null}
        </Modal>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 1180, alignSelf: 'center', padding: 20, paddingBottom: 64 },
  headerContent: { gap: 18 },
  searchPanel: { gap: 11 },
  filters: { gap: 7 },
  filterButton: { minHeight: 34, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, backgroundColor: COLORS.surface },
  filterButtonActive: { borderColor: '#F1B7B7', backgroundColor: COLORS.primaryContainer },
  filterText: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800' },
  filterTextActive: { color: COLORS.onPrimaryContainer },
  resultsHeader: { marginTop: 4, paddingBottom: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultsTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  resultsTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  supplierIconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, backgroundColor: COLORS.surface },
  supplierIconButtonActive: { borderColor: '#E5B77E', backgroundColor: MODULE_COLORS.purchases.softColor },
  resultsActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 9 },
  resultsSearchButton: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DFE2E7', borderRadius: 4, backgroundColor: '#EAEFEE' },
  resultsSearchButtonActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryContainer },
  expandedSearch: { marginTop: -7 },
  resultsCount: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },
  paginationBar: { paddingTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  paginationText: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800' },
  nextPageButton: { flexDirection: 'row-reverse' },
  matrixCard: { marginTop: -2, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, backgroundColor: COLORS.surface },
  matrixLayout: { flexDirection: 'row', alignItems: 'flex-start' },
  matrixProductPane: { zIndex: 2, flexShrink: 0, borderRightWidth: 2, borderRightColor: '#D8DDDA', backgroundColor: COLORS.surface },
  matrixProductHeader: { height: 58, paddingHorizontal: 11, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: '#FCFDFD' },
  matrixHeaderEyebrow: { color: MODULE_COLORS.purchases.color, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  matrixProductHeaderTitle: { marginTop: 2, color: COLORS.text, fontSize: 11, fontWeight: '900' },
  matrixTemplateHeader: { height: 34, paddingHorizontal: 11, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: MODULE_COLORS.purchases.softColor },
  matrixTemplateName: { color: MODULE_COLORS.purchases.color, fontSize: 10, lineHeight: 13, fontWeight: '900' },
  matrixProductRow: { height: 68, paddingHorizontal: 11, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  matrixVariantName: { color: COLORS.text, fontSize: 10, lineHeight: 13, fontWeight: '900' },
  matrixVariantMeta: { marginTop: 3, color: COLORS.textMuted, fontSize: 8, fontWeight: '700' },
  matrixSupplierScroll: { flex: 1 },
  matrixSupplierTable: { flexGrow: 0, flexShrink: 0 },
  matrixSupplierHeaderRow: { height: 58, flexGrow: 0, flexShrink: 0, flexDirection: 'row' },
  matrixSupplierSlot: { height: 58, flexGrow: 0, flexShrink: 0, overflow: 'hidden', borderRightWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: '#FCFDFD' },
  matrixSupplierHeader: { width: '100%', height: '100%', flexGrow: 0, flexShrink: 0, paddingHorizontal: 3, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 },
  matrixSupplierInitials: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: MODULE_COLORS.purchases.softColor },
  matrixSupplierInitialsText: { color: MODULE_COLORS.purchases.color, fontSize: 9, fontWeight: '900' },
  matrixCurrency: { color: COLORS.textMuted, fontSize: 8, lineHeight: 10, fontWeight: '900' },
  matrixBestSupplierHeader: { width: '100%', height: '100%', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  matrixBestSupplierHeaderText: { color: COLORS.text, fontSize: 9, fontWeight: '900' },
  matrixSupplierHeaderText: { flex: 1, minWidth: 0 },
  matrixSupplierNumber: { color: COLORS.text, fontSize: 9, lineHeight: 11, fontWeight: '900', letterSpacing: 0.25 },
  matrixSupplierHint: { marginTop: 1, color: COLORS.textMuted, fontSize: 7, fontWeight: '600' },
  matrixTemplateBand: { height: 34, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: MODULE_COLORS.purchases.softColor },
  matrixOfferRow: { height: 68, flexGrow: 0, flexShrink: 0, flexDirection: 'row' },
  matrixPriceSlot: { height: 68, flexGrow: 0, flexShrink: 0, overflow: 'hidden', borderRightWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  matrixBestSupplierSlot: { height: 68, flexGrow: 0, flexShrink: 0, overflow: 'hidden', borderRightWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  matrixBestSupplierCell: { width: '100%', height: '100%', paddingHorizontal: 10, alignItems: 'flex-start', justifyContent: 'center', backgroundColor: COLORS.surface },
  matrixBestSupplierName: { flexShrink: 0, color: COLORS.text, fontSize: 10, lineHeight: 14, fontWeight: '900', textAlign: 'left' },
  matrixOfferCell: { width: '100%', height: '100%', flexGrow: 0, flexShrink: 0, overflow: 'hidden', paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  matrixCellPressed: { opacity: 0.65, backgroundColor: MODULE_COLORS.purchases.softColor },
  matrixBestCell: { backgroundColor: COLORS.successContainer },
  matrixPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  matrixPrice: { flexShrink: 1, color: COLORS.text, fontSize: 10, fontWeight: '900' },
  matrixBestPrice: { color: COLORS.success },
  matrixPriceUnit: { marginTop: 1, color: COLORS.textMuted, fontSize: 7, fontWeight: '700', textAlign: 'center' },
  matrixQuoteMeta: { marginTop: 3, color: COLORS.textSubtle, fontSize: 6, fontWeight: '600', textAlign: 'center' },
  matrixMissingPrice: { alignItems: 'center', gap: 4 },
  matrixMissingText: { color: COLORS.textSubtle, fontSize: 8, fontWeight: '700' },
  priceModal: { width: '90%', maxWidth: 500, maxHeight: '88%', alignSelf: 'center', padding: 20, borderRadius: 16, backgroundColor: COLORS.surface },
  priceModalContent: { gap: 18 },
  priceModalSupplier: { marginTop: 5, color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },
  priceModalFields: { gap: 12 },
  priceUnitSelector: { minHeight: 54, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.surface },
  priceUnitSelectorText: { flex: 1, minWidth: 0 },
  priceFieldLabel: { color: COLORS.textMuted, fontSize: 8, fontWeight: '900', letterSpacing: 0.35 },
  priceUnitValue: { marginTop: 3, color: COLORS.text, fontSize: 12, fontWeight: '800' },
  priceError: { color: COLORS.error, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  priceModalActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  supplierSelectionModal: { width: '90%', maxWidth: 500, maxHeight: '82%', alignSelf: 'center', padding: 20, borderRadius: 16, backgroundColor: COLORS.surface },
  supplierSelectionContent: { gap: 16 },
  supplierSelectionHelp: { marginTop: 6, color: COLORS.textMuted, fontSize: 11, lineHeight: 17 },
  supplierSelectionList: { maxHeight: 360, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10 },
  supplierCheckbox: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  supplierSelectionActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  supplierModal: { width: '90%', maxWidth: 460, maxHeight: '85%', alignSelf: 'center', padding: 22, borderRadius: 16, backgroundColor: COLORS.surface },
  supplierModalContent: { gap: 20 },
  supplierModalHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  supplierModalInitials: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: MODULE_COLORS.purchases.softColor },
  supplierModalInitialsText: { color: MODULE_COLORS.purchases.color, fontSize: 15, fontWeight: '900' },
  supplierModalIdentity: { flex: 1, minWidth: 0 },
  supplierModalEyebrow: { color: MODULE_COLORS.purchases.color, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  supplierModalTitle: { marginTop: 3, color: COLORS.text, fontSize: 18, lineHeight: 23, fontWeight: '900' },
  supplierModalDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  supplierModalDetail: { minWidth: 170, flex: 1, padding: 11, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.surfaceSubtle },
  supplierModalLabel: { color: COLORS.textMuted, fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  supplierModalValue: { marginTop: 4, color: COLORS.text, fontSize: 11, lineHeight: 16, fontWeight: '800' },
  templateCard: { marginTop: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, backgroundColor: COLORS.surface },
  templateHeaderPressable: { width: '100%', backgroundColor: '#FCFDFD' },
  templateHeader: { width: '100%', minHeight: 72, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 12 },
  templateIcon: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: MODULE_COLORS.purchases.softColor },
  templateIdentity: { flex: 1, minWidth: 0 },
  templateName: { color: COLORS.text, fontSize: 15, fontWeight: '900' },
  templateMeta: { marginTop: 3, color: COLORS.textMuted, fontSize: 10, fontWeight: '600' },
  variantSection: { padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background },
  columnsHeader: { paddingHorizontal: 14, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 18 },
  columnsHeaderText: { color: COLORS.textSubtle, fontSize: 8, lineHeight: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.55 },
  compareHeader: { flex: 1, alignItems: 'flex-start' },
  variantList: { gap: 10 },
  variantRow: { minHeight: 118, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 18, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: COLORS.surface },
  variantRowCompact: { minHeight: 0, padding: 14, alignItems: 'stretch', flexDirection: 'column', gap: 16 },
  variantIdentity: { width: 205, minWidth: 0 },
  variantIdentityCompact: { width: '100%' },
  variantTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  variantTitle: { flexShrink: 1, color: COLORS.text, fontSize: 13, fontWeight: '900' },
  principalBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, color: MODULE_COLORS.purchases.color, backgroundColor: MODULE_COLORS.purchases.softColor, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  variantMeta: { marginTop: 5, color: COLORS.textMuted, fontSize: 10, fontWeight: '600' },
  supplierComparison: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  supplierComparisonCompact: { flex: 0, paddingTop: 2, flexDirection: 'column', alignItems: 'stretch', gap: 14 },
  comparisonColumn: { flex: 1, minWidth: 150 },
  comparisonColumnCompact: { width: '100%', minWidth: 0, flex: 0 },
  comparisonArrow: { width: 22, alignItems: 'center' },
  differenceColumn: { width: 105, alignItems: 'flex-end' },
  differenceColumnCompact: { width: '100%', alignItems: 'flex-start' },
  columnLabel: { marginBottom: 7, color: COLORS.textSubtle, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  priceBlock: { minWidth: 145, minHeight: 78, paddingHorizontal: 12, paddingVertical: 11, justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: '#FAFCFB' },
  priceBlockFullWidth: { width: '100%', minWidth: 0 },
  bestPriceBlock: { borderColor: '#B9DFC9', backgroundColor: COLORS.successContainer },
  emptyPriceBlock: { minWidth: 145, minHeight: 78, paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border, borderRadius: 10, backgroundColor: '#FAFCFB' },
  priceHeading: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  priceValue: { flexShrink: 1, color: COLORS.text, fontSize: 12, fontWeight: '900' },
  bestPriceValue: { color: COLORS.success },
  supplierName: { marginTop: 3, color: COLORS.text, fontSize: 10, fontWeight: '800' },
  originalPrice: { marginTop: 3, color: COLORS.textMuted, fontSize: 9 },
  priceDate: { marginTop: 3, color: COLORS.textSubtle, fontSize: 8, fontWeight: '600' },
  emptyPrice: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800' },
  higherBadge: { paddingHorizontal: 8, paddingVertical: 7, alignItems: 'center', gap: 2, borderRadius: 9, backgroundColor: COLORS.errorContainer },
  higherBadgeText: { color: COLORS.error, fontSize: 9, fontWeight: '900' },
  higherPercent: { color: COLORS.error, fontSize: 8, fontWeight: '700' },
  winnerBadge: { paddingHorizontal: 8, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 9, backgroundColor: COLORS.successContainer },
  winnerBadgeText: { color: COLORS.success, fontSize: 9, fontWeight: '900' },
  bestModeBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  bestModeBlockCompact: { width: '100%', flex: 0, flexDirection: 'column', alignItems: 'stretch' },
  offerCount: { color: COLORS.textMuted, fontSize: 9, fontWeight: '700' },
  offerStripScroll: { flex: 1 },
  offerStripScrollCompact: { flex: 0 },
  offerStrip: { paddingHorizontal: 2, paddingVertical: 2, gap: 10 },
  noOffersBlock: { width: '100%', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border, borderRadius: 10, backgroundColor: '#FAFCFB' },
  noOffersIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: COLORS.surfaceSubtle },
  noOffersTextGroup: { flex: 1, minWidth: 0 },
  noOffersTitle: { color: COLORS.text, fontSize: 11, fontWeight: '900' },
  noOffersText: { marginTop: 2, color: COLORS.textMuted, fontSize: 9, lineHeight: 13 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyState: { marginTop: 20, padding: 36, alignItems: 'center', gap: 9, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border, borderRadius: 14 },
  emptyTitle: { color: COLORS.text, fontSize: 14, fontWeight: '900' },
  stateText: { maxWidth: 500, color: COLORS.textMuted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  pressed: { opacity: 0.74 },
});
