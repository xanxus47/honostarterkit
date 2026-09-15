import { Hono, type Context } from 'hono'
import logoBytes from '../../assets/LGU-otaf.png'
import { generateOafPdf } from '../lib/oaf/generate-oaf'
import { createOaf, deleteOaf, getOaf, listOaf, updateOaf } from '../lib/oaf/store'
import type { OafFormData } from '../lib/oaf/types'

const oaf = new Hono()

const FIELD_KEYS: (keyof OafFormData)[] = [
  'controlNumber',
  'dateFiled',
  'originalOtaControlNumber',
  'dateApproved',
  'employeeId',
  'employeeName',
  'position',
  'officeDepartment',
  'employmentStatus',
  'originalDateOfOvertime',
  'originalDaysOfWeek',
  'originalTimeIn',
  'originalTimeOut',
  'originalTotalHours',
  'newDateOfOvertime',
  'newDaysOfWeek',
  'newTimeIn',
  'newTimeOut',
  'newTotalHours',
  'reasonForAmendment',
  'requestedBy',
  'requestedByDate',
  'recommendedBy',
  'recommendedByDate',
  'approvedBy',
  'approvedByDate',
  'verifiedBy',
  'verifiedByDate',
  'hrmoReceivedBy',
  'hrmoReceivedDate',
  'hrmoEncodedBy',
  'hrmoEncodedDate',
  'hrmoRemarks',
]

function pick(source: FormData | URLSearchParams, key: string): string | undefined {
  const value = source.get(key)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function parseOafData(
  source: FormData | URLSearchParams | Record<string, unknown>,
  opts?: { sparse?: boolean },
): OafFormData {
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

  const data: OafFormData = {}
  for (const key of FIELD_KEYS) {
    if (sparse && !hasKey(key)) continue
    data[key] = get(key)
  }
  return data
}

async function readBody(c: Context, opts?: { sparse?: boolean }): Promise<OafFormData> {
  const contentType = c.req.header('content-type') || ''
  if (contentType.includes('application/json')) {
    return parseOafData((await c.req.json()) as Record<string, unknown>, opts)
  }
  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    return parseOafData(await c.req.formData(), opts)
  }
  return parseOafData(c.req.query(), opts)
}

async function pdfResponse(data: OafFormData) {
  const bytes = await generateOafPdf(data, logoBytes)
  const filename = `${(data.controlNumber || 'OAF').replace(/[^\w.-]+/g, '_')}.pdf`
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
  <title>OAF Generator</title>
  <style>
    :root { --navy:#0d2f5b; --line:#d7e2ef; --bg:#f3f6fa; --text:#152033; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, sans-serif;
      background: linear-gradient(180deg, #eef3f9 0%, var(--bg) 100%);
      color: var(--text);
    }
    main { max-width: 920px; margin: 0 auto; padding: 28px 18px 48px; }
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
    .grid.five { grid-template-columns: repeat(5, minmax(0,1fr)); }
    label { display: flex; flex-direction: column; gap: 5px; font-size: .82rem; font-weight: 600; color: #334155; }
    input, textarea {
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
    @media (max-width: 720px) { .grid, .grid.five { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>Overtime Amendment Form (OAF)</h1>
    <p class="sub">Fill details, save a record, or download the A4 PDF.</p>
    <div class="panel">
      <strong>CRUD API</strong>
      <ul>
        <li><code>GET /oaf</code> — list</li>
        <li><code>POST /oaf</code> — create</li>
        <li><code>GET /oaf/:id</code> — read</li>
        <li><code>PUT /oaf/:id</code> — update</li>
        <li><code>PATCH /oaf/:id</code> — partial update</li>
        <li><code>DELETE /oaf/:id</code> — delete</li>
        <li><code>GET /oaf/:id/pdf</code> — PDF for saved record</li>
        <li><code>POST /oaf/download</code> — PDF without saving</li>
      </ul>
    </div>
    <form method="POST" action="/oaf/download">
      <fieldset>
        <legend>Control</legend>
        <div class="grid">
          <label>Control Number <input name="controlNumber" value="OTA-AM-2026-00001" /></label>
          <label>Date Filed <input name="dateFiled" placeholder="MM/DD/YYYY" /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>1. Original OTA Information</legend>
        <div class="grid">
          <label>Original OTA Control Number <input name="originalOtaControlNumber" /></label>
          <label>Date Approved <input name="dateApproved" placeholder="MM/DD/YYYY" /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>2. Employee Information</legend>
        <div class="grid">
          <label>Employee ID <input name="employeeId" /></label>
          <label>Employee Name <input name="employeeName" required /></label>
          <label>Position <input name="position" /></label>
          <label>Office / Department <input name="officeDepartment" /></label>
          <label>Employment Status <input name="employmentStatus" /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>3. Original Schedule</legend>
        <div class="grid">
          <label>Date of Overtime <input name="originalDateOfOvertime" /></label>
          <label>Day(s) of the Week <input name="originalDaysOfWeek" /></label>
          <label>Time In <input name="originalTimeIn" /></label>
          <label>Time Out <input name="originalTimeOut" /></label>
          <label>Total Approved Hours <input name="originalTotalHours" /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>4. New (Amended) Schedule</legend>
        <div class="grid">
          <label>Date of Overtime <input name="newDateOfOvertime" /></label>
          <label>Day(s) of the Week <input name="newDaysOfWeek" /></label>
          <label>New Time In <input name="newTimeIn" /></label>
          <label>New Time Out <input name="newTimeOut" /></label>
          <label>New Total Hours <input name="newTotalHours" /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>5. Reason for Amendment</legend>
        <label>Reason <textarea name="reasonForAmendment"></textarea></label>
      </fieldset>
      <fieldset>
        <legend>6. Approvals</legend>
        <div class="grid">
          <label>Requested By <input name="requestedBy" /></label>
          <label>Requested Date <input name="requestedByDate" /></label>
          <label>Recommended By <input name="recommendedBy" /></label>
          <label>Recommended Date <input name="recommendedByDate" /></label>
          <label>Approved By <input name="approvedBy" /></label>
          <label>Approved Date <input name="approvedByDate" /></label>
          <label>Verified By (HRMO) <input name="verifiedBy" /></label>
          <label>Verified Date <input name="verifiedByDate" /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>HRMO Use</legend>
        <div class="grid">
          <label>Received By <input name="hrmoReceivedBy" /></label>
          <label>Received Date <input name="hrmoReceivedDate" /></label>
          <label>Encoded By <input name="hrmoEncodedBy" /></label>
          <label>Encoded Date <input name="hrmoEncodedDate" /></label>
        </div>
        <label style="margin-top:10px">Remarks <textarea name="hrmoRemarks"></textarea></label>
      </fieldset>
      <div class="actions">
        <button type="submit">Download PDF</button>
        <button type="submit" formaction="/oaf" formmethod="post" class="secondary">Save Record</button>
      </div>
    </form>
  </main>
</body>
</html>`
}

oaf.get('/form', (c) => c.html(formPage()))
oaf.get('/ui', (c) => c.html(formPage()))
oaf.get('/download', async (c) => pdfResponse(parseOafData(c.req.query())))
oaf.post('/download', async (c) => pdfResponse(await readBody(c)))
oaf.get('/', (c) => c.json({ data: listOaf() }))

oaf.post('/', async (c) => {
  const data = await readBody(c)
  const record = createOaf(data)
  const accept = c.req.header('accept') || ''
  if (accept.includes('text/html') || (c.req.header('content-type') || '').includes('form')) {
    return c.redirect(`/oaf/${record.id}/pdf`)
  }
  return c.json({ data: record }, 201)
})

oaf.get('/:id', (c) => {
  const record = getOaf(c.req.param('id'))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: record })
})

oaf.put('/:id', async (c) => {
  const record = updateOaf(c.req.param('id'), await readBody(c))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: record })
})

oaf.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = getOaf(id)
  if (!existing) return c.json({ error: 'Not found' }, 404)
  const patch = await readBody(c, { sparse: true })
  const record = updateOaf(id, { ...existing, ...patch })
  return c.json({ data: record })
})

oaf.delete('/:id', (c) => {
  const ok = deleteOaf(c.req.param('id'))
  if (!ok) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

oaf.get('/:id/pdf', async (c) => {
  const record = getOaf(c.req.param('id'))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return pdfResponse(record)
})

export default oaf
