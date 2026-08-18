import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from 'pdf-lib'
import type { LocatorFormData } from './types'

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 16

const NAVY = rgb(0.05, 0.18, 0.38)
const TITLE_BLUE = rgb(0.08, 0.25, 0.5)
const LINE_BLUE = rgb(0.15, 0.35, 0.65)
const BLACK = rgb(0.05, 0.05, 0.05)
const WHITE = rgb(1, 1, 1)
const GRAY = rgb(0.32, 0.32, 0.32)

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

function drawUnderline(page: PDFPage, x: number, y: number, width: number) {
  page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.55, color: LINE_BLUE })
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

function drawPanel(
  page: PDFPage,
  x: number,
  topY: number,
  width: number,
  bodyH: number,
  title: string,
  fonts: Fonts,
  barH = 9,
) {
  const barY = topY - barH
  drawSectionBar(page, x, barY, width, barH, title, fonts.bold, 6)
  page.drawRectangle({
    x,
    y: barY - bodyH,
    width,
    height: bodyH,
    borderColor: LINE_BLUE,
    borderWidth: 0.5,
  })
  return { barY, bodyBottom: barY - bodyH }
}

function drawCheckbox(
  page: PDFPage,
  x: number,
  y: number,
  label: string,
  checked: boolean | undefined,
  font: PDFFont,
  size = 5.2,
) {
  const box = 5.4
  page.drawRectangle({
    x,
    y: y - 0.4,
    width: box,
    height: box,
    borderColor: NAVY,
    borderWidth: 0.5,
  })
  if (checked) {
    page.drawText('X', { x: x + 0.9, y, size: 5, font, color: BLACK })
  }
  page.drawText(label, { x: x + box + 2, y, size, font, color: BLACK })
}

function labeledValue(
  page: PDFPage,
  fonts: Fonts,
  label: string,
  value: string | undefined,
  x: number,
  y: number,
  lineW: number,
  labelSize = 5.4,
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
      x: x + Math.max(2, (lineW - nw) / 2),
      y: lineY + 1.5,
      size,
      font: fonts.regular,
      color: BLACK,
    })
  }
  const cw = fonts.regular.widthOfTextAtSize(caption, 4.4)
  page.drawText(caption, {
    x: x + (lineW - cw) / 2,
    y: lineY - 6.2,
    size: 4.4,
    font: fonts.regular,
    color: GRAY,
  })
}

function drawControlBox(
  page: PDFPage,
  fonts: Fonts,
  x: number,
  top: number,
  width: number,
  title: string,
  value: string | undefined,
  hint?: string,
) {
  const headerH = 10
  const bodyH = 16
  const h = headerH + bodyH
  const y = top - h
  page.drawRectangle({ x, y, width, height: h, borderColor: NAVY, borderWidth: 0.8 })
  page.drawRectangle({ x, y: y + bodyH, width, height: headerH, color: NAVY })
  drawCentered(page, title, y + bodyH + 2.5, fonts.bold, 5.2, WHITE, x, x + width)
  if (value) {
    drawCentered(page, value, y + (hint ? 7 : 5), fonts.bold, 6, BLACK, x, x + width)
  }
  if (hint) {
    drawCentered(page, hint, y + 3, fonts.regular, 4.2, GRAY, x, x + width)
  }
  return h
}

function drawScissorsCut(page: PDFPage, y: number) {
  const x0 = MARGIN
  const x1 = PAGE_W - MARGIN
  // simple scissors: two rings + blades
  const sx = x0
  page.drawCircle({ x: sx + 4, y: y + 4, size: 2.4, borderColor: NAVY, borderWidth: 0.7 })
  page.drawCircle({ x: sx + 4, y: y - 4, size: 2.4, borderColor: NAVY, borderWidth: 0.7 })
  page.drawLine({ start: { x: sx + 6, y: y + 2.4 }, end: { x: sx + 16, y: y + 1 }, thickness: 0.8, color: NAVY })
  page.drawLine({ start: { x: sx + 6, y: y - 2.4 }, end: { x: sx + 16, y: y - 1 }, thickness: 0.8, color: NAVY })
  page.drawLine({ start: { x: sx + 16, y: y + 1 }, end: { x: sx + 18, y: y }, thickness: 0.8, color: NAVY })
  page.drawLine({ start: { x: sx + 16, y: y - 1 }, end: { x: sx + 18, y: y }, thickness: 0.8, color: NAVY })

  let x = sx + 22
  while (x < x1) {
    const dash = 6
    page.drawLine({
      start: { x, y },
      end: { x: Math.min(x + dash, x1), y },
      thickness: 0.7,
      color: LINE_BLUE,
    })
    x += dash + 3.5
  }
}

export async function generateLocatorPdf(
  data: LocatorFormData,
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
  const locatorNo = data.locatorControlNo?.trim() || 'LOC-2026-00001'
  const certNo = data.certificateControlNo?.trim() || 'COA-2026-00001'

  page.drawRectangle({
    x: MARGIN - 3,
    y: MARGIN - 3,
    width: PAGE_W - (MARGIN - 3) * 2,
    height: PAGE_H - (MARGIN - 3) * 2,
    borderColor: NAVY,
    borderWidth: 1,
  })

  drawLocatorSlip(page, fonts, logo, locatorNo, data)
  drawScissorsCut(page, 418)
  drawCertificate(page, fonts, logo, certNo, locatorNo, data)

  pdf.setTitle(`Locator Slip ${locatorNo}`)
  pdf.setAuthor('Municipality of Magsaysay HR & Payroll')
  return pdf.save()
}

function drawLocatorSlip(
  page: PDFPage,
  fonts: Fonts,
  logo: PDFImage,
  locatorNo: string,
  data: LocatorFormData,
) {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const top = PAGE_H - MARGIN - 2
  const logoSize = 38
  page.drawImage(logo, { x, y: top - logoSize, width: logoSize, height: logoSize })

  const cx0 = x + 42
  const cx1 = PAGE_W - MARGIN - 118
  drawCentered(page, 'REPUBLIC OF THE PHILIPPINES', top - 7, fonts.regular, 5.5, BLACK, cx0, cx1)
  drawCentered(page, 'PROVINCE OF OCCIDENTAL MINDORO', top - 15, fonts.regular, 5.5, BLACK, cx0, cx1)
  drawCentered(page, 'MUNICIPALITY OF MAGSAYSAY', top - 25, fonts.bold, 8.5, TITLE_BLUE, cx0, cx1)
  drawCentered(
    page,
    'HUMAN RESOURCE & PAYROLL MANAGEMENT SYSTEM',
    top - 34,
    fonts.bold,
    5.8,
    TITLE_BLUE,
    cx0,
    cx1,
  )
  page.drawLine({
    start: { x: cx0 + 20, y: top - 38 },
    end: { x: cx1 - 20, y: top - 38 },
    thickness: 0.7,
    color: LINE_BLUE,
  })
  drawCentered(page, 'LOCATOR SLIP', top - 50, fonts.bold, 12, TITLE_BLUE, cx0, cx1)
  drawCentered(
    page,
    'Purpose: To inform the office of the employee\'s temporary work location outside the office premises.',
    top - 60,
    fonts.italic,
    4.8,
    GRAY,
    cx0,
    cx1,
  )

  const boxW = 108
  const boxX = PAGE_W - MARGIN - boxW
  drawControlBox(page, fonts, boxX, top, boxW, 'LOCATOR CONTROL NO.', locatorNo)
  drawControlBox(page, fonts, boxX, top - 30, boxW, 'DATE FILED', data.dateFiled, '(YYYY-MM-DD)')

  let y = top - 66
  const barH = 9

  // 1. Employee
  let bodyH = 24
  let { barY } = drawPanel(page, x, y, w, bodyH, '1. EMPLOYEE INFORMATION', fonts, barH)
  let row = barY - 9
  labeledValue(page, fonts, 'Name:', data.employeeName, x + 5, row, w * 0.52)
  labeledValue(page, fonts, 'Employee ID:', data.employeeId, x + w * 0.62, row, w * 0.32)
  row -= 11
  labeledValue(page, fonts, 'Position / Designation:', data.position, x + 5, row, w * 0.36)
  labeledValue(page, fonts, 'Office / Department:', data.officeDepartment, x + w * 0.52, row, w * 0.42)
  y = barY - bodyH - 2

  // 2. Purpose
  bodyH = 30
  ;({ barY } = drawPanel(page, x, y, w, bodyH, '2. PURPOSE / TYPE OF OUT-OF-OFFICE WORK (v)', fonts, barH))
  row = barY - 10
  const purposes: [string, boolean | undefined][] = [
    ['Official Business (OB)', data.purposeOfficialBusiness],
    ['Field Work / Inspection', data.purposeFieldWork],
    ['Meeting / Conference', data.purposeMeeting],
    ['Training / Seminar', data.purposeTraining],
    ['Data Collection / Survey', data.purposeDataCollection],
    ['Project / Program Implementation', data.purposeProject],
  ]
  const colW = w / 3
  for (let i = 0; i < purposes.length; i++) {
    const col = i % 3
    const r = Math.floor(i / 3)
    drawCheckbox(page, x + 5 + col * colW, row - r * 9, purposes[i]![0], purposes[i]![1], fonts.regular, 5)
  }
  row -= 18
  drawCheckbox(page, x + 5, row, 'Others (please specify):', data.purposeOthers, fonts.regular, 5)
  drawUnderline(page, x + 108, row - 1, w - 118)
  if (data.purposeOthersText) {
    page.drawText(data.purposeOthersText, { x: x + 110, y: row, size: 5.5, font: fonts.regular, color: BLACK })
  }
  y = barY - bodyH - 2

  // 3. Location
  bodyH = 34
  ;({ barY } = drawPanel(page, x, y, w, bodyH, '3. LOCATION DETAILS', fonts, barH))
  row = barY - 10
  labeledValue(page, fonts, 'Location / Address:', data.locationAddress, x + 5, row, w - 108)
  row -= 11
  labeledValue(page, fonts, 'Barangay:', data.barangay, x + 5, row, w * 0.38)
  labeledValue(page, fonts, 'Municipality / City:', data.municipalityCity, x + w * 0.5, row, w * 0.42)
  row -= 11
  labeledValue(page, fonts, 'Province:', data.province, x + 5, row, w * 0.38)
  labeledValue(page, fonts, 'Nearest Landmark:', data.nearestLandmark, x + w * 0.5, row, w * 0.42)
  y = barY - bodyH - 2

  // 4. Date and time
  bodyH = 34
  ;({ barY } = drawPanel(page, x, y, w, bodyH, '4. DATE AND TIME', fonts, barH))
  row = barY - 10
  labeledValue(page, fonts, 'Date (From):', data.dateFrom, x + 5, row, 70)
  page.drawText('(YYYY-MM-DD)', { x: x + 115, y: row, size: 4.4, font: fonts.regular, color: GRAY })
  labeledValue(page, fonts, 'Time (From):', data.timeFrom, x + 175, row, 50)
  drawCheckbox(page, x + 280, row, 'AM', data.timeFromAm, fonts.regular, 5)
  drawCheckbox(page, x + 318, row, 'PM', data.timeFromPm, fonts.regular, 5)
  row -= 11
  labeledValue(page, fonts, 'Date (To):', data.dateTo, x + 5, row, 70)
  page.drawText('(YYYY-MM-DD)', { x: x + 108, y: row, size: 4.4, font: fonts.regular, color: GRAY })
  labeledValue(page, fonts, 'Time (To):', data.timeTo, x + 175, row, 50)
  drawCheckbox(page, x + 280, row, 'AM', data.timeToAm, fonts.regular, 5)
  drawCheckbox(page, x + 318, row, 'PM', data.timeToPm, fonts.regular, 5)
  row -= 11
  labeledValue(page, fonts, 'Total Duration:', data.totalDuration, x + 5, row, 80)
  drawCheckbox(page, x + 175, row, 'Hour(s)', data.durationHours, fonts.regular, 5)
  drawCheckbox(page, x + 230, row, 'Day(s)', data.durationDays, fonts.regular, 5)
  y = barY - bodyH - 2

  // 5. Contact
  bodyH = 24
  ;({ barY } = drawPanel(page, x, y, w, bodyH, '5. CONTACT INFORMATION', fonts, barH))
  row = barY - 9
  labeledValue(page, fonts, 'Mobile Number (active during field work):', data.mobileNumber, x + 5, row, 160)
  row -= 11
  page.drawText('Mode of Communication / Updates:', { x: x + 5, y: row, size: 5.2, font: fonts.regular, color: BLACK })
  drawCheckbox(page, x + 148, row, 'Call', data.commCall, fonts.regular, 5)
  drawCheckbox(page, x + 188, row, 'SMS', data.commSms, fonts.regular, 5)
  drawCheckbox(page, x + 230, row, 'Viber', data.commViber, fonts.regular, 5)
  drawCheckbox(page, x + 276, row, 'Email', data.commEmail, fonts.regular, 5)
  drawCheckbox(page, x + 322, row, 'Others:', data.commOthers, fonts.regular, 5)
  drawUnderline(page, x + 372, row - 1, w - 362)
  if (data.commOthersText) {
    page.drawText(data.commOthersText, { x: x + 374, y: row, size: 5.2, font: fonts.regular, color: BLACK })
  }
  y = barY - bodyH - 2

  // 6. Certification
  bodyH = 38
  ;({ barY } = drawPanel(page, x, y, w, bodyH, '6. EMPLOYEE CERTIFICATION', fonts, barH))
  const certText =
    'I hereby certify that the information provided above is true and correct and that I will be in the stated location for official work and will remain reachable through the contact number provided.'
  let ty = barY - 9
  for (const line of wrapText(certText, fonts.regular, 5, w - 12).slice(0, 2)) {
    page.drawText(line, { x: x + 5, y: ty, size: 5, font: fonts.regular, color: BLACK })
    ty -= 7
  }
  const sigY = barY - bodyH + 12
  drawSigCaption(page, fonts, data.employeeSignatureName, 'Signature over Printed Name', x + 20, sigY, 200)
  drawSigCaption(page, fonts, data.employeeSignatureDate, 'Date (YYYY-MM-DD)', x + w - 170, sigY, 130)
  y = barY - bodyH - 2

  // 7. Approval
  bodyH = 36
  ;({ barY } = drawPanel(page, x, y, w, bodyH, '7. APPROVAL', fonts, barH))
  const col = w / 2
  page.drawLine({
    start: { x: x + col, y: barY },
    end: { x: x + col, y: barY - bodyH },
    thickness: 0.5,
    color: LINE_BLUE,
  })
  page.drawText('Immediate Supervisor', { x: x + 8, y: barY - 10, size: 5.5, font: fonts.bold, color: BLACK })
  page.drawText('Department Head', { x: x + col + 8, y: barY - 10, size: 5.5, font: fonts.bold, color: BLACK })
  const aY = barY - bodyH + 14
  drawSigCaption(page, fonts, data.supervisorSignatureName, 'Signature over Printed Name', x + 16, aY, col - 32)
  labeledValue(page, fonts, 'Date:', data.supervisorDate, x + 16, aY - 12, 80, 5, 5.5)
  drawSigCaption(
    page,
    fonts,
    data.departmentHeadSignatureName,
    'Signature over Printed Name',
    x + col + 16,
    aY,
    col - 32,
  )
  labeledValue(page, fonts, 'Date:', data.departmentHeadDate, x + col + 16, aY - 12, 80, 5, 5.5)
  y = barY - bodyH - 2

  // 8. Record
  bodyH = 24
  ;({ barY } = drawPanel(page, x, y, w, bodyH, '8. RECORD (FOR HRMO USE ONLY)', fonts, barH))
  row = barY - 9
  labeledValue(page, fonts, 'Received by (HRMO):', data.receivedByHrmo, x + 5, row, 140)
  labeledValue(page, fonts, 'Date Received:', data.dateReceived, x + w * 0.52, row, 140)
  row -= 11
  labeledValue(page, fonts, 'Recorded in System by:', data.recordedInSystemBy, x + 5, row, 130)
  labeledValue(page, fonts, 'Locator Slip No.:', data.locatorSlipNo || locatorNo, x + w * 0.52, row, 140)
}

function drawCertificate(
  page: PDFPage,
  fonts: Fonts,
  logo: PDFImage,
  certNo: string,
  locatorNo: string,
  data: LocatorFormData,
) {
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  const top = 408
  const logoSize = 32
  page.drawImage(logo, { x, y: top - logoSize, width: logoSize, height: logoSize })

  const cx0 = x + 38
  const cx1 = PAGE_W - MARGIN - 118
  drawCentered(page, 'CERTIFICATE OF APPEARANCE', top - 14, fonts.bold, 11, TITLE_BLUE, cx0, cx1)
  drawCentered(page, '(For Official Out-of-Office Work)', top - 24, fonts.italic, 6, GRAY, cx0, cx1)

  const boxW = 108
  const boxX = PAGE_W - MARGIN - boxW
  drawControlBox(page, fonts, boxX, top, boxW, 'CERTIFICATE CONTROL NO.', certNo)
  drawControlBox(page, fonts, boxX, top - 30, boxW, 'DATE ISSUED', data.dateIssued, '(YYYY-MM-DD)')

  let y = top - 64
  const name = data.appearanceEmployeeName || data.employeeName
  const empId = data.appearanceEmployeeId || data.employeeId
  const pos = data.appearancePosition || data.position
  const office = data.appearanceOffice || data.officeDepartment
  const loc = data.appearanceLocation || data.locationAddress
  const purpose = data.appearancePurpose || data.purposeOthersText

  page.drawText('This is to certify that', { x, y, size: 6, font: fonts.regular, color: BLACK })
  const prefixW = fonts.regular.widthOfTextAtSize('This is to certify that ', 6)
  drawUnderline(page, x + prefixW, y - 1, 220)
  if (name) {
    page.drawText(name, { x: x + prefixW + 2, y: y + 1, size: 6.5, font: fonts.regular, color: BLACK })
  }
  const nameEnd = x + prefixW + 224
  labeledValue(page, fonts, '(Employee Name), Employee ID:', empId, nameEnd, y, 90, 5.2, 6)
  y -= 12
  labeledValue(page, fonts, 'Position / Designation:', pos, x, y, 180, 5.5, 6)
  labeledValue(page, fonts, 'Office / Department:', office, x + w * 0.5, y, 160, 5.5, 6)
  y -= 12
  labeledValue(page, fonts, 'personally appeared at', loc, x, y, w - 130, 5.5, 6)
  page.drawText('(Location / Address)', {
    x: x + w - 92,
    y,
    size: 4.4,
    font: fonts.regular,
    color: GRAY,
  })
  y -= 12
  labeledValue(page, fonts, 'for the purpose of', purpose, x, y, w - 100, 5.5, 6)
  y -= 11
  page.drawText("in connection with the employee's authorized out-of-office/official business on:", {
    x,
    y,
    size: 5.5,
    font: fonts.regular,
    color: BLACK,
  })
  y -= 12
  labeledValue(page, fonts, 'Date of Appearance:', data.dateOfAppearance || data.dateFrom, x, y, 70, 5.5, 6)
  page.drawText('(YYYY-MM-DD)', { x: x + 148, y, size: 4.3, font: fonts.regular, color: GRAY })
  labeledValue(page, fonts, 'Time of Appearance:', data.timeOfAppearance || data.timeFrom, x + 210, y, 48, 5.5, 6)
  drawCheckbox(page, x + 360, y, 'AM', data.appearanceTimeAm ?? data.timeFromAm, fonts.regular, 5)
  drawCheckbox(page, x + 398, y, 'PM', data.appearanceTimePm ?? data.timeFromPm, fonts.regular, 5)
  y -= 12
  labeledValue(page, fonts, 'Time of Departure:', data.timeOfDeparture || data.timeTo, x, y, 50, 5.5, 6)
  drawCheckbox(page, x + 130, y, 'AM', data.departureTimeAm ?? data.timeToAm, fonts.regular, 5)
  drawCheckbox(page, x + 168, y, 'PM', data.departureTimePm ?? data.timeToPm, fonts.regular, 5)
  labeledValue(page, fonts, 'Purpose / Activity Undertaken:', data.activityUndertaken, x + 215, y, 200, 5.5, 6)
  y -= 12
  labeledValue(page, fonts, 'Remarks / Summary of Activity:', data.remarksSummary, x, y, w - 155, 5.5, 6)
  y -= 12
  const close =
    'This certification is issued upon the request of the above-named employee as proof of his/her personal appearance and participation in the stated official activity.'
  for (const line of wrapText(close, fonts.italic, 5.2, w)) {
    page.drawText(line, { x, y, size: 5.2, font: fonts.italic, color: BLACK })
    y -= 7
  }

  y -= 4
  const leftW = w * 0.48
  const rightW = w - leftW - 4
  const boxH = 78
  const boxBottom = Math.max(MARGIN + 52, y - boxH)

  page.drawRectangle({
    x,
    y: boxBottom,
    width: leftW,
    height: boxH,
    borderColor: LINE_BLUE,
    borderWidth: 0.5,
  })
  page.drawRectangle({
    x: x + leftW + 4,
    y: boxBottom,
    width: rightW,
    height: boxH,
    borderColor: LINE_BLUE,
    borderWidth: 0.5,
  })

  let ly = boxBottom + boxH - 10
  page.drawText('EMPLOYEE ACKNOWLEDGMENT', { x: x + 5, y: ly, size: 6, font: fonts.bold, color: NAVY })
  ly -= 9
  page.drawText('I hereby certify that the information stated above is true and correct.', {
    x: x + 5,
    y: ly,
    size: 4.6,
    font: fonts.regular,
    color: BLACK,
  })
  const ackY = boxBottom + 18
  drawSigCaption(
    page,
    fonts,
    data.ackSignatureName || data.employeeSignatureName,
    'Employee Signature over Printed Name',
    x + 12,
    ackY,
    leftW - 24,
  )
  labeledValue(page, fonts, 'Date:', data.ackDate, x + 12, ackY - 12, 80, 5, 5.5)

  let ry = boxBottom + boxH - 10
  page.drawText('CERTIFIED BY:', { x: x + leftW + 9, y: ry, size: 6, font: fonts.bold, color: NAVY })
  const certY = boxBottom + boxH - 26
  drawSigCaption(
    page,
    fonts,
    data.certifiedByName,
    'Name and Signature of Official on Duty',
    x + leftW + 14,
    certY,
    rightW - 28,
  )
  labeledValue(page, fonts, 'Position / Designation:', data.certifiedByPosition, x + leftW + 8, certY - 12, 120, 4.8, 5)
  labeledValue(page, fonts, 'Office / Agency / Organization:', data.certifiedByOffice, x + leftW + 8, certY - 22, 100, 4.8, 5)
  labeledValue(page, fonts, 'Date:', data.certifiedByDate, x + leftW + 8, certY - 32, 50, 4.8, 5)
  labeledValue(page, fonts, 'Contact No.:', data.certifiedByContact, x + leftW + 110, certY - 32, 70, 4.8, 5)

  // HRMO use
  const hrmoY = boxBottom - 4
  const hrmoH = Math.max(40, hrmoY - MARGIN)
  const hBar = 9
  drawSectionBar(page, x, hrmoY - hBar, w, hBar, 'FOR HRMO USE ONLY', fonts.bold, 6)
  page.drawRectangle({
    x,
    y: MARGIN,
    width: w,
    height: hrmoY - hBar - MARGIN,
    borderColor: LINE_BLUE,
    borderWidth: 0.5,
  })
  let hy = hrmoY - hBar - 10
  labeledValue(page, fonts, 'Received by (HRMO):', data.certReceivedByHrmo || data.receivedByHrmo, x + 5, hy, 120, 5, 5.5)
  labeledValue(page, fonts, 'Date Received:', data.certDateReceived || data.dateReceived, x + w * 0.5, hy, 140, 5, 5.5)
  hy -= 11
  labeledValue(page, fonts, 'Recorded in System by:', data.certRecordedBy || data.recordedInSystemBy, x + 5, hy, 110, 5, 5.5)
  labeledValue(page, fonts, 'Reference No.:', data.certReferenceNo, x + w * 0.5, hy, 140, 5, 5.5)
  hy -= 11
  labeledValue(page, fonts, 'Locator Slip No.:', data.certLocatorSlipNo || data.locatorSlipNo || locatorNo, x + 5, hy, 120, 5, 5.5)
  labeledValue(page, fonts, 'Certificate Control No.:', data.certControlNoRecord || certNo, x + w * 0.5, hy, 120, 5, 5.5)
}
