/** Official printed names: A–Z only, always ALL CAPS. */
const PRINTED_NAME = /[^A-ZÑ\s.'-]/g

export function toPrintedName(name?: string): string | undefined {
  if (!name) return undefined
  const printed = name
    .toUpperCase()
    .replace(PRINTED_NAME, '')
    .replace(/\s+/g, ' ')
    .trim()
  return printed || undefined
}

/** Form field text printed in ALL CAPS (keeps numbers and other characters). */
export function toBlockLetters(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed.toUpperCase() : undefined
}
