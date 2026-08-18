import { Hono, type Context } from 'hono'
import logoBytes from '../../assets/LGU-otaf.png'
import { generateLocatorPdf } from '../lib/locatorslip/generate-locator'
import {
  createLocator,
  deleteLocator,
  getLocator,
  listLocator,
  updateLocator,
} from '../lib/locatorslip/store'
import type { LocatorFormData } from '../lib/locatorslip/types'

const locator = new Hono()

const STRING_KEYS: (keyof LocatorFormData)[] = [
  'locatorControlNo',
  'dateFiled',
  'employeeName',
  'employeeId',
  'position',
  'officeDepartment',
  'purposeOthersText',
  'locationAddress',
  'barangay',
  'municipalityCity',
  'province',
  'nearestLandmark',
  'dateFrom',
  'timeFrom',
  'dateTo',
  'timeTo',
  'totalDuration',
  'mobileNumber',
  'commOthersText',
  'employeeSignatureName',
  'employeeSignatureDate',
  'supervisorSignatureName',
  'supervisorDate',
  'departmentHeadSignatureName',
  'departmentHeadDate',
  'receivedByHrmo',
  'dateReceived',
  'recordedInSystemBy',
  'locatorSlipNo',
  'certificateControlNo',
  'dateIssued',
  'appearanceEmployeeName',
  'appearanceEmployeeId',
  'appearancePosition',
  'appearanceOffice',
  'appearanceLocation',
  'appearancePurpose',
  'dateOfAppearance',
  'timeOfAppearance',
  'timeOfDeparture',
  'activityUndertaken',
  'remarksSummary',
  'ackSignatureName',
  'ackDate',
  'certifiedByName',
  'certifiedByPosition',
  'certifiedByOffice',
  'certifiedByDate',
  'certifiedByContact',
  'certReceivedByHrmo',
  'certDateReceived',
  'certRecordedBy',
  'certReferenceNo',
  'certLocatorSlipNo',
  'certControlNoRecord',
]

const BOOL_KEYS: (keyof LocatorFormData)[] = [
  'purposeOfficialBusiness',
  'purposeFieldWork',
  'purposeMeeting',
  'purposeTraining',
  'purposeDataCollection',
  'purposeProject',
  'purposeOthers',
  'timeFromAm',
  'timeFromPm',
  'timeToAm',
  'timeToPm',
  'durationHours',
  'durationDays',
  'commCall',
  'commSms',
  'commViber',
  'commEmail',
  'commOthers',
  'appearanceTimeAm',
  'appearanceTimePm',
  'departureTimeAm',
  'departureTimePm',
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

function parseLocatorData(
  source: FormData | URLSearchParams | Record<string, unknown>,
  opts?: { sparse?: boolean },
): LocatorFormData {
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

  const data: LocatorFormData = {}
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

async function readBody(c: Context, opts?: { sparse?: boolean }): Promise<LocatorFormData> {
  const contentType = c.req.header('content-type') || ''
  if (contentType.includes('application/json')) {
    return parseLocatorData((await c.req.json()) as Record<string, unknown>, opts)
  }
  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    return parseLocatorData(await c.req.formData(), opts)
  }
  return parseLocatorData(c.req.query(), opts)
}

async function pdfResponse(data: LocatorFormData) {
  const bytes = await generateLocatorPdf(data, logoBytes)
  const filename = `${(data.locatorControlNo || 'LOCATOR').replace(/[^\w.-]+/g, '_')}.pdf`
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
  <title>Locator Slip Generator</title>
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
    input, textarea {
      font: inherit; font-weight: 400; border: 1px solid #c5d2e3; padding: 8px 10px; background: #fff;
    }
    textarea { min-height: 64px; resize: vertical; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
    button { border: 0; background: var(--navy); color: #fff; padding: 11px 18px; font-weight: 700; cursor: pointer; }
    button.secondary { background: #5b6b82; }
    code { background: #eef3f9; padding: 2px 6px; }
    @media (max-width: 720px) { .grid, .checks { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>Locator Slip / Certificate of Appearance</h1>
    <p class="sub">Fill details, save a record, or download the A4 PDF (cut-apart form).</p>
    <div class="panel">
      <strong>CRUD API</strong>
      <ul>
        <li><code>GET /locator</code> — list</li>
        <li><code>POST /locator</code> — create</li>
        <li><code>GET /locator/:id</code> — read</li>
        <li><code>PUT /locator/:id</code> — update</li>
        <li><code>PATCH /locator/:id</code> — partial update</li>
        <li><code>DELETE /locator/:id</code> — delete</li>
        <li><code>GET /locator/:id/pdf</code> — PDF for saved record</li>
        <li><code>POST /locator/download</code> — PDF without saving</li>
      </ul>
    </div>
    <form method="POST" action="/locator/download">
      <fieldset>
        <legend>Control</legend>
        <div class="grid">
          <label>Locator Control No. <input name="locatorControlNo" value="LOC-2026-00001" /></label>
          <label>Date Filed <input name="dateFiled" placeholder="YYYY-MM-DD" /></label>
          <label>Certificate Control No. <input name="certificateControlNo" value="COA-2026-00001" /></label>
          <label>Date Issued <input name="dateIssued" placeholder="YYYY-MM-DD" /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>1. Employee Information</legend>
        <div class="grid">
          <label>Name <input name="employeeName" required /></label>
          <label>Employee ID <input name="employeeId" /></label>
          <label>Position / Designation <input name="position" /></label>
          <label>Office / Department <input name="officeDepartment" /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>2. Purpose / Type of Out-of-Office Work</legend>
        <div class="checks">
          <label><input type="checkbox" name="purposeOfficialBusiness" value="true" /> Official Business (OB)</label>
          <label><input type="checkbox" name="purposeFieldWork" value="true" /> Field Work / Inspection</label>
          <label><input type="checkbox" name="purposeMeeting" value="true" /> Meeting / Conference</label>
          <label><input type="checkbox" name="purposeTraining" value="true" /> Training / Seminar</label>
          <label><input type="checkbox" name="purposeDataCollection" value="true" /> Data Collection / Survey</label>
          <label><input type="checkbox" name="purposeProject" value="true" /> Project / Program Implementation</label>
          <label><input type="checkbox" name="purposeOthers" value="true" /> Others</label>
        </div>
        <label style="margin-top:10px">Others (please specify) <input name="purposeOthersText" /></label>
      </fieldset>
      <fieldset>
        <legend>3. Location Details</legend>
        <label>Location / Address <input name="locationAddress" /></label>
        <div class="grid" style="margin-top:10px">
          <label>Barangay <input name="barangay" /></label>
          <label>Municipality / City <input name="municipalityCity" /></label>
          <label>Province <input name="province" /></label>
          <label>Nearest Landmark <input name="nearestLandmark" /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>4. Date and Time</legend>
        <div class="grid">
          <label>Date (From) <input name="dateFrom" placeholder="YYYY-MM-DD" /></label>
          <label>Time (From) <input name="timeFrom" /></label>
          <label>Date (To) <input name="dateTo" placeholder="YYYY-MM-DD" /></label>
          <label>Time (To) <input name="timeTo" /></label>
          <label>Total Duration <input name="totalDuration" /></label>
        </div>
        <div class="checks" style="margin-top:10px">
          <label><input type="checkbox" name="timeFromAm" value="true" /> Time From AM</label>
          <label><input type="checkbox" name="timeFromPm" value="true" /> Time From PM</label>
          <label><input type="checkbox" name="timeToAm" value="true" /> Time To AM</label>
          <label><input type="checkbox" name="timeToPm" value="true" /> Time To PM</label>
          <label><input type="checkbox" name="durationHours" value="true" /> Hour(s)</label>
          <label><input type="checkbox" name="durationDays" value="true" /> Day(s)</label>
        </div>
      </fieldset>
      <fieldset>
        <legend>5. Contact Information</legend>
        <label>Mobile Number <input name="mobileNumber" /></label>
        <div class="checks" style="margin-top:10px">
          <label><input type="checkbox" name="commCall" value="true" /> Call</label>
          <label><input type="checkbox" name="commSms" value="true" /> SMS</label>
          <label><input type="checkbox" name="commViber" value="true" /> Viber</label>
          <label><input type="checkbox" name="commEmail" value="true" /> Email</label>
          <label><input type="checkbox" name="commOthers" value="true" /> Others</label>
        </div>
        <label style="margin-top:10px">Others <input name="commOthersText" /></label>
      </fieldset>
      <fieldset>
        <legend>6. Employee Certification</legend>
        <div class="grid">
          <label>Signature over Printed Name <input name="employeeSignatureName" /></label>
          <label>Date <input name="employeeSignatureDate" placeholder="YYYY-MM-DD" /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>7. Approval</legend>
        <div class="grid">
          <label>Immediate Supervisor <input name="supervisorSignatureName" /></label>
          <label>Supervisor Date <input name="supervisorDate" /></label>
          <label>Department Head <input name="departmentHeadSignatureName" /></label>
          <label>Department Head Date <input name="departmentHeadDate" /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>8. Record (HRMO)</legend>
        <div class="grid">
          <label>Received by (HRMO) <input name="receivedByHrmo" /></label>
          <label>Date Received <input name="dateReceived" /></label>
          <label>Recorded in System by <input name="recordedInSystemBy" /></label>
          <label>Locator Slip No. <input name="locatorSlipNo" /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Certificate of Appearance</legend>
        <div class="grid">
          <label>Date of Appearance <input name="dateOfAppearance" /></label>
          <label>Time of Appearance <input name="timeOfAppearance" /></label>
          <label>Time of Departure <input name="timeOfDeparture" /></label>
          <label>Purpose / Activity Undertaken <input name="activityUndertaken" /></label>
        </div>
        <div class="checks" style="margin-top:10px">
          <label><input type="checkbox" name="appearanceTimeAm" value="true" /> Appearance AM</label>
          <label><input type="checkbox" name="appearanceTimePm" value="true" /> Appearance PM</label>
          <label><input type="checkbox" name="departureTimeAm" value="true" /> Departure AM</label>
          <label><input type="checkbox" name="departureTimePm" value="true" /> Departure PM</label>
        </div>
        <label style="margin-top:10px">Remarks / Summary of Activity <textarea name="remarksSummary"></textarea></label>
        <div class="grid" style="margin-top:10px">
          <label>Employee Acknowledgment Name <input name="ackSignatureName" /></label>
          <label>Acknowledgment Date <input name="ackDate" /></label>
          <label>Certified By (Official on Duty) <input name="certifiedByName" /></label>
          <label>Certified Position <input name="certifiedByPosition" /></label>
          <label>Certified Office / Agency <input name="certifiedByOffice" /></label>
          <label>Certified Date <input name="certifiedByDate" /></label>
          <label>Contact No. <input name="certifiedByContact" /></label>
          <label>Reference No. <input name="certReferenceNo" /></label>
        </div>
      </fieldset>
      <div class="actions">
        <button type="submit">Download PDF</button>
        <button type="submit" formaction="/locator" formmethod="post" class="secondary">Save Record</button>
      </div>
    </form>
  </main>
</body>
</html>`
}

locator.get('/form', (c) => c.html(formPage()))
locator.get('/ui', (c) => c.html(formPage()))
locator.get('/download', async (c) => pdfResponse(parseLocatorData(c.req.query())))
locator.post('/download', async (c) => pdfResponse(await readBody(c)))
locator.get('/', (c) => c.json({ data: listLocator() }))

locator.post('/', async (c) => {
  const data = await readBody(c)
  const record = createLocator(data)
  const accept = c.req.header('accept') || ''
  if (accept.includes('text/html') || (c.req.header('content-type') || '').includes('form')) {
    return c.redirect(`/locator/${record.id}/pdf`)
  }
  return c.json({ data: record }, 201)
})

locator.get('/:id', (c) => {
  const record = getLocator(c.req.param('id'))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: record })
})

locator.put('/:id', async (c) => {
  const record = updateLocator(c.req.param('id'), await readBody(c))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: record })
})

locator.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = getLocator(id)
  if (!existing) return c.json({ error: 'Not found' }, 404)
  const patch = await readBody(c, { sparse: true })
  const record = updateLocator(id, { ...existing, ...patch })
  return c.json({ data: record })
})

locator.delete('/:id', (c) => {
  const ok = deleteLocator(c.req.param('id'))
  if (!ok) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

locator.get('/:id/pdf', async (c) => {
  const record = getLocator(c.req.param('id'))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return pdfResponse(record)
})

export default locator
