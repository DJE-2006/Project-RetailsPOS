import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  doc, addDoc, updateDoc, collection, getDocs,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { Ionicons } from '@expo/vector-icons';
import { db, storage } from '../../../firebase';
import { validateRequired, validatePrice, validateStock } from '../../utils/validation';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../utils/theme';
import { FORM_MAX_WIDTH } from '../../utils/responsive';
import { pickImage as pickImageShim } from '../../utils/imagePicker';
import { generateBarcode } from '../../utils/code128';
import { printBarcodeLabel, shareBarcodeLabel } from '../../utils/barcodeLabel';
import { alert } from '../../utils/confirm';
import Button from '../../components/Button';
import Barcode from '../../components/Barcode';
import BarcodeScanner from '../../components/BarcodeScanner';
import CategoryIcon, { hasCategoryIcon } from '../../components/CategoryIcon';

export default function AddEditProductScreen({ route, navigation }: any) {
  const existing = route.params?.product || null;

  const [name, setName]               = useState(existing?.name || '');
  const [price, setPrice]             = useState(existing?.price?.toString() || '');
  const [stock, setStock]             = useState(existing?.stock?.toString() || '');
  const [barcode, setBarcode]         = useState(existing?.barcode || '');
  const [categoryId, setCategoryId]   = useState(existing?.categoryId || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [imageUri, setImageUri]       = useState<string | null>(existing?.imageUrl || null);
  const [categories, setCategories]   = useState<any[]>([]);
  const [errors, setErrors]           = useState<Record<string, any>>({});
  const [saving, setSaving]           = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [labelBusy, setLabelBusy]     = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: existing ? 'Edit Product' : 'Add Product' });
    (async () => {
      const snap = await getDocs(query(collection(db, 'categories'), orderBy('name')));
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    })();
  }, [navigation, existing]);

  const catData = useMemo(() => [{ id: '', name: 'None' }, ...categories], [categories]);

  // Name of the chosen category — drives the category illustration preview.
  const selectedCatName = useMemo(
    () => categories.find((c) => c.id === categoryId)?.name as string | undefined,
    [categories, categoryId]
  );

  const pickImage = useCallback(async () => {
    const result = await pickImageShim({ aspect: [1, 1], quality: 0.7 });
    if (result?.uri) setImageUri(result.uri);
  }, []);

  const uploadImage = useCallback(async (productId) => {
    if (!imageUri || imageUri.startsWith('https://')) return null;
    setUploading(true);
    setUploadProgress(0);
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const path = `products/${productId}_${Date.now()}.jpg`;
      const storageRef = ref(storage, path);
      await new Promise<void>((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, blob);
        task.on('state_changed',
          (snap) => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100),
          reject, () => resolve()
        );
      });
      const url = await getDownloadURL(storageRef);
      return { url, path };
    } finally {
      setUploading(false);
    }
  }, [imageUri]);

  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    const nameErr  = validateRequired(name, 'Name');
    const priceErr = validatePrice(price);
    const stockErr = validateStock(stock);
    if (nameErr)  errs.name  = nameErr;
    if (priceErr) errs.price = priceErr;
    if (stockErr) errs.stock = stockErr;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name, price, stock]);

  // Print a physical product-label barcode (native print / web print dialog).
  const handlePrintLabel = useCallback(async () => {
    const value = barcode.trim();
    if (!value || labelBusy) return;
    setLabelBusy(true);
    try {
      await printBarcodeLabel(value, name.trim() || undefined);
    } catch (e: any) {
      alert({ title: 'Print Failed', message: e?.message ?? 'Unable to print the barcode label.' });
    } finally {
      setLabelBusy(false);
    }
  }, [barcode, name, labelBusy]);

  // Export the barcode label as a PDF to share (native) or print/save (web).
  const handleExportLabel = useCallback(async () => {
    const value = barcode.trim();
    if (!value || labelBusy) return;
    setLabelBusy(true);
    try {
      await shareBarcodeLabel(value, name.trim() || undefined);
    } catch (e: any) {
      alert({ title: 'Export Failed', message: e?.message ?? 'Unable to export the barcode label.' });
    } finally {
      setLabelBusy(false);
    }
  }, [barcode, name, labelBusy]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const productData: Record<string, any> = {
        name: name.trim(),
        price: parseFloat(price),
        stock: parseInt(stock, 10),
        barcode: barcode.trim(),
        categoryId,
        description: description.trim(),
        updatedAt: serverTimestamp(),
      };

      if (existing) {
        if (imageUri && !imageUri.startsWith('https://')) {
          const img = await uploadImage(existing.id);
          if (img) {
            productData.imageUrl = img.url;
            productData.imagePath = img.path;
            if (existing.imagePath) {
              try { await deleteObject(ref(storage, existing.imagePath)); } catch (_) {}
            }
          }
        } else {
          productData.imageUrl = imageUri || '';
        }
        await updateDoc(doc(db, 'products', existing.id), productData);
      } else {
        productData.createdAt = serverTimestamp();
        productData.imageUrl = '';
        productData.imagePath = '';
        const docRef = await addDoc(collection(db, 'products'), productData);
        if (imageUri) {
          const img = await uploadImage(docRef.id);
          if (img) await updateDoc(doc(db, 'products', docRef.id), { imageUrl: img.url, imagePath: img.path });
        }
        await addDoc(collection(db, 'inventory_logs'), {
          productId: docRef.id, productName: name.trim(),
          type: 'initial', quantity: parseInt(stock, 10),
          previousStock: 0, newStock: parseInt(stock, 10),
          transactionId: null, createdAt: serverTimestamp(),
        });
      }
      navigation.goBack();
    } catch (e: any) {
      alert({ title: 'Error', message: e?.message ?? 'Unknown error' });
    } finally {
      setSaving(false);
    }
  }, [validate, name, price, stock, barcode, categoryId, description, imageUri, existing, uploadImage, navigation]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Width-capped, centered column — does not stretch on tablet/desktop */}
        <View style={styles.column}>

        {/* Product visual — uploaded photo, or the category illustration as
            the default. Tap to override with a photo. */}
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.85}>
          {imageUri
            ? <Image source={{ uri: imageUri }} style={styles.productImage} />
            : hasCategoryIcon(selectedCatName)
              ? <CategoryIcon category={selectedCatName} size={130} radius={RADIUS.lg} />
              : <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera-outline" size={36} color={COLORS.textLight} />
                  <Text style={styles.imageHint}>Pick a category{'\n'}or tap to add image</Text>
                </View>
          }
          <View style={styles.imageEditBadge}>
            <Ionicons name="pencil" size={14} color={COLORS.white} />
          </View>
        </TouchableOpacity>
        {uploading && <Text style={styles.uploadingText}>Uploading… {Math.round(uploadProgress)}%</Text>}

        <Field label="Product Name *" value={name} onChange={setName} error={errors.name} placeholder="e.g. Mineral Water 500ml" />
        <Field label="Price (₱) *" value={price} onChange={setPrice} error={errors.price} placeholder="0.00" keyboardType="decimal-pad" />
        <Field label="Stock *" value={stock} onChange={setStock} error={errors.stock} placeholder="0" keyboardType="number-pad" />
        {/* Barcode — manual entry, camera/gun scan, or auto-generate */}
        <View style={{ marginBottom: SPACING.md }}>
          <Text style={styles.label}>Barcode</Text>
          <View style={styles.barcodeRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={barcode}
              onChangeText={setBarcode}
              placeholder="Optional"
              placeholderTextColor={COLORS.textLight}
              keyboardType="number-pad"
            />
            <TouchableOpacity style={styles.barcodeBtn} onPress={() => setScannerOpen(true)} activeOpacity={0.8}>
              <Ionicons name="scan-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.barcodeBtn} onPress={() => setBarcode(generateBarcode())} activeOpacity={0.8}>
              <Ionicons name="sparkles-outline" size={18} color={COLORS.accentDark} />
            </TouchableOpacity>
          </View>
          {barcode.trim().length > 0 && (
            <>
              <Barcode value={barcode.trim()} style={{ marginTop: SPACING.md }} />
              <View style={styles.labelActions}>
                <Button
                  title="Print Label"
                  icon="print-outline"
                  variant="secondary"
                  size="sm"
                  onPress={handlePrintLabel}
                  disabled={labelBusy}
                  style={styles.labelBtn}
                />
                <Button
                  title={Platform.OS === 'web' ? 'Save / Print' : 'Export'}
                  icon="share-outline"
                  variant="secondary"
                  size="sm"
                  onPress={handleExportLabel}
                  disabled={labelBusy}
                  style={styles.labelBtn}
                />
              </View>
            </>
          )}
        </View>

        <Field label="Description" value={description} onChange={setDescription} placeholder="Optional product description" multiline />

        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.lg }} contentContainerStyle={{ gap: SPACING.sm }}>
          {catData.map((cat) => {
            const active = categoryId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id || 'none'}
                style={[styles.catChip, active && styles.catChipActive]}
                onPress={() => setCategoryId(cat.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Button
          title={existing ? 'Save Changes' : 'Add Product'}
          icon={existing ? 'checkmark' : 'add'}
          size="lg"
          fullWidth
          loading={saving}
          disabled={uploading}
          onPress={handleSave}
        />
        </View>
      </ScrollView>

      <BarcodeScanner
        visible={scannerOpen}
        title="Scan Barcode"
        onClose={() => setScannerOpen(false)}
        onScanned={(code) => { setBarcode(code); setScannerOpen(false); }}
      />
    </KeyboardAvoidingView>
  );
}

const Field = React.memo(({ label, value, onChange, error, placeholder, keyboardType = 'default', multiline }: any) => (
  <View style={{ marginBottom: SPACING.md }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, error && styles.inputError, multiline && { height: 90, textAlignVertical: 'top' }]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textLight}
      keyboardType={keyboardType}
      multiline={multiline}
    />
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
));

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  scrollContent:{ padding: SPACING.xl, paddingBottom: SPACING.xxxl + SPACING.lg, alignItems: 'center' },
  column:       { width: '100%', maxWidth: FORM_MAX_WIDTH + 120, alignSelf: 'center' },
  imagePicker:  { alignSelf: 'center', marginBottom: SPACING.xl, position: 'relative' },
  productImage: { width: 130, height: 130, borderRadius: RADIUS.lg },
  imagePlaceholder: {
    width: 130, height: 130, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceAlt, borderWidth: 2,
    borderColor: COLORS.border, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  imageHint:    { fontSize: FONTS.sizes.xs, color: COLORS.textLight, marginTop: 4, textAlign: 'center' },
  imageEditBadge: {
    position: 'absolute', bottom: 4, right: 4, backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full, width: 32, height: 32, justifyContent: 'center', alignItems: 'center',
    ...SHADOW.small,
  },
  uploadingText:{ textAlign: 'center', color: COLORS.primary, marginBottom: SPACING.md, fontSize: FONTS.sizes.sm, fontWeight: '700' },
  label:        { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, fontSize: FONTS.sizes.md, color: COLORS.text,
  },
  inputError:   { borderColor: COLORS.danger, backgroundColor: COLORS.danger + '08' },
  errorText:    { fontSize: FONTS.sizes.xs, color: COLORS.danger, marginTop: 4 },
  barcodeRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  labelActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  labelBtn:     { flex: 1 },
  barcodeBtn: {
    width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center',
  },
  catChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  catChipActive:    { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText:      { fontSize: FONTS.sizes.sm, color: COLORS.textSecond, fontWeight: '600' },
  catChipTextActive:{ color: COLORS.white, fontWeight: '700' },
});
