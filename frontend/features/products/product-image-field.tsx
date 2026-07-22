import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

type ProductImageFieldProps = {
  disabled?: boolean;
  imageUri: string | null;
  onPress: () => void;
};

function imageUrlForDevice(url: string) {
  if (Platform.OS !== 'android') return url;
  return url.replace(/https?:\/\/(localhost|127\.0\.0\.1)/, 'http://10.0.2.2');
}

export function ProductImageField({ disabled = false, imageUri, onPress }: ProductImageFieldProps) {
  return (
    <Pressable
      accessibilityHint="Seleccionar una imagen de la galería"
      accessibilityLabel={imageUri ? 'Cambiar imagen del producto' : 'Agregar imagen del producto'}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {imageUri ? (
        <Image resizeMode="cover" source={{ uri: imageUrlForDevice(imageUri) }} style={styles.image} />
      ) : (
        <View style={styles.placeholder}>
          <Icon source="camera-plus-outline" color="#8B7D90" size={34} />
          <Text style={styles.placeholderText}>Agregar foto</Text>
        </View>
      )}

      {imageUri ? (
        <View style={styles.editBadge}>
          <Icon source="pencil" color="#FFFFFF" size={15} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 104,
    height: 104,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D8D0DA',
    borderRadius: 12,
    backgroundColor: '#F5F2F6',
  },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.6 },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { marginTop: 5, color: '#746B78', fontSize: 10, fontWeight: '700' },
  editBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#73547B',
  },
});
