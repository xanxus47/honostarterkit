export type AttendancePunch = {
  employeeId: string
  punchedAt: string
}

const punches: AttendancePunch[] = []

export function addPunches(incoming: AttendancePunch[]): AttendancePunch[] {
  const added: AttendancePunch[] = []
  for (const punch of incoming) {
    const employeeId = punch.employeeId.trim()
    const punchedAt = punch.punchedAt.trim()
    if (!employeeId || !punchedAt) continue
    const key = `${employeeId}|${punchedAt}`
    const exists = punches.some((p) => `${p.employeeId}|${p.punchedAt}` === key)
    if (exists) continue
    const row = { employeeId, punchedAt }
    punches.push(row)
    added.push(row)
  }
  return added
}

export function listPunches(opts?: {
  employeeId?: string
  from?: string
  to?: string
}): AttendancePunch[] {
  return punches.filter((p) => {
    if (opts?.employeeId && p.employeeId !== opts.employeeId.trim()) return false
    if (opts?.from && p.punchedAt < opts.from) return false
    if (opts?.to && p.punchedAt > `${opts.to}T23:59:59`) return false
    return true
  })
}

export function punchesForEmployee(employeeId: string): AttendancePunch[] {
  const id = employeeId.trim()
  return punches.filter((p) => p.employeeId === id)
}
