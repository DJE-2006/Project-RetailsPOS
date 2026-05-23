import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { validateRegisterForm } from '../../utils/validation';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../utils/theme';
import { FORM_MAX_WIDTH } from '../../utils/responsive';
import { FadeInView, PressScale } from '../../utils/motion';
import { confirm, alert } from '../../utils/confirm';
import Button from '../../components/Button';

// Maps Firebase Auth registration error codes to friendly messages.
const REGISTER_ERR: Record<string, string> = {
  'auth/email-already-in-use':   'An account with this email already exists.',
  'auth/weak-password':          'Password is too weak. Use at least 6 characters.',
  'auth/invalid-email':          'Please enter a valid email address.',
  'auth/operation-not-allowed':  'Email/Password sign-in is disabled. Enable it in the Firebase Console.',
  'auth/network-request-failed': 'Network error. Check your internet connection and try again.',
  'auth/too-many-requests':      'Too many attempts. Please wait a moment and try again.',
};

const friendlyRegisterError = (code?: string) =>
  (code && REGISTER_ERR[code]) || 'Unable to create your account. Please try again.';

const ROLES = [
  { label: 'Cashier', value: 'cashier', icon: 'cash-outline',      color: COLORS.roleCashier },
  { label: 'Manager', value: 'manager', icon: 'briefcase-outline', color: COLORS.roleManager },
  { label: 'Admin',   value: 'admin',   icon: 'shield-outline',    color: COLORS.roleAdmin },
];

export default function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState('cashier');
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors]     = useState<Record<string, any>>({});
  const [loading, setLoading]   = useState(false);

  const handleRegister = useCallback(async () => {
    const { isValid, errors: errs } = validateRegisterForm({ name, email, password });
    if (!isValid) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password, role });
      // RootNavigator switches stacks automatically once user+profile are set.
      alert({
        title: 'Account Created',
        message: `Welcome, ${name.trim()}! You're now signed in as ${role}. Taking you to your dashboard…`,
        tone: 'default',
      });
    } catch (err: any) {
      console.error('Register error:', err);
      if (err?.code === 'auth/email-already-in-use') {
        confirm({
          title: 'Email Already Registered',
          message: `An account with ${email.trim()} already exists. Would you like to sign in instead?`,
          confirmText: 'Sign In',
          onConfirm: () => navigation.navigate('Login', { email: email.trim() }),
        });
        setLoading(false);
        return;
      }
      alert({ title: 'Registration Failed', message: friendlyRegisterError(err?.code) });
      setLoading(false);
    }
  }, [name, email, password, role, register, navigation]);

  const clearErr = (field) => (t) => {
    if (field === 'name') setName(t);
    if (field === 'email') setEmail(t);
    if (field === 'password') setPassword(t);
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Width-capped, centered column — does not stretch on tablet/desktop */}
        <View style={styles.formColumn}>

        <FadeInView style={styles.brand} offsetY={18}>
          <View style={styles.logoBox}>
            <Ionicons name="person-add" size={34} color={COLORS.white} />
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Register a new RetailPOS user</Text>
        </FadeInView>

        <FadeInView style={styles.card} delay={120}>
          <Text style={styles.label}>Full Name</Text>
          <View style={[styles.inputWrap, errors.name && styles.inputError]}>
            <Ionicons name="person-outline" size={18} color={COLORS.textLight} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Juan Dela Cruz"
              placeholderTextColor={COLORS.textLight}
              value={name}
              onChangeText={clearErr('name')}
            />
          </View>
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

          <Text style={[styles.label, { marginTop: SPACING.md }]}>Email</Text>
          <View style={[styles.inputWrap, errors.email && styles.inputError]}>
            <Ionicons name="mail-outline" size={18} color={COLORS.textLight} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textLight}
              value={email}
              onChangeText={clearErr('email')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

          <Text style={[styles.label, { marginTop: SPACING.md }]}>Password</Text>
          <View style={[styles.inputWrap, errors.password && styles.inputError]}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.textLight} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Min. 6 characters"
              placeholderTextColor={COLORS.textLight}
              value={password}
              onChangeText={clearErr('password')}
              secureTextEntry={!showPass}
            />
            <TouchableOpacity onPress={() => setShowPass((s) => !s)} hitSlop={10}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

          <Text style={[styles.label, { marginTop: SPACING.md }]}>Role</Text>
          <View style={styles.roleRow}>
            {ROLES.map((r) => {
              const active = role === r.value;
              return (
                <View
                  key={r.value}
                  style={[
                    styles.roleBtn,
                    active && { borderColor: r.color, backgroundColor: r.color + '12' },
                  ]}
                >
                  <PressScale
                    style={styles.roleBtnInner}
                    onPress={() => setRole(r.value)}
                  >
                    <Ionicons name={r.icon as any} size={22} color={active ? r.color : COLORS.textLight} />
                    <Text style={[styles.roleLabel, active && { color: r.color, fontWeight: '800' }]}>
                      {r.label}
                    </Text>
                  </PressScale>
                </View>
              );
            })}
          </View>

          <Button
            title="Create Account"
            size="lg"
            fullWidth
            loading={loading}
            onPress={handleRegister}
            style={styles.submitBtn}
          />
        </FadeInView>

        <FadeInView style={styles.footer} delay={240}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.link}>Sign In</Text>
          </TouchableOpacity>
        </FadeInView>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: COLORS.background },
  container:   { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  formColumn:  { width: '100%', maxWidth: FORM_MAX_WIDTH },
  brand:       { alignItems: 'center', marginBottom: SPACING.xl },
  logoBox: {
    width: 76, height: 76, borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.md, ...SHADOW.medium,
  },
  title:       { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text },
  subtitle:    { fontSize: FONTS.sizes.md, color: COLORS.textSecond, marginTop: 4 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    padding: SPACING.xl, ...SHADOW.medium,
  },
  label:       { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 50,
    backgroundColor: COLORS.surfaceAlt,
  },
  inputError:  { borderColor: COLORS.danger, backgroundColor: COLORS.danger + '08' },
  icon:        { marginRight: SPACING.sm },
  input:       { flex: 1, color: COLORS.text, fontSize: FONTS.sizes.md },
  errorText:   { fontSize: FONTS.sizes.xs, color: COLORS.danger, marginTop: 4 },
  roleRow:     { flexDirection: 'row', gap: SPACING.sm },
  roleBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
    overflow: 'hidden',
  },
  roleBtnInner: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  roleLabel:   { fontSize: FONTS.sizes.xs, color: COLORS.textSecond, fontWeight: '600' },
  submitBtn:   { marginTop: SPACING.xl },
  footer:      { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.xl },
  footerText:  { color: COLORS.textSecond, fontSize: FONTS.sizes.sm },
  link:        { color: COLORS.primary, fontWeight: '700', fontSize: FONTS.sizes.sm },
});
