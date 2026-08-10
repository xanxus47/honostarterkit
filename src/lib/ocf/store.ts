import type { OcfFormData, OcfRecord } from './types'

/** In-memory store for local/dev. Replace with D1/KV/Neon for production. */
const records = new Map<string, OcfRecord>()
let seq = 1

function nowIso() {
  return new Date().toISOString()
}

function nextOtcNumber() {
  const year = new Date().getFullYear()
  const n = String(seq++).padStart(5, '0')
  return `OTC-${year}-${n}`
}

export function listOcf(): OcfRecord[] {
  return [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getOcf(id: string): OcfRecord | undefined {
  return records.get(id)
}

export function createOcf(data: OcfFormData): OcfRecord {
  const id = crypto.randomUUID()
  const ts = nowIso()
  const record: OcfRecord = {
    ...data,
    id,
    otcNumber: data.otcNumber?.trim() || nextOtcNumber(),
    createdAt: ts,
    updatedAt: ts,
  }
  records.set(id, record)
  return record
}

export function updateOcf(id: string, data: OcfFormData): OcfRecord | undefined {
  const existing = records.get(id)
  if (!existing) return undefined
  const merged: OcfFormData = { ...existing }
  for (const [key, value] of Object.entries(data) as [keyof OcfFormData, string | undefined][]) {
    if (value !== undefined) merged[key] = value
  }
  const record: OcfRecord = {
    ...merged,
    id: existing.id,
    otcNumber: merged.otcNumber?.trim() || existing.otcNumber,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  }
  records.set(id, record)
  return record
}

export function deleteOcf(id: string): boolean {
  return records.delete(id)
}
