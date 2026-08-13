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
import type { ApprovalDecision, CtoFormData } from './types'

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 24

const NAVY = rgb(0.05, 0.18, 0.38)
const TITLE_BLUE = rgb(0.08, 0.25, 0.5)
const LINE_BLUE = rgb(0.15, 0.35, 0.65)
const LIGHT_FILL = rgb(0.93, 0.95, 0.98)
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

function drawCheckbox(
  page: PDFPage,
  x: number,
  y: number,
  label: string,
  checked: boolean,
  font: PDFFont,
  size = 7,
) {
  const box = 8
  page.drawRectangle({
    x,
    y: y - 1,
    width: box,
    height: box,
    borderColor: NAVY,
    borderWidth: 0.9,
  })
  if (checked) {
    page.drawText('X', { x: x + 1.6, y, size: 7, font, color: BLACK })
  }
  page.drawText(label, { x: x + box + 4, y, size, font: font, color: BLACK })
}

function drawCell(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string | undefined,
  fonts: Fonts,
  opts?: { headerFill?: boolean; centerLabel?: boolean; valueSize?: number },
) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderColor: LINE_BLUE,
    borderWidth: 0.7,
    color: opts?.headerFill ? LIGHT_FILL : undefined,
  })
  const labelSize = 6.5
  const labelW = fonts.bold.widthOfTextAtSize(label, labelSize)
  const labelX = opts?.centerLabel ? x + (w - labelW) / 2 : x + 4
  // Label near top of cell
  page.drawText(label, {
    x: labelX,
    y: y + h - 9,
    size: labelSize,
    font: fonts.bold,
    color: NAVY,
  })
  if (value) {
    const vSize = opts?.valueSize ?? 8
    let text = value
    const maxW = w - 8
    if (fonts.regular.widthOfTextAtSize(text, vSize) > maxW) {
      while (text.length > 1 && fonts.regular.widthOfTextAtSize(`${text}…`, vSize) > maxW) {
        text = text.slice(0, -1)
      }
      text = `${text}…`
    }
    // Value near bottom — keep clear gap under the label
    page.drawText(text, {
      x: x + 4,
      y: y + 5,
      size: vSize,
      font: fonts.regular,
      color: BLACK,
    })
  }
}

function drawCenteredOnLine(
  page: PDFPage,
  fonts: Fonts,
  value: string | undefined,
  label: string,
  subLabel: string | undefined,
  lineX: number,
  lineY: number,
  lineW: number,
) {
  drawUnderline(page, lineX, lineY, lineW)
  if (value) {
    const size = 8
    const vw = fonts.regular.widthOfTextAtSize(value, size)
    page.drawText(value, {
      x: lineX + (lineW - vw) / 2,
      y: lineY + 3,
      size,
      font: fonts.regular,
      color: BLACK,
    })
  }
  const lw = fonts.regular.widthOfTextAtSize(label, 6)
  page.drawText(label, {
    x: lineX + (lineW - lw) / 2,
    y: lineY - 9,
    size: 6,
    font: fonts.regular,
    color: GRAY,
  })
  if (subLabel) {
    const sw = fonts.regular.widthOfTextAtSize(subLabel, 5.5)
    page.drawText(subLabel, {
      x: lineX + (lineW - sw) / 2,
      y: lineY - 17,
      size: 5.5,
      font: fonts.regular,
      color: GRAY,
    })
  }
}

export async function generateCtoPdf(
  data: CtoFormData,
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
  const controlNumber = data.controlNumber?.trim() || 'CTO-2026-00001'

  page.drawRectangle({
    x: MARGIN - 5,
    y: MARGIN - 5,
    width: PAGE_W - (MARGIN - 5) * 2,
    height: PAGE_H - (MARGIN - 5) * 2,
    borderColor: NAVY,
    borderWidth: 1.2,
  })

  drawHeader(page, fonts, logo, controlNumber, data.dateFiled)
  let y = PAGE_H - 118
  y = drawEmployeeInfo(page, fonts, data, y)
  y = drawCreditInfo(page, fonts, data, y - 3)
  y = drawRequestDetails(page, fonts, data, y - 3)
  y = drawEmployeeCertification(page, fonts, data, y - 3)
  y = drawApprovalBoxes(page, fonts, data, y - 3)
  y = drawHrmoVerification(page, fonts, data, y - 3)
  y = drawHrmoUseOnly(page, fonts, data, y - 3)
  drawReminders(page, fonts, y - 4)

  pdf.setTitle(`CTO ${controlNumber}`)
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
  const top = PAGE_H - MARGIN - 2
  const logoSize = 50
  page.drawImage(logo, {
    x: MARGIN,
    y: top - logoSize,
    width: logoSize,
    height: logoSize,
  })

  // Agency text centered in remaining header area (left of control box)
  const boxW = 118
  const textLeft = MARGIN + logoSize + 4
  const textRight = PAGE_W - MARGIN - boxW - 8
  let ty = top - 8
  drawCentered(page, 'REPUBLIC OF THE PHILIPPINES', ty, fonts.regular, 7, BLACK, textLeft, textRight)
  ty -= 9
  drawCentered(page, 'PROVINCE OF OCCIDENTAL MINDORO', ty, fonts.regular, 7, BLACK, textLeft, textRight)
  ty -= 10
  drawCentered(page, 'MUNICIPALITY OF MAGSAYSAY', ty, fonts.bold, 9.5, TITLE_BLUE, textLeft, textRight)
  ty -= 9
  drawCentered(
    page,
    'HUMAN RESOURCE & PAYROLL MANAGEMENT SYSTEM',
    ty,
    fonts.regular,
    6.5,
    TITLE_BLUE,
    textLeft,
    textRight,
  )

  // Control box
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
  page.drawRectangle({ x: boxX, y: boxY + boxH - 12, width: boxW, height: 12, color: NAVY })
  drawCentered(page, 'CTO CONTROL NUMBER', boxY + boxH - 9.5, fonts.bold, 6.5, WHITE, boxX, boxX + boxW)

  drawBarcode(page, controlNumber, boxX + 8, boxY + 42, boxW - 16, 12)
  const cnW = fonts.bold.widthOfTextAtSize(controlNumber, 8)
  page.drawText(controlNumber, {
    x: boxX + (boxW - cnW) / 2,
    y: boxY + 30,
    size: 8,
    font: fonts.bold,
    color: BLACK,
  })

  page.drawRectangle({ x: boxX, y: boxY + 14, width: boxW, height: 11, color: NAVY })
  drawCentered(page, 'DATE FILED', boxY + 16.5, fonts.bold, 6.5, WHITE, boxX, boxX + boxW)
  drawUnderline(page, boxX + 10, boxY + 6, boxW - 20)
  if (dateFiled) {
    const dw = fonts.regular.widthOfTextAtSize(dateFiled, 7)
    page.drawText(dateFiled, {
      x: boxX + (boxW - dw) / 2,
      y: boxY + 7,
      size: 7,
      font: fonts.regular,
      color: BLACK,
    })
  }
  drawCentered(page, '(YYYY-MM-DD)', boxY + 1, fonts.regular, 5, GRAY, boxX, boxX + boxW)

  drawCentered(page, 'COMPENSATORY TIME OFF (CTO) APPLICATION FORM', PAGE_H - 96, fonts.bold, 11, TITLE_BLUE)
  drawCentered(
    page,
    'Purpose: Request to avail earned Compensatory Time Off (CTO).',
    PAGE_H - 108,
    fonts.italic,
    7.5,
    BLACK,
  )
}

function drawEmployeeInfo(page: PDFPage, fonts: Fonts, data: CtoFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 13
  const rowH = 28
  const rows = 3
  const bodyH = rowH * rows
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '1. EMPLOYEE INFORMATION', fonts.bold)

  const colW = w / 2
  const cells: [string, string | undefined][][] = [
    [
      ['Employee Name', data.employeeName],
      ['Employee ID', data.employeeId],
    ],
    [
      ['Position', data.position],
      ['Office / Department', data.officeDepartment],
    ],
    [
      ['Employment Status', data.employmentStatus],
      ['Payroll Group', data.payrollGroup],
    ],
  ]

  for (let r = 0; r < rows; r++) {
    const cy = y - (r + 1) * rowH
    drawCell(page, x, cy, colW, rowH, cells[r]![0]![0], cells[r]![0]![1], fonts)
    drawCell(page, x + colW, cy, colW, rowH, cells[r]![1]![0], cells[r]![1]![1], fonts)
  }
  return y - bodyH
}

function drawCreditInfo(page: PDFPage, fonts: Fonts, data: CtoFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 13
  const headerH = 18
  const rowH = 22
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '2. CTO CREDIT INFORMATION', fonts.bold)

  const cols = [
    { label: 'Overtime Certification No.', w: w * 0.28, value: data.overtimeCertificationNo },
    { label: 'Date(s) Earned (YYYY-MM-DD)', w: w * 0.28, value: data.datesEarned },
    { label: 'Total Earned CTO Hours', w: w * 0.22, value: data.totalEarnedCtoHours },
    { label: 'Available CTO Balance', w: w * 0.22, value: data.availableCtoBalance },
  ]

  let cx = x
  const headerY = y - headerH
  for (const col of cols) {
    page.drawRectangle({
      x: cx,
      y: headerY,
      width: col.w,
      height: headerH,
      borderColor: LINE_BLUE,
      borderWidth: 0.7,
      color: LIGHT_FILL,
    })
    drawCentered(page, col.label, headerY + 5.5, fonts.bold, 6, NAVY, cx, cx + col.w)
    cx += col.w
  }

  cx = x
  const dataY = headerY - rowH
  for (const col of cols) {
    page.drawRectangle({
      x: cx,
      y: dataY,
      width: col.w,
      height: rowH,
      borderColor: LINE_BLUE,
      borderWidth: 0.7,
    })
    if (col.value) {
      drawCentered(page, col.value, dataY + 7, fonts.regular, 8, BLACK, cx, cx + col.w)
    }
    cx += col.w
  }

  return dataY
}

function drawRequestDetails(page: PDFPage, fonts: Fonts, data: CtoFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 13
  const headerH = 18
  const rowH = 22
  const purposeH = 48
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '3. CTO REQUEST DETAILS', fonts.bold)

  const cols = [
    { label: 'Date(s) Requested (YYYY-MM-DD)', w: w * 0.3, value: data.datesRequested },
    { label: 'Time From', w: w * 0.2, value: data.timeFrom },
    { label: 'Time To', w: w * 0.2, value: data.timeTo },
    { label: 'Total Hours Requested', w: w * 0.3, value: data.totalHoursRequested },
  ]

  let cx = x
  const headerY = y - headerH
  for (const col of cols) {
    page.drawRectangle({
      x: cx,
      y: headerY,
      width: col.w,
      height: headerH,
      borderColor: LINE_BLUE,
      borderWidth: 0.7,
      color: LIGHT_FILL,
    })
    drawCentered(page, col.label, headerY + 5.5, fonts.bold, 6, NAVY, cx, cx + col.w)
    cx += col.w
  }

  cx = x
  const dataY = headerY - rowH
  for (const col of cols) {
    page.drawRectangle({
      x: cx,
      y: dataY,
      width: col.w,
      height: rowH,
      borderColor: LINE_BLUE,
      borderWidth: 0.7,
    })
    if (col.value) {
      drawCentered(page, col.value, dataY + 7, fonts.regular, 8, BLACK, cx, cx + col.w)
    }
    cx += col.w
  }

  const purposeY = dataY - purposeH
  page.drawRectangle({
    x,
    y: purposeY,
    width: w,
    height: purposeH,
    borderColor: LINE_BLUE,
    borderWidth: 0.7,
  })
  page.drawText('Purpose / Reason (Please specify)', {
    x: x + 5,
    y: purposeY + purposeH - 11,
    size: 7,
    font: fonts.bold,
    color: NAVY,
  })
  const purposeLines = wrapText(data.purposeReason || '', fonts.regular, 8, w - 14)
  let py = purposeY + purposeH - 24
  for (let i = 0; i < 3; i++) {
    drawUnderline(page, x + 6, py, w - 12)
    if (purposeLines[i]) {
      page.drawText(purposeLines[i]!, {
        x: x + 8,
        y: py + 2,
        size: 8,
        font: fonts.regular,
        color: BLACK,
      })
    }
    py -= 11
  }

  return purposeY
}

function drawEmployeeCertification(
  page: PDFPage,
  fonts: Fonts,
  data: CtoFormData,
  topY: number,
): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 13
  const bodyH = 58
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '4. EMPLOYEE CERTIFICATION', fonts.bold)
  page.drawRectangle({
    x,
    y: y - bodyH,
    width: w,
    height: bodyH,
    borderColor: LINE_BLUE,
    borderWidth: 0.7,
  })

  const cert =
    'I hereby certify that the information provided is true and correct and that the requested Compensatory Time Off (CTO) is based on earned and approved overtime credits.'
  let ty = y - 14
  for (const line of wrapText(cert, fonts.regular, 7, w - 16)) {
    page.drawText(line, { x: x + 8, y: ty, size: 7, font: fonts.regular, color: BLACK })
    ty -= 9
  }

  const sigY = y - bodyH + 20
  const half = w / 2
  drawCenteredOnLine(
    page,
    fonts,
    data.employeeSignatureName,
    'Signature over Printed Name',
    undefined,
    x + (half - 180) / 2,
    sigY,
    180,
  )
  drawCenteredOnLine(
    page,
    fonts,
    data.employeeSignatureDate,
    'Date (YYYY-MM-DD)',
    undefined,
    x + half + (half - 120) / 2,
    sigY,
    120,
  )

  return y - bodyH
}

function drawApprovalBoxes(page: PDFPage, fonts: Fonts, data: CtoFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const gap = 4
  const colW = (w - gap) / 2
  const barH = 13
  const bodyH = 118
  const y = topY - barH

  drawApprovalBox(
    page,
    fonts,
    x,
    y,
    colW,
    barH,
    bodyH,
    '5. IMMEDIATE SUPERVISOR RECOMMENDATION',
    data.supervisorDecision,
    data.supervisorRemarks,
    data.supervisorSignatureName,
    data.supervisorPrintedName,
    data.supervisorPosition,
    data.supervisorDate,
    true,
  )
  drawApprovalBox(
    page,
    fonts,
    x + colW + gap,
    y,
    colW,
    barH,
    bodyH,
    '6. DEPARTMENT HEAD APPROVAL',
    data.deptHeadDecision,
    data.deptHeadRemarks,
    data.deptHeadSignatureName,
    data.deptHeadPrintedName,
    undefined,
    data.deptHeadDate,
    false,
  )

  return y - bodyH
}

function drawApprovalBox(
  page: PDFPage,
  fonts: Fonts,
  x: number,
  topY: number,
  width: number,
  barH: number,
  bodyH: number,
  title: string,
  decision: ApprovalDecision | undefined,
  remarks: string | undefined,
  signatureName: string | undefined,
  printedName: string | undefined,
  position: string | undefined,
  date: string | undefined,
  showPosition: boolean,
) {
  drawSectionBar(page, x, topY, width, barH, title, fonts.bold, 6.5)
  page.drawRectangle({
    x,
    y: topY - bodyH,
    width,
    height: bodyH,
    borderColor: LINE_BLUE,
    borderWidth: 0.7,
  })

  drawCheckbox(page, x + 8, topY - 16, 'APPROVED', decision === 'approved', fonts.bold, 7)
  drawCheckbox(page, x + 90, topY - 16, 'DISAPPROVED', decision === 'disapproved', fonts.bold, 7)

  page.drawText('Remarks:', {
    x: x + 8,
    y: topY - 30,
    size: 7,
    font: fonts.bold,
    color: BLACK,
  })
  const remarkLines = wrapText(remarks || '', fonts.regular, 7, width - 16)
  let ry = topY - 40
  for (let i = 0; i < 2; i++) {
    drawUnderline(page, x + 8, ry, width - 16)
    if (remarkLines[i]) {
      page.drawText(remarkLines[i]!, {
        x: x + 10,
        y: ry + 2,
        size: 7,
        font: fonts.regular,
        color: BLACK,
      })
    }
    ry -= 11
  }

  const sigY = topY - bodyH + (showPosition ? 48 : 38)
  const lineW = width - 40
  const lineX = x + 20
  drawCenteredOnLine(page, fonts, signatureName, 'Signature', undefined, lineX, sigY, lineW)

  let py = sigY - 22
  page.drawText('Printed Name:', { x: x + 10, y: py, size: 6.5, font: fonts.regular, color: BLACK })
  const pnLabelW = fonts.regular.widthOfTextAtSize('Printed Name:', 6.5)
  drawUnderline(page, x + 10 + pnLabelW + 3, py - 1, width - 24 - pnLabelW)
  if (printedName) {
    page.drawText(printedName, {
      x: x + 10 + pnLabelW + 5,
      y: py + 1,
      size: 7,
      font: fonts.regular,
      color: BLACK,
    })
  }

  if (showPosition) {
    py -= 12
    page.drawText('Position:', { x: x + 10, y: py, size: 6.5, font: fonts.regular, color: BLACK })
    const posLabelW = fonts.regular.widthOfTextAtSize('Position:', 6.5)
    drawUnderline(page, x + 10 + posLabelW + 3, py - 1, width - 24 - posLabelW)
    if (position) {
      page.drawText(position, {
        x: x + 10 + posLabelW + 5,
        y: py + 1,
        size: 7,
        font: fonts.regular,
        color: BLACK,
      })
    }
  }

  py -= 12
  page.drawText('Date:', { x: x + 10, y: py, size: 6.5, font: fonts.regular, color: BLACK })
  const dLabelW = fonts.regular.widthOfTextAtSize('Date:', 6.5)
  const hint = '(YYYY-MM-DD)'
  const hintW = fonts.regular.widthOfTextAtSize(hint, 5.5)
  drawUnderline(page, x + 10 + dLabelW + 3, py - 1, width - 28 - dLabelW - hintW)
  if (date) {
    page.drawText(date, {
      x: x + 10 + dLabelW + 5,
      y: py + 1,
      size: 7,
      font: fonts.regular,
      color: BLACK,
    })
  }
  page.drawText(hint, {
    x: x + width - 10 - hintW,
    y: py,
    size: 5.5,
    font: fonts.regular,
    color: TITLE_BLUE,
  })
}

function drawHrmoVerification(page: PDFPage, fonts: Fonts, data: CtoFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 13
  const headerH = 20
  const rowH = 36
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '7. HRMO VERIFICATION', fonts.bold)

  const cols = [
    { label: 'Earned CTO Credits (Hours)', w: w * 0.25, value: data.earnedCtoCredits },
    { label: 'Hours Requested (Hours)', w: w * 0.25, value: data.hoursRequested },
    { label: 'Remaining CTO Balance (Hours)', w: w * 0.25, value: data.remainingCtoBalance },
    { label: 'Verified By', w: w * 0.25, value: undefined as string | undefined },
  ]

  let cx = x
  const headerY = y - headerH
  for (const col of cols) {
    page.drawRectangle({
      x: cx,
      y: headerY,
      width: col.w,
      height: headerH,
      borderColor: LINE_BLUE,
      borderWidth: 0.7,
      color: LIGHT_FILL,
    })
    drawCentered(page, col.label, headerY + 6.5, fonts.bold, 6, NAVY, cx, cx + col.w)
    cx += col.w
  }

  cx = x
  const dataY = headerY - rowH
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i]!
    page.drawRectangle({
      x: cx,
      y: dataY,
      width: col.w,
      height: rowH,
      borderColor: LINE_BLUE,
      borderWidth: 0.7,
    })
    if (i < 3) {
      if (col.value) {
        drawCentered(page, col.value, dataY + 14, fonts.regular, 9, BLACK, cx, cx + col.w)
      }
    } else {
      const lineW = col.w - 16
      const lineX = cx + 8
      drawUnderline(page, lineX, dataY + 22, lineW)
      if (data.hrmoVerifiedBy) {
        const nw = fonts.regular.widthOfTextAtSize(data.hrmoVerifiedBy, 7)
        page.drawText(data.hrmoVerifiedBy, {
          x: lineX + (lineW - nw) / 2,
          y: dataY + 24,
          size: 7,
          font: fonts.regular,
          color: BLACK,
        })
      }
      const sigL = 'Signature'
      page.drawText(sigL, {
        x: lineX + (lineW - fonts.regular.widthOfTextAtSize(sigL, 5.5)) / 2,
        y: dataY + 14,
        size: 5.5,
        font: fonts.regular,
        color: GRAY,
      })
      drawUnderline(page, lineX, dataY + 8, lineW)
      if (data.hrmoVerifiedDate) {
        const dw = fonts.regular.widthOfTextAtSize(data.hrmoVerifiedDate, 7)
        page.drawText(data.hrmoVerifiedDate, {
          x: lineX + (lineW - dw) / 2,
          y: dataY + 10,
          size: 7,
          font: fonts.regular,
          color: BLACK,
        })
      }
      const dateL = 'Date (YYYY-MM-DD)'
      page.drawText(dateL, {
        x: lineX + (lineW - fonts.regular.widthOfTextAtSize(dateL, 5)) / 2,
        y: dataY + 1,
        size: 5,
        font: fonts.regular,
        color: GRAY,
      })
    }
    cx += col.w
  }

  return dataY
}

function drawHrmoUseOnly(page: PDFPage, fonts: Fonts, data: CtoFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 13
  const headerH = 18
  const rowH = 22
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, 'FOR HRMO USE ONLY', fonts.bold)

  const cols = [
    { label: 'Processed By', w: w * 0.2, value: data.processedBy },
    { label: 'Recorded By', w: w * 0.2, value: data.recordedBy },
    { label: 'Approved By', w: w * 0.2, value: data.approvedBy },
    { label: 'Date Processed (YYYY-MM-DD)', w: w * 0.22, value: data.dateProcessed },
    { label: 'CTO Ledger Reference No.', w: w * 0.18, value: data.ctoLedgerReferenceNo },
  ]

  let cx = x
  const headerY = y - headerH
  for (const col of cols) {
    page.drawRectangle({
      x: cx,
      y: headerY,
      width: col.w,
      height: headerH,
      borderColor: LINE_BLUE,
      borderWidth: 0.7,
      color: LIGHT_FILL,
    })
    drawCentered(page, col.label, headerY + 5.5, fonts.bold, 5.5, NAVY, cx, cx + col.w)
    cx += col.w
  }

  cx = x
  const dataY = headerY - rowH
  for (const col of cols) {
    page.drawRectangle({
      x: cx,
      y: dataY,
      width: col.w,
      height: rowH,
      borderColor: LINE_BLUE,
      borderWidth: 0.7,
    })
    if (col.value) {
      drawCentered(page, col.value, dataY + 7, fonts.regular, 7.5, BLACK, cx, cx + col.w)
    }
    cx += col.w
  }

  return dataY
}

function drawReminders(page: PDFPage, fonts: Fonts, topY: number) {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 13
  const boxY = 16
  const contentTop = topY - 3
  const boxH = Math.max(56, contentTop - boxY)
  const barY = boxY + boxH - barH

  drawSectionBar(page, x, barY, w, barH, 'REMINDERS', fonts.bold)
  page.drawRectangle({
    x,
    y: boxY,
    width: w,
    height: boxH - barH,
    borderColor: LINE_BLUE,
    borderWidth: 0.7,
  })

  const reminders = [
    '1. CTO shall only be granted based on approved and certified overtime rendered.',
    '2. Approval of CTO shall be subject to office exigencies and continuous delivery of public service.',
    '3. Approved CTO shall be deducted from the employee\'s CTO Ledger.',
    '4. This form shall be attached to the approved Overtime Certification and filed with the HRMO.',
  ]
  let ry = barY - 11
  for (const note of reminders) {
    for (const line of wrapText(note, fonts.regular, 6, w - 14)) {
      page.drawText(line, { x: x + 7, y: ry, size: 6, font: fonts.regular, color: BLACK })
      ry -= 7.5
    }
  }
}
