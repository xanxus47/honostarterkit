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
import type { DtrDayEntry, DtrFormData, EmploymentStatus } from './types'

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 18

const NAVY = rgb(0.08, 0.2, 0.4)
const TITLE_BLUE = rgb(0.1, 0.28, 0.55)
const LINE_BLUE = rgb(0.2, 0.4, 0.7)
const LIGHT_FILL = rgb(0.9, 0.93, 0.97)
const LIGHT_BAR = rgb(0.78, 0.88, 0.96)
const BLACK = rgb(0.05, 0.05, 0.05)
const WHITE = rgb(1, 1, 1)
const GRAY = rgb(0.35, 0.35, 0.35)

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

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
  x0: number,
  x1: number,
) {
  const w = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: (x0 + x1 - w) / 2, y, size, font, color })
}

function drawUnderline(page: PDFPage, x: number, y: number, width: number, color: RGB = LINE_BLUE) {
  page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.6, color })
}

function drawSectionBar(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  font: PDFFont,
  size = 7.5,
) {
  page.drawRectangle({ x, y, width, height, color: NAVY })
  page.drawText(title, {
    x: x + 5,
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
      page.drawRectangle({ x: cursor, y, width: Math.max(w, 0.35), height, color: BLACK })
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
) {
  const box = 6.5
  page.drawRectangle({
    x,
    y: y - 0.5,
    width: box,
    height: box,
    borderColor: NAVY,
    borderWidth: 0.7,
  })
  if (checked) {
    page.drawText('X', { x: x + 1.2, y: y, size: 6, font, color: BLACK })
  }
  page.drawText(label, { x: x + box + 2.5, y, size: 6, font, color: BLACK })
}

function dayNameFor(periodFrom: string | undefined, dayOfMonth: number): string {
  if (!periodFrom) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(periodFrom.trim())
  if (!m) return ''
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  const d = new Date(year, month, dayOfMonth)
  if (d.getMonth() !== month) return ''
  return DAY_NAMES[d.getDay()]!
}

function normalizeDays(data: DtrFormData): DtrDayEntry[] {
  const byDay = new Map<number, DtrDayEntry>()
  for (const entry of data.days || []) {
    const d = entry.day
    if (typeof d === 'number' && d >= 1 && d <= 31) byDay.set(d, entry)
  }
  const rows: DtrDayEntry[] = []
  for (let i = 1; i <= 31; i++) {
    const existing = byDay.get(i)
    rows.push({
      day: i,
      dayName: existing?.dayName || dayNameFor(data.periodFrom, i),
      amIn: existing?.amIn,
      amOut: existing?.amOut,
      pmIn: existing?.pmIn,
      pmOut: existing?.pmOut,
      otIn: existing?.otIn,
      otOut: existing?.otOut,
      undertimeMinutes: existing?.undertimeMinutes,
      totalHoursWorked: existing?.totalHoursWorked,
      remarks: existing?.remarks,
    })
  }
  return rows
}

function drawCenteredOnLine(
  page: PDFPage,
  fonts: Fonts,
  value: string | undefined,
  label: string,
  lineX: number,
  lineY: number,
  lineW: number,
) {
  drawUnderline(page, lineX, lineY, lineW)
  if (value) {
    const size = 7
    const vw = fonts.regular.widthOfTextAtSize(value, size)
    page.drawText(value, {
      x: lineX + (lineW - vw) / 2,
      y: lineY + 2,
      size,
      font: fonts.regular,
      color: BLACK,
    })
  }
  const lw = fonts.regular.widthOfTextAtSize(label, 5.5)
  page.drawText(label, {
    x: lineX + (lineW - lw) / 2,
    y: lineY - 8,
    size: 5.5,
    font: fonts.regular,
    color: GRAY,
  })
}

export async function generateDtrPdf(
  data: DtrFormData,
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
  const controlNumber = data.controlNumber?.trim() || 'DTR-2026-00001'

  page.drawRectangle({
    x: MARGIN - 4,
    y: MARGIN - 4,
    width: PAGE_W - (MARGIN - 4) * 2,
    height: PAGE_H - (MARGIN - 4) * 2,
    borderColor: NAVY,
    borderWidth: 1.1,
  })

  drawHeader(page, fonts, logo, controlNumber, data.dateIssued)
  let y = PAGE_H - 102
  y = drawEmployeeInfo(page, fonts, data, y)
  y = drawPeriodCovered(page, fonts, data, y - 2)
  y = drawTimeRecord(page, fonts, data, y - 2)
  y = drawSummary(page, fonts, data, y - 2)
  y = drawEmployeeCertification(page, fonts, data, y - 2)
  y = drawApprovals(page, fonts, data, y - 2)
  y = drawHrmoVerification(page, fonts, data, y - 2)
  drawReminders(page, fonts, y - 2)

  pdf.setTitle(`DTR ${controlNumber}`)
  pdf.setAuthor('Municipality of Magsaysay HR & Payroll')
  return pdf.save()
}

function drawHeader(
  page: PDFPage,
  fonts: Fonts,
  logo: PDFImage,
  controlNumber: string,
  dateIssued?: string,
) {
  const top = PAGE_H - MARGIN - 2
  const logoSize = 44
  page.drawImage(logo, {
    x: MARGIN,
    y: top - logoSize,
    width: logoSize,
    height: logoSize,
  })

  const boxW = 112
  const textLeft = MARGIN + logoSize + 4
  const textRight = PAGE_W - MARGIN - boxW - 6
  let ty = top - 7
  drawCentered(page, 'REPUBLIC OF THE PHILIPPINES', ty, fonts.regular, 6.5, BLACK, textLeft, textRight)
  ty -= 8
  drawCentered(page, 'PROVINCE OF OCCIDENTAL MINDORO', ty, fonts.regular, 6.5, BLACK, textLeft, textRight)
  ty -= 9
  drawCentered(page, 'MUNICIPALITY OF MAGSAYSAY', ty, fonts.bold, 9, TITLE_BLUE, textLeft, textRight)

  ty -= 11
  const sysBarH = 10
  const sysBarW = textRight - textLeft - 10
  const sysBarX = textLeft + 5
  page.drawRectangle({ x: sysBarX, y: ty - 1, width: sysBarW, height: sysBarH, color: NAVY })
  drawCentered(
    page,
    'HUMAN RESOURCE & PAYROLL MANAGEMENT SYSTEM',
    ty + 1.5,
    fonts.bold,
    5.5,
    WHITE,
    sysBarX,
    sysBarX + sysBarW,
  )

  // Control box
  const boxH = 64
  const boxX = PAGE_W - MARGIN - boxW
  const boxY = top - boxH
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    borderColor: NAVY,
    borderWidth: 0.9,
  })
  page.drawRectangle({ x: boxX, y: boxY + boxH - 11, width: boxW, height: 11, color: NAVY })
  drawCentered(page, 'DTR CONTROL NUMBER', boxY + boxH - 8.5, fonts.bold, 6, WHITE, boxX, boxX + boxW)
  drawBarcode(page, controlNumber, boxX + 7, boxY + 36, boxW - 14, 11)
  const cnW = fonts.bold.widthOfTextAtSize(controlNumber, 7.5)
  page.drawText(controlNumber, {
    x: boxX + (boxW - cnW) / 2,
    y: boxY + 26,
    size: 7.5,
    font: fonts.bold,
    color: BLACK,
  })
  page.drawRectangle({ x: boxX, y: boxY + 12, width: boxW, height: 10, color: NAVY })
  drawCentered(page, 'DATE', boxY + 14.5, fonts.bold, 6, WHITE, boxX, boxX + boxW)
  drawUnderline(page, boxX + 8, boxY + 5, boxW - 16)
  if (dateIssued) {
    const dw = fonts.regular.widthOfTextAtSize(dateIssued, 6.5)
    page.drawText(dateIssued, {
      x: boxX + (boxW - dw) / 2,
      y: boxY + 6,
      size: 6.5,
      font: fonts.regular,
      color: BLACK,
    })
  }
  drawCentered(page, '(YYYY-MM-DD)', boxY + 0.5, fonts.regular, 4.5, GRAY, boxX, boxX + boxW)

  drawCentered(page, 'DAILY TIME RECORD', PAGE_H - 82, fonts.bold, 13, TITLE_BLUE, MARGIN, PAGE_W - MARGIN)
  drawCentered(
    page,
    'Purpose: To record the employee\'s daily time of arrival, breaks, departure, overtime and undertime.',
    PAGE_H - 93,
    fonts.italic,
    6.5,
    TITLE_BLUE,
    MARGIN,
    PAGE_W - MARGIN,
  )
}

function drawEmployeeInfo(page: PDFPage, fonts: Fonts, data: DtrFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 11
  const rowH = 20
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '1. EMPLOYEE INFORMATION', fonts.bold, 7)

  const colW = w / 2
  const rows: [string, string | undefined, string, string | undefined | EmploymentStatus][] = [
    ['Employee Name:', data.employeeName, 'Employee ID:', data.employeeId],
    ['Position:', data.position, 'Office / Department:', data.officeDepartment],
    ['Employment Status:', data.employmentStatus, 'Payroll Group:', data.payrollGroup],
  ]

  for (let r = 0; r < 3; r++) {
    const cy = y - (r + 1) * rowH
    page.drawRectangle({
      x,
      y: cy,
      width: colW,
      height: rowH,
      borderColor: LINE_BLUE,
      borderWidth: 0.6,
    })
    page.drawRectangle({
      x: x + colW,
      y: cy,
      width: colW,
      height: rowH,
      borderColor: LINE_BLUE,
      borderWidth: 0.6,
    })

    page.drawText(rows[r]![0], {
      x: x + 3,
      y: cy + rowH - 8,
      size: 5.5,
      font: fonts.bold,
      color: NAVY,
    })
    if (r === 2) {
      // Employment status checkboxes
      const status = data.employmentStatus
      drawCheckbox(page, x + 4, cy + 3, 'Permanent', status === 'permanent', fonts.regular)
      drawCheckbox(page, x + 62, cy + 3, 'Job Order', status === 'jobOrder', fonts.regular)
      drawCheckbox(page, x + 118, cy + 3, 'Contract of Service', status === 'contractOfService', fonts.regular)
    } else if (rows[r]![1]) {
      page.drawText(String(rows[r]![1]), {
        x: x + 4,
        y: cy + 4,
        size: 7.5,
        font: fonts.regular,
        color: BLACK,
      })
    }

    page.drawText(rows[r]![2], {
      x: x + colW + 3,
      y: cy + rowH - 8,
      size: 5.5,
      font: fonts.bold,
      color: NAVY,
    })
    if (rows[r]![3]) {
      page.drawText(String(rows[r]![3]), {
        x: x + colW + 4,
        y: cy + 4,
        size: 7.5,
        font: fonts.regular,
        color: BLACK,
      })
    }
  }

  return y - rowH * 3
}

function drawPeriodCovered(page: PDFPage, fonts: Fonts, data: DtrFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const h = 14
  const y = topY - h
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: LIGHT_BAR,
    borderColor: LINE_BLUE,
    borderWidth: 0.6,
  })
  page.drawText('PERIOD COVERED', {
    x: x + 5,
    y: y + 4,
    size: 6.5,
    font: fonts.bold,
    color: NAVY,
  })
  let cx = x + 95
  page.drawText('From:', { x: cx, y: y + 4, size: 6.5, font: fonts.regular, color: BLACK })
  cx += 28
  drawUnderline(page, cx, y + 3, 70)
  if (data.periodFrom) {
    page.drawText(data.periodFrom, { x: cx + 2, y: y + 4, size: 6.5, font: fonts.regular, color: BLACK })
  }
  page.drawText('(YYYY-MM-DD)', {
    x: cx + 72,
    y: y + 4,
    size: 5,
    font: fonts.regular,
    color: TITLE_BLUE,
  })
  cx += 130
  page.drawText('To:', { x: cx, y: y + 4, size: 6.5, font: fonts.regular, color: BLACK })
  cx += 16
  drawUnderline(page, cx, y + 3, 70)
  if (data.periodTo) {
    page.drawText(data.periodTo, { x: cx + 2, y: y + 4, size: 6.5, font: fonts.regular, color: BLACK })
  }
  page.drawText('(YYYY-MM-DD)', {
    x: cx + 72,
    y: y + 4,
    size: 5,
    font: fonts.regular,
    color: TITLE_BLUE,
  })
  cx += 125
  page.drawText('No. of Days:', { x: cx, y: y + 4, size: 6.5, font: fonts.regular, color: BLACK })
  cx += 52
  drawUnderline(page, cx, y + 3, 36)
  if (data.numberOfDays) {
    page.drawText(data.numberOfDays, { x: cx + 2, y: y + 4, size: 6.5, font: fonts.regular, color: BLACK })
  }
  return y
}

function drawTimeRecord(page: PDFPage, fonts: Fonts, data: DtrFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 11
  const headerH = 16
  const rowH = 9.2
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '2. TIME RECORD', fonts.bold, 7)

  // Column widths (must sum to w)
  const cols = {
    date: 22,
    day: 26,
    amIn: 42,
    amOut: 42,
    pmIn: 42,
    pmOut: 42,
    otIn: 42,
    otOut: 42,
    undertime: 48,
    total: 52,
    remarks: w - 22 - 26 - 42 * 6 - 48 - 52,
  }

  const headerY = y - headerH
  // Top group headers
  const groups: { label: string; x: number; w: number }[] = [
    { label: 'DATE', x, w: cols.date },
    { label: 'DAY', x: x + cols.date, w: cols.day },
    { label: 'AM', x: x + cols.date + cols.day, w: cols.amIn + cols.amOut },
    {
      label: 'PM',
      x: x + cols.date + cols.day + cols.amIn + cols.amOut,
      w: cols.pmIn + cols.pmOut,
    },
    {
      label: 'OVERTIME',
      x: x + cols.date + cols.day + cols.amIn + cols.amOut + cols.pmIn + cols.pmOut,
      w: cols.otIn + cols.otOut,
    },
    {
      label: 'UNDERTIME',
      x:
        x +
        cols.date +
        cols.day +
        cols.amIn +
        cols.amOut +
        cols.pmIn +
        cols.pmOut +
        cols.otIn +
        cols.otOut,
      w: cols.undertime,
    },
    {
      label: 'TOTAL HRS',
      x:
        x +
        cols.date +
        cols.day +
        cols.amIn +
        cols.amOut +
        cols.pmIn +
        cols.pmOut +
        cols.otIn +
        cols.otOut +
        cols.undertime,
      w: cols.total,
    },
    {
      label: 'REMARKS',
      x:
        x +
        cols.date +
        cols.day +
        cols.amIn +
        cols.amOut +
        cols.pmIn +
        cols.pmOut +
        cols.otIn +
        cols.otOut +
        cols.undertime +
        cols.total,
      w: cols.remarks,
    },
  ]

  for (const g of groups) {
    page.drawRectangle({
      x: g.x,
      y: headerY + headerH / 2,
      width: g.w,
      height: headerH / 2,
      borderColor: LINE_BLUE,
      borderWidth: 0.5,
      color: LIGHT_FILL,
    })
    drawCentered(
      page,
      g.label,
      headerY + headerH / 2 + 1.5,
      fonts.bold,
      5,
      NAVY,
      g.x,
      g.x + g.w,
    )
  }

  // Sub headers for time cols
  const sub: { label: string; x: number; w: number }[] = [
    { label: '', x, w: cols.date },
    { label: '', x: x + cols.date, w: cols.day },
    { label: 'IN', x: x + cols.date + cols.day, w: cols.amIn },
    { label: 'OUT', x: x + cols.date + cols.day + cols.amIn, w: cols.amOut },
    {
      label: 'IN',
      x: x + cols.date + cols.day + cols.amIn + cols.amOut,
      w: cols.pmIn,
    },
    {
      label: 'OUT',
      x: x + cols.date + cols.day + cols.amIn + cols.amOut + cols.pmIn,
      w: cols.pmOut,
    },
    {
      label: 'IN',
      x: x + cols.date + cols.day + cols.amIn + cols.amOut + cols.pmIn + cols.pmOut,
      w: cols.otIn,
    },
    {
      label: 'OUT',
      x: x + cols.date + cols.day + cols.amIn + cols.amOut + cols.pmIn + cols.pmOut + cols.otIn,
      w: cols.otOut,
    },
    {
      label: '(Mins)',
      x:
        x +
        cols.date +
        cols.day +
        cols.amIn +
        cols.amOut +
        cols.pmIn +
        cols.pmOut +
        cols.otIn +
        cols.otOut,
      w: cols.undertime,
    },
    {
      label: 'WORKED',
      x:
        x +
        cols.date +
        cols.day +
        cols.amIn +
        cols.amOut +
        cols.pmIn +
        cols.pmOut +
        cols.otIn +
        cols.otOut +
        cols.undertime,
      w: cols.total,
    },
    {
      label: '',
      x:
        x +
        cols.date +
        cols.day +
        cols.amIn +
        cols.amOut +
        cols.pmIn +
        cols.pmOut +
        cols.otIn +
        cols.otOut +
        cols.undertime +
        cols.total,
      w: cols.remarks,
    },
  ]

  for (const s of sub) {
    page.drawRectangle({
      x: s.x,
      y: headerY,
      width: s.w,
      height: headerH / 2,
      borderColor: LINE_BLUE,
      borderWidth: 0.5,
      color: LIGHT_FILL,
    })
    if (s.label) {
      drawCentered(page, s.label, headerY + 1.5, fonts.bold, 5, NAVY, s.x, s.x + s.w)
    }
  }

  const days = normalizeDays(data)
  let rowY = headerY
  for (const day of days) {
    rowY -= rowH
    const values = [
      String(day.day),
      day.dayName || '',
      day.amIn || '',
      day.amOut || '',
      day.pmIn || '',
      day.pmOut || '',
      day.otIn || '',
      day.otOut || '',
      day.undertimeMinutes || '',
      day.totalHoursWorked || '',
      day.remarks || '',
    ]
    const widths = [
      cols.date,
      cols.day,
      cols.amIn,
      cols.amOut,
      cols.pmIn,
      cols.pmOut,
      cols.otIn,
      cols.otOut,
      cols.undertime,
      cols.total,
      cols.remarks,
    ]
    let cx = x
    for (let i = 0; i < widths.length; i++) {
      const cw = widths[i]!
      page.drawRectangle({
        x: cx,
        y: rowY,
        width: cw,
        height: rowH,
        borderColor: LINE_BLUE,
        borderWidth: 0.4,
      })
      const val = values[i]!
      if (val) {
        drawCentered(page, val, rowY + 2.2, fonts.regular, 5.5, BLACK, cx, cx + cw)
      } else if (i >= 2 && i <= 7) {
        drawCentered(page, '__:__', rowY + 2.2, fonts.regular, 5, GRAY, cx, cx + cw)
      }
      cx += cw
    }
  }

  return rowY
}

function drawSummary(page: PDFPage, fonts: Fonts, data: DtrFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 11
  const bodyH = 18
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '3. SUMMARY', fonts.bold, 7)
  page.drawRectangle({
    x,
    y: y - bodyH,
    width: w,
    height: bodyH,
    borderColor: LINE_BLUE,
    borderWidth: 0.6,
  })

  const items: [string, string | undefined, string][] = [
    ['Total Hours Worked:', data.totalHoursWorked, 'hrs'],
    ['Total Overtime:', data.totalOvertime, 'hrs'],
    ['Total Undertime:', data.totalUndertime, 'mins'],
    ['Total Minutes Late:', data.totalMinutesLate, 'mins'],
  ]
  const colW = w / 4
  for (let i = 0; i < 4; i++) {
    const cx = x + i * colW + 4
    const [label, value, unit] = items[i]!
    page.drawText(label, { x: cx, y: y - 12, size: 6, font: fonts.bold, color: NAVY })
    const lw = fonts.bold.widthOfTextAtSize(label, 6)
    drawUnderline(page, cx + lw + 3, y - 13, 36)
    if (value) {
      page.drawText(value, {
        x: cx + lw + 5,
        y: y - 12,
        size: 6.5,
        font: fonts.regular,
        color: BLACK,
      })
    }
    page.drawText(unit, {
      x: cx + lw + 42,
      y: y - 12,
      size: 5.5,
      font: fonts.regular,
      color: GRAY,
    })
  }
  return y - bodyH
}

function drawEmployeeCertification(
  page: PDFPage,
  fonts: Fonts,
  data: DtrFormData,
  topY: number,
): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 11
  const bodyH = 44
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '4. EMPLOYEE CERTIFICATION', fonts.bold, 7)
  page.drawRectangle({
    x,
    y: y - bodyH,
    width: w,
    height: bodyH,
    borderColor: LINE_BLUE,
    borderWidth: 0.6,
  })
  page.drawText('I hereby certify that the above time record is true and correct.', {
    x: x + 6,
    y: y - 12,
    size: 6.5,
    font: fonts.regular,
    color: BLACK,
  })
  // Lower signature/date lines so the section breathes
  const sigY = y - bodyH + 14
  drawCenteredOnLine(
    page,
    fonts,
    data.employeeSignatureName,
    'Signature over Printed Name',
    x + 40,
    sigY,
    180,
  )
  drawCenteredOnLine(
    page,
    fonts,
    data.employeeSignatureDate,
    'Date (YYYY-MM-DD)',
    x + w - 160,
    sigY,
    110,
  )
  return y - bodyH
}

function drawApprovals(page: PDFPage, fonts: Fonts, data: DtrFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const gap = 3
  const colW = (w - gap) / 2
  const barH = 11
  const bodyH = 64
  const y = topY - barH

  drawApprovalBox(
    page,
    fonts,
    x,
    y,
    colW,
    barH,
    bodyH,
    '5. IMMEDIATE SUPERVISOR CERTIFICATION',
    'I hereby certify that I have reviewed the above time record.',
    data.supervisorSignatureName,
    data.supervisorPosition,
    data.supervisorDate,
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
    'I hereby approve the above time record.',
    data.departmentHeadSignatureName,
    data.departmentHeadPosition,
    data.departmentHeadDate,
  )
  return y - bodyH
}

function drawLabeledLine(
  page: PDFPage,
  fonts: Fonts,
  label: string,
  value: string | undefined,
  x: number,
  y: number,
  width: number,
) {
  const labelSize = 5.5
  const valueSize = 6
  const labelW = fonts.regular.widthOfTextAtSize(label, labelSize)
  const lineX = x + labelW + 3
  const lineW = Math.max(40, width - labelW - 3)
  page.drawText(label, { x, y, size: labelSize, font: fonts.regular, color: BLACK })
  drawUnderline(page, lineX, y - 1, lineW)
  if (value) {
    let size = valueSize
    while (size > 4.5 && fonts.regular.widthOfTextAtSize(value, size) > lineW - 2) size -= 0.25
    page.drawText(value, {
      x: lineX + 2,
      y,
      size,
      font: fonts.regular,
      color: BLACK,
    })
  }
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
  statement: string,
  name?: string,
  position?: string,
  date?: string,
) {
  drawSectionBar(page, x, topY, width, barH, title, fonts.bold, 6)
  page.drawRectangle({
    x,
    y: topY - bodyH,
    width,
    height: bodyH,
    borderColor: LINE_BLUE,
    borderWidth: 0.6,
  })
  page.drawText(statement, {
    x: x + 5,
    y: topY - 11,
    size: 5.5,
    font: fonts.regular,
    color: BLACK,
  })

  const pad = 10
  const sigLineX = x + 28
  const sigLineW = width - 56
  const sigLineY = topY - 26
  drawUnderline(page, sigLineX, sigLineY, sigLineW)
  if (name) {
    const size = 7
    const nw = fonts.regular.widthOfTextAtSize(name, size)
    page.drawText(name, {
      x: sigLineX + (sigLineW - nw) / 2,
      y: sigLineY + 2,
      size,
      font: fonts.regular,
      color: BLACK,
    })
  }

  // Caption just under the signature line
  const sigCaption = 'Signature over Printed Name'
  const sigCaptionW = fonts.regular.widthOfTextAtSize(sigCaption, 5)
  page.drawText(sigCaption, {
    x: x + (width - sigCaptionW) / 2,
    y: sigLineY - 8,
    size: 5,
    font: fonts.regular,
    color: GRAY,
  })

  // Stacked rows — keep clear gap under caption
  const fieldW = width - pad * 2
  const posY = topY - bodyH + 15
  const dateY = topY - bodyH + 5
  drawLabeledLine(page, fonts, 'Position:', position, x + pad, posY, fieldW)
  drawLabeledLine(page, fonts, 'Date (YYYY-MM-DD):', date, x + pad, dateY, fieldW)
}

function drawHrmoVerification(page: PDFPage, fonts: Fonts, data: DtrFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 11
  const bodyH = 44
  const y = topY - barH
  drawSectionBar(page, x, y, w, barH, '7. HRMO VERIFICATION', fonts.bold, 7)
  page.drawRectangle({
    x,
    y: y - bodyH,
    width: w,
    height: bodyH,
    borderColor: LINE_BLUE,
    borderWidth: 0.6,
  })
  page.drawText('This is to certify that the above time record has been checked and verified.', {
    x: x + 6,
    y: y - 12,
    size: 6.5,
    font: fonts.regular,
    color: BLACK,
  })
  // Lower signature/date lines so the section breathes
  const sigY = y - bodyH + 14
  drawCenteredOnLine(
    page,
    fonts,
    data.hrmoSignatureName,
    'Signature over Printed Name',
    x + 40,
    sigY,
    180,
  )
  drawCenteredOnLine(page, fonts, data.hrmoDate, 'Date (YYYY-MM-DD)', x + w - 160, sigY, 110)
  return y - bodyH
}

function drawReminders(page: PDFPage, fonts: Fonts, topY: number) {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 11
  const boxY = 14
  const boxH = Math.max(48, topY - barH - boxY)
  const barY = boxY + boxH - barH

  // Bell badge
  page.drawCircle({ x: x + 8, y: barY + 5, size: 5.5, color: NAVY })
  page.drawText('!', {
    x: x + 6.6,
    y: barY + 2.5,
    size: 7,
    font: fonts.bold,
    color: WHITE,
  })
  drawSectionBar(page, x + 16, barY, w - 16, barH, 'REMINDERS', fonts.bold, 7)
  page.drawRectangle({
    x,
    y: boxY,
    width: w,
    height: boxH - barH,
    borderColor: LINE_BLUE,
    borderWidth: 0.6,
  })

  const reminders = [
    '1. Employees must record their time in/out accurately.',
    '2. Three (3) Time In and Time Out entries are provided for AM, PM, and Overtime.',
    '3. Undertime shall be deducted from the total hours worked.',
    '4. DTR entries shall be validated and approved daily by the immediate supervisor.',
    '5. Any erasures or alterations must be initialed by the employee and the approving authority.',
    '6. Keep this record as part of the official file.',
  ]
  let ry = barY - 9
  for (const note of reminders) {
    for (const line of wrapText(note, fonts.regular, 5.5, w - 12)) {
      page.drawText(line, { x: x + 5, y: ry, size: 5.5, font: fonts.regular, color: BLACK })
      ry -= 6.8
    }
  }
}
