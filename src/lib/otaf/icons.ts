import { rgb, type PDFPage, type RGB } from 'pdf-lib'

const blue = rgb(0.12, 0.28, 0.55)

/** Small clipboard icon. */
export function drawClipboardIcon(page: PDFPage, x: number, y: number, size = 9, color: RGB = blue) {
  // board
  page.drawRectangle({
    x,
    y,
    width: size,
    height: size * 1.1,
    borderColor: color,
    borderWidth: 0.8,
  })
  // clip at top
  page.drawRectangle({
    x: x + size * 0.3,
    y: y + size * 1.05,
    width: size * 0.4,
    height: size * 0.18,
    color,
  })
  // lines representing text
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