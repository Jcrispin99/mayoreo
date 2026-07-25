import { Pressable, StyleSheet, View } from 'react-native';
import { Checkbox, Text } from 'react-native-paper';

export type MultiSelectOption = {
  id: string;
  label: string;
  description?: string;
};

type MultiSelectFieldProps = {
  emptyText: string;
  options: MultiSelectOption[];
  selectedIds: string[];
  title: string;
  onToggle: (id: string) => void;
};

export function MultiSelectField({
  emptyText,
  options,
  selectedIds,
  title,
  onToggle,
}: MultiSelectFieldProps) {
  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.count}>{selectedIds.length} seleccionados</Text>
      </View>
      {options.length === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : options.map((option) => {
        const selected = selectedIds.includes(option.id);
        return (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            key={option.id}
            onPress={() => onToggle(option.id)}
            style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
          >
            <Checkbox status={selected ? 'checked' : 'unchecked'} />
            <View style={styles.optionCopy}>
              <Text style={styles.optionLabel}>{option.label}</Text>
              {option.description ? <Text style={styles.optionDescription}>{option.description}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#D7E0DE' },
  heading: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#172423', fontSize: 14, fontWeight: '800' },
  count: { color: '#60706E', fontSize: 10 },
  option: {
    minHeight: 54,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#D7E0DE',
  },
  optionSelected: { backgroundColor: '#FFE5E5' },
  optionPressed: { opacity: 0.75 },
  optionCopy: { flex: 1, marginLeft: 4 },
  optionLabel: { color: '#172423', fontSize: 13, fontWeight: '700' },
  optionDescription: { marginTop: 2, color: '#60706E', fontSize: 10 },
  empty: { paddingVertical: 18, color: '#60706E', fontSize: 12 },
});
