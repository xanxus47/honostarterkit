export type ApprovalDecision = 'approved' | 'disapproved'

export type CtoFormData = {
  controlNumber?: string
  dateFiled?: string

  employeeName?: string
  employeeId?: string
  position?: string
  officeDepartment?: string
  employmentStatus?: string
  payrollGroup?: string

  overtimeCertificationNo?: string
  datesEarned?: string
  totalEarnedCtoHours?: string
  availableCtoBalance?: string

  datesRequested?: string
  timeFrom?: string
  timeTo?: string
  totalHoursRequested?: string
  purposeReason?: string

  employeeSignatureName?: string
  employeeSignatureDate?: string

  supervisorDecision?: ApprovalDecision
  supervisorRemarks?: string
  supervisorSignatureName?: string
  supervisorPrintedName?: string
  supervisorPosition?: string
  supervisorDate?: string

  deptHeadDecision?: ApprovalDecision
  deptHeadRemarks?: string
  deptHeadSignatureName?: string
  deptHeadPrintedName?: string
  deptHeadDate?: string

  earnedCtoCredits?: string
  hoursRequested?: string
  remainingCtoBalance?: string
  hrmoVerifiedBy?: string
  hrmoVerifiedDate?: string

  processedBy?: string
  recordedBy?: string
  approvedBy?: string
  dateProcessed?: string
  ctoLedgerReferenceNo?: string
}

export type CtoRecord = CtoFormData & {
  id: string
  createdAt: string
  updatedAt: string
}
