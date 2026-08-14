import type { AcrFormData, AcrRecord } from './types'

/** In-memory store for local/dev. Replace with D1/KV/Neon for production. */
const records = new Map<string, AcrRecord>()
let seq = 1

function nowIso() {
  return new Date().toISOString()
}

function nextControlNumber() {
  const year = new Date().getFullYear()
  const n = String(seq++).padStart(5, '0')
  return `ACR-${year}-${n}`
}

export function listAcr(): AcrRecord[] {
  return [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getAcr(id: string): AcrRecord | undefined {
  return records.get(id)
}

export function createAcr(data: AcrFormData): AcrRecord {
  const id = crypto.randomUUID()
  const ts = nowIso()
  const record: AcrRecord = {
    ...data,
    id,
    correctionRequestNo: data.correctionRequestNo?.trim() || nextControlNumber(),
    createdAt: ts,
    updatedAt: ts,
  }
  records.set(id, record)
  return record
}

export function updateAcr(id: string, data: AcrFormData): AcrRecord | undefined {
  const existing = records.get(id)
  if (!existing) return undefined
  const merged: AcrFormData = { ...existing }
  for (const [key, value] of Object.entries(data) as [keyof AcrFormData, AcrFormData[keyof AcrFormData]][]) {
    if (value !== undefined) merged[key] = value as never
  }
  const record: AcrRecord = {
    ...merged,
    id: existing.id,
    correctionRequestNo: merged.correctionRequestNo?.trim() || existing.correctionRequestNo,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  }
  records.set(id, record)
  return record
}

export function deleteAcr(id: string): boolean {
  return records.delete(id)
}
