import { Hono, type Context } from 'hono'
import logoBytes from '../../assets/LGU-otaf.png'
import { generateAcrPdf } from '../lib/acr/generate-acr'
import { createAcr, deleteAcr, getAcr, listAcr, updateAcr } from '../lib/acr/store'
import type { AcrFormData } from '../lib/acr/types'

const acr = new Hono()

const STRING_KEYS: (keyof AcrFormData)[] = [
  'correctionRequestNo',
  'dateFiled',
  'dtrControlNo',
  'attendanceDate',
  'employeeName',
  'employeeId',
  'position',
  'officeDepartment',
  'employmentStatus',
  'payrollGroup',
  'reasonOtherText',
  'originalDate',
  'requestedDate',
  'originalAmIn',
  'requestedAmIn',
  'originalAmOut',
  'requestedAmOut',
  'originalPmIn',
  'requestedPmIn',
  'originalPmOut',
  'requestedPmOut',
  'originalOtIn',
  'requestedOtIn',
  'originalOtOut',
  'requestedOtOut',
  'requestedTotalHours',
  'requestedOvertime',
  'requestedUndertime',
  'actualArrivalDeparture',
  'explanation',
  'employeeSignatureName',
  'employeeSignatureDate',
  'supportOtherText',
  'documentReferenceNo',
  'supportRemarks',
  'supervisorTimeIn',
  'supervisorTimeInAmPm',
  'supervisorTimeOut',
  'supervisorTimeOutAmPm',
  'supervisorRemarks',
  'supervisorSignatureName',
  'supervisorPosition',
  'supervisorDate',
  'hrmoOtherText',
  'similarCorrectionsCount',
  'hrmoRemarks',
  'hrmoReviewedBy',
  'hrmoPosition',
  'hrmoSignatureName',
  'hrmoDate',
  'approvedAmIn',
  'approvedAmOut',
  'approvedPmIn',
  'approvedPmOut',
  'approvedOtIn',
  'approvedOtOut',
  'approvalRemarks',
  'approverName',
  'approverPosition',
  'approverSignatureName',
  'approverDate',
  'originalSystemEntry',
  'correctedSystemEntry',
  'updatedBy',
  'dateTimeUpdated',
  'auditReferenceNo',
  'hrmoFinalVerification',
  'finalStatusDate',
]

const BOOL_KEYS: (keyof AcrFormData)[] = [
  'reasonForgotTimeIn',
  'reasonForgotTimeOut',
  'reasonForgotAmIn',
  'reasonForgotAmOut',
  'reasonForgotPmIn',
  'reasonForgotPmOut',
  'reasonForgotOtIn',
  'reasonForgotOtOut',
  'reasonBiometricError',
  'reasonSystemError',
  'reasonOfficialFieldWork',
  'reasonOfficialBusiness',
  'reasonOther',
  'supportLocatorSlip',
  'supportCertificateAppearance',
  'supportOfficialBusiness',
  'supportSupervisorCert',
  'supportBiometricLog',
  'supportSystemErrorRecord',
  'supportOther',
  'supportNone',
  'supervisorVerified',
  'supervisorNotVerified',
  'supervisorFurtherVerification',
  'hrmoCorrectionSupported',
  'hrmoSupervisorSufficient',
  'hrmoDocumentSufficient',
  'hrmoAdditionalDocsRequired',
  'hrmoNotSupported',
  'hrmoRepeatedMissed',
  'hrmoOther',
  'approvalApproved',
  'approvalDisapproved',
  'approvalReturned',
  'updateEncoded',
  'updateOriginalPreserved',
  'updateRequestAttached',
  'updateDocsAttached',
  'updateAuditTrail',
  'updateEmployeeNotified',
  'statusCorrected',
  'statusNotCorrected',
  'statusDisapproved',
  'statusPending',
]

function pick(source: FormData | URLSearchParams, key: string): string | undefined {
  const value = source.get(key)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function parseBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return undefined
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on', 'x'].includes(v)) return true
  if (['0', 'false', 'no', 'off', ''].includes(v)) return false
  return undefined
}

function parseAcrData(
  source: FormData | URLSearchParams | Record<string, unknown>,
  opts?: { sparse?: boolean },
): AcrFormData {
  const sparse = opts?.sparse ?? false
  const hasKey = (key: string): boolean => {
    if (source instanceof FormData || source instanceof URLSearchParams) return source.has(key)
    return Object.prototype.hasOwnProperty.call(source, key)
  }
  const get = (key: string): string | undefined => {
    if (source instanceof FormData || source instanceof URLSearchParams) return pick(source, key)
    const value = source[key]
    if (typeof value === 'number') return String(value)
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed.length ? trimmed : undefined
  }
  const getBool = (key: string): boolean | undefined => {
    if (source instanceof FormData || source instanceof URLSearchParams) {
      if (!source.has(key)) return sparse ? undefined : false
      return parseBool(source.get(key)) ?? true
    }
    return parseBool(source[key])
  }

  const data: AcrFormData = {}
  for (const key of STRING_KEYS) {
    if (sparse && !hasKey(key)) continue
    data[key] = get(key) as never
  }
  for (const key of BOOL_KEYS) {
    if (sparse && !hasKey(key)) continue
    data[key] = getBool(key) as never
  }
  return data
}

async function readBody(c: Context, opts?: { sparse?: boolean }): Promise<AcrFormData> {
  const contentType = c.req.header('content-type') || ''
  if (contentType.includes('application/json')) {
    return parseAcrData((await c.req.json()) as Record<string, unknown>, opts)
  }
  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    return parseAcrData(await c.req.formData(), opts)
  }
  return parseAcrData(c.req.query(), opts)
}

async function pdfResponse(data: AcrFormData) {
  const bytes = await generateAcrPdf(data, logoBytes)
  const filename = `${(data.correctionRequestNo || 'ACR').replace(/[^\w.-]+/g, '_')}.pdf`
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

function formPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ACR Generator</title>
  <style>
    :root { --navy:#0d2f5b; --line:#d7e2ef; --bg:#f3f6fa; --text:#152033; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, sans-serif;
      background: linear-gradient(180deg, #eef3f9 0%, var(--bg) 100%);
      color: var(--text);
    }
    main { max-width: 980px; margin: 0 auto; padding: 28px 18px 48px; }
    h1 { margin: 0 0 6px; color: var(--navy); font-size: 1.4rem; }
    .sub { margin: 0 0 18px; color: #4a5a70; }
    form, .panel {
      background: rgba(255,255,255,.94);
      border: 1px solid var(--line);
      padding: 18px;
      margin-bottom: 16px;
    }
    fieldset { border: 1px solid var(--line); margin: 0 0 14px; padding: 12px; }
    legend { padding: 0 8px; color: var(--navy); font-weight: 700; font-size: .85rem; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
    .checks { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 6px 12px; }
    .checks label { flex-direction: row; align-items: center; font-weight: 500; gap: 8px; }
    label { display: flex; flex-direction: column; gap: 5px; font-size: .82rem; font-weight: 600; color: #334155; }
    input, textarea, select {
      font: inherit; font-weight: 400; border: 1px solid #c5d2e3; padding: 8px 10px; background: #fff;
    }
    textarea { min-height: 70px; resize: vertical; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
    button {
      border: 0; background: var(--navy); color: #fff; padding: 11px 18px;
      font-weight: 700; cursor: pointer;
    }
    button.secondary { background: #5b6b82; }
    code { background: #eef3f9; padding: 2px 6px; }
    @media (max-width: 720px) { .grid, .checks { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>Attendance Correction Request (ACR)</h1>
    <p class="sub">Fill details, save a record, or download the A4 PDF.</p>

    <div class="panel">
      <strong>CRUD API</strong>
      <ul>
        <li><code>GET /acr</code> — list</li>
        <li><code>POST /acr</code> — create</li>
        <li><code>GET /acr/:id</code> — read</li>
        <li><code>PUT /acr/:id</code> — update</li>
        <li><code>PATCH /acr/:id</code> — partial update</li>
        <li><code>DELETE /acr/:id</code> — delete</li>
        <li><code>GET /acr/:id/pdf</code> — PDF for saved record</li>
        <li><code>POST /acr/download</code> — PDF without saving</li>
      </ul>
    </div>

    <form method="POST" action="/acr/download">
      <fieldset>
        <legend>Control Information</legend>
        <div class="grid">
          <label>Correction Request No. <input name="correctionRequestNo" value="ACR-2026-00001" /></label>
          <label>Date Filed <input name="dateFiled" placeholder="YYYY-MM-DD" /></label>
          <label>DTR Control No. <input name="dtrControlNo" /></label>
          <label>Attendance Date <input name="attendanceDate" placeholder="YYYY-MM-DD" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>1. Employee Information</legend>
        <div class="grid">
          <label>Employee Name <input name="employeeName" required /></label>
          <label>Employee ID <input name="employeeId" /></label>
          <label>Position <input name="position" /></label>
          <label>Office / Department <input name="officeDepartment" /></label>
          <label>Employment Status <input name="employmentStatus" /></label>
          <label>Payroll Group <input name="payrollGroup" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>3. Reason for Correction</legend>
        <div class="checks">
          <label><input type="checkbox" name="reasonForgotTimeIn" value="true" /> Forgot to Time In</label>
          <label><input type="checkbox" name="reasonBiometricError" value="true" /> Biometric / Device Error</label>
          <label><input type="checkbox" name="reasonForgotTimeOut" value="true" /> Forgot to Time Out</label>
          <label><input type="checkbox" name="reasonSystemError" value="true" /> System / Network Error</label>
          <label><input type="checkbox" name="reasonForgotAmIn" value="true" /> Forgot AM Time In</label>
          <label><input type="checkbox" name="reasonOfficialFieldWork" value="true" /> Official Field Work</label>
          <label><input type="checkbox" name="reasonForgotAmOut" value="true" /> Forgot AM Time Out</label>
          <label><input type="checkbox" name="reasonOfficialBusiness" value="true" /> Official Business / Travel</label>
          <label><input type="checkbox" name="reasonForgotPmIn" value="true" /> Forgot PM Time In</label>
          <label><input type="checkbox" name="reasonOther" value="true" /> Other</label>
          <label><input type="checkbox" name="reasonForgotPmOut" value="true" /> Forgot PM Time Out</label>
          <label>Other text <input name="reasonOtherText" /></label>
          <label><input type="checkbox" name="reasonForgotOtIn" value="true" /> Forgot OT Time In</label>
          <label><input type="checkbox" name="reasonForgotOtOut" value="true" /> Forgot OT Time Out</label>
        </div>
      </fieldset>

      <fieldset>
        <legend>4. Attendance Entry to be Corrected</legend>
        <div class="grid">
          <label>Original Date <input name="originalDate" /></label>
          <label>Requested Date <input name="requestedDate" /></label>
          <label>Original AM In <input name="originalAmIn" /></label>
          <label>Requested AM In <input name="requestedAmIn" /></label>
          <label>Original AM Out <input name="originalAmOut" /></label>
          <label>Requested AM Out <input name="requestedAmOut" /></label>
          <label>Original PM In <input name="originalPmIn" /></label>
          <label>Requested PM In <input name="requestedPmIn" /></label>
          <label>Original PM Out <input name="originalPmOut" /></label>
          <label>Requested PM Out <input name="requestedPmOut" /></label>
          <label>Original OT In <input name="originalOtIn" /></label>
          <label>Requested OT In <input name="requestedOtIn" /></label>
          <label>Original OT Out <input name="originalOtOut" /></label>
          <label>Requested OT Out <input name="requestedOtOut" /></label>
          <label>Requested Total Hours (hrs) <input name="requestedTotalHours" /></label>
          <label>Requested Overtime (hrs) <input name="requestedOvertime" /></label>
          <label>Requested Undertime (mins) <input name="requestedUndertime" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>5. Employee Explanation</legend>
        <div class="grid">
          <label>Actual Arrival / Departure <input name="actualArrivalDeparture" /></label>
          <label>Employee Signature Date <input name="employeeSignatureDate" placeholder="YYYY-MM-DD" /></label>
        </div>
        <label style="margin-top:10px">Explanation <textarea name="explanation"></textarea></label>
        <div class="grid" style="margin-top:10px">
          <label>Employee Signature over Printed Name <input name="employeeSignatureName" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>6. Supporting Document / Proof of Attendance</legend>
        <div class="checks">
          <label><input type="checkbox" name="supportLocatorSlip" value="true" /> Locator Slip</label>
          <label><input type="checkbox" name="supportCertificateAppearance" value="true" /> Certificate of Appearance</label>
          <label><input type="checkbox" name="supportOfficialBusiness" value="true" /> Official Business / Travel Order</label>
          <label><input type="checkbox" name="supportSupervisorCert" value="true" /> Supervisor Certification</label>
          <label><input type="checkbox" name="supportBiometricLog" value="true" /> Biometric / Attendance System Log</label>
          <label><input type="checkbox" name="supportSystemErrorRecord" value="true" /> System Error Record</label>
          <label><input type="checkbox" name="supportOther" value="true" /> Other Supporting Document</label>
          <label><input type="checkbox" name="supportNone" value="true" /> No Supporting Document Available</label>
        </div>
        <div class="grid" style="margin-top:10px">
          <label>Other Supporting Document <input name="supportOtherText" /></label>
          <label>Document / Reference No. <input name="documentReferenceNo" /></label>
        </div>
        <label style="margin-top:10px">Remarks <textarea name="supportRemarks"></textarea></label>
      </fieldset>

      <fieldset>
        <legend>7. Immediate Supervisor Verification</legend>
        <div class="checks">
          <label><input type="checkbox" name="supervisorVerified" value="true" /> VERIFIED - CORRECTION RECOMMENDED</label>
          <label><input type="checkbox" name="supervisorNotVerified" value="true" /> NOT VERIFIED</label>
          <label><input type="checkbox" name="supervisorFurtherVerification" value="true" /> FOR FURTHER VERIFICATION</label>
        </div>
        <div class="grid" style="margin-top:10px">
          <label>Time In <input name="supervisorTimeIn" /></label>
          <label>Time In AM/PM <input name="supervisorTimeInAmPm" placeholder="AM/PM" /></label>
          <label>Time Out <input name="supervisorTimeOut" /></label>
          <label>Time Out AM/PM <input name="supervisorTimeOutAmPm" placeholder="AM/PM" /></label>
        </div>
        <label style="margin-top:10px">Supervisor Remarks <textarea name="supervisorRemarks"></textarea></label>
        <div class="grid" style="margin-top:10px">
          <label>Signature over Printed Name <input name="supervisorSignatureName" /></label>
          <label>Position <input name="supervisorPosition" /></label>
          <label>Date <input name="supervisorDate" placeholder="YYYY-MM-DD" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>8. HRMO Review</legend>
        <div class="checks">
          <label><input type="checkbox" name="hrmoCorrectionSupported" value="true" /> Attendance correction is supported</label>
          <label><input type="checkbox" name="hrmoNotSupported" value="true" /> Correction is not supported</label>
          <label><input type="checkbox" name="hrmoSupervisorSufficient" value="true" /> Supervisor verification is sufficient</label>
          <label><input type="checkbox" name="hrmoRepeatedMissed" value="true" /> Repeated missed time-in/time-out identified</label>
          <label><input type="checkbox" name="hrmoDocumentSufficient" value="true" /> Supporting document is sufficient</label>
          <label><input type="checkbox" name="hrmoOther" value="true" /> Other</label>
          <label><input type="checkbox" name="hrmoAdditionalDocsRequired" value="true" /> Additional documentation required</label>
          <label>Other text <input name="hrmoOtherText" /></label>
        </div>
        <div class="grid" style="margin-top:10px">
          <label>Number of Similar Corrections During Current Period <input name="similarCorrectionsCount" /></label>
        </div>
        <label style="margin-top:10px">HRMO Remarks <textarea name="hrmoRemarks"></textarea></label>
        <div class="grid" style="margin-top:10px">
          <label>Reviewed By <input name="hrmoReviewedBy" /></label>
          <label>Position <input name="hrmoPosition" /></label>
          <label>Signature <input name="hrmoSignatureName" /></label>
          <label>Date <input name="hrmoDate" placeholder="YYYY-MM-DD" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>9. Authorized Approval</legend>
        <div class="checks">
          <label><input type="checkbox" name="approvalApproved" value="true" /> APPROVED</label>
          <label><input type="checkbox" name="approvalDisapproved" value="true" /> DISAPPROVED</label>
          <label><input type="checkbox" name="approvalReturned" value="true" /> RETURNED FOR CLARIFICATION</label>
        </div>
        <div class="grid" style="margin-top:10px">
          <label>AM In <input name="approvedAmIn" /></label>
          <label>AM Out <input name="approvedAmOut" /></label>
          <label>PM In <input name="approvedPmIn" /></label>
          <label>PM Out <input name="approvedPmOut" /></label>
          <label>OT In <input name="approvedOtIn" /></label>
          <label>OT Out <input name="approvedOtOut" /></label>
        </div>
        <label style="margin-top:10px">Remarks <textarea name="approvalRemarks"></textarea></label>
        <div class="grid" style="margin-top:10px">
          <label>Authorized Approving Officer <input name="approverName" /></label>
          <label>Position <input name="approverPosition" /></label>
          <label>Signature <input name="approverSignatureName" /></label>
          <label>Date <input name="approverDate" placeholder="YYYY-MM-DD" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>10. System Update (HRMO / Admin Use Only)</legend>
        <div class="checks">
          <label><input type="checkbox" name="updateEncoded" value="true" /> Approved correction encoded</label>
          <label><input type="checkbox" name="updateOriginalPreserved" value="true" /> Original system record preserved</label>
          <label><input type="checkbox" name="updateRequestAttached" value="true" /> Correction request attached to employee attendance record</label>
          <label><input type="checkbox" name="updateDocsAttached" value="true" /> Supporting documents attached</label>
          <label><input type="checkbox" name="updateAuditTrail" value="true" /> Audit trail generated</label>
          <label><input type="checkbox" name="updateEmployeeNotified" value="true" /> Employee notified</label>
        </div>
        <div class="grid" style="margin-top:10px">
          <label>Original System Entry <input name="originalSystemEntry" /></label>
          <label>Corrected System Entry <input name="correctedSystemEntry" /></label>
          <label>Updated By <input name="updatedBy" /></label>
          <label>Date / Time Updated <input name="dateTimeUpdated" /></label>
          <label>System Transaction / Audit Reference No. <input name="auditReferenceNo" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>11. Final Status</legend>
        <div class="checks">
          <label><input type="checkbox" name="statusCorrected" value="true" /> CORRECTED</label>
          <label><input type="checkbox" name="statusNotCorrected" value="true" /> NOT CORRECTED</label>
          <label><input type="checkbox" name="statusDisapproved" value="true" /> DISAPPROVED</label>
          <label><input type="checkbox" name="statusPending" value="true" /> PENDING</label>
        </div>
        <div class="grid" style="margin-top:10px">
          <label>HRMO Final Verification <input name="hrmoFinalVerification" /></label>
          <label>Date <input name="finalStatusDate" placeholder="YYYY-MM-DD" /></label>
        </div>
      </fieldset>

      <div class="actions">
        <button type="submit">Download PDF</button>
        <button type="submit" formaction="/acr" formmethod="post" class="secondary">Save Record</button>
      </div>
    </form>
  </main>
</body>
</html>`
}

acr.get('/form', (c) => c.html(formPage()))
acr.get('/ui', (c) => c.html(formPage()))

acr.get('/download', async (c) => pdfResponse(parseAcrData(c.req.query())))
acr.post('/download', async (c) => pdfResponse(await readBody(c)))

acr.get('/', (c) => c.json({ data: listAcr() }))

acr.post('/', async (c) => {
  const data = await readBody(c)
  const record = createAcr(data)
  const accept = c.req.header('accept') || ''
  if (accept.includes('text/html') || (c.req.header('content-type') || '').includes('form')) {
    return c.redirect(`/acr/${record.id}/pdf`)
  }
  return c.json({ data: record }, 201)
})

acr.get('/:id', (c) => {
  const record = getAcr(c.req.param('id'))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: record })
})

acr.put('/:id', async (c) => {
  const record = updateAcr(c.req.param('id'), await readBody(c))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: record })
})

acr.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = getAcr(id)
  if (!existing) return c.json({ error: 'Not found' }, 404)
  const patch = await readBody(c, { sparse: true })
  const record = updateAcr(id, { ...existing, ...patch })
  return c.json({ data: record })
})

acr.delete('/:id', (c) => {
  const ok = deleteAcr(c.req.param('id'))
  if (!ok) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

acr.get('/:id/pdf', async (c) => {
  const record = getAcr(c.req.param('id'))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return pdfResponse(record)
})

export default acr
