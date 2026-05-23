import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { validateLoginForm } from '../../utils/validation';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../utils/theme';
import { FORM_MAX_WIDTH } from '../../utils/responsive';
import { FadeInView } from '../../utils/motion';
import { confirm, alert } from '../../utils/confirm';
import Button from '../../components/Button';

// Maps Firebase Auth error codes to friendly, user-facing messages.
const AUTH_ERR: Record<string, string> = {
  'auth/wrong-password':     'Incorrect email or password. Please try again.',
  'auth/invalid-credential': 'Incorrect email or password. Please try again.',
  'auth/user-not-found':     'No account is registered with this email.',
  'auth/invalid-email':      'Please enter a valid email address.',
  'auth/too-many-requests':  'Too many attempts. Please wait a moment and try again.',
  'auth/user-disabled':      'This account has been deactivated. Contact your administrator.',
  'auth/no-profile':         'No account is registered with this email.',
  'auth/network-request-failed': 'Network error. Check your internet connection and try again.',
};

const friendlyAuthError = (code?: string) =>
  (code && AUTH_ERR[code]) || 'Unable to sign in. Please try again.';

export default function LoginScreen({ navigation, route }: any) {
  const { login, sendResetEmail } = useAuth();
  const [email, setEmail]       = useState(route?.params?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors]     = useState<Record<string, any>>({});
  const [loading, setLoading]   = useState(false);

  const handleLogin = useCallback(async () => {
    const { isValid, errors: errs } = validateLoginForm({ email, password });
    if (!isValid) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      alert({ title: 'Login Failed', message: friendlyAuthError(err?.code) });
    } finally {
      setLoading(false);
    }
  }, [email, password, login]);

  const handleForgot = useCallback(() => {
    if (!email.trim()) {
      alert({
        title: 'Reset Password',
        message: 'Enter your email above first, then tap Forgot Password again.',
        tone: 'default',
      });
      return;
    }
    confirm({
      title: 'Reset Password',
      message: `Send a password reset link to ${email.trim()}?`,
      confirmText: 'Send',
      onConfirm: async () => {
        try {
          await sendResetEmail(email.trim());
          alert({
            title: 'Email Sent',
            message: 'Check your inbox for the reset link.',
            tone: 'default',
          });
        } catch (e: any) {
          alert({ title: 'Error', message: friendlyAuthError(e?.code) });
        }
      },
    });
  }, [email, sendResetEmail]);

  const onChangeEmail = (t) => { setEmail(t); if (errors.email) setErrors((e) => ({ ...e, email: null })); };
  const onChangePass  = (t) => { setPassword(t); if (errors.password) setErrors((e) => ({ ...e, password: null })); };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Width-capped, centered column — does not stretch on tablet/desktop */}
        <View style={styles.formColumn}>

        {/* Brand */}
        <FadeInView style={styles.brand} offsetY={18}>
          <View style={styles.logoBox}>
            <Ionicons name="storefront" size={42} color={COLORS.white} />
          </View>
          <Text style={styles.title}>RetailPOS</Text>
          <Text style={styles.subtitle}>Sign in to start your shift</Text>
        </FadeInView>

        {/* Card */}
        <FadeInView style={styles.card} delay={120}>
          <Text style={styles.label}>Email</Text>
          <View style={[styles.inputWrap, errors.email && styles.inputError]}>
            <Ionicons name="mail-outline" size={18} color={COLORS.textLight} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textLight}
              value={email}
              onChangeText={onChangeEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

          <View style={styles.labelRow}>
            <Text style={styles.label}>Password</Text>
            <TouchableOpacity onPress={handleForgot}>
              <Text style={styles.forgot}>Forgot?</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.inputWrap, errors.password && styles.inputError]}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.textLight} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textLight}
              value={password}
              onChangeText={onChangePass}
              secureTextEntry={!showPass}
            />
            <TouchableOpacity onPress={() => setShowPass((s) => !s)} hitSlop={10}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

          <Button
            title="Sign In"
            iconRight="arrow-forward"
            size="lg"
            fullWidth
            loading={loading}
            onPress={handleLogin}
            style={styles.submitBtn}
          />
        </FadeInView>

        <FadeInView style={styles.footer} delay={240}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.link}>Register</Text>
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
  brand:       { alignItems: 'center', marginBottom: SPACING.xxl },
  logoBox: {
    width: 88, height: 88, borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOW.medium,
  },
  title:       { fontSize: FONTS.sizes.xxxl, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  subtitle:    { fontSize: FONTS.sizes.md, color: COLORS.textSecond, marginTop: 6 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    padding: SPACING.xl, ...SHADOW.medium,
  },
  label:       { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  labelRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.md },
  forgot:      { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.primary },
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
  submitBtn:   { marginTop: SPACING.xl },
  footer:      { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.xl },
  footerText:  { color: COLORS.textSecond, fontSize: FONTS.sizes.sm },
  link:        { color: COLORS.primary, fontWeight: '700', fontSize: FONTS.sizes.sm },
});
