import { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Menu, Text } from 'react-native-paper';

type ProductImageFieldProps = {
  disabled?: boolean;
  imageUri: string | null;
  onChooseFromLibrary: () => void;
  onTakePhoto: () => void;
};

function imageUrlForDevice(url: string) {
  if (Platform.OS !== 'android') return url;
  return url.replace(/https?:\/\/(localhost|127\.0\.0\.1)/, 'http://10.0.2.2');
}

export function ProductImageField({
  disabled = false,
  imageUri,
  onChooseFromLibrary,
  onTakePhoto,
}: ProductImageFieldProps) {
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <Menu
      anchor={(
        <Pressable
          accessibilityHint="Elegir entre tomar una foto o seleccionarla de la galería"
          accessibilityLabel={imageUri ? 'Cambiar imagen del producto' : 'Agregar imagen del producto'}
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => setMenuVisible(true)}
          style={({ pressed }) => [styles.container, pressed && styles.pressed, disabled && styles.disabled]}
        >
          {imageUri ? (
            <Image resizeMode="cover" source={{ uri: imageUrlForDevice(imageUri) }} style={styles.image} />
          ) : (
            <View style={styles.placeholder}>
              <Icon source="camera-plus-outline" color="#60706E" size={34} />
              <Text style={styles.placeholderText}>Agregar foto</Text>
            </View>
          )}

          {imageUri ? (
            <View style={styles.editBadge}>
              <Icon source="pencil" color="#FFFFFF" size={15} />
            </View>
          ) : null}
        </Pressable>
      )}
      onDismiss={() => setMenuVisible(false)}
      visible={menuVisible}
    >
      {Platform.OS !== 'web' ? (
        <Menu.Item
          leadingIcon="camera-outline"
          onPress={() => {
            setMenuVisible(false);
            onTakePhoto();
          }}
          title="Tomar foto"
        />
      ) : null}
      <Menu.Item
        leadingIcon="image-outline"
        onPress={() => {
          setMenuVisible(false);
          onChooseFromLibrary();
        }}
        title="Elegir de la galería"
      />
    </Menu>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 104,
    height: 104,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D7E0DE',
    borderRadius: 12,
    backgroundColor: '#EAEFEE',
  },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.6 },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { marginTop: 5, color: '#60706E', fontSize: 10, fontWeight: '700' },
  editBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#B4232D',
  },
});
