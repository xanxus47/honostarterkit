/** Minimal Code 128B barcode pattern generator (bars drawn by caller). */

const CODE128_B_START = 104
const CODE128_STOP = 106

// Patterns: 0 = bar, 1 = space widths (6 modules each value)
const PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]

function charValue(ch: string): number {
  const code = ch.charCodeAt(0)
  if (code < 32 || code > 127) return 0 // space fallback
  return code - 32
}

export function encodeCode128B(text: string): { widths: number[]; isBar: boolean }[] {
  const values = [CODE128_B_START, ...[...text].map(charValue)]
  let checksum = values[0]!
  for (let i = 1; i < values.length; i++) checksum += values[i]! * i
  checksum %= 103
  values.push(checksum, CODE128_STOP)

  const modules: { widths: number[]; isBar: boolean }[] = []
  for (const value of values) {
    const pattern = PATTERNS[value] ?? PATTERNS[0]!
    let isBar = true
    for (const digit of pattern) {
      modules.push({ widths: [Number(digit)], isBar })
      isBar = !isBar
    }
  }
  return modules
}
