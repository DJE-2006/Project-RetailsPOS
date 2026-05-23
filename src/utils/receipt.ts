// ─── Receipt text generation + sharing ──────────────────────
// Uses React Native's built-in Share API (no native dependency,
// works in Expo Go on all platforms).
import { Share } from 'react-native';
import { formatCurrency, formatDateTime } from './formatters';

const STORE_NAME = 'RetailPOS';

type ReceiptItem = { name: string; price: number; quantity: number; subtotal: number };
type ReceiptPayment = { method: string; amount: number; reference?: string };

export type ReceiptData = {
  transactionId: string;
  cashierName?: string;
  items: ReceiptItem[];
  payments: ReceiptPayment[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  totalPaid: number;
  change: number;
  createdAt?: any;
};

const pad = (label: string, value: string, width = 34) => {
  const free = Math.max(1, width - label.length - value.length);
  return label + ' '.repeat(free) + value;
};

export const buildReceiptText = (r: ReceiptData): string => {
  const lines: string[] = [];
  const ref = r.transactionId.slice(-6).toUpperCase();
  lines.push('================================');
  lines.push(`        ${STORE_NAME}`);
  lines.push('        Official Receipt');
  lines.push('================================');
  lines.push(`Receipt #: ${ref}`);
  lines.push(`Date: ${formatDateTime(r.createdAt || new Date())}`);
  if (r.cashierName) lines.push(`Cashier: ${r.cashierName}`);
  lines.push('--------------------------------');
  r.items.forEach((it) => {
    lines.push(it.name);
    lines.push(pad(`  ${it.quantity} x ${formatCurrency(it.price)}`, formatCurrency(it.subtotal)));
  });
  lines.push('--------------------------------');
  lines.push(pad('Subtotal', formatCurrency(r.subtotal)));
  lines.push(pad('VAT (12%)', formatCurrency(r.tax)));
  if (r.discount > 0) lines.push(pad('Discount', `-${formatCurrency(r.discount)}`));
  lines.push(pad('TOTAL', formatCurrency(r.total)));
  lines.push('--------------------------------');
  r.payments.forEach((p) => {
    const label = p.method.toUpperCase() + (p.reference ? ` (${p.reference})` : '');
    lines.push(pad(label, formatCurrency(p.amount)));
  });
  lines.push(pad('Amount Paid', formatCurrency(r.totalPaid)));
  if (r.change > 0) lines.push(pad('Change', formatCurrency(r.change)));
  lines.push('================================');
  lines.push('   Thank you for shopping!');
  lines.push('================================');
  return lines.join('\n');
};

export const shareReceipt = async (r: ReceiptData) => {
  const message = buildReceiptText(r);
  try {
    await Share.share({ message, title: `Receipt ${r.transactionId.slice(-6).toUpperCase()}` });
  } catch {
    // user dismissed share sheet — no-op
  }
};
