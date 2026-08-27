import type { Sql } from '../db'

export type AttendancePunch = {
  employeeId: string
  punchedAt: string
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function periodBounds(from?: string, to?: string): { start?: string; end?: string } {
  const start = from?.trim().slice(0, 10)
  const end = (to || from)?.trim().slice(0, 10)
  return {
    start: start ? `${start}T00:00:00+08:00` : undefined,
    end: end ? `${end}T23:59:59.999+08:00` : undefined,
  }
}

function mapRows(rows: Record<string, unknown>[]): AttendancePunch[] {
  return rows.map((row) => ({
    employeeId: String(row.employee_id),
    punchedAt: toIso(row.punched_at),
  }))
}

export async function addPunches(sql: Sql, incoming: AttendancePunch[]): Promise<AttendancePunch[]> {
  const added: AttendancePunch[] = []
  for (const punch of incoming) {
    const employeeId = punch.employeeId.trim()
    const punchedAt = punch.punchedAt.trim()
    const userId = Number(employeeId)
    if (!employeeId || !punchedAt || !Number.isFinite(userId)) continue
    await sql`
      INSERT INTO attendance (user_id, "timestamp")
      VALUES (${userId}, ${punchedAt}::timestamptz)
    `
    added.push({ employeeId, punchedAt })
  }
  return added
}

export async function listPunches(
  sql: Sql,
  opts?: { employeeId?: string; from?: string; to?: string },
): Promise<AttendancePunch[]> {
  const userId = opts?.employeeId?.trim() ? Number(opts.employeeId.trim()) : undefined
  const { start, end } = periodBounds(opts?.from, opts?.to)
  const hasUser = Number.isFinite(userId)

  if (hasUser && start && end) {
    return mapRows(
      await sql`
        SELECT user_id::text AS employee_id, "timestamp" AS punched_at
        FROM attendance
        WHERE user_id = ${userId}
          AND "timestamp" >= ${start}::timestamptz
          AND "timestamp" <= ${end}::timestamptz
        ORDER BY "timestamp" ASC
      `,
    )
  }
  if (hasUser) {
    return mapRows(
      await sql`
        SELECT user_id::text AS employee_id, "timestamp" AS punched_at
        FROM attendance
        WHERE user_id = ${userId}
        ORDER BY "timestamp" ASC
      `,
    )
  }
  return mapRows(
    await sql`
      SELECT user_id::text AS employee_id, "timestamp" AS punched_at
      FROM attendance
      ORDER BY "timestamp" ASC
    `,
  )
}

export async function punchesForEmployee(
  sql: Sql,
  employeeId: string,
  periodFrom?: string,
  periodTo?: string,
): Promise<AttendancePunch[]> {
  return listPunches(sql, { employeeId, from: periodFrom, to: periodTo })
}

export async function getEmployee(
  sql: Sql,
  employeeId: string,
): Promise<{ name?: string; position?: string } | undefined> {
  const userId = Number(employeeId.trim())
  if (!Number.isFinite(userId)) return undefined
  const rows = await sql`
    SELECT name, position
    FROM employees
    WHERE id = ${userId}
    LIMIT 1
  `
  const row = rows[0]
  if (!row) return undefined
  return {
    name: row.name ? String(row.name) : undefined,
    position: row.position ? String(row.position) : undefined,
  }
}
