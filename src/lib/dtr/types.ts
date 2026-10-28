import { toBlockLetters, toPrintedName } from '../printed-name'

export type EmploymentStatus = 'permanent' | 'jobOrder' | 'contractOfService'

export type DtrDayEntry = {
  /** Day of month 1–31 */
  day?: number
  /** e.g. MON, TUE */
  dayName?: string
  amIn?: string
  amOut?: string
  pmIn?: string
  pmOut?: string
  otIn?: string
  otOut?: string
  undertimeMinutes?: string
  totalHoursWorked?: string
  remarks?: string
}

export type DtrFormData = {
  controlNumber?: string
  dateIssued?: string

  employeeName?: string
  employeeId?: string
  position?: string
  officeDepartment?: string
  employmentStatus?: EmploymentStatus
  payrollGroup?: string

  periodFrom?: string
  periodTo?: string
  numberOfDays?: string

  /** Up to 31 day rows */
  days?: DtrDayEntry[]

  /** When true, AM/PM, hours, and undertime are built from stored punches. Overtime columns stay empty. */
  fillFromAttendance?: boolean

  totalHoursWorked?: string
  totalOvertime?: string
  totalUndertime?: string
  totalMinutesLate?: string

  employeeSignatureName?: string
  employeeSignatureDate?: string

  supervisorSignatureName?: string
  supervisorPosition?: string
  supervisorDate?: string

  departmentHeadSignatureName?: string
  departmentHeadPosition?: string
  departmentHeadDate?: string

  hrmoSignatureName?: string
  hrmoDate?: string
}

export const DTR_SIGNATURE_NAME_KEYS = [
  'employeeSignatureName',
  'supervisorSignatureName',
  'departmentHeadSignatureName',
  'hrmoSignatureName',
] as const

export const DTR_BLOCK_LETTER_KEYS = [
  'employeeName',
  'position',
  'officeDepartment',
  'payrollGroup',
] as const

export const toSignaturePrintedName = toPrintedName

export function withUppercaseSignatureNames<T extends DtrFormData>(data: T): T {
  const next = { ...data }
  for (const key of DTR_BLOCK_LETTER_KEYS) {
    if (next[key] !== undefined) next[key] = toBlockLetters(next[key])
  }
  for (const key of DTR_SIGNATURE_NAME_KEYS) {
    if (next[key] !== undefined) next[key] = toPrintedName(next[key])
  }
  return next
}

export type DtrRecord = DtrFormData & {
  id: string
  createdAt: string
  updatedAt: string
}
