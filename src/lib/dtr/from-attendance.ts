import { punchesForEmployee, type AttendancePunch } from './punch-store'
import type { DtrDayEntry, DtrFormData } from './types'

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
const TZ = 'Asia/Manila'

/** Official 8-hour day: 08:00–12:00 and 13:00–17:00. Lunch 12:00–13:00 is unpaid. */
const AM_START = 8 * 60
const AM_END = 12 * 60
const PM_START = 13 * 60
const PM_END = 17 * 60
const LUNCH_MINUTES = 60
const SCHEDULED_MINUTES = AM_END - AM_START + (PM_END - PM_START)

type ClockSlots = {
  amIn?: number
  amOut?: number
  pmIn?: number
  pmOut?: number
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatClock(minutes: number | undefined): string | undefined {
  if (minutes === undefined) return undefined
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`
}

function formatHours(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${pad2(minutes % 60)}`
}

function manilaParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value || ''
  const year = Number(get('year'))
  const month = Number(get('month'))
  const day = Number(get('day'))
  const hour = Number(get('hour'))
  const minute = Number(get('minute'))
  return { year, month, day, hour, minute, ymd: `${year}-${pad2(month)}-${pad2(day)}` }
}

function parseYmd(value: string | undefined): { year: number; month: number; day: number } | undefined {
  if (!value) return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!m) return undefined
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

export function dayNameFor(periodFrom: string | undefined, dayOfMonth: number): string {
  const parsed = parseYmd(periodFrom)
  if (!parsed) return ''
  const date = new Date(parsed.year, parsed.month - 1, dayOfMonth)
  if (date.getMonth() !== parsed.month - 1) return ''
  return DAY_NAMES[date.getDay()]!
}

function inPeriod(ymd: string, periodFrom?: string, periodTo?: string) {
  if (periodFrom && ymd < periodFrom.slice(0, 10)) return false
  if (periodTo && ymd > periodTo.slice(0, 10)) return false
  return true
}

/** Map a day's punch times (minutes from midnight) into AM/PM IN/OUT. Overtime is never assigned. */
export function classifyPunches(times: number[]): ClockSlots {
  const unique = [...new Set(times)].sort((a, b) => a - b)
  const morning = unique.filter((t) => t < AM_END)
  const midday = unique.filter((t) => t >= AM_END && t < PM_START)
  const afternoon = unique.filter((t) => t >= PM_START)

  const slots: ClockSlots = {}
  if (morning.length) {
    slots.amIn = morning[0]
    if (morning.length >= 2) slots.amOut = morning[morning.length - 1]
  }

  let leftoverMid = midday
  if (!slots.amOut && leftoverMid.length) {
    slots.amOut = leftoverMid[0]
    leftoverMid = leftoverMid.slice(1)
  }
  if (leftoverMid.length) {
    slots.pmIn = leftoverMid[0]
    if (leftoverMid.length >= 2) slots.pmOut = leftoverMid[leftoverMid.length - 1]
  }

  if (afternoon.length) {
    if (!slots.pmIn) {
      if (afternoon.length >= 2) {
        slots.pmIn = afternoon[0]
        slots.pmOut = afternoon[afternoon.length - 1]
      } else {
        slots.pmOut = afternoon[0]
      }
    } else {
      slots.pmOut = afternoon[afternoon.length - 1]
      if (slots.pmIn === slots.pmOut) slots.pmIn = undefined
    }
  }

  return slots
}

function workedMinutes(slots: ClockSlots): number | undefined {
  const morning =
    slots.amIn !== undefined && slots.amOut !== undefined ? Math.max(0, slots.amOut - slots.amIn) : 0
  const afternoon =
    slots.pmIn !== undefined && slots.pmOut !== undefined ? Math.max(0, slots.pmOut - slots.pmIn) : 0
  if (morning || afternoon) return morning + afternoon
  if (slots.amIn !== undefined && slots.pmOut !== undefined && slots.amOut === undefined && slots.pmIn === undefined) {
    return Math.max(0, slots.pmOut - slots.amIn - LUNCH_MINUTES)
  }
  return undefined
}

export function buildDaysFromPunches(
  punches: AttendancePunch[],
  periodFrom?: string,
  periodTo?: string,
): DtrDayEntry[] {
  const byDate = new Map<string, number[]>()
  for (const punch of punches) {
    const at = new Date(punch.punchedAt)
    if (Number.isNaN(at.getTime())) continue
    const parts = manilaParts(at)
    if (!inPeriod(parts.ymd, periodFrom, periodTo)) continue
    const list = byDate.get(parts.ymd) || []
    list.push(parts.hour * 60 + parts.minute)
    byDate.set(parts.ymd, list)
  }

  const start = parseYmd(periodFrom)
  if (!start) return []

  const rows: DtrDayEntry[] = []
  for (let day = 1; day <= 31; day++) {
    const date = new Date(start.year, start.month - 1, day)
    if (date.getMonth() !== start.month - 1) break
    const ymd = `${start.year}-${pad2(start.month)}-${pad2(day)}`
    const inCovered = inPeriod(ymd, periodFrom, periodTo)
    const times = inCovered ? byDate.get(ymd) : undefined
    const slots = times?.length ? classifyPunches(times) : {}
    const worked = times?.length ? workedMinutes(slots) : undefined
    const undertime =
      worked === undefined ? undefined : String(Math.max(0, SCHEDULED_MINUTES - worked))

    rows.push({
      day,
      dayName: dayNameFor(periodFrom, day),
      amIn: formatClock(slots.amIn),
      amOut: formatClock(slots.amOut),
      pmIn: formatClock(slots.pmIn),
      pmOut: formatClock(slots.pmOut),
      undertimeMinutes: undertime,
      totalHoursWorked: worked === undefined ? undefined : formatHours(worked),
    })
  }
  return rows
}

export function applyAttendanceToDtr(data: DtrFormData, punches: AttendancePunch[]): DtrFormData {
  if (!data.employeeId || !data.periodFrom) return data
  const days = buildDaysFromPunches(punches, data.periodFrom, data.periodTo)
  if (!days.length) return data

  let workedTotal = 0
  let undertimeTotal = 0
  let daysWithTime = 0
  for (const row of days) {
    if (row.amIn || row.amOut || row.pmIn || row.pmOut) daysWithTime += 1
    if (row.totalHoursWorked) {
      const [h, m] = row.totalHoursWorked.split(':').map(Number)
      workedTotal += (h || 0) * 60 + (m || 0)
    }
    if (row.undertimeMinutes) undertimeTotal += Number(row.undertimeMinutes) || 0
  }

  return {
    ...data,
    days,
    numberOfDays: data.numberOfDays || String(daysWithTime),
    totalHoursWorked: data.totalHoursWorked || (daysWithTime ? formatHours(workedTotal) : data.totalHoursWorked),
    totalUndertime: data.totalUndertime || (daysWithTime ? String(undertimeTotal) : data.totalUndertime),
  }
}

export function shouldFillFromAttendance(data: DtrFormData): boolean {
  if (data.fillFromAttendance === false) return false
  if (data.fillFromAttendance === true) return true
  return !data.days?.some((row) => row.amIn || row.amOut || row.pmIn || row.pmOut || row.otIn || row.otOut)
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function str(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

export function normalizePunchedAt(raw: string): string {
  const t = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(t) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(t)) {
    return `${t.replace(' ', 'T')}+08:00`
  }
  return t.replace(' ', 'T')
}

function punchFromRecord(row: Record<string, unknown>): AttendancePunch | undefined {
  const employeeId =
    str(row.employeeId) ||
    str(row.pin) ||
    str(row.PIN) ||
    str(row.emp_code) ||
    str(row.empCode) ||
    str(row.user_id) ||
    str(row.userId)
  const punchedAt =
    str(row.punchedAt) ||
    str(row.time) ||
    str(row.TIME) ||
    str(row.punch_time) ||
    str(row.punchTime) ||
    str(row.timestamp)
  if (!employeeId || !punchedAt) return undefined
  return { employeeId, punchedAt: normalizePunchedAt(punchedAt) }
}

/** Accepts our JSON shape or common ZKTeco / BioTime punch payloads. */
export function parsePunchPayload(raw: unknown): AttendancePunch[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === 'object' && item ? punchFromRecord(item as Record<string, unknown>) : undefined))
      .filter((p): p is AttendancePunch => Boolean(p))
  }
  const obj = asRecord(raw)
  if (!obj) return []
  const nested = obj.punches ?? obj.data ?? obj.transactions ?? obj.items
  if (Array.isArray(nested)) return parsePunchPayload(nested)
  const single = punchFromRecord(obj)
  return single ? [single] : []
}

export function withAttendance(data: DtrFormData, extraPunches: AttendancePunch[] = []): DtrFormData {
  const { fillFromAttendance: _flag, ...rest } = data
  if (!shouldFillFromAttendance(data)) return rest
  const stored = rest.employeeId ? punchesForEmployee(rest.employeeId) : []
  return applyAttendanceToDtr(rest, [...stored, ...extraPunches])
}
