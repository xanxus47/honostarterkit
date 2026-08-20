import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from 'pdf-lib'
import { encodeCode128B } from '../otaf/barcode'
import { drawClipboardIcon } from '../otaf/icons'
import type { OarFormData, SupervisorRating } from './types'

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 26

const NAVY = rgb(0.05, 0.18, 0.38)
const TITLE_BLUE = rgb(0.08, 0.25, 0.5)
const LINE_BLUE = rgb(0.15, 0.35, 0.65)
const LIGHT_BORDER = rgb(0.55, 0.72, 0.88)
const RED = rgb(0.78, 0.08, 0.08)
const BLACK = rgb(0.05, 0.05, 0.05)
const WHITE = rgb(1, 1, 1)
const GRAY = rgb(0.3, 0.3, 0.3)

type Fonts = {
  regular: PDFFont
  bold: PDFFont
  italic: PDFFont
}

function splitLongToken(token: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (font.widthOfTextAtSize(token, size) <= maxWidth) return [token]
  const parts: string[] = []
  let current = ''
  for (const ch of token) {
    const next = current + ch
    if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
      parts.push(current)
      current = ch
    } else {
      current = next
    }
  }
  if (current) parts.push(current)
  return parts
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text.trim()) return []
  const lines: string[] = []

  for (const paragraph of text.replace(/\r\n/g, '\n').split('\n')) {
    const tokens = paragraph.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
    if (tokens.length === 0) {
      lines.push('')
      continue
    }

    let current = ''
    for (const token of tokens) {
      for (const piece of splitLongToken(token, font, size, maxWidth)) {
        if (!current) {
          current = piece
          continue
        }
        const candidate = `${current} ${piece}`
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          current = candidate
        } else {
          lines.push(current)
          current = piece
        }
      }
    }
    if (current) lines.push(current)
  }

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
  page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.7, color })
}

function drawValue(
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

function drawSectionBar(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  font: PDFFont,
) {
  page.drawRectangle({ x, y, width, height, color: NAVY })
  page.drawText(title, {
    x: x + 6,
    y: y + (height - 8) / 2 + 0.5,
    size: 8,
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

function labeledLine(
  page: PDFPage,
  fonts: Fonts,
  label: string,
  value: string | undefined,
  x: number,
  y: number,
  lineWidth: number,
  hint?: string,
) {
  page.drawText(label, { x, y, size: 8, font: fonts.regular, color: BLACK })
  const labelW = fonts.regular.widthOfTextAtSize(label, 8)
  const lineX = x + labelW + 4
  drawUnderline(page, lineX, y - 1, lineWidth)
  drawValue(page, value, lineX + 2, y + 1, fonts.regular, 8, lineWidth - 4)
  if (hint) {
    page.drawText(hint, {
      x: lineX + lineWidth + 4,
      y,
      size: 6.5,
      font: fonts.bold,
      color: TITLE_BLUE,
    })
  }
}

function drawCheckbox(
  page: PDFPage,
  x: number,
  y: number,
  label: string,
  checked: boolean,
  font: PDFFont,
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
    page.drawText('X', { x: x + 1.4, y, size: 7, font, color: BLACK })
  }
  page.drawText(label, { x: x + box + 3, y, size: 7, font, color: BLACK })
}

function drawMultilineField(
  page: PDFPage,
  fonts: Fonts,
  label: string,
  value: string | undefined,
  x: number,
  startY: number,
  width: number,
  lineCount: number,
): number {
  let y = startY
  // Label on its own row — no underline through the heading text
  page.drawText(label, { x, y, size: 8, font: fonts.bold, color: BLACK })
  y -= 11
  const lines = wrapText(value || '', fonts.regular, 8, width - 4)
  for (let i = 0; i < lineCount; i++) {
    drawUnderline(page, x, y, width)
    if (lines[i]) {
      page.drawText(lines[i]!, { x: x + 2, y: y + 2, size: 8, font: fonts.regular, color: BLACK })
    }
    y -= 12
  }
  return y
}

export async function generateOarPdf(
  data: OarFormData,
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
  const controlNumber = data.controlNumber?.trim() || 'OTAR-2026-00001'

  page.drawRectangle({
    x: MARGIN - 6,
    y: MARGIN - 6,
    width: PAGE_W - (MARGIN - 6) * 2,
    height: PAGE_H - (MARGIN - 6) * 2,
    borderColor: NAVY,
    borderWidth: 1.2,
  })

  drawHeader(page, fonts, logo, controlNumber, data.dateFiled)
  let y = PAGE_H - 126
  y = drawEmployeeInfo(page, fonts, data, y)
  y = drawOvertimeDetails(page, fonts, data, y - 4)
  y = drawWorkAccomplished(page, fonts, data, y - 4)
  y = drawSupervisorEvaluation(page, fonts, data, y - 4)
  y = drawCertifications(page, fonts, data, y - 4)
  drawFooter(page, fonts, data, y - 6)

  drawCentered(
    page,
    '"Excellent Public Service Begins with Dedicated and Committed Employees."',
    24,
    fonts.italic,
    7.5,
    TITLE_BLUE,
  )

  pdf.setTitle(`OAR ${controlNumber}`)
  pdf.setAuthor('Municipality of Magsaysay HR & Payroll')
  return pdf.save()
}

function drawHeader(
  page: PDFPage,
  fonts: Fonts,
  logo: PDFImage,
  controlNumber: string,
  dateFiled?: string,
) {
  const top = PAGE_H - MARGIN - 4
  const logoSize = 54
  page.drawImage(logo, {
    x: MARGIN,
    y: top - logoSize,
    width: logoSize,
    height: logoSize,
  })

  const textX = MARGIN + logoSize + 8
  let ty = top - 9
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
    color: TITLE_BLUE,
  })
  ty -= 10
  page.drawText('HUMAN RESOURCE & PAYROLL MANAGEMENT SYSTEM', {
    x: textX,
    y: ty,
    size: 6.5,
    font: fonts.regular,
    color: GRAY,
  })

  const boxW = 128
  const boxH = 70
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
  drawCentered(page, 'CONTROL NUMBER', boxY + boxH - 11, fonts.bold, 7.5, WHITE, boxX, boxX + boxW)

  const cnSize = 10
  const cnW = fonts.bold.widthOfTextAtSize(controlNumber, cnSize)
  page.drawText(controlNumber, {
    x: boxX + (boxW - cnW) / 2,
    y: boxY + 40,
    size: cnSize,
    font: fonts.bold,
    color: RED,
  })
  drawBarcode(page, controlNumber, boxX + 10, boxY + 20, boxW - 20, 14)

  page.drawText('Date Filed:', {
    x: boxX + 6,
    y: boxY + 7,
    size: 7,
    font: fonts.regular,
    color: BLACK,
  })
  drawUnderline(page, boxX + 48, boxY + 5, boxW - 56)
  drawValue(page, dateFiled, boxX + 50, boxY + 7, fonts.regular, 7, boxW - 60)

  drawCentered(page, 'OVERTIME ACCOMPLISHMENT REPORT', PAGE_H - 100, fonts.bold, 13, TITLE_BLUE)
  drawCentered(
    page,
    'Purpose: Documents work completed during overtime.',
    PAGE_H - 113,
    fonts.italic,
    8,
    BLACK,
  )
}

function drawEmployeeInfo(page: PDFPage, fonts: Fonts, data: OarFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 14
  const bodyH = 58
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '1. EMPLOYEE INFORMATION', fonts.bold)
  page.drawRectangle({
    x,
    y: y - bodyH,
    width: w,
    height: bodyH,
    borderColor: NAVY,
    borderWidth: 0.8,
  })

  const colW = w / 2
  const left = [
    ['Employee ID :', data.employeeId],
    ['Employee Name :', data.employeeName],
    ['Position :', data.position],
  ] as const
  const right = [
    ['Office / Department :', data.officeDepartment],
    ['Employment Status :', data.employmentStatus],
    ['Payroll Group :', data.payrollGroup],
  ] as const

  let rowY = y - 16
  for (let i = 0; i < 3; i++) {
    labeledLine(page, fonts, left[i]![0], left[i]![1], x + 8, rowY, colW - 110)
    labeledLine(page, fonts, right[i]![0], right[i]![1], x + colW + 8, rowY, colW - 130)
    rowY -= 16
  }
  return y - bodyH
}

function drawOvertimeDetails(page: PDFPage, fonts: Fonts, data: OarFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 14
  const bodyH = 88
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '2. OVERTIME DETAILS', fonts.bold)
  page.drawRectangle({
    x,
    y: y - bodyH,
    width: w,
    height: bodyH,
    borderColor: NAVY,
    borderWidth: 0.8,
  })

  const colW = w / 2
  let rowY = y - 16
  labeledLine(
    page,
    fonts,
    'Date of Overtime :',
    data.dateOfOvertime,
    x + 8,
    rowY,
    colW - 140,
    '(MM/DD/YYYY)',
  )
  labeledLine(page, fonts, 'Day of Week :', data.dayOfWeek, x + colW + 8, rowY, colW - 110)

  // divider under first row
  page.drawLine({
    start: { x, y: y - 28 },
    end: { x: x + w, y: y - 28 },
    thickness: 0.6,
    color: NAVY,
  })
  page.drawLine({
    start: { x: x + colW, y: y - 28 },
    end: { x: x + colW, y: y - bodyH },
    thickness: 0.6,
    color: NAVY,
  })

  drawCentered(
    page,
    'APPROVED SCHEDULE (As per OTAF)',
    y - 40,
    fonts.bold,
    7.5,
    TITLE_BLUE,
    x,
    x + colW,
  )
  drawCentered(
    page,
    'ACTUAL TIME RENDERED',
    y - 40,
    fonts.bold,
    7.5,
    TITLE_BLUE,
    x + colW,
    x + w,
  )

  const leftFields: [string, string | undefined, string?][] = [
    ['Time In :', data.approvedTimeIn, '(HH:MM AM/PM)'],
    ['Time Out :', data.approvedTimeOut, '(HH:MM AM/PM)'],
    ['Total Approved Hours :', data.approvedTotalHours, '(HH:MM)'],
  ]
  const rightFields: [string, string | undefined, string?][] = [
    ['Time In :', data.actualTimeIn, '(HH:MM AM/PM)'],
    ['Time Out :', data.actualTimeOut, '(HH:MM AM/PM)'],
    ['Total Actual Hours Rendered :', data.actualTotalHours, '(HH:MM)'],
  ]

  rowY = y - 54
  for (let i = 0; i < 3; i++) {
    labeledLine(
      page,
      fonts,
      leftFields[i]![0],
      leftFields[i]![1],
      x + 8,
      rowY,
      colW - (i === 2 ? 155 : 120),
      leftFields[i]![2],
    )
    labeledLine(
      page,
      fonts,
      rightFields[i]![0],
      rightFields[i]![1],
      x + colW + 8,
      rowY,
      colW - (i === 2 ? 185 : 120),
      rightFields[i]![2],
    )
    rowY -= 14
  }

  return y - bodyH
}

function drawWorkAccomplished(page: PDFPage, fonts: Fonts, data: OarFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 14
  // Activities 4 lines, Outputs 4 lines, Problems 3 lines (matches reference)
  const bodyH = 178
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '3. WORK ACCOMPLISHED', fonts.bold)
  page.drawRectangle({
    x,
    y: y - bodyH,
    width: w,
    height: bodyH,
    borderColor: NAVY,
    borderWidth: 0.8,
  })

  let cy = y - 12
  cy = drawMultilineField(page, fonts, 'Activities Performed:', data.activitiesPerformed, x + 8, cy, w - 16, 4)
  cy -= 6
  cy = drawMultilineField(page, fonts, 'Outputs / Deliverables:', data.outputsDeliverables, x + 8, cy, w - 16, 4)
  cy -= 6
  drawMultilineField(page, fonts, 'Problems Encountered:', data.problemsEncountered, x + 8, cy, w - 16, 3)

  return y - bodyH
}

function drawSupervisorEvaluation(
  page: PDFPage,
  fonts: Fonts,
  data: OarFormData,
  topY: number,
): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 14
  const commentLines = 3
  // Roomier section: rating row + 3 comment lines with padding
  const bodyH = 78
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '4. SUPERVISOR EVALUATION', fonts.bold)
  page.drawRectangle({
    x,
    y: y - bodyH,
    width: w,
    height: bodyH,
    borderColor: NAVY,
    borderWidth: 0.8,
  })

  page.drawText("Please rate the employee's performance during overtime:", {
    x: x + 8,
    y: y - 16,
    size: 8,
    font: fonts.regular,
    color: BLACK,
  })

  const ratings: [SupervisorRating, string][] = [
    ['outstanding', 'Outstanding'],
    ['verySatisfactory', 'Very Satisfactory'],
    ['satisfactory', 'Satisfactory'],
    ['needsImprovement', 'Needs Improvement'],
    ['unsatisfactory', 'Unsatisfactory'],
  ]
  let cx = x + 10
  const ratingY = y - 32
  for (const [key, label] of ratings) {
    drawCheckbox(page, cx, ratingY, label, data.supervisorRating === key, fonts.regular)
    cx += fonts.regular.widthOfTextAtSize(label, 7) + 22
  }

  drawMultilineField(
    page,
    fonts,
    'Comments / Recommendations:',
    data.commentsRecommendations,
    x + 8,
    y - 44,
    w - 16,
    commentLines,
  )

  return y - bodyH
}

function drawCertifications(page: PDFPage, fonts: Fonts, data: OarFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const colW = w / 2
  const barH = 14
  const bodyH = 88
  const y = topY - barH
  const bottom = y - bodyH

  page.drawRectangle({
    x,
    y: bottom,
    width: w,
    height: barH + bodyH,
    borderColor: NAVY,
    borderWidth: 0.9,
  })
  page.drawLine({
    start: { x: x + colW, y: bottom },
    end: { x: x + colW, y: topY },
    thickness: 0.9,
    color: NAVY,
  })

  // Section 5
  page.drawRectangle({ x, y, width: colW, height: barH, color: NAVY })
  page.drawText('5. EMPLOYEE CERTIFICATION', {
    x: x + 5,
    y: y + 3.5,
    size: 7.5,
    font: fonts.bold,
    color: WHITE,
  })
  const empCert =
    'I hereby certify that the above information is true and correct and that I have rendered the overtime service stated above.'
  let ey = y - 12
  for (const line of wrapText(empCert, fonts.regular, 6.5, colW - 14)) {
    page.drawText(line, { x: x + 7, y: ey, size: 6.5, font: fonts.regular, color: BLACK })
    ey -= 9
  }
  ey = bottom + 36
  drawUnderline(page, x + 18, ey, colW - 36)
  if (data.employeeSignatureName) {
    drawCentered(page, data.employeeSignatureName, ey + 2, fonts.regular, 8, BLACK, x + 18, x + colW - 18)
  }
  drawCentered(page, 'Employee Signature', ey - 10, fonts.regular, 6.5, GRAY, x, x + colW)
  ey = bottom + 12
  page.drawText('Date:', { x: x + 18, y: ey, size: 7.5, font: fonts.regular, color: BLACK })
  drawUnderline(page, x + 40, ey - 1, colW - 58)
  drawValue(page, data.employeeSignatureDate, x + 42, ey + 1, fonts.regular, 7.5, colW - 62)

  // Section 6
  const sx = x + colW
  page.drawRectangle({ x: sx, y, width: colW, height: barH, color: NAVY })
  page.drawText('6. SUPERVISOR CERTIFICATION', {
    x: sx + 5,
    y: y + 3.5,
    size: 7.5,
    font: fonts.bold,
    color: WHITE,
  })
  const supCert =
    'I hereby certify that the above overtime work was performed and the information provided is true and correct.'
  let sy = y - 12
  for (const line of wrapText(supCert, fonts.regular, 6.5, colW - 14)) {
    page.drawText(line, { x: sx + 7, y: sy, size: 6.5, font: fonts.regular, color: BLACK })
    sy -= 9
  }
  sy = bottom + 42
  drawUnderline(page, sx + 14, sy, colW - 28)
  if (data.supervisorSignatureName) {
    drawCentered(page, data.supervisorSignatureName, sy + 2, fonts.regular, 8, BLACK, sx + 14, sx + colW - 14)
  }
  drawCentered(
    page,
    'Supervisor Signature over Printed Name',
    sy - 10,
    fonts.regular,
    6,
    GRAY,
    sx,
    sx + colW,
  )
  sy = bottom + 12
  const posLineW = colW * 0.55 - 55
  page.drawText('Position:', { x: sx + 10, y: sy, size: 7, font: fonts.regular, color: BLACK })
  drawUnderline(page, sx + 48, sy - 1, posLineW)
  drawValue(page, data.supervisorPosition, sx + 50, sy + 1, fonts.regular, 7, posLineW - 4)
  const dateX = sx + 48 + posLineW + 8
  page.drawText('Date:', { x: dateX, y: sy, size: 7, font: fonts.regular, color: BLACK })
  const dateLineW = sx + colW - 10 - (dateX + 28)
  drawUnderline(page, dateX + 28, sy - 1, dateLineW)
  drawValue(page, data.supervisorSignatureDate, dateX + 30, sy + 1, fonts.regular, 7, dateLineW - 4)

  return bottom
}

function drawFooter(page: PDFPage, fonts: Fonts, data: OarFormData, topY: number) {
  const x = MARGIN
  const contentW = PAGE_W - MARGIN * 2
  const gap = 6
  const leftW = contentW * 0.55
  const rightW = contentW - leftW - gap
  // Compact footer — sit just under certifications with a small gap
  const boxH = 48
  const boxY = Math.max(34, topY - 8 - boxH)

  page.drawRectangle({
    x,
    y: boxY,
    width: leftW,
    height: boxH,
    borderColor: LIGHT_BORDER,
    borderWidth: 1,
  })
  drawClipboardIcon(page, x + 5, boxY + boxH - 12, 8)
  page.drawText('REMINDERS:', {
    x: x + 16,
    y: boxY + boxH - 11,
    size: 7,
    font: fonts.bold,
    color: NAVY,
  })

  const reminders = [
    '1. This report must be accomplished after rendering overtime.',
    '2. Attach supporting documents/evidence of work accomplished, if any.',
    '3. Submit this report to your supervisor for evaluation and approval.',
  ]
  let ry = boxY + boxH - 21
  for (const note of reminders) {
    for (const line of wrapText(note, fonts.regular, 5.6, leftW - 12)) {
      page.drawText(line, { x: x + 6, y: ry, size: 5.6, font: fonts.regular, color: BLACK })
      ry -= 7
    }
  }

  const rx = x + leftW + gap
  page.drawRectangle({
    x: rx,
    y: boxY,
    width: rightW,
    height: boxH,
    borderColor: LIGHT_BORDER,
    borderWidth: 1,
  })
  drawCentered(page, 'FOR HRMO USE ONLY', boxY + boxH - 11, fonts.bold, 7, NAVY, rx, rx + rightW)

  let py = boxY + boxH - 24
  labeledLine(page, fonts, 'Received By :', data.hrmoReceivedBy, rx + 5, py, rightW / 2 - 68)
  labeledLine(page, fonts, 'Date :', data.hrmoReceivedDate, rx + rightW / 2, py, rightW / 2 - 48)
  py -= 13
  labeledLine(page, fonts, 'Verified By :', data.hrmoVerifiedBy, rx + 5, py, rightW / 2 - 68)
  labeledLine(page, fonts, 'Date :', data.hrmoVerifiedDate, rx + rightW / 2, py, rightW / 2 - 48)
}
