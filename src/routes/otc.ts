import { Hono, type Context } from 'hono'
import logoBytes from '../../assets/LGU-otaf.png'
import { generateOtcPdf } from '../lib/otc/generate-otc'
import { createOtc, deleteOtc, getOtc, listOtc, updateOtc } from '../lib/otc/store'
import type { OtcFormData, OvertimeDisposition } from '../lib/otc/types'

const otc = new Hono()

const FIELD_KEYS: (keyof OtcFormData)[] = [
  'controlNumber',
  'dateCertified',
  'employeeName',
  'employeeId',
  'position',
  'officeDepartment',
  'employmentStatus',
  'payrollGroup',
  'datesOfOvertime',
  'daysOfWeek',
  'approvedOvertimeHours',
  'actualHoursRendered',
  'natureOfWork',
  'disposition',
  'supervisorName',
  'supervisorDate',
  'departmentHeadName',
  'departmentHeadDate',
  'hrmoName',
  'hrmoDate',
  'payrollProcessedBy',
  'payrollProcessedDate',
  'payrollEncodedBy',
  'payrollEncodedDate',
  'payrollApprovedBy',
  'payrollApprovedDate',
]

function pick(source: FormData | URLSearchParams, key: string): string | undefined {
  const value = source.get(key)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function parseDisposition(value: string | undefined): OvertimeDisposition | undefined {
  if (value === 'overtimePay' || value === 'cto') return value
  return undefined
}

function parseOtcData(
  source: FormData | URLSearchParams | Record<string, unknown>,
  opts?: { sparse?: boolean },
): OtcFormData {
  const sparse = opts?.sparse ?? false
  const hasKey = (key: string): boolean => {
    if (source instanceof FormData || source instanceof URLSearchParams) return source.has(key)
    return Object.prototype.hasOwnProperty.call(source, key)
  }
  const get = (key: string): string | undefined => {
    if (source instanceof FormData || source instanceof URLSearchParams) return pick(source, key)
    const value = source[key]
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed.length ? trimmed : undefined
  }

  const data: OtcFormData = {}
  for (const key of FIELD_KEYS) {
    if (sparse && !hasKey(key)) continue
    if (key === 'disposition') {
      data.disposition = parseDisposition(get(key))
      continue
    }
    data[key] = get(key)
  }
  return data
}

async function readBody(c: Context, opts?: { sparse?: boolean }): Promise<OtcFormData> {
  const contentType = c.req.header('content-type') || ''
  if (contentType.includes('application/json')) {
    return parseOtcData((await c.req.json()) as Record<string, unknown>, opts)
  }
  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    return parseOtcData(await c.req.formData(), opts)
  }
  return parseOtcData(c.req.query(), opts)
}

async function pdfResponse(data: OtcFormData) {
  const bytes = await generateOtcPdf(data, logoBytes)
  const filename = `${(data.controlNumber || 'OTC').replace(/[^\w.-]+/g, '_')}.pdf`
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
  <title>OTC Generator</title>
  <style>
    :root { --navy:#0d2f5b; --line:#d7e2ef; --bg:#f3f6fa; --text:#152033; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, sans-serif;
      background: linear-gradient(180deg, #eef3f9 0%, var(--bg) 100%);
      color: var(--text);
    }
    main { max-width: 960px; margin: 0 auto; padding: 28px 18px 48px; }
    h1 { margin: 0 0 6px; color: var(--navy); font-size: 1.5rem; }
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
    label { display: flex; flex-direction: column; gap: 5px; font-size: .82rem; font-weight: 600; color: #334155; }
    input, select, textarea {
      font: inherit; font-weight: 400; border: 1px solid #c5d2e3; padding: 8px 10px; background: #fff;
    }
    textarea { min-height: 64px; resize: vertical; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
    button {
      border: 0; background: var(--navy); color: #fff; padding: 11px 18px;
      font-weight: 700; cursor: pointer;
    }
    button.secondary { background: #5b6b82; }
    code { background: #eef3f9; padding: 2px 6px; }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>Overtime Certification (OTC)</h1>
    <p class="sub">Fill details, save a record, or download the A4 PDF.</p>

    <div class="panel">
      <strong>CRUD API</strong>
      <ul>
        <li><code>GET /otc</code> — list</li>
        <li><code>POST /otc</code> — create</li>
        <li><code>GET /otc/:id</code> — read</li>
        <li><code>PUT /otc/:id</code> — update</li>
        <li><code>PATCH /otc/:id</code> — partial update</li>
        <li><code>DELETE /otc/:id</code> — delete</li>
        <li><code>GET /otc/:id/pdf</code> — PDF for saved record</li>
        <li><code>POST /otc/download</code> — PDF without saving</li>
      </ul>
    </div>

    <form method="POST" action="/otc/download">
      <fieldset>
        <legend>Control</legend>
        <div class="grid">
          <label>Control Number <input name="controlNumber" value="OTC-2026-00001" /></label>
          <label>Date Certified <input name="dateCertified" placeholder="MM/DD/YYYY" /></label>
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
        <legend>2. Overtime Details</legend>
        <div class="grid">
          <label>Date / Dates of Overtime <input name="datesOfOvertime" /></label>
          <label>Day(s) of the Week <input name="daysOfWeek" /></label>
          <label>Approved Overtime Hours <input name="approvedOvertimeHours" /></label>
          <label>Actual Hours Rendered <input name="actualHoursRendered" /></label>
        </div>
        <label style="margin-top:10px">Nature of Work / Purpose
          <textarea name="natureOfWork"></textarea>
        </label>
      </fieldset>

      <fieldset>
        <legend>3. Overtime Disposition</legend>
        <label>Select one
          <select name="disposition">
            <option value="">—</option>
            <option value="overtimePay">Compensate through Overtime Pay</option>
            <option value="cto">Credit as Compensatory Time Off (CTO)</option>
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>4. Certifications</legend>
        <div class="grid">
          <label>Immediate Supervisor Name <input name="supervisorName" /></label>
          <label>Supervisor Date <input name="supervisorDate" /></label>
          <label>Department Head Name <input name="departmentHeadName" /></label>
          <label>Department Head Date <input name="departmentHeadDate" /></label>
          <label>HRMO Name <input name="hrmoName" /></label>
          <label>HRMO Date <input name="hrmoDate" /></label>
        </div>
      </fieldset>

      <div class="actions">
        <button type="submit">Download PDF</button>
        <button type="submit" formaction="/otc" formmethod="post" class="secondary">Save Record</button>
      </div>
    </form>
  </main>
</body>
</html>`
}

otc.get('/form', (c) => c.html(formPage()))
otc.get('/ui', (c) => c.html(formPage()))

otc.get('/download', async (c) => pdfResponse(parseOtcData(c.req.query())))
otc.post('/download', async (c) => pdfResponse(await readBody(c)))

otc.get('/', (c) => c.json({ data: listOtc() }))

otc.post('/', async (c) => {
  const data = await readBody(c)
  const record = createOtc(data)
  const accept = c.req.header('accept') || ''
  if (accept.includes('text/html') || (c.req.header('content-type') || '').includes('form')) {
    return c.redirect(`/otc/${record.id}/pdf`)
  }
  return c.json({ data: record }, 201)
})

otc.get('/:id', (c) => {
  const record = getOtc(c.req.param('id'))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: record })
})

otc.put('/:id', async (c) => {
  const record = updateOtc(c.req.param('id'), await readBody(c))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: record })
})

otc.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = getOtc(id)
  if (!existing) return c.json({ error: 'Not found' }, 404)
  const patch = await readBody(c, { sparse: true })
  const record = updateOtc(id, { ...existing, ...patch })
  return c.json({ data: record })
})

otc.delete('/:id', (c) => {
  const ok = deleteOtc(c.req.param('id'))
  if (!ok) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

otc.get('/:id/pdf', async (c) => {
  const record = getOtc(c.req.param('id'))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return pdfResponse(record)
})

export default otc
