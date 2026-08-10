import { Hono, type Context } from 'hono'
import logoBytes from '../../assets/LGU-otaf.png'
import { generateOcfPdf } from '../lib/ocf/generate-ocf'
import { createOcf, deleteOcf, getOcf, listOcf, updateOcf } from '../lib/ocf/store'
import type { OcfFormData } from '../lib/ocf/types'

const ocf = new Hono()

const FIELD_KEYS: (keyof OcfFormData)[] = [
  'otcNumber',
  'dateFiled',
  'otaControlNumber',
  'dateApproved',
  'employeeId',
  'employeeName',
  'position',
  'officeDepartment',
  'dateOfOvertime',
  'daysOfWeek',
  'timeIn',
  'timeOut',
  'approvedTotalHours',
  'purposeJustification',
  'reasonForCancellation',
  'requestedBy',
  'requestedByPosition',
  'requestedByOffice',
  'dateRequested',
  'approvedBy',
  'approvedByPosition',
  'approvedByOffice',
  'approvedByDate',
  'hrmoReceivedBy',
  'hrmoDateReceived',
  'hrmoEncodedBy',
  'hrmoRemarks',
]

function pick(source: FormData | URLSearchParams, key: string): string | undefined {
  const value = source.get(key)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function parseOcfData(
  source: FormData | URLSearchParams | Record<string, unknown>,
  opts?: { sparse?: boolean },
): OcfFormData {
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

  const data: OcfFormData = {}
  for (const key of FIELD_KEYS) {
    if (sparse && !hasKey(key)) continue
    data[key] = get(key)
  }
  return data
}

async function readBody(c: Context, opts?: { sparse?: boolean }): Promise<OcfFormData> {
  const contentType = c.req.header('content-type') || ''
  if (contentType.includes('application/json')) {
    return parseOcfData((await c.req.json()) as Record<string, unknown>, opts)
  }
  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    return parseOcfData(await c.req.formData(), opts)
  }
  return parseOcfData(c.req.query(), opts)
}

async function pdfResponse(data: OcfFormData) {
  const bytes = await generateOcfPdf(data, logoBytes)
  const filename = `${(data.otcNumber || 'OCF').replace(/[^\w.-]+/g, '_')}.pdf`
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
  <title>OCF Generator</title>
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
    .grid.three { grid-template-columns: repeat(3, minmax(0,1fr)); }
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
    @media (max-width: 720px) { .grid, .grid.three { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>Overtime Cancellation Form (OCF)</h1>
    <p class="sub">Fill details, create a record, or download the A4 PDF directly.</p>

    <div class="panel">
      <strong>CRUD API</strong>
      <ul>
        <li><code>GET /ocf</code> — list records</li>
        <li><code>POST /ocf</code> — create</li>
        <li><code>GET /ocf/:id</code> — read</li>
        <li><code>PUT /ocf/:id</code> — update</li>
        <li><code>DELETE /ocf/:id</code> — delete</li>
        <li><code>GET /ocf/:id/pdf</code> — download PDF for a record</li>
        <li><code>POST /ocf/download</code> — download PDF without saving</li>
      </ul>
    </div>

    <form method="POST" action="/ocf/download">
      <fieldset>
        <legend>Control</legend>
        <div class="grid">
          <label>OTC Number <input name="otcNumber" value="OTC-2026-00001" /></label>
          <label>Date Filed <input name="dateFiled" placeholder="MM/DD/YYYY" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>1. OTA Information</legend>
        <div class="grid">
          <label>OTA Control Number <input name="otaControlNumber" /></label>
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
        </div>
      </fieldset>

      <fieldset>
        <legend>3. Approved Schedule</legend>
        <div class="grid">
          <label>Date of Overtime <input name="dateOfOvertime" /></label>
          <label>Day(s) of the Week <input name="daysOfWeek" /></label>
        </div>
        <div class="grid three">
          <label>Time In <input name="timeIn" /></label>
          <label>Time Out <input name="timeOut" /></label>
          <label>Approved Total Hours <input name="approvedTotalHours" /></label>
        </div>
        <label style="margin-top:10px">Purpose / Justification
          <textarea name="purposeJustification"></textarea>
        </label>
      </fieldset>

      <fieldset>
        <legend>4. Reason for Cancellation</legend>
        <label>Reason <textarea name="reasonForCancellation"></textarea></label>
      </fieldset>

      <fieldset>
        <legend>5. Requested By</legend>
        <div class="grid">
          <label>Requested By <input name="requestedBy" /></label>
          <label>Position / Designation <input name="requestedByPosition" /></label>
          <label>Office / Department <input name="requestedByOffice" /></label>
          <label>Date Requested <input name="dateRequested" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>6. Approved By</legend>
        <div class="grid">
          <label>Approved By <input name="approvedBy" /></label>
          <label>Position / Designation <input name="approvedByPosition" /></label>
          <label>Office / Department <input name="approvedByOffice" /></label>
          <label>Date Approved <input name="approvedByDate" /></label>
        </div>
      </fieldset>

      <div class="actions">
        <button type="submit">Download PDF</button>
        <button type="submit" formaction="/ocf" formmethod="post" class="secondary">Save Record</button>
      </div>
    </form>
  </main>
</body>
</html>`
}

/** Form UI */
ocf.get('/form', (c) => c.html(formPage()))
ocf.get('/ui', (c) => c.html(formPage()))

/** PDF without saving */
ocf.get('/download', async (c) => pdfResponse(parseOcfData(c.req.query())))
ocf.post('/download', async (c) => pdfResponse(await readBody(c)))

/** LIST */
ocf.get('/', (c) => c.json({ data: listOcf() }))

/** CREATE */
ocf.post('/', async (c) => {
  const data = await readBody(c)
  const record = createOcf(data)
  const accept = c.req.header('accept') || ''
  if (accept.includes('text/html') || (c.req.header('content-type') || '').includes('form')) {
    return c.redirect(`/ocf/${record.id}/pdf`)
  }
  return c.json({ data: record }, 201)
})

/** READ */
ocf.get('/:id', (c) => {
  const record = getOcf(c.req.param('id'))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: record })
})

/** UPDATE (full replace of provided form fields) */
ocf.put('/:id', async (c) => {
  const record = updateOcf(c.req.param('id'), await readBody(c))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: record })
})

/** PATCH (only keys present in the body are updated) */
ocf.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = getOcf(id)
  if (!existing) return c.json({ error: 'Not found' }, 404)
  const patch = await readBody(c, { sparse: true })
  const record = updateOcf(id, { ...existing, ...patch })
  return c.json({ data: record })
})

/** DELETE */
ocf.delete('/:id', (c) => {
  const ok = deleteOcf(c.req.param('id'))
  if (!ok) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

/** PDF for saved record */
ocf.get('/:id/pdf', async (c) => {
  const record = getOcf(c.req.param('id'))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return pdfResponse(record)
})

export default ocf
