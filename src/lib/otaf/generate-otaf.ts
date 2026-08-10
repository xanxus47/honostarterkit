import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from 'pdf-lib'
import { encode as encodeQr } from 'uqr'
import { encodeCode128B } from './barcode'
import { drawCalendarIcon, drawClipboardIcon, drawClockIcon } from './icons'
import type { EmploymentStatus, OtafFormData } from './types'

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 22

const NAVY = rgb(0.05, 0.18, 0.38)
const TITLE_BLUE = rgb(0.1, 0.28, 0.55)
const LINE_BLUE = rgb(0.15, 0.35, 0.65)
const LIGHT_BORDER = rgb(0.55, 0.7, 0.85)
const RED = rgb(0.78, 0.08, 0.08)
const BLACK = rgb(0.05, 0.05, 0.05)
const WHITE = rgb(1, 1, 1)
const GRAY = rgb(0.25, 0.25, 0.25)

type Fonts = {
  regular: PDFFont
  bold: PDFFont
  italic: PDFFont
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (words.length === 0) return []
  const lines: string[] = []
  let current = words[0]!
  for (let i = 1; i < words.length; i++) {
    const next = `${current} ${words[i]}`
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next
    else {
      lines.push(current)
      current = words[i]!
    }
  }
  lines.push(current)
  return lines
}

function drawCentered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color: RGB,
  x0 = MARGIN,
  x1 = PAGE_W - MARGIN,
) {
  const w = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: (x0 + x1 - w) / 2, y, size, font, color })
}

function drawUnderline(page: PDFPage, x: number, y: number, width: number, color: RGB = LINE_BLUE) {
  page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness: 0.7,
    color,
  })
}

function drawFieldValue(
  page: PDFPage,
  value: string | undefined,
  x: number,
  y: number,
  font: PDFFont,
  size = 8.5,
  maxWidth?: number,
) {
  if (!value) return
  let text = value
  if (maxWidth && font.widthOfTextAtSize(text, size) > maxWidth) {
    while (text.length > 1 && font.widthOfTextAtSize(`${text}…`, size) > maxWidth) {
      text = text.slice(0, -1)
    }
    text = `${text}…`
  }
  page.drawText(text, { x, y, size, font, color: BLACK })
}

function drawCheckbox(
  page: PDFPage,
  x: number,
  y: number,
  label: string,
  checked: boolean,
  font: PDFFont,
  size = 7.5,
) {
  const box = 7
  page.drawRectangle({
    x,
    y: y - 1,
    width: box,
    height: box,
    borderColor: NAVY,
    borderWidth: 0.8,
  })
  if (checked) {
    page.drawText('X', {
      x: x + 1.4,
      y: y,
      size: 7,
      font,
      color: BLACK,
    })
  }
  page.drawText(label, { x: x + box + 3, y: y, size, font, color: BLACK })
}

function drawSectionBar(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  font: PDFFont,
  size = 8,
) {
  page.drawRectangle({ x, y, width, height, color: NAVY })
  page.drawText(title, {
    x: x + 5,
    y: y + (height - size) / 2 + 0.5,
    size,
    font,
    color: WHITE,
  })
}

function drawBarcode(page: PDFPage, text: string, x: number, y: number, width: number, height: number) {
  const modules = encodeCode128B(text)
  let totalUnits = 0
  for (const m of modules) totalUnits += m.widths[0]!
  const unit = width / totalUnits
  let cursor = x
  for (const m of modules) {
    const w = m.widths[0]! * unit
    if (m.isBar) {
      page.drawRectangle({ x: cursor, y, width: Math.max(w, 0.4), height, color: BLACK })
    }
    cursor += w
  }
}

function drawQr(page: PDFPage, payload: string, x: number, y: number, size: number) {
  const { data, size: modules } = encodeQr(payload, { ecc: 'M', border: 1 })
  const cell = size / modules
  page.drawRectangle({ x, y, width: size, height: size, color: WHITE })
  for (let row = 0; row < modules; row++) {
    const rowData = data[row]!
    for (let col = 0; col < modules; col++) {
      if (rowData[col]) {
        page.drawRectangle({
          x: x + col * cell,
          y: y + (modules - 1 - row) * cell,
          width: cell + 0.05,
          height: cell + 0.05,
          color: BLACK,
        })
      }
    }
  }
}

function statusChecked(data: OtafFormData, key: EmploymentStatus): boolean {
  return data.employmentStatus === key
}

export async function generateOtafPdf(
  data: OtafFormData,
  logoBytes: ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([PAGE_W, PAGE_H])
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
  }
  const logo = await pdf.embedPng(logoBytes)

  const controlNumber = data.controlNumber?.trim() || 'OTA-2026-000001'
  const verificationCode = data.verificationCode?.trim() || controlNumber.replace(/^OTA-/, 'VR-')
  const verificationUrl =
    data.verificationUrl?.trim() || `https://hr.magsaysay.gov.ph/verify/${controlNumber}`

  // Outer border
  page.drawRectangle({
    x: MARGIN - 4,
    y: MARGIN - 4,
    width: PAGE_W - (MARGIN - 4) * 2,
    height: PAGE_H - (MARGIN - 4) * 2,
    borderColor: NAVY,
    borderWidth: 1.2,
  })

  drawHeader(page, fonts, logo, controlNumber, data.dateRequested)
  let y = PAGE_H - 112
  y = drawEmployeeSection(page, fonts, data, y)
  y = drawApprovalSection(page, fonts, data, y - 4)
  y = drawSignatureSection(page, fonts, data, y - 4, verificationUrl, verificationCode)
  drawFooterSection(page, fonts, data, y - 4)

  // Slogan
  drawCentered(
    page,
    '"Excellent Public Service Begins with Dedicated and Committed Employees."',
    28,
    fonts.italic,
    7.5,
    TITLE_BLUE,
  )

  pdf.setTitle(`OTAF ${controlNumber}`)
  pdf.setAuthor('Municipality of Magsaysay HR & Payroll')
  return pdf.save()
}

function drawHeader(
  page: PDFPage,
  fonts: Fonts,
  logo: PDFImage,
  controlNumber: string,
  dateRequested?: string,
) {
  const top = PAGE_H - MARGIN - 8
  const logoSize = 58
  page.drawImage(logo, {
    x: MARGIN + 2,
    y: top - logoSize,
    width: logoSize,
    height: logoSize,
  })

  const textX = MARGIN + logoSize + 10
  let ty = top - 10
  page.drawText('REPUBLIC OF THE PHILIPPINES', {
    x: textX,
    y: ty,
    size: 7,
    font: fonts.regular,
    color: BLACK,
  })
  ty -= 10
  page.drawText('PROVINCE OF OCCIDENTAL MINDORO', {
    x: textX,
    y: ty,
    size: 7,
    font: fonts.regular,
    color: BLACK,
  })
  ty -= 11
  page.drawText('MUNICIPALITY OF MAGSAYSAY', {
    x: textX,
    y: ty,
    size: 9.5,
    font: fonts.bold,
    color: BLACK,
  })
  ty -= 10
  page.drawText('HUMAN RESOURCE & PAYROLL MANAGEMENT SYSTEM', {
    x: textX,
    y: ty,
    size: 6.5,
    font: fonts.regular,
    color: GRAY,
  })

  // Control number box (top-right)
  const boxW = 128
  const boxH = 72
  const boxX = PAGE_W - MARGIN - boxW
  const boxY = top - boxH
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    borderColor: NAVY,
    borderWidth: 1,
  })
  page.drawRectangle({
    x: boxX,
    y: boxY + boxH - 14,
    width: boxW,
    height: 14,
    color: NAVY,
  })
  drawCentered(
    page,
    'OTA CONTROL NUMBER',
    boxY + boxH - 11,
    fonts.bold,
    7,
    WHITE,
    boxX,
    boxX + boxW,
  )

  const cnSize = 10
  const cnW = fonts.bold.widthOfTextAtSize(controlNumber, cnSize)
  page.drawText(controlNumber, {
    x: boxX + (boxW - cnW) / 2,
    y: boxY + 42,
    size: cnSize,
    font: fonts.bold,
    color: RED,
  })

  drawBarcode(page, controlNumber, boxX + 10, boxY + 22, boxW - 20, 16)

  page.drawText('Date Requested:', {
    x: boxX + 6,
    y: boxY + 7,
    size: 7,
    font: fonts.regular,
    color: BLACK,
  })
  const dateLineX = boxX + 62
  drawUnderline(page, dateLineX, boxY + 5, boxW - 70)
  drawFieldValue(page, dateRequested, dateLineX + 2, boxY + 7, fonts.regular, 7, boxW - 74)

  // Title
  drawCentered(page, 'OVERTIME AUTHORIZATION FORM (OTAF)', PAGE_H - 102, fonts.bold, 13, TITLE_BLUE)
  drawCentered(
    page,
    'Purpose: Official approval before rendering overtime.',
    PAGE_H - 113,
    fonts.italic,
    7,
    GRAY,
  )
}

function drawEmployeeSection(page: PDFPage, fonts: Fonts, data: OtafFormData, topY: number): number {
  const x = MARGIN
  const contentW = PAGE_W - MARGIN * 2
  const barH = 14
  let y = topY - barH
  drawSectionBar(page, x, y, contentW, barH, 'EMPLOYEE INFORMATION', fonts.bold, 8)

  const colGap = 8
  const colW = (contentW - colGap) / 2
  const innerPad = 4
  y -= 14

  // Row 1: name / id
  page.drawText('1. Employee Name', { x: x + innerPad, y, size: 7.5, font: fonts.bold, color: BLACK })
  page.drawText('2. Employee ID', {
    x: x + colW + colGap + innerPad,
    y,
    size: 7.5,
    font: fonts.bold,
    color: BLACK,
  })
  y -= 12
  drawUnderline(page, x + innerPad, y, colW - innerPad)
  drawUnderline(page, x + colW + colGap + innerPad, y, colW - innerPad)
  drawFieldValue(page, data.employeeName, x + innerPad + 2, y + 2, fonts.regular, 8.5, colW - 8)
  drawFieldValue(
    page,
    data.employeeId,
    x + colW + colGap + innerPad + 2,
    y + 2,
    fonts.regular,
    8.5,
    colW - 8,
  )

  // Row 2: position / office
  y -= 14
  page.drawText('3. Position', { x: x + innerPad, y, size: 7.5, font: fonts.bold, color: BLACK })
  page.drawText('4. Office / Department', {
    x: x + colW + colGap + innerPad,
    y,
    size: 7.5,
    font: fonts.bold,
    color: BLACK,
  })
  y -= 12
  drawUnderline(page, x + innerPad, y, colW - innerPad)
  drawUnderline(page, x + colW + colGap + innerPad, y, colW - innerPad)
  drawFieldValue(page, data.position, x + innerPad + 2, y + 2, fonts.regular, 8.5, colW - 8)
  drawFieldValue(
    page,
    data.officeDepartment,
    x + colW + colGap + innerPad + 2,
    y + 2,
    fonts.regular,
    8.5,
    colW - 8,
  )

  // Row 3: employment status / date of OT
  y -= 14
  page.drawText('5. Employment Status', {
    x: x + innerPad,
    y,
    size: 7.5,
    font: fonts.bold,
    color: BLACK,
  })
  page.drawText('6. Date of Overtime', {
    x: x + colW + colGap + innerPad,
    y,
    size: 7.5,
    font: fonts.bold,
    color: BLACK,
  })
  y -= 12
  const statusY = y + 1
  let sx = x + innerPad
  drawCheckbox(page, sx, statusY, 'Permanent', statusChecked(data, 'permanent'), fonts.regular)
  sx += 62
  drawCheckbox(page, sx, statusY, 'Job Order', statusChecked(data, 'jobOrder'), fonts.regular)
  sx += 60
  drawCheckbox(page, sx, statusY, 'Contractual', statusChecked(data, 'contractual'), fonts.regular)
  sx += 68
  drawCheckbox(page, sx, statusY, 'Others', statusChecked(data, 'others'), fonts.regular)
  drawUnderline(page, sx + 42, statusY - 1, 40)
  drawFieldValue(page, data.employmentStatusOther, sx + 44, statusY + 1, fonts.regular, 7, 36)

  const dateX = x + colW + colGap + innerPad
  drawUnderline(page, dateX, y, colW - innerPad - 14)
  drawCalendarIcon(page, dateX + colW - innerPad - 12, y - 1, 9)
  drawFieldValue(page, data.dateOfOvertime, dateX + 2, y + 2, fonts.regular, 8.5, colW - 30)

  // Row 4: time in / out / hours
  y -= 14
  const tCol = contentW / 3
  page.drawText('7. Time In', { x: x + innerPad, y, size: 7.5, font: fonts.bold, color: BLACK })
  page.drawText('8. Time Out', {
    x: x + tCol + innerPad,
    y,
    size: 7.5,
    font: fonts.bold,
    color: BLACK,
  })
  page.drawText('9. Estimated Total Hours', {
    x: x + tCol * 2 + innerPad,
    y,
    size: 7.5,
    font: fonts.bold,
    color: BLACK,
  })
  y -= 12
  drawUnderline(page, x + innerPad, y, tCol - 18)
  drawClockIcon(page, x + tCol - 14, y - 1, 9)
  drawFieldValue(page, data.timeIn, x + innerPad + 2, y + 2, fonts.regular, 8.5, tCol - 24)

  drawUnderline(page, x + tCol + innerPad, y, tCol - 18)
  drawClockIcon(page, x + tCol * 2 - 14, y - 1, 9)
  drawFieldValue(page, data.timeOut, x + tCol + innerPad + 2, y + 2, fonts.regular, 8.5, tCol - 24)

  drawUnderline(page, x + tCol * 2 + innerPad, y, tCol - innerPad - 40)
  page.drawText('(HH:MM)', {
    x: x + contentW - 38,
    y: y + 1,
    size: 7,
    font: fonts.regular,
    color: GRAY,
  })
  drawFieldValue(
    page,
    data.estimatedTotalHours,
    x + tCol * 2 + innerPad + 2,
    y + 2,
    fonts.regular,
    8.5,
    tCol - 50,
  )

  // Purpose
  y -= 14
  page.drawText('10. Purpose / Justification', {
    x: x + innerPad,
    y,
    size: 7.5,
    font: fonts.bold,
    color: BLACK,
  })
  y -= 3
  const purposeLines = wrapText(data.purposeJustification || '', fonts.regular, 8, contentW - 10)
  for (let i = 0; i < 3; i++) {
    y -= 11
    drawUnderline(page, x + innerPad, y, contentW - innerPad * 2)
    if (purposeLines[i]) {
      page.drawText(purposeLines[i]!, {
        x: x + innerPad + 2,
        y: y + 2,
        size: 8,
        font: fonts.regular,
        color: BLACK,
      })
    }
  }

  // Activity / Funding
  y -= 14
  page.drawText('11. Activity / Project', {
    x: x + innerPad,
    y,
    size: 7.5,
    font: fonts.bold,
    color: BLACK,
  })
  page.drawText('12. Funding Source', {
    x: x + colW + colGap + innerPad,
    y,
    size: 7.5,
    font: fonts.bold,
    color: BLACK,
  })
  const activityLines = wrapText(data.activityProject || '', fonts.regular, 8, colW - 8)
  const fundingLines = wrapText(data.fundingSource || '', fonts.regular, 8, colW - 8)
  for (let i = 0; i < 2; i++) {
    y -= 11
    drawUnderline(page, x + innerPad, y, colW - innerPad)
    drawUnderline(page, x + colW + colGap + innerPad, y, colW - innerPad)
    if (activityLines[i]) {
      page.drawText(activityLines[i]!, {
        x: x + innerPad + 2,
        y: y + 2,
        size: 8,
        font: fonts.regular,
        color: BLACK,
      })
    }
    if (fundingLines[i]) {
      page.drawText(fundingLines[i]!, {
        x: x + colW + colGap + innerPad + 2,
        y: y + 2,
        size: 8,
        font: fonts.regular,
        color: BLACK,
      })
    }
  }

  return y
}

function drawApprovalSection(page: PDFPage, fonts: Fonts, data: OtafFormData, topY: number): number {
  const x = MARGIN
  const contentW = PAGE_W - MARGIN * 2
  const colW = contentW / 3
  const barH = 22
  const bodyH = 112
  const bottom = topY - barH - bodyH

  const cols = [
    {
      title: '13. IMMEDIATE SUPERVISOR\nRECOMMENDATION',
      cert: 'I hereby certify that the overtime service is necessary and recommended.',
      name: data.supervisorName,
      position: data.supervisorPosition,
      date: data.supervisorDate,
    },
    {
      title: '14. DEPARTMENT HEAD\nAPPROVAL',
      cert: 'I hereby approve the requested overtime as indicated above.',
      name: data.departmentHeadName,
      position: data.departmentHeadPosition,
      date: data.departmentHeadDate,
    },
    {
      title: '15. HRMO\nVERIFICATION',
      cert:
        'I hereby certify that the employee is eligible for overtime compensation and that sufficient funds are available.',
      name: data.hrmoName,
      position: data.hrmoPosition,
      date: data.hrmoDate,
    },
  ]

  // Outer frame
  page.drawRectangle({
    x,
    y: bottom,
    width: contentW,
    height: barH + bodyH,
    borderColor: NAVY,
    borderWidth: 1,
  })

  cols.forEach((col, i) => {
    const cx = x + i * colW
    page.drawRectangle({ x: cx, y: topY - barH, width: colW, height: barH, color: NAVY })
    if (i > 0) {
      page.drawLine({
        start: { x: cx, y: bottom },
        end: { x: cx, y: topY },
        thickness: 0.9,
        color: NAVY,
      })
    }

    const titleLines = col.title.split('\n')
    page.drawText(titleLines[0]!, {
      x: cx + 4,
      y: topY - 10,
      size: 6.5,
      font: fonts.bold,
      color: WHITE,
    })
    page.drawText(titleLines[1]!, {
      x: cx + 4,
      y: topY - 19,
      size: 6.5,
      font: fonts.bold,
      color: WHITE,
    })

    const certLines = wrapText(col.cert, fonts.regular, 6.5, colW - 10)
    let cy = topY - barH - 12
    for (const line of certLines) {
      page.drawText(line, { x: cx + 5, y: cy, size: 6.5, font: fonts.regular, color: BLACK })
      cy -= 9
    }

    cy = bottom + 50
    drawUnderline(page, cx + 10, cy, colW - 20)
    drawFieldValue(page, col.name, cx + 12, cy + 2, fonts.regular, 7.5, colW - 24)
    page.drawText('Signature over Printed Name', {
      x: cx + 10,
      y: cy - 9,
      size: 6,
      font: fonts.regular,
      color: GRAY,
    })

    cy = bottom + 26
    drawUnderline(page, cx + 10, cy, colW - 20)
    drawFieldValue(page, col.position, cx + 12, cy + 2, fonts.regular, 7.5, colW - 24)
    page.drawText('Position/Designation', {
      x: cx + 10,
      y: cy - 9,
      size: 6,
      font: fonts.regular,
      color: GRAY,
    })

    cy = bottom + 8
    page.drawText('Date:', { x: cx + 10, y: cy, size: 6.5, font: fonts.regular, color: BLACK })
    drawUnderline(page, cx + 30, cy - 1, colW - 40)
    drawFieldValue(page, col.date, cx + 32, cy + 1, fonts.regular, 7, colW - 44)
  })

  return bottom
}

function drawSignatureSection(
  page: PDFPage,
  fonts: Fonts,
  data: OtafFormData,
  topY: number,
  verificationUrl: string,
  verificationCode: string,
): number {
  const x = MARGIN
  const contentW = PAGE_W - MARGIN * 2
  const colW = contentW / 2
  const barH = 14
  const bodyH = 100
  const bottom = topY - barH - bodyH

  page.drawRectangle({
    x,
    y: bottom,
    width: contentW,
    height: barH + bodyH,
    borderColor: NAVY,
    borderWidth: 1,
  })
  page.drawLine({
    start: { x: x + colW, y: bottom },
    end: { x: x + colW, y: topY },
    thickness: 0.9,
    color: NAVY,
  })

  // Employee signature
  page.drawRectangle({ x, y: topY - barH, width: colW, height: barH, color: NAVY })
  page.drawText('16. EMPLOYEE SIGNATURE', {
    x: x + 5,
    y: topY - 10,
    size: 7.5,
    font: fonts.bold,
    color: WHITE,
  })

  const empCert =
    'I hereby certify that the above information is true and correct and that I will render the overtime service as authorized.'
  let ey = topY - barH - 12
  for (const line of wrapText(empCert, fonts.regular, 6.5, colW - 12)) {
    page.drawText(line, { x: x + 6, y: ey, size: 6.5, font: fonts.regular, color: BLACK })
    ey -= 9
  }
  ey = bottom + 38
  drawUnderline(page, x + 16, ey, colW - 32)
  drawFieldValue(page, data.employeeSignatureName, x + 18, ey + 2, fonts.regular, 8, colW - 36)
  page.drawText('Signature over Printed Name', {
    x: x + 16,
    y: ey - 9,
    size: 6,
    font: fonts.regular,
    color: GRAY,
  })
  ey = bottom + 12
  page.drawText('Date:', { x: x + 16, y: ey, size: 6.5, font: fonts.regular, color: BLACK })
  drawUnderline(page, x + 36, ey - 1, colW - 52)
  drawFieldValue(page, data.employeeSignatureDate, x + 38, ey + 1, fonts.regular, 7.5, colW - 56)

  // QR verification
  const qx = x + colW
  page.drawRectangle({ x: qx, y: topY - barH, width: colW, height: barH, color: NAVY })
  page.drawText('17. QR CODE VERIFICATION', {
    x: qx + 5,
    y: topY - 10,
    size: 7.5,
    font: fonts.bold,
    color: WHITE,
  })
  page.drawText('Scan QR code to verify this Overtime Authorization.', {
    x: qx + 8,
    y: topY - barH - 12,
    size: 6.5,
    font: fonts.regular,
    color: BLACK,
  })

  const qrSize = 58
  const qrX = qx + (colW - qrSize) / 2
  const qrY = bottom + 26
  drawQr(page, verificationUrl, qrX, qrY, qrSize)

  page.drawText('Verification Code:', {
    x: qx + 10,
    y: bottom + 10,
    size: 6.5,
    font: fonts.regular,
    color: BLACK,
  })
  drawUnderline(page, qx + 78, bottom + 8, colW - 90)
  drawFieldValue(page, verificationCode, qx + 80, bottom + 10, fonts.regular, 7, colW - 94)

  return bottom
}

function drawFooterSection(page: PDFPage, fonts: Fonts, data: OtafFormData, topY: number) {
  const x = MARGIN
  const contentW = PAGE_W - MARGIN * 2
  const gap = 6
  const leftW = contentW * 0.58
  const rightW = contentW - leftW - gap
  const boxH = topY - 42
  const boxY = 42

  // Reminders
  page.drawRectangle({
    x,
    y: boxY,
    width: leftW,
    height: boxH,
    borderColor: LIGHT_BORDER,
    borderWidth: 1,
  })
  drawClipboardIcon(page, x + 6, boxY + boxH - 14, 10)
  page.drawText('REMINDERS / NOTES', {
    x: x + 20,
    y: boxY + boxH - 12,
    size: 8,
    font: fonts.bold,
    color: NAVY,
  })

  const reminders = [
    '1. Overtime must be authorized before actual rendition of service.',
    '2. This form does not apply to employees under flexible working hours without prior approval.',
    '3. Overtime overlapping with leave or undertime is not compensable.',
    '4. Supporting DTR / biometric logs may be required for payroll processing.',
    '5. Unauthorized overtime shall not be credited for compensation.',
  ]
  let ry = boxY + boxH - 26
  for (const note of reminders) {
    const lines = wrapText(note, fonts.regular, 6.2, leftW - 14)
    for (const line of lines) {
      page.drawText(line, { x: x + 7, y: ry, size: 6.2, font: fonts.regular, color: BLACK })
      ry -= 8.5
    }
    ry -= 1.5
  }

  // Payroll box
  const rx = x + leftW + gap
  page.drawRectangle({
    x: rx,
    y: boxY,
    width: rightW,
    height: boxH,
    borderColor: LIGHT_BORDER,
    borderWidth: 1,
  })
  drawCentered(
    page,
    'FOR PAYROLL USE ONLY',
    boxY + boxH - 12,
    fonts.bold,
    8,
    NAVY,
    rx,
    rx + rightW,
  )

  const payrollFields: [string, string | undefined][] = [
    ['Payroll Reference No.:', data.payrollReferenceNo],
    ['Date Posted:', data.payrollDatePosted],
    ['Encoded By:', data.payrollEncodedBy],
    ['Checked By:', data.payrollCheckedBy],
    ['Approved By:', data.payrollApprovedBy],
  ]
  let py = boxY + boxH - 30
  for (const [label, value] of payrollFields) {
    page.drawText(label, { x: rx + 6, y: py, size: 6.5, font: fonts.regular, color: BLACK })
    const lineX = rx + 90
    drawUnderline(page, lineX, py - 1, rightW - 98)
    drawFieldValue(page, value, lineX + 2, py + 1, fonts.regular, 7, rightW - 102)
    py -= 14
  }
}
