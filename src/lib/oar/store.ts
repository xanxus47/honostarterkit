import type { OarFormData, OarRecord } from './types'

/** In-memory store for local/dev. Replace with D1/KV/Neon for production. */
const records = new Map<string, OarRecord>()
let seq = 1

function nowIso() {
  return new Date().toISOString()
}

function nextControlNumber() {
  const year = new Date().getFullYear()
  const n = String(seq++).padStart(5, '0')
  return `OTAR-${year}-${n}`
}

export function listOar(): OarRecord[] {
  return [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getOar(id: string): OarRecord | undefined {
  return records.get(id)
}

export function createOar(data: OarFormData): OarRecord {
  const id = crypto.randomUUID()
  const ts = nowIso()
  const record: OarRecord = {
    ...data,
    id,
    controlNumber: data.controlNumber?.trim() || nextControlNumber(),
    createdAt: ts,
    updatedAt: ts,
  }
  records.set(id, record)
  return record
}

export function updateOar(id: string, data: OarFormData): OarRecord | undefined {
  const existing = records.get(id)
  if (!existing) return undefined
  const merged: OarFormData = { ...existing }
  for (const [key, value] of Object.entries(data) as [keyof OarFormData, string | undefined][]) {
    if (value !== undefined) merged[key] = value
  }
  const record: OarRecord = {
    ...merged,
    id: existing.id,
    controlNumber: merged.controlNumber?.trim() || existing.controlNumber,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  }
  records.set(id, record)
  return record
}

export function deleteOar(id: string): boolean {
  return records.delete(id)
}
