export type OcfFormData = {
  /** OTC control number shown in the top-right box */
  otcNumber?: string
  dateFiled?: string

  /** Section 1 — OTA Information */
  otaControlNumber?: string
  dateApproved?: string

  /** Section 2 — Employee Information */
  employeeId?: string
  employeeName?: string
  position?: string
  officeDepartment?: string

  /** Section 3 — Approved Schedule */
  dateOfOvertime?: string
  daysOfWeek?: string
  timeIn?: string
  timeOut?: string
  approvedTotalHours?: string
  purposeJustification?: string

  /** Section 4 — Reason */
  reasonForCancellation?: string

  /** Section 5 — Requested By */
  requestedBy?: string
  requestedByPosition?: string
  requestedByOffice?: string
  dateRequested?: string

  /** Section 6 — Approved By */
  approvedBy?: string
  approvedByPosition?: string
  approvedByOffice?: string
  approvedByDate?: string

  /** HRMO use */
  hrmoReceivedBy?: string
  hrmoDateReceived?: string
  hrmoEncodedBy?: string
  hrmoRemarks?: string
}

export type OcfRecord = OcfFormData & {
  id: string
  createdAt: string
  updatedAt: string
}
