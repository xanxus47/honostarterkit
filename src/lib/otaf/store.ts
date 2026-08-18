import type { OtafFormData, OtafRecord } from './types'

/** In-memory store for local/dev. Replace with D1/KV/Neon for production. */
const records = new Map<string, OtafRecord>()
let seq = 1

function nowIso() {
  return new Date().toISOString()
}

function nextControlNumber() {
  const year = new Date().getFullYear()
  const n = String(seq++).padStart(5, '0')
  return `OTA-${year}-${n}`
}

export function listOtaf(): OtafRecord[] {
  return [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getOtaf(id: string): OtafRecord | undefined {
  return records.get(id)
}

export function createOtaf(data: OtafFormData): OtafRecord {
  const id = crypto.randomUUID()
  const ts = nowIso()
  const record: OtafRecord = {
    ...data,
    id,
    controlNumber: data.controlNumber?.trim() || nextControlNumber(),
    createdAt: ts,
    updatedAt: ts,
  }
  records.set(id, record)
  return record
}

export function updateOtaf(id: string, data: OtafFormData): OtafRecord | undefined {
  const existing = records.get(id)
  if (!existing) return undefined
  const merged: OtafFormData = { ...existing }
  for (const [key, value] of Object.entries(data) as [keyof OtafFormData, OtafFormData[keyof OtafFormData]][]) {
    if (value !== undefined) merged[key] = value as never
  }
  const record: OtafRecord = {
    ...merged,
    id: existing.id,
    controlNumber: merged.controlNumber?.trim() || existing.controlNumber,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  }
  records.set(id, record)
  return record
}

export function deleteOtaf(id: string): boolean {
  return records.delete(id)
}
