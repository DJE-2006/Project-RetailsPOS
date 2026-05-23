import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

type PickImageOpts = { aspect?: [number, number]; quality?: number; allowsEditing?: boolean };

export async function pickImage({ aspect = [1, 1] as [number, number], quality = 0.7, allowsEditing = true }: PickImageOpts = {}) {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Allow photo access to upload images.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing,
    aspect,
    quality,
  });
  if (result.canceled) return null;
  return { uri: result.assets[0].uri };
}
