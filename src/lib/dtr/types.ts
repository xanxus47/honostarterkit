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

export type DtrRecord = DtrFormData & {
  id: string
  createdAt: string
  updatedAt: string
}
