import { Hono, type Context } from 'hono'
import logoBytes from '../../assets/LGU-otaf.png'
import { generateOarPdf } from '../lib/oar/generate-oar'
import { createOar, deleteOar, getOar, listOar, updateOar } from '../lib/oar/store'
import type { OarFormData, SupervisorRating } from '../lib/oar/types'

const oar = new Hono()

const FIELD_KEYS: (keyof OarFormData)[] = [
  'controlNumber',
  'dateFiled',
  'employeeId',
  'employeeName',
  'position',
  'officeDepartment',
  'employmentStatus',
  'payrollGroup',
  'dateOfOvertime',
  'dayOfWeek',
  'approvedTimeIn',
  'approvedTimeOut',
  'approvedTotalHours',
  'actualTimeIn',
  'actualTimeOut',
  'actualTotalHours',
  'activitiesPerformed',
  'outputsDeliverables',
  'problemsEncountered',
  'supervisorRating',
  'commentsRecommendations',
  'employeeSignatureName',
  'employeeSignatureDate',
  'supervisorSignatureName',
  'supervisorPosition',
  'supervisorSignatureDate',
  'hrmoReceivedBy',
  'hrmoReceivedDate',
  'hrmoVerifiedBy',
  'hrmoVerifiedDate',
]

function pick(source: FormData | URLSearchParams, key: string): string | undefined {
  const value = source.get(key)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function parseRating(value: string | undefined): SupervisorRating | undefined {
  if (
    value === 'outstanding' ||
    value === 'verySatisfactory' ||
    value === 'satisfactory' ||
    value === 'needsImprovement' ||
    value === 'unsatisfactory'
  ) {
    return value
  }
  return undefined
}

function parseOarData(
  source: FormData | URLSearchParams | Record<string, unknown>,
  opts?: { sparse?: boolean },
): OarFormData {
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

  const data: OarFormData = {}
  for (const key of FIELD_KEYS) {
    if (sparse && !hasKey(key)) continue
    if (key === 'supervisorRating') {
      data.supervisorRating = parseRating(get(key))
      continue
    }
    data[key] = get(key)
  }
  return data
}

async function readBody(c: Context, opts?: { sparse?: boolean }): Promise<OarFormData> {
  const contentType = c.req.header('content-type') || ''
  if (contentType.includes('application/json')) {
    return parseOarData((await c.req.json()) as Record<string, unknown>, opts)
  }
  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    return parseOarData(await c.req.formData(), opts)
  }
  return parseOarData(c.req.query(), opts)
}

async function pdfResponse(data: OarFormData) {
  const bytes = await generateOarPdf(data, logoBytes)
  const filename = `${(data.controlNumber || 'OAR').replace(/[^\w.-]+/g, '_')}.pdf`
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
  <title>OAR Generator</title>
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
    .grid.three { grid-template-columns: repeat(3, minmax(0,1fr)); }
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
    @media (max-width: 720px) { .grid, .grid.three { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>Overtime Accomplishment Report (OAR)</h1>
    <p class="sub">Fill details, save a record, or download the A4 PDF.</p>

    <div class="panel">
      <strong>CRUD API</strong>
      <ul>
        <li><code>GET /oar</code> — list</li>
        <li><code>POST /oar</code> — create</li>
        <li><code>GET /oar/:id</code> — read</li>
        <li><code>PUT /oar/:id</code> — update</li>
        <li><code>PATCH /oar/:id</code> — partial update</li>
        <li><code>DELETE /oar/:id</code> — delete</li>
        <li><code>GET /oar/:id/pdf</code> — PDF for saved record</li>
        <li><code>POST /oar/download</code> — PDF without saving</li>
      </ul>
    </div>

    <form method="POST" action="/oar/download">
      <fieldset>
        <legend>Control</legend>
        <div class="grid">
          <label>Control Number <input name="controlNumber" value="OTAR-2026-00001" /></label>
          <label>Date Filed <input name="dateFiled" placeholder="MM/DD/YYYY" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>1. Employee Information</legend>
        <div class="grid">
          <label>Employee ID <input name="employeeId" /></label>
          <label>Employee Name <input name="employeeName" required /></label>
          <label>Position <input name="position" /></label>
          <label>Office / Department <input name="officeDepartment" /></label>
          <label>Employment Status <input name="employmentStatus" /></label>
          <label>Payroll Group <input name="payrollGroup" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>2. Overtime Details</legend>
        <div class="grid">
          <label>Date of Overtime <input name="dateOfOvertime" /></label>
          <label>Day of Week <input name="dayOfWeek" /></label>
        </div>
        <div class="grid three">
          <label>Approved Time In <input name="approvedTimeIn" /></label>
          <label>Approved Time Out <input name="approvedTimeOut" /></label>
          <label>Approved Total Hours <input name="approvedTotalHours" /></label>
          <label>Actual Time In <input name="actualTimeIn" /></label>
          <label>Actual Time Out <input name="actualTimeOut" /></label>
          <label>Actual Total Hours <input name="actualTotalHours" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>3. Work Accomplished</legend>
        <label>Activities Performed <textarea name="activitiesPerformed"></textarea></label>
        <label style="margin-top:10px">Outputs / Deliverables <textarea name="outputsDeliverables"></textarea></label>
        <label style="margin-top:10px">Problems Encountered <textarea name="problemsEncountered"></textarea></label>
      </fieldset>

      <fieldset>
        <legend>4. Supervisor Evaluation</legend>
        <label>Rating
          <select name="supervisorRating">
            <option value="">—</option>
            <option value="outstanding">Outstanding</option>
            <option value="verySatisfactory">Very Satisfactory</option>
            <option value="satisfactory">Satisfactory</option>
            <option value="needsImprovement">Needs Improvement</option>
            <option value="unsatisfactory">Unsatisfactory</option>
          </select>
        </label>
        <label style="margin-top:10px">Comments / Recommendations
          <textarea name="commentsRecommendations"></textarea>
        </label>
      </fieldset>

      <fieldset>
        <legend>5–6. Certifications</legend>
        <div class="grid">
          <label>Employee Signature Name <input name="employeeSignatureName" /></label>
          <label>Employee Signature Date <input name="employeeSignatureDate" /></label>
          <label>Supervisor Signature Name <input name="supervisorSignatureName" /></label>
          <label>Supervisor Position <input name="supervisorPosition" /></label>
          <label>Supervisor Signature Date <input name="supervisorSignatureDate" /></label>
        </div>
      </fieldset>

      <div class="actions">
        <button type="submit">Download PDF</button>
        <button type="submit" formaction="/oar" formmethod="post" class="secondary">Save Record</button>
      </div>
    </form>
  </main>
</body>
</html>`
}

oar.get('/form', (c) => c.html(formPage()))
oar.get('/ui', (c) => c.html(formPage()))

oar.get('/download', async (c) => pdfResponse(parseOarData(c.req.query())))
oar.post('/download', async (c) => pdfResponse(await readBody(c)))

oar.get('/', (c) => c.json({ data: listOar() }))

oar.post('/', async (c) => {
  const data = await readBody(c)
  const record = createOar(data)
  const accept = c.req.header('accept') || ''
  if (accept.includes('text/html') || (c.req.header('content-type') || '').includes('form')) {
    return c.redirect(`/oar/${record.id}/pdf`)
  }
  return c.json({ data: record }, 201)
})

oar.get('/:id', (c) => {
  const record = getOar(c.req.param('id'))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: record })
})

oar.put('/:id', async (c) => {
  const record = updateOar(c.req.param('id'), await readBody(c))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: record })
})

oar.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = getOar(id)
  if (!existing) return c.json({ error: 'Not found' }, 404)
  const patch = await readBody(c, { sparse: true })
  const record = updateOar(id, { ...existing, ...patch })
  return c.json({ data: record })
})

oar.delete('/:id', (c) => {
  const ok = deleteOar(c.req.param('id'))
  if (!ok) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

oar.get('/:id/pdf', async (c) => {
  const record = getOar(c.req.param('id'))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return pdfResponse(record)
})

export default oar
