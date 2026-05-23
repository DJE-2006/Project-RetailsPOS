// Code-128 barcode encoding
// Converts text to bar/space widths that can be rendered with simple Views

// Symbol patterns for Code-128
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

// Encode text as Code-128, returning bar/space widths
// Throws if the text contains non-ASCII characters (outside 32-126)
export function encodeCode128(text: string): number[] {
  const values: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    if (code < 0 || code > 94) throw new Error(`Unsupported character: "${text[i]}"`);
    values.push(code);
  }

  // Calculate checksum
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

// Generate a random 13-digit barcode (12 random + 1 check digit)
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
