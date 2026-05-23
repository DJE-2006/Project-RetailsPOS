// ─── Code-128 barcode encoding (code set B) ─────────────────────────
// Pure, dependency-free encoder used by <Barcode />. Turns a string into
// an array of module widths (alternating bar / space, starting with a
// bar) that can be drawn with plain Views — no SVG or native lib needed.

// Canonical Code-128 symbol table: index 0-106, each a string of element
// widths (bar,space,bar,space,bar,space — the stop pattern has 7).
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
];

const START_B = 104;
const STOP = 106;

/**
 * Encodes `text` as Code-128 set B. Returns module widths alternating
 * bar, space, bar, … starting and ending with a bar.
 * Throws if the string contains a character outside ASCII 32-126.
 */
export function encodeCode128(text: string): number[] {
  const values: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    if (code < 0 || code > 94) throw new Error(`Unsupported character: "${text[i]}"`);
    values.push(code);
  }

  // Modulo-103 checksum: start value + Σ value·position (1-indexed).
  let checksum = START_B;
  values.forEach((v, i) => { checksum += v * (i + 1); });
  checksum %= 103;

  const symbols = [START_B, ...values, checksum, STOP];
  const modules: number[] = [];
  symbols.forEach((s) => {
    for (const ch of PATTERNS[s]) modules.push(parseInt(ch, 10));
  });
  return modules;
}

/**
 * Generates a fresh 13-digit EAN-13-style code (12 random digits plus a
 * valid check digit). Used by the "Generate" button when adding products.
 */
export function generateBarcode(): string {
  let base = '';
  for (let i = 0; i < 12; i++) base += Math.floor(Math.random() * 10);

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(base[i], 10);
    sum += i % 2 === 0 ? d : d * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}
