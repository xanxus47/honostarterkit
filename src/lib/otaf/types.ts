export type EmploymentStatus = 'permanent' | 'jobOrder' | 'contractual' | 'others'

export type OtafFormData = {
  controlNumber?: string
  dateRequested?: string
  verificationCode?: string
  verificationUrl?: string

  employeeName?: string
  employeeId?: string
  position?: string
  officeDepartment?: string

  employmentStatus?: EmploymentStatus
  employmentStatusOther?: string
  dateOfOvertime?: string

  timeIn?: string
  timeOut?: string
  estimatedTotalHours?: string

  purposeJustification?: string
  activityProject?: string
  fundingSource?: string

  supervisorName?: string
  supervisorPosition?: string
  supervisorDate?: string

  departmentHeadName?: string
  departmentHeadPosition?: string
  departmentHeadDate?: string

  hrmoName?: string
  hrmoPosition?: string
  hrmoDate?: string

  employeeSignatureName?: string
  employeeSignatureDate?: string

  payrollReferenceNo?: string
  payrollDatePosted?: string
  payrollEncodedBy?: string
  payrollCheckedBy?: string
  payrollApprovedBy?: string
}

export type OtafRecord = OtafFormData & {
  id: string
  createdAt: string
  updatedAt: string
}
