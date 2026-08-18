import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from 'pdf-lib'
import type { AcrFormData } from './types'

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 16

const NAVY = rgb(0.05, 0.18, 0.38)
const TITLE_BLUE = rgb(0.08, 0.25, 0.5)
const LINE_BLUE = rgb(0.15, 0.35, 0.65)
const LIGHT_FILL = rgb(0.93, 0.95, 0.98)
const YELLOW_FILL = rgb(1, 0.96, 0.78)
const YELLOW_BORDER = rgb(0.85, 0.7, 0.15)
const BLACK = rgb(0.05, 0.05, 0.05)
const WHITE = rgb(1, 1, 1)
const GRAY = rgb(0.32, 0.32, 0.32)
const RED = rgb(0.75, 0.08, 0.08)

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
  page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.55, color })
}

function drawSectionBar(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  font: PDFFont,
  size = 6.5,
) {
  page.drawRectangle({ x, y, width, height, color: NAVY })
  page.drawText(title, {
    x: x + 4,
    y: y + (height - size) / 2 + 0.3,
    size,
    font,
    color: WHITE,
  })
}

function drawCheckbox(
  page: PDFPage,
  x: number,
  y: number,
  label: string,
  checked: boolean | undefined,
  font: PDFFont,
  size = 5.2,
  maxLabelW?: number,
) {
  const box = 5.5
  page.drawRectangle({
    x,
    y: y - 0.4,
    width: box,
    height: box,
    borderColor: NAVY,
    borderWidth: 0.55,
  })
  if (checked) {
    page.drawText('X', { x: x + 1, y, size: 5, font, color: BLACK })
  }
  let text = label
  if (maxLabelW) {
    while (text.length > 3 && font.widthOfTextAtSize(text, size) > maxLabelW) {
      text = text.slice(0, -1)
    }
    if (text !== label && text.length > 3) text = `${text.slice(0, -1)}...`
  }
  page.drawText(text, { x: x + box + 2, y, size, font, color: BLACK })
}

function labeledValue(
  page: PDFPage,
  fonts: Fonts,
  label: string,
  value: string | undefined,
  x: number,
  y: number,
  lineW: number,
  labelSize = 5.5,
  valueSize = 6,
) {
  page.drawText(label, { x, y, size: labelSize, font: fonts.regular, color: BLACK })
  const lw = fonts.regular.widthOfTextAtSize(label, labelSize)
  drawUnderline(page, x + lw + 2, y - 1, lineW)
  if (value) {
    page.drawText(value, {
      x: x + lw + 3,
      y: y + 1,
      size: valueSize,
      font: fonts.regular,
      color: BLACK,
    })
  }
}

function drawPanel(
  page: PDFPage,
  x: number,
  topY: number,
  width: number,
  bodyH: number,
  title: string,
  fonts: Fonts,
  barH = 10,
) {
  const barY = topY - barH
  drawSectionBar(page, x, barY, width, barH, title, fonts.bold, 6)
  page.drawRectangle({
    x,
    y: barY - bodyH,
    width,
    height: bodyH,
    borderColor: LINE_BLUE,
    borderWidth: 0.55,
  })
  return { barY, bodyBottom: barY - bodyH, contentTop: barY - 2 }
}

function drawSigCaption(
  page: PDFPage,
  fonts: Fonts,
  name: string | undefined,
  caption: string,
  x: number,
  lineY: number,
  lineW: number,
) {
  drawUnderline(page, x, lineY, lineW)
  if (name) {
    const size = 6
    const nw = fonts.regular.widthOfTextAtSize(name, size)
    page.drawText(name, {
      x: x + (lineW - nw) / 2,
      y: lineY + 1.5,
      size,
      font: fonts.regular,
      color: BLACK,
    })
  }
  // Caption slightly higher than usual (closer to line)
  const cw = fonts.regular.widthOfTextAtSize(caption, 4.5)
  page.drawText(caption, {
    x: x + (lineW - cw) / 2,
    y: lineY - 6.5,
    size: 4.5,
    font: fonts.regular,
    color: GRAY,
  })
}

export async function generateAcrPdf(
  data: AcrFormData,
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
  const controlNo = data.correctionRequestNo?.trim() || 'ACR-2026-00001'

  page.drawRectangle({
    x: MARGIN - 3,
    y: MARGIN - 3,
    width: PAGE_W - (MARGIN - 3) * 2,
    height: PAGE_H - (MARGIN - 3) * 2,
    borderColor: NAVY,
    borderWidth: 1,
  })

  drawHeader(page, fonts, logo, controlNo, data)
  let y = PAGE_H - 98
  y = drawEmployeeInfo(page, fonts, data, y)
  y = drawReasonsAndEntry(page, fonts, data, y - 2)
  y = drawExplanationAndSupport(page, fonts, data, y - 2)
  y = drawSupervisorAndHrmo(page, fonts, data, y - 2)
  y = drawApprovalAndSystem(page, fonts, data, y - 2)
  y = drawFinalStatus(page, fonts, data, y - 2)
  drawFooter(page, fonts, y - 2)

  pdf.setTitle(`ACR ${controlNo}`)
  pdf.setAuthor('Municipality of Magsaysay HR & Payroll')
  return pdf.save()
}

function drawHeader(
  page: PDFPage,
  fonts: Fonts,
  logo: PDFImage,
  controlNo: string,
  data: AcrFormData,
) {
  const top = PAGE_H - MARGIN - 2
  const logoSize = 42
  page.drawImage(logo, { x: MARGIN, y: top - logoSize, width: logoSize, height: logoSize })

  const cx0 = MARGIN + 48
  const cx1 = PAGE_W - MARGIN - 132
  drawCentered(page, 'REPUBLIC OF THE PHILIPPINES', top - 8, fonts.regular, 6, BLACK, cx0, cx1)
  drawCentered(page, 'PROVINCE OF OCCIDENTAL MINDORO', top - 16, fonts.regular, 6, BLACK, cx0, cx1)
  drawCentered(page, 'MUNICIPALITY OF MAGSAYSAY', top - 26, fonts.bold, 9, TITLE_BLUE, cx0, cx1)
  drawCentered(
    page,
    'HUMAN RESOURCE & PAYROLL MANAGEMENT SYSTEM',
    top - 36,
    fonts.bold,
    6.5,
    TITLE_BLUE,
    cx0,
    cx1,
  )
  drawCentered(page, 'ATTENDANCE CORRECTION REQUEST', top - 50, fonts.bold, 11, TITLE_BLUE, cx0, cx1)
  const purpose =
    'Purpose: To request correction of a missing, incorrect, or incomplete attendance entry, including forgotten time-in/time-out.'
  drawCentered(page, purpose, top - 60, fonts.italic, 5, GRAY, cx0, cx1)

  // Control box (top right)
  const boxW = 122
  const boxX = PAGE_W - MARGIN - boxW
  const boxH = 72
  const boxY = top - boxH
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    borderColor: NAVY,
    borderWidth: 0.9,
  })
  page.drawRectangle({ x: boxX, y: boxY + boxH - 12, width: boxW, height: 12, color: NAVY })
  drawCentered(
    page,
    'CONTROL INFORMATION',
    boxY + boxH - 9,
    fonts.bold,
    5.5,
    WHITE,
    boxX,
    boxX + boxW,
  )

  const fields: [string, string | undefined][] = [
    ['Correction Request No.:', controlNo],
    ['Date Filed:', data.dateFiled],
    ['DTR Control No.:', data.dtrControlNo],
    ['Attendance Date:', data.attendanceDate],
  ]
  let fy = boxY + boxH - 22
  for (const [label, value] of fields) {
    page.drawText(label, { x: boxX + 4, y: fy, size: 4.8, font: fonts.regular, color: BLACK })
    drawUnderline(page, boxX + 4, fy - 7, boxW - 8)
    if (value) {
      page.drawText(value, { x: boxX + 5, y: fy - 6, size: 5.5, font: fonts.bold, color: BLACK })
    }
    fy -= 14
  }
}

function drawEmployeeInfo(page: PDFPage, fonts: Fonts, data: AcrFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 10
  const bodyH = 36
  const { barY } = drawPanel(page, x, topY, w, bodyH, '1. EMPLOYEE INFORMATION', fonts, barH)
  const colW = w / 2
  let rowY = barY - 12
  const left: [string, string | undefined][] = [
    ['Employee Name:', data.employeeName],
    ['Position:', data.position],
    ['Employment Status:', data.employmentStatus],
  ]
  const right: [string, string | undefined][] = [
    ['Employee ID:', data.employeeId],
    ['Office / Department:', data.officeDepartment],
    ['Payroll Group:', data.payrollGroup],
  ]
  for (let i = 0; i < 3; i++) {
    labeledValue(page, fonts, left[i]![0], left[i]![1], x + 5, rowY, colW - 95)
    labeledValue(page, fonts, right[i]![0], right[i]![1], x + colW + 5, rowY, colW - 110)
    rowY -= 11
  }
  return barY - bodyH
}

function drawReasonsAndEntry(page: PDFPage, fonts: Fonts, data: AcrFormData, topY: number): number {
  const gap = 3
  const totalW = PAGE_W - MARGIN * 2
  const leftW = totalW * 0.48
  const rightW = totalW - leftW - gap
  const xL = MARGIN
  const xR = MARGIN + leftW + gap
  const bodyH = 118
  const barH = 10

  drawPanel(page, xL, topY, leftW, bodyH, '3. REASON FOR CORRECTION (CHECK APPLICABLE)', fonts, barH)
  drawPanel(page, xR, topY, rightW, bodyH, '4. ATTENDANCE ENTRY TO BE CORRECTED', fonts, barH)

  // Reasons — 2 columns inside left panel
  const reasonsLeft: [string, boolean | undefined][] = [
    ['Forgot to Time In', data.reasonForgotTimeIn],
    ['Forgot to Time Out', data.reasonForgotTimeOut],
    ['Forgot AM Time In', data.reasonForgotAmIn],
    ['Forgot AM Time Out', data.reasonForgotAmOut],
    ['Forgot PM Time In', data.reasonForgotPmIn],
    ['Forgot PM Time Out', data.reasonForgotPmOut],
    ['Forgot Overtime Time In', data.reasonForgotOtIn],
    ['Forgot Overtime Time Out', data.reasonForgotOtOut],
  ]
  const reasonsRight: [string, boolean | undefined][] = [
    ['Biometric / Attendance Device Error', data.reasonBiometricError],
    ['System / Network Error', data.reasonSystemError],
    ['Official Field Work', data.reasonOfficialFieldWork],
    ['Official Business / Travel', data.reasonOfficialBusiness],
  ]
  let ry = topY - barH - 10
  const mid = xL + leftW / 2
  for (let i = 0; i < reasonsLeft.length; i++) {
    drawCheckbox(page, xL + 5, ry, reasonsLeft[i]![0], reasonsLeft[i]![1], fonts.regular, 5, mid - xL - 16)
    ry -= 9.5
  }
  ry = topY - barH - 10
  for (const [label, checked] of reasonsRight) {
    drawCheckbox(page, mid + 2, ry, label, checked, fonts.regular, 5, xL + leftW - mid - 10)
    ry -= 9.5
  }
  drawCheckbox(page, mid + 2, ry, 'Other:', data.reasonOther, fonts.regular, 5)
  const otherX = mid + 42
  drawUnderline(page, otherX, ry - 1, xL + leftW - otherX - 6)
  if (data.reasonOtherText) {
    page.drawText(data.reasonOtherText, {
      x: otherX + 1,
      y: ry,
      size: 5,
      font: fonts.regular,
      color: BLACK,
    })
  }

  // Entry table on right
  const tableX = xR + 4
  const tableW = rightW - 8
  const col1 = tableW * 0.34
  const col2 = tableW * 0.33
  const col3 = tableW - col1 - col2
  let ty = topY - barH - 3
  const headerH = 12
  page.drawRectangle({ x: tableX, y: ty - headerH, width: tableW, height: headerH, color: LIGHT_FILL })
  page.drawRectangle({
    x: tableX,
    y: ty - headerH,
    width: tableW,
    height: headerH,
    borderColor: LINE_BLUE,
    borderWidth: 0.45,
  })
  page.drawText('Attendance Entry', { x: tableX + 3, y: ty - 9, size: 5, font: fonts.bold, color: BLACK })
  page.drawText('Original System Record', {
    x: tableX + col1 + 2,
    y: ty - 9,
    size: 4.8,
    font: fonts.bold,
    color: BLACK,
  })
  page.drawText('Requested Entry', {
    x: tableX + col1 + col2 + 2,
    y: ty - 9,
    size: 5,
    font: fonts.bold,
    color: BLACK,
  })
  page.drawLine({
    start: { x: tableX + col1, y: ty },
    end: { x: tableX + col1, y: ty - headerH },
    thickness: 0.4,
    color: LINE_BLUE,
  })
  page.drawLine({
    start: { x: tableX + col1 + col2, y: ty },
    end: { x: tableX + col1 + col2, y: ty - headerH },
    thickness: 0.4,
    color: LINE_BLUE,
  })

  const rows: [string, string | undefined, string | undefined][] = [
    ['Date', data.originalDate, data.requestedDate],
    ['AM Time In', data.originalAmIn, data.requestedAmIn],
    ['AM Time Out', data.originalAmOut, data.requestedAmOut],
    ['PM Time In', data.originalPmIn, data.requestedPmIn],
    ['PM Time Out', data.originalPmOut, data.requestedPmOut],
    ['OT Time In', data.originalOtIn, data.requestedOtIn],
    ['OT Time Out', data.originalOtOut, data.requestedOtOut],
  ]
  const rowH = 9.5
  ty -= headerH
  for (const [label, orig, req] of rows) {
    page.drawRectangle({
      x: tableX,
      y: ty - rowH,
      width: tableW,
      height: rowH,
      borderColor: LINE_BLUE,
      borderWidth: 0.4,
    })
    page.drawLine({
      start: { x: tableX + col1, y: ty },
      end: { x: tableX + col1, y: ty - rowH },
      thickness: 0.35,
      color: LINE_BLUE,
    })
    page.drawLine({
      start: { x: tableX + col1 + col2, y: ty },
      end: { x: tableX + col1 + col2, y: ty - rowH },
      thickness: 0.35,
      color: LINE_BLUE,
    })
    page.drawText(label, { x: tableX + 3, y: ty - 7, size: 5, font: fonts.regular, color: BLACK })
    if (orig) {
      page.drawText(orig, { x: tableX + col1 + 2, y: ty - 7, size: 5, font: fonts.regular, color: BLACK })
    }
    if (req) {
      page.drawText(req, {
        x: tableX + col1 + col2 + 2,
        y: ty - 7,
        size: 5,
        font: fonts.regular,
        color: BLACK,
      })
    }
    ty -= rowH
  }

  let sy = ty - 10
  labeledValue(page, fonts, 'Requested Total Hours Worked:', data.requestedTotalHours, tableX, sy, 50, 5, 5.5)
  page.drawText('hrs', { x: tableX + 155, y: sy, size: 5, font: fonts.regular, color: GRAY })
  sy -= 10
  labeledValue(page, fonts, 'Requested Overtime:', data.requestedOvertime, tableX, sy, 50, 5, 5.5)
  page.drawText('hrs', { x: tableX + 120, y: sy, size: 5, font: fonts.regular, color: GRAY })
  sy -= 10
  labeledValue(page, fonts, 'Requested Undertime:', data.requestedUndertime, tableX, sy, 50, 5, 5.5)
  page.drawText('mins', { x: tableX + 125, y: sy, size: 5, font: fonts.regular, color: GRAY })

  return topY - barH - bodyH
}

function drawExplanationAndSupport(
  page: PDFPage,
  fonts: Fonts,
  data: AcrFormData,
  topY: number,
): number {
  const gap = 3
  const totalW = PAGE_W - MARGIN * 2
  const leftW = totalW * 0.48
  const rightW = totalW - leftW - gap
  const xL = MARGIN
  const xR = MARGIN + leftW + gap
  const bodyH = 86
  const barH = 10

  drawPanel(page, xL, topY, leftW, bodyH, '5. EMPLOYEE EXPLANATION', fonts, barH)
  drawPanel(page, xR, topY, rightW, bodyH, '6. SUPPORTING DOCUMENT / PROOF OF ATTENDANCE', fonts, barH)

  let y = topY - barH - 10
  labeledValue(
    page,
    fonts,
    'Actual Time of Arrival / Departure, if applicable:',
    data.actualArrivalDeparture,
    xL + 4,
    y,
    leftW - 170,
    5,
    5.5,
  )
  y -= 11
  page.drawText('Explanation for the Missing or Incorrect Attendance Entry:', {
    x: xL + 4,
    y,
    size: 5,
    font: fonts.regular,
    color: BLACK,
  })
  y -= 2
  const explLines = wrapText(data.explanation || '', fonts.regular, 5.5, leftW - 12)
  for (let i = 0; i < 3; i++) {
    y -= 9
    drawUnderline(page, xL + 4, y, leftW - 10)
    if (explLines[i]) {
      page.drawText(explLines[i]!, { x: xL + 5, y: y + 1, size: 5.5, font: fonts.regular, color: BLACK })
    }
  }
  y -= 10
  const cert =
    'I hereby certify that the information provided is true and correct.'
  page.drawText(cert, { x: xL + 4, y, size: 4.8, font: fonts.italic, color: BLACK })
  y -= 14
  drawSigCaption(
    page,
    fonts,
    data.employeeSignatureName,
    'Employee Signature over Printed Name',
    xL + 10,
    y,
    leftW * 0.55,
  )
  labeledValue(
    page,
    fonts,
    'Date:',
    data.employeeSignatureDate,
    xL + leftW * 0.62,
    y,
    leftW * 0.32,
    5,
    5.5,
  )

  // Supporting docs
  const supports: [string, boolean | undefined][] = [
    ['Locator Slip', data.supportLocatorSlip],
    ['Certificate of Appearance', data.supportCertificateAppearance],
    ['Official Business / Travel Order', data.supportOfficialBusiness],
    ['Supervisor Certification', data.supportSupervisorCert],
    ['Biometric / Attendance System Log', data.supportBiometricLog],
    ['System Error Record', data.supportSystemErrorRecord],
  ]
  let sy = topY - barH - 10
  const mid = xR + rightW / 2
  for (let i = 0; i < supports.length; i++) {
    const x = i % 2 === 0 ? xR + 4 : mid
    if (i % 2 === 0 && i > 0) sy -= 9
    drawCheckbox(page, x, sy, supports[i]![0], supports[i]![1], fonts.regular, 4.8, rightW / 2 - 12)
  }
  sy -= 10
  drawCheckbox(page, xR + 4, sy, 'Other Supporting Document:', data.supportOther, fonts.regular, 4.8)
  drawUnderline(page, xR + 112, sy - 1, rightW - 120)
  if (data.supportOtherText) {
    page.drawText(data.supportOtherText, {
      x: xR + 113,
      y: sy,
      size: 5,
      font: fonts.regular,
      color: BLACK,
    })
  }
  sy -= 9
  drawCheckbox(page, xR + 4, sy, 'No Supporting Document Available', data.supportNone, fonts.regular, 4.8)
  sy -= 11
  labeledValue(page, fonts, 'Document / Reference No.:', data.documentReferenceNo, xR + 4, sy, rightW - 110, 5, 5.5)
  sy -= 10
  page.drawText('Remarks:', { x: xR + 4, y: sy, size: 5, font: fonts.regular, color: BLACK })
  const remLines = wrapText(data.supportRemarks || '', fonts.regular, 5, rightW - 12)
  for (let i = 0; i < 2; i++) {
    sy -= 9
    drawUnderline(page, xR + 4, sy, rightW - 10)
    if (remLines[i]) {
      page.drawText(remLines[i]!, { x: xR + 5, y: sy + 1, size: 5, font: fonts.regular, color: BLACK })
    }
  }

  return topY - barH - bodyH
}

function drawSupervisorAndHrmo(
  page: PDFPage,
  fonts: Fonts,
  data: AcrFormData,
  topY: number,
): number {
  const gap = 3
  const totalW = PAGE_W - MARGIN * 2
  const leftW = totalW * 0.48
  const rightW = totalW - leftW - gap
  const xL = MARGIN
  const xR = MARGIN + leftW + gap
  const bodyH = 118
  const barH = 10

  drawPanel(page, xL, topY, leftW, bodyH, '7. IMMEDIATE SUPERVISOR VERIFICATION', fonts, barH)
  drawPanel(page, xR, topY, rightW, bodyH, '8. HRMO REVIEW', fonts, barH)

  let y = topY - barH - 10
  page.drawText('Verification Result:', { x: xL + 4, y, size: 5, font: fonts.bold, color: BLACK })
  y -= 9
  drawCheckbox(page, xL + 4, y, 'VERIFIED - CORRECTION RECOMMENDED', data.supervisorVerified, fonts.regular, 4.8)
  y -= 9
  drawCheckbox(page, xL + 4, y, 'NOT VERIFIED', data.supervisorNotVerified, fonts.regular, 4.8)
  drawCheckbox(
    page,
    xL + 90,
    y,
    'FOR FURTHER VERIFICATION',
    data.supervisorFurtherVerification,
    fonts.regular,
    4.8,
  )
  y -= 11
  page.drawText('Actual Attendance Verified:', { x: xL + 4, y, size: 5, font: fonts.bold, color: BLACK })
  y -= 10
  const timeIn = [data.supervisorTimeIn, data.supervisorTimeInAmPm].filter(Boolean).join('')
  const timeOut = [data.supervisorTimeOut, data.supervisorTimeOutAmPm].filter(Boolean).join('')
  labeledValue(page, fonts, 'Time In:', timeIn || undefined, xL + 4, y, 52, 5, 5.5)
  if (!timeIn) {
    page.drawText('AM/PM', { x: xL + 78, y, size: 4.5, font: fonts.regular, color: GRAY })
  }
  labeledValue(page, fonts, 'Time Out:', timeOut || undefined, xL + 112, y, 52, 5, 5.5)
  if (!timeOut) {
    page.drawText('AM/PM', { x: xL + 192, y, size: 4.5, font: fonts.regular, color: GRAY })
  }
  y -= 10
  page.drawText('Supervisor Remarks:', { x: xL + 4, y, size: 5, font: fonts.bold, color: BLACK })
  const sRem = wrapText(data.supervisorRemarks || '', fonts.regular, 5, leftW - 12)
  for (let i = 0; i < 3; i++) {
    y -= 9
    drawUnderline(page, xL + 4, y, leftW - 10)
    if (sRem[i]) {
      page.drawText(sRem[i]!, { x: xL + 5, y: y + 1, size: 5, font: fonts.regular, color: BLACK })
    }
  }

  const bodyBottom = topY - barH - bodyH
  const sigLineY = bodyBottom + 14
  const sigX = xL + 6
  const sigW = leftW * 0.42
  drawSigCaption(page, fonts, data.supervisorSignatureName, 'Signature over Printed Name', sigX, sigLineY, sigW)
  labeledValue(page, fonts, 'Position:', data.supervisorPosition, xL + leftW * 0.48, sigLineY, 58, 4.8, 5)
  labeledValue(page, fonts, 'Date:', data.supervisorDate, xL + leftW * 0.78, sigLineY, 42, 4.8, 5)
  let hy = topY - barH - 10
  page.drawText('HRMO Findings:', { x: xR + 4, y: hy, size: 5, font: fonts.bold, color: BLACK })
  const findingsLeft: [string, boolean | undefined][] = [
    ['Attendance correction is supported', data.hrmoCorrectionSupported],
    ['Supervisor verification is sufficient', data.hrmoSupervisorSufficient],
    ['Supporting document is sufficient', data.hrmoDocumentSufficient],
    ['Additional documentation required', data.hrmoAdditionalDocsRequired],
  ]
  const findingsRight: [string, boolean | undefined][] = [
    ['Correction is not supported', data.hrmoNotSupported],
    ['Repeated missed time-in/time-out identified', data.hrmoRepeatedMissed],
  ]
  const col2X = xR + rightW * 0.52
  const col1Max = col2X - xR - 10
  const col2Max = xR + rightW - col2X - 8
  for (let i = 0; i < findingsLeft.length; i++) {
    hy -= 8.5
    drawCheckbox(page, xR + 4, hy, findingsLeft[i]![0], findingsLeft[i]![1], fonts.regular, 4.5, col1Max)
    const rightItem = findingsRight[i]
    if (rightItem) {
      drawCheckbox(page, col2X, hy, rightItem[0], rightItem[1], fonts.regular, 4.5, col2Max)
    } else if (i === 2) {
      drawCheckbox(page, col2X, hy, 'Other:', data.hrmoOther, fonts.regular, 4.5)
      const otherLineX = col2X + 32
      drawUnderline(page, otherLineX, hy - 1, xR + rightW - otherLineX - 6)
      if (data.hrmoOtherText) {
        page.drawText(data.hrmoOtherText, {
          x: otherLineX + 1,
          y: hy,
          size: 5,
          font: fonts.regular,
          color: BLACK,
        })
      }
    }
  }
  hy -= 11
  labeledValue(
    page,
    fonts,
    'Number of Similar Corrections During Current Period:',
    data.similarCorrectionsCount,
    xR + 4,
    hy,
    36,
    4.6,
    5,
  )
  hy -= 10
  page.drawText('HRMO Remarks:', { x: xR + 4, y: hy, size: 5, font: fonts.bold, color: BLACK })
  const hRem = wrapText(data.hrmoRemarks || '', fonts.regular, 5, rightW - 12)
  for (let i = 0; i < 2; i++) {
    hy -= 8.5
    drawUnderline(page, xR + 4, hy, rightW - 10)
    if (hRem[i]) {
      page.drawText(hRem[i]!, { x: xR + 5, y: hy + 1, size: 5, font: fonts.regular, color: BLACK })
    }
  }

  const lineW = rightW - 78
  hy -= 11
  labeledValue(page, fonts, 'Reviewed By:', data.hrmoReviewedBy, xR + 4, hy, lineW, 5, 5.5)
  hy -= 11
  labeledValue(page, fonts, 'Position:', data.hrmoPosition, xR + 4, hy, lineW + 16, 5, 5.5)
  hy -= 11
  labeledValue(page, fonts, 'Signature:', data.hrmoSignatureName, xR + 4, hy, 90, 5, 5.5)
  labeledValue(page, fonts, 'Date:', data.hrmoDate, xR + rightW * 0.55, hy, 70, 5, 5.5)

  return bodyBottom
}

function drawApprovalAndSystem(
  page: PDFPage,
  fonts: Fonts,
  data: AcrFormData,
  topY: number,
): number {
  const gap = 3
  const totalW = PAGE_W - MARGIN * 2
  const leftW = totalW * 0.48
  const rightW = totalW - leftW - gap
  const xL = MARGIN
  const xR = MARGIN + leftW + gap
  const bodyH = 90
  const barH = 10

  drawPanel(page, xL, topY, leftW, bodyH, '9. AUTHORIZED APPROVAL', fonts, barH)
  drawPanel(page, xR, topY, rightW, bodyH, '10. SYSTEM UPDATE (HRMO / ADMIN USE ONLY)', fonts, barH)

  let y = topY - barH - 10
  page.drawText('Decision:', { x: xL + 4, y, size: 5, font: fonts.bold, color: BLACK })
  y -= 9
  drawCheckbox(page, xL + 4, y, 'APPROVED', data.approvalApproved, fonts.bold, 5)
  drawCheckbox(page, xL + 70, y, 'DISAPPROVED', data.approvalDisapproved, fonts.bold, 5)
  drawCheckbox(page, xL + 145, y, 'RETURNED FOR CLARIFICATION', data.approvalReturned, fonts.regular, 4.6)
  y -= 11
  page.drawText('Approved Attendance Entry:', { x: xL + 4, y, size: 5, font: fonts.bold, color: BLACK })
  y -= 10
  const times: [string, string | undefined][] = [
    ['AM In:', data.approvedAmIn],
    ['AM Out:', data.approvedAmOut],
    ['PM In:', data.approvedPmIn],
    ['PM Out:', data.approvedPmOut],
    ['OT In:', data.approvedOtIn],
    ['OT Out:', data.approvedOtOut],
  ]
  for (let i = 0; i < 3; i++) {
    const a = times[i * 2]!
    const b = times[i * 2 + 1]!
    labeledValue(page, fonts, a[0], a[1], xL + 4, y, 55, 5, 5.5)
    labeledValue(page, fonts, b[0], b[1], xL + leftW / 2, y, 55, 5, 5.5)
    y -= 9
  }
  y -= 1
  page.drawText('Remarks:', { x: xL + 4, y, size: 5, font: fonts.regular, color: BLACK })
  const aRem = wrapText(data.approvalRemarks || '', fonts.regular, 5, leftW - 12)
  y -= 9
  drawUnderline(page, xL + 4, y, leftW - 10)
  if (aRem[0]) {
    page.drawText(aRem[0]!, { x: xL + 5, y: y + 1, size: 5, font: fonts.regular, color: BLACK })
  }
  y -= 12
  labeledValue(page, fonts, 'Authorized Approving Officer:', data.approverName, xL + 4, y, 70, 4.6, 5)
  y -= 9
  labeledValue(page, fonts, 'Position:', data.approverPosition, xL + 4, y, 50, 4.6, 5)
  labeledValue(page, fonts, 'Signature:', data.approverSignatureName, xL + leftW * 0.42, y, 45, 4.6, 5)
  labeledValue(page, fonts, 'Date:', data.approverDate, xL + leftW * 0.78, y, 35, 4.6, 5)

  // System update
  let sy = topY - barH - 10
  const updates: [string, boolean | undefined][] = [
    ['Approved correction encoded', data.updateEncoded],
    ['Original system record preserved', data.updateOriginalPreserved],
    ['Correction request attached to employee attendance record', data.updateRequestAttached],
    ['Supporting documents attached', data.updateDocsAttached],
    ['Audit trail generated', data.updateAuditTrail],
    ['Employee notified', data.updateEmployeeNotified],
  ]
  for (const [label, checked] of updates) {
    drawCheckbox(page, xR + 4, sy, label, checked, fonts.regular, 4.6, rightW - 14)
    sy -= 8.5
  }
  sy -= 2
  labeledValue(page, fonts, 'Original System Entry:', data.originalSystemEntry, xR + 4, sy, rightW - 100, 4.6, 5)
  sy -= 9
  labeledValue(page, fonts, 'Corrected System Entry:', data.correctedSystemEntry, xR + 4, sy, rightW - 105, 4.6, 5)
  sy -= 9
  labeledValue(page, fonts, 'Updated By:', data.updatedBy, xR + 4, sy, 55, 4.6, 5)
  labeledValue(page, fonts, 'Date / Time Updated:', data.dateTimeUpdated, xR + rightW * 0.45, sy, 55, 4.6, 5)
  sy -= 9
  labeledValue(
    page,
    fonts,
    'System Transaction / Audit Reference No.:',
    data.auditReferenceNo,
    xR + 4,
    sy,
    rightW - 145,
    4.6,
    5,
  )

  return topY - barH - bodyH
}

function drawFinalStatus(page: PDFPage, fonts: Fonts, data: AcrFormData, topY: number): number {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const barH = 10
  const bodyH = 28
  const { barY } = drawPanel(page, x, topY, w, bodyH, '11. FINAL STATUS', fonts, barH)
  let y = barY - 12
  drawCheckbox(page, x + 6, y, 'CORRECTED', data.statusCorrected, fonts.bold, 5.5)
  drawCheckbox(page, x + 90, y, 'NOT CORRECTED', data.statusNotCorrected, fonts.bold, 5.5)
  drawCheckbox(page, x + 195, y, 'DISAPPROVED', data.statusDisapproved, fonts.bold, 5.5)
  drawCheckbox(page, x + 290, y, 'PENDING', data.statusPending, fonts.bold, 5.5)
  y -= 12
  labeledValue(page, fonts, 'HRMO Final Verification:', data.hrmoFinalVerification, x + 6, y, 160, 5, 5.5)
  labeledValue(page, fonts, 'Date:', data.finalStatusDate, x + w * 0.55, y, 100, 5, 5.5)
  return barY - bodyH
}

function drawFooter(page: PDFPage, fonts: Fonts, topY: number) {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const gap = 4
  const leftW = w * 0.58
  const rightW = w - leftW - gap
  const boxH = Math.max(52, topY - 18)
  const boxY = 14

  // Important system rule
  page.drawRectangle({
    x,
    y: boxY,
    width: leftW,
    height: boxH,
    color: rgb(0.9, 0.94, 0.98),
    borderColor: NAVY,
    borderWidth: 0.7,
  })
  page.drawCircle({ x: x + 10, y: boxY + boxH - 10, size: 5.5, color: NAVY })
  page.drawText('!', { x: x + 8.5, y: boxY + boxH - 12.5, size: 7, font: fonts.bold, color: WHITE })
  page.drawText('IMPORTANT SYSTEM RULE', {
    x: x + 20,
    y: boxY + boxH - 12,
    size: 6,
    font: fonts.bold,
    color: NAVY,
  })
  const rule =
    'Attendance records shall not be altered directly. All corrections must follow: Correction Request -> Employee Explanation -> Supporting Document/Proof -> Supervisor Verification -> HRMO Review -> Authorized Approval -> System Update.'
  const ruleLines = wrapText(rule, fonts.regular, 4.8, leftW - 14)
  let ry = boxY + boxH - 22
  for (const line of ruleLines.slice(0, 4)) {
    page.drawText(line, { x: x + 6, y: ry, size: 4.8, font: fonts.regular, color: BLACK })
    ry -= 7
  }
  const preserve =
    'The original attendance record shall remain preserved in the system audit trail and shall never be deleted or overwritten.'
  for (const line of wrapText(preserve, fonts.bold, 4.6, leftW - 14).slice(0, 2)) {
    page.drawText(line, { x: x + 6, y: ry, size: 4.6, font: fonts.bold, color: RED })
    ry -= 7
  }

  // Repeated missed warning
  const rx = x + leftW + gap
  page.drawRectangle({
    x: rx,
    y: boxY,
    width: rightW,
    height: boxH,
    color: YELLOW_FILL,
    borderColor: YELLOW_BORDER,
    borderWidth: 0.7,
  })
  page.drawText('REPEATED MISSED TIME-IN/TIME-OUT', {
    x: rx + 5,
    y: boxY + boxH - 12,
    size: 5.5,
    font: fonts.bold,
    color: RED,
  })
  const warn =
    'Repeated failure to time in/out may be subject to administrative action in accordance with applicable office rules and civil service regulations.'
  let wy = boxY + boxH - 22
  for (const line of wrapText(warn, fonts.regular, 4.8, rightW - 12).slice(0, 5)) {
    page.drawText(line, { x: rx + 5, y: wy, size: 4.8, font: fonts.regular, color: BLACK })
    wy -= 7
  }

  page.drawText('This is a system-generated HRPMS form.', {
    x: MARGIN,
    y: 6,
    size: 4.5,
    font: fonts.italic,
    color: GRAY,
  })
  const formNo = 'HRPMS Form No.: AC-001 | Rev. 01 | Effectivity: __________'
  const fw = fonts.regular.widthOfTextAtSize(formNo, 4.5)
  page.drawText(formNo, {
    x: PAGE_W - MARGIN - fw,
    y: 6,
    size: 4.5,
    font: fonts.regular,
    color: GRAY,
  })
}
