import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ProductPickerList,
  type PickerProduct,
} from '../data/product-picker-list';

type ProductableEditorProps = {
  backAccessibilityLabel: string;
  children: ReactNode;
  error?: string;
  onClose: () => void;
  onDelete?: () => void;
  onSave: () => void;
  onSaveAndCreateAnother: () => void;
  onSelectProduct: (product: PickerProduct) => void;
  onToggleProductPicker: () => void;
  productPickerOpen: boolean;
  products: PickerProduct[];
  readOnly?: boolean;
  selectedProductId: number | null;
  selectedProductLabel: string;
  summaryDetail?: string;
  summaryLabel: string;
  summaryValue: string;
  title: string;
  visible: boolean;
};

export function ProductableEditor({
  backAccessibilityLabel,
  children,
  error,
  onClose,
  onDelete,
  onSave,
  onSaveAndCreateAnother,
  onSelectProduct,
  onToggleProductPicker,
  productPickerOpen,
  products,
  readOnly = false,
  selectedProductId,
  selectedProductLabel,
  summaryDetail,
  summaryLabel,
  summaryValue,
  title,
  visible,
}: ProductableEditorProps) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
          <View style={styles.header}>
            <Pressable accessibilityLabel={backAccessibilityLabel} hitSlop={8} onPress={onClose} style={styles.backButton}>
              <Icon color="#172423" size={22} source="arrow-left" />
            </Pressable>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.label}>Variante *</Text>
            <Pressable
              disabled={readOnly}
              onPress={onToggleProductPicker}
              style={[styles.selector, readOnly && styles.disabled]}
            >
              <Text numberOfLines={1} style={styles.selectorText}>{selectedProductLabel}</Text>
              {!readOnly ? (
                <Icon
                  color="#B4232D"
                  size={20}
                  source={productPickerOpen ? 'chevron-up' : 'chevron-down'}
                />
              ) : null}
            </Pressable>
            {productPickerOpen && !readOnly ? (
              <ProductPickerList
                onSelect={onSelectProduct}
                products={products}
                selectedId={selectedProductId}
              />
            ) : null}

            {children}

            <View style={styles.summary}>
              <View style={styles.summaryCopy}>
                <Text style={styles.summaryLabel}>{summaryLabel}</Text>
                {summaryDetail ? <Text style={styles.summaryDetail}>{summaryDetail}</Text> : null}
              </View>
              <Text style={styles.summaryValue}>{summaryValue}</Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {readOnly ? (
              <Button mode="contained" onPress={onClose}>Cerrar</Button>
            ) : (
              <>
                <View style={styles.primaryActions}>
                  <Button buttonColor="#FF4D4D" mode="contained" onPress={onSave} style={styles.primaryButton}>
                    Guardar y cerrar
                  </Button>
                  <Button buttonColor="#FF4D4D" mode="contained" onPress={onSaveAndCreateAnother} style={styles.primaryButton}>
                    Guardar y crear nuevo
                  </Button>
                </View>
                <Button buttonColor="#2DD4BF" mode="contained" onPress={onClose} textColor="#073B35">
                  Descartar
                </Button>
                {onDelete ? (
                  <Button mode="text" onPress={onDelete} textColor="#8F1D2C">
                    Eliminar línea
                  </Button>
                ) : null}
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  screen: { flex: 1 },
  header: { minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#DCDDE0' },
  backButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { marginLeft: 4, flex: 1, color: '#172423', fontSize: 16, fontWeight: '800' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 14, paddingTop: 28, gap: 20, paddingBottom: 40 },
  error: { padding: 12, borderRadius: 8, color: '#8F1D2C', backgroundColor: '#FCE8EA' },
  label: { marginBottom: -16, color: '#172423', fontSize: 14, fontWeight: '700' },
  selector: { minHeight: 48, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#B4232D' },
  selectorText: { flex: 1, color: '#303A49', fontSize: 14 },
  disabled: { opacity: 0.72 },
  summary: { marginTop: 10, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderRadius: 8, backgroundColor: '#EAEFEE' },
  summaryCopy: { flex: 1 },
  summaryLabel: { color: '#5D5661', fontSize: 13, fontWeight: '700' },
  summaryDetail: { marginTop: 3, color: '#60706E', fontSize: 10 },
  summaryValue: { color: '#B4232D', fontSize: 16, fontWeight: '900' },
  footer: { padding: 14, gap: 10, borderTopWidth: 1, borderTopColor: '#DCDDE0', backgroundColor: '#FFFFFF' },
  primaryActions: { flexDirection: 'row', gap: 12 },
  primaryButton: { flex: 1 },
});
