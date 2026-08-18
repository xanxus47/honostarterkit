import { Hono, type Context } from 'hono'
import logoBytes from '../../assets/LGU-otaf.png'
import { generateOtafPdf } from '../lib/otaf/generate-otaf'
import { createOtaf, deleteOtaf, getOtaf, listOtaf, updateOtaf } from '../lib/otaf/store'
import type { EmploymentStatus, OtafFormData } from '../lib/otaf/types'

const otaf = new Hono()

const FIELD_KEYS: (keyof OtafFormData)[] = [
  'controlNumber',
  'dateRequested',
  'verificationCode',
  'verificationUrl',
  'employeeName',
  'employeeId',
  'position',
  'officeDepartment',
  'employmentStatus',
  'employmentStatusOther',
  'dateOfOvertime',
  'timeIn',
  'timeOut',
  'estimatedTotalHours',
  'purposeJustification',
  'activityProject',
  'fundingSource',
  'supervisorName',
  'supervisorPosition',
  'supervisorDate',
  'departmentHeadName',
  'departmentHeadPosition',
  'departmentHeadDate',
  'hrmoName',
  'hrmoPosition',
  'hrmoDate',
  'employeeSignatureName',
  'employeeSignatureDate',
  'payrollReferenceNo',
  'payrollDatePosted',
  'payrollEncodedBy',
  'payrollCheckedBy',
  'payrollApprovedBy',
]

function pick(form: FormData | URLSearchParams, key: string): string | undefined {
  const value = form.get(key)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function parseEmploymentStatus(value: string | undefined): EmploymentStatus | undefined {
  if (
    value === 'permanent' ||
    value === 'jobOrder' ||
    value === 'contractual' ||
    value === 'others'
  ) {
    return value
  }
  return undefined
}

function parseOtafData(
  source: FormData | URLSearchParams | Record<string, unknown>,
  opts?: { sparse?: boolean },
): OtafFormData {
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

  const data: OtafFormData = {}
  for (const key of FIELD_KEYS) {
    if (sparse && !hasKey(key)) continue
    if (key === 'employmentStatus') {
      data.employmentStatus = parseEmploymentStatus(get(key))
      continue
    }
    data[key] = get(key) as never
  }
  return data
}

async function readBody(c: Context, opts?: { sparse?: boolean }): Promise<OtafFormData> {
  const contentType = c.req.header('content-type') || ''
  if (contentType.includes('application/json')) {
    return parseOtafData((await c.req.json()) as Record<string, unknown>, opts)
  }
  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    return parseOtafData(await c.req.formData(), opts)
  }
  return parseOtafData(c.req.query(), opts)
}

function formPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OTAF Generator</title>
  <style>
    :root {
      --navy: #0d2f5b;
      --blue: #1a4f8a;
      --line: #d7e2ef;
      --bg: #f3f6fa;
      --text: #152033;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(26,79,138,.12), transparent 40%),
        linear-gradient(180deg, #eef3f9 0%, var(--bg) 100%);
      color: var(--text);
      min-height: 100vh;
    }
    main {
      max-width: 920px;
      margin: 0 auto;
      padding: 28px 18px 48px;
    }
    h1 {
      margin: 0 0 6px;
      color: var(--navy);
      font-size: 1.55rem;
      letter-spacing: .02em;
    }
    .sub { margin: 0 0 22px; color: #4a5a70; font-size: .95rem; }
    form {
      background: rgba(255,255,255,.92);
      border: 1px solid var(--line);
      padding: 22px;
    }
    fieldset {
      border: 1px solid var(--line);
      margin: 0 0 16px;
      padding: 14px 14px 6px;
    }
    legend {
      padding: 0 8px;
      color: var(--navy);
      font-weight: 700;
      font-size: .85rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    label {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-size: .82rem;
      font-weight: 600;
      color: #334155;
      margin-bottom: 10px;
    }
    input, select, textarea {
      font: inherit;
      font-weight: 400;
      border: 1px solid #c5d2e3;
      padding: 8px 10px;
      background: #fff;
      color: var(--text);
    }
    textarea { min-height: 72px; resize: vertical; }
    .status {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 18px;
      margin: 4px 0 12px;
      font-size: .85rem;
      font-weight: 500;
    }
    .status label {
      flex-direction: row;
      align-items: center;
      gap: 6px;
      margin: 0;
      font-weight: 500;
    }
    .actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    button, .secondary {
      appearance: none;
      border: 0;
      background: var(--navy);
      color: #fff;
      padding: 11px 18px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      font-size: .9rem;
    }
    .secondary { background: #5b6b82; }
    @media (max-width: 720px) {
      .grid, .grid.three { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <h1>Overtime Authorization Form (OTAF)</h1>
    <p class="sub">Fill in the details below, then save a record or download the official PDF.</p>
    <form method="POST" action="/otaf/download">
      <fieldset>
        <legend>Control</legend>
        <div class="grid">
          <label>OTA Control Number
            <input name="controlNumber" placeholder="OTA-2026-000001" value="OTA-2026-000001" />
          </label>
          <label>Date Requested
            <input name="dateRequested" placeholder="MM/DD/YYYY" />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Employee Information</legend>
        <div class="grid">
          <label>1. Employee Name
            <input name="employeeName" required />
          </label>
          <label>2. Employee ID
            <input name="employeeId" />
          </label>
          <label>3. Position
            <input name="position" />
          </label>
          <label>4. Office / Department
            <input name="officeDepartment" />
          </label>
        </div>
        <div class="status">
          <span style="font-weight:700;color:var(--navy)">5. Employment Status</span>
          <label><input type="radio" name="employmentStatus" value="permanent" checked /> Permanent</label>
          <label><input type="radio" name="employmentStatus" value="jobOrder" /> Job Order</label>
          <label><input type="radio" name="employmentStatus" value="contractual" /> Contractual</label>
          <label><input type="radio" name="employmentStatus" value="others" /> Others</label>
        </div>
        <div class="grid">
          <label>Others (specify)
            <input name="employmentStatusOther" />
          </label>
          <label>6. Date of Overtime
            <input name="dateOfOvertime" placeholder="MM/DD/YYYY" />
          </label>
          <label>7. Time In
            <input name="timeIn" placeholder="05:00 PM" />
          </label>
          <label>8. Time Out
            <input name="timeOut" placeholder="09:00 PM" />
          </label>
          <label>9. Estimated Total Hours
            <input name="estimatedTotalHours" placeholder="04:00" />
          </label>
        </div>
        <label>10. Purpose / Justification
          <textarea name="purposeJustification"></textarea>
        </label>
        <div class="grid">
          <label>11. Activity / Project
            <textarea name="activityProject"></textarea>
          </label>
          <label>12. Funding Source
            <textarea name="fundingSource"></textarea>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Approvals</legend>
        <div class="grid three">
          <label>13. Supervisor Name
            <input name="supervisorName" />
          </label>
          <label>Supervisor Position
            <input name="supervisorPosition" />
          </label>
          <label>Supervisor Date
            <input name="supervisorDate" />
          </label>
          <label>14. Department Head Name
            <input name="departmentHeadName" />
          </label>
          <label>Dept Head Position
            <input name="departmentHeadPosition" />
          </label>
          <label>Dept Head Date
            <input name="departmentHeadDate" />
          </label>
          <label>15. HRMO Name
            <input name="hrmoName" />
          </label>
          <label>HRMO Position
            <input name="hrmoPosition" />
          </label>
          <label>HRMO Date
            <input name="hrmoDate" />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Employee Signature & Verification</legend>
        <div class="grid">
          <label>16. Employee Signature Name
            <input name="employeeSignatureName" />
          </label>
          <label>Employee Signature Date
            <input name="employeeSignatureDate" />
          </label>
          <label>Verification Code
            <input name="verificationCode" placeholder="Auto from control no. if blank" />
          </label>
          <label>Verification URL (QR)
            <input name="verificationUrl" placeholder="https://hr.magsaysay.gov.ph/verify/..." />
          </label>
        </div>
      </fieldset>

      <div class="actions">
        <button type="submit">Download PDF</button>
        <button type="submit" formaction="/otaf" formmethod="post" class="secondary">Save Record</button>
        <button type="reset" class="secondary">Clear</button>
      </div>
    </form>
  </main>
</body>
</html>`
}

async function pdfResponse(data: OtafFormData) {
  const bytes = await generateOtafPdf(data, logoBytes)
  const filename = `${(data.controlNumber || 'OTAF').replace(/[^\w.-]+/g, '_')}.pdf`
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

otaf.get('/form', (c) => c.html(formPage()))
otaf.get('/ui', (c) => c.html(formPage()))

otaf.get('/download', async (c) => pdfResponse(parseOtafData(c.req.query())))
otaf.post('/download', async (c) => pdfResponse(await readBody(c)))

otaf.get('/', (c) => {
  const accept = c.req.header('accept') || ''
  if (accept.includes('text/html') && !accept.includes('application/json')) {
    return c.redirect('/otaf/form')
  }
  return c.json({ data: listOtaf() })
})

otaf.post('/', async (c) => {
  const data = await readBody(c)
  const record = createOtaf(data)
  const accept = c.req.header('accept') || ''
  if (accept.includes('text/html') || (c.req.header('content-type') || '').includes('form')) {
    return c.redirect(`/otaf/${record.id}/pdf`)
  }
  return c.json({ data: record }, 201)
})

otaf.get('/:id', (c) => {
  const record = getOtaf(c.req.param('id'))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: record })
})

otaf.put('/:id', async (c) => {
  const record = updateOtaf(c.req.param('id'), await readBody(c))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: record })
})

otaf.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = getOtaf(id)
  if (!existing) return c.json({ error: 'Not found' }, 404)
  const patch = await readBody(c, { sparse: true })
  const record = updateOtaf(id, { ...existing, ...patch })
  return c.json({ data: record })
})

otaf.delete('/:id', (c) => {
  const ok = deleteOtaf(c.req.param('id'))
  if (!ok) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

otaf.get('/:id/pdf', async (c) => {
  const record = getOtaf(c.req.param('id'))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return pdfResponse(record)
})

export default otaf
