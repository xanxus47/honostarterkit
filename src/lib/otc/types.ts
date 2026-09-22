export type OvertimeDisposition = 'overtimePay' | 'cto'

export type OtcFormData = {
  controlNumber?: string
  dateCertified?: string
  otaControlNumber?: string

  employeeName?: string
  employeeId?: string
  position?: string
  officeDepartment?: string
  employmentStatus?: string
  payrollGroup?: string

  datesOfOvertime?: string
  overtimeDate?: string      // YYYY-MM-DD, used for DTR auto-populate
  daysOfWeek?: string
  approvedOvertimeHours?: string
  actualHoursRendered?: string
  natureOfWork?: string

  disposition?: OvertimeDisposition

  supervisorName?: string
  supervisorDate?: string

  departmentHeadName?: string
  departmentHeadDate?: string

  hrmoName?: string
  hrmoDate?: string

  payrollProcessedBy?: string
  payrollProcessedDate?: string
  payrollEncodedBy?: string
  payrollEncodedDate?: string
  payrollApprovedBy?: string
  payrollApprovedDate?: string
}

export type OtcRecord = OtcFormData & {
  id: string
  createdAt: string
  updatedAt: string
}
