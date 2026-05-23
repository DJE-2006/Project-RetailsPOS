// ─── Printable / shareable barcode labels ───────────────────────────
// Builds a self-contained HTML document that renders a Code-128 barcode
// for a product, then prints it (expo-print) or exports it as a PDF the
// user can share (expo-sharing). On web it opens the browser print
// dialog directly so the user can print or "Save as PDF".
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { encodeCode128 } from './code128';

// Escapes a string for safe interpolation into HTML text/attributes.
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));

/**
 * Builds an HTML document rendering `value` as a Code-128 barcode label,
 * sized for a printable product label. The bars are emitted as a flexbox
 * row of black/white <span> elements derived from encodeCode128() module
 * widths — no images or external fonts, so it prints identically
 * everywhere. Returns null if the value can't be encoded.
 */
export function buildBarcodeLabelHtml(value: string, productName?: string): string | null {
  const code = value.trim();
  if (!code) return null;

  let modules: number[];
  try {
    modules = encodeCode128(code);
  } catch {
    return null;
  }

  const totalModules = modules.reduce((a, b) => a + b, 0);
  // The bar area is 320px wide on the label; one module = this many px.
  const BAR_AREA_PX = 320;
  const unit = BAR_AREA_PX / totalModules;

  const bars = modules
    .map((m, i) => {
      // Even indices are bars (black), odd are spaces (white).
      const color = i % 2 === 0 ? '#000' : '#fff';
      return `<span style="display:inline-block;width:${(m * unit).toFixed(3)}px;height:90px;background:${color};"></span>`;
    })
    .join('');

  const nameRow = productName && productName.trim()
    ? `<div class="name">${escapeHtml(productName.trim())}</div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Barcode ${escapeHtml(code)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .label {
    width: 360px;
    margin: 24px auto;
    padding: 16px 20px;
    border: 1px solid #E2E8F0;
    border-radius: 12px;
    text-align: center;
    background: #fff;
  }
  .name {
    font-size: 14px;
    font-weight: 700;
    color: #0F172A;
    margin-bottom: 10px;
    word-break: break-word;
  }
  .bars {
    display: flex;
    align-items: stretch;
    justify-content: center;
    height: 90px;
    font-size: 0;
    line-height: 0;
  }
  .code {
    margin-top: 8px;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 3px;
    color: #0F172A;
  }
  @media print {
    .label { margin: 0 auto; border: none; }
    @page { margin: 8mm; }
  }
</style>
</head>
<body>
  <div class="label">
    ${nameRow}
    <div class="bars">${bars}</div>
    <div class="code">${escapeHtml(code)}</div>
  </div>
</body>
</html>`;
}

/**
 * Opens the platform print dialog for a barcode label. Works on native
 * (expo-print) and on web (browser print dialog).
 * Throws if the value can't be encoded as Code-128.
 */
export async function printBarcodeLabel(value: string, productName?: string): Promise<void> {
  const html = buildBarcodeLabelHtml(value, productName);
  if (!html) throw new Error(`Cannot generate a barcode for "${value}".`);
  await Print.printAsync({ html });
}

/**
 * Exports a barcode label so the user can share or save it.
 * - Native: renders to a PDF (Print.printToFileAsync) then opens the OS
 *   share sheet (Sharing.shareAsync). Falls back to the print dialog if
 *   sharing is unavailable on the device.
 * - Web: there is no share sheet, so this opens the browser print dialog
 *   (which also offers "Save as PDF").
 * Throws if the value can't be encoded as Code-128.
 */
export async function shareBarcodeLabel(value: string, productName?: string): Promise<void> {
  const html = buildBarcodeLabelHtml(value, productName);
  if (!html) throw new Error(`Cannot generate a barcode for "${value}".`);

  if (Platform.OS === 'web') {
    // No native share sheet on web — the print dialog covers print + PDF.
    await Print.printAsync({ html });
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Barcode Label',
      UTI: 'com.adobe.pdf',
    });
  } else {
    // Sharing unavailable — fall back to printing the label directly.
    await Print.printAsync({ html });
  }
}
