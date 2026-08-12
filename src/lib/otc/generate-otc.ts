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
import type { OtcFormData } from './types'

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 26

const NAVY = rgb(0.05, 0.18, 0.38)
const TITLE_BLUE = rgb(0.08, 0.25, 0.5)
const LINE_BLUE = rgb(0.15, 0.35, 0.65)
const LIGHT_BLUE = rgb(0.78, 0.88, 0.95)
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
  size = 8,
) {
  page.drawRectangle({ x, y, width, height, color: NAVY })
  page.drawText(title, {
    x: x + 6,
    y: y + (height - size) / 2 + 0.5,
    size,
    font,
    color: WHITE,
  })
}

function drawSubBar(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  font: PDFFont,
) {
  page.drawRectangle({ x, y, width, height, color: LIGHT_BLUE })
  page.drawText(title, {
    x: x + 6,
    y: y + (height - 7.5) / 2 + 0.5,
    size: 7.5,
    font,
    color: NAVY,
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
      x: lineX + lineWidth + 3,
      y,
      size: 6.5,
      font: fonts.bold,
      color: TITLE_BLUE,
    })
  }
}

function drawCheckbox(page: PDFPage, x: number, y: number, size: number, checked: boolean, font: PDFFont) {
  page.drawRectangle({
    x,
    y,
    width: size,
    height: size,
    borderColor: NAVY,
    borderWidth: 1.1,
  })
  if (checked) {
    page.drawText('X', {
      x: x + size * 0.22,
      y: y + size * 0.18,
      size: size * 0.75,
      font,
      color: BLACK,
    })
  }
}

export async function generateOtcPdf(
  data: OtcFormData,
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
  const controlNumber = data.controlNumber?.trim() || 'OTC-2026-00001'

  page.drawRectangle({
    x: MARGIN - 6,
    y: MARGIN - 6,
    width: PAGE_W - (MARGIN - 6) * 2,
    height: PAGE_H - (MARGIN - 6) * 2,
    borderColor: NAVY,
    borderWidth: 1.2,
  })

  drawHeader(page, fonts, logo, controlNumber, data.dateCertified)
  let y = PAGE_H - 122
  y = drawEmployeeInfo(page, fonts, data, y)
  y = drawOvertimeDetails(page, fonts, data, y - 3)
  y = drawDisposition(page, fonts, data, y - 3)

  // Pin footer + slogan to page bottom, then stretch certifications into the leftover space
  const sloganY = 20
  const footerH = 54
  const footerBottom = sloganY + 12
  const footerTop = footerBottom + footerH
  drawCertifications(page, fonts, data, y - 3, footerTop + 4)
  drawFooter(page, fonts, data, footerTop, footerBottom)

  drawCentered(
    page,
    '"Excellent Public Service Begins with Dedicated and Committed Employees."',
    sloganY,
    fonts.italic,
    7,
    TITLE_BLUE,
  )

  pdf.setTitle(`OTC ${controlNumber}`)
  pdf.setAuthor('Municipality of Magsaysay HR & Payroll')
  return pdf.save()
}

function drawHeader(
  page: PDFPage,
  fonts: Fonts,
  logo: PDFImage,
  controlNumber: string,
  dateCertified?: string,
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
  let ty = top - 8
  page.drawText('REPUBLIC OF THE PHILIPPINES', {
    x: textX,
    y: ty,
    size: 7,
    font: fonts.regular,
    color: BLACK,
  })
  ty -= 9
  page.drawText('PROVINCE OF OCCIDENTAL MINDORO', {
    x: textX,
    y: ty,
    size: 7,
    font: fonts.regular,
    color: BLACK,
  })
  ty -= 10
  page.drawText('MUNICIPALITY OF MAGSAYSAY', {
    x: textX,
    y: ty,
    size: 9.5,
    font: fonts.bold,
    color: TITLE_BLUE,
  })
  ty -= 9
  page.drawText('HUMAN RESOURCE & PAYROLL', {
    x: textX,
    y: ty,
    size: 6.5,
    font: fonts.regular,
    color: GRAY,
  })
  ty -= 8
  page.drawText('MANAGEMENT SYSTEM', {
    x: textX,
    y: ty,
    size: 6.5,
    font: fonts.regular,
    color: GRAY,
  })

  const boxW = 128
  const boxH = 74
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
    y: boxY + 44,
    size: cnSize,
    font: fonts.bold,
    color: RED,
  })
  drawBarcode(page, controlNumber, boxX + 10, boxY + 24, boxW - 20, 14)

  page.drawText('Date Certified:', {
    x: boxX + 6,
    y: boxY + 10,
    size: 7,
    font: fonts.regular,
    color: BLACK,
  })
  drawUnderline(page, boxX + 58, boxY + 8, boxW - 66)
  drawValue(page, dateCertified, boxX + 60, boxY + 10, fonts.regular, 7, boxW - 70)
  page.drawText('(MM/DD/YYYY)', {
    x: boxX + 58,
    y: boxY + 2,
    size: 5.5,
    font: fonts.regular,
    color: GRAY,
  })

  drawCentered(page, 'OVERTIME CERTIFICATION', PAGE_H - 96, fonts.bold, 13, TITLE_BLUE)
  page.drawLine({
    start: { x: PAGE_W / 2 - 70, y: PAGE_H - 102 },
    end: { x: PAGE_W / 2 + 70, y: PAGE_H - 102 },
    thickness: 1,
    color: NAVY,
  })
  drawCentered(
    page,
    'Purpose: Certifies that overtime was actually rendered.',
    PAGE_H - 113,
    fonts.italic,
    7.5,
    BLACK,
  )
}

function drawEmployeeInfo(page: PDFPage, fonts: Fonts, data: OtcFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 13
  const bodyH = 48
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
    ['Employee Name :', data.employeeName],
    ['Position :', data.position],
    ['Employment Status :', data.employmentStatus],
  ] as const
  const right = [
    ['Employee ID :', data.employeeId],
    ['Office / Department :', data.officeDepartment],
    ['Payroll Group :', data.payrollGroup],
  ] as const

  let rowY = y - 14
  for (let i = 0; i < 3; i++) {
    labeledLine(page, fonts, left[i]![0], left[i]![1], x + 8, rowY, colW - 120)
    labeledLine(page, fonts, right[i]![0], right[i]![1], x + colW + 8, rowY, colW - 130)
    rowY -= 13
  }
  return y - bodyH
}

function drawOvertimeDetails(page: PDFPage, fonts: Fonts, data: OtcFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 13
  const bodyH = 72
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
  let rowY = y - 14
  labeledLine(
    page,
    fonts,
    'Date / Dates of Overtime :',
    data.datesOfOvertime,
    x + 8,
    rowY,
    colW - 155,
    '(MM/DD/YYYY)',
  )
  labeledLine(page, fonts, 'Day(s) of the Week :', data.daysOfWeek, x + colW + 8, rowY, colW - 130)

  rowY -= 16
  labeledLine(
    page,
    fonts,
    'Approved Overtime Hours (As per OTAF) :',
    data.approvedOvertimeHours,
    x + 8,
    rowY,
    colW - 210,
    '(HH:MM)',
  )
  labeledLine(
    page,
    fonts,
    'Actual Hours Rendered :',
    data.actualHoursRendered,
    x + colW + 8,
    rowY,
    colW - 145,
    '(HH:MM)',
  )

  rowY -= 14
  page.drawText('Nature of Work / Purpose :', {
    x: x + 8,
    y: rowY,
    size: 8,
    font: fonts.regular,
    color: BLACK,
  })
  const natureLines = wrapText(data.natureOfWork || '', fonts.regular, 8, w - 20)
  for (let i = 0; i < 2; i++) {
    rowY -= 11
    drawUnderline(page, x + 8, rowY, w - 16)
    if (natureLines[i]) {
      page.drawText(natureLines[i]!, {
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

function drawDisposition(page: PDFPage, fonts: Fonts, data: OtcFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 13
  const bodyH = 70
  const y = topY - barH
  drawSectionBar(
    page,
    x,
    y,
    w,
    barH,
    '3. OVERTIME DISPOSITION (Please select one option)',
    fonts.bold,
    7.5,
  )
  page.drawRectangle({
    x,
    y: y - bodyH,
    width: w,
    height: bodyH,
    borderColor: NAVY,
    borderWidth: 0.8,
  })

  const colW = w / 2
  page.drawLine({
    start: { x: x + colW, y: y - bodyH },
    end: { x: x + colW, y: y },
    thickness: 0.7,
    color: LIGHT_BORDER,
  })

  drawDispositionOption(
    page,
    fonts,
    x,
    y,
    colW,
    data.disposition === 'overtimePay',
    'COMPENSATE THROUGH OVERTIME PAY',
    'The overtime service rendered has been verified and shall be compensated in accordance with applicable Civil Service Commission (CSC), DBM, COA, and other existing laws, rules, and regulations.',
  )
  drawDispositionOption(
    page,
    fonts,
    x + colW,
    y,
    colW,
    data.disposition === 'cto',
    'CREDIT AS COMPENSATORY TIME OFF (CTO)',
    'The overtime service rendered has been verified and shall be credited as Compensatory Time Off (CTO) in accordance with applicable Civil Service Commission (CSC), DBM, COA, and other existing laws, rules, and regulations.',
  )

  return y - bodyH
}

function drawDispositionOption(
  page: PDFPage,
  fonts: Fonts,
  x: number,
  topY: number,
  width: number,
  checked: boolean,
  title: string,
  description: string,
) {
  const boxSize = 10
  const pad = 6
  drawCheckbox(page, x + pad, topY - 18, boxSize, checked, fonts.bold)
  const titleX = x + pad + boxSize + 5
  const titleLines = wrapText(title, fonts.bold, 7, width - pad * 2 - boxSize - 8)
  let ty = topY - 16
  for (const line of titleLines) {
    page.drawText(line, { x: titleX, y: ty, size: 7, font: fonts.bold, color: BLACK })
    ty -= 9
  }

  let dy = topY - 36
  for (const line of wrapText(description, fonts.regular, 5.8, width - pad * 2)) {
    page.drawText(line, { x: x + pad, y: dy, size: 5.8, font: fonts.regular, color: BLACK })
    dy -= 7.5
  }
}

function drawCertifications(
  page: PDFPage,
  fonts: Fonts,
  data: OtcFormData,
  topY: number,
  bottomY: number,
): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 13
  const gap = 2
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '4. CERTIFICATIONS', fonts.bold)

  const blocks: {
    title: string
    statement: string
    name?: string
    date?: string
    role: string
  }[] = [
    {
      title: '4.1 CERTIFIED CORRECT BY (IMMEDIATE SUPERVISOR)',
      statement:
        'I hereby certify that the overtime work was actually rendered by the employee as stated above, and that the information provided is true and correct.',
      name: data.supervisorName,
      date: data.supervisorDate,
      role: 'Immediate Supervisor',
    },
    {
      title: '4.2 DEPARTMENT HEAD CERTIFICATION',
      statement:
        'I hereby certify that the overtime service rendered is necessary and was performed in relation to the functions and programs of this office.',
      name: data.departmentHeadName,
      date: data.departmentHeadDate,
      role: 'Department Head',
    },
    {
      title: '4.3 HRMO VERIFICATION',
      statement:
        'I hereby verify that the foregoing overtime service is supported by appropriate records and that sufficient funds are available for payment / CTO credit.',
      name: data.hrmoName,
      date: data.hrmoDate,
      role: 'HRMO Representative',
    },
  ]

  // Stretch the 3 certification blocks to fill all space down to the footer
  const available = Math.max(160, y - bottomY)
  const blockH = Math.floor((available - gap * blocks.length) / blocks.length)

  let by = y
  for (const block of blocks) {
    by -= gap
    const subH = 11
    drawSubBar(page, x, by - subH, w, subH, block.title, fonts.bold)
    page.drawRectangle({
      x,
      y: by - blockH,
      width: w,
      height: blockH - subH,
      borderColor: NAVY,
      borderWidth: 0.7,
    })

    let ty = by - subH - 12
    for (const line of wrapText(block.statement, fonts.italic, 6.5, w - 16)) {
      page.drawText(line, { x: x + 8, y: ty, size: 6.5, font: fonts.italic, color: BLACK })
      ty -= 9
    }

    const sigY = by - blockH + 22
    const sigColW = w * 0.55
    const sigLineW = 200
    const sigLineX = x + (sigColW - sigLineW) / 2
    drawUnderline(page, sigLineX, sigY, sigLineW)
    if (block.name) {
      const nameSize = 8
      const nameW = fonts.regular.widthOfTextAtSize(block.name, nameSize)
      page.drawText(block.name, {
        x: sigLineX + (sigLineW - nameW) / 2,
        y: sigY + 3,
        size: nameSize,
        font: fonts.regular,
        color: BLACK,
      })
    }
    const sigLabel = 'Signature over Printed Name'
    const sigLabelW = fonts.regular.widthOfTextAtSize(sigLabel, 6)
    page.drawText(sigLabel, {
      x: sigLineX + (sigLineW - sigLabelW) / 2,
      y: sigY - 9,
      size: 6,
      font: fonts.regular,
      color: GRAY,
    })
    const roleLabel = `(${block.role})`
    const roleW = fonts.regular.widthOfTextAtSize(roleLabel, 5.5)
    page.drawText(roleLabel, {
      x: sigLineX + (sigLineW - roleW) / 2,
      y: sigY - 17,
      size: 5.5,
      font: fonts.regular,
      color: GRAY,
    })

    const dateColX = x + sigColW
    const dateColW = w - sigColW
    const dateLineW = 110
    const dateLineX = dateColX + (dateColW - dateLineW) / 2
    drawUnderline(page, dateLineX, sigY, dateLineW)
    if (block.date) {
      const dateSize = 8
      const dateW = fonts.regular.widthOfTextAtSize(block.date, dateSize)
      page.drawText(block.date, {
        x: dateLineX + (dateLineW - dateW) / 2,
        y: sigY + 3,
        size: dateSize,
        font: fonts.regular,
        color: BLACK,
      })
    }
    const dateLabel = 'Date'
    const dateLabelW = fonts.regular.widthOfTextAtSize(dateLabel, 6)
    page.drawText(dateLabel, {
      x: dateLineX + (dateLineW - dateLabelW) / 2,
      y: sigY - 9,
      size: 6,
      font: fonts.regular,
      color: GRAY,
    })
    const fmtLabel = '(MM/DD/YYYY)'
    const fmtW = fonts.regular.widthOfTextAtSize(fmtLabel, 5.5)
    page.drawText(fmtLabel, {
      x: dateLineX + (dateLineW - fmtW) / 2,
      y: sigY - 17,
      size: 5.5,
      font: fonts.regular,
      color: GRAY,
    })

    by -= blockH
  }

  return by
}

function drawFooter(
  page: PDFPage,
  fonts: Fonts,
  data: OtcFormData,
  footerTop: number,
  footerBottom: number,
) {
  const x = MARGIN
  const contentW = PAGE_W - MARGIN * 2
  const gap = 6
  const leftW = contentW * 0.52
  const rightW = contentW - leftW - gap
  const boxH = footerTop - footerBottom
  const boxY = footerBottom

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
    '1. Overtime shall be rendered beyond the regular office hours or during rest days/holidays as approved.',
    '2. Overtime not supported by approved request will not be included in payroll computation nor as CTO.',
    '3. Attach Accomplishment Report and other supporting documents.',
  ]
  let ry = boxY + boxH - 21
  for (const note of reminders) {
    for (const line of wrapText(note, fonts.regular, 5.4, leftW - 12)) {
      page.drawText(line, { x: x + 6, y: ry, size: 5.4, font: fonts.regular, color: BLACK })
      ry -= 6.6
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
  drawCentered(
    page,
    'FOR PAYROLL / HRMO USE ONLY',
    boxY + boxH - 11,
    fonts.bold,
    6.5,
    NAVY,
    rx,
    rx + rightW,
  )

  const rows: [string, string | undefined, string | undefined][] = [
    ['Processed By :', data.payrollProcessedBy, data.payrollProcessedDate],
    ['Encoded By :', data.payrollEncodedBy, data.payrollEncodedDate],
    ['Approved By :', data.payrollApprovedBy, data.payrollApprovedDate],
  ]
  const padX = 6
  const innerRight = rx + rightW - padX
  let py = boxY + boxH - 22
  for (const [label, by, date] of rows) {
    const labelSize = 7
    page.drawText(label, { x: rx + padX, y: py, size: labelSize, font: fonts.regular, color: BLACK })
    const byLabelW = fonts.regular.widthOfTextAtSize(label, labelSize)
    const byLineX = rx + padX + byLabelW + 3
    const dateLabel = 'Date :'
    const dateLabelW = fonts.regular.widthOfTextAtSize(dateLabel, labelSize)
    const hint = '(MM/DD/YYYY)'
    const hintW = fonts.regular.widthOfTextAtSize(hint, 5.5)
    const dateLineW = 42
    const dateLabelX = innerRight - hintW - 2 - dateLineW - 3 - dateLabelW
    const byLineW = Math.max(28, dateLabelX - byLineX - 8)

    drawUnderline(page, byLineX, py - 1, byLineW)
    drawValue(page, by, byLineX + 2, py + 1, fonts.regular, 7, byLineW - 4)

    page.drawText(dateLabel, {
      x: dateLabelX,
      y: py,
      size: labelSize,
      font: fonts.regular,
      color: BLACK,
    })
    const dateLineX = dateLabelX + dateLabelW + 3
    drawUnderline(page, dateLineX, py - 1, dateLineW)
    drawValue(page, date, dateLineX + 2, py + 1, fonts.regular, 7, dateLineW - 4)
    page.drawText(hint, {
      x: dateLineX + dateLineW + 2,
      y: py,
      size: 5.5,
      font: fonts.regular,
      color: TITLE_BLUE,
    })
    py -= 11
  }
}
