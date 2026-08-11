export type SupervisorRating =
  | 'outstanding'
  | 'verySatisfactory'
  | 'satisfactory'
  | 'needsImprovement'
  | 'unsatisfactory'

export type OarFormData = {
  controlNumber?: string
  dateFiled?: string

  employeeId?: string
  employeeName?: string
  position?: string
  officeDepartment?: string
  employmentStatus?: string
  payrollGroup?: string

  dateOfOvertime?: string
  dayOfWeek?: string

  approvedTimeIn?: string
  approvedTimeOut?: string
  approvedTotalHours?: string

  actualTimeIn?: string
  actualTimeOut?: string
  actualTotalHours?: string

  activitiesPerformed?: string
  outputsDeliverables?: string
  problemsEncountered?: string

  supervisorRating?: SupervisorRating
  commentsRecommendations?: string

  employeeSignatureName?: string
  employeeSignatureDate?: string

  supervisorSignatureName?: string
  supervisorPosition?: string
  supervisorSignatureDate?: string

  hrmoReceivedBy?: string
  hrmoReceivedDate?: string
  hrmoVerifiedBy?: string
  hrmoVerifiedDate?: string
}

export type OarRecord = OarFormData & {
  id: string
  createdAt: string
  updatedAt: string
}
