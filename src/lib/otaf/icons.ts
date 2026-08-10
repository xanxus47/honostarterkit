import { rgb, type PDFPage, type RGB } from 'pdf-lib'

const blue = rgb(0.12, 0.28, 0.55)

/** Small calendar icon (right of date field). */
export function drawCalendarIcon(page: PDFPage, x: number, y: number, size = 9, color: RGB = blue) {
  page.drawRectangle({
    x,
    y,
    width: size,
    height: size * 0.85,
    borderColor: color,
    borderWidth: 0.8,
  })
  page.drawRectangle({
    x,
    y: y + size * 0.55,
    width: size,
    height: size * 0.3,
    color,
  })
  // rings
  page.drawLine({
    start: { x: x + size * 0.25, y: y + size * 0.85 },
    end: { x: x + size * 0.25, y: y + size * 0.65 },
    thickness: 0.8,
    color,
  })
  page.drawLine({
    start: { x: x + size * 0.75, y: y + size * 0.85 },
    end: { x: x + size * 0.75, y: y + size * 0.65 },
    thickness: 0.8,
    color,
  })
}

/** Small clock icon. */
export function drawClockIcon(page: PDFPage, x: number, y: number, size = 9, color: RGB = blue) {
  const cx = x + size / 2
  const cy = y + size / 2
  page.drawCircle({
    x: cx,
    y: cy,
    size: size / 2,
    borderColor: color,
    borderWidth: 0.8,
  })
  page.drawLine({
    start: { x: cx, y: cy },
    end: { x: cx, y: cy + size * 0.28 },
    thickness: 0.7,
    color,
  })
  page.drawLine({
    start: { x: cx, y: cy },
    end: { x: cx + size * 0.22, y: cy },
    thickness: 0.7,
    color,
  })
}

/** Clipboard icon for reminders header. */
export function drawClipboardIcon(page: PDFPage, x: number, y: number, size = 10, color: RGB = blue) {
  page.drawRectangle({
    x,
    y,
    width: size * 0.85,
    height: size,
    borderColor: color,
    borderWidth: 0.8,
  })
  page.drawRectangle({
    x: x + size * 0.18,
    y: y + size * 0.78,
    width: size * 0.5,
    height: size * 0.28,
    borderColor: color,
    borderWidth: 0.7,
    color: rgb(1, 1, 1),
  })
  for (let i = 0; i < 3; i++) {
    page.drawLine({
      start: { x: x + 1.5, y: y + 2 + i * 2.2 },
      end: { x: x + size * 0.7, y: y + 2 + i * 2.2 },
      thickness: 0.6,
      color,
    })
  }
}
