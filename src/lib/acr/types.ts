export type AcrFormData = {
  correctionRequestNo?: string
  dateFiled?: string
  dtrControlNo?: string
  attendanceDate?: string

  employeeName?: string
  employeeId?: string
  position?: string
  officeDepartment?: string
  employmentStatus?: string
  payrollGroup?: string

  // 3. Reason for correction
  reasonForgotTimeIn?: boolean
  reasonForgotTimeOut?: boolean
  reasonForgotAmIn?: boolean
  reasonForgotAmOut?: boolean
  reasonForgotPmIn?: boolean
  reasonForgotPmOut?: boolean
  reasonForgotOtIn?: boolean
  reasonForgotOtOut?: boolean
  reasonBiometricError?: boolean
  reasonSystemError?: boolean
  reasonOfficialFieldWork?: boolean
  reasonOfficialBusiness?: boolean
  reasonOther?: boolean
  reasonOtherText?: string

  // 4. Attendance entry to be corrected
  originalDate?: string
  requestedDate?: string
  originalAmIn?: string
  requestedAmIn?: string
  originalAmOut?: string
  requestedAmOut?: string
  originalPmIn?: string
  requestedPmIn?: string
  originalPmOut?: string
  requestedPmOut?: string
  originalOtIn?: string
  requestedOtIn?: string
  originalOtOut?: string
  requestedOtOut?: string
  requestedTotalHours?: string
  requestedOvertime?: string
  requestedUndertime?: string

  // 5. Employee explanation
  actualArrivalDeparture?: string
  explanation?: string
  employeeSignatureName?: string
  employeeSignatureDate?: string

  // 6. Supporting documents
  supportLocatorSlip?: boolean
  supportCertificateAppearance?: boolean
  supportOfficialBusiness?: boolean
  supportSupervisorCert?: boolean
  supportBiometricLog?: boolean
  supportSystemErrorRecord?: boolean
  supportOther?: boolean
  supportOtherText?: string
  supportNone?: boolean
  documentReferenceNo?: string
  supportRemarks?: string

  // 7. Supervisor verification
  supervisorVerified?: boolean
  supervisorNotVerified?: boolean
  supervisorFurtherVerification?: boolean
  supervisorTimeIn?: string
  supervisorTimeInAmPm?: string
  supervisorTimeOut?: string
  supervisorTimeOutAmPm?: string
  supervisorRemarks?: string
  supervisorSignatureName?: string
  supervisorPosition?: string
  supervisorDate?: string

  // 8. HRMO review
  hrmoCorrectionSupported?: boolean
  hrmoSupervisorSufficient?: boolean
  hrmoDocumentSufficient?: boolean
  hrmoAdditionalDocsRequired?: boolean
  hrmoNotSupported?: boolean
  hrmoRepeatedMissed?: boolean
  hrmoOther?: boolean
  hrmoOtherText?: string
  similarCorrectionsCount?: string
  hrmoRemarks?: string
  hrmoReviewedBy?: string
  hrmoPosition?: string
  hrmoSignatureName?: string
  hrmoDate?: string

  // 9. Authorized approval
  approvalApproved?: boolean
  approvalDisapproved?: boolean
  approvalReturned?: boolean
  approvedAmIn?: string
  approvedAmOut?: string
  approvedPmIn?: string
  approvedPmOut?: string
  approvedOtIn?: string
  approvedOtOut?: string
  approvalRemarks?: string
  approverName?: string
  approverPosition?: string
  approverSignatureName?: string
  approverDate?: string

  // 10. System update
  updateEncoded?: boolean
  updateOriginalPreserved?: boolean
  updateRequestAttached?: boolean
  updateDocsAttached?: boolean
  updateAuditTrail?: boolean
  updateEmployeeNotified?: boolean
  originalSystemEntry?: string
  correctedSystemEntry?: string
  updatedBy?: string
  dateTimeUpdated?: string
  auditReferenceNo?: string

  // 11. Final status
  statusCorrected?: boolean
  statusNotCorrected?: boolean
  statusDisapproved?: boolean
  statusPending?: boolean
  hrmoFinalVerification?: string
  finalStatusDate?: string
}

export type AcrRecord = AcrFormData & {
  id: string
  createdAt: string
  updatedAt: string
}
