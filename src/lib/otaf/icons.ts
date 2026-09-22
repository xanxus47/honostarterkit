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

/** Small clipboard icon. */
export function drawClipboardIcon(page: PDFPage, x: number, y: number, size = 9, color: RGB = blue) {
  page.drawRectangle({
    x,
    y,
    width: size,
    height: size * 1.1,
    borderColor: color,
    borderWidth: 0.8,
  })
  page.drawRectangle({
    x: x + size * 0.3,
    y: y + size * 1.05,
    width: size * 0.4,
    height: size * 0.18,
    color,
  })
  page.drawLine({
    start: { x: x + size * 0.2, y: y + size * 0.75 },
    end: { x: x + size * 0.8, y: y + size * 0.75 },
    thickness: 0.7,
    color,
  })
  page.drawLine({
    start: { x: x + size * 0.2, y: y + size * 0.5 },
    end: { x: x + size * 0.8, y: y + size * 0.5 },
    thickness: 0.7,
    color,
  })
  page.drawLine({
    start: { x: x + size * 0.2, y: y + size * 0.25 },
    end: { x: x + size * 0.6, y: y + size * 0.25 },
    thickness: 0.7,
    color,
  })
}