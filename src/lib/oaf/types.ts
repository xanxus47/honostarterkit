export type OafFormData = {
  controlNumber?: string
  dateFiled?: string
  otaControlNumber?: string

  originalOtaControlNumber?: string
  dateApproved?: string

  employeeId?: string
  employeeName?: string
  position?: string
  officeDepartment?: string
  employmentStatus?: string

  originalDateOfOvertime?: string
  originalDaysOfWeek?: string
  originalTimeIn?: string
  originalTimeOut?: string
  originalTotalHours?: string

  newDateOfOvertime?: string
  newDaysOfWeek?: string
  newTimeIn?: string
  newTimeOut?: string
  newTotalHours?: string

  reasonForAmendment?: string

  requestedBy?: string
  requestedByDate?: string
  recommendedBy?: string
  recommendedByDate?: string
  approvedBy?: string
  approvedByDate?: string
  verifiedBy?: string
  verifiedByDate?: string

  hrmoReceivedBy?: string
  hrmoReceivedDate?: string
  hrmoEncodedBy?: string
  hrmoEncodedDate?: string
  hrmoRemarks?: string
}

export type OafRecord = OafFormData & {
  id: string
  createdAt: string
  updatedAt: string
}
