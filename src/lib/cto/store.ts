import type { CtoFormData, CtoRecord } from './types'

/** In-memory store for local/dev. Replace with D1/KV/Neon for production. */
const records = new Map<string, CtoRecord>()
let seq = 1

function nowIso() {
  return new Date().toISOString()
}

function nextControlNumber() {
  const year = new Date().getFullYear()
  const n = String(seq++).padStart(5, '0')
  return `CTO-${year}-${n}`
}

export function listCto(): CtoRecord[] {
  return [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getCto(id: string): CtoRecord | undefined {
  return records.get(id)
}

export function createCto(data: CtoFormData): CtoRecord {
  const id = crypto.randomUUID()
  const ts = nowIso()
  const record: CtoRecord = {
    ...data,
    id,
    controlNumber: data.controlNumber?.trim() || nextControlNumber(),
    createdAt: ts,
    updatedAt: ts,
  }
  records.set(id, record)
  return record
}

export function updateCto(id: string, data: CtoFormData): CtoRecord | undefined {
  const existing = records.get(id)
  if (!existing) return undefined
  const merged: CtoFormData = { ...existing }
  for (const [key, value] of Object.entries(data) as [keyof CtoFormData, string | undefined][]) {
    if (value !== undefined) merged[key] = value
  }
  const record: CtoRecord = {
    ...merged,
    id: existing.id,
    controlNumber: merged.controlNumber?.trim() || existing.controlNumber,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  }
  records.set(id, record)
  return record
}

export function deleteCto(id: string): boolean {
  return records.delete(id)
}
