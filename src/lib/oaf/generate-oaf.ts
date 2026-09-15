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
import type { OafFormData } from './types'

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 24

const NAVY = rgb(0.05, 0.18, 0.38)
const TITLE_BLUE = rgb(0.08, 0.25, 0.5)
const LINE_BLUE = rgb(0.15, 0.35, 0.65)
const LIGHT_BORDER = rgb(0.55, 0.72, 0.88)
const GOLD = rgb(0.85, 0.65, 0.12)
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
    while (text.length > 1 && font.widthOfTextAtSize(`${text}...`, size) > maxWidth) {
      text = text.slice(0, -1)
    }
    text = `${text}...`
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
  size = 8,
) {
  page.drawRectangle({ x, y, width, height, color: NAVY })
  page.drawText(title, {
    x: x + 6,
    y: y + (height - size) / 2 + 0.4,
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

export async function generateOafPdf(
  data: OafFormData,
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
  const controlNumber = data.controlNumber?.trim() || 'OTA-AM-2026-00001'

  page.drawRectangle({
    x: MARGIN - 6,
    y: MARGIN - 6,
    width: PAGE_W - (MARGIN - 6) * 2,
    height: PAGE_H - (MARGIN - 6) * 2,
    borderColor: NAVY,
    borderWidth: 1.2,
  })

  drawHeader(page, fonts, logo, controlNumber, data.dateFiled)
  let y = PAGE_H - 132
  y = drawOriginalOta(page, fonts, data, y)
  y = drawEmployeeInfo(page, fonts, data, y - 5)
  y = drawScheduleTable(
    page,
    fonts,
    y - 5,
    '3. ORIGINAL SCHEDULE (AS PER APPROVED OTAF)',
    [
      { header: 'Date of Overtime', value: data.originalDateOfOvertime, hint: '(MM/DD/YYYY)' },
      { header: 'Day(s) of the Week', value: data.originalDaysOfWeek },
      { header: 'Time In', value: data.originalTimeIn, hint: '(HH:MM AM/PM)' },
      { header: 'Time Out', value: data.originalTimeOut, hint: '(HH:MM AM/PM)' },
      { header: 'Total Approved Hours', value: data.originalTotalHours, hint: '(HH:MM)' },
    ],
  )
  y = drawScheduleTable(
    page,
    fonts,
    y - 5,
    '4. NEW (AMENDED) SCHEDULE',
    [
      { header: 'Date of Overtime', value: data.newDateOfOvertime, hint: '(MM/DD/YYYY)' },
      { header: 'Day(s) of the Week', value: data.newDaysOfWeek },
      { header: 'New Time In', value: data.newTimeIn, hint: '(HH:MM AM/PM)' },
      { header: 'New Time Out', value: data.newTimeOut, hint: '(HH:MM AM/PM)' },
      { header: 'New Total Hours', value: data.newTotalHours, hint: '(HH:MM)' },
    ],
  )
  y = drawReason(page, fonts, data, y - 5)
  y = drawApprovals(page, fonts, data, y - 5)
  drawFooter(page, fonts, data, y - 6)

  drawFooterBanner(page)
  drawCentered(
    page,
    '"Excellent Public Service Begins with Dedicated and Committed Employees."',
    18,
    fonts.italic,
    7.5,
    WHITE,
  )

  pdf.setTitle(`OAF ${controlNumber}`)
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

  const textX = MARGIN + logoSize + 10
  let ty = top - 10
  page.drawText('REPUBLIC OF THE PHILIPPINES', { x: textX, y: ty, size: 7, font: fonts.regular, color: BLACK })
  ty -= 10
  page.drawText('PROVINCE OF OCCIDENTAL MINDORO', { x: textX, y: ty, size: 7, font: fonts.regular, color: BLACK })
  ty -= 11
  page.drawText('MUNICIPALITY OF MAGSAYSAY', { x: textX, y: ty, size: 10, font: fonts.bold, color: TITLE_BLUE })
  ty -= 10
  page.drawText('HUMAN RESOURCE & PAYROLL', { x: textX, y: ty, size: 6.5, font: fonts.regular, color: GRAY })
  ty -= 9
  page.drawText('MANAGEMENT SYSTEM', { x: textX, y: ty, size: 6.5, font: fonts.regular, color: GRAY })

  const boxW = 128
  const boxH = 78
  const boxX = PAGE_W - MARGIN - boxW
  const boxY = top - boxH
  page.drawRectangle({ x: boxX, y: boxY, width: boxW, height: boxH, borderColor: NAVY, borderWidth: 1 })
  page.drawRectangle({ x: boxX, y: boxY + boxH - 14, width: boxW, height: 14, color: NAVY })
  drawCentered(page, 'CONTROL NUMBER', boxY + boxH - 11, fonts.bold, 7.5, WHITE, boxX, boxX + boxW)

  const cnSize = 8.5
  const cnW = fonts.bold.widthOfTextAtSize(controlNumber, cnSize)
  page.drawText(controlNumber, {
    x: boxX + (boxW - cnW) / 2,
    y: boxY + 50,
    size: cnSize,
    font: fonts.bold,
    color: RED,
  })
  drawBarcode(page, controlNumber, boxX + 8, boxY + 28, boxW - 16, 16)

  page.drawText('Date Filed:', { x: boxX + 6, y: boxY + 10, size: 7, font: fonts.regular, color: BLACK })
  drawUnderline(page, boxX + 50, boxY + 8, boxW - 70)
  drawValue(page, dateFiled, boxX + 52, boxY + 10, fonts.regular, 7, boxW - 74)
  const hint = '(MM/DD/YYYY)'
  const hintW = fonts.regular.widthOfTextAtSize(hint, 5.5)
  page.drawText(hint, { x: boxX + boxW - hintW - 6, y: boxY + 3, size: 5.5, font: fonts.regular, color: GRAY })

  drawCentered(page, 'OVERTIME AMENDMENT FORM', PAGE_H - 104, fonts.bold, 15, TITLE_BLUE)
  const lineY = PAGE_H - 112
  page.drawLine({
    start: { x: MARGIN + 70, y: lineY },
    end: { x: PAGE_W - MARGIN - 70, y: lineY },
    thickness: 1,
    color: NAVY,
  })
  page.drawLine({
    start: { x: MARGIN + 70, y: lineY - 2.4 },
    end: { x: PAGE_W - MARGIN - 70, y: lineY - 2.4 },
    thickness: 0.6,
    color: NAVY,
  })
  drawCentered(
    page,
    'Purpose: Revise approved overtime schedule or hours.',
    PAGE_H - 124,
    fonts.italic,
    8,
    BLACK,
  )
}

function drawOriginalOta(page: PDFPage, fonts: Fonts, data: OafFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 14
  const bodyH = 36
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '1. ORIGINAL OTA INFORMATION', fonts.bold)
  page.drawRectangle({ x, y: y - bodyH, width: w, height: bodyH, borderColor: NAVY, borderWidth: 0.8 })
  const rowY = y - 18
  const colW = w / 2
  labeledLine(page, fonts, 'Original OTA Control Number :', data.originalOtaControlNumber, x + 8, rowY, colW - 165)
  labeledLine(page, fonts, 'Date Approved :', data.dateApproved, x + colW + 8, rowY, colW - 110, '(MM/DD/YYYY)')
  return y - bodyH
}

function drawEmployeeInfo(page: PDFPage, fonts: Fonts, data: OafFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 14
  const bodyH = 68
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '2. EMPLOYEE INFORMATION', fonts.bold)
  page.drawRectangle({ x, y: y - bodyH, width: w, height: bodyH, borderColor: NAVY, borderWidth: 0.8 })
  const colW = w / 2
  let rowY = y - 16
  labeledLine(page, fonts, 'Employee ID :', data.employeeId, x + 8, rowY, colW - 100)
  labeledLine(page, fonts, 'Employee Name :', data.employeeName, x + colW + 8, rowY, colW - 115)
  rowY -= 18
  labeledLine(page, fonts, 'Position :', data.position, x + 8, rowY, colW - 80)
  labeledLine(page, fonts, 'Office / Department :', data.officeDepartment, x + colW + 8, rowY, colW - 135)
  rowY -= 18
  labeledLine(page, fonts, 'Employment Status :', data.employmentStatus, x + colW + 8, rowY, colW - 130)
  return y - bodyH
}

function drawScheduleTable(
  page: PDFPage,
  fonts: Fonts,
  topY: number,
  title: string,
  cols: { header: string; value?: string; hint?: string }[],
): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 14
  const headerH = 22
  const bodyH = 40
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, title, fonts.bold)
  const tableTop = y
  const tableBottom = y - headerH - bodyH
  page.drawRectangle({
    x,
    y: tableBottom,
    width: w,
    height: headerH + bodyH,
    borderColor: NAVY,
    borderWidth: 0.8,
  })
  page.drawRectangle({ x, y: tableTop - headerH, width: w, height: headerH, color: rgb(0.9, 0.93, 0.97) })

  const colW = w / cols.length
  for (let i = 0; i < cols.length; i++) {
    const cx = x + i * colW
    if (i > 0) {
      page.drawLine({
        start: { x: cx, y: tableTop },
        end: { x: cx, y: tableBottom },
        thickness: 0.6,
        color: NAVY,
      })
    }
    drawCentered(page, cols[i]!.header, tableTop - 14, fonts.bold, 6.5, NAVY, cx, cx + colW)
    const lineX = cx + 8
    const lineW = colW - 16
    const lineY = tableTop - headerH - 16
    drawUnderline(page, lineX, lineY, lineW)
    if (cols[i]!.value) {
      const size = 8
      const vw = fonts.regular.widthOfTextAtSize(cols[i]!.value!, size)
      page.drawText(cols[i]!.value!, {
        x: lineX + Math.max(2, (lineW - vw) / 2),
        y: lineY + 2,
        size,
        font: fonts.regular,
        color: BLACK,
      })
    }
    if (cols[i]!.hint) {
      const hw = fonts.regular.widthOfTextAtSize(cols[i]!.hint!, 5.5)
      page.drawText(cols[i]!.hint!, {
        x: cx + (colW - hw) / 2,
        y: tableBottom + 6,
        size: 5.5,
        font: fonts.regular,
        color: GRAY,
      })
    }
  }
  page.drawLine({
    start: { x, y: tableTop - headerH },
    end: { x: x + w, y: tableTop - headerH },
    thickness: 0.6,
    color: NAVY,
  })
  return tableBottom
}

function drawReason(page: PDFPage, fonts: Fonts, data: OafFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 14
  const bodyH = 52
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '5. REASON FOR AMENDMENT', fonts.bold)
  page.drawRectangle({ x, y: y - bodyH, width: w, height: bodyH, borderColor: NAVY, borderWidth: 0.8 })
  let rowY = y - 14
  page.drawText('Reason for Amendment :', { x: x + 8, y: rowY, size: 8, font: fonts.regular, color: BLACK })
  const lines = wrapText(data.reasonForAmendment || '', fonts.regular, 8, w - 20)
  for (let i = 0; i < 2; i++) {
    rowY -= 14
    drawUnderline(page, x + 8, rowY, w - 16)
    if (lines[i]) {
      page.drawText(lines[i]!, { x: x + 10, y: rowY + 2, size: 8, font: fonts.regular, color: BLACK })
    }
  }
  return y - bodyH
}

function drawApprovals(page: PDFPage, fonts: Fonts, data: OafFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 14
  const bodyH = 128
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '6. APPROVALS', fonts.bold)
  page.drawRectangle({ x, y: y - bodyH, width: w, height: bodyH, borderColor: NAVY, borderWidth: 0.8 })

  const cols: {
    title: string
    statement: string
    name?: string
    date?: string
  }[] = [
    {
      title: '6.1 REQUESTED BY\n(Employee)',
      statement: 'I hereby request the amendment of the approved overtime schedule/hours as stated above.',
      name: data.requestedBy,
      date: data.requestedByDate,
    },
    {
      title: '6.2 RECOMMENDED BY\n(Immediate Supervisor)',
      statement: 'I hereby recommend approval of this overtime amendment request.',
      name: data.recommendedBy,
      date: data.recommendedByDate,
    },
    {
      title: '6.3 APPROVED BY\n(Department Head)',
      statement: 'I hereby approve the amendment of the overtime schedule/hours as indicated.',
      name: data.approvedBy,
      date: data.approvedByDate,
    },
    {
      title: '6.4 VERIFIED BY\n(HRMO)',
      statement: 'I hereby verify that the amendment is in order and supported by this office.',
      name: data.verifiedBy,
      date: data.verifiedByDate,
    },
  ]

  const colW = w / 4
  const subBarH = 22
  for (let i = 0; i < cols.length; i++) {
    const cx = x + i * colW
    if (i > 0) {
      page.drawLine({
        start: { x: cx, y },
        end: { x: cx, y: y - bodyH },
        thickness: 0.6,
        color: NAVY,
      })
    }
    page.drawRectangle({
      x: cx,
      y: y - subBarH,
      width: colW,
      height: subBarH,
      color: rgb(0.9, 0.93, 0.97),
    })
    const titleLines = cols[i]!.title.split('\n')
    page.drawText(titleLines[0]!, {
      x: cx + 5,
      y: y - 10,
      size: 6.2,
      font: fonts.bold,
      color: NAVY,
    })
    if (titleLines[1]) {
      page.drawText(titleLines[1], {
        x: cx + 5,
        y: y - 18,
        size: 5.5,
        font: fonts.regular,
        color: GRAY,
      })
    }
    page.drawLine({
      start: { x: cx, y: y - subBarH },
      end: { x: cx + colW, y: y - subBarH },
      thickness: 0.5,
      color: LINE_BLUE,
    })

    let ty = y - subBarH - 12
    for (const line of wrapText(cols[i]!.statement, fonts.regular, 6, colW - 12).slice(0, 5)) {
      page.drawText(line, { x: cx + 5, y: ty, size: 6, font: fonts.regular, color: BLACK })
      ty -= 8
    }

    const sigY = y - bodyH + 28
    drawUnderline(page, cx + 8, sigY, colW - 16)
    if (cols[i]!.name) {
      const nw = fonts.regular.widthOfTextAtSize(cols[i]!.name!, 7)
      page.drawText(cols[i]!.name!, {
        x: cx + 8 + Math.max(0, (colW - 16 - nw) / 2),
        y: sigY + 2,
        size: 7,
        font: fonts.regular,
        color: BLACK,
      })
    }
    const cap = 'Signature over Printed Name'
    const cw = fonts.regular.widthOfTextAtSize(cap, 5)
    page.drawText(cap, {
      x: cx + (colW - cw) / 2,
      y: sigY - 8,
      size: 5,
      font: fonts.regular,
      color: GRAY,
    })
    labeledLine(page, fonts, 'Date:', cols[i]!.date, cx + 8, y - bodyH + 10, colW - 50, '(MM/DD/YYYY)')
  }

  return y - bodyH
}

function drawFooter(page: PDFPage, fonts: Fonts, data: OafFormData, topY: number) {
  const x = MARGIN
  const contentW = PAGE_W - MARGIN * 2
  const gap = 8
  const leftW = contentW * 0.5
  const rightW = contentW - leftW - gap
  const boxY = 36
  const boxH = Math.max(topY - boxY, 88)

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
    '1. Overtime amendment must be requested before the scheduled overtime.',
    '2. If overtime has already been rendered, do not use this form. Use Overtime Certification.',
    '3. Ensure that the new schedule does not conflict with existing policies.',
    "4. A copy of this form shall be filed in the employee's overtime records.",
  ]
  let ry = boxY + boxH - 26
  for (const note of reminders) {
    for (const line of wrapText(note, fonts.regular, 6.2, leftW - 14)) {
      page.drawText(line, { x: x + 7, y: ry, size: 6.2, font: fonts.regular, color: BLACK })
      ry -= 8
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
  let hy = boxY + boxH - 28
  labeledLine(page, fonts, 'Received By :', data.hrmoReceivedBy, rx + 8, hy, 90)
  labeledLine(page, fonts, 'Date :', data.hrmoReceivedDate, rx + rightW * 0.52, hy, 70, '(MM/DD/YYYY)')
  hy -= 22
  labeledLine(page, fonts, 'Encoded By :', data.hrmoEncodedBy, rx + 8, hy, 90)
  labeledLine(page, fonts, 'Date :', data.hrmoEncodedDate, rx + rightW * 0.52, hy, 70, '(MM/DD/YYYY)')
  hy -= 22
  labeledLine(page, fonts, 'Remarks :', data.hrmoRemarks, rx + 8, hy, rightW - 70)
}

function drawFooterBanner(page: PDFPage) {
  const y = MARGIN - 6
  const h = 22
  page.drawRectangle({
    x: MARGIN - 6,
    y,
    width: PAGE_W - (MARGIN - 6) * 2,
    height: h,
    color: NAVY,
  })
  page.drawRectangle({
    x: MARGIN - 6,
    y,
    width: 70,
    height: h,
    color: GOLD,
  })
  page.drawRectangle({
    x: PAGE_W - MARGIN + 6 - 70,
    y,
    width: 70,
    height: h,
    color: GOLD,
  })
}
