import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
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
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);

  const selectedOptions = useMemo(
    () => options.filter((option) => selectedIds.includes(option.id)),
    [options, selectedIds],
  );
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    return options.filter((option) => (
      !normalizedQuery || option.label.toLocaleLowerCase('es').includes(normalizedQuery)
    ));
  }, [options, query]);

  function keepOpen() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setFocused(true);
  }

  function scheduleClose() {
    blurTimer.current = setTimeout(() => setFocused(false), 120);
  }

  function toggleOption(id: string) {
    onToggle(id);
    setQuery('');
    keepOpen();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, focused && styles.fieldFocused]}>
        {selectedOptions.map((option) => (
          <View key={option.id} style={styles.chip}>
            <Text numberOfLines={1} style={styles.chipLabel}>{option.label}</Text>
            <Pressable
              accessibilityLabel={`Quitar rol ${option.label}`}
              accessibilityRole="button"
              hitSlop={7}
              onPress={() => onToggle(option.id)}
              style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
            >
              <Text style={styles.removeText}>×</Text>
            </Pressable>
          </View>
        ))}
        <TextInput
          accessibilityLabel={`${label}: buscar y agregar`}
          autoCapitalize="none"
          onBlur={scheduleClose}
          onChangeText={setQuery}
          onFocus={keepOpen}
          placeholder={selectedOptions.length === 0 ? placeholder : 'Agregar otro rol…'}
          placeholderTextColor="#60706E"
          style={styles.input}
          value={query}
        />
      </View>

      {focused ? (
        <View style={styles.suggestions}>
          {options.length === 0 ? (
            <Text style={styles.empty}>{emptyText}</Text>
          ) : filteredOptions.length === 0 ? (
            <Text style={styles.empty}>No hay roles que coincidan con la búsqueda.</Text>
          ) : filteredOptions.map((option) => {
            const selected = selectedIds.includes(option.id);
            return (
              <Pressable
                accessibilityLabel={`${selected ? 'Quitar' : 'Asignar'} rol ${option.label}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.id}
                onPress={() => toggleOption(option.id)}
                onPressIn={keepOpen}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.optionSelected,
                  pressed && styles.optionPressed,
                ]}
              >
                <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
                {option.description ? (
                  <Text style={[styles.optionDescription, selected && styles.optionDescriptionSelected]}>
                    {option.description}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', zIndex: 2 },
  label: { marginBottom: 3, color: '#60706E', fontSize: 11 },
  field: {
    minHeight: 48,
    paddingHorizontal: 4,
    paddingVertical: 7,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#879692',
  },
  fieldFocused: { borderBottomWidth: 2, borderBottomColor: '#B4232D' },
  chip: {
    maxWidth: '100%',
    minHeight: 30,
    paddingLeft: 10,
    paddingRight: 5,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    backgroundColor: '#FFE5E5',
  },
  chipLabel: { maxWidth: 190, color: '#B4232D', fontSize: 12, fontWeight: '700' },
  removeButton: {
    width: 25,
    height: 25,
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  removeText: { color: '#B4232D', fontSize: 19, lineHeight: 21 },
  input: {
    minWidth: 145,
    minHeight: 34,
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 0,
    color: '#172423',
    backgroundColor: 'transparent',
    fontSize: 14,
  },
  suggestions: {
    marginTop: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D7E0DE',
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  option: {
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 9,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D7E0DE',
  },
  optionPressed: { opacity: 0.78 },
  optionSelected: { backgroundColor: '#B4232D' },
  optionLabel: { color: '#172423', fontSize: 13, fontWeight: '700' },
  optionLabelSelected: { color: '#FFFFFF' },
  optionDescription: { marginTop: 2, color: '#60706E', fontSize: 10 },
  optionDescriptionSelected: { color: '#FFE5E5' },
  empty: { padding: 14, color: '#60706E', fontSize: 12 },
  pressed: { opacity: 0.62 },
});
