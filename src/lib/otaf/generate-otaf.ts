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
import { drawCalendarIcon, drawClockIcon } from './icons'
import type { EmploymentStatus, OtafFormData } from './types'

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 22

const NAVY = rgb(0.05, 0.18, 0.38)
const TITLE_BLUE = rgb(0.1, 0.28, 0.55)
const LINE_BLUE = rgb(0.15, 0.35, 0.65)
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

function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let fitted = text
  while (fitted.length > 1 && font.widthOfTextAtSize(`${fitted}…`, size) > maxWidth) {
    fitted = fitted.slice(0, -1)
  }
  return `${fitted}…`
}

function drawCenteredField(
  page: PDFPage,
  value: string | undefined,
  x0: number,
  x1: number,
  y: number,
  font: PDFFont,
  size: number,
) {
  if (!value) return
  const text = fitText(value, font, size, x1 - x0)
  const w = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: (x0 + x1 - w) / 2, y, size, font, color: BLACK })
}

function drawCenteredCaption(
  page: PDFPage,
  text: string,
  x0: number,
  x1: number,
  y: number,
  font: PDFFont,
  size: number,
) {
  const w = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: (x0 + x1 - w) / 2, y, size, font, color: GRAY })
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

  // Natural stack ends high on the page. Spread the leftover height through
  // the employee rows and the two boxed sections so the form meets the slogan.
  const contentTop = PAGE_H - 124
  const sectionGap = 5
  const boxFloor = 46
  const employeeBase = 204
  const approvalBar = 22
  const approvalBodyBase = 112
  const signatureBar = 14
  const signatureBodyBase = 100
  const naturalEnd =
    contentTop -
    employeeBase -
    sectionGap -
    approvalBar -
    approvalBodyBase -
    sectionGap -
    signatureBar -
    signatureBodyBase
  const slack = Math.max(0, naturalEnd - boxFloor)
  const employeeExtra = Math.round(slack * 0.18)
  const approvalExtra = Math.round(slack * 0.46)
  const signatureExtra = slack - employeeExtra - approvalExtra

  let y = drawEmployeeSection(page, fonts, data, contentTop, employeeExtra / 6)
  y = drawApprovalSection(page, fonts, data, y - sectionGap, approvalBodyBase + approvalExtra)
  drawSignatureSection(
    page,
    fonts,
    data,
    y - sectionGap,
    verificationUrl,
    verificationCode,
    signatureBodyBase + signatureExtra,
  )

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

  // Title + purpose (leave clear gap above EMPLOYEE INFORMATION bar)
  drawCentered(page, 'OVERTIME AUTHORIZATION FORM (OTAF)', PAGE_H - 98, fonts.bold, 13, TITLE_BLUE)
  drawCentered(
    page,
    'Purpose: Official approval before rendering overtime.',
    PAGE_H - 111,
    fonts.italic,
    8,
    BLACK,
  )
}

function drawEmployeeSection(
  page: PDFPage,
  fonts: Fonts,
  data: OtafFormData,
  topY: number,
  rowPad = 0,
): number {
  const x = MARGIN
  const contentW = PAGE_W - MARGIN * 2
  const barH = 14
  let y = topY - barH
  drawSectionBar(page, x, y, contentW, barH, 'EMPLOYEE INFORMATION', fonts.bold, 8)

  const colGap = 8
  const colW = (contentW - colGap) / 2
  const innerPad = 4
  const groupGap = 14 + rowPad
  y -= groupGap

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
  y -= groupGap
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
  y -= groupGap
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
  y -= groupGap
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
  y -= groupGap
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
  y -= groupGap
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

function drawApprovalSection(
  page: PDFPage,
  fonts: Fonts,
  data: OtafFormData,
  topY: number,
  bodyH = 112,
): number {
  const x = MARGIN
  const contentW = PAGE_W - MARGIN * 2
  const colW = contentW / 3
  const barH = 22
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

    const dateY = bottom + 10
    const usable = cy - 8 - dateY
    const nameY = usable > 36 ? dateY + usable * 0.62 : bottom + 50
    const positionY = usable > 36 ? dateY + usable * 0.32 : bottom + 26

    const lineX0 = cx + 10
    const lineX1 = cx + colW - 10
    drawUnderline(page, lineX0, nameY, lineX1 - lineX0)
    drawCenteredField(page, col.name, lineX0, lineX1, nameY + 2, fonts.regular, 7.5)
    drawCenteredCaption(page, 'Signature over Printed Name', lineX0, lineX1, nameY - 9, fonts.regular, 6)

    drawUnderline(page, lineX0, positionY, lineX1 - lineX0)
    drawCenteredField(page, col.position, lineX0, lineX1, positionY + 2, fonts.regular, 7.5)
    drawCenteredCaption(page, 'Position/Designation', lineX0, lineX1, positionY - 9, fonts.regular, 6)

    drawUnderline(page, lineX0, dateY - 1, lineX1 - lineX0)
    drawCenteredField(
      page,
      col.date ? `Date: ${col.date}` : 'Date:',
      lineX0,
      lineX1,
      dateY,
      fonts.regular,
      6.5,
    )
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
  bodyH = 100,
): number {
  const x = MARGIN
  const contentW = PAGE_W - MARGIN * 2
  const colW = contentW / 2
  const barH = 14
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
  const dateY = bottom + 12
  const usable = ey - 8 - dateY
  const nameY = usable > 28 ? dateY + usable * 0.58 : bottom + 38
  const empLineX0 = x + 16
  const empLineX1 = x + colW - 16
  drawUnderline(page, empLineX0, nameY, empLineX1 - empLineX0)
  drawCenteredField(page, data.employeeSignatureName, empLineX0, empLineX1, nameY + 2, fonts.regular, 8)
  drawCenteredCaption(
    page,
    'Signature over Printed Name',
    empLineX0,
    empLineX1,
    nameY - 9,
    fonts.regular,
    6,
  )
  drawUnderline(page, empLineX0, dateY - 1, empLineX1 - empLineX0)
  drawCenteredField(
    page,
    data.employeeSignatureDate ? `Date: ${data.employeeSignatureDate}` : 'Date:',
    empLineX0,
    empLineX1,
    dateY,
    fonts.regular,
    6.5,
  )

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
  const hintY = topY - barH - 12
  page.drawText('Scan QR code to verify this Overtime Authorization.', {
    x: qx + 8,
    y: hintY,
    size: 6.5,
    font: fonts.regular,
    color: BLACK,
  })

  const codeY = bottom + 10
  const qrSize = Math.min(78, Math.max(58, bodyH - 70))
  const qrAreaTop = hintY - 8
  const qrAreaBottom = codeY + 16
  const qrX = qx + (colW - qrSize) / 2
  const qrY = qrAreaBottom + Math.max(0, qrAreaTop - qrAreaBottom - qrSize) / 2
  drawQr(page, verificationUrl, qrX, qrY, qrSize)

  page.drawText('Verification Code:', {
    x: qx + 10,
    y: codeY,
    size: 6.5,
    font: fonts.regular,
    color: BLACK,
  })
  drawUnderline(page, qx + 78, codeY - 2, colW - 90)
  drawFieldValue(page, verificationCode, qx + 80, codeY, fonts.regular, 7, colW - 94)

  return bottom
}
