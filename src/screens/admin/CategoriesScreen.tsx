import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Modal,
} from 'react-native';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../../firebase';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../utils/theme';
import { CONTENT_MAX_WIDTH, MODAL_MAX_WIDTH } from '../../utils/responsive';
import Button from '../../components/Button';

export default function CategoriesScreen() {
  const [categories, setCategories]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing]         = useState(null);
  const [catName, setCatName]         = useState('');
  const [catDesc, setCatDesc]         = useState('');
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const openAdd  = useCallback(() => { setEditing(null); setCatName(''); setCatDesc(''); setModalVisible(true); }, []);
  const openEdit = useCallback((cat) => { setEditing(cat); setCatName(cat.name); setCatDesc(cat.description || ''); setModalVisible(true); }, []);

  const handleSave = useCallback(async () => {
    if (!catName.trim()) { Alert.alert('Error', 'Category name is required.'); return; }
    setSaving(true);
    try {
      const data = { name: catName.trim(), description: catDesc.trim(), updatedAt: serverTimestamp() };
      if (editing) {
        await updateDoc(doc(db, 'categories', editing.id), data);
      } else {
        await addDoc(collection(db, 'categories'), { ...data, createdAt: serverTimestamp() });
      }
      setModalVisible(false);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }, [catName, catDesc, editing]);

  const handleDelete = useCallback((cat) =>
    Alert.alert('Delete Category', `Delete "${cat.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteDoc(doc(db, 'categories', cat.id)); }
        catch (e) { Alert.alert('Error', e.message); }
      }},
    ]),
  []);

  const renderItem = useCallback(({ item }) => (
    <View style={styles.catCard}>
      <View style={styles.catIcon}>
        <Ionicons name="pricetag" size={22} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.catName}>{item.name}</Text>
        {item.description ? <Text style={styles.catDesc}>{item.description}</Text> : null}
      </View>
      <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn} hitSlop={6}>
        <Ionicons name="pencil-outline" size={18} color={COLORS.primary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn} hitSlop={6}>
        <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
      </TouchableOpacity>
    </View>
  ), [openEdit, handleDelete]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  return (
    <View style={styles.container}>
      {/* Capped, centered column so rows do not stretch on desktop */}
      <View style={styles.body}>
      <FlatList
        data={categories}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="pricetag-outline" size={48} color={COLORS.border} />
            <Text style={styles.empty}>No categories yet. Tap + to add one.</Text>
          </View>
        }
        renderItem={renderItem}
      />
      </View>

      <TouchableOpacity style={styles.fab} onPress={openAdd} activeOpacity={0.85}>
        <Ionicons name="add" size={30} color={COLORS.white} />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Category' : 'New Category'}</Text>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={catName}
              onChangeText={setCatName}
              placeholder="e.g. Beverages"
              placeholderTextColor={COLORS.textLight}
            />
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={catDesc}
              onChangeText={setCatDesc}
              placeholder="Optional"
              placeholderTextColor={COLORS.textLight}
            />
            <View style={styles.modalBtns}>
              <Button
                title="Cancel"
                variant="secondary"
                style={styles.modalBtn}
                onPress={() => setModalVisible(false)}
              />
              <Button
                title="Save"
                style={styles.modalBtn}
                loading={saving}
                onPress={handleSave}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.background },
  body:       { flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  catCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOW.small,
  },
  catIcon:    { width: 46, height: 46, borderRadius: RADIUS.md, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  catName:    { fontWeight: '700', fontSize: FONTS.sizes.md, color: COLORS.text },
  catDesc:    { fontSize: FONTS.sizes.xs, color: COLORS.textSecond, marginTop: 2 },
  iconBtn:    { padding: SPACING.sm },
  emptyWrap:  { alignItems: 'center', marginTop: 80, gap: SPACING.md },
  empty:      { textAlign: 'center', color: COLORS.textLight, fontWeight: '600' },
  fab: {
    position: 'absolute', bottom: 28, right: 24, width: 60, height: 60,
    borderRadius: RADIUS.full, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', ...SHADOW.medium,
  },
  overlay:    { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  modal:      { width: '100%', maxWidth: MODAL_MAX_WIDTH, backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.xl, ...SHADOW.large },
  modalTitle: { fontSize: FONTS.sizes.xl, fontWeight: '800', marginBottom: SPACING.lg, color: COLORS.text },
  label:      { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text, marginBottom: 6, marginTop: SPACING.sm },
  input: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.md, fontSize: FONTS.sizes.md, color: COLORS.text,
    backgroundColor: COLORS.surfaceAlt,
  },
  modalBtns:  { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  modalBtn:   { flex: 1 },
});
