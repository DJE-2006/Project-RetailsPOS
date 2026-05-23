// ─── BarcodeScanner ─────────────────────────────────────────────────
// A modal barcode scanner with live camera scanning on BOTH native and
// web, plus a hardware-scanner / manual-entry fallback that is always
// reachable.
//
//  • Native: expo-camera's <CameraView> reads EAN/UPC/Code-128/QR codes.
//    The permission flow re-renders on grant and, when permission is
//    permanently denied, offers a button to open the OS settings.
//  • Web: uses the browser-native BarcodeDetector API on a getUserMedia
//    video stream (reliable on Chromium browsers). When the camera or
//    BarcodeDetector is unavailable, or permission is denied, it falls
//    back to the scan-gun / manual-entry field.
//  • The "Enter Code Manually" fallback can be toggled on any platform.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity,
  TextInput, Platform, Linking,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeType } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../utils/theme';
import Button from './Button';

type Props = {
  visible: boolean;
  onClose: () => void;
  onScanned: (value: string) => void;
  title?: string;
};

const BARCODE_TYPES: BarcodeType[] = [
  'ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'qr',
];

export default function BarcodeScanner({ visible, onClose, onScanned, title = 'Scan Barcode' }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {Platform.OS === 'web'
            ? <WebScanner visible={visible} onScanned={onScanned} />
            : <CameraScanner visible={visible} onScanned={onScanned} />
          }
        </View>
      </View>
    </Modal>
  );
}

// ── Native: live camera scanning ────────────────────────────────────
function CameraScanner({ visible, onScanned }: { visible: boolean; onScanned: (v: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual]       = useState(false);
  const [requesting, setRequesting] = useState(false);
  // Guards against the camera firing the same code dozens of times.
  const handled = useRef(false);

  useEffect(() => { if (visible) { handled.current = false; setManual(false); } }, [visible]);

  // Auto-request permission the first time the scanner is opened, so the
  // OS prompt appears immediately instead of needing an extra tap. The
  // hook's state updates (and this component re-renders) once granted.
  useEffect(() => {
    if (!visible || manual) return;
    if (permission && !permission.granted && permission.canAskAgain) {
      askPermission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, permission?.granted, permission?.canAskAgain, manual]);

  const askPermission = useCallback(async () => {
    setRequesting(true);
    try { await requestPermission(); }
    finally { setRequesting(false); }
  }, [requestPermission]);

  const handleScan = useCallback((data: string) => {
    if (handled.current) return;
    handled.current = true;
    onScanned(data.trim());
  }, [onScanned]);

  if (manual) {
    return (
      <View>
        <ManualEntry onScanned={onScanned} />
        <Button title="Use Camera" variant="secondary" icon="camera" onPress={() => setManual(false)} fullWidth />
      </View>
    );
  }

  // Permission state still loading.
  if (!permission || requesting) {
    return (
      <View style={styles.permission}>
        <Ionicons name="camera-outline" size={40} color={COLORS.textLight} />
        <Text style={styles.info}>Requesting camera access…</Text>
        <Button title="Enter Code Manually" variant="secondary" onPress={() => setManual(true)} fullWidth />
      </View>
    );
  }

  // Permission not granted.
  if (!permission.granted) {
    // Permanently denied — the OS prompt won't show again; deep-link to settings.
    if (!permission.canAskAgain) {
      return (
        <View style={styles.permission}>
          <Ionicons name="camera-outline" size={40} color={COLORS.textLight} />
          <Text style={styles.info}>
            Camera access is blocked. Enable it in your device settings to scan barcodes.
          </Text>
          <Button title="Open Settings" icon="settings-outline" onPress={() => Linking.openSettings()} fullWidth />
          <Button title="Enter Code Manually" variant="secondary" onPress={() => setManual(true)} fullWidth />
        </View>
      );
    }
    // Can still ask — offer the grant button.
    return (
      <View style={styles.permission}>
        <Ionicons name="camera-outline" size={40} color={COLORS.textLight} />
        <Text style={styles.info}>Camera access is needed to scan barcodes.</Text>
        <Button title="Grant Camera Access" icon="camera" onPress={askPermission} fullWidth />
        <Button title="Enter Code Manually" variant="secondary" onPress={() => setManual(true)} fullWidth />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          onBarcodeScanned={({ data }) => handleScan(data)}
        />
        <View style={styles.reticle} />
      </View>
      <Text style={styles.hint}>Point the camera at a product barcode.</Text>
      <Button title="Enter Code Manually" variant="secondary" onPress={() => setManual(true)} fullWidth />
    </View>
  );
}

// ── Web: live camera scanning via BarcodeDetector ───────────────────
type WebStatus = 'idle' | 'starting' | 'scanning' | 'denied' | 'unsupported' | 'error';

function WebScanner({ visible, onScanned }: { visible: boolean; onScanned: (v: string) => void }) {
  const [manual, setManual] = useState(false);
  const [status, setStatus] = useState<WebStatus>('idle');

  const videoRef    = useRef<any>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const rafRef      = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);
  const handled     = useRef(false);

  // True when the browser exposes both getUserMedia and BarcodeDetector.
  const cameraSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof (globalThis as any).BarcodeDetector !== 'undefined';

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.srcObject = null; } catch {}
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!cameraSupported) { setStatus('unsupported'); return; }
    handled.current = false;
    setStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) { stopCamera(); setStatus('error'); return; }
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.muted = true;
      await video.play();

      const BarcodeDetector = (globalThis as any).BarcodeDetector;
      let formats: string[] | undefined;
      try {
        const supported: string[] = await BarcodeDetector.getSupportedFormats();
        const wanted = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'qr_code'];
        formats = wanted.filter((f) => supported.includes(f));
      } catch { formats = undefined; }
      detectorRef.current = new BarcodeDetector(formats && formats.length ? { formats } : undefined);

      setStatus('scanning');

      const tick = async () => {
        if (handled.current) return;
        const v = videoRef.current;
        if (v && v.readyState >= 2 && detectorRef.current) {
          try {
            const codes = await detectorRef.current.detect(v);
            if (codes && codes.length && codes[0].rawValue) {
              handled.current = true;
              stopCamera();
              onScanned(String(codes[0].rawValue).trim());
              return;
            }
          } catch { /* transient detect error — keep scanning */ }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err: any) {
      stopCamera();
      // NotAllowedError / SecurityError -> permission denied by the user.
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        setStatus('denied');
      } else {
        setStatus('error');
      }
    }
  }, [cameraSupported, onScanned, stopCamera]);

  // Start the camera when the modal opens; tear it down when it closes
  // or the user switches to manual entry.
  useEffect(() => {
    if (visible && !manual && cameraSupported) {
      startCamera();
    }
    return stopCamera;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, manual]);

  if (manual || !cameraSupported || status === 'unsupported') {
    return (
      <View>
        <View style={styles.webBanner}>
          <Ionicons name="barcode-outline" size={22} color={COLORS.primary} />
          <Text style={styles.webBannerText}>
            Scan with a barcode gun or type the code, then press Enter.
          </Text>
        </View>
        <ManualEntry onScanned={onScanned} autoFocus={visible} />
        {cameraSupported && (
          <Button
            title="Use Camera"
            variant="secondary"
            icon="camera"
            onPress={() => { setManual(false); }}
            fullWidth
          />
        )}
      </View>
    );
  }

  if (status === 'denied' || status === 'error') {
    return (
      <View style={styles.permission}>
        <Ionicons name="camera-outline" size={40} color={COLORS.textLight} />
        <Text style={styles.info}>
          {status === 'denied'
            ? 'Camera access was blocked. Allow it in your browser, then retry — or enter the code manually.'
            : 'Could not start the camera. Retry or enter the code manually.'}
        </Text>
        <Button title="Retry Camera" icon="camera" onPress={startCamera} fullWidth />
        <Button title="Enter Code Manually" variant="secondary" onPress={() => setManual(true)} fullWidth />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.cameraWrap}>
        {/* react-native-web renders unknown tags via createElement; a
            plain <video> element is the simplest reliable preview. */}
        {React.createElement('video', {
          ref: videoRef,
          style: { width: '100%', height: '100%', objectFit: 'cover' },
          playsInline: true,
          muted: true,
        })}
        <View style={styles.reticle} pointerEvents="none" />
        {status === 'starting' && (
          <View style={styles.webStarting} pointerEvents="none">
            <Text style={styles.webStartingText}>Starting camera…</Text>
          </View>
        )}
      </View>
      <Text style={styles.hint}>Point the camera at a product barcode.</Text>
      <Button title="Enter Code Manually" variant="secondary" onPress={() => setManual(true)} fullWidth />
    </View>
  );
}

// Shared fast-entry field — used on web and as a native fallback.
function ManualEntry({ onScanned, autoFocus = true }: { onScanned: (v: string) => void; autoFocus?: boolean }) {
  const [code, setCode] = useState('');

  const submit = useCallback(() => {
    const v = code.trim();
    if (v) onScanned(v);
    setCode('');
  }, [code, onScanned]);

  return (
    <View>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        onSubmitEditing={submit}
        placeholder="Barcode number…"
        placeholderTextColor={COLORS.textLight}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        returnKeyType="done"
      />
      <Button title="Look Up" icon="search" onPress={submit} disabled={!code.trim()} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: SPACING.xl,
  },
  sheet: {
    width: '100%', maxWidth: 380, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl, padding: SPACING.xl, gap: SPACING.md, ...SHADOW.large,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:  { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text },

  cameraWrap: {
    width: '100%', aspectRatio: 1, borderRadius: RADIUS.lg,
    overflow: 'hidden', backgroundColor: '#000', justifyContent: 'center', alignItems: 'center',
  },
  reticle: {
    position: 'absolute',
    width: '70%', height: '40%', borderWidth: 3,
    borderColor: COLORS.accent, borderRadius: RADIUS.md,
  },
  webStarting: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
  },
  webStartingText: { color: COLORS.white, fontSize: FONTS.sizes.sm, fontWeight: '700' },
  hint: { textAlign: 'center', color: COLORS.textSecond, fontSize: FONTS.sizes.sm, fontWeight: '600' },

  permission: { alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md },
  info: { textAlign: 'center', color: COLORS.textSecond, fontSize: FONTS.sizes.sm },

  webBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.md, padding: SPACING.md,
  },
  webBannerText: { flex: 1, color: COLORS.primaryDark, fontSize: FONTS.sizes.xs, fontWeight: '600' },

  input: {
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, fontSize: FONTS.sizes.lg,
    color: COLORS.text, letterSpacing: 1, textAlign: 'center', marginBottom: SPACING.md,
  },
});
