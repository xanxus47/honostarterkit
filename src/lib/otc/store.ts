import type { OtcFormData, OtcRecord } from './types'

/** In-memory store for local/dev. Replace with D1/KV/Neon for production. */
const records = new Map<string, OtcRecord>()
let seq = 1

function nowIso() {
  return new Date().toISOString()
}

function nextControlNumber() {
  const year = new Date().getFullYear()
  const n = String(seq++).padStart(5, '0')
  return `OTC-${year}-${n}`
}

export function listOtc(): OtcRecord[] {
  return [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getOtc(id: string): OtcRecord | undefined {
  return records.get(id)
}

export function createOtc(data: OtcFormData): OtcRecord {
  const id = crypto.randomUUID()
  const ts = nowIso()
  const record: OtcRecord = {
    ...data,
    id,
    controlNumber: data.controlNumber?.trim() || nextControlNumber(),
    createdAt: ts,
    updatedAt: ts,
  }
  records.set(id, record)
  return record
}

export function updateOtc(id: string, data: OtcFormData): OtcRecord | undefined {
  const existing = records.get(id)
  if (!existing) return undefined
  const merged: OtcFormData = { ...existing }
  for (const [key, value] of Object.entries(data) as [keyof OtcFormData, string | undefined][]) {
    if (value !== undefined) merged[key] = value
  }
  const record: OtcRecord = {
    ...merged,
    id: existing.id,
    controlNumber: merged.controlNumber?.trim() || existing.controlNumber,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  }
  records.set(id, record)
  return record
}

export function deleteOtc(id: string): boolean {
  return records.delete(id)
}
