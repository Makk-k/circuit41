import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export type PickedImage = {
  uri:      string;
  mimeType: string;
  fileName: string;
};

/**
 * Picks an image from the photo library.
 *
 * The 800ms delay exists because presenting PHPickerViewController inside an
 * Alert.alert or ActionSheetIOS dismiss callback crashes on iOS 16+ if the
 * dismissing UIAlertController is still in the window hierarchy when present()
 * is called. 800ms exceeds the longest observed dismiss animation.
 */
export function pickImageFromLibrary(): Promise<PickedImage | null> {
  return new Promise(resolve => {
    // Defer picker launch to let any dismissing Alert/ActionSheet fully complete
    // their native dismiss animation before presentPickerUI calls present().
    setTimeout(async () => {
      // ── Permission check ──────────────────────────────────────────────────────
      let permissionGranted = false;
      try {
        const current = await ImagePicker.getMediaLibraryPermissionsAsync();

        if (current.status === 'granted') {
          permissionGranted = true;
        } else if (current.status === 'undetermined') {
          const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
          permissionGranted = requested.status === 'granted';
        } else {
          permissionGranted = false;
        }
      } catch (permErr: any) {
        Alert.alert('Permission error', permErr.message || 'Could not check photo library access');
        resolve(null);
        return;
      }

      if (!permissionGranted) {
        Alert.alert(
          'Permission needed',
          'Please allow photo library access in Settings to upload images.',
        );
        resolve(null);
        return;
      }

      // ── Launch picker ─────────────────────────────────────────────────────────
      let result: ImagePicker.ImagePickerResult;
      try {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes:    ['images'],
          allowsEditing: false,
          quality:       0.7,
          base64:        false,
        });
      } catch (pickerErr: any) {
        Alert.alert('Error', pickerErr.message || 'Could not open photo library');
        resolve(null);
        return;
      }

      // ── Handle result ─────────────────────────────────────────────────────────
      if (result.canceled || !result.assets?.length) {
        resolve(null);
        return;
      }

      const asset = result.assets[0];

      if (!asset.uri) {
        Alert.alert('Error', 'Could not get image URI');
        resolve(null);
        return;
      }

      const ext      = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mimeType = asset.mimeType ?? (ext === 'png' ? 'image/png' : 'image/jpeg');
      const fileName = asset.fileName ?? ('photo_' + Date.now() + '.' + ext);

      resolve({ uri: asset.uri, mimeType, fileName });

    }, 800); // 800ms: exceeds the longest UIAlertController dismiss animation on iOS
  });
}
