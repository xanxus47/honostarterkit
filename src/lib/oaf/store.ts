import type { OafFormData, OafRecord } from './types'

/** In-memory store for local/dev. Replace with D1/KV/Neon for production. */
const records = new Map<string, OafRecord>()
let seq = 1

function nowIso() {
  return new Date().toISOString()
}

function nextControlNumber() {
  const year = new Date().getFullYear()
  const n = String(seq++).padStart(5, '0')
  return `OTA-AM-${year}-${n}`
}

export function listOaf(): OafRecord[] {
  return [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getOaf(id: string): OafRecord | undefined {
  return records.get(id)
}

export function createOaf(data: OafFormData): OafRecord {
  const id = crypto.randomUUID()
  const ts = nowIso()
  const record: OafRecord = {
    ...data,
    id,
    controlNumber: data.controlNumber?.trim() || nextControlNumber(),
    createdAt: ts,
    updatedAt: ts,
  }
  records.set(id, record)
  return record
}

export function updateOaf(id: string, data: OafFormData): OafRecord | undefined {
  const existing = records.get(id)
  if (!existing) return undefined
  const merged: OafFormData = { ...existing }
  for (const [key, value] of Object.entries(data) as [keyof OafFormData, string | undefined][]) {
    if (value !== undefined) merged[key] = value
  }
  const record: OafRecord = {
    ...merged,
    id: existing.id,
    controlNumber: merged.controlNumber?.trim() || existing.controlNumber,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  }
  records.set(id, record)
  return record
}

export function deleteOaf(id: string): boolean {
  return records.delete(id)
}
