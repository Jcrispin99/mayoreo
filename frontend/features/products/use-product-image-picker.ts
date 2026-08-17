import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Linking } from 'react-native';

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const IMAGE_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
};

type UseProductImagePickerOptions = {
  onError: (message: string) => void;
};

export function useProductImagePicker({ onError }: UseProductImagePickerOptions) {
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);

  function acceptResult(result: ImagePicker.ImagePickerResult) {
    if (result.canceled) return;

    const image = result.assets[0];
    if (image.fileSize && image.fileSize > MAX_IMAGE_SIZE) {
      onError('La imagen debe pesar como máximo 4 MB.');
      return;
    }

    setSelectedImage(image);
  }

  async function chooseFromLibrary() {
    onError('');

    try {
      acceptResult(await ImagePicker.launchImageLibraryAsync(IMAGE_OPTIONS));
    } catch {
      onError('No se pudo abrir la galería. Inténtalo nuevamente.');
    }
  }

  async function takePhoto() {
    onError('');

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        const message = permission.canAskAgain
          ? 'Permite el acceso a la cámara para tomar la foto del producto.'
          : 'Activa el permiso de cámara para Mayoreo desde la configuración del dispositivo.';

        onError(message);
        Alert.alert(
          'Permiso de cámara requerido',
          message,
          permission.canAskAgain
            ? [{ text: 'Entendido' }]
            : [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Abrir configuración', onPress: () => void Linking.openSettings() },
            ],
        );
        return;
      }

      acceptResult(await ImagePicker.launchCameraAsync(IMAGE_OPTIONS));
    } catch {
      onError('No se pudo abrir la cámara. Verifica el permiso e inténtalo nuevamente.');
    }
  }

  return {
    chooseFromLibrary,
    selectedImage,
    setSelectedImage,
    takePhoto,
  };
}
