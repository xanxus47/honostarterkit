import type { LocatorFormData, LocatorRecord } from './types'

/** In-memory store for local/dev. Replace with D1/KV/Neon for production. */
const records = new Map<string, LocatorRecord>()
let seq = 1

function nowIso() {
  return new Date().toISOString()
}

function nextControlNumber() {
  const year = new Date().getFullYear()
  const n = String(seq++).padStart(5, '0')
  return `LOC-${year}-${n}`
}

function nextCertificateNumber() {
  const year = new Date().getFullYear()
  const n = String(seq).padStart(5, '0')
  return `COA-${year}-${n}`
}

export function listLocator(): LocatorRecord[] {
  return [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getLocator(id: string): LocatorRecord | undefined {
  return records.get(id)
}

export function createLocator(data: LocatorFormData): LocatorRecord {
  const id = crypto.randomUUID()
  const ts = nowIso()
  const locatorControlNo = data.locatorControlNo?.trim() || nextControlNumber()
  const record: LocatorRecord = {
    ...data,
    id,
    locatorControlNo,
    locatorSlipNo: data.locatorSlipNo?.trim() || locatorControlNo,
    certificateControlNo: data.certificateControlNo?.trim() || nextCertificateNumber(),
    createdAt: ts,
    updatedAt: ts,
  }
  records.set(id, record)
  return record
}

export function updateLocator(id: string, data: LocatorFormData): LocatorRecord | undefined {
  const existing = records.get(id)
  if (!existing) return undefined
  const merged: LocatorFormData = { ...existing }
  for (const [key, value] of Object.entries(data) as [keyof LocatorFormData, LocatorFormData[keyof LocatorFormData]][]) {
    if (value !== undefined) merged[key] = value as never
  }
  const record: LocatorRecord = {
    ...merged,
    id: existing.id,
    locatorControlNo: merged.locatorControlNo?.trim() || existing.locatorControlNo,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  }
  records.set(id, record)
  return record
}

export function deleteLocator(id: string): boolean {
  return records.delete(id)
}
