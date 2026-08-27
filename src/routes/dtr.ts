import { Hono, type Context } from 'hono'
import logoBytes from '../../assets/LGU-otaf.png'
import { getSql, type AppBindings } from '../lib/db'
import { parsePunchPayload, withAttendance } from '../lib/dtr/from-attendance'
import { generateDtrPdf } from '../lib/dtr/generate-dtr'
import { addPunches, listPunches } from '../lib/dtr/punch-store'
import { createDtr, deleteDtr, getDtr, listDtr, updateDtr } from '../lib/dtr/store'
import type { DtrDayEntry, DtrFormData, EmploymentStatus } from '../lib/dtr/types'

const dtr = new Hono<{ Bindings: AppBindings }>()

type DtrContext = Context<{ Bindings: AppBindings }>

function sqlOf(c: DtrContext) {
  return c.env.DATABASE_URL ? getSql(c.env.DATABASE_URL) : undefined
}

const FIELD_KEYS: (keyof DtrFormData)[] = [
  'controlNumber',
  'dateIssued',
  'employeeName',
  'employeeId',
  'position',
  'officeDepartment',
  'employmentStatus',
  'payrollGroup',
  'periodFrom',
  'periodTo',
  'numberOfDays',
  'totalHoursWorked',
  'totalOvertime',
  'totalUndertime',
  'totalMinutesLate',
  'employeeSignatureName',
  'employeeSignatureDate',
  'supervisorSignatureName',
  'supervisorPosition',
  'supervisorDate',
  'departmentHeadSignatureName',
  'departmentHeadPosition',
  'departmentHeadDate',
  'hrmoSignatureName',
  'hrmoDate',
]

function pick(source: FormData | URLSearchParams, key: string): string | undefined {
  const value = source.get(key)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function parseStatus(value: string | undefined): EmploymentStatus | undefined {
  if (value === 'permanent' || value === 'jobOrder' || value === 'contractOfService') return value
  return undefined
}

function parseDays(raw: unknown): DtrDayEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>
    const dayNum = typeof row.day === 'number' ? row.day : Number(row.day)
    return {
      day: Number.isFinite(dayNum) ? dayNum : undefined,
      dayName: typeof row.dayName === 'string' ? row.dayName : undefined,
      amIn: typeof row.amIn === 'string' ? row.amIn : undefined,
      amOut: typeof row.amOut === 'string' ? row.amOut : undefined,
      pmIn: typeof row.pmIn === 'string' ? row.pmIn : undefined,
      pmOut: typeof row.pmOut === 'string' ? row.pmOut : undefined,
      otIn: typeof row.otIn === 'string' ? row.otIn : undefined,
      otOut: typeof row.otOut === 'string' ? row.otOut : undefined,
      undertimeMinutes: typeof row.undertimeMinutes === 'string' ? row.undertimeMinutes : undefined,
      totalHoursWorked: typeof row.totalHoursWorked === 'string' ? row.totalHoursWorked : undefined,
      remarks: typeof row.remarks === 'string' ? row.remarks : undefined,
    }
  })
}

function parseDtrData(
  source: FormData | URLSearchParams | Record<string, unknown>,
  opts?: { sparse?: boolean },
): DtrFormData {
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

  const data: DtrFormData = {}
  for (const key of FIELD_KEYS) {
    if (sparse && !hasKey(key)) continue
    if (key === 'employmentStatus') {
      data.employmentStatus = parseStatus(get(key))
      continue
    }
    data[key] = get(key)
  }

  if (!(source instanceof FormData || source instanceof URLSearchParams)) {
    if (!sparse || Object.prototype.hasOwnProperty.call(source, 'days')) {
      data.days = parseDays(source.days)
    }
    if (!sparse || Object.prototype.hasOwnProperty.call(source, 'fillFromAttendance')) {
      const flag = source.fillFromAttendance
      if (typeof flag === 'boolean') data.fillFromAttendance = flag
      else if (flag === 'true' || flag === 'on' || flag === '1') data.fillFromAttendance = true
      else if (flag === 'false' || flag === '0') data.fillFromAttendance = false
    }
  } else if (!sparse && source.has('fillFromAttendance')) {
    const flags = source.getAll('fillFromAttendance').map(String)
    data.fillFromAttendance = flags.some((v) => v === 'true' || v === 'on' || v === '1')
  }

  return data
}

async function readBody(c: DtrContext, opts?: { sparse?: boolean }): Promise<DtrFormData> {
  const contentType = c.req.header('content-type') || ''
  let data: DtrFormData
  let inline: ReturnType<typeof parsePunchPayload> = []
  const sql = sqlOf(c)
  if (contentType.includes('application/json')) {
    const raw = (await c.req.json()) as Record<string, unknown>
    data = parseDtrData(raw, opts)
    inline = parsePunchPayload(raw.punches ?? [])
    if (inline.length && sql) await addPunches(sql, inline)
  } else if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    data = parseDtrData(await c.req.formData(), opts)
  } else {
    data = parseDtrData(c.req.query(), opts)
  }

  if (opts?.sparse && data.fillFromAttendance !== true) {
    const { fillFromAttendance: _flag, ...rest } = data
    return rest
  }
  return withAttendance(data, inline, sql)
}

async function pdfResponse(data: DtrFormData) {
  const bytes = await generateDtrPdf(data, logoBytes)
  const filename = `${(data.controlNumber || 'DTR').replace(/[^\w.-]+/g, '_')}.pdf`
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
  <title>DTR Generator</title>
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
    input, select {
      font: inherit; font-weight: 400; border: 1px solid #c5d2e3; padding: 8px 10px; background: #fff;
    }
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
    <h1>Daily Time Record (DTR)</h1>
    <p class="sub">Fill employee and period, save a record, or download the A4 PDF. Clock-ins from ZKTeco fill DATE, DAY, AM/PM, hours, and undertime. Overtime stays blank.</p>

    <div class="panel">
      <strong>CRUD API</strong>
      <ul>
        <li><code>GET /dtr</code> — list</li>
        <li><code>POST /dtr</code> — create (JSON may include <code>days[]</code>)</li>
        <li><code>GET /dtr/:id</code> — read</li>
        <li><code>PUT /dtr/:id</code> — update</li>
        <li><code>PATCH /dtr/:id</code> — partial update</li>
        <li><code>DELETE /dtr/:id</code> — delete</li>
        <li><code>GET /dtr/:id/pdf</code> — PDF for saved record</li>
        <li><code>POST /dtr/download</code> — PDF without saving</li>
        <li><code>GET /dtr/attendance/punches</code> — punches from Neon (<code>user_id</code> 1 and 2)</li>
        <li><code>GET /dtr/attendance/preview?employeeId=2&amp;periodFrom=2026-08-01&amp;periodTo=2026-08-31</code> — preview auto-filled rows</li>
      </ul>
    </div>

    <form method="POST" action="/dtr/download">
      <fieldset>
        <legend>Control</legend>
        <div class="grid">
          <label>DTR Control Number <input name="controlNumber" value="DTR-2026-00001" /></label>
          <label>Date <input name="dateIssued" placeholder="YYYY-MM-DD" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>1. Employee Information</legend>
        <div class="grid">
          <label>Employee Name <input name="employeeName" required /></label>
          <label>Employee ID <input name="employeeId" /></label>
          <label>Position <input name="position" /></label>
          <label>Office / Department <input name="officeDepartment" /></label>
          <label>Employment Status
            <select name="employmentStatus">
              <option value="">—</option>
              <option value="permanent">Permanent</option>
              <option value="jobOrder">Job Order</option>
              <option value="contractOfService">Contract of Service</option>
            </select>
          </label>
          <label>Payroll Group <input name="payrollGroup" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Period Covered</legend>
        <div class="grid four">
          <label>From <input name="periodFrom" placeholder="YYYY-MM-DD (blank = month of Date)" /></label>
          <label>To <input name="periodTo" placeholder="YYYY-MM-DD" /></label>
          <label>No. of Days <input name="numberOfDays" /></label>
        </div>
        <input type="hidden" name="fillFromAttendance" value="false" />
        <label style="margin-top:10px;flex-direction:row;align-items:center;font-weight:600;">
          <input type="checkbox" name="fillFromAttendance" value="true" checked />
          Auto-fill DATE, DAY, AM/PM IN-OUT, total hours, and undertime from attendance punches (overtime excluded)
        </label>
      </fieldset>

      <fieldset>
        <legend>3. Summary</legend>
        <div class="grid four">
          <label>Total Hours Worked <input name="totalHoursWorked" /></label>
          <label>Total Overtime <input name="totalOvertime" /></label>
          <label>Total Undertime <input name="totalUndertime" /></label>
          <label>Total Minutes Late <input name="totalMinutesLate" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Signatures</legend>
        <div class="grid">
          <label>Employee Signature Name <input name="employeeSignatureName" /></label>
          <label>Employee Date <input name="employeeSignatureDate" /></label>
          <label>Supervisor Name <input name="supervisorSignatureName" /></label>
          <label>Supervisor Position <input name="supervisorPosition" /></label>
          <label>Dept Head Name <input name="departmentHeadSignatureName" /></label>
          <label>HRMO Name <input name="hrmoSignatureName" /></label>
        </div>
      </fieldset>

      <div class="actions">
        <button type="submit">Download PDF</button>
        <button type="submit" formaction="/dtr" formmethod="post" class="secondary">Save Record</button>
      </div>
    </form>
  </main>
</body>
</html>`
}

dtr.get('/form', (c) => c.html(formPage()))
dtr.get('/ui', (c) => c.html(formPage()))

dtr.get('/download', async (c) =>
  pdfResponse(await withAttendance(parseDtrData(c.req.query()), [], sqlOf(c))),
)
dtr.post('/download', async (c) => pdfResponse(await readBody(c)))

dtr.post('/attendance/punches', async (c) => {
  const sql = sqlOf(c)
  if (!sql) return c.json({ error: 'DATABASE_URL is not configured' }, 500)
  const raw = await c.req.json().catch(() => null)
  const punches = await addPunches(sql, parsePunchPayload(raw))
  return c.json({ data: punches, stored: punches.length }, 201)
})

dtr.get('/attendance/punches', async (c) => {
  const sql = sqlOf(c)
  if (!sql) return c.json({ error: 'DATABASE_URL is not configured' }, 500)
  return c.json({
    data: await listPunches(sql, {
      employeeId: c.req.query('employeeId'),
      from: c.req.query('from'),
      to: c.req.query('to'),
    }),
  })
})

dtr.get('/attendance/preview', async (c) => {
  const employeeId = c.req.query('employeeId')
  const periodFrom = c.req.query('periodFrom')
  if (!employeeId || !periodFrom) {
    return c.json({ error: 'employeeId and periodFrom are required' }, 400)
  }
  const sql = sqlOf(c)
  if (!sql) return c.json({ error: 'DATABASE_URL is not configured' }, 500)
  const data = await withAttendance(
    {
      employeeId,
      periodTo: c.req.query('periodTo'),
      periodFrom,
      fillFromAttendance: true,
    },
    [],
    sql,
  )
  return c.json({ data })
})

dtr.get('/', (c) => c.json({ data: listDtr() }))

dtr.post('/', async (c) => {
  const data = await readBody(c)
  const record = createDtr(data)
  const accept = c.req.header('accept') || ''
  if (accept.includes('text/html') || (c.req.header('content-type') || '').includes('form')) {
    return c.redirect(`/dtr/${record.id}/pdf`)
  }
  return c.json({ data: record }, 201)
})

dtr.get('/:id', (c) => {
  const record = getDtr(c.req.param('id'))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: record })
})

dtr.put('/:id', async (c) => {
  const record = updateDtr(c.req.param('id'), await readBody(c))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: record })
})

dtr.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = getDtr(id)
  if (!existing) return c.json({ error: 'Not found' }, 404)
  const patch = await readBody(c, { sparse: true })
  const merged = { ...existing, ...patch }
  const record = updateDtr(
    id,
    patch.fillFromAttendance === true
      ? await withAttendance({ ...merged, fillFromAttendance: true }, [], sqlOf(c))
      : merged,
  )
  return c.json({ data: record })
})

dtr.delete('/:id', (c) => {
  const ok = deleteDtr(c.req.param('id'))
  if (!ok) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

dtr.get('/:id/pdf', async (c) => {
  const record = getDtr(c.req.param('id'))
  if (!record) return c.json({ error: 'Not found' }, 404)
  return pdfResponse(record)
})

export default dtr
