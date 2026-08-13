import type { DtrFormData, DtrRecord } from './types'

/** In-memory store for local/dev. Replace with D1/KV/Neon for production. */
const records = new Map<string, DtrRecord>()
let seq = 1

function nowIso() {
  return new Date().toISOString()
}

function nextControlNumber() {
  const year = new Date().getFullYear()
  const n = String(seq++).padStart(5, '0')
  return `DTR-${year}-${n}`
}

export function listDtr(): DtrRecord[] {
  return [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getDtr(id: string): DtrRecord | undefined {
  return records.get(id)
}

export function createDtr(data: DtrFormData): DtrRecord {
  const id = crypto.randomUUID()
  const ts = nowIso()
  const record: DtrRecord = {
    ...data,
    id,
    controlNumber: data.controlNumber?.trim() || nextControlNumber(),
    createdAt: ts,
    updatedAt: ts,
  }
  records.set(id, record)
  return record
}

export function updateDtr(id: string, data: DtrFormData): DtrRecord | undefined {
  const existing = records.get(id)
  if (!existing) return undefined
  const merged: DtrFormData = { ...existing }
  for (const [key, value] of Object.entries(data) as [keyof DtrFormData, DtrFormData[keyof DtrFormData]][]) {
    if (value !== undefined) merged[key] = value as never
  }
  const record: DtrRecord = {
    ...merged,
    id: existing.id,
    controlNumber: merged.controlNumber?.trim() || existing.controlNumber,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  }
  records.set(id, record)
  return record
}

export function deleteDtr(id: string): boolean {
  return records.delete(id)
}
