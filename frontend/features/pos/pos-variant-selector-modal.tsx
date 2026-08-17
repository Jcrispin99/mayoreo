import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    View,
    useWindowDimensions,
} from "react-native";
import { Button, Icon, IconButton, Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import {
    catalogPriceSummary,
    formatPosQuantity,
    resolveAmountToQuantity,
    resolvePriceTier,
    saleUnitOptions,
    type PosSaleUnitCode,
    type PosSaleUnitOption,
} from "./pos-measurement";
import type { PosCatalogProduct } from "./pos-types";

type PosVariantSelectorModalProps = {
    busy: boolean;
    cashSessionId: string;
    onAdd: (
        variant: PosCatalogProduct,
        quantity: number,
        unitCode: PosSaleUnitCode,
    ) => Promise<boolean>;
    onClose: () => void;
    templateProduct: PosCatalogProduct;
    visible: boolean;
};

function parseQuantity(value: string) {
    return Number(value.trim().replace(",", "."));
}

function money(value: number) {
    return `S/ ${Number.isFinite(value) ? value.toFixed(2) : "0.00"}`;
}

function inputNumber(value: number) {
    return Number.isFinite(value)
        ? value.toFixed(6).replace(/\.?0+$/, "")
        : "";
}

function quickQuantityLabel(value: number) {
    if (Math.abs(value - 0.25) < 0.000001) return "1/4";
    if (Math.abs(value - 0.5) < 0.000001) return "1/2";

    return formatPosQuantity(value);
}

function defaultSaleUnit(product: PosCatalogProduct | null): PosSaleUnitOption | null {
    if (!product) return null;

    const option = saleUnitOptions(product.base_unit)[0] ?? null;
    if (!option) return null;

    if (product.sale_mode === "unit") {
        return {
            ...option,
            label: "",
            quickValues: [1, 2, 3, 5, 10],
        };
    }

    return {
        ...option,
        quickValues: [0.25, 0.5, 2],
    };
}

function variantDisplayName(variant: PosCatalogProduct) {
    if (variant.sale_mode === "measured") return "Kilogramos";

    return variant.variant_name || variant.name;
}

export function PosVariantSelectorModal({
    busy,
    cashSessionId,
    onAdd,
    onClose,
    templateProduct,
    visible,
}: PosVariantSelectorModalProps) {
    const { width } = useWindowDimensions();
    const [variants, setVariants] = useState<PosCatalogProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [selectedVariant, setSelectedVariant] = useState<PosCatalogProduct | null>(null);
    const [quantity, setQuantity] = useState("1");
    const [amount, setAmount] = useState("");
    const [amountEditorOpen, setAmountEditorOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const abortController = useRef<AbortController | null>(null);
    const variantListRef = useRef<FlatList<PosCatalogProduct[]> | null>(null);

    useEffect(() => {
        if (!visible) return;

        setSelectedVariant(null);
        setQuantity("1");
        setAmount("");
        setAmountEditorOpen(false);
        setSaving(false);
        setSubmitError("");
        setError("");

        if (!templateProduct.product_template_id) {
            setVariants([templateProduct]);
            setSelectedVariant(templateProduct);
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        abortController.current?.abort();
        abortController.current = controller;

        setLoading(true);
        setVariants([]);

        async function loadVariants() {
            try {
                const response = await api.get(
                    `/cash-register-sessions/${cashSessionId}/catalog/templates/${templateProduct.product_template_id}/variants`,
                    { signal: controller.signal },
                );
                if (controller.signal.aborted) return;
                const loadedVariants = response.data.data as PosCatalogProduct[];
                setVariants(loadedVariants);
                if (loadedVariants.length === 1) {
                    setSelectedVariant(loadedVariants[0]);
                }
            } catch (requestError: any) {
                if (controller.signal.aborted) return;
                setError(
                    requestError?.response?.data?.message ??
                        "No se pudieron cargar las variantes.",
                );
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        void loadVariants();

        return () => {
            controller.abort();
        };
    }, [visible, cashSessionId, templateProduct.id, templateProduct.product_template_id]);

    useEffect(() => {
        if (!selectedVariant) return;

        const frame = requestAnimationFrame(() => {
            variantListRef.current?.scrollToEnd({ animated: true });
        });

        return () => cancelAnimationFrame(frame);
    }, [selectedVariant]);

    const templateName =
        templateProduct.product_template_id && templateProduct.variant_name
            ? templateProduct.name.replace(
                  ` - ${templateProduct.variant_name}`,
                  "",
              )
            : templateProduct.name;

    const isWide = width >= 600;
    const headerDescription = loading
        ? "Consultando las variantes disponibles para este producto."
        : "Elige una variante, indica la cantidad y agrégala a la orden.";
    const variantRows = useMemo(() => {
        const rows: PosCatalogProduct[][] = [];

        for (let index = 0; index < variants.length; index += 2) {
            rows.push(variants.slice(index, index + 2));
        }

        return rows;
    }, [variants]);
    const saleUnit = useMemo(() => defaultSaleUnit(selectedVariant), [selectedVariant]);
    const displayUnitLabel = selectedVariant?.sale_mode === "unit"
        ? ""
        : saleUnit?.label ?? "";
    const numericQuantity = parseQuantity(quantity);
    const numericAmount = parseQuantity(amount);
    const amountResolution = useMemo(
        () => resolveAmountToQuantity(selectedVariant, numericAmount),
        [numericAmount, selectedVariant],
    );
    const baseQuantity = saleUnit ? numericQuantity * saleUnit.factor : 0;
    const tier = selectedVariant
        ? resolvePriceTier(
            selectedVariant.price_tiers,
            baseQuantity,
            selectedVariant.sale_mode === "unit",
        )
        : null;
    const unitPrice = tier && saleUnit
        ? Number(tier.unit_price) * saleUnit.factor
        : 0;
    const total = tier ? baseQuantity * Number(tier.unit_price) : 0;
    const validQuantity = Number.isFinite(numericQuantity)
        && numericQuantity > 0;
    const canSubmit = Boolean(selectedVariant && saleUnit && tier && validQuantity);

    function selectVariant(variant: PosCatalogProduct) {
        setSelectedVariant(variant);
        setQuantity("1");
        setAmount("");
        setAmountEditorOpen(false);
        setSubmitError("");
    }

    function changeQuantity(value: string) {
        setQuantity(value);
        setAmount("");
        setSubmitError("");
    }

    function changeAmount(value: string) {
        setAmount(value);
        setSubmitError("");

        const parsedAmount = parseQuantity(value);
        const resolution = resolveAmountToQuantity(selectedVariant, parsedAmount);
        if (!resolution || !saleUnit) return;

        setQuantity(inputNumber(resolution.baseQuantity / saleUnit.factor));
    }

    function openAmountEditor() {
        setAmount(total > 0 ? total.toFixed(2) : "");
        setAmountEditorOpen(true);
        setSubmitError("");
    }

    async function addToOrder() {
        if (!selectedVariant || !saleUnit || !canSubmit || saving || busy) return;

        setSaving(true);
        setSubmitError("");
        const added = await onAdd(selectedVariant, numericQuantity, saleUnit.code);
        setSaving(false);

        if (added) {
            onClose();
            return;
        }

        setSubmitError("No se pudo agregar el producto. Revisa el mensaje de la orden.");
    }

    const quantityError = selectedVariant && quantity.trim() !== "" && !validQuantity
        ? "Ingresa una cantidad mayor a cero."
        : selectedVariant && validQuantity && !tier
            ? "No existe un precio activo para esta cantidad."
            : "";
    const amountError = amountEditorOpen && amount.trim() !== "" && !amountResolution
        ? "No existe un precio aplicable para calcular ese monto."
        : "";
    const amountDifference = amountResolution
        ? Math.abs(numericAmount - total)
        : 0;

    return (
        <Modal
            animationType="slide"
            onRequestClose={() => !saving && !busy && onClose()}
            presentationStyle={
                Platform.OS === "ios"
                    ? isWide
                        ? "formSheet"
                        : "pageSheet"
                    : "overFullScreen"
            }
            transparent={Platform.OS !== "ios"}
            visible={visible}
        >
            <SafeAreaView
                edges={["top", "bottom", "left", "right"]}
                style={styles.modalBackground}
            >
                <View
                    style={[
                        styles.modalContainer,
                        isWide && styles.modalContainerWide,
                    ]}
                >
                    <View style={styles.modalHeader}>
                        <View style={styles.headerTitles}>
                            <Text style={styles.modalTitle}>
                                Seleccionar variante
                            </Text>
                            <Text numberOfLines={1} style={styles.templateName}>
                                {templateName}
                            </Text>
                            <Text
                                numberOfLines={2}
                                style={styles.modalSubtitle}
                            >
                                {headerDescription}
                            </Text>
                        </View>
                        <IconButton
                            accessibilityLabel="Cerrar selector de variantes"
                            containerColor="#F3F6F5"
                            disabled={saving || busy}
                            icon="close"
                            iconColor="#172423"
                            onPress={onClose}
                        />
                    </View>

                    <View style={styles.modalBody}>
                        {loading ? (
                            <View style={styles.centerState}>
                                <ActivityIndicator
                                    color="#B4232D"
                                    size="large"
                                />
                                <Text style={styles.stateText}>
                                    Cargando variantes...
                                </Text>
                            </View>
                        ) : error ? (
                            <View style={styles.centerState}>
                                <Icon
                                    color="#8F1D2C"
                                    size={42}
                                    source="alert-circle-outline"
                                />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : (
                            <FlatList
                                contentContainerStyle={styles.variantList}
                                data={variantRows}
                                extraData={selectedVariant?.id}
                                keyboardShouldPersistTaps="handled"
                                keyExtractor={(row, index) =>
                                    row.map((item) => item.id).join("-") ||
                                    String(index)
                                }
                                ListFooterComponent={(
                                    <View style={styles.quantityPanel}>
                                        <Text style={styles.quantityEyebrow}>
                                            Cantidad
                                        </Text>
                                        {selectedVariant && saleUnit ? (
                                            <>
                                                <View style={styles.quantityHeader}>
                                                    <Text
                                                        numberOfLines={1}
                                                        style={styles.selectedVariantName}
                                                    >
                                                        {variantDisplayName(selectedVariant)}
                                                    </Text>

                                                    <View style={styles.quickValues}>
                                                        {saleUnit.quickValues.map((value) => {
                                                            const selected = Math.abs(numericQuantity - value) < 0.000001;
                                                            const quickLabel = quickQuantityLabel(value);
                                                            const accessibilityUnit = displayUnitLabel
                                                                ? ` ${displayUnitLabel}`
                                                                : "";

                                                            return (
                                                                <Pressable
                                                                    accessibilityLabel={`Usar ${quickLabel}${accessibilityUnit}`}
                                                                    accessibilityRole="button"
                                                                    disabled={saving || busy}
                                                                    key={value}
                                                                    onPress={() => {
                                                                        setQuantity(String(value));
                                                                        setAmount("");
                                                                        setSubmitError("");
                                                                    }}
                                                                    style={[
                                                                        styles.quickValue,
                                                                        saleUnit.quickValues.length <= 3 && styles.quickValueWide,
                                                                        selected && styles.quickValueSelected,
                                                                    ]}
                                                                >
                                                                    <Text
                                                                        adjustsFontSizeToFit
                                                                        minimumFontScale={0.72}
                                                                        numberOfLines={1}
                                                                        style={[
                                                                            styles.quickValueText,
                                                                            selected && styles.quickValueTextSelected,
                                                                        ]}
                                                                    >
                                                                        {quickLabel}
                                                                    </Text>
                                                                </Pressable>
                                                            );
                                                        })}
                                                    </View>
                                                </View>
                                                <TextInput
                                                    dense
                                                    disabled={saving || busy}
                                                    error={Boolean(quantityError || submitError)}
                                                    keyboardType="decimal-pad"
                                                    label="Cantidad"
                                                    mode="outlined"
                                                    onChangeText={changeQuantity}
                                                    outlineColor="#879692"
                                                    right={displayUnitLabel
                                                        ? <TextInput.Affix text={displayUnitLabel} />
                                                        : undefined}
                                                    selectTextOnFocus
                                                    style={styles.quantityInput}
                                                    value={quantity}
                                                />

                                                {quantityError || submitError ? (
                                                    <Text style={styles.quantityError}>
                                                        {quantityError || submitError}
                                                    </Text>
                                                ) : null}

                                                <View style={styles.pricingSummary}>
                                                    <View style={styles.summaryBlock}>
                                                        <Text style={styles.summaryLabel}>Precio aplicado</Text>
                                                        <Text numberOfLines={1} style={styles.summaryTier}>
                                                            {tier?.label || "Sin rango"}
                                                        </Text>
                                                        <Text style={styles.summaryPrice}>
                                                            {tier
                                                                ? `${money(unitPrice)}${displayUnitLabel ? ` / ${displayUnitLabel}` : ""}`
                                                                : "—"}
                                                        </Text>
                                                    </View>
                                                    <Pressable
                                                        accessibilityLabel="Ingresar monto deseado"
                                                        accessibilityRole="button"
                                                        disabled={saving || busy}
                                                        onPress={openAmountEditor}
                                                        style={({ pressed }) => [
                                                            styles.summaryBlock,
                                                            styles.totalBlock,
                                                            pressed && styles.totalBlockPressed,
                                                        ]}
                                                    >
                                                        <View style={styles.totalLabelRow}>
                                                            <Text style={styles.summaryLabel}>Total</Text>
                                                            <Icon color="#60706E" size={14} source="pencil-outline" />
                                                        </View>
                                                        <Text style={styles.totalValue}>
                                                            {tier && validQuantity ? money(total) : "—"}
                                                        </Text>
                                                        <Text style={styles.totalHelp}>Toca para fijar monto</Text>
                                                    </Pressable>
                                                </View>

                                                {amountEditorOpen ? (
                                                    <View style={styles.amountEditor}>
                                                        <Text style={styles.amountTitle}>Monto deseado</Text>
                                                        <Text style={styles.amountHelp}>
                                                            El POS calculará la cantidad fraccionada automáticamente.
                                                        </Text>
                                                        <TextInput
                                                            autoFocus
                                                            dense
                                                            disabled={saving || busy}
                                                            error={Boolean(amountError)}
                                                            keyboardType="decimal-pad"
                                                            label="Monto"
                                                            left={<TextInput.Affix text="S/" />}
                                                            mode="outlined"
                                                            onChangeText={changeAmount}
                                                            outlineColor="#879692"
                                                            selectTextOnFocus
                                                            style={styles.amountInput}
                                                            value={amount}
                                                        />
                                                        {amountError ? (
                                                            <Text style={styles.quantityError}>{amountError}</Text>
                                                        ) : amountResolution ? (
                                                            <Text style={styles.amountResult}>
                                                                Cantidad: {formatPosQuantity(numericQuantity, 6)}
                                                                {displayUnitLabel ? ` ${displayUnitLabel}` : ""}
                                                                {amountDifference >= 0.01
                                                                    ? ` · diferencia ${money(amountDifference)}`
                                                                    : ""}
                                                            </Text>
                                                        ) : null}
                                                    </View>
                                                ) : null}

                                                <Button
                                                    disabled={!canSubmit || saving || busy}
                                                    icon="cart-plus"
                                                    loading={saving}
                                                    mode="contained"
                                                    onPress={() => void addToOrder()}
                                                    style={styles.addButton}
                                                >
                                                    Agregar a la orden
                                                </Button>
                                            </>
                                        ) : (
                                            <View style={styles.quantityEmpty}>
                                                <Icon color="#60706E" size={28} source="cursor-default-click-outline" />
                                                <Text style={styles.quantityEmptyText}>
                                                    Selecciona una variante para indicar la cantidad.
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                                renderItem={({ item: row }) => (
                                    <View style={styles.variantRow}>
                                        {row.map((variant) => {
                                            const price =
                                                catalogPriceSummary(variant);
                                            const selected = selectedVariant?.id === variant.id;

                                            return (
                                                <View
                                                    key={variant.id}
                                                    style={
                                                        styles.variantCardSlot
                                                    }
                                                >
                                                    <View
                                                        style={[
                                                            styles.variantCard,
                                                            selected && styles.variantCardSelected,
                                                        ]}
                                                    >
                                                        <Pressable
                                                            accessibilityLabel={`Seleccionar ${variantDisplayName(variant)}`}
                                                            accessibilityRole="button"
                                                            disabled={saving || busy}
                                                            onPress={() => selectVariant(variant)}
                                                            style={({
                                                                pressed,
                                                            }) => [
                                                                styles.variantCardPressable,
                                                                pressed &&
                                                                    styles.variantCardPressed,
                                                            ]}
                                                        >
                                                            <View
                                                                style={
                                                                    styles.variantCardContent
                                                                }
                                                            >
                                                                <View
                                                                    style={
                                                                        styles.variantCardTop
                                                                    }
                                                                >
                                                                    <View
                                                                        style={
                                                                            styles.variantInfo
                                                                        }
                                                                    >
                                                                        <Text
                                                                            numberOfLines={
                                                                                3
                                                                            }
                                                                            style={
                                                                                styles.variantAttributes
                                                                            }
                                                                        >
                                                                            {variantDisplayName(variant)}
                                                                        </Text>
                                                                        {selected ? (
                                                                            <Icon
                                                                                color="#B4232D"
                                                                                size={20}
                                                                                source="check-circle"
                                                                            />
                                                                        ) : null}
                                                                    </View>
                                                                </View>

                                                                <View
                                                                    style={
                                                                        styles.variantFooter
                                                                    }
                                                                >
                                                                    <Text
                                                                        numberOfLines={
                                                                            1
                                                                        }
                                                                        style={[
                                                                            styles.price,
                                                                            !price &&
                                                                                styles.missingPrice,
                                                                        ]}
                                                                    >
                                                                        {price
                                                                            ? `S/ ${price.amount.toFixed(2)}${price.unit ? ` / ${price.unit}` : ""}`
                                                                            : "Sin precio"}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                        </Pressable>
                                                    </View>
                                                </View>
                                            );
                                        })}

                                        {row.length === 1 ? (
                                            <View
                                                style={styles.variantCardSlot}
                                            />
                                        ) : null}
                                    </View>
                                )}
                                ref={variantListRef}
                                removeClippedSubviews={false}
                                showsVerticalScrollIndicator={false}
                            />
                        )}
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalBackground: {
        flex: 1,
        backgroundColor: "rgba(23, 36, 35, 0.38)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContainer: { flex: 1, width: "100%", backgroundColor: "#EEF2F1" },
    modalContainerWide: {
        flex: 0,
        width: 720,
        height: "82%",
        maxHeight: 760,
        borderRadius: 24,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#D7E0DE",
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        paddingHorizontal: 22,
        paddingVertical: 18,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#D7E0DE",
    },
    headerTitles: { flex: 1, paddingRight: 12 },
    modalTitle: {
        color: "#60706E",
        fontSize: 12,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    templateName: {
        color: "#172423",
        fontSize: 20,
        fontWeight: "900",
        marginTop: 3,
        lineHeight: 24,
    },
    modalSubtitle: {
        marginTop: 6,
        color: "#60706E",
        fontSize: 15,
        lineHeight: 20,
    },
    modalBody: { flex: 1, paddingTop: 4 },
    centerState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 12,
    },
    stateText: { color: "#60706E", fontSize: 14, fontWeight: "700" },
    errorText: { color: "#8F1D2C", fontSize: 14, textAlign: "center" },
    variantList: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28 },
    variantRow: {
        flexDirection: "row",
        alignItems: "stretch",
        gap: 14,
        marginBottom: 14,
    },
    variantCardSlot: { flex: 1 },
    variantCard: {
        width: "100%",
        minHeight: 108,
        borderWidth: 2,
        borderColor: "transparent",
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
        shadowColor: "#172423",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
        elevation: 2,
        overflow: "hidden",
    },
    variantCardSelected: {
        borderColor: "#B4232D",
    },
    variantCardPressed: {
        backgroundColor: "#F4F7F6",
    },
    variantCardPressable: {
        flex: 1,
        minHeight: 108,
        borderRadius: 12,
    },
    variantCardContent: {
        flex: 1,
        minHeight: 108,
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: 16,
        justifyContent: "flex-start",
        gap: 10,
    },
    variantCardTop: { flexDirection: "row", alignItems: "flex-start" },
    variantInfo: {
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
    },
    variantAttributes: {
        flex: 1,
        color: "#172423",
        fontSize: 16,
        fontWeight: "800",
        lineHeight: 22,
    },
    variantFooter: { paddingTop: 4 },
    price: {
        marginTop: 0,
        color: "#B4232D",
        fontSize: 15,
        fontWeight: "900",
        lineHeight: 20,
    },
    missingPrice: { color: "#8F1D2C", fontSize: 14 },
    quantityPanel: {
        marginTop: 4,
        padding: 18,
        borderRadius: 16,
        backgroundColor: "#FFFFFF",
        shadowColor: "#172423",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
        elevation: 2,
    },
    quantityEyebrow: {
        color: "#60706E",
        fontSize: 12,
        fontWeight: "800",
        textTransform: "uppercase",
    },
    quantityHeader: {
        marginTop: 7,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
    },
    selectedVariantName: {
        flex: 1,
        minWidth: 0,
        color: "#172423",
        fontSize: 17,
        fontWeight: "900",
        lineHeight: 22,
    },
    quantityInput: { marginTop: 14, backgroundColor: "#FFFFFF" },
    quickValues: {
        flexShrink: 0,
        flexDirection: "row",
        gap: 4,
    },
    quickValue: {
        width: 34,
        minHeight: 34,
        paddingHorizontal: 3,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#C6D2D0",
        borderRadius: 17,
        backgroundColor: "#FFFFFF",
    },
    quickValueWide: { width: 42 },
    quickValueSelected: {
        borderColor: "#B4232D",
        backgroundColor: "#FFE8E8",
    },
    quickValueText: {
        width: "100%",
        color: "#52615F",
        fontSize: 11,
        fontWeight: "800",
        textAlign: "center",
    },
    quickValueTextSelected: { color: "#B4232D" },
    quantityError: {
        marginTop: 10,
        color: "#8F1D2C",
        fontSize: 13,
        lineHeight: 18,
    },
    pricingSummary: {
        marginTop: 16,
        padding: 14,
        flexDirection: "row",
        gap: 12,
        borderRadius: 12,
        backgroundColor: "#F3F6F5",
    },
    summaryBlock: { flex: 1, minWidth: 0 },
    totalBlock: {
        alignItems: "flex-end",
        padding: 6,
        borderRadius: 9,
    },
    totalBlockPressed: { backgroundColor: "#E5ECEA" },
    totalLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    summaryLabel: { color: "#60706E", fontSize: 12, fontWeight: "700" },
    summaryTier: { marginTop: 3, color: "#172423", fontSize: 13, fontWeight: "800" },
    summaryPrice: { marginTop: 2, color: "#B4232D", fontSize: 13, fontWeight: "900" },
    totalValue: { marginTop: 7, color: "#172423", fontSize: 20, fontWeight: "900" },
    totalHelp: { marginTop: 2, color: "#60706E", fontSize: 10, fontWeight: "700" },
    amountEditor: {
        marginTop: 12,
        padding: 14,
        borderRadius: 12,
        backgroundColor: "#FFF7F7",
    },
    amountTitle: { color: "#172423", fontSize: 14, fontWeight: "900" },
    amountHelp: { marginTop: 3, color: "#60706E", fontSize: 12, lineHeight: 17 },
    amountInput: { marginTop: 10, backgroundColor: "#FFFFFF" },
    amountResult: { marginTop: 9, color: "#337B67", fontSize: 12, fontWeight: "800" },
    addButton: { marginTop: 16, borderRadius: 12 },
    quantityEmpty: {
        minHeight: 92,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    quantityEmptyText: {
        maxWidth: 300,
        color: "#60706E",
        fontSize: 14,
        lineHeight: 20,
        textAlign: "center",
    },
});
