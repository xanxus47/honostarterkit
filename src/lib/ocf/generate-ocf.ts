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
import type { OcfFormData } from './types'

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 28

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
    const hintW = fonts.regular.widthOfTextAtSize(hint, 6)
    page.drawText(hint, {
      x: lineX + (lineWidth - hintW) / 2,
      y: y - 10,
      size: 6,
      font: fonts.regular,
      color: GRAY,
    })
  }
}

export async function generateOcfPdf(
  data: OcfFormData,
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
  const otcNumber = data.otcNumber?.trim() || 'OTC-2026-00001'

  page.drawRectangle({
    x: MARGIN - 6,
    y: MARGIN - 6,
    width: PAGE_W - (MARGIN - 6) * 2,
    height: PAGE_H - (MARGIN - 6) * 2,
    borderColor: NAVY,
    borderWidth: 1.2,
  })

  drawHeader(page, fonts, logo, otcNumber, data.dateFiled)
  let y = PAGE_H - 128
  y = drawOtaInfo(page, fonts, data, y)
  y = drawEmployeeInfo(page, fonts, data, y - 4)
  y = drawApprovedSchedule(page, fonts, data, y - 4)
  y = drawReason(page, fonts, data, y - 4)
  y = drawRequestedBy(page, fonts, data, y - 4)
  y = drawApprovedBy(page, fonts, data, y - 4)
  drawFooter(page, fonts, data, y - 6)

  drawCentered(
    page,
    '"Excellent Public Service Begins with Dedicated and Committed Employees."',
    26,
    fonts.italic,
    7.5,
    TITLE_BLUE,
  )

  pdf.setTitle(`OCF ${otcNumber}`)
  pdf.setAuthor('Municipality of Magsaysay HR & Payroll')
  return pdf.save()
}

function drawHeader(
  page: PDFPage,
  fonts: Fonts,
  logo: PDFImage,
  otcNumber: string,
  dateFiled?: string,
) {
  const top = PAGE_H - MARGIN - 6
  const logoSize = 56
  page.drawImage(logo, {
    x: MARGIN,
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

  // OTA NUMBER box
  const boxW = 122
  const boxH = 68
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
  drawCentered(page, 'OTA NUMBER', boxY + boxH - 11, fonts.bold, 7.5, WHITE, boxX, boxX + boxW)

  drawBarcode(page, otcNumber, boxX + 10, boxY + 36, boxW - 20, 14)

  const cnSize = 10
  const cnW = fonts.bold.widthOfTextAtSize(otcNumber, cnSize)
  page.drawText(otcNumber, {
    x: boxX + (boxW - cnW) / 2,
    y: boxY + 20,
    size: cnSize,
    font: fonts.bold,
    color: RED,
  })

  page.drawText('Date Filed:', {
    x: boxX + 6,
    y: boxY + 7,
    size: 7,
    font: fonts.regular,
    color: BLACK,
  })
  drawUnderline(page, boxX + 48, boxY + 5, boxW - 56)
  drawValue(page, dateFiled, boxX + 50, boxY + 7, fonts.regular, 7, boxW - 60)

  // Title
  drawCentered(page, 'OVERTIME CANCELLATION FORM', PAGE_H - 100, fonts.bold, 14, TITLE_BLUE)

  const lineY = PAGE_H - 108
  page.drawLine({
    start: { x: MARGIN + 40, y: lineY },
    end: { x: PAGE_W - MARGIN - 40, y: lineY },
    thickness: 1,
    color: NAVY,
  })
  page.drawLine({
    start: { x: MARGIN + 40, y: lineY - 2.5 },
    end: { x: PAGE_W - MARGIN - 40, y: lineY - 2.5 },
    thickness: 0.6,
    color: NAVY,
  })

  drawCentered(
    page,
    'Purpose: Cancel previously approved overtime.',
    PAGE_H - 120,
    fonts.italic,
    8,
    BLACK,
  )
}

function drawOtaInfo(page: PDFPage, fonts: Fonts, data: OcfFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 14
  const bodyH = 36
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '1. OTA INFORMATION', fonts.bold)
  page.drawRectangle({
    x,
    y: y - bodyH,
    width: w,
    height: bodyH,
    borderColor: NAVY,
    borderWidth: 0.8,
  })

  const rowY = y - 18
  const colW = w / 2
  labeledLine(page, fonts, 'OTA Control Number :', data.otaControlNumber, x + 8, rowY, colW - 120)
  labeledLine(
    page,
    fonts,
    'Date Approved :',
    data.dateApproved,
    x + colW + 8,
    rowY,
    colW - 110,
    '(MM/DD/YYYY)',
  )
  return y - bodyH
}

function drawEmployeeInfo(page: PDFPage, fonts: Fonts, data: OcfFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 14
  const bodyH = 52
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '2. EMPLOYEE INFORMATION', fonts.bold)
  page.drawRectangle({
    x,
    y: y - bodyH,
    width: w,
    height: bodyH,
    borderColor: NAVY,
    borderWidth: 0.8,
  })

  const colW = w / 2
  let rowY = y - 18
  labeledLine(page, fonts, 'Employee ID :', data.employeeId, x + 8, rowY, colW - 95)
  labeledLine(page, fonts, 'Employee Name :', data.employeeName, x + colW + 8, rowY, colW - 110)
  rowY -= 22
  labeledLine(page, fonts, 'Position :', data.position, x + 8, rowY, colW - 80)
  labeledLine(
    page,
    fonts,
    'Office / Department :',
    data.officeDepartment,
    x + colW + 8,
    rowY,
    colW - 130,
  )
  return y - bodyH
}

function drawApprovedSchedule(page: PDFPage, fonts: Fonts, data: OcfFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 14
  const bodyH = 98
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '3. APPROVED SCHEDULE (AS PER OTAF)', fonts.bold)
  page.drawRectangle({
    x,
    y: y - bodyH,
    width: w,
    height: bodyH,
    borderColor: NAVY,
    borderWidth: 0.8,
  })

  const colW = w / 2
  let rowY = y - 18
  labeledLine(
    page,
    fonts,
    'Date of Overtime :',
    data.dateOfOvertime,
    x + 8,
    rowY,
    colW - 125,
    '(MM/DD/YYYY)',
  )
  labeledLine(page, fonts, 'Day(s) of the Week :', data.daysOfWeek, x + colW + 8, rowY, colW - 130)

  rowY -= 24
  const tCol = w / 3
  labeledLine(page, fonts, 'Time In :', data.timeIn, x + 8, rowY, tCol - 85, '(HH:MM AM/PM)')
  labeledLine(
    page,
    fonts,
    'Time Out :',
    data.timeOut,
    x + tCol + 8,
    rowY,
    tCol - 90,
    '(HH:MM AM/PM)',
  )
  labeledLine(
    page,
    fonts,
    'Approved Total Hours :',
    data.approvedTotalHours,
    x + tCol * 2 + 8,
    rowY,
    tCol - 135,
    '(HH:MM)',
  )

  rowY -= 26
  page.drawText('Purpose / Justification (As per Approved OTAF)', {
    x: x + 8,
    y: rowY,
    size: 8,
    font: fonts.regular,
    color: BLACK,
  })
  const purposeLines = wrapText(data.purposeJustification || '', fonts.regular, 8, w - 20)
  for (let i = 0; i < 2; i++) {
    rowY -= 12
    drawUnderline(page, x + 8, rowY, w - 16)
    if (purposeLines[i]) {
      page.drawText(purposeLines[i]!, {
        x: x + 10,
        y: rowY + 2,
        size: 8,
        font: fonts.regular,
        color: BLACK,
      })
    }
  }

  return y - bodyH
}

function drawReason(page: PDFPage, fonts: Fonts, data: OcfFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 14
  const bodyH = 48
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '4. REASON FOR CANCELLATION', fonts.bold)
  page.drawRectangle({
    x,
    y: y - bodyH,
    width: w,
    height: bodyH,
    borderColor: NAVY,
    borderWidth: 0.8,
  })

  let rowY = y - 14
  page.drawText('Reason for Cancellation', {
    x: x + 8,
    y: rowY,
    size: 8,
    font: fonts.regular,
    color: BLACK,
  })
  const lines = wrapText(data.reasonForCancellation || '', fonts.regular, 8, w - 20)
  for (let i = 0; i < 2; i++) {
    rowY -= 12
    drawUnderline(page, x + 8, rowY, w - 16)
    if (lines[i]) {
      page.drawText(lines[i]!, {
        x: x + 10,
        y: rowY + 2,
        size: 8,
        font: fonts.regular,
        color: BLACK,
      })
    }
  }
  return y - bodyH
}

function drawPartySection(
  page: PDFPage,
  fonts: Fonts,
  topY: number,
  title: string,
  fields: {
    nameLabel: string
    name?: string
    position?: string
    office?: string
    dateLabel: string
    date?: string
  },
): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 14
  const bodyH = 72
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, title, fonts.bold)
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
  labeledLine(page, fonts, `${fields.nameLabel} :`, fields.name, x + 8, rowY, colW - 100)
  labeledLine(
    page,
    fonts,
    'Position / Designation :',
    fields.position,
    x + colW + 8,
    rowY,
    colW - 140,
  )
  rowY -= 18
  labeledLine(page, fonts, 'Office / Department :', fields.office, x + 8, rowY, colW - 130)
  labeledLine(page, fonts, `${fields.dateLabel} :`, fields.date, x + colW + 8, rowY, colW - 130)

  const sigY = y - bodyH + 18
  const sigW = 160
  const sigX = x + (w - sigW) / 2
  drawUnderline(page, sigX, sigY, sigW)
  drawCentered(
    page,
    'Signature over Printed Name',
    sigY - 10,
    fonts.regular,
    7,
    GRAY,
    x,
    x + w,
  )

  return y - bodyH
}

function drawRequestedBy(page: PDFPage, fonts: Fonts, data: OcfFormData, topY: number): number {
  return drawPartySection(page, fonts, topY, '5. REQUESTED BY', {
    nameLabel: 'Requested By',
    name: data.requestedBy,
    position: data.requestedByPosition,
    office: data.requestedByOffice,
    dateLabel: 'Date Requested (MM/DD/YYYY)',
    date: data.dateRequested,
  })
}

function drawApprovedBy(page: PDFPage, fonts: Fonts, data: OcfFormData, topY: number): number {
  return drawPartySection(page, fonts, topY, '6. APPROVED BY', {
    nameLabel: 'Approved By',
    name: data.approvedBy,
    position: data.approvedByPosition,
    office: data.approvedByOffice,
    dateLabel: 'Date Approved (MM/DD/YYYY)',
    date: data.approvedByDate,
  })
}

function drawFooter(page: PDFPage, fonts: Fonts, data: OcfFormData, topY: number) {
  const x = MARGIN
  const contentW = PAGE_W - MARGIN * 2
  const gap = 8
  const leftW = contentW * 0.55
  const rightW = contentW - leftW - gap
  const boxY = 42
  const boxH = Math.max(topY - boxY, 70)

  page.drawRectangle({
    x,
    y: boxY,
    width: leftW,
    height: boxH,
    borderColor: LIGHT_BORDER,
    borderWidth: 1,
  })
  drawClipboardIcon(page, x + 6, boxY + boxH - 14, 10)
  page.drawText('REMINDERS:', {
    x: x + 20,
    y: boxY + boxH - 12,
    size: 8,
    font: fonts.bold,
    color: NAVY,
  })

  const reminders = [
    '1. Overtime cancellation must be made before the scheduled overtime date and time.',
    '2. If overtime has already been rendered, do not use this form. Use Overtime Certification.',
    '3. A copy of this form shall be filed in the employee\'s overtime records.',
  ]
  let ry = boxY + boxH - 26
  for (const note of reminders) {
    for (const line of wrapText(note, fonts.regular, 6.5, leftW - 14)) {
      page.drawText(line, { x: x + 7, y: ry, size: 6.5, font: fonts.regular, color: BLACK })
      ry -= 9
    }
    ry -= 2
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
  drawCentered(page, 'FOR HRMO USE ONLY', boxY + boxH - 12, fonts.bold, 8, NAVY, rx, rx + rightW)

  const hrmo: [string, string | undefined, string?][] = [
    ['Received By :', data.hrmoReceivedBy],
    ['Date Received :', data.hrmoDateReceived, '(MM/DD/YYYY)'],
    ['Encoded By :', data.hrmoEncodedBy],
    ['Remarks :', data.hrmoRemarks],
  ]
  let py = boxY + boxH - 28
  for (const [label, value, hint] of hrmo) {
    labeledLine(page, fonts, label, value, rx + 6, py, rightW - 90, hint)
    py -= hint ? 20 : 14
  }
}
