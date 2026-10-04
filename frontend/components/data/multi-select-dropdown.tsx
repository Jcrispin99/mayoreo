import { useMemo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Checkbox, Icon, Modal, Portal, Text } from 'react-native-paper';
import type { MultiSelectOption } from './multi-select-field';

type MultiSelectDropdownProps = {
  emptyText: string;
  label: string;
  options: MultiSelectOption[];
  placeholder: string;
  selectedIds: string[];
  onToggle: (id: string) => void;
};

export function MultiSelectDropdown({
  emptyText,
  label,
  options,
  placeholder,
  selectedIds,
  onToggle,
}: MultiSelectDropdownProps) {
  const [visible, setVisible] = useState(false);
  const selectedOptions = useMemo(
    () => options.filter((option) => selectedIds.includes(option.id)),
    [options, selectedIds],
  );

  function openSelector() {
    Keyboard.dismiss();
    setVisible(true);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityLabel={`${label}: abrir selector`}
        accessibilityRole="button"
        accessibilityState={{ expanded: visible }}
        onPress={openSelector}
        style={({ pressed }) => [styles.field, visible && styles.fieldFocused, pressed && styles.fieldPressed]}
      >
        <View style={styles.selection}>
          {selectedOptions.length > 0 ? selectedOptions.map((option) => (
            <View key={option.id} style={styles.chip}>
              <Text numberOfLines={1} style={styles.chipText}>{option.label}</Text>
            </View>
          )) : <Text style={styles.placeholder}>{placeholder}</Text>}
        </View>
        <Icon color="#526461" size={22} source="chevron-down" />
      </Pressable>

      <Portal>
        <Modal
          contentContainerStyle={styles.modal}
          dismissable
          onDismiss={() => setVisible(false)}
          visible={visible}
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalHeading}>
              <Text variant="titleLarge">{label}</Text>
              <Text style={styles.modalHelper}>Marca uno o varios roles para este usuario.</Text>
            </View>
            <Pressable
              accessibilityLabel="Cerrar selector"
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => setVisible(false)}
              style={styles.closeButton}
            >
              <Icon color="#526461" size={24} source="close" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.optionListContent} style={styles.optionList}>
            {options.length === 0 ? <Text style={styles.emptyText}>{emptyText}</Text> : options.map((option) => {
              const selected = selectedIds.includes(option.id);
              return (
                <Pressable
                  accessibilityLabel={`${selected ? 'Quitar' : 'Asignar'} rol ${option.label}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  key={option.id}
                  onPress={() => onToggle(option.id)}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    pressed && styles.optionPressed,
                  ]}
                >
                  <Checkbox status={selected ? 'checked' : 'unchecked'} />
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    {option.description ? <Text style={styles.optionDescription}>{option.description}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Text style={styles.selectionCount}>
              {selectedIds.length === 1 ? '1 seleccionado' : `${selectedIds.length} seleccionados`}
            </Text>
            <Button mode="contained" onPress={() => setVisible(false)}>Listo</Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', zIndex: 2 },
  label: { marginBottom: 3, color: '#60706E', fontSize: 11 },
  field: {
    minHeight: 52,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#879692',
  },
  fieldFocused: { borderBottomWidth: 2, borderBottomColor: '#B4232D' },
  fieldPressed: { backgroundColor: '#F3F7F6' },
  selection: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  placeholder: { color: '#60706E', fontSize: 14 },
  chip: {
    maxWidth: '100%',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFE5E5',
  },
  chipText: { color: '#B4232D', fontSize: 12, fontWeight: '700' },
  modal: {
    maxHeight: '78%',
    marginHorizontal: 20,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E3E9E7',
  },
  modalHeading: { flex: 1, gap: 3 },
  modalHelper: { color: '#60706E', fontSize: 12, lineHeight: 18 },
  closeButton: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  optionList: { flexGrow: 0 },
  optionListContent: { padding: 12, gap: 6 },
  option: {
    minHeight: 58,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
  },
  optionSelected: { borderColor: '#E9BAC2', backgroundColor: '#FFF4F5' },
  optionPressed: { backgroundColor: '#F3F7F6' },
  optionCopy: { flex: 1, paddingVertical: 8 },
  optionLabel: { color: '#172423', fontSize: 14, fontWeight: '700' },
  optionDescription: { marginTop: 2, color: '#60706E', fontSize: 11 },
  emptyText: { paddingHorizontal: 8, paddingVertical: 24, color: '#60706E', textAlign: 'center' },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E3E9E7',
  },
  selectionCount: { flex: 1, color: '#60706E', fontSize: 12 },
});
