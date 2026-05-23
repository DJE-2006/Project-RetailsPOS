// ─── Cross-platform confirmation & alert dialogs ────────────────────
// react-native-web's Alert.alert() is a no-op, and window.confirm renders
// an unstyled native browser box. Instead, confirm()/alert() dispatch to a
// <ConfirmHost /> mounted once at the app root, which shows a styled,
// branded modal that behaves identically on web and native.
import { Alert } from 'react-native';

// A dialog can be a two-button confirmation or a single-button notice.
// `kind: 'alert'` renders one OK button with no destructive icon.
export type DialogKind = 'confirm' | 'alert';

// Visual tone for the icon / accent colour of a dialog.
export type DialogTone = 'default' | 'destructive' | 'error';

export type ConfirmOptions = {
  /** 'confirm' (two buttons, default) or 'alert' (single OK button). */
  kind?: DialogKind;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  /** Accent/icon tone. Falls back to destructive ? 'destructive' : 'default'. */
  tone?: DialogTone;
  onConfirm?: () => void;
  onCancel?: () => void;
};

type Listener = (opts: ConfirmOptions) => void;

let listener: Listener | null = null;

// Called by <ConfirmHost /> on mount; returns an unsubscribe fn.
export const registerConfirmHost = (fn: Listener) => {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
};

export const confirm = (opts: ConfirmOptions) => {
  const dialog: ConfirmOptions = { kind: 'confirm', ...opts };
  if (listener) {
    listener(dialog);
    return;
  }
  // Fallback if the host isn't mounted (native only — Alert is a no-op on web).
  Alert.alert(dialog.title, dialog.message, [
    { text: dialog.cancelText ?? 'Cancel', style: 'cancel', onPress: dialog.onCancel },
    {
      text: dialog.confirmText ?? 'OK',
      style: dialog.destructive ? 'destructive' : 'default',
      onPress: dialog.onConfirm,
    },
  ]);
};

// One-button notice modal — use for errors and info messages. Reads as a
// notification, not a question (no Cancel button, no destructive icon).
export type AlertOptions = {
  title: string;
  message?: string;
  /** Label for the single button. Defaults to 'OK'. */
  buttonText?: string;
  /** Accent/icon tone. Defaults to 'error'. */
  tone?: DialogTone;
  onClose?: () => void;
};

export const alert = (opts: AlertOptions) => {
  const dialog: ConfirmOptions = {
    kind: 'alert',
    title: opts.title,
    message: opts.message,
    confirmText: opts.buttonText ?? 'OK',
    tone: opts.tone ?? 'error',
    onConfirm: opts.onClose,
  };
  if (listener) {
    listener(dialog);
    return;
  }
  // Fallback if the host isn't mounted (native only — Alert is a no-op on web).
  Alert.alert(dialog.title, dialog.message, [
    { text: dialog.confirmText ?? 'OK', onPress: opts.onClose },
  ]);
};
