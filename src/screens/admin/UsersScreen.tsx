import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, Image, Modal, ScrollView,
} from 'react-native';
import { collection, onSnapshot, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../../firebase';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime, getRoleColor, getRoleLabel } from '../../utils/formatters';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../utils/theme';
import { CONTENT_MAX_WIDTH, MODAL_MAX_WIDTH } from '../../utils/responsive';

const ROLES = ['cashier', 'manager', 'admin'];

export default function UsersScreen() {
  const { profile: me, sendResetEmail } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleRoleChange = useCallback(async (user, newRole) => {
    if (user.id === me?.uid) { Alert.alert('Not allowed', "You can't change your own role."); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.id), { role: newRole });
      setSelected((prev) => prev ? { ...prev, role: newRole } : null);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }, [me]);

  const handleToggleActive = useCallback(async (user) => {
    if (user.id === me?.uid) { Alert.alert('Not allowed', "You can't deactivate yourself."); return; }
    try {
      await updateDoc(doc(db, 'users', user.id), { isActive: !user.isActive });
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }, [me]);

  const handleResetPassword = useCallback((user) => {
    if (!user?.email) { Alert.alert('No email', 'This user has no email on file.'); return; }
    Alert.alert(
      'Send Password Reset',
      `Send a password reset link to ${user.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            setResetting(true);
            try {
              await sendResetEmail(user.email);
              Alert.alert('Sent', `A reset link has been sent to ${user.email}.`);
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to send reset email.');
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  }, [sendResetEmail]);

  const renderUser = useCallback(({ item }) => {
    const roleColor = getRoleColor(item.role);
    const initial = (item.name || '?')[0].toUpperCase();
    return (
      <TouchableOpacity style={styles.userCard} onPress={() => setSelected(item)} activeOpacity={0.85}>
        {item.avatarUrl
          ? <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
          : <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: roleColor + '20' }]}>
              <Text style={[styles.avatarInitial, { color: roleColor }]}>{initial}</Text>
            </View>
        }
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.roleBadge, { backgroundColor: roleColor + '18' }]}>
              <Text style={[styles.roleText, { color: roleColor }]}>{getRoleLabel(item.role)}</Text>
            </View>
            {!item.isActive && (
              <View style={[styles.roleBadge, { backgroundColor: COLORS.danger + '18' }]}>
                <Text style={[styles.roleText, { color: COLORS.danger }]}>Inactive</Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
      </TouchableOpacity>
    );
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  return (
    <View style={styles.container}>
      {/* Capped, centered column so rows do not stretch on desktop */}
      <View style={styles.body}>
      <FlatList
        data={users}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING.xxl }}
        renderItem={renderUser}
      />
      </View>

      {/* User Detail Modal */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <TouchableOpacity style={styles.modalClose} onPress={() => setSelected(null)}>
              <Ionicons name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  {selected.avatarUrl
                    ? <Image source={{ uri: selected.avatarUrl }} style={styles.modalAvatar} />
                    : <View style={[styles.modalAvatar, styles.avatarPlaceholder, { backgroundColor: getRoleColor(selected.role) + '20' }]}>
                        <Text style={[styles.modalInitial, { color: getRoleColor(selected.role) }]}>
                          {(selected.name || '?')[0].toUpperCase()}
                        </Text>
                      </View>
                  }
                  <Text style={styles.modalName}>{selected.name}</Text>
                  <Text style={styles.modalEmail}>{selected.email}</Text>
                  <Text style={styles.modalDate}>Joined: {formatDateTime(selected.createdAt)}</Text>
                </View>

                <Text style={styles.sectionLabel}>Role</Text>
                <View style={styles.roleRow}>
                  {ROLES.map((r) => {
                    const active = selected.role === r;
                    const c = getRoleColor(r);
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[styles.roleOpt, active && { backgroundColor: c, borderColor: c }]}
                        onPress={() => handleRoleChange(selected, r)}
                        disabled={saving}
                      >
                        <Text style={[styles.roleOptText, active && { color: COLORS.white }]}>
                          {getRoleLabel(r)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.sectionLabel}>Security</Text>
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => handleResetPassword(selected)}
                  disabled={resetting}
                >
                  <View style={[styles.actionIcon, { backgroundColor: COLORS.primary + '15' }]}>
                    <Ionicons name="key-outline" size={18} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionTitle}>Send Password Reset</Text>
                    <Text style={styles.actionSub}>Email a secure reset link to this user</Text>
                  </View>
                  {resetting
                    ? <ActivityIndicator size="small" color={COLORS.primary} />
                    : <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    { backgroundColor: selected.isActive ? COLORS.danger + '15' : COLORS.success + '15' },
                  ]}
                  onPress={() => handleToggleActive(selected)}
                >
                  <Ionicons
                    name={selected.isActive ? 'ban-outline' : 'checkmark-circle-outline'}
                    size={18}
                    color={selected.isActive ? COLORS.danger : COLORS.success}
                  />
                  <Text style={{
                    color: selected.isActive ? COLORS.danger : COLORS.success,
                    fontWeight: '700',
                    marginLeft: 6,
                  }}>
                    {selected.isActive ? 'Deactivate Account' : 'Activate Account'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.background },
  body:             { flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  userCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOW.small,
  },
  avatar:           { width: 52, height: 52, borderRadius: 26, marginRight: SPACING.md },
  avatarPlaceholder:{ justifyContent: 'center', alignItems: 'center' },
  avatarInitial:    { fontSize: FONTS.sizes.lg, fontWeight: '800' },
  userInfo:         { flex: 1 },
  userName:         { fontWeight: '700', fontSize: FONTS.sizes.md, color: COLORS.text },
  userEmail:        { fontSize: FONTS.sizes.xs, color: COLORS.textSecond, marginTop: 2 },
  badgeRow:         { flexDirection: 'row', gap: SPACING.sm, marginTop: 6 },
  roleBadge:        { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  roleText:         { fontSize: FONTS.sizes.xs, fontWeight: '700' },
  overlay:          { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end', alignItems: 'center' },
  modal: {
    width: '100%', maxWidth: MODAL_MAX_WIDTH,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl, maxHeight: '78%',
  },
  handle:           { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginBottom: SPACING.sm },
  modalClose:       { alignSelf: 'flex-end', padding: SPACING.xs },
  modalHeader:      { alignItems: 'center', marginBottom: SPACING.lg },
  modalAvatar:      { width: 84, height: 84, borderRadius: 42, marginBottom: SPACING.md },
  modalInitial:     { fontSize: FONTS.sizes.xxl, fontWeight: '800' },
  modalName:        { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text },
  modalEmail:       { color: COLORS.textSecond, marginTop: 2 },
  modalDate:        { fontSize: FONTS.sizes.xs, color: COLORS.textLight, marginTop: 4 },
  sectionLabel:     { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm, marginTop: SPACING.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  roleRow:          { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  roleOpt: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm, alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  roleOptText:      { fontWeight: '700', color: COLORS.textSecond, fontSize: FONTS.sizes.sm },
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.md, gap: SPACING.md,
  },
  actionIcon:       { width: 36, height: 36, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center' },
  actionTitle:      { fontWeight: '700', color: COLORS.text, fontSize: FONTS.sizes.sm },
  actionSub:        { fontSize: FONTS.sizes.xs, color: COLORS.textSecond, marginTop: 2 },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.lg,
  },
});
