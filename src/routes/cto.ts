import { Hono, type Context } from 'hono'
import logoBytes from '../../assets/LGU-otaf.png'
import { generateCtoPdf } from '../lib/cto/generate-cto'
import { createCto, deleteCto, getCto, listCto, updateCto } from '../lib/cto/store'
import type { ApprovalDecision, CtoFormData } from '../lib/cto/types'

const cto = new Hono()

const FIELD_KEYS: (keyof CtoFormData)[] = [
  'controlNumber',
  'dateFiled',
  'employeeName',
  'employeeId',
  'position',
  'officeDepartment',
  'employmentStatus',
  'payrollGroup',
  'overtimeCertificationNo',
  'datesEarned',
  'totalEarnedCtoHours',
  'availableCtoBalance',
  'datesRequested',
  'timeFrom',
  'timeTo',
  'totalHoursRequested',
  'purposeReason',
  'employeeSignatureName',
  'employeeSignatureDate',
  'supervisorDecision',
  'supervisorRemarks',
  'supervisorSignatureName',
  'supervisorPrintedName',
  'supervisorPosition',
  'supervisorDate',
  'deptHeadDecision',
  'deptHeadRemarks',
  'deptHeadSignatureName',
  'deptHeadPrintedName',
  'deptHeadDate',
  'earnedCtoCredits',
  'hoursRequested',
  'remainingCtoBalance',
  'hrmoVerifiedBy',
  'hrmoVerifiedDate',
  'processedBy',
  'recordedBy',
  'approvedBy',
  'dateProcessed',
  'ctoLedgerReferenceNo',
]

function pick(source: FormData | URLSearchParams, key: string): string | undefined {
  const value = source.get(key)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function parseDecision(value: string | undefined): ApprovalDecision | undefined {
  if (value === 'approved' || value === 'disapproved') return value
  return undefined
}

function parseCtoData(
  source: FormData | URLSearchParams | Record<string, unknown>,
  opts?: { sparse?: boolean },
): CtoFormData {
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

  const data: CtoFormData = {}
  for (const key of FIELD_KEYS) {
    if (sparse && !hasKey(key)) continue
    if (key === 'supervisorDecision' || key === 'deptHeadDecision') {
      data[key] = parseDecision(get(key))
      continue
    }
    data[key] = get(key)
  }
  return data
}

async function readBody(c: Context, opts?: { sparse?: boolean }): Promise<CtoFormData> {
  const contentType = c.req.header('content-type') || ''
  if (contentType.includes('application/json')) {
    return parseCtoData((await c.req.json()) as Record<string, unknown>, opts)
  }
  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    return parseCtoData(await c.req.formData(), opts)
  }
  return parseCtoData(c.req.query(), opts)
}

async function pdfResponse(data: CtoFormData) {
  const bytes = await generateCtoPdf(data, logoBytes)
  const filename = `${(data.controlNumber || 'CTO').replace(/[^\w.-]+/g, '_')}.pdf`
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
  <title>CTO Application Form</title>
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
    h1 { margin: 0 0 6px; color: var(--navy); font-size: 1.45rem; }
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
    .grid.four { grid-template-columns: repeat(4, minmax(0,1fr)); }
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
    @media (max-width: 720px) { .grid, .grid.four { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>Compensatory Time Off (CTO) Application</h1>
    <p class="sub">Fill details, save a record, or download the A4 PDF.</p>

    <div class="panel">
      <strong>CRUD API</strong>
      <ul>
        <li><code>GET /cto</code> — list</li>
        <li><code>POST /cto</code> — create</li>
        <li><code>GET /cto/:id</code> — read</li>
        <li><code>PUT /cto/:id</code> — update</li>
        <li><code>PATCH /cto/:id</code> — partial update</li>
        <li><code>DELETE /cto/:id</code> — delete</li>
        <li><code>GET /cto/:id/pdf</code> — PDF for saved record</li>
        <li><code>POST /cto/download</code> — PDF without saving</li>
      </ul>
    </div>

    <form method="POST" action="/cto/download">
      <fieldset>
        <legend>Control</legend>
        <div class="grid">
          <label>CTO Control Number <input name="controlNumber" value="CTO-2026-00001" /></label>
          <label>Date Filed <input name="dateFiled" placeholder="YYYY-MM-DD" /></label>
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
        <legend>2. CTO Credit Information</legend>
        <div class="grid four">
          <label>Overtime Certification No. <input name="overtimeCertificationNo" /></label>
          <label>Date(s) Earned <input name="datesEarned" /></label>
          <label>Total Earned CTO Hours <input name="totalEarnedCtoHours" /></label>
          <label>Available CTO Balance <input name="availableCtoBalance" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>3. CTO Request Details</legend>
        <div class="grid four">
          <label>Date(s) Requested <input name="datesRequested" /></label>
          <label>Time From <input name="timeFrom" /></label>
          <label>Time To <input name="timeTo" /></label>
          <label>Total Hours Requested <input name="totalHoursRequested" /></label>
        </div>
        <label style="margin-top:10px">Purpose / Reason
          <textarea name="purposeReason"></textarea>
        </label>
      </fieldset>

      <fieldset>
        <legend>4. Employee Certification</legend>
        <div class="grid">
          <label>Signature Name <input name="employeeSignatureName" /></label>
          <label>Date <input name="employeeSignatureDate" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>5–6. Approvals</legend>
        <div class="grid">
          <label>Supervisor Decision
            <select name="supervisorDecision">
              <option value="">—</option>
              <option value="approved">Approved</option>
              <option value="disapproved">Disapproved</option>
            </select>
          </label>
          <label>Dept Head Decision
            <select name="deptHeadDecision">
              <option value="">—</option>
              <option value="approved">Approved</option>
              <option value="disapproved">Disapproved</option>
            </select>
          </label>
          <label>Supervisor Printed Name <input name="supervisorPrintedName" /></label>
          <label>Dept Head Printed Name <input name="deptHeadPrintedName" /></label>
          <label>Supervisor Position <input name="supervisorPosition" /></label>
          <label>Dept Head Date <input name="deptHeadDate" /></label>
          <label>Supervisor Date <input name="supervisorDate" /></label>
          <label>Supervisor Remarks <input name="supervisorRemarks" /></label>
        </div>
      </fieldset>

      <div class="actions">
        <button type="submit">Download PDF</button>
        <button type="submit" formaction="/cto" formmethod="post" class="secondary">Save Record</button>
      </div>
    </form>
  </main>
</body>
</html>`
}

cto.get('/form', (c) => c.html(formPage()))
cto.get('/ui', (c) => c.html(formPage()))

cto.get('/download', async (c) => pdfResponse(parseCtoData(c.req.query())))
cto.post('/download', async (c) => pdfResponse(await readBody(c)))

cto.get('/', (c) => c.json({ data: listCto() }))

cto.post('/', async (c) => {
  const data = await readBody(c)
  const record = createCto(data)
  const accept = c.req.header('accept') || ''
  if (accept.includes('text/html') || (c.req.header('content-type') || '').includes('form')) {
    return c.redirect(`/cto/${record.id}/pdf`)
  }
  return c.json({ data: record }, 201)
})

cto.get('/:id', (c) => {
  const record = getCto(c.req.param('id'))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: record })
})

cto.put('/:id', async (c) => {
  const record = updateCto(c.req.param('id'), await readBody(c))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: record })
})

cto.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = getCto(id)
  if (!existing) return c.json({ error: 'Not found' }, 404)
  const patch = await readBody(c, { sparse: true })
  const record = updateCto(id, { ...existing, ...patch })
  return c.json({ data: record })
})

cto.delete('/:id', (c) => {
  const ok = deleteCto(c.req.param('id'))
  if (!ok) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

cto.get('/:id/pdf', async (c) => {
  const record = getCto(c.req.param('id'))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return pdfResponse(record)
})

export default cto
